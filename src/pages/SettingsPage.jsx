// ─── SettingsPage ─────────────────────────────────────────────────────────────
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ step058 — THE PAGE STOPS SCROLLING; THE CONTENT PANE SCROLLS            │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ The rail was `sticky top-6` inside a `card p-2` and the content was a    │
// │ column beside it, so the WINDOW scrolled: on Profile you lost sight of   │
// │ the section list the moment you reached Locale & Formatting, and the     │
// │ page header went with it.                                                │
// │                                                                          │
// │ Now it is the step055 shape — root `h-full min-h-0 flex`, rail           │
// │ `shrink-0`, content `flex-1 min-h-0 overflow-y-auto`. The rail and the   │
// │ heading never move. `AppLayout` already passes `h-full` down, so no      │
// │ layout change is needed anywhere else.                                   │
// │                                                                          │
// │ "EVERYTHING FITS ON ONE SCREEN" MEANS THE PAGE, NOT THE FORM. Profile    │
// │ alone is a name, an email, a phone, a department, a bio and a locale     │
// │ block; no honest layout puts all of that plus a nav rail in 700px, and   │
// │ the four failed calendar heights are what trying looks like. What fits   │
// │ is the FRAME: nav, heading and pane boundaries stay put, and only the    │
// │ fields move. Shortening the sections themselves is a different batch,    │
// │ one section at a time, because each one is a form with its own           │
// │ validation and its own save state.                                       │
// │                                                                          │
// │ THE CARD AROUND THE RAIL IS GONE. A bordered box around a nav is the     │
// │ same furniture ViewHeader removed from every module toolbar in step036.  │
// │ The rail is separated by a hairline instead — one border, not four.       │
// │                                                                          │
// │ `?section` IS DELIBERATELY NOT ADOPTED HERE, and that is the opposite    │
// │ of the call made on Members in this same batch. On Members nothing else  │
// │ owns the tab, so the URL owns it outright. Here `settingsStore` ALREADY  │
// │ owns `activeSection`; putting it in the URL as well would be one value   │
// │ with two owners — the ?leadOwner / ?owner tangle, exactly. The mount     │
// │ effect below stays as the one-way door it already was: the OAuth         │
// │ callback returns to /settings?section=integrations, the effect reads it  │
// │ ONCE and hands it to the store, and the store is the owner from then on. │
// │ Moving this to the URL means REMOVING it from the store, as one batch,   │
// │ not adding a second writer.                                              │
// └─────────────────────────────────────────────────────────────────────────┘

import React from 'react'
import { useSettingsStore }       from '../stores/settingsStore.js'
import { useSettingsPermissions } from '../hooks/usePermissions.js'
import { SettingsSidebar }        from '../components/settings/SettingsSidebar.jsx'
import { ProfileSection }         from '../components/settings/ProfileSection.jsx'
import { CompanySection }         from '../components/settings/CompanySection.jsx'
import { NotificationsSection }   from '../components/settings/NotificationsSection.jsx'
import { AppearanceSection }      from '../components/settings/AppearanceSection.jsx'
import { SecuritySection }        from '../components/settings/SecuritySection.jsx'
import { IntegrationsSection }    from '../components/settings/IntegrationsSection.jsx'
import { PreferencesSection }     from '../components/settings/PreferencesSection.jsx'
import { SETTINGS_SECTIONS }      from '../lib/settingsData.js'

const ALL_SECTIONS = {
  profile:       ProfileSection,
  company:       CompanySection,
  notifications: NotificationsSection,
  appearance:    AppearanceSection,
  security:      SecuritySection,
  integrations:  IntegrationsSection,
  preferences:   PreferencesSection,
}

// Sections restricted to admin-level users
const ADMIN_ONLY_SECTIONS = new Set(['company'])

export function SettingsPage() {
  const { activeSection, setActiveSection } = useSettingsStore()
  const perms = useSettingsPermissions()

  // The OAuth callback redirects back to /settings?section=integrations so the
  // user lands on the section they started from rather than on Profile.
  // Read ONCE, on mount — see the header note on ownership.
  React.useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('section')
    if (requested && ALL_SECTIONS[requested]) setActiveSection(requested)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const visibleSections = Object.fromEntries(
    Object.entries(ALL_SECTIONS).filter(([key]) =>
      !ADMIN_ONLY_SECTIONS.has(key) || perms.canEditCompany
    )
  )

  const effectiveSection = visibleSections[activeSection] ? activeSection : 'profile'
  const ActiveComponent  = visibleSections[effectiveSection] || ProfileSection

  // The label for the crumb comes from the same list the rail renders, so the
  // two cannot disagree about what a section is called.
  const activeLabel =
    SETTINGS_SECTIONS.find((s) => s.id === effectiveSection)?.label || 'Profile'

  return (
    <div className="h-full min-h-0 flex flex-col gap-2">
      {/* ── Heading: where you are, on one line, never scrolling away ───── */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-sm text-gray-400">Settings</span>
        <span className="text-sm text-gray-300">/</span>
        <span className="text-sm font-medium text-gray-900">{activeLabel}</span>
      </div>

      {/* Mobile section selector — the rail is hidden below sm. */}
      <div className="sm:hidden shrink-0">
        <select
          className="input-base"
          value={effectiveSection}
          onChange={(e) => setActiveSection(e.target.value)}
        >
          {Object.keys(visibleSections).map((key) => (
            <option key={key} value={key}>
              {SETTINGS_SECTIONS.find((s) => s.id === key)?.label
                || key.charAt(0).toUpperCase() + key.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 min-h-0 flex gap-4">
        {/* Rail: fixed width, full height, its own scroll if the list ever
            outgrows the window. No card — one hairline, not a box. */}
        <div className="hidden sm:block w-44 shrink-0 border-r border-gray-200 pr-3
                        overflow-y-auto">
          <SettingsSidebar visibleSections={Object.keys(visibleSections)} />
        </div>

        {/* The one region that scrolls. `max-w` keeps a form readable on a wide
            monitor; it is a line-length ceiling, not a layout height. */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-[820px] pb-2">
            <ActiveComponent />
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
