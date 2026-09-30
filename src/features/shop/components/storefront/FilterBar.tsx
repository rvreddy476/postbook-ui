"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Check, ChevronDown, X } from "lucide-react"
import { activeFilterCount, priceRangeLabel, type BrowseFilters, type CategoryCard } from "../../model/storefront"

type Panel = "category" | "price" | "rating" | null

function Pill({ label, on, open, onClick, controls }: { label: string; on: boolean; open?: boolean; onClick: () => void; controls?: string }) {
  return (
    <button
      type="button"
      className={`shop-pill${on ? " shop-pill--on" : ""}`}
      onClick={onClick}
      aria-expanded={open}
      aria-controls={controls}
      aria-pressed={open === undefined ? on : undefined}
    >
      {label}
      {open !== undefined ? <ChevronDown size={14} aria-hidden="true" /> : on ? <Check size={14} aria-hidden="true" /> : null}
    </button>
  )
}

/**
 * The browse page's filters as pills: Category, Price, In stock, Rating.
 * There is NO sort on the server, so there is no sort control. Every
 * change is handed up as a whole filter set; the screen writes the URL.
 */
export function FilterBar({ filters, categories, onChange }: {
  filters: BrowseFilters
  categories: CategoryCard[]
  onChange: (next: BrowseFilters) => void
}) {
  const [panel, setPanel] = useState<Panel>(null)
  const [minDraft, setMinDraft] = useState(filters.minPrice?.toString() ?? "")
  const [maxDraft, setMaxDraft] = useState(filters.maxPrice?.toString() ?? "")
  const wrapper = useRef<HTMLDivElement>(null)
  const baseId = useId()

  useEffect(() => {
    setMinDraft(filters.minPrice?.toString() ?? "")
    setMaxDraft(filters.maxPrice?.toString() ?? "")
  }, [filters.minPrice, filters.maxPrice])

  useEffect(() => {
    if (!panel) return
    const onDown = (event: MouseEvent | TouchEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setPanel(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanel(null)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("touchstart", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("touchstart", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [panel])

  const activeCategory = filters.category ? categories.find((c) => c.id === filters.category) : undefined
  const priceLabel = priceRangeLabel(filters.minPrice, filters.maxPrice)
  const count = activeFilterCount(filters)
  const toggle = (next: Panel) => setPanel((current) => (current === next ? null : next))

  const applyPrice = () => {
    const min = Number(minDraft)
    const max = Number(maxDraft)
    onChange({
      ...filters,
      minPrice: Number.isFinite(min) && min > 0 ? Math.floor(min) : null,
      maxPrice: Number.isFinite(max) && max > 0 ? Math.floor(max) : null,
    })
    setPanel(null)
  }

  return (
    <div className="shop-filters" ref={wrapper}>
      <Pill
        label={activeCategory ? activeCategory.name : "Category"}
        on={!!filters.category}
        open={panel === "category"}
        controls={`${baseId}-category`}
        onClick={() => toggle("category")}
      />
      <Pill
        label={priceLabel ?? "Price"}
        on={!!priceLabel}
        open={panel === "price"}
        controls={`${baseId}-price`}
        onClick={() => toggle("price")}
      />
      <Pill label="In stock" on={filters.inStock} onClick={() => onChange({ ...filters, inStock: !filters.inStock })} />
      <Pill
        label={filters.minRating ? `${filters.minRating}★ & up` : "Rating"}
        on={filters.minRating !== null}
        open={panel === "rating"}
        controls={`${baseId}-rating`}
        onClick={() => toggle("rating")}
      />
      {count > 0 ? (
        <button
          type="button"
          className="shop-pill shop-pill--clear"
          onClick={() => onChange({ q: filters.q, category: "", inStock: false, minPrice: null, maxPrice: null, minRating: null })}
        >
          <X size={14} aria-hidden="true" /> Clear ({count})
        </button>
      ) : null}

      {panel === "category" ? (
        <div id={`${baseId}-category`} className="shop-filters__popover" role="group" aria-label="Category">
          <h3>Category</h3>
          <label className="shop-filters__choice">
            <input type="radio" name={`${baseId}-cat`} checked={!filters.category} onChange={() => { onChange({ ...filters, category: "" }); setPanel(null) }} />
            All categories
          </label>
          {categories.map((c) => (
            <label key={c.id} className="shop-filters__choice">
              <input type="radio" name={`${baseId}-cat`} checked={filters.category === c.id} onChange={() => { onChange({ ...filters, category: c.id }); setPanel(null) }} />
              {c.name}
            </label>
          ))}
        </div>
      ) : null}

      {panel === "price" ? (
        <form
          id={`${baseId}-price`}
          className="shop-filters__popover"
          aria-label="Price range"
          onSubmit={(event) => { event.preventDefault(); applyPrice() }}
        >
          <h3>Price (₹)</h3>
          <div className="shop-filters__row">
            <label className="shop-sr" htmlFor={`${baseId}-min`}>Minimum price in rupees</label>
            <input id={`${baseId}-min`} className="shop-input shop-input--sm" inputMode="numeric" placeholder="Min" value={minDraft} onChange={(e) => setMinDraft(e.target.value.replace(/[^\d]/g, ""))} />
            <span aria-hidden="true">–</span>
            <label className="shop-sr" htmlFor={`${baseId}-max`}>Maximum price in rupees</label>
            <input id={`${baseId}-max`} className="shop-input shop-input--sm" inputMode="numeric" placeholder="Max" value={maxDraft} onChange={(e) => setMaxDraft(e.target.value.replace(/[^\d]/g, ""))} />
          </div>
          <div className="shop-filters__actions">
            <button type="button" className="shop-btn shop-btn--ghost shop-btn--sm" onClick={() => { setMinDraft(""); setMaxDraft(""); onChange({ ...filters, minPrice: null, maxPrice: null }); setPanel(null) }}>Clear</button>
            <button type="submit" className="shop-btn shop-btn--primary shop-btn--sm">Apply</button>
          </div>
        </form>
      ) : null}

      {panel === "rating" ? (
        <div id={`${baseId}-rating`} className="shop-filters__popover" role="group" aria-label="Minimum rating">
          <h3>Rating</h3>
          {[4, 3, 2].map((stars) => (
            <label key={stars} className="shop-filters__choice">
              <input type="radio" name={`${baseId}-rating`} checked={filters.minRating === stars} onChange={() => { onChange({ ...filters, minRating: stars }); setPanel(null) }} />
              {stars}★ &amp; up
            </label>
          ))}
          <label className="shop-filters__choice">
            <input type="radio" name={`${baseId}-rating`} checked={filters.minRating === null} onChange={() => { onChange({ ...filters, minRating: null }); setPanel(null) }} />
            Any rating
          </label>
        </div>
      ) : null}
    </div>
  )
}
