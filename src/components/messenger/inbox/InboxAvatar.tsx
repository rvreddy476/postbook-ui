'use client'

import { useState } from 'react'
import { Users } from 'lucide-react'

/*
  A round photo avatar with an optional online dot, for the inbox, notes row
  and pickers. Initials when there is no photo or it fails to load. Tokens only.
*/
export function InboxAvatar({
  name,
  src,
  size = 48,
  online = false,
  group = false,
}: {
  name: string
  src: string | null | undefined
  size?: number
  online?: boolean
  group?: boolean
}) {
  const [broken, setBroken] = useState(false)
  const initials = (name || '?')
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const dot = Math.max(10, Math.round(size * 0.26))
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          onError={() => setBroken(true)}
          className="h-full w-full rounded-full bg-brand-secondary object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-full bg-primary-tint text-[13px] font-semibold text-primary-ink">
          {group ? <Users className="h-[45%] w-[45%]" strokeWidth={1.75} aria-hidden /> : initials || '?'}
        </span>
      )}
      {online && (
        <span
          className="absolute bottom-0 right-0 rounded-full border-2 border-brand-bg bg-success"
          style={{ width: dot, height: dot }}
          aria-label="Online"
        />
      )}
    </span>
  )
}
