// ─── LeadOverview ─────────────────────────────────────────────────────────────
//
// Lead counts by stage, under the calendar on the Today tab.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ WHY THIS IS NOT A SECOND LEADS PAGE                                     │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ Every stage is a link, not a view. Clicking one sets the EXISTING       │
// │ leadsStore filters and navigates to /leads — the same hand-off          │
// │ ActivityCalendar.openItem already makes to the meeting and task panels. │
// │ No table, no kanban, no drag-drop, no second place where a lead can be  │
// │ edited. This widget answers "how many and where" and then gets out of   │
// │ the way.                                                                 │
// │                                                                          │
// │ No chart either. Seven numbers are seven numbers; a donut of them is    │
// │ the same information, larger, and harder to read a count off.            │
// └─────────────────────────────────────────────────────────────────────────┘
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ WHY THE CLICK CLEARS THE OTHER LEAD FILTERS FIRST                       │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ leadsStore holds priority / source / search from the last time anyone   │
// │ was on the Leads page, and it is a module-level store, so those survive │
// │ navigation. Clicking "Qualified 12" while a stale priority=High is set  │
// │ would land on a page showing four rows under a number that said twelve. │
// │                                                                          │
// │ So the click calls clearFilters() and then sets stage (and assignee, if │
// │ a user is selected). The rule: the number you clicked is the number of  │
// │ rows you get. Losing someone's half-typed search is the cheaper of the  │
// │ two failures, and this is the only surface that can make that promise.  │
// └─────────────────────────────────────────────────────────────────────────┘
//
// Counts are unfiltered totals for the selected user — there is no equivalent
// of the calendar's "Showing n of m" split here, because unlike the calendar
// the chips and the total are computed from the same scope and always reconcile.

import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Target, Search, RefreshCw, ArrowRight } from 'lucide-react'

import { useLeadsStore, STAGES, STAGE_COLORS } from '../../stores/leadsStore.js'
import { useLeadStageCounts } from '../../hooks/useLeadStageCounts.js'
import { useAssignableMembers } from '../../hooks/useTeam.js'
import { FilterPopover } from './CalendarFilterBar.jsx'

export function LeadOverview({ owner = 'all', onSetOwner = () => {} }) {
  const navigate = useNavigate()
  const [ownerQuery, setOwnerQuery] = useState('')

  // Individual selectors, not the whole store: subscribing to the object would
  // re-render this widget on every optimistic lead mutation elsewhere.
  const setStageFilter    = useLeadsStore((s) => s.setStageFilter)
  const setAssigneeFilter = useLeadsStore((s) => s.setAssigneeFilter)
  const clearFilters      = useLeadsStore((s) => s.clearFilters)

  const {
    byStage, other, total, grandTotal, owners,
    isLoading, isError, error, refetch, isFetching,
  } = useLeadStageCounts(owner === 'all' ? '' : owner)

  const { names: rosterNames } = useAssignableMembers()

  // Options come from the same roster the Leads toolbar uses, so anything
  // selectable here is representable there — a name this widget could offer but
  // that dropdown could not show would strand the user on a filtered page with
  // a filter they cannot see or clear.
  //
  // Assignees holding leads but absent from the roster (someone who has left)
  // are appended rather than dropped: their leads exist and have to be findable.
  const ownerOptions = useMemo(() => {
    const roster = [...new Set(rosterNames.filter(Boolean))]
    const offRoster = owners.filter((o) => !roster.includes(o))
    return [
      ...roster.map((n) => ({ name: n, note: '' })),
      ...offRoster.map((n) => ({ name: n, note: 'not on the team list' })),
    ]
  }, [rosterNames, owners])

  const visibleOptions = useMemo(() => {
    const q = ownerQuery.trim().toLowerCase()
    return q ? ownerOptions.filter((o) => o.name.toLowerCase().includes(q)) : ownerOptions
  }, [ownerOptions, ownerQuery])

  // Selected, but on neither list — a hand-edited URL, or a roster that has not
  // loaded yet. Kept and labelled for the same reason the calendar keeps a user
  // with nothing this month: silently dropping it makes the filter look cleared
  // while it is still narrowing what you see.
  const selectedMissing =
    owner !== 'all' && !ownerOptions.some((o) => o.name === owner)

  const go = (stage) => {
    clearFilters()
    if (stage) setStageFilter(stage)
    if (owner !== 'all') setAssigneeFilter(owner)
    navigate('/leads')
  }

  return (
    <div className="card p-4">
      {/* ── Header ──────────────────────────────────────────────────────────
          Stacks below sm. `flex-wrap` alone dropped the controls onto a second
          line but left them bunched at the left under a truncated subtitle;
          stacking deliberately and spreading them full-width reads as a layout
          rather than as an overflow. */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center
                          ring-1 ring-blue-200 shrink-0">
            <Target size={15} className="text-blue-600" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900 leading-tight">Lead pipeline</h2>
            <p className="text-[11px] text-gray-500 truncate">
              {owner === 'all' ? 'Everyone' : owner} · click a stage to open it in Leads
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
          <FilterPopover
            label="User"
            summary={owner === 'all' ? '' : owner}
            active={owner !== 'all'}
            widthClass="w-60"
          >
            <div className="px-2 pt-1 pb-2">
              <div className="relative">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
                <input
                  type="text"
                  autoFocus
                  value={ownerQuery}
                  onChange={(e) => setOwnerQuery(e.target.value)}
                  placeholder="Search people…"
                  className="input-base pl-7 pr-2 py-1.5 text-xs rounded-lg"
                />
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto">
              <button
                type="button"
                onClick={() => { onSetOwner('all'); setOwnerQuery('') }}
                className={`w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50
                            ${owner === 'all' ? 'text-teal-700 font-medium' : 'text-gray-700'}`}
              >
                Everyone
              </button>

              {selectedMissing && (
                <button
                  type="button"
                  onClick={() => { onSetOwner('all'); setOwnerQuery('') }}
                  className="w-full px-3 py-1.5 text-xs text-left text-teal-700 font-medium
                             hover:bg-gray-50 flex items-center justify-between gap-2"
                >
                  <span className="truncate">{owner}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">unknown user</span>
                </button>
              )}

              {visibleOptions.map((o) => (
                <button
                  key={o.name}
                  type="button"
                  onClick={() => { onSetOwner(o.name); setOwnerQuery('') }}
                  className={`w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50
                              flex items-center justify-between gap-2
                              ${owner === o.name ? 'text-teal-700 font-medium' : 'text-gray-700'}`}
                >
                  <span className="truncate">{o.name}</span>
                  {o.note && (
                    <span className="text-[10px] text-gray-400 shrink-0">{o.note}</span>
                  )}
                </button>
              ))}

              {visibleOptions.length === 0 && (
                <p className="px-3 py-2 text-[11px] text-gray-400">No match.</p>
              )}
            </div>
          </FilterPopover>

          {/* Total, and a way through to the unfiltered list. Clickable for the
              same reason the stages are: the number is the question, /leads is
              the answer. */}
          <button
            type="button"
            onClick={() => go(null)}
            className="inline-flex items-baseline gap-1.5 text-xs text-gray-600
                       hover:text-teal-700 font-medium group"
          >
            <span className="text-base font-bold text-gray-900 tabular-nums leading-none">
              {isLoading ? '—' : total}
            </span>
            <span>{owner === 'all' ? 'total' : `of ${grandTotal}`}</span>
            <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {isError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200
                        bg-red-50 px-3 py-2.5">
          <p className="text-xs text-red-700 min-w-0">
            Could not load lead counts.
            {error?.message ? ` ${error.message}` : ''}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="btn-secondary text-xs gap-1.5 shrink-0"
          >
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
            Retry
          </button>
        </div>
      )}

      {/* ── Stage counts ──────────────────────────────────────────────────── */}
      {!isError && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {STAGES.map((stage) => {
            const count = byStage[stage] ?? 0
            const dot   = STAGE_COLORS[stage]?.bg ?? 'bg-gray-400'
            return (
              <button
                key={stage}
                type="button"
                onClick={() => go(stage)}
                title={`Open ${stage} leads${owner === 'all' ? '' : ` for ${owner}`}`}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left
                           transition-all duration-150 hover:border-teal-300 hover:bg-teal-50/40
                           focus:outline-none focus:ring-2 focus:ring-teal-200"
              >
                <span className="flex items-center gap-1.5 mb-1">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
                  <span className="text-[11px] text-gray-500 truncate">{stage}</span>
                </span>
                <span className={`block text-lg font-bold tabular-nums leading-none
                                  ${count === 0 ? 'text-gray-300' : 'text-gray-900'}`}>
                  {isLoading ? '—' : count}
                </span>
              </button>
            )
          })}

          {/* Stages outside STAGES. Almost always zero — but shown when it is
              not, so the chips always sum to the total. A silent gap between
              "380 total" and seven chips adding to 376 is unexplainable from
              the UI, and this is a two-line fix for it.

              Not clickable: the bucket can hold several different unknown
              values, so there is no single stage filter that would reproduce it. */}
          {other > 0 && (
            <div
              className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-2.5"
              title="Leads with a stage that is not one of the seven above — likely imported or legacy rows"
            >
              <span className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-gray-400" />
                <span className="text-[11px] text-gray-500 truncate">Other</span>
              </span>
              <span className="block text-lg font-bold tabular-nums leading-none text-gray-500">
                {other}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Nothing at all — distinct from "this user has nothing", because the
          fix is different: one needs leads created, the other needs the filter
          cleared. Same reasoning as the calendar's two empty states. */}
      {!isLoading && !isError && total === 0 && (
        <p className="text-[11px] text-gray-400 mt-2.5">
          {owner === 'all'
            ? 'No leads yet.'
            : (
              <>
                Nothing assigned to {owner}
                {grandTotal > 0 && ` — ${grandTotal} leads are assigned elsewhere.`}{' '}
                <button
                  type="button"
                  onClick={() => onSetOwner('all')}
                  className="text-teal-600 hover:text-teal-700 font-medium underline"
                >
                  Show everyone
                </button>
              </>
            )}
        </p>
      )}
    </div>
  )
}

export default LeadOverview
