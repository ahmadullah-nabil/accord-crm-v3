import React, { useState, useEffect } from 'react'
import { useNotificationSettings, useUpdateNotifications } from '../../hooks/useSettings.js'
import { Skeleton } from '../ui/Skeleton.jsx'
import {
  SettingCard, ToggleRow, SaveBar, SectionDivider, Field,
} from './SettingsShared.jsx'
import { DIGEST_FREQUENCIES } from '../../lib/settingsData.js'

export function NotificationsSection() {
  const { data: prefs, isLoading } = useNotificationSettings()
  const updateMutation = useUpdateNotifications()

  const [form, setForm]   = useState(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (prefs && !form) setForm({ ...prefs })
  }, [prefs])

  if (isLoading || !form) return <NotifSkeleton />

  const toggle = (field) => (val) => {
    setForm((f) => ({ ...f, [field]: val }))
    setDirty(true)
  }

  const setField = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
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
      {/* Email notifications */}
      <SettingCard
        title="Email Notifications"
        description="Choose which events trigger an email to your inbox."
      >
        <ToggleRow
          label="Lead assigned to me"
          description="When a lead is assigned to you by a manager"
          checked={form.emailOnLeadAssigned}
          onChange={toggle('emailOnLeadAssigned')}
        />
        <ToggleRow
          label="Deal won"
          description="When any deal in your team is marked as won"
          checked={form.emailOnDealWon}
          onChange={toggle('emailOnDealWon')}
        />
        <ToggleRow
          label="Task due today"
          description="Morning digest of tasks due today"
          checked={form.emailOnTaskDue}
          onChange={toggle('emailOnTaskDue')}
        />
        <ToggleRow
          label="Meeting reminder"
          description="30-minute reminder before any scheduled meeting"
          checked={form.emailOnMeetingReminder}
          onChange={toggle('emailOnMeetingReminder')}
        />
        <ToggleRow
          label="Team activity"
          description="Updates from teammates: new contacts, stage moves"
          checked={form.emailOnTeamActivity}
          onChange={toggle('emailOnTeamActivity')}
        />
        <ToggleRow
          label="System updates"
          description="Release notes, maintenance windows, and announcements"
          checked={form.emailOnSystemUpdate}
          onChange={toggle('emailOnSystemUpdate')}
        />

        <SectionDivider label="Digest frequency" />

        <Field label="Email digest frequency" hint="How often to batch non-urgent notifications into one email.">
          <select className="input-base" value={form.digestFrequency} onChange={setField('digestFrequency')}>
            {DIGEST_FREQUENCIES.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </Field>

        <SaveBar
          onSave={handleSave}
          onCancel={handleCancel}
          isPending={updateMutation.isPending}
          isDirty={dirty}
        />
      </SettingCard>

      {/* In-app / push notifications */}
      <SettingCard
        title="In-App Notifications"
        description="Control what appears in your notifications center."
      >
        <ToggleRow label="Lead activity"     description="New leads and stage changes" checked={form.pushLeads}     onChange={toggle('pushLeads')} />
        <ToggleRow label="Task reminders"    description="Overdue and upcoming tasks"  checked={form.pushTasks}     onChange={toggle('pushTasks')} />
        <ToggleRow label="Meeting alerts"    description="Upcoming and cancelled meetings" checked={form.pushMeetings} onChange={toggle('pushMeetings')} />
        <ToggleRow label="Deal updates"      description="Deals won, lost, or moved"   checked={form.pushDeals}     onChange={toggle('pushDeals')} />
        <ToggleRow label="System messages"   description="CRM updates and announcements" checked={form.pushSystem}  onChange={toggle('pushSystem')} />

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

function NotifSkeleton() {
  return (
    <div className="card p-6 space-y-4">
      <Skeleton className="h-4 w-40 mb-1" />
      <Skeleton className="h-3 w-72 mb-5" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-3 border-b border-gray-50">
          <div className="space-y-1.5"><Skeleton className="h-3.5 w-40" /><Skeleton className="h-3 w-60" /></div>
          <Skeleton className="w-9 h-5 rounded-full flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}
