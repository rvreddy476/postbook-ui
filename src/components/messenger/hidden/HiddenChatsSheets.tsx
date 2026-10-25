'use client'

import { useEffect, useState } from 'react'
import { KeyRound, Loader2, Lock, X } from 'lucide-react'

import { HIDDEN_CHATS_COPY, KEY_NOT_RECOGNISED } from '@/lib/chat/hiddenChats/copy'
import {
  hiddenErrorOf,
  lockedMessage,
  settingsErrorMessage,
  wrongPasswordMessage,
  type HiddenError,
  type HiddenSettings,
} from '@/lib/chat/hiddenChats/requests'
import { CHAT_PASSWORD_MAX, SECRET_KEY_MAX } from '@/lib/chat/hiddenChats/validation'
import { saveHiddenSettings } from '@/services/hiddenChatsApi'
import type { OpenOutcome, RevealOutcome } from '@/services/hiddenChatsApi'
import { SecretField, SecretsForm } from './SecretsForm'

/** A small centred sheet; Escape and the backdrop close it. */
export function SheetShell({ title, icon, onClose, children }: {
  title: string
  icon?: React.ReactNode
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-1100 flex items-center justify-center bg-brand-text/30 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-brand-divider bg-brand-card p-5 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-brand-text">
            {icon}
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full text-brand-text/60 hover:bg-brand-secondary hover:text-brand-text">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** First time: set both secrets, then the chat that asked is hidden. */
export function HiddenChatsSetupSheet({ onClose, onSaved }: {
  onClose: () => void
  onSaved: (settings: HiddenSettings) => void
}) {
  return (
    <SheetShell title="Set up hidden chats" icon={<Lock className="h-4 w-4 text-brand-text/60" />} onClose={onClose}>
      <p className="mb-4 text-[13px] text-brand-text/70">{HIDDEN_CHATS_COPY}</p>
      <SecretsForm
        idPrefix="hidden-setup"
        submitLabel="Save and hide"
        onCancel={onClose}
        onSubmit={async (secretKey, chatPassword) => {
          try {
            const saved = await saveHiddenSettings({ secretKey, chatPassword })
            onSaved(saved ?? { configured: true, strict: false, shortcut: null })
          } catch (err) {
            throw new Error(settingsErrorMessage(hiddenErrorOf(err)))
          }
        }}
      />
    </SheetShell>
  )
}

function revealMessage(e: HiddenError): string {
  // A wrong key and "not set up" answer the same way, on purpose.
  return e.kind === 'locked' ? lockedMessage(e.retryAfterSec) : KEY_NOT_RECOGNISED
}

/** The shortcut's small prompt for the secret key. */
export function SecretKeyPrompt({ onClose, onSubmit }: {
  onClose: () => void
  onSubmit: (key: string) => Promise<RevealOutcome>
}) {
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || !key.trim()) return
    setBusy(true)
    setProblem(null)
    const out = await onSubmit(key)
    setBusy(false)
    setKey('')
    if (out.ok) onClose()
    else setProblem(revealMessage(out.error))
  }

  return (
    <SheetShell title="Secret key" icon={<KeyRound className="h-4 w-4 text-brand-text/60" />} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <SecretField id="hidden-key-prompt" label="Enter your secret key" value={key} onChange={setKey} maxLength={SECRET_KEY_MAX} problem={problem ?? undefined} autoFocus />
        <div className="flex justify-end">
          <button type="submit" disabled={busy || !key.trim()} className="flex items-center gap-1.5 rounded-lg bg-primary-ink px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Open
          </button>
        </div>
      </form>
    </SheetShell>
  )
}

export function passwordMessage(e: HiddenError): string {
  if (e.kind === 'wrong_password') return wrongPasswordMessage(e.attemptsLeft)
  if (e.kind === 'locked') return lockedMessage(e.retryAfterSec)
  if (e.kind === 'not_found') return 'Hidden chats locked again. Enter your secret key first.'
  return "Couldn't check your chat password. Try again."
}

/** Opening a hidden chat: the chat password, once per unlock. */
export function ChatPasswordPrompt({ chatName, onClose, onSubmit, onForgot }: {
  chatName: string
  onClose: () => void
  onSubmit: (password: string) => Promise<OpenOutcome>
  onForgot?: () => void
}) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [lockedOut, setLockedOut] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || !password || lockedOut) return
    setBusy(true)
    setProblem(null)
    const out = await onSubmit(password)
    setBusy(false)
    setPassword('')
    if (out.ok) return onClose()
    setProblem(passwordMessage(out.error))
    if (out.error.kind === 'locked' || (out.error.kind === 'wrong_password' && out.error.attemptsLeft === 0)) setLockedOut(true)
    if (out.error.kind === 'not_found') onClose()
  }

  return (
    <SheetShell title="Chat password" icon={<Lock className="h-4 w-4 text-brand-text/60" />} onClose={onClose}>
      <p className="mb-3 text-[13px] text-brand-text/70">Enter your chat password to open {chatName}.</p>
      <form onSubmit={submit} className="space-y-3">
        <SecretField id="hidden-open-password" label="Chat password" value={password} onChange={setPassword} maxLength={CHAT_PASSWORD_MAX} problem={problem ?? undefined} autoFocus />
        <div className="flex items-center justify-between gap-2">
          {onForgot ? (
            <button type="button" onClick={onForgot} className="text-[12px] font-semibold text-primary-ink hover:underline">Forgot?</button>
          ) : <span />}
          <button type="submit" disabled={busy || !password || lockedOut} className="flex items-center gap-1.5 rounded-lg bg-primary-ink px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Open chat
          </button>
        </div>
      </form>
    </SheetShell>
  )
}
