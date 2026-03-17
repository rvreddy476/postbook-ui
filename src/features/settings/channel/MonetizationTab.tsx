"use client";

import { BadgeCheck, Clock, CreditCard, TrendingUp } from "lucide-react";

function StatusCard({
  icon,
  label,
  value,
  status,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  status: "active" | "pending" | "inactive";
}) {
  const statusColors = {
    active: "bg-emerald-50 text-emerald-600",
    pending: "bg-amber-50 text-amber-600",
    inactive: "bg-brand-secondary text-brand-text/60",
  };

  return (
    <div className="rounded-xl border border-brand-divider/60 bg-brand-card p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-secondary">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-brand-text/60">{label}</p>
          <p className="text-[14px] font-bold text-brand-text">{value}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusColors[status]}`}>
          {status === "active" ? "Active" : status === "pending" ? "Pending" : "Not Started"}
        </span>
      </div>
    </div>
  );
}

export function MonetizationTab() {
  return (
    <div className="space-y-6">
      {/* Eligibility */}
      <div className="rounded-2xl border border-brand-divider/60 bg-brand-card p-6 shadow-sm">
        <h2 className="mb-2 text-[14px] font-bold text-brand-text">Monetization Eligibility</h2>
        <p className="mb-5 text-[11px] text-brand-text/60">
          Meet the requirements below to unlock monetization features.
        </p>

        <div className="space-y-3">
          <StatusCard
            icon={<TrendingUp className="h-4 w-4 text-brand-text/60" />}
            label="Subscriber Count"
            value="1,000 minimum required"
            status="inactive"
          />
          <StatusCard
            icon={<Clock className="h-4 w-4 text-brand-text/60" />}
            label="Watch Hours"
            value="4,000 hours in last 12 months"
            status="inactive"
          />
          <StatusCard
            icon={<BadgeCheck className="h-4 w-4 text-brand-text/60" />}
            label="KYC Verification"
            value="Identity verification"
            status="inactive"
          />
          <StatusCard
            icon={<CreditCard className="h-4 w-4 text-brand-text/60" />}
            label="Payout Method"
            value="Bank account or UPI"
            status="inactive"
          />
        </div>
      </div>

      {/* Info */}
      <div className="rounded-2xl border border-[#D8103F]/10 bg-[#D8103F]/50 p-6">
        <h3 className="text-[13px] font-bold text-[#6b081f]">Coming Soon</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-[#b80d35]">
          Monetization features including Super Boosts, channel memberships, and ad revenue
          sharing are currently in development. Keep creating great content to meet the
          eligibility requirements!
        </p>
      </div>
    </div>
  );
}
