// ─── EmailComposer ────────────────────────────────────────────────────────────
//
// Opened from a contact or lead detail panel. Sends through the user's own
// connected mailbox, logs the send, and drops an entry on the record timeline.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ WHY contentEditable AND execCommand                                     │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ document.execCommand is formally deprecated. It is used anyway because  │
// │ the alternative is adding a rich-text editor dependency (TipTap,        │
// │ Slate, Quill) to package.json, and Phase 1 needs exactly four commands: │
// │ bold, italic, lists, links. Every browser still implements them, and    │
// │ email HTML has to stay simple regardless — mail clients strip most of   │
// │ what a real editor produces.                                            │
// │                                                                          │
// │ If the composer ever needs tables, images or paste-cleaning, that is    │
// │ the moment to take the dependency, not before.                          │
// └─────────────────────────────────────────────────────────────────────────┘
//
// The composer is UNCONTROLLED on purpose. Writing innerHTML back into a
// contentEditable on every keystroke resets the caret to the start of the node,
// which makes typing impossible. The DOM is the source of truth while editing
// and is read on send.

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  X, Mail, Bold, Italic, List, ListOrdered, Link2, Eye, PenLine,
  AlertCircle, CheckCircle2, Send, Plug, Paperclip,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  useEmailAccount, useSendEmail, useThreadAnchor,
  useEmailSettings, useSaveEmailSettings,
} from '../../hooks/useEmail.js'
import {
  TEMPLATE_VARIABLES, variablesFor, previewWithVariables,
} from '../../services/emailService.js'
import { ERROR_MESSAGES } from '../../services/integrationsService.js'
import { useAttachments } from '../../hooks/useAttachments.js'
import { formatBytes } from '../../services/attachmentService.js'

export function EmailComposer({ open, onClose, record, relatedType }) {
  const navigate = useNavigate()

  const { account, canSend, needsReconnect, isLoading: accountLoading } = useEmailAccount()
  const { data: settings } = useEmailSettings()
  const saveSettings = useSaveEmailSettings()

  const relatedId = record?.id ?? null
  const { data: anchor } = useThreadAnchor(relatedType, relatedId, open && canSend)
  const sendMutation = useSendEmail(relatedType, relatedId)

  // ┌───────────────────────────────────────────────────────────────────────┐
  // │ THE COMPOSER PICKS FILES, IT DOES NOT UPLOAD THEM                     │
  // ├───────────────────────────────────────────────────────────────────────┤
  // │ Files are uploaded on the record, by AttachmentPanel, and this offers │
  // │ what is already there. Two reasons, and neither is about saving work: │
  // │                                                                        │
  // │ A file attached to a quotation is part of the record's history — the  │
  // │ signed contract, the filled RFP. Uploading through the composer would │
  // │ mean the only copy lived inside a sent message, so the CRM could mail │
  // │ a document it could not then show you.                                 │
  // │                                                                        │
  // │ And the send path posts IDS, never bytes. A file uploaded here would  │
  // │ still have to reach Storage first to have an id, so a composer-side   │
  // │ uploader would be a second route to the same place, with its own      │
  // │ progress, retry and failure handling to keep in step with the first.  │
  // └───────────────────────────────────────────────────────────────────────┘
  const { data: recordFiles = [] } = useAttachments(relatedType, relatedId)

  const bodyRef = useRef(null)

  const [to, setTo]           = useState('')
  const [cc, setCc]           = useState('')
  const [bcc, setBcc]         = useState('')
  const [showCc, setShowCc]   = useState(false)
  const [subject, setSubject] = useState('')
  const [preview, setPreview] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [signatureOpen, setSignatureOpen] = useState(false)
  const [signatureDraft, setSignatureDraft] = useState('')
  const [sent, setSent] = useState(null)
  const [attachIds, setAttachIds] = useState([])

  const variables = useMemo(() => variablesFor(record), [record])

  // Reset each time the composer opens, so a previous draft or a previous
  // error never bleeds into a new message to a different contact.
  useEffect(() => {
    if (!open) return
    setTo(record?.email ?? '')
    setCc(''); setBcc(''); setShowCc(false)
    setSubject(anchor?.subject ? `Re: ${anchor.subject.replace(/^re:\s*/i, '')}` : '')
    setPreview(false)
    setSent(null)
    setAttachIds([])
    sendMutation.reset()
    if (bodyRef.current) bodyRef.current.innerHTML = ''
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record?.id, anchor?.subject])

  useEffect(() => {
    setSignatureDraft(settings?.signatureHtml ?? '')
  }, [settings?.signatureHtml])

  if (!open) return null

  const exec = (command, value = null) => {
    bodyRef.current?.focus()
    document.execCommand(command, false, value)
  }

  const insertVariable = (token) => {
    bodyRef.current?.focus()
    document.execCommand('insertText', false, token)
  }

  const addLink = () => {
    const url = window.prompt('Link address', 'https://')
    if (!url) return
    // A link with no scheme resolves relative to the CRM's own origin, which is
    // meaningless once the message leaves the browser.
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`
    exec('createLink', href)
  }

  const openPreview = () => {
    setPreviewHtml(previewWithVariables(bodyRef.current?.innerHTML ?? '', variables))
    setPreview(true)
  }

  const handleSend = () => {
    const html = bodyRef.current?.innerHTML ?? ''
    sendMutation.mutate(
      {
        to, cc, bcc,
        subject,
        html,
        variables,
        related: relatedType && relatedId
          ? { type: relatedType, id: relatedId, label: record?.company || record?.name || '' }
          : null,
        thread: anchor
          ? {
              inReplyTo:        anchor.inReplyTo,
              references:       anchor.references,
              providerThreadId: anchor.providerThreadId,
            }
          : null,
        // Ids, not bytes. The Edge Function re-checks that every one of these
        // belongs to an organisation this user is a member of — it runs with
        // the service role, where RLS does not apply, so a client-side filter
        // would be the only check and therefore no check at all.
        attachmentIds: attachIds,
      },
      { onSuccess: (result) => setSent(result) },
    )
  }

  const error = sendMutation.error
  const errorText = error
    ? (ERROR_MESSAGES[error.code] ?? error.message ?? 'The message was not sent.')
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-card-lg w-full max-w-[640px]
        max-h-[90vh] flex flex-col animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="font-display font-bold text-gray-900 text-lg flex items-center gap-2">
              <Mail size={16} className="text-teal-600" />
              {anchor ? 'Reply' : 'New email'}
            </h2>
            {account && (
              <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                From {account.account_email}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── No connected mailbox ───────────────────────────────────────────
            Checked before anything is typed. Letting someone write a message
            and only then discovering there is nowhere to send it from is the
            one failure this screen exists to prevent. */}
        {!accountLoading && !canSend ? (
          <div className="px-6 py-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto mb-3">
              <Plug size={20} className="text-teal-600" />
            </div>
            <p className="text-sm font-semibold text-gray-900">
              {needsReconnect ? 'Your mailbox needs reconnecting' : 'Connect a mailbox first'}
            </p>
            <p className="text-xs text-gray-500 mt-1.5 max-w-[380px] mx-auto leading-relaxed">
              {needsReconnect
                ? 'Access to your connected account has expired, so Accord CRM cannot send on your behalf until you reconnect it.'
                : 'Accord CRM sends from your own Google, Microsoft or Zoho account. Connect one to send email from here.'}
            </p>
            <button
              onClick={() => { onClose(); navigate('/settings') }}
              className="mt-4 text-xs font-semibold px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors"
            >
              {needsReconnect ? 'Reconnect in Settings' : 'Connect a mailbox'}
            </button>
          </div>

        /* ── Sent confirmation ────────────────────────────────────────────── */
        ) : sent ? (
          <div className="px-6 py-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={20} className="text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Email sent</p>
            <p className="text-xs text-gray-500 mt-1.5">
              {/* Only claimed where the provider actually documents it. Telling
                  a Zoho user to check a Sent folder that might be empty would
                  make a working send look broken. */}
              {sent.sentCopy === 'native'
                ? 'A copy is in your Sent folder, and the send is on the timeline.'
                : 'The send is recorded on the timeline.'}
            </p>
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => { setSent(null); sendMutation.reset() }}
                className="text-xs font-semibold px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Write another
              </button>
              <button
                onClick={onClose}
                className="text-xs font-semibold px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>

        /* ── Composer ─────────────────────────────────────────────────────── */
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">

              {errorText && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                  <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs text-red-700 font-medium">{errorText}</p>
                    {/* The provider's own words, when they add something. A
                        generic failure the user cannot act on is worse than a
                        blunt one they can. */}
                    {error?.message && error.message !== errorText && (
                      <p className="text-[11px] text-red-500 mt-1 break-words">{error.message}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Recipients */}
              <Field label="To">
                <input
                  type="text"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="name@company.com, another@company.com"
                  className={INPUT}
                />
              </Field>

              {!showCc ? (
                <button
                  onClick={() => setShowCc(true)}
                  className="text-[11px] font-semibold text-gray-400 hover:text-teal-600 transition-colors"
                >
                  Add Cc or Bcc
                </button>
              ) : (
                <>
                  <Field label="Cc">
                    <input type="text" value={cc} onChange={(e) => setCc(e.target.value)}
                      className={INPUT} placeholder="Optional" />
                  </Field>
                  <Field label="Bcc">
                    <input type="text" value={bcc} onChange={(e) => setBcc(e.target.value)}
                      className={INPUT} placeholder="Optional" />
                  </Field>
                </>
              )}

              <Field label="Subject">
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="What is this about?"
                  className={INPUT}
                />
              </Field>

              {/* Toolbar */}
              <div className="flex items-center gap-1 flex-wrap border border-gray-200 border-b-0 rounded-t-xl px-2 py-1.5 bg-gray-50">
                <ToolButton onClick={() => exec('bold')}          title="Bold"><Bold size={13} /></ToolButton>
                <ToolButton onClick={() => exec('italic')}        title="Italic"><Italic size={13} /></ToolButton>
                <ToolButton onClick={() => exec('insertUnorderedList')} title="Bulleted list"><List size={13} /></ToolButton>
                <ToolButton onClick={() => exec('insertOrderedList')}   title="Numbered list"><ListOrdered size={13} /></ToolButton>
                <ToolButton onClick={addLink} title="Add link"><Link2 size={13} /></ToolButton>

                <span className="w-px h-4 bg-gray-200 mx-1" />

                {TEMPLATE_VARIABLES.map(({ token, label }) => (
                  <button
                    key={token}
                    onClick={() => insertVariable(token)}
                    title={`Insert ${label}`}
                    className="text-[10px] font-semibold px-2 py-1 rounded-lg text-gray-500 hover:text-teal-700 hover:bg-teal-50 transition-colors"
                  >
                    {label}
                  </button>
                ))}

                <span className="flex-1" />

                <ToolButton
                  onClick={preview ? () => setPreview(false) : openPreview}
                  title={preview ? 'Back to editing' : 'Preview with variables filled in'}
                  active={preview}
                >
                  <Eye size={13} />
                </ToolButton>
              </div>

              {/* Body — the editor and the preview swap in place. The editor is
                  kept mounted and hidden rather than unmounted, because
                  unmounting a contentEditable discards its content. */}
              <div className="relative">
                <div
                  ref={bodyRef}
                  contentEditable
                  suppressContentEditableWarning
                  data-placeholder="Write your message…"
                  className={`min-h-[180px] max-h-[300px] overflow-y-auto text-sm text-gray-800
                    border border-gray-200 rounded-b-xl px-3 py-2.5 leading-relaxed
                    focus:outline-none focus:ring-1 focus:ring-teal-300
                    empty:before:content-[attr(data-placeholder)] empty:before:text-gray-300
                    ${preview ? 'hidden' : ''}`}
                />
                {preview && (
                  <div
                    className="min-h-[180px] max-h-[300px] overflow-y-auto text-sm text-gray-800
                      border border-gray-200 rounded-b-xl px-3 py-2.5 leading-relaxed bg-gray-50"
                    // Safe: previewHtml is the user's own composer markup,
                    // rendered back to them before it leaves the browser. It is
                    // never another user's content, and the server sanitises
                    // again before anything is sent or stored.
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                )}
              </div>

              {/* Signature */}
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => setSignatureOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <PenLine size={11} /> Signature
                  </span>
                  <span className="text-gray-400 font-normal">
                    {settings?.signatureHtml ? 'Added to every message' : 'Not set'}
                  </span>
                </button>

                {signatureOpen && (
                  <div className="px-3 pb-3 space-y-2">
                    <textarea
                      rows={3}
                      value={signatureDraft}
                      onChange={(e) => setSignatureDraft(e.target.value)}
                      placeholder="Rayhan Ahmed<br>Accord Technologies Limited"
                      className="w-full text-xs rounded-lg border border-gray-200 p-2.5 resize-none
                        focus:outline-none focus:ring-1 focus:ring-teal-300 placeholder-gray-300"
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-gray-400">
                        Basic HTML. Appended to every message you send.
                      </p>
                      <button
                        onClick={() => saveSettings.mutate({
                          signatureHtml:    signatureDraft,
                          includeSignature: settings?.includeSignature ?? true,
                          fromName:         settings?.fromName ?? '',
                        })}
                        disabled={saveSettings.isPending}
                        className="text-[11px] font-semibold px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                      >
                        {saveSettings.isPending ? 'Saving…' : 'Save signature'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Attachments */}
            {relatedType && relatedId && (
              <div className="px-6 pt-3 border-t border-gray-100 flex-shrink-0">
                {recordFiles.length === 0 ? (
                  <p className="text-[10px] text-gray-400 flex items-center gap-1.5">
                    <Paperclip size={11} />
                    Upload files in the Files section of this record to attach them.
                  </p>
                ) : (
                  <>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                      <Paperclip size={11} />
                      Attach from this record
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                      {recordFiles.map((file) => {
                        const on = attachIds.includes(file.id)
                        return (
                          <button
                            key={file.id}
                            type="button"
                            onClick={() => setAttachIds((prev) =>
                              prev.includes(file.id)
                                ? prev.filter((id) => id !== file.id)
                                : [...prev, file.id],
                            )}
                            title={file.filename}
                            className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                              on
                                ? 'bg-teal-50 border-teal-200 text-teal-700'
                                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                            }`}
                          >
                            {on && <CheckCircle2 size={11} />}
                            <span className="max-w-[180px] truncate">{file.filename}</span>
                            <span className="text-gray-400">{formatBytes(file.sizeBytes)}</span>
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-100 flex-shrink-0">
              <p className="text-[10px] text-gray-400">
                {attachIds.length > 0
                  ? `${attachIds.length} file${attachIds.length > 1 ? 's' : ''} attached`
                  : 'Sent from your connected mailbox.'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="text-xs font-semibold px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={sendMutation.isPending || !to.trim() || !subject.trim()}
                  className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50"
                >
                  <Send size={12} />
                  {sendMutation.isPending ? 'Sending…' : 'Send'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Small pieces ──────────────────────────────────────────────────────────────

const INPUT =
  'w-full text-xs rounded-lg border border-gray-200 px-3 py-2 ' +
  'focus:outline-none focus:ring-1 focus:ring-teal-300 placeholder-gray-300'

function Field({ label, children }) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 w-12 flex-shrink-0">
        {label}
      </label>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

function ToolButton({ onClick, title, active, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-lg transition-colors ${
        active ? 'bg-teal-100 text-teal-700' : 'text-gray-500 hover:text-teal-700 hover:bg-teal-50'
      }`}
    >
      {children}
    </button>
  )
}
