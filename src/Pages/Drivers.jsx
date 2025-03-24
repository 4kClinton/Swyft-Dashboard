// src/pages/Drivers.jsx
import React, { useState, useEffect } from "react";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import Button from "../components/Button";
import { supabase } from "../supabaseClient";

const columns = ["Name", "Email"];

function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchDrivers() {
      setLoading(true);
      setError(null);
      // Fetch drivers data: ensure these column names match your table
      const { data, error } = await supabase
        .from("drivers")
        .select("id, first_name, email");
      if (error) {
        setError("Error fetching drivers");
        console.error("Error fetching drivers:", error);
      } else {
        setDrivers(data);
      }
      setLoading(false);
    }

    fetchDrivers();
  }, []);

  console.log(drivers)

  const handleRowClick = (driver) => {
    setSelectedDriver(driver);
  };

  const handleCloseModal = () => {
    setSelectedDriver(null);
  };

  const handleApprove = async () => {
    if (!selectedDriver) return;
  
    try {
      const response = await fetch("https://swyft-backend-client-nine.vercel.app/driver/verify", {
        method: "PATCH", // Or "PUT" depending on your backend setup
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedDriver.id }),
      });
  
      const data = await response.json();
  
      if (!response.ok) {
        throw new Error(data.error || "Failed to verify driver");
      }
  
      // Update the local state to reflect the verified status
      setDrivers((prevDrivers) =>
        prevDrivers.map((driver) =>
          driver.id === selectedDriver.id ? { ...driver, verified: true } : driver
        )
      );
  
      handleCloseModal();
    } catch (error) {
      console.error("Error verifying driver:", error);
      alert("Failed to verify driver.");
    }
  };

  const handleReject = async () => {
    if (!selectedDriver) return;
  
    try {
      const response = await fetch("https://swyft-backend-client-nine.vercel.app/driver/unverify", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedDriver.id }),
      });
  
      const data = await response.json();
  
      if (!response.ok) {
        throw new Error(data.error || "Failed to unverify driver");
      }
  
      // Update the local state to reflect the verified status
      setDrivers((prevDrivers) =>
        prevDrivers.map((driver) =>
          driver.id === selectedDriver.id ? { ...driver, verified: false } : driver
        )
      );
  
      handleCloseModal();
    } catch (error) {
      console.error("Error unverifying driver:", error);
      alert("Failed to unverify driver.");
    }
  };
  
  


  // Filter drivers by the search query (by name)
  const filteredDrivers = drivers.filter((driver) =>
    driver.first_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Driver KYC Verification</h1>

      {/* Search Field */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search drivers..."
          className="w-full p-2 rounded bg-gray-800 border border-gray-700 text-white"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <p>Loading drivers...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : (
        <DataTable
          columns={columns}
          data={filteredDrivers}
          onRowClick={handleRowClick}
        />
      )}

      <Modal
        isOpen={!!selectedDriver}
        onClose={handleCloseModal}
        title="Driver Details"
      >
        {selectedDriver && (
          <div>
            <p>
              <strong>Name:</strong> {selectedDriver.first_name}
            </p>
            <p>
              <strong>Email:</strong> {selectedDriver.email}
            </p>
            {/* Since there's no status column in your DB, default to "Pending" */}
            <p>
              <strong>Status:</strong> Pending
            </p>
            <div className="flex space-x-4 mt-4">
              <Button onClick={handleApprove} variant="primary">
                Approve
              </Button>
              <Button onClick={handleReject} variant="danger">
                Reject
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Drivers;
