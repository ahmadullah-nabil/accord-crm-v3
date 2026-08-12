// ─── Server-side Supabase clients ─────────────────────────────────────────────
//
// TWO clients, deliberately distinct:
//
//   userClient(jwt)   runs AS THE CALLER, RLS applies. Used only to answer
//                     "who is this request?" — never to read credentials.
//   adminClient()     service_role, bypasses RLS. The ONLY thing that can read
//                     integration_credentials and integration_oauth_states.
//
// The service-role key lives in Edge Function secrets. It is never sent to the
// browser and must never appear in a VITE_ variable.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { IntegrationError } from './types.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!

export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Resolve the authenticated caller from the request's Authorization header.
 * Throws `unauthorized` when there is no valid Supabase session — every
 * function in this folder calls this first.
 */
export async function requireUser(req: Request): Promise<{ id: string; email: string }> {
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) throw new IntegrationError('unauthorized', 'Missing Authorization header.', 401)

  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await client.auth.getUser()
  if (error || !data?.user) {
    throw new IntegrationError('unauthorized', 'Invalid or expired session.', 401)
  }
  return { id: data.user.id, email: data.user.email ?? '' }
}
