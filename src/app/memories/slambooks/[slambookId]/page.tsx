import AppShell from "@/components/AppShell";
import { SlamBookDetailRouteView } from "@/features/slambooks/SlamBookRouteViews";

export default async function SlamBookDetailPage({
  params,
}: {
  params: Promise<{ slambookId: string }>;
}) {
  const { slambookId } = await params;

  return (
    <AppShell activeTab="Memories">
      <SlamBookDetailRouteView slambookId={slambookId} />
    </AppShell>
  );
}
