// app/freight/support.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
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

const FREIGHT_ROUTES = {
  dashboard: "/freight/dashboard",
  board: "/freight/board",
  myLoads: "/freight/my-loads",
  liveLoads: "/freight/live-loads",
  liveRoute: "/freight/live-route",
  routeDetails: "/freight/route-details",
  loadIssues: "/freight/load-issues",
  routeExceptions: "/freight/route-exceptions",
  loadChat: "/freight/load-chat",
  communicationCenter: "/freight/communication-center",
  dispatchAlerts: "/freight/dispatch-alerts",
  notifications: "/freight/notifications",
  profile: "/freight/profile",
  subscription: "/freight/subscription",
  settings: "/freight/settings",
  connectBank: "/freight/connect-bank",
  help: "/freight/help",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];

const SUPPORT_CATEGORIES = [
  { key: "load", label: "Load" },
  { key: "billing", label: "Billing" },
  { key: "route", label: "Route" },
  { key: "carrier", label: "Carrier" },
  { key: "payout", label: "Payout" },
  { key: "emergency", label: "Emergency" },
];

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
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString();
}

function statusLabel(value: any) {
  return String(value || "open")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function priorityColor(priority: any) {
  const value = normalize(priority);
  if (["urgent", "high", "emergency"].includes(value)) return COLORS.red;
  if (["medium", "normal"].includes(value)) return COLORS.amber;
  if (["low"].includes(value)) return COLORS.blue;
  return COLORS.primary;
}

export default function FreightSupportScreen() {
  const params = useLocalSearchParams();
  const routeLoadId = Array.isArray(params.loadId) ? params.loadId[0] : String(params.loadId || "");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loads, setLoads] = useState<any[]>([]);

  const [category, setCategory] = useState("load");
  const [selectedLoadId, setSelectedLoadId] = useState(routeLoadId || "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadSupportScreen();
    }, [routeLoadId])
  );

  const stats = useMemo(() => {
    const open = tickets.filter((item) => ["open", "new", "pending", "in_progress"].includes(normalize(item.status))).length;
    const urgent = tickets.filter((item) => ["high", "urgent", "emergency"].includes(normalize(item.priority))).length;
    const resolved = tickets.filter((item) => ["resolved", "closed"].includes(normalize(item.status))).length;
    return { total: tickets.length, open, urgent, resolved };
  }, [tickets]);

  const selectedLoad = useMemo(() => {
    return loads.find((item) => String(item.id) === String(selectedLoadId));
  }, [loads, selectedLoadId]);

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
      console.log("Support subscription lookup error:", error.message);
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
        "Freight Connect Carrier",
      company_name:
        nextCarrier.company_name ||
        nextCarrier.companyName ||
        nextCarrier.business_name ||
        nextCarrier.businessName ||
        "Freight Connect Carrier",
      businessName:
        nextCarrier.businessName ||
        nextCarrier.companyName ||
        nextCarrier.business_name ||
        nextCarrier.company_name ||
        "Freight Connect Carrier",
      business_name:
        nextCarrier.business_name ||
        nextCarrier.businessName ||
        nextCarrier.company_name ||
        nextCarrier.companyName ||
        "Freight Connect Carrier",
      contactName: nextCarrier.contactName || nextCarrier.contact_name || nextCarrier.name || "",
      contact_name: nextCarrier.contact_name || nextCarrier.contactName || nextCarrier.name || "",
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

  async function loadSupportScreen() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();

      const authId = clean(authData?.user?.id || "");
      const storedId = clean(stored?.id || stored?.freightId || stored?.freight_id || "");
      const email = normalize(stored?.email || authData?.user?.email || "");
      const accountId = clean(stored?.accountId || stored?.account_id || "");

      if (!email && !authId && !storedId && !accountId) {
        router.replace(FREIGHT_ROUTES.login as any);
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

      if (carrierError) console.log("Load freight support profile error:", carrierError.message);

      const dbCarrier = Array.isArray(dbCarrierRows) && dbCarrierRows.length > 0 ? dbCarrierRows[0] : null;

      if (!dbCarrier) {
        Alert.alert("Freight Profile Missing", "No freight profile was found. Please complete freight registration first.");
        router.replace(FREIGHT_ROUTES.register as any);
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

      const { data: ticketData, error: ticketError } = await supabase
        .from("support_tickets")
        .select("*")
        .or(`user_id.eq.${activeCarrier.id},freight_id.eq.${activeCarrier.id},email.eq.${activeCarrier.email}`)
        .order("created_at", { ascending: false });

      if (ticketError) {
        console.log("Support tickets error:", ticketError.message);
        setTickets([]);
      } else {
        setTickets(Array.isArray(ticketData) ? ticketData : []);
      }

      const { data: loadData, error: loadError } = await supabase
        .from("freight_loads")
        .select("*")
        .or(
          `carrier_id.eq.${activeCarrier.id},freight_user_id.eq.${activeCarrier.id},driver_id.eq.${activeCarrier.id},accepted_by.eq.${activeCarrier.id}`
        )
        .order("updated_at", { ascending: false });

      if (loadError) {
        console.log("Support load lookup error:", loadError.message);
        setLoads([]);
      } else {
        const cloudLoads = Array.isArray(loadData) ? loadData : [];
        setLoads(cloudLoads);

        if (routeLoadId) setSelectedLoadId(routeLoadId);
        else if (!selectedLoadId && cloudLoads.length > 0) setSelectedLoadId(String(cloudLoads[0].id));
      }
    } catch (error: any) {
      console.log("Load freight support error:", error);
      Alert.alert("Support Error", error?.message || "Unable to load freight support.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadSupportScreen();
  }

  async function submitSupportRequest() {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      router.replace(FREIGHT_ROUTES.login as any);
      return;
    }

    if (!subject.trim()) {
      Alert.alert("Subject Required", "Please enter a support subject.");
      return;
    }

    if (!message.trim()) {
      Alert.alert("Message Required", "Please describe what you need help with.");
      return;
    }

    try {
      setSubmitting(true);

      const now = new Date().toISOString();

      const loadContext = selectedLoad
        ? `\n\nLoad Context:\nLoad ID: ${selectedLoad.id}\nRoute: ${selectedLoad.pickup_location || "Pickup"} → ${
            selectedLoad.dropoff_location || "Dropoff"
          }\nStatus: ${selectedLoad.status || "unknown"}`
        : "";

      const payload = {
        user_id: carrier.id,
        freight_id: carrier.id,
        role: "freight",
        category,
        subject: subject.trim(),
        message: `${message.trim()}${loadContext}`,
        status: "open",
        priority: category === "emergency" ? "high" : "normal",
        load_id: selectedLoad?.id || routeLoadId || null,
        email: carrier.email || null,
        name: carrier.companyName || carrier.businessName || carrier.contactName || "Freight Carrier",
        created_at: now,
        updated_at: now,
      };

      const { error } = await supabase.from("support_tickets").insert(payload);
      if (error) throw error;

      await supabase.from("freight_notifications").insert({
        freight_user_id: carrier.id,
        freight_id: carrier.id,
        user_id: carrier.id,
        load_id: selectedLoad?.id || routeLoadId || null,
        title: "Support Request Sent",
        message: subject.trim(),
        type: "support",
        priority: payload.priority,
        is_read: false,
        read: false,
        created_at: now,
      });

      setSubject("");
      setMessage("");

      Alert.alert("Support Request Sent", "Farm2Home freight support received your request.");
      await loadSupportScreen();
    } catch (error: any) {
      Alert.alert("Support Error", error?.message || "Unable to send support request.");
    } finally {
      setSubmitting(false);
    }
  }

  async function callSupport() {
    try {
      await Linking.openURL("tel:+18005550199");
    } catch {
      Alert.alert("Call Error", "Unable to open phone dialer.");
    }
  }

  async function emailSupport() {
    try {
      const mailUrl = `mailto:support@farm2home.app?subject=Farm2Home Freight Support&body=Carrier: ${encodeURIComponent(
        carrier?.companyName || carrier?.businessName || "Freight Carrier"
      )}%0AEmail: ${encodeURIComponent(carrier?.email || "")}%0A%0AMessage:%0A`;

      await Linking.openURL(mailUrl);
    } catch {
      Alert.alert("Email Error", "Unable to open email app.");
    }
  }

  function renderLoad({ item }: { item: any }) {
    const active = String(item.id) === String(selectedLoadId);

    return (
      <TouchableOpacity style={[styles.loadCard, active && styles.loadCardActive]} onPress={() => setSelectedLoadId(String(item.id))}>
        <View style={{ flex: 1 }}>
          <Text style={styles.loadTitle}>{item.title || item.commodity || "Freight Load"}</Text>
          <Text style={styles.loadSub}>
            {item.pickup_location || "Pickup"} → {item.dropoff_location || "Dropoff"}
          </Text>
          <Text style={styles.loadMeta}>Status: {statusLabel(item.status)}</Text>
        </View>

        {active ? (
          <View style={styles.selectedBadge}>
            <Text style={styles.selectedBadgeText}>Selected</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  }

  function renderTicket({ item }: { item: any }) {
    const color = priorityColor(item.priority);

    return (
      <View style={styles.ticketCard}>
        <View style={[styles.ticketIcon, { backgroundColor: color }]}>
          <Ionicons name="help-buoy-outline" size={22} color={COLORS.white} />
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.ticketTop}>
            <Text style={styles.ticketTitle} numberOfLines={1}>
              {item.subject || "Support Ticket"}
            </Text>
            <Text style={styles.ticketDate}>{formatDate(item.created_at)}</Text>
          </View>

          <Text style={styles.ticketMeta}>
            {statusLabel(item.status)} · {statusLabel(item.priority)} · {statusLabel(item.category)}
          </Text>

          <Text style={styles.ticketText} numberOfLines={3}>
            {item.message || item.body || "No ticket details."}
          </Text>

          {item.load_id ? (
            <View style={styles.ticketActions}>
              <TouchableOpacity style={styles.miniAction} onPress={() => openWithLoad(FREIGHT_ROUTES.loadChat, String(item.load_id))}>
                <Ionicons name="chatbubble-outline" size={16} color={COLORS.primary} />
                <Text style={styles.miniActionText}>Chat</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.miniAction} onPress={() => openWithLoad(FREIGHT_ROUTES.routeDetails, String(item.load_id))}>
                <Ionicons name="trail-sign-outline" size={16} color={COLORS.primary} />
                <Text style={styles.miniActionText}>Route</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.centerText}>Loading freight support...</Text>
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
              <Ionicons name="headset-outline" size={28} color={COLORS.white} />
            </View>
            <View>
              <Text style={styles.brandTitle}>Farm2Home</Text>
              <Text style={styles.brandSubtitle}>Support</Text>
            </View>
          </View>

          <View style={styles.sideDivider} />
          <SidebarLink icon="grid-outline" title="Dashboard" route={FREIGHT_ROUTES.dashboard} />
          <SidebarLink icon="search-outline" title="Load Board" route={FREIGHT_ROUTES.board} />
          <SidebarLink icon="briefcase-outline" title="My Loads" route={FREIGHT_ROUTES.myLoads} />
          <SidebarLink icon="pulse-outline" title="Live Loads" route={FREIGHT_ROUTES.liveLoads} />
          <SidebarLink icon="chatbubbles-outline" title="Messages" route={FREIGHT_ROUTES.communicationCenter} />
          <SidebarLink icon="business-outline" title="Payouts" route={FREIGHT_ROUTES.connectBank} />

          <View style={styles.carrierPanel}>
            <Text style={styles.carrierLabel}>Carrier</Text>
            <Text style={styles.carrierName} numberOfLines={1}>
              {carrier?.companyName || carrier?.businessName || "Freight Connect Carrier"}
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
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.topPanel}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>Fina Admin Support Center</Text>
                <Text style={styles.pageTitle}>Freight Support</Text>
                <Text style={styles.pageSubtitle}>
                  Get help with freight loads, carrier verification, billing, routing, tracking, payouts, and live logistics operations.
                </Text>
              </View>

              <TouchableOpacity style={styles.topIconButton} onPress={() => goTo(FREIGHT_ROUTES.dashboard)}>
                <Ionicons name="grid-outline" size={23} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.metricGrid}>
              <MetricCard label="Tickets" value={String(stats.total)} icon="help-buoy-outline" />
              <MetricCard label="Open" value={String(stats.open)} icon="folder-open-outline" />
              <MetricCard label="Urgent" value={String(stats.urgent)} icon="alert-circle-outline" />
              <MetricCard label="Resolved" value={String(stats.resolved)} icon="checkmark-done-outline" />
            </View>

            <View style={styles.quickGrid}>
              <QuickAction icon="call-outline" label="Call Support" onPress={callSupport} />
              <QuickAction icon="mail-outline" label="Email Support" onPress={emailSupport} />
              <QuickAction icon="chatbubble-ellipses-outline" label="Messages" onPress={() => goTo(FREIGHT_ROUTES.communicationCenter)} />
              <QuickAction icon="help-circle-outline" label="Help Center" onPress={() => goTo(FREIGHT_ROUTES.help)} />
              <QuickAction icon="alert-circle-outline" label="Load Issues" onPress={() => goTo(FREIGHT_ROUTES.loadIssues)} />
              <QuickAction icon="warning-outline" label="Exceptions" onPress={() => goTo(FREIGHT_ROUTES.routeExceptions)} />
              <QuickAction icon="business-outline" label="Payouts" onPress={() => goTo(FREIGHT_ROUTES.connectBank)} />
              <QuickAction icon="pulse-outline" label="Live Loads" onPress={() => goTo(FREIGHT_ROUTES.liveLoads)} />
            </View>

            <View style={styles.gridTwo}>
              <View style={styles.card}>
                <SectionHeader
                  icon="cube-outline"
                  title="Attach Load"
                  subtitle="Optional: connect this support ticket to a freight load."
                />

                <FlatList
                  data={loads.slice(0, 6)}
                  keyExtractor={(item, index) => String(item.id || index)}
                  scrollEnabled={false}
                  renderItem={renderLoad}
                  ListEmptyComponent={
                    <View style={styles.emptyBox}>
                      <Text style={styles.emptyTitle}>No loads found.</Text>
                      <Text style={styles.emptyText}>Support tickets can still be created without a selected load.</Text>
                    </View>
                  }
                />
              </View>

              <View style={styles.card}>
                <SectionHeader
                  icon="help-buoy-outline"
                  title="Create Support Ticket"
                  subtitle="Send a detailed request to Farm2Home freight operations."
                />

                <Text style={styles.label}>Support Category</Text>
                <View style={styles.optionGrid}>
                  {SUPPORT_CATEGORIES.map((item) => {
                    const active = category === item.key;

                    return (
                      <TouchableOpacity
                        key={item.key}
                        style={[styles.optionButton, active && styles.optionButtonActive]}
                        onPress={() => setCategory(item.key)}
                      >
                        <Text style={[styles.optionButtonText, active && styles.optionButtonTextActive]}>{item.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>Subject</Text>
                <TextInput
                  style={styles.input}
                  value={subject}
                  onChangeText={setSubject}
                  placeholder="What do you need help with?"
                  placeholderTextColor="#94A3B8"
                />

                <Text style={styles.label}>Message</Text>
                <TextInput
                  style={[styles.input, styles.messageInput]}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Include load ID, route, pickup/dropoff location, billing issue, payout issue, or carrier concern."
                  placeholderTextColor="#94A3B8"
                  multiline
                  textAlignVertical="top"
                />

                <TouchableOpacity
                  style={[styles.primaryButton, submitting && styles.disabledButton]}
                  onPress={submitSupportRequest}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <>
                      <Ionicons name="send-outline" size={18} color={COLORS.white} />
                      <Text style={styles.primaryButtonText}>Submit Support Request</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.card}>
              <SectionHeader icon="time-outline" title="Support History" subtitle="Recent freight support requests." />

              <FlatList
                data={tickets}
                keyExtractor={(item, index) => String(item.id || index)}
                scrollEnabled={false}
                renderItem={renderTicket}
                ListEmptyComponent={
                  <View style={styles.emptyBox}>
                    <Ionicons name="help-buoy-outline" size={34} color={COLORS.primary} />
                    <Text style={styles.emptyTitle}>No support tickets yet.</Text>
                    <Text style={styles.emptyText}>Create a ticket above when you need freight operations help.</Text>
                  </View>
                }
              />
            </View>

            <View style={styles.card}>
              <SectionHeader icon="flash-outline" title="Common Freight Issues" subtitle="Fast shortcuts for carrier operations." />
              <RouteButton title="I cannot accept a freight load" route={FREIGHT_ROUTES.board} />
              <RouteButton title="I need help with my carrier profile" route={FREIGHT_ROUTES.profile} />
              <RouteButton title="Membership or billing issue" route={FREIGHT_ROUTES.subscription} />
              <RouteButton title="Connect Bank or payout issue" route={FREIGHT_ROUTES.connectBank} />
              <RouteButton title="Live route or tracking issue" route={FREIGHT_ROUTES.liveRoute} />
              <RouteButton title="Freight settings" route={FREIGHT_ROUTES.settings} />
            </View>

            <TouchableOpacity style={styles.darkButton} onPress={() => router.replace(FREIGHT_ROUTES.dashboard as any)}>
              <Ionicons name="grid-outline" size={18} color={COLORS.white} />
              <Text style={styles.darkButtonText}>Back to Freight Dashboard</Text>
            </TouchableOpacity>
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

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={22} color={COLORS.primary} />
      </View>
      <Text style={styles.quickActionText}>{label}</Text>
    </TouchableOpacity>
  );
}

function RouteButton({ title, route }: { title: string; route: FreightRoute }) {
  return (
    <TouchableOpacity style={styles.routeButton} onPress={() => goTo(route)}>
      <Text style={styles.routeButtonText}>{title}</Text>
      <Ionicons name="chevron-forward-outline" size={20} color={COLORS.primary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, backgroundColor: COLORS.bg, justifyContent: "center", alignItems: "center", padding: 24 },
  centerText: { color: COLORS.muted, marginTop: 10, fontWeight: "800" },
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
  quickAction: {
    width: Platform.OS === "web" ? "23.5%" : "48%",
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
  quickActionText: { color: COLORS.text, fontWeight: "900" },
  gridTwo: { flexDirection: Platform.OS === "web" ? "row" : "column", gap: 14, alignItems: "flex-start" },
  card: {
    flex: 1,
    width: "100%",
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 14 },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900" },
  sectionSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 3 },
  loadCard: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 13,
    marginBottom: 10,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  loadCardActive: { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primary },
  loadTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  loadSub: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  loadMeta: { color: COLORS.primary, fontWeight: "900", marginTop: 4, textTransform: "capitalize" },
  selectedBadge: { backgroundColor: COLORS.primary, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  selectedBadgeText: { color: COLORS.white, fontWeight: "900", fontSize: 11 },
  emptyBox: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
  },
  emptyTitle: { color: COLORS.text, fontWeight: "900", fontSize: 17, marginTop: 8 },
  emptyText: { color: COLORS.muted, fontWeight: "700", textAlign: "center", marginTop: 6, lineHeight: 20 },
  label: { color: COLORS.text, fontWeight: "900", marginBottom: 7, marginTop: 8 },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  optionButton: {
    width: Platform.OS === "web" ? "31.5%" : "48%",
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  optionButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  optionButtonText: { color: COLORS.text, fontWeight: "900", fontSize: 12 },
  optionButtonTextActive: { color: COLORS.white },
  input: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },
  messageInput: { minHeight: 130, lineHeight: 21 },
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    minHeight: 56,
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: { opacity: 0.6 },
  primaryButtonText: { color: COLORS.white, fontWeight: "900", fontSize: 15 },
  ticketCard: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    gap: 12,
  },
  ticketIcon: { width: 46, height: 46, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  ticketTop: { flexDirection: "row", gap: 10 },
  ticketTitle: { flex: 1, color: COLORS.text, fontWeight: "900", fontSize: 16 },
  ticketDate: { color: COLORS.muted, fontWeight: "700", fontSize: 11 },
  ticketMeta: { color: COLORS.primary, fontWeight: "900", marginTop: 4 },
  ticketText: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 6 },
  ticketActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  miniAction: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  miniActionText: { color: COLORS.primary, fontWeight: "900", fontSize: 12 },
  routeButton: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  routeButtonText: { flex: 1, color: COLORS.text, fontWeight: "900" },
  darkButton: {
    backgroundColor: COLORS.navy,
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
    flexDirection: "row",
    gap: 8,
  },
  darkButtonText: { color: COLORS.white, fontWeight: "900" },
});
