// src/App.jsx
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate
} from "react-router-dom";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Drivers from "./pages/Drivers";
import Sales from "./pages/Sales";
import Commissions from "./pages/Commissions";
import Settings from "./pages/Settings";
import Marketing from "./Pages/Marketing";
import Login from "./Pages/Login";
import SuperAdminCockpit from "./Pages/SuperAdminCockpit";
import "@fontsource/montserrat";
import "./index.css";

// A simple ProtectedRoute component
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
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <div
                className="flex h-screen bg-gray-900 text-white"
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                <Sidebar />
                <div className="flex-1 flex flex-col">
                  <Navbar />
                  <div className="p-6 overflow-auto">
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/drivers" element={<Drivers />} />
                      <Route path="/sales" element={<Sales />} />
                      <Route path="/commissions" element={<Commissions />} />
                      <Route path="/marketing" element={<Marketing />} />
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
