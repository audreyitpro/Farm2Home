require("dotenv").config();

const express = require("express");
const cors = require("cors");

const paymentsRoutes = require("../backend/routes/payments");
const driverRoutes = require("../backend/routes/driver");
const stripeWebhookRoutes = require("../backend/routes/stripe-webhooks");
const deliveryPayoutRoutes = require("../backend/routes/delivery-payouts");
const payoutRetryRoutes = require("../backend/routes/payout-retry");

const app = express();

const PORT = process.env.PORT || 4242;

const APP_URL =
  process.env.APP_URL || "https://farm2home-rho.vercel.app";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.API_BASE_URL ||
  "https://farm2home-production-e4bd.up.railway.app";

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "stripe-signature"],
  })
);

/* Stripe webhook must stay before express.json() */
app.use("/stripe", stripeWebhookRoutes);

app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Farm2Home Backend Running",
    environment: process.env.NODE_ENV || "production",
    appUrl: APP_URL,
    apiBaseUrl: API_BASE_URL,
  });
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    uptime: process.uptime(),
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    webhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    appUrl: APP_URL,
    apiBaseUrl: API_BASE_URL,
    paymentsRoutesMounted: true,
    driverRoutesMounted: true,
    stripeWebhookMounted: true,
    deliveryPayoutRoutesMounted: true,
    payoutRetryRoutesMounted: true,
  });
});

app.use("/payments", paymentsRoutes);
app.use("/driver", driverRoutes);
app.use("/delivery-payouts", deliveryPayoutRoutes);
app.use("/payouts", payoutRetryRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found.",
    path: req.originalUrl,
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Farm2Home backend running on port ${PORT}`);
  console.log(`Production API URL: ${API_BASE_URL}`);
});