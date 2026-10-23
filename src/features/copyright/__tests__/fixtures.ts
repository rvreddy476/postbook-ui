import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

/*
  Hand-written fixtures for the copyright quick wins. There are no golden
  files for these routes yet, so each body is built from the Go handler
  and struct that answers it; SOURCES names that code (file:line in
  Architecture/services, at commit dbdd1c0ea, 24 Oct 2026). Replace a
  fixture with a byte copy once the services write goldens for it.
*/

const P = "post-service/internal"
const N = "notification-service/internal"
const T = "trust-safety-service"

export const SOURCES: Record<string, string> = {
  post_detail_owner_pending: `${P}/http/handler.go:1095 GetPost → {data: service.PostDetail} (:1131); the owner's applyHubDetail (${P}/service/hub_detail.go:100) adds restrictions[] (RestrictionNotice, ${P}/service/my_uploads.go:77) and copyright_review (:126 attachCopyrightReviews → ${P}/service/copyright_title_review.go:651 CopyrightReviewView, decided_at/review_requested_at omitempty); the title_review restriction's case_id is the review id, reason_code title_match, policy_version title-review-v1 (${P}/store/postgres/copyright_title_review.go:29-33, :174)`,
  post_detail_owner_requested: `${P}/service/copyright_title_review.go:657 ReviewRequestedAt = the author's request (AuthorRequestedAt, :669)`,
  post_detail_viewer: `${P}/service/copyright_title_review.go:676 attachCopyrightReviews fills only the owner's long videos; PostDetail.CopyrightReview omitempty (${P}/service/post.go:615) — absent for every other viewer and for a video never flagged`,
  uploads_videos_states: `${P}/http/my_uploads.go:41 GetMyVideos → []service.UploadDetail + meta.next_cursor (:59); flags per UploadFlags (${P}/service/my_uploads.go:153, copyright_hold when ActiveRestrictionCount > 0 :166), restrictions[] (:45, active only), copyright_review per attachCopyrightReviews (:400); a cleared review stays visible once the author was told (copyright_title_review.go:664)`,
  review_request_200: `${P}/http/copyright_review.go:304 RequestCopyrightReview → 200 api.JSON(view, nil) (:338): {data: CopyrightReviewView}, no meta`,
  review_request_400_note: `${P}/http/copyright_review.go:325 ErrTitleReviewInvalid → 400 INVALID_REQUEST "note must be 1-1000 characters" (service trims, counts runes: copyright_title_review.go:709)`,
  review_request_404: `${P}/http/copyright_review.go:327 ErrTitleReviewNotFound → 404 REVIEW_NOT_FOUND`,
  review_request_409_decided: `${P}/http/copyright_review.go:329 ErrTitleReviewDecided → 409 REVIEW_ALREADY_DECIDED`,
  review_request_503: `${P}/http/copyright_review.go:331 ErrCopyrightReviewUnavailable → 503 COPYRIGHT_REVIEW_UNAVAILABLE`,
  publish_403_uploads_paused: `${P}/http/standing_errors.go:53 UploadsPausedError → 403 UPLOADS_PAUSED details {until: RFC3339 UTC} (create ${P}/service/post.go:1109, drafts, publish now: schedule.go)`,
  edit_409_copyright_review: `${P}/http/standing_errors.go:76 writeCopyrightReviewTier → 409 COPYRIGHT_REVIEW; PATCH via writeTierGateError (${P}/http/handler.go:1213, ${P}/http/post_edit.go:255; keeping a tier is refused too, ${P}/store/postgres/post_edit.go:141), PUT /membership (${P}/store/postgres/posts.go:1689)`,
  notification_page_copyright: `${N}/events/copyright_consumer.go:34 pending → copyright_review_hold → /posttube/hub (${N}/service/copyright_notify.go:46), :36 cleared → UploadDeepLink /tube/watch/{id} (${N}/service/upload_deeplink.go:29), :42 blocked → /posttube/hub; titles ${N}/service/templates.go:312, inbox icon account (${N}/service/inbox_copy.go:325); the author is the actor of their own notice (copyright_notify.go:97)`,
  report_reasons: `${T}/database/migrations/018_copyright_report_reasons.sql: copyright_mine "Copyright: this is my content", copyright_media "Copyright: film, TV or music"; posts only (${T}/internal/service/moderation.go:90 CopyrightReasonLabels, copyrightEntityTypes)`,
}

const DIR = join(import.meta.dir, "fixtures")

export function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(DIR, `${name}.json`), "utf8"))
}

export function fixtureNames(): string[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -".json".length))
    .sort()
}

/** An axios-shaped error carrying a fixture body. */
export function httpError(status: number, name?: string): unknown {
  return { isAxiosError: true, response: { status, data: name ? fixture(name) : {} } }
}

export const NETWORK_ERROR = { isAxiosError: true, message: "Network Error" }
