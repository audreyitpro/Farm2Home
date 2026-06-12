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
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const FREIGHT_ROUTES = {
  dashboard: "/freight/dashboard",
  managementCenter: "/freight/freight-management-center",
  myLoads: "/freight/my-loads",
  liveLoads: "/freight/live-loads",
  liveRoute: "/freight/live-route",
  routeDetails: "/freight/route-details",
  routeExceptions: "/freight/route-exceptions",
  disputes: "/freight/disputes",
  support: "/freight/support",
  settlements: "/freight/settlements",
  notifications: "/freight/notifications",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];

type FreightLoad = {
  id: string;
  title?: string | null;
  commodity?: string | null;
  status?: string | null;

  pickup_location?: string | null;
  dropoff_location?: string | null;
  pickup_date?: string | null;
  pickup_time?: string | null;
  dropoff_date?: string | null;
  dropoff_time?: string | null;

  carrier_id?: string | null;
  driver_id?: string | null;
  accepted_by?: string | null;

  rate?: number | null;
  payout_amount?: number | null;
  freight_total?: number | null;
  total_due?: number | null;
  distance_miles?: number | null;
  equipment_type?: string | null;

  dispute_status?: string | null;
  dispute_reason?: string | null;
  settlement_status?: string | null;
  payout_status?: string | null;

  delivered_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

const ISSUE_TYPES = [
  "Cargo Damage",
  "Temperature Excursion",
  "Missing Items",
  "Incorrect Shipment",
  "Vehicle Breakdown",
  "Traffic Delay",
  "Weather Delay",
  "Customer Unavailable",
  "Farm Unavailable",
  "Blocked Access",
  "Rejected Delivery",
  "Livestock Issue",
  "Safety Incident",
  "Accident",
  "Other",
];

const SEVERITY_LEVELS = ["Low", "Medium", "High", "Critical"];

const ACTIVE_LOAD_STATUSES = [
  "assigned",
  "accepted",
  "arrived_pickup",
  "picked_up",
  "in_transit",
  "arrived_dropoff",
  "delayed",
  "delivered",
];

const COLORS = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  redSoft: "#FFF1F2",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  greenSoft: "#DCFCE7",
  amber: "#D97706",
  amberSoft: "#FEF3C7",
  blue: "#2563EB",
  blueSoft: "#DBEAFE",
  slate: "#64748B",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

function money(value: any) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";

  return date.toLocaleDateString();
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not recorded";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";

  return date.toLocaleString();
}

function friendlyStatus(value?: string | null) {
  return String(value || "active")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function severityPriority(severity: string) {
  const value = normalize(severity);

  if (value === "critical") return "urgent";
  if (value === "high") return "high";
  if (value === "medium") return "medium";
  return "low";
}

function severityStyle(severity: string) {
  const value = normalize(severity);

  if (value === "critical") {
    return {
      bg: COLORS.red,
      text: "#FFFFFF",
      border: COLORS.red,
    };
  }

  if (value === "high") {
    return {
      bg: COLORS.redSoft,
      text: COLORS.red,
      border: COLORS.red,
    };
  }

  if (value === "medium") {
    return {
      bg: COLORS.amberSoft,
      text: COLORS.amber,
      border: COLORS.amber,
    };
  }

  return {
    bg: COLORS.blueSoft,
    text: COLORS.blue,
    border: COLORS.blue,
  };
}

function shouldHoldSettlement(issueType: string, severity: string) {
  const type = normalize(issueType);
  const level = normalize(severity);

  if (level === "critical" || level === "high") return true;

  return [
    "cargo damage",
    "temperature excursion",
    "missing items",
    "incorrect shipment",
    "rejected delivery",
    "livestock issue",
    "safety incident",
    "accident",
  ].includes(type);
}

function shouldMarkDelayed(issueType: string) {
  const type = normalize(issueType);

  return [
    "vehicle breakdown",
    "traffic delay",
    "weather delay",
    "customer unavailable",
    "farm unavailable",
    "blocked access",
  ].includes(type);
}

export default function FreightLoadIssuesScreen() {
  const params = useLocalSearchParams();
  const rawLoadId = params.loadId;
  const routeLoadId = Array.isArray(rawLoadId) ? rawLoadId[0] : String(rawLoadId || "");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);
  const [loads, setLoads] = useState<FreightLoad[]>([]);
  const [selectedLoadId, setSelectedLoadId] = useState(routeLoadId || "");
  const [issueType, setIssueType] = useState("Cargo Damage");
  const [severity, setSeverity] = useState("High");
  const [issueNotes, setIssueNotes] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [estimatedDelay, setEstimatedDelay] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadScreen();
    }, [routeLoadId])
  );

  const selectedLoad = useMemo(() => {
    return loads.find((item) => String(item.id) === String(selectedLoadId));
  }, [loads, selectedLoadId]);

  const selectedSeverityStyle = severityStyle(severity);

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
      stripeAccountId:
        nextCarrier.stripeAccountId || nextCarrier.stripe_account_id || "",
      stripe_account_id:
        nextCarrier.stripe_account_id || nextCarrier.stripeAccountId || "",
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

      if (carrierError) {
        console.log("Load issues carrier error:", carrierError.message);
      }

      if (!dbCarrier) {
        Alert.alert(
          "Freight Profile Missing",
          "Please complete freight registration first."
        );
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
        businessName:
          dbCarrier.business_name ||
          dbCarrier.company_name ||
          stored?.businessName ||
          stored?.companyName ||
          "Freight Connect Carrier",
      });

      let query = supabase.from("freight_loads").select("*");

      if (routeLoadId) {
        query = query.eq("id", routeLoadId);
      } else {
        query = query
          .or(
            `carrier_id.eq.${mergedCarrier.id},driver_id.eq.${mergedCarrier.id},accepted_by.eq.${mergedCarrier.id}`
          )
          .in("status", ACTIVE_LOAD_STATUSES);
      }

      const { data, error } = await query.order("updated_at", { ascending: false });

      if (error) {
        console.log("Load issues loads error:", error.message);
        setLoads([]);
        return;
      }

      const cloudLoads = Array.isArray(data) ? (data as FreightLoad[]) : [];
      setLoads(cloudLoads);

      if (routeLoadId) {
        setSelectedLoadId(routeLoadId);
      } else if (!selectedLoadId && cloudLoads.length > 0) {
        setSelectedLoadId(String(cloudLoads[0].id));
      }
    } catch (error: any) {
      Alert.alert(
        "Load Issues Error",
        error?.message || "Unable to load freight issues."
      );
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

  function openLiveRoute(loadId: string) {
    router.push({
      pathname: FREIGHT_ROUTES.liveRoute as any,
      params: { loadId },
    });
  }

  function openRouteException(loadId: string) {
    router.push({
      pathname: FREIGHT_ROUTES.routeExceptions as any,
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
      const holdSettlement = shouldHoldSettlement(issueType, severity);
      const markDelayed = shouldMarkDelayed(issueType);

      const issueSummary = `${issueType} (${severity})`;
      const issueMessage = [
        `Issue Type: ${issueType}`,
        `Severity: ${severity}`,
        estimatedDelay.trim() ? `Estimated Delay: ${estimatedDelay.trim()} minutes` : "",
        contactPhone.trim() ? `Contact Phone: ${contactPhone.trim()}` : "",
        "",
        issueNotes.trim(),
      ]
        .filter(Boolean)
        .join("\n");

      const updatePayload: any = {
        dispute_status: "pending_review",
        dispute_reason: `${issueSummary}: ${issueNotes.trim()}`,
        updated_at: now,
      };

      if (holdSettlement) {
        updatePayload.settlement_status = "hold";
        updatePayload.payout_status = "hold";
      }

      if (markDelayed) {
        updatePayload.status = "delayed";
        updatePayload.live_route_status = "delayed";
        updatePayload.delay_reason = `${issueType}: ${issueNotes.trim()}`;

        const parsedDelay = Number(estimatedDelay);
        if (!Number.isNaN(parsedDelay) && parsedDelay > 0) {
          updatePayload.eta_delay_minutes = parsedDelay;
        }
      }

      if (issueType === "Cargo Damage") updatePayload.damage_notes = issueNotes.trim();
      if (issueType === "Missing Items") updatePayload.shortage_notes = issueNotes.trim();
      if (issueType === "Temperature Excursion") {
        updatePayload.temperature_issue_notes = issueNotes.trim();
      }
      if (issueType === "Livestock Issue") {
        updatePayload.livestock_issue_notes = issueNotes.trim();
      }
      if (issueType === "Rejected Delivery") {
        updatePayload.rejected_delivery_notes = issueNotes.trim();
      }

      const { error: loadError } = await supabase
        .from("freight_loads")
        .update(updatePayload)
        .eq("id", selectedLoad.id);

      if (loadError) throw loadError;

      const ticketPayload = {
        user_id: carrier.id,
        freight_id: carrier.id,
        role: "freight",
        category: "load_issue",
        subject: `${issueSummary} - ${
          selectedLoad.title || selectedLoad.commodity || "Freight Load"
        }`,
        message: issueMessage,
        status: "open",
        priority: severityPriority(severity),
        load_id: selectedLoad.id,
        email: carrier.email || null,
        name:
          carrier.companyName ||
          carrier.businessName ||
          carrier.company_name ||
          carrier.business_name ||
          "Freight Carrier",
        created_at: now,
        updated_at: now,
      };

      const { error: ticketError } = await supabase
        .from("support_tickets")
        .insert(ticketPayload);

      if (ticketError) throw ticketError;

      await supabase.from("freight_notifications").insert({
        freight_user_id: carrier.id,
        load_id: selectedLoad.id,
        title: "Load Issue Submitted",
        message: `${issueSummary} was submitted for ${
          selectedLoad.title || selectedLoad.commodity || "this freight load"
        }.`,
        type: "load_issue",
        is_read: false,
        created_at: now,
      });

      setIssueNotes("");
      setContactPhone("");
      setEstimatedDelay("");

      Alert.alert(
        "Issue Submitted",
        holdSettlement
          ? "The load issue was recorded, settlement was placed on hold, and support was notified."
          : "The load issue was recorded and support was notified.",
        [
          {
            text: "View Disputes",
            onPress: () => router.replace(FREIGHT_ROUTES.disputes as any),
          },
          {
            text: "Stay Here",
            style: "cancel",
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

  function renderLoad({ item }: { item: FreightLoad }) {
    const active = String(item.id) === String(selectedLoadId);
    const hasIssue = Boolean(item.dispute_status || item.dispute_reason);
    const payout =
      item.rate || item.payout_amount || item.freight_total || item.total_due || 0;

    return (
      <TouchableOpacity
        style={[styles.loadCard, active && styles.loadCardActive]}
        onPress={() => setSelectedLoadId(String(item.id))}
        activeOpacity={0.85}
      >
        <View style={{ flex: 1 }}>
          <View style={styles.loadTitleRow}>
            <Text style={styles.loadTitle}>
              {item.title || item.commodity || "Freight Load"}
            </Text>

            {active && (
              <View style={styles.selectedBadge}>
                <Text style={styles.selectedBadgeText}>Selected</Text>
              </View>
            )}
          </View>

          <Text style={styles.loadRoute}>
            {item.pickup_location || "Pickup"} → {item.dropoff_location || "Dropoff"}
          </Text>

          <Text style={styles.loadMeta}>
            Status: {friendlyStatus(item.status)} · Updated:{" "}
            {formatDate(item.updated_at || item.created_at)}
          </Text>

          <Text style={styles.loadMeta}>
            Equipment: {item.equipment_type || "Standard"} · Payout: {money(payout)}
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
              Report cargo problems, delays, safety events, rejected delivery, missing items,
              temperature problems, or freight access issues.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.heroIcon}
            onPress={() => goTo(FREIGHT_ROUTES.disputes)}
            activeOpacity={0.85}
          >
            <Ionicons name="warning-outline" size={34} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.carrierCard}>
          <View style={styles.avatar}>
            <Ionicons name="business-outline" size={28} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.carrierName}>
              {carrier?.companyName || carrier?.businessName || "Freight Connect Carrier"}
            </Text>
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
          <View style={styles.noticeHeader}>
            <Ionicons name="shield-checkmark-outline" size={22} color="#FFFFFF" />
            <Text style={styles.noticeTitle}>Settlement Review Notice</Text>
          </View>

          <Text style={styles.noticeText}>
            High or critical load issues may place payout and settlement on hold until Farm2Home
            reviews route records, issue notes, proof photos, condition notes, and customer or farm
            confirmation.
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
                <Ionicons name="file-tray-outline" size={34} color={COLORS.red} />
                <Text style={styles.emptyTitle}>No assigned loads found.</Text>
                <Text style={styles.emptyText}>
                  Assigned freight loads will appear here when available.
                </Text>

                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => goTo(FREIGHT_ROUTES.liveLoads)}
                >
                  <Ionicons name="pulse-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.emptyButtonText}>Open Live Loads</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="alert-circle-outline"
            title="Issue Details"
            subtitle="Select a category, severity, and enter clear notes for review."
          />

          <Text style={styles.label}>Issue Type</Text>

          <View style={styles.optionGrid}>
            {ISSUE_TYPES.map((item) => {
              const active = issueType === item;

              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.optionButton, active && styles.optionButtonActive]}
                  onPress={() => setIssueType(item)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Severity</Text>

          <View style={styles.severityGrid}>
            {SEVERITY_LEVELS.map((item) => {
              const active = severity === item;
              const palette = severityStyle(item);

              return (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.severityButton,
                    {
                      borderColor: active ? palette.border : COLORS.border,
                      backgroundColor: active ? palette.bg : COLORS.surface,
                    },
                  ]}
                  onPress={() => setSeverity(item)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.severityText,
                      {
                        color: active ? palette.text : COLORS.text,
                      },
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View
            style={[
              styles.severityNotice,
              {
                borderColor: selectedSeverityStyle.border,
                backgroundColor:
                  severity === "Critical"
                    ? COLORS.redSoft
                    : severity === "High"
                    ? COLORS.redSoft
                    : severity === "Medium"
                    ? COLORS.amberSoft
                    : COLORS.blueSoft,
              },
            ]}
          >
            <Text style={[styles.severityNoticeTitle, { color: selectedSeverityStyle.text }]}>
              Current Severity: {severity}
            </Text>
            <Text style={styles.severityNoticeText}>
              {shouldHoldSettlement(issueType, severity)
                ? "This issue is likely to place the load payout or settlement under review."
                : "This issue will be logged for support review without automatically holding settlement unless required."}
            </Text>
          </View>

          <Text style={styles.label}>Estimated Delay Minutes</Text>
          <TextInput
            style={styles.input}
            value={estimatedDelay}
            onChangeText={setEstimatedDelay}
            placeholder="Example: 45"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
          />

          <Text style={styles.label}>Best Contact Phone</Text>
          <TextInput
            style={styles.input}
            value={contactPhone}
            onChangeText={setContactPhone}
            placeholder="Optional phone number for urgent follow-up"
            placeholderTextColor="#94A3B8"
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Issue Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={issueNotes}
            onChangeText={setIssueNotes}
            placeholder="Describe what happened, product condition, shortage count, rejected delivery reason, temperature concern, blocked access, safety concern, or delay details."
            placeholderTextColor="#94A3B8"
            multiline
            textAlignVertical="top"
          />

          <View style={styles.attachmentBox}>
            <Ionicons name="images-outline" size={22} color={COLORS.red} />
            <View style={{ flex: 1 }}>
              <Text style={styles.attachmentTitle}>Photo / document proof</Text>
              <Text style={styles.attachmentText}>
                Add upload support later using Expo ImagePicker or DocumentPicker. This issue
                screen is ready for notes, support ticket creation, and load status updates.
              </Text>
            </View>
          </View>

          {selectedLoad?.id && (
            <View style={styles.secondaryActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => openRouteDetails(String(selectedLoad.id))}
                activeOpacity={0.85}
              >
                <Ionicons name="trail-sign-outline" size={18} color={COLORS.red} />
                <Text style={styles.secondaryButtonText}>Route Details</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => openLiveRoute(String(selectedLoad.id))}
                activeOpacity={0.85}
              >
                <Ionicons name="map-outline" size={18} color={COLORS.red} />
                <Text style={styles.secondaryButtonText}>Live Route</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => openRouteException(String(selectedLoad.id))}
                activeOpacity={0.85}
              >
                <Ionicons name="alert-outline" size={18} color={COLORS.red} />
                <Text style={styles.secondaryButtonText}>Exception</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, submitting && styles.disabledButton]}
            onPress={submitIssue}
            disabled={submitting}
            activeOpacity={0.85}
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

        <TouchableOpacity
          style={styles.darkButton}
          onPress={() => goTo(FREIGHT_ROUTES.managementCenter)}
          activeOpacity={0.85}
        >
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
    <TouchableOpacity style={styles.quickLink} onPress={() => goTo(route)} activeOpacity={0.85}>
      <Ionicons name={icon} size={22} color={COLORS.red} />
      <Text style={styles.quickText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    paddingBottom: 90,
  },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  centerText: {
    color: COLORS.muted,
    marginTop: 12,
    fontWeight: "800",
  },
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
  title: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    marginBottom: 10,
  },
  subtitle: {
    color: "#D1D5DB",
    lineHeight: 22,
    fontWeight: "700",
  },
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
  carrierName: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "900",
  },
  carrierEmail: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 4,
  },
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
  quickText: {
    color: COLORS.text,
    fontWeight: "900",
    textAlign: "center",
  },
  notice: {
    backgroundColor: COLORS.black,
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 22,
    padding: 18,
  },
  noticeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 7,
  },
  noticeTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
  },
  noticeText: {
    color: "#D1D5DB",
    fontWeight: "700",
    lineHeight: 22,
  },
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
  sectionTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 3,
  },
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
    backgroundColor: COLORS.redSoft,
  },
  loadTitleRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },
  loadTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
    flexShrink: 1,
  },
  selectedBadge: {
    backgroundColor: COLORS.red,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  selectedBadgeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 10,
  },
  loadRoute: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 4,
  },
  loadMeta: {
    color: COLORS.text,
    fontWeight: "700",
    marginTop: 4,
  },
  issueBadge: {
    backgroundColor: COLORS.red,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  issueBadgeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 11,
  },
  emptyBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
  },
  emptyTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 17,
    marginTop: 8,
  },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
  emptyButton: {
    backgroundColor: COLORS.red,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  label: {
    color: COLORS.text,
    fontWeight: "900",
    marginBottom: 7,
    marginTop: 8,
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
  optionText: {
    color: COLORS.text,
    fontWeight: "900",
    textAlign: "center",
  },
  optionTextActive: {
    color: "#FFFFFF",
  },
  severityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  severityButton: {
    width: "48%",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  severityText: {
    fontWeight: "900",
    textAlign: "center",
  },
  severityNotice: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 13,
    marginBottom: 10,
  },
  severityNoticeTitle: {
    fontWeight: "900",
    marginBottom: 4,
  },
  severityNoticeText: {
    color: COLORS.text,
    fontWeight: "700",
    lineHeight: 20,
  },
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
  textArea: {
    minHeight: 130,
  },
  attachmentBox: {
    backgroundColor: COLORS.redSoft,
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 16,
    padding: 13,
    marginBottom: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  attachmentTitle: {
    color: COLORS.text,
    fontWeight: "900",
  },
  attachmentText: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 3,
  },
  secondaryActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  secondaryButton: {
    flexGrow: 1,
    minWidth: "31%",
    backgroundColor: COLORS.redSoft,
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  secondaryButtonText: {
    color: COLORS.red,
    fontWeight: "900",
    textAlign: "center",
    fontSize: 12,
  },
  primaryButton: {
    backgroundColor: COLORS.red,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
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