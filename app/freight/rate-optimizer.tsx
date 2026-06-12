// app/freight/rate-optimizer.tsx

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
  aiLoadMatching: "/freight/ai-load-matching",
  loadRecommendations: "/freight/load-recommendations",
  serviceArea: "/freight/service-area",
  equipment: "/freight/equipment",
  specialtyServices: "/freight/specialty-services",
  connectBank: "/freight/connect-bank",
  support: "/freight/support",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];

type SortMode = "profit" | "ratePerMile" | "score" | "distance";

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

function miles(load: any) {
  return Number(load.distance_miles || load.miles || 0);
}

function rate(load: any) {
  return Number(load.rate || load.freight_total || load.total_due || load.payout_amount || 0);
}

function ratePerMile(load: any) {
  const distance = miles(load);
  if (!distance) return 0;
  return rate(load) / distance;
}

function estimatedCost(load: any) {
  const distance = miles(load);
  const fuelCostPerMile = Number(load.fuel_cost_per_mile || 0.55);
  const operatingCostPerMile = Number(load.operating_cost_per_mile || 0.85);
  return distance * (fuelCostPerMile + operatingCostPerMile);
}

function estimatedProfit(load: any) {
  return rate(load) - estimatedCost(load);
}

function formatDate(value?: string | null) {
  if (!value) return "Date TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
}

export default function FreightRateOptimizerScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("profit");

  const [carrier, setCarrier] = useState<any>(null);
  const [loads, setLoads] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadOptimizer();
    }, [])
  );

  const readiness = useMemo(() => {
    const payoutReady = Boolean(
      (carrier?.stripeAccountId || carrier?.stripe_account_id) &&
        (carrier?.payoutsEnabled || carrier?.payouts_enabled) &&
        (carrier?.chargesEnabled || carrier?.charges_enabled) &&
        (carrier?.onboardingComplete || carrier?.stripe_onboarding_complete)
    );

    return {
      payoutReady,
      equipmentReady: Boolean(carrier?.equipment_type || carrier?.vehicle_type || carrier?.equipment_confirmed),
      serviceReady: Boolean(carrier?.service_radius_miles || carrier?.max_travel_miles || carrier?.states_served),
      ready: payoutReady,
    };
  }, [carrier]);

  const optimizedLoads = useMemo(() => {
    const optimized = loads.map((load) => {
      const result = optimizeLoad(load);
      return { ...load, ...result };
    });

    if (sortMode === "ratePerMile") {
      return optimized.sort((a, b) => b.optimized_rate_per_mile - a.optimized_rate_per_mile);
    }

    if (sortMode === "score") {
      return optimized.sort((a, b) => b.optimizer_score - a.optimizer_score);
    }

    if (sortMode === "distance") {
      return optimized.sort((a, b) => a.optimized_miles - b.optimized_miles);
    }

    return optimized.sort((a, b) => b.estimated_profit - a.estimated_profit);
  }, [loads, carrier, sortMode]);

  const stats = useMemo(() => {
    const accept = optimizedLoads.filter((item) => item.optimizer_decision === "ACCEPT").length;
    const review = optimizedLoads.filter((item) => item.optimizer_decision === "REVIEW").length;
    const skip = optimizedLoads.filter((item) => item.optimizer_decision === "SKIP").length;
    const bestProfit = optimizedLoads.reduce(
      (max, load) => Math.max(max, Number(load.estimated_profit || 0)),
      0
    );
    const bestRate = optimizedLoads.reduce(
      (max, load) => Math.max(max, Number(load.optimized_rate_per_mile || 0)),
      0
    );

    return {
      total: optimizedLoads.length,
      accept,
      review,
      skip,
      bestProfit,
      bestRate,
    };
  }, [optimizedLoads]);

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

  async function loadOptimizer() {
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

      if (carrierError) console.log("Rate optimizer carrier error:", carrierError.message);

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
          dbCarrier.payouts_enabled ??
          dbCarrier.stripe_payouts_enabled ??
          stored?.payoutsEnabled ??
          false,
        chargesEnabled:
          dbCarrier.charges_enabled ??
          dbCarrier.stripe_charges_enabled ??
          stored?.chargesEnabled ??
          false,
        onboardingComplete:
          dbCarrier.stripe_onboarding_complete ?? stored?.onboardingComplete ?? false,
      });

      const { data: availableLoads, error: loadError } = await supabase
        .from("freight_loads")
        .select("*")
        .eq("status", "available")
        .order("created_at", { ascending: false });

      if (loadError) {
        console.log("Rate optimizer loads error:", loadError.message);
        setLoads([]);
      } else {
        setLoads(Array.isArray(availableLoads) ? availableLoads : []);
      }
    } catch (error: any) {
      Alert.alert("Rate Optimizer Error", error?.message || "Unable to load rate optimizer.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadOptimizer();
  }

  function optimizeLoad(load: any) {
    const rpm = ratePerMile(load);
    const distance = miles(load);
    const cost = estimatedCost(load);
    const profit = estimatedProfit(load);

    const carrierEquipment = normalize(carrier?.equipment_type || carrier?.vehicle_type || "");
    const loadEquipment = normalize(load.equipment_type || load.vehicle_type || load.trailer_type || "");

    const equipmentFit =
      !loadEquipment || !carrierEquipment
        ? 70
        : loadEquipment.includes(carrierEquipment) || carrierEquipment.includes(loadEquipment)
        ? 100
        : 35;

    const maxMiles = Number(carrier?.max_travel_miles || carrier?.service_radius_miles || 0);

    const distanceFit =
      !maxMiles || !distance ? 70 : distance <= maxMiles ? 100 : distance <= maxMiles * 1.25 ? 65 : 25;

    const commodity = normalize(load.commodity || load.load_type || load.title || "");

    let specialtyFit = 80;

    if (commodity.includes("cold") || commodity.includes("refrigerated") || commodity.includes("produce")) {
      specialtyFit = carrier?.refrigerated_capable || carrier?.refrigerated_loads_enabled ? 100 : 25;
    }

    if (commodity.includes("livestock") || commodity.includes("animal")) {
      specialtyFit = carrier?.livestock_capable || carrier?.livestock_loads_enabled ? 100 : 20;
    }

    if (commodity.includes("medical") || commodity.includes("pharmacy") || commodity.includes("specimen")) {
      specialtyFit = carrier?.medical_courier_capable || carrier?.medical_courier_loads_enabled ? 100 : 20;
    }

    if (commodity.includes("airport") || commodity.includes("tsa")) {
      specialtyFit = carrier?.tsa_airport_capable || carrier?.tsa_airport_loads_enabled ? 100 : 20;
    }

    const rateScore = rpm >= 3 ? 100 : rpm >= 2.25 ? 85 : rpm >= 1.75 ? 70 : rpm >= 1.35 ? 50 : 25;
    const profitScore = profit >= 500 ? 100 : profit >= 300 ? 85 : profit >= 150 ? 65 : profit >= 50 ? 45 : 20;

    let score =
      rateScore * 0.3 +
      profitScore * 0.3 +
      equipmentFit * 0.15 +
      specialtyFit * 0.15 +
      distanceFit * 0.1;

    if (!readiness.payoutReady) score -= 20;
    if (!readiness.equipmentReady) score -= 8;
    if (!readiness.serviceReady) score -= 8;

    score = Math.max(0, Math.min(100, Math.round(score)));

    let decision: "ACCEPT" | "REVIEW" | "SKIP" = "REVIEW";

    if (score >= 75 && profit > 100 && rpm >= 1.75) decision = "ACCEPT";
    if (score < 50 || profit < 0 || rpm < 1.25) decision = "SKIP";

    const reasons: string[] = [];

    if (rpm >= 2.25) reasons.push("Strong rate per mile.");
    else if (rpm < 1.35) reasons.push("Low rate per mile.");

    if (profit >= 300) reasons.push("Strong estimated profit.");
    else if (profit < 50) reasons.push("Low estimated profit after operating cost.");

    if (equipmentFit >= 90) reasons.push("Equipment fits your profile.");
    else if (equipmentFit < 50) reasons.push("Equipment fit needs review.");

    if (specialtyFit >= 90) reasons.push("Specialty requirements fit your setup.");
    else if (specialtyFit < 50) reasons.push("Specialty requirement may not fit your profile.");

    if (distanceFit < 50) reasons.push("Distance may exceed your preferred range.");

    if (!readiness.payoutReady) reasons.push("Connect Bank must be complete before accepting.");

    return {
      optimized_rate_per_mile: rpm,
      optimized_miles: distance,
      estimated_cost: cost,
      estimated_profit: profit,
      optimizer_score: score,
      optimizer_decision: decision,
      optimizer_reasons: reasons,
      optimizer_equipment_fit: equipmentFit,
      optimizer_specialty_fit: specialtyFit,
      optimizer_distance_fit: distanceFit,
      optimizer_rate_score: rateScore,
      optimizer_profit_score: profitScore,
    };
  }

  function decisionColor(decision: string) {
    if (decision === "ACCEPT") return COLORS.green;
    if (decision === "REVIEW") return COLORS.amber;
    return COLORS.red;
  }

  async function acceptLoad(load: any) {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      return;
    }

    if (!readiness.payoutReady) {
      Alert.alert("Connect Bank Required", "Complete Stripe Connect before accepting freight.", [
        { text: "Cancel", style: "cancel" },
        { text: "Connect Bank", onPress: () => goTo(FREIGHT_ROUTES.connectBank) },
      ]);
      return;
    }

    if (load.optimizer_decision === "SKIP") {
      Alert.alert(
        "Review Before Accepting",
        "This load is marked SKIP by the optimizer. Please review rate, distance, and equipment fit first.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Accept Anyway", onPress: () => confirmAccept(load) },
        ]
      );
      return;
    }

    await confirmAccept(load);
  }

  async function confirmAccept(load: any) {
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
          optimizer_score: load.optimizer_score,
          optimizer_decision: load.optimizer_decision,
          optimized_rate_per_mile: load.optimized_rate_per_mile,
          estimated_profit: load.estimated_profit,
          updated_at: now,
        })
        .eq("id", load.id);

      if (error) throw error;

      Alert.alert("Load Accepted", "This optimized load was added to My Loads.", [
        { text: "My Loads", onPress: () => router.replace(FREIGHT_ROUTES.myLoads as any) },
      ]);

      await loadOptimizer();
    } catch (error: any) {
      Alert.alert("Accept Error", error?.message || "Unable to accept this load.");
    } finally {
      setAcceptingId("");
    }
  }

  function renderLoad({ item }: { item: any }) {
    const accepting = acceptingId === item.id;

    return (
      <View style={styles.loadCard}>
        <View style={styles.loadTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.loadTitle}>{item.title || item.commodity || "Optimized Load"}</Text>
            <Text style={styles.loadRoute}>
              {item.pickup_location || item.origin || "Pickup"} →{" "}
              {item.dropoff_location || item.destination || "Dropoff"}
            </Text>
            <Text style={styles.loadDate}>
              Pickup: {formatDate(item.pickup_date || item.pickup_at || item.scheduled_pickup_at)}
            </Text>
          </View>

          <View style={[styles.decisionBadge, { backgroundColor: decisionColor(item.optimizer_decision) }]}>
            <Text style={styles.decisionText}>{item.optimizer_decision}</Text>
          </View>
        </View>

        <View style={styles.infoGrid}>
          <InfoBox label="Rate" value={money(rate(item))} />
          <InfoBox label="Rate / Mile" value={money(item.optimized_rate_per_mile)} />
          <InfoBox label="Est. Cost" value={money(item.estimated_cost)} />
          <InfoBox label="Est. Profit" value={money(item.estimated_profit)} />
          <InfoBox label="Miles" value={`${Number(item.optimized_miles || 0).toFixed(0)} mi`} />
          <InfoBox label="Score" value={`${item.optimizer_score}%`} />
        </View>

        <View style={styles.fitGrid}>
          <FitBar label="Rate" value={item.optimizer_rate_score} />
          <FitBar label="Profit" value={item.optimizer_profit_score} />
          <FitBar label="Equipment" value={item.optimizer_equipment_fit} />
          <FitBar label="Specialty" value={item.optimizer_specialty_fit} />
          <FitBar label="Distance" value={item.optimizer_distance_fit} />
        </View>

        <View style={styles.reasonBox}>
          <Ionicons name="analytics-outline" size={20} color={COLORS.red} />
          <View style={{ flex: 1 }}>
            {(item.optimizer_reasons || []).slice(0, 4).map((reason: string, index: number) => (
              <Text key={`${item.id}-reason-${index}`} style={styles.reasonText}>
                • {reason}
              </Text>
            ))}
          </View>
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
        <Text style={styles.centerText}>Loading rate optimizer...</Text>
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
            <Text style={styles.title}>Rate Optimizer</Text>
            <Text style={styles.subtitle}>
              Compare rate, rate per mile, distance, equipment fit, specialty requirements,
              payout readiness, and estimated profitability.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.board)}>
            <Ionicons name="analytics-outline" size={34} color="#FFFFFF" />
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
                { backgroundColor: readiness.ready ? COLORS.green : COLORS.amber },
              ]}
            >
              <Text style={styles.statusPillText}>
                {readiness.ready ? "Optimizer Ready" : "Connect Bank Needed"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Loads" value={String(stats.total)} icon="cube-outline" />
          <StatCard label="Accept" value={String(stats.accept)} icon="checkmark-circle-outline" />
          <StatCard label="Review" value={String(stats.review)} icon="eye-outline" />
          <StatCard label="Skip" value={String(stats.skip)} icon="close-circle-outline" />
          <StatCard label="Best Profit" value={money(stats.bestProfit)} icon="cash-outline" />
          <StatCard label="Best Rate/Mi" value={money(stats.bestRate)} icon="speedometer-outline" />
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="sparkles-outline" label="AI Matching" route={FREIGHT_ROUTES.aiLoadMatching} />
          <QuickLink icon="thumbs-up-outline" label="Recommendations" route={FREIGHT_ROUTES.loadRecommendations} />
          <QuickLink icon="map-outline" label="Service Area" route={FREIGHT_ROUTES.serviceArea} />
          <QuickLink icon="car-outline" label="Equipment" route={FREIGHT_ROUTES.equipment} />
          <QuickLink icon="business-outline" label="Connect Bank" route={FREIGHT_ROUTES.connectBank} />
          <QuickLink icon="headset-outline" label="Support" route={FREIGHT_ROUTES.support} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sort Optimized Loads</Text>

          <View style={styles.sortGrid}>
            <SortButton label="Profit" mode="profit" active={sortMode === "profit"} onPress={setSortMode} />
            <SortButton label="Rate/Mi" mode="ratePerMile" active={sortMode === "ratePerMile"} onPress={setSortMode} />
            <SortButton label="Score" mode="score" active={sortMode === "score"} onPress={setSortMode} />
            <SortButton label="Distance" mode="distance" active={sortMode === "distance"} onPress={setSortMode} />
          </View>
        </View>

        {!readiness.payoutReady && (
          <View style={styles.warningNotice}>
            <Text style={styles.warningTitle}>Connect Bank Required</Text>
            <Text style={styles.warningText}>
              You can review optimized rates now, but Stripe Connect must be complete before accepting loads.
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Optimized Loads</Text>

        <FlatList
          data={optimizedLoads}
          keyExtractor={(item, index) => String(item.id || index)}
          scrollEnabled={false}
          renderItem={renderLoad}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="analytics-outline" size={38} color={COLORS.red} />
              <Text style={styles.emptyTitle}>No available loads to optimize.</Text>
              <Text style={styles.emptyText}>
                Available freight loads will appear here with rate optimization.
              </Text>
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

function FitBar({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? COLORS.green : value >= 55 ? COLORS.amber : COLORS.red;

  return (
    <View style={styles.fitItem}>
      <View style={styles.fitTop}>
        <Text style={styles.fitLabel}>{label}</Text>
        <Text style={[styles.fitValue, { color }]}>{Math.round(value)}%</Text>
      </View>

      <View style={styles.fitTrack}>
        <View
          style={[
            styles.fitFill,
            {
              width: `${Math.max(5, Math.min(100, value))}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>
    </View>
  );
}

function SortButton({
  label,
  mode,
  active,
  onPress,
}: {
  label: string;
  mode: SortMode;
  active: boolean;
  onPress: (mode: SortMode) => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.sortButton, active && styles.sortButtonActive]}
      onPress={() => onPress(mode)}
    >
      <Text style={[styles.sortText, active && styles.sortTextActive]}>{label}</Text>
    </TouchableOpacity>
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
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900", marginBottom: 12 },
  sortGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sortButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sortButtonActive: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },
  sortText: { color: COLORS.text, fontWeight: "900" },
  sortTextActive: { color: "#FFFFFF" },
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
  loadDate: { color: COLORS.slate, fontWeight: "800", marginTop: 5 },
  decisionBadge: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  decisionText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
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
  fitGrid: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    gap: 10,
  },
  fitItem: { gap: 6 },
  fitTop: { flexDirection: "row", justifyContent: "space-between" },
  fitLabel: { color: COLORS.text, fontWeight: "900" },
  fitValue: { fontWeight: "900" },
  fitTrack: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    overflow: "hidden",
  },
  fitFill: {
    height: 8,
    borderRadius: 999,
  },
  reasonBox: {
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  reasonText: { color: COLORS.text, fontWeight: "700", lineHeight: 20 },
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