"use client"

/* Blocks, reports, trusted contacts and the data export. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { blockUser, deleteTrustedContact, downloadDataExport, fetchBlocks, fetchDataExports, fetchTrustedContacts, putTrustedContact, requestDataExport, sendReport, unblockUser } from "../api/safety"
import { exportFileName, hasPendingExport, type DataExport } from "../model/dataExport"
import type { BlockedPerson, ReportInput, ReportResult, TrustedContacts } from "../model/safety"
import { errorStatus } from "../model/wire"
import { KEYS } from "./profile"

const retry = (count: number, error: unknown) => {
  const status = errorStatus(error)
  if (status >= 400 && status < 500) return false
  return count < 2
}

/** A block removes the person from everything: every list that could hold them is re-read. */
function useAfterBlock() {
  const qc = useQueryClient()
  return () => {
    for (const key of [KEYS.blocks, KEYS.matches, KEYS.sparks, KEYS.deck, KEYS.trusted]) {
      void qc.invalidateQueries({ queryKey: key })
    }
  }
}

export function useBlock() {
  const after = useAfterBlock()
  return useMutation<{ blocked: boolean }, unknown, string>({ mutationFn: blockUser, onSuccess: after })
}

export function useBlocks() {
  return useQuery<BlockedPerson[]>({ queryKey: KEYS.blocks, queryFn: fetchBlocks, retry })
}

export function useUnblock() {
  const qc = useQueryClient()
  return useMutation<void, unknown, string>({
    mutationFn: unblockUser,
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEYS.blocks }),
  })
}

export function useReport() {
  const after = useAfterBlock()
  return useMutation<ReportResult, unknown, ReportInput>({
    mutationFn: sendReport,
    onSuccess: (result) => {
      if (result.blocked) after()
    },
  })
}

export function useTrustedContacts() {
  return useQuery<TrustedContacts>({ queryKey: KEYS.trusted, queryFn: fetchTrustedContacts, retry })
}

export function usePutTrustedContact() {
  const qc = useQueryClient()
  return useMutation<unknown, unknown, { contactId: string; shareLocationOnPanic: boolean }>({
    mutationFn: (v) => putTrustedContact(v.contactId, v.shareLocationOnPanic),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEYS.trusted }),
  })
}

export function useDeleteTrustedContact() {
  const qc = useQueryClient()
  return useMutation<void, unknown, string>({
    mutationFn: deleteTrustedContact,
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEYS.trusted }),
  })
}

export function useDataExports() {
  return useQuery<DataExport[]>({
    queryKey: KEYS.exports,
    queryFn: fetchDataExports,
    retry,
    // An export is prepared in the background; look again while one is on its way.
    refetchInterval: (query) => (hasPendingExport(query.state.data ?? []) ? 15_000 : false),
  })
}

export function useRequestDataExport() {
  const qc = useQueryClient()
  return useMutation<unknown, unknown, void>({
    mutationFn: () => requestDataExport(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEYS.exports }),
  })
}

/** Fetches the document with the token, then hands the browser a file to save. */
export function useDownloadDataExport() {
  return useMutation<void, unknown, string>({
    mutationFn: async (id) => {
      const blob = await downloadDataExport(id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = exportFileName(id)
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    },
  })
}
