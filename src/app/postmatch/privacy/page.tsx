'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { checkPostMatchAuth, postmatchLoginRedirect } from '@/lib/postmatchGuard'
import { usePostMatchPrivacy, useUpdatePostMatchPrivacy, type PostMatchPrivacy } from '@/hooks/usePostmatch'

type Toggle = {
  key: keyof PostMatchPrivacy
  label: string
  description: string
}

const TOGGLES: Toggle[] = [
  {
    key: 'incognito',
    label: 'Incognito mode',
    description: 'You browse normally, but only people you have already liked can see you.',
  },
  {
    key: 'hide_last_active',
    label: 'Hide last active',
    description: 'Your last active time stays hidden from everyone except moderators.',
  },
  {
    key: 'approximate_location',
    label: 'Approximate location',
    description: 'Show "5–10 km" style buckets instead of exact distance.',
  },
  {
    key: 'verified_only_filter',
    label: 'Verified profiles only',
    description: 'Hide people who are only phone-verified — keep selfie + Aadhaar verified candidates.',
  },
  {
    key: 'blur_photos_until_match',
    label: 'Blur photos until match',
    description: 'Your photos appear blurred to everyone until you both like each other.',
  },
]

export default function PostMatchPrivacyPage() {
  const router = useRouter()
  const { data, isLoading, error } = usePostMatchPrivacy()
  const update = useUpdatePostMatchPrivacy()
  const [pending, setPending] = useState<keyof PostMatchPrivacy | null>(null)

  useEffect(() => {
    const state = checkPostMatchAuth()
    if (state === 'unauthenticated') router.replace(postmatchLoginRedirect('/postmatch/privacy'))
    else if (state === 'needs_onboarding') router.replace('/postmatch/onboarding')
  }, [router])

  const toggle = async (key: keyof PostMatchPrivacy) => {
    if (!data || pending) return
    setPending(key)
    try {
      await update.mutateAsync({ [key]: !data[key] })
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-[#1a1a1a]">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/postmatch/settings" className="text-sm text-[#888] hover:text-white">
            ← Settings
          </Link>
          <h1 className="text-lg font-bold">Privacy</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        {isLoading && <p className="text-sm text-[#888]">Loading…</p>}
        {error && (
          <p className="text-sm text-rose-400">
            Could not load privacy settings. Try refreshing.
          </p>
        )}
        {data && TOGGLES.map((t) => {
          const on = data[t.key]
          const busy = pending === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => toggle(t.key)}
              disabled={busy}
              className="w-full flex items-center justify-between gap-4 rounded-xl border border-[#1a1a1a] bg-[#101010] p-4 hover:border-rose-500/40 transition-colors text-left disabled:opacity-50"
            >
              <div className="flex-1">
                <div className="font-semibold">{t.label}</div>
                <div className="text-sm text-[#888] mt-0.5">{t.description}</div>
              </div>
              <span
                className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
                  on ? 'bg-rose-500' : 'bg-[#2a2a2a]'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    on ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </span>
            </button>
          )
        })}

        <p className="pt-4 text-xs text-[#555] leading-relaxed">
          These controls take effect immediately. Existing matches keep seeing
          your profile as before; only new discovery is affected.
        </p>
      </main>
    </div>
  )
}
