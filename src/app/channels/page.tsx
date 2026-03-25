'use client'

import React, { useState, useMemo } from 'react'
import AppShell from '@/components/AppShell'
import {
  useMyBroadcastChannels,
  useDiscoverChannels,
  useMyBroadcasts,
  useSubscribeChannel,
  useUnsubscribeChannel,
} from '@/hooks/useBroadcastChannels'
import ChannelCard from '@/components/channels/ChannelCard'
import { Radio, Compass, Plus, Search, Megaphone, Users, BarChart3 } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import type { BroadcastChannel } from '@/types/channels'

type Tab = 'my-channels' | 'discover' | 'my-broadcasts'

const categories = [
  'All', 'Creator', 'Brand', 'News', 'Education', 'Official', 'Technology', 'Entertainment',
]

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d`
  return `${Math.floor(days / 30)}mo`
}

const avatarColors = [
  'from-stone-700 to-stone-900',
  'from-zinc-600 to-zinc-800',
  'from-neutral-600 to-neutral-800',
  'from-stone-600 to-stone-800',
]

function pickColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

/* ---------- Skeleton ---------- */
function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="bg-white border border-brand-divider rounded-2xl px-4 py-3 animate-pulse">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-brand-secondary" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-brand-secondary rounded" />
              <div className="h-3 w-48 bg-brand-secondary rounded" />
              <div className="h-3 w-24 bg-brand-secondary rounded" />
            </div>
            <div className="h-7 w-20 bg-brand-secondary rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---------- Empty ---------- */
function EmptyState({ tab }: { tab: Tab }) {
  const configs = {
    'my-channels': {
      icon: <Radio className="w-8 h-8 text-brand-text/20" />,
      title: "You haven't subscribed to any channels yet",
      sub: 'Create one or explore what\'s out there',
    },
    discover: {
      icon: <Compass className="w-8 h-8 text-brand-text/20" />,
      title: 'No channels to discover',
      sub: 'Check back later for new channels',
    },
    'my-broadcasts': {
      icon: <Megaphone className="w-8 h-8 text-brand-text/20" />,
      title: "You don't own any channels yet",
      sub: 'Create your first broadcast channel',
    },
  }
  const cfg = configs[tab]
  return (
    <div className="text-center py-20">
      <div className="w-16 h-16 rounded-2xl bg-brand-secondary mx-auto mb-4 flex items-center justify-center">
        {cfg.icon}
      </div>
      <p className="text-sm font-semibold text-brand-text/60">{cfg.title}</p>
      <p className="text-xs text-brand-text/40 mt-1">{cfg.sub}</p>
    </div>
  )
}

/* ---------- Featured Card (Discover) ---------- */
function FeaturedCard({ channel, onSubscribe }: { channel: BroadcastChannel; onSubscribe: (id: string) => void }) {
  const avatarSrc = channel.avatar_media_id
    ? `/v1/media/${channel.avatar_media_id}/serve`
    : null
  const gradient = pickColor(channel.name)
  return (
    <Link href={`/channels/${channel.id}`} className="flex-shrink-0 w-[160px]">
      <div className="bg-white border border-brand-divider rounded-2xl p-3 hover:bg-brand-secondary/30 transition-all h-full flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-xl overflow-hidden mb-2">
          {avatarSrc ? (
            <img src={avatarSrc} alt={channel.name} className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-black text-xl`}>
              {channel.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <h4 className="text-xs font-bold text-brand-text truncate w-full">{channel.name}</h4>
        <p className="font-mono text-[10px] text-brand-text/40 mt-0.5">{formatCount(channel.subscriber_count)} subscribers</p>
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onSubscribe(channel.id)
          }}
          className="mt-2 bg-brand-text text-brand-bg text-[10px] font-semibold rounded-lg px-3 py-1 hover:opacity-90 transition-opacity"
        >
          + Subscribe
        </button>
      </div>
    </Link>
  )
}

/* ---------- Broadcast Card (My Broadcasts) ---------- */
function BroadcastCard({ channel }: { channel: BroadcastChannel }) {
  const avatarSrc = channel.avatar_media_id
    ? `/v1/media/${channel.avatar_media_id}/serve`
    : null
  const gradient = pickColor(channel.name)
  return (
    <div className="bg-white border border-brand-divider rounded-2xl px-4 py-3">
      <div className="flex items-center gap-3.5">
        <Link href={`/channels/${channel.id}`} className="flex-shrink-0">
          <div className="w-12 h-12 rounded-xl overflow-hidden">
            {avatarSrc ? (
              <img src={avatarSrc} alt={channel.name} className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-black text-lg`}>
                {channel.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </Link>

        <Link href={`/channels/${channel.id}`} className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-brand-text truncate">{channel.name}</h3>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-brand-text/40">
              <Users className="w-3 h-3" />
              <span className="font-mono text-[11px]">{formatCount(channel.subscriber_count)}</span>
            </span>
            <span className="flex items-center gap-1 text-brand-text/40">
              <BarChart3 className="w-3 h-3" />
              <span className="font-mono text-[11px]">{formatCount(channel.update_count)} updates</span>
            </span>
          </div>
          <p className="text-[11px] text-brand-text/40 mt-0.5">Last update {timeAgo(channel.updated_at)}</p>
        </Link>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href={`/channels/${channel.id}`}
            className="bg-brand-text text-brand-bg text-[11px] font-semibold rounded-lg px-3 py-1.5 hover:opacity-90 transition-opacity"
          >
            New Update
          </Link>
        </div>
      </div>
    </div>
  )
}

/* ========== MAIN PAGE ========== */
export default function ChannelsPage() {
  const [tab, setTab] = useState<Tab>('my-channels')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')

  const { data: myChannels, isLoading: loadingMy } = useMyBroadcastChannels()
  const { data: discoverChannels, isLoading: loadingDiscover } = useDiscoverChannels()
  const { data: myBroadcasts, isLoading: loadingBroadcasts } = useMyBroadcasts()
  const subscribeMutation = useSubscribeChannel()
  const unsubscribeMutation = useUnsubscribeChannel()

  // Featured channels for discover (first 6 unsubscribed)
  const featured = useMemo(() => {
    if (!discoverChannels) return []
    return discoverChannels
      .filter(c => c.viewer_role !== 'subscriber' && c.viewer_role !== 'admin' && c.viewer_role !== 'editor')
      .slice(0, 6)
  }, [discoverChannels])

  const featuredIds = useMemo(() => new Set(featured.map(c => c.id)), [featured])

  // Filter discover channels by category + search, excluding featured
  const filteredDiscover = useMemo(() => {
    if (!discoverChannels) return []
    let filtered = discoverChannels
    // Exclude featured channels from the vertical list when showing featured section
    if (!searchQuery.trim() && activeCategory === 'All' && featured.length > 0) {
      filtered = filtered.filter(c => !featuredIds.has(c.id))
    }
    if (activeCategory !== 'All') {
      filtered = filtered.filter(
        c => c.category?.toLowerCase() === activeCategory.toLowerCase() ||
             c.channel_type?.toLowerCase() === activeCategory.toLowerCase()
      )
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        c => c.name.toLowerCase().includes(q) || c.handle.toLowerCase().includes(q)
      )
    }
    return filtered
  }, [discoverChannels, activeCategory, searchQuery, featured, featuredIds])

  // Filter my channels by search
  const filteredMy = useMemo(() => {
    if (!myChannels) return []
    if (!searchQuery.trim()) return myChannels
    const q = searchQuery.toLowerCase()
    return myChannels.filter(
      c => c.name.toLowerCase().includes(q) || c.handle.toLowerCase().includes(q)
    )
  }, [myChannels, searchQuery])

  return (
    <AppShell>
    <div className="max-w-3xl mx-auto px-4 pt-8 pb-16">
      {/* Title + Create button */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-black text-2xl text-brand-text tracking-tight">Channels</h1>
          <p className="text-sm text-brand-text/60 mt-0.5">Subscribe to broadcast channels for updates</p>
        </div>
        <Link
          href="/channels/create"
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-text text-brand-bg text-sm font-bold rounded-xl hover:opacity-90 transition-opacity shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Channel
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-brand-divider mb-5">
        {([
          { key: 'my-channels' as Tab, label: 'My Channels', icon: <Radio className="w-4 h-4" /> },
          { key: 'discover' as Tab, label: 'Discover', icon: <Compass className="w-4 h-4" /> },
          { key: 'my-broadcasts' as Tab, label: 'My Broadcasts', icon: <Megaphone className="w-4 h-4" /> },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative flex items-center gap-1.5 px-4 py-3 text-sm font-semibold transition-colors ${
              tab === t.key
                ? 'border-b-2 border-brand-text text-brand-text'
                : 'text-brand-text/50 hover:text-brand-text'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Category chips (Discover only) */}
      {tab === 'discover' && (
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeCategory === cat
                  ? 'bg-brand-text text-brand-bg'
                  : 'border border-brand-divider text-brand-text hover:bg-brand-secondary/50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Search bar */}
      {(tab === 'my-channels' || tab === 'discover') && (
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search channels..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-brand-divider rounded-xl text-sm text-brand-text placeholder:text-brand-text/30 focus:outline-none focus:ring-2 focus:ring-brand-text/10 transition-all"
          />
        </div>
      )}

      {/* === MY CHANNELS === */}
      {tab === 'my-channels' && (
        loadingMy ? <ListSkeleton /> :
        filteredMy.length > 0 ? (
          <div className="space-y-3">
            {filteredMy.map((channel, i) => (
              <motion.div
                key={channel.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <ChannelCard
                  channel={channel}
                  onSubscribe={(id) => subscribeMutation.mutate(id)}
                  onUnsubscribe={(id) => unsubscribeMutation.mutate(id)}
                />
              </motion.div>
            ))}
          </div>
        ) : <EmptyState tab="my-channels" />
      )}

      {/* === DISCOVER === */}
      {tab === 'discover' && (
        loadingDiscover ? <ListSkeleton /> : (
          <div className="space-y-6">
            {/* Featured horizontal scroll */}
            {featured.length > 0 && !searchQuery.trim() && activeCategory === 'All' && (
              <div>
                <h2 className="text-xs font-bold text-brand-text/50 uppercase tracking-wider mb-3">Featured</h2>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                  {featured.map((channel) => (
                    <FeaturedCard
                      key={channel.id}
                      channel={channel}
                      onSubscribe={(id) => subscribeMutation.mutate(id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Vertical list */}
            {filteredDiscover.length > 0 ? (
              <div className="space-y-3">
                {filteredDiscover.map((channel, i) => (
                  <motion.div
                    key={channel.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <ChannelCard
                      channel={channel}
                      onSubscribe={(id) => subscribeMutation.mutate(id)}
                      onUnsubscribe={(id) => unsubscribeMutation.mutate(id)}
                    />
                  </motion.div>
                ))}
              </div>
            ) : (
              <EmptyState tab="discover" />
            )}
          </div>
        )
      )}

      {/* === MY BROADCASTS === */}
      {tab === 'my-broadcasts' && (
        loadingBroadcasts ? <ListSkeleton /> :
        myBroadcasts && myBroadcasts.length > 0 ? (
          <div className="space-y-3">
            {/* Create new channel card */}
            <Link href="/channels/create">
              <div className="bg-white border border-dashed border-brand-divider rounded-2xl px-4 py-4 flex items-center gap-3 hover:bg-brand-secondary/30 transition-colors cursor-pointer">
                <div className="w-12 h-12 rounded-xl bg-brand-secondary flex items-center justify-center">
                  <Plus className="w-5 h-5 text-brand-text/40" />
                </div>
                <div>
                  <p className="text-sm font-bold text-brand-text">Create New Channel</p>
                  <p className="text-xs text-brand-text/40">Start broadcasting to your audience</p>
                </div>
              </div>
            </Link>

            {myBroadcasts.map((channel, i) => (
              <motion.div
                key={channel.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <BroadcastCard channel={channel} />
              </motion.div>
            ))}
          </div>
        ) : (
          <EmptyState tab="my-broadcasts" />
        )
      )}
    </div>
    </AppShell>
  )
}
