import type {
  HubCommentAccess,
  HubCommentModeration,
  HubCommentSort,
  HubLicense,
  HubPostDetail,
  HubPostPatch,
  HubRemixSetting,
  HubVisibility,
} from "./hubApi";
import { diffPatch, splitTags, toLocalInput } from "./hubModel";

/*
  The edit sheet's Details form, pure: prefill from the owner detail
  (contract B), and the PATCH that carries only what changed (contract A).
  The sheet renders it; the tests pin the diff.
*/

export interface DetailsForm {
  title: string;
  text: string;
  category: string;
  tags: string;
  hashtags: string;
  language: string;
  allow_download: boolean;
  no_comments: boolean;
  made_for_kids: boolean;
  visibility: HubVisibility;
  scheduled_local: string;
  /* More settings */
  paid_promotion: boolean;
  altered_content: boolean;
  license: HubLicense;
  allow_embedding: boolean;
  recording_date: string;
  recording_location: string;
  remix_setting: HubRemixSetting;
  comment_moderation: HubCommentModeration;
  comment_access: HubCommentAccess;
  notify_subscribers: boolean;
  age_restricted: boolean;
  hide_like_count: boolean;
  default_comment_sort: HubCommentSort;
  related_post_id: string;
}

export const RECORDING_LOCATION_MAX = 100;

export function toDetailsForm(p: HubPostDetail): DetailsForm {
  return {
    title: p.title,
    text: p.text,
    category: p.category,
    tags: p.tags.join(", "),
    hashtags: p.hashtags.join(", "),
    language: p.language,
    allow_download: p.allow_download,
    no_comments: p.no_comments,
    made_for_kids: p.made_for_kids,
    visibility: p.visibility,
    scheduled_local: toLocalInput(p.scheduled_at),
    paid_promotion: p.paid_promotion,
    altered_content: p.altered_content,
    license: p.license,
    allow_embedding: p.allow_embedding,
    recording_date: p.recording_date,
    recording_location: p.recording_location,
    remix_setting: p.remix_setting,
    comment_moderation: p.comment_moderation,
    comment_access: p.comment_access,
    notify_subscribers: p.notify_subscribers,
    age_restricted: p.age_restricted,
    hide_like_count: p.hide_like_count,
    default_comment_sort: p.default_comment_sort,
    related_post_id: p.related_post_id ?? "",
  };
}

/** Not published yet: the only state in which "Notify subscribers" still means something. */
export function notYetPublished(p: Pick<HubPostDetail, "visibility" | "status">): boolean {
  return p.visibility === "scheduled" || p.status === "draft" || p.status === "scheduled";
}

function patchable(f: DetailsForm, includeNotify: boolean): Record<string, unknown> {
  return {
    title: f.title.trim(),
    text: f.text,
    category: f.category,
    tags: splitTags(f.tags),
    hashtags: splitTags(f.hashtags),
    language: f.language,
    allow_download: f.allow_download,
    no_comments: f.no_comments,
    made_for_kids: f.made_for_kids,
    visibility: f.visibility === "scheduled" ? undefined : f.visibility,
    paid_promotion: f.paid_promotion,
    altered_content: f.altered_content,
    license: f.license,
    allow_embedding: f.allow_embedding,
    recording_date: f.recording_date,
    recording_location: f.recording_location.trim(),
    remix_setting: f.remix_setting,
    comment_moderation: f.comment_moderation,
    comment_access: f.comment_access,
    notify_subscribers: includeNotify ? f.notify_subscribers : undefined,
    age_restricted: f.age_restricted,
    hide_like_count: f.hide_like_count,
    default_comment_sort: f.default_comment_sort,
    related_post_id: f.related_post_id,
  };
}

/**
  Only the keys whose value moved. A cleared recording date, location or
  related video goes as "" (the contract's clear). `notify_subscribers`
  only while the video is not published yet.
*/
export function detailsPatch(base: DetailsForm, next: DetailsForm, opts: { notifyEditable: boolean }): HubPostPatch {
  return diffPatch(patchable(base, opts.notifyEditable), patchable(next, opts.notifyEditable)) as HubPostPatch;
}

/** Client-side checks before Save; the server's 422 codes are the backstop. */
export function detailsProblems(f: DetailsForm, postId: string, today = new Date()): string[] {
  const out: string[] = [];
  if ([...f.recording_location.trim()].length > RECORDING_LOCATION_MAX) out.push("The recording location is too long (100 characters at most).");
  if (f.recording_date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.recording_date)) out.push("Pick a recording date.");
    else if (f.recording_date > todayStr) out.push("The recording date can't be in the future.");
  }
  if (f.related_post_id && f.related_post_id === postId) out.push("A video can't point at itself as its related video.");
  return out;
}
