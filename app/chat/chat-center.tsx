import React, { useCallback, useEffect, useState } from "react";
import {
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
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import { supabase, getCurrentUser } from "../services/supabaseClient";

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

export default function ChatCenter() {
  const params = useLocalSearchParams();

  const conversationId =
    String(params.conversationId || "") || "farm2home_general_support";

  const orderId = String(params.orderId || "");
  const loadId = String(params.loadId || "");
  const roleParam = String(params.role || "");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");

  const [senderId, setSenderId] = useState<string | null>(null);
  const [senderName, setSenderName] = useState("Farm2Home User");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderRole, setSenderRole] = useState(
    roleParam ? roleParam.toUpperCase() : "CUSTOMER"
  );

  const [loading, setLoading] = useState(false);

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
      const user = await getCurrentUser();

      if (user) {
        setSenderId(user.id);
        setSenderEmail(user.email || "");
        setSenderName(
          user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email ||
            "Farm2Home User"
        );
      }

      if (roleParam) {
        setSenderRole(roleParam.toUpperCase());
      }
    } catch (error) {
      console.log("LOAD_CHAT_USER_ERROR:", error);
    }
  }

  async function loadMessages() {
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
  }

  async function sendMessage() {
    if (!message.trim()) return;

    try {
      setLoading(true);

      const { error } = await supabase.from("chat_messages").insert({
        conversation_id: conversationId,
        order_id: orderId || null,
        load_id: loadId || null,
        sender_id: senderId,
        sender_role: senderRole,
        sender_name: senderName,
        sender_email: senderEmail || null,
        message: message.trim(),
        created_at: new Date().toISOString(),
      });

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

        <Text style={styles.meta}>
          Conversation: {conversationId}
        </Text>

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

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No messages yet.</Text>
            <Text style={styles.emptyText}>
              Start the conversation for this order, load, route, or support request.
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
          <Text style={styles.sendText}>{loading ? "..." : "Send"}</Text>
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
  },
  disabledButton: {
    opacity: 0.6,
  },
  sendText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});