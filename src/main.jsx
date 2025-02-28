// src/main.jsx
import React from "react";
import "@fontsource/montserrat"; // Defaults to 400 weight
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
