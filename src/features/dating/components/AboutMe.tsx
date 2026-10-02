"use client"

/*
  About me (mechanic M6): interests, height, languages and the four lifestyle
  basics. Presentational only; the screen holds the form and saves it. Every
  label is the server's (GET /profile/options); only codes are saved.

  Limits: once the server's maximum is picked, the unpicked chips switch off,
  so the limit can't be passed by clicking. The server checks again and its
  refusal is drawn under the field it names (`details.field`).
*/

import { Save } from "lucide-react"

import { heightChoices, LIFESTYLE_FIELDS, toggleCode, type ProfileOptions } from "../model/options"
import type { AboutForm, AboutProblem } from "../model/profile"
import { Button, Choices, Field, Notice } from "./kit"

export const PREFER_NOT_TO_SAY = "Prefer not to say"

/** "3 of 10 picked". */
export function pickedLine(count: number, max: number): string {
  return `${count} of ${max} picked`
}

const LIFESTYLE_LEGENDS: Record<(typeof LIFESTYLE_FIELDS)[number], string> = {
  drinking: "Do you drink?",
  smoking: "Do you smoke?",
  exercise: "How often do you exercise?",
  diet: "What do you eat?",
}

export function AboutMeEditor({
  options,
  form,
  heightSaved,
  dropped = 0,
  busy,
  error,
  fieldError,
  submitLabel = "Save",
  onChange,
  onSave,
}: {
  options: ProfileOptions
  form: AboutForm
  /** A height is already saved: it can be changed, not removed. */
  heightSaved: boolean
  /** Saved languages the list no longer knows. */
  dropped?: number
  busy: boolean
  error: string
  fieldError: AboutProblem | null
  submitLabel?: string
  onChange: (next: AboutForm) => void
  onSave: () => void
}) {
  const errorFor = (field: string) => (fieldError?.field === field ? fieldError.message : undefined)
  const interestsFull = form.interests.length >= options.maxInterests
  const languagesFull = form.languages.length >= options.maxLanguages
  const heights = heightChoices(options)

  return (
    <form
      className="pulse-form"
      onSubmit={(e) => {
        e.preventDefault()
        onSave()
      }}
    >
      <Choices
        name="interests"
        legend="Interests"
        help={`Pick up to ${options.maxInterests}. ${pickedLine(form.interests.length, options.maxInterests)}.`}
        options={options.interests}
        value={form.interests}
        multiple
        isDisabled={(v) => interestsFull && !form.interests.includes(v)}
        onChange={(v) => onChange({ ...form, interests: toggleCode(form.interests, v) })}
        error={errorFor("interests")}
      />

      <Field id="pulse-height" label="Height" help={heightSaved ? "You can change your height, but not remove it." : "Optional."} error={errorFor("height_cm")}>
        <select id="pulse-height" className="pulse-input" value={form.heightCm ? String(form.heightCm) : ""} onChange={(e) => onChange({ ...form, heightCm: Number(e.target.value) || 0 })}>
          {heightSaved && form.heightCm ? null : <option value="">{PREFER_NOT_TO_SAY}</option>}
          {heights.map((h) => (
            <option key={h.value} value={h.value}>
              {h.label}
            </option>
          ))}
        </select>
      </Field>

      <Choices
        name="languages"
        legend="Languages you speak"
        help={`Pick up to ${options.maxLanguages}. ${pickedLine(form.languages.length, options.maxLanguages)}.`}
        options={options.languages}
        value={form.languages}
        multiple
        isDisabled={(v) => languagesFull && !form.languages.includes(v)}
        onChange={(v) => onChange({ ...form, languages: toggleCode(form.languages, v) })}
        error={errorFor("language_prefs")}
      />
      {dropped > 0 ? <Notice tone="info">Some languages you saved earlier aren&apos;t on the list any more. Pick them again from the list.</Notice> : null}

      {LIFESTYLE_FIELDS.map((field) => (
        <Choices
          key={field}
          name={`lifestyle-${field}`}
          legend={LIFESTYLE_LEGENDS[field]}
          options={[...options[field], { value: "", label: PREFER_NOT_TO_SAY }]}
          value={form[field]}
          onChange={(v) => onChange({ ...form, [field]: v })}
          error={errorFor(field)}
        />
      ))}

      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button variant="primary" type="submit" icon={Save} busy={busy}>
        {submitLabel}
      </Button>
    </form>
  )
}
