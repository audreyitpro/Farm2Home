// backend/routes/payments.js

const express = require("express");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

router.use((req, res, next) => {
  if (req.originalUrl.includes("/payments/webhook")) return next();
  return express.json({ limit: "5mb" })(req, res, next);
});

const APP_URL = process.env.APP_URL || "https://farm2home-rho.vercel.app";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;

function clean(v) {
  return String(v || "").trim();
}

function email(v) {
  return clean(v).toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function cents(v) {
  return Math.round(Number(v || 0) * 100);
}

function dollarsFromCents(v) {
  return Number((Number(v || 0) / 100).toFixed(2));
}

function isAcct(v) {
  return clean(v).startsWith("acct_");
}

function isCus(v) {
  return clean(v).startsWith("cus_");
}

function isSub(v) {
  return clean(v).startsWith("sub_");
}

function roleName(role) {
  return clean(role).toLowerCase();
}

function requireStripe(res) {
  if (!stripe) {
    res.status(500).json({ success: false, error: "STRIPE_SECRET_KEY missing." });
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

async function parseStripeSession(sessionId) {
  return await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent", "customer", "subscription"],
  });
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

function getRoleAccountColumn(role) {
  const r = roleName(role);
  if (r === "freight") return "freight_account";
  if (r === "driver") return "driver_account";
  if (r === "farmer") return "farmer_account";
  if (r === "customer") return "customer_account";
  return null;
}

function getRoleIdFromBody(body, role) {
  const r = roleName(role);

  if (r === "freight") {
    return clean(body.freightId || body.freight_id || body.userId || body.profileId || body.authUserId);
  }

  if (r === "driver") {
    return clean(body.driverId || body.driver_id || body.userId || body.profileId || body.authUserId);
  }

  if (r === "farmer") {
    return clean(body.farmerId || body.farmer_id || body.userId || body.profileId || body.authUserId);
  }

  if (r === "customer") {
    return clean(body.customerId || body.customer_id || body.userId || body.profileId || body.authUserId);
  }

  return clean(body.userId || body.profileId || body.authUserId);
}

function getRoleIdFromMetadata(metadata, role) {
  const r = roleName(role);

  if (r === "freight") {
    return clean(metadata.freightId || metadata.freight_id || metadata.userId || metadata.profileId || metadata.authUserId);
  }

  if (r === "driver") {
    return clean(metadata.driverId || metadata.driver_id || metadata.userId || metadata.profileId || metadata.authUserId);
  }

  if (r === "farmer") {
    return clean(metadata.farmerId || metadata.farmer_id || metadata.userId || metadata.profileId || metadata.authUserId);
  }

  if (r === "customer") {
    return clean(metadata.customerId || metadata.customer_id || metadata.userId || metadata.profileId || metadata.authUserId);
  }

  return clean(metadata.userId || metadata.profileId || metadata.authUserId);
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

  if (r === "freight") return process.env.STRIPE_FREIGHT_MEMBERSHIP_PRICE_ID;

  if (r === "driver") {
    return process.env.STRIPE_DRIVER_MEMBERSHIP_PRICE_ID || process.env.STRIPE_DRIVER_BOARD_PRICE_ID;
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
  const r = roleName(role);
  const p = roleName(planType);
  if (r === "farmer" && p.includes("application")) return "payment";
  return "subscription";
}

function isActiveSub(status) {
  return ["active", "trialing", "past_due"].includes(roleName(status));
}

function stripeDate(seconds) {
  if (!seconds) return null;
  return new Date(Number(seconds) * 1000).toISOString();
}

async function updateMainRoleRow(role, idValue, emailValue, payload) {
  const table = getRoleTable(role);
  if (!table) return { data: null, error: new Error("Invalid role table.") };

  let query = supabase.from(table).update(payload);

  if (idValue) query = query.or(getIdFilter(role, idValue));
  else if (emailValue) query = query.eq("email", emailValue);
  else return { data: null, error: new Error("Missing id or email.") };

  return await query.select();
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
  if (payload.stripe_checkout_session_id) safeProfilePayload.stripe_checkout_session_id = payload.stripe_checkout_session_id;

  try {
    if (idValue) {
      await supabase
        .from("profiles")
        .update(safeProfilePayload)
        .or(`id.eq.${idValue},auth_user_id.eq.${idValue}`);
    } else if (emailValue) {
      await supabase.from("profiles").update(safeProfilePayload).eq("email", emailValue);
    }
  } catch (error) {
    console.log("profiles update skipped:", error.message);
  }
}

async function updateAdminVerifications(role, idValue, emailValue, payload) {
  try {
    if (idValue) {
      await supabase
        .from("admin_verifications")
        .update(payload)
        .or(
          `id.eq.${idValue},profile_id.eq.${idValue},freight_id.eq.${idValue},driver_id.eq.${idValue},farmer_id.eq.${idValue},customer_id.eq.${idValue},carrier_id.eq.${idValue}`
        );
    } else if (emailValue) {
      await supabase.from("admin_verifications").update(payload).eq("email", emailValue);
    }
  } catch (error) {
    console.log("admin_verifications update skipped:", error.message);
  }
}

async function updateSubscriptionRoleAccount(role, idValue, emailValue, customerId, accountId) {
  const table = getSubscriptionTable(role);
  const idColumn = getRoleIdColumn(role);
  const accountColumn = getRoleAccountColumn(role);

  if (!table || !accountColumn || !isAcct(accountId)) return;

  const payload = {
    [accountColumn]: accountId,
    updated_at: nowIso(),
  };

  const filters = [];

  if (idValue) filters.push(`${idColumn}.eq.${idValue}`);

  if (emailValue) {
    if (roleName(role) === "freight") filters.push(`freight_email.eq.${emailValue}`);
    else if (roleName(role) === "customer") filters.push(`customer_email.eq.${emailValue}`);
    else filters.push(`email.eq.${emailValue}`);
  }

  if (customerId) filters.push(`stripe_customer_id.eq.${customerId}`);

  if (!filters.length) return;

  const { error } = await supabase.from(table).update(payload).or(filters.join(","));

  if (error) console.log(`${table} ${accountColumn} update skipped:`, error.message);
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
  const accountColumn = getRoleAccountColumn(role);

  if (!table || !idColumn || !isCus(stripeCustomerId) || !isSub(stripeSubscriptionId)) {
    return null;
  }

  const now = nowIso();

  const payload = {
    [idColumn]: roleId,
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

  if (roleName(role) === "freight") payload.freight_email = email(roleEmail);
  else if (roleName(role) === "customer") payload.customer_email = email(roleEmail);
  else payload.email = email(roleEmail);

  if (accountColumn && isAcct(roleAccount) && roleName(role) !== "customer") {
    payload[accountColumn] = roleAccount;
  }

  const { data: bySub, error: bySubError } = await supabase
    .from(table)
    .select("id")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();

  if (bySubError) throw bySubError;

  if (bySub?.id) {
    const { data, error } = await supabase
      .from(table)
      .update(payload)
      .eq("id", bySub.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data: byRole, error: byRoleError } = await supabase
    .from(table)
    .select("id")
    .eq(idColumn, roleId)
    .maybeSingle();

  if (byRoleError) throw byRoleError;

  if (byRole?.id) {
    const { data, error } = await supabase
      .from(table)
      .update(payload)
      .eq("id", byRole.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from(table)
    .insert([{ ...payload, created_at: now }])
    .select()
    .single();

  if (error) throw error;
  return data;
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
    let q = supabase.from(subTable).select(accountColumn);

    if (roleName(role) === "freight") q = q.eq("freight_email", emailValue);
    else q = q.eq("email", emailValue);

    const { data } = await q.maybeSingle();

    if (isAcct(data?.[accountColumn])) return data[accountColumn];
  }

  return "";
}

async function findCustomerByEmail(emailValue) {
  const finalEmail = email(emailValue);
  if (!finalEmail) return null;

  const listed = await stripe.customers.list({ email: finalEmail, limit: 1 });
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

async function findCustomerSmart({ emailValue, businessName, username, role, stripeCustomerId }) {
  if (isCus(stripeCustomerId)) {
    try {
      const customer = await stripe.customers.retrieve(stripeCustomerId);
      if (customer?.id && !customer.deleted) return customer;
    } catch {}
  }

  const byEmail = await findCustomerByEmail(emailValue);
  if (byEmail?.id) return byEmail;

  try {
    const list = await stripe.customers.list({ limit: 100 });
    const b = clean(businessName).toLowerCase();
    const u = clean(username).toLowerCase();
    const r = roleName(role);

    return (
      list.data.find((c) => {
        const md = c.metadata || {};
        const name = clean(c.name).toLowerCase();
        const mdBusiness = clean(md.business_name || md.company_name).toLowerCase();
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

async function listCustomerSubscriptions(customerId) {
  if (!isCus(customerId)) return [];

  const listed = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  });

  return listed?.data || [];
}

function bestSubscription(subs) {
  return (
    subs.find((s) => ["active", "trialing"].includes(s.status)) ||
    subs.find((s) => s.status === "past_due") ||
    subs.find((s) => ["unpaid", "incomplete"].includes(s.status)) ||
    subs[0] ||
    null
  );
}

async function getOrCreateCustomer({ finalEmail, finalName, metadata }) {
  const existing = await findCustomerSmart({
    emailValue: finalEmail,
    businessName: finalName,
    username: metadata.username,
    role: metadata.role,
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

function subscriptionPayload(role, customerId, subscription) {
  const status = subscription?.status || "active";
  const active = isActiveSub(status);

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

async function syncSubscriptionToSupabase({ role, roleId, emailValue, customer, subscription }) {
  const customerId = typeof customer === "string" ? customer : customer?.id;

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
    username: subscription?.metadata?.username || customer?.metadata?.username || "",
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    roleAccount,
    subscriptionStatus: subscription.status,
    currentPeriodEnd: subscription.current_period_end,
  });

  return { payload, updatedRows: data };
}

async function updateFromCheckoutSession(session) {
  const metadata = session.metadata || {};
  const role = roleName(metadata.role);

  if (!getRoleTable(role)) return;

  const roleId = getRoleIdFromMetadata(metadata, role);
  const emailValue = email(metadata.email || session.customer_details?.email || session.customer_email || "");

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id || "";

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
    name: metadata.name || metadata.business_name || metadata.company_name || customer?.name || "",
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
    const finalEmail = email(body.customerEmail || body.email || body.freight_email);
    const accountId = clean(body.accountId || body.account_id);
    const finalName = clean(
      body.companyName || body.businessName || body.fullName || body.name || `${role} User`
    );
    const username = clean(body.username);

    if (!role) return res.status(400).json({ success: false, error: "role is required." });
    if (!roleId) return res.status(400).json({ success: false, error: "userId/profile ID is required." });
    if (!finalEmail) return res.status(400).json({ success: false, error: "email is required." });

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
      profileId: roleId,
      authUserId: roleId,
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
    }

    if (role === "customer") {
      metadata.customerId = roleId;
      metadata.customer_id = roleId;
    }

    const existingCustomer = await findCustomerSmart({
      emailValue: finalEmail,
      businessName: finalName,
      username,
      role,
    });

    if (existingCustomer?.id && mode === "subscription") {
      const subs = await listCustomerSubscriptions(existingCustomer.id);
      const existingSub = bestSubscription(subs);

      if (existingSub?.id && isActiveSub(existingSub.status)) {
        await syncSubscriptionToSupabase({
          role,
          roleId,
          emailValue: finalEmail,
          customer: existingCustomer,
          subscription: existingSub,
        });

        return res.json({
          success: true,
          alreadySubscribed: true,
          message: "Existing active subscription found. No new payment opened.",
          stripeCustomerId: existingCustomer.id,
          stripeSubscriptionId: existingSub.id,
          subscriptionStatus: existingSub.status,
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

    const sessionPayload = {
      mode,
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url:
        body.successUrl ||
        body.success_url ||
        `${APP_URL}/${role}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:
        body.cancelUrl ||
        body.cancel_url ||
        `${APP_URL}/${role}/register?checkout_canceled=true`,
      metadata,
    };

    if (mode === "subscription") sessionPayload.subscription_data = { metadata };

    const session = await stripe.checkout.sessions.create(sessionPayload);

    const pendingPayload = {
      stripe_customer_id: customerId,
      stripe_checkout_session_id: session.id,
      membership_status: mode === "payment" ? "pending_application_fee" : "pending_payment",
      subscription_status: mode === "payment" ? "not_started" : "pending_payment",
      updated_at: nowIso(),
    };

    if (mode === "payment") pendingPayload.application_fee_status = "pending_payment";

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
      name: clean(item.name || item.productName || item.product_name || "Farm Product"),
      price,
      quantity,
      lineTotal: Number((price * quantity).toFixed(2)),
      farmerId: clean(item.farmerId || item.farmer_id),
      farmer_id: clean(item.farmerId || item.farmer_id),
      farmName: clean(item.farmName || item.farm_name || item.farmerName || "Farm2Home Farm"),
      farm_name: clean(item.farmName || item.farm_name || item.farmerName || "Farm2Home Farm"),
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
    const stripeAccountId = clean(item.farmerStripeAccountId || item.stripe_account_id);
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
    group.subtotal += Number(item.lineTotal || 0);
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
      const { error } = await supabase.from(table).upsert(payload, { onConflict: "id" });
      if (!error) return table;
      console.log(`${table} marketplace order save skipped:`, error.message);
    } catch (error) {
      console.log(`${table} marketplace order save exception:`, error.message);
    }
  }

  return null;
}

async function saveMarketplaceOrderItems(order) {
  const rows = order.items.map((item) => ({
    id: `${order.orderId}_${clean(item.productId || item.id)}`,
    order_id: order.orderId,
    customer_id: order.customerId,
    farmer_id: item.farmerId || item.farmer_id,
    farm_name: item.farmName || item.farm_name,
    product_id: item.productId || item.product_id || item.id,
    product_name: item.name,
    quantity: item.quantity,
    price: item.price,
    line_total: item.lineTotal,
    farmer_stripe_account_id: item.farmerStripeAccountId || item.farmer_stripe_account_id || null,
    stripe_account_id: item.stripeAccountId || item.stripe_account_id || null,
    status: order.status,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
  }));

  const tables = ["order_items", "customer_order_items", "farm_order_items"];

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
      if (!error) return table;
      console.log(`${table} marketplace item save skipped:`, error.message);
    } catch (error) {
      console.log(`${table} marketplace item save exception:`, error.message);
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
    platform_fee: Number((split.subtotal * 0.04).toFixed(2)),
    transfer_status: isAcct(split.stripeAccountId) ? "pending_payment" : "missing_connect_account",
    stripe_payment_intent_id: paymentIntentId,
    stripe_transfer_id: null,
    created_at: order.createdAt,
    updated_at: nowIso(),
  }));

  const tables = ["marketplace_transfers", "farmer_payouts", "payout_splits"];

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
      if (!error) return table;
      console.log(`${table} save skipped:`, error.message);
    } catch (error) {
      console.log(`${table} save exception:`, error.message);
    }
  }

  return null;
}

async function createStripeTransfersForMarketplaceOrder(order, paymentIntentId) {
  if (!paymentIntentId) return [];

  const transfers = [];

  for (const split of order.payoutSplits) {
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
    const platformFeeCents = Math.round(grossCents * SERVICE_FEE_RATE);
    const transferAmountCents = Math.max(grossCents - platformFeeCents, 0);

    if (transferAmountCents <= 0) continue;

    try {
      const transfer = await stripe.transfers.create({
        amount: transferAmountCents,
        currency: "usd",
        destination,
        source_transaction: undefined,
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
    const { data } = await supabase.from(table).select("*").eq("id", orderId).maybeSingle();
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

  const transfers = await createStripeTransfersForMarketplaceOrder(order, paymentIntentId);

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
      await supabase.from(table).update(paidPayload).eq("id", orderId);
    } catch {}
  }

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

const SERVICE_FEE_RATE = 0.04;

router.post("/create-marketplace-checkout", async (req, res) => {
  try {
    if (!requireStripe(res)) return;
    if (!requireSupabase(res)) return;

    const body = req.body || {};

    const orderId = clean(body.orderId || body.order_id || body.cloudOrderId) || `order_${Date.now()}`;
    const customerId = clean(body.customerId || body.customer_id || body.userId);
    const customerEmail = email(body.customerEmail || body.customer_email || body.email);
    const customerName = clean(body.customerName || body.customer_name || body.name || "Farm2Home Customer");
    const stripeCustomerId = clean(body.stripeCustomerId || body.stripe_customer_id);

    const items = normalizeMarketplaceItems(body);

    if (!customerId) return res.status(400).json({ success: false, error: "customerId is required." });
    if (!customerEmail) return res.status(400).json({ success: false, error: "customerEmail is required." });
    if (!items.length) return res.status(400).json({ success: false, error: "Cart items are required." });

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
      Number(items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0).toFixed(2));

    const serviceFee = Number(body.serviceFee || body.service_fee || body.platformFee || body.platform_fee || (subtotal * SERVICE_FEE_RATE));
    const deliveryFee = Number(body.deliveryFee || body.delivery_fee || 0);
    const freightHandlingFee = Number(body.freightHandlingFee || body.freight_handling_fee || 0);
    const tip = Number(body.tip || 0);
    const total = Number(body.total || (subtotal + serviceFee + deliveryFee + freightHandlingFee + tip));

    const deliveryOption = clean(body.deliveryOption || body.delivery_option || body.deliveryInfo?.deliveryOption || "Delivery");
    const deliveryInfo = body.deliveryInfo || body.delivery_info || {};

    const successUrl =
      body.successUrl ||
      body.success_url ||
      `${APP_URL}/customer/order-success?orderId=${encodeURIComponent(orderId)}&session_id={CHECKOUT_SESSION_ID}`;

    const cancelUrl = body.cancelUrl || body.cancel_url || `${APP_URL}/customer/cart`;

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
      deliveryAddress: clean(body.deliveryAddress || body.delivery_address || deliveryInfo.deliveryAddress),
      city: clean(body.city || deliveryInfo.city),
      state: clean(body.state || deliveryInfo.state),
      zipCode: clean(body.zipCode || body.zip_code || deliveryInfo.zipCode),
      phone: clean(body.phone || deliveryInfo.phone),
      deliveryInstructions: clean(body.deliveryInstructions || body.delivery_instructions || deliveryInfo.deliveryInstructions),
      items,
      payoutSplits,
      status: "PENDING_PAYMENT",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    await saveMarketplaceOrder(order);
    await saveMarketplaceOrderItems(order);
    await saveMarketplaceTransfers(order);

    const lineItems = [
      ...items.map((item) => ({
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
      })),
    ];

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
      payment_intent_data: {
        metadata,
      },
    });

    const updatedOrder = {
      ...order,
      stripeCheckoutSessionId: session.id,
      stripe_checkout_session_id: session.id,
    };

    await saveMarketplaceOrder(updatedOrder);

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
      message: "Marketplace checkout created with multi-farmer payout split preserved.",
    });
  } catch (error) {
    console.error("create-marketplace-checkout error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to create marketplace checkout.",
    });
  }
});

router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Payments route running",
    appUrl: APP_URL,
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    webhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    supabaseConfigured: Boolean(supabase),
    freightPriceConfigured: Boolean(process.env.STRIPE_FREIGHT_MEMBERSHIP_PRICE_ID),
    driverPriceConfigured: Boolean(process.env.STRIPE_DRIVER_MEMBERSHIP_PRICE_ID || process.env.STRIPE_DRIVER_BOARD_PRICE_ID),
    farmerMembershipPriceConfigured: Boolean(
      process.env.STRIPE_FARMER_MEMBERSHIP_PRICE_ID ||
        process.env.STRIPE_FARMER_MONTHLY_SUBSCRIPTION_PRICE_ID ||
        process.env.STRIPE_FARMER_SUBSCRIPTION_PRICE_ID
    ),
    farmerApplicationPriceConfigured: Boolean(process.env.STRIPE_FARMER_APPLICATION_FEE_PRICE_ID),
    customerPriceConfigured: Boolean(process.env.STRIPE_CUSTOMER_MEMBERSHIP_PRICE_ID),
    marketplaceCheckoutConfigured: true,
  });
});

router.post("/create-subscription-checkout", createSubscriptionCheckout);

router.post("/create-freight-subscription-checkout", (req, res) => {
  req.body = { ...(req.body || {}), role: "freight", planType: "freight" };
  return createSubscriptionCheckout(req, res);
});

router.post("/create-driver-subscription-checkout", (req, res) => {
  req.body = { ...(req.body || {}), role: "driver", planType: "driver" };
  return createSubscriptionCheckout(req, res);
});

router.post("/create-farmer-membership-checkout", (req, res) => {
  req.body = { ...(req.body || {}), role: "farmer", planType: "farmer_membership" };
  return createSubscriptionCheckout(req, res);
});

router.post("/create-farmer-application-checkout", (req, res) => {
  req.body = { ...(req.body || {}), role: "farmer", planType: "farmer_application" };
  return createSubscriptionCheckout(req, res);
});

router.post("/create-customer-subscription-checkout", (req, res) => {
  req.body = { ...(req.body || {}), role: "customer", planType: "customer" };
  return createSubscriptionCheckout(req, res);
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
    const requestedEmail = email(body.email || body.customerEmail || body.freight_email);
    const requestedBusinessName = clean(body.companyName || body.businessName || body.name || "Farm2Home Carrier");
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
      const result = await supabase.from(table).select("*").eq("email", requestedEmail).maybeSingle();
      if (result.error) throw result.error;
      row = result.data;
    }

    if (!row && requestedAccountId) {
      const result = await supabase.from(table).select("*").eq("account_id", requestedAccountId).maybeSingle();
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
      requestedBusinessName || row.company_name || row.business_name || row.name || "Farm2Home Carrier"
    );

    const customerId = clean(row.stripe_customer_id);

    let existingAcct = clean(row[accountColumn]);

    if (!isAcct(existingAcct) && isAcct(requestedAcct)) existingAcct = requestedAcct;
    if (!isAcct(existingAcct)) existingAcct = await getSavedRoleAccount(role, finalId, finalEmail);

    const metadata = {
      role,
      userId: finalId,
      profileId: finalId,
      authUserId: finalId,
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
    const businessName = clean(req.body?.businessName || req.body?.companyName || req.body?.name);
    const username = clean(req.body?.username);
    const customerId = clean(req.body?.stripeCustomerId || req.body?.stripe_customer_id);

    const customer = await findCustomerSmart({
      emailValue,
      businessName,
      username,
      role,
      stripeCustomerId: customerId,
    });

    if (!customer?.id) {
      return res.status(404).json({ success: false, error: "No Stripe customer found." });
    }

    const subs = await listCustomerSubscriptions(customer.id);
    const sub = bestSubscription(subs);

    if (!sub?.id) {
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
      subscription: sub,
    });

    return res.json({
      success: true,
      message: "Subscription synced.",
      stripeCustomerId: customer.id,
      stripeSubscriptionId: sub.id,
      subscriptionStatus: sub.status,
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
  req.body = { ...(req.body || {}), role: "freight" };
  return router.handle(req, res);
});

router.post("/sync-stripe-by-email", async (req, res) => {
  try {
    if (!requireStripe(res)) return;
    if (!requireSupabase(res)) return;

    const role = roleName(req.body?.role || "freight");
    const roleId = getRoleIdFromBody(req.body || {}, role);
    const emailValue = email(req.body?.email);
    const businessName = clean(req.body?.businessName || req.body?.companyName || req.body?.name);
    const username = clean(req.body?.username);
    const customerId = clean(req.body?.stripeCustomerId || req.body?.stripe_customer_id);

    const customer = await findCustomerSmart({
      emailValue,
      businessName,
      username,
      role,
      stripeCustomerId: customerId,
    });

    if (!customer?.id) {
      return res.status(404).json({ success: false, error: "No Stripe customer found." });
    }

    const subs = await listCustomerSubscriptions(customer.id);
    const sub = bestSubscription(subs);
    const resolvedEmail = email(customer.email || emailValue);

    const payload = {
      stripe_customer_id: customer.id,
      updated_at: nowIso(),
    };

    if (sub?.id) Object.assign(payload, subscriptionPayload(role, customer.id, sub));

    const { data, error } = await updateMainRoleRow(role, roleId, resolvedEmail, payload);
    if (error) throw error;

    await updateProfiles(role, roleId, resolvedEmail, payload);
    await updateAdminVerifications(role, roleId, resolvedEmail, payload);

    if (sub?.id) {
      const resolvedRoleId = roleId || data?.[0]?.id;
      const roleAccount = await getSavedRoleAccount(role, resolvedRoleId, resolvedEmail);

      await upsertSubscriptionRow({
        role,
        roleId: resolvedRoleId,
        roleEmail: resolvedEmail,
        name: customer.name || businessName || "",
        username: username || customer.metadata?.username || "",
        stripeCustomerId: customer.id,
        stripeSubscriptionId: sub.id,
        roleAccount,
        subscriptionStatus: sub.status,
        currentPeriodEnd: sub.current_period_end,
      });
    }

    return res.json({
      success: true,
      role,
      email: resolvedEmail,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: sub?.id || null,
      subscriptionStatus: sub?.status || null,
      subscriptionActive: sub ? isActiveSub(sub.status) : false,
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
      case "customer.subscription.deleted":
        await updateFromSubscription(event.data.object);
        break;

      case "account.updated":
        await updateConnectAccount(event.data.object);
        break;

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