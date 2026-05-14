import React from "react";

const styles = {
  primary: {
    background: "var(--accent)",
    color: "#07080D",
    border: "1px solid var(--accent)",
    fontWeight: 600,
  },
  danger: {
    background: "var(--danger-dim)",
    color: "var(--danger)",
    border: "1px solid rgba(239,68,68,0.3)",
    fontWeight: 600,
  },
  secondary: {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "1px solid var(--border-hover)",
    fontWeight: 500,
  },
  ghost: {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "none",
    fontWeight: 500,
  },
};

function Button({ onClick, children, variant = "primary", disabled = false, type = "button" }) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 16px",
    borderRadius: "var(--radius-sm)",
    fontSize: "13px",
    letterSpacing: "0.02em",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 150ms ease",
    opacity: disabled ? 0.5 : 1,
    outline: "none",
    whiteSpace: "nowrap",
    ...styles[variant],
  };

  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      style={base}
      onMouseEnter={(e) => {
        if (disabled) return;
        if (variant === "primary") {
          e.currentTarget.style.filter = "brightness(1.1)";
          e.currentTarget.style.boxShadow = "0 0 16px rgba(0,212,106,0.3)";
        } else if (variant === "danger") {
          e.currentTarget.style.background = "rgba(239,68,68,0.14)";
        } else {
          e.currentTarget.style.background = "var(--surface-2)";
          e.currentTarget.style.color = "var(--text-primary)";
        }
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.filter = "";
        e.currentTarget.style.boxShadow = "";
        e.currentTarget.style.background = styles[variant].background;
        e.currentTarget.style.color = styles[variant].color;
      }}
    >
      {children}
    </button>
  );
}

export default Button;
