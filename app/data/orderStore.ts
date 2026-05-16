import AsyncStorage from "@react-native-async-storage/async-storage";

import { CartItem } from "./cartStore";

const ORDERS_KEY = "farm2homeOrders";
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

export type PaymentStatus =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "REFUNDED";

export type Farm2HomeOrder = {
  id: string;

  customerEmail: string;
  customerName?: string;

  items: CartItem[];

  subtotal: number;
  serviceFee?: number;
  deliveryFee: number;
  tip: number;
  total: number;

  deliveryInfo: DeliveryInfo;

  status: OrderStatus;
  paymentStatus?: PaymentStatus;

  stripeSessionId?: string;

  createdAt: string;
  updatedAt: string;
};

function safeJsonParse<T>(
  rawValue: string | null,
  fallback: T
): T {
  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch (error) {
    console.log("Order store parse error:", error);
    return fallback;
  }
}

function normalizeDeliveryInfo(
  info: any
): DeliveryInfo {
  return {
    deliveryAddress: info?.deliveryAddress || "",
    city: info?.city || "",
    state: info?.state || "",
    zipCode: info?.zipCode || "",
    phone: info?.phone || "",
    deliveryInstructions:
      info?.deliveryInstructions || "",
    deliveryOption:
      info?.deliveryOption === "Pickup"
        ? "Pickup"
        : "Delivery",
  };
}

function normalizeOrder(
  order: any
): Farm2HomeOrder {
  const now = new Date().toISOString();

  return {
    id: String(order?.id || `order_${Date.now()}`),

    customerEmail: String(
      order?.customerEmail || ""
    ).toLowerCase(),

    customerName: order?.customerName || "",

    items: Array.isArray(order?.items)
      ? order.items
      : [],

    subtotal: Number(order?.subtotal || 0),

    serviceFee:
      order?.serviceFee === undefined ||
      order?.serviceFee === null
        ? undefined
        : Number(order.serviceFee),

    deliveryFee: Number(
      order?.deliveryFee || 0
    ),

    tip: Number(order?.tip || 0),

    total: Number(order?.total || 0),

    deliveryInfo: normalizeDeliveryInfo(
      order?.deliveryInfo
    ),

    status:
      order?.status || "PENDING_PAYMENT",

    paymentStatus:
      order?.paymentStatus || "PENDING",

    stripeSessionId:
      order?.stripeSessionId || "",

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

export async function saveDeliveryInfo(
  info: DeliveryInfo
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      DELIVERY_INFO_KEY,
      JSON.stringify(
        normalizeDeliveryInfo(info)
      )
    );
  } catch (error) {
    console.log(
      "Save delivery info error:",
      error
    );
  }
}

export async function getDeliveryInfo(): Promise<DeliveryInfo | null> {
  try {
    const raw = await AsyncStorage.getItem(
      DELIVERY_INFO_KEY
    );

    const parsed =
      safeJsonParse<DeliveryInfo | null>(
        raw,
        null
      );

    return parsed
      ? normalizeDeliveryInfo(parsed)
      : null;
  } catch (error) {
    console.log(
      "Get delivery info error:",
      error
    );

    return null;
  }
}

export async function savePendingOrder(
  order: Farm2HomeOrder
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      PENDING_ORDER_KEY,
      JSON.stringify(normalizeOrder(order))
    );
  } catch (error) {
    console.log(
      "Save pending order error:",
      error
    );
  }
}

export async function getPendingOrder(): Promise<Farm2HomeOrder | null> {
  try {
    const raw = await AsyncStorage.getItem(
      PENDING_ORDER_KEY
    );

    const parsed =
      safeJsonParse<Farm2HomeOrder | null>(
        raw,
        null
      );

    return parsed
      ? normalizeOrder(parsed)
      : null;
  } catch (error) {
    console.log(
      "Get pending order error:",
      error
    );

    return null;
  }
}

export async function clearPendingOrder(): Promise<void> {
  try {
    await AsyncStorage.removeItem(
      PENDING_ORDER_KEY
    );
  } catch (error) {
    console.log(
      "Clear pending order error:",
      error
    );
  }
}

export async function getOrders(): Promise<Farm2HomeOrder[]> {
  try {
    const raw = await AsyncStorage.getItem(
      ORDERS_KEY
    );

    const parsed = safeJsonParse<any[]>(
      raw,
      []
    );

    return Array.isArray(parsed)
      ? parsed.map(normalizeOrder)
      : [];
  } catch (error) {
    console.log(
      "Error loading orders:",
      error
    );

    return [];
  }
}

export async function saveOrders(
  orders: Farm2HomeOrder[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      ORDERS_KEY,
      JSON.stringify(
        orders.map(normalizeOrder)
      )
    );
  } catch (error) {
    console.log(
      "Save orders error:",
      error
    );
  }
}

export async function addOrder(
  order: Farm2HomeOrder
): Promise<Farm2HomeOrder[]> {
  const orders = await getOrders();

  const normalizedOrder = normalizeOrder({
    ...order,
    status:
      order.status || "PENDING_PAYMENT",
    paymentStatus:
      order.paymentStatus || "PENDING",
    updatedAt: new Date().toISOString(),
  });

  const exists = orders.some(
    (item) => item.id === normalizedOrder.id
  );

  const updatedOrders = exists
    ? orders.map((item) =>
        item.id === normalizedOrder.id
          ? normalizedOrder
          : item
      )
    : [normalizedOrder, ...orders];

  await saveOrders(updatedOrders);

  return updatedOrders;
}

export async function createOrder(
  order: Farm2HomeOrder
): Promise<Farm2HomeOrder> {
  const updatedOrders = await addOrder(order);

  return (
    updatedOrders.find(
      (item) => item.id === order.id
    ) || updatedOrders[0]
  );
}

export async function confirmPendingOrderPaid(): Promise<Farm2HomeOrder | null> {
  const pendingOrder =
    await getPendingOrder();

  if (!pendingOrder) {
    return null;
  }

  const paidOrder: Farm2HomeOrder =
    normalizeOrder({
      ...pendingOrder,
      status: "PAID",
      paymentStatus: "PAID",
      updatedAt: new Date().toISOString(),
    });

  await addOrder(paidOrder);

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
          updatedAt:
            new Date().toISOString(),
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
          updatedAt:
            new Date().toISOString(),
        })
      : order
  );

  await saveOrders(updatedOrders);

  return updatedOrders;
}

export async function getCustomerOrders(
  customerEmail: string
): Promise<Farm2HomeOrder[]> {
  const orders = await getOrders();

  const cleanEmail = customerEmail
    .trim()
    .toLowerCase();

  return orders.filter(
    (order) =>
      order.customerEmail?.toLowerCase() ===
      cleanEmail
  );
}

export async function getOrdersByCustomerEmail(
  customerEmail: string
): Promise<Farm2HomeOrder[]> {
  return getCustomerOrders(customerEmail);
}

export async function getOrdersForFarmer(
  farmName: string
): Promise<Farm2HomeOrder[]> {
  const orders = await getOrders();

  const cleanFarmName = farmName
    .trim()
    .toLowerCase();

  return orders.filter((order) =>
    order.items.some(
      (item) =>
        item.farmName?.toLowerCase() ===
        cleanFarmName
    )
  );
}

export async function getDeliveryOrders(): Promise<Farm2HomeOrder[]> {
  const orders = await getOrders();

  return orders.filter(
    (order) =>
      order.deliveryInfo
        .deliveryOption === "Delivery" &&
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
      order.deliveryInfo
        .deliveryOption === "Pickup" &&
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

export async function cancelOrder(
  orderId: string
) {
  return updateOrderStatus(
    orderId,
    "CANCELLED"
  );
}

export async function markOrderDelivered(
  orderId: string
) {
  return updateOrderStatus(
    orderId,
    "DELIVERED"
  );
}

export async function markOrderPreparing(
  orderId: string
) {
  return updateOrderStatus(
    orderId,
    "PREPARING"
  );
}

export async function markOrderReady(
  orderId: string
) {
  return updateOrderStatus(
    orderId,
    "READY_FOR_PICKUP"
  );
}

export async function markOrderPickedUp(
  orderId: string
) {
  return updateOrderStatus(
    orderId,
    "PICKED_UP"
  );
}

export async function markOrderInTransit(
  orderId: string
) {
  return updateOrderStatus(
    orderId,
    "IN_TRANSIT"
  );
}

/**
 * Backward-compatible aliases.
 */
export const setOrderStatus =
  updateOrderStatus;

export const setOrderPaymentStatus =
  updateOrderPaymentStatus;