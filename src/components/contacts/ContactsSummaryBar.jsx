// ─── ContactsSummaryBar ───────────────────────────────────────────────────────
//
// step036. Same filter behaviour, same counts, no cards.
//
// The component keeps its name and its props so ContactsPage's import does not
// change and the diff stays honest about what actually moved: the presentation,
// not the logic. It still reads typeFilter from the store and still toggles
// back to 'All' when you click the active chip.

import React from 'react'
import { useContactsStore }              from '../../stores/contactsStore.js'
import { CONTACT_TYPES, TYPE_COLORS }    from '../../lib/contactsData.js'
import { FacetChips }                    from '../ui/FacetChips.jsx'

// The old version derived a dot colour by substring-matching the Tailwind class
// string from TYPE_COLORS ('teal' → bg-teal-500, and so on). That silently fell
// back to grey for any type whose colour string did not contain one of three
// hardcoded words. Same approach kept — it is the only source of per-type
// colour that exists — but the fallback is now explicit rather than incidental.
function dotFor(type) {
  const tc = TYPE_COLORS[type] || ''
  if (tc.includes('teal'))   return 'bg-teal-500'
  if (tc.includes('blue'))   return 'bg-blue-500'
  if (tc.includes('purple')) return 'bg-purple-500'
  if (tc.includes('amber'))  return 'bg-amber-500'
  if (tc.includes('red'))    return 'bg-red-500'
  return 'bg-gray-300'
}

export function ContactsSummaryBar({ contacts = [] }) {
  const { typeFilter, setTypeFilter } = useContactsStore()

  const items = [
    { key: 'All', label: 'All', count: contacts.length },
    ...CONTACT_TYPES.map((type) => ({
      key:      type,
      label:    type,
      count:    contacts.filter((c) => c.type === type).length,
      dotClass: dotFor(type),
    })),
  ]

  return <FacetChips items={items} value={typeFilter} onChange={setTypeFilter} />
}

export default ContactsSummaryBar
