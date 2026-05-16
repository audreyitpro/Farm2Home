require("dotenv").config();

const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

const FARM2HOME_SERVICE_FEE_RATE = 0.04;

function dollarsToCents(amount) {
  return Math.round(Number(amount) * 100);
}

app.post("/create-farmer-connect-account", async (req, res) => {
  try {
    const { email, businessName } = req.body;

    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      email,
      business_type: "company",
      business_profile: {
        name: businessName || "Farm2Home Farmer",
        product_description: "Local farm products sold through Farm2Home",
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.APP_URL}/farmer/dashboard`,
      return_url: `${process.env.APP_URL}/farmer/dashboard`,
      type: "account_onboarding",
    });

    res.json({
      connectedAccountId: account.id,
      onboardingUrl: accountLink.url,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/create-marketplace-checkout", async (req, res) => {
  try {
    const {
      farmerConnectedAccountId,
      productName,
      quantity,
      subtotalDollars,
    } = req.body;

    const amountCents = dollarsToCents(subtotalDollars);
    const applicationFeeAmount = Math.round(
      amountCents * FARM2HOME_SERVICE_FEE_RATE
    );

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: quantity || 1,
          price_freight marketplacea: {
            currency: "usd",
            unit_amount: amountCents,
            product_freight marketplacea: {
              name: productName || "Farm2Home Order",
            },
          },
        },
      ],
      payment_intent_freight marketplacea: {
        application_fee_amount: applicationFeeAmount,
        transfer_freight marketplacea: {
          destination: farmerConnectedAccountId,
        },
        metafreight marketplacea: {
          platform_company: "Gibson Vision, LLC",
          app_brand: "Farm2Home",
          service_fee_rate: "4%",
        },
      },
      success_url: `${process.env.APP_URL}/marketplace?success=true`,
      cancel_url: `${process.env.APP_URL}/marketplace?canceled=true`,
    });

    res.json({
      checkoutUrl: session.url,
      applicationFeeAmount,
      amountCents,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/create-membership-checkout", async (req, res) => {
  try {
    const { accountType } = req.body;

    const amount =
      accountType === "farmer"
        ? 1499
        : accountType === "customer"
        ? 499
        : 0;

    if (!amount) {
      return res.status(400).json({ error: "Invalid account type." });
    }

    const name =
      accountType === "farmer"
        ? "Farm2Home Farmer Monthly Membership"
        : "Farm2Home Customer Monthly Membership";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_freight marketplacea: {
            currency: "usd",
            unit_amount: amount,
            recurring: {
              interval: "month",
            },
            product_freight marketplacea: {
              name,
            },
          },
        },
      ],
      metafreight marketplacea: {
        platform_company: "Gibson Vision, LLC",
        app_brand: "Farm2Home",
        account_type: accountType,
      },
      success_url: `${process.env.APP_URL}/customer-membership?success=true`,
      cancel_url: `${process.env.APP_URL}/customer-membership?canceled=true`,
    });

    res.json({ checkoutUrl: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/create-farmer-setup-fee-checkout", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_freight marketplacea: {
            currency: "usd",
            unit_amount: 2999,
            product_freight marketplacea: {
              name: "Farm2Home Farmer Account Setup Fee",
            },
          },
        },
      ],
      metafreight marketplacea: {
        platform_company: "Gibson Vision, LLC",
        app_brand: "Farm2Home",
        fee_type: "farmer_setup_fee",
      },
      success_url: `${process.env.APP_URL}/farmer/register?success=true`,
      cancel_url: `${process.env.APP_URL}/farmer/register?canceled=true`,
    });

    res.json({ checkoutUrl: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(process.env.PORT || 4242, () => {
  console.log(`Farm2Home Stripe server running on port ${process.env.PORT || 4242}`);
});