"use client"

/*
  Setting up a profile, one screen per step. Each screen saves, then goes
  back to /dating: the SERVER's status decides what comes next, so a step is
  never skipped by a link. The same screens edit an existing profile from
  Settings.
*/

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { ShieldAlert, Star, Trash2, Upload, UserRound } from "lucide-react"

import { useGlobalToast } from "@/contexts/ToastContext"

import { uploadPhoto } from "../api/media"
import { AboutMeEditor } from "../components/AboutMe"
import { ErrorState, Guard } from "../components/Guard"
import { ClipStatusLine, PromptClipControls } from "../components/PromptClips"
import { Button, Choices, Field, LinkButton, Loading, Notice, PageHead, Panel, Pill, StatePanel } from "../components/kit"
import { usePromptClipEditor } from "../hooks/promptClips"
import { useCreatePhoto, useDeletePhoto, useDeletePrompt, useGate, useMyPhotos, useProfileOptions, usePromptCatalog, usePrompts, usePutPreferences, useSetPhotoVisibility, useSetPrimaryPhoto, useUpsertProfile, useUpsertPrompt } from "../hooks/profile"
import { AGE_REQUIRED_COPY, datingErrorCopy, isAgeRefusal, refusedField } from "../model/errors"
import { GENDER_OPTIONS, INTENT_OPTIONS, INTERESTED_IN_OPTIONS, PHOTO_VISIBILITY_OPTIONS, PREFERENCE_LIMITS, PROMPT_ANSWER_MAX } from "../model/labels"
import { MAX_PHOTOS, PHOTO_ACCEPT, moderationView, ownPhotoSrc, photoFileProblem, type MyPhoto } from "../model/photos"
import {
  DATING_BASE,
  STATUS,
  aboutBody,
  aboutForm,
  aboutProblem,
  droppedLanguages,
  identityIncomplete,
  preferencesBody,
  preferencesForm,
  preferencesProblem,
  profileBody,
  type AboutForm,
  type AboutProblem,
  type PreferencesInput,
  type Profile,
} from "../model/profile"
import type { ClipKind, ClipPhase } from "../model/promptClips"
import { answerProblem, type PromptAnswer, type PromptQuestion } from "../model/prompts"

const SETUP_STEPS = ["intent", "basics", "preferences", "photos", "selfie"] as const
type SetupStep = (typeof SETUP_STEPS)[number]

export function StepHeader({ step, title, sub }: { step: SetupStep | null; title: string; sub?: ReactNode }) {
  const index = step ? SETUP_STEPS.indexOf(step) + 1 : 0
  return (
    <>
      {index > 0 ? (
        <p className="pulse-steps" aria-label={`Step ${index} of ${SETUP_STEPS.length}`}>
          Step {index} of {SETUP_STEPS.length}
          <span className="pulse-steps__bar" aria-hidden="true">
            <span style={{ width: `${(index / SETUP_STEPS.length) * 100}%` }} />
          </span>
        </p>
      ) : null}
      <PageHead title={title} sub={sub} />
    </>
  )
}

/** The 18+ refusal, said plainly. */
export function AgeRefusal() {
  return (
    <StatePanel icon={ShieldAlert} tone="danger" title="Pulse is for adults only" body={AGE_REQUIRED_COPY}>
      <LinkButton href="/settings">Account settings</LinkButton>
      <LinkButton href="/" variant="quiet">
        Back to Momentum
      </LinkButton>
    </StatePanel>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <Guard need="access">
      <div className="pulse-page pulse-page--narrow">{children}</div>
    </Guard>
  )
}

/** True once the profile is past setup: the screen is then an editor, and says "Save". */
const isEditing = (profile: Profile | null) => !!profile && profile.status !== STATUS.draft

/* ── intent ──────────────────────────────────────────────────────── */

function IntentForm() {
  const gate = useGate()
  const router = useRouter()
  const save = useUpsertProfile()
  const profile = gate.kind === "open" ? gate.profile : null
  const [intent, setIntent] = useState(profile?.intent ?? "")
  const [error, setError] = useState("")
  const [underage, setUnderage] = useState(false)

  if (underage) return <AgeRefusal />
  const editing = isEditing(profile)
  return (
    <>
      <StepHeader step={editing ? null : "intent"} title="What are you looking for?" sub="Pulse is for adults only (18+). You can change this later." />
      <form
        className="pulse-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!intent) {
            setError("Choose one to continue.")
            return
          }
          setError("")
          save.mutate(profileBody({ intent }), {
            onSuccess: () => router.push(editing ? `${DATING_BASE}/settings` : DATING_BASE),
            onError: (err) => (isAgeRefusal(err) ? setUnderage(true) : setError(datingErrorCopy(err))),
          })
        }}
      >
        <Choices name="intent" legend="I'm looking for" options={INTENT_OPTIONS} value={intent} onChange={setIntent} />
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button variant="primary" type="submit" busy={save.isPending}>
          {editing ? "Save" : "Continue"}
        </Button>
      </form>
    </>
  )
}

export function IntentScreen() {
  return (
    <Shell>
      <IntentForm />
    </Shell>
  )
}

/* ── basics ──────────────────────────────────────────────────────── */

function birthDateLine(profile: Profile | null): string {
  if (!profile?.birthDate) return "Not on your Momentum account yet"
  return new Date(profile.birthDate).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
}

function BasicsForm() {
  const gate = useGate()
  const router = useRouter()
  const save = useUpsertProfile()
  const profile = gate.kind === "open" ? gate.profile : null
  const [firstName, setFirstName] = useState(profile?.firstName ?? "")
  const [gender, setGender] = useState(profile?.gender ?? "")
  const [city, setCity] = useState(profile?.city ?? "")
  const [bio, setBio] = useState(profile?.bio ?? "")
  const [error, setError] = useState("")
  const [underage, setUnderage] = useState(false)

  if (underage) return <AgeRefusal />
  const editing = isEditing(profile)
  // Everything this screen can supply is saved and the server still says draft.
  const waitingOnIdentity = !!profile && profile.status === STATUS.draft && !!profile.gender && !!profile.city && identityIncomplete(profile)

  return (
    <>
      <StepHeader step={editing ? null : "basics"} title="The basics" sub="Your first name and age show on your profile. Your birth date never does." />
      {waitingOnIdentity ? (
        <Notice tone="warning" role="alert">
          {AGE_REQUIRED_COPY} Add your name and birth date in your <Link href="/settings">account settings</Link>, then come back.
        </Notice>
      ) : null}
      <form
        className="pulse-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!gender) return setError("Choose your gender.")
          if (!city.trim()) return setError("Type your city.")
          setError("")
          save.mutate(profileBody({ firstName, gender, city, bio, intent: profile?.intent }), {
            onSuccess: () => router.push(editing ? `${DATING_BASE}/settings` : DATING_BASE),
            onError: (err) => (isAgeRefusal(err) ? setUnderage(true) : setError(datingErrorCopy(err))),
          })
        }}
      >
        <Field id="pulse-first-name" label="First name">
          <input id="pulse-first-name" className="pulse-input" type="text" autoComplete="given-name" maxLength={40} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </Field>
        <Field id="pulse-birth-date" label="Birth date" help="From your Momentum account. Pulse is for adults only (18+), so it can't be typed here.">
          <input id="pulse-birth-date" className="pulse-input" type="text" value={birthDateLine(profile)} readOnly aria-readonly="true" />
        </Field>
        <Choices name="gender" legend="I am" options={GENDER_OPTIONS} value={gender} onChange={setGender} />
        <Field id="pulse-city" label="City" help="People only ever see roughly how far away you are, never where you are.">
          <input id="pulse-city" className="pulse-input" type="text" autoComplete="address-level2" maxLength={80} value={city} onChange={(e) => setCity(e.target.value)} />
        </Field>
        <Field id="pulse-bio" label="About you (optional)" help={`${bio.length}/500`}>
          <textarea id="pulse-bio" className="pulse-input" rows={4} maxLength={500} value={bio} onChange={(e) => setBio(e.target.value)} />
        </Field>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button variant="primary" type="submit" busy={save.isPending}>
          {editing ? "Save" : "Continue"}
        </Button>
      </form>
    </>
  )
}

export function BasicsScreen() {
  return (
    <Shell>
      <BasicsForm />
    </Shell>
  )
}

/* ── preferences ─────────────────────────────────────────────────── */

function PreferencesFormView() {
  const gate = useGate()
  const router = useRouter()
  const save = usePutPreferences()
  const profile = gate.kind === "open" ? gate.profile : null
  const saved = gate.kind === "open" ? gate.preferences : null
  const [form, setForm] = useState<PreferencesInput>(() => preferencesForm(saved))
  const [error, setError] = useState("")
  const editing = isEditing(profile)
  const set = <K extends keyof PreferencesInput>(key: K, value: PreferencesInput[K]) => setForm((f) => ({ ...f, [key]: value }))
  const L = PREFERENCE_LIMITS

  return (
    <>
      <StepHeader step={editing ? null : "preferences"} title="Who would you like to meet?" sub="Your deck follows these. Everyone on Pulse is 18 or older." />
      <form
        className="pulse-form"
        onSubmit={(e) => {
          e.preventDefault()
          const problem = preferencesProblem(form)
          if (problem) return setError(problem)
          setError("")
          save.mutate(preferencesBody(form), {
            onSuccess: () => router.push(editing ? `${DATING_BASE}/settings` : DATING_BASE),
            onError: (err) => setError(datingErrorCopy(err)),
          })
        }}
      >
        <Choices name="interested-in" legend="Show me" options={INTERESTED_IN_OPTIONS} value={form.interestedIn} onChange={(v) => set("interestedIn", v)} />
        <div className="pulse-form__pair">
          <Field id="pulse-min-age" label="Youngest age">
            <input id="pulse-min-age" className="pulse-input" type="number" inputMode="numeric" min={L.minAge} max={L.maxAge} value={form.minAge} onChange={(e) => set("minAge", Number(e.target.value))} />
          </Field>
          <Field id="pulse-max-age" label="Oldest age">
            <input id="pulse-max-age" className="pulse-input" type="number" inputMode="numeric" min={L.minAge} max={L.maxAge} value={form.maxAge} onChange={(e) => set("maxAge", Number(e.target.value))} />
          </Field>
        </div>
        <Field id="pulse-distance" label="How far to look (km)" help="This sets your search area. Nobody is ever shown an exact distance.">
          <input id="pulse-distance" className="pulse-input" type="number" inputMode="numeric" min={L.minDistanceKm} max={L.maxDistanceKm} value={form.distanceKm} onChange={(e) => set("distanceKm", Number(e.target.value))} />
        </Field>
        <Choices
          name="intent-filter"
          legend="Looking for (optional, pick any)"
          options={INTENT_OPTIONS}
          value={form.intentFilter}
          multiple
          onChange={(v) => set("intentFilter", form.intentFilter.includes(v) ? form.intentFilter.filter((x) => x !== v) : [...form.intentFilter, v])}
        />
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button variant="primary" type="submit" busy={save.isPending}>
          {editing ? "Save" : "Continue"}
        </Button>
      </form>
    </>
  )
}

export function PreferencesScreen() {
  return (
    <Shell>
      <PreferencesFormView />
    </Shell>
  )
}

/* ── photos ──────────────────────────────────────────────────────── */

export function PhotoTile({
  photo,
  busy,
  onPrimary,
  onRemove,
  onVisibility,
}: {
  photo: MyPhoto
  busy: boolean
  onPrimary: () => void
  onRemove: () => void
  onVisibility: (value: string) => void
}) {
  const view = moderationView(photo)
  const src = ownPhotoSrc(photo)
  return (
    <li className="pulse-phototile">
      <div className="pulse-photo pulse-phototile__img">
        {src ? (
          // Your own upload, read from media-service with the media cookie.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={photo.isPrimary ? "Your main photo" : "Your photo"} />
        ) : null}
      </div>
      <div className="pulse-phototile__body">
        <div className="pulse-row">
          {photo.isPrimary ? <Pill tone="info">Main photo</Pill> : null}
          <Pill tone={view.tone}>{view.label}</Pill>
        </div>
        {view.reason ? <p className="pulse-field__error">{view.reason}</p> : null}
        <label className="pulse-field__label" htmlFor={`pulse-visibility-${photo.id}`}>
          Who can see it
        </label>
        <select id={`pulse-visibility-${photo.id}`} className="pulse-input" value={photo.visibility} disabled={busy} onChange={(e) => onVisibility(e.target.value)}>
          {PHOTO_VISIBILITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div className="pulse-row">
          {photo.isPrimary ? null : (
            <Button variant="quiet" icon={Star} disabled={busy} onClick={onPrimary}>
              Make main
            </Button>
          )}
          <Button variant="quiet" icon={Trash2} disabled={busy} onClick={onRemove}>
            Remove
          </Button>
        </div>
      </div>
    </li>
  )
}

function uploadProblemCopy(error: unknown): string {
  const message = error instanceof Error ? error.message : ""
  if (message === "photo_refused") return "That photo wasn't accepted. Choose another one."
  if (message === "photo_slow") return "That photo is taking too long to process. Try again in a moment."
  if (message.startsWith("upload_")) return "The photo didn't upload. Check your connection and try again."
  return datingErrorCopy(error)
}

function PhotosManager() {
  const gate = useGate()
  const toast = useGlobalToast()
  const photos = useMyPhotos()
  const create = useCreatePhoto()
  const setPrimary = useSetPrimaryPhoto()
  const setVisibility = useSetPhotoVisibility()
  const remove = useDeletePhoto()
  const input = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<string>("")
  const [error, setError] = useState("")
  const profile = gate.kind === "open" ? gate.profile : null
  const editing = !!profile && profile.status !== STATUS.draft && profile.status !== STATUS.pendingPhoto

  if (photos.isPending) return <Loading />
  if (photos.isError) return <ErrorState error={photos.error} onRetry={() => void photos.refetch()} />

  const list = photos.data
  const live = list.filter((p) => p.moderationStatus !== "rejected")
  const full = live.length >= MAX_PHOTOS
  const busy = progress !== "" || create.isPending || setPrimary.isPending || remove.isPending || setVisibility.isPending
  const fail = (e: unknown) => toast({ type: "error", title: datingErrorCopy(e) })

  const onPick = async (file: File | undefined) => {
    if (input.current) input.current.value = ""
    if (!file) return
    const problem = photoFileProblem(file)
    if (problem) return setError(problem)
    setError("")
    setProgress("Uploading 0%")
    try {
      const mediaId = await uploadPhoto(file, {
        onProgress: (f) => setProgress(`Uploading ${Math.round(f * 100)}%`),
        onProcessing: () => setProgress("Checking the photo"),
      })
      await create.mutateAsync({ mediaId, isPrimary: live.length === 0, sortOrder: list.length })
    } catch (e) {
      setError(uploadProblemCopy(e))
    } finally {
      setProgress("")
    }
  }

  return (
    <>
      <StepHeader step={editing ? null : "photos"} title="Your photos" sub={`Add up to ${MAX_PHOTOS}. Your main photo must clearly show your face: it's what the selfie check compares against.`} />
      {list.length === 0 ? <Notice tone="info">Add at least one photo to continue.</Notice> : null}
      <ul className="pulse-photogrid">
        {list.map((p) => (
          <PhotoTile
            key={p.id}
            photo={p}
            busy={busy}
            onPrimary={() => setPrimary.mutate(p.id, { onError: fail })}
            onRemove={() => remove.mutate(p.id, { onError: fail })}
            onVisibility={(visibility) => setVisibility.mutate({ id: p.id, visibility }, { onError: fail })}
          />
        ))}
      </ul>
      <input ref={input} type="file" accept={PHOTO_ACCEPT} className="pulse-sr" id="pulse-photo-file" tabIndex={-1} onChange={(e) => void onPick(e.target.files?.[0])} />
      <div className="pulse-row">
        <Button variant="primary" icon={Upload} busy={progress !== ""} disabled={full || busy} onClick={() => input.current?.click()}>
          {progress || "Add a photo"}
        </Button>
        <LinkButton href={`${DATING_BASE}/onboarding/prompts`}>Add prompts</LinkButton>
        <LinkButton href={editing ? `${DATING_BASE}/settings` : DATING_BASE} variant="quiet">
          {editing ? "Done" : "Continue"}
        </LinkButton>
      </div>
      {full ? <Notice tone="muted">You&apos;ve reached {MAX_PHOTOS} photos. Remove one to add another.</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <p className="pulse-field__help">Photos are checked before anyone sees them. A photo in review can take a little while.</p>
    </>
  )
}

export function PhotosScreen() {
  return (
    <Shell>
      <PhotosManager />
    </Shell>
  )
}

/* ── prompts ─────────────────────────────────────────────────────── */

/** Voice and video answers (M15): what the editor needs from usePromptClipEditor. Absent: no clip controls. */
export interface PromptEditorClips {
  phase: ClipPhase
  /** 404 MECHANIC_NOT_ENABLED: the controls go. */
  off: boolean
  removing: boolean
  onSend: (promptId: number, clip: Blob, kind: ClipKind, mime: string) => void
  onProblem: (message: string) => void
  onRemove: (promptId: number) => void
}

export function PromptEditor({
  catalog,
  answers,
  busy,
  onSave,
  onDelete,
  clips,
}: {
  catalog: PromptQuestion[]
  answers: PromptAnswer[]
  busy: boolean
  onSave: (promptId: number, answer: string) => void
  onDelete: (promptId: number) => void
  clips?: PromptEditorClips
}) {
  const [promptId, setPromptId] = useState(0)
  const [answer, setAnswer] = useState("")
  const [error, setError] = useState("")
  const question = (id: number) => catalog.find((q) => q.id === id)?.question ?? ""

  // Picking a prompt that already has an answer loads it for editing.
  useEffect(() => {
    setAnswer(answers.find((a) => a.promptId === promptId)?.answer ?? "")
    setError("")
  }, [promptId, answers])

  return (
    <>
      {answers.length ? (
        <Panel title="Your answers">
          <dl className="pulse-prompts">
            {answers
              .filter((a) => question(a.promptId))
              .map((a) => (
                <div key={a.promptId}>
                  <dt>{question(a.promptId)}</dt>
                  {a.answer ? <dd>{a.answer}</dd> : null}
                  {a.clip ? (
                    <dd>
                      <ClipStatusLine clip={a.clip} />
                    </dd>
                  ) : null}
                  <div className="pulse-row">
                    <Button variant="quiet" disabled={busy} onClick={() => setPromptId(a.promptId)}>
                      Edit
                    </Button>
                    <Button variant="quiet" icon={Trash2} disabled={busy} onClick={() => onDelete(a.promptId)}>
                      Remove
                    </Button>
                    {/* A clip-only answer goes whole with Remove; beside text, the clip can go on its own. */}
                    {clips && !clips.off && a.clip && a.answer ? (
                      <Button variant="quiet" icon={Trash2} disabled={busy || clips.removing} onClick={() => clips.onRemove(a.promptId)}>
                        Remove clip
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
          </dl>
        </Panel>
      ) : null}
      <form
        className="pulse-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!promptId) return setError("Choose a prompt.")
          const problem = answerProblem(answer)
          if (problem) return setError(problem)
          setError("")
          onSave(promptId, answer)
        }}
      >
        <Field id="pulse-prompt" label="Prompt">
          <select id="pulse-prompt" className="pulse-input" value={promptId} onChange={(e) => setPromptId(Number(e.target.value))}>
            <option value={0}>Choose a prompt</option>
            {catalog.map((q) => (
              <option key={q.id} value={q.id}>
                {q.question}
              </option>
            ))}
          </select>
        </Field>
        <Field id="pulse-prompt-answer" label="Your answer" help={`${answer.trim().length}/${PROMPT_ANSWER_MAX}`}>
          <textarea id="pulse-prompt-answer" className="pulse-input" rows={3} maxLength={PROMPT_ANSWER_MAX} value={answer} onChange={(e) => setAnswer(e.target.value)} />
        </Field>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button variant="primary" type="submit" busy={busy}>
          Save answer
        </Button>
      </form>
      {clips ? <PromptClipControls promptId={promptId} phase={clips.phase} off={clips.off} onSend={clips.onSend} onProblem={clips.onProblem} /> : null}
    </>
  )
}

function PromptsManager() {
  const toast = useGlobalToast()
  const catalog = usePromptCatalog()
  const answers = usePrompts()
  const save = useUpsertPrompt()
  const remove = useDeletePrompt()
  const clip = usePromptClipEditor()

  if (catalog.isPending || answers.isPending) return <Loading />
  if (catalog.isError) return <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />
  if (answers.isError) return <ErrorState error={answers.error} onRetry={() => void answers.refetch()} />
  const fail = (e: unknown) => toast({ type: "error", title: datingErrorCopy(e) })

  return (
    <>
      <PageHead title="Prompts" sub="Optional. A few answers give people something to spark." back={{ href: DATING_BASE, label: "Pulse" }} />
      <PromptEditor
        catalog={catalog.data}
        answers={answers.data}
        busy={save.isPending || remove.isPending}
        onSave={(promptId, answer) => save.mutate({ promptId, answer }, { onSuccess: () => toast({ type: "success", title: "Answer saved" }), onError: fail })}
        onDelete={(promptId) => remove.mutate(promptId, { onError: fail })}
        clips={{
          phase: clip.phase,
          off: clip.off,
          removing: clip.removing,
          onSend: (promptId, blob, kind, mime) =>
            void clip.send(promptId, blob, kind, mime).then((r) => {
              if (r) toast({ type: "success", title: r.clip.status === "approved" ? "Clip added" : "Clip added. It shows once it's been checked." })
            }),
          onProblem: clip.fail,
          onRemove: clip.remove,
        }}
      />
      <div className="pulse-row">
        <LinkButton href={ABOUT_HREF} icon={UserRound}>
          Next: about me
        </LinkButton>
        <LinkButton href={DATING_BASE} variant="quiet">
          Done
        </LinkButton>
      </div>
    </>
  )
}

export function PromptsScreen() {
  return (
    <Shell>
      <PromptsManager />
    </Shell>
  )
}

/* ── about me (mechanic M6) ──────────────────────────────────────── */

export const ABOUT_HREF = `${DATING_BASE}/onboarding/about`

/**
  Optional, after the prompts, and from Settings. It never holds up setup:
  the server's status doesn't depend on any of it.
*/
function AboutMeView() {
  const gate = useGate()
  const router = useRouter()
  const toast = useGlobalToast()
  const options = useProfileOptions()
  const save = useUpsertProfile()
  const profile = gate.kind === "open" ? gate.profile : null
  /** null: nothing edited, so the saved values are shown. */
  const [form, setForm] = useState<AboutForm | null>(null)
  const [error, setError] = useState("")
  const [fieldError, setFieldError] = useState<AboutProblem | null>(null)
  const editing = isEditing(profile)
  const next = editing ? `${DATING_BASE}/settings` : DATING_BASE

  const head = (
    <PageHead
      title="About me"
      sub="Optional. Interests and a few basics give people something in common to start from."
      back={editing ? { href: `${DATING_BASE}/settings`, label: "Settings" } : { href: DATING_BASE, label: "Pulse" }}
    />
  )
  if (!profile) {
    return (
      <>
        {head}
        <Notice tone="info">
          Start your profile first, then add these. <Link href={`${DATING_BASE}/onboarding/intent`}>Start now</Link>
        </Notice>
      </>
    )
  }
  if (options.isPending || options.isError) {
    return (
      <>
        {head}
        {options.isPending ? <Loading /> : <ErrorState error={options.error} onRetry={() => void options.refetch()} />}
      </>
    )
  }

  const opts = options.data
  const current = form ?? aboutForm(profile, opts)
  return (
    <>
      {head}
      <AboutMeEditor
        options={opts}
        form={current}
        heightSaved={profile.basics.heightCm > 0}
        dropped={droppedLanguages(profile, opts)}
        busy={save.isPending}
        error={error}
        fieldError={fieldError}
        submitLabel={editing ? "Save" : "Save and continue"}
        onChange={(f) => {
          setForm(f)
          setError("")
          setFieldError(null)
        }}
        onSave={() => {
          const problem = aboutProblem(current, opts)
          if (problem) return setFieldError(problem)
          setFieldError(null)
          setError("")
          save.mutate(aboutBody(current), {
            onSuccess: () => {
              setForm(null)
              toast({ type: "success", title: "About me saved" })
              router.push(next)
            },
            onError: (err) => {
              const field = refusedField(err)
              if (field) setFieldError({ field, message: datingErrorCopy(err) })
              else setError(datingErrorCopy(err))
            },
          })
        }}
      />
      {editing ? null : (
        <div className="pulse-row">
          <LinkButton href={DATING_BASE} variant="quiet">
            Skip for now
          </LinkButton>
        </div>
      )}
    </>
  )
}

export function AboutMeScreen() {
  return (
    <Shell>
      <AboutMeView />
    </Shell>
  )
}
