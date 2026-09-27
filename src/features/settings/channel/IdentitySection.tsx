import { Camera, Check, ImageIcon, Loader2, Trash2 } from "lucide-react";

import { ABOUT_MAX, HANDLE_MAX, NAME_MAX } from "./model";
import { Card, Field, iconButtonClass, inputClass, inputErrorClass, pillButtonClass, textareaClass } from "./ui";
import type { HandleAvailability, IdentityProps } from "./view";

function pickFile(e: React.ChangeEvent<HTMLInputElement>, onPick: (f: File) => void) {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (file) onPick(file);
}

function AvailabilityNote({ a, handle }: { a: HandleAvailability; handle: string }) {
  switch (a.state) {
    case "checking":
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Checking
        </span>
      );
    case "available":
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
          <Check className="h-3 w-3" /> @{handle} is free
        </span>
      );
    case "taken":
      return (
        <span className="text-[11px] font-medium text-danger">
          @{handle} is taken{a.suggestion ? ` — try @${a.suggestion}` : ""}
        </span>
      );
    default:
      return null;
  }
}

export function IdentitySection(p: IdentityProps) {
  const { draft, errors, uploading } = p;
  const handleError = errors.handle ?? (p.availability.state === "taken" ? "That handle is taken." : undefined);

  return (
    <Card id="identity" title="Identity" hint="Picture, banner, name and handle — what a viewer sees first on your channel.">
      <div className="space-y-5">
        {/* Banner: a 3:1 strip, never a hero. */}
        <Field label="Banner" hint="A wide image, 3:1. Shown as a strip above your channel.">
          <div className="relative w-full overflow-hidden rounded-xl border border-border bg-brand-secondary" style={{ aspectRatio: "3 / 1" }}>
            {p.bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.bannerUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground">
                <ImageIcon className="h-5 w-5" />
                <span className="text-[11px]">No banner yet</span>
              </div>
            )}
            {uploading.banner ? (
              <div className="absolute inset-0 flex items-center justify-center bg-brand-card/70">
                <Loader2 className="h-5 w-5 animate-spin text-brand-text" />
              </div>
            ) : null}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <label className={pillButtonClass}>
              <Camera className="h-3.5 w-3.5" />
              {draft.banner_media_id ? "Replace banner" : "Upload banner"}
              <input type="file" accept="image/*" className="sr-only" disabled={uploading.banner} onChange={(e) => pickFile(e, p.onPickBanner)} />
            </label>
            {draft.banner_media_id ? (
              <button type="button" className={pillButtonClass} onClick={p.onRemoveBanner} disabled={uploading.banner}>
                <Trash2 className="h-3.5 w-3.5" /> Remove banner
              </button>
            ) : null}
          </div>
          {errors.banner_media_id ? (
            <p role="alert" className="mt-1 text-[11px] text-danger">
              {errors.banner_media_id}
            </p>
          ) : null}
        </Field>

        {/* Picture */}
        <Field label="Picture" hint="Square, at least 256 px. PNG or JPG.">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-border bg-brand-secondary">
              {p.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-[20px] font-semibold text-muted-foreground">{(draft.name || "?").charAt(0).toUpperCase()}</div>
              )}
              {uploading.avatar ? (
                <div className="absolute inset-0 flex items-center justify-center bg-brand-card/70">
                  <Loader2 className="h-4 w-4 animate-spin text-brand-text" />
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <label className={pillButtonClass}>
                <Camera className="h-3.5 w-3.5" />
                {draft.avatar_media_id ? "Replace picture" : "Upload picture"}
                <input type="file" accept="image/*" className="sr-only" disabled={uploading.avatar} onChange={(e) => pickFile(e, p.onPickAvatar)} />
              </label>
              {draft.avatar_media_id ? (
                <button type="button" aria-label="Remove picture" className={iconButtonClass} onClick={p.onRemoveAvatar} disabled={uploading.avatar}>
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
          {errors.avatar_media_id ? (
            <p role="alert" className="mt-1 text-[11px] text-danger">
              {errors.avatar_media_id}
            </p>
          ) : null}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="branding-name" error={errors.name} meta={`${Array.from(draft.name).length}/${NAME_MAX}`}>
            <input
              id="branding-name"
              value={draft.name}
              maxLength={NAME_MAX}
              autoComplete="off"
              onChange={(e) => p.onChange("name", e.target.value)}
              className={`${inputClass} ${errors.name ? inputErrorClass : ""}`}
              placeholder="Your channel's name"
            />
          </Field>

          <Field
            label="Handle"
            htmlFor="branding-handle"
            error={handleError}
            hint="Letters, digits, dots and underscores. Your channel's address."
            meta={<AvailabilityNote a={p.availability} handle={draft.handle} />}
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">@</span>
              <input
                id="branding-handle"
                value={draft.handle}
                maxLength={HANDLE_MAX}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => p.onChange("handle", e.target.value)}
                className={`${inputClass} pl-7 ${handleError ? inputErrorClass : ""}`}
                placeholder="handle"
              />
            </div>
          </Field>
        </div>

        <Field label="About" htmlFor="branding-about" error={errors.about} hint="A short line about what you make." meta={`${Array.from(draft.about).length}/${ABOUT_MAX}`}>
          <textarea
            id="branding-about"
            value={draft.about}
            rows={3}
            maxLength={ABOUT_MAX}
            onChange={(e) => p.onChange("about", e.target.value)}
            className={`${textareaClass} ${errors.about ? inputErrorClass : ""}`}
            placeholder="What viewers can expect here"
          />
        </Field>
      </div>
    </Card>
  );
}
