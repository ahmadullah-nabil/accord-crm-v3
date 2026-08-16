// ─── PendingInviteBanner ──────────────────────────────────────────────────────
//
// step066. The other half of the invitation story.
//
// `accept_invitation_on_signup()` (024) fires on auth.users INSERT and takes
// the newest pending invitation. That handles the first one, once. An
// invitation sent to someone who ALREADY has an account has no INSERT left to
// fire on — before 030 it sat pending until it expired while the invitee saw
// nothing at all and the inviter saw a row that never resolved.
//
// This is the surface that closes it. Mounted in AppLayout so it is reachable
// from anywhere rather than buried in a settings page nobody visits after
// being told "you've been invited" over WhatsApp.
//
// RENDERS NOTHING when there is nothing pending, which is the normal case —
// same rule as the switcher. It is not a permanent band of chrome.
//
// ACCEPTING DOES NOT MOVE YOU. 030's accept_invitation() deliberately adds the
// membership without switching, and this copy says so, because relocating
// someone mid-session would change what every open tab is showing. The switcher
// appears the moment the second membership exists; that is where you choose.

import React, { useState } from 'react'
import { Mail, Check, X, Loader2 } from 'lucide-react'
import { useMyPendingInvitations, useAcceptInvitation } from '../../hooks/useOrganizations.js'

export function PendingInviteBanner() {
  const { data: invites = [], isLoading } = useMyPendingInvitations()
  const accept = useAcceptInvitation()
  const [dismissed, setDismissed] = useState([])
  const [accepted,  setAccepted]  = useState(null)

  if (isLoading) return null

  const visible = invites.filter((i) => !dismissed.includes(i.invitation_id))

  if (accepted) {
    return (
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-white">
        <Check size={14} className="text-emerald-600 shrink-0" />
        <p className="text-xs text-gray-900">
          You have joined <span className="font-medium">{accepted}</span>. Use the
          workspace switcher in the sidebar to move between workspaces.
        </p>
        <button
          onClick={() => setAccepted(null)}
          aria-label="Dismiss"
          className="ml-auto p-0.5 rounded text-gray-400 hover:text-gray-900 hover:bg-gray-100
                     transition-colors duration-120"
        >
          <X size={13} />
        </button>
      </div>
    )
  }

  if (visible.length === 0) return null

  const invite = visible[0]   // one at a time; a stack of banners is worse than a queue

  return (
    <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-white flex-wrap">
      <Mail size={14} className="text-gray-400 shrink-0" />
      <p className="text-xs text-gray-900 min-w-0">
        <span className="font-medium">{invite.org_name}</span> invited you to join as{' '}
        <span className="font-medium">{invite.role}</span>.
        {visible.length > 1 && (
          <span className="text-gray-400"> · {visible.length - 1} more</span>
        )}
      </p>

      {accept.isError && (
        <span className="text-[11px] text-red-500">
          {accept.error?.message || 'Could not accept.'}
        </span>
      )}

      <div className="ml-auto flex items-center gap-2 shrink-0">
        <button
          onClick={() => setDismissed((d) => [...d, invite.invitation_id])}
          className="btn-secondary text-xs"
          disabled={accept.isPending}
        >
          Not now
        </button>
        <button
          onClick={() => accept.mutate(invite.invitation_id, {
            onSuccess: (rows) => setAccepted(rows?.[0]?.org_name ?? invite.org_name),
          })}
          className="btn-primary text-xs"
          disabled={accept.isPending}
        >
          {accept.isPending
            ? <><Loader2 size={12} className="animate-spin" /> Joining…</>
            : 'Accept'}
        </button>
      </div>
    </div>
  )
}

export default PendingInviteBanner
