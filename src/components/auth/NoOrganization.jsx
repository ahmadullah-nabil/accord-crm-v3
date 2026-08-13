// ─── NoOrganization ───────────────────────────────────────────────────────────
//
// Shown when someone is signed in but belongs to no organisation.
//
// Without this the failure mode is the worst kind: the CRM loads, looks
// completely normal, and is empty. Every list, every count, every chart reads
// zero — indistinguishable from "the company's data has been deleted". People
// escalate that. The actual cause is usually mundane and fixable in a minute.
//
// It happens in exactly three ways, and each has a different fix, so the screen
// says which one applies rather than offering a generic apology:
//
//   1. Signed up without an invitation → an admin must invite that address
//   2. Invited AFTER signing up        → sign out and back in
//   3. Membership revoked              → intended; nothing for them to do
//
// Case 2 is the one worth designing for. The membership trigger fires at
// SIGNUP, and custom_access_token_hook writes org_id into the token at LOGIN.
// Someone invited after they already have an account holds a token with no org
// claim until it refreshes, and no amount of reloading fixes it. "Sign out and
// back in" is the whole answer, and nobody guesses it unaided.

import React from 'react'
import { Building2, LogOut, RefreshCw, MailCheck } from 'lucide-react'
import { useMembershipStatus } from '../../hooks/useInvitations.js'
import { useAuthStore }        from '../../stores/authStore.js'
import { Spinner }             from '../ui/Spinner.jsx'

export function NoOrganization() {
  const { data: status, isLoading, refetch, isFetching } = useMembershipStatus()
  const logout  = useAuthStore((s) => s.logout)
  const user    = useAuthStore((s) => s.user)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  const pending = status?.pendingInvite

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 space-y-6">

        <div className="flex flex-col items-center gap-3 text-center">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ring-1
            ${pending ? 'bg-teal-50 ring-teal-200' : 'bg-amber-50 ring-amber-200'}`}>
            {pending
              ? <MailCheck size={22} className="text-teal-600" />
              : <Building2 size={22} className="text-amber-600" />}
          </div>

          <h1 className="font-display font-bold text-gray-900 text-lg">
            {pending ? 'Almost there' : 'No organisation yet'}
          </h1>

          {/* The account exists and works — saying so separates "you are not in
              a team" from "your login is broken", which is what it feels like. */}
          <p className="text-sm text-gray-500">
            You are signed in as{' '}
            <span className="font-medium text-gray-700">{user?.email}</span>, but this
            account is not part of any organisation, so there is nothing to show.
          </p>
        </div>

        {pending ? (
          // Case 2. The fix is one action, so it is the only thing offered.
          <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 space-y-3">
            <p className="text-sm text-teal-800">
              An invitation is waiting for this address. It is applied when you sign in,
              so <span className="font-semibold">sign out and sign back in</span> to
              join your team.
            </p>
            <button onClick={logout} className="btn-primary w-full">
              <LogOut size={14} /> Sign out and back in
            </button>
          </div>
        ) : (
          // Cases 1 and 3 are indistinguishable from here — and deliberately so.
          // Telling someone their access was revoked is the org admin's call to
          // make, not this screen's.
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-2">
            <p className="text-sm text-amber-800 font-semibold">What to do</p>
            <p className="text-xs text-amber-700">
              Ask an administrator at your company to invite{' '}
              <span className="font-mono">{user?.email}</span> from the Users page.
              Once they have, sign out and sign back in.
            </p>
            <p className="text-xs text-amber-700">
              If you signed up with a different address from the one they invited,
              that is the likeliest cause — the two must match exactly.
            </p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-secondary flex-1 disabled:opacity-60"
          >
            {isFetching
              ? <><Spinner size="sm" /> Checking…</>
              : <><RefreshCw size={14} /> Check again</>}
          </button>
          <button onClick={logout} className="btn-secondary flex-1">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
