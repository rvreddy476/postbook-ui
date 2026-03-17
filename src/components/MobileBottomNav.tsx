'use client';

import React from 'react';
import { NavItem } from '@/types';

interface MobileBottomNavProps {
  activeTab: NavItem;
  onChange: (tab: NavItem) => void;
}

const ITEMS: Array<{ label: NavItem; icon: string }> = [
  { label: 'Home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { label: 'Reels', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z' },
  { label: 'TV', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { label: 'Friends', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { label: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
];

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ activeTab, onChange }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[120] border-t border-brand-divider bg-brand-card/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden">
      <ul className="grid grid-cols-5 gap-1">
        {ITEMS.map((item) => {
          const isActive = item.label === activeTab;
          return (
            <li key={item.label}>
              <button
                type="button"
                onClick={() => onChange(item.label)}
                className={`flex w-full flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 transition-all ${isActive ? 'bg-[#D8103F]/5 text-[#D8103F]' : 'text-brand-text/60'
                  }`}
                aria-label={item.label}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                <span className="truncate text-[9px] font-black uppercase tracking-wide">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default MobileBottomNav;
