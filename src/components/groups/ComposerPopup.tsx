'use client'

import React, { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, X } from 'lucide-react'

/** A child modal leaves the editor and its unsent draft mounted underneath. */
export default function ComposerPopup({ title, onClose, children, back = false }: {
  title: string; onClose: () => void; children: React.ReactNode; back?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const popup = ref.current
    const opener = document.activeElement as HTMLElement | null
    popup?.showModal()
    popup?.querySelector<HTMLInputElement>('input[type="search"]')?.focus()
    return () => { popup?.close(); if (opener?.isConnected) opener.focus() }
  }, [])
  if (typeof document === 'undefined') return null
  return createPortal(
    <dialog ref={ref} className={`composer-popup${back ? ' composer-popup--groups' : ''}`} aria-labelledby={titleId}
      onKeyDown={event => event.stopPropagation()}
      onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose() }}
      onKeyDownCapture={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
      }}>
      <header>{back && <button type="button" aria-label="Back to post" onClick={onClose}><ArrowLeft size={20} /></button>}<h2 id={titleId}>{title}</h2>{!back && <button type="button" aria-label={`Close ${title}`} onClick={onClose}><X size={18} /></button>}</header>
      {children}
    </dialog>, document.body,
  )
}
