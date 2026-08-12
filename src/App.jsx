import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import { AppLayout }   from './layouts/AppLayout.jsx'
import { AuthLayout }  from './layouts/AuthLayout.jsx'
import { ProtectedRoute } from './router/ProtectedRoute.jsx'
import { GuestRoute }     from './router/GuestRoute.jsx'
import { DefaultRedirect } from './router/DefaultRedirect.jsx'

import { LoginPage }              from './pages/auth/LoginPage.jsx'
import { ForgotPasswordPage }      from './pages/auth/ForgotPasswordPage.jsx'
import { ResetPasswordPage }       from './pages/auth/ResetPasswordPage.jsx'
import { SignupPage }              from './pages/auth/SignupPage.jsx'
import { EmailVerificationPage }   from './pages/auth/EmailVerificationPage.jsx'

import { DashboardPage } from './pages/DashboardPage.jsx'
import { LeadsPage }     from './pages/LeadsPage.jsx'
import { ContactsPage }  from './pages/ContactsPage.jsx'
import { MeetingsPage }  from './pages/MeetingsPage.jsx'
import { TasksPage }     from './pages/TasksPage.jsx'
import { OpportunitiesPage } from './pages/OpportunitiesPage.jsx'
import { AnalyticsPage }       from './pages/AnalyticsPage.jsx'
import { SettingsPage }         from './pages/SettingsPage.jsx'
import { UsersPage }            from './pages/UsersPage.jsx'
import { NotificationsPage }    from './pages/NotificationsPage.jsx'
import { NotFoundPage }         from './pages/NotFoundPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root redirect — honours Settings → Preferences → default module */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DefaultRedirect />
            </ProtectedRoute>
          }
        />

        {/* Auth routes — redirect to dashboard if logged in */}
        <Route
          element={
            <GuestRoute>
              <AuthLayout />
            </GuestRoute>
          }
        >
          <Route path="/login"           element={<LoginPage />} />
          <Route path="/signup"          element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password"  element={<ResetPasswordPage />} />
          <Route path="/verify-email"    element={<EmailVerificationPage />} />
        </Route>

        {/* Protected app routes */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/leads"     element={<LeadsPage />} />
          <Route path="/contacts"  element={<ContactsPage />} />
          <Route path="/meetings"  element={<MeetingsPage />} />
          <Route path="/tasks"     element={<TasksPage />} />
          <Route path="/opportunities" element={<OpportunitiesPage />} />
          <Route path="/analytics"      element={<AnalyticsPage />} />
          <Route path="/notifications"  element={<NotificationsPage />} />

          {/* Admin-only routes — redirect to /dashboard for non-admins */}
          <Route
            path="/settings"
            element={
              <ProtectedRoute allowedRoles={['Admin']}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute allowedRoles={['Admin']}>
                <UsersPage />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
