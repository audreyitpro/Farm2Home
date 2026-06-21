// app/freight/load-detail.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
  liveRoute: "/freight/live-route",
  routeDetails: "/freight/route-details",
  proofOfPickup: "/freight/proof-of-pickup",
  proofOfDelivery: "/freight/proof-of-delivery",
  routeExceptions: "/freight/route-exceptions",
  connectBank: "/freight/connect-bank",
  paymentSuccess: "/freight/payment-success",
  rateOptimizer: "/freight/rate-optimizer",
  tracking: "/freight/tracking",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof ROUTES)[keyof typeof ROUTES];

const COLORS = {
  bg: "#F3F4F6",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  green: "#16A34A",
  amber: "#D97706",
  blue: "#2563EB",
  purple: "#7C3AED",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
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

function formatStatus(value: any) {
  return String(value || "available")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isAvailableStatus(value: any) {
  return ["available", "open"].includes(normalize(value));
}

function isCarrierAssigned(load: any, carrier: any) {
  const carrierId = String(carrier?.id || carrier?.freightId || carrier?.freight_id || "");
  if (!carrierId) return false;

  return [
    load?.carrier_id,
    load?.freight_user_id,
    load?.driver_id,
    load?.accepted_by,
  ]
    .filter(Boolean)
    .map((x) => String(x))
    .includes(carrierId);
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

function ratePerMile(load: any) {
  const miles = Number(load?.distance_miles || load?.miles || 0);
  const rate = Number(load?.rate || load?.freight_total || load?.payout_amount || 0);
  if (!miles) return 0;
  return rate / miles;
}

export default function FreightLoadDetailScreen() {
  const params = useLocalSearchParams();

  const loadId = useMemo(() => {
    const raw =
      params.loadId ||
      params.load_id ||
      params.id ||
      params.freightLoadId ||
      params.freight_load_id ||
      "";
    return Array.isArray(raw) ? String(raw[0] || "") : String(raw || "");
  }, [params.loadId, params.load_id, params.id, params.freightLoadId, params.freight_load_id]);

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
      businessName:
        nextCarrier.businessName ||
        nextCarrier.companyName ||
        nextCarrier.business_name ||
        nextCarrier.company_name ||
        "Farm2Home Freight Carrier",
    };

    await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(normalized));
    await AsyncStorage.setItem("currentFreight", JSON.stringify(normalized));
    await AsyncStorage.setItem("currentFreightUser", JSON.stringify(normalized));
    await AsyncStorage.setItem("currentUser", JSON.stringify(normalized));
    await AsyncStorage.setItem("userRole", "freight");
    await AsyncStorage.setItem("currentUserRole", "freight");

    setCarrier(normalized);
    return normalized;
  }

  async function loadScreen() {
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

      const identityFilters = [
        authId ? `id.eq.${authId}` : "",
        authId ? `auth_user_id.eq.${authId}` : "",
        storedId ? `id.eq.${storedId}` : "",
        storedId ? `freight_id.eq.${storedId}` : "",
        storedId ? `profile_id.eq.${storedId}` : "",
        email ? `email.eq.${email}` : "",
      ]
        .filter(Boolean)
        .join(",");

      const { data: dbRows, error: dbCarrierError } = await supabase
        .from("freight_users")
        .select("*")
        .or(identityFilters)
        .limit(1);

      if (dbCarrierError) throw dbCarrierError;

      const dbCarrier = Array.isArray(dbRows) && dbRows.length > 0 ? dbRows[0] : null;

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
      });

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

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading load details...</Text>
      </SafeAreaView>
    );
  }

  if (!load) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyTitle}>Load not found</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.replace(ROUTES.board as any)}>
          <Text style={styles.buttonText}>Back to Load Board</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const status = normalize(load.status);
  const isAvailable = isAvailableStatus(status);
  const isBooked = ["accepted", "booked"].includes(status);
  const isPickedUp = ["picked_up", "arrived_pickup"].includes(status);
  const isInTransit = ["in_transit", "arrived_dropoff"].includes(status);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Farm2Home Freight</Text>
            <Text style={styles.title}>{load.title || load.commodity || "Load Details"}</Text>
            <Text style={styles.subtitle}>
              Broker/farmer details, route details, rate, payment tracking, chat, and status actions.
            </Text>
          </View>
        </View>

        <View style={styles.statusCard}>
          <View>
            <Text style={styles.statusLabel}>Current Load Status</Text>
            <Text style={styles.statusValue}>{formatStatus(load.status)}</Text>
          </View>
          <Ionicons name="cube-outline" size={34} color="#FFFFFF" />
        </View>

        <View style={styles.card}>
          <SectionHeader icon="navigate-outline" title="Route Details" />
          <RouteRow label="Pickup" value={load.pickup_location || load.pickup || "Pickup TBD"} />
          <RouteRow label="Delivery" value={load.dropoff_location || load.dropoff || "Dropoff TBD"} />
          <InfoGrid
            items={[
              ["Pickup Date", `${load.pickup_date || "TBD"} ${load.pickup_time || ""}`],
              ["Delivery Date", `${load.dropoff_date || "TBD"} ${load.dropoff_time || ""}`],
              ["Miles", `${Number(load.distance_miles || load.miles || 0).toFixed(0)} mi`],
              ["Equipment", load.equipment_type || load.equipment || "TBD"],
            ]}
          />
        </View>

        <View style={styles.card}>
          <SectionHeader icon="cash-outline" title="Rate & Payment Tracking" />
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

          <TouchableOpacity style={styles.outlineButton} onPress={() => router.push(ROUTES.connectBank as any)}>
            <Ionicons name="business-outline" size={18} color={COLORS.red} />
            <Text style={styles.outlineButtonText}>Connect Bank / Payouts</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <SectionHeader icon="people-outline" title="Broker / Farmer Details" />
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
          <SectionHeader icon="chatbubbles-outline" title="Load Chat" />

          <FlatList
            data={messages}
            keyExtractor={(item, index) => String(item.id || index)}
            scrollEnabled={false}
            ListEmptyComponent={<Text style={styles.emptySmall}>No messages yet.</Text>}
            renderItem={({ item }) => (
              <View style={styles.messageRow}>
                <Text style={styles.messageName}>
                  {item.sender_name || item.sender_role || "Message"}
                </Text>
                <Text style={styles.messageText}>{item.message || item.body || ""}</Text>
              </View>
            )}
          />

          <TouchableOpacity style={styles.button} onPress={openChat}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>Open Load Chat</Text>
          </TouchableOpacity>
        </View>

        {isAvailable ? (
          <View style={styles.card}>
            <SectionHeader icon="pricetag-outline" title="Submit Carrier Bid" />
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
              style={[styles.button, updating && styles.disabledButton]}
              onPress={submitBid}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="send-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.buttonText}>Submit Bid</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.actionGrid}>
          {isAvailable ? (
            <ActionButton
              label="Book Load"
              icon="checkmark-circle-outline"
              onPress={() => updateLoadStatus("accepted")}
              disabled={updating}
            />
          ) : null}

          {isBooked ? (
            <ActionButton
              label="Arrived Pickup"
              icon="location-outline"
              onPress={() => updateLoadStatus("arrived_pickup")}
              disabled={updating}
            />
          ) : null}

          {status === "arrived_pickup" ? (
            <ActionButton
              label="Proof Pickup"
              icon="camera-outline"
              onPress={() => openWithLoad(ROUTES.proofOfPickup, load.id)}
              disabled={updating}
            />
          ) : null}

          {isPickedUp ? (
            <ActionButton
              label="Start Transit"
              icon="navigate-outline"
              onPress={() => updateLoadStatus("in_transit")}
              disabled={updating}
            />
          ) : null}

          {status === "in_transit" ? (
            <ActionButton
              label="Arrived Dropoff"
              icon="flag-outline"
              onPress={() => updateLoadStatus("arrived_dropoff")}
              disabled={updating}
            />
          ) : null}

          {status === "arrived_dropoff" ? (
            <ActionButton
              label="Proof Delivery"
              icon="checkmark-done-outline"
              onPress={() => openWithLoad(ROUTES.proofOfDelivery, load.id)}
              disabled={updating}
            />
          ) : null}

          <ActionButton
            label="Live Tracking"
            icon="map-outline"
            onPress={() => openWithLoad(ROUTES.tracking, load.id)}
          />

          <ActionButton
            label="Live Route"
            icon="navigate-circle-outline"
            onPress={() => openWithLoad(ROUTES.liveRoute, load.id)}
          />

          <ActionButton
            label="Rate Optimizer"
            icon="trending-up-outline"
            onPress={() => router.push(ROUTES.rateOptimizer as any)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={20} color="#FFFFFF" />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function RouteRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.routeRow}>
      <Ionicons name={label === "Pickup" ? "radio-button-on-outline" : "location-outline"} size={20} color={COLORS.red} />
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
    <TouchableOpacity
      style={[styles.actionButton, disabled && styles.disabledButton]}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons name={icon} size={18} color="#FFFFFF" />
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 90 },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  centerText: { color: COLORS.muted, marginTop: 12, fontWeight: "800" },
  emptyTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900", marginBottom: 14 },
  hero: {
    backgroundColor: COLORS.black,
    paddingTop: 26,
    paddingHorizontal: 18,
    paddingBottom: 28,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#1F2937",
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
  title: { color: "#FFFFFF", fontSize: 28, fontWeight: "900", marginTop: 6 },
  subtitle: { color: "#CBD5E1", fontWeight: "700", lineHeight: 21, marginTop: 7 },
  statusCard: {
    backgroundColor: COLORS.red,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusLabel: {
    color: "#FFE4E6",
    fontWeight: "900",
    textTransform: "uppercase",
    fontSize: 12,
  },
  statusValue: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "900",
    marginTop: 5,
    textTransform: "capitalize",
  },
  card: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900" },
  routeRow: {
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    gap: 10,
  },
  routeLabel: {
    color: COLORS.red,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  routeValue: { color: COLORS.text, fontWeight: "900", marginTop: 3, lineHeight: 20 },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 },
  infoBox: {
    width: "48%",
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 13,
  },
  infoLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  infoValue: { color: COLORS.text, fontWeight: "800", marginTop: 5, lineHeight: 19 },
  rateBox: {
    backgroundColor: COLORS.black,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  rateValue: { color: "#FFFFFF", fontSize: 32, fontWeight: "900" },
  rateSub: { color: "#CBD5E1", fontWeight: "800", marginTop: 5 },
  notesBox: {
    backgroundColor: COLORS.black,
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
  },
  notesLabel: { color: "#FCA5A5", fontWeight: "900", marginBottom: 5 },
  notesText: { color: "#CBD5E1", fontWeight: "700", lineHeight: 20 },
  messageRow: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 9,
  },
  messageName: { color: COLORS.red, fontWeight: "900", textTransform: "capitalize" },
  messageText: { color: COLORS.text, fontWeight: "700", marginTop: 4 },
  emptySmall: { color: COLORS.muted, fontWeight: "800", marginBottom: 12 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    padding: 14,
    color: COLORS.text,
    fontWeight: "700",
    marginBottom: 12,
  },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  button: {
    backgroundColor: COLORS.red,
    borderRadius: 15,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  outlineButton: {
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 15,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  outlineButtonText: { color: COLORS.red, fontWeight: "900" },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
  },
  actionButton: {
    width: "48%",
    backgroundColor: COLORS.red,
    borderRadius: 16,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  disabledButton: { opacity: 0.6 },
  buttonText: { color: "#FFFFFF", fontWeight: "900", textAlign: "center" },
});