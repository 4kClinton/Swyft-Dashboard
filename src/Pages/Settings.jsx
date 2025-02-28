// src/pages/Settings.jsx
import React, { useState } from "react";
import Button from "../components/Button";

// This page serves as the Super Admin login/management page
function Settings() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    // This is a simple demo. Integrate proper authentication with Supabase.
    if (password === "admin123") {
      setLoggedIn(true);
    } else {
      alert("Incorrect password!");
    }
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setPassword("");
  };

  return (
    <div>
      {!loggedIn ? (
        <div className="max-w-md mx-auto mt-10 bg-gray-800 p-6 rounded-lg">
          <h1 className="text-2xl font-bold mb-4">Super Admin Login</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            className="w-full p-2 rounded mb-4 bg-gray-700 border border-gray-600"
          />
          <Button onClick={handleLogin}>Login</Button>
        </div>
      ) : (
        <div>
          <h1 className="text-3xl font-bold mb-4">Super Admin Panel</h1>
          {/* Additional admin functionalities can be added here */}
          <Button onClick={handleLogout} variant="secondary">
            Logout
          </Button>
        </div>
      )}
    </div>
  );
}

export default Settings;
