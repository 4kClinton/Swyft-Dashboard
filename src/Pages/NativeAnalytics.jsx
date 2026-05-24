import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import RefreshIcon from "@mui/icons-material/Refresh";
import AnalyticsIcon from "@mui/icons-material/Analytics";

const API_KEY = import.meta.env.VITE_ANALYTICS_API_KEY || "";

const ENVS = {
  dev: {
    siteUrl: import.meta.env.VITE_CONVEX_SITE_URL_DEV || "",
    label: "Development",
    tag: "DEV",
    color: "#F59E0B",
  },
  prod: {
    siteUrl: import.meta.env.VITE_CONVEX_SITE_URL_PROD || "",
    label: "Production",
    tag: "PROD",
    color: "#00D46A",
  },
};

const REFRESH_MS = 5000;
const TABLE_PAGE = 50;

// ── Small helpers ──────────────────────────────────────────────────────────────

function fmtTime(ms) {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function fmtRelative(date) {
  if (!date) return null;
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  return `${Math.floor(diff / 60)}m ago`;
}

function truncate(str, len = 20) {
  if (!str) return "—";
  return str.length > len ? str.slice(0, len) + "…" : str;
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ title, value, sub, accent }) {
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      <p
        style={{
          fontSize: "11px",
          fontWeight: 500,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
        }}
      >
        {title}
      </p>
      <p
        style={{
          fontSize: "28px",
          fontWeight: 700,
          color: accent || "var(--text-primary)",
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ── Custom recharts tooltip ────────────────────────────────────────────────────

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border-hover)",
        borderRadius: "var(--radius-sm)",
        padding: "8px 12px",
        fontSize: "12px",
        color: "var(--text-primary)",
      }}
    >
      <p style={{ color: "var(--text-secondary)", marginBottom: "4px" }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color, fontWeight: 600 }}>
          {p.value.toLocaleString()} events
        </p>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

function NativeAnalytics() {
  const [env, setEnv] = useState(
    () => localStorage.getItem("analytics_env") || "dev"
  );
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [tablePage, setTablePage] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0); // forces relative-time re-render

  const intervalRef = useRef(null);
  const tickRef = useRef(null);

  const fetchEvents = useCallback(async (currentEnv) => {
    const { siteUrl } = ENVS[currentEnv];
    if (!siteUrl) {
      setError(
        `VITE_CONVEX_SITE_URL_${currentEnv.toUpperCase()} is not set in .env — restart the dev server after adding it.`
      );
      setLoading(false);
      return;
    }
    try {
      const url = `${siteUrl.replace(/\/$/, "")}/api/events`;
      const headers = {};
      if (API_KEY) headers["Authorization"] = `Bearer ${API_KEY}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const raw = await res.json();
      const list = Array.isArray(raw) ? raw : raw.events ?? raw.data ?? [];
      setEvents(list);
      setError(null);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Switch env → reset + restart polling
  useEffect(() => {
    localStorage.setItem("analytics_env", env);
    setLoading(true);
    setEvents([]);
    setTablePage(0);
    fetchEvents(env);

    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => fetchEvents(env), REFRESH_MS);

    // Tick every second so "X seconds ago" stays fresh
    clearInterval(tickRef.current);
    tickRef.current = setInterval(() => setRefreshTick((t) => t + 1), 1000);

    return () => {
      clearInterval(intervalRef.current);
      clearInterval(tickRef.current);
    };
  }, [env, fetchEvents]);

  // ── Derived stats ────────────────────────────────────────────────────────────

  const total = events.length;
  const uniqueSessions = new Set(events.map((e) => e.sessionId).filter(Boolean)).size;
  const uniqueUsers = new Set(events.map((e) => e.userId).filter(Boolean)).size;

  const platformCounts = events.reduce((acc, e) => {
    const p = (e.platform || "unknown").toLowerCase();
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});
  const platformLabel = Object.entries(platformCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v}`)
    .join(" · ") || "—";

  // Top 10 event types
  const eventTypeCounts = events.reduce((acc, e) => {
    if (e.event) acc[e.event] = (acc[e.event] || 0) + 1;
    return acc;
  }, {});
  const topEvents = Object.entries(eventTypeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // Events per day — last 30 days
  const now = Date.now();
  const dayMs = 86_400_000;
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now - (29 - i) * dayMs);
    return d.toISOString().slice(0, 10);
  });
  const byDay = events.reduce((acc, e) => {
    const day = new Date(e._creationTime).toISOString().slice(0, 10);
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {});
  const timelineData = last30.map((day) => ({
    day: day.slice(5), // MM-DD
    count: byDay[day] || 0,
  }));

  // Table
  const sorted = [...events].sort((a, b) => b._creationTime - a._creationTime);
  const pageStart = tablePage * TABLE_PAGE;
  const pageEvents = sorted.slice(pageStart, pageStart + TABLE_PAGE);
  const totalPages = Math.ceil(total / TABLE_PAGE);

  const envCfg = ENVS[env];
  const isFirstLoad = loading && total === 0;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "var(--text-primary)",
                letterSpacing: "-0.02em",
              }}
            >
              Native Analytics
            </h1>
            {/* Live pulse */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "var(--accent-dim)",
                border: "1px solid var(--accent-border)",
                borderRadius: "var(--radius-sm)",
                padding: "3px 9px",
                fontSize: "11px",
                color: "var(--accent)",
                fontWeight: 500,
              }}
            >
              <div
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "var(--accent)",
                  boxShadow: "0 0 6px var(--accent)",
                  animation: "na-pulse 2s ease-in-out infinite",
                }}
              />
              Live · 5s
            </div>
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "3px" }}>
            Events table — {envCfg.label} environment
            {lastRefreshed && (
              <span style={{ color: "var(--text-muted)", marginLeft: "8px" }}>
                · refreshed {fmtRelative(lastRefreshed)}
              </span>
            )}
          </p>
        </div>

        {/* Right: env toggle + manual refresh */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Manual refresh */}
          <button
            onClick={() => { setLoading(true); fetchEvents(env); }}
            title="Refresh now"
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              padding: "6px 8px",
              display: "flex",
              alignItems: "center",
              transition: "all 150ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--border-hover)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            <RefreshIcon
              fontSize="small"
              style={{ animation: loading ? "na-spin 0.8s linear infinite" : "none" }}
            />
          </button>

          {/* ENV toggle */}
          <div
            style={{
              display: "flex",
              background: "var(--surface-1)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "4px",
              gap: "4px",
            }}
          >
            {Object.entries(ENVS).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setEnv(key)}
                style={{
                  padding: "6px 16px",
                  borderRadius: "var(--radius-xs)",
                  background: env === key ? cfg.color + "1A" : "transparent",
                  border: env === key ? `1px solid ${cfg.color}40` : "1px solid transparent",
                  color: env === key ? cfg.color : "var(--text-secondary)",
                  fontSize: "12px",
                  fontWeight: env === key ? 700 : 500,
                  cursor: "pointer",
                  letterSpacing: "0.04em",
                  transition: "all 150ms ease",
                }}
              >
                {cfg.tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          style={{
            background: "var(--danger-dim)",
            border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: "var(--radius-md)",
            padding: "12px 16px",
            fontSize: "13px",
            color: "var(--danger)",
          }}
        >
          <strong>Fetch error:</strong> {error}
        </div>
      )}

      {/* First-load spinner */}
      {isFirstLoad && !error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "180px",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "24px",
              height: "24px",
              border: "2px solid var(--border-hover)",
              borderTopColor: "var(--accent)",
              borderRadius: "50%",
              animation: "na-spin 0.8s linear infinite",
            }}
          />
          <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            Fetching events from {envCfg.label}…
          </span>
        </div>
      )}

      {!isFirstLoad && (
        <>
          {/* Stats row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: "12px",
            }}
          >
            <StatCard
              title="Total Events"
              value={total.toLocaleString()}
              accent="var(--accent)"
            />
            <StatCard
              title="Unique Sessions"
              value={uniqueSessions.toLocaleString()}
            />
            <StatCard
              title="Unique Users"
              value={uniqueUsers.toLocaleString()}
            />
            <StatCard
              title="Platforms"
              value={Object.keys(platformCounts).length || "—"}
              sub={platformLabel}
            />
          </div>

          {/* Charts row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: "16px",
            }}
          >
            {/* Timeline */}
            <div
              style={{
                background: "var(--surface-1)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "20px",
              }}
            >
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--text-secondary)",
                  marginBottom: "16px",
                }}
              >
                Events — Last 30 Days
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={timelineData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="na-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00D46A" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#00D46A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                    tickLine={false}
                    axisLine={false}
                    interval={6}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <RechartsTooltip content={<ChartTip />} cursor={{ stroke: "var(--border-hover)" }} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#00D46A"
                    strokeWidth={1.5}
                    fill="url(#na-grad)"
                    dot={false}
                    activeDot={{ r: 4, fill: "#00D46A" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Top event types */}
            <div
              style={{
                background: "var(--surface-1)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "20px",
              }}
            >
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--text-secondary)",
                  marginBottom: "16px",
                }}
              >
                Top Event Types
              </p>
              {topEvents.length === 0 ? (
                <p style={{ fontSize: "13px", color: "var(--text-muted)", paddingTop: "60px", textAlign: "center" }}>
                  No events yet
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    layout="vertical"
                    data={topEvents}
                    margin={{ top: 0, right: 4, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => truncate(v, 14)}
                    />
                    <RechartsTooltip
                      content={({ active, payload }) =>
                        active && payload?.length ? (
                          <div
                            style={{
                              background: "var(--surface-2)",
                              border: "1px solid var(--border-hover)",
                              borderRadius: "var(--radius-sm)",
                              padding: "8px 12px",
                              fontSize: "12px",
                            }}
                          >
                            <p style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                              {payload[0].payload.name}
                            </p>
                            <p style={{ color: "var(--accent)" }}>
                              {payload[0].value.toLocaleString()} events
                            </p>
                          </div>
                        ) : null
                      }
                      cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={18}>
                      {topEvents.map((_, i) => (
                        <Cell
                          key={i}
                          fill={i === 0 ? "#00D46A" : `rgba(0,212,106,${0.7 - i * 0.06})`}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Events table */}
          <div
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              overflow: "hidden",
            }}
          >
            {/* Table header row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--text-secondary)",
                }}
              >
                Recent Events
                <span style={{ color: "var(--text-muted)", marginLeft: "8px", fontWeight: 400, letterSpacing: 0 }}>
                  {total.toLocaleString()} total
                </span>
              </p>
              {totalPages > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    {tablePage + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setTablePage((p) => Math.max(0, p - 1))}
                    disabled={tablePage === 0}
                    style={pagerBtnStyle(tablePage === 0)}
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => setTablePage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={tablePage === totalPages - 1}
                    style={pagerBtnStyle(tablePage === totalPages - 1)}
                  >
                    ›
                  </button>
                </div>
              )}
            </div>

            {/* Scrollable table */}
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "12px",
                }}
              >
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {[
                      "Timestamp",
                      "Event",
                      "Screen",
                      "Platform",
                      "App Version",
                      "User ID",
                      "Session ID",
                      "Properties",
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "10px 16px",
                          textAlign: "left",
                          fontSize: "10px",
                          fontWeight: 600,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "var(--text-muted)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageEvents.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        style={{
                          padding: "40px",
                          textAlign: "center",
                          color: "var(--text-muted)",
                          fontSize: "13px",
                        }}
                      >
                        No events found in {envCfg.label}.
                      </td>
                    </tr>
                  )}
                  {pageEvents.map((ev, i) => (
                    <tr
                      key={ev._id || i}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        transition: "background 100ms",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={tdStyle}>
                        <span style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                          {fmtTime(ev._creationTime)}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            background: "var(--accent-dim)",
                            border: "1px solid var(--accent-border)",
                            color: "var(--accent)",
                            borderRadius: "var(--radius-xs)",
                            padding: "2px 7px",
                            fontSize: "11px",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {ev.event || "—"}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ color: "var(--text-secondary)" }}>{ev.screen || "—"}</span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ color: "var(--text-secondary)", textTransform: "capitalize" }}>
                          {ev.platform || "—"}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ color: "var(--text-muted)" }}>{ev.appVersion || "—"}</span>
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            color: "var(--text-muted)",
                            fontFamily: "monospace",
                            fontSize: "11px",
                          }}
                          title={ev.userId}
                        >
                          {truncate(ev.userId, 16)}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            color: "var(--text-muted)",
                            fontFamily: "monospace",
                            fontSize: "11px",
                          }}
                          title={ev.sessionId}
                        >
                          {truncate(ev.sessionId, 16)}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {ev.properties ? (
                          <span
                            style={{
                              color: "var(--text-muted)",
                              fontFamily: "monospace",
                              fontSize: "10px",
                            }}
                            title={JSON.stringify(ev.properties, null, 2)}
                          >
                            {truncate(JSON.stringify(ev.properties), 30)}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes na-spin { to { transform: rotate(360deg); } }
        @keyframes na-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px var(--accent); }
          50% { opacity: 0.5; box-shadow: 0 0 2px var(--accent); }
        }
      `}</style>
    </div>
  );
}

const tdStyle = {
  padding: "10px 16px",
  color: "var(--text-primary)",
  whiteSpace: "nowrap",
  verticalAlign: "middle",
};

function pagerBtnStyle(disabled) {
  return {
    background: disabled ? "transparent" : "var(--surface-2)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-xs)",
    color: disabled ? "var(--text-muted)" : "var(--text-secondary)",
    cursor: disabled ? "default" : "pointer",
    padding: "2px 8px",
    fontSize: "14px",
    lineHeight: 1.4,
    opacity: disabled ? 0.4 : 1,
  };
}

export default NativeAnalytics;
