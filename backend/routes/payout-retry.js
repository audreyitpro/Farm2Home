const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");

const {
  createFarmerTransfers,
} = require("../services/marketplacePayoutService");

const router = express.Router();

const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          realtime: { transport: ws },
        }
      )
    : null;

router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Payout retry routes running",
    supabaseConfigured: Boolean(supabase),
  });
});

router.post("/retry-failed-payout", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: "Supabase is not configured.",
      });
    }

    const { payoutId, paymentIntentId } = req.body;

    if (!payoutId || !paymentIntentId) {
      return res.status(400).json({
        success: false,
        error: "payoutId and paymentIntentId are required.",
      });
    }

    const { data: payout, error } = await supabase
      .from("marketplace_payouts")
      .select("*")
      .eq("id", payoutId)
      .maybeSingle();

    if (error) throw error;

    if (!payout) {
      return res.status(404).json({
        success: false,
        error: "Payout record not found.",
      });
    }

    if (payout.payout_status === "paid") {
      return res.json({
        success: true,
        message: "Payout already paid.",
        payout,
      });
    }

    const transfers = await createFarmerTransfers({
      orderId: payout.order_id,
      paymentIntentId,
      farmerSplits: [
        {
          farmerStripeAccountId: payout.farmer_stripe_account_id,
          farmName: payout.farm_name,
          amountCents: Math.round(Number(payout.payout_amount || 0) * 100),
        },
      ],
    });

    return res.json({
      success: true,
      message: "Payout retry processed.",
      transfers,
    });
  } catch (error) {
    console.log("Retry failed payout error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to retry payout.",
    });
  }
});

module.exports = router;