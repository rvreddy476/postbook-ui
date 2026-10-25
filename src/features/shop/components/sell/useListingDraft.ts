"use client"

// One listing's trip from nothing to the review queue. The first save POSTs
// /products; every save after that PATCHes the id it returned. The matrix
// half of an edit is: create rows that have no variant yet (POST
// …/variants), then PATCH variation_axes + variants naming EVERY variant,
// then reprice the rows the seller touched (PATCH /variants/:id).

import { useCallback, useRef, useState } from "react"
import { addVariant, createListing, patchListing, patchVariant, submitProduct, type CreateListingBody, type PatchListingBody } from "../../api/sell"
import { parseMinor } from "../../money"
import { useInvalidateProduct } from "../../hooks/sell"
import type { FieldErrorMap } from "../../model/attributes"
import { mergeServerErrors } from "../../model/attributes"
import { apiMessage, submitProductError } from "../../model/sell"
import {
  attributeErrorsFrom,
  axesPayload,
  incompleteFrom,
  notPatchableFrom,
  patchVariantsPayload,
  priceAboveMrpFrom,
  problemsOntoRows,
  returnPolicyInvalidFrom,
  revalidationFrom,
  skuLockedFrom,
  variationProblemsFrom,
  type MatrixRow,
  type RowProblems,
} from "../../model/sellListing"

/** What a typed stock field sends: blank is 0, as singleVariantPayload does on create. */
function stockQtyOf(text: string): number {
  const t = text.trim()
  return t === "" ? 0 : Number(t)
}

export interface RevalidationPrompt {
  fields: string[]
  confirm: () => void
  cancel: () => void
}

export interface MatrixSave {
  axes: string[]
  rows: MatrixRow[]
}

/** The single-variant half of an edit: the one row's id and money. */
export interface SingleSave {
  variantId: string | null
  sku: string
  mrpMinor: number
  priceMinor: number
  /** Opening stock, sent only when the variant is CREATED; later stock moves through the stock ledger. */
  stockQty: number
  dirty: boolean
}

export interface ListingDraft {
  productId: string | null
  saving: boolean
  serverErrors: FieldErrorMap
  clearServerError: (code: string) => void
  variantErrors: RowProblems
  notice: string | null
  savedAt: number | null
  revalidation: RevalidationPrompt | null
  /** Create on the first save, PATCH after. Resolves the product id, or null when refused. */
  save: (body: CreateListingBody, extra: { matrix?: MatrixSave; single?: SingleSave }) => Promise<string | null>
  /** POST /products/:id/submit. */
  submitForReview: () => Promise<boolean>
}

export function useListingDraft(existingProductId: string | null): ListingDraft {
  const invalidate = useInvalidateProduct()
  const [productId, setProductId] = useState<string | null>(existingProductId)
  const [serverErrors, setServerErrors] = useState<FieldErrorMap>({})
  const [variantErrors, setVariantErrors] = useState<RowProblems>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [revalidation, setRevalidation] = useState<RevalidationPrompt | null>(null)
  const [saving, setSaving] = useState(false)

  const pending = useRef<{ body: CreateListingBody; extra: { matrix?: MatrixSave; single?: SingleSave } } | null>(null)
  const sendRef = useRef<(body: CreateListingBody, revalidate: boolean, extra: { matrix?: MatrixSave; single?: SingleSave }) => Promise<string | null>>(async () => null)

  const clearServerError = useCallback((code: string) => {
    setServerErrors((prev) => {
      if (!prev[code]) return prev
      const next = { ...prev }
      delete next[code]
      return next
    })
  }, [])

  async function createMissingVariants(id: string, rows: MatrixRow[]): Promise<MatrixRow[]> {
    const out: MatrixRow[] = []
    for (const row of rows) {
      if (row.variantId || !row.included || row.stranded) {
        out.push(row)
        continue
      }
      const created = await addVariant(id, {
        sku: row.sku.trim(),
        mrp_minor: parseMinor(row.mrp) ?? 0,
        selling_price_minor: parseMinor(row.price) ?? 0,
        stock_qty: stockQtyOf(row.stock),
      })
      out.push(created?.id ? { ...row, variantId: created.id, dirty: false } : row)
    }
    return out
  }

  // A price change goes live at once (the MSeller rule: price and stock are
  // not sent back for review); the server refuses it only when the selling
  // price would be above the MRP (400 PRICE_ABOVE_MRP). `revalidate` still
  // travels when the seller has acknowledged this save, because the same
  // PATCH re-sends the SKU, and an acknowledgement given for the save covers
  // everything in it.
  async function repriceTouchedRows(rows: MatrixRow[], revalidate: boolean): Promise<void> {
    for (const row of rows) {
      if (!row.variantId || !row.dirty) continue
      const mrp = parseMinor(row.mrp)
      const price = parseMinor(row.price)
      if (mrp === null || price === null) continue
      await patchVariant(row.variantId, { sku: row.sku.trim(), mrp_minor: mrp, selling_price_minor: price, ...(revalidate ? { revalidate: true } : {}) })
    }
  }

  async function send(body: CreateListingBody, revalidate: boolean, extra: { matrix?: MatrixSave; single?: SingleSave }): Promise<string | null> {
    setSaving(true)
    setServerErrors({})
    setVariantErrors({})
    setNotice(null)
    setRevalidation(null)
    pending.current = { body, extra }
    let sent: MatrixRow[] = extra.matrix ? extra.matrix.rows.filter((row) => row.included && !row.stranded) : []
    try {
      if (!productId) {
        const created = await createListing(body)
        if (!created?.id) throw new Error("The server created no draft.")
        setProductId(created.id)
        setSavedAt(Date.now())
        invalidate()
        return created.id
      }

      const { variants: _variants, variation_axes: axes, ...columns } = body
      const patch: PatchListingBody = revalidate ? { ...columns, revalidate: true } : columns
      const result = await patchListing(productId, patch)
      if (result?.revalidated && result.notice) setNotice(result.notice)

      if (axes && extra.matrix) {
        const withIds = await createMissingVariants(productId, extra.matrix.rows)
        sent = withIds.filter((row) => !!row.variantId)
        await patchListing(productId, {
          variation_axes: axesPayload(extra.matrix.axes),
          variants: patchVariantsPayload(extra.matrix.axes, withIds),
          ...(revalidate ? { revalidate: true } : {}),
        })
        await repriceTouchedRows(withIds, revalidate)
      } else if (extra.single && extra.single.dirty) {
        if (extra.single.variantId) {
          await patchVariant(extra.single.variantId, { sku: extra.single.sku, mrp_minor: extra.single.mrpMinor, selling_price_minor: extra.single.priceMinor, ...(revalidate ? { revalidate: true } : {}) })
        } else {
          await addVariant(productId, { sku: extra.single.sku, mrp_minor: extra.single.mrpMinor, selling_price_minor: extra.single.priceMinor, stock_qty: extra.single.stockQty })
        }
      }

      setSavedAt(Date.now())
      invalidate(productId)
      return productId
    } catch (err) {
      const variationProblems = variationProblemsFrom(err)
      if (variationProblems) {
        const { rows, unattached } = problemsOntoRows(variationProblems, sent)
        setVariantErrors(rows)
        setNotice(unattached.length > 0 ? `The variant grid was refused. ${unattached.join(" ")}` : "The variant grid was refused. Each problem is marked on its row.")
        return null
      }
      const attributeErrors = attributeErrorsFrom(err)
      if (attributeErrors) {
        setServerErrors(mergeServerErrors({}, attributeErrors))
        setNotice("The catalogue refused some answers. Each one is marked on its field.")
        return null
      }
      const needsReview = revalidationFrom(err)
      if (needsReview) {
        setRevalidation({
          fields: needsReview.fields,
          confirm: () => {
            const again = pending.current
            if (again) void sendRef.current(again.body, true, again.extra)
          },
          cancel: () => setRevalidation(null),
        })
        return null
      }
      const locked = skuLockedFrom(err)
      if (locked) {
        setNotice(locked)
        return null
      }
      const aboveMrp = priceAboveMrpFrom(err)
      if (aboveMrp) {
        setNotice(`${aboveMrp.charAt(0).toUpperCase()}${aboveMrp.slice(1)}.`)
        return null
      }
      const badReturns = returnPolicyInvalidFrom(err)
      if (badReturns) {
        setNotice("Choose one of the return windows offered. Nothing was changed.")
        return null
      }
      const refused = notPatchableFrom(err)
      if (refused) {
        setNotice(refused.patchable.length > 0 ? `${refused.message} What can still be changed: ${refused.patchable.join(", ")}.` : refused.message)
        return null
      }
      setNotice(apiMessage(err, "Could not save this listing. Nothing was changed."))
      return null
    } finally {
      setSaving(false)
    }
  }
  sendRef.current = send

  return {
    productId,
    saving,
    serverErrors,
    clearServerError,
    variantErrors,
    notice,
    savedAt,
    revalidation,
    save: (body, extra) => send(body, false, extra),
    submitForReview: async () => {
      if (!productId) return false
      setNotice(null)
      try {
        await submitProduct(productId)
        invalidate(productId)
        return true
      } catch (err) {
        const gaps = incompleteFrom(err)
        setNotice(gaps && gaps.length > 0 ? `Still needed: ${gaps.map((g) => g.label).join(", ")}.` : submitProductError(err))
        return false
      }
    },
  }
}
