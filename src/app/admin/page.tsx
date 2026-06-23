"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  Download,
  FileWarning,
  Gavel,
  Loader2,
  RefreshCw,
  Shield,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";

import AppShell from "@/components/AppShell";
import api from "@/lib/api";

const ADMIN_HEADERS = {
  "X-Scopes": "admin superadmin moderator",
} as const;

interface ApiResponse<T> {
  data: T;
}

interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

interface AdminDashboard {
  total_users: number;
  active_users_today: number;
  total_posts: number;
  open_reports: number;
  active_suspensions: number;
  takedowns_last_7d: number;
  new_users_last_7d: number;
  reports_resolved_last_7d: number;
}

interface Report {
  id: string;
  reporter_id: string;
  entity_type: string;
  entity_id: string;
  reason: string;
  details: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface AuditLogEntry {
  id: string;
  admin_actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  payload: unknown;
  created_at: string;
}

interface Suspension {
  user_id: string;
  until: string;
  reason: string;
  created_at: string;
  updated_at: string;
}

interface DataExportRequest {
  id: string;
  user_id: string;
  status: string;
  download_url?: string;
  file_size_bytes?: number | null;
  requested_at: string;
  completed_at?: string | null;
  expires_at?: string | null;
}

function messageFromError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
      ?.message === "string"
  ) {
    return (error as { response: { data: { error: { message: string } } } }).response.data.error.message;
  }

  return "Request failed.";
}

function formatDate(value?: string | null) {
  if (!value) return "Pending";
  return new Date(value).toLocaleString();
}

function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return String(value ?? "");
  }
}

export default function AdminPage() {
  const queryClient = useQueryClient();

  const [takedownForm, setTakedownForm] = useState({
    entity_type: "post",
    entity_id: "",
    reason: "",
  });
  const [suspendForm, setSuspendForm] = useState({
    user_id: "",
    until: "",
    reason: "",
  });
  const [exportRequestId, setExportRequestId] = useState<string | null>(null);

  const dashboardQuery = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<AdminDashboard>>("/v1/admin/dashboard", {
        headers: ADMIN_HEADERS,
      });
      return res.data.data;
    },
    staleTime: 30_000,
  });

  const reportsQuery = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Paginated<Report>>>("/v1/admin/reports", {
        headers: ADMIN_HEADERS,
        params: { limit: 20, offset: 0 },
      });
      return res.data.data;
    },
    staleTime: 15_000,
  });

  const auditLogQuery = useQuery({
    queryKey: ["admin-audit"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Paginated<AuditLogEntry>>>("/v1/admin/audit-log", {
        headers: ADMIN_HEADERS,
        params: { limit: 20, offset: 0 },
      });
      return res.data.data;
    },
    staleTime: 15_000,
  });

  const suspensionsQuery = useQuery({
    queryKey: ["admin-suspensions"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Paginated<Suspension>>>("/v1/admin/suspensions", {
        headers: ADMIN_HEADERS,
        params: { limit: 20, offset: 0 },
      });
      return res.data.data;
    },
    staleTime: 15_000,
  });

  const exportStatusQuery = useQuery({
    queryKey: ["admin-data-export", exportRequestId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<DataExportRequest>>(`/v1/admin/data-export/${exportRequestId}`);
      return res.data.data;
    },
    enabled: !!exportRequestId,
    refetchInterval: exportRequestId ? 15_000 : false,
  });

  const takedownMutation = useMutation({
    mutationFn: async () => {
      await api.post("/v1/admin/takedown", takedownForm, { headers: ADMIN_HEADERS });
    },
    onSuccess: async () => {
      setTakedownForm({ entity_type: "post", entity_id: "", reason: "" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-audit"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-reports"] }),
      ]);
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async () => {
      await api.post(
        `/v1/admin/users/${suspendForm.user_id}/suspend`,
        {
          until: new Date(suspendForm.until).toISOString(),
          reason: suspendForm.reason,
        },
        { headers: ADMIN_HEADERS },
      );
    },
    onSuccess: async () => {
      setSuspendForm({ user_id: "", until: "", reason: "" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-audit"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-suspensions"] }),
      ]);
    },
  });

  const unsuspendMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/v1/admin/users/${userId}/suspend`, { headers: ADMIN_HEADERS });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-audit"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-suspensions"] }),
      ]);
    },
  });

  const exportRequestMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiResponse<DataExportRequest>>("/v1/admin/data-export", {});
      return res.data.data;
    },
    onSuccess: (request) => {
      setExportRequestId(request.id);
    },
  });

  const exportRequest = exportStatusQuery.data ?? exportRequestMutation.data ?? null;

  const metricCards = [
    { label: "Users", value: dashboardQuery.data?.total_users ?? 0 },
    { label: "Posts", value: dashboardQuery.data?.total_posts ?? 0 },
    { label: "Open reports", value: dashboardQuery.data?.open_reports ?? 0 },
    { label: "Active suspensions", value: dashboardQuery.data?.active_suspensions ?? 0 },
    { label: "Takedowns / 7d", value: dashboardQuery.data?.takedowns_last_7d ?? 0 },
    { label: "Resolved reports / 7d", value: dashboardQuery.data?.reports_resolved_last_7d ?? 0 },
  ];

  return (
    <AppShell activeTab="Home">
      <div className="mx-auto max-w-[1280px] px-6 py-8">
        <div className="rounded-[30px] border border-amber-200 bg-amber-50 px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-700">
                Internal Only
              </p>
              <h1 className="mt-1 text-[28px] font-bold text-brand-text">Admin Console</h1>
              <p className="mt-2 max-w-3xl text-[14px] leading-6 text-brand-text/65">
                Minimal ship-week admin surface for dashboard, reports, audit log, takedown, suspend or unsuspend, and user data export visibility. This stays intentionally hidden from normal navigation.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href="/admin/review"
                  className="inline-flex items-center gap-2 rounded-full bg-brand-text px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90"
                >
                  <Gavel className="h-4 w-4" /> Video review queue
                </a>
                <a
                  href="/admin/access"
                  className="inline-flex items-center gap-2 rounded-full border border-brand-text/20 bg-white px-4 py-2 text-[13px] font-semibold text-brand-text hover:bg-brand-bg"
                >
                  <ShieldCheck className="h-4 w-4" /> Access &amp; roles
                </a>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                void Promise.all([
                  dashboardQuery.refetch(),
                  reportsQuery.refetch(),
                  auditLogQuery.refetch(),
                  suspensionsQuery.refetch(),
                  exportRequestId ? exportStatusQuery.refetch() : Promise.resolve(),
                ])
              }
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-300 bg-white px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-amber-800 transition-colors hover:bg-amber-100"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh data
            </button>
          </div>
        </div>

        {(dashboardQuery.isError ||
          reportsQuery.isError ||
          auditLogQuery.isError ||
          suspensionsQuery.isError) && (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] font-semibold text-rose-700">
            {messageFromError(
              dashboardQuery.error ?? reportsQuery.error ?? auditLogQuery.error ?? suspensionsQuery.error,
            )}
          </div>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {metricCards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-brand-divider bg-brand-card px-4 py-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-text/45">
                {card.label}
              </p>
              <p className="mt-2 text-[26px] font-bold text-brand-text">
                {dashboardQuery.isLoading ? "..." : card.value}
              </p>
            </div>
          ))}
        </div>
<div className="mt-8 grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
  <div className="space-y-8">
    <section className="rounded-[28px] border border-brand-divider bg-brand-card px-6 py-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F3E6D2] text-[#7B5B3A]">
          <Gavel className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-[20px] font-bold text-brand-text">Takedown</h2>
          <p className="text-[12px] text-brand-text/60">
            Use the backend takedown endpoint directly for urgent internal actions.
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-[12px] font-semibold text-brand-text">
          Entity type
          <select
            value={takedownForm.entity_type}
            onChange={(event) =>
              setTakedownForm((current) => ({ ...current, entity_type: event.target.value }))
            }
            className="mt-1.5 w-full rounded-xl border border-brand-divider bg-[#FAF7F2] px-3 py-2.5 text-[13px] text-brand-text outline-none"
          >
            <option value="post">Post</option>
            <option value="comment">Comment</option>
            <option value="user">User</option>
            <option value="message">Message</option>
          </select>
        </label>
        <label className="text-[12px] font-semibold text-brand-text">
          Entity ID
          <input
            value={takedownForm.entity_id}
            onChange={(event) =>
              setTakedownForm((current) => ({ ...current, entity_id: event.target.value }))
            }
            className="mt-1.5 w-full rounded-xl border border-brand-divider bg-[#FAF7F2] px-3 py-2.5 text-[13px] text-brand-text outline-none"
            placeholder="UUID or message identifier"
          />
        </label>
      </div>
      <label className="mt-4 block text-[12px] font-semibold text-brand-text">
        Reason
        <textarea
          value={takedownForm.reason}
          onChange={(event) =>
            setTakedownForm((current) => ({ ...current, reason: event.target.value }))
          }
          rows={3}
          className="mt-1.5 w-full rounded-xl border border-brand-divider bg-[#FAF7F2] px-3 py-2.5 text-[13px] text-brand-text outline-none"
          placeholder="Why this content is being removed"
        />
      </label>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => takedownMutation.mutate()}
          disabled={
            takedownMutation.isPending ||
            !takedownForm.entity_id.trim() ||
            !takedownForm.reason.trim()
          }
          className="inline-flex items-center gap-2 rounded-2xl bg-[#7B2D2D] px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#5f2020] disabled:opacity-50"
        >
          {takedownMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileWarning className="h-4 w-4" />
          )}
          Submit takedown
        </button>
        {takedownMutation.isError ? (
          <span className="text-[12px] font-semibold text-rose-700">
            {messageFromError(takedownMutation.error)}
          </span>
        ) : null}
      </div>
    </section>

    <section className="rounded-[28px] border border-brand-divider bg-brand-card px-6 py-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF3FF] text-[#3456A0]">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-[20px] font-bold text-brand-text">Reports</h2>
          <p className="text-[12px] text-brand-text/60">
            Read-only list for ship week. Resolution workflows stay out of scope.
          </p>
        </div>
      </div>
      <div className="space-y-3">
        {(reportsQuery.data?.items ?? []).map((report) => (
          <div key={report.id} className="rounded-2xl border border-brand-divider bg-[#FCFAF7] px-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#E9EEF9] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#3456A0]">
                {report.entity_type}
              </span>
              <span className="rounded-full bg-[#F7E7D7] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#8A4E14]">
                {report.status}
              </span>
              <span className="text-[11px] text-brand-text/45">{formatDate(report.created_at)}</span>
            </div>
            <p className="mt-3 text-[13px] font-semibold text-brand-text">{report.reason}</p>
            {report.details ? (
              <p className="mt-2 text-[13px] leading-6 text-brand-text/65">{report.details}</p>
            ) : null}
            <p className="mt-3 text-[11px] text-brand-text/45">
              Report ID: <span className="font-mono">{report.id}</span>
            </p>
            <p className="mt-1 text-[11px] text-brand-text/45">
              Target: <span className="font-mono">{report.entity_id}</span>
            </p>
          </div>
        ))}
        {!reportsQuery.isLoading && (reportsQuery.data?.items.length ?? 0) === 0 && (
          <div className="rounded-2xl border border-dashed border-brand-divider px-4 py-8 text-center text-[13px] text-brand-text/55">
            No reports available.
          </div>
        )}
      </div>
    </section>
  </div>

  <div className="space-y-8">
    <section className="rounded-[28px] border border-brand-divider bg-brand-card px-6 py-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F7E8E8] text-[#8A2F2F]">
          <Ban className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-[20px] font-bold text-brand-text">Suspend User</h2>
          <p className="text-[12px] text-brand-text/60">
            Backend expects a UUID path param and RFC3339 timestamp.
          </p>
        </div>
      </div>
      <div className="space-y-4">
        <label className="block text-[12px] font-semibold text-brand-text">
          User ID
          <input
            value={suspendForm.user_id}
            onChange={(event) =>
              setSuspendForm((current) => ({ ...current, user_id: event.target.value }))
            }
            className="mt-1.5 w-full rounded-xl border border-brand-divider bg-[#FAF7F2] px-3 py-2.5 text-[13px] text-brand-text outline-none"
            placeholder="User UUID"
          />
        </label>
        <label className="block text-[12px] font-semibold text-brand-text">
          Until
          <input
            type="datetime-local"
            value={suspendForm.until}
            onChange={(event) =>
              setSuspendForm((current) => ({ ...current, until: event.target.value }))
            }
            className="mt-1.5 w-full rounded-xl border border-brand-divider bg-[#FAF7F2] px-3 py-2.5 text-[13px] text-brand-text outline-none"
          />
        </label>
        <label className="block text-[12px] font-semibold text-brand-text">
          Reason
          <textarea
            value={suspendForm.reason}
            onChange={(event) =>
              setSuspendForm((current) => ({ ...current, reason: event.target.value }))
            }
            rows={3}
            className="mt-1.5 w-full rounded-xl border border-brand-divider bg-[#FAF7F2] px-3 py-2.5 text-[13px] text-brand-text outline-none"
            placeholder="Reason for suspension"
          />
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => suspendMutation.mutate()}
          disabled={
            suspendMutation.isPending ||
            !suspendForm.user_id.trim() ||
            !suspendForm.until ||
            !suspendForm.reason.trim()
          }
          className="inline-flex items-center gap-2 rounded-2xl bg-[#8A2F2F] px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#712525] disabled:opacity-50"
        >
          {suspendMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldOff className="h-4 w-4" />
          )}
          Suspend
        </button>
        {suspendMutation.isError ? (
          <span className="text-[12px] font-semibold text-rose-700">
            {messageFromError(suspendMutation.error)}
          </span>
        ) : null}
      </div>
    </section>
                    <section className="rounded-[28px] border border-brand-divider bg-brand-card px-6 py-6 shadow-sm">
                      <div className="mb-5 flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF7F1] text-[#256B43]">
                          <Shield className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="text-[20px] font-bold text-brand-text">Active Suspensions</h2>
                          <p className="text-[12px] text-brand-text/60">
                            Unsuspend actions invalidate dashboard and audit data.
                          </p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {(suspensionsQuery.data?.items ?? []).map((suspension) => (
                          <div key={suspension.user_id} className="rounded-2xl border border-brand-divider bg-[#FCFAF7] px-4 py-4">
                            <p className="text-[12px] font-semibold text-brand-text">
                              User <span className="font-mono">{suspension.user_id}</span>
                            </p>
                            <p className="mt-1 text-[12px] text-brand-text/60">
                              Until {formatDate(suspension.until)}
                            </p>
                            <p className="mt-2 text-[13px] leading-6 text-brand-text/70">{suspension.reason}</p>
                            <button
                              type="button"
                              onClick={() => unsuspendMutation.mutate(suspension.user_id)}
                              disabled={unsuspendMutation.isPending}
                              className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-brand-divider px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-brand-highlight transition-colors hover:bg-brand-secondary disabled:opacity-50"
                            >
                              {unsuspendMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Shield className="h-4 w-4" />
                              )}
                              Unsuspend
                            </button>
                          </div>
                        ))}
                        {!suspensionsQuery.isLoading && (suspensionsQuery.data?.items.length ?? 0) === 0 && (
                          <div className="rounded-2xl border border-dashed border-brand-divider px-4 py-8 text-center text-[13px] text-brand-text/55">
                            No active suspensions.
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="rounded-[28px] border border-brand-divider bg-brand-card px-6 py-6 shadow-sm">
                      <div className="mb-5 flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF1FF] text-[#3456A0]">
                          <Download className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="text-[20px] font-bold text-brand-text">Data Export</h2>
                          <p className="text-[12px] text-brand-text/60">
                            Uses the current logged-in user and shows live request status.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => exportRequestMutation.mutate()}
                          disabled={exportRequestMutation.isPending}
                          className="inline-flex items-center gap-2 rounded-2xl bg-[#3456A0] px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#294684] disabled:opacity-50"
                        >
                          {exportRequestMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          Request export
                        </button>
                        {exportRequestId ? (
                          <button
                            type="button"
                            onClick={() => void exportStatusQuery.refetch()}
                            className="inline-flex items-center gap-2 rounded-2xl border border-brand-divider px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-brand-highlight transition-colors hover:bg-brand-secondary"
                          >
                            <RefreshCw className="h-4 w-4" />
                            Refresh status
                          </button>
                        ) : null}
                      </div>
                      {exportRequestMutation.isError ? (
                        <p className="mt-4 text-[12px] font-semibold text-rose-700">
                          {messageFromError(exportRequestMutation.error)}
                        </p>
                      ) : null}
                      {exportStatusQuery.isError ? (
                        <p className="mt-4 text-[12px] font-semibold text-rose-700">
                          {messageFromError(exportStatusQuery.error)}
                        </p>
                      ) : null}
                      {exportRequest ? (
                        <div className="mt-5 rounded-2xl border border-brand-divider bg-[#FCFAF7] px-4 py-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-brand-text/45">
                            Current request
                          </p>
                          <p className="mt-2 text-[13px] font-semibold text-brand-text">
                            Status: <span className="uppercase">{exportRequest.status}</span>
                          </p>
                          <p className="mt-1 text-[12px] text-brand-text/60">
                            Requested {formatDate(exportRequest.requested_at)}
                          </p>
                          <p className="mt-1 text-[12px] text-brand-text/60">
                            Completed {formatDate(exportRequest.completed_at)}
                          </p>
                          <p className="mt-1 text-[12px] text-brand-text/60">
                            Expires {formatDate(exportRequest.expires_at)}
                          </p>
                          {typeof exportRequest.file_size_bytes === "number" ? (
                            <p className="mt-1 text-[12px] text-brand-text/60">
                              Size {exportRequest.file_size_bytes.toLocaleString()} bytes
                            </p>
                          ) : null}
                          {exportRequest.download_url ? (
                            <a
                              href={exportRequest.download_url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-brand-divider px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-brand-highlight transition-colors hover:bg-brand-secondary"
                            >
                              <Download className="h-4 w-4" />
                              Open download
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                    </section>
                  </div>
                </div>

                <section className="mt-8 rounded-[28px] border border-brand-divider bg-brand-card px-6 py-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F4F0FF] text-[#6B46C1]">
                      <RefreshCw className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-[20px] font-bold text-brand-text">Audit Log</h2>
                      <p className="text-[12px] text-brand-text/60">
                        Recent moderation actions and backend-generated audit payloads.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {(auditLogQuery.data?.items ?? []).map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-brand-divider bg-[#FCFAF7] px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[#EEE7FF] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#6B46C1]">
                            {entry.action}
                          </span>
                          <span className="rounded-full bg-[#F2ECE4] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#7B5B3A]">
                            {entry.entity_type}
                          </span>
                          <span className="text-[11px] text-brand-text/45">{formatDate(entry.created_at)}</span>
                        </div>
                        <p className="mt-3 text-[12px] text-brand-text/60">
                          Actor {entry.admin_actor} on <span className="font-mono">{entry.entity_id}</span>
                        </p>
                        <pre className="mt-3 overflow-x-auto rounded-2xl bg-[#1F2430] px-4 py-4 text-[11px] leading-6 text-[#E6EDF3]">
{prettyJson(entry.payload)}
                        </pre>
                      </div>
                    ))}
                    {!auditLogQuery.isLoading && (auditLogQuery.data?.items.length ?? 0) === 0 && (
                      <div className="rounded-2xl border border-dashed border-brand-divider px-4 py-8 text-center text-[13px] text-brand-text/55">
                        Audit log is empty.
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </AppShell>
          );
        }
