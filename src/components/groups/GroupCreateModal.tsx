'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCreateGroup } from '@/hooks/useGroups'
import { X, Globe, Lock, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'

interface GroupCreateModalProps {
  onClose: () => void
}

export default function GroupCreateModal({ onClose }: GroupCreateModalProps) {
  const router = useRouter()
  const createGroup = useCreateGroup()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    try {
      const group = await createGroup.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        visibility,
      })
      onClose()
      router.push(`/groups/${group.id}`)
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
        className="w-full max-w-md mx-4 bg-white rounded-2xl shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-black text-slate-800">Create Group</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Group Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter group name..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
              maxLength={100}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this group about?"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
              rows={3}
              maxLength={500}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Visibility</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  visibility === 'public' ? 'border-violet-400 bg-violet-50' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <Globe className={`w-4 h-4 ${visibility === 'public' ? 'text-violet-500' : 'text-slate-400'}`} />
                <span className="text-sm font-bold text-slate-700">Public</span>
              </button>
              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  visibility === 'private' ? 'border-violet-400 bg-violet-50' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <Lock className={`w-4 h-4 ${visibility === 'private' ? 'text-violet-500' : 'text-slate-400'}`} />
                <span className="text-sm font-bold text-slate-700">Private</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={!name.trim() || createGroup.isPending}
            className="w-full flex items-center justify-center gap-2 py-3 orchid-gradient text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {createGroup.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {createGroup.isPending ? 'Creating...' : 'Create Group'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  )
}
