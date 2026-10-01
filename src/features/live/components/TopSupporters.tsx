"use client"

import { useState } from "react"
import { Heart, MessageCircle } from "lucide-react"

import { Avatar } from "@/components/LetterAvatar"
import { Dialog } from "@/components/ui/dialog"
import { useSupporters } from "@/hooks/useLiveV2"
import { creatorName } from "../discovery"
import { SUPPORTERS_EMPTY_COPY, heartCountLabel, topSupporters, type Supporter } from "../hearts"
import { FoundingBadge } from "./FoundingBadge"
import "../surfaces.css"

/** Rank, avatar, name, hearts and messages; the empty state invites the first heart. */
export function SupportersList({ supporters }: { supporters: readonly Supporter[] }) {
  if (supporters.length === 0) return <p className="live-supporters__empty">{SUPPORTERS_EMPTY_COPY}</p>
  return (
    <ol className="live-supporters">
      {supporters.map((s) => {
        const name = creatorName(s.user)
        return (
          <li key={s.user.user_id} className="live-supporters__row">
            <span className="live-supporters__rank" aria-label={`Rank ${s.rank}`}>{s.rank}</span>
            <Avatar src={s.user.avatar_url || null} name={name} seed={s.user.user_id} size="sm" />
            <span className="live-supporters__name">
              <span>{name}</span>
              <FoundingBadge badges={s.user.badges} compact />
            </span>
            <span className="live-supporters__stat live-supporters__stat--hearts" aria-label={`${s.hearts.toLocaleString()} hearts`}>
              <Heart aria-hidden="true" />
              <span aria-hidden="true">{heartCountLabel(s.hearts)}</span>
            </span>
            <span className="live-supporters__stat" aria-label={`${s.messages.toLocaleString()} messages`}>
              <MessageCircle aria-hidden="true" />
              <span aria-hidden="true">{heartCountLabel(s.messages)}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export function TopSupportersButton({ supporters, onOpen }: { supporters: readonly Supporter[]; onOpen: () => void }) {
  const top = topSupporters(supporters)
  return (
    <button type="button" className="live-supporters-btn" onClick={onOpen} aria-label="Top supporters" title="Top supporters">
      {top.length > 0 ? (
        <span className="live-supporters-btn__stack" aria-hidden="true">
          {top.map((s) => (
            <Avatar key={s.user.user_id} src={s.user.avatar_url || null} name={creatorName(s.user)} seed={s.user.user_id} size="xs" />
          ))}
        </span>
      ) : (
        <Heart aria-hidden="true" />
      )}
      <span>Top supporters</span>
    </button>
  )
}

/**
 * The chat header's three avatars; pressing them opens the list. The list
 * refreshes every 15 s while the stream is on air (`status`).
 */
export function TopSupporters({ streamId, status }: { streamId: string; status: unknown }) {
  const [open, setOpen] = useState(false)
  const { data } = useSupporters(streamId, status)
  const supporters = data ?? []
  return (
    <>
      <TopSupportersButton supporters={supporters} onOpen={() => setOpen(true)} />
      <Dialog open={open} onClose={() => setOpen(false)} title="Top supporters">
        <SupportersList supporters={supporters} />
      </Dialog>
    </>
  )
}

/** The list as a card, for a stream that is over (there is no chat header then). */
export function SupportersCard({ streamId, status }: { streamId: string; status: unknown }) {
  const { data, isPending } = useSupporters(streamId, status)
  if (isPending) return null
  return (
    <section className="live-section" aria-label="Top supporters">
      <h2 className="live-section__title live-supporters-card__title"><Heart aria-hidden="true" />Top supporters</h2>
      <SupportersList supporters={data ?? []} />
    </section>
  )
}
