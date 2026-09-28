"use client";

import { ChevronDown, Plus, Sparkles, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useGlobalToast } from "@/contexts/ToastContext";
import {
  HUB_CARD_TYPES,
  HUB_COMMENT_ACCESSES,
  HUB_COMMENT_MODERATIONS,
  HUB_COMMENT_SORTS,
  HUB_END_SCREEN_MAX,
  HUB_END_SCREEN_TYPES,
  HUB_LICENSES,
  HUB_REMIX_SETTINGS,
  HUB_VISIBILITIES,
  hubErrorCode,
  isShortType,
  type HubCard,
  type HubEndScreen,
  type HubLibraryRow,
  type HubPostDetail,
  type HubPostPatch,
  type HubRelatedPost,
} from "../hubApi";
import {
  COMMENT_ACCESS_LABEL,
  COMMENT_MODERATION_LABEL,
  COMMENT_SORT_LABEL,
  LICENSE_LABEL,
  REMIX_LABEL,
  VISIBILITY_LABEL,
  formatMs,
  fromLocalInput,
  parseClock,
  readableHubError,
  toLocalInput,
} from "../hubModel";
import { RECORDING_LOCATION_MAX, detailsPatch, detailsProblems, notYetPublished, toDetailsForm, type DetailsForm } from "../editForm";
import {
  useCaptionTracks,
  useHubCards,
  useHubCategories,
  useHubChapters,
  useHubEndScreens,
  useHubPost,
  usePickCoverFrame,
  useRequestAutoCaption,
  useReschedule,
  useSaveCards,
  useSaveChapters,
  useSaveEndScreens,
  useSetCaptionPublished,
  useUpdatePost,
  useUploadCaption,
  useUploadCover,
} from "../hooks/useHub";
import { PUBLISH_LANGUAGES } from "../publishDefaults";
import { chapterRowsComplete, chapterRowsFrom, chapterRowsToWire, type ChapterDraft } from "../chaptersModel";
import { ChaptersEditor } from "./ChaptersEditor";
import { SeriesSection } from "./SeriesSection";
import { HubError, HubSkeleton } from "./HubEmpty";
import { SwitchRow, Toggle, VisibilityIcon } from "./Pills";

export type SheetTab = "details" | "elements" | "captions";

export interface EditSheetProps {
  postId: string | null;
  /** Opens on this tab; "details" with `scheduleFirst` scrolls to the visibility block. */
  initialTab?: SheetTab;
  scheduleFirst?: boolean;
  /** The creator's other videos, for end-screen and card targets. */
  candidates: HubLibraryRow[];
  onClose: () => void;
}

/**
  The edit side sheet: one PATCH /v1/posts/:id with only the changed keys,
  schedule through PATCH /schedule, elements through their own POSTs,
  captions through media-service. No wizard: three tabs, one Save.
*/
export function EditSheet({ postId, initialTab = "details", scheduleFirst = false, candidates, onClose }: EditSheetProps) {
  const post = useHubPost(postId);
  const [tab, setTab] = useState<SheetTab>(initialTab);
  useEffect(() => setTab(initialTab), [initialTab, postId]);

  useEffect(() => {
    if (!postId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [postId, onClose]);

  if (!postId || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div className="hub-sheet-backdrop" onClick={onClose} role="presentation" />
      <aside className="hub hub-sheet" role="dialog" aria-modal="true" aria-labelledby="hub-sheet-title">
        <div className="hub-sheet-head">
          <div className="hub-sheet-title" id="hub-sheet-title">
            {post.data ? post.data.title || "Untitled" : "Edit"}
          </div>
          <button type="button" className="hub-icon-btn" aria-label="Close" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="hub-sheet-tabs" role="tablist">
          {(["details", "elements", "captions"] as SheetTab[]).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className="hub-sheet-tab" onClick={() => setTab(t)}>
              {t === "details" ? "Details" : t === "elements" ? "Elements" : "Captions"}
            </button>
          ))}
        </div>
        {post.isPending ? (
          <div className="hub-sheet-body">
            <HubSkeleton rows={6} height={30} />
          </div>
        ) : post.isError || !post.data ? (
          <div className="hub-sheet-body">
            <HubError message="Could not load this video." />
          </div>
        ) : tab === "details" ? (
          <DetailsTab post={post.data} scheduleFirst={scheduleFirst} candidates={candidates} onClose={onClose} />
        ) : tab === "elements" ? (
          <ElementsTab post={post.data} candidates={candidates.filter((c) => c.id !== post.data?.id)} />
        ) : (
          <CaptionsTab post={post.data} />
        )}
      </aside>
    </>,
    document.body,
  );
}

/* ── Details ────────────────────────────────────────────── */

const toForm = toDetailsForm;

function DetailsTab({ post, scheduleFirst, candidates, onClose }: { post: HubPostDetail; scheduleFirst: boolean; candidates: HubLibraryRow[]; onClose: () => void }) {
  const toast = useGlobalToast();
  const categories = useHubCategories();
  const update = useUpdatePost();
  const reschedule = useReschedule();
  const pickFrame = usePickCoverFrame();
  const uploadCover = useUploadCover();
  const [base, setBase] = useState<DetailsForm>(() => {
    const f = toForm(post);
    return scheduleFirst ? { ...f, visibility: "scheduled" } : f;
  });
  const [form, setForm] = useState<DetailsForm>(base);
  const [frameClock, setFrameClock] = useState("0:05");
  const scheduleRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const f = toForm(post);
    const next = scheduleFirst ? { ...f, visibility: "scheduled" as const } : f;
    setBase(next);
    setForm(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  useEffect(() => {
    if (scheduleFirst) scheduleRef.current?.scrollIntoView({ block: "center" });
  }, [scheduleFirst]);

  const short = isShortType(post.content_type);
  const topicOptions = useMemo(() => (categories.data ?? []).filter((c) => c.kind === "all" || c.kind === (short ? "short" : "long")), [categories.data, short]);

  const notifyEditable = notYetPublished(post) || form.visibility === "scheduled";
  const patch = useMemo(() => detailsPatch(base, form, { notifyEditable }), [base, form, notifyEditable]);
  const scheduleIso = form.visibility === "scheduled" ? fromLocalInput(form.scheduled_local) : null;
  const scheduleChanged = form.visibility === "scheduled" ? scheduleIso !== null && (base.visibility !== "scheduled" || toLocalInput(post.scheduled_at) !== form.scheduled_local) : base.visibility === "scheduled";
  const scheduleInvalid = form.visibility === "scheduled" && (!scheduleIso || Date.parse(scheduleIso) <= Date.now());
  const problems = detailsProblems(form, post.id);
  const dirty = Object.keys(patch).length > 0 || scheduleChanged;
  const busy = update.isPending || reschedule.isPending;
  const [saveError, setSaveError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const set = <K extends keyof DetailsForm>(k: K, v: DetailsForm[K]) => {
    setSaveError(null);
    setForm((f) => ({ ...f, [k]: v }));
  };

  const relatedOptions = useMemo(() => candidates.filter((c) => c.id !== post.id && !isShortType(c.content_type)), [candidates, post.id]);

  const save = async () => {
    if (!dirty || busy || scheduleInvalid || problems.length > 0) return;
    setSaveError(null);
    try {
      const body: HubPostPatch = { ...patch };
      if (base.visibility === "scheduled" && form.visibility !== "scheduled") {
        // Leaving "scheduled": publish now, then apply the chosen state.
        await reschedule.mutateAsync({ postId: post.id });
        body.visibility = form.visibility;
      }
      if (Object.keys(body).length > 0) await update.mutateAsync({ postId: post.id, patch: body });
      if (form.visibility === "scheduled" && scheduleIso && scheduleChanged) {
        await reschedule.mutateAsync({ postId: post.id, publishAt: scheduleIso });
      }
      setBase(form);
      toast({ type: "success", title: "Saved" });
    } catch (err) {
      const message = readableHubError(hubErrorCode(err), "Check the fields and try again.");
      setSaveError(message);
      toast({ type: "error", title: "Could not save", description: message });
    }
  };

  const useFrame = async () => {
    const ms = parseClock(frameClock);
    if (ms === null || !post.media_id) return;
    try {
      await pickFrame.mutateAsync({ postId: post.id, mediaId: post.media_id, timestampMs: Math.min(ms, Math.max(0, post.duration_seconds * 1000 - 1)) });
      toast({ type: "success", title: "Cover updated" });
    } catch {
      toast({ type: "error", title: "Could not pick that frame" });
    }
  };

  const onCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ type: "error", title: "Pick an image file" });
      return;
    }
    try {
      await uploadCover.mutateAsync({ postId: post.id, file });
      toast({ type: "success", title: "Cover updated" });
    } catch {
      toast({ type: "error", title: "Could not upload that image" });
    }
  };

  return (
    <>
      <div className="hub-sheet-body">
        <div className="hub-field">
          <label className="hub-label" htmlFor="hub-title">
            Title
          </label>
          <input id="hub-title" className="hub-input" value={form.title} maxLength={200} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div className="hub-field">
          <label className="hub-label" htmlFor="hub-text">
            Description
          </label>
          <textarea id="hub-text" className="hub-textarea" value={form.text} maxLength={5000} onChange={(e) => set("text", e.target.value)} placeholder="Timestamps like 00:00 Intro become chapters when none are saved." />
        </div>

        <div className="hub-field">
          <span className="hub-label">Thumbnail</span>
          <div className="hub-cover">
            <span className="hub-thumb">{post.thumbnail_url ? <img src={post.thumbnail_url} alt="" /> : null}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {post.media_id ? (
                <div className="hub-row">
                  <input className="hub-input hub-input-sm" style={{ width: 80 }} value={frameClock} onChange={(e) => setFrameClock(e.target.value)} aria-label="Frame time (m:ss)" placeholder="m:ss" />
                  <button type="button" className="hub-btn hub-btn-sm" onClick={useFrame} disabled={pickFrame.isPending || parseClock(frameClock) === null}>
                    {pickFrame.isPending ? "Picking…" : "Use frame"}
                  </button>
                </div>
              ) : null}
              <div className="hub-row">
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={onCoverFile} />
                <button type="button" className="hub-btn hub-btn-sm" onClick={() => fileRef.current?.click()} disabled={uploadCover.isPending}>
                  <Upload /> {uploadCover.isPending ? "Uploading…" : "Upload image"}
                </button>
              </div>
              <span className="hub-hint">16:9 works best. A frame from the video or your own image.</span>
            </div>
          </div>
        </div>

        <div className="hub-grid hub-grid-2">
          <div className="hub-field">
            <label className="hub-label" htmlFor="hub-topic">
              Topic
            </label>
            <select id="hub-topic" className="hub-select" value={form.category} onChange={(e) => set("category", e.target.value)}>
              <option value="">Not set</option>
              {topicOptions.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
              {form.category && !topicOptions.some((c) => c.slug === form.category) ? <option value={form.category}>{form.category}</option> : null}
            </select>
          </div>
          <div className="hub-field">
            <label className="hub-label" htmlFor="hub-lang">
              Language
            </label>
            <select id="hub-lang" className="hub-select" value={form.language} onChange={(e) => set("language", e.target.value)}>
              {PUBLISH_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
              {form.language && !PUBLISH_LANGUAGES.some((l) => l.code === form.language) ? <option value={form.language}>{form.language}</option> : null}
            </select>
          </div>
        </div>

        <div className="hub-grid hub-grid-2">
          <div className="hub-field">
            <label className="hub-label" htmlFor="hub-tags">
              Tags
            </label>
            <input id="hub-tags" className="hub-input" value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="comma separated" />
          </div>
          <div className="hub-field">
            <label className="hub-label" htmlFor="hub-hashtags">
              Hashtags
            </label>
            <input id="hub-hashtags" className="hub-input" value={form.hashtags} onChange={(e) => set("hashtags", e.target.value)} placeholder="without the #" />
          </div>
        </div>

        <div className="hub-card hub-card-pad" style={{ paddingTop: 2, paddingBottom: 2 }}>
          <SwitchRow label="Conversations" hint="Viewers can comment." checked={!form.no_comments} onChange={(v) => set("no_comments", !v)} />
          <SwitchRow label="Keep (download)" hint="Viewers can save the original file." checked={form.allow_download} onChange={(v) => set("allow_download", v)} />
          <SwitchRow label="Made for kids" hint="Turns off personalised features for this video." checked={form.made_for_kids} onChange={(v) => set("made_for_kids", v)} />
        </div>

        <div className="hub-field" ref={scheduleRef}>
          <span className="hub-label">Visibility</span>
          <div className="hub-pills">
            {HUB_VISIBILITIES.map((v) => (
              <button key={v} type="button" className="hub-pill" aria-pressed={form.visibility === v} onClick={() => set("visibility", v)}>
                <VisibilityIcon visibility={v} /> {VISIBILITY_LABEL[v]}
              </button>
            ))}
          </div>
          {form.visibility === "scheduled" ? (
            <div className="hub-row" style={{ marginTop: 6 }}>
              <input type="datetime-local" className="hub-input" style={{ width: 220 }} value={form.scheduled_local} onChange={(e) => set("scheduled_local", e.target.value)} aria-label="Publish at" />
              {scheduleInvalid ? <span className="hub-hint">Pick a time in the future.</span> : <span className="hub-hint">Goes public at that time.</span>}
            </div>
          ) : null}
        </div>

        <MoreSettings form={form} set={set} open={moreOpen} onToggle={() => setMoreOpen((o) => !o)} notifyEditable={notifyEditable} relatedOptions={relatedOptions} related={post.related_post} />

        {problems.length > 0 || saveError ? (
          <div className="hub-error" role="alert">
            {[...problems, ...(saveError ? [saveError] : [])].map((p) => (
              <div key={p}>{p}</div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="hub-sheet-foot">
        {dirty ? <span className="hub-hint" style={{ marginRight: "auto" }}>Unsaved changes</span> : null}
        <button type="button" className="hub-btn" onClick={onClose}>
          Close
        </button>
        <button type="button" className="hub-btn hub-btn-primary" onClick={save} disabled={!dirty || busy || scheduleInvalid || problems.length > 0}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </>
  );
}

/* ── More settings (contract A) ─────────────────────────── */

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface MoreSettingsProps {
  form: DetailsForm;
  set: <K extends keyof DetailsForm>(k: K, v: DetailsForm[K]) => void;
  open: boolean;
  onToggle: () => void;
  /** Notify subscribers only means something before the video goes out. */
  notifyEditable: boolean;
  /** The creator's own long videos, for Related video. */
  relatedOptions: HubLibraryRow[];
  /** The saved related video (so a pick outside the loaded pages still has a name). */
  related: HubRelatedPost | null;
}

/**
  The fields the upload studio sets that were not editable after publish,
  plus the part-6 ones. Collapsed by default under one "More settings"
  heading; every control writes the same DetailsForm, so Save sends only
  what moved.
*/
export function MoreSettings({ form, set, open, onToggle, notifyEditable, relatedOptions, related }: MoreSettingsProps) {
  const relatedMissing = !!form.related_post_id && !relatedOptions.some((c) => c.id === form.related_post_id);
  return (
    <section className="hub-more-settings" data-open={open ? "" : undefined}>
      <button type="button" className="hub-more-settings-head" aria-expanded={open} aria-controls="hub-more-settings" onClick={onToggle}>
        <span>More settings</span>
        <ChevronDown aria-hidden="true" />
      </button>
      {open ? (
        <div id="hub-more-settings" className="hub-more-settings-body">
          <div className="hub-card hub-card-pad" style={{ paddingTop: 2, paddingBottom: 2 }}>
            <SwitchRow label="Age restriction (18+)" hint="Only signed-in viewers who are 18 or older can watch." checked={form.age_restricted} onChange={(v) => set("age_restricted", v)} />
            <SwitchRow label="Allow embedding" hint="Other sites can show this video in their pages." checked={form.allow_embedding} onChange={(v) => set("allow_embedding", v)} />
            <SwitchRow label="Altered or AI content" hint="Realistic scenes that were changed or made with AI." checked={form.altered_content} onChange={(v) => set("altered_content", v)} />
            <SwitchRow label="Hide like count" hint="Viewers see Like without a number. You still see it." checked={form.hide_like_count} onChange={(v) => set("hide_like_count", v)} />
            {notifyEditable ? <SwitchRow label="Notify subscribers" hint="Tell subscribers when it goes out." checked={form.notify_subscribers} onChange={(v) => set("notify_subscribers", v)} /> : null}
            <SwitchRow label="Paid promotion" hint="The video includes a sponsorship or paid product placement." checked={form.paid_promotion} onChange={(v) => set("paid_promotion", v)} />
          </div>

          <div className="hub-grid hub-grid-2">
            <div className="hub-field">
              <label className="hub-label" htmlFor="hub-license">
                License
              </label>
              <select id="hub-license" className="hub-select" value={form.license} onChange={(e) => set("license", e.target.value as DetailsForm["license"])}>
                {HUB_LICENSES.map((v) => (
                  <option key={v} value={v}>
                    {LICENSE_LABEL[v]}
                  </option>
                ))}
              </select>
            </div>
            <div className="hub-field">
              <label className="hub-label" htmlFor="hub-remix">
                Remix
              </label>
              <select id="hub-remix" className="hub-select" value={form.remix_setting} onChange={(e) => set("remix_setting", e.target.value as DetailsForm["remix_setting"])}>
                {HUB_REMIX_SETTINGS.map((v) => (
                  <option key={v} value={v}>
                    {REMIX_LABEL[v]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="hub-grid hub-grid-2">
            <div className="hub-field">
              <label className="hub-label" htmlFor="hub-rec-date">
                Recording date
              </label>
              <div className="hub-row">
                <input id="hub-rec-date" type="date" className="hub-input" max={todayIso()} value={form.recording_date} onChange={(e) => set("recording_date", e.target.value)} />
                {form.recording_date ? (
                  <button type="button" className="hub-icon-btn" aria-label="Clear the recording date" onClick={() => set("recording_date", "")}>
                    <X />
                  </button>
                ) : null}
              </div>
            </div>
            <div className="hub-field">
              <label className="hub-label" htmlFor="hub-rec-loc">
                Recording location
              </label>
              <input id="hub-rec-loc" className="hub-input" value={form.recording_location} maxLength={RECORDING_LOCATION_MAX} placeholder="City, place" onChange={(e) => set("recording_location", e.target.value)} />
            </div>
          </div>

          <div className="hub-grid hub-grid-2">
            <div className="hub-field">
              <label className="hub-label" htmlFor="hub-comment-access">
                Who can comment
              </label>
              <select id="hub-comment-access" className="hub-select" value={form.comment_access} onChange={(e) => set("comment_access", e.target.value as DetailsForm["comment_access"])}>
                {HUB_COMMENT_ACCESSES.map((v) => (
                  <option key={v} value={v}>
                    {COMMENT_ACCESS_LABEL[v]}
                  </option>
                ))}
              </select>
            </div>
            <div className="hub-field">
              <label className="hub-label" htmlFor="hub-comment-mod">
                Comment moderation
              </label>
              <select id="hub-comment-mod" className="hub-select" value={form.comment_moderation} onChange={(e) => set("comment_moderation", e.target.value as DetailsForm["comment_moderation"])}>
                {HUB_COMMENT_MODERATIONS.map((v) => (
                  <option key={v} value={v}>
                    {COMMENT_MODERATION_LABEL[v]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="hub-field">
            <span className="hub-label" id="hub-comment-sort-label">
              Comments open on
            </span>
            <div className="hub-pill-group" role="radiogroup" aria-labelledby="hub-comment-sort-label">
              {HUB_COMMENT_SORTS.map((v) => (
                <button key={v} type="button" role="radio" className="hub-pill" aria-checked={form.default_comment_sort === v} aria-pressed={form.default_comment_sort === v} onClick={() => set("default_comment_sort", v)}>
                  {COMMENT_SORT_LABEL[v]}
                </button>
              ))}
            </div>
          </div>

          <div className="hub-field">
            <label className="hub-label" htmlFor="hub-related">
              Related video
            </label>
            <div className="hub-row">
              <select id="hub-related" className="hub-select" value={form.related_post_id} onChange={(e) => set("related_post_id", e.target.value)}>
                <option value="">None</option>
                {relatedOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
                {relatedMissing ? <option value={form.related_post_id}>{related && related.id === form.related_post_id ? related.title : "A video not loaded here"}</option> : null}
              </select>
              {form.related_post_id ? (
                <button type="button" className="hub-icon-btn" aria-label="Clear the related video" onClick={() => set("related_post_id", "")}>
                  <X />
                </button>
              ) : null}
            </div>
            <span className="hub-hint">One of your videos, shown as a card under this one.</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/* ── Elements: chapters, end screen, cards ──────────────── */

function ElementsTab({ post, candidates }: { post: HubPostDetail; candidates: HubLibraryRow[] }) {
  const toast = useGlobalToast();
  const chapters = useHubChapters(post.id);
  const endScreens = useHubEndScreens(post.id);
  const cards = useHubCards(post.id);
  const saveChapters = useSaveChapters();
  const saveScreens = useSaveEndScreens();
  const saveCards = useSaveCards();
  const durationMs = Math.max(0, Math.round(post.duration_seconds * 1000));

  const [chapterRows, setChapterRows] = useState<ChapterDraft[] | null>(null);
  const [screenRows, setScreenRows] = useState<HubEndScreen[] | null>(null);
  const [cardRows, setCardRows] = useState<HubCard[] | null>(null);

  useEffect(() => {
    if (chapters.data && chapterRows === null) setChapterRows(chapterRowsFrom(chapters.data));
  }, [chapters.data, chapterRows]);
  useEffect(() => {
    if (endScreens.data && screenRows === null) setScreenRows(endScreens.data);
  }, [endScreens.data, screenRows]);
  useEffect(() => {
    if (cards.data && cardRows === null) setCardRows(cards.data);
  }, [cards.data, cardRows]);

  const chaptersValid = chapterRowsComplete(chapterRows ?? []);
  const commitChapters = async () => {
    if (!chapterRows || !chaptersValid) return;
    try {
      await saveChapters.mutateAsync({ postId: post.id, chapters: chapterRowsToWire(chapterRows) });
      toast({ type: "success", title: "Chapters saved" });
    } catch {
      toast({ type: "error", title: "Could not save chapters" });
    }
  };

  const commitScreens = async () => {
    if (!screenRows) return;
    try {
      await saveScreens.mutateAsync({ postId: post.id, screens: screenRows });
      toast({ type: "success", title: "End screen saved" });
    } catch {
      toast({ type: "error", title: "Could not save the end screen", description: "Each pick needs a target and a window inside the video." });
    }
  };

  const commitCards = async () => {
    if (!cardRows) return;
    try {
      await saveCards.mutateAsync({ postId: post.id, cards: cardRows });
      toast({ type: "success", title: "Cards saved" });
    } catch {
      toast({ type: "error", title: "Could not save cards", description: "Every card needs a title." });
    }
  };

  const addScreen = () => {
    if (!screenRows || screenRows.length >= HUB_END_SCREEN_MAX) return;
    const start = Math.max(0, durationMs - 10_000);
    setScreenRows([...screenRows, { type: "video", target_id: candidates[0]?.id ?? null, target_url: null, title: null, position: { slot: screenRows.length }, start_ms: start, end_ms: Math.max(start + 1000, durationMs) }]);
  };

  const addCard = () => {
    if (!cardRows) return;
    setCardRows([...cardRows, { type: "video", target_id: candidates[0]?.id ?? null, target_url: null, title: candidates[0]?.title ?? "", teaser_text: null, appear_at_ms: Math.min(durationMs, 30_000) }]);
  };

  if (chapters.isPending || endScreens.isPending || cards.isPending) {
    return (
      <div className="hub-sheet-body">
        <HubSkeleton rows={5} height={30} />
      </div>
    );
  }

  return (
    <div className="hub-sheet-body">
      {/* Series (long videos): move, renumber or remove; the upload studio sends the same requests */}
      {post.content_type === "long_video" ? <SeriesSection postId={post.id} /> : null}

      {/* Chapters (the shared editor; the upload studio uses it too) */}
      <ChaptersEditor
        rows={chapterRows ?? []}
        onChange={setChapterRows}
        emptyHint="None saved. Timestamps in the description (00:00 Intro) are used until you add some."
        footer={
          <div className="hub-row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="hub-btn hub-btn-sm hub-btn-primary" onClick={commitChapters} disabled={!chaptersValid || saveChapters.isPending || chapterRows === null}>
              {saveChapters.isPending ? "Saving…" : "Save chapters"}
            </button>
          </div>
        }
      />

      {/* End screen */}
      <div className="hub-elem">
        <div className="hub-elem-head">
          <span>End screen</span>
          <button type="button" className="hub-btn hub-btn-sm" onClick={addScreen} disabled={(screenRows?.length ?? 0) >= HUB_END_SCREEN_MAX}>
            <Plus /> Add ({screenRows?.length ?? 0}/{HUB_END_SCREEN_MAX})
          </button>
        </div>
        {(screenRows ?? []).length === 0 ? <span className="hub-hint">Up to four picks shown over the last seconds: a video, a collection, a follow button or a link.</span> : null}
        {(screenRows ?? []).map((s, i) => (
          <div key={s.id ?? `new-${i}`} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div className="hub-elem-row hub-elem-row-3">
              <select className="hub-select hub-input-sm" value={s.type} aria-label={`End screen ${i + 1} type`} onChange={(e) => setScreenRows((rows) => rows!.map((x, j) => (j === i ? { ...x, type: e.target.value as HubEndScreen["type"], target_id: null, target_url: null } : x)))}>
                {HUB_END_SCREEN_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t === "channel_subscribe" ? "Subscribe" : t === "external_link" ? "Link" : t === "playlist" ? "Collection" : "Video"}
                  </option>
                ))}
              </select>
              <input className="hub-input hub-input-sm" value={formatMs(s.start_ms)} aria-label="Shows from" onChange={(e) => { const ms = parseClock(e.target.value); if (ms !== null) setScreenRows((rows) => rows!.map((x, j) => (j === i ? { ...x, start_ms: ms } : x))); }} placeholder="from m:ss" />
              <TargetField kind={s.type} targetId={s.target_id} targetUrl={s.target_url} candidates={candidates} onChange={(target_id, target_url) => setScreenRows((rows) => rows!.map((x, j) => (j === i ? { ...x, target_id, target_url } : x)))} />
              <button type="button" className="hub-icon-btn" aria-label="Remove end screen pick" onClick={() => setScreenRows((rows) => rows!.filter((_, j) => j !== i))}>
                <X />
              </button>
            </div>
          </div>
        ))}
        {(screenRows ?? []).length > 0 ? (
          <div className="hub-row" style={{ justifyContent: "space-between" }}>
            <span className="hub-hint">Shown until the video ends ({formatMs(durationMs)}).</span>
            <button type="button" className="hub-btn hub-btn-sm hub-btn-primary" onClick={commitScreens} disabled={saveScreens.isPending}>
              {saveScreens.isPending ? "Saving…" : "Save end screen"}
            </button>
          </div>
        ) : null}
      </div>

      {/* Cards */}
      <div className="hub-elem">
        <div className="hub-elem-head">
          <span>Cards</span>
          <button type="button" className="hub-btn hub-btn-sm" onClick={addCard}>
            <Plus /> Add
          </button>
        </div>
        {(cardRows ?? []).length === 0 ? <span className="hub-hint">A small card that appears at a moment in the video, pointing at another video, a collection, a poll or a link.</span> : null}
        {(cardRows ?? []).map((c, i) => (
          <div key={c.id ?? `new-${i}`} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div className="hub-elem-row hub-elem-row-3">
              <input className="hub-input hub-input-sm" value={formatMs(c.appear_at_ms)} aria-label={`Card ${i + 1} time`} placeholder="m:ss" onChange={(e) => { const ms = parseClock(e.target.value); if (ms !== null) setCardRows((rows) => rows!.map((x, j) => (j === i ? { ...x, appear_at_ms: ms } : x))); }} />
              <select className="hub-select hub-input-sm" value={c.type} aria-label={`Card ${i + 1} type`} onChange={(e) => setCardRows((rows) => rows!.map((x, j) => (j === i ? { ...x, type: e.target.value as HubCard["type"], target_id: null, target_url: null } : x)))}>
                {HUB_CARD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t === "external_link" ? "Link" : t === "playlist" ? "Collection" : t === "poll" ? "Poll" : "Video"}
                  </option>
                ))}
              </select>
              <TargetField kind={c.type} targetId={c.target_id} targetUrl={c.target_url} candidates={candidates} onChange={(target_id, target_url) => setCardRows((rows) => rows!.map((x, j) => (j === i ? { ...x, target_id, target_url, title: x.title || candidates.find((v) => v.id === target_id)?.title || x.title } : x)))} />
              <button type="button" className="hub-icon-btn" aria-label="Remove card" onClick={() => setCardRows((rows) => rows!.filter((_, j) => j !== i))}>
                <X />
              </button>
            </div>
            <input className="hub-input hub-input-sm" value={c.title} placeholder="Card title (required)" aria-label={`Card ${i + 1} title`} aria-invalid={c.title.trim() === ""} onChange={(e) => setCardRows((rows) => rows!.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
          </div>
        ))}
        {(cardRows ?? []).length > 0 ? (
          <div className="hub-row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="hub-btn hub-btn-sm hub-btn-primary" onClick={commitCards} disabled={saveCards.isPending || (cardRows ?? []).some((c) => c.title.trim() === "")}>
              {saveCards.isPending ? "Saving…" : "Save cards"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TargetField({ kind, targetId, targetUrl, candidates, onChange }: { kind: string; targetId: string | null; targetUrl: string | null; candidates: HubLibraryRow[]; onChange: (targetId: string | null, targetUrl: string | null) => void }) {
  if (kind === "external_link") {
    return <input className="hub-input hub-input-sm" value={targetUrl ?? ""} placeholder="https://…" aria-label="Link" onChange={(e) => onChange(null, e.target.value || null)} />;
  }
  if (kind === "channel_subscribe" || kind === "poll") {
    return <span className="hub-hint">{kind === "poll" ? "Poll id" : "Your channel"}{kind === "poll" ? null : " — no target needed"}{kind === "poll" ? <input className="hub-input hub-input-sm" value={targetId ?? ""} aria-label="Poll id" onChange={(e) => onChange(e.target.value || null, null)} /> : null}</span>;
  }
  if (kind === "playlist") {
    return <input className="hub-input hub-input-sm" value={targetId ?? ""} placeholder="Collection id" aria-label="Collection id" onChange={(e) => onChange(e.target.value || null, null)} />;
  }
  return (
    <select className="hub-select hub-input-sm" value={targetId ?? ""} aria-label="Target video" onChange={(e) => onChange(e.target.value || null, null)}>
      <option value="">Pick a video</option>
      {candidates.map((c) => (
        <option key={c.id} value={c.id}>
          {c.title}
        </option>
      ))}
      {targetId && !candidates.some((c) => c.id === targetId) ? <option value={targetId}>{targetId}</option> : null}
    </select>
  );
}

/* ── Captions for this media ────────────────────────────── */

function CaptionsTab({ post }: { post: HubPostDetail }) {
  const toast = useGlobalToast();
  const tracks = useCaptionTracks(post.media_id);
  const setPublished = useSetCaptionPublished();
  const upload = useUploadCaption();
  const auto = useRequestAutoCaption();
  const [language, setLanguage] = useState(post.language || "en");
  const fileRef = useRef<HTMLInputElement | null>(null);

  if (!post.media_id) {
    return (
      <div className="hub-sheet-body">
        <div className="hub-note">This post has no video asset to caption.</div>
      </div>
    );
  }
  const mediaId = post.media_id;

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await upload.mutateAsync({ mediaId, language: language || "en", file });
      toast({ type: "success", title: "Captions uploaded" });
    } catch {
      toast({ type: "error", title: "Could not upload that file", description: "Use .srt or .vtt." });
    }
  };

  return (
    <div className="hub-sheet-body">
      <div className="hub-elem">
        <div className="hub-elem-head">
          <span>Languages</span>
        </div>
        {tracks.isPending ? (
          <HubSkeleton rows={2} height={24} />
        ) : (tracks.data ?? []).length === 0 ? (
          <span className="hub-hint">No captions yet for this video.</span>
        ) : (
          <div className="hub-pills">
            {(tracks.data ?? []).map((t) => (
              <span key={t.language} className="hub-lang">
                <code>{t.language}</code>
                <span className="hub-hint">{t.source === "auto" ? "auto" : "uploaded"}</span>
                <Toggle
                  label={`${t.language} published`}
                  checked={t.published}
                  disabled={setPublished.isPending}
                  onChange={(v) =>
                    setPublished.mutate(
                      { mediaId, language: t.language, published: v },
                      { onError: () => toast({ type: "error", title: "Could not change that" }) },
                    )
                  }
                />
              </span>
            ))}
          </div>
        )}
        <span className="hub-hint">On = viewers can pick it in the player. Auto captions start as drafts.</span>
      </div>

      <div className="hub-elem">
        <div className="hub-elem-head">
          <span>Add captions</span>
        </div>
        <div className="hub-row hub-row-wrap">
          <select className="hub-select hub-input-sm" style={{ width: 140 }} value={language} aria-label="Caption language" onChange={(e) => setLanguage(e.target.value)}>
            {PUBLISH_LANGUAGES.filter((l) => l.code).map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <input ref={fileRef} type="file" accept=".srt,.vtt,text/vtt" hidden onChange={onFile} />
          <button type="button" className="hub-btn hub-btn-sm" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
            <Upload /> {upload.isPending ? "Uploading…" : "Upload .srt / .vtt"}
          </button>
          <button
            type="button"
            className="hub-btn hub-btn-sm"
            disabled={auto.isPending}
            onClick={() =>
              auto.mutate(
                { mediaId, language },
                {
                  onSuccess: () => toast({ type: "success", title: "Generating captions", description: "They appear as a draft when ready." }),
                  onError: () => toast({ type: "error", title: "Could not start captions" }),
                },
              )
            }
          >
            <Sparkles /> {auto.isPending ? "Starting…" : "Generate"}
          </button>
        </div>
      </div>
    </div>
  );
}
