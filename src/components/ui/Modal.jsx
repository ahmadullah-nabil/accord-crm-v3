// ─── Modal ────────────────────────────────────────────────────────────────────
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ step059 — SIX PRIVATE COPIES OF THE SAME DIALOG BECOME ONE              │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ Lead, Contact, Opportunity, Task, Meeting and UserCreate each built      │
// │ their own scrim + panel + header + footer. They had already drifted:     │
// │                                                                          │
// │   width     max-w-[560px] · max-w-[580px] · max-w-[600px] · max-w-lg     │
// │   elevation shadow-card-lg on four, shadow-2xl on two                    │
// │   z-index   z-50 on four, z-[100] on two                                 │
// │   scrim     bg-black/40, WITH backdrop-blur on four and without on two   │
// │   position  `absolute inset-0` scrim on four, `fixed inset-0` on two     │
// │   portal    Task and Meeting portal to <body>; the other four do not     │
// │                                                                          │
// │ Every one of those is a real behavioural difference, not a style tweak.  │
// │ An `absolute` scrim only covers the viewport by accident — it covers its │
// │ nearest positioned ancestor, and a modal nested inside the scrollable    │
// │ <main> is at the mercy of every transform, filter or `contain` above it. │
// │ THIS COMPONENT PORTALS TO <body> ALWAYS, which is the reason Task's file │
// │ gave for doing it, generalised.                                          │
// │                                                                          │
// │ TWENTY-FLAT CHROME. rounded-2xl → rounded-lg, shadow-2xl → a hairline    │
// │ border plus one soft shadow, an 18px bold display title → 14px           │
// │ semibold, and the tinted `bg-gray-50/50` footer band → the same white as │
// │ the body with a hairline above it. A dialog is a surface, not a card     │
// │ stack.                                                                    │
// │                                                                          │
// │ `max-h-[85vh]` IS NOT THE TUNED NUMBER handover #4 warns about. That     │
// │ rule is about PIXEL heights picked against an assumed viewport — the     │
// │ four calendar cell heights. A vh ceiling scales with the window it is    │
// │ measured against, including the bookmarks bar and page zoom that beat    │
// │ all four of those. Do not convert this to px.                            │
// │                                                                          │
// │ ESCAPE AND SCROLL LOCK are here, once, instead of in whichever files     │
// │ remembered. Both were in Task and Meeting only.                           │
// └─────────────────────────────────────────────────────────────────────────┘

import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/** Widths, named. A caller picks a size, not a pixel count, so the six dialogs
 *  cannot drift apart again the way they did. */
const SIZES = {
  sm: 'max-w-[420px]',
  md: 'max-w-[560px]',
  lg: 'max-w-[680px]',
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  size = 'md',
  footer,
  children,
  closeOnBackdrop = true,
}) {
  // Escape closes. Registered only while open, so a page with several modals
  // defined never has more than one listener.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Lock the page behind the dialog. Without this the list scrolls under an
  // open modal on every wheel gesture, which reads as the modal drifting.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* `fixed`, not `absolute` — see the header. */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={closeOnBackdrop ? onClose : undefined}
      />

      <div
        className={`relative bg-white rounded-lg border border-gray-200 shadow-lg
                    w-full ${SIZES[size] || SIZES.md} max-h-[85vh]
                    flex flex-col animate-fade-in`}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <h2 className="font-display font-semibold text-gray-900 text-sm leading-tight truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-100
                       transition-colors duration-120 shrink-0"
          >
            <X size={15} />
          </button>
        </div>

        {/* The one region that scrolls. The header and footer are shrink-0, so a
            tall form scrolls its fields and never its own chrome. */}
        {children}

        {footer && (
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-100 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

/** The scrolling body. Separate from Modal so a caller can wrap it in a <form>
 *  and keep the footer's submit button inside that form. */
export function ModalBody({ children, className = '' }) {
  return (
    <div className={`flex-1 min-h-0 overflow-y-auto px-4 py-3 ${className}`}>
      {children}
    </div>
  )
}

export default Modal
