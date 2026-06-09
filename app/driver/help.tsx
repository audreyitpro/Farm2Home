// app/driver/help.tsx

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

import { supabase } from "../services/supabaseClient";

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
  slate: "#475569",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

export default function DriverHelpScreen() {
  const [loading, setLoading] = useState(true);
  const [driver, setDriver] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      loadDriver();
    }, [])
  );

  async function getStoredDriver() {
    const raw =
      (await AsyncStorage.getItem("currentDriver")) ||
      (await AsyncStorage.getItem("farm2homeCurrentDriver")) ||
      (await AsyncStorage.getItem("farm2homeDriverSession")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function loadDriver() {
    try {
      setLoading(true);

      const stored = await getStoredDriver();
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;

      const driverId = stored?.id || stored?.driverId || authUser?.id || "";
      const email = normalize(stored?.email || authUser?.email || "");

      let dbDriver: any = null;

      if (driverId) {
        const result = await supabase
          .from("drivers")
          .select("*")
          .eq("id", driverId)
          .maybeSingle();

        if (!result.error && result.data) dbDriver = result.data;
      }

      if (!dbDriver && email) {
        const result = await supabase
          .from("drivers")
          .select("*")
          .eq("email", email)
          .maybeSingle();

        if (!result.error && result.data) dbDriver = result.data;
      }

      const merged = {
        ...(stored || {}),
        ...(dbDriver || {}),
        id: dbDriver?.id || stored?.id || stored?.driverId || authUser?.id || "",
        driverId: dbDriver?.id || stored?.driverId || stored?.id || authUser?.id || "",
        role: "driver",
        email: normalize(dbDriver?.email || stored?.email || email),
        fullName:
          dbDriver?.full_name ||
          dbDriver?.name ||
          stored?.fullName ||
          stored?.name ||
          "Farm2Home Driver",
      };

      setDriver(merged);
    } catch (error) {
      console.log("Load driver help error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function callSupport() {
    await Linking.openURL("tel:+18005550199");
  }

  async function emailSupport() {
    const mailUrl = `mailto:support@farm2home.app?subject=Farm2Home Driver Help&body=Driver: ${encodeURIComponent(
      driver?.fullName || driver?.name || "Driver"
    )}%0AEmail: ${encodeURIComponent(driver?.email || "")}%0A%0AMessage:%0A`;

    await Linking.openURL(mailUrl);
  }

  function showEmergencyNotice() {
    Alert.alert(
      "Emergency Delivery Issue",
      "For live delivery emergencies, contact the customer/farmer through chat first, then call Farm2Home support if the delivery cannot continue."
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.red} />
          <Text style={styles.centerText}>Loading driver help...</Text>
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
          <Text style={styles.eyebrow}>Farm2Driver Knowledge Center</Text>
          <Text style={styles.title}>Driver Help</Text>
          <Text style={styles.subtitle}>
            Learn how to use the Driver Board, accept deliveries, complete proof
            workflows, handle freight loads, and manage your driver account.
          </Text>
        </View>

        <View style={styles.driverCard}>
          <View style={styles.avatar}>
            <Ionicons name="help-buoy-outline" size={28} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.driverName}>
              {driver?.fullName || driver?.name || "Farm2Home Driver"}
            </Text>
            <Text style={styles.driverEmail}>{driver?.email || "Driver account"}</Text>
          </View>
        </View>

        <View style={styles.quickGrid}>
          <QuickAction icon="call-outline" label="Call Support" onPress={callSupport} />
          <QuickAction icon="mail-outline" label="Email Support" onPress={emailSupport} />
          <QuickAction
            icon="chatbubbles-outline"
            label="Chat Center"
            onPress={() => router.push("/chat-center" as any)}
          />
          <QuickAction
            icon="alert-circle-outline"
            label="Emergency"
            onPress={showEmergencyNotice}
          />
        </View>

        <HelpSection
          icon="list-outline"
          title="Using the Driver Board"
          items={[
            "Open the Driver Board from the Driver Hub.",
            "Review local deliveries and freight loads before accepting.",
            "Use batch opportunities when multiple orders share a route.",
            "Only accept deliveries you can complete safely and on time.",
            "Accepted loads move into My Deliveries.",
          ]}
        />

        <HelpSection
          icon="cube-outline"
          title="Pickup Workflow"
          items={[
            "Navigate to My Deliveries and open the assigned order.",
            "Use Proof of Pickup when you arrive at the farm or pickup point.",
            "Take a clear pickup photo using camera or gallery.",
            "Confirm items, quantity, and any cold-chain notes.",
            "Pickup confirmation updates delivery status across the system.",
          ]}
        />

        <HelpSection
          icon="checkmark-done-outline"
          title="Delivery Workflow"
          items={[
            "Use Proof of Delivery when you arrive at the drop-off.",
            "Capture delivery photo, receiver name, and optional signature.",
            "Report damage if anything is missing, spoiled, or unsafe.",
            "Add temperature details when the load is cold-chain sensitive.",
            "Completing delivery updates orders, delivery_orders, freight_loads, proofs, and driver location records.",
          ]}
        />

        <HelpSection
          icon="navigate-outline"
          title="Live Location"
          items={[
            "Keep location permissions enabled while working.",
            "Live location helps farmers and customers track active deliveries.",
            "Use the Live Location Provider screen to sync GPS updates.",
            "Turn off active availability when you are done driving.",
          ]}
        />

        <HelpSection
          icon="wallet-outline"
          title="Earnings and Membership"
          items={[
            "The Earnings screen shows completed loads and payout summaries.",
            "Driver membership is required for Driver Board access.",
            "Use Subscription or Profile to manage Stripe billing.",
            "Completed delivery payouts are calculated from delivery or freight load data.",
          ]}
        />

        <HelpSection
          icon="trail-sign-outline"
          title="Freight Loads"
          items={[
            "Freight loads may include livestock, hay, farm bulk loads, and long-distance routes.",
            "Freight eligibility can be managed from Driver Settings or Profile.",
            "Review pickup requirements, load weight, distance, and payout before accepting.",
            "Freight loads also require pickup and delivery proof when assigned.",
          ]}
        />

        <View style={styles.card}>
          <SectionHeader
            icon="navigate-circle-outline"
            title="Driver Portal Shortcuts"
            subtitle="Jump directly to the screen you need."
          />

          <RouteButton title="Driver Hub" onPress={() => router.push("/driver/mobile-driver-app" as any)} />
          <RouteButton title="Driver Board" onPress={() => router.push("/driver/board" as any)} />
          <RouteButton title="My Deliveries" onPress={() => router.push("/driver/my-deliveries" as any)} />
          <RouteButton title="Proof of Pickup" onPress={() => router.push("/driver/proof-of-pickup" as any)} />
          <RouteButton title="Proof of Delivery" onPress={() => router.push("/driver/proof-of-delivery" as any)} />
          <RouteButton title="Earnings" onPress={() => router.push("/driver/earnings" as any)} />
          <RouteButton title="Profile" onPress={() => router.push("/driver/profile" as any)} />
          <RouteButton title="Support" onPress={() => router.push("/driver/support" as any)} />
        </View>

        <TouchableOpacity
          style={styles.darkButton}
          onPress={() => router.replace("/driver/mobile-driver-app" as any)}
        >
          <Text style={styles.darkButtonText}>Back to Driver Hub</Text>
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
  driverCard: {
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
  driverName: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "900",
  },
  driverEmail: {
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