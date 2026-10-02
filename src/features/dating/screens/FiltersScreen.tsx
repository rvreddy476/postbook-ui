"use client"

/*
  /dating/filters — mechanic M6. Opened from the deck.

  Decided by the server, never by this client:
    - flag off (no `pass_filters` in GET /preferences): a note pointing to
      Preferences, and nothing here is sent;
    - unlocked (`pass_filters.active`): every filter, saved together;
    - locked (no pass, or a 403 FILTERS_REQUIRE_PASS since the page loaded):
      the free section saves on its own, the pass section is off under an
      upsell, and saved pass filters can be cleared.
  Saving refreshes the deck (the preferences mutation invalidates it).
*/

import { useRouter } from "next/navigation"
import { useState } from "react"

import { useGlobalToast } from "@/contexts/ToastContext"

import { FiltersOff, FiltersPanel } from "../components/Filters"
import { ErrorState, Guard } from "../components/Guard"
import { Loading, PageHead } from "../components/kit"
import { usePreferences, useProfileOptions, usePutPreferences } from "../hooks/profile"
import { datingErrorCopy, isFiltersRequirePass, refusedField } from "../model/errors"
import { clearPassFiltersBody, DATING_BASE, filtersBody, filtersEnabled, filtersForm, filtersProblem, hasPassFilters, withoutPassFilters, type AboutProblem, type FiltersForm } from "../model/profile"

function FiltersBody() {
  const router = useRouter()
  const toast = useGlobalToast()
  const prefs = usePreferences()
  const options = useProfileOptions()
  const save = usePutPreferences()
  /** null: nothing edited, so the saved values are shown. */
  const [form, setForm] = useState<FiltersForm | null>(null)
  const [lockedByServer, setLockedByServer] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState("")
  const [fieldError, setFieldError] = useState<AboutProblem | null>(null)

  if (prefs.isPending || options.isPending) return <Loading />
  if (prefs.isError) return <ErrorState error={prefs.error} onRetry={() => void prefs.refetch()} />
  if (options.isError) return <ErrorState error={options.error} onRetry={() => void options.refetch()} />
  if (!filtersEnabled(prefs.data)) return <FiltersOff />

  const opts = options.data
  const current = form ?? filtersForm(prefs.data, opts)
  const locked = lockedByServer || !prefs.data.passFilters?.active
  const savedPass = hasPassFilters(prefs.data.passFilters)

  const edit = (next: FiltersForm) => {
    setForm(next)
    setError("")
    setFieldError(null)
  }

  /** The pass ran out since the page loaded: lock, and show what the server holds now, keeping the free edits. */
  const lockNow = () => {
    setLockedByServer(true)
    void prefs.refetch().then((r) => {
      if (!r.data) return
      const fresh = filtersForm(r.data, opts)
      setForm((f) => {
        const mine = f ?? current
        return { ...fresh, minAge: mine.minAge, maxAge: mine.maxAge, distanceBucket: mine.distanceBucket, intentFilter: mine.intentFilter }
      })
    })
  }

  const refused = (e: unknown) => {
    if (isFiltersRequirePass(e)) {
      lockNow()
      setError(datingErrorCopy(e))
      return
    }
    const field = refusedField(e)
    if (field) {
      setFieldError({ field, message: datingErrorCopy(e) })
      setError("")
    } else {
      setError(datingErrorCopy(e))
    }
  }

  return (
    <FiltersPanel
      options={opts}
      form={current}
      locked={locked}
      savedPass={savedPass}
      busy={save.isPending}
      clearing={clearing}
      error={error}
      fieldError={fieldError}
      onChange={edit}
      onSave={() => {
        const problem = filtersProblem(current, opts)
        if (problem) {
          setFieldError(problem)
          return
        }
        setFieldError(null)
        setError("")
        save.mutate(filtersBody(current, !locked), {
          onSuccess: () => {
            toast({ type: "success", title: "Filters saved" })
            router.push(DATING_BASE)
          },
          onError: refused,
        })
      }}
      onClear={() => {
        setClearing(true)
        save.mutate(clearPassFiltersBody(), {
          onSuccess: () => {
            setForm(withoutPassFilters(current))
            setError("")
            toast({ type: "success", title: "Pass filters cleared" })
          },
          onError: refused,
          onSettled: () => setClearing(false),
        })
      }}
    />
  )
}

export function FiltersScreen() {
  return (
    <Guard need="ready">
      <div className="pulse-page pulse-page--narrow">
        <PageHead title="Filters" sub="Who shows up in your deck." back={{ href: DATING_BASE, label: "Deck" }} />
        <FiltersBody />
      </div>
    </Guard>
  )
}
