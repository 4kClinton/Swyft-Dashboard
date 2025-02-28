// src/pages/Dashboard.jsx
import React, { useState, useEffect } from "react";
import StatsCard from "../components/StatsCard";
import ChartCard from "../components/ChartCard";
import Modal from "../components/Modal";
import { supabase } from "../supabaseClient";

function Dashboard() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState("");
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [activeDrivers, setActiveDrivers] = useState(0);
  const [revenueData, setRevenueData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);

      // Fetch orders data
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("commission, created_at");

      if (ordersError) {
        console.error("Error fetching orders:", ordersError);
      } else if (orders) {
        // Compute total revenue as the sum of commissions
        const revenueSum = orders.reduce(
          (acc, order) => acc + Number(order.commission || 0),
          0
        );
        setTotalRevenue(revenueSum);
        setTotalOrders(orders.length);

        // Group orders by month to create revenue trends data
        const monthlyMap = {};
        orders.forEach((order) => {
          const date = new Date(order.created_at);
          // Format as "YYYY-M" (months are zero-indexed so add 1)
          const month = `${date.getFullYear()}-${date.getMonth() + 1}`;
          if (!monthlyMap[month]) {
            monthlyMap[month] = 0;
          }
          monthlyMap[month] += Number(order.commission || 0);
        });
        const revenueDataArray = Object.keys(monthlyMap).map((month) => ({
          name: month,
          revenue: monthlyMap[month]
        }));
        setRevenueData(revenueDataArray);
      }

      // Fetch active drivers (online_status true)
      const { data: drivers, error: driversError } = await supabase
        .from("drivers")
        .select("id")
        .eq("online_status", true);

      if (driversError) {
        console.error("Error fetching drivers:", driversError);
      } else if (drivers) {
        setActiveDrivers(drivers.length);
      }

      setLoading(false);
    }

    fetchDashboardData();
  }, []);

  const handleCardClick = (detail) => {
    setModalContent(detail);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold mb-4">Overview</h1>
      {loading ? (
        <p>Loading dashboard data...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatsCard
            title="Total Revenue"
            value={`Ksh ${totalRevenue}`}
            onClick={() => handleCardClick("Detailed Revenue Information")}
          />
          <StatsCard
            title="Total Orders"
            value={totalOrders}
            onClick={() => handleCardClick("Detailed Orders Information")}
          />
          <StatsCard
            title="Active Drivers"
            value={activeDrivers}
            onClick={() => handleCardClick("Detailed Driver Information")}
          />
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Revenue Trends</h2>
        <ChartCard
          title="Monthly Revenue"
          data={revenueData}
          dataKey="revenue"
          onClick={() => handleCardClick("More detailed chart data here")}
        />
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Details"
      >
        <p>{modalContent}</p>
      </Modal>
    </div>
  );
}

export default Dashboard;
