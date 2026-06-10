"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { SocialLinksSection } from "./SocialLinksSection"
import { useAuthUser } from "@/store/auth"

export interface BasicInfoForm {
    display_name: string
    username: string
    first_name: string
    last_name: string
    preferred_name: string
    pronouns: string
    bio: string
    profession: string
    location: string
    website: string
    category: string
    gender: string
    dob: string
    status_text: string
    status_emoji: string
    profile_theme_color: string
    cta_label: string
    cta_url: string
    timezone: string
}

type SectionVariant = "identity" | "visual"

interface BasicInfoSectionProps {
    form: BasicInfoForm
    onChange: (field: keyof BasicInfoForm, value: string) => void
    variant: SectionVariant
}

const inputBase = "flex h-12 w-full rounded-2xl border border-brand-divider bg-brand-card/50 px-4 py-2 text-sm font-medium transition-all placeholder:text-brand-text/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-text/20 focus-visible:border-brand-text focus-visible:bg-brand-card shadow-sm"
const selectBase = "flex h-12 w-full rounded-2xl border border-brand-divider bg-brand-card/50 px-4 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-text/20 focus-visible:border-brand-text focus-visible:bg-brand-card shadow-sm appearance-none cursor-pointer"

export function BasicInfoSection({ form, onChange, variant }: BasicInfoSectionProps) {
    const authUser = useAuthUser()
    const [localTheme, setLocalTheme] = useState<string>("light")

    useEffect(() => {
        if (typeof window !== "undefined") {
            const stored = localStorage.getItem("postbook_theme") || "light"
            setLocalTheme(stored)
        }
    }, [])

    const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const next = e.target.value
        setLocalTheme(next)
        if (typeof window !== "undefined") {
            localStorage.setItem("postbook_theme", next)
            if (next === "dark") {
                document.documentElement.classList.add("dark")
                document.documentElement.classList.remove("light")
                document.documentElement.style.colorScheme = "dark"
            } else {
                document.documentElement.classList.add("light")
                document.documentElement.classList.remove("dark")
                document.documentElement.style.colorScheme = "light"
            }
        }
    }

    const handle = (field: keyof BasicInfoForm) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
            onChange(field, e.target.value)

    return (
        <div className="space-y-10">
            {variant === "identity" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Field label="Email / Phone" description="Your login identifier (cannot be changed)">
                        <Input
                            value={authUser?.loginId ?? ""}
                            disabled
                            className={`${inputBase} bg-brand-secondary text-brand-highlight cursor-not-allowed`}
                        />
                    </Field>

                    <Field label="Display Name" description="What people see first">
                        <Input value={form.display_name} onChange={handle("display_name")} className={inputBase} required />
                    </Field>

                    <Field label="Username" description="Your unique @handle">
                        <Input value={form.username} onChange={handle("username")} className={inputBase} placeholder="username" />
                    </Field>

                    <Field label="Gender" description="How you identify">
                        <select value={form.gender} onChange={handle("gender")} className={selectBase}>
                            <option value="">Prefer not to say</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                        </select>
                    </Field>

                    <Field label="Birthday" description="Your date of birth (dd-mm-yyyy)">
                        <Input type="date" value={form.dob} onChange={handle("dob")} className={inputBase} />
                    </Field>

                    <Field label="Profession" description="What you do for work">
                        <Input value={form.profession} onChange={handle("profession")} className={inputBase} placeholder="Software Engineer" />
                    </Field>

                    <Field label="Website" description="Your link or portfoilo">
                        <Input value={form.website} onChange={handle("website")} className={inputBase} placeholder="https://..." />
                    </Field>

                    <Field label="Location" description="Where you are based">
                        <Input value={form.location} onChange={handle("location")} className={inputBase} placeholder="San Francisco, CA" />
                    </Field>

                    <Field label="Timezone" description="Your local time area">
                        <select value={form.timezone} onChange={handle("timezone")} className={selectBase}>
                            <option value="">Auto-detect</option>
                            <option value="America/New_York">Eastern Time (ET)</option>
                            <option value="America/Chicago">Central Time (CT)</option>
                            <option value="America/Denver">Mountain Time (MT)</option>
                            <option value="America/Los_Angeles">Pacific Time (PT)</option>
                            <option value="Europe/London">London (GMT)</option>
                            <option value="Europe/Paris">Europe (CET)</option>
                            <option value="Asia/Kolkata">India (IST)</option>
                            <option value="Asia/Tokyo">Japan (JST)</option>
                            <option value="Asia/Shanghai">China (CST)</option>
                            <option value="Australia/Sydney">Sydney (AEST)</option>
                        </select>
                    </Field>

                    {/* Bio moved to last */}
                    <div className="md:col-span-2">
                        <Field label="Bio" description="A short intro about you">
                            <textarea
                                value={form.bio}
                                onChange={handle("bio")}
                                rows={4}
                                className={`${inputBase} h-auto py-4 resize-none`}
                                placeholder="I'm a designer building the future..."
                            />
                        </Field>
                    </div>

                    <div className="md:col-span-2 pt-6 border-t border-brand-divider">
                        <SocialLinksSection />
                    </div>
                </div>
            )}

            {variant === "visual" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Field label="Account Type" description="How you use the app">
                        <select value={form.category} onChange={handle("category")} className={selectBase}>
                            <option value="personal">Personal</option>
                            <option value="creator">Creator</option>
                            <option value="business">Business</option>
                        </select>
                    </Field>

                    <Field label="Theme Mode" description="Switch between Light and Dark mode">
                        <select value={localTheme} onChange={handleThemeChange} className={selectBase}>
                            <option value="light">Light Mode</option>
                            <option value="dark">Dark Mode</option>
                        </select>
                    </Field>

                    <Field label="Theme Color" description="Your profile accent">
                        <div className="flex items-center gap-4">
                            <div
                                className="w-12 h-12 rounded-2xl border-4 border-brand-divider shadow-xl flex-shrink-0"
                                style={{ backgroundColor: form.profile_theme_color || "#1A73E8" }}
                            />
                            <Input
                                value={form.profile_theme_color}
                                onChange={handle("profile_theme_color")}
                                placeholder="#1A73E8"
                                maxLength={7}
                                className={inputBase}
                            />
                        </div>
                    </Field>

                    <Field label="Button Text" description="Action button on profile">
                        <select value={form.cta_label} onChange={handle("cta_label")} className={selectBase}>
                            <option value="">None</option>
                            <option value="Book">Book</option>
                            <option value="Shop">Shop</option>
                            <option value="Hire Me">Hire Me</option>
                            <option value="Contact">Contact</option>
                            <option value="Donate">Donate</option>
                            <option value="Subscribe">Subscribe</option>
                            <option value="Visit">Visit</option>
                        </select>
                    </Field>

                    <Field label="Button Link" description="Where the button goes">
                        <Input value={form.cta_url} onChange={handle("cta_url")} className={inputBase} placeholder="https://..." />
                    </Field>
                </div>
            )}
        </div>
    )
}

function Field({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-3">
            <div>
                <label className="text-[11px] font-black text-brand-text uppercase tracking-[0.2em]">{label}</label>
                {description && <p className="text-[10px] font-bold text-brand-text/60 uppercase tracking-wider mt-0.5">{description}</p>}
            </div>
            {children}
        </div>
    )
}
