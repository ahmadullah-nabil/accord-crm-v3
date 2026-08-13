-- ═══════════════════════════════════════════════════════════════════════════
-- 026 — ATTACHMENTS: storage, metadata, and tenant isolation  (roadmap step 14)
-- Accord CRM · Clean Install Package
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RUN ORDER : 26. AFTER 022–025.
--
-- Part one of two. This is the STORAGE layer: where a file lives, who may read
-- it, and how it is linked to a CRM record. Part two populates
-- SendEmailInput.attachments in the Edge Function and handles the three
-- providers' very different upload rules.
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ THE PART THAT MATTERS MOST HERE IS NOT THE UPLOAD. IT IS THE ISOLATION. │
-- ├─────────────────────────────────────────────────────────────────────────┤
-- │ Supabase Storage is a SEPARATE RLS surface. Nothing in 023 touches it.  │
-- │ A bucket created through the dashboard with the default policies is     │
-- │ readable by every authenticated user of the project — which after 022   │
-- │ means every tenant.                                                      │
-- │                                                                          │
-- │ This CRM sends quotations and proposals. A cross-tenant read here is    │
-- │ one customer downloading another customer's pricing. That is the whole  │
-- │ reason this file exists before any upload code does.                     │
-- └─────────────────────────────────────────────────────────────────────────┘
--
-- THE PATH IS THE SECURITY BOUNDARY
-- ─────────────────────────────────
-- Every object is stored as:
--
--     {org_id}/{yyyy}/{mm}/{uuid}-{filename}
--
-- The leading org_id is not decoration — the Storage policies below compare it
-- against current_org_id(), so a path is only writable into your own org's
-- prefix and only readable from it. Putting the org anywhere but first would
-- make the policy a substring search instead of a prefix match.
--
-- The uuid prefix on the filename means two people uploading "quotation.pdf"
-- on the same day do not overwrite each other. The original name is kept in the
-- metadata table, so the user still downloads "quotation.pdf".
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 1: The bucket
-- ───────────────────────────────────────────────────────────────────────────
-- PRIVATE. A public bucket serves every object to anyone holding the URL, with
-- no auth and no policy evaluation at all — the policies below would simply not
-- run. Downloads go through signed URLs instead, which expire.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  FALSE,
  26214400,   -- 25 MB. Above every provider's practical inline limit, so the
              -- send path rejects with a useful message rather than the upload
              -- failing opaquely at a different layer.
  NULL        -- MIME allow-list deliberately NULL: this CRM sends whatever a
              -- client asks for — dwg, zip, xlsx. A list here becomes a support
              -- ticket every time someone has a format nobody anticipated.
)
ON CONFLICT (id) DO UPDATE
  SET public           = FALSE,
      file_size_limit  = EXCLUDED.file_size_limit;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 2: Metadata
-- ───────────────────────────────────────────────────────────────────────────
-- Storage holds bytes. This holds what the CRM needs to know: the real
-- filename, who uploaded it, and which record it belongs to.
CREATE TABLE IF NOT EXISTS public.attachments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID        NOT NULL DEFAULT public.current_org_id()
                            REFERENCES public.organizations(id) ON DELETE RESTRICT,

  -- The object path inside the bucket. UNIQUE, because two rows pointing at one
  -- object means deleting either one orphans or double-frees the file.
  storage_path  TEXT        NOT NULL UNIQUE,

  filename      TEXT        NOT NULL,          -- what the user sees
  mime_type     TEXT        NOT NULL DEFAULT 'application/octet-stream',
  size_bytes    BIGINT      NOT NULL DEFAULT 0,

  -- ── Soft link, same convention as 025 ────────────────────────────────────
  -- related_*, because a user chose it: this file is ABOUT that record.
  -- No foreign key, for the same reason as everywhere else — a deleted lead
  -- must not delete the quotation that was sent to them.
  related_type  TEXT,
  related_id    UUID,

  uploaded_by   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS attachments_org_idx ON public.attachments (org_id);
CREATE INDEX IF NOT EXISTS attachments_related_idx
  ON public.attachments (org_id, related_type, related_id)
  WHERE related_id IS NOT NULL;

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- Permissive policy: any member of the org may work with the org's files. Same
-- posture as leads and contacts — within an org this CRM is collaborative, and
-- narrowing it here alone would be a rule that exists nowhere else.
DROP POLICY IF EXISTS "Org members manage attachments" ON public.attachments;
CREATE POLICY "Org members manage attachments"
  ON public.attachments FOR ALL
  USING      (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Restrictive policy: the tenant boundary, exactly as in 023. ANDed with the
-- permissive one above by Postgres, so a future permissive policy on this table
-- cannot open a hole.
DROP POLICY IF EXISTS attachments_tenant_isolation ON public.attachments;
CREATE POLICY attachments_tenant_isolation
  ON public.attachments
  AS RESTRICTIVE FOR ALL
  USING      (org_id = public.current_org_id() AND public.is_org_member(org_id))
  WITH CHECK (org_id = public.current_org_id() AND public.is_org_member(org_id));


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 3: Storage policies — the actual file bytes
-- ───────────────────────────────────────────────────────────────────────────
-- storage.objects has its own RLS. The table policies above protect the
-- METADATA; without these, the bytes themselves are reachable by any
-- authenticated user of the project regardless of tenant.
--
-- (storage.foldername(name))[1] is the first path segment — the org id. Which
-- is why the org must come first in the path and why the layout is not
-- cosmetic.
--
-- These are PERMISSIVE and already carry the org test inline. Storage does not
-- inherit the restrictive policies from section 2 — a different table.

DROP POLICY IF EXISTS "attachments: read own org" ON storage.objects;
CREATE POLICY "attachments: read own org"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = public.current_org_id()::text
    AND public.is_org_member(public.current_org_id())
  );

DROP POLICY IF EXISTS "attachments: write own org" ON storage.objects;
CREATE POLICY "attachments: write own org"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = public.current_org_id()::text
    AND public.is_org_member(public.current_org_id())
  );

DROP POLICY IF EXISTS "attachments: delete own org" ON storage.objects;
CREATE POLICY "attachments: delete own org"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = public.current_org_id()::text
    AND public.is_org_member(public.current_org_id())
  );

-- No UPDATE policy. An attachment is immutable: replacing the bytes under a
-- path that an email already cited would silently change what a client
-- received. Uploading a new file and deleting the old one is the correct shape,
-- and it leaves the metadata row honest.


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 4: Link attachments to a sent email
-- ───────────────────────────────────────────────────────────────────────────
-- A join table rather than a column, because one email carries several files
-- and one file may be sent more than once — a price list attached to twelve
-- different quotations should be stored once.
CREATE TABLE IF NOT EXISTS public.email_attachments (
  email_message_id UUID NOT NULL
                       REFERENCES public.email_messages(id) ON DELETE CASCADE,
  attachment_id    UUID NOT NULL
                       REFERENCES public.attachments(id) ON DELETE RESTRICT,
  PRIMARY KEY (email_message_id, attachment_id)
);

-- ON DELETE RESTRICT on attachment_id, deliberately: a file that was actually
-- emailed to a client cannot be deleted while that record exists. The evidence
-- of what was sent outlives someone tidying their uploads.

ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;

-- No org_id of its own — both parents carry one, and a third copy is a third
-- thing that can disagree. Isolation is inherited through the EXISTS below.
DROP POLICY IF EXISTS "Org members read email attachments" ON public.email_attachments;
CREATE POLICY "Org members read email attachments"
  ON public.email_attachments FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.attachments a
            WHERE a.id = attachment_id AND a.org_id = public.current_org_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.attachments a
            WHERE a.id = attachment_id AND a.org_id = public.current_org_id())
  );


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 5: Service-role inserts
-- ───────────────────────────────────────────────────────────────────────────
-- Same trap as 022a. The send-email Edge Function runs as service role with no
-- JWT, so DEFAULT current_org_id() evaluates to NULL and the NOT NULL rejects
-- the row. Reuse the existing trigger rather than writing a second one.
DROP TRIGGER IF EXISTS attachments_fill_org ON public.attachments;
CREATE TRIGGER attachments_fill_org
  BEFORE INSERT ON public.attachments
  FOR EACH ROW EXECUTE FUNCTION public.fill_org_id('uploaded_by');


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 6: Verify
-- ───────────────────────────────────────────────────────────────────────────
SELECT 'bucket exists and is PRIVATE' AS check,
       COALESCE((SELECT CASE WHEN public THEN '*** PUBLIC — FAIL ***' ELSE 'PASS' END
                 FROM storage.buckets WHERE id='attachments'), '*** MISSING ***') AS result
UNION ALL
SELECT 'storage policies (expect 3)',
       (SELECT count(*)::text FROM pg_policies
        WHERE schemaname='storage' AND tablename='objects'
          AND policyname LIKE 'attachments:%')
UNION ALL
SELECT 'attachments restrictive policy',
       CASE WHEN EXISTS (SELECT 1 FROM pg_policies
                         WHERE tablename='attachments' AND permissive='RESTRICTIVE')
            THEN 'PASS' ELSE '*** FAIL ***' END
UNION ALL
SELECT 'org fill trigger',
       CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='attachments_fill_org')
            THEN 'PASS' ELSE '*** FAIL ***' END;


-- ═══════════════════════════════════════════════════════════════════════════
-- PART TWO — NOT IN THIS FILE
-- ═══════════════════════════════════════════════════════════════════════════
-- The Edge Function work, which is where the three providers stop agreeing:
--
--   Gmail      raw MIME, base64url. buildMimeMessage() already handles it;
--              above a threshold it needs the resumable upload endpoint.
--   Microsoft  Graph caps sendMail near 4 MB total. Larger needs a draft plus
--              a chunked upload session — a different request shape entirely.
--   Zoho       DOES NOT TAKE BYTES IN THE SEND CALL AT ALL. Files go to the
--              Upload Attachments API first, which returns a reference to cite
--              in the send body. This is the one that cannot be bolted on.
--
-- Because Zoho's flow differs in kind rather than in degree, the provider
-- interface needs an explicit `uploadAttachment` step rather than one more
-- field on sendMail. Design that before writing it.
-- ═══════════════════════════════════════════════════════════════════════════
