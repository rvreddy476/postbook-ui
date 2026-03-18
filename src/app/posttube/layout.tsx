import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PostTube | Postbook \u00b7 atpost",
  description: "Watch long-form video content on PostTube.",
};

export default function PostTubeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Override root layout's purple background — PostTube uses pure white */}
      <style>{`
        body { background: #ffffff !important; }
        body > div:first-child > .pointer-events-none.fixed { display: none !important; }
      `}</style>
      {children}
    </>
  );
}
