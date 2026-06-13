// backend/routes/payments.js

const express = require("express");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

const APP_URL = process.env.APP_URL || "https://farm2home-rho.vercel.app";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value) {
  return cleanString(value).toLowerCase();
}

function normalizeRole(role) {
  const value = cleanString(role).toLowerCase();
  if (["farmer", "driver", "freight", "customer"].includes(value)) return value;
  return "customer";
}

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

function appendQueryParams(baseUrl, params) {
  const url = new URL(baseUrl);

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

function getMembershipPriceConfig(planType) {
  const plan = cleanString(planType).toLowerCase();

  if (plan === "freight") {
    return {
      role: "freight",
      mode: "subscription",
      priceId: process.env.STRIPE_FREIGHT_MEMBERSHIP_PRICE_ID,
      missingKey: "STRIPE_FREIGHT_MEMBERSHIP_PRICE_ID",
      successPath: "/freight/subscription-success",
      cancelPath: "/freight/register",
      paymentType: "freight_subscription",
      profileTable: "freight_users",
    };
  }

  if (plan === "driver") {
    return {
      role: "driver",
      mode: "subscription",
      priceId:
        process.env.STRIPE_DRIVER_BOARD_PRICE_ID ||
        process.env.STRIPE_DRIVER_MEMBERSHIP_PRICE_ID,
      missingKey: "STRIPE_DRIVER_BOARD_PRICE_ID or STRIPE_DRIVER_MEMBERSHIP_PRICE_ID",
      successPath: "/driver/subscription-success",
      cancelPath: "/driver/subscription",
      paymentType: "driver_subscription",
      profileTable: "drivers",
    };
  }

  if (plan === "farmer_monthly") {
    return {
      role: "farmer",
      mode: "subscription",
      priceId:
        process.env.STRIPE_FARMER_MONTHLY_SUBSCRIPTION_PRICE_ID ||
        process.env.STRIPE_FARMER_SUBSCRIPTION_PRICE_ID,
      missingKey:
        "STRIPE_FARMER_MONTHLY_SUBSCRIPTION_PRICE_ID or STRIPE_FARMER_SUBSCRIPTION_PRICE_ID",
      successPath: "/farmer/subscription-success",
      cancelPath: "/farmer/subscription",
      paymentType: "farmer_monthly_subscription",
      profileTable: "farmers",
    };
  }

  if (plan === "farmer" || plan === "farmer_application") {
    return {
      role: "farmer",
      mode: "payment",
      priceId: process.env.STRIPE_FARMER_APPLICATION_FEE_PRICE_ID,
      missingKey: "STRIPE_FARMER_APPLICATION_FEE_PRICE_ID",
      successPath: "/farmer/compliance-upload",
      cancelPath: "/farmer/register",
      paymentType: "farmer_application_fee",
      profileTable: "farmers",
    };
  }

  return {
    role: "customer",
    mode: "subscription",
    priceId: process.env.STRIPE_CUSTOMER_MEMBERSHIP_PRICE_ID,
    missingKey: "STRIPE_CUSTOMER_MEMBERSHIP_PRICE_ID",
    successPath: "/customer/subscription-success",
    cancelPath: "/customer/register",
    paymentType: "customer_subscription",
    profileTable: "customers",
  };
}

async function safeUpdate(table, payload, id, email) {
  if (!supabase) return;

  if (id) {
    const byId = await supabase.from(table).update(payload).eq("id", id);
    if (!byId.error) return;
    console.log(`${table} update by id skipped:`, byId.error.message);
  }

  if (email) {
    const byEmail = await supabase.from(table).update(payload).eq("email", email);
    if (byEmail.error) {
      console.log(`${table} update by email skipped:`, byEmail.error.message);
    }
  }
}

async function updateProfileForPendingCheckout({
  role,
  profileId,
  email,
  stripeCustomerId,
  stripeCheckoutSessionId,
}) {
  if (!supabase) return;

  const table =
    role === "freight"
      ? "freight_users"
      : role === "driver"
      ? "drivers"
      : role === "farmer"
      ? "farmers"
      : "customers";

  const payload = {
    stripe_customer_id: stripeCustomerId || null,
    stripe_checkout_session_id: stripeCheckoutSessionId || null,
    membership_status: "pending_payment",
    subscription_status: "pending_payment",
    updated_at: new Date().toISOString(),
  };

  if (role === "freight") {
    payload.freight_membership_paid = false;
  }

  await safeUpdate(table, payload, profileId, email);
}

async function updateProfileForActiveSubscription({
  role,
  profileId,
  email,
  stripeCustomerId,
  stripeSubscriptionId,
  status,
}) {
  if (!supabase) return;

  const table =
    role === "freight"
      ? "freight_users"
      : role === "driver"
      ? "drivers"
      : role === "farmer"
      ? "farmers"
      : "customers";

  const active = ["active", "trialing"].includes(String(status || "").toLowerCase());

  const payload = {
    stripe_customer_id: stripeCustomerId || null,
    stripe_subscription_id: stripeSubscriptionId || null,
    membership_status: active ? "active" : status || "inactive",
    subscription_status: status || "inactive",
    account_active: active,
    updated_at: new Date().toISOString(),
  };

  if (role === "freight") {
    payload.freight_membership_paid = active;
  }

  await safeUpdate(table, payload, profileId, email);
}

async function saveSubscriptionRecord({
  role,
  profileId,
  email,
  stripeCustomerId,
  stripeSubscriptionId,
  status,
}) {
  if (!supabase || !stripeSubscriptionId) return;

  const table =
    role === "freight"
      ? "freight_subscriptions"
      : role === "driver"
      ? "driver_subscriptions"
      : role === "farmer"
      ? "farmer_subscriptions"
      : "customer_subscriptions";

  const idColumn =
    role === "freight"
      ? "freight_id"
      : role === "driver"
      ? "driver_id"
      : role === "farmer"
      ? "farmer_id"
      : "customer_id";

  const emailColumn =
    role === "freight"
      ? "freight_email"
      : role === "driver"
      ? "driver_email"
      : role === "farmer"
      ? "farmer_email"
      : "customer_email";

  const payload = {
    [idColumn]: profileId || null,
    [emailColumn]: email || null,
    email: email || null,
    stripe_customer_id: stripeCustomerId || null,
    stripe_subscription_id: stripeSubscriptionId || null,
    subscription_status: status || "active",
    status: status || "active",
    updated_at: new Date().toISOString(),
  };

  const result = await supabase
    .from(table)
    .upsert(payload, { onConflict: "stripe_subscription_id" });

  if (result.error) {
    console.log(`${table} upsert skipped:`, result.error.message);
  }
}

async function handleSubscriptionSuccessFromSession(session) {
  const metadata = session.metadata || {};
  const role = normalizeRole(metadata.role || metadata.planType || "customer");

  const profileId =
    cleanString(metadata.userId) ||
    cleanString(metadata.freightId) ||
    cleanString(metadata.driverId) ||
    cleanString(metadata.farmerId) ||
    cleanString(metadata.customerId);

  const email = normalizeEmail(
    metadata.email || session.customer_details?.email || session.customer_email
  );

  const stripeCustomerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id || "";

  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id || "";

  let status = "active";

  if (stripeSubscriptionId && stripe) {
    try {
      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      status = subscription.status || "active";
    } catch (error) {
      console.log("Subscription retrieve skipped:", error.message);
    }
  }

  await saveSubscriptionRecord({
    role,
    profileId,
    email,
    stripeCustomerId,
    stripeSubscriptionId,
    status,
  });

  await updateProfileForActiveSubscription({
    role,
    profileId,
    email,
    stripeCustomerId,
    stripeSubscriptionId,
    status,
  });
}

async function createSubscriptionCheckoutSession(req, res, forcedPlanType) {
  try {
    if (!requireStripe(res)) return;

    const {
      planType = "customer",
      customerEmail,
      email,
      name,
      username,
      companyName,
      businessName,
      userId,
      customerId,
      farmerId,
      freightId,
      driverId,
      successUrl,
      cancelUrl,
    } = req.body || {};

    const finalPlanType = forcedPlanType || planType;
    const config = getMembershipPriceConfig(finalPlanType);

    if (!config.priceId) {
      return res.status(500).json({
        success: false,
        error: `${config.missingKey} missing in backend environment.`,
      });
    }

    const finalEmail = normalizeEmail(customerEmail || email);

    const finalUserId =
      cleanString(userId) ||
      cleanString(customerId) ||
      cleanString(farmerId) ||
      cleanString(freightId) ||
      cleanString(driverId) ||
      finalEmail;

    const finalName =
      cleanString(name) ||
      cleanString(companyName) ||
      cleanString(businessName) ||
      finalEmail;

    let stripeCustomerId = "";

    if (finalEmail) {
      const existingCustomers = await stripe.customers.list({
        email: finalEmail,
        limit: 1,
      });

      stripeCustomerId = existingCustomers?.data?.[0]?.id || "";
    }

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: finalEmail || undefined,
        name: finalName || undefined,
        metadata: {
          role: config.role,
          userId: finalUserId || "",
          customerId: cleanString(customerId),
          farmerId: cleanString(farmerId),
          freightId: cleanString(freightId),
          driverId: cleanString(driverId),
          email: finalEmail || "",
          username: cleanString(username),
        },
      });

      stripeCustomerId = customer.id;
    }

    const metadata = {
      role: config.role,
      planType: cleanString(finalPlanType),
      paymentType: config.paymentType,
      userId: finalUserId || "",
      customerId: cleanString(customerId),
      farmerId: cleanString(farmerId),
      freightId: cleanString(freightId),
      driverId: cleanString(driverId),
      email: finalEmail || "",
      name: finalName || "",
      username: cleanString(username),
      companyName: cleanString(companyName || businessName),
    };

    const finalSuccessUrl =
      cleanString(successUrl) ||
      appendQueryParams(`${APP_URL}${config.successPath}`, {
        checkout_success: "true",
        session_id: "{CHECKOUT_SESSION_ID}",
        role: config.role,
        planType: finalPlanType,
        userId: finalUserId,
        freightId: cleanString(freightId) || undefined,
        driverId: cleanString(driverId) || undefined,
        farmerId: cleanString(farmerId) || undefined,
      });

    const finalCancelUrl =
      cleanString(cancelUrl) ||
      appendQueryParams(`${APP_URL}${config.cancelPath}`, {
        checkout_canceled: "true",
        role: config.role,
        planType: finalPlanType,
        userId: finalUserId,
      });

    const session = await stripe.checkout.sessions.create({
      mode: config.mode,
      payment_method_types: ["card"],
      customer: stripeCustomerId,
      line_items: [{ price: config.priceId, quantity: 1 }],
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
      metadata,
      subscription_data:
        config.mode === "subscription"
          ? {
              metadata,
            }
          : undefined,
    });

    await updateProfileForPendingCheckout({
      role: config.role,
      profileId: finalUserId,
      email: finalEmail,
      stripeCustomerId,
      stripeCheckoutSessionId: session.id,
    });

    return res.json({
      success: true,
      url: session.url,
      id: session.id,
      sessionId: session.id,
      session_id: session.id,
      stripeCustomerId,
      customerId: stripeCustomerId,
      customer_id: stripeCustomerId,
      role: config.role,
      planType: finalPlanType,
    });
  } catch (error) {
    console.error("create checkout error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Unable to create checkout session.",
    });
  }
}

router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Payments routes running",
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    supabaseConfigured: Boolean(supabase),
    appUrl: APP_URL,
    freightPriceConfigured: Boolean(process.env.STRIPE_FREIGHT_MEMBERSHIP_PRICE_ID),
    driverPriceConfigured: Boolean(
      process.env.STRIPE_DRIVER_BOARD_PRICE_ID ||
        process.env.STRIPE_DRIVER_MEMBERSHIP_PRICE_ID
    ),
    farmerMonthlySubscriptionConfigured: Boolean(
      process.env.STRIPE_FARMER_MONTHLY_SUBSCRIPTION_PRICE_ID ||
        process.env.STRIPE_FARMER_SUBSCRIPTION_PRICE_ID
    ),
    customerPriceConfigured: Boolean(process.env.STRIPE_CUSTOMER_MEMBERSHIP_PRICE_ID),
  });
});

router.post("/create-subscription-checkout", (req, res) =>
  createSubscriptionCheckoutSession(req, res)
);

router.post("/create-freight-subscription-checkout", (req, res) =>
  createSubscriptionCheckoutSession(req, res, "freight")
);

router.post("/create-driver-subscription-checkout", (req, res) =>
  createSubscriptionCheckoutSession(req, res, "driver")
);

router.post("/create-farmer-membership-checkout", (req, res) =>
  createSubscriptionCheckoutSession(req, res, "farmer_monthly")
);

router.post("/create-customer-subscription-checkout", (req, res) =>
  createSubscriptionCheckoutSession(req, res, "customer")
);

router.post("/verify-checkout-session", async (req, res) => {
  try {
    if (!requireStripe(res)) return;

    const { sessionId } = req.body || {};

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "sessionId is required.",
      });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    });

    if (session.mode === "subscription") {
      await handleSubscriptionSuccessFromSession(session);
    }

    return res.json({
      success: true,
      paid: session.payment_status === "paid",
      paymentStatus: session.payment_status,
      status: session.status,
      mode: session.mode,
      session,
    });
  } catch (error) {
    console.error("verify-checkout-session error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Unable to verify checkout session.",
    });
  }
});

router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe) {
    return res.status(200).json({ received: true, ignored: true });
  }

  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    } else {
      event = JSON.parse(req.body.toString());
    }
  } catch (error) {
    console.error("Webhook signature verification failed:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      await handleSubscriptionSuccessFromSession(event.data.object);
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated"
    ) {
      const subscription = event.data.object;
      const metadata = subscription.metadata || {};
      const role = normalizeRole(metadata.role || "customer");

      const profileId =
        cleanString(metadata.userId) ||
        cleanString(metadata.freightId) ||
        cleanString(metadata.driverId) ||
        cleanString(metadata.farmerId) ||
        cleanString(metadata.customerId);

      const email = normalizeEmail(metadata.email);

      const stripeCustomerId =
        typeof subscription.customer === "string" ? subscription.customer : "";

      await saveSubscriptionRecord({
        role,
        profileId,
        email,
        stripeCustomerId,
        stripeSubscriptionId: subscription.id,
        status: subscription.status,
      });

      await updateProfileForActiveSubscription({
        role,
        profileId,
        email,
        stripeCustomerId,
        stripeSubscriptionId: subscription.id,
        status: subscription.status,
      });
    }

    return res.status(200).json({
      received: true,
      type: event.type,
    });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return res.status(200).json({
      received: true,
      handled: false,
      error: error.message,
      type: event.type,
    });
  }
});

module.exports = router;