// backend/routes/payments.js

const express = require("express");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");

const router = express.Router();

const APP_URL = process.env.APP_URL || "https://farm2home-rho.vercel.app";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.API_BASE_URL ||
  "https://farm2home-production-e4bd.up.railway.app";

const FARM2HOME_SERVICE_FEE_PERCENT = Number(
  process.env.FARM2HOME_SERVICE_FEE_PERCENT || 4
);

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

const pendingMarketplaceSplits = new Map();
const completedMarketplaceTransfers = new Map();

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

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
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

function getMembershipPriceId(planType) {
  const normalizedPlan = cleanString(planType).toLowerCase();

  if (normalizedPlan === "farmer") {
    return {
      role: "farmer",
      priceId:
        process.env.STRIPE_FARMER_APPLICATION_FEE_PRICE_ID ||
        process.env.STRIPE_FARMER_MEMBERSHIP_PRICE_ID,
      missingKey:
        "STRIPE_FARMER_APPLICATION_FEE_PRICE_ID or STRIPE_FARMER_MEMBERSHIP_PRICE_ID",
      mode: "payment",
      successPath: "/farmer/subscription-success",
      cancelPath: "/farmer/register",
      paymentType: "one_time_application_fee",
    };
  }

  if (normalizedPlan === "freight") {
    return {
      role: "freight",
      priceId: process.env.STRIPE_FREIGHT_MEMBERSHIP_PRICE_ID,
      missingKey: "STRIPE_FREIGHT_MEMBERSHIP_PRICE_ID",
      mode: "subscription",
      successPath: "/freight/subscription-success",
      cancelPath: "/freight/register",
      paymentType: "subscription",
    };
  }

  if (normalizedPlan === "driver") {
    return {
      role: "driver",
      priceId:
        process.env.STRIPE_DRIVER_BOARD_PRICE_ID ||
        process.env.STRIPE_DRIVER_MEMBERSHIP_PRICE_ID,
      missingKey:
        "STRIPE_DRIVER_BOARD_PRICE_ID or STRIPE_DRIVER_MEMBERSHIP_PRICE_ID",
      mode: "subscription",
      successPath: "/driver/subscription-success",
      cancelPath: "/driver/subscription",
      paymentType: "subscription",
    };
  }

  return {
    role: "customer",
    priceId: process.env.STRIPE_CUSTOMER_MEMBERSHIP_PRICE_ID,
    missingKey: "STRIPE_CUSTOMER_MEMBERSHIP_PRICE_ID",
    mode: "subscription",
    successPath: "/customer/subscription-success",
    cancelPath: "/customer/register",
    paymentType: "subscription",
  };
}

async function saveSubscriptionToSupabase({
  role,
  userId,
  email,
  name,
  username,
  stripeCustomerId,
  stripeSubscriptionId,
  currentPeriodEnd,
  status,
}) {
  if (!supabase || !stripeSubscriptionId) return null;

  const normalizedRole = cleanString(role).toLowerCase();

  if (normalizedRole === "driver") {
    const { data, error } = await supabase
      .from("driver_subscriptions")
      .upsert(
        [
          {
            driver_id: userId || email || stripeCustomerId,
            driver_email: email || "",
            stripe_customer_id: stripeCustomerId || "",
            stripe_subscription_id: stripeSubscriptionId,
            subscription_status: status || "active",
            current_period_end: currentPeriodEnd || null,
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: "driver_id" }
      )
      .select()
      .single();

    if (error) {
      console.log("Save driver subscription error:", error);
      return null;
    }

    return data;
  }

  const table =
    normalizedRole === "farmer"
      ? "farmer_subscriptions"
      : normalizedRole === "freight"
      ? "freight_subscriptions"
      : "customer_subscriptions";

  const idColumn =
    normalizedRole === "farmer"
      ? "farmer_id"
      : normalizedRole === "freight"
      ? "freight_id"
      : "customer_id";

  const emailColumn =
    normalizedRole === "farmer"
      ? "farmer_email"
      : normalizedRole === "freight"
      ? "freight_email"
      : "customer_email";

  const row = {
    [idColumn]: userId || email || stripeCustomerId,
    [emailColumn]: email || "",
    name: name || "",
    username: username || "",
    stripe_customer_id: stripeCustomerId || "",
    stripe_subscription_id: stripeSubscriptionId,
    subscription_status: status || "active",
    current_period_end: currentPeriodEnd || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(table)
    .upsert([row], { onConflict: idColumn })
    .select()
    .single();

  if (error) {
    console.log(`Save ${normalizedRole} subscription error:`, error);
    return null;
  }

  return data;
}

/* =====================================================
   HEALTH
===================================================== */

router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Payments routes running",
    appUrl: APP_URL,
    apiBaseUrl: API_BASE_URL,
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    supabaseConfigured: Boolean(supabase),
    farmerApplicationFeeConfigured: Boolean(
      process.env.STRIPE_FARMER_APPLICATION_FEE_PRICE_ID ||
        process.env.STRIPE_FARMER_MEMBERSHIP_PRICE_ID
    ),
    serviceFeePercent: FARM2HOME_SERVICE_FEE_PERCENT,
  });
});

/* =====================================================
   MARKETPLACE CHECKOUT WITH FARMER SPLITS
   Farm2Home service fee is automatically 4%.
   Farmers receive product subtotal only.
===================================================== */

router.post("/create-marketplace-checkout", async (req, res) => {
  try {
    if (!requireStripe(res)) return;

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
        success: false,
        error: "Cart is required.",
      });
    }

    const productSubtotal =
      safeNumber(subtotal, 0) > 0
        ? safeNumber(subtotal, 0)
        : cart.reduce((sum, item) => {
            return (
              sum + safeNumber(item.price, 0) * safeNumber(item.quantity, 1)
            );
          }, 0);

    const calculatedServiceFee =
      safeNumber(serviceFee, 0) > 0
        ? safeNumber(serviceFee, 0)
        : Number(
            (
              productSubtotal *
              (FARM2HOME_SERVICE_FEE_PERCENT / 100)
            ).toFixed(2)
          );

    const calculatedDeliveryFee = safeNumber(deliveryFee, 0);
    const calculatedTip = safeNumber(tip, 0);

    const calculatedTotal =
      safeNumber(total, 0) > 0
        ? safeNumber(total, 0)
        : Number(
            (
              productSubtotal +
              calculatedServiceFee +
              calculatedDeliveryFee +
              calculatedTip
            ).toFixed(2)
          );

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

    if (safeNumber(calculatedServiceFee, 0) > 0) {
      fees.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Farm2Home Marketplace Service Fee",
            metadata: {
              itemType: "farm2home_fee",
              feeType: "marketplace_service_fee",
              feePercent: String(FARM2HOME_SERVICE_FEE_PERCENT),
            },
          },
          unit_amount: toCents(calculatedServiceFee),
        },
        quantity: 1,
      });
    }

    if (calculatedDeliveryFee > 0) {
      fees.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Farm2Home Delivery Fee",
            metadata: {
              itemType: "farm2home_fee",
              feeType: "delivery_fee",
            },
          },
          unit_amount: toCents(calculatedDeliveryFee),
        },
        quantity: 1,
      });
    }

    if (calculatedTip > 0) {
      fees.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Farm2Home Tip",
            metadata: {
              itemType: "farm2home_fee",
              feeType: "tip",
            },
          },
          unit_amount: toCents(calculatedTip),
        },
        quantity: 1,
      });
    }

    const checkoutSuccessUrl =
      successUrl ||
      `${APP_URL}/customer/subscription-success?session_id={CHECKOUT_SESSION_ID}`;

    const checkoutCancelUrl = cancelUrl || `${APP_URL}/customer/cart`;

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
          serviceFeePercent: String(FARM2HOME_SERVICE_FEE_PERCENT),
          serviceFeeAmount: String(calculatedServiceFee),
        },
      },
      metadata: {
        orderId,
        type: "farm2home_marketplace_checkout",
        farmerSplitCount: String(farmerSplits.length),
        serviceFeePercent: String(FARM2HOME_SERVICE_FEE_PERCENT),
        serviceFeeAmount: String(calculatedServiceFee),
      },
      success_url: checkoutSuccessUrl,
      cancel_url: checkoutCancelUrl,
    });

    pendingMarketplaceSplits.set(session.id, {
      orderId,
      sessionId: session.id,
      farmerSplits,
      cart,
      customerEmail: customerEmail || "",
      subtotal: productSubtotal,
      serviceFee: calculatedServiceFee,
      serviceFeePercent: FARM2HOME_SERVICE_FEE_PERCENT,
      deliveryFee: calculatedDeliveryFee,
      tip: calculatedTip,
      total: calculatedTotal,
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
      id: session.id,
      sessionId: session.id,
      url: session.url,
      orderId,
      farmerSplits,
      subtotal: productSubtotal,
      serviceFee: calculatedServiceFee,
      serviceFeePercent: FARM2HOME_SERVICE_FEE_PERCENT,
      deliveryFee: calculatedDeliveryFee,
      tip: calculatedTip,
      total: calculatedTotal,
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
   SUBSCRIPTIONS / ONE-TIME FARMER APPLICATION FEE
===================================================== */

router.post("/create-subscription-checkout", async (req, res) => {
  try {
    if (!requireStripe(res)) return;

    const {
      customerEmail,
      email,
      planType,
      successUrl,
      cancelUrl,
      name,
      username,
      userId,
      driverId,
      farmerId,
      freightId,
      customerId,
    } = req.body;

    const activeEmail = customerEmail || email || "";
    const membership = getMembershipPriceId(planType);

    const activeUserId =
      userId ||
      driverId ||
      farmerId ||
      freightId ||
      customerId ||
      activeEmail ||
      "";

    if (!membership.priceId) {
      return res.status(500).json({
        success: false,
        error: `${membership.missingKey} missing in backend environment.`,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: membership.mode || "subscription",
      customer_email: activeEmail || undefined,
      line_items: [{ price: membership.priceId, quantity: 1 }],
      success_url:
        successUrl ||
        `${APP_URL}${membership.successPath}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${APP_URL}${membership.cancelPath}`,
      metadata: {
        type:
          membership.role === "farmer"
            ? "farm2home_farmer_application_fee"
            : "farm2home_membership",
        planType: membership.role,
        role: membership.role,
        paymentType: membership.paymentType,
        userId: activeUserId,
        driverId: membership.role === "driver" ? activeUserId : "",
        farmerId: membership.role === "farmer" ? activeUserId : "",
        freightId: membership.role === "freight" ? activeUserId : "",
        customerId: membership.role === "customer" ? activeUserId : "",
        email: activeEmail,
        name: name || "",
        username: username || "",
      },
    });

    return res.json({
      success: true,
      id: session.id,
      sessionId: session.id,
      url: session.url,
      planType: membership.role,
      mode: membership.mode || "subscription",
      paymentType: membership.paymentType,
    });
  } catch (error) {
    console.log("Create subscription checkout error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to create subscription checkout.",
    });
  }
});

router.post("/create-freight-subscription-checkout", async (req, res) => {
  req.body.planType = "freight";
  return router.handle(
    { ...req, url: "/create-subscription-checkout", method: "POST" },
    res
  );
});

router.post("/create-driver-board-subscription-checkout", async (req, res) => {
  req.body.planType = "driver";
  return router.handle(
    { ...req, url: "/create-subscription-checkout", method: "POST" },
    res
  );
});

router.post("/create-farmer-application-checkout", async (req, res) => {
  req.body.planType = "farmer";
  return router.handle(
    { ...req, url: "/create-subscription-checkout", method: "POST" },
    res
  );
});

/* =====================================================
   VERIFY CHECKOUT SESSION
===================================================== */

router.post("/verify-checkout-session", async (req, res) => {
  try {
    if (!requireStripe(res)) return;

    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "sessionId is required.",
      });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    });

    const metadata = session.metadata || {};
    const role = metadata.role || metadata.planType || "customer";

    let subscriptionId = "";
    let subscriptionStatus = "";
    let currentPeriodEnd = null;

    if (session.subscription) {
      const subscription =
        typeof session.subscription === "string"
          ? await stripe.subscriptions.retrieve(session.subscription)
          : session.subscription;

      subscriptionId = subscription.id;
      subscriptionStatus = subscription.status;
      currentPeriodEnd = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null;

      await saveSubscriptionToSupabase({
        role,
        userId: metadata.userId || metadata.driverId || metadata.farmerId || "",
        email: metadata.email || session.customer_email || "",
        name: metadata.name || "",
        username: metadata.username || "",
        stripeCustomerId:
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id || "",
        stripeSubscriptionId: subscriptionId,
        currentPeriodEnd,
        status: subscriptionStatus,
      });
    }

    return res.json({
      success: true,
      sessionId: session.id,
      paymentStatus: session.payment_status,
      mode: session.mode,
      planType: role,
      paymentType: metadata.paymentType || "",
      subscriptionId,
      subscriptionStatus,
      currentPeriodEnd,
      customerId:
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id || "",
      customerEmail: session.customer_email || metadata.email || "",
      metadata,
    });
  } catch (error) {
    console.log("Verify checkout session error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to verify checkout session.",
    });
  }
});

/* =====================================================
   FARMER CONNECT ONBOARDING
===================================================== */

router.post("/create-farmer-connect-account", async (req, res) => {
  try {
    if (!requireStripe(res)) return;

    const { email, farmName, farmerId, existingStripeAccountId } = req.body;

    if (!email || !farmName) {
      return res.status(400).json({
        success: false,
        error: "email and farmName are required.",
      });
    }

    let stripeAccountId = existingStripeAccountId || "";

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        email,
        business_type: "individual",
        capabilities: {
          transfers: { requested: true },
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

      stripeAccountId = account.id;
    }

    const refreshUrl = appendQueryParams(getConnectRefreshUrl(), {
      stripeReturn: "false",
      farmerId,
      accountId: stripeAccountId,
    });

    const returnUrl = appendQueryParams(getConnectReturnUrl(), {
      stripeReturn: "true",
      farmerId,
      accountId: stripeAccountId,
    });

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return res.json({
      success: true,
      stripeAccountId,
      accountId: stripeAccountId,
      onboardingUrl: accountLink.url,
      url: accountLink.url,
    });
  } catch (error) {
    console.log("Create farmer connect account error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to create farmer Stripe account.",
    });
  }
});

router.post("/check-farmer-connect-account", async (req, res) => {
  try {
    if (!requireStripe(res)) return;

    const { stripeAccountId, accountId } = req.body;
    const activeAccountId = stripeAccountId || accountId;

    if (!activeAccountId) {
      return res.status(400).json({
        success: false,
        error: "stripeAccountId is required.",
      });
    }

    const account = await stripe.accounts.retrieve(activeAccountId, {
      expand: ["external_accounts"],
    });

    return res.json({
      success: true,
      stripeAccountId: account.id,
      accountId: account.id,
      chargesEnabled: Boolean(account.charges_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
      detailsSubmitted: Boolean(account.details_submitted),
      onboardingComplete: Boolean(account.details_submitted),
      requirements: account.requirements || {},
    });
  } catch (error) {
    console.log("Check farmer connect account error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to check farmer Stripe account.",
    });
  }
});

router.post("/create-farmer-onboarding-link", async (req, res) => {
  try {
    if (!requireStripe(res)) return;

    const { stripeAccountId, accountId, farmerId } = req.body;
    const activeAccountId = stripeAccountId || accountId;

    if (!activeAccountId) {
      return res.status(400).json({
        success: false,
        error: "stripeAccountId is required.",
      });
    }

    await stripe.accounts.retrieve(activeAccountId);

    const refreshUrl = appendQueryParams(getConnectRefreshUrl(), {
      stripeReturn: "false",
      farmerId,
      accountId: activeAccountId,
    });

    const returnUrl = appendQueryParams(getConnectReturnUrl(), {
      stripeReturn: "true",
      farmerId,
      accountId: activeAccountId,
    });

    const accountLink = await stripe.accountLinks.create({
      account: activeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return res.json({
      success: true,
      stripeAccountId: activeAccountId,
      accountId: activeAccountId,
      onboardingUrl: accountLink.url,
      url: accountLink.url,
    });
  } catch (error) {
    console.log("Create farmer onboarding link error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to create onboarding link.",
    });
  }
});

/* =====================================================
   CUSTOMER PORTAL
===================================================== */

router.post("/create-customer-portal", async (req, res) => {
  try {
    if (!requireStripe(res)) return;

    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: "customerId is required.",
      });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: APP_URL,
    });

    return res.json({
      success: true,
      url: portalSession.url,
    });
  } catch (error) {
    console.log("Create customer portal error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to create customer portal.",
    });
  }
});

module.exports = router;