'use client'

import Link from 'next/link'
import { getSession } from '@/services/authService'

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Create your Business Page',
    desc: 'Set up your brand identity, logo, and storefront details in minutes.',
  },
  {
    step: '02',
    title: 'Submit seller details',
    desc: 'Complete KYC, fulfillment preferences, and payout information.',
  },
  {
    step: '03',
    title: 'Get approved',
    desc: 'Our team reviews your application within 2–3 business days.',
  },
  {
    step: '04',
    title: 'Upload products & start selling',
    desc: 'List your catalog and reach millions of users on Postbook.',
  },
]

const BENEFITS = [
  { emoji: '🛒', title: 'Zero listing fees', desc: 'List unlimited products for free. Pay only when you sell.' },
  { emoji: '📦', title: 'Flexible fulfillment', desc: 'Ship yourself or use our platform delivery — your choice.' },
  { emoji: '💳', title: 'Fast payouts', desc: 'Receive earnings directly to your bank account weekly.' },
  { emoji: '📊', title: 'Seller dashboard', desc: 'Track orders, revenue, and product performance in real time.' },
  { emoji: '🔒', title: 'Secure transactions', desc: 'Payments protected with escrow and buyer safeguards.' },
  { emoji: '🌐', title: 'Social commerce', desc: 'Your storefront lives alongside your social presence.' },
]

const FAQS = [
  {
    q: 'Who can sell on Postbook?',
    a: 'Any individual, home business, retailer, or brand. You need a business page and valid KYC documents.',
  },
  {
    q: 'How long does approval take?',
    a: 'Typically 2–3 business days. We review identity, documents, and store details before activating your account.',
  },
  {
    q: 'What documents are required?',
    a: 'PAN card and one address proof (Aadhaar, passport, or business registration). GST certificate is required for GST-registered businesses.',
  },
  {
    q: 'How do I get paid?',
    a: 'Payouts are processed weekly to your registered bank account. COD collections are reconciled and remitted separately.',
  },
]

function sellerHref() {
  if (typeof window === 'undefined') return '/seller/onboarding'
  return getSession() ? '/seller/onboarding' : '/login?redirect=/seller/onboarding'
}

export default function CommerceLandingPage() {
  const startHref = sellerHref()
  return (
    <div className="min-h-screen bg-[#F5F0EB] font-sans">
      {/* ── Navbar ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#F5F0EB]/90 backdrop-blur-md border-b border-[#E8DDD3]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1A1A1A] flex items-center justify-center text-white font-black text-sm">
              PB
            </div>
            <div>
              <p className="font-bold text-[#1A1A1A] text-sm leading-none">Postbook Commerce</p>
              <p className="text-[10px] text-[#6B5544] mt-0.5">For businesses, sellers, and partners</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#4A3728]">
            <a href="#how-it-works" className="hover:text-[#1A1A1A] transition">How it Works</a>
            <a href="#benefits" className="hover:text-[#1A1A1A] transition">Benefits</a>
            <a href="#faq" className="hover:text-[#1A1A1A] transition">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden sm:block px-4 py-2 text-sm font-semibold text-[#1A1A1A] border border-[#1A1A1A] rounded-full hover:bg-[#1A1A1A] hover:text-white transition"
            >
              Sign In
            </Link>
            <Link
              href={startHref}
              className="px-4 py-2 text-sm font-bold text-white bg-[#1A1A1A] rounded-full hover:bg-[#3A2E26] transition"
            >
              Create Business Page
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-24">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#E8DDD3] rounded-full text-sm text-[#4A3728] mb-8 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Sell products. Build your brand. Grow on Postbook.
        </div>

        <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-[#1A1A1A] leading-[1.05] tracking-tight max-w-4xl mb-6">
          Launch your{' '}
          <span className="text-[#8B5E3C]">Business Page</span>{' '}
          and start selling from your own storefront.
        </h1>

        <p className="text-lg text-[#6B5544] max-w-2xl mb-10 leading-relaxed">
          Create your brand profile, submit seller details, get approved, and upload products
          — all from one guided flow built for retailers, home businesses, and growing brands.
        </p>

        <div className="flex flex-wrap gap-4">
          <Link
            href={startHref}
            className="px-8 py-4 bg-[#1A1A1A] text-white font-bold rounded-2xl hover:bg-[#3A2E26] transition text-sm shadow-lg shadow-black/10"
          >
            Create Business Page
          </Link>
          <a
            href="#how-it-works"
            className="px-8 py-4 bg-white text-[#1A1A1A] font-bold rounded-2xl border border-[#E8DDD3] hover:border-[#1A1A1A] transition text-sm"
          >
            Learn More
          </a>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-10 mt-16 pt-10 border-t border-[#E8DDD3]">
          {[
            { value: '2M+', label: 'Active users' },
            { value: '₹0', label: 'Listing fee' },
            { value: '2–3 days', label: 'Approval time' },
            { value: '7-day', label: 'Return window' },
          ].map(s => (
            <div key={s.label}>
              <p className="text-3xl font-black text-[#1A1A1A]">{s.value}</p>
              <p className="text-sm text-[#6B5544] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it Works ────────────────────────────────────────── */}
      <section id="how-it-works" className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-xs font-black uppercase tracking-widest text-[#8B5E3C] mb-3">Process</p>
          <h2 className="text-4xl font-black text-[#1A1A1A] mb-14">How it works</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {HOW_IT_WORKS.map(item => (
              <div key={item.step} className="group">
                <div className="text-5xl font-black text-[#E8DDD3] group-hover:text-[#8B5E3C] transition mb-4">
                  {item.step}
                </div>
                <h3 className="font-bold text-[#1A1A1A] mb-2">{item.title}</h3>
                <p className="text-sm text-[#6B5544] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Benefits ────────────────────────────────────────────── */}
      <section id="benefits" className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-xs font-black uppercase tracking-widest text-[#8B5E3C] mb-3">Why sell here</p>
          <h2 className="text-4xl font-black text-[#1A1A1A] mb-14">Built for real sellers</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {BENEFITS.map(b => (
              <div key={b.title} className="bg-white rounded-2xl border border-[#E8DDD3] p-6 hover:border-[#8B5E3C] transition">
                <div className="text-3xl mb-3">{b.emoji}</div>
                <h3 className="font-bold text-[#1A1A1A] mb-1">{b.title}</h3>
                <p className="text-sm text-[#6B5544] leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────── */}
      <section id="faq" className="bg-white py-20">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-xs font-black uppercase tracking-widest text-[#8B5E3C] mb-3">FAQ</p>
          <h2 className="text-4xl font-black text-[#1A1A1A] mb-12">Common questions</h2>
          <div className="space-y-6">
            {FAQS.map(faq => (
              <div key={faq.q} className="border-b border-[#E8DDD3] pb-6 last:border-0">
                <h3 className="font-bold text-[#1A1A1A] mb-2">{faq.q}</h3>
                <p className="text-sm text-[#6B5544] leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ──────────────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-5xl font-black text-[#1A1A1A] mb-4">Ready to start selling?</h2>
          <p className="text-[#6B5544] mb-10">Join thousands of sellers growing their business on Postbook.</p>
          <Link
            href={startHref}
            className="inline-block px-10 py-4 bg-[#1A1A1A] text-white font-bold rounded-2xl hover:bg-[#3A2E26] transition text-sm shadow-lg shadow-black/10"
          >
            Create Business Page — It's Free
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-[#E8DDD3] py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4 text-sm text-[#6B5544]">
          <p>© 2026 Postbook Commerce · atpost</p>
          <div className="flex gap-6">
            <Link href="/seller/dashboard" className="hover:text-[#1A1A1A] transition">Seller Dashboard</Link>
            <Link href="/pages" className="hover:text-[#1A1A1A] transition">Business Pages</Link>
            <Link href="/" className="hover:text-[#1A1A1A] transition">Back to Feed</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
