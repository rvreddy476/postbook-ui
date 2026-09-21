'use client';

import React, { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { ProfilePage } from '@/components/profile/ProfilePage';
import { getSession } from '@/services/authService';

/**
 * Your own profile.
 *
 * On AppShell like the rest of the app. This page used to build its own
 * chrome — MinimalHeader, its own Sidebar, its own session check and its
 * own logout — which is why the header visibly changed when you opened
 * your profile. AppShell owns the session check and the redirect, so all
 * of that is gone from here.
 */
export default function ProfileRoute() {
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const sync = () => setUserId(getSession()?.id ?? null);
        sync();
        window.addEventListener('postbook:session-changed', sync);
        return () => window.removeEventListener('postbook:session-changed', sync);
    }, []);

    return (
        <AppShell activeTab="Profile">
            {/* AppShell redirects a signed-out visitor to /login; until the
                session resolves there is nothing to render. */}
            {userId && (
                <div className="mx-auto w-full max-w-5xl pb-12">
                    <ProfilePage username={userId} />
                </div>
            )}
        </AppShell>
    );
}
