// app/freight/dispatch-alerts.tsx

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
  communicationCenter: "/freight/communication-center",
  dispatchCenter: "/freight/dispatch-center",
  myLoads: "/freight/my-loads",
  liveLoads: "/freight/live-loads",
  loadChat: "/freight/load-chat",
  routeExceptions: "/freight/route-exceptions",
  reviewStatus: "/freight/review-status",
  support: "/freight/support",
  notifications: "/freight/notifications",
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
  redDark: "#991B1B",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  amber: "#D97706",
  blue: "#2563EB",
  purple: "#7C3AED",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function alertColor(priority: any) {
  const value = normalize(priority);

  if (["urgent", "critical", "high"].includes(value)) return COLORS.red;
  if (["medium", "warning"].includes(value)) return COLORS.amber;
  if (["low", "info"].includes(value)) return COLORS.blue;

  return COLORS.black;
}

function alertIcon(type: any): keyof typeof Ionicons.glyphMap {
  const value = normalize(type);

  if (value.includes("route")) return "navigate-outline";
  if (value.includes("pickup")) return "cube-outline";
  if (value.includes("delivery")) return "flag-outline";
  if (value.includes("review")) return "eye-outline";
  if (value.includes("exception")) return "warning-outline";
  if (value.includes("message")) return "chatbubbles-outline";
  if (value.includes("payment")) return "card-outline";
  if (value.includes("payout")) return "wallet-outline";

  return "notifications-outline";
}

export default function FreightDispatchAlertsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState("");

  const [carrier, setCarrier] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loads, setLoads] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadDispatchAlerts();
    }, [])
  );

  const stats = useMemo(() => {
    const unread = alerts.filter((item) => !item.read_at && !item.is_read).length;
    const urgent = alerts.filter((item) =>
      ["urgent", "critical", "high"].includes(normalize(item.priority || item.severity))
    ).length;
    const exceptions = alerts.filter((item) =>
      normalize(item.alert_type || item.type || item.category).includes("exception")
    ).length;
    const review = alerts.filter((item) =>
      normalize(item.alert_type || item.type || item.category).includes("review")
    ).length;

    return {
      total: alerts.length,
      unread,
      urgent,
      exceptions,
      review,
    };
  }, [alerts]);

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
    const normalizedCarrier = {
      ...nextCarrier,
      id: nextCarrier.id || nextCarrier.freightId,
      freightId: nextCarrier.freightId || nextCarrier.id,
      role: "freight",
      email: normalize(nextCarrier.email),
      companyName:
        nextCarrier.companyName ||
        nextCarrier.businessName ||
        nextCarrier.company_name ||
        nextCarrier.business_name ||
        "Farm2Home Freight Carrier",
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

  async function loadDispatchAlerts() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();
      const email = normalize(stored?.email || authData?.user?.email || "");

      if (!email) {
        router.replace(ROUTES.login as any);
        return;
      }

      const { data: dbCarrier, error } = await supabase
        .from("freight_users")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (error) console.log("Dispatch alerts carrier error:", error.message);

      if (!dbCarrier) {
        Alert.alert("Freight Profile Missing", "Please complete freight registration first.");
        router.replace(ROUTES.register as any);
        return;
      }

      const mergedCarrier = await persistCarrier({
        ...(stored || {}),
        ...(dbCarrier || {}),
        id: dbCarrier.id,
        freightId: dbCarrier.id,
        email: normalize(dbCarrier.email || email),
        companyName:
          dbCarrier.company_name ||
          dbCarrier.business_name ||
          stored?.companyName ||
          stored?.businessName ||
          "Farm2Home Freight Carrier",
      });

      const { data: alertData, error: alertError } = await supabase
        .from("freight_notifications")
        .select("*")
        .or(
          `freight_id.eq.${mergedCarrier.id},freight_user_id.eq.${mergedCarrier.id},user_id.eq.${mergedCarrier.id}`
        )
        .order("created_at", { ascending: false });

      if (alertError) {
        console.log("Dispatch alerts load error:", alertError.message);
        setAlerts([]);
      } else {
        setAlerts(Array.isArray(alertData) ? alertData : []);
      }

      const { data: loadData } = await supabase
        .from("freight_loads")
        .select("*")
        .or(
          `carrier_id.eq.${mergedCarrier.id},freight_user_id.eq.${mergedCarrier.id},driver_id.eq.${mergedCarrier.id},accepted_by.eq.${mergedCarrier.id}`
        )
        .order("updated_at", { ascending: false });

      setLoads(Array.isArray(loadData) ? loadData : []);
    } catch (error: any) {
      Alert.alert("Dispatch Alerts Error", error?.message || "Unable to load dispatch alerts.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadDispatchAlerts();
  }

  async function markRead(alertItem: any) {
    if (!alertItem?.id) return;

    try {
      setUpdatingId(alertItem.id);

      await supabase
        .from("freight_notifications")
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
          status: normalize(alertItem.status) === "new" ? "read" : alertItem.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", alertItem.id);

      await loadDispatchAlerts();
    } catch (error: any) {
      Alert.alert("Update Error", error?.message || "Unable to mark alert read.");
    } finally {
      setUpdatingId("");
    }
  }

  async function clearAlert(alertItem: any) {
    if (!alertItem?.id) return;

    try {
      setUpdatingId(alertItem.id);

      await supabase
        .from("freight_notifications")
        .update({
          status: "cleared",
          is_read: true,
          read_at: new Date().toISOString(),
          cleared_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", alertItem.id);

      await loadDispatchAlerts();
    } catch (error: any) {
      Alert.alert("Clear Error", error?.message || "Unable to clear alert.");
    } finally {
      setUpdatingId("");
    }
  }

  function openAlert(alertItem: any) {
    const type = normalize(alertItem.alert_type || alertItem.type || alertItem.category);
    const loadId = alertItem.load_id || alertItem.freight_load_id;

    if (type.includes("exception")) {
      goTo(ROUTES.routeExceptions);
      return;
    }

    if (type.includes("review")) {
      goTo(ROUTES.reviewStatus);
      return;
    }

    if (loadId) {
      router.push({
        pathname: ROUTES.loadChat as any,
        params: { loadId: String(loadId) },
      });
      return;
    }

    goTo(ROUTES.communicationCenter);
  }

  function createDemoAlert() {
    Alert.alert(
      "Dispatch Alert Example",
      "Dispatch alerts will be created by dispatch, load status changes, route exceptions, payment notices, and Farm2Home system updates."
    );
  }

  function renderAlert({ item }: { item: any }) {
    const priority = item.priority || item.severity || "info";
    const type = item.alert_type || item.type || item.category || "dispatch";
    const unread = !item.read_at && !item.is_read;
    const updating = updatingId === item.id;
    const color = alertColor(priority);

    return (
      <View style={[styles.alertCard, unread && styles.alertCardUnread]}>
        <TouchableOpacity style={styles.alertTop} onPress={() => openAlert(item)}>
          <View style={[styles.alertIcon, { backgroundColor: color }]}>
            <Ionicons name={alertIcon(type)} size={22} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <View style={styles.alertTitleRow}>
              <Text style={styles.alertTitle} numberOfLines={1}>
                {item.title || item.subject || "Dispatch Alert"}
              </Text>

              {unread ? <View style={styles.unreadDot} /> : null}
            </View>

            <Text style={styles.alertMeta}>
              {String(type).replace(/_/g, " ")} · {String(priority).replace(/_/g, " ")}
            </Text>

            <Text style={styles.alertText} numberOfLines={3}>
              {item.body || item.message || item.description || "No alert details available."}
            </Text>

            <Text style={styles.alertTime}>{formatDate(item.created_at)}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.outlineSmall} onPress={() => openAlert(item)}>
            <Ionicons name="open-outline" size={16} color={COLORS.red} />
            <Text style={styles.outlineSmallText}>Open</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primarySmall, updating && styles.disabledButton]}
            onPress={() => markRead(item)}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-outline" size={16} color="#FFFFFF" />
                <Text style={styles.primarySmallText}>Read</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.darkSmall, updating && styles.disabledButton]}
            onPress={() => clearAlert(item)}
            disabled={updating}
          >
            <Ionicons name="close-outline" size={16} color="#FFFFFF" />
            <Text style={styles.primarySmallText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderLoadUpdate({ item }: { item: any }) {
    return (
      <TouchableOpacity
        style={styles.loadCard}
        onPress={() =>
          router.push({
            pathname: ROUTES.loadChat as any,
            params: { loadId: String(item.id) },
          })
        }
      >
        <View style={styles.loadIcon}>
          <Ionicons name="cube-outline" size={21} color="#FFFFFF" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.loadTitle} numberOfLines={1}>
            {item.title || item.commodity || "Active Load"}
          </Text>
          <Text style={styles.loadSub} numberOfLines={1}>
            {item.pickup_location || item.origin || "Pickup"} →{" "}
            {item.dropoff_location || item.destination || "Dropoff"}
          </Text>
          <Text style={styles.loadMeta}>{String(item.status || "load").replace(/_/g, " ")}</Text>
        </View>

        <Ionicons name="chevron-forward-outline" size={22} color={COLORS.muted} />
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading dispatch alerts...</Text>
      </SafeAreaView>
    );
  }

  const activeLoads = loads.filter((item) =>
    ["accepted", "booked", "arrived_pickup", "picked_up", "in_transit", "arrived_dropoff"].includes(
      normalize(item.status)
    )
  );

  const visibleAlerts = alerts.filter((item) => normalize(item.status) !== "cleared");

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Farm2Home Freight</Text>
            <Text style={styles.title}>Dispatch Alerts</Text>
            <Text style={styles.subtitle}>
              ChatAI-style alert inbox for urgent dispatch notices, route exceptions, load updates,
              payment notices, and review messages.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={createDemoAlert}>
            <Ionicons name="megaphone-outline" size={30} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Ionicons name="business-outline" size={28} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{carrier?.companyName || "Farm2Home Freight Carrier"}</Text>
            <Text style={styles.profileEmail}>{carrier?.email || "Carrier workspace"}</Text>
          </View>

          <View style={styles.alertPill}>
            <View style={styles.alertPillDot} />
            <Text style={styles.alertPillText}>{stats.unread} unread</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Alerts" value={String(stats.total)} icon="notifications-outline" />
          <StatCard label="Unread" value={String(stats.unread)} icon="mail-unread-outline" />
          <StatCard label="Urgent" value={String(stats.urgent)} icon="alert-circle-outline" />
          <StatCard label="Exceptions" value={String(stats.exceptions)} icon="warning-outline" />
          <StatCard label="Review" value={String(stats.review)} icon="eye-outline" />
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="grid-outline" label="Dashboard" route={ROUTES.dashboard} />
          <QuickLink icon="search-outline" label="Load Board" route={ROUTES.board} />
          <QuickLink icon="briefcase-outline" label="My Loads" route={ROUTES.myLoads} />
          <QuickLink icon="chatbubbles-outline" label="Messages" route={ROUTES.communicationCenter} />
          <QuickLink icon="warning-outline" label="Exceptions" route={ROUTES.routeExceptions} />
          <QuickLink icon="headset-outline" label="Support" route={ROUTES.support} />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Load Updates</Text>
          <TouchableOpacity onPress={() => goTo(ROUTES.myLoads)}>
            <Text style={styles.sectionLink}>View all</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={activeLoads.slice(0, 5)}
          keyExtractor={(item, index) => String(item.id || index)}
          scrollEnabled={false}
          renderItem={renderLoadUpdate}
          ListEmptyComponent={
            <EmptyState
              icon="cube-outline"
              title="No active load updates"
              message="Accepted and in-transit loads will appear here for dispatch monitoring."
            />
          }
        />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Alert Inbox</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Text style={styles.sectionLink}>Refresh</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={visibleAlerts}
          keyExtractor={(item, index) => String(item.id || index)}
          scrollEnabled={false}
          renderItem={renderAlert}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title="No active dispatch alerts"
              message="Urgent dispatch notices, route exceptions, and review messages will appear here."
            />
          }
        />

        <TouchableOpacity style={styles.primaryButton} onPress={() => goTo(ROUTES.communicationCenter)}>
          <Ionicons name="chatbubbles-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Open Communication Center</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.darkButton} onPress={() => goTo(ROUTES.notifications)}>
          <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>All Notifications</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={22} color={COLORS.red} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
      <Ionicons name={icon} size={22} color={COLORS.red} />
      <Text style={styles.quickText}>{label}</Text>
    </TouchableOpacity>
  );
}

function EmptyState({
  icon,
  title,
  message,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
}) {
  return (
    <View style={styles.emptyCard}>
      <Ionicons name={icon} size={38} color={COLORS.red} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
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
  hero: {
    backgroundColor: COLORS.black,
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 30,
    flexDirection: "row",
    gap: 14,
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
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
  },
  title: { color: "#FFFFFF", fontSize: 34, fontWeight: "900", marginBottom: 10 },
  subtitle: { color: "#D1D5DB", lineHeight: 22, fontWeight: "700" },
  profileCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  profileAvatar: {
    width: 58,
    height: 58,
    borderRadius: 22,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  profileName: { color: COLORS.text, fontSize: 19, fontWeight: "900" },
  profileEmail: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  alertPill: {
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  alertPillDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: COLORS.red,
  },
  alertPillText: { color: COLORS.red, fontWeight: "900", fontSize: 12 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  statCard: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: { color: COLORS.text, fontSize: 24, fontWeight: "900", marginTop: 7 },
  statLabel: { color: COLORS.muted, fontWeight: "800", marginTop: 4 },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  quickLink: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    gap: 8,
  },
  quickText: { color: COLORS.text, fontWeight: "900", textAlign: "center" },
  sectionHeader: {
    paddingHorizontal: 18,
    marginTop: 4,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 23,
    fontWeight: "900",
  },
  sectionLink: {
    color: COLORS.red,
    fontWeight: "900",
  },
  loadCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  loadIcon: {
    width: 48,
    height: 48,
    borderRadius: 19,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  loadTitle: { color: COLORS.text, fontSize: 16, fontWeight: "900" },
  loadSub: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  loadMeta: {
    color: COLORS.red,
    fontWeight: "900",
    marginTop: 4,
    textTransform: "capitalize",
  },
  alertCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  alertCardUnread: {
    borderColor: COLORS.red,
    borderWidth: 2,
    backgroundColor: "#FFF7F7",
  },
  alertTop: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  alertIcon: {
    width: 48,
    height: 48,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  alertTitleRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  alertTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "900",
  },
  alertMeta: {
    color: COLORS.red,
    fontWeight: "900",
    marginTop: 4,
    textTransform: "capitalize",
    fontSize: 12,
  },
  alertText: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 6,
  },
  alertTime: {
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 11,
    marginTop: 7,
  },
  unreadDot: {
    width: 11,
    height: 11,
    borderRadius: 999,
    backgroundColor: COLORS.red,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  outlineSmall: {
    flex: 1,
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  outlineSmallText: { color: COLORS.red, fontWeight: "900" },
  primarySmall: {
    flex: 1,
    backgroundColor: COLORS.red,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  darkSmall: {
    flex: 1,
    backgroundColor: COLORS.black,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  primarySmallText: { color: "#FFFFFF", fontWeight: "900" },
  emptyCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900", marginTop: 10 },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: COLORS.red,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  darkButton: {
    backgroundColor: COLORS.black,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: { opacity: 0.6 },
  primaryText: { color: "#FFFFFF", fontWeight: "900" },
});