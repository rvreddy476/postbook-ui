"use client";

import { useSearchParams } from "next/navigation";
import { UploadStudio, type ContentType } from "@/features/upload/UploadStudio";

export default function PosttubeUploadRoute() {
  const searchParams = useSearchParams();
  const raw = searchParams.get("type") ?? "long";
  const type: ContentType = (raw === "short" || raw === "reel" || raw === "podcast") ? raw : "long";
  return <UploadStudio contentType={type} />;
}
