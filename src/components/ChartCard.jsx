import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: "var(--surface-3)",
          border: "1px solid var(--border-hover)",
          borderRadius: "var(--radius-sm)",
          padding: "8px 12px",
          fontSize: "12px",
          color: "var(--text-primary)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <p style={{ color: "var(--text-secondary)", marginBottom: "2px" }}>{label}</p>
        <p style={{ fontWeight: 600, color: "var(--accent)" }}>
          {payload[0].value?.toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

function ChartCard({ title, value, data, dataKey, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "20px 24px",
        cursor: onClick ? "pointer" : "default",
        transition: "border-color 200ms ease",
      }}
      onMouseEnter={(e) => {
        if (!onClick) return;
        e.currentTarget.style.borderColor = "var(--border-hover)";
      }}
      onMouseLeave={(e) => {
        if (!onClick) return;
        e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
        <div>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 500,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-secondary)",
              marginBottom: "4px",
            }}
          >
            {title}
          </p>
          {value !== undefined && (
            <p
              style={{
                fontSize: "28px",
                fontWeight: 700,
                color: "var(--accent)",
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              {value?.toLocaleString?.() ?? value}
            </p>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            stroke="var(--text-muted)"
            tick={{ fill: "var(--text-secondary)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            stroke="var(--text-muted)"
            tick={{ fill: "var(--text-secondary)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--border-hover)" }} />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke="var(--accent)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "var(--accent)", strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ChartCard;
