// ─── ContactRecordContent ─────────────────────────────────────────────────────
//
// step043. What a contact IS, as data: its field groups, its tabs, its badges.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ THIS FILE EXISTS SO THE PANEL AND THE PAGE CANNOT DRIFT                 │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ ContactDetailPanel and ContactRecordPage both call these. Add a field    │
// │ here and it appears on both surfaces; add it to one component and you    │
// │ have two versions of a contact that disagree, which nobody notices       │
// │ because nobody opens both in the same minute.                            │
// └─────────────────────────────────────────────────────────────────────────┘
//
// relatedType CASING — THE THING THAT BITES
// ─────────────────────────────────────────
// Two different vocabularies are live in this schema and both are used below:
//
//   meetings.related_type / tasks.related_type  →  'Contact'   (capitalised)
//   attachments / email_messages                →  'contact'   (lowercase)
//
// useContactMeetings and useContactTasks filter on relatedType === 'Contact',
// so the prefills that CREATE those rows must write 'Contact' or the new row
// will not appear in the tab that created it. useAttachments and useSentEmails
// take lowercase. This is not a style choice to tidy up in passing — migration
// 025's crm_entity_type domain is all-lowercase and deliberately unattached,
// and reconciling the two is a decision someone has to take deliberately. See
// the landmine note in the handover.
//
// NOTES IS A FIELD, NOT A TAB. `contacts.notes` is a single TEXT column, not a
// notes table. An always-empty Notes tab to match a reference screenshot would
// be a click spent discovering there is nothing there.
//
// EMAILS is present because email_messages exists, but RLS scopes it to the
// caller's OWN sends. Two users working the same contact each see their own,
// which is correct mailbox behaviour and is stated on the tab so it is not read
// as missing data.
//
// PERMISSIONS ARE DELIBERATELY NOT INTRODUCED HERE
// ────────────────────────────────────────────────
// getContactPermissions() and useContactPermissions() both exist, and nothing
// in the app has ever called them: Edit, Delete, Schedule and Add task are open
// to every authenticated user on contacts today, on the table and on the panel
// alike. Gating them would be a real permissions change, and burying one in a
// UI batch is how a permissions change ships without anyone reviewing it as
// one. Behaviour is preserved exactly; `perms.canSchedule` is read below so the
// batch that does make the decision has one line to flip.

import React from 'react'
import { Link } from 'react-router-dom'
import {
  Mail, Phone, Globe, MapPin, Building2, Briefcase, Tag, Hash,
  User, FileText, Clock, Calendar, CheckSquare, Paperclip, Activity,
  Send, TrendingUp, Pencil, Trash2,
} from 'lucide-react'

import { useContactMeetings } from '../../hooks/useMeetings.js'
import { useContactTasks }    from '../../hooks/useTasks.js'
import { useAttachments }     from '../../hooks/useAttachments.js'
import { useSentEmails }      from '../../hooks/useEmail.js'
import { useQueryClient }     from '@tanstack/react-query'
import { useAuthStore }       from '../../stores/authStore.js'
import { convertContactToLead } from '../../services/leadsService.js'
import { useMeetingsStore }   from '../../stores/meetingsStore.js'
import { useTasksStore }      from '../../stores/tasksStore.js'
import { TYPE_COLORS, STATUS_COLORS } from '../../lib/contactsData.js'
import { Avatar }             from '../ui/Avatar.jsx'
import { FieldGroup, RecordField } from '../ui/FieldGroup.jsx'
import { RelatedList, EmptyBlock } from '../ui/RelatedList.jsx'
import { TimelinePanel }      from '../timeline/TimelinePanel.jsx'
import { AttachmentPanel }    from '../attachments/AttachmentPanel.jsx'

/** The label a related record should carry back to this contact. */
export const contactLabel = (c) =>
  `${c?.name ?? ''}${c?.company ? ' — ' + c.company : ''}`

// ── Badges ────────────────────────────────────────────────────────────────────

export function ContactBadges({ contact }) {
  if (!contact) return null
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`badge ${TYPE_COLORS[contact.type] || 'bg-gray-100 text-gray-600'}`}>
        {contact.type}
      </span>
      <span className={`badge ${STATUS_COLORS[contact.status] || 'bg-gray-100 text-gray-500'}`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0
          ${contact.status === 'Active' ? 'bg-emerald-500' : 'bg-red-400'}`} />
        {contact.status}
      </span>
    </div>
  )
}

// ── Field groups ──────────────────────────────────────────────────────────────

export function ContactFields({ contact, assigneeRole }) {
  if (!contact) return null

  return (
    <div>
      <FieldGroup title="Contact">
        <RecordField label="Email" icon={Mail} placeholder="No email">
          {contact.email
            ? <a href={`mailto:${contact.email}`} className="text-teal-700 hover:underline">{contact.email}</a>
            : null}
        </RecordField>
        <RecordField label="Phone" icon={Phone} placeholder="No phone">
          {contact.phone
            ? <a href={`tel:${contact.phone}`} className="text-teal-700 hover:underline">{contact.phone}</a>
            : null}
        </RecordField>
        {/* Stored bare ('acme.com'), so the scheme is added here — unchanged
            from the old panel, which did the same. */}
        <RecordField label="Website" icon={Globe} placeholder="No website">
          {contact.website
            ? (
              <a
                href={`https://${contact.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-700 hover:underline"
              >
                {contact.website}
              </a>
            )
            : null}
        </RecordField>
        <RecordField label="Address" icon={MapPin} placeholder="No address">
          {contact.address || null}
        </RecordField>
      </FieldGroup>

      <FieldGroup title="Company">
        <RecordField label="Company" icon={Building2} placeholder="No company">
          {contact.company || null}
        </RecordField>
        <RecordField label="Designation" icon={Briefcase} placeholder="No designation">
          {contact.designation || null}
        </RecordField>
        <RecordField label="Type" icon={Tag}>{contact.type || null}</RecordField>
        <RecordField label="Status" icon={Activity}>{contact.status || null}</RecordField>
      </FieldGroup>

      <FieldGroup title="Assignee">
        <RecordField label="Owner" icon={User} placeholder="Unassigned">
          {contact.assignee
            ? (
              <span className="flex items-center gap-1.5">
                <Avatar name={contact.assignee} size="xs" />
                <span>{contact.assignee}</span>
                {assigneeRole && <span className="text-gray-400">· {assigneeRole}</span>}
              </span>
            )
            : null}
        </RecordField>
      </FieldGroup>

      <FieldGroup title="Notes" defaultOpen={Boolean(contact.notes)}>
        <RecordField label="Notes" icon={FileText} placeholder="No notes">
          {contact.notes || null}
        </RecordField>
        <RecordField label="Tags" icon={Tag} placeholder="No tags">
          {contact.tags?.length
            ? (
              <span className="flex flex-wrap gap-1">
                {contact.tags.map((t) => (
                  <span key={t} className="badge bg-gray-100 text-gray-600">{t}</span>
                ))}
              </span>
            )
            : null}
        </RecordField>
      </FieldGroup>

      {/* Shut by default: a creation date and a UUID are looked up once a month
          and were costing a scroll on every open. */}
      <FieldGroup title="System" defaultOpen={false}>
        <RecordField label="Created" icon={Calendar}>{contact.createdAt || null}</RecordField>
        <RecordField label="Last activity" icon={Clock}>{contact.lastActivity || null}</RecordField>
        <RecordField label="Contact ID" icon={Hash} mono>
          <span className="text-xs text-gray-500 break-all">{contact.id}</span>
        </RecordField>
        {contact.linkedLeadId && (
          <RecordField label="Converted to" icon={TrendingUp}>
            {/* step042 gave leads a real route, so this is a link now rather
                than a dead badge saying a lead exists somewhere. */}
            <Link
              to={`/leads/${contact.linkedLeadId}`}
              className="badge bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors duration-120"
            >
              Lead
            </Link>
          </RecordField>
        )}
      </FieldGroup>
    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

/**
 * @param {object} contact
 * @param {object} [perms]  reserved — see the permissions note at the top
 * @returns {Array} RecordShell `tabs`
 */
export function useContactTabs(contact, perms = {}) {
  const contactId = contact?.id ?? null

  const { data: meetings = [], isLoading: meetingsLoading } = useContactMeetings(contactId)
  const { data: tasks = [],    isLoading: tasksLoading }    = useContactTasks(contactId)
  const { data: files = [] }                                = useAttachments('contact', contactId)
  const { data: emails = [] }                               = useSentEmails('contact', contactId)

  const { openAddModalWithPrefill: openMeeting, openDetail: openMeetingDetail } = useMeetingsStore()
  const { openAddModalWithPrefill: openTask,    openDetail: openTaskDetail }    = useTasksStore()

  if (!contact) return []

  // Open to everyone today. See the permissions note at the top of this file.
  const canSchedule = perms.canSchedule ?? true
  const label = contactLabel(contact)

  return [
    {
      key: 'timeline',
      label: 'Timeline',
      icon: Activity,
      render: () => (
        <TimelinePanel
          entityType="contact"
          entityId={contact.id}
          entityLabel={contact.name}
          // A converted contact and its lead share a history. Dropping these
          // two props would silently halve the timeline on exactly the records
          // that have the most of it.
          linkedEntityType={contact.linkedLeadId ? 'lead' : null}
          linkedEntityId={contact.linkedLeadId ?? null}
        />
      ),
    },
    {
      key: 'tasks',
      label: 'Tasks',
      icon: CheckSquare,
      count: tasks.length,
      render: () => (
        <RelatedList
          isLoading={tasksLoading}
          items={tasks}
          emptyLabel="No tasks yet"
          onAdd={canSchedule ? () => openTask({
            relatedType: 'Contact', relatedId: contact.id,   // capitalised — see top
            relatedLabel: label,
            title: `Follow-up: ${contact.name}`,
            assignee: contact.assignee ?? '',
          }) : null}
          addLabel="Add task"
          renderItem={(t) => (
            <button
              key={t.id}
              onClick={() => openTaskDetail(t.id)}
              className="w-full text-left px-2.5 py-2 rounded-lg border border-gray-100
                         hover:border-gray-200 hover:bg-gray-50 transition-colors duration-120"
            >
              <p className={`text-sm truncate
                ${t.status === 'Completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                {t.title}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {t.dueDate || 'No due date'} · {t.status}
              </p>
            </button>
          )}
        />
      ),
    },
    {
      key: 'meetings',
      label: 'Meetings',
      icon: Calendar,
      count: meetings.length,
      render: () => (
        <RelatedList
          isLoading={meetingsLoading}
          items={meetings}
          emptyLabel="No meetings scheduled"
          onAdd={canSchedule ? () => openMeeting({
            relatedType: 'Contact', relatedId: contact.id,   // capitalised — see top
            relatedLabel: label,
            title: `Meeting — ${contact.name}`,
            participants: contact.name ? [contact.name] : [],
          }) : null}
          addLabel="Schedule meeting"
          renderItem={(m) => (
            <button
              key={m.id}
              onClick={() => openMeetingDetail(m.id)}
              className="w-full text-left px-2.5 py-2 rounded-lg border border-gray-100
                         hover:border-gray-200 hover:bg-gray-50 transition-colors duration-120"
            >
              <p className="text-sm text-gray-900 truncate">{m.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {m.scheduledDate || 'Unscheduled'}
                {m.scheduledTime ? ` · ${m.scheduledTime}` : ''} · {m.status}
              </p>
            </button>
          )}
        />
      ),
    },
    {
      key: 'files',
      label: 'Files',
      icon: Paperclip,
      count: files.length,
      render: () => <AttachmentPanel relatedType="contact" relatedId={contact.id} compact />,
    },
    {
      key: 'emails',
      label: 'Emails',
      icon: Send,
      count: emails.length,
      render: () => (
        <div className="space-y-2">
          {/* Stated because it looks like missing data otherwise: RLS scopes
              email_messages to the caller's own sends. */}
          <p className="text-xs text-gray-400">
            Messages you sent to this contact. Other users see their own.
          </p>
          {emails.length === 0 ? (
            <EmptyBlock label="No emails sent yet" />
          ) : (
            emails.map((e) => (
              <div key={e.id} className="px-2.5 py-2 rounded-lg border border-gray-100">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-900 truncate flex-1">
                    {e.subject || '(no subject)'}
                  </p>
                  <span className={`badge flex-shrink-0
                    ${e.status === 'sent' ? 'bg-emerald-50 text-emerald-700'
                      : e.status === 'failed' ? 'bg-red-50 text-red-600'
                      : 'bg-gray-100 text-gray-500'}`}>
                    {e.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {(e.to ?? []).join(', ') || '—'}
                  {e.sentAt ? ` · ${String(e.sentAt).slice(0, 10)}` : ''}
                </p>
                {e.status === 'failed' && e.error && (
                  <p className="text-xs text-red-600 mt-0.5 break-words">{e.error}</p>
                )}
              </div>
            ))
          )}
        </div>
      ),
    },
  ]
}

// ── Header actions ────────────────────────────────────────────────────────────
//
// Shared for the same reason the fields are: the panel and the page show the
// same four affordances, and step042's leads pair duplicated ~60 lines of this
// markup across its two surfaces. Handlers are injected because they genuinely
// differ — the panel closes itself where the page navigates — but what the
// buttons ARE is defined once.

export function ContactActions({ contact, onEmail, onConvert, onEdit, onDelete, converting }) {
  if (!contact) return null

  return (
    <>
      {/* Disabled rather than hidden without an address, so the reason is
          visible instead of the button just being missing. */}
      <button
        onClick={onEmail}
        disabled={!contact.email}
        title={contact.email ? `Email ${contact.name}` : 'This contact has no email address'}
        className="p-1.5 rounded-md text-gray-400 hover:text-teal-600 hover:bg-teal-50
                   transition-colors duration-120 disabled:opacity-30
                   disabled:hover:bg-transparent disabled:hover:text-gray-400"
      >
        <Mail size={15} />
      </button>

      {!contact.linkedLeadId ? (
        <button
          onClick={onConvert}
          disabled={converting}
          title="Convert this contact to a lead"
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium
                     bg-teal-50 text-teal-700 hover:bg-teal-100
                     transition-colors duration-120 disabled:opacity-50"
        >
          <TrendingUp size={12} /> {converting ? 'Converting…' : 'Convert'}
        </button>
      ) : (
        <Link
          to={`/leads/${contact.linkedLeadId}`}
          title="Open the lead this contact was converted to"
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium
                     bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700
                     transition-colors duration-120"
        >
          <TrendingUp size={12} /> Lead
        </Link>
      )}

      <button
        onClick={onEdit}
        title="Edit contact"
        className="p-1.5 rounded-md text-gray-400 hover:text-teal-600 hover:bg-teal-50
                   transition-colors duration-120"
      >
        <Pencil size={15} />
      </button>
      <button
        onClick={onDelete}
        title="Delete contact"
        className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50
                   transition-colors duration-120"
      >
        <Trash2 size={15} />
      </button>
    </>
  )
}

// ── Convert to lead ───────────────────────────────────────────────────────────
//
// The confirm, the service call, BOTH cache invalidations and the failure path,
// in one place, because a conversion that invalidates one cache and not the
// other leaves a stale row on screen and that is not a bug you want two copies
// of.
//
// WHAT CHANGED HERE, AND WHY IT IS A FIX RATHER THAN A PREFERENCE
// ───────────────────────────────────────────────────────────────
// The old panel finished a conversion with
//     closeDetail(); setTimeout(() => openLeadDetail(newLead.id), 150)
// which sets detailPanelOpen on leadsStore. LeadDetailPanel is mounted ONLY by
// LeadsPage — never by ContactsPage — so on /contacts that call rendered
// nothing at all: the contact panel shut and the new lead was never shown. The
// store flag also survived, so the next visit to /leads opened a panel the user
// had not asked for.
//
// step042 gave leads a real route, so the caller navigates to /leads/:id
// instead. Same intent, and it now actually happens.

export function useConvertContactToLead() {
  const user = useAuthStore((s) => s.user)
  const qc   = useQueryClient()
  const [converting, setConverting] = React.useState(false)

  const convert = async (contact, onDone) => {
    if (!contact) return
    if (contact.linkedLeadId) return   // already converted — button is hidden, belt and braces
    if (!confirm(`Convert "${contact.name}" to a Lead? This will create a new lead linked to this contact.`)) return

    setConverting(true)
    try {
      const newLead = await convertContactToLead(contact, user)
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['leads'] })
      onDone?.(newLead)
    } catch (err) {
      alert(err.message ?? 'Conversion failed. Please try again.')
    } finally {
      setConverting(false)
    }
  }

  return { convert, converting }
}
