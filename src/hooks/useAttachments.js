// ─── Attachment hooks ─────────────────────────────────────────────────────────
//
// queryKey: ['attachments', relatedType, relatedId]
//
// Keyed per record rather than one big list: the only question anyone asks is
// "what is attached to this lead", and a global list would refetch every
// record's files whenever one changed.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback } from 'react'
import {
  listAttachments, uploadAttachment, deleteAttachment, getDownloadUrl,
} from '../services/attachmentService.js'

export const attachmentKeys = {
  forRecord: (type, id) => ['attachments', type, id],
}

export function useAttachments(relatedType, relatedId) {
  return useQuery({
    queryKey: attachmentKeys.forRecord(relatedType, relatedId),
    queryFn:  () => listAttachments(relatedType, relatedId),
    enabled:  Boolean(relatedType && relatedId),
    staleTime: 30_000,
    placeholderData: [],
  })
}

/**
 * Upload one or more files, reporting per-file progress.
 *
 * Sequential, not parallel. Two reasons, both practical: an upload of several
 * large files in parallel on a Dhaka office connection is slower in aggregate
 * than one at a time, and a partial failure is far easier to describe when you
 * know exactly which file was in flight.
 *
 * A failure does NOT roll back the files that already succeeded. They are
 * legitimately uploaded, and discarding them because the fourth one failed
 * would throw away work the user watched complete.
 */
export function useUploadAttachments(relatedType, relatedId) {
  const qc = useQueryClient()
  const [uploading, setUploading] = useState(null)   // { name, index, total }
  const [errors, setErrors]       = useState([])

  const upload = useCallback(async (files) => {
    const list = Array.from(files ?? [])
    if (list.length === 0) return []

    const done = []
    const failed = []

    for (let i = 0; i < list.length; i++) {
      const file = list[i]
      setUploading({ name: file.name, index: i + 1, total: list.length })
      try {
        done.push(await uploadAttachment(file, { relatedType, relatedId }))
      } catch (err) {
        failed.push(err.message ?? `${file.name} failed to upload.`)
      }
    }

    setUploading(null)
    setErrors(failed)

    if (done.length > 0) {
      qc.invalidateQueries({ queryKey: attachmentKeys.forRecord(relatedType, relatedId) })
    }
    return done
  }, [qc, relatedType, relatedId])

  return { upload, uploading, errors, clearErrors: () => setErrors([]) }
}

export function useDeleteAttachment(relatedType, relatedId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, storagePath }) => deleteAttachment(id, storagePath),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: attachmentKeys.forRecord(relatedType, relatedId) }),
  })
}

/**
 * Open a file in a new tab via a short-lived signed URL.
 *
 * The URL is minted on click, never stored in component state or rendered into
 * an href. A signed URL is a bearer token: anything that puts it in the DOM
 * puts it in the page source, in screenshots, and in the browser history.
 */
export function useOpenAttachment() {
  return useCallback(async (storagePath) => {
    const url = await getDownloadUrl(storagePath)
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [])
}
