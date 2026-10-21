"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, ChevronLeft, ChevronRight, CloudUpload, Copy, ExternalLink, LayoutPanelTop, Save } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useGlobalToast } from "@/contexts/ToastContext";
import { AppShell } from "@/features/reels/components/AppShell";
import { ChannelCreatePrompt, studioNeedsChannel } from "@/features/posttube/channelGate/ChannelGate";
import { useMyChannel } from "@/hooks/useChannels";
import { followUpNotice, hubEditHref, publishFailure } from "./studioApi";
import { CONTENT_TYPE_META, STEP_META, isShortStudio, stepIntro, type ContentType } from "./tokens";
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
  const failure = publishFailure(studio.publishMutation.error);
  const publishError = failure?.message ?? null;
  const toast = useGlobalToast();
  const short = isShortStudio(contentType);

  // A reel or short over the shorts cap publishes as a long video, which
  // needs a channel; the page's own gate only covered long uploads.
  const classified = classifyVideo(form.videoDurationSec, form.videoWidth, form.videoHeight);
  const channelRequired = studioNeedsChannel(contentType, classified) || failure?.code === "CHANNEL_REQUIRED";
  const channelQuery = useMyChannel(channelRequired);
  const channelMissing = channelRequired && channelQuery.isSuccess && !channelQuery.data;
  const channelPromptRef = useRef<HTMLDivElement>(null);

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
          <p className="mt-0.5 text-[12px] text-muted-foreground">{notice.description}</p>
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
    // multiple publishes / create duplicate posts. The publish attempt (and
    // its Idempotency-Key) is made in the mutation on the first press.
    if (navigationLocked || form.publishSuccess) return;
    if (channelMissing) {
      requestAnimationFrame(() => channelPromptRef.current?.focus());
      return;
    }
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
            onChooseSound={studio.chooseSound}
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
    const scheduled = form.scheduleAt !== null;
    return (
      <AppShell sectionLabel="Upload">
        <div className="upload-studio">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mx-auto max-w-[480px] px-1 py-10 text-center"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-8 w-8 text-success" aria-hidden="true" />
            </div>
            <h2 className="mt-5 text-[20px] font-bold text-brand-text">
              {config.label} {scheduled ? "scheduled" : "published"}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
              {scheduled
                ? "It goes live at the time you chose, once processing has finished."
                : "It is processing now and will be watchable in a few minutes."}
            </p>
            {form.publishedEpisodeNum !== null && form.seriesChoice.kind !== "none" && (
              <p className="mt-2 text-[13px] text-muted-foreground" data-series-result>
                Added to {form.seriesChoice.title.trim() || "your series"} as episode {form.publishedEpisodeNum}.
              </p>
            )}
            {form.publishWarning && (
              <p className="upload-banner text-left" data-variant="warning" role="status">
                {form.publishWarning}
              </p>
            )}

            {postUrl && (
              <div className="mt-6 flex items-center gap-2 rounded-xl border border-border bg-brand-card px-3 py-2">
                <span className="flex-1 truncate text-left font-mono text-[12px] text-muted-foreground">{postUrl}</span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(postUrl)}
                  className="upload-icon-button"
                  aria-label="Copy link"
                  title="Copy link"
                >
                  <Copy aria-hidden="true" />
                </button>
              </div>
            )}

            {isLongVideo && form.publishedPostId && (
              <Link
                href={hubEditHref(form.publishedPostId, "elements")}
                className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-brand-card px-4 py-3 text-left transition-colors hover:bg-brand-secondary"
                data-link="hub-elements"
              >
                <LayoutPanelTop className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-brand-text">Add an end screen and cards</span>
                  <span className="block text-[11px] text-muted-foreground">In Creator Hub, next to chapters</span>
                </span>
              </Link>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href={isLongVideo ? "/posttube" : "/reels"} className="upload-button">
                <ExternalLink aria-hidden="true" />
                Go to {isLongVideo ? "PostTube" : "Reels"}
              </Link>
              <button type="button" onClick={studio.clearFile} className="upload-button upload-button-primary">
                Upload another
              </button>
            </div>
          </motion.div>
        </div>
      </AppShell>
    );
  }

  const intro = stepIntro(form.currentStep, contentType);
  const validationGroups = showValidationErrors && isLastStep ? allErrors : attemptedNext && currentStepErrors.length ? [{ step: form.currentStep, errors: currentStepErrors }] : [];
  const noun = short ? "reel" : contentType === "podcast" ? "podcast" : "video";
  const primaryLabel = busy ? "Please wait…" : isLastStep ? `${form.scheduleAt !== null ? "Schedule" : "Publish"} ${noun}` : "Continue";
  const draftSaved = !!form.draftId && studio.saveDraftMutation.isSuccess;

  return <AppShell sectionLabel="Upload">
    <div className="upload-studio">
      <header className="upload-page-head">
        <div className="min-w-0">
          <Link href={short ? "/reels" : "/posttube/hub"} className="upload-back"><ArrowLeft aria-hidden="true" />{short ? "Reels" : "Creator Hub"}</Link>
          <h1>{contentType === "podcast" ? "Upload a podcast" : short ? "Create a reel" : "Upload a video"}</h1>
          <p>{short ? "Publishes to Reels" : "Publishes to your PostTube channel"} · {steps.length} steps</p>
        </div>
        <span className="upload-session-status" data-saved={draftSaved || undefined}>
          {draftSaved ? <Check aria-hidden="true" /> : <CloudUpload aria-hidden="true" />}
          {form.draftId ? (draftSaved ? "Draft saved" : "Draft created") : "Not saved yet"}
        </span>
      </header>
      <StudioToolbar steps={steps} currentStep={form.currentStep} currentStepIndex={currentStepIndex} form={form} disabled={navigationLocked}
        onStepClick={(step) => { setAttemptedNext(false); setShowValidationErrors(false); goToStep(step); }} />
      <div className="upload-workspace">
        <section className="upload-form-card" aria-labelledby="upload-step-title">
          <div className="upload-step-heading">
            <div className="min-w-0">
              <span className="upload-eyebrow">Step {currentStepIndex + 1} of {steps.length} · {STEP_META[form.currentStep].label}</span>
              <h2 id="upload-step-title" ref={headingRef} tabIndex={-1}>{intro.title}</h2>
              <p>{intro.body}</p>
            </div>
            <span className="upload-required-note"><span className="upload-required" aria-hidden="true">*</span> Required</span>
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
          {channelMissing ? <div ref={channelPromptRef} tabIndex={-1} className="upload-channel-needed" data-upload-channel-needed>
            <ChannelCreatePrompt
              title="This one publishes as a long video"
              body="Videos longer than a short live on a channel. Create yours here; your upload and details stay as they are."
              onCreated={() => { void channelQuery.refetch(); studio.publishMutation.reset(); }}
            />
          </div> : null}
          <fieldset className="upload-step-fields" disabled={navigationLocked} aria-busy={navigationLocked || undefined}>
            <legend className="upload-sr-only">{intro.title}</legend>
            {renderStep()}
          </fieldset>
          {busy ? <div className="upload-transfer-status" role="status">
            <CloudUpload aria-hidden="true" /><div><strong>{studio.saveDraftMutation.isPending ? "Saving your draft…" : form.uploadPhase === "uploading" ? "Uploading your video…" : "Finishing publication…"}</strong>
            <span>Keep this page open. Your progress will appear here.</span>
            {form.uploadPhase === "uploading" ? <progress max={100} value={form.uploadProgress} aria-label="Video upload progress" /> : null}
            </div>{form.uploadPhase === "uploading" ? <b>{form.uploadProgress}%</b> : null}
          </div> : null}
          {saveError ? <p className="upload-field-error" role="alert"><AlertTriangle aria-hidden="true" />Your draft couldn&apos;t be saved. {saveError} Your form is still here; try saving again.</p> : null}
          {studio.saveDraftMutation.isSuccess && !busy ? <p className="upload-save-note" role="status"><Check aria-hidden="true" />Draft saved. Save again after making changes.</p> : null}
          <footer className="upload-form-footer">
            <div className="upload-footer-secondary">
              {!isFirstStep ? <button type="button" className="upload-button" disabled={navigationLocked} onClick={() => { setAttemptedNext(false); setShowValidationErrors(false); prevStep(); }}><ChevronLeft aria-hidden="true" />Back</button> : !form.videoFile ? <span className="upload-muted">Choose a file to continue</span> : null}
              {form.videoFile ? <button type="button" className="upload-button upload-button-quiet upload-save" disabled={navigationLocked} onClick={() => studio.saveDraftMutation.mutate()}><Save aria-hidden="true" />Save draft</button> : null}
            </div>
            <button type="button" className="upload-button upload-button-primary" disabled={navigationLocked}
              onClick={isLastStep ? handlePublish : handleNext}>
              {primaryLabel}{!isLastStep && !busy ? <ChevronRight aria-hidden="true" /> : null}
            </button>
          </footer>
        </section>
        <PreviewPanel form={form} contentType={contentType} steps={steps} channelName={channelQuery.data?.name ?? null} />
      </div>
    </div>
  </AppShell>;
}
