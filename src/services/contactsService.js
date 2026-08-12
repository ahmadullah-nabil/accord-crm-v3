// ─── Contacts Service ─────────────────────────────────────────────────────────
//
// All Supabase CRUD for the contacts table.
// Called only by useContacts.js hooks — no UI component imports this directly.
//
// Field mapping
// ─────────────
// App uses camelCase:   lastActivity, linkedLeadId, createdAt
// Supabase uses snake:  last_activity, linked_lead_id, created_at
//
// toApp()  DB row   → app shape    (used on every SELECT)
// toDb()   app data → DB columns   (used on INSERT / UPDATE)
//
// RLS
// ───
// supabase.auth persists the session JWT in localStorage and forwards it on
// every request. The contacts RLS policy requires auth.role() = 'authenticated'.

import { supabase }        from '../lib/supabaseClient.js'
import { throwClassified } from '../lib/supabaseErrors.js'

// ── Field mappers ─────────────────────────────────────────────────────────────

/** Supabase row → app contact shape (camelCase) */
function toApp(row) {
  if (!row) return null
  return {
    id:           row.id,
    name:         row.name           ?? '',
    company:      row.company        ?? '',
    designation:  row.designation    ?? '',
    email:        row.email          ?? '',
    phone:        row.phone          ?? '',
    type:         row.type           ?? 'Prospect',
    status:       row.status         ?? 'Active',
    assignee:     row.assignee       ?? '',
    linkedLeadId: row.linked_lead_id ?? null,
    address:      row.address        ?? '',
    website:      row.website        ?? '',
    notes:        row.notes          ?? '',
    tags:         Array.isArray(row.tags) ? row.tags : [],
    avatar:       row.avatar         ?? null,
    createdAt:    row.created_at     ?? '',
    lastActivity: row.last_activity  ?? '',
  }
}

/** App contact payload → Supabase column names (snake_case) */
function toDb(payload) {
  const row = {}
  if (payload.name         !== undefined) row.name           = payload.name
  if (payload.company      !== undefined) row.company        = payload.company
  if (payload.designation  !== undefined) row.designation    = payload.designation
  if (payload.email        !== undefined) row.email          = payload.email
  if (payload.phone        !== undefined) row.phone          = payload.phone
  if (payload.type         !== undefined) row.type           = payload.type
  if (payload.status       !== undefined) row.status         = payload.status
  if (payload.assignee     !== undefined) row.assignee       = payload.assignee
  if (payload.linkedLeadId !== undefined) row.linked_lead_id = payload.linkedLeadId ?? null
  if (payload.address      !== undefined) row.address        = payload.address
  if (payload.website      !== undefined) row.website        = payload.website
  if (payload.notes        !== undefined) row.notes          = payload.notes
  if (payload.avatar       !== undefined) row.avatar         = payload.avatar
  // tags must be a proper array — the Supabase column is TEXT[]
  if (payload.tags !== undefined) {
    row.tags = Array.isArray(payload.tags) ? payload.tags : []
  }
  return row
}

// ── Fetch all contacts ────────────────────────────────────────────────────────

export async function getContacts() {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('last_activity', { ascending: false })

  if (error) throwClassified(error)
  return (data ?? []).map(toApp)
}

// ── Fetch one contact ─────────────────────────────────────────────────────────

export async function getContactById(id) {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throwClassified(error)
  return toApp(data)
}

// ── Create a contact ──────────────────────────────────────────────────────────

export async function insertContact(payload) {
  const today = new Date().toISOString().split('T')[0]
  const row   = {
    ...toDb(payload),
    // last_activity is set by toDb for mutations, also set created_at explicitly
    created_at:    today,
    last_activity: today,
  }
  // Do NOT include `id` — the DB generates it via gen_random_uuid()

  const { data, error } = await supabase
    .from('contacts')
    .insert(row)
    .select()
    .single()

  if (error) throwClassified(error)
  return toApp(data)
}

// ── Update a contact ──────────────────────────────────────────────────────────

export async function patchContact(id, payload) {
  const row = {
    ...toDb(payload),
    last_activity: new Date().toISOString().split('T')[0],
  }

  const { data, error } = await supabase
    .from('contacts')
    .update(row)
    .eq('id', id)
    .select()
    .single()

  if (error) throwClassified(error)
  return toApp(data)
}

// ── Delete a contact ──────────────────────────────────────────────────────────

export async function removeContact(id) {
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id)

  if (error) throwClassified(error)
  return { id }
}
