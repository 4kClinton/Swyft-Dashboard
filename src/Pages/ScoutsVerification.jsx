import React, { useState, useEffect, useCallback } from "react";
import Modal from "../components/Modal";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import PersonIcon from "@mui/icons-material/Person";
import RefreshIcon from "@mui/icons-material/Refresh";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

const API_KEY = import.meta.env.VITE_ANALYTICS_API_KEY || "";

const ENVS = {
  dev:  { siteUrl: import.meta.env.VITE_CONVEX_SITE_URL_DEV  || "", cloudUrl: import.meta.env.VITE_CONVEX_CLOUD_URL_DEV  || "", label: "Development", tag: "DEV",  color: "#F59E0B" },
  prod: { siteUrl: import.meta.env.VITE_CONVEX_SITE_URL_PROD || "", cloudUrl: import.meta.env.VITE_CONVEX_CLOUD_URL_PROD || "", label: "Production",  tag: "PROD", color: "#00D46A" },
};

const STATUSES = [
  { key: "pending",  label: "Pending",  color: "#F59E0B", dim: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.3)"  },
  { key: "approved", label: "Approved", color: "#00D46A", dim: "rgba(0,212,106,0.08)",  border: "rgba(0,212,106,0.18)"  },
  { key: "rejected", label: "Rejected", color: "#EF4444", dim: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.18)"  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function apiFetch(siteUrl, path, options = {}) {
  const url = `${siteUrl.replace(/\/$/, "")}${path}`;
  const headers = { "Content-Type": "application/json" };
  if (API_KEY) headers["Authorization"] = `Bearer ${API_KEY}`;
  Object.assign(headers, options.headers || {});
  return fetch(url, { ...options, headers }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return res.json();
  });
}

// Build a Convex storage URL from a storage ID
function storageUrl(cloudUrl, storageId) {
  if (!storageId || !cloudUrl) return null;
  return `${cloudUrl.replace(/\/$/, "")}/api/storage/${storageId}`;
}

function fmtDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtEarnings(v) {
  if (v == null) return "—";
  return `KES ${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const s = STATUSES.find((x) => x.key === status?.toLowerCase());
  if (!s) return <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{status || "unknown"}</span>;
  return (
    <span style={{ background: s.dim, border: `1px solid ${s.border}`, color: s.color, borderRadius: "var(--radius-xs)", padding: "2px 8px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

// ── KYC image (uses plain <img> — Convex signed URLs are public, no fetch needed) ──

function KycImage({ src, alt, style }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const wrapStyle = { ...style, position: "relative", overflow: "hidden", background: "var(--surface-3)", display: "flex", alignItems: "center", justifyContent: "center" };

  if (!src || errored) return (
    <div style={{ ...wrapStyle, flexDirection: "column", gap: "6px" }}>
      <PersonIcon style={{ fontSize: "32px", color: "var(--text-muted)" }} />
      <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>No image</span>
    </div>
  );

  return (
    <a href={src} target="_blank" rel="noopener noreferrer" style={{ display: "block", cursor: "zoom-in", ...style, position: "relative", overflow: "hidden" }}>
      {!loaded && (
        <div style={{ ...wrapStyle, position: "absolute", inset: 0 }}>
          <div style={{ width: "20px", height: "20px", border: "2px solid var(--border-hover)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "sv-spin 0.8s linear infinite" }} />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: loaded ? "block" : "none" }}
      />
      {loaded && (
        <div style={{ position: "absolute", top: "6px", right: "6px", background: "rgba(0,0,0,0.5)", borderRadius: "4px", padding: "2px 5px", display: "flex", alignItems: "center", gap: "3px" }}>
          <OpenInNewIcon style={{ fontSize: "10px", color: "#fff" }} />
          <span style={{ fontSize: "9px", color: "#fff", fontWeight: 500 }}>View</span>
        </div>
      )}
    </a>
  );
}

// ── Env toggle ─────────────────────────────────────────────────────────────────

function EnvToggle({ env, setEnv }) {
  return (
    <div style={{ display: "flex", background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "4px", gap: "4px" }}>
      {Object.entries(ENVS).map(([key, cfg]) => (
        <button key={key} onClick={() => setEnv(key)} style={{
          padding: "6px 16px", borderRadius: "var(--radius-xs)",
          background: env === key ? cfg.color + "1A" : "transparent",
          border: env === key ? `1px solid ${cfg.color}40` : "1px solid transparent",
          color: env === key ? cfg.color : "var(--text-secondary)",
          fontSize: "12px", fontWeight: env === key ? 700 : 500,
          cursor: "pointer", letterSpacing: "0.04em", transition: "all 150ms ease",
        }}>{cfg.tag}</button>
      ))}
    </div>
  );
}

// ── Scout detail modal ─────────────────────────────────────────────────────────

function ScoutModal({ scout, env, onClose, onVerify, verifying }) {
  const status = (scout.status || "").toLowerCase();

  const images = [
    { label: "Selfie",     url: scout.selfieUrl    },
    { label: "ID Front",   url: scout.idFrontUrl   },
    { label: "ID Back",    url: scout.idBackUrl    },
    { label: "Holding ID", url: scout.holdingIdUrl },
  ];

  return (
    <Modal isOpen onClose={onClose} title={scout.govName || "Scout"} wide>
      {/* Info strip */}
      <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginBottom: "24px" }}>
        <div>
          <p style={lblStyle}>Status</p>
          <StatusBadge status={status} />
        </div>
        <div>
          <p style={lblStyle}>Legal Name</p>
          <p style={valStyle}>{scout.govName || "—"}</p>
        </div>
        <div>
          <p style={lblStyle}>User ID</p>
          <p style={{ ...valStyle, fontFamily: "monospace", fontSize: "11px", color: "var(--text-muted)" }} title={scout.userId}>{scout.userId || "—"}</p>
        </div>
        <div>
          <p style={lblStyle}>Submitted</p>
          <p style={valStyle}>{fmtDate(scout.submittedAt)}</p>
        </div>
        <div>
          <p style={lblStyle}>Earnings</p>
          <p style={{ ...valStyle, color: scout.earnings > 0 ? "var(--accent)" : "var(--text-secondary)" }}>{fmtEarnings(scout.earnings)}</p>
        </div>
      </div>

      {/* KYC images */}
      <p style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "14px" }}>
        KYC Documents
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px", marginBottom: "24px" }}>
        {images.map(({ label, url }) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <KycImage
              src={url}
              alt={label}
              style={{ width: "100%", height: "180px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}
            />
            <p style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-muted)", textAlign: "center" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Action buttons — pending only */}
      {status === "pending" && (
        <div style={{ display: "flex", gap: "10px", paddingTop: "4px", borderTop: "1px solid var(--border)" }}>
          <button
            onClick={() => onVerify(scout._id, "approve")}
            disabled={verifying}
            style={actionBtn("#00D46A", "rgba(0,212,106,0.08)", "rgba(0,212,106,0.25)", verifying)}
          >
            <CheckCircleOutlineIcon fontSize="small" />
            {verifying ? "Processing…" : "Approve Scout"}
          </button>
          <button
            onClick={() => onVerify(scout._id, "reject")}
            disabled={verifying}
            style={actionBtn("#EF4444", "rgba(239,68,68,0.08)", "rgba(239,68,68,0.25)", verifying)}
          >
            <CancelOutlinedIcon fontSize="small" />
            {verifying ? "Processing…" : "Reject Scout"}
          </button>
        </div>
      )}
    </Modal>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

function ScoutsVerification() {
  const [env, setEnvState] = useState(() => localStorage.getItem("analytics_env") || "dev");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [scouts, setScouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedScout, setSelectedScout] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [toast, setToast] = useState(null);

  const setEnv = (v) => { localStorage.setItem("analytics_env", v); setEnvState(v); };

  const fetchScouts = useCallback(async (currentEnv, status) => {
    const { siteUrl } = ENVS[currentEnv];
    if (!siteUrl) { setError(`VITE_CONVEX_SITE_URL_${currentEnv.toUpperCase()} not set.`); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(siteUrl, `/api/scouts?status=${status}`);
      setScouts(Array.isArray(data) ? data : data.scouts ?? data.data ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchScouts(env, statusFilter); }, [env, statusFilter, fetchScouts]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleVerify = async (scoutId, action) => {
    const { siteUrl } = ENVS[env];
    setVerifying(true);
    try {
      await apiFetch(siteUrl, "/api/scouts/verify", {
        method: "POST",
        body: JSON.stringify({ scoutId, action }),
      });
      showToast(`Scout ${action === "approve" ? "approved" : "rejected"} successfully.`, "success");
      setSelectedScout(null);
      setScouts((prev) => prev.filter((s) => s._id !== scoutId));
    } catch (err) {
      showToast(`Failed to ${action}: ${err.message}`, "error");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: "20px", right: "24px", zIndex: 200,
          background: toast.type === "success" ? "rgba(0,212,106,0.12)" : "var(--danger-dim)",
          border: `1px solid ${toast.type === "success" ? "rgba(0,212,106,0.3)" : "rgba(239,68,68,0.3)"}`,
          color: toast.type === "success" ? "var(--accent)" : "var(--danger)",
          borderRadius: "var(--radius-md)", padding: "12px 18px", fontSize: "13px", fontWeight: 500,
          boxShadow: "var(--shadow-md)", animation: "sv-fadein 200ms ease",
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Scouts Verification</h1>
            {statusFilter === "pending" && scouts.length > 0 && (
              <span style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#F59E0B", borderRadius: "var(--radius-xs)", padding: "2px 8px", fontSize: "11px", fontWeight: 700 }}>
                {scouts.length} pending
              </span>
            )}
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "3px" }}>
            KYC review — {ENVS[env].label}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={() => fetchScouts(env, statusFilter)}
            disabled={loading}
            style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-secondary)", cursor: loading ? "default" : "pointer", padding: "6px 8px", display: "flex", alignItems: "center", transition: "all 150ms ease" }}
            onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.borderColor = "var(--border-hover)"; e.currentTarget.style.color = "var(--text-primary)"; } }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          >
            <RefreshIcon fontSize="small" style={{ animation: loading ? "sv-spin 0.8s linear infinite" : "none" }} />
          </button>
          <EnvToggle env={env} setEnv={setEnv} />
        </div>
      </div>

      {/* Status tabs */}
      <div style={{ display: "flex", gap: "6px", background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "6px", width: "fit-content" }}>
        {STATUSES.map((s) => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(s.key)}
            style={{
              padding: "7px 20px", borderRadius: "var(--radius-sm)",
              background: statusFilter === s.key ? s.dim : "transparent",
              border: statusFilter === s.key ? `1px solid ${s.border}` : "1px solid transparent",
              color: statusFilter === s.key ? s.color : "var(--text-secondary)",
              fontSize: "13px", fontWeight: statusFilter === s.key ? 600 : 400,
              cursor: "pointer", transition: "all 150ms ease", whiteSpace: "nowrap",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: "var(--danger-dim)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "var(--radius-md)", padding: "12px 16px", fontSize: "13px", color: "var(--danger)" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "180px", flexDirection: "column", gap: "12px" }}>
          <div style={{ width: "24px", height: "24px", border: "2px solid var(--border-hover)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "sv-spin 0.8s linear infinite" }} />
          <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Loading scouts…</span>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
          {scouts.length === 0 ? (
            <div style={{ padding: "60px", textAlign: "center" }}>
              <p style={{ fontSize: "15px", color: "var(--text-secondary)", fontWeight: 500 }}>No {statusFilter} scouts</p>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "6px" }}>
                {statusFilter === "pending" ? "All applications have been reviewed." : `No scouts with "${statusFilter}" status.`}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Scout", "User ID", "Submitted", "Earnings", "Status", "Actions"].map((h) => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "10px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scouts.map((scout, i) => {
                    const name     = scout.govName || `Scout #${i + 1}`;
                    const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
                    const status   = scout.status || "pending";

                    return (
                      <tr
                        key={scout._id || i}
                        onClick={() => setSelectedScout(scout)}
                        style={{ borderBottom: "1px solid var(--border)", cursor: "pointer", transition: "background 100ms" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        {/* Name with avatar */}
                        <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "var(--accent-dim)", border: "1px solid var(--accent-border)", color: "var(--accent)", fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {initials || "?"}
                            </div>
                            <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{name}</span>
                          </div>
                        </td>
                        {/* User ID */}
                        <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                          <span style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--text-muted)" }} title={scout.userId}>
                            {scout.userId ? scout.userId.slice(0, 14) + "…" : "—"}
                          </span>
                        </td>
                        {/* Submitted */}
                        <td style={{ padding: "12px 16px", color: "var(--text-muted)", whiteSpace: "nowrap", fontSize: "12px" }}>
                          {fmtDate(scout.submittedAt)}
                        </td>
                        {/* Earnings */}
                        <td style={{ padding: "12px 16px", whiteSpace: "nowrap", color: scout.earnings > 0 ? "var(--accent)" : "var(--text-muted)", fontSize: "12px" }}>
                          {fmtEarnings(scout.earnings)}
                        </td>
                        {/* Status */}
                        <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                          <StatusBadge status={status} />
                        </td>
                        {/* Actions */}
                        <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", gap: "6px" }} onClick={(e) => e.stopPropagation()}>
                            {status.toLowerCase() === "pending" && (
                              <>
                                <button onClick={() => handleVerify(scout._id, "approve")} title="Approve" style={qBtn("#00D46A", "rgba(0,212,106,0.1)", "rgba(0,212,106,0.25)")}>
                                  <CheckCircleOutlineIcon style={{ fontSize: "16px" }} />
                                </button>
                                <button onClick={() => handleVerify(scout._id, "reject")} title="Reject" style={qBtn("#EF4444", "rgba(239,68,68,0.08)", "rgba(239,68,68,0.25)")}>
                                  <CancelOutlinedIcon style={{ fontSize: "16px" }} />
                                </button>
                              </>
                            )}
                            <button onClick={() => setSelectedScout(scout)} title="View KYC documents" style={qBtn("var(--text-secondary)", "var(--surface-2)", "var(--border-hover)")}>
                              <PersonIcon style={{ fontSize: "16px" }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Scout detail modal */}
      {selectedScout && (
        <ScoutModal
          scout={selectedScout}
          env={env}
          onClose={() => setSelectedScout(null)}
          onVerify={handleVerify}
          verifying={verifying}
        />
      )}

      <style>{`
        @keyframes sv-spin   { to { transform: rotate(360deg); } }
        @keyframes sv-fadein { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}

// ── Style helpers ──────────────────────────────────────────────────────────────

const lblStyle = { fontSize: "10px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "4px" };
const valStyle = { fontSize: "13px", color: "var(--text-primary)", fontWeight: 500 };

function actionBtn(color, bg, border, disabled) {
  return { display: "flex", alignItems: "center", gap: "6px", padding: "10px 20px", marginTop: "16px", background: disabled ? "var(--surface-2)" : bg, border: `1px solid ${disabled ? "var(--border)" : border}`, borderRadius: "var(--radius-sm)", color: disabled ? "var(--text-muted)" : color, fontSize: "13px", fontWeight: 600, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1, transition: "all 150ms ease" };
}

function qBtn(color, bg, border) {
  return { display: "flex", alignItems: "center", justifyContent: "center", width: "30px", height: "30px", background: bg, border: `1px solid ${border}`, borderRadius: "var(--radius-xs)", color, cursor: "pointer", transition: "all 150ms ease" };
}

export default ScoutsVerification;
