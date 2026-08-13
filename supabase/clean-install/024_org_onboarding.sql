-- ═══════════════════════════════════════════════════════════════════════════
-- 024 — ORG ONBOARDING
-- Accord CRM · Clean Install Package
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RUN ORDER : 24. AFTER 022, 022a, 023, 023a.
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ THE BUG THIS FIXES — user creation is broken right now                  │
-- ├─────────────────────────────────────────────────────────────────────────┤
-- │ createWorkspaceUser() calls supabase.auth.signUp(); the handle_new_user  │
-- │ trigger creates a profiles row; NOTHING creates a memberships row.       │
-- │                                                                          │
-- │ A user with no membership has no org. current_org_id() returns NULL,     │
-- │ every restrictive policy denies, and they log in to an empty CRM. The    │
-- │ admin who created them cannot see them either — they share no org.       │
-- │                                                                          │
-- │ Reproduced: profile_rows = 1, membership_rows = 0, and the admin's own   │
-- │ SELECT of that user returned 0.                                          │
-- └─────────────────────────────────────────────────────────────────────────┘
--
-- THE MODEL — invite, not self-serve signup
-- ─────────────────────────────────────────
-- This is a B2B CRM sold to banks. Nobody signs up for it at 2am and creates
-- their own tenant. Organisations are PROVISIONED by Accord; people are
-- INVITED into an existing organisation by an admin of that organisation.
--
-- That choice removes a large amount of work and a larger amount of risk:
-- no public signup page, no email-domain guessing, no "which org did this
-- stranger mean", no orphan tenants created by typos.
--
-- Consequence, stated plainly: a person who signs up without an invitation
-- gets an account with no org and sees nothing. That is correct behaviour, and
-- section 4 makes it say so rather than showing a blank screen.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 1: Invitations
-- ───────────────────────────────────────────────────────────────────────────
-- An invitation is a CLAIM ON AN EMAIL ADDRESS, written before that person has
-- an account. It is what turns a bare signUp into a membership.
--
-- Keyed on (org_id, email) rather than a token: the person may be invited,
-- ignore it, and be invited again. A second invitation should update the first,
-- not accumulate rows that disagree about their role.
CREATE TABLE IF NOT EXISTS public.org_invitations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Stored lowercase and trimmed. Auth emails are case-insensitive; a lookup
  -- that is not would silently fail to match "Nabil@..." against "nabil@...".
  email       TEXT        NOT NULL,

  role        TEXT        NOT NULL DEFAULT 'Employee',

  -- Optional pre-assignment, applied to the profile on acceptance so a new
  -- hire lands in the org chart rather than floating outside it.
  manager_id  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  department  TEXT        DEFAULT '',

  invited_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- 'pending' | 'accepted' | 'revoked'.
  -- Accepted rows are KEPT, not deleted: "who let this person in, and when"
  -- is the question an audit asks, and a deleted row cannot answer it.
  status      TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','accepted','revoked')),

  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (org_id, email)
);

CREATE INDEX IF NOT EXISTS org_invitations_email_idx
  ON public.org_invitations (email) WHERE status = 'pending';

ALTER TABLE public.org_invitations ENABLE ROW LEVEL SECURITY;

-- Readable and writable only by admins of the inviting org. A pending invite
-- reveals that a named person is joining a named company — not something to
-- leak across tenants.
DROP POLICY IF EXISTS "Org admins manage invitations" ON public.org_invitations;
CREATE POLICY "Org admins manage invitations"
  ON public.org_invitations FOR ALL
  USING (
    org_id = public.current_org_id()
    AND public.current_org_role() IN ('Admin','AGM')
  )
  WITH CHECK (
    org_id = public.current_org_id()
    AND public.current_org_role() IN ('Admin','AGM')
  );


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 2: Accept the invitation at signup
-- ───────────────────────────────────────────────────────────────────────────
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ WHY A TRIGGER ON auth.users AND NOT APPLICATION CODE                    │
-- ├─────────────────────────────────────────────────────────────────────────┤
-- │ The membership must exist before the new user's FIRST token is minted.  │
-- │ custom_access_token_hook reads memberships to write the org_id claim; a │
-- │ membership created afterwards by a second HTTP call means their first   │
-- │ session has no org and the app is empty until they sign out and back    │
-- │ in. Nobody does that — they report it as broken.                         │
-- │                                                                          │
-- │ It also cannot be forgotten. Any future signup path — a magic link, an  │
-- │ SSO provider, an admin tool nobody has written yet — goes through       │
-- │ auth.users, so it goes through this.                                     │
-- └─────────────────────────────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.accept_invitation_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv  public.org_invitations%ROWTYPE;
  mail TEXT;
BEGIN
  mail := lower(trim(NEW.email));
  IF mail IS NULL OR mail = '' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO inv
  FROM public.org_invitations
  WHERE email  = mail
    AND status = 'pending'
    AND expires_at > NOW()
  ORDER BY created_at DESC   -- newest wins if somehow two orgs invited them
  LIMIT 1;

  IF inv.id IS NULL THEN
    -- No invitation. Deliberately NOT an error: the account is created and has
    -- no org. Section 4 is what tells them that, instead of a blank CRM.
    RETURN NEW;
  END IF;

  INSERT INTO public.memberships (user_id, org_id, role)
  VALUES (NEW.id, inv.org_id, inv.role)
  ON CONFLICT (user_id, org_id) DO NOTHING;

  UPDATE public.org_invitations
     SET status = 'accepted', accepted_at = NOW()
   WHERE id = inv.id;

  -- Apply the pre-assignment. handle_new_user has already inserted the profile
  -- row (001 runs its trigger first); this fills in what the inviter chose.
  UPDATE public.profiles
     SET manager_id = COALESCE(inv.manager_id, manager_id),
         department = COALESCE(NULLIF(inv.department,''), department),
         role       = inv.role
   WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- AFTER, and ordered to run after handle_new_user — the profile row must exist
-- before this updates it. Trigger order within the same timing is alphabetical
-- by name in Postgres, and 'on_auth_user_created_membership' sorts after
-- 'on_auth_user_created'. Named for that reason, not by accident.
DROP TRIGGER IF EXISTS on_auth_user_created_membership ON auth.users;
CREATE TRIGGER on_auth_user_created_membership
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.accept_invitation_on_signup();


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 3: Provisioning an organisation
-- ───────────────────────────────────────────────────────────────────────────
-- Creating a tenant is an Accord operation, not a user action. There is no UI
-- for it and no RLS policy that permits it — this function is the only route,
-- and it must be called from the SQL editor or a service-role context.
--
-- It creates the org, invites the first admin, and returns what to tell them.
-- The admin then signs up normally and section 2 does the rest.
CREATE OR REPLACE FUNCTION public.provision_organization(
  p_name        TEXT,
  p_slug        TEXT,
  p_admin_email TEXT
)
RETURNS TABLE (org_id UUID, admin_email TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org UUID;
  mail    TEXT := lower(trim(p_admin_email));
BEGIN
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Organisation name is required';
  END IF;
  IF mail = '' OR mail NOT LIKE '%@%' THEN
    RAISE EXCEPTION 'A valid admin email is required';
  END IF;

  INSERT INTO public.organizations (name, slug)
  VALUES (trim(p_name), lower(trim(p_slug)))
  RETURNING id INTO new_org;

  -- 90 days, not the usual 14: provisioning often runs well before the
  -- customer's admin is ready to log in, and an expired invitation on day one
  -- is a support ticket for something that was working as designed.
  INSERT INTO public.org_invitations (org_id, email, role, expires_at)
  VALUES (new_org, mail, 'Admin', NOW() + INTERVAL '90 days');

  RETURN QUERY
  SELECT new_org, mail, (NOW() + INTERVAL '90 days')::timestamptz;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.provision_organization FROM PUBLIC, anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 4: Telling a user they have no org
-- ───────────────────────────────────────────────────────────────────────────
-- Without this the failure mode is a CRM that loads, looks normal, and is
-- empty — indistinguishable from "we lost your data". The app calls this after
-- login; it needs no org to answer, which is the entire point.
CREATE OR REPLACE FUNCTION public.my_membership_status()
RETURNS TABLE (
  has_membership   BOOLEAN,
  org_count        INTEGER,
  current_org      UUID,
  current_org_name TEXT,
  pending_invite   BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.memberships WHERE user_id = auth.uid() AND is_active),
    (SELECT count(*)::int FROM public.memberships WHERE user_id = auth.uid() AND is_active),
    public.current_org_id(),
    (SELECT o.name FROM public.organizations o WHERE o.id = public.current_org_id()),
    -- An invitation sent AFTER they signed up. The trigger only fires at
    -- signup, so this is the case where the fix is "sign out and back in",
    -- and the app can say so instead of leaving them guessing.
    EXISTS (
      SELECT 1 FROM public.org_invitations i
      JOIN auth.users u ON lower(u.email) = i.email
      WHERE u.id = auth.uid() AND i.status = 'pending' AND i.expires_at > NOW()
    );
$$;

GRANT EXECUTE ON FUNCTION public.my_membership_status TO authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 5: Repair — users created before this file existed
-- ───────────────────────────────────────────────────────────────────────────
-- Anyone added between 022 and now has a profile and no membership, and is
-- invisible. They are placed in Accord's org, because before multi-tenancy
-- there was nowhere else they could have belonged.
--
-- This is a one-time backfill and it is safe to re-run: the WHERE clause
-- excludes anyone who already has a membership anywhere.
INSERT INTO public.memberships (user_id, org_id, role, is_active)
SELECT p.id,
       '00000000-0000-0000-0000-000000000001',
       COALESCE(NULLIF(p.role,''),'Employee'),
       COALESCE(p.is_active, TRUE)
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.memberships m WHERE m.user_id = p.id
)
ON CONFLICT (user_id, org_id) DO NOTHING;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 6: Verify
-- ───────────────────────────────────────────────────────────────────────────
SELECT 'profiles with no membership (expect 0)' AS check,
       (SELECT count(*)::text FROM public.profiles p
        WHERE NOT EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = p.id)) AS value
UNION ALL
SELECT 'signup trigger installed (expect 1)',
       (SELECT count(*)::text FROM pg_trigger
        WHERE tgname = 'on_auth_user_created_membership')
UNION ALL
SELECT 'onboarding functions (expect 3)',
       (SELECT count(*)::text FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN ('accept_invitation_on_signup',
                            'provision_organization',
                            'my_membership_status'));


-- ═══════════════════════════════════════════════════════════════════════════
-- HOW TO USE THIS
-- ═══════════════════════════════════════════════════════════════════════════
-- Add someone to an EXISTING org — an org Admin does this, from the app once
-- the UI is built, or by hand until then:
--
--   INSERT INTO public.org_invitations (org_id, email, role)
--   VALUES (public.current_org_id(), 'newhire@accord.com', 'Manager');
--
-- …then they sign up normally and the trigger does the rest.
--
-- Onboard a NEW customer — Accord does this, SQL editor only:
--
--   SELECT * FROM public.provision_organization(
--     'Prime Bank PLC', 'prime-bank', 'admin@primebank.com');
--
-- STILL TO BUILD (frontend, not in this file):
--   • An "Invite user" form writing to org_invitations. The existing
--     UserCreateModal calls signUp directly and should become an invite —
--     until it does, an admin creating a user still produces someone with no
--     membership unless an invitation exists for that email first.
--   • A "you are not a member of any organisation" screen calling
--     my_membership_status(), so the failure is legible.
--   • An org switcher. Not needed until someone holds two memberships;
--     my_membership_status().org_count is how the app will know.
-- ═══════════════════════════════════════════════════════════════════════════
