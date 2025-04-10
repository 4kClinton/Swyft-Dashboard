// src/pages/Drivers.jsx

import React, { useState, useEffect, useRef } from "react";


import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import Button from "../components/Button";
import { supabase } from "../supabaseClient";
import Slider from "react-slick";
import Lightbox from "yet-another-react-lightbox";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

import "yet-another-react-lightbox/styles.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";

const columns = ["first_name", "email"];

import "./Drivers.css";



function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const mainSlider = useRef();
  const thumbSlider = useRef();

  // Slider references
  const [mainSlider, setMainSlider] = useState(null);
  const [thumbSlider, setThumbSlider] = useState(null);

  useEffect(() => {
    const fetchDrivers = async () => {
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from("drivers")
          .select(
            `id, first_name, email, verified, car_type, phone, driving_license, 
            national_id_front, national_id_back, vehicle_picture_front, 
            vehicle_picture_back, car_insurance, inspection_report, 
            company_reg_certificate, kra, passport_photo, certificate_conduct,
            vehicle_make, vehicle_model, vehicle_year, vehicle_color,
            id_number, license_plate`
          )
          .eq("verified", false);

        if (error) throw error;
        setDrivers(data);
      } catch (err) {
        setError("Error fetching drivers");
        console.error(err);
      } finally {
        setLoading(false);

      }
    };

    fetchDrivers();
  }, []);


  const handleRowClick = (driver) => setSelectedDriver(driver);
  const handleCloseModal = () => setSelectedDriver(null);


const handleApprove = async () => {
  if (!selectedDriver) return;

  try {
    console.log("Sending ID to backend:", selectedDriver.id); // Log to check ID

  // const handleApprove = async () => {
  //   if (!selectedDriver) return;
  
  //   try {
  //     const response = await fetch("https://swyft-backend-client-nine.vercel.app/driver/verify", {
  //       method: "PATCH", // Or "PUT" depending on your backend setup
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ id: selectedDriver.id }),
  //     });
  
  //     const data = await response.json();
  
  //     if (!response.ok) {
  //       throw new Error(data.error || "Failed to verify driver");
  //     }
  
  //     // Update the local state to reflect the verified status
  //     setDrivers((prevDrivers) =>
  //       prevDrivers.map((driver) =>
  //         driver.id === selectedDriver.id ? { ...driver, verified: true } : driver
  //       )
  //     );
  
  //     handleCloseModal();
  //   } catch (error) {
  //     console.error("Error verifying driver:", error);
  //     alert("Failed to verify driver.");
  //   }
  // };


    const response = await fetch(
      "https://swyft-backend-client-nine.vercel.app/driver/verify", // Backend URL
      {
        method: "PATCH", // Or "PUT" depending on backend
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedDriver.id, // Ensure the ID is passed correctly
          verified: true
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to verify driver");
    }

    console.log("Driver verified:", data);

    // Update state if the request is successful
    setDrivers((prevDrivers) =>
      prevDrivers.map((driver) =>
        driver.id === selectedDriver.id ? { ...driver, verified: true } : driver
      )
    );

    handleCloseModal(); // Close modal after success
  } catch (error) {
    console.error("Error verifying driver:", error);
    alert("Failed to verify driver.");
  }
};

const handleRestrict = async () => {
  if (!selectedDriver) return;

  try {
    const response = await fetch(
      `https://swyft-backend-client-nine.vercel.app/driver_delete/${selectedDriver.id}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.message || "Failed to unverify (restrict) driver"
      );
    }


    // Update local state to reflect the verified status
    setDrivers((prevDrivers) =>
      prevDrivers.filter((driver) => driver.id !== selectedDriver.id)
    );

    handleCloseModal();
  } catch (error) {
    console.error("Error restricting driver:", error);
    alert("Failed to restrict driver.");
  }
};

  const filteredDrivers = drivers.filter((d) =>
    d.first_name.toLowerCase().includes(searchQuery.toLowerCase())
  );


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

        { label: "Inspection Report", src: selectedDriver.inspection_report },
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

    asNavFor: thumbSlider.current
  };

  const thumbSliderSettings = {
    slidesToShow: 5,

    slidesToScroll: 1,
    dots: false,
    infinite: true,
    speed: 500,
    centerMode: false,
    focusOnSelect: true,

    asNavFor: mainSlider.current,

    asNavFor: mainSlider, // Link back to main slider

    arrows: true
  };

  return (
    <div className="p-5 max-h-screen overflow-y-auto">
      <h1 className="text-3xl font-bold mb-4">Drivers</h1>


      <input
        type="text"
        placeholder="Search drivers..."
        className="w-full p-2 rounded bg-gray-800 border border-gray-700 text-white mb-4"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

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


            <div className="mt-4">
              <Slider {...mainSliderSettings} ref={mainSlider}>
                {imageData.map((img, idx) => (
                  <div key={idx} className="text-center">
                    <img
                      src={img.src}
                      alt={img.label}
                      className="w-72 h-48 object-cover rounded-lg cursor-zoom-in"
                      onClick={() => {
                        setLightboxIndex(idx);
                        setIsLightboxOpen(true);
                      }}
                    />
                    <p className="mt-2 text-sm">{img.label}</p>
                  </div>
                ))}
              </Slider>

              <Slider
                {...thumbSliderSettings}
                ref={thumbSlider}
                className="mt-3"
              >
                {imageData.map((img, idx) => (
                  <div key={idx} className="px-1">
                    <img
                      src={img.src}
                      alt={img.label}
                      className="w-24 h-20 object-cover cursor-pointer border border-gray-400"
                    />
                  </div>
                ))}
              </Slider>
            </div>

            <div className="flex space-x-4 mt-4">

              <Button onClick={handleApprove}>APPROVE DRIVER</Button>
              <Button onClick={handleRestrict} variant="danger">
                RESTRICT DRIVER
              </Button>

            </div>
          </div>
        )}
      </Modal>


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
