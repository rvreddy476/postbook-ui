/*
  Resuming an upload after a reload (reels-39), the studio's half.

  lib/resumableUpload.ts keeps the session; this file decides what the
  studio says and does with a kept one:
  - On opening the studio with an unfinished upload it offers to continue:
    the creator chooses the same file again (a browser cannot keep a File
    across a reload). A different file is refused with the name and size it
    expects, until the creator chooses Start over.
  - An expired session is forgotten and the creator is told the upload
    starts again from the beginning.
  The record is cleared when the upload completes, when the creator removes
  the file or chooses Start over, and at sign-out (authService).
*/

import { resumeRecordExpired, sameFile, type ResumeRecord, type ResumeStore } from "@/lib/resumableUpload";
import { fileSizeLabel } from "./fileRules";

export type ResumeOffer = Pick<ResumeRecord, "upload_id" | "file" | "expires_at">;

export const RESUME_EXPIRED_NOTICE = "Your earlier upload expired before it finished, so it started again from the beginning.";

/** What the studio does with the store on opening: an offer, a notice, or nothing. */
export function readResumeOffer(store: ResumeStore, now: number = Date.now()): { offer: ResumeOffer | null; notice: string | null } {
  const record = store.load();
  if (!record) return { offer: null, notice: null };
  if (resumeRecordExpired(record, now)) {
    store.clear();
    return { offer: null, notice: `Your unfinished upload of “${record.file.name}” expired. Choose a file to start again.` };
  }
  return { offer: { upload_id: record.upload_id, file: record.file, expires_at: record.expires_at }, notice: null };
}

/** The banner over the file picker. */
export function resumeOfferText(offer: ResumeOffer): string {
  return `Your upload of “${offer.file.name}” (${fileSizeLabel(offer.file.size)}) didn't finish. Choose the same file to continue from where it stopped.`;
}

/** Null when the chosen file is the one the kept upload belongs to; otherwise why it is refused. */
export function resumeFileProblem(offer: ResumeOffer | null, file: Pick<File, "name" | "size" | "lastModified" | "type">): string | null {
  if (!offer) return null;
  if (sameFile(offer, file as Blob & File)) return null;
  return `This isn't the file you were uploading. Choose “${offer.file.name}” (${fileSizeLabel(offer.file.size)}) to continue, or choose Start over to upload a different video.`;
}
