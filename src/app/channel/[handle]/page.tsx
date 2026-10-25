import type { Metadata } from "next";

import { channelPageMetadata } from "@/features/share/routeMetadata";

import { ChannelProfileScreen } from "./ChannelProfileClient";

type Props = { params: Promise<{ handle: string }> };

/*
  /channel/<handle> — the older public channel page (PostTube's own lives
  at /posttube/channel/<handle>). Both read GET /v1/channels/:ref, so both
  send the same link preview: name, handle, about, banner or avatar.
*/
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  let ref = handle;
  try {
    ref = decodeURIComponent(handle);
  } catch {
    /* keep as typed */
  }
  return channelPageMetadata(ref.replace(/^@/, ""), (r) => `/channel/${encodeURIComponent(r)}`);
}

export default function ChannelProfilePage() {
  return <ChannelProfileScreen />;
}
