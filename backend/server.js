require("dotenv").config();

const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");
const fetch = require("node-fetch");

const ordersRoutes = require("./routes/orders");
const paymentsRoutes = require("./routes/payments");
const chatRoutes = require("./routes/chat");
const freightRoutes = require("./routes/freight");

const app = express();

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("WARNING: STRIPE_SECRET_KEY missing in backend .env");
}

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const pendingStripeSplits = new Map();

function toCents(value) {
  return Math.round(Number(value || 0) * 100);
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

async function handleStripeWebhook(req, res) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers["stripe-signature"],
        webhookSecret
      );
    } else {
      event = JSON.parse(req.body.toString());
    }
  } catch (error) {
    console.log("Stripe webhook signature error:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    console.log("Stripe webhook received:", event.type);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      console.log("Checkout completed:", {
        sessionId: session.id,
        customerEmail: session.customer_email,
        mode: session.mode,
        paymentStatus: session.payment_status,
        subscriptionId: session.subscription,
        metadata: session.metadata,
      });

      const splitData = pendingStripeSplits.get(session.id);

      if (splitData && session.payment_intent) {
        const paymentIntent = await stripe.paymentIntents.retrieve(
          session.payment_intent,
          {
            expand: ["latest_charge"],
          }
        );

        const chargeId =
          paymentIntent.latest_charge?.id || paymentIntent.latest_charge;

        for (const split of splitData.farmerSplits) {
          if (split.amountCents <= 0) continue;

          const transfer = await stripe.transfers.create({
            amount: split.amountCents,
            currency: "usd",
            destination: split.farmerStripeAccountId,
            transfer_group: splitData.orderId,
            source_transaction: chargeId,
            metadata: {
              orderId: splitData.orderId,
              farmerName: split.farmerName,
              type: "farm2home_farmer_payout",
            },
          });

          console.log("Farmer transfer created:", {
            farmerName: split.farmerName,
            farmerStripeAccountId: split.farmerStripeAccountId,
            amountCents: split.amountCents,
            transferId: transfer.id,
          });
        }

        pendingStripeSplits.delete(session.id);
      }
    }

    if (event.type === "customer.subscription.created") {
      console.log("Subscription created:", event.data.object.id);
    }

    if (event.type === "customer.subscription.updated") {
      console.log("Subscription updated:", event.data.object.id);
    }

    if (event.type === "customer.subscription.deleted") {
      console.log("Subscription canceled:", event.data.object.id);
    }

    if (event.type === "invoice.payment_succeeded") {
      console.log("Invoice payment succeeded:", event.data.object.id);
    }

    if (event.type === "invoice.payment_failed") {
      console.log("Invoice payment failed:", event.data.object.id);
    }

    if (event.type === "charge.refunded") {
      console.log("Charge refunded:", event.data.object.id);
    }

    return res.json({ received: true });
  } catch (error) {
    console.log("Stripe webhook processing error:", error);

    return res.status(500).json({
      error: error.message || "Unable to process Stripe webhook.",
    });
  }
}

app.post(
  "/stripe/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

app.post(
  "/payments/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Farm2Home Backend Running",
  });
});

app.post("/create-farmer-stripe-account", async (req, res) => {
  try {
    const { farmerId, email, farmName, existingStripeAccountId } = req.body;

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({
        success: false,
        error: "STRIPE_SECRET_KEY missing in backend .env file.",
      });
    }

    if (!farmerId || !email) {
      return res.status(400).json({
        success: false,
        error: "Missing farmerId or email.",
      });
    }

    let accountId = existingStripeAccountId;

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

    const refreshUrl =
      process.env.STRIPE_CONNECT_REFRESH_URL ||
      "http://localhost:8081/farmer/compliance-upload";

    const returnUrl =
      process.env.STRIPE_CONNECT_RETURN_URL ||
      "http://localhost:8081/farmer/compliance-upload";

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${refreshUrl}?stripeReturn=false&farmerId=${farmerId}&accountId=${accountId}`,
      return_url: `${returnUrl}?stripeReturn=true&farmerId=${farmerId}&accountId=${accountId}`,
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
    const { accountId } = req.params;

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({
        success: false,
        error: "STRIPE_SECRET_KEY missing in backend .env file.",
      });
    }

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
        : "Stripe payout account connected";

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

app.post("/create-marketplace-checkout", async (req, res) => {
  try {
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
        error: "Cart is required.",
      });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({
        error: "STRIPE_SECRET_KEY missing in backend .env file.",
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
        "http://localhost:8081/customer/subscription-success",
      cancel_url:
        process.env.CHECKOUT_CANCEL_URL || "http://localhost:8081/customer/cart",
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

    console.log("Stripe checkout created with farmer splits:", {
      orderId,
      sessionId: session.id,
      farmerSplits,
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
      error: error.message || "Unable to create marketplace checkout.",
    });
  }
});

app.post("/calculate-distance", async (req, res) => {
  try {
    const { pickupLocation, dropoffLocation } = req.body;

    if (!pickupLocation || !dropoffLocation) {
      return res.status(400).json({
        error: "Pickup and dropoff locations are required.",
      });
    }

    const apiKey =
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
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

    console.log("Google Distance Response:", JSON.stringify(data, null, 2));

    const element = data?.rows?.[0]?.elements?.[0];

    if (data?.status !== "OK") {
      return res.status(400).json({
        error:
          data?.error_message ||
          `Google API status: ${data?.status || "Unknown"}`,
      });
    }

    if (element?.status !== "OK") {
      return res.status(400).json({
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
      error: error?.message || "Unable to calculate distance.",
    });
  }
});

app.use("/orders", ordersRoutes);
app.use("/payments", paymentsRoutes);
app.use("/chat", chatRoutes);
app.use("/freight", freightRoutes);

app.get("/health", (req, res) => {
  res.json({
    success: true,
    uptime: process.uptime(),
  });
});

const PORT = process.env.PORT || 4242;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Farm2Home backend running on port ${PORT}`);
});