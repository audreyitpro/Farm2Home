// app/services/orderService.ts

import { supabase } from "./supabaseClient";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "accepted"
  | "in_transit"
  | "delivered"
  | "cancelled"
  | "refunded";

export type OrderItemInput = {
  product_id?: string;
  product_name: string;
  farm_name?: string;
  price: number;
  quantity: number;
};

export type CreateOrderInput = {
  customer_id: string;
  customer_email?: string;
  subtotal: number;
  delivery_fee: number;
  tax: number;
  total: number;
  status?: OrderStatus;
  delivery_address?: string;
  delivery_notes?: string;
  items: OrderItemInput[];
};

export async function createOrder(input: CreateOrderInput) {
  const orderResult = await supabase
    .from("orders")
    .insert({
      customer_id: input.customer_id,
      customer_email: input.customer_email,
      subtotal: input.subtotal,
      delivery_fee: input.delivery_fee,
      tax: input.tax,
      total: input.total,
      status: input.status || "pending",
      delivery_address: input.delivery_address,
      delivery_notes: input.delivery_notes,
    })
    .select()
    .single();

  if (orderResult.error) {
    throw orderResult.error;
  }

  const order = orderResult.data;

  const orderItems = input.items.map((item) => ({
    order_id: order.id,
    product_id: item.product_id,
    product_name: item.product_name,
    farm_name: item.farm_name,
    price: item.price,
    quantity: item.quantity,
  }));

  const itemsResult = await supabase.from("order_items").insert(orderItems);

  if (itemsResult.error) {
    throw itemsResult.error;
  }

  return order;
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

  return result.data;
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
    .update({ status })
    .eq("id", orderId)
    .select()
    .single();

  if (result.error) {
    throw result.error;
  }

  return result.data;
}