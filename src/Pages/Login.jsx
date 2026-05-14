import React, { useState } from "react";
import { supabase } from "../supabaseClient";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleForgotPassword = async () => {
    if (!email) {
      setErrorMsg("Enter your email above first.");
      return;
    }
    setResetLoading(true);
    setErrorMsg("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetLoading(false);
    if (error) {
      setErrorMsg(error.message);
    } else {
      setResetSent(true);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMsg("Please fill in both fields.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setErrorMsg(error.message);
    } else if (data.user) {
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("data", JSON.stringify(data.session));
      window.location.href = "/";
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        padding: "24px",
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "fixed",
          top: "20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "600px",
          height: "400px",
          background: "radial-gradient(ellipse, rgba(0,212,106,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div
        style={{
          width: "100%",
          maxWidth: "380px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "36px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              background: "var(--accent)",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="#07080D" />
            </svg>
          </div>
          <span
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.02em",
            }}
          >
            Swyft
          </span>
        </div>

        {/* Card */}
        <div
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-xl)",
            padding: "32px",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <h2
            style={{
              fontSize: "18px",
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: "6px",
              letterSpacing: "-0.01em",
            }}
          >
            Admin sign in
          </h2>
          <p
            style={{
              fontSize: "13px",
              color: "var(--text-secondary)",
              marginBottom: "24px",
            }}
          >
            Swyft logistics management platform
          </p>

          {errorMsg && (
            <div
              style={{
                background: "var(--danger-dim)",
                border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 12px",
                marginBottom: "16px",
                fontSize: "13px",
                color: "var(--danger)",
              }}
            >
              {errorMsg}
            </div>
          )}

          {resetSent && (
            <div
              style={{
                background: "var(--accent-dim)",
                border: "1px solid var(--accent-border)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 12px",
                marginBottom: "16px",
                fontSize: "13px",
                color: "var(--accent)",
              }}
            >
              Reset email sent — check your inbox.
            </div>
          )}

          <div style={{ marginBottom: "12px" }}>
            <label
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: 500,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-secondary)",
                marginBottom: "6px",
              }}
            >
              Email
            </label>
            <input
              type="email"
              placeholder="admin@swyft.co"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-primary)",
                fontSize: "14px",
                outline: "none",
                transition: "border-color 150ms ease",
              }}
              onFocus={(e) => { e.target.style.borderColor = "var(--accent-border)"; }}
              onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: 500,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-secondary)",
                marginBottom: "6px",
              }}
            >
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-primary)",
                fontSize: "14px",
                outline: "none",
                transition: "border-color 150ms ease",
              }}
              onFocus={(e) => { e.target.style.borderColor = "var(--accent-border)"; }}
              onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: "100%",
              padding: "11px",
              background: loading ? "rgba(0,212,106,0.5)" : "var(--accent)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              color: "#07080D",
              fontSize: "14px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 150ms ease",
              letterSpacing: "0.01em",
            }}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.filter = "brightness(1.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = "";
            }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <div style={{ marginTop: "16px", textAlign: "center" }}>
            <button
              onClick={handleForgotPassword}
              disabled={resetLoading}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-secondary)",
                fontSize: "12px",
                cursor: resetLoading ? "not-allowed" : "pointer",
                textDecoration: "underline",
                textUnderlineOffset: "3px",
                transition: "color 150ms ease",
                opacity: resetLoading ? 0.5 : 1,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
            >
              {resetLoading ? "Sending..." : "Forgot password?"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
