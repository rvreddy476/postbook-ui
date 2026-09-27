"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

/*
  What floats over the top-right of the main area under the "sidebar"
  chrome: the search pill, and nothing else. Create, alerts and the account
  menu live in the left menu (Upload, Activity, Profile), so the corner
  holds one thing. Submit goes to /search?q= (or /search when empty), the
  same as the header's box. A 40px pill; video-shell.css pins the numbers.
*/
export function VideoTopCluster({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  if (compact) {
    // Comments are open: the corner shrinks to the search icon; a click goes to the search page.
    return (
      <button type="button" className="video-shell__top-cluster video-shell__top-search is-compact" aria-label="Search" onClick={() => router.push("/search")}>
        <Search size={18} strokeWidth={1.75} aria-hidden className="video-shell__top-search-icon" />
      </button>
    );
  }
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
  };
  return (
    <form role="search" className="video-shell__top-cluster video-shell__top-search" onSubmit={onSubmit}>
      <Search size={18} strokeWidth={1.75} aria-hidden className="video-shell__top-search-icon" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search"
        aria-label="Search"
        className="video-shell__top-search-input"
        enterKeyHint="search"
      />
    </form>
  );
}
