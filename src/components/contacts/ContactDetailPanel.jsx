// ─── ContactDetailPanel ───────────────────────────────────────────────────────
//
// step043. The one-long-scroll panel is now a tabbed record surface.
//
// WHAT CHANGED
// ────────────
// Before: a 400px panel with eight stacked <Section> blocks — Contact,
// Assignee, Meetings, Tasks, Files, Timeline, Tags, Notes — plus three private
// card components. Reaching the timeline meant scrolling past every field, and
// Tags and Notes only rendered when populated, so the panel changed height
// depending on which contact you opened.
//
// Now: fields in collapsible groups at the top, and everything RELATED to the
// contact (timeline, tasks, meetings, files, emails) is a tab. Same data, same
// hooks, same stores. The definitions come from ContactRecordContent, which
// ContactRecordPage also uses — so the two surfaces cannot disagree.
//
// WHAT IS NEW RATHER THAN MOVED
// ─────────────────────────────
// 1. An Emails tab. email_messages already held contact sends and the old panel
//    never showed them; the composer was write-only from here.
// 2. Expand → /contacts/:id.
// 3. Record navigation over the FILTERED list — see below.
// 4. Conversion now lands somewhere. See useConvertContactToLead.
//
// RECORD NAVIGATION WALKS THE FILTERED LIST
// ─────────────────────────────────────────
// applyFilters(allContacts), not allContacts. If the arrows walked the
// unfiltered set they would step into rows the user cannot see behind the
// panel, and "3 of 7" would contradict the seven rows on screen. Contacts keeps
// its filter state in the store and its rows in React Query, so the order has
// to be recomposed here rather than read from one place — leadsStore could hand
// over getFilteredLeads() because it owns both halves.
//
// PERMISSIONS ARE UNCHANGED — every action here was open to any authenticated
// user before this batch and still is. See the note in ContactRecordContent.

import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import { useContactsStore }            from '../../stores/contactsStore.js'
import { useContact, useContacts, useDeleteContact } from '../../hooks/useContacts.js'
import { useRoleByName }               from '../../hooks/useTeam.js'
import { Avatar }                      from '../ui/Avatar.jsx'
import { RecordShell }                 from '../ui/RecordShell.jsx'
import { EmailComposer }               from '../email/EmailComposer.jsx'
import {
  ContactFields, ContactBadges, ContactActions,
  useContactTabs, useConvertContactToLead,
} from './ContactRecordContent.jsx'

export function ContactDetailPanel() {
  const navigate = useNavigate()
  const {
    detailPanelOpen, selectedContactId,
    closeDetail, openDetail, openEditModal, applyFilters,
  } = useContactsStore()

  const { data: contact, isLoading } = useContact(
    detailPanelOpen ? selectedContactId : null
  )
  const deleteMutation = useDeleteContact()

  const tabs = useContactTabs(contact)
  const assigneeRole = useRoleByName(contact?.assignee)

  const [composerOpen, setComposerOpen] = React.useState(false)
  const { convert, converting } = useConvertContactToLead()

  // The visible, filtered order — see the note above on why this and not the
  // raw list. Reads the list cache; it is already populated because the panel
  // is only reachable from the table that filled it.
  const { data: allContacts = [] } = useContacts()
  const ordered = applyFilters(allContacts)

  const nav = useMemo(() => {
    const index = ordered.findIndex((c) => c.id === selectedContactId)
    if (index === -1) return null
    return {
      index,
      total: ordered.length,
      onPrev: () => index > 0 && openDetail(ordered[index - 1].id),
      onNext: () => index < ordered.length - 1 && openDetail(ordered[index + 1].id),
    }
  }, [ordered, selectedContactId, openDetail])

  const handleConvert = () =>
    convert(contact, (newLead) => {
      closeDetail()
      navigate(`/leads/${newLead.id}`)
    })

  const handleDelete = () => {
    if (!contact) return
    if (confirm(`Delete contact "${contact.name}"?`)) {
      deleteMutation.mutate(contact.id, { onSuccess: closeDetail })
    }
  }

  const subtitle = contact
    ? [contact.designation, contact.company].filter(Boolean).join(' · ')
    : null

  return (
    <>
      <RecordShell
        variant="panel"
        open={detailPanelOpen}
        onClose={closeDetail}
        // Deep-linkable full record. Closing the panel first is this caller's
        // job; ContactRecordPage is a different route and does not need to.
        onExpand={contact ? () => { closeDetail(); navigate(`/contacts/${contact.id}`) } : undefined}
        // The panel opens on a row click, so the record is usually already in
        // the list cache and this never flashes. It matters on a slow fetch.
        isLoading={isLoading && !contact}
        avatar={contact ? <Avatar name={contact.name} src={contact.avatar} size="md" /> : null}
        title={contact?.name ?? 'Loading…'}
        subtitle={subtitle}
        badges={contact ? <ContactBadges contact={contact} /> : null}
        nav={nav}
        actions={
          <ContactActions
            contact={contact}
            converting={converting}
            onEmail={() => setComposerOpen(true)}
            onConvert={handleConvert}
            onEdit={() => openEditModal(contact.id)}
            onDelete={handleDelete}
          />
        }
        fields={<ContactFields contact={contact} assigneeRole={assigneeRole} />}
        tabs={tabs}
      />

      <EmailComposer
        open={composerOpen && Boolean(contact)}
        onClose={() => setComposerOpen(false)}
        record={contact}
        relatedType="contact"
      />
    </>
  )
}

export default ContactDetailPanel
