import React, { useState, useEffect } from "react";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import Button from "../components/Button";
import { supabase } from "../supabaseClient";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import { resolveKycImageUrl, getDriverKycDocs } from "../utils/imageUtils";

const columns = ["first_name", "email"];

// Resolves a raw DB value to a usable URL asynchronously
function DocImage({ src, label, onClick }) {
  const [resolvedUrl, setResolvedUrl] = useState(null);
  const [status, setStatus] = useState("resolving"); // resolving | loading | loaded | error | missing

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      if (!src) {
        setStatus("missing");
        return;
      }

      setStatus("resolving");
      const url = await resolveKycImageUrl(src);

      if (cancelled) return;

      if (!url) {
        setStatus("missing");
      } else {
        setResolvedUrl(url);
        setStatus("loading");
      }
    }

    resolve();
    return () => { cancelled = true; };
  }, [src]);

  const isPlaceholder = status === "missing" || status === "error";
  const isSpinning = status === "resolving" || status === "loading";

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
      {/* Spinner — shown while resolving URL or loading image */}
      {isSpinning && (
        <div
          style={{
            width: "20px",
            height: "20px",
            border: "2px solid var(--border-hover)",
            borderTopColor: "var(--accent)",
            borderRadius: "50%",
            animation: "kyc-spin 0.8s linear infinite",
            flexShrink: 0,
          }}
        />
      )}

      {/* Not uploaded */}
      {status === "missing" && (
        <>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>Not uploaded</span>
        </>
      )}

      {/* Load failed */}
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

      {/* Actual image — always rendered when URL is resolved, visibility toggled */}
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
            transition: "transform 200ms ease",
          }}
          onMouseEnter={(e) => { e.target.style.transform = "scale(1.04)"; }}
          onMouseLeave={(e) => { e.target.style.transform = ""; }}
        />
      )}
    </div>
  );
}

function DriverDetail({ driver, onApprove, onReject, actionLoading, actionError }) {
  const [lightboxSlides, setLightboxSlides] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [docs, setDocs] = useState([]);

  // Build docs from DB columns + the driver's storage folder (covers drivers
  // whose files exist in storage but whose DB columns are null).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const built = await getDriverKycDocs(driver);
      if (!cancelled) setDocs(built);
    })();
    return () => { cancelled = true; };
  }, [driver.id]);

  // Pre-resolve all URLs for lightbox when docs change
  useEffect(() => {
    let cancelled = false;
    async function buildSlides() {
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
  }, [docs]);

  const openLightbox = (docIndex) => {
    // Map doc index to lightbox slide index (skipping null slides)
    let slideIdx = 0;
    let skipped = 0;
    for (let i = 0; i < docs.length; i++) {
      if (i === docIndex) { slideIdx = i - skipped; break; }
      if (!docs[i].src) skipped++;
    }
    setLightboxIndex(Math.max(0, slideIdx));
    setLightboxOpen(true);
  };

  const fields = [
    ["Name", driver.first_name],
    ["Email", driver.email],
    ["Phone", driver.phone],
    ["Plate", driver.license_plate],
    ["Car Type", driver.car_type],
    ["Make", driver.vehicle_make],
    ["Model", driver.vehicle_model],
    ["Year", driver.vehicle_year],
    ["Color", driver.vehicle_color],
  ];

  return (
    <>
      <div style={{ display: "flex", gap: "24px" }}>
        {/* Left: driver info + actions */}
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
            <p
              style={{
                fontSize: "10px",
                fontWeight: 600,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                color: "var(--text-secondary)",
                marginBottom: "14px",
              }}
            >
              Driver Info
            </p>
            {fields.map(([key, val]) => (
              <div key={key} style={{ marginBottom: "10px" }}>
                <p style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>
                  {key}
                </p>
                <p style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 500, wordBreak: "break-all" }}>
                  {val || "—"}
                </p>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <Button onClick={onApprove} disabled={actionLoading}>
              {actionLoading ? "Processing…" : "Approve Driver"}
            </Button>
            <Button onClick={onReject} variant="danger" disabled={actionLoading}>
              {actionLoading ? "Processing…" : "Reject Driver"}
            </Button>
            {actionError && (
              <p style={{ fontSize: "11px", color: "var(--danger)", marginTop: "4px", lineHeight: 1.4 }}>
                {actionError}
              </p>
            )}
          </div>
        </div>

        {/* Right: KYC document grid */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "var(--text-secondary)",
              marginBottom: "14px",
            }}
          >
            KYC Documents
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
                  onClick={() => openLightbox(idx)}
                />
                <p
                  style={{
                    marginTop: "6px",
                    fontSize: "10px",
                    color: "var(--text-secondary)",
                    textAlign: "center",
                    fontWeight: 500,
                    letterSpacing: "0.03em",
                    lineHeight: 1.3,
                  }}
                >
                  {doc.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {lightboxOpen && lightboxSlides.length > 0 && (
        <Lightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          slides={lightboxSlides}
          index={lightboxIndex}
          plugins={[Zoom]}
        />
      )}

      <style>{`@keyframes kyc-spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

function DriverKYC() {
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);

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

  const handleApprove = async () => {
    if (!selectedDriver) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const response = await fetch(
        "https://swyft-backend-client-nine.vercel.app/driver/verify",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: selectedDriver.id, verified: true }),
        }
      );
      if (!response.ok) {
        let msg = "Failed to verify driver";
        try { const d = await response.json(); msg = d.error || d.message || msg; } catch {}
        throw new Error(msg);
      }
      setDrivers((prev) => prev.filter((d) => d.id !== selectedDriver.id));
      setSelectedDriver(null);
    } catch (err) {
      console.error("Error approving driver:", err);
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedDriver) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const response = await fetch(
        `https://swyft-backend-client-nine.vercel.app/driver_delete/${selectedDriver.id}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        }
      );
      if (!response.ok) {
        let msg = "Failed to reject driver";
        try { const d = await response.json(); msg = d.error || d.message || msg; } catch {}
        throw new Error(msg);
      }
      setDrivers((prev) => prev.filter((d) => d.id !== selectedDriver.id));
      setSelectedDriver(null);
    } catch (err) {
      console.error("Error rejecting driver:", err);
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredDrivers = drivers.filter((d) =>
    d.first_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Driver KYC
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
            {drivers.length} pending verification{drivers.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.2)",
            borderRadius: "var(--radius-sm)",
            padding: "5px 10px",
            fontSize: "12px",
            color: "#F59E0B",
            fontWeight: 500,
          }}
        >
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#F59E0B" }} />
          Pending Review
        </div>
      </div>

      <div style={{ marginBottom: "16px" }}>
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
          }}
          onFocus={(e) => { e.target.style.borderColor = "var(--accent-border)"; }}
          onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
        />
      </div>

      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "var(--text-secondary)", fontSize: "14px" }}>
          Loading pending drivers...
        </div>
      ) : error ? (
        <div style={{ padding: "24px", color: "var(--danger)", fontSize: "14px" }}>{error}</div>
      ) : (
        <DataTable
          columns={columns}
          data={filteredDrivers}
          onRowClick={setSelectedDriver}
        />
      )}

      <Modal
        isOpen={!!selectedDriver}
        onClose={() => { setSelectedDriver(null); setActionError(null); }}
        title="KYC Review"
        wide
      >
        {selectedDriver && (
          <DriverDetail
            driver={selectedDriver}
            onApprove={handleApprove}
            onReject={handleReject}
            actionLoading={actionLoading}
            actionError={actionError}
          />
        )}
      </Modal>
    </div>
  );
}

export default DriverKYC;
