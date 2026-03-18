'use client';

import React from 'react';
import { NavItem } from '@/types';

interface MobileBottomNavProps {
  activeTab: NavItem;
  onChange: (tab: NavItem) => void;
  unreadMessages?: number;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ activeTab, onChange, unreadMessages = 0 }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[120] border-t border-brand-divider bg-brand-card/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden">
      <ul className="grid grid-cols-5 gap-1">
        {/* Home */}
        <li>
          <button
            type="button"
            onClick={() => onChange('Home')}
            className={`flex w-full flex-col items-center justify-center gap-1 px-1 py-2 transition-all ${activeTab === 'Home' ? 'text-brand-text' : 'text-brand-text/40'}`}
            aria-label="Home"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="truncate text-[9px] font-black uppercase tracking-wide">Home</span>
          </button>
        </li>

        {/* Flicks */}
        <li>
          <button
            type="button"
            onClick={() => onChange('Flicks')}
            className={`flex w-full flex-col items-center justify-center gap-1 px-1 py-2 transition-all ${activeTab === 'Flicks' ? 'text-brand-text' : 'text-brand-text/40'}`}
            aria-label="Flicks"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="truncate text-[9px] font-black uppercase tracking-wide">Flicks</span>
          </button>
        </li>

        {/* Create (center, elevated) */}
        <li className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => onChange('Create')}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-text text-brand-bg shadow-lg transition-transform active:scale-95"
            aria-label="Create"
          >
            <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </li>

        {/* Messenger */}
        <li>
          <button
            type="button"
            onClick={() => onChange('Messenger')}
            className={`relative flex w-full flex-col items-center justify-center gap-1 px-1 py-2 transition-all ${activeTab === 'Messenger' ? 'text-brand-text' : 'text-brand-text/40'}`}
            aria-label="Messenger"
          >
            <div className="relative">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {unreadMessages > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {unreadMessages > 99 ? '99+' : unreadMessages}
                </span>
              )}
            </div>
            <span className="truncate text-[9px] font-black uppercase tracking-wide">Messenger</span>
          </button>
        </li>

        {/* Profile */}
        <li>
          <button
            type="button"
            onClick={() => onChange('Profile')}
            className={`flex w-full flex-col items-center justify-center gap-1 px-1 py-2 transition-all ${activeTab === 'Profile' ? 'text-brand-text' : 'text-brand-text/40'}`}
            aria-label="Profile"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="truncate text-[9px] font-black uppercase tracking-wide">Profile</span>
          </button>
        </li>
      </ul>
    </nav>
  );
};

export default MobileBottomNav;
