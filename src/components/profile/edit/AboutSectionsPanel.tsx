"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, ChevronDown, Calendar, Sparkles, X, Target } from "lucide-react"
import { useAbout, useUpsertAboutItem, useDeleteAboutItem } from "@/hooks/useAbout"
import type { AboutSection, AboutItem } from "@/types/profile"
import { motion, AnimatePresence } from "framer-motion"

// ─── Field Definitions ──────────────────────────────────────────────

type FieldType = "text" | "number" | "date" | "month" | "select" | "checkbox" | "tags" | "favorites"

interface FieldDef {
    key: string
    label: string
    type?: FieldType
    options?: { value: string; label: string }[]
    placeholder?: string
    group?: string // visual grouping
}

const SECTIONS: { key: AboutSection; label: string; icon: any }[] = [
    { key: "life_entry", label: "History", icon: Calendar },
    { key: "interests", label: "Hobbies & Interests", icon: Sparkles },
]

const SECTION_FIELDS: Record<AboutSection, FieldDef[]> = {
    life_entry: [
        {
            key: "entry_type", label: "Type", type: "select", options: [
                { value: "work", label: "Work" },
                { value: "education", label: "Education" },
                { value: "certification", label: "Certification" },
                { value: "achievement", label: "Achievement" },
                { value: "milestone", label: "Milestone" },
            ]
        },
        { key: "title", label: "Title", placeholder: "e.g. Software Engineer, BS Computer Science" },
        { key: "subtitle", label: "Company or School", placeholder: "e.g. Google, MIT" },
        { key: "description", label: "Details", placeholder: "Brief description..." },
        { key: "industry", label: "Industry", placeholder: "e.g. Technology, Healthcare" },
        {
            key: "employment_type", label: "Employment Type", type: "select", options: [
                { value: "", label: "N/A" },
                { value: "full_time", label: "Full-time" },
                { value: "part_time", label: "Part-time" },
                { value: "self_employed", label: "Freelance" },
                { value: "intern", label: "Internship" },
            ]
        },
        { key: "field_of_study", label: "Field of Study", placeholder: "e.g. Computer Science" },
        { key: "start_date", label: "Start Date", type: "month" },
        { key: "end_date", label: "End Date", type: "month" },
        { key: "is_current", label: "Still here", type: "checkbox" },
        { key: "location", label: "Location", placeholder: "e.g. Mountain View, CA" },
    ],
    interests: [
        { key: "name", label: "Hobby / Interest", placeholder: "e.g. Photography, Piano, Hiking" },
        { key: "description", label: "Description", placeholder: "Tell us more about it..." },
    ],
    basic_info: [],
    contact: [],
    location: [],
    services: [],
}

const FAVORITE_CATEGORIES = [] as const

const inputBase = "flex h-12 w-full rounded-2xl border border-slate-200 bg-white/50 px-4 py-2 text-sm font-medium transition-all placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 focus-visible:bg-white shadow-sm"
const selectBase = "flex h-12 w-full rounded-2xl border border-slate-200 bg-white/50 px-4 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 focus-visible:bg-white shadow-sm appearance-none cursor-pointer"

// ─── Main Component ─────────────────────────────────────────────────

// ─── Main Component ─────────────────────────────────────────────────

interface AboutSectionsPanelProps {
    userId: string
    filterType?: 'work' | 'education'
    section?: AboutSection
}

export function AboutSectionsPanel({ userId, filterType, section }: AboutSectionsPanelProps) {
    const { data: aboutData, isLoading } = useAbout(userId)
    const upsertMutation = useUpsertAboutItem()
    const deleteMutation = useDeleteAboutItem()
    const [expandedSection, setExpandedSection] = useState<AboutSection | null>(null)

    if (isLoading) return (
        <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-50 animate-pulse rounded-2xl" />)}
        </div>
    )

    const label = filterType === 'work' ? "Experience" : filterType === 'education' ? "Education" : "Hobbies & Interests"
    const description = filterType === 'work' ? "Professional history" : filterType === 'education' ? "Academic history" : "Personal passions and favorites"

    return (
        <div className="space-y-4">
            <div className="mb-6">
                <label className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">{label}</label>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{description}</p>
            </div>

            {/* Only render the requested section or all sections if none specified */}
            {(section ? SECTIONS.filter(s => s.key === section) : SECTIONS).map(({ key, label, icon: Icon }) => {
                const allItems = (aboutData?.[key] as AboutItem[] | undefined) ?? []
                // Filter by type if provided
                const items = filterType
                    ? allItems.filter(item => (item.data as any).entry_type === filterType)
                    : allItems

                const isExpanded = expandedSection === key
                const sectionLabel = filterType === 'work' ? "Professional Entries" : filterType === 'education' ? "Academic Entries" : label

                return (
                    <div key={key} className={`rounded-[1.5rem] border transition-all duration-500 overflow-hidden ${isExpanded ? "bg-white border-blue-100 shadow-xl" : "bg-white border-slate-100"}`}>
                        <button
                            type="button"
                            onClick={() => setExpandedSection(isExpanded ? null : key)}
                            className="w-full flex items-center justify-between px-6 py-5 hover:bg-slate-50 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-xl ${isExpanded ? "bg-blue-600 border-blue-500" : "bg-slate-100 border-slate-200"} border`}>
                                    <Icon className={`w-4 h-4 ${isExpanded ? "text-white" : "text-slate-400"}`} />
                                </div>
                                <span className={`text-[11px] font-black uppercase tracking-widest ${isExpanded ? "text-slate-900" : "text-slate-500"}`}>{sectionLabel}</span>
                                {items.length > 0 && (
                                    <span className="text-[10px] font-black bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                                        {items.length}
                                    </span>
                                )}
                            </div>
                            <div className={`transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}>
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            </div>
                        </button>

                        <AnimatePresence>
                            {isExpanded && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="px-6 pb-6 space-y-4 border-t border-slate-100 bg-slate-50/20"
                                >
                                    <div className="space-y-4 pt-4">
                                        {items.map((item) => (
                                            <AboutItemRow
                                                key={item.item_id}
                                                section={key}
                                                item={item}
                                                filterType={filterType}
                                                onDelete={() =>
                                                    deleteMutation.mutate({ section: key, itemId: item.item_id })
                                                }
                                            />
                                        ))}
                                        <AddItemForm
                                            section={key}
                                            filterType={filterType}
                                            onAdd={(data) =>
                                                upsertMutation.mutate({
                                                    section: key,
                                                    data,
                                                    visibility: "public",
                                                    sort_order: allItems.length,
                                                })
                                            }
                                            isAdding={upsertMutation.isPending}
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )
            })}
        </div>
    )
}

// ─── Display Row ────────────────────────────────────────────────────

function AboutItemRow({
    section,
    item,
    filterType,
    onDelete,
}: {
    section: AboutSection
    item: AboutItem
    filterType?: 'work' | 'education'
    onDelete: () => void
}) {
    const fields = SECTION_FIELDS[section]
    const data = item.data as Record<string, unknown>

    return (
        <div className="flex items-start justify-between p-5 rounded-[1.25rem] bg-white border border-slate-100 group shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 flex-1">
                {fields.map((f) => {
                    const val = data[f.key]
                    if (val === undefined || val === null || val === "" || val === false) return null
                    if (f.key === 'entry_type' && filterType) return null

                    // Hide irrelevant fields
                    if (filterType === 'work' && f.key === 'field_of_study') return null
                    if (filterType === 'education' && (f.key === 'industry' || f.key === 'employment_type')) return null

                    // Contextual Labels
                    let label = f.label
                    if (filterType === 'work') {
                        if (f.key === 'title') label = "Job Title"
                        if (f.key === 'subtitle') label = "Company"
                    } else if (filterType === 'education') {
                        if (f.key === 'title') label = "Degree"
                        if (f.key === 'subtitle') label = "School"
                    }

                    // Checkbox
                    if (f.type === "checkbox") {
                        if (!val) return null
                        return (
                            <div key={f.key} className="flex items-center gap-2">
                                <div className="p-1 bg-emerald-100 rounded-lg">
                                    <Target className="w-3 h-3 text-emerald-600" />
                                </div>
                                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{label}</span>
                            </div>
                        )
                    }

                    // Select — show label instead of value
                    if (f.type === "select" && f.options) {
                        const opt = f.options.find((o) => o.value === val)
                        return (
                            <div key={f.key}>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">{label}</span>
                                <span className="text-[11px] font-black text-slate-900 uppercase italic tracking-tight">{opt?.label ?? String(val)}</span>
                            </div>
                        )
                    }

                    // Default text/number/date
                    return (
                        <div key={f.key}>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">{label}</span>
                            <span className="text-[11px] font-black text-slate-900 uppercase italic tracking-tight">{String(val)}</span>
                        </div>
                    )
                })}
            </div>
            <motion.button
                whileHover={{ scale: 1.1, rotate: 5 }}
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={onDelete}
                className="p-2.5 bg-slate-100 text-slate-400 rounded-xl hover:bg-rose-500 hover:text-white transition-all ml-4 shrink-0"
            >
                <Trash2 className="w-4 h-4" />
            </motion.button>
        </div>
    )
}

// ─── Add Item Form ──────────────────────────────────────────────────

function AddItemForm({
    section,
    onAdd,
    isAdding,
    filterType,
}: {
    section: AboutSection
    onAdd: (data: Record<string, unknown>) => void
    isAdding: boolean
    filterType?: 'work' | 'education'
}) {
    const fields = SECTION_FIELDS[section]
    const [formData, setFormData] = useState<Record<string, unknown>>({})
    const [showForm, setShowForm] = useState(false)

    if (fields.length === 0) return null

    if (!showForm) {
        return (
            <motion.button
                whileHover={{ x: 5 }}
                type="button"
                onClick={() => setShowForm(true)}
                className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 hover:text-blue-700 mt-4 px-2"
            >
                <Plus className="w-4 h-4" />
                Add New {filterType === 'work' ? "Professional Entry" : filterType === 'education' ? "Academic Entry" : "History Item"}
            </motion.button>
        )
    }

    const setField = (key: string, val: unknown) => {
        setFormData((prev) => ({ ...prev, [key]: val }))
    }

    const handleSubmit = () => {
        const data: Record<string, unknown> = {}
        // Auto-assign type if filtering
        if (filterType) data.entry_type = filterType

        for (const f of fields) {
            const val = formData[f.key]
            if (val === undefined || val === null || val === "") continue

            if (f.type === "number") {
                data[f.key] = Number(val)
            } else if (f.type === "checkbox") {
                data[f.key] = !!val
            } else {
                data[f.key] = val
            }
        }
        onAdd(data)
        setFormData({})
        setShowForm(false)
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6 p-8 rounded-[2rem] bg-white border border-blue-100 shadow-2xl mt-4 relative overflow-hidden"
        >
            <div className="absolute top-0 right-0 p-4 opacity-5">
                <Sparkles className="w-20 h-20 text-blue-600" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {fields.map((f) => {
                    if (f.key === 'entry_type' && filterType) return null

                    // Hide irrelevant fields
                    if (filterType === 'work' && f.key === 'field_of_study') return null
                    if (filterType === 'education' && (f.key === 'industry' || f.key === 'employment_type')) return null

                    // Contextual Labels
                    let fieldLabel = f.label
                    let placeholder = f.placeholder
                    if (filterType === 'work') {
                        if (f.key === 'title') { fieldLabel = "Job Title"; placeholder = "e.g. Senior Software Engineer" }
                        if (f.key === 'subtitle') { fieldLabel = "Company Name"; placeholder = "e.g. Google" }
                    } else if (filterType === 'education') {
                        if (f.key === 'title') { fieldLabel = "Degree / Certification"; placeholder = "e.g. BS Computer Science" }
                        if (f.key === 'subtitle') { fieldLabel = "School / University"; placeholder = "e.g. Harvard University" }
                    }

                    const labelNode = (
                        <div className="mb-2">
                            <label className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">{fieldLabel}</label>
                        </div>
                    )

                    if (f.type === "select") {
                        return (
                            <div key={f.key}>
                                {labelNode}
                                <select
                                    value={(formData[f.key] as string) ?? ""}
                                    onChange={(e) => setField(f.key, e.target.value)}
                                    className={selectBase}
                                >
                                    <option value="">Select...</option>
                                    {f.options?.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>
                        )
                    }

                    if (f.type === "checkbox") {
                        return (
                            <label key={f.key} className="flex items-center gap-4 cursor-pointer p-4 rounded-2xl bg-slate-50 border border-slate-100 group">
                                <input
                                    type="checkbox"
                                    checked={!!formData[f.key]}
                                    onChange={(e) => setField(f.key, e.target.checked)}
                                    className="w-5 h-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500/20"
                                />
                                <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">{fieldLabel}</span>
                            </label>
                        )
                    }

                    return (
                        <div key={f.key}>
                            {labelNode}
                            <Input
                                type={f.type ?? "text"}
                                placeholder={placeholder ?? fieldLabel}
                                value={(formData[f.key] as string) ?? ""}
                                onChange={(e) => setField(f.key, e.target.value)}
                                className={inputBase}
                            />
                        </div>
                    )
                })}
            </div>

            <div className="flex gap-4 justify-end pt-6 border-t border-slate-50">
                <Button variant="ghost" className="h-12 px-8 rounded-2xl text-slate-400 font-black uppercase tracking-widest text-[10px]" onClick={() => { setShowForm(false); setFormData({}) }}>
                    Cancel
                </Button>
                <Button className="h-12 px-10 rounded-2xl bg-blue-600 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-600/20" onClick={handleSubmit} disabled={isAdding}>
                    {isAdding ? "Adding..." : "Add Entry"}
                </Button>
            </div>
        </motion.div>
    )
}
