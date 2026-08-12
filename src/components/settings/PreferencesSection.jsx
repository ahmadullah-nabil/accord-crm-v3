import React, { useState, useEffect } from 'react'
import { usePreferencesSettings, useUpdatePreferences } from '../../hooks/useSettings.js'
import { Skeleton } from '../ui/Skeleton.jsx'
import {
  SettingCard, Field, FieldGrid, ToggleRow, SaveBar, SectionDivider,
} from './SettingsShared.jsx'
import {
  MODULE_OPTIONS, ITEMS_PER_PAGE_OPTIONS, EXPORT_FORMATS,
} from '../../lib/settingsData.js'

const LEAD_VIEWS    = [{ value: 'table', label: 'Table' }, { value: 'kanban', label: 'Kanban' }]
const TASK_SORTS    = [
  { value: 'dueDate',   label: 'Due Date'   },
  { value: 'priority',  label: 'Priority'   },
  { value: 'createdAt', label: 'Date Created'},
  { value: 'title',     label: 'Title'      },
]

export function PreferencesSection() {
  const { data: prefs, isLoading } = usePreferencesSettings()
  const updateMutation = useUpdatePreferences()

  const [form, setForm]   = useState(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (prefs && !form) setForm({ ...prefs })
  }, [prefs])

  if (isLoading || !form) return <PrefSkeleton />

  const set = (field) => (e) => {
    const val = e.target.value
    setForm((f) => ({ ...f, [field]: val }))
    setDirty(true)
  }

  const setNum = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: Number(e.target.value) }))
    setDirty(true)
  }

  const toggle = (field) => (val) => {
    setForm((f) => ({ ...f, [field]: val }))
    setDirty(true)
  }

  const handleSave = async () => {
    await updateMutation.mutateAsync(form)
    setDirty(false)
  }

  const handleCancel = () => {
    setForm({ ...prefs })
    setDirty(false)
  }

  return (
    <div className="space-y-4">
      {/* Navigation defaults */}
      <SettingCard
        title="Navigation Defaults"
        description="Configure what you see when you first open the CRM."
      >
        <Field label="Default module on login" hint="The page you land on after signing in.">
          <select className="input-base" value={form.defaultModule} onChange={set('defaultModule')}>
            {MODULE_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </Field>

        <SectionDivider label="Module defaults" />

        <FieldGrid cols={2}>
          <Field label="Leads default view">
            <select className="input-base" value={form.leadsDefaultView} onChange={set('leadsDefaultView')}>
              {LEAD_VIEWS.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Tasks default sort">
            <select className="input-base" value={form.taskDefaultSort} onChange={set('taskDefaultSort')}>
              {TASK_SORTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </Field>
        </FieldGrid>

        <SaveBar
          onSave={handleSave}
          onCancel={handleCancel}
          isPending={updateMutation.isPending}
          isDirty={dirty}
        />
      </SettingCard>

      {/* Data & exports */}
      <SettingCard
        title="Data & Exports"
        description="Control pagination limits and default export format."
      >
        <FieldGrid cols={2}>
          <Field label="Table rows per page" hint="Applied to all data tables.">
            <select className="input-base" value={form.itemsPerPage} onChange={setNum('itemsPerPage')}>
              {ITEMS_PER_PAGE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} rows</option>
              ))}
            </select>
          </Field>
          <Field label="Default export format">
            <select className="input-base" value={form.exportFormat} onChange={set('exportFormat')}>
              {EXPORT_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </Field>
        </FieldGrid>

        <SaveBar
          onSave={handleSave}
          onCancel={handleCancel}
          isPending={updateMutation.isPending}
          isDirty={dirty}
        />
      </SettingCard>

      {/* UI behaviour */}
      <SettingCard
        title="UI Behaviour"
        description="Adjust how the application behaves during use."
      >
        <ToggleRow
          label="Show welcome banner"
          description="Display the getting-started card on the dashboard"
          checked={form.showWelcomeBanner}
          onChange={toggle('showWelcomeBanner')}
        />
        <ToggleRow
          label="Confirm before deleting"
          description="Show a confirmation dialog before any delete action"
          checked={form.confirmDelete}
          onChange={toggle('confirmDelete')}
        />
        <ToggleRow
          label="Auto-save drafts"
          description="Automatically save form progress while editing"
          checked={form.autoSaveDrafts}
          onChange={toggle('autoSaveDrafts')}
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

function PrefSkeleton() {
  return (
    <div className="card p-6 space-y-4">
      <Skeleton className="h-4 w-40 mb-1" />
      <Skeleton className="h-3 w-64 mb-4" />
      <Skeleton className="h-10 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-10 rounded-xl" />
      </div>
    </div>
  )
}
