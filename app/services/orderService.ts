// app/services/orderService.ts

import { API_BASE_URL } from "../config/api";
import { supabase } from "./supabaseClient";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "accepted"
  | "paid"
  | "preparing"
  | "ready_for_pickup"
  | "driver_assigned"
  | "picked_up"
  | "in_transit"
  | "delivered"
  | "cancelled"
  | "refunded";

export type OrderItemInput = {
  product_id?: string;
  product_name: string;
  farm_name?: string;
  farmer_id?: string;
  farmer_stripe_account_id?: string;
  price: number;
  quantity: number;
};

export type CreateOrderInput = {
  customer_id: string;
  customer_email?: string;
  customer_name?: string;
  farmer_id?: string;
  subtotal: number;
  delivery_fee: number;
  service_fee?: number;
  tax?: number;
  tip?: number;
  total: number;
  status?: OrderStatus;
  delivery_option?: "Delivery" | "Pickup" | string;
  delivery_address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  delivery_notes?: string;
  stripe_checkout_session_id?: string;
  stripe_payment_intent_id?: string;
  items: OrderItemInput[];
};

export async function createOrder(input: CreateOrderInput) {
  const orderResult = await supabase
    .from("orders")
    .insert({
      customer_id: input.customer_id,
      customer_email: input.customer_email || "",
      customer_name: input.customer_name || "",
      farmer_id: input.farmer_id || null,
      subtotal: Number(input.subtotal || 0),
      delivery_fee: Number(input.delivery_fee || 0),
      service_fee: Number(input.service_fee || 0),
      tax: Number(input.tax || 0),
      tip: Number(input.tip || 0),
      total: Number(input.total || 0),
      status: input.status || "pending",
      delivery_option: input.delivery_option || "Delivery",
      delivery_address: input.delivery_address || "",
      city: input.city || "",
      state: input.state || "",
      zip_code: input.zip_code || "",
      phone: input.phone || "",
      delivery_instructions: input.delivery_notes || "",
      stripe_checkout_session_id: input.stripe_checkout_session_id || "",
      stripe_payment_intent_id: input.stripe_payment_intent_id || "",
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (orderResult.error) {
    throw orderResult.error;
  }

  const order = orderResult.data;

  if (input.items.length > 0) {
    const orderItems = input.items.map((item) => ({
      order_id: order.id,
      product_id: item.product_id || null,
      product_name: item.product_name,
      farm_name: item.farm_name || "",
      farmer_id: item.farmer_id || input.farmer_id || null,
      farmer_stripe_account_id: item.farmer_stripe_account_id || "",
      price: Number(item.price || 0),
      quantity: Number(item.quantity || 0),
    }));

    const itemsResult = await supabase.from("order_items").insert(orderItems);

    if (itemsResult.error) {
      throw itemsResult.error;
    }
  }

  return order;
}

export async function createOrderThroughBackend(input: CreateOrderInput) {
  const response = await fetch(`${API_BASE_URL}/orders/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!response.ok || data.success === false) {
    throw new Error(data.error || "Unable to create order through backend.");
  }

  return data.order || data;
}

export async function getCustomerOrders(customerId: string) {
  const result = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (result.error) {
    throw result.error;
  }

  return result.data || [];
}

export async function getFarmerOrders(farmerId: string) {
  const result = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("farmer_id", farmerId)
    .order("created_at", { ascending: false });

  if (result.error) {
    throw result.error;
  }

  return result.data || [];
}

export async function getOrderById(orderId: string) {
  const result = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", orderId)
    .single();

  if (result.error) {
    throw result.error;
  }

  return result.data;
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const result = await supabase
    .from("orders")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .select()
    .single();

  if (result.error) {
    throw result.error;
  }

  return result.data;
}

export async function updateOrderStatusThroughBackend(
  orderId: string,
  status: OrderStatus
) {
  const response = await fetch(`${API_BASE_URL}/orders/${orderId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

  const data = await response.json();

  if (!response.ok || data.success === false) {
    throw new Error(data.error || "Unable to update order status.");
  }

  return data.order || data;
}