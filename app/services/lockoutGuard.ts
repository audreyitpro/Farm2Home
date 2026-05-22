import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

import {
  checkSubscriptionAccess,
  localUserHasAccess,
  UserRole,
} from "./subscriptionService";

export async function enforceSubscriptionAccess(params: {
  role: UserRole;
  userId?: string;
  email?: string;
  redirectTo?: string;
}) {
  try {
    const rawCurrentUser = await AsyncStorage.getItem("currentUser");
    const rawCustomer = await AsyncStorage.getItem("currentCustomer");
    const rawFarmer = await AsyncStorage.getItem("currentFarmer");
    const rawDriver = await AsyncStorage.getItem("currentDriver");
    const rawFreight =
      (await AsyncStorage.getItem("currentFreight")) ||
      (await AsyncStorage.getItem("currentFreightUser")) ||
      (await AsyncStorage.getItem("currentFreightCarrier"));

    const localUsers = [
      rawCurrentUser,
      rawCustomer,
      rawFarmer,
      rawDriver,
      rawFreight,
    ]
      .filter(Boolean)
      .map((item) => {
        try {
          return JSON.parse(item as string);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const matchingLocalUser =
      localUsers.find((user: any) => user?.role === params.role) ||
      localUsers.find((user: any) => localUserHasAccess(user));

    if (localUserHasAccess(matchingLocalUser)) {
      return {
        allowed: true,
        reason: "",
      };
    }

    const result = await checkSubscriptionAccess({
      role: params.role,
      userId: params.userId || matchingLocalUser?.id || "",
      email: params.email || matchingLocalUser?.email || "",
      localUser: matchingLocalUser,
    });

    if (!result.allowed) {
      router.replace(
        (params.redirectTo || "/subscription/subscription-locked") as any
      );

      return {
        allowed: false,
        reason:
          result.reason ||
          "Subscription required to access this feature.",
      };
    }

    return {
      allowed: true,
      reason: "",
    };
  } catch (error: any) {
    console.log("Subscription guard error:", error?.message);

    router.replace(
      (params.redirectTo || "/subscription/subscription-locked") as any
    );

    return {
      allowed: false,
      reason: error?.message || "Unable to verify subscription.",
    };
  }
}