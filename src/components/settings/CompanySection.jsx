import React, { useState, useEffect } from 'react'
import { useCompanySettings, useUpdateCompany } from '../../hooks/useSettings.js'
import { Skeleton } from '../ui/Skeleton.jsx'
import {
  SettingCard, Field, FieldGrid, SaveBar,
} from './SettingsShared.jsx'
import {
  CURRENCIES, FISCAL_YEARS, INDUSTRY_OPTIONS, COMPANY_SIZES,
} from '../../lib/settingsData.js'

export function CompanySection() {
  const { data: company, isLoading } = useCompanySettings()
  const updateMutation = useUpdateCompany()

  const [form, setForm]   = useState(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (company && !form) setForm({ ...company })
  }, [company])

  if (isLoading || !form) return <CompanySkeleton />

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setDirty(true)
  }

  const handleSave = async () => {
    await updateMutation.mutateAsync(form)
    setDirty(false)
  }

  const handleCancel = () => {
    setForm({ ...company })
    setDirty(false)
  }

  return (
    <div className="space-y-4">
      <SettingCard
        title="Company Details"
        description="Information about your organisation shown in exports, invoices, and reports."
      >
        <FieldGrid cols={2}>
          <Field label="Company Name" required>
            <input className="input-base" value={form.name} onChange={set('name')} placeholder="Accord Technologies" />
          </Field>
          <Field label="Website">
            <input className="input-base" value={form.website} onChange={set('website')} placeholder="accord.io" />
          </Field>
          <Field label="Industry">
            <select className="input-base" value={form.industry} onChange={set('industry')}>
              {INDUSTRY_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Company Size">
            <select className="input-base" value={form.size} onChange={set('size')}>
              {COMPANY_SIZES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Phone">
            <input type="tel" className="input-base" value={form.phone} onChange={set('phone')} placeholder="+880 2-0000-0000" />
          </Field>
          <Field label="Tax / VAT ID">
            <input className="input-base" value={form.taxId} onChange={set('taxId')} placeholder="Optional" />
          </Field>
        </FieldGrid>

        <div className="mt-4">
          <Field label="Address">
            <input className="input-base" value={form.address} onChange={set('address')} placeholder="City, Country" />
          </Field>
        </div>

        <SaveBar
          onSave={handleSave}
          onCancel={handleCancel}
          isPending={updateMutation.isPending}
          isDirty={dirty}
        />
      </SettingCard>

      <SettingCard
        title="Financial Settings"
        description="Default currency and fiscal year configuration."
      >
        <FieldGrid cols={2}>
          <Field label="Default Currency">
            <select className="input-base" value={form.currency} onChange={set('currency')}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Fiscal Year Start">
            <select className="input-base" value={form.fiscalYear} onChange={set('fiscalYear')}>
              {FISCAL_YEARS.map((m) => <option key={m}>{m}</option>)}
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
    </div>
  )
}

function CompanySkeleton() {
  return (
    <div className="card p-6 space-y-4">
      <Skeleton className="h-4 w-36 mb-1" />
      <Skeleton className="h-3 w-64 mb-5" />
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1.5"><Skeleton className="h-3 w-24" /><Skeleton className="h-10 w-full rounded-xl" /></div>
        ))}
      </div>
    </div>
  )
}
