'use client'

import { useState } from 'react'
import Link from 'next/link'
import { EyeOff, Music2, Phone, PhoneMissed, Radio, UserRound, Video } from 'lucide-react'

import { PostMessageCard } from '../PostMessageCard'
import type { PostCardView } from '../postCards'
import { VoiceBubble } from './VoiceBubble'
import { callLogText, type BubbleKind, type DisplayMessage } from './threadModel'

/*
  The inside of one bubble, for every message type the contract names
  (CONTRACT §2.2, §9): text, photo, video, voice, sticker, GIF, shared post,
  profile, sound, LIVE, call log. Sensitive media is blurred until tapped.
*/

const media = (id: string) => `/v1/media/${id}/serve`

export interface ProfileCardData {
  name: string
  username: string | null
  avatarUrl: string | null
}

export function MessageBody({
  msg,
  kind,
  mine,
  blur,
  postView,
  onRetryPost,
  onOpenPost,
  profile,
  renderText,
}: {
  msg: DisplayMessage
  kind: BubbleKind
  mine: boolean
  blur: boolean
  postView?: PostCardView
  onRetryPost?: () => void
  /** A shared post was tapped; reels open in the in-messenger viewer. */
  onOpenPost?: (postId: string, isReel: boolean) => void
  profile?: ProfileCardData | null
  renderText: (text: string) => React.ReactNode
}) {
  const [revealed, setRevealed] = useState(false)
  const hidden = blur && !revealed
  const caption = msg.text ? <p className="mt-1.5 whitespace-pre-wrap">{renderText(msg.text)}</p> : null

  switch (kind) {
    case 'deleted':
      return <span>This message was deleted</span>
    case 'call': {
      const call = msg.extras?.call ?? { kind: 'audio' as const, outcome: 'ended', durationMs: null }
      const missed = call.outcome === 'missed' || call.outcome === 'no_answer'
      const Icon = missed ? PhoneMissed : call.kind === 'video' ? Video : Phone
      return (
        <span className="flex items-center gap-2">
          <span className={`flex h-8 w-8 items-center justify-center rounded-full ${mine ? 'bg-brand-bg/20' : 'bg-brand-secondary'} ${missed && !mine ? 'text-danger' : ''}`}>
            <Icon className="h-4 w-4" />
          </span>
          <span className="text-[13px] font-medium">{callLogText(call, mine)}</span>
        </span>
      )
    }
    case 'voice':
      return (
        <VoiceBubble
          src={media(msg.mediaId!)}
          durationMs={msg.extras?.voice?.durationMs ?? msg.extras?.media?.durationMs ?? 0}
          waveform={msg.extras?.voice?.waveform ?? []}
          mine={mine}
        />
      )
    case 'sticker': {
      const s = msg.extras!.sticker!
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={s.url} alt="Sticker" width={Math.min(160, s.width)} className="max-h-40 w-auto object-contain" loading="lazy" />
    }
    case 'gif': {
      const g = msg.extras!.gif!
      return (
        <span className="block overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={g.url} alt="GIF" className="max-h-60 max-w-[240px] object-cover" loading="lazy" />
        </span>
      )
    }
    case 'post': {
      const view = postView ?? { state: 'loading' as const }
      const isReel = view.state === 'ready' && view.kindLabel === 'Reel'
      return (
        <>
          <span
            onClickCapture={(e) => {
              if (!onOpenPost || view.state !== 'ready') return
              // Reels open in the swipe viewer over the chat, not at /post/<id>.
              if (isReel) {
                e.preventDefault()
                e.stopPropagation()
                onOpenPost(msg.postId!, true)
              }
            }}
            className="block"
          >
            <PostMessageCard view={view} onRetry={onRetryPost} />
          </span>
          {msg.text ? <p className={`mt-1.5 px-1 whitespace-pre-wrap text-[14px] ${mine ? '' : 'text-brand-text'}`}>{renderText(msg.text)}</p> : null}
        </>
      )
    }
    case 'profile': {
      const id = msg.extras!.profileUserId!
      const name = profile?.name ?? 'Profile'
      return (
        <Link href={`/u/${profile?.username || id}`} className="flex w-56 items-center gap-3 rounded-xl border border-brand-divider bg-brand-card p-3 text-brand-text no-underline hover:bg-brand-secondary">
          {profile?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
          ) : (
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-tint text-primary-ink"><UserRound className="h-5 w-5" /></span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold">{name}</span>
            {profile?.username && <span className="block truncate text-[11px] text-brand-text/60">@{profile.username}</span>}
            <span className="mt-0.5 block text-[11px] font-semibold text-primary-ink">View profile</span>
          </span>
        </Link>
      )
    }
    case 'sound':
      return (
        <Link href={`/reels/sound/${encodeURIComponent(msg.extras!.soundId!)}`} className="flex w-56 items-center gap-3 rounded-xl border border-brand-divider bg-brand-card p-3 text-brand-text no-underline hover:bg-brand-secondary">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-secondary"><Music2 className="h-5 w-5" /></span>
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold">Sound</span>
            <span className="block text-[11px] text-brand-text/60">Tap to hear it and see reels that use it</span>
          </span>
        </Link>
      )
    case 'live':
      return (
        <Link href={`/live/${encodeURIComponent(msg.extras!.streamId!)}`} className="flex w-56 items-center gap-3 rounded-xl border border-brand-divider bg-brand-card p-3 text-brand-text no-underline hover:bg-brand-secondary">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-danger text-white"><Radio className="h-5 w-5" /></span>
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold">LIVE</span>
            <span className="block text-[11px] text-brand-text/60">Tap to watch</span>
          </span>
        </Link>
      )
    case 'image':
    case 'video': {
      const src = media(msg.mediaId!)
      return (
        <span className="relative block overflow-hidden rounded-2xl">
          {kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="Photo" className={`max-h-80 max-w-[280px] object-cover ${hidden ? 'chat-media--blurred' : ''}`} loading="lazy" />
          ) : (
            <video src={src} controls={!hidden} preload="metadata" className={`max-h-80 max-w-[280px] ${hidden ? 'chat-media--blurred' : ''}`} />
          )}
          {hidden && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setRevealed(true) }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-brand-text/30 text-[12px] font-semibold text-white"
            >
              <EyeOff className="h-5 w-5" />
              Tap to view
            </button>
          )}
          {caption && <span className="block px-1">{caption}</span>}
        </span>
      )
    }
    case 'audio':
      return <audio src={media(msg.mediaId!)} controls className="max-w-full" />
    case 'attachment':
      return (
        <a href={media(msg.mediaId!)} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
          Attachment
        </a>
      )
    default:
      return <span className="whitespace-pre-wrap">{renderText(msg.text)}</span>
  }
}
