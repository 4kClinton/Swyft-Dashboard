// src/pages/SuperAdminCockpit.jsx
import React, { useState, useEffect } from "react";
import Button from "../components/Button";

function SuperAdminCockpit() {
  const [loginActivity, setLoginActivity] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch login activity from db.json
        const loginRes = await fetch("http://localhost:3001/login_activity");
        const loginData = await loginRes.json();
        setLoginActivity(loginData);

        // Fetch admin data from db.json
        const adminRes = await fetch("http://localhost:3001/admins");
        const adminData = await adminRes.json();
        setAdmins(adminData);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Super Admin Cockpit</h1>

      {/* KPIs Section */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Key Performance Indexes (KPIs)</h2>
        <ul className="list-disc pl-5">
          <li>Total Revenue (from commissions)</li>
          <li>Total Orders Received</li>
          <li>Average Order Value</li>
          <li>Cancelled Orders</li>
          <li>Active Drivers</li>
          <li>New User Signups</li>
          <li>Operational Efficiency (e.g., Avg. Delivery Time)</li>
        </ul>
      </div>

      {/* Login Activity Section */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Login Activity</h2>
        {loading ? (
          <p>Loading login activity...</p>
        ) : loginActivity && loginActivity.length > 0 ? (
          <ul>
            {loginActivity.map((entry) => (
              <li key={entry.id}>
                User <strong>{entry.user_id}</strong> logged in at{" "}
                {new Date(entry.created_at).toLocaleString()}
              </li>
            ))}
          </ul>
        ) : (
          <p>No login activity recorded.</p>
        )}
      </div>

      {/* Admin Management Section */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Admin Management</h2>
        <Button>Create New Admin</Button>
        <div className="mt-4">
          {loading ? (
            <p>Loading admin data...</p>
          ) : admins && admins.length > 0 ? (
            <ul>
              {admins.map((admin) => (
                <li key={admin.id}>{admin.email}</li>
              ))}
            </ul>
          ) : (
            <p>No admins found.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default SuperAdminCockpit;
