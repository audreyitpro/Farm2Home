// app/freight/ai-load-matching.tsx

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
  board: "/freight/board",
  myLoads: "/freight/my-loads",
  serviceArea: "/freight/service-area",
  equipment: "/freight/equipment",
  specialtyServices: "/freight/specialty-services",
  carrierCertifications: "/freight/carrier-certifications",
  performanceScorecard: "/freight/performance-scorecard",
  connectBank: "/freight/connect-bank",
  support: "/freight/support",
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
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  amber: "#D97706",
  blue: "#2563EB",
  purple: "#7C3AED",
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

function miles(load: any) {
  return Number(load.distance_miles || load.miles || 0);
}

function rate(load: any) {
  return Number(load.rate || load.freight_total || load.total_due || 0);
}

function ratePerMile(load: any) {
  const distance = miles(load);
  if (!distance) return 0;
  return rate(load) / distance;
}

function arrayIncludesText(values: any, search: string) {
  if (!values) return false;

  if (Array.isArray(values)) {
    return values.some((item) => normalize(item).includes(normalize(search)));
  }

  return normalize(values).includes(normalize(search));
}

export default function FreightAILoadMatchingScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState("");

  const [carrier, setCarrier] = useState<any>(null);
  const [loads, setLoads] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadMatching();
    }, [])
  );

  const carrierReady = useMemo(() => {
    const payoutReady = Boolean(
      (carrier?.stripeAccountId || carrier?.stripe_account_id) &&
        (carrier?.payoutsEnabled || carrier?.payouts_enabled) &&
        (carrier?.chargesEnabled || carrier?.charges_enabled) &&
        (carrier?.onboardingComplete || carrier?.stripe_onboarding_complete)
    );

    const serviceReady = Boolean(
      carrier?.service_area_status === "complete" ||
        carrier?.home_base_location ||
        carrier?.service_radius_miles
    );

    const equipmentReady = Boolean(
      carrier?.equipment_status === "complete" ||
        carrier?.equipment_confirmed ||
        carrier?.equipment_type ||
        carrier?.vehicle_type
    );

    return {
      payoutReady,
      serviceReady,
      equipmentReady,
      aiEnabled: carrier?.ai_load_matching_enabled ?? true,
      ready: payoutReady && serviceReady && equipmentReady,
    };
  }, [carrier]);

  const matchedLoads = useMemo(() => {
    return loads
      .map((load) => {
        const score = calculateMatchScore(load);
        return {
          ...load,
          ai_match_score: score,
          ai_match_label:
            score >= 85 ? "Excellent Match" : score >= 70 ? "Good Match" : score >= 50 ? "Review Match" : "Low Match",
        };
      })
      .filter((load) => load.ai_match_score >= 50)
      .sort((a, b) => b.ai_match_score - a.ai_match_score);
  }, [loads, carrier]);

  const stats = useMemo(() => {
    const excellent = matchedLoads.filter((item) => item.ai_match_score >= 85).length;
    const good = matchedLoads.filter((item) => item.ai_match_score >= 70 && item.ai_match_score < 85).length;
    const review = matchedLoads.filter((item) => item.ai_match_score >= 50 && item.ai_match_score < 70).length;
    const bestRate = matchedLoads.reduce((max, load) => Math.max(max, ratePerMile(load)), 0);

    return {
      total: matchedLoads.length,
      excellent,
      good,
      review,
      bestRate,
    };
  }, [matchedLoads]);

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
      stripeAccountId: nextCarrier.stripeAccountId || nextCarrier.stripe_account_id || "",
      stripe_account_id: nextCarrier.stripe_account_id || nextCarrier.stripeAccountId || "",
      payoutsEnabled: nextCarrier.payoutsEnabled ?? nextCarrier.payouts_enabled ?? false,
      chargesEnabled: nextCarrier.chargesEnabled ?? nextCarrier.charges_enabled ?? false,
      onboardingComplete:
        nextCarrier.onboardingComplete ?? nextCarrier.stripe_onboarding_complete ?? false,
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

  async function loadMatching() {
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

      if (carrierError) console.log("AI load matching carrier error:", carrierError.message);

      if (!dbCarrier) {
        Alert.alert("Freight Profile Missing", "Please complete freight registration first.");
        router.replace(FREIGHT_ROUTES.register as any);
        return;
      }

      await persistCarrier({
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
        stripeAccountId:
          dbCarrier.stripe_account_id || stored?.stripeAccountId || stored?.stripe_account_id || "",
        stripe_account_id:
          dbCarrier.stripe_account_id || stored?.stripe_account_id || stored?.stripeAccountId || "",
        payoutsEnabled:
          dbCarrier.payouts_enabled ?? dbCarrier.stripe_payouts_enabled ?? stored?.payoutsEnabled ?? false,
        chargesEnabled:
          dbCarrier.charges_enabled ?? dbCarrier.stripe_charges_enabled ?? stored?.chargesEnabled ?? false,
        onboardingComplete:
          dbCarrier.stripe_onboarding_complete ?? stored?.onboardingComplete ?? false,
      });

      const { data: loadData, error: loadError } = await supabase
        .from("freight_loads")
        .select("*")
        .eq("status", "available")
        .order("created_at", { ascending: false });

      if (loadError) {
        console.log("AI load matching loads error:", loadError.message);
        setLoads([]);
      } else {
        setLoads(Array.isArray(loadData) ? loadData : []);
      }
    } catch (error: any) {
      Alert.alert("AI Matching Error", error?.message || "Unable to load AI load matches.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadMatching();
  }

  function calculateMatchScore(load: any) {
    if (!carrier) return 0;

    let score = 50;

    const loadEquipment = normalize(load.equipment_type || load.vehicle_type);
    const carrierEquipment = normalize(carrier.equipment_type || carrier.vehicle_type);

    if (carrierEquipment && loadEquipment && loadEquipment.includes(carrierEquipment)) score += 15;
    if (!loadEquipment || !carrierEquipment) score += 5;

    const maxMiles = Number(carrier.max_travel_miles || carrier.service_radius_miles || 0);
    const loadMiles = miles(load);

    if (maxMiles && loadMiles) {
      if (loadMiles <= maxMiles) score += 15;
      else score -= 25;
    }

    const statesServed = carrier.states_served || [];
    const pickupState = load.pickup_state || load.origin_state || "";
    const dropoffState = load.dropoff_state || load.destination_state || "";

    if (statesServed.length > 0) {
      if (pickupState && statesServed.includes(pickupState)) score += 8;
      if (dropoffState && statesServed.includes(dropoffState)) score += 8;
    }

    const pickup = load.pickup_location || load.origin || "";
    const dropoff = load.dropoff_location || load.destination || "";

    if (arrayIncludesText(carrier.preferred_pickup_regions, pickup)) score += 8;
    if (arrayIncludesText(carrier.preferred_delivery_regions, dropoff)) score += 8;
    if (arrayIncludesText(carrier.excluded_regions, pickup) || arrayIncludesText(carrier.excluded_regions, dropoff)) {
      score -= 50;
    }

    const commodity = normalize(load.commodity || load.load_type || load.title);

    if (commodity.includes("refrigerated") || commodity.includes("cold") || commodity.includes("produce")) {
      score += carrier.refrigerated_capable || carrier.refrigerated_loads_enabled ? 10 : -15;
    }

    if (commodity.includes("livestock") || commodity.includes("animal")) {
      score += carrier.livestock_capable || carrier.livestock_loads_enabled ? 12 : -20;
    }

    if (commodity.includes("hay") || commodity.includes("bulk") || commodity.includes("feed")) {
      score += carrier.hay_bulk_loads_enabled ? 8 : 0;
    }

    if (commodity.includes("medical") || commodity.includes("pharmacy") || commodity.includes("specimen")) {
      score += carrier.medical_courier_capable || carrier.medical_courier_loads_enabled ? 12 : -20;
    }

    if (commodity.includes("airport") || commodity.includes("tsa")) {
      score += carrier.tsa_airport_capable || carrier.tsa_airport_loads_enabled ? 12 : -20;
    }

    if (ratePerMile(load) >= 2.5) score += 8;
    else if (ratePerMile(load) >= 1.75) score += 5;

    if (!carrierReady.payoutReady) score -= 20;
    if (!carrierReady.serviceReady) score -= 10;
    if (!carrierReady.equipmentReady) score -= 10;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function scoreColor(score: number) {
    if (score >= 85) return COLORS.green;
    if (score >= 70) return COLORS.blue;
    if (score >= 50) return COLORS.amber;
    return COLORS.red;
  }

  async function acceptLoad(load: any) {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      return;
    }

    if (!carrierReady.payoutReady) {
      Alert.alert(
        "Connect Bank Required",
        "Complete Stripe Connect onboarding before accepting matched freight loads.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Connect Bank", onPress: () => goTo(FREIGHT_ROUTES.connectBank) },
        ]
      );
      return;
    }

    try {
      setAcceptingId(load.id);

      const now = new Date().toISOString();

      const { error } = await supabase
        .from("freight_loads")
        .update({
          status: "accepted",
          carrier_id: carrier.id,
          accepted_by: carrier.id,
          accepted_at: now,
          ai_match_score: load.ai_match_score,
          ai_match_label: load.ai_match_label,
          updated_at: now,
        })
        .eq("id", load.id);

      if (error) throw error;

      Alert.alert("Load Accepted", "This AI-matched load was added to My Loads.", [
        {
          text: "My Loads",
          onPress: () => router.replace(FREIGHT_ROUTES.myLoads as any),
        },
      ]);

      await loadMatching();
    } catch (error: any) {
      Alert.alert("Accept Load Error", error?.message || "Unable to accept this load.");
    } finally {
      setAcceptingId("");
    }
  }

  function renderMatch({ item }: { item: any }) {
    const accepting = acceptingId === item.id;

    return (
      <View style={styles.loadCard}>
        <View style={styles.loadTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.loadTitle}>{item.title || item.commodity || "Matched Freight Load"}</Text>
            <Text style={styles.loadRoute}>
              {item.pickup_location || item.origin || "Pickup"} →{" "}
              {item.dropoff_location || item.destination || "Dropoff"}
            </Text>
          </View>

          <View style={[styles.scoreBadge, { backgroundColor: scoreColor(item.ai_match_score) }]}>
            <Text style={styles.scoreBadgeText}>{item.ai_match_score}%</Text>
          </View>
        </View>

        <Text style={styles.matchLabel}>{item.ai_match_label}</Text>

        <View style={styles.infoGrid}>
          <InfoBox label="Rate" value={money(rate(item))} />
          <InfoBox label="Rate / Mile" value={money(ratePerMile(item))} />
          <InfoBox label="Miles" value={`${miles(item).toFixed(0)} mi`} />
          <InfoBox label="Equipment" value={item.equipment_type || "Flexible"} />
        </View>

        <View style={styles.aiBox}>
          <Ionicons name="sparkles-outline" size={20} color={COLORS.red} />
          <Text style={styles.aiText}>
            AI score uses your service area, equipment, specialty services, credentials,
            payout readiness, and route preferences.
          </Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.primarySmall, accepting && styles.disabledButton]}
            onPress={() => acceptLoad(item)}
            disabled={accepting}
          >
            {accepting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={17} color="#FFFFFF" />
                <Text style={styles.primarySmallText}>Accept Load</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.outlineSmall} onPress={() => goTo(FREIGHT_ROUTES.board)}>
            <Ionicons name="list-outline" size={17} color={COLORS.red} />
            <Text style={styles.outlineSmallText}>Board</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading AI load matches...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Farm2Home Freight Connect</Text>
            <Text style={styles.title}>AI Load Matching</Text>
            <Text style={styles.subtitle}>
              Match freight loads using service area, equipment, specialty services,
              certifications, payout readiness, and performance history.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.board)}>
            <Ionicons name="sparkles-outline" size={34} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.carrierCard}>
          <View style={styles.avatar}>
            <Ionicons name="business-outline" size={28} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.carrierName}>{carrier?.companyName || "Freight Connect Carrier"}</Text>
            <Text style={styles.carrierEmail}>{carrier?.email || "Carrier workspace"}</Text>

            <View
              style={[
                styles.statusPill,
                { backgroundColor: carrierReady.ready ? COLORS.green : COLORS.amber },
              ]}
            >
              <Text style={styles.statusPillText}>
                {carrierReady.ready ? "AI Matching Ready" : "Setup Needed"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Matches" value={String(stats.total)} icon="sparkles-outline" />
          <StatCard label="Excellent" value={String(stats.excellent)} icon="checkmark-circle-outline" />
          <StatCard label="Good" value={String(stats.good)} icon="thumbs-up-outline" />
          <StatCard label="Review" value={String(stats.review)} icon="eye-outline" />
          <StatCard label="Best Rate/Mi" value={money(stats.bestRate)} icon="cash-outline" />
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="map-outline" label="Service Area" route={FREIGHT_ROUTES.serviceArea} />
          <QuickLink icon="car-outline" label="Equipment" route={FREIGHT_ROUTES.equipment} />
          <QuickLink icon="construct-outline" label="Specialty" route={FREIGHT_ROUTES.specialtyServices} />
          <QuickLink icon="ribbon-outline" label="Credentials" route={FREIGHT_ROUTES.carrierCertifications} />
          <QuickLink icon="speedometer-outline" label="Scorecard" route={FREIGHT_ROUTES.performanceScorecard} />
          <QuickLink icon="business-outline" label="Connect Bank" route={FREIGHT_ROUTES.connectBank} />
        </View>

        {!carrierReady.ready && (
          <View style={styles.warningNotice}>
            <Text style={styles.warningTitle}>Finish setup for stronger matches</Text>
            <Text style={styles.warningText}>
              Complete bank connection, service area, and equipment setup so Farm2Home can match
              you with the correct freight.
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Recommended Loads</Text>

        <FlatList
          data={matchedLoads}
          keyExtractor={(item, index) => String(item.id || index)}
          scrollEnabled={false}
          renderItem={renderMatch}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="sparkles-outline" size={38} color={COLORS.red} />
              <Text style={styles.emptyTitle}>No AI matches yet.</Text>
              <Text style={styles.emptyText}>
                Add service area, equipment, and specialty services to improve load matching.
              </Text>

              <TouchableOpacity style={styles.emptyButton} onPress={() => goTo(FREIGHT_ROUTES.serviceArea)}>
                <Ionicons name="map-outline" size={18} color="#FFFFFF" />
                <Text style={styles.emptyButtonText}>Set Service Area</Text>
              </TouchableOpacity>
            </View>
          }
        />

        <TouchableOpacity style={styles.primaryButton} onPress={() => goTo(FREIGHT_ROUTES.board)}>
          <Ionicons name="list-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Open Full Load Board</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.darkButton} onPress={() => goTo(FREIGHT_ROUTES.managementCenter)}>
          <Ionicons name="apps-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Management Center</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoBox}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={22} color={COLORS.red} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 9,
  },
  statusPillText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  statCard: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: { color: COLORS.text, fontSize: 22, fontWeight: "900", marginTop: 7 },
  statLabel: { color: COLORS.muted, fontWeight: "800", marginTop: 4 },
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
  warningNotice: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 22,
    padding: 18,
  },
  warningTitle: { color: COLORS.amber, fontSize: 19, fontWeight: "900", marginBottom: 6 },
  warningText: { color: COLORS.text, fontWeight: "700", lineHeight: 22 },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  loadCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadTop: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 10,
  },
  loadTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  loadRoute: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  scoreBadge: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scoreBadgeText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  matchLabel: { color: COLORS.red, fontWeight: "900", marginBottom: 12 },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  infoBox: {
    width: "48%",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
  },
  infoLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  infoValue: { color: COLORS.text, fontWeight: "900", marginTop: 4 },
  aiBox: {
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  aiText: { color: COLORS.text, fontWeight: "700", lineHeight: 20, flex: 1 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  primarySmall: {
    flex: 1,
    backgroundColor: COLORS.red,
    borderRadius: 14,
    padding: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  primarySmallText: { color: "#FFFFFF", fontWeight: "900" },
  outlineSmall: {
    flex: 1,
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 14,
    padding: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  outlineSmallText: { color: COLORS.red, fontWeight: "900" },
  emptyCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900", marginTop: 10 },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  emptyButton: {
    backgroundColor: COLORS.red,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 16,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  emptyButtonText: { color: "#FFFFFF", fontWeight: "900" },
  primaryButton: {
    backgroundColor: COLORS.red,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  darkButton: {
    backgroundColor: COLORS.black,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: { opacity: 0.6 },
  primaryText: { color: "#FFFFFF", fontWeight: "900" },
});