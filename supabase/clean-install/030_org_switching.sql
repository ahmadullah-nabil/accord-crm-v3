-- ═══════════════════════════════════════════════════════════════════════════
-- 030 — ORG SWITCHING + POST-SIGNUP INVITATION ACCEPTANCE
-- Accord CRM
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RUN IN THE SUPABASE SQL EDITOR, after 028 and 029.
-- Project: gopcrwrprpfcieljdyjt  ("Accord CRM (Clone)")
--
-- Closes the last two database-side gaps in multi-tenancy:
--
--   A. A user holding two memberships has no way to say which org they are
--      acting in. Both custom_access_token_hook and current_org_id() pick
--      "oldest active membership" and there is no lever to change it.
--
--   B. accept_invitation_on_signup() consumes only the NEWEST pending
--      invitation, at signup, once. Its own comment says "newest wins if
--      somehow two orgs invited them". An invitation that arrives AFTER the
--      account exists is never acted on at all — the person is invited, sees
--      nothing, and the inviter sees a pending row forever.
--
-- ── Why a table and not profiles.current_org_id ────────────────────────────
-- 022 refused to put org_id on profiles, and was right: a column holds one org
-- and the whole point of memberships is that a user can be in several. What is
-- being stored here is different in kind — not "the user's org" but "the org
-- this user last chose to act in". That is session state, so it gets its own
-- table with a name that cannot be misread as membership.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 1: the selection
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_org_selection (
  user_id    UUID        PRIMARY KEY REFERENCES auth.users(id)          ON DELETE CASCADE,
  org_id     UUID        NOT NULL    REFERENCES public.organizations(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_org_selection ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own selection only" ON public.user_org_selection;
CREATE POLICY "Own selection only"
  ON public.user_org_selection
  FOR ALL
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ⚠ THIS TABLE MUST NEVER CARRY THE TENANT ISOLATION POLICY.
-- It has an org_id column, so 028's information_schema scan would pick it up
-- and add `org_id = current_org_id()`. That is a deadlock by construction: to
-- switch INTO org B you must write a selection row for org B while your
-- current claim still says org A, and the policy would refuse exactly that
-- write. The own-row-only policy above is the correct boundary — a user may
-- only ever read or write their own selection, in any org.
CREATE OR REPLACE FUNCTION public.tenant_isolation_excluded()
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'memberships',           -- must be readable across orgs, or no switcher works
    'org_invitations',       -- matched by email before any membership exists
    'user_org_selection',    -- 030; see the note above — isolating it deadlocks switching
    'platform_admins',       -- cross-tenant by design
    'platform_access_log'    -- cross-tenant by design
  ]
$$;

-- Belt and braces: if 028 was re-run between these two files, drop what it made.
DROP POLICY IF EXISTS user_org_selection_tenant_isolation ON public.user_org_selection;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 2: resolving the acting org, in one place
-- ───────────────────────────────────────────────────────────────────────────
-- Both the JWT hook and current_org_id()'s fallback need the same answer, and
-- if they ever disagree a user's claim says one org while their queries filter
-- by another. One function, called by both.
CREATE OR REPLACE FUNCTION public.resolve_acting_org(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- 1. an explicit selection, but only while it is still a live membership.
  --    Being removed from an org must drop you out of it, not strand you.
  SELECT s.org_id
    FROM public.user_org_selection s
    JOIN public.memberships   m ON m.user_id = s.user_id AND m.org_id = s.org_id AND m.is_active
    JOIN public.organizations o ON o.id = s.org_id AND o.status = 'active'
   WHERE s.user_id = p_user_id

  UNION ALL

  -- 2. otherwise the oldest active membership — the pre-030 behaviour, kept so
  --    every existing user resolves exactly where they resolved yesterday.
  SELECT m.org_id
    FROM public.memberships m
    JOIN public.organizations o ON o.id = m.org_id AND o.status = 'active'
   WHERE m.user_id = p_user_id
     AND m.is_active
     AND NOT EXISTS (
       SELECT 1 FROM public.user_org_selection s2
        JOIN public.memberships m2 ON m2.user_id = s2.user_id AND m2.org_id = s2.org_id AND m2.is_active
       WHERE s2.user_id = p_user_id
     )
   ORDER BY m.created_at

  LIMIT 1;
$$;


-- ── The JWT hook now reads the selection ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims   JSONB;
  uid      UUID;
  the_org  UUID;
  the_role TEXT;
BEGIN
  claims := COALESCE(event -> 'claims', '{}'::jsonb);
  uid    := (event ->> 'user_id')::uuid;

  the_org := public.resolve_acting_org(uid);

  IF the_org IS NOT NULL THEN
    SELECT m.role INTO the_role
      FROM public.memberships m
     WHERE m.user_id = uid AND m.org_id = the_org AND m.is_active;

    claims := jsonb_set(claims, '{org_id}',   to_jsonb(the_org::text));
    claims := jsonb_set(claims, '{org_role}', to_jsonb(the_role));
  END IF;

  -- Unchanged from 022: a user with no membership gets a token with NO org
  -- claim, current_org_id() returns NULL, and every policy denies. Someone
  -- removed from every org loses access at their next refresh with nobody
  -- having to remember to revoke anything.
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;


-- ── current_org_id()'s FALLBACK path now reads the selection too ───────────
-- The JWT path is untouched. Only the branch that runs when the claim is
-- absent — i.e. when the dashboard hook is off — changes, so that switching
-- still works in that degraded state instead of silently doing nothing.
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claim_text TEXT;
BEGIN
  BEGIN
    claim_text := current_setting('request.jwt.claims', true)::jsonb ->> 'org_id';
  EXCEPTION WHEN OTHERS THEN
    claim_text := NULL;   -- no JWT at all (pg_cron, psql, the SQL editor)
  END;

  IF claim_text IS NOT NULL AND claim_text <> '' THEN
    BEGIN
      RETURN claim_text::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      -- A malformed claim must not fall through to the lookup: that would let
      -- a tampered token downgrade into a valid session.
      RETURN NULL;
    END;
  END IF;

  RETURN public.resolve_acting_org(auth.uid());
END;
$$;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 3: switching
-- ───────────────────────────────────────────────────────────────────────────
-- The client calls this, then calls supabase.auth.refreshSession(). Both steps
-- are required: this writes the selection, the refresh mints a token carrying
-- the new claim. Without the refresh the row changes and every query keeps
-- filtering by the old org, which looks exactly like the switch silently failing.
CREATE OR REPLACE FUNCTION public.set_current_org(p_org_id UUID)
RETURNS TABLE (org_id UUID, org_name TEXT, org_role TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  r   TEXT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in.';
  END IF;

  -- Membership is checked HERE, not in a policy, because this function is
  -- SECURITY DEFINER and the whole point is to write a row for an org the
  -- caller is not currently acting in.
  SELECT m.role INTO r
    FROM public.memberships m
    JOIN public.organizations o ON o.id = m.org_id
   WHERE m.user_id = uid
     AND m.org_id  = p_org_id
     AND m.is_active
     AND o.status  = 'active';

  IF r IS NULL THEN
    RAISE EXCEPTION 'You are not an active member of that organisation.';
  END IF;

  INSERT INTO public.user_org_selection (user_id, org_id, updated_at)
  VALUES (uid, p_org_id, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET org_id = EXCLUDED.org_id, updated_at = NOW();

  RETURN QUERY
  SELECT o.id, o.name, r FROM public.organizations o WHERE o.id = p_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_current_org(UUID) TO authenticated;


-- ── Everything the switcher needs, in one call ─────────────────────────────
CREATE OR REPLACE FUNCTION public.my_organizations()
RETURNS TABLE (org_id UUID, org_name TEXT, org_slug TEXT, org_role TEXT, is_current BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.name, o.slug, m.role,
         o.id = public.resolve_acting_org(auth.uid())
    FROM public.memberships m
    JOIN public.organizations o ON o.id = m.org_id
   WHERE m.user_id = auth.uid()
     AND m.is_active
     AND o.status = 'active'
   ORDER BY o.name;
$$;

GRANT EXECUTE ON FUNCTION public.my_organizations() TO authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 4: invitations that arrive after the account exists
-- ───────────────────────────────────────────────────────────────────────────
-- accept_invitation_on_signup() (024) fires on auth.users INSERT and takes the
-- newest pending invitation. Correct once. Everything after that — a second
-- org inviting an existing user, or two orgs inviting the same person before
-- they sign up — needs a route the trigger cannot provide, because there is no
-- INSERT left to fire on.
--
-- Matching is by EMAIL, exactly as the trigger does, so an invitation is
-- visible only to the address it was sent to.
CREATE OR REPLACE FUNCTION public.my_pending_invitations()
RETURNS TABLE (
  invitation_id UUID,
  org_id        UUID,
  org_name      TEXT,
  role          TEXT,
  expires_at    TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.org_id, o.name, i.role, i.expires_at
    FROM public.org_invitations i
    JOIN public.organizations o ON o.id = i.org_id
   WHERE i.status = 'pending'
     AND i.expires_at > NOW()
     AND o.status = 'active'
     AND lower(trim(i.email)) = (
       SELECT lower(trim(u.email)) FROM auth.users u WHERE u.id = auth.uid()
     )
     -- Already a member: the invitation is stale rather than pending. Showing
     -- it would offer to join an org you are already in.
     AND NOT EXISTS (
       SELECT 1 FROM public.memberships m
        WHERE m.user_id = auth.uid() AND m.org_id = i.org_id AND m.is_active
     )
   ORDER BY i.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.my_pending_invitations() TO authenticated;


CREATE OR REPLACE FUNCTION public.accept_invitation(p_invitation_id UUID)
RETURNS TABLE (org_id UUID, org_name TEXT, org_role TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid  UUID := auth.uid();
  mail TEXT;
  inv  public.org_invitations%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in.';
  END IF;

  SELECT lower(trim(u.email)) INTO mail FROM auth.users u WHERE u.id = uid;

  SELECT * INTO inv FROM public.org_invitations WHERE id = p_invitation_id;

  -- One message for every failure mode. "Wrong email", "already used" and
  -- "does not exist" are all information about invitations belonging to other
  -- people; distinguishing them turns this into an enumeration oracle.
  IF inv.id IS NULL
     OR inv.status <> 'pending'
     OR inv.expires_at <= NOW()
     OR lower(trim(inv.email)) <> mail THEN
    RAISE EXCEPTION 'That invitation is not valid for this account.';
  END IF;

  INSERT INTO public.memberships (user_id, org_id, role)
  VALUES (uid, inv.org_id, inv.role)
  ON CONFLICT (user_id, org_id) DO UPDATE
    SET is_active = TRUE, role = EXCLUDED.role;

  UPDATE public.org_invitations
     SET status = 'accepted', accepted_at = NOW()
   WHERE id = inv.id;

  -- Deliberately does NOT switch the user into the new org, and does not touch
  -- profiles. Accepting is not the same act as moving; the switcher is where
  -- you choose where to be, and silently relocating someone mid-session would
  -- change what every open tab is showing.
  RETURN QUERY
  SELECT o.id, o.name, inv.role FROM public.organizations o WHERE o.id = inv.org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation(UUID) TO authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 5: verify
-- ───────────────────────────────────────────────────────────────────────────
DO $$
DECLARE bad INT;
BEGIN
  SELECT COUNT(*) INTO bad FROM public.verify_tenant_isolation();
  IF bad > 0 THEN
    RAISE EXCEPTION '030: % isolation defect(s) — run SELECT * FROM public.verify_tenant_isolation();', bad;
  END IF;
  RAISE NOTICE '030: isolation still clean, user_org_selection correctly excluded.';
END $$;

-- Expect: five rows, including user_org_selection.
SELECT unnest(public.tenant_isolation_excluded()) AS excluded_from_tenant_isolation;
