import React, { useState, useEffect, useCallback } from "react";
import RefreshIcon from "@mui/icons-material/Refresh";

// Command-centre Disputes view (adjustmentPlan Phase 8b). Lists tenant reports;
// Swyft resolves each (refund → queued to the manual settlement ledger, dismiss)
// or escalates to a scout suspension.
const API_KEY = import.meta.env.VITE_ANALYTICS_API_KEY || "";

const ENVS = {
  dev:  { siteUrl: import.meta.env.VITE_CONVEX_SITE_URL_DEV  || "", label: "Development", tag: "DEV",  color: "#F59E0B" },
  prod: { siteUrl: import.meta.env.VITE_CONVEX_SITE_URL_PROD || "", label: "Production",  tag: "PROD", color: "#00D46A" },
};

const STATUS_META = {
  open:          { label: "Open",          color: "#F59E0B" },
  investigating: { label: "Investigating", color: "#3B82F6" },
  resolved:      { label: "Resolved",      color: "#10B981" },
  dismissed:     { label: "Dismissed",     color: "#6B7280" },
};

const REASON_LABEL = {
  no_show: "Scout no-show",
  fewer_houses: "Fewer houses shown",
  misrepresented: "Misrepresented",
  rude: "Rude / unprofessional",
  other: "Other",
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

export default function Disputes() {
  const [env, setEnv] = useState("prod");
  const [statusFilter, setStatusFilter] = useState("open");
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const siteUrl = ENVS[env].siteUrl;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = statusFilter ? `?status=${statusFilter}` : "";
      const data = await apiFetch(siteUrl, `/api/disputes${q}`);
      setDisputes(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setDisputes([]);
    }
    setLoading(false);
  }, [siteUrl, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function resolve(d, status, opts = {}) {
    setBusyId(d._id);
    try {
      await apiFetch(siteUrl, `/api/disputes/resolve`, {
        method: "POST",
        body: JSON.stringify({ id: d._id, status, ...opts }),
      });
      await load();
    } catch (e) { console.error(e); }
    setBusyId(null);
  }

  async function suspend(d) {
    if (!window.confirm(`Suspend ${d.scoutName}? They will be locked out of the scout app and their payouts frozen.`)) return;
    setBusyId(d._id);
    try {
      await apiFetch(siteUrl, `/api/disputes/resolve`, {
        method: "POST",
        body: JSON.stringify({
          id: d._id, status: "resolved",
          resolution: "Escalated — scout suspended.",
          suspendScoutId: d.scoutId,
          suspendReason: `Suspended following a ${REASON_LABEL[d.reason] || d.reason} report.`,
        }),
      });
      await load();
    } catch (e) { console.error(e); }
    setBusyId(null);
  }

  const card = {
    background: "var(--surface-1)", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", padding: "16px",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", margin: 0 }}>
            Disputes
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
            Tenant reports on tours — resolve, refund, or suspend the scout.
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
        {["open", "investigating", "resolved", "dismissed", ""].map((s) => (
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

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>Loading…</div>
      ) : disputes.length === 0 ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>No disputes</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {disputes.map((d) => {
            const meta = STATUS_META[d.status] || {};
            return (
              <div key={d._id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
                      {REASON_LABEL[d.reason] || d.reason}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                      Scout: {d.scoutName} · Reporter {String(d.reporterUserId).slice(-6)} · {new Date(d.createdAt).toLocaleString()}
                    </div>
                    {d.description && (
                      <div style={{ fontSize: "13px", color: "var(--text-primary)", marginTop: "8px" }}>{d.description}</div>
                    )}
                    {d.resolution && (
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "6px" }}>
                        Resolution: {d.resolution}{d.refundIssued ? " · refund queued" : ""}
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "999px",
                    background: `${meta.color}20`, color: meta.color, textTransform: "uppercase", letterSpacing: "0.04em",
                  }}>
                    {meta.label || d.status}
                  </span>
                </div>

                {(d.status === "open" || d.status === "investigating") && (
                  <div style={{ display: "flex", gap: "8px", marginTop: "14px", flexWrap: "wrap" }}>
                    {d.status === "open" && (
                      <button disabled={busyId === d._id} onClick={() => resolve(d, "investigating")}
                        style={{ padding: "7px 12px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                        Investigating
                      </button>
                    )}
                    <button disabled={busyId === d._id} onClick={() => resolve(d, "resolved", { refundIssued: true, resolution: "Refund issued to tenant." })}
                      style={{ padding: "7px 12px", background: "#10B981", border: "none", borderRadius: "var(--radius-sm)", color: "#07080D", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                      Resolve + refund
                    </button>
                    <button disabled={busyId === d._id} onClick={() => resolve(d, "dismissed", { resolution: "Dismissed — no action." })}
                      style={{ padding: "7px 12px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                      Dismiss
                    </button>
                    <button disabled={busyId === d._id} onClick={() => suspend(d)}
                      style={{ padding: "7px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--radius-sm)", color: "#EF4444", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                      Suspend scout
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
