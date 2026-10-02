/*
  Offline copies: a video saved inside the app, never a file handed to the
  person. See wire.ts (the contract), manager.ts (what happens), storage.ts
  (where the bytes live) and components/OfflinePage.tsx (the page).
*/
export { OfflineBadge } from "./components/OfflineBadge";
export { OfflinePage } from "./components/OfflinePage";
export { OfflineProgressRing } from "./components/OfflineProgressRing";
export { OfflineSync } from "./components/OfflineSync";
export { useOfflineRow, useOfflineSource, useStorageKind, type OfflineNotice, type OfflineRow } from "./hooks";
export { offlineRowAction, offlineRowAvailable, offlineRowInfo, offlineSupported, type OfflineRowInfo } from "./row";
