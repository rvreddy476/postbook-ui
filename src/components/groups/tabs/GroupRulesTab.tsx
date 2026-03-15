'use client'

import React, { useState, useEffect } from 'react'
import { useGroupRules, useUpdateGroupRules } from '@/hooks/useGroups'
import { ScrollText, Plus, Trash2, Save, GripVertical, Pencil, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface GroupRulesTabProps {
  groupId: string
  isAdmin: boolean
}

export default function GroupRulesTab({ groupId, isAdmin }: GroupRulesTabProps) {
  const { data: rules, isLoading } = useGroupRules(groupId)
  const updateRules = useUpdateGroupRules()

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<{ title: string; description: string }[]>([])

  useEffect(() => {
    if (rules) {
      setDraft(rules.map((r) => ({ title: r.title, description: r.description })))
    }
  }, [rules])

  const handleSave = async () => {
    const filtered = draft.filter((r) => r.title.trim())
    await updateRules.mutateAsync({ groupId, rules: filtered })
    setEditing(false)
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-white rounded-xl border border-slate-100 animate-pulse" />
        ))}
      </div>
    )
  }

  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700">Edit Group Rules</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(false)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-all"
            >
              <X className="w-3 h-3" /> Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={updateRules.isPending}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-[#D8103F] rounded-lg hover:bg-[#C00E38] transition-all disabled:opacity-50"
            >
              <Save className="w-3 h-3" /> {updateRules.isPending ? 'Saving...' : 'Save Rules'}
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400">Maximum 10 rules. Drag to reorder (coming soon).</p>

        <AnimatePresence>
          {draft.map((rule, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-white rounded-xl border border-slate-100 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-slate-200" />
                  <span className="w-6 h-6 rounded-full bg-[#D8103F]/10 flex items-center justify-center text-[10px] font-bold text-[#D8103F]">
                    {i + 1}
                  </span>
                </div>
                <button
                  onClick={() => setDraft(draft.filter((_, idx) => idx !== i))}
                  className="p-1 text-slate-300 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                type="text"
                value={rule.title}
                onChange={(e) => { const d = [...draft]; d[i] = { ...d[i], title: e.target.value }; setDraft(d) }}
                placeholder="Rule title..."
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-lg text-sm font-medium text-slate-700 mb-2 focus:outline-none focus:ring-2 focus:ring-[#D8103F]/20 focus:border-[#D8103F]/30 placeholder:text-slate-300"
              />
              <textarea
                value={rule.description}
                onChange={(e) => { const d = [...draft]; d[i] = { ...d[i], description: e.target.value }; setDraft(d) }}
                placeholder="Add a description (optional)..."
                rows={2}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#D8103F]/20 focus:border-[#D8103F]/30 placeholder:text-slate-300"
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {draft.length < 10 && (
          <button
            onClick={() => setDraft([...draft, { title: '', description: '' }])}
            className="flex items-center gap-2 w-full justify-center py-3.5 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:border-[#D8103F]/30 hover:text-[#D8103F] transition-all text-sm font-bold"
          >
            <Plus className="w-4 h-4" /> Add Rule
          </button>
        )}

        {draft.length >= 10 && (
          <p className="text-center text-xs text-slate-400 font-medium">Maximum of 10 rules reached</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700">Group Rules</h3>
        {isAdmin && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#D8103F] bg-[#D8103F]/5 rounded-lg hover:bg-[#D8103F]/10 transition-all"
          >
            <Pencil className="w-3 h-3" /> Edit Rules
          </button>
        )}
      </div>

      {!rules || rules.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 mx-auto mb-4 flex items-center justify-center">
            <ScrollText className="w-8 h-8 text-slate-200" />
          </div>
          <p className="text-sm font-semibold text-slate-400">No rules set</p>
          <p className="text-xs text-slate-300 mt-1">
            {isAdmin ? 'Add rules to set expectations for your group members.' : 'This group hasn\'t set any rules yet.'}
          </p>
          {isAdmin && (
            <button
              onClick={() => setEditing(true)}
              className="mt-4 px-4 py-2 text-xs font-bold text-[#D8103F] bg-[#D8103F]/5 rounded-lg hover:bg-[#D8103F]/10 transition-all"
            >
              Add Rules
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule, i) => (
            <motion.div
              key={rule.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-xl border border-slate-100 p-4 hover:border-slate-200 transition-all"
            >
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#D8103F]/10 flex items-center justify-center text-xs font-bold text-[#D8103F]">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700">{rule.title}</p>
                  {rule.description && (
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{rule.description}</p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
