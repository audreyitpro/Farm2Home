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

const FREIGHT_ROUTES = {
  communicationCenter: "/freight/communication-center",
  managementCenter: "/freight/freight-management-center",
  myLoads: "/freight/my-loads",
  dispatchCenter: "/freight/dispatch-center",
  routeExceptions: "/freight/route-exceptions",
  support: "/freight/support",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];

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

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

export default function FreightLoadChatScreen() {
  const params = useLocalSearchParams();
  const loadId = String(params.loadId || "");

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
      dispatchCount: messages.filter((m) => normalize(m.sender_role) === "dispatch").length,
      farmerCount: messages.filter((m) => normalize(m.sender_role) === "farmer").length,
      customerCount: messages.filter((m) => normalize(m.sender_role) === "customer").length,
    };
  }, [messages]);

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

  async function loadChat() {
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

      if (carrierError) console.log("Load chat carrier error:", carrierError.message);

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
        .neq("sender_id", mergedCarrier.id);
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
        sender_name: carrier.companyName || carrier.businessName || "Freight Carrier",
        message: messageBody.trim(),
        body: messageBody.trim(),
        status: "sent",
        is_read: false,
        created_at: now,
        updated_at: now,
      });

      if (error) throw error;

      setMessageBody("");
      await loadChat();
    } catch (error: any) {
      Alert.alert(
        "Send Error",
        error?.message ||
          "Unable to send load chat message. Make sure freight_load_messages table exists."
      );
    } finally {
      setSending(false);
    }
  }

  function sendQuickMessage(text: string) {
    setMessageBody(text);
  }

  function isMine(item: any) {
    return (
      String(item.sender_id || "") === String(carrier?.id || "") ||
      normalize(item.sender_role) === "freight"
    );
  }

  function roleColor(role: any) {
    const value = normalize(role);
    if (value === "dispatch") return COLORS.blue;
    if (value === "farmer") return COLORS.green;
    if (value === "customer") return COLORS.amber;
    if (value === "freight") return COLORS.red;
    return COLORS.black;
  }

  function renderMessage({ item }: { item: any }) {
    const mine = isMine(item);
    const role = item.sender_role || "message";

    return (
      <View style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowOther]}>
        <View style={[styles.messageBubble, mine ? styles.messageBubbleMine : styles.messageBubbleOther]}>
          <View style={styles.messageMetaRow}>
            <View style={[styles.roleDot, { backgroundColor: roleColor(role) }]} />
            <Text style={[styles.messageRole, mine && styles.messageRoleMine]}>
              {item.sender_name || String(role).replace(/_/g, " ")}
            </Text>
          </View>

          <Text style={[styles.messageText, mine && styles.messageTextMine]}>
            {item.message || item.body || item.content || ""}
          </Text>

          <Text style={[styles.messageTime, mine && styles.messageTimeMine]}>
            {formatDate(item.created_at)}
          </Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading load chat...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.hero}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => goTo(FREIGHT_ROUTES.communicationCenter)}
          >
            <Ionicons name="chevron-back-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Load Chat</Text>
            <Text style={styles.title}>{load?.title || load?.commodity || "Freight Load"}</Text>
            <Text style={styles.subtitle}>
              {(load?.pickup_location || load?.origin || "Pickup") +
                " → " +
                (load?.dropoff_location || load?.destination || "Dropoff")}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.heroIcon}
            onPress={() => goTo(FREIGHT_ROUTES.dispatchCenter)}
          >
            <Ionicons name="chatbubbles-outline" size={28} color="#FFFFFF" />
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
              <Text style={styles.loadTitle}>
                {load?.title || load?.commodity || "Load Details"}
              </Text>
              <Text style={styles.loadSub}>
                Status: {String(load?.status || "load").replace(/_/g, " ")}
              </Text>
              <Text style={styles.loadSub}>
                Broker/Dispatch: {load?.broker || load?.dispatcher_name || "Farm2Home Dispatch"}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.issueButton}
              onPress={() => goTo(FREIGHT_ROUTES.routeExceptions)}
            >
              <Ionicons name="warning-outline" size={18} color={COLORS.red} />
              <Text style={styles.issueText}>Issue</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statsGrid}>
            <StatCard label="Messages" value={String(stats.total)} icon="chatbubble-outline" />
            <StatCard label="Dispatch" value={String(stats.dispatchCount)} icon="navigate-outline" />
            <StatCard label="Farmer" value={String(stats.farmerCount)} icon="leaf-outline" />
            <StatCard label="Customer" value={String(stats.customerCount)} icon="person-outline" />
          </View>

          <View style={styles.quickRow}>
            <QuickButton text="Arrived at pickup." onPress={sendQuickMessage} />
            <QuickButton text="Load picked up and in transit." onPress={sendQuickMessage} />
            <QuickButton text="Running behind schedule." onPress={sendQuickMessage} />
            <QuickButton text="Delivery completed." onPress={sendQuickMessage} />
          </View>

          <Text style={styles.sectionTitle}>Messages</Text>

          <FlatList
            data={messages}
            keyExtractor={(item, index) => String(item.id || index)}
            scrollEnabled={false}
            renderItem={renderMessage}
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Ionicons name="chatbubbles-outline" size={38} color={COLORS.red} />
                <Text style={styles.emptyTitle}>No messages yet.</Text>
                <Text style={styles.emptyText}>
                  Start the load chat with dispatch, farmer, or customer updates.
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

          <TouchableOpacity
            style={[styles.sendButton, sending && styles.disabledButton]}
            onPress={sendMessage}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Ionicons name="send-outline" size={22} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
      <Ionicons name={icon} size={20} color={COLORS.red} />
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  keyboard: { flex: 1 },
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
    paddingTop: 22,
    paddingHorizontal: 18,
    paddingBottom: 22,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    color: "#FCA5A5",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
    marginBottom: 4,
  },
  title: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
  subtitle: { color: "#D1D5DB", fontWeight: "700", marginTop: 4 },
  body: { flex: 1 },
  bodyContent: { paddingBottom: 20 },
  loadCard: {
    backgroundColor: COLORS.card,
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
  loadSub: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 4,
    textTransform: "capitalize",
  },
  issueButton: {
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  issueText: { color: COLORS.red, fontWeight: "900" },
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
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: { color: COLORS.text, fontSize: 20, fontWeight: "900", marginTop: 6 },
  statLabel: { color: COLORS.muted, fontWeight: "800", marginTop: 3 },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  quickButton: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  quickButtonText: { color: COLORS.text, fontWeight: "900", fontSize: 12 },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  messageRow: { paddingHorizontal: 18, marginBottom: 12 },
  messageRowMine: { alignItems: "flex-end" },
  messageRowOther: { alignItems: "flex-start" },
  messageBubble: {
    maxWidth: "86%",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
  },
  messageBubbleMine: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },
  messageBubbleOther: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
  },
  messageMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 6,
  },
  roleDot: { width: 8, height: 8, borderRadius: 999 },
  messageRole: {
    color: COLORS.muted,
    fontWeight: "900",
    textTransform: "capitalize",
    fontSize: 12,
  },
  messageRoleMine: { color: "#FEE2E2" },
  messageText: { color: COLORS.text, fontWeight: "700", lineHeight: 20 },
  messageTextMine: { color: "#FFFFFF" },
  messageTime: {
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 11,
    marginTop: 8,
  },
  messageTimeMine: { color: "#FEE2E2" },
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
  composer: {
    backgroundColor: COLORS.card,
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
    backgroundColor: COLORS.surface,
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
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: { opacity: 0.6 },
});