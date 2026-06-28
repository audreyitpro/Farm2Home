// app/farmer/delivery-operations.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../data/supabaseClient";

const COLORS = {
  bg: "#F6F8F2",
  card: "#FFFFFF",
  text: "#172017",
  muted: "#64748B",
  border: "#E3E8DD",
  primary: "#2E7D32",
  primaryDark: "#14532D",
  blue: "#2563EB",
  dark: "#111827",
  greenSoft: "#DCFCE7",
  blueSoft: "#DBEAFE",
  redSoft: "#FEE2E2",
  orangeSoft: "#FFF7ED",
  white: "#FFFFFF",
};

type FarmerSession = {
  id?: string;
  farmer_id?: string;
  farmerId?: string;
  profile_id?: string;
  auth_user_id?: string;
  email?: string;
  farm_name?: string;
  farmName?: string;
  business_name?: string;
  businessName?: string;
};

type DeliveryOrder = {
  id: string;
  order_id?: string;
  farmer_id?: string;
  customer_id?: string;
  driver_id?: string;
  driver_name?: string;
  customer_name?: string;
  pickup_address?: string;
  dropoff_address?: string;
  miles?: number;
  delivery_fee?: number;
  status?: string;
  source?: string;
  created_at?: string;
};

type FreightLoad = {
  id: string;
  farmer_id?: string;
  product_name?: string;
  load_type?: string;
  miles?: number;
  total_due?: number;
  status?: string;
  created_at?: string;
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function money(value: any) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function firstParam(value: any) {
  if (Array.isArray(value)) return value[0] || "";
  return value ? String(value) : "";
}

function getFarmerId(farmer?: FarmerSession | null) {
  return clean(
    farmer?.farmer_id ||
      farmer?.farmerId ||
      farmer?.id ||
      farmer?.profile_id ||
      farmer?.auth_user_id
  );
}

function getFarmName(farmer?: FarmerSession | null) {
  return (
    clean(farmer?.farm_name || farmer?.farmName) ||
    clean(farmer?.business_name || farmer?.businessName) ||
    "Farm2Home Farmer"
  );
}

function rowMatchesFarmer(row: any, farmerId: string, farmerEmail: string) {
  const ids = [
    row?.farmer_id,
    row?.seller_id,
    row?.vendor_id,
    row?.store_id,
    row?.farm_id,
    row?.owner_id,
    row?.user_id,
    row?.profile_id,
    row?.auth_user_id,
  ].map(clean);

  const emails = [
    row?.farmer_email,
    row?.seller_email,
    row?.vendor_email,
    row?.email,
  ].map(normalize);

  return Boolean(
    (farmerId && ids.includes(farmerId)) ||
      (farmerEmail && emails.includes(farmerEmail))
  );
}

async function safeSelectRecent(table: string, limit = 300) {
  try {
    let result = await supabase
      .from(table)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!result.error) return Array.isArray(result.data) ? result.data : [];

    console.log(`${table} created_at order skipped:`, result.error.message);

    result = await supabase.from(table).select("*").limit(limit);

    if (!result.error) return Array.isArray(result.data) ? result.data : [];

    console.log(`${table} select skipped:`, result.error.message);
    return [];
  } catch (error: any) {
    console.log(`${table} select failed:`, error?.message || error);
    return [];
  }
}

export default function FarmerDeliveryOperationsScreen() {
  const params = useLocalSearchParams();
  const farmerIdParam = firstParam(params.farmerId || params.farmer_id || params.id);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [farmer, setFarmer] = useState<FarmerSession | null>(null);
  const [farmerId, setFarmerId] = useState("");

  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([]);
  const [freightLoads, setFreightLoads] = useState<FreightLoad[]>([]);

  useFocusEffect(
    useCallback(() => {
      initialize();
    }, [farmerIdParam])
  );

  const stats = useMemo(() => {
    const activeDeliveries = deliveries.filter(
      (d) =>
        !["completed", "delivered", "cancelled", "canceled"].includes(
          normalize(d.status || "available")
        )
    ).length;

    const revenue =
      deliveries.reduce((sum, d) => sum + Number(d.delivery_fee || 0), 0) +
      freightLoads.reduce((sum, f) => sum + Number(f.total_due || 0), 0);

    return {
      deliveries: deliveries.length,
      freight: freightLoads.length,
      active: activeDeliveries,
      revenue,
    };
  }, [deliveries, freightLoads]);

  async function readLocalFarmer() {
    const raw =
      (await AsyncStorage.getItem("currentFarmer")) ||
      (await AsyncStorage.getItem("farm2homeCurrentFarmer")) ||
      (await AsyncStorage.getItem("farm2homeFarmerSession")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function findSupabaseFarmer(localFarmer: FarmerSession | null) {
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;

    const id = clean(farmerIdParam || getFarmerId(localFarmer) || authUser?.id);
    const email = normalize(localFarmer?.email || authUser?.email);

    const rows = await safeSelectRecent("farmers", 500);

    if (id) {
      const found = rows.find((row: any) =>
        [row?.id, row?.farmer_id, row?.profile_id, row?.auth_user_id]
          .map(clean)
          .includes(id)
      );

      if (found) return found;
    }

    if (email) {
      const found = rows.find((row: any) => normalize(row?.email) === email);
      if (found) return found;
    }

    return null;
  }

  async function saveFarmerSession(nextFarmer: FarmerSession) {
    const id = getFarmerId(nextFarmer);

    const normalized = {
      ...nextFarmer,
      id,
      farmer_id: id,
      farmerId: id,
      role: "farmer",
      email: normalize(nextFarmer.email),
    };

    await AsyncStorage.multiSet([
      ["currentFarmer", JSON.stringify(normalized)],
      ["farm2homeCurrentFarmer", JSON.stringify(normalized)],
      ["farm2homeFarmerSession", JSON.stringify(normalized)],
      ["currentUser", JSON.stringify(normalized)],
      ["userRole", "farmer"],
      ["currentUserRole", "farmer"],
    ]);

    setFarmer(normalized);
    setFarmerId(id);

    return normalized;
  }

  async function initialize() {
    try {
      setLoading(true);

      const localFarmer = await readLocalFarmer();
      const dbFarmer = await findSupabaseFarmer(localFarmer);

      const merged: FarmerSession = {
        ...(localFarmer || {}),
        ...(dbFarmer || {}),
        id: clean(
          dbFarmer?.id ||
            dbFarmer?.farmer_id ||
            localFarmer?.id ||
            localFarmer?.farmer_id ||
            localFarmer?.farmerId ||
            farmerIdParam
        ),
        farmer_id: clean(
          dbFarmer?.farmer_id ||
            dbFarmer?.id ||
            localFarmer?.farmer_id ||
            localFarmer?.id ||
            localFarmer?.farmerId ||
            farmerIdParam
        ),
        farmerId: clean(
          dbFarmer?.farmer_id ||
            dbFarmer?.id ||
            localFarmer?.farmer_id ||
            localFarmer?.id ||
            localFarmer?.farmerId ||
            farmerIdParam
        ),
      };

      if (!getFarmerId(merged)) {
        Alert.alert("Farmer Login Required", "Please login as a farmer.");
        router.replace("/farmer/login" as any);
        return;
      }

      const saved = await saveFarmerSession(merged);
      await loadOperations(getFarmerId(saved), normalize(saved.email));
    } catch (error: any) {
      console.log("Delivery operations load error:", error);
      Alert.alert("Load Error", error?.message || "Unable to load delivery operations.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadOperations(id: string, email = "") {
    try {
      setRefreshing(true);

      const deliveryTables = ["delivery_orders", "farm_orders", "customer_orders"];
      const freightTables = ["freight_loads", "loads", "posted_loads"];

      const loadedDeliveries: DeliveryOrder[] = [];
      const loadedFreight: FreightLoad[] = [];

      for (const table of deliveryTables) {
        const rows = await safeSelectRecent(table, 300);
        const filtered = rows.filter((row: any) => rowMatchesFarmer(row, id, email));

        loadedDeliveries.push(
          ...filtered.map((row: any) => ({
            id: clean(row.id || row.order_id || `${table}_${loadedDeliveries.length}`),
            order_id: clean(row.order_id || row.id),
            farmer_id: clean(row.farmer_id),
            customer_id: clean(row.customer_id),
            driver_id: clean(row.driver_id),
            driver_name: clean(row.driver_name || row.driverName),
            customer_name: clean(row.customer_name || row.customerName),
            pickup_address: clean(row.pickup_address || row.pickupAddress || row.origin),
            dropoff_address: clean(row.dropoff_address || row.dropoffAddress || row.destination),
            miles: Number(row.miles || row.distance_miles || 0),
            delivery_fee: Number(row.delivery_fee || row.deliveryFee || row.fee || row.total || 0),
            status: clean(row.status || row.delivery_status || row.order_status || "available"),
            source: table,
            created_at: clean(row.created_at),
          }))
        );
      }

      for (const table of freightTables) {
        const rows = await safeSelectRecent(table, 300);
        const filtered = rows.filter((row: any) => rowMatchesFarmer(row, id, email));

        loadedFreight.push(
          ...filtered.map((row: any) => ({
            id: clean(row.id || row.load_id || `${table}_${loadedFreight.length}`),
            farmer_id: clean(row.farmer_id),
            product_name: clean(row.product_name || row.title || row.commodity || "Farm Freight"),
            load_type: clean(row.load_type || row.type || "Farm Freight"),
            miles: Number(row.miles || row.distance_miles || 0),
            total_due: Number(row.total_due || row.payout || row.price || row.amount || 0),
            status: clean(row.status || "available"),
            created_at: clean(row.created_at),
          }))
        );
      }

      setDeliveries(
        Array.from(new Map(loadedDeliveries.map((item) => [item.id, item])).values())
      );

      setFreightLoads(
        Array.from(new Map(loadedFreight.map((item) => [item.id, item])).values())
      );
    } catch (error: any) {
      Alert.alert("Operations Error", error?.message || "Unable to load delivery operations.");
    } finally {
      setRefreshing(false);
    }
  }

  async function refreshData() {
    if (!farmerId) {
      await initialize();
      return;
    }

    await loadOperations(farmerId, normalize(farmer?.email));
  }

  function getStatusColor(status?: string) {
    const value = normalize(status || "available");

    if (["completed", "delivered"].includes(value)) return COLORS.greenSoft;
    if (["cancelled", "canceled", "rejected"].includes(value)) return COLORS.redSoft;
    if (["pending", "available", "open"].includes(value)) return COLORS.orangeSoft;

    return COLORS.blueSoft;
  }

  function openDriverChat(delivery: DeliveryOrder) {
    router.push({
      pathname: "/farmer/driver-chat",
      params: {
        farmerId,
        orderId: delivery.order_id || delivery.id || "",
        driverId: delivery.driver_id || "",
      },
    } as any);
  }

  function openTracking(delivery: DeliveryOrder) {
    router.push({
      pathname: "/customer/order-tracking",
      params: {
        orderId: delivery.order_id || delivery.id || "",
      },
    } as any);
  }

  function assignDriver(delivery: DeliveryOrder) {
    router.push({
      pathname: "/farmer/assigned-drivers",
      params: {
        farmerId,
        deliveryId: delivery.id,
        orderId: delivery.order_id || delivery.id || "",
      },
    } as any);
  }

  function postLoad() {
    router.push({
      pathname: "/farmer/post-load",
      params: farmerId ? { farmerId } : {},
    } as any);
  }

  function openOrders() {
    router.push({
      pathname: "/farmer/delivery-orders",
      params: farmerId ? { farmerId } : {},
    } as any);
  }

  function renderDelivery({ item }: { item: DeliveryOrder }) {
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>
              Order #{String(item.order_id || item.id).slice(-6)}
            </Text>
            <Text style={styles.smallText}>
              Customer: {item.customer_name || "Customer"}
            </Text>
            <Text style={styles.smallText}>
              Driver: {item.driver_name || "Unassigned"}
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status || "available"}</Text>
          </View>
        </View>

        <Text style={styles.label}>Pickup</Text>
        <Text style={styles.value}>{item.pickup_address || "Not available"}</Text>

        <Text style={styles.label}>Dropoff</Text>
        <Text style={styles.value}>{item.dropoff_address || "Not available"}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Miles</Text>
            <Text style={styles.metaValue}>{Number(item.miles || 0).toFixed(1)}</Text>
          </View>

          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Delivery Fee</Text>
            <Text style={styles.metaValue}>{money(item.delivery_fee)}</Text>
          </View>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.actionButton} onPress={() => assignDriver(item)}>
            <Ionicons name="person-add-outline" size={17} color={COLORS.white} />
            <Text style={styles.actionButtonText}>Assign Driver</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => openDriverChat(item)}>
            <Ionicons name="chatbubble-outline" size={17} color={COLORS.white} />
            <Text style={styles.secondaryButtonText}>Driver Chat</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.darkButton} onPress={() => openTracking(item)}>
            <Ionicons name="navigate-outline" size={17} color={COLORS.white} />
            <Text style={styles.darkButtonText}>Live Tracking</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderFreight({ item }: { item: FreightLoad }) {
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{item.product_name || "Freight Load"}</Text>
            <Text style={styles.smallText}>{item.load_type || "Farm Freight"}</Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status || "available"}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Miles</Text>
            <Text style={styles.metaValue}>{Number(item.miles || 0).toFixed(1)}</Text>
          </View>

          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Total</Text>
            <Text style={styles.metaValue}>{money(item.total_due)}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.actionButtonFull} onPress={() => router.push("/freight/board" as any)}>
          <Ionicons name="trail-sign-outline" size={17} color={COLORS.white} />
          <Text style={styles.actionButtonText}>Open Freight Board</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading delivery operations...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={deliveries}
      keyExtractor={(item) => item.id}
      renderItem={renderDelivery}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshData} />}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <>
          <View style={styles.header}>
            <View style={styles.topRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.push("/farmer/dashboard" as any)}
              >
                <Ionicons name="arrow-back-outline" size={21} color={COLORS.text} />
              </TouchableOpacity>

              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>Farm2Home Farmer</Text>
                <Text style={styles.title}>Delivery Operations</Text>
                <Text style={styles.subtitle}>
                  {getFarmName(farmer)} delivery workflow, drivers, freight loads,
                  tracking, and communications.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.hero}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroBadge}>Priority Dispatch</Text>
              <Text style={styles.heroTitle}>Keep every farm delivery moving.</Text>
              <Text style={styles.heroText}>
                Assign drivers, track active orders, manage freight needs, and
                monitor delivery revenue.
              </Text>
            </View>

            <View style={styles.heroIcon}>
              <Ionicons name="navigate-outline" size={34} color={COLORS.white} />
            </View>
          </View>

          <View style={styles.summaryRow}>
            <SummaryCard label="Deliveries" value={String(stats.deliveries)} icon="cube-outline" />
            <SummaryCard label="Active" value={String(stats.active)} icon="radio-outline" />
            <SummaryCard label="Freight" value={String(stats.freight)} icon="trail-sign-outline" />
            <SummaryCard label="Revenue" value={money(stats.revenue)} icon="cash-outline" />
          </View>

          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.quickButton} onPress={postLoad}>
              <Ionicons name="add-circle-outline" size={18} color={COLORS.white} />
              <Text style={styles.quickButtonText}>Post Load</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickButtonLight} onPress={openOrders}>
              <Ionicons name="receipt-outline" size={18} color={COLORS.primaryDark} />
              <Text style={styles.quickButtonLightText}>Delivery Orders</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Freight Loads</Text>

          {freightLoads.length ? (
            freightLoads.map((load) => <View key={load.id}>{renderFreight({ item: load })}</View>)
          ) : (
            <EmptyCard
              icon="trail-sign-outline"
              title="No freight loads yet"
              text="Post a farm load when you need freight or larger delivery support."
              button="Post Load"
              onPress={postLoad}
            />
          )}

          <Text style={styles.sectionTitle}>Delivery Orders</Text>

          {!deliveries.length ? (
            <EmptyCard
              icon="cube-outline"
              title="No delivery orders yet"
              text="New farm delivery orders will appear here when customers place orders."
              button="View Orders"
              onPress={openOrders}
            />
          ) : null}
        </>
      }
    />
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryIcon}>
        <Ionicons name={icon} size={19} color={COLORS.primaryDark} />
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function EmptyCard({
  icon,
  title,
  text,
  button,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  button: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={26} color={COLORS.primaryDark} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
      <TouchableOpacity style={styles.emptyButton} onPress={onPress}>
        <Text style={styles.emptyButtonText}>{button}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.bg },
  loadingText: { marginTop: 12, color: COLORS.primary, fontWeight: "800" },
  content: { padding: 16, paddingBottom: 100, backgroundColor: COLORS.bg },
  header: { marginBottom: 14 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: {
    width: 46,
    height: 46,
    borderRadius: 17,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    color: COLORS.primary,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    fontSize: 12,
  },
  title: { fontSize: 29, fontWeight: "900", color: COLORS.text, marginTop: 2 },
  subtitle: { marginTop: 6, color: COLORS.muted, lineHeight: 20, fontWeight: "700" },
  hero: {
    backgroundColor: COLORS.primary,
    borderRadius: 28,
    padding: 20,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  heroBadge: {
    color: "#D9F99D",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 11,
  },
  heroTitle: { color: COLORS.white, fontSize: 25, fontWeight: "900", marginTop: 6 },
  heroText: { color: COLORS.white, opacity: 0.9, fontWeight: "700", lineHeight: 20, marginTop: 7 },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  summaryCard: {
    width: Platform.OS === "web" ? "24%" : "48%",
    minWidth: 145,
    flexGrow: 1,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  summaryValue: { fontSize: 21, fontWeight: "900", color: COLORS.primary },
  summaryLabel: { marginTop: 4, color: COLORS.muted, fontWeight: "800", fontSize: 12 },
  quickActions: { flexDirection: "row", gap: 10, marginBottom: 18, flexWrap: "wrap" },
  quickButton: {
    flex: 1,
    minWidth: 160,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  quickButtonText: { color: COLORS.white, fontWeight: "900" },
  quickButtonLight: {
    flex: 1,
    minWidth: 160,
    backgroundColor: COLORS.greenSoft,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  quickButtonLightText: { color: COLORS.primaryDark, fontWeight: "900" },
  sectionTitle: { fontSize: 20, fontWeight: "900", color: COLORS.text, marginBottom: 10, marginTop: 8 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  cardTitle: { fontSize: 18, fontWeight: "900", color: COLORS.text },
  smallText: { color: COLORS.muted, marginTop: 4, fontWeight: "700" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusText: { fontWeight: "900", fontSize: 11, color: COLORS.text, textTransform: "capitalize" },
  label: { marginTop: 10, marginBottom: 3, color: COLORS.muted, fontWeight: "900" },
  value: { color: COLORS.text, fontWeight: "700" },
  metaRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  metaCard: { flex: 1, backgroundColor: "#F1F5F9", borderRadius: 14, padding: 11 },
  metaLabel: { color: COLORS.muted, fontWeight: "900" },
  metaValue: { marginTop: 3, fontSize: 16, fontWeight: "900", color: COLORS.text },
  buttonRow: { marginTop: 12, gap: 8 },
  actionButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  actionButtonFull: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    flexDirection: "row",
    gap: 7,
  },
  actionButtonText: { color: COLORS.white, fontWeight: "900" },
  secondaryButton: {
    backgroundColor: COLORS.blue,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  secondaryButtonText: { color: COLORS.white, fontWeight: "900" },
  darkButton: {
    backgroundColor: COLORS.dark,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  darkButtonText: { color: COLORS.white, fontWeight: "900" },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    marginBottom: 12,
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { color: COLORS.text, fontWeight: "900", fontSize: 18, marginTop: 10 },
  emptyText: { color: COLORS.muted, fontWeight: "700", textAlign: "center", marginTop: 6, lineHeight: 20 },
  emptyButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 11,
    marginTop: 14,
  },
  emptyButtonText: { color: COLORS.white, fontWeight: "900" },
});