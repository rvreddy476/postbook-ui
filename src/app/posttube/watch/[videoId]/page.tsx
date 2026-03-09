import { WatchPage } from "@/features/posttube/components/WatchPage";

interface Props {
  params: Promise<{ videoId: string }>;
}

export default async function PostTubeWatchByIdRoute({ params }: Props) {
  const { videoId } = await params;
  return <WatchPage videoId={videoId} />;
}
