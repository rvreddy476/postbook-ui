"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowUp } from "lucide-react";

interface CommentComposerProps {
  onSubmit: (text: string) => Promise<void> | void;
  pending?: boolean;
  focusSignal?: number;
  placeholder?: string;
}

export function CommentComposer({
  onSubmit,
  pending = false,
  focusSignal,
  placeholder = "Add a comment...",
}: CommentComposerProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusSignal === undefined) return;
    inputRef.current?.focus();
  }, [focusSignal]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextValue = value.trim();
    if (!nextValue || pending) return;
    await onSubmit(nextValue);
    setValue("");
    inputRef.current?.focus();
  }

  const hasValue = value.trim().length > 0;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2.5 border-t border-brand-divider bg-brand-card px-4 py-3"
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className="h-[42px] flex-1 rounded-full bg-brand-secondary px-4 text-[13px] text-brand-text placeholder:text-brand-text/60 outline-none transition-all focus:bg-brand-card focus:ring-1 focus:ring-brand-divider focus:shadow-[0_0_0_2px_rgba(0,0,0,0.04)]"
      />
      <button
        type="submit"
        disabled={!hasValue || pending}
        className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
          hasValue && !pending
            ? "bg-brand-text text-brand-bg shadow-sm hover:opacity-90"
            : "bg-brand-secondary text-brand-text/30 cursor-not-allowed"
        }`}
        aria-label="Send comment"
      >
        <ArrowUp className="h-4 w-4" />
      </button>
    </form>
  );
}
