'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Globe, Users, Lock, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type PostVisibility = 'public' | 'followers' | 'private';

const VIS_OPTIONS: { id: PostVisibility; icon: React.ReactNode; label: string; sub: string }[] = [
  { id: 'public', icon: <Globe className="w-3.5 h-3.5" />, label: 'Public', sub: 'Anyone on Postbook' },
  { id: 'followers', icon: <Users className="w-3.5 h-3.5" />, label: 'Followers', sub: 'People who follow you' },
  { id: 'private', icon: <Lock className="w-3.5 h-3.5" />, label: 'Only me', sub: 'Save as private draft' },
];

interface VisibilityDropdownProps {
  value: PostVisibility;
  onChange: (v: PostVisibility) => void;
  accentColor: string;
  isDarkMode?: boolean;
}

const VisibilityDropdown: React.FC<VisibilityDropdownProps> = ({
  value,
  onChange,
  accentColor,
  isDarkMode = false,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const current = VIS_OPTIONS.find((v) => v.id === value)!;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-medium transition-all ${
          isDarkMode
            ? 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
        }`}
      >
        <span style={{ color: accentColor }}>{current.icon}</span>
        {current.label}
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 mt-2 w-56 rounded-2xl border p-1.5 z-50"
            style={{
              background: isDarkMode ? '#0F172A' : '#FFFFFF',
              borderColor: isDarkMode ? 'rgba(148,163,184,0.25)' : '#E2E8F0',
              boxShadow: isDarkMode ? '0 10px 40px rgba(2,6,23,0.45)' : '0 14px 34px rgba(15,23,42,0.12)',
            }}
          >
            {VIS_OPTIONS.map((v) => (
              <button
                key={v.id}
                onClick={() => { onChange(v.id); setOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                style={{
                  background: value === v.id ? `${accentColor}26` : (isDarkMode ? 'transparent' : '#FFFFFF'),
                }}
              >
                <span style={{ color: value === v.id ? accentColor : (isDarkMode ? '#94A3B8' : '#64748B') }}>
                  {v.icon}
                </span>
                <div>
                  <p
                    className="text-[11px] font-semibold"
                    style={{ color: value === v.id ? (isDarkMode ? '#F8FAFC' : '#0F172A') : (isDarkMode ? '#CBD5E1' : '#334155') }}
                  >
                    {v.label}
                  </p>
                  <p className={`text-[9px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{v.sub}</p>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VisibilityDropdown;
