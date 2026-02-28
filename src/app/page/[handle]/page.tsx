"use client"

import React, { useState } from "react"
import { useParams } from "next/navigation"
import { useBusinessPage, usePageReviews, useSubmitReview } from "@/hooks/useBusinessPages"
import {
    BadgeCheck,
    Star,
    MapPin,
    Clock,
    Phone,
    Globe,
    Mail,
    Loader2,
    Send,
    ChevronDown,
} from "lucide-react"

function StarRating({
    rating,
    interactive = false,
    onChange,
    size = "sm",
}: {
    rating: number
    interactive?: boolean
    onChange?: (r: number) => void
    size?: "sm" | "md"
}) {
    const sizeClass = size === "md" ? "w-6 h-6" : "w-4 h-4"
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    disabled={!interactive}
                    onClick={() => onChange?.(star)}
                    className={interactive ? "cursor-pointer" : "cursor-default"}
                >
                    <Star
                        className={`${sizeClass} ${
                            star <= rating
                                ? "fill-[#D4A574] text-[#D4A574]"
                                : "text-[#F0E6DC]"
                        }`}
                    />
                </button>
            ))}
        </div>
    )
}

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

export default function BusinessPageProfilePage() {
    const params = useParams()
    const handle = params.handle as string
    const { data: page, isLoading, error } = useBusinessPage(handle)
    const {
        data: reviewsData,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = usePageReviews(page?.id)
    const submitReview = useSubmitReview()

    const [reviewRating, setReviewRating] = useState(0)
    const [reviewText, setReviewText] = useState("")

    const reviews = reviewsData?.pages.flatMap((p) => p.data) ?? []

    const handleSubmitReview = () => {
        if (!page || reviewRating === 0 || !reviewText.trim()) return
        submitReview.mutate(
            { pageId: page.id, rating: reviewRating, review_text: reviewText.trim() },
            {
                onSuccess: () => {
                    setReviewRating(0)
                    setReviewText("")
                },
            }
        )
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-[#7B5B3A]" />
            </div>
        )
    }

    if (error || !page) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <h2 className="text-xl font-bold text-[#3C2415]">Page not found</h2>
                <p className="text-sm text-[#7B5B3A] mt-2">
                    The business page you are looking for does not exist or has been removed.
                </p>
            </div>
        )
    }

    const coverUrl = page.cover_media_id
        ? `/v1/media/${page.cover_media_id}/serve`
        : null

    const avatarUrl = page.avatar_media_id
        ? `/v1/media/${page.avatar_media_id}/serve`
        : null

    return (
        <div className="min-h-screen bg-[#FAF5F0]">
            {/* Cover */}
            <div className="h-48 md:h-64 relative overflow-hidden">
                {coverUrl ? (
                    <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#3C2415] via-[#7B5B3A] to-[#D4A574]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#3C2415]/50 to-transparent" />
            </div>

            <div className="max-w-4xl mx-auto px-4 -mt-16 relative z-10">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5">
                    <div className="h-28 w-28 rounded-2xl bg-white p-1.5 shadow-xl border border-[#F0E6DC]">
                        <div className="w-full h-full rounded-xl overflow-hidden bg-[#F0E6DC]">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt={page.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-[#7B5B3A]">
                                    {page.name.charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 text-center sm:text-left pb-2">
                        <div className="flex items-center gap-2 justify-center sm:justify-start">
                            <h1 className="text-2xl font-bold text-[#3C2415]">{page.name}</h1>
                            {page.is_verified && <BadgeCheck className="w-5 h-5 text-[#D4A574]" />}
                        </div>
                        {page.category && (
                            <span className="inline-block mt-1 px-2.5 py-0.5 text-xs font-medium bg-[#F0E6DC] text-[#7B5B3A] rounded-full">
                                {page.category}
                            </span>
                        )}
                        {/* Rating summary */}
                        <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start">
                            <StarRating rating={Math.round(page.average_rating)} />
                            <span className="text-sm font-bold text-[#3C2415]">
                                {page.average_rating.toFixed(1)}
                            </span>
                            <span className="text-xs text-[#7B5B3A]">
                                ({page.review_count} {page.review_count === 1 ? "review" : "reviews"})
                            </span>
                        </div>
                    </div>
                </div>

                {/* Description */}
                {page.description && (
                    <div className="mt-6 p-4 bg-white rounded-2xl border border-[#F0E6DC] shadow-sm">
                        <p className="text-sm text-[#3C2415] leading-relaxed">{page.description}</p>
                    </div>
                )}

                <div className="grid md:grid-cols-2 gap-6 mt-6">
                    {/* Left Column: Map + Contact */}
                    <div className="space-y-4">
                        {/* Map Placeholder */}
                        {(page.address || page.city) && (
                            <div className="bg-white rounded-2xl border border-[#F0E6DC] shadow-sm overflow-hidden">
                                <div className="h-40 bg-[#F0E6DC] flex items-center justify-center">
                                    <div className="text-center">
                                        <MapPin className="w-8 h-8 text-[#7B5B3A] mx-auto mb-2" />
                                        <p className="text-xs text-[#7B5B3A]">Map coming soon</p>
                                    </div>
                                </div>
                                <div className="p-4">
                                    <p className="text-sm text-[#3C2415] font-medium">
                                        {[page.address, page.city, page.state, page.country]
                                            .filter(Boolean)
                                            .join(", ")}
                                    </p>
                                    {page.zip_code && (
                                        <p className="text-xs text-[#7B5B3A] mt-0.5">{page.zip_code}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Contact Info */}
                        <div className="bg-white rounded-2xl border border-[#F0E6DC] shadow-sm p-4 space-y-3">
                            <h3 className="text-sm font-bold text-[#3C2415] uppercase tracking-wide">
                                Contact
                            </h3>
                            {page.phone && (
                                <div className="flex items-center gap-2.5 text-sm text-[#3C2415]">
                                    <Phone className="w-4 h-4 text-[#7B5B3A]" />
                                    <a href={`tel:${page.phone}`} className="hover:text-[#D4A574] transition-colors">
                                        {page.phone}
                                    </a>
                                </div>
                            )}
                            {page.email && (
                                <div className="flex items-center gap-2.5 text-sm text-[#3C2415]">
                                    <Mail className="w-4 h-4 text-[#7B5B3A]" />
                                    <a href={`mailto:${page.email}`} className="hover:text-[#D4A574] transition-colors">
                                        {page.email}
                                    </a>
                                </div>
                            )}
                            {page.website && (
                                <div className="flex items-center gap-2.5 text-sm text-[#3C2415]">
                                    <Globe className="w-4 h-4 text-[#7B5B3A]" />
                                    <a
                                        href={page.website}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:text-[#D4A574] transition-colors truncate"
                                    >
                                        {page.website}
                                    </a>
                                </div>
                            )}
                            {!page.phone && !page.email && !page.website && (
                                <p className="text-xs text-[#7B5B3A]">No contact information available.</p>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Hours */}
                    <div>
                        {page.hours && Object.keys(page.hours).length > 0 && (
                            <div className="bg-white rounded-2xl border border-[#F0E6DC] shadow-sm p-4">
                                <h3 className="text-sm font-bold text-[#3C2415] uppercase tracking-wide mb-3 flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-[#7B5B3A]" />
                                    Business Hours
                                </h3>
                                <div className="space-y-2">
                                    {DAYS.map((day) => {
                                        const h = page.hours?.[day]
                                        return (
                                            <div key={day} className="flex items-center justify-between text-sm">
                                                <span className="capitalize text-[#3C2415] font-medium">{day}</span>
                                                {h ? (
                                                    <span className="text-[#7B5B3A]">
                                                        {h.open} - {h.close}
                                                    </span>
                                                ) : (
                                                    <span className="text-[#7B5B3A]/50">Closed</span>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Reviews Section */}
                <div className="mt-8 mb-12">
                    <h2 className="text-sm font-bold text-[#3C2415] uppercase tracking-wide mb-4">
                        Reviews
                    </h2>

                    {/* Submit Review Form */}
                    <div className="bg-white rounded-2xl border border-[#F0E6DC] shadow-sm p-4 mb-4">
                        <h3 className="text-sm font-semibold text-[#3C2415] mb-3">
                            Write a review
                        </h3>
                        <StarRating
                            rating={reviewRating}
                            interactive
                            onChange={setReviewRating}
                            size="md"
                        />
                        <textarea
                            value={reviewText}
                            onChange={(e) => setReviewText(e.target.value)}
                            placeholder="Share your experience..."
                            rows={3}
                            className="mt-3 w-full px-3 py-2 text-sm border border-[#F0E6DC] rounded-xl bg-[#FAF5F0] text-[#3C2415] placeholder:text-[#7B5B3A]/40 focus:outline-none focus:ring-2 focus:ring-[#D4A574]/50 resize-none"
                        />
                        <div className="flex justify-end mt-2">
                            <button
                                onClick={handleSubmitReview}
                                disabled={submitReview.isPending || reviewRating === 0 || !reviewText.trim()}
                                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#7B5B3A] rounded-xl hover:bg-[#3C2415] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {submitReview.isPending ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Send className="w-3.5 h-3.5" />
                                )}
                                Submit
                            </button>
                        </div>
                    </div>

                    {/* Review List */}
                    {reviews.length === 0 ? (
                        <div className="text-center py-8 text-sm text-[#7B5B3A]">
                            No reviews yet. Be the first to review this page.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {reviews.map((review) => (
                                <div
                                    key={review.id}
                                    className="bg-white rounded-2xl border border-[#F0E6DC] shadow-sm p-4"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-[#F0E6DC] flex items-center justify-center overflow-hidden">
                                            {review.author_avatar_media_id ? (
                                                <img
                                                    src={`/v1/media/${review.author_avatar_media_id}/serve`}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <span className="text-xs font-bold text-[#7B5B3A]">
                                                    {(review.author_display_name ?? "U").charAt(0).toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold text-[#3C2415]">
                                                {review.author_display_name ?? "Anonymous"}
                                            </p>
                                            <StarRating rating={review.rating} />
                                        </div>
                                        <span className="text-[10px] text-[#7B5B3A]/60">
                                            {new Date(review.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <p className="text-sm text-[#3C2415] mt-2 leading-relaxed">
                                        {review.review_text}
                                    </p>
                                </div>
                            ))}

                            {hasNextPage && (
                                <button
                                    onClick={() => fetchNextPage()}
                                    disabled={isFetchingNextPage}
                                    className="w-full flex items-center justify-center gap-2 py-3 text-xs font-bold text-[#7B5B3A] hover:text-[#3C2415] transition-colors"
                                >
                                    {isFetchingNextPage ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <ChevronDown className="w-4 h-4" />
                                            Load more reviews
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
