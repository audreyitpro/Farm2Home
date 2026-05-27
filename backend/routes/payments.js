// backend/routes/payments.js

const express = require("express");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");

const router = express.Router();

const APP_URL =
  process.env.APP_URL || "https://farm2home-rho.vercel.app";

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

function requireSupabase(res) {
  if (!supabase) {
    res.status(500).json({
      success: false,
      error: "Supabase is not configured.",
    });
    return false;
  }

  return true;
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toCents(value) {
  return Math.round(safeNumber(value, 0) * 100);
}

function normalizeRole(role) {
  const normalized = cleanString(role).toLowerCase();

  return ["customer", "farmer", "freight", "driver"].includes(normalized)
    ? normalized
    : "customer";
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
    `${APP_URL}/farmer/compliance-upload`
  );
}

function getSubscriptionConfig(role) {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === "farmer") {
    return {
      role: "farmer",
      table: "farmer_subscriptions",
      idColumn: "farmer_id",
      emailColumn: "farmer_email",
    };
  }

  if (normalizedRole === "freight") {
    return {
      role: "freight",
      table: "freight_subscriptions",
      idColumn: "freight_id",
      emailColumn: "freight_email",
    };
  }

  if (normalizedRole === "driver") {
    return {
      role: "driver",
      table: "driver_subscriptions",
      idColumn: "driver_id",
      emailColumn: "driver_email",
    };
  }

  return {
    role: "customer",
    table: "customer_subscriptions",
    idColumn: "customer_id",
    emailColumn: "customer_email",
  };
}

function getMembershipPriceConfig(planType) {
  const plan = cleanString(planType).toLowerCase();

  if (plan === "farmer" || plan === "farmer_application") {
    return {
      role: "farmer",
      mode: "payment",
      priceId: process.env.STRIPE_FARMER_APPLICATION_FEE_PRICE_ID,
      missingKey: "STRIPE_FARMER_APPLICATION_FEE_PRICE_ID",
      successPath: "/farmer/compliance-upload",
      cancelPath: "/farmer/compliance-upload",
      paymentType: "farmer_application_fee",
    };
  }

  if (plan === "farmer_activation") {
    return {
      role: "farmer",
      mode: "payment",
      priceId: process.env.STRIPE_FARMER_ACTIVATION_FEE_PRICE_ID,
      missingKey: "STRIPE_FARMER_ACTIVATION_FEE_PRICE_ID",
      successPath: "/farmer/subscription-success",
      cancelPath: "/subscription/subscription-locked",
      paymentType: "farmer_activation_fee",
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
      cancelPath: "/subscription/subscription-locked",
      paymentType: "farmer_monthly_subscription",
    };
  }

  if (plan === "freight") {
    return {
      role: "freight",
      mode: "subscription",
      priceId: process.env.STRIPE_FREIGHT_MEMBERSHIP_PRICE_ID,
      missingKey: "STRIPE_FREIGHT_MEMBERSHIP_PRICE_ID",
      successPath: "/freight/subscription-success",
      cancelPath: "/freight/register",
      paymentType: "subscription",
    };
  }

  if (plan === "driver") {
    return {
      role: "driver",
      mode: "subscription",
      priceId:
        process.env.STRIPE_DRIVER_BOARD_PRICE_ID ||
        process.env.STRIPE_DRIVER_MEMBERSHIP_PRICE_ID,
      missingKey:
        "STRIPE_DRIVER_BOARD_PRICE_ID or STRIPE_DRIVER_MEMBERSHIP_PRICE_ID",
      successPath: "/driver/subscription-success",
      cancelPath: "/driver/subscription",
      paymentType: "subscription",
    };
  }

  return {
    role: "customer",
    mode: "subscription",
    priceId: process.env.STRIPE_CUSTOMER_MEMBERSHIP_PRICE_ID,
    missingKey: "STRIPE_CUSTOMER_MEMBERSHIP_PRICE_ID",
    successPath: "/customer/subscription-success",
    cancelPath: "/customer/register",
    paymentType: "subscription",
  };
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

  for (const item of cart) {
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
  }

  return Object.values(grouped);
}

function getLockoutReason(status) {
  const normalized = String(status || "").toLowerCase();

  if (!normalized) return "No subscription found.";
  if (normalized === "active") return "";
  if (normalized === "canceled") return "Subscription canceled.";
  if (normalized === "past_due") return "Subscription payment is past due.";
  if (normalized === "unpaid") return "Subscription is unpaid.";
  if (normalized === "incomplete") return "Subscription is incomplete.";
  if (normalized === "incomplete_expired") {
    return "Subscription expired before completion.";
  }
  if (normalized === "paused") return "Subscription is paused.";

  return `Subscription is ${normalized}.`;
}

async function stripeAccountExists(accountId) {
  if (!stripe || !accountId) return false;

  try {
    await stripe.accounts.retrieve(accountId);
    return true;
  } catch (error) {
    console.log("Stored Stripe account invalid:", {
      accountId,
      message: error.message,
    });
    return false;
  }
}

/* =====================================================
   SUPABASE HELPERS
===================================================== */

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

  const config = getSubscriptionConfig(role);

  const row = {
    [config.idColumn]: userId || email || stripeCustomerId,
    [config.emailColumn]: email || "",
    stripe_customer_id: stripeCustomerId || "",
    stripe_subscription_id: stripeSubscriptionId,
    subscription_status: status || "active",
    current_period_end: currentPeriodEnd || null,
    updated_at: new Date().toISOString(),
  };

  if (config.role !== "driver") {
    row.name = name || "";
    row.username = username || "";
  }

  const { data, error } = await supabase
    .from(config.table)
    .upsert([row], { onConflict: config.idColumn })
    .select()
    .single();

  if (error) {
    console.log(`Save ${config.role} subscription error:`, error.message);
    return null;
  }

  return data;
}

async function getSubscriptionByRole({ role, userId, email }) {
  if (!supabase) return null;

  const config = getSubscriptionConfig(role);

  let subscriptionQuery = supabase
    .from(config.table)
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (userId) {
    subscriptionQuery = subscriptionQuery.eq(config.idColumn, userId);
  } else if (email) {
    subscriptionQuery = subscriptionQuery.eq(config.emailColumn, email);
  } else {
    return null;
  }

  const { data, error } = await subscriptionQuery.maybeSingle();

  if (error) {
    console.log(`Get ${config.role} subscription error:`, error.message);
    return null;
  }

  return data;
}

async function updateSubscriptionStatusByRole({
  role,
  userId,
  subscriptionId,
  stripeCustomerId,
  status,
}) {
  if (!supabase) return null;

  const config = getSubscriptionConfig(role);

  let subscriptionQuery = supabase.from(config.table).update({
    subscription_status: status,
    updated_at: new Date().toISOString(),
  });

  if (userId) {
    subscriptionQuery = subscriptionQuery.eq(config.idColumn, userId);
  } else if (subscriptionId) {
    subscriptionQuery = subscriptionQuery.eq("stripe_subscription_id", subscriptionId);
  } else if (stripeCustomerId) {
    subscriptionQuery = subscriptionQuery.eq("stripe_customer_id", stripeCustomerId);
  } else {
    return null;
  }

  const { data, error } = await subscriptionQuery.select();

  if (error) {
    console.log(
      `Update ${config.role} subscription status error:`,
      error.message
    );
    return null;
  }

  return data;
}

async function updateFarmerStripeInSupabase({
  farmerId,
  email,
  farmName,
  stripeAccountId,
  payoutsEnabled = false,
  chargesEnabled = false,
  onboardingComplete = false,
  complianceStatus = "stripe_pending",
}) {
  if (!supabase || !farmerId) return;

  const payload = {
    stripe_account_id: stripeAccountId || "",
    farmer_stripe_account_id: stripeAccountId || "",
    stripe_payouts_enabled: Boolean(payoutsEnabled),
    stripe_charges_enabled: Boolean(chargesEnabled),
    stripe_onboarding_complete: Boolean(onboardingComplete),
    compliance_status: complianceStatus,
    updated_at: new Date().toISOString(),
  };

  if (email) payload.email = String(email).trim().toLowerCase();

  if (farmName) {
    payload.business_name = farmName;
    payload.farm_name = farmName;
  }

  const { error } = await supabase.from("farmers").upsert({
    id: farmerId,
    ...payload,
  });

  if (error) {
    console.log("Update farmer Stripe in farmers table error:", error.message);
  }

  const { error: adminError } = await supabase
    .from("admin_verifications")
    .update(payload)
    .eq("farmer_id", farmerId);

  if (adminError) {
    console.log(
      "Update farmer Stripe in admin_verifications error:",
      adminError.message
    );
  }
}

async function clearFarmerStripeInSupabase({ farmerId }) {
  if (!supabase || !farmerId) return;

  const payload = {
    stripe_account_id: "",
    farmer_stripe_account_id: "",
    stripe_payouts_enabled: false,
    stripe_charges_enabled: false,
    stripe_onboarding_complete: false,
    compliance_status: "stripe_pending",
    updated_at: new Date().toISOString(),
  };

  await supabase.from("farmers").update(payload).eq("id", farmerId);
  await supabase.from("admin_verifications").update(payload).eq("farmer_id", farmerId);
}

async function updateFarmerPaymentStatus({ farmerId, paymentType, paid = true }) {
  if (!supabase || !farmerId) return;

  const payload = {
    updated_at: new Date().toISOString(),
  };

  if (paymentType === "farmer_application_fee") {
    payload.application_fee_paid = paid;
    payload.farmer_membership_paid = false;
    payload.farmer_monthly_subscription_paid = false;
  }

  if (paymentType === "farmer_activation_fee") {
    payload.farmer_activation_paid = paid;
  }

  if (paymentType === "farmer_monthly_subscription") {
    payload.farmer_monthly_subscription_paid = paid;
    payload.farmer_membership_paid = paid;
  }

  await supabase.from("farmers").update(payload).eq("id", farmerId);
  await supabase
    .from("admin_verifications")
    .update(payload)
    .eq("farmer_id", farmerId);
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
    customerPriceConfigured: Boolean(process.env.STRIPE_CUSTOMER_MEMBERSHIP_PRICE_ID),
    freightPriceConfigured: Boolean(process.env.STRIPE_FREIGHT_MEMBERSHIP_PRICE_ID),
    driverPriceConfigured: Boolean(
      process.env.STRIPE_DRIVER_BOARD_PRICE_ID ||
        process.env.STRIPE_DRIVER_MEMBERSHIP_PRICE_ID
    ),
    farmerApplicationFeeConfigured: Boolean(
      process.env.STRIPE_FARMER_APPLICATION_FEE_PRICE_ID
    ),
    farmerActivationFeeConfigured: Boolean(
      process.env.STRIPE_FARMER_ACTIVATION_FEE_PRICE_ID
    ),
    farmerMonthlySubscriptionConfigured: Boolean(
      process.env.STRIPE_FARMER_MONTHLY_SUBSCRIPTION_PRICE_ID ||
        process.env.STRIPE_FARMER_SUBSCRIPTION_PRICE_ID
    ),
    serviceFeePercent: FARM2HOME_SERVICE_FEE_PERCENT,
  });
});

/* =====================================================
   SUBSCRIPTION / MEMBERSHIP CHECKOUT
===================================================== */

router.post("/create-subscription-checkout", async (req, res) => {
  try {
    if (!requireStripe(res)) return;

    const {
      planType = "customer",
      customerEmail,
      email,
      name,
      username,
      userId,
      customerId,
      farmerId,
      freightId,
      driverId,
    } = req.body || {};

    const config = getMembershipPriceConfig(planType);

    if (!config.priceId) {
      return res.status(500).json({
        success: false,
        error: `${config.missingKey} missing in backend environment.`,
      });
    }

    const finalEmail = cleanString(customerEmail || email).toLowerCase();

    const finalUserId =
      cleanString(userId) ||
      cleanString(customerId) ||
      cleanString(farmerId) ||
      cleanString(freightId) ||
      cleanString(driverId) ||
      finalEmail;

    const successUrl = appendQueryParams(`${APP_URL}${config.successPath}`, {
      checkout_success: "true",
      session_id: "{CHECKOUT_SESSION_ID}",
      planType,
      role: config.role,
      userId: finalUserId,
      farmerId: cleanString(farmerId) || undefined,
    });

    const cancelUrl = appendQueryParams(`${APP_URL}${config.cancelPath}`, {
      checkout_canceled: "true",
      planType,
      role: config.role,
      userId: finalUserId,
      farmerId: cleanString(farmerId) || undefined,
    });

    const session = await stripe.checkout.sessions.create({
      mode: config.mode,
      payment_method_types: ["card"],
      line_items: [{ price: config.priceId, quantity: 1 }],
      customer_email: finalEmail || undefined,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        role: config.role,
        planType: cleanString(planType),
        paymentType: config.paymentType,
        userId: finalUserId || "",
        customerId: cleanString(customerId) || "",
        farmerId: cleanString(farmerId) || finalUserId || "",
        freightId: cleanString(freightId) || "",
        driverId: cleanString(driverId) || "",
        email: finalEmail || "",
        name: cleanString(name),
        username: cleanString(username),
      },
      subscription_data:
        config.mode === "subscription"
          ? {
              metadata: {
                role: config.role,
                planType: cleanString(planType),
                paymentType: config.paymentType,
                userId: finalUserId || "",
                farmerId: cleanString(farmerId) || finalUserId || "",
                email: finalEmail || "",
              },
            }
          : undefined,
    });

    return res.json({
      success: true,
      id: session.id,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error("create-subscription-checkout error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Unable to create checkout session.",
    });
  }
});

/* =====================================================
   CHECK / VERIFY SUBSCRIPTION
===================================================== */

router.post("/check-subscription", async (req, res) => {
  try {
    if (!requireSupabase(res)) return;

    const { role = "customer", userId, email } = req.body || {};

    const subscription = await getSubscriptionByRole({
      role,
      userId: cleanString(userId),
      email: cleanString(email).toLowerCase(),
    });

    const status = subscription?.subscription_status || "";
    const active = String(status).toLowerCase() === "active";

    return res.json({
      success: true,
      active,
      locked: !active,
      status,
      reason: active ? "" : getLockoutReason(status),
      subscription,
    });
  } catch (error) {
    console.error("check-subscription error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

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
      expand: ["subscription", "payment_intent"],
    });

    const metadata = session.metadata || {};
    const role = normalizeRole(metadata.role);
    const paymentType = metadata.paymentType || "subscription";

    if (session.payment_status === "paid") {
      if (session.mode === "subscription" && session.subscription) {
        const subscription =
          typeof session.subscription === "string"
            ? await stripe.subscriptions.retrieve(session.subscription)
            : session.subscription;

        await saveSubscriptionToSupabase({
          role,
          userId: metadata.userId || metadata.farmerId || metadata.email,
          email: metadata.email || session.customer_email,
          name: metadata.name,
          username: metadata.username,
          stripeCustomerId: session.customer,
          stripeSubscriptionId: subscription.id,
          currentPeriodEnd: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
          status: subscription.status,
        });

        if (role === "farmer" && metadata.farmerId) {
          await updateFarmerPaymentStatus({
            farmerId: metadata.farmerId,
            paymentType,
            paid: true,
          });
        }
      }

      if (session.mode === "payment" && role === "farmer") {
        await updateFarmerPaymentStatus({
          farmerId: metadata.farmerId || metadata.userId,
          paymentType,
          paid: true,
        });
      }
    }

    return res.json({
      success: true,
      paid: session.payment_status === "paid",
      paymentStatus: session.payment_status,
      mode: session.mode,
      role,
      paymentType,
      session,
    });
  } catch (error) {
    console.error("verify-checkout-session error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/* =====================================================
   FARMER STRIPE CONNECT
===================================================== */

router.post("/create-farmer-connect-account", async (req, res) => {
  try {
    if (!requireStripe(res)) return;

    const {
      farmerId,
      email,
      farmName,
      businessName,
      existingStripeAccountId,
    } = req.body || {};

    const finalFarmerId = cleanString(farmerId);
    const finalEmail = cleanString(email).toLowerCase();
    const finalFarmName = cleanString(farmName || businessName);

    if (!finalFarmerId) {
      return res.status(400).json({
        success: false,
        error: "farmerId is required.",
      });
    }

    let accountId = cleanString(existingStripeAccountId);

    if (accountId) {
      const exists = await stripeAccountExists(accountId);
      if (!exists) {
        accountId = "";
        await clearFarmerStripeInSupabase({ farmerId: finalFarmerId });
      }
    }

    if (!accountId && supabase) {
      const { data } = await supabase
        .from("farmers")
        .select("stripe_account_id, farmer_stripe_account_id")
        .eq("id", finalFarmerId)
        .maybeSingle();

      const savedAccountId =
        data?.stripe_account_id || data?.farmer_stripe_account_id || "";

      if (savedAccountId && (await stripeAccountExists(savedAccountId))) {
        accountId = savedAccountId;
      } else if (savedAccountId) {
        await clearFarmerStripeInSupabase({ farmerId: finalFarmerId });
      }
    }

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: finalEmail || undefined,
        country: "US",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: finalFarmName || "Farm2Home Farmer",
          product_description: "Farm2Home local farm marketplace seller",
        },
        metadata: {
          farmerId: finalFarmerId,
          farmName: finalFarmName,
          email: finalEmail,
        },
      });

      accountId = account.id;
    }

    await updateFarmerStripeInSupabase({
      farmerId: finalFarmerId,
      email: finalEmail,
      farmName: finalFarmName,
      stripeAccountId: accountId,
      complianceStatus: "stripe_pending",
    });

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: appendQueryParams(getConnectRefreshUrl(), {
        stripeReturn: "false",
        farmerId: finalFarmerId,
        accountId,
      }),
      return_url: appendQueryParams(getConnectReturnUrl(), {
        stripeReturn: "true",
        farmerId: finalFarmerId,
        accountId,
      }),
      type: "account_onboarding",
    });

    return res.json({
      success: true,
      accountId,
      stripeAccountId: accountId,
      onboardingUrl: accountLink.url,
      url: accountLink.url,
    });
  } catch (error) {
    console.error("create-farmer-connect-account error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/create-farmer-account-link", async (req, res) => {
  try {
    if (!requireStripe(res)) return;

    const { farmerId, stripeAccountId } = req.body || {};
    const finalFarmerId = cleanString(farmerId);
    let accountId = cleanString(stripeAccountId);

    if (!accountId && supabase && finalFarmerId) {
      const { data } = await supabase
        .from("farmers")
        .select("stripe_account_id, farmer_stripe_account_id")
        .eq("id", finalFarmerId)
        .maybeSingle();

      accountId = data?.stripe_account_id || data?.farmer_stripe_account_id || "";
    }

    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: "stripeAccountId or farmerId with saved Stripe account is required.",
      });
    }

    if (!(await stripeAccountExists(accountId))) {
      await clearFarmerStripeInSupabase({ farmerId: finalFarmerId });

      return res.status(400).json({
        success: false,
        error: "Saved Stripe account no longer exists. Please restart Stripe setup.",
      });
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: appendQueryParams(getConnectRefreshUrl(), {
        stripeReturn: "false",
        farmerId: finalFarmerId,
        accountId,
      }),
      return_url: appendQueryParams(getConnectReturnUrl(), {
        stripeReturn: "true",
        farmerId: finalFarmerId,
        accountId,
      }),
      type: "account_onboarding",
    });

    return res.json({
      success: true,
      accountId,
      stripeAccountId: accountId,
      onboardingUrl: accountLink.url,
      url: accountLink.url,
    });
  } catch (error) {
    console.error("create-farmer-account-link error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/check-farmer-connect-account", async (req, res) => {
  try {
    if (!requireStripe(res)) return;

    const { farmerId, stripeAccountId, accountId } = req.body || {};
    const finalFarmerId = cleanString(farmerId);

    let activeAccountId =
      cleanString(stripeAccountId) || cleanString(accountId);

    if (!activeAccountId && supabase && finalFarmerId) {
      const { data } = await supabase
        .from("farmers")
        .select("stripe_account_id, farmer_stripe_account_id")
        .eq("id", finalFarmerId)
        .maybeSingle();

      activeAccountId =
        data?.stripe_account_id || data?.farmer_stripe_account_id || "";
    }

    if (!activeAccountId) {
      return res.json({
        success: true,
        exists: false,
        onboardingComplete: false,
        payoutsEnabled: false,
        chargesEnabled: false,
        detailsSubmitted: false,
      });
    }

    let account;

    try {
      account = await stripe.accounts.retrieve(activeAccountId);
    } catch (error) {
      if (finalFarmerId) {
        await clearFarmerStripeInSupabase({ farmerId: finalFarmerId });
      }

      return res.status(404).json({
        success: false,
        exists: false,
        error: "No such Stripe account. Please restart Stripe setup.",
      });
    }

    const onboardingComplete =
      Boolean(account.details_submitted) &&
      Boolean(account.payouts_enabled) &&
      Boolean(account.charges_enabled);

    if (finalFarmerId) {
      await updateFarmerStripeInSupabase({
        farmerId: finalFarmerId,
        stripeAccountId: activeAccountId,
        payoutsEnabled: account.payouts_enabled,
        chargesEnabled: account.charges_enabled,
        onboardingComplete,
        complianceStatus: onboardingComplete
          ? "stripe_complete"
          : "stripe_pending",
      });
    }

    return res.json({
      success: true,
      exists: true,
      accountId: activeAccountId,
      stripeAccountId: activeAccountId,
      onboardingComplete,
      payoutsEnabled: account.payouts_enabled,
      chargesEnabled: account.charges_enabled,
      detailsSubmitted: account.details_submitted,
      account,
    });
  } catch (error) {
    console.error("check-farmer-connect-account error:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/* =====================================================
   MARKETPLACE CHECKOUT + SPLITS
===================================================== */

router.post("/create-marketplace-checkout", async (req, res) => {
  try {
    if (!requireStripe(res)) return;

    const {
      cart = [],
      customerEmail,
      customerId,
      orderId,
      deliveryFee = 0,
      successPath = "/customer/orders",
      cancelPath = "/customer/checkout",
    } = req.body || {};

    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Cart is required.",
      });
    }

    const groupedFarmers = groupCartByFarmer(cart);

    const lineItems = cart.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: item.name || item.productName || "Farm2Home Item",
          description: getFarmName(item),
        },
        unit_amount: toCents(item.price),
      },
      quantity: Math.max(1, Number(item.quantity || 1)),
    }));

    if (safeNumber(deliveryFee, 0) > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Delivery Fee" },
          unit_amount: toCents(deliveryFee),
        },
        quantity: 1,
      });
    }

    const finalOrderId = cleanString(orderId) || `order_${Date.now()}`;

    const splitPayload = {
      orderId: finalOrderId,
      customerId: cleanString(customerId),
      customerEmail: cleanString(customerEmail).toLowerCase(),
      groupedFarmers,
      deliveryFee: safeNumber(deliveryFee, 0),
      processed: false,
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: cleanString(customerEmail).toLowerCase() || undefined,
      line_items: lineItems,
      success_url: appendQueryParams(`${APP_URL}${successPath}`, {
        checkout_success: "true",
        session_id: "{CHECKOUT_SESSION_ID}",
        orderId: finalOrderId,
      }),
      cancel_url: appendQueryParams(`${APP_URL}${cancelPath}`, {
        checkout_canceled: "true",
        orderId: finalOrderId,
      }),
      metadata: {
        type: "marketplace_order",
        orderId: finalOrderId,
        customerId: cleanString(customerId),
        customerEmail: cleanString(customerEmail).toLowerCase(),
      },
    });

    pendingMarketplaceSplits.set(session.id, splitPayload);

    if (supabase) {
      await supabase.from("payment_splits_pending").upsert({
        checkout_session_id: session.id,
        order_id: finalOrderId,
        payload: splitPayload,
        processed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    return res.json({
      success: true,
      id: session.id,
      sessionId: session.id,
      url: session.url,
      orderId: finalOrderId,
    });
  } catch (error) {
    console.error("create-marketplace-checkout error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

async function processMarketplaceTransfers(session) {
  if (!stripe || !session?.id) return null;

  let splitPayload = pendingMarketplaceSplits.get(session.id);

  if (!splitPayload && supabase) {
    const { data } = await supabase
      .from("payment_splits_pending")
      .select("*")
      .eq("checkout_session_id", session.id)
      .maybeSingle();

    splitPayload = data?.payload || null;
  }

  if (!splitPayload || splitPayload.processed) {
    return { alreadyProcessed: true };
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  if (!paymentIntentId) {
    return { error: "Missing payment_intent for marketplace transfer." };
  }

  const transfers = [];

  for (const farmerGroup of splitPayload.groupedFarmers || []) {
    const subtotalCents = toCents(farmerGroup.subtotal);
    const appFeeCents = Math.round(
      subtotalCents * (FARM2HOME_SERVICE_FEE_PERCENT / 100)
    );
    const farmerAmountCents = Math.max(0, subtotalCents - appFeeCents);

    if (farmerAmountCents <= 0) continue;

    const transfer = await stripe.transfers.create({
      amount: farmerAmountCents,
      currency: "usd",
      destination: farmerGroup.farmerStripeAccountId,
      source_transaction: paymentIntentId,
      metadata: {
        orderId: splitPayload.orderId,
        farmName: farmerGroup.farmName,
        subtotalCents,
        appFeeCents,
        farmerAmountCents,
      },
    });

    transfers.push({
      farmName: farmerGroup.farmName,
      farmerStripeAccountId: farmerGroup.farmerStripeAccountId,
      amountCents: farmerAmountCents,
      amountDollars: farmerAmountCents / 100,
      transferId: transfer.id,
    });
  }

  splitPayload.processed = true;

  if (supabase) {
    await supabase
      .from("payment_splits_pending")
      .update({
        processed: true,
        transfers,
        updated_at: new Date().toISOString(),
      })
      .eq("checkout_session_id", session.id);
  }

  pendingMarketplaceSplits.set(session.id, splitPayload);

  return {
    alreadyProcessed: false,
    orderId: splitPayload.orderId,
    transfers,
  };
}

/* =====================================================
   WEBHOOK
===================================================== */

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!stripe) {
      return res.status(500).send("Stripe not configured");
    }

    const signature = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      if (webhookSecret) {
        event = stripe.webhooks.constructEvent(
          req.body,
          signature,
          webhookSecret
        );
      } else {
        event = JSON.parse(req.body.toString());
      }
    } catch (error) {
      console.error("Webhook signature verification failed:", error.message);
      return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const metadata = session.metadata || {};

        if (metadata.type === "marketplace_order") {
          await processMarketplaceTransfers(session);
        } else {
          const role = normalizeRole(metadata.role);
          const paymentType = metadata.paymentType || "subscription";

          if (session.mode === "subscription" && session.subscription) {
            const subscription = await stripe.subscriptions.retrieve(
              session.subscription
            );

            await saveSubscriptionToSupabase({
              role,
              userId: metadata.userId || metadata.farmerId || metadata.email,
              email: metadata.email || session.customer_email,
              name: metadata.name,
              username: metadata.username,
              stripeCustomerId: session.customer,
              stripeSubscriptionId: subscription.id,
              currentPeriodEnd: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000).toISOString()
                : null,
              status: subscription.status,
            });
          }

          if (role === "farmer") {
            await updateFarmerPaymentStatus({
              farmerId: metadata.farmerId || metadata.userId,
              paymentType,
              paid: true,
            });
          }
        }
      }

      if (
        [
          "customer.subscription.updated",
          "customer.subscription.deleted",
          "customer.subscription.paused",
          "customer.subscription.resumed",
        ].includes(event.type)
      ) {
        const subscription = event.data.object;

        const role = normalizeRole(subscription.metadata?.role);

        const userId =
          subscription.metadata?.userId ||
          subscription.metadata?.farmerId ||
          "";

        await updateSubscriptionStatusByRole({
          role,
          userId,
          subscriptionId: subscription.id,
          stripeCustomerId: subscription.customer,
          status: subscription.status,
        });
      }

      if (event.type === "account.updated") {
        const account = event.data.object;
        const farmerId = account.metadata?.farmerId || "";

        if (farmerId) {
          const onboardingComplete =
            Boolean(account.details_submitted) &&
            Boolean(account.payouts_enabled) &&
            Boolean(account.charges_enabled);

          await updateFarmerStripeInSupabase({
            farmerId,
            stripeAccountId: account.id,
            payoutsEnabled: account.payouts_enabled,
            chargesEnabled: account.charges_enabled,
            onboardingComplete,
            complianceStatus: onboardingComplete
              ? "stripe_complete"
              : "stripe_pending",
          });
        }
      }

      return res.json({ received: true });
    } catch (error) {
      console.error("Webhook handler error:", error);

      return res.status(500).json({
        received: false,
        error: error.message,
      });
    }
  }
);

module.exports = router;