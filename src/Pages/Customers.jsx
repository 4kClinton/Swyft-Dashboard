import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchCustomers() {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from("customers")
          .select("*");
        if (error) {
          setError(`Supabase error: ${error.message}`);
          console.error("Supabase customers error:", error);
        } else {
          console.log("Customers raw data:", data);
          setCustomers(data ?? []);
        }
      } catch (err) {
        setError(`Unexpected error: ${err.message}`);
        console.error(err);
      }
      setLoading(false);
    }
    fetchCustomers();
  }, []);

  // Resolve display name across common column name variants
  const getDisplayName = (c) =>
    c.name || c.first_name || c.full_name || c.username || c.email || "Unknown";

  const filteredCustomers = customers.filter((c) =>
    getDisplayName(c).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          Customers
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
          {customers.length} registered customer{customers.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div style={{ marginBottom: "16px" }}>
        <input
          type="text"
          placeholder="Search by name..."
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
          }}
          onFocus={(e) => { e.target.style.borderColor = "var(--accent-border)"; }}
          onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
        />
      </div>

      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "var(--text-secondary)", fontSize: "14px" }}>
          Loading customers...
        </div>
      ) : error ? (
        <div style={{ color: "var(--danger)", fontSize: "14px" }}>{error}</div>
      ) : filteredCustomers.length === 0 ? (
        <div
          style={{
            padding: "60px",
            textAlign: "center",
            color: "var(--text-secondary)",
            fontSize: "14px",
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          {customers.length === 0
            ? "No customers in database — check Supabase RLS policies allow anon reads"
            : `No customers match "${searchQuery}"`}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "12px",
          }}
        >
          {filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              style={{
                background: "var(--surface-1)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "16px 20px",
                transition: "all 200ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--border-hover)";
                e.currentTarget.style.background = "var(--surface-2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.background = "var(--surface-1)";
              }}
            >
              {/* Avatar initial */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "var(--accent-dim)",
                    border: "1px solid var(--accent-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--accent)",
                    flexShrink: 0,
                  }}
                >
                  {getDisplayName(customer)?.[0]?.toUpperCase() || "?"}
                </div>
                <p
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {getDisplayName(customer)}
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  {customer.email || "—"}
                </p>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  {customer.phone || "—"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Customers;
