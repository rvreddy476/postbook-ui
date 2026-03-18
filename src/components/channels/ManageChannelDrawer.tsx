'use client'

import { useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  UserCheck,
  AlertTriangle,
  CalendarClock,
  PenSquare,
  BarChart3,
  UserCog,
  Settings,
  Shield,
  UserX,
} from 'lucide-react'
import type { BroadcastChannel } from '@/types/channels'

interface ManageChannelDrawerProps {
  channel: BroadcastChannel
  isOpen: boolean
  onClose: () => void
  onNavigate: (tab: string) => void
  onNewUpdate: () => void
}

interface PendingAction {
  label: string
  count: number
  color: 'amber' | 'red' | 'blue'
  onClick: () => void
}

const badgeColorMap = {
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
} as const

export default function ManageChannelDrawer({
  channel,
  isOpen,
  onClose,
  onNavigate,
  onNewUpdate,
}: ManageChannelDrawerProps) {
  // Pending action counts (wired to real data when available)
  const pendingApprovals = 0
  const reportedComments = 0
  const scheduledUpdates = 0

  const pendingActions: PendingAction[] = [
    {
      label: 'Subscriber approvals pending',
      count: pendingApprovals,
      color: 'amber',
      onClick: () => onNavigate('subscribers'),
    },
    {
      label: 'Reported comments',
      count: reportedComments,
      color: 'red',
      onClick: () => {},
    },
    {
      label: 'Scheduled updates',
      count: scheduledUpdates,
      color: 'blue',
      onClick: () => onNavigate('drafts'),
    },
  ]

  const hasPendingActions = pendingActions.some((a) => a.count > 0)

  const shortcuts = [
    { icon: PenSquare, label: 'New Update', onClick: onNewUpdate },
    { icon: BarChart3, label: 'View Analytics', onClick: () => onNavigate('analytics') },
    { icon: UserCog, label: 'Edit Channel Profile', onClick: () => onNavigate('settings') },
    { icon: Settings, label: 'Channel Settings', onClick: () => onNavigate('settings') },
  ]

  const stats = [
    { label: 'Subscribers', value: channel.subscriber_count },
    { label: 'Views today', value: 0 },
    { label: 'New subs today', value: 0 },
    { label: 'Updates this week', value: 0 },
  ]

  const handleBackdropClick = useCallback(() => {
    onClose()
  }, [onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleBackdropClick}
          />

          {/* Drawer */}
          <motion.aside
            className="fixed right-0 top-0 z-50 h-full w-80 lg:w-96 bg-white shadow-xl overflow-y-auto"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-brand-divider">
              <h2 className="text-base font-bold text-brand-text">Manage Channel</h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-brand-bg text-brand-text/60 hover:text-brand-text transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* 1. Pending Actions */}
            <section className="py-4 px-5 border-b border-brand-divider">
              <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-brand-text/40 mb-3">
                Pending Actions
              </h3>
              {hasPendingActions ? (
                <div className="space-y-2">
                  {pendingActions
                    .filter((a) => a.count > 0)
                    .map((action) => (
                      <button
                        key={action.label}
                        onClick={action.onClick}
                        className="flex items-center justify-between w-full rounded-xl px-3 py-2.5 hover:bg-brand-bg transition-colors"
                      >
                        <span className="text-sm text-brand-text">{action.label}</span>
                        <span
                          className={`inline-flex items-center justify-center min-w-[20px] h-5 rounded-full px-1.5 text-[10px] font-bold text-white ${badgeColorMap[action.color]}`}
                        >
                          {action.count}
                        </span>
                      </button>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-brand-text/40">No pending actions</p>
              )}
            </section>

            {/* 2. Quick Stats */}
            <section className="py-4 px-5 border-b border-brand-divider">
              <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-brand-text/40 mb-3">
                Quick Stats
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl bg-brand-bg px-3 py-3 text-center"
                  >
                    <p className="text-xl font-extrabold font-mono text-brand-text">
                      {stat.value.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-brand-text/50 mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 3. Quick Shortcuts */}
            <section className="py-4 px-5 border-b border-brand-divider">
              <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-brand-text/40 mb-3">
                Quick Shortcuts
              </h3>
              <div className="space-y-0.5">
                {shortcuts.map((shortcut) => (
                  <button
                    key={shortcut.label}
                    onClick={shortcut.onClick}
                    className="flex items-center gap-3 w-full rounded-xl px-3 py-2.5 hover:bg-brand-bg transition-colors"
                  >
                    <shortcut.icon size={16} className="text-brand-text/60" />
                    <span className="text-sm text-brand-text">{shortcut.label}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* 4. Moderation Queue */}
            <section className="py-4 px-5 border-b border-brand-divider">
              <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-brand-text/40 mb-3">
                Moderation Queue
              </h3>
              <div className="flex flex-col items-center justify-center py-6 text-brand-text/30">
                <Shield size={28} strokeWidth={1.5} />
                <p className="text-sm mt-2">No items to review</p>
              </div>
            </section>

            {/* 5. Banned Users */}
            <section className="py-4 px-5">
              <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-brand-text/40 mb-3">
                Banned Users
              </h3>
              <div className="flex flex-col items-center justify-center py-6 text-brand-text/30">
                <UserX size={28} strokeWidth={1.5} />
                <p className="text-sm mt-2">No banned users</p>
              </div>
            </section>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
