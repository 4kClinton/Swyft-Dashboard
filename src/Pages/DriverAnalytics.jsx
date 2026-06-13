import React, { useState, useEffect, useMemo } from "react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import swyftLogoSrc from "../assets/Untitled design (6).png";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
} from "recharts";
import { supabase } from "../supabaseClient";

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(n, decimals = 0) {
  if (n == null || isNaN(n)) return "—";
  return Number(n).toLocaleString("en-KE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtKES(n) { return n ? `KES ${fmt(n)}` : "KES —"; }
function pct(r) { return (r == null || isNaN(r)) ? "—" : (r * 100).toFixed(1) + "%"; }
function monthLabel(d) { return d.toLocaleDateString("en-KE", { month: "short", year: "2-digit" }); }

// ── Trust score ───────────────────────────────────────────────────────────────

function computeTrustScore({ completedJobs, avgRating, cancellationRate, utilization, maxJobs, tenureMonths, revenueCV }) {
  const volume      = Math.min(completedJobs / Math.max(maxJobs, 1), 1) * 15;
  const rating      = avgRating > 0 ? (avgRating / 5) * 20 : 10;
  const reliability = (1 - cancellationRate) * 20;
  const util        = utilization * 20;
  const tenure      = Math.min(tenureMonths / 24, 1) * 15;
  const consistency = Math.max(0, 1 - revenueCV) * 10;
  return Math.min(100, Math.round(volume + rating + reliability + util + tenure + consistency));
}

function getTrustFactors({ completedJobs, avgRating, cancellationRate, utilization, maxJobs, tenureMonths, revenueCV }) {
  return [
    { name: "Completion Rate",     value: Math.round((1 - cancellationRate) * 100), raw: pct(1 - cancellationRate) },
    { name: "Utilization",         value: Math.round(utilization * 100),            raw: pct(utilization) },
    { name: "Customer Rating",     value: avgRating > 0 ? Math.round((avgRating / 5) * 100) : 50, raw: avgRating > 0 ? avgRating.toFixed(1) + " ★" : "—" },
    { name: "Revenue Consistency", value: Math.round(Math.max(0, 1 - revenueCV) * 100), raw: revenueCV < 0.3 ? "Stable" : revenueCV < 0.6 ? "Moderate" : "Volatile" },
    { name: "Tenure",              value: Math.round(Math.min(tenureMonths / 24, 1) * 100), raw: tenureMonths < 1 ? "< 1 mo" : tenureMonths + " mo" },
    { name: "Job Volume",          value: Math.round(Math.min(completedJobs / Math.max(maxJobs, 1), 1) * 100), raw: fmt(completedJobs) + " jobs" },
  ];
}

function scoreTier(score) {
  if (score >= 80) return { label: "Excellent", color: "#00D46A", bg: "rgba(0,212,106,0.1)",  border: "rgba(0,212,106,0.25)" };
  if (score >= 65) return { label: "Good",      color: "#3B82F6", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.25)" };
  if (score >= 50) return { label: "Fair",      color: "#F59E0B", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)" };
  return               { label: "Poor",         color: "#EF4444", bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.25)" };
}

// ── Financing logic ───────────────────────────────────────────────────────────

function getFinancingReadiness(score, avgMonthly3m, cancellationRate) {
  if (score >= 65 && avgMonthly3m >= 25000 && cancellationRate < 0.25) return "Eligible";
  if (score >= 50 && avgMonthly3m >= 10000) return "Monitor";
  return "Not Eligible";
}

function getRiskLevel(score) {
  if (score >= 70) return { label: "Low",    color: "#00D46A", bg: "rgba(0,212,106,0.1)",  border: "rgba(0,212,106,0.25)" };
  if (score >= 55) return { label: "Medium", color: "#F59E0B", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)" };
  return               { label: "High",    color: "#EF4444", bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.25)" };
}

function getFinancingBadge(readiness) {
  if (readiness === "Eligible") return { color: "#00D46A", bg: "rgba(0,212,106,0.1)",  border: "rgba(0,212,106,0.25)" };
  if (readiness === "Monitor")  return { color: "#F59E0B", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)" };
  return                               { color: "#EF4444", bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.25)" };
}

function calcAssetValue(avgMonthly3m) { return Math.round(avgMonthly3m * 0.30 * 24); }
function calcMonthlyRepayment(assetValue) { return Math.round(assetValue * 0.0507); }

// ── Monthly trend helpers ─────────────────────────────────────────────────────

function getMonthlyTrend(dOrders, months = 12) {
  const now = new Date();
  return Array.from({ length: months }, (_, i) => {
    const d    = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const mo   = dOrders.filter(o => { const od = new Date(o.created_at); return od >= d && od < next; });
    const comp = mo.filter(o => /completed/i.test(o.status || ""));
    return {
      label:       monthLabel(d),
      revenue:     comp.reduce((s, o) => s + (Number(o.commission) || 0), 0),
      utilization: mo.length > 0 ? (comp.length / mo.length) * 100 : 0,
      jobs:        comp.length,
    };
  });
}

function calcRevenueCV(monthlyTrend) {
  const revs = monthlyTrend.map(m => m.revenue).filter(r => r > 0);
  if (revs.length < 2) return 0;
  const mean = revs.reduce((a, b) => a + b, 0) / revs.length;
  if (mean === 0) return 0;
  const variance = revs.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / revs.length;
  return Math.sqrt(variance) / mean;
}

// ── Small UI primitives ───────────────────────────────────────────────────────

function StatCard({ title, value, sub, accent, highlight }) {
  return (
    <div style={{
      background:   highlight ? "rgba(0,212,106,0.05)" : "var(--surface-1)",
      border:       `1px solid ${highlight ? "rgba(0,212,106,0.2)" : "var(--border)"}`,
      borderRadius: "var(--radius-lg)",
      padding:      "18px 20px",
      display:      "flex",
      flexDirection:"column",
      gap:          "6px",
      minWidth:     0,
    }}>
      <p style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-secondary)" }}>{title}</p>
      <p style={{ fontSize: "24px", fontWeight: 800, color: accent || "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{sub}</p>}
    </div>
  );
}

function Badge({ label, color, bg, border }) {
  return (
    <span style={{ fontSize: "10px", fontWeight: 700, background: bg, border: `1px solid ${border}`, color, borderRadius: "4px", padding: "2px 8px", letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function MiniMetric({ label, value, color }) {
  return (
    <div style={{ background: "var(--surface-2)", borderRadius: "var(--radius-sm)", padding: "10px 12px" }}>
      <p style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>{label}</p>
      <p style={{ fontSize: "13px", fontWeight: 700, color: color || "var(--text-primary)" }}>{value}</p>
    </div>
  );
}

function ScoreBar({ value, color }) {
  return (
    <div style={{ flex: 1, height: "4px", background: "var(--surface-3)", borderRadius: "2px", overflow: "hidden", minWidth: "40px" }}>
      <div style={{ width: `${Math.min(value, 100)}%`, height: "100%", background: color, borderRadius: "2px" }} />
    </div>
  );
}

function ChartTooltip({ active, payload, label, prefix = "", suffix = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-hover)", borderRadius: "var(--radius-sm)", padding: "8px 12px", fontSize: "12px" }}>
      <p style={{ color: "var(--text-secondary)", marginBottom: "4px", fontSize: "11px" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || "var(--accent)", fontWeight: 600 }}>
          {prefix}{typeof p.value === "number" ? p.value.toLocaleString("en-KE") : p.value}{suffix}
        </p>
      ))}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "8px" }}>
      {children}
    </p>
  );
}

// ── PDF helpers ───────────────────────────────────────────────────────────────

async function getLogoDataURL() {
  try {
    const res  = await fetch(swyftLogoSrc);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload  = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

const PDF_STYLES = `
*{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;box-sizing:border-box;margin:0;padding:0}
body{background:#ffffff;color:#0f172a;font-size:13px;line-height:1.6}
.page{padding:44px 48px;background:#fff}

/* ── Header ── */
.hdr{display:flex;justify-content:space-between;align-items:center;padding-bottom:22px;margin-bottom:28px;border-bottom:3px solid #00D46A}
.hdr-logo img{height:166px;display:block}
.hdr-meta{text-align:right}
.hdr-meta .doc-type{font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#00D46A;margin-bottom:4px}
.hdr-meta .doc-ref{font-size:11px;color:#64748b}
.hdr-meta .doc-date{font-size:11px;color:#94a3b8}
.confidential{display:inline-block;font-size:9px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;background:#fff3cd;color:#92400e;border:1px solid #fbbf24;border-radius:3px;padding:2px 7px;margin-top:6px}

/* ── Driver banner ── */
.banner{background:#0f172a;border-radius:10px;padding:20px 24px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between}
.banner-name{font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;margin-bottom:4px}
.banner-sub{font-size:12px;color:#94a3b8}
.banner-score{text-align:right}
.banner-score-num{font-size:42px;font-weight:900;line-height:1;letter-spacing:-0.03em}
.banner-score-label{font-size:11px;font-weight:700;margin-top:2px}

/* ── Score bar ── */
.score-bar-wrap{margin:16px 0 24px}
.score-bar-track{height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;margin:6px 0}
.score-bar-fill{height:100%;border-radius:4px}
.score-bar-labels{display:flex;justify-content:space-between;font-size:9px;color:#94a3b8}

/* ── Section header ── */
.sh{font-size:9px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#64748b;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e2e8f0}

/* ── Metric grid ── */
.g2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:20px}
.mc{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px}
.ml{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#94a3b8;margin-bottom:5px}
.mv{font-size:15px;font-weight:800;color:#0f172a;line-height:1.2}

/* ── Financing box ── */
.fin-box{background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:18px 20px;margin-bottom:20px}
.fin-box-title{font-size:9px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#16a34a;margin-bottom:14px}
.fin-main{display:flex;gap:12px;margin-bottom:14px}
.fin-card{flex:1;background:#ffffff;border:1px solid #bbf7d0;border-radius:8px;padding:14px}
.fin-card .ml{color:#16a34a}
.fin-card .mv{color:#15803d;font-size:18px}

/* ── Badge ── */
.badge{display:inline-block;font-size:10px;font-weight:700;padding:3px 10px;border-radius:4px;text-transform:uppercase;letter-spacing:0.05em}

/* ── Risk block ── */
.risk-block{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px;margin-bottom:20px}
.risk-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:12px}
.risk-row:last-child{border-bottom:none}
.risk-key{color:#64748b;font-weight:500}
.risk-val{font-weight:700;color:#0f172a}

/* ── Footer ── */
.ftr{margin-top:32px;padding-top:14px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center}
.ftr-left{font-size:10px;color:#94a3b8}
.ftr-right{font-size:10px;color:#cbd5e1;text-align:right}

/* ── Fleet cover ── */
.cover-title{font-size:28px;font-weight:900;color:#0f172a;letter-spacing:-0.03em;margin-bottom:6px}
.cover-sub{font-size:13px;color:#64748b;margin-bottom:32px}
.fleet-stat{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px}
.fleet-stat .ml{color:#64748b}
.fleet-stat .mv{font-size:20px}
.tbl{width:100%;border-collapse:collapse;font-size:12px;margin-top:10px}
.tbl th{padding:10px 12px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.07em;color:#94a3b8;background:#f8fafc;border-bottom:1px solid #e2e8f0}
.tbl td{padding:10px 12px;border-bottom:1px solid #f1f5f9}
.tbl tr:last-child td{border-bottom:none}
.sep{margin:40px 0 32px;border:none;border-top:2px dashed #e2e8f0}
`;

function mc(label, value, valueColor = "#0f172a") {
  return `<div class="mc"><div class="ml">${label}</div><div class="mv" style="color:${valueColor}">${value}</div></div>`;
}

function scoreBarHTML(score, color) {
  return `
<div class="score-bar-wrap">
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
    <span style="font-size:11px;font-weight:600;color:#64748b">Score breakdown</span>
    <span style="font-size:11px;color:#94a3b8">0 — 100</span>
  </div>
  <div class="score-bar-track"><div class="score-bar-fill" style="width:${score}%;background:${color}"></div></div>
  <div class="score-bar-labels">
    <span>Poor</span><span>Fair</span><span>Good</span><span>Excellent</span>
  </div>
</div>`;
}

function buildDriverHTML(driver, { showHeader = true, logoSrc = "" } = {}) {
  const tier      = scoreTier(driver.score);
  const risk      = getRiskLevel(driver.score);
  const readiness = getFinancingReadiness(driver.score, driver.avgMonthly3m, driver.cancellationRate);
  const rb        = getFinancingBadge(readiness);
  const asset     = calcAssetValue(driver.avgMonthly3m);
  const repay     = calcMonthlyRepayment(asset);
  const date      = new Date().toLocaleDateString("en-KE", { dateStyle: "long" });
  const ref       = "DRV-" + String(driver.driverId).slice(-6).toUpperCase();

  return `<div class="page">

${showHeader ? `
<div class="hdr">
  <div class="hdr-logo">${logoSrc ? `<img src="${logoSrc}" alt="Swyft" />` : `<span style="font-size:22px;font-weight:900;color:#00D46A;letter-spacing:-0.03em">swyft</span>`}</div>
  <div class="hdr-meta">
    <div class="doc-type">Driver Credit Profile</div>
    <div class="doc-ref">${ref}</div>
    <div class="doc-date">${date}</div>
    <div class="confidential">Confidential — Lender Use Only</div>
  </div>
</div>` : `
<div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:14px;margin-bottom:20px;border-bottom:2px solid #00D46A">
  <div style="display:flex;align-items:center;gap:12px">
    ${logoSrc ? `<img src="${logoSrc}" alt="Swyft" style="height:24px" />` : ""}
    <span style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b">Driver Credit Profile</span>
  </div>
  <div style="text-align:right"><div style="font-size:10px;color:#94a3b8">${ref}</div><div style="font-size:10px;color:#cbd5e1">${date}</div></div>
</div>`}

<!-- Driver Banner -->
<div class="banner">
  <div>
    <div class="banner-name">${driver.driverName}</div>
    <div class="banner-sub">${driver.carType}${driver.vehicleReg && driver.vehicleReg !== "—" ? " &nbsp;·&nbsp; " + driver.vehicleReg : ""} &nbsp;·&nbsp; ${driver.tenureMonths < 1 ? "< 1 month on platform" : driver.tenureMonths + " months on platform"}</div>
    <div style="margin-top:10px;display:flex;gap:8px">
      <span class="badge" style="background:${rb.bg};color:${rb.color};border:1px solid ${rb.border}">${readiness}</span>
      <span class="badge" style="background:${risk.bg};color:${risk.color};border:1px solid ${risk.border}">${risk.label} Risk</span>
    </div>
  </div>
  <div class="banner-score">
    <div class="banner-score-num" style="color:${tier.color}">${driver.score}</div>
    <div class="banner-score-label" style="color:${tier.color}">${tier.label}</div>
    <div style="font-size:10px;color:#475569;margin-top:3px">SWYFT Trust Score</div>
  </div>
</div>

<!-- Trust Score -->
<div class="sh">SWYFT Trust Score</div>
${scoreBarHTML(driver.score, tier.color)}
<div class="g3" style="margin-bottom:24px">
  ${mc("Completion Rate", pct(1 - driver.cancellationRate), (1 - driver.cancellationRate) > 0.8 ? "#15803d" : "#0f172a")}
  ${mc("Utilization", pct(driver.utilization))}
  ${mc("Avg Rating", driver.avgRating > 0 ? driver.avgRating.toFixed(1) + " / 5.0" : "—")}
  ${mc("Revenue Consistency", driver.revenueCV < 0.3 ? "Stable" : driver.revenueCV < 0.6 ? "Moderate" : "Volatile", driver.revenueCV < 0.3 ? "#15803d" : driver.revenueCV < 0.6 ? "#b45309" : "#dc2626")}
  ${mc("Platform Tenure", driver.tenureMonths < 1 ? "< 1 month" : driver.tenureMonths + " months")}
  ${mc("Jobs Completed", fmt(driver.completed))}
</div>

<!-- Revenue -->
<div class="sh">Revenue History</div>
<div class="g3">
  ${mc("Last 30 Days", "KES " + fmt(driver.rev30d))}
  ${mc("Last 90 Days", "KES " + fmt(driver.rev90d))}
  ${mc("Last 12 Months", "KES " + fmt(driver.rev12m))}
  ${mc("Lifetime Revenue", "KES " + fmt(driver.revenue))}
  ${mc("Avg Monthly (3m)", "KES " + fmt(driver.avgMonthly3m))}
  ${mc("Revenue Trend", (driver.revGrowth >= 0 ? "▲ " : "▼ ") + Math.abs(driver.revGrowth || 0).toFixed(0) + "%", driver.revGrowth >= 0 ? "#15803d" : "#dc2626")}
</div>

<!-- Performance -->
<div class="sh">Performance Metrics</div>
<div class="g3">
  ${mc("Jobs Completed", fmt(driver.completed))}
  ${mc("Jobs Last 30d", fmt(driver.jobs30d))}
  ${mc("Cancellation Rate", pct(driver.cancellationRate), driver.cancellationRate > 0.25 ? "#dc2626" : "#0f172a")}
  ${mc("Active Weeks", fmt(driver.activeWeeks))}
  ${mc("Avg Monthly Jobs", fmt(Math.round(driver.completed / Math.max(driver.tenureMonths, 1))))}
  ${mc("Avg Rating", driver.avgRating > 0 ? driver.avgRating.toFixed(2) + " ★" : "—")}
</div>

<!-- Financing -->
<div class="fin-box">
  <div class="fin-box-title">Financing Readiness</div>
  <div class="fin-main">
    <div class="fin-card">
      <div class="ml">Recommended Asset Value</div>
      <div class="mv" style="font-size:22px;color:#15803d">KES ${fmt(asset)}</div>
    </div>
    <div class="fin-card">
      <div class="ml">Est. Monthly Repayment</div>
      <div class="mv" style="font-size:22px">KES ${fmt(repay)}</div>
    </div>
  </div>
  <div style="font-size:11px;color:#4b5563;background:#ffffff;border:1px solid #bbf7d0;border-radius:6px;padding:10px 14px">
    <strong>Basis:</strong> 30% of avg 3-month monthly revenue (KES ${fmt(driver.avgMonthly3m)}) repayment capacity over 24-month term at ~18% APR.
  </div>
</div>

<!-- Risk Assessment -->
<div class="sh">Risk Assessment</div>
<div class="risk-block">
  <div class="risk-row"><span class="risk-key">Risk Level</span><span class="risk-val" style="color:${risk.color}">${risk.label}</span></div>
  <div class="risk-row"><span class="risk-key">Trust Score</span><span class="risk-val">${driver.score} / 100 &nbsp;<span style="color:${tier.color}">${tier.label}</span></span></div>
  <div class="risk-row"><span class="risk-key">Revenue Stability</span><span class="risk-val">${driver.revenueCV < 0.3 ? "Stable" : driver.revenueCV < 0.6 ? "Moderate" : "Volatile"}</span></div>
  <div class="risk-row"><span class="risk-key">Cancellation Risk</span><span class="risk-val">${driver.cancellationRate < 0.1 ? "Low" : driver.cancellationRate < 0.25 ? "Moderate" : "High"} (${pct(driver.cancellationRate)})</span></div>
  <div class="risk-row"><span class="risk-key">Platform Activity</span><span class="risk-val">${driver.tenureMonths < 1 ? "< 1 month" : driver.tenureMonths + " months"}, ${fmt(driver.activeWeeks)} active weeks</span></div>
  <div class="risk-row"><span class="risk-key">Underwriting Note</span><span class="risk-val" style="font-size:11px;max-width:380px;text-align:right">${readiness === "Eligible" ? "Meets minimum criteria for asset financing." : readiness === "Monitor" ? "Partial eligibility — 90-day monitoring recommended." : "Does not meet criteria. Revisit after 6 months of activity."}</span></div>
</div>

<div class="ftr">
  <div class="ftr-left">
    <div style="font-weight:700;color:#64748b;margin-bottom:2px">SWYFT Logistics Platform</div>
    <div>Confidential Lender Report &nbsp;·&nbsp; Not for distribution</div>
  </div>
  <div class="ftr-right">
    <div>${ref}</div>
    <div>${date}</div>
  </div>
</div>

</div>`;
}

async function htmlBodyToPDF(bodyHTML, filename) {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:absolute;left:-9999px;top:0;width:794px;background:#ffffff;box-sizing:border-box";
  wrapper.innerHTML = `<style>${PDF_STYLES}</style>${bodyHTML}`;
  document.body.appendChild(wrapper);

  try {
    const canvas = await html2canvas(wrapper, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      width: 800,
      scrollX: 0,
      scrollY: 0,
      windowWidth: 800,
    });

    const pdf    = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW  = pdf.internal.pageSize.getWidth();
    const pageH  = pdf.internal.pageSize.getHeight();
    const imgW   = pageW;
    const imgH   = (canvas.height / canvas.width) * imgW;
    const img    = canvas.toDataURL("image/jpeg", 0.92);

    let rendered = 0;
    while (rendered < imgH) {
      if (rendered > 0) pdf.addPage();
      pdf.addImage(img, "JPEG", 0, -rendered, imgW, imgH);
      rendered += pageH;
    }

    pdf.save(`${filename}.pdf`);
  } finally {
    document.body.removeChild(wrapper);
  }
}

async function exportDriverPDF(driver) {
  if (!driver) return;
  const logoSrc = await getLogoDataURL();
  await htmlBodyToPDF(buildDriverHTML(driver, { showHeader: true, logoSrc }), `SWYFT-${driver.driverName.replace(/\s+/g, "-")}`);
}

async function exportAllDriversPDF(profiles) {
  if (!profiles?.length) return;
  const logoSrc  = await getLogoDataURL();
  const sorted   = [...profiles].sort((a, b) => b.score - a.score);
  const date     = new Date().toLocaleDateString("en-KE", { dateStyle: "long" });
  const eligible = profiles.filter(p => p.readiness === "Eligible").sort((a, b) => b.score - a.score);
  const totalCap = eligible.reduce((s, p) => s + p.assetValue, 0);
  const avgScore = Math.round(profiles.reduce((s, p) => s + p.score, 0) / profiles.length);
  const avgMonthly = profiles.reduce((s, p) => s + p.avgMonthly3m, 0) / profiles.length;

  const coverPage = `<div class="page">
<div class="hdr">
  <div class="hdr-logo">${logoSrc ? `<img src="${logoSrc}" alt="Swyft" />` : `<span style="font-size:22px;font-weight:900;color:#00D46A">swyft</span>`}</div>
  <div class="hdr-meta">
    <div class="doc-type">Fleet Driver Credit Report</div>
    <div class="doc-date">${date}</div>
    <div class="confidential">Confidential — Lender Use Only</div>
  </div>
</div>

<div style="margin-bottom:28px">
  <div class="cover-title">Fleet Credit Report</div>
  <div class="cover-sub">Comprehensive driver profiles for financing assessment &amp; underwriting</div>
  <div class="g3" style="margin-bottom:0">
    ${mc("Total Drivers", String(profiles.length))}
    ${mc("Finance-Eligible", String(eligible.length), "#15803d")}
    ${mc("Total Financing Capacity", "KES " + fmt(totalCap), "#15803d")}
    ${mc("Avg Trust Score", String(avgScore), scoreTier(avgScore).color)}
    ${mc("Avg Monthly Revenue", "KES " + fmt(avgMonthly))}
    ${mc("Report Date", date)}
  </div>
</div>

${eligible.length > 0 ? `
<div class="sh">Eligible Drivers — Quick Reference</div>
<table class="tbl">
  <thead><tr>
    <th>Driver</th><th>Trust Score</th><th>Avg Monthly Rev</th><th>Utilization</th><th>Tenure</th><th>Asset Value</th>
  </tr></thead>
  <tbody>
    ${eligible.map(p => `
    <tr>
      <td style="font-weight:700">${p.driverName}<br/><span style="font-weight:400;color:#94a3b8;font-size:11px">${p.carType}</span></td>
      <td style="font-weight:900;color:${p.tier.color}">${p.score}<span style="font-weight:500;color:#94a3b8;font-size:10px;margin-left:4px">${p.tier.label}</span></td>
      <td>KES ${fmt(p.avgMonthly3m)}</td>
      <td>${pct(p.utilization)}</td>
      <td>${p.tenureMonths < 1 ? "< 1 mo" : p.tenureMonths + " mo"}</td>
      <td style="font-weight:800;color:#15803d">KES ${fmt(p.assetValue)}</td>
    </tr>`).join("")}
  </tbody>
</table>` : ""}

<div class="ftr">
  <div class="ftr-left"><div style="font-weight:700;color:#64748b;margin-bottom:2px">SWYFT Logistics Platform</div><div>Confidential Fleet Report · Not for distribution</div></div>
  <div class="ftr-right"><div>${date}</div></div>
</div>
</div>`;

  const driverPages = sorted.map(d =>
    `<hr class="sep" />${buildDriverHTML(d, { showHeader: false, logoSrc })}`
  ).join("\n");

  await htmlBodyToPDF(
    coverPage + driverPages,
    `SWYFT-Fleet-Report-${new Date().toISOString().slice(0, 10)}`
  );
}

// ── Driver profile panel ──────────────────────────────────────────────────────

function DriverProfilePanel({ driver, rawOrders, onClose, onExportPDF }) {
  const [exporting, setExporting] = useState(false);

  const monthlyTrend = useMemo(() => {
    if (!driver) return [];
    const dOrders = rawOrders.filter(o => String(o.driver_id) === String(driver.driverId));
    return getMonthlyTrend(dOrders);
  }, [driver, rawOrders]);

  if (!driver) return null;

  async function handleExport() {
    setExporting(true);
    try { await onExportPDF(driver); } finally { setExporting(false); }
  }

  const tier       = driver.tier;
  const risk       = getRiskLevel(driver.score);
  const readiness  = getFinancingReadiness(driver.score, driver.avgMonthly3m, driver.cancellationRate);
  const rb         = getFinancingBadge(readiness);
  const assetValue = calcAssetValue(driver.avgMonthly3m);
  const repayment  = calcMonthlyRepayment(assetValue);
  const factors    = getTrustFactors({
    completedJobs:   driver.completed,
    avgRating:       driver.avgRating,
    cancellationRate:driver.cancellationRate,
    utilization:     driver.utilization,
    maxJobs:         driver.maxJobs,
    tenureMonths:    driver.tenureMonths,
    revenueCV:       driver.revenueCV,
  });

  return (
    <div style={{ background: "var(--surface-1)", border: `1px solid ${tier.border}`, borderRadius: "var(--radius-lg)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "900px" }}>
      {/* Panel header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexShrink: 0 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px", flexWrap: "wrap" }}>
            <p style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>{driver.driverName}</p>
            <Badge {...tier} label={tier.label} />
          </div>
          <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>{driver.carType} · {driver.vehicleReg} · {driver.phone}</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
          <button onClick={handleExport} disabled={exporting} style={{ background: "var(--surface-2)", border: "1px solid var(--border-hover)", borderRadius: "var(--radius-sm)", padding: "6px 12px", fontSize: "11px", color: exporting ? "var(--text-muted)" : "var(--text-secondary)", cursor: exporting ? "default" : "pointer", fontWeight: 600, letterSpacing: "0.04em", opacity: exporting ? 0.6 : 1 }}>
            {exporting ? "Generating…" : "Export PDF"}
          </button>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "20px", lineHeight: 1, padding: "2px 6px" }}>×</button>
        </div>
      </div>

      <div style={{ padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "18px" }}>

        {/* Trust score + factor breakdown */}
        <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
          <div style={{ flexShrink: 0 }}>
            <p style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "4px" }}>SWYFT Trust Score</p>
            <p style={{ fontSize: "56px", fontWeight: 900, color: tier.color, letterSpacing: "-0.04em", lineHeight: 1 }}>{driver.score}</p>
            <p style={{ fontSize: "12px", color: tier.color, fontWeight: 600, marginTop: "2px" }}>{tier.label}</p>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "7px", paddingTop: "22px" }}>
            {factors.map(f => (
              <div key={f.name} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <p style={{ fontSize: "10px", color: "var(--text-muted)", width: "108px", flexShrink: 0 }}>{f.name}</p>
                <ScoreBar value={f.value} color={tier.color} />
                <p style={{ fontSize: "10px", color: "var(--text-secondary)", width: "52px", textAlign: "right", flexShrink: 0 }}>{f.raw}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue trend */}
        <div>
          <SectionLabel>Revenue Trend — 12 months</SectionLabel>
          <ResponsiveContainer width="100%" height={110}>
            <LineChart data={monthlyTrend} margin={{ top: 4, right: 4, bottom: 0, left: -14 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
              <RechartsTooltip content={<ChartTooltip prefix="KES " />} />
              <Line dataKey="revenue" stroke="var(--accent)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "var(--accent)" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Performance */}
        <div>
          <SectionLabel>Performance</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
            <MiniMetric label="Jobs Completed"  value={fmt(driver.completed)} />
            <MiniMetric label="Jobs Last 30d"   value={fmt(driver.jobs30d)} />
            <MiniMetric label="Completion Rate" value={pct(driver.utilization)} />
            <MiniMetric label="Cancel Rate"     value={pct(driver.cancellationRate)} color={driver.cancellationRate > 0.25 ? "var(--danger)" : undefined} />
            <MiniMetric label="Utilization"     value={pct(driver.utilization)} />
            <MiniMetric label="Avg Rating"      value={driver.avgRating > 0 ? driver.avgRating.toFixed(1) + " ★" : "—"} />
          </div>
        </div>

        {/* Earnings */}
        <div>
          <SectionLabel>Earnings</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            <MiniMetric label="Last 30 Days"     value={fmtKES(driver.rev30d)}   color={driver.revGrowth > 0 ? "#00D46A" : undefined} />
            <MiniMetric label="Last 90 Days"     value={fmtKES(driver.rev90d)} />
            <MiniMetric label="Last 12 Months"   value={fmtKES(driver.rev12m)} />
            <MiniMetric label="Lifetime Revenue" value={fmtKES(driver.revenue)} />
          </div>
          {driver.revGrowth != null && (
            <p style={{ fontSize: "11px", color: driver.revGrowth >= 0 ? "#00D46A" : "var(--danger)", marginTop: "8px", fontWeight: 600 }}>
              {driver.revGrowth >= 0 ? "↑" : "↓"} {Math.abs(driver.revGrowth).toFixed(0)}% revenue growth (last 3m vs prev 3m)
            </p>
          )}
        </div>

        {/* Stability */}
        <div>
          <SectionLabel>Stability</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            <MiniMetric label="Tenure"              value={driver.tenureMonths < 1 ? "< 1 mo" : driver.tenureMonths + " mo"} />
            <MiniMetric label="Active Weeks"        value={fmt(driver.activeWeeks)} />
            <MiniMetric label="Revenue Consistency" value={driver.revenueCV < 0.3 ? "Stable" : driver.revenueCV < 0.6 ? "Moderate" : "Volatile"} color={driver.revenueCV < 0.3 ? "#00D46A" : driver.revenueCV < 0.6 ? "var(--warning)" : "var(--danger)"} />
            <MiniMetric label="Avg Monthly Rev"     value={fmtKES(driver.avgMonthly3m)} />
          </div>
        </div>

        {/* Risk & Financing */}
        <div style={{ background: "var(--surface-2)", borderRadius: "var(--radius-md)", padding: "14px 16px" }}>
          <SectionLabel>Risk &amp; Financing</SectionLabel>
          <div style={{ display: "flex", gap: "20px", marginBottom: "12px" }}>
            <div>
              <p style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "5px" }}>Risk Level</p>
              <Badge {...risk} label={risk.label} />
            </div>
            <div>
              <p style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "5px" }}>Financing Readiness</p>
              <Badge {...rb} label={readiness} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            <MiniMetric label="Recommended Asset Value"   value={fmtKES(assetValue)}  color="var(--accent)" />
            <MiniMetric label="Est. Monthly Repayment"    value={fmtKES(repayment)} />
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Shared table container ────────────────────────────────────────────────────

function TableWrap({ title, count, search, onSearch, children }) {
  return (
    <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid var(--border)", flexWrap: "wrap", gap: "10px" }}>
        <p style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-secondary)" }}>
          {title} <span style={{ color: "var(--text-muted)", fontWeight: 400, letterSpacing: 0, marginLeft: "6px" }}>{count}</span>
        </p>
        <input
          placeholder="Search name or vehicle…"
          value={search}
          onChange={e => onSearch(e.target.value)}
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: "12px", padding: "6px 12px", outline: "none", width: "200px" }}
        />
      </div>
      <div style={{ overflowX: "auto" }}>{children}</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function DriverAnalytics() {
  const [orders,    setOrders]    = useState([]);
  const [drivers,   setDrivers]   = useState([]);
  const [ratings,   setRatings]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [search,    setSearch]    = useState("");
  const [sortBy,    setSortBy]    = useState("score");
  const [sortDir,   setSortDir]   = useState("desc");
  const [selected,  setSelected]  = useState(null);
  const [activeTab,   setActiveTab]   = useState("performance");
  const [pdfLoading,  setPdfLoading]  = useState(null); // null | "single" | "all"

  useEffect(() => {
    async function load() {
      setLoading(true); setError(null);
      const [
        { data: oData, error: oErr },
        { data: dData, error: dErr },
        { data: rData, error: rErr },
      ] = await Promise.all([
        supabase.from("orders").select("id, driver_id, status, commission, created_at"),
        supabase.from("drivers").select("id, name, first_name, last_name, car_type, phone, license_plate, join_date"),
        supabase.from("ratings").select("order_id, rating_score"),
      ]);
      if (oErr || dErr || rErr) { setError((oErr || dErr || rErr).message); setLoading(false); return; }
      setOrders(oData || []); setDrivers(dData || []); setRatings(rData || []);
      setLoading(false);
    }
    load();
  }, []);

  // ── Per-driver profiles ──────────────────────────────────────────────────────

  const profiles = useMemo(() => {
    const driverMap    = Object.fromEntries(drivers.map(d => [d.id, d]));
    const ratingByOrder = Object.fromEntries(ratings.filter(r => r.order_id).map(r => [r.order_id, r.rating_score]));

    const grouped = {};
    orders.forEach(o => {
      if (!o.driver_id) return;
      if (!grouped[o.driver_id]) grouped[o.driver_id] = { orders: [], driver: driverMap[o.driver_id] };
      grouped[o.driver_id].orders.push({ ...o, rating: ratingByOrder[o.id] ?? null });
    });

    const maxJobs = Math.max(...Object.values(grouped).map(g =>
      g.orders.filter(o => /completed/i.test(o.status || "")).length
    ), 1);

    const now = new Date();

    return Object.entries(grouped).map(([driverId, { orders: dOrders, driver }]) => {
      const total     = dOrders.length;
      const completed = dOrders.filter(o => /completed/i.test(o.status || "")).length;
      const cancelled = dOrders.filter(o => /cancelled/i.test(o.status || "")).length;
      const revenue   = dOrders.reduce((s, o) => s + (Number(o.commission) || 0), 0);

      const ratingsArr     = dOrders.map(o => Number(o.rating)).filter(r => r > 0 && !isNaN(r));
      const avgRating      = ratingsArr.length ? ratingsArr.reduce((a, b) => a + b, 0) / ratingsArr.length : 0;
      const cancellationRate = total > 0 ? cancelled / total : 0;
      const utilization    = total > 0 ? completed / total : 0;

      // Time-windowed revenue
      const d30  = new Date(now); d30.setDate(d30.getDate() - 30);
      const d90  = new Date(now); d90.setDate(d90.getDate() - 90);
      const d180 = new Date(now); d180.setDate(d180.getDate() - 180);
      const d365 = new Date(now); d365.setDate(d365.getDate() - 365);
      const comp = dOrders.filter(o => /completed/i.test(o.status || ""));

      const rev30d    = comp.filter(o => new Date(o.created_at) >= d30).reduce((s, o) => s + (Number(o.commission) || 0), 0);
      const rev90d    = comp.filter(o => new Date(o.created_at) >= d90).reduce((s, o) => s + (Number(o.commission) || 0), 0);
      const rev12m    = comp.filter(o => new Date(o.created_at) >= d365).reduce((s, o) => s + (Number(o.commission) || 0), 0);
      const revPrev90 = comp.filter(o => { const od = new Date(o.created_at); return od >= d180 && od < d90; }).reduce((s, o) => s + (Number(o.commission) || 0), 0);
      const avgMonthly3m = rev90d / 3;
      const revGrowth    = revPrev90 > 0 ? ((rev90d - revPrev90) / revPrev90) * 100 : null;
      const jobs30d      = comp.filter(o => new Date(o.created_at) >= d30).length;

      // Tenure
      const dates      = dOrders.map(o => new Date(o.created_at)).filter(d => !isNaN(d));
      const firstOrder = driver?.join_date ? new Date(driver.join_date) : dates.length ? new Date(Math.min(...dates)) : null;
      const tenureMonths = firstOrder ? Math.round((now - firstOrder) / (1000 * 60 * 60 * 24 * 30)) : 0;

      // Active weeks
      const weekSet = new Set();
      dOrders.forEach(o => { const d = new Date(o.created_at); if (!isNaN(d)) weekSet.add(Math.floor(d.getTime() / (7 * 24 * 60 * 60 * 1000))); });
      const activeWeeks = weekSet.size;

      const monthlyTrend = getMonthlyTrend(dOrders);
      const revenueCV    = calcRevenueCV(monthlyTrend);

      const score = computeTrustScore({ completedJobs: completed, avgRating, cancellationRate, utilization, maxJobs, tenureMonths, revenueCV });
      const tier  = scoreTier(score);

      const driverName = driver
        ? (driver.name || `${driver.first_name || ""} ${driver.last_name || ""}`.trim() || `Driver #${driverId}`)
        : `Driver #${driverId}`;

      const readiness  = getFinancingReadiness(score, avgMonthly3m, cancellationRate);
      const assetValue = calcAssetValue(avgMonthly3m);

      return {
        driverId, driverName,
        carType:    driver?.car_type || "—",
        vehicleReg: driver?.license_plate || "—",
        phone:      driver?.phone || "—",
        total, completed, cancelled, revenue,
        avgRating, cancellationRate, utilization,
        rev30d, rev90d, rev12m, revGrowth, avgMonthly3m, jobs30d,
        tenureMonths, activeWeeks, revenueCV, monthlyTrend,
        score, tier, readiness, assetValue, maxJobs,
      };
    });
  }, [orders, drivers, ratings]);

  // ── Summary ──────────────────────────────────────────────────────────────────

  const summary = useMemo(() => {
    if (!profiles.length) return null;
    const eligible = profiles.filter(p => p.readiness === "Eligible");
    return {
      activeDrivers:        profiles.length,
      monthlyRevenue:       profiles.reduce((s, p) => s + p.avgMonthly3m, 0),
      avgUtil:              profiles.reduce((s, p) => s + p.utilization, 0) / profiles.length,
      avgScore:             Math.round(profiles.reduce((s, p) => s + p.score, 0) / profiles.length),
      financeableCount:     eligible.length,
      totalFinancingCap:    eligible.reduce((s, p) => s + p.assetValue, 0),
    };
  }, [profiles]);

  // ── Fleet trend for overview ──────────────────────────────────────────────────

  const fleetTrend = useMemo(() => getMonthlyTrend(orders.filter(o => o.driver_id)), [orders]);

  // ── Distribution data ─────────────────────────────────────────────────────────

  const tierCounts = useMemo(() => {
    const c = { Excellent: 0, Good: 0, Fair: 0, Poor: 0 };
    profiles.forEach(p => c[p.tier.label]++);
    return [
      { name: "Excellent", count: c.Excellent, color: "#00D46A" },
      { name: "Good",      count: c.Good,      color: "#3B82F6" },
      { name: "Fair",      count: c.Fair,      color: "#F59E0B" },
      { name: "Poor",      count: c.Poor,      color: "#EF4444" },
    ];
  }, [profiles]);

  const financingDist = useMemo(() => {
    const c = { Eligible: 0, Monitor: 0, "Not Eligible": 0 };
    profiles.forEach(p => c[p.readiness]++);
    return [
      { name: "Eligible",     count: c.Eligible,       color: "#00D46A" },
      { name: "Monitor",      count: c.Monitor,        color: "#F59E0B" },
      { name: "Not Eligible", count: c["Not Eligible"], color: "#EF4444" },
    ];
  }, [profiles]);

  // ── Sort / filter ─────────────────────────────────────────────────────────────

  const sorted = useMemo(() => {
    const filtered = profiles.filter(p =>
      p.driverName.toLowerCase().includes(search.toLowerCase()) ||
      p.carType.toLowerCase().includes(search.toLowerCase())
    );
    const get = x => {
      if (sortBy === "score")            return x.score;
      if (sortBy === "completed")        return x.completed;
      if (sortBy === "revenue")          return x.revenue;
      if (sortBy === "rating")           return x.avgRating;
      if (sortBy === "cancellationRate") return x.cancellationRate;
      if (sortBy === "utilization")      return x.utilization;
      if (sortBy === "tenure")           return x.tenureMonths;
      if (sortBy === "assetValue")       return x.assetValue;
      if (sortBy === "avgMonthly")       return x.avgMonthly3m;
      return x.score;
    };
    return [...filtered].sort((a, b) => sortDir === "desc" ? get(b) - get(a) : get(a) - get(b));
  }, [profiles, search, sortBy, sortDir]);

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortBy(col); setSortDir("desc"); }
  }

  // ── Style helpers ─────────────────────────────────────────────────────────────

  const thS = col => ({
    padding: "10px 14px", textAlign: "left", fontSize: "10px", fontWeight: 600,
    letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap",
    cursor: "pointer", userSelect: "none",
    color: sortBy === col ? "var(--accent)" : "var(--text-muted)",
  });
  const tdS = { padding: "11px 14px", fontSize: "12px", color: "var(--text-primary)", whiteSpace: "nowrap", verticalAlign: "middle" };

  function sortArrow(col) { return sortBy === col ? (sortDir === "desc" ? " ↓" : " ↑") : ""; }

  function TrustScoreCell({ p }) {
    return (
      <td style={tdS}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "52px", height: "4px", background: "var(--surface-3)", borderRadius: "2px", overflow: "hidden" }}>
            <div style={{ width: `${p.score}%`, height: "100%", background: p.tier.color, borderRadius: "2px" }} />
          </div>
          <span style={{ fontWeight: 800, color: p.tier.color, fontSize: "13px", minWidth: "24px" }}>{p.score}</span>
        </div>
      </td>
    );
  }

  function DriverCell({ p }) {
    const isSel = selected?.driverId === p.driverId;
    return (
      <td style={tdS}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {isSel && <div style={{ width: "3px", height: "28px", background: "var(--accent)", borderRadius: "2px", flexShrink: 0 }} />}
          <div>
            <p style={{ fontWeight: 600 }}>{p.driverName}</p>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>{p.carType}</p>
          </div>
        </div>
      </td>
    );
  }

  function rowProps(p) {
    const isSel = selected?.driverId === p.driverId;
    return {
      key:      p.driverId,
      onClick:  () => setSelected(isSel ? null : p),
      style:    { borderBottom: "1px solid var(--border)", cursor: "pointer", background: isSel ? "rgba(0,212,106,0.04)" : "transparent", transition: "background 100ms" },
      onMouseEnter: e => { if (!isSel) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; },
      onMouseLeave: e => { if (!isSel) e.currentTarget.style.background = isSel ? "rgba(0,212,106,0.04)" : "transparent"; },
    };
  }

  function EmptyRow({ cols }) {
    return (
      <tr><td colSpan={cols} style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
        {profiles.length === 0 ? "No driver order data found." : "No drivers match your search."}
      </td></tr>
    );
  }

  // ── Chart tooltip helpers ─────────────────────────────────────────────────────

  function distTip(active, payload) {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-hover)", borderRadius: "var(--radius-sm)", padding: "8px 12px", fontSize: "12px" }}>
        <p style={{ color: payload[0].payload.color, fontWeight: 600 }}>{payload[0].payload.name}</p>
        <p style={{ color: "var(--text-primary)" }}>{payload[0].value} drivers</p>
      </div>
    );
  }

  // ── Loading / error ───────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px", flexDirection: "column", gap: "12px" }}>
      <div style={{ width: "24px", height: "24px", border: "2px solid var(--border-hover)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "da-spin 0.8s linear infinite" }} />
      <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Loading driver profiles…</span>
      <style>{`@keyframes da-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return (
    <div style={{ background: "var(--danger-dim)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "var(--radius-md)", padding: "16px 20px", fontSize: "13px", color: "var(--danger)" }}>
      <strong>Error loading data:</strong> {error}
    </div>
  );

  // ── Tab definitions ───────────────────────────────────────────────────────────

  const TABS = [
    { id: "performance", label: "Performance" },
    { id: "profiles",    label: "Credit Profiles" },
    { id: "financing",   label: "Financing Readiness" },
    { id: "reports",     label: "Reports" },
  ];

  // ── PERFORMANCE TAB ───────────────────────────────────────────────────────────

  function PerformanceTab() {
    return (
      <>
        {/* 4-chart overview grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px" }}>

          <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "18px 20px" }}>
            <SectionLabel>Fleet Revenue Trend</SectionLabel>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={fleetTrend} margin={{ top: 4, right: 4, bottom: 0, left: -14 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                <RechartsTooltip content={<ChartTooltip prefix="KES " />} />
                <Line dataKey="revenue" stroke="var(--accent)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "var(--accent)" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "18px 20px" }}>
            <SectionLabel>Fleet Utilization Trend</SectionLabel>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={fleetTrend} margin={{ top: 4, right: 4, bottom: 0, left: -14 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={v => v + "%"} />
                <RechartsTooltip content={<ChartTooltip suffix="%" />} />
                <Line dataKey="utilization" stroke="#3B82F6" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#3B82F6" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "18px 20px" }}>
            <SectionLabel>Trust Score Distribution</SectionLabel>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={tierCounts} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <RechartsTooltip content={({ active, payload }) => distTip(active, payload)} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  {tierCounts.map(t => <Cell key={t.name} fill={t.color} fillOpacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "18px 20px" }}>
            <SectionLabel>Financing Readiness Distribution</SectionLabel>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={financingDist} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <RechartsTooltip content={({ active, payload }) => distTip(active, payload)} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  {financingDist.map(t => <Cell key={t.name} fill={t.color} fillOpacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Table + profile panel */}
        <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 420px" : "1fr", gap: "14px", alignItems: "start" }}>
          <TableWrap title="All Drivers" count={sorted.length} search={search} onSearch={setSearch}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ ...thS("name"), cursor: "default" }}>Driver</th>
                  <th style={thS("completed")}        onClick={() => toggleSort("completed")}>Jobs{sortArrow("completed")}</th>
                  <th style={thS("avgMonthly")}        onClick={() => toggleSort("avgMonthly")}>Avg Monthly Rev{sortArrow("avgMonthly")}</th>
                  <th style={thS("rating")}            onClick={() => toggleSort("rating")}>Rating{sortArrow("rating")}</th>
                  <th style={thS("cancellationRate")}  onClick={() => toggleSort("cancellationRate")}>Cancel%{sortArrow("cancellationRate")}</th>
                  <th style={thS("utilization")}       onClick={() => toggleSort("utilization")}>Utilization{sortArrow("utilization")}</th>
                  <th style={thS("score")}             onClick={() => toggleSort("score")}>Trust Score{sortArrow("score")}</th>
                  <th style={{ ...thS("tier"), cursor: "default" }}>Tier</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 && <EmptyRow cols={8} />}
                {sorted.map(p => (
                  <tr {...rowProps(p)}>
                    <DriverCell p={p} />
                    <td style={tdS}>{fmt(p.completed)}</td>
                    <td style={tdS}>KES {fmt(p.avgMonthly3m)}</td>
                    <td style={tdS}>{p.avgRating > 0 ? p.avgRating.toFixed(1) + " ★" : "—"}</td>
                    <td style={{ ...tdS, color: p.cancellationRate > 0.25 ? "var(--danger)" : p.cancellationRate > 0.15 ? "var(--warning)" : "var(--text-primary)" }}>
                      {pct(p.cancellationRate)}
                    </td>
                    <td style={tdS}>{pct(p.utilization)}</td>
                    <TrustScoreCell p={p} />
                    <td style={tdS}><Badge {...p.tier} label={p.tier.label} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>

          {selected && (
            <DriverProfilePanel driver={selected} rawOrders={orders} onClose={() => setSelected(null)} onExportPDF={exportDriverPDF} />
          )}
        </div>
      </>
    );
  }

  // ── CREDIT PROFILES TAB ───────────────────────────────────────────────────────

  function CreditProfilesTab() {
    return (
      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 420px" : "1fr", gap: "14px", alignItems: "start" }}>
        <TableWrap title="Credit Profiles" count={sorted.length} search={search} onSearch={setSearch}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ ...thS("name"), cursor: "default" }}>Driver</th>
                <th style={thS("utilization")}      onClick={() => toggleSort("utilization")}>Utilization{sortArrow("utilization")}</th>
                <th style={thS("cancellationRate")} onClick={() => toggleSort("cancellationRate")}>Cancel%{sortArrow("cancellationRate")}</th>
                <th style={thS("rating")}           onClick={() => toggleSort("rating")}>Rating{sortArrow("rating")}</th>
                <th style={thS("tenure")}           onClick={() => toggleSort("tenure")}>Tenure{sortArrow("tenure")}</th>
                <th style={thS("revenue")}          onClick={() => toggleSort("revenue")}>Lifetime Rev{sortArrow("revenue")}</th>
                <th style={thS("score")}            onClick={() => toggleSort("score")}>Trust Score{sortArrow("score")}</th>
                <th style={{ ...thS("tier"), cursor: "default" }}>Tier</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && <EmptyRow cols={8} />}
              {sorted.map(p => (
                <tr {...rowProps(p)}>
                  <DriverCell p={p} />
                  <td style={tdS}>{pct(p.utilization)}</td>
                  <td style={{ ...tdS, color: p.cancellationRate > 0.25 ? "var(--danger)" : p.cancellationRate > 0.15 ? "var(--warning)" : "var(--text-primary)" }}>
                    {pct(p.cancellationRate)}
                  </td>
                  <td style={tdS}>{p.avgRating > 0 ? p.avgRating.toFixed(1) + " ★" : "—"}</td>
                  <td style={tdS}>{p.tenureMonths < 1 ? "< 1 mo" : p.tenureMonths + " mo"}</td>
                  <td style={tdS}>KES {fmt(p.revenue)}</td>
                  <TrustScoreCell p={p} />
                  <td style={tdS}><Badge {...p.tier} label={p.tier.label} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>

        {selected && (
          <DriverProfilePanel driver={selected} rawOrders={orders} onClose={() => setSelected(null)} onExportPDF={exportDriverPDF} />
        )}
      </div>
    );
  }

  // ── FINANCING READINESS TAB ───────────────────────────────────────────────────

  function FinancingReadinessTab() {
    return (
      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 420px" : "1fr", gap: "14px", alignItems: "start" }}>
        <TableWrap title="Financing Readiness" count={`${sorted.length} drivers`} search={search} onSearch={setSearch}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ ...thS("name"), cursor: "default" }}>Driver</th>
                <th style={thS("score")}           onClick={() => toggleSort("score")}>Trust Score{sortArrow("score")}</th>
                <th style={thS("avgMonthly")}      onClick={() => toggleSort("avgMonthly")}>Avg Revenue{sortArrow("avgMonthly")}</th>
                <th style={thS("utilization")}     onClick={() => toggleSort("utilization")}>Utilization{sortArrow("utilization")}</th>
                <th style={thS("tenure")}          onClick={() => toggleSort("tenure")}>Tenure{sortArrow("tenure")}</th>
                <th style={{ ...thS("risk"), cursor: "default" }}>Risk</th>
                <th style={{ ...thS("readiness"), cursor: "default" }}>Status</th>
                <th style={thS("assetValue")}      onClick={() => toggleSort("assetValue")}>Asset Value{sortArrow("assetValue")}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && <EmptyRow cols={8} />}
              {sorted.map(p => {
                const risk = getRiskLevel(p.score);
                const rb   = getFinancingBadge(p.readiness);
                return (
                  <tr {...rowProps(p)}>
                    <DriverCell p={p} />
                    <TrustScoreCell p={p} />
                    <td style={tdS}>KES {fmt(p.avgMonthly3m)}</td>
                    <td style={tdS}>{pct(p.utilization)}</td>
                    <td style={tdS}>{p.tenureMonths < 1 ? "< 1 mo" : p.tenureMonths + " mo"}</td>
                    <td style={tdS}><Badge {...risk} label={risk.label} /></td>
                    <td style={tdS}><Badge {...rb} label={p.readiness} /></td>
                    <td style={{ ...tdS, fontWeight: 700, color: p.readiness === "Eligible" ? "var(--accent)" : p.readiness === "Monitor" ? "var(--warning)" : "var(--text-muted)" }}>
                      {p.readiness !== "Not Eligible" ? `KES ${fmt(p.assetValue)}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>

        {selected && (
          <DriverProfilePanel driver={selected} rawOrders={orders} onClose={() => setSelected(null)} onExportPDF={exportDriverPDF} />
        )}
      </div>
    );
  }

  // ── REPORTS TAB ───────────────────────────────────────────────────────────────

  function ReportsTab() {
    const eligible  = profiles.filter(p => p.readiness === "Eligible").sort((a, b) => b.score - a.score);
    const isAllBusy = pdfLoading === "all";

    async function handleExportAll() {
      setPdfLoading("all");
      try { await exportAllDriversPDF(profiles); } finally { setPdfLoading(null); }
    }

    async function handleExportOne(driver) {
      setPdfLoading(driver.driverId);
      try { await exportDriverPDF(driver); } finally { setPdfLoading(null); }
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* PDF info card */}
        <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "12px" }}>
            <SectionLabel>Lender PDF Reports</SectionLabel>
            <button
              onClick={handleExportAll}
              disabled={pdfLoading !== null}
              style={{ flexShrink: 0, background: isAllBusy ? "var(--accent-dim)" : "var(--accent)", border: "none", borderRadius: "var(--radius-sm)", padding: "8px 16px", fontSize: "12px", color: isAllBusy ? "var(--accent)" : "#000", cursor: pdfLoading !== null ? "default" : "pointer", fontWeight: 700, letterSpacing: "0.04em", opacity: pdfLoading !== null && !isAllBusy ? 0.5 : 1 }}
            >
              {isAllBusy ? "Generating PDF…" : "Export All Drivers PDF"}
            </button>
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-primary)", marginBottom: "16px" }}>
            Export a lender-ready driver credit profile. Designed for direct sharing with banks, EV financiers, and asset lenders. Use <strong style={{ color: "var(--accent)" }}>Export All Drivers PDF</strong> to generate a single fleet report with a cover page and one profile per driver.
          </p>
          <div style={{ background: "var(--surface-2)", borderRadius: "var(--radius-md)", padding: "14px 16px", marginBottom: "16px", fontSize: "12px", color: "var(--text-secondary)" }}>
            <p style={{ fontWeight: 600, marginBottom: "8px", color: "var(--text-primary)", fontSize: "11px", letterSpacing: "0.04em", textTransform: "uppercase" }}>PDF Includes</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px" }}>
              {[
                "Driver Summary & Basic Information",
                "SWYFT Trust Score with Tier",
                "Revenue History (30d / 90d / 12m / Lifetime)",
                "Performance Metrics",
                "Stability Metrics",
                "Financing Readiness Status",
                "Risk Assessment & Underwriting Notes",
                "Recommended Asset Value",
              ].map(item => (
                <p key={item} style={{ fontSize: "11px", color: "var(--text-secondary)" }}>· {item}</p>
              ))}
            </div>
          </div>
        </div>

        {/* Eligible drivers */}
        <div style={{ background: "rgba(0,212,106,0.04)", border: "1px solid rgba(0,212,106,0.2)", borderRadius: "var(--radius-lg)", padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#00D46A" }}>
              Finance-Eligible Drivers — {eligible.length}
            </p>
            <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              Total capacity: KES {fmt(eligible.reduce((s, p) => s + p.assetValue, 0))}
            </p>
          </div>
          {eligible.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>No eligible drivers yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {eligible.map(p => (
                <div key={p.driverId} style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: "13px" }}>{p.driverName}</p>
                    <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                      {p.carType} · Trust Score: <span style={{ color: p.tier.color, fontWeight: 700 }}>{p.score}</span> · Avg Monthly: KES {fmt(p.avgMonthly3m)}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--accent)" }}>KES {fmt(p.assetValue)}</p>
                      <p style={{ fontSize: "10px", color: "var(--text-muted)" }}>recommended asset</p>
                    </div>
                    <button onClick={() => handleExportOne(p)} disabled={pdfLoading !== null} style={{ background: "var(--accent-dim)", border: "1px solid var(--accent-border)", borderRadius: "var(--radius-sm)", padding: "7px 14px", fontSize: "11px", color: "var(--accent)", cursor: pdfLoading !== null ? "default" : "pointer", fontWeight: 700, letterSpacing: "0.04em", opacity: pdfLoading === p.driverId ? 0.6 : 1 }}>
                      {pdfLoading === p.driverId ? "Generating…" : "Export PDF"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* All drivers export list */}
        <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
            <p style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-secondary)" }}>
              All Drivers — {profiles.length}
            </p>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ ...thS("name"), cursor: "default" }}>Driver</th>
                  <th style={{ ...thS("score"), cursor: "default" }}>Trust Score</th>
                  <th style={{ ...thS("readiness"), cursor: "default" }}>Status</th>
                  <th style={{ ...thS("assetValue"), cursor: "default" }}>Asset Value</th>
                  <th style={{ padding: "10px 14px" }} />
                </tr>
              </thead>
              <tbody>
                {[...profiles].sort((a, b) => b.score - a.score).map(p => {
                  const rb = getFinancingBadge(p.readiness);
                  return (
                    <tr key={p.driverId} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={tdS}>
                        <p style={{ fontWeight: 600 }}>{p.driverName}</p>
                        <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>{p.carType}</p>
                      </td>
                      <td style={tdS}>
                        <span style={{ fontWeight: 800, color: p.tier.color, fontSize: "14px" }}>{p.score}</span>
                        <span style={{ fontSize: "10px", color: "var(--text-muted)", marginLeft: "6px" }}>{p.tier.label}</span>
                      </td>
                      <td style={tdS}><Badge {...rb} label={p.readiness} /></td>
                      <td style={{ ...tdS, fontWeight: 700, color: p.readiness === "Eligible" ? "var(--accent)" : p.readiness === "Monitor" ? "var(--warning)" : "var(--text-muted)" }}>
                        {p.readiness !== "Not Eligible" ? `KES ${fmt(p.assetValue)}` : "—"}
                      </td>
                      <td style={{ ...tdS, textAlign: "right" }}>
                        <button onClick={() => handleExportOne(p)} disabled={pdfLoading !== null} style={{ background: "var(--surface-2)", border: "1px solid var(--border-hover)", borderRadius: "var(--radius-sm)", padding: "5px 12px", fontSize: "11px", color: "var(--text-secondary)", cursor: pdfLoading !== null ? "default" : "pointer", fontWeight: 600, opacity: pdfLoading === p.driverId ? 0.6 : 1 }}>
                          {pdfLoading === p.driverId ? "Generating…" : "Export PDF"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <style>{`@keyframes da-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>Driver Analytics</h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "3px" }}>
            Operational monitoring · Financing readiness · Underwriting intelligence
          </p>
        </div>
        <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "6px 14px", fontSize: "12px", color: "var(--text-secondary)" }}>
          {profiles.length} drivers · {orders.length.toLocaleString()} orders
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))", gap: "12px" }}>
          <StatCard title="Active Drivers"           value={fmt(summary.activeDrivers)}                                sub="on platform" />
          <StatCard title="Monthly Driver Revenue"   value={`KES ${fmt(summary.monthlyRevenue)}`}                    sub="avg last 3 months" accent="var(--accent)" />
          <StatCard title="Avg Utilization"          value={pct(summary.avgUtil)}                                    sub="completed / total" />
          <StatCard title="Financeable Drivers"      value={`${summary.financeableCount} / ${summary.activeDrivers}`} sub="eligible for financing" accent="#00D46A" highlight />
          <StatCard title="Avg Trust Score"          value={summary.avgScore}                                         sub={scoreTier(summary.avgScore).label} accent={scoreTier(summary.avgScore).color} />
          <StatCard title="Total Financing Capacity" value={`KES ${fmt(summary.totalFinancingCap)}`}                 sub="eligible drivers" accent="var(--accent)" />
        </div>
      )}

      {/* Tab nav */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSelected(null); }}
            style={{
              background:   "transparent",
              border:       "none",
              borderBottom: `2px solid ${activeTab === tab.id ? "var(--accent)" : "transparent"}`,
              padding:      "10px 18px",
              fontSize:     "12px",
              fontWeight:   600,
              color:        activeTab === tab.id ? "var(--accent)" : "var(--text-secondary)",
              cursor:       "pointer",
              letterSpacing:"0.02em",
              marginBottom: "-1px",
              transition:   "color 120ms, border-color 120ms",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "performance" && <PerformanceTab />}
      {activeTab === "profiles"    && <CreditProfilesTab />}
      {activeTab === "financing"   && <FinancingReadinessTab />}
      {activeTab === "reports"     && <ReportsTab />}

      <p style={{ fontSize: "10px", color: "var(--text-muted)", textAlign: "center" }}>
        SWYFT Trust Score (0–100) = Completion rate 20% · Utilization 20% · Customer rating 20% · Tenure 15% · Job volume 15% · Revenue consistency 10%
      </p>
    </div>
  );
}

export default DriverAnalytics;
