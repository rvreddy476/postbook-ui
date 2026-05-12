"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Loader2,
  ShieldOff,
  XCircle,
} from "lucide-react"

import {
  useApprovePartner,
  useBlockPartner,
  useMopeduPartner,
  useRejectDocument,
  useRejectPartner,
  useRejectPayment,
  useRejectVehicle,
  useSuspendPartner,
  useVerifyDocument,
  useVerifyPayment,
  useVerifyVehicle,
} from "@/hooks/useMopeduAdmin"
import type {
  RiderDocument,
  RiderVehicle,
  SubscriptionPayment,
} from "@/types/mopedu"

import {
  classNames,
  EmptyState,
  errorMessage,
  formatDate,
  maskDocNumber,
  paiseToRupees,
  PrimaryButton,
  ReasonInput,
  relativeTime,
  SecondaryButton,
  StatusPill,
  toneForStatus,
} from "../../_shared"

type PartnerAction = "reject" | "suspend" | "block"

const ACTION_COPY: Record<PartnerAction, { title: string; verb: string; tone: "red" | "slate" }> = {
  reject: { title: "Reject partner", verb: "Reject", tone: "red" },
  suspend: { title: "Suspend partner", verb: "Suspend", tone: "slate" },
  block: { title: "Block partner", verb: "Block", tone: "red" },
}

interface ReasonDialogState {
  kind: "partner" | "document" | "vehicle" | "payment"
  action: PartnerAction | "reject"
  targetId: string
}

function DocPreview({ url, alt }: { url?: string; alt: string }) {
  if (!url) {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-gray-300 text-[10px] text-gray-400">
        No file
      </div>
    )
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="block h-20 w-20 overflow-hidden rounded-lg border border-gray-200 bg-gray-100"
    >
      <img
        src={url}
        alt={alt}
        className="h-full w-full object-cover"
        onError={(e) => {
          // Hide on error so admins still see the link target.
          ;(e.currentTarget as HTMLImageElement).style.display = "none"
        }}
      />
    </a>
  )
}

export default function MopeduPartnerDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id

  const detail = useMopeduPartner(id)
  const approveM = useApprovePartner()
  const rejectM = useRejectPartner()
  const suspendM = useSuspendPartner()
  const blockM = useBlockPartner()
  const verifyDocM = useVerifyDocument()
  const rejectDocM = useRejectDocument()
  const verifyVehM = useVerifyVehicle()
  const rejectVehM = useRejectVehicle()
  const verifyPayM = useVerifyPayment()
  const rejectPayM = useRejectPayment()

  const [dialog, setDialog] = useState<ReasonDialogState | null>(null)
  const [reason, setReason] = useState("")

  if (!id) return null

  const partner = detail.data?.partner
  const documents = detail.data?.documents ?? []
  const vehicles = detail.data?.vehicles ?? []
  const vehicleDocs = detail.data?.vehicle_documents ?? []
  const payments = detail.data?.subscription_payments ?? []
  const recentRides = detail.data?.recent_rides ?? []

  const closeDialog = () => {
    setDialog(null)
    setReason("")
  }

  const submitDialog = async () => {
    if (!dialog) return
    const r = reason.trim().slice(0, 200)
    if (!r) return
    if (dialog.kind === "partner") {
      const action = dialog.action as PartnerAction
      if (action === "reject") {
        await rejectM.mutateAsync({ id: dialog.targetId, reason: r })
      } else if (action === "suspend") {
        await suspendM.mutateAsync({ id: dialog.targetId, reason: r })
      } else if (action === "block") {
        await blockM.mutateAsync({ id: dialog.targetId, reason: r })
      }
    } else if (dialog.kind === "document") {
      await rejectDocM.mutateAsync({ id: dialog.targetId, reason: r })
    } else if (dialog.kind === "vehicle") {
      await rejectVehM.mutateAsync({ id: dialog.targetId, reason: r })
    } else if (dialog.kind === "payment") {
      await rejectPayM.mutateAsync({ id: dialog.targetId, reason: r })
    }
    closeDialog()
  }

  if (detail.isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-brand-text/60">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading partner…
      </div>
    )
  }

  if (detail.isError || !partner) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
        {errorMessage(detail.error) || "Could not load partner."}
        <button
          type="button"
          onClick={() => router.push("/admin/mopedu/partners")}
          className="ml-3 font-semibold underline underline-offset-2"
        >
          Back to queue
        </button>
      </div>
    )
  }

  const canApprove = partner.status === "pending"
  const canReject = partner.status === "pending"
  const canSuspend = partner.status === "approved"
  const canBlock = partner.status !== "blocked"

  return (
    <div className="space-y-6">
      <Link
        href="/admin/mopedu/partners"
        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-text/60 hover:text-brand-text"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to partners
      </Link>

      {/* Header */}
      <div className="rounded-2xl border border-brand-divider bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {partner.profile_photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={partner.profile_photo_url}
                alt={partner.full_name}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-secondary/40 text-lg font-bold text-brand-text">
                {partner.full_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-brand-text">
                {partner.full_name}
              </h2>
              <p className="mt-0.5 font-mono text-sm text-brand-text/70">
                {partner.phone}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusPill
                  status={partner.status}
                  tone={toneForStatus(partner.status)}
                />
                <span className="text-xs text-brand-text/60">
                  {partner.partner_type.replace(/_/g, " ")}
                </span>
                <span className="text-xs text-brand-text/60">
                  {partner.is_online ? "Online" : "Offline"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <PrimaryButton
              tone="green"
              disabled={!canApprove || approveM.isPending}
              onClick={() => approveM.mutate(partner.id)}
            >
              {approveM.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Approve
            </PrimaryButton>
            <PrimaryButton
              tone="red"
              disabled={!canReject}
              onClick={() =>
                setDialog({
                  kind: "partner",
                  action: "reject",
                  targetId: partner.id,
                })
              }
            >
              <XCircle className="mr-1.5 h-3.5 w-3.5" />
              Reject
            </PrimaryButton>
            <PrimaryButton
              tone="slate"
              disabled={!canSuspend}
              onClick={() =>
                setDialog({
                  kind: "partner",
                  action: "suspend",
                  targetId: partner.id,
                })
              }
            >
              <ShieldOff className="mr-1.5 h-3.5 w-3.5" />
              Suspend
            </PrimaryButton>
            <PrimaryButton
              tone="red"
              disabled={!canBlock}
              onClick={() =>
                setDialog({
                  kind: "partner",
                  action: "block",
                  targetId: partner.id,
                })
              }
            >
              <Ban className="mr-1.5 h-3.5 w-3.5" />
              Block
            </PrimaryButton>
          </div>
        </div>
        {partner.suspended_reason ? (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <strong>Suspended:</strong> {partner.suspended_reason}
          </div>
        ) : null}
        {partner.blocked_reason ? (
          <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
            <strong>Blocked:</strong> {partner.blocked_reason}
          </div>
        ) : null}
        {(approveM.isError ||
          rejectM.isError ||
          suspendM.isError ||
          blockM.isError) && (
          <div className="mt-3 text-xs text-rose-700">
            {errorMessage(
              approveM.error ?? rejectM.error ?? suspendM.error ?? blockM.error,
            )}
          </div>
        )}
      </div>

      {/* Three columns */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Profile */}
        <section className="rounded-2xl border border-brand-divider bg-white px-5 py-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-brand-text">Profile</h3>
          <dl className="space-y-2 text-sm">
            <DefRow label="Type" value={partner.partner_type.replace(/_/g, " ")} />
            <DefRow label="City" value={partner.city_id} />
            <DefRow label="Email" value={partner.email ?? "—"} />
            <DefRow
              label="Rating"
              value={
                typeof partner.rating === "number"
                  ? partner.rating.toFixed(2)
                  : "—"
              }
            />
            <DefRow
              label="Rides completed"
              value={partner.total_rides_completed?.toLocaleString("en-IN") ?? "—"}
            />
            <DefRow
              label="Cancellation rate"
              value={`${(partner.cancellation_rate ?? 0).toFixed(1)}%`}
            />
            <DefRow
              label="Acceptance rate"
              value={`${(partner.acceptance_rate ?? 0).toFixed(1)}%`}
            />
            <DefRow
              label="Fraud score"
              value={String(partner.fraud_score ?? 0)}
              tone={partner.fraud_score >= 50 ? "red" : "neutral"}
            />
            <DefRow
              label="Last online"
              value={relativeTime(partner.last_online_at)}
            />
            <DefRow
              label="Joined"
              value={formatDate(partner.created_at)}
            />
            {partner.approved_at ? (
              <DefRow
                label="Approved"
                value={formatDate(partner.approved_at)}
              />
            ) : null}
          </dl>
        </section>

        {/* KYC documents */}
        <section className="rounded-2xl border border-brand-divider bg-white px-5 py-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-brand-text">
            KYC documents
          </h3>
          {documents.length === 0 ? (
            <EmptyState title="No documents uploaded" />
          ) : (
            <ul className="space-y-3">
              {documents.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  onVerify={() => verifyDocM.mutate(doc.id)}
                  onReject={() =>
                    setDialog({
                      kind: "document",
                      action: "reject",
                      targetId: doc.id,
                    })
                  }
                  busy={verifyDocM.isPending || rejectDocM.isPending}
                />
              ))}
            </ul>
          )}
        </section>

        {/* Vehicles + payments */}
        <section className="rounded-2xl border border-brand-divider bg-white px-5 py-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-brand-text">
            Vehicles & payments
          </h3>
          {vehicles.length === 0 ? (
            <EmptyState title="No vehicles registered" />
          ) : (
            <ul className="space-y-3">
              {vehicles.map((v) => (
                <VehicleRow
                  key={v.id}
                  vehicle={v}
                  docs={vehicleDocs.filter((d) => d.owner_id === v.id)}
                  onVerifyVehicle={() => verifyVehM.mutate(v.id)}
                  onRejectVehicle={() =>
                    setDialog({
                      kind: "vehicle",
                      action: "reject",
                      targetId: v.id,
                    })
                  }
                  onVerifyDocument={(docId) => verifyDocM.mutate(docId)}
                  onRejectDocument={(docId) =>
                    setDialog({
                      kind: "document",
                      action: "reject",
                      targetId: docId,
                    })
                  }
                  busy={verifyVehM.isPending || rejectVehM.isPending}
                />
              ))}
            </ul>
          )}
          <div className="mt-5">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-text/60">
              Subscription payments
            </h4>
            {payments.length === 0 ? (
              <p className="text-xs text-brand-text/55">No payments yet.</p>
            ) : (
              <ul className="space-y-2">
                {payments.map((p) => (
                  <PaymentRow
                    key={p.id}
                    payment={p}
                    onVerify={() => verifyPayM.mutate(p.id)}
                    onReject={() =>
                      setDialog({
                        kind: "payment",
                        action: "reject",
                        targetId: p.id,
                      })
                    }
                    busy={verifyPayM.isPending || rejectPayM.isPending}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Recent rides */}
      <section className="rounded-2xl border border-brand-divider bg-white px-5 py-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-brand-text">
            Recent rides (last 10)
          </h3>
          <Link
            href={`/admin/mopedu/rides?partner_id=${partner.id}`}
            className="text-xs font-semibold text-brand-text/60 hover:text-brand-text"
          >
            View all →
          </Link>
        </div>
        {recentRides.length === 0 ? (
          <EmptyState title="No rides yet" />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="pb-2 pr-4">Ride</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Vehicle</th>
                <th className="pb-2 pr-4">Fare</th>
                <th className="pb-2">Requested</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentRides.slice(0, 10).map((r) => (
                <tr key={r.id}>
                  <td className="py-2 pr-4 font-mono text-xs text-brand-text/70">
                    {r.id.slice(0, 8)}…
                  </td>
                  <td className="py-2 pr-4">
                    <StatusPill
                      status={r.status}
                      tone={toneForStatus(r.status)}
                    />
                  </td>
                  <td className="py-2 pr-4 text-xs text-brand-text/70">
                    {r.vehicle_type}
                  </td>
                  <td className="py-2 pr-4 text-xs text-brand-text/70">
                    {paiseToRupees(r.final_fare_paise ?? r.fare_estimate_paise)}
                  </td>
                  <td className="py-2 text-xs text-brand-text/60">
                    {relativeTime(r.requested_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {dialog ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeDialog}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-semibold">
                {dialog.kind === "partner"
                  ? ACTION_COPY[dialog.action as PartnerAction].title
                  : `Reject ${dialog.kind}`}
              </h2>
            </div>
            <p className="mb-3 text-xs text-brand-text/60">
              Provide a reason. The user may see this; keep it factual.
            </p>
            <ReasonInput value={reason} onChange={setReason} />
            <div className="mt-4 flex justify-end gap-2">
              <SecondaryButton onClick={closeDialog}>Cancel</SecondaryButton>
              <PrimaryButton
                tone={
                  dialog.kind === "partner"
                    ? ACTION_COPY[dialog.action as PartnerAction].tone
                    : "red"
                }
                disabled={!reason.trim()}
                onClick={() => void submitDialog()}
              >
                {dialog.kind === "partner"
                  ? ACTION_COPY[dialog.action as PartnerAction].verb
                  : "Reject"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function DefRow({
  label,
  value,
  tone = "neutral",
}: {
  label: string
  value: string
  tone?: "neutral" | "red"
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-xs uppercase tracking-wider text-brand-text/45">
        {label}
      </dt>
      <dd
        className={classNames(
          "truncate text-sm",
          tone === "red"
            ? "font-semibold text-rose-700"
            : "text-brand-text",
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function DocumentRow({
  doc,
  onVerify,
  onReject,
  busy,
}: {
  doc: RiderDocument
  onVerify: () => void
  onReject: () => void
  busy: boolean
}) {
  const canAct = doc.status === "pending"
  return (
    <li className="flex gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3">
      <DocPreview url={doc.file_url} alt={doc.document_type} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-brand-text">
            {doc.document_type}
          </p>
          <StatusPill
            status={doc.status}
            tone={toneForStatus(doc.status)}
          />
        </div>
        <p className="mt-0.5 font-mono text-xs text-brand-text/70">
          {maskDocNumber(doc.document_number)}
        </p>
        {doc.expires_at ? (
          <p className="text-[11px] text-brand-text/55">
            Expires {formatDate(doc.expires_at)}
          </p>
        ) : null}
        {doc.rejection_reason ? (
          <p className="mt-1 text-[11px] text-rose-700">
            {doc.rejection_reason}
          </p>
        ) : null}
        {canAct ? (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onVerify}
              disabled={busy}
              className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
            >
              Verify
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={busy}
              className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        ) : null}
      </div>
    </li>
  )
}

function VehicleRow({
  vehicle,
  docs,
  onVerifyVehicle,
  onRejectVehicle,
  onVerifyDocument,
  onRejectDocument,
  busy,
}: {
  vehicle: RiderVehicle
  docs: RiderDocument[]
  onVerifyVehicle: () => void
  onRejectVehicle: () => void
  onVerifyDocument: (id: string) => void
  onRejectDocument: (id: string) => void
  busy: boolean
}) {
  const canAct = vehicle.status === "pending"
  return (
    <li className="rounded-lg border border-gray-100 bg-gray-50/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-brand-text">
            {vehicle.make} {vehicle.model} ({vehicle.year})
          </p>
          <p className="text-xs text-brand-text/60">
            {vehicle.vehicle_type} · {vehicle.color} ·{" "}
            <span className="font-mono">{vehicle.registration_number}</span>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <StatusPill
              status={vehicle.status}
              tone={toneForStatus(vehicle.status)}
            />
            <StatusPill
              status={vehicle.kyc_status}
              tone={toneForStatus(vehicle.kyc_status)}
              label={`KYC: ${vehicle.kyc_status}`}
            />
          </div>
        </div>
        {canAct ? (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={onVerifyVehicle}
              disabled={busy}
              className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
            >
              Verify
            </button>
            <button
              type="button"
              onClick={onRejectVehicle}
              disabled={busy}
              className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        ) : null}
      </div>
      {docs.length > 0 ? (
        <ul className="mt-3 space-y-2 border-t border-gray-200 pt-2">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-2 text-xs text-brand-text/70"
            >
              <DocPreview url={d.file_url} alt={d.document_type} />
              <div className="flex-1">
                <p className="font-medium text-brand-text">
                  {d.document_type}
                </p>
                <p className="font-mono text-[11px]">
                  {maskDocNumber(d.document_number)}
                </p>
                <StatusPill status={d.status} tone={toneForStatus(d.status)} />
              </div>
              {d.status === "pending" ? (
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => onVerifyDocument(d.id)}
                    className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    Verify
                  </button>
                  <button
                    type="button"
                    onClick={() => onRejectDocument(d.id)}
                    className="rounded-md border border-rose-300 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-800 hover:bg-rose-100"
                  >
                    Reject
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}

function PaymentRow({
  payment,
  onVerify,
  onReject,
  busy,
}: {
  payment: SubscriptionPayment
  onVerify: () => void
  onReject: () => void
  busy: boolean
}) {
  const canAct = payment.status === "pending"
  return (
    <li className="rounded-lg border border-gray-100 bg-gray-50/50 p-3">
      <div className="flex items-start gap-3">
        <DocPreview url={payment.payment_proof_url} alt="payment proof" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-brand-text">
            {paiseToRupees(payment.amount_paise)}
          </p>
          <p className="text-xs text-brand-text/60">
            {payment.payment_method} · {formatDate(payment.submitted_at)}
          </p>
          <StatusPill
            status={payment.status}
            tone={toneForStatus(payment.status)}
          />
          {canAct ? (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={onVerify}
                disabled={busy}
                className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
              >
                Verify
              </button>
              <button
                type="button"
                onClick={onReject}
                disabled={busy}
                className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  )
}
