"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import { Loader2, Search } from "lucide-react"

import { useMopeduPartners } from "@/hooks/useMopeduAdmin"
import type { PartnerStatus } from "@/types/mopedu"

import {
  classNames,
  EmptyState,
  errorMessage,
  maskPhone,
  relativeTime,
  StatusPill,
  toneForStatus,
} from "../_shared"

const PAGE_SIZE = 25

const STATUS_FILTERS: Array<{ key: string; label: string }> = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "suspended", label: "Suspended" },
  { key: "blocked", label: "Blocked" },
]

function Avatar({ src, name }: { src?: string; name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name}
        className="h-9 w-9 rounded-full object-cover"
      />
    )
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-secondary/40 text-xs font-bold text-brand-text">
      {initials || "—"}
    </div>
  )
}

export default function MopeduPartnersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const statusParam = searchParams?.get("status") ?? "all"
  const qParam = searchParams?.get("q") ?? ""
  const offsetParam = Number(searchParams?.get("offset") ?? "0") || 0

  const [search, setSearch] = useState(qParam)

  const queryParams = useMemo(
    () => ({
      status: statusParam === "all" ? undefined : statusParam,
      q: qParam || undefined,
      limit: PAGE_SIZE,
      offset: offsetParam,
    }),
    [statusParam, qParam, offsetParam],
  )

  const list = useMopeduPartners(queryParams)
  const items = list.data?.items ?? []
  const total = list.data?.total ?? 0

  function pushParams(next: Record<string, string | number | undefined>) {
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined || v === "" || v === "all") params.delete(k)
      else params.set(k, String(v))
    }
    router.push(`/admin/mopedu/partners?${params.toString()}`)
  }

  function onSubmitSearch(e: React.FormEvent) {
    e.preventDefault()
    pushParams({ q: search.trim() || undefined, offset: 0 })
  }

  return (
    <div className="space-y-5">
      {/* Filters + search */}
      <div className="rounded-2xl border border-brand-divider bg-white px-4 py-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((f) => {
            const active = statusParam === f.key
            return (
              <button
                key={f.key}
                type="button"
                onClick={() =>
                  pushParams({ status: f.key, offset: 0 })
                }
                className={classNames(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "border-brand-text bg-brand-text text-white"
                    : "border-gray-300 bg-white text-brand-text/70 hover:bg-gray-50",
                )}
              >
                {f.label}
              </button>
            )
          })}
          <form
            onSubmit={onSubmitSearch}
            className="ml-auto flex w-full max-w-xs items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, phone, email…"
                className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-8 pr-2 text-sm outline-none focus:border-brand-text"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-brand-text/70 hover:bg-gray-50"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-brand-divider bg-white shadow-sm">
        {list.isLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-brand-text/60">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading partners…
          </div>
        ) : list.isError ? (
          <div className="px-4 py-6 text-sm text-rose-700">
            {errorMessage(list.error)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No partners found"
            body="Try a different status filter or search term."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3">Partner</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">KYC</th>
                <th className="px-4 py-3">Bank</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((p) => (
                <tr
                  key={p.id}
                  className="cursor-pointer transition-colors hover:bg-gray-50"
                  onClick={() => router.push(`/admin/mopedu/partners/${p.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar src={p.profile_photo_url} name={p.full_name} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-brand-text">
                          {p.full_name}
                        </p>
                        {p.email ? (
                          <p className="truncate text-xs text-brand-text/55">
                            {p.email}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-brand-text/80">
                    {maskPhone(p.phone)}
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-text/70">
                    {p.city_id}
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-text/70">
                    {p.partner_type.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill
                      status={p.kyc_status}
                      tone={toneForStatus(p.kyc_status)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill
                      status={p.bank_status}
                      tone={toneForStatus(p.bank_status)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill
                      status={p.status as PartnerStatus}
                      tone={toneForStatus(p.status)}
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-text/60">
                    {relativeTime(p.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > 0 ? (
        <div className="flex items-center justify-between">
          <p className="text-xs text-brand-text/60">
            Showing {Math.min(offsetParam + 1, total)}–
            {Math.min(offsetParam + items.length, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={offsetParam === 0}
              onClick={() =>
                pushParams({
                  offset: Math.max(0, offsetParam - PAGE_SIZE),
                })
              }
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-brand-text/70 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={offsetParam + items.length >= total}
              onClick={() =>
                pushParams({ offset: offsetParam + PAGE_SIZE })
              }
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-brand-text/70 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      <p className="text-[11px] text-brand-text/50">
        Click a row to open partner detail. Use{" "}
        <Link
          href="/admin/mopedu/documents"
          className="font-semibold underline underline-offset-2"
        >
          Documents
        </Link>{" "}
        and{" "}
        <Link
          href="/admin/mopedu/payments"
          className="font-semibold underline underline-offset-2"
        >
          Payments
        </Link>{" "}
        queues for cross-partner triage.
      </p>
    </div>
  )
}
