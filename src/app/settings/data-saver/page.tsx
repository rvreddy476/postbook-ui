"use client";

import AppShell from "@/components/AppShell";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CircleSlash,
  Database,
  Image as ImageIcon,
  Signal,
  Video,
} from "lucide-react";

import { useDataSaver } from "@/hooks/useDataSaver";

/* ------------------------------------------------------------------ */
/*  Toggle Switch                                                       */
/* ------------------------------------------------------------------ */

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent",
        "transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-text/50 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-brand-text" : "bg-brand-secondary",
      ].join(" ")}
    >
      <span
        className={[
          "pointer-events-none inline-block h-5 w-5 rounded-full bg-brand-bg shadow-md",
          "transform transition-transform duration-200 ease-in-out",
          checked ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Section Card                                                        */
/* ------------------------------------------------------------------ */

function SectionCard({
  icon,
  title,
  description,
  children,
  delay = 0,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-2xl bg-brand-card border border-brand-divider shadow-sm"
    >
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-text/5">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-brand-text">{title}</h2>
            <p className="mt-1 text-sm text-brand-highlight">{description}</p>
          </div>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Toggle Row                                                          */
/* ------------------------------------------------------------------ */

function ToggleRow({
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={[
        "flex items-start gap-4 py-3",
        disabled ? "opacity-60" : "",
      ].join(" ")}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-brand-text">{title}</p>
        <p className="mt-0.5 text-xs text-brand-highlight">{description}</p>
      </div>
      <ToggleSwitch
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        ariaLabel={title}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Info Row                                                            */
/* ------------------------------------------------------------------ */

function InfoRow({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-secondary text-brand-highlight">
        {icon}
      </div>
      <p className="text-sm text-brand-text">{label}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                           */
/* ------------------------------------------------------------------ */

export default function DataSaverSettingsPage() {
  const {
    enabled,
    setEnabled,
    autoOnSlowConnection,
    setAutoOnSlowConnection,
    effective,
    effectiveType,
  } = useDataSaver();

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <Link
            href="/settings"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-text/10 hover:bg-brand-text/15 transition-colors"
            aria-label="Back to settings"
          >
            <ArrowLeft className="h-5 w-5 text-brand-text" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-text">Data saver</h1>
            <p className="text-sm text-brand-highlight">
              Reduce mobile-data use across reels, Posttube, and the feed.
            </p>
          </div>
        </motion.div>

        {/* Mode card */}
        <SectionCard
          icon={<Database className="h-6 w-6 text-brand-text/50" />}
          title="Mode"
          description="Off by default. Turn on whenever you are roaming or on a capped data plan."
          delay={0.05}
        >
          <div className="divide-y divide-brand-divider">
            <ToggleRow
              title="Save data"
              description="Suppresses video autoplay and lowers image quality across the app."
              checked={enabled}
              onChange={(next) => setEnabled(next, "manual")}
            />
            <ToggleRow
              title="Auto-enable on slow connection"
              description={
                enabled
                  ? "Activates automatically when the browser reports a 2G or slow-2G connection."
                  : "Turn on Save data first to enable."
              }
              checked={autoOnSlowConnection}
              onChange={setAutoOnSlowConnection}
              disabled={!enabled}
            />
          </div>
        </SectionCard>

        {/* What it does */}
        <SectionCard
          icon={<CircleSlash className="h-6 w-6 text-brand-text/50" />}
          title="When data saver is on"
          description="What changes while this mode is active."
          delay={0.1}
        >
          <div className="divide-y divide-brand-divider">
            <InfoRow
              icon={<Video className="h-4 w-4" />}
              label="Videos won't autoplay"
            />
            <InfoRow
              icon={<Signal className="h-4 w-4" />}
              label="Reels capped at 240p"
            />
            <InfoRow
              icon={<ImageIcon className="h-4 w-4" />}
              label="Images compressed (0.5x)"
            />
          </div>
        </SectionCard>

        {/* Status banner */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className={[
            "rounded-2xl border p-4 text-sm",
            effective
              ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700"
              : "border-brand-divider bg-brand-card text-brand-highlight",
          ].join(" ")}
        >
          <p className="font-semibold">
            {effective
              ? "Data saver is active right now."
              : "Data saver is off."}
          </p>
          {effectiveType ? (
            <p className="mt-1 text-xs opacity-80">
              Network reported as <code>{effectiveType}</code>.
            </p>
          ) : null}
        </motion.div>
      </div>
    </AppShell>
  );
}
