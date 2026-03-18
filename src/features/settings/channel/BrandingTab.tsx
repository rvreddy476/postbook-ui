"use client";

import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Image, Stamp, Check, Loader2 } from "lucide-react";
import { Avatar } from "@/components/LetterAvatar";
import { useMyChannels, useUpdateChannel } from "@/hooks/useChannels";
import { uploadMedia } from "@/lib/mediaUpload";

interface UploadFieldProps {
  label: string;
  description: string;
  hint: string;
  icon: React.ReactNode;
  currentUrl?: string;
  onUpload: (file: File) => void;
  uploading?: boolean;
  aspectRatio?: string;
}

function UploadField({ label, description, hint, icon, currentUrl, onUpload, uploading, aspectRatio }: UploadFieldProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
  };

  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-semibold text-brand-highlight">{label}</label>
      <p className="mb-3 text-[11px] text-brand-text/60">{description}</p>
      <div
        className="group relative flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-brand-divider bg-brand-secondary transition-colors hover:border-brand-text/30 hover:bg-brand-text/30"
        style={{ aspectRatio: aspectRatio || "auto", minHeight: aspectRatio ? undefined : "120px" }}
      >
        {currentUrl ? (
          <img src={currentUrl} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 p-6">
            {icon}
            <span className="text-[11px] font-medium text-brand-text/60 group-hover:text-brand-text/50">
              Click to upload
            </span>
            <span className="text-[10px] text-brand-text/30">{hint}</span>
          </div>
        )}
        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-brand-card/80">
            <Loader2 className="h-5 w-5 animate-spin text-brand-text/50" />
          </div>
        ) : null}
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </div>
    </div>
  );
}

export function BrandingTab() {
  const { data: channels } = useMyChannels();
  const channel = channels?.[0];
  const updateMutation = useUpdateChannel();

  const [themeColor, setThemeColor] = useState("#7C3AED");
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);

  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  const avatarUrl = channel?.avatar_media_id
    ? `${baseUrl}/v1/media/${channel.avatar_media_id}/serve`
    : undefined;
  const bannerUrl = channel?.banner_media_id
    ? `${baseUrl}/v1/media/${channel.banner_media_id}/serve`
    : undefined;

  const handleAvatarUpload = useCallback(async (file: File) => {
    if (!channel) return;
    setAvatarUploading(true);
    try {
      const mediaId = await uploadMedia(file, "image", "avatar");
      await updateMutation.mutateAsync({ id: channel.id, avatar_media_id: mediaId });
    } catch {
      // Upload or update failed
    } finally {
      setAvatarUploading(false);
    }
  }, [channel, updateMutation]);

  const handleBannerUpload = useCallback(async (file: File) => {
    if (!channel) return;
    setBannerUploading(true);
    try {
      const mediaId = await uploadMedia(file, "image", "cover");
      await updateMutation.mutateAsync({ id: channel.id, banner_media_id: mediaId });
    } catch {
      // Upload or update failed
    } finally {
      setBannerUploading(false);
    }
  }, [channel, updateMutation]);

  const handleWatermarkUpload = useCallback(async (_file: File) => {
    // Watermark is a future feature
  }, []);

  const handleSave = useCallback(async () => {
    if (!channel) return;
    await updateMutation.mutateAsync({ id: channel.id });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [channel, updateMutation]);

  return (
    <div className="space-y-6">
      {/* Profile Photo */}
      <div className="rounded-2xl border border-brand-divider/60 bg-brand-card p-6 shadow-sm">
        <h2 className="mb-5 text-[14px] font-bold text-brand-text">Profile Photo</h2>
        <div className="flex items-center gap-6">
          <div className="relative">
            <Avatar
              src={avatarUrl}
              name={channel?.name || "Channel"}
              seed={channel?.id}
              size="xl"
              className="border-4 border-white shadow-lg ring-1 ring-brand-secondary"
            />
            <label className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-brand-text text-white shadow-md transition-transform hover:scale-110">
              {avatarUploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
              <input
                type="file"
                accept="image/*"
                disabled={avatarUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAvatarUpload(file);
                }}
                className="hidden"
              />
            </label>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-brand-text">Channel Avatar</p>
            <p className="mt-0.5 text-[11px] text-brand-text/60">
              Square image, at least 256x256px. PNG or JPG.
            </p>
          </div>
        </div>
      </div>

      {/* Banner */}
      <div className="rounded-2xl border border-brand-divider/60 bg-brand-card p-6 shadow-sm">
        <h2 className="mb-5 text-[14px] font-bold text-brand-text">Banner Image</h2>
        <UploadField
          label=""
          description="Displayed at the top of your channel page."
          hint="Recommended: 2048x1152px (16:9)"
          icon={<Image className="h-6 w-6 text-brand-text/30" />}
          currentUrl={bannerUrl}
          onUpload={handleBannerUpload}
          uploading={bannerUploading}
          aspectRatio="16/5"
        />
      </div>

      {/* Watermark */}
      <div className="rounded-2xl border border-brand-divider/60 bg-brand-card p-6 shadow-sm">
        <h2 className="mb-5 text-[14px] font-bold text-brand-text">Video Watermark</h2>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[13px] font-medium text-brand-text">Enable watermark on videos</p>
            <p className="text-[11px] text-brand-text/60">Subtle brand mark shown on your Posttube videos</p>
          </div>
          <button
            type="button"
            onClick={() => setWatermarkEnabled(!watermarkEnabled)}
            className={`relative h-6 w-11 rounded-full transition-colors ${watermarkEnabled ? "bg-brand-text" : "bg-brand-secondary"}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-brand-card shadow-sm transition-transform ${watermarkEnabled ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>
        {watermarkEnabled ? (
          <UploadField
            label=""
            description="Upload a transparent PNG for best results."
            hint="Max 128x128px, transparent PNG"
            icon={<Stamp className="h-6 w-6 text-brand-text/30" />}
            onUpload={handleWatermarkUpload}
          />
        ) : null}
      </div>

      {/* Theme Color */}
      <div className="rounded-2xl border border-brand-divider/60 bg-brand-card p-6 shadow-sm">
        <h2 className="mb-5 text-[14px] font-bold text-brand-text">Theme Color</h2>
        <div className="flex items-center gap-4">
          <input
            type="color"
            value={themeColor}
            onChange={(e) => setThemeColor(e.target.value)}
            className="h-10 w-10 cursor-pointer rounded-lg border border-brand-divider"
          />
          <div>
            <p className="text-[13px] font-medium text-brand-text">{themeColor}</p>
            <p className="text-[11px] text-brand-text/60">Used as accent color on your channel page</p>
          </div>
        </div>
      </div>

      {/* Preview Card */}
      <div className="rounded-2xl border border-brand-divider/60 bg-brand-card p-6 shadow-sm">
        <h2 className="mb-5 text-[14px] font-bold text-brand-text">Preview</h2>
        <div className="overflow-hidden rounded-xl border border-brand-divider">
          {/* Mini banner */}
          <div className="h-20 bg-gradient-to-r from-brand-text/10 to-fuchsia-100" style={{ backgroundColor: themeColor + "20" }}>
            {bannerUrl ? <img src={bannerUrl} alt="" className="h-full w-full object-cover" /> : null}
          </div>
          {/* Mini profile */}
          <div className="relative px-4 pb-4">
            <div className="-mt-6">
              <Avatar
                src={avatarUrl}
                name={channel?.name || "Channel"}
                seed={channel?.id}
                size="lg"
                className="border-4 border-white shadow-sm"
              />
            </div>
            <p className="mt-2 text-[14px] font-bold text-brand-text">{channel?.name || "Your Channel"}</p>
            <p className="text-[12px] text-brand-text/60">@{channel?.handle || "handle"}</p>
            <p className="mt-1 text-[11px] text-brand-highlight">{channel?.description || "No description yet"}</p>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center justify-end gap-3">
        <AnimatePresence>
          {saved ? (
            <motion.span
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-600"
            >
              <Check className="h-3.5 w-3.5" />
              Saved
            </motion.span>
          ) : null}
        </AnimatePresence>
        <button
          type="button"
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="rounded-xl bg-brand-text px-6 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-brand-text disabled:opacity-50"
        >
          {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
