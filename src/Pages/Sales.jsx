// src/pages/Sales.jsx
import React, { useState, useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import DataTable from "../components/DataTable";
import { supabase } from "../supabaseClient";

function Sales() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Dummy data for the donut chart (Package Types Distribution)
  const packageData = [
    { name: "Furniture", value: 400 },
    { name: "Household items", value: 300 },
    { name: "Crates or Boxes", value: 300 },
    { name: "Construction Materials", value: 200 },
    { name: "Perishable Goods", value: 278 },
    { name: "Container", value: 189 },
    { name: "Medical Supplies", value: 239 },
    { name: "Animal Feeds", value: 349 }
  ];

  const COLORS = [
    "#00d46a",
    "#8884d8",
    "#82ca9d",
    "#ffc658",
    "#FF8042",
    "#0088FE",
    "#FFBB28",
    "#00C49F"
  ];

  useEffect(() => {
    async function fetchOrders() {
      setLoading(true);
      setError(null);
      // Removed order_value since it doesn't exist in your table
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, package_type, created_at");
      if (error) {
        setError("Error fetching orders");
        console.error("Error fetching orders:", error);
      } else {
        setOrders(data);
      }
      setLoading(false);
    }
    fetchOrders();
  }, []);

  // Filter orders based on package_type search query
  const filteredOrders = orders.filter(
    (order) =>
      order.package_type &&
      order.package_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Prepare data for pie chart: count cancelled vs. not cancelled orders.
  const cancelledCount = orders.filter(
    (order) => order.status === "Cancelled"
  ).length;
  const notCancelledCount = orders.length - cancelledCount;
  const pieData = [
    { name: "Cancelled", value: cancelledCount },
    { name: "Not Cancelled", value: notCancelledCount }
  ];

  // Prepare data for the order breakdown table (without order_value)
  const tableColumns = ["ID", "Package Type", "Created At", "Status"];
  const tableData = filteredOrders.map((order) => ({
    ID: order.id,
    "Package Type": order.package_type,
    "Created At": new Date(order.created_at).toLocaleDateString(),
    Status: order.status
  }));

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Sales Analytics</h1>

      {/* Search Field */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search orders by package type..."
          className="w-full p-2 rounded bg-gray-800 border border-gray-700 text-white"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <p>Loading orders...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : (
        <>
          {/* Donut Chart for Package Types */}
          <div className="mb-8" style={{ width: "100%", height: 300 }}>
            <h2 className="text-2xl font-semibold mb-2">
              Package Types Distribution
            </h2>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={packageData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  label
                >
                  {packageData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart for Order Cancellation */}
          <div className="mb-8" style={{ width: "100%", height: 300 }}>
            <h2 className="text-2xl font-semibold mb-2">Order Cancellation</h2>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#82ca9d"
                  label
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Order Breakdown Data Table */}
          <div>
            <h2 className="text-2xl font-semibold mb-2">
              Order Breakdown Data
            </h2>
            <DataTable
              columns={tableColumns}
              data={tableData}
              onRowClick={() => {}}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default Sales;
