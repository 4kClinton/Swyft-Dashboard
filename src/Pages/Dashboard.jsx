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
  const [onlineDrivers, setOnlineDrivers] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [driverSignUps, setDriverSignUps] = useState(0);
  const [customerSignUps, setCustomerSignUps] = useState(0);
  const [driverSignUpData, setDriverSignUpData] = useState([]);
  const [customerSignUpData, setCustomerSignUpData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOnlineDrivers = async () => {
    const { data: drivers, error } = await supabase
      .from("drivers")
      .select("*")
      .eq("online", true);
    if (error) { console.error("Error fetching drivers:", error); return []; }
    return drivers;
  };

  const fetchSignUpsData = async () => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const { data: driversData } = await supabase
      .from("drivers")
      .select("id, join_date")
      .gte("join_date", oneWeekAgo.toISOString());

    if (driversData) {
      setDriverSignUps(driversData.length);
      const byDay = {};
      driversData.forEach((item) => {
        const day = new Date(item.join_date).toISOString().slice(0, 10);
        byDay[day] = (byDay[day] || 0) + 1;
      });
      setDriverSignUpData(
        Object.keys(byDay)
          .map((day) => ({ first_name: day, signups: byDay[day] }))
          .sort((a, b) => new Date(a.first_name) - new Date(b.first_name))
      );
    }

    const { data: customersData } = await supabase
      .from("customers")
      .select("id, join_date")
      .gte("join_date", oneWeekAgo.toISOString());

    if (customersData) {
      setCustomerSignUps(customersData.length);
      const byDay = {};
      customersData.forEach((item) => {
        if (!item.join_date) return;
        const day = new Date(item.join_date).toISOString().slice(0, 10);
        byDay[day] = (byDay[day] || 0) + 1;
      });
      setCustomerSignUpData(
        Object.keys(byDay)
          .map((day) => ({ name: day, signups: byDay[day] }))
          .sort((a, b) => new Date(a.name) - new Date(b.name))
      );
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);

    try {
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("commission, status, created_at");

      if (!ordersError && orders) {
        const completed = orders.filter(
          (o) => o.status?.toLowerCase() === "completed"
        );
        setTotalRevenue(
          completed.reduce((acc, o) => acc + Number(o.commission || 0), 0)
        );
        setTotalOrders(orders.length);

        const monthlyMap = {};
        completed.forEach((o) => {
          const date = new Date(o.created_at);
          const month = `${date.getFullYear()}-${date.getMonth() + 1}`;
          monthlyMap[month] =
            (monthlyMap[month] || 0) + Number(o.commission || 0);
        });
        setRevenueData(
          Object.keys(monthlyMap).map((m) => ({ name: m, revenue: monthlyMap[m] }))
        );
      }
    } catch (err) {
      console.error("Error fetching orders:", err);
    }

    const drivers = await fetchOnlineDrivers();
    setOnlineDrivers(drivers);
    setActiveDrivers(drivers.length);

    await fetchSignUpsData();
    setLoading(false);
  };

  useEffect(() => {
    fetchDashboardData();

    const driverSub = supabase
      .channel("online_drivers")
      .on("postgres_changes", { event: "*", schema: "public", table: "drivers" }, async () => {
        const updated = await fetchOnlineDrivers();
        setOnlineDrivers(updated);
        setActiveDrivers(updated.length);
        await fetchSignUpsData();
      })
      .subscribe();

    const customerSub = supabase
      .channel("customer_signups")
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, async () => {
        await fetchSignUpsData();
      })
      .subscribe();

    const orderSub = supabase
      .channel("orders_channel")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, async () => {
        await fetchDashboardData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(driverSub);
      supabase.removeChannel(customerSub);
      supabase.removeChannel(orderSub);
    };
  }, []);

  const handleCardClick = (detail) => {
    let content = detail;
    if (detail === "online-drivers") {
      content =
        onlineDrivers.length === 0
          ? "No drivers are currently online."
          : `Online Drivers:\n${onlineDrivers.map((d) => `• ${d.first_name || d.id}`).join("\n")}`;
    }
    setModalContent(content);
    setModalOpen(true);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "200px" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "24px",
              height: "24px",
              border: "2px solid var(--border-hover)",
              borderTopColor: "var(--accent)",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Loading dashboard...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Stats row */}
      <div>
        <p
          style={{
            fontSize: "11px",
            fontWeight: 500,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
            marginBottom: "12px",
          }}
        >
          Overview
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
          <StatsCard
            title="Total Orders"
            value={totalOrders.toLocaleString()}
            onClick={() => handleCardClick("Total orders fetched from all time.")}
          />
          <StatsCard
            title="Total Revenue"
            value={`KES ${totalRevenue.toLocaleString()}`}
            onClick={() => handleCardClick("Revenue from completed orders.")}
          />
          <StatsCard
            title="Online Drivers"
            value={activeDrivers}
            onClick={() => handleCardClick("online-drivers")}
          />
          <StatsCard
            title="New Drivers (7d)"
            value={driverSignUps}
          />
          <StatsCard
            title="New Customers (7d)"
            value={customerSignUps}
          />
        </div>
      </div>

      {/* Revenue chart */}
      <div>
        <p
          style={{
            fontSize: "11px",
            fontWeight: 500,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
            marginBottom: "12px",
          }}
        >
          Revenue
        </p>
        <ChartCard
          title="Monthly Revenue"
          data={revenueData}
          dataKey="revenue"
        />
      </div>

      {/* Sign ups charts */}
      <div>
        <p
          style={{
            fontSize: "11px",
            fontWeight: 500,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
            marginBottom: "12px",
          }}
        >
          Sign Ups — Last 7 Days
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
          <ChartCard
            title="Driver Sign Ups"
            value={driverSignUps}
            data={driverSignUpData}
            dataKey="signups"
          />
          <ChartCard
            title="Customer Sign Ups"
            value={customerSignUps}
            data={customerSignUpData}
            dataKey="signups"
          />
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Details">
        <pre
          style={{
            fontSize: "13px",
            color: "var(--text-secondary)",
            whiteSpace: "pre-wrap",
            fontFamily: "inherit",
            lineHeight: 1.7,
          }}
        >
          {modalContent}
        </pre>
      </Modal>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default Dashboard;
