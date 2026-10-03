"use client"

/*
  Create or edit a dish. Prices are typed as rupees and held as paise; the
  dish route still takes float rupees, derived from paise in the client
  (dishBody). Variants and add-ons send `price_paise` only. The update route
  REPLACES every field, so the whole dish is always sent, photo included.
*/

import { ImagePlus, Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"

import {
  createAddon,
  createAddonGroup,
  createDish,
  createVariant,
  deleteAddon,
  deleteAddonGroup,
  deleteVariant,
  fetchDish,
  updateAddon,
  updateAddonGroup,
  updateDish,
  updateVariant,
  uploadImage,
  type DishForm,
} from "../../api/client"
import { toFailure, type ApiFailure } from "../../model/errors"
import { formatPaise, paiseToInput, parseRupeesInput } from "../../model/money"
import type { AddonGroup, MenuItem, MenuItemDetail, PricedOption } from "../../model/wire"
import { Dialog, FailureNotice, Field, Notice, Switch, useAction } from "../ui"

const FOOD_TYPES = [
  { value: "EGG", label: "Egg" },
  { value: "NON_VEG", label: "Non-veg" },
  { value: "VEG", label: "Veg" },
] as const

const GST_RATES = ["0", "5", "12", "18"]

export function DishDialog({
  restaurantId,
  categoryId,
  item,
  onClose,
  onSaved,
}: {
  restaurantId: string
  categoryId: string
  item: MenuItem | null
  onClose: () => void
  onSaved: () => void
}) {
  const [dish, setDish] = useState<MenuItem | null>(item)
  const [name, setName] = useState(item?.name ?? "")
  const [description, setDescription] = useState(item?.description ?? "")
  const [foodType, setFoodType] = useState<DishForm["foodType"]>((item?.foodType as DishForm["foodType"]) ?? "VEG")
  const [price, setPrice] = useState(item ? paiseToInput(item.basePricePaise) : "")
  const [offer, setOffer] = useState(item?.discountPricePaise != null ? paiseToInput(item.discountPricePaise) : "")
  const [prep, setPrep] = useState(String(item?.preparationMinutes ?? 15))
  const [tax, setTax] = useState(String(item?.taxPercentage ?? 5))
  const [recommended, setRecommended] = useState(item?.isRecommended ?? false)
  const [photo, setPhoto] = useState<File | null>(null)
  const [local, setLocal] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const action = useAction()

  const pricePaise = parseRupeesInput(price)
  const offerPaise = offer.trim() ? parseRupeesInput(offer) : null

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaved(false)
    if (!name.trim()) return setLocal("Enter the dish name.")
    if (pricePaise === null || pricePaise === 0) return setLocal("Enter a price in rupees, e.g. 249 or 249.50.")
    if (offer.trim() && (offerPaise === null || offerPaise >= pricePaise)) return setLocal("The offer price must be lower than the price.")
    const prepN = Number.parseInt(prep, 10)
    if (!Number.isInteger(prepN) || prepN < 1 || prepN > 240) return setLocal("Preparation time is 1 to 240 minutes.")
    if (photo && (!photo.type.startsWith("image/") || photo.size > 10 * 1024 * 1024)) return setLocal("The photo must be an image up to 10 MB.")
    setLocal(null)
    const result = await action.run(async () => {
      const imageMediaId = photo ? await uploadImage(photo) : (dish?.imageMediaId ?? null)
      const form: DishForm = {
        categoryId,
        name,
        description,
        foodType,
        basePricePaise: pricePaise,
        discountPricePaise: offerPaise,
        preparationMinutes: prepN,
        isRecommended: recommended,
        taxPercentage: Number(tax),
        imageMediaId,
        imageUrl: photo ? null : (dish?.imageUrl ?? null),
      }
      return dish ? updateDish(dish.id, form) : createDish(restaurantId, form)
    })
    if (result) {
      setDish(result)
      setPhoto(null)
      setSaved(true)
      onSaved()
    }
  }

  return (
    <Dialog title={dish ? `Edit ${dish.name}` : "Add a dish"} onClose={onClose} wide>
      <form className="kit-form kit-form--2" onSubmit={save} noValidate>
        <Field label="Name" span>
          <input className="kit-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} autoFocus />
        </Field>
        <Field label="Description" span>
          <textarea className="kit-textarea" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
        </Field>
        <Field label="Type">
          <select className="kit-select" value={foodType} onChange={(e) => setFoodType(e.target.value as DishForm["foodType"])}>
            {FOOD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="GST on this dish (%)" hint="Ask your tax adviser if unsure.">
          <select className="kit-select" value={tax} onChange={(e) => setTax(e.target.value)}>
            {GST_RATES.map((r) => (
              <option key={r} value={r}>
                {r}%
              </option>
            ))}
          </select>
        </Field>
        <Field label="Price (₹)" error={price && pricePaise === null ? "Up to two decimals." : null}>
          <input className="kit-input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="249" />
        </Field>
        <Field label="Offer price (₹, optional)" error={offer && offerPaise === null ? "Up to two decimals." : null}>
          <input className="kit-input" inputMode="decimal" value={offer} onChange={(e) => setOffer(e.target.value)} />
        </Field>
        <Field label="Preparation time (minutes)">
          <input className="kit-input" type="number" min={1} max={240} value={prep} onChange={(e) => setPrep(e.target.value)} />
        </Field>
        <Field label="Photo" hint={dish?.imageUrl ? "Choose a file to replace the current photo." : "JPG, PNG or WebP, up to 10 MB."}>
          <input className="kit-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} style={{ paddingTop: 6 }} />
        </Field>
        <div className="kit-span">
          <label className="kit-check">
            <input type="checkbox" checked={recommended} onChange={(e) => setRecommended(e.target.checked)} /> Mark as recommended
          </label>
        </div>
        <div className="kit-span kit-form">
          {local ? <Notice tone="danger">{local}</Notice> : null}
          <FailureNotice failure={action.failure} />
          {saved ? <Notice tone="success">{item ? "Dish saved." : "Dish added. Add sizes and add-ons below if it has any."}</Notice> : null}
          <div className="kit-row kit-row--end">
            <button type="submit" className="kit-btn kit-btn--primary" disabled={action.busy}>
              <ImagePlus size={14} aria-hidden /> {action.busy ? "Saving…" : dish ? "Save dish" : "Add dish"}
            </button>
          </div>
        </div>
      </form>

      {dish ? <Options itemId={dish.id} /> : <p className="kit-meta">Sizes and add-ons can be added once the dish is saved.</p>}
    </Dialog>
  )
}

/** Variants (sizes) and add-on groups of a saved dish. */
function Options({ itemId }: { itemId: string }) {
  const [detail, setDetail] = useState<MenuItemDetail | null>(null)
  const [failure, setFailure] = useState<ApiFailure | null>(null)

  const load = async () => {
    try {
      setDetail(await fetchDish(itemId))
      setFailure(null)
    } catch (e) {
      setFailure(toFailure(e))
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId])

  const guard = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
      setFailure(null)
      await load()
    } catch (e) {
      setFailure(toFailure(e))
    }
  }

  return (
    <>
      <FailureNotice failure={failure} />
      <div className="kit-sub">
        <h3 className="kit-sub__title">Sizes</h3>
        <p className="kit-small" style={{ margin: "0 0 6px" }}>
          A size replaces the dish price, e.g. Half ₹150 and Full ₹250.
        </p>
        {detail?.variants
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((v) => (
            <OptionRow
              key={v.id}
              option={v}
              onSave={(b) => guard(() => updateVariant(itemId, v.id, b))}
              onDelete={() => guard(() => deleteVariant(itemId, v.id))}
            />
          ))}
        <NewOption label="Add size" onAdd={(name, pricePaise) => guard(() => createVariant(itemId, { name, price_paise: pricePaise, is_available: true, sort_order: detail?.variants.length ?? 0 }))} />
      </div>
      <div className="kit-sub">
        <h3 className="kit-sub__title">Add-on groups</h3>
        {detail?.addonGroups
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((g) => (
            <GroupBlock key={g.id} itemId={itemId} group={g} guard={guard} />
          ))}
        <NewGroup onAdd={(name, min, max, required) => guard(() => createAddonGroup(itemId, { name, min_select: min, max_select: max, is_required: required, sort_order: detail?.addonGroups.length ?? 0 }))} />
      </div>
    </>
  )
}

function GroupBlock({ itemId, group, guard }: { itemId: string; group: AddonGroup; guard: (fn: () => Promise<unknown>) => Promise<void> }) {
  return (
    <div className="kit-card" style={{ margin: "8px 0", padding: 10 }}>
      <div className="kit-row kit-row--between">
        <strong>{group.name}</strong>
        <div className="kit-row">
          <span className="kit-small">
            {group.isRequired ? "Required" : "Optional"} · choose {group.minSelect}–{group.maxSelect}
          </span>
          <button type="button" className="kit-btn kit-btn--ghost kit-btn--sm" onClick={() => guard(() => updateAddonGroup(itemId, group.id, { is_required: !group.isRequired, min_select: !group.isRequired ? Math.max(1, group.minSelect) : 0 }))}>
            {group.isRequired ? "Make optional" : "Make required"}
          </button>
          <button
            type="button"
            className="kit-btn kit-btn--ghost kit-btn--sm"
            aria-label={`Delete ${group.name}`}
            onClick={() => window.confirm(`Delete the add-on group "${group.name}"?`) && guard(() => deleteAddonGroup(itemId, group.id))}
          >
            <Trash2 size={13} aria-hidden />
          </button>
        </div>
      </div>
      {group.addons
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((a) => (
          <OptionRow
            key={a.id}
            option={a}
            onSave={(b) => guard(() => updateAddon(itemId, group.id, a.id, b))}
            onDelete={() => guard(() => deleteAddon(itemId, group.id, a.id))}
          />
        ))}
      <NewOption label="Add add-on" allowZero onAdd={(name, pricePaise) => guard(() => createAddon(itemId, group.id, { name, price_paise: pricePaise, is_available: true, sort_order: group.addons.length }))} />
    </div>
  )
}

function OptionRow({ option, onSave, onDelete }: { option: PricedOption; onSave: (b: { price_paise?: number; is_available?: boolean }) => Promise<void>; onDelete: () => Promise<void> }) {
  const [price, setPrice] = useState(paiseToInput(option.pricePaise))
  const paise = parseRupeesInput(price)
  const dirty = paise !== null && paise !== option.pricePaise
  return (
    <div className="kit-opt">
      <span>
        {option.name} <span className="kit-small">{formatPaise(option.pricePaise)}</span>
      </span>
      <input className="kit-input" inputMode="decimal" aria-label={`${option.name} price in rupees`} value={price} onChange={(e) => setPrice(e.target.value)} aria-invalid={paise === null} />
      <Switch checked={option.isAvailable} onChange={(next) => void onSave({ is_available: next })} label={option.isAvailable ? "In stock" : "Out"} />
      <div className="kit-row">
        {dirty ? (
          <button type="button" className="kit-btn kit-btn--outline kit-btn--sm" onClick={() => void onSave({ price_paise: paise })}>
            Save
          </button>
        ) : null}
        <button type="button" className="kit-btn kit-btn--ghost kit-btn--sm" aria-label={`Delete ${option.name}`} onClick={() => window.confirm(`Delete "${option.name}"?`) && void onDelete()}>
          <Trash2 size={13} aria-hidden />
        </button>
      </div>
    </div>
  )
}

function NewOption({ label, onAdd, allowZero }: { label: string; onAdd: (name: string, pricePaise: number) => Promise<void>; allowZero?: boolean }) {
  const [name, setName] = useState("")
  const [price, setPrice] = useState("")
  const paise = parseRupeesInput(price)
  const valid = name.trim() !== "" && paise !== null && (allowZero || paise > 0)
  return (
    <form
      className="kit-opt"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!valid || paise === null) return
        await onAdd(name.trim(), paise)
        setName("")
        setPrice("")
      }}
    >
      <input className="kit-input" placeholder="Name" aria-label={`${label}: name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
      <input className="kit-input" placeholder="₹" inputMode="decimal" aria-label={`${label}: price in rupees`} value={price} onChange={(e) => setPrice(e.target.value)} />
      <button type="submit" className="kit-btn kit-btn--outline kit-btn--sm" disabled={!valid}>
        <Plus size={13} aria-hidden /> {label}
      </button>
    </form>
  )
}

function NewGroup({ onAdd }: { onAdd: (name: string, min: number, max: number, required: boolean) => Promise<void> }) {
  const [name, setName] = useState("")
  const [max, setMax] = useState("1")
  const [required, setRequired] = useState(false)
  const maxN = Number.parseInt(max, 10)
  const valid = name.trim() !== "" && Number.isInteger(maxN) && maxN >= 1 && maxN <= 20
  return (
    <form
      className="kit-row"
      style={{ marginTop: 6 }}
      onSubmit={async (e) => {
        e.preventDefault()
        if (!valid) return
        await onAdd(name.trim(), required ? 1 : 0, maxN, required)
        setName("")
      }}
    >
      <input className="kit-input" style={{ flex: "1 1 160px" }} placeholder="Group name, e.g. Extras" aria-label="Add-on group name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
      <label className="kit-check">
        Up to
        <input className="kit-input" style={{ width: 64 }} type="number" min={1} max={20} value={max} onChange={(e) => setMax(e.target.value)} aria-label="Maximum choices" />
      </label>
      <label className="kit-check">
        <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Required
      </label>
      <button type="submit" className="kit-btn kit-btn--outline kit-btn--sm" disabled={!valid}>
        <Plus size={13} aria-hidden /> Add group
      </button>
    </form>
  )
}
