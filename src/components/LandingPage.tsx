'use client';

import React from 'react';
import { LandingBackground } from '@/components/landing/background';
import { LandingHero } from '@/components/landing/hero';
import { LandingNavbar } from '@/components/landing/landing-navbar';

export default function LandingPage() {
  return (
    <div className="relative h-screen overflow-hidden bg-brand-bg font-sans text-brand-text selection:bg-brand-accent/20 selection:text-brand-text">
      <LandingBackground />

      <LandingNavbar />

      <main className="mx-auto mt-20 h-[calc(100vh-5rem)] w-full max-w-7xl px-4 py-4 sm:px-8 sm:py-6">
        <div className="h-full w-full">
          <LandingHero />
        </div>
      </main>
    </div>
  );
}
