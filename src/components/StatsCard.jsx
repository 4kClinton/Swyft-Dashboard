// src/components/StatsCard.jsx
import React from "react";

function StatsCard({ title, value, onClick }) {
  return (
    <div
      onClick={onClick}
      className="bg-gray-800 rounded-lg p-4 cursor-pointer hover:shadow-lg transition-shadow"
    >
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-3xl">{value}</p>
    </div>
  );
}

export default StatsCard;
