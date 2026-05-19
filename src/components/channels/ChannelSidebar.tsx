'use client'

import React from 'react'
import {
  Users,
  Eye,
  Sparkles,
  BarChart3,
  Pencil,
  Share2,
  ArrowRight,
  BadgeCheck,
  Radio,
  Calendar,
} from 'lucide-react'
import type { BroadcastChannel } from '@/types/channels'

interface ChannelSidebarProps {
  channel: BroadcastChannel
  role: 'owner' | 'editor' | 'subscriber' | 'visitor'
  onTabChange: (tab: string) => void
  onEdit: () => void
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function AnalyticsCard({ channel }: { channel: BroadcastChannel }) {
  const stats = [
    { label: 'Subscribers', value: formatCount(channel.subscriber_count) },
    { label: 'Total views', value: '0' },
    { label: 'Reactions', value: '0' },
    { label: 'Avg view rate', value: '0%' },
  ]

  return (
    <div className="bg-white border border-brand-divider rounded-2xl p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-brand-text/50 mb-3">
        Channel Analytics
      </p>
      <div className="grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="bg-brand-bg rounded-xl p-3">
            <p className="text-base font-extrabold text-brand-text font-mono">{s.value}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-text/40 mt-0.5">
              {s.label}
            </p>
          </div>
        ))}
      </div>
      <button className="flex items-center gap-1 mt-3 text-xs font-semibold text-brand-text hover:text-brand-text/70 transition-colors">
        View full analytics
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function QuickSettingsCard({
  channel,
  onEdit,
}: {
  channel: BroadcastChannel
  onEdit: () => void
}) {
  const rows = [
    { icon: Pencil, label: 'Edit channel info', onClick: onEdit, badge: null },
    {
      icon: Users,
      label: 'Manage subscribers',
      onClick: undefined,
      badge: formatCount(channel.subscriber_count),
    },
    { icon: Share2, label: 'Share channel', onClick: undefined, badge: null },
  ]

  return (
    <div className="bg-white border border-brand-divider rounded-2xl p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-brand-text/50 mb-3">
        Quick Settings
      </p>
      <div className="space-y-0.5">
        {rows.map((row) => (
          <button
            key={row.label}
            onClick={row.onClick}
            className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-left hover:bg-brand-bg transition-colors"
          >
            <row.icon className="w-4 h-4 text-brand-text/50 shrink-0" />
            <span className="text-sm font-medium text-brand-text flex-1">{row.label}</span>
            {row.badge && (
              <span className="text-[10px] font-bold text-brand-text/40 bg-brand-bg rounded-full px-2 py-0.5">
                {row.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

function VerificationCard({ channel }: { channel: BroadcastChannel }) {
  const threshold = 1_000
  const progress = Math.min((channel.subscriber_count / threshold) * 100, 100)

  if (channel.is_verified) {
    return (
      <div className="bg-white border border-brand-divider rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
            <BadgeCheck className="w-4.5 h-4.5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-brand-text">Verified channel</p>
            <p className="text-[11px] text-brand-text/40">Verified by VChat</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-brand-divider rounded-2xl p-4">
      <p className="text-sm font-bold text-brand-text mb-1">Apply for verified badge</p>
      <p className="text-[11px] text-brand-text/50 mb-3">
        Reach 1,000 subscribers to become eligible for verification.
      </p>
      <div className="w-full h-2 bg-brand-bg rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-text rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs font-mono text-brand-text/50 mt-1.5">
        {formatCount(channel.subscriber_count)}/1,000
      </p>
    </div>
  )
}

function VisitorAboutCard({ channel }: { channel: BroadcastChannel }) {
  return (
    <div className="bg-white border border-brand-divider rounded-2xl p-4 space-y-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-brand-text/50">About</p>

      {channel.description && (
        <p className="text-sm text-brand-text leading-relaxed">{channel.description}</p>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2.5 text-sm text-brand-text/60">
          <Radio className="w-4 h-4 shrink-0" />
          <span>
            <span className="capitalize">{channel.category || 'General'}</span>
            {' \u00B7 '}
            <span className="capitalize">{channel.channel_type}</span> channel
          </span>
        </div>
        <div className="flex items-center gap-2.5 text-sm text-brand-text/60">
          <Calendar className="w-4 h-4 shrink-0" />
          <span>Created {formatDate(channel.created_at)}</span>
        </div>
        <div className="flex items-center gap-2.5 text-sm text-brand-text/60">
          <Users className="w-4 h-4 shrink-0" />
          <span>
            <span className="font-semibold text-brand-text font-mono">
              {formatCount(channel.subscriber_count)}
            </span>{' '}
            subscribers
          </span>
        </div>
      </div>
    </div>
  )
}

export default function ChannelSidebar({
  channel,
  role,
  onTabChange,
  onEdit,
}: ChannelSidebarProps) {
  const isManager = role === 'owner' || role === 'editor'

  if (!isManager) {
    return <VisitorAboutCard channel={channel} />
  }

  return (
    <div className="space-y-4">
      <AnalyticsCard channel={channel} />
      <QuickSettingsCard channel={channel} onEdit={onEdit} />
      {role === 'owner' && <VerificationCard channel={channel} />}
    </div>
  )
}
