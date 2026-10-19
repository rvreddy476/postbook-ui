import type { SVGProps } from "react";
import { RailShare } from "@/features/reels/components/ReelRailIcons";

/*
  The one Share icon on the web (founder, 2026-10-19: "keep everywhere
  same"): the curved arrow the app and the reels rail use, not Lucide's
  three dots. Size it like a Lucide icon — `size`, or a `className` with
  width and height.
*/
export function ShareIcon({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return <RailShare size={size} {...props} />;
}

export default ShareIcon;
