'use client';

import React from 'react';

export function LandingBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-brand-bg" aria-hidden="true">
      <div className="absolute left-[-15%] top-[-25%] h-[70%] w-[70%] rounded-full bg-brand-text/5 blur-[200px]" />
      <div className="absolute bottom-[-25%] right-[-15%] h-[70%] w-[70%] rounded-full bg-brand-text/5 blur-[200px]" />
      <div className="absolute right-[10%] top-[20%] h-[40%] w-[40%] animate-pulse rounded-full bg-brand-text/3 blur-[150px]" />
    </div>
  );
}
