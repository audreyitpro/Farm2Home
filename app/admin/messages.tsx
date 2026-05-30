// app/admin/messages.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../services/supabaseClient";

const ui = {
  bg: "#F5F7FB",
  card: "#FFFFFF",
  border: "#E5E7EB",
  text: "#111827",
  muted: "#6B7280",
  soft: "#F9FAFB",
  primary: "#7C3AED",
  primarySoft: "#EDE9FE",
  green: "#10B981",
  blue: "#2563EB",
  orange: "#F59E0B",
  red: "#EF4444",
};

type ChatMessageRow = {
  id: string;
  thread_id?: string | null;
  conversation_id?: string | null;
  sender_id?: string | null;
  sender_role?: string | null;
  receiver_id?: string | null;
  receiver_role?: string | null;
  message?: string | null;
  body?: string | null;
  text?: string | null;
  read?: boolean | null;
  status?: string | null;
  created_at?: string | null;
};

type MessageThread = {
  id: string;
  title: string;
  lastMessage: string;
  participants: string;
  unreadCount: number;
  messageCount: number;
  lastDate?: string | null;
  type: string;
};

export default function AdminMessages() {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [search, setSearch] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadMessages();
    }, [])
  );

  async function loadMessages() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);

      if (error) throw error;

      setMessages(Array.isArray(data) ? (data as ChatMessageRow[]) : []);
    } catch (error: any) {
      Alert.alert("Messages Error", error?.message || "Unable to load messages.");
    } finally {
      setLoading(false);
    }
  }

  const threads = useMemo(() => {
    const map = new Map<string, ChatMessageRow[]>();

    messages.forEach((message) => {
      const key =
        message.thread_id ||
        message.conversation_id ||
        `${message.sender_id || "unknown"}_${message.receiver_id || "unknown"}`;

      const existing = map.get(key) || [];
      existing.push(message);
      map.set(key, existing);
    });

    return Array.from(map.entries())
      .map(([id, rows]) => {
        const sorted = rows.sort((a, b) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bTime - aTime;
        });

        const latest = sorted[0];

        const senderRole = latest.sender_role || "sender";
        const receiverRole = latest.receiver_role || "receiver";

        return {
          id,
          title: `${capitalize(senderRole)} ↔ ${capitalize(receiverRole)}`,
          lastMessage:
            latest.message || latest.body || latest.text || "No message content.",
          participants: `${latest.sender_id || "Unknown"} → ${
            latest.receiver_id || "Unknown"
          }`,
          unreadCount: rows.filter(
            (item) => item.read === false || item.status === "unread"
          ).length,
          messageCount: rows.length,
          lastDate: latest.created_at,
          type: `${senderRole}_${receiverRole}`,
        };
      })
      .sort((a, b) => {
        const aTime = a.lastDate ? new Date(a.lastDate).getTime() : 0;
        const bTime = b.lastDate ? new Date(b.lastDate).getTime() : 0;
        return bTime - aTime;
      });
  }, [messages]);

  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;

    return threads.filter((thread) =>
      [
        thread.id,
        thread.title,
        thread.lastMessage,
        thread.participants,
        thread.type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [threads, search]);

  const stats = useMemo(() => {
    const unread = threads.reduce((sum, thread) => sum + thread.unreadCount, 0);

    const customerThreads = threads.filter((thread) =>
      thread.type.toLowerCase().includes("customer")
    ).length;

    const farmerThreads = threads.filter((thread) =>
      thread.type.toLowerCase().includes("farmer")
    ).length;

    const driverThreads = threads.filter((thread) =>
      thread.type.toLowerCase().includes("driver")
    ).length;

    return {
      totalMessages: messages.length,
      totalThreads: threads.length,
      unread,
      customerThreads,
      farmerThreads,
      driverThreads,
    };
  }, [messages, threads]);

  function capitalize(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
  }

  function formatDate(value?: string | null) {
    if (!value) return "Unknown date";

    try {
      return new Date(value).toLocaleString();
    } catch {
      return "Unknown date";
    }
  }

  function getThreadColor(type: string) {
    const value = type.toLowerCase();

    if (value.includes("customer")) return ui.blue;
    if (value.includes("farmer")) return ui.green;
    if (value.includes("driver")) return ui.orange;
    if (value.includes("freight")) return ui.primary;

    return ui.blue;
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar barStyle="dark-content" backgroundColor={ui.bg} />
        <ActivityIndicator size="large" color={ui.primary} />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={ui.bg} />

      <View style={styles.shell}>
        <View style={styles.sidebar}>
          <View style={styles.logoRow}>
            <View style={styles.logoMark}>
              <Text style={styles.logoText}>F2H</Text>
            </View>

            <View>
              <Text style={styles.logoTitle}>Farm2Home</Text>
              <Text style={styles.logoSub}>Messages</Text>
            </View>
          </View>

          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <NavButton label="Control Tower" icon="radio-outline" route="/admin/control-tower" />
          <NavButton label="Messages" icon="chatbubbles-outline" route="/admin/messages" active />
          <NavButton label="Notifications" icon="notifications-outline" route="/admin/notifications" />
          <NavButton label="Customers" icon="people-outline" route="/admin/customers" />
          <NavButton label="Drivers" icon="car-outline" route="/admin/drivers" />
        </View>

        <View style={styles.main}>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.welcome}>Farm2Home Admin Support</Text>
              <Text style={styles.pageTitle}>Messages</Text>
              <Text style={styles.pageSub}>
                Monitor customer, farmer, driver, and freight conversations.
              </Text>
            </View>

            <TouchableOpacity style={styles.refreshPill} onPress={loadMessages}>
              <Ionicons name="refresh-outline" size={18} color={ui.primary} />
              <Text style={styles.refreshPillText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.statsGrid}>
              <StatCard label="Messages" value={String(stats.totalMessages)} icon="chatbubbles-outline" accent />
              <StatCard label="Threads" value={String(stats.totalThreads)} icon="albums-outline" />
              <StatCard label="Unread" value={String(stats.unread)} icon="mail-unread-outline" warning />
              <StatCard label="Customer Chats" value={String(stats.customerThreads)} icon="people-outline" />
              <StatCard label="Farmer Chats" value={String(stats.farmerThreads)} icon="leaf-outline" success />
              <StatCard label="Driver Chats" value={String(stats.driverThreads)} icon="car-outline" />
            </View>

            <View style={styles.searchCard}>
              <Ionicons name="search-outline" size={20} color={ui.primary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search messages, participants, roles..."
                placeholderTextColor={ui.muted}
                style={styles.searchInput}
              />
            </View>

            <View style={styles.dataSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Message Threads</Text>
                <Text style={styles.sectionLink}>{filteredThreads.length} records</Text>
              </View>

              <FlatList
                data={filteredThreads}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={
                  <EmptyCard
                    title="No message threads found."
                    text="Chat messages will appear once users start conversations."
                  />
                }
                renderItem={({ item }) => {
                  const color = getThreadColor(item.type);

                  return (
                    <View style={styles.row}>
                      <View style={[styles.avatar, { backgroundColor: `${color}18` }]}>
                        <Ionicons name="chatbubble-ellipses-outline" size={22} color={color} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{item.title}</Text>
                        <Text style={styles.meta}>{item.participants}</Text>
                        <Text style={styles.message} numberOfLines={3}>
                          {item.lastMessage}
                        </Text>
                        <Text style={styles.meta}>
                          Messages: {item.messageCount} • Last: {formatDate(item.lastDate)}
                        </Text>
                      </View>

                      <View style={styles.rightCol}>
                        {item.unreadCount > 0 && (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadText}>{item.unreadCount}</Text>
                          </View>
                        )}

                        <TouchableOpacity
                          style={styles.viewButton}
                          onPress={() =>
                            Alert.alert(
                              item.title,
                              `${item.lastMessage}\n\n${item.participants}`
                            )
                          }
                        >
                          <Text style={styles.viewButtonText}>View</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

function NavButton({
  label,
  icon,
  route,
  active = false,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  active?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.navButton, active && styles.navButtonActive]}
      onPress={() => router.push(route as any)}
    >
      <Ionicons name={icon} size={18} color={active ? "#FFFFFF" : ui.muted} />
      <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent = false,
  success = false,
  warning = false,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: boolean;
  success?: boolean;
  warning?: boolean;
}) {
  const color = success ? ui.green : warning ? ui.orange : accent ? ui.primary : ui.blue;

  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>

      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyCard({ title, text }: { title: string; text?: string }) {
  return (
    <View style={styles.emptyCard}>
      <Ionicons name="chatbubbles-outline" size={30} color={ui.primary} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!text && <Text style={styles.emptyText}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ui.bg },
  loadingScreen: {
    flex: 1,
    backgroundColor: ui.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { color: ui.muted, marginTop: 10, fontWeight: "800" },
  shell: { flex: 1, backgroundColor: ui.bg },
  sidebar: {
    backgroundColor: ui.card,
    borderBottomWidth: 1,
    borderBottomColor: ui.border,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  logoMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: ui.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: "#FFFFFF", fontWeight: "900", fontSize: 13 },
  logoTitle: { color: ui.text, fontWeight: "900", fontSize: 18 },
  logoSub: { color: ui.muted, fontWeight: "700", fontSize: 12 },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: ui.soft,
  },
  navButtonActive: { backgroundColor: ui.primary },
  navText: { color: ui.muted, fontWeight: "900", fontSize: 13 },
  navTextActive: { color: "#FFFFFF" },
  main: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  topbar: {
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  welcome: { color: ui.muted, fontWeight: "800", marginBottom: 4 },
  pageTitle: { color: ui.text, fontSize: 26, fontWeight: "900" },
  pageSub: { color: ui.muted, marginTop: 4, fontWeight: "700", maxWidth: 720 },
  refreshPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: ui.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  refreshPillText: { color: ui.primary, fontWeight: "900" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 14 },
  statCard: {
    width: "48%",
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: ui.border,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  statValue: { color: ui.text, fontSize: 22, fontWeight: "900" },
  statLabel: { color: ui.muted, fontWeight: "800", marginTop: 4 },
  searchCard: {
    backgroundColor: ui.card,
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 52,
    borderWidth: 1,
    borderColor: ui.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  searchInput: { flex: 1, color: ui.text, fontWeight: "800" },
  dataSection: {
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { color: ui.text, fontSize: 19, fontWeight: "900" },
  sectionLink: { color: ui.primary, fontWeight: "900", fontSize: 12 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: ui.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { color: ui.text, fontWeight: "900", fontSize: 16 },
  meta: {
    color: ui.muted,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 18,
    fontSize: 12,
  },
  message: {
    color: ui.text,
    fontWeight: "700",
    marginTop: 6,
    lineHeight: 19,
    fontSize: 13,
  },
  rightCol: { alignItems: "flex-end", gap: 8 },
  unreadBadge: {
    backgroundColor: ui.red,
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  unreadText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },
  viewButton: {
    backgroundColor: ui.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  viewButtonText: { color: ui.primary, fontWeight: "900", fontSize: 12 },
  emptyCard: {
    borderTopWidth: 1,
    borderTopColor: ui.border,
    padding: 18,
    alignItems: "center",
  },
  emptyTitle: {
    color: ui.text,
    fontWeight: "900",
    fontSize: 17,
    marginTop: 8,
    textAlign: "center",
  },
  emptyText: {
    color: ui.muted,
    fontWeight: "700",
    lineHeight: 21,
    textAlign: "center",
    marginTop: 5,
  },
});