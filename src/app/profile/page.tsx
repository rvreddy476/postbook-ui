'use client';

import React, { useEffect, useState } from 'react';
import MinimalHeader from '@/components/MinimalHeader';
import Sidebar from '@/components/Sidebar';
import { ProfilePage } from '@/components/profile/ProfilePage';
import { getSession, logoutUser } from '@/services/authService';
import { User, NavItem } from '@/types';
import { useRouter } from 'next/navigation';

export default function ProfileRoute() {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isSessionLoaded, setIsSessionLoaded] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const user = getSession();
        if (user) {
            setCurrentUser(user);
        } else {
            router.push('/');
        }
        setIsSessionLoaded(true);
    }, [router]);

    if (!isSessionLoaded || !currentUser) {
        return <div className="min-h-screen bg-[#fcfaff]" />;
    }

    const handleLogout = () => {
        logoutUser();
        router.push('/login');
    };

    const handleSetActiveTab = (tab: NavItem) => {
        if (tab === 'Reels') router.push('/?tab=reels');
        else if (tab === 'TV') router.push('/?tab=tv');
        else router.push('/');
    };

    return (
        <div className="min-h-screen bg-[#fcfaff] font-sans selection:bg-rose-100 selection:text-rose-900">
            <MinimalHeader currentUser={currentUser} onLogout={handleLogout} />

            <div className="flex pt-16">
                {/* Left Sidebar */}
                <div className="hidden md:flex fixed top-16 left-0 h-[calc(100vh-4rem)] z-[90]">
                    <Sidebar activeTab="Profile" setActiveTab={handleSetActiveTab} />
                </div>

                {/* Main Content */}
                <main className="flex-1 md:ml-[72px] pb-12 overflow-y-auto h-screen scrollbar-hide">
                    <div className="max-w-5xl mx-auto">
                        <ProfilePage username={currentUser.id} platform="postboek" />
                    </div>
                </main>
            </div>
        </div>
    );
}
