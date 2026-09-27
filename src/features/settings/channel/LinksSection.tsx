import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { MAX_LINK_TITLE, MAX_LINKS } from "./model";
import { Card, Field, iconButtonClass, inputClass, inputErrorClass, pillButtonClass } from "./ui";
import type { LinksProps } from "./view";

export function LinksSection(p: LinksProps) {
  const { links, errors } = p;
  const rows = errors.linkRows ?? {};
  const full = links.length >= MAX_LINKS;

  return (
    <Card id="links" title="Links" hint={`Up to ${MAX_LINKS} links on your channel, in this order. https only.`}>
      <div className="space-y-3">
        {links.length === 0 ? <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[12px] text-muted-foreground">No links yet.</p> : null}

        <ol className="space-y-2">
          {links.map((link, i) => {
            const rowErr = rows[i] ?? {};
            return (
              <li key={i} className="rounded-xl border border-border bg-brand-secondary/40 p-2.5">
                <div className="flex items-start gap-2">
                  <span className="mt-2 w-5 shrink-0 text-center text-[11px] tabular-nums text-muted-foreground">{i + 1}</span>
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                    <div>
                      <input
                        aria-label={`Link ${i + 1} title`}
                        value={link.title}
                        maxLength={MAX_LINK_TITLE}
                        onChange={(e) => p.onLinkChange(i, "title", e.target.value)}
                        className={`${inputClass} ${rowErr.title ? inputErrorClass : ""}`}
                        placeholder="Title"
                      />
                      {rowErr.title ? (
                        <p role="alert" className="mt-1 text-[11px] text-danger">
                          {rowErr.title}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <input
                        aria-label={`Link ${i + 1} address`}
                        value={link.url}
                        inputMode="url"
                        spellCheck={false}
                        onChange={(e) => p.onLinkChange(i, "url", e.target.value)}
                        className={`${inputClass} ${rowErr.url ? inputErrorClass : ""}`}
                        placeholder="https://"
                      />
                      {rowErr.url ? (
                        <p role="alert" className="mt-1 text-[11px] text-danger">
                          {rowErr.url}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <button type="button" aria-label={`Move link ${i + 1} up`} className={iconButtonClass} disabled={i === 0} onClick={() => p.onMoveLink(i, "up")}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" aria-label={`Move link ${i + 1} down`} className={iconButtonClass} disabled={i === links.length - 1} onClick={() => p.onMoveLink(i, "down")}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" aria-label={`Remove link ${i + 1}`} className={iconButtonClass} onClick={() => p.onRemoveLink(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="flex items-center justify-between gap-3">
          <button type="button" className={pillButtonClass} onClick={p.onAddLink} disabled={full}>
            <Plus className="h-3.5 w-3.5" /> Add link
          </button>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {links.length}/{MAX_LINKS}
          </span>
        </div>
        {errors.links && !Object.keys(rows).length ? (
          <p role="alert" className="text-[11px] text-danger">
            {errors.links}
          </p>
        ) : null}

        <div className="border-t border-border pt-4">
          <Field label="Contact email" htmlFor="branding-contact-email" error={errors.contact_email} hint="Shown on your channel for business enquiries. Leave empty to hide it.">
            <input
              id="branding-contact-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={p.contactEmail}
              onChange={(e) => p.onContactEmailChange(e.target.value)}
              className={`${inputClass} ${errors.contact_email ? inputErrorClass : ""}`}
              placeholder="you@example.com"
            />
          </Field>
        </div>
      </div>
    </Card>
  );
}
