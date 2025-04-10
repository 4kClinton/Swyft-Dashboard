// src/pages/Customers.jsx
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
          .select("id, name, email, phone");
        if (error) {
          setError("Error fetching customers");
          console.error("Error fetching customers:", error);
        } else {
          setCustomers(data);
        }
      } catch (err) {
        setError("Error fetching customers");
        console.error(err);
      }
      setLoading(false);
    }
    fetchCustomers();
  }, []);

  // Filter customers based on the search query (case-insensitive match for name)
  const filteredCustomers = customers.filter((customer) =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-5 text-center">
        <p>Loading customers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 text-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-5">
      <h1 className="text-3xl font-bold mb-4">Customers</h1>

      {/* Search Input */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search customers by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
        />
      </div>

      {filteredCustomers.length === 0 ? (
        <p>No customers found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              className="border p-4 rounded shadow hover:shadow-md transition"
            >
              <h3 className="text-xl font-semibold">{customer.name}</h3>
              <p className="mt-1 text-gray-600">Email: {customer.email}</p>
              <p className="mt-1 text-gray-600">Phone: {customer.phone}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Customers;
