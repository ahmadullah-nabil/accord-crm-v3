import React, { useState, useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import { useAppearanceSettings, useUpdateAppearance } from '../../hooks/useSettings.js'
import { previewAppearance } from '../../hooks/useAppliedAppearance.js'
import { Skeleton } from '../ui/Skeleton.jsx'
import {
  SettingCard, ToggleRow, SaveBar, SectionDivider,
} from './SettingsShared.jsx'
import { ACCENT_COLORS } from '../../lib/settingsData.js'

const THEMES = [
  { value: 'light',  label: 'Light',  preview: 'bg-white border-2'   },
  { value: 'dark',   label: 'Dark',   preview: 'bg-gray-900 border-2' },
  { value: 'system', label: 'System', preview: 'bg-gradient-to-br from-white to-gray-900 border-2' },
]

const FONT_SIZES = [
  { value: 'small',  label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large',  label: 'Large' },
]

const DENSITIES = [
  { value: 'compact',     label: 'Compact' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'spacious',    label: 'Spacious' },
]

export function AppearanceSection() {
  const { data: appearance, isLoading } = useAppearanceSettings()
  const updateMutation = useUpdateAppearance()

  const [form, setForm]   = useState(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (appearance && !form) setForm({ ...appearance })
  }, [appearance])

  // ── Unsaved preview is scoped to this section ────────────────────────────
  // set()/toggle() apply changes to the live DOM immediately so the user can
  // see them. That preview is NOT persisted. If they navigate to another
  // Settings section — or anywhere else in the CRM — without saving, the
  // unmount cleanup below rolls the UI back to the last SAVED appearance.
  //
  // Refs rather than state: the cleanup runs once on unmount and must read the
  // latest values, not the ones captured when the effect was first created.
  const savedRef = useRef(null)
  const dirtyRef = useRef(false)

  useEffect(() => { savedRef.current = appearance ?? null }, [appearance])
  useEffect(() => { dirtyRef.current = dirty }, [dirty])

  useEffect(() => () => {
    // Only revert when there is an unsaved preview. After a successful save,
    // dirty is false and the saved appearance is already the live one.
    if (dirtyRef.current && savedRef.current) {
      previewAppearance(savedRef.current)
    }
  }, [])

  // NOTE: every hook above runs before this early return, so hook order is
  // stable across the loading and loaded renders.
  if (isLoading || !form) return <AppearanceSkeleton />

  const set = (field, value) => {
    setForm((f) => {
      const next = { ...f, [field]: value }
      previewAppearance(next)   // theme / accent / font size / density apply instantly
      return next
    })
    setDirty(true)
  }

  const toggle = (field) => (val) => {
    setForm((f) => {
      const next = { ...f, [field]: val }
      previewAppearance(next)   // apply instantly — no save, no reload
      return next
    })
    setDirty(true)
  }

  const handleSave = async () => {
    await updateMutation.mutateAsync(form)
    setDirty(false)
  }

  const handleCancel = () => {
    setForm({ ...appearance })
    previewAppearance(appearance)   // roll the live UI back to what is saved
    setDirty(false)
  }

  return (
    <div className="space-y-4">
      {/* Theme */}
      <SettingCard
        title="Theme"
        description="Choose your preferred color mode."
      >
        <div className="flex gap-3 flex-wrap">
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => set('theme', t.value)}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-150
                ${form.theme === t.value
                  ? 'ring-2 ring-teal-500 bg-teal-50/40'
                  : 'hover:bg-gray-50 ring-1 ring-gray-200'
                }`}
            >
              <div className={`w-16 h-10 rounded-lg ${t.preview} ${form.theme === t.value ? 'border-teal-400' : 'border-gray-200'}`} />
              <span className="text-xs font-medium text-gray-700">{t.label}</span>
              {form.theme === t.value && (
                <span className="flex items-center gap-1 text-[10px] text-teal-600 font-semibold">
                  <Check size={10} /> Active
                </span>
              )}
            </button>
          ))}
        </div>

        <SectionDivider label="Accent Color" />

        <div className="flex items-center gap-3 flex-wrap">
          {ACCENT_COLORS.map((ac) => (
            <button
              key={ac.value}
              type="button"
              onClick={() => set('accentColor', ac.value)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all duration-150
                ${form.accentColor === ac.value
                  ? 'border-gray-300 bg-gray-50 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300'
                }`}
            >
              <span
                className="w-4 h-4 rounded-full flex-shrink-0 ring-2 ring-white shadow-sm"
                style={{ background: ac.hex }}
              />
              {ac.label}
              {form.accentColor === ac.value && (
                <Check size={11} className="text-gray-700" />
              )}
            </button>
          ))}
        </div>

        <SaveBar
          onSave={handleSave}
          onCancel={handleCancel}
          isPending={updateMutation.isPending}
          isDirty={dirty}
        />
      </SettingCard>

      {/* Density & Font */}
      <SettingCard
        title="Layout & Typography"
        description="Adjust information density and text size."
      >
        <div className="space-y-4">
          <div>
            <p className="label-base">Font Size</p>
            <div className="flex gap-2">
              {FONT_SIZES.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => set('fontSize', f.value)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 border
                    ${form.fontSize === f.value
                      ? 'bg-teal-50 border-teal-300 text-teal-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="label-base">Table Density</p>
            <div className="flex gap-2">
              {DENSITIES.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => set('density', d.value)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 border
                    ${form.density === d.value
                      ? 'bg-teal-50 border-teal-300 text-teal-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <SectionDivider label="Behaviour" />

        <ToggleRow
          label="Animations"
          description="Enable transition animations throughout the app"
          checked={form.animations}
          onChange={toggle('animations')}
        />
        <ToggleRow
          label="Table row hover highlight"
          description="Highlight rows on hover in all data tables"
          checked={form.tableRowHover}
          onChange={toggle('tableRowHover')}
        />

        <SaveBar
          onSave={handleSave}
          onCancel={handleCancel}
          isPending={updateMutation.isPending}
          isDirty={dirty}
        />
      </SettingCard>
    </div>
  )
}

function AppearanceSkeleton() {
  return (
    <div className="card p-6 space-y-5">
      <Skeleton className="h-4 w-20 mb-1" />
      <Skeleton className="h-3 w-48 mb-5" />
      <div className="flex gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="w-24 h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-10 w-full rounded-xl" />
    </div>
  )
}
