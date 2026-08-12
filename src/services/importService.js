// ─── Import Service ───────────────────────────────────────────────────────────
//
// Handles CSV → CRM record import for Leads and Contacts.
//
// Pipeline
// ────────
//  1. parseCSV()            — PapaParse to rows + detected headers
//  2. mapColumns()          — user maps CSV headers → CRM fields
//  3. validateRows()        — per-row validation + assignee check against profiles
//  4. detectDuplicates()    — email/phone check against existing Supabase records
//  5. importLeads()         — bulk insert with ownership stamps + activity log
//     importContacts()
//
// Safety guarantees
// ─────────────────
// • Invalid assignee names are flagged; the row is marked invalid (not inserted)
// • Duplicate emails produce a warning, not a hard failure — caller decides
// • All inserts carry createdBy + ownerId from the importing user
// • One activity row is logged per import batch (not per row) to avoid log spam
// • No existing records are mutated; this is append-only

import Papa        from 'papaparse'
import { supabase } from '../lib/supabaseClient.js'
import { logActivity, ACTIVITY_TYPES } from './activityService.js'
import { insertLead }     from './leadsService.js'
import { insertContact }  from './contactsService.js'
import { ownershipStamp } from '../lib/users.js'
import {
  STAGES, PRIORITIES, SOURCES,
} from '../stores/leadsStore.js'
import {
  CONTACT_TYPES, CONTACT_STATUSES,
} from '../lib/contactsData.js'

// ── Field definitions ─────────────────────────────────────────────────────────

export const LEAD_IMPORT_FIELDS = [
  { key: 'name',     label: 'Name',     required: true  },
  { key: 'company',  label: 'Company',  required: false },
  { key: 'email',    label: 'Email',    required: false },
  { key: 'phone',    label: 'Phone',    required: false },
  { key: 'stage',    label: 'Stage',    required: false, allowed: STAGES     },
  { key: 'priority', label: 'Priority', required: false, allowed: PRIORITIES },
  { key: 'source',   label: 'Source',   required: false, allowed: SOURCES    },
  { key: 'value',    label: 'Value',    required: false },
  { key: 'assignee', label: 'Assignee', required: false },
  { key: 'notes',    label: 'Notes',    required: false },
]

export const CONTACT_IMPORT_FIELDS = [
  { key: 'name',        label: 'Name',        required: true  },
  { key: 'company',     label: 'Company',     required: false },
  { key: 'designation', label: 'Designation', required: false },
  { key: 'email',       label: 'Email',       required: false },
  { key: 'phone',       label: 'Phone',       required: false },
  { key: 'type',        label: 'Type',        required: false, allowed: CONTACT_TYPES   },
  { key: 'status',      label: 'Status',      required: false, allowed: CONTACT_STATUSES},
  { key: 'assignee',    label: 'Assignee',    required: false },
  { key: 'address',     label: 'Address',     required: false },
  { key: 'website',     label: 'Website',     required: false },
  { key: 'notes',       label: 'Notes',       required: false },
]

// ── Step 1: Parse ─────────────────────────────────────────────────────────────

/**
 * Parse a File object into raw rows and detected headers.
 * Returns { headers: string[], rows: object[], parseErrors: string[] }
 */
export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header:         true,
      skipEmptyLines: true,
      trimHeaders:    true,
      transform:      (value) => (typeof value === 'string' ? value.trim() : value),
      complete: (result) => {
        resolve({
          headers:     result.meta.fields ?? [],
          rows:        result.data        ?? [],
          parseErrors: result.errors.map((e) => `Row ${e.row}: ${e.message}`),
        })
      },
      error: (err) => reject(new Error(`CSV parse failed: ${err.message}`)),
    })
  })
}

// ── Step 2: Auto-map headers → CRM fields ─────────────────────────────────────

/**
 * Attempt to auto-map CSV column headers to known CRM field keys.
 * Returns a mapping object: { csvHeader: crmFieldKey | '' }
 */
export function autoMapColumns(csvHeaders, importFields) {
  const mapping = {}
  for (const header of csvHeaders) {
    const normalised = header.toLowerCase().replace(/[\s_-]+/g, '')
    const matched = importFields.find((f) => {
      const fNorm = f.key.toLowerCase()
      const lNorm = f.label.toLowerCase().replace(/[\s_-]+/g, '')
      return normalised === fNorm || normalised === lNorm ||
             normalised.includes(fNorm) || fNorm.includes(normalised)
    })
    mapping[header] = matched?.key ?? ''
  }
  return mapping
}

// ── Step 3: Validate rows ─────────────────────────────────────────────────────

/**
 * Validate every mapped row.
 *
 * @param {object[]}  rawRows      — PapaParse row objects keyed by CSV header
 * @param {object}    columnMap    — { csvHeader: crmFieldKey }
 * @param {object[]}  importFields — field definitions array
 * @param {string[]}  validAssigneeNames — real profile names from public.profiles
 *
 * Returns { valid: ValidatedRow[], invalid: InvalidRow[] }
 *
 * ValidatedRow:  { _idx, ...crmFields }
 * InvalidRow:    { _idx, _raw, errors: string[] }
 */
export function validateRows(rawRows, columnMap, importFields, validAssigneeNames) {
  const valid   = []
  const invalid = []

  const assigneeSet = new Set(validAssigneeNames.map((n) => n.toLowerCase()))

  rawRows.forEach((raw, idx) => {
    const errors = []
    const mapped = { _idx: idx + 1 }

    // Apply column mapping
    for (const [csvHeader, crmKey] of Object.entries(columnMap)) {
      if (crmKey && raw[csvHeader] !== undefined) {
        mapped[crmKey] = raw[csvHeader]
      }
    }

    // Required field check
    for (const field of importFields) {
      if (field.required && !mapped[field.key]?.toString().trim()) {
        errors.push(`"${field.label}" is required`)
      }
    }

    // Enum validation
    for (const field of importFields) {
      if (field.allowed && mapped[field.key]) {
        const v     = mapped[field.key].toString().trim()
        const match = field.allowed.find(
          (a) => a.toLowerCase() === v.toLowerCase()
        )
        if (!match) {
          errors.push(`"${field.label}" value "${v}" is not valid. Allowed: ${field.allowed.join(', ')}`)
        } else {
          mapped[field.key] = match  // normalise casing
        }
      }
    }

    // Email format
    if (mapped.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mapped.email)) {
      errors.push(`Email "${mapped.email}" is not a valid email address`)
    }

    // Assignee validation — must be a real profile name or empty
    if (mapped.assignee && mapped.assignee.trim()) {
      const assigneeName = mapped.assignee.trim()
      if (!assigneeSet.has(assigneeName.toLowerCase())) {
        errors.push(
          `Assignee "${assigneeName}" is not a workspace member. ` +
          `Leave blank or use a valid name from your team.`
        )
      }
    }

    // Value must be numeric
    if (mapped.value !== undefined && mapped.value !== '') {
      const numVal = Number(String(mapped.value).replace(/[,৳$£€]/g, ''))
      if (isNaN(numVal)) {
        errors.push(`"Value" must be a number (got "${mapped.value}")`)
      } else {
        mapped.value = numVal
      }
    }

    if (errors.length > 0) {
      invalid.push({ _idx: idx + 1, _raw: raw, _mapped: mapped, errors })
    } else {
      valid.push(mapped)
    }
  })

  return { valid, invalid }
}

// ── Step 4: Duplicate detection ───────────────────────────────────────────────

/**
 * Check validated rows against existing Supabase records.
 * Matches on email (case-insensitive) and phone (exact after normalisation).
 *
 * Returns { unique: rows[], duplicates: DuplicateRow[] }
 * DuplicateRow: { row, existingId, matchedOn: 'email'|'phone' }
 */
export async function detectDuplicates(validRows, entityTable) {
  if (validRows.length === 0) return { unique: [], duplicates: [] }

  const emails = validRows
    .filter((r) => r.email)
    .map((r) => r.email.toLowerCase())

  const phones = validRows
    .filter((r) => r.phone)
    .map((r) => r.phone.replace(/\D/g, ''))
    .filter(Boolean)

  // Fetch potential matches in one round-trip
  const [emailRes, phoneRes] = await Promise.all([
    emails.length > 0
      ? supabase.from(entityTable).select('id, email, phone').in('email', emails)
      : Promise.resolve({ data: [] }),
    phones.length > 0
      ? supabase.from(entityTable).select('id, email, phone').in('phone', phones)
      : Promise.resolve({ data: [] }),
  ])

  const existingEmails = new Map(
    (emailRes.data ?? []).map((r) => [r.email?.toLowerCase(), r.id])
  )
  const existingPhones = new Map(
    (phoneRes.data ?? []).map((r) => [r.phone?.replace(/\D/g, ''), r.id])
  )

  const unique     = []
  const duplicates = []

  for (const row of validRows) {
    const emailKey = row.email?.toLowerCase()
    const phoneKey = row.phone?.replace(/\D/g, '')

    if (emailKey && existingEmails.has(emailKey)) {
      duplicates.push({ row, existingId: existingEmails.get(emailKey), matchedOn: 'email' })
    } else if (phoneKey && existingPhones.has(phoneKey)) {
      duplicates.push({ row, existingId: existingPhones.get(phoneKey), matchedOn: 'phone' })
    } else {
      unique.push(row)
    }
  }

  return { unique, duplicates }
}

// ── Step 5: Bulk insert ───────────────────────────────────────────────────────

/**
 * Import validated (non-duplicate) lead rows.
 *
 * @param {object[]} rows    — validated rows from validateRows()
 * @param {object}   user    — authStore.user (for ownership stamp)
 *
 * Returns { imported: number, failed: FailedRow[] }
 */
export async function importLeads(rows, user) {
  const { createdBy, ownerId } = ownershipStamp(user)
  const failed    = []
  let   imported  = 0

  // Process in batches of 50 to avoid timeout on large imports
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50)
    for (const row of batch) {
      try {
        const result = await insertLead({
          name:      row.name     ?? '',
          company:   row.company  ?? '',
          email:     row.email    ?? '',
          phone:     row.phone    ?? '',
          stage:     row.stage    ?? 'New',
          priority:  row.priority ?? 'Medium',
          source:    row.source   ?? '',
          value:     row.value    ?? 0,
          assignee:  row.assignee ?? '',
          notes:     row.notes    ?? '',
          createdBy,
          ownerId,
        })
        imported++
        // Yield to event loop between rows
        await new Promise((r) => setTimeout(r, 0))
      } catch (err) {
        failed.push({ row, error: err.message })
      }
    }
  }

  // Log one batch activity entry
  if (imported > 0) {
    await logActivity({
      type:       ACTIVITY_TYPES.LEAD_CREATED,
      actor:      user?.name ?? '',
      actorId:    user?.id   ?? null,
      action:     `imported ${imported} lead${imported !== 1 ? 's' : ''}`,
      subject:    'CSV import',
      detail:     `Batch import: ${imported} successful${failed.length > 0 ? `, ${failed.length} failed` : ''}`,
      entityType: null,
      entityId:   null,
    }).catch(() => {})
  }

  return { imported, failed }
}

/**
 * Import validated (non-duplicate) contact rows.
 */
export async function importContacts(rows, user) {
  const { createdBy, ownerId } = ownershipStamp(user)
  const failed   = []
  let   imported = 0

  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50)
    for (const row of batch) {
      try {
        await insertContact({
          name:        row.name        ?? '',
          company:     row.company     ?? '',
          designation: row.designation ?? '',
          email:       row.email       ?? '',
          phone:       row.phone       ?? '',
          type:        row.type        ?? 'Prospect',
          status:      row.status      ?? 'Active',
          assignee:    row.assignee    ?? '',
          address:     row.address     ?? '',
          website:     row.website     ?? '',
          notes:       row.notes       ?? '',
          createdBy,
          ownerId,
        })
        imported++
        await new Promise((r) => setTimeout(r, 0))
      } catch (err) {
        failed.push({ row, error: err.message })
      }
    }
  }

  return { imported, failed }
}

// ── CSV download template ─────────────────────────────────────────────────────

export function downloadTemplate(entityType) {
  const fields = entityType === 'lead' ? LEAD_IMPORT_FIELDS : CONTACT_IMPORT_FIELDS
  const headers = fields.map((f) => f.label)
  const exampleRow = {
    lead: ['Farhan Hossain', 'GreenTech BD', 'farhan@greentech.io', '+8801711000001',
           'New', 'Medium', 'Referral', '50000', 'Rezwan Ahmed', ''],
    contact: ['Tanvir Ahmed', 'Apex Corp', 'Sales Manager', 'tanvir@apex.io',
              '+8801711000002', 'Prospect', 'Active', 'Rezwan Ahmed', 'Dhaka, BD', '', ''],
  }
  const csv = [headers.join(','), exampleRow[entityType].join(',')].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `accord-crm-${entityType}-import-template.csv`
  a.click()
  URL.revokeObjectURL(url)
}
