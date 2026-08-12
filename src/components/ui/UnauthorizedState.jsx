import React from 'react'
import { ShieldOff, RefreshCw } from 'lucide-react'

// Shown when an RLS policy blocks a data fetch.
// Keeps the same visual language as the existing error states in
// ContactsPage, TasksPage etc. (red icon + message + retry).
export function UnauthorizedState({ onRetry, message }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] text-center gap-4">
      <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center ring-1 ring-amber-200">
        <ShieldOff size={20} className="text-amber-500" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-800 mb-1">Access restricted</p>
        <p className="text-xs text-gray-500 max-w-xs">
          {message ?? 'You do not have permission to view these records. Contact your administrator.'}
        </p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary text-sm gap-1.5">
          <RefreshCw size={14} />
          Retry
        </button>
      )}
    </div>
  )
}
