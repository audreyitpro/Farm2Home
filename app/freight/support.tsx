// app/freight/support.tsx

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
  board: "/freight/board",
  myLoads: "/freight/my-loads",
  liveLoads: "/freight/live-loads",
  liveRoute: "/freight/live-route",
  profile: "/freight/profile",
  subscription: "/freight/subscription",
  settings: "/freight/settings",
  connectBank: "/freight/connect-bank",
  help: "/freight/help",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];

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

function goTo(route: FreightRoute) {
  router.push(route as any);
}

export default function FreightSupportScreen() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [carrier, setCarrier] = useState<any>(null);

  const [category, setCategory] = useState("load");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

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
      contactName:
        nextCarrier.contactName ||
        nextCarrier.contact_name ||
        nextCarrier.name ||
        "",
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

  async function loadCarrier() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;

      const email = normalize(stored?.email || authUser?.email || "");

      if (!email) {
        router.replace(FREIGHT_ROUTES.login as any);
        return;
      }

      const { data: dbCarrier, error } = await supabase
        .from("freight_users")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (error) {
        console.log("Load freight support profile error:", error.message);
      }

      if (!dbCarrier) {
        Alert.alert(
          "Freight Profile Missing",
          "No freight profile was found. Please complete freight registration first."
        );
        router.replace(FREIGHT_ROUTES.register as any);
        return;
      }

      const merged = {
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
        contactName:
          dbCarrier.contact_name ||
          dbCarrier.name ||
          stored?.contactName ||
          stored?.name ||
          "",
        stripeAccountId:
          dbCarrier.stripe_account_id ||
          stored?.stripeAccountId ||
          stored?.stripe_account_id ||
          "",
        stripe_account_id:
          dbCarrier.stripe_account_id ||
          stored?.stripe_account_id ||
          stored?.stripeAccountId ||
          "",
      };

      await persistCarrier(merged);
    } catch (error) {
      console.log("Load freight support error:", error);
      Alert.alert("Support Error", "Unable to load freight support.");
    } finally {
      setLoading(false);
    }
  }

  async function submitSupportRequest() {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      router.replace(FREIGHT_ROUTES.login as any);
      return;
    }

    if (!subject.trim()) {
      Alert.alert("Subject Required", "Please enter a support subject.");
      return;
    }

    if (!message.trim()) {
      Alert.alert("Message Required", "Please describe what you need help with.");
      return;
    }

    try {
      setSubmitting(true);

      const now = new Date().toISOString();

      const payload = {
        user_id: carrier.id,
        freight_id: carrier.id,
        role: "freight",
        category,
        subject: subject.trim(),
        message: message.trim(),
        status: "open",
        priority: category === "emergency" ? "high" : "normal",
        email: carrier.email || null,
        name:
          carrier.companyName ||
          carrier.businessName ||
          carrier.contactName ||
          "Freight Carrier",
        created_at: now,
        updated_at: now,
      };

      const { error } = await supabase.from("support_tickets").insert(payload);

      if (error) throw error;

      setSubject("");
      setMessage("");

      Alert.alert(
        "Support Request Sent",
        "Farm2Home freight support received your request."
      );
    } catch (error: any) {
      Alert.alert("Support Error", error?.message || "Unable to send support request.");
    } finally {
      setSubmitting(false);
    }
  }

  async function callSupport() {
    try {
      await Linking.openURL("tel:+18005550199");
    } catch {
      Alert.alert("Call Error", "Unable to open phone dialer.");
    }
  }

  async function emailSupport() {
    try {
      const mailUrl = `mailto:support@farm2home.app?subject=Farm2Home Freight Support&body=Carrier: ${encodeURIComponent(
        carrier?.companyName || carrier?.businessName || "Freight Carrier"
      )}%0AEmail: ${encodeURIComponent(carrier?.email || "")}%0A%0AMessage:%0A`;

      await Linking.openURL(mailUrl);
    } catch {
      Alert.alert("Email Error", "Unable to open email app.");
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.red} />
          <Text style={styles.centerText}>Loading freight support...</Text>
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
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Farm2Home Freight Connect</Text>
            <Text style={styles.title}>Freight Support</Text>
            <Text style={styles.subtitle}>
              Get help with freight loads, carrier verification, billing, routing,
              tracking, payouts, and live logistics operations.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.dashboard)}>
            <Ionicons name="headset-outline" size={34} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.carrierCard}>
          <View style={styles.avatar}>
            <Ionicons name="business-outline" size={28} color="#FFFFFF" />
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
          <QuickAction icon="chatbubble-ellipses-outline" label="Live Chat" onPress={() => goTo(FREIGHT_ROUTES.help)} />
          <QuickAction icon="help-circle-outline" label="Help Center" onPress={() => goTo(FREIGHT_ROUTES.help)} />
          <QuickAction icon="list-outline" label="Load Board" onPress={() => goTo(FREIGHT_ROUTES.board)} />
          <QuickAction icon="grid-outline" label="Dashboard" onPress={() => goTo(FREIGHT_ROUTES.dashboard)} />
          <QuickAction icon="briefcase-outline" label="My Loads" onPress={() => goTo(FREIGHT_ROUTES.myLoads)} />
          <QuickAction icon="pulse-outline" label="Live Loads" onPress={() => goTo(FREIGHT_ROUTES.liveLoads)} />
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="help-buoy-outline"
            title="Create Freight Support Ticket"
            subtitle="Send a detailed request to Farm2Home freight operations."
          />

          <Text style={styles.label}>Support Category</Text>
          <View style={styles.optionRow}>
            <OptionButton title="Load" active={category === "load"} onPress={() => setCategory("load")} />
            <OptionButton title="Billing" active={category === "billing"} onPress={() => setCategory("billing")} />
            <OptionButton title="Route" active={category === "route"} onPress={() => setCategory("route")} />
          </View>

          <View style={styles.optionRow}>
            <OptionButton title="Carrier" active={category === "carrier"} onPress={() => setCategory("carrier")} />
            <OptionButton title="Payout" active={category === "payout"} onPress={() => setCategory("payout")} />
            <OptionButton title="Emergency" active={category === "emergency"} onPress={() => setCategory("emergency")} />
          </View>

          <Text style={styles.label}>Subject</Text>
          <TextInput
            style={styles.input}
            value={subject}
            onChangeText={setSubject}
            placeholder="What do you need help with?"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.label}>Message</Text>
          <TextInput
            style={[styles.input, styles.messageInput]}
            value={message}
            onChangeText={setMessage}
            placeholder="Include load ID, route, pickup/dropoff location, billing issue, or carrier concern."
            placeholderTextColor="#9CA3AF"
            multiline
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.primaryButton, submitting && styles.disabledButton]}
            onPress={submitSupportRequest}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="send-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Submit Support Request</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="flash-outline"
            title="Common Freight Issues"
            subtitle="Fast shortcuts for carrier operations."
          />

          <RouteButton title="I cannot accept a freight load" route={FREIGHT_ROUTES.board} />
          <RouteButton title="I need help with my carrier profile" route={FREIGHT_ROUTES.profile} />
          <RouteButton title="Membership or billing issue" route={FREIGHT_ROUTES.subscription} />
          <RouteButton title="Connect Bank or payout issue" route={FREIGHT_ROUTES.connectBank} />
          <RouteButton title="Live route or tracking issue" route={FREIGHT_ROUTES.liveRoute} />
          <RouteButton title="Freight settings" route={FREIGHT_ROUTES.settings} />
        </View>

        <TouchableOpacity style={styles.darkButton} onPress={() => router.replace(FREIGHT_ROUTES.dashboard as any)}>
          <Ionicons name="grid-outline" size={18} color="#FFFFFF" />
          <Text style={styles.darkButtonText}>Back to Freight Dashboard</Text>
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

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <Ionicons name={icon} size={24} color={COLORS.red} />
      <Text style={styles.quickActionText}>{label}</Text>
    </TouchableOpacity>
  );
}

function OptionButton({
  title,
  active,
  onPress,
}: {
  title: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.optionButton, active && styles.optionButtonActive]}
      onPress={onPress}
    >
      <Text style={[styles.optionButtonText, active && styles.optionButtonTextActive]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

function RouteButton({ title, route }: { title: string; route: FreightRoute }) {
  return (
    <TouchableOpacity style={styles.routeButton} onPress={() => goTo(route)}>
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
  label: {
    color: COLORS.text,
    fontWeight: "900",
    marginBottom: 7,
    marginTop: 8,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },
  messageInput: {
    minHeight: 130,
    lineHeight: 21,
  },
  optionRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  optionButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  optionButtonActive: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },
  optionButtonText: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 12,
  },
  optionButtonTextActive: {
    color: "#FFFFFF",
  },
  primaryButton: {
    backgroundColor: COLORS.red,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    minHeight: 56,
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
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
    justifyContent: "center",
    marginHorizontal: 18,
    marginBottom: 40,
    flexDirection: "row",
    gap: 8,
  },
  darkButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});