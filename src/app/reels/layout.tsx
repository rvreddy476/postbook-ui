import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reels | Postbook \u00b7 atpost",
  description: "Watch and discover short-form video content on atpost Reels.",
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
