// app/freight/load-detail.tsx

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
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const ROUTES = {
  dashboard: "/freight/dashboard",
  board: "/freight/board",
  liveLoads: "/freight/live-loads",
  myLoads: "/freight/my-loads",
  loadChat: "/freight/load-chat",
  connectBank: "/freight/connect-bank",
  paymentSuccess: "/freight/payment-success",
  rateOptimizer: "/freight/rate-optimizer",
  tracking: "/freight/tracking",
  liveRoute: "/freight/live-route",
  proofOfPickup: "/freight/proof-of-pickup",
  proofOfDelivery: "/freight/proof-of-delivery",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof ROUTES)[keyof typeof ROUTES];

const COLORS = {
  bg: "#F7F7FB",
  card: "#FFFFFF",
  panel: "#F8FAFC",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E5E7EB",
  borderDark: "#CBD5E1",
  primary: "#6D5DFB",
  primaryDark: "#4F46E5",
  primarySoft: "#EEF2FF",
  green: "#10B981",
  amber: "#F59E0B",
  red: "#EF4444",
  blue: "#2563EB",
  purple: "#7C3AED",
  navy: "#020617",
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

function money(value: any) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatStatus(value: any) {
  return String(value || "available")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function ratePerMile(load: any) {
  const miles = Number(load?.distance_miles || load?.miles || 0);
  const rate = Number(load?.rate || load?.freight_total || load?.payout_amount || 0);
  if (!miles) return 0;
  return rate / miles;
}

function statusColor(status: any) {
  const value = normalize(status);
  if (["available", "open"].includes(value)) return COLORS.blue;
  if (["accepted", "booked"].includes(value)) return COLORS.primary;
  if (["picked_up", "arrived_pickup"].includes(value)) return COLORS.amber;
  if (["in_transit", "arrived_dropoff"].includes(value)) return COLORS.purple;
  if (["delivered", "completed"].includes(value)) return COLORS.green;
  return COLORS.muted;
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

export default function FreightLoadDetailScreen() {
  const params = useLocalSearchParams();
  const loadId = Array.isArray(params.loadId) ? params.loadId[0] : String(params.loadId || "");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);
  const [load, setLoad] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);

  const [bidPerMile, setBidPerMile] = useState("");
  const [bidMessage, setBidMessage] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadScreen();
    }, [loadId])
  );

  const totalRate = useMemo(() => {
    return Number(load?.rate || load?.freight_total || load?.payout_amount || 0);
  }, [load]);

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
    await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(nextCarrier));
    await AsyncStorage.setItem("currentFreight", JSON.stringify(nextCarrier));
    await AsyncStorage.setItem("currentFreightUser", JSON.stringify(nextCarrier));
    await AsyncStorage.setItem("farm2homeCurrentFreight", JSON.stringify(nextCarrier));
    await AsyncStorage.setItem("currentUser", JSON.stringify(nextCarrier));
    await AsyncStorage.setItem("userRole", "freight");
    await AsyncStorage.setItem("currentUserRole", "freight");
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
      console.log("Load detail subscription lookup error:", error.message);
      return null;
    }

    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  }

  async function persistCarrier(nextCarrier: any) {
    const id = clean(nextCarrier.id || nextCarrier.freightId || nextCarrier.freight_id);
    const stripeCustomerId = pickCus(nextCarrier.stripeCustomerId, nextCarrier.stripe_customer_id);
    const stripeSubscriptionId = pickSub(
      nextCarrier.stripeSubscriptionId,
      nextCarrier.stripe_subscription_id,
      nextCarrier.subscriptionId,
      nextCarrier.subscription_id
    );
    const stripeAccountId = pickAcct(
      nextCarrier.freightAccount,
      nextCarrier.freight_account,
      nextCarrier.stripeAccountId,
      nextCarrier.stripe_account_id
    );

    const normalized = {
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
    };

    await saveFreightSession(normalized);
    setCarrier(normalized);
    return normalized;
  }

  async function loadScreen() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();

      const authId = clean(authData?.user?.id || "");
      const storedId = clean(stored?.id || stored?.freightId || stored?.freight_id || "");
      const email = normalize(stored?.email || authData?.user?.email || "");
      const accountId = clean(stored?.accountId || stored?.account_id || "");

      if (!email && !authId && !storedId && !accountId) {
        router.replace(ROUTES.login as any);
        return;
      }

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

      if (carrierError) console.log("Load detail profile error:", carrierError.message);

      const dbCarrier = Array.isArray(dbCarrierRows) && dbCarrierRows.length > 0 ? dbCarrierRows[0] : null;

      if (!dbCarrier) {
        Alert.alert("Freight Profile Missing", "Please complete freight registration first.");
        router.replace(ROUTES.register as any);
        return;
      }

      const sub = await findSubscription(dbCarrier.id || storedId || authId, normalize(dbCarrier.email || email));
      const subAcct = pickAcct(sub?.freight_account, sub?.stripe_account_id);
      const rowAcct = pickAcct(dbCarrier.freight_account, dbCarrier.stripe_account_id);

      let mergedProfile = {
        ...(stored || {}),
        ...(dbCarrier || {}),
        id: dbCarrier.id,
        freightId: dbCarrier.freight_id || dbCarrier.id,
        freight_id: dbCarrier.freight_id || dbCarrier.id,
        email: normalize(dbCarrier.email || email),
        stripe_customer_id: pickCus(dbCarrier.stripe_customer_id, sub?.stripe_customer_id),
        stripe_subscription_id: pickSub(dbCarrier.stripe_subscription_id, dbCarrier.subscription_id, sub?.stripe_subscription_id),
        subscription_id: pickSub(dbCarrier.subscription_id, dbCarrier.stripe_subscription_id, sub?.stripe_subscription_id),
        freight_account: pickAcct(dbCarrier.freight_account, dbCarrier.stripe_account_id, subAcct),
        stripe_account_id: pickAcct(dbCarrier.stripe_account_id, dbCarrier.freight_account, subAcct),
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

      await persistCarrier(mergedProfile);

      if (!loadId) {
        setLoad(null);
        return;
      }

      const { data: loadData, error: loadError } = await supabase
        .from("freight_loads")
        .select("*")
        .eq("id", loadId)
        .maybeSingle();

      if (loadError) throw loadError;
      setLoad(loadData || null);

      const { data: chatData } = await supabase
        .from("freight_load_messages")
        .select("*")
        .eq("load_id", loadId)
        .order("created_at", { ascending: false })
        .limit(5);

      setMessages(Array.isArray(chatData) ? chatData : []);
    } catch (error: any) {
      Alert.alert("Load Detail Error", error?.message || "Unable to load freight details.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadScreen();
  }

  async function updateLoadStatus(nextStatus: string) {
    if (!load?.id || !carrier?.id) return;

    try {
      setUpdating(true);

      const now = new Date().toISOString();
      const payload: any = {
        status: nextStatus,
        updated_at: now,
      };

      if (nextStatus === "accepted") {
        payload.carrier_id = carrier.id;
        payload.freight_user_id = carrier.id;
        payload.accepted_by = carrier.id;
        payload.accepted_at = now;
        payload.carrier_name = carrier.companyName || carrier.businessName;
        payload.carrier_email = carrier.email;
      }

      if (nextStatus === "arrived_pickup") payload.arrived_pickup_at = now;
      if (nextStatus === "picked_up") payload.picked_up_at = now;
      if (nextStatus === "in_transit") payload.in_transit_at = now;
      if (nextStatus === "arrived_dropoff") payload.arrived_dropoff_at = now;

      if (nextStatus === "delivered") {
        payload.delivered_at = now;
        payload.settlement_status = "pending";
        payload.payout_status = "pending";
      }

      const { error } = await supabase.from("freight_loads").update(payload).eq("id", load.id);
      if (error) throw error;

      await supabase.from("freight_notifications").insert({
        freight_user_id: carrier.id,
        freight_id: carrier.id,
        user_id: carrier.id,
        load_id: load.id,
        title: "Load Updated",
        message: `${load.title || load.commodity || "Freight Load"} is now ${formatStatus(nextStatus)}.`,
        type: "load",
        is_read: false,
        read: false,
        created_at: now,
      });

      await loadScreen();
    } catch (error: any) {
      Alert.alert("Update Error", error?.message || "Unable to update load.");
    } finally {
      setUpdating(false);
    }
  }

  async function submitBid() {
    if (!load?.id || !carrier?.id) return;

    const bidRate = Number(bidPerMile);

    if (!bidRate || Number.isNaN(bidRate) || bidRate <= 0) {
      Alert.alert("Invalid Bid", "Enter a valid bid per mile.");
      return;
    }

    try {
      setUpdating(true);

      const miles = Number(load.distance_miles || load.miles || 0);
      const now = new Date().toISOString();

      const { error } = await supabase.from("freight_bids").insert({
        load_id: load.id,
        freight_id: carrier.id,
        carrier_id: carrier.id,
        carrier_company: carrier.companyName || carrier.businessName,
        carrier_email: carrier.email,
        bid_per_mile: bidRate,
        total_bid: bidRate * miles,
        message: bidMessage.trim(),
        status: "pending",
        created_at: now,
        updated_at: now,
      });

      if (error) throw error;

      setBidPerMile("");
      setBidMessage("");
      Alert.alert("Bid Submitted", "Your freight bid was sent.");
    } catch (error: any) {
      Alert.alert("Bid Error", error?.message || "Unable to submit bid.");
    } finally {
      setUpdating(false);
    }
  }

  function openChat() {
    if (!load?.id) return;
    router.push({
      pathname: ROUTES.loadChat as any,
      params: { loadId: load.id },
    });
  }

  function openWithLoad(route: FreightRoute) {
    if (!load?.id) return;
    router.push({
      pathname: route as any,
      params: { loadId: load.id },
    });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.centerText}>Loading load details...</Text>
      </SafeAreaView>
    );
  }

  if (!load) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyTitle}>Load not found</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace(ROUTES.board as any)}>
          <Text style={styles.primaryButtonText}>Back to Load Board</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const status = normalize(load.status);
  const isAvailable = ["available", "open"].includes(status);
  const isBooked = ["accepted", "booked"].includes(status);
  const isArrivedPickup = status === "arrived_pickup";
  const isPickedUp = status === "picked_up";
  const isInTransit = status === "in_transit";
  const isArrivedDropoff = status === "arrived_dropoff";

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.shell}>
          <View style={styles.sidebar}>
            <View style={styles.brandRow}>
              <View style={styles.brandIcon}>
                <Ionicons name="document-text-outline" size={28} color={COLORS.white} />
              </View>
              <View>
                <Text style={styles.brandTitle}>Farm2Home</Text>
                <Text style={styles.brandSubtitle}>Load Detail</Text>
              </View>
            </View>

            <View style={styles.sideDivider} />
            <SidebarLink icon="grid-outline" title="Dashboard" route={ROUTES.dashboard} />
            <SidebarLink icon="search-outline" title="Load Board" route={ROUTES.board} />
            <SidebarLink icon="briefcase-outline" title="My Loads" route={ROUTES.myLoads} />
            <SidebarLink icon="pulse-outline" title="Live Loads" route={ROUTES.liveLoads} />
            <SidebarLink icon="chatbubbles-outline" title="Load Chat" route={ROUTES.loadChat} />
            <SidebarLink icon="business-outline" title="Payouts" route={ROUTES.connectBank} />

            <View style={styles.sideNote}>
              <Text style={styles.sideNoteLabel}>Load ID</Text>
              <Text style={styles.sideNoteValue}>#{String(load.id).slice(-8)}</Text>
            </View>
          </View>

          <View style={styles.main}>
            <View style={styles.topPanel}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Ionicons name="chevron-back-outline" size={23} color={COLORS.primary} />
              </TouchableOpacity>

              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>Fina Admin Freight Detail</Text>
                <Text style={styles.pageTitle}>{load.title || load.commodity || "Load Details"}</Text>
                <Text style={styles.pageSubtitle}>
                  Broker/farmer details, route details, rate, payment tracking, chat, proof actions, and status updates.
                </Text>
              </View>

              <View style={[styles.statusPill, { backgroundColor: statusColor(load.status) }]}>
                <Text style={styles.statusPillText}>{formatStatus(load.status)}</Text>
              </View>
            </View>

            <View style={styles.metricGrid}>
              <MetricCard label="Carrier Rate" value={money(totalRate)} icon="cash-outline" />
              <MetricCard label="Rate / Mile" value={`${money(ratePerMile(load))}/mi`} icon="trending-up-outline" />
              <MetricCard label="Miles" value={`${Number(load.distance_miles || load.miles || 0).toFixed(0)} mi`} icon="speedometer-outline" />
              <MetricCard label="Status" value={formatStatus(load.status)} icon="flag-outline" />
            </View>

            <View style={styles.gridTwo}>
              <View style={styles.card}>
                <SectionHeader icon="navigate-outline" title="Route Details" subtitle="Pickup and delivery route information." />
                <RouteRow label="Pickup" value={load.pickup_location || load.pickup || "Pickup TBD"} />
                <RouteRow label="Delivery" value={load.dropoff_location || load.dropoff || "Dropoff TBD"} />
                <InfoGrid
                  items={[
                    ["Pickup Date", `${load.pickup_date || "TBD"} ${load.pickup_time || ""}`],
                    ["Delivery Date", `${load.dropoff_date || "TBD"} ${load.dropoff_time || ""}`],
                    ["Equipment", load.equipment_type || load.equipment || "TBD"],
                    ["Commodity", load.commodity || "Farm Freight"],
                  ]}
                />

                <View style={styles.quickActionRow}>
                  <SmallButton title="Tracking" icon="map-outline" onPress={() => openWithLoad(ROUTES.tracking)} />
                  <SmallButton title="Live Route" icon="navigate-outline" onPress={() => openWithLoad(ROUTES.liveRoute)} />
                </View>
              </View>

              <View style={styles.card}>
                <SectionHeader icon="cash-outline" title="Rate & Payment" subtitle="Carrier rate, payout, settlement, and Connect Bank." />
                <View style={styles.rateBox}>
                  <Text style={styles.rateValue}>{money(totalRate)}</Text>
                  <Text style={styles.rateSub}>{money(ratePerMile(load))} / mile</Text>
                </View>

                <InfoGrid
                  items={[
                    ["Settlement", load.settlement_status || "pending"],
                    ["Payout", load.payout_status || "pending"],
                    ["Weight", load.weight_lbs ? `${Number(load.weight_lbs).toLocaleString()} lbs` : "TBD"],
                    ["Temperature", load.temperature_required || "Not required"],
                  ]}
                />

                <TouchableOpacity style={styles.secondaryButton} onPress={() => goTo(ROUTES.connectBank)}>
                  <Ionicons name="business-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.secondaryButtonText}>Connect Bank / Payouts</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.card}>
              <SectionHeader icon="people-outline" title="Broker / Farmer Details" subtitle="Contact and load partner details." />
              <InfoGrid
                items={[
                  ["Farmer", load.farmer_name || load.farm_name || "Farm2Home Farmer"],
                  ["Broker", load.broker_name || load.farmer_name || "Farm2Home Broker"],
                  ["Contact", load.contact_phone || load.phone || "Not listed"],
                  ["Email", load.contact_email || load.email || "Not listed"],
                ]}
              />
              {!!load.notes && (
                <View style={styles.notesBox}>
                  <Text style={styles.notesLabel}>Load Notes</Text>
                  <Text style={styles.notesText}>{load.notes}</Text>
                </View>
              )}
            </View>

            <View style={styles.card}>
              <SectionHeader icon="chatbubbles-outline" title="Load Chat" subtitle="Recent load messages." />

              <FlatList
                data={messages}
                keyExtractor={(item, index) => String(item.id || index)}
                scrollEnabled={false}
                ListEmptyComponent={<Text style={styles.emptySmall}>No messages yet.</Text>}
                renderItem={({ item }) => (
                  <View style={styles.messageRow}>
                    <Text style={styles.messageName}>{item.sender_name || item.sender_role || "Message"}</Text>
                    <Text style={styles.messageText}>{item.message || item.body || ""}</Text>
                  </View>
                )}
              />

              <TouchableOpacity style={styles.primaryButton} onPress={openChat}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={COLORS.white} />
                <Text style={styles.primaryButtonText}>Open Load Chat</Text>
              </TouchableOpacity>
            </View>

            {isAvailable ? (
              <View style={styles.card}>
                <SectionHeader icon="pricetag-outline" title="Submit Carrier Bid" subtitle="Send a rate-per-mile offer for available freight." />
                <TextInput
                  style={styles.input}
                  placeholder="Your bid per mile"
                  placeholderTextColor="#94A3B8"
                  keyboardType="decimal-pad"
                  value={bidPerMile}
                  onChangeText={setBidPerMile}
                />
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Message to farmer/broker"
                  placeholderTextColor="#94A3B8"
                  multiline
                  value={bidMessage}
                  onChangeText={setBidMessage}
                />

                <TouchableOpacity
                  style={[styles.primaryButton, updating && styles.disabledButton]}
                  onPress={submitBid}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <>
                      <Ionicons name="send-outline" size={18} color={COLORS.white} />
                      <Text style={styles.primaryButtonText}>Submit Bid</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.card}>
              <SectionHeader icon="flash-outline" title="Load Actions" subtitle="Move the load through pickup, transit, and delivery." />
              <View style={styles.actionGrid}>
                {isAvailable ? (
                  <ActionButton label="Book Load" icon="checkmark-circle-outline" onPress={() => updateLoadStatus("accepted")} disabled={updating} />
                ) : null}

                {isBooked ? (
                  <ActionButton label="Arrived Pickup" icon="location-outline" onPress={() => updateLoadStatus("arrived_pickup")} disabled={updating} />
                ) : null}

                {isArrivedPickup ? (
                  <ActionButton label="Proof Pickup" icon="camera-outline" onPress={() => openWithLoad(ROUTES.proofOfPickup)} disabled={updating} />
                ) : null}

                {isPickedUp ? (
                  <ActionButton label="Start Transit" icon="navigate-outline" onPress={() => updateLoadStatus("in_transit")} disabled={updating} />
                ) : null}

                {isInTransit ? (
                  <ActionButton label="Arrived Dropoff" icon="flag-outline" onPress={() => updateLoadStatus("arrived_dropoff")} disabled={updating} />
                ) : null}

                {isArrivedDropoff ? (
                  <ActionButton label="Proof Delivery" icon="checkmark-done-outline" onPress={() => openWithLoad(ROUTES.proofOfDelivery)} disabled={updating} />
                ) : null}

                <ActionButton label="Live Tracking" icon="map-outline" onPress={() => openWithLoad(ROUTES.tracking)} />
                <ActionButton label="Rate Optimizer" icon="trending-up-outline" onPress={() => goTo(ROUTES.rateOptimizer)} />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SidebarLink({
  icon,
  title,
  route,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  route: FreightRoute;
}) {
  return (
    <TouchableOpacity style={styles.sidebarLink} onPress={() => goTo(route)}>
      <Ionicons name={icon} size={18} color="#A5B4FC" />
      <Text style={styles.sidebarLinkText}>{title}</Text>
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
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
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

function RouteRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.routeRow}>
      <Ionicons name={label === "Pickup" ? "radio-button-on-outline" : "location-outline"} size={20} color={label === "Pickup" ? COLORS.green : COLORS.red} />
      <View style={{ flex: 1 }}>
        <Text style={styles.routeLabel}>{label}</Text>
        <Text style={styles.routeValue}>{value}</Text>
      </View>
    </View>
  );
}

function InfoGrid({ items }: { items: string[][] }) {
  return (
    <View style={styles.infoGrid}>
      {items.map(([label, value]) => (
        <View style={styles.infoBox} key={label}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={styles.infoValue}>{value || "TBD"}</Text>
        </View>
      ))}
    </View>
  );
}

function ActionButton({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity style={[styles.actionButton, disabled && styles.disabledButton]} onPress={onPress} disabled={disabled}>
      <Ionicons name={icon} size={18} color={COLORS.white} />
      <Text style={styles.actionButtonText}>{label}</Text>
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
      <Ionicons name={icon} size={17} color={COLORS.primary} />
      <Text style={styles.smallButtonText}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { flexGrow: 1, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  centerText: { color: COLORS.muted, marginTop: 12, fontWeight: "800" },
  emptyTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900", marginBottom: 14 },
  shell: { flex: 1, flexDirection: Platform.OS === "web" ? "row" : "column" },
  sidebar: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 22,
    width: Platform.OS === "web" ? 310 : "100%",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  brandIcon: {
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: { color: COLORS.white, fontSize: 21, fontWeight: "900" },
  brandSubtitle: { color: "#A5B4FC", fontWeight: "800", marginTop: 2 },
  sideDivider: { height: 1, backgroundColor: "#1E293B", marginVertical: 22 },
  sidebarLink: {
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginBottom: 8,
  },
  sidebarLinkText: { color: "#CBD5E1", fontWeight: "900" },
  sideNote: {
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 18,
    padding: 14,
    marginTop: 12,
  },
  sideNoteLabel: { color: "#A5B4FC", fontWeight: "900", textTransform: "uppercase", fontSize: 11 },
  sideNoteValue: { color: COLORS.white, fontWeight: "900", marginTop: 6 },
  main: { flex: 1, padding: 18 },
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
  backButton: {
    width: 46,
    height: 46,
    borderRadius: 18,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: { color: COLORS.primary, fontWeight: "900", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  pageTitle: { color: COLORS.text, fontSize: 31, fontWeight: "900", marginTop: 6 },
  pageSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 22, marginTop: 7, maxWidth: 760 },
  statusPill: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  statusPillText: { color: COLORS.white, fontWeight: "900", fontSize: 12 },
  metricGrid: { flexDirection: Platform.OS === "web" ? "row" : "column", gap: 12, marginBottom: 14 },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    padding: 16,
  },
  metricIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  metricLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 11, textTransform: "uppercase" },
  metricValue: { color: COLORS.text, fontWeight: "900", fontSize: 20, marginTop: 5 },
  gridTwo: { flexDirection: Platform.OS === "web" ? "row" : "column", gap: 14, alignItems: "flex-start" },
  card: {
    flex: 1,
    width: "100%",
    backgroundColor: COLORS.white,
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  sectionHeader: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 16 },
  sectionIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900" },
  sectionSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 3 },
  routeRow: {
    backgroundColor: COLORS.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    gap: 10,
  },
  routeLabel: { color: COLORS.primary, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  routeValue: { color: COLORS.text, fontWeight: "900", marginTop: 3, lineHeight: 20 },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 },
  infoBox: {
    width: Platform.OS === "web" ? "23.5%" : "48%",
    backgroundColor: COLORS.panel,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 13,
  },
  infoLabel: { color: COLORS.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  infoValue: { color: COLORS.text, fontWeight: "800", marginTop: 5, lineHeight: 19 },
  quickActionRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  smallButton: {
    flex: 1,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
    alignItems: "center",
  },
  smallButtonText: { color: COLORS.primary, fontWeight: "900", fontSize: 12 },
  rateBox: { backgroundColor: COLORS.navy, borderRadius: 18, padding: 16, marginBottom: 12 },
  rateValue: { color: COLORS.white, fontSize: 32, fontWeight: "900" },
  rateSub: { color: "#CBD5E1", fontWeight: "800", marginTop: 5 },
  notesBox: { backgroundColor: COLORS.navy, borderRadius: 16, padding: 14, marginTop: 12 },
  notesLabel: { color: "#A5B4FC", fontWeight: "900", marginBottom: 5 },
  notesText: { color: "#CBD5E1", fontWeight: "700", lineHeight: 20 },
  messageRow: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 9,
  },
  messageName: { color: COLORS.primary, fontWeight: "900", textTransform: "capitalize" },
  messageText: { color: COLORS.text, fontWeight: "700", marginTop: 4 },
  emptySmall: { color: COLORS.muted, fontWeight: "800", marginBottom: 12 },
  input: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    borderRadius: 15,
    padding: 14,
    color: COLORS.text,
    fontWeight: "700",
    marginBottom: 12,
  },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 15,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  primaryButtonText: { color: COLORS.white, fontWeight: "900", textAlign: "center" },
  secondaryButton: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 15,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  secondaryButtonText: { color: COLORS.primary, fontWeight: "900" },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionButton: {
    width: Platform.OS === "web" ? "23.5%" : "48%",
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  disabledButton: { opacity: 0.6 },
  actionButtonText: { color: COLORS.white, fontWeight: "900", textAlign: "center", flexShrink: 1 },
});
