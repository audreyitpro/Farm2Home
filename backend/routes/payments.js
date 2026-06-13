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

function clean(value) {
  return String(value || "").trim();
}

function cleanEmail(value) {
  return clean(value).toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function getPeriodEnd(subscription) {
  if (!subscription?.current_period_end) return null;
  return new Date(subscription.current_period_end * 1000).toISOString();
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
    res.status(500).json({ success: false, error: "Supabase service role missing." });
    return false;
  }
  return true;
}

async function getOrCreateCustomer({ finalEmail, finalName, metadata }) {
  const existingCustomers = await stripe.customers.list({
    email: finalEmail,
    limit: 1,
  });

  if (existingCustomers?.data?.[0]?.id) {
    return existingCustomers.data[0].id;
  }

  const customer = await stripe.customers.create({
    email: finalEmail,
    name: finalName,
    metadata,
  });

  return customer.id;
}

async function safeUpdateByIdOrEmail(table, idColumns, idValue, finalEmail, payload) {
  if (!supabase) return { data: null, error: null };

  let query = supabase.from(table).update(payload);

  if (idValue) {
    const filters = idColumns.map((col) => `${col}.eq.${idValue}`).join(",");
    query = query.or(filters);
  } else if (finalEmail) {
    query = query.eq("email", finalEmail);
  } else {
    return { data: null, error: new Error(`No ID or email for ${table} update.`) };
  }

  return await query.select();
}

router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Payments route running",
    appUrl: APP_URL,
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
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

/* =========================
   FREIGHT SUBSCRIPTION
========================= */

router.post("/create-freight-subscription-checkout", async (req, res) => {
  try {
    if (!requireStripe(res)) return;
    if (!requireSupabase(res)) return;

    const {
      freightId,
      userId,
      profileId,
      email,
      customerEmail,
      companyName,
      businessName,
      name,
      username,
    } = req.body || {};

    const finalFreightId = clean(freightId || userId || profileId);
    const finalEmail = cleanEmail(customerEmail || email);
    const finalName = clean(companyName || businessName || name || "Farm2Home Freight Carrier");

    if (!finalFreightId) return res.status(400).json({ success: false, error: "freightId is required." });
    if (!finalEmail) return res.status(400).json({ success: false, error: "email is required." });

    const priceId = process.env.STRIPE_FREIGHT_MEMBERSHIP_PRICE_ID;

    if (!priceId) {
      return res.status(500).json({
        success: false,
        error: "STRIPE_FREIGHT_MEMBERSHIP_PRICE_ID missing in Railway.",
      });
    }

    const metadata = {
      role: "freight",
      paymentType: "freight_subscription",
      planType: "freight",
      freight_id: finalFreightId,
      freightId: finalFreightId,
      userId: finalFreightId,
      email: finalEmail,
      username: clean(username),
      name: finalName,
      companyName: finalName,
    };

    const stripeCustomerId = await getOrCreateCustomer({
      finalEmail,
      finalName,
      metadata,
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_URL}/freight/subscription-success?session_id={CHECKOUT_SESSION_ID}&freightId=${finalFreightId}`,
      cancel_url: `${APP_URL}/freight/register?checkout_canceled=true&freightId=${finalFreightId}`,
      metadata,
      subscription_data: { metadata },
    });

    await supabase
      .from("freight_users")
      .update({
        freight_id: finalFreightId,
        stripe_id: stripeCustomerId,
        stripe_customer_id: stripeCustomerId,
        stripe_checkout_session_id: session.id,
        membership_status: "pending_payment",
        subscription_status: "pending_payment",
        freight_membership_paid: false,
        updated_at: nowIso(),
      })
      .or(`id.eq.${finalFreightId},freight_id.eq.${finalFreightId},email.eq.${finalEmail}`);

    return res.json({
      success: true,
      url: session.url,
      sessionId: session.id,
      stripeCustomerId,
      freightId: finalFreightId,
    });
  } catch (error) {
    console.error("create-freight-subscription-checkout error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Unable to create freight subscription checkout.",
    });
  }
});

/* =========================
   DRIVER SUBSCRIPTION
========================= */

router.post("/create-driver-subscription-checkout", async (req, res) => {
  try {
    if (!requireStripe(res)) return;
    if (!requireSupabase(res)) return;

    const {
      driverId,
      userId,
      profileId,
      email,
      customerEmail,
      name,
      fullName,
      username,
    } = req.body || {};

    const finalDriverId = clean(driverId || userId || profileId);
    const finalEmail = cleanEmail(customerEmail || email);
    const finalName = clean(fullName || name || "Farm2Home Driver");

    if (!finalDriverId) return res.status(400).json({ success: false, error: "driverId is required." });
    if (!finalEmail) return res.status(400).json({ success: false, error: "email is required." });

    const priceId =
      process.env.STRIPE_DRIVER_MEMBERSHIP_PRICE_ID ||
      process.env.STRIPE_DRIVER_BOARD_PRICE_ID;

    if (!priceId) {
      return res.status(500).json({
        success: false,
        error: "STRIPE_DRIVER_MEMBERSHIP_PRICE_ID or STRIPE_DRIVER_BOARD_PRICE_ID missing in Railway.",
      });
    }

    const metadata = {
      role: "driver",
      paymentType: "driver_subscription",
      planType: "driver",
      driver_id: finalDriverId,
      driverId: finalDriverId,
      userId: finalDriverId,
      email: finalEmail,
      username: clean(username),
      name: finalName,
    };

    const stripeCustomerId = await getOrCreateCustomer({
      finalEmail,
      finalName,
      metadata,
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_URL}/driver/subscription-success?session_id={CHECKOUT_SESSION_ID}&driverId=${finalDriverId}`,
      cancel_url: `${APP_URL}/driver/register?checkout_canceled=true&driverId=${finalDriverId}`,
      metadata,
      subscription_data: { metadata },
    });

    await supabase
      .from("drivers")
      .update({
        stripe_customer_id: stripeCustomerId,
        membership_status: "pending_payment",
        subscription_status: "pending_payment",
        account_active: true,
        updated_at: nowIso(),
      })
      .or(`id.eq.${finalDriverId},profile_id.eq.${finalDriverId},email.eq.${finalEmail}`);

    return res.json({
      success: true,
      url: session.url,
      sessionId: session.id,
      stripeCustomerId,
      driverId: finalDriverId,
    });
  } catch (error) {
    console.error("create-driver-subscription-checkout error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Unable to create driver subscription checkout.",
    });
  }
});

/* =========================
   FARMER MEMBERSHIP
========================= */

router.post("/create-farmer-membership-checkout", async (req, res) => {
  try {
    if (!requireStripe(res)) return;
    if (!requireSupabase(res)) return;

    const {
      farmerId,
      userId,
      profileId,
      email,
      customerEmail,
      name,
      fullName,
      username,
    } = req.body || {};

    const finalFarmerId = clean(farmerId || userId || profileId);
    const finalEmail = cleanEmail(customerEmail || email);
    const finalName = clean(fullName || name || "Farm2Home Farmer");

    if (!finalFarmerId) return res.status(400).json({ success: false, error: "farmerId is required." });
    if (!finalEmail) return res.status(400).json({ success: false, error: "email is required." });

    const priceId =
      process.env.STRIPE_FARMER_MEMBERSHIP_PRICE_ID ||
      process.env.STRIPE_FARMER_MONTHLY_SUBSCRIPTION_PRICE_ID ||
      process.env.STRIPE_FARMER_SUBSCRIPTION_PRICE_ID;

    if (!priceId) {
      return res.status(500).json({
        success: false,
        error: "Farmer membership Stripe price ID missing in Railway.",
      });
    }

    const metadata = {
      role: "farmer",
      paymentType: "farmer_membership",
      planType: "farmer_membership",
      farmer_id: finalFarmerId,
      farmerId: finalFarmerId,
      userId: finalFarmerId,
      email: finalEmail,
      username: clean(username),
      name: finalName,
    };

    const stripeCustomerId = await getOrCreateCustomer({
      finalEmail,
      finalName,
      metadata,
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_URL}/farmer/subscription-success?session_id={CHECKOUT_SESSION_ID}&farmerId=${finalFarmerId}`,
      cancel_url: `${APP_URL}/farmer/register?checkout_canceled=true&farmerId=${finalFarmerId}`,
      metadata,
      subscription_data: { metadata },
    });

    await supabase
      .from("farmers")
      .update({
        stripe_customer_id: stripeCustomerId,
        membership_status: "pending_payment",
        subscription_status: "pending_payment",
        updated_at: nowIso(),
      })
      .or(`id.eq.${finalFarmerId},profile_id.eq.${finalFarmerId},email.eq.${finalEmail}`);

    return res.json({
      success: true,
      url: session.url,
      sessionId: session.id,
      stripeCustomerId,
      farmerId: finalFarmerId,
    });
  } catch (error) {
    console.error("create-farmer-membership-checkout error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Unable to create farmer membership checkout.",
    });
  }
});

/* =========================
   FARMER APPLICATION FEE
========================= */

router.post("/create-farmer-application-checkout", async (req, res) => {
  try {
    if (!requireStripe(res)) return;
    if (!requireSupabase(res)) return;

    const {
      farmerId,
      userId,
      profileId,
      email,
      customerEmail,
      name,
      fullName,
      username,
    } = req.body || {};

    const finalFarmerId = clean(farmerId || userId || profileId);
    const finalEmail = cleanEmail(customerEmail || email);
    const finalName = clean(fullName || name || "Farm2Home Farmer");

    if (!finalFarmerId) return res.status(400).json({ success: false, error: "farmerId is required." });
    if (!finalEmail) return res.status(400).json({ success: false, error: "email is required." });

    const priceId = process.env.STRIPE_FARMER_APPLICATION_FEE_PRICE_ID;

    if (!priceId) {
      return res.status(500).json({
        success: false,
        error: "STRIPE_FARMER_APPLICATION_FEE_PRICE_ID missing in Railway.",
      });
    }

    const metadata = {
      role: "farmer",
      paymentType: "farmer_application_fee",
      planType: "farmer_application",
      farmer_id: finalFarmerId,
      farmerId: finalFarmerId,
      userId: finalFarmerId,
      email: finalEmail,
      username: clean(username),
      name: finalName,
    };

    const stripeCustomerId = await getOrCreateCustomer({
      finalEmail,
      finalName,
      metadata,
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_URL}/farmer/compliance-upload?session_id={CHECKOUT_SESSION_ID}&farmerId=${finalFarmerId}`,
      cancel_url: `${APP_URL}/farmer/register?checkout_canceled=true&farmerId=${finalFarmerId}`,
      metadata,
    });

    await supabase
      .from("farmers")
      .update({
        stripe_customer_id: stripeCustomerId,
        application_fee_status: "pending_payment",
        updated_at: nowIso(),
      })
      .or(`id.eq.${finalFarmerId},profile_id.eq.${finalFarmerId},email.eq.${finalEmail}`);

    return res.json({
      success: true,
      url: session.url,
      sessionId: session.id,
      stripeCustomerId,
      farmerId: finalFarmerId,
    });
  } catch (error) {
    console.error("create-farmer-application-checkout error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Unable to create farmer application checkout.",
    });
  }
});

/* =========================
   CUSTOMER SUBSCRIPTION
========================= */

router.post("/create-customer-subscription-checkout", async (req, res) => {
  try {
    if (!requireStripe(res)) return;
    if (!requireSupabase(res)) return;

    const {
      customerId,
      userId,
      profileId,
      email,
      customerEmail,
      name,
      fullName,
      username,
    } = req.body || {};

    const finalCustomerId = clean(customerId || userId || profileId);
    const finalEmail = cleanEmail(customerEmail || email);
    const finalName = clean(fullName || name || "Farm2Home Customer");

    if (!finalCustomerId) return res.status(400).json({ success: false, error: "customerId is required." });
    if (!finalEmail) return res.status(400).json({ success: false, error: "email is required." });

    const priceId = process.env.STRIPE_CUSTOMER_MEMBERSHIP_PRICE_ID;

    if (!priceId) {
      return res.status(500).json({
        success: false,
        error: "STRIPE_CUSTOMER_MEMBERSHIP_PRICE_ID missing in Railway.",
      });
    }

    const metadata = {
      role: "customer",
      paymentType: "customer_subscription",
      planType: "customer",
      customer_id: finalCustomerId,
      customerId: finalCustomerId,
      userId: finalCustomerId,
      email: finalEmail,
      username: clean(username),
      name: finalName,
    };

    const stripeCustomerId = await getOrCreateCustomer({
      finalEmail,
      finalName,
      metadata,
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_URL}/customer/subscription-success?session_id={CHECKOUT_SESSION_ID}&customerId=${finalCustomerId}`,
      cancel_url: `${APP_URL}/customer/register?checkout_canceled=true&customerId=${finalCustomerId}`,
      metadata,
      subscription_data: { metadata },
    });

    await supabase
      .from("customers")
      .update({
        stripe_customer_id: stripeCustomerId,
        membership_status: "pending_payment",
        subscription_status: "pending_payment",
        account_active: true,
        updated_at: nowIso(),
      })
      .or(`id.eq.${finalCustomerId},profile_id.eq.${finalCustomerId},email.eq.${finalEmail}`);

    return res.json({
      success: true,
      url: session.url,
      sessionId: session.id,
      stripeCustomerId,
      customerId: finalCustomerId,
    });
  } catch (error) {
    console.error("create-customer-subscription-checkout error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Unable to create customer subscription checkout.",
    });
  }
});

/* =========================
   UPDATE HELPERS
========================= */

async function updateFreightSubscriptionFromSession(session) {
  const metadata = session.metadata || {};
  const freightId = clean(metadata.freight_id || metadata.freightId || metadata.userId);
  const finalEmail = cleanEmail(metadata.email || session.customer_details?.email || session.customer_email);

  const stripeCustomerId = typeof session.customer === "string" ? session.customer : session.customer?.id || null;
  const stripeSubscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id || null;

  if (!stripeCustomerId || !stripeSubscriptionId) return;

  const { data, error } = await safeUpdateByIdOrEmail(
    "freight_users",
    ["id", "freight_id"],
    freightId,
    finalEmail,
    {
      stripe_id: stripeCustomerId,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      membership_status: "active",
      subscription_status: "active",
      freight_membership_paid: true,
      account_active: true,
      updated_at: nowIso(),
    }
  );

  if (error) console.log("Freight subscription update failed:", error.message);
  else console.log("Freight subscription updated:", data);
}

async function updateDriverSubscriptionFromSession(session) {
  const metadata = session.metadata || {};
  const driverId = clean(metadata.driver_id || metadata.driverId || metadata.userId);
  const finalEmail = cleanEmail(metadata.email || session.customer_details?.email || session.customer_email);

  const stripeCustomerId = typeof session.customer === "string" ? session.customer : session.customer?.id || null;
  const stripeSubscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id || null;

  if (!stripeCustomerId || !stripeSubscriptionId) return;

  const { data, error } = await safeUpdateByIdOrEmail(
    "drivers",
    ["id", "profile_id"],
    driverId,
    finalEmail,
    {
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      membership_status: "active",
      subscription_status: "active",
      account_active: true,
      updated_at: nowIso(),
    }
  );

  if (error) console.log("Driver subscription update failed:", error.message);
  else console.log("Driver subscription updated:", data);
}

async function updateFarmerSubscriptionFromSession(session) {
  const metadata = session.metadata || {};
  const farmerId = clean(metadata.farmer_id || metadata.farmerId || metadata.userId);
  const finalEmail = cleanEmail(metadata.email || session.customer_details?.email || session.customer_email);

  const stripeCustomerId = typeof session.customer === "string" ? session.customer : session.customer?.id || null;
  const stripeSubscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id || null;

  if (!stripeCustomerId || !stripeSubscriptionId) return;

  let periodEnd = null;
  try {
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    periodEnd = getPeriodEnd(subscription);
  } catch {}

  await supabase.from("farmer_subscriptions").upsert(
    {
      farmer_id: farmerId,
      farmer_email: finalEmail,
      name: clean(metadata.name),
      username: clean(metadata.username),
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      subscription_status: "active",
      current_period_end: periodEnd,
      updated_at: nowIso(),
    },
    { onConflict: "stripe_subscription_id" }
  );

  const { data, error } = await safeUpdateByIdOrEmail(
    "farmers",
    ["id", "profile_id"],
    farmerId,
    finalEmail,
    {
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      membership_status: "active",
      subscription_status: "active",
      account_active: true,
      updated_at: nowIso(),
    }
  );

  if (error) console.log("Farmer subscription update failed:", error.message);
  else console.log("Farmer subscription updated:", data);
}

async function updateCustomerSubscriptionFromSession(session) {
  const metadata = session.metadata || {};
  const customerId = clean(metadata.customer_id || metadata.customerId || metadata.userId);
  const finalEmail = cleanEmail(metadata.email || session.customer_details?.email || session.customer_email);

  const stripeCustomerId = typeof session.customer === "string" ? session.customer : session.customer?.id || null;
  const stripeSubscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id || null;

  if (!stripeCustomerId || !stripeSubscriptionId) return;

  let periodEnd = null;
  try {
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    periodEnd = getPeriodEnd(subscription);
  } catch {}

  await supabase.from("customer_subscriptions").upsert(
    {
      customer_id: customerId,
      customer_email: finalEmail,
      name: clean(metadata.name),
      username: clean(metadata.username),
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      subscription_status: "active",
      current_period_end: periodEnd,
      updated_at: nowIso(),
    },
    { onConflict: "stripe_subscription_id" }
  );

  const { data, error } = await safeUpdateByIdOrEmail(
    "customers",
    ["id", "profile_id"],
    customerId,
    finalEmail,
    {
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      membership_status: "active",
      subscription_status: "active",
      account_active: true,
      updated_at: nowIso(),
    }
  );

  if (error) console.log("Customer subscription update failed:", error.message);
  else console.log("Customer subscription updated:", data);
}

async function updateFarmerApplicationFeeFromSession(session) {
  const metadata = session.metadata || {};
  const farmerId = clean(metadata.farmer_id || metadata.farmerId || metadata.userId);
  const finalEmail = cleanEmail(metadata.email || session.customer_details?.email || session.customer_email);
  const stripeCustomerId = typeof session.customer === "string" ? session.customer : session.customer?.id || null;

  const { data, error } = await safeUpdateByIdOrEmail(
    "farmers",
    ["id", "profile_id"],
    farmerId,
    finalEmail,
    {
      stripe_customer_id: stripeCustomerId,
      application_fee_status: "paid",
      application_fee_paid: true,
      application_status: "payment_completed",
      updated_at: nowIso(),
    }
  );

  if (error) console.log("Farmer application fee update failed:", error.message);
  else console.log("Farmer application fee updated:", data);
}

/* =========================
   VERIFY CHECKOUT
========================= */

router.post("/verify-checkout-session", async (req, res) => {
  try {
    if (!requireStripe(res)) return;
    if (!requireSupabase(res)) return;

    const { sessionId } = req.body || {};

    if (!sessionId) {
      return res.status(400).json({ success: false, error: "sessionId is required." });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    });

    const role = clean(session.metadata?.role).toLowerCase();
    const paymentType = clean(session.metadata?.paymentType).toLowerCase();

    if (role === "freight") await updateFreightSubscriptionFromSession(session);
    if (role === "driver") await updateDriverSubscriptionFromSession(session);
    if (role === "farmer" && paymentType === "farmer_membership") await updateFarmerSubscriptionFromSession(session);
    if (role === "farmer" && paymentType === "farmer_application_fee") await updateFarmerApplicationFeeFromSession(session);
    if (role === "customer") await updateCustomerSubscriptionFromSession(session);

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
      error: error.message || "Unable to verify checkout session.",
    });
  }
});

/* =========================
   WEBHOOK
========================= */

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
        const role = clean(session.metadata?.role).toLowerCase();
        const paymentType = clean(session.metadata?.paymentType).toLowerCase();

        if (role === "freight") await updateFreightSubscriptionFromSession(session);
        if (role === "driver") await updateDriverSubscriptionFromSession(session);
        if (role === "farmer" && paymentType === "farmer_membership") await updateFarmerSubscriptionFromSession(session);
        if (role === "farmer" && paymentType === "farmer_application_fee") await updateFarmerApplicationFeeFromSession(session);
        if (role === "customer") await updateCustomerSubscriptionFromSession(session);

        break;
      }

      default:
        console.log(`Stripe webhook ignored event: ${event.type}`);
    }

    return res.status(200).json({ received: true, type: event.type });
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