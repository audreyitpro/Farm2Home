// app/freight/load-chat.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
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
  communicationCenter: "/freight/communication-center",
  dashboard: "/freight/dashboard",
  board: "/freight/board",
  myLoads: "/freight/my-loads",
  liveLoads: "/freight/live-loads",
  loadDetail: "/freight/load-detail",
  liveRoute: "/freight/live-route",
  tracking: "/freight/tracking",
  dispatchAlerts: "/freight/dispatch-alerts",
  routeExceptions: "/freight/route-exceptions",
  loadIssues: "/freight/load-issues",
  support: "/freight/support",
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

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function money(value: any) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

export default function FreightLoadChatScreen() {
  const params = useLocalSearchParams();
  const loadId = Array.isArray(params.loadId) ? params.loadId[0] : String(params.loadId || "");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);
  const [load, setLoad] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageBody, setMessageBody] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadChat();
    }, [loadId])
  );

  const stats = useMemo(() => {
    return {
      total: messages.length,
      dispatch: messages.filter((m) => normalize(m.sender_role) === "dispatch").length,
      farmer: messages.filter((m) => normalize(m.sender_role) === "farmer").length,
      customer: messages.filter((m) => normalize(m.sender_role) === "customer").length,
    };
  }, [messages]);

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
      console.log("Load chat subscription lookup error:", error.message);
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

  async function loadChat() {
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

      if (carrierError) console.log("Load chat carrier error:", carrierError.message);

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

      if (!loadId) {
        Alert.alert("Load Missing", "No load was selected for chat.");
        setLoad(null);
        setMessages([]);
        return;
      }

      const { data: loadData, error: loadError } = await supabase
        .from("freight_loads")
        .select("*")
        .eq("id", loadId)
        .maybeSingle();

      if (loadError) console.log("Load chat load error:", loadError.message);
      setLoad(loadData || null);

      const { data: chatData, error: chatError } = await supabase
        .from("freight_load_messages")
        .select("*")
        .eq("load_id", loadId)
        .order("created_at", { ascending: true });

      if (chatError) {
        console.log("Load chat messages error:", chatError.message);
        setMessages([]);
      } else {
        setMessages(Array.isArray(chatData) ? chatData : []);
      }

      await supabase
        .from("freight_load_messages")
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("load_id", loadId)
        .neq("sender_id", activeCarrier.id);
    } catch (error: any) {
      Alert.alert("Load Chat Error", error?.message || "Unable to load chat.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadChat();
  }

  async function sendMessage() {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      return;
    }

    if (!loadId) {
      Alert.alert("Load Missing", "No load selected.");
      return;
    }

    if (!messageBody.trim()) {
      Alert.alert("Message Required", "Type a message before sending.");
      return;
    }

    try {
      setSending(true);

      const now = new Date().toISOString();

      const { error } = await supabase.from("freight_load_messages").insert({
        load_id: loadId,
        freight_id: carrier.id,
        carrier_id: carrier.id,
        sender_id: carrier.id,
        sender_role: "freight",
        sender_name: carrier.companyName || carrier.businessName || "Farm2Home Freight Carrier",
        message: messageBody.trim(),
        body: messageBody.trim(),
        status: "sent",
        is_read: false,
        created_at: now,
        updated_at: now,
      });

      if (error) throw error;

      await supabase.from("freight_notifications").insert({
        freight_user_id: carrier.id,
        freight_id: carrier.id,
        user_id: carrier.id,
        load_id: loadId,
        title: "Load Chat Message Sent",
        message: messageBody.trim(),
        type: "chat",
        is_read: false,
        read: false,
        created_at: now,
      });

      setMessageBody("");
      await loadChat();
    } catch (error: any) {
      Alert.alert("Send Error", error?.message || "Unable to send load chat message.");
    } finally {
      setSending(false);
    }
  }

  function sendQuickMessage(text: string) {
    setMessageBody(text);
  }

  function isMine(item: any) {
    return String(item.sender_id || "") === String(carrier?.id || "") || normalize(item.sender_role) === "freight";
  }

  function roleColor(role: any) {
    const value = normalize(role);
    if (value === "dispatch") return COLORS.blue;
    if (value === "farmer") return COLORS.green;
    if (value === "customer") return COLORS.amber;
    if (value === "freight") return COLORS.primary;
    return COLORS.navy;
  }

  function renderMessage({ item }: { item: any }) {
    const mine = isMine(item);
    const role = item.sender_role || "message";

    return (
      <View style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowOther]}>
        {!mine ? (
          <View style={[styles.messageAvatar, { backgroundColor: roleColor(role) }]}>
            <Ionicons name="person-outline" size={18} color={COLORS.white} />
          </View>
        ) : null}

        <View style={[styles.messageBubble, mine ? styles.messageBubbleMine : styles.messageBubbleOther]}>
          <View style={styles.messageMetaRow}>
            <View style={[styles.roleDot, { backgroundColor: mine ? COLORS.white : roleColor(role) }]} />
            <Text style={[styles.messageRole, mine && styles.messageRoleMine]}>
              {item.sender_name || String(role).replace(/_/g, " ")}
            </Text>
          </View>

          <Text style={[styles.messageText, mine && styles.messageTextMine]}>
            {item.message || item.body || item.content || ""}
          </Text>

          <Text style={[styles.messageTime, mine && styles.messageTimeMine]}>{formatDate(item.created_at)}</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.centerText}>Loading load chat...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.shell}>
          <View style={styles.sidebar}>
            <View style={styles.brandRow}>
              <View style={styles.brandIcon}>
                <Ionicons name="chatbubbles-outline" size={28} color={COLORS.white} />
              </View>
              <View>
                <Text style={styles.brandTitle}>Farm2Home</Text>
                <Text style={styles.brandSubtitle}>Load Chat</Text>
              </View>
            </View>

            <View style={styles.sideDivider} />
            <SidebarLink icon="grid-outline" title="Dashboard" route={ROUTES.dashboard} />
            <SidebarLink icon="chatbubbles-outline" title="Communication" route={ROUTES.communicationCenter} />
            <SidebarLink icon="briefcase-outline" title="My Loads" route={ROUTES.myLoads} />
            <SidebarLink icon="pulse-outline" title="Live Loads" route={ROUTES.liveLoads} />
            <SidebarLink icon="alert-circle-outline" title="Issues" route={ROUTES.loadIssues} />
            <SidebarLink icon="warning-outline" title="Exceptions" route={ROUTES.routeExceptions} />

            <View style={styles.carrierPanel}>
              <Text style={styles.carrierLabel}>Carrier</Text>
              <Text style={styles.carrierName} numberOfLines={1}>
                {carrier?.companyName || "Freight Carrier"}
              </Text>
              <Text style={styles.carrierSub} numberOfLines={1}>
                {carrier?.accountId || carrier?.account_id || "Account pending"}
              </Text>
            </View>
          </View>

          <View style={styles.main}>
            <View style={styles.chatHeader}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Ionicons name="chevron-back-outline" size={24} color={COLORS.primary} />
              </TouchableOpacity>

              <View style={styles.headerAvatar}>
                <Ionicons name="cube-outline" size={23} color={COLORS.white} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {load?.title || load?.commodity || "Freight Load"}
                </Text>
                <Text style={styles.headerSub} numberOfLines={1}>
                  {load?.pickup_location || "Pickup"} → {load?.dropoff_location || "Dropoff"}
                </Text>
              </View>

              <TouchableOpacity style={styles.headerIcon} onPress={() => openWithLoad(ROUTES.loadDetail, loadId)}>
                <Ionicons name="document-text-outline" size={22} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.loadCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.loadTitle}>{load?.title || load?.commodity || "Load Details"}</Text>
                  <Text style={styles.loadSub}>Status: {String(load?.status || "load").replace(/_/g, " ")}</Text>
                  <Text style={styles.loadSub}>Rate: {money(load?.rate || load?.freight_total || load?.payout_amount || 0)}</Text>
                  <Text style={styles.loadSub}>Broker/Farmer: {load?.broker_name || load?.farmer_name || "Farm2Home Dispatch"}</Text>
                </View>

                <TouchableOpacity style={styles.issueButton} onPress={() => openWithLoad(ROUTES.routeExceptions, loadId)}>
                  <Ionicons name="warning-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.issueText}>Issue</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.statsGrid}>
                <StatCard label="Messages" value={String(stats.total)} icon="chatbubble-outline" />
                <StatCard label="Dispatch" value={String(stats.dispatch)} icon="navigate-outline" />
                <StatCard label="Farmer" value={String(stats.farmer)} icon="leaf-outline" />
                <StatCard label="Customer" value={String(stats.customer)} icon="person-outline" />
              </View>

              <View style={styles.quickActions}>
                <QuickLink icon="document-text-outline" label="Details" onPress={() => openWithLoad(ROUTES.loadDetail, loadId)} />
                <QuickLink icon="map-outline" label="Route" onPress={() => openWithLoad(ROUTES.liveRoute, loadId)} />
                <QuickLink icon="pulse-outline" label="Tracking" onPress={() => openWithLoad(ROUTES.tracking, loadId)} />
                <QuickLink icon="alert-circle-outline" label="Issue" onPress={() => openWithLoad(ROUTES.loadIssues, loadId)} />
              </View>

              <View style={styles.quickRow}>
                <QuickButton text="Arrived at pickup." onPress={sendQuickMessage} />
                <QuickButton text="Load picked up and in transit." onPress={sendQuickMessage} />
                <QuickButton text="Running behind schedule." onPress={sendQuickMessage} />
                <QuickButton text="Delivery completed." onPress={sendQuickMessage} />
              </View>

              <Text style={styles.sectionTitle}>Conversation</Text>

              <FlatList
                data={messages}
                keyExtractor={(item, index) => String(item.id || index)}
                scrollEnabled={false}
                renderItem={renderMessage}
                ListEmptyComponent={
                  <View style={styles.emptyCard}>
                    <Ionicons name="chatbubbles-outline" size={38} color={COLORS.primary} />
                    <Text style={styles.emptyTitle}>No messages yet</Text>
                    <Text style={styles.emptyText}>
                      Start the load conversation with dispatch, farmer, or customer updates.
                    </Text>
                  </View>
                }
              />
            </ScrollView>

            <View style={styles.composer}>
              <TextInput
                style={styles.composerInput}
                value={messageBody}
                onChangeText={setMessageBody}
                placeholder="Type load update..."
                placeholderTextColor="#94A3B8"
                multiline
              />

              <TouchableOpacity style={[styles.sendButton, sending && styles.disabledButton]} onPress={sendMessage} disabled={sending}>
                {sending ? <ActivityIndicator color={COLORS.white} /> : <Ionicons name="send-outline" size={22} color={COLORS.white} />}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
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
        <Ionicons name={icon} size={20} color={COLORS.primary} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickButton({
  text,
  onPress,
}: {
  text: string;
  onPress: (value: string) => void;
}) {
  return (
    <TouchableOpacity style={styles.quickButton} onPress={() => onPress(text)}>
      <Text style={styles.quickButtonText}>{text}</Text>
    </TouchableOpacity>
  );
}

function QuickLink({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickLink} onPress={onPress}>
      <Ionicons name={icon} size={18} color={COLORS.primary} />
      <Text style={styles.quickLinkText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  keyboard: { flex: 1 },
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
  main: { flex: 1, backgroundColor: COLORS.bg },
  chatHeader: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    gap: 11,
    alignItems: "center",
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  headerSub: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  body: { flex: 1 },
  bodyContent: { paddingBottom: 20 },
  loadCard: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  loadTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  loadSub: { color: COLORS.muted, fontWeight: "700", marginTop: 4, textTransform: "capitalize" },
  issueButton: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  issueText: { color: COLORS.primary, fontWeight: "900" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 18, marginBottom: 14 },
  statCard: {
    width: Platform.OS === "web" ? "23.5%" : "48%",
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  statLabel: { color: COLORS.muted, fontWeight: "800", marginTop: 3 },
  quickActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 18, marginBottom: 14 },
  quickLink: {
    width: Platform.OS === "web" ? "23.5%" : "48%",
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
  quickLinkText: { color: COLORS.primary, fontWeight: "900", fontSize: 12 },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 18, marginBottom: 16 },
  quickButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  quickButtonText: { color: COLORS.text, fontWeight: "900", fontSize: 12 },
  sectionTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900", paddingHorizontal: 18, marginBottom: 12 },
  messageRow: { paddingHorizontal: 18, marginBottom: 12, flexDirection: "row", alignItems: "flex-end", gap: 8 },
  messageRowMine: { justifyContent: "flex-end" },
  messageRowOther: { justifyContent: "flex-start" },
  messageAvatar: { width: 34, height: 34, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  messageBubble: { maxWidth: "82%", borderRadius: 20, padding: 14, borderWidth: 1 },
  messageBubbleMine: { backgroundColor: COLORS.primary, borderColor: COLORS.primary, borderBottomRightRadius: 6 },
  messageBubbleOther: { backgroundColor: COLORS.white, borderColor: COLORS.border, borderBottomLeftRadius: 6 },
  messageMetaRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 6 },
  roleDot: { width: 8, height: 8, borderRadius: 999 },
  messageRole: { color: COLORS.muted, fontWeight: "900", textTransform: "capitalize", fontSize: 12 },
  messageRoleMine: { color: "#EEF2FF" },
  messageText: { color: COLORS.text, fontWeight: "700", lineHeight: 20 },
  messageTextMine: { color: COLORS.white },
  messageTime: { color: COLORS.muted, fontWeight: "700", fontSize: 11, marginTop: 8 },
  messageTimeMine: { color: "#EEF2FF" },
  emptyCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900", marginTop: 10 },
  emptyText: { color: COLORS.muted, fontWeight: "700", textAlign: "center", marginTop: 8, lineHeight: 22 },
  composer: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  composerInput: {
    flex: 1,
    minHeight: 46,
    maxHeight: 110,
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.text,
    fontWeight: "700",
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: { opacity: 0.6 },
});
