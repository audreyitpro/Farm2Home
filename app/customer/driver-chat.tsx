// app/customer/driver-chat.tsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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

/**
 * app/customer/driver-chat.tsx
 *
 * Customer <-> Driver chat.
 *
 * Supports:
 * - Order-specific driver conversation
 * - Supabase realtime
 * - ETA / gate code / delivery notes quick replies
 * - Message timestamps
 * - Read receipt fields
 * - Photo URL attachment
 * - Driver job lookup from delivery tables
 *
 * Tables attempted:
 * - customer_driver_messages
 * - driver_messages
 * - delivery_messages
 * - messages
 * - chat_messages
 *
 * Recommended dedicated table:
 *
 * customer_driver_messages:
 * id text primary key
 * conversation_id text
 * order_id text
 * customer_id text
 * customer_name text
 * driver_id text
 * driver_name text
 * sender_id text
 * sender_role text
 * sender_name text
 * receiver_id text
 * receiver_role text
 * message text
 * image_url text
 * read_by_customer boolean
 * read_by_driver boolean
 * created_at timestamptz
 * updated_at timestamptz
 */

const COLORS = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  redDark: "#9F1117",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  greenDark: "#14532D",
  greenSoft: "#DCFCE7",
  amber: "#F59E0B",
  amberSoft: "#FEF3C7",
  blue: "#2563EB",
  blueSoft: "#DBEAFE",
  purple: "#7C3AED",
  purpleSoft: "#EDE9FE",
  white: "#FFFFFF",
};

type CustomerSession = {
  id?: string;
  customerId?: string;
  customer_id?: string;
  full_name?: string;
  fullName?: string;
  name?: string;
  email?: string;
  phone?: string;
};

type DriverConversation = {
  conversationId: string;
  orderId: string;
  driverId: string;
  driverName: string;
  status?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  currentLocation?: string;
  eta?: string;
  lastMessage?: string;
  unreadCount?: number;
};

type ChatMessage = {
  id: string;
  conversation_id: string;
  order_id?: string;
  customer_id?: string;
  customer_name?: string;
  driver_id?: string;
  driver_name?: string;
  sender_id: string;
  sender_role: "customer" | "driver" | string;
  sender_name?: string;
  receiver_id?: string;
  receiver_role?: string;
  message: string;
  image_url?: string;
  read_by_customer?: boolean;
  read_by_driver?: boolean;
  created_at: string;
  updated_at?: string;
};

const QUICK_REPLIES = [
  "What is your ETA?",
  "Gate code is: ",
  "Please leave it at the front door.",
  "Please call when you arrive.",
  "Apartment/unit number is: ",
  "Thank you!",
];

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function getCustomerId(customer: CustomerSession | null) {
  return clean(customer?.id || customer?.customer_id || customer?.customerId);
}

function getCustomerName(customer: CustomerSession | null) {
  return clean(customer?.full_name || customer?.fullName || customer?.name || "Customer");
}

function dateTimeLabel(value: any) {
  const raw = clean(value);
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildConversationId(orderId: string, customerId: string, driverId: string) {
  const safeOrder = clean(orderId) || "general";
  const safeCustomer = clean(customerId) || "customer";
  const safeDriver = clean(driverId) || "driver";
  return `customer_driver_${safeOrder}_${safeCustomer}_${safeDriver}`;
}

function getOrderId(row: any) {
  return clean(row?.id || row?.order_id || row?.orderId);
}

function prettyStatus(value: any) {
  const status = clean(value || "Pending").replace(/_/g, " ");
  return status
    .split(" ")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export default function CustomerDriverChat() {
  const params = useLocalSearchParams();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const channelRef = useRef<any>(null);

  const [customer, setCustomer] = useState<CustomerSession | null>(null);
  const [conversations, setConversations] = useState<DriverConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<DriverConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const paramOrderId = clean(params?.orderId || params?.order_id);
  const paramDriverId = clean(params?.driverId || params?.driver_id);
  const paramDriverName = clean(params?.driverName || params?.driver_name);

  const customerId = getCustomerId(customer);
  const customerName = getCustomerName(customer);

  const activeConversationId = useMemo(() => {
    return selectedConversation?.conversationId || "";
  }, [selectedConversation]);

  useFocusEffect(
    useCallback(() => {
      loadScreen();

      return () => {
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
      };
    }, [paramOrderId, paramDriverId, paramDriverName])
  );

  useEffect(() => {
    if (!activeConversationId) return;

    loadMessages(activeConversationId);
    subscribeToConversation(activeConversationId);
    markMessagesRead(activeConversationId);
  }, [activeConversationId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }, [messages.length]);

  async function loadScreen() {
    try {
      setLoading(true);
      const activeCustomer = await loadCustomer();
      const nextConversations = await loadConversations(activeCustomer);
      setConversations(nextConversations);

      const preferred =
        nextConversations.find((item) => paramDriverId && item.driverId === paramDriverId) ||
        nextConversations[0] ||
        null;

      setSelectedConversation(preferred);
    } finally {
      setLoading(false);
    }
  }

  async function loadCustomer() {
    const stored =
      (await AsyncStorage.getItem("currentCustomer")) ||
      (await AsyncStorage.getItem("farm2homeCurrentCustomer")) ||
      (await AsyncStorage.getItem("currentUser"));

    let localCustomer: CustomerSession | null = null;

    if (stored) {
      try {
        localCustomer = JSON.parse(stored);
        setCustomer(localCustomer);
      } catch {
        localCustomer = null;
      }
    }

    const { data: authData } = await supabase.auth.getUser();
    const authId = clean(authData?.user?.id || "");
    const authEmail = normalize(authData?.user?.email || localCustomer?.email || "");

    if (!authId && !authEmail) return localCustomer;

    const dbCustomer = await fetchCustomer(authId, authEmail);

    if (dbCustomer) {
      const session = {
        ...dbCustomer,
        customerId: dbCustomer.id,
        accountId: dbCustomer.account_id,
      };

      setCustomer(session);

      await AsyncStorage.multiSet([
        ["currentCustomer", JSON.stringify(session)],
        ["farm2homeCurrentCustomer", JSON.stringify(session)],
        ["currentUser", JSON.stringify({ ...session, role: "customer" })],
      ]);

      return session;
    }

    return localCustomer;
  }

  async function fetchCustomer(id?: string, email?: string) {
    const lookupId = clean(id);
    const lookupEmail = normalize(email);

    if (lookupId) {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .or(`id.eq.${lookupId},auth_user_id.eq.${lookupId},profile_id.eq.${lookupId}`)
        .limit(1);

      if (!error && Array.isArray(data) && data[0]) return data[0];
    }

    if (lookupEmail) {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("email", lookupEmail)
        .limit(1);

      if (!error && Array.isArray(data) && data[0]) return data[0];
    }

    return null;
  }

  async function loadConversations(activeCustomer: CustomerSession | null) {
    const id = getCustomerId(activeCustomer);
    const rows: DriverConversation[] = [];

    if (paramDriverId || paramDriverName) {
      rows.push({
        conversationId: buildConversationId(paramOrderId, id, paramDriverId),
        orderId: paramOrderId,
        driverId: paramDriverId,
        driverName: paramDriverName || "Farm2Home Driver",
        status: "Active",
      });
    }

    if (paramOrderId) {
      const fromJobs = await loadDriverConversationsFromJobs(paramOrderId, activeCustomer);
      rows.push(...fromJobs);
    }

    if (id) {
      const fromMessages = await loadExistingConversationsFromMessages(id);
      rows.push(...fromMessages);
    }

    const unique = Array.from(
      new Map(rows.map((item) => [item.conversationId, item])).values()
    );

    return unique.length > 0
      ? unique
      : [
          {
            conversationId: buildConversationId(paramOrderId || "general", id, ""),
            orderId: paramOrderId || "general",
            driverId: "",
            driverName: "Farm2Home Driver",
            status: "Waiting for driver assignment",
          },
        ];
  }

  async function loadDriverConversationsFromJobs(orderId: string, activeCustomer: CustomerSession | null) {
    const customerIdValue = getCustomerId(activeCustomer);
    const rows: DriverConversation[] = [];
    const jobs = await fetchDeliveryJobs(orderId);

    jobs.forEach((job: any) => {
      const driverId = clean(job.driver_id || job.driverId);
      const driverName = clean(job.driver_name || job.driverName || "Farm2Home Driver");

      rows.push({
        conversationId: buildConversationId(orderId, customerIdValue, driverId),
        orderId,
        driverId,
        driverName,
        status: clean(job.status || "Assigned"),
        pickupAddress: clean(job.pickup_address || job.pickupAddress),
        dropoffAddress: clean(job.dropoff_address || job.dropoffAddress),
        currentLocation: clean(job.current_location || job.currentLocation),
        eta: clean(job.eta || job.estimated_arrival || job.estimatedArrival),
      });
    });

    return rows;
  }

  async function fetchDeliveryJobs(orderId: string) {
    const tables = [
      "delivery_jobs",
      "driver_jobs",
      "deliveries",
      "customer_deliveries",
      "tracking",
      "order_tracking",
    ];

    const allJobs: any[] = [];

    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .or(`order_id.eq.${orderId},orderId.eq.${orderId}`)
          .limit(100);

        if (!error && Array.isArray(data)) allJobs.push(...data);
      } catch {
        // try next
      }
    }

    return Array.from(
      new Map(
        allJobs.map((job) => [
          clean(job.id || `${job.order_id || job.orderId}_${job.driver_id || job.driverId}`),
          job,
        ])
      ).values()
    );
  }

  async function loadExistingConversationsFromMessages(customerIdValue: string) {
    const tables = ["customer_driver_messages", "driver_messages", "delivery_messages", "messages", "chat_messages"];
    const found: DriverConversation[] = [];

    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .eq("customer_id", customerIdValue)
          .order("created_at", { ascending: false })
          .limit(100);

        if (!error && Array.isArray(data)) {
          data.forEach((row: any) => {
            const driverId = clean(row.driver_id || row.driverId);
            const driverName = clean(row.driver_name || row.driverName || "Farm2Home Driver");
            const orderId = clean(row.order_id || row.orderId || "general");
            const conversationId =
              clean(row.conversation_id || row.conversationId) ||
              buildConversationId(orderId, customerIdValue, driverId);

            found.push({
              conversationId,
              orderId,
              driverId,
              driverName,
              lastMessage: clean(row.message),
              unreadCount: row.sender_role === "driver" && !row.read_by_customer ? 1 : 0,
              status: "Active",
            });
          });

          break;
        }
      } catch {
        // try next
      }
    }

    return found;
  }

  async function queryMessages(table: string, conversationId: string) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(300);

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  async function loadMessages(conversationId: string) {
    const tables = ["customer_driver_messages", "driver_messages", "delivery_messages", "messages", "chat_messages"];

    for (const table of tables) {
      try {
        const rows = await queryMessages(table, conversationId);
        setMessages(rows.map(normalizeMessage));
        return;
      } catch {
        // try next
      }
    }

    setMessages([]);
  }

  function normalizeMessage(row: any): ChatMessage {
    return {
      ...row,
      id: clean(row.id || `msg_${Date.now()}_${Math.random()}`),
      conversation_id: clean(row.conversation_id || row.conversationId || activeConversationId),
      order_id: clean(row.order_id || row.orderId || selectedConversation?.orderId),
      customer_id: clean(row.customer_id || row.customerId || customerId),
      customer_name: clean(row.customer_name || row.customerName || customerName),
      driver_id: clean(row.driver_id || row.driverId || selectedConversation?.driverId),
      driver_name: clean(row.driver_name || row.driverName || selectedConversation?.driverName),
      sender_id: clean(row.sender_id || row.senderId),
      sender_role: clean(row.sender_role || row.senderRole || "customer"),
      sender_name: clean(row.sender_name || row.senderName),
      receiver_id: clean(row.receiver_id || row.receiverId),
      receiver_role: clean(row.receiver_role || row.receiverRole),
      message: clean(row.message || row.text || ""),
      image_url: clean(row.image_url || row.imageUrl),
      read_by_customer: Boolean(row.read_by_customer),
      read_by_driver: Boolean(row.read_by_driver),
      created_at: clean(row.created_at || row.createdAt || nowIso()),
      updated_at: clean(row.updated_at || row.updatedAt || row.created_at || nowIso()),
    };
  }

  function subscribeToConversation(conversationId: string) {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`customer_driver_chat_${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "customer_driver_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const incoming = normalizeMessage(payload.new);
          setMessages((prev) => {
            if (prev.some((item) => item.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
        }
      )
      .subscribe();

    channelRef.current = channel;
  }

  async function insertMessage(table: string, payload: any) {
    const { data, error } = await supabase.from(table).insert(payload).select("*").maybeSingle();
    if (error) throw error;
    return data || payload;
  }

  async function sendMessage(textOverride?: string) {
    const text = clean(textOverride || messageText);

    if (!selectedConversation) {
      Alert.alert("No Conversation", "Select a driver conversation first.");
      return;
    }

    if (!text && !imageUrl.trim()) {
      Alert.alert("Message Required", "Type a message or paste an image URL.");
      return;
    }

    if (!customerId) {
      Alert.alert("Login Required", "Customer account was not found.");
      return;
    }

    const payload: ChatMessage = {
      id: `msg_${Date.now()}`,
      conversation_id: selectedConversation.conversationId,
      order_id: selectedConversation.orderId,
      customer_id: customerId,
      customer_name: customerName,
      driver_id: selectedConversation.driverId,
      driver_name: selectedConversation.driverName,
      sender_id: customerId,
      sender_role: "customer",
      sender_name: customerName,
      receiver_id: selectedConversation.driverId,
      receiver_role: "driver",
      message: text,
      image_url: clean(imageUrl),
      read_by_customer: true,
      read_by_driver: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    try {
      setSending(true);

      const tables = ["customer_driver_messages", "driver_messages", "delivery_messages", "messages", "chat_messages"];
      let saved: any = null;

      for (const table of tables) {
        try {
          saved = await insertMessage(table, payload);
          break;
        } catch (error) {
          console.log(`${table} insert skipped:`, error);
        }
      }

      const finalMessage = normalizeMessage(saved || payload);

      setMessages((prev) => {
        if (prev.some((item) => item.id === finalMessage.id)) return prev;
        return [...prev, finalMessage];
      });

      setMessageText("");
      setImageUrl("");
    } catch (error: any) {
      Alert.alert("Send Error", error?.message || "Unable to send message.");
    } finally {
      setSending(false);
    }
  }

  async function markMessagesRead(conversationId: string) {
    const tables = ["customer_driver_messages", "driver_messages", "delivery_messages", "messages", "chat_messages"];

    for (const table of tables) {
      try {
        await supabase
          .from(table)
          .update({
            read_by_customer: true,
            updated_at: nowIso(),
          })
          .eq("conversation_id", conversationId)
          .eq("receiver_role", "customer");
      } catch {
        // skip
      }
    }
  }

  function openOrderDetails() {
    if (!selectedConversation?.orderId || selectedConversation.orderId === "general") return;

    router.push({
      pathname: "/customer/order-detail" as any,
      params: { orderId: selectedConversation.orderId },
    });
  }

  function openTracking() {
    if (!selectedConversation?.orderId || selectedConversation.orderId === "general") return;

    router.push({
      pathname: "/customer/tracking" as any,
      params: { orderId: selectedConversation.orderId },
    });
  }

  function renderHeader() {
    return (
      <View>
        <View style={styles.hero}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push("/customer/my-orders" as any)}
            activeOpacity={0.9}
          >
            <Ionicons name="arrow-back-outline" size={18} color={COLORS.white} />
            <Text style={styles.backButtonText}>My Orders</Text>
          </TouchableOpacity>

          <View style={styles.heroIcon}>
            <Ionicons name="car-outline" size={34} color={COLORS.white} />
          </View>

          <Text style={styles.kicker}>Customer ↔ Driver</Text>
          <Text style={styles.heroTitle}>Driver Chat</Text>
          <Text style={styles.heroText}>
            Coordinate ETA, gate codes, delivery location, proof of delivery, and live delivery questions.
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.conversationRow}>
          {conversations.map((conversation) => {
            const active = conversation.conversationId === selectedConversation?.conversationId;

            return (
              <Pressable
                key={conversation.conversationId}
                style={[styles.conversationChip, active && styles.conversationChipActive]}
                onPress={() => setSelectedConversation(conversation)}
              >
                <View style={[styles.conversationAvatar, active && styles.conversationAvatarActive]}>
                  <Ionicons name="car-outline" size={19} color={active ? COLORS.white : COLORS.red} />
                </View>
                <View style={{ maxWidth: 190 }}>
                  <Text style={[styles.conversationName, active && styles.conversationNameActive]} numberOfLines={1}>
                    {conversation.driverName || "Farm2Home Driver"}
                  </Text>
                  <Text style={[styles.conversationMeta, active && styles.conversationMetaActive]} numberOfLines={1}>
                    {conversation.orderId && conversation.orderId !== "general"
                      ? `Order #${conversation.orderId.slice(-8).toUpperCase()}`
                      : "General delivery chat"}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {selectedConversation ? (
          <View style={styles.driverInfoCard}>
            <View style={styles.driverBigAvatar}>
              <Ionicons name="person-outline" size={30} color={COLORS.white} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.driverTitle}>{selectedConversation.driverName || "Farm2Home Driver"}</Text>
              <Text style={styles.driverSubtitle}>
                {selectedConversation.driverId
                  ? `Driver ID: ${selectedConversation.driverId}`
                  : "Waiting for assigned driver"}
              </Text>
              <Text style={styles.driverSubtitle}>
                Status: {prettyStatus(selectedConversation.status || "Active")}
              </Text>
              {selectedConversation.eta ? (
                <Text style={styles.etaText}>ETA: {selectedConversation.eta}</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.deliveryInfoCard}>
          <InfoRow icon="storefront-outline" label="Pickup" value={selectedConversation?.pickupAddress || "Farm pickup location"} />
          <InfoRow icon="location-outline" label="Dropoff" value={selectedConversation?.dropoffAddress || "Customer delivery address"} />
          <InfoRow icon="navigate-outline" label="Current Location" value={selectedConversation?.currentLocation || "Waiting for driver update"} />
        </View>

        <View style={styles.quickActions}>
          <Pressable style={styles.quickActionButton} onPress={openOrderDetails}>
            <Ionicons name="document-text-outline" size={17} color={COLORS.red} />
            <Text style={styles.quickActionText}>Order Details</Text>
          </Pressable>

          <Pressable style={styles.quickActionButton} onPress={openTracking}>
            <Ionicons name="navigate-outline" size={17} color={COLORS.red} />
            <Text style={styles.quickActionText}>Tracking</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickReplyRow}>
          {QUICK_REPLIES.map((reply) => (
            <Pressable key={reply} style={styles.quickReply} onPress={() => sendMessage(reply)}>
              <Text style={styles.quickReplyText}>{reply}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  }

  function renderMessage({ item }: { item: ChatMessage }) {
    const mine = item.sender_role === "customer" || item.sender_id === customerId;

    return (
      <View style={[styles.messageRow, mine ? styles.myMessageRow : styles.theirMessageRow]}>
        <View style={[styles.messageBubble, mine ? styles.myBubble : styles.theirBubble]}>
          <Text style={[styles.senderLabel, mine ? styles.mySenderLabel : styles.theirSenderLabel]}>
            {mine ? "You" : item.sender_name || selectedConversation?.driverName || "Driver"}
          </Text>

          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.messageImage} />
          ) : null}

          {item.message ? (
            <Text style={[styles.messageText, mine ? styles.myMessageText : styles.theirMessageText]}>
              {item.message}
            </Text>
          ) : null}

          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, mine ? styles.myMessageTime : styles.theirMessageTime]}>
              {dateTimeLabel(item.created_at)}
            </Text>

            {mine ? (
              <Text style={styles.readReceipt}>{item.read_by_driver ? "Read" : "Sent"}</Text>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.red} size="large" />
          <Text style={styles.centerText}>Loading driver chat...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 78 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Ionicons name="chatbubble-ellipses-outline" size={34} color={COLORS.red} />
              </View>
              <Text style={styles.emptyTitle}>Start the delivery chat</Text>
              <Text style={styles.emptyText}>
                Message the driver about ETA, gate code, dropoff notes, or proof of delivery.
              </Text>
            </View>
          }
        />

        <View style={styles.composerWrap}>
          {imageUrl ? (
            <View style={styles.imageUrlPreview}>
              <Ionicons name="image-outline" size={16} color={COLORS.red} />
              <Text style={styles.imageUrlText} numberOfLines={1}>{imageUrl}</Text>
              <Pressable onPress={() => setImageUrl("")}>
                <Ionicons name="close-circle-outline" size={18} color={COLORS.muted} />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.composer}>
            <Pressable
              style={styles.attachButton}
              onPress={() =>
                Alert.prompt
                  ? Alert.prompt("Image URL", "Paste an image URL to attach.", setImageUrl)
                  : Alert.alert("Attach Photo", "Paste an image URL into the optional image field feature.")
              }
            >
              <Ionicons name="image-outline" size={20} color={COLORS.red} />
            </Pressable>

            <TextInput
              style={styles.messageInput}
              placeholder="Message driver..."
              placeholderTextColor="#94A3B8"
              value={messageText}
              onChangeText={setMessageText}
              multiline
            />

            <Pressable
              style={[styles.sendButton, sending && styles.disabledButton]}
              onPress={() => sendMessage()}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Ionicons name="send-outline" size={19} color={COLORS.white} />
              )}
            </Pressable>
          </View>

          <TextInput
            style={styles.hiddenImageInput}
            placeholder="Optional image URL"
            value={imageUrl}
            onChangeText={setImageUrl}
            autoCapitalize="none"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={17} color={COLORS.red} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  keyboard: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  centerText: { color: COLORS.muted, fontWeight: "800" },
  listContent: { paddingBottom: 12 },
  hero: {
    backgroundColor: COLORS.black,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
  },
  backButton: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.red,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 18,
  },
  backButtonText: { color: COLORS.white, fontWeight: "900" },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  kicker: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroTitle: { color: COLORS.white, fontSize: 34, fontWeight: "900", marginTop: 6 },
  heroText: { color: "#CBD5E1", fontWeight: "700", lineHeight: 22, marginTop: 8 },
  conversationRow: { gap: 10, paddingHorizontal: 18, paddingVertical: 14 },
  conversationChip: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 10,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  conversationChipActive: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  conversationAvatar: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  conversationAvatarActive: { backgroundColor: "rgba(255,255,255,0.18)" },
  conversationName: { color: COLORS.text, fontWeight: "900" },
  conversationNameActive: { color: COLORS.white },
  conversationMeta: { color: COLORS.muted, fontWeight: "700", fontSize: 12, marginTop: 3 },
  conversationMetaActive: { color: "#FFE4E6" },
  driverInfoCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 16,
    marginHorizontal: 18,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  driverBigAvatar: {
    width: 58,
    height: 58,
    borderRadius: 21,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
  },
  driverTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  driverSubtitle: { color: COLORS.muted, fontWeight: "700", marginTop: 3 },
  etaText: { color: COLORS.red, fontWeight: "900", marginTop: 4 },
  deliveryInfoCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    padding: 14,
    marginHorizontal: 18,
    marginBottom: 12,
    gap: 8,
  },
  infoRow: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    padding: 11,
    flexDirection: "row",
    gap: 9,
  },
  infoLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 11, textTransform: "uppercase" },
  infoValue: { color: COLORS.text, fontWeight: "800", marginTop: 3, lineHeight: 19 },
  quickActions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: "#FEE2E2",
    borderRadius: 16,
    padding: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  quickActionText: { color: COLORS.red, fontWeight: "900" },
  quickReplyRow: { gap: 8, paddingHorizontal: 18, paddingBottom: 10 },
  quickReply: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  quickReplyText: { color: COLORS.red, fontWeight: "900", fontSize: 12 },
  messageRow: { paddingHorizontal: 18, marginVertical: 5 },
  myMessageRow: { alignItems: "flex-end" },
  theirMessageRow: { alignItems: "flex-start" },
  messageBubble: {
    maxWidth: "82%",
    borderRadius: 20,
    padding: 12,
  },
  myBubble: { backgroundColor: COLORS.red, borderBottomRightRadius: 5 },
  theirBubble: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 5,
  },
  senderLabel: { fontWeight: "900", fontSize: 11, marginBottom: 5 },
  mySenderLabel: { color: "#FFE4E6" },
  theirSenderLabel: { color: COLORS.muted },
  messageText: { fontWeight: "700", lineHeight: 21 },
  myMessageText: { color: COLORS.white },
  theirMessageText: { color: COLORS.text },
  messageImage: {
    width: 190,
    height: 130,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: COLORS.surface,
  },
  messageFooter: { flexDirection: "row", gap: 8, marginTop: 7, justifyContent: "flex-end" },
  messageTime: { fontSize: 10, fontWeight: "800" },
  myMessageTime: { color: "#FFE4E6" },
  theirMessageTime: { color: COLORS.muted },
  readReceipt: { color: "#FFE4E6", fontSize: 10, fontWeight: "900" },
  emptyCard: {
    marginHorizontal: 18,
    marginTop: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900", textAlign: "center" },
  emptyText: { color: COLORS.muted, fontWeight: "700", textAlign: "center", lineHeight: 22, marginTop: 8 },
  composerWrap: {
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
  },
  imageUrlPreview: {
    backgroundColor: "#FEE2E2",
    borderRadius: 14,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  imageUrlText: { color: COLORS.red, fontWeight: "800", flex: 1 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  attachButton: {
    width: 43,
    height: 43,
    borderRadius: 16,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  messageInput: {
    flex: 1,
    maxHeight: 120,
    minHeight: 43,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 17,
    paddingHorizontal: 13,
    paddingVertical: 11,
    color: COLORS.text,
    fontWeight: "700",
  },
  sendButton: {
    width: 43,
    height: 43,
    borderRadius: 16,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: { opacity: 0.6 },
  hiddenImageInput: {
    height: 1,
    width: 1,
    opacity: 0,
    position: "absolute",
    left: -1000,
  },
});
