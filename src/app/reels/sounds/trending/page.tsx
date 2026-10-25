import type { Metadata } from "next";

import { TrendingSoundsScreen } from "@/features/reels/components/TrendingSoundsScreen";
import { trendingFilterFromSearch } from "@/features/reels/trendingSounds";

export const metadata: Metadata = {
  title: "Trending sounds | VChat",
  description: "The sounds most used in reels on VChat this week.",
};

type Props = { searchParams: Promise<{ filter?: string | string[] }> };

// This week's top sounds, All or Rising (?filter=rising). The screen reads the list itself.
export default async function TrendingSoundsPage({ searchParams }: Props) {
  const { filter } = await searchParams;
  return <TrendingSoundsScreen initialFilter={trendingFilterFromSearch(filter)} />;
}
