import React, { useState, useEffect } from "react";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import ChartCard from "../components/ChartCard";
import { supabase } from "../supabaseClient";

function Commissions() {
  const [commissionsData, setCommissionsData] = useState([]);
  const [graphData, setGraphData] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCommissions() {
      setLoading(true);
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("commission, driver_id, created_at");
      if (ordersError) { console.error(ordersError); setLoading(false); return; }

      const { data: drivers, error: driversError } = await supabase
        .from("drivers")
        .select("id, name, car_type");
      if (driversError) { console.error(driversError); setLoading(false); return; }

      const driverMap = {};
      drivers.forEach((d) => {
        driverMap[d.id] = { name: d.name, car_type: d.car_type };
      });

      const combined = orders
        .map((o) => {
          const d = driverMap[o.driver_id];
          if (!d) return null;
          return {
            name: d.name,
            car_type: d.car_type,
            commission: o.commission,
            created_at: o.created_at,
          };
        })
        .filter(Boolean);

      setCommissionsData(combined);

      const graphMap = {};
      combined.forEach((item) => {
        const date = new Date(item.created_at).toLocaleDateString();
        graphMap[date] = (graphMap[date] || 0) + Number(item.commission);
      });
      setGraphData(
        Object.keys(graphMap).map((date) => ({ name: date, commission: graphMap[date] }))
      );

      setLoading(false);
    }

    fetchCommissions();
  }, []);

  const filteredData = commissionsData.filter((item) =>
    item.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          Commissions
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
          Driver commission records
        </p>
      </div>

      <ChartCard
        title="Commission Over Time"
        data={graphData}
        dataKey="commission"
      />

      <div>
        <input
          type="text"
          placeholder="Search by driver name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: "100%",
            maxWidth: "360px",
            padding: "9px 14px",
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-primary)",
            fontSize: "13px",
            outline: "none",
            transition: "border-color 150ms ease",
            marginBottom: "16px",
            display: "block",
          }}
          onFocus={(e) => { e.target.style.borderColor = "var(--accent-border)"; }}
          onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
        />

        {loading ? (
          <div style={{ padding: "60px", textAlign: "center", color: "var(--text-secondary)", fontSize: "14px" }}>
            Loading commissions...
          </div>
        ) : (
          <DataTable
            columns={["Name", "Car Type", "Commission"]}
            data={filteredData}
            onRowClick={setSelectedItem}
          />
        )}
      </div>

      <Modal
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title="Commission Detail"
      >
        {selectedItem && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {[
              ["Driver", selectedItem.name],
              ["Car Type", selectedItem.car_type || "—"],
              ["Commission", `KES ${Number(selectedItem.commission).toLocaleString()}`],
              ["Date", selectedItem.created_at ? new Date(selectedItem.created_at).toLocaleDateString() : "—"],
            ].map(([key, val]) => (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "12px", borderBottom: "1px solid var(--border)" }}>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>{key}</p>
                <p style={{ fontSize: "14px", color: "var(--text-primary)", fontWeight: 600 }}>{val}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Commissions;
