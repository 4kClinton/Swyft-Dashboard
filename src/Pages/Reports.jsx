import React, { useState, useEffect, useCallback } from "react";
import RefreshIcon from "@mui/icons-material/Refresh";

// Unified command-centre Reports inbox. Every report entry point in the app
// (report-a-listing, "asked me for money"/scam safety reports, and tour
// disputes mirrored from the disputes table) funnels here with a ticket. Ops
// triages each — start reviewing, resolve, or dismiss. Tour reports carry a
// disputeId; the refund/suspend workflow lives on the Disputes page.
const API_KEY = import.meta.env.VITE_ANALYTICS_API_KEY || "";

const ENVS = {
  dev:  { siteUrl: import.meta.env.VITE_CONVEX_SITE_URL_DEV  || "", label: "Development", tag: "DEV",  color: "#F59E0B" },
  prod: { siteUrl: import.meta.env.VITE_CONVEX_SITE_URL_PROD || "", label: "Production",  tag: "PROD", color: "#00D46A" },
};

const STATUS_META = {
  open:       { label: "Open",       color: "#F59E0B" },
  reviewing:  { label: "Reviewing",  color: "#3B82F6" },
  resolved:   { label: "Resolved",   color: "#10B981" },
  dismissed:  { label: "Dismissed",  color: "#6B7280" },
};

const CATEGORY_META = {
  listing: { label: "Listing",  color: "#3B82F6", icon: "🏠" },
  safety:  { label: "Safety",   color: "#EF4444", icon: "🚨" },
  tour:    { label: "Tour",     color: "#8B5CF6", icon: "🧭" },
  other:   { label: "Other",    color: "#6B7280", icon: "📄" },
};

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

export default function Reports() {
  const [env, setEnv] = useState("prod");
  const [statusFilter, setStatusFilter] = useState("open");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const siteUrl = ENVS[env].siteUrl;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = statusFilter ? `?status=${statusFilter}` : "";
      const data = await apiFetch(siteUrl, `/api/reports${q}`);
      setReports(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setReports([]);
    }
    setLoading(false);
  }, [siteUrl, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function resolve(r, status, opts = {}) {
    setBusyId(r._id);
    try {
      await apiFetch(siteUrl, `/api/reports/resolve`, {
        method: "POST",
        body: JSON.stringify({ id: r._id, status, ...opts }),
      });
      await load();
    } catch (e) { console.error(e); }
    setBusyId(null);
  }

  const shown = categoryFilter ? reports.filter((r) => r.category === categoryFilter) : reports;

  const card = {
    background: "var(--surface-1)", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", padding: "16px",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", margin: 0 }}>
            Reports
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
            Every report from the app — listings, safety (asked for money / scam), and tour disputes.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <select value={env} onChange={(e) => setEnv(e.target.value)}
            style={{ padding: "8px 10px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: "13px" }}>
            <option value="prod">Production</option>
            <option value="dev">Development</option>
          </select>
          <button onClick={load} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-secondary)", fontSize: "12px", cursor: "pointer" }}>
            <RefreshIcon style={{ fontSize: "16px" }} /> Refresh
          </button>
        </div>
      </div>

      {/* Status filter */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {["open", "reviewing", "resolved", "dismissed", ""].map((s) => (
          <button key={s || "all"} onClick={() => setStatusFilter(s)}
            style={{
              padding: "6px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
              border: `1px solid ${statusFilter === s ? "var(--accent-border, #10B981)" : "var(--border)"}`,
              background: statusFilter === s ? "var(--accent-dim, rgba(16,185,129,0.12))" : "transparent",
              color: statusFilter === s ? "var(--accent, #10B981)" : "var(--text-secondary)",
            }}>
            {s ? (STATUS_META[s]?.label || s) : "All"}
          </button>
        ))}
      </div>

      {/* Category filter */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {["", "safety", "listing", "tour", "other"].map((c) => (
          <button key={c || "allcat"} onClick={() => setCategoryFilter(c)}
            style={{
              padding: "5px 12px", borderRadius: "999px", fontSize: "11px", fontWeight: 600, cursor: "pointer",
              border: `1px solid ${categoryFilter === c ? (CATEGORY_META[c]?.color || "#10B981") : "var(--border)"}`,
              background: "transparent",
              color: categoryFilter === c ? (CATEGORY_META[c]?.color || "#10B981") : "var(--text-secondary)",
            }}>
            {c ? `${CATEGORY_META[c].icon} ${CATEGORY_META[c].label}` : "All types"}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>Loading…</div>
      ) : shown.length === 0 ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>No reports</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {shown.map((r) => {
            const meta = STATUS_META[r.status] || {};
            const cat = CATEGORY_META[r.category] || CATEGORY_META.other;
            return (
              <div key={r._id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: 700, color: "var(--accent, #10B981)", background: "var(--surface-2)", padding: "2px 8px", borderRadius: "6px" }}>
                        {r.ticket}
                      </span>
                      <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", background: `${cat.color}20`, color: cat.color }}>
                        {cat.icon} {cat.label}
                      </span>
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginTop: "8px" }}>
                      {r.reason}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                      {r.reelTitle ? `Listing: ${r.reelTitle} · ` : ""}
                      {r.scoutName ? `Scout: ${r.scoutName} · ` : ""}
                      Reporter {String(r.reporterUserId).slice(-6)} · {new Date(r.createdAt).toLocaleString()}
                    </div>
                    {r.description && (
                      <div style={{ fontSize: "13px", color: "var(--text-primary)", marginTop: "8px" }}>{r.description}</div>
                    )}
                    {r.disputeId && (
                      <div style={{ fontSize: "12px", color: "#8B5CF6", marginTop: "6px" }}>
                        ↪ Refund / suspend actions on the Disputes page.
                      </div>
                    )}
                    {r.resolution && (
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "6px" }}>
                        Resolution: {r.resolution}
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "999px",
                    background: `${meta.color}20`, color: meta.color, textTransform: "uppercase", letterSpacing: "0.04em",
                  }}>
                    {meta.label || r.status}
                  </span>
                </div>

                {(r.status === "open" || r.status === "reviewing") && (
                  <div style={{ display: "flex", gap: "8px", marginTop: "14px", flexWrap: "wrap" }}>
                    {r.status === "open" && (
                      <button disabled={busyId === r._id} onClick={() => resolve(r, "reviewing")}
                        style={{ padding: "7px 12px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                        Reviewing
                      </button>
                    )}
                    <button disabled={busyId === r._id} onClick={() => resolve(r, "resolved", { resolution: "Resolved." })}
                      style={{ padding: "7px 12px", background: "#10B981", border: "none", borderRadius: "var(--radius-sm)", color: "#07080D", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                      Resolve
                    </button>
                    <button disabled={busyId === r._id} onClick={() => resolve(r, "dismissed", { resolution: "Dismissed — no action." })}
                      style={{ padding: "7px 12px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
