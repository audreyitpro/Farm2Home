// backend/routes/driver.js

const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");

const router = express.Router();

/* ====================================================
   SUPABASE
==================================================== */

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL;

const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env"
  );
}

const supabase = createClient(
  supabaseUrl,
  supabaseServiceKey,
  {
    realtime: {
      transport: ws,
    },
  }
);

/* ====================================================
   HELPERS
==================================================== */

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function requireFields(body, fields) {
  return fields.filter((field) => !body[field]);
}

async function checkDriverSubscription(driverId) {
  if (!driverId) return false;

  const { data, error } = await supabase
    .from("driver_subscriptions")
    .select("*")
    .eq("driver_id", driverId)
    .eq("subscription_status", "active")
    .maybeSingle();

  if (error) {
    console.error("CHECK DRIVER SUBSCRIPTION ERROR:", error);
    return false;
  }

  return Boolean(data);
}

/* ====================================================
   HEALTH CHECK
==================================================== */

router.get("/health", async (req, res) => {
  return res.json({
    success: true,
    message: "Driver routes running",
    supabaseConfigured: Boolean(
      supabaseUrl && supabaseServiceKey
    ),
  });
});

/* ====================================================
   ADD FARMER DRIVER
==================================================== */

router.post("/add-farmer-driver", async (req, res) => {
  try {
    const farmerId = cleanString(req.body.farmerId);
    const driverId = cleanString(req.body.driverId);
    const driverName = cleanString(req.body.driverName);
    const driverEmail = cleanString(req.body.driverEmail).toLowerCase();
    const driverPhone = cleanString(req.body.driverPhone);

    if (!farmerId || !driverName || !driverEmail) {
      return res.status(400).json({
        success: false,
        error:
          "Farmer ID, driver name, and driver email are required.",
      });
    }

    const { data: existingDriver, error: existingError } =
      await supabase
        .from("farmer_drivers")
        .select("*")
        .eq("farmer_id", farmerId)
        .eq("driver_email", driverEmail)
        .maybeSingle();

    if (existingError) throw existingError;

    if (existingDriver) {
      const { data: updatedDriver, error: updateError } =
        await supabase
          .from("farmer_drivers")
          .update({
            driver_id:
              driverId || existingDriver.driver_id || null,
            driver_name: driverName,
            driver_phone:
              driverPhone ||
              existingDriver.driver_phone ||
              "",
            status: "active",
            invite_status: "approved",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingDriver.id)
          .select()
          .single();

      if (updateError) throw updateError;

      return res.json({
        success: true,
        driver: updatedDriver,
        message:
          "Driver already existed and was updated.",
      });
    }

    const { data, error } = await supabase
      .from("farmer_drivers")
      .insert([
        {
          farmer_id: farmerId,
          driver_id: driverId || null,
          driver_name: driverName,
          driver_email: driverEmail,
          driver_phone: driverPhone,
          status: "active",
          invite_status: "approved",
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return res.json({
      success: true,
      driver: data,
      message: "Driver added successfully.",
    });
  } catch (error) {
    console.error("ADD FARMER DRIVER ERROR:", error);

    return res.status(500).json({
      success: false,
      error:
        error.message || "Unable to add farmer driver.",
    });
  }
});

/* ====================================================
   GET FARMER DRIVERS
==================================================== */

router.get("/farmer-drivers/:farmerId", async (req, res) => {
  try {
    const farmerId = cleanString(req.params.farmerId);

    if (!farmerId) {
      return res.status(400).json({
        success: false,
        error: "Farmer ID is required.",
      });
    }

    const { data, error } = await supabase
      .from("farmer_drivers")
      .select("*")
      .eq("farmer_id", farmerId)
      .neq("status", "removed")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.json({
      success: true,
      drivers: data || [],
    });
  } catch (error) {
    console.error("GET FARMER DRIVERS ERROR:", error);

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Unable to fetch farmer drivers.",
    });
  }
});

/* ====================================================
   REMOVE FARMER DRIVER
==================================================== */

router.post("/remove-farmer-driver", async (req, res) => {
  try {
    const farmerDriverId = cleanString(
      req.body.farmerDriverId
    );

    const farmerId = cleanString(req.body.farmerId);

    if (!farmerDriverId || !farmerId) {
      return res.status(400).json({
        success: false,
        error:
          "Farmer driver ID and farmer ID are required.",
      });
    }

    const { data, error } = await supabase
      .from("farmer_drivers")
      .update({
        status: "removed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", farmerDriverId)
      .eq("farmer_id", farmerId)
      .select()
      .single();

    if (error) throw error;

    return res.json({
      success: true,
      driver: data,
      message: "Driver removed from farmer list.",
    });
  } catch (error) {
    console.error("REMOVE FARMER DRIVER ERROR:", error);

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Unable to remove farmer driver.",
    });
  }
});

/* ====================================================
   CREATE DELIVERY JOB
==================================================== */

router.post("/create-delivery-job", async (req, res) => {
  try {
    const orderId = cleanString(req.body.orderId);
    const farmerId = cleanString(req.body.farmerId);
    const customerId = cleanString(req.body.customerId);

    const farmName = cleanString(req.body.farmName);
    const customerName = cleanString(req.body.customerName);
    const customerPhone = cleanString(req.body.customerPhone);

    const pickupAddress = cleanString(
      req.body.pickupAddress
    );

    const dropoffAddress = cleanString(
      req.body.dropoffAddress
    );

    const deliveryWindow = cleanString(
      req.body.deliveryWindow
    );

    const pickupNotes = cleanString(
      req.body.pickupNotes
    );

    const deliveryNotes = cleanString(
      req.body.deliveryNotes
    );

    const payoutAmount = toNumber(
      req.body.payoutAmount,
      0
    );

    const miles = toNumber(req.body.miles, 0);

    const missing = requireFields(
      {
        orderId,
        farmerId,
        pickupAddress,
        dropoffAddress,
      },
      [
        "orderId",
        "farmerId",
        "pickupAddress",
        "dropoffAddress",
      ]
    );

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missing.join(
          ", "
        )}`,
      });
    }

    const { data: existingJob, error: existingError } =
      await supabase
        .from("delivery_jobs")
        .select("*")
        .eq("order_id", orderId)
        .maybeSingle();

    if (existingError) throw existingError;

    if (existingJob) {
      return res.json({
        success: true,
        deliveryJob: existingJob,
        alreadyExists: true,
        message:
          "Delivery job already exists for this order.",
      });
    }

    const preferredUntil = new Date(
      Date.now() + 1000 * 60 * 10
    ).toISOString();

    const { data, error } = await supabase
      .from("delivery_jobs")
      .insert([
        {
          order_id: orderId,
          farmer_id: farmerId,
          customer_id: customerId || null,
          farm_name: farmName,
          customer_name: customerName,
          customer_phone: customerPhone,
          pickup_address: pickupAddress,
          dropoff_address: dropoffAddress,
          delivery_window: deliveryWindow,
          payout_amount: payoutAmount,
          miles,
          pickup_notes: pickupNotes,
          delivery_notes: deliveryNotes,
          status: "preferred_pending",
          visibility: "preferred_only",
          preferred_until: preferredUntil,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return res.json({
      success: true,
      deliveryJob: data,
      message: "Delivery job created.",
    });
  } catch (error) {
    console.error("CREATE DELIVERY JOB ERROR:", error);

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Unable to create delivery job.",
    });
  }
});

/* ====================================================
   DRIVER BOARD
==================================================== */

router.get("/driver-board", async (req, res) => {
  try {
    const driverId = cleanString(req.query.driverId);
    const farmerId = cleanString(req.query.farmerId);

    if (driverId) {
      const hasActiveSubscription =
        await checkDriverSubscription(driverId);

      if (!hasActiveSubscription) {
        return res.status(403).json({
          success: false,
          subscriptionRequired: true,
          error:
            "Active driver subscription is required to use the driver board.",
        });
      }
    }

    const now = new Date().toISOString();

    await supabase
      .from("delivery_jobs")
      .update({
        visibility: "open_board",
        status: "open_board",
        updated_at: now,
      })
      .eq("visibility", "preferred_only")
      .eq("status", "preferred_pending")
      .lt("preferred_until", now);

    let query = supabase
      .from("delivery_jobs")
      .select("*")
      .in("status", [
        "open_board",
        "preferred_pending",
      ])
      .order("created_at", {
        ascending: false,
      });

    if (farmerId) {
      query = query.eq("farmer_id", farmerId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return res.json({
      success: true,
      jobs: data || [],
    });
  } catch (error) {
    console.error("GET DRIVER BOARD ERROR:", error);

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Unable to fetch driver board.",
    });
  }
});

/* ====================================================
   ACCEPT DELIVERY JOB
==================================================== */

router.post("/accept-delivery-job", async (req, res) => {
  try {
    const deliveryJobId = cleanString(
      req.body.deliveryJobId
    );

    const driverId = cleanString(req.body.driverId);

    const driverName = cleanString(
      req.body.driverName
    );

    const driverEmail = cleanString(
      req.body.driverEmail
    ).toLowerCase();

    const driverPhone = cleanString(
      req.body.driverPhone
    );

    if (!deliveryJobId || !driverId) {
      return res.status(400).json({
        success: false,
        error:
          "Delivery job ID and driver ID are required.",
      });
    }

    const hasActiveSubscription =
      await checkDriverSubscription(driverId);

    if (!hasActiveSubscription) {
      return res.status(403).json({
        success: false,
        subscriptionRequired: true,
        error:
          "Active driver subscription is required to accept delivery jobs.",
      });
    }

    const { data, error } = await supabase
      .from("delivery_jobs")
      .update({
        assigned_driver_id: driverId,
        assigned_driver_name: driverName,
        assigned_driver_email: driverEmail,
        assigned_driver_phone: driverPhone,
        status: "accepted",
        visibility: "assigned",
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", deliveryJobId)
      .is("assigned_driver_id", null)
      .select()
      .single();

    if (error) throw error;

    return res.json({
      success: true,
      job: data,
      message: "Delivery job accepted.",
    });
  } catch (error) {
    console.error("ACCEPT DELIVERY JOB ERROR:", error);

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Unable to accept delivery job.",
    });
  }
});

/* ====================================================
   UPDATE DELIVERY STATUS
==================================================== */

router.post("/update-delivery-status", async (req, res) => {
  try {
    const deliveryJobId = cleanString(
      req.body.deliveryJobId
    );

    const driverId = cleanString(req.body.driverId);

    const status = cleanString(req.body.status);

    if (!deliveryJobId || !status) {
      return res.status(400).json({
        success: false,
        error:
          "Delivery job ID and status are required.",
      });
    }

    const updatePayload = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === "arrived_pickup") {
      updatePayload.arrived_pickup_at =
        new Date().toISOString();
    }

    if (status === "picked_up") {
      updatePayload.picked_up_at =
        new Date().toISOString();
    }

    if (status === "arrived_dropoff") {
      updatePayload.arrived_dropoff_at =
        new Date().toISOString();
    }

    if (status === "completed") {
      updatePayload.delivered_at =
        new Date().toISOString();

      updatePayload.visibility = "completed";
    }

    if (status === "cancelled") {
      updatePayload.cancelled_at =
        new Date().toISOString();

      updatePayload.visibility = "cancelled";
    }

    let query = supabase
      .from("delivery_jobs")
      .update(updatePayload)
      .eq("id", deliveryJobId);

    if (driverId) {
      query = query.eq(
        "assigned_driver_id",
        driverId
      );
    }

    const { data, error } =
      await query.select().single();

    if (error) throw error;

    return res.json({
      success: true,
      job: data,
      message: "Delivery status updated.",
    });
  } catch (error) {
    console.error(
      "UPDATE DELIVERY STATUS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Unable to update delivery status.",
    });
  }
});

/* ====================================================
   SAVE DRIVER SUBSCRIPTION
==================================================== */

router.post("/save-driver-subscription", async (req, res) => {
  try {
    const driverId = cleanString(req.body.driverId);

    const driverEmail = cleanString(
      req.body.driverEmail
    ).toLowerCase();

    const stripeCustomerId = cleanString(
      req.body.stripeCustomerId
    );

    const stripeSubscriptionId = cleanString(
      req.body.stripeSubscriptionId
    );

    const currentPeriodEnd =
      req.body.currentPeriodEnd || null;

    if (!driverId || !stripeSubscriptionId) {
      return res.status(400).json({
        success: false,
        error:
          "Driver ID and Stripe subscription ID are required.",
      });
    }

    const { data, error } = await supabase
      .from("driver_subscriptions")
      .upsert(
        [
          {
            driver_id: driverId,
            driver_email: driverEmail,
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id:
              stripeSubscriptionId,
            subscription_status: "active",
            current_period_end:
              currentPeriodEnd,
            updated_at:
              new Date().toISOString(),
          },
        ],
        {
          onConflict: "driver_id",
        }
      )
      .select()
      .single();

    if (error) throw error;

    return res.json({
      success: true,
      subscription: data,
      message: "Driver subscription saved.",
    });
  } catch (error) {
    console.error(
      "SAVE DRIVER SUBSCRIPTION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Unable to save driver subscription.",
    });
  }
});

/* ====================================================
   CHECK DRIVER SUBSCRIPTION
==================================================== */

router.get(
  "/subscription-status/:driverId",
  async (req, res) => {
    try {
      const driverId = cleanString(
        req.params.driverId
      );

      if (!driverId) {
        return res.status(400).json({
          success: false,
          error: "Driver ID is required.",
        });
      }

      const { data, error } = await supabase
        .from("driver_subscriptions")
        .select("*")
        .eq("driver_id", driverId)
        .maybeSingle();

      if (error) throw error;

      return res.json({
        success: true,
        hasActiveSubscription:
          data?.subscription_status ===
          "active",
        subscription: data || null,
      });
    } catch (error) {
      console.error(
        "CHECK DRIVER SUBSCRIPTION ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          "Unable to check driver subscription.",
      });
    }
  }
);

module.exports = router;