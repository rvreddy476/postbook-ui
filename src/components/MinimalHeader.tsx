'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMyProfile } from '@/hooks/useEditProfile';
import { searchUsers } from '@/services/userService';

interface MinimalHeaderProps {
    currentUser: User;
}

const MinimalHeader: React.FC<MinimalHeaderProps> = ({ currentUser }) => {
    const router = useRouter();
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const mobileSearchRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    const { data: profile } = useMyProfile();

    const avatarSrc = profile?.avatar_media_id
        ? `/v1/media/${profile.avatar_media_id}/serve`
        : currentUser.avatar;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                searchRef.current && !searchRef.current.contains(event.target as Node) &&
                (!mobileSearchRef.current || !mobileSearchRef.current.contains(event.target as Node))
            ) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearchChange = useCallback((value: string) => {
        setSearchQuery(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!value.trim()) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }
        setShowResults(true);
        setIsSearching(true);
        debounceRef.current = setTimeout(async () => {
            const results = await searchUsers(value, 8);
            setSearchResults(results);
            setIsSearching(false);
        }, 300);
    }, []);

    const handleSelectUser = (user: User) => {
        const target = user.username || user.id;
        router.push(`/u/${target}`);
        setSearchQuery('');
        setSearchResults([]);
        setShowResults(false);
        setIsSearchOpen(false);
    };

    const renderSearchResults = () => {
        if (!showResults || !searchQuery.trim()) return null;

        return (
            <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] border border-slate-100 overflow-hidden z-[200]"
            >
                {isSearching ? (
                    <div className="px-4 py-6 flex flex-col items-center gap-2">
                        <div className="w-5 h-5 border-2 border-violet-300 border-t-transparent rounded-full animate-spin" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Searching...</span>
                    </div>
                ) : searchResults.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">No users found</p>
                    </div>
                ) : (
                    <div className="py-1.5 max-h-[320px] overflow-y-auto">
                        {searchResults.map(user => (
                            <button
                                key={user.id}
                                onClick={() => handleSelectUser(user)}
                                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
                            >
                                <div className="w-9 h-9 rounded-xl overflow-hidden border border-slate-100 flex-shrink-0">
                                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[12px] font-bold text-slate-900 truncate">{user.name}</p>
                                    {user.username && (
                                        <p className="text-[10px] text-slate-400 font-medium truncate">@{user.username}</p>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </motion.div>
        );
    };

    return (
        <header className="fixed top-0 w-full z-[100] h-16 bg-white/70 backdrop-blur-3xl border-b border-slate-100 px-4 sm:px-10 flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
            {/* Logo */}
            <div className="flex items-center gap-3">
                <Link href="/">
                    <div className="flex items-center gap-3 cursor-pointer group">
                        <div className="w-9 h-9 orchid-gradient rounded-[0.7rem] flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:scale-105 group-hover:rotate-6 transition-all duration-500">
                            <span className="text-white font-black text-base tracking-tighter">PB</span>
                        </div>
                        <span className="text-xl font-black text-slate-950 tracking-tighter hidden sm:block italic">PostBoek.com</span>
                    </div>
                </Link>
            </div>

            {/* Desktop Search */}
            <div className="flex-1 max-w-lg mx-4 sm:mx-8 hidden md:flex items-center" ref={searchRef}>
                <div className="relative flex-1 group">
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={e => handleSearchChange(e.target.value)}
                        onFocus={() => { if (searchQuery.trim()) setShowResults(true); }}
                        className="w-full bg-slate-50/50 border border-slate-100/50 rounded-2xl py-2.5 px-11 text-[10px] font-black uppercase tracking-[0.2em] outline-none focus:ring-4 focus:ring-violet-500/5 focus:bg-white focus:border-violet-200 transition-all shadow-inner placeholder:text-slate-300 italic"
                    />
                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-violet-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    {searchQuery && (
                        <button
                            onClick={() => { setSearchQuery(''); setSearchResults([]); setShowResults(false); }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 transition-colors"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    )}
                    <AnimatePresence>
                        {renderSearchResults()}
                    </AnimatePresence>
                </div>
            </div>

            {/* Right side: mobile search toggle + profile */}
            <div className="flex items-center gap-2">
                {/* Mobile Search Toggle */}
                <button
                    onClick={() => setIsSearchOpen(!isSearchOpen)}
                    className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </button>

                {/* Profile Avatar */}
                <Link href="/profile">
                    <button className="w-9 h-9 rounded-xl overflow-hidden border-2 border-white shadow-lg hover:ring-4 hover:ring-violet-500/10 transition-all duration-300 hover:scale-105 active:scale-95">
                        <img src={avatarSrc} alt={currentUser.name} className="w-full h-full object-cover" />
                    </button>
                </Link>
            </div>

            {/* Mobile Search Panel */}
            <AnimatePresence>
                {isSearchOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -60 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -60 }}
                        className="fixed top-16 left-0 w-full px-4 py-3 bg-white border-b border-slate-100 z-[90] md:hidden"
                        ref={mobileSearchRef}
                    >
                        <div className="relative">
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={e => handleSearchChange(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-2.5 px-11 text-xs font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-violet-500/10 transition-all"
                            />
                            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            {searchQuery && (
                                <button
                                    onClick={() => { setSearchQuery(''); setSearchResults([]); setShowResults(false); }}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 transition-colors"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            )}
                            <AnimatePresence>
                                {renderSearchResults()}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
};

export default MinimalHeader;
