// src/components/DataTable.jsx
import React from "react";

function DataTable({ columns, data, onRowClick }) {
  console.log(data);
  console.log("columns: " + columns);
  
  
  return (
    <div className="overflow-auto">
      <table className="min-w-full bg-gray-800 rounded-lg">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="py-2 px-4 border-b border-gray-700 text-left"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              onClick={() => onRowClick(row)}
              className="hover:bg-gray-700 transition-colors cursor-pointer"
            >
              {columns.map((col) => (
                <td key={col} className="py-2 px-4 border-b border-gray-700">
                  {row[col.toLowerCase()] || "N/A"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
