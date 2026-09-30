"use client"

// /shop/sell/products/new and /shop/sell/products/[id]: the one guided
// listing editor. Category (tree) → details (built-in columns + the
// category's attribute schema) → price and variants (a single offer, or the
// variation matrix) → images → review (GET /products/:id/readiness) → Submit.

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useGlobalToast } from "@/contexts/ToastContext"
import { fetchProductVariants, type CategoryNode, type CreateListingBody } from "../api/sell"
import { parseMinor } from "../money"
import { useAttributeSchema, useCategoryTree, useProductDetail, useProductReadiness, useSellerStatus, useTaxClasses } from "../hooks/sell"
import {
  emptyValueFor,
  fieldErrorMessage,
  groupProgress,
  validate,
  type AttributeDefinition,
  type AttributeValue,
  type AttributeValueMap,
} from "../model/attributes"
import { sellerStatusBanner } from "../model/sell"
import {
  EDITOR_STEPS,
  EDITOR_STEP_LABEL,
  RETURN_POLICIES,
  arrangeGroups,
  attributeValuesFromProduct,
  axesPayload,
  axisCandidates,
  basicsFromProduct,
  createVariantsPayload,
  editorStepUnlocked,
  emptyBasics,
  emptyMatrix,
  emptyOffer,
  listingColumns,
  localProblems,
  matrixFromVariants,
  matrixRows,
  minorToRupees,
  singleVariantPayload,
  stepForGap,
  toAttributePayload,
  validateBasics,
  validateOffer,
  type EditorStep,
  type ListingBasics,
  type ListingOffer,
  type MatrixState,
  type RowProblems,
} from "../model/sellListing"
import { AttributeField } from "../components/sell/AttributeField"
import { CategoryPicker, pathTo } from "../components/sell/CategoryPicker"
import { ListingImages } from "../components/sell/ListingImages"
import { Field, Notice, PageHead, Panel, RowsSkeleton, Select, StepRail, TextField, Textarea } from "../components/sell/primitives"
import { NotTradingYet } from "../components/sell/SellerShell"
import { useListingDraft } from "../components/sell/useListingDraft"
import { VariationMatrix } from "../components/sell/VariationMatrix"

export function ListingEditorScreen({ productId: initialProductId }: { productId: string | null }) {
  const status = useSellerStatus()
  const seller = status.data ?? null
  const canTrade = !!seller && sellerStatusBanner(seller).canTrade
  if (!seller) return null
  if (!canTrade) {
    return (
      <div>
        <PageHead title={initialProductId ? "Edit listing" : "New listing"} />
        <NotTradingYet seller={seller} />
      </div>
    )
  }
  return <Editor initialProductId={initialProductId} />
}

function Editor({ initialProductId }: { initialProductId: string | null }) {
  const router = useRouter()
  const toast = useGlobalToast()
  const draft = useListingDraft(initialProductId)
  const tree = useCategoryTree()
  const taxes = useTaxClasses()
  const existing = useProductDetail(initialProductId)

  const [step, setStep] = useState<EditorStep>(initialProductId ? "details" : "category")
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [basics, setBasics] = useState<ListingBasics>(emptyBasics)
  const [offer, setOffer] = useState<ListingOffer>(emptyOffer)
  const [singleVariantId, setSingleVariantId] = useState<string | null>(null)
  const [offerDirty, setOfferDirty] = useState(false)
  const [matrix, setMatrix] = useState<MatrixState>(emptyMatrix)
  const [values, setValues] = useState<AttributeValueMap>({})
  const [attempted, setAttempted] = useState(false)
  const [seeded, setSeeded] = useState(!initialProductId)
  const [matrixSeeded, setMatrixSeeded] = useState(!initialProductId)

  const schema = useAttributeSchema(categoryId)
  const candidates = useMemo(() => axisCandidates(schema.data ?? null), [schema.data])
  const { itemGroups, offerAttributes } = useMemo(() => arrangeGroups(schema.data ?? null), [schema.data])

  // Seed from the existing listing once: columns, answers, category.
  useEffect(() => {
    if (seeded || !existing.data) return
    const p = existing.data.product
    setBasics(basicsFromProduct(p))
    setCategoryId(typeof p.category_id === "string" && p.category_id ? p.category_id : null)
    setValues(attributeValuesFromProduct(existing.data.attributes))
    const plain = existing.data.variants.filter((v) => (v.status || "active") !== "archived")
    const noAxes = plain.every((v) => !(v.option_1_name || "").trim())
    if (noAxes && plain[0]) {
      const v = plain[0]
      setSingleVariantId(v.id)
      setOffer({
        sku: v.sku || "",
        mrp: v.mrp_minor && v.mrp_minor > 0 ? minorToRupees(v.mrp_minor) : v.mrp ? String(v.mrp) : "",
        price: v.selling_price_minor && v.selling_price_minor > 0 ? minorToRupees(v.selling_price_minor) : v.selling_price ? String(v.selling_price) : "",
        stock: typeof v.available_qty === "number" ? String(v.available_qty) : "",
      })
    }
    setSeeded(true)
  }, [seeded, existing.data])

  // The matrix needs the schema's candidates, which arrive after the category.
  useEffect(() => {
    if (matrixSeeded || !seeded || !existing.data || !categoryId || schema.isPending) return
    const loaded = matrixFromVariants(
      candidates,
      existing.data.variants.filter((v) => (v.status || "active") !== "archived").map((v) => ({ ...v, sku: v.sku || "" })),
    )
    if (loaded) setMatrix(loaded)
    setMatrixSeeded(true)
  }, [matrixSeeded, seeded, existing.data, categoryId, schema.isPending, candidates])

  // Blanks for every attribute the schema declares, under whatever is held.
  useEffect(() => {
    if (!schema.data) return
    setValues((prev) => {
      const next: AttributeValueMap = { ...prev }
      for (const g of schema.data?.groups ?? []) for (const def of g.attributes ?? []) if (!(def.code in next)) next[def.code] = emptyValueFor(def)
      return next
    })
  }, [schema.data])

  const categoryNode = useMemo(() => (categoryId && tree.data ? (pathTo(tree.data, categoryId)?.at(-1) ?? null) : null), [categoryId, tree.data])
  const categoryPath = useMemo(() => (categoryId && tree.data ? (pathTo(tree.data, categoryId) ?? []).map((n) => n.name) : []), [categoryId, tree.data])

  const stem = offer.sku
  const rows = useMemo(() => matrixRows(matrix, stem), [matrix, stem])
  const varying = matrix.axes.length > 0
  const basicsErrors = validateBasics(basics)
  const offerErrors = varying ? {} : validateOffer(offer)
  const attrErrors = schema.data ? validate(schema.data, values) : {}
  const gridProblems: RowProblems = useMemo(() => mergeRowProblems(varying ? localProblems(rows) : {}, draft.variantErrors), [varying, rows, draft.variantErrors])
  const gridEmpty = varying && rows.filter((r) => r.included && !r.stranded).length === 0

  const detailsOk = Object.keys(basicsErrors).length === 0 && Object.keys(attrErrors).length === 0
  const variantsOk = varying ? Object.keys(gridProblems).length === 0 && !gridEmpty : Object.keys(offerErrors).length === 0

  function errorFor(def: AttributeDefinition): string | null {
    const fromServer = draft.serverErrors[def.code]
    if (fromServer) return fieldErrorMessage(fromServer, def.label)
    if (!attempted) return null
    const local = attrErrors[def.code]
    return local ? fieldErrorMessage(local, def.label) : null
  }

  function body(): CreateListingBody {
    const columns = listingColumns(categoryId ?? "", basics)
    return {
      ...columns,
      variants: varying ? createVariantsPayload(matrix.axes, rows) : [singleVariantPayload(offer)],
      ...(varying ? { variation_axes: axesPayload(matrix.axes) } : {}),
      ...(schema.data ? { attributes: toAttributePayload(values) } : {}),
    }
  }

  async function saveDraft(): Promise<string | null> {
    setAttempted(true)
    if (!detailsOk) {
      setStep("details")
      return null
    }
    if (!variantsOk) {
      setStep("variants")
      return null
    }
    const id = await draft.save(body(), {
      matrix: varying ? { axes: matrix.axes, rows } : undefined,
      single: varying
        ? undefined
        : { variantId: singleVariantId, sku: offer.sku.trim(), mrpMinor: parseMinor(offer.mrp) ?? 0, priceMinor: parseMinor(offer.price) ?? 0, dirty: offerDirty },
    })
    if (id) {
      setOfferDirty(false)
      // A create wrote the single variant; learn its id so the next price edit
      // PATCHes it rather than adding a second one.
      if (!varying && !singleVariantId) {
        try {
          const vs = await fetchProductVariants(id)
          setSingleVariantId(vs[0]?.id ?? null)
        } catch {
          /* the next save re-reads; nothing to undo */
        }
      }
      // The URL becomes the edit route without remounting the editor (a
      // router.replace would reset the step); a reload lands on the same draft.
      if (!initialProductId && typeof window !== "undefined") window.history.replaceState(window.history.state, "", `/shop/sell/products/${id}`)
    }
    return id
  }

  const loading = !!initialProductId && (!seeded || existing.isPending || (categoryId ? schema.isPending : false))
  const unlocked = (s: EditorStep) => editorStepUnlocked(s, { categoryId, productId: draft.productId })
  const done = new Set<EditorStep>()
  if (categoryId) done.add("category")
  if (draft.productId) {
    done.add("details")
    done.add("variants")
  }

  if (existing.isError) return <Notice tone="danger">This listing could not be loaded.</Notice>

  return (
    <div>
      <PageHead
        title={initialProductId ? "Edit listing" : "New listing"}
        sub={categoryPath.length > 0 ? categoryPath.join(" › ") : undefined}
        actions={
          <Link href="/shop/sell/products" className="shop-sell-link">
            All products
          </Link>
        }
      />
      {loading ? (
        <RowsSkeleton rows={5} />
      ) : (
        <div className="shop-sell-wizard__grid">
          <StepRail steps={EDITOR_STEPS} labels={EDITOR_STEP_LABEL} current={step} done={done} unlocked={unlocked} onPick={setStep} />
          <div className="shop-sell-form">
            {step === "category" ? (
              <Panel title="Category" sub={initialProductId ? "The category is fixed once a listing exists." : "Choose the most specific category. It decides which questions the listing asks."}>
                {tree.isPending ? (
                  <RowsSkeleton rows={4} />
                ) : tree.isError ? (
                  <Notice tone="danger">The categories could not be loaded.</Notice>
                ) : initialProductId ? (
                  <p>{categoryPath.join(" › ") || "No category"}</p>
                ) : (
                  <CategoryPicker
                    roots={tree.data}
                    value={categoryId}
                    onChange={(node: CategoryNode) => {
                      setCategoryId(node.id)
                      setMatrix(emptyMatrix)
                    }}
                  />
                )}
                <div className="shop-sell-actions">
                  <Button type="button" disabled={!categoryId} onClick={() => setStep("details")}>
                    Continue
                  </Button>
                </div>
              </Panel>
            ) : null}

            {step === "details" ? (
              <>
                <Panel title="Product" sub={categoryNode ? `Listed under ${categoryNode.name}.` : undefined}>
                  <TextField id="l-title" label="Title" required value={basics.title} onChange={(v) => setBasics((b) => ({ ...b, title: v }))} error={attempted ? basicsErrors.title : null} maxLength={200} />
                  <Field id="l-desc" label="Description">
                    <Textarea id="l-desc" rows={5} maxLength={5000} value={basics.description} onChange={(e) => setBasics((b) => ({ ...b, description: e.target.value }))} />
                  </Field>
                  <Field id="l-tax" label="GST rate" required error={attempted ? basicsErrors.taxClassId : null} help="Checkout refuses a listing without one.">
                    <Select id="l-tax" value={basics.taxClassId} onChange={(e) => setBasics((b) => ({ ...b, taxClassId: e.target.value }))}>
                      <option value="">{taxes.isPending ? "Loading…" : "Choose…"}</option>
                      {(taxes.data ?? []).map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.rate_percent}%)
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <TextField id="l-hsn" label="HSN code" inputMode="numeric" value={basics.hsnCode} onChange={(v) => setBasics((b) => ({ ...b, hsnCode: v }))} error={attempted ? basicsErrors.hsnCode : null} help="4, 6 or 8 digits. Optional." maxLength={8} />
                  <Field id="l-return" label="Returns">
                    <Select id="l-return" value={basics.returnPolicy} onChange={(e) => setBasics((b) => ({ ...b, returnPolicy: e.target.value }))}>
                      {RETURN_POLICIES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="shop-sell-form__row">
                    <TextField id="l-weight" label="Weight (g)" inputMode="numeric" value={basics.weightGrams} onChange={(v) => setBasics((b) => ({ ...b, weightGrams: v }))} error={attempted ? basicsErrors.weightGrams : null} />
                    <TextField id="l-length" label="Length (cm)" inputMode="decimal" value={basics.lengthCm} onChange={(v) => setBasics((b) => ({ ...b, lengthCm: v }))} error={attempted ? basicsErrors.lengthCm : null} />
                    <TextField id="l-width" label="Width (cm)" inputMode="decimal" value={basics.widthCm} onChange={(v) => setBasics((b) => ({ ...b, widthCm: v }))} error={attempted ? basicsErrors.widthCm : null} />
                    <TextField id="l-height" label="Height (cm)" inputMode="decimal" value={basics.heightCm} onChange={(v) => setBasics((b) => ({ ...b, heightCm: v }))} error={attempted ? basicsErrors.heightCm : null} />
                  </div>
                </Panel>
                {schema.isPending && categoryId ? <RowsSkeleton rows={3} /> : null}
                {itemGroups.map((group) => (
                  <Panel key={group.name} title={group.name} sub={progressText(groupProgress(group, values))}>
                    {group.attributes.map((def) => (
                      <AttributeField key={def.code} def={def} value={values[def.code] ?? null} error={errorFor(def)} onChange={(next: AttributeValue | null) => { draft.clearServerError(def.code); setValues((v) => ({ ...v, [def.code]: next })) }} />
                    ))}
                  </Panel>
                ))}
                {schema.data === null && categoryId && !schema.isPending ? <p className="shop-sell-muted">This category has no questions of its own yet.</p> : null}
                <div className="shop-sell-actions">
                  <Button type="button" onClick={() => { setAttempted(true); if (detailsOk) setStep("variants") }}>
                    Continue
                  </Button>
                  {draft.productId ? (
                    <Button type="button" variant="outline" disabled={draft.saving} onClick={() => void saveDraft()}>
                      {draft.saving ? "Saving…" : "Save"}
                    </Button>
                  ) : null}
                </div>
              </>
            ) : null}

            {step === "variants" ? (
              <>
                <Panel title="Price and variants" sub={varying ? "Money is per row once the listing varies." : "Prices in rupees; the server stores paise exactly as typed."}>
                  {candidates.length > 0 ? (
                    <VariationMatrix candidates={candidates} value={matrix} onChange={setMatrix} stem={offer.sku} problems={attempted || Object.keys(draft.variantErrors).length > 0 ? gridProblems : {}} editing={!!draft.productId} />
                  ) : null}
                  {varying ? (
                    <TextField id="l-stem" label="SKU stem" value={offer.sku} onChange={(v) => setOffer((o) => ({ ...o, sku: v }))} help="Row SKUs are suggested from it." />
                  ) : (
                    <>
                      <TextField id="l-sku" label="SKU" required value={offer.sku} onChange={(v) => { setOfferDirty(true); setOffer((o) => ({ ...o, sku: v })) }} error={attempted ? offerErrors.sku : null} />
                      <div className="shop-sell-form__row">
                        <TextField id="l-mrp" label="MRP (₹)" required inputMode="decimal" value={offer.mrp} onChange={(v) => { setOfferDirty(true); setOffer((o) => ({ ...o, mrp: v })) }} error={attempted ? offerErrors.mrp : null} />
                        <TextField id="l-price" label="Selling price (₹)" required inputMode="decimal" value={offer.price} onChange={(v) => { setOfferDirty(true); setOffer((o) => ({ ...o, price: v })) }} error={attempted ? offerErrors.price : null} />
                        <TextField id="l-stock" label="Opening stock" inputMode="numeric" value={offer.stock} onChange={(v) => setOffer((o) => ({ ...o, stock: v }))} error={attempted ? offerErrors.stock : null} disabled={!!singleVariantId} help={singleVariantId ? "Adjust stock on the Stock page." : undefined} />
                      </div>
                    </>
                  )}
                  {gridEmpty && attempted ? <p className="shop-sell-field__error">Pick at least one combination to sell.</p> : null}
                </Panel>
                {offerAttributes.length > 0 ? (
                  <Panel title="Your offer" sub="These are yours; the details above are shared with other sellers of the same product.">
                    {offerAttributes.map((def) => (
                      <AttributeField key={def.code} def={def} value={values[def.code] ?? null} error={errorFor(def)} onChange={(next: AttributeValue | null) => { draft.clearServerError(def.code); setValues((v) => ({ ...v, [def.code]: next })) }} />
                    ))}
                  </Panel>
                ) : null}
                {draft.notice ? <Notice tone="danger">{draft.notice}</Notice> : null}
                {draft.revalidation ? <RevalidationPanel prompt={draft.revalidation} /> : null}
                <div className="shop-sell-actions">
                  <Button type="button" disabled={draft.saving} onClick={() => void saveDraft().then((id) => { if (id) setStep("images") })}>
                    {draft.saving ? "Saving…" : draft.productId ? "Save and continue" : "Save draft and continue"}
                  </Button>
                  {draft.savedAt ? <span className="shop-sell-muted">Saved {new Date(draft.savedAt).toLocaleTimeString()}</span> : null}
                </div>
              </>
            ) : null}

            {step === "images" && draft.productId ? (
              <Panel title="Images" sub="Up to eight. The first is the cover.">
                <ListingImages productId={draft.productId} />
                <div className="shop-sell-actions">
                  <Button type="button" onClick={() => setStep("review")}>
                    Continue
                  </Button>
                </div>
              </Panel>
            ) : null}

            {step === "review" && draft.productId ? (
              <ReviewStep
                productId={draft.productId}
                notice={draft.notice}
                onSubmit={async () => {
                  const ok = await draft.submitForReview()
                  if (ok) {
                    toast({ type: "success", title: "Sent for review" })
                    router.push("/shop/sell/products")
                  }
                }}
                submitting={draft.saving}
                onFix={setStep}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

function ReviewStep({ productId, notice, onSubmit, submitting, onFix }: { productId: string; notice: string | null; onSubmit: () => Promise<void>; submitting: boolean; onFix: (s: EditorStep) => void }) {
  const readiness = useProductReadiness(productId)
  const missing = readiness.data?.missing ?? []
  const ready = !!readiness.data && readiness.data.ready && missing.length === 0
  return (
    <Panel title="Review" sub="What the reviewer's gate checks. Nothing reaches the shop until a reviewer approves the listing.">
      {readiness.isPending ? (
        <RowsSkeleton rows={3} />
      ) : readiness.isError ? (
        <Notice tone="danger">The readiness check could not be loaded.</Notice>
      ) : missing.length === 0 ? (
        <Notice tone="success">Everything the gate asks for is here.</Notice>
      ) : (
        <ul className="shop-sell-checklist">
          {missing.map((m) => (
            <li key={m.code} className="is-missing">
              <span>
                {m.label || m.code}
                {m.reason ? <span className="shop-sell-muted"> — {m.reason}</span> : null}
              </span>
              <button type="button" className="shop-sell-link" onClick={() => onFix(stepForGap(m.code))}>
                Fix
              </button>
            </li>
          ))}
        </ul>
      )}
      {notice ? <Notice tone="danger">{notice}</Notice> : null}
      <div className="shop-sell-actions">
        <Button type="button" disabled={!ready || submitting} onClick={() => void onSubmit()}>
          {submitting ? "Sending…" : "Submit for review"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => void readiness.refetch()}>
          Check again
        </Button>
      </div>
    </Panel>
  )
}

function RevalidationPanel({ prompt }: { prompt: { fields: string[]; confirm: () => void; cancel: () => void } }) {
  return (
    <Notice tone="warning">
      <p>
        This listing is already approved. {prompt.fields.length > 0 ? `Changing ${prompt.fields.join(", ")} sends it back for review` : "Saving this change sends it back for review"}; it stops showing in the shop until a reviewer approves it again.
      </p>
      <div className="shop-sell-actions">
        <Button type="button" size="sm" onClick={prompt.confirm}>
          Save and send for review
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={prompt.cancel}>
          Leave it as it is
        </Button>
      </div>
    </Notice>
  )
}

function progressText(p: { filledRequired: number; totalRequired: number }): string {
  return p.totalRequired > 0 ? `${p.filledRequired} of ${p.totalRequired} required answered` : "Nothing required here"
}

function mergeRowProblems(local: RowProblems, fromServer: RowProblems): RowProblems {
  const out: RowProblems = {}
  for (const [key, messages] of Object.entries(local)) out[key] = [...messages]
  for (const [key, messages] of Object.entries(fromServer)) out[key] = [...(out[key] ?? []), ...messages.filter((m) => !(out[key] ?? []).includes(m))]
  return out
}

