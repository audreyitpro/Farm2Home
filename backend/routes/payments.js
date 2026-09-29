// backend/routes/payments.js

const express = require("express");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

router.use((req, res, next) => {
  if (req.originalUrl.includes("/payments/webhook")) return next();
  return express.json({ limit: "10mb" })(req, res, next);
});

const APP_URL = process.env.APP_URL || "https://farm2home-rho.vercel.app";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
    : null;

const FARMER_PLATFORM_FEE_RATE = 0.04;
const CUSTOMER_CHECKOUT_SERVICE_FEE = 4.99;
const FARMER_ACTIVATION_GRACE_DAYS = 60;

function clean(value) {
  return String(value || "").trim();
}

function lower(value) {
  return clean(value).toLowerCase();
}

function email(value) {
  return clean(value).toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function cents(value) {
  return Math.round(Number(value || 0) * 100);
}

function dollarsFromCents(value) {
  return Number((Number(value || 0) / 100).toFixed(2));
}

function isAcct(value) {
  return clean(value).startsWith("acct_");
}

function isCus(value) {
  return clean(value).startsWith("cus_");
}

function isSub(value) {
  return clean(value).startsWith("sub_");
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

function roleName(role) {
  return lower(role);
}

function getRoleTable(role) {
  const r = roleName(role);

  if (r === "freight") return "freight_users";
  if (r === "driver") return "drivers";
  if (r === "farmer") return "farmers";
  if (r === "customer") return "customers";

  return null;
}

function getSubscriptionTable(role) {
  const r = roleName(role);

  if (r === "freight") return "freight_subscriptions";
  if (r === "driver") return "driver_subscriptions";
  if (r === "farmer") return "farmer_subscriptions";
  if (r === "customer") return "customer_subscriptions";

  return null;
}

function getRoleIdColumn(role) {
  const r = roleName(role);

  if (r === "freight") return "freight_id";
  if (r === "driver") return "driver_id";
  if (r === "farmer") return "farmer_id";
  if (r === "customer") return "customer_id";

  return "profile_id";
}

function getRoleEmailColumn(role) {
  const r = roleName(role);

  if (r === "freight") return "freight_email";
  if (r === "driver") return "driver_email";
  if (r === "farmer") return "farmer_email";
  if (r === "customer") return "customer_email";

  return "email";
}

function getRoleAccountColumn(role) {
  const r = roleName(role);

  if (r === "freight") return "freight_account";
  if (r === "driver") return "driver_account";
  if (r === "farmer") return "farmer_account";

  return null;
}

function getRoleIdFromBody(body, role) {
  const r = roleName(role);

  if (r === "freight") {
    return clean(
      body.freightId ||
        body.freight_id ||
        body.userId ||
        body.user_id ||
        body.profileId ||
        body.profile_id ||
        body.authUserId ||
        body.auth_user_id
    );
  }

  if (r === "driver") {
    return clean(
      body.driverId ||
        body.driver_id ||
        body.userId ||
        body.user_id ||
        body.profileId ||
        body.profile_id ||
        body.authUserId ||
        body.auth_user_id
    );
  }

  if (r === "farmer") {
    return clean(
      body.farmerId ||
        body.farmer_id ||
        body.userId ||
        body.user_id ||
        body.profileId ||
        body.profile_id ||
        body.authUserId ||
        body.auth_user_id
    );
  }

  if (r === "customer") {
    return clean(
      body.customerId ||
        body.customer_id ||
        body.userId ||
        body.user_id ||
        body.profileId ||
        body.profile_id ||
        body.authUserId ||
        body.auth_user_id
    );
  }

  return clean(
    body.userId ||
      body.user_id ||
      body.profileId ||
      body.profile_id ||
      body.authUserId ||
      body.auth_user_id
  );
}

function getRoleIdFromMetadata(metadata, role) {
  const r = roleName(role);

  if (r === "freight") {
    return clean(
      metadata.freightId ||
        metadata.freight_id ||
        metadata.userId ||
        metadata.user_id ||
        metadata.profileId ||
        metadata.profile_id ||
        metadata.authUserId ||
        metadata.auth_user_id
    );
  }

  if (r === "driver") {
    return clean(
      metadata.driverId ||
        metadata.driver_id ||
        metadata.userId ||
        metadata.user_id ||
        metadata.profileId ||
        metadata.profile_id ||
        metadata.authUserId ||
        metadata.auth_user_id
    );
  }

  if (r === "farmer") {
    return clean(
      metadata.farmerId ||
        metadata.farmer_id ||
        metadata.userId ||
        metadata.user_id ||
        metadata.profileId ||
        metadata.profile_id ||
        metadata.authUserId ||
        metadata.auth_user_id
    );
  }

  if (r === "customer") {
    return clean(
      metadata.customerId ||
        metadata.customer_id ||
        metadata.userId ||
        metadata.user_id ||
        metadata.profileId ||
        metadata.profile_id ||
        metadata.authUserId ||
        metadata.auth_user_id
    );
  }

  return clean(
    metadata.userId ||
      metadata.user_id ||
      metadata.profileId ||
      metadata.profile_id ||
      metadata.authUserId ||
      metadata.auth_user_id
  );
}

function getIdFilter(role, idValue) {
  const r = roleName(role);
  const id = clean(idValue);

  if (r === "freight") {
    return `id.eq.${id},freight_id.eq.${id},profile_id.eq.${id},auth_user_id.eq.${id}`;
  }

  if (r === "driver") {
    return `id.eq.${id},driver_id.eq.${id},profile_id.eq.${id},auth_user_id.eq.${id}`;
  }

  if (r === "farmer") {
    return `id.eq.${id},farmer_id.eq.${id},profile_id.eq.${id},auth_user_id.eq.${id}`;
  }

  if (r === "customer") {
    return `id.eq.${id},customer_id.eq.${id},profile_id.eq.${id},auth_user_id.eq.${id}`;
  }

  return `id.eq.${id},profile_id.eq.${id},auth_user_id.eq.${id}`;
}

function getPriceId(role, planType) {
  const r = roleName(role);
  const p = roleName(planType);

  if (r === "freight") {
    return process.env.STRIPE_FREIGHT_MEMBERSHIP_PRICE_ID;
  }

  if (r === "driver") {
    return (
      process.env.STRIPE_DRIVER_MEMBERSHIP_PRICE_ID ||
      process.env.STRIPE_DRIVER_BOARD_PRICE_ID
    );
  }

  if (r === "customer") {
    return process.env.STRIPE_CUSTOMER_MEMBERSHIP_PRICE_ID;
  }

  if (r === "farmer" && p.includes("application")) {
    return process.env.STRIPE_FARMER_APPLICATION_FEE_PRICE_ID;
  }

  if (r === "farmer") {
    return (
      process.env.STRIPE_FARMER_MEMBERSHIP_PRICE_ID ||
      process.env.STRIPE_FARMER_MONTHLY_SUBSCRIPTION_PRICE_ID ||
      process.env.STRIPE_FARMER_SUBSCRIPTION_PRICE_ID ||
      process.env.STRIPE_FARMER_PRICE_ID
    );
  }

  return null;
}

function getCheckoutMode(role, planType) {
  const r = roleName(role);
  const p = roleName(planType);

  if (r === "farmer" && p.includes("application")) return "payment";
  return "subscription";
}

function isActiveSubscription(status) {
  return ["active", "trialing", "past_due"].includes(roleName(status));
}

function stripeDate(seconds) {
  if (!seconds) return null;
  return new Date(Number(seconds) * 1000).toISOString();
}

function removeMissingColumn(error, payload) {
  const message = String(error?.message || error?.details || "");

  const patterns = [
    /Could not find the '([^']+)' column/i,
    /column '([^']+)' of relation/i,
    /'([^']+)' column of '([^']+)'/i,
    /schema cache.*?'([^']+)'/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);

    if (match?.[1] && Object.prototype.hasOwnProperty.call(payload, match[1])) {
      const copy = { ...payload };
      delete copy[match[1]];
      return copy;
    }
  }

  return null;
}

async function safeUpdate(table, payload, applyFilter, label = table) {
  let nextPayload = { ...payload };

  for (let attempt = 0; attempt < 60; attempt += 1) {
    let query = supabase.from(table).update(nextPayload);
    query = applyFilter(query);

    const { data, error } = await query.select();

    if (!error) return { data, error: null };

    console.log(`${label} update skipped:`, error.message);

    const reduced = removeMissingColumn(error, nextPayload);
    if (reduced) {
      nextPayload = reduced;
      continue;
    }

    return { data: null, error };
  }

  return { data: null, error: new Error(`${label} update failed.`) };
}

async function safeUpsert(table, payload, options = {}, label = table) {
  let nextPayload = { ...payload };

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const { data, error } = await supabase
      .from(table)
      .upsert(nextPayload, options)
      .select();

    if (!error) return { data, error: null };

    console.log(`${label} upsert skipped:`, error.message);

    const reduced = removeMissingColumn(error, nextPayload);
    if (reduced) {
      nextPayload = reduced;
      continue;
    }

    return { data: null, error };
  }

  return { data: null, error: new Error(`${label} upsert failed.`) };
}

async function safeInsert(table, payload, label = table) {
  let nextPayload = { ...payload };

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const { data, error } = await supabase.from(table).insert(nextPayload).select();

    if (!error) return { data, error: null };

    console.log(`${label} insert skipped:`, error.message);

    const reduced = removeMissingColumn(error, nextPayload);
    if (reduced) {
      nextPayload = reduced;
      continue;
    }

    return { data: null, error };
  }

  return { data: null, error: new Error(`${label} insert failed.`) };
}

async function findCustomerByEmail(emailValue) {
  const finalEmail = email(emailValue);
  if (!finalEmail) return null;

  const listed = await stripe.customers.list({
    email: finalEmail,
    limit: 1,
  });

  if (listed?.data?.[0]) return listed.data[0];

  try {
    const searched = await stripe.customers.search({
      query: `email:'${finalEmail.replace(/'/g, "\\'")}'`,
      limit: 1,
    });

    return searched?.data?.[0] || null;
  } catch {
    return null;
  }
}

async function findCustomerSmart({
  emailValue,
  businessName,
  username,
  role,
  stripeCustomerId,
}) {
  if (isCus(stripeCustomerId)) {
    try {
      const customer = await stripe.customers.retrieve(stripeCustomerId);
      if (customer?.id && !customer.deleted) return customer;
    } catch {}
  }

  const byEmail = await findCustomerByEmail(emailValue);
  if (byEmail?.id) return byEmail;

  try {
    const listed = await stripe.customers.list({ limit: 100 });
    const b = clean(businessName).toLowerCase();
    const u = clean(username).toLowerCase();
    const r = roleName(role);

    return (
      listed.data.find((customer) => {
        const md = customer.metadata || {};
        const name = clean(customer.name).toLowerCase();
        const mdBusiness = clean(
          md.business_name || md.company_name || md.name
        ).toLowerCase();
        const mdUsername = clean(md.username).toLowerCase();
        const mdRole = roleName(md.role);

        const roleMatch = !r || !mdRole || mdRole === r;
        const businessMatch = b && (name.includes(b) || mdBusiness.includes(b));
        const usernameMatch = u && mdUsername === u;

        return roleMatch && (businessMatch || usernameMatch);
      }) || null
    );
  } catch {
    return null;
  }
}

async function getOrCreateCustomer({ finalEmail, finalName, metadata }) {
  const existing = await findCustomerSmart({
    emailValue: finalEmail,
    businessName: finalName,
    username: metadata.username,
    role: metadata.role,
    stripeCustomerId: metadata.stripe_customer_id,
  });

  if (existing?.id) {
    await stripe.customers.update(existing.id, {
      email: existing.email || finalEmail,
      name: finalName || existing.name,
      metadata: {
        ...(existing.metadata || {}),
        ...metadata,
        business_name: finalName,
        company_name: finalName,
      },
    });

    return existing.id;
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

async function listCustomerSubscriptions(customerId) {
  if (!isCus(customerId)) return [];

  const listed = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  });

  return listed?.data || [];
}

function bestSubscription(subscriptions) {
  return (
    subscriptions.find((s) => ["active", "trialing"].includes(s.status)) ||
    subscriptions.find((s) => s.status === "past_due") ||
    subscriptions.find((s) => ["unpaid", "incomplete"].includes(s.status)) ||
    subscriptions[0] ||
    null
  );
}

function subscriptionPayload(role, customerId, subscription) {
  const status = subscription?.status || "active";
  const active = isActiveSubscription(status);

  const payload = {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription?.id || null,
    subscription_id: subscription?.id || null,
    subscription_status: status,
    membership_status: active ? "active" : status,
    account_active: active,
    updated_at: nowIso(),
  };

  if (roleName(role) === "freight") payload.freight_membership_paid = active;
  if (roleName(role) === "driver") payload.driver_membership_paid = active;

  if (roleName(role) === "farmer") {
    payload.farmer_membership_paid = active;
    payload.monthly_membership_started = active;
  }

  if (roleName(role) === "customer") payload.customer_membership_paid = active;

  return payload;
}

async function updateMainRoleRow(role, idValue, emailValue, payload) {
  const table = getRoleTable(role);
  if (!table) return { data: null, error: new Error("Invalid role table.") };

  return await safeUpdate(
    table,
    payload,
    (query) => {
      if (idValue) return query.or(getIdFilter(role, idValue));
      if (emailValue) return query.eq("email", emailValue);
      return query.eq("id", "__missing__");
    },
    table
  );
}

async function updateProfiles(role, idValue, emailValue, payload) {
  if (!supabase) return;

  const safeProfilePayload = {
    updated_at: nowIso(),
  };

  if (payload.role) safeProfilePayload.role = payload.role;
  if (payload.full_name) safeProfilePayload.full_name = payload.full_name;
  if (payload.email) safeProfilePayload.email = payload.email;
  if (payload.phone) safeProfilePayload.phone = payload.phone;
  if (payload.account_id) safeProfilePayload.account_id = payload.account_id;
  if (payload.stripe_customer_id) safeProfilePayload.stripe_customer_id = payload.stripe_customer_id;
  if (payload.stripe_subscription_id) safeProfilePayload.stripe_subscription_id = payload.stripe_subscription_id;
  if (payload.subscription_id) safeProfilePayload.subscription_id = payload.subscription_id;
  if (payload.stripe_checkout_session_id) {
    safeProfilePayload.stripe_checkout_session_id =
      payload.stripe_checkout_session_id;
  }

  try {
    await safeUpdate(
      "profiles",
      safeProfilePayload,
      (query) => {
        if (idValue) return query.or(`id.eq.${idValue},auth_user_id.eq.${idValue}`);
        if (emailValue) return query.eq("email", emailValue);
        return query.eq("id", "__missing__");
      },
      "profiles"
    );
      } catch (error) {
    console.log("profiles update skipped:", error.message);
  }
}

async function updateAdminVerifications(role, idValue, emailValue, payload) {
  if (!supabase) return;

  try {
    await safeUpdate(
      "admin_verifications",
      payload,
      (query) => {
        if (idValue) {
          return query.or(
            `id.eq.${idValue},profile_id.eq.${idValue},freight_id.eq.${idValue},driver_id.eq.${idValue},farmer_id.eq.${idValue},customer_id.eq.${idValue},carrier_id.eq.${idValue}`
          );
        }

        if (emailValue) return query.eq("email", emailValue);

        return query.eq("id", "__missing__");
      },
      "admin_verifications"
    );
  } catch (error) {
    console.log("admin_verifications update skipped:", error.message);
  }
}

async function upsertSubscriptionRow({
  role,
  roleId,
  roleEmail,
  name,
  username,
  stripeCustomerId,
  stripeSubscriptionId,
  roleAccount,
  subscriptionStatus,
  currentPeriodEnd,
}) {
  const table = getSubscriptionTable(role);
  const idColumn = getRoleIdColumn(role);
  const emailColumn = getRoleEmailColumn(role);
  const accountColumn = getRoleAccountColumn(role);

  if (!table || !idColumn || !isCus(stripeCustomerId) || !isSub(stripeSubscriptionId)) {
    return null;
  }

  const now = nowIso();

  const payload = {
    [idColumn]: roleId,
    [emailColumn]: email(roleEmail),
    name: clean(name),
    username: clean(username),
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
    subscription_status: clean(subscriptionStatus || "active"),
    current_period_end:
      typeof currentPeriodEnd === "number"
        ? stripeDate(currentPeriodEnd)
        : currentPeriodEnd || null,
    updated_at: now,
  };

  if (accountColumn && isAcct(roleAccount)) {
    payload[accountColumn] = roleAccount;
  }

  const bySub = await supabase
    .from(table)
    .select("id")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();

  if (bySub.error) {
    console.log(`${table} subscription lookup skipped:`, bySub.error.message);
  }

  if (bySub.data?.id) {
    const updated = await safeUpdate(
      table,
      payload,
      (query) => query.eq("id", bySub.data.id),
      table
    );

    return updated.data?.[0] || null;
  }

  const byRole = await supabase
    .from(table)
    .select("id")
    .eq(idColumn, roleId)
    .maybeSingle();

  if (byRole.error) {
    console.log(`${table} role lookup skipped:`, byRole.error.message);
  }

  if (byRole.data?.id) {
    const updated = await safeUpdate(
      table,
      payload,
      (query) => query.eq("id", byRole.data.id),
      table
    );

    return updated.data?.[0] || null;
  }

  const inserted = await safeInsert(table, { ...payload, created_at: now }, table);
  return inserted.data?.[0] || null;
}

async function getSavedRoleAccount(role, roleId, emailValue) {
  const table = getRoleTable(role);
  const subTable = getSubscriptionTable(role);
  const accountColumn = getRoleAccountColumn(role);

  if (!accountColumn || roleName(role) === "customer") return "";

  if (table && roleId) {
    const { data } = await supabase
      .from(table)
      .select(accountColumn)
      .or(getIdFilter(role, roleId))
      .maybeSingle();

    if (isAcct(data?.[accountColumn])) return data[accountColumn];
  }

  if (subTable && roleId) {
    const idColumn = getRoleIdColumn(role);

    const { data } = await supabase
      .from(subTable)
      .select(accountColumn)
      .eq(idColumn, roleId)
      .maybeSingle();

    if (isAcct(data?.[accountColumn])) return data[accountColumn];
  }

  if (subTable && emailValue) {
    const emailColumn = getRoleEmailColumn(role);

    const { data } = await supabase
      .from(subTable)
      .select(accountColumn)
      .eq(emailColumn, emailValue)
      .maybeSingle();

    if (isAcct(data?.[accountColumn])) return data[accountColumn];
  }

  return "";
}

async function updateSubscriptionRoleAccount(role, idValue, emailValue, customerId, accountId) {
  const table = getSubscriptionTable(role);
  const idColumn = getRoleIdColumn(role);
  const emailColumn = getRoleEmailColumn(role);
  const accountColumn = getRoleAccountColumn(role);

  if (!table || !accountColumn || !isAcct(accountId)) return;

  const payload = {
    [accountColumn]: accountId,
    updated_at: nowIso(),
  };

  const filters = [];

  if (idValue) filters.push(`${idColumn}.eq.${idValue}`);
  if (emailValue) filters.push(`${emailColumn}.eq.${emailValue}`);
  if (customerId) filters.push(`stripe_customer_id.eq.${customerId}`);

  if (!filters.length) return;

  await safeUpdate(
    table,
    payload,
    (query) => query.or(filters.join(",")),
    table
  );
}

async function syncSubscriptionToSupabase({
  role,
  roleId,
  emailValue,
  customer,
  subscription,
}) {
  const customerId =
    typeof customer === "string" ? customer : customer?.id || "";

  if (!isCus(customerId) || !isSub(subscription?.id)) return null;

  const payload = subscriptionPayload(role, customerId, subscription);

  const { data, error } = await updateMainRoleRow(role, roleId, emailValue, payload);
  if (error) throw error;

  await updateProfiles(role, roleId, emailValue, payload);
  await updateAdminVerifications(role, roleId, emailValue, payload);

  const roleAccount = await getSavedRoleAccount(role, roleId, emailValue);

  await upsertSubscriptionRow({
    role,
    roleId,
    roleEmail: emailValue,
    name: customer?.name || customer?.metadata?.name || "",
    username:
      subscription?.metadata?.username || customer?.metadata?.username || "",
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    roleAccount,
    subscriptionStatus: subscription.status,
    currentPeriodEnd: subscription.current_period_end,
  });

  return { payload, updatedRows: data };
}

async function parseStripeSession(sessionId) {
  return await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent", "customer", "subscription"],
  });
}

async function updateFromCheckoutSession(session) {
  const metadata = session.metadata || {};
  const role = roleName(metadata.role);

  if (!getRoleTable(role)) return;

  const roleId = getRoleIdFromMetadata(metadata, role);
  const emailValue = email(
    metadata.email ||
      session.customer_details?.email ||
      session.customer_email ||
      ""
  );

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id || "";

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id || "";

  const paymentType = roleName(metadata.paymentType || metadata.planType);

  if (role === "farmer" && (paymentType.includes("application") || session.mode === "payment")) {
    const payload = {
      stripe_customer_id: isCus(customerId) ? customerId : null,
      stripe_checkout_session_id: session.id,
      application_fee_status: "paid",
      application_fee_paid: true,
      application_status: "payment_completed",
      updated_at: nowIso(),
    };

    await updateMainRoleRow(role, roleId, emailValue, payload);
    await updateProfiles(role, roleId, emailValue, payload);
    return;
  }

  if (!isCus(customerId) || !isSub(subscriptionId)) return;

  let subscription;

  try {
    subscription =
      typeof session.subscription === "string"
        ? await stripe.subscriptions.retrieve(subscriptionId)
        : session.subscription;
  } catch {
    subscription = {
      id: subscriptionId,
      status: "active",
      current_period_end: null,
      metadata,
    };
  }

  const payload = {
    ...subscriptionPayload(role, customerId, subscription),
    stripe_checkout_session_id: session.id,
  };

  await updateMainRoleRow(role, roleId, emailValue, payload);
  await updateProfiles(role, roleId, emailValue, payload);
  await updateAdminVerifications(role, roleId, emailValue, payload);

  const roleAccount = await getSavedRoleAccount(role, roleId, emailValue);

  await upsertSubscriptionRow({
    role,
    roleId,
    roleEmail: emailValue,
    name: metadata.name || metadata.business_name || metadata.company_name || "",
    username: metadata.username || "",
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    roleAccount,
    subscriptionStatus: subscription.status,
    currentPeriodEnd: subscription.current_period_end,
  });
}

async function updateFromSubscription(subscription) {
  const metadata = subscription.metadata || {};
  const role = roleName(metadata.role);

  if (!getRoleTable(role)) return;

  const roleId = getRoleIdFromMetadata(metadata, role);

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id || "";

  let emailValue = email(metadata.email || "");
  let customer = null;

  if (!emailValue && isCus(customerId)) {
    try {
      customer = await stripe.customers.retrieve(customerId);
      emailValue = email(customer.email || "");
    } catch {}
  }

  const payload = subscriptionPayload(role, customerId, subscription);

  await updateMainRoleRow(role, roleId, emailValue, payload);
  await updateProfiles(role, roleId, emailValue, payload);
  await updateAdminVerifications(role, roleId, emailValue, payload);

  const roleAccount = await getSavedRoleAccount(role, roleId, emailValue);

  await upsertSubscriptionRow({
    role,
    roleId,
    roleEmail: emailValue,
    name:
      metadata.name ||
      metadata.business_name ||
      metadata.company_name ||
      customer?.name ||
      "",
    username: metadata.username || "",
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    roleAccount,
    subscriptionStatus: subscription.status,
    currentPeriodEnd: subscription.current_period_end,
  });
}

async function updateConnectAccount(account) {
  const metadata = account.metadata || {};
  const role = roleName(metadata.role || "freight");
  const accountColumn = getRoleAccountColumn(role);

  if (!getRoleTable(role) || !accountColumn || !isAcct(account.id)) return;

  const roleId = getRoleIdFromMetadata(metadata, role);
  const emailValue = email(metadata.email || account.email || "");
  const customerId = clean(metadata.stripe_customer_id || metadata.stripeCustomerId);

  const payload = {
    [accountColumn]: account.id,
    stripe_connect_status:
      account.charges_enabled && account.payouts_enabled ? "complete" : "started",
    payouts_enabled: Boolean(account.payouts_enabled),
    charges_enabled: Boolean(account.charges_enabled),
    stripe_payouts_enabled: Boolean(account.payouts_enabled),
    stripe_charges_enabled: Boolean(account.charges_enabled),
    stripe_onboarding_complete: Boolean(account.details_submitted),
    updated_at: nowIso(),
  };

  await updateMainRoleRow(role, roleId, emailValue, payload);
  await updateProfiles(role, roleId, emailValue, payload);
  await updateAdminVerifications(role, roleId, emailValue, payload);
  await updateSubscriptionRoleAccount(role, roleId, emailValue, customerId, account.id);
}

async function createSubscriptionCheckout(req, res) {
  try {
    if (!requireStripe(res)) return;
    if (!requireSupabase(res)) return;

    const body = req.body || {};
    const role = roleName(body.role || body.planType);
    const planType = roleName(body.planType || role);
    const roleId = getRoleIdFromBody(body, role);

    const finalEmail = email(
      body.customerEmail ||
        body.email ||
        body.freight_email ||
        body.driver_email ||
        body.farmer_email ||
        body.customer_email
    );

    const accountId = clean(body.accountId || body.account_id);

    const finalName = clean(
      body.companyName ||
        body.company_name ||
        body.businessName ||
        body.business_name ||
        body.farmName ||
        body.farm_name ||
        body.fullName ||
        body.full_name ||
        body.name ||
        `${role} User`
    );

    const username = clean(body.username);

    if (!role) {
      return res.status(400).json({
        success: false,
        error: "role is required.",
      });
    }

    if (!roleId) {
      return res.status(400).json({
        success: false,
        error: "userId/profile ID is required.",
      });
    }

    if (!finalEmail) {
      return res.status(400).json({
        success: false,
        error: "email is required.",
      });
    }

    const priceId = getPriceId(role, planType);

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
      userId: roleId,
      user_id: roleId,
      profileId: roleId,
      profile_id: roleId,
      authUserId: roleId,
      auth_user_id: roleId,
      accountId,
      account_id: accountId,
      email: finalEmail,
      username,
      name: finalName,
      business_name: finalName,
      company_name: finalName,
    };

    if (role === "freight") {
      metadata.freightId = roleId;
      metadata.freight_id = roleId;
    }

    if (role === "driver") {
      metadata.driverId = roleId;
      metadata.driver_id = roleId;
    }

    if (role === "farmer") {
      metadata.farmerId = roleId;
      metadata.farmer_id = roleId;
      metadata.farmer_email = finalEmail;
    }

    if (role === "customer") {
      metadata.customerId = roleId;
      metadata.customer_id = roleId;
      metadata.customer_email = finalEmail;
    }

    const existingCustomer = await findCustomerSmart({
      emailValue: finalEmail,
      businessName: finalName,
      username,
      role,
    });

    if (existingCustomer?.id && mode === "subscription") {
      const subscriptions = await listCustomerSubscriptions(existingCustomer.id);
      const existingSubscription = bestSubscription(subscriptions);

      if (
        existingSubscription?.id &&
        isActiveSubscription(existingSubscription.status)
      ) {
        await syncSubscriptionToSupabase({
          role,
          roleId,
          emailValue: finalEmail,
          customer: existingCustomer,
          subscription: existingSubscription,
        });

        return res.json({
          success: true,
          alreadySubscribed: true,
          message: "Existing active subscription found. No new payment opened.",
          stripeCustomerId: existingCustomer.id,
          stripeSubscriptionId: existingSubscription.id,
          subscriptionStatus: existingSubscription.status,
          role,
          userId: roleId,
          accountId,
        });
      }
    }

    const customerId =
      existingCustomer?.id ||
      (await getOrCreateCustomer({
        finalEmail,
        finalName,
        metadata,
      }));

    const successUrl =
      body.successUrl ||
      body.success_url ||
      `${APP_URL}/${role}/register?stripe=success&${getRoleIdColumn(role)}=${encodeURIComponent(
        roleId
      )}&email=${encodeURIComponent(finalEmail)}&session_id={CHECKOUT_SESSION_ID}`;

    const cancelUrl =
      body.cancelUrl ||
      body.cancel_url ||
      `${APP_URL}/${role}/register?checkout_canceled=true&${getRoleIdColumn(
        role
      )}=${encodeURIComponent(roleId)}&email=${encodeURIComponent(finalEmail)}`;

    const sessionPayload = {
      mode,
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
    };

    if (mode === "subscription") {
      sessionPayload.subscription_data = { metadata };
    }

    const session = await stripe.checkout.sessions.create(sessionPayload);

    const pendingPayload = {
      stripe_customer_id: customerId,
      stripe_checkout_session_id: session.id,
      membership_status:
        mode === "payment" ? "pending_application_fee" : "pending_payment",
      subscription_status: mode === "payment" ? "not_started" : "pending_payment",
      updated_at: nowIso(),
    };

    if (mode === "payment") {
      pendingPayload.application_fee_status = "pending_payment";
    }

    await updateMainRoleRow(role, roleId, finalEmail, pendingPayload);
    await updateProfiles(role, roleId, finalEmail, pendingPayload);
    await updateAdminVerifications(role, roleId, finalEmail, pendingPayload);

    return res.json({
      success: true,
      alreadySubscribed: false,
      url: session.url,
      id: session.id,
      sessionId: session.id,
      stripeCustomerId: customerId,
      customerId,
      role,
      planType,
      userId: roleId,
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

async function createConnectAccount(req, res) {
  try {
    if (!requireStripe(res)) return;
    if (!requireSupabase(res)) return;

    const body = req.body || {};
    const role = roleName(body.role || "freight");
    const table = getRoleTable(role);
    const accountColumn = getRoleAccountColumn(role);

    if (!table || !accountColumn || role === "customer") {
      return res.status(400).json({
        success: false,
        error: "Valid payout role is required. Customers do not use Connect accounts.",
      });
    }

    const requestedId = getRoleIdFromBody(body, role);

    const requestedEmail = email(
      body.email ||
        body.customerEmail ||
        body.freight_email ||
        body.driver_email ||
        body.farmer_email
          );

    const requestedBusinessName = clean(
      body.companyName ||
        body.company_name ||
        body.businessName ||
        body.business_name ||
        body.farmName ||
        body.farm_name ||
        body.name ||
        "Farm2Home Account"
    );

    const requestedAccountId = clean(body.accountId || body.account_id);

    const requestedAcct = clean(
      body[accountColumn] ||
        body.freight_account ||
        body.driver_account ||
        body.farmer_account ||
        body.stripeAccountId ||
        body.stripe_account_id
    );

    if (!requestedId && !requestedEmail && !requestedAccountId) {
      return res.status(400).json({
        success: false,
        error: "userId/profile ID, email, or accountId is required.",
      });
    }

    let row = null;

    if (requestedId) {
      const result = await supabase
        .from(table)
        .select("*")
        .or(getIdFilter(role, requestedId))
        .maybeSingle();

      if (result.error) throw result.error;
      row = result.data;
    }

    if (!row && requestedEmail) {
      const result = await supabase
        .from(table)
        .select("*")
        .eq("email", requestedEmail)
        .maybeSingle();

      if (result.error) throw result.error;
      row = result.data;
    }

    if (!row && requestedAccountId) {
      const result = await supabase
        .from(table)
        .select("*")
        .eq("account_id", requestedAccountId)
        .maybeSingle();

      if (result.error) throw result.error;
      row = result.data;
    }

    if (!row?.id) {
      return res.status(404).json({
        success: false,
        error: "Profile not found. Save registration first.",
      });
    }

    const finalId = row.id;
    const finalEmail = email(row.email || requestedEmail);
    const finalAccountId = clean(row.account_id || requestedAccountId);

    const finalName = clean(
      requestedBusinessName ||
        row.company_name ||
        row.business_name ||
        row.farm_name ||
        row.name ||
        "Farm2Home Account"
    );

    const customerId = clean(row.stripe_customer_id);
    let existingAcct = clean(row[accountColumn]);

    if (!isAcct(existingAcct) && isAcct(requestedAcct)) existingAcct = requestedAcct;
    if (!isAcct(existingAcct)) {
      existingAcct = await getSavedRoleAccount(role, finalId, finalEmail);
    }

    const metadata = {
      role,
      userId: finalId,
      user_id: finalId,
      profileId: finalId,
      profile_id: finalId,
      authUserId: finalId,
      auth_user_id: finalId,
      accountId: finalAccountId,
      account_id: finalAccountId,
      email: finalEmail,
      stripeCustomerId: customerId,
      stripe_customer_id: customerId,
      name: finalName,
      business_name: finalName,
      company_name: finalName,
    };

    if (role === "freight") {
      metadata.freightId = finalId;
      metadata.freight_id = finalId;
    }

    if (role === "driver") {
      metadata.driverId = finalId;
      metadata.driver_id = finalId;
    }

    if (role === "farmer") {
      metadata.farmerId = finalId;
      metadata.farmer_id = finalId;
    }

    let account;

    if (isAcct(existingAcct)) {
      account = await stripe.accounts.retrieve(existingAcct);

      try {
        account = await stripe.accounts.update(existingAcct, {
          business_profile: { name: finalName },
          metadata: {
            ...(account.metadata || {}),
            ...metadata,
          },
        });
      } catch (updateError) {
        console.log("Existing Connect account update skipped:", updateError.message);
        account = await stripe.accounts.retrieve(existingAcct);
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
          name: finalName,
        },
        metadata,
      });
    }

    await updateConnectAccount(account);

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url:
        body.refreshUrl ||
        body.refresh_url ||
        `${APP_URL}/${role}/connect-bank?refresh=true&${accountColumn}=${account.id}`,
      return_url:
        body.returnUrl ||
        body.return_url ||
        `${APP_URL}/${role}/connect-bank?connected=true&${accountColumn}=${account.id}`,
      type: "account_onboarding",
    });

    return res.json({
      success: true,
      url: accountLink.url,
      onboardingUrl: accountLink.url,
      stripeAccountId: account.id,
      stripe_account_id: account.id,
      [accountColumn]: account.id,
      accountId: finalAccountId,
      account_id: finalAccountId,
      userId: finalId,
      role,
      reused: isAcct(existingAcct),
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
}

function normalizeMarketplaceItems(body) {
  const items = Array.isArray(body.items)
    ? body.items
    : Array.isArray(body.cart)
      ? body.cart
      : [];

  return items.map((item) => {
    const price = Number(item.price || item.unit_price || 0);
    const quantity = Number(item.quantity || 1);

    const farmerStripeAccountId = clean(
      item.farmerStripeAccountId ||
        item.farmer_stripe_account_id ||
        item.stripeAccountId ||
        item.stripe_account_id ||
        ""
    );

    return {
      ...item,
      id: clean(item.id || item.cartItemId || item.productId || item.product_id),
      productId: clean(item.productId || item.product_id || item.id),
      product_id: clean(item.productId || item.product_id || item.id),
      name: clean(item.name || item.productName || item.product_name || "Farm Product"),
      price,
      quantity,
      lineTotal: Number((price * quantity).toFixed(2)),
      line_total: Number((price * quantity).toFixed(2)),
      farmerId: clean(item.farmerId || item.farmer_id),
      farmer_id: clean(item.farmerId || item.farmer_id),
      farmName: clean(
        item.farmName || item.farm_name || item.farmerName || "Farm2Home Farm"
      ),
      farm_name: clean(
        item.farmName || item.farm_name || item.farmerName || "Farm2Home Farm"
      ),
      farmerStripeAccountId,
      farmer_stripe_account_id: farmerStripeAccountId,
      stripeAccountId: farmerStripeAccountId,
      stripe_account_id: farmerStripeAccountId,
    };
  });
}

function normalizePayoutSplits(body, items) {
  const provided = Array.isArray(body.payoutSplits)
    ? body.payoutSplits
    : Array.isArray(body.payout_splits)
      ? body.payout_splits
      : [];

  if (provided.length > 0) {
    return provided.map((split) => {
      const stripeAccountId = clean(
        split.stripeAccountId ||
          split.stripe_account_id ||
          split.farmerStripeAccountId ||
          split.farmer_stripe_account_id
      );

      return {
        farmerId: clean(split.farmerId || split.farmer_id),
        farmer_id: clean(split.farmerId || split.farmer_id),
        farmName: clean(split.farmName || split.farm_name || "Farm2Home Farm"),
        farm_name: clean(split.farmName || split.farm_name || "Farm2Home Farm"),
        stripeAccountId,
        stripe_account_id: stripeAccountId,
        farmerStripeAccountId: stripeAccountId,
        farmer_stripe_account_id: stripeAccountId,
        subtotal: Number(split.subtotal || split.amount || 0),
        amount: Number(split.amount || split.subtotal || 0),
        itemCount: Number(split.itemCount || split.item_count || 0),
        item_count: Number(split.itemCount || split.item_count || 0),
        freightRequired: Boolean(split.freightRequired || split.freight_required),
        freight_required: Boolean(split.freightRequired || split.freight_required),
        driverPayout: Number(split.driverPayout || split.driver_payout || 0),
        driver_payout: Number(split.driverPayout || split.driver_payout || 0),
      };
    });
  }

  const groups = new Map();

  for (const item of items) {
    const farmerId = clean(item.farmerId || item.farmer_id);
    const farmName = clean(item.farmName || item.farm_name || "Farm2Home Farm");
    const stripeAccountId = clean(
      item.farmerStripeAccountId || item.stripe_account_id
    );

    const key = farmerId || farmName;

    if (!groups.has(key)) {
      groups.set(key, {
        farmerId,
        farmer_id: farmerId,
        farmName,
        farm_name: farmName,
        stripeAccountId,
        stripe_account_id: stripeAccountId,
        farmerStripeAccountId: stripeAccountId,
        farmer_stripe_account_id: stripeAccountId,
        subtotal: 0,
        amount: 0,
        itemCount: 0,
        item_count: 0,
        freightRequired: false,
        freight_required: false,
        driverPayout: 0,
        driver_payout: 0,
      });
    }

    const group = groups.get(key);
    group.subtotal += Number(item.lineTotal || item.line_total || 0);
    group.amount = group.subtotal;
    group.itemCount += Number(item.quantity || 1);
    group.item_count = group.itemCount;
  }

  return Array.from(groups.values()).map((split) => ({
    ...split,
    subtotal: Number(split.subtotal.toFixed(2)),
    amount: Number(split.amount.toFixed(2)),
  }));
}

async function saveMarketplaceOrder(order) {
  const payload = {
    id: order.orderId,
    customer_id: order.customerId,
    customer_email: order.customerEmail,
    customer_name: order.customerName,
    status: order.status,
    subtotal: order.subtotal,
    service_fee: order.serviceFee,
    platform_fee: order.platformFee,
    delivery_fee: order.deliveryFee,
    freight_handling_fee: order.freightHandlingFee,
    tip: order.tip,
    total: order.total,
    delivery_option: order.deliveryOption,
    delivery_address: order.deliveryAddress,
    city: order.city,
    state: order.state,
    zip_code: order.zipCode,
    phone: order.phone,
    delivery_instructions: order.deliveryInstructions,
    items: order.items,
    payout_splits: order.payoutSplits,
    stripe_checkout_session_id: order.stripeCheckoutSessionId || null,
    stripe_payment_intent_id: order.stripePaymentIntentId || null,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
  };

  const tables = ["orders", "customer_orders", "farm_orders"];

  for (const table of tables) {
    try {
      const { error } = await safeUpsert(table, payload, { onConflict: "id" }, table);
      if (!error) return table;
    } catch (error) {
      console.log(`${table} marketplace order save exception:`, error.message);
    }
  }

  return null;
}

async function saveMarketplaceOrderItems(order) {
  const rows = order.items.map((item) => ({
    id: `${order.orderId}_${clean(item.productId || item.product_id || item.id)}`,
    order_id: order.orderId,
    customer_id: order.customerId,
    farmer_id: item.farmerId || item.farmer_id,
    farm_name: item.farmName || item.farm_name,
    product_id: item.productId || item.product_id || item.id,
    product_name: item.name,
    quantity: item.quantity,
    price: item.price,
    line_total: item.lineTotal || item.line_total,
    farmer_stripe_account_id:
      item.farmerStripeAccountId || item.farmer_stripe_account_id || null,
    stripe_account_id: item.stripeAccountId || item.stripe_account_id || null,
    status: order.status,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
  }));

  const tables = ["order_items", "customer_order_items", "farm_order_items"];

  for (const table of tables) {
    for (const row of rows) {
      try {
        const { error } = await safeUpsert(table, row, { onConflict: "id" }, table);
        if (!error) return table;
      } catch (error) {
        console.log(`${table} marketplace item save exception:`, error.message);
      }
    }
  }

  return null;
}

async function saveMarketplaceTransfers(order, paymentIntentId = null) {
  const rows = order.payoutSplits.map((split) => ({
    id: `${order.orderId}_${split.farmerId || split.farmName}`,
    order_id: order.orderId,
    farmer_id: split.farmerId,
    farm_name: split.farmName,
    stripe_account_id: split.stripeAccountId,
    amount: split.amount,
    subtotal: split.subtotal,
    platform_fee: Number((split.subtotal * FARMER_PLATFORM_FEE_RATE).toFixed(2)),
    transfer_status: isAcct(split.stripeAccountId)
      ? "pending_payment"
      : "missing_connect_account",
    stripe_payment_intent_id: paymentIntentId,
    stripe_transfer_id: null,
    created_at: order.createdAt,
    updated_at: nowIso(),
  }));

  const tables = ["marketplace_transfers", "farmer_payouts", "payout_splits"];

  for (const table of tables) {
    for (const row of rows) {
      try {
        const { error } = await safeUpsert(table, row, { onConflict: "id" }, table);
        if (!error) return table;
      } catch (error) {
        console.log(`${table} save exception:`, error.message);
      }
    }
  }

  return null;
}

async function createStripeTransfersForMarketplaceOrder(order, paymentIntentId) {
  if (!paymentIntentId) return [];

  const transfers = [];

  for (const split of order.payoutSplits || []) {
    const destination = clean(split.stripeAccountId || split.stripe_account_id);

    if (!isAcct(destination)) {
      transfers.push({
        success: false,
        farmerId: split.farmerId,
        farmName: split.farmName,
        reason: "missing_connect_account",
      });
      continue;
    }

    const grossCents = cents(split.subtotal);
    const platformFeeCents = Math.round(grossCents * FARMER_PLATFORM_FEE_RATE);
    const transferAmountCents = Math.max(grossCents - platformFeeCents, 0);

    if (transferAmountCents <= 0) continue;

    try {
      const transfer = await stripe.transfers.create({
        amount: transferAmountCents,
        currency: "usd",
        destination,
        metadata: {
          orderId: order.orderId,
          order_id: order.orderId,
          farmerId: split.farmerId,
          farmer_id: split.farmerId,
          farmName: split.farmName,
          farm_name: split.farmName,
          subtotal: String(split.subtotal),
          platformFee: dollarsFromCents(platformFeeCents).toFixed(2),
          paymentIntentId,
          payment_intent_id: paymentIntentId,
          type: "farm2home_marketplace_farmer_transfer",
        },
      });

      transfers.push({
        success: true,
        farmerId: split.farmerId,
        farmName: split.farmName,
        stripeAccountId: destination,
        amount: dollarsFromCents(transferAmountCents),
        transferId: transfer.id,
      });
    } catch (error) {
      console.error("Stripe transfer failed:", error.message);

      transfers.push({
        success: false,
        farmerId: split.farmerId,
        farmName: split.farmName,
        stripeAccountId: destination,
        amount: dollarsFromCents(transferAmountCents),
        error: error.message,
      });
    }
  }

  return transfers;
}

async function markFarmersFirstPaidSale(order) {
  if (!supabase || !order) return [];

  const farmerIds = new Set();

  for (const split of order.payoutSplits || []) {
    const farmerId = clean(split.farmerId || split.farmer_id);
    if (farmerId) farmerIds.add(farmerId);
  }

  for (const item of order.items || []) {
    const farmerId = clean(item.farmerId || item.farmer_id);
    if (farmerId) farmerIds.add(farmerId);
  }

  const results = [];

  for (const farmerId of farmerIds) {
    try {
      const lookup = await supabase
        .from("farmers")
        .select("*")
        .or(getIdFilter("farmer", farmerId))
        .maybeSingle();

      if (lookup.error) {
        console.log("Farmer first-sale lookup skipped:", lookup.error.message);
        results.push({ farmerId, success: false, error: lookup.error.message });
        continue;
      }

      const farmer = lookup.data;
      if (!farmer) {
        results.push({ farmerId, success: false, error: "Farmer not found." });
        continue;
      }

      // Idempotent: never move an already-paid/activated farmer backward.
      const membershipStatus = roleName(farmer.membership_status);
      const subscriptionStatus = roleName(farmer.subscription_status);
      const alreadyActivated =
        farmer.farmer_membership_paid === true ||
        ["active", "trialing", "past_due"].includes(subscriptionStatus) ||
        membershipStatus === "active";

      if (alreadyActivated) {
        results.push({ farmerId, success: true, alreadyActivated: true });
        continue;
      }

      const firstSaleAt = clean(farmer.first_sale_at) || nowIso();
      const due = new Date(firstSaleAt);
      due.setUTCDate(due.getUTCDate() + FARMER_ACTIVATION_GRACE_DAYS);

      const payload = {
        account_active: true,
        first_sale_completed: true,
        first_sale_at: firstSaleAt,
        membership_status: "activation_required",
        subscription_status: "not_started",
        farmer_membership_paid: false,
        monthly_membership_started: false,
        membership_activation_due_at: due.toISOString(),
        updated_at: nowIso(),
      };

      const updated = await updateMainRoleRow(
        "farmer",
        farmerId,
        email(farmer.email || farmer.farmer_email),
        payload
      );

      if (updated.error) {
        results.push({ farmerId, success: false, error: updated.error.message });
        continue;
      }

      results.push({
        farmerId,
        success: true,
        firstSaleAt,
        activationDueAt: due.toISOString(),
      });
    } catch (error) {
      console.error("First-sale activation error:", error);
      results.push({ farmerId, success: false, error: error.message });
    }
  }

  return results;
}

async function updateMarketplaceOrderPaid(session) {
  if (!supabase || !stripe) return;

  const metadata = session.metadata || {};
  const orderId = clean(metadata.orderId || metadata.order_id);

  if (!orderId) return;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || "";

  let order = null;

  for (const table of ["orders", "customer_orders", "farm_orders"]) {
    const { data } = await supabase
      .from(table)
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (data) {
      order = {
        orderId,
        customerId: data.customer_id,
        customerEmail: data.customer_email,
        customerName: data.customer_name,
        subtotal: Number(data.subtotal || 0),
        serviceFee: Number(data.service_fee || 0),
        platformFee: Number(data.platform_fee || data.service_fee || 0),
        deliveryFee: Number(data.delivery_fee || 0),
        freightHandlingFee: Number(data.freight_handling_fee || 0),
        tip: Number(data.tip || 0),
        total: Number(data.total || 0),
        items: Array.isArray(data.items) ? data.items : [],
        payoutSplits: Array.isArray(data.payout_splits) ? data.payout_splits : [],
        createdAt: data.created_at,
      };
      break;
    }
  }

  if (!order) {
       try {
      order = JSON.parse(metadata.orderPayload || "{}");
    } catch {
      order = null;
    }
  }

  if (!order?.orderId) return;

  const transfers = await createStripeTransfersForMarketplaceOrder(
    order,
    paymentIntentId
  );

  const paidPayload = {
    status: "PAID",
    payment_status: "paid",
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId || null,
    transfer_results: transfers,
    updated_at: nowIso(),
  };

  for (const table of ["orders", "customer_orders", "farm_orders"]) {
    try {
      await safeUpdate(
        table,
        paidPayload,
        (query) => query.eq("id", orderId),
        table
      );
    } catch {}
  }

  // A farmer's first sale is triggered only after Stripe confirms the marketplace
  // checkout was successfully paid. This is intentionally server-side/idempotent.
  await markFarmersFirstPaidSale(order);

  for (const table of ["marketplace_transfers", "farmer_payouts", "payout_splits"]) {
    for (const transfer of transfers) {
      try {
        await supabase
          .from(table)
          .update({
            transfer_status: transfer.success ? "transferred" : "failed",
            stripe_transfer_id: transfer.transferId || null,
            stripe_payment_intent_id: paymentIntentId || null,
            error_message: transfer.error || null,
            updated_at: nowIso(),
          })
          .eq("order_id", orderId)
          .eq("farmer_id", transfer.farmerId);
      } catch {}
    }
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
        process.env.STRIPE_FARMER_SUBSCRIPTION_PRICE_ID ||
        process.env.STRIPE_FARMER_PRICE_ID
    ),
    farmerApplicationPriceConfigured: Boolean(
      process.env.STRIPE_FARMER_APPLICATION_FEE_PRICE_ID
    ),
    customerMonthlyMembershipEnabled: false,
    customerCheckoutServiceFee: CUSTOMER_CHECKOUT_SERVICE_FEE,
    farmerPlatformFeeRate: FARMER_PLATFORM_FEE_RATE,
    farmerFirstSaleGraceDays: FARMER_ACTIVATION_GRACE_DAYS,
    marketplaceCheckoutConfigured: true,
  });
});

router.post("/create-subscription-checkout", createSubscriptionCheckout);

router.post("/create-freight-subscription-checkout", (req, res) => {
  req.body = {
    ...(req.body || {}),
    role: "freight",
    planType: "freight",
  };

  return createSubscriptionCheckout(req, res);
});

router.post("/create-driver-subscription-checkout", (req, res) => {
  req.body = {
    ...(req.body || {}),
    role: "driver",
    planType: "driver",
  };

  return createSubscriptionCheckout(req, res);
});

router.post("/create-farmer-membership-checkout", (req, res) => {
  req.body = {
    ...(req.body || {}),
    role: "farmer",
    planType: "farmer_membership",
  };

  return createSubscriptionCheckout(req, res);
});

router.post("/create-farmer-checkout", (req, res) => {
  req.body = {
    ...(req.body || {}),
    role: "farmer",
    planType: "farmer_membership",
  };

  return createSubscriptionCheckout(req, res);
});

router.post("/create-farmer-application-checkout", (req, res) => {
  req.body = {
    ...(req.body || {}),
    role: "farmer",
    planType: "farmer_application",
  };

  return createSubscriptionCheckout(req, res);
});

router.post("/create-customer-subscription-checkout", (req, res) => {
  return res.status(410).json({
    success: false,
    error: "Customer monthly memberships are no longer used. Customers pay a flat $4.99 service fee at marketplace checkout.",
  });
});

router.post("/create-freight-connect-account", (req, res) => {
  req.body = { ...(req.body || {}), role: "freight" };
  return createConnectAccount(req, res);
});

router.post("/create-driver-connect-account", (req, res) => {
  req.body = { ...(req.body || {}), role: "driver" };
  return createConnectAccount(req, res);
});

router.post("/create-farmer-connect-account", (req, res) => {
  req.body = { ...(req.body || {}), role: "farmer" };
  return createConnectAccount(req, res);
});

router.post("/create-connect-account", createConnectAccount);

router.post("/create-marketplace-checkout", async (req, res) => {
  try {
    if (!requireStripe(res)) return;
    if (!requireSupabase(res)) return;

    const body = req.body || {};

    const orderId =
      clean(body.orderId || body.order_id || body.cloudOrderId) ||
      `order_${Date.now()}`;

    const customerId = clean(body.customerId || body.customer_id || body.userId);
    const customerEmail = email(
      body.customerEmail || body.customer_email || body.email
    );
    const customerName = clean(
      body.customerName || body.customer_name || body.name || "Farm2Home Customer"
    );
    const stripeCustomerId = clean(
      body.stripeCustomerId || body.stripe_customer_id
    );

    const items = normalizeMarketplaceItems(body);

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: "customerId is required.",
      });
    }

    if (!customerEmail) {
      return res.status(400).json({
        success: false,
        error: "customerEmail is required.",
      });
    }

    if (!items.length) {
      return res.status(400).json({
        success: false,
        error: "Cart items are required.",
      });
    }

    const payoutSplits = normalizePayoutSplits(body, items);

    const invalidSplit = payoutSplits.find((split) => !clean(split.farmerId));

    if (invalidSplit) {
      return res.status(400).json({
        success: false,
        error: "Every payout split must include farmerId.",
      });
    }

    const subtotal =
      Number(body.subtotal || 0) ||
      Number(
        items
          .reduce((sum, item) => sum + Number(item.lineTotal || 0), 0)
          .toFixed(2)
      );

    // Customer pricing: no monthly membership and no percentage checkout fee.
    // Charge one flat $4.99 Farm2Home service fee per completed checkout.
    const serviceFee = CUSTOMER_CHECKOUT_SERVICE_FEE;

    const deliveryFee = Number(body.deliveryFee || body.delivery_fee || 0);
    const freightHandlingFee = Number(
      body.freightHandlingFee || body.freight_handling_fee || 0
    );
    const tip = Number(body.tip || 0);
    const total = Number(
      (subtotal + serviceFee + deliveryFee + freightHandlingFee + tip).toFixed(2)
    );

    const deliveryOption = clean(
      body.deliveryOption ||
        body.delivery_option ||
        body.deliveryInfo?.deliveryOption ||
        "Delivery"
    );

    const deliveryInfo = body.deliveryInfo || body.delivery_info || {};

    const successUrl =
      body.successUrl ||
      body.success_url ||
      `${APP_URL}/customer/order-success?orderId=${encodeURIComponent(
        orderId
      )}&session_id={CHECKOUT_SESSION_ID}`;

    const cancelUrl =
      body.cancelUrl || body.cancel_url || `${APP_URL}/customer/cart`;

    let stripeCustomer = stripeCustomerId;

    if (!isCus(stripeCustomer)) {
      stripeCustomer = await getOrCreateCustomer({
        finalEmail: customerEmail,
        finalName: customerName,
        metadata: {
          role: "customer",
          customerId,
          customer_id: customerId,
          userId: customerId,
          email: customerEmail,
          name: customerName,
          marketplaceCustomer: "true",
        },
      });
    }

    const metadata = {
      role: "customer",
      paymentType: "marketplace_order",
      orderId,
      order_id: orderId,
      customerId,
      customer_id: customerId,
      customerEmail,
      customer_email: customerEmail,
      customerName,
      customer_name: customerName,
      subtotal: subtotal.toFixed(2),
      serviceFee: serviceFee.toFixed(2),
      deliveryFee: deliveryFee.toFixed(2),
      freightHandlingFee: freightHandlingFee.toFixed(2),
      tip: tip.toFixed(2),
      total: total.toFixed(2),
      farmerCount: String(payoutSplits.length),
    };

    const order = {
      orderId,
      customerId,
      customerEmail,
      customerName,
      stripeCustomerId: stripeCustomer,
      subtotal,
      serviceFee,
      platformFee: serviceFee,
      deliveryFee,
      freightHandlingFee,
      tip,
      total,
      deliveryOption,
      deliveryAddress: clean(
        body.deliveryAddress ||
          body.delivery_address ||
          deliveryInfo.deliveryAddress
      ),
      city: clean(body.city || deliveryInfo.city),
      state: clean(body.state || deliveryInfo.state),
      zipCode: clean(body.zipCode || body.zip_code || deliveryInfo.zipCode),
      phone: clean(body.phone || deliveryInfo.phone),
      deliveryInstructions: clean(
        body.deliveryInstructions ||
          body.delivery_instructions ||
          deliveryInfo.deliveryInstructions
      ),
      items,
      payoutSplits,
      status: "PENDING_PAYMENT",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    await saveMarketplaceOrder(order);
    await saveMarketplaceOrderItems(order);
    await saveMarketplaceTransfers(order);

    const lineItems = items.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: item.name,
          metadata: {
            productId: item.productId,
            farmerId: item.farmerId,
            farmName: item.farmName,
          },
        },
        unit_amount: cents(item.price),
      },
      quantity: item.quantity,
    }));

    if (serviceFee > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Farm2Home Service Fee" },
          unit_amount: cents(serviceFee),
        },
        quantity: 1,
      });
    }

    if (deliveryFee > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Delivery Fee" },
          unit_amount: cents(deliveryFee),
        },
        quantity: 1,
      });
    }

    if (freightHandlingFee > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Freight Handling Fee" },
          unit_amount: cents(freightHandlingFee),
        },
        quantity: 1,
      });
    }

    if (tip > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Driver Tip" },
          unit_amount: cents(tip),
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: stripeCustomer,
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      payment_intent_data: { metadata },
    });

    await saveMarketplaceOrder({
      ...order,
      stripeCheckoutSessionId: session.id,
      stripe_checkout_session_id: session.id,
    });

    return res.json({
      success: true,
      url: session.url,
      sessionId: session.id,
      id: session.id,
      orderId,
      customerId,
      stripeCustomerId: stripeCustomer,
      subtotal,
      serviceFee,
      deliveryFee,
      freightHandlingFee,
      tip,
      total,
      payoutSplits,
      farmerSplitCount: payoutSplits.length,
      message: "Marketplace checkout created.",
    });
  } catch (error) {
    console.error("create-marketplace-checkout error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to create marketplace checkout.",
    });
  }
});

router.post("/verify-checkout-session", async (req, res) => {
  try {
    if (!requireStripe(res)) return;
    if (!requireSupabase(res)) return;

    const sessionId = clean(req.body?.sessionId || req.body?.session_id);

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "sessionId is required.",
      });
    }

    const session = await parseStripeSession(sessionId);

    if (session.metadata?.paymentType === "marketplace_order") {
      await updateMarketplaceOrderPaid(session);
    } else {
      await updateFromCheckoutSession(session);
    }

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

router.post("/force-sync-role-subscription", async (req, res) => {
  try {
    if (!requireStripe(res)) return;
    if (!requireSupabase(res)) return;

    const role = roleName(req.body?.role || "freight");
    const roleId = getRoleIdFromBody(req.body || {}, role);
    const emailValue = email(req.body?.email);
    const businessName = clean(
      req.body?.businessName || req.body?.companyName || req.body?.name
    );
    const username = clean(req.body?.username);
    const customerId = clean(
      req.body?.stripeCustomerId || req.body?.stripe_customer_id
    );

    const customer = await findCustomerSmart({
      emailValue,
      businessName,
      username,
      role,
      stripeCustomerId: customerId,
    });

    if (!customer?.id) {
      return res.status(404).json({
        success: false,
        error: "No Stripe customer found.",
      });
    }

    const subscriptions = await listCustomerSubscriptions(customer.id);
    const subscription = bestSubscription(subscriptions);

    if (!subscription?.id) {
      return res.status(404).json({
        success: false,
        error: "Stripe customer found, but no subscription was found.",
        stripeCustomerId: customer.id,
      });
    }

    const resolvedEmail = email(customer.email || emailValue);

    const synced = await syncSubscriptionToSupabase({
      role,
      roleId,
      emailValue: resolvedEmail,
      customer,
      subscription,
    });

    return res.json({
      success: true,
      message: "Subscription synced.",
      stripeCustomerId: customer.id,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      updatedRows: synced?.updatedRows || [],
    });
  } catch (error) {
    console.error("force-sync-role-subscription error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to force sync subscription.",
    });
  }
});

router.post("/force-sync-freight-subscription", async (req, res) => {
  req.body = {
    ...(req.body || {}),
    role: "freight",
  };

  return router.handle(req, res);
});

router.post("/sync-stripe-by-email", async (req, res) => {
  try {
    if (!requireStripe(res)) return;
    if (!requireSupabase(res)) return;

    const role = roleName(req.body?.role || "freight");
    const roleId = getRoleIdFromBody(req.body || {}, role);

    const emailValue = email(
      req.body?.email ||
        req.body?.freight_email ||
        req.body?.driver_email ||
        req.body?.farmer_email ||
        req.body?.customer_email
    );

    const businessName = clean(
      req.body?.businessName || req.body?.companyName || req.body?.name
    );
    const username = clean(req.body?.username);
    const customerId = clean(
      req.body?.stripeCustomerId || req.body?.stripe_customer_id
    );

    const customer = await findCustomerSmart({
      emailValue,
      businessName,
      username,
      role,
      stripeCustomerId: customerId,
    });

    if (!customer?.id) {
      return res.status(404).json({
        success: false,
        error: "No Stripe customer found.",
      });
    }

    const subscriptions = await listCustomerSubscriptions(customer.id);
    const subscription = bestSubscription(subscriptions);
    const resolvedEmail = email(customer.email || emailValue);

    const payload = {
      stripe_customer_id: customer.id,
      updated_at: nowIso(),
    };

    if (subscription?.id) {
      Object.assign(payload, subscriptionPayload(role, customer.id, subscription));
    }

    const { data, error } = await updateMainRoleRow(
      role,
      roleId,
      resolvedEmail,
      payload
    );

    if (error) throw error;

    await updateProfiles(role, roleId, resolvedEmail, payload);
    await updateAdminVerifications(role, roleId, resolvedEmail, payload);

    if (subscription?.id) {
      const resolvedRoleId = roleId || data?.[0]?.id;
      const roleAccount = await getSavedRoleAccount(
        role,
        resolvedRoleId,
        resolvedEmail
      );

      await upsertSubscriptionRow({
        role,
        roleId: resolvedRoleId,
        roleEmail: resolvedEmail,
        name: customer.name || businessName || "",
        username: username || customer.metadata?.username || "",
        stripeCustomerId: customer.id,
        stripeSubscriptionId: subscription.id,
        roleAccount,
        subscriptionStatus: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
      });
    }

    return res.json({
      success: true,
      role,
           email: resolvedEmail,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: subscription?.id || null,
      subscriptionStatus: subscription?.status || null,
      subscriptionActive: subscription
        ? isActiveSubscription(subscription.status)
        : false,
      updatedRows: data,
    });
  } catch (error) {
    console.error("sync-stripe-by-email error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to sync Stripe by email.",
    });
  }
});

router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe) {
    return res.status(200).json({
      received: true,
      ignored: true,
    });
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
        const session = event.data.object;

        if (session.metadata?.paymentType === "marketplace_order") {
          const expandedSession = await parseStripeSession(session.id);
          await updateMarketplaceOrderPaid(expandedSession);
        } else {
          await updateFromCheckoutSession(session);
        }

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await updateFromSubscription(event.data.object);
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
router.post("/create-bundle-subscription", async (req, res) => {
  try {
    if (!requireStripe(res)) return;

    const {
      customerId,
      customerEmail,
      farmerId,
      bundleId,
      bundleName,
      bundleType,
      fulfillmentMethod,
      deliveryMethod,
      frequency,
      price,
      amount,
    } = req.body || {};

    const finalFrequency =
      String(frequency || "").toLowerCase().includes("bi")
        ? "bi-monthly"
        : "monthly";

    const intervalCount = finalFrequency === "bi-monthly" ? 2 : 1;

    const finalAmount = Number(price || amount || 0);

    if (!customerEmail) {
      return res.status(400).json({
        success: false,
        error: "customerEmail is required.",
      });
    }

    if (!bundleId || !bundleName || !farmerId) {
      return res.status(400).json({
        success: false,
        error: "bundleId, bundleName, and farmerId are required.",
      });
    }

    if (!finalAmount || finalAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Valid bundle price is required.",
      });
    }

    const finalDeliveryMethod =
      fulfillmentMethod || deliveryMethod || "delivery";

    const successUrl =
      process.env.APP_URL ||
      process.env.FRONTEND_URL ||
      "https://farm2home-s-projects.vercel.app";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: customerEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: Math.round(finalAmount * 100),
            recurring: {
              interval: "month",
              interval_count: intervalCount,
            },
            product_data: {
              name: bundleName,
              description: `${bundleType || "Farm"} bundle - ${finalDeliveryMethod} - ${finalFrequency}`,
              metadata: {
                type: "farm_bundle",
                customerId: customerId || "",
                customerEmail,
                farmerId,
                bundleId,
                bundleName,
                bundleType: bundleType || "",
                deliveryMethod: finalDeliveryMethod,
                frequency: finalFrequency,
              },
            },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          type: "farm_bundle",
          customerId: customerId || "",
          customerEmail,
          farmerId,
          bundleId,
          bundleName,
          bundleType: bundleType || "",
          deliveryMethod: finalDeliveryMethod,
          frequency: finalFrequency,
          amount: String(finalAmount),
        },
      },
      metadata: {
        type: "farm_bundle",
        customerId: customerId || "",
        customerEmail,
        farmerId,
        bundleId,
        bundleName,
        bundleType: bundleType || "",
        deliveryMethod: finalDeliveryMethod,
        frequency: finalFrequency,
        amount: String(finalAmount),
      },
      success_url: `${successUrl}/customer/bundle-subscriptions?success=true`,
      cancel_url: `${successUrl}/customer/farm-bundles?cancelled=true`,
    });

    return res.json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("create-bundle-subscription error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Unable to create bundle subscription.",
    });
  }
});

router.post("/cancel-bundle-subscription", async (req, res) => {
  try {
    if (!requireStripe(res)) return;

    const { stripeSubscriptionId, subscriptionId } = req.body || {};
    const subId = stripeSubscriptionId || subscriptionId;

    if (!subId || !String(subId).startsWith("sub_")) {
      return res.status(400).json({
        success: false,
        error: "Valid Stripe subscription ID is required.",
      });
    }

    const cancelled = await stripe.subscriptions.cancel(subId);

    return res.json({
      success: true,
      subscription: cancelled,
      status: cancelled.status,
    });
  } catch (error) {
    console.error("cancel-bundle-subscription error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Unable to cancel bundle subscription.",
    });
  }
});
// Router export intentionally kept at the end of this file.

router.post("/connect-account-status", async (req, res) => {
  try {
    const { farmerId } = req.body;

    if (!farmerId) {
      return res.status(400).json({
        success: false,
        message: "Missing farmerId",
      });
    }

    const { data: farmer, error } = await supabase
      .from("farmers")
      .select("*")
      .or(`id.eq.${farmerId},farmer_id.eq.${farmerId}`)
      .single();

    if (error || !farmer) {
      return res.status(404).json({
        success: false,
        message: "Farmer not found",
      });
    }

    const accountId =
      farmer.stripe_account_id ||
      farmer.farmer_stripe_account_id;

    if (!accountId) {
      return res.json({
        success: true,
        connected: false,
        account: null,
      });
    }

    const account = await stripe.accounts.retrieve(accountId);

    return res.json({
      success: true,
      connected: true,
      account,
    });
  } catch (err) {
    console.error("Stripe status error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});
// ============================================================
// UNIVERSAL MEMBERSHIP SUBSCRIPTION CANCELLATION
//
// Supported profiles:
//   customer
//   farmer
//   freight
//   driver
//
// Endpoint:
//   POST /payments/cancel-subscription
//
// Default behavior:
//   Cancel at the end of the current Stripe billing period.
//
// This preserves access until Stripe actually changes the
// subscription to canceled.
// ============================================================

router.post("/cancel-subscription", async (req, res) => {
  try {
    if (!requireStripe(res)) return;
    if (!requireSupabase(res)) return;

    const body = req.body || {};

    // --------------------------------------------------------
    // 1. Resolve role
    // --------------------------------------------------------

    const role = roleName(
      body.role ||
        body.profileRole ||
        body.profile_role ||
        body.userRole ||
        body.user_role
    );

    const allowedRoles = [
      "customer",
      "farmer",
      "freight",
      "driver",
    ];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error:
          "Valid role is required. Supported roles: customer, farmer, freight, driver.",
      });
    }

    // --------------------------------------------------------
    // 2. Resolve correct tables/columns
    // --------------------------------------------------------

    const roleTable = getRoleTable(role);
    const subscriptionTable = getSubscriptionTable(role);
    const roleIdColumn = getRoleIdColumn(role);
    const roleEmailColumn = getRoleEmailColumn(role);

    if (!roleTable || !subscriptionTable) {
      return res.status(400).json({
        success: false,
        error: `Subscription configuration was not found for role=${role}.`,
      });
    }

    // --------------------------------------------------------
    // 3. Resolve profile/user ID
    // --------------------------------------------------------

    let roleId = getRoleIdFromBody(body, role);

    // Extra compatibility with all profile payloads
    if (!roleId) {
      roleId = clean(
        body.id ||
          body.profileId ||
          body.profile_id ||
          body.authUserId ||
          body.auth_user_id ||
          body.userId ||
          body.user_id
      );
    }

    // --------------------------------------------------------
    // 4. Resolve email
    // --------------------------------------------------------

    let emailValue = email(
      body.email ||
        body.customerEmail ||
        body.customer_email ||
        body.farmerEmail ||
        body.farmer_email ||
        body.freightEmail ||
        body.freight_email ||
        body.driverEmail ||
        body.driver_email
    );

    // --------------------------------------------------------
    // 5. Resolve Stripe IDs sent by frontend
    // --------------------------------------------------------

    let stripeCustomerId = clean(
      body.stripeCustomerId ||
        body.stripe_customer_id ||
        body.customerStripeId ||
        body.customer_stripe_id
    );

    let subscriptionId = clean(
      body.stripeSubscriptionId ||
        body.stripe_subscription_id ||
        body.subscriptionId ||
        body.subscription_id
    );

    console.log("========================================");
    console.log("CANCEL SUBSCRIPTION REQUEST");
    console.log("role:", role);
    console.log("roleId:", roleId);
    console.log("email:", emailValue);
    console.log("stripeCustomerId:", stripeCustomerId);
    console.log("subscriptionId:", subscriptionId);
    console.log("========================================");

    // --------------------------------------------------------
    // 6. Find main profile row
    //
    // We use this as another source for:
    //   role ID
    //   email
    //   Stripe customer
    //   Stripe subscription
    // --------------------------------------------------------

    let roleRow = null;

    if (roleId) {
      try {
        const result = await supabase
          .from(roleTable)
          .select("*")
          .or(getIdFilter(role, roleId))
          .maybeSingle();

        if (result.error) {
          console.log(
            `${roleTable} lookup by ID skipped:`,
            result.error.message
          );
        } else {
          roleRow = result.data;
        }
      } catch (error) {
        console.log(
          `${roleTable} lookup by ID exception:`,
          error.message
        );
      }
    }

    // --------------------------------------------------------
    // If ID lookup failed, try email
    // --------------------------------------------------------

    if (!roleRow && emailValue) {
      try {
        let result = await supabase
          .from(roleTable)
          .select("*")
          .eq("email", emailValue)
          .maybeSingle();

        // Some tables may use their role-specific email column.
        if (
          result.error &&
          roleEmailColumn &&
          roleEmailColumn !== "email"
        ) {
          result = await supabase
            .from(roleTable)
            .select("*")
            .eq(roleEmailColumn, emailValue)
            .maybeSingle();
        }

        if (result.error) {
          console.log(
            `${roleTable} lookup by email skipped:`,
            result.error.message
          );
        } else {
          roleRow = result.data;
        }
      } catch (error) {
        console.log(
          `${roleTable} lookup by email exception:`,
          error.message
        );
      }
    }

    // --------------------------------------------------------
    // Fill missing identifiers from main profile
    // --------------------------------------------------------

    if (roleRow) {
      if (!roleId) {
        roleId = clean(
          roleRow.id ||
            roleRow[roleIdColumn] ||
            roleRow.profile_id ||
            roleRow.auth_user_id
        );
      }

      if (!emailValue) {
        emailValue = email(
          roleRow.email ||
            roleRow[roleEmailColumn]
        );
      }

      if (!isCus(stripeCustomerId)) {
        stripeCustomerId = clean(
          roleRow.stripe_customer_id
        );
      }

      if (!isSub(subscriptionId)) {
        subscriptionId = clean(
          roleRow.stripe_subscription_id ||
            roleRow.subscription_id
        );
      }
    }

    // --------------------------------------------------------
    // 7. Search role subscription table
    // --------------------------------------------------------

    let subscriptionRow = null;

    // First search using Stripe subscription ID
    if (isSub(subscriptionId)) {
      try {
        const result = await supabase
          .from(subscriptionTable)
          .select("*")
          .eq("stripe_subscription_id", subscriptionId)
          .maybeSingle();

        if (!result.error) {
          subscriptionRow = result.data;
        }
      } catch (error) {
        console.log(
          `${subscriptionTable} lookup by subscription skipped:`,
          error.message
        );
      }
    }

    // --------------------------------------------------------
    // Search by role ID
    // --------------------------------------------------------

    if (!subscriptionRow && roleId) {
      try {
        const result = await supabase
          .from(subscriptionTable)
          .select("*")
          .eq(roleIdColumn, roleId)
          .maybeSingle();

        if (result.error) {
          console.log(
            `${subscriptionTable} lookup by role ID skipped:`,
            result.error.message
          );
        } else {
          subscriptionRow = result.data;
        }
      } catch (error) {
        console.log(
          `${subscriptionTable} lookup by role ID exception:`,
          error.message
        );
      }
    }

    // --------------------------------------------------------
    // Search by email
    // --------------------------------------------------------

    if (!subscriptionRow && emailValue) {
      try {
        const result = await supabase
          .from(subscriptionTable)
          .select("*")
          .eq(roleEmailColumn, emailValue)
          .maybeSingle();

        if (result.error) {
          console.log(
            `${subscriptionTable} lookup by email skipped:`,
            result.error.message
          );
        } else {
          subscriptionRow = result.data;
        }
      } catch (error) {
        console.log(
          `${subscriptionTable} lookup by email exception:`,
          error.message
        );
      }
    }

    // --------------------------------------------------------
    // Fill missing Stripe IDs from subscription table
    // --------------------------------------------------------

    if (subscriptionRow) {
      if (!roleId) {
        roleId = clean(
          subscriptionRow[roleIdColumn] ||
            subscriptionRow.profile_id
        );
      }

      if (!emailValue) {
        emailValue = email(
          subscriptionRow[roleEmailColumn] ||
            subscriptionRow.email
        );
      }

      if (!isCus(stripeCustomerId)) {
        stripeCustomerId = clean(
          subscriptionRow.stripe_customer_id
                  );
      }

      if (!isSub(subscriptionId)) {
        subscriptionId = clean(
          subscriptionRow.stripe_subscription_id ||
            subscriptionRow.subscription_id
        );
      }
    }

    // --------------------------------------------------------
    // 8. If subscription ID still missing, find Stripe customer
    // --------------------------------------------------------

    let stripeCustomer = null;

    if (isCus(stripeCustomerId)) {
      try {
        const customer =
          await stripe.customers.retrieve(stripeCustomerId);

        if (customer && !customer.deleted) {
          stripeCustomer = customer;
        }
      } catch (error) {
        console.log(
          "Stripe customer retrieve skipped:",
          error.message
        );
      }
    }

    // --------------------------------------------------------
    // Search Stripe by email if needed
    // --------------------------------------------------------

    if (!stripeCustomer && emailValue) {
      try {
        stripeCustomer = await findCustomerSmart({
          emailValue,
          businessName:
            roleRow?.business_name ||
            roleRow?.company_name ||
            roleRow?.farm_name ||
            roleRow?.name ||
            "",
          username:
            roleRow?.username ||
            subscriptionRow?.username ||
            "",
          role,
          stripeCustomerId,
        });
      } catch (error) {
        console.log(
          "Stripe customer search skipped:",
          error.message
        );
      }
    }

    if (stripeCustomer?.id) {
      stripeCustomerId = stripeCustomer.id;

      if (!emailValue) {
        emailValue = email(stripeCustomer.email);
      }
    }

    // --------------------------------------------------------
    // 9. Search Stripe subscriptions when subscription ID
    // wasn't stored correctly in Supabase
    // --------------------------------------------------------

    if (!isSub(subscriptionId) && isCus(stripeCustomerId)) {
      try {
        const subscriptions =
          await listCustomerSubscriptions(stripeCustomerId);

        const selectedSubscription =
          bestSubscription(subscriptions);

        if (selectedSubscription?.id) {
          subscriptionId = selectedSubscription.id;
        }
      } catch (error) {
        console.log(
          "Stripe subscription search skipped:",
          error.message
        );
      }
    }

    // --------------------------------------------------------
    // 10. Cannot cancel without Stripe subscription
    // --------------------------------------------------------

    if (!isSub(subscriptionId)) {
      return res.status(404).json({
        success: false,
        error:
          `No Stripe membership subscription was found for this ${role} profile.`,
        role,
        userId: roleId || null,
        email: emailValue || null,
        stripeCustomerId:
          isCus(stripeCustomerId)
            ? stripeCustomerId
            : null,
      });
    }

    // --------------------------------------------------------
    // 11. Retrieve subscription directly from Stripe
    // --------------------------------------------------------

    let currentSubscription;

    try {
      currentSubscription =
        await stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      console.error(
        "Stripe subscription retrieve error:",
        error
      );

      if (error?.code === "resource_missing") {
        return res.status(404).json({
          success: false,
          error:
            "The Stripe subscription no longer exists.",
          role,
          stripeSubscriptionId: subscriptionId,
        });
      }

      throw error;
    }

    // --------------------------------------------------------
    // 12. Subscription already fully canceled
    // --------------------------------------------------------

    if (currentSubscription.status === "canceled") {
      const currentPeriodEnd = stripeDate(
        currentSubscription.current_period_end
      );

      const canceledPayload = {
        stripe_customer_id:
          typeof currentSubscription.customer === "string"
            ? currentSubscription.customer
            : currentSubscription.customer?.id ||
              stripeCustomerId ||
              null,

        stripe_subscription_id:
          currentSubscription.id,

        subscription_id:
          currentSubscription.id,

        subscription_status: "canceled",
        membership_status: "canceled",
        account_active: false,
        cancel_at_period_end: false,
        current_period_end: currentPeriodEnd,
        updated_at: nowIso(),
      };

      if (role === "customer") {
        canceledPayload.customer_membership_paid = false;
      }

      if (role === "farmer") {
        canceledPayload.farmer_membership_paid = false;
        canceledPayload.monthly_membership_started = false;
      }

      if (role === "freight") {
        canceledPayload.freight_membership_paid = false;
      }

      if (role === "driver") {
        canceledPayload.driver_membership_paid = false;
      }

      if (roleId || emailValue) {
        await updateMainRoleRow(
          role,
          roleId,
          emailValue,
          canceledPayload
        );

        await updateProfiles(
          role,
          roleId,
          emailValue,
          canceledPayload
        );

        await updateAdminVerifications(
          role,
          roleId,
          emailValue,
          canceledPayload
        );
      }

      return res.json({
        success: true,
        alreadyCanceled: true,
        role,
        userId: roleId || null,
        message: "Subscription is already canceled.",
        stripeCustomerId:
          canceledPayload.stripe_customer_id,
        stripeSubscriptionId:
          currentSubscription.id,
        subscriptionId:
          currentSubscription.id,
        subscriptionStatus: "canceled",
        membershipStatus: "canceled",
        cancelAtPeriodEnd: false,
        currentPeriodEnd,
        accessUntil: currentPeriodEnd,
      });
    }

    // --------------------------------------------------------
    // 13. Schedule cancellation at billing period end
    // --------------------------------------------------------

    let updatedSubscription;

    if (currentSubscription.cancel_at_period_end) {
      updatedSubscription = currentSubscription;
    } else {
      updatedSubscription =
        await stripe.subscriptions.update(
          subscriptionId,
          {
            cancel_at_period_end: true,
          }
        );
    }

    // --------------------------------------------------------
    // 14. Resolve Stripe values
    // --------------------------------------------------------

    const finalStripeCustomerId =
      typeof updatedSubscription.customer === "string"
        ? updatedSubscription.customer
        : updatedSubscription.customer?.id ||
          stripeCustomerId ||
          null;

    const currentPeriodEnd = stripeDate(
      updatedSubscription.current_period_end
    );

    // --------------------------------------------------------
    // IMPORTANT:
    //
    // Stripe remains active/trialing/past_due until period end.
    // Therefore membership access should remain enabled.
    // --------------------------------------------------------

    const stillActive = isActiveSubscription(
      updatedSubscription.status
    );

    const cancellationPayload = {
      stripe_customer_id: finalStripeCustomerId,

      stripe_subscription_id:
        updatedSubscription.id,

      subscription_id:
        updatedSubscription.id,

      subscription_status:
        updatedSubscription.status,

      membership_status: "canceling",

      account_active: stillActive,

      cancel_at_period_end: true,

      current_period_end: currentPeriodEnd,

      updated_at: nowIso(),
    };

    // --------------------------------------------------------
    // 15. Role-specific membership fields
    // --------------------------------------------------------

    if (role === "customer") {
      cancellationPayload.customer_membership_paid =
        stillActive;
    }

    if (role === "farmer") {
      cancellationPayload.farmer_membership_paid =
        stillActive;

      cancellationPayload.monthly_membership_started =
        stillActive;
    }

    if (role === "freight") {
      cancellationPayload.freight_membership_paid =
        stillActive;
    }

    if (role === "driver") {
      cancellationPayload.driver_membership_paid =
        stillActive;
    }

    // --------------------------------------------------------
    // 16. Update main role table
    // --------------------------------------------------------

    if (roleId || emailValue) {
      const mainUpdate = await updateMainRoleRow(
        role,
        roleId,
        emailValue,
        cancellationPayload
      );

      if (mainUpdate.error) {
        console.log(
          `${roleTable} cancellation sync skipped:`,
          mainUpdate.error.message
        );
      }
    }

    // --------------------------------------------------------
    // 17. Update subscription table
    // --------------------------------------------------------

    const subscriptionUpdatePayload = {
      stripe_customer_id: finalStripeCustomerId,

      stripe_subscription_id:
        updatedSubscription.id,

      subscription_status:
        updatedSubscription.status,

      current_period_end: currentPeriodEnd,

      cancel_at_period_end: true,

      updated_at: nowIso(),
    };

    const subscriptionFilters = [];

    if (roleId) {
      subscriptionFilters.push(
        `${roleIdColumn}.eq.${roleId}`
      );
    }

    if (emailValue) {
      subscriptionFilters.push(
        `${roleEmailColumn}.eq.${emailValue}`
      );
    }

    subscriptionFilters.push(
      `stripe_subscription_id.eq.${updatedSubscription.id}`
    );

    try {
      const subUpdate = await safeUpdate(
        subscriptionTable,
        subscriptionUpdatePayload,
        (query) =>
          query.or(subscriptionFilters.join(",")),
        subscriptionTable
      );

      if (subUpdate.error) {
        console.log(
          `${subscriptionTable} cancellation sync skipped:`,
          subUpdate.error.message
        );
      }
    } catch (error) {
      console.log(
        `${subscriptionTable} cancellation exception:`,
        error.message
      );
    }

    // --------------------------------------------------------
    // 18. Update profile table
    // --------------------------------------------------------

    try {
      await updateProfiles(
        role,
        roleId,
        emailValue,
        cancellationPayload
      );
    } catch (error) {
      console.log(
        "profiles cancellation sync skipped:",
        error.message
      );
    }

    // --------------------------------------------------------
    // 19. Update admin verification
    // --------------------------------------------------------

    try {
      await updateAdminVerifications(
        role,
        roleId,
        emailValue,
        cancellationPayload
      );
    } catch (error) {
      console.log(
        "admin_verifications cancellation sync skipped:",
        error.message
      );
    }

    // --------------------------------------------------------
    // 20. Success
    // --------------------------------------------------------

    return res.json({
      success: true,

      alreadyCanceled: false,

      role,

      userId: roleId || null,

      email: emailValue || null,

      message:
        "Subscription cancellation is scheduled for the end of the current billing period.",

      stripeCustomerId:
        finalStripeCustomerId,

      stripeSubscriptionId:
        updatedSubscription.id,

      subscriptionId:
        updatedSubscription.id,

      subscriptionStatus:
        updatedSubscription.status,

      membershipStatus: "canceling",

      cancelAtPeriodEnd:
        Boolean(
          updatedSubscription.cancel_at_period_end
        ),

      currentPeriodEnd,

      accessUntil: currentPeriodEnd,
    });
  } catch (error) {
    console.error(
      "cancel-subscription error:",
      error
    );

    if (error?.code === "resource_missing") {
      return res.status(404).json({
        success: false,
        error:
          "Stripe could not find the requested subscription.",
      });
    }

    return res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Unable to cancel subscription.",
    });
  }
});


// ============================================================
// ROLE-SPECIFIC CANCEL ROUTE ALIASES
//
// These all use the SAME cancellation implementation above.
// They make the backend compatible with profile screens that
// use role-specific endpoint names.
// ============================================================

async function forwardCancelSubscription(
  req,
  res,
  role
) {
  req.body = {
    ...(req.body || {}),
    role,
  };

  // Change the URL so Express routes this internally
  // through /cancel-subscription.
  req.url = "/cancel-subscription";

  return router.handle(req, res);
}


// ------------------------------------------------------------
// FARMER
// ------------------------------------------------------------

router.post(
  "/cancel-farmer-subscription",
  (req, res) => {
    return forwardCancelSubscription(
      req,
      res,
      "farmer"
    );
  }
);


// ------------------------------------------------------------
// CUSTOMER
// ------------------------------------------------------------

router.post(
  "/cancel-customer-subscription",
  (req, res) => {
    return forwardCancelSubscription(
      req,
      res,
      "customer"
    );
  }
);


// ------------------------------------------------------------
// FREIGHT
// ------------------------------------------------------------

router.post(
  "/cancel-freight-subscription",
  (req, res) => {
    return forwardCancelSubscription(
      req,
      res,
      "freight"
    );
  }
);


// ------------------------------------------------------------
// DRIVER
// ------------------------------------------------------------

router.post(
  "/cancel-driver-subscription",
  (req, res) => {
    return forwardCancelSubscription(
      req,
      res,
      "driver"
    );
  }
);


// ============================================================
// EXPORT ROUTER
//
// IMPORTANT:
// This MUST remain the final statement in payments.js.
// Do not put routes below this line.
// ============================================================

module.exports = router;