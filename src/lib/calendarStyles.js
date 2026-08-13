// ─── Calendar presentation constants ──────────────────────────────────────────
//
// Colour and iconography for the four calendar statuses and the five item
// types. Extracted from ActivityCalendar when the filter bar arrived, because
// three surfaces now have to agree: the grid chips, the legend, and the filter
// bar. A chip that is rose next to a filter row that is red reads as two
// different things.
//
// PRESENTATION ONLY. No mapping logic lives here — meetings and tasks are
// reconciled in calendarActivityService.js and that stays the single place a
// status vocabulary is translated. This file only decides what a status LOOKS
// like once it has already been named.

import {
  Calendar as CalendarIcon, Check, Phone, Flag, Repeat,
  AlertTriangle, X as XIcon,
} from 'lucide-react'

/** Chip background/border/text, plus the bare dot used by the legend and the
 *  status filter. Keyed by the calendar's own four statuses. */
// step050: `completed` and `cancelled` were on the fixed `slate` ramp, which
// is not mapped to the CSS custom properties. Two of the four calendar
// statuses therefore stayed light on a dark theme — inside ActivityCalendar
// and CalendarFilterBar, both of which were otherwise themed. Neutral chrome
// is the `gray` ramp; rose stays fixed because it is semantic.
export const STATUS_STYLE = {
  pending:   { chip: 'bg-teal-50 text-teal-800 border-teal-200',      dot: 'bg-teal-500'   },
  completed: { chip: 'bg-gray-50 text-gray-500 border-gray-200',      dot: 'bg-gray-400'   },
  overdue:   { chip: 'bg-rose-50 text-rose-800 border-rose-200',      dot: 'bg-rose-500'   },
  cancelled: { chip: 'bg-gray-50 text-gray-400 border-gray-200',      dot: 'bg-gray-300'   },
}

/** Display labels. The stored/URL form is lowercase; humans get title case. */
export const STATUS_LABEL = {
  pending:   'Pending',
  completed: 'Completed',
  overdue:   'Overdue',
  cancelled: 'Cancelled',
}

export const TYPE_ICON = {
  Meeting:     CalendarIcon,
  'Follow-up': Repeat,
  Call:        Phone,
  Deadline:    Flag,
  Task:        Check,
}

/** Status wins over type on a chip: an overdue item needs to announce that
 *  before it announces being a phone call. */
export const STATUS_ICON = {
  overdue:   AlertTriangle,
  cancelled: XIcon,
}
