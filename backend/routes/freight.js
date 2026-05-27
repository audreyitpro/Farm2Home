const express = require("express");

const router = express.Router();

const freightLoads = [];
const freightTracking = [];

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function createId(prefix = "load") {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function cityKey(location) {
  return normalize(location).split(",")[0] || normalize(location);
}

function routeKey(load) {
  return `${cityKey(load.pickup_location)}-${cityKey(
    load.dropoff_location
  )}`;
}

function calculateEstimatedMiles(pickup, dropoff) {
  if (!pickup || !dropoff) return 0;

  if (cityKey(pickup) === cityKey(dropoff)) {
    return 10 + Math.floor(Math.random() * 25);
  }

  return 50 + Math.floor(Math.random() * 450);
}

/*
|--------------------------------------------------------------------------
| GET ALL LOADS
|--------------------------------------------------------------------------
*/

router.get("/loads", async (req, res) => {
  try {
    const maxMiles = Number(req.query.maxMiles || 99999);

    const loads = freightLoads.filter(
      (load) =>
        Number(load.distance_miles || 0) <= maxMiles
    );

    res.json({
      success: true,
      total: loads.length,
      loads,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message || "Unable to load freight board.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET GROUPED LOADS
|--------------------------------------------------------------------------
*/

router.get("/grouped-loads", async (req, res) => {
  try {
    const grouped = [];

    for (const load of freightLoads) {
      const status = normalize(load.status);

      if (
        !["available", "open", "new"].includes(status)
      ) {
        continue;
      }

      const existingGroup = grouped.find(
        (group) =>
          routeKey(group.loads[0]) === routeKey(load)
      );

      if (existingGroup) {
        existingGroup.loads.push(load);

        existingGroup.totalRate += Number(
          load.rate || 0
        );

        existingGroup.totalMiles += Number(
          load.distance_miles || 0
        );
      } else {
        grouped.push({
          routeKey: routeKey(load),
          pickupArea: cityKey(
            load.pickup_location
          ),
          dropoffArea: cityKey(
            load.dropoff_location
          ),
          totalRate: Number(load.rate || 0),
          totalMiles: Number(
            load.distance_miles || 0
          ),
          loads: [load],
        });
      }
    }

    res.json({
      success: true,
      totalGroups: grouped.length,
      groupedLoads: grouped,
    });
  } catch (error) {
    res.status(500).json({
      error:
        error.message ||
        "Unable to group freight loads.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET SINGLE LOAD
|--------------------------------------------------------------------------
*/

router.get("/loads/:id", async (req, res) => {
  try {
    const load = freightLoads.find(
      (item) => item.id === req.params.id
    );

    if (!load) {
      return res.status(404).json({
        error: "Freight load not found.",
      });
    }

    return res.json({
      success: true,
      load,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

/*
|--------------------------------------------------------------------------
| CREATE LOAD
|--------------------------------------------------------------------------
*/

router.post("/loads", async (req, res) => {
  try {
    const body = req.body || {};

    const pickup_location =
      body.pickup_location || "";

    const dropoff_location =
      body.dropoff_location || "";

    const load = {
      id: body.id || createId("freight"),

      title:
        body.title || "Farm2Home Freight Load",

      farmer_name:
        body.farmer_name || "Farm2Home Farmer",

      pickup_location,

      dropoff_location,

      pickup_date:
        body.pickup_date || "Today",

      pickup_time:
        body.pickup_time || "ASAP",

      dropoff_date:
        body.dropoff_date || "",

      dropoff_time:
        body.dropoff_time || "",

      equipment_type:
        body.equipment_type ||
        "Box Truck",

      weight_lbs:
        Number(body.weight_lbs || 0),

      temperature_required:
        body.temperature_required || "",

      rate: Number(body.rate || 0),

      distance_miles:
        Number(body.distance_miles || 0) ||
        calculateEstimatedMiles(
          pickup_location,
          dropoff_location
        ),

      commodity:
        body.commodity || "General Freight",

      notes: body.notes || "",

      status:
        body.status || "available",

      driver_id:
        body.driver_id || "",

      carrier_id:
        body.carrier_id || "",

      accepted_by:
        body.accepted_by || "",

      batch_id:
        body.batch_id || "",

      created_at: new Date().toISOString(),

      updated_at: new Date().toISOString(),
    };

    freightLoads.unshift(load);

    res.json({
      success: true,
      load,
    });
  } catch (error) {
    res.status(500).json({
      error:
        error.message ||
        "Unable to create freight load.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| ACCEPT SINGLE LOAD
|--------------------------------------------------------------------------
*/

router.post("/loads/:id/accept", async (req, res) => {
  try {
    const load = freightLoads.find(
      (item) => item.id === req.params.id
    );

    if (!load) {
      return res.status(404).json({
        error: "Load not found.",
      });
    }

    if (
      load.carrier_id ||
      load.driver_id
    ) {
      return res.status(400).json({
        error:
          "This load is already assigned.",
      });
    }

    load.carrier_id =
      req.body.carrier_id ||
      req.body.freightCarrierId ||
      "";

    load.accepted_by =
      req.body.accepted_by ||
      req.body.acceptedBy ||
      "Freight Carrier";

    load.status = "accepted";

    load.accepted_at =
      new Date().toISOString();

    load.updated_at =
      new Date().toISOString();

    res.json({
      success: true,
      load,
    });
  } catch (error) {
    res.status(500).json({
      error:
        error.message ||
        "Unable to accept freight load.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| ACCEPT MULTIPLE LOADS
|--------------------------------------------------------------------------
*/

router.post("/batch-accept", async (req, res) => {
  try {
    const orderIds = Array.isArray(
      req.body.orderIds
    )
      ? req.body.orderIds
      : [];

    if (orderIds.length === 0) {
      return res.status(400).json({
        error: "No loads selected.",
      });
    }

    const batchId = createId("batch");

    const acceptedLoads = [];

    for (const loadId of orderIds) {
      const load = freightLoads.find(
        (item) => item.id === loadId
      );

      if (!load) continue;

      if (
        load.carrier_id ||
        load.driver_id
      ) {
        continue;
      }

      load.carrier_id =
        req.body.carrier_id ||
        req.body.freightCarrierId ||
        "";

      load.accepted_by =
        req.body.accepted_by ||
        req.body.acceptedBy ||
        "Freight Carrier";

      load.batch_id = batchId;

      load.status = "accepted";

      load.accepted_at =
        new Date().toISOString();

      load.updated_at =
        new Date().toISOString();

      acceptedLoads.push(load);
    }

    res.json({
      success: true,
      batchId,
      totalAccepted: acceptedLoads.length,
      acceptedLoads,
    });
  } catch (error) {
    res.status(500).json({
      error:
        error.message ||
        "Unable to batch assign freight loads.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| UPDATE LOAD STATUS
|--------------------------------------------------------------------------
*/

router.patch("/loads/:id/status", async (req, res) => {
  try {
    const load = freightLoads.find(
      (item) => item.id === req.params.id
    );

    if (!load) {
      return res.status(404).json({
        error: "Load not found.",
      });
    }

    load.status =
      req.body.status || load.status;

    load.updated_at =
      new Date().toISOString();

    if (
      normalize(load.status) ===
      "arrived_pickup"
    ) {
      load.arrived_pickup_at =
        new Date().toISOString();
    }

    if (
      normalize(load.status) ===
      "picked_up"
    ) {
      load.picked_up_at =
        new Date().toISOString();
    }

    if (
      normalize(load.status) ===
      "arrived_dropoff"
    ) {
      load.arrived_dropoff_at =
        new Date().toISOString();
    }

    if (
      normalize(load.status) ===
      "delivered"
    ) {
      load.delivered_at =
        new Date().toISOString();
    }

    res.json({
      success: true,
      load,
    });
  } catch (error) {
    res.status(500).json({
      error:
        error.message ||
        "Unable to update freight load status.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| UPDATE TRACKING
|--------------------------------------------------------------------------
*/

router.post("/tracking/update", async (req, res) => {
  try {
    const tracking = {
      id: createId("tracking"),

      loadId:
        req.body.loadId || "",

      latitude:
        Number(req.body.latitude || 0),

      longitude:
        Number(req.body.longitude || 0),

      speed:
        Number(req.body.speed || 0),

      heading:
        Number(req.body.heading || 0),

      driverId:
        req.body.driverId || "",

      carrierId:
        req.body.carrierId || "",

      status:
        req.body.status || "",

      created_at: new Date().toISOString(),
    };

    freightTracking.unshift(tracking);

    res.json({
      success: true,
      tracking,
    });
  } catch (error) {
    res.status(500).json({
      error:
        error.message ||
        "Unable to update freight tracking.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET TRACKING
|--------------------------------------------------------------------------
*/

router.get("/tracking/:loadId", async (req, res) => {
  try {
    const tracking = freightTracking.filter(
      (item) =>
        item.loadId === req.params.loadId
    );

    res.json({
      success: true,
      total: tracking.length,
      tracking,
    });
  } catch (error) {
    res.status(500).json({
      error:
        error.message ||
        "Unable to load tracking.",
    });
  }
});

module.exports = router;