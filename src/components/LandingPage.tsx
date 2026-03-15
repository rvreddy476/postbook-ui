'use client';

import React from 'react';
import { LandingBackground } from '@/components/landing/background';
import { LandingHero } from '@/components/landing/hero';
import { LandingNavbar } from '@/components/landing/landing-navbar';

export default function LandingPage() {
  return (
    <div className="relative h-screen overflow-hidden bg-background font-sans text-foreground selection:bg-[#D8103F]/20 selection:text-[#6b081f]">
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
