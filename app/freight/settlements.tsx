// app/freight/settlements.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const FREIGHT_ROUTES = {
  dashboard: "/freight/dashboard",
  managementCenter: "/freight/freight-management-center",
  board: "/freight/board",
  myLoads: "/freight/my-loads",
  liveLoads: "/freight/live-loads",
  routeDetails: "/freight/route-details",

  earnings: "/freight/earnings",
  settlements: "/freight/settlements",
  payoutCenter: "/freight/payout-center",
  analytics: "/freight/analytics",
  deliveryHistory: "/freight/delivery-history",

  connectBank: "/freight/connect-bank",
  subscription: "/freight/subscription",
  profile: "/freight/profile",
  settings: "/freight/settings",
  support: "/freight/support",
  help: "/freight/help",

  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];
type FreightLoad = Record<string, any>;

const COLORS = {
  bg: "#F7F7FB",
  card: "#FFFFFF",
  panel: "#F8FAFC",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E5E7EB",
  primary: "#6D5DFB",
  primaryDark: "#4F46E5",
  primarySoft: "#EEF2FF",
  green: "#10B981",
  greenSoft: "#ECFDF5",
  amber: "#F59E0B",
  amberSoft: "#FFFBEB",
  red: "#EF4444",
  redSoft: "#FEF2F2",
  blue: "#2563EB",
  navy: "#020617",
  slate: "#64748B",
  white: "#FFFFFF",
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

function pickCus(...values: any[]) {
  const found = values.find((value) => isCus(value));
  return found ? clean(found) : "";
}

function pickSub(...values: any[]) {
  const found = values.find((value) => isSub(value));
  return found ? clean(found) : "";
}

function pickAcct(...values: any[]) {
  const found = values.find((value) => isAcct(value));
  return found ? clean(found) : "";
}

function boolValue(...values: any[]) {
  const found = values.find((value) => value !== undefined && value !== null);
  if (typeof found === "string") return ["true", "1", "yes", "enabled", "complete"].includes(normalize(found));
  return Boolean(found);
}

function isActiveStatus(status: any) {
  return ["active", "trialing", "past_due"].includes(normalize(status));
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

function money(value: any) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function shortId(value?: string) {
  const id = clean(value);
  if (!id) return "Missing";
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}...${id.slice(-5)}`;
}

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleDateString();
}

function settlementStatus(load: FreightLoad) {
  return load.settlement_status || load.payout_status || "pending";
}

function settlementAmount(load: FreightLoad) {
  return Number(
    load.rate ||
      load.freight_total ||
      load.total_due ||
      load.payoutAmount ||
      load.payout_amount ||
      load.driver_payout ||
      load.carrier_payout ||
      load.total ||
      0
  );
}

function statusColor(status: string) {
  const value = normalize(status);

  if (["paid", "settled", "complete", "completed"].includes(value)) return COLORS.green;
  if (["processing", "in_transit"].includes(value)) return COLORS.blue;
  if (["disputed", "failed", "rejected", "chargeback"].includes(value)) return COLORS.red;
  if (["hold", "held", "review", "pending_review"].includes(value)) return COLORS.amber;

  return COLORS.amber;
}

function statusLabel(status: any) {
  return String(status || "pending")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function FreightSettlementsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [carrier, setCarrier] = useState<any>(null);
  const [loads, setLoads] = useState<FreightLoad[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadSettlements();
    }, [])
  );

  const stripeCustomerId = useMemo(
    () => pickCus(carrier?.stripeCustomerId, carrier?.stripe_customer_id, carrier?.stripeId, carrier?.stripe_id),
    [carrier]
  );

  const stripeSubscriptionId = useMemo(
    () => pickSub(carrier?.stripeSubscriptionId, carrier?.stripe_subscription_id, carrier?.subscriptionId, carrier?.subscription_id),
    [carrier]
  );

  const stripeAccountId = useMemo(
    () => pickAcct(carrier?.stripeAccountId, carrier?.stripe_account_id, carrier?.freightAccount, carrier?.freight_account),
    [carrier]
  );

  const payoutsReady = useMemo(
    () => boolValue(carrier?.payoutsEnabled, carrier?.payouts_enabled, carrier?.stripe_payouts_enabled),
    [carrier]
  );

  const chargesReady = useMemo(
    () => boolValue(carrier?.chargesEnabled, carrier?.charges_enabled, carrier?.stripe_charges_enabled),
    [carrier]
  );

  const onboardingReady = useMemo(
    () => boolValue(carrier?.onboardingComplete, carrier?.stripe_onboarding_complete),
    [carrier]
  );

  const stats = useMemo(() => {
    const paid = loads.filter((item) =>
      ["paid", "settled", "complete", "completed"].includes(normalize(settlementStatus(item)))
    );

    const pending = loads.filter((item) =>
      ["pending", "pending_review", "processing", "", "hold", "held", "review"].includes(normalize(settlementStatus(item)))
    );

    const disputed = loads.filter((item) =>
      ["disputed", "failed", "rejected", "chargeback"].includes(normalize(settlementStatus(item)))
    );

    return {
      total: loads.length,
      paidCount: paid.length,
      pendingCount: pending.length,
      disputedCount: disputed.length,
      paidValue: paid.reduce((sum, item) => sum + settlementAmount(item), 0),
      pendingValue: pending.reduce((sum, item) => sum + settlementAmount(item), 0),
      disputedValue: disputed.reduce((sum, item) => sum + settlementAmount(item), 0),
      totalValue: loads.reduce((sum, item) => sum + settlementAmount(item), 0),
    };
  }, [loads]);

  const setupScore = useMemo(() => {
    let score = 0;
    if (carrier?.id || carrier?.freightId || carrier?.freight_id) score += 20;
    if (stripeCustomerId) score += 20;
    if (stripeSubscriptionId) score += 20;
    if (stripeAccountId) score += 20;
    if (payoutsReady && chargesReady && onboardingReady) score += 20;
    return score;
  }, [carrier, stripeCustomerId, stripeSubscriptionId, stripeAccountId, payoutsReady, chargesReady, onboardingReady]);

  async function getStoredCarrier() {
    const raw =
      (await AsyncStorage.getItem("currentFreightCarrier")) ||
      (await AsyncStorage.getItem("currentFreight")) ||
      (await AsyncStorage.getItem("currentFreightUser")) ||
      (await AsyncStorage.getItem("farm2homeCurrentFreight")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function saveFreightSession(nextCarrier: any) {
    await AsyncStorage.setItem("currentFreight", JSON.stringify(nextCarrier));
    await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(nextCarrier));
    await AsyncStorage.setItem("currentFreightUser", JSON.stringify(nextCarrier));
    await AsyncStorage.setItem("farm2homeCurrentFreight", JSON.stringify(nextCarrier));
    await AsyncStorage.setItem("currentUser", JSON.stringify(nextCarrier));
    await AsyncStorage.setItem("userRole", "freight");
    await AsyncStorage.setItem("currentUserRole", "freight");
  }

  async function findSubscription(freightId: string, email: string) {
    const filters = [freightId ? `freight_id.eq.${freightId}` : "", email ? `freight_email.eq.${email}` : ""]
      .filter(Boolean)
      .join(",");

    if (!filters) return null;

    const { data, error } = await supabase
      .from("freight_subscriptions")
      .select("*")
      .or(filters)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) {
      console.log("Freight settlements subscription lookup error:", error.message);
      return null;
    }

    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  }

  function buildMergedCarrier(row: any, sub: any = {}, stored: any = {}) {
    const realId = clean(
      row?.id ||
        row?.freight_id ||
        sub?.freight_id ||
        stored?.id ||
        stored?.freightId ||
        stored?.freight_id
    );

    const customerId = pickCus(
      row?.stripe_customer_id,
      row?.stripe_id,
      sub?.stripe_customer_id,
      stored?.stripeCustomerId,
      stored?.stripe_customer_id,
      stored?.stripeId,
      stored?.stripe_id
    );

    const subscriptionId = pickSub(
      row?.stripe_subscription_id,
      row?.subscription_id,
      sub?.stripe_subscription_id,
      stored?.stripeSubscriptionId,
      stored?.stripe_subscription_id,
      stored?.subscriptionId,
      stored?.subscription_id
    );

    const connectAccount = pickAcct(
      row?.stripe_account_id,
      row?.freight_account,
      sub?.stripe_account_id,
      sub?.freight_account,
      stored?.stripeAccountId,
      stored?.stripe_account_id,
      stored?.freightAccount,
      stored?.freight_account
    );

    const subStatus =
      row?.subscription_status ||
      sub?.subscription_status ||
      row?.membership_status ||
      stored?.subscriptionStatus ||
      stored?.subscription_status ||
      stored?.membershipStatus ||
      "not_started";

    const company =
      row?.company_name ||
      row?.business_name ||
      sub?.name ||
      stored?.companyName ||
      stored?.businessName ||
      "Farm2Home Freight Carrier";

    return {
      ...(stored || {}),
      ...(row || {}),
      id: realId,
      freightId: realId,
      freight_id: realId,
      role: "freight",
      accountId: clean(row?.account_id || stored?.accountId || stored?.account_id || ""),
      account_id: clean(row?.account_id || stored?.account_id || stored?.accountId || ""),
      companyName: company,
      company_name: company,
      businessName: row?.business_name || row?.company_name || company,
      business_name: row?.business_name || row?.company_name || company,
      contactName: row?.contact_name || row?.name || stored?.contactName || stored?.contact_name || "",
      contact_name: row?.contact_name || row?.name || stored?.contact_name || stored?.contactName || "",
      username: row?.username || sub?.username || stored?.username || "",
      email: normalize(row?.email || sub?.freight_email || stored?.email || ""),
      phone: row?.phone || stored?.phone || "",
      membershipStatus: row?.membership_status || subStatus,
      membership_status: row?.membership_status || subStatus,
      subscriptionStatus: subStatus,
      subscription_status: subStatus,
      accountActive: Boolean(row?.account_active ?? stored?.accountActive ?? isActiveStatus(subStatus)),
      account_active: Boolean(row?.account_active ?? stored?.account_active ?? isActiveStatus(subStatus)),
      stripeCustomerId: customerId,
      stripe_customer_id: customerId,
      stripeId: customerId,
      stripe_id: customerId,
      stripeSubscriptionId: subscriptionId,
      stripe_subscription_id: subscriptionId,
      subscriptionId,
      subscription_id: subscriptionId,
      stripeAccountId: connectAccount,
      stripe_account_id: connectAccount,
      freightAccount: connectAccount,
      freight_account: connectAccount,
      stripeConnectStatus: row?.stripe_connect_status || stored?.stripeConnectStatus || stored?.stripe_connect_status || (connectAccount ? "started" : "not_started"),
      stripe_connect_status: row?.stripe_connect_status || stored?.stripe_connect_status || stored?.stripeConnectStatus || (connectAccount ? "started" : "not_started"),
      payoutsEnabled: boolValue(row?.payouts_enabled, row?.stripe_payouts_enabled, stored?.payoutsEnabled, stored?.payouts_enabled),
      payouts_enabled: boolValue(row?.payouts_enabled, row?.stripe_payouts_enabled, stored?.payoutsEnabled, stored?.payouts_enabled),
      stripe_payouts_enabled: boolValue(row?.stripe_payouts_enabled, row?.payouts_enabled, stored?.stripe_payouts_enabled),
      chargesEnabled: boolValue(row?.charges_enabled, row?.stripe_charges_enabled, stored?.chargesEnabled, stored?.charges_enabled),
      charges_enabled: boolValue(row?.charges_enabled, row?.stripe_charges_enabled, stored?.chargesEnabled, stored?.charges_enabled),
      stripe_charges_enabled: boolValue(row?.stripe_charges_enabled, row?.charges_enabled, stored?.stripe_charges_enabled),
      onboardingComplete: boolValue(row?.stripe_onboarding_complete, stored?.onboardingComplete),
      stripe_onboarding_complete: boolValue(row?.stripe_onboarding_complete, stored?.stripe_onboarding_complete, stored?.onboardingComplete),
      current_period_end: row?.current_period_end || sub?.current_period_end || stored?.current_period_end || null,
      updatedAt: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  async function loadSettlements() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;

      const authId = clean(authUser?.id || "");
      const storedId = clean(stored?.id || stored?.freightId || stored?.freight_id || "");
      const email = normalize(stored?.email || authUser?.email || "");
      const accountId = clean(stored?.accountId || stored?.account_id || "");

      if (!email && !authId && !storedId && !accountId) {
        router.replace(FREIGHT_ROUTES.login as any);
        return;
      }

      const profileFilters = [
        authId ? `id.eq.${authId}` : "",
        authId ? `auth_user_id.eq.${authId}` : "",
        authId ? `profile_id.eq.${authId}` : "",
        authId ? `freight_id.eq.${authId}` : "",
        storedId ? `id.eq.${storedId}` : "",
        storedId ? `freight_id.eq.${storedId}` : "",
        email ? `email.eq.${email}` : "",
        accountId ? `account_id.eq.${accountId}` : "",
      ]
        .filter(Boolean)
        .join(",");

      const { data: dbRows, error: carrierError } = await supabase
        .from("freight_users")
        .select("*")
        .or(profileFilters)
        .limit(1);

      if (carrierError) console.log("Freight settlements carrier error:", carrierError.message);

      const dbCarrier = Array.isArray(dbRows) && dbRows.length > 0 ? dbRows[0] : null;

      if (!dbCarrier) {
        Alert.alert("Freight Profile Missing", "Please complete freight registration first.");
        router.replace(FREIGHT_ROUTES.register as any);
        return;
      }

      const sub = await findSubscription(dbCarrier.id || storedId || authId, normalize(dbCarrier.email || email));
      const mergedCarrier = buildMergedCarrier(dbCarrier, sub, stored);

      await saveFreightSession(mergedCarrier);
      setCarrier(mergedCarrier);

      const { data, error } = await supabase
        .from("freight_loads")
        .select("*")
        .or(
          `carrier_id.eq.${mergedCarrier.id},freight_user_id.eq.${mergedCarrier.id},driver_id.eq.${mergedCarrier.id},accepted_by.eq.${mergedCarrier.id}`
        )
        .in("status", ["delivered", "completed"])
        .order("delivered_at", { ascending: false });

      if (error) {
        console.log("Freight settlements load error:", error.message);
        setLoads([]);
      } else {
        setLoads(Array.isArray(data) ? data : []);
      }
    } catch (error: any) {
      Alert.alert("Settlements Error", error?.message || "Unable to load settlements.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadSettlements();
  }

  function stripeReady() {
    return Boolean(stripeAccountId && payoutsReady && chargesReady && onboardingReady);
  }

  function stripeStatusText() {
    if (stripeReady()) return "Stripe Ready";
    if (stripeAccountId) return "Onboarding Incomplete";
    return "Bank Not Connected";
  }

  function stripeStatusColor() {
    if (stripeReady()) return COLORS.green;
    if (stripeAccountId) return COLORS.amber;
    return COLORS.red;
  }

  function membershipColor() {
    const status = normalize(carrier?.membershipStatus || carrier?.subscriptionStatus);

    if (status.includes("cancel") || status.includes("unpaid") || status.includes("incomplete")) return COLORS.red;
    if (status.includes("pending") || status.includes("past_due")) return COLORS.amber;
    if (status.includes("active") || status.includes("trial")) return COLORS.green;

    return COLORS.amber;
  }

  function renderSettlement({ item }: { item: FreightLoad }) {
    const status = settlementStatus(item);
    const amount = settlementAmount(item);
    const dispute = Boolean(
      item.dispute_status || item.dispute_reason || ["disputed", "failed", "rejected"].includes(normalize(status))
    );

    return (
      <TouchableOpacity
        style={styles.settlementCard}
        onPress={() =>
          router.push({
            pathname: FREIGHT_ROUTES.routeDetails as any,
            params: { loadId: item.id },
          })
        }
        activeOpacity={0.86}
      >
        <View style={styles.settlementTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.loadTitle}>{item.title || item.commodity || "Freight Settlement"}</Text>
            <Text style={styles.loadRoute}>
              {item.pickup_location || item.pickupLocation || "Pickup"} → {item.dropoff_location || item.dropoffLocation || "Dropoff"}
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: statusColor(status) }]}>
            <Text style={styles.statusText}>{statusLabel(status)}</Text>
          </View>
        </View>

        <View style={styles.infoGrid}>
          <InfoBox label="Amount" value={money(amount)} />
          <InfoBox label="Delivered" value={formatDate(item.delivered_at || item.updated_at)} />
          <InfoBox label="Settlement" value={statusLabel(status)} />
          <InfoBox label="Payout ID" value={item.stripe_payout_id || item.payout_id || "Pending"} />
        </View>

        {dispute ? (
          <View style={styles.disputeBox}>
            <Ionicons name="alert-circle-outline" size={20} color={COLORS.red} />
            <View style={{ flex: 1 }}>
              <Text style={styles.disputeTitle}>Dispute / Review Flag</Text>
              <Text style={styles.disputeText}>
                {item.dispute_reason || item.dispute_status || "This settlement is under review. Contact support if you need help."}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.settlementActions}>
          <TouchableOpacity style={styles.supportButton} onPress={() => goTo(FREIGHT_ROUTES.support)}>
            <Ionicons name="headset-outline" size={18} color={COLORS.primary} />
            <Text style={styles.supportButtonText}>Support</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.supportButton}
            onPress={() =>
              router.push({
                pathname: FREIGHT_ROUTES.routeDetails as any,
                params: { loadId: item.id },
              })
            }
          >
            <Ionicons name="trail-sign-outline" size={18} color={COLORS.primary} />
            <Text style={styles.supportButtonText}>Details</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.centerText}>Loading freight settlements...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <View style={styles.shell}>
        <View style={styles.sidebar}>
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}>
              <Ionicons name="receipt-outline" size={28} color={COLORS.white} />
            </View>
            <View>
              <Text style={styles.brandTitle}>Farm2Home</Text>
              <Text style={styles.brandSubtitle}>Settlements</Text>
            </View>
          </View>

          <View style={styles.sideDivider} />

          <SidebarLink icon="grid-outline" title="Dashboard" route={FREIGHT_ROUTES.dashboard} />
          <SidebarLink icon="apps-outline" title="Management Center" route={FREIGHT_ROUTES.managementCenter} />
          <SidebarLink icon="list-outline" title="Load Board" route={FREIGHT_ROUTES.board} />
          <SidebarLink icon="cash-outline" title="Earnings" route={FREIGHT_ROUTES.earnings} />
          <SidebarLink icon="receipt-outline" title="Settlements" active route={FREIGHT_ROUTES.settlements} />
          <SidebarLink icon="business-outline" title="Connect Bank" route={FREIGHT_ROUTES.connectBank} />

          <View style={styles.carrierPanel}>
            <Text style={styles.carrierLabel}>Carrier</Text>
            <Text style={styles.carrierNameSide} numberOfLines={1}>
              {carrier?.companyName || carrier?.businessName || "Farm2Home Freight Carrier"}
            </Text>
            <Text style={styles.carrierSub} numberOfLines={1}>
              {carrier?.accountId || carrier?.account_id || "Account pending"}
            </Text>
          </View>
        </View>

        <View style={styles.main}>
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.topPanel}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>Fina Admin Settlement Center</Text>
                <Text style={styles.pageTitle}>Freight Settlements</Text>
                <Text style={styles.pageSubtitle}>
                  Review paid, pending, processing, held, and disputed settlements for completed freight loads.
                </Text>
              </View>

              <TouchableOpacity style={styles.topButton} onPress={() => goTo(FREIGHT_ROUTES.payoutCenter)}>
                <Ionicons name="wallet-outline" size={22} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.profilePanel}>
              <View style={styles.profileAvatar}>
                <Ionicons name="business-outline" size={28} color={COLORS.white} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.companyName}>{carrier?.companyName || carrier?.businessName || "Farm2Home Freight Carrier"}</Text>
                <Text style={styles.companyEmail}>{carrier?.email || "Carrier workspace"}</Text>
                <Text style={styles.accountId}>Account ID: {carrier?.accountId || carrier?.account_id || "Not assigned"}</Text>
              </View>

              <View style={styles.profilePills}>
                <View style={[styles.statusMini, { backgroundColor: membershipColor() }]}>
                  <Text style={styles.statusMiniText}>{carrier?.membershipStatus || carrier?.subscriptionStatus || "not_started"}</Text>
                </View>
                <View style={[styles.statusMini, { backgroundColor: stripeStatusColor() }]}>
                  <Text style={styles.statusMiniText}>{stripeStatusText()}</Text>
                </View>
              </View>
            </View>

            <View style={styles.metricGrid}>
              <MetricCard label="Total" value={money(stats.totalValue)} icon="wallet-outline" ready />
              <MetricCard label="Paid" value={money(stats.paidValue)} icon="checkmark-circle-outline" ready />
              <MetricCard label="Pending" value={money(stats.pendingValue)} icon="time-outline" ready={stats.pendingValue === 0} />
              <MetricCard label="Disputed" value={money(stats.disputedValue)} icon="alert-circle-outline" ready={stats.disputedValue === 0} />
              <MetricCard label="Completed" value={String(stats.total)} icon="cube-outline" ready={stats.total > 0} />
              <MetricCard label="Pending Count" value={String(stats.pendingCount)} icon="hourglass-outline" ready={stats.pendingCount === 0} />
            </View>

            <View style={styles.card}>
              <SectionHeader
                icon="server-outline"
                title="Stripe & Payout IDs"
                subtitle="Saved values used for subscription, Connect Bank, and settlement readiness."
              />

              <View style={styles.idGrid}>
                <IdRow label="Freight UUID" value={carrier?.id || carrier?.freightId || ""} />
                <IdRow label="Static Account ID" value={carrier?.accountId || carrier?.account_id || ""} />
                <IdRow label="Stripe Customer" value={shortId(stripeCustomerId)} />
                <IdRow label="Stripe Subscription" value={shortId(stripeSubscriptionId)} />
                <IdRow label="Connect Account" value={shortId(stripeAccountId)} />
                <IdRow label="Setup Score" value={`${setupScore}%`} />
              </View>
            </View>

            <View style={styles.quickGrid}>
              <QuickLink icon="wallet-outline" label="Payout Center" route={FREIGHT_ROUTES.payoutCenter} />
              <QuickLink icon="cash-outline" label="Earnings" route={FREIGHT_ROUTES.earnings} />
              <QuickLink icon="business-outline" label="Connect Bank" route={FREIGHT_ROUTES.connectBank} />
              <QuickLink icon="time-outline" label="History" route={FREIGHT_ROUTES.deliveryHistory} />
              <QuickLink icon="analytics-outline" label="Analytics" route={FREIGHT_ROUTES.analytics} />
              <QuickLink icon="headset-outline" label="Support" route={FREIGHT_ROUTES.support} />
            </View>

            <View style={styles.notice}>
              <View style={styles.noticeIcon}>
                <Ionicons name="information-circle-outline" size={22} color={COLORS.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.noticeTitle}>Settlement Rules</Text>
                <Text style={styles.noticeText}>
                  Settlement may remain pending until proof of delivery, dispute checks, customer/farm payment settlement, and Stripe payout readiness are complete.
                </Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Load Settlements</Text>

            <FlatList
              data={loads}
              keyExtractor={(item, index) => String(item.id || index)}
              scrollEnabled={false}
              renderItem={renderSettlement}
              ListEmptyComponent={
                <View style={styles.emptyCard}>
                  <Ionicons name="receipt-outline" size={38} color={COLORS.primary} />
                  <Text style={styles.emptyTitle}>No settlements yet.</Text>
                  <Text style={styles.emptyText}>Completed delivered loads will appear here for settlement tracking.</Text>
                </View>
              }
            />

            <View style={styles.bottomActions}>
              <TouchableOpacity style={styles.primaryButton} onPress={() => goTo(FREIGHT_ROUTES.payoutCenter)}>
                <Ionicons name="wallet-outline" size={18} color={COLORS.white} />
                <Text style={styles.primaryText}>Back to Payout Center</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.darkButton} onPress={() => goTo(FREIGHT_ROUTES.managementCenter)}>
                <Ionicons name="apps-outline" size={18} color={COLORS.white} />
                <Text style={styles.primaryText}>Management Center</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

function SidebarLink({
  icon,
  title,
  route,
  active,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  route: FreightRoute;
  active?: boolean;
}) {
  return (
    <TouchableOpacity style={[styles.sidebarLink, active && styles.sidebarLinkActive]} onPress={() => goTo(route)}>
      <Ionicons name={icon} size={18} color={active ? COLORS.white : "#A5B4FC"} />
      <Text style={[styles.sidebarLinkText, active && styles.sidebarLinkTextActive]}>{title}</Text>
    </TouchableOpacity>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={20} color={COLORS.white} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.sectionHeaderTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoBox}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function IdRow({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.idRow}>
      <Text style={styles.idLabel}>{label}</Text>
      <Text style={[styles.idValue, !value && styles.idMissing]} numberOfLines={1}>
        {value || "Missing"}
      </Text>
    </View>
  );
}

function MetricCard({
  label,
  value,
  icon,
  ready,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  ready: boolean;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, ready ? styles.metricGood : styles.metricWarn]}>
        <Ionicons name={icon} size={21} color={ready ? COLORS.green : COLORS.amber} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function QuickLink({
  icon,
  label,
  route,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: FreightRoute;
}) {
  return (
    <TouchableOpacity style={styles.quickLink} onPress={() => goTo(route)}>
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={22} color={COLORS.primary} />
      </View>
      <Text style={styles.quickText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  centerText: { color: COLORS.muted, marginTop: 12, fontWeight: "800" },
  shell: { flex: 1, flexDirection: Platform.OS === "web" ? "row" : "column", backgroundColor: COLORS.bg },
  sidebar: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 22,
    width: Platform.OS === "web" ? 310 : "100%",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  brandIcon: { width: 54, height: 54, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  brandTitle: { color: COLORS.white, fontSize: 21, fontWeight: "900" },
  brandSubtitle: { color: "#A5B4FC", fontWeight: "800", marginTop: 2 },
  sideDivider: { height: 1, backgroundColor: "#1E293B", marginVertical: 22 },
  sidebarLink: { borderRadius: 16, paddingVertical: 13, paddingHorizontal: 14, flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 8 },
  sidebarLinkActive: { backgroundColor: COLORS.primary },
  sidebarLinkText: { color: "#CBD5E1", fontWeight: "900" },
  sidebarLinkTextActive: { color: COLORS.white },
  carrierPanel: { backgroundColor: "#0F172A", borderWidth: 1, borderColor: "#1E293B", borderRadius: 18, padding: 14, marginTop: 12 },
  carrierLabel: { color: "#A5B4FC", fontWeight: "900", textTransform: "uppercase", fontSize: 11 },
  carrierNameSide: { color: COLORS.white, fontWeight: "900", marginTop: 6 },
  carrierSub: { color: "#CBD5E1", fontWeight: "700", marginTop: 4 },
  main: { flex: 1, padding: 18 },
  content: { paddingBottom: 90 },
  topPanel: {
    backgroundColor: COLORS.white,
    borderRadius: 26,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
    marginBottom: 14,
  },
  topButton: { width: 50, height: 50, borderRadius: 18, backgroundColor: COLORS.primarySoft, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: COLORS.primary, fontWeight: "900", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  pageTitle: { color: COLORS.text, fontSize: 34, fontWeight: "900", marginTop: 6 },
  pageSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 22, marginTop: 7, maxWidth: 760 },
  profilePanel: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 13,
    alignItems: "center",
    marginBottom: 14,
  },
  profileAvatar: { width: 58, height: 58, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  companyName: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  companyEmail: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  accountId: { color: COLORS.muted, fontWeight: "800", marginTop: 4, fontSize: 12 },
  profilePills: { gap: 8, alignItems: "flex-end" },
  statusMini: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  statusMiniText: { color: COLORS.white, fontWeight: "900", fontSize: 12, textTransform: "capitalize" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 14 },
  metricCard: {
    width: Platform.OS === "web" ? "15.55%" : "48%",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    padding: 16,
  },
  metricIcon: { width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  metricGood: { backgroundColor: COLORS.greenSoft },
  metricWarn: { backgroundColor: COLORS.amberSoft },
  metricLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 11, textTransform: "uppercase" },
  metricValue: { color: COLORS.text, fontWeight: "900", fontSize: 18, marginTop: 5 },
  card: { backgroundColor: COLORS.white, borderRadius: 22, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  sectionHeader: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 14 },
  sectionIcon: { width: 40, height: 40, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  sectionHeaderTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900" },
  sectionSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 3 },
  idGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  idRow: { width: Platform.OS === "web" ? "31.5%" : "100%", backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 13 },
  idLabel: { color: COLORS.muted, fontWeight: "900", textTransform: "uppercase", fontSize: 11 },
  idValue: { color: COLORS.text, fontWeight: "900", marginTop: 5 },
  idMissing: { color: COLORS.amber },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  quickLink: {
    width: Platform.OS === "web" ? "15.55%" : "48%",
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 102,
    justifyContent: "space-between",
  },
  quickIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: COLORS.primarySoft, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  quickText: { color: COLORS.text, fontWeight: "900" },
  notice: {
    backgroundColor: COLORS.navy,
    marginBottom: 16,
    borderRadius: 22,
    padding: 18,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  noticeIcon: { width: 42, height: 42, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  noticeTitle: { color: COLORS.white, fontSize: 21, fontWeight: "900", marginBottom: 7 },
  noticeText: { color: "#D1D5DB", fontWeight: "700", lineHeight: 22 },
  sectionTitle: { color: COLORS.text, fontSize: 24, fontWeight: "900", marginBottom: 12 },
  settlementCard: { backgroundColor: COLORS.white, marginBottom: 14, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: COLORS.border },
  settlementTop: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 12 },
  loadTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  loadRoute: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, maxWidth: 150 },
  statusText: { color: COLORS.white, fontSize: 11, fontWeight: "900", textTransform: "capitalize" },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  infoBox: {
    width: Platform.OS === "web" ? "24%" : "48%",
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
  },
  infoLabel: { color: COLORS.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  infoValue: { color: COLORS.text, fontWeight: "900", marginTop: 4 },
  disputeBox: {
    backgroundColor: COLORS.redSoft,
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 16,
    padding: 13,
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },
  disputeTitle: { color: COLORS.red, fontWeight: "900" },
  disputeText: { color: COLORS.text, fontWeight: "700", lineHeight: 20, marginTop: 3 },
  settlementActions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  supportButton: {
    flex: 1,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 14,
    padding: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  supportButtonText: { color: COLORS.primary, fontWeight: "900" },
  emptyCard: { backgroundColor: COLORS.white, borderRadius: 22, padding: 24, alignItems: "center", borderWidth: 1, borderColor: COLORS.border },
  emptyTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900", marginTop: 10 },
  emptyText: { color: COLORS.muted, fontWeight: "700", textAlign: "center", marginTop: 8, lineHeight: 22 },
  bottomActions: { flexDirection: Platform.OS === "web" ? "row" : "column", gap: 12, marginBottom: 40 },
  primaryButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  darkButton: {
    flex: 1,
    backgroundColor: COLORS.navy,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryText: { color: COLORS.white, fontWeight: "900" },
});
