import type { ReactNode } from "react";

/* Small shared pieces for the Branding page: the card each section sits in,
   a labelled field, and the two input looks. Tokens only; 13px controls,
   11px meta, like the Reels screens. */

export const inputClass =
  "h-9 w-full rounded-lg border border-border bg-brand-secondary px-3 text-[13px] text-brand-text outline-hidden transition-colors placeholder:text-muted-foreground/70 focus:border-brand-accent focus:bg-brand-card";

export const textareaClass =
  "w-full resize-y rounded-lg border border-border bg-brand-secondary px-3 py-2 text-[13px] leading-relaxed text-brand-text outline-hidden transition-colors placeholder:text-muted-foreground/70 focus:border-brand-accent focus:bg-brand-card";

export const inputErrorClass = "border-danger focus:border-danger";

export const pillButtonClass =
  "inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-secondary px-3 text-[12px] font-semibold text-brand-text transition-colors hover:bg-brand-divider disabled:cursor-not-allowed disabled:opacity-40";

export const primaryButtonClass =
  "inline-flex h-9 items-center gap-1.5 rounded-full bg-primary-ink px-4 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40";

export const iconButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-brand-secondary hover:text-brand-text disabled:cursor-not-allowed disabled:opacity-30";

export function Card({ id, title, hint, children }: { id: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 rounded-2xl border border-border bg-brand-card p-4 sm:p-5">
      <header className="mb-4">
        <h2 id={`${id}-title`} className="text-[14px] font-bold text-brand-text">
          {title}
        </h2>
        {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
      </header>
      {children}
    </section>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  meta,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-[12px] font-semibold text-brand-text">
          {label}
        </label>
        {meta ? <span className="text-[11px] tabular-nums text-muted-foreground">{meta}</span> : null}
      </div>
      {children}
      {error ? (
        <p role="alert" className="mt-1 text-[11px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
