// ─── Stepper ──────────────────────────────────────────────────────────────────
//
// step060. Top progress stepper — numbered circles joined by a rail, labels
// underneath, rendered in `Modal`'s toolbar slot so it stays put while the
// fields scroll.
//
// THREE STATES, and they are visually distinct at a glance:
//   done      accent fill, check glyph, and the rail BEHIND it is accent too
//   current   accent fill, its number, plus a soft halo ring
//   upcoming  white, hairline border, muted number
//
// Colours are `--c-accent-*` variables, so the stepper follows the accent the
// user picked in Settings → Appearance instead of hardcoding one blue. The
// same reason step057 pulled `#14b8a6` out of the revenue chart.
//
// CLICKING A STEP goes back to it. Forward is deliberately not clickable in
// create mode — the Continue button validates the step you are on, and letting
// someone skip past it would submit a record with the required fields of a
// step they never saw. In edit mode every step is reachable, because the
// record already exists and its fields are already valid.
//
// The `mt-[13px]` on the rail is half of the 26px circle, i.e. an alignment
// offset inside one component. It is not the "tuned number" handover #4 warns
// about — that rule is about page heights measured against an assumed viewport.
// If the circle size changes, this changes with it.

import React from 'react'
import { Check } from 'lucide-react'

export function Stepper({ steps, current, onStepClick, allowForward = false }) {
  return (
    <div className="flex items-start px-1 pt-1 pb-0.5">
      {steps.map((step, i) => {
        const done      = i < current
        const isCurrent = i === current
        const reachable = allowForward || i < current

        return (
          <React.Fragment key={step.id}>
            {i > 0 && (
              <div
                className="flex-1 h-0.5 mt-[13px] rounded-full transition-colors duration-200"
                style={{
                  background: done || isCurrent
                    ? 'rgb(var(--c-accent-500))'
                    : 'rgb(var(--c-gray-200))',
                }}
              />
            )}

            <button
              type="button"
              disabled={!reachable}
              onClick={reachable ? () => onStepClick?.(i) : undefined}
              className={`flex flex-col items-center gap-1.5 w-[92px] shrink-0
                          ${reachable ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span
                className="w-[26px] h-[26px] rounded-full flex items-center justify-center
                           text-[11px] font-semibold transition-all duration-200"
                style={{
                  background: done || isCurrent ? 'rgb(var(--c-accent-500))' : 'rgb(var(--c-gray-50))',
                  color:      done || isCurrent ? '#fff' : 'rgb(var(--c-gray-400))',
                  border:     done || isCurrent ? 'none' : '1px solid rgb(var(--c-gray-200))',
                  boxShadow:  isCurrent ? '0 0 0 4px rgb(var(--c-accent-500) / 0.14)' : 'none',
                }}
              >
                {done ? <Check size={13} strokeWidth={3} /> : i + 1}
              </span>

              <span
                className={`text-[11px] leading-tight text-center
                  ${isCurrent ? 'font-medium text-gray-900' : 'text-gray-400'}`}
              >
                {step.label}
              </span>
            </button>
          </React.Fragment>
        )
      })}
    </div>
  )
}

/** The heading that opens each step's body — the "Basic Info / Enter basic
 *  information about this deal." pair from the reference. Kept here rather than
 *  in FormKit because it only exists inside a stepped form. */
export function StepHeading({ title, description }) {
  return (
    <div className="mb-3">
      <h3 className="font-display font-semibold text-gray-900 text-[13px] leading-tight">
        {title}
      </h3>
      {description && (
        <p className="text-[11px] text-gray-400 mt-0.5">{description}</p>
      )}
    </div>
  )
}

export default Stepper
