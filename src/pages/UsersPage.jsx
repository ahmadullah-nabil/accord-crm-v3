// ─── UsersPage (Members) ──────────────────────────────────────────────────────
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ step058 — FOUR STAT CARDS THAT RESTATED THE TOOLBAR UNDER THEM          │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ The page opened with an icon tile, a title, a subtitle, four stat cards  │
// │ and a toolbar card — roughly 300px before the first member. Three of the │
// │ four cards printed Total / Active / Inactive, and the filter chips        │
// │ DIRECTLY BELOW THEM printed "All (2) · Active (1) · Inactive (1)". The    │
// │ same three numbers twice, 90px apart. The fourth, Admins, is now a row    │
// │ in the Roles tab where it means something.                                │
// │                                                                          │
// │ The chips win because they are also CONTROLS: clicking one filters. A    │
// │ number you can act on beats the same number in a box you cannot.          │
// │                                                                          │
// │ VIEWHEADER IS RIGHT HERE, and it was wrong on Analytics. Its shape is    │
// │ "title · count of total" and it renders the count unconditionally —      │
// │ Analytics had no rows to count, this page is a list of members. Same     │
// │ primitive, opposite decision, for the same stated reason.                 │
// │                                                                          │
// │ THREE TABS, held in `?section=` — the convention Analytics established.  │
// │ Nothing else owns this value, so the URL owning it outright causes none  │
// │ of the ?leadOwner / ?owner trouble: that was ONE value with TWO owners,  │
// │ not a value in the URL.                                                   │
// │                                                                          │
// │ INVITATIONS KEEP THEIR VISIBILITY. `PendingInvitations` used to sit      │
// │ above the table and hide itself when empty. Moving it behind a tab would │
// │ hide it exactly when it matters, so the COUNT is on the tab label —      │
// │ "Invitations · 1" is visible from the Team tab without costing the list  │
// │ any vertical space. `useInvitations()` is React Query, so reading it     │
// │ here and inside the panel is one fetch, not two.                          │
// │                                                                          │
// │ FITS THE VIEWPORT, step055 pattern: root `h-full min-h-0 flex flex-col`, │
// │ header `shrink-0`, and exactly one region flexes and scrolls itself. Add │
// │ nothing here with a fixed height.                                         │
// └─────────────────────────────────────────────────────────────────────────┘

import React, { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { UserCog, RefreshCw, UserPlus } from 'lucide-react'
import { useWorkspaceUsers, useSetUserActive } from '../hooks/useUserManagement.js'
import { useInvitations }    from '../hooks/useInvitations.js'
import { UsersTable }        from '../components/users/UsersTable.jsx'
import { UserEditModal }     from '../components/users/UserEditModal.jsx'
import { UserCreateModal }   from '../components/users/UserCreateModal.jsx'
import { PendingInvitations } from '../components/users/PendingInvitations.jsx'
import { ViewHeader }        from '../components/ui/ViewHeader.jsx'
import { Segmented, SegButton } from '../components/ui/Segmented.jsx'
import { ROLES, ROLE_HIERARCHY } from '../lib/users.js'

const SECTION_IDS = ['team', 'invitations', 'roles']

/** Descriptions are lifted from the role hierarchy already documented at the
 *  top of lib/users.js. They are NOT invented here — if the hierarchy changes,
 *  that file is the source and this list follows it. */
const ROLE_NOTES = {
  [ROLES.ADMIN]:     'Full access. Can manage all records and users.',
  [ROLES.AGM]:       'Senior manager. Alias of Manager in the hierarchy.',
  [ROLES.MANAGER]:   "Sees subordinates' records and team analytics.",
  [ROLES.EMPLOYEE]:  'Sees own records; limited to assigned items.',
  [ROLES.EXECUTIVE]: 'Individual contributor. Alias of Employee.',
}

export function UsersPage() {
  const { data: users = [], isLoading, isError, refetch } = useWorkspaceUsers()
  const { data: invitations = [] } = useInvitations()
  const setActiveMutation = useSetUserActive()

  const [editingUser, setEditingUser] = useState(null)
  const [showCreate,  setShowCreate]  = useState(false)
  const [filter,      setFilter]      = useState('all')   // 'all' | 'active' | 'inactive'
  const [roleFilter,  setRoleFilter]  = useState('All')
  const [query,       setQuery]       = useState('')

  const [searchParams, setSearchParams] = useSearchParams()
  const raw     = searchParams.get('section')
  const section = SECTION_IDS.includes(raw) ? raw : 'team'

  const setSection = (next) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'team') params.delete('section')   // keep the default URL clean
    else params.set('section', next)
    setSearchParams(params, { replace: true })
  }

  const total    = users.length
  const active   = users.filter((u) => u.isActive).length
  const inactive = users.filter((u) => !u.isActive).length
  const pendingN = invitations.filter((i) => i.status === 'pending').length

  const q = query.trim().toLowerCase()
  const visible = users.filter((u) => {
    const statusOk = filter === 'all' ? true : filter === 'active' ? u.isActive : !u.isActive
    const roleOk   = roleFilter === 'All' || u.role === roleFilter
    const textOk   = !q
      || (u.name  || '').toLowerCase().includes(q)
      || (u.email || '').toLowerCase().includes(q)
    return statusOk && roleOk && textOk
  })

  const hasFilters = filter !== 'all' || roleFilter !== 'All' || q !== ''

  const clearFilters = () => { setFilter('all'); setRoleFilter('All'); setQuery('') }

  const handleToggleActive = (user) => {
    if (!confirm(`${user.isActive ? 'Deactivate' : 'Activate'} ${user.name || 'this user'}?`)) return
    setActiveMutation.mutate({ id: user.id, isActive: !user.isActive })
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-4">
        <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center ring-1 ring-red-200">
          <UserCog size={20} className="text-red-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-1">Failed to load users</p>
          <p className="text-xs text-gray-500">Check that the profiles table exists and RLS is configured.</p>
        </div>
        <button onClick={() => refetch()} className="btn-secondary text-sm gap-1.5">
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="h-full min-h-0 flex flex-col gap-2 max-w-[1400px]">
        {/* ── One line. The icon tile and the subtitle are gone for the same
            reason they went from Analytics: a 36px square beside the word
            "Members" on the Members page labels nothing. ─────────────── */}
        <div className="shrink-0">
          <ViewHeader
            title="Members"
            count={section === 'team' ? visible.length : total}
            total={total}
            leading={
              <Segmented>
                <SegButton active={section === 'team'} onClick={() => setSection('team')}>
                  Team
                </SegButton>
                <SegButton active={section === 'invitations'} onClick={() => setSection('invitations')}>
                  Invitations{pendingN > 0 ? ` · ${pendingN}` : ''}
                </SegButton>
                <SegButton active={section === 'roles'} onClick={() => setSection('roles')}>
                  Roles
                </SegButton>
              </Segmented>
            }
            search={section === 'team'
              ? { value: query, onChange: setQuery, placeholder: 'Search a member' }
              : undefined}
            filters={section === 'team'
              ? [{
                  label: 'Role',
                  value: roleFilter,
                  onChange: setRoleFilter,
                  options: ['All', ...Object.values(ROLES)],
                }]
              : []}
            hasFilters={section === 'team' && hasFilters}
            onClearFilters={clearFilters}
            actions={
              <button
                onClick={() => setShowCreate(true)}
                className="btn-primary text-sm flex items-center gap-1.5"
              >
                <UserPlus size={14} /> Add User
              </button>
            }
          />
        </div>

        {section === 'team' && (
          <>
            {/* The status chips ARE the Total / Active / Inactive figures the
                four cards used to print, and they filter. */}
            <div className="shrink-0">
              <Segmented>
                {[
                  { key: 'all',      label: `All · ${total}` },
                  { key: 'active',   label: `Active · ${active}` },
                  { key: 'inactive', label: `Inactive · ${inactive}` },
                ].map(({ key, label }) => (
                  <SegButton key={key} active={filter === key} onClick={() => setFilter(key)}>
                    {label}
                  </SegButton>
                ))}
              </Segmented>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              <UsersTable
                users={visible}
                isLoading={isLoading}
                onEdit={(user) => setEditingUser(user)}
                onToggleActive={handleToggleActive}
              />
            </div>
          </>
        )}

        {section === 'invitations' && (
          <div className="flex-1 min-h-0 overflow-y-auto">
            {/* PendingInvitations renders nothing when the list is empty — which
                is right when it sits above a table, and wrong inside a tab of
                its own. The empty state belongs here, not in that file. */}
            {pendingN === 0
              ? (
                <div className="card py-16 text-center">
                  <p className="text-sm font-semibold text-gray-800 mb-1">No pending invitations</p>
                  <p className="text-xs text-gray-400">
                    Invite someone with Add User — they appear here until they sign up.
                  </p>
                </div>
              )
              : <PendingInvitations />
            }
          </div>
        )}

        {section === 'roles' && (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Role</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Access</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-2.5 w-28">Members</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(ROLES)
                    .slice()
                    .sort((a, b) => (ROLE_HIERARCHY[b] ?? 0) - (ROLE_HIERARCHY[a] ?? 0))
                    .map((role) => (
                      <tr key={role} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{role}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{ROLE_NOTES[role] || '—'}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-900 text-right tabular-nums">
                          {users.filter((u) => u.role === role).length}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Said plainly rather than implied by a page that looks editable.
                There is no role editor: role is a field on the member. */}
            <p className="text-[11px] text-gray-400 mt-2 px-1">
              Roles are assigned per member from Edit user. Access is enforced in the
              database by RLS, not by this list.
            </p>
          </div>
        )}
      </div>

      {editingUser && (
        <UserEditModal
          user={editingUser}
          allUsers={users}
          onClose={() => setEditingUser(null)}
        />
      )}

      {showCreate && <UserCreateModal onClose={() => setShowCreate(false)} />}
    </>
  )
}

export default UsersPage
