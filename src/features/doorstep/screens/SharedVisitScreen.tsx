"use client"

import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import "../doorstep.css"

// A capability link, never cached persistently or sent to another origin.
export function SharedVisitScreen({ token }: { token: string }) {
  const visit = useQuery({ queryKey: ["doorstep", "shared", token], queryFn: async () => {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("Link unavailable")
    const data = (await api.get(`/v1/doorstep/share/${encodeURIComponent(token)}`)).data?.data
    if (!data || typeof data.status !== "string" || typeof data.locality !== "string" || typeof data.slot_start !== "string") throw new Error("Link unavailable")
    return { status: data.status as string, locality: data.locality as string, slot: data.slot_start as string, firstName: typeof data.professional_first_name === "string" ? data.professional_first_name as string : null }
  }, retry: false, refetchInterval: 15_000, gcTime: 0 })
  return <main className="ds-zone ds-main ds-stack" style={{ maxWidth: 560 }}><h1 className="ds-title">Shared visit status</h1><section className="ds-card">
    {visit.isLoading ? <p>Loading visit…</p> : visit.isError ? <p role="alert">This link has expired, was revoked or is no longer available.</p> : visit.data ? <><h2 className="ds-h2">{visit.data.status.replaceAll("_", " ")}</h2><p>{visit.data.locality}</p><p>{new Date(visit.data.slot).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p>{visit.data.firstName ? <p>Professional: {visit.data.firstName}</p> : null}</> : null}
    <p className="ds-note">Only limited visit information is shared. No address, phone number or access code is shown.</p>
  </section></main>
}
