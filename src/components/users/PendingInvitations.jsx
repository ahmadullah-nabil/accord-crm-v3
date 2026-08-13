// ─── PendingInvitations ───────────────────────────────────────────────────────
//
// People who have been invited but have not signed up yet.
//
// They deliberately do NOT appear in the users table: no auth account exists, so
// a row there would be someone you cannot assign work to, message, or manage.
// But leaving them invisible entirely was worse — an admin had no way to see who
// had been invited, resend a link, or withdraw one, and would re-invite the same
// person because nothing on screen said they already had.
//
// The panel hides itself when there is nothing pending. An empty "Pending
// invitations (0)" box on every visit is furniture, not information.

import React, { useState } from 'react'
import {
  MailCheck, Copy, Check, X, RefreshCw, AlertTriangle, ChevronDown, ChevronUp,
} from 'lucide-react'
import {
  useInvitations, useRevokeInvitation, useRenewInvitation,
} from '../../hooks/useInvitations.js'
import { buildInviteLink } from '../../services/invitationService.js'
import { Spinner } from '../ui/Spinner.jsx'

function daysLeft(expiresAt) {
  const ms = new Date(expiresAt) - new Date()
  return Math.ceil(ms / (24 * 60 * 60 * 1000))
}

export function PendingInvitations() {
  const { data: invitations = [], isLoading } = useInvitations()
  const revoke = useRevokeInvitation()
  const renew  = useRenewInvitation()

  const [copiedId, setCopiedId] = useState('')
  const [open, setOpen]         = useState(true)
  const [confirmId, setConfirmId] = useState('')

  // Accepted and revoked rows are kept in the table for audit, but this panel
  // is about what still needs action.
  const pending = invitations.filter((i) => i.status === 'pending')

  if (isLoading) return null
  if (pending.length === 0) return null

  const handleCopy = (email, id) => {
    navigator.clipboard?.writeText(buildInviteLink(email)).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(''), 2000)
    })
  }

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-5 py-3.5 hover:bg-gray-50 transition-colors"
      >
        <div className="w-7 h-7 bg-amber-50 rounded-lg flex items-center justify-center ring-1 ring-amber-200">
          <MailCheck size={14} className="text-amber-600" />
        </div>
        <div className="text-left">
          <p className="text-sm font-semibold text-gray-900">
            Pending invitations ({pending.length})
          </p>
          <p className="text-[11px] text-gray-500">
            Invited but not signed up yet — they appear as members once they do
          </p>
        </div>
        {open
          ? <ChevronUp size={15} className="text-gray-400 ml-auto" />
          : <ChevronDown size={15} className="text-gray-400 ml-auto" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {pending.map((inv) => {
            const left    = daysLeft(inv.expiresAt)
            const expired = inv.isExpired

            return (
              <div key={inv.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{inv.email}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                      {inv.role}
                    </span>
                    {inv.department && (
                      <span className="text-[11px] text-gray-400">{inv.department}</span>
                    )}
                    {/* Expiry is derived from expires_at on every render, never
                        stored — a stored "expired" flag is wrong the moment it
                        is read a day later. Same rule as overdue tasks. */}
                    <span className={`text-[11px] flex items-center gap-1
                      ${expired ? 'text-red-500' : left <= 3 ? 'text-amber-600' : 'text-gray-400'}`}>
                      {expired
                        ? <><AlertTriangle size={10} /> Expired</>
                        : `Expires in ${left} day${left === 1 ? '' : 's'}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {expired ? (
                    <button
                      onClick={() => renew.mutate(inv.id)}
                      disabled={renew.isPending}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200
                                 hover:bg-gray-50 inline-flex items-center gap-1.5 disabled:opacity-60"
                      title="Extend by another 14 days"
                    >
                      <RefreshCw size={12} /> Renew
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCopy(inv.email, inv.id)}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200
                                 hover:bg-gray-50 inline-flex items-center gap-1.5"
                      title="Copy the signup link"
                    >
                      {copiedId === inv.id
                        ? <><Check size={12} className="text-teal-500" /> Copied</>
                        : <><Copy size={12} /> Copy link</>}
                    </button>
                  )}

                  {/* Two-step, because revoking is silent from the invitee's
                      side — they simply find the link stops working, with no
                      way to tell it was deliberate. */}
                  {confirmId === inv.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => { revoke.mutate(inv.id); setConfirmId('') }}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600"
                      >
                        Revoke
                      </button>
                      <button
                        onClick={() => setConfirmId('')}
                        className="text-xs px-2 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmId(inv.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50
                                 transition-colors"
                      title="Withdraw this invitation"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {(revoke.isPending || renew.isPending) && (
            <div className="px-5 py-2 flex items-center gap-2 text-xs text-gray-400">
              <Spinner size="sm" /> Updating…
            </div>
          )}
        </div>
      )}
    </div>
  )
}
