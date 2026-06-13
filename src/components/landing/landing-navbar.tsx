'use client';

import React from 'react';
import Link from 'next/link';

export function LandingNavbar() {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <nav className="fixed top-0 z-50 h-20 w-full border-b border-brand-divider px-4 backdrop-blur-2xl sm:px-8">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between">
        <Link href="/" className="group flex cursor-pointer items-center gap-3 sm:gap-4">
          <span className="text-2xl font-black tracking-tighter text-brand-text">&#10022; VChat</span>
        </Link>
        
        {/* Desktop Navigation */}
        <div className="hidden items-center gap-8 md:flex">
          <Link href="/commerce" className="text-xs font-bold uppercase tracking-[0.25em] text-brand-text/60 transition-all hover:text-brand-text">
            Sell on VChat
          </Link>
          <Link href="/login" className="text-xs font-bold uppercase tracking-[0.25em] text-brand-text/60 transition-all hover:text-brand-text">
            Log In
          </Link>
          <Link
            href="/register"
            className="rounded-2xl bg-brand-accent px-8 py-3 text-[10px] font-black uppercase tracking-widest text-brand-bg shadow-2xl transition-all hover:opacity-90 active:scale-95"
          >
            Sign Up
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-secondary/50 text-brand-text md:hidden"
          aria-label="Toggle Menu"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
          </svg>
        </button>
      </div>

      {/* Mobile Navigation Dropdown */}
      {isOpen && (
        <div className="absolute left-0 top-20 w-full border-b border-brand-divider bg-brand-bg/95 p-6 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-6">
            <Link
              href="/commerce"
              onClick={() => setIsOpen(false)}
              className="text-sm font-bold uppercase tracking-[0.2em] text-brand-text"
            >
              Sell on VChat
            </Link>
            <Link
              href="/login"
              onClick={() => setIsOpen(false)}
              className="text-sm font-bold uppercase tracking-[0.2em] text-brand-text"
            >
              Log In
            </Link>
            <Link
              href="/register"
              onClick={() => setIsOpen(false)}
              className="rounded-2xl bg-brand-accent px-8 py-4 text-center text-[10px] font-black uppercase tracking-widest text-brand-bg shadow-lg"
            >
              Sign Up Free
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
