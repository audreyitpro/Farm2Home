// backend/routes/payments.js

const express = require("express");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

router.use((req, res, next) => {
  if (req.originalUrl.includes("/payments/webhook")) {
    return next();
  }

  return express.json({ limit: "2mb" })(req, res, next);
});

const APP_URL = process.env.APP_URL || "https://farm2home-rho.vercel.app";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;

function clean(value) {
  return String(value || "").trim();
}

function cleanEmail(value) {
  return clean(value).toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function escapeStripeSearch(value) {
  return String(value || "").replace(/'/g, "\\'");
}

function toStripeTimestampIso(seconds) {
  if (!seconds) return null;
  return new Date(Number(seconds) * 1000).toISOString();
}

function requireStripe(res) {
  if (!stripe) {
    res.status(500).json({
      success: false,
      error: "STRIPE_SECRET_KEY missing.",
    });
    return false;
  }

  return true;
}

function requireSupabase(res) {
  if (!supabase) {
    res.status(500).json({
      success: false,
      error: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing.",
    });
    return false;
  }

  return true;
}

function isActiveSubscriptionStatus(status) {
  return ["active", "trialing", "past_due"].includes(clean(status).toLowerCase());
}

function isPaidStatus(status) {
  return isActiveSubscriptionStatus(status);
}

function getTableForRole(role) {
  const r = clean(role).toLowerCase();

  if (r === "freight") return "freight_users";
  if (r === "driver") return "drivers";
  if (r === "farmer") return "farmers";
  if (r === "customer") return "customers";

  return null;
}

function getIdColumnsForRole(role) {
  const r = clean(role).toLowerCase();

  if (r === "freight") return ["id", "freight_id", "profile_id", "auth_user_id"];
  if (r === "driver") return ["id", "driver_id", "profile_id", "auth_user_id"];
  if (r === "farmer") return ["id", "farmer_id", "profile_id", "auth_user_id"];
  if (r === "customer") return ["id", "customer_id", "profile_id", "auth_user_id"];

  return ["id", "profile_id", "auth_user_id"];
}

function getPriceIdForRole(role, planType) {
  const r = clean(role).toLowerCase();
  const p = clean(planType).toLowerCase();

  if (r === "freight") return process.env.STRIPE_FREIGHT_MEMBERSHIP_PRICE_ID;

  if (r === "driver") {
    return (
      process.env.STRIPE_DRIVER_MEMBERSHIP_PRICE_ID ||
      process.env.STRIPE_DRIVER_BOARD_PRICE_ID
    );
  }

  if (r === "customer") return process.env.STRIPE_CUSTOMER_MEMBERSHIP_PRICE_ID;

  if (r === "farmer" && p.includes("application")) {
    return process.env.STRIPE_FARMER_APPLICATION_FEE_PRICE_ID;
  }

  if (r === "farmer") {
    return (
      process.env.STRIPE_FARMER_MEMBERSHIP_PRICE_ID ||
      process.env.STRIPE_FARMER_MONTHLY_SUBSCRIPTION_PRICE_ID ||
      process.env.STRIPE_FARMER_SUBSCRIPTION_PRICE_ID
    );
  }

  return null;
}

function getCheckoutMode(role, planType) {
  const r = clean(role).toLowerCase();
  const p = clean(planType).toLowerCase();

  if (r === "farmer" && p.includes("application")) return "payment";
  return "subscription";
}

function getRoleIdFromBody(body, role) {
  const r = clean(role).toLowerCase();

  if (r === "freight") {
    return clean(
      body.freightId ||
        body.freight_id ||
        body.userId ||
        body.profileId ||
        body.authUserId
    );
  }

  if (r === "driver") {
    return clean(
      body.driverId ||
        body.driver_id ||
        body.userId ||
        body.profileId ||
        body.authUserId
    );
  }

  if (r === "farmer") {
    return clean(
      body.farmerId ||
        body.farmer_id ||
        body.userId ||
        body.profileId ||
        body.authUserId
    );
  }

  if (r === "customer") {
    return clean(
      body.customerId ||
        body.customer_id ||
        body.userId ||
        body.profileId ||
        body.authUserId
    );
  }

  return clean(body.userId || body.profileId || body.authUserId);
}

function getRoleIdFromMetadata(metadata, role) {
  const r = clean(role).toLowerCase();

  if (r === "freight") {
    return clean(
      metadata.freightId ||
        metadata.freight_id ||
        metadata.userId ||
        metadata.profileId ||
        metadata.authUserId
    );
  }

  if (r === "driver") {
    return clean(
      metadata.driverId ||
        metadata.driver_id ||
        metadata.userId ||
        metadata.profileId ||
        metadata.authUserId
    );
  }

  if (r === "farmer") {
    return clean(
      metadata.farmerId ||
        metadata.farmer_id ||
        metadata.userId ||
        metadata.profileId ||
        metadata.authUserId
    );
  }

  if (r === "customer") {
    return clean(
      metadata.customerId ||
        metadata.customer_id ||
        metadata.userId ||
        metadata.profileId ||
        metadata.authUserId
    );
  }

  return clean(metadata.userId || metadata.profileId || metadata.authUserId);
}

async function safeUpdateByIdOrEmail(table, idColumns, idValue, finalEmail, payload) {
  if (!supabase) return { data: null, error: null };

  let query = supabase.from(table).update(payload);

  if (idValue) {
    query = query.or(idColumns.map((col) => `${col}.eq.${idValue}`).join(","));
  } else if (finalEmail) {
    query = query.eq("email", finalEmail);
  } else {
    return {
      data: null,
      error: new Error(`No ID or email supplied for ${table} update.`),
    };
  }

  return await query.select();
}

async function updateProfileByIdOrEmail(idValue, finalEmail, payload) {
  if (!supabase) return;

  if (idValue) {
    await supabase
      .from("profiles")
      .update(payload)
      .or(`id.eq.${idValue},auth_user_id.eq.${idValue},profile_id.eq.${idValue}`);
    return;
  }

  if (finalEmail) {
    await supabase.from("profiles").update(payload).eq("email", finalEmail);
  }
}

async function updateAdminVerificationByIdOrEmail(idValue, finalEmail, payload) {
  if (!supabase) return;

  if (idValue) {
    await supabase
      .from("admin_verifications")
      .update(payload)
      .or(
        `id.eq.${idValue},freight_id.eq.${idValue},profile_id.eq.${idValue},carrier_id.eq.${idValue}`
      );
    return;
  }

  if (finalEmail) {
    await supabase.from("admin_verifications").update(payload).eq("email", finalEmail);
  }
}

async function updateRoleTable({ role, userId, email, payload }) {
  const table = getTableForRole(role);

  if (!table) {
    return { data: null, error: new Error(`No table for role ${role}`) };
  }

  return await safeUpdateByIdOrEmail(table, getIdColumnsForRole(role), userId, email, payload);
}

async function updateFreightSubscriptionConnectAccount({
  freightId,
  email,
  stripeCustomerId,
  stripeAccountId,
}) {
  const finalStripeAccountId = clean(stripeAccountId);

  if (!finalStripeAccountId || !finalStripeAccountId.startsWith("acct_")) return;

  const filters = [];

  if (freightId) filters.push(`freight_id.eq.${freightId}`);
  if (email) filters.push(`freight_email.eq.${email}`);
  if (stripeCustomerId) filters.push(`stripe_customer_id.eq.${stripeCustomerId}`);

  if (!filters.length) return;

  const { error } = await supabase
    .from("freight_subscriptions")
    .update({
      stripe_account_id: finalStripeAccountId,
      updated_at: nowIso(),
    })
    .or(filters.join(","));

  if (error) {
    console.log("freight_subscriptions stripe_account_id update skipped:", error.message);
  }
}

async function upsertFreightSubscriptionRow({
  freightId,
  freightEmail,
  name,
  username,
  stripeCustomerId,
  stripeSubscriptionId,
  stripeAccountId,
  subscriptionStatus,
  currentPeriodEnd,
}) {
  if (!supabase) return null;

  const finalFreightId = clean(freightId);
  const finalStripeCustomerId = clean(stripeCustomerId);
  const finalStripeSubscriptionId = clean(stripeSubscriptionId);
  const finalStripeAccountId = clean(stripeAccountId);

  if (!finalFreightId || !finalStripeCustomerId || !finalStripeSubscriptionId) {
    return null;
  }

  const now = nowIso();

  const payload = {
    freight_id: finalFreightId,
    freight_email: cleanEmail(freightEmail),
    name: clean(name),
    username: clean(username),
    stripe_customer_id: finalStripeCustomerId,
    stripe_subscription_id: finalStripeSubscriptionId,
    subscription_status: clean(subscriptionStatus || "active"),
    current_period_end:
      typeof currentPeriodEnd === "number"
        ? toStripeTimestampIso(currentPeriodEnd)
        : currentPeriodEnd || null,
    updated_at: now,
  };

  if (finalStripeAccountId && finalStripeAccountId.startsWith("acct_")) {
    payload.stripe_account_id = finalStripeAccountId;
  }

  const { data: existingBySub, error: existingSubError } = await supabase
    .from("freight_subscriptions")
    .select("id")
    .eq("stripe_subscription_id", finalStripeSubscriptionId)
    .maybeSingle();

  if (existingSubError) throw existingSubError;

  if (existingBySub?.id) {
    const { data, error } = await supabase
      .from("freight_subscriptions")
      .update(payload)
      .eq("id", existingBySub.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data: existingByFreight, error: existingFreightError } = await supabase
    .from("freight_subscriptions")
    .select("id")
    .eq("freight_id", finalFreightId)
    .maybeSingle();

  if (existingFreightError) throw existingFreightError;

  if (existingByFreight?.id) {
    const { data, error } = await supabase
      .from("freight_subscriptions")
      .update(payload)
      .eq("id", existingByFreight.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("freight_subscriptions")
    .insert([{ ...payload, created_at: now }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function findStripeCustomerByEmail(email) {
  const finalEmail = cleanEmail(email);
  if (!finalEmail || !stripe) return null;

  const listed = await stripe.customers.list({
    email: finalEmail,
    limit: 1,
  });

  if (listed?.data?.[0]) return listed.data[0];

  try {
    const searched = await stripe.customers.search({
      query: `email:'${escapeStripeSearch(finalEmail)}'`,
      limit: 1,
    });

    return searched?.data?.[0] || null;
  } catch (error) {
    console.log("Stripe customer email search skipped:", error.message);
    return null;
  }
}

async function findStripeCustomerByBusinessName(businessName) {
  const finalName = clean(businessName);
  if (!finalName || !stripe) return null;

  try {
    const searched = await stripe.customers.search({
      query: `name:'${escapeStripeSearch(finalName)}'`,
      limit: 1,
    });

    if (searched?.data?.[0]) return searched.data[0];
  } catch (error) {
    console.log("Stripe customer business name search skipped:", error.message);
  }

  try {
    const listed = await stripe.customers.list({ limit: 100 });
    const normalizedName = finalName.toLowerCase();

    return (
      listed?.data?.find((customer) => {
        const name = clean(customer.name).toLowerCase();
        const description = clean(customer.description).toLowerCase();
        const metadataBusiness = clean(
          customer.metadata?.business_name || customer.metadata?.company_name
        ).toLowerCase();

        return (
          name.includes(normalizedName) ||
          description.includes(normalizedName) ||
          metadataBusiness.includes(normalizedName)
        );
      }) || null
    );
  } catch (error) {
    console.log("Stripe customer list name fallback skipped:", error.message);
    return null;
  }
}

async function findStripeCustomerByUsernameRole(username, role) {
  const finalUsername = clean(username).toLowerCase();
  const finalRole = clean(role).toLowerCase();

  if (!finalUsername || !stripe) return null;

  try {
    const listed = await stripe.customers.list({ limit: 100 });

    return (
      listed?.data?.find((customer) => {
        const metadataUsername = clean(customer.metadata?.username).toLowerCase();
        const metadataRole = clean(customer.metadata?.role).toLowerCase();

        const usernameMatches = metadataUsername === finalUsername;
        const roleMatches = !finalRole || !metadataRole || metadataRole === finalRole;

        return usernameMatches && roleMatches;
      }) || null
    );
  } catch (error) {
    console.log("Stripe customer username fallback skipped:", error.message);
    return null;
  }
}

async function findStripeCustomerSmart({
  email,
  businessName,
  username,
  role,
  stripeCustomerId,
}) {
  let customer = null;

  if (stripeCustomerId) {
    try {
      customer = await stripe.customers.retrieve(stripeCustomerId);
      if (customer?.id && !customer.deleted) return customer;
    } catch (error) {
      console.log("Stripe customer direct retrieve skipped:", error.message);
    }
  }

  if (email) {
    customer = await findStripeCustomerByEmail(email);
    if (customer?.id) return customer;
  }

  if (businessName) {
    customer = await findStripeCustomerByBusinessName(businessName);
    if (customer?.id) return customer;
  }

  if (username) {
    customer = await findStripeCustomerByUsernameRole(username, role);
    if (customer?.id) return customer;
  }

  return null;
}

async function findStripeSubscriptionsByCustomer(customerId) {
  if (!customerId || !stripe) return [];

  const listed = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  });

  if (listed?.data?.length) return listed.data;

  try {
    const searched = await stripe.subscriptions.search({
      query: `customer:'${escapeStripeSearch(customerId)}'`,
      limit: 100,
    });

    return searched?.data || [];
  } catch (error) {
    console.log("Stripe subscription search skipped:", error.message);
    return [];
  }
}

function pickBestSubscription(subscriptions = []) {
  return (
    subscriptions.find((sub) => ["active", "trialing"].includes(sub.status)) ||
    subscriptions.find((sub) => ["past_due"].includes(sub.status)) ||
    subscriptions.find((sub) => ["unpaid", "incomplete"].includes(sub.status)) ||
    subscriptions[0] ||
    null
  );
}

async function getOrCreateCustomer({ finalEmail, finalName, metadata }) {
  const existingCustomer = await findStripeCustomerSmart({
    email: finalEmail,
    businessName: finalName,
    username: metadata?.username,
    role: metadata?.role,
  });

  if (existingCustomer?.id) {
    try {
      await stripe.customers.update(existingCustomer.id, {
        email: existingCustomer.email || finalEmail,
        name: finalName || existingCustomer.name,
        metadata: {
          ...(existingCustomer.metadata || {}),
          ...metadata,
          business_name: finalName || existingCustomer.metadata?.business_name || "",
          company_name: finalName || existingCustomer.metadata?.company_name || "",
        },
      });
    } catch (error) {
      console.log("Stripe customer metadata update skipped:", error.message);
    }

    return existingCustomer.id;
  }

  const customer = await stripe.customers.create({
    email: finalEmail,
    name: finalName,
    metadata: {
      ...metadata,
      business_name: finalName,
      company_name: finalName,
    },
  });

  return customer.id;
}

function buildSubscriptionPayload({ role, customerId, subscription }) {
  const status = subscription?.status || "active";
  const isActive = isActiveSubscriptionStatus(status);

  const payload = {
    stripe_id: customerId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription?.id || null,
    subscription_id: subscription?.id || null,
    subscription_status: status,
    membership_status: isActive ? "active" : status,
    account_active: isActive,
    updated_at: nowIso(),
  };

  if (role === "freight") payload.freight_membership_paid = isPaidStatus(status);
  if (role === "driver") payload.driver_membership_paid = isPaidStatus(status);
  if (role === "customer") payload.customer_membership_paid = isPaidStatus(status);

  if (role === "farmer") {
    payload.farmer_membership_paid = isPaidStatus(status);
    payload.monthly_membership_started = isPaidStatus(status);
  }

  return payload;
}

async function getFreightStripeAccountId(freightId, email) {
  let accountId = "";

  if (freightId) {
    const { data } = await supabase
      .from("freight_users")
      .select("stripe_account_id")
      .or(
        `id.eq.${freightId},freight_id.eq.${freightId},profile_id.eq.${freightId},auth_user_id.eq.${freightId}`
      )
      .maybeSingle();

    accountId = clean(data?.stripe_account_id);
  }

  if (!accountId && email) {
    const { data } = await supabase
      .from("freight_subscriptions")
      .select("stripe_account_id")
      .eq("freight_email", email)
      .maybeSingle();

    accountId = clean(data?.stripe_account_id);
  }

  return accountId && accountId.startsWith("acct_") ? accountId : "";
}

async function syncExistingStripeSubscriptionToSupabase({
  role,
  userId,
  email,
  customer,
  subscription,
}) {
  const customerId = typeof customer === "string" ? customer : customer?.id;
  if (!customerId || !subscription?.id) return null;

  const payload = buildSubscriptionPayload({
    role,
    customerId,
    subscription,
  });

  const { data, error } = await updateRoleTable({
    role,
    userId,
    email,
    payload,
  });

  if (error) throw error;

  await updateProfileByIdOrEmail(userId, email, payload);

  if (role === "freight") {
    await updateAdminVerificationByIdOrEmail(userId, email, payload);

    const stripeAccountId = await getFreightStripeAccountId(userId, email);

    await upsertFreightSubscriptionRow({
      freightId: userId,
      freightEmail: email,
      name: customer?.name || customer?.metadata?.name || "",
      username: subscription?.metadata?.username || customer?.metadata?.username || "",
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripeAccountId,
      subscriptionStatus: subscription.status,
      currentPeriodEnd: subscription.current_period_end,
    });
  }

  return {
    payload,
    updatedRows: data,
  };
}

async function updateSubscriptionFromSession(session) {
  const metadata = session.metadata || {};
  const role = clean(metadata.role).toLowerCase();
  const paymentType = clean(metadata.paymentType || metadata.planType).toLowerCase();
  const table = getTableForRole(role);

  if (!table) return;

  const userId = getRoleIdFromMetadata(metadata, role);
  const finalEmail = cleanEmail(
    metadata.email || session.customer_details?.email || session.customer_email || ""
  );

  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id || null;

  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id || null;

  const stripeCheckoutSessionId = session.id;

  const isApplicationFee =
    role === "farmer" &&
    (paymentType.includes("application") || session.mode === "payment");

  if (isApplicationFee) {
    const payload = {
      stripe_id: stripeCustomerId,
      stripe_customer_id: stripeCustomerId,
      stripe_checkout_session_id: stripeCheckoutSessionId,
      application_fee_status: "paid",
      application_fee_paid: true,
      application_status: "payment_completed",
      updated_at: nowIso(),
    };

    await updateRoleTable({ role, userId, email: finalEmail, payload });
    await updateProfileByIdOrEmail(userId, finalEmail, payload);
    return;
  }

  if (!stripeCustomerId || !stripeSubscriptionId) return;

  let subscription = null;

  try {
    subscription =
      typeof session.subscription === "string"
        ? await stripe.subscriptions.retrieve(stripeSubscriptionId)
        : session.subscription;
  } catch {
    subscription = {
      id: stripeSubscriptionId,
      status: "active",
      current_period_end: null,
      metadata,
    };
  }

  const payload = {
    ...buildSubscriptionPayload({
      role,
      customerId: stripeCustomerId,
      subscription,
    }),
    stripe_checkout_session_id: stripeCheckoutSessionId,
  };

  await updateRoleTable({ role, userId, email: finalEmail, payload });
  await updateProfileByIdOrEmail(userId, finalEmail, payload);

  if (role === "freight") {
    await updateAdminVerificationByIdOrEmail(userId, finalEmail, payload);

    const stripeAccountId = await getFreightStripeAccountId(userId, finalEmail);

    await upsertFreightSubscriptionRow({
      freightId: userId,
      freightEmail: finalEmail,
      name: metadata.name || metadata.business_name || metadata.company_name || "",
      username: metadata.username || "",
      stripeCustomerId,
      stripeSubscriptionId,
      stripeAccountId,
      subscriptionStatus: subscription.status,
      currentPeriodEnd: subscription.current_period_end,
    });
  }
}

async function updateSubscriptionFromSubscription(subscription) {
  const metadata = subscription.metadata || {};
  const role = clean(metadata.role).toLowerCase();
  const table = getTableForRole(role);

  if (!table) return;

  const userId = getRoleIdFromMetadata(metadata, role);

  const stripeCustomerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id || null;

  let finalEmail = cleanEmail(metadata.email || "");

  if (!finalEmail && stripeCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(stripeCustomerId);
      finalEmail = cleanEmail(customer.email || "");
    } catch (error) {
      console.log("Customer email lookup skipped:", error.message);
    }
  }

  const payload = buildSubscriptionPayload({
    role,
    customerId: stripeCustomerId,
    subscription,
  });

  await updateRoleTable({ role, userId, email: finalEmail, payload });
  await updateProfileByIdOrEmail(userId, finalEmail, payload);

  if (role === "freight") {
    await updateAdminVerificationByIdOrEmail(userId, finalEmail, payload);

    const stripeAccountId = await getFreightStripeAccountId(userId, finalEmail);

    await upsertFreightSubscriptionRow({
      freightId: userId,
      freightEmail: finalEmail,
      name: metadata.name || metadata.business_name || metadata.company_name || "",
      username: metadata.username || "",
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      stripeAccountId,
      subscriptionStatus: subscription.status,
      currentPeriodEnd: subscription.current_period_end,
    });
  }
}

async function updateConnectAccount(account) {
  const metadata = account.metadata || {};
  const role = clean(metadata.role || "freight").toLowerCase();
  const table = getTableForRole(role);

  if (!table) return;

  const userId = getRoleIdFromMetadata(metadata, role);
  const finalEmail = cleanEmail(metadata.email || account.email || "");
  const stripeCustomerId = clean(metadata.stripe_customer_id || metadata.stripeCustomerId);

  const payload = {
    stripe_account_id: account.id,
    stripe_connect_status:
      account.charges_enabled && account.payouts_enabled ? "complete" : "started",
    payouts_enabled: Boolean(account.payouts_enabled),
    charges_enabled: Boolean(account.charges_enabled),
    stripe_payouts_enabled: Boolean(account.payouts_enabled),
    stripe_charges_enabled: Boolean(account.charges_enabled),
    stripe_onboarding_complete: Boolean(account.details_submitted),
    updated_at: nowIso(),
  };

  await updateRoleTable({ role, userId, email: finalEmail, payload });
  await updateProfileByIdOrEmail(userId, finalEmail, payload);

  if (role === "freight") {
    await updateAdminVerificationByIdOrEmail(userId, finalEmail, payload);

    await updateFreightSubscriptionConnectAccount({
      freightId: userId,
      email: finalEmail,
      stripeCustomerId,
      stripeAccountId: account.id,
    });
  }
}

async function createSubscriptionCheckoutHandler(req, res) {
  try {
    if (!requireStripe(res)) return;
    if (!requireSupabase(res)) return;

    const body = req.body || {};
    const role = clean(body.role || body.planType).toLowerCase();
    const planType = clean(body.planType || role).toLowerCase();
    const finalUserId = getRoleIdFromBody(body, role);
    const accountId = clean(body.accountId || body.account_id);
    const finalEmail = cleanEmail(body.customerEmail || body.email);
    const finalName = clean(
      body.companyName ||
        body.businessName ||
        body.fullName ||
        body.name ||
        `${role || "Farm2Home"} User`
    );
    const username = clean(body.username);

    if (!role) {
      return res.status(400).json({ success: false, error: "role is required." });
    }

    if (!finalUserId) {
      return res.status(400).json({
        success: false,
        error: "userId/profile ID is required.",
      });
    }

    if (!finalEmail) {
      return res.status(400).json({ success: false, error: "email is required." });
    }

    const priceId = getPriceIdForRole(role, planType);

    if (!priceId) {
      return res.status(500).json({
        success: false,
        error: `Stripe price ID missing for role=${role}, planType=${planType}.`,
      });
    }

    const mode = getCheckoutMode(role, planType);

    const metadata = {
      role,
      planType,
      paymentType:
        role === "farmer" && planType.includes("application")
          ? "farmer_application_fee"
          : `${role}_subscription`,
      userId: finalUserId,
      profileId: finalUserId,
      authUserId: finalUserId,
      accountId,
      account_id: accountId,
      email: finalEmail,
      username,
      name: finalName,
      business_name: finalName,
      company_name: finalName,
    };

    if (role === "freight") {
      metadata.freightId = finalUserId;
      metadata.freight_id = finalUserId;
    }

    if (role === "driver") {
      metadata.driverId = finalUserId;
      metadata.driver_id = finalUserId;
    }

    if (role === "farmer") {
      metadata.farmerId = finalUserId;
      metadata.farmer_id = finalUserId;
    }

    if (role === "customer") {
      metadata.customerId = finalUserId;
      metadata.customer_id = finalUserId;
    }

    const existingCustomer = await findStripeCustomerSmart({
      email: finalEmail,
      businessName: finalName,
      username,
      role,
    });

    if (existingCustomer?.id && mode === "subscription") {
      const existingSubscriptions = await findStripeSubscriptionsByCustomer(existingCustomer.id);
      const existingSub = pickBestSubscription(existingSubscriptions);

      if (existingSub?.id && isActiveSubscriptionStatus(existingSub.status)) {
        await syncExistingStripeSubscriptionToSupabase({
          role,
          userId: finalUserId,
          email: finalEmail,
          customer: existingCustomer,
          subscription: existingSub,
        });

        return res.json({
          success: true,
          alreadySubscribed: true,
          message:
            "Existing Stripe subscription found. Supabase was updated. No new checkout created.",
          stripeCustomerId: existingCustomer.id,
          stripeSubscriptionId: existingSub.id,
          subscriptionStatus: existingSub.status,
          role,
          planType,
          userId: finalUserId,
          accountId,
        });
      }
    }

    const stripeCustomerId =
      existingCustomer?.id ||
      (await getOrCreateCustomer({
        finalEmail,
        finalName,
        metadata,
      }));

    try {
      await stripe.customers.update(stripeCustomerId, {
        name: finalName,
        email: finalEmail,
        metadata,
      });
    } catch (error) {
      console.log("Stripe customer pre-checkout update skipped:", error.message);
    }

    const sessionCreatePayload = {
      mode,
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url:
        body.successUrl ||
        body.success_url ||
        `${APP_URL}/${role}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:
        body.cancelUrl ||
        body.cancel_url ||
        `${APP_URL}/${role}/register?checkout_canceled=true`,
      metadata,
    };

    if (mode === "subscription") {
      sessionCreatePayload.subscription_data = { metadata };
    }

    const session = await stripe.checkout.sessions.create(sessionCreatePayload);

    const pendingPayload = {
      stripe_id: stripeCustomerId,
      stripe_customer_id: stripeCustomerId,
      stripe_checkout_session_id: session.id,
      membership_status:
        mode === "payment" ? "pending_application_fee" : "pending_payment",
      subscription_status: mode === "payment" ? "not_started" : "pending_payment",
      updated_at: nowIso(),
    };

    if (mode === "payment") {
      pendingPayload.application_fee_status = "pending_payment";
    }

    await updateRoleTable({
      role,
      userId: finalUserId,
      email: finalEmail,
      payload: pendingPayload,
    });

    await updateProfileByIdOrEmail(finalUserId, finalEmail, pendingPayload);

    if (role === "freight") {
      await updateAdminVerificationByIdOrEmail(finalUserId, finalEmail, pendingPayload);
    }

    return res.json({
      success: true,
      alreadySubscribed: false,
      url: session.url,
      id: session.id,
      sessionId: session.id,
      stripeCustomerId,
      customerId: stripeCustomerId,
      role,
      planType,
      userId: finalUserId,
      accountId,
    });
  } catch (error) {
    console.error("create-subscription-checkout error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to create subscription checkout.",
    });
  }
}

router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Payments route running",
    appUrl: APP_URL,
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    webhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    supabaseConfigured: Boolean(supabase),
    freightPriceConfigured: Boolean(process.env.STRIPE_FREIGHT_MEMBERSHIP_PRICE_ID),
    driverPriceConfigured: Boolean(
      process.env.STRIPE_DRIVER_MEMBERSHIP_PRICE_ID ||
        process.env.STRIPE_DRIVER_BOARD_PRICE_ID
    ),
    farmerMembershipPriceConfigured: Boolean(
      process.env.STRIPE_FARMER_MEMBERSHIP_PRICE_ID ||
        process.env.STRIPE_FARMER_MONTHLY_SUBSCRIPTION_PRICE_ID ||
        process.env.STRIPE_FARMER_SUBSCRIPTION_PRICE_ID
    ),
    farmerApplicationPriceConfigured: Boolean(
      process.env.STRIPE_FARMER_APPLICATION_FEE_PRICE_ID
    ),
    customerPriceConfigured: Boolean(process.env.STRIPE_CUSTOMER_MEMBERSHIP_PRICE_ID),
  });
});

router.post("/create-subscription-checkout", createSubscriptionCheckoutHandler);

router.post("/create-freight-subscription-checkout", (req, res) => {
  req.body = { ...(req.body || {}), role: "freight", planType: "freight" };
  return createSubscriptionCheckoutHandler(req, res);
});

router.post("/create-driver-subscription-checkout", (req, res) => {
  req.body = { ...(req.body || {}), role: "driver", planType: "driver" };
  return createSubscriptionCheckoutHandler(req, res);
});

router.post("/create-farmer-membership-checkout", (req, res) => {
  req.body = {
    ...(req.body || {}),
    role: "farmer",
    planType: "farmer_membership",
  };
  return createSubscriptionCheckoutHandler(req, res);
});

router.post("/create-farmer-application-checkout", (req, res) => {
  req.body = {
    ...(req.body || {}),
    role: "farmer",
    planType: "farmer_application",
  };
  return createSubscriptionCheckoutHandler(req, res);
});

router.post("/create-customer-subscription-checkout", (req, res) => {
  req.body = { ...(req.body || {}), role: "customer", planType: "customer" };
  return createSubscriptionCheckoutHandler(req, res);
});

router.post("/create-connect-account", async (req, res) => {
  try {
    if (!requireStripe(res)) return;
    if (!requireSupabase(res)) return;

    const body = req.body || {};
    const role = clean(body.role || "freight").toLowerCase();
    const requestedUserId = getRoleIdFromBody(body, role);
    const requestedEmail = cleanEmail(body.email || body.customerEmail || body.freight_email);
    const requestedAccountId = clean(body.accountId || body.account_id);
    const requestedBusinessName = clean(
      body.companyName || body.businessName || body.name || "Farm2Home Carrier"
    );
    const requestedStripeAccountId = clean(body.stripeAccountId || body.stripe_account_id);

    const table = getTableForRole(role);

    if (!table) {
      return res.status(400).json({
        success: false,
        error: "Valid role is required.",
      });
    }

    if (!requestedUserId && !requestedEmail) {
      return res.status(400).json({
        success: false,
        error: "freightId/userId or email is required.",
      });
    }

    let roleQuery = supabase.from(table).select("*");

    if (requestedUserId) {
      roleQuery = roleQuery.or(
        getIdColumnsForRole(role).map((col) => `${col}.eq.${requestedUserId}`).join(",")
      );
    } else {
      roleQuery = roleQuery.eq("email", requestedEmail);
    }

    const { data: roleRow, error: roleError } = await roleQuery.maybeSingle();

    if (roleError) throw roleError;

    if (!roleRow?.id) {
      return res.status(404).json({
        success: false,
        error: "Freight profile not found. Save registration first.",
      });
    }

    const finalUserId = roleRow.id;
    const finalEmail = cleanEmail(roleRow.email || requestedEmail);
    const finalAccountId = clean(roleRow.account_id || requestedAccountId);
    const finalBusinessName = clean(
      requestedBusinessName ||
        roleRow.company_name ||
        roleRow.business_name ||
        roleRow.name ||
        "Farm2Home Carrier"
    );

    let stripeCustomerId = clean(roleRow.stripe_customer_id || roleRow.stripe_id);
    let existingStripeAccountId = clean(roleRow.stripe_account_id);

    if (!existingStripeAccountId && requestedStripeAccountId.startsWith("acct_")) {
      existingStripeAccountId = requestedStripeAccountId;
    }

    if (role === "freight") {
      const { data: subRow } = await supabase
        .from("freight_subscriptions")
        .select("stripe_customer_id,stripe_account_id")
        .or(`freight_id.eq.${finalUserId},freight_email.eq.${finalEmail}`)
        .maybeSingle();

      if (!stripeCustomerId) {
        stripeCustomerId = clean(subRow?.stripe_customer_id);
      }

      if (!existingStripeAccountId && clean(subRow?.stripe_account_id).startsWith("acct_")) {
        existingStripeAccountId = clean(subRow.stripe_account_id);
      }
    }

    if (existingStripeAccountId && !existingStripeAccountId.startsWith("acct_")) {
      existingStripeAccountId = "";
    }

    let account;

    if (existingStripeAccountId) {
      account = await stripe.accounts.retrieve(existingStripeAccountId);

      const mergedMetadata = {
        ...(account.metadata || {}),
        role,
        userId: finalUserId,
        profileId: finalUserId,
        authUserId: finalUserId,
        freightId: role === "freight" ? finalUserId : "",
        freight_id: role === "freight" ? finalUserId : "",
        accountId: finalAccountId,
        account_id: finalAccountId,
        email: finalEmail,
        stripeCustomerId,
        stripe_customer_id: stripeCustomerId,
        name: finalBusinessName,
        business_name: finalBusinessName,
        company_name: finalBusinessName,
      };

      try {
        account = await stripe.accounts.update(existingStripeAccountId, {
          email: finalEmail,
          business_profile: {
            name: finalBusinessName,
          },
          capabilities: {
            transfers: { requested: true },
            card_payments: { requested: true },
          },
          metadata: mergedMetadata,
        });
      } catch (capabilityError) {
        console.log("Existing Connect capability update skipped:", capabilityError.message);

        account = await stripe.accounts.update(existingStripeAccountId, {
          email: finalEmail,
          metadata: mergedMetadata,
        });
      }
    } else {
      account = await stripe.accounts.create({
        type: "express",
        country: "US",
        email: finalEmail,
        business_type: "company",
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
        business_profile: {
          name: finalBusinessName,
        },
        metadata: {
          role,
          userId: finalUserId,
          profileId: finalUserId,
          authUserId: finalUserId,
          freightId: role === "freight" ? finalUserId : "",
          freight_id: role === "freight" ? finalUserId : "",
          accountId: finalAccountId,
          account_id: finalAccountId,
          email: finalEmail,
          stripeCustomerId,
          stripe_customer_id: stripeCustomerId,
          name: finalBusinessName,
          business_name: finalBusinessName,
          company_name: finalBusinessName,
        },
      });
    }

    const connectPayload = {
      stripe_account_id: account.id,
      stripe_connect_status:
        account.charges_enabled && account.payouts_enabled ? "complete" : "started",
      payouts_enabled: Boolean(account.payouts_enabled),
      charges_enabled: Boolean(account.charges_enabled),
      stripe_payouts_enabled: Boolean(account.payouts_enabled),
      stripe_charges_enabled: Boolean(account.charges_enabled),
      stripe_onboarding_complete: Boolean(account.details_submitted),
      updated_at: nowIso(),
    };

    await updateRoleTable({
      role,
      userId: finalUserId,
      email: finalEmail,
      payload: connectPayload,
    });

    await updateProfileByIdOrEmail(finalUserId, finalEmail, connectPayload);

    if (role === "freight") {
      await updateAdminVerificationByIdOrEmail(finalUserId, finalEmail, connectPayload);

      await updateFreightSubscriptionConnectAccount({
        freightId: finalUserId,
        email: finalEmail,
        stripeCustomerId,
        stripeAccountId: account.id,
      });
    }

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url:
        body.refreshUrl ||
        body.refresh_url ||
        `${APP_URL}/${role}/connect-bank?refresh=true&stripe_account_id=${account.id}`,
      return_url:
        body.returnUrl ||
        body.return_url ||
        `${APP_URL}/${role}/connect-bank?connected=true&stripe_account_id=${account.id}`,
      type: "account_onboarding",
    });

    return res.json({
      success: true,
      url: accountLink.url,
      onboardingUrl: accountLink.url,
      stripeAccountId: account.id,
      stripe_account_id: account.id,
      accountId: finalAccountId,
      account_id: finalAccountId,
      userId: finalUserId,
      freightId: role === "freight" ? finalUserId : undefined,
      freight_id: role === "freight" ? finalUserId : undefined,
      email: finalEmail,
      role,
      reused: Boolean(existingStripeAccountId),
      payoutsEnabled: Boolean(account.payouts_enabled),
      chargesEnabled: Boolean(account.charges_enabled),
      onboardingComplete: Boolean(account.details_submitted),
    });
  } catch (error) {
    console.error("create-connect-account error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to create Stripe Connect onboarding link.",
    });
  }
});

router.post("/verify-checkout-session", async (req, res) => {
  try {
    if (!requireStripe(res)) return;
    if (!requireSupabase(res)) return;

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

    await updateSubscriptionFromSession(session);

    return res.json({
      success: true,
      paid: session.payment_status === "paid" || session.status === "complete",
      paymentStatus: session.payment_status,
      status: session.status,
      mode: session.mode,
      role: session.metadata?.role,
      paymentType: session.metadata?.paymentType,
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

router.post("/sync-stripe-by-email", async (req, res) => {
  try {
    if (!requireStripe(res)) return;
    if (!requireSupabase(res)) return;

    const email = cleanEmail(req.body?.email);
    const businessName = clean(
      req.body?.businessName || req.body?.companyName || req.body?.name
    );
    const username = clean(req.body?.username);
    const role = clean(req.body?.role || "freight").toLowerCase();
    const userId = getRoleIdFromBody(req.body || {}, role);
    const stripeCustomerId = clean(
      req.body?.stripeCustomerId || req.body?.stripe_customer_id
    );
    const table = getTableForRole(role);

    if (!email && !businessName && !username && !stripeCustomerId) {
      return res.status(400).json({
        success: false,
        error: "email, businessName, username, or stripeCustomerId is required.",
      });
    }

    if (!table) {
      return res.status(400).json({
        success: false,
        error: "Valid role is required.",
      });
    }

    const customer = await findStripeCustomerSmart({
      email,
      businessName,
      username,
      role,
      stripeCustomerId,
    });

    if (!customer?.id) {
      return res.status(404).json({
        success: false,
        error:
          "No Stripe customer found for this email, business name, username, or customer ID.",
      });
    }

    const subscriptions = await findStripeSubscriptionsByCustomer(customer.id);
    const bestSub = pickBestSubscription(subscriptions);

    const resolvedEmail = cleanEmail(customer.email || email);

    const payload = {
      stripe_id: customer.id,
      stripe_customer_id: customer.id,
      updated_at: nowIso(),
    };

    if (bestSub?.id) {
      Object.assign(
        payload,
        buildSubscriptionPayload({
          role,
          customerId: customer.id,
          subscription: bestSub,
        })
      );
    }

    const { data, error } = await updateRoleTable({
      role,
      userId,
      email: resolvedEmail,
      payload,
    });

    if (error) throw error;

    await updateProfileByIdOrEmail(userId, resolvedEmail, payload);

    if (role === "freight") {
      await updateAdminVerificationByIdOrEmail(userId, resolvedEmail, payload);

      if (bestSub?.id) {
        const resolvedFreightId = userId || data?.[0]?.id;
        const stripeAccountId = await getFreightStripeAccountId(resolvedFreightId, resolvedEmail);

        await upsertFreightSubscriptionRow({
          freightId: resolvedFreightId,
          freightEmail: resolvedEmail,
          name: customer.name || businessName || "",
          username: username || customer.metadata?.username || "",
          stripeCustomerId: customer.id,
          stripeSubscriptionId: bestSub.id,
          stripeAccountId,
          subscriptionStatus: bestSub.status,
          currentPeriodEnd: bestSub.current_period_end,
        });
      }
    }

    return res.json({
      success: true,
      role,
      email: resolvedEmail,
      businessName,
      username,
      stripeCustomerId: customer.id,
      stripeCustomerName: customer.name || null,
      stripeSubscriptionId: bestSub?.id || null,
      subscriptionStatus: bestSub?.status || null,
      subscriptionActive: bestSub ? isActiveSubscriptionStatus(bestSub.status) : false,
      updatedRows: data,
    });
  } catch (error) {
    console.error("sync-stripe-by-email error:", error);

    return res.status(500).json({
      success: false,
      error:
        error.message || "Unable to sync Stripe by email, business name, or username.",
    });
  }
});

router.post("/force-sync-freight-subscription", async (req, res) => {
  try {
    if (!requireStripe(res)) return;
    if (!requireSupabase(res)) return;

    const email = cleanEmail(req.body?.email);
    const freightId = clean(
      req.body?.freightId || req.body?.freight_id || req.body?.userId
    );
    const businessName = clean(
      req.body?.businessName || req.body?.companyName || req.body?.name
    );
    const username = clean(req.body?.username);
    const stripeCustomerId = clean(
      req.body?.stripeCustomerId || req.body?.stripe_customer_id
    );

    if (!email && !freightId && !businessName && !username && !stripeCustomerId) {
      return res.status(400).json({
        success: false,
        error:
          "Provide email, freightId, businessName, username, or stripeCustomerId.",
      });
    }

    const customer = await findStripeCustomerSmart({
      email,
      businessName,
      username,
      role: "freight",
      stripeCustomerId,
    });

    if (!customer?.id) {
      return res.status(404).json({
        success: false,
        error:
          "No Stripe customer found. Do not purchase again. Copy the customer ID that starts with cus_ from Stripe and use it for force sync.",
      });
    }

    const subscriptions = await findStripeSubscriptionsByCustomer(customer.id);
    const activeSub = pickBestSubscription(subscriptions);

    if (!activeSub?.id) {
      return res.status(404).json({
        success: false,
        error: "Stripe customer found, but no subscription was found.",
        stripeCustomerId: customer.id,
      });
    }

    const resolvedEmail = cleanEmail(customer.email || email);

    const payload = buildSubscriptionPayload({
      role: "freight",
      customerId: customer.id,
      subscription: activeSub,
    });

    let updateResult = null;

    if (freightId) {
      updateResult = await supabase
        .from("freight_users")
        .update(payload)
        .or(
          `id.eq.${freightId},freight_id.eq.${freightId},profile_id.eq.${freightId},auth_user_id.eq.${freightId}`
        )
        .select();
    } else if (resolvedEmail) {
      updateResult = await supabase
        .from("freight_users")
        .update(payload)
        .eq("email", resolvedEmail)
        .select();
    }

    if (updateResult?.error) throw updateResult.error;

    if (!updateResult?.data?.length) {
      return res.status(404).json({
        success: false,
        error:
          "Stripe subscription found, but no matching freight_users row was updated. Save freight registration first, then run sync again.",
        stripeCustomerId: customer.id,
        stripeSubscriptionId: activeSub.id,
        subscriptionStatus: activeSub.status,
      });
    }

    const resolvedFreightId = freightId || updateResult.data?.[0]?.id;
    const stripeAccountId = clean(updateResult.data?.[0]?.stripe_account_id);

    await updateProfileByIdOrEmail(resolvedFreightId, resolvedEmail, payload);
    await updateAdminVerificationByIdOrEmail(resolvedFreightId, resolvedEmail, payload);

    const freightSubscriptionRow = await upsertFreightSubscriptionRow({
      freightId: resolvedFreightId,
      freightEmail: resolvedEmail,
      name: customer.name || businessName || "",
      username: username || customer.metadata?.username || "",
      stripeCustomerId: customer.id,
      stripeSubscriptionId: activeSub.id,
      stripeAccountId,
      subscriptionStatus: activeSub.status,
      currentPeriodEnd: activeSub.current_period_end,
    });

    return res.json({
      success: true,
      message: "Freight subscription force-synced from Stripe to Supabase.",
      stripeCustomerId: customer.id,
      stripeSubscriptionId: activeSub.id,
      subscriptionStatus: activeSub.status,
      email: resolvedEmail,
      updatedRows: updateResult?.data || [],
      freightSubscription: freightSubscriptionRow,
    });
  } catch (error) {
    console.error("force-sync-freight-subscription error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to force sync freight subscription.",
    });
  }
});

router.post("/link-freight-stripe-account", async (req, res) => {
  try {
    if (!requireStripe(res)) return;
    if (!requireSupabase(res)) return;

    const freightId = clean(
      req.body?.freightId || req.body?.freight_id || req.body?.userId
    );
    const email = cleanEmail(req.body?.email);
    const stripeCustomerId = clean(
      req.body?.stripeCustomerId || req.body?.stripe_customer_id
    );

    if (!freightId) {
      return res.status(400).json({
        success: false,
        error: "freightId is required. Save registration first.",
      });
    }

    if (!stripeCustomerId || !stripeCustomerId.startsWith("cus_")) {
      return res.status(400).json({
        success: false,
        error: "Valid Stripe customer ID starting with cus_ is required.",
      });
    }

    const customer = await stripe.customers.retrieve(stripeCustomerId);

    if (!customer?.id || customer.deleted) {
      return res.status(404).json({
        success: false,
        error: "Stripe customer was not found.",
      });
    }

    const subscriptions = await findStripeSubscriptionsByCustomer(customer.id);
    const activeSub = pickBestSubscription(subscriptions);

    if (!activeSub?.id) {
      return res.status(404).json({
        success: false,
        error: "Stripe customer found, but no subscription exists.",
        stripeCustomerId: customer.id,
      });
    }

    const resolvedEmail = cleanEmail(customer.email || email);

    const payload = buildSubscriptionPayload({
      role: "freight",
      customerId: customer.id,
      subscription: activeSub,
    });

    const { data, error } = await supabase
      .from("freight_users")
      .update(payload)
      .or(
        `id.eq.${freightId},freight_id.eq.${freightId},profile_id.eq.${freightId},auth_user_id.eq.${freightId}`
      )
      .select();

    if (error) throw error;

    if (!data?.length) {
      return res.status(404).json({
        success: false,
        error: "No matching freight_users row was found for this freightId.",
      });
    }

    await updateProfileByIdOrEmail(freightId, resolvedEmail, payload);
    await updateAdminVerificationByIdOrEmail(freightId, resolvedEmail, payload);

    try {
      await stripe.customers.update(customer.id, {
        metadata: {
          ...(customer.metadata || {}),
          role: "freight",
          freight_id: freightId,
          freightId,
          userId: freightId,
          linked_to_farm2home: "true",
        },
      });
    } catch (metadataError) {
      console.log("Stripe customer metadata link skipped:", metadataError.message);
    }

    const stripeAccountId = clean(data?.[0]?.stripe_account_id);

    const freightSubscriptionRow = await upsertFreightSubscriptionRow({
      freightId,
      freightEmail: resolvedEmail,
      name: customer.name || data?.[0]?.company_name || data?.[0]?.business_name || "",
      username: customer.metadata?.username || data?.[0]?.username || "",
      stripeCustomerId: customer.id,
      stripeSubscriptionId: activeSub.id,
      stripeAccountId,
      subscriptionStatus: activeSub.status,
      currentPeriodEnd: activeSub.current_period_end,
    });

    return res.json({
      success: true,
      message: "Stripe customer linked to freight account.",
      stripeCustomerId: customer.id,
      stripeSubscriptionId: activeSub.id,
      subscriptionStatus: activeSub.status,
      email: resolvedEmail,
      updatedRows: data,
      freightSubscription: freightSubscriptionRow,
    });
  } catch (error) {
    console.error("link-freight-stripe-account error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to link Stripe customer.",
    });
  }
});

router.post("/sync-all-stripe-role", async (req, res) => {
  try {
    if (!requireStripe(res)) return;
    if (!requireSupabase(res)) return;

    const role = clean(req.body?.role || "freight").toLowerCase();
    const table = getTableForRole(role);

    if (!table) {
      return res.status(400).json({
        success: false,
        error: "Valid role is required.",
      });
    }

    const { data: rows, error } = await supabase
      .from(table)
      .select("*")
      .not("email", "is", null);

    if (error) throw error;

    const results = [];

    for (const row of rows || []) {
      const email = cleanEmail(row.email);
      const businessName = clean(row.business_name || row.company_name || row.name);
      const username = clean(row.username);

      const customer = await findStripeCustomerSmart({
        email,
        businessName,
        username,
        role,
      });

      if (!customer?.id) {
        results.push({
          email,
          businessName,
          username,
          updated: false,
          reason: "No Stripe customer found",
        });
        continue;
      }

      const subscriptions = await findStripeSubscriptionsByCustomer(customer.id);
      const bestSub = pickBestSubscription(subscriptions);

      const payload = {
        stripe_id: customer.id,
        stripe_customer_id: customer.id,
        updated_at: nowIso(),
      };

      if (bestSub?.id) {
        Object.assign(
          payload,
          buildSubscriptionPayload({
            role,
            customerId: customer.id,
            subscription: bestSub,
          })
        );
      }

      const idValue =
        row.id ||
        row.freight_id ||
        row.driver_id ||
        row.farmer_id ||
        row.customer_id ||
        row.profile_id ||
        row.auth_user_id ||
        "";

      const updateResult = await updateRoleTable({
        role,
        userId: idValue,
        email: email || cleanEmail(customer.email),
        payload,
      });

      await updateProfileByIdOrEmail(
        idValue,
        email || cleanEmail(customer.email),
        payload
      );

      if (role === "freight") {
        await updateAdminVerificationByIdOrEmail(
          idValue,
          email || cleanEmail(customer.email),
          payload
        );

        if (bestSub?.id) {
          const stripeAccountId = await getFreightStripeAccountId(
            idValue,
            email || cleanEmail(customer.email)
          );

          await upsertFreightSubscriptionRow({
            freightId: idValue,
            freightEmail: email || cleanEmail(customer.email),
            name: customer.name || businessName || "",
            username: username || customer.metadata?.username || "",
            stripeCustomerId: customer.id,
            stripeSubscriptionId: bestSub.id,
            stripeAccountId,
            subscriptionStatus: bestSub.status,
            currentPeriodEnd: bestSub.current_period_end,
          });
        }
      }

      results.push({
        email,
        businessName,
        username,
        updated: !updateResult.error,
        stripeCustomerId: customer.id,
        stripeSubscriptionId: bestSub?.id || null,
        subscriptionStatus: bestSub?.status || null,
        subscriptionActive: bestSub ? isActiveSubscriptionStatus(bestSub.status) : false,
        error: updateResult.error?.message || null,
      });
    }

    return res.json({
      success: true,
      role,
      scanned: rows?.length || 0,
      results,
    });
  } catch (error) {
    console.error("sync-all-stripe-role error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to sync Stripe role.",
    });
  }
});

router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe) return res.status(200).json({ received: true, ignored: true });

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
        await updateSubscriptionFromSession(event.data.object);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await updateSubscriptionFromSubscription(event.data.object);
        break;
      }

      case "account.updated": {
        await updateConnectAccount(event.data.object);
        break;
      }

      default:
        console.log(`Stripe webhook ignored event: ${event.type}`);
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