import Link from "next/link";
import AppShell from "@/components/AppShell";
import { SlamBookMemoriesHub } from "@/features/slambooks/SlamBookRouteViews";

export default function MemoriesPage() {
  return (
    <AppShell activeTab="Memories">
      <div className="mx-auto max-w-[1180px] px-6 pt-6">
        <div className="flex flex-col gap-4 rounded-[28px] border border-brand-divider bg-[#FFF9EE] px-6 py-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#8a5d08]">
              Memories
            </p>
            <h1 className="mt-1 text-[24px] font-bold text-brand-text">SlamBooks and memory resurfacing</h1>
            <p className="mt-1 text-[13px] text-brand-text/65">
              Build SlamBooks, collect answers, and revisit old posts that matter on the right date.
            </p>
          </div>
          <Link
            href="/memories/on-this-day"
            className="inline-flex items-center justify-center rounded-2xl border border-[#E9C98C] bg-white px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-[#8a5d08] transition-colors hover:bg-[#FFF2D6]"
          >
            Open On This Day
          </Link>
        </div>
      </div>
      <SlamBookMemoriesHub />
    </AppShell>
  );
}
