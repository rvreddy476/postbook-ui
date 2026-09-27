/*
  PostTube Library: Queue (system watch_later), Loved (system liked),
  Collections (user playlists) and Recent (history).

  For the watch lane:
    useQueue()          → queued(postId, post.viewer_queued), toggle(postId, post.viewer_queued)
    useLovedIds()       → loved(postId), invalidate() after a like/unlike
    isHistoryPaused()   → check before every POST /v1/videos/:id/progress
    playAllHref()       → `/posttube/watch/[first]?list=<id>`
*/

export {
  fetchSystemCollection,
  fetchCollection,
  fetchCollectionItems,
  fetchCreatorCollections,
  patchCollection,
  deleteCollection,
  createCollection,
  moveCollectionItem,
  removeCollectionItem,
  queuePost,
  unqueuePost,
  normalizePlaylist,
  normalizeItems,
  isSystemKind,
  isSystemPlaylistRefusal,
  playAllHref,
  SYSTEM_TITLES,
} from "./libraryApi";
export type {
  Collection,
  CollectionItem,
  CollectionKind,
  CollectionPatch,
  CollectionVisibility,
  SystemCollectionKind,
  PlaylistWire,
  PlaylistItemWire,
} from "./libraryApi";

export { moveIndex, moveBy, renumber, planMove, reconcileOrder, clampIndex, indexOfPost } from "./reorder";
export type { Positioned } from "./reorder";

export { isHistoryPaused, setHistoryPaused, subscribeHistoryPaused, HISTORY_PAUSE_KEY, HISTORY_PAUSE_EVENT } from "./historyPause";
export { filterRecent } from "./recentSearch";

export { useCollection, LIBRARY_KEYS } from "./hooks/useCollection";
export type { CollectionSource, CollectionState, CollectionStatus } from "./hooks/useCollection";
export { useQueue, useLovedIds } from "./hooks/useQueue";
export type { QueueApi } from "./hooks/useQueue";
export { useMyCollections } from "./hooks/useMyCollections";
export { useHistoryPaused } from "./hooks/useHistoryPaused";

export { CollectionScreen } from "./components/CollectionScreen";
export type { CollectionScreenProps } from "./components/CollectionScreen";
export { CollectionView } from "./components/CollectionView";
export type { CollectionViewProps } from "./components/CollectionView";
export { CollectionRow } from "./components/CollectionRow";
export { CollectionsIndex } from "./components/CollectionsIndex";
export { RecentScreen } from "./components/RecentScreen";
