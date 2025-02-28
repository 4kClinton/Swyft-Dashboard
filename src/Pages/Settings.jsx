// src/pages/Settings.jsx
import React, { useState } from "react";
import Button from "../components/Button";
import { useNavigate } from "react-router-dom";

function Settings() {
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = () => {
    // For demo purposes, if password is "admin123", login is successful.
    if (password === "admin123") {
      navigate("/superadmin"); // Navigate to the Super Admin Cockpit
    } else {
      alert("Incorrect password!");
    }
  };

  return (
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
  );
}

export default Settings;
