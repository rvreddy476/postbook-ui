/* Blocks, reports, trusted contacts and the data export. */

import api from "@/lib/api"

import { toDataExport, toDataExports, type DataExport } from "../model/dataExport"
import { reportBody, toBlockResult, toBlocks, toReportResult, toTrustedContact, toTrustedContacts, type BlockedPerson, type ReportInput, type ReportResult, type TrustedContact, type TrustedContacts } from "../model/safety"
import { BASE, del, get, post, put, seg } from "./client"

export async function blockUser(targetUserId: string): Promise<{ blocked: boolean }> {
  return toBlockResult(await post("/safety/block", { target_user_id: targetUserId }))
}

export async function fetchBlocks(): Promise<BlockedPerson[]> {
  return toBlocks(await get("/blocks"))
}

/** Unblocking restores nothing the block severed. */
export async function unblockUser(userId: string): Promise<void> {
  await del(`/blocks/${seg(userId)}`)
}

export async function sendReport(input: ReportInput): Promise<ReportResult> {
  return toReportResult(await post("/safety/report", reportBody(input)))
}

export async function fetchTrustedContacts(): Promise<TrustedContacts> {
  return toTrustedContacts(await get("/safety/trusted-contacts"))
}

export async function putTrustedContact(contactId: string, shareLocationOnPanic: boolean): Promise<TrustedContact | null> {
  return toTrustedContact(await put(`/safety/trusted-contacts/${seg(contactId)}`, { share_location_on_panic: shareLocationOnPanic }))
}

export async function deleteTrustedContact(contactId: string): Promise<void> {
  await del(`/safety/trusted-contacts/${seg(contactId)}`)
}

export async function requestDataExport(): Promise<DataExport | null> {
  return toDataExport(await post("/data-export"))
}

export async function fetchDataExports(): Promise<DataExport[]> {
  return toDataExports(await get("/data-export/me"))
}

/** The finished export as a file. Not an envelope: the body IS the document. */
export async function downloadDataExport(id: string): Promise<Blob> {
  const res = await api.get(`${BASE}/data-export/${seg(id)}/download`, { responseType: "blob" })
  return res.data as Blob
}
