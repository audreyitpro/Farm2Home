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

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        realtime: { transport: ws },
      })
    : null;

const FARM2HOME_SERVICE_FEE_PERCENT = Number(
  process.env.FARM2HOME_SERVICE_FEE_PERCENT || 4
);

const pendingMarketplaceSplits = new Map();

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value) {
  return cleanString(value).toLowerCase();
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toCents(value) {
  return Math.round(safeNumber(value, 0) * 100);
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

function appendQueryParams(baseUrl, params) {
  const url = new URL(baseUrl);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

function getProfileConfig(role) {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === "farmer") {
    return {
      role: "farmer",
      table: "farmers",
      idName: "farmerId",
      defaultName: "Farm2Home Farmer",
      nameColumns: ["farm_name", "business_name", "name"],
    };
  }

  if (normalizedRole === "driver") {
    return {
      role: "driver",
      table: "drivers",
      idName: "driverId",
      defaultName: "Farm2Home Driver",
      nameColumns: ["full_name", "name"],
    };
  }

  if (normalizedRole === "freight") {
    return {
      role: "freight",
      table: "freight_users",
      idName: "freightId",
      defaultName: "Farm2Home Freight Carrier",
      nameColumns: ["company_name", "business_name", "name"],
    };
  }

  return {
    role: "customer",
    table: "customers",
    idName: "customerId",
    defaultName: "Farm2Home Customer",
    nameColumns: ["full_name", "name"],
  };
}

function getSubscriptionConfig(role) {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === "farmer") {
    return {
      role: "farmer",
      table: "farmer_subscriptions",
      profileTable: "farmers",
      idColumn: "farmer_id",
      emailColumn: "farmer_email",
    };
  }

  if (normalizedRole === "driver") {
    return {
      role: "driver",
      table: "driver_subscriptions",
      profileTable: "drivers",
      idColumn: "driver_id",
      emailColumn: "driver_email",
    };
  }

  if (normalizedRole === "freight") {
    return {
      role: "freight",
      table: "freight_subscriptions",
      profileTable: "freight_users",
      idColumn: "freight_id",
      emailColumn: "freight_email",
    };
  }

  return {
    role: "customer",
    table: "customer_subscriptions",
    profileTable: "customers",
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
    };
  }

  if (plan === "freight") {
    return {
      role: "freight",
      mode: "subscription",
      priceId: process.env.STRIPE_FREIGHT_MEMBERSHIP_PRICE_ID,
      missingKey: "STRIPE_FREIGHT_MEMBERSHIP_PRICE_ID",
      successPath: "/freight/subscription-success",
      cancelPath: "/freight/subscription",
      paymentType: "freight_subscription",
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
  };
}

function getConnectRefreshUrl(role) {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === "driver") {
    return process.env.STRIPE_CONNECT_REFRESH_URL_DRIVER || `${APP_URL}/driver/profile`;
  }

  if (normalizedRole === "freight") {
    return process.env.STRIPE_CONNECT_REFRESH_URL_FREIGHT || `${APP_URL}/freight/profile`;
  }

  return process.env.STRIPE_CONNECT_REFRESH_URL || `${APP_URL}/farmer/compliance-upload`;
}

function getConnectReturnUrl(role) {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === "driver") {
    return process.env.STRIPE_CONNECT_RETURN_URL_DRIVER || `${APP_URL}/driver/profile`;
  }

  if (normalizedRole === "freight") {
    return process.env.STRIPE_CONNECT_RETURN_URL_FREIGHT || `${APP_URL}/freight/profile`;
  }

  return process.env.STRIPE_CONNECT_RETURN_URL || `${APP_URL}/farmer/compliance-upload`;
}

async function stripeAccountExists(accountId) {
  if (!stripe || !accountId) return false;

  try {
    const account = await stripe.accounts.retrieve(accountId);
    return Boolean(account?.id);
  } catch {
    return false;
  }
}

async function getStripeCustomer(customerId) {
  if (!stripe || !customerId) return null;

  try {
    return await stripe.customers.retrieve(customerId);
  } catch {
    return null;
  }
}

async function findProfile({ role, profileId, email }) {
  if (!supabase) return null;

  const config = getProfileConfig(role);
  const id = cleanString(profileId);
  const cleanEmail = normalizeEmail(email);

  if (id) {
    const byId = await supabase
      .from(config.table)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!byId.error && byId.data) return byId.data;
  }

  if (id) {
    const byProfileId = await supabase
      .from(config.table)
      .select("*")
      .eq("profile_id", id)
      .maybeSingle();

    if (!byProfileId.error && byProfileId.data) return byProfileId.data;
  }

  if (cleanEmail) {
    const byEmail = await supabase
      .from(config.table)
      .select("*")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (!byEmail.error && byEmail.data) return byEmail.data;
  }

  return null;
}

async function upsertProfile({
  role,
  profileId,
  email,
  name,
  stripeAccountId,
  stripeCustomerId,
  stripeSubscriptionId,
  subscriptionStatus,
  membershipStatus,
  accountActive,
  payoutsEnabled,
  chargesEnabled,
  onboardingComplete,
  complianceStatus,
}) {
  if (!supabase) return null;

  const config = getProfileConfig(role);
  const cleanProfileId = cleanString(profileId);
  const cleanEmail = normalizeEmail(email);
  const displayName = cleanString(name) || config.defaultName;

  const payload = {
    role: config.role,
    updated_at: new Date().toISOString(),
  };

  if (cleanEmail) payload.email = cleanEmail;

  if (stripeAccountId !== undefined) {
    payload.stripe_account_id = stripeAccountId || null;
    payload.stripe_connect_status = stripeAccountId ? "created" : "not_started";
  }

  if (stripeCustomerId !== undefined) {
    payload.stripe_customer_id = stripeCustomerId || null;
  }

  if (stripeSubscriptionId !== undefined) {
    payload.stripe_subscription_id = stripeSubscriptionId || null;
  }

  if (subscriptionStatus !== undefined) {
    payload.subscription_status = subscriptionStatus || "not_started";
  }

  if (membershipStatus !== undefined) {
    payload.membership_status = membershipStatus || "not_started";
  }

  if (accountActive !== undefined) {
    payload.account_active = Boolean(accountActive);
  }

  if (payoutsEnabled !== undefined) {
    payload.payouts_enabled = Boolean(payoutsEnabled);
    payload.stripe_payouts_enabled = Boolean(payoutsEnabled);
  }

  if (chargesEnabled !== undefined) {
    payload.charges_enabled = Boolean(chargesEnabled);
    payload.stripe_charges_enabled = Boolean(chargesEnabled);
  }

  if (onboardingComplete !== undefined) {
    payload.stripe_onboarding_complete = Boolean(onboardingComplete);
  }

  if (complianceStatus !== undefined) {
    payload.compliance_status = complianceStatus;
  }

  config.nameColumns.forEach((column) => {
    payload[column] = displayName;
  });

  let matchedId = cleanProfileId;

  if (cleanProfileId) {
    const updated = await supabase
      .from(config.table)
      .update(payload)
      .eq("id", cleanProfileId)
      .select("id")
      .maybeSingle();

    if (!updated.error && updated.data?.id) {
      matchedId = updated.data.id;
      return updated.data;
    }
  }

  if (cleanEmail) {
    const updatedByEmail = await supabase
      .from(config.table)
      .update(payload)
      .eq("email", cleanEmail)
      .select("id")
      .maybeSingle();

    if (!updatedByEmail.error && updatedByEmail.data?.id) {
      matchedId = updatedByEmail.data.id;
      return updatedByEmail.data;
    }
  }

  if (cleanProfileId) {
    const insertPayload = {
      id: cleanProfileId,
      profile_id: cleanProfileId,
      ...payload,
      created_at: new Date().toISOString(),
    };

    const inserted = await supabase
      .from(config.table)
      .upsert(insertPayload, { onConflict: "id" })
      .select("id")
      .maybeSingle();

    if (inserted.error) {
      console.log(`${config.table} profile upsert failed:`, inserted.error.message);
      return null;
    }

    matchedId = inserted.data?.id || cleanProfileId;
  }

  if (config.role === "farmer" && matchedId) {
    await supabase
      .from("admin_verifications")
      .update(payload)
      .or(`farmer_id.eq.${matchedId},id.eq.${matchedId}`);
  }

  return { id: matchedId };
}

async function updateFarmerApplicationPayment(session) {
  if (!supabase) return;

  const metadata = session.metadata || {};
  const farmerId = cleanString(metadata.farmerId || metadata.userId);
  const email = normalizeEmail(
    metadata.email || session.customer_details?.email || session.customer_email
  );

  const stripeCustomerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id || null;

  const payload = {
    farmer_id: farmerId || null,
    farmer_email: email || null,
    stripe_session_id: session.id,
    stripe_customer_id: stripeCustomerId,
    payment_status: session.payment_status || "paid",
    application_status: "payment_completed",
    paid_at: new Date((session.created || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };

  const paymentResult = await supabase
    .from("farmer_application_payments")
    .upsert(payload, {
      onConflict: farmerId ? "farmer_id" : "stripe_session_id",
    });

  if (paymentResult.error) {
    console.log("farmer_application_payments upsert failed:", paymentResult.error.message);
  }

  await upsertProfile({
    role: "farmer",
    profileId: farmerId,
    email,
    name: metadata.businessName || metadata.farmName || metadata.name,
    stripeCustomerId,
    membershipStatus: "application_fee_paid",
    subscriptionStatus: "not_started",
    accountActive: false,
  });

  const farmerUpdate = {
    application_fee_paid: true,
    farmer_membership_paid: false,
    monthly_membership_started: false,
    stripe_customer_id: stripeCustomerId,
    updated_at: new Date().toISOString(),
  };

  if (farmerId) {
    await supabase.from("farmers").update(farmerUpdate).eq("id", farmerId);
    await supabase.from("admin_verifications").update(farmerUpdate).eq("farmer_id", farmerId);
  }

  if (email) {
    await supabase.from("farmers").update(farmerUpdate).eq("email", email);
    await supabase.from("admin_verifications").update(farmerUpdate).eq("email", email);
  }
}

async function saveSubscriptionFromStripe({ subscription, session, roleOverride }) {
  if (!supabase) return;

  const metadata = {
    ...(subscription?.metadata || {}),
    ...(session?.metadata || {}),
  };

  const role = normalizeRole(roleOverride || metadata.role || "customer");
  const config = getSubscriptionConfig(role);

  const userId =
    cleanString(metadata.userId) ||
    cleanString(metadata.customerId) ||
    cleanString(metadata.farmerId) ||
    cleanString(metadata.driverId) ||
    cleanString(metadata.freightId);

  const email = normalizeEmail(
    metadata.email ||
      session?.customer_details?.email ||
      session?.customer_email ||
      subscription?.customer_email
  );

  const stripeCustomerId =
    typeof subscription?.customer === "string"
      ? subscription.customer
      : typeof session?.customer === "string"
      ? session.customer
      : "";

  const stripeSubscriptionId =
    typeof subscription?.id === "string"
      ? subscription.id
      : typeof session?.subscription === "string"
      ? session.subscription
      : "";

  let expandedSubscription = subscription;

  if (!expandedSubscription && stripeSubscriptionId && stripe) {
    expandedSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  }

  const item = expandedSubscription?.items?.data?.[0];
  const priceId = item?.price?.id || metadata.priceId || "";

  const status = expandedSubscription?.status || "active";
  const active = ["active", "trialing"].includes(String(status).toLowerCase());

  const currentPeriodStart = expandedSubscription?.current_period_start
    ? new Date(expandedSubscription.current_period_start * 1000).toISOString()
    : null;

  const currentPeriodEnd = expandedSubscription?.current_period_end
    ? new Date(expandedSubscription.current_period_end * 1000).toISOString()
    : null;

  const subscriptionPayload = {
    [config.idColumn]: userId || null,
    [config.emailColumn]: email || null,
    email: email || null,
    stripe_customer_id: stripeCustomerId || null,
    stripe_subscription_id: stripeSubscriptionId || null,
    subscription_status: status,
    status,
    price_id: priceId || null,
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    updated_at: new Date().toISOString(),
  };

  if (stripeSubscriptionId) {
    const result = await supabase
      .from(config.table)
      .upsert(subscriptionPayload, { onConflict: "stripe_subscription_id" });

    if (result.error) {
      console.log(`${config.table} upsert failed:`, result.error.message);
    }
  }

  await upsertProfile({
    role,
    profileId: userId,
    email,
    name: metadata.name || metadata.companyName || metadata.businessName || metadata.farmName,
    stripeCustomerId,
    stripeSubscriptionId,
    subscriptionStatus: status,
    membershipStatus: active ? "active" : status,
    accountActive: active,
  });

  if (role === "farmer") {
    const farmerUpdate = {
      stripe_customer_id: stripeCustomerId || null,
      stripe_subscription_id: stripeSubscriptionId || null,
      subscription_status: status,
      membership_status: active ? "active" : status,
      farmer_membership_paid: active,
      monthly_membership_started: active,
      farmer_monthly_subscription_paid: active,
      subscription_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (active) farmerUpdate.membership_started_at = new Date().toISOString();

    if (userId) {
      await supabase.from("farmers").update(farmerUpdate).eq("id", userId);
      await supabase.from("admin_verifications").update(farmerUpdate).eq("farmer_id", userId);
    }

    if (email) {
      await supabase.from("farmers").update(farmerUpdate).eq("email", email);
      await supabase.from("admin_verifications").update(farmerUpdate).eq("email", email);
    }
  }
}

async function updateSubscriptionFromInvoice(invoice) {
  if (!supabase) return;

  const customerId = typeof invoice.customer === "string" ? invoice.customer : "";
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.parent?.subscription_details?.subscription || "";

  const customerEmail = normalizeEmail(invoice.customer_email);
  const description =
    invoice.lines?.data?.[0]?.description ||
    invoice.description ||
    "";

  let role = "customer";
  const desc = description.toLowerCase();

  if (desc.includes("freight")) role = "freight";
  else if (desc.includes("driver")) role = "driver";
  else if (desc.includes("farmer")) role = "farmer";

  let subscription = null;

  if (subscriptionId && stripe) {
    try {
      subscription = await stripe.subscriptions.retrieve(subscriptionId);
    } catch {
      subscription = null;
    }
  }

  await saveSubscriptionFromStripe({
    subscription:
      subscription || {
        id: subscriptionId,
        customer: customerId,
        status: invoice.paid || invoice.status === "paid" ? "active" : invoice.status || "open",
        metadata: { role, email: customerEmail },
      },
    session: {
      customer: customerId,
      customer_email: customerEmail,
      metadata: { role, email: customerEmail },
    },
    roleOverride: role,
  });
}

async function handleCheckoutSessionCompleted(session) {
  const metadata = session.metadata || {};
  const role = normalizeRole(metadata.role || "customer");
  const paymentType = metadata.paymentType || "subscription";

  if (role === "farmer" && paymentType === "farmer_application_fee") {
    await updateFarmerApplicationPayment(session);
    return;
  }

  if (session.mode === "subscription" || paymentType.includes("subscription")) {
    let subscription = null;

    if (session.subscription && stripe) {
      subscription = await stripe.subscriptions.retrieve(session.subscription);
    }

    await saveSubscriptionFromStripe({
      subscription,
      session,
      roleOverride: role,
    });

    return;
  }
}

router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Payments routes running",
    appUrl: APP_URL,
    apiBaseUrl: API_BASE_URL,
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    webhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
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
      companyName,
      businessName,
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

    if (supabase && finalUserId) {
      const profile = await findProfile({
        role: config.role,
        profileId: finalUserId,
        email: finalEmail,
      });

      stripeCustomerId = profile?.stripe_customer_id || "";
    }

    if (!stripeCustomerId && finalEmail && stripe) {
      const customers = await stripe.customers.list({
        email: finalEmail,
        limit: 1,
      });

      stripeCustomerId = customers?.data?.[0]?.id || "";
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
        },
      });

      stripeCustomerId = customer.id;
    }

    await upsertProfile({
      role: config.role,
      profileId: finalUserId,
      email: finalEmail,
      name: finalName,
      stripeCustomerId,
      membershipStatus: "pending_payment",
      subscriptionStatus: "pending_payment",
      accountActive: false,
    });

    const successUrl = appendQueryParams(`${APP_URL}${config.successPath}`, {
      checkout_success: "true",
      session_id: "{CHECKOUT_SESSION_ID}",
      planType: finalPlanType,
      role: config.role,
      userId: finalUserId,
      farmerId: cleanString(farmerId) || undefined,
      freightId: cleanString(freightId) || undefined,
      driverId: cleanString(driverId) || undefined,
    });

    const cancelUrl = appendQueryParams(`${APP_URL}${config.cancelPath}`, {
      checkout_canceled: "true",
      planType: finalPlanType,
      role: config.role,
      userId: finalUserId,
    });

    const metadata = {
      role: config.role,
      planType: cleanString(finalPlanType),
      paymentType: config.paymentType,
      userId: finalUserId || "",
      customerId: cleanString(customerId) || "",
      farmerId: cleanString(farmerId) || "",
      freightId: cleanString(freightId) || "",
      driverId: cleanString(driverId) || "",
      email: finalEmail || "",
      name: finalName || "",
      username: cleanString(username),
      companyName: cleanString(companyName || businessName),
    };

    const session = await stripe.checkout.sessions.create({
      mode: config.mode,
      payment_method_types: ["card"],
      customer: stripeCustomerId,
      line_items: [{ price: config.priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      subscription_data:
        config.mode === "subscription"
          ? {
              metadata,
            }
          : undefined,
    });

    return res.json({
      success: true,
      id: session.id,
      sessionId: session.id,
      url: session.url,
      stripeCustomerId,
      customerId: stripeCustomerId,
    });
  } catch (error) {
    console.error("create checkout error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Unable to create checkout session.",
    });
  }
}

router.post("/create-subscription-checkout", (req, res) =>
  createSubscriptionCheckoutSession(req, res)
);

router.post("/create-farmer-membership-checkout", (req, res) =>
  createSubscriptionCheckoutSession(req, res, "farmer_monthly")
);

router.post("/create-driver-subscription-checkout", (req, res) =>
  createSubscriptionCheckoutSession(req, res, "driver")
);

router.post("/create-freight-subscription-checkout", (req, res) =>
  createSubscriptionCheckoutSession(req, res, "freight")
);

router.post("/create-customer-subscription-checkout", (req, res) =>
  createSubscriptionCheckoutSession(req, res, "customer")
);

router.post("/create-farmer-application-fee-checkout", async (req, res) => {
  try {
    if (!requireStripe(res)) return;

    const { farmerId, email, farmerEmail, farmName, businessName, ownerName } =
      req.body || {};

    const finalFarmerId = cleanString(farmerId);
    const finalEmail = normalizeEmail(email || farmerEmail);
    const finalFarmName = cleanString(farmName || businessName || ownerName);

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

    let stripeCustomerId = "";

    if (supabase) {
      const profile = await findProfile({
        role: "farmer",
        profileId: finalFarmerId,
        email: finalEmail,
      });

      stripeCustomerId = profile?.stripe_customer_id || "";
    }

    if (!stripeCustomerId && finalEmail) {
      const customers = await stripe.customers.list({ email: finalEmail, limit: 1 });
      stripeCustomerId = customers?.data?.[0]?.id || "";
    }

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: finalEmail || undefined,
        name: finalFarmName || undefined,
        metadata: {
          role: "farmer",
          farmerId: finalFarmerId,
          userId: finalFarmerId,
          email: finalEmail,
        },
      });

      stripeCustomerId = customer.id;
    }

    await upsertProfile({
      role: "farmer",
      profileId: finalFarmerId,
      email: finalEmail,
      name: finalFarmName,
      stripeCustomerId,
      membershipStatus: "application_fee_pending",
      subscriptionStatus: "not_started",
      accountActive: false,
    });

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
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
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
      stripeCustomerId,
    });
  } catch (error) {
    console.error("create-farmer-application-fee-checkout error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Unable to create application fee checkout.",
    });
  }
});

router.post("/payments/create-farmer-application-fee-checkout", (req, res) => {
  req.url = "/create-farmer-application-fee-checkout";
  return router.handle(req, res);
});

router.post("/verify-farmer-application-fee", async (req, res) => {
  try {
    if (!requireSupabase(res)) return;

    const { farmerId, farmerEmail, email, sessionId } = req.body || {};
    const finalFarmerId = cleanString(farmerId);
    const finalEmail = normalizeEmail(farmerEmail || email);

    if (sessionId && stripe) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status === "paid") {
        await updateFarmerApplicationPayment(session);

        return res.json({
          success: true,
          paid: true,
          paymentStatus: session.payment_status,
          sessionId,
        });
      }
    }

    let query = supabase
      .from("farmer_application_payments")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (finalFarmerId) query = query.eq("farmer_id", finalFarmerId);
    else if (finalEmail) query = query.eq("farmer_email", finalEmail);
    else {
      return res.status(400).json({
        success: false,
        error: "farmerId or email required.",
      });
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    return res.json({
      success: true,
      paid: Boolean(data?.payment_status === "paid"),
      payment: data || null,
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

    if (userId) query = query.eq(config.idColumn, userId);
    else if (email) query = query.eq(config.emailColumn, normalizeEmail(email));
    else {
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
    const status = data?.subscription_status || data?.status || "";
    const active = ["active", "trialing"].includes(String(status).toLowerCase());

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
      expand: ["subscription", "payment_intent", "customer"],
    });

    await handleCheckoutSessionCompleted(session);

    return res.json({
      success: true,
      paid: session.payment_status === "paid",
      paymentStatus: session.payment_status,
      mode: session.mode,
      role: normalizeRole(session.metadata?.role),
      paymentType: session.metadata?.paymentType || "",
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

router.post("/create-connect-account", async (req, res) => {
  try {
    if (!requireStripe(res)) return;

    const {
      role = "farmer",
      profileId,
      userId,
      farmerId,
      freightId,
      driverId,
      email,
      businessName,
      farmName,
      companyName,
      existingStripeAccountId,
      stripeAccountId,
      accountId,
    } = req.body || {};

    const normalizedRole = normalizeRole(role);
    const config = getProfileConfig(normalizedRole);

    const finalProfileId =
      cleanString(profileId) ||
      cleanString(userId) ||
      cleanString(farmerId) ||
      cleanString(freightId) ||
      cleanString(driverId);

    const finalEmail = normalizeEmail(email);
    const finalBusinessName =
      cleanString(businessName || farmName || companyName) || config.defaultName;

    if (!finalProfileId && !finalEmail) {
      return res.status(400).json({
        success: false,
        error: "profileId/farmerId/driverId/freightId/email is required.",
      });
    }

    let finalAccountId =
      cleanString(existingStripeAccountId) ||
      cleanString(stripeAccountId) ||
      cleanString(accountId);

    const profile = await findProfile({
      role: normalizedRole,
      profileId: finalProfileId,
      email: finalEmail,
    });

    if (!finalAccountId) {
      finalAccountId = profile?.stripe_account_id || "";
    }

    if (finalAccountId && !(await stripeAccountExists(finalAccountId))) {
      finalAccountId = "";
    }

    if (!finalAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: finalEmail || undefined,
        country: "US",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: finalBusinessName,
          product_description: `Farm2Home ${normalizedRole} payout account`,
        },
        metadata: {
          role: normalizedRole,
          profileId: finalProfileId || "",
          userId: finalProfileId || "",
          farmerId: normalizedRole === "farmer" ? finalProfileId : "",
          driverId: normalizedRole === "driver" ? finalProfileId : "",
          freightId: normalizedRole === "freight" ? finalProfileId : "",
          businessName: finalBusinessName,
          email: finalEmail,
        },
      });

      finalAccountId = account.id;
    }

    await upsertProfile({
      role: normalizedRole,
      profileId: finalProfileId,
      email: finalEmail,
      name: finalBusinessName,
      stripeAccountId: finalAccountId,
      payoutsEnabled: false,
      chargesEnabled: false,
      onboardingComplete: false,
      complianceStatus: "stripe_pending",
    });

    const accountLink = await stripe.accountLinks.create({
      account: finalAccountId,
      refresh_url: appendQueryParams(getConnectRefreshUrl(normalizedRole), {
        stripeReturn: "false",
        role: normalizedRole,
        profileId: finalProfileId,
        [config.idName]: finalProfileId,
        accountId: finalAccountId,
      }),
      return_url: appendQueryParams(getConnectReturnUrl(normalizedRole), {
        stripeReturn: "true",
        role: normalizedRole,
        profileId: finalProfileId,
        [config.idName]: finalProfileId,
        accountId: finalAccountId,
      }),
      type: "account_onboarding",
    });

    return res.json({
      success: true,
      role: normalizedRole,
      profileId: finalProfileId,
      accountId: finalAccountId,
      stripeAccountId: finalAccountId,
      onboardingUrl: accountLink.url,
      url: accountLink.url,
      reusedExistingAccount: Boolean(profile?.stripe_account_id),
    });
  } catch (error) {
    console.error("create-connect-account error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/check-connect-account", async (req, res) => {
  try {
    if (!requireStripe(res)) return;

    const {
      role = "farmer",
      profileId,
      userId,
      farmerId,
      freightId,
      driverId,
      email,
      stripeAccountId,
      accountId,
    } = req.body || {};

    const normalizedRole = normalizeRole(role);

    const finalProfileId =
      cleanString(profileId) ||
      cleanString(userId) ||
      cleanString(farmerId) ||
      cleanString(freightId) ||
      cleanString(driverId);

    const finalEmail = normalizeEmail(email);

    let activeAccountId = cleanString(stripeAccountId) || cleanString(accountId);

    if (!activeAccountId) {
      const profile = await findProfile({
        role: normalizedRole,
        profileId: finalProfileId,
        email: finalEmail,
      });

      activeAccountId = profile?.stripe_account_id || "";
    }

    if (!activeAccountId) {
      return res.json({
        success: true,
        role: normalizedRole,
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
    } catch {
      await upsertProfile({
        role: normalizedRole,
        profileId: finalProfileId,
        email: finalEmail,
        stripeAccountId: null,
        payoutsEnabled: false,
        chargesEnabled: false,
        onboardingComplete: false,
        complianceStatus: "stripe_pending",
      });

      return res.status(404).json({
        success: false,
        role: normalizedRole,
        exists: false,
        error: "No such Stripe account. Please restart Stripe setup.",
      });
    }

    const onboardingComplete = Boolean(account.details_submitted);

    await upsertProfile({
      role: normalizedRole,
      profileId: finalProfileId,
      email: finalEmail,
      name: account.business_profile?.name,
      stripeAccountId: activeAccountId,
      payoutsEnabled: account.payouts_enabled,
      chargesEnabled: account.charges_enabled,
      onboardingComplete,
      complianceStatus: onboardingComplete ? "stripe_complete" : "stripe_pending",
    });

    return res.json({
      success: true,
      role: normalizedRole,
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
    console.error("check-connect-account error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/create-farmer-connect-account", (req, res) => {
  req.body = {
    ...(req.body || {}),
    role: "farmer",
    profileId: req.body?.profileId || req.body?.userId || req.body?.farmerId,
    businessName: req.body?.businessName || req.body?.farmName,
  };
  req.url = "/create-connect-account";
  return router.handle(req, res);
});

router.post("/create-driver-connect-account", (req, res) => {
  req.body = {
    ...(req.body || {}),
    role: "driver",
    profileId: req.body?.profileId || req.body?.userId || req.body?.driverId,
    businessName: req.body?.businessName || req.body?.driverName || req.body?.name,
  };
  req.url = "/create-connect-account";
  return router.handle(req, res);
});

router.post("/create-freight-connect-account", (req, res) => {
  req.body = {
    ...(req.body || {}),
    role: "freight",
    profileId: req.body?.profileId || req.body?.userId || req.body?.freightId,
    businessName: req.body?.businessName || req.body?.companyName,
  };
  req.url = "/create-connect-account";
  return router.handle(req, res);
});

router.post("/create-farmer-onboarding-link", (req, res) => {
  req.body = {
    ...(req.body || {}),
    role: "farmer",
    profileId: req.body?.profileId || req.body?.userId || req.body?.farmerId,
    existingStripeAccountId:
      req.body?.existingStripeAccountId ||
      req.body?.stripeAccountId ||
      req.body?.accountId,
  };
  req.url = "/create-connect-account";
  return router.handle(req, res);
});

router.post("/create-farmer-account-link", (req, res) => {
  req.body = {
    ...(req.body || {}),
    role: "farmer",
    profileId: req.body?.profileId || req.body?.userId || req.body?.farmerId,
    existingStripeAccountId:
      req.body?.existingStripeAccountId ||
      req.body?.stripeAccountId ||
      req.body?.accountId,
  };
  req.url = "/create-connect-account";
  return router.handle(req, res);
});

router.post("/check-farmer-connect-account", (req, res) => {
  req.body = {
    ...(req.body || {}),
    role: "farmer",
    profileId: req.body?.profileId || req.body?.userId || req.body?.farmerId,
  };
  req.url = "/check-connect-account";
  return router.handle(req, res);
});

router.post("/check-driver-connect-account", (req, res) => {
  req.body = {
    ...(req.body || {}),
    role: "driver",
    profileId: req.body?.profileId || req.body?.userId || req.body?.driverId,
  };
  req.url = "/check-connect-account";
  return router.handle(req, res);
});

router.post("/check-freight-connect-account", (req, res) => {
  req.body = {
    ...(req.body || {}),
    role: "freight",
    profileId: req.body?.profileId || req.body?.userId || req.body?.freightId,
  };
  req.url = "/check-connect-account";
  return router.handle(req, res);
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
      customer_email: normalizeEmail(customerEmail) || undefined,
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
        customerEmail: normalizeEmail(customerEmail),
      },
    });

    pendingMarketplaceSplits.set(session.id, {
      orderId: finalOrderId,
      customerId: cleanString(customerId),
      customerEmail: normalizeEmail(customerEmail),
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

    const customer = await getStripeCustomer(customerId);

    if (!customer || customer.deleted) {
      return res.status(404).json({
        success: false,
        error: "Stripe customer was not found.",
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
      email,
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

    await saveSubscriptionFromStripe({
      subscription,
      session: {
        customer: subscription.customer,
        customer_email: normalizeEmail(email),
        metadata: {
          role: normalizedRole,
          userId: finalUserId,
          email: normalizeEmail(email),
        },
      },
      roleOverride: normalizedRole,
    });

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
    console.error("Webhook received but Stripe is not configured.");
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
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        await saveSubscriptionFromStripe({
          subscription,
          roleOverride: normalizeRole(subscription.metadata?.role || "customer"),
        });
        break;
      }

      case "invoice.paid":
      case "invoice.payment_succeeded": {
        await updateSubscriptionFromInvoice(event.data.object);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        await updateSubscriptionFromInvoice({
          ...invoice,
          status: "past_due",
          paid: false,
        });
        break;
      }

      case "account.updated": {
        const account = event.data.object;
        const metadata = account.metadata || {};
        const role = normalizeRole(metadata.role || "farmer");

        const profileId =
          cleanString(metadata.profileId) ||
          cleanString(metadata.userId) ||
          cleanString(metadata.farmerId) ||
          cleanString(metadata.driverId) ||
          cleanString(metadata.freightId);

        await upsertProfile({
          role,
          profileId,
          email: metadata.email,
          name: metadata.businessName || metadata.farmName,
          stripeAccountId: account.id,
          payoutsEnabled: account.payouts_enabled,
          chargesEnabled: account.charges_enabled,
          onboardingComplete: Boolean(account.details_submitted),
          complianceStatus: account.details_submitted ? "stripe_complete" : "stripe_pending",
        });

        break;
      }

      default: {
        console.log(`Stripe webhook ignored event: ${event.type}`);
        break;
      }
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