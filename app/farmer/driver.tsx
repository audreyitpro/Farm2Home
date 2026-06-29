// app/farmer/driver-chat.tsx

import React, { useEffect, useMemo, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../services/supabaseClient";

const COLORS = {
  bg: "#F6F8F2",
  card: "#FFFFFF",
  text: "#162115",
  muted: "#667085",
  border: "#E3E8DD",
  green: "#1FA463",
  greenDark: "#0B5D35",
  greenSoft: "#E9F8EF",
  dark: "#111827",
  white: "#FFFFFF",
  orangeSoft: "#FFF3DE",
};

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

  const [farmerId, setFarmerId] = useState("");
  const [farmName, setFarmName] = useState("Farm2Home Farm");

  const [driverId, setDriverId] = useState(driverIdParam || "");
  const [driverName, setDriverName] = useState("Assigned Driver");

  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    initialize();
  }, []);

  const chatTitle = useMemo(() => {
    if (orderId) return `Order #${orderId.slice(-8)}`;
    if (deliveryOrderId) return `Delivery #${deliveryOrderId.slice(-8)}`;
    return "General Driver Coordination";
  }, [orderId, deliveryOrderId]);

  async function initialize() {
    try {
      setLoading(true);

      const saved =
        (await AsyncStorage.getItem("currentFarmer")) ||
        (await AsyncStorage.getItem("farm2homeCurrentFarmer")) ||
        (await AsyncStorage.getItem("farm2homeFarmerSession")) ||
        (await AsyncStorage.getItem("currentUser"));

      if (!saved) {
        router.replace("/farmer/login" as any);
        return;
      }

      const farmer = JSON.parse(saved);
      const id = farmer.id || farmer.farmerId || farmer.farmer_id || farmer.profile_id;

      if (!id) {
        router.replace("/farmer/login" as any);
        return;
      }

      setFarmerId(id);
      setFarmName(
        farmer.farmName ||
          farmer.farm_name ||
          farmer.businessName ||
          farmer.business_name ||
          "Farm2Home Farm"
      );

      const activeDriver = await resolveDriver(id);
      setDriverId(activeDriver.id);
      setDriverName(activeDriver.name);

      await loadMessages(id, activeDriver.id);
    } catch (error: any) {
      Alert.alert("Chat Error", error?.message || "Unable to load driver chat.");
    } finally {
      setLoading(false);
    }
  }

  async function resolveDriver(activeFarmerId: string) {
    if (driverIdParam) {
      return { id: driverIdParam, name: "Assigned Driver" };
    }

    if (deliveryOrderId) {
      const { data } = await supabase
        .from("delivery_orders")
        .select("*")
        .eq("id", deliveryOrderId)
        .maybeSingle();

      const id = data?.driver_id || data?.assigned_driver_id || "";
      const name = data?.driver_name || data?.assigned_driver_name || "Assigned Driver";

      if (id) return { id, name };
    }

    if (orderId) {
      const { data } = await supabase
        .from("delivery_orders")
        .select("*")
        .eq("order_id", orderId)
        .eq("farmer_id", activeFarmerId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const id = data?.driver_id || data?.assigned_driver_id || "";
      const name = data?.driver_name || data?.assigned_driver_name || "Assigned Driver";

      if (id) return { id, name };
    }

    const { data: internalDriver } = await supabase
      .from("farmer_internal_drivers")
      .select("*")
      .eq("farmer_id", activeFarmerId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      id: internalDriver?.driver_id || internalDriver?.id || "internal-driver",
      name: internalDriver?.driver_name || "Internal Farm Driver",
    };
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

      const payload = {
        order_id: orderId || "general",
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
        created_at: new Date().toISOString(),
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

  function openTracking() {
    router.push({
      pathname: "/customer/order-tracking",
      params: {
        orderId,
        deliveryOrderId,
      },
    } as any);
  }

  function openAssignedDrivers() {
    router.push("/farmer/assigned-drivers" as any);
  }

  function openDeliveryOrders() {
    router.push("/farmer/delivery-orders" as any);
  }

  function quickMessage(text: string) {
    setMessage(text);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.green} />
          <Text style={styles.centerText}>Loading driver coordination...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back-outline" size={22} color={COLORS.text} />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Farmer Delivery Operations</Text>
            <Text style={styles.title}>Driver Chat</Text>
            <Text style={styles.subtitle}>
              {farmName} · {chatTitle}
            </Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.driverIcon}>
            <Ionicons name="car-outline" size={26} color={COLORS.white} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.heroBadge}>Assigned Driver</Text>
            <Text style={styles.driverName}>{driverName}</Text>
            <Text style={styles.heroSub}>
              Coordinate pickup, route changes, delivery proof, and customer updates.
            </Text>
          </View>
        </View>

        <View style={styles.contextCard}>
          <InfoPill label="Driver" value={driverId || "Not assigned"} />
          <InfoPill label="Delivery" value={deliveryOrderId || "Not linked"} />
          <InfoPill label="Order" value={orderId || "General"} />
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.actionButton} onPress={openTracking}>
            <Ionicons name="navigate-outline" size={16} color={COLORS.greenDark} />
            <Text style={styles.actionText}>Track</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={openAssignedDrivers}>
            <Ionicons name="people-outline" size={16} color={COLORS.greenDark} />
            <Text style={styles.actionText}>Drivers</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={openDeliveryOrders}>
            <Ionicons name="cube-outline" size={16} color={COLORS.greenDark} />
            <Text style={styles.actionText}>Orders</Text>
          </Pressable>
        </View>

        <View style={styles.quickRow}>
          <Pressable
            style={styles.quickChip}
            onPress={() => quickMessage("Please confirm pickup time and location.")}
          >
            <Text style={styles.quickText}>Confirm pickup</Text>
          </Pressable>

          <Pressable
            style={styles.quickChip}
            onPress={() => quickMessage("Please send an update when the order is out for delivery.")}
          >
            <Text style={styles.quickText}>Out for delivery</Text>
          </Pressable>

          <Pressable
            style={styles.quickChip}
            onPress={() => quickMessage("Please upload proof of delivery once completed.")}
          >
            <Text style={styles.quickText}>Proof needed</Text>
          </Pressable>
        </View>

        <FlatList
          data={messages}
          keyExtractor={(item, index) => String(item.id || `${item.created_at}_${index}`)}
          contentContainerStyle={styles.messageList}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyText}>
                Start the delivery conversation with the assigned driver.
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
            placeholder="Message the assigned driver..."
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
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Ionicons name="send-outline" size={20} color={COLORS.white} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoPill}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  keyboard: { flex: 1, backgroundColor: COLORS.bg },

  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  centerText: { color: COLORS.muted, marginTop: 10, fontWeight: "800" },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    color: COLORS.green,
    fontWeight: "900",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: { color: COLORS.text, fontSize: 24, fontWeight: "900", marginTop: 2 },
  subtitle: { color: COLORS.muted, fontWeight: "700", fontSize: 12, marginTop: 2 },

  heroCard: {
    backgroundColor: COLORS.greenDark,
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  driverIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroBadge: {
    color: "#BBF7D0",
    fontWeight: "900",
    fontSize: 11,
    textTransform: "uppercase",
  },
  driverName: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 20,
    marginTop: 3,
  },
  heroSub: {
    color: "#DCFCE7",
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 4,
  },

  contextCard: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    gap: 8,
  },
  infoPill: {
    backgroundColor: COLORS.greenSoft,
    borderRadius: 14,
    padding: 10,
  },
  infoLabel: {
    color: COLORS.greenDark,
    fontWeight: "900",
    fontSize: 11,
    textTransform: "uppercase",
  },
  infoValue: {
    color: COLORS.text,
    fontWeight: "800",
    marginTop: 3,
  },

  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  actionText: {
    color: COLORS.greenDark,
    fontWeight: "900",
    fontSize: 12,
  },

  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
  },
  quickChip: {
    backgroundColor: COLORS.orangeSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickText: {
    color: "#92400E",
    fontWeight: "900",
    fontSize: 12,
  },

  messageList: { padding: 16, paddingBottom: 100 },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 22,
    alignItems: "center",
  },
  emptyEmoji: { fontSize: 38 },
  emptyTitle: { color: COLORS.text, fontWeight: "900", fontSize: 18, marginTop: 8 },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },

  bubble: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    maxWidth: "84%",
  },
  myBubble: {
    alignSelf: "flex-end",
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
  },
  sender: { color: COLORS.muted, fontSize: 11, fontWeight: "900" },
  mySender: { color: "#DDF8C8" },
  messageText: {
    color: COLORS.text,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 4,
  },
  myMessageText: { color: COLORS.white },
  timeText: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 6,
    fontWeight: "700",
  },
  myTimeText: { color: "#DDF8C8" },

  inputBar: {
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 12,
    flexDirection: "row",
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 110,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 10,
    color: COLORS.text,
    fontWeight: "800",
  },
  sendButton: {
    width: 48,
    borderRadius: 16,
    backgroundColor: COLORS.green,
    justifyContent: "center",
    alignItems: "center",
  },
  disabledButton: { opacity: 0.65 },
});