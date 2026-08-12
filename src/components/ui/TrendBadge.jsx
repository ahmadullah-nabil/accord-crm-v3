import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export function TrendBadge({ value, suffix = '%', className = '', showIcon = true }) {
  const num = parseFloat(value)

  if (isNaN(num)) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium text-gray-500 ${className}`}>
        {showIcon && <Minus size={12} />}
        <span>—</span>
      </span>
    )
  }

  const isPositive = num > 0
  const isNeutral  = num === 0

  if (isNeutral) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium text-gray-500 ${className}`}>
        {showIcon && <Minus size={12} />}
        <span>0{suffix}</span>
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full
        ${isPositive
          ? 'text-emerald-700 bg-emerald-50'
          : 'text-red-700 bg-red-50'
        } ${className}`}
    >
      {showIcon && (
        isPositive
          ? <TrendingUp size={11} />
          : <TrendingDown size={11} />
      )}
      <span>{isPositive ? '+' : ''}{num}{suffix}</span>
    </span>
  )
}

export default TrendBadge
