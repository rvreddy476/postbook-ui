"use client";

import Link from "next/link";

import { hubEditHref } from "../studioApi";

/*
  What did not stick after a publish that went through, on the success
  screen:
  - the 18+ restriction could not be confirmed (lv-9): an error, with what
    the studio did about it and a link to fix it in Creator Hub;
  - the caption track failed (lv-8): a warning with a retry and a link to
    the Captions sheet. Neither blocks the publish.
*/
export function PublishProblems({
  postId,
  ageGateError,
  captionError,
  onRetryCaptions,
  retryingCaptions = false,
}: {
  postId: string | null;
  ageGateError: string | null;
  captionError: string | null;
  onRetryCaptions?: () => void;
  retryingCaptions?: boolean;
}) {
  if (!ageGateError && !captionError) return null;
  return (
    <>
      {ageGateError && (
        <div className="upload-banner text-left" data-variant="error" role="alert" data-publish-problem="age-gate">
          <div>
            <p className="font-semibold">18+ restriction not saved</p>
            <p>{ageGateError}</p>
            {postId && (
              <Link href={hubEditHref(postId, "details")} className="upload-button mt-2" data-link="hub-age-gate">
                Open in Creator Hub
              </Link>
            )}
          </div>
        </div>
      )}
      {captionError && (
        <div className="upload-banner text-left" data-variant="warning" role="alert" data-publish-problem="captions">
          <div>
            <p className="font-semibold">Your video published, but the captions did not upload</p>
            <p>{captionError}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {onRetryCaptions && (
                <button type="button" className="upload-button" onClick={onRetryCaptions} disabled={retryingCaptions} data-action="retry-captions">
                  {retryingCaptions ? "Retrying…" : "Retry captions"}
                </button>
              )}
              {postId && (
                <Link href={hubEditHref(postId, "captions")} className="upload-button" data-link="hub-captions">
                  Add in Creator Hub
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
