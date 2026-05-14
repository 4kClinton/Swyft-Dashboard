import React, { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";

const routeLabels = {
  "/": "Overview",
  "/drivers": "Drivers",
  "/customers": "Customers",
  "/driver-kyc": "Driver KYC",
  "/commissions": "Commissions",
  "/sales": "Analytics",
  "/marketing": "Marketing",
  "/settings": "Super Admin",
};

function Navbar({ onMenuClick, isMobile }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const pageTitle = routeLabels[location.pathname] ?? "Dashboard";

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("data");
    navigate("/login");
  };

  useEffect(() => {
    const handle = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div
      style={{
        height: "56px",
        background: "var(--surface-1)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        flexShrink: 0,
        zIndex: 10,
        gap: "12px",
      }}
    >
      {/* Left: hamburger (mobile) + page title */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
        {isMobile && (
          <button
            onClick={onMenuClick}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-primary)",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "var(--radius-xs)",
              flexShrink: 0,
            }}
            aria-label="Open navigation"
          >
            <MenuIcon />
          </button>
        )}

        <h1
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--text-primary)",
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {pageTitle}
        </h1>
      </div>

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
        {/* Status indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "var(--accent)",
              boxShadow: "0 0 6px var(--accent)",
            }}
          />
          {!isMobile && (
            <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>
              Live
            </span>
          )}
        </div>

        {/* User menu */}
        <div ref={menuRef} style={{ position: "relative" }}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: menuOpen ? "var(--surface-3)" : "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "5px 10px",
              cursor: "pointer",
              color: "var(--text-primary)",
              fontSize: "13px",
              fontWeight: 500,
              transition: "all 150ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--surface-3)";
              e.currentTarget.style.borderColor = "var(--border-hover)";
            }}
            onMouseLeave={(e) => {
              if (!menuOpen) {
                e.currentTarget.style.background = "var(--surface-2)";
                e.currentTarget.style.borderColor = "var(--border)";
              }
            }}
          >
            <AccountCircleIcon fontSize="small" style={{ color: "var(--text-secondary)" }} />
            {!isMobile && <span>Admin</span>}
          </button>

          {menuOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                background: "var(--surface-2)",
                border: "1px solid var(--border-hover)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow-md)",
                minWidth: "160px",
                overflow: "hidden",
                zIndex: 100,
              }}
            >
              <button
                onClick={handleLogout}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 14px",
                  background: "transparent",
                  border: "none",
                  color: "var(--danger)",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 150ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--danger-dim)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <LogoutIcon fontSize="small" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Navbar;
