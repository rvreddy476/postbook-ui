'use client'

import React from 'react'
import { Hash, MapPin, Smile, UserRoundX } from 'lucide-react'

import type { GroupPostV2 } from '@/types/groups'
import { hasGroupPostMeta, moodLine, readGroupPostMeta } from './groupComposer'

/**
 * The place, the mood and the tags a group post carries, drawn back onto it.
 *
 * This is the visible half of the `type_payload` fix. The composer collected
 * these four things and the mutation dropped them, and a fix that only reaches
 * the database is indistinguishable from the bug for anyone looking at a post —
 * so the card has to read them back.
 *
 * Renders nothing at all when there is nothing to show, so it can be dropped
 * into any card unconditionally.
 */
const GroupPostMeta: React.FC<{ post: GroupPostV2; className?: string }> = ({ post, className }) => {
  const meta = readGroupPostMeta(post.type_payload)
  const mood = moodLine(meta)
  const anonymous = post.is_anonymous === true

  if (!hasGroupPostMeta(meta) && !anonymous) return null

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className ?? 'mt-3'}`}>
      {anonymous && (
        /*
          Said on the post, not inferred from a missing name. `author_id` on an
          anonymous post is a per-post alias that resolves to nobody, so a card
          that does not say this just shows an unexplained blank author.
        */
        <span className="inline-flex items-center gap-1 rounded-full border border-brand-divider bg-brand-secondary px-2.5 py-1 text-[11px] font-medium text-brand-text/70">
          <UserRoundX className="h-3 w-3" strokeWidth={1.75} />
          Anonymous member
        </span>
      )}
      {mood && (
        <span className="inline-flex items-center gap-1 rounded-full border border-brand-divider bg-brand-secondary px-2.5 py-1 text-[11px] font-medium text-warning">
          <Smile className="h-3 w-3" strokeWidth={1.75} />
          {mood}
        </span>
      )}
      {meta.location && (
        <span className="inline-flex items-center gap-1 rounded-full border border-brand-divider bg-brand-secondary px-2.5 py-1 text-[11px] font-medium text-success">
          <MapPin className="h-3 w-3" strokeWidth={1.75} />
          {meta.location}
        </span>
      )}
      {/*
        Tags are text, not links. group-service has no hashtag extraction and
        there is no group tag page, so a link here would go nowhere — which is
        the same reason the composer stopped appending them to a group post's
        body.
      */}
      {meta.hashtags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-0.5 rounded-full border border-brand-divider bg-brand-card px-2.5 py-1 text-[11px] font-medium text-primary-ink"
        >
          <Hash className="h-3 w-3" strokeWidth={2} />
          {tag}
        </span>
      ))}
    </div>
  )
}

export default GroupPostMeta
