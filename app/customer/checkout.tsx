// app/customer/checkout.tsx
// Full updated checkout screen

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import { router, useFocusEffect } from "expo-router";

import { API_BASE_URL, APP_URL } from "../config/api";
import { CartItem, getCart } from "../data/cartStore";
import {
  DeliveryInfo,
  Farm2HomeOrder,
  saveDeliveryInfo,
  savePendingOrder,
} from "../data/orderStore";
import { useAuth } from "../providers/AuthProvider";
import { enforceSubscriptionAccess } from "../services/lockoutGuard";
import farmTheme from "../styles/farmTheme";

const SERVICE_FEE_RATE = 0.04;

const COLORS = {
  primary: "#2E7D32",
  primaryDark: "#14532D",
  secondary: "#F9A825",
  background: "#F8FAF5",
  card: "#FFFFFF",
  text: "#172017",
  muted: "#75806F",
  border: "#E2E8DA",
  softGreen: "#EAF5E6",
  lightGreen: "#F1FAED",
  danger: "#DC2626",
  dark: "#111827",
};

type CurrentCustomer = {
  id?: string;
  email?: string;
  fullName?: string;
  name?: string;
};

type CartGroup = {
  farmKey: string;
  farmName: string;
  farmerId: string;
  farmerStripeAccountId: string;
  items: CartItem[];
};

function safelyParseCustomer(rawValue: string | null): CurrentCustomer | null {
  if (!rawValue) return null;
  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

function getFarmName(item: any) {
  return item.farmName || item.farmerName || item.farm_name || "Farm2Home Farm";
}

function getFarmerId(item: any) {
  return String(item.farmerId || item.farmer_id || item.farmId || "");
}

function getFarmerStripeAccountId(item: any) {
  return (
    item.farmerStripeAccountId ||
    item.stripeAccountId ||
    item.farmer_stripe_account_id ||
    item.stripe_account_id ||
    ""
  );
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
      };
    }

    grouped[farmKey].items.push(item);
  });

  return Object.values(grouped);
}

function calculateDriverPayout(miles: number, farmSubtotal: number) {
  const base = miles > 20 ? 25 : miles > 10 ? 18 : miles > 5 ? 12 : 8;
  return Number((base + farmSubtotal * 0.02).toFixed(2));
}

function isFreightEligibleItem(item: any) {
  const name = String(item.name || item.productName || "").toLowerCase();
  const category = String(item.category || "").toLowerCase();

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
    category.includes("hay")
  );
}

export default function CustomerCheckout() {
  const { user, profile } = useAuth();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [accessChecking, setAccessChecking] = useState(true);
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
      checkAccessAndLoadCart();
    }, [user?.id, user?.email, profile?.email])
  );

  async function checkAccessAndLoadCart() {
    try {
      setAccessChecking(true);

      const access = await enforceSubscriptionAccess({
        role: "customer",
        userId: user?.id || "",
        email: profile?.email || user?.email || "",
        redirectTo: "/subscription/subscription-locked",
      });

      setAccessAllowed(access.allowed);

      if (access.allowed) {
        await loadCart();
      }
    } catch {
      setAccessAllowed(false);
    } finally {
      setAccessChecking(false);
    }
  }

  async function loadCart() {
    try {
      const cartData = await getCart();
      setCart(Array.isArray(cartData) ? cartData : []);
    } catch (error) {
      console.log("Load cart error:", error);
      Alert.alert("Cart Error", "Unable to load your cart.");
    }
  }

  function setQuickTip(amount: number) {
    setTip(amount.toFixed(2));
  }

  const cartGroups = useMemo(() => groupCartByFarm(cart), [cart]);

  const subtotal = useMemo(() => {
    return cart.reduce(
      (sum: number, item: any) =>
        sum + Number(item.price || 0) * Number(item.quantity || 0),
      0
    );
  }, [cart]);

  const itemCount = useMemo(() => {
    return cart.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
  }, [cart]);

  const hasFreightItems = useMemo(() => {
    return cart.some((item: any) => isFreightEligibleItem(item));
  }, [cart]);

  const serviceFee = subtotal * SERVICE_FEE_RATE;
  const deliveryFee = deliveryOption === "Delivery" && cart.length > 0 ? 5.99 : 0;
  const freightHandlingFee = deliveryOption === "Delivery" && hasFreightItems ? 25 : 0;
  const tipAmount = Number(tip) || 0;
  const total = subtotal + serviceFee + deliveryFee + freightHandlingFee + tipAmount;

  async function createDeliveryJobsForOrder(params: {
    orderId: string;
    currentCustomer: CurrentCustomer | null;
    customerName: string;
    deliveryInfo: DeliveryInfo;
  }) {
    if (deliveryOption !== "Delivery") return;

    const dropoffAddress =
      `${params.deliveryInfo.deliveryAddress}, ` +
      `${params.deliveryInfo.city}, ` +
      `${params.deliveryInfo.state} ` +
      `${params.deliveryInfo.zipCode}`;

    for (const group of cartGroups) {
      const farmSubtotal = group.items.reduce(
        (sum: number, item: any) =>
          sum + Number(item.price || 0) * Number(item.quantity || 0),
        0
      );

      const firstItem: any = group.items[0];

      const miles = Number(firstItem?.distanceMiles || firstItem?.miles || 0);
      const payoutAmount = calculateDriverPayout(miles, farmSubtotal);

      const pickupAddress =
        firstItem?.farmAddress ||
        firstItem?.pickupAddress ||
        firstItem?.farmLocation ||
        "Farm pickup location";

      const freightRequired = group.items.some((item: any) => isFreightEligibleItem(item));

      const deliveryJobPayload = {
        orderId: params.orderId,
        farmerId: group.farmerId,
        customerId: params.currentCustomer?.id || "",
        farmName: group.farmName,
        customerName: params.customerName,
        customerPhone: params.deliveryInfo.phone,
        pickupAddress,
        dropoffAddress,
        deliveryWindow: "Same Day Delivery",
        payoutAmount,
        deliveryFee: payoutAmount,
        miles,
        pickupNotes: "Pickup customer grocery order from farm.",
        deliveryNotes: params.deliveryInfo.deliveryInstructions || "",
        freightRequired,
        items: group.items,
        productSubtotal: farmSubtotal,
      };

      try {
        const response = await fetch(`${API_BASE_URL}/driver/create-delivery-job`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(deliveryJobPayload),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          console.log("DELIVERY JOB CREATE FAILED:", data);
        }
      } catch (error) {
        console.log("Delivery job creation skipped:", error);
      }

      if (freightRequired) {
        try {
          await fetch(`${API_BASE_URL}/freight/create-farm-load`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: params.orderId,
              farmerId: group.farmerId,
              farmName: group.farmName,
              customerId: params.currentCustomer?.id || "",
              customerName: params.customerName,
              customerPhone: params.deliveryInfo.phone,
              pickupAddress,
              dropoffAddress,
              miles,
              productTotal: farmSubtotal,
              costPerMile: 2.25,
              freightTotal: Number((miles * 2.25 + freightHandlingFee).toFixed(2)),
              totalDue: Number((farmSubtotal + miles * 2.25 + freightHandlingFee).toFixed(2)),
              loadType: "Farm freight",
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

    const access = await enforceSubscriptionAccess({
      role: "customer",
      userId: user?.id || "",
      email: profile?.email || user?.email || "",
      redirectTo: "/subscription/subscription-locked",
    });

    if (!access.allowed) return;

    if (cart.length === 0) {
      Alert.alert("Empty Cart", "Please add items before checkout.");
      return;
    }

    if (!phone.trim()) {
      Alert.alert("Missing Phone", "Please enter your phone number.");
      return;
    }

    if (
      deliveryOption === "Delivery" &&
      (!deliveryAddress.trim() || !city.trim() || !stateValue.trim() || !zipCode.trim())
    ) {
      Alert.alert("Missing Delivery Info", "Please enter the full delivery address.");
      return;
    }

    const invalidItems = cart.filter(
      (item: any) => !getFarmerId(item) || !getFarmerStripeAccountId(item)
    );

    if (invalidItems.length > 0) {
      Alert.alert(
        "Marketplace Setup Error",
        "Some cart items are missing farmer ID or farmer Stripe account ID. Clear the cart and add the items again from the Marketplace."
      );
      return;
    }

    try {
      setLoading(true);

      const currentCustomerRaw =
        (await AsyncStorage.getItem("currentCustomer")) ||
        (await AsyncStorage.getItem("currentUser"));

      const currentCustomer = safelyParseCustomer(currentCustomerRaw);

      const customerName =
        currentCustomer?.fullName || currentCustomer?.name || "Farm2Home Customer";

      const deliveryInfo: DeliveryInfo = {
        deliveryAddress: deliveryOption === "Delivery" ? deliveryAddress.trim() : "Pickup",
        city: deliveryOption === "Delivery" ? city.trim() : "",
        state: deliveryOption === "Delivery" ? stateValue.trim() : "",
        zipCode: deliveryOption === "Delivery" ? zipCode.trim() : "",
        phone: phone.trim(),
        deliveryInstructions: deliveryInstructions.trim(),
        deliveryOption,
      };

      await saveDeliveryInfo(deliveryInfo);

      const orderId = `order_${Date.now()}`;
      const now = new Date().toISOString();

      const pendingOrder: Farm2HomeOrder = {
        id: orderId,
        customerEmail:
          currentCustomer?.email || profile?.email || user?.email || "customer@test.com",
        customerName,
        items: cart,
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

      const payload = {
        cloudOrderId: orderId,
        customerEmail: pendingOrder.customerEmail,
        customerName: pendingOrder.customerName,
        customerId: currentCustomer?.id || user?.id || "",
        cart,
        cartGroups,
        subtotal,
        serviceFee,
        deliveryFee,
        freightHandlingFee,
        tip: tipAmount,
        total,
        deliveryOption,
        deliveryAddress: deliveryInfo.deliveryAddress,
        city: deliveryInfo.city,
        state: deliveryInfo.state,
        zipCode: deliveryInfo.zipCode,
        phone: deliveryInfo.phone,
        deliveryInstructions: deliveryInfo.deliveryInstructions,
        successUrl: `${APP_URL}/customer/order-confirmation?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${APP_URL}/customer/cart`,
      };

      const response = await fetch(
        `${API_BASE_URL}/payments/create-marketplace-checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success || !data.url) {
        throw new Error(data.error || "Unable to create Stripe checkout.");
      }

      if (deliveryOption === "Delivery") {
        await createDeliveryJobsForOrder({
          orderId,
          currentCustomer,
          customerName,
          deliveryInfo,
        });
      }

      if (Platform.OS === "web") {
        window.location.href = data.url;
      } else {
        await WebBrowser.openBrowserAsync(data.url);
      }
    } catch (error: any) {
      console.log("Stripe checkout error:", error);
      Alert.alert("Checkout Error", error.message || "Unable to start Stripe checkout.");
    } finally {
      setLoading(false);
    }
  }

  if (accessChecking) {
    return (
      <View style={styles.lockContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.lockText}>Checking subscription access...</Text>
      </View>
    );
  }

  if (!accessAllowed) {
    return (
      <View style={styles.lockContainer}>
        <Text style={styles.lockTitle}>Subscription Required</Text>
        <Text style={styles.lockText}>Redirecting to subscription page...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
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
            <Text style={styles.backCircleText}>‹</Text>
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
          <Text style={styles.heroBadge}>Secure Payment</Text>
          <Text style={styles.heroTitle}>Complete your Farm2Home order</Text>
          <Text style={styles.heroText}>
            Farm2Home keeps a 4% service fee and farmer payouts are split by Stripe account.
          </Text>
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

        {cartGroups.map((group) => {
          const farmSubtotal = group.items.reduce(
            (sum: number, item: any) =>
              sum + Number(item.price || 0) * Number(item.quantity || 0),
            0
          );

          const freightRequired = group.items.some((item: any) => isFreightEligibleItem(item));

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
                      {group.farmerStripeAccountId
                        ? "Stripe payout connected"
                        : "Stripe payout missing"}
                    </Text>
                    {freightRequired && (
                      <Text style={styles.freightMeta}>
                        Freight workflow required for this farm order
                      </Text>
                    )}
                  </View>
                </View>

                <Text style={styles.farmSubtotal}>${farmSubtotal.toFixed(2)}</Text>
              </View>

              {group.items.map((item: any) => (
                <View key={String(item.id || item.productId)} style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name || item.productName}</Text>

                    <Text style={styles.itemMeta}>
                      Qty {item.quantity} · ${Number(item.price || 0).toFixed(2)}
                      {item.unit ? ` / ${item.unit}` : " each"}
                    </Text>

                    <Text style={styles.accountMeta} numberOfLines={1}>
                      Farmer ID: {getFarmerId(item) || "Missing"}
                    </Text>
                  </View>

                  <Text style={styles.itemTotal}>
                    ${(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          );
        })}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Payment Summary</Text>

          <SummaryLine label="Subtotal" value={subtotal} />
          <SummaryLine label="Farm2Home Service Fee 4%" value={serviceFee} />
          <SummaryLine label="Delivery Fee" value={deliveryFee} />

          {freightHandlingFee > 0 && (
            <SummaryLine label="Freight Handling" value={freightHandlingFee} />
          )}

          <SummaryLine label="Tip" value={tipAmount} />

          <View style={styles.divider} />

          <View style={styles.totalLine}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
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
          placeholderTextColor="#8A9482"
          keyboardType="numeric"
          value={tip}
          onChangeText={setTip}
        />

        <Text style={styles.sectionTitle}>
          {deliveryOption === "Delivery" ? "Delivery Information" : "Pickup Contact"}
        </Text>

        {deliveryOption === "Delivery" && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Delivery Address"
              placeholderTextColor="#8A9482"
              value={deliveryAddress}
              onChangeText={setDeliveryAddress}
            />

            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.inputFlex]}
                placeholder="City"
                placeholderTextColor="#8A9482"
                value={city}
                onChangeText={setCity}
              />

              <TextInput
                style={[styles.input, styles.stateInput]}
                placeholder="State"
                placeholderTextColor="#8A9482"
                value={stateValue}
                onChangeText={setStateValue}
              />
            </View>

            <TextInput
              style={styles.input}
              placeholder="Zip Code"
              placeholderTextColor="#8A9482"
              keyboardType="numeric"
              value={zipCode}
              onChangeText={setZipCode}
            />
          </>
        )}

        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          placeholderTextColor="#8A9482"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Delivery / Pickup Instructions"
          placeholderTextColor="#8A9482"
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
            <Text style={styles.payButtonSubtext}>
              Secure Stripe marketplace payment
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.payAmount}>${total.toFixed(2)}</Text>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          onPress={() => router.push("/customer/cart" as any)}
        >
          <Text style={styles.backText}>Back to Cart</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SummaryLine({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryLine}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>${value.toFixed(2)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background || farmTheme.colors.background },
  scrollContent: { padding: 18, paddingBottom: 44 },
  lockContainer: {
    flex: 1,
    backgroundColor: COLORS.background || farmTheme.colors.background,
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
  },
  topBar: { flexDirection: "row", alignItems: "center", marginBottom: 18, gap: 12 },
  backCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backCircleText: {
    fontSize: 32,
    color: COLORS.text,
    fontWeight: "900",
    marginTop: -4,
  },
  topTitleBlock: { flex: 1 },
  title: { fontSize: 30, fontWeight: "900", color: COLORS.text },
  subtitle: { color: COLORS.muted, fontWeight: "700", marginTop: 3 },
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    color: "#FFFFFF",
    fontWeight: "900",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 10,
    fontSize: 12,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 30,
  },
  heroText: {
    color: "#EAF7E6",
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 8,
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  optionActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  optionText: { fontWeight: "900", color: COLORS.text, fontSize: 16 },
  optionTextActive: { color: "#FFFFFF" },
  optionSubtext: {
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 11,
    marginTop: 4,
    textAlign: "center",
  },
  optionSubtextActive: { color: "#EAF7E6" },
  farmCard: {
    backgroundColor: COLORS.card,
    padding: 15,
    borderRadius: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...farmTheme.shadow,
  },
  farmHeader: { marginBottom: 10 },
  farmTitleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  farmIconBox: {
    width: 52,
    height: 52,
    borderRadius: 15,
    backgroundColor: COLORS.primaryDark,
    justifyContent: "center",
    alignItems: "center",
  },
  farmInitial: { color: "#FFFFFF", fontWeight: "900", fontSize: 22 },
  farmNameBlock: { flex: 1 },
  farmTitle: { flex: 1, fontSize: 18, fontWeight: "900", color: COLORS.text },
  farmMeta: { color: COLORS.muted, fontWeight: "700", marginTop: 3, fontSize: 12 },
  freightMeta: {
    color: COLORS.primaryDark,
    fontWeight: "900",
    marginTop: 4,
    fontSize: 12,
  },
  farmSubtotal: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.primary,
    marginTop: 10,
    alignSelf: "flex-end",
  },
  itemRow: {
    backgroundColor: COLORS.lightGreen,
    padding: 13,
    borderRadius: 14,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: "900", color: COLORS.text, marginBottom: 3 },
  itemMeta: { color: COLORS.muted, fontWeight: "700", fontSize: 12 },
  accountMeta: {
    color: "#6B7280",
    fontWeight: "700",
    fontSize: 11,
    marginTop: 4,
  },
  itemTotal: { color: COLORS.primary, fontWeight: "900", fontSize: 15 },
  summaryCard: {
    backgroundColor: COLORS.card,
    padding: 18,
    borderRadius: 18,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...farmTheme.shadow,
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
  totalValue: { fontSize: 23, fontWeight: "900", color: COLORS.primary },
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
  tipButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tipText: { color: COLORS.primary, fontWeight: "900" },
  tipTextActive: { color: "#FFFFFF" },
  inputRow: { flexDirection: "row", gap: 10 },
  inputFlex: { flex: 1 },
  stateInput: { width: 92 },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 15,
    color: COLORS.text,
    fontWeight: "800",
    marginBottom: 12,
  },
  textArea: { minHeight: 94, textAlignVertical: "top" },
  payButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 17,
    borderRadius: 15,
    marginTop: 8,
    minHeight: 68,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  buttonDisabled: { backgroundColor: "#A7B8A2" },
  payButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 16 },
  payButtonSubtext: {
    color: "#EAF7E6",
    fontWeight: "700",
    marginTop: 3,
    fontSize: 12,
  },
  payAmount: { color: "#FFFFFF", fontWeight: "900", fontSize: 18 },
  backButton: { padding: 14 },
  backText: {
    marginTop: 6,
    textAlign: "center",
    color: COLORS.primary,
    fontWeight: "900",
  },
  pressed: { opacity: 0.75 },
});