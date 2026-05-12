import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reels | AtPost",
  description: "Watch and discover short-form video content on AtPost Reels.",
};

export default function ReelsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Override root layout's purple background — Reels uses pure white */}
      <style>{`
        body { background: #ffffff !important; }
        body > div:first-child > .pointer-events-none.fixed { display: none !important; }
      `}</style>
      {children}
    </>
  );
}
