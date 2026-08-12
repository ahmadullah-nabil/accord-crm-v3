// ─── Settings Data Layer ───────────────────────────────────────────────────────
//
// This file holds two things, and only two things:
//
//   1. DEFAULT_* shapes — the blank form shape a section falls back to when the
//      signed-in user has no user_preferences row yet, or the workspace has no
//      company_settings row yet. These are NOT mock data: they contain no demo
//      person, no demo company and no fabricated values. They exist so a
//      controlled React form always has every key it renders.
//
//   2. Domain constants — the dropdown option lists rendered by the Settings
//      UI (timezones, currencies, industries, accent colours, …).
//
// The in-memory mock store that used to live here — `_settings`, fetchSettings,
// fetchCompanySettings, updateProfileSettings, changePassword and friends — has
// been removed. It was the ACTIVE backend for five of the six Settings sections;
// real persistence now goes through services/settingsService.js → Supabase.
//
// The constants below are still imported by ProfileSection, CompanySection,
// AppearanceSection, PreferencesSection, SecuritySection and NotificationsSection,
// so this file is deliberately kept rather than deleted.

// ── Fallback shapes ───────────────────────────────────────────────────────────
// Keys mirror the JSONB payloads persisted in public.user_preferences and the
// columns of public.company_settings. Blank/neutral by design.

/** Profile fields with no column on public.profiles — persisted in
 *  user_preferences.preferences under the reserved `profile` key. */
export const DEFAULT_PROFILE_EXTRAS = {
  bio:        '',
  timezone:   'Asia/Dhaka',
  language:   'English',
  dateFormat: 'DD/MM/YYYY',
}

/** Mirrors the columns of public.company_settings. */
export const DEFAULT_COMPANY = {
  name:       '',
  website:    '',
  industry:   '',
  size:       '',
  address:    '',
  phone:      '',
  taxId:      '',
  currency:   'BDT',
  fiscalYear: 'January',
}

/** Persisted as user_preferences.notifications (JSONB). */
export const DEFAULT_NOTIFICATIONS = {
  emailOnLeadAssigned:    true,
  emailOnDealWon:         true,
  emailOnTaskDue:         true,
  emailOnMeetingReminder: true,
  emailOnTeamActivity:    false,
  emailOnSystemUpdate:    true,
  pushLeads:              true,
  pushTasks:              true,
  pushMeetings:           true,
  pushDeals:              true,
  pushSystem:             false,
  digestFrequency:        'daily',  // 'realtime' | 'daily' | 'weekly' | 'never'
}

/** Persisted as user_preferences.appearance (JSONB). */
export const DEFAULT_APPEARANCE = {
  theme:            'light',        // 'light' | 'dark' | 'system'
  accentColor:      'teal',         // 'teal' | 'blue' | 'purple' | 'orange'
  fontSize:         'medium',       // 'small' | 'medium' | 'large'
  density:          'comfortable',  // 'compact' | 'comfortable' | 'spacious'
  sidebarCollapsed: false,
  animations:       true,
  tableRowHover:    true,
}

/** Persisted as user_preferences.security (JSONB).
 *  lastPasswordChange is written by settingsService after a real password
 *  change. activeSessions is display-only — see the note in settingsService. */
export const DEFAULT_SECURITY = {
  twoFactorEnabled:   false,
  sessionTimeout:     '8h',
  loginNotification:  true,
  ipWhitelist:        '',
  lastPasswordChange: '',
  activeSessions:     1,
}

/** Persisted as user_preferences.preferences (JSONB). */
export const DEFAULT_PREFERENCES = {
  defaultModule:     'dashboard',
  leadsDefaultView:  'table',    // 'table' | 'kanban'
  taskDefaultSort:   'dueDate',
  showWelcomeBanner: true,
  confirmDelete:     true,
  autoSaveDrafts:    true,
  exportFormat:      'xlsx',     // 'xlsx' | 'csv' | 'pdf'
  itemsPerPage:      25,
}

// ── Domain constants ──────────────────────────────────────────────────────────

export const SETTINGS_SECTIONS = [
  { id: 'profile',      label: 'Profile',       icon: 'User'      },
  { id: 'company',      label: 'Company',        icon: 'Building2' },
  { id: 'notifications',label: 'Notifications',  icon: 'Bell'      },
  { id: 'appearance',   label: 'Appearance',     icon: 'Palette'   },
  { id: 'security',     label: 'Security',       icon: 'Shield'    },
  { id: 'integrations', label: 'Integrations',   icon: 'Plug'      },
  { id: 'preferences',  label: 'Preferences',    icon: 'Sliders'   },
]

export const TIMEZONES = [
  'Asia/Dhaka', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore',
  'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles',
  'UTC',
]

export const LANGUAGES = ['English', 'Bengali', 'Hindi', 'Arabic', 'French', 'Spanish']
export const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']
export const CURRENCIES = ['BDT', 'USD', 'EUR', 'GBP', 'AED', 'INR', 'SGD']
export const FISCAL_YEARS = ['January', 'April', 'July', 'October']
export const INDUSTRY_OPTIONS = [
  'Software / SaaS', 'Finance / Banking', 'Healthcare',
  'Manufacturing', 'Retail / E-commerce', 'Logistics',
  'Education', 'Real Estate', 'Other',
]
export const COMPANY_SIZES = [
  '1-10 employees', '11-50 employees', '51-200 employees',
  '201-500 employees', '500+ employees',
]
export const SESSION_TIMEOUTS = ['1h', '4h', '8h', '24h', '7d', 'never']
export const DIGEST_FREQUENCIES = [
  { value: 'realtime', label: 'Real-time' },
  { value: 'daily',    label: 'Daily digest' },
  { value: 'weekly',   label: 'Weekly digest' },
  { value: 'never',    label: 'Never' },
]
export const ACCENT_COLORS = [
  { value: 'teal',   label: 'Teal',   hex: '#14b8a6' },
  { value: 'blue',   label: 'Blue',   hex: '#3b82f6' },
  { value: 'purple', label: 'Purple', hex: '#8b5cf6' },
  { value: 'orange', label: 'Orange', hex: '#f97316' },
]
export const MODULE_OPTIONS = [
  { value: 'dashboard',     label: 'Dashboard'     },
  { value: 'leads',         label: 'Leads'         },
  { value: 'contacts',      label: 'Contacts'      },
  { value: 'tasks',         label: 'Tasks'         },
  { value: 'meetings',      label: 'Meetings'      },
  { value: 'analytics',     label: 'Analytics'     },
  { value: 'notifications', label: 'Notifications' },
]
export const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100]
export const EXPORT_FORMATS = [
  { value: 'xlsx', label: 'Excel (.xlsx)' },
  { value: 'csv',  label: 'CSV (.csv)'   },
  { value: 'pdf',  label: 'PDF (.pdf)'   },
]
