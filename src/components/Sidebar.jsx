// src/components/Sidebar.jsx
import React from "react";
import { NavLink } from "react-router-dom";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import BarChartIcon from "@mui/icons-material/BarChart";
import PaidIcon from "@mui/icons-material/Paid";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import CampaignIcon from "@mui/icons-material/Campaign"; // Added for Marketing

const navItems = [
  { name: "Overview", path: "/", icon: <DashboardIcon /> },
  { name: "User & Driver Management", path: "/drivers", icon: <PeopleIcon /> },
  { name: "Analytics", path: "/sales", icon: <BarChartIcon /> },
  { name: "Commissions", path: "/commissions", icon: <PaidIcon /> },
  { name: "Marketing", path: "/marketing", icon: <CampaignIcon /> },
  { name: "Super Admin", path: "/settings", icon: <AdminPanelSettingsIcon /> }
];

function Sidebar() {
  return (
    <div className="w-64 bg-gray-800 p-4">
      <h2 className="text-2xl font-bold mb-6 text-center">Menu</h2>
      <ul>
        {navItems.map((item) => (
          <li key={item.name} className="mb-4">
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                `flex items-center p-2 rounded hover:bg-gray-700 transition-colors ${
                  isActive ? "bg-gray-700" : ""
                }`
              }
            >
              <span className="mr-3">{item.icon}</span>
              <span>{item.name}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Sidebar;
