// app/driver/farmer-chat.tsx

import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

export default function DriverFarmerChatScreen() {
  const params = useLocalSearchParams();

  const orderId = getParamString(params.orderId);
  const deliveryOrderId = getParamString(params.deliveryOrderId || params.deliveryJobId);
  const farmerId = getParamString(params.farmerId);
  const customerId = getParamString(params.customerId);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [driver, setDriver] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (!driver?.id) return;

    const channel = supabase
      .channel(`driver-farmer-chat-${deliveryOrderId || orderId || driver.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "order_chats",
        },
        () => {
          loadMessages(driver.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driver?.id, orderId, deliveryOrderId]);

  async function initialize() {
    try {
      setLoading(true);

      const currentDriver = await getCurrentDriver();

      if (!currentDriver?.id) {
        router.replace("/driver/login" as any);
        return;
      }

      setDriver(currentDriver);
      await loadMessages(currentDriver.id);
    } catch (error: any) {
      Alert.alert("Chat Error", error?.message || "Unable to load chat.");
    } finally {
      setLoading(false);
    }
  }

  async function getCurrentDriver() {
    const raw =
      (await AsyncStorage.getItem("currentDriver")) ||
      (await AsyncStorage.getItem("farm2homeCurrentDriver")) ||
      (await AsyncStorage.getItem("farm2homeDriverSession")) ||
      (await AsyncStorage.getItem("currentUser"));

    let stored: any = null;

    if (raw) {
      try {
        stored = JSON.parse(raw);
      } catch {
        stored = null;
      }
    }

    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;

    const stableId =
      authUser?.id ||
      stored?.authUserId ||
      stored?.id ||
      stored?.driverId ||
      "";

    if (!stableId) return null;

    const currentDriver = {
      ...(stored || {}),
      id: stableId,
      driverId: stableId,
      role: "driver",
      fullName:
        stored?.fullName ||
        stored?.name ||
        stored?.username ||
        "Farm2Home Driver",
      name:
        stored?.name ||
        stored?.fullName ||
        stored?.username ||
        "Farm2Home Driver",
      email: normalize(authUser?.email || stored?.email || ""),
    };

    await AsyncStorage.setItem("currentDriver", JSON.stringify(currentDriver));
    await AsyncStorage.setItem("currentUser", JSON.stringify(currentDriver));
    await AsyncStorage.setItem("userRole", "driver");
    await AsyncStorage.setItem("currentUserRole", "driver");

    return currentDriver;
  }

  async function loadMessages(driverId: string) {
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
      query = query.eq("driver_id", driverId);
    }

    const { data, error } = await query;

    if (error) {
      console.log("Driver farmer chat load skipped:", error.message);
      setMessages([]);
      return;
    }

    setMessages(Array.isArray(data) ? data : []);
  }

  async function sendMessage() {
    const cleanMessage = message.trim();

    if (!cleanMessage) return;

    if (!driver?.id) {
      Alert.alert("Driver Login Required", "Please login again.");
      return;
    }

    try {
      setSending(true);

      const payload = {
        order_id: orderId || deliveryOrderId || "general",
        delivery_order_id: deliveryOrderId || null,
        farmer_id: farmerId || null,
        customer_id: customerId || null,
        driver_id: driver.id,
        sender_role: "driver",
        sender_id: driver.id,
        sender_context: "farmer_driver",
        message: cleanMessage,
        read_by_farmer: false,
        read_by_driver: true,
        read_by_customer: true,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("order_chats").insert(payload);

      if (error) throw error;

      setMessage("");
      await loadMessages(driver.id);
    } catch (error: any) {
      Alert.alert("Send Error", error?.message || "Unable to send message.");
    } finally {
      setSending(false);
    }
  }

  function senderLabel(item: any) {
    const role = normalize(item.sender_role);

    if (role === "driver") return "Driver";
    if (role === "farmer") return "Farmer";
    if (role === "customer") return "Customer";
    if (role === "admin") return "Support";

    return "Farm2Home";
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#020617" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.centerText}>Loading farmer chat...</Text>
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
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Driver Communications</Text>
            <Text style={styles.title}>Farmer Chat</Text>
            <Text style={styles.subtitle}>
              Coordinate pickup timing, farm notes, substitutions, and delivery readiness.
            </Text>
          </View>
        </View>

        <View style={styles.metaBar}>
          <Text style={styles.metaText}>
            {deliveryOrderId
              ? `Delivery #${deliveryOrderId}`
              : orderId
              ? `Order #${orderId}`
              : "General farmer pickup chat"}
          </Text>

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => driver?.id && loadMessages(driver.id)}
          >
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={messages}
          keyExtractor={(item, index) => String(item.id || `${item.created_at}_${index}`)}
          contentContainerStyle={styles.messageList}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyText}>
                Farmer pickup messages and delivery notes will appear here.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isDriver = normalize(item.sender_role) === "driver";

            return (
              <View style={[styles.bubble, isDriver && styles.myBubble]}>
                <Text style={[styles.sender, isDriver && styles.mySender]}>
                  {senderLabel(item)}
                </Text>

                <Text style={[styles.messageText, isDriver && styles.myMessageText]}>
                  {item.message}
                </Text>

                <Text style={[styles.timeText, isDriver && styles.myTimeText]}>
                  {item.created_at ? new Date(item.created_at).toLocaleString() : ""}
                </Text>
              </View>
            );
          }}
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Type farmer message..."
            placeholderTextColor="#94A3B8"
            value={message}
            onChangeText={setMessage}
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
              <Text style={styles.sendText}>Send</Text>
            )}
          </TouchableOpacity>
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
  metaBar: {
    backgroundColor: freightTheme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: freightTheme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  metaText: {
    flex: 1,
    color: freightTheme.colors.text,
    fontWeight: "900",
  },
  refreshButton: {
    backgroundColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  refreshText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },
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