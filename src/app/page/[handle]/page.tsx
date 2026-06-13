'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
    ArrowLeft, BadgeCheck, Loader2, Users, Settings, UserPlus, Check,
    Globe, Phone, ShieldAlert, Upload, FileCheck2, Send,
} from 'lucide-react'
import {
    useBusinessPage, useFollowPage, useUnfollowPage,
    usePageDocuments, useAddPageDocument, useSubmitPageForReview,
} from '@/hooks/useBusinessPages'
import { PAGE_TYPE_BY_VALUE, documentLabel } from '@/lib/pageTypes'
import { resolveImageUrl } from '@/lib/imageUrl'
import type { PageActionButton } from '@/types/profile'

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    draft: { label: 'Draft', cls: 'bg-zinc-100 text-zinc-600' },
    pending_review: { label: 'In review', cls: 'bg-amber-100 text-amber-700' },
    approved: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-700' },
    rejected: { label: 'Rejected', cls: 'bg-rose-100 text-rose-700' },
    suspended: { label: 'Suspended', cls: 'bg-orange-100 text-orange-700' },
    disabled: { label: 'Disabled', cls: 'bg-zinc-200 text-zinc-500' },
}

export default function BusinessPageDetail() {
    const params = useParams()
    const router = useRouter()
    const handle = typeof params.handle === 'string' ? params.handle : Array.isArray(params.handle) ? params.handle[0] : ''

    const { data: page, isLoading, error } = useBusinessPage(handle)
    const follow = useFollowPage(handle)
    const unfollow = useUnfollowPage(handle)

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#FAF5F0]">
                <Loader2 className="h-7 w-7 animate-spin text-[#7B5B3A]" />
            </div>
        )
    }
    if (error || !page) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#FAF5F0] text-center">
                <p className="text-[#3C2415] font-semibold">Page not found</p>
                <button onClick={() => router.push('/pages')} className="text-sm text-[#7B5B3A] underline">
                    Browse pages
                </button>
            </div>
        )
    }

    const actions = page.actions
    const cover = page.cover_media_id ? resolveImageUrl(`/v1/media/${page.cover_media_id}/serve`, { size: 'large', dataSaver: false }) : null
    const avatar = page.avatar_media_id ? resolveImageUrl(`/v1/media/${page.avatar_media_id}/serve`, { size: 'small', dataSaver: false }) : null
    const displayType = page.displayType || PAGE_TYPE_BY_VALUE[page.page_type ?? '']?.label || page.category

    const onFollow = () => follow.mutate(page.id)
    const onUnfollow = () => unfollow.mutate(page.id)

    // Hint buttons (gated=false) render as links/placeholders.
    const hintButtons = (page.actionButtons ?? []).filter((b) => !b.gated)

    return (
        <div className="min-h-screen bg-[#FAF5F0] pb-16">
            {/* Top bar */}
            <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#F0E6DC] bg-[#FAF5F0]/85 px-4 py-3 backdrop-blur">
                <button onClick={() => router.back()} className="rounded-full p-1.5 hover:bg-[#F0E6DC]">
                    <ArrowLeft className="h-5 w-5 text-[#3C2415]" />
                </button>
                <span className="truncate text-sm font-semibold text-[#3C2415]">{page.page_name}</span>
            </div>

            {/* Cover */}
            <div className="relative h-40 w-full bg-gradient-to-br from-[#E8D9C5] to-[#D4A574]/40 sm:h-52">
                {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
            </div>

            <div className="mx-auto max-w-2xl px-4">
                {/* Avatar + identity */}
                <div className="-mt-10 flex items-end gap-4">
                    <div className="h-20 w-20 overflow-hidden rounded-2xl border-4 border-[#FAF5F0] bg-white shadow-sm">
                        {avatar ? (
                            <img src={avatar} alt="" className="h-full w-full object-cover" />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center bg-[#7B5B3A] text-2xl font-bold text-white">
                                {page.page_name.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-3">
                    <div className="flex items-center gap-1.5">
                        <h1 className="text-xl font-bold text-[#3C2415]">{page.page_name}</h1>
                        {page.is_verified && <BadgeCheck className="h-5 w-5 text-[#2563EB]" />}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[#7B5B3A]">
                        <span>{displayType}</span>
                        <span className="text-[#7B5B3A]/40">·</span>
                        <span className="inline-flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {page.follower_count.toLocaleString()} {page.follower_count === 1 ? 'follower' : 'followers'}
                        </span>
                        {/* Owner-only status chip */}
                        {actions?.canManage && STATUS_BADGE[page.status] && (
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[page.status].cls}`}>
                                {STATUS_BADGE[page.status].label}
                            </span>
                        )}
                    </div>
                    {page.description && (
                        <p className="mt-2 text-[14px] leading-relaxed text-[#3C2415]/80">{page.description}</p>
                    )}
                </div>

                {/* Suspended banner */}
                {page.bannerMessage && (
                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-orange-50 px-3 py-2 text-[13px] font-medium text-orange-700">
                        <ShieldAlert className="h-4 w-4" />
                        {page.bannerMessage}
                    </div>
                )}

                {/* Primary action row */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                    {actions?.canFollow && (
                        <button
                            onClick={onFollow}
                            disabled={follow.isPending}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[#2563EB] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#1d4fd7] disabled:opacity-60"
                        >
                            {follow.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                            Follow
                        </button>
                    )}
                    {actions?.canUnfollow && (
                        <button
                            onClick={onUnfollow}
                            disabled={unfollow.isPending}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[#E0D5C8] bg-white px-5 py-2.5 text-[13px] font-semibold text-[#3C2415] transition hover:bg-[#F0E6DC] disabled:opacity-60"
                        >
                            {unfollow.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-emerald-600" />}
                            Following
                        </button>
                    )}
                    {actions?.canManage && (
                        <button
                            onClick={() => router.push('/pages/manage')}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[#E0D5C8] bg-white px-5 py-2.5 text-[13px] font-semibold text-[#3C2415] transition hover:bg-[#F0E6DC]"
                        >
                            <Settings className="h-4 w-4" />
                            Manage Page
                        </button>
                    )}
                    {/* Hint buttons (website / call / order_food / menu / ...) */}
                    {hintButtons.map((b) => (
                        <HintButton key={b.id} btn={b} website={page.website} phone={page.phone} />
                    ))}
                </div>

                {/* Owner verification panel */}
                {actions?.canManage && <OwnerPanel page={page} handle={handle} />}
            </div>
        </div>
    )
}

function HintButton({ btn, website, phone }: { btn: PageActionButton; website?: string; phone?: string }) {
    const base = 'inline-flex items-center gap-1.5 rounded-full border border-[#E0D5C8] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#3C2415] transition hover:bg-[#F0E6DC]'
    if ((btn.id === 'website' || btn.id === 'official_website') && website) {
        return <a href={website} target="_blank" rel="noreferrer" className={base}><Globe className="h-4 w-4" />{btn.label}</a>
    }
    if (btn.id === 'call' && phone) {
        return <a href={`tel:${phone}`} className={base}><Phone className="h-4 w-4" />{btn.label}</a>
    }
    return <button onClick={() => alert(`${btn.label} is coming soon.`)} className={base}>{btn.label}</button>
}

function OwnerPanel({ page, handle }: { page: import('@/types/profile').BusinessPage; handle: string }) {
    const typeDef = PAGE_TYPE_BY_VALUE[page.page_type ?? '']
    const required = typeDef?.requiredDocuments ?? []
    const optional = typeDef?.optionalDocuments ?? []
    const { data: docs = [] } = usePageDocuments(handle, page.id, !!page.actions?.canManage)
    const addDoc = useAddPageDocument(handle)
    const submit = useSubmitPageForReview(handle)
    const [pendingType, setPendingType] = useState('')

    const uploadedTypes = new Set(docs.filter((d) => d.status !== 'rejected').map((d) => d.document_type))
    const allRequiredUploaded = required.every((r) => uploadedTypes.has(r))

    const upload = (dt: string) => {
        const url = prompt(`Paste a URL for "${documentLabel(dt)}" (PDF/image):`)
        if (!url) return
        setPendingType(dt)
        addDoc.mutate(
            { pageId: page.id, documentType: dt, documentUrl: url.trim() },
            { onSettled: () => setPendingType('') },
        )
    }

    return (
        <div className="mt-6 rounded-2xl border border-[#F0E6DC] bg-white p-4">
            <h2 className="text-xs font-bold uppercase tracking-wide text-[#7B5B3A]">Verification</h2>
            {page.status === 'rejected' && page.rejection_reason && (
                <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
                    Rejected: {page.rejection_reason}
                </p>
            )}

            <div className="mt-3 space-y-2">
                {[...required.map((d) => ({ d, req: true })), ...optional.map((d) => ({ d, req: false }))].map(({ d, req }) => {
                    const have = uploadedTypes.has(d)
                    const docRow = docs.find((x) => x.document_type === d)
                    return (
                        <div key={d} className="flex items-center justify-between gap-3 rounded-xl border border-[#F0E6DC] px-3 py-2.5">
                            <div className="flex items-center gap-2">
                                {have ? <FileCheck2 className="h-4 w-4 text-emerald-600" /> : <Upload className="h-4 w-4 text-[#7B5B3A]/50" />}
                                <span className="text-[13px] text-[#3C2415]">
                                    {documentLabel(d)}
                                    {req && <span className="ml-1 text-rose-400">*</span>}
                                </span>
                                {docRow && (
                                    <span className="text-[11px] text-[#7B5B3A]/60">({docRow.status})</span>
                                )}
                            </div>
                            <button
                                onClick={() => upload(d)}
                                disabled={addDoc.isPending && pendingType === d}
                                className="rounded-lg bg-[#F0E6DC] px-3 py-1 text-[12px] font-semibold text-[#3C2415] hover:bg-[#E0D5C8] disabled:opacity-60"
                            >
                                {addDoc.isPending && pendingType === d ? '…' : have ? 'Replace' : 'Upload'}
                            </button>
                        </div>
                    )
                })}
                {required.length === 0 && optional.length === 0 && (
                    <p className="text-[13px] text-[#7B5B3A]/70">No documents required for this page type.</p>
                )}
            </div>

            {(page.status === 'draft' || page.status === 'rejected') && (
                <button
                    onClick={() => submit.mutate(page.id)}
                    disabled={submit.isPending || !allRequiredUploaded}
                    title={allRequiredUploaded ? '' : 'Upload all required documents first'}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#7B5B3A] py-3 text-[13px] font-bold text-white transition hover:bg-[#3C2415] disabled:opacity-50"
                >
                    {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Submit for review
                </button>
            )}
            {page.status === 'pending_review' && (
                <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-center text-[13px] font-medium text-amber-700">
                    Submitted — awaiting admin review.
                </p>
            )}
        </div>
    )
}
