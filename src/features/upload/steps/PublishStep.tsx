"use client";

import { AlertCircle, Calendar, Clapperboard, Clock, Eye, Film, Lock } from "lucide-react";

import { SeriesPicker } from "../components/SeriesPicker";
import {
  ActionSetting,
  CommentSettings,
  DisclosureSettings,
  FeedSetting,
  MembersOnlySetting,
  RemixSetting,
  ScheduleSetting,
  TopicSetting,
  VisibilitySetting,
  visibilityLabel,
} from "../components/StudioSettings";
import type { Tier } from "@/features/memberships/model";

import { isShortStudio, type ContentType } from "../tokens";
import type { StudioFormState } from "../types";
import { getStepErrors } from "../validation";

interface PublishStepProps {
  form: StudioFormState;
  patch: (u: Partial<StudioFormState>) => void;
  showErrors?: boolean;
  publishError?: string | null;
  retryProcessingCheck?: () => void;
  onReplaceVideo?: () => void;
  /** Which studio this is: decides the settings shown and which taxonomy kinds the topic select offers. */
  contentType?: ContentType;
  /** Present when the chosen topic takes credits: the Credits step is offered, and this opens it. */
  onOpenCredits?: () => void;
  /** The creator's active membership levels; the Members only choice shows only when there is one. */
  memberLevels?: readonly Tier[];
}

function clock(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

function scheduleText(local: string | null): string {
  if (local === null) return "Publishes when you press Publish";
  const at = new Date(local);
  if (Number.isNaN(at.getTime())) return "Scheduled — pick a time";
  return `Scheduled for ${at.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`;
}

/** What is about to go out: the cover, the title and the three facts that matter. */
function PublishSummary({ form, short, publishError }: { form: StudioFormState; short: boolean; publishError?: string | null }) {
  const cover = form.coverSourceType === "custom_image" ? form.customCoverPreviewUrl : form.coverPreviewUrl;
  return (
    <div className="upload-summary" data-publish-summary>
      <div className="upload-summary-thumb" data-vertical={short || undefined} aria-hidden="true">
        {cover ? <img src={cover} alt="" /> : form.videoPreviewUrl ? <video src={form.videoPreviewUrl} muted playsInline preload="metadata" /> : <Film />}
      </div>
      <div className="upload-summary-body">
        <strong>{form.title.trim() || "Untitled"}</strong>
        <ul className="upload-summary-meta">
          {form.videoDurationSec != null ? <li><Clock aria-hidden="true" />{clock(form.videoDurationSec)}</li> : null}
          <li><Eye aria-hidden="true" />{visibilityLabel(form.visibility)}</li>
          {form.tierRequiredId ? <li data-members-only><Lock aria-hidden="true" />Members only</li> : null}
          <li><Calendar aria-hidden="true" />{scheduleText(form.scheduleAt)}</li>
        </ul>
        <p className="upload-summary-note">
          The file uploads when you press Publish and is watchable once processing finishes, usually a few minutes.
        </p>
        {publishError ? (
          <p className="upload-field-error" role="alert">
            <AlertCircle aria-hidden="true" />
            <span>We couldn&apos;t publish it. {publishError} Your details are still here; you can try again.</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function PublishStep({ form, patch, showErrors, publishError, contentType = "long", onOpenCredits, memberLevels = [] }: PublishStepProps) {
  const short = isShortStudio(contentType);
  const scheduleError = !!showErrors && getStepErrors("publish", form).some((error) => error.field === "scheduleAt");
  const takesSeries = !short && (form.finalVideoCategory ?? "long_video") === "long_video";

  return (
    <div className="upload-stack">
      <PublishSummary form={form} short={short} publishError={publishError} />
      <VisibilitySetting form={form} patch={patch} />
      <MembersOnlySetting form={form} patch={patch} levels={memberLevels} />
      {short ? (
        <>
          {/* Reels ask everything on this one page (founder, 2026-10-21). */}
          <CommentSettings form={form} patch={patch} />
          <RemixSetting form={form} patch={patch} />
          <DisclosureSettings form={form} patch={patch} includeAltered={false} />
          <ScheduleSetting form={form} patch={patch} invalid={scheduleError} />
          <TopicSetting form={form} patch={patch} contentType={contentType} showErrors={showErrors} />
        </>
      ) : (
        <>
          <TopicSetting form={form} patch={patch} contentType={contentType} showErrors={showErrors} />
          {/* A film-like topic adds the Credits step before this one. */}
          {onOpenCredits ? (
            <p className="upload-banner" data-credits-offer role="status">
              <Clapperboard aria-hidden="true" />
              <span>
                {form.credits.credits.length > 0
                  ? `${form.credits.credits.length === 1 ? "1 credit" : `${form.credits.credits.length} credits`} added. `
                  : "This topic can carry credits: the cast and crew, genres and release year. "}
                <button type="button" className="upload-link-button" onClick={onOpenCredits}>
                  {form.credits.credits.length > 0 ? "Edit credits" : "Add credits"}
                </button>
              </span>
            </p>
          ) : null}
          {/* Series (long videos; added after publish). */}
          {takesSeries ? <SeriesPicker form={form} patch={patch} showErrors={showErrors} /> : null}
          <ScheduleSetting form={form} patch={patch} invalid={scheduleError} />
        </>
      )}
      {/* Reels never reach the home Feed (founder, 25 Sep), so the switch is long-video only. */}
      {short ? null : <FeedSetting form={form} patch={patch} contentType={contentType} />}
      <ActionSetting form={form} patch={patch} contentType={contentType} showErrors={showErrors} />
    </div>
  );
}
