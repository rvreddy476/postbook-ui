import { Suspense } from "react";

import { ConversationsPage } from "@/features/posttube/hub/components/ConversationsPage";
import { HubSkeleton } from "@/features/posttube/hub/components/HubEmpty";

export default function HubConversationsRoute() {
  return (
    <Suspense fallback={<HubSkeleton rows={5} height={72} />}>
      <ConversationsPage />
    </Suspense>
  );
}
