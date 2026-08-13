// ─── DataTable ────────────────────────────────────────────────────────────────
//
// step035. The table every module will render. Built once here so density,
// borders, sort affordances, selection and the row menu cannot drift apart
// across six modules the way they had.
//
// ── PADDING IS NOT SET HERE, ON PURPOSE ──────────────────────────────────────
// src/index.css applies cell padding through the density tokens:
//
//   html[data-density] table th,
//   html[data-density] table td { padding: var(--table-cell-py) var(--table-cell-px) }
//
// That selector (0,1,2) out-specifies any utility class (0,1,0), so a `px-3`
// here would be silently overridden and would only mislead the next reader.
// The utilities below are a FALLBACK for the case where the attribute is
// missing — the pre-hydration script in index.html always sets it, but a table
// with zero padding is an ugly way to find out that script failed.
//
// ── WHAT THIS DOES NOT DO YET ────────────────────────────────────────────────
// • No inline editing. Read-only first: getting the column API wrong is cheap
//   to fix now and expensive once six modules depend on it.
// • No column reorder or show/hide. The trailing "+" renders ONLY when
//   onAddColumn is supplied — an affordance that does nothing is worse than no
//   affordance.
// • No row keyboard navigation.
//
// ── COLUMN SHAPE ─────────────────────────────────────────────────────────────
//   {
//     key:      'name',                 // also the sort key handed to onSort
//     label:    'Contact',
//     icon:     Users,                  // optional lucide icon, header only
//     sortable: true,
//     align:    'left' | 'right',       // 'right' for numerics
//     width:    '220px',                // optional fixed width
//     render:   (row) => <>…</>,        // optional; defaults to row[key]
//   }

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronUp, ChevronDown, ChevronsUpDown, MoreHorizontal, Plus,
} from 'lucide-react'
import { Skeleton }   from './Skeleton.jsx'
import { EmptyState } from './EmptyState.jsx'

export function DataTable({
  columns,
  rows,
  getRowId = (row) => row.id,
  isLoading = false,

  sort,                 // { field, dir } — controlled by the caller's store
  onSort,               // (key) => void

  onRowClick,           // (row) => void
  rowActions,           // (row) => [{ label, icon, onClick, danger }]

  selectable = false,
  onSelectionChange,    // (ids: string[]) => void

  onAddNew,             // renders the "Add new" row when provided
  onAddColumn,          // renders the trailing "+" when provided

  aggregates,           // [{ label, value }] — the footer strip
  empty = {},           // { icon, title, description }
  skeletonRows = 8,
}) {
  const [selected, setSelected] = useState(() => new Set())

  // Rows can be filtered out from under a selection. Dropping ids that are no
  // longer present stops a "3 selected" count from outliving its rows and a
  // bulk action from being handed ids the user can no longer see.
  const visibleIds = useMemo(() => rows.map(getRowId), [rows, getRowId])

  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev
      const next = new Set(visibleIds.filter((id) => prev.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [visibleIds])

  useEffect(() => {
    onSelectionChange?.([...selected])
    // onSelectionChange is intentionally not a dependency — callers commonly
    // pass an inline arrow, which would make this fire every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  const allSelected = rows.length > 0 && selected.size === rows.length

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(visibleIds))

  const toggleOne = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (isLoading) return <TableSkeleton columns={columns} rows={skeletonRows} selectable={selectable} />

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <EmptyState
          icon={empty.icon}
          title={empty.title || 'Nothing here yet'}
          description={empty.description || ''}
        />
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {selectable && (
                <th className="w-[36px] sticky top-0 bg-gray-50 border-r border-gray-100 px-2">
                  <Checkbox checked={allSelected} onChange={toggleAll} label="Select all rows" />
                </th>
              )}

              {columns.map((col) => {
                const active = sort?.field === col.key
                return (
                  <th
                    key={col.key}
                    style={col.width ? { width: col.width } : undefined}
                    onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
                    className={`
                      sticky top-0 bg-gray-50 px-3 py-1.5
                      text-left font-medium text-gray-500 whitespace-nowrap
                      border-r border-gray-100 last:border-r-0
                      ${col.align === 'right' ? 'text-right' : ''}
                      ${col.sortable && onSort ? 'cursor-pointer select-none hover:text-gray-900 group' : ''}
                    `}
                  >
                    <span className={`flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : ''}`}>
                      {col.icon && <col.icon size={13} className="text-gray-400 flex-shrink-0" />}
                      {col.label}
                      {col.sortable && onSort && (
                        active
                          ? sort.dir === 'asc'
                            ? <ChevronUp size={12} className="text-teal-600" />
                            : <ChevronDown size={12} className="text-teal-600" />
                          : <ChevronsUpDown size={11} className="text-gray-300 group-hover:text-gray-400" />
                      )}
                    </span>
                  </th>
                )
              })}

              {/* Row-action column. Headerless, but it still has to exist or the
                  header and body column counts disagree and every border below
                  it lands one cell to the left. */}
              {rowActions && <th className="w-[40px] sticky top-0 bg-gray-50" />}

              {onAddColumn && (
                <th className="w-[36px] sticky top-0 bg-gray-50 border-l border-gray-100">
                  <button
                    onClick={onAddColumn}
                    className="p-1 rounded text-gray-400 hover:text-gray-900 hover:bg-gray-200 transition-colors duration-120"
                    aria-label="Add column"
                  >
                    <Plus size={14} />
                  </button>
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const id = getRowId(row)
              const isSelected = selected.has(id)
              return (
                <tr
                  key={id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`
                    border-b border-gray-100 group
                    transition-colors duration-120
                    ${onRowClick ? 'cursor-pointer' : ''}
                    ${isSelected ? 'bg-teal-500/5' : 'hover:bg-gray-50'}
                  `}
                >
                  {selectable && (
                    <td
                      className="border-r border-gray-100 px-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={isSelected}
                        onChange={() => toggleOne(id)}
                        label="Select row"
                      />
                    </td>
                  )}

                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`
                        px-3 py-1.5 text-gray-700
                        border-r border-gray-100 last:border-r-0
                        ${col.align === 'right' ? 'text-right' : ''}
                      `}
                    >
                      {col.render ? col.render(row) : (row[col.key] ?? '—')}
                    </td>
                  ))}

                  {rowActions && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <RowActionsMenu actions={rowActions(row)} />
                    </td>
                  )}

                  {onAddColumn && <td className="border-l border-gray-100" />}
                </tr>
              )
            })}

            {onAddNew && (
              <tr
                onClick={onAddNew}
                className="cursor-pointer hover:bg-gray-50 transition-colors duration-120"
              >
                <td
                  colSpan={
                    columns.length +
                    (selectable ? 1 : 0) +
                    (rowActions ? 1 : 0) +
                    (onAddColumn ? 1 : 0)
                  }
                  className="px-3 py-1.5"
                >
                  <span className="flex items-center gap-1.5 text-gray-400">
                    <Plus size={14} />
                    Add new
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────
          Aggregates are computed by the caller, not here: only the caller
          knows which of its columns are money, which are counts, and which
          are meaningless to total. */}
      {aggregates?.length > 0 && (
        <div className="flex items-center gap-6 px-3 h-8 border-t border-gray-200 bg-gray-50">
          {aggregates.map((a) => (
            <span key={a.label} className="text-xs text-gray-500 whitespace-nowrap">
              {a.label} <span className="font-medium text-gray-900 tnum">{a.value}</span>
            </span>
          ))}
          {selected.size > 0 && (
            <span className="ml-auto text-xs text-teal-700 font-medium">
              {selected.size} selected
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Checkbox ──────────────────────────────────────────────────────────────────
// A native input, styled with accent-color rather than replaced by a div. It
// keeps keyboard behaviour, focus, and screen-reader semantics for free — all
// of which a custom span would have to reimplement and usually doesn't.
function Checkbox({ checked, onChange, label }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      className="w-3.5 h-3.5 rounded-sm border-gray-300 cursor-pointer align-middle accent-teal-600"
    />
  )
}

// ── Row actions ───────────────────────────────────────────────────────────────
function RowActionsMenu({ actions }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (!actions?.length) return null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`
          p-1 rounded text-gray-400 hover:text-gray-900 hover:bg-gray-200
          transition-colors duration-120
          ${open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}
        `}
        aria-label="Row actions"
      >
        <MoreHorizontal size={15} />
      </button>

      {open && (
        <div className="absolute right-0 top-7 z-20 min-w-[140px] py-1 bg-white border border-gray-200 rounded-lg shadow-card-lg animate-fade-in">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={() => { setOpen(false); a.onClick() }}
              className={`
                w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left
                transition-colors duration-120
                ${a.danger ? 'text-red-600 hover:bg-red-500/10' : 'text-gray-700 hover:bg-gray-100'}
              `}
            >
              {a.icon && <a.icon size={14} className={a.danger ? '' : 'text-gray-400'} />}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
// Mirrors the real column count so the layout does not jump when data lands.
function TableSkeleton({ columns, rows, selectable }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="h-8 bg-gray-50 border-b border-gray-200" />
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-3 px-3 h-[34px] border-b border-gray-100">
          {selectable && <Skeleton className="w-3.5 h-3.5 flex-shrink-0" />}
          {columns.map((c, i) => (
            <Skeleton key={c.key} className={`h-3 ${i === 0 ? 'w-40' : 'w-20'}`} />
          ))}
        </div>
      ))}
    </div>
  )
}

export default DataTable
