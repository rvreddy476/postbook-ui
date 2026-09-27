import { Suspense } from "react";

import { InsightsPage } from "@/features/posttube/hub/components/InsightsPage";
import { HubSkeleton } from "@/features/posttube/hub/components/HubEmpty";

export default function HubInsightsRoute() {
  return (
    <Suspense fallback={<HubSkeleton rows={4} height={64} />}>
      <InsightsPage />
    </Suspense>
  );
}
