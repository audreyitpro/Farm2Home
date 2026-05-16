// backend/routes/payments.js

const express = require("express");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");

const router = express.Router();

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("WARNING: STRIPE_SECRET_KEY is missing from backend .env");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          realtime: {
            transport: ws,
          },
        }
      )
    : null;

const pendingMarketplaceSplits = new Map();
const completedMarketplaceTransfers = new Map();

function toCents(value) {
  return Math.round(Number(value || 0) * 100);
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getFarmerStripeAccountId(item) {
  return (
    item.farmerStripeAccountId ||
    item.stripeAccountId ||
    item.farmer_stripe_account_id ||
    ""
  );
}

function getFarmName(item) {
  return item.farmName || item.farmerName || item.farm_name || "Farm2Home Farm";
}

function groupCartByFarmer(cart) {
  const grouped = {};

  cart.forEach((item) => {
    const farmerStripeAccountId = getFarmerStripeAccountId(item);

    if (!farmerStripeAccountId) {
      throw new Error(
        `Missing farmerStripeAccountId for cart item: ${item.name || item.id}`
      );
    }

    if (!grouped[farmerStripeAccountId]) {
      grouped[farmerStripeAccountId] = {
        farmerStripeAccountId,
        farmName: getFarmName(item),
        items: [],
        subtotal: 0,
      };
    }

    grouped[farmerStripeAccountId].items.push(item);
    grouped[farmerStripeAccountId].subtotal +=
      safeNumber(item.price, 0) * safeNumber(item.quantity, 1);
  });

  return Object.values(grouped);
}

async function rebuildFarmerSplitsFromStripeSession(sessionId) {
  const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
    limit: 100,
    expand: ["data.price.product"],
  });

  const grouped = {};

  for (const line of lineItems.data) {
    const product = line.price?.product;
    const metadata = product?.metadata || {};

    const farmerStripeAccountId = metadata.farmerStripeAccountId;
    const farmName = metadata.farmName || "Farm2Home Farm";
    const itemType = metadata.itemType || "";

    if (!farmerStripeAccountId || itemType === "farm2home_fee") {
      continue;
    }

    if (!grouped[farmerStripeAccountId]) {
      grouped[farmerStripeAccountId] = {
        farmerStripeAccountId,
        farmName,
        amountCents: 0,
        itemNames: [],
      };
    }

    grouped[farmerStripeAccountId].amountCents += Number(line.amount_total || 0);
    grouped[farmerStripeAccountId].itemNames.push(line.description || line.id);
  }

  return Object.values(grouped);
}

async function saveFarmerPayoutsToSupabase({ orderId, transfers }) {
  if (!supabase) {
    console.log("Supabase not configured. Skipping farmer_payouts save.");
    return;
  }

  const rows = transfers.map((transfer) => ({
    order_id: orderId,
    farmer_name: transfer.farmName,
    stripe_account_id: transfer.farmerStripeAccountId,
    stripe_transfer_id: transfer.transferId,
    gross_amount: transfer.amountDollars,
    platform_fee: 0,
    net_amount: transfer.amountDollars,
    payout_status: "TRANSFER_CREATED",
  }));

  const { error } = await supabase.from("farmer_payouts").insert(rows);

  if (error) {
    console.log("Supabase farmer_payouts insert error:", error);
  } else {
    console.log("Saved farmer payouts to Supabase:", rows);
  }
}

async function saveOrderToSupabase({
  orderId,
  sessionId,
  paymentIntentId,
  pendingData,
}) {
  if (!supabase || !pendingData) {
    console.log("Supabase/order pending data missing. Skipping orders save.");
    return;
  }

  const orderRow = {
    id: orderId,
    stripe_session_id: sessionId,
    stripe_payment_intent_id: paymentIntentId || "",
    customer_email: pendingData.customerEmail || "",
    customer_name: pendingData.deliveryInfo?.name || "",
    subtotal: safeNumber(pendingData.subtotal, 0),
    service_fee: safeNumber(pendingData.serviceFee, 0),
    delivery_fee: safeNumber(pendingData.deliveryFee, 0),
    tip: safeNumber(pendingData.tip, 0),
    total: safeNumber(pendingData.total, 0),
    payment_status: "PAID",
    fulfillment_status: "NEW",
  };

  const { error: orderError } = await supabase.from("orders").upsert([orderRow]);

  if (orderError) {
    console.log("Supabase orders insert error:", orderError);
  } else {
    console.log("Saved order to Supabase:", orderRow);
  }

  const orderItems = (pendingData.cart || []).map((item) => ({
    order_id: orderId,
    farmer_name: item.farmName || item.farmerName || "",
    farmer_email: item.farmerEmail || "",
    farmer_stripe_account_id:
      item.farmerStripeAccountId || item.stripeAccountId || "",
    product_id: item.id || "",
    product_name: item.name || "",
    quantity: safeNumber(item.quantity, 1),
    unit_price: safeNumber(item.price, 0),
    total_price: safeNumber(item.price, 0) * safeNumber(item.quantity, 1),
  }));

  if (orderItems.length > 0) {
    const { error: itemError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemError) {
      console.log("Supabase order_items insert error:", itemError);
    } else {
      console.log("Saved order items to Supabase:", orderItems);
    }
  }
}

async function createFarmerTransfersForSession(sessionId) {
  if (completedMarketplaceTransfers.has(sessionId)) {
    return {
      alreadyProcessed: true,
      ...completedMarketplaceTransfers.get(sessionId),
    };
  }

  const pendingData = pendingMarketplaceSplits.get(sessionId);

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent"],
  });

  if (session.payment_status !== "paid") {
    throw new Error(
      `Session is not paid. Current status: ${session.payment_status}`
    );
  }

  const orderId =
    session.metadata?.orderId ||
    session.payment_intent?.metadata?.orderId ||
    `order_${Date.now()}`;

  let farmerSplits = pendingData?.farmerSplits;

  if (!farmerSplits || farmerSplits.length === 0) {
    farmerSplits = await rebuildFarmerSplitsFromStripeSession(sessionId);
  }

  if (!farmerSplits || farmerSplits.length === 0) {
    throw new Error("No farmer splits found for this checkout session.");
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"],
  });

  const chargeId =
    paymentIntent.latest_charge?.id || paymentIntent.latest_charge;

  if (!chargeId) {
    throw new Error("Unable to locate Stripe charge for this payment.");
  }

  const transfers = [];

  for (const split of farmerSplits) {
    const amountCents = Number(split.amountCents || 0);

    if (!split.farmerStripeAccountId || amountCents <= 0) {
      continue;
    }

    const transfer = await stripe.transfers.create({
      amount: amountCents,
      currency: "usd",
      destination: split.farmerStripeAccountId,
      transfer_group: orderId,
      source_transaction: chargeId,
      metadata: {
        orderId,
        farmName: split.farmName || split.farmerName || "Farm2Home Farm",
        type: "farm2home_farmer_payout",
        sessionId,
      },
    });

    transfers.push({
      farmName: split.farmName || split.farmerName || "Farm2Home Farm",
      farmerStripeAccountId: split.farmerStripeAccountId,
      amountCents,
      amountDollars: Number((amountCents / 100).toFixed(2)),
      transferId: transfer.id,
    });
  }

  await saveFarmerPayoutsToSupabase({
    orderId,
    transfers,
  });

  await saveOrderToSupabase({
    orderId,
    sessionId,
    paymentIntentId,
    pendingData,
  });

  const result = {
    orderId,
    transfers,
  };

  completedMarketplaceTransfers.set(sessionId, result);
  pendingMarketplaceSplits.delete(sessionId);

  return {
    alreadyProcessed: false,
    ...result,
  };
}

router.post("/create-marketplace-checkout", async (req, res) => {
  try {
    const {
      cart,
      customerEmail,
      subtotal,
      serviceFee,
      deliveryFee,
      tip,
      total,
      deliveryOption,
      deliveryAddress,
      city,
      state,
      zipCode,
      phone,
      deliveryInstructions,
      cloudOrderId,
      successUrl,
      cancelUrl,
    } = req.body;

    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({
        error: "Cart is required.",
      });
    }

    const orderId = cloudOrderId || `order_${Date.now()}`;
    const farmerGroups = groupCartByFarmer(cart);

    const farmerSplits = farmerGroups.map((group) => ({
      farmerStripeAccountId: group.farmerStripeAccountId,
      farmName: group.farmName,
      subtotal: Number(group.subtotal.toFixed(2)),
      amountCents: toCents(group.subtotal),
      itemNames: group.items.map((item) => item.name || item.id),
    }));

    const lineItems = cart.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: `${item.name || "Farm Product"} - ${getFarmName(item)}`,
          metadata: {
            farmName: getFarmName(item),
            farmerStripeAccountId: getFarmerStripeAccountId(item),
            itemType: "farmer_product",
          },
        },
        unit_amount: toCents(item.price),
      },
      quantity: safeNumber(item.quantity, 1),
    }));

    const fees = [];

    if (safeNumber(serviceFee, 0) > 0) {
      fees.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Farm2Home Marketplace Service Fee",
            metadata: {
              itemType: "farm2home_fee",
            },
          },
          unit_amount: toCents(serviceFee),
        },
        quantity: 1,
      });
    }

    if (safeNumber(deliveryFee, 0) > 0) {
      fees.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Farm2Home Delivery Fee",
            metadata: {
              itemType: "farm2home_fee",
            },
          },
          unit_amount: toCents(deliveryFee),
        },
        quantity: 1,
      });
    }

    if (safeNumber(tip, 0) > 0) {
      fees.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Farm2Home Tip",
            metadata: {
              itemType: "farm2home_fee",
            },
          },
          unit_amount: toCents(tip),
        },
        quantity: 1,
      });
    }

    const checkoutSuccessUrl =
      successUrl ||
      "http://localhost:8081/customer/subscription-success?session_id={CHECKOUT_SESSION_ID}";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: customerEmail || undefined,
      line_items: [...lineItems, ...fees],
      payment_intent_data: {
        transfer_group: orderId,
        metadata: {
          orderId,
          type: "farm2home_marketplace_payment",
        },
      },
      metadata: {
        orderId,
        type: "farm2home_marketplace_checkout",
        farmerSplitCount: String(farmerSplits.length),
      },
      success_url: checkoutSuccessUrl,
      cancel_url: cancelUrl || "http://localhost:8081/customer/cart",
    });

    pendingMarketplaceSplits.set(session.id, {
      orderId,
      sessionId: session.id,
      farmerSplits,
      cart,
      customerEmail: customerEmail || "",
      subtotal: safeNumber(subtotal, 0),
      serviceFee: safeNumber(serviceFee, 0),
      deliveryFee: safeNumber(deliveryFee, 0),
      tip: safeNumber(tip, 0),
      total: safeNumber(total, 0),
      deliveryInfo: {
        deliveryOption,
        deliveryAddress,
        city,
        state,
        zipCode,
        phone,
        deliveryInstructions,
      },
      createdAt: new Date().toISOString(),
    });

    console.log("Marketplace checkout created:", {
      orderId,
      sessionId: session.id,
      farmerSplits,
      successUrl: checkoutSuccessUrl,
    });

    return res.json({
      success: true,
      id: session.id,
      sessionId: session.id,
      url: session.url,
      orderId,
      farmerSplits,
    });
  } catch (error) {
    console.log("Create marketplace checkout error:", error);

    return res.status(500).json({
      error: error.message || "Unable to create marketplace checkout.",
    });
  }
});

router.post("/confirm-marketplace-payment", async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: "sessionId is required.",
      });
    }

    const result = await createFarmerTransfersForSession(sessionId);

    return res.json({
      success: true,
      sessionId,
      alreadyProcessed: result.alreadyProcessed,
      orderId: result.orderId,
      transfers: result.transfers,
    });
  } catch (error) {
    console.log("Confirm marketplace payment error:", error);

    return res.status(500).json({
      error: error.message || "Unable to confirm marketplace payment.",
    });
  }
});

router.post("/create-farmer-connect-account", async (req, res) => {
  try {
    const { email, farmName, farmerId } = req.body;

    if (!email || !farmName) {
      return res.status(400).json({
        error: "email and farmName are required.",
      });
    }

    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      email,
      business_type: "individual",
      capabilities: {
        card_payments: {
          requested: true,
        },
        transfers: {
          requested: true,
        },
      },
      business_profile: {
        name: farmName,
        product_description: "Farm2Home farmer marketplace seller",
      },
      metadata: {
        farmerId: farmerId || "",
        farmName,
        source: "farm2home",
      },
    });

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url:
        process.env.STRIPE_CONNECT_REFRESH_URL ||
        "http://localhost:8081/farmer/connect-bank",
      return_url:
        process.env.STRIPE_CONNECT_RETURN_URL ||
        "http://localhost:8081/farmer/connect-bank",
      type: "account_onboarding",
    });

    return res.json({
      success: true,
      stripeAccountId: account.id,
      onboardingUrl: accountLink.url,
    });
  } catch (error) {
    console.log("Create farmer connect account error:", error);

    return res.status(500).json({
      error: error.message || "Unable to create farmer Stripe account.",
    });
  }
});

router.post("/check-farmer-connect-account", async (req, res) => {
  try {
    const { stripeAccountId } = req.body;

    if (!stripeAccountId) {
      return res.status(400).json({
        error: "stripeAccountId is required.",
      });
    }

    const account = await stripe.accounts.retrieve(stripeAccountId);

    return res.json({
      success: true,
      stripeAccountId: account.id,
      chargesEnabled: Boolean(account.charges_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
      detailsSubmitted: Boolean(account.details_submitted),
      requirements: account.requirements || {},
    });
  } catch (error) {
    console.log("Check farmer connect account error:", error);

    return res.status(500).json({
      error: error.message || "Unable to check farmer Stripe account.",
    });
  }
});

router.post("/create-farmer-onboarding-link", async (req, res) => {
  try {
    const { stripeAccountId } = req.body;

    if (!stripeAccountId) {
      return res.status(400).json({
        error: "stripeAccountId is required.",
      });
    }

    await stripe.accounts.retrieve(stripeAccountId);

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url:
        process.env.STRIPE_CONNECT_REFRESH_URL ||
        "http://localhost:8081/farmer/connect-bank",
      return_url:
        process.env.STRIPE_CONNECT_RETURN_URL ||
        "http://localhost:8081/farmer/connect-bank",
      type: "account_onboarding",
    });

    return res.json({
      success: true,
      stripeAccountId,
      onboardingUrl: accountLink.url,
    });
  } catch (error) {
    console.log("Create farmer onboarding link error:", error);

    return res.status(500).json({
      error: error.message || "Unable to create onboarding link.",
    });
  }
});

router.post("/create-checkout-session", async (req, res) => {
  try {
    const { priceId, customerEmail, mode, successUrl, cancelUrl } = req.body;

    if (!priceId) {
      return res.status(400).json({
        error: "priceId is required.",
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: mode || "subscription",
      customer_email: customerEmail || undefined,
      success_url:
        successUrl || "http://localhost:8081/customer/payment-success",
      cancel_url: cancelUrl || "http://localhost:8081/customer/subscription",
    });

    return res.json({
      success: true,
      id: session.id,
      url: session.url,
    });
  } catch (error) {
    console.log("Create checkout session error:", error);

    return res.status(500).json({
      error: error.message || "Unable to create checkout session.",
    });
  }
});

router.post("/create-subscription-checkout", async (req, res) => {
  try {
    const { customerEmail, planType, successUrl, cancelUrl } = req.body;

    const priceId =
      planType === "farmer"
        ? process.env.STRIPE_FARMER_MEMBERSHIP_PRICE_ID
        : process.env.STRIPE_CUSTOMER_MEMBERSHIP_PRICE_ID;

    if (!priceId) {
      return res.status(500).json({
        error:
          planType === "farmer"
            ? "STRIPE_FARMER_MEMBERSHIP_PRICE_ID missing in .env."
            : "STRIPE_CUSTOMER_MEMBERSHIP_PRICE_ID missing in .env.",
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: customerEmail || undefined,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url:
        successUrl || "http://localhost:8081/customer/subscription-success",
      cancel_url: cancelUrl || "http://localhost:8081/customer/register",
      metadata: {
        type: "farm2home_membership",
        planType: planType || "customer",
      },
    });

    return res.json({
      success: true,
      id: session.id,
      url: session.url,
    });
  } catch (error) {
    console.log("Create subscription checkout error:", error);

    return res.status(500).json({
      error: error.message || "Unable to create subscription checkout.",
    });
  }
});

/**
 * FREIGHT SUBSCRIPTION CHECKOUT
 * Route used by Freight Register button:
 * POST http://localhost:4242/payments/create-freight-subscription-checkout
 */
router.post("/create-freight-subscription-checkout", async (req, res) => {
  try {
    const { customerEmail, successUrl, cancelUrl, name, username } = req.body;

    const priceId = process.env.STRIPE_FREIGHT_MEMBERSHIP_PRICE_ID;

    if (!priceId) {
      return res.status(500).json({
        error: "STRIPE_FREIGHT_MEMBERSHIP_PRICE_ID missing in backend .env.",
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: customerEmail || undefined,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url:
        successUrl || "http://localhost:8081/freight/subscription-success",
      cancel_url: cancelUrl || "http://localhost:8081/freight/register",
      metadata: {
        type: "farm2home_freight_membership",
        planType: "freight",
        role: "freight",
        name: name || "",
        username: username || "",
      },
    });

    return res.json({
      success: true,
      id: session.id,
      url: session.url,
    });
  } catch (error) {
    console.log("Create freight subscription checkout error:", error);

    return res.status(500).json({
      error: error.message || "Unable to create freight subscription checkout.",
    });
  }
});

router.post("/create-customer-portal", async (req, res) => {
  try {
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({
        error: "customerId is required.",
      });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: "http://localhost:8081",
    });

    return res.json({
      success: true,
      url: portalSession.url,
    });
  } catch (error) {
    console.log("Create customer portal error:", error);

    return res.status(500).json({
      error: error.message || "Unable to create customer portal.",
    });
  }
});

module.exports = router;