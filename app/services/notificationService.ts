// app/services/notificationService.ts

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { supabase } from "./supabaseClient";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type NotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, any>;
};

export type FreightStatus =
  | "available"
  | "accepted"
  | "arrived_pickup"
  | "picked_up"
  | "in_transit"
  | "arrived_dropoff"
  | "delivered"
  | "cancelled";

function getProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.projectId
  );
}

export async function registerPushNotifications(userId?: string) {
  try {
    if (!Device.isDevice) {
      console.log("Push notifications require a physical device.");
      return null;
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;

    if (status !== "granted") {
      const request = await Notifications.requestPermissionsAsync();
      status = request.status;
    }

    if (status !== "granted") {
      console.log("Push notification permission denied.");
      return null;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Farm2Home Alerts",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#10B981",
      });
    }

    const projectId = getProjectId();

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    const token = tokenData.data;

    if (userId && token) {
      await savePushToken(userId, token);
    }

    return token;
  } catch (error) {
    console.log("REGISTER_PUSH_NOTIFICATION_ERROR:", error);
    return null;
  }
}

export async function savePushToken(userId: string, expoPushToken: string) {
  try {
    const { error } = await supabase.from("push_tokens").upsert(
      {
        user_id: userId,
        expo_push_token: expoPushToken,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,expo_push_token",
      }
    );

    if (error) {
      console.log("SAVE_PUSH_TOKEN_ERROR:", error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.log("SAVE_PUSH_TOKEN_CRASH:", error);
    return false;
  }
}

export async function sendLocalNotification({
  title,
  body,
  data,
}: NotificationPayload) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
      },
      trigger: null,
    });

    return true;
  } catch (error) {
    console.log("SEND_LOCAL_NOTIFICATION_ERROR:", error);
    return false;
  }
}

export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(callback);
}

export async function clearBadgeCount() {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch (error) {
    console.log("CLEAR_BADGE_ERROR:", error);
  }
}

function readableStatus(status: string) {
  return status.replace(/_/g, " ");
}

/*
  CUSTOMER ORDER NOTIFICATIONS
*/

export async function notifyOrderAccepted(orderId: string) {
  return sendLocalNotification({
    title: "Order Accepted",
    body: "Your Farm2Home order was accepted by the farmer.",
    data: {
      type: "ORDER_ACCEPTED",
      orderId,
    },
  });
}

export async function notifyOrderInTransit(orderId: string) {
  return sendLocalNotification({
    title: "Order In Transit",
    body: "Your Farm2Home delivery is on the way.",
    data: {
      type: "ORDER_IN_TRANSIT",
      orderId,
    },
  });
}

export async function notifyOrderDelivered(orderId: string) {
  return sendLocalNotification({
    title: "Order Delivered",
    body: "Your Farm2Home order has been delivered.",
    data: {
      type: "ORDER_DELIVERED",
      orderId,
    },
  });
}

/*
  FREIGHT NOTIFICATIONS
*/

export async function notifyNewFreightLoad(loadId: string) {
  return sendLocalNotification({
    title: "New Freight Load",
    body: "A new Farm2Home freight load is available.",
    data: {
      type: "NEW_FREIGHT_LOAD",
      loadId,
      route: "/freight/board",
    },
  });
}

export async function notifyDriverAcceptedLoad(loadId: string) {
  return sendLocalNotification({
    title: "Driver Accepted Load",
    body: "A driver accepted this Farm2Home freight load.",
    data: {
      type: "DRIVER_ACCEPTED_LOAD",
      loadId,
      route: "/admin/live-operations-center",
    },
  });
}

export async function notifyDriverArrivedPickup(loadId: string) {
  return sendLocalNotification({
    title: "Driver Arrived at Pickup",
    body: "The driver has arrived at the pickup location.",
    data: {
      type: "DRIVER_ARRIVED_PICKUP",
      loadId,
      route: "/admin/live-operations-center",
    },
  });
}

export async function notifyPickupCompleted(loadId: string) {
  return sendLocalNotification({
    title: "Pickup Completed",
    body: "The freight pickup has been completed with proof uploaded.",
    data: {
      type: "PICKUP_COMPLETED",
      loadId,
      route: "/admin/live-operations-center",
    },
  });
}

export async function notifyDriverArrivedDropoff(loadId: string) {
  return sendLocalNotification({
    title: "Driver Arrived at Dropoff",
    body: "The driver has arrived at the dropoff location.",
    data: {
      type: "DRIVER_ARRIVED_DROPOFF",
      loadId,
      route: "/admin/live-operations-center",
    },
  });
}

export async function notifyDeliveryCompleted(loadId: string) {
  return sendLocalNotification({
    title: "Delivery Completed",
    body: "Proof of delivery has been uploaded and the load is complete.",
    data: {
      type: "DELIVERY_COMPLETED",
      loadId,
      route: "/driver/earnings",
    },
  });
}

export async function notifyLoadCancelled(loadId: string) {
  return sendLocalNotification({
    title: "Load Cancelled",
    body: "A Farm2Home freight load was cancelled.",
    data: {
      type: "LOAD_CANCELLED",
      loadId,
      route: "/freight/board",
    },
  });
}

export async function notifyLoadStatusUpdate(
  loadId: string,
  status: FreightStatus | string
) {
  return sendLocalNotification({
    title: "Load Status Updated",
    body: `Load status changed to ${readableStatus(status)}.`,
    data: {
      type: "LOAD_STATUS_UPDATE",
      loadId,
      status,
      route: "/admin/live-operations-center",
    },
  });
}

export async function notifyColdChainAlert(loadId: string) {
  return sendLocalNotification({
    title: "Cold Chain Alert",
    body: "A refrigerated or temperature-sensitive load needs attention.",
    data: {
      type: "COLD_CHAIN_ALERT",
      loadId,
      route: "/admin/live-operations-center",
    },
  });
}

export async function notifyDriverGpsStale(loadId: string) {
  return sendLocalNotification({
    title: "Driver GPS Stale",
    body: "A driver's GPS has not updated recently.",
    data: {
      type: "DRIVER_GPS_STALE",
      loadId,
      route: "/admin/fleet-map",
    },
  });
}

export async function notifyAdminAlert(message: string, loadId?: string) {
  return sendLocalNotification({
    title: "Admin Alert",
    body: message,
    data: {
      type: "ADMIN_ALERT",
      loadId,
      route: "/admin/live-operations-center",
    },
  });
}

/*
  ROUTING HELPER FOR NOTIFICATION TAPS
*/

export function getNotificationRoute(
  data?: Record<string, any>
): string | null {
  if (!data) return null;

  if (typeof data.route === "string") {
    return data.route;
  }

  switch (data.type) {
    case "NEW_FREIGHT_LOAD":
      return "/freight/board";

    case "DRIVER_ACCEPTED_LOAD":
    case "DRIVER_ARRIVED_PICKUP":
    case "PICKUP_COMPLETED":
    case "DRIVER_ARRIVED_DROPOFF":
    case "LOAD_STATUS_UPDATE":
    case "COLD_CHAIN_ALERT":
    case "ADMIN_ALERT":
      return "/admin/live-operations-center";

    case "DELIVERY_COMPLETED":
      return "/driver/earnings";

    case "DRIVER_GPS_STALE":
      return "/admin/fleet-map";

    case "ORDER_ACCEPTED":
    case "ORDER_IN_TRANSIT":
    case "ORDER_DELIVERED":
      return "/customer/marketplace";

    default:
      return null;
  }
}