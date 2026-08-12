import React from 'react'

const sizeClasses = {
  xs: 'w-3 h-3 border',
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-[3px]',
  xl: 'w-12 h-12 border-4',
}

export function Spinner({ size = 'md', className = '', color = 'teal' }) {
  const sizeClass = sizeClasses[size] || sizeClasses.md

  const colorMap = {
    teal:  'border-teal-200 border-t-teal-500',
    white: 'border-white/30 border-t-white',
    gray:  'border-gray-200 border-t-gray-500',
  }

  return (
    <div
      className={`${sizeClass} ${colorMap[color] || colorMap.teal} rounded-full animate-spin ${className}`}
      role="status"
      aria-label="Loading"
    />
  )
}

export function PageSpinner() {
  return (
    <div className="flex h-full min-h-[200px] w-full items-center justify-center">
      <Spinner size="lg" />
    </div>
  )
}

export default Spinner
