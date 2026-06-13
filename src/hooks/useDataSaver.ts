"use client";

/**
 * Data-saver / low-bandwidth mode — recon §F.2.
 *
 * Mirrors the mobile contract:
 *   - `enabled`               — manual toggle (off by default).
 *   - `autoOnSlowConnection`  — sub-toggle (default true; only fires
 *                              while `enabled` is also true).
 *   - `effective`             — `enabled || (autoOnSlowConnection &&
 *                              navigator.connection.effectiveType is
 *                              'slow-2g'|'2g')`.
 *
 * Persistence: a single `localStorage` key (`dataSaver_v1`) holding a
 * compact JSON blob `{enabled, autoOnSlowConnection}`. We deliberately
 * keep this hook self-contained (no Context provider required) — every
 * call site re-reads the same key and listens to a `storage` event so
 * tabs stay in sync.
 *
 * The `navigator.connection` API is non-standard and only exposed by
 * Chromium-derived browsers today; on Safari / Firefox the hook
 * gracefully falls back to "fast" connection (auto sub-toggle is then
 * a no-op until the user disables data-saver entirely).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "dataSaver_v1";
const STORAGE_EVENT = "atpost:datasaver:changed";

type EffectiveType = "slow-2g" | "2g" | "3g" | "4g" | string;

interface NetworkInformationLike extends EventTarget {
  effectiveType?: EffectiveType;
  saveData?: boolean;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformationLike;
  mozConnection?: NetworkInformationLike;
  webkitConnection?: NetworkInformationLike;
}

interface PersistedState {
  enabled: boolean;
  autoOnSlowConnection: boolean;
}

const DEFAULT_STATE: PersistedState = {
  enabled: false,
  autoOnSlowConnection: true,
};

function getConnection(): NetworkInformationLike | undefined {
  if (typeof navigator === "undefined") return undefined;
  const nav = navigator as NavigatorWithConnection;
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
}

function isSlowEffectiveType(type: EffectiveType | undefined): boolean {
  if (!type) return false;
  return type === "slow-2g" || type === "2g";
}

function readPersisted(): PersistedState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      enabled: parsed.enabled === true,
      autoOnSlowConnection:
        parsed.autoOnSlowConnection === undefined
          ? DEFAULT_STATE.autoOnSlowConnection
          : parsed.autoOnSlowConnection === true,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function writePersisted(state: PersistedState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    // Same-tab change notification — `storage` only fires on other
    // tabs, so we dispatch a custom event for in-tab consumers.
    window.dispatchEvent(new CustomEvent(STORAGE_EVENT));
  } catch {
    // Best-effort; quota errors etc. are non-fatal.
  }
}

export interface UseDataSaverResult {
  enabled: boolean;
  setEnabled: (value: boolean, source?: "manual" | "auto") => void;
  autoOnSlowConnection: boolean;
  setAutoOnSlowConnection: (value: boolean) => void;
  /** True when data-saver should currently apply. */
  effective: boolean;
  /** The browser's reported effective type, for display only. */
  effectiveType: EffectiveType | undefined;
}

export function useDataSaver(): UseDataSaverResult {
  const [state, setState] = useState<PersistedState>(() => readPersisted());
  const [effectiveType, setEffectiveType] = useState<EffectiveType | undefined>(
    () => getConnection()?.effectiveType,
  );
  const sessionLoggedRef = useRef(false);

  // Sync across tabs and same-tab listeners.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== STORAGE_KEY) return;
      setState(readPersisted());
    };
    const onCustom = () => setState(readPersisted());
    window.addEventListener("storage", onStorage);
    window.addEventListener(STORAGE_EVENT, onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(STORAGE_EVENT, onCustom);
    };
  }, []);

  // Connectivity listener — only attach while the auto sub-toggle is
  // active. The change event fires when the browser detects a
  // bandwidth shift (e.g. Wi-Fi -> mobile-data).
  useEffect(() => {
    if (!state.autoOnSlowConnection) return;
    const conn = getConnection();
    if (!conn) return;
    const update = () => setEffectiveType(conn.effectiveType);
    update();
    conn.addEventListener("change", update);
    return () => conn.removeEventListener("change", update);
  }, [state.autoOnSlowConnection]);

  const setEnabled = useCallback(
    (value: boolean, source: "manual" | "auto" = "manual") => {
      const next: PersistedState = { ...readPersisted(), enabled: value };
      writePersisted(next);
      setState(next);
      // Fire-and-forget toggle event. We don't take a hard dep on
      // analytics here; if the global telemetry beacon exists, use
      // it. The shape mirrors the mobile event for parity.
      try {
        const beacon = (
          window as unknown as {
            atpostTelemetry?: {
              emit?: (name: string, props?: Record<string, unknown>) => void;
            };
          }
        ).atpostTelemetry;
        beacon?.emit?.("data_saver.toggled", { enabled: value, source });
      } catch {
        // ignore
      }
    },
    [],
  );

  const setAutoOnSlowConnection = useCallback((value: boolean) => {
    const next: PersistedState = {
      ...readPersisted(),
      autoOnSlowConnection: value,
    };
    writePersisted(next);
    setState(next);
  }, []);

  const effective = useMemo(() => {
    if (state.enabled) return true;
    if (!state.autoOnSlowConnection) return false;
    return isSlowEffectiveType(effectiveType);
  }, [state.enabled, state.autoOnSlowConnection, effectiveType]);

  // Fire `data_saver.session.active` once per page load, the first
  // time the effective flag is observed as true.
  useEffect(() => {
    if (!effective || sessionLoggedRef.current) return;
    sessionLoggedRef.current = true;
    try {
      const beacon = (
        window as unknown as {
          atpostTelemetry?: {
            emit?: (name: string, props?: Record<string, unknown>) => void;
          };
        }
      ).atpostTelemetry;
      beacon?.emit?.("data_saver.session.active", { count: 1 });
    } catch {
      // ignore
    }
  }, [effective]);

  return {
    enabled: state.enabled,
    setEnabled,
    autoOnSlowConnection: state.autoOnSlowConnection,
    setAutoOnSlowConnection,
    effective,
    effectiveType,
  };
}
