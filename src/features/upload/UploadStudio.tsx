"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2, Copy, ExternalLink, AlertTriangle, Check, LayoutPanelTop, ArrowLeft, Save, CloudUpload } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useGlobalToast } from "@/contexts/ToastContext";
import { AppShell } from "@/features/reels/components/AppShell";
import { followUpNotice, hubEditHref } from "./studioApi";
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
import { getStepErrors, canPublish, getAllErrors } from "./validation";

import "./upload.css";

export type { ContentType };

interface UploadStudioProps {
  contentType: ContentType;
  /** A sound to start with (/reels/create?sound=<id>); the Audio section shows it. */
  soundId?: string | null;
}

export function UploadStudio({ contentType, soundId = null }: UploadStudioProps) {
  const studio = useUploadStudio(contentType, { soundId });
  const { form, patch, steps, currentStepIndex, goToStep, nextStep, prevStep, isFirstStep, isLastStep } = studio;
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [attemptedNext, setAttemptedNext] = useState(false);
  const publishError = studio.publishMutation.error instanceof Error ? studio.publishMutation.error.message : null;
  const toast = useGlobalToast();

  // Series / chapters that did not stick after publish: one toast per
  // published post, with a link to the Creator Hub edit sheet.
  const noticedRef = useRef<string | null>(null);
  useEffect(() => {
    const postId = form.publishedPostId;
    if (!form.publishSuccess || !postId || noticedRef.current === postId) return;
    const notice = followUpNotice(form.followUpFailures);
    if (!notice) return;
    noticedRef.current = postId;
    toast({
      type: "warning",
      title: notice.title,
      customContent: (
        <div className="px-4 py-3 pr-10" data-toast="upload-follow-up">
          <p className="text-[13px] font-semibold text-brand-text">{notice.title}</p>
          <p className="mt-0.5 text-[12px] text-muted">{notice.description}</p>
          <Link href={hubEditHref(postId, notice.sheet)} className="mt-1.5 inline-block text-[12px] font-semibold text-brand-text underline underline-offset-2">
            Open in Creator Hub
          </Link>
        </div>
      ),
    });
  }, [form.publishSuccess, form.publishedPostId, form.followUpFailures, toast]);

  const checksPass = canPublish(form, steps);
  const busy = studio.publishMutation.isPending || studio.saveDraftMutation.isPending;
  const navigationLocked = busy || studio.checkingFile;
  const validationRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(form.currentStep);
  useEffect(() => {
    if (previousStep.current === form.currentStep) return;
    previousStep.current = form.currentStep;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ block: "start" });
  }, [form.currentStep]);
  const focusErrors = () => requestAnimationFrame(() => validationRef.current?.focus());
  const saveError = studio.saveDraftMutation.error instanceof Error ? studio.saveDraftMutation.error.message : null;
  const currentStepErrors = getStepErrors(form.currentStep, form);
  const allErrors = getAllErrors(form, steps);

  const handleNext = () => {
    if (navigationLocked) return;
    setAttemptedNext(true);
    if (currentStepErrors.length > 0) {
      focusErrors();
      return; // Block navigation — errors shown inline
    }
    setAttemptedNext(false);
    nextStep();
  };

  const handlePublish = () => {
    // Re-entry guard: ignore clicks while a publish is in flight or already done.
    // Without this, the (now longer) upload-on-publish window let users fire
    // multiple publishes / create duplicate posts.
    if (navigationLocked || form.publishSuccess) return;
    if (!checksPass) {
      setShowValidationErrors(true);
      setAttemptedNext(true);
      focusErrors();
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
    const props = { form, patch, showErrors: attemptedNext || showValidationErrors };
    switch (form.currentStep) {
      case "video":
        return (
          <VideoStep
            {...props}
            checking={studio.checkingFile}
            disabled={busy}
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
            soundNotice={studio.sound.notice}
            onRemoveSound={studio.removeSound}
          />
        );
      case "audience":
        return <AudienceStep {...props} />;
      case "engage":
        return <EngageStep {...props} />;
      case "enrich":
        return <EnrichStep {...props} />;
      case "publish":
        return (
          <PublishStep
            {...props}
            publishError={publishError}
            retryProcessingCheck={studio.retryProcessingCheck}
            onReplaceVideo={studio.clearFile}
            contentType={contentType}
          />
        );
      default:
        return null;
    }
  };

  /* ── Published success screen ── */
  // Gate on publishSuccess alone — the post id only drives the optional share
  // link. Requiring it previously could leave a successful publish stuck on the
  // form (re-clickable) if the create/draft response omitted the id.
  if (form.publishSuccess) {
    return (
      <AppShell sectionLabel="Upload">
        <div className="flex h-full items-center justify-center bg-brand-secondary">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="mx-auto max-w-[480px] text-center px-6"
          >
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br from-success/20 to-success/5 ring-8 ring-success/5">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </div>
            <h2 className="mt-6 text-[22px] font-bold text-brand-text">
              {config.label} published!
            </h2>
            <p className="mt-2 text-[14px] text-muted leading-relaxed max-w-sm mx-auto">
              Your video is being processed and will be available to viewers shortly.
              This usually takes a few minutes.
            </p>
            {form.publishedEpisodeNum !== null && form.seriesChoice.kind !== "none" && (
              <p className="mt-2 text-[13px] text-muted" data-series-result>
                Added to {form.seriesChoice.title.trim() || "your series"} as episode {form.publishedEpisodeNum}.
              </p>
            )}
            {form.publishWarning && (
              <p className="mt-3 rounded-xl border border-warning/20 bg-warning/5 px-4 py-3 text-[12px] text-warning dark:text-warning">
                {form.publishWarning}
              </p>
            )}

            {postUrl && (
              <div className="mt-6 flex items-center gap-2 rounded-xl border border-brand-text/10 bg-brand-card px-4 py-3 shadow-xs">
                <span className="flex-1 truncate text-left text-[13px] text-muted font-mono">{postUrl}</span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(postUrl)}
                  className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-brand-secondary hover:text-muted transition-colors"
                  title="Copy link"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            )}

            {isLongVideo && form.publishedPostId && (
              <Link
                href={hubEditHref(form.publishedPostId, "elements")}
                className="mt-4 flex items-center gap-3 rounded-xl border border-brand-text/10 bg-brand-card px-4 py-3 text-left shadow-xs transition-colors hover:bg-brand-secondary"
                data-link="hub-elements"
              >
                <LayoutPanelTop className="h-4 w-4 shrink-0 text-muted" />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-brand-text">Add an end screen and cards</span>
                  <span className="block text-[11px] text-muted">In Creator Hub, next to chapters</span>
                </span>
              </Link>
            )}

            <div className="mt-8 flex items-center justify-center gap-3">
              <Link
                href={isLongVideo ? "/posttube" : "/reels"}
                className="flex items-center gap-1.5 rounded-xl border border-brand-text/10 bg-brand-card px-5 py-2.5 text-[13px] font-medium text-muted hover:bg-brand-secondary transition-colors shadow-xs"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Go to {isLongVideo ? "Posttube" : "Reels"}
              </Link>
              <button
                type="button"
                onClick={studio.clearFile}
                className="rounded-xl bg-primary-ink px-5 py-2.5 text-[13px] font-semibold text-on-primary hover:bg-primary-ink transition-colors shadow-xs"
              >
                Upload Another
              </button>
            </div>
          </motion.div>
        </div>
      </AppShell>
    );
  }


  const stepIntro = {
    video: ["Select a video", "Start with a file from your device. You'll review everything before publishing."],
    details: ["Give your video some context", "A title is required. A description, cover and tags are optional."],
    audience: ["Choose your audience", "Review who this content is for and any disclosures that apply."],
    engage: ["Set up the conversation", "Choose how viewers can comment, react and remix."],
    enrich: ["Add the finishing touches", "Optional captions, chapters and metadata help viewers explore your video."],
    publish: ["Review and publish", "Choose a topic, check visibility and decide when your video goes live."],
  }[form.currentStep];
  const validationGroups = showValidationErrors && isLastStep ? allErrors : attemptedNext && currentStepErrors.length ? [{ step: form.currentStep, errors: currentStepErrors }] : [];

  return <AppShell sectionLabel="Upload">
    <div className="upload-studio">
      <header className="upload-page-head">
        <div>
          <Link href={contentType === "reel" || contentType === "short" ? "/reels" : "/posttube/hub"} className="upload-back"><ArrowLeft aria-hidden="true" />{contentType === "reel" || contentType === "short" ? "Reels" : "Creator Hub"}</Link>
          <h1>{contentType === "podcast" ? "Upload a podcast" : contentType === "reel" || contentType === "short" ? "Create a reel" : "Upload a video"}</h1>
          <p>Add details, choose your audience and publish.</p>
        </div>
        <span className="upload-session-status"><CloudUpload aria-hidden="true" />{form.draftId ? "Draft created" : "Not published"}</span>
      </header>
      <StudioToolbar steps={steps} currentStep={form.currentStep} currentStepIndex={currentStepIndex} form={form} disabled={navigationLocked}
        onStepClick={(step) => { setAttemptedNext(false); setShowValidationErrors(false); goToStep(step); }} />
      <div className="upload-workspace">
        <section className="upload-form-card" aria-labelledby="upload-step-title">
          <div className="upload-step-heading">
            <div><span className="upload-eyebrow">Step {currentStepIndex + 1} of {steps.length}</span>
              <h2 id="upload-step-title" ref={headingRef} tabIndex={-1}>{stepIntro[0]}</h2>
              <p>{stepIntro[1]}</p></div>
            <span className="upload-required-note">* Required</span>
          </div>
          {validationGroups.length ? <div ref={validationRef} tabIndex={-1} className="upload-validation" role="alert" aria-labelledby="upload-validation-title">
            <strong id="upload-validation-title"><AlertTriangle aria-hidden="true" />{isLastStep ? "A few things need attention before publishing" : "Let's finish this step"}</strong>
            <ul>{validationGroups.flatMap(({ step, errors }) => errors.map((error) => <li key={step + error.field}>
              <button type="button" onClick={() => {
                if (step !== form.currentStep) { goToStep(step); setAttemptedNext(true); }
                else { (document.getElementById("upload-" + error.field) ?? headingRef.current)?.focus(); }
              }}>{error.message}{step !== form.currentStep ? <span> — {STEP_META[step].label}</span> : null}</button>
            </li>))}</ul>
          </div> : null}
          <fieldset className="upload-step-fields" disabled={navigationLocked} aria-busy={navigationLocked || undefined}>{renderStep()}</fieldset>
          {busy ? <div className="upload-transfer-status" role="status">
            <CloudUpload aria-hidden="true" /><div><strong>{studio.saveDraftMutation.isPending ? "Saving your draft…" : form.uploadPhase === "uploading" ? "Uploading your video…" : "Finishing publication…"}</strong>
            <span>Keep this page open. Your progress will appear here.</span>
            {form.uploadPhase === "uploading" ? <progress max={100} value={form.uploadProgress} aria-label="Video upload progress" /> : null}
            </div>{form.uploadPhase === "uploading" ? <b>{form.uploadProgress}%</b> : null}
          </div> : null}
          {saveError ? <p className="upload-field-error" role="alert"><AlertTriangle aria-hidden="true" />Your draft couldn't be saved. {saveError} Your form is still here; try saving again.</p> : null}
          {studio.saveDraftMutation.isSuccess && !busy ? <p className="upload-save-note" role="status"><Check aria-hidden="true" />Draft saved. Save again after making changes.</p> : null}
          <footer className="upload-form-footer">
            <div className="upload-footer-secondary">
              {!isFirstStep ? <button type="button" className="upload-button" disabled={navigationLocked} onClick={() => { setAttemptedNext(false); setShowValidationErrors(false); prevStep(); }}><ChevronLeft aria-hidden="true" />Back</button> : !form.videoFile ? <span className="upload-muted">Choose a file to continue</span> : null}
              {form.videoFile ? <button type="button" className="upload-button upload-save" disabled={navigationLocked} onClick={() => studio.saveDraftMutation.mutate()}><Save aria-hidden="true" />Save draft</button> : null}
            </div>
            <button type="button" className="upload-button upload-button-primary" disabled={navigationLocked}
              onClick={isLastStep ? handlePublish : handleNext}>
              {busy ? "Please wait…" : isLastStep ? form.scheduleAt !== null ? "Schedule video" : "Publish video" : "Continue"}{!isLastStep ? <ChevronRight aria-hidden="true" /> : null}
            </button>
          </footer>
        </section>
        <PreviewPanel form={form} patch={patch} contentType={contentType} steps={steps} />
      </div>
    </div>
  </AppShell>;
}
