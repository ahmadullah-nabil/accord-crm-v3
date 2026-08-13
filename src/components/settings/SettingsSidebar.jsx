// ─── SettingsSidebar ──────────────────────────────────────────────────────────
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ step058 — SEVEN EQUAL BUTTONS BECOME TWO NAMED GROUPS                   │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ Profile, Company, Notifications, Appearance, Security, Integrations and  │
// │ Preferences were one flat list of seven, all weighted the same, so       │
// │ nothing told you that Company and Integrations change things for         │
// │ EVERYONE while the other five change things for you. That distinction is │
// │ the only one that matters when you are about to click something in       │
// │ Settings, and the list was not making it.                                │
// │                                                                          │
// │ Two headers now: YOU and WORKSPACE. The grouping lives HERE and not in   │
// │ settingsData.js on purpose — that file is a data contract imported by    │
// │ six section components, and adding a presentation field to it would make │
// │ every one of them carry a key none of them reads.                        │
// │                                                                          │
// │ THE GROUPING IS DERIVED, NOT DUPLICATED. `WORKSPACE_IDS` is the only     │
// │ list; everything not in it is a personal section. A section added to     │
// │ SETTINGS_SECTIONS therefore APPEARS — under "You" — rather than          │
// │ vanishing because someone forgot to add it in two places.                │
// │                                                                          │
// │ THE TEAL PILL IS GONE. An accent-coloured chip with a ring was the       │
// │ loudest thing on a page whose job is to be quiet, and it is the only     │
// │ nav in the app that did not match the sidebar's neutral active state.    │
// │                                                                          │
// │ PERMISSIONS ARE UNCHANGED. `visibleSections` still comes from            │
// │ SettingsPage, which still gates Company on `perms.canEditCompany`. This  │
// │ file filters by that list and decides nothing itself.                    │
// └─────────────────────────────────────────────────────────────────────────┘

import React from 'react'
import {
  User, Building2, Bell, Palette, Shield, SlidersHorizontal, Plug,
} from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore.js'
import { SETTINGS_SECTIONS } from '../../lib/settingsData.js'

const ICON_MAP = {
  User:      User,
  Building2: Building2,
  Bell:      Bell,
  Palette:   Palette,
  Shield:    Shield,
  Plug:      Plug,
  Sliders:   SlidersHorizontal,
}

/** The only list. Anything absent from it is personal — see the header. */
const WORKSPACE_IDS = new Set(['company', 'integrations'])

export function SettingsSidebar({ visibleSections }) {
  const { activeSection, setActiveSection } = useSettingsStore()

  const sections = visibleSections
    ? SETTINGS_SECTIONS.filter((s) => visibleSections.includes(s.id))
    : SETTINGS_SECTIONS

  const groups = [
    { label: 'You',       items: sections.filter((s) => !WORKSPACE_IDS.has(s.id)) },
    { label: 'Workspace', items: sections.filter((s) =>  WORKSPACE_IDS.has(s.id)) },
  ].filter((g) => g.items.length > 0)   // Company hidden for non-admins empties one

  return (
    <nav className="flex flex-col gap-4 w-full">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <p className="text-[10px] uppercase tracking-wide text-gray-400 px-2 mb-1">
            {group.label}
          </p>

          {group.items.map((section) => {
            const Icon     = ICON_MAP[section.icon] || User
            const isActive = activeSection === section.id

            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm
                  transition-colors duration-120 text-left w-full
                  ${isActive
                    ? 'bg-gray-100 text-gray-900 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
              >
                <Icon size={15} className={isActive ? 'text-gray-700' : 'text-gray-400'} />
                {section.label}
              </button>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

export default SettingsSidebar
