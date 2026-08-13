// ─── ContactRecordPage ────────────────────────────────────────────────────────
//
// step043. /contacts/:id — the second real record route, after /leads/:id.
//
// COLD ARRIVAL IS EASIER HERE THAN IT WAS FOR LEADS, AND THE REASON MATTERS
// ────────────────────────────────────────────────────────────────────────
// LeadRecordPage reads leadsStore, a Zustand array that has to initialize()
// before it can find anything, so it needs the three-way test
//
//     if (!lead && !isLoading && leads.length > 0) return <NotFound />
//
// to avoid flashing "not found" while the store fills. Contacts is already on
// React Query: useContact(id) fetches THAT ONE ROW, so a pasted link in a fresh
// tab is an ordinary query with an ordinary loading state. There is no window
// in which the record is absent but not yet known to be absent.
//
// So "not found" is not inferred here — it is READ. getContactById uses
// .single(), PostgREST returns PGRST116 for zero rows, and supabaseErrors
// classifies that as error.isNotFound. A deleted id and an id behind RLS
// therefore give different, accurate answers instead of one guess covering
// both. error.isUnauthorized is handled separately for the same reason: a
// contact you cannot see is not a contact that does not exist, and telling a
// user the record is gone when it is someone else's is a support ticket.
//
// MODALS ARE MOUNTED HERE
// ───────────────────────
// Edit opens ContactFormModal; the tabs open the meeting and task modals. A
// modal whose page never mounted it simply does not appear — which is exactly
// how the old conversion flow failed silently. Five, matching what ContactsPage
// mounts minus the panel.

import React, { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Users, RefreshCw } from 'lucide-react'

import { useContactsStore } from '../stores/contactsStore.js'
import { useContact, useContacts, useDeleteContact } from '../hooks/useContacts.js'
import { useRoleByName }    from '../hooks/useTeam.js'
import { Avatar }           from '../components/ui/Avatar.jsx'
import { RecordShell }      from '../components/ui/RecordShell.jsx'
import { UnauthorizedState } from '../components/ui/UnauthorizedState.jsx'
import { EmailComposer }    from '../components/email/EmailComposer.jsx'
import {
  ContactFields, ContactBadges, ContactActions,
  useContactTabs, useConvertContactToLead,
} from '../components/contacts/ContactRecordContent.jsx'

// Opened from the header and from the tabs on this page.
import { ContactFormModal }   from '../components/contacts/ContactFormModal.jsx'
import { MeetingFormModal }   from '../components/meetings/MeetingFormModal.jsx'
import { MeetingDetailPanel } from '../components/meetings/MeetingDetailPanel.jsx'
import { TaskFormModal }      from '../components/tasks/TaskFormModal.jsx'
import { TaskDetailPanel }    from '../components/tasks/TaskDetailPanel.jsx'

export function ContactRecordPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { openEditModal, applyFilters } = useContactsStore()
  const { data: contact, isLoading, isError, error, refetch } = useContact(id)
  const deleteMutation = useDeleteContact()

  const tabs = useContactTabs(contact)
  const assigneeRole = useRoleByName(contact?.assignee)

  const [composerOpen, setComposerOpen] = React.useState(false)
  const { convert, converting } = useConvertContactToLead()

  // Same filtered ordering the list and the panel use, so walking records from
  // here matches what the user last saw on /contacts. On a cold arrival the
  // list query is still in flight, so `ordered` is empty and nav is null — the
  // arrows appear once it lands rather than pointing at a one-item universe.
  const { data: allContacts = [] } = useContacts()
  const ordered = applyFilters(allContacts)

  const nav = useMemo(() => {
    const index = ordered.findIndex((c) => c.id === id)
    if (index === -1) return null
    return {
      index,
      total: ordered.length,
      onPrev: () => index > 0 && navigate(`/contacts/${ordered[index - 1].id}`),
      onNext: () => index < ordered.length - 1 && navigate(`/contacts/${ordered[index + 1].id}`),
    }
  }, [ordered, id, navigate])

  const handleConvert = () =>
    convert(contact, (newLead) => navigate(`/leads/${newLead.id}`))

  const handleDelete = () => {
    if (!contact) return
    if (confirm(`Delete contact "${contact.name}"?`)) {
      // The record no longer exists, so this route no longer resolves.
      deleteMutation.mutate(contact.id, { onSuccess: () => navigate('/contacts') })
    }
  }

  // ── Not yours ─────────────────────────────────────────────────────────────
  if (isError && error?.isUnauthorized) {
    return <UnauthorizedState message={error.message} onRetry={refetch} />
  }

  // ── Genuinely absent — read from PGRST116, not inferred ────────────────────
  if (isError && error?.isNotFound) {
    return (
      <CentredState
        title="Contact not found"
        detail="It may have been deleted, or you may not have access to it."
        actionLabel="Back to contacts"
        onAction={() => navigate('/contacts')}
      />
    )
  }

  // ── Load failed for some other reason ─────────────────────────────────────
  if (isError) {
    return (
      <CentredState
        title="Could not load contact"
        detail={error?.message ?? 'Something went wrong. Try again.'}
        actionLabel="Retry"
        onAction={() => refetch()}
      />
    )
  }

  const subtitle = contact
    ? [contact.designation, contact.company].filter(Boolean).join(' · ')
    : null

  return (
    <>
      <RecordShell
        variant="page"
        breadcrumb="Contacts"
        onBack={() => navigate('/contacts')}
        isLoading={isLoading || !contact}
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

      <ContactFormModal />
      <MeetingFormModal />
      <MeetingDetailPanel />
      <TaskFormModal />
      <TaskDetailPanel />
    </>
  )
}

function CentredState({ title, detail, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-3">
      <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
        <Users size={18} className="text-red-500" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900 mb-0.5">{title}</p>
        <p className="text-xs text-gray-500 max-w-xs">{detail}</p>
      </div>
      <button onClick={onAction} className="btn-secondary">
        <RefreshCw size={13} /> {actionLabel}
      </button>
    </div>
  )
}

export default ContactRecordPage
