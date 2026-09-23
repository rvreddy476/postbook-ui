'use client'

import React, { Suspense, useState, useCallback, useEffect, useRef } from 'react'
import AppShell from '@/components/AppShell'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  useBroadcastChannel,
  useChannelUpdates,
  useChannelSubscribers,
  useSubscribeChannel,
  useUnsubscribeChannel,
  useCreateChannelUpdate,
  useDeleteChannelUpdate,
  usePinChannelUpdate,
  useUpdateBroadcastChannel,
  useSparkUpdate,
  useUnsparkUpdate,
  useStashUpdate,
  useUnstashUpdate,
  useEchoUpdate,
  useUnechoUpdate,
  useRecordView,
} from '@/hooks/useBroadcastChannels'
import ChannelComposer, { type ComposerPayload } from '@/components/channels/ChannelComposer'
import ChannelEditModal from '@/components/channels/ChannelEditModal'
import ChannelSidebar from '@/components/channels/ChannelSidebar'
import UpdateCard from '@/components/channels/UpdateCard'
import AnalyticsTab from '@/components/channels/tabs/AnalyticsTab'
import SettingsTab from '@/components/channels/tabs/SettingsTab'
import SubscribersTab from '@/components/channels/tabs/SubscribersTab'
import DraftsTab from '@/components/channels/tabs/DraftsTab'
import AboutTab from '@/components/channels/tabs/AboutTab'
import {
  Plus, Radio, ArrowLeft, Pencil, Settings,
  Bell, Check, ChevronDown, MoreVertical,
  Share2, Trash2, Eye, BadgeCheck, Loader2,
  Lock, ShieldAlert, X, Copy,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import type { BroadcastChannel } from '@/types/channels'

/* ===== Helpers ===== */
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`
}
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

/* ===== Role & Capability ===== */
type ChannelRole = 'owner' | 'editor' | 'subscriber' | 'visitor'
type TabId = 'updates' | 'subscribers' | 'analytics' | 'drafts' | 'about' | 'settings'

function getRole(channel: BroadcastChannel): ChannelRole {
  if (channel.viewer_role === 'admin' || channel.viewer_role === 'owner') return 'owner'
  if (channel.viewer_role === 'editor') return 'editor'
  if (channel.viewer_role === 'subscriber') return 'subscriber'
  return 'visitor'
}

const can = {
  publish: (r: ChannelRole) => r === 'owner' || r === 'editor',
  editChannel: (r: ChannelRole) => r === 'owner' || r === 'editor',
  viewSubscribers: (r: ChannelRole) => r === 'owner' || r === 'editor',
  viewAnalytics: (r: ChannelRole) => r === 'owner' || r === 'editor',
  viewDrafts: (r: ChannelRole) => r === 'owner' || r === 'editor',
  deleteChannel: (r: ChannelRole) => r === 'owner',
}

const ADMIN_TABS: TabId[] = ['updates', 'subscribers', 'analytics', 'drafts', 'about', 'settings']
const PUBLIC_TABS: TabId[] = ['updates', 'about']

function isValidTab(tab: string | null, role: ChannelRole): tab is TabId {
  if (!tab) return false
  return (can.publish(role) ? ADMIN_TABS : PUBLIC_TABS).includes(tab as TabId)
}

interface TabDef { id: TabId; label: string; badge?: number }

function getTabsForRole(role: ChannelRole, subCount: number, draftCount: number): TabDef[] {
  /*
    The reference's words: Posts, Members. The ids stay as they are — they are
    in the URL (?tab=) and in saved links, so renaming them would break every
    one of those to change two labels.

    NO OVERVIEW tab, at the founder's request. The reference opens on a
    dashboard of counts and charts; a channel with one subscriber and no posts
    has nothing to put in it, and the page should open on the thing the
    channel IS.

    NO MODERATION tab either, and that one is not a choice: the report queue
    (/internal/channel-reports) is behind the internal service key, for
    platform moderators rather than a channel's own admin. Giving a channel
    owner that queue needs a server route that does not exist, so a tab here
    would be a button that 404s.
  */
  if (can.publish(role)) {
    return [
      { id: 'updates', label: 'Posts' },
      { id: 'subscribers', label: 'Members', badge: subCount || undefined },
      { id: 'drafts', label: 'Drafts', badge: draftCount || undefined },
      { id: 'analytics', label: 'Analytics' },
      { id: 'about', label: 'About' },
      { id: 'settings', label: 'Settings' },
    ]
  }
  return [{ id: 'updates', label: 'Posts' }, { id: 'about', label: 'About' }]
}

/* ===== Error Toast ===== */
function ErrorToast({ msg, onDismiss }: { msg: string; onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 5000); return () => clearTimeout(t) }, [onDismiss])
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-60 bg-danger text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg flex items-center gap-3">
      <ShieldAlert className="w-4 h-4 shrink-0" />{msg}
      <button onClick={onDismiss} className="ml-2 opacity-70 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
    </motion.div>
  )
}

/* ========== MAIN PAGE ========== */
function ChannelDetailContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const channelId = params.channelId as string

  /* Data */
  const { data: channel, isLoading: loadingChannel, error: channelError } = useBroadcastChannel(channelId)
  const { data: updates, isLoading: loadingUpdates } = useChannelUpdates(channelId)
  const subscribeMut = useSubscribeChannel()
  const unsubscribeMut = useUnsubscribeChannel()
  const createUpdate = useCreateChannelUpdate()
  const deleteUpdate = useDeleteChannelUpdate()
  const pinUpdate = usePinChannelUpdate()
  const updateChannel = useUpdateBroadcastChannel()
  const sparkMut = useSparkUpdate()
  const unsparkMut = useUnsparkUpdate()
  const stashMut = useStashUpdate()
  const unstashMut = useUnstashUpdate()
  const echoMut = useEchoUpdate()
  const unechoMut = useUnechoUpdate()
  const viewMut = useRecordView()

  const role: ChannelRole = channel ? getRole(channel) : 'visitor'
  const draftCount = 0

  /* Tab routing */
  const urlTab = searchParams.get('tab')
  const resolvedTab: TabId = isValidTab(urlTab, role) ? urlTab : 'updates'
  const [activeTab, setActiveTabLocal] = useState<TabId>(resolvedTab)

  useEffect(() => {
    const valid = isValidTab(urlTab, role) ? urlTab : 'updates'
    if (valid !== activeTab) setActiveTabLocal(valid)
  }, [urlTab, role]) // eslint-disable-line react-hooks/exhaustive-deps

  const setActiveTab = useCallback((tab: TabId) => {
    setActiveTabLocal(tab)
    const url = new URL(window.location.href)
    if (tab === 'updates') url.searchParams.delete('tab')
    else url.searchParams.set('tab', tab)
    window.history.replaceState({}, '', url.toString())
  }, [])

  /* Subscribers (lazy) */
  const { data: subscribers, isLoading: loadingSubs } = useChannelSubscribers(
    can.viewSubscribers(role) && activeTab === 'subscribers' ? channelId : undefined
  )

  /* UI state */
  const [showComposer, setShowComposer] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [mutError, setMutError] = useState<string | null>(null)
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (moreRef.current && !moreRef.current.contains(e.target as Node)) setShowMoreMenu(false) }
    if (showMoreMenu) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showMoreMenu])

  /* Mutations */
  const handlePublish = useCallback(async (payload: ComposerPayload) => {
    try {
      await createUpdate.mutateAsync({ channelId, ...payload } as any)
      setShowComposer(false)
    } catch { setMutError('Failed to publish update.') }
  }, [channelId, createUpdate])

  const handleDelete = useCallback((id: string) => {
    if (deleteUpdate.isPending) return
    if (!confirm('Delete this update? This cannot be undone.')) return
    deleteUpdate.mutate({ channelId, updateId: id }, { onError: () => setMutError('Failed to delete update.') })
  }, [channelId, deleteUpdate])

  const handlePin = useCallback((id: string, pinned: boolean) => {
    if (pinUpdate.isPending) return
    pinUpdate.mutate({ channelId, updateId: id, pinned }, { onError: () => setMutError('Failed to pin/unpin.') })
  }, [channelId, pinUpdate])

  const handleSubscribe = useCallback(() => {
    if (subscribeMut.isPending) return
    subscribeMut.mutate(channelId, { onError: () => setMutError('Failed to subscribe.') })
  }, [channelId, subscribeMut])

  const handleUnsubscribe = useCallback(() => {
    if (unsubscribeMut.isPending) return
    unsubscribeMut.mutate(channelId, { onError: () => setMutError('Failed to unsubscribe.') })
  }, [channelId, unsubscribeMut])

  const handleLike = useCallback((cId: string, updateId: string) => {
    sparkMut.mutate({ channelId: cId, updateId })
  }, [sparkMut])

  const handleUnlike = useCallback((cId: string, updateId: string) => {
    unsparkMut.mutate({ channelId: cId, updateId })
  }, [unsparkMut])

  const handleStash = useCallback((cId: string, updateId: string) => {
    stashMut.mutate({ channelId: cId, updateId })
  }, [stashMut])

  const handleUnstash = useCallback((cId: string, updateId: string) => {
    unstashMut.mutate({ channelId: cId, updateId })
  }, [unstashMut])

  const handleRepost = useCallback((cId: string, updateId: string, echoType: string) => {
    echoMut.mutate({ channelId: cId, updateId, echoType })
  }, [echoMut])

  const handleUnrepost = useCallback((cId: string, updateId: string) => {
    unechoMut.mutate({ channelId: cId, updateId })
  }, [unechoMut])

  const handleView = useCallback((cId: string, updateId: string) => {
    viewMut.mutate({ channelId: cId, updateId })
  }, [viewMut])

  const handleSettingsUpdate = useCallback((data: any) => {
    updateChannel.mutate({ channelId, ...data }, {
      onError: () => setMutError('Failed to update channel settings.'),
    })
  }, [channelId, updateChannel])

  const tabs = channel ? getTabsForRole(role, channel.subscriber_count, draftCount) : []

  /* ===== LOADING ===== */
  if (loadingChannel) {
    return (
      <AppShell>
        <div className="animate-pulse">
          <div className="h-32 sm:h-40 bg-brand-secondary" />
          <div className="bg-brand-card border-b border-brand-divider px-4 sm:px-6 pb-4">
            <div className="-mt-7 flex items-end gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-brand-secondary shrink-0" />
              <div className="space-y-2 py-2 flex-1">
                <div className="h-5 w-40 bg-brand-secondary rounded-sm" />
                <div className="h-3 w-24 bg-brand-secondary rounded-sm" />
              </div>
            </div>
            <div className="flex gap-4 mt-6">{[1,2,3,4].map(i => <div key={i} className="h-8 w-20 bg-brand-secondary rounded-sm" />)}</div>
          </div>
          <div className="p-5 space-y-4">
            {[1,2,3].map(i => <div key={i} className="bg-brand-card rounded-2xl border border-brand-divider p-4 animate-pulse space-y-2"><div className="h-3 w-20 bg-brand-secondary rounded-sm" /><div className="h-4 w-48 bg-brand-secondary rounded-sm" /><div className="h-3 w-full bg-brand-secondary rounded-sm" /></div>)}
          </div>
        </div>
      </AppShell>
    )
  }

  /* ===== ERROR / NOT FOUND / PRIVATE ===== */
  if (channelError || !channel) {
    const status = (channelError as any)?.response?.status
    const is403 = status === 403
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-secondary flex items-center justify-center mb-4">
            {is403 ? <Lock className="w-8 h-8 text-brand-text/20" /> : <Radio className="w-8 h-8 text-brand-text/20" />}
          </div>
          <p className="text-sm font-semibold text-brand-text/60">{is403 ? 'This channel is private' : 'Channel not found'}</p>
          <p className="text-xs text-brand-text/40 mt-1 max-w-xs">
            {is403 ? "You don't have permission to view this channel." : "The channel doesn't exist or has been removed."}
          </p>
          <Link href="/channels" className="text-xs text-brand-text/50 mt-4 inline-flex items-center gap-1 hover:text-brand-text transition-colors font-semibold">
            <ArrowLeft className="w-3 h-3" /> Back to Channels
          </Link>
        </div>
      </AppShell>
    )
  }

  /* ===== Derived ===== */
  const allUpdates = Array.isArray(updates) ? updates : []
  const pinnedUpdates = allUpdates.filter(u => u.is_pinned)
  const regularUpdates = allUpdates.filter(u => !u.is_pinned)
  const bannerSrc = channel.banner_media_id ? `/v1/media/${channel.banner_media_id}/serve` : null
  const avatarSrc = channel.avatar_media_id ? `/v1/media/${channel.avatar_media_id}/serve` : null
  /*
    A channel with no cover picks one of these, keyed on its name so it is
    stable rather than random on every render.

    They were stone, zinc and neutral — three greys with a brown cast, on the
    largest surface of the page. That is where "dull" came from: the widest
    block of colour on the screen was deliberately colourless. These are the
    product's own cerulean, stepped, so an empty channel still looks like it
    belongs to this product.
  */
  const gradient = [
    'from-brand-lift to-brand-deep',
    'from-brand-deep to-brand-text',
    'from-brand-accent to-brand-deep',
  ][channel.name.charCodeAt(0) % 3]

  return (
    <AppShell>
      <div className="min-h-screen">
        {/* ===== COVER ===== */}
        <div className="relative h-24 sm:h-28 w-full overflow-hidden bg-brand-text">
          {bannerSrc ? (
            <img src={bannerSrc} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full bg-linear-to-br ${gradient} opacity-80`}>
              <div className="absolute inset-0 flex items-center justify-center text-brand-bg/20 text-sm font-light tracking-[0.3em]">{channel.name}</div>
            </div>
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/30 via-transparent to-transparent" />
          <Link href="/channels" className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/40 backdrop-blur-xs text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-black/60 transition-all">
            <ArrowLeft className="w-3 h-3" /><span className="hidden sm:inline">Channels</span>
          </Link>
          {can.editChannel(role) && (
            <button onClick={() => setShowEditModal(true)} className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-black/70 transition-all">
              <Pencil className="w-3 h-3" /> Edit cover
            </button>
          )}
        </div>

        {/*
          ===== HEADER =====

          One card carrying the channel's identity and its actions, with the
          tabs along the bottom of it — the shape of the reference. It used to
          be a bare strip flush against the cover, so the name, the actions and
          the tabs all floated on the page with nothing holding them together.
        */}
        <div className="border-b border-brand-divider bg-brand-card">
          <div className="px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pt-3">
              {/* Left: avatar + info */}
              <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                <div className="relative -mt-8 shrink-0">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl border-[3px] border-white overflow-hidden shadow-lg bg-brand-bg">
                    {avatarSrc ? <img src={avatarSrc} alt={channel.name} className="w-full h-full object-cover" />
                    : <div className={`w-full h-full bg-linear-to-br ${gradient} flex items-center justify-center text-white font-black text-lg sm:text-xl`}>{channel.name.charAt(0).toUpperCase()}</div>}
                  </div>
                  {can.editChannel(role) && (
                    <button onClick={() => setShowEditModal(true)} className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-brand-text flex items-center justify-center border-2 border-white">
                      <Pencil className="w-2.5 h-2.5 text-brand-bg" />
                    </button>
                  )}
                </div>
                <div className="pt-0.5 sm:pt-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg sm:text-xl font-extrabold text-brand-text tracking-tight truncate">{channel.name}</h1>
                    {channel.is_verified && <BadgeCheck className="w-5 h-5 text-brand-text shrink-0" />}
                    {can.publish(role) && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-text/8 text-brand-text/55 shrink-0">{role === 'owner' ? 'Your channel' : 'Editor'}</span>}
                    {channel.channel_type !== 'public' && <span className="shrink-0 rounded-full bg-brand-text/8 px-2 py-0.5 text-[10px] font-semibold capitalize text-brand-text/55">{channel.channel_type}</span>}
                    {/* What the channel is about, and that it is live — both
                        already on the record, neither previously shown. */}
                    {channel.category && (
                      <span className="shrink-0 rounded-full bg-primary-tint px-2 py-0.5 text-[10px] font-semibold capitalize text-primary-ink">
                        {channel.category}
                      </span>
                    )}
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" />
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-brand-text/40 font-mono mt-0.5">@{channel.handle}</p>
                  {channel.description && <p className="text-sm text-brand-text/55 mt-1 sm:mt-1.5 leading-relaxed max-w-xl line-clamp-2">{channel.description}</p>}
                </div>
              </div>

              {/* Right: actions */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                {can.publish(role) ? (
                  <>
                    <button onClick={() => { setActiveTab('updates'); setShowComposer(true) }} className="flex items-center gap-1.5 bg-primary-ink text-white text-xs font-bold px-3 sm:px-4 py-2 rounded-xl hover:bg-primary-hover transition-opacity">
                      <Plus className="w-3.5 h-3.5" /> <span className="hidden xs:inline">+</span> Update
                    </button>
                    <button onClick={() => setShowEditModal(true)} className="flex items-center gap-1.5 border border-brand-divider text-brand-text text-xs font-semibold px-3 py-2 rounded-xl hover:bg-brand-secondary/50 transition-colors">
                      <Settings className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Manage Channel</span>
                    </button>
                    <div className="relative" ref={moreRef}>
                      <button onClick={() => setShowMoreMenu(!showMoreMenu)} className="w-8 h-8 rounded-lg border border-brand-divider flex items-center justify-center text-brand-text/50 hover:bg-brand-secondary/50 transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {showMoreMenu && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-brand-card border border-brand-divider rounded-xl shadow-lg z-50 py-1">
                          <button onClick={() => { navigator.clipboard.writeText(window.location.href); setShowMoreMenu(false) }} className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text hover:bg-brand-secondary/50 w-full text-left"><Copy className="w-3.5 h-3.5" /> Copy channel link</button>
                          <button onClick={() => setShowMoreMenu(false)} className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text hover:bg-brand-secondary/50 w-full text-left"><Share2 className="w-3.5 h-3.5" /> Share channel</button>
                          <button onClick={() => setShowMoreMenu(false)} className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text hover:bg-brand-secondary/50 w-full text-left"><Eye className="w-3.5 h-3.5" /> View as subscriber</button>
                          {can.deleteChannel(role) && (<><div className="border-t border-brand-divider my-1" /><button onClick={() => setShowMoreMenu(false)} className="flex items-center gap-2 px-3 py-2 text-xs text-danger hover:bg-danger/10 w-full text-left"><Trash2 className="w-3.5 h-3.5" /> Delete channel</button></>)}
                        </div>
                      )}
                    </div>
                  </>
                ) : role === 'subscriber' ? (
                  <>
                    <button className="w-8 h-8 rounded-lg border border-brand-divider flex items-center justify-center text-brand-text/60 hover:bg-brand-secondary/50 transition-colors"><Bell className="w-4 h-4" /></button>
                    <button onClick={handleUnsubscribe} disabled={unsubscribeMut.isPending} className="flex items-center gap-1.5 border border-brand-divider text-brand-text text-xs font-semibold px-3 py-2 rounded-xl hover:bg-brand-secondary/50 transition-colors disabled:opacity-50">
                      {unsubscribeMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Subscribed <ChevronDown className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <button onClick={handleSubscribe} disabled={subscribeMut.isPending} className="flex items-center gap-1.5 bg-primary-ink text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-primary-hover transition-opacity disabled:opacity-50">
                    {subscribeMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Subscribe
                  </button>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-4 sm:gap-6 py-3 mt-2 border-t border-brand-divider/50 overflow-x-auto scrollbar-none">
              {[
                { val: formatCount(channel.subscriber_count), lbl: pluralize(channel.subscriber_count, 'Subscriber') },
                { val: formatCount(channel.update_count), lbl: pluralize(channel.update_count, 'Update') },
                ...(can.viewAnalytics(role) ? [{ val: '0', lbl: 'Total views' }] : []),
                { val: formatDate(channel.created_at), lbl: 'Created' },
              ].map((s, i) => (
                <div key={i} className="flex flex-col gap-0.5 shrink-0">
                  <span className="text-sm sm:text-[15px] font-extrabold text-brand-text font-mono">{s.val}</span>
                  <span className="text-[9px] text-brand-text/40 tracking-wider">{s.lbl}</span>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex overflow-x-auto scrollbar-none -mb-px">
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-3 text-[14px] transition-colors sm:px-4 ${
                    activeTab === tab.id
                      ? 'border-primary-ink font-semibold text-primary-ink'
                      : 'border-transparent font-medium text-brand-text/50 hover:text-brand-text'
                  }`}>
                  {tab.label}
                  {tab.badge !== undefined && <span className="ml-1.5 text-[9px] font-bold bg-brand-text/8 text-brand-text/50 px-1.5 py-0.5 rounded-full">{formatCount(tab.badge)}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ===== BODY ===== */}
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-5 p-4 sm:p-5">
          {/* Feed column */}
          <div className="flex-1 min-w-0 flex flex-col gap-4">

            {/* TAB: UPDATES */}
            {activeTab === 'updates' && (
              <>
                {/* Composer */}
                {can.publish(role) && !showComposer && (
                  <button onClick={() => setShowComposer(true)} className="w-full flex items-center gap-3 bg-brand-card border border-brand-divider rounded-2xl px-4 py-3 hover:bg-brand-secondary/30 transition-colors text-left">
                    <div className="w-9 h-9 rounded-lg bg-brand-secondary flex items-center justify-center"><Plus className="w-4 h-4 text-brand-text/40" /></div>
                    <span className="text-sm text-brand-text/40">Write an update...</span>
                  </button>
                )}

                {/* Feed */}
                {loadingUpdates ? (
                  <div className="space-y-4">
                    {[1,2,3].map(i => <div key={i} className="bg-brand-card rounded-2xl border border-brand-divider p-4 animate-pulse space-y-2"><div className="h-3 w-20 bg-brand-secondary rounded-sm" /><div className="h-4 w-48 bg-brand-secondary rounded-sm" /><div className="h-3 w-full bg-brand-secondary rounded-sm" /></div>)}
                  </div>
                ) : allUpdates.length > 0 ? (
                  <div className="space-y-4">
                    {pinnedUpdates.map(u => (
                      <UpdateCard key={u.id} update={u} channel={channel} channelId={channelId} isOwner={can.publish(role)}
                        onDelete={can.publish(role) ? handleDelete : undefined}
                        onPin={can.publish(role) ? handlePin : undefined}
                        onLike={handleLike} onUnlike={handleUnlike}
                        onStash={handleStash} onUnstash={handleUnstash}
                        onRepost={handleRepost} onUnrepost={handleUnrepost} onView={handleView}
                        /*
                          actions="all" turns on comment, repost and save.

                          Every handler above was already being passed and the
                          buttons were still not there: UpdateCard's `actions`
                          prop defaults to 'reaction', and fullActions gates
                          the comment toggle, the echo menu, the bookmark and
                          the comment section itself. So the page wired up four
                          behaviours that nothing could reach.
                        */
                        actions="all" />
                    ))}
                    {regularUpdates.map(u => (
                      <UpdateCard key={u.id} update={u} channel={channel} channelId={channelId} isOwner={can.publish(role)}
                        onDelete={can.publish(role) ? handleDelete : undefined}
                        onPin={can.publish(role) ? handlePin : undefined}
                        onLike={handleLike} onUnlike={handleUnlike}
                        onStash={handleStash} onUnstash={handleUnstash}
                        onRepost={handleRepost} onUnrepost={handleUnrepost} onView={handleView}
                        /*
                          actions="all" turns on comment, repost and save.

                          Every handler above was already being passed and the
                          buttons were still not there: UpdateCard's `actions`
                          prop defaults to 'reaction', and fullActions gates
                          the comment toggle, the echo menu, the bookmark and
                          the comment section itself. So the page wired up four
                          behaviours that nothing could reach.
                        */
                        actions="all" />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="w-14 h-14 rounded-2xl bg-brand-secondary mx-auto mb-3 flex items-center justify-center"><Radio className="w-7 h-7 text-brand-text/20" /></div>
                    <p className="text-sm font-semibold text-brand-text/60">No updates yet</p>
                    <p className="text-xs text-brand-text/40 mt-1">{can.publish(role) ? 'Publish your first update to your subscribers' : `${channel.name} hasn't posted yet`}</p>
                    {can.publish(role) && <button onClick={() => setShowComposer(true)} className="mt-4 bg-primary-ink text-white text-sm font-bold rounded-xl px-5 py-2 hover:bg-primary-hover transition-opacity">Publish Update</button>}
                  </div>
                )}
              </>
            )}

            {/* TAB: SUBSCRIBERS */}
            {activeTab === 'subscribers' && can.viewSubscribers(role) && (
              <SubscribersTab channel={channel} subscribers={subscribers} isLoading={loadingSubs} />
            )}

            {/* TAB: ANALYTICS */}
            {activeTab === 'analytics' && can.viewAnalytics(role) && (
              <AnalyticsTab channel={channel} updates={allUpdates} />
            )}

            {/* TAB: DRAFTS */}
            {activeTab === 'drafts' && can.viewDrafts(role) && (
              <DraftsTab channelId={channelId} />
            )}

            {/* TAB: ABOUT */}
            {activeTab === 'about' && (
              <AboutTab channel={channel} role={role} />
            )}

            {/* TAB: SETTINGS */}
            {activeTab === 'settings' && can.editChannel(role) && (
              <SettingsTab channel={channel} onUpdate={handleSettingsUpdate} role={role} />
            )}
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-60 shrink-0">
            <ChannelSidebar channel={channel} role={role} onTabChange={setActiveTab as (t: string) => void} onEdit={() => setShowEditModal(true)} />
          </div>
        </div>
      </div>

      {/* Edit modal */}
      <AnimatePresence>
        {showEditModal && can.editChannel(role) && <ChannelEditModal channel={channel} onClose={() => setShowEditModal(false)} />}
      </AnimatePresence>

      {/*
        The composer, over the page rather than in it.

        It used to render inline at the top of the Updates tab, and it is a
        full form — six update types, title, body, attachments, scheduling. On
        a channel with few updates that meant opening it replaced the channel:
        the feed was pushed below the fold and the page became a form. A
        channel should be its feed, with somewhere to post from; posting is a
        thing you do ON it, not the thing it is.
      */}
      <AnimatePresence>
        {showComposer && can.publish(role) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-9999 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-xs sm:p-6"
            onClick={(e) => { if (e.target === e.currentTarget) setShowComposer(false) }}
            role="dialog"
            aria-modal="true"
            aria-label="New update"
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="relative my-auto w-full max-w-2xl"
            >
              <button
                onClick={() => setShowComposer(false)}
                aria-label="Close"
                className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-brand-card/80 text-brand-text/50 backdrop-blur-xs transition-colors hover:bg-brand-secondary hover:text-brand-text"
              >
                <X className="h-4 w-4" />
              </button>
              <ChannelComposer channel={channel} onPublish={handlePublish} isPublishing={createUpdate.isPending} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error toast */}
      <AnimatePresence>
        {mutError && <ErrorToast msg={mutError} onDismiss={() => setMutError(null)} />}
      </AnimatePresence>
    </AppShell>
  )
}

export default function ChannelDetailPage() {
  return (
    <Suspense fallback={null}>
      <ChannelDetailContent />
    </Suspense>
  )
}
