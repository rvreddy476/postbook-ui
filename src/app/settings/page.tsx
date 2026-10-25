"use client"

import AppShell from '@/components/AppShell'
import { logoutUser } from "@/services/authService"
import { SettingsHub } from "./_components/SettingsHub"
import "./_components/settings-hub.css"

/*
  Settings & privacy: the second level behind the More panel's one row
  (founder, 17 Oct). Grouped cards (SETTINGS_GROUPS in _lib/settingsHub.ts);
  each row opens its own page. AppShell keeps the sign-in gate it always had.

  What the old index held, and where it went: its links are rows here;
  its inline "Download My Data" button duplicated /settings/data (the same
  /v1/auth/data-export download as my-data.json), so it is reached through
  the "Your data" row; Mini apps and Report a problem keep their rows.
*/

/** Exactly the flow the More panel used (logoutUser, then the server route). */
function logout() {
    logoutUser()
    window.location.assign("/api/auth/logout")
}

export default function SettingsPage() {
    return (
        <AppShell>
            <div className="settings-hub">
                <div className="settings-hub__inner">
                    <h1 className="settings-hub__title">Settings &amp; privacy</h1>
                    <SettingsHub onLogout={logout} />
                </div>
            </div>
        </AppShell>
    )
}
