import React from 'react'
import { useContactsStore }                     from '../../stores/contactsStore.js'
import { CONTACT_TYPES, TYPE_COLORS }           from '../../lib/contactsData.js'

export function ContactsSummaryBar({ contacts = [] }) {
  const { typeFilter, setTypeFilter } = useContactsStore()

  const total  = contacts.length
  const active = contacts.filter((c) => c.status === 'Active').length

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
      {/* Total */}
      <StatPill
        label="All Contacts"
        value={total}
        sub={`${active} active`}
        active={typeFilter === 'All'}
        onClick={() => setTypeFilter('All')}
        colorClass="bg-gray-900 text-white"
      />

      {/* Per-type pills */}
      {CONTACT_TYPES.map((type) => {
        const count = contacts.filter((c) => c.type === type).length
        const tc = TYPE_COLORS[type] || 'bg-gray-100 text-gray-600'
        // derive dot color from tc string
        const dotColor = tc.includes('teal') ? 'bg-teal-500'
          : tc.includes('blue') ? 'bg-blue-500'
          : tc.includes('purple') ? 'bg-purple-500'
          : 'bg-gray-400'

        return (
          <StatPill
            key={type}
            label={type}
            value={count}
            sub={`${Math.round((count / (total || 1)) * 100)}%`}
            active={typeFilter === type}
            onClick={() => setTypeFilter(typeFilter === type ? 'All' : type)}
            dotColor={dotColor}
          />
        )
      })}
    </div>
  )
}

function StatPill({ label, value, sub, active, onClick, colorClass, dotColor }) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl px-4 py-3 transition-all duration-200 border
        ${active
          ? 'bg-teal-500 text-white border-teal-500 shadow-glow-teal'
          : 'bg-white border-gray-100 shadow-card hover:shadow-card-md hover:-translate-y-0.5'
        }`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {dotColor && (
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
        )}
        <p className={`text-[10px] font-semibold uppercase tracking-wider
          ${active ? 'text-teal-100' : 'text-gray-500'}`}>
          {label}
        </p>
      </div>
      <p className={`font-display font-bold text-lg leading-tight
        ${active ? 'text-white' : 'text-gray-900'}`}>
        {value}
      </p>
      <p className={`text-[10px] mt-0.5 ${active ? 'text-teal-100' : 'text-gray-400'}`}>
        {sub}
      </p>
    </button>
  )
}
