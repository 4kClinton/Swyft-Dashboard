import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Drivers from "./pages/Drivers";
import Sales from "./pages/Sales";
import Commissions from "./pages/Commissions";
import Settings from "./pages/Settings";
import "@fontsource/montserrat"; // Import Montserrat font
import "./index.css";

function App() {
  return (
    <Router>
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
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;
