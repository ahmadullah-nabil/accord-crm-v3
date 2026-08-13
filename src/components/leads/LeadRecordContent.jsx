// ─── LeadRecordContent ────────────────────────────────────────────────────────
//
// step042. What a lead IS, as data: its field groups, its tabs, its header bits.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ THIS FILE EXISTS SO THE PANEL AND THE PAGE CANNOT DRIFT                 │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ LeadDetailPanel and LeadRecordPage both call these hooks. Add a field    │
// │ here and it appears on both surfaces; add it to one component and you    │
// │ have two versions of a lead that disagree, which nobody notices because  │
// │ nobody opens both in the same minute.                                    │
// └─────────────────────────────────────────────────────────────────────────┘
//
// TABS ONLY EXIST WHERE A TABLE DOES
// ──────────────────────────────────
// Timeline, Tasks, Meetings, Files and Emails all have real backing tables and
// real hooks. NOTES DOES NOT — `leads.notes` is a single TEXT column, not a
// notes table, so notes is a FIELD here rather than a tab. Shipping an
// always-empty Notes tab to match a reference screenshot would be decoration
// that costs a click to discover.
//
// EMAILS is present because email_messages exists, but its history is scoped by
// RLS to the caller's OWN sends. Two users working the same lead each see their
// own, which is correct mailbox behaviour and worth stating on the tab so it is
// not mistaken for missing data.
//
// WHY THERE IS NO INLINE FIELD EDITING YET
// ────────────────────────────────────────
// RecordField takes an `action` slot for exactly that, and leadsStore's
// updateLead() already accepts a partial patch, so the write path is there. It
// is deliberately not wired in this batch: a per-field save needs its own
// validation and its own error surface, and this project just spent an
// afternoon on a write that failed silently because a form had nowhere to show
// the reason. Bundling it here would make a large batch untestable. Its own
// step, with an error affordance designed on purpose.

import React from 'react'
import {
  Mail, Phone, Globe, DollarSign, Calendar, TrendingUp, Tag, Hash,
  User, FileText, Clock, CheckSquare, Paperclip, Activity, Send,
  Building2,
} from 'lucide-react'

import { useLeadMeetings }   from '../../hooks/useMeetings.js'
import { useLeadTasks }      from '../../hooks/useTasks.js'
import { useAttachments }    from '../../hooks/useAttachments.js'
import { useSentEmails }     from '../../hooks/useEmail.js'
import { useMeetingsStore }  from '../../stores/meetingsStore.js'
import { useTasksStore }     from '../../stores/tasksStore.js'
import { STAGE_COLORS, PRIORITY_COLORS } from '../../stores/leadsStore.js'
import { Avatar }            from '../ui/Avatar.jsx'
import { FieldGroup, RecordField } from '../ui/FieldGroup.jsx'
import { TimelinePanel }     from '../timeline/TimelinePanel.jsx'
import { AttachmentPanel }   from '../attachments/AttachmentPanel.jsx'
import { RelatedList, EmptyBlock } from '../ui/RelatedList.jsx'

export const fmtCurrency = (n) =>
  n >= 1_000_000 ? `৳${(n / 1_000_000).toFixed(2)}M`
  : n >= 1_000   ? `৳${(n / 1_000).toFixed(0)}K`
  : `৳${n ?? 0}`

// ── Badges ────────────────────────────────────────────────────────────────────

export function LeadBadges({ lead }) {
  if (!lead) return null
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`badge ${STAGE_COLORS[lead.stage]?.light || 'bg-gray-100 text-gray-600'}`}>
        {lead.stage}
      </span>
      <span className={`badge ${PRIORITY_COLORS[lead.priority] || 'bg-gray-100 text-gray-600'}`}>
        {lead.priority} priority
      </span>
      <span className="ml-auto font-medium text-gray-900 tnum">
        {fmtCurrency(lead.value)}
      </span>
    </div>
  )
}

// ── Field groups ──────────────────────────────────────────────────────────────

export function LeadFields({ lead, assigneeRole }) {
  if (!lead) return null

  return (
    <div>
      <FieldGroup title="Contact">
        <RecordField label="Email" icon={Mail} placeholder="No email">
          {lead.email
            ? <a href={`mailto:${lead.email}`} className="text-teal-700 hover:underline">{lead.email}</a>
            : null}
        </RecordField>
        <RecordField label="Phone" icon={Phone} placeholder="No phone">
          {lead.phone
            ? <a href={`tel:${lead.phone}`} className="text-teal-700 hover:underline">{lead.phone}</a>
            : null}
        </RecordField>
        <RecordField label="Company" icon={Building2} placeholder="No company">
          {lead.company || null}
        </RecordField>
        <RecordField label="Source" icon={Globe} placeholder="No source">
          {lead.source || null}
        </RecordField>
      </FieldGroup>

      <FieldGroup title="Deal">
        <RecordField label="Value" icon={DollarSign} mono>
          {fmtCurrency(lead.value)}
        </RecordField>
        <RecordField label="Stage" icon={TrendingUp}>{lead.stage}</RecordField>
        <RecordField label="Priority" icon={Activity}>{lead.priority}</RecordField>
      </FieldGroup>

      <FieldGroup title="Assignee">
        <RecordField label="Owner" icon={User} placeholder="Unassigned">
          {lead.assignee
            ? (
              <span className="flex items-center gap-1.5">
                <Avatar name={lead.assignee} size="xs" />
                <span>{lead.assignee}</span>
                {assigneeRole && <span className="text-gray-400">· {assigneeRole}</span>}
              </span>
            )
            : null}
        </RecordField>
      </FieldGroup>

      <FieldGroup title="Notes" defaultOpen={Boolean(lead.notes)}>
        <RecordField label="Notes" icon={FileText} placeholder="No notes">
          {lead.notes || null}
        </RecordField>
        <RecordField label="Tags" icon={Tag} placeholder="No tags">
          {lead.tags?.length
            ? (
              <span className="flex flex-wrap gap-1">
                {lead.tags.map((t) => (
                  <span key={t} className="badge bg-gray-100 text-gray-600">{t}</span>
                ))}
              </span>
            )
            : null}
        </RecordField>
      </FieldGroup>

      {/* Shut by default: a creation date and a UUID are the fields you look up
          once a month, and they were costing a scroll on every open. */}
      <FieldGroup title="System" defaultOpen={false}>
        <RecordField label="Created" icon={Calendar}>{lead.createdAt || null}</RecordField>
        <RecordField label="Last activity" icon={Clock}>{lead.lastActivity || null}</RecordField>
        <RecordField label="Lead ID" icon={Hash} mono>
          <span className="text-xs text-gray-500 break-all">{lead.id}</span>
        </RecordField>
        {lead.contactId && (
          <RecordField label="Converted from" icon={User}>
            <span className="badge bg-teal-50 text-teal-700">Contact</span>
          </RecordField>
        )}
      </FieldGroup>
    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

/**
 * @param {object} lead
 * @param {object} perms  from useLeadPermissions — gates the "add" affordances
 * @returns {Array} RecordShell `tabs`
 */
export function useLeadTabs(lead, perms = {}) {
  const leadId = lead?.id ?? null

  const { data: meetings = [], isLoading: meetingsLoading } = useLeadMeetings(leadId)
  const { data: tasks = [],    isLoading: tasksLoading }    = useLeadTasks(leadId)
  const { data: files = [] }                                = useAttachments('lead', leadId)
  const { data: emails = [] }                               = useSentEmails('lead', leadId)

  const { openAddModalWithPrefill: openMeeting, openDetail: openMeetingDetail } = useMeetingsStore()
  const { openAddModalWithPrefill: openTask,    openDetail: openTaskDetail }    = useTasksStore()

  if (!lead) return []

  return [
    {
      key: 'timeline',
      label: 'Timeline',
      icon: Activity,
      render: () => (
        <TimelinePanel
          entityType="lead"
          entityId={lead.id}
          entityLabel={lead.company || lead.name}
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
          onAdd={perms.canSchedule ? () => openTask({
            relatedType: 'Lead', relatedId: lead.id,
            relatedLabel: `${lead.name} — ${lead.company}`,
            assignee: lead.assignee,
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
          onAdd={perms.canSchedule ? () => openMeeting({
            relatedType: 'Lead', relatedId: lead.id,
            relatedLabel: `${lead.name} — ${lead.company}`,
            title: `Meeting — ${lead.company}`,
            participants: lead.name ? [lead.name] : [],
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
      render: () => <AttachmentPanel relatedType="lead" relatedId={lead.id} compact />,
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
            Messages you sent to this lead. Other users see their own.
          </p>
          {emails.length === 0 ? (
            <EmptyBlock label="No emails sent yet" />
          ) : (
            emails.map((e) => (
              <div key={e.id}
                   className="px-2.5 py-2 rounded-lg border border-gray-100">
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

// ── Small shared pieces ───────────────────────────────────────────────────────
//
// step043: RelatedList and EmptyBlock moved to components/ui/RelatedList.jsx so
// Contacts (and the three modules after it) render related records identically
// instead of each carrying a private copy. Markup unchanged.
