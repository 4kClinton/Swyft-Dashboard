import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import NearMeIcon from "@mui/icons-material/NearMe";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { supabase } from "../supabaseClient";

// Dispatch radius config lives in the Flask backend's AppSettings (Supabase),
// same place as the commission rate.
const SWYFT_API = "https://swyft-backend-client-nine.vercel.app";

// How many recent orders (with a nearest-driver snapshot) to sample.
const SAMPLE_LIMIT = 500;

// Ring palette, inner→outer (tight coverage = green, far = red).
const RING_COLORS = ["#00D46A", "#F59E0B", "#EF4444", "#8B5CF6", "#3B82F6"];
const ringColor = (i) => RING_COLORS[Math.min(i, RING_COLORS.length - 1)] || "#EF4444";

// Sketch-style default rings (metres) shown before anything is saved.
const DEFAULT_RADII_M = [500, 1000, 1500];

// Distance buckets (km) for the supply distribution. A booking landing in a
// low bucket means a driver was close by — healthy supply/coverage.
const BUCKETS = [
  { label: "0–1", min: 0, max: 1, color: "#00D46A" },
  { label: "1–2", min: 1, max: 2, color: "#3DD68C" },
  { label: "2–3", min: 2, max: 3, color: "#8BD450" },
  { label: "3–5", min: 3, max: 5, color: "#F59E0B" },
  { label: "5–10", min: 5, max: 10, color: "#F97316" },
  { label: "10+", min: 10, max: Infinity, color: "#EF4444" },
];

function fmtKm(v) {
  return v == null ? "—" : `${Number(v).toFixed(1)} km`;
}

function fmtTime(str) {
  if (!str) return "—";
  // Supabase returns ISO 8601; older Flask payloads use "YYYY-MM-DD HH:MM:SS".
  const d = new Date(str.includes("T") ? str : str.replace(" ", "T") + "Z");
  if (isNaN(d)) return str;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const cardStyle = {
  background: "var(--surface-1)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  padding: "24px",
};

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

function ChartTip({ active, payload, label, unit }) {
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
        <p key={p.dataKey} style={{ color: p.color || "var(--accent)", fontWeight: 600 }}>
          {p.value}
          {unit}
        </p>
      ))}
    </div>
  );
}

// ── Concentric dispatch-radius rings (the sketch) ──────────────────────────────
function RingVisualizer({ radiiM }) {
  const size = 340;
  const c = size / 2;
  const pad = 46; // room for the outer label
  const rings = [...radiiM].map(Number).filter((m) => m > 0).sort((a, b) => a - b);
  const outer = rings.length ? rings[rings.length - 1] : 1;
  const maxR = c - pad;
  // Fan the label lines out at different angles so they don't collide.
  const angles = [18, 0, -18, -36, 36, -54, 54];

  return (
    <svg width="100%" viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: size, display: "block", margin: "0 auto" }}>
      {rings.map((m, i) => {
        const r = (m / outer) * maxR;
        return (
          <circle
            key={`c-${i}`}
            cx={c}
            cy={c}
            r={r}
            fill={ringColor(i, rings.length) + "0D"}
            stroke="var(--text-muted)"
            strokeWidth="1.25"
          />
        );
      })}

      {rings.map((m, i) => {
        const r = (m / outer) * maxR;
        const col = ringColor(i, rings.length);
        const ang = ((angles[i] ?? 0) * Math.PI) / 180;
        const x = c + r * Math.cos(ang);
        const y = c - r * Math.sin(ang);
        const label = m >= 1000 ? `${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 1)}km` : `${m}m`;
        return (
          <g key={`l-${i}`}>
            <line x1={c} y1={c} x2={x} y2={y} stroke={col} strokeWidth="2.5" strokeLinecap="round" />
            <text
              x={x + (Math.cos(ang) >= 0 ? 6 : -6)}
              y={y - 6}
              fill={col}
              fontSize="12"
              fontWeight="700"
              textAnchor={Math.cos(ang) >= 0 ? "start" : "end"}
            >
              {label}
            </text>
          </g>
        );
      })}

      {/* Driver marker */}
      <circle cx={c} cy={c} r="5" fill="var(--text-primary)" />
      <text x={c} y={c - 12} fill="var(--text-primary)" fontSize="12" fontWeight="700" textAnchor="middle">
        Driver
      </text>
    </svg>
  );
}

function DriverSupply() {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Dispatch radius config (edited in metres; stored in km on the backend).
  const [radiiM, setRadiiM] = useState(DEFAULT_RADII_M);
  const [radiusSaving, setRadiusSaving] = useState(false);
  const [radiusStatus, setRadiusStatus] = useState(null);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`${SWYFT_API}/config`);
      if (!res.ok) return;
      const data = await res.json();
      const tiers = data.dispatch_radius_tiers;
      if (Array.isArray(tiers) && tiers.length) {
        setRadiiM(tiers.map((km) => Math.round(Number(km) * 1000)));
      }
    } catch {
      /* keep defaults on failure */
    }
  }, []);

  const saveRadius = useCallback(async () => {
    const clean = radiiM
      .map(Number)
      .filter((m) => Number.isFinite(m) && m > 0)
      .sort((a, b) => a - b);
    if (!clean.length) {
      setRadiusStatus({ type: "error", message: "Add at least one ring (metres)." });
      return;
    }
    setRadiusSaving(true);
    setRadiusStatus(null);
    try {
      const res = await fetch(`${SWYFT_API}/config/dispatch-radius`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // Backend stores km; UI edits metres.
        body: JSON.stringify({ dispatch_radius_tiers: clean.map((m) => m / 1000) }),
      });
      if (res.ok) {
        setRadiiM(clean);
        setRadiusStatus({ type: "success", message: "Dispatch radius updated." });
      } else {
        const txt = await res.text().catch(() => "");
        setRadiusStatus({ type: "error", message: `Save failed: ${txt || res.statusText}` });
      }
    } catch (e) {
      setRadiusStatus({ type: "error", message: `Network error: ${e.message}` });
    }
    setRadiusSaving(false);
  }, [radiiM]);

  const setRing = (i, val) =>
    setRadiiM((rs) => rs.map((m, idx) => (idx === i ? val : m)));
  const addRing = () =>
    setRadiiM((rs) => [...rs, (rs.length ? Math.max(...rs.map(Number)) : 0) + 500]);
  const removeRing = (i) => setRadiiM((rs) => rs.filter((_, idx) => idx !== i));

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Read straight from Supabase (same source as every other analytics page).
  // `nearest_driver_km` is snapshotted onto each order by the backend at booking
  // time — the haversine distance to the nearest online driver.
  const fetchSupply = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: sbError } = await supabase
        .from("orders")
        .select("id, created_at, vehicle_type, status, user_lat, user_lng, nearest_driver_km")
        .not("nearest_driver_km", "is", null)
        .order("created_at", { ascending: false })
        .limit(SAMPLE_LIMIT);
      if (sbError) throw sbError;
      setPoints(Array.isArray(data) ? data : []);
      setError(null);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSupply();
  }, [fetchSupply]);

  // ── Derived stats & chart data ────────────────────────────────────────────
  const summary = useMemo(() => {
    const distances = points
      .map((p) => Number(p.nearest_driver_km))
      .filter((d) => Number.isFinite(d))
      .sort((a, b) => a - b);
    const count = distances.length;
    if (!count) return null;
    return {
      count,
      avg_km: distances.reduce((s, d) => s + d, 0) / count,
      median_km: distances[Math.floor(count / 2)],
      min_km: distances[0],
      max_km: distances[count - 1],
      within_3km_pct: (100 * distances.filter((d) => d <= 3).length) / count,
      within_5km_pct: (100 * distances.filter((d) => d <= 5).length) / count,
    };
  }, [points]);

  const distribution = useMemo(() => {
    return BUCKETS.map((b) => ({
      label: b.label,
      color: b.color,
      count: points.filter(
        (p) => p.nearest_driver_km >= b.min && p.nearest_driver_km < b.max
      ).length,
    }));
  }, [points]);

  const trend = useMemo(() => {
    const byDay = new Map();
    for (const p of points) {
      if (!p.created_at) continue;
      const day = p.created_at.slice(0, 10);
      const bucket = byDay.get(day) || { sum: 0, n: 0 };
      bucket.sum += p.nearest_driver_km;
      bucket.n += 1;
      byDay.set(day, bucket);
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, { sum, n }]) => ({
        day: day.slice(5), // MM-DD
        avg: Number((sum / n).toFixed(2)),
      }));
  }, [points]);

  const byVehicle = useMemo(() => {
    const map = new Map();
    for (const p of points) {
      const key = p.vehicle_type || "unknown";
      const bucket = map.get(key) || { sum: 0, n: 0 };
      bucket.sum += p.nearest_driver_km;
      bucket.n += 1;
      map.set(key, bucket);
    }
    return [...map.entries()]
      .map(([vehicle, { sum, n }]) => ({
        vehicle,
        avg: Number((sum / n).toFixed(2)),
        n,
      }))
      .sort((a, b) => b.avg - a.avg);
  }, [points]);

  const recent = useMemo(() => points.slice(0, 25), [points]);

  const coverageColor =
    summary?.avg_km == null
      ? "var(--text-primary)"
      : summary.avg_km <= 3
      ? "#00D46A"
      : summary.avg_km <= 5
      ? "#F59E0B"
      : "#EF4444";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <style>{`@keyframes ds-spin { to { transform: rotate(360deg); } }`}</style>
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
            <NearMeIcon style={{ color: "var(--accent)" }} />
            <h1
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "var(--text-primary)",
                letterSpacing: "-0.02em",
                margin: 0,
              }}
            >
              Driver Supply
            </h1>
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
            Haversine distance from each customer to the nearest online driver at
            booking time — a live read on supply density and coverage.
            {lastRefreshed && (
              <span style={{ color: "var(--text-muted)", marginLeft: "8px" }}>
                · refreshed {lastRefreshed.toLocaleTimeString("en-GB", { hour12: false })}
              </span>
            )}
          </p>
        </div>

        <button
          onClick={fetchSupply}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 14px",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-secondary)",
            fontSize: "12px",
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 150ms ease",
            fontFamily: "inherit",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-hover)"; e.currentTarget.style.color = "var(--text-primary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
        >
          <RefreshIcon style={{ fontSize: "16px", animation: loading ? "ds-spin 0.8s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div
          style={{
            padding: "12px 16px",
            background: "var(--danger-dim)",
            border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: "var(--radius-sm)",
            fontSize: "13px",
            color: "var(--danger)",
          }}
        >
          Could not load driver-supply data: {error}
        </div>
      )}

      {/* Dispatch radius rings — config + visual */}
      <div style={cardStyle}>
        <SectionTitle
          title="Dispatch Radius"
          subtitle="The area around a driver from which they can receive orders. The outermost ring is the hard cutoff — orders are only offered to drivers inside it, escalating ring by ring."
        />

        {radiusStatus && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 14px",
              marginBottom: "16px",
              background: radiusStatus.type === "success" ? "var(--accent-dim)" : "var(--danger-dim)",
              border: `1px solid ${radiusStatus.type === "success" ? "var(--accent-border)" : "rgba(239,68,68,0.25)"}`,
              borderRadius: "var(--radius-sm)",
              fontSize: "13px",
              color: radiusStatus.type === "success" ? "var(--accent)" : "var(--danger)",
            }}
          >
            {radiusStatus.type === "success"
              ? <CheckCircleOutlineIcon style={{ fontSize: "16px" }} />
              : <ErrorOutlineIcon style={{ fontSize: "16px" }} />}
            {radiusStatus.message}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px", alignItems: "center" }}>
          {/* Visual */}
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "16px" }}>
            <RingVisualizer radiiM={radiiM} />
          </div>

          {/* Editor */}
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 40px", gap: "8px", paddingBottom: "8px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
              {["", "Radius (metres)", ""].map((h, idx) => (
                <span key={idx} style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
                  {h}
                </span>
              ))}
            </div>

            {radiiM.map((m, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "24px 1fr 40px", gap: "8px", alignItems: "center", marginTop: "8px" }}>
                <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: ringColor([...radiiM].map(Number).sort((a, b) => a - b).indexOf(Number(m)), radiiM.length), border: "1px solid var(--border)" }} />
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={m}
                  onChange={(e) => setRing(i, e.target.value === "" ? "" : Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    background: "var(--surface-3)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-primary)",
                    fontSize: "14px",
                    fontWeight: 600,
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "var(--accent-border)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
                />
                <button
                  onClick={() => removeRing(i)}
                  disabled={radiiM.length <= 1}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: "34px", height: "34px",
                    background: "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-xs)",
                    cursor: radiiM.length <= 1 ? "not-allowed" : "pointer",
                    color: radiiM.length <= 1 ? "var(--text-muted)" : "var(--danger)",
                    padding: 0,
                  }}
                >
                  <DeleteOutlineIcon style={{ fontSize: "16px" }} />
                </button>
              </div>
            ))}

            <button
              onClick={addRing}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "8px 14px",
                background: "transparent",
                border: "1px dashed var(--border-hover)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-secondary)",
                fontSize: "12px", fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
                marginTop: "12px",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent-border)"; e.currentTarget.style.color = "var(--accent)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-hover)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
            >
              <AddIcon style={{ fontSize: "16px" }} />
              Add Ring
            </button>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginTop: "18px", flexWrap: "wrap" }}>
              <p style={{ fontSize: "11.5px", color: "var(--text-muted)", lineHeight: 1.5, margin: 0, maxWidth: "260px" }}>
                Cutoff:{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  {(() => {
                    const outer = Math.max(...radiiM.map(Number).filter((n) => n > 0), 0);
                    return outer ? (outer >= 1000 ? `${(outer / 1000).toFixed(outer % 1000 === 0 ? 0 : 1)} km` : `${outer} m`) : "—";
                  })()}
                </strong>{" "}
                — beyond this, orders won't be offered.
              </p>
              <button
                onClick={saveRadius}
                disabled={radiusSaving}
                style={{
                  padding: "10px 24px",
                  background: radiusSaving ? "var(--accent-dim)" : "var(--accent)",
                  border: radiusSaving ? "1px solid var(--accent-border)" : "none",
                  borderRadius: "var(--radius-sm)",
                  color: radiusSaving ? "var(--accent)" : "#07080D",
                  fontSize: "13px", fontWeight: 700,
                  cursor: radiusSaving ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  letterSpacing: "-0.01em",
                }}
              >
                {radiusSaving ? "Saving..." : "Save Radius"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading && !summary ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "200px", color: "var(--text-secondary)", fontSize: "14px" }}>
          Loading driver-supply data…
        </div>
      ) : !summary || summary.count === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", color: "var(--text-secondary)", fontSize: "14px" }}>
          No driver-supply data yet. Distances are recorded on every new order —
          once orders start coming in with the nearest-driver snapshot, this page
          will populate.
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: "14px",
            }}
          >
            <StatCard
              title="Avg Nearest Driver"
              value={fmtKm(summary.avg_km)}
              sub="mean across sampled bookings"
              accent={coverageColor}
            />
            <StatCard title="Median" value={fmtKm(summary.median_km)} sub="typical booking" />
            <StatCard
              title="Within 3 km"
              value={summary.within_3km_pct == null ? "—" : `${summary.within_3km_pct.toFixed(0)}%`}
              sub="strong coverage"
              accent="#00D46A"
            />
            <StatCard
              title="Within 5 km"
              value={summary.within_5km_pct == null ? "—" : `${summary.within_5km_pct.toFixed(0)}%`}
              sub="acceptable coverage"
            />
            <StatCard title="Orders Sampled" value={summary.count.toLocaleString()} sub={`range ${fmtKm(summary.min_km)}–${fmtKm(summary.max_km)}`} />
          </div>

          {/* Distribution histogram */}
          <div style={cardStyle}>
            <SectionTitle
              title="Supply Distribution"
              subtitle="How far the nearest driver was, bucketed by distance. Greener = tighter supply."
            />
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={distribution} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                <YAxis tick={{ fill: "var(--text-secondary)", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <RechartsTooltip content={<ChartTip unit=" bookings" />} cursor={{ fill: "var(--surface-2)" }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {distribution.map((d) => (
                    <Cell key={d.label} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Coverage trend */}
          <div style={cardStyle}>
            <SectionTitle
              title="Coverage Trend"
              subtitle="Average nearest-driver distance per day. A rising line means supply is thinning."
            />
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={trend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="ds-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                <YAxis tick={{ fill: "var(--text-secondary)", fontSize: 12 }} axisLine={false} tickLine={false} unit="km" />
                <RechartsTooltip content={<ChartTip unit=" km avg" />} cursor={{ stroke: "var(--border-hover)" }} />
                <Area type="monotone" dataKey="avg" stroke="var(--accent)" strokeWidth={2} fill="url(#ds-grad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* By vehicle + formula, side by side on wide screens */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
            <div style={cardStyle}>
              <SectionTitle title="Avg Distance by Vehicle" subtitle="Which vehicle classes are hardest to source nearby" />
              <ResponsiveContainer width="100%" height={Math.max(180, byVehicle.length * 38)}>
                <BarChart data={byVehicle} layout="vertical" margin={{ top: 0, right: 16, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} axisLine={false} tickLine={false} unit="km" />
                  <YAxis type="category" dataKey="vehicle" width={90} tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <RechartsTooltip content={<ChartTip unit=" km avg" />} cursor={{ fill: "var(--surface-2)" }} />
                  <Bar dataKey="avg" radius={[0, 4, 4, 0]} fill="var(--accent)" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Haversine formula explainer */}
            <div style={cardStyle}>
              <SectionTitle title="How this is measured" subtitle="The great-circle (haversine) distance" />
              <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "14px" }}>
                For every booking, the backend computes the haversine distance
                between the customer's pickup and each online driver, then keeps the
                smallest. That nearest-driver distance is saved on the order and
                aggregated here.
              </p>
              <div
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "14px 16px",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: "12px",
                  color: "var(--text-primary)",
                  lineHeight: 1.7,
                  overflowX: "auto",
                }}
              >
                <div style={{ color: "var(--text-muted)" }}>{"// R = 6371 km (Earth radius)"}</div>
                <div>a = sin²(Δφ/2) + cos φ₁ · cos φ₂ · sin²(Δλ/2)</div>
                <div>c = 2 · atan2(√a, √(1−a))</div>
                <div>d = R · c</div>
              </div>
              <p style={{ fontSize: "11.5px", color: "var(--text-muted)", lineHeight: 1.6, marginTop: "12px" }}>
                φ = latitude, λ = longitude (radians). It's a straight-line
                "as-the-crow-flies" distance, so real driving distance is a little
                higher — but it's the same metric the dispatcher uses to pick the
                nearest driver.
              </p>
            </div>
          </div>

          {/* Recent bookings table */}
          <div style={cardStyle}>
            <SectionTitle title="Recent Bookings" subtitle="Latest 25 orders with their nearest-driver snapshot" />
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--text-muted)" }}>
                    {["Time", "Vehicle", "Nearest Driver", "Status"].map((h) => (
                      <th key={h} style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", fontWeight: 600, textTransform: "uppercase", fontSize: "10px", letterSpacing: "0.06em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((p) => {
                    const km = p.nearest_driver_km;
                    const c = km <= 3 ? "#00D46A" : km <= 5 ? "#F59E0B" : "#EF4444";
                    return (
                      <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "9px 12px", color: "var(--text-secondary)" }}>{fmtTime(p.created_at)}</td>
                        <td style={{ padding: "9px 12px", color: "var(--text-primary)", fontWeight: 500 }}>{p.vehicle_type || "—"}</td>
                        <td style={{ padding: "9px 12px" }}>
                          <span style={{ color: c, fontWeight: 700 }}>{fmtKm(km)}</span>
                        </td>
                        <td style={{ padding: "9px 12px", color: "var(--text-secondary)" }}>{p.status || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default DriverSupply;
