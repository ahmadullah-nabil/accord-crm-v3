import React, { useState, useEffect } from 'react'
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'
import { useSecuritySettings, useUpdateSecurity, useChangePassword } from '../../hooks/useSettings.js'
import { Skeleton } from '../ui/Skeleton.jsx'
import {
  SettingCard, Field, ToggleRow, SaveBar, InfoRow, StoredPreferenceNote,
  SectionDivider, DangerCard,
} from './SettingsShared.jsx'
import { SESSION_TIMEOUTS } from '../../lib/settingsData.js'

export function SecuritySection() {
  const { data: security, isLoading } = useSecuritySettings()
  const updateMutation   = useUpdateSecurity()
  const passwordMutation = useChangePassword()

  const [form, setForm]       = useState(null)
  const [dirty, setDirty]     = useState(false)
  const [pwForm, setPwForm]   = useState({ current: '', next: '', confirm: '' })
  const [showPw, setShowPw]   = useState({ current: false, next: false, confirm: false })
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  useEffect(() => {
    if (security && !form) setForm({ ...security })
  }, [security])

  if (isLoading || !form) return <SecuritySkeleton />

  const toggle = (field) => (val) => {
    setForm((f) => ({ ...f, [field]: val }))
    setDirty(true)
  }

  const setSelect = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setDirty(true)
  }

  const handleSave = async () => {
    await updateMutation.mutateAsync(form)
    setDirty(false)
  }

  const handleCancelSettings = () => {
    setForm({ ...security })
    setDirty(false)
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setPwError('')
    setPwSuccess(false)

    if (!pwForm.current) { setPwError('Current password is required.'); return }
    if (!pwForm.next)    { setPwError('New password is required.'); return }
    if (pwForm.next.length < 8) { setPwError('Password must be at least 8 characters.'); return }
    if (pwForm.next !== pwForm.confirm) { setPwError('New passwords do not match.'); return }

    try {
      await passwordMutation.mutateAsync({
        currentPassword: pwForm.current,
        newPassword:     pwForm.next,
      })
      setPwSuccess(true)
      setPwForm({ current: '', next: '', confirm: '' })
      setTimeout(() => setPwSuccess(false), 3000)
    } catch (err) {
      setPwError(err.message || 'Failed to change password.')
    }
  }

  const toggleShow = (field) =>
    setShowPw((s) => ({ ...s, [field]: !s[field] }))

  return (
    <div className="space-y-4">
      {/* Security overview */}
      <SettingCard title="Security Overview">
        {/* Honest state: the account is protected by email + password today.
            The 2FA toggle below records an intent, it does not enable MFA, so
            this panel must not report the account as secured by it. */}
        <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 mb-4">
          <ShieldCheck size={24} className="text-teal-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Signed in with email &amp; password
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Managed by Supabase Auth. Two-factor authentication is not yet
              available on this workspace.
            </p>
          </div>
        </div>

        <InfoRow
          label="Last password change"
          value={form.lastPasswordChange || 'Not recorded yet'}
        />
        <InfoRow
          label="This device"
          value="Current session"
        />
      </SettingCard>

      {/* Access settings */}
      <SettingCard
        title="Access & Authentication"
        description="Your preferences for future account-security features."
      >
        <StoredPreferenceNote>
          The three settings below are <strong>saved to your profile but not yet
          enforced</strong>. They record how you want your account protected once
          multi-factor authentication and session policies are enabled for this
          workspace. Changing them does not currently alter how you sign in.
        </StoredPreferenceNote>

        <ToggleRow
          label="Two-factor authentication (planned)"
          description="Preference only — MFA is not active on this workspace yet"
          checked={form.twoFactorEnabled}
          onChange={toggle('twoFactorEnabled')}
        />
        <ToggleRow
          label="Login notification emails (planned)"
          description="Preference only — no email is sent on new device sign-in yet"
          checked={form.loginNotification}
          onChange={toggle('loginNotification')}
        />

        <SectionDivider label="Session" />

        <Field
          label="Preferred auto logout"
          hint="Saved as a preference. Session length is currently governed by Supabase Auth, not by this value."
        >
          <select className="input-base" value={form.sessionTimeout} onChange={setSelect('sessionTimeout')}>
            {SESSION_TIMEOUTS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>

        <SaveBar
          onSave={handleSave}
          onCancel={handleCancelSettings}
          isPending={updateMutation.isPending}
          isDirty={dirty}
        />
      </SettingCard>

      {/* Password change */}
      <SettingCard
        title="Change Password"
        description="Use a strong password with at least 8 characters."
      >
        <form onSubmit={handlePasswordChange} className="space-y-4">
          {(['current', 'next', 'confirm']).map((field) => {
            const labels = { current: 'Current Password', next: 'New Password', confirm: 'Confirm New Password' }
            return (
              <div key={field}>
                <label className="label-base">{labels[field]}</label>
                <div className="relative">
                  <input
                    type={showPw[field] ? 'text' : 'password'}
                    className="input-base pr-10"
                    value={pwForm[field]}
                    onChange={(e) => setPwForm((p) => ({ ...p, [field]: e.target.value }))}
                    placeholder="••••••••"
                    autoComplete={field === 'current' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    onClick={() => toggleShow(field)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPw[field] ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            )
          })}

          {pwError && (
            <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{pwError}</p>
          )}
          {pwSuccess && (
            <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2 font-medium">
              ✓ Password changed successfully.
            </p>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="btn-primary py-2 text-sm"
              disabled={passwordMutation.isPending}
            >
              {passwordMutation.isPending
                ? <><Loader2 size={14} className="animate-spin" /> Updating…</>
                : 'Update password'
              }
            </button>
          </div>
        </form>
      </SettingCard>

      {/* Danger zone */}
      <div className="space-y-3">
        <DangerCard
          title="Sign out of all devices"
          description="This will end all active sessions except your current one."
          buttonLabel="Sign out everywhere"
          onAction={() => window.alert('This would sign out all other sessions.')}
        />
        <DangerCard
          title="Delete account"
          description="Permanently delete your account and all associated data. This cannot be undone."
          buttonLabel="Delete account"
          onAction={() => window.alert('Account deletion would require confirmation via email.')}
        />
      </div>
    </div>
  )
}

function SecuritySkeleton() {
  return (
    <div className="card p-6 space-y-4">
      <Skeleton className="h-16 w-full rounded-xl mb-4" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-3 border-b border-gray-50">
          <div className="space-y-1.5"><Skeleton className="h-3.5 w-40" /><Skeleton className="h-3 w-56" /></div>
          <Skeleton className="w-9 h-5 rounded-full flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}
