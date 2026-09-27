import type { ReactNode } from "react";

/** A small mark, an 18px title and one 12px line under it; anything on the right goes in `aside`. */
export function PageHead({ icon, title, sub, aside }: { icon: ReactNode; title: string; sub?: string; aside?: ReactNode }) {
  return (
    <header className="disco-head">
      <span className="disco-head__mark" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <h1 className="disco-head__title">{title}</h1>
        {sub ? <p className="disco-head__sub">{sub}</p> : null}
      </div>
      {aside ? <div className="disco-head__aside">{aside}</div> : null}
    </header>
  );
}
