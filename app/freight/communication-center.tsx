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

const ROUTES = {
  dashboard: "/freight/dashboard",
  board: "/freight/board",
  myLoads: "/freight/my-loads",
  liveLoads: "/freight/live-loads",
  loadChat: "/freight/load-chat",
  dispatchAlerts: "/freight/dispatch-alerts",
  notifications: "/freight/notifications",
  support: "/freight/support",
  reviewStatus: "/freight/review-status",
  loadIssues: "/freight/load-issues",
  routeExceptions: "/freight/route-exceptions",
  login: "/freight/login",
  register: "/freight/register",
} as const;

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

  const [selectedType, setSelectedType] = useState("Dispatch");
  const [subject, setSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadCommunicationCenter();
    }, [])
  );

  const stats = useMemo(() => {
    const unreadMessages = messages.filter((item) => !item.read_at && !item.is_read).length;
    const activeAlerts = alerts.filter((item) =>
      ["new", "active", "unread", "pending"].includes(normalize(item.status || item.type))
    ).length;
    const activeLoads = loads.filter((item) =>
      ["accepted", "booked", "picked_up", "in_transit", "arrived_pickup"].includes(
        normalize(item.status)
      )
    ).length;

    return {
      messages: messages.length,
      unreadMessages,
      activeAlerts,
      activeLoads,
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

  async function loadCommunicationCenter() {
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

      if (error) console.log("Communication center carrier error:", error.message);

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

      const { data: messageData } = await supabase
        .from("freight_messages")
        .select("*")
        .or(`freight_id.eq.${mergedCarrier.id},carrier_id.eq.${mergedCarrier.id},sender_id.eq.${mergedCarrier.id}`)
        .order("created_at", { ascending: false });

      setMessages(Array.isArray(messageData) ? messageData : []);

      const { data: alertData } = await supabase
        .from("freight_notifications")
        .select("*")
        .or(`freight_id.eq.${mergedCarrier.id},freight_user_id.eq.${mergedCarrier.id},user_id.eq.${mergedCarrier.id}`)
        .order("created_at", { ascending: false });

      setAlerts(Array.isArray(alertData) ? alertData : []);

      const { data: loadData } = await supabase
        .from("freight_loads")
        .select("*")
        .or(
          `carrier_id.eq.${mergedCarrier.id},freight_user_id.eq.${mergedCarrier.id},driver_id.eq.${mergedCarrier.id},accepted_by.eq.${mergedCarrier.id}`
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
        message_type: selectedType,
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

      Alert.alert("Message Sent", "Your freight message was sent.");
      await loadCommunicationCenter();
    } catch (error: any) {
      Alert.alert("Send Error", error?.message || "Unable to send message.");
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
      // keep stable if schema differs
    }
  }

  function openLoadChat(load: any) {
    router.push({
      pathname: ROUTES.loadChat as any,
      params: { loadId: load.id },
    });
  }

  function renderMessage({ item }: { item: any }) {
    const unread = !item.read_at && !item.is_read;
    const type = item.message_type || item.type || "Message";

    return (
      <TouchableOpacity style={styles.chatRow} onPress={() => markMessageRead(item)}>
        <View style={[styles.chatAvatar, unread && styles.chatAvatarUnread]}>
          <Ionicons name="chatbubble-ellipses-outline" size={22} color="#FFFFFF" />
        </View>

        <View style={styles.chatContent}>
          <View style={styles.chatTop}>
            <Text style={styles.chatTitle} numberOfLines={1}>
              {item.subject || item.title || "Freight Message"}
            </Text>
            <Text style={styles.chatTime}>{formatDate(item.created_at)}</Text>
          </View>

          <Text style={styles.chatType}>{type}</Text>

          <Text style={styles.chatPreview} numberOfLines={2}>
            {item.body || item.message || item.content || "No message details."}
          </Text>
        </View>

        {unread ? <View style={styles.unreadDot} /> : null}
      </TouchableOpacity>
    );
  }

  function renderLoadChat({ item }: { item: any }) {
    return (
      <TouchableOpacity style={styles.loadChatRow} onPress={() => openLoadChat(item)}>
        <View style={styles.loadIcon}>
          <Ionicons name="cube-outline" size={21} color="#FFFFFF" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.loadTitle} numberOfLines={1}>
            {item.title || item.commodity || "Freight Load Chat"}
          </Text>
          <Text style={styles.loadSub} numberOfLines={1}>
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
            <Text style={styles.eyebrow}>Farm2Home Freight</Text>
            <Text style={styles.title}>Messages</Text>
            <Text style={styles.subtitle}>
              Dispatch, farmer/broker chat, support, alerts, and load conversations in one
              ChatAI-style carrier inbox.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(ROUTES.notifications)}>
            <Ionicons name="notifications-outline" size={28} color="#FFFFFF" />
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

          <View style={styles.onlinePill}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Online</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Messages" value={String(stats.messages)} icon="chatbubble-outline" />
          <StatCard label="Unread" value={String(stats.unreadMessages)} icon="mail-unread-outline" />
          <StatCard label="Alerts" value={String(stats.activeAlerts)} icon="notifications-outline" />
          <StatCard label="Active Loads" value={String(stats.activeLoads)} icon="cube-outline" />
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="grid-outline" label="Dashboard" route={ROUTES.dashboard} />
          <QuickLink icon="search-outline" label="Load Board" route={ROUTES.board} />
          <QuickLink icon="briefcase-outline" label="My Loads" route={ROUTES.myLoads} />
          <QuickLink icon="pulse-outline" label="Live Loads" route={ROUTES.liveLoads} />
          <QuickLink icon="megaphone-outline" label="Dispatch Alerts" route={ROUTES.dispatchAlerts} />
          <QuickLink icon="headset-outline" label="Support" route={ROUTES.support} />
        </View>

        <View style={styles.composeCard}>
          <View style={styles.composeTop}>
            <Text style={styles.cardTitle}>New Message</Text>
            <Ionicons name="create-outline" size={22} color={COLORS.red} />
          </View>

          <View style={styles.typeRow}>
            {["Dispatch", "Support", "Review", "Load Issue"].map((type) => {
              const active = selectedType === type;

              return (
                <TouchableOpacity
                  key={type}
                  style={active ? styles.typeButtonActive : styles.typeButton}
                  onPress={() => setSelectedType(type)}
                >
                  <Text style={active ? styles.typeTextActive : styles.typeText}>{type}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Subject</Text>
          <TextInput
            style={styles.input}
            value={subject}
            onChangeText={setSubject}
            placeholder="Enter subject"
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.label}>Message</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={messageBody}
            onChangeText={setMessageBody}
            placeholder="Type your freight message..."
            placeholderTextColor="#94A3B8"
            multiline
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.sendButton, sending && styles.disabledButton]}
            onPress={sendMessage}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="send-outline" size={18} color="#FFFFFF" />
                <Text style={styles.sendText}>Send Message</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Load Conversations</Text>
          <TouchableOpacity onPress={() => goTo(ROUTES.myLoads)}>
            <Text style={styles.sectionLink}>View all</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={loads.slice(0, 6)}
          keyExtractor={(item, index) => String(item.id || index)}
          scrollEnabled={false}
          renderItem={renderLoadChat}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              title="No load chats yet"
              message="Booked and active loads will appear here for freight chat."
            />
          }
        />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Inbox</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Text style={styles.sectionLink}>Refresh</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={messages.slice(0, 12)}
          keyExtractor={(item, index) => String(item.id || index)}
          scrollEnabled={false}
          renderItem={renderMessage}
          ListEmptyComponent={
            <EmptyState
              icon="mail-outline"
              title="No messages yet"
              message="Dispatch, support, review, and load messages will appear here."
            />
          }
        />

        <TouchableOpacity style={styles.primaryButton} onPress={() => goTo(ROUTES.support)}>
          <Ionicons name="headset-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Open Support</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.darkButton} onPress={() => goTo(ROUTES.dispatchAlerts)}>
          <Ionicons name="megaphone-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>View Dispatch Alerts</Text>
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
  onlinePill: {
    backgroundColor: "#DCFCE7",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: COLORS.green,
  },
  onlineText: { color: COLORS.green, fontWeight: "900", fontSize: 12 },
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
  composeCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  composeTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900", marginBottom: 12 },
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
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  typeText: { color: COLORS.text, fontWeight: "900" },
  typeTextActive: { color: "#FFFFFF", fontWeight: "900" },
  label: { color: COLORS.text, fontWeight: "900", marginBottom: 7, marginTop: 8 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    color: COLORS.text,
    fontWeight: "700",
    marginBottom: 12,
  },
  textArea: { minHeight: 110 },
  sendButton: {
    backgroundColor: COLORS.red,
    borderRadius: 16,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  sendText: { color: "#FFFFFF", fontWeight: "900" },
  disabledButton: { opacity: 0.6 },
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
  chatRow: {
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
  chatAvatar: {
    width: 48,
    height: 48,
    borderRadius: 19,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
  },
  chatAvatarUnread: {
    backgroundColor: COLORS.red,
  },
  chatContent: { flex: 1 },
  chatTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  chatTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
  },
  chatTime: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  chatType: {
    color: COLORS.red,
    fontWeight: "900",
    fontSize: 12,
    marginTop: 4,
  },
  chatPreview: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 5,
  },
  unreadDot: {
    width: 11,
    height: 11,
    borderRadius: 999,
    backgroundColor: COLORS.red,
  },
  loadChatRow: {
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
  primaryText: { color: "#FFFFFF", fontWeight: "900" },
});