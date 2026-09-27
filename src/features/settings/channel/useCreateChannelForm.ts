"use client";

import { useEffect, useState } from "react";

import { useGlobalToast } from "@/contexts/ToastContext";
import { useCreateChannel, useMyChannels } from "@/hooks/useChannels";
import { useMyProfile } from "@/hooks/useEditProfile";
import { useAuthUser } from "@/store/auth";

import { useHandleAvailability } from "./hooks";
import {
  brandingFromChannel,
  fieldErrorsFromApi,
  hasErrors,
  normalizeHandleInput,
  suggestHandle,
  validateBranding,
  type FieldErrors,
} from "./model";
import type { NoChannelProps } from "./view";

/*
  The "create your channel" form, shared by Branding and the upload gate.
  Prefilled from the legacy channel row, else the profile; validated with
  the same rules as Branding; `POST /v1/channels` on submit. `enabled` is
  "the caller has no channel": the prefill reads only run then.
  Returns null until the prefill is ready.
*/
export function useCreateChannelForm(enabled: boolean, opts: { onCreated?: () => void } = {}): NoChannelProps | null {
  const toast = useGlobalToast();
  const user = useAuthUser();
  const profileQuery = useMyProfile({ enabled: !!user && enabled });
  const legacyQuery = useMyChannels(enabled);
  const create = useCreateChannel();
  const legacy = legacyQuery.data?.[0];
  const profile = profileQuery.data;

  const [draft, setDraft] = useState<{ name: string; handle: string } | null>(null);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | undefined>();
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (!enabled || draft !== null) return;
    if (profileQuery.isPending || legacyQuery.isPending) return;
    const name = legacy?.name || profile?.display_name || "";
    const handle = normalizeHandleInput(legacy?.handle || suggestHandle(profile?.username || profile?.display_name || ""));
    setDraft({ name, handle });
  }, [enabled, draft, legacy, profile, profileQuery.isPending, legacyQuery.isPending]);

  const availability = useHandleAvailability(draft?.handle ?? "", "");
  if (!enabled || !draft) return null;

  const base = brandingFromChannel(null);
  const all = validateBranding({ ...base, name: draft.name, handle: draft.handle, links: [], contact_email: "" });
  const errors: FieldErrors = { ...serverErrors };
  if (attempted) {
    if (all.name && !errors.name) errors.name = all.name;
    if (all.handle && !errors.handle) errors.handle = all.handle;
  }

  const onCreate = () => {
    setAttempted(true);
    const errs: FieldErrors = {};
    if (all.name) errs.name = all.name;
    if (all.handle) errs.handle = all.handle;
    if (hasErrors(errs) || availability.state === "taken") return;
    create.mutate(
      { name: draft.name.trim(), handle: normalizeHandleInput(draft.handle), about: legacy?.description?.trim() || undefined },
      {
        onSuccess: () => {
          setServerErrors({});
          setMessage(undefined);
          toast({ type: "success", title: "Your channel is ready" });
          opts.onCreated?.();
        },
        onError: (err) => {
          const { errors: fieldErrors, pageMessage } = fieldErrorsFromApi(err);
          setServerErrors(fieldErrors);
          setMessage(pageMessage);
        },
      },
    );
  };

  return {
    name: draft.name,
    handle: draft.handle,
    availability,
    errors,
    creating: create.isPending,
    pageMessage: message,
    onChange: (field, value) => {
      setDraft((d) => (d ? { ...d, [field]: field === "handle" ? normalizeHandleInput(value) : value } : d));
      setServerErrors((e) => {
        if (!(field in e)) return e;
        const next = { ...e };
        delete next[field];
        return next;
      });
      setMessage(undefined);
    },
    onCreate,
  };
}
