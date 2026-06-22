// services/orderService.ts

import { supabase } from "../data/supabaseClient";

export type CartItem = {
  id: string;
  product_id: string;
  farmer_id: string;
  farmer_name?: string;
  name: string;
  photo_url?: string | null;
  price: number;
  unit?: string | null;
  quantity: number;
};

export type CustomerOrderPayload = {
  customer_id: string;
  customer_email?: string;
  delivery_address?: string;
  delivery_city?: string;
  delivery_state?: string;
  delivery_zip?: string;
  delivery_instructions?: string;
  preferred_delivery_option?: string;
  payment_intent_id?: string | null;
  stripe_checkout_session_id?: string | null;
};

export type FarmerOrderGroup = {
  farmer_id: string;
  farmer_name?: string;
  items: CartItem[];
  subtotal: number;
  platform_fee: number;
  farmer_payout_amount: number;
  total: number;
};

const PLATFORM_FEE_RATE = 0.04;

function money(value: number): number {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function generateOrderNumber(prefix = "ORDER"): string {
  const now = Date.now();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}_${now}_${random}`;
}

export function splitFarmerOrders(cartItems: CartItem[]): FarmerOrderGroup[] {
  const grouped: Record<string, FarmerOrderGroup> = {};

  for (const item of cartItems) {
    if (!item.farmer_id) {
      throw new Error(`Product ${item.name} is missing farmer_id.`);
    }

    const lineTotal = money(Number(item.price) * Number(item.quantity));

    if (!grouped[item.farmer_id]) {
      grouped[item.farmer_id] = {
        farmer_id: item.farmer_id,
        farmer_name: item.farmer_name,
        items: [],
        subtotal: 0,
        platform_fee: 0,
        farmer_payout_amount: 0,
        total: 0,
      };
    }

    grouped[item.farmer_id].items.push(item);
    grouped[item.farmer_id].subtotal = money(grouped[item.farmer_id].subtotal + lineTotal);
  }

  return Object.values(grouped).map((group) => {
    const platformFee = money(group.subtotal * PLATFORM_FEE_RATE);
    return {
      ...group,
      platform_fee: platformFee,
      farmer_payout_amount: money(group.subtotal - platformFee),
      total: group.subtotal,
    };
  });
}

export async function createOrder(
  customer: CustomerOrderPayload,
  cartItems: CartItem[]
) {
  if (!customer?.customer_id) {
    throw new Error("Missing customer_id.");
  }

  if (!cartItems?.length) {
    throw new Error("Cart is empty.");
  }

  const farmerGroups = splitFarmerOrders(cartItems);
  const parentOrderNumber = generateOrderNumber("CUSTOMER_ORDER");

  const grandSubtotal = money(
    farmerGroups.reduce((sum, group) => sum + group.subtotal, 0)
  );

  const totalPlatformFee = money(
    farmerGroups.reduce((sum, group) => sum + group.platform_fee, 0)
  );

  const grandTotal = grandSubtotal;

  const { data: parentOrder, error: parentError } = await supabase
    .from("orders")
    .insert({
      order_number: parentOrderNumber,
      parent_order_id: null,

      customer_id: customer.customer_id,
      customer_email: customer.customer_email ?? null,

      farmer_id: null,
      order_type: "customer_multi_farmer",

      subtotal: grandSubtotal,
      platform_fee: totalPlatformFee,
      farmer_payout_amount: money(grandSubtotal - totalPlatformFee),
      total_amount: grandTotal,

      payment_intent_id: customer.payment_intent_id ?? null,
      stripe_checkout_session_id: customer.stripe_checkout_session_id ?? null,
      payment_status: "paid",

      order_status: "pending",
      fulfillment_status: "pending",

      delivery_address: customer.delivery_address ?? null,
      delivery_city: customer.delivery_city ?? null,
      delivery_state: customer.delivery_state ?? null,
      delivery_zip: customer.delivery_zip ?? null,
      delivery_instructions: customer.delivery_instructions ?? null,
      preferred_delivery_option: customer.preferred_delivery_option ?? null,

      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (parentError) throw parentError;

  const createdFarmerOrders = [];

  for (const group of farmerGroups) {
    const childOrderNumber = generateOrderNumber("FARMER_ORDER");

    const { data: farmerOrder, error: farmerOrderError } = await supabase
      .from("orders")
      .insert({
        order_number: childOrderNumber,
        parent_order_id: parentOrder.id,

        customer_id: customer.customer_id,
        customer_email: customer.customer_email ?? null,

        farmer_id: group.farmer_id,
        farmer_name: group.farmer_name ?? null,
        order_type: "farmer_split_order",

        subtotal: group.subtotal,
        platform_fee: group.platform_fee,
        farmer_payout_amount: group.farmer_payout_amount,
        total_amount: group.total,

        payment_intent_id: customer.payment_intent_id ?? null,
        stripe_checkout_session_id: customer.stripe_checkout_session_id ?? null,
        payment_status: "paid",

        order_status: "pending",
        fulfillment_status: "pending",

        delivery_address: customer.delivery_address ?? null,
        delivery_city: customer.delivery_city ?? null,
        delivery_state: customer.delivery_state ?? null,
        delivery_zip: customer.delivery_zip ?? null,
        delivery_instructions: customer.delivery_instructions ?? null,
        preferred_delivery_option: customer.preferred_delivery_option ?? null,

        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (farmerOrderError) throw farmerOrderError;

    const orderItems = group.items.map((item) => ({
      order_id: farmerOrder.id,
      parent_order_id: parentOrder.id,

      customer_id: customer.customer_id,
      farmer_id: group.farmer_id,

      product_id: item.product_id,
      product_name: item.name,
      product_photo_url: item.photo_url ?? null,
      unit: item.unit ?? null,

      quantity: item.quantity,
      price_each: money(item.price),
      line_total: money(item.price * item.quantity),

      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { error: itemError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemError) throw itemError;

    await createFarmerPayoutRecords({
      order_id: farmerOrder.id,
      parent_order_id: parentOrder.id,
      farmer_id: group.farmer_id,
      customer_id: customer.customer_id,
      subtotal: group.subtotal,
      platform_fee: group.platform_fee,
      payout_amount: group.farmer_payout_amount,
      payment_intent_id: customer.payment_intent_id ?? null,
    });

    createdFarmerOrders.push(farmerOrder);
  }

  return {
    parentOrder,
    farmerOrders: createdFarmerOrders,
    farmerGroups,
    totals: {
      subtotal: grandSubtotal,
      platform_fee: totalPlatformFee,
      total: grandTotal,
    },
  };
}

export async function loadCustomerOrders(customerId: string) {
  if (!customerId) throw new Error("Missing customerId.");

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("customer_id", customerId)
    .is("parent_order_id", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function loadOrderDetails(orderId: string) {
  if (!orderId) throw new Error("Missing orderId.");

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (orderError) throw orderError;

  const { data: childOrders, error: childError } = await supabase
    .from("orders")
    .select("*")
    .eq("parent_order_id", orderId)
    .order("created_at", { ascending: true });

  if (childError) throw childError;

  const childOrderIds = (childOrders ?? []).map((o) => o.id);
  const itemOrderIds = childOrderIds.length ? childOrderIds : [orderId];

  const { data: items, error: itemError } = await supabase
    .from("order_items")
    .select("*")
    .in("order_id", itemOrderIds)
    .order("created_at", { ascending: true });

  if (itemError) throw itemError;

  return {
    order,
    farmerOrders: childOrders ?? [],
    items: items ?? [],
  };
}

export async function loadTracking(orderId: string) {
  if (!orderId) throw new Error("Missing orderId.");

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, parent_order_id, customer_id, farmer_id, order_status, fulfillment_status, delivery_address, delivery_city, delivery_state, delivery_zip, updated_at"
    )
    .or(`id.eq.${orderId},parent_order_id.eq.${orderId}`)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function updateOrderStatus(
  orderId: string,
  status: string,
  fulfillmentStatus?: string
) {
  if (!orderId) throw new Error("Missing orderId.");

  const updatePayload: Record<string, any> = {
    order_status: status,
    updated_at: new Date().toISOString(),
  };

  if (fulfillmentStatus) {
    updatePayload.fulfillment_status = fulfillmentStatus;
  }

  const { data, error } = await supabase
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function createFarmerPayoutRecords(payload: {
  order_id: string;
  parent_order_id: string;
  farmer_id: string;
  customer_id: string;
  subtotal: number;
  platform_fee: number;
  payout_amount: number;
  payment_intent_id?: string | null;
}) {
  const { error } = await supabase.from("farmer_payouts").insert({
    order_id: payload.order_id,
    parent_order_id: payload.parent_order_id,
    farmer_id: payload.farmer_id,
    customer_id: payload.customer_id,

    gross_amount: money(payload.subtotal),
    platform_fee: money(payload.platform_fee),
    payout_amount: money(payload.payout_amount),

    payment_intent_id: payload.payment_intent_id ?? null,
    payout_status: "pending",

    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.warn("Farmer payout record was not created:", error.message);
  }
}