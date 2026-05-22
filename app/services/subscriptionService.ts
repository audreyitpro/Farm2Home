import { API_BASE_URL } from "../config/api";

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

export function localUserHasAccess(user: any) {
  if (!user) return false;

  return (
    user.hasActiveSubscription === true ||
    user.subscriptionActive === true ||
    user.accountActive === true ||
    user.marketplaceAccess === true ||
    user.freightBoardAccess === true ||
    user.driverBoardAccess === true ||
    user.driverSubscriptionActive === true ||
    user.approved === true ||
    String(user.subscriptionStatus || "").toLowerCase() === "active" ||
    String(user.membershipStatus || "").toLowerCase() === "active" ||
    String(user.complianceStatus || "").toLowerCase() === "approved"
  );
}

export async function checkSubscriptionStatus(params: {
  role: UserRole;
  userId?: string;
  email?: string;
}): Promise<SubscriptionStatusResponse> {
  try {
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
  } catch (error: any) {
    return {
      success: false,
      role: params.role,
      userId: params.userId || "",
      email: params.email || "",
      hasActiveSubscription: false,
      lockedOut: true,
      lockoutReason: error?.message || "Unable to verify subscription.",
      subscription: null,
      error: error?.message || "Subscription check failed.",
    };
  }
}

export async function checkSubscriptionAccess(params: {
  role: UserRole;
  userId?: string;
  email?: string;
  localUser?: any;
}) {
  if (localUserHasAccess(params.localUser)) {
    return {
      success: true,
      allowed: true,
      reason: "",
      subscription: params.localUser,
      raw: params.localUser,
    };
  }

  const data = await checkSubscriptionStatus({
    role: params.role,
    userId: params.userId || "",
    email: params.email || "",
  });

  const allowed =
    data.hasActiveSubscription === true ||
    data.lockedOut !== true;

  return {
    success: data.success,
    allowed,
    reason:
      data.lockoutReason ||
      (allowed ? "" : "Subscription inactive."),
    subscription: data.subscription || null,
    raw: data,
  };
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