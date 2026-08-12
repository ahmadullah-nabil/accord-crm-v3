// ─── ImportModal — 5-step CSV import wizard ───────────────────────────────────
//
// Props:
//   entityType  'lead' | 'contact'
//   onClose     () => void
//   onSuccess   (count: number) => void   — called after successful import
//
// Steps:
//   1. Upload      — drag/drop or click to select .csv file
//   2. Map columns — user maps CSV headers → CRM fields
//   3. Validate    — row-level error preview + assignee warnings
//   4. Duplicates  — skip/import decision for matched records
//   5. Importing   — progress + result summary

import React, { useState, useCallback, useRef } from 'react'
import {
  X, Upload, ChevronRight, ChevronLeft, Download,
  AlertTriangle, CheckCircle2, XCircle, RefreshCw,
  FileText, Users, ArrowRight,
} from 'lucide-react'
import {
  parseCSV, autoMapColumns, validateRows, detectDuplicates,
  importLeads, importContacts,
  LEAD_IMPORT_FIELDS, CONTACT_IMPORT_FIELDS,
  downloadTemplate,
} from '../../services/importService.js'
import { useAuthStore }        from '../../stores/authStore.js'
import { useAssignableMembers } from '../../hooks/useTeam.js'
import { Spinner }             from '../ui/Spinner.jsx'

// ── Step indicator ────────────────────────────────────────────────────────────
const STEPS = ['Upload', 'Map columns', 'Validate', 'Duplicates', 'Import']

function StepBar({ current }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {STEPS.map((label, i) => (
        <React.Fragment key={label}>
          <div className="flex flex-col items-center">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
              transition-colors ${i < current
                ? 'bg-teal-500 text-white'
                : i === current
                  ? 'bg-teal-500 text-white ring-4 ring-teal-100'
                  : 'bg-gray-100 text-gray-400'
              }`}>
              {i < current ? <CheckCircle2 size={14} /> : i + 1}
            </div>
            <span className={`text-[10px] mt-1 font-medium whitespace-nowrap
              ${i <= current ? 'text-teal-600' : 'text-gray-400'}`}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-px mt-[-14px] mx-1 ${i < current ? 'bg-teal-400' : 'bg-gray-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function ImportModal({ entityType, onClose, onSuccess }) {
  const user   = useAuthStore((s) => s.user)
  const { names: memberNames } = useAssignableMembers()

  const importFields = entityType === 'lead' ? LEAD_IMPORT_FIELDS : CONTACT_IMPORT_FIELDS
  const entityLabel  = entityType === 'lead' ? 'Leads' : 'Contacts'

  const [step,        setStep]        = useState(0)
  const [file,        setFile]        = useState(null)
  const [csvData,     setCsvData]     = useState(null)   // { headers, rows, parseErrors }
  const [columnMap,   setColumnMap]   = useState({})
  const [validation,  setValidation]  = useState(null)   // { valid, invalid }
  const [dedupeResult, setDedupeResult] = useState(null) // { unique, duplicates }
  const [includeDups, setIncludeDups] = useState(false)  // include duplicates anyway
  const [result,      setResult]      = useState(null)   // { imported, failed }
  const [isWorking,   setIsWorking]   = useState(false)
  const [error,       setError]       = useState('')

  const dropRef = useRef(null)

  // ── Step 1: File upload ─────────────────────────────────────────────────────
  const handleFile = useCallback(async (f) => {
    if (!f || !f.name.endsWith('.csv')) {
      setError('Please select a .csv file.')
      return
    }
    setError('')
    setFile(f)
    setIsWorking(true)
    try {
      const parsed = await parseCSV(f)
      setCsvData(parsed)
      setColumnMap(autoMapColumns(parsed.headers, importFields))
      setStep(1)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsWorking(false)
    }
  }, [importFields])

  // ── Step 2: Column mapping ──────────────────────────────────────────────────
  const handleMap = () => {
    setIsWorking(true)
    const res = validateRows(csvData.rows, columnMap, importFields, memberNames)
    setValidation(res)
    setIsWorking(false)
    setStep(2)
  }

  // ── Step 3 → 4: Deduplicate ─────────────────────────────────────────────────
  const handleDeduplicate = async () => {
    setIsWorking(true)
    setError('')
    try {
      const table  = entityType === 'lead' ? 'leads' : 'contacts'
      const result = await detectDuplicates(validation.valid, table)
      setDedupeResult(result)
      setStep(3)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsWorking(false)
    }
  }

  // ── Step 5: Import ──────────────────────────────────────────────────────────
  const handleImport = async () => {
    setIsWorking(true)
    setError('')
    try {
      const rowsToImport = includeDups
        ? [...dedupeResult.unique, ...dedupeResult.duplicates.map((d) => d.row)]
        : dedupeResult.unique

      const fn     = entityType === 'lead' ? importLeads : importContacts
      const result = await fn(rowsToImport, user)
      setResult(result)
      setStep(4)
      if (result.imported > 0) onSuccess?.(result.imported)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsWorking(false)
    }
  }

  // ── Drag/drop ───────────────────────────────────────────────────────────────
  const onDrop = useCallback((e) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-display font-bold text-gray-900">
              Import {entityLabel}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Upload a CSV file to import records</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <StepBar current={step} />

          {/* ── STEP 0: Upload ── */}
          {step === 0 && (
            <div className="space-y-4">
              {/* Drag/drop zone */}
              <div
                ref={dropRef}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center
                           hover:border-teal-300 hover:bg-teal-50/30 transition-all duration-200 cursor-pointer"
                onClick={() => document.getElementById('csv-file-input').click()}
              >
                <Upload size={28} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-700">Drop your CSV file here</p>
                <p className="text-xs text-gray-400 mt-1">or click to browse</p>
                <input
                  id="csv-file-input"
                  type="file"
                  accept=".csv"
                  className="sr-only"
                  onChange={(e) => handleFile(e.target.files[0])}
                />
              </div>

              {file && (
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl text-sm text-gray-600">
                  <FileText size={14} className="text-teal-500" />
                  {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </div>
              )}

              {/* Template download */}
              <button
                onClick={() => downloadTemplate(entityType)}
                className="flex items-center gap-2 text-xs text-teal-600 hover:text-teal-700 font-medium"
              >
                <Download size={13} /> Download template CSV
              </button>

              {error && <ErrorBanner message={error} />}
            </div>
          )}

          {/* ── STEP 1: Map columns ── */}
          {step === 1 && csvData && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 mb-3">
                Match your CSV columns to the correct CRM fields.
                <span className="text-red-400 ml-1">* Required</span>
              </p>
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                {importFields.map((field) => {
                  // Find which CSV header currently maps to this field
                  const currentHeader = Object.entries(columnMap)
                    .find(([, v]) => v === field.key)?.[0] ?? ''

                  return (
                    <div key={field.key} className="flex items-center gap-4 px-4 py-3 bg-white">
                      <div className="w-32 flex-shrink-0">
                        <span className="text-xs font-semibold text-gray-700">
                          {field.label}
                          {field.required && <span className="text-red-400 ml-0.5">*</span>}
                        </span>
                      </div>
                      <ArrowRight size={14} className="text-gray-300 flex-shrink-0" />
                      <select
                        className="flex-1 text-xs rounded-lg border border-gray-200 px-2 py-1.5 outline-none
                                   focus:ring-1 focus:ring-teal-400 bg-white"
                        value={currentHeader}
                        onChange={(e) => {
                          const newHeader = e.target.value
                          setColumnMap((prev) => {
                            const next = { ...prev }
                            // Clear old binding for this field
                            Object.keys(next).forEach((h) => {
                              if (next[h] === field.key) next[h] = ''
                            })
                            if (newHeader) next[newHeader] = field.key
                            return next
                          })
                        }}
                      >
                        <option value="">— Skip this field —</option>
                        {csvData.headers.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-gray-400">
                {csvData.rows.length} rows in file · {csvData.parseErrors.length} parse warnings
              </p>
              {error && <ErrorBanner message={error} />}
            </div>
          )}

          {/* ── STEP 2: Validation results ── */}
          {step === 2 && validation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={CheckCircle2} color="emerald"
                  label="Valid rows" value={validation.valid.length} />
                <StatCard icon={XCircle} color="red"
                  label="Invalid rows" value={validation.invalid.length} />
              </div>

              {validation.invalid.length > 0 && (
                <div className="border border-red-100 rounded-xl overflow-hidden">
                  <div className="bg-red-50 px-4 py-2 flex items-center gap-2">
                    <AlertTriangle size={13} className="text-red-500" />
                    <span className="text-xs font-semibold text-red-700">
                      {validation.invalid.length} rows have errors and will be skipped
                    </span>
                  </div>
                  <div className="max-h-[240px] overflow-y-auto divide-y divide-gray-50">
                    {validation.invalid.map((row) => (
                      <div key={row._idx} className="px-4 py-2.5 bg-white">
                        <p className="text-xs font-semibold text-gray-700 mb-1">
                          Row {row._idx}: {row._raw[Object.keys(row._raw)[0]] ?? ''}
                        </p>
                        <ul className="space-y-0.5">
                          {row.errors.map((e, i) => (
                            <li key={i} className="text-[11px] text-red-500 flex items-start gap-1">
                              <span className="mt-0.5 flex-shrink-0">•</span> {e}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {validation.valid.length === 0 && (
                <ErrorBanner message="No valid rows to import. Fix the errors above and re-upload your CSV." />
              )}

              {error && <ErrorBanner message={error} />}
            </div>
          )}

          {/* ── STEP 3: Duplicates ── */}
          {step === 3 && dedupeResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={CheckCircle2} color="emerald"
                  label="New records" value={dedupeResult.unique.length} />
                <StatCard icon={AlertTriangle} color="amber"
                  label="Duplicates found" value={dedupeResult.duplicates.length} />
              </div>

              {dedupeResult.duplicates.length > 0 && (
                <>
                  <div className="border border-amber-100 rounded-xl overflow-hidden">
                    <div className="bg-amber-50 px-4 py-2">
                      <span className="text-xs font-semibold text-amber-700">
                        These records already exist (matched by email or phone)
                      </span>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto divide-y divide-gray-50">
                      {dedupeResult.duplicates.map(({ row, matchedOn }, i) => (
                        <div key={i} className="px-4 py-2.5 bg-white flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-700 truncate">{row.name}</p>
                            <p className="text-[11px] text-gray-400">{row.email || row.phone}</p>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full flex-shrink-0">
                            {matchedOn} match
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all
                        ${includeDups ? 'bg-teal-500 border-teal-500' : 'bg-white border-gray-300'}`}
                      onClick={() => setIncludeDups((v) => !v)}
                    >
                      {includeDups && (
                        <svg viewBox="0 0 10 8" className="w-2.5 h-2" fill="none" stroke="white" strokeWidth="2">
                          <path d="M1 4l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm text-gray-600">
                      Import duplicates anyway (creates additional records)
                    </span>
                  </label>
                </>
              )}

              {error && <ErrorBanner message={error} />}
            </div>
          )}

          {/* ── STEP 4: Result ── */}
          {step === 4 && result && (
            <div className="space-y-4 text-center py-4">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto ring-1
                ${result.imported > 0 ? 'bg-emerald-50 ring-emerald-200' : 'bg-amber-50 ring-amber-200'}`}>
                {result.imported > 0
                  ? <CheckCircle2 size={28} className="text-emerald-500" />
                  : <AlertTriangle size={28} className="text-amber-500" />
                }
              </div>
              <div>
                <h3 className="font-display font-bold text-xl text-gray-900">
                  Import complete
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {result.imported} record{result.imported !== 1 ? 's' : ''} imported successfully
                </p>
                {result.failed.length > 0 && (
                  <p className="text-xs text-red-500 mt-1">
                    {result.failed.length} row{result.failed.length !== 1 ? 's' : ''} failed — check the data and re-import
                  </p>
                )}
              </div>
              {result.failed.length > 0 && (
                <div className="text-left border border-red-100 rounded-xl divide-y divide-gray-50 max-h-[160px] overflow-y-auto">
                  {result.failed.map(({ row, error }, i) => (
                    <div key={i} className="px-4 py-2">
                      <p className="text-xs font-medium text-gray-700">{row.name}</p>
                      <p className="text-[11px] text-red-500">{error}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={step === 0 ? onClose : () => setStep((s) => s - 1)}
            disabled={isWorking || step === 4}
            className="btn-secondary disabled:opacity-40"
          >
            {step === 0 ? 'Cancel' : <><ChevronLeft size={14} /> Back</>}
          </button>

          {/* Progress actions */}
          {step === 0 && (
            <button
              onClick={() => document.getElementById('csv-file-input').click()}
              className="btn-primary"
              disabled={isWorking}
            >
              {isWorking ? <Spinner size="sm" color="white" /> : 'Select file'}
            </button>
          )}
          {step === 1 && (
            <button onClick={handleMap} className="btn-primary" disabled={isWorking}>
              Validate rows <ChevronRight size={14} />
            </button>
          )}
          {step === 2 && (
            <button
              onClick={handleDeduplicate}
              disabled={isWorking || validation.valid.length === 0}
              className="btn-primary disabled:opacity-40"
            >
              {isWorking ? <Spinner size="sm" color="white" /> : <>Check duplicates <ChevronRight size={14} /></>}
            </button>
          )}
          {step === 3 && (
            <button
              onClick={handleImport}
              disabled={isWorking || (dedupeResult.unique.length === 0 && !includeDups)}
              className="btn-primary disabled:opacity-40"
            >
              {isWorking
                ? <><Spinner size="sm" color="white" /> Importing…</>
                : <>Import {(includeDups
                    ? dedupeResult.unique.length + dedupeResult.duplicates.length
                    : dedupeResult.unique.length
                  )} records</>
              }
            </button>
          )}
          {step === 4 && (
            <button onClick={onClose} className="btn-primary">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, color, label, value }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-700',
    red:     'bg-red-50 text-red-700',
    amber:   'bg-amber-50 text-amber-700',
  }
  return (
    <div className={`rounded-xl px-4 py-3 ${colors[color] || 'bg-gray-50 text-gray-700'}`}>
      <div className="flex items-center gap-2">
        <Icon size={16} />
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <p className="font-display font-bold text-2xl mt-1">{value}</p>
    </div>
  )
}

function ErrorBanner({ message }) {
  return (
    <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border bg-red-50 border-red-100 text-red-700 text-sm">
      <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  )
}
