import React, { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Tooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Clustering plugin
import MarkerClusterGroup from "react-leaflet-markercluster";
// Cluster styles from core package
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import { createClient } from "@supabase/supabase-js";

// Fix default icon issues with react-leaflet
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASEURL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Hook to fit map to dynamic bounds
function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);
  return null;
}

const Insights = () => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const channelRef = useRef(null);

  const fetchOnlineDrivers = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("drivers")
        .select("id, first_name, last_name, latitude, longitude, car_type")
        .eq("online", true);

      if (fetchError) throw fetchError;
      setDrivers(data || []);
    } catch (err) {
      console.error("Error fetching online drivers:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchOnlineDrivers();

    const channel = supabase.channel("realtime:drivers");

    // Handle INSERT (new driver goes online)
    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "drivers",
      },
      (payload) => {
        if (payload.new.online) {
          setDrivers((prev) => [...prev, payload.new]);
        }
      }
    );

    // Handle UPDATE (driver moves or goes offline)
    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "drivers",
      },
      (payload) => {
        const updatedDriver = payload.new;

        setDrivers((prev) => {
          let updatedList = prev.map((driver) =>
            driver.id === updatedDriver.id ? updatedDriver : driver
          );

          // If driver went offline, remove them from the list
          if (!updatedDriver.online) {
            updatedList = updatedList.filter((d) => d.id !== updatedDriver.id);
          }

          return updatedList;
        });
      }
    );

    // Handle DELETE (driver removed from DB)
    channel.on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "drivers",
      },
      (payload) => {
        const deletedId = payload.old.id;
        setDrivers((prev) => prev.filter((d) => d.id !== deletedId));
      }
    );

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);
  

  // Compute bounds for clustering
  const bounds = drivers.map((d) => [d.latitude, d.longitude]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: "2rem" }}>
        Loading drivers...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", marginTop: "2rem", color: "red" }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        height: "100vh",
      }}
    >
      <div
        style={{
          height: "70%",
          width: "90%",
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        <MapContainer
          center={bounds[0] || [-1.2921, 36.8219]}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds bounds={bounds} />

          <MarkerClusterGroup>
            {drivers.map((driver) => (
              <Marker
                key={driver.id}
                position={[driver.latitude, driver.longitude]}
              >
                <Tooltip permanent direction="top" offset={[0, -10]}>
                  {driver.first_name} {driver.last_name}, {driver.car_type}
                </Tooltip>
              </Marker>
            ))}
          </MarkerClusterGroup>
        </MapContainer>
      </div>
    </div>
  );
};

export default Insights;
