'use client';

import React from 'react';
import Link from 'next/link';

type FeatureColor = 'blue' | 'rose' | 'amber' | 'emerald';

interface FeatureCardProps {
  title: string;
  desc: string;
  color: FeatureColor;
  href: string;
  icon: React.ReactNode;
}

export function LandingHero() {
  return (
    <div className="grid h-full items-center gap-6 animate-fadeIn lg:grid-cols-2 lg:gap-10">
      <div className="space-y-5 text-center lg:text-left">
        <h1 className="text-4xl font-black leading-[0.9] tracking-tighter text-brand-text sm:text-5xl xl:text-6xl">
          Create. <br />
          <span className="bg-gradient-to-r from-brand-text via-brand-accent to-brand-text bg-clip-text text-transparent">Connect. Explore.</span>
        </h1>
        <p className="mx-auto max-w-xl text-base font-medium leading-relaxed text-brand-highlight lg:mx-0 lg:text-lg">
          The infinite network for the modern visionary. Experience a classic digital sanctuary designed for authentic
          connection and global discovery.
        </p>

        {/* Commerce CTA */}
        <Link
          href="/commerce"
          className="inline-flex items-center gap-3 px-5 py-3 bg-brand-card border border-brand-divider rounded-2xl text-brand-text text-xs font-black uppercase tracking-widest hover:border-brand-accent transition-all group"
        >
          <span className="text-lg">🛍️</span>
          <span>Sell on VChat</span>
          <svg className="h-3 w-3 text-brand-text/40 group-hover:text-brand-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-6">
        <FeatureCard
          title="Video Stream"
          desc="Go live to your followers with LiveKit-powered HD streaming."
          color="blue"
          href="/live"
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          }
        />
        <FeatureCard
          title="Short Reels"
          desc="Vertical 60-second videos with native AI moderation."
          color="rose"
          href="/reels"
          icon={
            <>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </>
          }
        />
        <FeatureCard
          title="Direct Message"
          desc="Real-time WebSocket chat with read receipts and presence."
          color="amber"
          href="/?tab=Chat"
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          }
        />
        <FeatureCard
          title="Monetize"
          desc="Tiered subscriptions, COD-and-UPI payouts, full earnings ledger."
          color="emerald"
          href="/monetization"
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zM12 1v22M5 5l14 14M19 5L5 14"
            />
          }
        />
      </div>
    </div>
  );
}

function FeatureCard({ title, desc, color, href, icon }: FeatureCardProps) {
  const colorClasses: Record<FeatureColor, { bg: string; shadow: string; hover: string }> = {
    blue: {
      bg: 'from-blue-500 to-blue-700',
      shadow: 'shadow-blue-500/20',
      hover: 'hover:shadow-blue-500/10',
    },
    rose: {
      bg: 'from-rose-500 to-rose-700',
      shadow: 'shadow-rose-500/20',
      hover: 'hover:shadow-rose-500/10',
    },
    amber: {
      bg: 'from-amber-400 to-yellow-600',
      shadow: 'shadow-amber-500/30',
      hover: 'hover:shadow-amber-500/10',
    },
    emerald: {
      bg: 'from-emerald-500 to-teal-600',
      shadow: 'shadow-emerald-500/20',
      hover: 'hover:shadow-emerald-500/10',
    },
  };

  const c = colorClasses[color];

  return (
    <Link
      href={href}
      className={`group block rounded-3xl border border-brand-divider bg-brand-card p-4 shadow-sm backdrop-blur-3xl transition-all duration-500 hover:-translate-y-1 hover:border-brand-accent/50 hover:shadow-2xl ${c.hover}`}
    >
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg transition-transform group-hover:scale-110 ${c.bg} ${c.shadow}`}>
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icon}
        </svg>
      </div>
      <h3 className="mb-1 text-[11px] font-black uppercase tracking-widest text-brand-text">{title}</h3>
      <p className="text-[10px] font-bold leading-tight text-brand-text/60">{desc}</p>
      <div className="mt-3 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.2em] text-brand-text/40 transition-colors group-hover:text-brand-text">
        Open
        <svg className="h-2.5 w-2.5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
