// ─── AttachmentPanel ──────────────────────────────────────────────────────────
//
// Upload, list, open and delete the files attached to one CRM record.
//
// Standalone rather than built into the composer, because a file attached to a
// lead is useful whether or not it is ever emailed — a signed contract, a site
// photo, a filled RFP. Wiring it only into the send path would mean the CRM can
// send a quotation and cannot keep one.
//
// It is also the half of step 14 that can be finished and verified now. The
// send path is blocked on the three providers disagreeing about how bytes
// reach them; storing and retrieving files is not blocked on anything.

import React, { useRef, useState } from 'react'
import {
  Paperclip, Upload, X, FileText, Loader2, AlertTriangle, Trash2,
} from 'lucide-react'
import {
  useAttachments, useUploadAttachments, useDeleteAttachment, useOpenAttachment,
} from '../../hooks/useAttachments.js'
import { formatBytes } from '../../services/attachmentService.js'

export function AttachmentPanel({ relatedType, relatedId, compact = false }) {
  const { data: files = [], isLoading } = useAttachments(relatedType, relatedId)
  const { upload, uploading, errors, clearErrors } =
    useUploadAttachments(relatedType, relatedId)
  const remove   = useDeleteAttachment(relatedType, relatedId)
  const openFile = useOpenAttachment()

  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [confirmId, setConfirmId] = useState('')
  const [openError, setOpenError] = useState('')

  const handleFiles = async (fileList) => {
    clearErrors()
    await upload(fileList)
    if (inputRef.current) inputRef.current.value = ''   // allow re-picking the
                                                        // same file after a fix
  }

  const handleOpen = async (path) => {
    setOpenError('')
    try {
      await openFile(path)
    } catch (err) {
      // A signed-URL failure is nearly always an expired session. Saying so
      // beats "failed to fetch".
      setOpenError(err.message ?? 'Could not open the file. Try signing in again.')
    }
  }

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex items-center gap-2">
          <Paperclip size={14} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">
            Files {files.length > 0 && <span className="text-gray-400">({files.length})</span>}
          </h3>
        </div>
      )}

      {/* Drop zone. The click target is the whole area, not just the words —
          a drop zone that only responds to a small link is a drop zone people
          drag onto and nothing happens. */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl px-4 py-5 text-center cursor-pointer
          transition-colors
          ${dragging
            ? 'border-teal-400 bg-teal-50'
            : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
            <Loader2 size={14} className="animate-spin text-teal-600" />
            <span className="truncate">
              Uploading {uploading.name}
              {uploading.total > 1 && ` (${uploading.index} of ${uploading.total})`}…
            </span>
          </div>
        ) : (
          <>
            <Upload size={18} className="mx-auto text-gray-400 mb-1.5" />
            <p className="text-sm text-gray-600">
              Drop files here or <span className="text-teal-600 font-medium">browse</span>
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">Up to 25 MB each</p>
          </>
        )}
      </div>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 space-y-1">
          {errors.map((e, i) => (
            <p key={i} className="text-xs text-red-700 flex items-start gap-1.5">
              <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" /> {e}
            </p>
          ))}
        </div>
      )}

      {openError && (
        <p className="text-xs text-red-600 flex items-center gap-1.5">
          <AlertTriangle size={11} /> {openError}
        </p>
      )}

      {isLoading && <p className="text-xs text-gray-400">Loading files…</p>}

      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-gray-100
                         bg-white hover:border-gray-200 transition-colors group"
            >
              <FileText size={14} className="text-gray-400 flex-shrink-0" />

              <button
                onClick={() => handleOpen(f.storagePath)}
                className="flex-1 min-w-0 text-left"
                title={f.filename}
              >
                <p className="text-sm text-gray-800 truncate group-hover:text-teal-700 transition-colors">
                  {f.filename}
                </p>
                <p className="text-[11px] text-gray-400">{formatBytes(f.sizeBytes)}</p>
              </button>

              {/* Two-step delete. A file here may be the only copy of a signed
                  contract, and an accidental click is not recoverable. */}
              {confirmId === f.id ? (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => {
                      remove.mutate({ id: f.id, storagePath: f.storagePath })
                      setConfirmId('')
                    }}
                    className="text-xs px-2 py-1 rounded-lg bg-red-500 text-onfill hover:bg-red-600"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setConfirmId('')}
                    className="text-xs px-1.5 py-1 rounded-lg text-gray-500 hover:bg-gray-100"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmId(f.id)}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50
                             transition-colors flex-shrink-0"
                  title="Delete file"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {remove.isError && (
        <p className="text-xs text-red-600 flex items-center gap-1.5">
          <AlertTriangle size={11} /> {remove.error?.message}
        </p>
      )}
    </div>
  )
}
