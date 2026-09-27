import { Suspense } from "react";

import { LibraryPage } from "@/features/posttube/hub/components/LibraryPage";
import { HubSkeleton } from "@/features/posttube/hub/components/HubEmpty";

export default function HubLibraryRoute() {
  return (
    <Suspense fallback={<HubSkeleton rows={6} height={44} />}>
      <LibraryPage />
    </Suspense>
  );
}
