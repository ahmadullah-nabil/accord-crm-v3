// ─── FormKit ──────────────────────────────────────────────────────────────────
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ step059 — THE FIELD WRAPPER EVERY FORM WAS WRITING FOR ITSELF           │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ Five files carried a near-identical private `Field`. Four of them also   │
// │ carried the icon-inside-the-input trick, which is what this batch drops. │
// │                                                                          │
// │ WHY THE ICONS GO. A person glyph beside a field labelled "Full Name", a  │
// │ building beside "Company", an envelope beside "Email" — each one repeats │
// │ the label in a second alphabet, costs the input 9px of left padding, and │
// │ has to be suppressed by hand for textareas because it centres on a box   │
// │ that is no longer one line tall (`Icon && !isTextarea` appears in two    │
// │ files; the other two forgot and the glyph floats mid-textarea). Same     │
// │ argument that removed the analytics KPI icon chips and the page-heading  │
// │ tiles: a decoration that must be special-cased is not carrying its keep. │
// │                                                                          │
// │ SECTIONS ARE THE REAL FIX, and they are option 8 from the reference      │
// │ sheet — one scrolling form with named dividers, NOT a stepper. A stepper │
// │ on an eight-field lead form turns one screen into three and hides two    │
// │ thirds of the fields behind a Next button; the reference mockups showing │
// │ 3-step wizards are for forms with far more in them. Where a form really  │
// │ has separable concerns — the meeting dialog, with an internal-tracking   │
// │ block and a calendar-invitation block that emails real people — steps    │
// │ may earn their place, and that is its own batch and its own argument.    │
// │                                                                          │
// │ A section header is 10px uppercase on a hairline: enough to group, not   │
// │ enough to compete with the field labels under it.                        │
// └─────────────────────────────────────────────────────────────────────────┘

import React from 'react'
import { AlertCircle } from 'lucide-react'

/** A named group of fields inside a form body.
 *  `first` drops the top rule so the form does not open with a divider. */
export function FormSection({ label, first = false, children }) {
  return (
    <div className={first ? '' : 'pt-4 mt-4 border-t border-gray-100'}>
      {label && (
        <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-2.5">
          {label}
        </p>
      )}
      <div className="space-y-3">{children}</div>
    </div>
  )
}

/** Two or three fields on one line. `cols` is a count, not a class, so callers
 *  cannot invent a grid the rest of the form does not use. */
export function FormRow({ cols = 2, children }) {
  const grid = cols === 3
    ? 'grid grid-cols-1 sm:grid-cols-3 gap-3'
    : 'grid grid-cols-1 sm:grid-cols-2 gap-3'
  return <div className={grid}>{children}</div>
}

/** Label + control + error. No icon slot — see the header. */
export function FormField({ label, error, hint, required, children }) {
  const child = React.Children.only(children)

  return (
    <div>
      <label className="label-base">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>

      {React.cloneElement(child, {
        className: [
          child.props.className || 'input-base',
          error ? 'border-red-300 focus:border-red-400' : '',
        ].filter(Boolean).join(' '),
      })}

      {error
        ? <p className="text-[11px] text-red-500 mt-1">{error}</p>
        : hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>
      }
    </div>
  )
}

/** The mutation-failure banner. Contact and Meeting each had their own; Lead,
 *  Opportunity and Task had NONE, which is the step038 wound — a 403 in a form
 *  with no error surface is a dead button. Every migrated form renders this. */
export function FormError({ children }) {
  if (!children) return null
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-red-50 border border-red-100
                    text-red-700 text-xs animate-fade-in">
      <AlertCircle size={13} className="mt-0.5 shrink-0" />
      <span className="min-w-0">{children}</span>
    </div>
  )
}

export default FormField
