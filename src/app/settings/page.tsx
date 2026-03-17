"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
    Shield,
    Bell,
    User,
    Download,
    Loader2,
    ChevronRight,
    Settings,
    Tv,
    Globe,
    Clock,
    BadgeCheck,
    LayoutGrid,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import api from "@/lib/api"

/* ------------------------------------------------------------------ */
/*  Section Card                                                        */
/* ------------------------------------------------------------------ */

function SectionCard({
    icon,
    title,
    description,
    children,
    delay = 0,
}: {
    icon: React.ReactNode
    title: string
    description: string
    children: React.ReactNode
    delay?: number
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="rounded-2xl bg-brand-card border border-[#D8103F]/10 shadow-sm"
        >
            <div className="p-6">
                <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D8103F]/5">
                        {icon}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-bold text-brand-text">{title}</h2>
                        <p className="mt-1 text-sm text-brand-highlight">{description}</p>
                    </div>
                </div>
                <div className="mt-5">{children}</div>
            </div>
        </motion.div>
    )
}

/* ------------------------------------------------------------------ */
/*  Nav Link Row                                                        */
/* ------------------------------------------------------------------ */

function SettingsLink({
    href,
    icon,
    label,
    description,
}: {
    href: string
    icon: React.ReactNode
    label: string
    description: string
}) {
    return (
        <Link
            href={href}
            className="flex items-center gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-[#D8103F]/5 group"
        >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 group-hover:bg-[#D8103F]/10 transition-colors">
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-brand-text">{label}</p>
                <p className="text-xs text-brand-highlight truncate">{description}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-brand-text/60 group-hover:text-[#D8103F]/50 transition-colors shrink-0" />
        </Link>
    )
}

/* ------------------------------------------------------------------ */
/*  GDPR Data Export                                                    */
/* ------------------------------------------------------------------ */

function DataExportSection() {
    const [isDownloading, setIsDownloading] = useState(false)
    const { toast, ToastContainer } = useToast()

    const handleDownload = async () => {
        setIsDownloading(true)
        try {
            const res = await api.get("/v1/auth/data-export")
            const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = "my-data.json"
            a.click()
            URL.revokeObjectURL(url)
            toast({ type: "success", title: "Data export downloaded", description: "Your data has been saved as my-data.json." })
        } catch {
            toast({ type: "error", title: "Export failed", description: "Could not download your data. Please try again." })
        } finally {
            setIsDownloading(false)
        }
    }

    return (
        <>
            <div className="flex items-center justify-between gap-4">
                <div>
                    <p className="text-sm font-semibold text-brand-text">Download My Data</p>
                    <p className="text-xs text-brand-highlight mt-0.5">
                        Export a copy of your account data, posts, and activity as a JSON file.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="shrink-0 border-[#D8103F]/30 text-[#b80d35] hover:bg-[#D8103F]/5"
                >
                    {isDownloading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Downloading...
                        </>
                    ) : (
                        <>
                            <Download className="mr-2 h-4 w-4" />
                            Download
                        </>
                    )}
                </Button>
            </div>
            <ToastContainer />
        </>
    )
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                           */
/* ------------------------------------------------------------------ */

export default function SettingsPage() {
    return (
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
            {/* Page header */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3"
            >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D8103F]/10">
                    <Settings className="h-5 w-5 text-[#D8103F]" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-brand-text">Account Settings</h1>
                    <p className="text-sm text-brand-highlight">Manage your profile, security, and privacy preferences.</p>
                </div>
            </motion.div>

            {/* ------------------------------------------------- */}
            {/*  Navigation Links                                   */}
            {/* ------------------------------------------------- */}
            <SectionCard
                icon={<User className="h-6 w-6 text-[#D8103F]/50" />}
                title="Account"
                description="Update your profile information and appearance."
                delay={0.05}
            >
                <div className="divide-y divide-slate-100 -mx-2">
                    <SettingsLink
                        href="/settings/profile"
                        icon={<User className="h-4 w-4 text-brand-highlight" />}
                        label="Edit Profile"
                        description="Display name, bio, avatar, and cover photo"
                    />
                    <SettingsLink
                        href="/settings/security"
                        icon={<Shield className="h-4 w-4 text-brand-highlight" />}
                        label="Security"
                        description="Password, two-factor authentication, and sessions"
                    />
                    <SettingsLink
                        href="/settings/notifications"
                        icon={<Bell className="h-4 w-4 text-brand-highlight" />}
                        label="Notifications"
                        description="Email, push, and quiet hours preferences"
                    />
                    <SettingsLink
                        href="/settings/channel"
                        icon={<Tv className="h-4 w-4 text-brand-highlight" />}
                        label="Channel Settings"
                        description="Postgram & Posttube channel, handle, branding, and links"
                    />
                    <SettingsLink
                        href="/settings/modules"
                        icon={<Globe className="h-4 w-4 text-brand-highlight" />}
                        label="Module Profiles"
                        description="Per-module identity overrides, handle changes, and cross-post settings"
                    />
                    <SettingsLink
                        href="/settings/wellbeing"
                        icon={<Clock className="h-4 w-4 text-brand-highlight" />}
                        label="Digital Wellbeing"
                        description="Screen time, focus mode & break reminders"
                    />
                    <SettingsLink
                        href="/settings/verification"
                        icon={<BadgeCheck className="h-4 w-4 text-brand-highlight" />}
                        label="Get Verified"
                        description="Apply for a verified badge"
                    />
                    <SettingsLink
                        href="/apps"
                        icon={<LayoutGrid className="h-4 w-4 text-brand-highlight" />}
                        label="Mini Apps"
                        description="Discover and manage mini apps"
                    />
                </div>
            </SectionCard>

            {/* ------------------------------------------------- */}
            {/*  Privacy & Data                                     */}
            {/* ------------------------------------------------- */}
            <SectionCard
                icon={<Download className="h-6 w-6 text-[#D8103F]/50" />}
                title="Privacy & Data"
                description="Control your data and exercise your GDPR rights."
                delay={0.1}
            >
                <DataExportSection />
            </SectionCard>
        </div>
    )
}
