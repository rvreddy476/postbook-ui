'use client'

import React from 'react'
import Link from 'next/link'
import { Users, Radio } from 'lucide-react'
import type { CommunitySpace } from '@/types/communities'

interface SpaceCardProps {
  space: CommunitySpace
  isAdmin?: boolean
  onRemove?: (spaceId: string) => void
  onEdit?: (spaceId: string) => void
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

const SpaceCard: React.FC<SpaceCardProps> = ({ space, isAdmin, onRemove, onEdit }) => {
  const isGroup = space.space_type === 'group'
  const isChannel = space.space_type === 'channel'
  const typeBadge = isGroup ? 'GROUP' : isChannel ? 'CHANNEL' : space.space_type.toUpperCase()

  const href = space.linked_group_id
    ? `/groups/${space.linked_group_id}`
    : space.linked_channel_id
      ? `/channels/${space.linked_channel_id}`
      : '#'

  return (
    <div className="bg-white rounded-2xl border border-brand-divider p-4 hover:shadow-md hover:border-brand-text/20 transition-all duration-200 flex flex-col">
      {/* Type badge */}
      <div className="mb-2">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-bg text-brand-text/70">
          {isGroup ? <Users className="w-3 h-3" /> : <Radio className="w-3 h-3" />}
          {typeBadge}
        </span>
      </div>

      {/* Space name */}
      <h4 className="text-sm font-bold text-brand-text truncate" style={{ fontWeight: 700 }}>
        {space.name}
      </h4>

      {/* Description (1 line) */}
      {space.description && (
        <p className="text-xs text-brand-text/60 mt-1 truncate">{space.description}</p>
      )}

      {/* Stats */}
      <div className="flex items-center gap-2 mt-2 font-mono text-[11px] text-brand-text/50">
        <span>{formatCount(space.member_count ?? 0)} {isChannel ? 'subscribers' : 'members'}</span>
        <span className="text-brand-text/20">·</span>
        <span>{space.post_count ?? 0} {isChannel ? 'updates' : 'posts'}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-brand-divider">
        <Link
          href={href}
          className="px-3 py-1.5 bg-brand-text text-brand-bg text-xs font-bold rounded-lg hover:bg-brand-text/90 transition-colors"
        >
          View Space
        </Link>
        {isAdmin && (
          <>
            {onEdit && (
              <button
                onClick={() => onEdit(space.id)}
                className="px-3 py-1.5 border border-brand-divider text-brand-text text-xs font-semibold rounded-lg hover:bg-brand-bg transition-colors"
              >
                Edit
              </button>
            )}
            {onRemove && (
              <button
                onClick={() => onRemove(space.id)}
                className="px-3 py-1.5 border border-brand-divider text-brand-text/60 text-xs font-semibold rounded-lg hover:bg-brand-bg transition-colors"
              >
                Remove
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default SpaceCard
