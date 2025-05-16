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

  // Online drivers states
  const [activeDrivers, setActiveDrivers] = useState(0);
  const [onlineDrivers, setOnlineDrivers] = useState([]);

  // Revenue trends state
  const [revenueData, setRevenueData] = useState([]);

  // Sign ups states
  const [driverSignUps, setDriverSignUps] = useState(0);
  const [customerSignUps, setCustomerSignUps] = useState(0);
  const [driverSignUpData, setDriverSignUpData] = useState([]);
  const [customerSignUpData, setCustomerSignUpData] = useState([]);

  const [loading, setLoading] = useState(true);

  /**
   * Helper function to format numbers with commas.
   * E.g., 4787.25 -> "4,787.25"
   */
  const formatNumber = (num) => {
    if (!num) return "0";
    return num.toLocaleString();
  };

  /**
   * Fetch online drivers (those with online === true)
   */
  const fetchOnlineDrivers = async () => {
    const { data: drivers, error } = await supabase
      .from("drivers")
      .select("first_name, last_name")
      .eq("online", true);

    if (error) {
      console.error("Error fetching drivers:", error);
      return [];
    } else {
      return drivers;
    }
  };
  

  /**
   * Fetch sign ups data (for drivers and customers) from the past 7 days
   */
  const fetchSignUpsData = async () => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // -------------------------
    // Drivers sign ups
    // -------------------------
    const { data: driversData, error: driverError } = await supabase
      .from("drivers")
      .select("id, join_date")
      .gte("join_date", oneWeekAgo.toISOString());

    if (driverError) {
      console.error("Error fetching driver sign ups:", driverError);
    } else if (driversData) {
      setDriverSignUps(driversData.length);
      const driverByDay = {};
      driversData.forEach((item) => {
        const day = new Date(item.join_date).toISOString().slice(0, 10);
        driverByDay[day] = (driverByDay[day] || 0) + 1;
      });
      const driverDataArray = Object.keys(driverByDay)
        .map((day) => ({
          first_name: day,
          signups: driverByDay[day]
        }))
        .sort((a, b) => new Date(a.first_name) - new Date(b.first_name));
      setDriverSignUpData(driverDataArray);
    }
    
    // -------------------------
    // Customers sign ups
    // -------------------------
    const { data: customersData, error: customerError } = await supabase
    .from("customers")
    .select("id, join_date")
    .gte("join_date", oneWeekAgo.toISOString());

      
    if (customerError) {
      console.error("Error fetching customer sign ups:", customerError);
    } else if (customersData) {
      setCustomerSignUps(customersData.length);
      const customerByDay = {};
      customersData.forEach((item) => {
        if (!item.join_date) {
          console.warn("Missing join_date in item:", item);
          return;
        }
        const day = new Date(item.join_date).toISOString().slice(0, 10);
        customerByDay[day] = (customerByDay[day] || 0) + 1;
      });
      const customerDataArray = Object.keys(customerByDay)
        .map((day) => ({
          name: day,
          signups: customerByDay[day]
        }))
        .sort((a, b) => new Date(a.name) - new Date(b.name));
      setCustomerSignUpData(customerDataArray);
    }
  };

  /**
   * Fetch dashboard data (orders, revenue trends, online drivers, and sign ups)
   */
  const fetchDashboardData = async () => {
    setLoading(true);

    // 1. Fetch Orders & Revenue Trends
    try {
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("commission, status, created_at");

      if (ordersError) {
        console.error("Error fetching orders:", ordersError);
      } else if (orders) {
        // Filter orders to include only those with status "completed"
        const completedOrders = orders.filter(
          (order) => order.status && order.status.toLowerCase() === "completed"
        );
        // Compute total revenue from completed orders
        const revenueSum = completedOrders.reduce(
          (acc, order) => acc + Number(order.commission || 0),
          0
        );
        setTotalRevenue(revenueSum);
        // Total orders count (all orders fetched)
        setTotalOrders(orders.length);
        // Group completed orders by month for chart data
        const monthlyMap = {};
        completedOrders.forEach((order) => {
          const date = new Date(order.created_at);
          const month = `${date.getFullYear()}-${date.getMonth() + 1}`;
          monthlyMap[month] =
            (monthlyMap[month] || 0) + Number(order.commission || 0);
        });
        const revenueDataArray = Object.keys(monthlyMap).map((month) => ({
          name: month,
          revenue: monthlyMap[month]
        }));
        setRevenueData(revenueDataArray);
      }
    } catch (err) {
      console.error("Unexpected error fetching orders:", err);
    }

    // 2. Fetch Online Drivers
    const drivers = await fetchOnlineDrivers();
    setOnlineDrivers(drivers);
    setActiveDrivers(drivers.length);

    // 3. Fetch Sign Ups Data
    await fetchSignUpsData();

    setLoading(false);
  };

  /**
   * Setup realtime subscriptions for:
   *  - drivers (online status and sign ups)
   *  - customers (sign ups)
   *  - orders (to update revenue and order count)
   */
  useEffect(() => {
    // Initial data fetch
    fetchDashboardData();

    // ---- DRIVERS subscription ----
    const onlineDriversSubscription = supabase
      .channel("online_drivers")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drivers" },
        async (payload) => {
          console.log("Realtime change (drivers) detected:", payload);
          const updatedDrivers = await fetchOnlineDrivers();
          setOnlineDrivers(updatedDrivers);
          setActiveDrivers(updatedDrivers.length);
          await fetchSignUpsData();
        }
      )
      .subscribe();

    // ---- CUSTOMERS subscription ----
    const customerSignUpsSubscription = supabase
      .channel("customer_signups")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customers" },
        async (payload) => {
          console.log("Realtime change (customers) detected:", payload);
          await fetchSignUpsData();
        }
      )
      .subscribe();

    // ---- ORDERS subscription ----
    const ordersSubscription = supabase
      .channel("orders_channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        async (payload) => {
          console.log("Realtime change (orders) detected:", payload);
          await fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(onlineDriversSubscription);
      supabase.removeChannel(customerSignUpsSubscription);
      supabase.removeChannel(ordersSubscription);
    };
  }, []);

  /**
   * Handle card clicks to show detailed info in a modal.
   */
  const handleCardClick = (detail) => {
    let content = detail;
    if (detail === "Detailed Driver Information") {
      content =
        onlineDrivers.length === 0
          ? "No drivers are currently online."
          : `Online Drivers:\n${onlineDrivers
              .map(
                (driver, index) =>
                  `${index + 1}. ${driver.first_name} ${driver.last_name}`
              )
              .join("\n")}`;
    }
    
    
    if (detail === "Detailed Driver Sign Up Information") {
      content =
        driverSignUpData.length === 0
          ? "No new driver sign ups in the past week."
          : `Driver Sign Ups Trend:\n${driverSignUpData
              .map((item) => `${item.name}: ${item.signups}`)
              .join("\n")}`;
    }
    if (detail === "Detailed Customer Sign Up Information") {
      content =
        customerSignUpData.length === 0
          ? "No new customer sign ups in the past week."
          : `Customer Sign Ups Trend:\n${customerSignUpData
              .map((item) => `${item.name}: ${item.signups}`)
              .join("\n")}`;
    }
    setModalContent(content);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold mb-4">Overview</h1>
      {loading ? (
        <p>Loading dashboard data...</p>
      ) : (
        <>
          {/* Main Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

          {/* Revenue Trends */}
          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-4">Revenue Trends</h2>
            <ChartCard
              title="Monthly Revenue"
              data={revenueData}
              dataKey="revenue"
              onClick={() => handleCardClick("More detailed chart data here")}
            />
          </div>

          {/* Sign Ups Section */}
          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-4">Sign Ups</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ChartCard
                title="Driver Sign Ups"
                value={driverSignUps}
                data={driverSignUpData}
                dataKey="signups"
                onClick={() =>
                  handleCardClick("Detailed Driver Sign Up Information")
                }
              />
              <ChartCard
                title="Customer Sign Ups"
                value={customerSignUps}
                data={customerSignUpData}
                dataKey="signups"
                onClick={() =>
                  handleCardClick("Detailed Customer Sign Up Information")
                }
              />
            </div>
          </div>
        </>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Details"
      >
        <pre>{modalContent}</pre>
      </Modal>
    </div>
  );
}

export default Dashboard;