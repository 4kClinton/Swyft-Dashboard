// src/pages/Drivers.jsx
import React, { useState, useEffect } from "react";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import Button from "../components/Button";
import { supabase } from "../supabaseClient";
import Slider from "react-slick";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import "yet-another-react-lightbox/styles.css";
import "./Drivers.css";

const columns = ["first_name", "email"];

function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Slider references
  const [mainSlider, setMainSlider] = useState(null);
  const [thumbSlider, setThumbSlider] = useState(null);

  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  useEffect(() => {
    async function fetchDrivers() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("drivers")
        .select(
          `id, first_name, email, verified, car_type, phone, driving_license, 
           national_id_front, national_id_back, vehicle_picture_front, vehicle_picture_back,
           car_insurance, inspection_report, company_reg_certificate, kra, passport_photo,
           certificate_conduct, vehicle_make, vehicle_model, vehicle_year, vehicle_color,
           id_number, license_plate`
        )
        .eq("verified", true);

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

  const handleRowClick = (driver) => {
    setSelectedDriver(driver);
  };

  const handleCloseModal = () => {
    setSelectedDriver(null);
  };

  // Single function to restrict (previously "reject") a driver
  const handleRestrict = async () => {
    if (!selectedDriver) return;

    try {
      const response = await fetch(
        "http://127.0.0.1:5000/driver/unverify",
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

  // Filter drivers by the search query (by name)
  const filteredDrivers = drivers.filter((driver) =>
    driver.first_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Prepare image data for the carousel (excluding license_number)
  const imageData = selectedDriver
    ? [
        { label: "Driving License", src: selectedDriver.driving_license },
        { label: "National ID Front", src: selectedDriver.national_id_front },
        { label: "National ID Back", src: selectedDriver.national_id_back },
        {
          label: "Vehicle Picture Front",
          src: selectedDriver.vehicle_picture_front
        },
        {
          label: "Vehicle Picture Back",
          src: selectedDriver.vehicle_picture_back
        },
        { label: "Car Insurance", src: selectedDriver.car_insurance },
        { label: "Inspection Report", src: selectedDriver.inspection_report },
        {
          label: "Company Reg Certificate",
          src: selectedDriver.company_reg_certificate
        },
        { label: "KRA", src: selectedDriver.kra },
        { label: "Passport Photo", src: selectedDriver.passport_photo },
        {
          label: "Certificate of Conduct",
          src: selectedDriver.certificate_conduct
        }
      ]
    : [];

  // Log image URLs for debugging
  console.log("Selected Driver Image URLs:", imageData);

  // Main slider (large images)
  const mainSliderSettings = {
    slidesToShow: 1,
    slidesToScroll: 1,
    arrows: true,
    fade: false,
    dots: false,
    infinite: true,
    speed: 500,
    asNavFor: thumbSlider // Link to thumbnail slider
  };

  // Thumbnail slider (small images)
  const thumbSliderSettings = {
    slidesToShow: 5, // Number of thumbnails visible
    slidesToScroll: 1,
    dots: false,
    infinite: true,
    speed: 500,
    centerMode: false,
    focusOnSelect: true,
    asNavFor: mainSlider, // Link back to main slider
    arrows: true
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4 max-h-screen overflow-y-auto">Drivers</h1>

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
            <p>
              <strong>Phone:</strong> {selectedDriver.phone}
            </p>
            <p>
              <strong>License Plate:</strong> {selectedDriver.license_plate}
            </p>
            <p>
              <strong>Status:</strong>{" "}
              {selectedDriver.verified === true
                ? "Approved"
                : selectedDriver.verified === false
                ? "Rejected"
                : "Pending"}
            </p>
            <p>
              <strong>Car Type:</strong> {selectedDriver.car_type}
            </p>
            <p>
              <strong>Vehicle Make:</strong> {selectedDriver.vehicle_make}
            </p>
            <p>
              <strong>Vehicle Model:</strong> {selectedDriver.vehicle_model}
            </p>
            <p>
              <strong>Vehicle Year:</strong> {selectedDriver.vehicle_year}
            </p>
            <p>
              <strong>Vehicle Color:</strong> {selectedDriver.vehicle_color}
            </p>

            {/* TWO-PART CAROUSEL (Main + Thumbnails) */}
            <div className="mt-4">
              {/* Main Slider */}
              <Slider
                {...mainSliderSettings}
                ref={(slider) => setMainSlider(slider)}
              >
                {imageData.map((img, index) => (
                  <div key={index} style={{ textAlign: "center" }}>
                    <img
                      src={img.src}
                      alt={img.label}
                      loading="eager"
                      style={{
                        maxWidth: "65%",
                        borderRadius: "10px",
                        height: "auto",
                        margin: "0 auto"
                      }}
                      onClick={() => {
                        setLightboxIndex(index);
                        setIsLightboxOpen(true);
                      }}
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
                  {imageData.map((img, index) => (
                    <div key={index} style={{ padding: "0 5px" }}>
                      <img
                        src={img.src}
                        alt={img.label}
                        loading="eager"
                        style={{
                          width: "100%",
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

            {/* Single Restrict Button */}
            <div className="flex space-x-4 mt-4">
              <Button onClick={handleRestrict} variant="danger">
                RESTRICT DRIVER
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Lightbox Viewer */}
      {isLightboxOpen && (
        <Lightbox
          open={isLightboxOpen}
          close={() => setIsLightboxOpen(false)}
          slides={imageData.map((img) => ({ src: img.src }))}
          index={lightboxIndex}
          plugins={[Zoom]}
        />
      )}
    </div>
  );
}

export default Drivers;