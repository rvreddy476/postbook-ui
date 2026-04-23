import AppShell from "@/components/AppShell";
import { SlamBookIndexRouteView } from "@/features/slambooks/SlamBookRouteViews";

export default function SlamBooksPage() {
  return (
    <AppShell activeTab="Memories">
      <SlamBookIndexRouteView />
    </AppShell>
  );
}
