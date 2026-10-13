export const INTRODUCTION_MAX_SECONDS = 60
export const INTRODUCTION_MAX_BYTES = 64 * 1024 * 1024

export function introductionFileError(file: Pick<File, "type" | "size">, duration?: number): string | null {
  if (!["video/mp4", "video/webm", "video/quicktime"].includes(file.type)) return "Choose an MP4, WebM or MOV video."
  if (file.size <= 0 || file.size > INTRODUCTION_MAX_BYTES) return "Choose a video up to 64 MB."
  if (duration !== undefined && (!Number.isFinite(duration) || duration <= 0 || duration > INTRODUCTION_MAX_SECONDS)) return "Keep your introduction to one minute or less."
  return null
}
