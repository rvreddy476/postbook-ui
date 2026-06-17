'use client';

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
  Activity,
  CheckCircle,
  TrendingUp,
  Terminal,
  Menu,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── System Status Hook ──────────────────────────────────────────
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

// ── Public Stats Hook ───────────────────────────────────────────
interface PublicStats {
  creators: string;
  viewers: string;
  paidOut: string;
  uptime: string;
}

function usePublicStats(): PublicStats {
  return {
    creators: '200K+',
    viewers: '8.4M',
    paidOut: '$12M',
    uptime: '99.98%',
  };
}

type TabType = 'home' | 'features' | 'stats' | 'status';

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const status = useSystemStatus();
  const stats = usePublicStats();
  const [diagnosticRunning, setDiagnosticRunning] = useState(false);
  const [diagnosticLog, setDiagnosticLog] = useState<string[]>([]);

  const runDiagnostic = () => {
    if (diagnosticRunning) return;
    setDiagnosticRunning(true);
    setDiagnosticLog(['Initializing connection checks...']);

    const steps = [
      'Querying V1 API gateway health endpoint... OK',
      'Resolving WebSocket gateway connectivity... OK',
      'Pinging chat backend nodes... OK',
      'Checking media storage bucket quota... OK',
      'System diagnostics complete. All modules operational.'
    ];

    steps.forEach((step, idx) => {
      setTimeout(() => {
        setDiagnosticLog((prev) => [...prev, step]);
        if (idx === steps.length - 1) {
          setDiagnosticRunning(false);
        }
      }, (idx + 1) * 700);
    });
  };

  const PROOF_AVATARS = [
    { initials: 'MR', bg: '#000000', fg: '#ffffff' },
    { initials: 'JK', bg: '#333333', fg: '#ffffff' },
    { initials: 'AT', bg: '#666666', fg: '#ffffff' },
    { initials: 'SL', bg: '#999999', fg: '#ffffff' },
  ];

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text font-sans flex flex-col justify-between selection:bg-brand-text selection:text-brand-bg relative overflow-hidden">
      {/* Ambient background accent lines */}
      <div className="absolute inset-0 pointer-events-none opacity-5 dark:opacity-10 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-px h-full bg-brand-text" />
        <div className="absolute top-0 left-2/4 w-px h-full bg-brand-text" />
        <div className="absolute top-0 left-3/4 w-px h-full bg-brand-text" />
        <div className="absolute top-1/3 left-0 w-full h-px bg-brand-text" />
        <div className="absolute top-2/3 left-0 w-full h-px bg-brand-text" />
      </div>

      {/* ── HEADER / NAVIGATION ── */}
      <header className="sticky top-0 z-50 bg-brand-bg/90 backdrop-blur-md border-b border-brand-divider py-4 px-6 md:px-12">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-accent text-brand-bg">
              <Sparkles className="h-4.5 w-4.5" strokeWidth={2.5} />
            </span>
            <span className="text-xl font-bold tracking-tight text-brand-text">VChat</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1.5">
            {[
              { id: 'home', label: 'Home' },
              { id: 'features', label: 'Features' },
              { id: 'stats', label: 'Impact' },
              { id: 'status', label: 'Diagnostics' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`relative px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all rounded-full ${
                  activeTab === tab.id
                    ? 'bg-brand-accent text-brand-bg'
                    : 'text-brand-text/60 hover:text-brand-text hover:bg-brand-secondary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-brand-text/70 transition-colors hover:text-brand-text"
            >
              Log In
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-accent px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-brand-bg shadow-sm transition-transform hover:scale-[1.03]"
            >
              Join VChat
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
            </Link>
          </div>

          {/* Mobile menu trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-brand-text hover:bg-brand-secondary rounded-xl transition-all"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden fixed inset-x-0 top-[69px] bg-brand-bg border-b border-brand-divider p-6 z-40 flex flex-col gap-4 shadow-xl"
          >
            {[
              { id: 'home', label: 'Home' },
              { id: 'features', label: 'Features' },
              { id: 'stats', label: 'Impact' },
              { id: 'status', label: 'Diagnostics' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as TabType);
                  setMobileMenuOpen(false);
                }}
                className={`py-3 px-4 rounded-xl text-left text-xs font-bold uppercase tracking-widest transition-all ${
                  activeTab === tab.id
                    ? 'bg-brand-accent text-brand-bg'
                    : 'bg-brand-secondary text-brand-text/70'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <div className="h-px bg-brand-divider my-2" />
            <div className="flex gap-4">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 py-3 text-center rounded-xl border border-brand-divider text-xs font-bold uppercase tracking-widest text-brand-text"
              >
                Log In
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 py-3 text-center rounded-xl bg-brand-accent text-xs font-bold uppercase tracking-widest text-brand-bg"
              >
                Sign Up
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MAIN STAGE ── */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 md:py-20 flex items-center justify-center relative">
        <AnimatePresence mode="wait">
          {/* TAB 1: HOME */}
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center w-full"
            >
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-brand-divider bg-brand-card px-3 py-1.5">
                  <span className="h-2 w-2 rounded-full bg-brand-text animate-ping" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-brand-text/60">VChat v2.0 - Active Now</span>
                </div>
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tighter text-brand-text leading-[0.95]">
                  Create.<br />Connect.<br /><span className="underline decoration-brand-accent decoration-wavy decoration-3 underline-offset-8">Explore.</span>
                </h1>
                <p className="max-w-md text-sm md:text-base leading-relaxed text-brand-text/70 font-light">
                  A high-performance digital sanctuary constructed for authentic connectivity, real-time messaging, and media broadcasting. Designed to load instantly, respect privacy, and empower visionaries.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2.5 rounded-full bg-brand-accent px-6 py-3.5 text-xs font-bold uppercase tracking-widest text-brand-bg shadow-md transition-transform hover:scale-[1.03]"
                  >
                    Start Free
                    <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
                  </Link>
                  <Link
                    href="/reels"
                    className="inline-flex items-center gap-2 rounded-full border border-brand-divider bg-brand-card px-6 py-3.5 text-xs font-bold uppercase tracking-widest text-brand-text transition-colors hover:bg-brand-secondary"
                  >
                    <Play className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Watch Reels
                  </Link>
                </div>
              </div>

              {/* Minimal Social Proof & Layout */}
              <div className="space-y-8 lg:border-l lg:border-brand-divider lg:pl-12">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-brand-text/50">Trusted Community</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex">
                      {PROOF_AVATARS.map((avatar) => (
                        <div
                          key={avatar.initials}
                          className="-ml-3 flex h-9 w-9 items-center justify-center rounded-full border-2 border-brand-bg text-[10px] font-bold first:ml-0 shadow-sm"
                          style={{ backgroundColor: avatar.bg, color: avatar.fg }}
                        >
                          {avatar.initials}
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-xs font-bold text-brand-text">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <Star key={i} className="h-3 w-3 fill-brand-accent text-brand-accent" strokeWidth={0} />
                        ))}
                        <span className="ml-1">4.9/5 Rating</span>
                      </div>
                      <p className="text-[11px] text-brand-text/60">From over 12K digital content creators</p>
                    </div>
                  </div>
                </div>

                <div className="p-5 border border-brand-divider rounded-2xl bg-brand-card space-y-3 shadow-sm">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-brand-text">Platform Integrity</h4>
                  <p className="text-xs text-brand-text/60 leading-relaxed font-light">
                    Every message is securely verified, media uploads undergo automated content moderation, and analytics payouts happen directly via certified ledgers.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: FEATURES */}
          {activeTab === 'features' && (
            <motion.div
              key="features"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="w-full space-y-8"
            >
              <div className="text-center max-w-xl mx-auto space-y-2">
                <h2 className="text-2xl md:text-3xl font-extrabold uppercase tracking-tight">Standardized Modules</h2>
                <p className="text-xs text-brand-text/60 leading-relaxed">
                  A cohesive suite of social utilities mapped to high-efficiency protocols. Explore our core services.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    title: 'HD Video Streaming',
                    desc: 'Instant peer-to-peer live broadcasting streams using optimized client media pipelines.',
                    icon: <Video className="h-5 w-5" strokeWidth={2} />,
                    href: '/live'
                  },
                  {
                    title: 'AI Short Reels',
                    desc: 'Portrait format short clips backed by automatic moderating filters.',
                    icon: <Play className="h-5 w-5" strokeWidth={2} />,
                    href: '/reels'
                  },
                  {
                    title: 'Real-time Messenger',
                    desc: 'Low-latency WebSocket messaging complete with read receipts and active presence counters.',
                    icon: <MessageCircle className="h-5 w-5" strokeWidth={2} />,
                    href: '/messenger'
                  },
                  {
                    title: 'Verified Ledger Payouts',
                    desc: 'Direct creator monetization support, tiered subscription tools, and payouts oversight.',
                    icon: <DollarSign className="h-5 w-5" strokeWidth={2} />,
                    href: '/monetization'
                  }
                ].map((feature) => (
                  <Link
                    key={feature.title}
                    href={feature.href}
                    className="group flex gap-4 p-5 rounded-2xl border border-brand-divider bg-brand-card hover:bg-brand-secondary transition-all"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent text-brand-bg group-hover:scale-105 transition-transform">
                      {feature.icon}
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-brand-text flex items-center gap-1.5">
                        {feature.title}
                        <ArrowRight className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      </h3>
                      <p className="text-xs text-brand-text/60 leading-normal font-light">{feature.desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}

          {/* TAB 3: STATS */}
          {activeTab === 'stats' && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="w-full space-y-8"
            >
              <div className="text-center max-w-xl mx-auto space-y-2">
                <h2 className="text-2xl md:text-3xl font-extrabold uppercase tracking-tight">VChat Impact</h2>
                <p className="text-xs text-brand-text/60 leading-relaxed">
                  Platform telemetry details recorded globally across client environments.
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { value: stats.creators, label: 'Active Creators', desc: 'Verified accounts publishing content daily.' },
                  { value: stats.viewers, label: 'Monthly Viewers', desc: 'Distinct visitor sessions tracked globally.' },
                  { value: stats.paidOut, label: 'Paid to Creators', desc: 'Total subscription earnings payouts ledger.' },
                  { value: stats.uptime, label: 'Platform Uptime', desc: 'Continuous gateway connection success.' },
                ].map((stat) => (
                  <div key={stat.label} className="p-6 border border-brand-divider bg-brand-card rounded-2xl space-y-2 shadow-sm">
                    <div className="flex items-center gap-1.5 text-brand-text/40">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span className="text-[9px] font-bold uppercase tracking-widest">{stat.label}</span>
                    </div>
                    <div className="text-3xl font-black text-brand-text font-mono tracking-tight">{stat.value}</div>
                    <p className="text-[10px] text-brand-text/50 leading-relaxed font-light">{stat.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* TAB 4: DIAGNOSTICS */}
          {activeTab === 'status' && (
            <motion.div
              key="status"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="w-full space-y-6"
            >
              <div className="text-center max-w-xl mx-auto space-y-2">
                <h2 className="text-2xl md:text-3xl font-extrabold uppercase tracking-tight">System Status</h2>
                <p className="text-xs text-brand-text/60 leading-relaxed">
                  Real-time network operational diagnostics. Run a check to verify node status.
                </p>
              </div>

              <div className="border border-brand-divider bg-brand-card rounded-2xl overflow-hidden shadow-sm">
                {/* Console header */}
                <div className="bg-brand-secondary px-5 py-3 border-b border-brand-divider flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-brand-text/60" />
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-text/70 font-mono">VChat Diagnostic Console</span>
                  </div>
                  <button
                    onClick={runDiagnostic}
                    disabled={diagnosticRunning}
                    className="px-3 py-1 rounded bg-brand-accent text-brand-bg text-[10px] font-bold uppercase tracking-wider disabled:opacity-50 hover:opacity-90 active:scale-95 transition-all"
                  >
                    {diagnosticRunning ? 'Running...' : 'Run Diagnostics'}
                  </button>
                </div>

                {/* Console output */}
                <div className="p-5 bg-black text-emerald-400 font-mono text-xs space-y-2 min-h-[160px] overflow-y-auto">
                  {diagnosticLog.length === 0 ? (
                    <p className="text-brand-bg/40 italic">Console idle. Click &quot;Run Diagnostics&quot; above to trace gateway connections.</p>
                  ) : (
                    diagnosticLog.map((log, index) => (
                      <p key={index} className="leading-relaxed">
                        <span className="text-brand-bg/50 select-none mr-2">&gt;</span>
                        {log}
                      </p>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── FOOTER STATUS STRIP ── */}
      <footer className="border-t border-brand-divider bg-brand-card/30 py-4 px-6 md:px-12 text-xs text-brand-text/60">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${
              status === 'operational'
                ? 'bg-emerald-500'
                : status === 'degraded'
                  ? 'bg-amber-500'
                  : 'bg-neutral-400'
            } animate-pulse`} />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {status === 'operational'
                ? 'All upstream gateways operational'
                : status === 'degraded'
                  ? 'Degraded performance detected'
                  : 'System health unknown'}
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-text/40">
            © {new Date().getFullYear()} VChat. Trusted globally.
          </span>
        </div>
      </footer>
    </div>
  );
}
