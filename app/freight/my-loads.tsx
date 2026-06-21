// app/freight/my-loads.tsx
// Fully updated replacement for Farm2Home Freight My Loads

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
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

const ROUTES = {
  dashboard: "/freight/dashboard",
  board: "/freight/board",
  liveLoads: "/freight/live-loads",
  myLoads: "/freight/my-loads",
  loadDetail: "/freight/load-detail",
  loadChat: "/freight/load-chat",
  tracking: "/freight/tracking",
  liveRoute: "/freight/live-route",
  proofOfPickup: "/freight/proof-of-pickup",
  proofOfDelivery: "/freight/proof-of-delivery",
  connectBank: "/freight/connect-bank",
  profile: "/freight/profile",
  settings: "/freight/settings",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof ROUTES)[keyof typeof ROUTES];

type FreightLoad = {
  id: string;
  title?: string;
  commodity?: string;
  farmer_name?: string;
  broker_name?: string;
  pickup_location?: string;
  dropoff_location?: string;
  pickup_date?: string;
  pickup_time?: string;
  equipment_type?: string;
  weight_lbs?: number;
  distance_miles?: number;
  rate?: number;
  freight_total?: number;
  payout_amount?: number;
  status?: string;
  payout_status?: string;
  settlement_status?: string;
  notes?: string;
  updated_at?: string;
};

const COLORS = {
  bg: "#F3F4F6",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  redDark: "#991B1B",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  amber: "#D97706",
  purple: "#7C3AED",
  blue: "#2563EB",
  teal: "#0F766E",
  slate: "#64748B",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function money(value: any) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function loadValue(load: FreightLoad) {
  return Number(load.rate || load.freight_total || load.payout_amount || 0);
}

function statusLabel(status: any) {
  return String(status || "accepted")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusColor(status: any) {
  const value = normalize(status);

  if (["accepted", "booked"].includes(value)) return COLORS.red;
  if (value === "arrived_pickup") return COLORS.teal;
  if (value === "picked_up") return COLORS.amber;
  if (value === "in_transit") return COLORS.purple;
  if (value === "arrived_dropoff") return COLORS.teal;
  if (["delivered", "completed"].includes(value)) return COLORS.green;
  if (value === "cancelled") return COLORS.redDark;

  return COLORS.slate;
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

function openWithLoad(route: FreightRoute, loadId: string) {
  router.push({
    pathname: route as any,
    params: { loadId },
  });
}

export default function FreightMyLoadsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [carrier, setCarrier] = useState<any>(null);
  const [loads, setLoads] = useState<FreightLoad[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadMyLoads();
    }, [])
  );

  async function getStoredCarrier() {
    const raw =
      (await AsyncStorage.getItem("currentFreightCarrier")) ||
      (await AsyncStorage.getItem("currentFreight")) ||
      (await AsyncStorage.getItem("currentFreightUser")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function persistCarrier(nextCarrier: any) {
    const id = nextCarrier.id || nextCarrier.freightId || nextCarrier.freight_id;

    const normalizedCarrier = {
      ...nextCarrier,
      id,
      freightId: id,
      freight_id: id,
      role: "freight",
      email: normalize(nextCarrier.email),
      companyName:
        nextCarrier.companyName ||
        nextCarrier.businessName ||
        nextCarrier.company_name ||
        nextCarrier.business_name ||
        "Farm2Home Freight Carrier",
      businessName:
        nextCarrier.businessName ||
        nextCarrier.companyName ||
        nextCarrier.business_name ||
        nextCarrier.company_name ||
        "Farm2Home Freight Carrier",
      accountId: nextCarrier.accountId || nextCarrier.account_id || "",
      account_id: nextCarrier.account_id || nextCarrier.accountId || "",
      stripeCustomerId: nextCarrier.stripeCustomerId || nextCarrier.stripe_customer_id || "",
      stripe_customer_id: nextCarrier.stripe_customer_id || nextCarrier.stripeCustomerId || "",
      stripeSubscriptionId:
        nextCarrier.stripeSubscriptionId ||
        nextCarrier.stripe_subscription_id ||
        nextCarrier.subscription_id ||
        "",
      stripe_subscription_id:
        nextCarrier.stripe_subscription_id ||
        nextCarrier.stripeSubscriptionId ||
        nextCarrier.subscription_id ||
        "",
      subscriptionId:
        nextCarrier.subscriptionId ||
        nextCarrier.subscription_id ||
        nextCarrier.stripe_subscription_id ||
        "",
      subscription_id:
        nextCarrier.subscription_id ||
        nextCarrier.subscriptionId ||
        nextCarrier.stripe_subscription_id ||
        "",
      freightAccount:
        nextCarrier.freightAccount ||
        nextCarrier.freight_account ||
        nextCarrier.stripe_account_id ||
        "",
      freight_account:
        nextCarrier.freight_account ||
        nextCarrier.freightAccount ||
        nextCarrier.stripe_account_id ||
        "",
      stripeAccountId:
        nextCarrier.stripeAccountId ||
        nextCarrier.stripe_account_id ||
        nextCarrier.freight_account ||
        "",
      stripe_account_id:
        nextCarrier.stripe_account_id ||
        nextCarrier.stripeAccountId ||
        nextCarrier.freight_account ||
        "",
    };

    await AsyncStorage.setItem("currentFreight", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentFreightUser", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentUser", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("userRole", "freight");
    await AsyncStorage.setItem("currentUserRole", "freight");

    setCarrier(normalizedCarrier);
    return normalizedCarrier;
  }

  async function loadMyLoads() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();
      const email = normalize(stored?.email || authData?.user?.email || "");

      if (!email) {
        router.replace(ROUTES.login as any);
        return;
      }

      const authId = authData?.user?.id || "";
      const storedId = stored?.id || stored?.freightId || stored?.freight_id || "";
      const accountId = stored?.accountId || stored?.account_id || "";

      const profileFilters = [
        authId ? `id.eq.${authId}` : "",
        authId ? `auth_user_id.eq.${authId}` : "",
        authId ? `profile_id.eq.${authId}` : "",
        authId ? `freight_id.eq.${authId}` : "",
        storedId ? `id.eq.${storedId}` : "",
        storedId ? `freight_id.eq.${storedId}` : "",
        storedId ? `auth_user_id.eq.${storedId}` : "",
        email ? `email.eq.${email}` : "",
        accountId ? `account_id.eq.${accountId}` : "",
      ]
        .filter(Boolean)
        .join(",");

      const { data: dbCarrierRows, error: carrierError } = await supabase
        .from("freight_users")
        .select("*")
        .or(profileFilters)
        .limit(1);

      if (carrierError) console.log("My freight loads profile error:", carrierError.message);

      const dbCarrier = Array.isArray(dbCarrierRows) && dbCarrierRows.length > 0 ? dbCarrierRows[0] : null;

      if (!dbCarrier) {
        Alert.alert("Freight Profile Missing", "Please complete freight registration first.");
        router.replace(ROUTES.register as any);
        return;
      }

      const mergedCarrier = await persistCarrier({
        ...(stored || {}),
        ...(dbCarrier || {}),
        id: dbCarrier.id,
        freightId: dbCarrier.freight_id || dbCarrier.id,
        freight_id: dbCarrier.freight_id || dbCarrier.id,
        email: normalize(dbCarrier.email || email),
      });

      const carrierId = mergedCarrier.id;

      const loadFilters = [
        `carrier_id.eq.${carrierId}`,
        `freight_user_id.eq.${carrierId}`,
        `driver_id.eq.${carrierId}`,
        `accepted_by.eq.${carrierId}`,
        mergedCarrier.account_id ? `account_id.eq.${mergedCarrier.account_id}` : "",
        mergedCarrier.email ? `carrier_email.eq.${mergedCarrier.email}` : "",
      ]
        .filter(Boolean)
        .join(",");

      const { data, error } = await supabase
        .from("freight_loads")
        .select("*")
        .or(loadFilters)
        .order("updated_at", { ascending: false });

      if (error) {
        console.log("My freight loads error:", error.message);
        setLoads([]);
        return;
      }

      setLoads(Array.isArray(data) ? data : []);
    } catch (error) {
      console.log("Load my freight loads error:", error);
      Alert.alert("Load Error", "Unable to load your freight loads.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadMyLoads();
  }

  async function updateLoadStatus(load: FreightLoad, status: string) {
    try {
      setUpdatingId(load.id);

      const now = new Date().toISOString();

      const payload: any = {
        status,
        updated_at: now,
      };

      if (status === "arrived_pickup") payload.arrived_pickup_at = now;
      if (status === "picked_up") payload.picked_up_at = now;
      if (status === "in_transit") payload.in_transit_at = now;
      if (status === "arrived_dropoff") payload.arrived_dropoff_at = now;

      if (status === "delivered") {
        payload.delivered_at = now;
        payload.settlement_status = "pending";
        payload.payout_status = "pending";
      }

      const { error } = await supabase.from("freight_loads").update(payload).eq("id", load.id);
      if (error) throw error;

      if (carrier?.id) {
        await supabase.from("freight_notifications").insert({
          freight_user_id: carrier.id,
          freight_id: carrier.id,
          user_id: carrier.id,
          load_id: load.id,
          title: "Load Status Updated",
          message: `${load.title || load.commodity || "Freight Load"} marked as ${statusLabel(status)}.`,
          type: "load",
          is_read: false,
          read: false,
          created_at: now,
        });
      }

      await loadMyLoads();
    } catch (error: any) {
      Alert.alert("Update Error", error?.message || "Unable to update this load.");
    } finally {
      setUpdatingId("");
    }
  }

  const stats = useMemo(() => {
    const booked = loads.filter((x) => ["accepted", "booked"].includes(normalize(x.status)));
    const active = loads.filter((x) =>
      ["accepted", "booked", "arrived_pickup", "picked_up", "in_transit", "arrived_dropoff"].includes(
        normalize(x.status)
      )
    );
    const delivered = loads.filter((x) => ["delivered", "completed"].includes(normalize(x.status)));
    const totalValue = loads.reduce((sum, x) => sum + loadValue(x), 0);
    const pendingPayout = loads
      .filter((x) => ["pending", "processing", ""].includes(normalize(x.payout_status)))
      .reduce((sum, x) => sum + loadValue(x), 0);

    return {
      booked: booked.length,
      active: active.length,
      delivered: delivered.length,
      totalValue,
      pendingPayout,
    };
  }, [loads]);

  function nextAction(load: FreightLoad) {
    const status = normalize(load.status);
    const busy = updatingId === load.id;

    if (status === "accepted" || status === "booked") {
      return (
        <ActionButton
          title="Arrived Pickup"
          icon="location-outline"
          color={COLORS.red}
          busy={busy}
          onPress={() => updateLoadStatus(load, "arrived_pickup")}
        />
      );
    }

    if (status === "arrived_pickup") {
      return (
        <ActionButton
          title="Proof Pickup"
          icon="camera-outline"
          color={COLORS.teal}
          onPress={() => openWithLoad(ROUTES.proofOfPickup, load.id)}
        />
      );
    }

    if (status === "picked_up") {
      return (
        <ActionButton
          title="Start Transit"
          icon="navigate-outline"
          color={COLORS.purple}
          busy={busy}
          onPress={() => updateLoadStatus(load, "in_transit")}
        />
      );
    }

    if (status === "in_transit") {
      return (
        <ActionButton
          title="Arrived Dropoff"
          icon="flag-outline"
          color={COLORS.teal}
          busy={busy}
          onPress={() => updateLoadStatus(load, "arrived_dropoff")}
        />
      );
    }

    if (status === "arrived_dropoff") {
      return (
        <ActionButton
          title="Proof Delivery"
          icon="checkmark-done-outline"
          color={COLORS.green}
          onPress={() => openWithLoad(ROUTES.proofOfDelivery, load.id)}
        />
      );
    }

    if (status === "delivered" || status === "completed") {
      return (
        <View style={styles.completeBadge}>
          <Ionicons name="checkmark-done-circle" size={17} color="#FFFFFF" />
          <Text style={styles.completeText}>Completed</Text>
        </View>
      );
    }

    return (
      <View style={styles.inactiveBadge}>
        <Text style={styles.inactiveText}>{statusLabel(load.status || "")}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading my freight loads...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Farm2Home Freight</Text>
          <Text style={styles.title}>My Loads</Text>
          <Text style={styles.subtitle}>
            {carrier?.companyName || "Freight Carrier"} · Booked, active, delivered, payout, route,
            tracking, and chat.
          </Text>
        </View>

        <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(ROUTES.dashboard)}>
          <Ionicons name="briefcase-outline" size={32} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.summaryRow}>
        <SummaryCard label="Booked" value={stats.booked} />
        <SummaryCard label="Active" value={stats.active} />
        <SummaryCard label="Delivered" value={stats.delivered} />
      </View>

      <View style={styles.valueCard}>
        <View>
          <Text style={styles.valueLabel}>Total Load Value</Text>
          <Text style={styles.valueAmount}>{money(stats.totalValue)}</Text>
          <Text style={styles.valueSub}>Pending payout: {money(stats.pendingPayout)}</Text>
        </View>

        <TouchableOpacity style={styles.valueButton} onPress={() => goTo(ROUTES.connectBank)}>
          <Ionicons name="business-outline" size={18} color="#FFFFFF" />
          <Text style={styles.valueButtonText}>Payouts</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.navRow}>
        <NavButton title="Load Board" icon="list-outline" route={ROUTES.board} />
        <NavButton title="Live Loads" icon="pulse-outline" route={ROUTES.liveLoads} outline />
      </View>

      <FlatList
        data={loads}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Ionicons name="cube-outline" size={38} color={COLORS.red} />
            <Text style={styles.emptyTitle}>No booked loads yet</Text>
            <Text style={styles.emptyText}>
              Book a farm freight load from the board to manage it here.
            </Text>

            <TouchableOpacity style={styles.emptyButton} onPress={() => goTo(ROUTES.board)}>
              <Ionicons name="list-outline" size={18} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>Open Load Board</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const payoutStatus = item.payout_status || "pending";
          const settlementStatus = item.settlement_status || "pending";

          return (
            <View style={styles.card}>
              <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.loadTitle}>{item.title || item.commodity || "Freight Load"}</Text>
                  <Text style={styles.loadId}>Load #{String(item.id).slice(-6)}</Text>
                </View>

                <View style={[styles.statusPill, { backgroundColor: statusColor(item.status || "") }]}>
                  <Text style={styles.statusText}>{statusLabel(item.status || "")}</Text>
                </View>
              </View>

              <View style={styles.routeBox}>
                <View style={styles.routeStop}>
                  <Ionicons name="radio-button-on-outline" size={18} color={COLORS.green} />
                  <Text style={styles.route}>{item.pickup_location || "Pickup TBD"}</Text>
                </View>
                <View style={styles.routeLine} />
                <View style={styles.routeStop}>
                  <Ionicons name="location-outline" size={18} color={COLORS.red} />
                  <Text style={styles.route}>{item.dropoff_location || "Dropoff TBD"}</Text>
                </View>
              </View>

              <View style={styles.detailsGrid}>
                <InfoBox label="Commodity" value={item.commodity || "Farm Freight"} />
                <InfoBox label="Pickup" value={`${item.pickup_date || "TBD"} · ${item.pickup_time || "TBD"}`} />
                <InfoBox label="Equipment" value={item.equipment_type || "Standard"} />
                <InfoBox label="Miles" value={`${Number(item.distance_miles || 0).toFixed(0)} mi`} />
                <InfoBox label="Broker/Farmer" value={item.broker_name || item.farmer_name || "Farm2Home Partner"} />
                <InfoBox label="Payout Status" value={statusLabel(payoutStatus)} />
                <InfoBox label="Settlement" value={statusLabel(settlementStatus)} />
                <InfoBox label="Load Value" value={money(loadValue(item))} />
              </View>

              {!!item.notes && <Text style={styles.description}>{item.notes}</Text>}

              <View style={styles.footerRow}>
                <View style={styles.payoutBlock}>
                  <Text style={styles.rateLabel}>Payout</Text>
                  <Text style={styles.payout}>{money(loadValue(item))}</Text>
                </View>

                {nextAction(item)}
              </View>

              <View style={styles.buttonGrid}>
                <SmallButton
                  title="Details"
                  icon="document-text-outline"
                  onPress={() => openWithLoad(ROUTES.loadDetail, item.id)}
                />
                <SmallButton
                  title="Chat"
                  icon="chatbubbles-outline"
                  onPress={() => openWithLoad(ROUTES.loadChat, item.id)}
                />
                <SmallButton
                  title="Tracking"
                  icon="map-outline"
                  onPress={() => openWithLoad(ROUTES.tracking, item.id)}
                />
                <SmallButton
                  title="Live Route"
                  icon="navigate-outline"
                  onPress={() => openWithLoad(ROUTES.liveRoute, item.id)}
                />
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function NavButton({
  title,
  icon,
  route,
  outline,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: FreightRoute;
  outline?: boolean;
}) {
  return (
    <TouchableOpacity style={outline ? styles.navOutline : styles.navButton} onPress={() => goTo(route)}>
      <Ionicons name={icon} size={18} color={outline ? COLORS.red : "#FFFFFF"} />
      <Text style={outline ? styles.navOutlineText : styles.navText}>{title}</Text>
    </TouchableOpacity>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoBox}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || "TBD"}</Text>
    </View>
  );
}

function ActionButton({
  title,
  icon,
  color,
  onPress,
  busy,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
  busy?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionButton, { backgroundColor: color }, busy && styles.disabledButton]}
      onPress={onPress}
      disabled={busy}
    >
      {busy ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <>
          <Ionicons name={icon} size={17} color="#FFFFFF" />
          <Text style={styles.actionText}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

function SmallButton({
  title,
  icon,
  onPress,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.smallButton} onPress={onPress}>
      <Ionicons name={icon} size={17} color={COLORS.red} />
      <Text style={styles.smallButtonText}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  centerText: { color: COLORS.muted, marginTop: 12, fontWeight: "800" },
  hero: {
    backgroundColor: COLORS.black,
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 30,
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 24,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    color: "#FCA5A5",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
  },
  title: { color: "#FFFFFF", fontSize: 32, fontWeight: "900", marginTop: 6 },
  subtitle: { color: "#D1D5DB", marginTop: 8, lineHeight: 22, fontWeight: "700" },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    padding: 18,
    paddingBottom: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  summaryValue: { color: COLORS.black, fontSize: 21, fontWeight: "900" },
  summaryLabel: { color: COLORS.muted, fontWeight: "800", marginTop: 4 },
  valueCard: {
    backgroundColor: COLORS.red,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  valueLabel: { color: "#FFE4E6", fontWeight: "900", textTransform: "uppercase", fontSize: 12 },
  valueAmount: { color: "#FFFFFF", fontSize: 30, fontWeight: "900", marginTop: 4 },
  valueSub: { color: "#FFE4E6", fontWeight: "800", marginTop: 4 },
  valueButton: {
    backgroundColor: COLORS.black,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 12,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
  },
  valueButtonText: { color: "#FFFFFF", fontWeight: "900" },
  navRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  navButton: {
    flex: 1,
    backgroundColor: COLORS.red,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navOutline: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.red,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navText: { color: "#FFFFFF", fontWeight: "900" },
  navOutlineText: { color: COLORS.red, fontWeight: "900" },
  listContent: { paddingHorizontal: 18, paddingBottom: 90 },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    marginTop: 20,
  },
  emptyTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900", marginTop: 10 },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  emptyButton: {
    backgroundColor: COLORS.red,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 16,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  emptyButtonText: { color: "#FFFFFF", fontWeight: "900" },
  card: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  loadTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  loadId: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },
  routeBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginTop: 14,
  },
  routeStop: { flexDirection: "row", gap: 9, alignItems: "center" },
  routeLine: {
    width: 1,
    height: 18,
    backgroundColor: COLORS.border,
    marginLeft: 8,
    marginVertical: 5,
  },
  route: { color: COLORS.text, fontSize: 16, fontWeight: "900", flex: 1 },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  infoBox: {
    width: "48%",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
  },
  infoLabel: {
    color: COLORS.muted,
    fontWeight: "900",
    fontSize: 11,
    textTransform: "uppercase",
  },
  infoValue: { color: COLORS.text, fontWeight: "800", marginTop: 5, lineHeight: 18 },
  description: { color: COLORS.muted, lineHeight: 21, marginTop: 12, fontWeight: "700" },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginTop: 14,
  },
  payoutBlock: { flex: 1 },
  rateLabel: {
    color: COLORS.muted,
    fontWeight: "900",
    marginBottom: 4,
    textTransform: "uppercase",
    fontSize: 12,
  },
  payout: { color: COLORS.red, fontSize: 28, fontWeight: "900" },
  actionButton: {
    minWidth: 145,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { color: "#FFFFFF", fontWeight: "900" },
  completeBadge: {
    backgroundColor: COLORS.green,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
  },
  completeText: { color: "#FFFFFF", fontWeight: "900" },
  inactiveBadge: {
    backgroundColor: COLORS.slate,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
  },
  inactiveText: { color: "#FFFFFF", fontWeight: "900" },
  buttonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  smallButton: {
    width: "48%",
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
    alignItems: "center",
  },
  smallButtonText: { color: COLORS.red, fontWeight: "900", fontSize: 12 },
  disabledButton: { opacity: 0.6 },
});