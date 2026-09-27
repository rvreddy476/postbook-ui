"use client";

import { RecentScreen } from "@/features/posttube/library";

/*
  /posttube/history — Recent. GET /v1/videos/history?limit&cursor; remove =
  DELETE /v1/videos/:id/progress; clear = DELETE /v1/videos/history. Search
  is client-side over the loaded rows; "Pause recording" is localStorage
  `posttube_history_paused_v1`, read by the watch page via isHistoryPaused().
*/
export default function PosttubeHistoryPage() {
  return <RecentScreen />;
}
