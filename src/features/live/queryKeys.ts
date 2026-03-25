export const liveKeys = {
  streams: () => ["live", "streams"] as const,
  stream: (streamId: string | null | undefined) => ["live", "stream", streamId] as const,
  hostStreams: (hostId: string | null | undefined) => ["live", "host-streams", hostId] as const,
  viewerCount: (streamId: string | null | undefined) => ["live", "viewer-count", streamId] as const,
  chat: (streamId: string | null | undefined) => ["live", "chat", streamId] as const,
  mutes: (streamId: string | null | undefined) => ["live", "mutes", streamId] as const,
  wordFilters: (streamId: string | null | undefined) => ["live", "word-filters", streamId] as const,
  upcoming: () => ["live", "schedule", "upcoming"] as const,
};
