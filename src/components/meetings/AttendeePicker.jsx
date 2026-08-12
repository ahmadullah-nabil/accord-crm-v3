// ─── AttendeePicker ───────────────────────────────────────────────────────────
//
// Who receives the external calendar invitation.
//
// DELIBERATELY SEPARATE FROM `participants`. Being listed on a CRM meeting and
// being emailed a calendar invitation are different acts with different
// consequences — one is internal record-keeping, the other puts a message in a
// client's inbox from the organiser's own address. Merging the two fields would
// mean every colleague tracked on a meeting got mailed, and every client
// invited showed up in internal staffing lists.
//
// `source` records where an address came from ('contact' | 'internal' |
// 'external') so the list can show it and so a future audit can answer "who
// added this address".

import React, { useMemo, useState } from 'react'
import { Users, Plus, X, Search, Mail } from 'lucide-react'

import { useContacts } from '../../hooks/useContacts.js'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

const SOURCE_LABEL = {
  contact:  'CRM contact',
  internal: 'Team',
  external: 'Typed',
}

/**
 * @param {Array}    attendees  [{email,name,source}]
 * @param {Function} onChange   next array
 */
export function AttendeePicker({ attendees = [], onChange, disabled = false }) {
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')

  const { data: contacts = [] } = useContacts()

  const taken = useMemo(
    () => new Set(attendees.map((a) => a.email.toLowerCase())),
    [attendees],
  )

  // Only contacts that actually have an address are offerable. A contact with
  // no email cannot be invited, and showing them only to fail on click is worse
  // than not showing them.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return contacts
      .filter((c) => c.email && !taken.has(c.email.toLowerCase()))
      .filter((c) =>
        `${c.name ?? ''} ${c.email} ${c.company ?? ''}`.toLowerCase().includes(q),
      )
      .slice(0, 6)
  }, [contacts, query, taken])

  // Whether what has been typed can stand on its own as an invitation.
  const typedIsEmail = useMemo(() => {
    const q = query.trim().toLowerCase()
    return EMAIL_RE.test(q) && !taken.has(q)
  }, [query, taken])

  const add = (attendee) => {
    const email = attendee.email.trim().toLowerCase()
    if (!EMAIL_RE.test(email)) {
      setError('That does not look like an email address.')
      return
    }
    if (taken.has(email)) {
      setError('That address is already invited.')
      return
    }
    onChange([...attendees, { ...attendee, email }])
    setError('')
    setQuery('')
  }

  const remove = (email) =>
    onChange(attendees.filter((a) => a.email.toLowerCase() !== email.toLowerCase()))

  return (
    <div className="space-y-3">
      {/* ── One field, two jobs ─────────────────────────────────────────────
          A single input that searches CRM contacts AND accepts a typed
          address. Two separate boxes was the first design and it failed on
          contact: people type an address into the search field, get no match
          because it is not a CRM contact, and reasonably conclude they have
          added it. Nothing in the UI contradicted them until the invitation
          never arrived. */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          className="input-base pl-9"
          placeholder="Search contacts, or type an email address…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setError('') }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            // The picker sits inside the meeting form, so an unhandled Enter
            // would submit and save the meeting instead of adding the person.
            e.preventDefault()
            if (matches.length === 1) {
              const c = matches[0]
              add({ email: c.email, name: c.name || '', source: 'contact' })
            } else if (typedIsEmail) {
              add({ email: query, name: '', source: 'external' })
            }
          }}
          disabled={disabled}
        />

        {(matches.length > 0 || typedIsEmail) && (
          <ul className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-56 overflow-auto">
            {matches.map((c) => {
              const name = c.name || ''
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
                    onClick={() => add({ email: c.email, name, source: 'contact' })}
                  >
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm text-slate-900 truncate">{name || c.email}</span>
                      <span className="block text-xs text-slate-500 truncate">
                        {c.email}{c.company ? ` · ${c.company}` : ''}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}

            {/* Offered whenever what was typed is a usable address, even if a
                contact also matched — an attendee need not exist in the CRM. */}
            {typedIsEmail && (
              <li className={matches.length ? 'border-t border-slate-100' : ''}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-teal-50 flex items-center gap-2"
                  onClick={() => add({ email: query, name: '', source: 'external' })}
                >
                  <Plus className="w-4 h-4 text-teal-600 shrink-0" />
                  <span className="text-sm text-teal-700 truncate">
                    Invite {query.trim().toLowerCase()}
                  </span>
                </button>
              </li>
            )}
          </ul>
        )}
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      {/* ── The invitation list ─────────────────────────────────────────────
          Stated plainly, because "attendees" is ambiguous and the consequence
          is not: these addresses receive mail. */}
      {attendees.length > 0 ? (
        <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
          {attendees.map((a) => (
            <div key={a.email} className="flex items-center gap-2 px-3 py-2">
              <Users className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-slate-900 truncate">
                  {a.name || a.email}
                </span>
                {a.name && (
                  <span className="block text-xs text-slate-500 truncate">{a.email}</span>
                )}
              </span>
              <span className="text-[11px] uppercase tracking-wide text-slate-400 shrink-0">
                {SOURCE_LABEL[a.source] ?? 'Typed'}
              </span>
              <button
                type="button"
                className="p-1 rounded hover:bg-slate-100 shrink-0"
                onClick={() => remove(a.email)}
                disabled={disabled}
                aria-label={`Remove ${a.email}`}
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          No one will be invited. Attendees added here receive a calendar
          invitation by email — separate from the internal participants above.
        </p>
      )}
    </div>
  )
}

export default AttendeePicker
