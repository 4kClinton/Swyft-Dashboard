// src/pages/Login.jsx
import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import Button from "../components/Button";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      setErrorMsg(error.message);
    } else if (data.user) {
      // Record login activity here if needed (e.g., insert into a login_activity table)
      localStorage.setItem("user", JSON.stringify(data.user));
      window.location.href = "/"; // redirect to Dashboard (or your desired route)
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
      <div className="bg-gray-800 p-6 rounded-lg w-96">
        <h1 className="text-2xl font-bold mb-4">Login</h1>
        {errorMsg && <p className="text-red-500 mb-2">{errorMsg}</p>}
        <input
          type="email"
          placeholder="Email"
          className="w-full p-2 rounded mb-4 bg-gray-700 border border-gray-600"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full p-2 rounded mb-4 bg-gray-700 border border-gray-600"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button onClick={handleLogin}>Login</Button>
      </div>
    </div>
  );
}

export default Login;
