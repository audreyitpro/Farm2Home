// app/services/notificationService.ts

import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

export type NotificationDataValue =
  | string
  | number
  | boolean
  | null
  | undefined;

export type NotificationData = Record<
  string,
  NotificationDataValue
>;

export type LocalNotificationPayload = {
  title: string;
  body: string;
  data?: NotificationData;
  sound?: boolean;
};

export type NotificationRouteData = {
  type?: unknown;
  orderId?: unknown;
  order_id?: unknown;
  loadId?: unknown;
  load_id?: unknown;
  driverId?: unknown;
  driver_id?: unknown;
  farmerId?: unknown;
  farmer_id?: unknown;
  freightId?: unknown;
  freight_id?: unknown;
  customerId?: unknown;
  customer_id?: unknown;
  chatId?: unknown;
  chat_id?: unknown;
  conversationId?: unknown;
  conversation_id?: unknown;
  [key: string]: unknown;
};

export type NotificationRoute =
  | string
  | {
      pathname: string;
      params?: Record<string, string>;
    }
  | null;

type NotificationSubscription = {
  remove: () => void;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeType(value: unknown): string {
  return clean(value).toUpperCase();
}

function createStringParams(
  values: Record<string, unknown>
): Record<string, string> {
  const params: Record<string, string> = {};

  Object.entries(values).forEach(([key, value]) => {
    const cleanedValue = clean(value);

    if (cleanedValue) {
      params[key] = cleanedValue;
    }
  });

  return params;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<
  string | null
> {
  try {
    if (!Device.isDevice) {
      console.log(
        "Push notifications require a physical device."
      );

      return null;
    }

    const existingPermissions =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingPermissions.status;

    if (finalStatus !== "granted") {
      const requestedPermissions =
        await Notifications.requestPermissionsAsync();

      finalStatus = requestedPermissions.status;
    }

    if (finalStatus !== "granted") {
      console.log(
        "Push notification permission was not granted."
      );

      return null;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(
        "default",
        {
          name: "Farm2Home Notifications",
          importance:
            Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#2E7D32",
          sound: "default",
        }
      );
    }

    const tokenResponse =
      await Notifications.getExpoPushTokenAsync();

    return tokenResponse.data;
  } catch (error) {
    console.log(
      "Push notification registration error:",
      error
    );

    return null;
  }
}

export async function registerPushNotifications(): Promise<
  string | null
> {
  return registerForPushNotificationsAsync();
}

export async function registerDriverPushNotifications(): Promise<
  string | null
> {
  return registerForPushNotificationsAsync();
}

export async function registerFreightPushNotifications(): Promise<
  string | null
> {
  return registerForPushNotificationsAsync();
}

export async function sendLocalNotification(
  payload: LocalNotificationPayload
): Promise<boolean> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        sound:
          payload.sound === false
            ? undefined
            : "default",
      },
      trigger: null,
    });

    return true;
  } catch (error) {
    console.log(
      "Local notification error:",
      error
    );

    return false;
  }
}

export async function notifyAdminAlert(
  message = "An administrative alert requires attention.",
  data: NotificationData = {}
): Promise<boolean> {
  return sendLocalNotification({
    title: "Farm2Home Admin Alert",
    body: message,
    data: {
      ...data,
      type: "ADMIN_ALERT",
    },
  });
}

export async function notifyDeliveryCompleted(
  orderId = "",
  loadId = ""
): Promise<boolean> {
  return sendLocalNotification({
    title: "Delivery Completed",
    body: "The delivery has been completed.",
    data: {
      type: "ORDER_DELIVERED",
      orderId,
      loadId,
    },
  });
}

export async function notifyPickupCompleted(
  orderId = "",
  loadId = ""
): Promise<boolean> {
  return sendLocalNotification({
    title: "Pickup Completed",
    body: "The pickup has been completed.",
    data: {
      type: "PICKUP_COMPLETED",
      orderId,
      loadId,
    },
  });
}

export async function notifyNewFreightLoad(
  loadId = ""
): Promise<boolean> {
  return sendLocalNotification({
    title: "New Freight Load",
    body: "A new freight load is available.",
    data: {
      type: "NEW_FREIGHT_LOAD",
      loadId,
    },
  });
}

export async function notifyFreightLoadAvailable(
  loadId = ""
): Promise<boolean> {
  return sendLocalNotification({
    title: "Freight Load Available",
    body: "A freight load is available for assignment.",
    data: {
      type: "FREIGHT_LOAD_AVAILABLE",
      loadId,
    },
  });
}

export async function notifyDriverAcceptedLoad(
  driverId = "",
  loadId = ""
): Promise<boolean> {
  return sendLocalNotification({
    title: "Load Accepted",
    body: "A driver accepted the freight load.",
    data: {
      type: "DRIVER_ACCEPTED_LOAD",
      driverId,
      loadId,
    },
  });
}

export async function notifyDriverArrivedPickup(
  driverId = "",
  loadId = ""
): Promise<boolean> {
  return sendLocalNotification({
    title: "Driver Arrived at Pickup",
    body: "The driver has arrived at the pickup location.",
    data: {
      type: "DRIVER_ARRIVED_PICKUP",
      driverId,
      loadId,
    },
  });
}

export async function notifyDriverArrivedDropoff(
  driverId = "",
  loadId = ""
): Promise<boolean> {
  return sendLocalNotification({
    title: "Driver Arrived at Delivery",
    body: "The driver has arrived at the delivery location.",
    data: {
      type: "DRIVER_ARRIVED_DROPOFF",
      driverId,
      loadId,
    },
  });
}

export async function notifyLoadStatusUpdate(
  loadId = "",
  status = ""
): Promise<boolean> {
  return sendLocalNotification({
    title: "Load Status Updated",
    body: status
      ? `The load status is now ${status}.`
      : "The freight load status has been updated.",
    data: {
      type: "LOAD_STATUS_UPDATE",
      loadId,
      status,
    },
  });
}

export async function notifyLoadCancelled(
  loadId = ""
): Promise<boolean> {
  return sendLocalNotification({
    title: "Load Cancelled",
    body: "The freight load has been cancelled.",
    data: {
      type: "LOAD_CANCELLED",
      loadId,
    },
  });
}

export async function notifyColdChainAlert(
  loadId = "",
  message = "A cold-chain condition requires attention."
): Promise<boolean> {
  return sendLocalNotification({
    title: "Cold-Chain Alert",
    body: message,
    data: {
      type: "COLD_CHAIN_ALERT",
      loadId,
    },
  });
}

export async function notifyDriverGpsStale(
  driverId = "",
  loadId = ""
): Promise<boolean> {
  return sendLocalNotification({
    title: "Driver GPS Update Needed",
    body: "The driver's GPS location has not updated recently.",
    data: {
      type: "DRIVER_GPS_STALE",
      driverId,
      loadId,
    },
  });
}

export async function notifyOrderAccepted(
  orderId = "",
  loadId = ""
): Promise<boolean> {
  return sendLocalNotification({
    title: "Order Accepted",
    body: "Your order has been accepted.",
    data: {
      type: "ORDER_ACCEPTED",
      orderId,
      loadId,
    },
  });
}

export async function notifyOrderInTransit(
  orderId = "",
  loadId = ""
): Promise<boolean> {
  return sendLocalNotification({
    title: "Order In Transit",
    body: "Your order is now in transit.",
    data: {
      type: "ORDER_IN_TRANSIT",
      orderId,
      loadId,
    },
  });
}

export async function notifyOrderDelivered(
  orderId = "",
  loadId = ""
): Promise<boolean> {
  return sendLocalNotification({
    title: "Order Delivered",
    body: "Your order has been delivered.",
    data: {
      type: "ORDER_DELIVERED",
      orderId,
      loadId,
    },
  });
}

export async function notifyNewLocalDelivery(
  orderId = ""
): Promise<boolean> {
  return sendLocalNotification({
    title: "New Local Delivery",
    body: "A new local delivery is available.",
    data: {
      type: "NEW_LOCAL_DELIVERY",
      orderId,
    },
  });
}

export async function notifyDriverOrderAvailable(
  orderId = ""
): Promise<boolean> {
  return sendLocalNotification({
    title: "Delivery Order Available",
    body: "A delivery order is available for acceptance.",
    data: {
      type: "DRIVER_ORDER_AVAILABLE",
      orderId,
    },
  });
}

export async function notifyDriverAcceptedOrder(
  driverId = "",
  orderId = ""
): Promise<boolean> {
  return sendLocalNotification({
    title: "Delivery Order Accepted",
    body: "A driver accepted the delivery order.",
    data: {
      type: "DRIVER_ACCEPTED_ORDER",
      driverId,
      orderId,
    },
  });
}

export function addNotificationResponseListener(
  listener: (
    response: Notifications.NotificationResponse
  ) => void
): NotificationSubscription {
  return Notifications.addNotificationResponseReceivedListener(
    listener
  );
}

export function addNotificationReceivedListener(
  listener: (
    notification: Notifications.Notification
  ) => void
): NotificationSubscription {
  return Notifications.addNotificationReceivedListener(
    listener
  );
}

export async function clearBadgeCount(): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch (error) {
    console.log(
      "Unable to clear notification badge:",
      error
    );
  }
}

export function getNotificationRoute(
  rawData: NotificationRouteData | null | undefined
): NotificationRoute {
  const data = rawData ?? {};

  const type = normalizeType(data.type);

  const orderId = clean(
    data.orderId ?? data.order_id
  );

  const loadId = clean(
    data.loadId ?? data.load_id
  );

  const driverId = clean(
    data.driverId ?? data.driver_id
  );

  const chatId = clean(
    data.chatId ??
      data.chat_id ??
      data.conversationId ??
      data.conversation_id
  );

  switch (type) {
    case "ORDER_ACCEPTED":
    case "ORDER_IN_TRANSIT":
    case "ORDER_DELIVERED":
      return {
        pathname: "/customer/order-tracking",
        params: createStringParams({
          orderId,
          loadId,
        }),
      };

    case "NEW_CHAT_MESSAGE":
      return {
        pathname: "/chat/chat-center",
        params: createStringParams({
          chatId,
        }),
      };

    case "NEW_FREIGHT_LOAD":
    case "FREIGHT_LOAD_AVAILABLE":
      return "/freight/board";

    case "LOAD_STATUS_UPDATE":
    case "LOAD_CANCELLED":
    case "COLD_CHAIN_ALERT":
      return {
        pathname: "/freight/tracking",
        params: createStringParams({
          loadId,
        }),
      };

    case "DRIVER_ORDER_AVAILABLE":
    case "NEW_LOCAL_DELIVERY":
      return {
        pathname: "/driver/available-orders",
        params: createStringParams({
          orderId,
        }),
      };

    case "DRIVER_ACCEPTED_LOAD":
    case "DRIVER_ARRIVED_PICKUP":
    case "DRIVER_ARRIVED_DROPOFF":
    case "DRIVER_GPS_STALE":
      return {
        pathname: "/driver/live-deliveries",
        params: createStringParams({
          driverId,
          loadId,
        }),
      };

    case "AI_DISPATCH_COMPLETE":
      return "/ai/dispatch-intelligence-center";

    case "HIGH_DELAY_RISK":
    case "ADMIN_ALERT":
      return "/admin/dashboard";

    default:
      return null;
  }
}