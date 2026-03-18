'use client'

import React, { useState } from 'react'
import AppShell from '@/components/AppShell'
import { useParams } from 'next/navigation'
import {
  useBroadcastChannel,
  useChannelUpdates,
  useChannelSubscribers,
  useSubscribeChannel,
  useUnsubscribeChannel,
  useCreateChannelUpdate,
  useDeleteChannelUpdate,
  usePinChannelUpdate,
} from '@/hooks/useBroadcastChannels'
import ChannelHeader from '@/components/channels/ChannelHeader'
import UpdateCard from '@/components/channels/UpdateCard'
import {
  Plus, Radio, X, Image, Video, BarChart3, Calendar,
  AlertTriangle, Clock, Users, ArrowLeft,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import type { ChannelMember } from '@/types/channels'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

/* ---------- Subscriber row ---------- */
function SubscriberRow({ member }: { member: ChannelMember }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-brand-divider last:border-b-0">
      <div className="w-9 h-9 rounded-full bg-brand-secondary flex items-center justify-center text-brand-text/40 text-xs font-bold">
        ?
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-brand-text truncate">{member.user_id}</p>
        <p className="text-[11px] text-brand-text/40">Subscribed {formatDate(member.subscribed_at)}</p>
      </div>
      <span className="text-[10px] font-semibold text-brand-text/40 uppercase tracking-wider">{member.role}</span>
    </div>
  )
}

export default function ChannelDetailPage() {
  const params = useParams()
  const channelId = params.channelId as string

  const { data: channel, isLoading: loadingChannel } = useBroadcastChannel(channelId)
  const { data: updates, isLoading: loadingUpdates } = useChannelUpdates(channelId)
  const subscribeMutation = useSubscribeChannel()
  const unsubscribeMutation = useUnsubscribeChannel()
  const createUpdate = useCreateChannelUpdate()
  const deleteUpdate = useDeleteChannelUpdate()
  const pinUpdate = usePinChannelUpdate()

  const [activeTab, setActiveTab] = useState('updates')
  const [showPublish, setShowPublish] = useState(false)
  const [updateBody, setUpdateBody] = useState('')
  const [updateTitle, setUpdateTitle] = useState('')
  const [updateType, setUpdateType] = useState('announcement')

  const isOwner = channel?.viewer_role === 'admin'
  const isEditor = channel?.viewer_role === 'editor'
  const canPublish = isOwner || isEditor

  // Only fetch subscribers when owner views that tab
  const { data: subscribers } = useChannelSubscribers(
    isOwner && activeTab === 'subscribers' ? channelId : undefined
  )

  const handlePublish = async () => {
    if (!updateBody.trim()) return
    await createUpdate.mutateAsync({
      channelId,
      update_type: updateType,
      title: updateTitle.trim() || undefined,
      body: updateBody.trim(),
      is_urgent: updateType === 'alert',
    })
    setUpdateBody('')
    setUpdateTitle('')
    setUpdateType('announcement')
    setShowPublish(false)
  }

  /* ---- Loading ---- */
  if (loadingChannel) {
    return (
      <AppShell>
      <div className="max-w-3xl mx-auto px-4 pt-8 pb-16 space-y-4">
        <div className="bg-white rounded-2xl border border-brand-divider overflow-hidden animate-pulse">
          <div className="h-[120px] bg-brand-secondary" />
          <div className="px-6 pb-5 -mt-7 space-y-3">
            <div className="w-[52px] h-[52px] rounded-xl bg-brand-secondary" />
            <div className="h-5 w-40 bg-brand-secondary rounded" />
            <div className="h-3 w-24 bg-brand-secondary rounded" />
          </div>
        </div>
      </div>
      </AppShell>
    )
  }

  /* ---- Not found ---- */
  if (!channel) {
    return (
      <AppShell>
      <div className="max-w-3xl mx-auto px-4 pt-8 pb-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-brand-secondary mx-auto mb-4 flex items-center justify-center">
          <Radio className="w-8 h-8 text-brand-text/20" />
        </div>
        <p className="text-sm font-semibold text-brand-text/60">Channel not found</p>
        <Link href="/channels" className="text-xs text-brand-text/40 mt-2 inline-flex items-center gap-1 hover:text-brand-text transition-colors">
          <ArrowLeft className="w-3 h-3" /> Back to Channels
        </Link>
      </div>
      </AppShell>
    )
  }

  // Separate pinned updates
  const pinnedUpdates = updates?.filter(u => u.is_pinned) ?? []
  const regularUpdates = updates?.filter(u => !u.is_pinned) ?? []

  return (
    <AppShell>
    <div className="max-w-3xl mx-auto px-4 pt-8 pb-16 space-y-6">
      {/* Back link */}
      <Link href="/channels" className="inline-flex items-center gap-1.5 text-xs text-brand-text/40 hover:text-brand-text transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />
        Channels
      </Link>

      {/* Header */}
      <ChannelHeader
        channel={channel}
        onSubscribe={() => subscribeMutation.mutate(channelId)}
        onUnsubscribe={() => unsubscribeMutation.mutate(channelId)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isOwner={isOwner}
      />

      {/* ====== TAB: UPDATES ====== */}
      {activeTab === 'updates' && (
        <>
          {/* Publisher compose bar */}
          {canPublish && !showPublish && (
            <button
              onClick={() => setShowPublish(true)}
              className="w-full flex items-center gap-3 bg-white border border-brand-divider rounded-2xl px-4 py-3 hover:bg-brand-secondary/30 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-brand-secondary flex items-center justify-center">
                <Plus className="w-4 h-4 text-brand-text/40" />
              </div>
              <span className="text-sm text-brand-text/40">Write an update...</span>
            </button>
          )}

          {/* Publish form */}
          <AnimatePresence>
            {showPublish && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white border border-brand-divider rounded-2xl p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-brand-text">New Update</h3>
                  <button
                    onClick={() => setShowPublish(false)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-brand-text/40 hover:bg-brand-secondary transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Type chips */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {[
                    { value: 'announcement', icon: <Radio className="w-3 h-3" />, label: 'Announcement' },
                    { value: 'image', icon: <Image className="w-3 h-3" />, label: 'Photo' },
                    { value: 'video', icon: <Video className="w-3 h-3" />, label: 'Video' },
                    { value: 'poll', icon: <BarChart3 className="w-3 h-3" />, label: 'Poll' },
                    { value: 'event', icon: <Calendar className="w-3 h-3" />, label: 'Event' },
                    { value: 'alert', icon: <AlertTriangle className="w-3 h-3" />, label: 'Urgent' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setUpdateType(opt.value)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors flex-shrink-0 ${
                        updateType === opt.value
                          ? 'bg-brand-text text-brand-bg'
                          : 'border border-brand-divider text-brand-text hover:bg-brand-secondary/50'
                      }`}
                    >
                      {opt.icon}
                      {opt.label}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={updateTitle}
                  onChange={(e) => setUpdateTitle(e.target.value)}
                  placeholder="Title (optional)"
                  className="w-full px-4 py-2.5 bg-brand-bg border border-brand-divider rounded-xl text-sm text-brand-text placeholder:text-brand-text/30 focus:outline-none focus:ring-2 focus:ring-brand-text/10 transition-all"
                />

                <textarea
                  value={updateBody}
                  onChange={(e) => setUpdateBody(e.target.value)}
                  placeholder="Write your update..."
                  rows={4}
                  className="w-full px-4 py-2.5 bg-brand-bg border border-brand-divider rounded-xl text-sm text-brand-text placeholder:text-brand-text/30 focus:outline-none focus:ring-2 focus:ring-brand-text/10 transition-all resize-none"
                />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button className="w-8 h-8 rounded-lg border border-brand-divider flex items-center justify-center text-brand-text/40 hover:bg-brand-secondary/50 transition-colors">
                      <Image className="w-4 h-4" />
                    </button>
                    <button className="w-8 h-8 rounded-lg border border-brand-divider flex items-center justify-center text-brand-text/40 hover:bg-brand-secondary/50 transition-colors">
                      <Clock className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={handlePublish}
                    disabled={!updateBody.trim() || createUpdate.isPending}
                    className="px-5 py-2 bg-brand-text text-brand-bg text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  >
                    {createUpdate.isPending ? 'Publishing...' : 'Publish'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Updates feed */}
          {loadingUpdates ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-brand-divider p-4 animate-pulse space-y-2">
                  <div className="h-3 w-20 bg-brand-secondary rounded" />
                  <div className="h-4 w-48 bg-brand-secondary rounded" />
                  <div className="h-3 w-full bg-brand-secondary rounded" />
                  <div className="h-3 w-3/4 bg-brand-secondary rounded" />
                </div>
              ))}
            </div>
          ) : (pinnedUpdates.length > 0 || regularUpdates.length > 0) ? (
            <div className="space-y-4">
              {/* Pinned updates first */}
              {pinnedUpdates.map((update, i) => (
                <motion.div
                  key={update.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <UpdateCard
                    update={update}
                    channel={channel}
                    isOwner={isOwner}
                    onDelete={(id) => deleteUpdate.mutate({ channelId, updateId: id })}
                    onPin={(id, pinned) => pinUpdate.mutate({ channelId, updateId: id, pinned })}
                  />
                </motion.div>
              ))}
              {/* Regular updates */}
              {regularUpdates.map((update, i) => (
                <motion.div
                  key={update.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (pinnedUpdates.length + i) * 0.03 }}
                >
                  <UpdateCard
                    update={update}
                    channel={channel}
                    isOwner={isOwner}
                    onDelete={(id) => deleteUpdate.mutate({ channelId, updateId: id })}
                    onPin={(id, pinned) => pinUpdate.mutate({ channelId, updateId: id, pinned })}
                  />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-brand-secondary mx-auto mb-3 flex items-center justify-center">
                <Radio className="w-7 h-7 text-brand-text/20" />
              </div>
              <p className="text-sm font-semibold text-brand-text/60">No updates yet</p>
              <p className="text-xs text-brand-text/40 mt-1">
                {canPublish ? 'Publish your first update to your subscribers' : `${channel.name} hasn't posted yet`}
              </p>
              {canPublish && (
                <button
                  onClick={() => setShowPublish(true)}
                  className="mt-4 bg-brand-text text-brand-bg text-sm font-bold rounded-xl px-5 py-2 hover:opacity-90 transition-opacity"
                >
                  Publish Update
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* ====== TAB: ABOUT ====== */}
      {activeTab === 'about' && (
        <div className="bg-white border border-brand-divider rounded-2xl p-5 space-y-4">
          {channel.description && (
            <div>
              <h3 className="text-xs font-bold text-brand-text/50 uppercase tracking-wider mb-1.5">Description</h3>
              <p className="text-sm text-brand-text/80 leading-relaxed">{channel.description}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-bold text-brand-text/50 uppercase tracking-wider mb-1">Category</h3>
              <p className="text-sm text-brand-text capitalize">{channel.category || channel.channel_type}</p>
            </div>
            <div>
              <h3 className="text-xs font-bold text-brand-text/50 uppercase tracking-wider mb-1">Comment Policy</h3>
              <p className="text-sm text-brand-text capitalize">{channel.comment_mode.replace('_', ' ')}</p>
            </div>
            <div>
              <h3 className="text-xs font-bold text-brand-text/50 uppercase tracking-wider mb-1">Subscribers</h3>
              <p className="text-sm text-brand-text font-mono">{channel.subscriber_count.toLocaleString()}</p>
            </div>
            <div>
              <h3 className="text-xs font-bold text-brand-text/50 uppercase tracking-wider mb-1">Created</h3>
              <p className="text-sm text-brand-text">{formatDate(channel.created_at)}</p>
            </div>
          </div>
          {channel.paid_access && (
            <div className="bg-brand-secondary/50 rounded-xl px-4 py-3">
              <p className="text-xs font-bold text-brand-text/60 uppercase tracking-wider">Paid Channel</p>
              <p className="text-sm text-brand-text mt-0.5">
                Subscription required{channel.subscription_price_cents > 0 && ` - ${(channel.subscription_price_cents / 100).toFixed(2)}/mo`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ====== TAB: SUBSCRIBERS (owner only) ====== */}
      {activeTab === 'subscribers' && isOwner && (
        <div className="bg-white border border-brand-divider rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-text/50" />
              <h3 className="text-sm font-bold text-brand-text">
                <span className="font-mono">{channel.subscriber_count.toLocaleString()}</span> Subscribers
              </h3>
            </div>
          </div>
          {subscribers && subscribers.length > 0 ? (
            <div>
              {subscribers.map((member) => (
                <SubscriberRow key={member.user_id} member={member} />
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <Users className="w-8 h-8 text-brand-text/20 mx-auto mb-2" />
              <p className="text-sm text-brand-text/50">No subscribers yet</p>
            </div>
          )}
        </div>
      )}
    </div>
    </AppShell>
  )
}
