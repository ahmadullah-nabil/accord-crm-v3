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
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ step049 — TWO COLUMNS: AGENDA LEFT, MONTH RIGHT                         │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ The month grid used to be the whole width, with the day detail appearing│
// │ BELOW it when a date was picked — which pushed Lead Overview down the   │
// │ page every time you clicked a date, and put the thing you had just      │
// │ asked to see below the fold.                                            │
// │                                                                          │
// │ Now the agenda is a permanent left rail and the grid sits beside it. It │
// │ answers "what is on" without a click, and picking a date changes the    │
// │ rail's contents rather than the page's height. Nothing moves.           │
// │                                                                          │
// │ THIS ALSO MERGED TWO COMPONENTS INTO ONE. There was an AgendaList for   │
// │ phones and a separate day-detail block for desktop, rendering the same  │
// │ data from the same `byDate` in two different layouts that had to be     │
// │ kept in agreement by hand. One rail now serves both: full width below   │
// │ `sm`, a column above it.                                                │
// └─────────────────────────────────────────────────────────────────────────┘
//
// EVERY COLOUR HERE WAS `slate-*`, WHICH IS NOT THEMED
// ────────────────────────────────────────────────────
// tailwind.config maps only `gray` (neutral ramp) and `teal` (accent ramp) to
// the CSS custom properties. `slate-*` resolves to Tailwind's own fixed
// palette, so 49 of them in this file ignored dark mode entirely and ignored
// the user's accent choice — the calendar stayed light on a dark theme. All of
// them are `gray-*` now, which is the same neutral in light mode and inverts
// correctly in dark. Semantic colours (rose for errors, emerald for done) stay
// fixed, matching how badges work everywhere else in the app.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ step051 — DENSITY. THE CALENDAR WAS EATING THE FOLD                     │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ step049 grew the cells to fit four chips. Six rows of those plus three  │
// │ stacked bars of chrome above them came to roughly 790px, so the month   │
// │ filled a 1080p viewport on its own and Lead Overview never appeared     │
// │ without scrolling. The dashboard is supposed to answer "what is         │
// │ happening" at a glance, and a glance does not include a scroll.         │
// │                                                                          │
// │ Nothing here is a new idea — it is the density the rest of the app      │
// │ already runs at. DataTable rows, ViewHeader controls and FacetChips     │
// │ were all tuned across step041–048; the calendar was written before      │
// │ those and never came along. Three changes carry it:                     │
// │                                                                          │
// │   • CHIPS ARE FLAT. A bordered, filled, rounded box per item is a lot   │
// │     of furniture for one line of text, and forty of them read as a      │
// │     patchwork rather than a schedule. An item is now a status dot, an   │
// │     optional time and a title on a hover row — the shape a table row    │
// │     already has in this app. Status still reads at a glance because the │
// │     dot carries the same colour the chip background used to.            │
// │   • CELLS ARE SHORTER and hold three items instead of four. The fourth  │
// │     was bought with 36px of height on every one of the 42 cells.        │
// │   • THE COUNT ROW LOST ITS PILLS. Four bordered capsules for four       │
// │     numbers; the numbers are the content, the capsules were not.        │
// │                                                                          │
// │ Type sizes, the six-row grid and every behaviour are unchanged. This is │
// │ spacing and weight only — no data, no handler and no state was touched. │
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
  Clock, Check, Plus,
} from 'lucide-react'

import { useCalendarActivities } from '../../hooks/useCalendarActivities.js'
import { useMeetingsStore }      from '../../stores/meetingsStore.js'
import { useTasksStore }         from '../../stores/tasksStore.js'
import { CalendarFilterBar }     from './CalendarFilterBar.jsx'
// Colour and icons moved to lib/ when the filter bar arrived — the grid, the
// legend and the filters all have to agree, so they read from one definition.
// step051: STATUS_ICON and TYPE_ICON are no longer read here. The flat chip
// carries status in its dot, and type is already legible without a glyph —
// tasks are all-day and meetings are timed, so a leading time IS the type.
// Both are still exported and still used by CalendarFilterBar.
import { STATUS_STYLE } from '../../lib/calendarStyles.js'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

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
  const done  = item.status === 'completed' || item.status === 'cancelled'

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(item) }}
      title={`${item.type} \u00b7 ${item.title}${item.time ? ` \u00b7 ${fmtTime(item.time)}` : ''}`}
      className={`w-full text-left rounded flex items-center gap-1.5 min-w-0
                  hover:bg-gray-100 transition
                  ${compact ? 'px-1 py-[2px]' : 'px-1.5 py-1'}`}
    >
      <span className={`rounded-full shrink-0 ${style.dot}
                        ${done ? 'opacity-40' : ''}
                        ${compact ? 'w-1.5 h-1.5' : 'w-2 h-2'}`} />
      {item.time && !item.allDay && (
        <span className={`tabular-nums shrink-0 text-gray-400
                          ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
          {fmtTime(item.time)}
        </span>
      )}
      <span className={`truncate ${compact ? 'text-[11px]' : 'text-xs'}
        ${done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
        {item.title}
      </span>
    </button>
  )
}

/** One day's create menu. Extracted because the grid opens it on hover and the
 *  agenda opens it from an always-visible button — same menu, two triggers. */
function CreateMenu({ date, onMeeting, onTask, onCancel, className = '' }) {
  return (
    <div
      className={`absolute z-30 w-40 rounded-lg border border-gray-200 bg-white shadow-lg py-1 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <span role="button" tabIndex={0}
        onClick={() => onMeeting(date)}
        onKeyDown={(e) => e.key === 'Enter' && onMeeting(date)}
        className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 flex items-center gap-2 cursor-pointer">
        <CalendarIcon className="w-3.5 h-3.5 text-gray-400" /> New meeting
      </span>
      <span role="button" tabIndex={0}
        onClick={() => onTask(date)}
        onKeyDown={(e) => e.key === 'Enter' && onTask(date)}
        className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 flex items-center gap-2 cursor-pointer">
        <Check className="w-3.5 h-3.5 text-gray-400" /> New task
      </span>
      <span role="button" tabIndex={0}
        onClick={onCancel}
        onKeyDown={(e) => e.key === 'Enter' && onCancel()}
        className="w-full px-3 py-1.5 text-xs text-left text-gray-400 hover:bg-gray-50 cursor-pointer block">
        Cancel
      </span>
    </div>
  )
}

// ─── AgendaRail — the left column, and the whole view on a phone ────────────
//
// step049. Was AgendaList, rendered only below `sm`. It is now visible at every
// width: the left rail on desktop, the entire calendar view on a phone.
//
// Seven columns on a 390px screen is ~50px per cell — no chip is legible at
// that width, so below `sm` the grid is still replaced outright. What changed
// is that the same list is no longer thrown away on desktop, where it answers
// "what is on this month" without clicking anything.
//
// This is the SAME DATA through the same hooks: `byDate` already exists for the
// grid, so the rail and the grid cannot disagree about what is on a date.
//
// TWO MODES. With no date selected it lists every day that HAS something, in
// order. With a date selected it shows just that day — which is what the old
// desktop-only day-detail block did, in a place that does not push the rest of
// the page down.
//
// Days with nothing are not listed and therefore have no create button; the
// footer covers those, prefilled with a date inside the month being viewed.
function AgendaRail({
  dates, byDate, today, onOpen,
  createFor, setCreateFor, onCreateMeeting, onCreateTask, defaultDate,
  selectedDate, onClearSelected,
}) {
  const shownDates = selectedDate ? [selectedDate] : dates

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-gray-100">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 truncate">
          {selectedDate
            ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
                weekday: 'long', day: 'numeric', month: 'long',
              })
            : 'Agenda'}
        </span>
        {selectedDate
          ? (
            <button type="button" onClick={onClearSelected}
              className="text-[11px] text-teal-700 hover:text-teal-800 font-medium">
              Show month
            </button>
          )
          : (
            <span className="text-[11px] text-gray-400 tabular-nums">
              {dates.length} day{dates.length === 1 ? '' : 's'}
            </span>
          )}
      </div>

      {/* Capped so a busy month scrolls the rail instead of stretching the page
          taller than the grid beside it. step051: the cap now tracks the grid's
          new height, MINUS the rail's own header and footer, so on a busy month
          the two columns end on the same line instead of the rail running past
          the grid. Six rows of cells plus the weekday strip is ~481px; the
          header and the create footer take ~66 of that. */}
      <div className="divide-y divide-gray-100 max-h-[416px] overflow-y-auto">
      {shownDates.length === 0 && (
        <p className="px-3 py-5 text-xs text-gray-400 text-center">
          {selectedDate ? 'Nothing scheduled this day.' : 'Nothing scheduled this month.'}
        </p>
      )}
      {shownDates.map((date) => {
        const items   = byDate[date] ?? []
        const allDay  = items.filter((i) => i.allDay)
        const timed   = items.filter((i) => !i.allDay)
        const d       = new Date(`${date}T00:00:00`)
        const isToday = date === today

        return (
          <div key={date} className="relative px-3 py-2 group/day">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-baseline gap-1.5 min-w-0">
                <span className={`text-xs font-semibold tabular-nums
                  ${isToday ? 'text-teal-700' : 'text-gray-900'}`}>
                  {d.getDate()}
                </span>
                <span className={`text-[10px] uppercase tracking-wide
                  ${isToday ? 'text-teal-700' : 'text-gray-400'}`}>
                  {d.toLocaleDateString(undefined, { weekday: 'short' })}
                </span>
              </div>

              {/* step051: the create button was a permanent teal plus on every
                  listed day. On a busy month that is a column of them down the
                  rail, which reads as the primary action when it is not. It now
                  behaves like the one in the grid — visible on hover, and on
                  focus so it stays reachable from the keyboard. */}
              <button
                type="button"
                onClick={() => setCreateFor(createFor === date ? null : date)}
                className="p-0.5 rounded shrink-0 text-gray-400 hover:bg-gray-100 hover:text-teal-700
                           opacity-0 group-hover/day:opacity-100 focus:opacity-100 transition"
                aria-label={`Add on ${date}`}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {createFor === date && (
              <CreateMenu
                date={date}
                onMeeting={onCreateMeeting}
                onTask={onCreateTask}
                onCancel={() => setCreateFor(null)}
                className="top-8 right-2"
              />
            )}

            {/* All-day first and labelled, for the same reason as the day
                detail: a task with no time otherwise reads as a meeting whose
                time failed to load. */}
            <div className="space-y-1.5">
              {allDay.length > 0 && (
                <div className="space-y-px">
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">All day</p>
                  {allDay.map((item) => (
                    <ItemChip key={item.id} item={item} onClick={onOpen} />
                  ))}
                </div>
              )}

              {timed.length > 0 && (
                <div className="space-y-px">
                  {allDay.length > 0 && (
                    <p className="text-[10px] uppercase tracking-wide text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Scheduled
                    </p>
                  )}
                  {timed.map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <ItemChip item={item} onClick={onOpen} />
                      {item.syncStatus === 'failed' && (
                        <span className="text-[10px] text-rose-600 shrink-0">invite failed</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}

      </div>

      {/* The grid can create on any date because every date is on screen. The
          agenda only lists days that have something, so an empty Thursday is
          unreachable — this is the way to it. The date is prefilled to a day
          inside the month being viewed, and is editable in the modal. */}
      <div className="px-2 py-2 flex items-center gap-1.5 border-t border-gray-100">
        <button type="button" onClick={() => onCreateMeeting(defaultDate)}
          className="flex-1 text-[11px] px-2 py-1.5 rounded-lg border border-gray-200 text-gray-600
                     hover:bg-gray-50 hover:text-gray-900 inline-flex items-center justify-center gap-1">
          <Plus className="w-3 h-3" /> Meeting
        </button>
        <button type="button" onClick={() => onCreateTask(defaultDate)}
          className="flex-1 text-[11px] px-2 py-1.5 rounded-lg border border-gray-200 text-gray-600
                     hover:bg-gray-50 hover:text-gray-900 inline-flex items-center justify-center gap-1">
          <Plus className="w-3 h-3" /> Task
        </button>
      </div>
    </div>
  )
}

/**
 * @param {object}   props
 * @param {object}   props.filters         { types, statuses, owner } — owned by
 *                                         the page, held in the URL.
 * @param {number}   props.activeFilterCount
 * @param {Function} props.onToggleType
 * @param {Function} props.onToggleStatus
 * @param {Function} props.onSetOwner
 * @param {Function} props.onClearFilters
 *
 * The filter BAR renders inside this component even though the filter STATE
 * lives above it. The user options are "people with items in the month you are
 * looking at", and the month cursor is deliberately local state here (so
 * opening a task and coming back keeps your place). Lifting the cursor to the
 * page to move the bar out would trade a documented behaviour for a cosmetic
 * one; passing the state down instead costs four props.
 */
export function ActivityCalendar({
  filters = {},
  activeFilterCount = 0,
  onToggleType,
  onToggleStatus,
  onSetOwner,
  onClearFilters,
}) {
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

  const { all, items, byDate, owners, counts, isLoading, isError, error } =
    useCalendarActivities(cursor.year, cursor.month, filters)

  const grid = useMemo(() => buildGrid(cursor.year, cursor.month), [cursor])

  // Days that actually hold something, in order — the agenda's whole shape.
  // Derived from the SAME `byDate` the grid reads, so the two views can never
  // disagree about what is on a date.
  const agendaDates = useMemo(() => Object.keys(byDate).sort(), [byDate])

  // Prefill for the agenda's footer create buttons. Today when today is in the
  // month you are looking at, otherwise the 1st of that month — offering to
  // create on today while you are looking at March would put the new item
  // somewhere you are not looking.
  const defaultCreateDate = useMemo(() => {
    const now = new Date()
    return now.getFullYear() === cursor.year && now.getMonth() === cursor.month
      ? today
      : localISODate(new Date(cursor.year, cursor.month, 1))
  }, [cursor, today])

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

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => step(-1)}
            className="p-1 rounded-lg hover:bg-gray-100" aria-label="Previous month">
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
          <h2 className="font-display font-semibold text-gray-900 text-sm min-w-[124px] text-center
                         select-none">
            {MONTH_NAMES[cursor.month]} {cursor.year}
          </h2>
          <button type="button" onClick={() => step(1)}
            className="p-1 rounded-lg hover:bg-gray-100" aria-label="Next month">
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
          <button type="button" onClick={goToday}
            className="ml-1 text-[11px] px-2 py-1 rounded-lg border border-gray-200 text-gray-600
                       hover:bg-gray-50 hover:text-gray-900">
            Today
          </button>
        </div>

        {/* Counts are for the WHOLE month, before filters — so the numbers do
            not shift as the user narrows the view and stop being a reference. */}
        <div className="flex items-center gap-3">
          {['pending', 'completed', 'overdue', 'cancelled'].map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_STYLE[k].dot}`} />
              {k.charAt(0).toUpperCase() + k.slice(1)}
              <span className="tabular-nums font-semibold text-gray-900">{counts[k] ?? 0}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────
          Between the month nav and the grid, because it narrows the grid and
          not the month. Options and counts come from `all` — the whole month
          before filtering — so the choices never shrink to only what is
          already selected. */}
      <CalendarFilterBar
        filters={filters}
        owners={owners}
        activeCount={activeFilterCount}
        shownCount={items.length}
        totalCount={all.length}
        onToggleType={onToggleType}
        onToggleStatus={onToggleStatus}
        onSetOwner={onSetOwner}
        onClear={onClearFilters}
      />

      {isError && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-800">
          Could not load the calendar. {error?.message}
        </div>
      )}

      {/* ── Two columns: agenda rail, then the month ──────────────────────
          Below `sm` this collapses to the rail alone — a seven-column month
          cannot be made legible at 390px, so the small screen gets a different
          view of the same data rather than a worse version of this one. */}
      <div className="flex flex-col sm:flex-row gap-3 items-start">

      {/* The rail is rendered at every width now. On a phone it is the whole
          calendar; on desktop it is the column the day detail used to be a
          block below. */}
      <div className="w-full sm:w-[276px] sm:flex-shrink-0">
        <AgendaRail
          dates={agendaDates}
          byDate={byDate}
          today={today}
          onOpen={openItem}
          createFor={createFor}
          setCreateFor={setCreateFor}
          onCreateMeeting={createMeetingOn}
          onCreateTask={createTaskOn}
          defaultDate={defaultCreateDate}
          selectedDate={selectedDate}
          onClearSelected={() => setSelectedDate(null)}
        />
      </div>

      <div className="hidden sm:block flex-1 min-w-0 rounded-xl border border-gray-200
                      overflow-hidden bg-white self-start">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {WEEKDAYS.map((d) => (
            <div key={d}
              className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide
                         text-gray-400 text-center">
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
            // step049 sized the cell for four chips. step051 takes it back to
            // three: the fourth cost 36px on every one of the 42 cells, which
            // is where most of the height went. The cap still exists for
            // evenness — a fifth would make one row taller than its
            // neighbours and the grid ragged — not to save space.
            const shown    = [...allDay, ...timed].slice(0, 3)
            const overflow = items.length - shown.length

            return (
              <button
                type="button"
                key={cell.date}
                onClick={() => setSelectedDate(isPicked ? null : cell.date)}
                className={`group relative min-h-[76px] border-b border-r border-gray-100
                            px-1.5 py-1 text-left align-top transition
                            ${cell.inMonth ? 'bg-white' : 'bg-gray-50/50'}
                            ${isPicked ? 'ring-2 ring-inset ring-teal-400' : 'hover:bg-teal-50/40'}`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-[11px] tabular-nums
                    ${isToday
                      ? 'w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center font-semibold'
                      : cell.inMonth ? 'text-gray-600 font-medium' : 'text-gray-300'}`}>
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
                               p-0.5 rounded text-gray-400 hover:bg-gray-100 hover:text-teal-700
                               cursor-pointer"
                    aria-label={`Add on ${cell.date}`}
                  >
                    <Plus className="w-3 h-3" />
                  </span>
                </div>

                {/* Two entities can live on a date, so the choice is explicit.
                    Guessing "meeting" would be wrong for every deadline. */}
                {createFor === cell.date && (
                  <CreateMenu
                    date={cell.date}
                    onMeeting={createMeetingOn}
                    onTask={createTaskOn}
                    onCancel={() => setCreateFor(null)}
                    className="top-6 right-1"
                  />
                )}

                <div className="space-y-px">
                  {shown.map((item) => (
                    <ItemChip key={item.id} item={item} onClick={openItem} compact />
                  ))}
                  {overflow > 0 && (
                    <span className="block text-[10px] text-gray-400 pl-1.5">
                      +{overflow} more
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      </div>


      {isLoading && <p className="text-xs text-gray-500">Loading activities…</p>}

      {/* An empty grid has two very different causes and the user cannot tell
          them apart by looking. Say which one it is, and offer the way out. */}
      {!isLoading && !isError && items.length === 0 && (
        all.length > 0 ? (
          <p className="text-xs text-gray-500">
            Nothing matches these filters — {all.length} item{all.length === 1 ? '' : 's'} this
            month are hidden.{' '}
            <button
              type="button"
              onClick={onClearFilters}
              className="text-teal-700 hover:text-teal-800 font-medium underline underline-offset-2"
            >
              Clear filters
            </button>
          </p>
        ) : (
          <p className="text-xs text-gray-500">
            Nothing scheduled this month. Use + on a date to add a meeting or a task.
          </p>
        )
      )}

      {/* The day-detail block that used to sit here is gone: AgendaRail shows
          the selected day in the left column instead. It rendered the same
          items from the same `byDate`, but below the grid — so clicking a date
          pushed Lead Overview down the page and put the thing you asked for
          below the fold. Nothing moves now. */}

    </div>
  )
}

export default ActivityCalendar
