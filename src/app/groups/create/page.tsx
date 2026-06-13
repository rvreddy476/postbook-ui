'use client'

import React, { useState } from 'react'
import AppShell from '@/components/AppShell'
import { useRouter } from 'next/navigation'
import { useCreateGroup, useCheckHandle } from '@/hooks/useGroups'
import {
  Globe, Lock, Shield, TriangleAlert, Loader2, ArrowLeft,
  MessageSquare, Users, Image as ImageIcon, Info, ScrollText, Smile, ImagePlus,
} from 'lucide-react'

type SpaceKind = 'public' | 'restricted' | 'private'

const COVER_GRADIENTS = [
  'from-amber-100 to-orange-50',
  'from-blue-100 to-cyan-50',
  'from-emerald-100 to-teal-50',
  'from-purple-100 to-pink-50',
  'from-rose-100 to-red-50',
  'from-indigo-100 to-blue-50',
]

function slugify(val: string): string {
  return val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)
}

/**
 * One-screen space creation (FB-style): name + privacy + visibility on
 * the left, a live preview of the space on the right. Cover photo,
 * icon, description, rules, posting permissions etc. are all editable
 * after creation via Edit Space / Space Settings — keeping this form
 * deliberately minimal.
 */
export default function CreateSpacePage() {
  const router = useRouter()
  const createGroup = useCreateGroup()

  const [name, setName] = useState('')
  const [kind, setKind] = useState<SpaceKind>('public')
  const [isMature, setIsMature] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handle = slugify(name)
  const { data: handleCheck } = useCheckHandle(handle)

  const canCreate = name.trim().length >= 3 && handle.length >= 3 && !createGroup.isPending

  // Reddit-style kinds map onto the backend model:
  //   Public     → public     / open        (anyone views + contributes)
  //   Restricted → restricted / request     (anyone views, approved users contribute)
  //   Private    → private    / invite_only (only approved users view + contribute)
  const privacyLevel = kind
  const joinMode = kind === 'public' ? 'open' : kind === 'restricted' ? 'request' : 'invite_only'

  const handleCreate = async () => {
    if (!canCreate) return
    setError(null)
    try {
      // If the slug is taken, suffix it instead of blocking the user.
      const finalHandle =
        handleCheck && handleCheck.available === false
          ? `${handle.slice(0, 44)}-${Math.random().toString(36).slice(2, 6)}`
          : handle
      const group = await createGroup.mutateAsync({
        name: name.trim(),
        description: '',
        handle: finalHandle,
        category: '',
        privacy_level: privacyLevel,
        join_mode: joinMode,
        who_can_post: 'all_members',
        who_can_invite: 'all_members',
        is_mature: isMature,
        idempotency_key: `create-${Date.now()}`,
      })
      // Land back on MySpace with the new space selected in the rail
      // and opened in the middle column.
      router.push(`/groups?space=${group.id}`)
    } catch {
      setError('Could not create the space. Try a different name.')
    }
  }

  const coverGrad = COVER_GRADIENTS[(name.charCodeAt(0) || 0) % COVER_GRADIENTS.length]
  const previewName = name.trim() || 'Your space name'
  const privacyLabel = kind === 'public' ? 'Public' : kind === 'restricted' ? 'Restricted' : 'Private'
  const PrivacyIcon = kind === 'public' ? Globe : kind === 'restricted' ? Shield : Lock

  return (
    <AppShell hideSidebar>
      <div className="flex w-full items-start">
        {/* ── Left: the form ─────────────────────────────────────────── */}
        <aside className="sticky top-0 flex h-[calc(100vh-5rem)] w-full max-w-[400px] flex-shrink-0 flex-col overflow-y-auto scrollbar-hide border-r border-brand-divider bg-brand-card p-6">
          <button
            onClick={() => router.push('/groups')}
            className="mb-4 flex w-fit items-center gap-1.5 text-sm font-semibold text-brand-text/50 transition-colors hover:text-brand-text"
          >
            <ArrowLeft className="h-4 w-4" />
            MySpace
          </button>

          <h1
            className="text-[26px] font-[800] tracking-tight text-brand-text"
            style={{ fontFamily: 'var(--font-outfit, Outfit, sans-serif)' }}
          >
            Create space
          </h1>
          <p className="mt-1 text-sm text-brand-text/50">
            Name it, pick who can see it — done. You can add a cover, description, and rules anytime after.
          </p>

          {error && (
            <div className="mt-4 rounded-xl border border-brand-divider bg-brand-text/5 px-4 py-3 text-sm font-semibold text-brand-text">
              {error}
            </div>
          )}

          {/* Name */}
          <div className="mt-6">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-brand-text/50" htmlFor="spaceName">
              Space name
            </label>
            <input
              id="spaceName"
              type="text"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Suryapet Friends"
              autoFocus
              className="w-full rounded-xl border border-brand-divider bg-brand-secondary px-4 py-3 text-sm font-medium text-brand-text outline-none transition-all placeholder:text-brand-text/30 focus:border-brand-text/30 focus:bg-brand-card focus:ring-2 focus:ring-brand-text/10"
            />
            {handle && (
              <p className="mt-1.5 px-1 text-[11px] text-brand-text/40">
                @{handle}
                {handleCheck && handleCheck.available === false && ' — taken, a suffix will be added'}
              </p>
            )}
          </div>

          {/* What kind of space is this? */}
          <div className="mt-5">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-brand-text/50">
              What kind of space is this?
            </label>
            <div className="space-y-2">
              {(
                [
                  { value: 'public' as const, icon: Globe, label: 'Public', desc: 'Anyone can view, post, and comment in this space.' },
                  { value: 'restricted' as const, icon: Shield, label: 'Restricted', desc: 'Anyone can view, but only approved members can contribute.' },
                  { value: 'private' as const, icon: Lock, label: 'Private', desc: 'Only approved members can view and contribute.' },
                ]
              ).map(({ value, icon: Icon, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setKind(value)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${
                    kind === value
                      ? 'border-brand-text bg-brand-text/5'
                      : 'border-brand-divider bg-brand-card hover:border-brand-text/30'
                  }`}
                >
                  <Icon className={`mt-0.5 h-[18px] w-[18px] flex-shrink-0 ${kind === value ? 'text-brand-text' : 'text-brand-text/40'}`} />
                  <span className="flex-1">
                    <span className="block text-sm font-bold text-brand-text">{label}</span>
                    <span className="block text-xs leading-snug text-brand-text/50">{desc}</span>
                  </span>
                  <span
                    className={`mt-1 h-4 w-4 flex-shrink-0 rounded-full border-2 ${
                      kind === value ? 'border-brand-text bg-brand-text' : 'border-brand-text/25'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Mature (18+) */}
          <button
            type="button"
            onClick={() => setIsMature(!isMature)}
            className="mt-5 flex w-full items-center gap-3 rounded-xl border border-brand-divider p-3.5 text-left transition-all hover:border-brand-text/30"
          >
            <TriangleAlert className="h-[18px] w-[18px] flex-shrink-0 text-brand-text/40" />
            <span className="flex-1">
              <span className="block text-sm font-bold text-brand-text">Mature (18+)</span>
              <span className="block text-xs leading-snug text-brand-text/50">Users must be over 18 to view and contribute.</span>
            </span>
            <span
              className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
                isMature ? 'bg-brand-text' : 'bg-brand-text/15'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-brand-bg shadow transition-all ${
                  isMature ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </span>
          </button>

          <div className="flex-1" />

          {/* Create */}
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-text py-3 text-sm font-bold text-brand-bg transition-all hover:opacity-90 disabled:opacity-40"
          >
            {createGroup.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {createGroup.isPending ? 'Creating...' : 'Create'}
          </button>
        </aside>

        {/* ── Right: live preview ────────────────────────────────────── */}
        <main className="hidden min-w-0 flex-1 px-6 py-6 md:block">
          <div className="mx-auto max-w-[860px] rounded-2xl border border-brand-divider bg-brand-bg p-5">
            <p className="mb-4 px-1 text-[13px] font-bold text-brand-text">Preview</p>
            <div className="overflow-hidden rounded-2xl border border-brand-divider bg-brand-card">
              {/* Cover */}
              <div className={`flex h-44 items-center justify-center bg-gradient-to-br ${coverGrad}`}>
                <span className="text-6xl font-black opacity-20">
                  {(name.trim().charAt(0) || 'S').toUpperCase()}
                </span>
              </div>

              {/* Identity */}
              <div className="px-6 pt-4">
                <h2
                  className={`truncate text-2xl font-[800] tracking-tight ${name.trim() ? 'text-brand-text' : 'text-brand-text/30'}`}
                  style={{ fontFamily: 'var(--font-outfit, Outfit, sans-serif)' }}
                >
                  {previewName}
                </h2>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-brand-text/50">
                  <PrivacyIcon className="h-3.5 w-3.5" />
                  {privacyLabel} space
                  <span className="text-brand-text/25">·</span>
                  1 member
                  {isMature && (
                    <span className="ml-1 rounded-md border border-brand-divider px-1.5 py-0.5 text-[10px] font-black text-brand-text/60">18+</span>
                  )}
                </p>
              </div>

              {/* Tabs mock */}
              <div className="mt-4 border-b border-brand-divider px-6">
                <div className="flex items-center gap-0">
                  {[
                    { label: 'About', icon: <Info className="h-3.5 w-3.5" /> },
                    { label: 'Discussion', icon: <MessageSquare className="h-3.5 w-3.5" />, active: true },
                    { label: 'People', icon: <Users className="h-3.5 w-3.5" /> },
                    { label: 'Media', icon: <ImageIcon className="h-3.5 w-3.5" /> },
                    { label: 'Rules', icon: <ScrollText className="h-3.5 w-3.5" /> },
                  ].map((t) => (
                    <span
                      key={t.label}
                      className={`relative flex items-center gap-1.5 px-3.5 py-3 text-[13px] font-semibold ${
                        t.active ? 'text-brand-text' : 'text-brand-text/40'
                      }`}
                    >
                      {t.icon}
                      {t.label}
                      {t.active && <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-brand-text" />}
                    </span>
                  ))}
                </div>
              </div>

              {/* Composer + about mock */}
              <div className="grid gap-4 p-6 lg:grid-cols-[1fr_240px]">
                <div className="rounded-xl border border-brand-divider bg-brand-secondary/50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-brand-text/10" />
                    <div className="flex-1 rounded-full bg-brand-text/5 px-4 py-2.5 text-sm text-brand-text/35">
                      Write something...
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-5 pl-12 text-[12px] font-semibold text-brand-text/40">
                    <span className="flex items-center gap-1.5"><ImagePlus className="h-3.5 w-3.5" /> Photo/video</span>
                    <span className="flex items-center gap-1.5"><Smile className="h-3.5 w-3.5" /> Feeling</span>
                  </div>
                </div>
                <div className="rounded-xl border border-brand-divider bg-brand-secondary/50 p-4">
                  <p className="text-sm font-bold text-brand-text">About</p>
                  <p className="mt-2 flex items-start gap-2 text-xs leading-snug text-brand-text/50">
                    <PrivacyIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    {kind === 'public'
                      ? 'Anyone can view, post, and comment in this space.'
                      : kind === 'restricted'
                        ? 'Anyone can view, but only approved members can contribute.'
                        : 'Only approved members can view and contribute.'}
                  </p>
                  {isMature && (
                    <p className="mt-2 flex items-start gap-2 text-xs leading-snug text-brand-text/50">
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                      Users must be over 18 to view and contribute.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </AppShell>
  )
}
