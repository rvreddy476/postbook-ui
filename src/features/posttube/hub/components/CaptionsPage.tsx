"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { useGlobalToast } from "@/contexts/ToastContext";
import type { CaptionStatus, HubCaptionRow } from "../hubApi";
import { formatDateTime } from "../hubModel";
import { useHubCaptions, useHubLibrary, useSetCaptionPublished, useUploadCaption } from "../hooks/useHub";
import { PUBLISH_LANGUAGES } from "../publishDefaults";
import { HubHead } from "./HubFrame";
import { CaptionsEmpty, HubError, HubSkeleton } from "./HubEmpty";
import { PillGroup, Toggle } from "./Pills";

function readStatus(v: string | null): CaptionStatus {
  return v === "draft" || v === "published" ? v : "all";
}

/** /posttube/hub/captions?status=all|draft|published */
export function CaptionsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const status = readStatus(params.get("status"));
  const captions = useHubCaptions(status);
  // `post_id` is always null on the wire; titles come from the Library rows by media id.
  const library = useHubLibrary("videos");
  const byMedia = useMemo(() => new Map(library.rows.filter((r) => r.media_id).map((r) => [r.media_id as string, r])), [library.rows]);

  const setStatus = (s: CaptionStatus) => {
    const next = new URLSearchParams(params.toString());
    if (s === "all") next.delete("status");
    else next.set("status", s);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <>
      <HubHead
        title="Captions"
        sub="Every language on every video. Drafts are yours alone until you publish them."
        actions={
          <PillGroup
            label="Status"
            value={status}
            options={[
              { id: "all", label: "All" },
              { id: "draft", label: "Drafts" },
              { id: "published", label: "Published" },
            ]}
            onChange={setStatus}
          />
        }
      />

      {captions.isPending ? (
        <HubSkeleton rows={5} height={44} />
      ) : captions.isError ? (
        <HubError />
      ) : captions.rows.length === 0 ? (
        <div className="hub-card">
          <CaptionsEmpty status={status} />
        </div>
      ) : (
        <div className="hub-table-wrap">
          <table className="hub-table" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th>Video</th>
                <th>Languages</th>
                <th>Modified</th>
                <th style={{ width: 200 }}>Add</th>
              </tr>
            </thead>
            <tbody>
              {captions.rows.map((row) => (
                <CaptionRow key={row.media_id} row={row} video={byMedia.get(row.media_id)} status={status} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {captions.hasNextPage ? (
        <div className="hub-more">
          <button type="button" className="hub-btn" onClick={() => captions.fetchNextPage()} disabled={captions.isFetchingNextPage}>
            {captions.isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </>
  );
}

function CaptionRow({ row, video, status }: { row: HubCaptionRow; video: { id: string; title: string; thumbnail_url: string } | undefined; status: CaptionStatus }) {
  const toast = useGlobalToast();
  const setPublished = useSetCaptionPublished();
  const upload = useUploadCaption();
  const [language, setLanguage] = useState("en");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const langs = status === "all" ? row.languages : row.languages.filter((l) => (status === "published" ? l.published : !l.published));
  const title = video?.title || row.title || row.media_id.slice(0, 8);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await upload.mutateAsync({ mediaId: row.media_id, language, file });
      toast({ type: "success", title: `Captions uploaded (${language})` });
    } catch {
      toast({ type: "error", title: "Could not upload that file", description: "Use .srt or .vtt." });
    }
  };

  return (
    <tr>
      <td>
        <div className="hub-row-title">
          <span className="hub-thumb">{video?.thumbnail_url ? <img src={video.thumbnail_url} alt="" loading="lazy" /> : null}</span>
          <span style={{ minWidth: 0 }}>
            {video ? (
              <Link href={`/posttube/hub/library?edit=${video.id}&sheet=captions`} title="Open in the edit sheet">
                {title}
              </Link>
            ) : (
              <span style={{ fontWeight: 600 }}>{title}</span>
            )}
            <div className="hub-row-meta">
              <code>{row.media_id.slice(0, 8)}</code>
            </div>
          </span>
        </div>
      </td>
      <td>
        {langs.length === 0 ? (
          <span className="hub-hint">—</span>
        ) : (
          <div className="hub-pills">
            {langs.map((l) => (
              <span key={l.language} className="hub-lang" title={`${l.source === "auto" ? "Generated" : "Uploaded"} · ${formatDateTime(l.updated_at) || "—"}`}>
                <code>{l.language}</code>
                <span className="hub-hint">{l.source === "auto" ? "auto" : "up"}</span>
                <Toggle
                  label={`${l.language} published`}
                  checked={l.published}
                  disabled={setPublished.isPending}
                  onChange={(v) => setPublished.mutate({ mediaId: row.media_id, language: l.language, published: v }, { onError: () => toast({ type: "error", title: "Could not change that" }) })}
                />
              </span>
            ))}
          </div>
        )}
      </td>
      <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(row.modified_at) || "—"}</td>
      <td>
        <div className="hub-row">
          <select className="hub-select hub-input-sm" style={{ width: 96 }} value={language} aria-label="Language to upload" onChange={(e) => setLanguage(e.target.value)}>
            {PUBLISH_LANGUAGES.filter((l) => l.code).map((l) => (
              <option key={l.code} value={l.code}>
                {l.code}
              </option>
            ))}
          </select>
          <input ref={fileRef} type="file" accept=".srt,.vtt,text/vtt" hidden onChange={onFile} />
          <button type="button" className="hub-btn hub-btn-sm" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
            <Upload /> {upload.isPending ? "…" : "Upload"}
          </button>
        </div>
      </td>
    </tr>
  );
}
