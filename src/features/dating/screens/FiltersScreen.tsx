"use client"

/*
  /dating/filters — mechanic M6, and the dealbreakers of M12. Opened from the deck.

  Decided by the server, never by this client:
    - filters flag off (no `pass_filters` in GET /preferences) and no
      dealbreakers: a note pointing to Preferences, and nothing here is sent;
    - unlocked (`pass_filters.active`): every filter, saved together;
    - locked (no pass, or a 403 FILTERS_REQUIRE_PASS / DEALBREAKERS_REQUIRE_PASS
      since the page loaded): the free section saves on its own, the pass
      section is off under an upsell, and saved pass filters can be cleared;
    - dealbreakers (M12) exist while GET /preferences sends `dealbreakers`:
      a switch beside each set preference, the whole list PUT when touched.
      Filters flag off but dealbreakers on: the free preferences alone, each
      with its switch. A 404 since the page loaded hides them again.
  Saving refreshes the deck (the preferences mutation invalidates it).
*/

import { useRouter } from "next/navigation"
import { useState } from "react"

import { useGlobalToast } from "@/contexts/ToastContext"

import { DealbreakersOnlyPanel, FiltersOff, FiltersPanel } from "../components/Filters"
import { ErrorState, Guard } from "../components/Guard"
import { Loading, PageHead } from "../components/kit"
import { usePreferences, useProfileOptions, usePutPreferences } from "../hooks/profile"
import { dealbreakerRefusal, dealbreakersEnabled, dealbreakerSetInForm, dealbreakerSetInPreferences, DEALBREAKERS_OFF_COPY, dealbreakersToSend, freeDealbreakerRows, isPassDealbreaker, withDealbreakers, type DealbreakerCode } from "../model/dealbreakers"
import { datingErrorCopy, isFiltersRequirePass, refusedField } from "../model/errors"
import { clearPassFiltersBody, DATING_BASE, filtersBody, filtersEnabled, filtersForm, filtersProblem, hasPassFilters, withoutPassFilters, type AboutProblem, type FiltersForm, type Preferences } from "../model/profile"

/** Filters flag off, dealbreakers on: the free preferences that are set, each with its switch. */
function DealbreakersOnly({ prefs, onOff }: { prefs: Preferences; onOff: () => void }) {
  const toast = useGlobalToast()
  const save = usePutPreferences()
  const [chosen, setChosen] = useState<string[] | null>(null)
  const [error, setError] = useState("")
  const current = chosen ?? prefs.dealbreakers ?? []
  const isSet = (code: DealbreakerCode) => !isPassDealbreaker(code) && dealbreakerSetInPreferences(prefs, code)

  return (
    <DealbreakersOnlyPanel
      rows={freeDealbreakerRows(prefs)}
      selected={current}
      busy={save.isPending}
      error={error}
      onChange={(next) => {
        setChosen(next)
        setError("")
      }}
      onSave={() =>
        save.mutate(
          { dealbreakers: dealbreakersToSend(current, isSet, false) },
          {
            onSuccess: () => {
              setChosen(null)
              toast({ type: "success", title: "Dealbreakers saved" })
            },
            onError: (e) => {
              if (dealbreakerRefusal(e) === "off") onOff()
              setError(datingErrorCopy(e))
            },
          },
        )
      }
    />
  )
}

function FiltersBody() {
  const router = useRouter()
  const toast = useGlobalToast()
  const prefs = usePreferences()
  const options = useProfileOptions()
  const save = usePutPreferences()
  /** null: nothing edited, so the saved values are shown. */
  const [form, setForm] = useState<FiltersForm | null>(null)
  const [lockedByServer, setLockedByServer] = useState(false)
  const [dealbreakersOff, setDealbreakersOff] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState("")
  const [dealbreakerError, setDealbreakerError] = useState("")
  const [fieldError, setFieldError] = useState<AboutProblem | null>(null)

  if (prefs.isPending || options.isPending) return <Loading />
  if (prefs.isError) return <ErrorState error={prefs.error} onRetry={() => void prefs.refetch()} />
  if (options.isError) return <ErrorState error={options.error} onRetry={() => void options.refetch()} />

  const breakersOn = dealbreakersEnabled(prefs.data) && !dealbreakersOff
  const hideDealbreakers = () => {
    setDealbreakersOff(true)
    void prefs.refetch()
  }
  if (!filtersEnabled(prefs.data)) {
    return breakersOn ? <DealbreakersOnly prefs={prefs.data} onOff={hideDealbreakers} /> : <FiltersOff />
  }

  const opts = options.data
  const current = form ?? filtersForm(prefs.data, opts)
  const locked = lockedByServer || !prefs.data.passFilters?.active
  const savedPass = hasPassFilters(prefs.data.passFilters)

  const edit = (next: FiltersForm) => {
    setForm(next)
    setError("")
    setDealbreakerError("")
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
        return { ...fresh, minAge: mine.minAge, maxAge: mine.maxAge, distanceBucket: mine.distanceBucket, intentFilter: mine.intentFilter, dealbreakers: mine.dealbreakers }
      })
    })
  }

  const refused = (e: unknown, sentDealbreakers: boolean) => {
    const breaker = sentDealbreakers ? dealbreakerRefusal(e) : "other"
    if (isFiltersRequirePass(e) || breaker === "pass") {
      lockNow()
      setError(datingErrorCopy(e))
      return
    }
    if (breaker === "invalid") {
      setDealbreakerError(datingErrorCopy(e))
      setError("")
      return
    }
    if (breaker === "off") {
      hideDealbreakers()
      setError(DEALBREAKERS_OFF_COPY)
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
      dealbreakers={breakersOn}
      dealbreakerError={dealbreakerError}
      onChange={edit}
      onSave={() => {
        const problem = filtersProblem(current, opts)
        if (problem) {
          setFieldError(problem)
          return
        }
        setFieldError(null)
        setError("")
        setDealbreakerError("")
        const body = withDealbreakers(filtersBody(current, !locked), {
          enabled: breakersOn,
          saved: prefs.data.dealbreakers ?? [],
          chosen: current.dealbreakers,
          isSet: (code) => dealbreakerSetInForm(current, code),
          withPass: !locked,
        })
        save.mutate(body, {
          onSuccess: () => {
            toast({ type: "success", title: "Filters saved" })
            router.push(DATING_BASE)
          },
          onError: (e) => refused(e, "dealbreakers" in body),
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
          onError: (e) => refused(e, false),
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
