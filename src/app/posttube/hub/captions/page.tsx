import { Suspense } from "react";

import { CaptionsPage } from "@/features/posttube/hub/components/CaptionsPage";
import { HubSkeleton } from "@/features/posttube/hub/components/HubEmpty";

export default function HubCaptionsRoute() {
  return (
    <Suspense fallback={<HubSkeleton rows={5} height={44} />}>
      <CaptionsPage />
    </Suspense>
  );
}
