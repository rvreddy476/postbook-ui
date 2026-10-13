"use client"

import { partnerApi } from "./api"
import { ReadPanel, usePartnerRead } from "./ui"
import type { decodePartnerChange } from "./model"
import { ChevronDown, ClipboardCheck } from "lucide-react"


const names: Record<string,string> = { profile:"Profile", skills:"Services & skills", area:"Working area", hours:"Working hours", pan:"PAN number" }
export function PartnerChanges() {
  const query = usePartnerRead("changes",partnerApi.changes,30_000)
  return <ReadPanel query={query}>{items => <PartnerChangeHistory items={items} />}</ReadPanel>
}
export function PartnerChangeHistory({ items }: { items: ReturnType<typeof decodePartnerChange>[] }) {
  if (!items.length) return null
  const pending = items.filter(i => i.status === "pending").length
  const rejected = items.filter(i => i.status === "rejected").length
  return <details className="ds-card dsp-review-history">
    <summary><ClipboardCheck size={20} aria-hidden /><span>Changes & review<small>View your submitted updates</small></span><span className="dsp-review-count">{pending > 0 && <span className="ds-tag ds-tag--warn">{pending} awaiting review</span>}{rejected > 0 && <span className="ds-tag dsp-review-rejected">{rejected} returned</span>}{!pending && !rejected && <span className="ds-tag ds-tag--good">All updates reviewed</span>}</span><ChevronDown className="dsp-review-chevron" size={18} aria-hidden /></summary>
    <div className="dsp-review-items"><p className="ds-sub">Approved details stay in use until your changes are reviewed.</p>
    {items.map(item => <div className={`dsp-review-item${item.status === "rejected" ? " is-rejected" : ""}`} key={item.id}>
      <strong>{names[item.kind] ?? "Account details"} · {item.status === "pending" ? "Awaiting admin review" : item.status === "approved" ? "Approved" : "Changes requested"}</strong>
      {item.kind === "area" && typeof (item.payload.area as Record<string,unknown> | undefined)?.area_label === "string" && <p>{String((item.payload.area as Record<string,unknown>).area_label)}</p>}
      {item.reason && <p>{item.reason}</p>}
    </div>)}</div>
  </details>
}
