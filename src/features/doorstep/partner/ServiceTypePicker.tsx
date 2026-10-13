"use client"

import { useId, useState } from "react"
import { Search } from "lucide-react"
import { filterServiceTypes, serviceTypeCategories, type ServiceType } from "./applicationOptions"

export function ServiceTypePicker({ items, selected, onChange, onRetry }: {
  items: ServiceType[]; selected: string[]; onChange: (codes: string[]) => void; onRetry: () => void
}) {
  const id = useId()
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const categories = serviceTypeCategories(items)
  const visible = filterServiceTypes(items.filter(item => category === "all" || (category === "other" ? !item.categories?.length : item.categories?.some(c => c.id === category))), search)
  return <fieldset className="ds-service-picker">
    <legend>Service types *</legend>
    <p className="ds-note" id={id + "-hint"}>Choose a category, then select the services you offer.</p>
    {items.length ? <>
      {categories.length > 0 && <label className="ds-field"><span>Service category</span><select className="ds-input" value={category} onChange={event => { setCategory(event.target.value); setSearch("") }}><option value="all">All categories</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}{items.some(item => !item.categories?.length) && <option value="other">Other services</option>}</select></label>}
      <label className="ds-search-input"><Search size={18} aria-hidden="true" /><input className="ds-input" type="search" aria-label="Search service types" placeholder="Search service types…" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === "Enter") e.preventDefault() }} /></label>
      <p className="ds-note" role="status">{selected.length} selected · {visible.length} of {items.length} service types</p>
      <div className="ds-service-options" aria-describedby={id + "-hint"}>{visible.map(item =>
        <label key={item.code} className={selected.includes(item.code) ? "is-selected" : undefined}><input type="checkbox" checked={selected.includes(item.code)} disabled={!selected.includes(item.code) && selected.length >= 20} onChange={e => onChange(e.target.checked ? [...new Set([...selected, item.code])] : selected.filter(code => code !== item.code))} /><span>{item.name}{item.description && <small>{item.description}</small>}</span></label>
      )}</div>
      {!visible.length && <p className="ds-note">No service types match “{search}”. <button type="button" className="ds-link" onClick={() => setSearch("")}>Clear search</button></p>}
    </> : <div className="ds-info"><p>Service types are not available yet. Please retry before submitting your application.</p><button type="button" className="ds-btn ds-btn--outline" onClick={onRetry}>Reload service types</button></div>}
  </fieldset>
}
