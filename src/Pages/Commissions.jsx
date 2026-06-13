import React, { useState, useEffect } from "react";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import ChartCard from "../components/ChartCard";
import { supabase } from "../supabaseClient";

function Commissions() {
  const [commissionsData, setCommissionsData] = useState([]);
  const [pendingData, setPendingData] = useState([]);
  const [graphData, setGraphData] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingSearch, setPendingSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [suspendState, setSuspendState] = useState(null); // null | "confirming" | "loading" | "done" | "error"

  useEffect(() => {
    async function fetchCommissions() {
      setLoading(true);

      const [
        { data: orders, error: ordersError },
        { data: drivers, error: driversError },
        { data: payments, error: paymentsError },
      ] = await Promise.all([
        supabase.from("orders").select("commission, driver_id, created_at, status"),
        supabase.from("drivers").select("id, first_name, car_type, phone"),
        supabase.from("payments").select("driver_id, amount").eq("status", "completed"),
      ]);

      if (ordersError) { console.error(ordersError); setLoading(false); return; }
      if (driversError) { console.error(driversError); setLoading(false); return; }
      if (paymentsError) { console.error(paymentsError); setLoading(false); return; }

      const driverMap = {};
      drivers.forEach((d) => {
        driverMap[d.id] = { id: d.id, name: d.first_name || "Unknown", car_type: d.car_type, phone: d.phone };
      });

      // total_commission_paid = SUM(payments.amount) per driver
      const paidMap = {};
      payments.forEach((p) => {
        paidMap[p.driver_id] = (paidMap[p.driver_id] || 0) + Number(p.amount || 0);
      });

      // total_commission_owed = SUM(orders.commission) per driver for completed orders
      // orders.commission already stores total_cost × rate for each trip
      const earnedMap = {};
      const completedOrders = orders.filter((o) => /completed/i.test(o.status || ""));
      completedOrders.forEach((o) => {
        const d = driverMap[o.driver_id];
        if (!d) return;
        if (!earnedMap[o.driver_id]) {
          earnedMap[o.driver_id] = { ...d, earned: 0 };
        }
        earnedMap[o.driver_id].earned += Number(o.commission || 0);
      });

      // outstanding_commission = total_commission_owed - total_commission_paid
      const pending = Object.values(earnedMap)
        .map((d) => ({
          ...d,
          paid: paidMap[d.id] || 0,
          outstanding: d.earned - (paidMap[d.id] || 0),
        }))
        .filter((d) => d.outstanding > 0)
        .sort((a, b) => b.outstanding - a.outstanding);

      setPendingData(pending);

      // All commission records (all completed orders, flat list)
      const combined = completedOrders
        .map((o) => {
          const d = driverMap[o.driver_id];
          if (!d) return null;
          return { name: d.name, car_type: d.car_type, commission: o.commission, created_at: o.created_at };
        })
        .filter(Boolean);
      setCommissionsData(combined);

      // Graph: total commission earned per day
      const graphMap = {};
      completedOrders.forEach((o) => {
        if (!driverMap[o.driver_id]) return;
        const date = new Date(o.created_at).toLocaleDateString();
        graphMap[date] = (graphMap[date] || 0) + Number(o.commission || 0);
      });
      setGraphData(Object.keys(graphMap).map((date) => ({ name: date, commission: graphMap[date] })));

      setLoading(false);
    }

    fetchCommissions();
  }, []);

  async function handleSuspend(driverId) {
    setSuspendState("loading");
    const { error } = await supabase
      .from("drivers")
      .update({ verified: false })
      .eq("id", driverId);

    if (error) {
      console.error(error);
      setSuspendState("error");
    } else {
      setSuspendState("done");
      // Remove from pending list since account is now suspended
      setPendingData((prev) => prev.filter((d) => d.id !== driverId));
    }
  }

  const filteredData = commissionsData.filter((item) =>
    (item.name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPending = pendingData.filter((item) =>
    (item.name || "").toLowerCase().includes(pendingSearch.toLowerCase())
  );

  const totalOutstanding = pendingData.reduce((sum, d) => sum + d.outstanding, 0);

  const inputStyle = {
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
  };

  const rowStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: "12px",
    borderBottom: "1px solid var(--border)",
  };

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

      <ChartCard title="Commission Earned Over Time" data={graphData} dataKey="commission" />

      {/* Pending Commissions */}
      <div style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              Pending Commissions
            </h2>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
              Earned from completed orders, not yet paid out
            </p>
          </div>
          {!loading && (
            <div style={{
              background: "rgba(245,158,11,0.1)",
              border: "1px solid rgba(245,158,11,0.3)",
              borderRadius: "var(--radius-sm)",
              padding: "6px 14px",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
            }}>
              <span style={{ fontSize: "11px", color: "rgba(245,158,11,0.8)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Total Outstanding
              </span>
              <span style={{ fontSize: "16px", fontWeight: 700, color: "#F59E0B" }}>
                KES {totalOutstanding.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)", fontSize: "14px" }}>
            Loading...
          </div>
        ) : pendingData.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)", fontSize: "14px" }}>
            All commissions have been paid out
          </div>
        ) : (
          <>
            <input
              type="text"
              placeholder="Search by driver name..."
              value={pendingSearch}
              onChange={(e) => setPendingSearch(e.target.value)}
              style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = "var(--accent-border)"; }}
              onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
            />
            <DataTable
              columns={["Driver", "Phone", "Car Type", "Earned", "Paid Out", "Outstanding"]}
              data={filteredPending.map((d) => ({
                Driver: d.name,
                Phone: d.phone || "—",
                "Car Type": d.car_type || "—",
                Earned: `KES ${d.earned.toLocaleString()}`,
                "Paid Out": `KES ${d.paid.toLocaleString()}`,
                Outstanding: `KES ${d.outstanding.toLocaleString()}`,
              }))}
              onRowClick={(row) => {
                setSuspendState(null);
                setSelectedItem({
                  ...pendingData.find((d) => d.name === row.Driver),
                  isPending: true,
                });
              }}
            />
          </>
        )}
      </div>

      {/* All Commission Records */}
      <div>
        <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>
          All Commission Records
        </h2>
        <input
          type="text"
          placeholder="Search by driver name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={inputStyle}
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
            onRowClick={(row) => { setSuspendState(null); setSelectedItem(row); }}
          />
        )}
      </div>

      <Modal
        isOpen={!!selectedItem}
        onClose={() => { setSelectedItem(null); setSuspendState(null); }}
        title={selectedItem?.isPending ? "Pending Commission Detail" : "Commission Detail"}
      >
        {selectedItem && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {selectedItem.isPending ? (
              <>
                {[
                  ["Driver", selectedItem.name],
                  ["Phone", selectedItem.phone || "—"],
                  ["Car Type", selectedItem.car_type || "—"],
                  ["Total Earned", `KES ${selectedItem.earned.toLocaleString()}`],
                  ["Total Paid Out", `KES ${selectedItem.paid.toLocaleString()}`],
                  ["Outstanding", `KES ${selectedItem.outstanding.toLocaleString()}`],
                ].map(([key, val]) => (
                  <div key={key} style={rowStyle}>
                    <p style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>{key}</p>
                    <p style={{ fontSize: "14px", color: key === "Outstanding" ? "#F59E0B" : "var(--text-primary)", fontWeight: 600 }}>{val}</p>
                  </div>
                ))}

                {/* Suspend Driver */}
                <div style={{ marginTop: "8px" }}>
                  {suspendState === null && (
                    <button
                      onClick={() => setSuspendState("confirming")}
                      style={{
                        width: "100%",
                        padding: "10px",
                        background: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.3)",
                        borderRadius: "var(--radius-sm)",
                        color: "#EF4444",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "background 150ms ease",
                      }}
                      onMouseEnter={(e) => { e.target.style.background = "rgba(239,68,68,0.18)"; }}
                      onMouseLeave={(e) => { e.target.style.background = "rgba(239,68,68,0.1)"; }}
                    >
                      Suspend Driver
                    </button>
                  )}

                  {suspendState === "confirming" && (
                    <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "var(--radius-sm)", padding: "14px" }}>
                      <p style={{ fontSize: "13px", color: "var(--text-primary)", marginBottom: "12px" }}>
                        Suspend <strong>{selectedItem.name}</strong>? Their account will be deactivated immediately.
                      </p>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          onClick={() => handleSuspend(selectedItem.id)}
                          style={{
                            flex: 1, padding: "9px", background: "#EF4444", border: "none",
                            borderRadius: "var(--radius-sm)", color: "#fff", fontSize: "13px",
                            fontWeight: 600, cursor: "pointer",
                          }}
                        >
                          Yes, Suspend
                        </button>
                        <button
                          onClick={() => setSuspendState(null)}
                          style={{
                            flex: 1, padding: "9px", background: "var(--surface-2)", border: "1px solid var(--border)",
                            borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: "13px",
                            fontWeight: 500, cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {suspendState === "loading" && (
                    <p style={{ textAlign: "center", fontSize: "13px", color: "var(--text-secondary)" }}>Suspending...</p>
                  )}

                  {suspendState === "done" && (
                    <p style={{ textAlign: "center", fontSize: "13px", color: "#10B981", fontWeight: 600 }}>
                      Driver suspended successfully.
                    </p>
                  )}

                  {suspendState === "error" && (
                    <p style={{ textAlign: "center", fontSize: "13px", color: "#EF4444" }}>
                      Failed to suspend driver. Please try again.
                    </p>
                  )}
                </div>
              </>
            ) : (
              [
                ["Driver", selectedItem.name || selectedItem.Name],
                ["Car Type", selectedItem.car_type || selectedItem["Car Type"] || "—"],
                ["Commission", `KES ${Number(selectedItem.commission || selectedItem.Commission || 0).toLocaleString()}`],
                ["Date", selectedItem.created_at ? new Date(selectedItem.created_at).toLocaleDateString() : "—"],
              ].map(([key, val]) => (
                <div key={key} style={rowStyle}>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>{key}</p>
                  <p style={{ fontSize: "14px", color: "var(--text-primary)", fontWeight: 600 }}>{val}</p>
                </div>
              ))
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Commissions;
