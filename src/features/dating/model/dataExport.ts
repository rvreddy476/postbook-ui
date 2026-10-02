/* DPDP data export: POST /data-export, GET /data-export/me, GET /data-export/:id/download. */

import { arr, obj, str, time } from "./wire"

export interface DataExport {
  id: string
  status: string
  requestedAt: string
  completedAt: string
}

export function toDataExport(wire: unknown): DataExport | null {
  const w = obj(wire)
  const id = str(w.id)
  return id ? { id, status: str(w.status), requestedAt: time(w.requested_at), completedAt: time(w.completed_at) } : null
}

export function toDataExports(wire: unknown): DataExport[] {
  return arr(wire)
    .map(toDataExport)
    .filter((e): e is DataExport => e !== null)
}

export function exportView(e: Pick<DataExport, "status">): { label: string; downloadable: boolean } {
  switch (e.status) {
    case "ready":
      return { label: "Ready to download", downloadable: true }
    case "pending":
    case "processing":
      return { label: "Being prepared", downloadable: false }
    case "failed":
      return { label: "Couldn't be prepared. Request a new one.", downloadable: false }
    case "expired":
      return { label: "Expired. Request a new one.", downloadable: false }
    default:
      return { label: "Unknown", downloadable: false }
  }
}

export const hasPendingExport = (exports: DataExport[]) => exports.some((e) => e.status === "pending" || e.status === "processing")

export const exportFileName = (id: string) => `pulse-data-export-${id}.json`
