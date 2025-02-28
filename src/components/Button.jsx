// src/components/Button.jsx
import React from "react";

function Button({ onClick, children, variant = "primary" }) {
  const baseClasses = "px-4 py-2 rounded font-semibold";
  const variants = {
    primary: "bg-green-500 hover:bg-green-600 text-white",
    secondary: "bg-gray-500 hover:bg-gray-600 text-white",
    danger: "bg-red-500 hover:bg-red-600 text-white"
  };

  return (
    <button onClick={onClick} className={`${baseClasses} ${variants[variant]}`}>
      {children}
    </button>
  );
}

export default Button;
