// ─── Opportunities Service ────────────────────────────────────────────────────
import { supabase }        from '../lib/supabaseClient.js'
import { throwClassified } from '../lib/supabaseErrors.js'

// ── Field mappers ─────────────────────────────────────────────────────────────

function toApp(row) {
  if (!row) return null
  return {
    id:                row.id,
    title:             row.title              ?? '',
    company:           row.company            ?? '',
    email:             row.email              ?? '',
    phone:             row.phone              ?? '',
    stage:             row.stage              ?? 'New',
    value:             Number(row.value)      || 0,
    probability:       Number(row.probability) ?? 50,
    expectedRevenue:   Number(row.expected_revenue) || 0,
    expectedCloseDate: row.expected_close_date ?? '',
    lastActivity:      row.last_activity      ?? '',
    assignee:          row.assignee           ?? '',
    sourceLeadId:      row.source_lead_id     ?? null,
    notes:             row.notes              ?? '',
    tags:              Array.isArray(row.tags) ? row.tags : [],
    createdBy:         row.created_by         ?? '',
    ownerId:           row.owner_id           ?? null,
    createdAt:         row.created_at         ?? '',
  }
}

function toDb(payload) {
  const row = {}
  if (payload.title             !== undefined) row.title              = payload.title
  if (payload.company           !== undefined) row.company            = payload.company
  if (payload.email             !== undefined) row.email              = payload.email
  if (payload.phone             !== undefined) row.phone              = payload.phone
  if (payload.stage             !== undefined) row.stage              = payload.stage
  if (payload.assignee          !== undefined) row.assignee           = payload.assignee
  if (payload.notes             !== undefined) row.notes              = payload.notes
  if (payload.value             !== undefined) row.value              = Number(payload.value) || 0
  if (payload.probability       !== undefined) row.probability        = Number(payload.probability) ?? 50
  if (payload.expectedCloseDate !== undefined) row.expected_close_date = payload.expectedCloseDate || null
  if (payload.sourceLeadId      !== undefined) row.source_lead_id    = payload.sourceLeadId || null
  if (payload.tags              !== undefined) row.tags = Array.isArray(payload.tags) ? payload.tags : []
  if (payload.createdBy         !== undefined) row.created_by = payload.createdBy ?? ''
  if (payload.ownerId           !== undefined) row.owner_id   = payload.ownerId   ?? null
  return row
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function getOpportunities() {
  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .order('last_activity', { ascending: false })
  if (error) throwClassified(error)
  return (data ?? []).map(toApp)
}

export async function getOpportunityById(id) {
  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throwClassified(error)
  return toApp(data)
}

export async function insertOpportunity(payload) {
  const today = new Date().toISOString().split('T')[0]
  const row = { ...toDb(payload), created_at: today, last_activity: today }
  const { data, error } = await supabase
    .from('opportunities')
    .insert(row)
    .select()
    .single()
  if (error) throwClassified(error)
  return toApp(data)
}

export async function patchOpportunity(id, payload) {
  const row = { ...toDb(payload), last_activity: new Date().toISOString().split('T')[0] }
  const { data, error } = await supabase
    .from('opportunities')
    .update(row)
    .eq('id', id)
    .select()
    .single()
  if (error) throwClassified(error)
  return toApp(data)
}

export async function patchOpportunityStage(id, stage) {
  const { data, error } = await supabase
    .from('opportunities')
    .update({ stage, last_activity: new Date().toISOString().split('T')[0] })
    .eq('id', id)
    .select()
    .single()
  if (error) throwClassified(error)
  return toApp(data)
}

export async function removeOpportunity(id) {
  const { error } = await supabase.from('opportunities').delete().eq('id', id)
  if (error) throwClassified(error)
  return { id }
}
