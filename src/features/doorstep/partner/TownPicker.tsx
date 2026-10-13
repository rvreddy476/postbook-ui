"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Search } from "lucide-react"
import { loadGoogleMaps, type GooglePlace } from "@/features/maps/google"
import { townFromPlace, TownRequestVersion } from "./applicationOptions"

type Prediction = { placeId: string; text: { toString(): string }; toPlace(): GooglePlace }
type TownPlaces = {
  AutocompleteSessionToken: new () => object
  AutocompleteSuggestion: { fetchAutocompleteSuggestions(request: {
    input: string; includedRegionCodes: string[]; includedPrimaryTypes: string[]; sessionToken: object
  }): Promise<{ suggestions: { placePrediction?: Prediction }[] }> }
}

export function TownPicker({ state, value, onChange }: { state: string; value: string; onChange: (town: string) => void }) {
  const id = useId()
  const [input, setInput] = useState(value)
  const [suggestions, setSuggestions] = useState<Prediction[]>([])
  const [focused, setFocused] = useState(false)
  const [manual, setManual] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [searched, setSearched] = useState(false)
  const [active, setActive] = useState(-1)
  const requests = useRef(new TownRequestVersion())
  const session = useRef<object | null>(null)
  const places = useRef<TownPlaces | null>(null)
  const field = useRef<HTMLInputElement>(null)
  const open = focused && !manual && suggestions.length > 0

  useEffect(() => {
    const version = requests.current.next()
    const current = requests.current
    if (!state || manual || !focused || value || input.trim().length < 2) return
    const timeout = setTimeout(() => {
      setBusy(true); setError(""); setSearched(false)
      void (async () => {
        try {
          const google = await loadGoogleMaps()
          const library = places.current ?? await google.maps.importLibrary("places") as TownPlaces
          if (!current.isCurrent(version)) return
          places.current = library
          session.current ??= new library.AutocompleteSessionToken()
          const result = await library.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: `${input.trim()}, ${state}, India`,
            includedRegionCodes: ["in"], includedPrimaryTypes: ["(cities)"], sessionToken: session.current,
          })
          if (!current.isCurrent(version)) return
          setSuggestions(result.suggestions.flatMap(s => s.placePrediction ? [s.placePrediction] : []))
          setActive(-1); setSearched(true)
        } catch {
          if (current.isCurrent(version)) { setSuggestions([]); setError("Town search is unavailable. Try again, or enter your town manually.") }
        } finally { if (current.isCurrent(version)) setBusy(false) }
      })()
    }, 300)
    return () => { clearTimeout(timeout); current.next() }
  }, [input, state, manual, focused, value])

  useEffect(() => { const current = requests.current; return () => { current.next() } }, [])

  async function choose(prediction: Prediction) {
    const version = requests.current.next()
    setBusy(true); setError(""); setSuggestions([]); setSearched(false)
    try {
      const place = prediction.toPlace()
      await place.fetchFields({ fields: ["addressComponents"] })
      if (!requests.current.isCurrent(version)) return
      const town = townFromPlace(place, state)
      if (!town) {
        setError(`Select a town in ${state}. If Google's state or town name differs, you can enter it manually.`)
        return
      }
      setInput(town); onChange(town); setFocused(false)
    } catch {
      if (requests.current.isCurrent(version)) setError("We couldn’t load that town. Please select it again or enter it manually.")
    } finally {
      if (requests.current.isCurrent(version)) { setBusy(false); session.current = null }
    }
  }

  function edit(text: string) {
    requests.current.next()
    setInput(text); setFocused(true); onChange(manual ? text : "")
    setBusy(false); setError(""); setSuggestions([]); setSearched(false); setActive(-1)
  }

  return <div className="ds-stack ds-town-picker">
    <label className="ds-field" htmlFor={id}>Town / city *</label>
    <div className="ds-search-input"><Search size={18} aria-hidden="true" /><input ref={field} id={id} className="ds-input" type="text"
      role={manual ? undefined : "combobox"} aria-autocomplete={manual ? undefined : "list"}
      aria-expanded={manual ? undefined : open} aria-controls={open ? id + "-options" : undefined}
      aria-activedescendant={open && active >= 0 ? id + "-option-" + active : undefined}
      aria-describedby={id + "-hint"} aria-invalid={error ? true : undefined} autoComplete="off"
      required disabled={!state} minLength={2} maxLength={100} value={input}
      placeholder={!state ? "Select a state first" : manual ? `Enter your town in ${state}` : `Search towns in ${state}…`}
      onChange={e => edit(e.target.value)} onFocus={() => setFocused(true)}
      onBlur={() => { requests.current.next(); setFocused(false); setBusy(false) }}
      onKeyDown={e => {
        if (e.key === "Escape") { requests.current.next(); setFocused(false); setBusy(false); setSuggestions([]) }
        if ((e.key === "ArrowDown" || e.key === "ArrowUp") && suggestions.length) {
          e.preventDefault(); setFocused(true)
          setActive(i => e.key === "ArrowDown" ? (i + 1) % suggestions.length : (i <= 0 ? suggestions.length : i) - 1)
        }
        if (e.key === "Enter" && !manual) {
          e.preventDefault()
          if (open && active >= 0) void choose(suggestions[active])
          else if (!value) setError("Choose a town from the suggestions, or select manual entry below.")
        }
      }} /></div>
    {open && <div className="ds-town-results"><ul role="listbox" id={id + "-options"} aria-label="Town suggestions">
      {suggestions.map((prediction, index) => <li key={prediction.placeId} id={id + "-option-" + index} role="option" aria-selected={active === index}
        onMouseDown={e => e.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => void choose(prediction)}>{prediction.text.toString()}</li>)}
      </ul><span className="ds-maps-attribution" translate="no">Google Maps</span></div>}
    <p className="ds-note" id={id + "-hint"}>{!state ? "Choose your state to search for nearby towns and cities." : manual ? `Enter your town in ${state}. Our team will review your working location.` : "Type at least two letters and choose a suggestion. Searches are shared with Google."}</p>
    <div role="status" aria-live="polite">{busy ? <p className="ds-note">Searching towns…</p> : error ? <p className="ds-note">{error}</p> : searched && !suggestions.length && !value ? <p className="ds-note">No towns found. Try another spelling or enter your town manually.</p> : value && !manual ? <p className="ds-ok">Selected: {value}, {state}</p> : null}</div>
    {state && <button type="button" className="ds-link" onClick={() => {
      requests.current.next(); session.current = null; setManual(!manual); setInput(""); onChange("")
      setError(""); setBusy(false); setSuggestions([]); setSearched(false); field.current?.focus()
    }}>{manual ? "Use town search instead" : "Can’t find your town? Enter it manually"}</button>}
  </div>
}
