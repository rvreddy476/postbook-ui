import type { Metadata } from "next";

import { PublicPageChrome } from "@/components/PublicPageChrome";
import { LeavingScreen } from "@/features/action-button/components/LeavingScreen";

type Props = { params: Promise<{ id: string }> };

/*
  /l/<id> — where an Action button goes (features/action-button). Public
  (middleware PUBLIC_PREFIXES): a shared post's button must open for someone
  who is not signed in. Never indexed, and the site it leads to is not told
  which post sent the visitor.
*/
export const metadata: Metadata = {
  title: "Opening link · VChat",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ActionLinkPage({ params }: Props) {
  const { id } = await params;
  return (
    <PublicPageChrome>
      <LeavingScreen linkId={id} />
    </PublicPageChrome>
  );
}
