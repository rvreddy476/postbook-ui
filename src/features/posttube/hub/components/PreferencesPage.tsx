"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { useGlobalToast } from "@/contexts/ToastContext";
import { useHubCategories } from "../hooks/useHub";
import {
  PUBLISH_DEFAULTS_KEY,
  PUBLISH_LANGUAGES,
  PUBLISH_LICENSES,
  getPublishDefaults,
  resetPublishDefaults,
  setPublishDefaults,
  subscribePublishDefaults,
  type PublishDefaults,
} from "../publishDefaults";
import { HubHead } from "./HubFrame";
import { SwitchRow } from "./Pills";

/**
  Preferences: publish defaults (localStorage `posttube_publish_defaults_v1`,
  read by the upload studio through getPublishDefaults()) and the links to
  the moderation pages that already exist under /settings.
*/
export function PreferencesPage() {
  const toast = useGlobalToast();
  const categories = useHubCategories();
  // Server render uses the defaults; the stored value replaces them after mount.
  const [prefs, setPrefs] = useState<PublishDefaults>(() => getPublishDefaults());
  useEffect(() => {
    setPrefs(getPublishDefaults());
    return subscribePublishDefaults(setPrefs);
  }, []);

  const save = <K extends keyof PublishDefaults>(k: K, v: PublishDefaults[K]) => {
    setPrefs(setPublishDefaults({ [k]: v } as Partial<PublishDefaults>));
  };

  const topics = (categories.data ?? []).filter((c) => c.kind !== "short");

  return (
    <>
      <HubHead title="Preferences" sub="What a new upload starts with, and who you have hidden." />

      <div className="hub-pref-grid">
        <section className="hub-card hub-card-pad">
          <div className="hub-section-head">
            <span className="hub-section-title">Publish defaults</span>
            <button
              type="button"
              className="hub-btn hub-btn-sm"
              onClick={() => {
                setPrefs(resetPublishDefaults());
                toast({ type: "info", title: "Defaults reset" });
              }}
            >
              Reset
            </button>
          </div>
          <p className="hub-hint" style={{ marginBottom: 10 }}>
            Pre-filled in the upload studio for every new video. Saved on this device. Each upload can still change them.
          </p>

          <div className="hub-field" style={{ marginBottom: 10 }}>
            <label className="hub-label" htmlFor="pref-vis">
              Visibility
            </label>
            <select id="pref-vis" className="hub-select" value={prefs.visibility} onChange={(e) => save("visibility", e.target.value as PublishDefaults["visibility"])}>
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
              <option value="private">Private</option>
            </select>
          </div>

          <div className="hub-field" style={{ marginBottom: 10 }}>
            <label className="hub-label" htmlFor="pref-topic">
              Topic
            </label>
            <select id="pref-topic" className="hub-select" value={prefs.topic} onChange={(e) => save("topic", e.target.value)}>
              <option value="">Not set</option>
              {topics.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
              {prefs.topic && !topics.some((c) => c.slug === prefs.topic) ? <option value={prefs.topic}>{prefs.topic}</option> : null}
            </select>
          </div>

          <div className="hub-field" style={{ marginBottom: 10 }}>
            <label className="hub-label" htmlFor="pref-license">
              License
            </label>
            <select id="pref-license" className="hub-select" value={prefs.license} onChange={(e) => save("license", e.target.value as PublishDefaults["license"])}>
              {PUBLISH_LICENSES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
            <span className="hub-hint">{PUBLISH_LICENSES.find((l) => l.id === prefs.license)?.hint}</span>
          </div>

          <div className="hub-field" style={{ marginBottom: 6 }}>
            <label className="hub-label" htmlFor="pref-lang">
              Language
            </label>
            <select id="pref-lang" className="hub-select" value={prefs.language} onChange={(e) => save("language", e.target.value)}>
              {PUBLISH_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <SwitchRow label="Conversations on" hint="New videos accept comments." checked={prefs.comments} onChange={(v) => save("comments", v)} />

          <p className="hub-hint" style={{ marginTop: 10 }}>
            Stored as <code>{PUBLISH_DEFAULTS_KEY}</code>; the studio reads it with <code>getPublishDefaults()</code>.
          </p>
        </section>

        <section className="hub-card hub-card-pad">
          <div className="hub-section-head">
            <span className="hub-section-title">Moderation</span>
          </div>
          <div className="hub-links">
            <Link href="/settings/hidden-channels">
              <span>
                Hidden channels
                <br />
                <small>Creators you asked not to be recommended.</small>
              </span>
              <ChevronRight size={14} aria-hidden="true" />
            </Link>
            <Link href="/settings/blocked">
              <span>
                Blocked people
                <br />
                <small>They cannot see or comment on your content.</small>
              </span>
              <ChevronRight size={14} aria-hidden="true" />
            </Link>
            <Link href="/settings/privacy">
              <span>
                Privacy
                <br />
                <small>Who can comment and message you.</small>
              </span>
              <ChevronRight size={14} aria-hidden="true" />
            </Link>
          </div>
          <p className="hub-hint" style={{ marginTop: 10 }}>
            Blocked words for comments are not on the web yet; when the keyword filters page ships under Settings it is linked from here.
          </p>
        </section>
      </div>
    </>
  );
}
