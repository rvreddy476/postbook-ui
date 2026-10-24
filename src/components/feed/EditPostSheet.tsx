'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { SwitchRow } from '@/features/post-compose/components/ComposeSheet';
import {
  MAX_POST_TEXT,
  buildPostEditBody,
  hasEdits,
  postEditFormFrom,
  postEditProblem,
  visibilityOptionsFor,
  type EditablePost,
  type PostEditBody,
  type PostEditForm,
} from '@/components/feed/postEdit';

export interface EditPostSheetProps {
  post: EditablePost;
  saving: boolean;
  /** The server's refusal as a sentence, or null. */
  error: string | null;
  onSave: (body: PostEditBody) => void;
  onClose: () => void;
}

/**
 * Edit a published post: its text, who can see it, comments, and whether the
 * like count shows. Saves only what changed (postEdit.ts).
 */
export default function EditPostSheet({ post, saving, error, onSave, onClose }: EditPostSheetProps) {
  const titleId = useId();
  const textId = useId();
  const [form, setForm] = useState<PostEditForm>(() => postEditFormFrom(post));
  const textRef = useRef<HTMLTextAreaElement>(null);
  const body = buildPostEditBody(post, form);
  const problem = postEditProblem(post, form);
  const canSave = hasEdits(body) && !problem && !saving;
  const length = Array.from(form.text).length;

  useEffect(() => {
    textRef.current?.focus({ preventScroll: true });
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-120 flex items-end justify-center bg-black/40 backdrop-blur-xs sm:items-center"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-brand-divider bg-brand-card shadow-xl sm:mx-4 sm:rounded-2xl"
        onKeyDown={(event) => { if (event.key === 'Escape' && !saving) { event.stopPropagation(); onClose(); } }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-brand-divider bg-brand-card px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-brand-text">Edit post</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="rounded-full p-1.5 text-brand-text/60 hover:bg-brand-secondary disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form
          className="space-y-5 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSave) onSave(body);
          }}
        >
          <div>
            <label htmlFor={textId} className="mb-1.5 block text-sm font-medium text-brand-text">Text</label>
            <textarea
              id={textId}
              ref={textRef}
              value={form.text}
              rows={5}
              onChange={(event) => setForm((f) => ({ ...f, text: event.target.value }))}
              className="w-full resize-y rounded-xl border border-brand-divider bg-brand-bg px-3 py-2 text-[15px] leading-relaxed text-brand-text focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className={`mt-1 text-right text-xs tabular-nums ${length > MAX_POST_TEXT ? 'text-danger' : 'text-brand-text/55'}`}>
              {length.toLocaleString('en-US')} / {MAX_POST_TEXT.toLocaleString('en-US')}
            </p>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-brand-text">Who can see this post</legend>
            <div className="space-y-1">
              {visibilityOptionsFor(post.visibility ?? 'public').map((option) => (
                <label key={option.value} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-brand-secondary">
                  <input
                    type="radio"
                    name="edit-post-visibility"
                    value={option.value}
                    checked={form.visibility === option.value}
                    onChange={() => setForm((f) => ({ ...f, visibility: option.value }))}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium text-brand-text">{option.label}</span>
                    <span className="block text-[12px] text-brand-text/60">{option.detail}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="divide-y divide-brand-divider rounded-xl border border-brand-divider">
            <SwitchRow
              name="allow-comments"
              title="Allow comments"
              detail={form.allowComments ? 'People can comment on this post' : 'Comments are turned off'}
              checked={form.allowComments}
              onChange={(next) => setForm((f) => ({ ...f, allowComments: next }))}
            />
            <SwitchRow
              name="hide-like-count"
              title="Hide like count"
              detail="Only you see how many people liked it"
              checked={form.hideLikeCount}
              onChange={(next) => setForm((f) => ({ ...f, hideLikeCount: next }))}
            />
          </div>

          {problem ? <p role="alert" className="text-sm text-danger">{problem}</p> : null}
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-brand-divider px-4 py-2 text-sm font-medium text-brand-text hover:bg-brand-secondary disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
