'use client'

import React, { useState } from 'react'
import {
  FileText, Pencil, ArrowUpRight, Trash2,
  Megaphone, Image as ImageIcon, Video, Headphones, BarChart3,
  Calendar, ShoppingBag, AlertTriangle, BookOpen,
} from 'lucide-react'

/* ===== Types ===== */
export interface DraftUpdate {
  id: string
  title?: string
  body: string
  update_type: 'announcement' | 'image' | 'video' | 'audio' | 'poll' | 'event' | 'commerce' | 'alert' | 'digest'
  status: 'draft' | 'scheduled'
  scheduled_at?: string
  created_at: string
  updated_at: string
}

interface DraftsTabProps {
  channelId: string
  drafts?: DraftUpdate[]
  isLoading?: boolean
  onEdit?: (draftId: string) => void
  onDelete?: (draftId: string) => void
  onPublish?: (draftId: string) => void
}

/* ===== Helpers ===== */
const typeLabels: Record<string, { label: string; emoji: string }> = {
  announcement: { label: 'Announcement', emoji: '📢' },
  image:        { label: 'Photo',        emoji: '📸' },
  video:        { label: 'Video',        emoji: '🎬' },
  audio:        { label: 'Audio',        emoji: '🎧' },
  poll:         { label: 'Poll',         emoji: '📊' },
  event:        { label: 'Event',        emoji: '📅' },
  commerce:     { label: 'Commerce',     emoji: '🛍' },
  alert:        { label: 'Urgent',       emoji: '⚠️' },
  digest:       { label: 'Digest',       emoji: '📖' },
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function formatScheduledDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function truncateText(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

/* ===== Skeleton Loader ===== */
function DraftCardSkeleton() {
  return (
    <div className="bg-brand-card border border-brand-divider rounded-2xl p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-5 w-24 bg-brand-secondary rounded-full" />
        <div className="ml-auto h-4 w-16 bg-brand-secondary rounded" />
      </div>
      <div className="h-4 w-3/4 bg-brand-secondary rounded mb-2" />
      <div className="h-3 w-1/3 bg-brand-secondary rounded" />
    </div>
  )
}

/* ===== Delete Confirmation Dialog ===== */
function DeleteConfirmDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl border border-brand-divider shadow-xl p-6 w-full max-w-sm mx-4">
        <h4 className="text-sm font-bold text-brand-text mb-1">Delete draft?</h4>
        <p className="text-xs text-brand-text/50 mb-5">
          This action cannot be undone. The draft will be permanently removed.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-brand-text/60 border border-brand-divider hover:bg-brand-secondary/50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

/* ===== Draft Card ===== */
function DraftCard({
  draft,
  onEdit,
  onDelete,
  onPublish,
}: {
  draft: DraftUpdate
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  onPublish?: (id: string) => void
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const typeInfo = typeLabels[draft.update_type] || typeLabels.announcement
  const displayText = draft.title || truncateText(draft.body, 60)
  const isScheduled = draft.status === 'scheduled' && draft.scheduled_at && new Date(draft.scheduled_at) > new Date()

  return (
    <>
      <div className="group bg-brand-card border border-brand-divider rounded-2xl p-4 transition-all hover:shadow-sm">
        {/* Top row: type badge + status badge */}
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-secondary text-brand-text/60 text-[10px] font-semibold rounded-full capitalize">
            {typeInfo.emoji} {typeInfo.label}
          </span>
          {isScheduled ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-semibold rounded-full border border-amber-200">
              <Calendar className="w-2.5 h-2.5" />
              Scheduled for {formatScheduledDate(draft.scheduled_at!)}
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 bg-brand-text/5 text-brand-text/40 text-[10px] font-semibold rounded-full">
              Draft
            </span>
          )}
        </div>

        {/* Title / body preview */}
        <p className="text-sm font-semibold text-brand-text leading-snug mb-1.5">
          {displayText}
        </p>

        {/* Last edited */}
        <p className="text-[11px] text-brand-text/40 font-medium">
          Last edited {relativeTime(draft.updated_at)}
        </p>

        {/* Action buttons — visible on hover */}
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-brand-divider opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button
              onClick={() => onEdit(draft.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-brand-text/60 hover:text-brand-text hover:bg-brand-secondary/50 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
          {onPublish && (
            <button
              onClick={() => onPublish(draft.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-brand-text/60 hover:text-brand-text hover:bg-brand-secondary/50 transition-colors"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Publish Now
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmingDelete && (
        <DeleteConfirmDialog
          onConfirm={() => {
            setConfirmingDelete(false)
            onDelete?.(draft.id)
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </>
  )
}

/* ===== Section ===== */
function DraftSection({
  title,
  drafts,
  onEdit,
  onDelete,
  onPublish,
}: {
  title: string
  drafts: DraftUpdate[]
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  onPublish?: (id: string) => void
}) {
  if (drafts.length === 0) return null

  return (
    <div>
      <p className="text-[10px] font-bold text-brand-text/40 uppercase tracking-wider mb-3">
        {title} ({drafts.length})
      </p>
      <div className="space-y-3">
        {drafts.map((draft) => (
          <DraftCard
            key={draft.id}
            draft={draft}
            onEdit={onEdit}
            onDelete={onDelete}
            onPublish={onPublish}
          />
        ))}
      </div>
    </div>
  )
}

/* ===== Main Component ===== */
export default function DraftsTab({
  channelId,
  drafts = [],
  isLoading = false,
  onEdit,
  onDelete,
  onPublish,
}: DraftsTabProps) {
  // Split into scheduled (future scheduled_at) and plain drafts
  const now = new Date()
  const scheduled = drafts.filter(
    (d) => d.status === 'scheduled' && d.scheduled_at && new Date(d.scheduled_at) > now
  )
  const plain = drafts.filter(
    (d) => !(d.status === 'scheduled' && d.scheduled_at && new Date(d.scheduled_at) > now)
  )

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-brand-text">Drafts &amp; Scheduled</h3>
        <div className="space-y-3">
          <DraftCardSkeleton />
          <DraftCardSkeleton />
          <DraftCardSkeleton />
        </div>
      </div>
    )
  }

  // Empty state
  if (drafts.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-brand-text">Drafts &amp; Scheduled</h3>
        <div className="bg-brand-card border border-brand-divider rounded-2xl p-8 text-center">
          <FileText className="w-10 h-10 text-brand-text/15 mx-auto mb-3" />
          <p className="text-sm font-semibold text-brand-text/50">No drafts</p>
          <p className="text-xs text-brand-text/35 mt-1">
            Scheduled and saved drafts will appear here
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-bold text-brand-text">Drafts &amp; Scheduled</h3>

      <DraftSection
        title="Scheduled"
        drafts={scheduled}
        onEdit={onEdit}
        onDelete={onDelete}
        onPublish={onPublish}
      />

      <DraftSection
        title="Drafts"
        drafts={plain}
        onEdit={onEdit}
        onDelete={onDelete}
        onPublish={onPublish}
      />
    </div>
  )
}
