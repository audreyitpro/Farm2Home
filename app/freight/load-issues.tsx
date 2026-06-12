// app/freight/load-issues.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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

const FREIGHT_ROUTES = {
  dashboard: "/freight/dashboard",
  managementCenter: "/freight/freight-management-center",
  myLoads: "/freight/my-loads",
  liveLoads: "/freight/live-loads",
  routeDetails: "/freight/route-details",
  disputes: "/freight/disputes",
  support: "/freight/support",
  settlements: "/freight/settlements",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];

const ISSUE_TYPES = [
  "Damaged Goods",
  "Shortage",
  "Rejected Delivery",
  "Temperature Issue",
  "Livestock Issue",
  "Route Delay",
  "Pickup Problem",
  "Other",
];

const COLORS = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  amber: "#D97706",
  blue: "#2563EB",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleDateString();
}

export default function FreightLoadIssuesScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);
  const [loads, setLoads] = useState<any[]>([]);
  const [selectedLoadId, setSelectedLoadId] = useState("");
  const [issueType, setIssueType] = useState("Damaged Goods");
  const [issueNotes, setIssueNotes] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadScreen();
    }, [])
  );

  const selectedLoad = useMemo(
    () => loads.find((item) => String(item.id) === String(selectedLoadId)),
    [loads, selectedLoadId]
  );

  async function getStoredCarrier() {
    const raw =
      (await AsyncStorage.getItem("currentFreightCarrier")) ||
      (await AsyncStorage.getItem("currentFreight")) ||
      (await AsyncStorage.getItem("currentFreightUser")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function persistCarrier(nextCarrier: any) {
    const normalizedCarrier = {
      ...nextCarrier,
      id: nextCarrier.id || nextCarrier.freightId,
      freightId: nextCarrier.freightId || nextCarrier.id,
      role: "freight",
      email: normalize(nextCarrier.email),
      companyName:
        nextCarrier.companyName ||
        nextCarrier.businessName ||
        nextCarrier.company_name ||
        nextCarrier.business_name ||
        "Freight Connect Carrier",
      businessName:
        nextCarrier.businessName ||
        nextCarrier.companyName ||
        nextCarrier.business_name ||
        nextCarrier.company_name ||
        "Freight Connect Carrier",
    };

    await AsyncStorage.setItem("currentFreight", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentFreightUser", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentUser", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("userRole", "freight");
    await AsyncStorage.setItem("currentUserRole", "freight");

    setCarrier(normalizedCarrier);
    return normalizedCarrier;
  }

  async function loadScreen() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();
      const email = normalize(stored?.email || authData?.user?.email || "");

      if (!email) {
        router.replace(FREIGHT_ROUTES.login as any);
        return;
      }

      const { data: dbCarrier, error: carrierError } = await supabase
        .from("freight_users")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (carrierError) console.log("Load issues carrier error:", carrierError.message);

      if (!dbCarrier) {
        Alert.alert("Freight Profile Missing", "Please complete freight registration first.");
        router.replace(FREIGHT_ROUTES.register as any);
        return;
      }

      const mergedCarrier = await persistCarrier({
        ...(stored || {}),
        ...(dbCarrier || {}),
        id: dbCarrier.id,
        freightId: dbCarrier.id,
        role: "freight",
        email: normalize(dbCarrier.email || email),
        companyName:
          dbCarrier.company_name ||
          dbCarrier.business_name ||
          stored?.companyName ||
          stored?.businessName ||
          "Freight Connect Carrier",
      });

      const { data, error } = await supabase
        .from("freight_loads")
        .select("*")
        .or(`carrier_id.eq.${mergedCarrier.id},driver_id.eq.${mergedCarrier.id},accepted_by.eq.${mergedCarrier.id}`)
        .order("updated_at", { ascending: false });

      if (error) {
        console.log("Load issues loads error:", error.message);
        setLoads([]);
        return;
      }

      const cloudLoads = Array.isArray(data) ? data : [];
      setLoads(cloudLoads);

      if (!selectedLoadId && cloudLoads.length > 0) {
        setSelectedLoadId(String(cloudLoads[0].id));
      }
    } catch (error: any) {
      Alert.alert("Load Issues Error", error?.message || "Unable to load freight issues.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadScreen();
  }

  function openRouteDetails(loadId: string) {
    router.push({
      pathname: FREIGHT_ROUTES.routeDetails as any,
      params: { loadId },
    });
  }

  async function submitIssue() {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      return;
    }

    if (!selectedLoad?.id) {
      Alert.alert("Select Load", "Please select a freight load.");
      return;
    }

    if (!issueNotes.trim()) {
      Alert.alert("Issue Notes Required", "Please describe the load issue.");
      return;
    }

    try {
      setSubmitting(true);

      const now = new Date().toISOString();

      const updatePayload: any = {
        dispute_status: "pending_review",
        dispute_reason: `${issueType}: ${issueNotes.trim()}`,
        settlement_status: "hold",
        payout_status: "hold",
        updated_at: now,
      };

      if (issueType === "Damaged Goods") updatePayload.damage_notes = issueNotes.trim();
      if (issueType === "Shortage") updatePayload.shortage_notes = issueNotes.trim();
      if (issueType === "Temperature Issue") updatePayload.temperature_issue_notes = issueNotes.trim();
      if (issueType === "Livestock Issue") updatePayload.livestock_issue_notes = issueNotes.trim();
      if (issueType === "Rejected Delivery") updatePayload.rejected_delivery_notes = issueNotes.trim();

      const { error } = await supabase
        .from("freight_loads")
        .update(updatePayload)
        .eq("id", selectedLoad.id);

      if (error) throw error;

      await supabase.from("support_tickets").insert({
        user_id: carrier.id,
        freight_id: carrier.id,
        role: "freight",
        category: "load_issue",
        subject: `${issueType} - ${selectedLoad.title || selectedLoad.commodity || "Freight Load"}`,
        message: issueNotes.trim(),
        status: "open",
        priority: "high",
        load_id: selectedLoad.id,
        email: carrier.email || null,
        name: carrier.companyName || carrier.businessName || "Freight Carrier",
        created_at: now,
        updated_at: now,
      });

      setIssueNotes("");

      Alert.alert(
        "Issue Submitted",
        "The load issue was recorded, settlement was placed on hold, and support was notified.",
        [
          {
            text: "Disputes",
            onPress: () => router.replace(FREIGHT_ROUTES.disputes as any),
          },
        ]
      );

      await loadScreen();
    } catch (error: any) {
      Alert.alert("Submit Error", error?.message || "Unable to submit load issue.");
    } finally {
      setSubmitting(false);
    }
  }

  function renderLoad({ item }: { item: any }) {
    const active = String(item.id) === String(selectedLoadId);
    const hasIssue = Boolean(item.dispute_status || item.dispute_reason);

    return (
      <TouchableOpacity
        style={[styles.loadCard, active && styles.loadCardActive]}
        onPress={() => setSelectedLoadId(String(item.id))}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.loadTitle}>{item.title || item.commodity || "Freight Load"}</Text>
          <Text style={styles.loadRoute}>
            {item.pickup_location || "Pickup"} → {item.dropoff_location || "Dropoff"}
          </Text>
          <Text style={styles.loadMeta}>
            Status: {String(item.status || "active").replace(/_/g, " ")} · Delivered:{" "}
            {formatDate(item.delivered_at || item.updated_at)}
          </Text>
        </View>

        {hasIssue && (
          <View style={styles.issueBadge}>
            <Text style={styles.issueBadgeText}>Issue</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading load issues...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Farm2Home Freight Connect</Text>
            <Text style={styles.title}>Load Issues</Text>
            <Text style={styles.subtitle}>
              Report damaged goods, shortages, rejected delivery, temperature issues,
              livestock problems, route delays, or pickup problems.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.disputes)}>
            <Ionicons name="warning-outline" size={34} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.carrierCard}>
          <View style={styles.avatar}>
            <Ionicons name="business-outline" size={28} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.carrierName}>{carrier?.companyName || "Freight Connect Carrier"}</Text>
            <Text style={styles.carrierEmail}>{carrier?.email || "Carrier workspace"}</Text>
          </View>
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="alert-circle-outline" label="Disputes" route={FREIGHT_ROUTES.disputes} />
          <QuickLink icon="receipt-outline" label="Settlements" route={FREIGHT_ROUTES.settlements} />
          <QuickLink icon="briefcase-outline" label="My Loads" route={FREIGHT_ROUTES.myLoads} />
          <QuickLink icon="headset-outline" label="Support" route={FREIGHT_ROUTES.support} />
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Settlement Hold Notice</Text>
          <Text style={styles.noticeText}>
            Submitting a load issue may place the payout or settlement on hold until Farm2Home
            reviews proof, notes, product condition, and route records.
          </Text>
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="cube-outline"
            title="Select Load"
            subtitle="Choose the freight load connected to this issue."
          />

          <FlatList
            data={loads}
            keyExtractor={(item, index) => String(item.id || index)}
            scrollEnabled={false}
            renderItem={renderLoad}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>No assigned loads found.</Text>
                <Text style={styles.emptyText}>
                  Assigned freight loads will appear here when available.
                </Text>
              </View>
            }
          />
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="alert-circle-outline"
            title="Issue Type"
            subtitle="Select the issue category."
          />

          <View style={styles.optionGrid}>
            {ISSUE_TYPES.map((item) => {
              const active = issueType === item;

              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.optionButton, active && styles.optionButtonActive]}
                  onPress={() => setIssueType(item)}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Issue Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={issueNotes}
            onChangeText={setIssueNotes}
            placeholder="Describe the issue, product condition, shortage quantity, temperature problem, delay, rejection reason, or livestock concern."
            placeholderTextColor="#94A3B8"
            multiline
            textAlignVertical="top"
          />

          {selectedLoad?.id && (
            <TouchableOpacity
              style={styles.routeButton}
              onPress={() => openRouteDetails(String(selectedLoad.id))}
            >
              <Ionicons name="trail-sign-outline" size={18} color={COLORS.red} />
              <Text style={styles.routeButtonText}>View Selected Route Details</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, submitting && styles.disabledButton]}
            onPress={submitIssue}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="send-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryText}>Submit Load Issue</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.darkButton} onPress={() => goTo(FREIGHT_ROUTES.managementCenter)}>
          <Ionicons name="apps-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Management Center</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={20} color="#FFFFFF" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function QuickLink({
  icon,
  label,
  route,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: FreightRoute;
}) {
  return (
    <TouchableOpacity style={styles.quickLink} onPress={() => goTo(route)}>
      <Ionicons name={icon} size={22} color={COLORS.red} />
      <Text style={styles.quickText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 90 },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  centerText: { color: COLORS.muted, marginTop: 12, fontWeight: "800" },
  hero: {
    backgroundColor: COLORS.black,
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 30,
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 24,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    color: "#FCA5A5",
    fontWeight: "900",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
  },
  title: { color: "#FFFFFF", fontSize: 32, fontWeight: "900", marginBottom: 10 },
  subtitle: { color: "#D1D5DB", lineHeight: 22, fontWeight: "700" },
  carrierCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  carrierName: { color: COLORS.text, fontSize: 19, fontWeight: "900" },
  carrierEmail: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  quickLink: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    gap: 8,
  },
  quickText: { color: COLORS.text, fontWeight: "900", textAlign: "center" },
  notice: {
    backgroundColor: COLORS.black,
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 22,
    padding: 18,
  },
  noticeTitle: { color: "#FFFFFF", fontSize: 21, fontWeight: "900", marginBottom: 7 },
  noticeText: { color: "#D1D5DB", fontWeight: "700", lineHeight: 22 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 14,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900" },
  sectionSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 3 },
  loadCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 13,
    marginBottom: 10,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  loadCardActive: {
    borderColor: COLORS.red,
    backgroundColor: "#FFF1F2",
  },
  loadTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  loadRoute: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  loadMeta: { color: COLORS.text, fontWeight: "700", marginTop: 4 },
  issueBadge: {
    backgroundColor: COLORS.red,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  issueBadgeText: { color: "#FFFFFF", fontWeight: "900", fontSize: 11 },
  emptyBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
  },
  emptyTitle: { color: COLORS.text, fontWeight: "900", fontSize: 17 },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  optionButton: {
    width: "48%",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  optionButtonActive: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },
  optionText: { color: COLORS.text, fontWeight: "900", textAlign: "center" },
  optionTextActive: { color: "#FFFFFF" },
  label: { color: COLORS.text, fontWeight: "900", marginBottom: 7, marginTop: 8 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    color: COLORS.text,
    fontWeight: "700",
    marginBottom: 12,
  },
  textArea: { minHeight: 120 },
  routeButton: {
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 14,
    padding: 13,
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  routeButtonText: { color: COLORS.red, fontWeight: "900" },
  primaryButton: {
    backgroundColor: COLORS.red,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: { opacity: 0.6 },
  primaryText: { color: "#FFFFFF", fontWeight: "900" },
  darkButton: {
    backgroundColor: COLORS.black,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
});