'use client'

/**
 * Phase 1 — TrustBadge.
 *
 * Compact verification chip used on the discover card, profile detail, and
 * match list. Surfaces the candidate's verification + trust state from the
 * dating-service candidate payload:
 *
 *   - `trust_tier`         (none | email | phone | aadhaar | vouched)
 *   - `verification_state` (server-issued flags like phone, selfie, id, vouched)
 *
 * The badge composes those into one or more pills. When neither field
 * is present the component renders a neutral "New profile" pill so the
 * surface still tells the viewer that nothing has been verified yet.
 *
 * Palette: reuses the existing rose/orange/emerald/amber tokens — no new
 * colors introduced (per repo policy).
 */

type Variant = 'compact' | 'full'

type Props = {
  trustTier?: string | null
  /**
   * Either an array (`['phone', 'selfie']`) or an object map
   * (`{phone: true, selfie: false}`) — dating-service has shipped both
   * shapes during the verification rollout. We normalise on the client.
   */
  verificationState?: string[] | Record<string, boolean> | null
  variant?: Variant
  className?: string
}

type Pill = {
  key: string
  label: string
  className: string
  icon: 'check' | 'shield' | 'star' | 'sparkle'
}

function normaliseVerification(state: Props['verificationState']): Set<string> {
  if (!state) return new Set()
  if (Array.isArray(state)) return new Set(state.map((s) => s.toLowerCase()))
  const out = new Set<string>()
  for (const [k, v] of Object.entries(state)) {
    if (v) out.add(k.toLowerCase())
  }
  return out
}

function buildPills(trustTier: string | null | undefined, verified: Set<string>): Pill[] {
  const pills: Pill[] = []

  // Tier-derived pill (highest signal first).
  switch ((trustTier ?? '').toLowerCase()) {
    case 'aadhaar':
      pills.push({
        key: 'aadhaar',
        label: 'ID verified',
        icon: 'shield',
        className: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
      })
      break
    case 'phone':
      pills.push({
        key: 'phone',
        label: 'Phone verified',
        icon: 'check',
        className: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
      })
      break
    case 'email':
      pills.push({
        key: 'email',
        label: 'Email verified',
        icon: 'check',
        className: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
      })
      break
    case 'vouched':
      pills.push({
        key: 'vouched',
        label: 'Vouched',
        icon: 'star',
        className: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
      })
      break
  }

  // verification_state pills — only add ones we didn't already cover.
  if (verified.has('selfie') && !pills.some((p) => p.key === 'selfie')) {
    pills.push({
      key: 'selfie',
      label: 'Selfie verified',
      icon: 'check',
      className: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
    })
  }
  if (verified.has('id') && !pills.some((p) => p.key === 'aadhaar')) {
    pills.push({
      key: 'id',
      label: 'ID verified',
      icon: 'shield',
      className: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
    })
  }
  if (verified.has('vouched') && !pills.some((p) => p.key === 'vouched')) {
    pills.push({
      key: 'vouched-vs',
      label: 'Vouched',
      icon: 'star',
      className: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
    })
  }

  // Fallback when nothing has shipped yet.
  if (pills.length === 0) {
    pills.push({
      key: 'new',
      label: 'New profile',
      icon: 'sparkle',
      className: 'bg-[#1a1a1a] text-[#888] border border-[#2a2a2a]',
    })
  }

  return pills
}

function Glyph({ name }: { name: Pill['icon'] }) {
  switch (name) {
    case 'check':
      return (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )
    case 'shield':
      return (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2l8 4v6c0 5-3.5 9.4-8 10-4.5-.6-8-5-8-10V6l8-4z" />
        </svg>
      )
    case 'star':
      return (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      )
    case 'sparkle':
    default:
      return (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 1l2.39 6.39L21 9l-5 4.5L17.39 22 12 18.5 6.61 22 8 13.5 3 9l6.61-1.61L12 1z" />
        </svg>
      )
  }
}

export function TrustBadge({
  trustTier,
  verificationState,
  variant = 'compact',
  className = '',
}: Props) {
  const verified = normaliseVerification(verificationState)
  const pills = buildPills(trustTier, verified)
  const display = variant === 'compact' ? pills.slice(0, 1) : pills

  return (
    <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
      {display.map((p) => (
        <span
          key={p.key}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${p.className}`}
        >
          <Glyph name={p.icon} />
          {p.label}
        </span>
      ))}
      {variant === 'compact' && pills.length > 1 && (
        <span className="text-[10px] font-bold text-[#666]">+{pills.length - 1}</span>
      )}
    </div>
  )
}

export default TrustBadge
