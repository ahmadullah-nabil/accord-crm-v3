import React, { useState } from 'react'
import {
  Mail, Calendar, Check, Loader2, AlertCircle, Plug, Unplug, Info,
} from 'lucide-react'
import {
  useIntegrations, useConnectIntegration, useDisconnectIntegration, useOAuthCallbackResult,
} from '../../hooks/useIntegrations.js'
import { PROVIDER_META, ERROR_MESSAGES, LOCAL_CATALOGUE } from '../../services/integrationsService.js'
import { SettingCard, StoredPreferenceNote } from './SettingsShared.jsx'
import { Skeleton } from '../ui/Skeleton.jsx'

const CAPABILITY_ICON = { email: Mail, calendar: Calendar }

const STATUS_STYLE = {
  connected:       { label: 'Connected',        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  reauth_required: { label: 'Reconnect needed', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  revoked:         { label: 'Revoked',          cls: 'bg-gray-50 text-gray-600 border-gray-200' },
  error:           { label: 'Error',            cls: 'bg-red-50 text-red-600 border-red-200' },
}

export function IntegrationsSection() {
  const { data, isLoading, isError, error } = useIntegrations()
  const connectMutation    = useConnectIntegration()
  const disconnectMutation = useDisconnectIntegration()
  const callback           = useOAuthCallbackResult()

  const [pending, setPending] = useState(null)   // `${provider}:${capability}`
  const [note, setNote]       = useState(null)

  if (isLoading) return <IntegrationsSkeleton />

  const accounts = data?.accounts ?? []

  // The server catalogue is authoritative when reachable. When it is not — the
  // Edge Functions are not deployed, or the network failed — fall back to the
  // locally known providers so the page still renders something truthful.
  // Previously this was `data?.catalogue ?? []`, which produced an empty card.
  const catalogue = data?.catalogue?.length ? data.catalogue : LOCAL_CATALOGUE

  // Connecting requires the backend. When it is unavailable the cards still
  // render, but every Connect button is disabled rather than failing on click.
  const backendUnavailable = isError || error?.code === 'not_deployed'

  const accountsFor = (provider) => accounts.filter((a) => a.provider === provider)

  const handleConnect = (provider, capability) => {
    setNote(null)
    setPending(`${provider}:${capability}`)
    connectMutation.mutate({ provider, capability }, {
      onError: () => setPending(null),
    })
  }

  const handleDisconnect = (account) => {
    setNote(null)
    disconnectMutation.mutate(account.id, {
      onSuccess: (res) => { if (res.note) setNote(res.note) },
    })
  }

  return (
    <div className="space-y-4">
      {/* Result of the OAuth round trip. A failed authorization NEVER renders
          as connected — the callback function only writes 'connected' after
          both the token exchange and the identity fetch have succeeded. */}
      {callback?.status === 'connected' && (
        <div className="card p-3 flex items-start gap-2 border-emerald-200 bg-emerald-50/40">
          <Check size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-emerald-800">
            {PROVIDER_META[callback.provider]?.label ?? callback.provider} connected successfully.
          </p>
        </div>
      )}
      {callback?.status === 'error' && (
        <div className="card p-3 flex items-start gap-2 border-red-200 bg-red-50/40">
          <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-700">
            {ERROR_MESSAGES[callback.reason] ?? ERROR_MESSAGES.provider_error}
          </p>
        </div>
      )}
      {note && (
        <div className="card p-3 flex items-start gap-2 border-amber-200 bg-amber-50/40">
          <Info size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800">{note}</p>
        </div>
      )}
      {isError && (
        <div className={`card p-3 flex items-start gap-2 ${
          error?.code === 'not_deployed'
            ? 'border-amber-200 bg-amber-50/40'   // setup step, not a fault
            : 'border-red-200 bg-red-50/40'
        }`}>
          <AlertCircle
            size={14}
            className={`mt-0.5 flex-shrink-0 ${
              error?.code === 'not_deployed' ? 'text-amber-600' : 'text-red-500'
            }`}
          />
          <div className="min-w-0">
            <p className={`text-xs ${
              error?.code === 'not_deployed' ? 'text-amber-800' : 'text-red-700'
            }`}>
              {ERROR_MESSAGES[error?.code] ?? 'Could not load your integrations.'}
            </p>
            {error?.code === 'not_deployed' && (
              <p className="text-[11px] text-amber-700/80 mt-1">
                Deploy them with{' '}
                <code className="font-mono bg-amber-100/70 rounded px-1 py-0.5">
                  supabase functions deploy
                </code>{' '}
                and run <code className="font-mono bg-amber-100/70 rounded px-1 py-0.5">017_integrations.sql</code>.
                The providers below are shown for reference and cannot be connected yet.
              </p>
            )}
          </div>
        </div>
      )}

      <SettingCard
        title="Email & Calendar"
        description="Connect an external account so Accord CRM can send email and manage calendar events on your behalf."
      >
        <StoredPreferenceNote>
          Email and calendar are <strong>separate permissions</strong> — connect
          either one without the other. Accord CRM requests <strong>send-only</strong>{' '}
          email access and never requests permission to read your inbox.
        </StoredPreferenceNote>

        <div className="space-y-3">
          {catalogue.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              accounts={accountsFor(provider.id)}
              pending={pending}
              isDisconnecting={disconnectMutation.isPending}
              disabled={backendUnavailable}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
            />
          ))}
        </div>
      </SettingCard>

      {/* Placeholder only — deliberately non-functional this phase. */}
      <SettingCard
        title="Other providers"
        description="Additional mail and calendar servers will be supported in a future release."
      >
        <div className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-gray-200 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <Plug size={16} className="text-gray-300 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-500">IMAP / SMTP · CalDAV · Exchange</p>
              <p className="text-xs text-gray-400 mt-0.5">
                The integration layer is provider-agnostic, so these plug in without schema changes.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400
                           bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1 flex-shrink-0">
            Coming later
          </span>
        </div>
      </SettingCard>
    </div>
  )
}

// ── Provider card ─────────────────────────────────────────────────────────────
function ProviderCard({ provider, accounts, pending, isDisconnecting, disabled, onConnect, onDisconnect }) {
  const meta = PROVIDER_META[provider.id] ?? { label: provider.id, capabilityLabels: {} }

  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-gray-50/60 border-b border-gray-100">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{meta.label}</p>
          {meta.note && <p className="text-[11px] text-gray-500 mt-0.5">{meta.note}</p>}
        </div>
      </div>

      <div className="divide-y divide-gray-50">
        {provider.capabilities.map((capability) => {
          const Icon = CAPABILITY_ICON[capability] ?? Plug
          // A capability is connected when some account for this provider holds it.
          const account = accounts.find((a) => (a.capabilities ?? []).includes(capability))
          const isPending = pending === `${provider.id}:${capability}`
          const status = account ? (STATUS_STYLE[account.status] ?? STATUS_STYLE.error) : null

          return (
            <div key={capability} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <Icon size={15} className="text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {meta.capabilityLabels?.[capability]
                      ?? capability.charAt(0).toUpperCase() + capability.slice(1)}
                  </p>
                  {account ? (
                    <p className="text-[11px] text-gray-500 truncate">
                      {account.account_email || account.account_name || 'Connected account'}
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-400">Not connected</p>
                  )}
                  {account?.status !== 'connected' && account?.last_error && (
                    <p className="text-[11px] text-amber-600 mt-0.5 truncate">{account.last_error}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {status && (
                  <span className={`text-[10px] font-bold uppercase tracking-wider
                                    border rounded-full px-2 py-0.5 ${status.cls}`}>
                    {status.label}
                  </span>
                )}

                {account ? (
                  <button
                    type="button"
                    onClick={() => onDisconnect(account)}
                    disabled={isDisconnecting}
                    className="btn-secondary py-1.5 px-3 text-xs gap-1.5"
                  >
                    {isDisconnecting
                      ? <Loader2 size={12} className="animate-spin" />
                      : <Unplug size={12} />}
                    Disconnect
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onConnect(provider.id, capability)}
                    disabled={isPending || disabled}
                    title={disabled ? 'Integration service is not deployed yet' : undefined}
                    className="btn-primary py-1.5 px-3 text-xs gap-1.5 min-w-[92px]"
                  >
                    {isPending
                      ? <><Loader2 size={12} className="animate-spin" /> Opening…</>
                      : 'Connect'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function IntegrationsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="card p-6 space-y-4">
        <Skeleton className="h-4 w-40" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-100 p-4 space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default IntegrationsSection
