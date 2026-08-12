import React from 'react'

const variants = {
  default:  'bg-gray-100 text-gray-700',
  primary:  'bg-teal-50 text-teal-700',
  success:  'bg-emerald-50 text-emerald-700',
  warning:  'bg-amber-50 text-amber-700',
  danger:   'bg-red-50 text-red-700',
  info:     'bg-blue-50 text-blue-700',
  purple:   'bg-purple-50 text-purple-700',

  // Role badges
  Admin:     'bg-purple-50 text-purple-700',
  AGM:       'bg-blue-50 text-blue-700',
  Manager:   'bg-teal-50 text-teal-700',
  Executive: 'bg-gray-100 text-gray-600',

  // Lead stage badges
  New:         'bg-blue-50 text-blue-700',
  Contacted:   'bg-indigo-50 text-indigo-700',
  Qualified:   'bg-teal-50 text-teal-700',
  Proposal:    'bg-amber-50 text-amber-700',
  Negotiation: 'bg-orange-50 text-orange-700',
  Won:         'bg-emerald-50 text-emerald-700',
  Lost:        'bg-red-50 text-red-700',
}

export function Badge({ children, variant = 'default', className = '', dot = false }) {
  const colorClass = variants[variant] || variants.default

  return (
    <span className={`badge ${colorClass} ${className}`}>
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${getDotColor(variant)}`} />
      )}
      {children}
    </span>
  )
}

function getDotColor(variant) {
  const map = {
    default:  'bg-gray-500',
    primary:  'bg-teal-500',
    success:  'bg-emerald-500',
    warning:  'bg-amber-500',
    danger:   'bg-red-500',
    info:     'bg-blue-500',
    Won:      'bg-emerald-500',
    Lost:     'bg-red-500',
    New:      'bg-blue-500',
  }
  return map[variant] || 'bg-gray-500'
}

export default Badge
