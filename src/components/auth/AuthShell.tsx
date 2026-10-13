"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  MessageCircle,
  Moon,
  Sparkles,
  Sun,
  Users,
} from "lucide-react";
import "./auth.css";
import { authRedirect } from "./authRedirect";
import { partnerForDestination } from "./portalRoles";
import { RoleMenuLink } from "./RoleMenuLink";
import { CUSTOMER_ORIGIN, partnerAuthHref, type BusinessPartnerId } from "./partnerPortal";

/** Auth pages share the same theme preference as the signed-in header. */
function AppearanceToggle() {
  const [dark, setDark] = useState(false);
  useEffect(
    () => setDark(document.documentElement.classList.contains("dark")),
    [],
  );

  return (
    <button
      type="button"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.classList.toggle("dark", next);
        document.documentElement.classList.toggle("light", !next);
        document.documentElement.style.colorScheme = next ? "dark" : "light";
        try {
          localStorage.setItem("postbook_theme", next ? "dark" : "light");
        } catch {
          /* Still usable without storage. */
        }
      }}
      className="auth-icon-button"
    >
      {dark ? (
        <Sun size={18} aria-hidden="true" />
      ) : (
        <Moon size={18} aria-hidden="true" />
      )}
    </button>
  );
}

export function AuthShell({
  children,
  mode,
  redirectTo,
  partnerPortal = false,
  businessIds = [],
}: {
  children: ReactNode;
  mode: "login" | "register";
  redirectTo?: string;
  partnerPortal?: boolean;
  businessIds?: readonly BusinessPartnerId[];
}) {
  const destination = authRedirect(redirectTo ?? null);
  const partnerType = partnerForDestination(destination);
  const partner = partnerPortal || partnerType;
  const switchHref = partnerPortal ? partnerAuthHref(mode === "login" ? "register" : "login", businessIds, destination) : `${mode === "login" ? "/register" : "/login"}${destination === "/" ? "" : `?redirect=${encodeURIComponent(destination)}`}`;
  return (
    <div className="auth-page">
      <a href="#auth-form" className="auth-skip-link">
        Skip to form
      </a>
      <header className="auth-header">
        <Link href={partnerPortal ? "/partners" : "/"} className="auth-wordmark" aria-label={partnerPortal ? "Clee Partners home" : "VChat home"}>
          <span className="auth-brand-mark">
            {partnerPortal ? <BriefcaseBusiness size={21} strokeWidth={2.2} aria-hidden="true" /> : <MessageCircle size={21} strokeWidth={2.2} aria-hidden="true" />}
          </span>
          {partnerPortal ? "Clee Partners" : "VChat"}
          <span className="auth-wordmark-dot" aria-hidden="true">
            .
          </span>
        </Link>
        <div className="flex items-center gap-3 sm:gap-5">
          {!partnerPortal && <RoleMenuLink floating />}
          <Link
            href={switchHref}
            className="auth-header-link"
          >
            {mode === "login" ? partnerPortal ? "Register as a partner" : "Create an account" : "Sign in"}
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
          <AppearanceToggle />
        </div>
      </header>

      <main className="auth-layout">
        <aside className="auth-story" aria-label={partnerPortal ? "Welcome to Clee Partners" : "Welcome to VChat"}>
          <div>
            <p className="auth-eyebrow">
              <span aria-hidden="true" />
              {partner ? "YOUR EXPERTISE. YOUR WORKSPACE." : "YOUR PEOPLE. YOUR PERSPECTIVE."}
            </p>
            <h2 className="auth-headline">
              {partner ? "Build your business" : "Life is better"}
              <br />
              {partner ? <span>with us.</span> : <>when it’s <span>shared.</span></>}
            </h2>
            <p className="auth-story-description">
              {partnerPortal ? "Sell products, serve food, offer rides, deliver orders or bring your skills to people's homes. One partner account, with the right workspace and application for every business." : partnerType ? `${partnerType.label}. Sign in with your account, then complete the details and verification for your module. Existing partners go straight to their workspace.` : "The everyday moments. The big ideas. The conversations that become connections. Make room for all of them."}
            </p>
          </div>

          {!partner && <div className="auth-illustration" aria-hidden="true">
            <div className="auth-orbit auth-orbit-one" />
            <div className="auth-orbit auth-orbit-two" />
            <div className="auth-moment-card">
              <div className="flex items-center justify-between">
                <span className="auth-eyebrow">A LITTLE INSPIRATION</span>
                <Sparkles size={19} />
              </div>
              <p>
                Small moments.
                <br />
                <span>Great conversations.</span>
              </p>
              <div className="auth-moment-footer">
                <span>Make it yours</span>
                <ArrowUpRight size={20} />
              </div>
            </div>
            <div className="auth-conversation-chip">
              <MessageCircle size={19} />
              <span>It starts with a hello.</span>
            </div>
          </div>}

          <div className="auth-story-footer">
            <span>
              <Users size={17} aria-hidden="true" />
              {partner ? "One account. Multiple businesses." : "Find your people"}
            </span>
            <span>
              <Sparkles size={17} aria-hidden="true" />
              {partner ? "Verification before approval" : "Share your perspective"}
            </span>
          </div>
        </aside>

        <section
          id="auth-form"
          tabIndex={-1}
          className="auth-form-panel"
          aria-label={
            partnerPortal ? mode === "login" ? "Partner sign in" : "Register as a business partner" : mode === "login" ? "Sign in to VChat" : "Create your VChat account"
          }
        >
          <div className="auth-form-content">{children}</div>
          <footer className="auth-form-footer">
            <span>© {new Date().getFullYear()} {partnerPortal ? "Clee Partners" : "VChat"}</span>
            <nav aria-label="Legal">
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
              {partnerPortal && <a href={CUSTOMER_ORIGIN}>Customer portal</a>}
            </nav>
          </footer>
        </section>
      </main>
    </div>
  );
}

export function AuthAlert({
  children,
  id,
}: {
  children: ReactNode;
  id?: string;
}) {
  return (
    <div id={id} role="alert" className="auth-alert">
      {children}
    </div>
  );
}
