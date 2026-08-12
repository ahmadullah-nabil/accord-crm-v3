// ─── integration-list ─────────────────────────────────────────────────────────
//
// Returns the caller's connected accounts as METADATA ONLY.
//
// The explicit allow-list below is the contract: access_token, refresh_token
// and code_verifier are not merely omitted by RLS, they are never selected.
// Two independent controls have to fail before a secret could reach a browser.
//
// This function reads integration_accounts, which the client could technically
// query directly under its own RLS. It exists so the shape stays stable and so
// a single place governs what "an integration" looks like to the UI.

import { requireUser, adminClient } from '../_shared/supabase.ts'
import { corsHeaders, json, errorResponse } from '../_shared/http.ts'
import { ADAPTERS } from '../_shared/providers/index.ts'

/** Columns the browser is allowed to see. Never add a token column here. */
const SAFE_COLUMNS = [
  'id',
  'provider',
  'account_email',
  'account_name',
  'capabilities',
  'status',
  'last_error',
  'last_error_at',
  'last_sync_at',
  'connected_at',
  'updated_at',
].join(', ')

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('Origin'), req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const user  = await requireUser(req)
    const admin = adminClient()

    // Explicitly scoped to the caller. The service-role client bypasses RLS,
    // so this filter is doing the isolation work and must never be removed.
    const { data, error } = await admin
      .from('integration_accounts')
      .select(SAFE_COLUMNS)
      .eq('user_id', user.id)
      .order('connected_at', { ascending: false })

    if (error) {
      console.error('[integration-list] query failed:', error)
      throw error
    }

    // Catalogue so the UI can render provider cards without hardcoding what
    // each provider supports — new adapters appear automatically.
    const catalogue = Object.values(ADAPTERS).map((a) => ({
      id: a.id, label: a.label, capabilities: a.capabilities,
    }))

    return json({ accounts: data ?? [], catalogue }, 200, cors)
  } catch (err) {
    return errorResponse(err, corsHeaders(req.headers.get('Origin'), req))
  }
})
