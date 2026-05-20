// backend/services/marketplacePayoutService.js

const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

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

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function insertPayoutLedger(row) {
  if (!supabase) return;

  const { error } = await supabase.from("marketplace_payouts").insert([row]);

  if (error) {
    console.log("marketplace_payouts insert error:", error.message);
  }
}

/* =====================================================
   CREATE FARMER TRANSFERS
===================================================== */

async function createFarmerTransfers({ orderId, paymentIntentId, farmerSplits }) {
  const completedTransfers = [];

  if (!stripe) {
    console.log("Stripe not configured. Skipping farmer transfers.");
    return completedTransfers;
  }

  if (!supabase) {
    console.log("Supabase not configured. Transfers can still run, but ledger will not save.");
  }

  for (const split of farmerSplits || []) {
    const farmerStripeAccountId = split.farmerStripeAccountId;
    const amountCents = safeNumber(split.amountCents, 0);

    if (!farmerStripeAccountId || amountCents <= 0) continue;

    try {
      const transfer = await stripe.transfers.create({
        amount: amountCents,
        currency: "usd",
        destination: farmerStripeAccountId,
        transfer_group: orderId,
        metadata: {
          orderId: orderId || "",
          paymentIntentId: paymentIntentId || "",
          farmName: split.farmName || "",
          type: "farm2home_farmer_payout",
        },
      });

      const payoutRow = {
        order_id: orderId || "",
        payment_intent_id: paymentIntentId || "",
        stripe_transfer_id: transfer.id,
        farmer_stripe_account_id: farmerStripeAccountId,
        farm_name: split.farmName || "",
        payout_amount: Number((amountCents / 100).toFixed(2)),
        payout_status: "paid",
      };

      await insertPayoutLedger(payoutRow);

      completedTransfers.push({
        farmName: split.farmName || "",
        farmerStripeAccountId,
        amountCents,
        amountDollars: Number((amountCents / 100).toFixed(2)),
        transferId: transfer.id,
      });
    } catch (error) {
      console.log("Farmer transfer failed:", error.message);

      await insertPayoutLedger({
        order_id: orderId || "",
        payment_intent_id: paymentIntentId || "",
        farmer_stripe_account_id: farmerStripeAccountId,
        farm_name: split.farmName || "",
        payout_amount: Number((amountCents / 100).toFixed(2)),
        payout_status: "failed",
        error_message: error.message || "Transfer failed",
      });
    }
  }

  return completedTransfers;
}

/* =====================================================
   INVENTORY DECREMENT
===================================================== */

async function decrementMarketplaceInventory(cart) {
  if (!supabase) {
    console.log("Supabase not configured. Skipping inventory decrement.");
    return;
  }

  if (!Array.isArray(cart)) return;

  for (const item of cart) {
    try {
      const productId = item.id || item.productId || item.product_id;
      const quantityPurchased = safeNumber(item.quantity, 1);

      if (!productId) continue;

      const { data: existingProduct, error: selectError } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .maybeSingle();

      if (selectError) {
        console.log("Inventory product lookup error:", selectError.message);
        continue;
      }

      if (!existingProduct) continue;

      const currentInventory = safeNumber(existingProduct.inventory_count, 0);
      const finalInventory = Math.max(currentInventory - quantityPurchased, 0);

      const inventoryStatus =
        finalInventory <= 0
          ? "out_of_stock"
          : finalInventory <= safeNumber(existingProduct.low_stock_threshold, 5)
          ? "low_stock"
          : "in_stock";

      const { error: updateError } = await supabase
        .from("products")
        .update({
          inventory_count: finalInventory,
          inventory_status: inventoryStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", productId);

      if (updateError) {
        console.log("Inventory update error:", updateError.message);
      }
    } catch (error) {
      console.log("Inventory decrement error:", error.message);
    }
  }
}

module.exports = {
  createFarmerTransfers,
  decrementMarketplaceInventory,
};