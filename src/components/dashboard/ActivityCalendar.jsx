// ─── ActivityCalendar ─────────────────────────────────────────────────────────
//
// The Dashboard's monthly grid: meetings and tasks together, as work schedule
// AND activity history.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ COMPLETED ITEMS STAY VISIBLE                                            │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ Most calendars hide finished work. This one must not: half its purpose  │
// │ is answering "what did we do this month", and a month that empties as   │
// │ it is worked through answers that with a blank page. Completed items    │
// │ are dimmed and struck through — present, but visibly done.               │
// └─────────────────────────────────────────────────────────────────────────┘
//
// TWO KINDS OF ITEM, RENDERED DIFFERENTLY ON PURPOSE
//   • Tasks are ALL-DAY — a due date carries no time, and inventing one would
//     make a task look scheduled against a real meeting at that hour. They sit
//     in a strip at the top of the day, the way Google and Outlook do it.
//   • Meetings are timed and sort below by start time.

import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  Clock, AlertTriangle, Check, X as XIcon, Phone, Flag, Repeat, Plus,
} from 'lucide-react'

import { useCalendarActivities } from '../../hooks/useCalendarActivities.js'
import { useMeetingsStore }      from '../../stores/meetingsStore.js'
import { useTasksStore }         from '../../stores/tasksStore.js'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// Colour carries meaning, so it is defined once and used by the chips, the
// legend and the day panel alike.
const STATUS_STYLE = {
  pending:   { chip: 'bg-teal-50 text-teal-800 border-teal-200',      dot: 'bg-teal-500'   },
  completed: { chip: 'bg-slate-50 text-slate-500 border-slate-200',   dot: 'bg-slate-400'  },
  overdue:   { chip: 'bg-rose-50 text-rose-800 border-rose-200',      dot: 'bg-rose-500'   },
  cancelled: { chip: 'bg-slate-50 text-slate-400 border-slate-200',   dot: 'bg-slate-300'  },
}

const TYPE_ICON = {
  Meeting:     CalendarIcon,
  'Follow-up': Repeat,
  Call:        Phone,
  Deadline:    Flag,
  Task:        Check,
}

const STATUS_ICON = {
  overdue:   AlertTriangle,
  cancelled: XIcon,
}

/** Local YYYY-MM-DD. toISOString() would convert to UTC and shift the date by a
 *  day for anyone east of Greenwich — in Dhaka every evening item would land on
 *  the day before. */
function localISODate(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 === 0 ? 12 : h % 12
  return m ? `${hour}:${String(m).padStart(2, '0')}${period}` : `${hour}${period}`
}

/** The 42 cells of a month grid: leading days from the previous month, the
 *  month itself, trailing days from the next. Six rows always, so the grid does
 *  not change height between months and the page stops jumping. */
function buildGrid(year, monthIndex) {
  const first = new Date(year, monthIndex, 1)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return {
      date:      localISODate(d),
      dayNumber: d.getDate(),
      inMonth:   d.getMonth() === monthIndex,
    }
  })
}

function ItemChip({ item, onClick, compact = false }) {
  const style = STATUS_STYLE[item.status] ?? STATUS_STYLE.pending
  const TypeIcon = TYPE_ICON[item.type] ?? CalendarIcon
  const StatusIcon = STATUS_ICON[item.status]
  const done = item.status === 'completed' || item.status === 'cancelled'

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(item) }}
      title={`${item.type} · ${item.title}${item.time ? ` · ${fmtTime(item.time)}` : ''}`}
      className={`w-full text-left border rounded px-1.5 py-0.5 flex items-center gap-1
                  hover:brightness-95 transition ${style.chip}
                  ${compact ? 'text-[10px]' : 'text-xs'}`}
    >
      {StatusIcon
        ? <StatusIcon className="w-3 h-3 shrink-0" />
        : <TypeIcon className="w-3 h-3 shrink-0" />}
      {item.time && !item.allDay && (
        <span className="tabular-nums shrink-0 opacity-70">{fmtTime(item.time)}</span>
      )}
      <span className={`truncate ${done ? 'line-through opacity-70' : ''}`}>
        {item.title}
      </span>
    </button>
  )
}

export function ActivityCalendar({ filters = {} }) {
  const navigate = useNavigate()
  const openMeeting  = useMeetingsStore((s) => s.openDetail)
  const openTask     = useTasksStore((s) => s.openDetail)
  const newMeetingOn = useMeetingsStore((s) => s.openAddModalWithPrefill)
  const newTaskOn    = useTasksStore((s) => s.openAddModalWithPrefill)

  const today = localISODate(new Date())

  // Month is component state rather than a query param so navigating away and
  // back within the Dashboard keeps your place.
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [selectedDate, setSelectedDate] = useState(null)
  // Which date's create menu is open. Null when none.
  const [createFor, setCreateFor] = useState(null)

  const { byDate, counts, isLoading, isError, error } =
    useCalendarActivities(cursor.year, cursor.month, filters)

  const grid = useMemo(() => buildGrid(cursor.year, cursor.month), [cursor])

  const step = (delta) => {
    setSelectedDate(null)
    setCursor(({ year, month }) => {
      const d = new Date(year, month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  const goToday = () => {
    const now = new Date()
    setCursor({ year: now.getFullYear(), month: now.getMonth() })
    setSelectedDate(today)
  }

  // Clicking an item opens the EXISTING detail panel on its own page rather
  // than mounting a second copy here. The stores drive those panels, so setting
  // the store and navigating reuses everything already built.
  const openItem = (item) => {
    const rawId = item.id.split(':')[1]
    if (item.source === 'meeting') { openMeeting(rawId); navigate('/meetings') }
    else                           { openTask(rawId);    navigate('/tasks') }
  }

  // Google and Outlook both create on a date click. Here the date is ambiguous
  // between two entities, so it offers the choice rather than guessing — and
  // prefills the date either way, which is the part that actually saves typing.
  const createMeetingOn = (date) => {
    newMeetingOn({ scheduledDate: date })
    setCreateFor(null)
  }
  const createTaskOn = (date) => {
    newTaskOn({ dueDate: date })
    setCreateFor(null)
  }

  const selectedItems = selectedDate ? (byDate[selectedDate] ?? []) : []

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => step(-1)}
            className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="Previous month">
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <h2 className="font-display font-semibold text-gray-900 text-base min-w-[150px] text-center
                         select-none">
            {MONTH_NAMES[cursor.month]} {cursor.year}
          </h2>
          <button type="button" onClick={() => step(1)}
            className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="Next month">
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
          <button type="button" onClick={goToday}
            className="ml-2 text-xs px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50">
            Today
          </button>
        </div>

        {/* Counts are for the WHOLE month, before filters — so the numbers do
            not shift as the user narrows the view and stop being a reference. */}
        <div className="flex items-center gap-1.5">
          {['pending', 'completed', 'overdue', 'cancelled'].map((k) => (
            <span key={k}
              className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full
                         border border-slate-200 bg-white text-slate-600">
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_STYLE[k].dot}`} />
              {k.charAt(0).toUpperCase() + k.slice(1)}
              <span className="tabular-nums font-medium text-slate-900">{counts[k] ?? 0}</span>
            </span>
          ))}
        </div>
      </div>

      {isError && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-800">
          Could not load the calendar. {error?.message}
        </div>
      )}

      {/* ── Grid ───────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {WEEKDAYS.map((d) => (
            <div key={d}
              className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide
                         text-slate-400 text-center">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {grid.map((cell) => {
            const items    = byDate[cell.date] ?? []
            const allDay   = items.filter((i) => i.allDay)
            const timed    = items.filter((i) => !i.allDay)
            const isToday  = cell.date === today
            const isPicked = cell.date === selectedDate
            // Three fit; a fourth would push the row taller than its
            // neighbours and make the grid ragged.
            const shown    = [...allDay, ...timed].slice(0, 3)
            const overflow = items.length - shown.length

            return (
              <button
                type="button"
                key={cell.date}
                onClick={() => setSelectedDate(isPicked ? null : cell.date)}
                className={`group relative min-h-[92px] border-b border-r border-slate-100
                            p-1.5 text-left align-top transition
                            ${cell.inMonth ? 'bg-white' : 'bg-slate-50/50'}
                            ${isPicked ? 'ring-2 ring-inset ring-teal-400' : 'hover:bg-teal-50/40'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs tabular-nums
                    ${isToday
                      ? 'w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center font-semibold'
                      : cell.inMonth ? 'text-slate-700' : 'text-slate-400'}`}>
                    {cell.dayNumber}
                  </span>

                  {/* Appears on hover, the way Google and Outlook do it — always
                      visible would put 42 plus signs on screen and turn a
                      calendar into a toolbar. */}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setCreateFor(cell.date) }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault(); e.stopPropagation(); setCreateFor(cell.date)
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition
                               p-0.5 rounded hover:bg-teal-100 cursor-pointer"
                    aria-label={`Add on ${cell.date}`}
                  >
                    <Plus className="w-3.5 h-3.5 text-teal-700" />
                  </span>
                </div>

                {/* Two entities can live on a date, so the choice is explicit.
                    Guessing "meeting" would be wrong for every deadline. */}
                {createFor === cell.date && (
                  <div
                    className="absolute z-30 top-7 right-1 w-40 rounded-lg border border-slate-200
                               bg-white shadow-lg py-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span role="button" tabIndex={0}
                      onClick={() => createMeetingOn(cell.date)}
                      onKeyDown={(e) => e.key === 'Enter' && createMeetingOn(cell.date)}
                      className="w-full px-3 py-1.5 text-xs text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer">
                      <CalendarIcon className="w-3.5 h-3.5 text-slate-400" /> New meeting
                    </span>
                    <span role="button" tabIndex={0}
                      onClick={() => createTaskOn(cell.date)}
                      onKeyDown={(e) => e.key === 'Enter' && createTaskOn(cell.date)}
                      className="w-full px-3 py-1.5 text-xs text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer">
                      <Check className="w-3.5 h-3.5 text-slate-400" /> New task
                    </span>
                    <span role="button" tabIndex={0}
                      onClick={() => setCreateFor(null)}
                      onKeyDown={(e) => e.key === 'Enter' && setCreateFor(null)}
                      className="w-full px-3 py-1.5 text-xs text-left text-slate-400 hover:bg-slate-50 cursor-pointer block">
                      Cancel
                    </span>
                  </div>
                )}

                <div className="space-y-0.5">
                  {shown.map((item) => (
                    <ItemChip key={item.id} item={item} onClick={openItem} compact />
                  ))}
                  {overflow > 0 && (
                    <span className="block text-[10px] text-slate-500 pl-1">
                      +{overflow} more
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {isLoading && <p className="text-xs text-slate-500">Loading activities…</p>}

      {/* ── Day detail ─────────────────────────────────────────────────────── */}
      {selectedDate && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}
            </h3>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => createMeetingOn(selectedDate)}
                className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50
                           inline-flex items-center gap-1.5">
                <Plus className="w-3 h-3" /> Meeting
              </button>
              <button type="button" onClick={() => createTaskOn(selectedDate)}
                className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50
                           inline-flex items-center gap-1.5">
                <Plus className="w-3 h-3" /> Task
              </button>
              <button type="button" onClick={() => setSelectedDate(null)}
                className="p-1 rounded hover:bg-slate-100" aria-label="Close day view">
                <XIcon className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          {selectedItems.length === 0 ? (
            <p className="text-xs text-slate-500">
              Nothing scheduled. Add a meeting or task above.
            </p>
          ) : (
            <div className="space-y-3">
              {/* All-day first, and labelled — otherwise a task with no time
                  looks like a meeting whose time failed to load. */}
              {selectedItems.some((i) => i.allDay) && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-1.5">
                    All day
                  </p>
                  <div className="space-y-1">
                    {selectedItems.filter((i) => i.allDay).map((item) => (
                      <ItemChip key={item.id} item={item} onClick={openItem} />
                    ))}
                  </div>
                </div>
              )}

              {selectedItems.some((i) => !i.allDay) && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-1.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Scheduled
                  </p>
                  <div className="space-y-1">
                    {selectedItems.filter((i) => !i.allDay).map((item) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <ItemChip item={item} onClick={openItem} />
                        {/* A meeting whose invitations never went out must say
                            so here — silence reads as success. */}
                        {item.syncStatus === 'failed' && (
                          <span className="text-[10px] text-rose-600 shrink-0">
                            invite failed
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ActivityCalendar
