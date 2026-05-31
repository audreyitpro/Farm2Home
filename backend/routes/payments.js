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
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        realtime: { transport: ws },
      })
    : null;

const pendingMarketplaceSplits = new Map();

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
  return process.env.STRIPE_CONNECT_REFRESH_URL || `${APP_URL}/farmer/compliance-upload`;
}

function getConnectReturnUrl() {
  return process.env.STRIPE_CONNECT_RETURN_URL || `${APP_URL}/farmer/compliance-upload`;
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
      missingKey: "STRIPE_DRIVER_BOARD_PRICE_ID or STRIPE_DRIVER_MEMBERSHIP_PRICE_ID",
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

  if (paymentType === "farmer_monthly_subscription") {
    payload.farmer_monthly_subscription_paid = paid;
    payload.farmer_membership_paid = paid;
    payload.monthly_membership_started = paid;
  }

  await supabase.from("farmers").update(payload).eq("id", farmerId);
  await supabase.from("admin_verifications").update(payload).eq("farmer_id", farmerId);
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

  await supabase.from("farmers").upsert({
    id: farmerId,
    ...payload,
  });

  await supabase.from("admin_verifications").update(payload).eq("farmer_id", farmerId);
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
    farmerMonthlySubscriptionConfigured: Boolean(
      process.env.STRIPE_FARMER_MONTHLY_SUBSCRIPTION_PRICE_ID ||
        process.env.STRIPE_FARMER_SUBSCRIPTION_PRICE_ID
    ),
    serviceFeePercent: FARM2HOME_SERVICE_FEE_PERCENT,
  });
});

async function createSubscriptionCheckoutSession(req, res, forcedPlanType) {
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

    const finalPlanType = forcedPlanType || planType;
    const config = getMembershipPriceConfig(finalPlanType);

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
      planType: finalPlanType,
      role: config.role,
      userId: finalUserId,
      farmerId: cleanString(farmerId) || undefined,
    });

    const cancelUrl = appendQueryParams(`${APP_URL}${config.cancelPath}`, {
      checkout_canceled: "true",
      planType: finalPlanType,
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
        planType: cleanString(finalPlanType),
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
                planType: cleanString(finalPlanType),
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
    console.error("create checkout error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to create checkout session.",
    });
  }
}

router.post("/create-subscription-checkout", async (req, res) => {
  return createSubscriptionCheckoutSession(req, res);
});

router.post("/create-farmer-membership-checkout", async (req, res) => {
  return createSubscriptionCheckoutSession(req, res, "farmer_monthly");
});

router.post("/create-driver-subscription-checkout", async (req, res) => {
  return createSubscriptionCheckoutSession(req, res, "driver");
});

router.post("/create-freight-subscription-checkout", async (req, res) => {
  return createSubscriptionCheckoutSession(req, res, "freight");
});

router.post("/create-customer-subscription-checkout", async (req, res) => {
  return createSubscriptionCheckoutSession(req, res, "customer");
});

/* =====================================================
   FARMER APPLICATION FEE CHECKOUT
===================================================== */

async function createFarmerApplicationFeeCheckout(req, res) {
  try {
    if (!requireStripe(res)) return;

    const { farmerId, email, farmerEmail, farmName, businessName, ownerName } =
      req.body || {};

    const finalFarmerId = cleanString(farmerId);
    const finalEmail = cleanString(email || farmerEmail).toLowerCase();
    const finalFarmName = cleanString(farmName || businessName);

    if (!finalFarmerId) {
      return res.status(400).json({
        success: false,
        error: "farmerId is required.",
      });
    }

    const priceId = process.env.STRIPE_FARMER_APPLICATION_FEE_PRICE_ID;

    if (!priceId) {
      return res.status(500).json({
        success: false,
        error: "STRIPE_FARMER_APPLICATION_FEE_PRICE_ID missing.",
      });
    }

    const successUrl = appendQueryParams(`${APP_URL}/farmer/compliance-upload`, {
      farmerId: finalFarmerId,
      email: finalEmail,
      businessName: finalFarmName,
      applicationFeeReturn: "true",
      session_id: "{CHECKOUT_SESSION_ID}",
    });

    const cancelUrl = appendQueryParams(`${APP_URL}/farmer/compliance-upload`, {
      farmerId: finalFarmerId,
      email: finalEmail,
      businessName: finalFarmName,
      applicationFeeCanceled: "true",
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: finalEmail || undefined,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        role: "farmer",
        planType: "farmer_application",
        paymentType: "farmer_application_fee",
        farmerId: finalFarmerId,
        userId: finalFarmerId,
        email: finalEmail || "",
        farmName: finalFarmName || "",
        businessName: finalFarmName || "",
        ownerName: cleanString(ownerName),
      },
    });

    return res.json({
      success: true,
      id: session.id,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error("create-farmer-application-fee-checkout error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to create application fee checkout.",
    });
  }
}

router.post(
  "/create-farmer-application-fee-checkout",
  createFarmerApplicationFeeCheckout
);

router.post(
  "/payments/create-farmer-application-fee-checkout",
  createFarmerApplicationFeeCheckout
);

/* =====================================================
   VERIFY FARMER APPLICATION FEE
===================================================== */

router.post("/verify-farmer-application-fee", async (req, res) => {
  try {
    if (!requireSupabase(res)) return;

    const { farmerId, farmerEmail, email, sessionId } = req.body || {};

    const finalFarmerId = cleanString(farmerId);
    const finalEmail = cleanString(farmerEmail || email).toLowerCase();

    if (sessionId && stripe) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status === "paid") {
        const metadata = session.metadata || {};

        const paidFarmerId =
          cleanString(metadata.farmerId) ||
          cleanString(metadata.userId) ||
          finalFarmerId;

        if (paidFarmerId) {
          await updateFarmerPaymentStatus({
            farmerId: paidFarmerId,
            paymentType: "farmer_application_fee",
            paid: true,
          });
        }

        return res.json({
          success: true,
          paid: true,
          paymentStatus: session.payment_status,
          sessionId,
        });
      }
    }

    if (!finalFarmerId && !finalEmail) {
      return res.status(400).json({
        success: false,
        error: "farmerId or email required.",
      });
    }

    let query = supabase.from("admin_verifications").select("*").limit(1);

    if (finalFarmerId) {
      query = query.eq("farmer_id", finalFarmerId);
    } else {
      query = query.eq("email", finalEmail);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    const paid = Boolean(data?.application_fee_paid);

    return res.json({
      success: true,
      paid,
      verification: data || null,
    });
  } catch (error) {
    console.error("verify-farmer-application-fee error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to verify application fee.",
    });
  }
});

router.post("/check-subscription", async (req, res) => {
  try {
    if (!requireSupabase(res)) return;

    const { role = "customer", userId, email } = req.body || {};

    const config = getSubscriptionConfig(role);

    let query = supabase
      .from(config.table)
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (userId) {
      query = query.eq(config.idColumn, userId);
    } else if (email) {
      query = query.eq(config.emailColumn, cleanString(email).toLowerCase());
    } else {
      return res.json({
        success: true,
        active: false,
        allowed: false,
        locked: true,
        status: "",
        reason: "No subscription found.",
      });
    }

    const { data } = await query.maybeSingle();

    const status = data?.subscription_status || "";
    const active = String(status).toLowerCase() === "active";

    return res.json({
      success: true,
      active,
      allowed: active,
      locked: !active,
      status,
      reason: active ? "" : "Subscription inactive.",
      subscription: data || null,
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

    if (session.payment_status === "paid" && role === "farmer") {
      await updateFarmerPaymentStatus({
        farmerId: metadata.farmerId || metadata.userId,
        paymentType,
        paid: true,
      });
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

router.post("/create-farmer-connect-account", async (req, res) => {
  try {
    if (!requireStripe(res)) return;

    const { farmerId, email, farmName, businessName, existingStripeAccountId } =
      req.body || {};

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

    let activeAccountId = cleanString(stripeAccountId) || cleanString(accountId);

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

    const onboardingComplete = Boolean(account.details_submitted);

    if (finalFarmerId) {
      await updateFarmerStripeInSupabase({
        farmerId: finalFarmerId,
        stripeAccountId: activeAccountId,
        payoutsEnabled: account.payouts_enabled,
        chargesEnabled: account.charges_enabled,
        onboardingComplete,
        complianceStatus: onboardingComplete ? "stripe_complete" : "stripe_pending",
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

    const groupedFarmers = {};

    for (const item of cart) {
      const farmerStripeAccountId =
        item.farmerStripeAccountId ||
        item.stripeAccountId ||
        item.farmer_stripe_account_id ||
        "";

      if (!farmerStripeAccountId) {
        throw new Error(`Missing farmerStripeAccountId for cart item: ${item.name || item.id}`);
      }

      if (!groupedFarmers[farmerStripeAccountId]) {
        groupedFarmers[farmerStripeAccountId] = {
          farmerStripeAccountId,
          farmName: item.farmName || item.farmerName || item.farm_name || "Farm2Home Farm",
          items: [],
          subtotal: 0,
        };
      }

      groupedFarmers[farmerStripeAccountId].items.push(item);
      groupedFarmers[farmerStripeAccountId].subtotal +=
        safeNumber(item.price, 0) * safeNumber(item.quantity, 1);
    }

    const lineItems = cart.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: item.name || item.productName || "Farm2Home Item",
          description: item.farmName || item.farmerName || "Farm2Home Farm",
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

    pendingMarketplaceSplits.set(session.id, {
      orderId: finalOrderId,
      customerId: cleanString(customerId),
      customerEmail: cleanString(customerEmail).toLowerCase(),
      groupedFarmers: Object.values(groupedFarmers),
      deliveryFee: safeNumber(deliveryFee, 0),
      processed: false,
    });

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

router.post("/create-customer-portal-session", async (req, res) => {
  try {
    if (!requireStripe(res)) return;

    const { customerId, returnUrl } = req.body || {};

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: "customerId is required.",
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${APP_URL}/customer/profile`,
    });

    return res.json({
      success: true,
      url: session.url,
    });
  } catch (error) {
    console.error("create-customer-portal-session error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to create billing portal session.",
    });
  }
});

router.post("/cancel-subscription", async (req, res) => {
  try {
    if (!requireStripe(res)) return;

    const {
      subscriptionId,
      role = "customer",
      userId,
      customerId,
      farmerId,
      freightId,
      driverId,
    } = req.body || {};

    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        error: "subscriptionId is required.",
      });
    }

    const subscription = await stripe.subscriptions.cancel(subscriptionId);
    const normalizedRole = normalizeRole(role);

    const finalUserId =
      cleanString(userId) ||
      cleanString(customerId) ||
      cleanString(farmerId) ||
      cleanString(freightId) ||
      cleanString(driverId);

    if (normalizedRole === "farmer" && finalUserId) {
      await updateFarmerPaymentStatus({
        farmerId: finalUserId,
        paymentType: "farmer_monthly_subscription",
        paid: false,
      });
    }

    return res.json({
      success: true,
      canceled: true,
      subscription,
    });
  } catch (error) {
    console.error("cancel-subscription error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to cancel subscription.",
    });
  }
});

router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe) {
    return res.status(500).send("Stripe not configured");
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
      const session = event.data.object;
      const metadata = session.metadata || {};

      const role = normalizeRole(metadata.role);
      const paymentType = metadata.paymentType || "subscription";

      if (role === "farmer") {
        await updateFarmerPaymentStatus({
          farmerId: metadata.farmerId || metadata.userId,
          paymentType,
          paid: true,
        });
      }
    }

    if (event.type === "account.updated") {
      const account = event.data.object;
      const farmerId = account.metadata?.farmerId || "";

      if (farmerId) {
        const onboardingComplete = Boolean(account.details_submitted);

        await updateFarmerStripeInSupabase({
          farmerId,
          stripeAccountId: account.id,
          payoutsEnabled: account.payouts_enabled,
          chargesEnabled: account.charges_enabled,
          onboardingComplete,
          complianceStatus: onboardingComplete ? "stripe_complete" : "stripe_pending",
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
});

module.exports = router;