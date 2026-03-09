"use client";

import { ChevronLeft, ChevronRight, CheckCircle2, Copy, ExternalLink } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/features/reels/components/AppShell";
import { CONTENT_TYPE_META, type ContentType } from "./tokens";
import { useUploadStudio } from "./useUploadStudio";
import { StudioToolbar } from "./components/StudioToolbar";
import { PreviewPanel } from "./components/PreviewPanel";
import { VideoStep } from "./steps/VideoStep";
import { DetailsStep } from "./steps/DetailsStep";
import { AudienceStep } from "./steps/AudienceStep";
import { EngageStep } from "./steps/EngageStep";
import { EnrichStep } from "./steps/EnrichStep";
import { PublishStep } from "./steps/PublishStep";

export type { ContentType };

interface UploadStudioProps {
  contentType: ContentType;
}

export function UploadStudio({ contentType }: UploadStudioProps) {
  const studio = useUploadStudio(contentType);
  const { form, patch, steps, currentStepIndex, goToStep, nextStep, prevStep, isFirstStep, isLastStep } = studio;

  const checksPass = form.title.trim().length > 0 && (form.uploadPhase === "done" || form.mediaId !== null) && form.caption.length <= 2200;
  const draftSaved = studio.saveDraftMutation.isSuccess && !studio.saveDraftMutation.isPending;

  const renderStep = () => {
    switch (form.currentStep) {
      case "video":
        return (
          <VideoStep
            form={form}
            patch={patch}
            onFileSelected={studio.selectFile}
            clearFile={studio.clearFile}
            contentType={contentType}
          />
        );
      case "details":
        return (
          <DetailsStep
            form={form}
            patch={patch}
            extractCoverMutation={studio.extractCoverMutation}
            contentType={contentType}
          />
        );
      case "audience":
        return <AudienceStep form={form} patch={patch} />;
      case "engage":
        return <EngageStep form={form} patch={patch} />;
      case "enrich":
        return <EnrichStep form={form} patch={patch} />;
      case "publish":
        return <PublishStep form={form} patch={patch} />;
      default:
        return null;
    }
  };

  const config = CONTENT_TYPE_META[contentType];
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const postUrl = form.publishedPostId
    ? contentType === "long" || contentType === "podcast"
      ? `${baseUrl}/posttube/watch/${form.publishedPostId}`
      : `${baseUrl}/reels/${form.publishedPostId}`
    : "";

  /* ── Published success screen ── */
  if (form.publishSuccess && form.publishedPostId) {
    return (
      <AppShell sectionLabel="Upload">
        <div className="flex h-full items-center justify-center bg-[#F5F4F1]">
          <div className="mx-auto max-w-[440px] text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#2BB5A0]/10">
              <CheckCircle2 className="h-8 w-8 text-[#2BB5A0]" />
            </div>
            <h2 className="mt-5 text-[20px] font-bold text-[#1A1A1A]">
              {config.label} published successfully!
            </h2>
            <p className="mt-2 text-[14px] text-[#6B6B6B] leading-relaxed">
              Your video is being processed and will be available to viewers shortly.
              This usually takes a few minutes.
            </p>

            {/* Content link */}
            {postUrl && (
              <div className="mt-6 flex items-center gap-2 rounded-xl border border-[#E8E6E1] bg-white px-4 py-3">
                <span className="flex-1 truncate text-left text-[13px] text-[#6B6B6B]">{postUrl}</span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(postUrl)}
                  className="shrink-0 rounded-lg p-1.5 text-[#9E9E9E] hover:bg-[#F5F4F1] hover:text-[#6B6B6B] transition-colors"
                  title="Copy link"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 flex items-center justify-center gap-3">
              <Link
                href={contentType === "long" || contentType === "podcast" ? "/posttube" : "/reels"}
                className="flex items-center gap-1.5 rounded-xl border border-[#E8E6E1] bg-white px-5 py-2.5 text-[13px] font-medium text-[#6B6B6B] hover:bg-[#F5F4F1] transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Go to {contentType === "long" || contentType === "podcast" ? "PostTube" : "Reels"}
              </Link>
              <button
                type="button"
                onClick={() => patch({
                  ...studio.form,
                  videoFile: null,
                  videoPreviewUrl: null,
                  videoDurationSec: null,
                  mediaId: null,
                  draftId: null,
                  uploadProgress: 0,
                  uploadPhase: "idle",
                  uploadError: null,
                  title: "",
                  caption: "",
                  hashtags: [],
                  tags: [],
                  hashtagInput: "",
                  coverTimestampMs: null,
                  coverResult: null,
                  processingReady: false,
                  copyrightCheck: null,
                  publishedPostId: null,
                  publishSuccess: false,
                  currentStep: "video",
                })}
                className="rounded-xl bg-[#7C5CFC] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-[#6A4AE8] transition-colors"
              >
                Upload Another
              </button>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell sectionLabel="Upload">
      <div className="flex h-full flex-col bg-[#F5F4F1]">
        {/* ── Single toolbar: title + badge + step tabs + actions ── */}
        <StudioToolbar
          contentType={contentType}
          steps={steps}
          currentStep={form.currentStep}
          currentStepIndex={currentStepIndex}
          onStepClick={goToStep}
          showPublish={form.currentStep === "publish"}
          onPublish={() => studio.publishMutation.mutate()}
          isPublishing={studio.publishMutation.isPending}
          checksPass={checksPass}
          onSaveDraft={() => studio.saveDraftMutation.mutate()}
          isSaving={studio.saveDraftMutation.isPending}
          hasDraft={!!form.draftId}
          draftSaved={draftSaved}
        />

        {/* ── Form + Preview (2-column) ── */}
        <div className="flex flex-1 min-h-0">
          {/* Form panel */}
          <div className="flex-1 min-w-0 overflow-y-auto px-8 py-6">
            <div className="mx-auto max-w-[620px]">
              {renderStep()}

              {/* ── Back / Next inside the form area ── */}
              <div className="mt-8 flex items-center justify-between">
                {!isFirstStep ? (
                  <button
                    type="button"
                    onClick={prevStep}
                    className="flex items-center gap-1 rounded-xl border border-[#E8E6E1] bg-white px-4 py-2 text-[13px] font-medium text-[#6B6B6B] hover:bg-[#F5F4F1] transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Back
                  </button>
                ) : (
                  <div />
                )}

                {!isLastStep && (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="flex items-center gap-1 rounded-xl bg-[#7C5CFC] px-5 py-2 text-[13px] font-semibold text-white hover:bg-[#6A4AE8] transition-colors"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Preview panel (right) */}
          <PreviewPanel form={form} contentType={contentType} />
        </div>
      </div>
    </AppShell>
  );
}
