// backend/routes/orders.js

const express = require("express");

const router = express.Router();

const orders = [];

function createOrderId() {
  return `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createBatchId(prefix = "batch") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function cityKey(value) {
  return normalize(value).split(",")[0] || normalize(value);
}

function getPickupCity(order) {
  return (
    order.pickupCity ||
    order.deliveryInfo?.pickupCity ||
    order.deliveryInfo?.farmCity ||
    order.pickupAddress ||
    ""
  );
}

function getDeliveryCity(order) {
  return (
    order.deliveryCity ||
    order.deliveryInfo?.city ||
    order.deliveryInfo?.deliveryCity ||
    order.dropoffAddress ||
    order.city ||
    ""
  );
}

function estimateMiles(pickupCity, deliveryCity) {
  if (!pickupCity || !deliveryCity) return 10;

  if (cityKey(pickupCity) === cityKey(deliveryCity)) {
    return 5 + Math.floor(Math.random() * 15);
  }

  return 20 + Math.floor(Math.random() * 120);
}

function isOpenOrder(order) {
  const status = normalize(order.fulfillmentStatus || order.status || "NEW");

  return (
    ["new", "open", "available"].includes(status) &&
    !order.assignedDriverId &&
    !order.assignedFreightCarrierId
  );
}

async function sendExpoPushNotification(pushToken, title, body, data = {}) {
  try {
    if (!pushToken || !String(pushToken).startsWith("ExponentPushToken")) {
      return;
    }

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: pushToken,
        sound: "default",
        title,
        body,
        data,
      }),
    });
  } catch (error) {
    console.log("sendExpoPushNotification error:", error);
  }
}

async function notifyNearbyDrivers(order) {
  try {
    const drivers = global.drivers || [];

    const activeDrivers = drivers.filter((driver) => {
      const membershipStatus = normalize(driver.membershipStatus || "Active");
      const subscriptionStatus = normalize(driver.subscriptionStatus || "active");

      return (
        driver.accountActive !== false &&
        driver.notificationsEnabled !== false &&
        membershipStatus !== "canceled" &&
        subscriptionStatus !== "canceled" &&
        driver.expoPushToken
      );
    });

    for (const driver of activeDrivers) {
      await sendExpoPushNotification(
        driver.expoPushToken,
        "New Farm2Home Delivery",
        "New Farm2Home delivery available in your area. Tap to view and accept.",
        {
          type: "DRIVER_ORDER_AVAILABLE",
          orderId: order.id,
          route: "/driver/board",
        }
      );
    }

    console.log(`Driver notifications sent: ${activeDrivers.length}`);
  } catch (error) {
    console.log("notifyNearbyDrivers error:", error);
  }
}

async function notifyNearbyFreight(order) {
  try {
    const freightCarriers = global.freightCarriers || [];

    const activeCarriers = freightCarriers.filter((carrier) => {
      const membershipStatus = normalize(carrier.membershipStatus || "Active");
      const subscriptionStatus = normalize(carrier.subscriptionStatus || "active");

      return (
        carrier.accountActive !== false &&
        carrier.notificationsEnabled !== false &&
        membershipStatus !== "canceled" &&
        subscriptionStatus !== "canceled" &&
        carrier.expoPushToken
      );
    });

    for (const carrier of activeCarriers) {
      await sendExpoPushNotification(
        carrier.expoPushToken,
        "New Farm2Home Freight Load",
        "New Farm2Home freight load available in your area. Tap to view and accept.",
        {
          type: "FREIGHT_LOAD_AVAILABLE",
          orderId: order.id,
          route: "/freight/board",
        }
      );
    }

    console.log(`Freight notifications sent: ${activeCarriers.length}`);
  } catch (error) {
    console.log("notifyNearbyFreight error:", error);
  }
}

/* =====================================================
   DRIVER BOARD - AVAILABLE DELIVERIES
===================================================== */

router.get("/driver-board", async (req, res) => {
  try {
    const maxMiles = Number(req.query.maxMiles || 99999);

    const availableOrders = orders
      .filter(isOpenOrder)
      .filter((order) => Number(order.estimatedMiles || 0) <= maxMiles);

    const groupedOrders = [];

    for (const order of availableOrders) {
      const pickupCity = getPickupCity(order);
      const deliveryCity = getDeliveryCity(order);
      const key = `${cityKey(pickupCity)}-${cityKey(deliveryCity)}`;

      const existing = groupedOrders.find((group) => group.routeKey === key);

      if (existing) {
        existing.orders.push(order);
        existing.totalStops += 1;
        existing.totalPayout += Number(order.deliveryFee || order.tip || 0);
        existing.totalMiles += Number(order.estimatedMiles || 0);
      } else {
        groupedOrders.push({
          routeKey: key,
          pickupCity,
          deliveryCity,
          totalStops: 1,
          totalPayout: Number(order.deliveryFee || order.tip || 0),
          totalMiles: Number(order.estimatedMiles || 0),
          orders: [order],
        });
      }
    }

    return res.json({
      success: true,
      availableOrders,
      groupedOrders,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Unable to load driver board.",
    });
  }
});

/* =====================================================
   ACCEPT MULTIPLE DRIVER DELIVERIES
===================================================== */

router.post("/batch-accept", async (req, res) => {
  try {
    const orderIds = Array.isArray(req.body.orderIds) ? req.body.orderIds : [];

    if (orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No order IDs supplied.",
      });
    }

    const driverId = req.body.driverId || req.body.assignedDriverId || "";
    const acceptedBy = req.body.acceptedBy || req.body.assignedDriverName || "";

    if (!driverId) {
      return res.status(400).json({
        success: false,
        error: "Missing driver ID.",
      });
    }

    const batchId = createBatchId("driver_batch");
    const now = new Date().toISOString();

    const acceptedOrders = [];

    for (const orderId of orderIds) {
      const order = orders.find((item) => item.id === orderId);

      if (!order) continue;
      if (!isOpenOrder(order)) continue;

      order.fulfillmentStatus = "ACCEPTED";
      order.assignedDriverId = driverId;
      order.acceptedBy = acceptedBy;
      order.acceptedAt = now;
      order.driverBatchGroupId = batchId;
      order.routeGroup = order.routeGroup || `${cityKey(getPickupCity(order))}-${cityKey(getDeliveryCity(order))}`;
      order.updatedAt = now;

      acceptedOrders.push(order);
    }

    return res.json({
      success: true,
      batchId,
      totalAccepted: acceptedOrders.length,
      acceptedOrders,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Unable to batch accept orders.",
    });
  }
});

/* =====================================================
   ACCEPT MULTIPLE FREIGHT ORDERS
===================================================== */

router.post("/freight-batch-accept", async (req, res) => {
  try {
    const orderIds = Array.isArray(req.body.orderIds) ? req.body.orderIds : [];

    if (orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No order IDs supplied.",
      });
    }

    const freightCarrierId =
      req.body.freightCarrierId || req.body.assignedFreightCarrierId || "";

    const acceptedBy =
      req.body.acceptedBy || req.body.assignedFreightCarrierName || "";

    if (!freightCarrierId) {
      return res.status(400).json({
        success: false,
        error: "Missing freight carrier ID.",
      });
    }

    const batchId = createBatchId("freight_batch");
    const now = new Date().toISOString();

    const acceptedOrders = [];

    for (const orderId of orderIds) {
      const order = orders.find((item) => item.id === orderId);

      if (!order) continue;
      if (!isOpenOrder(order)) continue;

      order.fulfillmentStatus = "ACCEPTED";
      order.assignedFreightCarrierId = freightCarrierId;
      order.acceptedBy = acceptedBy;
      order.acceptedAt = now;
      order.freightBatchGroupId = batchId;
      order.routeGroup = order.routeGroup || `${cityKey(getPickupCity(order))}-${cityKey(getDeliveryCity(order))}`;
      order.updatedAt = now;

      acceptedOrders.push(order);
    }

    return res.json({
      success: true,
      batchId,
      totalAccepted: acceptedOrders.length,
      acceptedOrders,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Unable to batch accept freight orders.",
    });
  }
});

/* =====================================================
   DRIVER ORDERS
===================================================== */

router.get("/driver/:driverId", async (req, res) => {
  try {
    const driverOrders = orders.filter(
      (item) => item.assignedDriverId === req.params.driverId
    );

    return res.json({
      success: true,
      orders: driverOrders,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Unable to get driver orders.",
    });
  }
});

/* =====================================================
   FREIGHT ORDERS
===================================================== */

router.get("/freight/:freightCarrierId", async (req, res) => {
  try {
    const freightOrders = orders.filter(
      (item) => item.assignedFreightCarrierId === req.params.freightCarrierId
    );

    return res.json({
      success: true,
      orders: freightOrders,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Unable to get freight orders.",
    });
  }
});

/* =====================================================
   GET ALL ORDERS
===================================================== */

router.get("/", async (req, res) => {
  try {
    return res.json({
      success: true,
      total: orders.length,
      orders,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Unable to get orders.",
    });
  }
});

/* =====================================================
   CREATE ORDER
===================================================== */

router.post("/", async (req, res) => {
  try {
    const now = new Date().toISOString();

    const pickupCity =
      req.body.pickupCity ||
      req.body.deliveryInfo?.pickupCity ||
      req.body.deliveryInfo?.farmCity ||
      "";

    const deliveryCity =
      req.body.deliveryCity ||
      req.body.deliveryInfo?.city ||
      req.body.deliveryInfo?.deliveryCity ||
      req.body.city ||
      "";

    const estimatedMiles =
      Number(req.body.estimatedMiles || 0) ||
      estimateMiles(pickupCity, deliveryCity);

    const order = {
      id: req.body.id || createOrderId(),

      customerEmail: req.body.customerEmail || "",
      customerName: req.body.customerName || "",
      customerPhone: req.body.customerPhone || "",

      items: Array.isArray(req.body.items) ? req.body.items : [],

      subtotal: Number(req.body.subtotal || 0),
      serviceFee: Number(req.body.serviceFee || 0),
      deliveryFee: Number(req.body.deliveryFee || 0),
      tip: Number(req.body.tip || 0),
      total: Number(req.body.total || 0),

      deliveryInfo: req.body.deliveryInfo || {},

      pickupAddress: req.body.pickupAddress || "",
      dropoffAddress: req.body.dropoffAddress || "",

      pickupCity,
      deliveryCity,
      estimatedMiles,

      city: req.body.city || deliveryCity || "",
      state: req.body.state || "",
      zipCode: req.body.zipCode || "",

      latitude: req.body.latitude || null,
      longitude: req.body.longitude || null,

      paymentStatus: req.body.paymentStatus || "PENDING",
      fulfillmentStatus: req.body.fulfillmentStatus || req.body.status || "NEW",

      orderType: req.body.orderType || "LOCAL_DELIVERY",

      assignedDriverId: req.body.assignedDriverId || "",
      assignedFreightCarrierId: req.body.assignedFreightCarrierId || "",

      acceptedBy: req.body.acceptedBy || "",
      acceptedAt: req.body.acceptedAt || null,

      driverBatchGroupId: req.body.driverBatchGroupId || "",
      freightBatchGroupId: req.body.freightBatchGroupId || "",
      routeGroup:
        req.body.routeGroup || `${cityKey(pickupCity)}-${cityKey(deliveryCity)}`,

      stripeSessionId: req.body.stripeSessionId || "",

      farmerSplits: Array.isArray(req.body.farmerSplits)
        ? req.body.farmerSplits
        : [],

      notes: req.body.notes || "",

      pickedUpAt: req.body.pickedUpAt || null,
      inTransitAt: req.body.inTransitAt || null,
      deliveredAt: req.body.deliveredAt || null,

      createdAt: req.body.createdAt || now,
      updatedAt: now,
    };

    orders.unshift(order);

    await notifyNearbyDrivers(order);
    await notifyNearbyFreight(order);

    return res.json({
      success: true,
      order,
    });
  } catch (error) {
    console.log("Create order error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to create order.",
    });
  }
});

/* =====================================================
   ACCEPT ORDER - PATCH
===================================================== */

router.patch("/:id/accept", async (req, res) => {
  try {
    const order = orders.find((item) => item.id === req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Order not found.",
      });
    }

    if (order.assignedDriverId || order.assignedFreightCarrierId) {
      return res.status(400).json({
        success: false,
        error: "Order is already assigned.",
      });
    }

    order.fulfillmentStatus = "ACCEPTED";
    order.acceptedBy = req.body.acceptedBy || req.body.assignedDriverName || "";
    order.acceptedAt = new Date().toISOString();

    order.assignedDriverId = req.body.driverId || "";
    order.assignedFreightCarrierId = req.body.freightCarrierId || "";

    order.updatedAt = new Date().toISOString();

    return res.json({
      success: true,
      order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Unable to accept order.",
    });
  }
});

/* =====================================================
   ACCEPT ORDER - POST
===================================================== */

router.post("/:id/accept", async (req, res) => {
  try {
    const order = orders.find((item) => item.id === req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Order not found.",
      });
    }

    if (order.assignedDriverId || order.assignedFreightCarrierId) {
      return res.status(400).json({
        success: false,
        error: "Order is already assigned.",
      });
    }

    order.fulfillmentStatus = "ACCEPTED";
    order.acceptedBy = req.body.acceptedBy || req.body.assignedDriverName || "";
    order.acceptedAt = new Date().toISOString();

    order.assignedDriverId = req.body.driverId || "";
    order.assignedFreightCarrierId = req.body.freightCarrierId || "";

    order.updatedAt = new Date().toISOString();

    return res.json({
      success: true,
      order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Unable to accept order.",
    });
  }
});

/* =====================================================
   UPDATE ORDER STATUS
===================================================== */

router.patch("/:id/status", async (req, res) => {
  try {
    const order = orders.find((item) => item.id === req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Order not found.",
      });
    }

    const newStatus = req.body.status || order.fulfillmentStatus;

    order.fulfillmentStatus = newStatus;
    order.paymentStatus = req.body.paymentStatus || order.paymentStatus;

    if (req.body.driverId) order.assignedDriverId = req.body.driverId;
    if (req.body.freightCarrierId) {
      order.assignedFreightCarrierId = req.body.freightCarrierId;
    }

    if (normalize(newStatus) === "picked_up") {
      order.pickedUpAt = new Date().toISOString();
    }

    if (normalize(newStatus) === "in_transit") {
      order.inTransitAt = new Date().toISOString();
    }

    if (normalize(newStatus) === "delivered") {
      order.deliveredAt = new Date().toISOString();
    }

    order.updatedAt = new Date().toISOString();

    return res.json({
      success: true,
      orderId: req.params.id,
      order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Unable to update order status.",
    });
  }
});

/* =====================================================
   GET SINGLE ORDER - KEEP LAST
===================================================== */

router.get("/:id", async (req, res) => {
  try {
    const order = orders.find((item) => item.id === req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Order not found.",
      });
    }

    return res.json({
      success: true,
      order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Unable to get order.",
    });
  }
});

module.exports = router;