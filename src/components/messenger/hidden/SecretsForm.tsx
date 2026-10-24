'use client'

import { useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

import {
  CHAT_PASSWORD_MAX,
  SECRET_KEY_MAX,
  setupProblems,
  type FormProblems,
} from '@/lib/chat/hiddenChats/validation'

/*
  Set (or reset) both hidden-chat secrets: the secret key that reveals the
  hidden list, and the chat password that opens a hidden chat. Used by the
  first-time setup sheet in Messages, the settings page, and the reset after
  signing in again.
*/

const inputClass =
  'w-full rounded-xl border border-brand-divider bg-brand-secondary px-3 py-2.5 pr-10 text-[14px] text-brand-text outline-hidden transition-colors placeholder:text-brand-text/40 focus:border-primary-outline focus:bg-brand-bg'

export function SecretField({
  id,
  label,
  hint,
  value,
  onChange,
  maxLength,
  problem,
  autoFocus,
}: {
  id: string
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  maxLength?: number
  problem?: string
  autoFocus?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-[12px] font-semibold text-brand-text/70">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maxLength}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? `${id}-problem` : hint ? `${id}-hint` : undefined}
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-brand-text/50 hover:text-brand-text"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {problem ? (
        <p id={`${id}-problem`} className="text-[12px] text-danger">{problem}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[12px] text-brand-text/50">{hint}</p>
      ) : null}
    </div>
  )
}

export function SecretsForm({
  idPrefix,
  submitLabel,
  onSubmit,
  onCancel,
  note,
}: {
  idPrefix: string
  submitLabel: string
  /** Throws a message (string or Error) the form shows. */
  onSubmit: (secretKey: string, chatPassword: string) => Promise<void>
  onCancel?: () => void
  note?: React.ReactNode
}) {
  const [secretKey, setSecretKey] = useState('')
  const [chatPassword, setChatPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [problems, setProblems] = useState<FormProblems | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    const found = setupProblems({ secretKey, chatPassword, confirmPassword })
    setProblems(found)
    if (found) return
    setBusy(true)
    try {
      await onSubmit(secretKey, chatPassword)
      setSecretKey('')
      setChatPassword('')
      setConfirmPassword('')
    } catch (err) {
      setProblems({ form: err instanceof Error ? err.message : typeof err === 'string' ? err : "Couldn't save. Try again." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <SecretField
        id={`${idPrefix}-key`}
        label="Secret key"
        hint="4 to 12 letters or numbers. Type it into chat search to see your hidden chats."
        value={secretKey}
        onChange={setSecretKey}
        maxLength={SECRET_KEY_MAX}
        problem={problems?.secretKey}
        autoFocus
      />
      <SecretField
        id={`${idPrefix}-password`}
        label="Chat password"
        hint="6 to 64 characters, different from your secret key. Needed to open a hidden chat."
        value={chatPassword}
        onChange={setChatPassword}
        maxLength={CHAT_PASSWORD_MAX}
        problem={problems?.chatPassword}
      />
      <SecretField
        id={`${idPrefix}-confirm`}
        label="Confirm chat password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        maxLength={CHAT_PASSWORD_MAX}
        problem={problems?.confirmPassword}
      />
      {note}
      {problems?.form && <p role="alert" className="text-[13px] text-danger">{problems.form}</p>}
      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-[13px] font-semibold text-brand-text hover:bg-brand-secondary">
            Cancel
          </button>
        )}
        <button type="submit" disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-primary-ink px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
