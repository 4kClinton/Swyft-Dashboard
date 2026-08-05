import React, { useState, useEffect } from "react";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

// Same convention as Pricing.jsx: dev routes through the Vite proxy, prod hits
// Convex directly. Auth is the shared command-centre bearer key.
const SITE_URL = import.meta.env.DEV
  ? "/convex-proxy"
  : (import.meta.env.VITE_CONVEX_SITE_URL_PROD || "").replace(/\/$/, "");

const API_KEY = import.meta.env.VITE_ANALYTICS_API_KEY;

const VERSION_RE = /^\d+(\.\d+){0,3}$/;

const DEFAULTS = {
  minSupportedVersion: "1.0.0",
  latestVersion: "1.0.0",
  androidStoreUrl:
    "https://play.google.com/store/apps/details?id=com.swyft.africa",
  iosStoreUrl: "",
};

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  background: "var(--surface-3)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text-primary)",
  fontSize: "14px",
  fontWeight: 600,
  outline: "none",
  transition: "border-color 150ms ease",
  fontFamily: "inherit",
};

const cardStyle = {
  background: "var(--surface-1)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  padding: "24px",
};

function SectionTitle({ title, subtitle }) {
  return (
    <div style={{ marginBottom: "18px" }}>
      <h2 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em", margin: 0 }}>
        {title}
      </h2>
      {subtitle && (
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "3px" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function Field({ label, hint, value, onChange, placeholder }) {
  return (
    <div>
      <label style={{
        display: "block",
        fontSize: "11px", color: "var(--text-secondary)",
        textTransform: "uppercase", letterSpacing: "0.06em",
        fontWeight: 600, marginBottom: "7px",
      }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
        onFocus={(e) => { e.target.style.borderColor = "var(--accent-border)"; }}
        onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
      />
      {hint && (
        <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "5px", lineHeight: "1.4" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function AppUpdates() {
  const [cfg, setCfg] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    fetchGate();
  }, []);

  async function fetchGate() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`${SITE_URL}/api/version-gate`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCfg({ ...DEFAULTS, ...data });
      } else {
        const txt = await res.text().catch(() => "");
        setStatus({ type: "error", message: `Fetch failed ${res.status}: ${txt || res.statusText}` });
      }
    } catch (e) {
      setStatus({ type: "error", message: `Network error: ${e.message}` });
    }
    setLoading(false);
  }

  async function saveGate() {
    if (!VERSION_RE.test(cfg.minSupportedVersion)) {
      setStatus({ type: "error", message: "Minimum version must look like 1.2.3" });
      return;
    }
    if (cfg.latestVersion && !VERSION_RE.test(cfg.latestVersion)) {
      setStatus({ type: "error", message: "Latest version must look like 1.2.3" });
      return;
    }
    // Guardrail: forcing an update to a build that isn't live yet locks everyone
    // out. Require the operator to confirm.
    const ok = window.confirm(
      `This will HARD-BLOCK every user on an app version older than ${cfg.minSupportedVersion}.\n\n` +
      `Only do this AFTER that build is live on the store. Continue?`
    );
    if (!ok) return;

    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`${SITE_URL}/api/version-gate`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          minSupportedVersion: cfg.minSupportedVersion,
          latestVersion: cfg.latestVersion || undefined,
          androidStoreUrl: cfg.androidStoreUrl,
          iosStoreUrl: cfg.iosStoreUrl,
        }),
      });
      if (res.ok) {
        setStatus({ type: "success", message: "Update gate saved. Older clients will be blocked on next launch/foreground." });
      } else {
        const txt = await res.text().catch(() => "");
        setStatus({ type: "error", message: `Save failed: ${txt || res.statusText}` });
      }
    } catch (e) {
      setStatus({ type: "error", message: `Network error: ${e.message}` });
    }
    setSaving(false);
  }

  const set = (key, val) => setCfg((c) => ({ ...c, [key]: val }));

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "200px", color: "var(--text-secondary)", fontSize: "14px" }}>
        Loading update configuration...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "720px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", margin: 0 }}>
            App Updates
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
            Force users onto a new native build after a store release.
          </p>
        </div>
        <button
          onClick={fetchGate}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "8px 14px",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-secondary)",
            fontSize: "12px", fontWeight: 500,
            cursor: "pointer", transition: "all 150ms ease",
            fontFamily: "inherit", flexShrink: 0,
          }}
        >
          <RefreshIcon style={{ fontSize: "16px" }} />
          Refresh
        </button>
      </div>

      {/* Status banner */}
      {status && (
        <div style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: "12px 16px",
          background: status.type === "success" ? "var(--accent-dim)" : "var(--danger-dim)",
          border: `1px solid ${status.type === "success" ? "var(--accent-border)" : "rgba(239,68,68,0.25)"}`,
          borderRadius: "var(--radius-sm)",
          fontSize: "13px",
          color: status.type === "success" ? "var(--accent)" : "var(--danger)",
        }}>
          {status.type === "success"
            ? <CheckCircleOutlineIcon style={{ fontSize: "18px" }} />
            : <ErrorOutlineIcon style={{ fontSize: "18px" }} />}
          {status.message}
        </div>
      )}

      {/* How it works */}
      <div style={{
        display: "flex", gap: "10px",
        padding: "14px 16px",
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5,
      }}>
        <WarningAmberIcon style={{ fontSize: "18px", color: "var(--warning, #F59E0B)", flexShrink: 0, marginTop: "1px" }} />
        <span>
          JS-only changes ship silently over-the-air (OTA) — you don't touch this page for those.
          Use it only for <strong style={{ color: "var(--text-primary)" }}>native</strong> releases
          (new store build). Set <strong style={{ color: "var(--text-primary)" }}>Minimum supported version</strong> to
          the oldest version you still allow; anyone older is hard-blocked with an "Update required"
          screen until they install from the store. Bump it only <strong style={{ color: "var(--text-primary)" }}>after</strong> the
          build is live.
        </span>
      </div>

      {/* Version gate */}
      <div style={cardStyle}>
        <SectionTitle
          title="Version Gate"
          subtitle="Compared against each client's installed native app version."
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "20px" }}>
          <Field
            label="Minimum supported version"
            hint="Older binaries are hard-blocked. e.g. 1.1.0"
            value={cfg.minSupportedVersion}
            placeholder="1.0.0"
            onChange={(v) => set("minSupportedVersion", v)}
          />
          <Field
            label="Latest version (info only)"
            hint="Newest version in the store. Not enforced."
            value={cfg.latestVersion}
            placeholder="1.0.0"
            onChange={(v) => set("latestVersion", v)}
          />
        </div>
      </div>

      {/* Store links */}
      <div style={cardStyle}>
        <SectionTitle
          title="Store Links"
          subtitle="Where the 'Update now' button sends users. Leave iOS blank until the App Store listing is live."
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px" }}>
          <Field
            label="Android (Play Store) URL"
            value={cfg.androidStoreUrl}
            placeholder="https://play.google.com/store/apps/details?id=com.swyft.africa"
            onChange={(v) => set("androidStoreUrl", v)}
          />
          <Field
            label="iOS (App Store) URL"
            hint="Blank = iOS users are never blocked (fail-open)."
            value={cfg.iosStoreUrl}
            placeholder="https://apps.apple.com/app/id..."
            onChange={(v) => set("iosStoreUrl", v)}
          />
        </div>
      </div>

      {/* Save */}
      <div style={{ display: "flex", justifyContent: "flex-end", paddingBottom: "8px" }}>
        <button
          onClick={saveGate}
          disabled={saving}
          style={{
            padding: "11px 28px",
            background: saving ? "var(--accent-dim)" : "var(--accent)",
            border: saving ? "1px solid var(--accent-border)" : "none",
            borderRadius: "var(--radius-sm)",
            color: saving ? "var(--accent)" : "#07080D",
            fontSize: "14px", fontWeight: 700,
            cursor: saving ? "not-allowed" : "pointer",
            transition: "all 150ms ease",
            fontFamily: "inherit",
            letterSpacing: "-0.01em",
          }}
        >
          {saving ? "Saving..." : "Save Gate"}
        </button>
      </div>
    </div>
  );
}

export default AppUpdates;
