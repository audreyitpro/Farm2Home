// app/_layout.tsx

import React, { useEffect } from "react";
import { Stack, router } from "expo-router";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";

import { AuthProvider } from "./providers/AuthProvider";
import { registerPushNotifications } from "./services/notificationService";

import {
  startAutonomousScheduler,
  stopAutonomousScheduler,
} from "./services/autonomousScheduler";

export default function RootLayout() {
  useEffect(() => {
    async function setupNotifications() {
      try {
        await registerPushNotifications();
      } catch (error) {
        console.log("Notification setup error:", error);
      }
    }

    setupNotifications();
    startAutonomousScheduler();

    const listener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data || {};

        const type = String(data.type || "");
        const orderId = String(data.orderId || "");
        const loadId = String(data.loadId || "");

        if (
          type === "ORDER_ACCEPTED" ||
          type === "ORDER_IN_TRANSIT" ||
          type === "ORDER_DELIVERED"
        ) {
          router.push({
            pathname: "/customer/order-tracking",
            params: { orderId, loadId },
          });
          return;
        }

        if (type === "NEW_CHAT_MESSAGE") {
          router.push("/chat/chat-center");
          return;
        }

        if (type === "NEW_FREIGHT_LOAD") {
          router.push("/freight/board");
          return;
        }

        if (type === "LOAD_STATUS_UPDATE") {
          router.push({
            pathname: "/freight/tracking",
            params: { loadId },
          });
          return;
        }

        if (type === "AI_DISPATCH_COMPLETE") {
          router.push("/ai/dispatch-intelligence-center");
          return;
        }

        if (type === "HIGH_DELAY_RISK") {
          router.push("/admin/live-operations-center");
          return;
        }

        if (type === "ADMIN_ALERT") {
          router.push("/admin/dashboard");
        }
      }
    );

    return () => {
      listener.remove();
      stopAutonomousScheduler();
    };
  }, []);

  return (
    <AuthProvider>
      <StatusBar style="dark" />

      <Stack
        screenOptions={{
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />

        {/* AUTH */}
        <Stack.Screen name="auth/login" options={{ title: "Login", headerShown: false }} />
        <Stack.Screen name="auth/register" options={{ title: "Create Account", headerShown: false }} />

        {/* ONBOARDING */}
        <Stack.Screen name="onboarding/index" options={{ title: "Account Setup", headerShown: false }} />

        {/* PROFILE */}
        <Stack.Screen name="profile/edit-profile" options={{ title: "Edit Profile", headerShown: false }} />

        {/* CUSTOMER */}
        <Stack.Screen name="customer/customer-dashboard" options={{ title: "Customer Dashboard" }} />
        <Stack.Screen name="customer/login" options={{ title: "Customer Login" }} />
        <Stack.Screen name="customer/password-recovery" options={{ title: "Customer Recovery" }} />
        <Stack.Screen name="customer/register" options={{ title: "Customer Registration" }} />
        <Stack.Screen name="customer/subscription" options={{ title: "Customer Subscription" }} />
        <Stack.Screen name="customer/subscription-membership" options={{ title: "Membership Plans" }} />
        <Stack.Screen name="customer/subscription-success" options={{ title: "Membership Active" }} />
        <Stack.Screen name="customer/payment-success" options={{ title: "Payment Complete" }} />
        <Stack.Screen name="customer/profile" options={{ title: "Customer Profile" }} />
        <Stack.Screen name="customer/saved-addresses" options={{ title: "Saved Addresses" }} />
        <Stack.Screen name="customer/payment-methods" options={{ title: "Payment Methods" }} />
        <Stack.Screen name="customer/coupons-promos" options={{ title: "Coupons & Promos" }} />
        <Stack.Screen name="customer/reviews-ratings" options={{ title: "Reviews & Ratings" }} />
        <Stack.Screen name="customer/refund-request" options={{ title: "Refund Request" }} />
        <Stack.Screen name="customer/marketplace" options={{ title: "Marketplace" }} />
        <Stack.Screen name="customer/recommendations" options={{ title: "AI Recommendations" }} />
        <Stack.Screen name="customer/voice-ordering" options={{ title: "Voice Ordering" }} />
        <Stack.Screen name="customer/ai-meal-planner" options={{ title: "AI Meal Planner" }} />
        <Stack.Screen name="customer/ai-nutrition-coach" options={{ title: "AI Nutrition Coach" }} />
        <Stack.Screen name="customer/family-grocery-bundles" options={{ title: "Family Grocery Bundles" }} />
        <Stack.Screen name="customer/farm-favorites" options={{ title: "Favorite Farms" }} />
        <Stack.Screen name="customer/seasonal-produce-guide" options={{ title: "Seasonal Produce Guide" }} />
        <Stack.Screen name="customer/farm-subscription-boxes" options={{ title: "Farm Subscription Boxes" }} />
        <Stack.Screen name="customer/delivery-preferences" options={{ title: "Delivery Preferences" }} />
        <Stack.Screen name="customer/recurring-produce" options={{ title: "Recurring Produce" }} />
        <Stack.Screen name="customer/loyalty-rewards" options={{ title: "Loyalty Rewards" }} />
        <Stack.Screen name="customer/referral-program" options={{ title: "Referral Program" }} />
        <Stack.Screen name="customer/smart-household-inventory" options={{ title: "Smart Inventory" }} />
        <Stack.Screen name="customer/customer-support" options={{ title: "Customer Support" }} />
        <Stack.Screen name="customer/live-map" options={{ title: "Live Map" }} />
        <Stack.Screen name="customer/cart" options={{ title: "Shopping Cart" }} />
        <Stack.Screen name="customer/checkout" options={{ title: "Checkout" }} />
        <Stack.Screen name="customer/orders" options={{ title: "My Orders" }} />
        <Stack.Screen name="customer/order-confirmation" options={{ title: "Order Confirmation" }} />
        <Stack.Screen name="customer/order-tracking" options={{ title: "Live Order Tracking" }} />

        {/* FARMER */}
        <Stack.Screen name="farmer/login" options={{ title: "Farmer Login" }} />
        <Stack.Screen name="farmer/password-recovery" options={{ title: "Farmer Recovery" }} />
        <Stack.Screen name="farmer/register" options={{ title: "Farmer Registration" }} />
        <Stack.Screen name="farmer/compliance-upload" options={{ title: "Farmer Compliance" }} />
        <Stack.Screen name="farmer/awaiting-approval" options={{ title: "Awaiting Approval" }} />
        <Stack.Screen name="farmer/setup-store" options={{ title: "Setup Farmer Store" }} />
        <Stack.Screen name="farmer/subscription-success" options={{ title: "Farmer Membership Active" }} />
        <Stack.Screen name="farmer/dashboard" options={{ title: "Farmer Dashboard" }} />
        <Stack.Screen name="farmer/profile" options={{ title: "Farmer Profile" }} />
        <Stack.Screen name="farmer/add-product" options={{ title: "Add Product" }} />
        <Stack.Screen name="farmer/orders" options={{ title: "Farmer Orders" }} />
        <Stack.Screen name="farmer/delivery-orders" options={{ title: "Delivery Orders" }} />
        <Stack.Screen name="farmer/stripe-banking" options={{ title: "Farmer Payouts" }} />
        <Stack.Screen name="farmer/farm-ai-growth-center" options={{ title: "Farm AI Growth Center" }} />

        {/* FREIGHT */}
        <Stack.Screen name="freight/login" options={{ title: "Freight Login" }} />
        <Stack.Screen name="freight/password-recovery" options={{ title: "Freight Recovery" }} />
        <Stack.Screen name="freight/register" options={{ title: "Freight Registration" }} />
        <Stack.Screen name="freight/dashboard" options={{ title: "Freight Dashboard" }} />
        <Stack.Screen name="freight/board" options={{ title: "Load Board" }} />
        <Stack.Screen name="freight/post-load" options={{ title: "Post Load" }} />
        <Stack.Screen name="freight/live-route" options={{ title: "Live Route" }} />
        <Stack.Screen name="freight/navigation-assistant" options={{ title: "Navigation Assistant" }} />
        <Stack.Screen name="freight/tracking" options={{ title: "Freight Tracking" }} />
        <Stack.Screen name="freight/route-status-updates" options={{ title: "Route Status Updates" }} />
        <Stack.Screen name="freight/subscription-success" options={{ title: "Freight Active" }} />
        <Stack.Screen name="freight/documents" options={{ title: "Carrier Documents" }} />
        <Stack.Screen name="freight/load-payment-tracking" options={{ title: "Load Payment Tracking" }} />

        {/* DRIVER */}
        <Stack.Screen name="driver/login" options={{ title: "Driver Login" }} />
        <Stack.Screen name="driver/register" options={{ title: "Driver Registration" }} />
        <Stack.Screen name="driver/password-recovery" options={{ title: "Driver Recovery" }} />
        <Stack.Screen name="driver/subscription" options={{ title: "Driver Membership" }} />
        <Stack.Screen name="driver/subscription-success" options={{ title: "Driver Membership Active" }} />
        <Stack.Screen name="driver/mobile-driver-app" options={{ title: "Driver App" }} />
        <Stack.Screen name="driver/driver-dashboard" options={{ title: "Driver Dashboard" }} />
        <Stack.Screen name="driver/live-location-provider" options={{ title: "Live GPS Provider" }} />
        <Stack.Screen name="driver/live-deliveries" options={{ title: "Live Deliveries" }} />
        <Stack.Screen name="driver/available-orders" options={{ title: "Available Orders" }} />
        <Stack.Screen name="driver/navigation" options={{ title: "Driver Navigation" }} />
        <Stack.Screen name="driver/proof-of-pickup" options={{ title: "Proof of Pickup" }} />
        <Stack.Screen name="driver/proof-of-delivery" options={{ title: "Proof of Delivery" }} />
        <Stack.Screen name="driver/payment-history" options={{ title: "Payment History" }} />
        <Stack.Screen name="driver/earnings" options={{ title: "Driver Earnings" }} />
        <Stack.Screen name="driver/notifications" options={{ title: "Driver Notifications" }} />

        {/* ADMIN */}
        <Stack.Screen name="admin/login" options={{ title: "Admin Login" }} />
        <Stack.Screen name="admin/dashboard" options={{ title: "Admin Dashboard" }} />

        {/* CHAT */}
        <Stack.Screen name="chat/chat-center" options={{ title: "Farm2Home Chat" }} />
      </Stack>
    </AuthProvider>
  );
}