import React from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
      <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
        <AlertTriangle size={28} className="text-red-500" />
      </div>
      <h2 className="font-display text-3xl font-700 text-gray-900 mb-2">404</h2>
      <p className="text-base font-medium text-gray-700 mb-1">Page not found</p>
      <p className="text-sm text-gray-500 mb-6">The page you're looking for doesn't exist.</p>
      <Link to="/dashboard" className="btn-primary">
        <ArrowLeft size={16} />
        Back to Dashboard
      </Link>
    </div>
  )
}

export default NotFoundPage
