'use client';

import { NavItem } from '../types';
import { motion } from 'framer-motion';
import Link from 'next/link';

interface SidebarProps {
  activeTab: NavItem;
  setActiveTab: (tab: NavItem) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { label: 'Home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', href: '/' },
    { label: 'TV', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', href: '/posttube', newTab: true },
    { label: 'Reels', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z' },

    { label: 'My Circle', icon: 'M18 18.72a9.094 9.094 0 003.741-2.461m0 0A9 9 0 0012 3a9 9 0 00-9.741 13.259m0 0A9.094 9.094 0 006 18.72m12 0a8.966 8.966 0 01-6 2.28 8.966 8.966 0 01-6-2.28m12 0a5.97 5.97 0 00-6-2.28 5.97 5.97 0 00-6 2.28M15 9a3 3 0 11-6 0 3 3 0 016 0z', href: '/circle' },
    { label: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', href: '/profile' }
  ];

  return (
    <nav className="w-[72px] flex flex-col items-center bg-white border-r border-slate-100 py-8 gap-6 z-[100] h-full shadow-[2px_0_10px_rgba(0,0,0,0.01)]">
      {navItems.map((item) => {
        const isActive = activeTab === item.label;
        const IconContent = (
          <div className={`p-3 rounded-xl transition-all duration-300 relative group flex flex-col items-center justify-center cursor-pointer ${isActive ? 'text-violet-600' : 'text-slate-400 hover:text-slate-900'}`}>
            <div className="w-5 h-5 flex items-center justify-center transition-transform group-hover:scale-110">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
            </div>

            {/* Tooltip on hover */}
            <span className="absolute left-16 bg-slate-900 text-white text-[10px] px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-[-10px] group-hover:translate-x-0 font-black uppercase tracking-widest italic z-[200]">
              {item.label}
            </span>

            {isActive && (
              <motion.div
                layoutId="sidebar-active"
                className="absolute -left-4 w-1 h-6 orchid-gradient rounded-r-full"
              />
            )}
          </div>
        );

        if (item.href) {
          return (
            <Link
              key={item.label}
              href={item.href}
              title={item.label}
              target={(item as { newTab?: boolean }).newTab ? "_blank" : undefined}
              rel={(item as { newTab?: boolean }).newTab ? "noopener noreferrer" : undefined}
            >
              {IconContent}
            </Link>
          );
        }

        return (
          <button
            key={item.label}
            onClick={() => setActiveTab(item.label as NavItem)}
            title={item.label}
          >
            {IconContent}
          </button>
        );
      })}
    </nav>
  );
};

export default Sidebar;