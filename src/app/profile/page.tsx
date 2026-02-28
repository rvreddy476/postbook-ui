'use client';

import React, { useEffect, useState } from 'react';
import Header from '@/components/Header';
import { ProfilePage } from '@/components/profile/ProfilePage';
import { getSession } from '@/services/authService';
import { User } from '@/types';
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

    return (
        <div className="min-h-screen bg-[#fcfaff] font-sans selection:bg-rose-100 selection:text-rose-900">
            <Header
                currentUser={currentUser}
                activeTab="Profile"
                setActiveTab={() => { }}
                onCreateClick={() => { }}
                onLogout={() => {
                    window.location.href = '/';
                }}
                onToggleContactList={() => { }}
            />

            <main className="pt-24 pb-12 overflow-y-auto h-screen scrollbar-hide">
                <div className="max-w-5xl mx-auto">
                    <ProfilePage username={currentUser.id} platform="postboek" />
                </div>
            </main>
        </div>
    );
}
