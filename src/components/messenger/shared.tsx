'use client'
import React from 'react'

// ---------------------------------------------------------------------------
// Gradient array for avatar backgrounds
// ---------------------------------------------------------------------------
export const GRADS = [
  'linear-gradient(135deg, #667eea, #764ba2)', 'linear-gradient(135deg, #f093fb, #f5576c)',
  'linear-gradient(135deg, #4facfe, #00f2fe)', 'linear-gradient(135deg, #43e97b, #38f9d7)',
  'linear-gradient(135deg, #fa709a, #fee140)', 'linear-gradient(135deg, #a18cd1, #fbc2eb)',
  'linear-gradient(135deg, #fccb90, #d57eeb)', 'linear-gradient(135deg, #e0c3fc, #8ec5fc)',
  'linear-gradient(135deg, #ffecd2, #fcb69f)', 'linear-gradient(135deg, #ff9a9e, #fecfef)',
  'linear-gradient(135deg, #D8103F, #E8445A)',
]

const GROUP_COLORS = ['#D8103F', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6', '#14B8A6']

export function getGroupColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length]
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
          className="object-cover shadow-sm"
          style={{ width: size, height: size, borderRadius: radius }}
        />
      ) : (
        <div
          className="flex items-center justify-center text-white font-bold shadow-sm"
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
          className="rounded-full bg-slate-100 flex items-center justify-center text-brand-highlight font-bold border-2 border-white"
          style={{ marginLeft: -8, width: size, height: size, fontSize: Math.max(size * 0.32, 10) }}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
