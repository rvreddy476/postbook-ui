"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Smartphone, X } from "lucide-react";

import { bannerDecision, bannerLinks, DISMISS_STORAGE_KEY, type BannerDecision } from "../openInApp";
import { newShareRef, shareRefOf } from "../shareRef";

/*
  "Open in app" — a small bar pinned to the bottom of a shared page on a
  phone (founder, 21 Oct 2026). Rules in ../openInApp: shared routes only,
  Android or iOS user agent AND a phone-width viewport, gone for a week once
  dismissed (localStorage, every read and write in try/catch).

  Pinned, not in flow, so it never moves the page: fixed to the bottom with
  a fixed height. Nothing is decided on the server (the user agent is only
  read after mount), so the HTML is the same for everyone and nothing shifts
  when the decision lands. Reduced motion: no slide-in.
*/

const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? "";
const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL ?? "";
const ANDROID_PACKAGE = process.env.NEXT_PUBLIC_ANDROID_PACKAGE ?? "";

function readDismissedAt(): number | null {
  try {
    const raw = window.localStorage.getItem(DISMISS_STORAGE_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeDismissedAt(now: number): void {
  try {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, String(now));
  } catch {
    /* storage unavailable: the banner just comes back next visit */
  }
}

export function OpenInAppBanner() {
  const pathname = usePathname();
  const [decision, setDecision] = useState<BannerDecision>({ show: false });
  const [pageUrl, setPageUrl] = useState("");
  const [ref, setRef] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    const decide = () =>
      setDecision(
        bannerDecision({
          pathname,
          userAgent: navigator.userAgent,
          width: window.innerWidth,
          dismissedAt: readDismissedAt(),
          now: Date.now(),
          playStoreUrl: PLAY_STORE_URL,
          appStoreUrl: APP_STORE_URL,
        }),
      );
    decide();
    // The link the banner opens is this page, with the ref it arrived with
    // (so an install can be attributed to the share) or a fresh one.
    setPageUrl(window.location.href);
    setRef(shareRefOf(window.location.search) ?? newShareRef());
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMotion = () => setReducedMotion(mq.matches);
    applyMotion();
    mq.addEventListener("change", applyMotion);
    window.addEventListener("resize", decide);
    return () => {
      mq.removeEventListener("change", applyMotion);
      window.removeEventListener("resize", decide);
    };
  }, [pathname]);

  if (!decision.show || !pageUrl) return null;

  const links = bannerLinks({ platform: decision.platform, pageUrl, ref, playStoreUrl: PLAY_STORE_URL, appStoreUrl: APP_STORE_URL, packageName: ANDROID_PACKAGE });
  const openHref = decision.openInApp ? links.openInApp : null;
  const getHref = decision.getTheApp ? links.getTheApp : null;
  if (!openHref && !getHref) return null;

  const dismiss = () => {
    writeDismissedAt(Date.now());
    setDecision({ show: false });
  };

  return (
    <div
      role="region"
      aria-label="Open in app"
      className={`fixed inset-x-0 bottom-0 z-100 flex h-16 items-center gap-3 border-t border-brand-divider bg-brand-card px-4 shadow-2xl ${reducedMotion ? "" : "animate-[open-in-app-rise_240ms_ease-out]"}`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)", boxSizing: "content-box" }}
    >
      <style>{`@keyframes open-in-app-rise { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-tint text-primary-ink" aria-hidden>
        <Smartphone className="h-5 w-5" />
      </span>
      <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-brand-text">
        Better in the app
      </p>
      {getHref ? (
        <a
          href={getHref}
          rel="noopener"
          className={`flex h-11 shrink-0 items-center rounded-full px-4 text-[13px] font-bold transition ${openHref ? "text-primary-ink hover:bg-brand-secondary" : "bg-primary-ink text-white hover:bg-primary-hover"}`}
        >
          Get the app
        </a>
      ) : null}
      {openHref ? (
        <a href={openHref} className="flex h-11 shrink-0 items-center rounded-full bg-primary-ink px-4 text-[13px] font-bold text-white transition hover:bg-primary-hover">
          Open in app
        </a>
      ) : null}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-brand-secondary hover:text-brand-text"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
