'use client'

import React from 'react'
import { Users, Radio, Calendar, Globe, MessageSquare, Forward, Lock, ArrowRight } from 'lucide-react'
import type { BroadcastChannel } from '@/types/channels'

interface AboutTabProps {
  channel: BroadcastChannel
  role: 'owner' | 'editor' | 'subscriber' | 'visitor'
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

function formatCommentMode(mode: string): string {
  switch (mode) {
    case 'enabled':
      return 'Open to all'
    case 'moderated':
      return 'Moderated'
    case 'subscribers_only':
      return 'Subscribers only'
    case 'disabled':
      return 'Disabled'
    default:
      return mode
  }
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

export default function AboutTab({ channel, role }: AboutTabProps) {
  const isManager = role === 'owner' || role === 'editor'

  return (
    <div className="bg-brand-card border border-brand-divider rounded-2xl p-5 space-y-6">
      {/* Description */}
      {channel.description && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-brand-text/50 mb-2">
            Description
          </p>
          <p className="text-sm text-brand-text leading-relaxed whitespace-pre-wrap">
            {channel.description}
          </p>
        </div>
      )}

      {/* Details grid */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-brand-text/50 mb-3">
          Details
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-brand-bg rounded-xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-text/40 mb-1">
              Category
            </p>
            <p className="text-sm font-semibold text-brand-text capitalize">
              {channel.category || 'General'}
            </p>
          </div>
          <div className="bg-brand-bg rounded-xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-text/40 mb-1">
              Comment Policy
            </p>
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-brand-text/50" />
              <p className="text-sm font-semibold text-brand-text">
                {formatCommentMode(channel.comment_mode)}
              </p>
            </div>
          </div>
          <div className="bg-brand-bg rounded-xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-text/40 mb-1">
              Language
            </p>
            <div className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-brand-text/50" />
              <p className="text-sm font-semibold text-brand-text">
                {channel.language || 'English'}
              </p>
            </div>
          </div>
          <div className="bg-brand-bg rounded-xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-text/40 mb-1">
              Forward Allowed
            </p>
            <div className="flex items-center gap-1.5">
              <Forward className="w-3.5 h-3.5 text-brand-text/50" />
              <p className="text-sm font-semibold text-brand-text">
                {channel.forward_allowed ? 'Yes' : 'No'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-brand-text/50 mb-3">
          Stats
        </p>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-bg flex items-center justify-center">
              <Users className="w-4 h-4 text-brand-text/50" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-brand-text font-mono">
                {formatCount(channel.subscriber_count)}
              </p>
              <p className="text-[10px] text-brand-text/40 uppercase tracking-wider font-semibold">
                Subscribers
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-bg flex items-center justify-center">
              <Radio className="w-4 h-4 text-brand-text/50" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-brand-text font-mono">
                {formatCount(channel.update_count)}
              </p>
              <p className="text-[10px] text-brand-text/40 uppercase tracking-wider font-semibold">
                Updates
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-bg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-brand-text/50" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-brand-text font-mono">
                {formatDate(channel.created_at)}
              </p>
              <p className="text-[10px] text-brand-text/40 uppercase tracking-wider font-semibold">
                Created
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Paid channel card */}
      {channel.paid_access && (
        <div className="border border-brand-divider rounded-xl p-4 bg-brand-bg/50">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-4 h-4 text-brand-text" />
            <p className="text-sm font-bold text-brand-text">Paid Channel</p>
          </div>
          <p className="text-xs text-brand-text/60 mb-2">
            This channel requires a subscription to access all updates.
          </p>
          <p className="text-lg font-extrabold text-brand-text font-mono">
            {formatPrice(channel.subscription_price_cents)}
            <span className="text-xs font-normal text-brand-text/50 ml-1">/ month</span>
          </p>
        </div>
      )}

      {/* Edit link for owner/editor */}
      {isManager && (
        <div className="pt-2 border-t border-brand-divider">
          <button className="flex items-center gap-1.5 text-sm font-semibold text-brand-text hover:text-brand-text/70 transition-colors">
            Edit channel info
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
