'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { checkPostMatchAuth, postmatchLoginRedirect } from '@/lib/postmatchGuard'
import { useDiscoveryFeed, useMakeDecision, usePostMatchProfile, usePostMatchPhotos } from '@/hooks/usePostmatch'
import type { DecisionResult } from '@/types/postmatch'
import { TrustBadge } from '@/components/postmatch/TrustBadge'

export default function DiscoverPage() {
  const router = useRouter()
  const { data, isLoading } = useDiscoveryFeed()
  const makeDecision = useMakeDecision()
  const { data: myProfile } = usePostMatchProfile()
  const { data: myPhotos = [] } = usePostMatchPhotos()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [matchPopup, setMatchPopup] = useState<DecisionResult | null>(null)
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [decisionError, setDecisionError] = useState<string | null>(null)

  const primaryPhoto = myPhotos.find(p => p.is_primary)?.media_url

  useEffect(() => {
    const state = checkPostMatchAuth()
    if (state === 'unauthenticated') router.replace(postmatchLoginRedirect('/postmatch/discover'))
    else if (state === 'needs_onboarding') router.replace('/postmatch/onboarding')
  }, [router])

  const cards = data?.items ?? []
  const current = cards[currentIndex]

  const handleDecision = useCallback(async (decision: 'like' | 'pass' | 'super_like') => {
    if (!current) return
    setDecisionError(null)
    setSwipeDirection(decision === 'pass' ? 'left' : 'right')

    try {
      const result = await makeDecision.mutateAsync({
        target_user_id: current.user_id,
        decision,
      })
      if (result.result === 'matched') {
        setMatchPopup(result)
      }
      // P1-4 / §13: only advance the deck when the backend acknowledged
      // the decision. On error we hold the card so the user can retry
      // — see catch branch below.
      setTimeout(() => {
        setSwipeDirection(null)
        setCurrentIndex(prev => prev + 1)
      }, 300)
    } catch (err) {
      // Roll the swipe animation back and surface a banner. The card
      // stays put so the user can retry the same decision.
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        'Could not save your choice. Tap again to retry.'
      setSwipeDirection(null)
      setDecisionError(message)
    }
  }, [current, makeDecision])

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <Header primaryPhoto={primaryPhoto} name={myProfile?.first_name} showMenu={showMenu} setShowMenu={setShowMenu} router={router} />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="w-8 h-8 border-[3px] border-rose-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header primaryPhoto={primaryPhoto} name={myProfile?.first_name} showMenu={showMenu} setShowMenu={setShowMenu} router={router} />

      {/* Match popup */}
      {matchPopup && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center px-4" onClick={() => setMatchPopup(null)}>
          <div className="bg-[#111] rounded-3xl p-10 text-center max-w-sm w-full shadow-2xl animate-in fade-in zoom-in" onClick={e => e.stopPropagation()}>
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center mx-auto mb-5">
              <span className="text-4xl">🎉</span>
            </div>
            <h2 className="text-3xl font-black bg-gradient-to-r from-rose-600 to-orange-500 bg-clip-text text-transparent mb-2">It&apos;s a Match!</h2>
            <p className="text-[#666] text-sm mb-8">You and {current?.first_name} liked each other</p>
            <div className="space-y-3">
              <button
                onClick={() => { setMatchPopup(null); router.push(`/postmatch/chat/${matchPopup.conversation_id}`) }}
                className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-orange-500 text-white rounded-2xl font-bold shadow-lg shadow-rose-500/20 text-sm hover:shadow-xl transition"
              >
                Send a Message
              </button>
              <button
                onClick={() => setMatchPopup(null)}
                className="w-full py-3.5 border border-[#333] rounded-2xl text-[#666] font-bold text-sm hover:bg-[#1a1a1a] transition"
              >
                Keep Swiping
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto px-4 py-5">
        {!current || currentIndex >= cards.length ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-[70vh] text-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-rose-100 to-orange-100 flex items-center justify-center mb-6">
              <span className="text-5xl">✦</span>
            </div>
            <h3 className="text-2xl font-black text-white mb-2">You&apos;ve seen everyone</h3>
            <p className="text-[#666] text-sm mb-8 max-w-xs leading-relaxed">New people join every day. Come back soon or expand your preferences.</p>
            <div className="flex gap-3">
              <button onClick={() => setCurrentIndex(0)} className="px-6 py-3 bg-[#111] border border-[#333] rounded-2xl text-sm font-bold text-[#888] hover:bg-[#1a1a1a] transition shadow-sm">
                Refresh
              </button>
              <Link href="/postmatch/profile" className="px-6 py-3 bg-gradient-to-r from-rose-600 to-orange-500 rounded-2xl text-sm font-bold text-white shadow-lg shadow-rose-500/20 hover:shadow-xl transition">
                Edit Preferences
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Profile Card */}
            <div
              className={`relative bg-[#111] rounded-[28px] overflow-hidden shadow-xl shadow-black/5 transition-all duration-300 ${
                swipeDirection === 'left' ? '-translate-x-[120%] opacity-0 rotate-[-15deg]' :
                swipeDirection === 'right' ? 'translate-x-[120%] opacity-0 rotate-[15deg]' : ''
              }`}
            >
              {/* Photo */}
              <div className="aspect-[3/4] bg-gradient-to-br from-rose-100 to-orange-50 relative">
                {current.primary_photo ? (
                  <img
                    src={current.primary_photo.url}
                    alt={current.first_name}
                    className={`w-full h-full object-cover ${current.primary_photo.blurred ? 'blur-lg' : ''}`}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-rose-200 to-orange-200">
                    <span className="text-[120px] text-white/40 font-black">{current.first_name?.[0]}</span>
                  </div>
                )}

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

                {/* LIKE/NOPE stamps */}
                {swipeDirection === 'right' && (
                  <div className="absolute top-8 left-6 border-4 border-emerald-400 rounded-xl px-5 py-2 rotate-[-20deg]">
                    <span className="text-emerald-400 text-3xl font-black tracking-wider">LIKE</span>
                  </div>
                )}
                {swipeDirection === 'left' && (
                  <div className="absolute top-8 right-6 border-4 border-red-400 rounded-xl px-5 py-2 rotate-[20deg]">
                    <span className="text-red-400 text-3xl font-black tracking-wider">NOPE</span>
                  </div>
                )}

                {/* Info overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  <div className="flex items-end justify-between">
                    <div className="flex-1">
                      <h2 className="text-3xl font-black leading-tight">{current.first_name}, {current.age}</h2>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {current.city && (
                          <span className="flex items-center gap-1 text-sm text-white/80">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            {current.city}
                          </span>
                        )}
                        {current.occupation && (
                          <span className="flex items-center gap-1 text-sm text-white/60">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            {current.occupation}
                          </span>
                        )}
                      </div>
                      {/* Phase 1 — verification badges from candidate payload. */}
                      <div className="mt-2">
                        <TrustBadge
                          trustTier={current.trust_tier}
                          verificationState={current.verification_state}
                          variant="compact"
                        />
                      </div>
                    </div>
                    {/* Info button */}
                    <button
                      onClick={() => setShowInfo(!showInfo)}
                      className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center hover:bg-white/25 transition flex-shrink-0 ml-3"
                    >
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Details panel */}
              <div className={`transition-all duration-300 overflow-hidden ${showInfo ? 'max-h-96' : 'max-h-0'}`}>
                <div className="p-5 space-y-4 border-t border-[#222]">
                  {current.relationship_intent && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm">💖</span>
                      <span className="text-sm text-gray-700 font-medium capitalize">{current.relationship_intent.replace('_', ' ')}</span>
                    </div>
                  )}
                  {current.bio_preview && (
                    <p className="text-[#888] text-sm leading-relaxed">{current.bio_preview}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
                      current.trust_level === 'high' ? 'bg-emerald-50 text-emerald-600' :
                      current.trust_level === 'medium' ? 'bg-amber-50 text-amber-600' :
                      'bg-[#1a1a1a] text-[#666]'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        current.trust_level === 'high' ? 'bg-emerald-500' :
                        current.trust_level === 'medium' ? 'bg-amber-500' : 'bg-gray-300'
                      }`} />
                      {current.trust_level} trust
                    </span>
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-50 text-rose-500 text-[11px] font-bold">
                      {current.compatibility_score}% match
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-5 mt-6">
              {/* Rewind */}
              <button
                disabled
                className="w-12 h-12 rounded-full bg-[#111] border border-[#333] flex items-center justify-center text-amber-400 shadow-sm opacity-40 cursor-not-allowed"
                title="Rewind (Premium)"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4" /></svg>
              </button>

              {/* Pass */}
              <button
                onClick={() => handleDecision('pass')}
                disabled={makeDecision.isPending}
                className="w-16 h-16 rounded-full bg-[#111] border-[3px] border-red-200 flex items-center justify-center text-red-400 hover:border-red-400 hover:text-red-500 hover:scale-110 active:scale-90 transition-all shadow-lg disabled:opacity-50"
                title="Pass"
              >
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>

              {/* Super Like */}
              <button
                onClick={() => handleDecision('super_like')}
                disabled={makeDecision.isPending}
                className="w-12 h-12 rounded-full bg-[#111] border-[3px] border-blue-200 flex items-center justify-center text-blue-400 hover:border-blue-400 hover:text-blue-500 hover:scale-110 active:scale-90 transition-all shadow-lg disabled:opacity-50"
                title="Super Like"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
              </button>

              {/* Like */}
              <button
                onClick={() => handleDecision('like')}
                disabled={makeDecision.isPending}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center text-white hover:scale-110 hover:shadow-xl hover:shadow-rose-500/30 active:scale-90 transition-all shadow-lg disabled:opacity-50"
                title="Like"
              >
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
              </button>

              {/* Boost */}
              <button
                disabled
                className="w-12 h-12 rounded-full bg-[#111] border border-[#333] flex items-center justify-center text-purple-400 shadow-sm opacity-40 cursor-not-allowed"
                title="Boost (Premium)"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
              </button>
            </div>

            {/* P1-4: held card + retry banner — surfaced when the
                decision mutation fails. The card itself stays in place
                so the user can re-tap their choice. */}
            {decisionError && (
              <div
                role="alert"
                className="mt-4 mx-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 flex items-start gap-3"
              >
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                </svg>
                <div className="flex-1">
                  <p className="font-bold">{decisionError}</p>
                  <button
                    type="button"
                    onClick={() => setDecisionError(null)}
                    className="mt-1 text-[10px] font-bold uppercase tracking-widest text-rose-200 hover:text-white transition"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Card counter */}
            <div className="text-center mt-4">
              <span className="text-[10px] font-bold text-[#555] uppercase tracking-widest">{currentIndex + 1} of {cards.length}</span>
            </div>
          </>
        )}
      </div>

      {/* Bottom Tab Bar */}
      <BottomNav active="discover" router={router} />
    </div>
  )
}

/* ── Header Component ──────────────────────────────────────── */
function Header({ primaryPhoto, name, showMenu, setShowMenu, router }: {
  primaryPhoto?: string
  name?: string
  showMenu: boolean
  setShowMenu: (v: boolean) => void
  router: ReturnType<typeof useRouter>
}) {
  return (
    <header className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-[#1a1a1a]">
      <div className="max-w-md mx-auto flex items-center justify-between px-4 h-16">
        {/* Left — Settings */}
        <Link href="/postmatch/profile" className="w-10 h-10 rounded-full bg-[#1a1a1a] flex items-center justify-center text-[#666] hover:bg-[#222] hover:text-white transition">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </Link>

        {/* Center — Logo */}
        <Link href="/postmatch" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 text-white" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          </div>
          <span className="text-lg font-black bg-gradient-to-r from-rose-600 to-orange-500 bg-clip-text text-transparent tracking-tight">PostMatch</span>
        </Link>

        {/* Right — Profile avatar with dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-orange-500 p-[2px] hover:shadow-lg hover:shadow-rose-500/20 transition"
          >
            <div className="w-full h-full rounded-full bg-gray-100 overflow-hidden flex items-center justify-center">
              {primaryPhoto ? (
                <img src={primaryPhoto} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[#666] font-black text-sm">{name?.[0] ?? '?'}</span>
              )}
            </div>
          </button>

          {/* Dropdown menu */}
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-12 w-56 bg-[#111] rounded-2xl shadow-xl shadow-black/30 border border-[#222] py-2 z-50">
                <button
                  onClick={() => { setShowMenu(false); router.push('/postmatch/profile') }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1a1a1a] transition text-left"
                >
                  <svg className="w-5 h-5 text-[#666]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  <div>
                    <p className="text-sm font-bold text-white">My Profile</p>
                    <p className="text-[10px] text-[#666]">Edit photos & details</p>
                  </div>
                </button>
                <button
                  onClick={() => { setShowMenu(false); router.push('/postmatch/profile') }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1a1a1a] transition text-left"
                >
                  <svg className="w-5 h-5 text-[#666]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <div>
                    <p className="text-sm font-bold text-white">Settings</p>
                    <p className="text-[10px] text-[#666]">Preferences & account</p>
                  </div>
                </button>
                <div className="border-t border-[#222] my-1" />
                <button
                  onClick={() => { setShowMenu(false); router.push('/postmatch/matches') }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1a1a1a] transition text-left"
                >
                  <svg className="w-5 h-5 text-[#666]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                  <div>
                    <p className="text-sm font-bold text-white">Matches</p>
                    <p className="text-[10px] text-[#666]">See who likes you</p>
                  </div>
                </button>
                <div className="border-t border-[#222] my-1" />
                <button
                  onClick={() => {
                    setShowMenu(false)
                    import('@/lib/postmatchApi').then(m => { m.clearPostMatchAuth() })
                    router.push('/postmatch')
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 transition text-left"
                >
                  <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  <p className="text-sm font-bold text-red-500">Sign Out</p>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

/* ── Bottom Tab Bar ────────────────────────────────────────── */
function BottomNav({ active, router }: { active: string; router: ReturnType<typeof useRouter> }) {
  const tabs = [
    { id: 'discover', label: 'Discover', href: '/postmatch/discover', icon: (a: boolean) => (
      <svg className={`w-6 h-6 ${a ? 'text-rose-500' : 'text-[#555]'}`} fill={a ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={a ? 0 : 1.5}><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
    )},
    { id: 'matches', label: 'Matches', href: '/postmatch/matches', icon: (a: boolean) => (
      <svg className={`w-6 h-6 ${a ? 'text-rose-500' : 'text-[#555]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={a ? 2.5 : 1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
    )},
    { id: 'chat', label: 'Chat', href: '/postmatch/matches', icon: (a: boolean) => (
      <svg className={`w-6 h-6 ${a ? 'text-rose-500' : 'text-[#555]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={a ? 2.5 : 1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
    )},
    { id: 'profile', label: 'Profile', href: '/postmatch/profile', icon: (a: boolean) => (
      <svg className={`w-6 h-6 ${a ? 'text-rose-500' : 'text-[#555]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={a ? 2.5 : 1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
    )},
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-[#1a1a1a]">
      <div className="max-w-md mx-auto flex items-center justify-around h-16">
        {tabs.map(t => {
          const isActive = active === t.id
          return (
            <Link key={t.id} href={t.href} className="flex flex-col items-center gap-0.5 min-w-[64px]">
              {t.icon(isActive)}
              <span className={`text-[10px] font-bold ${isActive ? 'text-rose-500' : 'text-[#555]'}`}>{t.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
