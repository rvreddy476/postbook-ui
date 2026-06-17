"use client";

import { useState } from "react";
import { ChevronDown, Info, X } from "lucide-react";

/* ── Section Header ───────────────────────────────────── */

export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-[14px] font-bold text-brand-text">{title}</h3>
      {subtitle && <p className="mt-0.5 text-[12px] text-brand-text/50">{subtitle}</p>}
    </div>
  );
}

/* ── Field Label ──────────────────────────────────────── */

export function FieldLabel({
  label,
  required,
  hint,
  counter,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  counter?: string;
}) {
  return (
    <label className="mb-1.5 flex items-center justify-between">
      <span className="text-[12px] font-semibold text-brand-text/60">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </span>
      {counter && <span className="text-[11px] text-brand-text/30">{counter}</span>}
      {hint && !counter && <span className="text-[11px] text-brand-text/50">{hint}</span>}
    </label>
  );
}

/* ── Toggle Switch ────────────────────────────────────── */

export function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-text/40 disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? "bg-brand-text" : "bg-brand-text/10"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-brand-card shadow-sm transition-transform duration-200 ${
          checked ? "translate-x-[22px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

/* ── Toggle Row (label + description + switch) ────────── */

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-brand-text">{label}</p>
        {description && <p className="mt-0.5 text-[11px] text-brand-text/50">{description}</p>}
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

/* ── Radio Option ─────────────────────────────────────── */

export function RadioOption({
  label,
  description,
  checked,
  onChange,
  name,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
  name: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-brand-secondary">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 accent-brand-text"
      />
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-brand-text">{label}</p>
        {description && <p className="mt-0.5 text-[11px] text-brand-text/50">{description}</p>}
      </div>
    </label>
  );
}

/* ── Check Option ─────────────────────────────────────── */

export function CheckOption({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-brand-secondary">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded accent-brand-text"
      />
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-brand-text">{label}</p>
        {description && <p className="mt-0.5 text-[11px] text-brand-text/50">{description}</p>}
      </div>
    </label>
  );
}

/* ── Info Banner ──────────────────────────────────────── */

export function InfoBanner({
  children,
  variant = "info",
}: {
  children: React.ReactNode;
  variant?: "info" | "warning" | "error";
}) {
  const colors = {
    info: "bg-brand-secondary border-brand-divider text-brand-text/60",
    warning: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30 text-amber-800 dark:text-amber-400",
    error: "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/30 text-rose-700 dark:text-rose-400",
  };
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[12px] ${colors[variant]}`}>
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />
      <div>{children}</div>
    </div>
  );
}

/* ── Tag Chip ─────────────────────────────────────────── */

export function TagChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove?: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-secondary px-2.5 py-1 text-[11px] font-medium text-brand-text/60">
      {label}
      {onRemove && (
        <button type="button" onClick={onRemove} className="hover:text-rose-500 transition-colors">
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

/* ── Collapsible ──────────────────────────────────────── */

export function Collapsible({
  title,
  defaultOpen = false,
  children,
}: {
  title: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-brand-text/10">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-[13px] font-semibold text-brand-text hover:bg-brand-secondary rounded-xl transition-colors"
      >
        {title}
        <ChevronDown className={`h-4 w-4 text-brand-text/50 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-brand-text/10 px-4 py-3">{children}</div>}
    </div>
  );
}

/* ── Studio Input (shared input styling) ──────────────── */

export function StudioInput({
  value,
  onChange,
  placeholder,
  maxLength,
  autoFocus,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={maxLength}
      autoFocus={autoFocus}
      className="h-11 w-full rounded-xl border border-brand-text/10 bg-brand-secondary px-4 text-[14px] text-brand-text placeholder:text-brand-text/30 outline-none focus:border-brand-text focus:bg-brand-card focus:ring-2 focus:ring-brand-text/10 transition-all"
      placeholder={placeholder}
    />
  );
}

/* ── Studio Textarea ──────────────────────────────────── */

export function StudioTextarea({
  value,
  onChange,
  placeholder,
  maxLength,
  rows = 4,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={maxLength}
      rows={rows}
      className="w-full rounded-xl border border-brand-text/10 bg-brand-secondary px-4 py-3 text-[13px] text-brand-text placeholder:text-brand-text/30 outline-none focus:border-brand-text focus:bg-brand-card focus:ring-2 focus:ring-brand-text/10 resize-none transition-all"
      placeholder={placeholder}
    />
  );
}

/* ── Studio Select ────────────────────────────────────── */

export function StudioSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full appearance-none rounded-xl border border-brand-text/10 bg-brand-secondary px-4 pr-9 text-[13px] text-brand-text outline-none focus:border-brand-text focus:bg-brand-card focus:ring-2 focus:ring-brand-text/10 transition-all"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text/50" />
    </div>
  );
}
