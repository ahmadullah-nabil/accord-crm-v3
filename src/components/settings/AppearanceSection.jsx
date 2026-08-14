// ─── AppearanceSection ────────────────────────────────────────────────────────
//
// step063. Rebuilt on the new `SettingsBlock` / `ChoiceCard` / `SettingsGroup`
// primitives. Every control, the preview-on-change behaviour, the unmount
// rollback and the save path are UNCHANGED — this batch changed what the
// controls look like, not what they do.
//
// THE THEME TILES NOW SHOW THE THEME. They used to be 64×40 swatches: white,
// `bg-gray-900`, and a gradient between them. Two problems with that.
//
// First, `bg-gray-900` is NOT dark — the neutral ramp inverts wholesale in dark
// mode, so the "Dark" swatch rendered near-WHITE once you were in dark mode.
// That is handover #4's invariant 3, the same trap that turned two modal scrims
// into page-lighteners. The tiles use fixed literals now, because a theme
// preview must show a theme that is NOT the one you are currently in — it is
// the one place in this codebase where a hardcoded colour is correct.
//
// Second, a flat rectangle is not a preview. Each tile now renders a miniature
// of the actual app — a rail, a title bar and two content lines, in that
// theme's own colours — and the System tile is split down the middle so it
// reads as "whichever your OS says" rather than as a third colour scheme.
//
// The accent swatches, font size and density keep their meaning; they are on
// the shared row/group primitives instead of three private button styles.

import React, { useState, useEffect, useRef } from 'react'
import { useAppearanceSettings, useUpdateAppearance } from '../../hooks/useSettings.js'
import { previewAppearance } from '../../hooks/useAppliedAppearance.js'
import { Skeleton } from '../ui/Skeleton.jsx'
import {
  SettingsBlock, SettingsGroup, ToggleRow, SaveBar, SectionDivider, ChoiceCard,
} from './SettingsShared.jsx'
import { ACCENT_COLORS } from '../../lib/settingsData.js'

// ── Theme preview tiles ───────────────────────────────────────────────────────
// Fixed hex on purpose — see the header. A preview of the theme you are not in
// cannot be drawn with variables that follow the theme you ARE in.
const LIGHT = { bg: '#ffffff', rail: '#f1f0ec', line: '#d8d6d0', text: '#3c3c3a' }
const DARK  = { bg: '#0f0f0e', rail: '#1a1a19', line: '#3a3a37', text: '#d4d4d0' }

function MiniApp({ c, className = '', style }) {
  return (
    <span className={`block h-[52px] w-full ${className}`} style={{ background: c.bg, ...style }}>
      <span className="flex h-full">
        <span className="w-[22%] h-full" style={{ background: c.rail }} />
        <span className="flex-1 p-1.5 flex flex-col gap-1">
          <span className="block h-1 w-2/3 rounded-sm" style={{ background: c.text }} />
          <span className="block h-1 w-full rounded-sm" style={{ background: c.line }} />
          <span className="block h-1 w-4/5 rounded-sm" style={{ background: c.line }} />
        </span>
      </span>
    </span>
  )
}

const THEMES = [
  { value: 'light',  label: 'Light'  },
  { value: 'dark',   label: 'Dark'   },
  { value: 'system', label: 'System' },
]

function ThemePreview({ value }) {
  if (value === 'light') return <MiniApp c={LIGHT} />
  if (value === 'dark')  return <MiniApp c={DARK} />
  // System: one tile, split, so it reads as "follows your OS" and not as a
  // third palette of its own.
  return (
    <span className="relative block h-[52px] w-full overflow-hidden">
      <MiniApp c={LIGHT} />
      <span className="absolute inset-y-0 right-0 w-1/2 overflow-hidden">
        <span className="block w-[200%] h-full">
          <MiniApp c={DARK} />
        </span>
      </span>
    </span>
  )
}

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

/** Segmented pill row — used for font size and density, which are both
 *  "pick one of three short labels" and were two different button styles. */
function PillRow({ options, value, onChange }) {
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-md border border-gray-200">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 rounded text-xs transition-colors duration-120
            ${value === o.value
              ? 'bg-gray-100 text-gray-900 font-medium'
              : 'text-gray-500 hover:text-gray-900'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function AppearanceSection() {
  const { data: appearance, isLoading } = useAppearanceSettings()
  const updateMutation = useUpdateAppearance()

  const [form, setForm]   = useState(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (appearance && !form) setForm({ ...appearance })
  }, [appearance]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Unsaved preview is scoped to this section ────────────────────────────
  // set()/toggle() apply changes to the live DOM immediately so the user can
  // see them. That preview is NOT persisted. If they navigate to another
  // Settings section — or anywhere else in the CRM — without saving, the
  // unmount cleanup below rolls the UI back to the last SAVED appearance.
  const savedRef = useRef(null)
  useEffect(() => { savedRef.current = appearance }, [appearance])
  useEffect(() => () => { if (savedRef.current) previewAppearance(savedRef.current) }, [])

  if (isLoading || !form) return <AppearanceSkeleton />

  const set = (key, value) => {
    const nextForm = { ...form, [key]: value }
    setForm(nextForm)
    setDirty(true)
    previewAppearance(nextForm)   // theme / accent / font size / density apply instantly
  }

  const toggle = (key) => (value) => set(key, value)

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
    <div>
      <SettingsBlock title="Theme" description="Choose your preferred colour mode.">
        <div className="grid grid-cols-3 gap-3 max-w-[420px]">
          {THEMES.map((t) => (
            <ChoiceCard
              key={t.value}
              label={t.label}
              selected={form.theme === t.value}
              onClick={() => set('theme', t.value)}
              preview={<ThemePreview value={t.value} />}
            />
          ))}
        </div>

        <SectionDivider label="Accent colour" />

        <div className="flex items-center gap-2 flex-wrap">
          {ACCENT_COLORS.map((ac) => (
            <button
              key={ac.value}
              type="button"
              onClick={() => set('accentColor', ac.value)}
              title={ac.label}
              aria-label={ac.label}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-120
                ${form.accentColor === ac.value
                  ? 'ring-2 ring-offset-2 ring-gray-900 ring-offset-white'
                  : 'hover:scale-110'}`}
              style={{ background: ac.hex }}
            />
          ))}
          <span className="text-[11px] text-gray-400 ml-1">
            {ACCENT_COLORS.find((a) => a.value === form.accentColor)?.label}
          </span>
        </div>
      </SettingsBlock>

      <SettingsBlock title="Layout" description="Information density and text size.">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <span className="text-[13px] text-gray-900">Font size</span>
            <PillRow options={FONT_SIZES} value={form.fontSize} onChange={(v) => set('fontSize', v)} />
          </div>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <span className="text-[13px] text-gray-900">Table density</span>
            <PillRow options={DENSITIES} value={form.density} onChange={(v) => set('density', v)} />
          </div>
        </div>
      </SettingsBlock>

      <SettingsBlock title="Behaviour" description="Motion and table interaction.">
        <SettingsGroup>
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
        </SettingsGroup>

        <SaveBar
          onSave={handleSave}
          onCancel={handleCancel}
          isPending={updateMutation.isPending}
          isDirty={dirty}
        />
      </SettingsBlock>
    </div>
  )
}

function AppearanceSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-3 w-48" />
      <div className="grid grid-cols-3 gap-3 max-w-[420px]">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[52px] rounded-md" />
        ))}
      </div>
      <Skeleton className="h-9 w-full rounded-md" />
    </div>
  )
}

export default AppearanceSection
