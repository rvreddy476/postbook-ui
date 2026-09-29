import Link from "next/link";
import { ArrowRight, Check, CircleDollarSign, Loader2, RotateCcw } from "lucide-react";

import { HANDLE_MAX, NAME_MAX } from "./model";
import { IdentitySection } from "./IdentitySection";
import { LinksSection } from "./LinksSection";
import { FeaturedSection } from "./FeaturedSection";
import { FeedSection } from "./FeedSection";
import { Field, inputClass, inputErrorClass, primaryButtonClass } from "./ui";
import { SECTIONS, type BrandingScreenProps, type HandleAvailability, type NoChannelProps, type SaveBarProps, type SectionId } from "./view";

/*
  Branding — the presentational page. One scrolling column of four
  sections (Identity, Links, Featured, RSS feed) with a small sticky section nav on
  the left at ≥1024px, a Monetization link card at the end, and one sticky
  Save bar at the bottom. No hooks here: the container feeds it data.
*/

function PageHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="mb-5">
      <Link href="/settings" className="text-[12px] text-muted-foreground hover:text-brand-text">
        ← Settings
      </Link>
      <h1 className="mt-1 text-[20px] font-semibold tracking-tight text-brand-text">Branding</h1>
      <p className="mt-0.5 text-[13px] text-muted-foreground">How your channel looks to viewers.</p>
      {children}
    </header>
  );
}

export function SectionNav({ active }: { active: SectionId }) {
  return (
    <nav aria-label="Branding sections" className="sticky top-4 hidden w-[160px] shrink-0 self-start lg:block">
      <ol className="space-y-0.5">
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              aria-current={active === s.id ? "location" : undefined}
              className={`block rounded-lg px-3 py-1.5 text-[13px] transition-colors ${active === s.id ? "bg-brand-secondary font-semibold text-brand-text" : "text-muted-foreground hover:bg-brand-secondary/60 hover:text-brand-text"}`}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ol>
      <div className="my-2 h-px bg-border" />
      <Link href="/monetization" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-brand-secondary/60 hover:text-brand-text">
        Monetization <ArrowRight className="h-3 w-3" />
      </Link>
    </nav>
  );
}

export function MonetizationCard() {
  return (
    <Link
      href="/monetization"
      className="flex items-center gap-3 rounded-2xl border border-border bg-brand-card p-4 transition-colors hover:bg-brand-secondary/40 sm:p-5"
      data-monetization-card
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-secondary text-brand-text">
        <CircleDollarSign className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold text-brand-text">Monetization</span>
        <span className="block text-[11px] text-muted-foreground">Memberships, tips and payouts have their own page.</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

export function SaveBar(p: SaveBarProps) {
  const disabled = !p.dirty || p.saving || p.errorCount > 0;
  const status = p.saving
    ? "Saving"
    : p.errorCount > 0
      ? `${p.errorCount} ${p.errorCount === 1 ? "field needs" : "fields need"} attention`
      : p.dirty
        ? `${p.changeCount} ${p.changeCount === 1 ? "change" : "changes"}`
        : "No changes";
  return (
    <div className="sticky bottom-0 z-20 mt-6 border-t border-border bg-canvas/95 px-1 py-3 backdrop-blur" data-save-bar>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[12px] ${p.errorCount > 0 ? "text-danger" : "text-muted-foreground"}`} aria-live="polite">
            {status}
          </p>
          {p.pageMessage ? (
            <p role="alert" className="truncate text-[11px] text-danger">
              {p.pageMessage}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={p.onReset} disabled={!p.dirty || p.saving} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-brand-text transition-colors hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-40">
            <RotateCcw className="h-3.5 w-3.5" /> Discard
          </button>
          <button data-save-action="true" type="button" onClick={p.onSave} disabled={disabled} className={primaryButtonClass}>
            {p.saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateAvailability({ a, handle }: { a: HandleAvailability; handle: string }) {
  if (a.state === "checking") return <span className="text-[11px] text-muted-foreground">Checking</span>;
  if (a.state === "available") return <span className="text-[11px] font-medium text-success">@{handle} is free</span>;
  if (a.state === "taken") return <span className="text-[11px] font-medium text-danger">@{handle} is taken{a.suggestion ? ` — try @${a.suggestion}` : ""}</span>;
  return null;
}

export function NoChannelCard(p: NoChannelProps) {
  const handleError = p.errors.handle ?? (p.availability.state === "taken" ? "That handle is taken." : undefined);
  const disabled = p.creating || p.availability.state === "checking" || p.availability.state === "taken";
  return (
    <section className="rounded-2xl border border-border bg-brand-card p-5" aria-labelledby="create-channel-title" data-no-channel>
      <h2 id="create-channel-title" className="text-[14px] font-bold text-brand-text">
        Create your channel
      </h2>
      <p className="mt-0.5 text-[11px] text-muted-foreground">A name and a handle are all it takes. You can change both later.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="create-name" error={p.errors.name} meta={`${Array.from(p.name).length}/${NAME_MAX}`}>
          <input id="create-name" value={p.name} maxLength={NAME_MAX} onChange={(e) => p.onChange("name", e.target.value)} className={`${inputClass} ${p.errors.name ? inputErrorClass : ""}`} placeholder="Your channel's name" />
        </Field>
        <Field label="Handle" htmlFor="create-handle" error={handleError} meta={<CreateAvailability a={p.availability} handle={p.handle} />}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">@</span>
            <input id="create-handle" value={p.handle} maxLength={HANDLE_MAX} spellCheck={false} onChange={(e) => p.onChange("handle", e.target.value)} className={`${inputClass} pl-7 ${handleError ? inputErrorClass : ""}`} placeholder="handle" />
          </div>
        </Field>
      </div>
      {p.pageMessage ? (
        <p role="alert" className="mt-3 text-[11px] text-danger">
          {p.pageMessage}
        </p>
      ) : null}
      <div className="mt-4 flex justify-end">
        <button type="button" className={primaryButtonClass} disabled={disabled} onClick={p.onCreate}>
          {p.creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Create channel
        </button>
      </div>
    </section>
  );
}

export function BrandingScreen(props: BrandingScreenProps) {
  const shell = (children: React.ReactNode) => <div className="mx-auto w-full max-w-[1040px] px-4 py-5 sm:px-6">{children}</div>;

  if (props.kind === "loading") {
    return shell(
      <>
        <PageHeader />
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </>,
    );
  }
  if (props.kind === "signed-out") {
    return shell(
      <>
        <PageHeader />
        <p className="py-12 text-center text-[13px] text-muted-foreground">Sign in to shape your channel.</p>
      </>,
    );
  }
  if (props.kind === "error") {
    return shell(
      <>
        <PageHeader />
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-[13px] text-muted-foreground">{props.message}</p>
          <button type="button" className={primaryButtonClass} onClick={props.onRetry}>
            Try again
          </button>
        </div>
      </>,
    );
  }
  if (props.kind === "no-channel") {
    return shell(
      <>
        <PageHeader />
        <div className="space-y-4">
          <NoChannelCard {...props.create} />
          <MonetizationCard />
        </div>
      </>,
    );
  }

  return shell(
    <>
      <PageHeader />
      <div className="flex gap-8">
        <SectionNav active={props.activeSection} />
        <div className="min-w-0 flex-1">
          <div className="space-y-4">
            <IdentitySection {...props.identity} />
            <LinksSection {...props.links} />
            <FeaturedSection {...props.featured} />
            <FeedSection {...props.feed} />
            <MonetizationCard />
          </div>
          <SaveBar {...props.save} />
        </div>
      </div>
    </>,
  );
}
