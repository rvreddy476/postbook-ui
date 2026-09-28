"use client";

import { ChevronDown, Loader2, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";

import { useGlobalToast } from "@/contexts/ToastContext";
import { searchUsers } from "@/services/userService";
import { PRIVATE_SHARES_MAX, hubErrorCode, type HubLibraryRow, type HubPrivateShare, type HubVisibility } from "../hubApi";
import { VISIBILITY_LABEL, fromLocalInput, readableHubError, toLocalInput, visibilityPlan } from "../hubModel";
import { useApplyVisibility, usePrivateShares, useSetPrivateShares } from "../hooks/useHub";
import { VisibilityPanel } from "./LibraryActions";
import { VisibilityIcon, useAnchoredMenu, useDismiss } from "./Pills";

/*
  The Visibility cell of a Library row: the pill opens a small popover —
  Private / Unlisted / Public, a Schedule section with a date and time,
  Cancel / Save — and, while Private is chosen, "Share privately" opens the
  sharing dialog (GET|PUT /v1/posts/:id/private-shares). Save runs the
  same sequence the edit sheet uses (hubModel.visibilityPlan).
*/

export function VisibilityCell({ row, ownerId }: { row: HubLibraryRow; ownerId: string | null }) {
  const toast = useGlobalToast();
  const apply = useApplyVisibility();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<HubVisibility>(row.visibility);
  const [local, setLocal] = useState(toLocalInput(row.scheduled_at));
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const close = () => setOpen(false);
  const ref = useDismiss(open, close, { form: true });
  const { buttonRef, style } = useAnchoredMenu(open, "left", { width: 280, height: 380 });

  const openPanel = () => {
    setChoice(row.visibility);
    setLocal(toLocalInput(row.scheduled_at));
    setError(null);
    setOpen((o) => !o);
  };

  const scheduleIso = choice === "scheduled" ? fromLocalInput(local) : null;
  const plan = visibilityPlan(row, choice, scheduleIso);
  const timeProblem = choice === "scheduled" && (!scheduleIso || Date.parse(scheduleIso) <= Date.now()) ? "Pick a time in the future." : null;

  const save = () => {
    if (!plan) return;
    apply.mutate(
      { postId: row.id, plan },
      {
        onSuccess: () => {
          setOpen(false);
          toast({ type: "success", title: plan.scheduleAt ? "Scheduled" : `Set to ${VISIBILITY_LABEL[plan.visibility ?? "public"]}` });
        },
        onError: (err) => setError(readableHubError(hubErrorCode(err), "Could not change the visibility. Try again.")),
      },
    );
  };

  return (
    <>
      <div className="hub-vis" ref={ref}>
        <button ref={buttonRef} type="button" className="hub-vis-pill" data-vis={row.visibility} aria-haspopup="dialog" aria-expanded={open} disabled={apply.isPending} onClick={openPanel} title="Change visibility">
          <VisibilityIcon visibility={row.visibility} />
          {apply.isPending ? "Saving…" : VISIBILITY_LABEL[row.visibility]}
          <ChevronDown aria-hidden="true" style={{ opacity: 0.6 }} />
        </button>
        {open ? (
          <div className="hub-pop" style={{ ...style, width: 280 }} role="dialog" aria-label={`Visibility of ${row.title}`}>
            <VisibilityPanel
              choice={choice}
              onChoice={(v) => {
                setError(null);
                setChoice(v);
              }}
              scheduleLocal={local}
              onScheduleLocal={(v) => {
                setError(null);
                setLocal(v);
              }}
              error={error ?? timeProblem}
              canSave={!!plan}
              pending={apply.isPending}
              onSharePrivately={() => {
                setOpen(false);
                setSharing(true);
              }}
              onCancel={close}
              onSave={save}
            />
          </div>
        ) : null}
      </div>
      {sharing ? <PrivateSharesDialog postId={row.id} title={row.title} ownerId={ownerId} onClose={() => setSharing(false)} /> : null}
    </>
  );
}

/* ── Share privately ────────────────────────────────────── */

function Avatar({ name, src }: { name: string; src: string }) {
  return <span className="hub-avatar hub-avatar-sm">{src ? <img src={src} alt="" /> : (name.trim()[0] ?? "?").toUpperCase()}</span>;
}

export function PrivateSharesDialog({ postId, title, ownerId, onClose }: { postId: string; title: string; ownerId: string | null; onClose: () => void }) {
  const toast = useGlobalToast();
  const shares = usePrivateShares(postId);
  const save = useSetPrivateShares();
  const [list, setList] = useState<HubPrivateShare[] | null>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (shares.data && list === null) setList(shares.data);
  }, [shares.data, list]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const search = useQuery({
    queryKey: ["hub", "share-search", debounced],
    queryFn: () => searchUsers(debounced, 12),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  });

  const current = useMemo(() => list ?? [], [list]);
  const chosen = useMemo(() => new Set(current.map((u) => u.user_id)), [current]);
  const full = current.length >= PRIVATE_SHARES_MAX;
  const results = (search.data ?? []).filter((u) => u.id && u.id !== ownerId);
  const baseIds = (shares.data ?? []).map((u) => u.user_id).join(",");
  const dirty = list !== null && current.map((u) => u.user_id).join(",") !== baseIds;

  const add = (u: { id: string; name: string; username?: string; avatar: string }) => {
    if (chosen.has(u.id) || full) return;
    setError(null);
    setList([...current, { user_id: u.id, username: u.username ?? "", display_name: u.name || u.username || "Someone", avatar_url: u.avatar ?? "", added_at: "" }]);
  };

  const remove = (id: string) => {
    setError(null);
    setList(current.filter((u) => u.user_id !== id));
  };

  const commit = () => {
    if (!dirty || save.isPending) return;
    save.mutate(
      { postId, userIds: current.map((u) => u.user_id), ownerId },
      {
        onSuccess: (users) => {
          setList(users);
          toast({ type: "success", title: users.length === 0 ? "No one else can watch it now" : `Shared with ${users.length}` });
          onClose();
        },
        onError: (err) => setError(readableHubError(hubErrorCode(err), "Could not save the list. Try again.")),
      },
    );
  };

  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      <div className="hub-sheet-backdrop" onClick={onClose} role="presentation" />
      <div className="hub hub-dialog" role="dialog" aria-modal="true" aria-labelledby="hub-share-title">
        <div className="hub-sheet-head">
          <div>
            <div className="hub-sheet-title" id="hub-share-title">
              Share privately
            </div>
            <div className="hub-hint">{title}</div>
          </div>
          <button type="button" className="hub-icon-btn" aria-label="Close" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="hub-dialog-body">
          <p className="hub-hint">People you add can watch this private video when they are signed in. They never see who else is on the list. Up to {PRIVATE_SHARES_MAX} people.</p>
          <label className="hub-search">
            <Search aria-hidden="true" />
            <input type="search" className="hub-input" placeholder="Search by name or username" aria-label="Search people" value={query} maxLength={100} disabled={full || shares.isError} onChange={(e) => setQuery(e.target.value)} />
          </label>
          {debounced.length >= 2 ? (
            <ul className="hub-people" aria-label="Search results">
              {search.isFetching && results.length === 0 ? (
                <li className="hub-hint">
                  <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Searching…
                </li>
              ) : results.length === 0 ? (
                <li className="hub-hint">No one found.</li>
              ) : (
                results.map((u) => (
                  <li key={u.id}>
                    <Avatar name={u.name || u.username || "?"} src={u.avatar} />
                    <span className="hub-people-name">
                      <span>{u.name || u.username}</span>
                      {u.username ? <span className="hub-hint">@{u.username}</span> : null}
                    </span>
                    <button type="button" className="hub-btn hub-btn-sm" disabled={chosen.has(u.id) || full} onClick={() => add(u)}>
                      {chosen.has(u.id) ? "Added" : "Add"}
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}

          <div className="hub-row" style={{ justifyContent: "space-between" }}>
            <span className="hub-label">Can watch</span>
            <span className="hub-hint">
              {current.length} of {PRIVATE_SHARES_MAX}
            </span>
          </div>
          {shares.isPending ? (
            <span className="hub-hint">Loading…</span>
          ) : shares.isError ? (
            <div className="hub-error">Could not load who this is shared with, so nothing can be changed right now.</div>
          ) : current.length === 0 ? (
            <span className="hub-hint">Only you can watch it.</span>
          ) : (
            <ul className="hub-people" aria-label="People who can watch">
              {current.map((u) => (
                <li key={u.user_id}>
                  <Avatar name={u.display_name} src={u.avatar_url} />
                  <span className="hub-people-name">
                    <span>{u.display_name}</span>
                    {u.username ? <span className="hub-hint">@{u.username}</span> : null}
                  </span>
                  <button type="button" className="hub-icon-btn" aria-label={`Remove ${u.display_name}`} onClick={() => remove(u.user_id)}>
                    <X />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error ? (
            <div className="hub-error" role="alert">
              {error}
            </div>
          ) : null}
        </div>
        <div className="hub-sheet-foot">
          <button type="button" className="hub-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="hub-btn hub-btn-primary" disabled={!dirty || save.isPending || shares.isError} onClick={commit}>
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
