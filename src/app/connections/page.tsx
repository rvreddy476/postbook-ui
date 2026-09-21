'use client'

import React from 'react'
import AppShell from '@/components/AppShell'
import FriendsView from '@/components/connections/FriendsView'

/**
 * Connections.
 *
 * On AppShell like the other 63 pages, not MinimalHeader. Three pages
 * (this one, /profile and /u/[username]) carried a different header with
 * its own sidebar, its own session handling and its own logout — which is
 * why the header visibly changed when you navigated here. AppShell owns
 * the session check and the redirect, so all of that is gone from here.
 */
export default function ConnectionsPage() {
    return (
        <AppShell activeTab="Circle">
            <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
                <FriendsView />
            </div>
        </AppShell>
    )
}
