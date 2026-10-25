'use client'
import React from 'react'

// ---------------------------------------------------------------------------
// Gradient array for avatar backgrounds.
//
// Every stop is a theme token (src/ui/theme.css), so the gradients follow the
// palette and lift with it in dark mode; nothing here names a colour of its
// own. Each pair carries white initials: the bubble, send and tile tokens are
// all tuned for white text on them.
// ---------------------------------------------------------------------------
const stop = (token: string) => `rgb(var(${token}))`
const grad = (from: string, to: string) => `linear-gradient(135deg, ${stop(from)}, ${stop(to)})`

export const GRADS = [
  grad('--brand-lift', '--brand-deep'), grad('--theme-bubble-ocean', '--brand-lift'),
  grad('--theme-bubble-ember', '--tile-tag'), grad('--theme-bubble-forest', '--tile-photo'),
  grad('--theme-bubble-violet', '--tile-poll'), grad('--send', '--send-hover'),
  grad('--brand-ink', '--theme-bubble-violet'), grad('--tile-photo', '--brand-lift'),
  grad('--tile-tag', '--send'), grad('--tile-poll', '--brand-deep'),
  grad('--theme-bubble-mono', '--brand-ink'),
]

/*
  A group's colour: its bubbles, its icon, its accents. The same token set
  as the chat bubble styles plus the other solid tokens that carry white
  text, so a group never gets a colour the theme does not already own.
*/
const GROUP_COLOR_TOKENS = [
  '--theme-bubble-ocean', '--theme-bubble-ember', '--theme-bubble-forest', '--theme-bubble-violet',
  '--send', '--brand-ink', '--tile-tag', '--tile-poll',
]

/** A CSS colour (`rgb(var(--token))`) chosen by the group's id. */
export function getGroupColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return stop(GROUP_COLOR_TOKENS[Math.abs(hash) % GROUP_COLOR_TOKENS.length])
}

/**
 * The group colour at an opacity, for tints and outlines — `rgb(var(--x) / a)`.
 * Replaces the old `${hex}0f` suffixes, which only worked on a hex literal.
 */
export function groupColorAlpha(color: string, alpha: number): string {
  const m = /^rgb\((var\(--[\w-]+\))\)$/.exec(color)
  return m ? `rgb(${m[1]} / ${alpha})` : color
}

export function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h)
  return Math.abs(h)
}

// ---------------------------------------------------------------------------
// Avatar (light theme)
// ---------------------------------------------------------------------------
interface AvatarProps {
  user: { id: string; name: string; avatar: string; isOnline?: boolean }
  size?: number
  showStatus?: boolean
  avatarUrl?: string | null
}

export function Avatar({ user, size = 40, showStatus = false, avatarUrl }: AvatarProps) {
  const radius = size > 32 ? 12 : '50%'
  const fontSize = Math.max(size * 0.32, 10)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={user.name}
          className="object-cover shadow-xs"
          style={{ width: size, height: size, borderRadius: radius }}
        />
      ) : (
        <div
          className="flex items-center justify-center text-white font-bold shadow-xs"
          style={{
            width: size,
            height: size,
            borderRadius: radius,
            background: GRADS[hashId(user.id) % GRADS.length],
            fontSize,
          }}
        >
          {getInitials(user.name)}
        </div>
      )}
      {showStatus && user.isOnline && (
        <div
          className="absolute bottom-0 right-0 rounded-full bg-emerald-500 border-2 border-brand-bg"
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// AvatarStack
// ---------------------------------------------------------------------------
interface AvatarStackProps {
  users: Array<{ id: string; name: string; avatar: string }>
  size?: number
  max?: number
}

export function AvatarStack({ users, size = 28, max = 3 }: AvatarStackProps) {
  const visible = users.slice(0, max)
  const overflow = users.length - max

  return (
    <div className="flex items-center">
      {visible.map((u, i) => (
        <div key={u.id} style={{ marginLeft: i > 0 ? -8 : 0 }}>
          <Avatar user={u} size={size} />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="rounded-full bg-brand-secondary flex items-center justify-center text-brand-highlight font-bold border-2 border-white"
          style={{ marginLeft: -8, width: size, height: size, fontSize: Math.max(size * 0.32, 10) }}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
