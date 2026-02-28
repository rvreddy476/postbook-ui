'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useAuthUser } from '@/store/auth'
import { useJoinGroup, useLeaveGroup } from '@/hooks/useGroups'
import { Globe, Lock, Users, Settings, LogOut, UserPlus, MessageCircle, ArrowLeft, Pencil } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Group, GroupMember } from '@/types/groups'

interface GroupHeaderProps {
  group: Group
  membership: GroupMember | null
  onOpenInvite: () => void
  onEditProfile?: () => void
  onBack?: () => void
}

export default function GroupHeader({ group, membership, onOpenInvite, onEditProfile, onBack }: GroupHeaderProps) {
  const router = useRouter()
  const authUser = useAuthUser()
  const joinGroup = useJoinGroup()
  const leaveGroup = useLeaveGroup()

  const isAdmin = membership?.role === 'admin'
  const isMember = !!membership

  const avatarSrc = group.avatar_media_id
    ? `/v1/media/${group.avatar_media_id}/serve`
    : null

  const handleJoin = () => {
    joinGroup.mutate(group.id)
  }

  const handleLeave = () => {
    if (confirm('Are you sure you want to leave this group?')) {
      leaveGroup.mutate(group.id)
    }
  }

  return (
    <section className="relative w-full">
      {/* Back Button */}
      <button
        onClick={() => onBack ? onBack() : router.back()}
        className="mb-4 p-2 bg-slate-100 rounded-full text-slate-600 hover:bg-slate-200 transition-all"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 relative z-10">
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4">
          {/* Avatar */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-28 h-28 rounded-[2rem] bg-white p-1.5 shadow-xl overflow-hidden"
          >
            <div className="w-full h-full rounded-[1.5rem] overflow-hidden bg-slate-100">
              {avatarSrc ? (
                <img src={avatarSrc} alt={group.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full orchid-gradient flex items-center justify-center text-white font-black text-3xl">
                  {group.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </motion.div>

          {/* Info + Actions */}
          <div className="flex-1 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4 pb-2 w-full">
            <div className="text-center sm:text-left">
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">{group.name}</h1>
              <div className="flex items-center gap-3 mt-1 justify-center sm:justify-start">
                <div className="flex items-center gap-1 text-slate-400">
                  {group.visibility === 'public' ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  <span className="text-xs font-bold capitalize">{group.visibility}</span>
                </div>
                <div className="flex items-center gap-1 text-slate-400">
                  <Users className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold">{group.member_count} members</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {isMember ? (
                <>
                  {group.chat_conversation_id && (
                    <button
                      onClick={() => router.push(`/chat?conversation=${group.chat_conversation_id}`)}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-xl hover:border-violet-300 hover:text-violet-600 transition-all"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Chat
                    </button>
                  )}
                  <button
                    onClick={onOpenInvite}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-xl hover:border-violet-300 hover:text-violet-600 transition-all"
                  >
                    <UserPlus className="w-4 h-4" />
                    Invite
                  </button>
                  {isAdmin && (
                    <>
                      {onEditProfile && (
                        <button
                          onClick={onEditProfile}
                          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-xl hover:border-violet-300 hover:text-violet-600 transition-all"
                        >
                          <Pencil className="w-4 h-4" />
                          Edit
                        </button>
                      )}
                      <button
                        onClick={() => router.push(`/groups/${group.id}/settings`)}
                        className="p-2 bg-white border border-slate-200 text-slate-500 rounded-xl hover:border-violet-300 hover:text-violet-600 transition-all"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={handleLeave}
                    className="p-2 bg-white border border-slate-200 text-slate-400 rounded-xl hover:border-rose-300 hover:text-rose-500 transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              ) : group.visibility === 'public' ? (
                <button
                  onClick={handleJoin}
                  disabled={joinGroup.isPending}
                  className="flex items-center gap-2 px-6 py-2 orchid-gradient text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {joinGroup.isPending ? 'Joining...' : 'Join Group'}
                </button>
              ) : (
                <span className="text-xs text-slate-400 font-bold">Invite only</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
