"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings,
  Palette,
  Link2,
  Shield,
  DollarSign,
  Wrench,
} from "lucide-react";
import { AppShell } from "@/features/reels/components/AppShell";
import { GeneralTab } from "@/features/settings/channel/GeneralTab";
import { BrandingTab } from "@/features/settings/channel/BrandingTab";
import { LinksTab } from "@/features/settings/channel/LinksTab";
import { PrivacyTab } from "@/features/settings/channel/PrivacyTab";
import { MonetizationTab } from "@/features/settings/channel/MonetizationTab";
import { AdvancedTab } from "@/features/settings/channel/AdvancedTab";

const TABS = [
  { id: "general", label: "General", icon: Settings },
  { id: "branding", label: "Branding", icon: Palette },
  { id: "links", label: "Links", icon: Link2 },
  { id: "privacy", label: "Privacy & Safety", icon: Shield },
  { id: "monetization", label: "Monetization", icon: DollarSign },
  { id: "advanced", label: "Advanced", icon: Wrench },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function ChannelSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("general");

  return (
    <AppShell sectionLabel="Settings">
      <div className="mx-auto flex max-w-[1100px] gap-8 px-6 py-8">
        {/* Sidebar */}
        <nav className="w-[220px] shrink-0">
          <div className="sticky top-8 space-y-1">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400 px-3">
              Channel Settings
            </h2>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                    isActive
                      ? "bg-violet-50 text-violet-700"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  }`}
                >
                  <tab.icon
                    className={`h-4 w-4 ${
                      isActive
                        ? "text-violet-600"
                        : "text-slate-400 group-hover:text-slate-500"
                    }`}
                  />
                  <span className="text-[13px] font-semibold">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Content */}
        <main className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === "general" && <GeneralTab />}
              {activeTab === "branding" && <BrandingTab />}
              {activeTab === "links" && <LinksTab />}
              {activeTab === "privacy" && <PrivacyTab />}
              {activeTab === "monetization" && <MonetizationTab />}
              {activeTab === "advanced" && <AdvancedTab />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </AppShell>
  );
}
