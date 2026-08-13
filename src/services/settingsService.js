// ─── Settings Service ─────────────────────────────────────────────────────────
//
// Real Supabase persistence for the Settings module. Called exclusively by
// useSettings.js hooks — UI components never import this file.
//
// TABLES USED (no schema was invented for this module)
// ────────────────────────────────────────────────────
//   public.profiles          name, email, phone, department, role  (via teamService)
//   public.company_settings  one row per workspace, Admin/AGM writable
//   public.user_preferences  one row per user, four JSONB section columns
//
// Both settings tables come from supabase/clean-install/015_settings.sql.
// That file was previously optional; wiring these sections to real persistence
// makes it REQUIRED. If it has not been run, every getter below degrades to the
// DEFAULT_* shape and logs one warning rather than throwing — the Settings page
// still renders, and saves fail loudly instead of silently.
//
// FIELD MAPPING
// ─────────────
//   DB snake_case : org_id, tax_id, fiscal_year, user_id
//   App camelCase : orgId,  taxId,  fiscalYear,  userId
//
// The previous version of this file passed the form payload straight into
// .upsert() with no mapper, so `taxId` and `fiscalYear` would have been rejected
// by PostgREST against the snake_case columns. toDbCompany() closes that gap.
//
// SECURITY
// ────────
// Every call runs as the signed-in user through the anon key. There is no
// service-role credential in this file or anywhere else in src/.
//   • user_preferences — RLS restricts every command to auth.uid() = user_id, so
//     a user physically cannot read or write another user's preferences.
//   • company_settings — RLS lets any authenticated user read, but only Admin and
//     AGM insert or update. The UI hides the Company section from everyone else
//     (SettingsPage ADMIN_ONLY_SECTIONS + permissions.canEditCompany); RLS is the
//     real enforcement, the UI gate is convenience.
// No policy is relaxed or bypassed here.

import { supabase } from '../lib/supabaseClient.js'
import {
  DEFAULT_COMPANY,
  DEFAULT_NOTIFICATIONS,
  DEFAULT_APPEARANCE,
  DEFAULT_SECURITY,
  DEFAULT_PREFERENCES,
  DEFAULT_PROFILE_EXTRAS,
} from '../lib/settingsData.js'
import { todayLocal } from '../lib/dates.js'

// ── Workspace identity ────────────────────────────────────────────────────────
//
// company_settings is keyed by org_id (its primary key), but this CRM has no
// organisations table and no multi-tenant concept — one deployment serves one
// company. A fixed sentinel UUID gives that single row a stable key so .upsert()
// updates it instead of inserting a new row on every save.
//
// This is a constant, not a new column and not a new table. If the product ever
// becomes multi-tenant, this is the single place that changes.
export const WORKSPACE_ORG_ID = '00000000-0000-0000-0000-000000000001'

// ── Error classification ──────────────────────────────────────────────────────
// 42P01 = table does not exist · PGRST205 = table missing from the schema cache.
// Both mean "015_settings.sql has not been run against this project".
const MISSING_TABLE = new Set(['42P01', 'PGRST205'])

let warnedMissingTable = false
function isMissingTable(error) {
  if (!error || !MISSING_TABLE.has(error.code)) return false
  if (!warnedMissingTable) {
    warnedMissingTable = true
    console.warn(
      '[settingsService] company_settings / user_preferences not found. ' +
      'Run supabase/clean-install/015_settings.sql against this project. ' +
      'Settings render with defaults and saves fail until then.',
    )
  }
  return true
}

// ── Company mappers ───────────────────────────────────────────────────────────
function toAppCompany(row) {
  if (!row) return { ...DEFAULT_COMPANY }
  return {
    name:       row.name        ?? '',
    website:    row.website     ?? '',
    industry:   row.industry    ?? '',
    size:       row.size        ?? '',
    address:    row.address     ?? '',
    phone:      row.phone       ?? '',
    taxId:      row.tax_id      ?? '',
    currency:   row.currency    ?? DEFAULT_COMPANY.currency,
    fiscalYear: row.fiscal_year ?? DEFAULT_COMPANY.fiscalYear,
  }
}

function toDbCompany(payload = {}) {
  const row = {}
  if (payload.name       !== undefined) row.name        = payload.name       ?? ''
  if (payload.website    !== undefined) row.website     = payload.website    ?? ''
  if (payload.industry   !== undefined) row.industry    = payload.industry   ?? ''
  if (payload.size       !== undefined) row.size        = payload.size       ?? ''
  if (payload.address    !== undefined) row.address     = payload.address    ?? ''
  if (payload.phone      !== undefined) row.phone       = payload.phone      ?? ''
  if (payload.taxId      !== undefined) row.tax_id      = payload.taxId      ?? ''
  if (payload.currency   !== undefined) row.currency    = payload.currency   ?? ''
  if (payload.fiscalYear !== undefined) row.fiscal_year = payload.fiscalYear ?? ''
  return row
}

// ── Company settings ──────────────────────────────────────────────────────────

/** Read the workspace company profile. Returns blank defaults if never saved. */
export async function getCompanySettings() {
  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .eq('org_id', WORKSPACE_ORG_ID)
    .maybeSingle()          // no row yet is normal, not an error

  if (error) {
    if (isMissingTable(error)) return { ...DEFAULT_COMPANY }
    throw error
  }
  return toAppCompany(data)
}

/**
 * Save the workspace company profile.
 * RLS rejects this for anyone who is not Admin or AGM. The rejection is
 * surfaced, never swallowed, so a non-admin cannot believe a save succeeded.
 */
export async function saveCompanySettings(payload) {
  const { data, error } = await supabase
    .from('company_settings')
    .upsert(
      { ...toDbCompany(payload), org_id: WORKSPACE_ORG_ID, updated_at: new Date().toISOString() },
      { onConflict: 'org_id' },
    )
    .select()
    .single()

  if (error) throw error
  return toAppCompany(data)
}

// ── User preferences ──────────────────────────────────────────────────────────
//
// One row per user, four independent JSONB columns. PostgREST's upsert writes
// only the columns present in the payload, so saving Appearance can never
// clobber Notifications, Security or Preferences.
//
// The `preferences` column is the one exception: it carries BOTH the Preferences
// section's flat keys and the Profile section's locale/bio under a reserved
// `profile` key. Those two writers merge rather than overwrite — see
// savePreferencesSettings and saveProfileExtras below.

const SECTION_DEFAULTS = {
  notifications: DEFAULT_NOTIFICATIONS,
  appearance:    DEFAULT_APPEARANCE,
  security:      DEFAULT_SECURITY,
  preferences:   DEFAULT_PREFERENCES,
}

/** Read one JSONB section, merged over its defaults so the form always has every key. */
async function readSection(userId, column) {
  if (!userId) return { ...SECTION_DEFAULTS[column] }

  const { data, error } = await supabase
    .from('user_preferences')
    .select(column)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    if (isMissingTable(error)) return { ...SECTION_DEFAULTS[column] }
    throw error
  }
  // Defaults first, so a key added to the UI later is never undefined for an
  // existing user whose stored JSON predates it.
  return { ...SECTION_DEFAULTS[column], ...(data?.[column] ?? {}) }
}

/** Write one JSONB section. Other section columns are untouched. */
async function writeSection(userId, column, value) {
  if (!userId) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(
      { user_id: userId, [column]: value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
    .select(column)
    .single()

  if (error) throw error
  return { ...SECTION_DEFAULTS[column], ...(data?.[column] ?? {}) }
}

// ── Notifications preferences ─────────────────────────────────────────────────
export async function getNotificationPrefs(userId) {
  return readSection(userId, 'notifications')
}

export async function saveNotificationPrefs(userId, payload) {
  return writeSection(userId, 'notifications', payload)
}

// ── Appearance ────────────────────────────────────────────────────────────────
export async function getAppearancePrefs(userId) {
  return readSection(userId, 'appearance')
}

export async function saveAppearancePrefs(userId, payload) {
  return writeSection(userId, 'appearance', payload)
}

// ── Security ──────────────────────────────────────────────────────────────────
//
// IMPORTANT — what this does and does not do:
//   • sessionTimeout, loginNotification, ipWhitelist and twoFactorEnabled are
//     STORED PREFERENCES. Persisting them does not enforce them. In particular
//     the two-factor toggle does NOT enable Supabase MFA; real MFA is separate
//     work and is not attempted here.
//   • lastPasswordChange is real — written by changePasswordService below.
//   • activeSessions cannot be counted from the browser: Supabase exposes no
//     client-side session-enumeration API, and doing it properly needs the admin
//     API behind a server. It stays at the stored value (1 = this device).
export async function getSecuritySettings(userId) {
  return readSection(userId, 'security')
}

export async function saveSecuritySettings(userId, payload) {
  return writeSection(userId, 'security', payload)
}

// ── General preferences (shares its column with profile extras) ───────────────

const PROFILE_KEY = 'profile'   // reserved sub-object inside the preferences JSONB

/** Raw read of the whole preferences column, defaults NOT applied. */
async function readRawPreferences(userId) {
  if (!userId) return {}
  const { data, error } = await supabase
    .from('user_preferences')
    .select('preferences')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    if (isMissingTable(error)) return {}
    throw error
  }
  return data?.preferences ?? {}
}

export async function getPreferencesSettings(userId) {
  const raw = await readRawPreferences(userId)
  const { [PROFILE_KEY]: _profile, ...flat } = raw
  return { ...DEFAULT_PREFERENCES, ...flat }
}

/** Save the Preferences section without dropping the Profile section's locale/bio. */
export async function savePreferencesSettings(userId, payload) {
  const raw    = await readRawPreferences(userId)
  const merged = { ...raw, ...payload }
  // Preserve whatever the Profile section stored under the reserved key.
  if (raw[PROFILE_KEY]) merged[PROFILE_KEY] = raw[PROFILE_KEY]

  const saved = await writeSection(userId, 'preferences', merged)
  const { [PROFILE_KEY]: _profile, ...flat } = saved
  return { ...DEFAULT_PREFERENCES, ...flat }
}

// ── Profile extras ────────────────────────────────────────────────────────────
//
// bio, timezone, language and dateFormat are rendered by ProfileSection but have
// NO column on public.profiles. Rather than invent four columns, they are stored
// inside the existing user_preferences.preferences JSONB under the reserved
// `profile` key — same table, same RLS, no schema change.
//
// The Profile section's real columns — name, phone, department — are written to
// public.profiles by teamService.updateProfile via useSettings.useUpdateProfile.

function pick(source = {}, keys = []) {
  const out = {}
  for (const k of keys) if (source[k] !== undefined) out[k] = source[k]
  return out
}

export async function getProfileExtras(userId) {
  const raw = await readRawPreferences(userId)
  return { ...DEFAULT_PROFILE_EXTRAS, ...(raw[PROFILE_KEY] ?? {}) }
}

/** Save locale/bio without dropping the Preferences section's flat keys. */
export async function saveProfileExtras(userId, payload) {
  const raw    = await readRawPreferences(userId)
  const extras = {
    ...DEFAULT_PROFILE_EXTRAS,
    ...(raw[PROFILE_KEY] ?? {}),
    ...pick(payload, Object.keys(DEFAULT_PROFILE_EXTRAS)),
  }

  const saved = await writeSection(userId, 'preferences', { ...raw, [PROFILE_KEY]: extras })
  return { ...DEFAULT_PROFILE_EXTRAS, ...(saved[PROFILE_KEY] ?? {}) }
}

// ── Password change ───────────────────────────────────────────────────────────

/**
 * Change the signed-in user's password.
 *
 * The form collects the current password, so it is actually verified.
 * Supabase's updateUser() alone accepts ANY value in that box, which would be
 * weaker than the mock it replaces. Re-authenticating with signInWithPassword
 * proves the caller knows the existing password before the change is applied;
 * it signs the same user back in, so the active session is refreshed, not lost.
 */
export async function changePasswordService(currentPassword, newPassword) {
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr) throw userErr

  const email = userData?.user?.email
  if (!email) throw new Error('Not authenticated.')

  if (currentPassword === newPassword) {
    throw new Error('New password must differ from current password.')
  }

  // 1. Verify the current password
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  })
  if (signInErr) throw new Error('Current password is incorrect.')

  // 2. Apply the new password
  const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword })
  if (updateErr) throw updateErr

  // 3. Record the change date — best effort. A failure here must not make a
  //    successful password change look like a failure.
  try {
    const userId  = userData.user.id
    const current = await getSecuritySettings(userId)
    await saveSecuritySettings(userId, {
      ...current,
      lastPasswordChange: todayLocal(),
    })
  } catch (err) {
    console.warn('[settingsService] could not record lastPasswordChange:', err?.message)
  }

  return { success: true }
}
