'use client'
import { useCallback, useEffect, useId, useRef, useState, type InputHTMLAttributes, type KeyboardEvent, type RefObject } from 'react'
import { activeMention, insertMention, type ActiveMention } from './mentions'
import { useMentionSearch } from './useMentionSearch'
import './comments.css'

export interface MentionInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string
  onValueChange: (text: string) => void
  inputRef?: RefObject<HTMLInputElement | null>
  wrapperClassName?: string
  /** Where the dropdown opens; the sticky bottom composer needs it above. */
  placement?: 'top' | 'bottom'
}

/**
 * A single-line composer input with @mention completion. Typing `@` plus one
 * or more characters opens a list of matching people; arrows move, Enter or
 * Tab picks, Escape closes; picking inserts `@username ` at the caret.
 */
export default function MentionInput({ value, onValueChange, inputRef, wrapperClassName, placement = 'bottom', onKeyDown, ...rest }: MentionInputProps) {
  const ownRef = useRef<HTMLInputElement>(null)
  const ref = inputRef ?? ownRef
  const [mention, setMention] = useState<ActiveMention | null>(null)
  const [dismissed, setDismissed] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const [pendingCaret, setPendingCaret] = useState<number | null>(null)
  const listId = useId()
  const { candidates, loading, settled } = useMentionSearch(mention?.query ?? null)
  const open = !!mention && dismissed !== mention.start + ':' + mention.query && (candidates.length > 0 || loading || settled)

  const readCaret = useCallback((text: string) => {
    const el = ref.current
    const caret = el?.selectionStart ?? text.length
    setMention(activeMention(text, caret))
  }, [ref])

  useEffect(() => { setActive(0) }, [mention?.query])

  useEffect(() => {
    if (pendingCaret === null) return
    const el = ref.current
    if (el) { el.focus(); el.setSelectionRange(pendingCaret, pendingCaret) }
    setPendingCaret(null)
  }, [pendingCaret, ref])

  const pick = (username: string) => {
    if (!mention) return
    const el = ref.current
    const caret = el?.selectionStart ?? value.length
    const next = insertMention(value, mention.start, caret, username)
    onValueChange(next.text)
    setMention(null)
    setPendingCaret(next.caret)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (open) {
      if (event.key === 'ArrowDown' && candidates.length) { event.preventDefault(); setActive(index => (index + 1) % candidates.length); return }
      if (event.key === 'ArrowUp' && candidates.length) { event.preventDefault(); setActive(index => (index + candidates.length - 1) % candidates.length); return }
      if ((event.key === 'Enter' || event.key === 'Tab') && candidates[active]) { event.preventDefault(); pick(candidates[active].username); return }
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setDismissed(mention ? mention.start + ':' + mention.query : null); return }
    }
    onKeyDown?.(event)
  }

  return (
    <div className={`comment-mention-wrap ${wrapperClassName ?? ''}`}>
      <input {...rest} ref={ref} value={value}
        role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={open ? listId : undefined}
        aria-activedescendant={open && candidates[active] ? `${listId}-${active}` : undefined}
        onChange={event => { onValueChange(event.target.value); readCaret(event.target.value) }}
        onKeyUp={event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) readCaret(value) }}
        onClick={() => readCaret(value)}
        onKeyDown={handleKeyDown}
        onBlur={event => { rest.onBlur?.(event); setTimeout(() => setMention(null), 150) }} />
      {open && (
        <div id={listId} role="listbox" aria-label="People to mention" className="comment-mention-menu" data-placement={placement}
          onPointerDown={event => event.preventDefault() /* keep the input focused */}>
          {candidates.map((candidate, index) => (
            <button key={candidate.id} id={`${listId}-${index}`} type="button" role="option" aria-selected={index === active}
              className="comment-mention-option" onPointerEnter={() => setActive(index)} onClick={() => pick(candidate.username)}>
              <img src={candidate.avatar} alt="" />
              <span className="min-w-0">
                <span className="comment-mention-name block">{candidate.name}</span>
                <span className="comment-mention-handle block">@{candidate.username}</span>
              </span>
            </button>
          ))}
          {candidates.length === 0 && <div className="comment-mention-empty">{loading ? 'Searching…' : 'No one found'}</div>}
        </div>
      )}
    </div>
  )
}
