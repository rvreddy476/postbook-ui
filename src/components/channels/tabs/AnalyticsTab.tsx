'use client'

import React from 'react'
import { TrendingUp, TrendingDown, Users, Eye, Sparkles, BarChart3, Download, ArrowUpRight } from 'lucide-react'
import type { BroadcastChannel, ChannelUpdate } from '@/types/channels'

interface AnalyticsTabProps {
  channel: BroadcastChannel
  updates?: ChannelUpdate[]
}

function StatCard({ label, value, change, trend }: { label: string; value: string; change?: string; trend?: 'up' | 'down' | 'neutral' }) {
  return (
    <div className="bg-white border border-brand-divider rounded-xl p-4">
      <p className="text-[10px] font-bold text-brand-text/40 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-extrabold text-brand-text font-mono mt-1">{value}</p>
      {change && (
        <div className={`flex items-center gap-1 mt-1.5 text-[11px] font-semibold ${
          trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-500' : 'text-brand-text/40'
        }`}>
          {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : trend === 'down' ? <TrendingDown className="w-3 h-3" /> : null}
          {change}
        </div>
      )}
    </div>
  )
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export default function AnalyticsTab({ channel, updates = [] }: AnalyticsTabProps) {
  const totalViews = updates.reduce((sum, u) => sum + u.view_count, 0)
  const totalReactions = updates.reduce((sum, u) => sum + u.reaction_count, 0)
  const avgViewRate = channel.subscriber_count > 0 ? Math.round((totalViews / Math.max(channel.subscriber_count, 1)) * 100) : 0

  // Top update
  const topUpdate = updates.length > 0
    ? updates.reduce((best, u) => (u.view_count + u.reaction_count > best.view_count + best.reaction_count) ? u : best, updates[0])
    : null

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-brand-text">Channel Analytics</h3>
        <div className="flex items-center gap-1">
          {['30d', '90d', '365d'].map(p => (
            <button key={p} className="px-3 py-1 rounded-lg text-[10px] font-semibold text-brand-text/50 hover:bg-brand-secondary/50 border border-brand-divider">
              {p === '30d' ? '30 days' : p === '90d' ? '90 days' : '1 year'}
            </button>
          ))}
          <button className="flex items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-semibold text-brand-text/50 hover:bg-brand-secondary/50 border border-brand-divider ml-2">
            <Download className="w-3 h-3" /> Export CSV
          </button>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Subscribers" value={formatCount(channel.subscriber_count)} change="+0 last 30d" trend="neutral" />
        <StatCard label="Total Views" value={formatCount(totalViews)} change="Last 30 days" trend="neutral" />
        <StatCard label="Total Reactions" value={formatCount(totalReactions)} change="Last 30 days" trend="neutral" />
        <StatCard label="Avg View Rate" value={`${avgViewRate}%`} change="Views / subscribers" trend="neutral" />
      </div>

      {/* Top update */}
      {topUpdate && (
        <div className="bg-white border border-brand-divider rounded-xl p-4">
          <p className="text-[10px] font-bold text-brand-text/40 uppercase tracking-wider mb-2">Top performing update</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-brand-text truncate">{topUpdate.title || topUpdate.body.slice(0, 60)}</p>
              <p className="text-[11px] text-brand-text/40 mt-0.5">{new Date(topUpdate.created_at).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-brand-text/50 shrink-0">
              <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {formatCount(topUpdate.view_count)}</span>
              <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> {formatCount(topUpdate.reaction_count)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Chart placeholders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-brand-divider rounded-xl p-4">
          <p className="text-[10px] font-bold text-brand-text/40 uppercase tracking-wider mb-3">Subscriber Growth</p>
          <div className="h-40 flex items-center justify-center bg-brand-bg rounded-lg">
            <div className="text-center">
              <TrendingUp className="w-8 h-8 text-brand-text/15 mx-auto mb-2" />
              <p className="text-[11px] text-brand-text/30">Chart will appear with more data</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-brand-divider rounded-xl p-4">
          <p className="text-[10px] font-bold text-brand-text/40 uppercase tracking-wider mb-3">Views Over Time</p>
          <div className="h-40 flex items-center justify-center bg-brand-bg rounded-lg">
            <div className="text-center">
              <BarChart3 className="w-8 h-8 text-brand-text/15 mx-auto mb-2" />
              <p className="text-[11px] text-brand-text/30">Chart will appear with more data</p>
            </div>
          </div>
        </div>
      </div>

      {/* Update performance table */}
      {updates.length > 0 && (
        <div className="bg-white border border-brand-divider rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-divider">
            <p className="text-[10px] font-bold text-brand-text/40 uppercase tracking-wider">Update Performance</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-brand-divider text-brand-text/40">
                  <th className="text-left px-4 py-2 font-semibold">Update</th>
                  <th className="text-right px-4 py-2 font-semibold">Views</th>
                  <th className="text-right px-4 py-2 font-semibold">Sparks</th>
                  <th className="text-right px-4 py-2 font-semibold">Comments</th>
                  <th className="text-right px-4 py-2 font-semibold">View Rate</th>
                </tr>
              </thead>
              <tbody>
                {updates.slice(0, 10).map(u => (
                  <tr key={u.id} className="border-b border-brand-divider/50 hover:bg-brand-bg/50">
                    <td className="px-4 py-2.5 text-brand-text font-medium truncate max-w-[200px]">
                      {u.title || u.body.slice(0, 50)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-brand-text/60">{formatCount(u.view_count)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-brand-text/60">{formatCount(u.reaction_count)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-brand-text/60">{formatCount(u.comment_count)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-brand-text/60">
                      {channel.subscriber_count > 0 ? `${Math.round((u.view_count / channel.subscriber_count) * 100)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {updates.length === 0 && (
        <div className="bg-white border border-brand-divider rounded-xl p-8 text-center">
          <BarChart3 className="w-10 h-10 text-brand-text/15 mx-auto mb-3" />
          <p className="text-sm font-semibold text-brand-text/50">No analytics data yet</p>
          <p className="text-xs text-brand-text/35 mt-1">Publish updates to start seeing analytics</p>
        </div>
      )}
    </div>
  )
}
