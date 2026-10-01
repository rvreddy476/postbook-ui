"use client"

import { useEffect, type CSSProperties } from "react"
import { Heart } from "lucide-react"

import { useLiveHearts } from "@/hooks/useLiveV2"
import { HEART_BLOCK_COPY, heartCountLabel, heartGate, type FloatingHeart, type HeartBlock } from "../hearts"
import "../surfaces.css"

/** The heart count that sits beside the viewer count. `heartCount` is the stream row's. */
export function HeartCount({ streamId, heartCount }: { streamId: string; heartCount?: number | null }) {
  const hearts = useLiveHearts(streamId, heartCount)
  return <HeartCountView count={hearts.count} />
}

export function HeartCountView({ count }: { count: number }) {
  return (
    <span className="live-heart-count" aria-label={`${count.toLocaleString()} ${count === 1 ? "heart" : "hearts"}`}>
      <Heart aria-hidden="true" />
      <span aria-hidden="true">{heartCountLabel(count)}</span>
    </span>
  )
}

/**
 * The heart button and the hearts floating up, laid over the video (the
 * parent is the `.live-stage`). Free taps: batched and sent once a second;
 * everybody's hearts arrive by the room's `hearts` frame.
 */
export function StageHearts({
  streamId,
  heartCount,
  status,
  signedIn,
  banned = false,
}: {
  streamId: string
  heartCount?: number | null
  status: unknown
  signedIn: boolean
  banned?: boolean
}) {
  const hearts = useLiveHearts(streamId, heartCount)
  const gate = heartGate({ signedIn, banned, status })
  const { blocked, unblock } = hearts
  // A refusal that no longer holds (the stream is back on air, the reader signed in) is lifted.
  useEffect(() => {
    if (blocked && !gate && blocked !== "banned") unblock()
  }, [blocked, gate, unblock])
  return <StageHeartsView count={hearts.count} floating={hearts.floating} block={gate ?? blocked} onTap={hearts.tap} />
}

export function StageHeartsView({ count, floating, block, onTap }: { count: number; floating: readonly FloatingHeart[]; block: HeartBlock | null; onTap: () => void }) {
  const copy = block ? HEART_BLOCK_COPY[block] : ""
  return (
    <div className="live-hearts">
      <div className="live-hearts__layer" aria-hidden="true">
        {floating.map((h) => (
          <span key={h.id} className="live-heart" style={{ "--live-heart-x": h.x, animationDelay: `${h.delay}ms` } as CSSProperties}>
            <Heart />
          </span>
        ))}
      </div>
      <button
        type="button"
        className="live-hearts__btn"
        onClick={() => { if (!block) onTap() }}
        aria-disabled={block ? true : undefined}
        aria-label={block ? copy : `Send a heart. ${count.toLocaleString()} so far`}
        title={block ? copy : "Send a heart"}
      >
        <Heart aria-hidden="true" />
        <span aria-hidden="true">{heartCountLabel(count)}</span>
      </button>
    </div>
  )
}
