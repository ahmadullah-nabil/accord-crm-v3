// ─── AuthLayout ───────────────────────────────────────────────────────────────
//
// step068. The last screen in the app still on the pre-step033 aesthetic.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ WHAT WENT                                                               │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ A dark gradient (`from-gray-900 via-[#0f1923]`) with three blurred teal │
// │ orbs behind a `rounded-2xl shadow-card-lg` card. Two problems, one of    │
// │ them a real bug:                                                        │
// │                                                                          │
// │ 1. `from-gray-900` INVERTS. The neutral ramp flips wholesale in dark     │
// │    mode, so gray-900 resolves near-WHITE there — the "dark" login        │
// │    background became a pale wash while the white card on top of it       │
// │    stayed white. Handover #4 invariant 3, hit for the fourth time.       │
// │    The fixed hex `#0f1923` in the middle of the same gradient did not    │
// │    invert, so the two ends of it disagreed about which mode you were in. │
// │                                                                          │
// │ 2. It looked nothing like the app it is the front door to. Everything    │
// │    behind this screen has been flat, hairline-bordered and neutral since │
// │    step033; this was gradients, orbs and a floating card.                │
// │                                                                          │
// │ WHAT REPLACED IT is a two-pane split: the form on the left at a fixed    │
// │ readable width, a brand panel on the right that collapses below lg. The  │
// │ panel uses `bg-gray-900` deliberately AS A THEMED SURFACE — it is meant  │
// │ to be the inverse of the page, so following the theme is correct here,   │
// │ unlike the gradient that was trying to be dark in both modes.            │
// │                                                                          │
// │ NO CARD. There is nothing to separate the form from — it is the only     │
// │ thing on its half of the screen. A border around it is the same          │
// │ furniture step063 took off every settings section.                        │
// └─────────────────────────────────────────────────────────────────────────┘

import React from 'react'
import { Outlet } from 'react-router-dom'
import { Logo } from '../components/ui/Logo.jsx'

const POINTS = [
  'Leads, contacts, deals and tasks in one pipeline',
  'Email and calendar from your own mailbox',
  'Built for Bangladesh — BDT, Chalan, WPPF, PF',
]

export function AuthLayout() {
  return (
    <div className="min-h-screen flex bg-white">
      {/* ── Form pane ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen">
        <div className="px-6 pt-6 sm:px-10">
          <Logo on="light" height={26} />
        </div>

        {/* The form is centred in what is left, and capped at a readable
            measure rather than stretched across a 1600px monitor. */}
        <div className="flex-1 flex items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-[380px] animate-fade-in">
            <Outlet />
          </div>
        </div>

        <div className="px-6 pb-6 sm:px-10">
          <p className="text-[11px] text-gray-400">
            © {new Date().getFullYear()} Accord Technologies Limited
          </p>
        </div>
      </div>

      {/* ── Brand pane ────────────────────────────────────────────────────────
          Hidden below lg. On a phone this would push the form off the fold to
          say something the person reading it has already decided. */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[42%] bg-gray-900 flex-col justify-between p-12">
        <Logo on="dark" height={28} />

        <div>
          <p className="font-display font-semibold text-white text-[26px] leading-tight tracking-tight">
            The pipeline,
            <br />
            in one place.
          </p>
          <p className="text-sm text-gray-400 mt-3 leading-relaxed max-w-[300px]">
            Accord CRM is the sales system behind AccordHRM — built and used by
            the team that sells it.
          </p>

          <ul className="mt-7 space-y-2.5">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-2.5">
                <span className="w-1 h-1 rounded-full bg-teal-400 mt-[7px] shrink-0" />
                <span className="text-[13px] text-gray-300 leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[11px] text-gray-500">
          Accord Technologies Limited · Dhaka, Bangladesh
        </p>
      </div>
    </div>
  )
}

export default AuthLayout
