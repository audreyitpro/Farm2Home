// app/driver/my-deliveries.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";

import { getBackendUrl } from "../services/apiConfig";

const COLORS = {
  bg: "#F6F8F2",
  card: "#FFFFFF",
  text: "#132116",
  muted: "#6B7280",
  border: "#E3E8DD",
  primary: "#2E7D32",
  primaryDark: "#14532D",
  soft: "#EEF5EA",
  blue: "#2563EB",
  amber: "#F59E0B",
  red: "#DC2626",
  dark: "#111827",
  freight: "#1F2937",
};

type DeliveryKind = "customer_order" | "freight_load";

type DeliveryStatus =
  | "accepted"
  | "arrived_pickup"
  | "picked_up"
  | "in_transit"
  | "arrived_dropoff"
  | "delivered"
  | "cancelled";

type DriverDelivery = {
  id: string;
  kind: DeliveryKind;
  status: DeliveryStatus;
  title: string;
  customerName?: string;
  farmerName?: string;
  freightCarrierName?: string;
  pickupName?: string;
  pickupAddress?: string;
  dropoffName?: string;
  dropoffAddress?: string;
  distanceMiles?: number;
  payout?: number;
  orderTotal?: number;
  itemCount?: number;
  coldChain?: boolean;
  batchId?: string;
  createdAt?: string;
  updatedAt?: string;
  notes?: string;
  raw?: any;
};

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  accepted: "Accepted",
  arrived_pickup: "Arrived Pickup",
  picked_up: "Picked Up",
  in_transit: "In Transit",
  arrived_dropoff: "Arrived Dropoff",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_FLOW: DeliveryStatus[] = [
  "accepted",
  "arrived_pickup",
  "picked_up",
  "in_transit",
  "arrived_dropoff",
  "delivered",
];

const STORAGE_KEYS = {
  driverId: "driver_id",
  userId: "user_id",
};

function money(value?: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function miles(value?: number) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return "Miles pending";
  }

  return `${Number(value).toFixed(1)} mi`;
}

function normalizeStatus(value: any): DeliveryStatus {
  const s = String(value || "accepted").toLowerCase();

  if (s === "arrived_pickup") return "arrived_pickup";
  if (s === "picked_up") return "picked_up";
  if (s === "in_transit") return "in_transit";
  if (s === "arrived_dropoff") return "arrived_dropoff";
  if (s === "delivered") return "delivered";
  if (s === "cancelled") return "cancelled";

  return "accepted";
}

function nextStatus(status: DeliveryStatus): DeliveryStatus | null {
  const index = STATUS_FLOW.indexOf(status);
  if (index < 0 || index >= STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[index + 1];
}

function getStatusTone(status: DeliveryStatus) {
  if (status === "delivered") return COLORS.primary;
  if (status === "cancelled") return COLORS.red;
  if (status === "accepted") return COLORS.blue;
  if (status === "arrived_pickup" || status === "arrived_dropoff") {
    return COLORS.amber;
  }

  return COLORS.primaryDark;
}

function openMap(address?: string) {
  if (!address) {
    Alert.alert("Address missing", "This delivery does not have an address yet.");
    return;
  }

  const encoded = encodeURIComponent(address);
  const url =
    Platform.OS === "ios"
      ? `http://maps.apple.com/?q=${encoded}`
      : `https://www.google.com/maps/search/?api=1&query=${encoded}`;

  Linking.openURL(url).catch(() => {
    Alert.alert("Map error", "Unable to open maps on this device.");
  });
}

function normalizeDelivery(row: any): DriverDelivery {
  const kind: DeliveryKind =
    row.kind ||
    row.delivery_kind ||
    row.type ||
    row.load_type ||
    (row.freight_load_id || row.freightCarrierName
      ? "freight_load"
      : "customer_order");

  const status = normalizeStatus(
    row.status || row.delivery_status || row.load_status
  );

  return {
    id: String(row.id || row.order_id || row.load_id || row.delivery_id),
    kind,
    status,
    title:
      row.title ||
      row.order_title ||
      row.load_title ||
      (kind === "freight_load" ? "Freight Load" : "Farm2Home Delivery"),
    customerName: row.customerName || row.customer_name || row.customer?.name,
    farmerName: row.farmerName || row.farmer_name || row.farmer?.business_name,
    freightCarrierName:
      row.freightCarrierName ||
      row.freight_carrier_name ||
      row.carrier_name ||
      row.freight_user?.business_name,
    pickupName:
      row.pickupName ||
      row.pickup_name ||
      row.farm_name ||
      row.origin_name ||
      row.pickup?.name,
    pickupAddress:
      row.pickupAddress ||
      row.pickup_address ||
      row.origin_address ||
      row.farm_address ||
      row.pickup?.address,
    dropoffName:
      row.dropoffName ||
      row.dropoff_name ||
      row.destination_name ||
      row.customer_address_name ||
      row.dropoff?.name,
    dropoffAddress:
      row.dropoffAddress ||
      row.dropoff_address ||
      row.destination_address ||
      row.customer_address ||
      row.dropoff?.address,
    distanceMiles:
      row.distanceMiles ??
      row.distance_miles ??
      row.miles ??
      row.estimated_miles ??
      undefined,
    payout:
      row.payout ??
      row.driver_payout ??
      row.rate ??
      row.load_rate ??
      undefined,
    orderTotal: row.orderTotal ?? row.order_total ?? row.total ?? undefined,
    itemCount: row.itemCount ?? row.item_count ?? row.items?.length ?? undefined,
    coldChain: Boolean(row.coldChain || row.cold_chain || row.temperature_controlled),
    batchId: row.batchId || row.batch_id || undefined,
    createdAt: row.createdAt || row.created_at,
    updatedAt: row.updatedAt || row.updated_at,
    notes: row.notes || row.delivery_notes || row.special_instructions,
    raw: row,
  };
}

export default function DriverMyDeliveriesScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<DriverDelivery[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<
    "active" | "freight" | "customer" | "completed"
  >("active");

  const loadDeliveries = useCallback(async () => {
    try {
      const driverId =
        (await AsyncStorage.getItem(STORAGE_KEYS.driverId)) ||
        (await AsyncStorage.getItem(STORAGE_KEYS.userId));

      if (!driverId) {
        setDeliveries([]);
        setLoading(false);
        return;
      }

      const response = await fetch(
        `${getBackendUrl()}/driver/my-deliveries?driverId=${encodeURIComponent(
          driverId
        )}`
      );

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const json = await response.json();
      const rows = Array.isArray(json) ? json : json.deliveries || json.data || [];

      setDeliveries(rows.map(normalizeDelivery));
    } catch (error) {
      console.log("Load deliveries error:", error);
      Alert.alert(
        "Unable to load deliveries",
        "Please check your connection and try again."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadDeliveries();
    }, [loadDeliveries])
  );

  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((delivery) => {
      if (filter === "freight") {
        return delivery.kind === "freight_load" && delivery.status !== "delivered";
      }

      if (filter === "customer") {
        return delivery.kind === "customer_order" && delivery.status !== "delivered";
      }

      if (filter === "completed") {
        return delivery.status === "delivered";
      }

      return delivery.status !== "delivered" && delivery.status !== "cancelled";
    });
  }, [deliveries, filter]);

  const totals = useMemo(() => {
    const active = deliveries.filter(
      (d) => d.status !== "delivered" && d.status !== "cancelled"
    );

    return {
      active: active.length,
      payout: active.reduce((sum, item) => sum + Number(item.payout || 0), 0),
      freight: active.filter((item) => item.kind === "freight_load").length,
      customer: active.filter((item) => item.kind === "customer_order").length,
    };
  }, [deliveries]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    loadDeliveries();
  }, [loadDeliveries]);

  async function updateDeliveryStatus(
    delivery: DriverDelivery,
    status: DeliveryStatus
  ) {
    try {
      setUpdatingId(delivery.id);

      const response = await fetch(
        `${getBackendUrl()}/driver/update-delivery-status`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            deliveryId: delivery.id,
            deliveryKind: delivery.kind,
            status,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      setDeliveries((current) =>
        current.map((item) =>
          item.id === delivery.id
            ? { ...item, status, updatedAt: new Date().toISOString() }
            : item
        )
      );
    } catch (error) {
      console.log("Status update error:", error);
      Alert.alert(
        "Status update failed",
        "The delivery status could not be updated. Please try again."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function batchAdvance() {
    const selected = deliveries.filter((item) => selectedIds.includes(item.id));
    const actionable = selected.filter((item) => nextStatus(item.status));

    if (actionable.length === 0) {
      Alert.alert("No batch action", "Selected deliveries cannot be advanced.");
      return;
    }

    Alert.alert(
      "Advance selected deliveries?",
      `This will update ${actionable.length} selected delivery status.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Advance",
          onPress: async () => {
            for (const delivery of actionable) {
              const next = nextStatus(delivery.status);
              if (next) {
                await updateDeliveryStatus(delivery, next);
              }
            }

            setSelectedIds([]);
          },
        },
      ]
    );
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function renderDelivery({ item }: { item: DriverDelivery }) {
    const next = nextStatus(item.status);
    const tone = getStatusTone(item.status);
    const selected = selectedIds.includes(item.id);

    return (
      <Pressable
        style={[styles.card, selected && styles.cardSelected]}
        onLongPress={() => toggleSelected(item.id)}
      >
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <View style={styles.rowWrap}>
              <Text style={styles.kindPill}>
                {item.kind === "freight_load"
                  ? "Farm2Driver Freight"
                  : "Farm2Home Order"}
              </Text>

              {item.coldChain ? <Text style={styles.coldPill}>Cold Chain</Text> : null}
              {item.batchId ? <Text style={styles.batchPill}>Batch</Text> : null}
            </View>

            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardSub}>
              {item.kind === "freight_load"
                ? item.freightCarrierName || "Freight carrier"
                : item.farmerName || "Local farmer"}
            </Text>
          </View>

          <View style={[styles.statusPill, { borderColor: tone }]}>
            <Text style={[styles.statusText, { color: tone }]}>
              {STATUS_LABELS[item.status]}
            </Text>
          </View>
        </View>

        <View style={styles.routeBox}>
          <View style={styles.routeItem}>
            <Text style={styles.routeDot}>●</Text>

            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={styles.routeName}>{item.pickupName || "Pickup location"}</Text>
              <Text style={styles.routeAddress}>
                {item.pickupAddress || "Pickup address pending"}
              </Text>
            </View>
          </View>

          <View style={styles.routeLine} />

          <View style={styles.routeItem}>
            <Text style={[styles.routeDot, { color: COLORS.primary }]}>●</Text>

            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Dropoff</Text>
              <Text style={styles.routeName}>
                {item.dropoffName || item.customerName || "Dropoff location"}
              </Text>
              <Text style={styles.routeAddress}>
                {item.dropoffAddress || "Dropoff address pending"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.metricRow}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Miles</Text>
            <Text style={styles.metricValue}>{miles(item.distanceMiles)}</Text>
          </View>

          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Payout</Text>
            <Text style={styles.metricValue}>{money(item.payout)}</Text>
          </View>

          <View style={styles.metric}>
            <Text style={styles.metricLabel}>
              {item.kind === "freight_load" ? "Load" : "Items"}
            </Text>
            <Text style={styles.metricValue}>
              {item.kind === "freight_load"
                ? item.batchId
                  ? "Batch"
                  : "Single"
                : String(item.itemCount || 0)}
            </Text>
          </View>
        </View>

        {item.notes ? <Text style={styles.notes}>Notes: {item.notes}</Text> : null}

        <View style={styles.actionRow}>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => openMap(item.pickupAddress)}
          >
            <Text style={styles.secondaryButtonText}>Pickup Map</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => openMap(item.dropoffAddress)}
          >
            <Text style={styles.secondaryButtonText}>Dropoff Map</Text>
          </Pressable>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={[
              styles.selectButton,
              selected && { backgroundColor: COLORS.primaryDark },
            ]}
            onPress={() => toggleSelected(item.id)}
          >
            <Text style={styles.selectButtonText}>
              {selected ? "Selected" : "Select Batch"}
            </Text>
          </Pressable>

          {next ? (
            <Pressable
              style={styles.primaryButton}
              disabled={updatingId === item.id}
              onPress={() => updateDeliveryStatus(item, next)}
            >
              {updatingId === item.id ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  Mark {STATUS_LABELS[next]}
                </Text>
              )}
            </Pressable>
          ) : (
            <View style={styles.disabledButton}>
              <Text style={styles.disabledButtonText}>Complete</Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading driver deliveries...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>My Deliveries</Text>
          <Text style={styles.headerSub}>Farm2Driver live route center</Text>
        </View>

        <Pressable style={styles.refreshButton} onPress={refresh}>
          <Text style={styles.refreshText}>↻</Text>
        </Pressable>
      </View>

      <FlatList
        data={filteredDeliveries}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        renderItem={renderDelivery}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        ListHeaderComponent={
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Active Route Value</Text>
              <Text style={styles.summaryValue}>{money(totals.payout)}</Text>

              <View style={styles.summaryGrid}>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileValue}>{totals.active}</Text>
                  <Text style={styles.summaryTileLabel}>Active</Text>
                </View>

                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileValue}>{totals.customer}</Text>
                  <Text style={styles.summaryTileLabel}>Orders</Text>
                </View>

                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileValue}>{totals.freight}</Text>
                  <Text style={styles.summaryTileLabel}>Freight</Text>
                </View>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
            >
              {[
                ["active", "Active"],
                ["customer", "Customer Orders"],
                ["freight", "Freight Loads"],
                ["completed", "Completed"],
              ].map(([key, label]) => {
                const active = filter === key;

                return (
                  <Pressable
                    key={key}
                    style={[
                      styles.filterButton,
                      active && styles.filterButtonActive,
                    ]}
                    onPress={() => setFilter(key as any)}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        active && styles.filterTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {selectedIds.length > 0 ? (
              <View style={styles.batchBar}>
                <Text style={styles.batchText}>
                  {selectedIds.length} selected for batch update
                </Text>

                <Pressable style={styles.batchButton} onPress={batchAdvance}>
                  <Text style={styles.batchButtonText}>Advance Batch</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No deliveries found</Text>
            <Text style={styles.emptyText}>
              Accepted customer orders and freight loads will appear here.
            </Text>

            <Pressable
              style={styles.emptyButton}
              onPress={() => router.push("/driver/board" as any)}
            >
              <Text style={styles.emptyButtonText}>Open Driver Board</Text>
            </Pressable>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.muted,
    fontWeight: "700",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: COLORS.bg,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  backText: {
    fontSize: 34,
    color: COLORS.text,
    marginTop: -3,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.text,
  },
  headerSub: {
    marginTop: 2,
    color: COLORS.muted,
    fontWeight: "700",
  },
  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },
  listContent: {
    padding: 18,
    paddingBottom: 40,
  },
  summaryCard: {
    backgroundColor: COLORS.dark,
    borderRadius: 24,
    padding: 20,
    marginBottom: 14,
  },
  summaryLabel: {
    color: "#D1D5DB",
    fontWeight: "800",
  },
  summaryValue: {
    color: "#FFFFFF",
    fontSize: 38,
    fontWeight: "900",
    marginTop: 6,
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  summaryTile: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 18,
    padding: 12,
  },
  summaryTileValue: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },
  summaryTileLabel: {
    color: "#D1D5DB",
    fontWeight: "800",
    marginTop: 2,
  },
  filters: {
    gap: 10,
    paddingBottom: 14,
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    color: COLORS.text,
    fontWeight: "900",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  batchBar: {
    backgroundColor: COLORS.soft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 12,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  batchText: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "900",
  },
  batchButton: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  batchButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  cardSelected: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  cardTop: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  kindPill: {
    backgroundColor: COLORS.soft,
    color: COLORS.primaryDark,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 12,
  },
  coldPill: {
    backgroundColor: "#E0F2FE",
    color: "#075985",
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 12,
  },
  batchPill: {
    backgroundColor: "#FEF3C7",
    color: "#92400E",
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 12,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "900",
  },
  cardSub: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontWeight: "900",
    fontSize: 12,
  },
  routeBox: {
    backgroundColor: "#FAFBF8",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 14,
    marginTop: 14,
  },
  routeItem: {
    flexDirection: "row",
    gap: 10,
  },
  routeDot: {
    color: COLORS.blue,
    fontSize: 16,
    marginTop: 2,
  },
  routeLine: {
    width: 1,
    height: 18,
    backgroundColor: COLORS.border,
    marginLeft: 7,
    marginVertical: 4,
  },
  routeLabel: {
    color: COLORS.muted,
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
  },
  routeName: {
    color: COLORS.text,
    fontWeight: "900",
    marginTop: 2,
  },
  routeAddress: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 2,
  },
  metricRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  metric: {
    flex: 1,
    backgroundColor: COLORS.soft,
    borderRadius: 16,
    padding: 12,
  },
  metricLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  metricValue: {
    color: COLORS.text,
    fontWeight: "900",
    marginTop: 4,
  },
  notes: {
    marginTop: 12,
    color: COLORS.text,
    fontWeight: "700",
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontWeight: "900",
  },
  selectButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 13,
    backgroundColor: COLORS.freight,
    alignItems: "center",
  },
  selectButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  primaryButton: {
    flex: 1.4,
    borderRadius: 16,
    paddingVertical: 13,
    backgroundColor: COLORS.primary,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  disabledButton: {
    flex: 1.4,
    borderRadius: 16,
    paddingVertical: 13,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
  },
  disabledButtonText: {
    color: COLORS.muted,
    fontWeight: "900",
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    marginTop: 20,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
  },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 21,
  },
  emptyButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 16,
    marginTop: 16,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});