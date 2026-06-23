"use client"

import { useCallback, useEffect, useState } from "react"
import { ShieldCheck, UserPlus, UserMinus, Search, RefreshCw, ScrollText } from "lucide-react"
import api from "@/lib/api"

// Role management console for the RBAC API (auth-service /v1/auth/admin/*).
// Authorization is enforced server-side: the acting user must be a superadmin
// (env SUPERADMIN_USER_IDS or a DB role). No X-Scopes header is sent — the
// gateway strips inbound identity headers and derives scope from the JWT, and
// these endpoints check the live env-or-DB source of truth, not a header.

const ROLES = ["moderator", "admin", "superadmin"] as const
type Role = (typeof ROLES)[number]

type UserRole = { user_id: string; role: string; granted_by?: string; granted_at: string }
type AuditEntry = {
  id: string
  actor_id: string
  action: string
  target_id?: string
  detail: string
  allowed: boolean
  created_at: string
}

const unwrap = (r: { data?: { data?: unknown } & unknown }) =>
  (r.data?.data ?? r.data) as never

function errMessage(e: unknown): string {
  const err = e as { response?: { status?: number; data?: { error?: { code?: string; message?: string } } } }
  const code = err.response?.data?.error?.code
  if (code === "MFA_REQUIRED") return "Enable two-factor auth on your account to perform admin actions."
  if (err.response?.status === 403) return "Forbidden — your account needs the superadmin role."
  return err.response?.data?.error?.message || "Request failed."
}

export default function AdminAccessConsole() {
  const [grantUser, setGrantUser] = useState("")
  const [grantRole, setGrantRole] = useState<Role>("moderator")
  const [lookupUser, setLookupUser] = useState("")
  const [lookupRoles, setLookupRoles] = useState<UserRole[] | null>(null)
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadAudit = useCallback(async () => {
    try {
      const res = await api.get("/v1/auth/admin/audit?limit=100")
      const data = unwrap(res) as { entries?: AuditEntry[] }
      setAudit(data?.entries ?? [])
    } catch (e) {
      setError(errMessage(e))
    }
  }, [])

  useEffect(() => {
    void loadAudit()
  }, [loadAudit])

  const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim())

  const mutateRole = async (method: "grant" | "revoke") => {
    setError(null)
    setNotice(null)
    if (!isUuid(grantUser)) {
      setError("Enter a valid user UUID.")
      return
    }
    setBusy(true)
    try {
      const body = { user_id: grantUser.trim(), role: grantRole }
      if (method === "grant") {
        await api.post("/v1/auth/admin/roles", body)
        setNotice(`Granted "${grantRole}" to ${grantUser.trim()}. Takes effect on their next login/refresh.`)
      } else {
        await api.delete("/v1/auth/admin/roles", { data: body })
        setNotice(`Revoked "${grantRole}" from ${grantUser.trim()}.`)
      }
      await loadAudit()
      if (lookupUser.trim() === grantUser.trim()) void lookupRolesFor(grantUser.trim())
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const lookupRolesFor = async (id: string) => {
    setError(null)
    if (!isUuid(id)) {
      setError("Enter a valid user UUID to look up.")
      return
    }
    try {
      const res = await api.get(`/v1/auth/admin/roles/${id.trim()}`)
      const data = unwrap(res) as { roles?: UserRole[] }
      setLookupRoles(data?.roles ?? [])
    } catch (e) {
      setError(errMessage(e))
      setLookupRoles(null)
    }
  }

  const inputCls =
    "w-full rounded-xl border border-brand-divider bg-white px-3 py-2 text-[13px] text-brand-text outline-none focus:border-amber-400"

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-8">
      <div className="rounded-[28px] border border-amber-200 bg-amber-50 px-6 py-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-700">RBAC</p>
            <h1 className="mt-1 flex items-center gap-2 text-[26px] font-bold text-brand-text">
              <ShieldCheck className="h-6 w-6 text-amber-700" /> Access &amp; Roles
            </h1>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-brand-text/65">
              Grant or revoke admin roles. Authorization is enforced server-side (superadmin only).
              Changes apply on the user&apos;s next login or token refresh.
            </p>
          </div>
          <button
            onClick={() => void loadAudit()}
            className="inline-flex items-center gap-2 rounded-2xl border border-amber-300 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-amber-800 hover:bg-amber-100"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] font-semibold text-rose-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] font-semibold text-emerald-700">
          {notice}
        </div>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {/* Grant / revoke */}
        <section className="rounded-[24px] border border-brand-divider bg-brand-card px-6 py-6 shadow-sm">
          <h2 className="text-[15px] font-bold text-brand-text">Grant / revoke role</h2>
          <div className="mt-4 space-y-3">
            <input
              className={inputCls}
              placeholder="User UUID"
              value={grantUser}
              onChange={(e) => setGrantUser(e.target.value)}
            />
            <select
              className={inputCls}
              value={grantRole}
              onChange={(e) => setGrantRole(e.target.value as Role)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <div className="flex gap-3">
              <button
                disabled={busy}
                onClick={() => void mutateRole("grant")}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-text px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4" /> Grant
              </button>
              <button
                disabled={busy}
                onClick={() => void mutateRole("revoke")}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-rose-300 bg-white px-4 py-2 text-[13px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                <UserMinus className="h-4 w-4" /> Revoke
              </button>
            </div>
            <p className="text-[11px] leading-5 text-brand-text/50">
              superadmin ⊇ admin ⊇ moderator. Granting admin implies moderator.
            </p>
          </div>
        </section>

        {/* Lookup */}
        <section className="rounded-[24px] border border-brand-divider bg-brand-card px-6 py-6 shadow-sm">
          <h2 className="text-[15px] font-bold text-brand-text">Look up a user&apos;s roles</h2>
          <div className="mt-4 space-y-3">
            <div className="flex gap-3">
              <input
                className={inputCls}
                placeholder="User UUID"
                value={lookupUser}
                onChange={(e) => setLookupUser(e.target.value)}
              />
              <button
                onClick={() => void lookupRolesFor(lookupUser)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-divider bg-white px-4 py-2 text-[13px] font-semibold text-brand-text hover:bg-brand-bg"
              >
                <Search className="h-4 w-4" /> Look up
              </button>
            </div>
            {lookupRoles !== null && (
              <div className="rounded-xl border border-brand-divider bg-brand-bg px-4 py-3">
                {lookupRoles.length === 0 ? (
                  <p className="text-[12px] text-brand-text/55">No roles (ordinary user).</p>
                ) : (
                  <ul className="space-y-1">
                    {lookupRoles.map((r) => (
                      <li key={r.role} className="text-[13px] font-semibold text-brand-text">
                        {r.role}
                        <span className="ml-2 text-[11px] font-normal text-brand-text/45">
                          granted {new Date(r.granted_at).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Audit log */}
      <section className="mt-8 rounded-[24px] border border-brand-divider bg-brand-card px-6 py-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-brand-text">
          <ScrollText className="h-4 w-4" /> Privileged-action audit log
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-brand-divider text-[10px] font-black uppercase tracking-[0.14em] text-brand-text/45">
                <th className="py-2 pr-4">When</th>
                <th className="py-2 pr-4">Action</th>
                <th className="py-2 pr-4">Actor</th>
                <th className="py-2 pr-4">Target</th>
                <th className="py-2 pr-4">Detail</th>
                <th className="py-2 pr-4">Result</th>
              </tr>
            </thead>
            <tbody>
              {audit.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-brand-text/45">
                    No audit entries yet.
                  </td>
                </tr>
              ) : (
                audit.map((e) => (
                  <tr key={e.id} className="border-b border-brand-divider/60">
                    <td className="py-2 pr-4 whitespace-nowrap text-brand-text/70">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 font-semibold text-brand-text">{e.action}</td>
                    <td className="py-2 pr-4 font-mono text-[11px] text-brand-text/55">{e.actor_id.slice(0, 8)}</td>
                    <td className="py-2 pr-4 font-mono text-[11px] text-brand-text/55">
                      {e.target_id ? e.target_id.slice(0, 8) : "—"}
                    </td>
                    <td className="py-2 pr-4 text-brand-text/70">{e.detail}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={
                          e.allowed
                            ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700"
                            : "rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700"
                        }
                      >
                        {e.allowed ? "allowed" : "denied"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
