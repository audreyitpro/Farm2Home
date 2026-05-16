// app/services/stripeClient.ts

import { getBackendUrl } from "./apiConfig";

type CheckoutPayload = {
  priceId: string;
  customerEmail?: string;
  mode?: "payment" | "subscription";
  successUrl?: string;
  cancelUrl?: string;
};

export async function createStripeCheckoutSession(payload: CheckoutPayload) {
  const response = await fetch(`${getBackendUrl()}/create-checkout-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      priceId: payload.priceId,
      customerEmail: payload.customerEmail,
      mode: payload.mode || "subscription",
      successUrl: payload.successUrl,
      cancelUrl: payload.cancelUrl,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Unable to create Stripe checkout session.");
  }

  return response.json();
}

export async function createStripeCustomerPortal(customerId: string) {
  const response = await fetch(`${getBackendUrl()}/create-customer-portal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ customerId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Unable to open Stripe customer portal.");
  }

  return response.json();
}