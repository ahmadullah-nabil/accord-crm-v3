// ─── Tasks React Query Hooks ──────────────────────────────────────────────────
//
// All data operations for the Tasks module go through these hooks.
// They delegate to tasksService.js (Supabase) — UI components are unchanged.
//
// Auth guard
// ──────────
// Every query is gated on isAuthenticated so no request fires before the
// Supabase session is restored on page load (which would fail RLS and show
// a spurious error state).

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore.js'
import {
  getTasks,
  getTaskById,
  insertTask,
  patchTask,
  removeTask,
} from '../services/tasksService.js'
import { logActivity, ACTIVITY_TYPES } from '../services/activityService.js'
import {
  notifyTaskAssignment,
  resolveNotificationRecipient,
} from '../services/notificationsService.js'
import { useInvalidateActivities }      from './useActivities.js'
import { ownershipStamp }               from '../lib/users.js'

// ── Stable query keys ─────────────────────────────────────────────────────────
export const taskKeys = {
  all:    () => ['tasks'],
  detail: (id) => ['tasks', id],
}

// ── useTasks — fetch list ──────────────────────────────────────────────────────
export function useTasks() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return useQuery({
    queryKey: taskKeys.all(),
    queryFn:  getTasks,
    staleTime: 1000 * 60 * 2,
    enabled:   isAuthenticated,
  })
}

// ── useTask — fetch one ────────────────────────────────────────────────────────
export function useTask(id) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn:  () => getTaskById(id),
    enabled:  isAuthenticated && Boolean(id),
    staleTime: 1000 * 60 * 2,
  })
}

// ── useCreateTask ─────────────────────────────────────────────────────────────
export function useCreateTask() {
  const qc            = useQueryClient()
  const invalidateAct = useInvalidateActivities()

  return useMutation({
    // Wrap insertTask to stamp createdBy from the current auth user
    mutationFn: (payload) => {
      const authUser = useAuthStore.getState().user
      const { createdBy } = ownershipStamp(authUser)
      return insertTask({ ...payload, createdBy })
    },
    onSuccess: (newTask) => {
      // Prepend to list cache — no extra round-trip
      qc.setQueryData(taskKeys.all(), (old = []) => [newTask, ...old])

      const authUser = useAuthStore.getState().user
      const actor    = authUser?.name ?? 'Unknown'
      const actorId  = authUser?.id   ?? null
      logActivity({
        type:        ACTIVITY_TYPES.TASK_CREATED,
        actor,
        actorId,
        action:      'created task',
        subject:     newTask.title,
        detail:      newTask.relatedLabel
                       ? `Re: ${newTask.relatedLabel}`
                       : newTask.dueDate ?? '',
        entityType:  'task',
        entityId:    newTask.id,
        entityLabel: newTask.title,
      }).then(() => {
        invalidateAct('task', newTask.id)
        if (newTask.relatedType === 'Meeting' && newTask.relatedId) {
          invalidateAct('meeting', newTask.relatedId)
        }
        if (newTask.relatedType === 'Lead' && newTask.relatedId) {
          invalidateAct('lead', newTask.relatedId)
        }
      })

      // Notify the assignee — onSuccess only, so an insert that failed can
      // never notify. Fire-and-forget.
      resolveNotificationRecipient(newTask.assignee, actorId)
        .then((recipientId) => {
          if (!recipientId) return          // unassigned, unknown, or self
          return notifyTaskAssignment({
            recipientId,
            actorName: actor,
            actorId,
            taskTitle: newTask.title,
            taskId:    newTask.id,
            dueDate:   newTask.dueDate ?? null,
          })
        })
        .catch((err) => console.warn('[useTasks] task assignment notify failed:', err?.message))
    },
    onError: () => {
      // Re-sync if the insert failed
      qc.invalidateQueries({ queryKey: taskKeys.all() })
    },
  })
}

// ── useUpdateTask ─────────────────────────────────────────────────────────────
export function useUpdateTask() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }) => patchTask(id, data),
    onSuccess: (updated) => {
      // Read the pre-update row from cache BEFORE overwriting it, so the
      // comparison below sees the real previous assignee.
      const previousAssignee =
        (qc.getQueryData(taskKeys.all()) ?? []).find((t) => t.id === updated.id)?.assignee ?? ''

      qc.setQueryData(taskKeys.all(), (old = []) =>
        old.map((t) => (t.id === updated.id ? updated : t))
      )
      // Also update detail cache so the drawer shows fresh data
      qc.setQueryData(taskKeys.detail(updated.id), updated)

      // Reassignment only. Editing a title or due date notifies nobody.
      if (updated.assignee && updated.assignee !== previousAssignee) {
        const authUser = useAuthStore.getState().user
        const actorId  = authUser?.id   ?? null
        const actor    = authUser?.name ?? 'Unknown'

        resolveNotificationRecipient(updated.assignee, actorId)
          .then((recipientId) => {
            if (!recipientId) return
            return notifyTaskAssignment({
              recipientId,
              actorName: actor,
              actorId,
              taskTitle: updated.title,
              taskId:    updated.id,
              dueDate:   updated.dueDate ?? null,
            })
          })
          .catch((err) => console.warn('[useTasks] task reassignment notify failed:', err?.message))
      }
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all() })
    },
  })
}

// ── useDeleteTask ─────────────────────────────────────────────────────────────
export function useDeleteTask() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: removeTask,

    // Optimistic: remove from list immediately so the UI feels instant
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: taskKeys.all() })
      const previous = qc.getQueryData(taskKeys.all())
      qc.setQueryData(taskKeys.all(), (old = []) =>
        old.filter((t) => t.id !== id)
      )
      return { previous }
    },

    // Roll back on Supabase error
    onError: (_err, _id, context) => {
      if (context?.previous) {
        qc.setQueryData(taskKeys.all(), context.previous)
      }
    },

    // Always clean up detail cache and re-validate list
    onSettled: (_data, _err, id) => {
      qc.removeQueries({ queryKey: taskKeys.detail(id) })
      qc.invalidateQueries({ queryKey: taskKeys.all() })
    },
  })
}

// ── useMeetingTasks — tasks linked to a specific meeting ──────────────────────
// Uses the SAME queryKey as useTasks() so it shares the React Query cache.
// When useCreateTask / useDeleteTask update ['tasks'], the meeting panel's
// task list re-derives its filtered view automatically via `select`.
//
// relatedType is stored as 'Meeting' to match RELATED_TYPES in tasksData.js.
export function useMeetingTasks(meetingId) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return useQuery({
    queryKey: taskKeys.all(),              // shared cache — same as useTasks()
    queryFn:  getTasks,
    staleTime: 1000 * 60 * 2,
    enabled:   isAuthenticated && Boolean(meetingId),
    select: (tasks) =>
      tasks
        .filter(
          (t) =>
            t.relatedId === String(meetingId) &&
            t.relatedType === 'Meeting',
        )
        .sort((a, b) => {
          // Soonest due date first; null dates at end
          if (!a.dueDate) return 1
          if (!b.dueDate) return -1
          return a.dueDate.localeCompare(b.dueDate)
        }),
  })
}

export function useContactTasks(contactId) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return useQuery({
    queryKey: taskKeys.all(),
    queryFn:  getTasks,
    staleTime: 1000 * 60 * 2,
    enabled:   isAuthenticated && Boolean(contactId),
    select: (tasks) =>
      tasks
        .filter(
          (t) =>
            t.relatedId === String(contactId) &&
            t.relatedType === 'Contact',
        )
        .sort((a, b) => {
          if (!a.dueDate) return 1
          if (!b.dueDate) return -1
          return a.dueDate.localeCompare(b.dueDate)
        }),
  })
}

export function useLeadTasks(leadId) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return useQuery({
    queryKey: taskKeys.all(),
    queryFn:  getTasks,
    staleTime: 1000 * 60 * 2,
    enabled:   isAuthenticated && Boolean(leadId),
    select: (tasks) =>
      tasks
        .filter(
          (t) =>
            t.relatedId === String(leadId) &&
            t.relatedType === 'Lead',
        )
        .sort((a, b) => {
          if (!a.dueDate) return 1
          if (!b.dueDate) return -1
          return a.dueDate.localeCompare(b.dueDate)
        }),
  })
}

// ── useToggleTaskComplete ──────────────────────────────────────────────────────
// Toggles status between 'Completed' and 'Todo'.
// completedAt is handled server-side by the service's toDb() mapper.
export function useToggleTaskComplete() {
  const qc            = useQueryClient()
  const invalidateAct = useInvalidateActivities()

  return useMutation({
    mutationFn: ({ id, currentStatus }) =>
      patchTask(id, {
        status: currentStatus === 'Completed' ? 'Todo' : 'Completed',
      }),

    // Optimistic toggle — flip status immediately in the list
    onMutate: async ({ id, currentStatus }) => {
      await qc.cancelQueries({ queryKey: taskKeys.all() })
      const previous = qc.getQueryData(taskKeys.all())
      const nextStatus = currentStatus === 'Completed' ? 'Todo' : 'Completed'
      qc.setQueryData(taskKeys.all(), (old = []) =>
        old.map((t) =>
          t.id === id
            ? { ...t, status: nextStatus, completedAt: nextStatus === 'Completed' ? new Date().toISOString().split('T')[0] : null }
            : t
        )
      )
      return { previous }
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(taskKeys.all(), context.previous)
      }
    },

    onSuccess: (updated, { currentStatus }) => {
      // Replace the optimistic record with the real DB response
      qc.setQueryData(taskKeys.all(), (old = []) =>
        old.map((t) => (t.id === updated.id ? updated : t))
      )
      qc.setQueryData(taskKeys.detail(updated.id), updated)

      // Log activity for status transitions to/from Completed
      const wasCompleted = currentStatus === 'Completed'
      const authUser = useAuthStore.getState().user
      const actor    = authUser?.name ?? 'Unknown'
      const actorId  = authUser?.id   ?? null
      const actType = wasCompleted
        ? ACTIVITY_TYPES.TASK_REOPENED
        : ACTIVITY_TYPES.TASK_COMPLETED

      logActivity({
        type:        actType,
        actor,
        actorId,
        action:      wasCompleted ? 're-opened task' : 'completed task',
        subject:     updated.title,
        detail:      updated.relatedLabel ? `Re: ${updated.relatedLabel}` : '',
        entityType:  'task',
        entityId:    updated.id,
        entityLabel: updated.title,
      }).then(() => {
        invalidateAct('task', updated.id)
        if (updated.relatedType === 'Meeting' && updated.relatedId) {
          invalidateAct('meeting', updated.relatedId)
        }
        if (updated.relatedType === 'Lead' && updated.relatedId) {
          invalidateAct('lead', updated.relatedId)
        }
      })
    },

    onSettled: (_data, _err, { id }) => {
      qc.invalidateQueries({ queryKey: taskKeys.all() })
      qc.invalidateQueries({ queryKey: taskKeys.detail(id) })
    },
  })
}
