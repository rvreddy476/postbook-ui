'use client';

import { Smartphone, Loader2, ShieldPlus, Trash2 } from 'lucide-react';
import type { TrustedDevice } from '@/hooks/useSecurity';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function truncateFingerprint(fp: string): string {
  if (!fp) return '---';
  if (fp.length <= 12) return fp;
  return `${fp.slice(0, 6)}...${fp.slice(-4)}`;
}

/* ------------------------------------------------------------------ */
/*  Device Item                                                        */
/* ------------------------------------------------------------------ */

function DeviceItem({
  device,
  onRemove,
  isRemoving,
}: {
  device: TrustedDevice;
  onRemove: (id: string) => void;
  isRemoving: boolean;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-[#F0E6DC] bg-white px-4 py-3 transition-colors hover:bg-[#FAF5F0]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FAF5F0]">
        <Smartphone className="h-5 w-5 text-[#D4A574]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#3C2415]">
          {device.device_name || 'Unnamed Device'}
        </p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-[#7B5B3A]">
          <span className="font-mono">{truncateFingerprint(device.fingerprint)}</span>
          <span className="text-[#F0E6DC]">|</span>
          <span>Last used: {formatDate(device.last_used)}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onRemove(device.id)}
        disabled={isRemoving}
        className="shrink-0 rounded-lg p-2 text-rose-500 transition-colors hover:bg-rose-50 disabled:opacity-50"
        title="Remove device"
      >
        {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function DeviceSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-[#F0E6DC] bg-white px-4 py-3">
      <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-[#F0E6DC]" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-40 animate-pulse rounded bg-[#F0E6DC]" />
        <div className="h-3 w-56 animate-pulse rounded bg-[#F0E6DC]" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

interface TrustedDevicesProps {
  devices: TrustedDevice[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onRemove: (deviceId: string) => void;
  removingId: string | null;
  onTrustCurrent: () => void;
  isTrusting: boolean;
}

export default function TrustedDevices({
  devices,
  isLoading,
  error,
  onRemove,
  removingId,
  onTrustCurrent,
  isTrusting,
}: TrustedDevicesProps) {
  return (
    <div className="space-y-3">
      {/* Loading skeletons */}
      {isLoading && (
        <div className="space-y-2">
          <DeviceSkeleton />
          <DeviceSkeleton />
        </div>
      )}

      {/* Error state */}
      {!isLoading && error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          Failed to load trusted devices. Please try again later.
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && devices && devices.length === 0 && (
        <div className="py-6 text-center">
          <Smartphone className="mx-auto h-10 w-10 text-[#F0E6DC]" />
          <p className="mt-2 text-sm font-medium text-[#7B5B3A]">No trusted devices yet.</p>
        </div>
      )}

      {/* Device list */}
      {!isLoading && devices && devices.length > 0 && (
        <div className="space-y-2">
          {devices.map((device) => (
            <DeviceItem
              key={device.id}
              device={device}
              onRemove={onRemove}
              isRemoving={removingId === device.id}
            />
          ))}
        </div>
      )}

      {/* Trust current device button */}
      <button
        type="button"
        onClick={onTrustCurrent}
        disabled={isTrusting}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#F0E6DC] bg-white py-2.5 text-sm font-semibold text-[#D4A574] transition-all hover:bg-[#FAF5F0] disabled:opacity-50"
      >
        {isTrusting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ShieldPlus className="h-4 w-4" />
        )}
        Trust This Device
      </button>
    </div>
  );
}
