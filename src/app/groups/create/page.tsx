'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useCreateGroup, useCheckHandle } from '@/hooks/useGroups'
import { ArrowLeft, ArrowRight, Check, Globe, Lock, Shield, Users, UserPlus, ScrollText, Image, Loader2 } from 'lucide-react'

type Step = 1 | 2 | 3 | 4 | 5

const CATEGORIES = [
  'Community', 'Technology', 'Sports', 'Music', 'Art', 'Education',
  'Gaming', 'Business', 'Health', 'Travel', 'Food', 'Other'
]

export default function CreateGroupPage() {
  const router = useRouter()
  const createGroup = useCreateGroup()

  const [step, setStep] = useState<Step>(1)
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [privacyLevel, setPrivacyLevel] = useState<'public' | 'restricted' | 'private'>('public')
  const [joinMode, setJoinMode] = useState<'open' | 'request' | 'invite_only'>('open')
  const [whoCanPost, setWhoCanPost] = useState<'all_members' | 'admins_mods' | 'admins_only'>('all_members')
  const [whoCanInvite, setWhoCanInvite] = useState<'all_members' | 'admins_mods' | 'admins_only'>('all_members')
  const [rules, setRules] = useState<{ title: string; description: string }[]>([])
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null)

  const { data: handleCheck } = useCheckHandle(handle)

  // Auto-generate handle from name
  useEffect(() => {
    if (name && !handle) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      if (slug.length >= 3) setHandle(slug.slice(0, 50))
    }
  }, [name, handle])

  // Sync privacy_level → allowed join_modes
  useEffect(() => {
    const allowed: Record<string, string[]> = {
      public: ['open', 'request'],
      restricted: ['request', 'invite_only'],
      private: ['invite_only'],
    }
    if (!allowed[privacyLevel]?.includes(joinMode)) {
      setJoinMode(allowed[privacyLevel][0] as typeof joinMode)
    }
  }, [privacyLevel, joinMode])

  const canProceed = useCallback((): boolean => {
    switch (step) {
      case 1: return name.trim().length >= 3 && handle.length >= 3
      case 2: return true
      case 3: return true
      case 4: return true
      case 5: return true
      default: return false
    }
  }, [step, name, handle])

  const handleSubmit = async () => {
    try {
      const group = await createGroup.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        handle,
        category,
        privacy_level: privacyLevel,
        join_mode: joinMode,
        who_can_post: whoCanPost,
        who_can_invite: whoCanInvite,
        idempotency_key: `create-${Date.now()}`,
      })
      setCreatedGroupId(group.id)
    } catch {
      // Error handled by React Query
    }
  }

  const addRule = () => {
    setRules([...rules, { title: '', description: '' }])
  }

  const updateRule = (index: number, field: 'title' | 'description', value: string) => {
    const updated = [...rules]
    updated[index] = { ...updated[index], [field]: value }
    setRules(updated)
  }

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index))
  }

  // Post-create success
  if (createdGroupId) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-16 pb-12 text-center">
        <div className="w-16 h-16 rounded-full orchid-gradient flex items-center justify-center mx-auto mb-6">
          <Check className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-black text-slate-800 mb-2">Group Created!</h1>
        <p className="text-sm text-slate-500 mb-8">Your group is ready. Start inviting members and sharing content.</p>
        <button
          onClick={() => router.push(`/groups/${createdGroupId}`)}
          className="px-8 py-3 orchid-gradient text-white font-bold rounded-xl hover:opacity-90 transition-opacity"
        >
          Go to Group
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-8 pb-12">
      <button onClick={() => step === 1 ? router.back() : setStep((step - 1) as Step)} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6 text-sm font-medium">
        <ArrowLeft className="w-4 h-4" />
        {step === 1 ? 'Back' : 'Previous'}
      </button>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? 'bg-[#D8103F]' : 'bg-slate-200'}`} />
        ))}
      </div>

      {/* Step 1: Identity */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-black text-slate-800 mb-1">Name & Identity</h1>
            <p className="text-sm text-slate-500">Choose a name and handle for your group</p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Group Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter group name..." className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D8103F]/30" maxLength={100} required />
            <p className="text-xs text-slate-400 mt-1">3-100 characters</p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Handle</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">@</span>
              <input type="text" value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="group-handle" className="w-full pl-8 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D8103F]/30" maxLength={50} />
              {handle.length >= 3 && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2">
                  {handleCheck?.available ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <span className="text-xs text-rose-500 font-bold">Taken</span>
                  )}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">3-50 characters, lowercase letters, digits, hyphens</p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this group about?" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D8103F]/30 resize-none" rows={3} maxLength={500} />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button key={cat} type="button" onClick={() => setCategory(category === cat ? '' : cat)} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${category === cat ? 'bg-[#D8103F] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Privacy */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-black text-slate-800 mb-1">Privacy & Access</h1>
            <p className="text-sm text-slate-500">Control who can see and join your group</p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Privacy Level</label>
            <div className="space-y-3">
              {([
                { value: 'public' as const, icon: Globe, label: 'Public', desc: 'Anyone can find and see group content' },
                { value: 'restricted' as const, icon: Shield, label: 'Restricted', desc: 'Anyone can find, but content is members-only' },
                { value: 'private' as const, icon: Lock, label: 'Private', desc: 'Hidden from search, invite-only' },
              ]).map(({ value, icon: Icon, label, desc }) => (
                <button key={value} type="button" onClick={() => setPrivacyLevel(value)} className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${privacyLevel === value ? 'border-[#D8103F]/50 bg-[#D8103F]/5' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <Icon className={`w-5 h-5 ${privacyLevel === value ? 'text-[#D8103F]' : 'text-slate-400'}`} />
                  <div>
                    <p className="text-sm font-bold text-slate-700">{label}</p>
                    <p className="text-xs text-slate-400">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Join Mode</label>
            <div className="space-y-3">
              {([
                { value: 'open' as const, label: 'Open', desc: 'Anyone can join immediately', enabled: privacyLevel === 'public' },
                { value: 'request' as const, label: 'Request to Join', desc: 'Members must be approved by admins', enabled: privacyLevel === 'public' || privacyLevel === 'restricted' },
                { value: 'invite_only' as const, label: 'Invite Only', desc: 'Only invited users can join', enabled: privacyLevel === 'restricted' || privacyLevel === 'private' },
              ]).map(({ value, label, desc, enabled }) => (
                <button key={value} type="button" onClick={() => enabled && setJoinMode(value)} disabled={!enabled} className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${!enabled ? 'opacity-40 cursor-not-allowed' : ''} ${joinMode === value && enabled ? 'border-[#D8103F]/50 bg-[#D8103F]/5' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <div>
                    <p className="text-sm font-bold text-slate-700">{label}</p>
                    <p className="text-xs text-slate-400">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Who Can Post</label>
              <select value={whoCanPost} onChange={(e) => setWhoCanPost(e.target.value as typeof whoCanPost)} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D8103F]/30">
                <option value="all_members">All Members</option>
                <option value="admins_mods">Admins & Mods</option>
                <option value="admins_only">Admins Only</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Who Can Invite</label>
              <select value={whoCanInvite} onChange={(e) => setWhoCanInvite(e.target.value as typeof whoCanInvite)} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D8103F]/30">
                <option value="all_members">All Members</option>
                <option value="admins_mods">Admins & Mods</option>
                <option value="admins_only">Admins Only</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Appearance */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-black text-slate-800 mb-1">Appearance</h1>
            <p className="text-sm text-slate-500">Customize your group's look (you can do this later too)</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 p-6 text-center">
            <div className="w-20 h-20 rounded-2xl bg-slate-100 mx-auto flex items-center justify-center mb-4">
              <Image className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-sm text-slate-500 mb-2">Avatar & cover photos can be uploaded after creation</p>
            <p className="text-xs text-slate-400">Go to group settings to upload images</p>
          </div>
        </div>
      )}

      {/* Step 4: Invite */}
      {step === 4 && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-black text-slate-800 mb-1">Invite Members</h1>
            <p className="text-sm text-slate-500">You can invite people after the group is created</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 mx-auto flex items-center justify-center mb-4">
              <UserPlus className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-sm text-slate-500 mb-2">Invite members after your group is created</p>
            <p className="text-xs text-slate-400">Use the invite button in the group header</p>
          </div>
        </div>
      )}

      {/* Step 5: Rules & Review */}
      {step === 5 && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-black text-slate-800 mb-1">Rules & Review</h1>
            <p className="text-sm text-slate-500">Set group rules and review your settings</p>
          </div>

          {/* Rules */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Group Rules</label>
              <button type="button" onClick={addRule} className="text-xs font-bold text-[#D8103F] hover:underline">+ Add Rule</button>
            </div>
            {rules.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No rules yet. You can add them later.</p>
            ) : (
              <div className="space-y-3">
                {rules.map((rule, i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-100 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-400">Rule {i + 1}</span>
                      <button type="button" onClick={() => removeRule(i)} className="text-xs text-rose-500 hover:underline">Remove</button>
                    </div>
                    <input type="text" value={rule.title} onChange={(e) => updateRule(i, 'title', e.target.value)} placeholder="Rule title..." className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-[#D8103F]/30" />
                    <input type="text" value={rule.description} onChange={(e) => updateRule(i, 'description', e.target.value)} placeholder="Description (optional)..." className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#D8103F]/30" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Review</h3>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-slate-400">Name</span><span className="font-bold text-slate-700">{name}</span>
              <span className="text-slate-400">Handle</span><span className="font-bold text-slate-700">@{handle}</span>
              {category && <><span className="text-slate-400">Category</span><span className="font-bold text-slate-700">{category}</span></>}
              <span className="text-slate-400">Privacy</span><span className="font-bold text-slate-700 capitalize">{privacyLevel}</span>
              <span className="text-slate-400">Join Mode</span><span className="font-bold text-slate-700 capitalize">{joinMode.replace('_', ' ')}</span>
              <span className="text-slate-400">Who Can Post</span><span className="font-bold text-slate-700 capitalize">{whoCanPost.replace(/_/g, ' ')}</span>
              <span className="text-slate-400">Who Can Invite</span><span className="font-bold text-slate-700 capitalize">{whoCanInvite.replace(/_/g, ' ')}</span>
              <span className="text-slate-400">Rules</span><span className="font-bold text-slate-700">{rules.length || 'None'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-8">
        {step < 5 ? (
          <button
            onClick={() => setStep((step + 1) as Step)}
            disabled={!canProceed()}
            className="w-full py-3 orchid-gradient text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || createGroup.isPending}
            className="w-full py-3 orchid-gradient text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {createGroup.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : <><Check className="w-4 h-4" /> Create Group</>}
          </button>
        )}
      </div>
    </div>
  )
}
