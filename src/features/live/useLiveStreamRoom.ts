"use client";

import { useEffect, useRef } from "react";
import {
  subscribeToLiveEvents,
  subscribeToLiveStream,
  unsubscribeFromLiveStream,
} from "@/services/messageService";
import type { LiveRealtimeEvent } from "@/features/live/types";

export function useLiveStreamRoom(
  streamId: string | null | undefined,
  onRealtimeEvent?: (event: LiveRealtimeEvent) => void,
) {
  const onEventRef = useRef(onRealtimeEvent);
  onEventRef.current = onRealtimeEvent;

  useEffect(() => {
    if (!streamId) return;

    subscribeToLiveStream(streamId);
    const unsubscribe = subscribeToLiveEvents((event) => {
      if (event.stream_id !== streamId) return;
      onEventRef.current?.(event);
    });

    return () => {
      unsubscribeFromLiveStream(streamId);
      unsubscribe();
    };
  }, [streamId]);
}
