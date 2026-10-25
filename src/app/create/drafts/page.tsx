"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Loader2, Plus } from "lucide-react";

import AppShell from "@/components/AppShell";
import { useGlobalToast } from "@/contexts/ToastContext";
import { serverCode, serverMessage } from "@/features/post-compose/api";
import { ComposeSheet } from "@/features/post-compose/components/ComposeSheet";
import { DraftsList } from "@/features/post-compose/components/DraftsList";
import { useDeletePostDraft, usePostDrafts } from "@/features/post-compose/hooks";
import { draftSummary, refusalCopy, type PostDraftRow } from "@/features/post-compose/model";

/*
  /create/drafts — the author's saved post drafts (GET /v1/posts/drafts).
  A row opens in the full-page composer (/create/post?draft=<id>), where it
  saves over itself or posts; Delete asks first.
*/
export default function PostDraftsPage() {
  const router = useRouter();
  const toast = useGlobalToast();
  const drafts = usePostDrafts();
  const remove = useDeletePostDraft();
  const [confirming, setConfirming] = useState<PostDraftRow | null>(null);

  const confirmDelete = async () => {
    const row = confirming;
    if (!row) return;
    setConfirming(null);
    try {
      await remove.mutateAsync(row.id);
      toast({ type: "success", title: "Draft deleted" });
    } catch (err) {
      toast({ type: "error", title: "Not deleted", description: refusalCopy(serverCode(err), serverMessage(err), "The draft couldn't be deleted. Try again.") });
    }
  };

  return (
    <AppShell activeTab="Home">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
        <div className="rounded-[24px] border border-brand-divider bg-brand-card shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-brand-divider px-5 py-4">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => router.back()}
                aria-label="Back"
                className="flex h-9 w-9 items-center justify-center rounded-full text-brand-text hover:bg-brand-secondary"
              >
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <h1 className="truncate text-[19px] font-semibold text-brand-text">Drafts</h1>
            </div>
            <Link
              href="/create/post"
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition hover:bg-primary-hover"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> New post
            </Link>
          </div>

          <div className="px-5">
            {drafts.isPending ? (
              <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-brand-text/60">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading drafts…
              </div>
            ) : drafts.isError ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <AlertCircle className="h-7 w-7 text-danger" aria-hidden="true" />
                <p className="text-[14px] font-semibold text-brand-text">Your drafts couldn&apos;t be loaded.</p>
                <button
                  type="button"
                  onClick={() => drafts.refetch()}
                  className="rounded-full bg-brand-secondary px-4 py-2 text-[13px] font-semibold text-brand-text hover:bg-brand-text/10"
                >
                  Try again
                </button>
              </div>
            ) : (
              <DraftsList rows={drafts.data} onDelete={setConfirming} deletingId={remove.isPending ? remove.variables ?? null : null} />
            )}
          </div>
        </div>
      </div>

      <ComposeSheet
        open={confirming !== null}
        title="Delete this draft?"
        onClose={() => setConfirming(null)}
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              data-autofocus=""
              onClick={() => setConfirming(null)}
              className="flex-1 rounded-full border border-brand-divider bg-brand-secondary px-4 py-2.5 text-[14px] font-semibold text-brand-text hover:bg-brand-text/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              className="flex-1 rounded-full bg-danger px-4 py-2.5 text-[14px] font-semibold text-primary-foreground hover:opacity-90"
            >
              Delete
            </button>
          </div>
        }
      >
        <p className="text-[13px] leading-relaxed text-brand-text/70">
          {confirming ? `"${draftSummary(confirming).heading}" will be removed from your drafts.` : null}
        </p>
      </ComposeSheet>
    </AppShell>
  );
}
