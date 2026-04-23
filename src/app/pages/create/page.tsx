'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCreatePage } from '@/hooks/useBusinessPages'
import { ChevronLeft, Loader2 } from 'lucide-react'

const CATEGORIES = [
    'Restaurant', 'Cafe', 'Retail', 'Services', 'Health',
    'Beauty', 'Education', 'Tech', 'Entertainment', 'Other',
]

export default function CreateBusinessPage() {
    const router = useRouter()
    const createPage = useCreatePage()

    const [form, setForm] = useState({
        page_handle: '',
        page_name: '',
        category: '',
        description: '',
        address: '',
        phone: '',
        whatsapp: '',
        business_email: '',
        website: '',
        price_range: '',
        booking_url: '',
    })
    const [error, setError] = useState('')

    const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm((prev) => ({ ...prev, [field]: e.target.value }))

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        if (!form.page_handle.trim() || !form.page_name.trim() || !form.category) {
            setError('Handle, name, and category are required.')
            return
        }
        createPage.mutate(
            { ...form, page_handle: form.page_handle.toLowerCase().replace(/\s+/g, '-') },
            {
                onSuccess: (page) => {
                    router.push(`/page/${page.page_handle}`)
                },
                onError: (err: unknown) => {
                    const msg = err instanceof Error ? err.message : 'Failed to create page'
                    setError(msg.includes('HANDLE_TAKEN') ? 'This handle is already taken.' : msg)
                },
            }
        )
    }

    return (
        <div className="min-h-screen bg-[#FAF5F0]">
            <div className="sticky top-0 z-20 bg-[#FAF5F0]/80 backdrop-blur-sm px-4 py-3 flex items-center gap-3 border-b border-[#F0E6DC]">
                <button
                    onClick={() => router.back()}
                    className="p-1.5 rounded-full hover:bg-[#F0E6DC] transition-colors"
                >
                    <ChevronLeft className="w-5 h-5 text-[#3C2415]" />
                </button>
                <span className="text-sm font-semibold text-[#3C2415]">Create Business Page</span>
            </div>

            <form onSubmit={handleSubmit} className="max-w-xl mx-auto px-4 py-6 space-y-5">
                {error && (
                    <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                        {error}
                    </div>
                )}

                {/* Identity */}
                <section className="bg-white rounded-2xl border border-[#F0E6DC] p-4 space-y-4">
                    <h2 className="text-xs font-bold text-[#7B5B3A] uppercase tracking-wide">Identity</h2>

                    <div>
                        <label className="block text-xs font-semibold text-[#3C2415] mb-1.5">
                            Page Handle <span className="text-red-400">*</span>
                        </label>
                        <div className="flex items-center border border-[#F0E6DC] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#D4A574]/50">
                            <span className="px-3 py-2.5 text-sm text-[#7B5B3A] bg-[#FAF5F0] border-r border-[#F0E6DC]">@</span>
                            <input
                                type="text"
                                value={form.page_handle}
                                onChange={set('page_handle')}
                                placeholder="your-business"
                                className="flex-1 px-3 py-2.5 text-sm text-[#3C2415] bg-white focus:outline-none"
                            />
                        </div>
                        <p className="text-xs text-[#7B5B3A]/60 mt-1">Letters, numbers, hyphens only.</p>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-[#3C2415] mb-1.5">
                            Business Name <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.page_name}
                            onChange={set('page_name')}
                            placeholder="Acme Coffee Shop"
                            className="w-full px-3 py-2.5 text-sm border border-[#F0E6DC] rounded-xl bg-white text-[#3C2415] focus:outline-none focus:ring-2 focus:ring-[#D4A574]/50"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-[#3C2415] mb-1.5">
                            Category <span className="text-red-400">*</span>
                        </label>
                        <select
                            value={form.category}
                            onChange={set('category')}
                            className="w-full px-3 py-2.5 text-sm border border-[#F0E6DC] rounded-xl bg-white text-[#3C2415] focus:outline-none focus:ring-2 focus:ring-[#D4A574]/50"
                        >
                            <option value="">Select a category</option>
                            {CATEGORIES.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-[#3C2415] mb-1.5">Description</label>
                        <textarea
                            value={form.description}
                            onChange={set('description')}
                            placeholder="Tell people about your business..."
                            rows={3}
                            className="w-full px-3 py-2.5 text-sm border border-[#F0E6DC] rounded-xl bg-white text-[#3C2415] focus:outline-none focus:ring-2 focus:ring-[#D4A574]/50 resize-none"
                        />
                    </div>
                </section>

                {/* Contact */}
                <section className="bg-white rounded-2xl border border-[#F0E6DC] p-4 space-y-4">
                    <h2 className="text-xs font-bold text-[#7B5B3A] uppercase tracking-wide">Contact</h2>

                    {[
                        { label: 'Phone', field: 'phone', placeholder: '+1 234 567 8900', type: 'tel' },
                        { label: 'WhatsApp', field: 'whatsapp', placeholder: '+1 234 567 8900', type: 'tel' },
                        { label: 'Business Email', field: 'business_email', placeholder: 'hello@acme.com', type: 'email' },
                        { label: 'Website', field: 'website', placeholder: 'https://acme.com', type: 'url' },
                        { label: 'Address', field: 'address', placeholder: '123 Main St, City', type: 'text' },
                    ].map(({ label, field, placeholder, type }) => (
                        <div key={field}>
                            <label className="block text-xs font-semibold text-[#3C2415] mb-1.5">{label}</label>
                            <input
                                type={type}
                                value={form[field as keyof typeof form]}
                                onChange={set(field)}
                                placeholder={placeholder}
                                className="w-full px-3 py-2.5 text-sm border border-[#F0E6DC] rounded-xl bg-white text-[#3C2415] focus:outline-none focus:ring-2 focus:ring-[#D4A574]/50"
                            />
                        </div>
                    ))}
                </section>

                {/* Extras */}
                <section className="bg-white rounded-2xl border border-[#F0E6DC] p-4 space-y-4">
                    <h2 className="text-xs font-bold text-[#7B5B3A] uppercase tracking-wide">Extras</h2>

                    <div>
                        <label className="block text-xs font-semibold text-[#3C2415] mb-1.5">Price Range</label>
                        <select
                            value={form.price_range}
                            onChange={set('price_range')}
                            className="w-full px-3 py-2.5 text-sm border border-[#F0E6DC] rounded-xl bg-white text-[#3C2415] focus:outline-none focus:ring-2 focus:ring-[#D4A574]/50"
                        >
                            <option value="">Not specified</option>
                            <option value="$">$ — Budget</option>
                            <option value="$$">$$ — Moderate</option>
                            <option value="$$$">$$$ — Premium</option>
                            <option value="$$$$">$$$$ — Luxury</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-[#3C2415] mb-1.5">Booking URL</label>
                        <input
                            type="url"
                            value={form.booking_url}
                            onChange={set('booking_url')}
                            placeholder="https://calendly.com/..."
                            className="w-full px-3 py-2.5 text-sm border border-[#F0E6DC] rounded-xl bg-white text-[#3C2415] focus:outline-none focus:ring-2 focus:ring-[#D4A574]/50"
                        />
                    </div>
                </section>

                <button
                    type="submit"
                    disabled={createPage.isPending}
                    className="w-full flex items-center justify-center gap-2 py-3.5 text-sm font-bold text-white bg-[#7B5B3A] rounded-2xl hover:bg-[#3C2415] disabled:opacity-60 transition-colors"
                >
                    {createPage.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Create Page
                </button>
            </form>
        </div>
    )
}
