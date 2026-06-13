import React, { useState, useEffect } from "react";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import TwoWheelerIcon from "@mui/icons-material/TwoWheeler";
import ElectricMopedIcon from "@mui/icons-material/ElectricMoped";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

// In dev, route through Vite proxy to sidestep CORS; in prod, hit Convex directly.
const SITE_URL = import.meta.env.DEV
  ? "/convex-proxy"
  : (import.meta.env.VITE_CONVEX_SITE_URL_PROD || "").replace(/\/$/, "");

const SWYFT_API = "https://swyft-backend-client-nine.vercel.app";
const API_KEY = import.meta.env.VITE_ANALYTICS_API_KEY;

const VEHICLE_META = [
  { key: "car", label: "Car", icon: <DirectionsCarIcon fontSize="small" /> },
  { key: "van", label: "Van", icon: <LocalShippingIcon fontSize="small" /> },
  { key: "pickup", label: "Pickup", icon: <LocalShippingIcon fontSize="small" /> },
  { key: "miniTruck", label: "Mini Truck", icon: <LocalShippingIcon fontSize="small" /> },
  { key: "carRescue", label: "Car Rescue", icon: <DirectionsCarIcon fontSize="small" /> },
  { key: "lorry5Tonne", label: "Lorry 5T", icon: <LocalShippingIcon fontSize="small" /> },
  { key: "lorry10Tonne", label: "Lorry 10T", icon: <LocalShippingIcon fontSize="small" /> },
  { key: "SwyftBoda", label: "Swyft Boda", icon: <TwoWheelerIcon fontSize="small" /> },
  { key: "SwyftBodaElectric", label: "Boda Electric", icon: <ElectricMopedIcon fontSize="small" /> },
];

const CARGO_VEHICLES = [
  { key: "miniTruck", label: "Mini Truck" },
  { key: "van", label: "Van" },
  { key: "pickup", label: "Pickup" },
  { key: "lorry5Tonne", label: "Lorry 5T" },
  { key: "lorry10Tonne", label: "Lorry 10T" },
  { key: "carRescue", label: "Car Rescue" },
];

const DEFAULTS = {
  vehicleRates: {
    van: 210, miniTruck: 250, pickup: 220, carRescue: 400,
    lorry5Tonne: 800, lorry10Tonne: 1200, car: 50, SwyftBoda: 30, SwyftBodaElectric: 20,
  },
  tiers: [
    { maxKm: 2, multiplier: 3.5 },
    { maxKm: 3, multiplier: 3.0 },
    { maxKm: 5, multiplier: 2.5 },
    { maxKm: 10, multiplier: 1.2 },
  ],
  decay: 0.005,
  floor: 50,
  cargoMinimum: 1000,
  loaderCostPerHead: 600,
  movingPackages: [
    { key: "studio", label: "Studio",     vehicle: "miniTruck",    loaders: 1 },
    { key: "bed1",   label: "1 Bedroom",  vehicle: "miniTruck",    loaders: 2 },
    { key: "bed2",   label: "2 Bedroom",  vehicle: "lorry5Tonne",  loaders: 2 },
    { key: "bed4",   label: "4 Bedroom",  vehicle: "lorry10Tonne", loaders: 3 },
    { key: "bed5",   label: "5+ Bedroom", vehicle: "lorry10Tonne", loaders: 4 },
  ],
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

function Pricing() {
  const [pricing, setPricing] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const [commissionRate, setCommissionRate] = useState(18);
  const [commissionSaving, setCommissionSaving] = useState(false);
  const [commissionStatus, setCommissionStatus] = useState(null);

  useEffect(() => {
    fetchPricing();
    fetchCommissionRate();
  }, []);

  async function fetchPricing() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`${SITE_URL}/api/pricing`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPricing({
          ...DEFAULTS,
          ...data,
          vehicleRates: { ...DEFAULTS.vehicleRates, ...(data.vehicleRates || {}) },
          tiers: data.tiers?.length ? data.tiers : DEFAULTS.tiers,
          movingPackages: data.movingPackages?.length ? data.movingPackages : DEFAULTS.movingPackages,
        });
      } else if (res.status === 404) {
        // No record yet — defaults are already in state, just continue
      } else {
        const txt = await res.text().catch(() => "");
        setStatus({ type: "error", message: `Fetch failed ${res.status}: ${txt || res.statusText}` });
      }
    } catch (e) {
      setStatus({ type: "error", message: `Network error: ${e.message}` });
    }
    setLoading(false);
  }

  async function savePricing() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`${SITE_URL}/api/pricing`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...pricing, updatedBy: "dashboard" }),
      });
      if (res.ok) {
        setStatus({ type: "success", message: "Pricing updated successfully." });
      } else {
        const txt = await res.text();
        setStatus({ type: "error", message: `Save failed: ${txt || res.statusText}` });
      }
    } catch (e) {
      setStatus({ type: "error", message: `Network error: ${e.message}` });
    }
    setSaving(false);
  }

  async function fetchCommissionRate() {
    try {
      const res = await fetch(`${SWYFT_API}/config`);
      if (res.ok) {
        const data = await res.json();
        setCommissionRate(Math.round(data.commission_rate * 100));
      }
    } catch {}
  }

  async function saveCommissionRate() {
    if (commissionRate < 1 || commissionRate > 100) {
      setCommissionStatus({ type: "error", message: "Rate must be between 1% and 100%." });
      return;
    }
    setCommissionSaving(true);
    setCommissionStatus(null);
    try {
      const res = await fetch(`${SWYFT_API}/config/commission-rate`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commission_rate: commissionRate / 100 }),
      });
      if (res.ok) {
        setCommissionStatus({ type: "success", message: "Commission rate updated." });
      } else {
        const txt = await res.text().catch(() => "");
        setCommissionStatus({ type: "error", message: `Save failed: ${txt || res.statusText}` });
      }
    } catch (e) {
      setCommissionStatus({ type: "error", message: `Network error: ${e.message}` });
    }
    setCommissionSaving(false);
  }

  const setVehicleRate = (key, val) =>
    setPricing((p) => ({ ...p, vehicleRates: { ...p.vehicleRates, [key]: Number(val) } }));

  const setTier = (i, field, val) =>
    setPricing((p) => ({
      ...p,
      tiers: p.tiers.map((t, idx) => (idx === i ? { ...t, [field]: Number(val) } : t)),
    }));

  const addTier = () =>
    setPricing((p) => ({ ...p, tiers: [...p.tiers, { maxKm: 0, multiplier: 1.0 }] }));

  const removeTier = (i) =>
    setPricing((p) => ({ ...p, tiers: p.tiers.filter((_, idx) => idx !== i) }));

  const setParam = (key, val) => setPricing((p) => ({ ...p, [key]: Number(val) }));

  const setMovingPkg = (i, field, val) =>
    setPricing((p) => ({
      ...p,
      movingPackages: p.movingPackages.map((pkg, idx) =>
        idx === i ? { ...pkg, [field]: field === "loaders" ? Number(val) : val } : pkg
      ),
    }));

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "200px", color: "var(--text-secondary)", fontSize: "14px" }}>
        Loading pricing configuration...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "860px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", margin: 0 }}>
            Pricing
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
            Configure vehicle rates, distance tiers, and fare parameters.
          </p>
        </div>
        <button
          onClick={fetchPricing}
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
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-hover)"; e.currentTarget.style.color = "var(--text-primary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
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

      {/* Commission Rate */}
      <div style={cardStyle}>
        <SectionTitle
          title="Platform Commission Rate"
          subtitle="Percentage of each order's total charged as Swyft's platform fee. Applied to all drivers in real time."
        />
        {commissionStatus && (
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "10px 14px", marginBottom: "14px",
            background: commissionStatus.type === "success" ? "var(--accent-dim)" : "var(--danger-dim)",
            border: `1px solid ${commissionStatus.type === "success" ? "var(--accent-border)" : "rgba(239,68,68,0.25)"}`,
            borderRadius: "var(--radius-sm)",
            fontSize: "13px",
            color: commissionStatus.type === "success" ? "var(--accent)" : "var(--danger)",
          }}>
            {commissionStatus.type === "success"
              ? <CheckCircleOutlineIcon style={{ fontSize: "16px" }} />
              : <ErrorOutlineIcon style={{ fontSize: "16px" }} />}
            {commissionStatus.message}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <label style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600, display: "block", marginBottom: "6px", letterSpacing: "0.02em", textTransform: "uppercase" }}>
              Rate (%)
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={commissionRate}
              onChange={(e) => setCommissionRate(Number(e.target.value))}
              style={{ ...inputStyle, width: "110px" }}
            />
          </div>
          <div style={{ fontSize: "13px", color: "var(--text-secondary)", paddingBottom: "10px" }}>
            Drivers keep <strong style={{ color: "var(--text-primary)" }}>{100 - commissionRate}%</strong> of each fare
          </div>
          <button
            onClick={saveCommissionRate}
            disabled={commissionSaving}
            style={{
              padding: "9px 20px",
              background: commissionSaving ? "var(--accent-dim)" : "var(--accent)",
              border: commissionSaving ? "1px solid var(--accent-border)" : "none",
              borderRadius: "var(--radius-sm)",
              color: commissionSaving ? "var(--accent)" : "#07080D",
              fontSize: "13px", fontWeight: 700,
              cursor: commissionSaving ? "not-allowed" : "pointer",
              transition: "all 150ms ease",
              fontFamily: "inherit",
              letterSpacing: "-0.01em",
            }}
          >
            {commissionSaving ? "Saving..." : "Update Rate"}
          </button>
        </div>
      </div>

      {/* Vehicle Base Rates */}
      <div style={cardStyle}>
        <SectionTitle
          title="Vehicle Base Rates"
          subtitle="Starting fare per vehicle type before distance multipliers are applied (KES)"
        />
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: "12px",
        }}>
          {VEHICLE_META.map(({ key, label, icon }) => (
            <div key={key} style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "14px 12px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "10px", color: "var(--text-secondary)" }}>
                {icon}
                <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.01em" }}>
                  {label}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", flexShrink: 0, fontWeight: 500 }}>KES</span>
                <input
                  type="number"
                  min="0"
                  value={pricing.vehicleRates[key] ?? ""}
                  onChange={(e) => setVehicleRate(key, e.target.value)}
                  style={{ ...inputStyle, padding: "6px 8px", fontSize: "15px" }}
                  onFocus={(e) => { e.target.style.borderColor = "var(--accent-border)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Distance Multiplier Tiers */}
      <div style={cardStyle}>
        <SectionTitle
          title="Distance Multiplier Tiers"
          subtitle="Applied sequentially by trip distance — tiers stack from shortest to longest"
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 40px",
            gap: "8px", paddingBottom: "8px",
            borderBottom: "1px solid var(--border)",
          }}>
            {["Max Distance (km)", "Multiplier (×)", ""].map((h) => (
              <span key={h} style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
                {h}
              </span>
            ))}
          </div>

          {pricing.tiers.map((tier, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 40px", gap: "8px", alignItems: "center" }}>
              <input
                type="number"
                min="0"
                step="0.5"
                value={tier.maxKm}
                onChange={(e) => setTier(i, "maxKm", e.target.value)}
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = "var(--accent-border)"; }}
                onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
              />
              <input
                type="number"
                min="0"
                step="0.1"
                value={tier.multiplier}
                onChange={(e) => setTier(i, "multiplier", e.target.value)}
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = "var(--accent-border)"; }}
                onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
              />
              <button
                onClick={() => removeTier(i)}
                disabled={pricing.tiers.length <= 1}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: "34px", height: "34px",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-xs)",
                  cursor: pricing.tiers.length <= 1 ? "not-allowed" : "pointer",
                  color: pricing.tiers.length <= 1 ? "var(--text-muted)" : "var(--danger)",
                  transition: "all 150ms ease",
                  flexShrink: 0,
                  padding: 0,
                }}
              >
                <DeleteOutlineIcon style={{ fontSize: "16px" }} />
              </button>
            </div>
          ))}

          <button
            onClick={addTier}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "8px 14px",
              background: "transparent",
              border: "1px dashed var(--border-hover)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-secondary)",
              fontSize: "12px", fontWeight: 500,
              cursor: "pointer", transition: "all 150ms ease",
              fontFamily: "inherit", marginTop: "6px",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent-border)"; e.currentTarget.style.color = "var(--accent)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-hover)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          >
            <AddIcon style={{ fontSize: "16px" }} />
            Add Tier
          </button>
        </div>
      </div>

      {/* Pricing Parameters */}
      <div style={cardStyle}>
        <SectionTitle
          title="Pricing Parameters"
          subtitle="Global constants applied across all fare calculations"
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "20px" }}>
          {[
            { key: "decay", label: "Distance Decay", hint: "Exponential decay factor per km", step: "0.001" },
            { key: "floor", label: "Price Floor", hint: "Minimum fare (KES)", step: "1" },
            { key: "cargoMinimum", label: "Cargo Minimum", hint: "Min fare for cargo trips (KES)", step: "1" },
            { key: "loaderCostPerHead", label: "Loader Cost / Head", hint: "Cost per loader added to fare (KES)", step: "1" },
          ].map(({ key, label, hint, step }) => (
            <div key={key}>
              <label style={{
                display: "block",
                fontSize: "11px", color: "var(--text-secondary)",
                textTransform: "uppercase", letterSpacing: "0.06em",
                fontWeight: 600, marginBottom: "7px",
              }}>
                {label}
              </label>
              <input
                type="number"
                step={step}
                min="0"
                value={pricing[key] ?? ""}
                onChange={(e) => setParam(key, e.target.value)}
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = "var(--accent-border)"; }}
                onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
              />
              <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "5px", lineHeight: "1.4" }}>
                {hint}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Moving Packages */}
      <div style={cardStyle}>
        <SectionTitle
          title="Moving Packages"
          subtitle="Vehicle and loader assignment per home size — affects the Moving tab in the app"
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{
            display: "grid", gridTemplateColumns: "120px 1fr 80px",
            gap: "8px", paddingBottom: "8px",
            borderBottom: "1px solid var(--border)",
          }}>
            {["Package", "Vehicle", "Loaders"].map((h) => (
              <span key={h} style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
                {h}
              </span>
            ))}
          </div>

          {(pricing.movingPackages ?? DEFAULTS.movingPackages).map((pkg, i) => (
            <div key={pkg.key} style={{ display: "grid", gridTemplateColumns: "120px 1fr 80px", gap: "8px", alignItems: "center" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                {pkg.label}
              </span>
              <select
                value={pkg.vehicle}
                onChange={(e) => setMovingPkg(i, "vehicle", e.target.value)}
                style={{ ...inputStyle, cursor: "pointer" }}
                onFocus={(e) => { e.target.style.borderColor = "var(--accent-border)"; }}
                onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
              >
                {CARGO_VEHICLES.map(({ key, label }) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                max="10"
                value={pkg.loaders}
                onChange={(e) => setMovingPkg(i, "loaders", e.target.value)}
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = "var(--accent-border)"; }}
                onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <div style={{ display: "flex", justifyContent: "flex-end", paddingBottom: "8px" }}>
        <button
          onClick={savePricing}
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
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

export default Pricing;
