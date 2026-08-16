// ─── OrgSwitcher ──────────────────────────────────────────────────────────────
//
// step066. Sits under the wordmark in the sidebar.
//
// RENDERS NOTHING FOR A SINGLE-ORG USER, which is everyone today. A control
// that only ever offers what you already have is furniture, and this rail has
// had furniture removed from it twice already. It appears the moment a second
// membership exists and not before — so the first person to hold two will see
// it without anyone shipping anything.
//
// The confirm step is deliberate. Switching drops the whole query cache and
// reloads the workspace; done by accident from a hover menu it reads as the app
// losing your data. One click opens the list, one click picks, and the pending
// state says which org it is moving to.

import React, { useState, useRef, useEffect } from 'react'
import { Building2, Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { useMyOrganizations, useSwitchOrg } from '../../hooks/useOrganizations.js'

export function OrgSwitcher({ collapsed = false }) {
  const { data: orgs = [], isLoading } = useMyOrganizations()
  const switchOrg = useSwitchOrg()

  const [open, setOpen]       = useState(false)
  const [target, setTarget]   = useState(null)
  const wrapRef = useRef(null)

  // Close on an outside click or Escape. Registered only while open.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    const onKey  = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // See the header: nothing to switch between, nothing to render.
  if (isLoading || orgs.length < 2) return null

  const current = orgs.find((o) => o.is_current) ?? orgs[0]

  const handlePick = (org) => {
    if (org.org_id === current?.org_id) { setOpen(false); return }
    setTarget(org.org_id)
    switchOrg.mutate(org.org_id, {
      onSettled: () => { setTarget(null); setOpen(false) },
    })
  }

  if (collapsed) {
    return (
      <div className="px-1 pb-1">
        <button
          onClick={() => setOpen((v) => !v)}
          title={current?.org_name}
          aria-label={`Workspace: ${current?.org_name}`}
          className="w-full flex items-center justify-center p-1.5 rounded-md
                     text-gray-500 hover:text-gray-900 hover:bg-gray-200
                     transition-colors duration-120"
        >
          <Building2 size={15} />
        </button>
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="relative px-2 pb-2">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={switchOrg.isPending}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md
                   border border-gray-200 bg-white
                   hover:border-gray-300 transition-colors duration-120
                   disabled:opacity-60 disabled:cursor-wait"
      >
        <Building2 size={14} className="text-gray-400 shrink-0" />
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-[10px] uppercase tracking-wide text-gray-400 leading-none">
            Workspace
          </span>
          <span className="block text-xs font-medium text-gray-900 truncate mt-0.5">
            {switchOrg.isPending
              ? orgs.find((o) => o.org_id === target)?.org_name ?? current?.org_name
              : current?.org_name}
          </span>
        </span>
        {switchOrg.isPending
          ? <Loader2 size={13} className="text-gray-400 shrink-0 animate-spin" />
          : <ChevronsUpDown size={13} className="text-gray-400 shrink-0" />}
      </button>

      {switchOrg.isError && (
        <p className="text-[11px] text-red-500 mt-1 px-0.5">
          {switchOrg.error?.message || 'Could not switch workspace.'}
        </p>
      )}

      {open && !switchOrg.isPending && (
        <div
          role="listbox"
          className="absolute left-2 right-2 top-full mt-1 z-40
                     bg-white border border-gray-200 rounded-md shadow-lg
                     py-1 max-h-64 overflow-y-auto"
        >
          {orgs.map((org) => {
            const isCurrent = org.org_id === current?.org_id
            return (
              <button
                key={org.org_id}
                role="option"
                aria-selected={isCurrent}
                onClick={() => handlePick(org)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left
                           hover:bg-gray-50 transition-colors duration-120"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-gray-900 truncate">{org.org_name}</span>
                  <span className="block text-[10px] text-gray-400">{org.org_role}</span>
                </span>
                {isCurrent && <Check size={13} className="text-gray-900 shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default OrgSwitcher
