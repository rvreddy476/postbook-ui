import type { Metadata } from "next";

import { HubFrame } from "@/features/posttube/hub/components/HubFrame";

export const metadata: Metadata = {
  title: "Creator Hub · PostTube",
  description: "Your library, insights, conversations and captions in one console.",
};

/** /posttube/hub/* — the console rail plus the page; the PostTube shell comes from app/posttube/layout.tsx. */
export default function HubLayout({ children }: { children: React.ReactNode }) {
  return <HubFrame>{children}</HubFrame>;
}
