import React from 'react'

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-11 h-11 text-base',
  xl: 'w-14 h-14 text-lg',
  '2xl': 'w-20 h-20 text-2xl',
}

const colorPalette = [
  'bg-teal-500',
  'bg-blue-500',
  'bg-purple-500',
  'bg-amber-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-orange-500',
]

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?'
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function getColor(name = '') {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colorPalette[Math.abs(hash) % colorPalette.length]
}

export function Avatar({ src, name = '', size = 'md', className = '', status = null }) {
  const sizeClass  = sizeClasses[size] || sizeClasses.md
  const initials   = getInitials(name)
  const colorClass = getColor(name)

  const statusColors = {
    online:  'bg-emerald-400',
    away:    'bg-amber-400',
    busy:    'bg-red-400',
    offline: 'bg-gray-400',
  }

  return (
    <div className={`relative inline-flex flex-shrink-0 ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${sizeClass} rounded-full object-cover ring-2 ring-white`}
        />
      ) : (
        <div
          className={`${sizeClass} ${colorClass} rounded-full flex items-center justify-center text-white font-semibold ring-2 ring-white select-none`}
        >
          {initials}
        </div>
      )}
      {status && (
        <span
          className={`absolute bottom-0 right-0 block w-2.5 h-2.5 rounded-full ring-2 ring-white ${statusColors[status] || 'bg-gray-400'}`}
        />
      )}
    </div>
  )
}

export default Avatar
