const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");

const {
  releaseDeliveryPayout,
} = require("../services/deliveryPayoutService");

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    realtime: { transport: ws },
  }
);

router.post("/confirm-delivery-and-release-payout", async (req, res) => {
  try {
    const {
      orderId,
      loadId,
      driverId,
      customerId,
      farmerId,
      proofOfDeliveryUrl,
      receiverName,
      deliveryNotes,
      paymentIntentId,
      farmerSplits,
    } = req.body;

    if (!orderId || !paymentIntentId || !Array.isArray(farmerSplits)) {
      return res.status(400).json({
        success: false,
        error: "orderId, paymentIntentId, and farmerSplits are required.",
      });
    }

    const deliveredAt = new Date().toISOString();

    await supabase.from("delivery_confirmations").insert([
      {
        order_id: orderId,
        load_id: loadId || "",
        driver_id: driverId || "",
        customer_id: customerId || "",
        farmer_id: farmerId || "",
        delivery_status: "completed",
        proof_of_delivery_url: proofOfDeliveryUrl || "",
        receiver_name: receiverName || "",
        delivery_notes: deliveryNotes || "",
        delivered_at: deliveredAt,
      },
    ]);

    const payoutResult = await releaseDeliveryPayout({
      orderId,
      paymentIntentId,
      farmerSplits,
    });

    if (!payoutResult.success) {
      return res.status(500).json({
        success: false,
        error: payoutResult.error,
      });
    }

    return res.json({
      success: true,
      message: "Delivery confirmed and farmer payout released.",
      transfers: payoutResult.transfers,
    });
  } catch (error) {
    console.log("Confirm delivery payout error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to release delivery payout.",
    });
  }
});

module.exports = router;