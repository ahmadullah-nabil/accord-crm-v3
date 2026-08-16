// ─── Export Service ───────────────────────────────────────────────────────────
//
// RBAC-aware CSV export for Leads, Contacts, and Opportunities.
//
// All data is fetched through the existing service functions which use the
// authenticated user's JWT → RLS applies automatically → exported records
// are exactly what the user is permitted to see.
//
// No server-side export endpoint needed; the CSV is constructed in the browser
// from the already-fetched data and downloaded via a Blob URL.

import { getLeads }         from './leadsService.js'
import { getContacts }      from './contactsService.js'
import { getOpportunities } from './opportunitiesService.js'
import { todayLocal } from '../lib/dates.js'

// ── CSV builder ───────────────────────────────────────────────────────────────

function escapeCsvCell(value) {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // Wrap in quotes if contains comma, newline, or quote
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function rowToCsv(fields, record) {
  return fields.map((f) => {
    const raw = record[f.key]
    // step067 — a field may supply its own formatter. Needed the moment an
    // ARRAY column is exported: String(['Payroll','Leave']) is "Payroll,Leave",
    // which escapeCsvCell then wraps in quotes and Excel shows correctly — but
    // re-importing it reads as ONE value containing a comma. Joining with a
    // semicolon keeps the two apart in both directions.
    return escapeCsvCell(f.format ? f.format(raw, record) : raw)
  }).join(',')
}

function buildCsvString(fields, records) {
  const header = fields.map((f) => f.header).join(',')
  const rows   = records.map((r) => rowToCsv(fields, r))
  return [header, ...rows].join('\n')
}

function triggerDownload(csvString, filename) {
  const bom  = '\uFEFF'   // BOM for Excel UTF-8 compatibility
  const blob = new Blob([bom + csvString], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Field definitions ─────────────────────────────────────────────────────────

const LEAD_EXPORT_FIELDS = [
  { key: 'name',         header: 'Name'          },
  { key: 'company',      header: 'Company'        },
  { key: 'email',        header: 'Email'          },
  { key: 'phone',        header: 'Phone'          },
  { key: 'stage',        header: 'Stage'          },
  { key: 'priority',     header: 'Priority'       },
  { key: 'source',       header: 'Source'         },
  { key: 'value',        header: 'Value'          },
  // step067 — three money columns, deliberately. Value is the pipeline figure;
  // OTC and MMC are what was actually quoted. A spreadsheet that collapses
  // them cannot answer "what is our monthly recurring revenue if these close".
  { key: 'otc',          header: 'OTC'            },
  { key: 'mmc',          header: 'MMC (monthly)'  },
  { key: 'assignee',     header: 'Assignee'       },
  { key: 'notes',        header: 'Notes'          },
  // step067. "Which open leads want Payroll" is a spreadsheet question before
  // it is ever a dashboard one, so the column has to leave the app.
  { key: 'modules',      header: 'Modules',
    format: (v) => (Array.isArray(v) ? v.join('; ') : '') },
  { key: 'createdAt',    header: 'Created Date'   },
  { key: 'lastActivity', header: 'Last Activity'  },
]

const CONTACT_EXPORT_FIELDS = [
  { key: 'name',        header: 'Name'         },
  { key: 'company',     header: 'Company'      },
  { key: 'designation', header: 'Designation'  },
  { key: 'email',       header: 'Email'        },
  { key: 'phone',       header: 'Phone'        },
  { key: 'type',        header: 'Type'         },
  { key: 'status',      header: 'Status'       },
  { key: 'assignee',    header: 'Assignee'     },
  { key: 'address',     header: 'Address'      },
  { key: 'website',     header: 'Website'      },
  { key: 'notes',       header: 'Notes'        },
  { key: 'createdAt',   header: 'Created Date' },
]

const OPPORTUNITY_EXPORT_FIELDS = [
  { key: 'title',             header: 'Title'           },
  { key: 'company',           header: 'Company'         },
  { key: 'stage',             header: 'Stage'           },
  { key: 'value',             header: 'Value'           },
  { key: 'probability',       header: 'Probability (%)'  },
  { key: 'expectedRevenue',   header: 'Expected Revenue' },
  { key: 'expectedCloseDate', header: 'Expected Close'   },
  { key: 'assignee',          header: 'Assignee'         },
  { key: 'email',             header: 'Email'            },
  { key: 'phone',             header: 'Phone'            },
  { key: 'notes',             header: 'Notes'            },
  { key: 'createdAt',         header: 'Created Date'     },
]

// ── Date-stamped filename helper ──────────────────────────────────────────────
function filename(entity) {
  const date = todayLocal()
  return `accord-crm-${entity}-export-${date}.csv`
}

// ── Public export functions ───────────────────────────────────────────────────

/**
 * Export all leads visible to the current user.
 * RLS in Supabase ensures only permitted records are returned by getLeads().
 */
export async function exportLeads(records = null) {
  // If records are provided (e.g. pre-filtered from the page), use them.
  // Otherwise fetch fresh from Supabase (RLS scoped).
  const data = records ?? await getLeads()
  const csv  = buildCsvString(LEAD_EXPORT_FIELDS, data)
  triggerDownload(csv, filename('leads'))
  return data.length
}

export async function exportContacts(records = null) {
  const data = records ?? await getContacts()
  const csv  = buildCsvString(CONTACT_EXPORT_FIELDS, data)
  triggerDownload(csv, filename('contacts'))
  return data.length
}

export async function exportOpportunities(records = null) {
  const data = records ?? await getOpportunities()
  const csv  = buildCsvString(OPPORTUNITY_EXPORT_FIELDS, data)
  triggerDownload(csv, filename('opportunities'))
  return data.length
}
