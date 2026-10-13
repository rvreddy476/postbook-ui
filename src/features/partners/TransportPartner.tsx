"use client"

import { Suspense, useRef, useState, type FormEvent } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Bike, ClipboardCheck, ShieldCheck, Truck } from "lucide-react"
import { HeaderBar } from "@/features/reels/components/HeaderBar"
import { VideoShell } from "@/features/video-shell/VideoShell"
import { WorkspaceNavigation } from "@/features/video-shell/WorkspaceShell"
import { useAuthUser } from "@/store/auth"
import { DRIVER_TYPES, DELIVERY_VEHICLES, RIDE_VEHICLES, type Registration, type TransportModule, type PartnerProfile } from "./model"
import { addRideVehicle, cities, partnerFailure, readProfile, readReview, rideVehicles, saveRegistration } from "./api"
import "./partners.css"
import { PartnerDocuments } from "./Documents"
import { VehicleDocuments } from "./VehicleDocuments"
import { IntroductionSubmission } from "./IntroductionSubmission"

const human = (value: string) => value.replaceAll("_", " ").toLowerCase()
export function TransportPartner({ module }: { module: TransportModule }) {
  const user = useAuthUser()
  const key = ["partner", module, user?.id ?? "signed-out"]
  const me = useQuery({ queryKey: [...key, "profile"], queryFn: ({ signal }) => readProfile(module, signal), enabled: !!user, retry: false, gcTime: 0 })
  const href = module === "ride" ? "/mopedu/partner" : "/feast/delivery"
  const Icon = module === "ride" ? Bike : Truck
  const name = module === "ride" ? "Mopedu Partner" : "Feast Delivery"
  return <div className="service-workspace">
    <VideoShell app="workspace" header={<HeaderBar hideSearch hideCreate brand={{ key: module + "-partner", name, href, icon: Icon, prefixes: [href], searchPlaceholder: "" }} />}
      navigation={props => <WorkspaceNavigation {...props} partner title={name} links={[{ label: "My application & workspace", href, icon: ClipboardCheck }]} />}>
      <main id="workspace-content" className="transport-partner" tabIndex={-1}>
        <header className="transport-partner__heading"><p>PARTNER WORKSPACE</p><h1>{module === "ride" ? "Drive with Mopedu" : "Deliver with Feast"}</h1><span>Your profile, vehicle and verification—separate from your customer portal.</span></header>
        {!user || me.isPending ? <p role="status">Loading your partner account…</p> : me.isError ? <Failure error={me.error} retry={() => void me.refetch()} /> : me.data ? <Suspense fallback={<p role="status">Loading workspace…</p>}><Account key={user.id} module={module} partner={me.data} userId={user.id} /></Suspense> : <RegistrationForm module={module} userId={user.id} />}
      </main>
    </VideoShell>
  </div>
}
function Failure({ error, retry }: { error: unknown; retry: () => void }) {
  return <div className="transport-partner__card"><p role="alert">{partnerFailure(error)}</p><button type="button" onClick={retry}>Try again</button></div>
}
function RegistrationForm({ module, userId }: { module: TransportModule; userId: string }) {
  const query = useQueryClient()
  const cityQuery = useQuery({ queryKey: ["partner", "ride", userId, "cities"], queryFn: ({ signal }) => cities(signal), enabled: module === "ride", retry: false })
  const [form, setForm] = useState<Registration>({ full_name: "", phone: "", email: "", city: "", partner_type: "individual_driver", vehicle_type: "MOTORCYCLE", vehicle_number: "" })
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const set = (key: keyof Registration) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(previous => ({ ...previous, [key]: e.target.value }))
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (locked.current) return
    locked.current = true; setBusy(true); setError("")
    try {
      const saved = await saveRegistration(module, form, cityQuery.data?.map(c => c.id) ?? [])
      query.setQueryData(["partner", module, userId, "profile"], saved)
    } catch (e) { setError(partnerFailure(e)) }
    finally { locked.current = false; setBusy(false) }
  }
  return <div className="transport-partner__grid">
    <form onSubmit={submit} className="transport-partner__card"><h2>Partner details</h2><p>Required fields are marked *. Details stay in this form if saving fails.</p>
      <fieldset disabled={busy} className="transport-partner__fields">
        <label>Full name *<input required minLength={2} maxLength={120} autoComplete="name" value={form.full_name} onChange={set("full_name")} /></label>
        <label>Phone number *<input type="tel" required maxLength={21} autoComplete="tel" placeholder="+91…" value={form.phone} onChange={set("phone")} /></label>
        <label>Email <input type="email" maxLength={254} autoComplete="email" value={form.email} onChange={set("email")} /></label>
        {module === "ride" ? <>
          <label>Driver type *<select value={form.partner_type} onChange={set("partner_type")}>{DRIVER_TYPES.map(type => <option key={type} value={type}>{human(type)}</option>)}</select></label>
          <label>Operating city *<select required disabled={!cityQuery.data?.length} value={form.city} onChange={set("city")}><option value="">Choose your city</option>{cityQuery.data?.map(city => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label>
        </> : <>
          <label>Operating city *<input required maxLength={120} autoComplete="address-level2" value={form.city} onChange={set("city")} /></label>
          <label>Delivery vehicle *<select value={form.vehicle_type} onChange={set("vehicle_type")}>{DELIVERY_VEHICLES.map(type => <option key={type} value={type}>{human(type)}</option>)}</select></label>
          <label>Vehicle registration {form.vehicle_type !== "BICYCLE" && "*"}<input required={form.vehicle_type !== "BICYCLE"} maxLength={30} value={form.vehicle_number} onChange={set("vehicle_number")} /></label>
        </>}
      </fieldset>
      {module === "ride" && (cityQuery.isPending ? <p role="status">Loading available cities…</p> : cityQuery.isError ? <Failure error={cityQuery.error} retry={() => void cityQuery.refetch()} /> : !cityQuery.data?.length ? <p role="status">No operating cities are available yet. Registration will open when a city is enabled.</p> : null)}
      {error && <p className="transport-partner__error" role="alert">{error}</p>}
      <button type="submit" disabled={busy || module === "ride" && !cityQuery.data?.length}>{busy ? "Saving…" : "Save & continue"}</button>
    </form>
    <aside className="transport-partner__card"><ShieldCheck size={24} aria-hidden="true" /><h2>Verification comes next</h2><p>Identity verification, vehicle documents where required, and payout details are reviewed before you can work.</p><p>Registering never grants approval. We display the verification status returned by the service.</p><p>Do not upload identity documents as public photos or send document numbers through support chat.</p></aside>
  </div>
}
function Account({ module, partner, userId }: { module: TransportModule; partner: PartnerProfile; userId: string }) {
  const tab = useSearchParams().get("tab") ?? "dashboard"
  const router = useRouter()
  const href = module === "ride" ? "/mopedu/partner" : "/feast/delivery"
  const checks = useQuery({ queryKey: ["partner", module, userId, "review"], queryFn: ({ signal }) => readReview(module, signal), retry: false, gcTime: 0, refetchInterval: 30_000 })
  return <div className="transport-partner__grid">
    {tab !== "setup" && tab !== "vehicles" && <section className="transport-partner__card"><h2>{partner.full_name}</h2><p className="transport-partner__status">Account status: {human(partner.status)}</p><p>{partner.phone}</p>{partner.city && <p>{partner.city}</p>}{partner.vehicle_type && <p>Vehicle: {human(partner.vehicle_type)} {partner.vehicle_number}</p>}
      <h2>Verification checklist</h2>
      {checks.isPending ? <p role="status">Loading verification…</p> : checks.isError ? <Failure error={checks.error} retry={() => void checks.refetch()} /> : checks.data && <>
        <p>Verification: {human(checks.data.status)}</p>
        {checks.data.missing.length > 0 && <><p className="transport-partner__error">Complete the required details before you can receive assignments.</p><h3>Still required</h3><ul>{checks.data.missing.map(step => <li key={step}>{human(step)}</li>)}</ul></>}
        {checks.data.pending.length > 0 && <><h3>Awaiting review</h3><ul>{checks.data.pending.map(step => <li key={step}>{human(step)}</li>)}</ul></>}
        <button type="button" onClick={() => void checks.refetch()}>Refresh status</button>
      </>}
      <button type="button" onClick={() => router.push(href + "?tab=setup")}>Review work settings</button>
    </section>}
    {tab === "setup" && <><div className="transport-partner__card"><IntroductionSubmission module={module} onSaved={()=>{void checks.refetch()}}/></div>
    <PartnerDocuments module={module} userId={userId} /></>}
    {module === "ride" && tab === "vehicles" && <VehicleDocuments userId={userId} />}
    {module === "ride" ? (tab === "vehicles" ? <Vehicles userId={userId} /> : null) : tab !== "setup" && <aside className="transport-partner__card"><Truck size={24} aria-hidden="true" /><h2>Delivery partner account</h2><p>Your delivery profile is separate from customer orders. Approval requires identity and document checks plus a payout account.</p><p>This screen does not switch you online or accept jobs.</p></aside>}
  </div>
}
function Vehicles({ userId }: { userId: string }) {
  const list = useQuery({ queryKey: ["partner", "ride", userId, "vehicles"], queryFn: ({ signal }) => rideVehicles(signal), retry: false, gcTime: 0 })
  const [type, setType] = useState("bike"), [registration, setRegistration] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("")
  const locked = useRef(false)
  return <form className="transport-partner__card" onSubmit={async event => {
    event.preventDefault(); if (locked.current) return
    locked.current = true; setBusy(true); setError("")
    try { await addRideVehicle(type, registration); setRegistration(""); await list.refetch() } catch (e) { setError(partnerFailure(e)) }
    finally { locked.current = false; setBusy(false) }
  }}><h2>Your vehicles</h2>
    {list.isPending ? <p>Loading vehicles…</p> : list.isError ? <Failure error={list.error} retry={() => void list.refetch()} /> : <ul>{list.data?.map(v => <li key={v.id}>{v.registration} · {human(v.status)}</li>)}</ul>}
    <fieldset disabled={busy} className="transport-partner__fields"><label>Vehicle type *<select value={type} onChange={e => setType(e.target.value)}>{RIDE_VEHICLES.map(v => <option key={v} value={v}>{human(v)}</option>)}</select></label><label>Registration number *<input value={registration} maxLength={30} required onChange={e => setRegistration(e.target.value)} /></label></fieldset>
    {error && <p role="alert" className="transport-partner__error">{error}</p>}<button disabled={busy || list.isError || list.isPending}>{busy ? "Adding…" : "Add vehicle"}</button><p>Adding a vehicle does not approve it for rides.</p>
  </form>
}
