// ─── LeadRecordPage ───────────────────────────────────────────────────────────
//
// step042. The first REAL record route in this CRM: /leads/:id.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ WHAT THIS CHANGES ABOUT THE APP                                         │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ Until now every module showed a record as a slide-over driven by its     │
// │ store's openDetail(id). Nothing had a URL, so a lead could not be        │
// │ linked, bookmarked, opened in a new tab, or pasted into Slack.           │
// │                                                                          │
// │ This is the first route that owns a record. The panel is NOT replaced —  │
// │ both surfaces exist, both read the same definitions from                 │
// │ LeadRecordContent, and the panel's expand button navigates here.         │
// └─────────────────────────────────────────────────────────────────────────┘
//
// THE DATA SOURCE IS THE STORE, AND THAT HAS A CONSEQUENCE
// ───────────────────────────────────────────────────────
// leadsStore is its own cache: it loads every lead once via initialize() and
// holds them in an array. So on a COLD ARRIVAL — a pasted link, a new tab — the
// store is empty and this page has to initialize() before it can find the lead.
// That is why the loading state below distinguishes "still loading" from "loaded
// and genuinely absent". Rendering "not found" during the load would flash a
// wrong answer on every deep link.
//
// A per-record fetch would be better and is deliberately not done here: it means
// a getLeadById path, a second source of truth for one lead, and a decision
// about which wins when both are present. That belongs in the same batch that
// moves leads onto React Query, not in a UI batch.

import React, { useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Target, Mail, TrendingUp, Pencil, Trash2, RefreshCw } from 'lucide-react'

import { useLeadsStore }         from '../stores/leadsStore.js'
import { useOpportunitiesStore } from '../stores/opportunitiesStore.js'
import { useLeadPermissions }    from '../hooks/usePermissions.js'
import { useAssignableMembers }  from '../hooks/useTeam.js'
import { Avatar }                from '../components/ui/Avatar.jsx'
import { RecordShell }           from '../components/ui/RecordShell.jsx'
import { EmailComposer }         from '../components/email/EmailComposer.jsx'
import {
  LeadFields, LeadBadges, useLeadTabs,
} from '../components/leads/LeadRecordContent.jsx'

// Modals live here too, because they are opened from the tabs on this page and a
// modal whose page never mounted it simply does not appear.
import { LeadFormModal }      from '../components/leads/LeadFormModal.jsx'
import { MeetingFormModal }   from '../components/meetings/MeetingFormModal.jsx'
import { MeetingDetailPanel } from '../components/meetings/MeetingDetailPanel.jsx'
import { TaskFormModal }      from '../components/tasks/TaskFormModal.jsx'
import { TaskDetailPanel }    from '../components/tasks/TaskDetailPanel.jsx'
import { OppFormModal }       from '../components/opportunities/OppFormModal.jsx'

export function LeadRecordPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const {
    leads, isLoading, error, initialize,
    openEditModal, deleteLead, getFilteredLeads,
  } = useLeadsStore()

  // Cold arrival: the store may hold nothing yet. initialize() is a no-op when
  // unauthenticated and cheap when already populated.
  useEffect(() => { initialize() }, [initialize])

  const lead  = leads.find((l) => l.id === id) ?? null
  const perms = useLeadPermissions(lead)
  const tabs  = useLeadTabs(lead, perms)

  const { members = [] } = useAssignableMembers()
  const assigneeRole = members.find((m) => m.name === lead?.assignee)?.role ?? null

  const [composerOpen, setComposerOpen] = React.useState(false)

  // Same filtered ordering the list and panel use, so walking records from here
  // matches what the user last saw on /leads.
  const ordered = getFilteredLeads()
  const nav = useMemo(() => {
    const index = ordered.findIndex((l) => l.id === id)
    if (index === -1) return null
    return {
      index,
      total: ordered.length,
      onPrev: () => index > 0 && navigate(`/leads/${ordered[index - 1].id}`),
      onNext: () => index < ordered.length - 1 && navigate(`/leads/${ordered[index + 1].id}`),
    }
  }, [ordered, id, navigate])

  const handleConvert = () => {
    if (!lead) return
    useOpportunitiesStore.getState().openAddModalWithPrefill({
      name:         `${lead.company} — Opportunity`,
      company:      lead.company,
      contactName:  lead.name,
      email:        lead.email,
      phone:        lead.phone,
      assignee:     lead.assignee,
      value:        String(lead.value || ''),
      sourceLeadId: lead.id,
      stage:        'Qualified',
      probability:  30,
    })
  }

  const handleDelete = () => {
    if (!lead) return
    if (confirm(`Delete lead "${lead.name}"?`)) {
      deleteLead(lead.id)
      // The record no longer exists, so this route no longer resolves.
      navigate('/leads')
    }
  }

  // ── Load failed ───────────────────────────────────────────────────────────
  if (error && !isLoading) {
    return (
      <CentredState
        title="Failed to load lead"
        detail={error}
        actionLabel="Retry"
        onAction={() => initialize()}
      />
    )
  }

  // ── Loaded, and this id is not among the leads the user can see ───────────
  // Only asserted once loading has finished AND the store holds something.
  // Otherwise a deep link would flash "not found" before the data lands.
  if (!lead && !isLoading && leads.length > 0) {
    return (
      <CentredState
        title="Lead not found"
        detail="It may have been deleted, or you may not have access to it."
        actionLabel="Back to leads"
        onAction={() => navigate('/leads')}
      />
    )
  }

  return (
    <>
      <RecordShell
        variant="page"
        breadcrumb="Leads"
        onBack={() => navigate('/leads')}
        isLoading={!lead}
        avatar={lead ? <Avatar name={lead.company || lead.name} size="md" /> : null}
        // step067 — company is the record's title, contact the subtitle.
        title={lead ? (lead.company || lead.name) : 'Loading…'}
        subtitle={lead?.company ? lead.name : undefined}
        badges={lead ? <LeadBadges lead={lead} /> : null}
        nav={nav}
        actions={lead ? (
          <>
            <button
              onClick={() => setComposerOpen(true)}
              disabled={!lead.email}
              title={lead.email ? `Email ${lead.name || lead.company}` : 'This lead has no email address'}
              className="p-1.5 rounded-md text-gray-400 hover:text-teal-600 hover:bg-teal-50
                         transition-colors duration-120 disabled:opacity-30
                         disabled:hover:bg-transparent disabled:hover:text-gray-400"
            >
              <Mail size={15} />
            </button>
            {perms.canConvert && (
              <button
                onClick={handleConvert}
                title="Convert to opportunity"
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium
                           bg-teal-50 text-teal-700 hover:bg-teal-100
                           transition-colors duration-120"
              >
                <TrendingUp size={12} /> Convert
              </button>
            )}
            {perms.canEdit && (
              <button
                onClick={() => openEditModal(lead.id)}
                title="Edit lead"
                className="p-1.5 rounded-md text-gray-400 hover:text-teal-600 hover:bg-teal-50
                           transition-colors duration-120"
              >
                <Pencil size={15} />
              </button>
            )}
            {perms.canDelete && (
              <button
                onClick={handleDelete}
                title="Delete lead"
                className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50
                           transition-colors duration-120"
              >
                <Trash2 size={15} />
              </button>
            )}
          </>
        ) : null}
        fields={<LeadFields lead={lead} assigneeRole={assigneeRole} />}
        tabs={tabs}
      />

      <EmailComposer
        open={composerOpen && Boolean(lead)}
        onClose={() => setComposerOpen(false)}
        record={lead}
        relatedType="lead"
      />

      <LeadFormModal />
      <MeetingFormModal />
      <MeetingDetailPanel />
      <TaskFormModal />
      <TaskDetailPanel />
      <OppFormModal />
    </>
  )
}

function CentredState({ title, detail, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-3">
      <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
        <Target size={18} className="text-red-500" />
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

export default LeadRecordPage
