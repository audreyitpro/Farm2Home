import { router } from "expo-router";

import { checkSubscriptionStatus, UserRole } from "./subscriptionService";

export async function enforceSubscriptionAccess(params: {
  role: UserRole;
  userId?: string;
  email?: string;
  redirectTo?: string;
}) {
  try {
    const result = await checkSubscriptionStatus({
      role: params.role,
      userId: params.userId || "",
      email: params.email || "",
    });

    if (result.lockedOut) {
      router.replace(
        params.redirectTo || "/subscription/subscription-locked"
      );

      return {
        allowed: false,
        reason:
          result.lockoutReason ||
          "Subscription required to access this feature.",
      };
    }

    return {
      allowed: true,
      reason: "",
    };
  } catch (error: any) {
    console.log("Subscription guard error:", error?.message);

    return {
      allowed: false,
      reason: error?.message || "Unable to verify subscription.",
    };
  }
}