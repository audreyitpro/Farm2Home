require("dotenv").config();

const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");

const app = express();

const PORT = process.env.PORT || 4242;
const APP_URL =
  process.env.APP_URL || "https://farm2home-production-e4bd.up.railway.app";

const FARM2HOME_SERVICE_FEE_RATE = 0.04;

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("WARNING: STRIPE_SECRET_KEY is missing.");
}

const stripe = process.env.STRIPE_SECRET_KEY
  ? Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

function requireStripe(res) {
  if (!stripe) {
    res.status(500).json({
      success: false,
      error: "STRIPE_SECRET_KEY is missing.",
    });
    return false;
  }

  return true;
}

function dollarsToCents(amount) {
  return Math.round(Number(amount || 0) * 100);
}

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Farm2Home Stripe server running",
  });
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    uptime: process.uptime(),
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
  });
});

app.post("/create-farmer-stripe-account", async (req, res) => {
  try {
    if (!requireStripe(res)) return;

    const { farmerId, email, farmName, existingStripeAccountId } = req.body;

    if (!farmerId || !email) {
      return res.status(400).json({
        success: false,
        error: "Missing farmerId or email.",
      });
    }

    let accountId = existingStripeAccountId || "";

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        email,
        business_type: "individual",
        capabilities: {
          transfers: { requested: true },
        },
        metadata: {
          farmerId,
          farmName: farmName || "",
          platform: "farm2home",
        },
      });

      accountId = account.id;
    }

    const refreshUrl =
      process.env.STRIPE_CONNECT_REFRESH_URL ||
      `${APP_URL}/farmer/compliance-upload`;

    const returnUrl =
      process.env.STRIPE_CONNECT_RETURN_URL ||
      `${APP_URL}/farmer/compliance-upload?stripeReturn=true`;

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${refreshUrl}?stripeReturn=false&farmerId=${farmerId}&accountId=${accountId}`,
      return_url: `${returnUrl}&farmerId=${farmerId}&accountId=${accountId}`,
      type: "account_onboarding",
    });

    return res.json({
      success: true,
      accountId,
      url: accountLink.url,
    });
  } catch (error) {
    console.log("Create farmer Stripe account error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to create Stripe onboarding link.",
    });
  }
});

app.get("/farmer-stripe-account-status/:accountId", async (req, res) => {
  try {
    if (!requireStripe(res)) return;

    const { accountId } = req.params;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: "Missing Stripe account ID.",
      });
    }

    const account = await stripe.accounts.retrieve(accountId, {
      expand: ["external_accounts"],
    });

    const bankAccount = account.external_accounts?.data?.find(
      (item) => item.object === "bank_account"
    );

    const bankName = bankAccount?.bank_name || "";
    const last4 = bankAccount?.last4 || "";

    return res.json({
      success: true,
      accountId,
      onboardingComplete: account.details_submitted === true,
      chargesEnabled: account.charges_enabled === true,
      payoutsEnabled: account.payouts_enabled === true,
      stripePayoutAccount:
        bankName && last4
          ? `${bankName} ending in ${last4}`
          : account.details_submitted
          ? "Stripe onboarding submitted"
          : "Stripe payout account pending",
      stripePayoutBankName: bankName,
      stripePayoutAccountLast4: last4,
    });
  } catch (error) {
    console.log("Stripe account status error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to retrieve Stripe account status.",
    });
  }
});

app.post("/create-marketplace-checkout", async (req, res) => {
  try {
    if (!requireStripe(res)) return;

    const {
      farmerConnectedAccountId,
      productName,
      quantity,
      subtotalDollars,
      customerEmail,
    } = req.body;

    if (!farmerConnectedAccountId) {
      return res.status(400).json({
        success: false,
        error: "Missing farmerConnectedAccountId.",
      });
    }

    const amountCents = dollarsToCents(subtotalDollars);

    if (amountCents <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid subtotal amount.",
      });
    }

    const applicationFeeAmount = Math.round(
      amountCents * FARM2HOME_SERVICE_FEE_RATE
    );

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: customerEmail || undefined,
      line_items: [
        {
          quantity: Number(quantity || 1),
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: productName || "Farm2Home Order",
            },
          },
        },
      ],
      payment_intent_data: {
        application_fee_amount: applicationFeeAmount,
        transfer_data: {
          destination: farmerConnectedAccountId,
        },
        metadata: {
          platform_company: "ASO Developments LLC",
          app_brand: "Farm2Home",
          service_fee_rate: "4%",
        },
      },
      metadata: {
        platform_company: "ASO Developments LLC",
        app_brand: "Farm2Home",
        checkout_type: "marketplace",
      },
      success_url: `${APP_URL}/customer/marketplace?success=true`,
      cancel_url: `${APP_URL}/customer/marketplace?canceled=true`,
    });

    return res.json({
      success: true,
      checkoutUrl: session.url,
      url: session.url,
      sessionId: session.id,
      applicationFeeAmount,
      amountCents,
    });
  } catch (error) {
    console.log("Marketplace checkout error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to create marketplace checkout.",
    });
  }
});

app.post("/create-membership-checkout", async (req, res) => {
  try {
    if (!requireStripe(res)) return;

    const { accountType, customerEmail } = req.body;

    const amount =
      accountType === "farmer" ? 1499 : accountType === "customer" ? 499 : 0;

    if (!amount) {
      return res.status(400).json({
        success: false,
        error: "Invalid account type.",
      });
    }

    const name =
      accountType === "farmer"
        ? "Farm2Home Farmer Monthly Membership"
        : "Farm2Home Customer Monthly Membership";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: customerEmail || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amount,
            recurring: {
              interval: "month",
            },
            product_data: {
              name,
            },
          },
        },
      ],
      metadata: {
        platform_company: "ASO Developments LLC",
        app_brand: "Farm2Home",
        account_type: accountType,
      },
      success_url: `${APP_URL}/${accountType}/subscription-success`,
      cancel_url: `${APP_URL}/${accountType}/subscription`,
    });

    return res.json({
      success: true,
      checkoutUrl: session.url,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.log("Membership checkout error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to create membership checkout.",
    });
  }
});

app.post("/create-farmer-setup-fee-checkout", async (req, res) => {
  try {
    if (!requireStripe(res)) return;

    const { customerEmail } = req.body;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: customerEmail || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: 2999,
            product_data: {
              name: "Farm2Home Farmer Account Setup Fee",
            },
          },
        },
      ],
      metadata: {
        platform_company: "ASO Developments LLC",
        app_brand: "Farm2Home",
        fee_type: "farmer_setup_fee",
      },
      success_url: `${APP_URL}/farmer/register?setupFeeSuccess=true`,
      cancel_url: `${APP_URL}/farmer/register?setupFeeCanceled=true`,
    });

    return res.json({
      success: true,
      checkoutUrl: session.url,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.log("Farmer setup fee checkout error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to create farmer setup fee checkout.",
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Farm2Home Stripe server running on port ${PORT}`);
});