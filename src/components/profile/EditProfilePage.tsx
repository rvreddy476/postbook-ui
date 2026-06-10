"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuthUser } from "@/store/auth"
import { useMyProfile, useUpdateProfile, useUpdateAvatar, useUpdateCover } from "@/hooks/useEditProfile"
import { Button } from "@/components/ui/button"
import { BasicInfoSection, type BasicInfoForm } from "./edit/BasicInfoSection"
import { AvatarCoverSection } from "./edit/AvatarCoverSection"
import { SocialLinksSection } from "./edit/SocialLinksSection"
import { AboutSectionsPanel } from "./edit/AboutSectionsPanel"
import { HobbiesInterestsEditor } from "./hobbies/HobbiesInterestsEditor"
import {
    ArrowLeft,
    Loader2,
    Check,
    User,
    Palette,
    Briefcase,
    Lock,
    GraduationCap,
    ChevronRight,
    Target,
    Sparkles
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

type TabType = "identity" | "visual" | "work" | "education" | "interests"

const TABS: { id: TabType; label: string; icon: any; description: string }[] = [
    { id: "identity", label: "Profile", icon: User, description: "Your username and bio" },
    { id: "visual", label: "Photos", icon: Palette, description: "Avatars and cover images" },
    { id: "work", label: "Work", icon: Briefcase, description: "Professional history" },
    { id: "education", label: "Education", icon: GraduationCap, description: "Academic history" },
    { id: "interests", label: "Interests", icon: Sparkles, description: "Hobbies and favorites" },
]

function SectionSkeleton() {
    return (
        <div className="space-y-8 animate-pulse">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="space-y-3">
                        <div className="h-3 w-20 bg-brand-secondary rounded-full" />
                        <div className="h-2 w-32 bg-brand-secondary rounded-full" />
                        <div className="h-12 w-full bg-brand-secondary/50 rounded-2xl border border-brand-divider" />
                    </div>
                ))}
            </div>
        </div>
    )
}

export function EditProfilePage() {
    const router = useRouter()
    const localUser = useAuthUser()
    const { data: profile, isLoading: profileLoading } = useMyProfile()

    const updateProfile = useUpdateProfile()
    const updateAvatar = useUpdateAvatar()
    const updateCover = useUpdateCover()

    const [activeTab, setActiveTab] = useState<TabType>("identity")
    const [saved, setSaved] = useState(false)

    const [form, setForm] = useState<BasicInfoForm>({
        display_name: "",
        username: "",
        first_name: "",
        last_name: "",
        preferred_name: "",
        pronouns: "",
        bio: "",
        profession: "",
        location: "",
        website: "",
        category: "personal",
        gender: "",
        dob: "",
        status_text: "",
        status_emoji: "",
        profile_theme_color: "#1A73E8",
        cta_label: "",
        cta_url: "",
        timezone: "",
    })

    // Sync form when profile loads
    useEffect(() => {
        if (profile) {
            setForm({
                display_name: profile.display_name ?? "",
                username: profile.username ?? "",
                first_name: profile.first_name ?? "",
                last_name: profile.last_name ?? "",
                preferred_name: profile.preferred_name ?? "",
                pronouns: profile.pronouns ?? "",
                bio: profile.bio ?? "",
                profession: profile.profession ?? "",
                location: profile.location ?? "",
                website: profile.website ?? "",
                category: profile.category ?? "personal",
                gender: profile.gender ?? "",
                dob: profile.dob ? profile.dob.split("T")[0] : "",
                status_text: profile.status_text ?? "",
                status_emoji: profile.status_emoji ?? "",
                profile_theme_color: profile.profile_theme_color ?? "#1A73E8",
                cta_label: profile.cta_label ?? "",
                cta_url: profile.cta_url ?? "",
                timezone: profile.timezone ?? "",
            })
        }
    }, [profile])

    const handleFormChange = useCallback((field: keyof BasicInfoForm, value: string) => {
        setForm((prev: BasicInfoForm) => ({ ...prev, [field]: value }))
    }, [])

    const handleSaveProfile = async () => {
        let dob: string | null = null
        if (form.dob) {
            dob = form.dob.includes("T") ? form.dob : `${form.dob}T00:00:00Z`
        }

        await updateProfile.mutateAsync({
            display_name: form.display_name,
            bio: form.bio,
            username: form.username || null,
            first_name: form.first_name || null,
            last_name: form.last_name || null,
            preferred_name: form.preferred_name || null,
            pronouns: form.pronouns || null,
            gender: form.gender || null,
            dob,
            category: form.category || "personal",
            profession: form.profession || null,
            website: form.website || null,
            location: form.location || null,
            status_text: form.status_text || null,
            status_emoji: form.status_emoji || null,
            profile_theme_color: form.profile_theme_color || "#1A73E8",
            cta_label: form.cta_label || null,
            cta_url: form.cta_url || null,
            timezone: form.timezone || null,
        })
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    if (!localUser) return <div className="p-20 text-center text-brand-text/60 font-bold uppercase tracking-widest italic">Authorization Required</div>

    if (profileLoading) return (
        <div className="max-w-6xl mx-auto py-12 px-6">
            <div className="h-20 bg-brand-secondary animate-pulse rounded-3xl mb-8" />
            <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-10">
                <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-brand-secondary animate-pulse rounded-2xl" />)}
                </div>
                <div className="h-[600px] bg-brand-secondary animate-pulse rounded-[2.5rem]" />
            </div>
        </div>
    )

    return (
        <div className="max-w-6xl mx-auto py-10 px-6">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                <div className="flex items-center gap-6">
                    <motion.button
                        whileHover={{ scale: 1.1, x: -5 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => router.back()}
                        className="p-4 bg-brand-card shadow-xl border border-brand-divider rounded-[1.5rem] text-brand-highlight hover:text-brand-text transition-colors"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </motion.button>
                    <div>
                        <h1 className="text-4xl font-black text-brand-text tracking-tighter uppercase italic">
                            Edit <span className="text-brand-highlight">Profile</span>
                        </h1>
                        <p className="text-xs font-bold text-brand-text/60 uppercase tracking-[0.3em] mt-1">Manage your presence and details</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <Button
                        onClick={handleSaveProfile}
                        disabled={updateProfile.isPending}
                        className="h-14 px-8 rounded-[1.5rem] bg-brand-text text-brand-card hover:opacity-90 shadow-xl shadow-brand-text/10 group"
                    >
                        {updateProfile.isPending ? (
                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        ) : saved ? (
                            <Check className="w-5 h-5 mr-2 text-emerald-400" />
                        ) : (
                            <Target className="w-5 h-5 mr-2 group-hover:scale-125 transition-transform" />
                        )}
                        <span className="font-black uppercase tracking-widest text-xs">
                            {saved ? "Saved" : "Save Changes"}
                        </span>
                    </Button>
                </div>
            </header>

            <AnimatePresence>
                {updateProfile.isError && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-sm font-bold text-rose-700 flex items-center gap-3"
                    >
                        <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                        Failed to save profile. Please try again.
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-10 items-start">
                {/* Sidebar Navigation */}
                <aside className="space-y-2 sticky top-24">
                    {TABS.map((tab) => {
                        const Icon = tab.icon
                        const isActive = activeTab === tab.id
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full group relative flex items-center gap-3 p-3 rounded-[1.25rem] transition-all duration-300 ${isActive
                                    ? "bg-brand-text text-brand-card shadow-xl shadow-brand-text/10"
                                    : "bg-brand-card/50 hover:bg-brand-card text-brand-highlight border border-brand-divider/50 hover:border-brand-divider"
                                    }`}
                            >
                                <div className={`p-2 rounded-xl transition-colors ${isActive ? "bg-brand-card/20" : "bg-brand-secondary group-hover:bg-brand-secondary"}`}>
                                    <Icon className={`w-4 h-4 ${isActive ? "text-brand-card" : "text-brand-text/60 group-hover:text-brand-text"}`} />
                                </div>
                                <div className="flex-1 text-left">
                                    <div className={`text-[10px] font-black uppercase tracking-[0.15em] leading-none ${isActive ? "text-brand-card" : "text-brand-text"}`}>{tab.label}</div>
                                </div>
                                {isActive && (
                                    <motion.div layoutId="active-indicator" className="absolute right-3 text-white">
                                        <div className="w-1.5 h-1.5 bg-brand-card rounded-full" />
                                    </motion.div>
                                )}
                            </button>
                        )
                    })}
                </aside>

                {/* Main Content Area */}
                <main className="relative min-h-[600px] bg-brand-card/40 backdrop-blur-3xl border border-brand-divider rounded-[3rem] shadow-[0_32px_64px_rgba(0,0,0,0.04)] overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-secondary/30 via-brand-card to-brand-secondary/20 -z-10" />

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3, ease: "circOut" }}
                            className="p-10"
                        >
                            <SectionRenderer
                                activeTab={activeTab}
                                form={form}
                                onChange={handleFormChange}
                                profile={profile}
                                updateAvatar={updateAvatar}
                                updateCover={updateCover}
                            />
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    )
}

function SectionRenderer({
    activeTab,
    form,
    onChange,
    profile,
    updateAvatar,
    updateCover
}: {
    activeTab: TabType;
    form: BasicInfoForm;
    onChange: any;
    profile: any;
    updateAvatar: any;
    updateCover: any;
}) {
    switch (activeTab) {
        case "identity":
            return (
                <div className="space-y-8">
                    <BasicInfoSection variant="identity" form={form} onChange={onChange} />
                </div>
            )
        case "visual":
            return (
                <div className="space-y-12">
                    <AvatarCoverSection
                        avatarMediaId={profile?.avatar_media_id}
                        coverMediaId={profile?.cover_media_id}
                        displayName={form.display_name || "U"}
                        onAvatarChange={(file) => updateAvatar.mutate(file)}
                        onCoverChange={(file) => updateCover.mutate(file)}
                        isAvatarUploading={updateAvatar.isPending}
                        isCoverUploading={updateCover.isPending}
                    />
                    <BasicInfoSection variant="visual" form={form} onChange={onChange} />
                </div>
            )
        case "work":
            return (
                <div className="space-y-8">
                    {profile?.id && <AboutSectionsPanel userId={profile.id} filterType="work" section="life_entry" />}
                </div>
            )
        case "education":
            return (
                <div className="space-y-8">
                    {profile?.id && <AboutSectionsPanel userId={profile.id} filterType="education" section="life_entry" />}
                </div>
            )
        case "interests":
            return (
                <div className="space-y-8">
                    {profile?.id && <HobbiesInterestsEditor userId={profile.id} />}
                </div>
            )
        default:
            return null
    }
}
