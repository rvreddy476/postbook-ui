"use client"

export function ProfileSkeleton() {
    return (
        <div className="max-w-6xl mx-auto pb-12">
            {/* Cover photo skeleton */}
            <div className="rounded-b-3xl bg-slate-200/40 animate-pulse" style={{ aspectRatio: "3/1" }} />

            {/* Profile identity section */}
            <div className="max-w-5xl mx-auto px-4 sm:px-6">
                <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-6 -mt-16 sm:-mt-20">
                    {/* Avatar */}
                    <div className="h-32 w-32 sm:h-36 sm:w-36 rounded-3xl bg-brand-card p-1 shadow-lg">
                        <div className="w-full h-full rounded-[20px] bg-slate-200/50 animate-pulse" />
                    </div>

                    {/* Name + meta */}
                    <div className="flex-1 space-y-3 pb-2 w-full">
                        <div className="flex justify-center sm:justify-start">
                            <div className="h-8 w-52 rounded-lg bg-slate-200/50 animate-pulse" />
                        </div>
                        <div className="flex justify-center sm:justify-start">
                            <div className="h-4 w-28 rounded-md bg-slate-200/50 animate-pulse" />
                        </div>
                        <div className="flex justify-center sm:justify-start gap-2">
                            <div className="h-4 w-64 rounded-md bg-slate-200/50 animate-pulse" />
                        </div>
                        <div className="flex justify-center sm:justify-start gap-3">
                            <div className="h-3 w-20 rounded bg-slate-200/50 animate-pulse" />
                            <div className="h-3 w-24 rounded bg-slate-200/50 animate-pulse" />
                            <div className="h-3 w-28 rounded bg-slate-200/50 animate-pulse" />
                        </div>
                    </div>
                </div>

                {/* Stats row */}
                <div className="mt-4 flex gap-6">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center gap-1.5 animate-pulse">
                            <div className="h-4 w-8 rounded bg-slate-200/50" />
                            <div className="h-3 w-14 rounded bg-slate-200/50" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Tab bar */}
            <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-4">
                <div className="flex gap-1 py-2">
                    {[72, 64, 56, 88, 64, 56].map((w, i) => (
                        <div
                            key={i}
                            className="h-10 rounded-xl bg-slate-200/40 animate-pulse"
                            style={{ width: `${w}px` }}
                        />
                    ))}
                </div>
            </div>

            {/* Three-zone content */}
            <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-6">
                <div className="flex gap-6">
                    {/* Main content */}
                    <div className="flex-1 space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="bg-brand-card rounded-2xl border border-brand-divider p-5 animate-pulse"
                            >
                                <div className="space-y-3">
                                    <div className="h-4 w-full rounded bg-slate-200/50" />
                                    <div className="h-4 w-4/5 rounded bg-slate-200/50" />
                                    <div className="h-4 w-2/3 rounded bg-slate-200/50" />
                                </div>
                                <div className="mt-4 h-48 rounded-xl bg-slate-200/40" />
                                <div className="mt-4 flex gap-6">
                                    <div className="h-4 w-14 rounded bg-slate-200/50" />
                                    <div className="h-4 w-14 rounded bg-slate-200/50" />
                                    <div className="h-4 w-14 rounded bg-slate-200/50" />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Sidebar */}
                    <div className="hidden lg:block w-80 shrink-0 space-y-4">
                        {[120, 160, 100].map((h, i) => (
                            <div
                                key={i}
                                className="bg-brand-card rounded-2xl border border-brand-divider animate-pulse"
                                style={{ height: `${h}px` }}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
