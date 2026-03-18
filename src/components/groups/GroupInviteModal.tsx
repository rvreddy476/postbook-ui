'use client'

import React, { useState, useEffect } from 'react'
import { useInviteToGroup, useGroupMembers } from '@/hooks/useGroups'
import { fetchUsers } from '@/services/userService'
import { getSession } from '@/services/authService'
import { X, Search, UserPlus, Loader2, Check } from 'lucide-react'
import { motion } from 'framer-motion'
import type { User } from '@/types'

interface GroupInviteModalProps {
  groupId: string
  onClose: () => void
}

export default function GroupInviteModal({ groupId, onClose }: GroupInviteModalProps) {
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  const inviteToGroup = useInviteToGroup()
  const { data: members } = useGroupMembers(groupId)

  const me = getSession()
  const memberIds = new Set(members?.map(m => m.user_id) ?? [])

  useEffect(() => {
    const load = async () => {
      setLoadingUsers(true)
      try {
        const fetched = await fetchUsers(50, 0)
        setUsers(fetched)
      } catch (err) {
        console.error('Failed to load users:', err)
      } finally {
        setLoadingUsers(false)
      }
    }
    load()
  }, [])

  const filteredUsers = users.filter(u => {
    if (u.id === me?.id) return false
    if (memberIds.has(u.id)) return false
    if (!search.trim()) return true
    return u.name.toLowerCase().includes(search.toLowerCase())
  })

  const handleInvite = async (userId: string) => {
    try {
      await inviteToGroup.mutateAsync({ groupId, userId })
      setInvitedIds(prev => new Set(prev).add(userId))
    } catch {
      // Error handled by React Query
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-md mx-4 bg-brand-card rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-divider flex-shrink-0">
          <h2 className="text-lg font-black text-brand-text">Add Members</h2>
          <button onClick={onClose} className="p-1 text-brand-text/60 hover:text-brand-highlight transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 pt-4 pb-2 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text/60" />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-brand-secondary border border-brand-divider rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-text/30 focus:border-brand-text/50"
            />
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {loadingUsers ? (
            <div className="space-y-3 py-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-3 px-2 py-2">
                  <div className="w-10 h-10 rounded-full bg-brand-secondary animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="w-28 h-3 rounded bg-brand-secondary animate-pulse" />
                    <div className="w-16 h-2 rounded bg-brand-secondary animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-brand-text/60 font-medium">
                {search.trim() ? 'No users found' : 'All users are already members'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredUsers.map(user => {
                const isInvited = invitedIds.has(user.id)
                return (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-brand-secondary transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-brand-divider flex-shrink-0">
                      <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-brand-text truncate">{user.name}</p>
                      <p className="text-xs text-brand-text/60">{user.isOnline ? 'Online' : 'Offline'}</p>
                    </div>
                    <button
                      onClick={() => handleInvite(user.id)}
                      disabled={isInvited || inviteToGroup.isPending}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        isInvited
                          ? 'bg-emerald-50 text-emerald-600 cursor-default'
                          : 'bg-brand-text/5 text-brand-text hover:bg-brand-text/10'
                      }`}
                    >
                      {isInvited ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Invited
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          Invite
                        </>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-brand-divider flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 text-sm font-bold text-brand-highlight bg-brand-secondary rounded-xl hover:bg-brand-secondary transition-all"
          >
            Done
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
