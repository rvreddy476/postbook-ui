'use client'
import { useEffect, useRef, useState } from 'react'
import { Send, Smile } from 'lucide-react'
import { useCreateReply } from '@/hooks/usePostComments'
import MentionInput from './MentionInput'
import EmojiPickerPopover from './EmojiPickerPopover'

export interface ReplyComposerProps {
  postId: string
  /** The top-level comment the reply attaches to, even when answering a reply. */
  parentId: string
  /** `@username ` when answering a reply; empty for a top-level comment. */
  prefill?: string
  myId?: string
  onDone?: () => void
  onCancel: () => void
  onError?: (error: unknown) => void
}

/** Inline reply box under a comment: mention completion, emoji picker, Enter to send. */
export default function ReplyComposer({ postId, parentId, prefill = '', myId, onDone, onCancel, onError }: ReplyComposerProps) {
  const [text, setText] = useState(prefill)
  const [pickerOpen, setPickerOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const emojiButton = useRef<HTMLButtonElement>(null)
  const reply = useCreateReply()

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])

  const submit = async () => {
    const body = text.trim()
    if (!body || reply.isPending) return
    try {
      await reply.mutateAsync({ commentId: parentId, text: body, postId, authorId: myId })
      setText('')
      setPickerOpen(false)
      onDone?.()
    } catch (error) {
      onError?.(error) // keep the draft for a retry
    }
  }

  const insertEmoji = (native: string) => {
    const el = inputRef.current
    const at = el?.selectionStart ?? text.length
    const next = text.slice(0, at) + native + text.slice(at)
    setText(next)
    setPickerOpen(false)
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + native.length, at + native.length) })
  }

  return (
    <div className="mt-2">
      <form className="flex items-center gap-2" onSubmit={event => { event.preventDefault(); void submit() }}>
        <button ref={emojiButton} type="button" aria-label="Add emoji" aria-expanded={pickerOpen} onClick={() => setPickerOpen(open => !open)}
          className="p-1.5 rounded-full hover:bg-brand-secondary transition shrink-0">
          <Smile className="w-4 h-4 text-brand-text/60" />
        </button>
        <MentionInput inputRef={inputRef} value={text} onValueChange={setText} placeholder="Reply..." aria-label="Write a reply" type="text"
          className="w-full rounded-full bg-brand-secondary px-4 py-2 text-[13px] text-brand-text placeholder:text-brand-text/60 outline-hidden ring-1 ring-brand-secondary focus:ring-brand-text/40 transition"
          onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); onCancel() } }} />
        <button type="submit" disabled={!text.trim() || reply.isPending} aria-label="Send reply"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-ink text-white disabled:opacity-40 transition hover:bg-primary-ink/90">
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
      <button type="button" onClick={onCancel} className="mt-1.5 ml-10 text-[11px] text-brand-text/60 hover:text-brand-highlight transition">Cancel</button>
      {pickerOpen && <EmojiPickerPopover anchorRef={emojiButton} onSelect={insertEmoji} onClose={() => setPickerOpen(false)} />}
    </div>
  )
}
