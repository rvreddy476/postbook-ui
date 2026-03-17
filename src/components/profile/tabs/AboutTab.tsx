"use client"

import { useAbout } from "@/hooks/useAbout"
import { useProfileLinks } from "@/hooks/useEditProfile"
import { useHobbiesInterests } from "@/hooks/useHobbiesInterests"
import type { UserProfile, AboutItem, UserLink } from "@/types/profile"
import { TagChip } from "../hobbies/TagChip"
import { AnimatePresence } from "framer-motion"
import {
    Briefcase,
    MapPin,
    Globe,
    Calendar,
    GraduationCap,
    Mail,
    Phone,
    Users,
    Star,
    Heart,
    Clock,
    User,
    Cake,
    Tag,
    ExternalLink,
    Sparkles,
    Link as LinkIcon,
    Award,
    Building2,
    BookOpen,
    Target,
} from "lucide-react"
import { motion } from "framer-motion"

interface AboutTabProps {
    profile: UserProfile
    links?: UserLink[]
}

function SectionCard({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay }}
            className="rounded-2xl border border-[#DED9D1]/60 bg-[#DED9D1]/[0.79] p-6"
        >
            {children}
        </motion.div>
    )
}

function SectionHeader({ icon: Icon, title }: { icon: typeof Briefcase; title: string }) {
    return (
        <div className="flex items-center gap-2.5 mb-5">
            <div className="p-2 rounded-xl bg-brand-card/80 border border-[#DED9D1]">
                <Icon className="w-4 h-4 text-zinc-600" />
            </div>
            <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-700">{title}</h3>
        </div>
    )
}

function InfoRow({ icon: Icon, label, value, isLink }: { icon: typeof Briefcase; label: string; value: string; isLink?: boolean }) {
    return (
        <div className="flex items-start gap-3 py-2.5">
            <Icon className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-0.5">{label}</p>
                {isLink ? (
                    <a href={value.startsWith("http") ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[#D8103F] hover:underline flex items-center gap-1">
                        {value.replace(/^https?:\/\//, "")}
                        <ExternalLink className="w-3 h-3" />
                    </a>
                ) : (
                    <p className="text-sm font-medium text-zinc-800">{value}</p>
                )}
            </div>
        </div>
    )
}

function EmptyHint({ text }: { text: string }) {
    return <p className="text-xs text-zinc-400 italic pl-1">{text}</p>
}

function str(v: unknown): string {
    return v == null ? "" : String(v)
}

export function AboutTab({ profile, links: externalLinks }: AboutTabProps) {
    const { data: aboutData, isLoading } = useAbout(profile.id)
    const { data: profileLinks } = useProfileLinks()
    const { hobbies, interests, isLoading: hobbiesLoading } = useHobbiesInterests(profile.id)

    const joinedDate = profile.created_at
        ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
        : undefined

    const formattedDob = profile.dob
        ? new Date(profile.dob).toLocaleDateString("en-US", { month: "long", day: "numeric" })
        : undefined

    const lifeEntries = (aboutData?.life_entry as AboutItem[] | undefined) ?? []
    const workItems = lifeEntries.filter((item) => (item.data as Record<string, unknown>).entry_type === "work")
    const educationItems = lifeEntries.filter((item) => (item.data as Record<string, unknown>).entry_type === "education")
    const otherLifeEntries = lifeEntries.filter((item) => {
        const t = (item.data as Record<string, unknown>).entry_type
        return t !== "work" && t !== "education"
    })
    const contactItems = (aboutData?.contact as AboutItem[] | undefined) ?? []
    const allLinks = profileLinks ?? []
    const socialLinks = externalLinks ?? []

    return (
        <div className="max-w-[780px] space-y-5">

            {/* Overview */}
            <SectionCard delay={0}>
                <SectionHeader icon={User} title="Overview" />
                {profile.bio && (
                    <p className="font-serif-display text-lg italic leading-relaxed text-zinc-700 mb-5 pl-1">
                        &ldquo;{profile.bio}&rdquo;
                    </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                    {profile.display_name && <InfoRow icon={User} label="Display Name" value={profile.display_name} />}
                    {profile.username && <InfoRow icon={Tag} label="Username" value={`@${profile.username}`} />}
                    {profile.first_name && <InfoRow icon={User} label="First Name" value={profile.first_name} />}
                    {profile.last_name && <InfoRow icon={User} label="Last Name" value={profile.last_name} />}
                    {profile.preferred_name && <InfoRow icon={User} label="Preferred Name" value={profile.preferred_name} />}
                    {profile.pronouns && <InfoRow icon={User} label="Pronouns" value={profile.pronouns} />}
                    {profile.gender && profile.gender !== "prefer_not_to_say" && (
                        <InfoRow icon={User} label="Gender" value={profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1)} />
                    )}
                    {formattedDob && <InfoRow icon={Cake} label="Birthday" value={formattedDob} />}
                    {joinedDate && <InfoRow icon={Calendar} label="Member Since" value={joinedDate} />}
                    {profile.timezone && <InfoRow icon={Clock} label="Timezone" value={profile.timezone} />}
                    {profile.category && <InfoRow icon={Tag} label="Account Type" value={profile.category.charAt(0).toUpperCase() + profile.category.slice(1)} />}
                </div>
            </SectionCard>

            {/* Professional */}
            <SectionCard delay={0.04}>
                <SectionHeader icon={Briefcase} title="Professional" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                    <InfoRow icon={Briefcase} label="Profession" value={profile.profession || "Not specified"} />
                    <InfoRow icon={MapPin} label="Location" value={profile.location || "Not specified"} />
                    {profile.website && <InfoRow icon={Globe} label="Website" value={profile.website} isLink />}
                </div>
                {profile.cta_label && profile.cta_url && (
                    <div className="mt-4 pt-4 border-t border-[#DED9D1]/80">
                        <a href={profile.cta_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#D8103F] text-white text-xs font-bold uppercase tracking-[0.15em] hover:bg-[#b80d35] transition-colors shadow-sm">
                            {profile.cta_label}
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    </div>
                )}
            </SectionCard>

            {/* Work Experience */}
            <SectionCard delay={0.08}>
                <SectionHeader icon={Building2} title="Work Experience" />
                {workItems.length > 0 ? (
                    <div className="space-y-5">
                        {workItems.map((item) => {
                            const d = item.data as Record<string, unknown>
                            const startDate = str(d.start_date)
                            const endDate = d.is_current ? "Present" : str(d.end_date)
                            const dateRange = [startDate, endDate].filter(Boolean).join(" — ")
                            return (
                                <div key={item.item_id} className="flex gap-4">
                                    <div className="mt-2 shrink-0">
                                        <div className="w-3 h-3 rounded-full bg-zinc-300 ring-4 ring-[#DED9D1]/60" />
                                    </div>
                                    <div className="flex-1 pb-4 border-b border-[#DED9D1]/50 last:border-0">
                                        <p className="text-sm font-bold text-zinc-900">{str(d.title) || "Untitled"}</p>
                                        <p className="text-xs text-zinc-500 mt-0.5">
                                            {str(d.subtitle)}
                                            {d.industry ? <span className="text-zinc-400"> &middot; {str(d.industry)}</span> : null}
                                        </p>
                                        {d.employment_type ? (
                                            <span className="inline-block mt-1.5 text-[9px] font-bold uppercase tracking-widest text-zinc-500 bg-brand-card/60 px-2 py-0.5 rounded-md border border-[#DED9D1]/40">
                                                {str(d.employment_type).replace(/_/g, " ")}
                                            </span>
                                        ) : null}
                                        {dateRange ? <p className="text-[10px] text-zinc-400 mt-1.5 font-medium">{dateRange}</p> : null}
                                        {d.location ? (
                                            <p className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1">
                                                <MapPin className="w-3 h-3" /> {str(d.location)}
                                            </p>
                                        ) : null}
                                        {d.description ? <p className="text-xs text-zinc-600 mt-2 leading-relaxed">{str(d.description)}</p> : null}
                                        {d.is_current ? (
                                            <span className="inline-flex items-center gap-1 mt-2 text-[9px] font-bold uppercase tracking-widest text-[#D8103F] bg-[#D8103F]/10 px-2 py-0.5 rounded-md">
                                                <Target className="w-3 h-3" /> Current
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <EmptyHint text="No work experience added yet." />
                )}
            </SectionCard>

            {/* Education */}
            <SectionCard delay={0.12}>
                <SectionHeader icon={GraduationCap} title="Education" />
                {educationItems.length > 0 ? (
                    <div className="space-y-5">
                        {educationItems.map((item) => {
                            const d = item.data as Record<string, unknown>
                            const startDate = str(d.start_date)
                            const endDate = d.is_current ? "Present" : str(d.end_date)
                            const dateRange = [startDate, endDate].filter(Boolean).join(" — ")
                            return (
                                <div key={item.item_id} className="flex gap-4">
                                    <div className="mt-2 shrink-0">
                                        <div className="w-3 h-3 rounded-full bg-zinc-300 ring-4 ring-[#DED9D1]/60" />
                                    </div>
                                    <div className="flex-1 pb-4 border-b border-[#DED9D1]/50 last:border-0">
                                        <p className="text-sm font-bold text-zinc-900">{str(d.title) || "Untitled"}</p>
                                        <p className="text-xs text-zinc-500 mt-0.5">{str(d.subtitle)}</p>
                                        {d.field_of_study ? (
                                            <span className="inline-block mt-1.5 text-[9px] font-bold uppercase tracking-widest text-zinc-500 bg-brand-card/60 px-2 py-0.5 rounded-md border border-[#DED9D1]/40">
                                                <BookOpen className="w-3 h-3 inline mr-1" />
                                                {str(d.field_of_study)}
                                            </span>
                                        ) : null}
                                        {dateRange ? <p className="text-[10px] text-zinc-400 mt-1.5 font-medium">{dateRange}</p> : null}
                                        {d.location ? (
                                            <p className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1">
                                                <MapPin className="w-3 h-3" /> {str(d.location)}
                                            </p>
                                        ) : null}
                                        {d.description ? <p className="text-xs text-zinc-600 mt-2 leading-relaxed">{str(d.description)}</p> : null}
                                        {d.is_current ? (
                                            <span className="inline-flex items-center gap-1 mt-2 text-[9px] font-bold uppercase tracking-widest text-[#D8103F] bg-[#D8103F]/10 px-2 py-0.5 rounded-md">
                                                <Target className="w-3 h-3" /> Currently Enrolled
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <EmptyHint text="No education history added yet." />
                )}
            </SectionCard>

            {/* Milestones & Achievements */}
            {otherLifeEntries.length > 0 && (
                <SectionCard delay={0.14}>
                    <SectionHeader icon={Award} title="Milestones & Achievements" />
                    <div className="space-y-5">
                        {otherLifeEntries.map((item) => {
                            const d = item.data as Record<string, unknown>
                            const entryType = str(d.entry_type) || "milestone"
                            const startDate = str(d.start_date)
                            const endDate = str(d.end_date)
                            const dateRange = [startDate, endDate].filter(Boolean).join(" — ")
                            return (
                                <div key={item.item_id} className="flex gap-4">
                                    <div className="mt-2 shrink-0">
                                        <div className="w-3 h-3 rounded-full bg-zinc-300 ring-4 ring-[#DED9D1]/60" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-bold text-zinc-900">{str(d.title)}</p>
                                            <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 bg-brand-card/60 px-1.5 py-0.5 rounded border border-[#DED9D1]/40">{entryType}</span>
                                        </div>
                                        {d.subtitle ? <p className="text-xs text-zinc-500 mt-0.5">{str(d.subtitle)}</p> : null}
                                        {dateRange ? <p className="text-[10px] text-zinc-400 mt-1 font-medium">{dateRange}</p> : null}
                                        {d.description ? <p className="text-xs text-zinc-600 mt-1.5 leading-relaxed">{str(d.description)}</p> : null}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </SectionCard>
            )}

            {/* Hobbies & Interests */}
            <SectionCard delay={0.16}>
                <SectionHeader icon={Heart} title="Hobbies & Interests" />
                {hobbiesLoading ? (
                    <div className="flex flex-wrap gap-2">
                        {[1, 2, 3, 4].map(i => <div key={i} className="h-7 w-20 bg-brand-card/40 rounded-full animate-pulse" />)}
                    </div>
                ) : hobbies.length === 0 && interests.length === 0 ? (
                    <EmptyHint text="No hobbies or interests added yet." />
                ) : (
                    <div className="space-y-5">
                        {hobbies.length > 0 && (
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-3 flex items-center gap-1.5">
                                    <Heart className="w-3 h-3" /> Hobbies
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <AnimatePresence>
                                        {hobbies.map(item => <TagChip key={item.item_id} label={item.name} category={item.category} visibility={item.visibility} size="md" />)}
                                    </AnimatePresence>
                                </div>
                            </div>
                        )}
                        {interests.length > 0 && (
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-3 flex items-center gap-1.5">
                                    <Sparkles className="w-3 h-3" /> Interests
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <AnimatePresence>
                                        {interests.map(item => <TagChip key={item.item_id} label={item.name} category={item.category} visibility={item.visibility} size="md" />)}
                                    </AnimatePresence>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </SectionCard>

            {/* Contact Information */}
            <SectionCard delay={0.18}>
                <SectionHeader icon={Mail} title="Contact Information" />
                {contactItems.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                        {contactItems.map((item) => {
                            const d = item.data as Record<string, unknown>
                            const contactType = str(d.type) || "other"
                            const icon = contactType === "phone" ? Phone : Mail
                            return <InfoRow key={item.item_id} icon={icon} label={contactType.charAt(0).toUpperCase() + contactType.slice(1)} value={str(d.value)} />
                        })}
                    </div>
                ) : (
                    <EmptyHint text="No contact information added yet." />
                )}
            </SectionCard>

            {/* Links */}
            <SectionCard delay={0.2}>
                <SectionHeader icon={LinkIcon} title="Links" />
                {allLinks.length > 0 || socialLinks.length > 0 ? (
                    <div className="space-y-3">
                        {allLinks.map((link) => (
                            <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-brand-card/50 transition-colors group">
                                <div className="w-9 h-9 rounded-lg bg-brand-card/80 border border-[#DED9D1] flex items-center justify-center shrink-0">
                                    <span className="text-[8px] font-black text-zinc-400 uppercase">{(link.icon || link.category || "web").slice(0, 3)}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-zinc-800 truncate">{link.title}</p>
                                    <p className="text-[10px] text-zinc-400 truncate">{link.url}</p>
                                </div>
                                <ExternalLink className="w-3.5 h-3.5 text-zinc-300 group-hover:text-[#D8103F] transition-colors shrink-0" />
                            </a>
                        ))}
                        {socialLinks.map((link) => (
                            <a key={link.platform} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-brand-card/50 transition-colors group">
                                <div className="w-9 h-9 rounded-lg bg-brand-card/80 border border-[#DED9D1] flex items-center justify-center shrink-0">
                                    <span className="text-[8px] font-black text-zinc-400 uppercase">{link.platform.slice(0, 3)}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-zinc-800 truncate">{link.display_label || link.platform}</p>
                                    <p className="text-[10px] text-zinc-400 truncate">{link.url}</p>
                                </div>
                                <ExternalLink className="w-3.5 h-3.5 text-zinc-300 group-hover:text-[#D8103F] transition-colors shrink-0" />
                            </a>
                        ))}
                    </div>
                ) : (
                    <EmptyHint text="No links added yet." />
                )}
            </SectionCard>

            {/* Status */}
            {profile.status_text && (
                <SectionCard delay={0.22}>
                    <SectionHeader icon={Sparkles} title="Current Status" />
                    <div className="flex items-center gap-3 px-1">
                        {profile.status_emoji && <span className="text-2xl">{profile.status_emoji}</span>}
                        <p className="text-sm font-medium text-zinc-700">{profile.status_text}</p>
                        {profile.status_expires_at && (
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider ml-auto">
                                Expires {new Date(profile.status_expires_at).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                </SectionCard>
            )}

            {isLoading && (
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-[#DED9D1]/40 animate-pulse" />)}
                </div>
            )}
        </div>
    )
}
