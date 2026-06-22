// app/customer/checkout.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL, APP_URL } from "../config/api";
import { CartItem, clearCart, getCart } from "../data/cartStore";
import {
  DeliveryInfo,
  Farm2HomeOrder,
  saveDeliveryInfo,
  savePendingOrder,
} from "../data/orderStore";
import { supabase } from "../data/supabaseClient";

/**
 * app/customer/checkout.tsx
 *
 * Full corrected checkout workflow.
 *
 * Fixes:
 * - Updated Grocerly/Farm2Home UI.
 * - Verifies customer membership with real cus_ and sub_ IDs.
 * - Loads cart snapshot from cart.tsx or current cartStore.
 * - Groups order by farmer.
 * - Preserves farmer Stripe payout IDs on every line item.
 * - Supports Delivery / Pickup.
 * - Creates pending order locally and attempts Supabase order/order_items saves.
 * - Creates driver jobs for delivery orders.
 * - Creates freight loads for livestock/hay/heavy freight items.
 * - Opens backend Stripe marketplace checkout.
 * - Sends full payout split data to backend.
 */

const SERVICE_FEE_RATE = 0.04;

const COLORS = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  redDark: "#9F1117",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  greenDark: "#14532D",
  greenSoft: "#DCFCE7",
  amber: "#F59E0B",
  amberSoft: "#FEF3C7",
  blue: "#2563EB",
  blueSoft: "#DBEAFE",
  danger: "#DC2626",
  dangerSoft: "#FEE2E2",
  white: "#FFFFFF",
};

type CurrentCustomer = {
  id?: string;
  customerId?: string;
  customer_id?: string;
  account_id?: string;
  accountId?: string;
  email?: string;
  fullName?: string;
  full_name?: string;
  name?: string;
  phone?: string;
  stripe_customer_id?: string;
  stripeCustomerId?: string;
  subscription_id?: string;
  subscriptionId?: string;
  stripe_subscription_id?: string;
  stripeSubscriptionId?: string;
  membership_status?: string;
  membershipStatus?: string;
  subscription_status?: string;
  subscriptionStatus?: string;
  account_active?: boolean;
  accountActive?: boolean;
};

type CartGroup = {
  farmKey: string;
  farmName: string;
  farmerId: string;
  farmerStripeAccountId: string;
  items: CartItem[];
  farmSubtotal: number;
  itemCount: number;
  freightRequired: boolean;
  driverPayout: number;
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function isCus(value: any) {
  return clean(value).startsWith("cus_");
}

function isSub(value: any) {
  return clean(value).startsWith("sub_");
}

function isAcct(value: any) {
  return clean(value).startsWith("acct_");
}

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function parseJSON(raw: string | null) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getCustomerId(customer: CurrentCustomer | null) {
  return clean(customer?.id || customer?.customer_id || customer?.customerId);
}

function getCustomerName(customer: CurrentCustomer | null) {
  return clean(customer?.fullName || customer?.full_name || customer?.name || "Farm2Home Customer");
}

function getStripeCustomer(customer: CurrentCustomer | null) {
  return clean(customer?.stripe_customer_id || customer?.stripeCustomerId);
}

function getStripeSubscription(customer: CurrentCustomer | null) {
  return clean(
    customer?.subscription_id ||
      customer?.subscriptionId ||
      customer?.stripe_subscription_id ||
      customer?.stripeSubscriptionId
  );
}

function statusBlocked(value: any) {
  return ["canceled", "cancelled", "unpaid", "inactive", "disabled", "rejected"].includes(
    normalize(value)
  );
}

function customerReady(customer: CurrentCustomer | null) {
  const membershipStatus = normalize(
    customer?.membership_status ||
      customer?.membershipStatus ||
      customer?.subscription_status ||
      customer?.subscriptionStatus
  );

  const hasActiveStatus =
    ["active", "trialing", "past_due"].includes(membershipStatus) ||
    customer?.account_active === true ||
    customer?.accountActive === true;

  return Boolean(
    getCustomerId(customer) &&
      isCus(getStripeCustomer(customer)) &&
      isSub(getStripeSubscription(customer)) &&
      hasActiveStatus &&
      !statusBlocked(customer?.membership_status || customer?.membershipStatus) &&
      !statusBlocked(customer?.subscription_status || customer?.subscriptionStatus)
  );
}

function getItemId(item: any) {
  return clean(item.id || item.cartItemId || item.productId || "");
}

function getProductId(item: any) {
  return clean(item.productId || item.product_id || item.id || "");
}

function getItemName(item: any) {
  return clean(item.name || item.productName || item.product_name || "Farm Product");
}

function getItemImage(item: any) {
  return clean(item.image || item.imageUrl || item.image_url || "");
}

function getFarmName(item: any) {
  return clean(item.farmName || item.farmerName || item.farm_name || "Farm2Home Farm");
}

function getFarmerId(item: any) {
  return clean(item.farmerId || item.farmer_id || item.farmId || "");
}

function getFarmerStripeAccountId(item: any) {
  return clean(
    item.farmerStripeAccountId ||
      item.stripeAccountId ||
      item.farmer_stripe_account_id ||
      item.stripe_account_id ||
      ""
  );
}

function getQuantity(item: any) {
  const quantity = Number(item.quantity || 0);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
}

function getPrice(item: any) {
  const price = Number(item.price || item.unit_price || 0);
  return Number.isFinite(price) ? price : 0;
}

function getLineTotal(item: any) {
  return getPrice(item) * getQuantity(item);
}

function normalizeCartItem(item: any) {
  const farmerStripeAccountId = getFarmerStripeAccountId(item);

  return {
    ...item,
    id: getItemId(item),
    cartItemId: getItemId(item),
    productId: getProductId(item),
    product_id: getProductId(item),
    name: getItemName(item),
    productName: getItemName(item),
    product_name: getItemName(item),
    price: getPrice(item),
    unit_price: getPrice(item),
    quantity: getQuantity(item),
    lineTotal: getLineTotal(item),
    line_total: getLineTotal(item),
    image: getItemImage(item),
    imageUrl: getItemImage(item),
    image_url: getItemImage(item),
    farmName: getFarmName(item),
    farm_name: getFarmName(item),
    farmerName: getFarmName(item),
    farmerId: getFarmerId(item),
    farmer_id: getFarmerId(item),
    farmerStripeAccountId,
    farmer_stripe_account_id: farmerStripeAccountId,
    stripeAccountId: farmerStripeAccountId,
    stripe_account_id: farmerStripeAccountId,
    unit: clean(item.unit || "each"),
    category: clean(item.category || ""),
    stock: Number(item.stock || 0),
    farmAddress: clean(item.farmAddress || item.pickupAddress || item.pickup_address || item.farmLocation || ""),
    pickupAddress: clean(item.pickupAddress || item.pickup_address || item.farmAddress || item.farmLocation || ""),
    distanceMiles: Number(item.distanceMiles || item.distance_miles || item.miles || 0),
  };
}

function isFreightEligibleItem(item: any) {
  const name = normalize(item.name || item.productName);
  const category = normalize(item.category);

  return (
    name.includes("livestock") ||
    name.includes("cattle") ||
    name.includes("cow") ||
    name.includes("goat") ||
    name.includes("pig") ||
    name.includes("sheep") ||
    name.includes("horse") ||
    name.includes("bale") ||
    name.includes("hay") ||
    category.includes("livestock") ||
    category.includes("hay") ||
    category.includes("feed")
  );
}

function calculateDriverPayout(miles: number, farmSubtotal: number) {
  const base = miles > 20 ? 25 : miles > 10 ? 18 : miles > 5 ? 12 : 8;
  return Number((base + farmSubtotal * 0.02).toFixed(2));
}

function groupCartByFarm(cart: CartItem[]): CartGroup[] {
  const grouped: Record<string, CartGroup> = {};

  cart.forEach((rawItem: any) => {
    const item = normalizeCartItem(rawItem);
    const farmerId = getFarmerId(item);
    const farmName = getFarmName(item);
    const farmerStripeAccountId = getFarmerStripeAccountId(item);
    const farmKey = farmerId || farmName;
    const lineTotal = getLineTotal(item);

    if (!grouped[farmKey]) {
      grouped[farmKey] = {
        farmKey,
        farmName,
        farmerId,
        farmerStripeAccountId,
        items: [],
        farmSubtotal: 0,
        itemCount: 0,
        freightRequired: false,
        driverPayout: 0,
      };
    }

    grouped[farmKey].items.push(item);
    grouped[farmKey].farmSubtotal += lineTotal;
    grouped[farmKey].itemCount += getQuantity(item);
    grouped[farmKey].freightRequired = grouped[farmKey].freightRequired || isFreightEligibleItem(item);
  });

  return Object.values(grouped).map((group) => {
    const firstItem: any = group.items[0] || {};
    const miles = Number(firstItem.distanceMiles || firstItem.miles || 0);
    return {
      ...group,
      driverPayout: calculateDriverPayout(miles, group.farmSubtotal),
    };
  });
}

async function parseApiResponse(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { success: false, error: text || "Invalid backend response." };
  }
}

async function openStripeUrl(url: string) {
  if (!url || !url.startsWith("http")) {
    Alert.alert("Stripe Error", "No valid Stripe checkout URL was returned.");
    return;
  }

  if (Platform.OS === "web") {
    window.location.href = url;
    return;
  }

  await WebBrowser.openBrowserAsync(url);
}

export default function CustomerCheckout() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<CurrentCustomer | null>(null);
  const [loading, setLoading] = useState(false);
  const [screenLoading, setScreenLoading] = useState(true);
  const [accessAllowed, setAccessAllowed] = useState(false);

  const [deliveryOption, setDeliveryOption] = useState<"Delivery" | "Pickup">("Delivery");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateValue, setStateValue] = useState("MI");
  const [zipCode, setZipCode] = useState("");
  const [phone, setPhone] = useState("");
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [tip, setTip] = useState("0");

  useFocusEffect(
    useCallback(() => {
      loadCheckoutScreen();
    }, [])
  );

  async function loadCheckoutScreen() {
    try {
      setScreenLoading(true);

      const loadedCustomer = await loadCustomer();
      const allowed = customerReady(loadedCustomer);

      setAccessAllowed(allowed);

      if (!allowed) {
        Alert.alert(
          "Membership Required",
          "Complete or sync customer membership before checkout.",
          [
            {
              text: "Go to Registration",
              onPress: () =>
                router.replace({
                  pathname: "/customer/register" as any,
                  params: {
                    customerId: getCustomerId(loadedCustomer),
                    email: loadedCustomer?.email || "",
                  },
                }),
            },
          ]
        );
        return;
      }

      await loadCart();
    } finally {
      setScreenLoading(false);
    }
  }

  async function loadCustomer() {
    const stored =
      (await AsyncStorage.getItem("currentCustomer")) ||
      (await AsyncStorage.getItem("farm2homeCurrentCustomer")) ||
      (await AsyncStorage.getItem("pendingCustomer")) ||
      (await AsyncStorage.getItem("currentUser"));

    let localCustomer: CurrentCustomer | null = parseJSON(stored);

    if (localCustomer?.phone && !phone) setPhone(clean(localCustomer.phone));

    const { data: authData } = await supabase.auth.getUser();
    const authId = clean(authData?.user?.id || "");
    const authEmail = normalize(authData?.user?.email || localCustomer?.email || "");

    if (authId || authEmail) {
      const dbCustomer = await fetchCustomer(authId, authEmail);
      if (dbCustomer) {
        const sub = await fetchCustomerSubscription(dbCustomer.id, dbCustomer.email);
        const merged = {
          ...dbCustomer,
          customerId: dbCustomer.id,
          accountId: dbCustomer.account_id,
          stripe_customer_id: dbCustomer.stripe_customer_id || dbCustomer.stripe_id || sub?.stripe_customer_id,
          stripeCustomerId: dbCustomer.stripe_customer_id || dbCustomer.stripe_id || sub?.stripe_customer_id,
          stripe_subscription_id:
            dbCustomer.stripe_subscription_id || dbCustomer.subscription_id || sub?.stripe_subscription_id,
          subscription_id:
            dbCustomer.subscription_id || dbCustomer.stripe_subscription_id || sub?.stripe_subscription_id,
          subscriptionId:
            dbCustomer.subscription_id || dbCustomer.stripe_subscription_id || sub?.stripe_subscription_id,
          subscription_status: dbCustomer.subscription_status || sub?.subscription_status,
          subscriptionStatus: dbCustomer.subscription_status || sub?.subscription_status,
          membership_status: dbCustomer.membership_status || sub?.subscription_status,
          membershipStatus: dbCustomer.membership_status || sub?.subscription_status,
          account_active:
            dbCustomer.account_active ??
            ["active", "trialing", "past_due"].includes(normalize(sub?.subscription_status)),
          accountActive:
            dbCustomer.account_active ??
            ["active", "trialing", "past_due"].includes(normalize(sub?.subscription_status)),
          current_period_end: sub?.current_period_end || dbCustomer.current_period_end,
          currentPeriodEnd: sub?.current_period_end || dbCustomer.current_period_end,
        };

        localCustomer = merged;
        setCustomer(merged);
        if (merged.phone && !phone) setPhone(clean(merged.phone));
        if (!deliveryAddress) setDeliveryAddress(clean(merged.delivery_address || merged.deliveryAddress));
        if (!city) setCity(clean(merged.delivery_city || merged.deliveryCity));
        if (!stateValue) setStateValue(clean(merged.delivery_state || merged.deliveryState || "MI"));
        if (!zipCode) setZipCode(clean(merged.delivery_zip || merged.deliveryZip));
        if (!deliveryInstructions) {
          setDeliveryInstructions(clean(merged.delivery_instructions || merged.deliveryInstructions));
        }

        await AsyncStorage.multiSet([
          ["currentCustomer", JSON.stringify(merged)],
          ["farm2homeCurrentCustomer", JSON.stringify(merged)],
          ["currentUser", JSON.stringify({ ...merged, role: "customer" })],
        ]);

        return merged;
      }
    }

    setCustomer(localCustomer);
    return localCustomer;
  }

  async function fetchCustomer(id?: string, email?: string) {
    const lookupId = clean(id);
    const lookupEmail = normalize(email);

    if (lookupId) {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .or(`id.eq.${lookupId},auth_user_id.eq.${lookupId},profile_id.eq.${lookupId}`)
        .limit(1);

      if (!error && Array.isArray(data) && data[0]) return data[0];
    }

    if (lookupEmail) {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("email", lookupEmail)
        .limit(1);

      if (!error && Array.isArray(data) && data[0]) return data[0];
    }

    return null;
  }

  async function fetchCustomerSubscription(id?: string, email?: string) {
    const lookupId = clean(id);
    const lookupEmail = normalize(email);

    const filters = [
      lookupId ? `customer_id.eq.${lookupId}` : "",
      lookupEmail ? `customer_email.eq.${lookupEmail}` : "",
    ]
      .filter(Boolean)
      .join(",");

    if (!filters) return null;

    try {
      const { data, error } = await supabase
        .from("customer_subscriptions")
        .select("*")
        .or(filters)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (!error && Array.isArray(data) && data[0]) return data[0];
    } catch {
      return null;
    }

    return null;
  }

  async function loadCart() {
    try {
      const checkoutSnapshot = parseJSON(await AsyncStorage.getItem("currentCheckoutCart"));
      const cartData = Array.isArray(checkoutSnapshot) ? checkoutSnapshot : await getCart();

      const normalized = Array.isArray(cartData)
        ? cartData.map((item: any) => normalizeCartItem(item)).filter((item) => getQuantity(item) > 0)
        : [];

      setCart(normalized as any);
    } catch (error) {
      console.log("Load cart error:", error);
      Alert.alert("Cart Error", "Unable to load your cart.");
      setCart([]);
    }
  }

  function setQuickTip(amount: number) {
    setTip(amount.toFixed(2));
  }

  const cartGroups = useMemo(() => groupCartByFarm(cart), [cart]);

  const subtotal = useMemo(() => {
    return cart.reduce((sum: number, item: any) => sum + getLineTotal(item), 0);
  }, [cart]);

  const itemCount = useMemo(() => {
    return cart.reduce((sum: number, item: any) => sum + getQuantity(item), 0);
  }, [cart]);

  const hasFreightItems = useMemo(() => cart.some((item: any) => isFreightEligibleItem(item)), [cart]);

  const serviceFee = subtotal * SERVICE_FEE_RATE;
  const deliveryFee = deliveryOption === "Delivery" && cart.length > 0 ? 5.99 : 0;
  const freightHandlingFee = deliveryOption === "Delivery" && hasFreightItems ? 25 : 0;
  const tipAmount = Number(tip) || 0;
  const total = subtotal + serviceFee + deliveryFee + freightHandlingFee + tipAmount;

  const payoutSplits = useMemo(() => {
    return cartGroups.map((group) => ({
      farmerId: group.farmerId,
      farmer_id: group.farmerId,
      farmName: group.farmName,
      farm_name: group.farmName,
      stripeAccountId: group.farmerStripeAccountId,
      stripe_account_id: group.farmerStripeAccountId,
      farmerStripeAccountId: group.farmerStripeAccountId,
      farmer_stripe_account_id: group.farmerStripeAccountId,
      subtotal: Number(group.farmSubtotal.toFixed(2)),
      amount: Number(group.farmSubtotal.toFixed(2)),
      itemCount: group.itemCount,
      item_count: group.itemCount,
      freightRequired: group.freightRequired,
      freight_required: group.freightRequired,
      driverPayout: group.driverPayout,
      driver_payout: group.driverPayout,
    }));
  }, [cartGroups]);

  function validateCheckout() {
    if (cart.length === 0) {
      Alert.alert("Empty Cart", "Please add items before checkout.");
      return false;
    }

    if (!customerReady(customer)) {
      Alert.alert(
        "Membership Required",
        "Complete or sync customer membership before checkout.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Fix Membership",
            onPress: () =>
              router.push({
                pathname: "/customer/register" as any,
                params: {
                  customerId: getCustomerId(customer),
                  email: customer?.email || "",
                },
              }),
          },
        ]
      );
      return false;
    }

    if (!phone.trim()) {
      Alert.alert("Missing Phone", "Please enter your phone number.");
      return false;
    }

    if (
      deliveryOption === "Delivery" &&
      (!deliveryAddress.trim() || !city.trim() || !stateValue.trim() || !zipCode.trim())
    ) {
      Alert.alert("Missing Delivery Info", "Please enter the full delivery address.");
      return false;
    }

    const invalidItems = cart.filter((item: any) => !getFarmerId(item));

    if (invalidItems.length > 0) {
      Alert.alert(
        "Marketplace Setup Error",
        "Some cart items are missing farmer ID. Clear the cart and add the items again from Marketplace."
      );
      return false;
    }

    const missingPayoutItems = cart.filter((item: any) => !isAcct(getFarmerStripeAccountId(item)));

    if (missingPayoutItems.length > 0) {
      Alert.alert(
        "Farmer Payout Warning",
        `${missingPayoutItems.length} item${missingPayoutItems.length === 1 ? "" : "s"} are missing farmer Stripe payout account IDs. Checkout can continue, but those payouts may need admin review.`,
        [
          { text: "Review", style: "cancel" },
          { text: "Continue Anyway", onPress: () => submitCheckout() },
        ]
      );
      return false;
    }

    return true;
  }

  function buildDeliveryInfo(): DeliveryInfo {
    return {
      deliveryAddress: deliveryOption === "Delivery" ? deliveryAddress.trim() : "Pickup",
      city: deliveryOption === "Delivery" ? city.trim() : "",
      state: deliveryOption === "Delivery" ? stateValue.trim().toUpperCase() : "",
      zipCode: deliveryOption === "Delivery" ? zipCode.trim() : "",
      phone: phone.trim(),
      deliveryInstructions: deliveryInstructions.trim(),
      deliveryOption,
    };
  }

  function buildDropoffAddress(deliveryInfo: DeliveryInfo) {
    if (deliveryOption === "Pickup") return "Pickup";
    return `${deliveryInfo.deliveryAddress}, ${deliveryInfo.city}, ${deliveryInfo.state} ${deliveryInfo.zipCode}`;
  }

  async function saveOrderToSupabase(order: any) {
    const orderPayloads = [
      {
        id: order.id,
        customer_id: order.customerId,
        customer_email: order.customerEmail,
        customer_name: order.customerName,
        status: order.status,
        subtotal: order.subtotal,
        service_fee: order.serviceFee,
        delivery_fee: order.deliveryFee,
        freight_handling_fee: order.freightHandlingFee,
        tip: order.tip,
        total: order.total,
        delivery_option: order.deliveryInfo.deliveryOption,
        delivery_address: order.deliveryInfo.deliveryAddress,
        city: order.deliveryInfo.city,
        state: order.deliveryInfo.state,
        zip_code: order.deliveryInfo.zipCode,
        phone: order.deliveryInfo.phone,
        delivery_instructions: order.deliveryInfo.deliveryInstructions,
        items: order.items,
        payout_splits: order.payoutSplits,
        created_at: order.createdAt,
        updated_at: order.updatedAt,
      },
      {
        id: order.id,
        customerId: order.customerId,
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        status: order.status,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        tip: order.tip,
        total: order.total,
        items: order.items,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
    ];

    const orderTables = ["orders", "customer_orders", "farm_orders"];

    for (const table of orderTables) {
      for (const payload of orderPayloads) {
        try {
          const { error } = await supabase.from(table).upsert(payload as any, { onConflict: "id" });
          if (!error) {
            await saveOrderItemsToSupabase(order, table);
            return table;
          }
          console.log(`${table} order save skipped:`, error.message);
        } catch (error) {
          console.log(`${table} order save exception:`, error);
        }
      }
    }

    return null;
  }

  async function saveOrderItemsToSupabase(order: any, orderTable: string) {
    const itemRows = order.items.map((item: any) => ({
      id: `${order.id}_${getProductId(item) || getItemId(item)}`,
      order_id: order.id,
      customer_id: order.customerId,
      farmer_id: getFarmerId(item),
      farm_name: getFarmName(item),
      product_id: getProductId(item),
      product_name: getItemName(item),
      quantity: getQuantity(item),
      price: getPrice(item),
      line_total: getLineTotal(item),
      farmer_stripe_account_id: getFarmerStripeAccountId(item) || null,
      stripe_account_id: getFarmerStripeAccountId(item) || null,
      status: "PENDING_PAYMENT",
      created_at: order.createdAt,
      updated_at: order.updatedAt,
    }));

    const itemTables = ["order_items", "customer_order_items", "farm_order_items"];

    for (const table of itemTables) {
      try {
        const { error } = await supabase.from(table).upsert(itemRows as any, { onConflict: "id" });
        if (!error) return table;
        console.log(`${table} save skipped:`, error.message);
      } catch (error) {
        console.log(`${table} save exception:`, error);
      }
    }

    return null;
  }

  async function createDeliveryJobsForOrder(params: {
    orderId: string;
    currentCustomer: CurrentCustomer | null;
    customerName: string;
    deliveryInfo: DeliveryInfo;
  }) {
    if (deliveryOption !== "Delivery") return;

    const dropoffAddress = buildDropoffAddress(params.deliveryInfo);

    for (const group of cartGroups) {
      const firstItem: any = group.items[0];

      const miles = Number(firstItem?.distanceMiles || firstItem?.miles || 0);
      const payoutAmount = calculateDriverPayout(miles, group.farmSubtotal);

      const pickupAddress =
        firstItem?.farmAddress ||
        firstItem?.pickupAddress ||
        firstItem?.farmLocation ||
        "Farm pickup location";

      const deliveryJobPayload = {
        orderId: params.orderId,
        order_id: params.orderId,
        farmerId: group.farmerId,
        farmer_id: group.farmerId,
        customerId: getCustomerId(params.currentCustomer),
        customer_id: getCustomerId(params.currentCustomer),
        farmName: group.farmName,
        farm_name: group.farmName,
        customerName: params.customerName,
        customer_name: params.customerName,
        customerPhone: params.deliveryInfo.phone,
        customer_phone: params.deliveryInfo.phone,
        pickupAddress,
        pickup_address: pickupAddress,
        dropoffAddress,
        dropoff_address: dropoffAddress,
        deliveryWindow: "Same Day Delivery",
        delivery_window: "Same Day Delivery",
        payoutAmount,
        payout_amount: payoutAmount,
        deliveryFee: payoutAmount,
        delivery_fee: payoutAmount,
        miles,
        pickupNotes: "Pickup customer grocery order from farm.",
        pickup_notes: "Pickup customer grocery order from farm.",
        deliveryNotes: params.deliveryInfo.deliveryInstructions || "",
        delivery_notes: params.deliveryInfo.deliveryInstructions || "",
        freightRequired: group.freightRequired,
        freight_required: group.freightRequired,
        items: group.items,
        productSubtotal: group.farmSubtotal,
        product_subtotal: group.farmSubtotal,
        status: "available",
        created_at: new Date().toISOString(),
      };

      try {
        const response = await fetch(`${API_BASE_URL}/driver/create-delivery-job`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(deliveryJobPayload),
        });

        const data = await parseApiResponse(response);
        if (!response.ok || !data.success) console.log("DELIVERY JOB CREATE FAILED:", data);
      } catch (error) {
        console.log("Delivery job creation skipped:", error);
      }

      if (group.freightRequired) {
        try {
          await fetch(`${API_BASE_URL}/freight/create-farm-load`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: params.orderId,
              order_id: params.orderId,
              farmerId: group.farmerId,
              farmer_id: group.farmerId,
              farmName: group.farmName,
              farm_name: group.farmName,
              customerId: getCustomerId(params.currentCustomer),
              customer_id: getCustomerId(params.currentCustomer),
              customerName: params.customerName,
              customer_name: params.customerName,
              customerPhone: params.deliveryInfo.phone,
              customer_phone: params.deliveryInfo.phone,
              pickupAddress,
              pickup_address: pickupAddress,
              dropoffAddress,
              dropoff_address: dropoffAddress,
              miles,
              productTotal: group.farmSubtotal,
              product_total: group.farmSubtotal,
              costPerMile: 2.25,
              cost_per_mile: 2.25,
              freightTotal: Number((miles * 2.25 + freightHandlingFee).toFixed(2)),
              freight_total: Number((miles * 2.25 + freightHandlingFee).toFixed(2)),
              totalDue: Number((group.farmSubtotal + miles * 2.25 + freightHandlingFee).toFixed(2)),
              total_due: Number((group.farmSubtotal + miles * 2.25 + freightHandlingFee).toFixed(2)),
              loadType: "Farm freight",
              load_type: "Farm freight",
              products: group.items,
              status: "available",
            }),
          });
        } catch (error) {
          console.log("Freight load create skipped:", error);
        }
      }
    }
  }

  async function handleStripeCheckout() {
    if (loading) return;
    if (!validateCheckout()) return;
    await submitCheckout();
  }

  async function submitCheckout() {
    try {
      setLoading(true);

      const deliveryInfo = buildDeliveryInfo();
      await saveDeliveryInfo(deliveryInfo);

      const orderId = `order_${Date.now()}`;
      const now = new Date().toISOString();
      const customerName = getCustomerName(customer);
      const customerEmail = normalize(customer?.email || "");
      const customerId = getCustomerId(customer);

      const normalizedCart = cart.map((item: any) => normalizeCartItem(item));

      const pendingOrder: Farm2HomeOrder = {
        id: orderId,
        customerEmail: customerEmail || "customer@test.com",
        customerName,
        items: normalizedCart,
        subtotal,
        deliveryFee: deliveryFee + freightHandlingFee,
        tip: tipAmount,
        total,
        deliveryInfo,
        status: "PENDING_PAYMENT",
        createdAt: now,
        updatedAt: now,
      };

      await savePendingOrder(pendingOrder);

      const orderRecord = {
        ...pendingOrder,
        customerId,
        customer_id: customerId,
        customerEmail,
        customer_email: customerEmail,
        customerName,
        customer_name: customerName,
        serviceFee,
        service_fee: serviceFee,
        freightHandlingFee,
        freight_handling_fee: freightHandlingFee,
        deliveryOption,
        delivery_option: deliveryOption,
        cartGroups,
        cart_groups: cartGroups,
        payoutSplits,
        payout_splits: payoutSplits,
        createdAt: now,
        created_at: now,
        updatedAt: now,
        updated_at: now,
      };

      await AsyncStorage.multiSet([
        ["pendingCustomerOrder", JSON.stringify(orderRecord)],
        ["currentCustomerOrder", JSON.stringify(orderRecord)],
        ["lastPendingCustomerOrder", JSON.stringify(orderRecord)],
      ]);

      await saveOrderToSupabase(orderRecord);

      if (deliveryOption === "Delivery") {
        await createDeliveryJobsForOrder({
          orderId,
          currentCustomer: customer,
          customerName,
          deliveryInfo,
        });
      }

      const payload = {
        cloudOrderId: orderId,
        orderId,
        order_id: orderId,

        customerId,
        customer_id: customerId,
        customerEmail,
        customer_email: customerEmail,
        customerName,
        customer_name: customerName,
        stripeCustomerId: getStripeCustomer(customer),
        stripe_customer_id: getStripeCustomer(customer),

        cart: normalizedCart,
        items: normalizedCart,
        cartGroups,
        cart_groups: cartGroups,
        payoutSplits,
        payout_splits: payoutSplits,

        subtotal,
        serviceFee,
        service_fee: serviceFee,
        platformFee: serviceFee,
        platform_fee: serviceFee,
        deliveryFee,
        delivery_fee: deliveryFee,
        freightHandlingFee,
        freight_handling_fee: freightHandlingFee,
        tip: tipAmount,
        total,

        deliveryOption,
        delivery_option: deliveryOption,
        deliveryInfo,
        delivery_info: deliveryInfo,
        deliveryAddress: deliveryInfo.deliveryAddress,
        delivery_address: deliveryInfo.deliveryAddress,
        city: deliveryInfo.city,
        state: deliveryInfo.state,
        zipCode: deliveryInfo.zipCode,
        zip_code: deliveryInfo.zipCode,
        phone: deliveryInfo.phone,
        deliveryInstructions: deliveryInfo.deliveryInstructions,
        delivery_instructions: deliveryInfo.deliveryInstructions,

        successUrl: `${APP_URL}/customer/order-success?orderId=${encodeURIComponent(orderId)}&session_id={CHECKOUT_SESSION_ID}`,
        success_url: `${APP_URL}/customer/order-success?orderId=${encodeURIComponent(orderId)}&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${APP_URL}/customer/cart`,
        cancel_url: `${APP_URL}/customer/cart`,
      };

      const response = await fetch(`${API_BASE_URL}/payments/create-marketplace-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await parseApiResponse(response);

      if (!response.ok || !data.success || !data.url) {
        throw new Error(data.error || data.message || "Unable to create Stripe checkout.");
      }

      await openStripeUrl(data.url);
    } catch (error: any) {
      console.log("Stripe checkout error:", error);
      Alert.alert("Checkout Error", error?.message || "Unable to start Stripe checkout.");
    } finally {
      setLoading(false);
    }
  }

  if (screenLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <View style={styles.lockContainer}>
          <ActivityIndicator size="large" color={COLORS.red} />
          <Text style={styles.lockText}>Loading checkout...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!accessAllowed) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <View style={styles.lockContainer}>
          <Text style={styles.lockTitle}>Membership Required</Text>
          <Text style={styles.lockText}>Complete customer membership before checkout.</Text>

          <TouchableOpacity
            style={styles.lockButton}
            onPress={() =>
              router.replace({
                pathname: "/customer/register" as any,
                params: {
                  customerId: getCustomerId(customer),
                  email: customer?.email || "",
                },
              })
            }
          >
            <Text style={styles.lockButtonText}>Fix Membership</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.topBar}>
            <Pressable
              style={({ pressed }) => [styles.backCircle, pressed && styles.pressed]}
              onPress={() => router.push("/customer/cart" as any)}
            >
              <Ionicons name="arrow-back-outline" size={20} color={COLORS.text} />
            </Pressable>

            <View style={styles.topTitleBlock}>
              <Text style={styles.title}>Checkout</Text>
              <Text style={styles.subtitle}>
                {itemCount} item{itemCount === 1 ? "" : "s"} from {cartGroups.length} farm
                {cartGroups.length === 1 ? "" : "s"}
              </Text>
            </View>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <Ionicons name="card-outline" size={28} color={COLORS.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroBadge}>Secure Stripe Payment</Text>
              <Text style={styles.heroTitle}>Complete your Farm2Home order</Text>
              <Text style={styles.heroText}>
                Farm2Home keeps a 4% service fee and farmer payouts are split by Stripe Connect account.
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Order Type</Text>

          <View style={styles.optionRow}>
            <Pressable
              style={({ pressed }) => [
                styles.optionButton,
                deliveryOption === "Delivery" && styles.optionActive,
                pressed && styles.pressed,
              ]}
              onPress={() => setDeliveryOption("Delivery")}
            >
              <Ionicons
                name="car-outline"
                size={20}
                color={deliveryOption === "Delivery" ? COLORS.white : COLORS.red}
              />
              <Text
                style={[
                  styles.optionText,
                  deliveryOption === "Delivery" && styles.optionTextActive,
                ]}
              >
                Delivery
              </Text>
              <Text
                style={[
                  styles.optionSubtext,
                  deliveryOption === "Delivery" && styles.optionSubtextActive,
                ]}
              >
                Driver board eligible
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.optionButton,
                deliveryOption === "Pickup" && styles.optionActive,
                pressed && styles.pressed,
              ]}
              onPress={() => setDeliveryOption("Pickup")}
            >
              <Ionicons
                name="storefront-outline"
                size={20}
                color={deliveryOption === "Pickup" ? COLORS.white : COLORS.red}
              />
              <Text
                style={[
                  styles.optionText,
                  deliveryOption === "Pickup" && styles.optionTextActive,
                ]}
              >
                Pickup
              </Text>
              <Text
                style={[
                  styles.optionSubtext,
                  deliveryOption === "Pickup" && styles.optionSubtextActive,
                ]}
              >
                Pickup at farm
              </Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>Farm Orders</Text>

          {cartGroups.map((group) => (
            <View key={group.farmKey} style={styles.farmCard}>
              <View style={styles.farmHeader}>
                <View style={styles.farmTitleRow}>
                  <View style={styles.farmIconBox}>
                    <Text style={styles.farmInitial}>
                      {group.farmName.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.farmNameBlock}>
                    <Text style={styles.farmTitle}>{group.farmName}</Text>

                    <View
                      style={[
                        styles.payoutBadge,
                        group.farmerStripeAccountId ? styles.payoutGood : styles.payoutWarn,
                      ]}
                    >
                      <Ionicons
                        name={group.farmerStripeAccountId ? "checkmark-circle-outline" : "warning-outline"}
                        size={14}
                        color={group.farmerStripeAccountId ? "#166534" : "#92400E"}
                      />
                      <Text
                        style={[
                          styles.payoutText,
                          group.farmerStripeAccountId ? styles.payoutTextGood : styles.payoutTextWarn,
                        ]}
                      >
                        {group.farmerStripeAccountId ? "Stripe payout connected" : "Stripe payout missing"}
                      </Text>
                    </View>

                    {group.freightRequired ? (
                      <Text style={styles.freightMeta}>Freight workflow required</Text>
                    ) : null}
                  </View>
                </View>

                <Text style={styles.farmSubtotal}>{money(group.farmSubtotal)}</Text>
              </View>

              {group.items.map((item: any) => {
                const image = getItemImage(item);

                return (
                  <View key={getItemId(item)} style={styles.itemRow}>
                    {image ? (
                      <Image source={{ uri: image }} style={styles.itemImage} />
                    ) : (
                      <View style={styles.itemImagePlaceholder}>
                        <Text style={styles.itemImageText}>{getItemName(item).slice(0, 1)}</Text>
                      </View>
                    )}

                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {getItemName(item)}
                      </Text>

                      <Text style={styles.itemMeta}>
                        Qty {getQuantity(item)} · {money(getPrice(item))}
                        {item.unit ? ` / ${item.unit}` : " each"}
                      </Text>

                      <Text style={styles.accountMeta} numberOfLines={1}>
                        Farmer ID: {getFarmerId(item) || "Missing"}
                      </Text>
                    </View>

                    <Text style={styles.itemTotal}>{money(getLineTotal(item))}</Text>
                  </View>
                );
              })}
            </View>
          ))}

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Payment Summary</Text>

            <SummaryLine label="Subtotal" value={subtotal} />
            <SummaryLine label="Farm2Home Service Fee 4%" value={serviceFee} />
            <SummaryLine label="Delivery Fee" value={deliveryFee} />

            {freightHandlingFee > 0 ? (
              <SummaryLine label="Freight Handling" value={freightHandlingFee} />
            ) : null}

            <SummaryLine label="Tip" value={tipAmount} />

            <View style={styles.divider} />

            <View style={styles.totalLine}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{money(total)}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Add Tip</Text>

          <View style={styles.tipRow}>
            {[0, 2, 5, 10].map((amount) => (
              <Pressable
                key={amount}
                style={({ pressed }) => [
                  styles.tipButton,
                  Number(tip) === amount && styles.tipButtonActive,
                  pressed && styles.pressed,
                ]}
                onPress={() => setQuickTip(amount)}
              >
                <Text
                  style={[
                    styles.tipText,
                    Number(tip) === amount && styles.tipTextActive,
                  ]}
                >
                  {amount === 0 ? "No Tip" : `$${amount}`}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Custom Tip"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            value={tip}
            onChangeText={setTip}
          />

          <Text style={styles.sectionTitle}>
            {deliveryOption === "Delivery" ? "Delivery Information" : "Pickup Contact"}
          </Text>

          {deliveryOption === "Delivery" ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="Delivery Address"
                placeholderTextColor="#94A3B8"
                value={deliveryAddress}
                onChangeText={setDeliveryAddress}
              />

              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  placeholder="City"
                  placeholderTextColor="#94A3B8"
                  value={city}
                  onChangeText={setCity}
                />

                <TextInput
                  style={[styles.input, styles.stateInput]}
                  placeholder="State"
                  placeholderTextColor="#94A3B8"
                  value={stateValue}
                  onChangeText={(value) => setStateValue(value.toUpperCase())}
                  autoCapitalize="characters"
                />
              </View>

              <TextInput
                style={styles.input}
                placeholder="Zip Code"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={zipCode}
                onChangeText={setZipCode}
              />
            </>
          ) : null}

          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            placeholderTextColor="#94A3B8"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Delivery / Pickup Instructions"
            placeholderTextColor="#94A3B8"
            multiline
            value={deliveryInstructions}
            onChangeText={setDeliveryInstructions}
          />

          <Pressable
            style={({ pressed }) => [
              styles.payButton,
              pressed && !loading && cart.length > 0 && styles.pressed,
              (loading || cart.length === 0) && styles.buttonDisabled,
            ]}
            onPress={handleStripeCheckout}
            disabled={loading || cart.length === 0}
          >
            <View>
              <Text style={styles.payButtonText}>
                {loading ? "Opening Stripe Checkout..." : "Pay Now with Card"}
              </Text>
              <Text style={styles.payButtonSubtext}>Secure Stripe marketplace payment</Text>
            </View>

            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.payAmount}>{money(total)}</Text>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            onPress={() => router.push("/customer/cart" as any)}
          >
            <Ionicons name="cart-outline" size={18} color={COLORS.red} />
            <Text style={styles.backText}>Back to Cart</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SummaryLine({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryLine}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{money(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  keyboard: { flex: 1, backgroundColor: COLORS.bg },
  scrollContent: { padding: 18, paddingBottom: 48 },
  lockContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  lockTitle: {
    color: COLORS.danger,
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
  },
  lockText: {
    marginTop: 14,
    color: COLORS.muted,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 21,
  },
  lockButton: {
    backgroundColor: COLORS.red,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 16,
    marginTop: 18,
  },
  lockButtonText: { color: COLORS.white, fontWeight: "900" },
  topBar: { flexDirection: "row", alignItems: "center", marginBottom: 18, gap: 12 },
  backCircle: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  topTitleBlock: { flex: 1 },
  title: { fontSize: 31, fontWeight: "900", color: COLORS.text },
  subtitle: { color: COLORS.muted, fontWeight: "700", marginTop: 3 },
  heroCard: {
    backgroundColor: COLORS.black,
    borderRadius: 26,
    padding: 18,
    marginBottom: 18,
    flexDirection: "row",
    gap: 14,
  },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  heroBadge: {
    color: "#FCA5A5",
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  heroTitle: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 30,
    marginTop: 5,
  },
  heroText: {
    color: "#CBD5E1",
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 6,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 11,
    marginTop: 8,
  },
  optionRow: { flexDirection: "row", gap: 12, marginBottom: 18 },
  optionButton: {
    flex: 1,
    backgroundColor: COLORS.card,
    padding: 15,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    gap: 5,
  },
  optionActive: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  optionText: { fontWeight: "900", color: COLORS.text, fontSize: 16 },
  optionTextActive: { color: COLORS.white },
  optionSubtext: {
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 11,
    textAlign: "center",
  },
  optionSubtextActive: { color: "#FFE4E6" },
  farmCard: {
    backgroundColor: COLORS.card,
    padding: 15,
    borderRadius: 24,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  farmHeader: { marginBottom: 10 },
  farmTitleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  farmIconBox: {
    width: 54,
    height: 54,
    borderRadius: 19,
    backgroundColor: COLORS.black,
    justifyContent: "center",
    alignItems: "center",
  },
  farmInitial: { color: COLORS.white, fontWeight: "900", fontSize: 22 },
  farmNameBlock: { flex: 1 },
  farmTitle: { flex: 1, fontSize: 18, fontWeight: "900", color: COLORS.text },
  payoutBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginTop: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  payoutGood: { backgroundColor: COLORS.greenSoft },
  payoutWarn: { backgroundColor: COLORS.amberSoft },
  payoutText: { fontWeight: "900", fontSize: 11 },
  payoutTextGood: { color: "#166534" },
  payoutTextWarn: { color: "#92400E" },
  freightMeta: {
    color: COLORS.red,
    fontWeight: "900",
    marginTop: 6,
    fontSize: 12,
  },
  farmSubtotal: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.red,
    marginTop: 10,
    alignSelf: "flex-end",
  },
  itemRow: {
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 16,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemImage: {
    width: 54,
    height: 54,
    borderRadius: 15,
    backgroundColor: COLORS.greenSoft,
  },
  itemImagePlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 15,
    backgroundColor: COLORS.greenSoft,
    justifyContent: "center",
    alignItems: "center",
  },
  itemImageText: { color: COLORS.greenDark, fontSize: 21, fontWeight: "900" },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: "900", color: COLORS.text, marginBottom: 3 },
  itemMeta: { color: COLORS.muted, fontWeight: "700", fontSize: 12 },
  accountMeta: {
    color: "#6B7280",
    fontWeight: "700",
    fontSize: 11,
    marginTop: 4,
  },
  itemTotal: { color: COLORS.red, fontWeight: "900", fontSize: 15 },
  summaryCard: {
    backgroundColor: COLORS.card,
    padding: 18,
    borderRadius: 24,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: 14,
  },
  summaryLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 11,
    gap: 12,
  },
  summaryLabel: { color: COLORS.muted, fontWeight: "800", flex: 1 },
  summaryValue: { color: COLORS.text, fontWeight: "900" },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 8 },
  totalLine: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  totalLabel: { fontSize: 18, fontWeight: "900", color: COLORS.text },
  totalValue: { fontSize: 23, fontWeight: "900", color: COLORS.red },
  tipRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  tipButton: {
    flex: 1,
    backgroundColor: COLORS.card,
    padding: 13,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tipButtonActive: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  tipText: { color: COLORS.red, fontWeight: "900" },
  tipTextActive: { color: COLORS.white },
  inputRow: { flexDirection: "row", gap: 10 },
  inputFlex: { flex: 1 },
  stateInput: { width: 92 },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 15,
    color: COLORS.text,
    fontWeight: "800",
    marginBottom: 12,
  },
  textArea: { minHeight: 94, textAlignVertical: "top" },
  payButton: {
    backgroundColor: COLORS.red,
    paddingHorizontal: 18,
    paddingVertical: 17,
    borderRadius: 18,
    marginTop: 8,
    minHeight: 68,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  buttonDisabled: { backgroundColor: "#9CA3AF" },
  payButtonText: { color: COLORS.white, fontWeight: "900", fontSize: 16 },
  payButtonSubtext: {
    color: "#FFE4E6",
    fontWeight: "700",
    marginTop: 3,
    fontSize: 12,
  },
  payAmount: { color: COLORS.white, fontWeight: "900", fontSize: 18 },
  backButton: {
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
  },
  backText: {
    color: COLORS.red,
    fontWeight: "900",
  },
  pressed: { opacity: 0.75 },
});
