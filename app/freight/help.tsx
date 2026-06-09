// app/freight/help.tsx

import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
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
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  redDark: "#9F1117",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  amber: "#D97706",
  slate: "#64748B",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

export default function FreightHelpScreen() {
  const [loading, setLoading] = useState(true);
  const [carrier, setCarrier] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      loadCarrier();
    }, [])
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

  async function loadCarrier() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;

      const carrierId = stored?.id || stored?.freightId || authUser?.id || "";
      const email = normalize(stored?.email || authUser?.email || "");

      let dbCarrier: any = null;

      if (carrierId) {
        const result = await supabase
          .from("freight_users")
          .select("*")
          .eq("id", carrierId)
          .maybeSingle();

        if (!result.error && result.data) dbCarrier = result.data;
      }

      if (!dbCarrier && email) {
        const result = await supabase
          .from("freight_users")
          .select("*")
          .eq("email", email)
          .maybeSingle();

        if (!result.error && result.data) dbCarrier = result.data;
      }

      const merged = {
        ...(stored || {}),
        ...(dbCarrier || {}),
        id: dbCarrier?.id || stored?.id || stored?.freightId || authUser?.id || "",
        freightId: dbCarrier?.id || stored?.freightId || stored?.id || authUser?.id || "",
        role: "freight",
        email: normalize(dbCarrier?.email || stored?.email || email),
        companyName:
          dbCarrier?.company_name ||
          dbCarrier?.business_name ||
          stored?.companyName ||
          stored?.businessName ||
          "Freight Connect Carrier",
        contactName:
          dbCarrier?.contact_name ||
          dbCarrier?.name ||
          stored?.contactName ||
          stored?.name ||
          "",
      };

      setCarrier(merged);
    } catch (error) {
      console.log("Load freight help error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function callSupport() {
    await Linking.openURL("tel:+18005550199");
  }

  async function emailSupport() {
    const mailUrl = `mailto:support@farm2home.app?subject=Farm2Home Freight Help&body=Carrier: ${encodeURIComponent(
      carrier?.companyName || carrier?.businessName || "Freight Carrier"
    )}%0AEmail: ${encodeURIComponent(carrier?.email || "")}%0A%0AMessage:%0A`;

    await Linking.openURL(mailUrl);
  }

  function showEmergencyNotice() {
    Alert.alert(
      "Freight Emergency",
      "For urgent route, livestock, cold-chain, or safety issues, contact the pickup/dropoff party first, then call Farm2Home support immediately."
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.red} />
          <Text style={styles.centerText}>Loading freight help...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Farm2Home Freight Knowledge Center</Text>
          <Text style={styles.title}>Freight Help</Text>
          <Text style={styles.subtitle}>
            Learn how to use freight board tools, accept loads, manage carrier
            routes, complete proof workflows, and handle billing or dispatch issues.
          </Text>
        </View>

        <View style={styles.carrierCard}>
          <View style={styles.avatar}>
            <Ionicons name="trail-sign-outline" size={28} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.carrierName}>
              {carrier?.companyName || carrier?.businessName || "Freight Carrier"}
            </Text>
            <Text style={styles.carrierEmail}>{carrier?.email || "Carrier account"}</Text>
          </View>
        </View>

        <View style={styles.quickGrid}>
          <QuickAction icon="call-outline" label="Call Support" onPress={callSupport} />
          <QuickAction icon="mail-outline" label="Email Support" onPress={emailSupport} />
          <QuickAction
            icon="help-buoy-outline"
            label="Support"
            onPress={() => router.push("/freight/support" as any)}
          />
          <QuickAction
            icon="alert-circle-outline"
            label="Emergency"
            onPress={showEmergencyNotice}
          />
        </View>

        <HelpSection
          icon="grid-outline"
          title="Using the Freight Dashboard"
          items={[
            "Open Freight Dashboard to view your active carrier workspace.",
            "Review open loads, active routes, completed loads, and visible route value.",
            "Use dashboard shortcuts to open the load board, profile, settings, or subscription.",
            "Refresh the dashboard to sync the latest freight activity from Supabase.",
          ]}
        />

        <HelpSection
          icon="list-outline"
          title="Using the Freight Board"
          items={[
            "Open the Live Load Board to see available freight opportunities.",
            "Search by city, farmer, commodity, or equipment type.",
            "Use max-mile filters to control route distance.",
            "Select compatible loads for batch acceptance when they share pickup, dropoff, or route direction.",
            "Tap Accept Load to assign a freight load to your carrier account.",
          ]}
        />

        <HelpSection
          icon="cube-outline"
          title="Freight Load Workflow"
          items={[
            "Available loads can be accepted from the freight board.",
            "Accepted loads move into active route workflow.",
            "Update arrival at pickup when you reach the farm or pickup location.",
            "Complete pickup proof when required.",
            "Update arrival at dropoff and complete delivery proof before closing the load.",
          ]}
        />

        <HelpSection
          icon="snow-outline"
          title="Cold-Chain and Fresh Food Freight"
          items={[
            "Check each load for temperature notes before accepting.",
            "Use refrigerated equipment when the load requires cold-chain handling.",
            "Record temperature details during pickup or delivery when required.",
            "Report spoiled, damaged, or unsafe products immediately.",
          ]}
        />

        <HelpSection
          icon="paw-outline"
          title="Livestock and Farm Bulk Loads"
          items={[
            "Only accept livestock or bulk farm loads if your carrier equipment is approved.",
            "Confirm pickup timing, loading requirements, and safety notes before dispatch.",
            "Follow all local transport safety and animal-handling requirements.",
            "Use support if route details, weight, or equipment requirements are unclear.",
          ]}
        />

        <HelpSection
          icon="card-outline"
          title="Membership and Billing"
          items={[
            "Freight membership unlocks freight board access and carrier tools.",
            "Use Subscription to start, manage, or cancel your freight membership.",
            "Use Profile to manage company and carrier details.",
            "If Stripe customer details are missing, complete payment first, then return and sync your account.",
          ]}
        />

        <HelpSection
          icon="map-outline"
          title="Route Tracking"
          items={[
            "Use live route tools for active route visibility.",
            "Keep GPS tracking enabled during active freight movement.",
            "Update pickup, transit, and dropoff statuses as the route progresses.",
            "Contact support if live route tracking does not open or sync correctly.",
          ]}
        />

        <View style={styles.card}>
          <SectionHeader
            icon="navigate-circle-outline"
            title="Freight Portal Shortcuts"
            subtitle="Jump directly to the freight tool you need."
          />

          <RouteButton title="Freight Dashboard" onPress={() => router.push("/freight/dashboard" as any)} />
          <RouteButton title="Live Freight Board" onPress={() => router.push("/freight/board" as any)} />
          <RouteButton title="My Loads" onPress={() => router.push("/freight/my-loads" as any)} />
          <RouteButton title="Live Loads" onPress={() => router.push("/freight/live-loads" as any)} />
          <RouteButton title="Carrier Profile" onPress={() => router.push("/freight/profile" as any)} />
          <RouteButton title="Freight Settings" onPress={() => router.push("/freight/settings" as any)} />
          <RouteButton title="Freight Subscription" onPress={() => router.push("/freight/subscription" as any)} />
          <RouteButton title="Support" onPress={() => router.push("/freight/support" as any)} />
        </View>

        <TouchableOpacity
          style={styles.darkButton}
          onPress={() => router.replace("/freight/dashboard" as any)}
        >
          <Text style={styles.darkButtonText}>Back to Freight Dashboard</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ icon, title, subtitle }: any) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={20} color="#FFFFFF" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

function HelpSection({
  icon,
  title,
  items,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  items: string[];
}) {
  return (
    <View style={styles.card}>
      <SectionHeader icon={icon} title={title} subtitle="" />

      {items.map((item, index) => (
        <View key={`${title}-${index}`} style={styles.helpItem}>
          <View style={styles.helpNumber}>
            <Text style={styles.helpNumberText}>{index + 1}</Text>
          </View>
          <Text style={styles.helpText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function QuickAction({ icon, label, onPress }: any) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <Ionicons name={icon} size={24} color={COLORS.red} />
      <Text style={styles.quickActionText}>{label}</Text>
    </TouchableOpacity>
  );
}

function RouteButton({ title, onPress }: any) {
  return (
    <TouchableOpacity style={styles.routeButton} onPress={onPress}>
      <Text style={styles.routeButtonText}>{title}</Text>
      <Text style={styles.routeArrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 90 },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  centerText: {
    color: COLORS.muted,
    marginTop: 10,
    fontWeight: "800",
  },
  hero: {
    backgroundColor: COLORS.black,
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 30,
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
    fontSize: 14,
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
    alignItems: "center",
    gap: 14,
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
  quickAction: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    gap: 8,
  },
  quickActionText: {
    color: COLORS.text,
    fontWeight: "900",
    textAlign: "center",
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
  helpItem: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  helpNumber: {
    width: 25,
    height: 25,
    borderRadius: 999,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  helpNumberText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },
  helpText: {
    color: COLORS.text,
    fontWeight: "800",
    flex: 1,
    lineHeight: 20,
  },
  routeButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  routeButtonText: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "900",
  },
  routeArrow: {
    color: COLORS.red,
    fontSize: 24,
    fontWeight: "900",
  },
  darkButton: {
    backgroundColor: COLORS.black,
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    marginHorizontal: 18,
    marginBottom: 40,
  },
  darkButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});