// app/services/notificationService.ts

export async function registerForPushNotificationsAsync() {
  return null;
}

export async function registerPushNotifications() {
  return null;
}

export async function registerDriverPushNotifications() {
  return null;
}

export async function registerFreightPushNotifications() {
  return null;
}

export async function sendLocalNotification() {
  return true;
}

export async function notifyAdminAlert() {
  return true;
}

export async function notifyDeliveryCompleted() {
  return true;
}

export async function notifyPickupCompleted() {
  return true;
}

export async function notifyNewFreightLoad() {
  return true;
}

export async function notifyFreightLoadAvailable() {
  return true;
}

export async function notifyDriverAcceptedLoad() {
  return true;
}

export async function notifyDriverArrivedPickup() {
  return true;
}

export async function notifyDriverArrivedDropoff() {
  return true;
}

export async function notifyLoadStatusUpdate() {
  return true;
}

export async function notifyLoadCancelled() {
  return true;
}

export async function notifyColdChainAlert() {
  return true;
}

export async function notifyDriverGpsStale() {
  return true;
}

export async function notifyOrderAccepted() {
  return true;
}

export async function notifyOrderInTransit() {
  return true;
}

export async function notifyOrderDelivered() {
  return true;
}

export async function notifyNewLocalDelivery() {
  return true;
}

export async function notifyDriverOrderAvailable() {
  return true;
}

export async function notifyDriverAcceptedOrder() {
  return true;
}

export function addNotificationResponseListener() {
  return { remove: () => {} };
}

export function addNotificationReceivedListener() {
  return { remove: () => {} };
}

export async function clearBadgeCount() {
  return;
}

export function getNotificationRoute() {
  return null;
}