"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type {
  CreatorTier,
  Dashboard,
  PayoutMethod,
  TaxInfo,
  Transaction,
  Wallet,
} from "@/types/monetization";

interface ApiResponse<T> {
  data: T;
}

interface ApiListResponse<T> {
  data: T[];
  meta?: { next_cursor?: string };
}

interface RawWallet {
  user_id?: string;
  balance_paise?: number;
  lifetime_earnings_paise?: number;
  pending_payout_paise?: number;
  currency?: string;
  is_frozen?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface RawTransaction {
  id: string;
  wallet_id: string;
  type: Transaction["type"];
  amount_paise?: number;
  currency?: string;
  status?: string;
  reference_type?: string;
  reference_id?: string;
  description?: string;
  created_at: string;
}

interface RawPayoutMethod {
  id: string;
  user_id: string;
  method_type: PayoutMethod["method_type"];
  details_encrypted?: string;
  is_default?: boolean;
  is_verified?: boolean;
  created_at: string;
  updated_at?: string;
}

interface RawCreatorTier {
  id: string;
  creator_id: string;
  name: string;
  price_paise?: number;
  currency?: string;
  perks?: unknown;
  subscriber_count?: number;
  is_active?: boolean;
  billing_period?: string;
  created_at?: string;
  updated_at?: string;
}

interface RawTaxInfo {
  id: string;
  user_id: string;
  country: string;
  tax_data_encrypted?: string;
  verification_status?: string;
  created_at?: string;
  updated_at?: string;
}

interface RawDashboard {
  wallet?: RawWallet | null;
  recent_transactions?: RawTransaction[];
  tiers?: RawCreatorTier[];
}

const defaultWallet = (userId = ""): Wallet => ({
  user_id: userId,
  balance: 0,
  balance_paise: 0,
  lifetime_earnings: 0,
  lifetime_earnings_paise: 0,
  pending_payout: 0,
  pending_payout_paise: 0,
  currency: "INR",
  is_frozen: false,
  created_at: "",
  updated_at: "",
});

function fromPaise(value?: number | null) {
  return (value ?? 0) / 100;
}

function toPaise(value: number) {
  return Math.round(value * 100);
}

function toStringMap(value: unknown): Record<string, string> {
  if (!value) {
    return {};
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return toStringMap(parsed);
    } catch {
      return {};
    }
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
      key,
      entryValue == null ? "" : String(entryValue),
    ]),
  );
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return toStringArray(parsed);
    } catch {
      return [];
    }
  }

  return [];
}

function normalizeWallet(raw?: RawWallet | null): Wallet {
  if (!raw) {
    return defaultWallet();
  }

  const balancePaise = raw.balance_paise ?? 0;
  const lifetimeEarningsPaise = raw.lifetime_earnings_paise ?? 0;
  const pendingPayoutPaise = raw.pending_payout_paise ?? 0;

  return {
    user_id: raw.user_id ?? "",
    balance: fromPaise(balancePaise),
    balance_paise: balancePaise,
    lifetime_earnings: fromPaise(lifetimeEarningsPaise),
    lifetime_earnings_paise: lifetimeEarningsPaise,
    pending_payout: fromPaise(pendingPayoutPaise),
    pending_payout_paise: pendingPayoutPaise,
    currency: raw.currency ?? "INR",
    is_frozen: raw.is_frozen ?? false,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

function normalizeTransaction(raw: RawTransaction): Transaction {
  const amountPaise = raw.amount_paise ?? 0;
  return {
    id: raw.id,
    wallet_id: raw.wallet_id,
    type: raw.type,
    amount: fromPaise(amountPaise),
    amount_paise: amountPaise,
    currency: raw.currency ?? "INR",
    status: raw.status ?? "pending",
    reference_type: raw.reference_type ?? "",
    reference_id: raw.reference_id ?? "",
    description: raw.description ?? "",
    created_at: raw.created_at,
  };
}

function normalizePayoutMethod(raw: RawPayoutMethod): PayoutMethod {
  return {
    id: raw.id,
    user_id: raw.user_id,
    method_type: raw.method_type,
    details: toStringMap(raw.details_encrypted),
    details_encrypted: raw.details_encrypted ?? "",
    is_default: raw.is_default ?? false,
    is_verified: raw.is_verified ?? false,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

function normalizeTier(raw: RawCreatorTier): CreatorTier {
  const pricePaise = raw.price_paise ?? 0;
  return {
    id: raw.id,
    creator_id: raw.creator_id,
    name: raw.name,
    price: fromPaise(pricePaise),
    price_paise: pricePaise,
    currency: raw.currency ?? "INR",
    perks: toStringArray(raw.perks),
    subscriber_count: raw.subscriber_count ?? 0,
    is_active: raw.is_active ?? false,
    billing_period: raw.billing_period,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

function normalizeTaxInfo(raw: RawTaxInfo): TaxInfo {
  return {
    id: raw.id,
    user_id: raw.user_id,
    country: raw.country,
    tax_data: toStringMap(raw.tax_data_encrypted),
    tax_data_encrypted: raw.tax_data_encrypted ?? "",
    verification_status: raw.verification_status ?? "pending",
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

function normalizeDashboard(raw?: RawDashboard | null): Dashboard {
  return {
    wallet: normalizeWallet(raw?.wallet),
    recent_transactions: (raw?.recent_transactions ?? []).map(normalizeTransaction),
    tiers: (raw?.tiers ?? []).map(normalizeTier),
  };
}

export function useWallet() {
  return useQuery({
    queryKey: ["monetization-wallet"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<RawWallet | null>>("/v1/monetization/wallet");
      return normalizeWallet(res.data.data);
    },
    staleTime: 30_000,
  });
}

export function useTransactions(type?: string) {
  return useInfiniteQuery({
    queryKey: ["monetization-transactions", type],
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string> = { limit: "20" };
      if (type) params.type = type;
      if (pageParam) params.cursor = pageParam as string;
      const res = await api.get<ApiListResponse<RawTransaction>>("/v1/monetization/transactions", { params });
      return {
        data: res.data.data.map(normalizeTransaction),
        meta: res.data.meta,
      };
    },
    initialPageParam: "" as string,
    getNextPageParam: (lastPage) => lastPage.meta?.next_cursor || undefined,
  });
}

export function usePayoutMethods() {
  return useQuery({
    queryKey: ["monetization-payout-methods"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<RawPayoutMethod[]>>("/v1/monetization/payout-methods");
      return res.data.data.map(normalizePayoutMethod);
    },
    staleTime: 60_000,
  });
}

export function useAddPayoutMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { method_type: string; details: Record<string, string>; is_default?: boolean }) => {
      const res = await api.post<ApiResponse<RawPayoutMethod>>("/v1/monetization/payout-methods", {
        method_type: payload.method_type,
        details_encrypted: JSON.stringify(payload.details),
        is_default: payload.is_default ?? false,
      });
      return normalizePayoutMethod(res.data.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monetization-payout-methods"] });
    },
  });
}

export function useRemovePayoutMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/v1/monetization/payout-methods/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monetization-payout-methods"] });
    },
  });
}

export function useRequestPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { amount: number; payout_method_id: string }) => {
      const res = await api.post<ApiResponse<RawTransaction>>("/v1/monetization/payouts", {
        amount_paise: toPaise(payload.amount),
        payout_method_id: payload.payout_method_id,
      });
      return normalizeTransaction(res.data.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monetization-wallet"] });
      qc.invalidateQueries({ queryKey: ["monetization-payout-history"] });
      qc.invalidateQueries({ queryKey: ["monetization-transactions"] });
      qc.invalidateQueries({ queryKey: ["monetization-dashboard"] });
    },
  });
}

export function usePayoutHistory() {
  return useInfiniteQuery({
    queryKey: ["monetization-payout-history"],
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string> = { limit: "20" };
      if (pageParam) params.cursor = pageParam as string;
      const res = await api.get<ApiListResponse<RawTransaction>>("/v1/monetization/payouts", { params });
      return {
        data: res.data.data.map(normalizeTransaction),
        meta: res.data.meta,
      };
    },
    initialPageParam: "" as string,
    getNextPageParam: (lastPage) => lastPage.meta?.next_cursor || undefined,
  });
}

export function useSaveTaxInfo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { country: string; pan_number: string; gst_number: string }) => {
      const taxData: Record<string, string> = {};
      if (payload.pan_number.trim()) taxData.pan_number = payload.pan_number.trim();
      if (payload.gst_number.trim()) taxData.gst_number = payload.gst_number.trim();

      const res = await api.post<ApiResponse<RawTaxInfo>>("/v1/monetization/tax-info", {
        country: payload.country,
        tax_data_encrypted: JSON.stringify(taxData),
      });
      return normalizeTaxInfo(res.data.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monetization-dashboard"] });
    },
  });
}

export function useMyTiers() {
  return useQuery({
    queryKey: ["monetization-my-tiers"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<RawCreatorTier[]>>("/v1/monetization/tiers");
      return res.data.data.map(normalizeTier);
    },
    staleTime: 60_000,
  });
}

export function useCreateTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; price: number; currency: string; perks: string[] }) => {
      const res = await api.post<ApiResponse<RawCreatorTier>>("/v1/monetization/tiers", {
        name: payload.name,
        price_paise: toPaise(payload.price),
        currency: payload.currency,
        perks: payload.perks,
      });
      return normalizeTier(res.data.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monetization-my-tiers"] });
      qc.invalidateQueries({ queryKey: ["monetization-dashboard"] });
    },
  });
}

export function useUpdateTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      id: string;
      name?: string;
      price?: number;
      currency?: string;
      perks?: string[];
      is_active?: boolean;
    }) => {
      const body: Record<string, unknown> = {};
      if (payload.name !== undefined) body.name = payload.name;
      if (payload.price !== undefined) body.price_paise = toPaise(payload.price);
      if (payload.currency !== undefined) body.currency = payload.currency;
      if (payload.perks !== undefined) body.perks = payload.perks;
      if (payload.is_active !== undefined) body.is_active = payload.is_active;

      await api.patch(`/v1/monetization/tiers/${id}`, body);
      return { status: "updated" as const };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monetization-my-tiers"] });
      qc.invalidateQueries({ queryKey: ["monetization-dashboard"] });
    },
  });
}

export function useSubscribe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ creatorId, tier_id }: { creatorId: string; tier_id: string }) => {
      const res = await api.post(`/v1/monetization/subscribe/${creatorId}`, { tier_id });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monetization-wallet"] });
      qc.invalidateQueries({ queryKey: ["monetization-transactions"] });
    },
  });
}

export function useUnsubscribe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (creatorId: string) => {
      await api.delete(`/v1/monetization/subscribe/${creatorId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monetization-wallet"] });
      qc.invalidateQueries({ queryKey: ["monetization-transactions"] });
    },
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: ["monetization-dashboard"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<RawDashboard | null>>("/v1/monetization/dashboard");
      return normalizeDashboard(res.data.data);
    },
    staleTime: 30_000,
  });
}
