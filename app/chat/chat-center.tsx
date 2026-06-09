// app/driver/chat-center.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import { supabase } from "../data/supabaseClient";

type ChatMessage = {
  id: string;
  conversation_id: string;
  order_id?: string | null;
  load_id?: string | null;
  delivery_order_id?: string | null;
  sender_id?: string | null;
  sender_role: string;
  sender_name: string;
  sender_email?: string | null;
  message: string;
  created_at: string;
};

type CurrentUser = {
  id?: string;
  email?: string;
  username?: string;
  fullName?: string;
  name?: string;
  companyName?: string;
  farmName?: string;
  businessName?: string;
  role?: string;
};

const COLORS = {
  bg: "#F8FAF5",
  card: "#FFFFFF",
  text: "#172017",
  muted: "#64748B",
  border: "#E3E8DD",
  primary: "#2E7D32",
  primaryDark: "#14532D",
  soft: "#EEF5EA",
  dark: "#111827",
  blue: "#2563EB",
};

function cleanString(value: any) {
  return String(value || "").trim();
}

function getParamString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function buildConversationId(params: any) {
  const directId = cleanString(params.conversationId);
  const orderId = cleanString(params.orderId);
  const loadId = cleanString(params.loadId);
  const deliveryOrderId = cleanString(params.deliveryOrderId || params.deliveryJobId);
  const role = cleanString(params.role).toLowerCase();

  if (directId) return directId;
  if (deliveryOrderId) return `delivery_${deliveryOrderId}`;
  if (orderId) return `order_${orderId}`;
  if (loadId) return `load_${loadId}`;
  if (role) return `support_${role}`;

  return "farm2home_driver_support";
}

async function getStoredJson(key: string) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function formatRole(role: string) {
  const value = String(role || "USER").toLowerCase();

  if (value === "customer") return "Customer";
  if (value === "farmer") return "Farmer";
  if (value === "driver") return "Driver";
  if (value === "freight") return "Freight";
  if (value === "admin") return "Admin";

  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function DriverChatCenter() {
  const params = useLocalSearchParams();

  const conversationId = useMemo(() => buildConversationId(params), [params]);
  const orderId = getParamString(params.orderId);
  const loadId = getParamString(params.loadId);
  const deliveryOrderId = getParamString(params.deliveryOrderId || params.deliveryJobId);
  const roleParam = getParamString(params.role) || "driver";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");

  const [senderId, setSenderId] = useState<string | null>(null);
  const [senderName, setSenderName] = useState("Farm2Home Driver");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderRole, setSenderRole] = useState(roleParam.toUpperCase());

  const [sending, setSending] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadCurrentUser();
      loadMessages();

      const channel = supabase
        .channel(`driver-chat-${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "chat_messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          () => {
            loadMessages();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [conversationId])
  );

  async function loadCurrentUser() {
    try {
      const role =
        roleParam ||
        (await AsyncStorage.getItem("currentUserRole")) ||
        (await AsyncStorage.getItem("userRole")) ||
        "driver";

      const currentUser: CurrentUser =
        (await getStoredJson("currentDriver")) ||
        (await getStoredJson("farm2homeCurrentDriver")) ||
        (await getStoredJson("farm2homeDriverSession")) ||
        (await getStoredJson("currentUser")) ||
        {};

      const displayName =
        currentUser.fullName ||
        currentUser.name ||
        currentUser.companyName ||
        currentUser.farmName ||
        currentUser.businessName ||
        currentUser.username ||
        currentUser.email ||
        "Farm2Home Driver";

      setSenderId(currentUser.id || currentUser.email || null);
      setSenderEmail(currentUser.email || "");
      setSenderName(displayName);
      setSenderRole(String(role || "driver").toUpperCase());
    } catch (error) {
      console.log("LOAD_DRIVER_CHAT_USER_ERROR:", error);
    }
  }

  async function loadMessages() {
    try {
      setMessagesLoading(true);

      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) {
        console.log("LOAD_DRIVER_CHAT_MESSAGES_ERROR:", error.message);
        return;
      }

      setMessages((data || []) as ChatMessage[]);
    } catch (error) {
      console.log("LOAD_DRIVER_CHAT_MESSAGES_FAILED:", error);
    } finally {
      setMessagesLoading(false);
    }
  }

  async function sendMessage() {
    const cleanMessage = message.trim();
    if (!cleanMessage) return;

    try {
      setSending(true);

      const payload = {
        conversation_id: conversationId,
        order_id: orderId || null,
        load_id: loadId || null,
        delivery_order_id: deliveryOrderId || null,
        sender_id: senderId,
        sender_role: senderRole,
        sender_name: senderName,
        sender_email: senderEmail || null,
        message: cleanMessage,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("chat_messages").insert(payload);

      if (error) {
        Alert.alert("Message Error", error.message);
        return;
      }

      setMessage("");
      await loadMessages();
    } catch (error: any) {
      Alert.alert("Message Error", error?.message || "Unable to send message.");
    } finally {
      setSending(false);
    }
  }

  function isMine(item: ChatMessage) {
    if (item.sender_id && senderId) return item.sender_id === senderId;

    return (
      !!item.sender_email &&
      !!senderEmail &&
      item.sender_email.toLowerCase() === senderEmail.toLowerCase()
    );
  }

  function openTracking() {
    router.push({
      pathname: "/customer/order-tracking",
      params: {
        orderId,
        loadId,
        deliveryOrderId,
      },
    } as any);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Farm2Driver Messaging</Text>
            <Text style={styles.title}>Chat Center</Text>
            <Text style={styles.subtitle}>
              Driver communication for customer orders, farmer pickups, freight loads,
              and support.
            </Text>
          </View>
        </View>

        <View style={styles.metaGrid}>
          <MetaChip label="Conversation" value={conversationId} />
          <MetaChip label="Role" value={formatRole(senderRole)} />
          {!!orderId && <MetaChip label="Order" value={orderId} />}
          {!!deliveryOrderId && <MetaChip label="Delivery" value={deliveryOrderId} />}
          {!!loadId && <MetaChip label="Load" value={loadId} />}
        </View>

        <View style={styles.headerActions}>
          <Pressable style={styles.refreshButton} onPress={loadMessages}>
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>

          {(orderId || deliveryOrderId || loadId) && (
            <Pressable style={styles.trackButton} onPress={openTracking}>
              <Text style={styles.trackText}>Track</Text>
            </Pressable>
          )}
        </View>
      </View>

      {messagesLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={COLORS.primaryDark} />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item, index) => String(item.id || `${item.created_at}_${index}`)}
          contentContainerStyle={styles.messageList}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyText}>
                Start the conversation for this order, delivery, freight load, or support
                request.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const mine = isMine(item);

            return (
              <View
                style={[
                  styles.messageBubble,
                  mine ? styles.myMessage : styles.otherMessage,
                ]}
              >
                <Text style={[styles.sender, mine && styles.mySender]}>
                  {item.sender_name || "Farm2Home User"} · {formatRole(item.sender_role)}
                </Text>

                <Text style={[styles.messageText, mine && styles.myMessageText]}>
                  {item.message}
                </Text>

                <Text style={[styles.timeText, mine && styles.myTimeText]}>
                  {item.created_at ? new Date(item.created_at).toLocaleString() : ""}
                </Text>
              </View>
            );
          }}
        />
      )}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#8A8F98"
          value={message}
          onChangeText={setMessage}
          multiline
        />

        <Pressable
          style={[styles.sendButton, sending && styles.disabledButton]}
          onPress={sendMessage}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.sendText}>Send</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaChip}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    backgroundColor: COLORS.primaryDark,
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.dark,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
    marginTop: -4,
  },
  eyebrow: {
    color: "#BBF7D0",
    fontWeight: "900",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 3,
  },
  subtitle: {
    color: "#E8F5E9",
    lineHeight: 20,
    fontWeight: "700",
    fontSize: 12,
    marginTop: 2,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  metaChip: {
    backgroundColor: "rgba(255,255,255,0.13)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: "100%",
  },
  metaLabel: {
    color: "#BBF7D0",
    fontWeight: "900",
    fontSize: 10,
    textTransform: "uppercase",
  },
  metaValue: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 11,
    marginTop: 2,
    maxWidth: 230,
  },
  headerActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  refreshButton: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
  },
  refreshText: { color: COLORS.primaryDark, fontWeight: "900" },
  trackButton: {
    backgroundColor: COLORS.dark,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
  },
  trackText: { color: "#FFFFFF", fontWeight: "900" },
  loadingBox: { padding: 24, alignItems: "center" },
  loadingText: { marginTop: 10, color: COLORS.primaryDark, fontWeight: "900" },
  messageList: { padding: 16, paddingBottom: 120 },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 6,
  },
  emptyText: {
    color: COLORS.muted,
    lineHeight: 22,
    fontWeight: "700",
  },
  messageBubble: {
    maxWidth: "86%",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  myMessage: {
    backgroundColor: COLORS.primaryDark,
    alignSelf: "flex-end",
    borderTopRightRadius: 4,
  },
  otherMessage: {
    backgroundColor: COLORS.card,
    alignSelf: "flex-start",
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sender: {
    color: COLORS.primaryDark,
    fontWeight: "900",
    marginBottom: 6,
    fontSize: 12,
  },
  mySender: { color: "#DFF5E5" },
  messageText: {
    color: COLORS.text,
    fontWeight: "700",
    lineHeight: 21,
    fontSize: 15,
  },
  myMessageText: { color: "#FFFFFF" },
  timeText: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 8,
    fontWeight: "700",
  },
  myTimeText: { color: "#DFF5E5" },
  composer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.dark,
    fontWeight: "700",
  },
  sendButton: {
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 16,
    minWidth: 76,
    alignItems: "center",
  },
  disabledButton: { opacity: 0.6 },
  sendText: { color: "#FFFFFF", fontWeight: "900" },
});