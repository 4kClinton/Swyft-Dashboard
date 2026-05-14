import React, { useState, useEffect } from "react";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import Button from "../components/Button";
import { supabase } from "../supabaseClient";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import { resolveKycImageUrl } from "../utils/imageUtils";

const columns = ["first_name", "email"];

function DocImage({ src, label, onClick }) {
  const [resolvedUrl, setResolvedUrl] = useState(null);
  const [status, setStatus] = useState("resolving");

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      if (!src) { setStatus("missing"); return; }
      setStatus("resolving");
      const url = await resolveKycImageUrl(src);
      if (cancelled) return;
      if (!url) { setStatus("missing"); }
      else { setResolvedUrl(url); setStatus("loading"); }
    }

    resolve();
    return () => { cancelled = true; };
  }, [src]);

  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "4/3",
        background: "var(--surface-3)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        cursor: status === "loaded" ? "zoom-in" : "default",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "6px",
      }}
      onClick={status === "loaded" ? onClick : undefined}
    >
      {(status === "resolving" || status === "loading") && (
        <div
          style={{
            width: "20px",
            height: "20px",
            border: "2px solid var(--border-hover)",
            borderTopColor: "var(--accent)",
            borderRadius: "50%",
            animation: "drv-spin 0.8s linear infinite",
          }}
        />
      )}

      {status === "missing" && (
        <>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>Not uploaded</span>
        </>
      )}

      {status === "error" && (
        <>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span style={{ fontSize: "10px", color: "var(--danger)" }}>Load failed</span>
        </>
      )}

      {resolvedUrl && (
        <img
          src={resolvedUrl}
          alt={label}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: status === "loaded" ? "block" : "none",
          }}
        />
      )}
    </div>
  );
}

function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [lightboxSlides, setLightboxSlides] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

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
        console.error(error);
      } else {
        setDrivers(data);
      }
      setLoading(false);
    }
    fetchDrivers();
  }, []);

  const handleRestrict = async () => {
    if (!selectedDriver) return;
    try {
      const response = await fetch(
        "https://swyft-backend-client-nine.vercel.app/driver/unverify",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: selectedDriver.id }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to restrict driver");
      setDrivers((prev) =>
        prev.map((d) => d.id === selectedDriver.id ? { ...d, verified: false } : d)
      );
      setSelectedDriver(null);
    } catch (err) {
      console.error(err);
      alert("Failed to restrict driver.");
    }
  };

  const filteredDrivers = drivers.filter((d) =>
    d.first_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getDocs = (driver) => [
    { label: "Passport Photo", src: driver.passport_photo },
    { label: "Driving License", src: driver.driving_license },
    { label: "National ID Front", src: driver.national_id_front },
    { label: "National ID Back", src: driver.national_id_back },
    { label: "Vehicle Front", src: driver.vehicle_picture_front },
    { label: "Vehicle Back", src: driver.vehicle_picture_back },
    { label: "Car Insurance", src: driver.car_insurance },
    { label: "Inspection Report", src: driver.inspection_report },
    { label: "Company Reg Cert", src: driver.company_reg_certificate },
    { label: "KRA", src: driver.kra },
    { label: "Certificate of Conduct", src: driver.certificate_conduct },
  ];

  // Build lightbox slides when driver is selected
  useEffect(() => {
    if (!selectedDriver) return;
    let cancelled = false;

    async function buildSlides() {
      const docs = getDocs(selectedDriver);
      const resolved = await Promise.all(
        docs.map(async (d) => {
          const url = await resolveKycImageUrl(d.src);
          return url ? { src: url, alt: d.label } : null;
        })
      );
      if (!cancelled) setLightboxSlides(resolved.filter(Boolean));
    }

    buildSlides();
    return () => { cancelled = true; };
  }, [selectedDriver?.id]);

  const openLightbox = (docs, docIndex) => {
    const loadableDocs = docs.filter((d) => d.src);
    const slideIdx = loadableDocs.findIndex((_, i) => {
      let ni = -1;
      let count = 0;
      for (let j = 0; j < docs.length; j++) {
        if (docs[j].src) { if (count === i) { ni = j; break; } count++; }
      }
      return ni === docIndex;
    });
    setLightboxIndex(Math.max(0, slideIdx));
    setLightboxOpen(true);
  };

  const docs = selectedDriver ? getDocs(selectedDriver) : [];

  const fields = selectedDriver ? [
    ["Name", selectedDriver.first_name],
    ["Email", selectedDriver.email],
    ["Phone", selectedDriver.phone],
    ["Plate", selectedDriver.license_plate],
    ["Status", "Verified"],
    ["Car Type", selectedDriver.car_type],
    ["Make", selectedDriver.vehicle_make],
    ["Model", selectedDriver.vehicle_model],
    ["Year", selectedDriver.vehicle_year],
    ["Color", selectedDriver.vehicle_color],
  ] : [];

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          Drivers
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
          {drivers.length} verified driver{drivers.length !== 1 ? "s" : ""}
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
          Loading drivers...
        </div>
      ) : error ? (
        <div style={{ color: "var(--danger)", fontSize: "14px" }}>{error}</div>
      ) : (
        <DataTable columns={columns} data={filteredDrivers} onRowClick={setSelectedDriver} />
      )}

      <Modal
        isOpen={!!selectedDriver}
        onClose={() => setSelectedDriver(null)}
        title="Driver Details"
        wide
      >
        {selectedDriver && (
          <div style={{ display: "flex", gap: "24px" }}>
            {/* Info panel */}
            <div style={{ minWidth: "190px", maxWidth: "190px", flexShrink: 0 }}>
              <div
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "16px",
                  marginBottom: "16px",
                }}
              >
                <p style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "14px" }}>
                  Driver Info
                </p>
                {fields.map(([key, val]) => (
                  <div key={key} style={{ marginBottom: "10px" }}>
                    <p style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>{key}</p>
                    <p style={{ fontSize: "13px", color: key === "Status" ? "var(--accent)" : "var(--text-primary)", fontWeight: 500 }}>{val || "—"}</p>
                  </div>
                ))}
              </div>

              <Button onClick={handleRestrict} variant="danger">
                Restrict Driver
              </Button>
            </div>

            {/* Documents grid */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "14px" }}>
                Documents
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                  gap: "12px",
                }}
              >
                {docs.map((doc, idx) => (
                  <div key={idx}>
                    <DocImage
                      src={doc.src}
                      label={doc.label}
                      onClick={() => openLightbox(docs, idx)}
                    />
                    <p style={{ marginTop: "6px", fontSize: "10px", color: "var(--text-secondary)", textAlign: "center", fontWeight: 500, letterSpacing: "0.03em" }}>
                      {doc.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {lightboxOpen && lightboxSlides.length > 0 && (
        <Lightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          slides={lightboxSlides}
          index={lightboxIndex}
          plugins={[Zoom]}
        />
      )}

      <style>{`@keyframes drv-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default Drivers;
