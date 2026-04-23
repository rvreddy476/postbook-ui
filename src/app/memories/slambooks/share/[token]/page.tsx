import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SlamBookShareRouteView } from "@/features/slambooks/SlamBookRouteViews";

export default async function SlamBookSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="min-h-screen bg-[#F7F4EE] text-brand-text">
      <div className="border-b border-brand-divider/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-6 py-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-highlight">
            <ArrowLeft className="h-4 w-4" />
            Back to Postbook
          </Link>
          <Link href="/login" className="rounded-full border border-brand-divider px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-highlight transition-colors hover:bg-brand-secondary">
            Sign in
          </Link>
        </div>
      </div>
      <SlamBookShareRouteView token={token} />
    </div>
  );
}
