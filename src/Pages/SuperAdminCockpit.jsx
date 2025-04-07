import React, { useState, useEffect } from "react";
import Button from "../components/Button";
import StatsCard from "../components/StatsCard";
import { supabase } from "../supabaseClient";

// MUI icons
import MoneyIcon from "@mui/icons-material/Money";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import CancelIcon from "@mui/icons-material/Cancel";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import ShowChartIcon from "@mui/icons-material/ShowChart";

// Sparkline charts
import { Sparklines, SparklinesLine } from "react-sparklines";

function SuperAdminCockpit() {
  // States for external data (from db.json)
  const [loginActivity, setLoginActivity] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  // KPI states (fetched from Supabase)
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [cancelledOrders, setCancelledOrders] = useState(0);
  const [averageOrderValue, setAverageOrderValue] = useState(0);
  const [activeDrivers, setActiveDrivers] = useState(0);
  const [newUserSignups, setNewUserSignups] = useState(0);
  const [growthRate, setGrowthRate] = useState(0); // Replaces operationalEfficiency

  /**
   * Format numbers with commas (e.g., 4787.25 -> "4,787.25")
   */
  const formatNumber = (num) => {
    if (!num) return "0";
    return num.toLocaleString();
  };

  /**
   * Example function to compute a mock growth rate:
   * (This is just a placeholder. Replace with real logic if needed.)
   */
  const computeGrowthRate = (current, previous) => {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  /**
   * Fetch KPI data from Supabase
   */
  const fetchKPIs = async () => {
    try {
      // 1. Fetch orders
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("commission, status, created_at");
      if (ordersError) {
        console.error("Error fetching orders:", ordersError);
      } else if (orders) {
        setTotalOrders(orders.length);

        // Filter completed orders
        const completedOrders = orders.filter(
          (order) => order.status && order.status.toLowerCase() === "completed"
        );
        // Filter cancelled
        const cancelled = orders.filter(
          (order) => order.status && order.status.toLowerCase() === "cancelled"
        );
        setCancelledOrders(cancelled.length);

        // Sum revenue from completed orders
        const revenueSum = completedOrders.reduce(
          (acc, order) => acc + Number(order.commission || 0),
          0
        );
        setTotalRevenue(revenueSum);

        // Avg. order value
        if (completedOrders.length > 0) {
          setAverageOrderValue(revenueSum / completedOrders.length);
        } else {
          setAverageOrderValue(0);
        }

        // Example "growth rate" (mock):
        const previousRevenue = revenueSum * 0.75; // pretend last week's revenue was 75% of current
        const dailyGrowth = computeGrowthRate(revenueSum, previousRevenue);
        setGrowthRate(dailyGrowth.toFixed(2)); // e.g. "33.33"
      }

      // 2. Fetch active drivers
      const { data: drivers, error: driversError } = await supabase
        .from("drivers")
        .select("id")
        .eq("online", true);
      if (driversError) {
        console.error("Error fetching active drivers:", driversError);
      } else if (drivers) {
        setActiveDrivers(drivers.length);
      }

      // 3. Fetch new user signups (past 7 days)
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      // Driver signups
      let driverCount = 0;
      const { data: driverSignups } = await supabase
        .from("drivers")
        .select("id")
        .gte("join_date", oneWeekAgo.toISOString());
      if (driverSignups) driverCount = driverSignups.length;

      // Customer signups
      let customerCount = 0;
      const { data: customerSignups } = await supabase
        .from("customers")
        .select("id")
        .gte("join_date", oneWeekAgo.toISOString());
      if (customerSignups) customerCount = customerSignups.length;

      setNewUserSignups(driverCount + customerCount);
    } catch (error) {
      console.error("Error fetching KPIs:", error);
    }
  };

  /**
   * Fetch login activity and admin data from local JSON
   */
  useEffect(() => {
    async function fetchExternalData() {
      try {
        const loginRes = await fetch("http://localhost:3001/login_activity");
        const loginData = await loginRes.json();
        setLoginActivity(loginData);

        const adminRes = await fetch("http://localhost:3001/admins");
        const adminData = await adminRes.json();
        setAdmins(adminData);
      } catch (error) {
        console.error("Error fetching external data:", error);
      }
      setLoading(false);
    }
    fetchExternalData();
  }, []);

  // Fetch KPI data from Supabase
  useEffect(() => {
    fetchKPIs();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Inline style for demonstration; ideally place in a CSS file */}
      <style>{`
        .glass-card {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 1rem;
          box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
        }
      `}</style>

      <h1 className="text-3xl font-bold mb-4">Super Admin Cockpit</h1>

      {/* KPIs Section */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4">
          Key Performance Indexes (KPIs)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Revenue Card */}
          <div className="glass-card p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <StatsCard
                  title="Total Revenue"
                  value={
                    <span className="text-[#00d46a] font-bold">
                      <MoneyIcon className="mb-1 mr-1" />
                      Ksh {formatNumber(totalRevenue)}
                    </span>
                  }
                />
              </div>
              {/* Sparkline chart (demo data) */}
              <div className="w-20 h-8">
                <Sparklines data={[10, 25, 18, 30, 40, 60, 55]}>
                  <SparklinesLine color="#00d46a" />
                </Sparklines>
              </div>
            </div>
          </div>

          {/* Total Orders Received */}
          <div className="glass-card p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <StatsCard
                  title="Total Orders Received"
                  value={
                    <span className="font-bold">
                      <ShoppingCartIcon className="mb-1 mr-1" />
                      {totalOrders}
                    </span>
                  }
                />
              </div>
              {/* Sparkline chart (demo data) */}
              <div className="w-20 h-8">
                <Sparklines data={[5, 8, 12, 18, 22, 25, 30]}>
                  <SparklinesLine color="#a3e635" />
                </Sparklines>
              </div>
            </div>
          </div>

          {/* Average Order Value */}
          <div className="glass-card p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <StatsCard
                  title="Average Order Value"
                  value={
                    <span className="font-bold">
                      <MoneyIcon className="mb-1 mr-1" />
                      Ksh {formatNumber(averageOrderValue)}
                    </span>
                  }
                />
              </div>
              {/* Sparkline chart (demo data) */}
              <div className="w-20 h-8">
                <Sparklines data={[10, 20, 15, 25, 30, 40, 35]}>
                  <SparklinesLine color="#FFB700FF" />
                </Sparklines>
              </div>
            </div>
          </div>

          {/* Cancelled Orders */}
          <div className="glass-card p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <StatsCard
                  title="Cancelled Orders"
                  value={
                    <span className="font-bold">
                      <CancelIcon className="mb-1 mr-1" />
                      {cancelledOrders}
                    </span>
                  }
                />
              </div>
              {/* Sparkline chart (demo data) */}
              <div className="w-20 h-8">
                <Sparklines data={[3, 2, 2, 5, 4, 3, 1]}>
                  <SparklinesLine color="#ef4444" />
                </Sparklines>
              </div>
            </div>
          </div>

          {/* Active Drivers */}
          <div className="glass-card p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <StatsCard
                  title="Active Drivers"
                  value={
                    <span className="font-bold">
                      <LocalShippingIcon className="mb-1 mr-1" />
                      {activeDrivers}
                    </span>
                  }
                />
              </div>
              {/* Sparkline chart (demo data) */}
              <div className="w-20 h-8">
                <Sparklines data={[1, 3, 5, 2, 4, 7, 3]}>
                  <SparklinesLine color="#22d3ee" />
                </Sparklines>
              </div>
            </div>
          </div>

          {/* New User Signups */}
          <div className="glass-card p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <StatsCard
                  title="New User Signups"
                  value={
                    <span className="font-bold">
                      <PersonAddIcon className="mb-1 mr-1" />
                      {newUserSignups}
                    </span>
                  }
                />
              </div>
              {/* Sparkline chart (demo data) */}
              <div className="w-20 h-8">
                <Sparklines data={[0, 2, 5, 7, 6, 9, 10]}>
                  <SparklinesLine color="#7dd3fc" />
                </Sparklines>
              </div>
            </div>
          </div>

          {/* Growth Rate(%) / Day */}
          <div className="glass-card p-4 shadow-lg md:col-span-3">
            <div className="flex items-center justify-between">
              <div>
                <StatsCard
                  title="Growth Rate(%) / Day"
                  value={
                    <span className="font-bold">
                      <TrendingUpIcon className="mb-1 mr-1" />
                      {growthRate}%
                    </span>
                  }
                />
              </div>
              {/* Sparkline chart (demo data) */}
              <div className="w-32 h-8">
                <Sparklines data={[5, 10, 8, 12, 20, 25, 30]}>
                  <SparklinesLine color="#84cc16" />
                </Sparklines>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Example Graph / Chart Section (Optional) */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4">Performance Chart</h2>
        <div className="glass-card p-4 shadow-lg">
          <p className="mb-2 flex items-center">
            <ShowChartIcon className="mr-2 text-blue-400" />
            Insert your line/bar chart here
          </p>
          {/* <ChartCard data={...} ... /> or any chart library */}
        </div>
      </div>

      {/* Login Activity Section */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4">Login Activity</h2>
        {loading ? (
          <p>Loading login activity...</p>
        ) : loginActivity && loginActivity.length > 0 ? (
          <ul className="list-disc pl-5">
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
        <h2 className="text-2xl font-bold mb-4">Admin Management</h2>
        <Button>Create New Admin</Button>
        <div className="mt-4">
          {loading ? (
            <p>Loading admin data...</p>
          ) : admins && admins.length > 0 ? (
            <ul className="list-disc pl-5">
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
