// src/components/ChartCard.jsx
import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip
} from "recharts";

function ChartCard({ title, value, data, dataKey, onClick }) {
  return (
    <div
      onClick={onClick}
      className="bg-gray-800 rounded-lg p-4 cursor-pointer hover:shadow-lg transition-shadow"
    >
      {/* Header with title on the left and value (if provided) on the right */}
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {value !== undefined && (
          <span className="text-2xl font-bold text-green-500">{value}</span>
        )}
      </div>
      {/* Graph area */}
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <XAxis dataKey="name" stroke="#fff" />
          <YAxis stroke="#fff" />
          <Tooltip contentStyle={{ backgroundColor: "#333", border: "none" }} />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke="#00d46a"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ChartCard;
