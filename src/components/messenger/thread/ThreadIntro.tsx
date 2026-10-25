'use client'

import Link from 'next/link'
import { Loader2 } from 'lucide-react'

import { useUserProfile, useFollowUser } from '@/hooks/useEditProfile'
import { formatCount } from '@/features/reels/model'
import { InboxAvatar } from '../inbox/InboxAvatar'

/*
  An empty thread starts with who this is: avatar, name, handle, counts,
  and Follow / View profile — so the first message is never sent blind.
*/
export function ThreadIntro({ userId, fallbackName, fallbackAvatar }: { userId: string; fallbackName: string; fallbackAvatar: string | null }) {
  const { data: profile } = useUserProfile(userId || undefined)
  const follow = useFollowUser()
  const name = profile?.display_name || fallbackName
  const username = profile?.username || null
  const avatar = profile?.avatar_media_id ? `/v1/media/${profile.avatar_media_id}/serve` : fallbackAvatar
  const following = profile?.follow_status === 'following' || follow.isSuccess
  const requested = profile?.follow_status === 'requested'

  return (
    <div className="mx-auto my-8 flex max-w-xs flex-col items-center text-center">
      <InboxAvatar name={name} src={avatar} size={88} />
      <p className="mt-3 text-[16px] font-bold text-brand-text">{name}</p>
      {username && <p className="text-[13px] text-brand-text/60">@{username}</p>}
      {profile && (
        <p className="mt-1 text-[12px] text-brand-text/60">
          {formatCount(profile.follower_count ?? 0)} followers · {formatCount(profile.post_count ?? 0)} posts
        </p>
      )}
      <div className="mt-4 flex gap-2">
        {!following && profile?.follow_status !== undefined && (
          <button
            type="button"
            disabled={follow.isPending || requested}
            onClick={() => follow.mutate(userId)}
            className="flex items-center gap-1.5 rounded-lg bg-primary-ink px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
          >
            {follow.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {requested ? 'Requested' : 'Follow'}
          </button>
        )}
        <Link href={`/u/${username || userId}`} className="rounded-lg bg-brand-secondary px-4 py-2 text-[13px] font-semibold text-brand-text hover:bg-brand-text/10">
          View profile
        </Link>
      </div>
    </div>
  )
}

/** Three dots in a bubble while the other side is typing. */
export function TypingBubble({ label }: { label: string }) {
  return (
    <div className="mt-2 flex items-end gap-2" aria-live="polite" aria-label={label}>
      <span className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-brand-divider bg-brand-card px-3.5 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-text/40"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </span>
      <span className="pb-1 text-[11px] text-brand-text/50">{label}</span>
    </div>
  )
}
