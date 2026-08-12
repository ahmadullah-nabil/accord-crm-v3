-- ═══════════════════════════════════════════════════════════════════════════
-- 022_verify — run immediately after 022_multi_tenant_foundation.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Read-only. Creates nothing, changes nothing, safe to run repeatedly.
-- Every row must say PASS. A single FAIL means do not proceed to 023.
-- ═══════════════════════════════════════════════════════════════════════════

WITH checks AS (

  -- 1. Accord exists on the id settingsService.js already writes
  SELECT 1 AS n, 'Accord org exists on the sentinel id' AS check_name,
         EXISTS (SELECT 1 FROM public.organizations
                 WHERE id = '00000000-0000-0000-0000-000000000001') AS ok

  -- 2. Every profile became a member. A profile with no membership can log in
  --    and see nothing, which reads as a broken account.
  UNION ALL SELECT 2, 'Every profile has a membership',
    NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE NOT EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = p.id)
    )

  -- 3. Roles carried across intact
  UNION ALL SELECT 3, 'Membership roles match profiles.role',
    NOT EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.memberships m
        ON m.user_id = p.id
       AND m.org_id  = '00000000-0000-0000-0000-000000000001'
      WHERE COALESCE(NULLIF(p.role,''),'Employee') IS DISTINCT FROM m.role
    )

  -- 4. No orphan rows. NOT NULL is already enforced, so this catches a
  --    partially-applied run rather than normal operation.
  UNION ALL SELECT 4, 'No tenant row is missing org_id',
    NOT EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema='public' AND c.column_name='org_id'
        AND c.is_nullable='YES'
        AND c.table_name IN ('leads','contacts','tasks','meetings','opportunities',
                             'activities','notifications','email_messages','teams')
    )

  -- 5. DEFAULT current_org_id() present everywhere. Without it every INSERT
  --    path in the app has to name org_id explicitly.
  UNION ALL SELECT 5, 'org_id defaults to current_org_id()',
    NOT EXISTS (
      SELECT 1 FROM unnest(ARRAY['leads','contacts','tasks','meetings','opportunities',
                                 'activities','notifications','email_messages','teams']) t
      WHERE EXISTS (SELECT 1 FROM information_schema.tables
                    WHERE table_schema='public' AND table_name=t AND table_type='BASE TABLE')
        AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns c
          WHERE c.table_schema='public' AND c.table_name=t AND c.column_name='org_id'
            AND c.column_default LIKE '%current_org_id%')
    )

  -- 6. org_id leads an index on every tenant table — the scalability check
  UNION ALL SELECT 6, 'org_id is the leading column of an index',
    NOT EXISTS (
      SELECT 1 FROM unnest(ARRAY['leads','contacts','tasks','meetings','opportunities',
                                 'activities','notifications','email_messages','teams']) t
      WHERE EXISTS (SELECT 1 FROM information_schema.tables
                    WHERE table_schema='public' AND table_name=t AND table_type='BASE TABLE')
        AND NOT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname='public' AND tablename=t
            AND indexdef ~ '\(org_id')
    )

  -- 7. The helpers exist
  UNION ALL SELECT 7, 'Helper functions created',
    (SELECT count(*) = 5 FROM pg_proc p
     JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public'
       AND p.proname IN ('current_org_id','is_org_member','current_org_role',
                         'is_platform_admin','custom_access_token_hook'))

  -- 8. get_visible_profile_ids was replaced, not left at the 008 version.
  --    The old one walks manager_id with no org filter and crosses tenants.
  UNION ALL SELECT 8, 'get_visible_profile_ids is org-scoped',
    (SELECT prosrc LIKE '%org_members%'
     FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='get_visible_profile_ids' LIMIT 1)

  -- 9. platform_admins must have NO policies. A policy here would turn
  --    support access into ambient global read.
  UNION ALL SELECT 9, 'platform_admins has zero policies',
    NOT EXISTS (SELECT 1 FROM pg_policies
                WHERE schemaname='public'
                  AND tablename IN ('platform_admins','platform_access_log'))

  -- 10. Views must not bypass RLS. A view without security_invoker runs as its
  --     owner and returns every tenant's rows regardless of policy.
  UNION ALL SELECT 10, 'No view bypasses RLS (security_invoker on)',
    NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='v'
        AND COALESCE((SELECT option_value FROM pg_options_to_table(c.reloptions)
                      WHERE option_name='security_invoker'),'false') <> 'true'
    )

  -- 11. RLS is on for the new tables
  UNION ALL SELECT 11, 'RLS enabled on the tenancy tables',
    (SELECT bool_and(relrowsecurity) FROM pg_class c
     JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public'
       AND c.relname IN ('organizations','memberships','platform_admins','platform_access_log'))
)
SELECT n AS "#", check_name AS "check",
       CASE WHEN ok THEN 'PASS' ELSE '*** FAIL ***' END AS result
FROM checks ORDER BY n;


-- ───────────────────────────────────────────────────────────────────────────
-- NOT AUTOMATED — the state 022 deliberately leaves behind
-- ───────────────────────────────────────────────────────────────────────────
-- The query below is the reason 023 exists. It counts policies that do not
-- mention org_id, i.e. every policy that still lets one tenant reach another.
-- Expect a large number here after 022. Expect ZERO after 023.
SELECT count(*) AS policies_not_yet_org_scoped
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('leads','contacts','tasks','meetings','opportunities',
                    'activities','notifications','email_messages','teams')
  AND COALESCE(qual,'') || COALESCE(with_check,'') NOT LIKE '%org_id%';
