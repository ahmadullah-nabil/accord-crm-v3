// ─── Logo ─────────────────────────────────────────────────────────────────────
//
// The single place the official Accord Technologies Limited logo is rendered.
// Every screen that shows the brand must import from here — do not inline an
// <img>, an inline <svg>, or an icon stand-in anywhere else.
//
// ASSETS
// ──────
// The two files below are the designer-supplied originals, copied byte-for-byte
// into public/. They are served as static files rather than imported through the
// bundler so nothing can rewrite, minify or re-colour their contents.
//
//   /accord-logo-white.svg   white wordmark  → use on DARK backgrounds
//   /accord-logo-black.svg   dark wordmark   → use on LIGHT backgrounds
//
// Both are the full company lockup: the "accord" wordmark with the hexagon mark,
// over "Technologies Limited". There is no official mark-only or square variant,
// so this component deliberately offers no compact mode. If a compact rail or
// app-icon treatment is needed, request a square asset from the designer rather
// than cropping either file.
//
// PRODUCT vs COMPANY NAMING
// ─────────────────────────
//   Company / brand : Accord Technologies Limited   ← what the logo depicts
//   Product         : Accord CRM                    ← rendered as text, never
//                                                     composited into the logo
//
// USAGE
//   <Logo on="dark"  height={34} />   sidebar, auth screens (dark backgrounds)
//   <Logo on="light" height={28} />   any light-background surface

import React from 'react'

const LOGO_SRC = {
  light: '/accord-logo-black.svg', // dark ink, for light backgrounds
  dark:  '/accord-logo-white.svg', // white ink, for dark backgrounds
}

// Intrinsic aspect ratio of the official artwork (viewBox 239.11 × 84.48).
// Used only to reserve layout space and prevent a load-time reflow — the
// artwork itself is never scaled non-uniformly.
const ASPECT = 239.11 / 84.48

/**
 * Official Accord Technologies Limited logo.
 *
 * @param {'light'|'dark'} on      Background the logo sits on. 'dark' renders
 *                                 the white asset, 'light' renders the black one.
 * @param {number}         height  Rendered height in px. Width scales automatically.
 * @param {string}         className Extra classes for layout only.
 */
export function Logo({ on = 'light', height = 32, className = '', ...rest }) {
  const src = LOGO_SRC[on] ?? LOGO_SRC.light

  return (
    <img
      src={src}
      alt="Accord Technologies Limited"
      height={height}
      width={Math.round(height * ASPECT)}
      style={{ height, width: 'auto' }}
      className={`block select-none ${className}`}
      draggable={false}
      {...rest}
    />
  )
}

export default Logo
