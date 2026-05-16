// app/services/roleRedirectService.ts

import { router } from "expo-router";
import { AppUserRole } from "./authService";

export function getDashboardRouteByRole(role?: string | null) {
  switch (role) {
    case "customer":
      return "/customer/customer-dashboard";

    case "farmer":
      return "/farmer/dashboard";

    case "freight":
      return "/freight/dashboard";

    case "driver":
      return "/driver/mobile-driver-app";

    case "admin":
      return "/admin/dashboard";

    default:
      return "/auth/login";
  }
}

export function redirectUserByRole(
  role?: AppUserRole | string | null,
  onboardingComplete?: boolean
) {
  if (!role) {
    router.replace("/auth/login");
    return;
  }

  if (onboardingComplete === false) {
    router.replace("/onboarding");
    return;
  }

  const route = getDashboardRouteByRole(role);
  router.replace(route as any);
}

export function getUserRoleFromUser(user: any): AppUserRole | null {
  const role = user?.user_metadata?.role;

  if (
    role === "customer" ||
    role === "farmer" ||
    role === "freight" ||
    role === "driver" ||
    role === "admin"
  ) {
    return role;
  }

  return null;
}