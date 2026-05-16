// backend/routes/orders.js

const express = require("express");

const router = express.Router();

const orders = [];

function createOrderId() {
  return `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

router.get("/", async (req, res) => {
  try {
    return res.json({
      success: true,
      orders,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unable to get orders.",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const order = orders.find((item) => item.id === req.params.id);

    if (!order) {
      return res.status(404).json({
        error: "Order not found.",
      });
    }

    return res.json({
      success: true,
      order,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unable to get order.",
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const now = new Date().toISOString();

    const order = {
      id: req.body.id || createOrderId(),
      customerEmail: req.body.customerEmail || "",
      customerName: req.body.customerName || "",
      items: Array.isArray(req.body.items) ? req.body.items : [],
      subtotal: Number(req.body.subtotal || 0),
      serviceFee: Number(req.body.serviceFee || 0),
      deliveryFee: Number(req.body.deliveryFee || 0),
      tip: Number(req.body.tip || 0),
      total: Number(req.body.total || 0),
      deliveryInfo: req.body.deliveryInfo || {},
      paymentStatus: req.body.paymentStatus || "PENDING",
      fulfillmentStatus: req.body.fulfillmentStatus || "NEW",
      stripeSessionId: req.body.stripeSessionId || "",
      farmerSplits: Array.isArray(req.body.farmerSplits)
        ? req.body.farmerSplits
        : [],
      createdAt: req.body.createdAt || now,
      updatedAt: now,
    };

    orders.unshift(order);

    return res.json({
      success: true,
      order,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unable to create order.",
    });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const order = orders.find((item) => item.id === req.params.id);

    if (!order) {
      return res.status(404).json({
        error: "Order not found.",
      });
    }

    order.fulfillmentStatus = req.body.status || order.fulfillmentStatus;
    order.paymentStatus = req.body.paymentStatus || order.paymentStatus;
    order.updatedAt = new Date().toISOString();

    return res.json({
      success: true,
      orderId: req.params.id,
      order,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unable to update order status.",
    });
  }
});

module.exports = router;