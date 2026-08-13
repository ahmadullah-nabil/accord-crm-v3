// ─── LeadDetailPanel ──────────────────────────────────────────────────────────
//
// step042. The one-long-scroll panel is now a tabbed record surface.
//
// WHAT CHANGED
// ────────────
// Before: a 400px panel with eight stacked <Section> blocks — Contact, Deal,
// Assignee, Tags, Notes, Meetings, Tasks, Files — plus a timeline at the bottom.
// Reaching the timeline meant scrolling past every field every time.
//
// Now: fields live in collapsible groups at the top, and everything RELATED to
// the lead (timeline, tasks, meetings, files, emails) is a tab. Same data, same
// hooks, same stores. The field definitions and the tab list come from
// LeadRecordContent, which the full record page also uses — so the two surfaces
// cannot disagree.
//
// RECORD NAVIGATION WALKS THE FILTERED LIST
// ─────────────────────────────────────────
// The up/down arrows step through getFilteredLeads(), not every lead in the
// table. If the arrows walked the unfiltered set they would navigate into rows
// the user cannot see behind the panel, and "3 of 7" would contradict the seven
// rows on screen.
//
// EVERY PERMISSION GATE IS CARRIED OVER UNCHANGED. Email is deliberately NOT
// gated: the send goes from the user's own mailbox, so there is no privilege to
// escalate. Convert, Edit and Delete are gated exactly as before.

import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, TrendingUp, Pencil, Trash2 } from 'lucide-react'

import { useLeadsStore }        from '../../stores/leadsStore.js'
import { useOpportunitiesStore } from '../../stores/opportunitiesStore.js'
import { useLeadPermissions }   from '../../hooks/usePermissions.js'
import { useAssignableMembers } from '../../hooks/useTeam.js'
import { Avatar }               from '../ui/Avatar.jsx'
import { RecordShell }          from '../ui/RecordShell.jsx'
import { EmailComposer }        from '../email/EmailComposer.jsx'
import { LeadFields, LeadBadges, useLeadTabs } from './LeadRecordContent.jsx'

export function LeadDetailPanel() {
  const navigate = useNavigate()
  const {
    leads, selectedLeadId, detailPanelOpen,
    closeDetail, openDetail, openEditModal, deleteLead, getFilteredLeads,
  } = useLeadsStore()

  const lead  = leads.find((l) => l.id === selectedLeadId) ?? null
  const perms = useLeadPermissions(lead)
  const tabs  = useLeadTabs(lead, perms)

  const { members = [] } = useAssignableMembers()
  const assigneeRole = members.find((m) => m.name === lead?.assignee)?.role ?? null

  const [composerOpen, setComposerOpen] = React.useState(false)

  // The visible, filtered order — see the note above on why this and not `leads`.
  const ordered = getFilteredLeads()
  const nav = useMemo(() => {
    const index = ordered.findIndex((l) => l.id === selectedLeadId)
    if (index === -1) return null
    return {
      index,
      total: ordered.length,
      onPrev: () => index > 0 && openDetail(ordered[index - 1].id),
      onNext: () => index < ordered.length - 1 && openDetail(ordered[index + 1].id),
    }
  }, [ordered, selectedLeadId, openDetail])

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
      closeDetail()
    }
  }

  return (
    <>
      <RecordShell
        variant="panel"
        open={detailPanelOpen && Boolean(lead)}
        onClose={closeDetail}
        // Deep-linkable full record. The panel stays mounted behind it; closing
        // is the caller's job on arrival, which LeadRecordPage does not need to
        // do because it is a different route.
        onExpand={lead ? () => { closeDetail(); navigate(`/leads/${lead.id}`) } : undefined}
        avatar={lead ? <Avatar name={lead.name} size="md" /> : null}
        title={lead?.name}
        subtitle={lead?.company}
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
    </>
  )
}

export default LeadDetailPanel
