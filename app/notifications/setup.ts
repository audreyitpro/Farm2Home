import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { getCurrentAuthProfile } from "../data/authStore";
import { supabase } from "../data/supabaseClient";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export type Farm2HomeNotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, any>;
};

export async function registerForPushNotificationsAsync() {
  try {
    if (!Device.isDevice) {
      console.log("Push notifications require a physical device.");
      return null;
    }

    const existingPermission = await Notifications.getPermissionsAsync();
    let finalStatus = existingPermission.status;

    if (existingPermission.status !== "granted") {
      const requestedPermission = await Notifications.requestPermissionsAsync();
      finalStatus = requestedPermission.status;
    }

    if (finalStatus !== "granted") {
      console.log("Notification permission not granted.");
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.log("Missing EAS projectId for push token.");
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const token = tokenData.data;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("farm2home-default", {
        name: "Farm2Home Alerts",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#2F7D32",
      });
    }

    await savePushTokenToSupabase(token);

    return token;
  } catch (error) {
    console.log("Register push notification error:", error);
    return null;
  }
}

export async function savePushTokenToSupabase(expoPushToken: string) {
  try {
    const profile = await getCurrentAuthProfile();

    if (!profile) {
      console.log("No profile found. Push token not saved.");
      return;
    }

    const { error } = await supabase.from("push_tokens").upsert(
      {
        profile_id: profile.id,
        role: profile.role,
        email: profile.email,
        expo_push_token: expoPushToken,
        device_platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "expo_push_token",
      }
    );

    if (error) {
      console.log("Save push token error:", error.message);
    }
  } catch (error) {
    console.log("Save push token exception:", error);
  }
}

export function addNotificationListeners(params?: {
  onReceive?: (notification: Notifications.Notification) => void;
  onResponse?: (response: Notifications.NotificationResponse) => void;
}) {
  const receivedSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      params?.onReceive?.(notification);
    }
  );

  const responseSubscription =
    Notifications.addNotificationResponseReceivedListener((response) => {
      params?.onResponse?.(response);
    });

  return function removeNotificationListeners() {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}

export async function scheduleLocalNotification({
  title,
  body,
  data,
}: Farm2HomeNotificationPayload) {
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data || {},
      sound: true,
    },
    trigger: null,
  });
}

export async function notifyOrderAccepted(orderId: string) {
  return scheduleLocalNotification({
    title: "Order Accepted",
    body: "Your Farm2Home order has been accepted by the farmer.",
    data: {
      type: "ORDER_ACCEPTED",
      orderId,
    },
  });
}

export async function notifyDriverAssigned(orderId: string, loadId?: string) {
  return scheduleLocalNotification({
    title: "Driver Assigned",
    body: "A Farm2Home driver has been assigned to your delivery.",
    data: {
      type: "DRIVER_ASSIGNED",
      orderId,
      loadId,
    },
  });
}

export async function notifyDriverNearby(orderId: string, loadId?: string) {
  return scheduleLocalNotification({
    title: "Driver Nearby",
    body: "Your Farm2Home delivery driver is getting close.",
    data: {
      type: "DRIVER_NEARBY",
      orderId,
      loadId,
    },
  });
}

export async function notifyOrderDelivered(orderId: string) {
  return scheduleLocalNotification({
    title: "Order Delivered",
    body: "Your Farm2Home order has been delivered.",
    data: {
      type: "ORDER_DELIVERED",
      orderId,
    },
  });
}

export async function notifyNewFreightLoad(loadId: string) {
  return scheduleLocalNotification({
    title: "New Freight Load Available",
    body: "A new Farm2Home freight opportunity is available.",
    data: {
      type: "NEW_FREIGHT_LOAD",
      loadId,
    },
  });
}

export async function notifyAdminApproval(type: "FARMER" | "FREIGHT") {
  return scheduleLocalNotification({
    title: "Verification Approved",
    body:
      type === "FARMER"
        ? "Your farmer account has been approved."
        : "Your freight carrier account has been approved.",
    data: {
      type: "ADMIN_APPROVAL",
      accountType: type,
    },
  });
}