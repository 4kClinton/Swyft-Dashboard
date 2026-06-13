import { useState } from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import Dashboard from "./Pages/Dashboard";
import Drivers from "./Pages/Drivers";
import Sales from "./Pages/Sales";
import DriverKYC from "./Pages/DriverKYC";
import Commissions from "./Pages/Commissions";
import Settings from "./Pages/Settings";
import Marketing from "./Pages/Marketing";
import Insights from "./Pages/Insights";
import Login from "./Pages/Login";
import SuperAdminCockpit from "./Pages/SuperAdminCockpit";
import ImageGallery from "./Pages/ImageGallery.jsx";
import ZoomedImagePage from "./Pages/ZoomedImagePage.jsx";
import Customers from "./Pages/Customers.jsx";
import NativeAnalytics from "./Pages/NativeAnalytics.jsx";
import ReelsAnalytics from "./Pages/ReelsAnalytics.jsx";
import ScoutsVerification from "./Pages/ScoutsVerification.jsx";
import Pricing from "./Pages/Pricing.jsx";
import DriverAnalytics from "./Pages/DriverAnalytics.jsx";
import { useIsMobile } from "./hooks/useIsMobile";
import "@fontsource/montserrat";
import "./index.css";

const ProtectedRoute = ({ children }) => {
  const storedUser = localStorage.getItem("user");
  const user =
    storedUser && storedUser !== "undefined" ? JSON.parse(storedUser) : null;
  return user ? children : <Navigate to="/login" />;
};

function AppShell() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: "var(--bg)",
        color: "var(--text-primary)",
        overflow: "hidden",
      }}
    >
      {/* Backdrop — mobile only */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.6)",
            zIndex: 40,
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
          }}
        />
      )}

      <Sidebar
        isOpen={isMobile ? sidebarOpen : true}
        isMobile={isMobile}
        onClose={() => setSidebarOpen(false)}
      />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        <Navbar
          isMobile={isMobile}
          onMenuClick={() => setSidebarOpen((v) => !v)}
        />
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: isMobile ? "16px" : "28px 32px",
          }}
        >
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/drivers" element={<Drivers />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/commissions" element={<Commissions />} />
            <Route path="/marketing" element={<Marketing />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/driver-kyc" element={<DriverKYC />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/native-analytics" element={<NativeAnalytics />} />
            <Route path="/reels-analytics" element={<ReelsAnalytics />} />
            <Route path="/scouts-verification" element={<ScoutsVerification />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/driver-analytics" element={<DriverAnalytics />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/superadmin" element={<SuperAdminCockpit />} />
        <Route path="/image" element={<ImageGallery />} />
        <Route path="/zoomed-image/:imageId" component={ZoomedImagePage} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
