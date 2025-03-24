import React, { useState, useEffect } from "react";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import Button from "../components/Button";
import { supabase } from "../supabaseClient";

const columns = ["Name", "Email"];

function DriverKYCUnverified() {
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchDrivers() {
      setLoading(true);
      setError(null);

      // Fetch drivers with is_verified set to false
      const { data, error } = await supabase
        .from("drivers")
        .select("id, name, email, image_key, document_keys, is_verified")
        .eq("is_verified", false);

      if (error) {
        setError("Error fetching drivers");
        console.error("Error fetching drivers:", error);
      } else {
        // For each driver, get public URLs for their image and documents
        const driversWithDocs = data.map((driver) => {
          // Retrieve the driver's image URL
          const { publicUrl: imageUrl } = supabase.storage
            .from("driver-images")
            .getPublicUrl(driver.image_key);

          // Retrieve document URLs, assuming document_keys is an array
          let documentUrls = [];
          if (driver.document_keys && Array.isArray(driver.document_keys)) {
            documentUrls = driver.document_keys.map((docKey) => {
              const { publicUrl } = supabase.storage
                .from("driver-documents")
                .getPublicUrl(docKey);
              return publicUrl;
            });
          }

          return { ...driver, imageUrl, documentUrls };
        });
        setDrivers(driversWithDocs);
      }
      setLoading(false);
    }

    fetchDrivers();
  }, []);

  const handleRowClick = (driver) => {
    setSelectedDriver(driver);
  };

  const handleCloseModal = () => {
    setSelectedDriver(null);
  };

  const handleApprove = async () => {
    if (!selectedDriver) return;

    // Update the driver's verification status
    const { error } = await supabase
      .from("drivers")
      .update({ is_verified: true })
      .eq("id", selectedDriver.id);

    if (error) {
      alert("Error approving driver");
      console.error("Error approving driver:", error);
    } else {
      alert(`Approved ${selectedDriver.name}`);
      // Optionally remove the driver from the list
      setDrivers((prev) => prev.filter((d) => d.id !== selectedDriver.id));
      handleCloseModal();
    }
  };

  const handleReject = async () => {
    if (!selectedDriver) return;

    // Here, you might want to update the driver's record or remove it from your DB.
    alert(`Rejected ${selectedDriver.name}`);
    setDrivers((prev) => prev.filter((d) => d.id !== selectedDriver.id));
    handleCloseModal();
  };

  // Filter drivers by the search query (searching by name)
  const filteredDrivers = drivers.filter((driver) =>
    driver.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Unverified Drivers</h1>
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
              <strong>Name:</strong> {selectedDriver.name}
            </p>
            <p>
              <strong>Email:</strong> {selectedDriver.email}
            </p>

            {selectedDriver.imageUrl && (
              <div className="mt-4">
                <img
                  src={selectedDriver.imageUrl}
                  alt={selectedDriver.name}
                  className="w-32 h-32 object-cover rounded"
                />
              </div>
            )}

            {selectedDriver.documentUrls &&
              selectedDriver.documentUrls.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xl font-bold mb-2">Documents:</h3>
                  <div className="flex flex-wrap gap-4">
                    {selectedDriver.documentUrls.map((docUrl, index) => (
                      <img
                        key={index}
                        src={docUrl}
                        alt={`Document ${index + 1}`}
                        className="w-32 h-32 object-cover rounded"
                      />
                    ))}
                  </div>
                </div>
              )}

            <p className="mt-2">
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

export default DriverKYCUnverified;
