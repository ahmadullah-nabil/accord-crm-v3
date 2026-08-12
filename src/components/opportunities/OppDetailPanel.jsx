import React from 'react'
import {
  X, Building2, Mail, Phone, DollarSign,
  TrendingUp, Calendar, Tag, Pencil, Trash2, User,
} from 'lucide-react'
import { useOpportunitiesStore, OPP_STAGE_COLORS } from '../../stores/opportunitiesStore.js'
import { useOpportunity, useDeleteOpportunity } from '../../hooks/useOpportunities.js'
import { useOpportunityPermissions }  from '../../hooks/usePermissions.js'
import { useRoleByName }              from '../../hooks/useTeam.js'
import { useMeetingsStore }    from '../../stores/meetingsStore.js'
import { useTasksStore }       from '../../stores/tasksStore.js'
import { TimelinePanel }           from '../timeline/TimelinePanel.jsx'
import { Avatar }              from '../ui/Avatar.jsx'
import { Skeleton }            from '../ui/Skeleton.jsx'
import {
  Activity, UserPlus, ArrowRight, CheckCircle2,
  RotateCcw, FileText,
} from 'lucide-react'

const fmt = (n) =>
  n >= 1_000_000 ? `৳${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `৳${(n / 1_000).toFixed(0)}K`
  : `৳${n}`



export function OppDetailPanel() {
  const {
    detailPanelOpen, closeDetail, selectedOppId, openEditModal,
  } = useOpportunitiesStore()

  const { openAddModalWithPrefill: scheduleMeeting } = useMeetingsStore()
  const { openAddModalWithPrefill: createTask }      = useTasksStore()
  const deleteMutation = useDeleteOpportunity()

  const { data: opp, isLoading } = useOpportunity(
    detailPanelOpen ? selectedOppId : null
  )



  const perms = useOpportunityPermissions(opp)
  const assigneeRole = useRoleByName(opp?.assignee)

  const handleDelete = () => {
    if (!opp) return
    if (confirm(`Delete deal "${opp.title}"?`)) {
      deleteMutation.mutate(opp.id, { onSuccess: closeDetail })
    }
  }

  const handleScheduleMeeting = () => {
    if (!opp) return
    scheduleMeeting({
      relatedType: 'Lead', relatedId: opp.id,
      relatedLabel: `${opp.title} — ${opp.company}`,
      title: `Meeting — ${opp.company}`,
    })
  }

  const handleCreateTask = () => {
    if (!opp) return
    const nextWeek = (() => {
      const d = new Date(); d.setDate(d.getDate() + 7)
      return d.toISOString().split('T')[0]
    })()
    createTask({
      relatedType: 'Meeting', relatedId: opp.id,
      relatedLabel: opp.title,
      title: `Follow-up: ${opp.title}`,
      dueDate: nextWeek, assignee: opp.assignee || '',
    })
  }

  const sc = opp ? (OPP_STAGE_COLORS[opp.stage] ?? OPP_STAGE_COLORS.New) : OPP_STAGE_COLORS.New

  return (
    <>
      {detailPanelOpen && (
        <div className="fixed inset-0 bg-black/20 z-30" onClick={closeDetail} />
      )}

      <div className={`
        fixed inset-y-0 right-0 z-40 w-[400px] max-w-full bg-white shadow-card-lg
        flex flex-col transition-transform duration-300 ease-in-out
        ${detailPanelOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {isLoading ? (
          <div className="p-5 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : !opp ? null : (
          <>
            {/* Header */}
            <div className="p-5 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h3 className="font-display font-bold text-base text-gray-900 leading-snug">{opp.title}</h3>
                  {opp.company && (
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                      <Building2 size={11} /> {opp.company}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {perms.canEdit && (
                    <button onClick={() => openEditModal(opp.id)} className="p-2 rounded-xl text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors" title="Edit">
                      <Pencil size={15} />
                    </button>
                  )}
                  {perms.canDelete && (
                    <button onClick={handleDelete} className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete">
                      <Trash2 size={15} />
                    </button>
                  )}
                  <button onClick={closeDetail} className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                    <X size={15} />
                  </button>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${sc.light}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${sc.bg}`} />
                {opp.stage}
              </span>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Financials */}
              <div className="grid grid-cols-3 gap-3">
                <FinCard icon={DollarSign}  label="Value"       value={fmt(opp.value)} />
                <FinCard icon={TrendingUp}  label="Probability" value={`${opp.probability}%`} />
                <FinCard icon={DollarSign}  label="Exp. Revenue" value={fmt(opp.expectedRevenue)} color="text-emerald-600" />
              </div>

              <Section title="Details">
                <InfoRow icon={Calendar} label="Close Date"  value={opp.expectedCloseDate || '—'} />
                <InfoRow icon={Mail}     label="Email"       value={opp.email} href={opp.email ? `mailto:${opp.email}` : null} />
                <InfoRow icon={Phone}    label="Phone"       value={opp.phone} href={opp.phone ? `tel:${opp.phone}` : null} />
                <InfoRow icon={Calendar} label="Created"     value={opp.createdAt} />
              </Section>

              {opp.assignee && (
                <Section title="Assignee">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <Avatar name={opp.assignee} size="md" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{opp.assignee}</p>
                      {assigneeRole && (
                        <p className="text-xs text-gray-400">{assigneeRole}</p>
                      )}
                    </div>
                  </div>
                </Section>
              )}

              {opp.notes && (
                <Section title="Notes">
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3 leading-relaxed">{opp.notes}</p>
                </Section>
              )}

              {opp.tags?.length > 0 && (
                <Section title="Tags">
                  <div className="flex flex-wrap gap-2">
                    {opp.tags.map((t) => (
                      <span key={t} className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                        <Tag size={10} /> {t}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {/* Quick actions */}
              {(perms.canEdit) && (
                <Section title="Actions">
                  <div className="flex gap-2">
                    <button
                      onClick={handleScheduleMeeting}
                      className="flex-1 text-xs font-semibold py-2 px-3 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Calendar size={12} /> Schedule Meeting
                    </button>
                    <button
                      onClick={handleCreateTask}
                      className="flex-1 text-xs font-semibold py-2 px-3 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 size={12} /> Add Task
                    </button>
                  </div>
                </Section>
              )}

              {/* ── Unified Timeline ───────────────────────────────────── */}
              <TimelinePanel
                entityType="opportunity"
                entityId={opp.id}
                entityLabel={opp.title}
              />
            </div>
          </>
        )}
      </div>
    </>
  )
}

function FinCard({ icon: Icon, label, value, color = 'text-gray-900' }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 text-center">
      <Icon size={14} className="text-gray-400 mx-auto mb-1" />
      <p className={`font-display font-bold text-sm ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}

function Section({ title, icon: Icon, children }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1">
        {Icon && <Icon size={10} className="text-gray-300" />}
        {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value, href }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <Icon size={13} className="text-gray-400 flex-shrink-0" />
      <span className="text-xs text-gray-500 w-24 flex-shrink-0">{label}</span>
      {href ? (
        <a href={href} onClick={(e) => e.stopPropagation()} className="text-sm text-teal-600 hover:underline font-medium truncate">{value}</a>
      ) : (
        <span className="text-sm text-gray-800 font-medium truncate">{value || '—'}</span>
      )}
    </div>
  )
}
