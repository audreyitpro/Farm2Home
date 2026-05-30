// app/driver/notifications.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import freightTheme from "../styles/freightTheme";

type DriverNotification = {
  id: string;
  title: string;
  message: string;
  type:
    | "new_delivery"
    | "accepted"
    | "pickup"
    | "dropoff"
    | "earnings"
    | "membership"
    | "system";
  read: boolean;
  createdAt: string;
  route?: string;
};

const STORAGE_KEY = "farm2homeDriverNotifications";

const DEMO_NOTIFICATIONS: DriverNotification[] = [
  {
    id: "notif_1",
    title: "New Delivery Available",
    message: "A new Farm2Home local delivery is available on your Driver Board.",
    type: "new_delivery",
    read: false,
    createdAt: new Date().toISOString(),
    route: "/driver/board",
  },
  {
    id: "notif_2",
    title: "Proof of Delivery Reminder",
    message: "Remember to upload delivery photo and receiver confirmation.",
    type: "dropoff",
    read: false,
    createdAt: new Date().toISOString(),
    route: "/driver/proof-of-delivery",
  },
  {
    id: "notif_3",
    title: "Earnings Updated",
    message: "Your completed delivery earnings summary has been updated.",
    type: "earnings",
    read: true,
    createdAt: new Date().toISOString(),
    route: "/driver/earnings",
  },
];

export default function DriverNotificationsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [notifications, setNotifications] = useState<DriverNotification[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [])
  );

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications]
  );

  async function loadNotifications() {
    try {
      setLoading(true);

      const raw = await AsyncStorage.getItem(STORAGE_KEY);

      if (raw) {
        const parsed = JSON.parse(raw);
        setNotifications(Array.isArray(parsed) ? parsed : DEMO_NOTIFICATIONS);
      } else {
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(DEMO_NOTIFICATIONS)
        );
        setNotifications(DEMO_NOTIFICATIONS);
      }
    } catch (error) {
      console.log("Driver notifications load error:", error);
      setNotifications(DEMO_NOTIFICATIONS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function saveNotifications(nextItems: DriverNotification[]) {
    setNotifications(nextItems);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
  }

  async function markAsRead(id: string) {
    const nextItems = notifications.map((item) =>
      item.id === id ? { ...item, read: true } : item
    );

    await saveNotifications(nextItems);
  }

  async function markAllRead() {
    const nextItems = notifications.map((item) => ({ ...item, read: true }));
    await saveNotifications(nextItems);
  }

  async function clearAll() {
    Alert.alert(
      "Clear Notifications",
      "Are you sure you want to clear all driver notifications?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await saveNotifications([]);
          },
        },
      ]
    );
  }

  function onRefresh() {
    setRefreshing(true);
    loadNotifications();
  }

  function iconForType(type: DriverNotification["type"]) {
    switch (type) {
      case "new_delivery":
        return "cube-outline";
      case "accepted":
        return "checkmark-circle-outline";
      case "pickup":
        return "radio-button-on";
      case "dropoff":
        return "location-outline";
      case "earnings":
        return "wallet-outline";
      case "membership":
        return "card-outline";
      default:
        return "notifications-outline";
    }
  }

  function labelForType(type: DriverNotification["type"]) {
    switch (type) {
      case "new_delivery":
        return "New Delivery";
      case "accepted":
        return "Accepted";
      case "pickup":
        return "Pickup";
      case "dropoff":
        return "Dropoff";
      case "earnings":
        return "Earnings";
      case "membership":
        return "Membership";
      default:
        return "System";
    }
  }

  function formatDate(value: string) {
    try {
      return new Date(value).toLocaleString();
    } catch {
      return "Recent";
    }
  }

  function openNotification(item: DriverNotification) {
    markAsRead(item.id);

    if (item.route) {
      router.push(item.route as any);
    }
  }

  function renderNotification({ item }: { item: DriverNotification }) {
    return (
      <TouchableOpacity
        style={[styles.notificationCard, !item.read && styles.unreadCard]}
        onPress={() => openNotification(item)}
      >
        <View style={styles.notificationTop}>
          <View style={styles.iconCircle}>
            <Ionicons name={iconForType(item.type)} size={22} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.notificationTitle}>{item.title}</Text>
            <Text style={styles.notificationDate}>
              {formatDate(item.createdAt)}
            </Text>
          </View>

          {!item.read && <View style={styles.unreadDot} />}
        </View>

        <Text style={styles.notificationMessage}>{item.message}</Text>

        <View style={styles.footerRow}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{labelForType(item.type)}</Text>
          </View>

          <Text style={styles.openText}>Open</Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#020617" />
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Farm2Home Driver</Text>
              <Text style={styles.title}>Notifications</Text>
              <Text style={styles.subtitle}>
                View delivery alerts, pickup reminders, earnings notices, and
                driver membership updates.
              </Text>
            </View>

            <View style={styles.heroIcon}>
              <Ionicons name="notifications-outline" size={34} color="#FFFFFF" />
            </View>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>Unread Alerts</Text>
            <Text style={styles.summaryValue}>{unreadCount}</Text>
          </View>

          <TouchableOpacity style={styles.markButton} onPress={markAllRead}>
            <Text style={styles.markButtonText}>Mark All Read</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.navRow}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => router.push("/driver/mobile-driver-app" as any)}
          >
            <Ionicons name="phone-portrait-outline" size={18} color="#FFFFFF" />
            <Text style={styles.navText}>Driver App</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButtonOutline}
            onPress={() => router.push("/driver/board" as any)}
          >
            <Ionicons
              name="list-outline"
              size={18}
              color={freightTheme.colors.primary}
            />
            <Text style={styles.navTextOutline}>Board</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.sectionTitle}>Recent Alerts</Text>

              {notifications.length > 0 && (
                <TouchableOpacity onPress={clearAll}>
                  <Text style={styles.clearText}>Clear All</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="notifications-off-outline" size={38} color="#10B981" />
              <Text style={styles.emptyTitle}>No notifications</Text>
              <Text style={styles.emptyText}>
                Delivery alerts and driver updates will appear here.
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: freightTheme.colors.mutedText,
    marginTop: 10,
    fontWeight: "800",
  },
  container: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  hero: {
    backgroundColor: "#020617",
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 26,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#064E3B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#10B981",
  },
  eyebrow: {
    color: "#10B981",
    fontWeight: "900",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 10,
  },
  subtitle: {
    color: "#D1D5DB",
    lineHeight: 23,
    fontSize: 15,
    fontWeight: "700",
  },
  summaryCard: {
    backgroundColor: "#064E3B",
    borderRadius: 20,
    padding: 18,
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#10B981",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    color: "#BBF7D0",
    fontWeight: "900",
  },
  summaryValue: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginTop: 4,
  },
  markButton: {
    backgroundColor: "#10B981",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  markButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  navRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  navButton: {
    flex: 1,
    backgroundColor: freightTheme.colors.primary,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navButtonOutline: {
    flex: 1,
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  navTextOutline: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  listContent: {
    paddingBottom: 110,
  },
  listHeader: {
    paddingHorizontal: 18,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: freightTheme.colors.text,
    fontSize: 24,
    fontWeight: "900",
  },
  clearText: {
    color: "#DC2626",
    fontWeight: "900",
  },
  notificationCard: {
    backgroundColor: freightTheme.colors.card,
    borderRadius: 20,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  unreadCard: {
    borderColor: "#10B981",
    backgroundColor: "#052E2B",
  },
  notificationTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: freightTheme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationTitle: {
    color: freightTheme.colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  notificationDate: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 3,
  },
  unreadDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#10B981",
  },
  notificationMessage: {
    color: "#CBD5E1",
    fontWeight: "700",
    lineHeight: 21,
  },
  footerRow: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  typeBadge: {
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  typeBadgeText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
    fontSize: 12,
  },
  openText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  emptyCard: {
    backgroundColor: freightTheme.colors.card,
    marginHorizontal: 18,
    marginTop: 20,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    alignItems: "center",
  },
  emptyTitle: {
    color: freightTheme.colors.text,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 10,
    marginBottom: 6,
  },
  emptyText: {
    color: freightTheme.colors.mutedText,
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "center",
  },
});