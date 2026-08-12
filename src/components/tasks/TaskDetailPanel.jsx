import React from 'react'
import {
  X, Calendar, User, Tag, Link2, Pencil, Trash2,
  CheckCircle2, Circle, Clock, FileText, AlertCircle,
} from 'lucide-react'
import { useTasksStore }                            from '../../stores/tasksStore.js'
import { useTask, useDeleteTask, useToggleTaskComplete } from '../../hooks/useTasks.js'
import { STATUS_CONFIG, PRIORITY_CONFIG, daysUntilDue } from '../../lib/tasksData.js'
import { TimelinePanel }                           from '../timeline/TimelinePanel.jsx'
import { Avatar }                                  from '../ui/Avatar.jsx'
import { Skeleton, SkeletonText }                  from '../ui/Skeleton.jsx'

export function TaskDetailPanel() {
  const { detailPanelOpen, closeDetail, selectedTaskId, openEditModal } = useTasksStore()
  const deleteMutation = useDeleteTask()
  const toggleMutation = useToggleTaskComplete()

  const { data: task, isLoading } = useTask(
    detailPanelOpen ? selectedTaskId : null
  )

  const handleDelete = () => {
    if (!task) return
    if (window.confirm(`Delete task "${task.title}"?`)) {
      deleteMutation.mutate(task.id, { onSuccess: closeDetail })
    }
  }

  const handleToggle = () => {
    if (!task) return
    toggleMutation.mutate({ id: task.id, currentStatus: task.status })
  }

  return (
    <>
      {detailPanelOpen && (
        <div className="fixed inset-0 bg-black/30 z-[55]" onClick={closeDetail} />
      )}

      <div
        className={`
          fixed inset-y-0 right-0 z-[60] w-[420px] max-w-full bg-white shadow-card-lg
          flex flex-col transition-transform duration-300 ease-in-out
          ${detailPanelOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {isLoading ? (
          <PanelSkeleton onClose={closeDetail} />
        ) : !task ? null : (
          <TaskPanelContent
            task={task}
            onClose={closeDetail}
            onEdit={() => openEditModal(task.id)}
            onDelete={handleDelete}
            onToggle={handleToggle}
            isToggling={toggleMutation.isPending}
          />
        )}
      </div>
    </>
  )
}

// ── Panel content (extracted for clarity) ────────────────────────────────────
function TaskPanelContent({ task, onClose, onEdit, onDelete, onToggle, isToggling }) {
  const sc    = STATUS_CONFIG[task.status]     || STATUS_CONFIG['Todo']
  const pc    = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG['Low']
  const days  = daysUntilDue(task.dueDate)
  const isComplete = task.status === 'Completed'

  const dueDateLabel = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'

  const dueDateNote =
    isComplete    ? null :
    days === null ? null :
    days < 0      ? `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} overdue` :
    days === 0    ? 'Due today' :
    days === 1    ? 'Due tomorrow' :
                    `${days} days remaining`

  const dueDateNoteClass =
    days !== null && days < 0  ? 'text-red-500' :
    days !== null && days === 0 ? 'text-orange-500' :
    days !== null && days <= 2  ? 'text-amber-500' :
                                  'text-gray-400'

  return (
    <>
      {/* Header */}
      <div className="p-5 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-start justify-between gap-3 mb-3">
          {/* Completion toggle + title */}
          <div className="flex items-start gap-3 min-w-0">
            <button
              onClick={onToggle}
              disabled={isToggling}
              className={`mt-0.5 flex-shrink-0 transition-colors duration-150
                ${isComplete ? 'text-emerald-500 hover:text-emerald-600' : 'text-gray-300 hover:text-teal-500'}`}
              title={isComplete ? 'Mark as Todo' : 'Mark as Completed'}
            >
              {isComplete ? <CheckCircle2 size={20} /> : <Circle size={20} />}
            </button>
            <h3 className={`font-display font-bold text-base leading-snug
              ${isComplete ? 'line-through text-gray-400' : 'text-gray-900'}`}>
              {task.title}
            </h3>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onEdit}
              className="p-2 rounded-xl text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
              title="Edit"
            >
              <Pencil size={15} />
            </button>
            <button
              onClick={onDelete}
              className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Delete"
            >
              <Trash2 size={15} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title="Close"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Status + Priority row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${sc.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
            {sc.label}
          </span>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${pc.color}`}>
            {pc.label} Priority
          </span>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Description */}
        {task.description && (
          <Section title="Description" icon={FileText}>
            <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-xl p-3">
              {task.description}
            </p>
          </Section>
        )}

        {/* Due date */}
        <Section title="Due Date" icon={Calendar}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800">{dueDateLabel}</span>
            {dueDateNote && (
              <span className={`text-xs font-medium flex items-center gap-1 ${dueDateNoteClass}`}>
                {days !== null && days < 0 && <AlertCircle size={11} />}
                {dueDateNote}
              </span>
            )}
          </div>
        </Section>

        {/* Assignee */}
        <Section title="Assignee" icon={User}>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <Avatar name={task.assignee} size="md" />
            <div>
              <p className="text-sm font-medium text-gray-900">{task.assignee}</p>
              <p className="text-xs text-gray-500">Responsible</p>
            </div>
          </div>
        </Section>

        {/* Related */}
        {task.relatedType && task.relatedType !== 'None' && (
          <Section title="Related" icon={Link2}>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full
                ${task.relatedType === 'Lead' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                {task.relatedType}
              </span>
              <span className="text-sm text-gray-700">{task.relatedLabel || task.relatedId}</span>
            </div>
          </Section>
        )}

        {/* Tags */}
        {task.tags?.length > 0 && (
          <Section title="Tags" icon={Tag}>
            <div className="flex flex-wrap gap-2">
              {task.tags.map((tag) => (
                <span key={tag}
                  className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                  <Tag size={10} /> {tag}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Metadata */}
        <Section title="Details" icon={Clock}>
          <InfoRow label="Task ID"   value={task.id} />
          <InfoRow label="Created"   value={task.createdAt} />
          {task.completedAt && (
            <InfoRow label="Completed" value={task.completedAt} />
          )}
        </Section>

        {/* ── Unified Timeline ────────────────────────────────────────────── */}
        <TimelinePanel
          entityType="task"
          entityId={task.id}
          entityLabel={task.title}
        />
      </div>
    </>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5">
        {Icon && <Icon size={11} className="text-gray-300" />}
        {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-xs text-gray-500 w-24 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-800 font-medium">{value}</span>
    </div>
  )
}

function PanelSkeleton({ onClose }) {
  return (
    <>
      <div className="flex items-start justify-between p-5 border-b border-gray-100">
        <div className="flex items-start gap-3 flex-1">
          <Skeleton className="w-5 h-5 rounded-full mt-0.5 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 ml-2">
          <X size={15} />
        </button>
      </div>
      <div className="p-5 space-y-5">
        <div className="flex gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <SkeletonText lines={3} />
        <SkeletonText lines={2} />
      </div>
    </>
  )
}
