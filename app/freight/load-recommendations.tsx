// app/freight/load-recommendations.tsx

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
  aiLoadMatching: "/freight/ai-load-matching",
  board: "/freight/board",
  myLoads: "/freight/my-loads",
  serviceArea: "/freight/service-area",
  equipment: "/freight/equipment",
  specialtyServices: "/freight/specialty-services",
  carrierCertifications: "/freight/carrier-certifications",
  connectBank: "/freight/connect-bank",
  support: "/freight/support",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];

type SortMode = "score" | "rate" | "distance" | "equipment" | "specialty";

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

function arrayIncludesText(values: any, search: string) {
  if (!values || !search) return false;

  if (Array.isArray(values)) {
    return values.some((item) => normalize(search).includes(normalize(item)) || normalize(item).includes(normalize(search)));
  }

  return normalize(search).includes(normalize(values)) || normalize(values).includes(normalize(search));
}

function formatDate(value?: string | null) {
  if (!value) return "Date TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
}

export default function FreightLoadRecommendationsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("score");

  const [carrier, setCarrier] = useState<any>(null);
  const [loads, setLoads] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadRecommendations();
    }, [])
  );

  const readiness = useMemo(() => {
    const payoutReady = Boolean(
      (carrier?.stripeAccountId || carrier?.stripe_account_id) &&
        (carrier?.payoutsEnabled || carrier?.payouts_enabled) &&
        (carrier?.chargesEnabled || carrier?.charges_enabled) &&
        (carrier?.onboardingComplete || carrier?.stripe_onboarding_complete)
    );

    const serviceReady = Boolean(
      carrier?.service_area_status === "complete" ||
        carrier?.home_base_location ||
        carrier?.service_radius_miles ||
        carrier?.states_served
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
      ready: payoutReady && serviceReady && equipmentReady,
    };
  }, [carrier]);

  const recommendations = useMemo(() => {
    const scored = loads
      .map((load) => {
        const detail = calculateRecommendation(load);

        return {
          ...load,
          recommendation_score: detail.score,
          recommendation_label: detail.label,
          equipment_fit: detail.equipmentFit,
          specialty_fit: detail.specialtyFit,
          service_area_fit: detail.serviceAreaFit,
          distance_fit: detail.distanceFit,
          rate_fit: detail.rateFit,
          recommendation_reasons: detail.reasons,
        };
      })
      .filter((load) => load.recommendation_score >= 45);

    if (sortMode === "rate") {
      return scored.sort((a, b) => ratePerMile(b) - ratePerMile(a));
    }

    if (sortMode === "distance") {
      return scored.sort((a, b) => miles(a) - miles(b));
    }

    if (sortMode === "equipment") {
      return scored.sort((a, b) => b.equipment_fit - a.equipment_fit);
    }

    if (sortMode === "specialty") {
      return scored.sort((a, b) => b.specialty_fit - a.specialty_fit);
    }

    return scored.sort((a, b) => b.recommendation_score - a.recommendation_score);
  }, [loads, carrier, sortMode]);

  const stats = useMemo(() => {
    const excellent = recommendations.filter((item) => item.recommendation_score >= 85).length;
    const good = recommendations.filter(
      (item) => item.recommendation_score >= 70 && item.recommendation_score < 85
    ).length;
    const review = recommendations.filter(
      (item) => item.recommendation_score >= 45 && item.recommendation_score < 70
    ).length;

    const bestRate = recommendations.reduce((max, load) => Math.max(max, ratePerMile(load)), 0);
    const totalValue = recommendations.reduce((sum, load) => sum + rate(load), 0);

    return {
      total: recommendations.length,
      excellent,
      good,
      review,
      bestRate,
      totalValue,
    };
  }, [recommendations]);

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

  async function loadRecommendations() {
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

      if (carrierError) console.log("Load recommendations carrier error:", carrierError.message);

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
        console.log("Load recommendations loads error:", loadError.message);
        setLoads([]);
      } else {
        setLoads(Array.isArray(availableLoads) ? availableLoads : []);
      }
    } catch (error: any) {
      Alert.alert("Recommendations Error", error?.message || "Unable to load recommendations.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadRecommendations();
  }

  function calculateRecommendation(load: any) {
    let score = 40;
    const reasons: string[] = [];

    const loadEquipment = normalize(load.equipment_type || load.vehicle_type || load.trailer_type);
    const carrierEquipment = normalize(carrier?.equipment_type || carrier?.vehicle_type || "");

    let equipmentFit = 50;
    if (!loadEquipment) {
      equipmentFit = 70;
      score += 8;
      reasons.push("Flexible equipment requirement.");
    } else if (carrierEquipment && (loadEquipment.includes(carrierEquipment) || carrierEquipment.includes(loadEquipment))) {
      equipmentFit = 100;
      score += 18;
      reasons.push("Equipment type fits your carrier profile.");
    } else if (carrier?.equipment_type || carrier?.vehicle_type) {
      equipmentFit = 35;
      score -= 12;
      reasons.push("Equipment may need review.");
    }

    const loadMiles = miles(load);
    const maxMiles = Number(carrier?.max_travel_miles || carrier?.service_radius_miles || 0);

    let distanceFit = 50;
    if (maxMiles && loadMiles) {
      if (loadMiles <= maxMiles) {
        distanceFit = 100;
        score += 14;
        reasons.push("Distance is inside your service range.");
      } else if (loadMiles <= maxMiles * 1.25) {
        distanceFit = 70;
        score += 4;
        reasons.push("Distance is near your service limit.");
      } else {
        distanceFit = 20;
        score -= 18;
        reasons.push("Distance exceeds your preferred service range.");
      }
    }

    const statesServed = Array.isArray(carrier?.states_served) ? carrier.states_served : [];
    const pickupState = load.pickup_state || load.origin_state || "";
    const dropoffState = load.dropoff_state || load.destination_state || "";

    let serviceAreaFit = 50;
    if (statesServed.length > 0) {
      const pickupMatch = pickupState ? statesServed.includes(pickupState) : false;
      const dropoffMatch = dropoffState ? statesServed.includes(dropoffState) : false;

      if (pickupMatch && dropoffMatch) {
        serviceAreaFit = 100;
        score += 16;
        reasons.push("Pickup and delivery states match your service area.");
      } else if (pickupMatch || dropoffMatch) {
        serviceAreaFit = 70;
        score += 6;
        reasons.push("One side of the route matches your service area.");
      } else if (pickupState || dropoffState) {
        serviceAreaFit = 20;
        score -= 18;
        reasons.push("Route states may be outside your service area.");
      }
    }

    const pickup = load.pickup_location || load.origin || "";
    const dropoff = load.dropoff_location || load.destination || "";

    if (arrayIncludesText(carrier?.preferred_pickup_regions, pickup)) {
      score += 8;
      reasons.push("Pickup is in your preferred pickup region.");
    }

    if (arrayIncludesText(carrier?.preferred_delivery_regions, dropoff)) {
      score += 8;
      reasons.push("Delivery is in your preferred delivery region.");
    }

    if (arrayIncludesText(carrier?.excluded_regions, pickup) || arrayIncludesText(carrier?.excluded_regions, dropoff)) {
      score -= 50;
      reasons.push("Route touches an excluded region.");
    }

    const commodity = normalize(load.commodity || load.load_type || load.title || "");
    let specialtyFit = 50;

    const isCold = commodity.includes("refrigerated") || commodity.includes("cold") || commodity.includes("produce");
    const isLivestock = commodity.includes("livestock") || commodity.includes("animal");
    const isBulk = commodity.includes("hay") || commodity.includes("feed") || commodity.includes("bulk") || commodity.includes("bale");
    const isMedical = commodity.includes("medical") || commodity.includes("pharmacy") || commodity.includes("specimen");
    const isAirport = commodity.includes("airport") || commodity.includes("tsa");

    if (isCold) {
      if (carrier?.refrigerated_capable || carrier?.refrigerated_loads_enabled) {
        specialtyFit = 100;
        score += 12;
        reasons.push("Cold-chain load matches your refrigerated capability.");
      } else {
        specialtyFit = 20;
        score -= 20;
        reasons.push("Cold-chain load may require refrigerated capability.");
      }
    }

    if (isLivestock) {
      if (carrier?.livestock_capable || carrier?.livestock_loads_enabled) {
        specialtyFit = 100;
        score += 14;
        reasons.push("Livestock freight matches your specialty setup.");
      } else {
        specialtyFit = 15;
        score -= 25;
        reasons.push("Livestock freight may require additional equipment or approval.");
      }
    }

    if (isBulk) {
      if (carrier?.hay_bulk_loads_enabled) {
        specialtyFit = 95;
        score += 10;
        reasons.push("Hay or bulk farm load matches your service profile.");
      } else {
        score += 2;
      }
    }

    if (isMedical) {
      if (carrier?.medical_courier_capable || carrier?.medical_courier_loads_enabled) {
        specialtyFit = 100;
        score += 14;
        reasons.push("Medical logistics matches your carrier profile.");
      } else {
        specialtyFit = 15;
        score -= 25;
        reasons.push("Medical freight may require credentialed handling.");
      }
    }

    if (isAirport) {
      if (carrier?.tsa_airport_capable || carrier?.tsa_airport_loads_enabled) {
        specialtyFit = 100;
        score += 14;
        reasons.push("Airport/TSA freight matches your carrier profile.");
      } else {
        specialtyFit = 15;
        score -= 25;
        reasons.push("Airport/TSA freight may require special authorization.");
      }
    }

    if (!isCold && !isLivestock && !isBulk && !isMedical && !isAirport) {
      specialtyFit = 80;
      score += 6;
      reasons.push("Standard farm freight recommendation.");
    }

    let rateFit = 50;
    const rpm = ratePerMile(load);

    if (rpm >= 3) {
      rateFit = 100;
      score += 12;
      reasons.push("Strong rate per mile.");
    } else if (rpm >= 2) {
      rateFit = 80;
      score += 8;
      reasons.push("Good rate per mile.");
    } else if (rpm >= 1.5) {
      rateFit = 60;
      score += 3;
      reasons.push("Fair rate per mile.");
    } else if (rpm > 0) {
      rateFit = 30;
      score -= 5;
      reasons.push("Lower rate per mile.");
    }

    if (!readiness.payoutReady) score -= 15;
    if (!readiness.serviceReady) score -= 8;
    if (!readiness.equipmentReady) score -= 8;

    const finalScore = Math.max(0, Math.min(100, Math.round(score)));

    return {
      score: finalScore,
      label:
        finalScore >= 85
          ? "Top Recommendation"
          : finalScore >= 70
          ? "Strong Recommendation"
          : finalScore >= 55
          ? "Good Opportunity"
          : "Review Before Accepting",
      equipmentFit,
      specialtyFit,
      serviceAreaFit,
      distanceFit,
      rateFit,
      reasons,
    };
  }

  function scoreColor(score: number) {
    if (score >= 85) return COLORS.green;
    if (score >= 70) return COLORS.blue;
    if (score >= 55) return COLORS.amber;
    return COLORS.red;
  }

  async function acceptLoad(load: any) {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      return;
    }

    if (!readiness.payoutReady) {
      Alert.alert(
        "Connect Bank Required",
        "Complete Stripe Connect onboarding before accepting recommended freight loads.",
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
          recommendation_score: load.recommendation_score,
          recommendation_label: load.recommendation_label,
          ai_match_score: load.recommendation_score,
          ai_match_label: load.recommendation_label,
          updated_at: now,
        })
        .eq("id", load.id);

      if (error) throw error;

      Alert.alert("Load Accepted", "Recommended load was added to My Loads.", [
        {
          text: "My Loads",
          onPress: () => router.replace(FREIGHT_ROUTES.myLoads as any),
        },
      ]);

      await loadRecommendations();
    } catch (error: any) {
      Alert.alert("Accept Load Error", error?.message || "Unable to accept this recommended load.");
    } finally {
      setAcceptingId("");
    }
  }

  function renderRecommendation({ item }: { item: any }) {
    const accepting = acceptingId === item.id;

    return (
      <View style={styles.loadCard}>
        <View style={styles.loadTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.loadTitle}>{item.title || item.commodity || "Recommended Load"}</Text>
            <Text style={styles.loadRoute}>
              {item.pickup_location || item.origin || "Pickup"} →{" "}
              {item.dropoff_location || item.destination || "Dropoff"}
            </Text>
            <Text style={styles.loadDate}>
              Pickup: {formatDate(item.pickup_date || item.pickup_at || item.scheduled_pickup_at)}
            </Text>
          </View>

          <View style={[styles.scoreBadge, { backgroundColor: scoreColor(item.recommendation_score) }]}>
            <Text style={styles.scoreBadgeText}>{item.recommendation_score}%</Text>
          </View>
        </View>

        <Text style={styles.matchLabel}>{item.recommendation_label}</Text>

        <View style={styles.infoGrid}>
          <InfoBox label="Rate" value={money(rate(item))} />
          <InfoBox label="Rate / Mile" value={money(ratePerMile(item))} />
          <InfoBox label="Miles" value={`${miles(item).toFixed(0)} mi`} />
          <InfoBox label="Equipment" value={item.equipment_type || item.vehicle_type || "Flexible"} />
        </View>

        <View style={styles.fitGrid}>
          <FitBar label="Equipment" value={item.equipment_fit} />
          <FitBar label="Specialty" value={item.specialty_fit} />
          <FitBar label="Service Area" value={item.service_area_fit} />
          <FitBar label="Rate" value={item.rate_fit} />
        </View>

        <View style={styles.reasonBox}>
          <Ionicons name="sparkles-outline" size={20} color={COLORS.red} />
          <View style={{ flex: 1 }}>
            {(item.recommendation_reasons || []).slice(0, 3).map((reason: string, index: number) => (
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

          <TouchableOpacity style={styles.outlineSmall} onPress={() => goTo(FREIGHT_ROUTES.aiLoadMatching)}>
            <Ionicons name="sparkles-outline" size={17} color={COLORS.red} />
            <Text style={styles.outlineSmallText}>AI Match</Text>
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
        <Text style={styles.centerText}>Loading load recommendations...</Text>
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
            <Text style={styles.title}>Load Recommendations</Text>
            <Text style={styles.subtitle}>
              Ranked recommendations based on match score, rate per mile, distance,
              equipment fit, specialty fit, and service-area compatibility.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.aiLoadMatching)}>
            <Ionicons name="thumbs-up-outline" size={34} color="#FFFFFF" />
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
                {readiness.ready ? "Recommendations Ready" : "Setup Needed"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Recommended" value={String(stats.total)} icon="thumbs-up-outline" />
          <StatCard label="Top Matches" value={String(stats.excellent)} icon="star-outline" />
          <StatCard label="Strong" value={String(stats.good)} icon="checkmark-circle-outline" />
          <StatCard label="Review" value={String(stats.review)} icon="eye-outline" />
          <StatCard label="Best Rate/Mi" value={money(stats.bestRate)} icon="cash-outline" />
          <StatCard label="Total Value" value={money(stats.totalValue)} icon="wallet-outline" />
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="sparkles-outline" label="AI Matching" route={FREIGHT_ROUTES.aiLoadMatching} />
          <QuickLink icon="map-outline" label="Service Area" route={FREIGHT_ROUTES.serviceArea} />
          <QuickLink icon="car-outline" label="Equipment" route={FREIGHT_ROUTES.equipment} />
          <QuickLink icon="construct-outline" label="Specialty" route={FREIGHT_ROUTES.specialtyServices} />
          <QuickLink icon="list-outline" label="Load Board" route={FREIGHT_ROUTES.board} />
          <QuickLink icon="briefcase-outline" label="My Loads" route={FREIGHT_ROUTES.myLoads} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sort Recommendations</Text>

          <View style={styles.sortGrid}>
            <SortButton label="Score" mode="score" active={sortMode === "score"} onPress={setSortMode} />
            <SortButton label="Rate" mode="rate" active={sortMode === "rate"} onPress={setSortMode} />
            <SortButton label="Distance" mode="distance" active={sortMode === "distance"} onPress={setSortMode} />
            <SortButton label="Equipment" mode="equipment" active={sortMode === "equipment"} onPress={setSortMode} />
            <SortButton label="Specialty" mode="specialty" active={sortMode === "specialty"} onPress={setSortMode} />
          </View>
        </View>

        {!readiness.ready && (
          <View style={styles.warningNotice}>
            <Text style={styles.warningTitle}>Improve your recommendations</Text>
            <Text style={styles.warningText}>
              Complete bank connection, service area, and equipment setup to unlock better
              recommendations and accept freight.
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Recommended Loads</Text>

        <FlatList
          data={recommendations}
          keyExtractor={(item, index) => String(item.id || index)}
          scrollEnabled={false}
          renderItem={renderRecommendation}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="thumbs-up-outline" size={38} color={COLORS.red} />
              <Text style={styles.emptyTitle}>No recommendations yet.</Text>
              <Text style={styles.emptyText}>
                Complete service area, equipment, and specialty settings to improve recommendations.
              </Text>

              <TouchableOpacity style={styles.emptyButton} onPress={() => goTo(FREIGHT_ROUTES.serviceArea)}>
                <Ionicons name="map-outline" size={18} color="#FFFFFF" />
                <Text style={styles.emptyButtonText}>Set Service Area</Text>
              </TouchableOpacity>
            </View>
          }
        />

        <TouchableOpacity style={styles.primaryButton} onPress={() => goTo(FREIGHT_ROUTES.aiLoadMatching)}>
          <Ionicons name="sparkles-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Open AI Load Matching</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.darkButton} onPress={() => goTo(FREIGHT_ROUTES.managementCenter)}>
          <Ionicons name="apps-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Management Center</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
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
        <View style={[styles.fitFill, { width: `${Math.max(5, Math.min(100, value))}%`, backgroundColor: color }]} />
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