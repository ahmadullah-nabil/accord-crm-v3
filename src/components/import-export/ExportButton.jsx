// ─── ExportButton — RBAC-aware CSV export trigger ────────────────────────────
//
// Props:
//   entityType   'lead' | 'contact' | 'opportunity'
//   records      optional — pass current filtered records from the page
//                If omitted, fetches all visible records from Supabase
//   label        optional button label override
//   variant      'primary' | 'secondary' (default: 'secondary')

import React, { useState } from 'react'
import { Download, CheckCircle2, AlertTriangle } from 'lucide-react'
import {
  exportLeads, exportContacts, exportOpportunities,
} from '../../services/exportService.js'
import { Spinner } from '../ui/Spinner.jsx'

const EXPORT_FNS = {
  lead:        exportLeads,
  contact:     exportContacts,
  opportunity: exportOpportunities,
}

export function ExportButton({ entityType, records, label, variant = 'secondary' }) {
  const [state, setState] = useState('idle')  // 'idle' | 'exporting' | 'done' | 'error'
  const [count, setCount] = useState(0)

  const handleExport = async () => {
    if (state === 'exporting') return
    setState('exporting')
    try {
      const fn  = EXPORT_FNS[entityType]
      if (!fn) throw new Error(`Unknown entity type: ${entityType}`)
      const n = await fn(records ?? null)
      setCount(n)
      setState('done')
      setTimeout(() => setState('idle'), 3000)
    } catch (err) {
      console.error('[ExportButton]', err.message)
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  const btnClass = variant === 'primary' ? 'btn-primary' : 'btn-secondary'

  return (
    <button
      onClick={handleExport}
      disabled={state === 'exporting'}
      className={`${btnClass} disabled:opacity-60 text-sm`}
      title={`Export ${entityType}s as CSV`}
    >
      {state === 'idle' && <><Download size={14} /> {label ?? 'Export CSV'}</>}
      {state === 'exporting' && <><Spinner size="sm" /> Exporting…</>}
      {state === 'done' && <><CheckCircle2 size={14} /> {count} exported</>}
      {state === 'error' && <><AlertTriangle size={14} /> Export failed</>}
    </button>
  )
}
