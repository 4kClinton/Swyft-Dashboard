import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import CampaignIcon from "@mui/icons-material/Campaign";
import InsightsIcon from "@mui/icons-material/Insights";
import BarChartIcon from "@mui/icons-material/BarChart";
import BuildIcon from "@mui/icons-material/Build";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CloseIcon from "@mui/icons-material/Close";

const navItems = [
  { name: "Overview", path: "/", icon: <DashboardIcon fontSize="small" /> },
  {
    name: "Users",
    icon: <PeopleIcon fontSize="small" />,
    subItems: [
      { name: "Customers", path: "/customers" },
      { name: "Drivers", path: "/drivers" },
      { name: "Unverified KYC", path: "/driver-kyc" },
      { name: "Scouts Verification", path: "/scouts-verification" },
    ],
  },
  {
    name: "Finances",
    icon: <AccountBalanceWalletIcon fontSize="small" />,
    subItems: [
      { name: "Commissions", path: "/commissions" },
      { name: "Analytics", path: "/sales" },
      { name: "Pricing", path: "/pricing" },
    ],
  },
  {
    name: "Marketing",
    icon: <CampaignIcon fontSize="small" />,
    subItems: [
      { name: "Campaigns", path: "/marketing" },
      { name: "Insights", path: "/insights" },
    ],
  },
  {
    name: "Analytics",
    icon: <BarChartIcon fontSize="small" />,
    subItems: [
      { name: "Native Analytics", path: "/native-analytics" },
      { name: "Reels Analytics", path: "/reels-analytics" },
      { name: "Driver Credit Profiles", path: "/driver-analytics" },
    ],
  },
  {
    name: "Operations",
    icon: <InsightsIcon fontSize="small" />,
    subItems: [
      { name: "Affiliates", path: "/affiliates" },
      { name: "Fraud", path: "/fraud" },
    ],
  },
  { name: "Tech", path: "/tech-management", icon: <BuildIcon fontSize="small" /> },
  { name: "Super Admin", path: "/settings", icon: <AdminPanelSettingsIcon fontSize="small" /> },
];

function Sidebar({ isOpen, isMobile, onClose }) {
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState(() => {
    const initial = {};
    navItems.forEach((item) => {
      if (item.subItems?.some((sub) => location.pathname === sub.path)) {
        initial[item.name] = true;
      }
    });
    return initial;
  });

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobile) {
      document.body.style.overflow = isOpen ? "hidden" : "";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isMobile, isOpen]);

  const toggleGroup = (name) => {
    setOpenGroups((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const handleNavClick = () => {
    if (isMobile) onClose();
  };

  return (
    <div
      style={{
        width: "220px",
        minWidth: "220px",
        height: "100vh",
        background: "var(--surface-1)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        overflowX: "hidden",
        flexShrink: 0,
        // Mobile: fixed overlay drawer
        ...(isMobile && {
          position: "fixed",
          left: 0,
          top: 0,
          zIndex: 50,
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 280ms cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: isOpen ? "var(--shadow-lg)" : "none",
        }),
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "20px 16px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "28px",
              height: "28px",
              background: "var(--accent)",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="#07080D" strokeWidth="0" />
            </svg>
          </div>
          <span
            style={{
              fontSize: "15px",
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.01em",
            }}
          >
            Swyft
          </span>
          <span
            style={{
              fontSize: "10px",
              fontWeight: 500,
              color: "var(--text-secondary)",
              background: "var(--surface-3)",
              border: "1px solid var(--border-hover)",
              borderRadius: "4px",
              padding: "1px 5px",
              letterSpacing: "0.04em",
              marginLeft: "2px",
            }}
          >
            Admin
          </span>
        </div>

        {/* Close button — mobile only */}
        {isMobile && (
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-secondary)",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "var(--radius-xs)",
            }}
          >
            <CloseIcon fontSize="small" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ padding: "12px 8px", flex: 1 }}>
        {navItems.map((item) => {
          if (item.subItems) {
            const isGroupOpen = openGroups[item.name];
            const hasActive = item.subItems.some((sub) => location.pathname === sub.path);

            return (
              <div key={item.name} style={{ marginBottom: "2px" }}>
                <button
                  onClick={() => toggleGroup(item.name)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "7px 10px",
                    borderRadius: "var(--radius-sm)",
                    background: hasActive ? "var(--accent-dim)" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: hasActive ? "var(--accent)" : "var(--text-secondary)",
                    fontSize: "13px",
                    fontWeight: 500,
                    textAlign: "left",
                    transition: "all 150ms ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!hasActive) {
                      e.currentTarget.style.background = "var(--surface-2)";
                      e.currentTarget.style.color = "var(--text-primary)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!hasActive) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--text-secondary)";
                    }
                  }}
                >
                  <span style={{ flexShrink: 0, display: "flex" }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.name}</span>
                  <ExpandMoreIcon
                    fontSize="small"
                    style={{
                      transform: isGroupOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 200ms ease",
                      opacity: 0.5,
                    }}
                  />
                </button>

                {isGroupOpen && (
                  <ul style={{ margin: "2px 0 4px 36px", padding: 0, listStyle: "none" }}>
                    {item.subItems.map((sub) => (
                      <li key={sub.name}>
                        <NavLink
                          to={sub.path}
                          onClick={handleNavClick}
                          style={({ isActive }) => ({
                            display: "block",
                            padding: "6px 10px",
                            borderRadius: "var(--radius-sm)",
                            fontSize: "12px",
                            fontWeight: isActive ? 600 : 400,
                            color: isActive ? "var(--accent)" : "var(--text-secondary)",
                            background: isActive ? "var(--accent-dim)" : "transparent",
                            textDecoration: "none",
                            transition: "all 150ms ease",
                            marginBottom: "1px",
                          })}
                          onMouseEnter={(e) => {
                            const isActive = e.currentTarget.style.color === "var(--accent)";
                            if (!isActive) {
                              e.currentTarget.style.background = "var(--surface-2)";
                              e.currentTarget.style.color = "var(--text-primary)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            const isActive = location.pathname === sub.path;
                            e.currentTarget.style.background = isActive ? "var(--accent-dim)" : "transparent";
                            e.currentTarget.style.color = isActive ? "var(--accent)" : "var(--text-secondary)";
                          }}
                        >
                          {sub.name}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          }

          return (
            <div key={item.name} style={{ marginBottom: "2px" }}>
              <NavLink
                to={item.path}
                onClick={handleNavClick}
                style={({ isActive }) => ({
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "7px 10px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "13px",
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "var(--accent)" : "var(--text-secondary)",
                  background: isActive ? "var(--accent-dim)" : "transparent",
                  textDecoration: "none",
                  transition: "all 150ms ease",
                })}
                onMouseEnter={(e) => {
                  const isActive = location.pathname === item.path;
                  if (!isActive) {
                    e.currentTarget.style.background = "var(--surface-2)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }
                }}
                onMouseLeave={(e) => {
                  const isActive = location.pathname === item.path;
                  e.currentTarget.style.background = isActive ? "var(--accent-dim)" : "transparent";
                  e.currentTarget.style.color = isActive ? "var(--accent)" : "var(--text-secondary)";
                }}
              >
                <span style={{ flexShrink: 0, display: "flex" }}>{item.icon}</span>
                <span>{item.name}</span>
              </NavLink>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <p
          style={{
            fontSize: "10px",
            color: "var(--text-muted)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Swyft Logistics · Admin
        </p>
      </div>
    </div>
  );
}

export default Sidebar;
