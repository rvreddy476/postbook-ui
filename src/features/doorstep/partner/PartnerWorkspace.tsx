"use client"

import { ArrowRight, CalendarCheck, CalendarDays, CircleDollarSign, Clock3, MapPin, ReceiptText, ShieldCheck, SlidersHorizontal, Wallet, Wrench, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { useState, type ReactNode } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { useAuthUser } from "@/store/auth"
import { formatPaise } from "../model/money"
import { Busy, ErrorState } from "../components/parts"
import { partnerApi } from "./api"
import { PartnerOffers } from "./PartnerOffers"
import { canContactCustomer, CustomerContact } from "./CustomerContact"
import { canWork, pricePaise, type Partner, type PriceItem, type Readiness } from "./model"
import { Field, partnerKey, ReadPanel, SaveForm, statusWords, usePartnerRead } from "./ui"
import { filterPartnerJobs, partnerDate, type JobFilter, type PartnerEarningsData, type PartnerJob } from "./workspaceView"

export function PartnerPrices({ editable }: { editable: boolean }) {
  const skills = usePartnerRead("my-skills", partnerApi.mySkills)
  const prices = usePartnerRead("prices", partnerApi.prices, 30_000)
  return <ReadPanel query={prices}>{list => <div className="ds-stack">
    {list.some(s => s.pricing_mode === "admin_fixed") ? <><section className="ds-card"><h2 className="ds-h2">Your services</h2><p className="ds-sub">Service prices are set by Doorstep. Your earning estimate is shown with each request.</p></section>{list.map(s => <section className="ds-card" key={s.service_id}><span className="dsp-eyebrow">{s.category_name}</span><h2 className="ds-h2">{s.service_name}</h2><span className="ds-tag">{s.bookable ? "Ready for requests" : "Setup or review required"}</span>{s.items.map(item => <div className="ds-row" key={item.item_id}><span className="ds-grow">{item.name}</span><strong>{item.suggested_price_paise === null ? "Price not set" : formatPaise(item.suggested_price_paise)}</strong></div>)}</section>)}</> : <>
    {list.length > 0 && <div className="dsp-price-overview"><div><strong>{list.length}</strong><span>Services</span></div><div><strong>{list.filter(s => s.bookable).length}</strong><span>Bookable</span></div><div><strong>{list.flatMap(s => s.items).filter(i => i.pending).length}</strong><span>Prices in review</span></div><p>Approved prices stay live while updates are reviewed.</p></div>}
    {!list.length ? <PartnerEmpty icon={Wrench} title="No services to price yet" text={skills.data?.length ? "Your services are saved. Pricing options are not available yet; please contact support." : "Choose the services you offer in Work settings to start setting prices."} action={<Link href="/doorstep/partner?tab=setup&step=skills" className="ds-btn ds-btn--outline">Review services<ArrowRight size={16} aria-hidden /></Link>} /> :
      list.map(s => <section className="ds-card dsp-service-prices" key={s.service_id}><div className="ds-head"><div><span className="dsp-eyebrow">{s.category_name}</span><h2 className="ds-h2">{s.service_name}</h2><p className="ds-sub">Service review · {statusWords(s.skill_status)}</p></div><span className={`ds-tag ${s.bookable ? "ds-tag--good" : "ds-tag--warn"}`}>{s.bookable ? "Bookable" : "Not bookable yet"}</span></div><div className="ds-stack">{s.items.map(item => <PriceRow key={item.item_id} item={item} serviceId={s.service_id} editable={editable} />)}</div></section>)}
  </>}
  </div>}</ReadPanel>
}
export function PriceRow({ item, serviceId, editable }: { item: PriceItem; serviceId: string; editable: boolean }) {
  const [price, setPrice] = useState("")
  return <div className="ds-partner-price"><div><h3 className="ds-h2">{item.name}</h3><p className="ds-sub">{item.unit.replaceAll("_", " ")} · {item.item_kind === "addon" ? "Add-on" : "Service option"}</p><div className="dsp-price-current"><small>Approved price</small><strong>{item.approved ? formatPaise(item.approved.price_paise) : "Not set"}</strong>{item.suggested_price_paise !== null && <span>Suggested: {formatPaise(item.suggested_price_paise)}</span>}</div>{item.rejected && <p className="ds-alert">Price rejected: {item.rejected.reason ?? "Please contact the review team."}</p>}</div>{item.pending ? <SaveForm disabled={!editable} label="Withdraw pending price" save={() => partnerApi.withdrawPrice(item.pending!.id)}><p className="ds-info">{formatPaise(item.pending.price_paise)} is awaiting review.</p></SaveForm> : <SaveForm label="Submit price" disabled={!editable} save={() => partnerApi.submitPrice({ service_id: serviceId, item_kind: item.item_kind, item_id: item.item_id, price_paise: pricePaise(price) })} onSaved={() => setPrice("")}><Field label="New price (₹, including GST)"><input className="ds-input" required aria-label={`New price for ${item.name}`} inputMode="decimal" placeholder="Enter amount" value={price} onChange={e => setPrice(e.target.value)} /></Field></SaveForm>}</div>
}

function usePartnerJobs() {
  const user = useAuthUser()
  return useInfiniteQuery({ queryKey: [...partnerKey(user?.id ?? ""), "jobs"], queryFn: ({ pageParam }) => partnerApi.jobs(pageParam), initialPageParam: undefined as string | undefined, getNextPageParam: page => page.next_cursor ?? undefined, enabled: Boolean(user), retry: false, gcTime: 0, refetchInterval: 30_000 })
}
export function PartnerMetric({ icon: Icon, label, children, note }: { icon: LucideIcon; label: string; children: ReactNode; note: string }) {
  return <article className="ds-card dsp-metric"><div><span className="dsp-metric__icon"><Icon size={21} aria-hidden /></span><span>{label}</span></div><div className="dsp-metric__value">{children}</div><p>{note}</p></article>
}
export function PartnerQuickLinks() {
  return <section className="dsp-quick-links" aria-label="Manage your work">
    <Link href="/doorstep/partner?tab=setup&step=service_area"><MapPin size={20} aria-hidden /><span><strong>Working area</strong><small>Location & travel radius</small></span><ArrowRight size={17} aria-hidden /></Link>
    <Link href="/doorstep/partner?tab=setup&step=weekly_hours"><Clock3 size={20} aria-hidden /><span><strong>Working hours</strong><small>Your weekly availability</small></span><ArrowRight size={17} aria-hidden /></Link>
    <Link href="/doorstep/partner?tab=prices"><SlidersHorizontal size={20} aria-hidden /><span><strong>Services & prices</strong><small>Manage what you offer</small></span><ArrowRight size={17} aria-hidden /></Link>
  </section>
}
export function PartnerDashboard({ partner, readiness }: { partner: Partner; readiness: Readiness }) {
  const duty = usePartnerRead("duty", partnerApi.duty, 30_000)
  const earnings = usePartnerRead("earnings", partnerApi.earnings, 30_000)
  const prices = usePartnerRead("prices", partnerApi.prices, 30_000)
  const jobs = usePartnerJobs()
  return <div className="dsp-dashboard">
    {canWork(partner, readiness) && <div className="dsp-ready"><ShieldCheck size={22} aria-hidden /><div><strong>Your account is cleared for duty</strong><p>Manage availability, service offers and visits in Doorstep Pro.</p></div><span className="ds-tag ds-tag--good">Ready</span></div>}
    <div className="dsp-metrics">
      <PartnerMetric icon={CalendarCheck} label="Completed jobs" note="Your completed service visits"><strong>{partner.jobs_completed}</strong></PartnerMetric>
      <PartnerMetric icon={Clock3} label="Availability" note="Managed in Doorstep Pro"><ReadPanel query={duty}>{d => <strong className={d.on_duty ? "dsp-on-duty" : ""}>{d.on_duty ? "On duty" : "Off duty"}</strong>}</ReadPanel></PartnerMetric>
      <PartnerMetric icon={CircleDollarSign} label="Recorded earnings" note="Recorded total, not a payout balance"><ReadPanel query={earnings}>{e => <strong>{formatPaise(e.total_paise)}</strong>}</ReadPanel></PartnerMetric>
      <PartnerMetric icon={Wrench} label="Bookable services" note="Services with approved availability"><ReadPanel query={prices}>{s => <strong>{s.filter(v => v.bookable).length}</strong>}</ReadPanel></PartnerMetric>
    </div>
    <PartnerQuickLinks />
    {partner.status === "approved" && <PartnerOffers />}
    <section className="ds-card dsp-jobs-section"><div className="ds-head"><div><h2 className="ds-h2">Recent jobs</h2><p className="ds-sub">Your latest assigned work.</p></div><Link href="/doorstep/partner?tab=jobs" className="dsp-link">View all jobs<ArrowRight size={16} aria-hidden /></Link></div>
      {jobs.isPending ? <Busy label="Loading jobs…" /> : jobs.isError ? <ErrorState error={jobs.error} what="Jobs" onRetry={() => void jobs.refetch()} /> : <PartnerJobsList items={jobs.data?.pages.flatMap(p => p.items).slice(0, 5) ?? []} />}
    </section>
  </div>
}
export function PartnerJobs() {
  const jobs = usePartnerJobs()
  const [filter, setFilter] = useState<JobFilter>("all")
  const items = jobs.data?.pages.flatMap(p => p.items) ?? []
  return <><PartnerOffers /><section className="ds-card dsp-jobs-section">
    <div className="ds-head"><div className="dsp-filters" role="group" aria-label="Filter jobs">{(["all", "active", "completed"] as const).map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === "all" ? "All jobs" : value === "active" ? "Active" : "Completed"}</button>)}</div><p className="ds-meta">Times in India Standard Time</p></div>
    <p className="dsp-inline-note"><CalendarDays size={17} aria-hidden />Accepted requests appear here. Wait for payment confirmation before starting a visit.</p>
    {jobs.isPending ? <Busy label="Loading jobs…" /> : jobs.isError ? <ErrorState error={jobs.error} what="Jobs" onRetry={() => void jobs.refetch()} /> : <PartnerJobsList items={filterPartnerJobs(items, filter)} filtered={filter !== "all"} />}
    {jobs.hasNextPage && <div className="dsp-load-more"><p className="ds-meta">Filters apply to loaded jobs. Load more to include earlier records.</p><button type="button" className="ds-btn ds-btn--outline" disabled={jobs.isFetchingNextPage} onClick={() => void jobs.fetchNextPage()}>{jobs.isFetchingNextPage ? "Loading…" : "Load more jobs"}</button></div>}
  </section></>
}
export function PartnerJobsList({ items, filtered = false }: { items: PartnerJob[]; filtered?: boolean }) {
  if (!items.length) return <PartnerEmpty icon={CalendarDays} title={filtered ? "No matching jobs in this list" : "Your next job starts here"} text={filtered ? "Choose another filter, or load more jobs if available." : "Assigned visits will appear here with the service, appointment and estimated earning."} />
  return <ul className="dsp-jobs-list">{items.map(j => <li key={j.booking_id}><span className="dsp-job-icon"><Wrench size={21} aria-hidden /></span><div className="dsp-job-details"><h3>{j.service_name}</h3><p><MapPin size={13} aria-hidden />{j.locality}</p><p><CalendarDays size={13} aria-hidden /><time dateTime={j.slot_start}>{partnerDate(j.slot_start)} IST</time></p>{canContactCustomer(j.status) && <CustomerContact key={j.booking_id} bookingId={j.booking_id} />}</div><span className={`ds-tag ${j.status === "completed" ? "ds-tag--good" : ""}`}>{statusWords(j.status)}</span><div className="dsp-job-earning"><strong>{formatPaise(j.earning_estimate_paise)}</strong><small>Estimated earning</small></div></li>)}</ul>
}
export function PartnerEarnings() {
  const query = usePartnerRead("earnings", partnerApi.earnings, 30_000)
  return <ReadPanel query={query}>{data => <PartnerEarningsStatement data={data} />}</ReadPanel>
}
export function PartnerEarningsStatement({ data }: { data: PartnerEarningsData }) {
  return <div className="ds-stack"><section className="dsp-earnings-hero"><span className="dsp-metric__icon"><Wallet size={24} aria-hidden /></span><div><p>Recorded earnings</p><h2>{formatPaise(data.total_paise)}</h2><small>Earnings and adjustments recorded for your work.</small></div><span className="dsp-payout-status">Payouts are not enabled yet</span></section><section className="ds-card"><div className="ds-head"><div><h2 className="ds-h2">Earnings activity</h2><p className="ds-sub">Individual entries, including commissions and adjustments.</p></div></div>{!data.lines.length ? <PartnerEmpty icon={ReceiptText} title="No earnings activity yet" text="Entries will appear here when earnings are recorded for your service visits." /> : <div className="dsp-ledger-wrap"><table className="dsp-ledger"><caption className="sr-only">Recorded earnings activity</caption><thead><tr><th scope="col">Entry</th><th scope="col">Date · IST</th><th scope="col">Amount</th></tr></thead><tbody>{data.lines.map(line => <tr key={line.id}><td><strong>{statusWords(line.kind)}</strong><small>Job · {line.booking_id.slice(-8)}</small></td><td><time dateTime={line.created_at}>{partnerDate(line.created_at)}</time></td><td className={line.amount_paise < 0 ? "dsp-debit" : "dsp-credit"}>{formatPaise(line.amount_paise)}</td></tr>)}</tbody></table></div>}</section></div>
}
export function PartnerEmpty({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text: string; action?: ReactNode }) {
  return <div className="dsp-empty"><span><Icon size={27} aria-hidden /></span><h3>{title}</h3><p>{text}</p>{action}</div>
}
