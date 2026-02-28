'use client'
import React, { useState } from 'react'

// ---------------------------------------------------------------------------
// Gradient array for avatar backgrounds
// ---------------------------------------------------------------------------
export const GRADS = [
  "linear-gradient(135deg, #667eea, #764ba2)", "linear-gradient(135deg, #f093fb, #f5576c)",
  "linear-gradient(135deg, #4facfe, #00f2fe)", "linear-gradient(135deg, #43e97b, #38f9d7)",
  "linear-gradient(135deg, #fa709a, #fee140)", "linear-gradient(135deg, #a18cd1, #fbc2eb)",
  "linear-gradient(135deg, #fccb90, #d57eeb)", "linear-gradient(135deg, #e0c3fc, #8ec5fc)",
  "linear-gradient(135deg, #ffecd2, #fcb69f)", "linear-gradient(135deg, #ff9a9e, #fecfef)",
  "linear-gradient(135deg, #6366F1, #8B5CF6)",
]

// Group colour palette (deterministic from ID)
const GROUP_COLORS = ["#6366F1", "#EC4899", "#10B981", "#F59E0B", "#3B82F6", "#EF4444", "#8B5CF6", "#14B8A6"]

export function getGroupColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length]
}

export function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// Hash string to number for gradient index
export function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h)
  return Math.abs(h)
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------
interface AvatarProps {
  user: { id: string; name: string; avatar: string; isOnline?: boolean }
  size?: number
  showStatus?: boolean
  avatarUrl?: string | null
}

export function Avatar({ user, size = 40, showStatus = false, avatarUrl }: AvatarProps) {
  const radius = size > 32 ? size * 0.32 : '50%'
  const fontSize = Math.max(size * 0.32, 10)

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={user.name}
          style={{
            width: size,
            height: size,
            borderRadius: radius,
            objectFit: 'cover',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          }}
        />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: radius,
            background: GRADS[hashId(user.id) % GRADS.length],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize,
            fontWeight: 700,
            color: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          }}
        >
          {getInitials(user.name)}
        </div>
      )}
      {showStatus && user.isOnline && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: size * 0.28,
            height: size * 0.28,
            borderRadius: '50%',
            background: '#22C55E',
            border: `2px solid #0d0d1a`,
          }}
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
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {visible.map((u, i) => (
        <div key={u.id} style={{ marginLeft: i > 0 ? -8 : 0 }}>
          <Avatar user={u} size={size} />
        </div>
      ))}
      {overflow > 0 && (
        <div
          style={{
            marginLeft: -8,
            width: size,
            height: size,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: Math.max(size * 0.32, 10),
            fontWeight: 700,
            color: '#D1D5DB',
            border: '2px solid #0d0d1a',
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Btn
// ---------------------------------------------------------------------------
interface BtnProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'accent'
  size?: 'xs' | 'sm' | 'md'
  icon?: React.ReactNode
  disabled?: boolean
  full?: boolean
}

export function Btn({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  icon,
  disabled = false,
  full = false,
}: BtnProps) {
  const [hover, setHover] = useState(false)

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: hover ? '#4F46E5' : '#6366F1',
      color: '#fff',
      border: 'none',
    },
    secondary: {
      background: 'rgba(255,255,255,0.05)',
      color: '#D1D5DB',
      border: '1px solid rgba(255,255,255,0.1)',
    },
    ghost: {
      background: hover ? 'rgba(255,255,255,0.06)' : 'transparent',
      color: '#9CA3AF',
      border: 'none',
    },
    accent: {
      background: 'rgba(99,102,241,0.1)',
      color: '#A5B4FC',
      border: '1px solid rgba(99,102,241,0.2)',
    },
  }

  const sizeStyles: Record<string, React.CSSProperties> = {
    xs: { padding: '3px 8px', fontSize: 11, borderRadius: 6 },
    sm: { padding: '5px 10px', fontSize: 12, borderRadius: 10 },
    md: { padding: '8px 16px', fontSize: 13, borderRadius: 10 },
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...variantStyles[variant],
        ...sizeStyles[size],
        fontWeight: 600,
        transition: 'all 0.15s',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        width: full ? '100%' : undefined,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        fontFamily: 'inherit',
        outline: 'none',
      }}
    >
      {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Global CSS
// ---------------------------------------------------------------------------
export const MESSENGER_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
  :root { --font: 'Outfit', sans-serif; --bg: #0d0d1a; --surface: rgba(255,255,255,0.03); --border: rgba(255,255,255,0.06); }
  @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  @keyframes fadeSlide { from { transform: translateY(6px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
`
