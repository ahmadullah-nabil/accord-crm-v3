// ─── OppDetailPanel ───────────────────────────────────────────────────────────
//
// step045. The one-long-scroll panel is now a tabbed record surface, matching
// Leads and Contacts.
//
// WHAT CHANGED
// ────────────
// Before: a 400px panel with three KPI tiles and six stacked <Section> blocks —
// Details, Assignee, Notes, Tags, Actions, Files — plus a timeline at the
// bottom. Reaching the timeline meant scrolling past every field every time,
// and there was no way to see the deal's tasks or meetings at all.
//
// Now: fields live in collapsible groups at the top, and everything RELATED to
// the deal (timeline, tasks, meetings, files, emails) is a tab. The field
// definitions, the badges, the header actions and the tab list all come from
// OppRecordContent, which OppRecordPage also uses — so the two surfaces cannot
// disagree.
//
// THE TWO QUICK-ACTION BUTTONS ARE GONE, AND THEIR BUG WITH THEM
// ──────────────────────────────────────────────────────────────
// "Schedule Meeting" sent `relatedType: 'Lead'` with an opportunity id; "Add
// Task" sent `relatedType: 'Meeting'`, also with an opportunity id. Both filed
// the new row against a record that does not exist, so it showed up on no
// record's list while /meetings labelled it "Lead". Those affordances now live
// on the Tasks and Meetings tabs, next to the list they add to, and write
// 'Opportunity' — a value that exists as of step045.
//
// THE THREE KPI TILES ARE GONE. Value, Probability and Exp. Revenue are three
// numbers about the same deal, and expected revenue is DERIVED from the other
// two, so a tile that emphasises it as an independent figure implies a third
// fact where there are two. They are fields in the Deal group now, and Value
// and Probability also sit in the badge row where they are visible on any tab.
//
// RECORD NAVIGATION WALKS THE FILTERED LIST — the up/down arrows step through
// applyFilters(allOpps), not every deal. If they walked the unfiltered set they
// would navigate into rows the user cannot see behind the panel, and "3 of 7"
// would contradict the seven rows on screen.
//
// EVERY PERMISSION GATE IS CARRIED OVER UNCHANGED: Edit and Delete on canEdit /
// canDelete, and the tab add-affordances on canEdit, which is what gated the
// old Actions block.

import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import { useOpportunitiesStore }    from '../../stores/opportunitiesStore.js'
import {
  useOpportunity, useOpportunities, useDeleteOpportunity,
} from '../../hooks/useOpportunities.js'
import { useOpportunityPermissions } from '../../hooks/usePermissions.js'
import { useRoleByName }            from '../../hooks/useTeam.js'
import { Avatar }                   from '../ui/Avatar.jsx'
import { RecordShell }              from '../ui/RecordShell.jsx'
import { EmailComposer }            from '../email/EmailComposer.jsx'
import {
  OppFields, OppBadges, OppActions, useOppTabs,
} from './OppRecordContent.jsx'

export function OppDetailPanel() {
  const navigate = useNavigate()
  const {
    detailPanelOpen, closeDetail, openDetail, selectedOppId,
    openEditModal, applyFilters,
  } = useOpportunitiesStore()

  const { data: opp, isLoading } = useOpportunity(
    detailPanelOpen ? selectedOppId : null
  )
  const deleteMutation = useDeleteOpportunity()

  const perms = useOpportunityPermissions(opp)
  const tabs  = useOppTabs(opp, perms)
  const assigneeRole = useRoleByName(opp?.assignee)

  const [composerOpen, setComposerOpen] = React.useState(false)

  // The visible, filtered order — see the note above on why this and not the
  // raw list. Shares the ['opportunities'] cache entry with the page behind it,
  // so this is a cache read rather than a second fetch.
  const { data: allOpps = [] } = useOpportunities()
  const ordered = applyFilters(allOpps)

  const nav = useMemo(() => {
    const index = ordered.findIndex((o) => o.id === selectedOppId)
    if (index === -1) return null
    return {
      index,
      total: ordered.length,
      onPrev: () => index > 0 && openDetail(ordered[index - 1].id),
      onNext: () => index < ordered.length - 1 && openDetail(ordered[index + 1].id),
    }
  }, [ordered, selectedOppId, openDetail])

  const handleDelete = () => {
    if (!opp) return
    if (confirm(`Delete deal "${opp.title}"?`)) {
      deleteMutation.mutate(opp.id, { onSuccess: closeDetail })
    }
  }

  return (
    <>
      <RecordShell
        variant="panel"
        open={detailPanelOpen}
        onClose={closeDetail}
        // Deep-linkable full record. Closing the panel first is this caller's
        // job — OppRecordPage is a different route and never mounts it.
        onExpand={opp ? () => { closeDetail(); navigate(`/opportunities/${opp.id}`) } : undefined}
        isLoading={isLoading}
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
    </>
  )
}

export default OppDetailPanel
