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

async function updateFarmerPaymentStatus({
  farmerId,
  paymentType,
  paid = true,
}) {
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
  await supabase.from("admin_verifications").update(payload).eq("farmer_id", farmerId);
}

/* keep the rest of your existing payments.js below unchanged */