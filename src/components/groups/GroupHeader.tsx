'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useJoinGroup, useLeaveGroup, useDeleteGroup } from '@/hooks/useGroups'
import {
  Globe, Lock, Shield, Users, Settings, LogOut, UserPlus,
  MessageCircle, ArrowLeft, Pencil, Clock, Plus, FileText,
  Calendar, MoreHorizontal, Share2, Flag, Link2, Crown, ShieldCheck, Wrench, Trash2
} from 'lucide-react'
import { motion } from 'framer-motion'
import type { Group } from '@/types/groups'

interface GroupHeaderProps {
  group: Group
  viewerRole: string
  onOpenInvite: () => void
  onEditProfile?: () => void
  onBack?: () => void
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

const categoryGradients: Record<string, string> = {
  gaming: 'from-violet-600 to-indigo-600',
  technology: 'from-cyan-600 to-blue-600',
  music: 'from-pink-600 to-rose-600',
  sports: 'from-green-600 to-emerald-600',
  art: 'from-amber-500 to-orange-600',
  food: 'from-yellow-500 to-orange-500',
  travel: 'from-teal-500 to-cyan-600',
  education: 'from-blue-600 to-violet-600',
}

export default function GroupHeader({ group, viewerRole, onOpenInvite, onEditProfile, onBack }: GroupHeaderProps) {
  const router = useRouter()
  const joinGroup = useJoinGroup()
  const leaveGroup = useLeaveGroup()
  const deleteGroup = useDeleteGroup()

  const isOwner = viewerRole === 'owner'
  const isAdmin = viewerRole === 'admin' || isOwner
  const isMod = viewerRole === 'moderator'
  const isMember = isAdmin || isMod || viewerRole === 'member'

  const coverSrc = group.cover_media_id
    ? `/v1/media/${group.cover_media_id}/serve`
    : null

  const avatarSrc = group.avatar_media_id
    ? `/v1/media/${group.avatar_media_id}/serve`
    : null

  const gradient = categoryGradients[group.category?.toLowerCase() ?? ''] || 'from-slate-600 to-slate-800'

  const handleJoin = async () => {
    await joinGroup.mutateAsync(group.id)
  }

  const handleLeave = () => {
    if (confirm('Are you sure you want to leave this group?')) {
      leaveGroup.mutate(group.id)
    }
  }

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
      deleteGroup.mutate(group.id, {
        onSuccess: () => router.push('/groups'),
      })
    }
  }

  const privacyConfig = {
    public: { icon: <Globe className="w-3.5 h-3.5" />, label: 'Public', color: 'text-emerald-600 bg-emerald-50' },
    restricted: { icon: <Shield className="w-3.5 h-3.5" />, label: 'Restricted', color: 'text-amber-600 bg-amber-50' },
    private: { icon: <Lock className="w-3.5 h-3.5" />, label: 'Private', color: 'text-rose-600 bg-rose-50' },
  }
  const privacy = privacyConfig[group.privacy_level ?? 'public'] ?? privacyConfig.public

  const roleBadge = () => {
    if (isOwner) return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 rounded-full"><Crown className="w-3 h-3" />Owner</span>
    if (viewerRole === 'admin') return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-violet-100 text-violet-700 rounded-full"><ShieldCheck className="w-3 h-3" />Admin</span>
    if (isMod) return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 rounded-full"><Wrench className="w-3 h-3" />Mod</span>
    return null
  }

  return (
    <section className="relative w-full">
      {/* Back Button - overlaid on cover */}
      <button
        onClick={() => onBack ? onBack() : router.back()}
        className="absolute top-4 left-4 z-20 p-2 bg-black/30 backdrop-blur-sm rounded-full text-white hover:bg-black/50 transition-all"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Cover Photo */}
      <div className="relative w-full aspect-[3/1] sm:aspect-[3.5/1] overflow-hidden rounded-b-3xl sm:rounded-2xl">
        {coverSrc ? (
          <img src={coverSrc} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} opacity-80`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>

      {/* Avatar + Identity */}
      <div className="relative max-w-4xl mx-auto px-4 -mt-16 sm:-mt-20 z-10">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Avatar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white p-1 shadow-xl ring-4 ring-white shrink-0"
          >
            <div className="w-full h-full rounded-xl overflow-hidden bg-slate-100">
              {avatarSrc ? (
                <img src={avatarSrc} alt={group.name} className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-black text-3xl`}>
                  {group.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </motion.div>

          {/* Identity Block */}
          <div className="flex-1 min-w-0 pt-1 sm:pt-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate">{group.name}</h1>
                  {roleBadge()}
                </div>

                {group.handle && (
                  <p className="text-sm text-slate-400 font-medium mt-0.5">@{group.handle}</p>
                )}

                {group.description && (
                  <p className="text-sm text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">{group.description}</p>
                )}

                {/* Badges + Stats */}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${privacy.color}`}>
                    {privacy.icon} {privacy.label}
                  </span>

                  {group.category && (
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[11px] font-semibold rounded-full">
                      {group.category}
                    </span>
                  )}

                  <span className="text-slate-300">|</span>

                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      <b className="text-slate-600">{formatCount(group.member_count)}</b> members
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      <b className="text-slate-600">{formatCount(group.post_count)}</b> posts
                    </span>
                    <span className="hidden sm:flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Created {formatDate(group.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              {isMember ? (
                <>
                  {/* Primary CTA */}
                  <button
                    onClick={() => {}}
                    className="flex items-center gap-1.5 px-5 py-2 bg-[#D8103F] text-white text-sm font-bold rounded-xl hover:bg-[#C00E38] transition-colors shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    New Post
                  </button>

                  <button
                    onClick={onOpenInvite}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:border-slate-300 transition-all"
                  >
                    <UserPlus className="w-4 h-4" />
                    Invite
                  </button>

                  {group.chat_conversation_id && (
                    <button
                      onClick={() => router.push(`/chat?conversation=${group.chat_conversation_id}`)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:border-slate-300 transition-all"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Chat
                    </button>
                  )}

                  {isAdmin && onEditProfile && (
                    <button
                      onClick={onEditProfile}
                      className="p-2 bg-white border border-slate-200 text-slate-500 rounded-xl hover:border-slate-300 transition-all"
                      title="Edit Group"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}

                  {isAdmin && (
                    <button
                      onClick={() => router.push(`/groups/${group.id}/settings`)}
                      className="p-2 bg-white border border-slate-200 text-slate-500 rounded-xl hover:border-slate-300 transition-all"
                      title="Group Settings"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  )}

                  {/* Overflow menu */}
                  <div className="relative group/overflow ml-auto">
                    <button className="p-2 bg-white border border-slate-200 text-slate-400 rounded-xl hover:border-slate-300 transition-all">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1 hidden group-hover/overflow:block z-30">
                      <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                        <Share2 className="w-4 h-4" /> Share
                      </button>
                      <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                        <Link2 className="w-4 h-4" /> Copy Link
                      </button>
                      <hr className="my-1 border-slate-100" />
                      <button
                        onClick={handleLeave}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-500 hover:bg-rose-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" /> Leave Group
                      </button>
                      <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:bg-slate-50 transition-colors">
                        <Flag className="w-4 h-4" /> Report
                      </button>
                      {isOwner && (
                        <>
                          <hr className="my-1 border-slate-100" />
                          <button
                            onClick={handleDelete}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors font-semibold"
                          >
                            <Trash2 className="w-4 h-4" /> Delete Group
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </>
              ) : group.join_mode === 'request' ? (
                <button
                  onClick={handleJoin}
                  disabled={joinGroup.isPending}
                  className="flex items-center gap-2 px-6 py-2.5 border-2 border-[#D8103F] text-[#D8103F] text-sm font-bold rounded-xl hover:bg-[#D8103F]/5 transition-all disabled:opacity-50"
                >
                  <Clock className="w-4 h-4" />
                  {joinGroup.isPending ? 'Requesting...' : 'Request to Join'}
                </button>
              ) : group.join_mode === 'invite_only' || group.privacy_level === 'private' ? (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 text-slate-400 text-sm font-semibold rounded-xl">
                  <Lock className="w-4 h-4" />
                  Invite Only
                </div>
              ) : (
                <button
                  onClick={handleJoin}
                  disabled={joinGroup.isPending}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#D8103F] text-white text-sm font-bold rounded-xl hover:bg-[#C00E38] shadow-sm transition-all disabled:opacity-50"
                >
                  <Users className="w-4 h-4" />
                  {joinGroup.isPending ? 'Joining...' : 'Join Group'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
