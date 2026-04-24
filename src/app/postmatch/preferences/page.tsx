'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePostMatchPreferences, useUpdatePostMatchPreferences } from '@/hooks/usePostmatch'
import type { LookingFor, RelationshipIntent } from '@/types/postmatch'

export default function PostMatchPreferencesPage() {
  const router = useRouter()
  const { data: prefs, isLoading } = usePostMatchPreferences()
  const update = useUpdatePostMatchPreferences()

  const [minAge, setMinAge] = useState(18)
  const [maxAge, setMaxAge] = useState(99)
  const [distance, setDistance] = useState(50)
  const [gender, setGender] = useState<LookingFor>('everyone')
  const [intent, setIntent] = useState<RelationshipIntent | ''>('')

  useEffect(() => {
    if (prefs) {
      setMinAge(prefs.min_age)
      setMaxAge(prefs.max_age)
      setDistance(prefs.distance_km)
      setGender(prefs.interested_in_gender)
      setIntent(prefs.relationship_intent ?? '')
    }
  }, [prefs])

  const save = async () => {
    await update.mutateAsync({
      min_age: minAge,
      max_age: maxAge,
      distance_km: distance,
      interested_in_gender: gender,
      relationship_intent: intent || undefined,
    })
    router.push('/postmatch/settings')
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-[#1a1a1a]">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/postmatch/settings" className="text-sm text-[#888] hover:text-white">
            ← Settings
          </Link>
          <h1 className="text-lg font-bold">Preferences</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {isLoading ? (
          <p className="text-[#888]">Loading…</p>
        ) : (
          <>
            <section className="rounded-2xl border border-[#1a1a1a] bg-[#101010] p-6">
              <h2 className="text-sm font-semibold mb-4">Age range</h2>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={18}
                  max={99}
                  value={minAge}
                  onChange={(e) => setMinAge(parseInt(e.target.value) || 18)}
                  className="w-24 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-sm"
                />
                <span className="text-[#888]">to</span>
                <input
                  type="number"
                  min={18}
                  max={99}
                  value={maxAge}
                  onChange={(e) => setMaxAge(parseInt(e.target.value) || 99)}
                  className="w-24 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-sm"
                />
              </div>
            </section>

            <section className="rounded-2xl border border-[#1a1a1a] bg-[#101010] p-6">
              <h2 className="text-sm font-semibold mb-4">Maximum distance</h2>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={500}
                  value={distance}
                  onChange={(e) => setDistance(parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="w-20 text-right text-sm">{distance} km</span>
              </div>
            </section>

            <section className="rounded-2xl border border-[#1a1a1a] bg-[#101010] p-6">
              <h2 className="text-sm font-semibold mb-4">Interested in</h2>
              <div className="grid grid-cols-3 gap-2">
                {(['male', 'female', 'everyone'] as LookingFor[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    className={`py-2 rounded-lg text-sm border ${
                      gender === g
                        ? 'bg-rose-600 border-rose-600 text-white'
                        : 'bg-transparent border-[#2a2a2a] text-[#ccc] hover:border-rose-500'
                    }`}
                  >
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-[#1a1a1a] bg-[#101010] p-6">
              <h2 className="text-sm font-semibold mb-4">Relationship intent</h2>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { v: '', label: 'No preference' },
                    { v: 'long_term', label: 'Long term' },
                    { v: 'marriage', label: 'Marriage' },
                    { v: 'casual', label: 'Casual' },
                    { v: 'figuring_out', label: 'Figuring out' },
                  ] as { v: RelationshipIntent | ''; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.v}
                    onClick={() => setIntent(opt.v)}
                    className={`py-2 rounded-lg text-sm border ${
                      intent === opt.v
                        ? 'bg-rose-600 border-rose-600 text-white'
                        : 'bg-transparent border-[#2a2a2a] text-[#ccc] hover:border-rose-500'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </section>

            <button
              onClick={save}
              disabled={update.isPending}
              className="w-full bg-gradient-to-r from-rose-600 to-orange-500 text-white py-3 rounded-full font-bold disabled:opacity-50"
            >
              {update.isPending ? 'Saving…' : 'Save preferences'}
            </button>
          </>
        )}
      </main>
    </div>
  )
}
