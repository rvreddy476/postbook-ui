import Link from "next/link";

/*
  The pill row every discovery screen narrows with: a radiogroup of small
  capsules, the chosen one filled with the text colour (the Reels chip
  convention), scrolling sideways on a phone. Two flavours: buttons that
  report a value, and links when the choice is a page of its own.
*/

export interface PillOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export interface PillRowProps<T extends string> {
  options: readonly PillOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the group ("Period", "Length"…). */
  name: string;
  /** Shown as a small uppercase word before the pills. */
  label?: string;
  className?: string;
  children?: React.ReactNode;
}

export function PillRow<T extends string>({ options, value, onChange, name, label, className, children }: PillRowProps<T>) {
  return (
    <div role="radiogroup" aria-label={name} className={`disco-pills${className ? ` ${className}` : ""}`}>
      {label ? <span className="disco-pills__label">{label}</span> : null}
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className="disco-pill"
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {typeof o.count === "number" ? <span className="disco-pills__count disco-pill__count">{o.count}</span> : null}
        </button>
      ))}
      {children}
    </div>
  );
}

export interface PillLink {
  href: string;
  label: string;
  current?: boolean;
}

export function PillLinks({ links, name, label }: { links: readonly PillLink[]; name: string; label?: string }) {
  return (
    <nav aria-label={name} className="disco-pills">
      {label ? <span className="disco-pills__label">{label}</span> : null}
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="disco-pill" aria-current={l.current ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
