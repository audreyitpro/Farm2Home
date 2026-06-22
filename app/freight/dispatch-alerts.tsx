// app/freight/dispatch-alerts.tsx

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
  communicationCenter: "/freight/communication-center",
  dispatchCenter: "/freight/dispatch-center",
  myLoads: "/freight/my-loads",
  liveLoads: "/freight/live-loads",
  loadChat: "/freight/load-chat",
  loadDetail: "/freight/load-detail",
  liveRoute: "/freight/live-route",
  tracking: "/freight/tracking",
  routeExceptions: "/freight/route-exceptions",
  loadIssues: "/freight/load-issues",
  reviewStatus: "/freight/review-status",
  support: "/freight/support",
  notifications: "/freight/notifications",
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

function openWithLoad(route: FreightRoute, loadId: string) {
  router.push({
    pathname: route as any,
    params: { loadId },
  });
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

  return COLORS.primary;
}

function alertIcon(type: any): keyof typeof Ionicons.glyphMap {
  const value = normalize(type);

  if (value.includes("route")) return "navigate-outline";
  if (value.includes("pickup")) return "cube-outline";
  if (value.includes("delivery")) return "flag-outline";
  if (value.includes("review")) return "eye-outline";
  if (value.includes("exception")) return "warning-outline";
  if (value.includes("issue")) return "alert-circle-outline";
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
      console.log("Dispatch alerts subscription lookup error:", error.message);
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

  async function loadDispatchAlerts() {
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

      const { data: dbCarrierRows, error } = await supabase
        .from("freight_users")
        .select("*")
        .or(profileFilters)
        .limit(1);

      if (error) console.log("Dispatch alerts carrier error:", error.message);

      const dbCarrier = Array.isArray(dbCarrierRows) && dbCarrierRows.length > 0 ? dbCarrierRows[0] : null;

      if (!dbCarrier) {
        Alert.alert("Freight Profile Missing", "Please complete freight registration first.");
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

      const { data: alertData, error: alertError } = await supabase
        .from("freight_notifications")
        .select("*")
        .or(`freight_id.eq.${activeCarrier.id},freight_user_id.eq.${activeCarrier.id},user_id.eq.${activeCarrier.id}`)
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
          `carrier_id.eq.${activeCarrier.id},freight_user_id.eq.${activeCarrier.id},driver_id.eq.${activeCarrier.id},accepted_by.eq.${activeCarrier.id}`
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
          read: true,
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
          read: true,
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
      if (loadId) openWithLoad(ROUTES.routeExceptions, String(loadId));
      else goTo(ROUTES.routeExceptions);
      return;
    }

    if (type.includes("issue")) {
      if (loadId) openWithLoad(ROUTES.loadIssues, String(loadId));
      else goTo(ROUTES.loadIssues);
      return;
    }

    if (type.includes("review")) {
      goTo(ROUTES.reviewStatus);
      return;
    }

    if (type.includes("route") && loadId) {
      openWithLoad(ROUTES.liveRoute, String(loadId));
      return;
    }

    if (loadId) {
      openWithLoad(ROUTES.loadChat, String(loadId));
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
    const unread = !item.read_at && !item.is_read && !item.read;
    const updating = updatingId === item.id;
    const color = alertColor(priority);

    return (
      <View style={[styles.alertCard, unread && styles.alertCardUnread]}>
        <TouchableOpacity style={styles.alertTop} onPress={() => openAlert(item)}>
          <View style={[styles.alertIcon, { backgroundColor: color }]}>
            <Ionicons name={alertIcon(type)} size={22} color={COLORS.white} />
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
            <Ionicons name="open-outline" size={16} color={COLORS.primary} />
            <Text style={styles.outlineSmallText}>Open</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primarySmall, updating && styles.disabledButton]}
            onPress={() => markRead(item)}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="checkmark-outline" size={16} color={COLORS.white} />
                <Text style={styles.primarySmallText}>Read</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.darkSmall, updating && styles.disabledButton]}
            onPress={() => clearAlert(item)}
            disabled={updating}
          >
            <Ionicons name="close-outline" size={16} color={COLORS.white} />
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
        onPress={() => openWithLoad(ROUTES.loadChat, String(item.id))}
      >
        <View style={styles.loadIcon}>
          <Ionicons name="cube-outline" size={21} color={COLORS.white} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.loadTitle} numberOfLines={1}>
            {item.title || item.commodity || "Active Load"}
          </Text>
          <Text style={styles.loadSub} numberOfLines={1}>
            {item.pickup_location || item.origin || "Pickup"} → {item.dropoff_location || item.destination || "Dropoff"}
          </Text>
          <Text style={styles.loadMeta}>{String(item.status || "load").replace(/_/g, " ")}</Text>
        </View>

        <View style={styles.loadActions}>
          <TouchableOpacity style={styles.miniAction} onPress={() => openWithLoad(ROUTES.loadDetail, String(item.id))}>
            <Ionicons name="document-text-outline" size={16} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.miniAction} onPress={() => openWithLoad(ROUTES.liveRoute, String(item.id))}>
            <Ionicons name="map-outline" size={16} color={COLORS.primary} />
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
        <Text style={styles.centerText}>Loading dispatch alerts...</Text>
      </SafeAreaView>
    );
  }

  const activeLoads = loads.filter((item) =>
    ["accepted", "booked", "arrived_pickup", "picked_up", "in_transit", "arrived_dropoff"].includes(normalize(item.status))
  );

  const visibleAlerts = alerts.filter((item) => normalize(item.status) !== "cleared");

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <View style={styles.shell}>
        <View style={styles.sidebar}>
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}>
              <Ionicons name="megaphone-outline" size={28} color={COLORS.white} />
            </View>
            <View>
              <Text style={styles.brandTitle}>Farm2Home</Text>
              <Text style={styles.brandSubtitle}>Dispatch Alerts</Text>
            </View>
          </View>

          <View style={styles.sideDivider} />
          <SidebarLink icon="grid-outline" title="Dashboard" route={ROUTES.dashboard} />
          <SidebarLink icon="search-outline" title="Load Board" route={ROUTES.board} />
          <SidebarLink icon="briefcase-outline" title="My Loads" route={ROUTES.myLoads} />
          <SidebarLink icon="pulse-outline" title="Live Loads" route={ROUTES.liveLoads} />
          <SidebarLink icon="chatbubbles-outline" title="Messages" route={ROUTES.communicationCenter} />
          <SidebarLink icon="notifications-outline" title="Notifications" route={ROUTES.notifications} />

          <View style={styles.carrierPanel}>
            <Text style={styles.carrierLabel}>Carrier</Text>
            <Text style={styles.carrierName} numberOfLines={1}>
              {carrier?.companyName || "Farm2Home Freight Carrier"}
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
                <Text style={styles.eyebrow}>Fina Admin Alert Inbox</Text>
                <Text style={styles.pageTitle}>Dispatch Alerts</Text>
                <Text style={styles.pageSubtitle}>
                  Urgent dispatch notices, route exceptions, load updates, payment notices, and review messages.
                </Text>
              </View>

              <TouchableOpacity style={styles.topIconButton} onPress={createDemoAlert}>
                <Ionicons name="megaphone-outline" size={23} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.profileCard}>
              <View style={styles.profileAvatar}>
                <Ionicons name="business-outline" size={28} color={COLORS.white} />
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

            <View style={styles.bottomActions}>
              <TouchableOpacity style={styles.primaryButton} onPress={() => goTo(ROUTES.communicationCenter)}>
                <Ionicons name="chatbubbles-outline" size={18} color={COLORS.white} />
                <Text style={styles.primaryText}>Open Communication Center</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.darkButton} onPress={() => goTo(ROUTES.notifications)}>
                <Ionicons name="notifications-outline" size={18} color={COLORS.white} />
                <Text style={styles.primaryText}>All Notifications</Text>
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
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={22} color={COLORS.primary} />
      </View>
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
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={22} color={COLORS.primary} />
      </View>
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
      <Ionicons name={icon} size={38} color={COLORS.primary} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
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
    borderRadius: 24,
    padding: 16,
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
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  profileName: { color: COLORS.text, fontSize: 19, fontWeight: "900" },
  profileEmail: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  alertPill: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  alertPillDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: COLORS.primary },
  alertPillText: { color: COLORS.primary, fontWeight: "900", fontSize: 12 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  statCard: {
    width: Platform.OS === "web" ? "18.7%" : "48%",
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: { color: COLORS.text, fontSize: 24, fontWeight: "900" },
  statLabel: { color: COLORS.muted, fontWeight: "800", marginTop: 4 },
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
  sectionHeader: { marginTop: 4, marginBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: COLORS.text, fontSize: 23, fontWeight: "900" },
  sectionLink: { color: COLORS.primary, fontWeight: "900" },
  loadCard: {
    backgroundColor: COLORS.white,
    marginBottom: 12,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  loadIcon: { width: 48, height: 48, borderRadius: 19, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  loadTitle: { color: COLORS.text, fontSize: 16, fontWeight: "900" },
  loadSub: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  loadMeta: { color: COLORS.primary, fontWeight: "900", marginTop: 4, textTransform: "capitalize" },
  loadActions: { flexDirection: "row", gap: 8 },
  miniAction: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  alertCard: {
    backgroundColor: COLORS.white,
    marginBottom: 12,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  alertCardUnread: { borderColor: COLORS.primary, borderWidth: 2, backgroundColor: "#F8FAFF" },
  alertTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  alertIcon: { width: 48, height: 48, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  alertTitleRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  alertTitle: { flex: 1, color: COLORS.text, fontSize: 17, fontWeight: "900" },
  alertMeta: { color: COLORS.primary, fontWeight: "900", marginTop: 4, textTransform: "capitalize", fontSize: 12 },
  alertText: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 6 },
  alertTime: { color: COLORS.muted, fontWeight: "700", fontSize: 11, marginTop: 7 },
  unreadDot: { width: 11, height: 11, borderRadius: 999, backgroundColor: COLORS.primary },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  outlineSmall: {
    flex: 1,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  outlineSmallText: { color: COLORS.primary, fontWeight: "900" },
  primarySmall: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  darkSmall: {
    flex: 1,
    backgroundColor: COLORS.navy,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  primarySmallText: { color: COLORS.white, fontWeight: "900" },
  emptyCard: {
    backgroundColor: COLORS.white,
    marginBottom: 14,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900", marginTop: 10 },
  emptyText: { color: COLORS.muted, fontWeight: "700", textAlign: "center", marginTop: 8, lineHeight: 22 },
  bottomActions: { flexDirection: Platform.OS === "web" ? "row" : "column", gap: 10 },
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
  disabledButton: { opacity: 0.6 },
  primaryText: { color: COLORS.white, fontWeight: "900" },
});
