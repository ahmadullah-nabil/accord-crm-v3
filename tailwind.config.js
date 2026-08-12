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
        // Neutral ramp — inverted wholesale in dark mode
        gray:  ramp('gray'),
        // Accent ramp — follows the user's accent preference
        teal:  ramp('accent'),
        sidebar: {
          bg:     'rgb(var(--c-sidebar-bg) / <alpha-value>)',
          hover:  'rgb(var(--c-sidebar-hover) / <alpha-value>)',
          active: 'rgb(var(--c-sidebar-active) / <alpha-value>)',
          border: 'rgb(var(--c-sidebar-border) / <alpha-value>)',
          text:   'rgb(var(--c-sidebar-text) / <alpha-value>)',
          muted:  'rgb(var(--c-sidebar-muted) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Syne', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'card':    'var(--shadow-card)',
        'card-md': 'var(--shadow-card-md)',
        'card-lg': 'var(--shadow-card-lg)',
        'glow-teal': '0 0 20px rgb(var(--c-accent-500) / 0.25)',
      },
      borderRadius: {
        'xl':  '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      animation: {
        'fade-in':    'fadeIn 0.3s ease-out',
        'slide-in':   'slideIn 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
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
