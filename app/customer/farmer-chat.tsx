// app/customer/farmer-chat.tsx

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

const MESSAGE_TABLE = "customer_farmer_messages";

const COLORS = {
  bg: "#F8F8FB",
  card: "#FFFFFF",
  surface: "#FFFFFF",

  black: "#2A3042",

  red: "#556EE6",
  redDark: "#485EC4",

  text: "#495057",
  muted: "#74788D",
  border: "#EFF2F7",

  green: "#34C38F",
  greenDark: "#2CA67A",
  greenSoft: "#E8FBF3",

  amber: "#F1B44C",
  amberSoft: "#FFF6E5",

  blue: "#50A5F1",
  blueSoft: "#EAF5FE",

  danger: "#F46A6A",
  dangerSoft: "#FFECEC",

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

type FarmConversation = {
  conversationId: string;
  orderId: string;
  farmerId: string;
  farmName: string;
  farmerEmail?: string;
  lastMessage?: string;
  unreadCount?: number;
  status?: string;
};

type ChatMessage = {
  id: string;
  conversation_id: string;
  order_id?: string;
  customer_id?: string;
  customer_name?: string;
  farmer_id?: string;
  farm_name?: string;
  sender_id: string;
  sender_role: "customer" | "farmer" | string;
  sender_name?: string;
  receiver_id?: string;
  receiver_role?: string;
  message: string;
  image_url?: string;
  read_by_customer?: boolean;
  read_by_farmer?: boolean;
  created_at: string;
  updated_at?: string;
};

const QUICK_REPLIES = [
  "Can you confirm this item is available?",
  "What time is pickup available?",
  "Can you substitute if this item is out of stock?",
  "Is this harvested today?",
  "Please message me before delivery.",
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

function buildConversationId(orderId: string, customerId: string, farmerId: string, farmName = "") {
  const safeOrder = clean(orderId) || "general";
  const safeCustomer = clean(customerId) || "customer";
  const safeFarmer = clean(farmerId) || normalize(farmName).replace(/[^a-z0-9]/g, "_") || "farmer";
  return `customer_farmer_${safeOrder}_${safeCustomer}_${safeFarmer}`;
}

function getFarmName(item: any) {
  return clean(
    item?.farm_name ||
      item?.farmName ||
      item?.farmerName ||
      item?.farmer_name ||
      "Farm2Home Farm"
  );
}

function getFarmerId(item: any) {
  return clean(item?.farmer_id || item?.farmerId);
}

export default function CustomerFarmerChat() {
  const params = useLocalSearchParams();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const channelRef = useRef<any>(null);

  const [customer, setCustomer] = useState<CustomerSession | null>(null);
  const [conversations, setConversations] = useState<FarmConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<FarmConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const paramOrderId = clean(params?.orderId || params?.order_id);
  const paramFarmerId = clean(params?.farmerId || params?.farmer_id);
  const paramFarmName = clean(params?.farmName || params?.farm_name);
  const paramFarmerEmail = clean(params?.farmerEmail || params?.farmer_email);

  const customerId = getCustomerId(customer);
  const customerName = getCustomerName(customer);

  const activeConversationId = useMemo(() => {
    if (!selectedConversation) return "";
    return selectedConversation.conversationId;
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
    }, [paramOrderId, paramFarmerId, paramFarmName])
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
        nextConversations.find((item) => paramFarmerId && item.farmerId === paramFarmerId) ||
        nextConversations.find((item) => paramFarmName && item.farmName === paramFarmName) ||
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
    const name = getCustomerName(activeCustomer);

    const rows: FarmConversation[] = [];

    if (paramFarmerId || paramFarmName) {
      rows.push({
        conversationId: buildConversationId(paramOrderId, id, paramFarmerId, paramFarmName),
        orderId: paramOrderId,
        farmerId: paramFarmerId,
        farmName: paramFarmName || "Farm2Home Farm",
        farmerEmail: paramFarmerEmail,
        status: "Active",
      });
    }

    if (paramOrderId) {
      const fromOrder = await loadFarmConversationsFromOrder(paramOrderId, activeCustomer);
      rows.push(...fromOrder);
    }

    if (id) {
      const fromMessages = await loadExistingConversationsFromMessages(id, name);
      rows.push(...fromMessages);
    }

    const unique = Array.from(
      new Map(rows.map((item) => [item.conversationId, item])).values()
    );

    return unique.length > 0
      ? unique
      : [
          {
            conversationId: buildConversationId("general", id, "", "Farm2Home Farm"),
            orderId: "general",
            farmerId: "",
            farmName: "Farm2Home Farm",
            status: "General",
          },
        ];
  }

  async function loadFarmConversationsFromOrder(
    orderId: string,
    activeCustomer: CustomerSession | null
  ) {
    const found: FarmConversation[] = [];
    const customerIdValue = getCustomerId(activeCustomer);

    const order = await fetchOrder(orderId);
    if (!order) return found;

    const items = await fetchOrderItems(orderId);
    const rawItems = items.length ? items : Array.isArray(order.items) ? order.items : [];

    const payoutSplits = Array.isArray(order.payout_splits)
      ? order.payout_splits
      : Array.isArray(order.payoutSplits)
        ? order.payoutSplits
        : [];

    const farmMap = new Map<string, FarmConversation>();

    rawItems.forEach((item: any) => {
      const farmerId = getFarmerId(item);
      const farmName = getFarmName(item);
      const key = farmerId || farmName;

      if (!farmMap.has(key)) {
        farmMap.set(key, {
          conversationId: buildConversationId(orderId, customerIdValue, farmerId, farmName),
          orderId,
          farmerId,
          farmName,
          farmerEmail: clean(item.farmer_email || item.farmerEmail),
          status: clean(item.status || order.status || "Active"),
        });
      }
    });

    payoutSplits.forEach((split: any) => {
      const farmerId = clean(split.farmerId || split.farmer_id);
      const farmName = clean(split.farmName || split.farm_name || "Farm2Home Farm");
      const key = farmerId || farmName;

      if (!farmMap.has(key)) {
        farmMap.set(key, {
          conversationId: buildConversationId(orderId, customerIdValue, farmerId, farmName),
          orderId,
          farmerId,
          farmName,
          farmerEmail: clean(split.farmerEmail || split.farmer_email),
          status: clean(split.status || order.status || "Active"),
        });
      }
    });

    return Array.from(farmMap.values());
  }

  async function fetchOrder(orderId: string) {
    const tables = ["orders", "customer_orders", "farm_orders"];

    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .eq("id", orderId)
          .maybeSingle();

        if (!error && data) return data;
      } catch {
        // Try next table.
      }
    }

    return null;
  }

  async function fetchOrderItems(orderId: string) {
    const tables = ["order_items", "customer_order_items", "farm_order_items"];

    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .eq("order_id", orderId)
          .limit(200);

        if (!error && Array.isArray(data) && data.length > 0) return data;
      } catch {
        // Try next table.
      }
    }

    return [];
  }

  async function loadExistingConversationsFromMessages(
    customerIdValue: string,
    customerNameValue: string
  ) {
    const tables = [MESSAGE_TABLE];
    const found: FarmConversation[] = [];

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
            const farmerId = clean(row.farmer_id || row.farmerId);
            const farmName = clean(row.farm_name || row.farmName || "Farm2Home Farm");
            const orderId = clean(row.order_id || row.orderId || "general");

            const conversationId =
              clean(row.conversation_id || row.conversationId) ||
              buildConversationId(orderId, customerIdValue, farmerId, farmName);

            found.push({
              conversationId,
              orderId,
              farmerId,
              farmName,
              farmerEmail: clean(row.farmer_email || row.farmerEmail),
              lastMessage: clean(row.message),
              unreadCount: row.sender_role === "farmer" && !row.read_by_customer ? 1 : 0,
              status: "Active",
            });
          });

          break;
        }
      } catch {
        // Try next table.
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
    const tables = [MESSAGE_TABLE];

    for (const table of tables) {
      try {
        const rows = await queryMessages(table, conversationId);
        setMessages(rows.map(normalizeMessage));
        return;
      } catch {
        // Try next table.
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
      farmer_id: clean(row.farmer_id || row.farmerId || selectedConversation?.farmerId),
      farm_name: clean(row.farm_name || row.farmName || selectedConversation?.farmName),
      sender_id: clean(row.sender_id || row.senderId),
      sender_role: clean(row.sender_role || row.senderRole || "customer"),
      sender_name: clean(row.sender_name || row.senderName),
      receiver_id: clean(row.receiver_id || row.receiverId),
      receiver_role: clean(row.receiver_role || row.receiverRole),
      message: clean(row.message || row.text || ""),
      image_url: clean(row.image_url || row.imageUrl),
      read_by_customer: Boolean(row.read_by_customer),
      read_by_farmer: Boolean(row.read_by_farmer),
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
      .channel(`customer_farmer_chat_${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: MESSAGE_TABLE,
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
      Alert.alert("No Conversation", "Select a farmer conversation first.");
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
      farmer_id: selectedConversation.farmerId,
      farm_name: selectedConversation.farmName,
      sender_id: customerId,
      sender_role: "customer",
      sender_name: customerName,
      receiver_id: selectedConversation.farmerId,
      receiver_role: "farmer",
      message: text,
      image_url: clean(imageUrl),
      read_by_customer: true,
      read_by_farmer: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    try {
      setSending(true);

      const tables = [MESSAGE_TABLE];
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
    const tables = [MESSAGE_TABLE];

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
        // Skip missing table/column.
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
            <Ionicons name="chatbubbles-outline" size={34} color={COLORS.white} />
          </View>

          <Text style={styles.kicker}>Customer ↔ Farmer</Text>
          <Text style={styles.heroTitle}>Farmer Chat</Text>
          <Text style={styles.heroText}>
            Ask about products, harvest dates, substitutions, pickup, delivery, and custom farm
            orders.
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.conversationRow}
        >
          {conversations.map((conversation) => {
            const active = conversation.conversationId === selectedConversation?.conversationId;

            return (
              <Pressable
                key={conversation.conversationId}
                style={[styles.conversationChip, active && styles.conversationChipActive]}
                onPress={() => setSelectedConversation(conversation)}
              >
                <View style={[styles.conversationAvatar, active && styles.conversationAvatarActive]}>
                  <Text
                    style={[
                      styles.conversationAvatarText,
                      active && styles.conversationAvatarTextActive,
                    ]}
                  >
                    {conversation.farmName.slice(0, 1).toUpperCase()}
                  </Text>
                </View>

                <View style={{ maxWidth: 180 }}>
                  <Text
                    style={[styles.conversationName, active && styles.conversationNameActive]}
                    numberOfLines={1}
                  >
                    {conversation.farmName}
                  </Text>

                  <Text
                    style={[styles.conversationMeta, active && styles.conversationMetaActive]}
                    numberOfLines={1}
                  >
                    {conversation.orderId && conversation.orderId !== "general"
                      ? `Order #${conversation.orderId.slice(-8).toUpperCase()}`
                      : "General chat"}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {selectedConversation ? (
          <View style={styles.farmInfoCard}>
            <View style={styles.farmBigAvatar}>
              <Text style={styles.farmBigAvatarText}>
                {selectedConversation.farmName.slice(0, 1).toUpperCase()}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.farmTitle}>{selectedConversation.farmName}</Text>
              <Text style={styles.farmSubtitle}>
                {selectedConversation.farmerId
                  ? `Farmer ID: ${selectedConversation.farmerId}`
                  : "Farm2Home farmer"}
              </Text>
              <Text style={styles.farmSubtitle}>
                {selectedConversation.status || "Active conversation"}
              </Text>
            </View>
          </View>
        ) : null}

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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickReplyRow}
        >
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
            {mine ? "You" : item.sender_name || selectedConversation?.farmName || "Farmer"}
          </Text>

          {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.messageImage} /> : null}

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
              <Text style={styles.readReceipt}>{item.read_by_farmer ? "Read" : "Sent"}</Text>
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
          <Text style={styles.centerText}>Loading farmer chat...</Text>
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
              <Text style={styles.emptyTitle}>Start the conversation</Text>
              <Text style={styles.emptyText}>
                Send a message to coordinate product availability, pickup, delivery, or
                substitutions.
              </Text>
            </View>
          }
        />

        <View style={styles.composerWrap}>
          {imageUrl ? (
            <View style={styles.imageUrlPreview}>
              <Ionicons name="image-outline" size={16} color={COLORS.red} />
              <Text style={styles.imageUrlText} numberOfLines={1}>
                {imageUrl}
              </Text>
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
                  : Alert.alert(
                      "Attach Photo",
                      "Paste an image URL into the hidden photo field feature on web/mobile."
                    )
              }
            >
              <Ionicons name="image-outline" size={20} color={COLORS.red} />
            </Pressable>

            <TextInput
              style={styles.messageInput}
              placeholder="Message farmer..."
              placeholderTextColor="#ADB5BD"
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  keyboard: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  centerText: { color: COLORS.muted, fontWeight: "800" },
  listContent: { paddingBottom: 12 },

  hero: {
    backgroundColor: COLORS.red,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,

    shadowColor: COLORS.red,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  backButton: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
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
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  kicker: {
    color: "#DDE3FF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroTitle: { color: COLORS.white, fontSize: 34, fontWeight: "900", marginTop: 6 },
  heroText: { color: "#EEF2FF", fontWeight: "700", lineHeight: 22, marginTop: 8 },

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

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  conversationChipActive: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  conversationAvatar: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  conversationAvatarActive: { backgroundColor: "rgba(255,255,255,0.18)" },
  conversationAvatarText: { color: COLORS.red, fontWeight: "900", fontSize: 18 },
  conversationAvatarTextActive: { color: COLORS.white },
  conversationName: { color: COLORS.text, fontWeight: "900" },
  conversationNameActive: { color: COLORS.white },
  conversationMeta: { color: COLORS.muted, fontWeight: "700", fontSize: 12, marginTop: 3 },
  conversationMetaActive: { color: "#EEF2FF" },

  farmInfoCard: {
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

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  farmBigAvatar: {
    width: 58,
    height: 58,
    borderRadius: 21,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  farmBigAvatarText: { color: COLORS.red, fontWeight: "900", fontSize: 24 },
  farmTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  farmSubtitle: { color: COLORS.muted, fontWeight: "700", marginTop: 3 },

  quickActions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: "#EEF2FF",
    borderRadius: 16,
    padding: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    borderWidth: 1,
    borderColor: COLORS.border,
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
  mySenderLabel: { color: "#EEF2FF" },
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
  myMessageTime: { color: "#EEF2FF" },
  theirMessageTime: { color: COLORS.muted },
  readReceipt: { color: "#EEF2FF", fontSize: 10, fontWeight: "900" },

  emptyCard: {
    marginHorizontal: 18,
    marginTop: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900", textAlign: "center" },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 22,
    marginTop: 8,
  },

  composerWrap: {
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
  },
  imageUrlPreview: {
    backgroundColor: "#EEF2FF",
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
    backgroundColor: "#EEF2FF",
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