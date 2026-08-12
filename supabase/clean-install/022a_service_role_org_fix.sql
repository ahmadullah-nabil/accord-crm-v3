-- ═══════════════════════════════════════════════════════════════════════════
-- 022a — SERVICE-ROLE INSERT FIX  ⚠ RUN THIS IMMEDIATELY AFTER 022
-- Accord CRM · Clean Install Package
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ WHAT 022 BROKE, AND WHY IT IS NOT VISIBLE UNTIL SOMEONE SENDS AN EMAIL  │
-- ├─────────────────────────────────────────────────────────────────────────┤
-- │ 022 gave nine tables `org_id UUID NOT NULL DEFAULT current_org_id()`.   │
-- │                                                                          │
-- │ current_org_id() reads the JWT. An Edge Function calling with the        │
-- │ SERVICE ROLE KEY has no JWT, so the function returns NULL, the DEFAULT   │
-- │ evaluates to NULL, and the NOT NULL constraint rejects the row:          │
-- │                                                                          │
-- │   ERROR: null value in column "org_id" of relation "email_messages"      │
-- │          violates not-null constraint                                    │
-- │                                                                          │
-- │ Reproduced against a real database, not inferred. Three code paths hit   │
-- │ this today:                                                              │
-- │   • send-email      → email_messages  (logs BEFORE sending, so a send    │
-- │                                        fails at the logging step)        │
-- │   • calendar-sync   → meetings                                           │
-- │   • both            → activities                                         │
-- │                                                                          │
-- │ RLS is not involved — service role bypasses RLS. This is a plain NOT     │
-- │ NULL violation, which is why no policy change can fix it.                │
-- └─────────────────────────────────────────────────────────────────────────┘
--
-- THE FIX, AND WHY A TRIGGER RATHER THAN AN EDGE FUNCTION CHANGE
-- ──────────────────────────────────────────────────────────────
-- Editing the three functions to pass org_id would work, and would leave the
-- next function anyone writes with the same trap — a runtime error in
-- production, discovered by a user whose email did not send.
--
-- A BEFORE INSERT trigger fills org_id from the row's OWN user reference when
-- it is NULL. Every one of these tables already carries one (user_id,
-- organizer_id, actor_id), because they all record who did the thing. So the
-- org is derivable from data the row already has, and no caller needs to know
-- about tenancy at all.
--
-- IT DOES NOT WEAKEN ISOLATION. The trigger only ever fires when org_id IS
-- NULL, and it resolves the org from the acting user's membership — it cannot
-- place a row in an org that user does not belong to. An explicit org_id from
-- a client is left untouched and is still policed by 023's WITH CHECK.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 1: Resolve an org from a user id
-- ───────────────────────────────────────────────────────────────────────────
-- Deliberately NOT current_org_id(): this runs where there is no JWT. It reads
-- the membership directly, which is the only source available to a service-role
-- call.
--
-- Returns NULL for a user with no active membership, and the INSERT then fails
-- exactly as it does today. That is correct — a row belonging to nobody's org
-- has no safe home, and inventing one would be worse than an error.
CREATE OR REPLACE FUNCTION public.org_id_for_user(for_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.org_id
  FROM public.memberships m
  JOIN public.organizations o ON o.id = m.org_id
  WHERE m.user_id = for_user_id
    AND m.is_active
    AND o.status = 'active'
  ORDER BY m.created_at
  LIMIT 1;
$$;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 2: The trigger
-- ───────────────────────────────────────────────────────────────────────────
-- Tries, in order:
--   1. the JWT   — a normal client call; identical to the column DEFAULT
--   2. the row's own user column — the service-role path
--
-- The column name differs per table, so it is passed as a trigger argument
-- rather than guessed. Guessing would silently do nothing on the one table
-- whose column is named differently, which is the failure mode this exists to
-- prevent.
CREATE OR REPLACE FUNCTION public.fill_org_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_col   TEXT := TG_ARGV[0];
  actor_uuid UUID;
  actor_text TEXT;
BEGIN
  -- An explicitly supplied org_id is never overwritten. 023's WITH CHECK is
  -- what decides whether it was allowed; this function does not police, it
  -- only fills a blank.
  IF NEW.org_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  NEW.org_id := public.current_org_id();
  IF NEW.org_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- No JWT — a service-role call. Derive from the row.
  --
  -- actor_id is TEXT on activities (see 007) while user_id / organizer_id are
  -- UUID. Reading into TEXT first and casting defensively means a row with a
  -- non-UUID actor_id — a legacy value, a name — fails to resolve rather than
  -- aborting the whole insert with a cast error.
  EXECUTE format('SELECT ($1).%I::text', user_col)
     INTO actor_text
    USING NEW;

  IF actor_text IS NULL OR actor_text = '' THEN
    RETURN NEW;   -- leaves NULL; NOT NULL then rejects it, loudly and early
  END IF;

  BEGIN
    actor_uuid := actor_text::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN NEW;
  END;

  NEW.org_id := public.org_id_for_user(actor_uuid);
  RETURN NEW;
END;
$$;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 3: Attach it
-- ───────────────────────────────────────────────────────────────────────────
-- Only the three tables an Edge Function writes to. The other six are reached
-- exclusively through PostgREST with a real JWT, where the column DEFAULT is
-- already sufficient — a trigger there would be cost with no benefit.
--
-- Add the table here if a future Edge Function starts writing to it.

DROP TRIGGER IF EXISTS email_messages_fill_org ON public.email_messages;
CREATE TRIGGER email_messages_fill_org
  BEFORE INSERT ON public.email_messages
  FOR EACH ROW EXECUTE FUNCTION public.fill_org_id('user_id');

DROP TRIGGER IF EXISTS meetings_fill_org ON public.meetings;
CREATE TRIGGER meetings_fill_org
  BEFORE INSERT ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.fill_org_id('organizer_id');

DROP TRIGGER IF EXISTS activities_fill_org ON public.activities;
CREATE TRIGGER activities_fill_org
  BEFORE INSERT ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.fill_org_id('actor_id');


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 4: Verify
-- ───────────────────────────────────────────────────────────────────────────
-- Both rows must say PASS. The first is the bug this file exists to fix.
DO $$
DECLARE
  test_user UUID;
  got_org   UUID;
  new_id    UUID;
BEGIN
  SELECT user_id INTO test_user
  FROM public.memberships WHERE is_active LIMIT 1;

  IF test_user IS NULL THEN
    RAISE NOTICE '022a VERIFY: skipped — no memberships to test with';
    RETURN;
  END IF;

  -- Simulate the service-role path: no JWT, no explicit org_id.
  INSERT INTO public.email_messages (user_id, provider, from_email, subject, status)
  -- provider must satisfy email_messages_provider_check — use a real one.
  VALUES (test_user, 'google', 'selftest@local', '022a self test', 'queued')
  RETURNING id, org_id INTO new_id, got_org;

  IF got_org IS NULL THEN
    RAISE EXCEPTION '022a VERIFY *** FAIL *** — org_id still NULL on a service-role insert';
  END IF;

  RAISE NOTICE '022a VERIFY: PASS — service-role insert resolved org_id = %', got_org;

  DELETE FROM public.email_messages WHERE id = new_id;
  RAISE NOTICE '022a VERIFY: PASS — test row removed';
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- STILL TRUE AFTER THIS FILE
-- ═══════════════════════════════════════════════════════════════════════════
-- Service role BYPASSES RLS. This file makes service-role INSERTS work; it does
-- nothing about service-role SELECTS and UPDATES, which continue to see every
-- tenant's rows. Every such query must filter org_id by hand.
--
-- That applies with particular force to step 17, moving the notification
-- scanner to pg_cron: a job that scans overdue tasks across the whole table has
-- no auth.uid() at all, and no policy will contain it.
-- ═══════════════════════════════════════════════════════════════════════════
