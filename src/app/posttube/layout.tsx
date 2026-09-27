import type { Metadata } from "next";

import { PosttubeFrame } from "@/features/posttube/components/PosttubeFrame";
import { TubePlayerHost } from "@/features/posttube/watch/miniPlayer";

export const metadata: Metadata = {
  title: "PostTube",
  description: "Watch long-form video on PostTube.",
};

/**
 * Every /posttube route renders inside the shared VideoShell (see
 * PosttubeFrame). The shell follows the app theme: no forced background,
 * no locked dark mode. TubePlayerHost keeps the one long-video player
 * alive across navigation inside the zone (the miniplayer).
 */
export default function PostTubeLayout({ children }: { children: React.ReactNode }) {
  return (
    <PosttubeFrame>
      <TubePlayerHost>{children}</TubePlayerHost>
    </PosttubeFrame>
  );
}
