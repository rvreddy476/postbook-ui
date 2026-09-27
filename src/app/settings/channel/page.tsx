"use client";

import { AppShell } from "@/features/reels/components/AppShell";
import { BrandingSettings } from "@/features/settings/channel/BrandingSettings";

/* /settings/channel — Branding: identity, links and the featured video,
   saved through PATCH /v1/channels/me. Monetization lives at /monetization. */
export default function ChannelBrandingPage() {
  return (
    <AppShell sectionLabel="Branding">
      <BrandingSettings />
    </AppShell>
  );
}
