'use client';

import React from 'react';
import Link from 'next/link';

export function LandingNavbar() {
  return (
    <nav className="fixed top-0 z-50 h-20 w-full border-b border-white/60 bg-white/40 px-4 backdrop-blur-2xl sm:px-8">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between">
        <Link href="/" className="group flex cursor-pointer items-center gap-3 sm:gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-700 shadow-2xl shadow-violet-500/30 ring-1 ring-white/50 transition-all duration-500 group-hover:scale-110 sm:h-12 sm:w-12">
            <span className="text-white font-black text-lg sm:text-xl tracking-tighter">PB</span>
          </div>
          <span className="text-2xl font-black tracking-tighter text-slate-950 sm:text-3xl">PostBoek.com</span>
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          <Link href="/login" className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500 transition-all hover:text-violet-600">
            Log In
          </Link>
          <Link
            href="/register"
            className="rounded-2xl bg-slate-950 px-8 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-2xl transition-all hover:bg-black active:scale-95"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </nav>
  );
}
