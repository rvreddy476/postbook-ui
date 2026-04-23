"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Loader2, RefreshCw } from "lucide-react";

import AppShell from "@/components/AppShell";
import api from "@/lib/api";

interface OnThisDayItem {
  id: string;
  post_id: string;
  memory_date: string;
  years_ago: number;
  snippet: string;
  media_url?: string | null;
}

interface OnThisDayResponse {
  data: {
    items: OnThisDayItem[];
  };
}

export default function OnThisDayPage() {
  const memoriesQuery = useQuery({
    queryKey: ["memories-on-this-day"],
    queryFn: async () => {
      const res = await api.get<OnThisDayResponse>("/v1/memories/on-this-day");
      return res.data.data.items;
    },
    staleTime: 60_000,
  });

  const todayLabel = new Date().toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });
  const items = memoriesQuery.data ?? [];

  return (
    <AppShell activeTab="Memories">
      <div className="mx-auto max-w-[1080px] px-6 py-8">
        <div className="rounded-[30px] border border-brand-divider bg-[#FFF8EC] px-6 py-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F2C56F]/20 text-[#9a6400]">
                <CalendarClock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#9a6400]">
                  Memories
                </p>
                <h1 className="mt-1 text-[28px] font-bold text-brand-text">On This Day</h1>
                <p className="mt-2 max-w-2xl text-[14px] leading-6 text-brand-text/65">
                  Revisit posts you made on {todayLabel} in previous years. This stays intentionally lightweight for ship week: fast load, direct links, no extra workflow.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void memoriesQuery.refetch()}
              disabled={memoriesQuery.isFetching}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#E9C98C] bg-white px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-[#9a6400] transition-colors hover:bg-[#FFF2D6] disabled:opacity-50"
            >
              {memoriesQuery.isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </button>
          </div>
        </div>

        {memoriesQuery.isLoading ? (
          <div className="mt-8 flex items-center justify-center rounded-[28px] border border-brand-divider bg-brand-card px-6 py-16 shadow-sm">
            <Loader2 className="h-6 w-6 animate-spin text-brand-highlight" />
          </div>
        ) : memoriesQuery.isError ? (
          <div className="mt-8 rounded-[28px] border border-rose-200 bg-rose-50 px-6 py-6 text-[13px] font-semibold text-rose-700">
            Unable to load On This Day right now.
          </div>
        ) : items.length === 0 ? (
          <div className="mt-8 rounded-[28px] border border-brand-divider bg-brand-card px-6 py-12 text-center shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-brand-highlight">
              Nothing resurfaced today
            </p>
            <p className="mt-2 text-[14px] text-brand-text/65">
              When older posts line up with today’s date, they will appear here with direct links back to the original post.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="overflow-hidden rounded-[28px] border border-brand-divider bg-brand-card shadow-sm"
              >
                {item.media_url ? (
                  <img src={item.media_url} alt="" className="h-48 w-full object-cover" />
                ) : (
                  <div className="h-32 w-full bg-gradient-to-br from-[#F7E6B8] via-[#FFF8EC] to-[#EFD8A2]" />
                )}
                <div className="space-y-4 px-6 py-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-[#FFF3D6] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#9a6400]">
                      {item.years_ago} years ago
                    </span>
                    <span className="text-[11px] text-brand-text/45">{item.memory_date}</span>
                  </div>
                  <p className="text-[15px] leading-7 text-brand-text">
                    {item.snippet || "Open the post to revisit the full memory."}
                  </p>
                  <Link
                    href={`/post/${item.post_id}`}
                    className="inline-flex items-center rounded-2xl bg-brand-text px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-white transition-colors hover:bg-brand-highlight"
                  >
                    Open post
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
