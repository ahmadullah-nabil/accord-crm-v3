/** @type {import('tailwindcss').Config} */
//
// THEME MECHANISM
// ───────────────
// Every colour the app already uses — `bg-white`, `text-gray-900`, `bg-teal-500`,
// `border-gray-100` — now resolves to a CSS custom property instead of a fixed
// hex value. The variables are defined in src/index.css:
//
//   :root                    light palette + teal accent   (defaults)
//   html.dark                dark palette                  (overrides greys/white)
//   html[data-accent="blue"] blue accent                   (overrides the teal ramp)
//
// Flipping one class on <html> therefore restyles the entire CRM. No component
// needed a `dark:` variant added, and no page was rewritten.
//
// Channels are stored space-separated ("14 184 166") rather than as hex so that
// Tailwind's `<alpha-value>` slot keeps working — `bg-white/70`,
// `ring-teal-400/20` and `bg-gray-50/60` all still compose correctly.
//
// NOTE: `teal` is the accent ramp. The name is kept because it is used across
// the whole codebase; its VALUES follow the user's accent preference. Accord
// teal remains the default. The official logo is an external SVG asset and is
// never affected by any of this.
//
// ── step033 ────────────────────────────────────────────────────────────────
// The same trick is now applied to RADIUS and TYPE. Both are referenced by
// name throughout the codebase (`rounded-xl` alone appears 211 times,
// `rounded-lg` 102, `font-display` across a dozen components), so redefining
// what those names mean re-skins every call site at once and no component file
// is edited.
//
// This is why the scale below defines the FULL radius ladder rather than only
// the three keys that were here before. Tailwind's built-in `lg` is 0.5rem; if
// only `xl` were tightened, `rounded-lg` would end up LARGER than `rounded-xl`
// and the two would swap places in 300-odd places. Keep this ladder monotonic
// if you retune it again.
const ramp = (name) => ({
  50:  `rgb(var(--c-${name}-50) / <alpha-value>)`,
  100: `rgb(var(--c-${name}-100) / <alpha-value>)`,
  200: `rgb(var(--c-${name}-200) / <alpha-value>)`,
  300: `rgb(var(--c-${name}-300) / <alpha-value>)`,
  400: `rgb(var(--c-${name}-400) / <alpha-value>)`,
  500: `rgb(var(--c-${name}-500) / <alpha-value>)`,
  600: `rgb(var(--c-${name}-600) / <alpha-value>)`,
  700: `rgb(var(--c-${name}-700) / <alpha-value>)`,
  800: `rgb(var(--c-${name}-800) / <alpha-value>)`,
  900: `rgb(var(--c-${name}-900) / <alpha-value>)`,
  950: `rgb(var(--c-${name}-950) / <alpha-value>)`,
})

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Class strategy: <html class="dark">. Applied by src/lib/appearance.js and
  // pre-hydration by the inline script in index.html.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary surface (cards, inputs, dropdowns, modals)
        white: 'rgb(var(--c-white) / <alpha-value>)',

        // step063 — text that sits ON a saturated fill.
        // `white` above is a SURFACE token: it resolves to a dark value in
        // dark mode, which is correct for a card and wrong for the label on a
        // red button. `bg-red-500 text-white` was rendering near-black text on
        // red once you switched themes. `text-onfill` never remaps, the same
        // way `black` deliberately never remaps.
        onfill: '#ffffff',
        // Neutral ramp — inverted wholesale in dark mode
        gray:  ramp('gray'),
        // Accent ramp — follows the user's accent preference
        teal:  ramp('accent'),

        // ── Semantic ramps (step063) ────────────────────────────────────
        // These were Tailwind's built-in literals until now, which is why
        // dark mode looked unfinished: `gray` inverts wholesale in dark
        // mode and these did NOT, so a `bg-red-50 text-red-700` banner
        // stayed a near-WHITE block with dark text on a near-black page.
        // 352 such usages across the app.
        //
        // Routing them through variables lets index.css invert them in
        // dark mode exactly as it already inverts `gray`. Every existing
        // class keeps working and simply starts behaving in dark mode —
        // no component edits, no `dark:` variants.
        red:     ramp('red'),
        amber:   ramp('amber'),
        emerald: ramp('emerald'),
        blue:    ramp('blue'),
        purple:  ramp('purple'),
        orange:  ramp('orange'),
        sidebar: {
          bg:     'rgb(var(--c-sidebar-bg) / <alpha-value>)',
          hover:  'rgb(var(--c-sidebar-hover) / <alpha-value>)',
          active: 'rgb(var(--c-sidebar-active) / <alpha-value>)',
          border: 'rgb(var(--c-sidebar-border) / <alpha-value>)',
          text:   'rgb(var(--c-sidebar-text) / <alpha-value>)',
          muted:  'rgb(var(--c-sidebar-muted) / <alpha-value>)',
        },
      },
      // ── Type ───────────────────────────────────────────────────────────
      // DM Sans + Syne out, Inter family in.
      //
      // Syne is a display face with a lot of personality. It was doing that
      // job well on a marketing-shaped dashboard; on a screen that is mostly
      // table it competes with the data. `display` is remapped rather than
      // removed so the dozen components using `font-display` keep working and
      // simply go quiet.
      //
      // Inter Tight on headings gives them a slightly narrower, engineered
      // set against the body face — enough separation to structure a record
      // page without introducing a second voice. Inter is listed immediately
      // after it, so if Inter Tight ever fails to load the fallback is the
      // right weight and width rather than a system serif.
      //
      // Inter is chosen for one boring, decisive reason: it holds up at 13px
      // in a table cell, and it has real tabular figures, which is what makes
      // a currency column line up. src/index.css turns those on for every
      // th/td.
      fontFamily: {
        sans:    ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Inter Tight', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      // ── Elevation ──────────────────────────────────────────────────────
      // Values live in src/index.css so they can differ per theme.
      // `glow-teal` is kept as a KEY because .btn-primary referenced it and
      // removing the key would break any component still naming it, but it no
      // longer glows — it resolves to a plain hairline. Delete the key once
      // grep shows no `shadow-glow-teal` left in src/.
      boxShadow: {
        'card':    'var(--shadow-card)',
        'card-md': 'var(--shadow-card-md)',
        'card-lg': 'var(--shadow-card-lg)',
        'glow-teal': 'var(--shadow-card)',
      },
      // ── Radius ─────────────────────────────────────────────────────────
      // The whole ladder, tightened and kept monotonic. `xl` is the workhorse
      // (211 uses) and lands at 8px: enough to look drawn rather than cut,
      // small enough to sit inside a 34px table row without looking like a
      // lozenge. `full` is untouched — avatars and status dots stay round.
      borderRadius: {
        'sm':  '0.1875rem',   //  3px
        DEFAULT: '0.25rem',   //  4px
        'md':  '0.3125rem',   //  5px
        'lg':  '0.375rem',    //  6px
        'xl':  '0.5rem',      //  8px  ← dominant
        '2xl': '0.625rem',    // 10px
        '3xl': '0.75rem',     // 12px
      },
      // 120ms is the house transition: fast enough to feel like a direct
      // response, slow enough not to flicker. Registered as a scale value so
      // `duration-120` works both in components and inside @apply.
      transitionDuration: {
        '120': '120ms',
      },
      animation: {
        'fade-in':    'fadeIn 0.12s ease-out',
        'slide-in':   'slideIn 0.12s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        // NO TRANSFORM HERE, DELIBERATELY.
        //
        // This animation sits on the layout's page wrapper. A transformed
        // element becomes the containing block for every position:fixed
        // descendant, so a modal using `fixed inset-0` would cover only the
        // content area and leave the sidebar and header undimmed — the overlay
        // stops being full-screen and looks broken.
        //
        // Opacity alone produces the same perceived fade without that side
        // effect. The 4px rise is not worth a broken overlay.
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%':   { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
}
