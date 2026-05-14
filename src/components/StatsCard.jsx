import React from "react";

function StatsCard({ title, value, onClick, icon, trend }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "20px 24px",
        cursor: onClick ? "pointer" : "default",
        transition: "all 200ms ease",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        if (!onClick) return;
        e.currentTarget.style.borderColor = "var(--accent-border)";
        e.currentTarget.style.background = "var(--surface-2)";
      }}
      onMouseLeave={(e) => {
        if (!onClick) return;
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.background = "var(--surface-1)";
      }}
    >
      {/* Subtle accent glow top-right */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "80px",
          height: "80px",
          background: "radial-gradient(circle at top right, var(--accent-dim), transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <p
        style={{
          fontSize: "11px",
          fontWeight: 500,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
          marginBottom: "10px",
        }}
      >
        {title}
      </p>

      <p
        style={{
          fontSize: "32px",
          fontWeight: 700,
          color: "var(--text-primary)",
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        {value ?? "—"}
      </p>

      {trend && (
        <p
          style={{
            marginTop: "8px",
            fontSize: "12px",
            color: trend > 0 ? "var(--accent)" : "var(--danger)",
            fontWeight: 500,
          }}
        >
          {trend > 0 ? "+" : ""}{trend}% this week
        </p>
      )}
    </div>
  );
}

export default StatsCard;
