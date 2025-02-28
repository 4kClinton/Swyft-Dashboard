// src/pages/Marketing.jsx
import React, { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from "recharts";

function Marketing() {
  const [kpiData, setKpiData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Simulate fetching KPI data (replace with real database queries as needed)
  useEffect(() => {
    setTimeout(() => {
      setKpiData([
        { name: "Week 1", conversion: 20, retention: 70 },
        { name: "Week 2", conversion: 30, retention: 75 },
        { name: "Week 3", conversion: 25, retention: 80 },
        { name: "Week 4", conversion: 35, retention: 85 }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Marketing Dashboard</h1>
      {loading ? (
        <p>Loading KPIs...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : (
        <>
          <h2 className="text-2xl font-bold mb-4">
            Conversion & Retention Trends
          </h2>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={kpiData}>
                <XAxis dataKey="name" stroke="#fff" />
                <YAxis stroke="#fff" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#333", border: "none" }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="conversion"
                  stroke="#00d46a"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="retention"
                  stroke="#8884d8"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

export default Marketing;
