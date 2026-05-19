const express = require("express");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* =====================================================
   HELPERS
===================================================== */

async function updateSubscriptionStatus({
  role,
  userId,
  email,
  stripeCustomerId,
  stripeSubscriptionId,
  subscriptionStatus,
  currentPeriodEnd,
}) {
  const normalizedRole = (role || "").toLowerCase();

  if (!normalizedRole) return;

  if (normalizedRole === "driver") {
    await supabase.from("driver_subscriptions").upsert(
      [
        {
          driver_id: userId || email || stripeCustomerId,
          driver_email: email || "",
          stripe_customer_id: stripeCustomerId || "",
          stripe_subscription_id: stripeSubscriptionId || "",
          subscription_status: subscriptionStatus || "inactive",
          current_period_end: currentPeriodEnd || null,
          updated_at: new Date().toISOString(),
        },
      ],
      {
        onConflict: "driver_id",
      }
    );

    return;
  }

  const table =
    normalizedRole === "farmer"
      ? "farmer_subscriptions"
      : normalizedRole === "freight"
      ? "freight_subscriptions"
      : "customer_subscriptions";

  const idColumn =
    normalizedRole === "farmer"
      ? "farmer_id"
      : normalizedRole === "freight"
      ? "freight_id"
      : "customer_id";

  const emailColumn =
    normalizedRole === "farmer"
      ? "farmer_email"
      : normalizedRole === "freight"
      ? "freight_email"
      : "customer_email";

  await supabase.from(table).upsert(
    [
      {
        [idColumn]: userId || email || stripeCustomerId,
        [emailColumn]: email || "",
        stripe_customer_id: stripeCustomerId || "",
        stripe_subscription_id: stripeSubscriptionId || "",
        subscription_status: subscriptionStatus || "inactive",
        current_period_end: currentPeriodEnd || null,
        updated_at: new Date().toISOString(),
      },
    ],
    {
      onConflict: idColumn,
    }
  );
}

/* =====================================================
   STRIPE WEBHOOK
===================================================== */

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers["stripe-signature"],
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (error) {
      console.log("Stripe webhook verification failed:", error.message);

      return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    try {
      console.log("Stripe webhook event:", event.type);

      /* =====================================================
         CHECKOUT COMPLETED
      ===================================================== */

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        const metadata = session.metadata || {};

        const role = metadata.role || metadata.planType || "customer";

        if (session.mode === "subscription") {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription
          );

          const currentPeriodEnd = subscription.current_period_end
            ? new Date(
                subscription.current_period_end * 1000
              ).toISOString()
            : null;

          await updateSubscriptionStatus({
            role,
            userId:
              metadata.userId ||
              metadata.driverId ||
              metadata.freightId ||
              metadata.farmerId ||
              metadata.customerId ||
              "",
            email: metadata.email || session.customer_email || "",
            stripeCustomerId: session.customer,
            stripeSubscriptionId: subscription.id,
            subscriptionStatus: subscription.status,
            currentPeriodEnd,
          });

          console.log(`${role} subscription activated.`);
        }
      }

      /* =====================================================
         SUBSCRIPTION UPDATED
      ===================================================== */

      if (event.type === "customer.subscription.updated") {
        const subscription = event.data.object;

        const metadata = subscription.metadata || {};

        const role = metadata.role || metadata.planType || "customer";

        const currentPeriodEnd = subscription.current_period_end
          ? new Date(
              subscription.current_period_end * 1000
            ).toISOString()
          : null;

        await updateSubscriptionStatus({
          role,
          userId:
            metadata.userId ||
            metadata.driverId ||
            metadata.freightId ||
            metadata.farmerId ||
            metadata.customerId ||
            "",
          email: metadata.email || "",
          stripeCustomerId: subscription.customer,
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          currentPeriodEnd,
        });

        console.log(`${role} subscription updated.`);
      }

      /* =====================================================
         SUBSCRIPTION DELETED
      ===================================================== */

      if (event.type === "customer.subscription.deleted") {
        const subscription = event.data.object;

        const metadata = subscription.metadata || {};

        const role = metadata.role || metadata.planType || "customer";

        await updateSubscriptionStatus({
          role,
          userId:
            metadata.userId ||
            metadata.driverId ||
            metadata.freightId ||
            metadata.farmerId ||
            metadata.customerId ||
            "",
          email: metadata.email || "",
          stripeCustomerId: subscription.customer,
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: "canceled",
          currentPeriodEnd: null,
        });

        console.log(`${role} subscription canceled.`);
      }

      /* =====================================================
         PAYMENT FAILED
      ===================================================== */

      if (event.type === "invoice.payment_failed") {
        const invoice = event.data.object;

        console.log("Payment failed:", invoice.id);
      }

      /* =====================================================
         PAYMENT SUCCEEDED
      ===================================================== */

      if (event.type === "invoice.payment_succeeded") {
        const invoice = event.data.object;

        console.log("Payment succeeded:", invoice.id);
      }

      return res.json({
        received: true,
      });
    } catch (error) {
      console.log("Webhook processing error:", error);

      return res.status(500).json({
        success: false,
        error: error.message || "Webhook processing failed.",
      });
    }
  }
);

module.exports = router;