// app/customer/support.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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

const COLORS = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  black: "#050505",
  red: "#D71920",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  greenSoft: "#DCFCE7",
  amberSoft: "#FEF3C7",
  blueSoft: "#DBEAFE",
  white: "#FFFFFF",
};

type CustomerSession = {
  id?: string;
  customerId?: string;
  customer_id?: string;
  email?: string;
  full_name?: string;
  fullName?: string;
  name?: string;
  phone?: string;
};

type SupportTicket = {
  id: string;
  customer_id: string;
  customer_email: string;
  customer_name: string;
  order_id?: string;
  issue_type: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
};

const ISSUE_TYPES = [
  "Order Issue",
  "Delivery Issue",
  "Refund Question",
  "Farmer/Product Question",
  "Payment/Membership",
  "App/Account Help",
  "Other",
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

function statusTone(status: string) {
  const s = normalize(status);
  if (s.includes("closed") || s.includes("resolved")) return styles.greenBadge;
  if (s.includes("progress")) return styles.blueBadge;
  return styles.amberBadge;
}

export default function CustomerSupport() {
  const [customer, setCustomer] = useState<CustomerSession | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [issueType, setIssueType] = useState("Order Issue");
  const [orderId, setOrderId] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadScreen();
    }, [])
  );

  const openTickets = useMemo(
    () => tickets.filter((t) => !["closed", "resolved"].includes(normalize(t.status))).length,
    [tickets]
  );

  async function loadScreen() {
    try {
      setLoading(true);
      const activeCustomer = await loadCustomer();
      await loadTickets(activeCustomer);
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    try {
      setRefreshing(true);
      await loadTickets(customer);
    } finally {
      setRefreshing(false);
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
      } catch {}
    }

    const { data: authData } = await supabase.auth.getUser();
    const authId = clean(authData?.user?.id);
    const authEmail = normalize(authData?.user?.email || localCustomer?.email);

    if (authId) {
      const { data } = await supabase
        .from("customers")
        .select("*")
        .or(`id.eq.${authId},auth_user_id.eq.${authId},profile_id.eq.${authId}`)
        .limit(1);

      if (Array.isArray(data) && data[0]) {
        const session = { ...data[0], customerId: data[0].id };
        setCustomer(session);
        await AsyncStorage.setItem("currentCustomer", JSON.stringify(session));
        return session;
      }
    }

    if (authEmail) {
      const { data } = await supabase
        .from("customers")
        .select("*")
        .eq("email", authEmail)
        .limit(1);

      if (Array.isArray(data) && data[0]) {
        const session = { ...data[0], customerId: data[0].id };
        setCustomer(session);
        await AsyncStorage.setItem("currentCustomer", JSON.stringify(session));
        return session;
      }
    }

    return localCustomer;
  }

  async function loadTickets(activeCustomer: CustomerSession | null) {
    const customerId = getCustomerId(activeCustomer);
    const customerEmail = normalize(activeCustomer?.email);
    const loaded: SupportTicket[] = [];

    const localRaw = await AsyncStorage.getItem("customerSupportTickets");
    if (localRaw) {
      try {
        const parsed = JSON.parse(localRaw);
        if (Array.isArray(parsed)) loaded.push(...parsed);
      } catch {}
    }

    for (const table of ["customer_support_tickets", "support_tickets", "customer_support"]) {
      try {
        let query = supabase
          .from(table)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);

        if (customerId && customerEmail) {
          query = query.or(`customer_id.eq.${customerId},customer_email.eq.${customerEmail}`);
        } else if (customerId) {
          query = query.eq("customer_id", customerId);
        } else if (customerEmail) {
          query = query.eq("customer_email", customerEmail);
        } else {
          continue;
        }

        const { data, error } = await query;

        if (!error && Array.isArray(data)) {
          loaded.push(...data);
          break;
        }
      } catch {}
    }

    const unique = Array.from(new Map(loaded.map((t) => [t.id, t])).values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setTickets(unique);
    await AsyncStorage.setItem("customerSupportTickets", JSON.stringify(unique));
  }

  async function submitTicket() {
    const customerId = getCustomerId(customer);
    const customerEmail = normalize(customer?.email);
    const customerName = getCustomerName(customer);

    if (!customerId && !customerEmail) {
      Alert.alert("Login Required", "Customer account was not found.");
      return;
    }

    if (!clean(subject)) {
      Alert.alert("Missing Subject", "Enter a short subject.");
      return;
    }

    if (!clean(message)) {
      Alert.alert("Missing Message", "Describe the issue.");
      return;
    }

    const ticket: SupportTicket = {
      id: `ticket_${Date.now()}`,
      customer_id: customerId,
      customer_email: customerEmail,
      customer_name: customerName,
      order_id: clean(orderId),
      issue_type: issueType,
      subject: clean(subject),
      message: clean(message),
      status: "open",
      priority:
        issueType.includes("Refund") || issueType.includes("Delivery") ? "high" : "normal",
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    try {
      setSubmitting(true);

      let saved = false;

      for (const table of ["customer_support_tickets", "support_tickets", "customer_support"]) {
        try {
          const { error } = await supabase.from(table).insert(ticket);
          if (!error) {
            saved = true;
            break;
          }
        } catch {}
      }

      const next = [ticket, ...tickets];
      setTickets(next);
      await AsyncStorage.setItem("customerSupportTickets", JSON.stringify(next));

      setOrderId("");
      setSubject("");
      setMessage("");

      Alert.alert(
        "Support Ticket Created",
        saved
          ? "Your request was submitted."
          : "Your request was saved locally. Add the support table to Supabase to save it online."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function renderHeader() {
    return (
      <View>
        <View style={styles.hero}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push("/customer/dashboard" as any)}
          >
            <Ionicons name="arrow-back-outline" size={18} color={COLORS.white} />
            <Text style={styles.backButtonText}>Dashboard</Text>
          </TouchableOpacity>

          <View style={styles.heroIcon}>
            <Ionicons name="help-buoy-outline" size={34} color={COLORS.white} />
          </View>

          <Text style={styles.kicker}>Farm2Home Help</Text>
          <Text style={styles.title}>Customer Support</Text>
          <Text style={styles.subtitle}>
            Report order issues, delivery problems, refund questions, payment help, or account concerns.
          </Text>
        </View>

        <View style={styles.metricsRow}>
          <Metric icon="ticket-outline" label="Tickets" value={`${tickets.length}`} />
          <Metric icon="alert-circle-outline" label="Open" value={`${openTickets}`} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Create Support Ticket</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.issueRow}>
            {ISSUE_TYPES.map((type) => {
              const active = issueType === type;
              return (
                <Pressable
                  key={type}
                  style={[styles.issueChip, active && styles.issueChipActive]}
                  onPress={() => setIssueType(type)}
                >
                  <Text style={[styles.issueText, active && styles.issueTextActive]}>
                    {type}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <TextInput
            style={styles.input}
            placeholder="Order ID optional"
            placeholderTextColor="#94A3B8"
            value={orderId}
            onChangeText={setOrderId}
          />

          <TextInput
            style={styles.input}
            placeholder="Subject"
            placeholderTextColor="#94A3B8"
            value={subject}
            onChangeText={setSubject}
          />

          <TextInput
            style={[styles.input, styles.messageInput]}
            placeholder="Describe what happened..."
            placeholderTextColor="#94A3B8"
            value={message}
            onChangeText={setMessage}
            multiline
          />

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.disabled]}
            onPress={submitTicket}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="send-outline" size={20} color={COLORS.white} />
                <Text style={styles.submitText}>Submit Support Ticket</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Tickets</Text>
          <Text style={styles.sectionSubtitle}>
            Track your support requests and issue status.
          </Text>
        </View>
      </View>
    );
  }

  function renderTicket({ item }: { item: SupportTicket }) {
    return (
      <View style={styles.ticketCard}>
        <View style={styles.ticketTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.ticketTitle}>{item.subject}</Text>
            <Text style={styles.ticketMeta}>
              {item.issue_type} · {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>

          <View style={[styles.statusBadge, statusTone(item.status)]}>
            <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
          </View>
        </View>

        {item.order_id ? (
          <Text style={styles.orderLine}>Order #{item.order_id.slice(-8).toUpperCase()}</Text>
        ) : null}

        <Text style={styles.ticketMessage}>{item.message}</Text>

        <View style={styles.ticketActions}>
          {item.order_id ? (
            <TouchableOpacity
              style={styles.smallButton}
              onPress={() =>
                router.push({
                  pathname: "/customer/order-detail" as any,
                  params: { orderId: item.order_id },
                })
              }
            >
              <Text style={styles.smallButtonText}>View Order</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => router.push("/customer/notifications" as any)}
          >
            <Text style={styles.smallButtonText}>Notifications</Text>
          </TouchableOpacity>
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
          <Text style={styles.centerText}>Loading support...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.id}
          renderItem={renderTicket}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.red} />
          }
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="ticket-outline" size={40} color={COLORS.red} />
              <Text style={styles.emptyTitle}>No tickets yet</Text>
              <Text style={styles.emptyText}>
                Submit a support request if you need help with an order, delivery, payment, or account.
              </Text>
            </View>
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricIcon}>
        <Ionicons name={icon} size={20} color={COLORS.red} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  centerText: { color: COLORS.muted, fontWeight: "800" },
  listContent: { paddingBottom: 70 },
  hero: {
    backgroundColor: COLORS.black,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  backButton: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.red,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
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
  title: { color: COLORS.white, fontSize: 36, fontWeight: "900", marginTop: 6 },
  subtitle: { color: "#CBD5E1", fontWeight: "700", lineHeight: 22, marginTop: 8 },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    marginTop: 18,
  },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 14,
  },
  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: 15,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  metricValue: { color: COLORS.text, fontSize: 22, fontWeight: "900" },
  metricLabel: { color: COLORS.muted, fontSize: 12, fontWeight: "900" },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    margin: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900" },
  sectionSubtitle: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  issueRow: { gap: 8, paddingVertical: 14 },
  issueChip: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  issueChipActive: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  issueText: { color: COLORS.red, fontWeight: "900" },
  issueTextActive: { color: COLORS.white },
  input: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    color: COLORS.text,
    fontWeight: "800",
    marginBottom: 10,
  },
  messageInput: { minHeight: 120, textAlignVertical: "top" },
  submitButton: {
    backgroundColor: COLORS.red,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  submitText: { color: COLORS.white, fontWeight: "900", fontSize: 16 },
  disabled: { opacity: 0.65 },
  sectionHeader: { paddingHorizontal: 18, paddingBottom: 10 },
  ticketCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    marginHorizontal: 18,
    marginBottom: 12,
    padding: 14,
  },
  ticketTop: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  ticketTitle: { color: COLORS.text, fontWeight: "900", fontSize: 17 },
  ticketMeta: { color: COLORS.muted, fontWeight: "700", marginTop: 3 },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  amberBadge: { backgroundColor: COLORS.amberSoft },
  greenBadge: { backgroundColor: COLORS.greenSoft },
  blueBadge: { backgroundColor: COLORS.blueSoft },
  statusText: { color: COLORS.text, fontWeight: "900", fontSize: 11 },
  orderLine: { color: COLORS.red, fontWeight: "900", marginTop: 10 },
  ticketMessage: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 8 },
  ticketActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  smallButton: {
    backgroundColor: "#FEE2E2",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  smallButtonText: { color: COLORS.red, fontWeight: "900" },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 18,
    alignItems: "center",
  },
  emptyTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900", marginTop: 12 },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 22,
    marginTop: 8,
  },
});