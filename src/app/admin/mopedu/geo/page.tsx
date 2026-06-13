"use client"

// Geo console — three sub-tabs (state-driven, no nested routes):
// • Cities — table + create/edit modal
// • Zones — filtered by selected city, GeoJSON pasted as text (no map editor v1)
// • Fare rules — filtered by city, with surge quick-action

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

import {
  useCreateMopeduCity,
  useCreateMopeduFareRule,
  useCreateMopeduZone,
  useMopeduCities,
  useMopeduFareRules,
  useMopeduZones,
  useUpdateMopeduCity,
  useUpdateMopeduFareRule,
  useUpdateMopeduZone,
} from "@/hooks/useMopeduAdmin"
import type {
  CityCreateInput,
  CityUpdateInput,
  FareRuleCreateInput,
  FareRuleUpdateInput,
  ZoneCreateInput,
  ZoneUpdateInput,
} from "@/lib/mopedu_api"
import type {
  City,
  CityFeatureFlags,
  FareRule,
  VehicleType,
  Zone,
} from "@/types/mopedu"

import {
  EmptyState,
  Modal,
  PrimaryButton,
  SecondaryButton,
  classNames,
  errorMessage,
  formatDate,
  paiseToRupees,
} from "../_shared"

// ── tab switcher ──────────────────────────────────────────────────────────

type GeoTab = "cities" | "zones" | "fare_rules"

const TABS: Array<{ key: GeoTab; label: string }> = [
  { key: "cities", label: "Cities" },
  { key: "zones", label: "Zones" },
  { key: "fare_rules", label: "Fare rules" },
]

const VEHICLE_TYPES: VehicleType[] = [
  "bike",
  "auto",
  "mini",
  "sedan",
  "suv",
  "premium",
]

export default function MopeduGeoPage() {
  const [tab, setTab] = useState<GeoTab>("cities")
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-brand-divider bg-brand-card px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((t) => {
            const active = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={classNames(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "border-brand-text bg-brand-text text-white"
                    : "border-gray-300 bg-white text-brand-text/70 hover:bg-gray-50",
                )}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {tab === "cities" ? <CitiesTab /> : null}
      {tab === "zones" ? <ZonesTab /> : null}
      {tab === "fare_rules" ? <FareRulesTab /> : null}
    </div>
  )
}

// ── Cities tab ────────────────────────────────────────────────────────────

function CitiesTab() {
  const cities = useMopeduCities()
  const createM = useCreateMopeduCity()
  const updateM = useUpdateMopeduCity()
  const [editing, setEditing] = useState<City | null>(null)
  const [creating, setCreating] = useState<boolean>(false)

  const items = cities.data ?? []

  function toggleActive(c: City) {
    updateM.mutate({ id: c.id, body: { is_active: !c.is_active } })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <PrimaryButton tone="green" onClick={() => setCreating(true)}>
          Create city
        </PrimaryButton>
      </div>

      <div className="overflow-hidden rounded-2xl border border-brand-divider bg-brand-card shadow-sm">
        {cities.isLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-brand-text/60">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : cities.isError ? (
          <div className="px-4 py-6 text-sm text-rose-700">
            {errorMessage(cities.error)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No cities yet"
            body="Create one to start onboarding partners there."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">Currency</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-brand-text">
                    {c.name}
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-text/70">
                    {c.state ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-text/70">
                    {c.country}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {c.currency_code}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleActive(c)}
                      disabled={updateM.isPending}
                      className={classNames(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide transition-colors",
                        c.is_active
                          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                      )}
                    >
                      {c.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-text/55">
                    {formatDate(c.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(c)}
                      className="text-xs font-semibold text-brand-text/70 underline-offset-2 hover:underline"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating ? (
        <CityFormModal
          mode="create"
          onClose={() => setCreating(false)}
          onSubmit={async (body) => {
            await createM.mutateAsync(body as CityCreateInput)
            setCreating(false)
          }}
          pending={createM.isPending}
          error={createM.error}
        />
      ) : null}

      {editing ? (
        <CityFormModal
          mode="edit"
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (body) => {
            await updateM.mutateAsync({
              id: editing.id,
              body: body as CityUpdateInput,
            })
            setEditing(null)
          }}
          pending={updateM.isPending}
          error={updateM.error}
        />
      ) : null}
    </div>
  )
}

function CityFormModal({
  mode,
  initial,
  onClose,
  onSubmit,
  pending,
  error,
}: {
  mode: "create" | "edit"
  initial?: City
  onClose: () => void
  onSubmit: (body: CityCreateInput | CityUpdateInput) => Promise<void>
  pending: boolean
  error: unknown
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [state, setState] = useState(initial?.state ?? "")
  const [country, setCountry] = useState(initial?.country ?? "IN")
  const [currency, setCurrency] = useState(initial?.currency_code ?? "INR")
  const [active, setActive] = useState(initial?.is_active ?? true)

  // Feature flag defaults (Indian regulatory baselines):
  // - bike_taxi: false (Karnataka legality grey-zone, opt-in per city)
  // - scheduled_rides: false (Sprint 5 unlocks the booking flow)
  // - surge_pricing: false (v1 keeps pricing predictable)
  // - auto_rickshaw: true (autos are the default Indian short-hop vehicle)
  const flags = initial?.feature_flags ?? {}
  const [bikeTaxiEnabled, setBikeTaxiEnabled] = useState<boolean>(
    flags.bike_taxi_enabled ?? false,
  )
  const [scheduledRidesEnabled, setScheduledRidesEnabled] = useState<boolean>(
    flags.scheduled_rides_enabled ?? false,
  )
  const [surgePricingEnabled, setSurgePricingEnabled] = useState<boolean>(
    flags.surge_pricing_enabled ?? false,
  )
  const [autoRickshawEnabled, setAutoRickshawEnabled] = useState<boolean>(
    flags.auto_rickshaw_enabled ?? true,
  )

  async function handle(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !country.trim() || !currency.trim()) return
    const feature_flags: CityFeatureFlags = {
      bike_taxi_enabled: bikeTaxiEnabled,
      scheduled_rides_enabled: scheduledRidesEnabled,
      surge_pricing_enabled: surgePricingEnabled,
      auto_rickshaw_enabled: autoRickshawEnabled,
    }
    await onSubmit({
      name: name.trim(),
      state: state.trim() || undefined,
      country: country.trim(),
      currency_code: currency.trim().toUpperCase(),
      is_active: active,
      feature_flags,
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === "create" ? "Create city" : `Edit ${initial?.name ?? ""}`}
      width="md"
    >
      <form onSubmit={handle} className="space-y-3">
        <FormField label="Name" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-text"
            required
          />
        </FormField>
        <FormField label="State (optional)">
          <input
            type="text"
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-text"
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Country" required>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              maxLength={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase outline-none focus:border-brand-text"
              required
            />
          </FormField>
          <FormField label="Currency code" required>
            <input
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              maxLength={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase outline-none focus:border-brand-text"
              required
            />
          </FormField>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Active
        </label>

        <div className="rounded-xl border border-gray-200 bg-gray-50/60 px-3 py-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-brand-text/55">
            Feature flags
          </p>
          <div className="space-y-2">
            <FeatureFlagToggle
              label="Bike taxi enabled"
              hint="Off in Karnataka by default — bike taxis are a regulatory grey-zone."
              checked={bikeTaxiEnabled}
              onChange={setBikeTaxiEnabled}
            />
            <FeatureFlagToggle
              label="Scheduled rides enabled"
              hint="Sprint 5 unlocks the booking flow; keep off until then."
              checked={scheduledRidesEnabled}
              onChange={setScheduledRidesEnabled}
            />
            <FeatureFlagToggle
              label="Surge pricing enabled"
              hint="Off in v1 — pricing stays predictable per fare rule."
              checked={surgePricingEnabled}
              onChange={setSurgePricingEnabled}
            />
            <FeatureFlagToggle
              label="Auto-rickshaw enabled"
              hint="On by default in India."
              checked={autoRickshawEnabled}
              onChange={setAutoRickshawEnabled}
            />
          </div>
        </div>

        {error ? (
          <p className="text-xs text-rose-700">{errorMessage(error)}</p>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose} disabled={pending}>
            Cancel
          </SecondaryButton>
          <PrimaryButton tone="green" type="submit" disabled={pending}>
            {pending ? "Saving…" : mode === "create" ? "Create" : "Save"}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  )
}

function FeatureFlagToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
      />
      <span className="flex-1">
        <span className="block font-medium text-brand-text">{label}</span>
        {hint ? (
          <span className="mt-0.5 block text-[11px] text-brand-text/55">
            {hint}
          </span>
        ) : null}
      </span>
    </label>
  )
}

// ── Zones tab ─────────────────────────────────────────────────────────────

function ZonesTab() {
  const cities = useMopeduCities()
  const [cityId, setCityId] = useState<string>("")
  const zones = useMopeduZones(cityId || undefined)
  const createM = useCreateMopeduZone()
  const updateM = useUpdateMopeduZone()
  const [editing, setEditing] = useState<Zone | null>(null)
  const [creating, setCreating] = useState<boolean>(false)

  const cityList = cities.data ?? []
  const items = zones.data ?? []

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-text/55">
            City
          </span>
          <select
            value={cityId}
            onChange={(e) => setCityId(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-text"
          >
            <option value="">All cities</option>
            {cityList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <PrimaryButton
          tone="green"
          onClick={() => setCreating(true)}
          disabled={cityList.length === 0}
        >
          Create zone
        </PrimaryButton>
      </div>

      <div className="overflow-hidden rounded-2xl border border-brand-divider bg-brand-card shadow-sm">
        {zones.isLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-brand-text/60">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : zones.isError ? (
          <div className="px-4 py-6 text-sm text-rose-700">
            {errorMessage(zones.error)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No zones"
            body="Define a polygon in GeoJSON to carve up a city for surge zones, fare boundaries, or supply rules."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Boundary</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((z) => {
                const city = cityList.find((c) => c.id === z.city_id)
                return (
                  <tr key={z.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-brand-text/70">
                      {city?.name ?? z.city_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 font-medium text-brand-text">
                      {z.name}
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate font-mono text-[11px] text-brand-text/55">
                      {z.boundary ? z.boundary.slice(0, 80) + "…" : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={classNames(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase",
                          z.is_active
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-gray-100 text-gray-600",
                        )}
                      >
                        {z.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setEditing(z)}
                        className="text-xs font-semibold text-brand-text/70 underline-offset-2 hover:underline"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {creating ? (
        <ZoneFormModal
          mode="create"
          cities={cityList}
          defaultCityId={cityId || cityList[0]?.id}
          onClose={() => setCreating(false)}
          onSubmit={async (body) => {
            await createM.mutateAsync(body as ZoneCreateInput)
            setCreating(false)
          }}
          pending={createM.isPending}
          error={createM.error}
        />
      ) : null}

      {editing ? (
        <ZoneFormModal
          mode="edit"
          cities={cityList}
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (body) => {
            await updateM.mutateAsync({
              id: editing.id,
              body: body as ZoneUpdateInput,
            })
            setEditing(null)
          }}
          pending={updateM.isPending}
          error={updateM.error}
        />
      ) : null}
    </div>
  )
}

function ZoneFormModal({
  mode,
  cities,
  initial,
  defaultCityId,
  onClose,
  onSubmit,
  pending,
  error,
}: {
  mode: "create" | "edit"
  cities: City[]
  initial?: Zone
  defaultCityId?: string
  onClose: () => void
  onSubmit: (body: ZoneCreateInput | ZoneUpdateInput) => Promise<void>
  pending: boolean
  error: unknown
}) {
  const [city, setCity] = useState(initial?.city_id ?? defaultCityId ?? "")
  const [name, setName] = useState(initial?.name ?? "")
  const [boundary, setBoundary] = useState(initial?.boundary ?? "")
  const [active, setActive] = useState(initial?.is_active ?? true)

  async function handle(e: React.FormEvent) {
    e.preventDefault()
    if (!city || !name.trim()) return
    await onSubmit({
      city_id: city,
      name: name.trim(),
      boundary: boundary.trim() || undefined,
      is_active: active,
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === "create" ? "Create zone" : `Edit ${initial?.name ?? ""}`}
      width="lg"
    >
      <form onSubmit={handle} className="space-y-3">
        <FormField label="City" required>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-text"
            required
          >
            <option value="">Select a city…</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Name" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-text"
            required
          />
        </FormField>
        <FormField label="Boundary (GeoJSON polygon)">
          <textarea
            value={boundary}
            onChange={(e) => setBoundary(e.target.value)}
            rows={6}
            placeholder='{"type":"Polygon","coordinates":[[[lng,lat],...]]}'
            className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs outline-none focus:border-brand-text"
          />
          <p className="mt-1 text-[11px] text-brand-text/55">
            v1 only ships a textarea — draw + copy from{" "}
            <a
              href="https://geojson.io"
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-2 hover:underline"
            >
              geojson.io
            </a>
            . A real polygon editor is on the roadmap.
          </p>
        </FormField>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Active
        </label>
        {error ? (
          <p className="text-xs text-rose-700">{errorMessage(error)}</p>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose} disabled={pending}>
            Cancel
          </SecondaryButton>
          <PrimaryButton tone="green" type="submit" disabled={pending}>
            {pending ? "Saving…" : mode === "create" ? "Create" : "Save"}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  )
}

// ── Fare rules tab ────────────────────────────────────────────────────────

function FareRulesTab() {
  const cities = useMopeduCities()
  const [cityId, setCityId] = useState<string>("")
  const rules = useMopeduFareRules(cityId || undefined)
  const createM = useCreateMopeduFareRule()
  const updateM = useUpdateMopeduFareRule()
  const [editing, setEditing] = useState<FareRule | null>(null)
  const [creating, setCreating] = useState<boolean>(false)
  const [surgeFor, setSurgeFor] = useState<FareRule | null>(null)

  const cityList = cities.data ?? []
  const items = rules.data ?? []

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-text/55">
            City
          </span>
          <select
            value={cityId}
            onChange={(e) => setCityId(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-text"
          >
            <option value="">All cities</option>
            {cityList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <PrimaryButton
          tone="green"
          onClick={() => setCreating(true)}
          disabled={cityList.length === 0}
        >
          Create rule
        </PrimaryButton>
      </div>

      <div className="overflow-hidden rounded-2xl border border-brand-divider bg-brand-card shadow-sm">
        {rules.isLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-brand-text/60">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : rules.isError ? (
          <div className="px-4 py-6 text-sm text-rose-700">
            {errorMessage(rules.error)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No fare rules"
            body="A rule per (city × vehicle_type) lets dispatch quote rides."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Base</th>
                <th className="px-4 py-3">Per km</th>
                <th className="px-4 py-3">Per min</th>
                <th className="px-4 py-3">Min</th>
                <th className="px-4 py-3">Surge</th>
                <th className="px-4 py-3">Cancel fee</th>
                <th className="px-4 py-3">Tax %</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((r) => {
                const city = cityList.find((c) => c.id === r.city_id)
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-brand-text/70">
                      {city?.name ?? r.city_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-xs capitalize">
                      {r.vehicle_type}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {paiseToRupees(r.base_fare_paise)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {paiseToRupees(r.per_km_paise)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {paiseToRupees(r.per_minute_paise)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {paiseToRupees(r.minimum_fare_paise)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {r.surge_multiplier.toFixed(2)}×
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {paiseToRupees(r.cancellation_fee_paise)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.tax_rate_pct.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={classNames(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase",
                          r.is_active
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-gray-100 text-gray-600",
                        )}
                      >
                        {r.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSurgeFor(r)}
                          className="rounded-md bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-600"
                        >
                          Set surge
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(r)}
                          className="text-xs font-semibold text-brand-text/70 underline-offset-2 hover:underline"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {creating ? (
        <FareRuleFormModal
          mode="create"
          cities={cityList}
          defaultCityId={cityId || cityList[0]?.id}
          onClose={() => setCreating(false)}
          onSubmit={async (body) => {
            await createM.mutateAsync(body as FareRuleCreateInput)
            setCreating(false)
          }}
          pending={createM.isPending}
          error={createM.error}
        />
      ) : null}

      {editing ? (
        <FareRuleFormModal
          mode="edit"
          cities={cityList}
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (body) => {
            await updateM.mutateAsync({
              id: editing.id,
              body: body as FareRuleUpdateInput,
            })
            setEditing(null)
          }}
          pending={updateM.isPending}
          error={updateM.error}
        />
      ) : null}

      {surgeFor ? (
        <SurgeQuickModal
          rule={surgeFor}
          onClose={() => setSurgeFor(null)}
          onSubmit={async (multiplier) => {
            await updateM.mutateAsync({
              id: surgeFor.id,
              body: { surge_multiplier: multiplier },
            })
            setSurgeFor(null)
          }}
          pending={updateM.isPending}
          error={updateM.error}
        />
      ) : null}
    </div>
  )
}

function SurgeQuickModal({
  rule,
  onClose,
  onSubmit,
  pending,
  error,
}: {
  rule: FareRule
  onClose: () => void
  onSubmit: (multiplier: number) => Promise<void>
  pending: boolean
  error: unknown
}) {
  const [val, setVal] = useState<string>(rule.surge_multiplier.toFixed(2))

  async function handle(e: React.FormEvent) {
    e.preventDefault()
    const n = Number(val)
    if (!Number.isFinite(n) || n <= 0) return
    await onSubmit(n)
  }

  return (
    <Modal open onClose={onClose} title="Set surge multiplier" width="sm">
      <form onSubmit={handle} className="space-y-3">
        <p className="text-xs text-brand-text/70">
          {rule.vehicle_type} · current {rule.surge_multiplier.toFixed(2)}×
        </p>
        <FormField label="Surge multiplier" required>
          <input
            type="number"
            step="0.01"
            min="0.1"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-text"
            required
          />
        </FormField>
        {error ? (
          <p className="text-xs text-rose-700">{errorMessage(error)}</p>
        ) : null}
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose} disabled={pending}>
            Cancel
          </SecondaryButton>
          <PrimaryButton tone="amber" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Apply"}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  )
}

function FareRuleFormModal({
  mode,
  cities,
  initial,
  defaultCityId,
  onClose,
  onSubmit,
  pending,
  error,
}: {
  mode: "create" | "edit"
  cities: City[]
  initial?: FareRule
  defaultCityId?: string
  onClose: () => void
  onSubmit: (body: FareRuleCreateInput | FareRuleUpdateInput) => Promise<void>
  pending: boolean
  error: unknown
}) {
  const [city, setCity] = useState(initial?.city_id ?? defaultCityId ?? "")
  const [vehicle, setVehicle] = useState<VehicleType>(
    initial?.vehicle_type ?? "bike",
  )
  const [base, setBase] = useState(String(initial?.base_fare_paise ?? 0))
  const [perKm, setPerKm] = useState(String(initial?.per_km_paise ?? 0))
  const [perMin, setPerMin] = useState(String(initial?.per_minute_paise ?? 0))
  const [minFare, setMinFare] = useState(
    String(initial?.minimum_fare_paise ?? 0),
  )
  const [surge, setSurge] = useState(
    String(initial?.surge_multiplier ?? 1),
  )
  const [cancelFee, setCancelFee] = useState(
    String(initial?.cancellation_fee_paise ?? 0),
  )
  const [tax, setTax] = useState(String(initial?.tax_rate_pct ?? 0))
  const [active, setActive] = useState(initial?.is_active ?? true)

  // Re-sync default when defaultCityId changes (entering modal afresh).
  useEffect(() => {
    if (!initial && defaultCityId && !city) setCity(defaultCityId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCityId])

  async function handle(e: React.FormEvent) {
    e.preventDefault()
    const num = (s: string) => {
      const n = Number(s)
      return Number.isFinite(n) ? n : 0
    }
    if (!city) return
    await onSubmit({
      city_id: city,
      vehicle_type: vehicle,
      base_fare_paise: Math.round(num(base)),
      per_km_paise: Math.round(num(perKm)),
      per_minute_paise: Math.round(num(perMin)),
      minimum_fare_paise: Math.round(num(minFare)),
      surge_multiplier: num(surge),
      cancellation_fee_paise: Math.round(num(cancelFee)),
      tax_rate_pct: num(tax),
      is_active: active,
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === "create" ? "Create fare rule" : "Edit fare rule"}
      width="lg"
    >
      <form onSubmit={handle} className="grid grid-cols-2 gap-3">
        <FormField label="City" required>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-text"
            required
            disabled={mode === "edit"}
          >
            <option value="">Select…</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Vehicle type" required>
          <select
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value as VehicleType)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-text"
            disabled={mode === "edit"}
          >
            {VEHICLE_TYPES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </FormField>
        <FareNumberField label="Base fare (paise)" value={base} setValue={setBase} />
        <FareNumberField label="Per km (paise)" value={perKm} setValue={setPerKm} />
        <FareNumberField label="Per minute (paise)" value={perMin} setValue={setPerMin} />
        <FareNumberField label="Minimum fare (paise)" value={minFare} setValue={setMinFare} />
        <FareNumberField label="Surge multiplier" value={surge} setValue={setSurge} step="0.01" />
        <FareNumberField label="Cancellation fee (paise)" value={cancelFee} setValue={setCancelFee} />
        <FareNumberField label="Tax rate (%)" value={tax} setValue={setTax} step="0.01" />
        <label className="col-span-2 flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Active
        </label>
        {error ? (
          <p className="col-span-2 text-xs text-rose-700">
            {errorMessage(error)}
          </p>
        ) : null}
        <div className="col-span-2 flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose} disabled={pending}>
            Cancel
          </SecondaryButton>
          <PrimaryButton tone="green" type="submit" disabled={pending}>
            {pending ? "Saving…" : mode === "create" ? "Create" : "Save"}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  )
}

function FareNumberField({
  label,
  value,
  setValue,
  step = "1",
}: {
  label: string
  value: string
  setValue: (v: string) => void
  step?: string
}) {
  return (
    <FormField label={label}>
      <input
        type="number"
        step={step}
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-text"
      />
    </FormField>
  )
}

// ── Form field wrapper ────────────────────────────────────────────────────

function FormField({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-semibold uppercase tracking-wider text-brand-text/60">
        {label}
        {required ? <span className="ml-0.5 text-rose-600">*</span> : null}
      </span>
      {children}
    </label>
  )
}
