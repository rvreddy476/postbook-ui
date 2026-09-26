'use client'

import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import CreatePortal from '@/components/CreatePortal'
import './group-post-dialog.css'

/** Native top layer: page headers, transformed parents and FABs cannot cover it. */
export default function GroupPostDialog({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    const trigger = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog?.showModal()
    return () => {
      dialog?.close()
      document.body.style.overflow = previousOverflow
      if (trigger?.isConnected) trigger.focus()
    }
  }, [])

  if (typeof document === 'undefined') return null
  return createPortal(
    <dialog
      ref={dialogRef}
      className="group-post-dialog"
      aria-label="Create group post"
      onCancel={event => { if (event.target === event.currentTarget) { event.preventDefault(); onClose() } }}
      onKeyDownCapture={event => {
        // Own Escape here, rather than also invoking the legacy window handler.
        if ((event.target as HTMLElement).closest('dialog') !== event.currentTarget) return
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
      }}
    >
      <CreatePortal groupId={groupId} onClose={onClose} />
    </dialog>,
    document.body,
  )
}
