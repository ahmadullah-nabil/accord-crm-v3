// ─── Global Search Service ────────────────────────────────────────────────────
//
// Powers the Navbar universal search. Queries the five real CRM entities in
// parallel through the SAME authenticated Supabase client every other service
// uses, so results are automatically constrained by existing RLS.
//
// SECURITY — how RLS is honoured
// ──────────────────────────────
// There is no privileged path here. Every query below is an ordinary PostgREST
// select on the anon key with the signed-in user's JWT, so Postgres applies the
// same SELECT policies the Leads/Contacts/Opportunities pages already go
// through:
//
//   leads          "Leads SELECT — role-scoped"
//   contacts       "Contacts SELECT — authenticated"
//   opportunities  "Opportunities SELECT — role-scoped"
//   tasks          "Tasks SELECT — role-scoped"
//   meetings       "Meetings SELECT — role-scoped"
//
// An Employee therefore cannot surface a Manager's lead through search, because
// the database never returns it. Filtering happens in Postgres, never in the
// browser. No service_role key, no RPC, no view, no schema change.
//
// NO SQL WAS REQUIRED
// ───────────────────
// ilike + or() covers every field the UI needs. A dedicated search view or RPC
// would have to be SECURITY DEFINER to be fast, which would mean re-implementing
// the RBAC rules a second time — strictly worse than letting the existing
// policies do their job.

import { supabase } from '../lib/supabaseClient.js'

/** Max rows fetched per entity. Keeps the dropdown fast and the payload small. */
export const SEARCH_LIMIT = 5

/** Below this length we do not query at all. */
export const MIN_QUERY_LENGTH = 2

/**
 * Make a user's raw input safe for a PostgREST `or=(...)` filter.
 *
 * Commas and parentheses are the filter's own grammar — an unescaped one turns
 * "Smith, John" into two malformed conditions. `%` and `_` are LIKE wildcards,
 * so a user typing `%` would otherwise match every row in the table.
 * Stripping them is sufficient here and avoids an ESCAPE clause PostgREST
 * cannot express.
 */
export function sanitizeQuery(raw) {
  return String(raw ?? '')
    .replace(/[,()%_*\\"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Build an `or` filter string matching `term` against every listed column. */
function orIlike(columns, term) {
  return columns.map((c) => `${c}.ilike.%${term}%`).join(',')
}

// ── Entity definitions ────────────────────────────────────────────────────────
//
// Only columns that genuinely exist are searched — each list was taken from the
// toApp() mapper in that entity's own service, not assumed.
const ENTITIES = [
  {
    type:    'lead',
    label:   'Leads',
    table:   'leads',
    columns: 'id, name, company, email, stage, assignee',
    search:  ['name', 'company', 'email'],
    order:   { column: 'last_activity', ascending: false },
    toResult: (r) => ({
      id:        r.id,
      type:      'lead',
      title:     r.name || 'Untitled lead',
      subtitle:  [r.company, r.email].filter(Boolean).join(' · '),
      meta:      r.stage || '',
    }),
  },
  {
    type:    'contact',
    label:   'Contacts',
    table:   'contacts',
    columns: 'id, name, company, email, phone, type, status',
    search:  ['name', 'company', 'email', 'phone'],
    order:   { column: 'last_activity', ascending: false },
    toResult: (r) => ({
      id:        r.id,
      type:      'contact',
      title:     r.name || 'Unnamed contact',
      subtitle:  [r.company, r.email || r.phone].filter(Boolean).join(' · '),
      // 'Client' is this CRM's customer designation — there is no separate
      // customers table, so it surfaces as the contact's type badge.
      meta:      r.type || '',
    }),
  },
  {
    type:    'opportunity',
    label:   'Opportunities',
    table:   'opportunities',
    columns: 'id, title, company, email, stage, value, assignee',
    search:  ['title', 'company', 'email'],
    order:   { column: 'last_activity', ascending: false },
    toResult: (r) => ({
      id:        r.id,
      type:      'opportunity',
      title:     r.title || 'Untitled opportunity',
      subtitle:  [r.company, r.assignee].filter(Boolean).join(' · '),
      meta:      r.stage || '',
    }),
  },
  {
    type:    'meeting',
    label:   'Meetings',
    table:   'meetings',
    columns: 'id, title, organizer, related_label, scheduled_date, status',
    search:  ['title', 'organizer', 'related_label'],
    order:   { column: 'scheduled_date', ascending: false },
    toResult: (r) => ({
      id:        r.id,
      type:      'meeting',
      title:     r.title || 'Untitled meeting',
      subtitle:  [r.organizer, r.related_label].filter(Boolean).join(' · '),
      meta:      r.scheduled_date || r.status || '',
    }),
  },
  {
    type:    'task',
    label:   'Tasks',
    table:   'tasks',
    columns: 'id, title, assignee, related_label, due_date, status',
    search:  ['title', 'assignee', 'related_label'],
    order:   { column: 'due_date', ascending: true },
    toResult: (r) => ({
      id:        r.id,
      type:      'task',
      title:     r.title || 'Untitled task',
      subtitle:  [r.assignee, r.related_label].filter(Boolean).join(' · '),
      meta:      r.dueDate || r.due_date || r.status || '',
    }),
  },
]

export const SEARCH_GROUPS = ENTITIES.map(({ type, label }) => ({ type, label }))

/**
 * Search every entity in parallel.
 *
 * Uses Promise.allSettled, not Promise.all: one failing table (a missing
 * column, a policy change, a network blip) must not blank the whole dropdown.
 * Failures are returned alongside the successful groups so the UI can show what
 * it has and say what it could not reach. Nothing ever falls back to mock data.
 *
 * @param {string} rawQuery
 * @param {{ limit?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<{ query: string, groups: Array, total: number, errors: Array }>}
 */
export async function searchAll(rawQuery, { limit = SEARCH_LIMIT, signal } = {}) {
  const term = sanitizeQuery(rawQuery)

  if (term.length < MIN_QUERY_LENGTH) {
    return { query: term, groups: [], total: 0, errors: [] }
  }

  const settled = await Promise.allSettled(
    ENTITIES.map(async (entity) => {
      let request = supabase
        .from(entity.table)
        .select(entity.columns)
        .or(orIlike(entity.search, term))
        .limit(limit)

      if (entity.order) {
        request = request.order(entity.order.column, {
          ascending:   entity.order.ascending,
          nullsFirst:  false,
        })
      }
      if (signal) request = request.abortSignal(signal)

      const { data, error } = await request
      if (error) throw Object.assign(error, { entity: entity.type })

      return {
        type:  entity.type,
        label: entity.label,
        items: (data ?? []).map(entity.toResult),
      }
    }),
  )

  const groups = []
  const errors = []

  settled.forEach((outcome, i) => {
    const entity = ENTITIES[i]
    if (outcome.status === 'fulfilled') {
      if (outcome.value.items.length > 0) groups.push(outcome.value)
      return
    }
    // Real error surfaced for debugging — never swallowed, never mocked over.
    console.error(
      `[searchService] "${entity.label}" search failed:`,
      outcome.reason?.message ?? outcome.reason,
    )
    errors.push({ type: entity.type, label: entity.label })
  })

  return {
    query:  term,
    groups,
    total:  groups.reduce((sum, g) => sum + g.items.length, 0),
    errors,
  }
}
