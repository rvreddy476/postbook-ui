'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMyPages, useDeletePage } from '@/hooks/useBusinessPages'
import {
    Plus,
    Settings,
    Trash2,
    BadgeCheck,
    Star,
    Users,
    Loader2,
    AlertTriangle,
} from 'lucide-react'
import type { BusinessPage } from '@/types/profile'

function DeleteDialog({
    page,
    onConfirm,
    onCancel,
    isPending,
}: {
    page: BusinessPage
    onConfirm: () => void
    onCancel: () => void
    isPending: boolean
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-[#3C2415]">Delete Page</p>
                        <p className="text-xs text-[#7B5B3A]">{page.page_name}</p>
                    </div>
                </div>
                <p className="text-sm text-[#7B5B3A] mb-5">
                    This will permanently delete your business page and all its reviews. This action cannot be undone.
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-2.5 text-sm font-semibold text-[#7B5B3A] bg-[#F0E6DC] rounded-xl hover:bg-[#e8d9c9] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isPending}
                        className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                    >
                        {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Delete
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function ManagePages() {
    const router = useRouter()
    const { data: pages = [], isLoading } = useMyPages()
    const deletePage = useDeletePage()
    const [deleteTarget, setDeleteTarget] = useState<BusinessPage | null>(null)

    const handleDelete = () => {
        if (!deleteTarget) return
        deletePage.mutate(deleteTarget.id, {
            onSuccess: () => setDeleteTarget(null),
        })
    }

    return (
        <div className="min-h-screen bg-[#FAF5F0]">
            {deleteTarget && (
                <DeleteDialog
                    page={deleteTarget}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteTarget(null)}
                    isPending={deletePage.isPending}
                />
            )}

            <div className="max-w-2xl mx-auto px-4 py-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-xl font-bold text-[#3C2415]">My Pages</h1>
                        <p className="text-xs text-[#7B5B3A] mt-0.5">{pages.length} business {pages.length === 1 ? 'page' : 'pages'}</p>
                    </div>
                    <Link
                        href="/pages/create"
                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#7B5B3A] rounded-xl hover:bg-[#3C2415] transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        New Page
                    </Link>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 animate-spin text-[#7B5B3A]" />
                    </div>
                ) : pages.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-[#F0E6DC]">
                        <p className="text-[#7B5B3A] text-sm mb-3">You have no business pages yet.</p>
                        <Link
                            href="/pages/create"
                            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-[#7B5B3A] rounded-xl hover:bg-[#3C2415] transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Create your first page
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {pages.map((page) => {
                            const avatarUrl = page.avatar_media_id ? `/v1/media/${page.avatar_media_id}/serve` : null
                            return (
                                <div
                                    key={page.id}
                                    className="bg-white rounded-2xl border border-[#F0E6DC] p-4 flex items-center gap-4"
                                >
                                    {/* Avatar */}
                                    <div className="h-14 w-14 rounded-xl bg-[#F0E6DC] overflow-hidden shrink-0">
                                        {avatarUrl ? (
                                            <img src={avatarUrl} alt={page.page_name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-xl font-bold text-[#7B5B3A]">
                                                {page.page_name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-sm font-bold text-[#3C2415] truncate">{page.page_name}</span>
                                            {page.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-[#D4A574] shrink-0" />}
                                        </div>
                                        <p className="text-xs text-[#7B5B3A] mt-0.5">@{page.page_handle} · {page.category}</p>
                                        <div className="flex items-center gap-3 mt-1.5 text-xs text-[#7B5B3A]">
                                            <span className="flex items-center gap-1">
                                                <Users className="w-3 h-3" />
                                                {page.follower_count.toLocaleString()}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Star className="w-3 h-3 fill-[#D4A574] text-[#D4A574]" />
                                                {page.avg_rating.toFixed(1)} ({page.review_count})
                                            </span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => router.push(`/page/${page.page_handle}`)}
                                            className="p-2 rounded-xl text-[#7B5B3A] hover:bg-[#F0E6DC] transition-colors"
                                            title="View page"
                                        >
                                            <Settings className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setDeleteTarget(page)}
                                            className="p-2 rounded-xl text-red-400 hover:bg-red-50 transition-colors"
                                            title="Delete page"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
