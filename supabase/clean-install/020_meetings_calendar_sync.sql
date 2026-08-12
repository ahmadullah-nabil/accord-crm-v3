-- ═══════════════════════════════════════════════════════════════════════════
-- 020. MEETINGS → EXTERNAL CALENDAR  (Phase 2, one-way push)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Adds what a CRM meeting needs before it can become a Google / Microsoft /
-- Zoho calendar event with real invitations.
--
-- SCOPE: one-way, CRM → provider. Create, update, cancel. NOT RSVP, and not
-- inbound sync — both require reading calendar state back, which means webhook
-- channels (Google expires them in ~7 days, Graph in ~3), a renewal cron, delta
-- tokens, loop prevention and conflict resolution. `etag` is added here so that
-- work is additive later rather than a rewrite.
--
-- ─── THREE GAPS THIS CLOSES ────────────────────────────────────────────────
--
-- 1. WHOSE CALENDAR?  `organizer` is a display NAME chosen from a dropdown, and
--    007 gave meetings only `created_by TEXT`. But getTokenForCapability()
--    needs a user UUID. There was no reliable path from a meeting to the
--    account that should host its event.
--
-- 2. WHO IS INVITED?  `participants TEXT[]` holds internal CRM member NAMES.
--    Calendar invitations need EMAIL ADDRESSES, and external attendees
--    (a client on gmail.com) cannot be expressed as an internal member at all.
--
-- 3. WHAT TIME, WHERE?  `scheduled_date DATE` + `scheduled_time TIME` carries
--    no zone. "3:00 PM" alone is not a moment in time. Providers require an
--    instant plus an IANA zone. Today everything is implicitly Dhaka and works
--    by luck; the first cross-border attendee gets an event at the wrong hour
--    while it looks correct to everyone else — a missed client call, not a
--    visible error.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1. Organizer identity
-- ───────────────────────────────────────────────────────────────────────────
-- The CRM user whose connected calendar hosts this event. `organizer` (name)
-- is deliberately left alone — every existing list, filter and detail panel
-- reads it, and this column answers a different question.
--
-- NULL is meaningful and permitted: a meeting created before this migration,
-- or one nobody has claimed. Such a meeting simply cannot sync, which is
-- correct rather than an error.
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS organizer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.meetings.organizer_id IS
  'CRM user whose connected calendar account hosts the external event. Distinct from `organizer`, which is a display name. NULL = cannot sync.';

-- Deliberately NOT backfilled by matching `organizer` name → user. Two reasons:
-- name matching is unreliable (duplicates, renames), and a successful backfill
-- would make historical meetings eligible for sync — pushing events into
-- calendars for things that already happened and mailing clients invitations
-- to last month's demo. Old meetings stay unsynced. That is the honest state.


-- ───────────────────────────────────────────────────────────────────────────
-- 2. Attendees
-- ───────────────────────────────────────────────────────────────────────────
-- [{ "email": "...", "name": "...", "source": "internal"|"external"|"contact" }]
--
-- JSONB rather than TEXT[] because an attendee is not just an address: the UI
-- needs a display name, and `source` records where it came from — a CRM contact
-- (auto-filled from the contacts table), a colleague, or typed by hand.
--
-- SEPARATE from `participants` on purpose. Being listed on a CRM meeting and
-- being sent an external calendar invitation are different acts with different
-- consequences. Only these attendees receive an invitation; internal staff
-- tracked in `participants` are not silently mailed.
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS attendees JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.meetings.attendees IS
  'Invitation recipients: [{email,name,source}]. ONLY these receive an external calendar invite — `participants` is internal tracking and is never mailed.';

-- Reject a shape the sync function cannot use. Cheap here; a malformed row
-- would otherwise surface as a provider 400 with no clue which meeting caused it.
--
-- The validation lives in a FUNCTION rather than inline in the CHECK because a
-- check constraint may not contain a subquery, and inspecting each array
-- element requires jsonb_array_elements — a set-returning call in a subquery.
-- Postgres does permit a function call in a CHECK, so the subquery is legal one
-- level down. The function touches no tables and is therefore genuinely
-- IMMUTABLE, which is the condition that makes this safe.
--
-- Caveat worth knowing: Postgres does NOT re-validate existing rows if this
-- function is later redefined. Tightening the rule in future means an explicit
-- re-validation pass, not just a CREATE OR REPLACE.
CREATE OR REPLACE FUNCTION public.meetings_attendees_shape_ok(a JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT jsonb_typeof(a) = 'array'
     AND NOT EXISTS (
       SELECT 1
       FROM jsonb_array_elements(a) AS e
       WHERE jsonb_typeof(e) <> 'object'
          OR COALESCE(e->>'email', '') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     );
$$;

COMMENT ON FUNCTION public.meetings_attendees_shape_ok(JSONB) IS
  'Validates meetings.attendees is an array of objects each carrying a plausible email. Exists only because CHECK constraints cannot contain subqueries.';

ALTER TABLE public.meetings
  DROP CONSTRAINT IF EXISTS meetings_attendees_shape_check;

ALTER TABLE public.meetings
  ADD CONSTRAINT meetings_attendees_shape_check
  CHECK (public.meetings_attendees_shape_ok(attendees));


-- ───────────────────────────────────────────────────────────────────────────
-- 3. Time zone
-- ───────────────────────────────────────────────────────────────────────────
-- IANA name, not an offset: 'Asia/Dhaka', never '+06:00'. Offsets are wrong
-- twice a year anywhere with DST, and a recurring meeting stored as an offset
-- drifts an hour when the rule changes.
--
-- Default Asia/Dhaka matches what existing rows already implicitly mean, so the
-- backfill is truthful rather than a guess.
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Dhaka';

COMMENT ON COLUMN public.meetings.timezone IS
  'IANA zone for scheduled_date/scheduled_time. Never an offset — offsets break across DST. Sent explicitly on every provider event.';


-- ───────────────────────────────────────────────────────────────────────────
-- 4. Sync state
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.meetings
  -- Which provider hosts the event. Needed for update and cancel: an event
  -- created on Google cannot be cancelled through Zoho, and a user may switch
  -- their connected account between creating and editing a meeting.
  ADD COLUMN IF NOT EXISTS provider          TEXT,

  -- The provider's id for the event. Its presence is what makes the difference
  -- between "create" and "update" — without it every edit would create a
  -- duplicate event and re-invite everyone.
  ADD COLUMN IF NOT EXISTS external_event_id TEXT,

  -- Provider version marker. Unused by one-way push; stored now so inbound sync
  -- can later detect "changed on their side since we last wrote" without a
  -- schema migration at that point.
  ADD COLUMN IF NOT EXISTS etag              TEXT,

  ADD COLUMN IF NOT EXISTS sync_status       TEXT NOT NULL DEFAULT 'not_synced',

  -- Human-readable provider failure, surfaced in the UI. A meeting that failed
  -- to sync must SAY so — silence reads as success and the user assumes their
  -- client was invited.
  ADD COLUMN IF NOT EXISTS sync_error        TEXT,

  ADD COLUMN IF NOT EXISTS last_synced_at    TIMESTAMPTZ,

  -- Google Meet / Teams join link returned by the provider. Distinct from
  -- `location_url`, which the user types.
  ADD COLUMN IF NOT EXISTS meeting_url       TEXT;

ALTER TABLE public.meetings
  DROP CONSTRAINT IF EXISTS meetings_sync_status_check;

ALTER TABLE public.meetings
  ADD CONSTRAINT meetings_sync_status_check
  CHECK (sync_status IN ('not_synced', 'pending', 'synced', 'failed', 'cancelled'));

COMMENT ON COLUMN public.meetings.sync_status IS
  'not_synced = never pushed (the default, and correct for every pre-020 row) | pending = queued | synced = live at the provider | failed = see sync_error | cancelled = deleted at the provider';

COMMENT ON COLUMN public.meetings.last_synced_at IS
  'Shown in the UI so drift is visible. One-way push cannot detect an edit made in the provider calendar; a visible "last synced" plus a manual refresh is the honest substitute for inbound sync.';

-- Finding the local meeting for a provider event — needed by the manual refresh
-- now, and by webhook delivery if inbound sync is built later.
CREATE INDEX IF NOT EXISTS meetings_external_event_idx
  ON public.meetings (provider, external_event_id)
  WHERE external_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS meetings_sync_status_idx
  ON public.meetings (sync_status)
  WHERE sync_status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS meetings_organizer_id_idx
  ON public.meetings (organizer_id);


-- ───────────────────────────────────────────────────────────────────────────
-- 5. RLS — unchanged, and worth stating plainly
-- ───────────────────────────────────────────────────────────────────────────
-- 005 grants every authenticated user FOR ALL on meetings. That is pre-existing
-- and NOT tightened here, because narrowing it is a product decision about who
-- may see whose meetings, not part of calendar sync.
--
-- It does have a consequence worth recording: any authenticated user can edit
-- any meeting, including its `attendees`. Since calendar-sync mails whoever is
-- in that column, one user can cause an invitation to be sent from another
-- user's mailbox. The Edge Function therefore re-checks organizer_id ownership
-- server-side before pushing, rather than trusting the row.


-- ───────────────────────────────────────────────────────────────────────────
-- VERIFY
-- ───────────────────────────────────────────────────────────────────────────
--   SELECT column_name, data_type, column_default
--     FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'meetings'
--      AND column_name IN ('organizer_id','attendees','timezone','provider',
--                          'external_event_id','etag','sync_status',
--                          'sync_error','last_synced_at','meeting_url')
--    ORDER BY column_name;
--
-- Expect 10 rows. Every existing meeting should read sync_status='not_synced',
-- timezone='Asia/Dhaka', attendees='[]', organizer_id NULL.
