// ─── Provider registry ────────────────────────────────────────────────────────
//
// The ONLY place adapters are registered. Adding a provider — IMAP/SMTP,
// CalDAV, Fastmail — is a new file plus one line here. No Edge Function, no
// database column and no UI component needs to change.

import type { ProviderAdapter, ProviderId } from '../types.ts'
import { IntegrationError } from '../types.ts'
import { googleAdapter }    from './google.ts'
import { microsoftAdapter } from './microsoft.ts'
import { zohoAdapter }      from './zoho.ts'

export const ADAPTERS: Record<ProviderId, ProviderAdapter> = {
  google:    googleAdapter,
  microsoft: microsoftAdapter,
  zoho:      zohoAdapter,
}

export function getAdapter(provider: string): ProviderAdapter {
  const adapter = ADAPTERS[provider as ProviderId]
  if (!adapter) {
    throw new IntegrationError('bad_request', `Unsupported provider: ${provider}`, 400)
  }
  return adapter
}

export function supportsCapability(provider: string, capability: string): boolean {
  const adapter = ADAPTERS[provider as ProviderId]
  return !!adapter && adapter.capabilities.includes(capability as never)
}
