// app/freight/communication-center.tsx

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
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const FREIGHT_ROUTES = {
  managementCenter: "/freight/freight-management-center",
  dispatchCenter: "/freight/dispatch-center",
  myLoads: "/freight/my-loads",
  liveLoads: "/freight/live-loads",
  support: "/freight/support",
  notifications: "/freight/notifications",
  reviewStatus: "/freight/review-status",
  complianceVault: "/freight/compliance-vault",
  loadIssues: "/freight/load-issues",
  routeExceptions: "/freight/route-exceptions",
  login: "/freight/login",
  register: "/freight/register",
} as const;

const COLORS = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  amber: "#D97706",
  blue: "#2563EB",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function goTo(route: string) {
  router.push(route as any);
}

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

export default function FreightCommunicationCenterScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loads, setLoads] = useState<any[]>([]);

  const [subject, setSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [messageType, setMessageType] = useState("Support");

  useFocusEffect(
    useCallback(() => {
      loadCommunicationCenter();
    }, [])
  );

  const stats = useMemo(() => {
    const unreadMessages = messages.filter((item) => !item.read_at && !item.is_read).length;
    const activeAlerts = alerts.filter((item) =>
      ["new", "active", "unread", "pending"].includes(normalize(item.status))
    ).length;
    const activeLoads = loads.filter((item) =>
      ["accepted", "arrived_pickup", "picked_up", "in_transit", "arrived_dropoff"].includes(
        normalize(item.status)
      )
    ).length;
    const reviewMessages = messages.filter((item) =>
      normalize(item.message_type || item.type).includes("review")
    ).length;

    return {
      messages: messages.length,
      unreadMessages,
      activeAlerts,
      activeLoads,
      reviewMessages,
    };
  }, [messages, alerts, loads]);

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

  async function loadCommunicationCenter() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();
      const email = normalize(stored?.email || authData?.user?.email || "");

      if (!email) {
        router.replace(FREIGHT_ROUTES.login as any);
        return;
      }

      const { data: dbCarrier, error } = await supabase
        .from("freight_users")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (error) console.log("Communication center carrier error:", error.message);

      if (!dbCarrier) {
        Alert.alert("Freight Profile Missing", "Please complete freight registration first.");
        router.replace(FREIGHT_ROUTES.register as any);
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
          "Freight Connect Carrier",
      });

      const { data: messageData } = await supabase
        .from("freight_messages")
        .select("*")
        .eq("freight_id", mergedCarrier.id)
        .order("created_at", { ascending: false });

      setMessages(Array.isArray(messageData) ? messageData : []);

      const { data: alertData } = await supabase
        .from("freight_notifications")
        .select("*")
        .eq("freight_id", mergedCarrier.id)
        .order("created_at", { ascending: false });

      setAlerts(Array.isArray(alertData) ? alertData : []);

      const { data: loadData } = await supabase
        .from("freight_loads")
        .select("*")
        .or(
          `carrier_id.eq.${mergedCarrier.id},driver_id.eq.${mergedCarrier.id},accepted_by.eq.${mergedCarrier.id}`
        )
        .order("updated_at", { ascending: false });

      setLoads(Array.isArray(loadData) ? loadData : []);
    } catch (error: any) {
      Alert.alert("Communication Error", error?.message || "Unable to load communication center.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadCommunicationCenter();
  }

  async function sendMessage() {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      return;
    }

    if (!subject.trim() || !messageBody.trim()) {
      Alert.alert("Message Required", "Please enter a subject and message.");
      return;
    }

    try {
      setSending(true);

      const now = new Date().toISOString();

      const { error } = await supabase.from("freight_messages").insert({
        freight_id: carrier.id,
        carrier_id: carrier.id,
        sender_id: carrier.id,
        sender_role: "freight",
        message_type: messageType,
        subject: subject.trim(),
        body: messageBody.trim(),
        status: "sent",
        is_read: false,
        created_at: now,
        updated_at: now,
      });

      if (error) throw error;

      setSubject("");
      setMessageBody("");

      Alert.alert("Sent", "Your message was sent.");
      await loadCommunicationCenter();
    } catch (error: any) {
      Alert.alert(
        "Send Error",
        error?.message || "Unable to send message. Make sure freight_messages table exists."
      );
    } finally {
      setSending(false);
    }
  }

  async function markMessageRead(item: any) {
    if (!item?.id) return;

    try {
      await supabase
        .from("freight_messages")
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      await loadCommunicationCenter();
    } catch {
      // Keep UI stable if table columns differ.
    }
  }

  function openLoadChat(load: any) {
    router.push({
      pathname: "/freight/load-chat" as any,
      params: { loadId: load.id },
    });
  }

  function renderMessage({ item }: { item: any }) {
    const unread = !item.read_at && !item.is_read;

    return (
      <TouchableOpacity style={styles.messageCard} onPress={() => markMessageRead(item)}>
        <View style={[styles.messageIcon, { backgroundColor: unread ? COLORS.red : COLORS.black }]}>
          <Ionicons name="mail-outline" size={21} color="#FFFFFF" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.messageTitle}>{item.subject || item.title || "Freight Message"}</Text>
          <Text style={styles.messageSub}>
            {item.message_type || item.type || "Message"} · {formatDate(item.created_at)}
          </Text>
          <Text style={styles.messageBody} numberOfLines={2}>
            {item.body || item.message || item.content || "No message details."}
          </Text>
        </View>

        {unread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  }

  function renderLoad({ item }: { item: any }) {
    return (
      <TouchableOpacity style={styles.loadCard} onPress={() => openLoadChat(item)}>
        <View style={styles.loadIcon}>
          <Ionicons name="chatbubbles-outline" size={21} color="#FFFFFF" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.loadTitle}>{item.title || item.commodity || "Freight Load Chat"}</Text>
          <Text style={styles.loadSub}>
            {item.pickup_location || "Pickup"} → {item.dropoff_location || "Dropoff"}
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
        <Text style={styles.centerText}>Loading communication center...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Farm2Home Freight Connect</Text>
            <Text style={styles.title}>Communication Center</Text>
            <Text style={styles.subtitle}>
              Carrier support messages, farmer/customer/load chat routing, dispatch alerts,
              review status messages, and Freight Connect notifications.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.notifications)}>
            <Ionicons name="chatbubbles-outline" size={34} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.carrierCard}>
          <View style={styles.avatar}>
            <Ionicons name="business-outline" size={28} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.carrierName}>{carrier?.companyName || "Freight Connect Carrier"}</Text>
            <Text style={styles.carrierEmail}>{carrier?.email || "Carrier workspace"}</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Messages" value={String(stats.messages)} icon="mail-outline" />
          <StatCard label="Unread" value={String(stats.unreadMessages)} icon="mail-unread-outline" />
          <StatCard label="Alerts" value={String(stats.activeAlerts)} icon="notifications-outline" />
          <StatCard label="Active Loads" value={String(stats.activeLoads)} icon="cube-outline" />
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="navigate-circle-outline" label="Dispatch" route={FREIGHT_ROUTES.dispatchCenter} />
          <QuickLink icon="briefcase-outline" label="My Loads" route={FREIGHT_ROUTES.myLoads} />
          <QuickLink icon="notifications-outline" label="Notifications" route={FREIGHT_ROUTES.notifications} />
          <QuickLink icon="eye-outline" label="Review Status" route={FREIGHT_ROUTES.reviewStatus} />
          <QuickLink icon="warning-outline" label="Exceptions" route={FREIGHT_ROUTES.routeExceptions} />
          <QuickLink icon="headset-outline" label="Support" route={FREIGHT_ROUTES.support} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Send Message</Text>

          <View style={styles.typeRow}>
            {["Support", "Dispatch", "Review", "Load Issue"].map((type) => {
              const active = messageType === type;

              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeButton, active && styles.typeButtonActive]}
                  onPress={() => setMessageType(type)}
                >
                  <Text style={[styles.typeText, active && styles.typeTextActive]}>{type}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Subject</Text>
          <TextInput
            style={styles.input}
            value={subject}
            onChangeText={setSubject}
            placeholder="Message subject"
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.label}>Message</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={messageBody}
            onChangeText={setMessageBody}
            placeholder="Type your message..."
            placeholderTextColor="#94A3B8"
            multiline
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.primaryButtonInner, sending && styles.disabledButton]}
            onPress={sendMessage}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="send-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryText}>Send Message</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Load Chat Routing</Text>

        <FlatList
          data={loads.slice(0, 5)}
          keyExtractor={(item, index) => String(item.id || index)}
          scrollEnabled={false}
          renderItem={renderLoad}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="chatbubbles-outline" size={38} color={COLORS.red} />
              <Text style={styles.emptyTitle}>No load chats yet.</Text>
              <Text style={styles.emptyText}>
                Accepted and active freight loads will appear here for chat routing.
              </Text>
            </View>
          }
        />

        <Text style={styles.sectionTitle}>Recent Messages</Text>

        <FlatList
          data={messages.slice(0, 10)}
          keyExtractor={(item, index) => String(item.id || index)}
          scrollEnabled={false}
          renderItem={renderMessage}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="mail-outline" size={38} color={COLORS.red} />
              <Text style={styles.emptyTitle}>No messages yet.</Text>
              <Text style={styles.emptyText}>
                Support, dispatch, review, and load messages will appear here.
              </Text>
            </View>
          }
        />

        <TouchableOpacity style={styles.primaryButton} onPress={() => goTo(FREIGHT_ROUTES.support)}>
          <Ionicons name="headset-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Open Support</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.darkButton} onPress={() => goTo(FREIGHT_ROUTES.managementCenter)}>
          <Ionicons name="apps-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Management Center</Text>
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
  route: string;
}) {
  return (
    <TouchableOpacity style={styles.quickLink} onPress={() => goTo(route)}>
      <Ionicons name={icon} size={22} color={COLORS.red} />
      <Text style={styles.quickText}>{label}</Text>
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
  title: { color: "#FFFFFF", fontSize: 32, fontWeight: "900", marginBottom: 10 },
  subtitle: { color: "#D1D5DB", lineHeight: 22, fontWeight: "700" },
  carrierCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
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
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  carrierName: { color: COLORS.text, fontSize: 19, fontWeight: "900" },
  carrierEmail: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
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
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: { color: COLORS.text, fontSize: 22, fontWeight: "900", marginTop: 7 },
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
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900", marginBottom: 12 },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  typeButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  typeButtonActive: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },
  typeText: { color: COLORS.text, fontWeight: "900" },
  typeTextActive: { color: "#FFFFFF" },
  label: { color: COLORS.text, fontWeight: "900", marginBottom: 7, marginTop: 8 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    color: COLORS.text,
    fontWeight: "700",
    marginBottom: 12,
  },
  textArea: { minHeight: 110 },
  primaryButtonInner: {
    backgroundColor: COLORS.red,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  messageCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  messageIcon: {
    width: 46,
    height: 46,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  messageTitle: { color: COLORS.text, fontSize: 17, fontWeight: "900" },
  messageSub: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  messageBody: { color: COLORS.text, fontWeight: "700", lineHeight: 20, marginTop: 5 },
  unreadDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: COLORS.red,
  },
  loadCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  loadIcon: {
    width: 46,
    height: 46,
    borderRadius: 18,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  loadTitle: { color: COLORS.text, fontSize: 17, fontWeight: "900" },
  loadSub: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  loadMeta: {
    color: COLORS.text,
    fontWeight: "700",
    marginTop: 4,
    textTransform: "capitalize",
  },
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