// src/pages/DriverKYCUnverified.jsx
import React, { useState, useEffect } from "react";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import Button from "../components/Button";
import { supabase } from "../supabaseClient";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

// Table columns: note that "driving_license" has been removed.
const columns = ["id", "first_name", "email", "verified"];

// Define image fields for the carousel (driving_license removed)
const imageFields = [
  { key: "national_id_front", label: "National ID (Front)" },
  { key: "national_id_back", label: "National ID (Back)" },
  { key: "psv_badge", label: "PSV Badge" },
  { key: "vehicle_registration", label: "Vehicle Registration" },
  { key: "vehicle_picture_front", label: "Vehicle Picture (Front)" },
  { key: "vehicle_picture_back", label: "Vehicle Picture (Back)" },
  { key: "psv_car_insurance", label: "PSV Car Insurance" },
  { key: "inspection_report", label: "Inspection Report" }
];

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

      // Fetch all drivers (verified and unverified) so we can display the verified status correctly
      const { data, error } = await supabase
        .from("drivers")
        .select(
          "id, first_name, email, verified, " +
            "national_id_front, national_id_back, psv_badge, vehicle_registration, " +
            "vehicle_picture_front, vehicle_picture_back, psv_car_insurance, inspection_report"
        );

      if (error) {
        setError("Error fetching drivers");
        console.error("Error fetching drivers:", error);
      } else {
        console.log("Raw driver data:", data);

        // Map over each driver and transform the image fields to public URLs.
        // Also, transform the verified field into a React element with appropriate color.
        const driversWithImages = data.map((driver) => {
          return {
            ...driver,
            national_id_front:
              driver.national_id_front &&
              supabase.storage
                .from("driver-images")
                .getPublicUrl(driver.national_id_front).publicUrl,
            national_id_back:
              driver.national_id_back &&
              supabase.storage
                .from("driver-images")
                .getPublicUrl(driver.national_id_back).publicUrl,
            psv_badge:
              driver.psv_badge &&
              supabase.storage
                .from("driver-images")
                .getPublicUrl(driver.psv_badge).publicUrl,
            vehicle_registration:
              driver.vehicle_registration &&
              supabase.storage
                .from("driver-images")
                .getPublicUrl(driver.vehicle_registration).publicUrl,
            vehicle_picture_front:
              driver.vehicle_picture_front &&
              supabase.storage
                .from("driver-images")
                .getPublicUrl(driver.vehicle_picture_front).publicUrl,
            vehicle_picture_back:
              driver.vehicle_picture_back &&
              supabase.storage
                .from("driver-images")
                .getPublicUrl(driver.vehicle_picture_back).publicUrl,
            psv_car_insurance:
              driver.psv_car_insurance &&
              supabase.storage
                .from("driver-images")
                .getPublicUrl(driver.psv_car_insurance).publicUrl,
            inspection_report:
              driver.inspection_report &&
              supabase.storage
                .from("driver-images")
                .getPublicUrl(driver.inspection_report).publicUrl,

            // Replace the verified field with a React element for display in the table
            verified: driver.verified ? (
              <span className="text-green-500 font-bold">VERIFIED</span>
            ) : (
              <span className="text-red-500 font-bold">UNVERIFIED</span>
            )
          };
        });

        console.log("Drivers with public URLs:", driversWithImages);
        setDrivers(driversWithImages);
      }
      setLoading(false);
    }

    fetchDrivers();
  }, []);

  // Handle row click to open the modal with selected driver's details
  const handleRowClick = (driver) => {
    console.log("Driver clicked:", driver);
    setSelectedDriver(driver);
  };

  const handleCloseModal = () => {
    setSelectedDriver(null);
  };

  // Action handlers for Approve and Reject
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

  const handleRestrict = async () => {
    if (!selectedDriver) return;

    try {
      const response = await fetch(
        "https://swyft-backend-client-nine.vercel.app/driver/unverify",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: selectedDriver.id })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to unverify (restrict) driver");
      }

      // Update local state to reflect the verified status
      setDrivers((prevDrivers) =>
        prevDrivers.map((driver) =>
          driver.id === selectedDriver.id
            ? { ...driver, verified: false }
            : driver
        )
      );

      handleCloseModal();
    } catch (error) {
      console.error("Error restricting driver:", error);
      alert("Failed to restrict driver.");
    }
  };

  // Filter drivers by first name based on search query
  const filteredDrivers = drivers.filter((driver) =>
    driver.first_name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Drivers</h1>
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
          <DriverDetailModalContent
            driver={selectedDriver}
            imageFields={imageFields}
            onApprove={handleApprove}
            onReject={handleRestrict}
          />
        )}
      </Modal>
    </div>
  );
}

export default DriverKYCUnverified;

// Component to display driver details and the two-part carousel of images
function DriverDetailModalContent({
  driver,
  imageFields,
  onApprove,
  onReject
}) {
  // Build an array of images using imageFields and driver data
  const images = imageFields
    .map((field) => ({
      label: field.label,
      url: driver[field.key]
    }))
    .filter((img) => !!img.url);

  // Two-part carousel state for react-slick
  const [mainSlider, setMainSlider] = useState(null);
  const [thumbSlider, setThumbSlider] = useState(null);
  // Slider settings for main slider
  const mainSliderSettings = {
    slidesToShow: 1,
    slidesToScroll: 1,
    arrows: true,
    fade: false,
    dots: false,
    infinite: true,
    speed: 500,
    asNavFor: thumbSlider
  };

  // Slider settings for thumbnail slider
  const thumbSliderSettings = {
    slidesToShow: 5,
    slidesToScroll: 1,
    arrows: true,
    focusOnSelect: true,
    infinite: true,
    speed: 500,
    asNavFor: mainSlider
  };

  return (
    <div>
      <p>
        <strong>Name:</strong> {driver.first_name}
      </p>
      <p>
        <strong>Email:</strong> {driver.email}
      </p>
      <p className="mt-2">
        <strong>Status:</strong>{" "}
        {driver.verified}
      </p>

      {/* Two-part Carousel */}
      {images.length > 0 ? (
        <div className="mt-4">
          {/* Main Slider */}
          <Slider
            {...mainSliderSettings}
            ref={(slider) => setMainSlider(slider)}
          >
            {images.map((img, index) => (
              <div key={index} style={{ textAlign: "center" }}>
                <img
                  src={img.url}
                  alt={img.label}
                  loading="eager"
                  style={{ maxWidth: "100%", height: "auto", margin: "0 auto" }}
                />
                <p style={{ marginTop: "10px" }}>{img.label}</p>
              </div>
            ))}
          </Slider>
          {/* Thumbnail Slider */}
          <div style={{ marginTop: "10px" }}>
            <Slider
              {...thumbSliderSettings}
              ref={(slider) => setThumbSlider(slider)}
            >
              {images.map((img, index) => (
                <div key={index} style={{ padding: "0 5px" }}>
                  <img
                    src={img.url}
                    alt={img.label}
                    loading="eager"
                    style={{
                      width: "70%",
                      borderRadius:"20px",
                      height: "auto",
                      cursor: "pointer",
                      border: "1px solid #ccc"
                    }}
                  />
                </div>
              ))}
            </Slider>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-400">No images available</p>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-4 mt-6">
        <Button onClick={onApprove} variant="primary">
          Approve
        </Button>
        <Button onClick={onReject} variant="danger">
          Reject
        </Button>
      </div>
    </div>
  );
}