'use client'

import React, { useMemo, useState } from 'react'
import {
  useBroadcastChannel,
  useChannelUpdates,
  useCreateChannelUpdate,
  useDeleteChannelUpdate,
  usePinChannelUpdate,
  useSubscribeChannel,
  useUnsubscribeChannel,
  useSparkUpdate,
  useUnsparkUpdate,
  useStashUpdate,
  useUnstashUpdate,
  useRecordView,
} from '@/hooks/useBroadcastChannels'
import ChannelComposer, { type ComposerPayload } from '@/components/channels/ChannelComposer'
import UpdateCard from '@/components/channels/UpdateCard'
import {
  ArrowLeft, BadgeCheck, Bell, BellOff, Hash, Info, Loader2, Radio, X,
} from 'lucide-react'

interface ChannelPanelProps {
  channelId: string
  /** Mobile back arrow: the list and the panel share one column there. */
  onBack?: () => void
}

/**
 * A channel, opened inside the messenger.
 *
 * Channels used to be a link out to /channels/<id>, which threw you into a
 * different page with its own shell — the founder's complaint. This renders
 * the same channel in the middle column beside the conversation list, the
 * way a direct chat or a group does, so the messenger stays one screen.
 *
 * It is deliberately the messenger-sized subset: the header, the stream of
 * updates, and the composer when you may publish. Analytics, drafts,
 * subscriber management and settings stay on the full channel page, which
 * the "Open full channel" control in About reaches — those are management
 * screens, not a conversation, and cramming them in here is what made the
 * old page feel like a second app.
 */
export default function ChannelPanel({ channelId, onBack }: ChannelPanelProps) {
  const [tab, setTab] = useState<'updates' | 'about'>('updates')
  const [error, setError] = useState<string | null>(null)

  const { data: channel, isLoading } = useBroadcastChannel(channelId)
  const { data: updates, isLoading: updatesLoading } = useChannelUpdates(channelId, 50)

  const subscribe = useSubscribeChannel()
  const unsubscribe = useUnsubscribeChannel()
  const createUpdate = useCreateChannelUpdate()
  const deleteUpdate = useDeleteChannelUpdate()
  const pinUpdate = usePinChannelUpdate()
  const spark = useSparkUpdate()
  const unspark = useUnsparkUpdate()
  const stash = useStashUpdate()
  const unstash = useUnstashUpdate()
  const recordView = useRecordView()

  const role = channel?.viewer_role ?? ''
  const canPublish = role === 'owner' || role === 'admin' || role === 'editor'
  const isSubscribed = canPublish || role === 'subscriber'

  // Pinned first, then newest. The API returns them in one list.
  const ordered = useMemo(() => {
    const list = updates ?? []
    return [...list].sort((a, b) => {
      if (!!a.is_pinned !== !!b.is_pinned) return a.is_pinned ? -1 : 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [updates])

  const avatarUrl = channel?.avatar_media_id
    ? `/v1/media/${channel.avatar_media_id}/serve`
    : null

  const handlePublish = async (payload: ComposerPayload) => {
    setError(null)
    try {
      await createUpdate.mutateAsync({ channelId, ...payload })
    } catch {
      setError('Could not publish that update.')
    }
  }

  const toggleSubscription = () => {
    setError(null)
    const m = isSubscribed ? unsubscribe : subscribe
    m.mutate(channelId, { onError: () => setError('Could not change your subscription.') })
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-brand-secondary">
        <Loader2 className="h-6 w-6 animate-spin text-brand-text/30" />
      </div>
    )
  }

  if (!channel) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-brand-secondary px-6 text-center">
        <Hash className="h-10 w-10 text-brand-text/20" />
        <p className="text-sm font-semibold text-brand-text">Channel unavailable</p>
        <p className="text-[13px] text-brand-text/60">
          It may have been removed, or you may no longer have access.
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-brand-secondary">
      {/* Header — same shape as a DM's, so the column reads consistently */}
      <header className="flex shrink-0 items-center gap-3 border-b border-brand-divider bg-brand-bg px-4 py-3">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back to conversations"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-brand-text/60 transition-colors hover:bg-brand-secondary hover:text-brand-text md:hidden"
          >
            <ArrowLeft className="h-[18px] w-[18px]" />
          </button>
        )}

        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-secondary text-brand-text/60">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Hash className="h-5 w-5" strokeWidth={1.75} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate text-[15px] font-semibold -tracking-[0.014em] text-brand-text">
              {channel.name}
            </h2>
            {channel.is_verified && (
              <BadgeCheck className="h-4 w-4 shrink-0 text-primary-ink" aria-label="Verified" />
            )}
          </div>
          <p className="truncate text-xs text-brand-text/60">
            @{channel.handle}
            <span className="px-1.5 text-brand-text/30">·</span>
            {channel.subscriber_count} subscribers
          </p>
        </div>

        {/* Subscribing is the one action that belongs to a channel itself.
            Owners and editors are members by definition, so they get the
            bell state and no way to unsubscribe from their own channel. */}
        {canPublish ? (
          <span className="flex items-center gap-1.5 rounded-full bg-primary-tint px-3 py-1.5 text-[13px] font-semibold text-primary-ink">
            <Radio className="h-3.5 w-3.5" strokeWidth={2} />
            You publish here
          </span>
        ) : (
          <button
            onClick={toggleSubscription}
            disabled={subscribe.isPending || unsubscribe.isPending}
            aria-pressed={isSubscribed}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors disabled:opacity-50 ${
              isSubscribed
                ? 'bg-brand-secondary text-brand-text/70 hover:text-brand-text'
                : 'bg-primary-ink text-white hover:bg-primary-hover'
            }`}
          >
            {isSubscribed ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
            {isSubscribed ? 'Subscribed' : 'Subscribe'}
          </button>
        )}

        <button
          onClick={() => setTab(tab === 'about' ? 'updates' : 'about')}
          aria-pressed={tab === 'about'}
          aria-label="Channel info"
          title="Channel info"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
            tab === 'about'
              ? 'bg-primary-ink text-white'
              : 'text-brand-text/60 hover:bg-brand-secondary hover:text-brand-text'
          }`}
        >
          <Info className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </button>
      </header>

      {error && (
        <div className="flex shrink-0 items-center justify-between gap-3 bg-danger/10 px-4 py-2 text-[13px] font-medium text-danger">
          {error}
          <button onClick={() => setError(null)} aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {tab === 'about' ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-xl space-y-5">
            <section>
              <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-text/50">
                About
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-brand-text/80">
                {channel.description || 'No description yet.'}
              </p>
            </section>
            <dl className="grid grid-cols-2 gap-4 rounded-2xl border border-brand-divider bg-brand-bg p-4">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-brand-text/50">
                  Subscribers
                </dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums text-brand-text">
                  {channel.subscriber_count}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-brand-text/50">
                  Updates
                </dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums text-brand-text">
                  {channel.update_count}
                </dd>
              </div>
              {channel.category && (
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-brand-text/50">
                    Category
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-brand-text">{channel.category}</dd>
                </div>
              )}
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-brand-text/50">
                  Type
                </dt>
                <dd className="mt-1 text-sm font-medium capitalize text-brand-text">
                  {channel.channel_type}
                </dd>
              </div>
            </dl>

            {/* The management screens genuinely live elsewhere. This is the
                one link out, and it says so rather than pretending. */}
            {canPublish && (
              <a
                href={`/channels/${channelId}`}
                className="flex items-center justify-center gap-2 rounded-xl border border-brand-divider bg-brand-bg px-4 py-3 text-[13px] font-semibold text-brand-text transition-colors hover:border-primary-outline hover:text-primary-ink"
              >
                Open full channel for analytics, drafts and settings
              </a>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
            {updatesLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-brand-text/30" />
              </div>
            ) : ordered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
                <Radio className="h-10 w-10 text-brand-text/20" />
                <p className="text-sm font-semibold text-brand-text">Nothing posted yet</p>
                <p className="max-w-xs text-[13px] text-brand-text/60">
                  {canPublish
                    ? 'Your first update will reach every subscriber.'
                    : 'Updates from this channel will appear here.'}
                </p>
              </div>
            ) : (
              <div className="mx-auto max-w-2xl space-y-3">
                {ordered.map((update) => (
                  <UpdateCard
                    key={update.id}
                    update={update}
                    channel={channel}
                    channelId={channelId}
                    isOwner={canPublish}
                    onDelete={(updateId) => deleteUpdate.mutate({ channelId, updateId })}
                    onPin={(updateId, pinned) => pinUpdate.mutate({ channelId, updateId, pinned })}
                    onLike={(cid, updateId) => spark.mutate({ channelId: cid, updateId })}
                    onUnlike={(cid, updateId) => unspark.mutate({ channelId: cid, updateId })}
                    onStash={(cid, updateId) => stash.mutate({ channelId: cid, updateId })}
                    onUnstash={(cid, updateId) => unstash.mutate({ channelId: cid, updateId })}
                    onView={(cid, updateId) => recordView.mutate({ channelId: cid, updateId })}
                  />
                ))}
              </div>
            )}
          </div>

          {canPublish ? (
            <div className="shrink-0 border-t border-brand-divider bg-brand-bg px-4 py-3">
              <div className="mx-auto max-w-2xl">
                <ChannelComposer
                  channel={channel}
                  onPublish={handlePublish}
                  isPublishing={createUpdate.isPending}
                />
              </div>
            </div>
          ) : (
            <p className="shrink-0 border-t border-brand-divider bg-brand-bg px-4 py-3 text-center text-[13px] text-brand-text/50">
              Only the channel owner posts here.
            </p>
          )}
        </>
      )}
    </div>
  )
}
