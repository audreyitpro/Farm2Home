// app/customer/dashboard.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

/**
 * app/customer/dashboard.tsx
 *
 * Fina-style Customer Dashboard.
 *
 * Updates:
 * - Matches Freight/Fina UI color system: navy + purple, soft cards, light surfaces.
 * - Removes red/black customer dashboard theme.
 * - Customer marketplace access DOES NOT require account_id.
 * - Supabase order count queries use snake_case only: customer_id/customer_email.
 * - Avoids camelCase database filters like customerId/customerEmail.
 */

const COLORS = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  surface: "#F8FAFC",
  surface2: "#F1F5F9",
  primary: "#635BFF",
  primaryDark: "#4638D8",
  primarySoft: "#EEF2FF",
  accent: "#10B981",
  accentDark: "#047857",
  accentSoft: "#D1FAE5",
  warning: "#F59E0B",
  warningSoft: "#FEF3C7",
  danger: "#EF4444",
  dangerSoft: "#FEE2E2",
  blue: "#2563EB",
  blueSoft: "#DBEAFE",
  text: "#101828",
  muted: "#667085",
  border: "#E5E7EB",
  white: "#FFFFFF",
  navy: "#020617",
  navyCard: "#111827",
};

type CustomerSession = {
  id?: string;
  customerId?: string;
  customer_id?: string;
  account_id?: string;
  accountId?: string;
  full_name?: string;
  fullName?: string;
  name?: string;
  email?: string;
  customer_email?: string;
  phone?: string;
  username?: string;
  stripe_customer_id?: string;
  stripeCustomerId?: string;
  stripe_subscription_id?: string;
  stripeSubscriptionId?: string;
  subscription_id?: string;
  subscriptionId?: string;
  membership_status?: string;
  membershipStatus?: string;
  subscription_status?: string;
  subscriptionStatus?: string;
  account_active?: boolean;
  accountActive?: boolean;
  role?: string;
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

function maskId(value: any, fallback = "Missing") {
  const id = clean(value);
  if (!id) return fallback;
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}...${id.slice(-5)}`;
}

function getCustomerId(customer: CustomerSession | null) {
  return clean(customer?.id || customer?.customer_id || customer?.customerId);
}

function getAccountId(customer: CustomerSession | null) {
  return clean(customer?.account_id || customer?.accountId);
}

function getCustomerEmail(customer: CustomerSession | null) {
  return normalize(customer?.email || customer?.customer_email);
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

function getMembershipStatus(customer: CustomerSession | null) {
  return clean(customer?.membership_status || customer?.membershipStatus || "pending_payment");
}

function getSubscriptionStatus(customer: CustomerSession | null) {
  return clean(customer?.subscription_status || customer?.subscriptionStatus || "pending_payment");
}

function statusIsBlocked(value: any) {
  const status = normalize(value);
  return ["canceled", "cancelled", "unpaid", "inactive", "disabled", "rejected"].includes(status);
}

function statusIsAllowed(value: any) {
  const status = normalize(value);
  return ["active", "trialing", "past_due", "paid"].includes(status);
}

function hasMarketplaceAccess(customer: CustomerSession | null) {
  if (!customer) return false;

  const subscriptionStatus = getSubscriptionStatus(customer);
  const membershipStatus = getMembershipStatus(customer);

  return Boolean(
    getCustomerId(customer) &&
      isCus(getStripeCustomer(customer)) &&
      isSub(getStripeSubscription(customer)) &&
      customer.account_active !== false &&
      customer.accountActive !== false &&
      !statusIsBlocked(membershipStatus) &&
      !statusIsBlocked(subscriptionStatus) &&
      (statusIsAllowed(subscriptionStatus) || statusIsAllowed(membershipStatus))
  );
}

function buildSession(row: any): CustomerSession {
  const id = clean(row?.id || row?.customer_id || row?.customerId);
  const accountId = clean(row?.account_id || row?.accountId);
  const stripeCustomer = clean(row?.stripe_customer_id || row?.stripeCustomerId || row?.stripe_id);
  const stripeSubscription = clean(
    row?.subscription_id ||
      row?.subscriptionId ||
      row?.stripe_subscription_id ||
      row?.stripeSubscriptionId
  );

  const hasSub = isSub(stripeSubscription);
  const status = clean(row?.subscription_status || row?.subscriptionStatus || (hasSub ? "active" : "pending_payment"));
  const membership = clean(row?.membership_status || row?.membershipStatus || (hasSub ? "active" : "pending_payment"));

  return {
    ...row,
    id,
    customerId: id,
    customer_id: id,
    role: "customer",
    account_id: accountId,
    accountId,
    full_name: clean(row?.full_name || row?.fullName || row?.name || "Customer"),
    fullName: clean(row?.full_name || row?.fullName || row?.name || "Customer"),
    name: clean(row?.name || row?.full_name || row?.fullName || "Customer"),
    email: normalize(row?.email || row?.customer_email),
    customer_email: normalize(row?.customer_email || row?.email),
    stripe_customer_id: isCus(stripeCustomer) ? stripeCustomer : "",
    stripeCustomerId: isCus(stripeCustomer) ? stripeCustomer : "",
    subscription_id: hasSub ? stripeSubscription : "",
    subscriptionId: hasSub ? stripeSubscription : "",
    stripe_subscription_id: hasSub ? stripeSubscription : "",
    stripeSubscriptionId: hasSub ? stripeSubscription : "",
    membership_status: membership,
    membershipStatus: membership,
    subscription_status: status,
    subscriptionStatus: status,
    account_active: row?.account_active !== false,
    accountActive: row?.account_active !== false,
  };
}

export default function CustomerDashboard() {
  const [customer, setCustomer] = useState<CustomerSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);

  const customerName = useMemo(() => getCustomerName(customer), [customer]);
  const ready = useMemo(() => hasMarketplaceAccess(customer), [customer]);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function saveCustomerSession(nextCustomer: CustomerSession) {
    const session = buildSession(nextCustomer);

    await AsyncStorage.multiSet([
      ["currentCustomer", JSON.stringify(session)],
      ["farm2homeCurrentCustomer", JSON.stringify(session)],
      ["currentUser", JSON.stringify(session)],
      ["userRole", "customer"],
      ["currentUserRole", "customer"],
      ["lastLoginRole", "customer"],
      ["lastCustomerDashboardReady", hasMarketplaceAccess(session) ? "true" : "false"],
    ]);

    setCustomer(session);
    return session;
  }

  async function loadDashboard() {
    try {
      setLoading(true);

      const stored =
        (await AsyncStorage.getItem("currentCustomer")) ||
        (await AsyncStorage.getItem("farm2homeCurrentCustomer")) ||
        (await AsyncStorage.getItem("pendingCustomer")) ||
        (await AsyncStorage.getItem("currentUser"));

      let localCustomer: CustomerSession | null = null;

      if (stored) {
        try {
          localCustomer = buildSession(JSON.parse(stored));
          setCustomer(localCustomer);
        } catch {
          localCustomer = null;
        }
      }

      const { data: authData } = await supabase.auth.getUser();
      const authId = clean(authData?.user?.id);
      const authEmail = normalize(authData?.user?.email || localCustomer?.email);

      const dbCustomer = await fetchCustomer(authId || getCustomerId(localCustomer), authEmail);

      if (dbCustomer) {
        const sub = await fetchCustomerSubscription(dbCustomer.id, dbCustomer.email);
        const merged = buildSession({
          ...dbCustomer,
          stripe_customer_id: dbCustomer.stripe_customer_id || dbCustomer.stripe_id || sub?.stripe_customer_id,
          stripe_subscription_id: dbCustomer.stripe_subscription_id || dbCustomer.subscription_id || sub?.stripe_subscription_id,
          subscription_id: dbCustomer.subscription_id || dbCustomer.stripe_subscription_id || sub?.stripe_subscription_id,
          subscription_status: dbCustomer.subscription_status || sub?.subscription_status,
          membership_status:
            dbCustomer.membership_status ||
            (sub?.subscription_status && ["active", "trialing", "past_due"].includes(normalize(sub.subscription_status))
              ? "active"
              : dbCustomer.membership_status),
          current_period_end: sub?.current_period_end,
        });

        await saveCustomerSession(merged);
        await loadCounts(merged);
        return;
      }

      if (localCustomer) {
        await loadCounts(localCustomer);
      }
    } catch (error) {
      console.log("Customer dashboard load error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCustomer(id?: string, email?: string) {
    const lookupId = clean(id);
    const lookupEmail = normalize(email);

    if (lookupId) {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .or(`id.eq.${lookupId},auth_user_id.eq.${lookupId},profile_id.eq.${lookupId},customer_id.eq.${lookupId}`)
        .limit(1);

      if (!error && Array.isArray(data) && data[0]) return data[0];
      if (error) console.log("dashboard customer id lookup:", error.message);
    }

    if (lookupEmail) {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("email", lookupEmail)
        .limit(1);

      if (!error && Array.isArray(data) && data[0]) return data[0];
      if (error) console.log("dashboard customer email lookup:", error.message);
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
      if (error) console.log("dashboard customer subscription lookup:", error.message);
    } catch (error) {
      console.log("dashboard subscription skipped:", error);
    }

    return null;
  }

  async function loadCounts(activeCustomer: CustomerSession) {
    const id = getCustomerId(activeCustomer);
    const email = getCustomerEmail(activeCustomer);

    await loadCartCount();

    if (!id && !email) return;

    const orderTables = ["orders", "customer_orders", "farm_orders"];

    for (const table of orderTables) {
      try {
        let query = supabase
          .from(table)
          .select("id,status,order_status,fulfillment_status,payment_status,customer_id,customer_email")
          .limit(100);

        if (id && email) {
          query = query.or(`customer_id.eq.${id},customer_email.eq.${email}`);
        } else if (id) {
          query = query.eq("customer_id", id);
        } else if (email) {
          query = query.eq("customer_email", email);
        }

        const { data, error } = await query;

        if (!error && Array.isArray(data)) {
          setOrdersCount(data.length);
          setActiveOrdersCount(
            data.filter((order) => {
              const status = normalize(
                order?.order_status ||
                  order?.fulfillment_status ||
                  order?.status ||
                  order?.payment_status
              );
              return !["delivered", "complete", "completed", "cancelled", "canceled"].includes(status);
            }).length
          );
          return;
        }

        if (error) console.log(`${table} count skipped:`, error.message);
      } catch (error) {
        console.log(`${table} count exception:`, error);
      }
    }

    setOrdersCount(0);
    setActiveOrdersCount(0);
  }

  async function loadCartCount() {
    try {
      const savedCart =
        (await AsyncStorage.getItem("customerCart")) ||
        (await AsyncStorage.getItem("cart")) ||
        (await AsyncStorage.getItem("farm2homeCart"));

      if (!savedCart) {
        setCartCount(0);
        return;
      }

      const parsed = JSON.parse(savedCart);
      if (Array.isArray(parsed)) {
        setCartCount(parsed.length);
        return;
      }

      if (Array.isArray(parsed?.items)) {
        setCartCount(parsed.items.length);
        return;
      }

      setCartCount(0);
    } catch {
      setCartCount(0);
    }
  }

  function requireAccess(route: string) {
    if (!customer) {
      Alert.alert("Login Required", "Please login as a customer first.");
      router.replace("/customer/login" as any);
      return;
    }

    if (!ready && route !== "/customer/profile") {
      Alert.alert(
        "Membership Required",
        "Your customer membership is not complete. Register or retrieve your Stripe subscription before using this section.",
        [
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
        ]
      );
      return;
    }

    router.push(route as any);
  }

  async function logout() {
    Alert.alert("Log Out", "Log out of your customer account?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
          await AsyncStorage.multiRemove([
            "currentCustomer",
            "farm2homeCurrentCustomer",
            "pendingCustomer",
            "currentUser",
            "userRole",
            "currentUserRole",
            "lastLoginRole",
            "lastCustomerDashboardReady",
          ]);
          router.replace("/customer/login" as any);
        },
      },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
          <Text style={styles.centerText}>Loading customer dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Ionicons name="basket-outline" size={34} color={COLORS.white} />
            </View>

            <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.85}>
              <Ionicons name="log-out-outline" size={18} color={COLORS.white} />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.kicker}>Fina Customer Operations</Text>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.customerName}>{customerName}</Text>

          <Text style={styles.subtitle}>
            Shop local farms, track orders, manage cart, chat with farmers and drivers, and support your local farming community.
          </Text>

          <View style={styles.heroStatus}>
            <View style={[styles.statusPill, ready ? styles.statusPillGood : styles.statusPillWarn]}>
              <Ionicons
                name={ready ? "checkmark-circle-outline" : "warning-outline"}
                size={17}
                color={ready ? COLORS.accentDark : "#92400E"}
              />
              <Text style={[styles.statusPillText, ready ? styles.statusPillTextGood : styles.statusPillTextWarn]}>
                {ready ? "Marketplace Ready" : "Membership Needs Attention"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <MetricCard icon="cart-outline" label="Cart" value={`${cartCount} items`} tone="green" />
          <MetricCard icon="receipt-outline" label="Orders" value={`${ordersCount}`} tone="blue" />
          <MetricCard icon="navigate-outline" label="Active" value={`${activeOrdersCount}`} tone="primary" />
        </View>

        <View style={styles.accessCard}>
          <View style={styles.accessHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Account Access</Text>
              <Text style={styles.sectionSubtitle}>Customer marketplace requirements. Account ID is optional.</Text>
            </View>
            <Text style={styles.accessScore}>
              {[
                getCustomerId(customer),
                isCus(getStripeCustomer(customer)),
                isSub(getStripeSubscription(customer)),
                ready,
              ].filter(Boolean).length}
              /4
            </Text>
          </View>

          <ChecklistRow label="Customer Profile" value={getCustomerId(customer) ? "Found" : "Missing"} complete={Boolean(getCustomerId(customer))} />
          <ChecklistRow label="Static Account" value={getAccountId(customer) || "Optional"} complete={Boolean(getAccountId(customer))} optional />
          <ChecklistRow label="Stripe Customer" value={maskId(getStripeCustomer(customer))} complete={isCus(getStripeCustomer(customer))} />
          <ChecklistRow label="Subscription" value={maskId(getStripeSubscription(customer))} complete={isSub(getStripeSubscription(customer))} />
          <ChecklistRow label="Membership Status" value={getSubscriptionStatus(customer)} complete={ready} />
        </View>

        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <Text style={styles.sectionSubtitle}>Every button below routes to a customer workflow.</Text>

          <ActionButton
            primary
            icon="storefront-outline"
            title="Shop Marketplace"
            subtitle="Browse farmers, products, produce, and local grocery items."
            onPress={() => requireAccess("/customer/marketplace")}
          />

          <View style={styles.actionGrid}>
            <ActionButton
              icon="cart-outline"
              title="Cart"
              subtitle={`${cartCount} saved items`}
              onPress={() => requireAccess("/customer/cart")}
            />
            <ActionButton
              icon="receipt-outline"
              title="My Orders"
              subtitle="View order history"
              onPress={() => requireAccess("/customer/my-orders")}
            />
            <ActionButton
              icon="navigate-outline"
              title="Tracking"
              subtitle="Track active deliveries"
              onPress={() => requireAccess("/customer/tracking")}
            />
            <ActionButton
              icon="chatbubbles-outline"
              title="Farmer Chat"
              subtitle="Message farmers"
              onPress={() => requireAccess("/customer/farmer-chat")}
            />
            <ActionButton
              icon="car-outline"
              title="Driver Chat"
              subtitle="Message delivery driver"
              onPress={() => requireAccess("/customer/driver-chat")}
            />
            <ActionButton
              icon="person-outline"
              title="Profile"
              subtitle="Address, phone, membership"
              onPress={() => requireAccess("/customer/profile")}
            />
            <ActionButton
              icon="heart-outline"
              title="Favorites"
              subtitle="Saved farms and products"
              onPress={() => requireAccess("/customer/favorites")}
            />
            <ActionButton
              icon="card-outline"
              title="Membership"
              subtitle="Fix Stripe subscription"
              onPress={() =>
                router.push({
                  pathname: "/customer/register" as any,
                  params: {
                    customerId: getCustomerId(customer),
                    email: customer?.email || "",
                  },
                })
              }
            />
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <Ionicons name="leaf-outline" size={22} color={COLORS.accentDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>Farm2Home Benefits</Text>
            <Text style={styles.infoText}>
              Buy directly from local farmers, shop fresh produce and farm goods, choose pickup or delivery, and track your order from checkout to delivery.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tone: "green" | "blue" | "primary";
}) {
  const color = tone === "green" ? COLORS.accent : tone === "blue" ? COLORS.blue : COLORS.primary;
  const bg = tone === "green" ? COLORS.accentSoft : tone === "blue" ? COLORS.blueSoft : COLORS.primarySoft;

  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
    </View>
  );
}

function ChecklistRow({
  label,
  value,
  complete,
  optional,
}: {
  label: string;
  value: string;
  complete: boolean;
  optional?: boolean;
}) {
  return (
    <View style={styles.checkRow}>
      <View style={[styles.checkIcon, complete ? styles.checkGood : optional ? styles.checkOptional : styles.checkMissing]}>
        <Ionicons
          name={complete ? "checkmark-outline" : optional ? "remove-outline" : "ellipse-outline"}
          size={15}
          color={complete || optional ? COLORS.white : COLORS.muted}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.checkLabel}>{label}</Text>
        <Text style={styles.checkValue}>{value}</Text>
      </View>
    </View>
  );
}

function ActionButton({
  icon,
  title,
  subtitle,
  onPress,
  primary,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionButton, primary && styles.primaryAction]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={[styles.actionIcon, primary && styles.primaryActionIcon]}>
        <Ionicons name={icon} size={22} color={primary ? COLORS.white : COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.actionTitle, primary && styles.primaryActionTitle]}>{title}</Text>
        <Text style={[styles.actionSubtitle, primary && styles.primaryActionSubtitle]}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward-outline" size={18} color={primary ? COLORS.white : COLORS.muted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  page: {
    flex: 1,
  },
  content: {
    paddingBottom: 70,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.bg,
  },
  centerText: {
    color: COLORS.muted,
    fontWeight: "800",
  },
  hero: {
    backgroundColor: COLORS.navy,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  logoutButton: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  logoutText: {
    color: COLORS.white,
    fontWeight: "900",
  },
  kicker: {
    color: "#A5B4FC",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    color: "#E0E7FF",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 8,
  },
  customerName: {
    color: COLORS.white,
    fontSize: 34,
    fontWeight: "900",
    marginTop: 2,
    marginBottom: 10,
  },
  subtitle: {
    color: "#CBD5E1",
    lineHeight: 22,
    fontWeight: "700",
  },
  heroStatus: {
    marginTop: 16,
    flexDirection: "row",
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  statusPillGood: {
    backgroundColor: COLORS.accentSoft,
  },
  statusPillWarn: {
    backgroundColor: COLORS.warningSoft,
  },
  statusPillText: {
    fontWeight: "900",
  },
  statusPillTextGood: {
    color: COLORS.accentDark,
  },
  statusPillTextWarn: {
    color: "#92400E",
  },
  metricsRow: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: 12,
    paddingHorizontal: 18,
    marginTop: 18,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  metricIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
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
    marginTop: 3,
  },
  accessCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  accessHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  accessScore: {
    color: COLORS.primary,
    fontSize: 24,
    fontWeight: "900",
  },
  checkRow: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  checkIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  checkGood: {
    backgroundColor: COLORS.accent,
  },
  checkOptional: {
    backgroundColor: COLORS.primary,
  },
  checkMissing: {
    backgroundColor: "#E5E7EB",
  },
  checkLabel: {
    color: COLORS.text,
    fontWeight: "900",
  },
  checkValue: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 2,
  },
  quickActions: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    position: "relative",
    zIndex: 1,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.text,
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 3,
    marginBottom: 14,
  },
  actionGrid: {
    flexDirection: "column",
    gap: 10,
    paddingBottom: 4,
  },
  actionButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 0,
    width: "100%",
    flexGrow: 0,
  },
  primaryAction: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    marginBottom: 12,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionIcon: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  actionTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 15,
  },
  primaryActionTitle: {
    color: COLORS.white,
  },
  actionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 2,
  },
  primaryActionSubtitle: {
    color: "#E0E7FF",
  },
  infoCard: {
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 22,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 2,
    marginBottom: 28,
    flexDirection: "row",
    gap: 12,
    position: "relative",
    zIndex: 0,
  },
  infoIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
  },
  infoTitle: {
    color: COLORS.accentDark,
    fontWeight: "900",
    marginBottom: 6,
    fontSize: 17,
  },
  infoText: {
    color: "#065F46",
    fontWeight: "700",
    lineHeight: 21,
  },
});
