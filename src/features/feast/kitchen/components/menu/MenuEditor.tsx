"use client"

/*
  The menu editor: categories on the left (in the order customers see them),
  dishes on the right with an in-stock switch each. Prices are paise; the
  dish dialog edits variants and add-on groups once a dish exists.
*/

import { ImageOff, Pencil, Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"

import { createCategory, deleteCategory, deleteDish, fetchMenu, setDishAvailable, updateCategory } from "../../api/client"
import { toFailure, type ApiFailure } from "../../model/errors"
import { formatPaise } from "../../model/money"
import type { MenuCategory, MenuItem } from "../../model/wire"
import { FailureNotice, Notice, Switch, useAction, useLoad } from "../ui"
import { DishDialog } from "./DishDialog"

export function MenuEditor({ restaurantId, onChanged }: { restaurantId: string; onChanged: () => void }) {
  const menu = useLoad(() => fetchMenu(restaurantId), [restaurantId])
  const [selected, setSelected] = useState<string | null>(null)
  const [newCat, setNewCat] = useState("")
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [dialog, setDialog] = useState<{ categoryId: string; item: MenuItem | null } | null>(null)
  const [rowFailure, setRowFailure] = useState<ApiFailure | null>(null)
  const [pending, setPending] = useState<Set<string>>(new Set())
  const action = useAction()

  const cats: MenuCategory[] = (menu.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
  const current = cats.find((c) => c.id === selected) ?? cats[0] ?? null

  useEffect(() => {
    if (!selected && cats[0]) setSelected(cats[0].id)
  }, [cats, selected])

  const changed = async () => {
    await menu.reload()
    onChanged()
  }

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newCat.trim()
    if (!name) return
    const nextOrder = cats.reduce((m, c) => Math.max(m, c.sortOrder), 0) + 1
    const ok = await action.run(() => createCategory(restaurantId, name, nextOrder))
    if (ok) {
      setNewCat("")
      await changed()
    }
  }

  const rename = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!renaming || !renaming.name.trim()) return
    const cat = cats.find((c) => c.id === renaming.id)
    if (!cat) return
    const ok = await action.run(() => updateCategory(cat.id, renaming.name, cat.description ?? "", cat.sortOrder))
    if (ok) {
      setRenaming(null)
      await changed()
    }
  }

  const removeCategory = async (cat: MenuCategory) => {
    if (cat.items.length > 0) return action.setFailure({ status: 0, code: "LOCAL", message: "Move or delete this category's dishes first.", field: null, missing: null, outcomeUnknown: false })
    if (!window.confirm(`Delete the category "${cat.name}"?`)) return
    const ok = await action.run(async () => {
      await deleteCategory(cat.id)
      return true
    })
    if (ok) {
      setSelected(null)
      await changed()
    }
  }

  const toggleStock = async (item: MenuItem, next: boolean) => {
    setRowFailure(null)
    setPending((p) => new Set(p).add(item.id))
    try {
      await setDishAvailable(item.id, next)
      // Optimistic once the server said yes; the refetch confirms.
      menu.setData((cs) => cs?.map((c) => ({ ...c, items: c.items.map((i) => (i.id === item.id ? { ...i, isAvailable: next } : i)) })) ?? cs)
      void menu.reload()
    } catch (e) {
      setRowFailure(toFailure(e))
    } finally {
      setPending((p) => {
        const n = new Set(p)
        n.delete(item.id)
        return n
      })
    }
  }

  const removeDish = async (item: MenuItem) => {
    if (!window.confirm(`Delete "${item.name}" from the menu?`)) return
    setRowFailure(null)
    try {
      await deleteDish(item.id)
      await changed()
    } catch (e) {
      setRowFailure(toFailure(e))
    }
  }

  return (
    <div className="kit-grid kit-grid--side">
      <nav className="kit-card" aria-label="Menu categories">
        <strong>Categories</strong>
        <FailureNotice failure={menu.failure} />
        <ul className="kit-cats" style={{ marginTop: 8 }}>
          {cats.map((c) => (
            <li key={c.id}>
              {renaming?.id === c.id ? (
                <form className="kit-row" onSubmit={rename}>
                  <input className="kit-input" aria-label="Category name" value={renaming.name} onChange={(e) => setRenaming({ id: c.id, name: e.target.value })} autoFocus maxLength={120} />
                  <button type="submit" className="kit-btn kit-btn--primary kit-btn--sm" disabled={action.busy}>
                    Save
                  </button>
                </form>
              ) : (
                <button type="button" className="kit-cat" aria-current={current?.id === c.id} onClick={() => setSelected(c.id)}>
                  <span>{c.name}</span>
                  <span className="kit-small">{c.items.length}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
        {menu.loading && !menu.data ? <p className="kit-meta">Loading menu…</p> : null}
        <form className="kit-row" style={{ marginTop: 10 }} onSubmit={addCategory}>
          <input className="kit-input" style={{ flex: 1 }} placeholder="New category, e.g. Starters" aria-label="New category name" value={newCat} onChange={(e) => setNewCat(e.target.value)} maxLength={120} />
          <button type="submit" className="kit-btn kit-btn--outline kit-btn--sm" disabled={action.busy || !newCat.trim()}>
            <Plus size={14} aria-hidden /> Add
          </button>
        </form>
        <div style={{ marginTop: 8 }}>
          <FailureNotice failure={action.failure} />
        </div>
      </nav>

      <section className="kit-card">
        {current ? (
          <>
            <div className="kit-row kit-row--between" style={{ marginBottom: 8 }}>
              <h2 className="kit-card__title" style={{ margin: 0 }}>
                {current.name}
              </h2>
              <div className="kit-row">
                <button type="button" className="kit-btn kit-btn--ghost kit-btn--sm" onClick={() => setRenaming({ id: current.id, name: current.name })}>
                  <Pencil size={13} aria-hidden /> Rename
                </button>
                <button type="button" className="kit-btn kit-btn--ghost kit-btn--sm" onClick={() => removeCategory(current)}>
                  <Trash2 size={13} aria-hidden /> Delete
                </button>
                <button type="button" className="kit-btn kit-btn--primary kit-btn--sm" onClick={() => setDialog({ categoryId: current.id, item: null })}>
                  <Plus size={14} aria-hidden /> Add dish
                </button>
              </div>
            </div>
            <FailureNotice failure={rowFailure} />
            {current.items.length === 0 ? <div className="kit-empty">No dishes in this category yet.</div> : null}
            {current.items.map((item) => (
              <div className="kit-dish" key={item.id}>
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="kit-dish__img" src={item.imageUrl} alt="" loading="lazy" />
                ) : (
                  <span className="kit-dish__img">
                    <ImageOff size={16} aria-hidden />
                  </span>
                )}
                <div style={{ minWidth: 0 }}>
                  <div className="kit-dish__name">
                    <FoodMark type={item.foodType} />
                    <span>{item.name}</span>
                  </div>
                  <div className="kit-meta">
                    {item.discountPricePaise !== null ? (
                      <>
                        {formatPaise(item.discountPricePaise)} <s>{formatPaise(item.basePricePaise)}</s>
                      </>
                    ) : (
                      formatPaise(item.basePricePaise)
                    )}{" "}
                    · {item.preparationMinutes} min · GST {item.taxPercentage}%
                  </div>
                </div>
                <div className="kit-row">
                  <Switch checked={item.isAvailable} disabled={pending.has(item.id)} onChange={(next) => toggleStock(item, next)} label={item.isAvailable ? "In stock" : "Out of stock"} />
                  <button type="button" className="kit-btn kit-btn--ghost kit-btn--sm" onClick={() => setDialog({ categoryId: current.id, item })} aria-label={`Edit ${item.name}`}>
                    <Pencil size={13} aria-hidden />
                  </button>
                  <button type="button" className="kit-btn kit-btn--ghost kit-btn--sm" onClick={() => removeDish(item)} aria-label={`Delete ${item.name}`}>
                    <Trash2 size={13} aria-hidden />
                  </button>
                </div>
              </div>
            ))}
          </>
        ) : menu.data ? (
          <Notice>Start with a category on the left, then add dishes to it.</Notice>
        ) : null}
      </section>

      {dialog ? (
        <DishDialog
          restaurantId={restaurantId}
          categoryId={dialog.categoryId}
          item={dialog.item}
          onClose={() => setDialog(null)}
          onSaved={() => void changed()}
        />
      ) : null}
    </div>
  )
}

export function FoodMark({ type }: { type: string }) {
  const cls = type === "NON_VEG" ? " kit-veg--non" : type === "EGG" ? " kit-veg--egg" : ""
  const label = type === "NON_VEG" ? "Non-veg" : type === "EGG" ? "Egg" : "Veg"
  return <span className={`kit-veg${cls}`} role="img" aria-label={label} title={label} />
}
