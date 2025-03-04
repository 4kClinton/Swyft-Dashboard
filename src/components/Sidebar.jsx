import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import BarChartIcon from "@mui/icons-material/BarChart";
import PaidIcon from "@mui/icons-material/Paid";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import CampaignIcon from "@mui/icons-material/Campaign";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import InsightsIcon from "@mui/icons-material/Insights";
import BuildIcon from "@mui/icons-material/Build"; // For Tech Management

const navItems = [
  { name: "Overview", path: "/", icon: <DashboardIcon /> },
  {
    name: "Users",
    icon: <PeopleIcon />,
    subItems: [
      { name: "Customers", path: "/customers" },
      { name: "Drivers", path: "/drivers" },
      { name: "Driver KYC", path: "/driver-kyc" }
    ]
  },
  {
    name: "Finances",
    icon: <AccountBalanceWalletIcon />,
    subItems: [
      
      { name: "Commissions", path: "/commissions" },
      { name: "Analytics", path: "/sales" }
    ]
  },
  {
    name: "Marketing",
    icon: <CampaignIcon />,
    subItems: [
      { name: "Marketing", path: "/marketing" },
      { name: "Insights", path: "/insights" }
    ]
  },
  {
    name: "Operations",
    icon: <InsightsIcon />,
    subItems: [
      { name: "Affiliates", path: "/affiliates" },
      { name: "Fraud", path: "/fraud" }
    ]
  },
  { name: "Tech Management", path: "/tech-management", icon: <BuildIcon /> },
  { name: "Super Admin", path: "/settings", icon: <AdminPanelSettingsIcon /> }
];

function Sidebar() {
  const [openDropdown, setOpenDropdown] = useState({});

  const toggleDropdown = (name) => {
    setOpenDropdown((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <div className="w-64 bg-gray-800 p-4">
      <h2 className="text-2xl font-bold mb-6 text-center">Menu</h2>
      <ul>
        {navItems.map((item) => {
          if (item.subItems) {
            return (
              <li key={item.name} className="mb-4">
                <div
                  onClick={() => toggleDropdown(item.name)}
                  className="flex items-center p-2 rounded hover:bg-gray-700 transition-colors cursor-pointer"
                >
                  <span className="mr-3">{item.icon}</span>
                  <span>{item.name}</span>
                  <span className="ml-auto">
                    {openDropdown[item.name] ? "-" : "+"}
                  </span>
                </div>
                {openDropdown[item.name] && (
                  <ul className="ml-6 mt-2">
                    {item.subItems.map((subItem) => (
                      <li key={subItem.name} className="mb-2">
                        <NavLink
                          to={subItem.path}
                          className={({ isActive }) =>
                            `block p-2 rounded hover:bg-gray-700 transition-colors ${
                              isActive ? "bg-gray-700" : ""
                            }`
                          }
                        >
                          {subItem.name}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          } else {
            return (
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
            );
          }
        })}
      </ul>
    </div>
  );
}

export default Sidebar;
