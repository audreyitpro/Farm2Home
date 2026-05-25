import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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

function cleanString(value: any) {
  return String(value || "").trim();
}

function buildConversationId(params: any) {
  const directId = cleanString(params.conversationId);
  const orderId = cleanString(params.orderId);
  const loadId = cleanString(params.loadId);
  const role = cleanString(params.role).toLowerCase();

  if (directId) return directId;
  if (orderId) return `order_${orderId}`;
  if (loadId) return `load_${loadId}`;
  if (role) return `support_${role}`;

  return "farm2home_general_support";
}

async function getStoredJson(key: string) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function ChatCenter() {
  const params = useLocalSearchParams();

  const conversationId = buildConversationId(params);
  const orderId = cleanString(params.orderId);
  const loadId = cleanString(params.loadId);
  const roleParam = cleanString(params.role);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");

  const [senderId, setSenderId] = useState<string | null>(null);
  const [senderName, setSenderName] = useState("Farm2Home User");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderRole, setSenderRole] = useState(
    roleParam ? roleParam.toUpperCase() : "CUSTOMER"
  );

  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadCurrentUser();
      loadMessages();

      const channel = supabase
        .channel(`chat-${conversationId}`)
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
        "customer";

      const currentUser: CurrentUser =
        (await getStoredJson("currentUser")) ||
        (await getStoredJson("currentCustomer")) ||
        (await getStoredJson("currentFarmer")) ||
        (await getStoredJson("currentFreight")) ||
        (await getStoredJson("currentFreightCarrier")) ||
        (await getStoredJson("currentDriver")) ||
        {};

      const displayName =
        currentUser.fullName ||
        currentUser.name ||
        currentUser.companyName ||
        currentUser.farmName ||
        currentUser.businessName ||
        currentUser.username ||
        currentUser.email ||
        "Farm2Home User";

      setSenderId(currentUser.id || currentUser.email || null);
      setSenderEmail(currentUser.email || "");
      setSenderName(displayName);
      setSenderRole(String(role || "customer").toUpperCase());
    } catch (error) {
      console.log("LOAD_CHAT_USER_ERROR:", error);
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
        console.log("LOAD_CHAT_MESSAGES_ERROR:", error.message);
        return;
      }

      setMessages((data || []) as ChatMessage[]);
    } catch (error) {
      console.log("LOAD_CHAT_MESSAGES_FAILED:", error);
    } finally {
      setMessagesLoading(false);
    }
  }

  async function sendMessage() {
    const cleanMessage = message.trim();

    if (!cleanMessage) return;

    try {
      setLoading(true);

      const payload = {
        conversation_id: conversationId,
        order_id: orderId || null,
        load_id: loadId || null,
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
      setLoading(false);
    }
  }

  function isMine(item: ChatMessage) {
    if (item.sender_id && senderId) {
      return item.sender_id === senderId;
    }

    return (
      item.sender_email &&
      senderEmail &&
      item.sender_email.toLowerCase() === senderEmail.toLowerCase()
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Farm2Home Chat</Text>

        <Text style={styles.subtitle}>
          Realtime messages for customers, farmers, drivers, freight carriers,
          and admin support.
        </Text>

        <Text style={styles.meta}>Conversation: {conversationId}</Text>
        <Text style={styles.meta}>Role: {senderRole}</Text>

        {orderId ? <Text style={styles.meta}>Order ID: {orderId}</Text> : null}
        {loadId ? <Text style={styles.meta}>Load ID: {loadId}</Text> : null}

        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.refreshButton} onPress={loadMessages}>
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>

      {messagesLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#064E3B" />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No messages yet.</Text>
              <Text style={styles.emptyText}>
                Start the conversation for this order, load, route, or support
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
                  {item.sender_name} · {item.sender_role}
                </Text>

                <Text style={[styles.messageText, mine && styles.myMessageText]}>
                  {item.message}
                </Text>

                <Text style={[styles.timeText, mine && styles.myTimeText]}>
                  {new Date(item.created_at).toLocaleString()}
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

        <TouchableOpacity
          style={[styles.sendButton, loading && styles.disabledButton]}
          onPress={sendMessage}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.sendText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7F2",
  },
  header: {
    backgroundColor: "#064E3B",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
    marginBottom: 6,
  },
  subtitle: {
    color: "#E8F5E9",
    lineHeight: 22,
    fontWeight: "700",
  },
  meta: {
    color: "#BBF7D0",
    fontWeight: "800",
    marginTop: 6,
    fontSize: 12,
  },
  headerButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  backButton: {
    backgroundColor: "#111827",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
  },
  backText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  refreshButton: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
  },
  refreshText: {
    color: "#064E3B",
    fontWeight: "900",
  },
  loadingBox: {
    padding: 24,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#064E3B",
    fontWeight: "900",
  },
  messageList: {
    padding: 16,
    paddingBottom: 120,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  emptyTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 6,
  },
  emptyText: {
    color: "#6B7280",
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
    backgroundColor: "#064E3B",
    alignSelf: "flex-end",
    borderTopRightRadius: 4,
  },
  otherMessage: {
    backgroundColor: "#FFFFFF",
    alignSelf: "flex-start",
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  sender: {
    color: "#064E3B",
    fontWeight: "900",
    marginBottom: 6,
    fontSize: 12,
  },
  mySender: {
    color: "#DFF5E5",
  },
  messageText: {
    color: "#111827",
    fontWeight: "700",
    lineHeight: 21,
    fontSize: 15,
  },
  myMessageText: {
    color: "#FFFFFF",
  },
  timeText: {
    color: "#6B7280",
    fontSize: 11,
    marginTop: 8,
    fontWeight: "700",
  },
  myTimeText: {
    color: "#DFF5E5",
  },
  composer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#D1D5DB",
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
    color: "#111827",
    fontWeight: "700",
  },
  sendButton: {
    backgroundColor: "#064E3B",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 16,
    minWidth: 76,
    alignItems: "center",
  },
  disabledButton: {
    opacity: 0.6,
  },
  sendText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});