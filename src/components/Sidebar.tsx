'use client';

import { NavItem } from '../types';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Home, Users } from 'lucide-react';

interface SidebarProps {
  activeTab: NavItem;
  setActiveTab: (tab: NavItem) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { label: 'Home', icon: Home, href: '/' },
    { label: 'My Circle', icon: Users, href: '/circle', isSpecial: true }
  ];

  return (
    <nav className="w-[72px] flex flex-col items-center bg-white border-r border-slate-100 py-8 gap-6 z-[100] h-full shadow-[2px_0_10px_rgba(0,0,0,0.01)]">
      {navItems.map((item) => {
        const isActive = activeTab === item.label;
        const isSpecial = (item as { isSpecial?: boolean }).isSpecial;
        const Icon = item.icon;

        const baseColor = isSpecial
          ? (isActive ? 'text-indigo-600 bg-indigo-50 shadow-sm ring-1 ring-indigo-100' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50')
          : (isActive ? 'text-slate-800 bg-slate-100' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50');

        const IconContent = (
          <div className={`p-3.5 rounded-2xl transition-all duration-300 relative group flex flex-col items-center justify-center cursor-pointer ${baseColor}`}>
            <div className={`w-6 h-6 flex items-center justify-center transition-transform ${isSpecial ? 'group-hover:scale-110' : 'group-hover:-translate-y-1'}`}>
              <Icon className="w-6 h-6" strokeWidth={isSpecial ? 2.5 : 2} />
            </div>

            {/* Tooltip on hover */}
            <span className="absolute left-16 text-[11px] px-3.5 py-2 rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-[-10px] group-hover:translate-x-0 font-extrabold shadow-lg z-[200] bg-slate-900 text-white whitespace-nowrap">
              {item.label}
            </span>

            {isActive && !isSpecial && (
              <motion.div
                layoutId="sidebar-active"
                className="absolute -left-4 w-1 h-8 bg-slate-800 rounded-r-full"
              />
            )}
            {isActive && isSpecial && (
              <motion.div
                layoutId="sidebar-active-special"
                className="absolute -left-4 w-1.5 h-10 bg-indigo-500 rounded-r-full shadow-[0_0_12px_rgba(99,102,241,0.6)]"
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