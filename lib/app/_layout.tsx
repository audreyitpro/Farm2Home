import React, { useEffect } from "react";
import { Stack, router } from "expo-router";
import * as Notifications from "expo-notifications";

import {
  addNotificationReceivedListener,
  addNotificationResponseListener,
  clearBadgeCount,
  getNotificationRoute,
} from "../../app/services/notificationService";

export default function Layout() {
  useEffect(() => {
    clearBadgeCount();

    const receivedSubscription = addNotificationReceivedListener(
      (notification: Notifications.Notification) => {
        console.log("Notification received:", notification);
      }
    );

    const responseSubscription = addNotificationResponseListener(
      (response: Notifications.NotificationResponse) => {
        try {
          const data = response.notification.request.content.data || {};
          console.log("Notification tapped:", data);

          const route = getNotificationRoute(data);

          if (route) {
            router.push(route as any);
          }
        } catch (error) {
          console.log("Notification routing error:", error);
        }
      }
    );

    async function checkInitialNotification() {
      try {
        const response =
          await Notifications.getLastNotificationResponseAsync();

        if (!response) return;

        const data = response.notification.request.content.data || {};
        const route = getNotificationRoute(data);

        if (route) {
          router.push(route as any);
        }
      } catch (error) {
        console.log("Initial notification check error:", error);
      }
    }

    checkInitialNotification();

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    />
  );
}