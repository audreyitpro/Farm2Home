// app/freight/notifications.tsx

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
  myLoads: "/freight/my-loads",
  liveLoads: "/freight/live-loads",
  loadDetail: "/freight/load-detail",
  loadChat: "/freight/load-chat",
  liveRoute: "/freight/live-route",
  tracking: "/freight/tracking",
  dispatchAlerts: "/freight/dispatch-alerts",
  communicationCenter: "/freight/communication-center",
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

type FreightRoute = (typeof ROUTES)[keyof typeof ROUTES];

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
  priority?: string | null;
  created_at?: string;
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

function goTo(route: FreightRoute) {
  router.push(route as any);
}

function formatDate(value?: string) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleString();
}

function mapNotificationRoute(type: string): FreightRoute {
  const value = normalize(type);

  if (value.includes("chat") || value.includes("message")) return ROUTES.communicationCenter;
  if (value.includes("dispatch") || value.includes("alert")) return ROUTES.dispatchAlerts;
  if (value.includes("payout") || value.includes("bank")) return ROUTES.connectBank;
  if (value.includes("settlement")) return ROUTES.settlements;
  if (value.includes("earning")) return ROUTES.earnings;
  if (value.includes("issue")) return ROUTES.loadIssues;
  if (value.includes("exception")) return ROUTES.routeExceptions;
  if (value.includes("route") || value.includes("tracking")) return ROUTES.liveRoute;
  if (value.includes("load")) return ROUTES.loadDetail;
  if (value.includes("support")) return ROUTES.support;
  if (value.includes("safety")) return ROUTES.safety;
  if (value.includes("insurance")) return ROUTES.insurance;
  if (value.includes("review")) return ROUTES.adminReview;
  if (value.includes("setting")) return ROUTES.settings;
  if (value.includes("profile")) return ROUTES.profile;

  return ROUTES.dashboard;
}

function iconForType(type: string): keyof typeof Ionicons.glyphMap {
  const value = normalize(type);

  if (value.includes("chat") || value.includes("message")) return "chatbubbles-outline";
  if (value.includes("dispatch") || value.includes("alert")) return "megaphone-outline";
  if (value.includes("payout") || value.includes("bank")) return "cash-outline";
  if (value.includes("settlement") || value.includes("earning")) return "wallet-outline";
  if (value.includes("load")) return "cube-outline";
  if (value.includes("route") || value.includes("tracking")) return "navigate-outline";
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

  if (value.includes("payout") || value.includes("earning") || value.includes("settlement")) return COLORS.green;
  if (value.includes("issue") || value.includes("exception") || value.includes("safety")) return COLORS.amber;
  if (value.includes("dispatch") || value.includes("alert")) return COLORS.red;
  if (value.includes("chat") || value.includes("message")) return COLORS.blue;
  if (value.includes("load")) return COLORS.primary;
  if (value.includes("route") || value.includes("tracking")) return COLORS.purple;
  if (value.includes("support")) return COLORS.blue;
  if (value.includes("insurance") || value.includes("review")) return COLORS.slate;

  return COLORS.navy;
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

  const stats = useMemo(() => {
    const payout = notifications.filter((item) =>
      normalize(item.type).includes("payout") ||
      normalize(item.type).includes("earning") ||
      normalize(item.type).includes("settlement")
    ).length;

    const load = notifications.filter((item) =>
      normalize(item.type).includes("load") ||
      normalize(item.type).includes("route")
    ).length;

    const issue = notifications.filter((item) =>
      normalize(item.type).includes("issue") ||
      normalize(item.type).includes("exception")
    ).length;

    return {
      total: notifications.length,
      unread: unreadCount,
      payout,
      load,
      issue,
    };
  }, [notifications, unreadCount]);

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
      console.log("Notifications subscription lookup error:", error.message);
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
    };

    await saveFreightSession(normalizedCarrier);
    setCarrier(normalizedCarrier);
    return normalizedCarrier;
  }

  function fallbackNotifications(nextCarrier: any): NotificationItem[] {
    const now = new Date().toISOString();

    return [
      {
        id: "freight-welcome",
        title: "Welcome to Farm2Home Freight",
        body: `${nextCarrier?.companyName || "Your freight account"} is ready to manage loads, payouts, routes, alerts, and support.`,
        type: "account",
        route: ROUTES.dashboard,
        read: false,
        is_read: false,
        created_at: now,
      },
      {
        id: "freight-connect-bank",
        title: "Connect Bank / Payouts",
        body: "Complete Stripe Connect onboarding to receive freight payouts.",
        type: "payout",
        route: ROUTES.connectBank,
        read: false,
        is_read: false,
        created_at: now,
      },
      {
        id: "freight-board",
        title: "Check Load Board",
        body: "Review available farm, refrigerated, livestock, hay, produce, and bulk freight loads.",
        type: "load",
        route: ROUTES.board,
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

      if (carrierError) console.log("Freight notifications carrier error:", carrierError.message);

      const dbCarrier = Array.isArray(dbCarrierRows) && dbCarrierRows.length > 0 ? dbCarrierRows[0] : null;

      if (!dbCarrier) {
        Alert.alert("Freight Profile Missing", "No freight profile was found. Please complete freight registration first.");
        router.replace(ROUTES.register as any);
        return;
      }

      const sub = await findSubscription(dbCarrier.id || storedId || authId, normalize(dbCarrier.email || email));
      const subAcct = pickAcct(sub?.freight_account, sub?.stripe_account_id);
      const rowAcct = pickAcct(dbCarrier.freight_account, dbCarrier.stripe_account_id);

      let mergedCarrier = {
        ...(stored || {}),
        ...(dbCarrier || {}),
        id: dbCarrier.id,
        freightId: dbCarrier.freight_id || dbCarrier.id,
        freight_id: dbCarrier.freight_id || dbCarrier.id,
        email: normalize(dbCarrier.email || email),
        role: "freight",
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
        mergedCarrier = { ...mergedCarrier, ...updatePayload };
      }

      const activeCarrier = await persistCarrier(mergedCarrier);

      const { data, error } = await supabase
        .from("freight_notifications")
        .select("*")
        .or(`freight_user_id.eq.${activeCarrier.id},freight_id.eq.${activeCarrier.id},user_id.eq.${activeCarrier.id}`)
        .order("created_at", { ascending: false });

      if (error) {
        console.log("Freight notifications load error:", error.message);
        setNotifications(fallbackNotifications(activeCarrier));
        return;
      }

      const mapped: NotificationItem[] = Array.isArray(data)
        ? data.map((item: any) => {
            const type = item.type || item.category || item.alert_type || "account";

            return {
              id: String(item.id),
              title: item.title || item.subject || "Freight Notification",
              body: item.body || item.message || item.description || "",
              type,
              route: mapNotificationRoute(type),
              read: Boolean(item.read || item.is_read),
              is_read: Boolean(item.read || item.is_read),
              load_id: item.load_id || item.freight_load_id || null,
              freight_user_id: item.freight_user_id || item.freight_id || item.user_id || null,
              priority: item.priority || item.severity || null,
              created_at: item.created_at,
            };
          })
        : [];

      setNotifications(mapped.length > 0 ? mapped : fallbackNotifications(activeCarrier));
    } catch (error: any) {
      console.log("Freight notifications error:", error);
      Alert.alert("Notifications Error", error?.message || "Unable to load freight notifications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadNotifications();
  }

  async function markAllRead() {
    try {
      const unread = notifications.filter((item) => !item.read && !item.is_read);

      if (unread.length === 0) {
        Alert.alert("All Read", "No unread freight notifications.");
        return;
      }

      setNotifications((prev) => prev.map((item) => ({ ...item, read: true, is_read: true })));

      const ids = unread.filter((item) => !item.id.startsWith("freight-")).map((item) => item.id);

      if (ids.length > 0) {
        await supabase
          .from("freight_notifications")
          .update({
            read: true,
            is_read: true,
            read_at: new Date().toISOString(),
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
        prev.map((next) => (next.id === item.id ? { ...next, read: true, is_read: true } : next))
      );

      if (!item.id.startsWith("freight-")) {
        await supabase
          .from("freight_notifications")
          .update({
            read: true,
            is_read: true,
            read_at: new Date().toISOString(),
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
    const type = normalize(item.type);

    if (item.load_id) {
      if (type.includes("chat") || type.includes("message")) {
        router.push({ pathname: ROUTES.loadChat as any, params: { loadId: item.load_id } });
        return;
      }

      if (type.includes("issue")) {
        router.push({ pathname: ROUTES.loadIssues as any, params: { loadId: item.load_id } });
        return;
      }

      if (type.includes("exception")) {
        router.push({ pathname: ROUTES.routeExceptions as any, params: { loadId: item.load_id } });
        return;
      }

      if (type.includes("route") || type.includes("tracking")) {
        router.push({ pathname: ROUTES.liveRoute as any, params: { loadId: item.load_id } });
        return;
      }

      if (type.includes("load")) {
        router.push({ pathname: ROUTES.loadDetail as any, params: { loadId: item.load_id } });
        return;
      }
    }

    goTo(route);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.centerText}>Loading freight notifications...</Text>
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
              <Ionicons name="notifications-outline" size={28} color={COLORS.white} />
            </View>
            <View>
              <Text style={styles.brandTitle}>Farm2Home</Text>
              <Text style={styles.brandSubtitle}>Notifications</Text>
            </View>
          </View>

          <View style={styles.sideDivider} />
          <SidebarLink icon="grid-outline" title="Dashboard" route={ROUTES.dashboard} />
          <SidebarLink icon="search-outline" title="Load Board" route={ROUTES.board} />
          <SidebarLink icon="briefcase-outline" title="My Loads" route={ROUTES.myLoads} />
          <SidebarLink icon="pulse-outline" title="Live Loads" route={ROUTES.liveLoads} />
          <SidebarLink icon="megaphone-outline" title="Dispatch Alerts" route={ROUTES.dispatchAlerts} />
          <SidebarLink icon="chatbubbles-outline" title="Messages" route={ROUTES.communicationCenter} />

          <View style={styles.carrierPanel}>
            <Text style={styles.carrierLabel}>Carrier</Text>
            <Text style={styles.carrierName} numberOfLines={1}>
              {carrier?.companyName || carrier?.businessName || "Farm2Home Freight Carrier"}
            </Text>
            <Text style={styles.carrierSub} numberOfLines={1}>
              {carrier?.accountId || carrier?.account_id || carrier?.email || "Carrier workspace"}
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
                <Text style={styles.eyebrow}>Fina Admin Notification Inbox</Text>
                <Text style={styles.pageTitle}>Notifications</Text>
                <Text style={styles.pageSubtitle}>
                  Load updates, payout alerts, route messages, support notices, compliance reminders, and account alerts.
                </Text>
              </View>

              <TouchableOpacity style={styles.topIconButton} onPress={markAllRead} activeOpacity={0.85}>
                <Ionicons name="checkmark-done-outline" size={23} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.profileCard}>
              <View style={styles.profileAvatar}>
                <Ionicons name="business-outline" size={28} color={COLORS.white} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>
                  {carrier?.companyName || carrier?.businessName || "Farm2Home Freight Carrier"}
                </Text>
                <Text style={styles.profileEmail}>{carrier?.email || "Carrier workspace"}</Text>
              </View>

              <TouchableOpacity style={styles.readPill} onPress={markAllRead} activeOpacity={0.85}>
                <Text style={styles.readPillText}>Mark read</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.metricGrid}>
              <MetricCard label="Total" value={String(stats.total)} icon="notifications-outline" />
              <MetricCard label="Unread" value={String(stats.unread)} icon="mail-unread-outline" />
              <MetricCard label="Loads" value={String(stats.load)} icon="cube-outline" />
              <MetricCard label="Payouts" value={String(stats.payout)} icon="wallet-outline" />
              <MetricCard label="Issues" value={String(stats.issue)} icon="warning-outline" />
            </View>

            <View style={styles.quickGrid}>
              <QuickLink icon="grid-outline" label="Dashboard" route={ROUTES.dashboard} />
              <QuickLink icon="search-outline" label="Load Board" route={ROUTES.board} />
              <QuickLink icon="megaphone-outline" label="Dispatch Alerts" route={ROUTES.dispatchAlerts} />
              <QuickLink icon="chatbubbles-outline" label="Messages" route={ROUTES.communicationCenter} />
              <QuickLink icon="alert-circle-outline" label="Load Issues" route={ROUTES.loadIssues} />
              <QuickLink icon="warning-outline" label="Exceptions" route={ROUTES.routeExceptions} />
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Notification Inbox</Text>
              <TouchableOpacity onPress={onRefresh}>
                <Text style={styles.sectionLink}>Refresh</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyCard}>
                  <Ionicons name="notifications-off-outline" size={38} color={COLORS.primary} />
                  <Text style={styles.emptyTitle}>No freight notifications</Text>
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
                      <Ionicons name={iconForType(item.type)} size={22} color={COLORS.white} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={styles.notificationHeader}>
                        <Text style={styles.notificationTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        {unread ? <View style={styles.unreadDot} /> : null}
                      </View>

                      <Text style={styles.notificationType}>
                        {String(item.type || "notification").replace(/_/g, " ")}
                      </Text>

                      <Text style={styles.notificationBody} numberOfLines={2}>
                        {item.body}
                      </Text>

                      <Text style={styles.notificationDate}>{formatDate(item.created_at)}</Text>
                    </View>

                    <Ionicons name="chevron-forward-outline" size={20} color={COLORS.muted} />
                  </TouchableOpacity>
                );
              }}
            />
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
  carrierPanel: {
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 18,
    padding: 14,
    marginTop: 12,
  },
  carrierLabel: { color: "#A5B4FC", fontWeight: "900", textTransform: "uppercase", fontSize: 11 },
  carrierName: { color: COLORS.white, fontWeight: "900", marginTop: 6 },
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
  eyebrow: { color: COLORS.primary, fontWeight: "900", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1, fontSize: 12 },
  pageTitle: { color: COLORS.text, fontSize: 34, fontWeight: "900", marginBottom: 8 },
  pageSubtitle: { color: COLORS.muted, lineHeight: 22, fontWeight: "700", maxWidth: 760 },
  topIconButton: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  profileCard: {
    backgroundColor: COLORS.white,
    marginBottom: 14,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  profileAvatar: {
    width: 58,
    height: 58,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  profileName: { color: COLORS.text, fontSize: 19, fontWeight: "900" },
  profileEmail: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  readPill: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  readPillText: { color: COLORS.primary, fontWeight: "900", fontSize: 12 },
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
  metricValue: { color: COLORS.text, fontWeight: "900", fontSize: 22, marginTop: 5 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  quickLink: {
    width: Platform.OS === "web" ? "15.25%" : "48%",
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 102,
    justifyContent: "space-between",
  },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickText: { color: COLORS.text, fontWeight: "900" },
  sectionHeader: { marginTop: 2, marginBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: COLORS.text, fontSize: 23, fontWeight: "900" },
  sectionLink: { color: COLORS.primary, fontWeight: "900" },
  listContent: { paddingBottom: 20 },
  notificationCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  unreadCard: { borderColor: COLORS.primary, borderWidth: 2, backgroundColor: "#F8FAFF" },
  iconWrap: { width: 48, height: 48, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  notificationHeader: { flexDirection: "row", gap: 8, alignItems: "center" },
  notificationTitle: { color: COLORS.text, fontSize: 16, fontWeight: "900", flex: 1 },
  notificationType: { color: COLORS.primary, fontWeight: "900", fontSize: 12, marginTop: 4, textTransform: "capitalize" },
  notificationBody: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 5 },
  notificationDate: { color: COLORS.muted, fontSize: 12, fontWeight: "800", marginTop: 7 },
  unreadDot: { width: 9, height: 9, borderRadius: 999, backgroundColor: COLORS.primary },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 20,
  },
  emptyTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900", marginTop: 10 },
  emptyText: { color: COLORS.muted, fontWeight: "700", textAlign: "center", marginTop: 8, lineHeight: 22 },
});
