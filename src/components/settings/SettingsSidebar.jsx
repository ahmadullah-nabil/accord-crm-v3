import React from 'react'
import {
  User, Building2, Bell, Palette, Shield, SlidersHorizontal, Plug,
} from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore.js'
import { SETTINGS_SECTIONS } from '../../lib/settingsData.js'

const ICON_MAP = {
  User:     User,
  Building2:Building2,
  Bell:     Bell,
  Palette:  Palette,
  Shield:   Shield,
  Plug:     Plug,
  Sliders:  SlidersHorizontal,
}

export function SettingsSidebar({ visibleSections }) {
  const { activeSection, setActiveSection } = useSettingsStore()

  // Filter to only sections the current user can see (passed from SettingsPage)
  const sections = visibleSections
    ? SETTINGS_SECTIONS.filter((s) => visibleSections.includes(s.id))
    : SETTINGS_SECTIONS

  return (
    <nav className="flex flex-col gap-0.5 w-full">
      {sections.map((section) => {
        const Icon    = ICON_MAP[section.icon] || User
        const isActive = activeSection === section.id

        return (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
              transition-all duration-150 text-left w-full
              ${isActive
                ? 'bg-teal-50 text-teal-700 ring-1 ring-teal-200'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
          >
            <Icon
              size={16}
              className={isActive ? 'text-teal-600' : 'text-gray-400'}
            />
            {section.label}
          </button>
        )
      })}
    </nav>
  )
}
