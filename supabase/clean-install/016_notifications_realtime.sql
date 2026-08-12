-- ═══════════════════════════════════════════════════════════════════════════
-- 016 — NOTIFICATIONS REALTIME REPLICATION
-- Accord CRM · Clean Install Package
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RUN ORDER : after 011_notifications.sql (safe to run at any later point)
-- DEPENDS ON: 011_notifications.sql (public.notifications must exist)
-- SCOPE     : public.notifications ONLY. No other table, policy or column is
--             touched by this file.
--
-- WHY THIS FILE EXISTS
-- ────────────────────
-- Creating the notifications table does not make it stream. Supabase Realtime
-- only broadcasts changes for tables that are members of the `supabase_realtime`
-- publication, and that membership is not part of the table DDL.
--
-- The frontend depends on this: useNotificationsRealtime() (mounted once in
-- AppLayout) opens a channel on `notifications:user:{id}` and listens for
-- INSERT / UPDATE / DELETE. Without the publication membership the channel opens
-- but never delivers a row — the bell badge would only update on refetch, and
-- the intelligence scanner's new notifications would not appear live.
--
-- This is the equivalent of ticking Database → Replication → supabase_realtime
-- for public.notifications in the Dashboard. Running this file means you do NOT
-- need to perform that manual step. Running both is harmless — the guard below
-- makes the ADD TABLE idempotent.
--
-- NO SCHEMA CHANGE IS MADE HERE
-- ─────────────────────────────
-- No column is added, altered or dropped. No RLS policy is created, modified or
-- weakened. Every column the frontend reads already exists in 011.
--
-- RLS STILL APPLIES TO THE STREAM
-- ───────────────────────────────
-- Realtime is not a way around row level security. Supabase evaluates the
-- table's RLS SELECT policy against the subscriber's JWT before delivering any
-- row, so "Users can read own notifications" (auth.uid() = user_id, from file
-- 011) governs the stream exactly as it governs a normal query. The client-side
-- `filter: user_id=eq.{id}` is a transport optimisation, not the security
-- boundary.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1. REPLICA IDENTITY
-- ───────────────────────────────────────────────────────────────────────────
-- Default replica identity emits only the primary key for UPDATE and DELETE.
-- FULL emits the whole previous row, which Realtime needs in order to evaluate
-- the RLS policy on the old record and to populate payload.old. Without it, the
-- DELETE branch of the subscription handler receives a row containing nothing
-- but the id.
ALTER TABLE public.notifications REPLICA IDENTITY FULL;


-- ───────────────────────────────────────────────────────────────────────────
-- 2. PUBLICATION MEMBERSHIP
-- ───────────────────────────────────────────────────────────────────────────
-- Guarded rather than bare: ALTER PUBLICATION ... ADD TABLE raises
-- "relation is already member of publication" on a second run, and on a project
-- where the Dashboard toggle was already used this file would otherwise fail.
-- The guard checks for that one specific pre-existing condition — it does not
-- suppress genuine errors.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE EXCEPTION
      'Publication "supabase_realtime" does not exist. This is created '
      'automatically by Supabase — if it is missing, you are not running '
      'against a Supabase project, or Realtime has been removed from it.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'notifications'
  ) THEN
    RAISE NOTICE 'public.notifications is already published to supabase_realtime — nothing to do.';
  ELSE
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    RAISE NOTICE 'public.notifications added to supabase_realtime.';
  END IF;
END
$$;


-- ───────────────────────────────────────────────────────────────────────────
-- 3. VERIFY (read-only)
-- ───────────────────────────────────────────────────────────────────────────
-- Expect exactly one row: public | notifications | f
-- A relreplident of 'f' confirms REPLICA IDENTITY FULL was applied.
SELECT
  pt.schemaname,
  pt.tablename,
  c.relreplident AS replica_identity,
  CASE WHEN c.relreplident = 'f' THEN 'PASS' ELSE 'FAIL — expected f (FULL)' END AS status
FROM pg_publication_tables pt
JOIN pg_class     c ON c.relname   = pt.tablename
JOIN pg_namespace n ON n.oid       = c.relnamespace AND n.nspname = pt.schemaname
WHERE pt.pubname   = 'supabase_realtime'
  AND pt.schemaname = 'public'
  AND pt.tablename  = 'notifications';
