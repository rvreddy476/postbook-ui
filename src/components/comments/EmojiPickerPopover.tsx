'use client'
import { lazy, Suspense, useEffect, useLayoutEffect, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import data from '@emoji-mart/data'
import { useIsDark } from './useIsDark'

const EmojiPicker = lazy(() => import('@emoji-mart/react'))

const PICKER_WIDTH = 352
const PICKER_HEIGHT = 435
const GAP = 8

export interface EmojiPickerPopoverProps {
  /** The element the picker floats next to; measured when it opens. */
  anchorRef: RefObject<HTMLElement | null>
  onSelect: (native: string) => void
  onClose: () => void
  perLine?: number
}

/**
 * The emoji-mart picker, lazy-loaded and portaled to <body> so an overflow-
 * hidden comment list or a scrolling drawer never clips it. Prefers to open
 * above the anchor, falls below when there is no room, and follows the
 * document's dark class. Closes on outside pointerdown and Escape.
 */
export default function EmojiPickerPopover({ anchorRef, onSelect, onClose, perLine = 9 }: EmojiPickerPopoverProps) {
  const dark = useIsDark()
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const [panel, setPanel] = useState<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const anchor = anchorRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const width = Math.min(PICKER_WIDTH, window.innerWidth - 16)
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
    const above = rect.top - GAP - PICKER_HEIGHT
    const top = above >= 8 ? above : Math.min(rect.bottom + GAP, Math.max(8, window.innerHeight - PICKER_HEIGHT - 8))
    setPosition({ top, left })
  }, [anchorRef])

  useEffect(() => {
    const outside = (event: PointerEvent) => {
      const target = event.target as Node
      if (panel?.contains(target) || anchorRef.current?.contains(target)) return
      onClose()
    }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key) }
  }, [panel, anchorRef, onClose])

  if (typeof document === 'undefined' || !position) return null
  return createPortal(
    <div ref={setPanel} className="comment-emoji-popover" role="dialog" aria-label="Choose an emoji" style={{ top: position.top, left: position.left }}>
      <Suspense fallback={<div className="comment-emoji-loading" aria-busy="true"><span className="comment-spinner" /></div>}>
        <EmojiPicker data={data} onEmojiSelect={(emoji: { native: string }) => onSelect(emoji.native)} theme={dark ? 'dark' : 'light'}
          previewPosition="none" skinTonePosition="none" perLine={perLine} maxFrequentRows={2} />
      </Suspense>
    </div>,
    document.body,
  )
}
