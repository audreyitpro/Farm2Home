const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  "https://farm2home-production-e4bd.up.railway.app";

export type UserRole = "customer" | "farmer" | "freight" | "driver";

export type SubscriptionStatusResponse = {
  success: boolean;
  role: UserRole;
  userId?: string;
  email?: string;
  hasActiveSubscription: boolean;
  lockedOut: boolean;
  lockoutReason: string;
  subscription: any | null;
  error?: string;
};

export async function checkSubscriptionStatus(params: {
  role: UserRole;
  userId?: string;
  email?: string;
}): Promise<SubscriptionStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/payments/subscription-status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      role: params.role,
      userId: params.userId || "",
      email: params.email || "",
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Unable to check subscription status.");
  }

  return data;
}

export async function cancelSubscription(params: {
  role: UserRole;
  userId?: string;
  subscriptionId?: string;
  stripeCustomerId?: string;
  cancelAtPeriodEnd?: boolean;
}) {
  const response = await fetch(`${API_BASE_URL}/payments/cancel-subscription`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      role: params.role,
      userId: params.userId || "",
      subscriptionId: params.subscriptionId || "",
      stripeCustomerId: params.stripeCustomerId || "",
      cancelAtPeriodEnd: params.cancelAtPeriodEnd || false,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Unable to cancel subscription.");
  }

  return data;
}

export function shouldLockOut(status?: string | null) {
  return String(status || "").toLowerCase() !== "active";
}

export function getSubscriptionId(subscription: any) {
  return subscription?.stripe_subscription_id || "";
}

export function getStripeCustomerId(subscription: any) {
  return subscription?.stripe_customer_id || "";
}