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
  React.useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('section')
    if (requested && ALL_SECTIONS[requested]) setActiveSection(requested)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Build the set of sections this user can see
  const visibleSections = Object.fromEntries(
    Object.entries(ALL_SECTIONS).filter(([key]) =>
      !ADMIN_ONLY_SECTIONS.has(key) || perms.canEditCompany
    )
  )

  // If the active section is now hidden, fall back to profile
  const effectiveSection = visibleSections[activeSection] ? activeSection : 'profile'
  const ActiveComponent  = visibleSections[effectiveSection] || ProfileSection

  return (
    <div className="max-w-[1100px]">
      {/* Mobile section selector */}
      <div className="sm:hidden mb-4">
        <select
          className="input-base"
          value={effectiveSection}
          onChange={(e) => setActiveSection(e.target.value)}
        >
          {Object.keys(visibleSections).map((key) => (
            <option key={key} value={key}>
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-6 items-start">
        <div className="hidden sm:block w-48 flex-shrink-0 sticky top-6">
          <div className="card p-2">
            <SettingsSidebar visibleSections={Object.keys(visibleSections)} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <ActiveComponent />
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
