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

type CurrentCustomer = {
  id?: string;
  email?: string;
  fullName?: string;
  name?: string;
};

type CartGroup = {
  farmName: string;
  items: CartItem[];
};

function safelyParseCustomer(rawValue: string | null): CurrentCustomer | null {
  if (!rawValue) return null;

  try {
    return JSON.parse(rawValue);
  } catch (error) {
    console.log("Customer parse error:", error);
    return null;
  }
}

function groupCartByFarm(cart: CartItem[]): CartGroup[] {
  const grouped: Record<string, CartItem[]> = {};

  cart.forEach((item: any) => {
    const farmName = item.farmName || item.farmerName || "Farm2Home Farm";
    if (!grouped[farmName]) grouped[farmName] = [];
    grouped[farmName].push(item);
  });

  return Object.entries(grouped).map(([farmName, items]) => ({
    farmName,
    items,
  }));
}

function calculateDriverPayout(miles: number) {
  if (miles > 20) return 25;
  if (miles > 10) return 18;
  if (miles > 5) return 12;
  return 8;
}

export default function CustomerCheckout() {
  const { user, profile } = useAuth();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [accessChecking, setAccessChecking] = useState(true);
  const [accessAllowed, setAccessAllowed] = useState(false);

  const [deliveryOption, setDeliveryOption] = useState<"Delivery" | "Pickup">(
    "Delivery"
  );

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
    } catch (error) {
      console.log("Checkout access error:", error);
      setAccessAllowed(false);
    } finally {
      setAccessChecking(false);
    }
  }

  async function loadCart() {
    try {
      const cartData = await getCart();
      setCart(cartData);
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
      (sum, item: any) =>
        sum + Number(item.price || 0) * Number(item.quantity || 0),
      0
    );
  }, [cart]);

  const serviceFee = subtotal * SERVICE_FEE_RATE;
  const deliveryFee =
    deliveryOption === "Delivery" && cart.length > 0 ? 5.99 : 0;
  const tipAmount = Number(tip) || 0;
  const total = subtotal + serviceFee + deliveryFee + tipAmount;

  async function createDeliveryJobsForOrder(params: {
    orderId: string;
    currentCustomer: CurrentCustomer | null;
    customerName: string;
    deliveryInfo: DeliveryInfo;
  }) {
    if (deliveryOption !== "Delivery") return;

    try {
      const farmerGroups: Record<string, any[]> = {};

      cart.forEach((item: any) => {
        const farmerId =
          item.farmerId ||
          item.farmId ||
          item.farmer_id ||
          item.farmerStripeAccountId ||
          "unknown_farmer";

        if (!farmerGroups[farmerId]) farmerGroups[farmerId] = [];
        farmerGroups[farmerId].push(item);
      });

      const dropoffAddress =
        `${params.deliveryInfo.deliveryAddress}, ` +
        `${params.deliveryInfo.city}, ` +
        `${params.deliveryInfo.state} ` +
        `${params.deliveryInfo.zipCode}`;

      for (const farmerId of Object.keys(farmerGroups)) {
        const farmerItems = farmerGroups[farmerId];
        const firstItem: any = farmerItems[0];

        const farmName =
          firstItem?.farmName || firstItem?.farmerName || "Farm2Home Farm";

        const miles = Number(firstItem?.distanceMiles || firstItem?.miles || 0);
        const payoutAmount = calculateDriverPayout(miles);

        const pickupAddress =
          firstItem?.farmAddress ||
          firstItem?.pickupAddress ||
          firstItem?.farmLocation ||
          "Farm pickup location";

        const deliveryJobPayload = {
          orderId: params.orderId,
          farmerId,
          customerId: params.currentCustomer?.id || "",
          farmName,
          customerName: params.customerName,
          customerPhone: params.deliveryInfo.phone,
          pickupAddress,
          dropoffAddress,
          deliveryWindow: "Same Day Delivery",
          payoutAmount,
          miles,
          pickupNotes: "Pickup customer grocery order from farm.",
          deliveryNotes: params.deliveryInfo.deliveryInstructions || "",
        };

        const response = await fetch(`${API_BASE_URL}/driver/create-delivery-job`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(deliveryJobPayload),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          console.log("DELIVERY JOB CREATE FAILED:", data);
        }
      }
    } catch (error) {
      console.log("Delivery job creation error:", error);
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
      (!deliveryAddress.trim() ||
        !city.trim() ||
        !stateValue.trim() ||
        !zipCode.trim())
    ) {
      Alert.alert(
        "Missing Delivery Info",
        "Please enter the full delivery address."
      );
      return;
    }

    const invalidItems = cart.filter(
      (item: any) => !item.farmerStripeAccountId && !item.stripeAccountId
    );

    if (invalidItems.length > 0) {
      Alert.alert(
        "Marketplace Setup Error",
        "Some cart items are missing farmer Stripe account IDs. Go back to Marketplace, clear the cart, and add the items again."
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
        currentCustomer?.fullName ||
        currentCustomer?.name ||
        "Farm2Home Customer";

      const deliveryInfo: DeliveryInfo = {
        deliveryAddress:
          deliveryOption === "Delivery" ? deliveryAddress.trim() : "Pickup",
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
          currentCustomer?.email ||
          profile?.email ||
          user?.email ||
          "customer@test.com",
        customerName,
        items: cart,
        subtotal,
        deliveryFee,
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
        cart,
        subtotal,
        serviceFee,
        deliveryFee,
        tip: tipAmount,
        total,
        deliveryOption,
        deliveryAddress: deliveryInfo.deliveryAddress,
        city: deliveryInfo.city,
        state: deliveryInfo.state,
        zipCode: deliveryInfo.zipCode,
        phone: deliveryInfo.phone,
        deliveryInstructions: deliveryInfo.deliveryInstructions,
        successUrl: `${APP_URL}/customer/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${APP_URL}/customer/cart`,
      };

      const response = await fetch(
        `${API_BASE_URL}/payments/create-marketplace-checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
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

      Alert.alert(
        "Checkout Error",
        error.message || "Unable to start Stripe checkout."
      );
    } finally {
      setLoading(false);
    }
  }

  if (accessChecking) {
    return (
      <View style={styles.lockContainer}>
        <ActivityIndicator size="large" color={farmTheme.colors.primary} />
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
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Marketplace Checkout</Text>

        <Text style={styles.subtitle}>
          Pay once. Farm2Home keeps a 4% service fee and Stripe splits farmer
          payouts by each farmer account. Delivery orders can route to preferred
          farmer drivers or the open driver board.
        </Text>

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
          </Pressable>
        </View>

        <Text style={styles.section}>Farm Orders</Text>

        {cart.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Your cart is empty.</Text>
            <Text style={styles.emptyText}>
              Add items from the marketplace before checkout.
            </Text>
          </View>
        ) : (
          cartGroups.map((group) => {
            const farmSubtotal = group.items.reduce(
              (sum, item: any) =>
                sum + Number(item.price || 0) * Number(item.quantity || 0),
              0
            );

            return (
              <View key={group.farmName} style={styles.farmCard}>
                <View style={styles.farmHeader}>
                  <Text style={styles.farmTitle}>🚜 {group.farmName}</Text>
                  <Text style={styles.farmSubtotal}>
                    ${farmSubtotal.toFixed(2)}
                  </Text>
                </View>

                {group.items.map((item: any) => (
                  <View key={item.id} style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.name}</Text>

                      <Text style={styles.itemMeta}>
                        Qty {item.quantity} · $
                        {Number(item.price || 0).toFixed(2)} each
                      </Text>

                      <Text style={styles.accountMeta} numberOfLines={1}>
                        Farmer Stripe:{" "}
                        {item.farmerStripeAccountId ||
                          item.stripeAccountId ||
                          "Missing"}
                      </Text>
                    </View>

                    <Text style={styles.itemTotal}>
                      $
                      {(
                        Number(item.price || 0) * Number(item.quantity || 0)
                      ).toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })
        )}

        <View style={styles.totalBox}>
          <Text style={styles.totalTitle}>Payment Summary</Text>

          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>${subtotal.toFixed(2)}</Text>
          </View>

          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Farm2Home Service Fee 4%</Text>
            <Text style={styles.summaryValue}>${serviceFee.toFixed(2)}</Text>
          </View>

          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Delivery Fee</Text>
            <Text style={styles.summaryValue}>${deliveryFee.toFixed(2)}</Text>
          </View>

          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Tip</Text>
            <Text style={styles.summaryValue}>${tipAmount.toFixed(2)}</Text>
          </View>

          <View style={styles.totalLine}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
          </View>
        </View>

        <Text style={styles.section}>Add Tip</Text>

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
          placeholderTextColor="#8A8F98"
          keyboardType="numeric"
          value={tip}
          onChangeText={setTip}
        />

        <Text style={styles.section}>
          {deliveryOption === "Delivery"
            ? "Delivery Information"
            : "Pickup Contact"}
        </Text>

        {deliveryOption === "Delivery" && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Delivery Address"
              placeholderTextColor="#8A8F98"
              value={deliveryAddress}
              onChangeText={setDeliveryAddress}
            />

            <TextInput
              style={styles.input}
              placeholder="City"
              placeholderTextColor="#8A8F98"
              value={city}
              onChangeText={setCity}
            />

            <TextInput
              style={styles.input}
              placeholder="State"
              placeholderTextColor="#8A8F98"
              value={stateValue}
              onChangeText={setStateValue}
            />

            <TextInput
              style={styles.input}
              placeholder="Zip Code"
              placeholderTextColor="#8A8F98"
              keyboardType="numeric"
              value={zipCode}
              onChangeText={setZipCode}
            />
          </>
        )}

        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          placeholderTextColor="#8A8F98"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Delivery / Pickup Instructions"
          placeholderTextColor="#8A8F98"
          multiline
          value={deliveryInstructions}
          onChangeText={setDeliveryInstructions}
        />

        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.pressed,
            (loading || cart.length === 0) && styles.buttonDisabled,
          ]}
          onPress={handleStripeCheckout}
          disabled={loading || cart.length === 0}
        >
          <Text style={styles.buttonText}>
            {loading ? "Opening Stripe Checkout..." : "Pay Now with Card"}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          onPress={() => router.push("/customer/cart" as any)}
        >
          <Text style={styles.backText}>Back to Cart</Text>
        </Pressable>

        <Text style={styles.cardNote}>
          Production mode: use a real card in Stripe Live Mode.
        </Text>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 18,
    backgroundColor: farmTheme.colors.background,
  },
  lockContainer: {
    flex: 1,
    backgroundColor: farmTheme.colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  lockTitle: {
    color: "#991B1B",
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
  },
  lockText: {
    marginTop: 14,
    color: farmTheme.colors.mutedText,
    fontWeight: "800",
    textAlign: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: farmTheme.colors.primary,
    marginBottom: 8,
  },
  subtitle: {
    color: farmTheme.colors.mutedText,
    lineHeight: 22,
    marginBottom: 16,
    fontWeight: "700",
  },
  optionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  optionButton: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 15,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    alignItems: "center",
  },
  optionActive: {
    backgroundColor: farmTheme.colors.primary,
    borderColor: farmTheme.colors.primary,
  },
  optionText: {
    fontWeight: "900",
    color: farmTheme.colors.text,
  },
  optionTextActive: {
    color: "#FFFFFF",
  },
  section: {
    fontSize: 21,
    fontWeight: "900",
    color: farmTheme.colors.text,
    marginBottom: 10,
    marginTop: 10,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    marginBottom: 14,
    ...farmTheme.shadow,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: farmTheme.colors.text,
    marginBottom: 6,
  },
  emptyText: {
    color: farmTheme.colors.mutedText,
    lineHeight: 22,
  },
  farmCard: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 24,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },
  farmHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 10,
  },
  farmTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "900",
    color: farmTheme.colors.primary,
  },
  farmSubtotal: {
    fontSize: 18,
    fontWeight: "900",
    color: farmTheme.colors.text,
  },
  itemRow: {
    backgroundColor: farmTheme.colors.primaryLight,
    padding: 13,
    borderRadius: 16,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "900",
    color: farmTheme.colors.text,
    marginBottom: 3,
  },
  itemMeta: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
  },
  accountMeta: {
    color: "#6B7280",
    fontWeight: "700",
    fontSize: 11,
    marginTop: 4,
  },
  itemTotal: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
    fontSize: 15,
  },
  totalBox: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 24,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
  },
  totalTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: farmTheme.colors.text,
    marginBottom: 12,
  },
  summaryLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 12,
  },
  summaryLabel: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    flex: 1,
  },
  summaryValue: {
    color: farmTheme.colors.text,
    fontWeight: "900",
  },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: farmTheme.colors.border,
    paddingTop: 12,
    marginTop: 8,
    gap: 12,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: "900",
    color: farmTheme.colors.text,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: "900",
    color: farmTheme.colors.primary,
  },
  tipRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  tipButton: {
    flex: 1,
    backgroundColor: farmTheme.colors.primaryLight,
    padding: 13,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#CDE8D2",
  },
  tipButtonActive: {
    backgroundColor: farmTheme.colors.primary,
    borderColor: farmTheme.colors.primary,
  },
  tipText: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
  },
  tipTextActive: {
    color: "#FFFFFF",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    borderRadius: 16,
    padding: 14,
    color: farmTheme.colors.text,
    fontWeight: "700",
    marginBottom: 12,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  button: {
    backgroundColor: farmTheme.colors.primary,
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 8,
    minHeight: 58,
    justifyContent: "center",
  },
  buttonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  backButton: {
    padding: 12,
  },
  backText: {
    marginTop: 8,
    textAlign: "center",
    color: farmTheme.colors.primary,
    fontWeight: "900",
  },
  cardNote: {
    textAlign: "center",
    color: farmTheme.colors.mutedText,
    marginTop: 12,
    marginBottom: 30,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.75,
  },
  bottomSpace: {
    height: 40,
  },
});