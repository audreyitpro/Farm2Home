// backend/services/marketplacePayoutService.js

const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    realtime: {
      transport: ws,
    },
  }
);

function toCents(value) {
  return Math.round(Number(value || 0) * 100);
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/* =====================================================
   CREATE FARMER TRANSFERS
===================================================== */

async function createFarmerTransfers({
  orderId,
  paymentIntentId,
  farmerSplits,
}) {
  const completedTransfers = [];

  for (const split of farmerSplits || []) {
    const farmerStripeAccountId =
      split.farmerStripeAccountId;

    const amountCents = safeNumber(
      split.amountCents,
      0
    );

    if (!farmerStripeAccountId || amountCents <= 0) {
      continue;
    }

    try {
      const transfer = await stripe.transfers.create({
        amount: amountCents,
        currency: "usd",
        destination: farmerStripeAccountId,
        transfer_group: orderId,
        metadata: {
          orderId,
          paymentIntentId,
          farmName: split.farmName || "",
        },
      });

      completedTransfers.push({
        farmName: split.farmName || "",
        farmerStripeAccountId,
        amountCents,
        amountDollars: Number(
          (amountCents / 100).toFixed(2)
        ),
        transferId: transfer.id,
      });

      await supabase
        .from("marketplace_payouts")
        .insert([
          {
            order_id: orderId,
            payment_intent_id: paymentIntentId,
            stripe_transfer_id: transfer.id,
            farmer_stripe_account_id:
              farmerStripeAccountId,
            farm_name: split.farmName || "",
            payout_amount:
              Number(
                (amountCents / 100).toFixed(2)
              ),
            payout_status: "paid",
          },
        ]);
    } catch (error) {
      console.log(
        "Farmer transfer failed:",
        error.message
      );

      await supabase
        .from("marketplace_payouts")
        .insert([
          {
            order_id: orderId,
            payment_intent_id: paymentIntentId,
            farmer_stripe_account_id:
              farmerStripeAccountId,
            farm_name: split.farmName || "",
            payout_amount:
              Number(
                (amountCents / 100).toFixed(2)
              ),
            payout_status: "failed",
            error_message:
              error.message || "Transfer failed",
          },
        ]);
    }
  }

  return completedTransfers;
}

/* =====================================================
   INVENTORY DECREMENT
===================================================== */

async function decrementMarketplaceInventory(cart) {
  if (!Array.isArray(cart)) return;

  for (const item of cart) {
    try {
      const productId =
        item.id ||
        item.productId ||
        item.product_id;

      const quantityPurchased = safeNumber(
        item.quantity,
        1
      );

      if (!productId) continue;

      const { data: existingProduct } =
        await supabase
          .from("products")
          .select("*")
          .eq("id", productId)
          .maybeSingle();

      if (!existingProduct) continue;

      const currentInventory = safeNumber(
        existingProduct.inventory_count,
        0
      );

      const updatedInventory =
        currentInventory - quantityPurchased;

      const finalInventory =
        updatedInventory < 0
          ? 0
          : updatedInventory;

      const inventoryStatus =
        finalInventory <= 0
          ? "out_of_stock"
          : finalInventory <=
            safeNumber(
              existingProduct.low_stock_threshold,
              5
            )
          ? "low_stock"
          : "in_stock";

      await supabase
        .from("products")
        .update({
          inventory_count: finalInventory,
          inventory_status: inventoryStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", productId);

      if (inventoryStatus === "low_stock") {
        console.log(
          `LOW STOCK ALERT: ${existingProduct.name}`
        );
      }

      if (inventoryStatus === "out_of_stock") {
        console.log(
          `OUT OF STOCK: ${existingProduct.name}`
        );
      }
    } catch (error) {
      console.log(
        "Inventory decrement error:",
        error.message
      );
    }
  }
}

module.exports = {
  createFarmerTransfers,
  decrementMarketplaceInventory,
};