// src/pages/Commissions.jsx
import React, { useState, useEffect } from "react";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import ChartCard from "../components/ChartCard";
import { supabase } from "../supabaseClient"; // Ensure your supabase client is correctly configured

function Commissions() {
  const [commissionsData, setCommissionsData] = useState([]);
  const [graphData, setGraphData] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchCommissions() {
      // 1. Fetch orders data
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("commission, driver_id, created_at");
      if (ordersError) {
        console.error("Error fetching orders:", ordersError);
        return;
      }

      // 2. Fetch drivers data (id, name, car_type)
      const { data: drivers, error: driversError } = await supabase
        .from("drivers")
        .select("id, name, car_type");
      if (driversError) {
        console.error("Error fetching drivers:", driversError);
        return;
      }

      // 3. Create a map of driver data keyed by driver.id
      //    e.g. driverMap[driver.id] = { name: driver.name, car_type: driver.car_type }
      const driverMap = {};
      drivers.forEach((driver) => {
        driverMap[driver.id] = {
          name: driver.name,
          car_type: driver.car_type
        };
      });

      // 4. Combine order data with driver data
      //    Skip orders if there's no matching driver
      const combinedData = orders
        .map((order) => {
          const driverData = driverMap[order.driver_id];
          if (!driverData) return null; // no matching driver
          return {
            name: driverData.name,
            car_type: driverData.car_type,
            commission: order.commission,
            created_at: order.created_at
          };
        })
        .filter(Boolean); // remove null entries
console.log("Orders Error:", ordersError);
console.log("Drivers Error:", driversError);
console.log("Orders fetched:", orders);
console.log("Drivers fetched:", drivers);

      setCommissionsData(combinedData);

      // 5. Prepare graph data: group commissions by date and sum commissions per day
      const graphMap = {};
      combinedData.forEach((item) => {
        const date = new Date(item.created_at).toLocaleDateString();
        if (!graphMap[date]) {
          graphMap[date] = 0;
        }
        graphMap[date] += Number(item.commission);
      });
      const graphDataArray = Object.keys(graphMap).map((date) => ({
        name: date,
        commission: graphMap[date]
      }));
      setGraphData(graphDataArray);
    }

    fetchCommissions();
  }, []);

  // Filter commissionsData by driver's name
  const filteredData = commissionsData.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRowClick = (item) => {
    setSelectedItem(item);
  };

  const handleCloseModal = () => {
    setSelectedItem(null);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Commissions</h1>

      {/* Chart at the top */}
      <div className="mt-8">
        <ChartCard
          title="Commission Over Time"
          data={graphData}
          dataKey="commission"
          onClick={() => {}}
        />
      </div>

      {/* Search field */}
      <div className="mt-8 mb-4">
        <input
          type="text"
          placeholder="Search by driver name..."
          className="w-full p-2 rounded bg-gray-800 border border-gray-700 text-white"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Data Table */}
      <div className="mt-4">
        <DataTable
          columns={["Name", "Car Type", "Commission"]}
          data={filteredData}
          onRowClick={handleRowClick}
        />
      </div>

      {/* Modal for row details */}
      <Modal
        isOpen={!!selectedItem}
        onClose={handleCloseModal}
        title="Commission Details"
      >
        {selectedItem && (
          <div>
            <p>
              <strong>Name:</strong> {selectedItem.name}
            </p>
            <p>
              <strong>Car Type:</strong> {selectedItem.car_type || "N/A"}
            </p>
            <p>
              <strong>Commission:</strong> {selectedItem.commission}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Commissions;
