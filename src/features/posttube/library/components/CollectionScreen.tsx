"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useCollection, type CollectionSource } from "../hooks/useCollection";
import { CollectionView } from "./CollectionView";
import "./library.css";

export interface CollectionScreenProps {
  source: CollectionSource;
  /** Where "Back" and a successful delete go. User collections default to /posttube/playlists. */
  backHref?: string;
  backLabel?: string;
}

/*
  One screen for Queue (system watch_later), Loved (system liked) and every
  user collection. The server render is neutral (a skeleton) so a signed-in
  viewer never sees the sign-in card flash before the session is read.
*/
export function CollectionScreen({ source, backHref, backLabel }: CollectionScreenProps) {
  const router = useRouter();
  const state = useCollection(source);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const isUser = source.kind === "user";
  const back = backHref ?? (isUser ? "/posttube/playlists" : undefined);
  const label = backLabel ?? (isUser ? "Collections" : undefined);

  return (
    <CollectionView
      status={mounted ? state.status : "loading"}
      systemKind={source.kind === "system" ? source.system : undefined}
      collection={state.collection}
      items={state.items}
      itemsLoading={state.itemsLoading}
      itemsError={state.itemsError}
      isOwner={state.isOwner}
      error={state.error}
      pending={state.pending}
      backHref={back}
      backLabel={label}
      onRetry={state.refetch}
      onMove={state.move}
      onMoveBy={state.moveBy}
      onRemove={state.remove}
      onPatch={state.patch}
      onDelete={async () => {
        const ok = await state.destroy();
        if (ok) router.push(back ?? "/posttube/playlists");
        return ok;
      }}
    />
  );
}
