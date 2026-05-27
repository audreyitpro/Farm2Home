// backend/routes/orders.js

const express = require("express");

const router = express.Router();

const orders = [];

function createOrderId() {
  return `order_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/* =====================================================
   EXPO PUSH NOTIFICATIONS
===================================================== */

async function sendExpoPushNotification(
  pushToken,
  title,
  body,
  data = {}
) {
  try {
    if (
      !pushToken ||
      !String(pushToken).startsWith("ExponentPushToken")
    ) {
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
    console.log(
      "sendExpoPushNotification error:",
      error
    );
  }
}

/* =====================================================
   DRIVER NOTIFICATIONS
===================================================== */

async function notifyNearbyDrivers(order) {
  try {
    const drivers = global.drivers || [];

    const activeDrivers = drivers.filter((driver) => {
      const membershipStatus = String(
        driver.membershipStatus || "Active"
      ).toLowerCase();

      const subscriptionStatus = String(
        driver.subscriptionStatus || "active"
      ).toLowerCase();

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
          route: "/driver/mobile-driver-app",
        }
      );
    }

    console.log(
      `Driver notifications sent: ${activeDrivers.length}`
    );
  } catch (error) {
    console.log(
      "notifyNearbyDrivers error:",
      error
    );
  }
}

/* =====================================================
   FREIGHT NOTIFICATIONS
===================================================== */

async function notifyNearbyFreight(order) {
  try {
    const freightCarriers =
      global.freightCarriers || [];

    const activeCarriers =
      freightCarriers.filter((carrier) => {
        const membershipStatus = String(
          carrier.membershipStatus || "Active"
        ).toLowerCase();

        const subscriptionStatus = String(
          carrier.subscriptionStatus || "active"
        ).toLowerCase();

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

    console.log(
      `Freight notifications sent: ${activeCarriers.length}`
    );
  } catch (error) {
    console.log(
      "notifyNearbyFreight error:",
      error
    );
  }
}

/* =====================================================
   GET ALL ORDERS
===================================================== */

router.get("/", async (req, res) => {
  try {
    return res.json({
      success: true,
      orders,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error:
        error.message || "Unable to get orders.",
    });
  }
});

/* =====================================================
   GET SINGLE ORDER
===================================================== */

router.get("/:id", async (req, res) => {
  try {
    const order = orders.find(
      (item) => item.id === req.params.id
    );

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
      error:
        error.message || "Unable to get order.",
    });
  }
});

/* =====================================================
   CREATE ORDER
===================================================== */

router.post("/", async (req, res) => {
  try {
    const now = new Date().toISOString();

    const order = {
      id:
        req.body.id || createOrderId(),

      customerEmail:
        req.body.customerEmail || "",

      customerName:
        req.body.customerName || "",

      customerPhone:
        req.body.customerPhone || "",

      items: Array.isArray(req.body.items)
        ? req.body.items
        : [],

      subtotal: Number(
        req.body.subtotal || 0
      ),

      serviceFee: Number(
        req.body.serviceFee || 0
      ),

      deliveryFee: Number(
        req.body.deliveryFee || 0
      ),

      tip: Number(req.body.tip || 0),

      total: Number(req.body.total || 0),

      deliveryInfo:
        req.body.deliveryInfo || {},

      pickupAddress:
        req.body.pickupAddress || "",

      dropoffAddress:
        req.body.dropoffAddress || "",

      city:
        req.body.city || "",

      state:
        req.body.state || "",

      zipCode:
        req.body.zipCode || "",

      latitude:
        req.body.latitude || null,

      longitude:
        req.body.longitude || null,

      paymentStatus:
        req.body.paymentStatus ||
        "PENDING",

      fulfillmentStatus:
        req.body.fulfillmentStatus ||
        "NEW",

      orderType:
        req.body.orderType ||
        "LOCAL_DELIVERY",

      assignedDriverId:
        req.body.assignedDriverId || "",

      assignedFreightCarrierId:
        req.body.assignedFreightCarrierId ||
        "",

      acceptedBy:
        req.body.acceptedBy || "",

      acceptedAt:
        req.body.acceptedAt || null,

      stripeSessionId:
        req.body.stripeSessionId || "",

      farmerSplits: Array.isArray(
        req.body.farmerSplits
      )
        ? req.body.farmerSplits
        : [],

      notes:
        req.body.notes || "",

      createdAt:
        req.body.createdAt || now,

      updatedAt: now,
    };

    orders.unshift(order);

    /* =====================================================
       SEND REAL-TIME NOTIFICATIONS
    ===================================================== */

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
      error:
        error.message ||
        "Unable to create order.",
    });
  }
});

/* =====================================================
   ACCEPT ORDER
===================================================== */

router.patch("/:id/accept", async (req, res) => {
  try {
    const order = orders.find(
      (item) => item.id === req.params.id
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Order not found.",
      });
    }

    order.fulfillmentStatus = "ACCEPTED";

    order.acceptedBy =
      req.body.acceptedBy || "";

    order.acceptedAt =
      new Date().toISOString();

    order.assignedDriverId =
      req.body.driverId || "";

    order.assignedFreightCarrierId =
      req.body.freightCarrierId || "";

    order.updatedAt =
      new Date().toISOString();

    return res.json({
      success: true,
      order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Unable to accept order.",
    });
  }
});

/* =====================================================
   UPDATE ORDER STATUS
===================================================== */

router.patch("/:id/status", async (req, res) => {
  try {
    const order = orders.find(
      (item) => item.id === req.params.id
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Order not found.",
      });
    }

    order.fulfillmentStatus =
      req.body.status ||
      order.fulfillmentStatus;

    order.paymentStatus =
      req.body.paymentStatus ||
      order.paymentStatus;

    order.updatedAt =
      new Date().toISOString();

    return res.json({
      success: true,
      orderId: req.params.id,
      order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Unable to update order status.",
    });
  }
});

/* =====================================================
   DRIVER ORDERS
===================================================== */

router.get("/driver/:driverId", async (req, res) => {
  try {
    const driverOrders = orders.filter(
      (item) =>
        item.assignedDriverId ===
        req.params.driverId
    );

    return res.json({
      success: true,
      orders: driverOrders,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Unable to get driver orders.",
    });
  }
});

/* =====================================================
   FREIGHT ORDERS
===================================================== */

router.get(
  "/freight/:freightCarrierId",
  async (req, res) => {
    try {
      const freightOrders =
        orders.filter(
          (item) =>
            item.assignedFreightCarrierId ===
            req.params.freightCarrierId
        );

      return res.json({
        success: true,
        orders: freightOrders,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error:
          error.message ||
          "Unable to get freight orders.",
      });
    }
  }
);

module.exports = router;