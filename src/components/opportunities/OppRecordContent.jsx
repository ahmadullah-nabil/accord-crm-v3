// ─── OppRecordContent ─────────────────────────────────────────────────────────
//
// step045. What an opportunity IS, as data: its field groups, its tabs, its
// header bits. Copy #3 of the LeadRecordContent pattern, after Contacts.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ THIS FILE EXISTS SO THE PANEL AND THE PAGE CANNOT DRIFT                 │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ OppDetailPanel and OppRecordPage both call these hooks. Add a field here│
// │ and it appears on both surfaces; add it to one component and you have   │
// │ two versions of a deal that disagree, which nobody notices because      │
// │ nobody opens both in the same minute.                                    │
// └─────────────────────────────────────────────────────────────────────────┘
//
// THE DEAL GETS ALL FIVE TABS, AND THAT REQUIRED A VOCABULARY CHANGE
// ──────────────────────────────────────────────────────────────────
// Timeline, Files and Emails already worked against an opportunity id. Tasks
// and Meetings did not, and could not: 'Opportunity' was in neither
// RELATED_TYPES array, and there was no useOpportunityMeetings or
// useOpportunityTasks. The old panel worked around that by lying — it sent
// `relatedType: 'Lead'` for meetings and `relatedType: 'Meeting'` for tasks,
// both with an OPPORTUNITY id, so the row was filed against a record that does
// not exist. useLeadMeetings matches 'Lead' AND a lead id, and an opportunity
// id is never both, so the meeting appeared on NO record's list while
// /meetings displayed it labelled "Lead". A write that succeeds and lands
// nowhere findable — the step038 class, minus the 400 that would have told you.
//
// step045 extends the vocabulary instead of working around it: 'Opportunity' is
// now in both RELATED_TYPES arrays and both per-entity hooks exist. The prefills
// below are the first writes to use it.
//
// NO NOTES TAB. `opportunities.notes` is a TEXT column, not a table, so notes is
// a FIELD here. Shipping an always-empty Notes tab to match a reference
// screenshot is decoration that costs a click to discover.
//
// PERMISSIONS ARE CARRIED OVER, NOT INVENTED. The old panel gated its Actions
// block on `perms.canEdit`; the add affordances on the Tasks and Meetings tabs
// use the same flag. getOpportunityPermissions has no canSchedule — leads has
// one, opportunities does not, and adding it is a permissions change that does
// not belong in a UI batch.

import React from 'react'
import {
  Mail, Phone, DollarSign, Calendar, TrendingUp, Tag, Hash,
  User, FileText, Clock, CheckSquare, Paperclip, Activity, Send,
  Building2, Target, Percent, Pencil, Trash2,
} from 'lucide-react'

import { useOpportunityMeetings } from '../../hooks/useMeetings.js'
import { useOpportunityTasks }    from '../../hooks/useTasks.js'
import { useAttachments }         from '../../hooks/useAttachments.js'
import { useSentEmails }          from '../../hooks/useEmail.js'
import { useMeetingsStore }       from '../../stores/meetingsStore.js'
import { useTasksStore }          from '../../stores/tasksStore.js'
import { OPP_STAGE_COLORS }       from '../../stores/opportunitiesStore.js'
import { localISODate }           from '../../lib/dates.js'
import { Avatar }                 from '../ui/Avatar.jsx'
import { FieldGroup, RecordField } from '../ui/FieldGroup.jsx'
import { TimelinePanel }          from '../timeline/TimelinePanel.jsx'
import { AttachmentPanel }        from '../attachments/AttachmentPanel.jsx'
import { RelatedList, EmptyBlock } from '../ui/RelatedList.jsx'

export const fmtCurrency = (n) =>
  n >= 1_000_000 ? `৳${(n / 1_000_000).toFixed(2)}M`
  : n >= 1_000   ? `৳${(n / 1_000).toFixed(0)}K`
  : `৳${n ?? 0}`

// ── Badges ────────────────────────────────────────────────────────────────────

export function OppBadges({ opp }) {
  if (!opp) return null
  const sc = OPP_STAGE_COLORS[opp.stage] ?? OPP_STAGE_COLORS.New

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`badge ${sc.light}`}>{opp.stage}</span>
      <span className="badge bg-gray-100 text-gray-600 tnum">{opp.probability}%</span>
      <span className="ml-auto font-medium text-gray-900 tnum">
        {fmtCurrency(opp.value)}
      </span>
    </div>
  )
}

// ── Field groups ──────────────────────────────────────────────────────────────

export function OppFields({ opp, assigneeRole }) {
  if (!opp) return null

  return (
    <div>
      <FieldGroup title="Deal">
        <RecordField label="Value" icon={DollarSign} mono>
          {fmtCurrency(opp.value)}
        </RecordField>
        {/* expected_revenue is a generated column — value × probability. Shown
            because the old panel gave it a third of the header, but as a field
            rather than a KPI tile: it is derived, so it never disagrees with
            the two fields above it and does not need its own emphasis. */}
        <RecordField label="Exp. revenue" icon={TrendingUp} mono>
          {fmtCurrency(opp.expectedRevenue)}
        </RecordField>
        <RecordField label="Probability" icon={Percent} mono>
          {`${opp.probability}%`}
        </RecordField>
        <RecordField label="Stage" icon={Activity}>{opp.stage}</RecordField>
        <RecordField label="Close date" icon={Calendar} placeholder="No close date">
          {opp.expectedCloseDate || null}
        </RecordField>
      </FieldGroup>

      <FieldGroup title="Contact">
        <RecordField label="Company" icon={Building2} placeholder="No company">
          {opp.company || null}
        </RecordField>
        <RecordField label="Email" icon={Mail} placeholder="No email">
          {opp.email
            ? <a href={`mailto:${opp.email}`} className="text-teal-700 hover:underline">{opp.email}</a>
            : null}
        </RecordField>
        <RecordField label="Phone" icon={Phone} placeholder="No phone">
          {opp.phone
            ? <a href={`tel:${opp.phone}`} className="text-teal-700 hover:underline">{opp.phone}</a>
            : null}
        </RecordField>
      </FieldGroup>

      <FieldGroup title="Assignee">
        <RecordField label="Owner" icon={User} placeholder="Unassigned">
          {opp.assignee
            ? (
              <span className="flex items-center gap-1.5">
                <Avatar name={opp.assignee} size="xs" />
                <span>{opp.assignee}</span>
                {assigneeRole && <span className="text-gray-400">· {assigneeRole}</span>}
              </span>
            )
            : null}
        </RecordField>
      </FieldGroup>

      <FieldGroup title="Notes" defaultOpen={Boolean(opp.notes)}>
        <RecordField label="Notes" icon={FileText} placeholder="No notes">
          {opp.notes || null}
        </RecordField>
        <RecordField label="Tags" icon={Tag} placeholder="No tags">
          {opp.tags?.length
            ? (
              <span className="flex flex-wrap gap-1">
                {opp.tags.map((t) => (
                  <span key={t} className="badge bg-gray-100 text-gray-600">{t}</span>
                ))}
              </span>
            )
            : null}
        </RecordField>
      </FieldGroup>

      {/* Shut by default, same as leads: a creation date and a UUID are the
          fields you look up once a month and they cost a scroll on every open. */}
      <FieldGroup title="System" defaultOpen={false}>
        <RecordField label="Created" icon={Calendar}>{opp.createdAt || null}</RecordField>
        <RecordField label="Last activity" icon={Clock}>{opp.lastActivity || null}</RecordField>
        <RecordField label="Deal ID" icon={Hash} mono>
          <span className="text-xs text-gray-500 break-all">{opp.id}</span>
        </RecordField>
        {opp.sourceLeadId && (
          <RecordField label="Converted from" icon={Target}>
            <span className="badge bg-teal-50 text-teal-700">Lead</span>
          </RecordField>
        )}
      </FieldGroup>
    </div>
  )
}

// ── Header actions ────────────────────────────────────────────────────────────
//
// Shared for the same reason the fields are: the panel and the page had two
// copies of this block in the Leads implementation and they have already been
// observed to drift. Contacts fixed that with ContactActions in step043; this
// follows it.
//
// EMAIL IS NEW ON THIS RECORD. An opportunity carries an `email` column that no
// surface has ever offered to send to, so the Emails tab would read empty
// forever with no way to fill it. Disabled rather than hidden without an
// address, so the reason is visible instead of the button just being missing.
// Deliberately NOT permission-gated: the send goes from the user's own mailbox,
// so there is no privilege to escalate — same reasoning as leads.

export function OppActions({ opp, perms = {}, onEmail, onEdit, onDelete }) {
  if (!opp) return null

  return (
    <>
      <button
        onClick={onEmail}
        disabled={!opp.email}
        title={opp.email ? `Email ${opp.company || opp.title}` : 'This deal has no email address'}
        className="p-1.5 rounded-md text-gray-400 hover:text-teal-600 hover:bg-teal-50
                   transition-colors duration-120 disabled:opacity-30
                   disabled:hover:bg-transparent disabled:hover:text-gray-400"
      >
        <Mail size={15} />
      </button>
      {perms.canEdit && (
        <button
          onClick={onEdit}
          title="Edit deal"
          className="p-1.5 rounded-md text-gray-400 hover:text-teal-600 hover:bg-teal-50
                     transition-colors duration-120"
        >
          <Pencil size={15} />
        </button>
      )}
      {perms.canDelete && (
        <button
          onClick={onDelete}
          title="Delete deal"
          className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50
                     transition-colors duration-120"
        >
          <Trash2 size={15} />
        </button>
      )}
    </>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

/**
 * @param {object} opp
 * @param {object} perms  from useOpportunityPermissions — gates the "add" affordances
 * @returns {Array} RecordShell `tabs`
 */
export function useOppTabs(opp, perms = {}) {
  const oppId = opp?.id ?? null

  const { data: meetings = [], isLoading: meetingsLoading } = useOpportunityMeetings(oppId)
  const { data: tasks = [],    isLoading: tasksLoading }    = useOpportunityTasks(oppId)
  const { data: files = [] }                                = useAttachments('opportunity', oppId)
  const { data: emails = [] }                               = useSentEmails('opportunity', oppId)

  const { openAddModalWithPrefill: openMeeting, openDetail: openMeetingDetail } = useMeetingsStore()
  const { openAddModalWithPrefill: openTask,    openDetail: openTaskDetail }    = useTasksStore()

  if (!opp) return []

  const label = [opp.title, opp.company].filter(Boolean).join(' — ')

  return [
    {
      key: 'timeline',
      label: 'Timeline',
      icon: Activity,
      render: () => (
        <TimelinePanel
          entityType="opportunity"
          entityId={opp.id}
          entityLabel={opp.title}
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
          onAdd={perms.canEdit ? () => openTask({
            // 'Opportunity', not 'Meeting'. See the header note.
            relatedType: 'Opportunity', relatedId: opp.id,
            relatedLabel: label,
            title: `Follow-up: ${opp.title}`,
            dueDate: (() => {
              // localISODate, never toISOString().split('T')[0] — a due date is
              // a calendar date and UTC shifts it a day for half the world.
              const d = new Date(); d.setDate(d.getDate() + 7)
              return localISODate(d)
            })(),
            assignee: opp.assignee || '',
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
          onAdd={perms.canEdit ? () => openMeeting({
            relatedType: 'Opportunity', relatedId: opp.id,
            relatedLabel: label,
            title: `Meeting — ${opp.company || opp.title}`,
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
      // Lowercase 'opportunity' — attachments and email_messages want lowercase,
      // meetings.related_type and tasks.related_type want capitalised. Both
      // casings appear in this one file on purpose; check before you copy.
      render: () => <AttachmentPanel relatedType="opportunity" relatedId={opp.id} compact />,
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
            Messages you sent about this deal. Other users see their own.
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
