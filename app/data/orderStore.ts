import AsyncStorage from "@react-native-async-storage/async-storage";

import { CartItem } from "./cartStore";

const ORDERS_KEY = "farm2homeOrders";
const CUSTOMER_ORDERS_KEY = "farm2homeCustomerOrders";
const DELIVERY_INFO_KEY = "farm2homeDeliveryInfo";
const PENDING_ORDER_KEY = "farm2homePendingOrder";

export type DeliveryOption = "Delivery" | "Pickup";

export type DeliveryInfo = {
  deliveryAddress: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  deliveryInstructions: string;
  deliveryOption: DeliveryOption;
};

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "ACCEPTED"
  | "PREPARING"
  | "READY"
  | "READY_FOR_PICKUP"
  | "DRIVER_ASSIGNED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export type Farm2HomeOrder = {
  id: string;
  customerEmail: string;
  customerName?: string;
  customerId?: string;
  items: CartItem[];
  subtotal: number;
  serviceFee?: number;
  deliveryFee: number;
  tip: number;
  total: number;
  deliveryInfo: DeliveryInfo;
  status: OrderStatus;
  fulfillmentStatus?: string;
  paymentStatus?: PaymentStatus | string;
  stripeSessionId?: string;
  createdAt: string;
  updatedAt: string;
};

function safeJsonParse<T>(rawValue: string | null, fallback: T): T {
  if (!rawValue) return fallback;

  try {
    return JSON.parse(rawValue) as T;
  } catch (error) {
    console.log("Order store parse error:", error);
    return fallback;
  }
}

function normalizeDeliveryInfo(info: any): DeliveryInfo {
  return {
    deliveryAddress: info?.deliveryAddress || info?.delivery_address || "",
    city: info?.city || "",
    state: info?.state || "",
    zipCode: info?.zipCode || info?.zip_code || "",
    phone: info?.phone || "",
    deliveryInstructions:
      info?.deliveryInstructions || info?.delivery_instructions || "",
    deliveryOption: info?.deliveryOption === "Pickup" ? "Pickup" : "Delivery",
  };
}

function normalizePaymentStatus(value: any): PaymentStatus | string {
  const status = String(value || "PENDING").toUpperCase();

  if (status === "PAID") return "PAID";
  if (status === "FAILED") return "FAILED";
  if (status === "REFUNDED") return "REFUNDED";

  return "PENDING";
}

function normalizeOrderStatus(value: any): OrderStatus {
  const status = String(value || "PENDING_PAYMENT").toUpperCase();

  const allowed: OrderStatus[] = [
    "PENDING_PAYMENT",
    "PAID",
    "ACCEPTED",
    "PREPARING",
    "READY",
    "READY_FOR_PICKUP",
    "DRIVER_ASSIGNED",
    "PICKED_UP",
    "IN_TRANSIT",
    "DELIVERED",
    "CANCELLED",
    "REFUNDED",
  ];

  return allowed.includes(status as OrderStatus)
    ? (status as OrderStatus)
    : "PENDING_PAYMENT";
}

function normalizeOrder(order: any): Farm2HomeOrder {
  const now = new Date().toISOString();

  return {
    ...order,
    id: String(order?.id || order?.orderId || `order_${Date.now()}`),
    customerEmail: String(
      order?.customerEmail || order?.customer_email || ""
    ).toLowerCase(),
    customerName: order?.customerName || order?.customer_name || "",
    customerId: order?.customerId || order?.customer_id || "",
    items: Array.isArray(order?.items) ? order.items : [],
    subtotal: Number(order?.subtotal || 0),
    serviceFee:
      order?.serviceFee === undefined || order?.serviceFee === null
        ? undefined
        : Number(order.serviceFee),
    deliveryFee: Number(order?.deliveryFee || order?.delivery_fee || 0),
    tip: Number(order?.tip || 0),
    total: Number(order?.total || 0),
    deliveryInfo: normalizeDeliveryInfo(order?.deliveryInfo || order?.delivery_info),
    status: normalizeOrderStatus(order?.status),
    fulfillmentStatus:
      order?.fulfillmentStatus || order?.fulfillment_status || "ORDER_PLACED",
    paymentStatus: normalizePaymentStatus(order?.paymentStatus || order?.payment_status),
    stripeSessionId: order?.stripeSessionId || order?.stripe_session_id || "",
    createdAt:
      order?.createdAt ||
      order?.created_at ||
      order?.createDate ||
      order?.date ||
      now,
    updatedAt:
      order?.updatedAt ||
      order?.updated_at ||
      order?.updatedDate ||
      now,
  };
}

async function readOrdersFromKey(key: string): Promise<Farm2HomeOrder[]> {
  const raw = await AsyncStorage.getItem(key);
  const parsed = safeJsonParse<any[]>(raw, []);
  return Array.isArray(parsed) ? parsed.map(normalizeOrder) : [];
}

async function writeOrdersToKey(key: string, orders: Farm2HomeOrder[]) {
  await AsyncStorage.setItem(key, JSON.stringify(orders.map(normalizeOrder)));
}

export async function saveDeliveryInfo(info: DeliveryInfo): Promise<void> {
  try {
    await AsyncStorage.setItem(
      DELIVERY_INFO_KEY,
      JSON.stringify(normalizeDeliveryInfo(info))
    );
  } catch (error) {
    console.log("Save delivery info error:", error);
  }
}

export async function getDeliveryInfo(): Promise<DeliveryInfo | null> {
  try {
    const raw = await AsyncStorage.getItem(DELIVERY_INFO_KEY);
    const parsed = safeJsonParse<DeliveryInfo | null>(raw, null);
    return parsed ? normalizeDeliveryInfo(parsed) : null;
  } catch (error) {
    console.log("Get delivery info error:", error);
    return null;
  }
}

export async function savePendingOrder(order: Farm2HomeOrder): Promise<void> {
  try {
    await AsyncStorage.setItem(
      PENDING_ORDER_KEY,
      JSON.stringify(normalizeOrder(order))
    );
  } catch (error) {
    console.log("Save pending order error:", error);
  }
}

export async function getPendingOrder(): Promise<Farm2HomeOrder | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_ORDER_KEY);
    const parsed = safeJsonParse<Farm2HomeOrder | null>(raw, null);
    return parsed ? normalizeOrder(parsed) : null;
  } catch (error) {
    console.log("Get pending order error:", error);
    return null;
  }
}

export async function clearPendingOrder(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_ORDER_KEY);
  } catch (error) {
    console.log("Clear pending order error:", error);
  }
}

export async function getOrders(): Promise<Farm2HomeOrder[]> {
  try {
    const mainOrders = await readOrdersFromKey(ORDERS_KEY);
    const customerOrders = await readOrdersFromKey(CUSTOMER_ORDERS_KEY);

    const combined = [...customerOrders, ...mainOrders];

    const unique = Array.from(
      new Map(combined.map((order) => [order.id, normalizeOrder(order)])).values()
    );

    unique.sort((a, b) => {
      const aDate = new Date(a.createdAt || a.updatedAt).getTime();
      const bDate = new Date(b.createdAt || b.updatedAt).getTime();
      return bDate - aDate;
    });

    return unique;
  } catch (error) {
    console.log("Error loading orders:", error);
    return [];
  }
}

export async function saveOrders(orders: Farm2HomeOrder[]): Promise<void> {
  try {
    const cleanOrders = orders.map(normalizeOrder);
    await writeOrdersToKey(ORDERS_KEY, cleanOrders);
    await writeOrdersToKey(CUSTOMER_ORDERS_KEY, cleanOrders);
  } catch (error) {
    console.log("Save orders error:", error);
  }
}

export async function saveOrder(order: Farm2HomeOrder | any): Promise<Farm2HomeOrder[]> {
  const orders = await getOrders();
  const normalizedOrder = normalizeOrder(order);

  const updatedOrders = [
    normalizedOrder,
    ...orders.filter((item) => item.id !== normalizedOrder.id),
  ];

  await saveOrders(updatedOrders);
  await AsyncStorage.setItem("lastCustomerOrder", JSON.stringify(normalizedOrder));
  await AsyncStorage.setItem(
    `farm2home_order_${normalizedOrder.id}`,
    JSON.stringify(normalizedOrder)
  );

  return updatedOrders;
}

export async function addOrder(order: Farm2HomeOrder): Promise<Farm2HomeOrder[]> {
  return saveOrder({
    ...order,
    status: order.status || "PENDING_PAYMENT",
    paymentStatus: order.paymentStatus || "PENDING",
    updatedAt: new Date().toISOString(),
  });
}

export async function createOrder(order: Farm2HomeOrder): Promise<Farm2HomeOrder> {
  const updatedOrders = await addOrder(order);
  return updatedOrders.find((item) => item.id === order.id) || updatedOrders[0];
}

export async function confirmPendingOrderPaid(): Promise<Farm2HomeOrder | null> {
  const pendingOrder = await getPendingOrder();

  if (!pendingOrder) return null;

  const paidOrder = normalizeOrder({
    ...pendingOrder,
    status: "PAID",
    paymentStatus: "PAID",
    fulfillmentStatus: "ORDER_PLACED",
    updatedAt: new Date().toISOString(),
  });

  await saveOrder(paidOrder);
  await clearPendingOrder();

  return paidOrder;
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<Farm2HomeOrder[]> {
  const orders = await getOrders();

  const updatedOrders = orders.map((order) =>
    order.id === orderId
      ? normalizeOrder({
          ...order,
          status,
          updatedAt: new Date().toISOString(),
        })
      : order
  );

  await saveOrders(updatedOrders);
  return updatedOrders;
}

export async function updateOrderPaymentStatus(
  orderId: string,
  paymentStatus: PaymentStatus
): Promise<Farm2HomeOrder[]> {
  const orders = await getOrders();

  const updatedOrders = orders.map((order) =>
    order.id === orderId
      ? normalizeOrder({
          ...order,
          paymentStatus,
          updatedAt: new Date().toISOString(),
        })
      : order
  );

  await saveOrders(updatedOrders);
  return updatedOrders;
}

export async function getCustomerOrders(customerEmail: string): Promise<Farm2HomeOrder[]> {
  const orders = await getOrders();
  const cleanEmail = customerEmail.trim().toLowerCase();

  return orders.filter((order) => order.customerEmail?.toLowerCase() === cleanEmail);
}

export async function getOrdersByCustomerEmail(
  customerEmail: string
): Promise<Farm2HomeOrder[]> {
  return getCustomerOrders(customerEmail);
}

export async function getOrdersForFarmer(farmName: string): Promise<Farm2HomeOrder[]> {
  const orders = await getOrders();
  const cleanFarmName = farmName.trim().toLowerCase();

  return orders.filter((order) =>
    order.items.some(
      (item: any) =>
        item.farmName?.toLowerCase() === cleanFarmName ||
        item.farmerName?.toLowerCase() === cleanFarmName
    )
  );
}

export async function getDeliveryOrders(): Promise<Farm2HomeOrder[]> {
  const orders = await getOrders();

  return orders.filter(
    (order) =>
      order.deliveryInfo.deliveryOption === "Delivery" &&
      [
        "PAID",
        "ACCEPTED",
        "PREPARING",
        "READY",
        "READY_FOR_PICKUP",
        "DRIVER_ASSIGNED",
        "PICKED_UP",
        "IN_TRANSIT",
      ].includes(order.status)
  );
}

export async function getPickupOrders(): Promise<Farm2HomeOrder[]> {
  const orders = await getOrders();

  return orders.filter(
    (order) =>
      order.deliveryInfo.deliveryOption === "Pickup" &&
      [
        "PAID",
        "ACCEPTED",
        "PREPARING",
        "READY",
        "READY_FOR_PICKUP",
        "PICKED_UP",
      ].includes(order.status)
  );
}

export async function cancelOrder(orderId: string) {
  return updateOrderStatus(orderId, "CANCELLED");
}

export async function markOrderDelivered(orderId: string) {
  return updateOrderStatus(orderId, "DELIVERED");
}

export async function markOrderPreparing(orderId: string) {
  return updateOrderStatus(orderId, "PREPARING");
}

export async function markOrderReady(orderId: string) {
  return updateOrderStatus(orderId, "READY_FOR_PICKUP");
}

export async function markOrderPickedUp(orderId: string) {
  return updateOrderStatus(orderId, "PICKED_UP");
}

export async function markOrderInTransit(orderId: string) {
  return updateOrderStatus(orderId, "IN_TRANSIT");
}

export const setOrderStatus = updateOrderStatus;
export const setOrderPaymentStatus = updateOrderPaymentStatus;