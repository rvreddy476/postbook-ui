"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, Info, X, type LucideIcon } from "lucide-react";

/*
  The studio's building blocks. One look for every step: a section is a
  title, one muted line and its body; grouped settings sit in one bordered
  list with dividers; choices are radio cards. Colour and type come from
  the theme only (upload.css reads the same tokens).
*/

/* ── Section ──────────────────────────────────────────── */

export function Section({
  title,
  subtitle,
  icon: Icon,
  required,
  aside,
  children,
  id,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  required?: boolean;
  aside?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  const headingId = useId();
  return (
    <section className="upload-section" aria-labelledby={headingId} id={id}>
      <header className="upload-section-head">
        {Icon ? <span className="upload-section-icon" aria-hidden="true"><Icon /></span> : null}
        <div className="min-w-0 flex-1">
          <h3 id={headingId}>
            {title}
            {required ? <span className="upload-required" aria-hidden="true">*</span> : null}
            {required ? <span className="upload-sr-only"> (required)</span> : null}
          </h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

/** A bordered list of settings rows with dividers between them. */
export function SettingsGroup({ children, invalid }: { children: ReactNode; invalid?: boolean }) {
  return <div className="upload-group" data-invalid={invalid || undefined}>{children}</div>;
}

/* ── Section Header (a bare heading, for a sub-part of a section) ── */

export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="upload-subhead">
      <h3>{title}</h3>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}

/* ── Field Label ──────────────────────────────────────── */

export function FieldLabel({
  label,
  required,
  hint,
  counter,
  htmlFor,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  counter?: string;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="upload-label">
      <span>
        {label}
        {required && <span className="upload-required" aria-label="required">*</span>}
      </span>
      {counter && <span className="upload-label-meta">{counter}</span>}
      {hint && !counter && <span className="upload-label-meta">{hint}</span>}
    </label>
  );
}

/* ── Toggle Switch ────────────────────────────────────── */

export function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
  describedBy,
  id,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  label?: string;
  describedBy?: string;
  id?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-label={label}
      aria-checked={checked}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="upload-switch"
      data-on={checked || undefined}
    >
      <span aria-hidden="true" />
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
  id,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  id?: string;
}) {
  const descriptionId = useId();
  return (
    <div className="upload-row">
      <div className="upload-row-text">
        <p className="upload-row-title">{label}</p>
        {description && <p id={descriptionId} className="upload-row-desc">{description}</p>}
      </div>
      <ToggleSwitch id={id} checked={checked} onChange={onChange} disabled={disabled} label={label} describedBy={description ? descriptionId : undefined} />
    </div>
  );
}

/* ── Radio Option (a row inside a SettingsGroup) ──────── */

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
    <label className="upload-radio-row" data-checked={checked || undefined}>
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <span className="upload-row-text">
        <span className="upload-row-title">{label}</span>
        {description && <span className="upload-row-desc">{description}</span>}
      </span>
    </label>
  );
}

/* ── Choice Card (radio card, for the few big choices) ── */

export function ChoiceCard({
  label,
  description,
  checked,
  onChange,
  name,
  icon: Icon,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
  name: string;
  icon?: LucideIcon;
}) {
  return (
    <label className="upload-choice" data-checked={checked || undefined}>
      {Icon ? <span className="upload-choice-icon" aria-hidden="true"><Icon /></span> : null}
      <span className="upload-row-text">
        <span className="upload-row-title">{label}</span>
        {description && <span className="upload-row-desc">{description}</span>}
      </span>
      <input type="radio" name={name} checked={checked} onChange={onChange} />
    </label>
  );
}

/* ── Info Banner ──────────────────────────────────────── */

export function InfoBanner({
  children,
  variant = "info",
}: {
  children: ReactNode;
  variant?: "info" | "warning" | "error";
}) {
  return (
    <div className="upload-banner" data-variant={variant}>
      <Info aria-hidden="true" />
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
    <span className="upload-chip">
      {label}
      {onRemove && (
        <button type="button" aria-label={`Remove ${label}`} onClick={onRemove}>
          <X aria-hidden="true" />
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
  title: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  return (
    <div className="upload-collapsible">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={bodyId}>
        <span className="min-w-0 flex-1">{title}</span>
        <ChevronDown aria-hidden="true" data-open={open || undefined} />
      </button>
      {open && <div id={bodyId} className="upload-collapsible-body">{children}</div>}
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
  id,
  required,
  invalid,
  describedBy,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
  id?: string;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <input
      id={id}
      required={required}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={maxLength}
      autoFocus={autoFocus}
      className="upload-input"
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
  id,
  required,
  invalid,
  describedBy,
  label,
}: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  id?: string;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  label?: string;
}) {
  return (
    <div className="upload-select">
      <select
        id={id}
        required={required}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="upload-input"
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" />
    </div>
  );
}
