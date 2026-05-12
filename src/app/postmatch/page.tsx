'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { checkPostMatchAuth } from '@/lib/postmatchGuard'

const FEATURES = [
  { icon: '🔒', title: 'Trust-First Matching', desc: 'Weighted scoring on intent, lifestyle, and compatibility — not just looks.' },
  { icon: '📍', title: 'Nearby Discovery', desc: 'Haversine-based distance calculation finds people genuinely close to you.' },
  { icon: '💬', title: 'Match to Chat', desc: 'Conversations unlock only after mutual likes. No unsolicited messages.' },
  { icon: '🛡️', title: 'Safety Built In', desc: 'Report, block, and moderation tools from day one. Admin queue for urgent cases.' },
  { icon: '📸', title: 'Photo Verification', desc: 'Presigned uploads with moderation pipeline. Blur mode for added privacy.' },
  { icon: '💎', title: 'Intention Matching', desc: 'Marriage, long-term, casual, or figuring out — find people on the same page.' },
]

const STEPS = [
  { num: '01', title: 'Create Your Profile', desc: 'Share your basics — name, age, location, and what you\'re looking for.' },
  { num: '02', title: 'Upload Photos', desc: 'Add up to 6 photos. Your first photo becomes your primary card image.' },
  { num: '03', title: 'Set Preferences', desc: 'Age range, distance, intent, and lifestyle dealbreakers.' },
  { num: '04', title: 'Start Discovering', desc: 'Swipe through scored profiles. Mutual like = instant match + chat.' },
]

export default function PostMatchLandingPage() {
  const [startHref, setStartHref] = useState('/postmatch/onboarding')

  useEffect(() => {
    const state = checkPostMatchAuth()
    // Logged-in AtPost users continue to onboarding (data pre-filled from AtPost).
    // Fully onboarded users go straight to discover.
    if (state === 'ready') setStartHref('/postmatch/discover')
    else if (state === 'needs_onboarding') setStartHref('/postmatch/onboarding')
    else setStartHref('/login?redirect=/postmatch/onboarding')
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a0a] font-sans">
      {/* ── Navbar ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-[#1a1a1a]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-600 to-orange-500 flex items-center justify-center text-white font-black text-xs">
              PM
            </div>
            <div>
              <p className="font-bold text-white text-sm leading-none">PostMatch</p>
              <p className="text-[10px] text-rose-400 mt-0.5">by AtPost</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#888]">
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#how-it-works" className="hover:text-white transition">How it Works</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link href={startHref} className="inline-flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-gradient-to-r from-rose-600 to-orange-500 rounded-full hover:shadow-lg hover:shadow-rose-500/20 transition">
              Get Started
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 12h15" /></svg>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-24">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 border border-rose-100 rounded-full text-sm text-rose-600 mb-8">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          Trust-first partner search. Real connections. No noise.
        </div>

        <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-white leading-[1.05] tracking-tight max-w-4xl mb-6">
          Find someone who{' '}
          <span className="bg-gradient-to-r from-rose-600 to-orange-500 bg-clip-text text-transparent">actually gets you.</span>
        </h1>

        <p className="text-lg text-[#888] max-w-2xl mb-10 leading-relaxed">
          Smart compatibility scoring, intention-based matching, and safety-first design.
          Built for people serious about finding their person.
        </p>

        <div className="flex flex-wrap gap-4">
          <Link
            href={startHref}
            className="px-8 py-4 bg-gradient-to-r from-rose-600 to-orange-500 text-white font-bold rounded-2xl hover:shadow-xl hover:shadow-rose-500/20 transition text-sm"
          >
            Create Your Profile
          </Link>
          <a
            href="#features"
            className="px-8 py-4 bg-[#1a1a1a] text-white font-bold rounded-2xl border border-[#333] hover:border-[#555] transition text-sm"
          >
            Learn More
          </a>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-10 mt-16 pt-10 border-t border-[#222]">
          {[
            { value: '7', label: 'Match Factors' },
            { value: '100%', label: 'Free to start' },
            { value: '31', label: 'API Endpoints' },
            { value: '23', label: 'Safety Tables' },
          ].map(s => (
            <div key={s.label}>
              <p className="text-3xl font-black text-white">{s.value}</p>
              <p className="text-sm text-[#666] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────── */}
      <section id="features" className="bg-[#111] py-20">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-xs font-black uppercase tracking-widest text-rose-500 mb-3">Features</p>
          <h2 className="text-4xl font-black text-white mb-14">Why PostMatch is different</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="bg-[#1a1a1a] rounded-2xl border border-[#333] p-6 hover:border-rose-300 hover:shadow-lg hover:shadow-rose-500/5 transition">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-bold text-white mb-1">{f.title}</h3>
                <p className="text-sm text-[#888] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it Works ────────────────────────────────────── */}
      <section id="how-it-works" className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-xs font-black uppercase tracking-widest text-rose-500 mb-3">Process</p>
          <h2 className="text-4xl font-black text-white mb-14">4 steps to your first match</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {STEPS.map(s => (
              <div key={s.num} className="group">
                <div className="text-5xl font-black text-[#222] group-hover:text-rose-200 transition mb-4">{s.num}</div>
                <h3 className="font-bold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-[#888] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Scoring Breakdown ───────────────────────────────── */}
      <section className="bg-gray-900 py-20 text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-rose-400 mb-3">Algorithm</p>
          <h2 className="text-4xl font-black mb-10">7-Factor Compatibility Score</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { pct: '20%', label: 'Age Fit' },
              { pct: '20%', label: 'Intent Match' },
              { pct: '15%', label: 'Distance' },
              { pct: '15%', label: 'Lifestyle' },
              { pct: '10%', label: 'Trust Score' },
              { pct: '10%', label: 'Profile Quality' },
              { pct: '10%', label: 'Freshness' },
            ].map(f => (
              <div key={f.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-2xl font-black bg-gradient-to-r from-rose-400 to-orange-400 bg-clip-text text-transparent">{f.pct}</p>
                <p className="text-xs text-gray-400 mt-1">{f.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ──────────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-5xl font-black text-white mb-4">Ready to meet someone real?</h2>
          <p className="text-[#888] mb-10">No swiping fatigue. Just meaningful matches.</p>
          <Link
            href={startHref}
            className="inline-block px-10 py-4 bg-gradient-to-r from-rose-600 to-orange-500 text-white font-bold rounded-2xl hover:shadow-xl hover:shadow-rose-500/20 transition text-sm"
          >
            Create Your Profile — Free
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-[#222] py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4 text-sm text-[#666]">
          <p>© 2026 PostMatch · by AtPost</p>
          <div className="flex gap-6">
            <Link href="/postmatch/discover" className="hover:text-white transition">Discover</Link>
            <Link href="/postmatch/matches" className="hover:text-white transition">Matches</Link>
            <Link href="/" className="hover:text-white transition">Back to Feed</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
