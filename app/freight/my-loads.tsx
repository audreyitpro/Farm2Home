// app/freight/my-loads.tsx
// Fina Admin-style rebuild for Farm2Home Freight My Loads

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
  bg: "#F7F7FB",
  card: "#FFFFFF",
  panel: "#F8FAFC",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E5E7EB",
  primary: "#6D5DFB",
  primarySoft: "#EEF2FF",
  green: "#10B981",
  amber: "#F59E0B",
  red: "#EF4444",
  blue: "#2563EB",
  teal: "#0F766E",
  purple: "#7C3AED",
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

function starts(value: any, prefix: string) {
  return clean(value).startsWith(prefix);
}

function pickId(prefix: string, ...values: any[]) {
  const found = values.find((value) => starts(value, prefix));
  return found ? clean(found) : "";
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
  if (["accepted", "booked"].includes(value)) return COLORS.primary;
  if (value === "arrived_pickup") return COLORS.teal;
  if (value === "picked_up") return COLORS.amber;
  if (value === "in_transit") return COLORS.purple;
  if (value === "arrived_dropoff") return COLORS.teal;
  if (["delivered", "completed"].includes(value)) return COLORS.green;
  if (["cancelled", "canceled"].includes(value)) return COLORS.red;
  return COLORS.slate;
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

function openWithLoad(route: FreightRoute, loadId: string) {
  router.push({ pathname: route as any, params: { loadId } });
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
    await AsyncStorage.multiSet([
      ["currentFreight", JSON.stringify(nextCarrier)],
      ["currentFreightCarrier", JSON.stringify(nextCarrier)],
      ["currentFreightUser", JSON.stringify(nextCarrier)],
      ["farm2homeCurrentFreight", JSON.stringify(nextCarrier)],
      ["currentUser", JSON.stringify(nextCarrier)],
      ["userRole", "freight"],
      ["currentUserRole", "freight"],
    ]);
  }

  async function findSubscription(id: string, email: string) {
    const filters = [id ? `freight_id.eq.${id}` : "", email ? `freight_email.eq.${email}` : ""]
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
      console.log("My loads subscription lookup error:", error.message);
      return null;
    }

    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  }

  async function persistCarrier(nextCarrier: any) {
    const id = clean(nextCarrier.id || nextCarrier.freightId || nextCarrier.freight_id);
    const stripeCustomerId = pickId("cus_", nextCarrier.stripeCustomerId, nextCarrier.stripe_customer_id);
    const stripeSubscriptionId = pickId(
      "sub_",
      nextCarrier.stripeSubscriptionId,
      nextCarrier.stripe_subscription_id,
      nextCarrier.subscriptionId,
      nextCarrier.subscription_id
    );
    const stripeAccountId = pickId(
      "acct_",
      nextCarrier.freightAccount,
      nextCarrier.freight_account,
      nextCarrier.stripeAccountId,
      nextCarrier.stripe_account_id
    );

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
      company_name:
        nextCarrier.company_name ||
        nextCarrier.companyName ||
        nextCarrier.business_name ||
        nextCarrier.businessName ||
        "Farm2Home Freight Carrier",
      businessName:
        nextCarrier.businessName ||
        nextCarrier.companyName ||
        nextCarrier.business_name ||
        nextCarrier.company_name ||
        "Farm2Home Freight Carrier",
      business_name:
        nextCarrier.business_name ||
        nextCarrier.businessName ||
        nextCarrier.company_name ||
        nextCarrier.companyName ||
        "Farm2Home Freight Carrier",
      accountId: clean(nextCarrier.accountId || nextCarrier.account_id || ""),
      account_id: clean(nextCarrier.account_id || nextCarrier.accountId || ""),
      stripeCustomerId,
      stripe_customer_id: stripeCustomerId,
      stripeSubscriptionId,
      stripe_subscription_id: stripeSubscriptionId,
      subscriptionId: stripeSubscriptionId,
      subscription_id: stripeSubscriptionId,
      freightAccount: stripeAccountId,
      freight_account: stripeAccountId,
      stripeAccountId,
      stripe_account_id: stripeAccountId,
      membershipStatus: nextCarrier.membershipStatus || nextCarrier.membership_status || (stripeSubscriptionId ? "active" : "pending"),
      membership_status: nextCarrier.membership_status || nextCarrier.membershipStatus || (stripeSubscriptionId ? "active" : "pending"),
      subscriptionStatus: nextCarrier.subscriptionStatus || nextCarrier.subscription_status || (stripeSubscriptionId ? "active" : "pending"),
      subscription_status: nextCarrier.subscription_status || nextCarrier.subscriptionStatus || (stripeSubscriptionId ? "active" : "pending"),
      accountActive: nextCarrier.accountActive ?? nextCarrier.account_active ?? true,
      account_active: nextCarrier.account_active ?? nextCarrier.accountActive ?? true,
    };

    await saveFreightSession(normalizedCarrier);
    setCarrier(normalizedCarrier);
    return normalizedCarrier;
  }

  async function loadMyLoads() {
    try {
      setLoading(true);
      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();
      const email = normalize(stored?.email || authData?.user?.email || "");

      if (!email && !authData?.user?.id && !stored?.id) {
        router.replace(ROUTES.login as any);
        return;
      }

      const authId = clean(authData?.user?.id || "");
      const storedId = clean(stored?.id || stored?.freightId || stored?.freight_id || "");
      const accountId = clean(stored?.accountId || stored?.account_id || "");
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

      const sub = await findSubscription(dbCarrier.id || storedId || authId, normalize(dbCarrier.email || email));
      const subAcct = pickId("acct_", sub?.freight_account, sub?.stripe_account_id);
      const rowAcct = pickId("acct_", dbCarrier.freight_account, dbCarrier.stripe_account_id);

      let mergedProfile = {
        ...(stored || {}),
        ...(dbCarrier || {}),
        id: dbCarrier.id,
        freightId: dbCarrier.freight_id || dbCarrier.id,
        freight_id: dbCarrier.freight_id || dbCarrier.id,
        email: normalize(dbCarrier.email || email),
        stripe_customer_id: pickId("cus_", dbCarrier.stripe_customer_id, sub?.stripe_customer_id),
        stripe_subscription_id: pickId("sub_", dbCarrier.stripe_subscription_id, dbCarrier.subscription_id, sub?.stripe_subscription_id),
        subscription_id: pickId("sub_", dbCarrier.subscription_id, dbCarrier.stripe_subscription_id, sub?.stripe_subscription_id),
        freight_account: pickId("acct_", dbCarrier.freight_account, dbCarrier.stripe_account_id, subAcct),
        stripe_account_id: pickId("acct_", dbCarrier.stripe_account_id, dbCarrier.freight_account, subAcct),
        subscription_status: dbCarrier.subscription_status || sub?.subscription_status || "",
      };

      if (subAcct && !rowAcct) {
        const updatePayload = {
          freight_account: subAcct,
          stripe_account_id: subAcct,
          stripe_connect_status: "started",
          updated_at: new Date().toISOString(),
        };
        await supabase.from("freight_users").update(updatePayload).eq("id", dbCarrier.id);
        mergedProfile = { ...mergedProfile, ...updatePayload };
      }

      const mergedCarrier = await persistCarrier(mergedProfile);
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
      const payload: any = { status, updated_at: now };
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
      ["accepted", "booked", "arrived_pickup", "picked_up", "in_transit", "arrived_dropoff"].includes(normalize(x.status))
    );
    const delivered = loads.filter((x) => ["delivered", "completed"].includes(normalize(x.status)));
    const totalValue = loads.reduce((sum, x) => sum + loadValue(x), 0);
    const pendingPayout = loads
      .filter((x) => ["pending", "processing", ""].includes(normalize(x.payout_status)))
      .reduce((sum, x) => sum + loadValue(x), 0);
    return { booked: booked.length, active: active.length, delivered: delivered.length, totalValue, pendingPayout };
  }, [loads]);

  function nextAction(load: FreightLoad) {
    const status = normalize(load.status);
    const busy = updatingId === load.id;
    if (status === "accepted" || status === "booked") {
      return <ActionButton title="Arrived Pickup" icon="location-outline" color={COLORS.primary} busy={busy} onPress={() => updateLoadStatus(load, "arrived_pickup")} />;
    }
    if (status === "arrived_pickup") {
      return <ActionButton title="Proof Pickup" icon="camera-outline" color={COLORS.teal} onPress={() => openWithLoad(ROUTES.proofOfPickup, load.id)} />;
    }
    if (status === "picked_up") {
      return <ActionButton title="Start Transit" icon="navigate-outline" color={COLORS.purple} busy={busy} onPress={() => updateLoadStatus(load, "in_transit")} />;
    }
    if (status === "in_transit") {
      return <ActionButton title="Arrived Dropoff" icon="flag-outline" color={COLORS.teal} busy={busy} onPress={() => updateLoadStatus(load, "arrived_dropoff")} />;
    }
    if (status === "arrived_dropoff") {
      return <ActionButton title="Proof Delivery" icon="checkmark-done-outline" color={COLORS.green} onPress={() => openWithLoad(ROUTES.proofOfDelivery, load.id)} />;
    }
    if (status === "delivered" || status === "completed") {
      return (
        <View style={styles.completeBadge}>
          <Ionicons name="checkmark-done-circle" size={17} color={COLORS.white} />
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
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.centerText}>Loading my freight loads...</Text>
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
              <Ionicons name="briefcase-outline" size={28} color={COLORS.white} />
            </View>
            <View>
              <Text style={styles.brandTitle}>Farm2Home</Text>
              <Text style={styles.brandSubtitle}>My Loads</Text>
            </View>
          </View>
          <View style={styles.sideDivider} />
          <SidebarLink icon="grid-outline" title="Dashboard" route={ROUTES.dashboard} />
          <SidebarLink icon="search-outline" title="Load Board" route={ROUTES.board} />
          <SidebarLink icon="briefcase-outline" title="My Loads" active route={ROUTES.myLoads} />
          <SidebarLink icon="pulse-outline" title="Live Loads" route={ROUTES.liveLoads} />
          <SidebarLink icon="business-outline" title="Payouts" route={ROUTES.connectBank} />
          <SidebarLink icon="person-outline" title="Profile" route={ROUTES.profile} />
          <View style={styles.carrierPanel}>
            <Text style={styles.carrierLabel}>Carrier</Text>
            <Text style={styles.carrierName} numberOfLines={1}>{carrier?.companyName || "Freight Carrier"}</Text>
            <Text style={styles.carrierSub} numberOfLines={1}>{carrier?.accountId || carrier?.account_id || "Account pending"}</Text>
          </View>
        </View>

        <View style={styles.main}>
          <View style={styles.topPanel}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Fina Admin Freight Operations</Text>
              <Text style={styles.pageTitle}>My Loads</Text>
              <Text style={styles.pageSubtitle}>Track booked, active, delivered, payout, proof-of-pickup, proof-of-delivery, chat, and route status.</Text>
            </View>
            <TouchableOpacity style={styles.topIconButton} onPress={() => goTo(ROUTES.dashboard)}>
              <Ionicons name="grid-outline" size={23} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.metricGrid}>
              <MetricCard label="Booked" value={String(stats.booked)} icon="bookmark-outline" />
              <MetricCard label="Active" value={String(stats.active)} icon="navigate-outline" />
              <MetricCard label="Delivered" value={String(stats.delivered)} icon="checkmark-done-outline" />
              <MetricCard label="Load Value" value={money(stats.totalValue)} icon="cash-outline" />
            </View>

            <View style={styles.valueCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.valueLabel}>Pending Payout</Text>
                <Text style={styles.valueAmount}>{money(stats.pendingPayout)}</Text>
                <Text style={styles.valueSub}>Total booked value: {money(stats.totalValue)}</Text>
              </View>
              <TouchableOpacity style={styles.valueButton} onPress={() => goTo(ROUTES.connectBank)}>
                <Ionicons name="business-outline" size={18} color={COLORS.white} />
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
              scrollEnabled={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyCard}>
                  <Ionicons name="cube-outline" size={38} color={COLORS.primary} />
                  <Text style={styles.emptyTitle}>No booked loads yet</Text>
                  <Text style={styles.emptyText}>Book a farm freight load from the board to manage it here.</Text>
                  <TouchableOpacity style={styles.emptyButton} onPress={() => goTo(ROUTES.board)}>
                    <Ionicons name="list-outline" size={18} color={COLORS.white} />
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
                      <SmallButton title="Details" icon="document-text-outline" onPress={() => openWithLoad(ROUTES.loadDetail, item.id)} />
                      <SmallButton title="Chat" icon="chatbubbles-outline" onPress={() => openWithLoad(ROUTES.loadChat, item.id)} />
                      <SmallButton title="Tracking" icon="map-outline" onPress={() => openWithLoad(ROUTES.tracking, item.id)} />
                      <SmallButton title="Live Route" icon="navigate-outline" onPress={() => openWithLoad(ROUTES.liveRoute, item.id)} />
                    </View>
                  </View>
                );
              }}
            />
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

function SidebarLink({ icon, title, route, active }: { icon: keyof typeof Ionicons.glyphMap; title: string; route: FreightRoute; active?: boolean }) {
  return (
    <TouchableOpacity style={[styles.sidebarLink, active && styles.sidebarLinkActive]} onPress={() => goTo(route)}>
      <Ionicons name={icon} size={18} color={active ? COLORS.white : "#A5B4FC"} />
      <Text style={[styles.sidebarLinkText, active && styles.sidebarLinkTextActive]}>{title}</Text>
    </TouchableOpacity>
  );
}

function MetricCard({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricIcon}>
        <Ionicons name={icon} size={21} color={COLORS.primary} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function NavButton({ title, icon, route, outline }: { title: string; icon: keyof typeof Ionicons.glyphMap; route: FreightRoute; outline?: boolean }) {
  return (
    <TouchableOpacity style={outline ? styles.navOutline : styles.navButton} onPress={() => goTo(route)}>
      <Ionicons name={icon} size={18} color={outline ? COLORS.primary : COLORS.white} />
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

function ActionButton({ title, icon, color, onPress, busy }: { title: string; icon: keyof typeof Ionicons.glyphMap; color: string; onPress: () => void; busy?: boolean }) {
  return (
    <TouchableOpacity style={[styles.actionButton, { backgroundColor: color }, busy && styles.disabledButton]} onPress={onPress} disabled={busy}>
      {busy ? <ActivityIndicator color={COLORS.white} /> : <><Ionicons name={icon} size={17} color={COLORS.white} /><Text style={styles.actionText}>{title}</Text></>}
    </TouchableOpacity>
  );
}

function SmallButton({ title, icon, onPress }: { title: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.smallButton} onPress={onPress}>
      <Ionicons name={icon} size={17} color={COLORS.primary} />
      <Text style={styles.smallButtonText}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  centerText: { color: COLORS.muted, marginTop: 12, fontWeight: "800" },
  shell: { flex: 1, flexDirection: Platform.OS === "web" ? "row" : "column" },
  sidebar: { backgroundColor: COLORS.navy, paddingHorizontal: 22, paddingTop: 28, paddingBottom: 22, width: Platform.OS === "web" ? 310 : "100%" },
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
  carrierName: { color: COLORS.white, fontWeight: "900", marginTop: 6 },
  carrierSub: { color: "#CBD5E1", fontWeight: "700", marginTop: 4 },
  main: { flex: 1, padding: 18 },
  topPanel: { backgroundColor: COLORS.white, borderRadius: 26, padding: 22, borderWidth: 1, borderColor: COLORS.border, flexDirection: "row", gap: 14, alignItems: "flex-start", marginBottom: 14 },
  eyebrow: { color: COLORS.primary, fontWeight: "900", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  pageTitle: { color: COLORS.text, fontSize: 34, fontWeight: "900", marginTop: 6 },
  pageSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 22, marginTop: 7, maxWidth: 760 },
  topIconButton: { width: 50, height: 50, borderRadius: 18, backgroundColor: COLORS.primarySoft, alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingBottom: 90 },
  metricGrid: { flexDirection: Platform.OS === "web" ? "row" : "column", gap: 12, marginBottom: 14 },
  metricCard: { flex: 1, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 22, padding: 16 },
  metricIcon: { width: 42, height: 42, borderRadius: 16, backgroundColor: COLORS.primarySoft, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  metricLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 11, textTransform: "uppercase" },
  metricValue: { color: COLORS.text, fontWeight: "900", fontSize: 22, marginTop: 5 },
  valueCard: { backgroundColor: COLORS.navy, borderRadius: 24, padding: 18, marginBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  valueLabel: { color: "#A5B4FC", fontWeight: "900", textTransform: "uppercase", fontSize: 12 },
  valueAmount: { color: COLORS.white, fontSize: 30, fontWeight: "900", marginTop: 4 },
  valueSub: { color: "#CBD5E1", fontWeight: "800", marginTop: 4 },
  valueButton: { backgroundColor: COLORS.primary, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 12, flexDirection: "row", gap: 7, alignItems: "center" },
  valueButtonText: { color: COLORS.white, fontWeight: "900" },
  navRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  navButton: { flex: 1, backgroundColor: COLORS.primary, padding: 14, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  navOutline: { flex: 1, backgroundColor: COLORS.primarySoft, borderWidth: 1, borderColor: "#C7D2FE", padding: 14, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  navText: { color: COLORS.white, fontWeight: "900" },
  navOutlineText: { color: COLORS.primary, fontWeight: "900" },
  listContent: { paddingBottom: 20 },
  emptyCard: { backgroundColor: COLORS.white, borderColor: COLORS.border, borderWidth: 1, borderRadius: 22, padding: 24, alignItems: "center", marginTop: 20 },
  emptyTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900", marginTop: 10 },
  emptyText: { color: COLORS.muted, fontWeight: "700", textAlign: "center", marginTop: 8, lineHeight: 22 },
  emptyButton: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 14, marginTop: 16, flexDirection: "row", gap: 8, alignItems: "center" },
  emptyButtonText: { color: COLORS.white, fontWeight: "900" },
  card: { backgroundColor: COLORS.white, borderColor: COLORS.border, borderWidth: 1, borderRadius: 24, padding: 18, marginBottom: 16, borderLeftWidth: 5, borderLeftColor: COLORS.primary },
  headerRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  loadTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  loadId: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  statusPill: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  statusText: { color: COLORS.white, fontWeight: "900", fontSize: 12 },
  routeBox: { backgroundColor: COLORS.panel, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, padding: 14, marginTop: 14 },
  routeStop: { flexDirection: "row", gap: 9, alignItems: "center" },
  routeLine: { width: 1, height: 18, backgroundColor: COLORS.border, marginLeft: 8, marginVertical: 5 },
  route: { color: COLORS.text, fontSize: 16, fontWeight: "900", flex: 1 },
  detailsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  infoBox: { width: Platform.OS === "web" ? "23.5%" : "48%", backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 12 },
  infoLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 11, textTransform: "uppercase" },
  infoValue: { color: COLORS.text, fontWeight: "800", marginTop: 5, lineHeight: 18 },
  description: { color: COLORS.muted, lineHeight: 21, marginTop: 12, fontWeight: "700" },
  footerRow: { flexDirection: Platform.OS === "web" ? "row" : "column", justifyContent: "space-between", alignItems: Platform.OS === "web" ? "center" : "stretch", gap: 12, marginTop: 14 },
  payoutBlock: { flex: 1 },
  rateLabel: { color: COLORS.muted, fontWeight: "900", marginBottom: 4, textTransform: "uppercase", fontSize: 12 },
  payout: { color: COLORS.primary, fontSize: 28, fontWeight: "900" },
  actionButton: { minWidth: 145, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 14, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center" },
  actionText: { color: COLORS.white, fontWeight: "900" },
  completeBadge: { backgroundColor: COLORS.green, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 14, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center" },
  completeText: { color: COLORS.white, fontWeight: "900" },
  inactiveBadge: { backgroundColor: COLORS.slate, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 14 },
  inactiveText: { color: COLORS.white, fontWeight: "900" },
  buttonGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  smallButton: { width: Platform.OS === "web" ? "23.5%" : "48%", backgroundColor: COLORS.primarySoft, borderWidth: 1, borderColor: "#C7D2FE", borderRadius: 14, padding: 12, flexDirection: "row", justifyContent: "center", gap: 7, alignItems: "center" },
  smallButtonText: { color: COLORS.primary, fontWeight: "900", fontSize: 12 },
  disabledButton: { opacity: 0.6 },
});
