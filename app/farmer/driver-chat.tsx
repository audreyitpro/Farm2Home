// app/farmer/driver-chat.tsx

import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";

import { supabase } from "../services/supabaseClient";
import freightTheme from "../styles/freightTheme";

function getParamString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

export default function FarmerDriverChatScreen() {
  const params = useLocalSearchParams();

  const orderId = getParamString(params.orderId);
  const deliveryOrderId = getParamString(params.deliveryOrderId || params.deliveryJobId);
  const driverIdParam = getParamString(params.driverId);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [farmer, setFarmer] = useState<any>(null);
  const [farmerId, setFarmerId] = useState("");
  const [driverId, setDriverId] = useState(driverIdParam || "");
  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    initialize();
  }, []);

  async function initialize() {
    try {
      setLoading(true);

      const saved =
        (await AsyncStorage.getItem("currentFarmer")) ||
        (await AsyncStorage.getItem("currentUser"));

      if (!saved) {
        router.replace("/farmer/login" as any);
        return;
      }

      const parsed = JSON.parse(saved);
      const id = parsed.id || parsed.farmerId;

      if (!id) {
        router.replace("/farmer/login" as any);
        return;
      }

      setFarmer(parsed);
      setFarmerId(id);

      let activeDriverId = driverIdParam;

      if (!activeDriverId) {
        const { data: delivery } = await supabase
          .from("delivery_orders")
          .select("*")
          .eq("farmer_id", id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        activeDriverId =
          delivery?.driver_id ||
          delivery?.assigned_driver_id ||
          "internal-driver";
      }

      setDriverId(activeDriverId);
      await loadMessages(id, activeDriverId);
    } catch (error: any) {
      Alert.alert("Chat Error", error?.message || "Unable to load driver chat.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(activeFarmerId = farmerId, activeDriverId = driverId) {
    let query = supabase
      .from("order_chats")
      .select("*")
      .eq("sender_context", "farmer_driver")
      .order("created_at", { ascending: true });

    if (deliveryOrderId) {
      query = query.eq("delivery_order_id", deliveryOrderId);
    } else if (orderId) {
      query = query.eq("order_id", orderId);
    } else {
      query = query.eq("farmer_id", activeFarmerId);
    }

    const { data, error } = await query;

    if (error) {
      console.log("Farmer driver chat load skipped:", error.message);
      setMessages([]);
      return;
    }

    setMessages(Array.isArray(data) ? data : []);
  }

  async function sendMessage() {
    if (!message.trim()) return;

    if (!farmerId) {
      Alert.alert("Session Error", "Please login again.");
      return;
    }

    try {
      setSending(true);

      const now = new Date().toISOString();

      const payload = {
        order_id: orderId || deliveryOrderId || "general",
        delivery_order_id: deliveryOrderId || null,
        farmer_id: farmerId,
        driver_id: driverId || null,
        sender_role: "farmer",
        sender_id: farmerId,
        sender_context: "farmer_driver",
        message: message.trim(),
        read_by_farmer: true,
        read_by_driver: false,
        read_by_customer: true,
        created_at: now,
      };

      const { error } = await supabase.from("order_chats").insert(payload);

      if (error) throw error;

      setMessage("");
      await loadMessages(farmerId, driverId);
    } catch (error: any) {
      Alert.alert("Send Error", error?.message || "Unable to send message.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#020617" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.centerText}>Loading driver chat...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Farmer Operations</Text>
            <Text style={styles.title}>Driver Chat</Text>
            <Text style={styles.subtitle}>
              Coordinate pickup, loading, timing, and delivery details
            </Text>
          </View>
        </View>

        <FlatList
          data={messages}
          keyExtractor={(item, index) => String(item.id || `${item.created_at}_${index}`)}
          contentContainerStyle={styles.messageList}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyText}>
                Start a conversation with the assigned driver.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isFarmer = item.sender_role === "farmer";

            return (
              <View style={[styles.bubble, isFarmer && styles.myBubble]}>
                <Text style={[styles.sender, isFarmer && styles.mySender]}>
                  {isFarmer ? "Farmer" : "Driver"}
                </Text>

                <Text style={[styles.messageText, isFarmer && styles.myMessageText]}>
                  {item.message}
                </Text>

                <Text style={[styles.timeText, isFarmer && styles.myTimeText]}>
                  {item.created_at ? new Date(item.created_at).toLocaleString() : ""}
                </Text>
              </View>
            );
          }}
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Type driver message..."
            placeholderTextColor="#94A3B8"
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: freightTheme.colors.background },
  keyboard: { flex: 1, backgroundColor: freightTheme.colors.background },
  center: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  centerText: { color: "#CBD5E1", marginTop: 10, fontWeight: "800" },
  header: {
    backgroundColor: "#020617",
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: { color: "#FFFFFF", fontSize: 28, fontWeight: "900", marginTop: -4 },
  eyebrow: {
    color: "#10B981",
    fontWeight: "900",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: { color: "#FFFFFF", fontSize: 22, fontWeight: "900", marginTop: 3 },
  subtitle: { color: "#CBD5E1", fontWeight: "700", fontSize: 12, marginTop: 2 },
  messageList: { padding: 16, paddingBottom: 100 },
  emptyCard: {
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  emptyTitle: { color: freightTheme.colors.text, fontWeight: "900", fontSize: 18 },
  emptyText: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
  },
  bubble: {
    alignSelf: "flex-start",
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    maxWidth: "84%",
  },
  myBubble: {
    alignSelf: "flex-end",
    backgroundColor: freightTheme.colors.primary,
    borderColor: freightTheme.colors.primary,
  },
  sender: { color: freightTheme.colors.mutedText, fontSize: 11, fontWeight: "900" },
  mySender: { color: "#BBF7D0" },
  messageText: {
    color: freightTheme.colors.text,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 4,
  },
  myMessageText: { color: "#FFFFFF" },
  timeText: {
    color: freightTheme.colors.mutedText,
    fontSize: 10,
    marginTop: 6,
    fontWeight: "700",
  },
  myTimeText: { color: "#D1FAE5" },
  inputBar: {
    backgroundColor: freightTheme.colors.card,
    borderTopWidth: 1,
    borderTopColor: freightTheme.colors.border,
    padding: 12,
    flexDirection: "row",
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#111827",
    fontWeight: "700",
  },
  sendButton: {
    backgroundColor: freightTheme.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  sendText: { color: "#FFFFFF", fontWeight: "900" },
  disabledButton: { opacity: 0.65 },
});