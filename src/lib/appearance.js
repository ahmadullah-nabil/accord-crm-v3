// ─── Appearance Runtime ───────────────────────────────────────────────────────
//
// The ONE place that writes appearance state to the DOM. There is no second
// theme system anywhere in this codebase: no next-themes, no theme context, no
// per-component dark: variants. Everything flows through applyAppearance().
//
// HOW IT WORKS
// ────────────
// Five attributes on <html> drive the CSS token layer in src/index.css:
//
//   class="dark"              → inverts the neutral ramp
//   data-accent="teal|blue|purple|orange"
//   data-font-size="small|medium|large"
//   data-density="compact|comfortable|spacious"
//   data-row-hover="on|off"
//   data-animations="on|off"
//
// Because Tailwind's white/gray/teal scales are CSS variables (tailwind.config.js),
// flipping these attributes restyles the whole CRM instantly — no reload, no
// re-render, no component changes.
//
// PERSISTENCE
// ───────────
// Supabase (user_preferences.appearance) is the source of truth. localStorage is
// only a FLASH-PREVENTION MIRROR: it lets the inline script in index.html paint
// the correct theme before React boots. It is never read as authoritative state.
//
// THE MIRROR IS USER-SCOPED. It stores { v, userId, appearance } and is only
// honoured when userId matches the user in the currently persisted Supabase
// session. Without that check, User A closing the tab without logging out would
// leave a cache that painted User A's theme for User B on the next cold start.
// Logout clears it outright; the scoping covers the tab-closed case that logout
// cannot.
//
// No credential or token is written here — only a user id alongside appearance
// values. The session is READ from Supabase's own existing store (storageKey
// 'accord-crm-auth' in lib/supabaseClient.js); nothing new is persisted.

export const APPEARANCE_CACHE_KEY = 'accord-appearance'

// Must stay in sync with the auth storageKey in src/lib/supabaseClient.js and
// with the inline pre-hydration script in index.html.
const AUTH_STORAGE_KEY = 'accord-crm-auth'

export const APPEARANCE_DEFAULTS = {
  theme:         'light',
  accentColor:   'teal',
  fontSize:      'medium',
  density:       'comfortable',
  animations:    true,
  tableRowHover: true,
}

const THEMES     = ['light', 'dark', 'system']
const ACCENTS    = ['teal', 'blue', 'purple', 'orange']
const FONT_SIZES = ['small', 'medium', 'large']
const DENSITIES  = ['compact', 'comfortable', 'spacious']

const oneOf = (value, allowed, fallback) =>
  allowed.includes(value) ? value : fallback

/** Coerce any stored/partial object into a complete, valid appearance object. */
export function normalizeAppearance(input = {}) {
  return {
    theme:         oneOf(input.theme,       THEMES,     APPEARANCE_DEFAULTS.theme),
    accentColor:   oneOf(input.accentColor, ACCENTS,    APPEARANCE_DEFAULTS.accentColor),
    fontSize:      oneOf(input.fontSize,    FONT_SIZES, APPEARANCE_DEFAULTS.fontSize),
    density:       oneOf(input.density,     DENSITIES,  APPEARANCE_DEFAULTS.density),
    animations:    input.animations    !== false,
    tableRowHover: input.tableRowHover !== false,
  }
}

/** True when the OS/browser currently prefers a dark colour scheme. */
export function prefersDark() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true
}

/** Resolve 'system' to the concrete theme currently in effect. */
export function resolveTheme(theme) {
  return theme === 'system' ? (prefersDark() ? 'dark' : 'light') : theme
}

/**
 * Write an appearance object to <html>. Idempotent and cheap — safe to call on
 * every render, every preference change and every OS theme change.
 */
export function applyAppearance(input) {
  if (typeof document === 'undefined') return APPEARANCE_DEFAULTS

  const a    = normalizeAppearance(input)
  const root = document.documentElement

  root.classList.toggle('dark', resolveTheme(a.theme) === 'dark')
  root.dataset.accent     = a.accentColor
  root.dataset.fontSize   = a.fontSize
  root.dataset.density    = a.density
  root.dataset.rowHover   = a.tableRowHover ? 'on' : 'off'
  root.dataset.animations = a.animations ? 'on' : 'off'
  // Kept for the pre-hydration script and for `system` re-resolution
  root.dataset.themePref  = a.theme

  return a
}

/**
 * Read the signed-in user's id out of Supabase's own persisted session.
 * Read-only: this never writes, and never touches the tokens in that entry.
 */
export function getSessionUserId() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)?.user?.id ?? null
  } catch {
    return null
  }
}

/**
 * Mirror to localStorage so the next cold start paints correctly.
 * Stored against the owning user id; without one there is nothing safe to cache.
 */
export function cacheAppearance(input, userId) {
  if (!userId) return
  try {
    localStorage.setItem(APPEARANCE_CACHE_KEY, JSON.stringify({
      v: 1,
      userId,
      appearance: normalizeAppearance(input),
    }))
  } catch { /* private mode / quota — flash prevention is best-effort */ }
}

/**
 * Read the mirror, but ONLY if it belongs to the given user.
 * Any mismatch, missing session or legacy unscoped entry yields defaults, so
 * User B can never inherit User A's theme.
 */
export function readCachedAppearance(userId = getSessionUserId()) {
  try {
    const raw = localStorage.getItem(APPEARANCE_CACHE_KEY)
    if (!raw) return { ...APPEARANCE_DEFAULTS }

    const parsed = JSON.parse(raw)
    // Legacy unscoped payload from before this change — untrusted, discard it.
    if (!parsed || parsed.v !== 1 || !parsed.userId) {
      localStorage.removeItem(APPEARANCE_CACHE_KEY)
      return { ...APPEARANCE_DEFAULTS }
    }
    if (!userId || parsed.userId !== userId) return { ...APPEARANCE_DEFAULTS }

    return normalizeAppearance(parsed.appearance)
  } catch {
    return { ...APPEARANCE_DEFAULTS }
  }
}

/**
 * Clear the cached theme and reset the DOM to defaults.
 * Called on logout so the next user never sees the previous user's theme.
 */
export function clearAppearance() {
  try { localStorage.removeItem(APPEARANCE_CACHE_KEY) } catch { /* ignore */ }
  applyAppearance(APPEARANCE_DEFAULTS)
}

/**
 * Keep 'system' mode live: re-resolve whenever the OS scheme changes while the
 * app is open. No-op for explicit light/dark. Returns an unsubscribe function.
 */
export function watchSystemTheme(getThemePref) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}

  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => {
    if (getThemePref() !== 'system') return
    document.documentElement.classList.toggle('dark', mq.matches)
  }

  // addEventListener is unavailable on the legacy MediaQueryList in old Safari
  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }
  mq.addListener(onChange)
  return () => mq.removeListener(onChange)
}
