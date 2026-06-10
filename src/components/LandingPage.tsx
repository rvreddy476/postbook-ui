'use client';

// Public marketing landing for unauthenticated visitors. Renders from
// PostBoekApp when `currentUser` is null.
//
// Dynamic bits:
//  - Status pill polls /health every 60s. Falls back to "Status unknown"
//    on error, never blocks render.
//  - Stats are hard-coded today; usePublicStats is wired so the moment
//    /v1/public/stats lands it just swaps the hook impl without UI
//    changes.
//  - Feature cards deep-link into the real SPA routes (live, reels,
//    chat tab, monetization).

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Play,
  Video,
  MessageCircle,
  DollarSign,
  Sparkles,
  Star,
} from 'lucide-react';

// ── Status poll ─────────────────────────────────────────────────

type SystemStatus = 'operational' | 'degraded' | 'unknown';

function useSystemStatus(): SystemStatus {
  const [status, setStatus] = useState<SystemStatus>('unknown');
  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
    const url = `${apiBase}/health`;
    let cancelled = false;
    const ping = async () => {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (cancelled) return;
        setStatus(res.ok ? 'operational' : 'degraded');
      } catch {
        if (!cancelled) setStatus('unknown');
      }
    };
    ping();
    const t = setInterval(ping, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);
  return status;
}

// ── Public stats ────────────────────────────────────────────────

interface PublicStats {
  creators: string;
  viewers: string;
  paidOut: string;
  uptime: string;
}

function usePublicStats(): PublicStats {
  // TODO: swap with a real /v1/public/stats endpoint once it exists.
  // Keeping the hook shape stable so the UI doesn't change.
  return {
    creators: '200K+',
    viewers: '8.4M',
    paidOut: '$12M',
    uptime: '99.9%',
  };
}

// ── Navbar ──────────────────────────────────────────────────────

function Navbar() {
  return (
    <nav className="flex h-16 items-center justify-between border-b border-black/5 px-7">
      <Link href="/" className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black">
          <Sparkles className="h-4 w-4 text-white" strokeWidth={2.5} />
        </span>
        <span className="text-lg font-medium tracking-tight text-black">VChat</span>
      </Link>
      <div className="hidden items-center gap-2 md:flex">
        <Link
          href="#features"
          className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-[#4b4b4b] transition-colors hover:text-black"
        >
          Features
        </Link>
        <Link
          href="/discover"
          className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-[#4b4b4b] transition-colors hover:text-black"
        >
          Creators
        </Link>
        <Link
          href="/monetization"
          className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-[#4b4b4b] transition-colors hover:text-black"
        >
          Pricing
        </Link>
        <Link
          href="/login"
          className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-[#4b4b4b] transition-colors hover:text-black"
        >
          Log In
        </Link>
        <Link
          href="/register"
          className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition-transform hover:scale-[1.03]"
        >
          Sign Up
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
        </Link>
      </div>
    </nav>
  );
}

// ── Announcement pill ───────────────────────────────────────────

function AnnouncementPill() {
  return (
    <Link
      href="/reels"
      className="mb-6 inline-flex items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-3.5 shadow-sm transition-transform hover:scale-[1.02]"
    >
      <span className="rounded-full bg-[#EAF3DE] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#3B6D11]">
        New
      </span>
      <span className="text-xs font-medium text-[#2C2C2A]">Reels v2.0 — now with AI captions</span>
      <ArrowRight className="h-3.5 w-3.5 text-[#6b6b6b]" strokeWidth={2} />
    </Link>
  );
}

// ── Hero copy + CTAs ────────────────────────────────────────────

function HeroLeft() {
  return (
    <div>
      <AnnouncementPill />
      <h1 className="mb-5 text-[44px] font-medium leading-[0.95] tracking-[-0.04em] text-black sm:text-[52px]">
        Create.
        <br />
        Connect.
        <br />
        <span className="text-[#2563EB]">Explore.</span>
      </h1>
      <p className="mb-6 max-w-md text-[15px] leading-relaxed text-[#4b4b4b]">
        The infinite network for the modern visionary. A digital sanctuary
        built for authentic connection and global discovery.
      </p>

      <div className="mb-7 flex flex-wrap gap-2.5">
        <Link
          href="/register"
          className="group inline-flex items-center gap-2.5 rounded-full bg-black px-5 py-3.5 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition-transform hover:scale-[1.03]"
        >
          Start Free
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15">
            <ArrowRight className="h-3 w-3" strokeWidth={2.5} />
          </span>
        </Link>
        <Link
          href="/reels"
          className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-black bg-transparent px-5 py-3.5 text-[11px] font-medium uppercase tracking-[0.15em] text-black transition-colors hover:bg-black hover:text-white"
        >
          <Play className="h-3.5 w-3.5" strokeWidth={2.5} />
          Watch Demo
        </Link>
      </div>

      <SocialProof />
    </div>
  );
}

// ── Avatar stack + rating ───────────────────────────────────────

const PROOF_AVATARS = [
  { initials: 'MR', bg: '#F0997B', fg: '#4A1B0C' },
  { initials: 'JK', bg: '#85B7EB', fg: '#042C53' },
  { initials: 'AT', bg: '#5DCAA5', fg: '#04342C' },
  { initials: 'SL', bg: '#F4C0D1', fg: '#4B1528' },
];

function SocialProof() {
  return (
    <div className="flex items-center gap-3.5 border-t border-black/10 pt-5">
      <div className="flex">
        {PROOF_AVATARS.map((a, i) => (
          <div
            key={a.initials}
            className="-ml-2.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-50 text-[11px] font-medium first:ml-0"
            style={{ backgroundColor: a.bg, color: a.fg }}
          >
            {a.initials}
          </div>
        ))}
      </div>
      <div>
        <div className="flex items-center gap-1 text-[13px] font-medium text-black">
          {[0, 1, 2, 3, 4].map(i => (
            <Star key={i} className="h-3 w-3 fill-[#EF9F27] text-[#EF9F27]" strokeWidth={0} />
          ))}
          <span className="ml-1">4.9 from 12K creators</span>
        </div>
        <div className="mt-0.5 text-[11px] text-[#6b6b6b]">
          Join 200,000+ visionaries already on VChat
        </div>
      </div>
    </div>
  );
}

// ── Feature card grid ───────────────────────────────────────────

interface FeatureCardData {
  title: string;
  desc: string;
  href: string;
  icon: React.ReactNode;
  iconBg: string;
}

const FEATURES: FeatureCardData[] = [
  {
    title: 'Video Stream',
    desc: 'Go live to your followers with LiveKit-powered HD streaming.',
    href: '/live',
    icon: <Video className="h-5 w-5 text-white" strokeWidth={2.5} />,
    iconBg: '#378ADD',
  },
  {
    title: 'Short Reels',
    desc: 'Vertical 60-second videos with native AI moderation.',
    href: '/reels',
    icon: <Play className="h-5 w-5 fill-white text-white" strokeWidth={2} />,
    iconBg: '#E24B4A',
  },
  {
    title: 'Direct Message',
    desc: 'Real-time WebSocket chat with read receipts and presence.',
    href: '/?tab=Chat',
    icon: <MessageCircle className="h-5 w-5 text-white" strokeWidth={2.5} />,
    iconBg: '#EF9F27',
  },
  {
    title: 'Monetize',
    desc: 'Tiered subscriptions, COD-and-UPI payouts, full earnings ledger.',
    href: '/monetization',
    icon: <DollarSign className="h-5 w-5 text-white" strokeWidth={2.5} />,
    iconBg: '#1D9E75',
  },
];

function FeatureGrid() {
  return (
    <div id="features" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {FEATURES.map(f => (
        <Link
          key={f.title}
          href={f.href}
          className="group block rounded-2xl bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div
            className="mb-3.5 flex h-9 w-9 items-center justify-center rounded-[10px]"
            style={{ backgroundColor: f.iconBg }}
          >
            {f.icon}
          </div>
          <div className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-black">
            {f.title}
          </div>
          <div className="text-[11px] leading-snug text-[#6b6b6b]">{f.desc}</div>
          <div className="mt-3 flex items-center gap-1 border-t border-black/5 pt-2.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[#2563EB]">
            Explore
            <ArrowRight
              className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
              strokeWidth={2.5}
            />
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── Black stats strip ───────────────────────────────────────────

function StatsStrip() {
  const stats = usePublicStats();
  const items = [
    { value: stats.creators, label: 'Active Creators' },
    { value: stats.viewers, label: 'Monthly Viewers' },
    { value: stats.paidOut, label: 'Paid to Creators' },
    { value: stats.uptime, label: 'Platform Uptime' },
  ];
  return (
    <div className="grid grid-cols-2 gap-6 bg-black px-7 py-5 text-white sm:grid-cols-4">
      {items.map(item => (
        <div key={item.label}>
          <div className="text-[28px] font-medium leading-none tracking-tight">{item.value}</div>
          <div className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-[#888]">
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Bottom status strip ─────────────────────────────────────────

function StatusStrip() {
  const status = useSystemStatus();
  const tone =
    status === 'operational'
      ? { dot: 'bg-[#1D9E75]', label: 'All systems operational' }
      : status === 'degraded'
        ? { dot: 'bg-[#EF9F27]', label: 'Degraded performance' }
        : { dot: 'bg-[#9b9b9b]', label: 'Status unknown' };
  return (
    <div className="flex items-center justify-between px-7 py-4 text-[11px] text-[#6b6b6b]">
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
        {tone.label}
      </div>
      <div className="hidden font-medium uppercase tracking-[0.15em] sm:block">
        Trusted by teams worldwide
      </div>
    </div>
  );
}

// ── Page assembly ───────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-slate-50 font-sans text-black">
      <div className="mx-auto max-w-6xl overflow-hidden">
        <Navbar />
        <main className="px-7 pb-6 pt-9">
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1.1fr_1fr]">
            <HeroLeft />
            <FeatureGrid />
          </div>
        </main>
        <StatsStrip />
        <StatusStrip />
      </div>
    </div>
  );
}
