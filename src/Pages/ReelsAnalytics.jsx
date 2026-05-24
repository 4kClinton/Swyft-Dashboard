import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
} from "recharts";
import RefreshIcon from "@mui/icons-material/Refresh";

const API_KEY = import.meta.env.VITE_ANALYTICS_API_KEY || "";

const ENVS = {
  dev:  { siteUrl: import.meta.env.VITE_CONVEX_SITE_URL_DEV  || "", label: "Development", tag: "DEV",  color: "#F59E0B" },
  prod: { siteUrl: import.meta.env.VITE_CONVEX_SITE_URL_PROD || "", label: "Production",  tag: "PROD", color: "#00D46A" },
};

const REFRESH_MS = 5000;

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtWatchMs(ms) {
  if (!ms) return "0s";
  if (ms < 1_000)       return `${Math.round(ms)}ms`;
  if (ms < 60_000)      return `${(ms / 1_000).toFixed(1)}s`;
  if (ms < 3_600_000)   return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1_000)}s`;
  return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
}

function fmtRelative(date) {
  if (!date) return null;
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 5)  return "just now";
  if (diff < 60) return `${diff}s ago`;
  return `${Math.floor(diff / 60)}m ago`;
}

function truncId(id, len = 12) {
  return id ? `${id.slice(0, len)}…` : "—";
}

// ── Small UI pieces ────────────────────────────────────────────────────────────

function StatCard({ title, value, sub, accent }) {
  return (
    <div style={{
      background: "var(--surface-1)", border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)", padding: "18px 20px",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 0, right: 0, width: "80px", height: "80px", background: "radial-gradient(circle at top right, var(--accent-dim), transparent 70%)", pointerEvents: "none" }} />
      <p style={{ fontSize: "11px", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "8px" }}>{title}</p>
      <p style={{ fontSize: "28px", fontWeight: 700, color: accent || "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1 }}>{value ?? "—"}</p>
      {sub && <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "5px" }}>{sub}</p>}
    </div>
  );
}

function SectionLabel({ children }) {
  return <p style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "12px" }}>{children}</p>;
}

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

function ChartTip({ active, payload, label, fmtValue }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-hover)", borderRadius: "var(--radius-sm)", padding: "8px 12px", fontSize: "12px" }}>
      <p style={{ color: "var(--text-secondary)", marginBottom: "4px" }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color || "var(--accent)", fontWeight: 600 }}>
          {fmtValue ? fmtValue(p.value) : p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

const ENGAGEMENT_COLORS = ["#00D46A", "#3B82F6", "#F59E0B", "#8B5CF6", "#06B6D4"];

function ReelsAnalytics() {
  const [env, setEnvState] = useState(() => localStorage.getItem("analytics_env") || "dev");
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [, setTick] = useState(0);
  const [tablePage, setTablePage] = useState(0);

  const intervalRef = useRef(null);
  const tickRef = useRef(null);
  const TABLE_SIZE = 50;

  const setEnv = (v) => { localStorage.setItem("analytics_env", v); setEnvState(v); };

  const fetchStats = useCallback(async (currentEnv) => {
    const { siteUrl } = ENVS[currentEnv];
    if (!siteUrl) {
      setError(`VITE_CONVEX_SITE_URL_${currentEnv.toUpperCase()} not set.`);
      setLoading(false);
      return;
    }
    try {
      const url = `${siteUrl.replace(/\/$/, "")}/api/reel-stats`;
      const headers = {};
      if (API_KEY) headers["Authorization"] = `Bearer ${API_KEY}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const raw = await res.json();
      // Response is an array of reel-stat records
      setReels(Array.isArray(raw) ? raw : raw.stats ?? raw.data ?? raw.reels ?? []);
      setError(null);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setReels([]);
    setTablePage(0);
    fetchStats(env);
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => fetchStats(env), REFRESH_MS);
    clearInterval(tickRef.current);
    tickRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    return () => { clearInterval(intervalRef.current); clearInterval(tickRef.current); };
  }, [env, fetchStats]);

  // ── Aggregated stats ─────────────────────────────────────────────────────────

  const totalReels    = reels.length;
  const totalSessions = reels.reduce((s, r) => s + (r.watchSessions    || 0), 0);
  const totalWatchMs  = reels.reduce((s, r) => s + (r.totalWatchMs     || 0), 0);
  const totalSaves    = reels.reduce((s, r) => s + (r.saveCount        || 0), 0);
  const totalShares   = reels.reduce((s, r) => s + (r.shareCount       || 0), 0);
  const totalCalls    = reels.reduce((s, r) => s + (r.callCount        || 0), 0);
  const totalBookings = reels.reduce((s, r) => s + (r.bookViewingCount || 0), 0);
  const totalDetails  = reels.reduce((s, r) => s + (r.detailsOpenCount || 0), 0);
  const avgWatchMs    = totalSessions > 0 ? totalWatchMs / totalSessions : 0;

  // Top 10 reels by watch time
  const topReels = [...reels]
    .sort((a, b) => (b.totalWatchMs || 0) - (a.totalWatchMs || 0))
    .slice(0, 10)
    .map((r) => ({
      label: truncId(r.reelId, 10),
      reelId: r.reelId,
      watchMs: r.totalWatchMs || 0,
      sessions: r.watchSessions || 0,
    }));

  // Engagement breakdown
  const engagementData = [
    { name: "Saves",        count: totalSaves,    color: "#00D46A" },
    { name: "Shares",       count: totalShares,   color: "#3B82F6" },
    { name: "Calls",        count: totalCalls,    color: "#F59E0B" },
    { name: "Book Views",   count: totalBookings, color: "#8B5CF6" },
    { name: "Detail Opens", count: totalDetails,  color: "#06B6D4" },
  ];

  // Sorted table
  const sortedReels = [...reels].sort((a, b) => (b.totalWatchMs || 0) - (a.totalWatchMs || 0));
  const pageStart = tablePage * TABLE_SIZE;
  const pageReels = sortedReels.slice(pageStart, pageStart + TABLE_SIZE);
  const totalPages = Math.ceil(totalReels / TABLE_SIZE);

  const isFirstLoad = loading && reels.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Reels Analytics</h1>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--accent-dim)", border: "1px solid var(--accent-border)", borderRadius: "var(--radius-sm)", padding: "3px 9px", fontSize: "11px", color: "var(--accent)", fontWeight: 500 }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 6px var(--accent)", animation: "ra-pulse 2s ease-in-out infinite" }} />
              Live · 5s
            </div>
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "3px" }}>
            Per-reel engagement — {ENVS[env].label}
            {lastRefreshed && <span style={{ color: "var(--text-muted)", marginLeft: "8px" }}>· refreshed {fmtRelative(lastRefreshed)}</span>}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={() => { setLoading(true); fetchStats(env); }}
            style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-secondary)", cursor: "pointer", padding: "6px 8px", display: "flex", alignItems: "center", transition: "all 150ms ease" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-hover)"; e.currentTarget.style.color = "var(--text-primary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          >
            <RefreshIcon fontSize="small" style={{ animation: loading ? "ra-spin 0.8s linear infinite" : "none" }} />
          </button>
          <EnvToggle env={env} setEnv={setEnv} />
        </div>
      </div>

      {error && (
        <div style={{ background: "var(--danger-dim)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "var(--radius-md)", padding: "12px 16px", fontSize: "13px", color: "var(--danger)" }}>
          <strong>Fetch error:</strong> {error}
        </div>
      )}

      {isFirstLoad && !error && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "200px", flexDirection: "column", gap: "12px" }}>
          <div style={{ width: "24px", height: "24px", border: "2px solid var(--border-hover)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "ra-spin 0.8s linear infinite" }} />
          <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Loading reel stats…</span>
        </div>
      )}

      {!isFirstLoad && (
        <>
          {/* Stat cards */}
          <div>
            <SectionLabel>Overview</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))", gap: "12px" }}>
              <StatCard title="Reels Tracked"     value={totalReels.toLocaleString()}    accent="var(--accent)" />
              <StatCard title="Watch Sessions"     value={totalSessions.toLocaleString()} />
              <StatCard title="Total Watch Time"   value={fmtWatchMs(totalWatchMs)}       />
              <StatCard title="Avg Watch / Session" value={fmtWatchMs(avgWatchMs)}         sub={totalSessions > 0 ? `${totalSessions.toLocaleString()} sessions` : "No sessions yet"} />
              <StatCard title="Total Saves"        value={totalSaves.toLocaleString()}    />
              <StatCard title="Total Shares"       value={totalShares.toLocaleString()}   />
            </div>
          </div>

          {/* Charts */}
          {totalReels > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "16px" }}>
              {/* Top reels by watch time */}
              <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "20px" }}>
                <SectionLabel>Top Reels by Watch Time</SectionLabel>
                <ResponsiveContainer width="100%" height={Math.max(200, topReels.length * 30)}>
                  <BarChart layout="vertical" data={topReels} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} tickFormatter={(v) => fmtWatchMs(v)} />
                    <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 10, fill: "var(--text-secondary)", fontFamily: "monospace" }} tickLine={false} axisLine={false} />
                    <RechartsTooltip
                      content={({ active, payload }) =>
                        active && payload?.length ? (
                          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-hover)", borderRadius: "var(--radius-sm)", padding: "8px 12px", fontSize: "12px" }}>
                            <p style={{ color: "var(--text-muted)", fontSize: "10px", marginBottom: "4px", fontFamily: "monospace" }}>{payload[0].payload.reelId}</p>
                            <p style={{ color: "var(--accent)", fontWeight: 600 }}>{fmtWatchMs(payload[0].value)}</p>
                            <p style={{ color: "var(--text-secondary)" }}>{payload[0].payload.sessions} sessions</p>
                          </div>
                        ) : null
                      }
                      cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    />
                    <Bar dataKey="watchMs" radius={[0, 4, 4, 0]} maxBarSize={20}>
                      {topReels.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? "#00D46A" : `rgba(0,212,106,${Math.max(0.15, 0.7 - i * 0.06)})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Engagement breakdown */}
              <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "20px" }}>
                <SectionLabel>Engagement Breakdown</SectionLabel>
                <ResponsiveContainer width="100%" height={Math.max(200, topReels.length * 30)}>
                  <BarChart data={engagementData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <RechartsTooltip
                      content={({ active, payload }) =>
                        active && payload?.length ? (
                          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-hover)", borderRadius: "var(--radius-sm)", padding: "8px 12px", fontSize: "12px" }}>
                            <p style={{ color: "var(--text-secondary)", marginBottom: "4px" }}>{payload[0].payload.name}</p>
                            <p style={{ color: payload[0].payload.color, fontWeight: 600 }}>{payload[0].value.toLocaleString()}</p>
                          </div>
                        ) : null
                      }
                      cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
                      {engagementData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Per-reel table */}
          <div>
            <SectionLabel>Per-Reel Breakdown</SectionLabel>
            <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
              {/* Table header row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
                <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  {totalReels.toLocaleString()} reels · sorted by watch time
                </p>
                {totalPages > 1 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{tablePage + 1} / {totalPages}</span>
                    <button onClick={() => setTablePage((p) => Math.max(0, p - 1))} disabled={tablePage === 0} style={pagerBtn(tablePage === 0)}>‹</button>
                    <button onClick={() => setTablePage((p) => Math.min(totalPages - 1, p + 1))} disabled={tablePage === totalPages - 1} style={pagerBtn(tablePage === totalPages - 1)}>›</button>
                  </div>
                )}
              </div>

              {totalReels === 0 ? (
                <div style={{ padding: "60px", textAlign: "center" }}>
                  <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>No reel stats yet in {ENVS[env].label}.</p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        {["Reel ID", "Sessions", "Watch Time", "Saves", "Shares", "Calls", "Book Views", "Detail Opens"].map((h) => (
                          <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: "10px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageReels.map((r, i) => (
                        <tr key={r._id || i} style={{ borderBottom: "1px solid var(--border)", transition: "background 100ms" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={{ padding: "10px 16px", whiteSpace: "nowrap" }}>
                            <span style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--text-secondary)" }} title={r.reelId}>
                              {truncId(r.reelId, 14)}
                            </span>
                          </td>
                          <td style={tdStyle}>{(r.watchSessions || 0).toLocaleString()}</td>
                          <td style={{ ...tdStyle, color: r.totalWatchMs > 0 ? "var(--accent)" : "var(--text-muted)" }}>
                            {fmtWatchMs(r.totalWatchMs)}
                          </td>
                          <td style={tdStyle}>{r.saveCount        || 0}</td>
                          <td style={tdStyle}>{r.shareCount       || 0}</td>
                          <td style={tdStyle}>{r.callCount        || 0}</td>
                          <td style={tdStyle}>{r.bookViewingCount || 0}</td>
                          <td style={tdStyle}>{r.detailsOpenCount || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes ra-spin  { to { transform: rotate(360deg); } }
        @keyframes ra-pulse { 0%,100% { opacity:1; box-shadow:0 0 6px var(--accent); } 50% { opacity:.5; box-shadow:0 0 2px var(--accent); } }
      `}</style>
    </div>
  );
}

const tdStyle = { padding: "10px 16px", color: "var(--text-secondary)", whiteSpace: "nowrap", verticalAlign: "middle" };
function pagerBtn(disabled) {
  return { background: disabled ? "transparent" : "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-xs)", color: disabled ? "var(--text-muted)" : "var(--text-secondary)", cursor: disabled ? "default" : "pointer", padding: "2px 8px", fontSize: "14px", lineHeight: 1.4, opacity: disabled ? 0.4 : 1 };
}

export default ReelsAnalytics;
