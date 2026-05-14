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
import "@fontsource/montserrat";
import "./index.css";

const ProtectedRoute = ({ children }) => {
  const storedUser = localStorage.getItem("user");
  const user =
    storedUser && storedUser !== "undefined" ? JSON.parse(storedUser) : null;
  return user ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <Router>
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
              <div
                style={{
                  display: "flex",
                  height: "100vh",
                  background: "var(--bg)",
                  color: "var(--text-primary)",
                  overflow: "hidden",
                }}
              >
                <Sidebar />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <Navbar />
                  <div
                    style={{
                      flex: 1,
                      overflowY: "auto",
                      padding: "28px 32px",
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
                    </Routes>
                  </div>
                </div>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
