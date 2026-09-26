import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reels | VChat",
  description: "Short videos on VChat Reels.",
};

/*
  The stage draws its own black canvas; the page around it follows the app
  theme (light or dark) like every other route. The old override that forced
  a white body here is gone — it defeated dark mode on this one page.
*/
export default function ReelsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        body > div:first-child > .pointer-events-none.fixed { display: none !important; }
      `}</style>
      {children}
    </>
  );
}
