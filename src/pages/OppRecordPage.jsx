// ─── OppRecordPage ────────────────────────────────────────────────────────────
//
// step045. /opportunities/:id — the third real record route, after /leads/:id
// and /contacts/:id.
//
// COLD ARRIVAL IS READ, NOT INFERRED — same as Contacts, for the same reason
// ────────────────────────────────────────────────────────────────────────
// LeadRecordPage reads leadsStore, a Zustand array that must initialize()
// before it can find anything, so it needs the three-way test
//
//     if (!lead && !isLoading && leads.length > 0) return <NotFound />
//
// to avoid flashing "not found" while the store fills. Opportunities is already
// on React Query: useOpportunity(id) fetches THAT ONE ROW, so a pasted link in
// a fresh tab is an ordinary query with an ordinary loading state. There is no
// window in which the record is absent but not yet known to be absent.
//
// So "not found" is READ here: getOpportunityById uses .single(), PostgREST
// returns PGRST116 for zero rows, and supabaseErrors classifies that as
// error.isNotFound. A deleted id and an id behind RLS give different, accurate
// answers instead of one guess covering both. error.isUnauthorized is handled
// separately because a deal you cannot see is not a deal that does not exist,
// and telling a user the record is gone when it is someone else's is a support
// ticket.
//
// MODALS ARE MOUNTED HERE
// ───────────────────────
// Edit opens OppFormModal; the tabs open the meeting and task modals. A modal
// whose page never mounted it simply does not appear — no error, no message,
// just a button that looks dead. Four, matching what OpportunitiesPage mounts
// minus the panel.

import React, { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { TrendingUp, RefreshCw } from 'lucide-react'

import { useOpportunitiesStore } from '../stores/opportunitiesStore.js'
import {
  useOpportunity, useOpportunities, useDeleteOpportunity,
} from '../hooks/useOpportunities.js'
import { useOpportunityPermissions } from '../hooks/usePermissions.js'
import { useRoleByName }        from '../hooks/useTeam.js'
import { Avatar }               from '../components/ui/Avatar.jsx'
import { RecordShell }          from '../components/ui/RecordShell.jsx'
import { UnauthorizedState }    from '../components/ui/UnauthorizedState.jsx'
import { EmailComposer }        from '../components/email/EmailComposer.jsx'
import {
  OppFields, OppBadges, OppActions, useOppTabs,
} from '../components/opportunities/OppRecordContent.jsx'

// Opened from the header and from the tabs on this page.
import { OppFormModal }         from '../components/opportunities/OppFormModal.jsx'
import { MeetingFormModal }     from '../components/meetings/MeetingFormModal.jsx'
import { MeetingDetailPanel }   from '../components/meetings/MeetingDetailPanel.jsx'
import { TaskFormModal }        from '../components/tasks/TaskFormModal.jsx'
import { TaskDetailPanel }      from '../components/tasks/TaskDetailPanel.jsx'

export function OppRecordPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { openEditModal, applyFilters } = useOpportunitiesStore()
  const { data: opp, isLoading, isError, error, refetch } = useOpportunity(id)
  const deleteMutation = useDeleteOpportunity()

  const perms = useOpportunityPermissions(opp)
  const tabs  = useOppTabs(opp, perms)
  const assigneeRole = useRoleByName(opp?.assignee)

  const [composerOpen, setComposerOpen] = React.useState(false)

  // Same filtered ordering the list and the panel use, so walking records from
  // here matches what the user last saw on /opportunities. On a cold arrival
  // the list query is still in flight, so `ordered` is empty and nav is null —
  // the arrows appear once it lands rather than pointing at a one-item universe.
  const { data: allOpps = [] } = useOpportunities()
  const ordered = applyFilters(allOpps)

  const nav = useMemo(() => {
    const index = ordered.findIndex((o) => o.id === id)
    if (index === -1) return null
    return {
      index,
      total: ordered.length,
      onPrev: () => index > 0 && navigate(`/opportunities/${ordered[index - 1].id}`),
      onNext: () => index < ordered.length - 1 && navigate(`/opportunities/${ordered[index + 1].id}`),
    }
  }, [ordered, id, navigate])

  const handleDelete = () => {
    if (!opp) return
    if (confirm(`Delete deal "${opp.title}"?`)) {
      // The record no longer exists, so this route no longer resolves.
      deleteMutation.mutate(opp.id, { onSuccess: () => navigate('/opportunities') })
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
        title="Deal not found"
        detail="It may have been deleted, or you may not have access to it."
        actionLabel="Back to deals"
        onAction={() => navigate('/opportunities')}
      />
    )
  }

  // ── Load failed for some other reason ─────────────────────────────────────
  if (isError) {
    return (
      <CentredState
        title="Could not load deal"
        detail={error?.message ?? 'Something went wrong. Try again.'}
        actionLabel="Retry"
        onAction={() => refetch()}
      />
    )
  }

  return (
    <>
      <RecordShell
        variant="page"
        breadcrumb="Opportunities"
        onBack={() => navigate('/opportunities')}
        isLoading={isLoading || !opp}
        avatar={opp ? <Avatar name={opp.company || opp.title} size="md" /> : null}
        title={opp?.title ?? 'Loading…'}
        subtitle={opp?.company}
        badges={opp ? <OppBadges opp={opp} /> : null}
        nav={nav}
        actions={
          <OppActions
            opp={opp}
            perms={perms}
            onEmail={() => setComposerOpen(true)}
            onEdit={() => openEditModal(opp.id)}
            onDelete={handleDelete}
          />
        }
        fields={<OppFields opp={opp} assigneeRole={assigneeRole} />}
        tabs={tabs}
      />

      <EmailComposer
        open={composerOpen && Boolean(opp)}
        onClose={() => setComposerOpen(false)}
        record={opp}
        relatedType="opportunity"
      />

      <OppFormModal />
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
        <TrendingUp size={18} className="text-red-500" />
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

export default OppRecordPage
