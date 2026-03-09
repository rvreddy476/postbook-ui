"use client";

import { useState } from "react";
import { ChevronDown, Info, X } from "lucide-react";

/* ── Section Header ───────────────────────────────────── */

export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-[14px] font-bold text-[#1A1A1A]">{title}</h3>
      {subtitle && <p className="mt-0.5 text-[12px] text-[#9E9E9E]">{subtitle}</p>}
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
      <span className="text-[12px] font-semibold text-[#6B6B6B]">
        {label}
        {required && <span className="ml-0.5 text-[#E8527A]">*</span>}
      </span>
      {counter && <span className="text-[11px] text-[#BFBFBF]">{counter}</span>}
      {hint && !counter && <span className="text-[11px] text-[#9E9E9E]">{hint}</span>}
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
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFC]/40 disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? "bg-[#7C5CFC]" : "bg-[#E8E6E1]"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
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
        <p className="text-[13px] font-medium text-[#1A1A1A]">{label}</p>
        {description && <p className="mt-0.5 text-[11px] text-[#9E9E9E]">{description}</p>}
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
    <label className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[#FAFAF8]">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 accent-[#7C5CFC]"
      />
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-[#1A1A1A]">{label}</p>
        {description && <p className="mt-0.5 text-[11px] text-[#9E9E9E]">{description}</p>}
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
    <label className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[#FAFAF8]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded accent-[#7C5CFC]"
      />
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-[#1A1A1A]">{label}</p>
        {description && <p className="mt-0.5 text-[11px] text-[#9E9E9E]">{description}</p>}
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
    info: "bg-[#EDE9FE] border-[#7C5CFC]/20 text-[#6B6B6B]",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    error: "bg-red-50 border-red-200 text-red-800",
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
    <span className="inline-flex items-center gap-1 rounded-full bg-[#F5F4F1] px-2.5 py-1 text-[11px] font-medium text-[#6B6B6B]">
      {label}
      {onRemove && (
        <button type="button" onClick={onRemove} className="hover:text-[#E8527A] transition-colors">
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
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-[#E8E6E1]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-[13px] font-semibold text-[#1A1A1A] hover:bg-[#FAFAF8] rounded-xl transition-colors"
      >
        {title}
        <ChevronDown className={`h-4 w-4 text-[#9E9E9E] transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-[#E8E6E1] px-4 py-3">{children}</div>}
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
      className="h-11 w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-4 text-[14px] text-[#1A1A1A] placeholder:text-[#BFBFBF] outline-none focus:border-[#7C5CFC] focus:bg-white focus:ring-2 focus:ring-[#7C5CFC]/10 transition-all"
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
      className="w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-4 py-3 text-[13px] text-[#1A1A1A] placeholder:text-[#BFBFBF] outline-none focus:border-[#7C5CFC] focus:bg-white focus:ring-2 focus:ring-[#7C5CFC]/10 resize-none transition-all"
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
        className="h-11 w-full appearance-none rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-4 pr-9 text-[13px] text-[#1A1A1A] outline-none focus:border-[#7C5CFC] focus:bg-white focus:ring-2 focus:ring-[#7C5CFC]/10 transition-all"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9E9E9E]" />
    </div>
  );
}
