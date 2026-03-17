"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2, Copy, ExternalLink, AlertTriangle, Check } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "@/features/reels/components/AppShell";
import { CONTENT_TYPE_META, STEP_META, type ContentType } from "./tokens";
import { useUploadStudio, classifyVideo } from "./useUploadStudio";
import { StudioToolbar } from "./components/StudioToolbar";
import { PreviewPanel } from "./components/PreviewPanel";
import { VideoStep } from "./steps/VideoStep";
import { DetailsStep } from "./steps/DetailsStep";
import { AudienceStep } from "./steps/AudienceStep";
import { EngageStep } from "./steps/EngageStep";
import { EnrichStep } from "./steps/EnrichStep";
import { PublishStep } from "./steps/PublishStep";
import { getStepErrors, isStepComplete, canPublish, getAllErrors } from "./validation";

export type { ContentType };

interface UploadStudioProps {
  contentType: ContentType;
}

export function UploadStudio({ contentType }: UploadStudioProps) {
  const studio = useUploadStudio(contentType);
  const { form, patch, steps, currentStepIndex, goToStep, nextStep, prevStep, isFirstStep, isLastStep } = studio;
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [attemptedNext, setAttemptedNext] = useState(false);

  const checksPass = canPublish(form, steps);
  const draftSaved = studio.saveDraftMutation.isSuccess && !studio.saveDraftMutation.isPending;
  const currentStepErrors = getStepErrors(form.currentStep, form);
  const allErrors = getAllErrors(form, steps);

  const handleNext = () => {
    setAttemptedNext(true);
    if (currentStepErrors.length > 0) {
      return; // Block navigation — errors shown inline
    }
    setAttemptedNext(false);
    nextStep();
  };

  const handlePublish = () => {
    if (!checksPass) {
      setShowValidationErrors(true);
      return;
    }
    setShowValidationErrors(false);
    studio.publishMutation.mutate();
  };

  const config = CONTENT_TYPE_META[contentType];
  const classified = classifyVideo(form.videoDurationSec, form.videoWidth, form.videoHeight);
  const isLongVideo = classified === "long_video" || contentType === "podcast";
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const postUrl = form.publishedPostId
    ? isLongVideo
      ? `${baseUrl}/posttube/watch/${form.publishedPostId}`
      : `${baseUrl}/reels?reelId=${form.publishedPostId}`
    : "";

  const renderStep = () => {
    const props = { form, patch, showErrors: attemptedNext };
    switch (form.currentStep) {
      case "video":
        return (
          <VideoStep
            {...props}
            onFileSelected={studio.selectFile}
            clearFile={studio.clearFile}
            contentType={contentType}
          />
        );
      case "details":
        return (
          <DetailsStep
            {...props}
            extractCoverPreview={studio.extractCoverPreview}
            selectCustomCover={studio.selectCustomCover}
            contentType={contentType}
          />
        );
      case "audience":
        return <AudienceStep {...props} />;
      case "engage":
        return <EngageStep {...props} />;
      case "enrich":
        return <EnrichStep {...props} />;
      case "publish":
        return <PublishStep {...props} />;
      default:
        return null;
    }
  };

  /* ── Published success screen ── */
  if (form.publishSuccess && form.publishedPostId) {
    return (
      <AppShell sectionLabel="Upload">
        <div className="flex h-full items-center justify-center bg-[#F5F4F1]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="mx-auto max-w-[480px] text-center px-6"
          >
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#2BB5A0]/20 to-[#2BB5A0]/5 ring-8 ring-[#2BB5A0]/5">
              <CheckCircle2 className="h-10 w-10 text-[#2BB5A0]" />
            </div>
            <h2 className="mt-6 text-[22px] font-bold text-[#1A1A1A]">
              {config.label} published!
            </h2>
            <p className="mt-2 text-[14px] text-[#6B6B6B] leading-relaxed max-w-sm mx-auto">
              Your video is being processed and will be available to viewers shortly.
              This usually takes a few minutes.
            </p>

            {postUrl && (
              <div className="mt-6 flex items-center gap-2 rounded-xl border border-[#E8E6E1] bg-brand-card px-4 py-3 shadow-sm">
                <span className="flex-1 truncate text-left text-[13px] text-[#6B6B6B] font-mono">{postUrl}</span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(postUrl)}
                  className="shrink-0 rounded-lg p-1.5 text-[#9E9E9E] hover:bg-[#F5F4F1] hover:text-[#6B6B6B] transition-colors"
                  title="Copy link"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="mt-8 flex items-center justify-center gap-3">
              <Link
                href={isLongVideo ? "/posttube" : "/reels"}
                className="flex items-center gap-1.5 rounded-xl border border-[#E8E6E1] bg-brand-card px-5 py-2.5 text-[13px] font-medium text-[#6B6B6B] hover:bg-[#F5F4F1] transition-colors shadow-sm"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Go to {isLongVideo ? "PostTube" : "Flicks"}
              </Link>
              <button
                type="button"
                onClick={() => patch({
                  ...studio.form,
                  videoFile: null, videoPreviewUrl: null, videoDurationSec: null, mediaId: null,
                  draftId: null, uploadProgress: 0, uploadPhase: "idle", uploadError: null,
                  title: "", caption: "", hashtags: [], tags: [], hashtagInput: "",
                  coverSourceType: "video_frame", coverTimestampMs: null, coverPreviewUrl: null,
                  customCoverFile: null, customCoverPreviewUrl: null, coverResult: null,
                  processingReady: false, copyrightCheck: null, publishedPostId: null,
                  publishSuccess: false, currentStep: "video", category: "",
                })}
                className="rounded-xl bg-[#7C5CFC] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-[#6A4AE8] transition-colors shadow-sm"
              >
                Upload Another
              </button>
            </div>
          </motion.div>
        </div>
      </AppShell>
    );
  }


  return (
    <AppShell sectionLabel="Upload">
      <div className="flex h-full flex-col bg-[#F5F4F1]">
        <StudioToolbar
          contentType={contentType}
          steps={steps}
          currentStep={form.currentStep}
          currentStepIndex={currentStepIndex}
          onStepClick={(step) => {
            setAttemptedNext(false);
            goToStep(step);
          }}
          form={form}
          showPublish={isLastStep}
          onPublish={handlePublish}
          isPublishing={studio.publishMutation.isPending}
          checksPass={checksPass}
          onSaveDraft={() => studio.saveDraftMutation.mutate()}
          isSaving={studio.saveDraftMutation.isPending}
          hasDraft={!!form.draftId}
          draftSaved={draftSaved}
        />

        <div className="flex flex-1 min-h-0">
          {/* Form panel */}
          <div className="flex-1 min-w-0 overflow-y-auto">
            <div className="mx-auto max-w-[640px] px-8 py-8">
              {/* Step content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={form.currentStep}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2 }}
                >
                  {renderStep()}
                </motion.div>
              </AnimatePresence>

              {/* Validation errors (shown when trying to proceed with errors) */}
              {attemptedNext && currentStepErrors.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 rounded-xl border border-[#E8527A]/20 bg-[#E8527A]/5 p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-[#E8527A]" />
                    <p className="text-[13px] font-semibold text-[#E8527A]">Please fix the following:</p>
                  </div>
                  <ul className="space-y-1">
                    {currentStepErrors.map((err) => (
                      <li key={err.field} className="text-[12px] text-[#E8527A] pl-6">
                        {err.message}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}

              {/* Publish validation summary */}
              {isLastStep && showValidationErrors && allErrors.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 rounded-xl border border-[#E8527A]/20 bg-[#E8527A]/5 p-4"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-[#E8527A]" />
                    <p className="text-[13px] font-semibold text-[#E8527A]">Cannot publish yet</p>
                  </div>
                  {allErrors.map(({ step, errors }) => (
                    <div key={step} className="mb-2 last:mb-0">
                      <p className="text-[11px] font-bold text-[#E8527A]/70 uppercase tracking-wide mb-1">
                        {STEP_META[step].label}
                      </p>
                      <ul className="space-y-0.5">
                        {errors.map((err) => (
                          <li key={err.field} className="text-[12px] text-[#E8527A] pl-3 flex items-start gap-1.5">
                            <span className="mt-1.5 h-1 w-1 rounded-full bg-[#E8527A] shrink-0" />
                            {err.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </motion.div>
              )}

              {/* Publish readiness checklist (on last step, when all good) */}
              {isLastStep && checksPass && !showValidationErrors && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 rounded-xl border border-[#2BB5A0]/20 bg-[#2BB5A0]/5 p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-[#2BB5A0]" />
                    <p className="text-[13px] font-semibold text-[#2BB5A0]">Ready to publish</p>
                  </div>
                  <ul className="space-y-1.5">
                    {steps.map((step) => (
                      <li key={step} className="flex items-center gap-2 text-[12px] text-[#6B6B6B]">
                        <Check className="h-3 w-3 text-[#2BB5A0]" strokeWidth={3} />
                        {STEP_META[step].label}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}

              {/* Navigation */}
              <div className="mt-8 flex items-center justify-between pb-4">
                {!isFirstStep ? (
                  <button
                    type="button"
                    onClick={() => { setAttemptedNext(false); prevStep(); }}
                    className="flex items-center gap-1.5 rounded-xl border border-[#E8E6E1] bg-brand-card px-5 py-2.5 text-[13px] font-medium text-[#6B6B6B] hover:bg-[#F5F4F1] transition-colors shadow-sm"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </button>
                ) : (
                  <div />
                )}

                {!isLastStep && (
                  <button
                    type="button"
                    onClick={handleNext}
                    className={`flex items-center gap-1.5 rounded-xl px-6 py-2.5 text-[13px] font-semibold text-white transition-all shadow-sm ${
                      currentStepErrors.length > 0 && attemptedNext
                        ? "bg-[#E8527A] hover:bg-[#D4426A]"
                        : "bg-[#7C5CFC] hover:bg-[#6A4AE8]"
                    }`}
                  >
                    Continue
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}

                {isLastStep && (
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={studio.publishMutation.isPending}
                    className="flex items-center gap-1.5 rounded-xl bg-[#7C5CFC] px-6 py-2.5 text-[13px] font-bold text-white hover:bg-[#6A4AE8] disabled:opacity-50 transition-all shadow-sm shadow-[#7C5CFC]/20"
                  >
                    {studio.publishMutation.isPending ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Publishing...
                      </>
                    ) : (
                      "Publish Now"
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Preview panel */}
          <PreviewPanel form={form} patch={patch} contentType={contentType} steps={steps} />
        </div>
      </div>
    </AppShell>
  );
}
