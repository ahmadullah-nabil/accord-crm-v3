import React from 'react'
import {
  ChevronUp, ChevronDown, ChevronsUpDown,
  MoreHorizontal, Eye, Pencil, Trash2, CheckCircle2, Circle,
  AlertCircle, Link2,
} from 'lucide-react'
import { useTasksStore }                          from '../../stores/tasksStore.js'
import { useDeleteTask, useToggleTaskComplete }   from '../../hooks/useTasks.js'
import { STATUS_CONFIG, PRIORITY_CONFIG, daysUntilDue } from '../../lib/tasksData.js'
import { Avatar }                                 from '../ui/Avatar.jsx'
import { Skeleton }                               from '../ui/Skeleton.jsx'
import { EmptyState }                             from '../ui/EmptyState.jsx'
import { CheckSquare }                            from 'lucide-react'

const COLS = [
  { key: 'done',        label: '',          sortable: false, width: 'w-10' },
  { key: 'title',       label: 'Task',      sortable: true  },
  { key: 'status',      label: 'Status',    sortable: true,  width: 'w-28' },
  { key: 'priority',    label: 'Priority',  sortable: true,  width: 'w-24' },
  { key: 'dueDate',     label: 'Due Date',  sortable: true,  width: 'w-28' },
  { key: 'assignee',    label: 'Assignee',  sortable: false, width: 'w-32' },
  { key: 'relatedLabel',label: 'Related',   sortable: false, width: 'w-40' },
  { key: 'actions',     label: '',          sortable: false, width: 'w-12' },
]

export function TasksTable({ tasks, isLoading }) {
  const { sortField, sortDir, setSort, openDetail, openEditModal } = useTasksStore()
  const deleteMutation = useDeleteTask()
  const toggleMutation = useToggleTaskComplete()

  if (isLoading) return <TableSkeleton />

  if (!tasks.length) {
    return (
      <div className="card">
        <EmptyState
          icon={CheckSquare}
          title="No tasks found"
          description="Try adjusting your search or filter criteria, or add a new task."
        />
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              {COLS.map((col) => (
                <th
                  key={col.key}
                  onClick={col.sortable ? () => setSort(col.key) : undefined}
                  className={`px-4 py-3 text-left text-xs font-semibold text-gray-500
                    uppercase tracking-wider whitespace-nowrap ${col.width || ''}
                    ${col.sortable ? 'cursor-pointer select-none hover:text-gray-700 group' : ''}`}
                >
                  {col.label && (
                    <span className="flex items-center gap-1">
                      {col.label}
                      {col.sortable && (
                        sortField === col.key
                          ? sortDir === 'asc'
                            ? <ChevronUp size={12} className="text-teal-500" />
                            : <ChevronDown size={12} className="text-teal-500" />
                          : <ChevronsUpDown size={11} className="text-gray-300 group-hover:text-gray-400" />
                      )}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onOpen={() => openDetail(task.id)}
                onEdit={() => openEditModal(task.id)}
                onDelete={() => {
                  if (window.confirm(`Delete task "${task.title}"?`)) {
                    deleteMutation.mutate(task.id)
                  }
                }}
                onToggle={() =>
                  toggleMutation.mutate({ id: task.id, currentStatus: task.status })
                }
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2.5 border-t border-gray-50 bg-gray-50/40">
        <p className="text-xs text-gray-400">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────
function TaskRow({ task, onOpen, onEdit, onDelete, onToggle }) {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const sc  = STATUS_CONFIG[task.status]   || STATUS_CONFIG['Todo']
  const pc  = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG['Low']
  const days = daysUntilDue(task.dueDate)
  const isComplete = task.status === 'Completed'

  // Due date display helpers
  const dueDateLabel = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
    : '—'

  const dueDateClass =
    isComplete         ? 'text-gray-400' :
    days === null      ? 'text-gray-400' :
    days < 0           ? 'text-red-600 font-semibold' :
    days === 0         ? 'text-orange-600 font-semibold' :
    days <= 2          ? 'text-amber-600' :
                         'text-gray-600'

  const dueDateSub =
    isComplete    ? null :
    days === null ? null :
    days < 0      ? `${Math.abs(days)}d overdue` :
    days === 0    ? 'Due today' :
    days === 1    ? 'Tomorrow' :
                    null

  return (
    <tr
      onClick={onOpen}
      className={`transition-colors duration-100 cursor-pointer group
        ${isComplete ? 'bg-gray-50/30 hover:bg-gray-50/60' : 'hover:bg-gray-50/60'}`}
    >
      {/* Completion checkbox */}
      <td className="px-4 py-3" onClick={(e) => { e.stopPropagation(); onToggle() }}>
        <button
          className={`transition-colors duration-150
            ${isComplete ? 'text-emerald-500 hover:text-emerald-600' : 'text-gray-300 hover:text-teal-500'}`}
          title={isComplete ? 'Mark as Todo' : 'Mark as Completed'}
        >
          {isComplete
            ? <CheckCircle2 size={18} />
            : <Circle size={18} />
          }
        </button>
      </td>

      {/* Title + related */}
      <td className="px-4 py-3 min-w-[180px] max-w-[280px]">
        <p className={`font-medium text-sm leading-tight truncate
          ${isComplete ? 'line-through text-gray-400' : 'text-gray-900'}`}>
          {task.title}
        </p>
        {task.relatedLabel && (
          <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1 truncate">
            <Link2 size={10} className="flex-shrink-0" />
            {task.relatedLabel}
          </p>
        )}
      </td>

      {/* Status badge */}
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sc.dot}`} />
          {sc.label}
        </span>
      </td>

      {/* Priority badge */}
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${pc.color}`}>
          {pc.label}
        </span>
      </td>

      {/* Due date */}
      <td className="px-4 py-3">
        <div>
          <span className={`text-xs ${dueDateClass}`}>{dueDateLabel}</span>
          {dueDateSub && (
            <p className={`text-[10px] mt-0.5 ${days < 0 ? 'text-red-500' : 'text-amber-500'}`}>
              {days < 0 && <AlertCircle size={9} className="inline mr-0.5" />}
              {dueDateSub}
            </p>
          )}
        </div>
      </td>

      {/* Assignee */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Avatar name={task.assignee} size="xs" />
          <span className="text-xs text-gray-600 truncate max-w-[72px]">
            {task.assignee?.split(' ')[0]}
          </span>
        </div>
      </td>

      {/* Related */}
      <td className="px-4 py-3 max-w-[160px]">
        {task.relatedType && task.relatedType !== 'None' && task.relatedId ? (
          <div>
            <span className={`text-[10px] font-semibold uppercase tracking-wide
              ${task.relatedType === 'Lead' ? 'text-blue-500' : 'text-purple-500'}`}>
              {task.relatedType}
            </span>
            <p className="text-xs text-gray-500 truncate">{task.relatedId}</p>
          </div>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100
              transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreHorizontal size={15} />
          </button>
          {menuOpen && (
            <RowMenu
              onOpen={() => { onOpen(); setMenuOpen(false) }}
              onEdit={() => { onEdit(); setMenuOpen(false) }}
              onDelete={() => { onDelete(); setMenuOpen(false) }}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Row dropdown menu ─────────────────────────────────────────────────────────
function RowMenu({ onOpen, onEdit, onDelete, onClose }) {
  React.useEffect(() => {
    const handler = () => onClose()
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [onClose])

  return (
    <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-card-lg border
      border-gray-100 py-1 min-w-[130px] animate-fade-in">
      <MenuItem icon={Eye}    label="View"   onClick={onOpen}   />
      <MenuItem icon={Pencil} label="Edit"   onClick={onEdit}   />
      <MenuItem icon={Trash2} label="Delete" onClick={onDelete} danger />
    </div>
  )
}

function MenuItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors
        ${danger ? 'text-red-500 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}`}
    >
      <Icon size={13} />
      {label}
    </button>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="divide-y divide-gray-50">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-4">
            <Skeleton className="w-5 h-5 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-52" />
              <Skeleton className="h-3 w-36" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-6 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
