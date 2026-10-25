"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowDown, ArrowUp, GripVertical, Link2, Plus, Search, X } from "lucide-react";

import { Avatar } from "@/components/LetterAvatar";
import { useMentionSearch, type MentionCandidate } from "@/components/comments/useMentionSearch";
import {
  CREDIT_NAME_MAX,
  CREDIT_ROLE_MAX,
  CREDIT_STATUS_LABEL,
  CREDITS_MAX,
  GENRES_MAX,
  PRODUCTION_HOUSE_MAX,
  RELEASE_YEAR_MIN,
  SUGGESTED_ROLES,
  maxReleaseYear,
  moveCredit,
  newCreditRow,
  toggleGenre,
  type CreditDraft,
  type CreditUser,
  type CreditsForm,
  type CreditsProblem,
  type Genre,
} from "../creditsModel";
import "../credits.css";

/*
  The cast & crew editor, shared by the upload studio's Credits step and
  the Hub edit sheet. Controlled: the owner holds the CreditsForm and
  decides when it is sent. Rows reorder by dragging the handle or with
  the up/down buttons; a row may link a VChat account through the same
  people search @mentions use, and that person is asked to accept.
  `variant` borrows the surrounding screen's inputs and buttons.
*/

const CLASSES = {
  upload: {
    input: "upload-input",
    button: "upload-button upload-button-sm",
    icon: "upload-icon-button",
    hint: "upload-input-hint",
    error: "upload-field-error",
    label: "upload-label",
  },
  hub: {
    input: "hub-input",
    button: "hub-btn hub-btn-sm",
    icon: "hub-icon-btn",
    hint: "hub-hint",
    error: "hub-hint is-error",
    label: "hub-label",
  },
} as const;

export interface CreditsEditorProps {
  value: CreditsForm;
  onChange: (next: CreditsForm) => void;
  genres: readonly Genre[];
  genresLoading?: boolean;
  variant: "upload" | "hub";
  /** The Hub: each saved linked credit shows its status (Pending / Accepted / Declined). */
  showStatus?: boolean;
  /** The signed-in uploader: crediting yourself is accepted at once. */
  selfId?: string | null;
  problems?: readonly CreditsProblem[];
  showErrors?: boolean;
  /** Prefix for the field ids (the studio's error list focuses `upload-<field>`). */
  idPrefix?: string;
}

function toCreditUser(c: MentionCandidate): CreditUser {
  return { id: c.id, username: c.username, displayName: c.name || c.username, avatarUrl: c.avatar };
}

export function CreditsEditor({ value, onChange, genres, genresLoading, variant, showStatus = false, selfId = null, problems = [], showErrors = false, idPrefix = "credits" }: CreditsEditorProps) {
  const cls = CLASSES[variant];
  const rolesListId = useId();
  const nextKey = useRef(Math.max(1000, ...value.credits.map((c) => c.key + 1)));
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [armed, setArmed] = useState<number | null>(null);
  const [linking, setLinking] = useState<number | null>(null);
  const problemFor = (field: string) => (showErrors ? problems.find((p) => p.field === field) : undefined);

  const setCredits = (credits: CreditDraft[]) => onChange({ ...value, credits });
  const update = (key: number, patch: Partial<CreditDraft>) => setCredits(value.credits.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  const move = (from: number, to: number) => setCredits(moveCredit(value.credits, from, to));
  const full = value.credits.length >= CREDITS_MAX;
  const year = maxReleaseYear();

  return (
    <div className="credits-editor" data-variant={variant} data-editor="credits">
      <datalist id={rolesListId}>
        {SUGGESTED_ROLES.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>

      <div className="credits-editor__head">
        <span className={cls.label} id={`${idPrefix}-cast-label`}>
          Cast &amp; crew <span className="credits-editor__count">{value.credits.length}/{CREDITS_MAX}</span>
        </span>
        <button
          type="button"
          className={cls.button}
          disabled={full}
          onClick={() => setCredits([...value.credits, newCreditRow(nextKey.current++)])}
          id={`${idPrefix}-add`}
        >
          <Plus aria-hidden="true" /> Add a credit
        </button>
      </div>
      {value.credits.length === 0 ? <p className={cls.hint}>Optional. Name the people in and behind the video; viewers can search by them.</p> : null}

      <ol className="credits-editor__list" aria-labelledby={`${idPrefix}-cast-label`}>
        {value.credits.map((c, i) => {
          const nameProblem = problemFor(`credit-${c.key}-name`);
          const roleProblem = problemFor(`credit-${c.key}-role`);
          const label = c.name.trim() || `Credit ${i + 1}`;
          return (
            <li
              key={c.key}
              className="credits-row"
              draggable={armed === c.key}
              data-dragging={dragFrom === i || undefined}
              onDragStart={(e) => {
                setDragFrom(i);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(i));
              }}
              onDragOver={(e) => {
                if (dragFrom === null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragFrom !== null && dragFrom !== i) move(dragFrom, i);
                setDragFrom(null);
                setArmed(null);
              }}
              onDragEnd={() => {
                setDragFrom(null);
                setArmed(null);
              }}
            >
              <span
                className="credits-row__handle"
                aria-hidden="true"
                title="Drag to reorder"
                onPointerDown={() => setArmed(c.key)}
                onPointerUp={() => setArmed(null)}
              >
                <GripVertical />
              </span>
              <div className="credits-row__fields">
                <div className="credits-row__inputs">
                  <input
                    id={`${idPrefix}-credit-${c.key}-name`}
                    className={cls.input}
                    value={c.name}
                    maxLength={CREDIT_NAME_MAX}
                    placeholder="Name"
                    aria-label={`Credit ${i + 1} name`}
                    aria-invalid={!!nameProblem || undefined}
                    onChange={(e) => update(c.key, { name: e.target.value })}
                  />
                  <input
                    id={`${idPrefix}-credit-${c.key}-role`}
                    className={cls.input}
                    value={c.role}
                    maxLength={CREDIT_ROLE_MAX}
                    placeholder="Role, e.g. Actor"
                    list={rolesListId}
                    aria-label={`Credit ${i + 1} role`}
                    aria-invalid={!!roleProblem || undefined}
                    onChange={(e) => update(c.key, { role: e.target.value })}
                  />
                </div>
                <LinkedAccount
                  credit={c}
                  index={i}
                  cls={cls}
                  showStatus={showStatus}
                  selfId={selfId}
                  open={linking === c.key}
                  onOpen={() => setLinking(c.key)}
                  onClose={() => setLinking(null)}
                  onPick={(user) => {
                    update(c.key, { user, status: null, name: c.name.trim() ? c.name : user.displayName });
                    setLinking(null);
                  }}
                  onUnlink={() => update(c.key, { user: null, status: null })}
                />
                {nameProblem ? <p className={cls.error} role="alert">{nameProblem.message}</p> : null}
                {roleProblem ? <p className={cls.error} role="alert">{roleProblem.message}</p> : null}
              </div>
              <div className="credits-row__actions">
                <button type="button" className={cls.icon} aria-label={`Move ${label} up`} disabled={i === 0} onClick={() => move(i, i - 1)}>
                  <ArrowUp aria-hidden="true" />
                </button>
                <button type="button" className={cls.icon} aria-label={`Move ${label} down`} disabled={i === value.credits.length - 1} onClick={() => move(i, i + 1)}>
                  <ArrowDown aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={cls.icon}
                  aria-label={`Remove ${label}`}
                  onClick={() => {
                    if (linking === c.key) setLinking(null);
                    setCredits(value.credits.filter((x) => x.key !== c.key));
                  }}
                >
                  <X aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      {full ? <p className={cls.hint}>That is the most a video can carry ({CREDITS_MAX}).</p> : null}
      {problemFor("credits") ? <p className={cls.error} role="alert">{problemFor("credits")!.message}</p> : null}

      <fieldset className="credits-editor__genres">
        <legend className={cls.label}>
          Genres <span className="credits-editor__count">up to {GENRES_MAX}</span>
        </legend>
        {genresLoading ? (
          <p className={cls.hint}>Loading genres…</p>
        ) : genres.length === 0 ? (
          <p className={cls.hint}>Genres could not be loaded. You can add them later in Creator Hub.</p>
        ) : (
          <div className="credits-genres" id={`${idPrefix}-genres`}>
            {genres.map((g) => {
              const on = value.genres.includes(g.slug);
              return (
                <button
                  key={g.slug}
                  type="button"
                  className="credits-genre"
                  aria-pressed={on}
                  disabled={!on && value.genres.length >= GENRES_MAX}
                  onClick={() => onChange({ ...value, genres: toggleGenre(value.genres, g.slug) })}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        )}
        {problemFor("genres") ? <p className={cls.error} role="alert">{problemFor("genres")!.message}</p> : null}
      </fieldset>

      <div className="credits-editor__facts">
        <div>
          <label className={cls.label} htmlFor={`${idPrefix}-releaseYear`}>
            Release year
          </label>
          <input
            id={`${idPrefix}-releaseYear`}
            className={cls.input}
            inputMode="numeric"
            placeholder={String(new Date().getFullYear())}
            maxLength={4}
            value={value.releaseYear}
            aria-invalid={!!problemFor("releaseYear") || undefined}
            aria-describedby={`${idPrefix}-releaseYear-hint`}
            onChange={(e) => onChange({ ...value, releaseYear: e.target.value.replace(/[^\d]/g, "").slice(0, 4) })}
          />
          <p className={cls.hint} id={`${idPrefix}-releaseYear-hint`}>
            {RELEASE_YEAR_MIN}–{year}
          </p>
          {problemFor("releaseYear") ? <p className={cls.error} role="alert">{problemFor("releaseYear")!.message}</p> : null}
        </div>
        <div>
          <label className={cls.label} htmlFor={`${idPrefix}-productionHouse`}>
            Production house
          </label>
          <input
            id={`${idPrefix}-productionHouse`}
            className={cls.input}
            maxLength={PRODUCTION_HOUSE_MAX}
            placeholder="Studio or company"
            value={value.productionHouse}
            aria-invalid={!!problemFor("productionHouse") || undefined}
            onChange={(e) => onChange({ ...value, productionHouse: e.target.value })}
          />
          {problemFor("productionHouse") ? <p className={cls.error} role="alert">{problemFor("productionHouse")!.message}</p> : null}
        </div>
      </div>
    </div>
  );
}

/* ── One row's VChat account ─────────────────────────────── */

type Classes = (typeof CLASSES)[keyof typeof CLASSES];

interface LinkedAccountProps {
  credit: CreditDraft;
  index: number;
  cls: Classes;
  showStatus: boolean;
  selfId: string | null;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPick: (user: CreditUser) => void;
  onUnlink: () => void;
}

/** What the owner is told under a linked name. */
export function linkedNote(credit: Pick<CreditDraft, "user" | "status">, showStatus: boolean, selfId: string | null): string {
  if (!credit.user) return "";
  if (showStatus && credit.status) return CREDIT_STATUS_LABEL[credit.status];
  if (selfId && credit.user.id === selfId) return "That's you: accepted right away";
  return "Will be asked to accept";
}

function LinkedAccount({ credit, index, cls, showStatus, selfId, open, onOpen, onClose, onPick, onUnlink }: LinkedAccountProps) {
  if (credit.user) {
    const note = linkedNote(credit, showStatus, selfId);
    return (
      <div className="credits-linked" data-status={showStatus && credit.status ? credit.status : undefined}>
        <span aria-hidden="true">
          <Avatar src={credit.user.avatarUrl} name={credit.user.displayName || credit.name} seed={credit.user.id} size="xs" />
        </span>
        <span className="credits-linked__text">
          <span className="credits-linked__name">{credit.user.username ? `@${credit.user.username}` : credit.user.displayName || credit.name}</span>
          <span className="credits-linked__note" data-credit-note>
            {note}
          </span>
        </span>
        <button type="button" className="credits-linked__unlink" aria-label={`Unlink the VChat account from credit ${index + 1}`} onClick={onUnlink}>
          <X aria-hidden="true" />
        </button>
      </div>
    );
  }
  if (!open) {
    return (
      <button type="button" className="credits-link-btn" onClick={onOpen} aria-label={`Link a VChat account to credit ${index + 1}`}>
        <Link2 aria-hidden="true" /> Link a VChat account
      </button>
    );
  }
  return <AccountSearch cls={cls} index={index} initial={credit.name} onPick={onPick} onClose={onClose} />;
}

function AccountSearch({ cls, index, initial, onPick, onClose }: { cls: Classes; index: number; initial: string; onPick: (u: CreditUser) => void; onClose: () => void }) {
  const [query, setQuery] = useState(initial.trim());
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const { candidates, loading, settled } = useMentionSearch(query.trim() || null);
  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => setActive(0), [query]);

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && candidates.length) {
      e.preventDefault();
      setActive((a) => (a + 1) % candidates.length);
    } else if (e.key === "ArrowUp" && candidates.length) {
      e.preventDefault();
      setActive((a) => (a + candidates.length - 1) % candidates.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (candidates[active]) onPick(toCreditUser(candidates[active]));
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  const open = !!query.trim() && (candidates.length > 0 || loading || settled);
  return (
    <div className="credits-search">
      <div className="credits-search__box">
        <Search aria-hidden="true" />
        <input
          ref={inputRef}
          className={cls.input}
          value={query}
          placeholder="Search people on VChat"
          role="combobox"
          aria-label={`Find the VChat account for credit ${index + 1}`}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open && candidates[active] ? `${listId}-${active}` : undefined}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
        />
        <button type="button" className={cls.icon} aria-label="Cancel linking" onClick={onClose}>
          <X aria-hidden="true" />
        </button>
      </div>
      {open ? (
        <ul id={listId} role="listbox" aria-label="People" className="credits-search__list" onPointerDown={(e) => e.preventDefault()}>
          {candidates.map((p, i) => (
            <li
              key={p.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className="credits-search__option"
              onMouseEnter={() => setActive(i)}
              onClick={() => onPick(toCreditUser(p))}
            >
              <span aria-hidden="true">
                <Avatar src={p.avatar} name={p.name || p.username} seed={p.id} size="xs" />
              </span>
              <span className="min-w-0">
                <span className="credits-search__name">{p.name || p.username}</span>
                <span className="credits-search__handle">@{p.username}</span>
              </span>
            </li>
          ))}
          {candidates.length === 0 ? <li className="credits-search__empty">{loading ? "Searching…" : "No one found"}</li> : null}
        </ul>
      ) : null}
      <p className={cls.hint}>They get a request and the video shows on their profile once they accept.</p>
    </div>
  );
}
