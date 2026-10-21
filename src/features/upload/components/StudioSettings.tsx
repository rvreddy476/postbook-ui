"use client";

import { AlertCircle, Calendar, Eye, EyeOff, Globe, Link2, Loader2, Lock, MessageSquare, Newspaper, Repeat2, ShieldAlert, Tag, UserCheck, Users } from "lucide-react";

import { useVideoCategories } from "@/features/posttube/hooks/usePosttubeHome";

import { categoryOptions } from "../categories";
import { tomorrowLocalInput } from "../fileRules";
import { ChoiceCard, InfoBanner, RadioOption, Section, SettingsGroup, StudioSelect, ToggleRow } from "../primitives";
import { isShortStudio, type ContentType } from "../tokens";
import type { StudioFormState } from "../types";
import { topicRequired } from "../validation";

/*
  The settings both studios share, one component each, so a reel's single
  Publish page and a long video's Comments / Audience / Publish steps say
  the same things in the same words.
*/

interface SettingProps {
  form: StudioFormState;
  patch: (u: Partial<StudioFormState>) => void;
}

/* ── Visibility ─────────────────────────────────────────── */

export const VISIBILITY_OPTIONS = [
  { value: "public", label: "Public", description: "Everyone can find and watch", icon: Globe },
  { value: "followers", label: "Followers", description: "People who follow you", icon: Users },
  { value: "friends", label: "Friends", description: "Followers you follow back", icon: UserCheck },
  { value: "unlisted", label: "Unlisted", description: "Anyone with the link; it won't appear in feeds", icon: Link2 },
  { value: "private", label: "Private", description: "Only you", icon: Lock },
] as const satisfies readonly { value: StudioFormState["visibility"]; label: string; description: string; icon: unknown }[];

export function visibilityLabel(value: StudioFormState["visibility"]): string {
  return VISIBILITY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function VisibilitySetting({ form, patch }: SettingProps) {
  return (
    <Section title="Visibility" subtitle="Who can watch" icon={Eye}>
      <div className="upload-choices" role="radiogroup" aria-label="Visibility">
        {VISIBILITY_OPTIONS.map((o) => (
          <ChoiceCard key={o.value} name="visibility" label={o.label} description={o.description} icon={o.icon} checked={form.visibility === o.value} onChange={() => patch({ visibility: o.value })} />
        ))}
      </div>
    </Section>
  );
}

/* ── Schedule ───────────────────────────────────────────── */

export function ScheduleSetting({ form, patch, invalid }: SettingProps & { invalid: boolean }) {
  const scheduled = form.scheduleAt !== null;
  return (
    <Section title="Schedule" subtitle="Publish now, or pick a time" icon={Calendar}>
      <SettingsGroup invalid={invalid}>
        <ToggleRow
          label="Schedule publish"
          description={scheduled ? "Goes live at the time below" : "Off: it goes live when you publish"}
          checked={scheduled}
          onChange={(v) => patch({ scheduleAt: v ? tomorrowLocalInput() : null })}
        />
        {scheduled ? (
          <div className="upload-row-sub">
            <label htmlFor="upload-scheduleAt" className="upload-row-title">Date and time</label>
            <input
              type="datetime-local"
              id="upload-scheduleAt"
              required
              aria-invalid={invalid}
              aria-describedby={invalid ? "upload-schedule-error" : "upload-schedule-hint"}
              value={form.scheduleAt ?? ""}
              onChange={(e) => patch({ scheduleAt: e.target.value })}
              className="upload-input upload-schedule-input"
            />
            <p id="upload-schedule-hint" className="upload-row-desc">Your device&apos;s local time zone.</p>
          </div>
        ) : null}
      </SettingsGroup>
      {invalid ? (
        <p id="upload-schedule-error" className="upload-field-error" role="alert">
          <AlertCircle aria-hidden="true" />
          Choose a valid date and time in the future, or turn scheduling off.
        </p>
      ) : null}
    </Section>
  );
}

/* ── Topic ──────────────────────────────────────────────── */

export function TopicSetting({ form, patch, contentType, showErrors }: SettingProps & { contentType: ContentType; showErrors?: boolean }) {
  const required = topicRequired(form);
  const invalid = !!showErrors && required && !form.category.trim();
  // One taxonomy for all video: GET /v1/posts/categories, the same list the
  // home strip reads. The select stores the slug and shows the label.
  const categories = useVideoCategories();
  const options = categoryOptions(categories.data, contentType, form.category);
  const unavailable = !categories.isLoading && options.length === 0;
  return (
    <Section
      title="Topic"
      subtitle={required ? "Where viewers find it — the same topics as the Watch page" : "Optional. Helps people who browse by topic find it"}
      icon={Tag}
      required={required}
      aside={categories.isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Loading topics" /> : null}
    >
      <StudioSelect
        id="upload-category"
        label="Topic"
        required={required}
        invalid={invalid}
        describedBy={invalid ? "upload-category-error" : undefined}
        value={form.category}
        onChange={(v) => patch({ category: v })}
        options={options}
        placeholder={categories.isLoading ? "Loading topics…" : required ? "Select a topic" : "No topic"}
      />
      {unavailable ? (
        <p className="upload-input-hint flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
          Topics could not be loaded.
          <button type="button" onClick={() => void categories.refetch()} className="upload-link-button">Try again</button>
        </p>
      ) : null}
      {invalid ? (
        <p id="upload-category-error" className="upload-field-error" role="alert">
          <AlertCircle aria-hidden="true" />
          Choose a topic to help viewers find your video.
        </p>
      ) : null}
    </Section>
  );
}

/* ── Feed ───────────────────────────────────────────────── */

/**
 * share_to_postbook. post-service: omitted = true; an explicit false keeps
 * the video out of the home Feed (it stays on PostTube / Reels and the
 * channel). The words say exactly that.
 */
export function FeedSetting({ form, patch, contentType }: SettingProps & { contentType: ContentType }) {
  const home = isShortStudio(contentType) ? "Reels" : "PostTube";
  return (
    <Section title="Feed" subtitle="Where else it can appear" icon={Newspaper}>
      <SettingsGroup>
        <ToggleRow
          label="Also show in the Feed"
          description={form.crossPostPostbook ? `It can appear in the home Feed as well as on ${home}` : `Kept out of the home Feed; it is only on ${home} and your profile`}
          checked={form.crossPostPostbook}
          onChange={(v) => patch({ crossPostPostbook: v })}
        />
      </SettingsGroup>
    </Section>
  );
}

/* ── Comments ───────────────────────────────────────────── */

const COMMENT_ACCESS = [
  { value: "everyone", label: "Everyone" },
  { value: "followers", label: "Followers only" },
  { value: "nobody", label: "Nobody" },
] as const;

export function CommentSettings({ form, patch }: SettingProps) {
  return (
    <Section title="Comments" subtitle="Who can comment on it" icon={MessageSquare}>
      <SettingsGroup>
        <ToggleRow label="Allow comments" description="Viewers can leave comments" checked={form.commentsEnabled} onChange={(v) => patch({ commentsEnabled: v })} />
        {form.commentsEnabled ? (
          <div className="upload-row-sub">
            <label htmlFor="upload-commentAccess" className="upload-row-title">Who can comment</label>
            <StudioSelect
              id="upload-commentAccess"
              value={form.commentAccess}
              onChange={(v) => patch({ commentAccess: v as StudioFormState["commentAccess"] })}
              options={COMMENT_ACCESS.map((o) => ({ value: o.value, label: o.label }))}
            />
          </div>
        ) : null}
      </SettingsGroup>
    </Section>
  );
}

/* ── Likes ──────────────────────────────────────────────── */

/** no_likes on the post: off means viewers cannot like it at all (not just a hidden count). */
export function LikeSetting({ form, patch }: SettingProps) {
  return (
    <Section title="Likes" subtitle="Whether viewers can like it">
      <SettingsGroup>
        <ToggleRow
          label="Allow likes"
          description={form.likesEnabled ? "Viewers can press Like" : "Like is turned off for this video"}
          checked={form.likesEnabled}
          onChange={(v) => patch({ likesEnabled: v })}
        />
      </SettingsGroup>
    </Section>
  );
}

/* ── Remixing ───────────────────────────────────────────── */

export function RemixSetting({ form, patch }: SettingProps) {
  return (
    <Section title="Remixing" subtitle="Whether others can use it in their own videos" icon={Repeat2}>
      <SettingsGroup>
        <RadioOption name="remix" label="Allow remixing" description="Others can use the video and its audio" checked={form.remixSetting === "allow"} onChange={() => patch({ remixSetting: "allow" })} />
        <RadioOption name="remix" label="Audio only" description="Others can use the audio, not the video" checked={form.remixSetting === "allow_audio_only"} onChange={() => patch({ remixSetting: "allow_audio_only" })} />
        <RadioOption name="remix" label="Don't allow" description="Nobody can remix it" checked={form.remixSetting === "disallow"} onChange={() => patch({ remixSetting: "disallow" })} />
      </SettingsGroup>
    </Section>
  );
}

/* ── Disclosures ────────────────────────────────────────── */

/**
 * Paid promotion and AI-generated for every studio; altered content only
 * for long video (shorts never ask). Viewers see a label for each one on.
 */
export function DisclosureSettings({ form, patch, includeAltered }: SettingProps & { includeAltered: boolean }) {
  const any = form.paidPromotion || form.aiGenerated || (includeAltered && form.alteredContent);
  return (
    <Section title="Disclosures" subtitle="Tell viewers what they should know" icon={ShieldAlert}>
      <SettingsGroup>
        <ToggleRow label="Paid promotion" description="It includes a paid promotion, sponsorship or product placement" checked={form.paidPromotion} onChange={(v) => patch({ paidPromotion: v })} />
        {includeAltered ? (
          <ToggleRow label="Altered content" description="It shows realistic altered or synthetic people, places or events that could be mistaken for real" checked={form.alteredContent} onChange={(v) => patch({ alteredContent: v })} />
        ) : null}
        <ToggleRow label="AI-generated" description="It was made with AI tools" checked={form.aiGenerated} onChange={(v) => patch({ aiGenerated: v })} />
      </SettingsGroup>
      {any ? <InfoBanner>A disclosure label will be shown to viewers when they watch this content.</InfoBanner> : null}
    </Section>
  );
}

/* ── Made for kids + age restriction (long video) ───────── */

export function KidsSetting({ form, patch }: SettingProps) {
  return (
    <Section title="Made for kids" subtitle="Is this video made for children under 13?">
      <SettingsGroup>
        <RadioOption name="coppa" label="Yes, it's made for kids" description="Made mainly for children under 13" checked={form.isMadeForKids} onChange={() => patch({ isMadeForKids: true })} />
        <RadioOption name="coppa" label="No, it's not made for kids" description="For a general or older audience" checked={!form.isMadeForKids} onChange={() => patch({ isMadeForKids: false })} />
      </SettingsGroup>
      {form.isMadeForKids ? (
        <InfoBanner variant="warning">
          Videos made for kids do not show end screens or cards to viewers.
        </InfoBanner>
      ) : null}
    </Section>
  );
}

export function AgeSetting({ form, patch }: SettingProps) {
  return (
    <Section title="Age restriction" subtitle="Limit it to adult viewers" icon={EyeOff}>
      <SettingsGroup>
        <ToggleRow
          label="Age-restricted (18+)"
          description="Only signed-in viewers aged 18 or over can watch"
          checked={form.ageRestricted}
          onChange={(v) => patch({ ageRestricted: v })}
        />
      </SettingsGroup>
    </Section>
  );
}
