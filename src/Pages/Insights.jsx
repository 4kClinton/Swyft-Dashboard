import React, { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  CircleMarker,
  Polyline,
  Tooltip,
  useMap,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";
import L from "leaflet";
import { supabase } from "../supabaseClient";

const DEFAULT_CENTER = [-1.2921, 36.8219];
const DEFAULT_ZOOM = 12;

// Online driver — glowing green dot
const driverIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:14px;height:14px;
    background:#00D46A;
    border:2px solid rgba(0,212,106,0.4);
    border-radius:50%;
    box-shadow:0 0 10px rgba(0,212,106,0.7),0 0 20px rgba(0,212,106,0.3);
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  tooltipAnchor: [10, 0],
});

// Directional arrow at route midpoint — rotated to bearing, coloured by status
function makeArrowIcon(bearing, color = "#5E7397") {
  return L.divIcon({
    className: "",
    html: `<div style="
      transform:rotate(${bearing}deg);
      font-size:13px;
      line-height:1;
      color:${color};
      opacity:0.85;
      text-align:center;
      width:14px;height:14px;
      display:flex;align-items:center;justify-content:center;
    ">&#8593;</div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

// Compass bearing between two lat/lng points (0 = north, clockwise)
function getBearing(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// One order: pickup pin → coloured line with arrow → destination pin
function OrderRoute({ order, index }) {
  const pickup = [order.user_lat, order.user_lng];
  const dest = [order.dest_lat, order.dest_lng];
  const mid = [(pickup[0] + dest[0]) / 2, (pickup[1] + dest[1]) / 2];
  const bearing = getBearing(pickup[0], pickup[1], dest[0], dest[1]);

  const isCompleted = order.status?.toLowerCase() === "completed";
  const lineColor = isCompleted ? "#00D46A" : "#EF4444";
  const label = isCompleted ? "Completed" : "Cancelled";

  return (
    <>
      {/* Route line — green for completed, red for cancelled */}
      <Polyline
        positions={[pickup, dest]}
        pathOptions={{
          color: lineColor,
          weight: 1.5,
          opacity: 0.45,
          dashArray: isCompleted ? null : "6 4",
        }}
      />

      {/* Direction arrow at midpoint */}
      <Marker position={mid} icon={makeArrowIcon(bearing, lineColor)} interactive={false} />

      {/* Pickup dot */}
      <CircleMarker
        center={pickup}
        radius={4}
        pathOptions={{ color: lineColor, fillColor: lineColor, fillOpacity: 0.9, weight: 1 }}
      >
        <Tooltip>
          <span style={{ fontFamily: "Montserrat, sans-serif", fontSize: "11px" }}>
            {label} · Pickup #{index + 1}
          </span>
        </Tooltip>
      </CircleMarker>

      {/* Destination dot */}
      <CircleMarker
        center={dest}
        radius={4}
        pathOptions={{ color: lineColor, fillColor: lineColor, fillOpacity: 0.5, weight: 1 }}
      >
        <Tooltip>
          <span style={{ fontFamily: "Montserrat, sans-serif", fontSize: "11px" }}>
            {label} · Destination #{index + 1}
          </span>
        </Tooltip>
      </CircleMarker>
    </>
  );
}

// Fit map to all driver positions
function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 1) {
      map.fitBounds(positions, { padding: [60, 60] });
    } else if (positions.length === 1) {
      map.setView(positions[0], 14);
    }
  }, [positions.length]);
  return null;
}

const ORDER_LIMIT = 500;

function Insights() {
  const [drivers, setDrivers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [view, setView] = useState("both"); // "drivers" | "orders" | "both"
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [driverError, setDriverError] = useState(null);
  const channelRef = useRef(null);

  const fetchDrivers = async () => {
    setLoadingDrivers(true);
    setDriverError(null);
    try {
      const { data, error } = await supabase
        .from("drivers")
        .select("id, first_name, last_name, latitude, longitude, car_type")
        .eq("online", true);

      if (error) throw error;
      setDrivers(
        (data || []).filter((d) => d.latitude != null && d.longitude != null)
      );
    } catch (err) {
      console.error("Driver fetch error:", err.message);
      setDriverError(err.message);
    } finally {
      setLoadingDrivers(false);
    }
  };

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("id, user_lat, user_lng, dest_lat, dest_lng, status, created_at")
        .in("status", ["completed", "cancelled", "Completed", "Cancelled"])
        .order("created_at", { ascending: false })
        .limit(ORDER_LIMIT);

      if (error) {
        console.error("Orders fetch error:", error.message);
      } else {
        const valid = (data || []).filter(
          (o) =>
            o.user_lat != null &&
            o.user_lng != null &&
            o.dest_lat != null &&
            o.dest_lng != null
        );
        console.log(`Orders on map: ${valid.length} (completed + cancelled)`);
        setOrders(valid);
      }
    } catch (err) {
      console.error("Orders fetch error:", err);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
    fetchOrders();

    const channel = supabase
      .channel("insights:drivers")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "drivers" }, (payload) => {
        if (payload.new.online && payload.new.latitude != null) {
          setDrivers((prev) => [...prev, payload.new]);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "drivers" }, (payload) => {
        const d = payload.new;
        setDrivers((prev) =>
          !d.online ? prev.filter((x) => x.id !== d.id) : prev.map((x) => (x.id === d.id ? d : x))
        );
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "drivers" }, (payload) => {
        setDrivers((prev) => prev.filter((x) => x.id !== payload.old.id));
      })
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, []);

  const driverPositions = drivers.map((d) => [d.latitude, d.longitude]);
  const showDrivers = view === "drivers" || view === "both";
  const showOrders = view === "orders" || view === "both";
  const isLoading = loadingDrivers || loadingOrders;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", height: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Insights
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
            Live driver positions and order routes
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "var(--accent-dim)",
            border: "1px solid var(--accent-border)",
            borderRadius: "var(--radius-sm)",
            padding: "5px 10px",
            fontSize: "12px",
            color: "var(--accent)",
            fontWeight: 500,
          }}
        >
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 6px var(--accent)" }} />
          Live
        </div>
      </div>

      {/* Stats + toggle row */}
      <div style={{ display: "flex", gap: "12px", alignItems: "stretch" }}>
        <div style={{ flex: 1, background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "16px 20px" }}>
          <p style={{ fontSize: "11px", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "6px" }}>
            Online Drivers
          </p>
          <p style={{ fontSize: "28px", fontWeight: 700, color: "var(--accent)", letterSpacing: "-0.02em", lineHeight: 1 }}>
            {loadingDrivers ? "—" : drivers.length}
          </p>
          {driverError && <p style={{ fontSize: "11px", color: "var(--danger)", marginTop: "4px" }}>{driverError}</p>}
        </div>

        <div style={{ flex: 1, background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "16px 20px" }}>
          <p style={{ fontSize: "11px", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "6px" }}>
            Orders on Map
          </p>
          <p style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1 }}>
            {loadingOrders ? "—" : orders.length}
          </p>
          {!loadingOrders && (
            <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
              {orders.length === ORDER_LIMIT ? `Last ${ORDER_LIMIT} orders` : "All orders"}
            </p>
          )}
        </div>

        {/* View toggle */}
        <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "6px", display: "flex", gap: "4px", alignItems: "center" }}>
          {[
            { key: "drivers", label: "Drivers" },
            { key: "orders", label: "Orders" },
            { key: "both", label: "Both" },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setView(opt.key)}
              style={{
                padding: "7px 14px",
                borderRadius: "var(--radius-sm)",
                background: view === opt.key ? "var(--surface-3)" : "transparent",
                border: view === opt.key ? "1px solid var(--border-hover)" : "1px solid transparent",
                color: view === opt.key ? "var(--text-primary)" : "var(--text-secondary)",
                fontSize: "12px",
                fontWeight: view === opt.key ? 600 : 400,
                cursor: "pointer",
                transition: "all 150ms ease",
                whiteSpace: "nowrap",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: "20px", alignItems: "center", flexWrap: "wrap" }}>
        {showDrivers && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#00D46A", boxShadow: "0 0 6px rgba(0,212,106,0.7)" }} />
            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Online driver</span>
          </div>
        )}
        {showOrders && orders.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "28px", height: "2px", background: "#00D46A", borderRadius: "2px" }} />
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Completed</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "28px", height: "0", borderTop: "2px dashed #EF4444" }} />
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Cancelled</span>
            </div>
          </>
        )}
      </div>

      {/* Map */}
      <div style={{ flex: 1, minHeight: "480px", borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1px solid var(--border)", position: "relative" }}>
        {isLoading && (
          <div
            style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              zIndex: 1000,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "6px 10px",
              fontSize: "11px",
              color: "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <div style={{ width: "10px", height: "10px", border: "1.5px solid var(--border-hover)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "ins-spin 0.8s linear infinite", flexShrink: 0 }} />
            Loading...
          </div>
        )}

        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={20}
          />

          {driverPositions.length > 0 && showDrivers && (
            <FitBounds positions={driverPositions} />
          )}

          {/* Order routes */}
          {showOrders &&
            orders.map((order, i) => (
              <OrderRoute key={order.id} order={order} index={i} />
            ))}

          {/* Driver markers */}
          {showDrivers && drivers.length > 0 && (
            <MarkerClusterGroup
              chunkedLoading
              iconCreateFunction={(cluster) =>
                L.divIcon({
                  className: "",
                  html: `<div style="
                    width:32px;height:32px;
                    background:rgba(0,212,106,0.12);
                    border:1.5px solid rgba(0,212,106,0.45);
                    border-radius:50%;
                    display:flex;align-items:center;justify-content:center;
                    font-size:12px;font-weight:700;
                    color:#00D46A;
                    font-family:Montserrat,sans-serif;
                  ">${cluster.getChildCount()}</div>`,
                  iconSize: [32, 32],
                  iconAnchor: [16, 16],
                })
              }
            >
              {drivers.map((driver) => (
                <Marker
                  key={driver.id}
                  position={[driver.latitude, driver.longitude]}
                  icon={driverIcon}
                >
                  <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
                    <div style={{ fontSize: "12px", fontFamily: "Montserrat, sans-serif" }}>
                      <strong>{driver.first_name} {driver.last_name}</strong>
                      <br />
                      {driver.car_type || "Driver"}
                    </div>
                  </Tooltip>
                </Marker>
              ))}
            </MarkerClusterGroup>
          )}
        </MapContainer>
      </div>

      <style>{`
        @keyframes ins-spin { to { transform: rotate(360deg); } }
        .leaflet-tooltip {
          background: #131922 !important;
          border: 1px solid #263050 !important;
          color: #ECF0F6 !important;
          border-radius: 6px !important;
          box-shadow: 0 4px 16px rgba(0,0,0,0.5) !important;
          font-family: Montserrat, sans-serif !important;
          padding: 5px 9px !important;
        }
        .leaflet-tooltip-top:before { border-top-color: #263050 !important; }
        .leaflet-control-zoom a {
          background: #0D1117 !important;
          color: #ECF0F6 !important;
          border-color: #1C2335 !important;
        }
        .leaflet-control-zoom a:hover { background: #131922 !important; }
        .leaflet-control-attribution {
          background: rgba(7,8,13,0.7) !important;
          color: #5E7397 !important;
          font-size: 10px !important;
        }
        .leaflet-control-attribution a { color: #5E7397 !important; }
      `}</style>
    </div>
  );
}

export default Insights;
