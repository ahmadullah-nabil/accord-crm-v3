import React from 'react'
import { Outlet } from 'react-router-dom'
import { Logo } from '../components/ui/Logo.jsx'

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-[#0f1923] to-gray-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-teal-600/8 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-teal-500/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Brand — official Accord Technologies Limited logo (white on dark),
            with the product name set beneath it as text. */}
        <div className="flex justify-center mb-8">
          <div className="flex flex-col items-center gap-3">
            <Logo on="dark" height={48} />
            <span className="font-display font-600 text-teal-400 text-xs uppercase tracking-[0.28em]">
              Accord CRM
            </span>
          </div>
        </div>

        {/* Auth card */}
        <div className="bg-white rounded-2xl shadow-card-lg overflow-hidden animate-fade-in">
          <Outlet />
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          © {new Date().getFullYear()} Accord Technologies Limited. Accord CRM — enterprise sales intelligence.
        </p>
      </div>
    </div>
  )
}

export default AuthLayout
