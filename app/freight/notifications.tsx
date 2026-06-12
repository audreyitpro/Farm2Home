// app/freight/notifications.tsx

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

const FREIGHT_ROUTES = {
  dashboard: "/freight/dashboard",
  board: "/freight/board",
  myLoads: "/freight/my-loads",
  liveLoads: "/freight/live-loads",
  liveRoute: "/freight/live-route",
  routeDetails: "/freight/route-details",
  loadIssues: "/freight/load-issues",
  routeExceptions: "/freight/route-exceptions",
  earnings: "/freight/earnings",
  analytics: "/freight/analytics",
  connectBank: "/freight/connect-bank",
  settlements: "/freight/settlements",
  payoutCenter: "/freight/payout-center",
  support: "/freight/support",
  settings: "/freight/settings",
  profile: "/freight/profile",
  safety: "/freight/safety",
  insurance: "/freight/insurance",
  adminReview: "/freight/admin-review",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  type: string;
  route: FreightRoute;
  read?: boolean;
  is_read?: boolean;
  load_id?: string | null;
  freight_user_id?: string | null;
  created_at?: string;
};

const COLORS = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  redSoft: "#FFF1F2",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  amber: "#D97706",
  blue: "#2563EB",
  purple: "#7C3AED",
  slate: "#64748B",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

function formatDate(value?: string) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleString();
}

export default function FreightNotificationsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [carrier, setCarrier] = useState<any>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [])
  );

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read && !item.is_read).length,
    [notifications]
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
        "Freight Connect Carrier",
      businessName:
        nextCarrier.businessName ||
        nextCarrier.companyName ||
        nextCarrier.business_name ||
        nextCarrier.company_name ||
        "Freight Connect Carrier",
      stripeAccountId:
        nextCarrier.stripeAccountId || nextCarrier.stripe_account_id || "",
      stripe_account_id:
        nextCarrier.stripe_account_id || nextCarrier.stripeAccountId || "",
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

  function fallbackNotifications(nextCarrier: any): NotificationItem[] {
    const now = new Date().toISOString();

    return [
      {
        id: "freight-welcome",
        title: "Welcome to Freight Connect",
        body: `${nextCarrier?.companyName || "Your freight account"} is ready to manage loads, payouts, routes, documents, and support.`,
        type: "account",
        route: FREIGHT_ROUTES.dashboard,
        read: false,
        is_read: false,
        created_at: now,
      },
      {
        id: "freight-connect-bank",
        title: "Connect Bank",
        body: "Complete Stripe Connect onboarding to receive freight payouts.",
        type: "payout",
        route: FREIGHT_ROUTES.connectBank,
        read: false,
        is_read: false,
        created_at: now,
      },
      {
        id: "freight-board",
        title: "Check Load Board",
        body: "Open the freight board to review available farm, refrigerated, livestock, and bulk loads.",
        type: "load",
        route: FREIGHT_ROUTES.board,
        read: true,
        is_read: true,
        created_at: now,
      },
    ];
  }

  async function loadNotifications() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();
      const email = normalize(stored?.email || authData?.user?.email || "");

      if (!email) {
        router.replace(FREIGHT_ROUTES.login as any);
        return;
      }

      const { data: dbCarrier, error: carrierError } = await supabase
        .from("freight_users")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (carrierError) {
        console.log("Freight notifications carrier error:", carrierError.message);
      }

      if (!dbCarrier) {
        Alert.alert(
          "Freight Profile Missing",
          "No freight profile was found. Please complete freight registration first."
        );
        router.replace(FREIGHT_ROUTES.register as any);
        return;
      }

      const mergedCarrier = await persistCarrier({
        ...(stored || {}),
        ...(dbCarrier || {}),
        id: dbCarrier.id,
        freightId: dbCarrier.id,
        email: normalize(dbCarrier.email || email),
        role: "freight",
        companyName:
          dbCarrier.company_name ||
          dbCarrier.business_name ||
          stored?.companyName ||
          stored?.businessName ||
          "Freight Connect Carrier",
        businessName:
          dbCarrier.business_name ||
          dbCarrier.company_name ||
          stored?.businessName ||
          stored?.companyName ||
          "Freight Connect Carrier",
      });

      const { data, error } = await supabase
        .from("freight_notifications")
        .select("*")
        .or(
          `freight_user_id.eq.${mergedCarrier.id},freight_id.eq.${mergedCarrier.id},user_id.eq.${mergedCarrier.id}`
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.log("Freight notifications load error:", error.message);
        setNotifications(fallbackNotifications(mergedCarrier));
        return;
      }

      const mapped: NotificationItem[] = Array.isArray(data)
        ? data.map((item: any) => ({
            id: String(item.id),
            title: item.title || "Freight Notification",
            body: item.body || item.message || "",
            type: item.type || item.category || "account",
            route: mapNotificationRoute(item.type || item.category),
            read: Boolean(item.read || item.is_read),
            is_read: Boolean(item.read || item.is_read),
            load_id: item.load_id || null,
            freight_user_id:
              item.freight_user_id || item.freight_id || item.user_id || null,
            created_at: item.created_at,
          }))
        : [];

      setNotifications(
        mapped.length > 0 ? mapped : fallbackNotifications(mergedCarrier)
      );
    } catch (error) {
      console.log("Freight notifications error:", error);
      Alert.alert("Notifications Error", "Unable to load freight notifications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadNotifications();
  }

  function mapNotificationRoute(type: string): FreightRoute {
    const value = normalize(type);

    if (value.includes("payout") || value.includes("bank")) return FREIGHT_ROUTES.connectBank;
    if (value.includes("settlement")) return FREIGHT_ROUTES.settlements;
    if (value.includes("earning")) return FREIGHT_ROUTES.earnings;
    if (value.includes("issue")) return FREIGHT_ROUTES.loadIssues;
    if (value.includes("exception")) return FREIGHT_ROUTES.routeExceptions;
    if (value.includes("route")) return FREIGHT_ROUTES.liveRoute;
    if (value.includes("load")) return FREIGHT_ROUTES.board;
    if (value.includes("support")) return FREIGHT_ROUTES.support;
    if (value.includes("safety")) return FREIGHT_ROUTES.safety;
    if (value.includes("insurance")) return FREIGHT_ROUTES.insurance;
    if (value.includes("review")) return FREIGHT_ROUTES.adminReview;
    if (value.includes("setting")) return FREIGHT_ROUTES.settings;
    if (value.includes("profile")) return FREIGHT_ROUTES.profile;

    return FREIGHT_ROUTES.dashboard;
  }

  function iconForType(type: string): keyof typeof Ionicons.glyphMap {
    const value = normalize(type);

    if (value.includes("payout") || value.includes("bank")) return "cash-outline";
    if (value.includes("settlement") || value.includes("earning")) return "wallet-outline";
    if (value.includes("load")) return "cube-outline";
    if (value.includes("route")) return "navigate-outline";
    if (value.includes("issue") || value.includes("exception")) return "warning-outline";
    if (value.includes("support")) return "headset-outline";
    if (value.includes("safety")) return "shield-checkmark-outline";
    if (value.includes("insurance")) return "document-lock-outline";
    if (value.includes("profile")) return "business-outline";
    if (value.includes("review")) return "clipboard-outline";

    return "notifications-outline";
  }

  function colorForType(type: string) {
    const value = normalize(type);

    if (
      value.includes("payout") ||
      value.includes("earning") ||
      value.includes("settlement")
    ) {
      return COLORS.green;
    }

    if (
      value.includes("issue") ||
      value.includes("exception") ||
      value.includes("safety")
    ) {
      return COLORS.amber;
    }

    if (value.includes("load")) return COLORS.red;
    if (value.includes("route")) return COLORS.purple;
    if (value.includes("support")) return COLORS.blue;
    if (value.includes("insurance") || value.includes("review")) return COLORS.slate;

    return COLORS.amber;
  }

  async function markAllRead() {
    try {
      const unread = notifications.filter((item) => !item.read && !item.is_read);

      if (unread.length === 0) {
        Alert.alert("All Read", "No unread freight notifications.");
        return;
      }

      setNotifications((prev) =>
        prev.map((item) => ({ ...item, read: true, is_read: true }))
      );

      const ids = unread
        .filter((item) => !item.id.startsWith("freight-"))
        .map((item) => item.id);

      if (ids.length > 0) {
        await supabase
          .from("freight_notifications")
          .update({
            read: true,
            is_read: true,
            updated_at: new Date().toISOString(),
          })
          .in("id", ids);
      }
    } catch (error) {
      console.log("Mark all read skipped:", error);
    }
  }

  async function markOneRead(item: NotificationItem) {
    try {
      setNotifications((prev) =>
        prev.map((next) =>
          next.id === item.id ? { ...next, read: true, is_read: true } : next
        )
      );

      if (!item.id.startsWith("freight-")) {
        await supabase
          .from("freight_notifications")
          .update({
            read: true,
            is_read: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
      }
    } catch (error) {
      console.log("Mark one read skipped:", error);
    }
  }

  async function openNotification(item: NotificationItem) {
    await markOneRead(item);

    const route: FreightRoute = item.route ?? mapNotificationRoute(item.type);

    const loadRoutes: FreightRoute[] = [
      FREIGHT_ROUTES.liveRoute,
      FREIGHT_ROUTES.routeDetails,
      FREIGHT_ROUTES.loadIssues,
      FREIGHT_ROUTES.routeExceptions,
    ];

    if (item.load_id && loadRoutes.includes(route)) {
      router.push({
        pathname: route as any,
        params: {
          loadId: item.load_id,
        },
      });

      return;
    }

    goTo(route);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading freight notifications...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Farm2Home Freight Connect</Text>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>
            Load updates, payout alerts, route messages, support updates,
            compliance reminders, and account notices.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.heroIcon}
          onPress={() => goTo(FREIGHT_ROUTES.dashboard)}
          activeOpacity={0.85}
        >
          <Ionicons name="notifications-outline" size={34} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.summaryCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryTitle}>
            {carrier?.companyName || carrier?.businessName || "Freight Carrier"}
          </Text>
          <Text style={styles.summaryText}>{unreadCount} unread notifications</Text>
        </View>

        <TouchableOpacity style={styles.readButton} onPress={markAllRead} activeOpacity={0.85}>
          <Text style={styles.readButtonText}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.quickGrid}>
        <QuickLink icon="grid-outline" label="Dashboard" route={FREIGHT_ROUTES.dashboard} />
        <QuickLink icon="list-outline" label="Load Board" route={FREIGHT_ROUTES.board} />
        <QuickLink icon="cash-outline" label="Payouts" route={FREIGHT_ROUTES.payoutCenter} />
        <QuickLink icon="settings-outline" label="Settings" route={FREIGHT_ROUTES.settings} />
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Ionicons name="notifications-off-outline" size={38} color={COLORS.red} />
            <Text style={styles.emptyTitle}>No freight notifications.</Text>
            <Text style={styles.emptyText}>
              Updates about loads, payouts, compliance, route issues, and support will appear here.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const unread = !item.read && !item.is_read;

          return (
            <TouchableOpacity
              style={[styles.notificationCard, unread && styles.unreadCard]}
              onPress={() => openNotification(item)}
              activeOpacity={0.85}
            >
              <View style={[styles.iconWrap, { backgroundColor: colorForType(item.type) }]}>
                <Ionicons name={iconForType(item.type)} size={22} color="#FFFFFF" />
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.notificationHeader}>
                  <Text style={styles.notificationTitle}>{item.title}</Text>
                  {unread && <View style={styles.unreadDot} />}
                </View>

                <Text style={styles.notificationBody}>{item.body}</Text>
                <Text style={styles.notificationDate}>{formatDate(item.created_at)}</Text>
              </View>

              <Ionicons name="chevron-forward-outline" size={20} color={COLORS.muted} />
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
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
    <TouchableOpacity style={styles.quickLink} onPress={() => goTo(route)} activeOpacity={0.85}>
      <Ionicons name={icon} size={22} color={COLORS.red} />
      <Text style={styles.quickText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  centerText: {
    color: COLORS.muted,
    marginTop: 12,
    fontWeight: "800",
  },
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
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    marginBottom: 10,
  },
  subtitle: {
    color: "#D1D5DB",
    lineHeight: 22,
    fontWeight: "700",
  },
  summaryCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 14,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "900",
  },
  summaryText: {
    color: COLORS.muted,
    fontWeight: "800",
    marginTop: 4,
  },
  readButton: {
    backgroundColor: COLORS.red,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  readButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },
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
  quickText: {
    color: COLORS.text,
    fontWeight: "900",
    textAlign: "center",
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 90,
  },
  notificationCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 15,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  unreadCard: {
    borderColor: COLORS.red,
    backgroundColor: COLORS.redSoft,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationHeader: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  notificationTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
    flex: 1,
  },
  notificationBody: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 5,
  },
  notificationDate: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 7,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: COLORS.red,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 20,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 10,
  },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
});