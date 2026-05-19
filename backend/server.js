require("dotenv").config();

const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");
const fetch = require("node-fetch");

const ordersRoutes = require("./routes/orders");
const paymentsRoutes = require("./routes/payments");
const chatRoutes = require("./routes/chat");
const freightRoutes = require("./routes/freight");
const driverRoutes = require("./routes/driver");
const stripeWebhookRoutes = require("./routes/stripe-webhooks");

const app = express();

const PORT = process.env.PORT || 4242;

const APP_URL = process.env.APP_URL || "https://farm2home-rho.vercel.app";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.API_BASE_URL ||
  "https://farm2home-production-e4bd.up.railway.app";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.warn("WARNING: STRIPE_SECRET_KEY missing in backend .env");
}

const stripe = STRIPE_SECRET_KEY ? Stripe(STRIPE_SECRET_KEY) : null;
const pendingStripeSplits = new Map();

/* =====================================================
   HELPERS
===================================================== */

function requireStripe(res) {
  if (!stripe) {
    res.status(500).json({
      success: false,
      error: "STRIPE_SECRET_KEY missing in backend environment.",
    });
    return false;
  }

  return true;
}

function toCents(value) {
  return Math.round(Number(value || 0) * 100);
}

function appendQueryParams(baseUrl, params) {
  const url = new URL(baseUrl);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

function getConnectRefreshUrl() {
  return (
    process.env.STRIPE_CONNECT_REFRESH_URL ||
    `${APP_URL}/farmer/compliance-upload`
  );
}

function getConnectReturnUrl() {
  return (
    process.env.STRIPE_CONNECT_RETURN_URL ||
    `${APP_URL}/farmer/compliance-upload?stripeReturn=true`
  );
}

function groupCartByFarmerStripeAccount(cart) {
  const grouped = {};

  cart.forEach((item) => {
    const accountId = item.farmerStripeAccountId || item.stripeAccountId;

    if (!accountId) {
      throw new Error(
        `Missing farmerStripeAccountId for item: ${item.name || item.id}`
      );
    }

    if (!grouped[accountId]) {
      grouped[accountId] = {
        farmerStripeAccountId: accountId,
        farmerName: item.farmName || item.farmerName || "Farm",
        items: [],
        subtotal: 0,
      };
    }

    const lineTotal = Number(item.price || 0) * Number(item.quantity || 1);

    grouped[accountId].items.push(item);
    grouped[accountId].subtotal += lineTotal;
  });

  return Object.values(grouped);
}

/* =====================================================
   CORS
===================================================== */

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "stripe-signature"],
  })
);

/* =====================================================
   STRIPE WEBHOOK ROUTE
   MUST STAY BEFORE express.json()
===================================================== */

app.use("/stripe", stripeWebhookRoutes);

/* =====================================================
   JSON MIDDLEWARE
===================================================== */

app.use(express.json({ limit: "10mb" }));

/* =====================================================
   HEALTH
===================================================== */

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Farm2Home Backend Running",
    environment: process.env.NODE_ENV || "production",
    appUrl: APP_URL,
    apiBaseUrl: API_BASE_URL,
  });
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    uptime: process.uptime(),
    stripeConfigured: Boolean(STRIPE_SECRET_KEY),
    webhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    appUrl: APP_URL,
    apiBaseUrl: API_BASE_URL,
    driverRoutesMounted: true,
    stripeWebhookMounted: true,
  });
});

/* =====================================================
   FARMER STRIPE CONNECT
===================================================== */

app.post("/create-farmer-stripe-account", async (req, res) => {
  try {
    if (!requireStripe(res)) return;

    const { farmerId, email, farmName, existingStripeAccountId } = req.body;

    if (!farmerId || !email) {
      return res.status(400).json({
        success: false,
        error: "Missing farmerId or email.",
      });
    }

    let accountId = existingStripeAccountId || "";

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        email,
        business_type: "individual",
        capabilities: {
          transfers: {
            requested: true,
          },
        },
        metadata: {
          farmerId,
          farmName: farmName || "",
          platform: "farm2home",
        },
      });

      accountId = account.id;

      console.log("Stripe connected account created:", {
        farmerId,
        accountId,
      });
    }

    const refreshUrl = appendQueryParams(getConnectRefreshUrl(), {
      stripeReturn: "false",
      farmerId,
      accountId,
    });

    const returnUrl = appendQueryParams(getConnectReturnUrl(), {
      stripeReturn: "true",
      farmerId,
      accountId,
    });

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return res.json({
      success: true,
      accountId,
      url: accountLink.url,
    });
  } catch (error) {
    console.log("Create farmer Stripe account error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to create Stripe onboarding link.",
    });
  }
});

app.get("/farmer-stripe-account-status/:accountId", async (req, res) => {
  try {
    if (!requireStripe(res)) return;

    const { accountId } = req.params;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: "Missing Stripe account ID.",
      });
    }

    const account = await stripe.accounts.retrieve(accountId, {
      expand: ["external_accounts"],
    });

    const bankAccount = account.external_accounts?.data?.find(
      (item) => item.object === "bank_account"
    );

    const bankName = bankAccount?.bank_name || "";
    const last4 = bankAccount?.last4 || "";

    const payoutAccountName =
      bankName && last4
        ? `${bankName} ending in ${last4}`
        : account.details_submitted
        ? "Stripe onboarding submitted"
        : "Stripe payout account pending";

    return res.json({
      success: true,
      accountId,
      onboardingComplete: account.details_submitted === true,
      chargesEnabled: account.charges_enabled === true,
      payoutsEnabled: account.payouts_enabled === true,
      stripePayoutAccount: payoutAccountName,
      stripePayoutBankName: bankName,
      stripePayoutAccountLast4: last4,
    });
  } catch (error) {
    console.log("Retrieve Stripe account status error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to retrieve Stripe account status.",
    });
  }
});

/* =====================================================
   MARKETPLACE CHECKOUT
===================================================== */

app.post("/create-marketplace-checkout", async (req, res) => {
  try {
    if (!requireStripe(res)) return;

    const {
      cart,
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
      customerEmail,
    } = req.body;

    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Cart is required.",
      });
    }

    const orderId = cloudOrderId || `farm2home_order_${Date.now()}`;
    const farmerGroups = groupCartByFarmerStripeAccount(cart);

    const farmerSplits = farmerGroups.map((group) => ({
      farmerStripeAccountId: group.farmerStripeAccountId,
      farmerName: group.farmerName,
      amountCents: toCents(group.subtotal),
      subtotal: Number(group.subtotal.toFixed(2)),
      itemNames: group.items.map((item) => item.name),
    }));

    const lineItems = cart.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: `${item.name} - ${item.farmName || item.farmerName || "Farm"}`,
          metadata: {
            farmName: item.farmName || item.farmerName || "Farm",
            farmerStripeAccountId:
              item.farmerStripeAccountId || item.stripeAccountId || "",
          },
        },
        unit_amount: toCents(item.price),
      },
      quantity: Number(item.quantity || 1),
    }));

    const feeItems = [];

    if (Number(serviceFee || 0) > 0) {
      feeItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Farm2Home Marketplace Service Fee",
          },
          unit_amount: toCents(serviceFee),
        },
        quantity: 1,
      });
    }

    if (Number(deliveryFee || 0) > 0) {
      feeItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Farm2Home Delivery Fee",
          },
          unit_amount: toCents(deliveryFee),
        },
        quantity: 1,
      });
    }

    if (Number(tip || 0) > 0) {
      feeItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Farm2Home Tip",
          },
          unit_amount: toCents(tip),
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: customerEmail || undefined,
      line_items: [...lineItems, ...feeItems],
      payment_intent_data: {
        transfer_group: orderId,
        metadata: {
          orderId,
          deliveryOption: deliveryOption || "",
        },
      },
      metadata: {
        orderId,
        type: "farm2home_marketplace_checkout",
      },
      success_url:
        process.env.CHECKOUT_SUCCESS_URL ||
        `${APP_URL}/customer/subscription-success`,
      cancel_url: process.env.CHECKOUT_CANCEL_URL || `${APP_URL}/customer/cart`,
    });

    pendingStripeSplits.set(session.id, {
      orderId,
      sessionId: session.id,
      farmerSplits,
      subtotal: Number(subtotal || 0),
      serviceFee: Number(serviceFee || 0),
      deliveryFee: Number(deliveryFee || 0),
      tip: Number(tip || 0),
      total: Number(total || 0),
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

    return res.json({
      success: true,
      url: session.url,
      sessionId: session.id,
      orderId,
      farmerSplits,
    });
  } catch (error) {
    console.log("Create marketplace checkout error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to create marketplace checkout.",
    });
  }
});

/* =====================================================
   GOOGLE DISTANCE MATRIX
===================================================== */

app.post("/calculate-distance", async (req, res) => {
  try {
    const { pickupLocation, dropoffLocation } = req.body;

    if (!pickupLocation || !dropoffLocation) {
      return res.status(400).json({
        success: false,
        error: "Pickup and dropoff locations are required.",
      });
    }

    const apiKey =
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "GOOGLE_MAPS_API_KEY missing in backend .env file.",
      });
    }

    const origin = encodeURIComponent(pickupLocation);
    const destination = encodeURIComponent(dropoffLocation);

    const url =
      `https://maps.googleapis.com/maps/api/distancematrix/json` +
      `?origins=${origin}` +
      `&destinations=${destination}` +
      `&units=imperial` +
      `&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    const element = data?.rows?.[0]?.elements?.[0];

    if (data?.status !== "OK") {
      return res.status(400).json({
        success: false,
        error:
          data?.error_message ||
          `Google API status: ${data?.status || "Unknown"}`,
      });
    }

    if (element?.status !== "OK") {
      return res.status(400).json({
        success: false,
        error: `Route status: ${element?.status || "Unknown"}`,
      });
    }

    const meters = Number(element?.distance?.value || 0);
    const miles = meters / 1609.344;

    return res.json({
      success: true,
      miles: Number(miles.toFixed(1)),
      distanceText: element?.distance?.text || `${miles.toFixed(1)} mi`,
      durationText: element?.duration?.text || "",
    });
  } catch (error) {
    console.log("Distance Calculation Error:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Unable to calculate distance.",
    });
  }
});

/* =====================================================
   ROUTES
===================================================== */

app.use("/orders", ordersRoutes);
app.use("/payments", paymentsRoutes);
app.use("/chat", chatRoutes);
app.use("/freight", freightRoutes);
app.use("/driver", driverRoutes);

/* =====================================================
   404 HANDLER
===================================================== */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found.",
    path: req.originalUrl,
  });
});

/* =====================================================
   SERVER START
===================================================== */

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Farm2Home backend running on port ${PORT}`);
  console.log(`Production API URL: ${API_BASE_URL}`);
});