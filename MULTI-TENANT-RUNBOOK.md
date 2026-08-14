# Multi-tenancy runbook

**Written 14 August 2026, alongside migrations 028 and 029.**

Two things this covers, in order:

1. Enabling the access-token hook, and proving it is actually on
2. The two-tenant isolation test — the only thing that proves isolation works

Everything in `029_verify_tenant_isolation.sql` proves the *schema* is right.
It runs in the SQL editor as a superuser, where RLS does not apply at all. You
can pass every check in that file and still leak across tenants. This runbook is
what closes that gap.

---

## Part 1 — The access-token hook

### Why it matters

`current_org_id()` is the single expression every isolation policy is built on.
It reads the `org_id` claim from the JWT, and falls back to a `memberships`
lookup if the claim is absent:

> Falls back to the oldest active membership, which is right for the single-org
> case and arbitrary for the multi-org one — that is precisely why the hook is
> not optional once a second membership exists.
> — comment in `022_multi_tenant_foundation.sql`

So with the hook off:

- one org: everything works, and nothing tells you the hook is off
- two orgs: a user is silently pinned to whichever org they joined first, with
  no way to switch, and no error anywhere

That is the worst shape a defect can take — invisible until a customer exists,
then invisible again because it looks like the app is working.

### Turning it on

1. Supabase dashboard → project `gopcrwrprpfcieljdyjt`
2. **Authentication → Hooks** (called *Auth Hooks* in some versions)
3. **Customize Access Token (JWT) Claims** → Enable
4. Select the Postgres function `public.custom_access_token_hook`
5. Save

### Proving it is on — do not skip this

The dashboard showing "enabled" is a claim about configuration. This is a claim
about the running system:

1. **Sign out of the CRM completely, then sign back in.** The claim is written
   when a token is *minted*. An existing session keeps its old, claimless token
   until it refreshes, so testing without a fresh login tests nothing.
2. Open DevTools → Application → Local Storage → the `sb-…-auth-token` entry.
3. Copy the `access_token` value and paste it into <https://jwt.io>.
4. In the decoded payload, look for:

   ```json
   "org_id": "00000000-0000-0000-0000-000000000001"
   ```

**If `org_id` is present** — the hook is live. Part 2 will test something real.

**If it is absent** — the hook is not running. Do not proceed to Part 2; a pass
there would only be telling you that the fallback works.

---

## Part 2 — The two-tenant isolation test

This has never been run. Until it passes, "the CRM is multi-tenant" is a
statement about the migrations, not about the system.

### Before you start

- Part 1 must show `org_id` in the JWT.
- Migrations 028 and 029 must both have been run.
- You need a second email address that has **never** signed up. A Gmail
  `+` alias (`you+tenant2@gmail.com`) works and costs nothing.
- Do this in a **private/incognito window** for the second tenant. Two Supabase
  sessions in one browser profile share local storage and will overwrite each
  other, which produces confusing results that look like isolation failures.

### Step 1 — provision the second org

In the SQL editor:

```sql
SELECT * FROM public.provision_organization(
  'Test Tenant Two',
  'test-tenant-two',
  'you+tenant2@gmail.com'
);
```

Returns the new `org_id`, the admin email and a 90-day expiry. Note the org id.

### Step 2 — sign the second admin up

In a private window, go to the CRM signup page and register with **exactly**
`you+tenant2@gmail.com`. The `on_auth_user_created_membership` trigger turns the
invitation into a membership before the first token is minted.

Confirm they landed somewhere real:

```sql
SELECT u.email, o.name AS org, m.role, m.is_active
FROM   public.memberships m
JOIN   public.organizations o ON o.id = m.org_id
JOIN   auth.users u ON u.id = m.user_id
ORDER  BY o.created_at;
```

Expect two rows in two different orgs. If the second user has no membership,
the invitation email did not match — check for typos and casing.

### Step 3 — create a marker record in each org

As **Accord** (your normal window): create a lead named `MARKER-ACCORD`.

As **Test Tenant Two** (private window): create a lead named `MARKER-TENANT2`.

### Step 4 — the actual test

Run each of these and write down the answer.

| # | Do this | Pass |
|---|---|---|
| 4.1 | In Tenant Two, open Leads | `MARKER-TENANT2` only. `MARKER-ACCORD` must **not** appear |
| 4.2 | In Accord, open Leads | `MARKER-ACCORD` only |
| 4.3 | In Accord, copy a lead's URL (`/leads/<uuid>`). Paste it into the Tenant Two window | Not-found state, **not** the record |
| 4.4 | In Tenant Two, open Members | The Tenant Two admin only |
| 4.5 | In Tenant Two, open Analytics | Figures counting Tenant Two rows only |
| 4.6 | In Accord, upload a file to a contact. Copy its storage path from the network tab. Try to fetch it while signed in as Tenant Two | Denied |
| 4.7 | In Tenant Two, open Settings → Integrations | No connected account, even though Accord has one |

**4.3 and 4.6 are the ones that matter.** The others test that queries are
scoped; those two test that a *deliberate* attempt to reach across the boundary
fails. A list filtering correctly proves the happy path; a direct id being
refused proves the policy.

**4.7 is new in 028.** Before that migration, `integration_accounts` had no
`org_id` at all — if the same person had been an admin of both orgs, their Accord
mailbox would have appeared, and been usable, inside Tenant Two.

### Step 5 — confirm the row counts

```sql
-- CHECK 7 from 029, re-run
SELECT o.name AS org,
       (SELECT COUNT(*) FROM public.leads WHERE org_id = o.id) AS leads,
       (SELECT COUNT(*) FROM public.memberships WHERE org_id = o.id AND is_active) AS members
FROM   public.organizations o
ORDER  BY o.created_at;
```

Each marker lead should sit in exactly one org.

### Step 6 — clean up, or don't

Leaving Test Tenant Two in place is useful: it makes every future isolation
regression visible the moment it appears, and it costs nothing but rows. If you
would rather remove it:

```sql
-- Deletes the org and cascades to memberships, invitations and its records.
-- Check the id twice. There is no undo.
DELETE FROM public.organizations WHERE slug = 'test-tenant-two';
```

The auth user survives that (it lives in `auth.users`) and will land on the
"no organisation" screen, which is itself worth seeing once.

---

## What this still does not cover

**Edge Functions.** They run as service role and bypass every policy in 023 and
028. The only tenant boundary in that layer is `assertOwnership()` in
`send-email/attachments.ts`. None of the tests above exercise a function, so
none of them say anything about it. That audit is its own piece of work.

**The org switcher.** Nothing in `src/stores` or `src/hooks` reads
`my_membership_status().org_count`, so a user holding two memberships has no way
to choose between them. After this runbook passes, that becomes the next real
gap rather than a hypothetical one.

**`accept_invitation_on_signup()` takes the newest invitation only.** Its own
comment says "newest wins if somehow two orgs invited them". Correct for one
org, wrong once multi-org is real — the second org's invitation is silently
consumed at signup. Needs an accept flow for invitations that arrive after an
account already exists.
