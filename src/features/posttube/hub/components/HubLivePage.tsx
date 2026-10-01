"use client";

import Link from "next/link";
import { CalendarPlus, ImagePlus, Radio } from "lucide-react";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useGlobalToast } from "@/contexts/ToastContext";
import { liveV2Keys, useCreateStream, useUpdateStream, useUserStreams } from "@/hooks/useLiveV2";
import { uploadMedia } from "@/lib/mediaUpload";
import { useAuthUser } from "@/store/auth";
import {
  EMPTY_STREAM_FORM,
  STREAM_DESCRIPTION_MAX,
  STREAM_TITLE_MAX,
  categoryLabel,
  createInputFromForm,
  formFromRow,
  formatLocalDateTime,
  hostScreenHref,
  isLive,
  liveWatchHref,
  recordingHref,
  reminderCountLabel,
  rowStatusView,
  scheduleErrorCopy,
  streamPatchBody,
  validateStreamForm,
  type FormVisibility,
  type StreamFormCheck,
  type StreamFormValues,
  type StreamRow,
} from "@/features/live/discovery";
import type { LiveSource } from "@/features/live/encoder";
import { PILOT_REFUSAL_COPY, PILOT_REFUSAL_DETAIL, isPilotRefusal } from "@/features/live/errors";
import type { LiveOrientation } from "@/features/live/model";
import { mediaServeUrl } from "../../model";
import { useHubCategories } from "../hooks/useHub";
import type { HubCategory } from "../hubApi";
import { HubHead } from "./HubFrame";
import { HubEmpty, HubError, HubSkeleton } from "./HubEmpty";

/*
  Creator Hub → Live. Schedule a stream, edit one that has not started
  (PATCH), open the host screen, and reach the recording once a stream is
  over. Every list is the creator's own:
    GET /v1/livestream/users/:me/streams?status=live|upcoming|past
  Labels in a choice group are alphabetical.
*/

const VISIBILITIES: readonly { value: FormVisibility; label: string }[] = [
  { value: "followers", label: "Followers only" },
  { value: "public", label: "Public" },
];

const ORIENTATIONS: readonly { value: LiveOrientation; label: string }[] = [
  { value: "portrait", label: "Vertical for Reels" },
  { value: "landscape", label: "Wide for PostTube" },
];

const SOURCES: readonly { value: LiveSource; label: string }[] = [
  { value: "encoder", label: "Streaming software" },
  { value: "device", label: "This device" },
];

/** Topics that fit the stream's shape: long and all for a wide stream, short and all for a vertical one. */
export function topicsFor(categories: readonly HubCategory[], orientation: LiveOrientation): HubCategory[] {
  const drop = orientation === "portrait" ? "long" : "short";
  return categories.filter((c) => c.kind !== drop).slice().sort((a, b) => a.label.localeCompare(b.label));
}

/** The hub's link to make a recording public: the Library's edit sheet for that video. */
export function publishRecordingHref(row: Pick<StreamRow, "recording_post_id">): string {
  return row.recording_post_id ? `/posttube/hub/library?edit=${encodeURIComponent(row.recording_post_id)}` : "";
}

export interface StreamFormViewProps {
  values: StreamFormValues;
  onChange: (patch: Partial<StreamFormValues>) => void;
  check: StreamFormCheck | null;
  categories: readonly HubCategory[];
  /** Editing a scheduled stream: the source was fixed at create. */
  editing: boolean;
  busy: boolean;
  error: string | null;
  coverPreview: string | null;
  onPickCover: (file: File | null) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

/** The schedule form, fields only (state and requests live in StreamForm). */
export function StreamFormView({ values, onChange, check, categories, editing, busy, error, coverPreview, onPickCover, onSubmit, onCancel }: StreamFormViewProps) {
  const topics = topicsFor(categories, values.orientation);
  return (
    <form
      className="hub-card hub-card-pad"
      aria-label={editing ? "Edit stream" : "Schedule a stream"}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="hub-section-head">
        <span className="hub-section-title">{editing ? "Edit stream" : "Schedule a stream"}</span>
      </div>
      <div className="hub-grid hub-grid-2">
        <div className="hub-field">
          <label className="hub-label" htmlFor="hub-live-title">
            Title
          </label>
          <input id="hub-live-title" className="hub-input" value={values.title} maxLength={STREAM_TITLE_MAX} onChange={(e) => onChange({ title: e.target.value })} aria-invalid={!!check?.errors.title} required />
          {check?.errors.title ? <span className="hub-hint is-error">{check.errors.title}</span> : null}
        </div>
        <div className="hub-field">
          <label className="hub-label" htmlFor="hub-live-when">
            Date and time
          </label>
          <input id="hub-live-when" className="hub-input" type="datetime-local" value={values.scheduledLocal} onChange={(e) => onChange({ scheduledLocal: e.target.value })} aria-invalid={!!check?.errors.scheduled_at} required />
          <span className={`hub-hint${check?.errors.scheduled_at ? " is-error" : ""}`}>{check?.errors.scheduled_at ?? "In your time zone. Viewers see it in theirs."}</span>
        </div>
        <div className="hub-field" style={{ gridColumn: "1 / -1" }}>
          <label className="hub-label" htmlFor="hub-live-description">
            Description
          </label>
          <textarea id="hub-live-description" className="hub-textarea" value={values.description} maxLength={STREAM_DESCRIPTION_MAX} onChange={(e) => onChange({ description: e.target.value })} />
        </div>
        <div className="hub-field">
          <label className="hub-label" htmlFor="hub-live-orientation">
            Orientation
          </label>
          <select id="hub-live-orientation" className="hub-select" value={values.orientation} onChange={(e) => onChange({ orientation: e.target.value as LiveOrientation })}>
            {ORIENTATIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="hub-field">
          <label className="hub-label" htmlFor="hub-live-topic">
            Topic
          </label>
          <select id="hub-live-topic" className="hub-select" value={values.category} onChange={(e) => onChange({ category: e.target.value })}>
            <option value="">No topic</option>
            {topics.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
            {values.category && !topics.some((c) => c.slug === values.category) ? <option value={values.category}>{categoryLabel(values.category, categories)}</option> : null}
          </select>
        </div>
        <div className="hub-field">
          <label className="hub-label" htmlFor="hub-live-visibility">
            Visibility
          </label>
          <select id="hub-live-visibility" className="hub-select" value={values.visibility} onChange={(e) => onChange({ visibility: e.target.value as FormVisibility })}>
            {VISIBILITIES.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div className="hub-field">
          <label className="hub-label" htmlFor="hub-live-source">
            Source
          </label>
          <select id="hub-live-source" className="hub-select" value={values.source} disabled={editing} onChange={(e) => onChange({ source: e.target.value as LiveSource })}>
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {editing ? <span className="hub-hint">The source is chosen when the stream is created.</span> : null}
        </div>
        <div className="hub-field" style={{ gridColumn: "1 / -1" }}>
          <span className="hub-label">Cover</span>
          <div className="hub-row hub-row-wrap">
            <span className="hub-thumb">{coverPreview ? <img src={coverPreview} alt="" /> : null}</span>
            <label className="hub-btn">
              <ImagePlus aria-hidden="true" />
              {coverPreview ? "Replace cover" : "Upload a cover"}
              <input type="file" accept="image/*" hidden onChange={(e) => onPickCover(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        </div>
      </div>
      {error ? (
        <div className="hub-error" role="alert" style={{ marginTop: 10 }}>
          {error}
        </div>
      ) : null}
      <div className="hub-row hub-row-wrap" style={{ justifyContent: "flex-end", marginTop: 12 }}>
        <button type="button" className="hub-btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="hub-btn hub-btn-primary" disabled={busy}>
          {busy ? "Saving…" : editing ? "Save changes" : "Schedule"}
        </button>
      </div>
    </form>
  );
}

/** Create (POST) or edit (PATCH, only what changed) a scheduled stream. */
function StreamForm({ row, onDone }: { row: StreamRow | null; onDone: () => void }) {
  const toast = useGlobalToast();
  const qc = useQueryClient();
  const categories = useHubCategories();
  const createStream = useCreateStream();
  const updateStream = useUpdateStream();
  const [values, setValues] = useState<StreamFormValues>(() => (row ? formFromRow(row) : EMPTY_STREAM_FORM));
  const [check, setCheck] = useState<StreamFormCheck | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(() => (row?.cover_media_id ? mediaServeUrl(row.cover_media_id) : null));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickCover = (file: File | null) => {
    if (!file) return;
    if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const submit = async () => {
    const result = validateStreamForm(values, { requireTime: true });
    setCheck(result);
    if (!result.ok) return;
    setError(null);
    try {
      let next = values;
      if (coverFile) {
        setUploading(true);
        next = { ...values, cover_media_id: await uploadMedia(coverFile, "image", "cover") };
        setUploading(false);
      }
      if (row) {
        const body = streamPatchBody(row, next, result.scheduled_at);
        if (Object.keys(body).length > 0) await updateStream.mutateAsync({ streamId: row.id, body });
        toast({ type: "success", title: "Stream updated" });
      } else {
        await createStream.mutateAsync(createInputFromForm(next, result.scheduled_at));
        toast({ type: "success", title: "Stream scheduled" });
      }
      void qc.invalidateQueries({ queryKey: liveV2Keys.all });
      onDone();
    } catch (err) {
      setUploading(false);
      setError(isPilotRefusal(err) ? `${PILOT_REFUSAL_COPY} ${PILOT_REFUSAL_DETAIL}` : scheduleErrorCopy(err));
    }
  };

  return (
    <StreamFormView
      values={values}
      onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
      check={check}
      categories={categories.data ?? []}
      editing={!!row}
      busy={uploading || createStream.isPending || updateStream.isPending}
      error={error}
      coverPreview={coverPreview}
      onPickCover={pickCover}
      onSubmit={() => void submit()}
      onCancel={onDone}
    />
  );
}

export interface HubLiveTableProps {
  rows: StreamRow[];
  categories?: readonly HubCategory[];
  onEdit?: (row: StreamRow) => void;
}

/** One row per stream; the actions depend on where the stream is in its life and are alphabetical. */
export function HubLiveTable({ rows, categories = [], onEdit }: HubLiveTableProps) {
  return (
    <div className="hub-table-wrap">
      <table className="hub-table" style={{ minWidth: 640 }}>
        <thead>
          <tr>
            <th>Stream</th>
            <th>When</th>
            <th>Status</th>
            <th>Audience</th>
            <th style={{ width: 220 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const view = rowStatusView(row, "host");
            const scheduled = row.status === "scheduled";
            const over = row.status === "ended" || row.status === "failed";
            const when = formatLocalDateTime(scheduled ? row.scheduled_at : row.started_at || row.scheduled_at || row.created_at);
            const publish = publishRecordingHref(row);
            const topic = categoryLabel(row.category, categories);
            return (
              <tr key={row.id} data-stream={row.id} data-status={row.status}>
                <td>
                  <div className="hub-row-title">
                    <span className="hub-thumb">{row.cover_media_id ? <img src={mediaServeUrl(row.cover_media_id)} alt="" loading="lazy" /> : null}</span>
                    <span style={{ minWidth: 0 }}>
                      <Link href={liveWatchHref(row)}>{row.title || "Untitled stream"}</Link>
                      <div className="hub-row-meta">{[topic, row.orientation === "portrait" ? "Vertical" : "Wide", row.visibility === "followers" ? "Followers only" : "Public"].filter(Boolean).join(" · ")}</div>
                    </span>
                  </div>
                </td>
                <td style={{ whiteSpace: "nowrap" }}>{when || "—"}</td>
                <td>
                  <span className={`hub-tag ${isLive(row) ? "hub-tag-danger" : view.tone === "danger" ? "hub-tag-warning" : "hub-tag-muted"}`}>{view.label}</span>
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {scheduled ? reminderCountLabel(row.reminder_count) || "No reminders yet" : isLive(row) ? `${row.viewer_count.toLocaleString()} watching` : `Peak ${row.viewer_peak.toLocaleString()}`}
                </td>
                <td>
                  <div className="hub-row hub-row-wrap">
                    {scheduled && onEdit ? (
                      <button type="button" className="hub-btn hub-btn-sm" onClick={() => onEdit(row)}>
                        Edit
                      </button>
                    ) : null}
                    {!over ? (
                      <Link href={hostScreenHref(row.id)} className="hub-btn hub-btn-sm">
                        Open host screen
                      </Link>
                    ) : publish ? (
                      <>
                        <Link href={publish} className="hub-btn hub-btn-sm" data-recording="publish">
                          Publish recording
                        </Link>
                        <Link href={recordingHref(row)} className="hub-btn hub-btn-sm">
                          Watch recording
                        </Link>
                      </>
                    ) : (
                      <span className="hub-hint">No recording</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** /posttube/hub/live */
export function HubLivePage() {
  const user = useAuthUser();
  const me = user?.id;
  const categories = useHubCategories();
  const liveQ = useUserStreams(me, "live", { refetchMs: 30_000 });
  const upcomingQ = useUserStreams(me, "upcoming", { limit: 24 });
  const pastQ = useUserStreams(me, "past", { limit: 24 });
  // null: closed · "new": the empty form · a row: editing it.
  const [form, setForm] = useState<StreamRow | "new" | null>(null);

  const liveData = liveQ.data;
  const upcomingData = upcomingQ.data;
  const pastData = pastQ.data;
  const current = useMemo(() => [...(liveData?.pages.flatMap((p) => p.items) ?? []), ...(upcomingData?.pages.flatMap((p) => p.items) ?? [])], [liveData, upcomingData]);
  const past = useMemo(() => pastData?.pages.flatMap((p) => p.items) ?? [], [pastData]);
  const loading = liveQ.isPending || upcomingQ.isPending;
  const failed = liveQ.isError && upcomingQ.isError;

  return (
    <>
      <HubHead
        title="Live"
        sub="Schedule a stream, open your host screen, and publish the recording when it is over."
        actions={
          <>
            <Link href="/live/new" className="hub-btn">
              <Radio aria-hidden="true" />
              Go live now
            </Link>
            <button type="button" className="hub-btn hub-btn-primary" onClick={() => setForm("new")} disabled={form === "new"}>
              <CalendarPlus aria-hidden="true" />
              Schedule a stream
            </button>
          </>
        }
      />

      {form ? <StreamForm key={form === "new" ? "new" : form.id} row={form === "new" ? null : form} onDone={() => setForm(null)} /> : null}

      <section className="hub-section">
        <div className="hub-section-head">
          <span className="hub-section-title">Live and scheduled</span>
        </div>
        {!me ? (
          <HubEmpty icon={<Radio aria-hidden="true" />} title="Sign in to manage your streams" />
        ) : loading ? (
          <HubSkeleton rows={3} height={44} />
        ) : failed ? (
          <HubError />
        ) : current.length === 0 ? (
          <div className="hub-card">
            <HubEmpty icon={<Radio aria-hidden="true" />} title="Nothing scheduled" body="Schedule a stream and viewers can set a reminder for it." />
          </div>
        ) : (
          <HubLiveTable rows={current} categories={categories.data ?? []} onEdit={setForm} />
        )}
        {upcomingQ.hasNextPage ? (
          <div className="hub-more">
            <button type="button" className="hub-btn" onClick={() => upcomingQ.fetchNextPage()} disabled={upcomingQ.isFetchingNextPage}>
              {upcomingQ.isFetchingNextPage ? "Loading…" : "Load more"}
            </button>
          </div>
        ) : null}
      </section>

      {me ? (
        <section className="hub-section">
          <div className="hub-section-head">
            <span className="hub-section-title">Past streams</span>
          </div>
          {pastQ.isPending ? (
            <HubSkeleton rows={3} height={44} />
          ) : pastQ.isError ? (
            <HubError />
          ) : past.length === 0 ? (
            <div className="hub-card">
              <HubEmpty icon={<Radio aria-hidden="true" />} title="No past streams" body="When a stream ends, its recording arrives as an unlisted video for you to publish." />
            </div>
          ) : (
            <HubLiveTable rows={past} categories={categories.data ?? []} />
          )}
          {pastQ.hasNextPage ? (
            <div className="hub-more">
              <button type="button" className="hub-btn" onClick={() => pastQ.fetchNextPage()} disabled={pastQ.isFetchingNextPage}>
                {pastQ.isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
