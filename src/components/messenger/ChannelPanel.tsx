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
  useUpdateBroadcastChannel,
  useReactToUpdate,
  useUnreactToUpdate,
  useRecordView,
  useChannelAdmins,
  useSetChannelMuted,
  useChannelSubscribers,
} from '@/hooks/useBroadcastChannels'
import ChannelComposer, { type ComposerPayload } from '@/components/channels/ChannelComposer'
import UpdateCard from '@/components/channels/UpdateCard'
import OverviewTab from '@/components/channels/tabs/OverviewTab'
import AnalyticsTab from '@/components/channels/tabs/AnalyticsTab'
import SettingsTab from '@/components/channels/tabs/SettingsTab'
import SubscriberSettingsTab from '@/components/channels/tabs/SubscriberSettingsTab'
import SubscribersTab from '@/components/channels/tabs/SubscribersTab'
import {
  ArrowLeft, BadgeCheck, Bell, BellOff, Hash, Loader2, Pencil, Radio, Settings2, X,
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
 * Owners and editors get Analytics and Settings here too, so running a
 * channel never means leaving the messenger. Drafts and subscriber
 * management are the only things still on the full channel page.
 */
export default function ChannelPanel({ channelId, onBack }: ChannelPanelProps) {
  const [tab, setTab] = useState<'overview' | 'updates' | 'members' | 'about' | 'analytics' | 'settings'>('updates')
  const [error, setError] = useState<string | null>(null)
  const [showComposer, setShowComposer] = useState(false)

  const { data: channel, isLoading } = useBroadcastChannel(channelId)
  const { data: updates, isLoading: updatesLoading } = useChannelUpdates(channelId, 50)

  const subscribe = useSubscribeChannel()
  const unsubscribe = useUnsubscribeChannel()
  const updateChannel = useUpdateBroadcastChannel()
  const createUpdate = useCreateChannelUpdate()
  const deleteUpdate = useDeleteChannelUpdate()
  const pinUpdate = usePinChannelUpdate()
  const react = useReactToUpdate()
  const unreact = useUnreactToUpdate()
  const recordView = useRecordView()
  const setMuted = useSetChannelMuted()

  const role = channel?.viewer_role ?? ''
  const canPublish = role === 'owner' || role === 'admin' || role === 'editor'
  const isSubscribed = canPublish || role === 'subscriber'

  // Only the Overview shows who runs the channel, so only it pays for them.
  const { data: channelAdmins } = useChannelAdmins(
    canPublish && tab === 'overview' ? channelId : undefined
  )
  const { data: subscribers, isLoading: subscribersLoading } = useChannelSubscribers(
    canPublish && tab === 'members' ? channelId : undefined
  )

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
      // Closed only on success. A failed publish must leave the form open
      // with what was typed still in it — closing on the way out would throw
      // the post away and show an error about a post that no longer exists.
      setShowComposer(false)
    } catch {
      setError('Could not publish that update.')
    }
  }

  const toggleSubscription = () => {
    setError(null)
    const m = isSubscribed ? unsubscribe : subscribe
    m.mutate(channelId, { onError: () => setError('Could not change your subscription.') })
  }

  const handleSettingsUpdate = (data: Record<string, unknown>) => {
    setError(null)
    updateChannel.mutate(
      { channelId, ...data },
      { onError: () => setError('Could not save those settings.') }
    )
  }

  /*
    Two different channels, depending on who is looking.

    Someone who RUNS it gets the dashboard: how it is doing, what is in it,
    and the controls over it. Someone who FOLLOWS it gets the thing itself —
    the posts, what it is, and their own relationship to it. A subscriber has
    no use for an engagement rate they cannot act on, and every control on the
    owner's Settings is a write the server would refuse them.

    Both Settings tabs are called Settings and are not the same screen:
    SettingsTab edits the CHANNEL, SubscriberSettingsTab edits the VIEWER'S
    membership — notifications and leaving.
  */
  const tabs = canPublish
    ? ([
        { id: 'overview', label: 'Overview' },
        { id: 'updates', label: 'Posts' },
        { id: 'members', label: 'Members' },
        { id: 'analytics', label: 'Analytics' },
        { id: 'settings', label: 'Settings' },
        { id: 'about', label: 'About' },
      ] as const)
    : ([
        { id: 'updates', label: 'Posts' },
        { id: 'about', label: 'About' },
        { id: 'settings', label: 'Settings' },
      ] as const)

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
      <header className="flex shrink-0 items-start gap-3 border-b border-brand-divider bg-brand-bg px-5 py-4">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back to conversations"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-brand-text/60 transition-colors hover:bg-brand-secondary hover:text-brand-text md:hidden"
          >
            <ArrowLeft className="h-[18px] w-[18px]" />
          </button>
        )}

        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-divider bg-brand-secondary text-brand-text/60">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Hash className="h-5 w-5" strokeWidth={1.75} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate text-[17px] font-semibold -tracking-[0.018em] text-brand-text">
              {channel.name}
            </h2>
            {channel.is_verified && (
              <BadgeCheck className="h-4 w-4 shrink-0 text-primary-ink" aria-label="Verified" />
            )}
            {/* What it is and that it is live, on the same line as the name:
                both are already on the record and neither was shown. */}
            <span className="shrink-0 rounded-full bg-brand-secondary px-2 py-0.5 text-[11px] font-medium capitalize text-brand-text/60">
              {channel.channel_type} channel
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Active
            </span>
          </div>
          <p className="truncate text-[12px] text-brand-text/55">
            @{channel.handle}
            <span className="px-1.5 text-brand-text/30">·</span>
            {channel.subscriber_count} {channel.subscriber_count === 1 ? 'subscriber' : 'subscribers'}
          </p>
          {channel.description && (
            <p className="mt-1 line-clamp-1 text-[12px] text-brand-text/60">{channel.description}</p>
          )}
        </div>

        {/* Subscribing is the one action that belongs to a channel itself.
            Owners and editors are members by definition, so they get the
            bell state and no way to unsubscribe from their own channel. */}
        {canPublish ? (
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full bg-primary-tint px-3 py-1.5 text-[13px] font-semibold text-primary-ink sm:flex">
              <Radio className="h-3.5 w-3.5" strokeWidth={2} />
              You publish here
            </span>
            <button
              onClick={() => setTab('settings')}
              className="bg-primary-grad flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
            >
              <Settings2 className="h-3.5 w-3.5" strokeWidth={2} />
              Edit channel
            </button>
          </div>
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

      </header>

      {/* Tabs. Analytics and Settings are here rather than on another page,
          so running a channel never means leaving the messenger. */}
      <div
        role="tablist"
        aria-label="Channel sections"
        className="flex shrink-0 items-center gap-1 border-b border-brand-divider bg-brand-bg px-4 pb-2"
      >
        {tabs.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                active
                  ? 'bg-primary-tint text-primary-ink'
                  : 'text-brand-text/55 hover:bg-brand-secondary hover:text-brand-text'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {error && (
        <div className="flex shrink-0 items-center justify-between gap-3 bg-danger/10 px-4 py-2 text-[13px] font-medium text-danger">
          {error}
          <button onClick={() => setError(null)} aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Both tabs render a bare `space-y-4` with no padding of their own,
          so the panel supplies the gutter and the scroll container. */}
      {tab === 'overview' && canPublish ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="mx-auto max-w-3xl">
            <OverviewTab
              channel={channel}
              updates={updates}
              admins={channelAdmins}
              onViewPosts={() => setTab('updates')}
            />
          </div>
        </div>
      ) : tab === 'members' && canPublish ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="mx-auto max-w-3xl">
            <SubscribersTab
              channel={channel}
              subscribers={subscribers}
              isLoading={subscribersLoading}
            />
          </div>
        </div>
      ) : tab === 'settings' && !canPublish ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="mx-auto max-w-2xl">
            <SubscriberSettingsTab
              channel={channel}
              isSaving={setMuted.isPending}
              isLeaving={unsubscribe.isPending}
              onSetMuted={(muted) =>
                setMuted.mutate(
                  { channelId, muted },
                  { onError: () => setError('Could not change that. Please try again.') },
                )
              }
              onLeave={() =>
                unsubscribe.mutate(channelId, {
                  onError: () => setError('Could not leave the channel. Please try again.'),
                })
              }
            />
          </div>
        </div>
      ) : tab === 'analytics' ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="mx-auto max-w-2xl">
            <AnalyticsTab channel={channel} updates={updates} />
          </div>
        </div>
      ) : tab === 'settings' ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="mx-auto max-w-2xl">
            <SettingsTab
              channel={channel}
              onUpdate={handleSettingsUpdate}
              role={role === 'editor' ? 'editor' : 'owner'}
            />
          </div>
        </div>
      ) : tab === 'about' ? (
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

            {/* Analytics and Settings are tabs here now. Drafts and
                subscriber management are the only screens still elsewhere,
                and this says which rather than pretending. */}
            {canPublish && (
              <a
                href={`/channels/${channelId}`}
                className="flex items-center justify-center gap-2 rounded-xl border border-brand-divider bg-brand-bg px-4 py-3 text-[13px] font-semibold text-brand-text transition-colors hover:border-primary-outline hover:text-primary-ink"
              >
                Open full channel for drafts and subscribers
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
                    // A channel is a broadcast: an emoji reaction and a
                    // share button, nothing else. Comments, echo and
                    // bookmark belong to a group.
                    onReact={(cid, updateId, emoji) => react.mutate({ channelId: cid, updateId, emoji })}
                    onUnreact={(cid, updateId) => unreact.mutate({ channelId: cid, updateId })}
                    onView={(cid, updateId) => recordView.mutate({ channelId: cid, updateId })}
                  />
                ))}
              </div>
            )}
          </div>

          {canPublish ? (
            /*
              A BAR, not the composer.

              ChannelComposer is a whole form — six update types, a title, a
              rich-text body, attachments — and it was rendered inline at the
              bottom of this tab. In a panel this tall that meant the form WAS
              the tab: open the channel you run and you see a blank post form,
              with the feed pushed off-screen above it. A channel is its posts;
              writing one is something you do on it.
            */
            <div className="shrink-0 border-t border-brand-divider bg-brand-bg px-4 py-3">
              <div className="mx-auto max-w-2xl">
                <button
                  type="button"
                  onClick={() => setShowComposer(true)}
                  className="flex w-full items-center gap-3 rounded-full border border-brand-divider bg-brand-card px-4 py-2.5 text-left transition-colors hover:border-primary-outline"
                >
                  <span className="bg-primary-grad flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white">
                    <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </span>
                  <span className="flex-1 truncate text-[14px] text-brand-text/45">
                    Share an update with your subscribers
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <p className="shrink-0 border-t border-brand-divider bg-brand-bg px-4 py-3 text-center text-[13px] text-brand-text/50">
              Only the channel owner posts here.
            </p>
          )}
        </>
      )}

      {showComposer && canPublish && (
        <div
          className="fixed inset-0 z-9999 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-xs sm:p-6"
          onClick={(e) => { if (e.target === e.currentTarget) setShowComposer(false) }}
          role="dialog"
          aria-modal="true"
          aria-label="New update"
        >
          <div className="relative my-auto w-full max-w-2xl">
            <button
              type="button"
              onClick={() => setShowComposer(false)}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-brand-card/80 text-brand-text/50 backdrop-blur-xs transition-colors hover:bg-brand-secondary hover:text-brand-text"
            >
              <X className="h-4 w-4" />
            </button>
            <ChannelComposer
              channel={channel}
              onPublish={handlePublish}
              isPublishing={createUpdate.isPending}
            />
          </div>
        </div>
      )}
    </div>
  )
}
