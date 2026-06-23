// app/customer/cart.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

import {
  CartItem,
  clearCart,
  decreaseCartItem,
  getCart,
  increaseCartItem,
  removeCartItem,
} from "../data/cartStore";
import { supabase } from "../data/supabaseClient";

const COLORS = {
  bg: "#F8F8FB",
  card: "#FFFFFF",
  surface: "#FFFFFF",

  black: "#2A3042",

  red: "#556EE6",
  redDark: "#485EC4",

  green: "#34C38F",
  greenDark: "#2CA67A",
  greenSoft: "#E8FBF3",

  amber: "#F1B44C",
  amberSoft: "#FFF6E5",

  blue: "#50A5F1",
  blueSoft: "#EAF5FE",

  danger: "#F46A6A",
  dangerSoft: "#FFECEC",

  text: "#495057",
  muted: "#74788D",
  border: "#EFF2F7",

  white: "#FFFFFF",
};

type CartGroup = {
  farmKey: string;
  farmName: string;
  farmerId: string;
  farmerStripeAccountId: string;
  items: CartItem[];
  subtotal: number;
  itemCount: number;
};

type CustomerSession = {
  id?: string;
  customerId?: string;
  customer_id?: string;
  account_id?: string;
  accountId?: string;
  email?: string;
  full_name?: string;
  fullName?: string;
  name?: string;
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

function getCustomerId(customer: CustomerSession | null) {
  return clean(customer?.id || customer?.customer_id || customer?.customerId);
}

function getCustomerName(customer: CustomerSession | null) {
  return clean(customer?.full_name || customer?.fullName || customer?.name || "Customer");
}

function getStripeCustomer(customer: CustomerSession | null) {
  return clean(customer?.stripe_customer_id || customer?.stripeCustomerId);
}

function getStripeSubscription(customer: CustomerSession | null) {
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

function customerReady(customer: CustomerSession | null) {
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
  return clean(item.farmerId || item.farmer_id || "");
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
  const qty = Number(item.quantity || 0);
  return Number.isFinite(qty) && qty > 0 ? qty : 0;
}

function getPrice(item: any) {
  const price = Number(item.price || item.unit_price || 0);
  return Number.isFinite(price) ? price : 0;
}

function getLineTotal(item: any) {
  return getPrice(item) * getQuantity(item);
}

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function groupCartByFarm(cart: CartItem[]): CartGroup[] {
  const grouped: Record<string, CartGroup> = {};

  cart.forEach((item: any) => {
    const farmerId = getFarmerId(item);
    const farmName = getFarmName(item);
    const farmerStripeAccountId = getFarmerStripeAccountId(item);
    const farmKey = farmerId || farmName;

    if (!grouped[farmKey]) {
      grouped[farmKey] = {
        farmKey,
        farmName,
        farmerId,
        farmerStripeAccountId,
        items: [],
        subtotal: 0,
        itemCount: 0,
      };
    }

    grouped[farmKey].items.push(item);
    grouped[farmKey].subtotal += getLineTotal(item);
    grouped[farmKey].itemCount += getQuantity(item);
  });

  return Object.values(grouped);
}

function normalizeCartItemForCheckout(item: any) {
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
  };
}

export default function CustomerCart() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<CustomerSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadCartScreen();
    }, [])
  );

  async function loadCartScreen() {
    try {
      setLoading(true);
      await Promise.all([loadCustomer(), loadCart()]);
    } finally {
      setLoading(false);
    }
  }

  async function loadCustomer() {
    try {
      const stored =
        (await AsyncStorage.getItem("currentCustomer")) ||
        (await AsyncStorage.getItem("farm2homeCurrentCustomer")) ||
        (await AsyncStorage.getItem("pendingCustomer")) ||
        (await AsyncStorage.getItem("currentUser"));

      let localCustomer: CustomerSession | null = null;

      if (stored) {
        try {
          localCustomer = JSON.parse(stored);
          setCustomer(localCustomer);
        } catch {
          localCustomer = null;
        }
      }

      const { data: authData } = await supabase.auth.getUser();
      const authId = clean(authData?.user?.id || "");
      const authEmail = normalize(authData?.user?.email || localCustomer?.email || "");

      if (!authId && !authEmail) return;

      const dbCustomer = await fetchCustomer(authId, authEmail);

      if (dbCustomer) {
        const sub = await fetchCustomerSubscription(dbCustomer.id, dbCustomer.email);

        const merged = {
          ...dbCustomer,
          customerId: dbCustomer.id,
          accountId: dbCustomer.account_id,
          stripe_customer_id:
            dbCustomer.stripe_customer_id || dbCustomer.stripe_id || sub?.stripe_customer_id,
          stripeCustomerId:
            dbCustomer.stripe_customer_id || dbCustomer.stripe_id || sub?.stripe_customer_id,
          stripe_subscription_id:
            dbCustomer.stripe_subscription_id ||
            dbCustomer.subscription_id ||
            sub?.stripe_subscription_id,
          subscription_id:
            dbCustomer.subscription_id ||
            dbCustomer.stripe_subscription_id ||
            sub?.stripe_subscription_id,
          subscriptionId:
            dbCustomer.subscription_id ||
            dbCustomer.stripe_subscription_id ||
            sub?.stripe_subscription_id,
          subscription_status: dbCustomer.subscription_status || sub?.subscription_status,
          membership_status:
            dbCustomer.membership_status ||
            dbCustomer.subscription_status ||
            sub?.subscription_status,
        };

        setCustomer(merged);

        await AsyncStorage.multiSet([
          ["currentCustomer", JSON.stringify(merged)],
          ["farm2homeCurrentCustomer", JSON.stringify(merged)],
          ["currentUser", JSON.stringify({ ...merged, role: "customer" })],
        ]);
      }
    } catch (error) {
      console.log("Load customer cart session error:", error);
    }
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
      const cartData = await getCart();
      const normalized = Array.isArray(cartData)
        ? cartData
            .map((item: any) => normalizeCartItemForCheckout(item))
            .filter((item) => getQuantity(item) > 0)
        : [];
      setCart(normalized as any);
    } catch (error) {
      console.log("Load cart error:", error);
      Alert.alert("Cart Error", "Unable to load your cart.");
      setCart([]);
    }
  }

  async function handleIncrease(id: string) {
    try {
      const updatedCart = await increaseCartItem(id);
      setCart(
        (Array.isArray(updatedCart) ? updatedCart : []).map((item: any) =>
          normalizeCartItemForCheckout(item)
        ) as any
      );
    } catch (error: any) {
      Alert.alert("Quantity Error", error?.message || "Unable to increase quantity.");
    }
  }

  async function handleDecrease(id: string) {
    try {
      const updatedCart = await decreaseCartItem(id);
      setCart(
        (Array.isArray(updatedCart) ? updatedCart : []).map((item: any) =>
          normalizeCartItemForCheckout(item)
        ) as any
      );
    } catch (error: any) {
      Alert.alert("Quantity Error", error?.message || "Unable to decrease quantity.");
    }
  }

  async function handleRemove(id: string) {
    Alert.alert("Remove Item", "Remove this item from your cart?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            const updatedCart = await removeCartItem(id);
            setCart(
              (Array.isArray(updatedCart) ? updatedCart : []).map((item: any) =>
                normalizeCartItemForCheckout(item)
              ) as any
            );
          } catch (error: any) {
            Alert.alert("Remove Error", error?.message || "Unable to remove item.");
          }
        },
      },
    ]);
  }

  async function handleClear() {
    if (cart.length === 0) return;

    Alert.alert("Clear Cart", "Remove all items from your cart?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          await clearCart();
          setCart([]);
          await AsyncStorage.multiRemove([
            "currentCheckoutCart",
            "currentCheckoutSummary",
            "pendingCustomerCheckout",
          ]);
        },
      },
    ]);
  }

  const cartGroups = useMemo(() => groupCartByFarm(cart), [cart]);

  const subtotal = useMemo(() => {
    return cart.reduce((sum: number, item: any) => sum + getLineTotal(item), 0);
  }, [cart]);

  const itemCount = useMemo(() => {
    return cart.reduce((sum: number, item: any) => sum + getQuantity(item), 0);
  }, [cart]);

  const serviceFee = useMemo(() => subtotal * 0.04, [subtotal]);
  const estimatedDelivery = useMemo(() => (subtotal > 0 ? 5.99 : 0), [subtotal]);
  const estimatedTotal = useMemo(
    () => subtotal + serviceFee + estimatedDelivery,
    [subtotal, serviceFee, estimatedDelivery]
  );

  const farmsMissingPayout = useMemo(
    () => cartGroups.filter((group) => !group.farmerStripeAccountId),
    [cartGroups]
  );

  async function saveCheckoutSnapshot() {
    const checkoutItems = cart.map((item: any) => normalizeCartItemForCheckout(item));
    const checkoutGroups = groupCartByFarm(checkoutItems as any);

    const summary = {
      customerId: getCustomerId(customer),
      customer_id: getCustomerId(customer),
      customerName: getCustomerName(customer),
      customer_name: getCustomerName(customer),
      customerEmail: customer?.email || "",
      customer_email: customer?.email || "",
      stripeCustomerId: getStripeCustomer(customer),
      stripe_customer_id: getStripeCustomer(customer),
      stripeSubscriptionId: getStripeSubscription(customer),
      stripe_subscription_id: getStripeSubscription(customer),

      itemCount,
      item_count: itemCount,
      farmCount: checkoutGroups.length,
      farm_count: checkoutGroups.length,

      subtotal,
      serviceFee,
      service_fee: serviceFee,
      platformFee: serviceFee,
      platform_fee: serviceFee,
      estimatedDelivery,
      estimated_delivery: estimatedDelivery,
      estimatedTotal,
      estimated_total: estimatedTotal,

      groups: checkoutGroups,
      items: checkoutItems,
      createdAt: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    await AsyncStorage.multiSet([
      ["currentCheckoutCart", JSON.stringify(checkoutItems)],
      ["currentCheckoutSummary", JSON.stringify(summary)],
      ["pendingCustomerCheckout", JSON.stringify(summary)],
    ]);

    return summary;
  }

  async function goToCheckout() {
    if (checkoutLoading) return;

    if (cart.length === 0) {
      Alert.alert("Cart Empty", "Add items before checkout.");
      return;
    }

    if (!customer) {
      Alert.alert("Login Required", "Please login as a customer before checkout.", [
        { text: "Cancel", style: "cancel" },
        { text: "Login", onPress: () => router.replace("/customer/login" as any) },
      ]);
      return;
    }

    if (!customerReady(customer)) {
      Alert.alert("Membership Required", "Complete customer membership before checkout.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Fix Membership",
          onPress: () =>
            router.push({
              pathname: "/customer/register" as any,
              params: {
                customerId: getCustomerId(customer),
                email: customer.email || "",
              },
            }),
        },
      ]);
      return;
    }

    if (farmsMissingPayout.length > 0) {
      Alert.alert(
        "Farmer Payout Warning",
        `${farmsMissingPayout.length} farm${
          farmsMissingPayout.length === 1 ? "" : "s"
        } in your cart do not have payout account data saved. Checkout can continue, but payouts may need admin review.`,
        [
          { text: "Review", style: "cancel" },
          {
            text: "Continue",
            onPress: async () => {
              await completeCheckoutRoute();
            },
          },
        ]
      );
      return;
    }

    await completeCheckoutRoute();
  }

  async function completeCheckoutRoute() {
    try {
      setCheckoutLoading(true);
      await saveCheckoutSnapshot();
      router.push("/customer/checkout" as any);
    } catch (error: any) {
      Alert.alert("Checkout Error", error?.message || "Unable to start checkout.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.red} size="large" />
          <Text style={styles.centerText}>Loading cart...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [styles.backCircle, pressed && styles.pressed]}
            onPress={() => router.push("/customer/marketplace" as any)}
          >
            <Ionicons name="arrow-back-outline" size={20} color={COLORS.text} />
          </Pressable>

          <View style={styles.topTitleBlock}>
            <Text style={styles.title}>Cart</Text>
            <Text style={styles.subtitle}>
              {itemCount} item{itemCount === 1 ? "" : "s"} from {cartGroups.length} farm
              {cartGroups.length === 1 ? "" : "s"}
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.clearTopButton, pressed && styles.pressed]}
            onPress={handleClear}
          >
            <Text style={styles.clearTopText}>Clear</Text>
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="basket-outline" size={28} color={COLORS.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroBadge}>Fresh Checkout</Text>
            <Text style={styles.heroTitle}>Review your farm order</Text>
            <Text style={styles.heroText}>
              Items stay grouped by farm for inventory, pickup, delivery, and farmer payouts.
            </Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <Metric icon="cube-outline" label="Items" value={`${itemCount}`} tone="green" />
          <Metric icon="storefront-outline" label="Farms" value={`${cartGroups.length}`} tone="blue" />
          <Metric icon="cash-outline" label="Subtotal" value={money(subtotal)} tone="amber" />
        </View>

        {cart.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="cart-outline" size={34} color={COLORS.red} />
            </View>

            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Text style={styles.emptyText}>
              Add fresh produce, eggs, honey, dairy, flowers, hay, or farm supplies to begin
              checkout.
            </Text>

            <Pressable
              style={({ pressed }) => [styles.shopButton, pressed && styles.pressed]}
              onPress={() => router.push("/customer/marketplace" as any)}
            >
              <Text style={styles.shopButtonText}>Shop Marketplace</Text>
            </Pressable>
          </View>
        ) : (
          cartGroups.map((group) => {
            return (
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
                      <Text style={styles.farmMeta}>
                        {group.farmerId
                          ? `Farmer ID: ${group.farmerId}`
                          : "Local Farm2Home seller"}
                      </Text>

                      <View
                        style={[
                          styles.payoutBadge,
                          group.farmerStripeAccountId ? styles.payoutGood : styles.payoutWarn,
                        ]}
                      >
                        <Ionicons
                          name={
                            group.farmerStripeAccountId
                              ? "checkmark-circle-outline"
                              : "warning-outline"
                          }
                          size={14}
                          color={group.farmerStripeAccountId ? COLORS.greenDark : "#92400E"}
                        />
                        <Text
                          style={[
                            styles.payoutText,
                            group.farmerStripeAccountId
                              ? styles.payoutTextGood
                              : styles.payoutTextWarn,
                          ]}
                        >
                          {group.farmerStripeAccountId ? "Payout connected" : "Payout pending"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Text style={styles.farmSubtotal}>{money(group.subtotal)}</Text>
                </View>

                {group.items.map((item: any) => {
                  const id = getItemId(item);
                  const image = getItemImage(item);
                  const lineTotal = getLineTotal(item);
                  const qty = getQuantity(item);

                  return (
                    <View key={id} style={styles.itemCard}>
                      {image ? (
                        <Image source={{ uri: image }} style={styles.productImage} />
                      ) : (
                        <View style={styles.productInitialBox}>
                          <Text style={styles.productInitialText}>
                            {getItemName(item).slice(0, 1).toUpperCase()}
                          </Text>
                        </View>
                      )}

                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName} numberOfLines={2}>
                          {getItemName(item)}
                        </Text>

                        <Text style={styles.itemMeta}>
                          {money(getPrice(item))}
                          {item.unit ? ` / ${item.unit}` : " each"}
                        </Text>

                        <Text style={styles.itemMeta}>
                          {item.category ? `${item.category} · ` : ""}
                          Qty {qty}
                        </Text>

                        <Text style={styles.lineTotal}>Line total: {money(lineTotal)}</Text>

                        <Pressable
                          style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
                          onPress={() => handleRemove(id)}
                        >
                          <Ionicons name="trash-outline" size={13} color={COLORS.danger} />
                          <Text style={styles.removeText}>Remove</Text>
                        </Pressable>
                      </View>

                      <View style={styles.qtyPill}>
                        <Pressable
                          style={({ pressed }) => [styles.qtyButton, pressed && styles.pressed]}
                          onPress={() => handleDecrease(id)}
                        >
                          <Text style={styles.qtyButtonText}>−</Text>
                        </Pressable>

                        <Text style={styles.qtyText}>{qty}</Text>

                        <Pressable
                          style={({ pressed }) => [styles.qtyButton, pressed && styles.pressed]}
                          onPress={() => handleIncrease(id)}
                        >
                          <Text style={styles.qtyButtonText}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })
        )}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Order Summary</Text>

          <SummaryLine label="Subtotal" value={money(subtotal)} />
          <SummaryLine label="Marketplace Service Fee 4%" value={money(serviceFee)} />
          <SummaryLine label="Estimated Delivery" value={money(estimatedDelivery)} />

          <View style={styles.divider} />

          <View style={styles.totalLine}>
            <Text style={styles.totalLabel}>Estimated Total</Text>
            <Text style={styles.totalValue}>{money(estimatedTotal)}</Text>
          </View>

          <Text style={styles.summaryNote}>
            Final delivery fee, pickup options, Stripe payment, farmer payout split, and order
            confirmation are completed on checkout.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.checkoutButton, cart.length === 0 && styles.disabledButton]}
          onPress={goToCheckout}
          disabled={checkoutLoading || cart.length === 0}
          activeOpacity={0.88}
        >
          {checkoutLoading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <View>
                <Text style={styles.checkoutButtonText}>Continue to Checkout</Text>
                <Text style={styles.checkoutSubText}>
                  {itemCount} item{itemCount === 1 ? "" : "s"} ready
                </Text>
              </View>
              <Text style={styles.checkoutAmount}>{money(estimatedTotal)}</Text>
            </>
          )}
        </TouchableOpacity>

        <Pressable
          style={({ pressed }) => [styles.backToMarketButton, pressed && styles.pressed]}
          onPress={() => router.push("/customer/marketplace" as any)}
        >
          <Ionicons name="storefront-outline" size={18} color={COLORS.red} />
          <Text style={styles.backToMarketText}>Back to Marketplace</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({
  icon,
  label,
  value,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tone: "green" | "blue" | "amber";
}) {
  const bg = tone === "green" ? COLORS.greenSoft : tone === "blue" ? COLORS.blueSoft : COLORS.amberSoft;
  const color = tone === "green" ? COLORS.green : tone === "blue" ? COLORS.blue : "#92400E";

  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
    </View>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryLine}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  centerText: {
    color: COLORS.muted,
    fontWeight: "800",
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 50,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    gap: 12,
  },
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
  topTitleBlock: {
    flex: 1,
  },
  title: {
    fontSize: 31,
    fontWeight: "900",
    color: COLORS.text,
  },
  subtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3,
  },
  clearTopButton: {
    backgroundColor: COLORS.dangerSoft,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
  },
  clearTopText: {
    color: COLORS.danger,
    fontWeight: "900",
  },
  heroCard: {
    backgroundColor: COLORS.red,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    flexDirection: "row",
    gap: 14,

    shadowColor: COLORS.red,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroBadge: {
    color: "#DDE3FF",
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  heroTitle: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 5,
  },
  heroText: {
    color: "#EEF2FF",
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 6,
  },
  metricsRow: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: 10,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  metricLabel: {
    color: COLORS.muted,
    fontWeight: "900",
    fontSize: 11,
    textTransform: "uppercase",
  },
  metricValue: {
    color: COLORS.text,
    fontWeight: "900",
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    marginBottom: 18,

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyIconBox: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.text,
    textAlign: "center",
  },
  emptyText: {
    color: COLORS.muted,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
    fontWeight: "700",
  },
  shopButton: {
    marginTop: 18,
    backgroundColor: COLORS.red,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 15,
  },
  shopButtonText: {
    color: COLORS.white,
    fontWeight: "900",
  },
  farmCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,

    borderWidth: 1,
    borderColor: COLORS.border,

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  farmHeader: {
    marginBottom: 12,
  },
  farmTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  farmIconBox: {
    width: 54,
    height: 54,
    borderRadius: 19,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },
  farmInitial: {
    color: COLORS.red,
    fontWeight: "900",
    fontSize: 22,
  },
  farmNameBlock: {
    flex: 1,
  },
  farmTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
  },
  farmMeta: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
  },
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
  payoutGood: {
    backgroundColor: COLORS.greenSoft,
  },
  payoutWarn: {
    backgroundColor: COLORS.amberSoft,
  },
  payoutText: {
    fontWeight: "900",
    fontSize: 11,
  },
  payoutTextGood: {
    color: COLORS.greenDark,
  },
  payoutTextWarn: {
    color: "#92400E",
  },
  farmSubtotal: {
    color: COLORS.red,
    fontSize: 21,
    fontWeight: "900",
    marginTop: 10,
    alignSelf: "flex-end",
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 11,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 11,
  },
  productImage: {
    width: 62,
    height: 62,
    borderRadius: 16,
    backgroundColor: COLORS.card,
  },
  productInitialBox: {
    width: 62,
    height: 62,
    borderRadius: 16,
    backgroundColor: COLORS.greenSoft,
    justifyContent: "center",
    alignItems: "center",
  },
  productInitialText: {
    color: COLORS.greenDark,
    fontSize: 23,
    fontWeight: "900",
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
  },
  itemMeta: {
    color: COLORS.muted,
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
  },
  lineTotal: {
    color: COLORS.red,
    fontWeight: "900",
    marginTop: 5,
    fontSize: 13,
  },
  removeButton: {
    alignSelf: "flex-start",
    marginTop: 7,
    backgroundColor: COLORS.dangerSoft,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  removeText: {
    color: COLORS.danger,
    fontWeight: "900",
    fontSize: 12,
  },
  qtyPill: {
    backgroundColor: COLORS.card,
    borderRadius: 999,
    padding: 5,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  qtyButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: COLORS.red,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyButtonText: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "900",
    marginTop: -2,
  },
  qtyText: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
    marginVertical: 7,
  },
  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,

    borderWidth: 1,
    borderColor: COLORS.border,

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 14,
  },
  summaryLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 11,
    gap: 12,
  },
  summaryLabel: {
    color: COLORS.muted,
    fontWeight: "800",
    flex: 1,
  },
  summaryValue: {
    color: COLORS.text,
    fontWeight: "900",
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 8,
  },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  totalLabel: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 18,
    flex: 1,
  },
  totalValue: {
    color: COLORS.red,
    fontWeight: "900",
    fontSize: 22,
  },
  summaryNote: {
    marginTop: 12,
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
    fontSize: 12,
  },
  checkoutButton: {
    backgroundColor: COLORS.red,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 18,

    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",

    shadowColor: COLORS.red,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  disabledButton: {
    backgroundColor: "#9CA3AF",
  },
  checkoutButtonText: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 16,
  },
  checkoutSubText: {
    color: "#EEF2FF",
    fontWeight: "800",
    fontSize: 12,
    marginTop: 3,
  },
  checkoutAmount: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 18,
  },
  backToMarketButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    flexDirection: "row",
    gap: 7,
  },
  backToMarketText: {
    color: COLORS.red,
    fontWeight: "900",
    fontSize: 15,
  },
  pressed: {
    opacity: 0.75,
  },
});