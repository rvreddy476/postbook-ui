'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, Heart } from 'lucide-react'
import { REACTIONS, type Reaction } from '@/lib/reactions'
import './reactions.css'

export interface ReactionControlProps {
  current: Reaction | null
  count: number
  onChange: (reaction: Reaction | null) => Promise<unknown>
  disabled?: boolean
  allowed?: readonly Reaction[]
  align?: 'start' | 'end'
}
/** Presentation only; service adapters own persistence and authoritative counts. */
export default function ReactionControl({ current: confirmed, count, onChange, disabled = false, allowed, align = 'start' }: ReactionControlProps) {
  const options = allowed ? REACTIONS.filter(option => allowed.includes(option.value)) : REACTIONS
  const [pending, setPending] = useState<{ reaction: Reaction | null } | null>(null)
  const [failed, setFailed] = useState(false)
  const saving = useRef(false)
  const busy = disabled || pending !== null
  const current = pending ? pending.reaction : confirmed
  const selected = REACTIONS.find(option => option.value === current)
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const picker = useRef<HTMLDivElement>(null)
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leave = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)
  const start = useRef({ x: 0, y: 0 })
  const id = useId()
  const clearHold = () => { if (hold.current) clearTimeout(hold.current); hold.current = null }
  const clearLeave = () => { if (leave.current) clearTimeout(leave.current); leave.current = null }
  useEffect(() => () => { clearHold(); clearLeave() }, [])
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  const choose = async (reaction: Reaction | null) => {
    if (busy || saving.current) return
    if (reaction && !options.some(option => option.value === reaction)) return
    saving.current = true
    setOpen(false)
    setFailed(false)
    setPending({ reaction })
    try { await onChange(reaction) } catch { setFailed(true) }
    finally { saving.current = false; setPending(null) }
  }
  const focusPicker = () => {
    clearLeave()
    setOpen(true)
    requestAnimationFrame(() => picker.current?.querySelector<HTMLButtonElement>('button')?.focus())
  }
  return <div className="reaction-control" data-align={align} ref={root}
    onPointerEnter={event => { if (event.pointerType === 'mouse') { clearLeave(); setOpen(true) } }}
    onPointerLeave={event => { clearHold(); if (event.pointerType === 'mouse') leave.current = setTimeout(() => setOpen(false), 200) }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}
    onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); trigger.current?.focus() }
    }}>
    <div className="reaction-trigger">
      <button ref={trigger} type="button" disabled={busy} aria-pressed={!!current} aria-busy={pending !== null}
        aria-label={current ? `Remove ${selected?.label ?? 'Like'} reaction` : 'React with Like'}
        title={current ? `${selected?.label} · click to remove` : 'Like · hold or hover for more reactions'}
        onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); focusPicker() } }}
        onPointerDown={event => {
          held.current = false
          if (event.pointerType === 'mouse') return
          start.current = { x: event.clientX, y: event.clientY }
          clearHold()
          hold.current = setTimeout(() => { held.current = true; setOpen(true) }, 450)
        }}
        onPointerMove={event => { if (Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > 10) clearHold() }}
        onPointerUp={clearHold} onPointerCancel={() => { clearHold(); held.current = true }}
        onContextMenu={event => event.preventDefault()}
        onClick={() => { if (held.current) { held.current = false; return }; choose(current ? null : 'like') }}>
        {selected ? <span className="reaction-emoji" aria-hidden="true">{selected.emoji}</span> : <Heart size={17} />}
        <span aria-label="Total reactions">{count}</span>
      </button>
      {options.length > 1 && <button type="button" className="reaction-expand" aria-label="Choose reaction" aria-expanded={open} aria-controls={id} disabled={busy} onClick={focusPicker}><ChevronDown size={12} /></button>}
    </div>
    {open && options.length > 1 && <div id={id} ref={picker} className="reaction-picker" role="toolbar" aria-label="Choose a reaction"
      onKeyDown={event => {
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')]
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
        const next = event.key === 'ArrowRight' ? (index + 1) % buttons.length : event.key === 'ArrowLeft' ? (index + buttons.length - 1) % buttons.length : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : -1
        if (next >= 0) { event.preventDefault(); buttons[next]?.focus() }
      }}>
      {options.map(option => <button type="button" key={option.value} disabled={busy} aria-label={option.label} aria-pressed={current === option.value} title={option.label} onClick={() => { choose(current === option.value ? null : option.value); trigger.current?.focus() }}><span aria-hidden="true">{option.emoji}</span><small>{option.label}</small></button>)}
    </div>}
    {failed && <div className="reaction-error" role="alert">Could not save reaction. Please try again.</div>}
  </div>
}
