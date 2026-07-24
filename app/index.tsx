// app/index.tsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "./data/supabaseClient";

const ui = {
  bg: "#F7FBF4",
  card: "#FFFFFF",
  text: "#102A1C",
  muted: "#5F6F64",
  green: "#166534",
  greenDark: "#14532D",
  greenSoft: "#DCFCE7",
  orange: "#EA580C",
  blue: "#1D4ED8",
  border: "#DDE7D6",
  surface: "#F8FAFC",
  white: "#FFFFFF",
};

type FarmerStateSummary = {
  state: string;
  farmerCount: number;
};

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia",
};

const STATE_ABBREVIATIONS = Object.entries(STATE_NAMES).reduce<Record<string, string>>(
  (acc, [abbr, name]) => {
    acc[name.toLowerCase()] = abbr;
    return acc;
  },
  {}
);

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalizeBoolean(value: any): boolean | null {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;

  const normalized = clean(value).toLowerCase();

  if (["true", "1", "yes", "y", "active", "enabled"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "n", "inactive", "disabled"].includes(normalized)) {
    return false;
  }

  return null;
}

function normalizeState(value: any) {
  const raw = clean(value)
    .replace(/\./g, "")
    .replace(/\s+/g, " ");

  if (!raw) return "";

  const upper = raw.toUpperCase();

  if (STATE_NAMES[upper]) return upper;

  const fullNameMatch = STATE_ABBREVIATIONS[raw.toLowerCase()];
  if (fullNameMatch) return fullNameMatch;

  const stateAtEnd = upper.match(
    /(?:,|\s)(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)(?:\s+\d{5}(?:-\d{4})?)?$/
  );

  if (stateAtEnd?.[1]) return stateAtEnd[1];

  return "";
}

function hasPositiveStatus(row: any) {
  const statuses = [
    row?.status,
    row?.account_status,
    row?.membership_status,
    row?.subscription_status,
    row?.verification_status,
    row?.admin_review_status,
    row?.store_status,
    row?.marketplace_status,
    row?.approval_status,
  ]
    .map((value) => clean(value).toLowerCase())
    .filter(Boolean);

  return statuses.some((status) =>
    [
      "active",
      "approved",
      "verified",
      "complete",
      "completed",
      "submitted",
      "live",
      "published",
      "enabled",
      "paid",
      "current",
    ].includes(status)
  );
}

function hasNegativeStatus(row: any) {
  const statuses = [
    row?.status,
    row?.account_status,
    row?.membership_status,
    row?.subscription_status,
    row?.verification_status,
    row?.admin_review_status,
    row?.store_status,
    row?.marketplace_status,
    row?.approval_status,
  ]
    .map((value) => clean(value).toLowerCase())
    .filter(Boolean);

  return statuses.some((status) =>
    [
      "inactive",
      "disabled",
      "suspended",
      "rejected",
      "cancelled",
      "canceled",
      "deleted",
      "closed",
      "expired",
    ].includes(status)
  );
}

function isFarmerActive(row: any) {
  const activeFlagValues = [
    row?.is_active,
    row?.account_active,
    row?.approved,
    row?.is_approved,
    row?.marketplace_active,
    row?.store_active,
    row?.subscription_active,
    row?.membership_active,
    row?.is_live,
    row?.published,
  ].map(normalizeBoolean);

  if (activeFlagValues.some((value) => value === true)) return true;

  if (hasPositiveStatus(row)) return true;
  if (hasNegativeStatus(row)) return false;

  const hasFarmerIdentity = Boolean(
    clean(
      row?.id ||
        row?.farmer_id ||
        row?.farm_name ||
        row?.business_name ||
        row?.company_name ||
        row?.email
    )
  );

  return hasFarmerIdentity;
}

function getFarmerState(row: any) {
  const directValues = [
    row?.state,
    row?.farm_state,
    row?.business_state,
    row?.store_state,
    row?.address_state,
    row?.location_state,
    row?.state_code,
    row?.farm_state_code,
    row?.shipping_state,
    row?.pickup_state,
  ];

  for (const value of directValues) {
    const normalized = normalizeState(value);
    if (normalized) return normalized;
  }

  const addressValues = [
    row?.address,
    row?.farm_address,
    row?.business_address,
    row?.store_address,
    row?.pickup_address,
    row?.full_address,
    row?.location,
  ];

  for (const value of addressValues) {
    const normalized = normalizeState(value);
    if (normalized) return normalized;
  }

  return "";
}

export default function HomeScreen() {
  const [farmersByState, setFarmersByState] = useState<FarmerStateSummary[]>([]);
  const [activeFarmerTotal, setActiveFarmerTotal] = useState(0);
  const [loadingFarmerStates, setLoadingFarmerStates] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const activeStateTotal = farmersByState.length;
  const topStates = useMemo(() => farmersByState, [farmersByState]);

  const loadActiveFarmersByState = useCallback(async () => {
    try {
      setLoadingFarmerStates(true);

      const { data, error } = await supabase
        .from("farmers")
        .select("*");

      if (error) {
        console.log("Active farmers by state error:", error.message);
        setFarmersByState([]);
        setActiveFarmerTotal(0);
        return;
      }

      const rows = Array.isArray(data) ? data : [];

      const activeFarmers = rows.filter((farmer: any) => {
        const state = getFarmerState(farmer);
        return Boolean(state && isFarmerActive(farmer));
      });

      const grouped = activeFarmers.reduce<Record<string, number>>(
        (acc, farmer: any) => {
          const state = getFarmerState(farmer);

          if (!state) return acc;

          acc[state] = (acc[state] || 0) + 1;
          return acc;
        },
        {}
      );

      console.log("Farmer state counter:", {
        totalFarmerRows: rows.length,
        activeFarmersWithState: activeFarmers.length,
        grouped,
      });

      const summaries = Object.entries(grouped)
        .map(([state, farmerCount]) => ({ state, farmerCount }))
        .sort((a, b) => b.farmerCount - a.farmerCount || a.state.localeCompare(b.state));

      setFarmersByState(summaries);
      setActiveFarmerTotal(activeFarmers.length);
    } catch (error) {
      console.log("Active farmer state load failed:", error);
      setFarmersByState([]);
      setActiveFarmerTotal(0);
    } finally {
      setLoadingFarmerStates(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadActiveFarmersByState();
  }, [loadActiveFarmersByState]);

  async function onRefresh() {
    setRefreshing(true);
    await loadActiveFarmersByState();
  }

  function openMarketplaceForState(state: string) {
    router.push({
      pathname: "/customer/marketplace",
      params: { state, farmerState: state },
    } as any);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={ui.greenDark} />

      <ScrollView
        style={styles.page}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ui.green} />
        }
      >
        <View style={styles.hero}>
          <Image
            source={{
              uri: "https://images.unsplash.com/photo-1500937386664-56d1dfef3854",
            }}
            style={styles.heroImage}
          />

          <View style={styles.overlay}>
            <Image
              source={require("../assets/images/farm2home-logo.jpg")}
              style={styles.logo}
              resizeMode="contain"
            />

            <View style={styles.badge}>
              <Ionicons name="leaf-outline" size={17} color={ui.greenDark} />
              <Text style={styles.badgeText}>
                Local Farms • Fresh Food • Fast Delivery
              </Text>
            </View>

            <Text style={styles.heroTitle}>
              Fresh From Local Farms To Your Family
            </Text>

            <Text style={styles.heroSubtitle}>
              Shop fresh produce, eggs, dairy, meat, fish, honey, baked goods,
              flowers, hay, and local farm products directly from trusted farmers.
            </Text>

            <View style={styles.heroActions}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.push("/customer/login" as any)}
                activeOpacity={0.88}
              >
                <Ionicons name="basket-outline" size={20} color="#FFFFFF" />
                <Text style={styles.primaryText}>Shop Farm Fresh</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.lightButton}
                onPress={() => router.push("/farmer/register" as any)}
                activeOpacity={0.88}
              >
                <Ionicons name="leaf-outline" size={20} color={ui.greenDark} />
                <Text style={styles.lightButtonText}>Sell As A Farmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>How it works</Text>
          <Text style={styles.sectionTitle}>
            Farm2Home connects the whole farm market.
          </Text>

          <View style={styles.cardRow}>
            <FeatureCard
              icon="basket-outline"
              title="Shop Fresh Food"
              text="Customers browse local produce, meats, dairy, baked goods, flowers, and seasonal farm products."
            />

            <FeatureCard
              icon="leaf-outline"
              title="Support Farmers"
              text="Farmers sell directly to families, communities, businesses, and nearby markets."
            />

            <FeatureCard
              icon="home-outline"
              title="Pickup or Delivery"
              text="Customers can choose pickup or delivery based on what each farmer offers."
            />

            <FeatureCard
              icon="car-outline"
              title="Driver Network"
              text="Drivers can subscribe, view available deliveries, and accept delivery work."
            />
          </View>

          <View style={styles.portalGrid}>
            <PortalCard
              icon="person-circle-outline"
              title="Customer Portal"
              text="Shop farm-fresh food and manage orders."
              primaryLabel="Customer Login"
              primaryRoute="/customer/login"
              secondaryLabel="Create Customer Account"
              secondaryRoute="/customer/register"
              color={ui.green}
            />

            <PortalCard
              icon="leaf-outline"
              title="Farmer Portal"
              text="Apply, complete compliance, connect Stripe, and build your farm store."
              primaryLabel="Become a Farmer"
              primaryRoute="/farmer/register"
              secondaryLabel="Farmer Login"
              secondaryRoute="/farmer/login"
              color={ui.greenDark}
            />

            <PortalCard
              icon="trail-sign-outline"
              title="Freight Connect"
              text="Carriers and freight users can register, post loads, and manage freight activity."
              primaryLabel="Freight Registration"
              primaryRoute="/freight/register"
              secondaryLabel="Freight Login"
              secondaryRoute="/freight/login"
              color={ui.blue}
            />

            <PortalCard
              icon="car-outline"
              title="Driver Delivery Network"
              text="Drivers can subscribe, log in, view the board, and accept delivery opportunities."
              primaryLabel="Driver Login / Setup"
              primaryRoute="/driver/login"
              secondaryLabel="Driver Board"
              secondaryRoute="/driver/board"
              color={ui.orange}
            />
          </View>

          <View style={styles.farmerStatesSection}>
            <View style={styles.farmerStatesHeader}>
              <View style={styles.farmerStatesHeaderText}>
                <Text style={styles.farmerStatesEyebrow}>Growing across America</Text>
                <Text style={styles.farmerStatesTitle}>Active Farmers by State</Text>
                <Text style={styles.farmerStatesSubtitle}>
                  {activeFarmerTotal} active {activeFarmerTotal === 1 ? "farmer" : "farmers"} across{" "}
                  {activeStateTotal} active {activeStateTotal === 1 ? "state" : "states"}.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.viewAllButton}
                onPress={() => router.push("/customer/marketplace" as any)}
                activeOpacity={0.88}
              >
                <Text style={styles.viewAllText}>View all farmers</Text>
                <Ionicons name="arrow-forward-outline" size={16} color={ui.green} />
              </TouchableOpacity>
            </View>

            <View style={styles.farmerStatsRow}>
              <View style={styles.farmerStatCard}>
                <View style={styles.farmerStatIcon}>
                  <Ionicons name="leaf-outline" size={20} color={ui.greenDark} />
                </View>
                <View>
                  <Text style={styles.farmerStatValue}>{activeFarmerTotal}</Text>
                  <Text style={styles.farmerStatLabel}>Active Farmers</Text>
                </View>
              </View>

              <View style={styles.farmerStatCard}>
                <View style={styles.farmerStatIcon}>
                  <Ionicons name="map-outline" size={20} color={ui.greenDark} />
                </View>
                <View>
                  <Text style={styles.farmerStatValue}>{activeStateTotal}</Text>
                  <Text style={styles.farmerStatLabel}>Active States</Text>
                </View>
              </View>
            </View>

            {loadingFarmerStates ? (
              <View style={styles.farmerLoadingCard}>
                <ActivityIndicator size="small" color={ui.green} />
                <Text style={styles.farmerLoadingText}>Loading active farmer states...</Text>
              </View>
            ) : topStates.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.farmerStateCards}
              >
                {topStates.map((item) => (
                  <TouchableOpacity
                    key={item.state}
                    style={styles.farmerStateCard}
                    onPress={() => openMarketplaceForState(item.state)}
                    activeOpacity={0.88}
                  >
                    <View style={styles.stateCardTop}>
                      <View style={styles.stateIcon}>
                        <Ionicons name="location-outline" size={18} color={ui.greenDark} />
                      </View>
                      <View style={styles.liveBadge}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveBadgeText}>Active</Text>
                      </View>
                    </View>

                    <Text style={styles.stateAbbreviation}>{item.state}</Text>
                    <Text style={styles.stateFullName}>{STATE_NAMES[item.state] || item.state}</Text>
                    <Text style={styles.stateFarmerCount}>{item.farmerCount}</Text>
                    <Text style={styles.stateFarmerLabel}>
                      {item.farmerCount === 1 ? "Farmer" : "Farmers"}
                    </Text>

                    <View style={styles.stateCardFooter}>
                      <Text style={styles.viewFarmsText}>View farms</Text>
                      <Ionicons name="chevron-forward-outline" size={15} color={ui.greenDark} />
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.noFarmerStatesCard}>
                <View style={styles.noFarmerIcon}>
                  <Ionicons name="leaf-outline" size={24} color={ui.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.noFarmerStatesTitle}>No active farmer states yet</Text>
                  <Text style={styles.noFarmerStatesText}>
                    Active farmers will appear here once their account and store are active.
                  </Text>
                </View>
                <TouchableOpacity style={styles.refreshStatesButton} onPress={loadActiveFarmersByState}>
                  <Ionicons name="refresh-outline" size={17} color={ui.green} />
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.marketplaceButton}
              onPress={() => router.push("/customer/marketplace" as any)}
              activeOpacity={0.88}
            >
              <Ionicons name="storefront-outline" size={19} color={ui.white} />
              <Text style={styles.marketplaceButtonText}>Explore All Active Farmers</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureCard({
  icon,
  title,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
}) {
  return (
    <View style={styles.featureCard}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={26} color={ui.greenDark} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardText}>{text}</Text>
    </View>
  );
}

function PortalCard({
  icon,
  title,
  text,
  primaryLabel,
  primaryRoute,
  secondaryLabel,
  secondaryRoute,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  primaryLabel: string;
  primaryRoute: string;
  secondaryLabel: string;
  secondaryRoute: string;
  color: string;
}) {
  return (
    <View style={styles.portalCard}>
      <View style={[styles.portalIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>

      <Text style={styles.portalTitle}>{title}</Text>
      <Text style={styles.portalText}>{text}</Text>

      <TouchableOpacity
        style={[styles.portalPrimaryButton, { backgroundColor: color }]}
        onPress={() => router.push(primaryRoute as any)}
        activeOpacity={0.88}
      >
        <Text style={styles.portalPrimaryText}>{primaryLabel}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.portalSecondaryButton}
        onPress={() => router.push(secondaryRoute as any)}
        activeOpacity={0.88}
      >
        <Text style={[styles.portalSecondaryText, { color }]}>
          {secondaryLabel}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: ui.bg,
  },
  page: {
    flex: 1,
    backgroundColor: ui.bg,
  },
  hero: {
    height: 760,
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  overlay: {
    position: "absolute",
    inset: 0 as any,
    backgroundColor: "rgba(0,0,0,0.48)",
    justifyContent: "center",
    alignItems: "center",
    padding: 22,
  },
  logo: {
    width: 230,
    height: 150,
    marginBottom: 14,
    borderRadius: 24,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 16,
  },
  badgeText: {
    color: ui.greenDark,
    fontWeight: "900",
    fontSize: 13,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 46,
    fontWeight: "900",
    textAlign: "center",
    maxWidth: 920,
    marginBottom: 14,
  },
  heroSubtitle: {
    color: "#F8FAFC",
    fontSize: 20,
    lineHeight: 30,
    textAlign: "center",
    maxWidth: 780,
    marginBottom: 28,
    fontWeight: "600",
  },
  heroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
  },
  primaryButton: {
    backgroundColor: ui.green,
    paddingHorizontal: 26,
    paddingVertical: 16,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  lightButton: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  lightButtonText: {
    color: ui.greenDark,
    fontWeight: "900",
    fontSize: 16,
  },
  section: {
    padding: 20,
    paddingBottom: 70,
  },
  sectionEyebrow: {
    color: ui.green,
    fontWeight: "900",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: "900",
    color: ui.text,
    textAlign: "center",
    marginBottom: 24,
  },
  cardRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 14,
    marginBottom: 28,
  },
  featureCard: {
    width: 280,
    backgroundColor: ui.card,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: ui.border,
    alignItems: "center",
  },
  featureIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: ui.greenSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: ui.text,
    marginBottom: 8,
    textAlign: "center",
  },
  cardText: {
    color: ui.muted,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 21,
  },
  portalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    justifyContent: "center",
    marginTop: 8,
  },
  portalCard: {
    width: 310,
    backgroundColor: ui.card,
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: ui.border,
  },
  portalIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  portalTitle: {
    color: ui.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 8,
  },
  portalText: {
    color: ui.muted,
    fontWeight: "700",
    lineHeight: 21,
    minHeight: 64,
    marginBottom: 16,
  },
  portalPrimaryButton: {
    borderRadius: 16,
    padding: 15,
    alignItems: "center",
    marginBottom: 10,
  },
  portalPrimaryText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
    textAlign: "center",
  },
  portalSecondaryButton: {
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: ui.border,
    backgroundColor: "#FFFFFF",
  },
  portalSecondaryText: {
    fontWeight: "900",
    fontSize: 15,
    textAlign: "center",
  },

  farmerStatesSection: {
    width: "100%",
    maxWidth: 1320,
    alignSelf: "center",
    backgroundColor: ui.card,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: ui.border,
    padding: 20,
    marginTop: 30,
  },
  farmerStatesHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 18,
  },
  farmerStatesHeaderText: {
    flex: 1,
    minWidth: 240,
  },
  farmerStatesEyebrow: {
    color: ui.green,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
  },
  farmerStatesTitle: {
    color: ui.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    marginTop: 5,
  },
  farmerStatesSubtitle: {
    color: ui.muted,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 6,
  },
  viewAllButton: {
    backgroundColor: ui.greenSoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  viewAllText: {
    color: ui.green,
    fontWeight: "900",
    fontSize: 12,
  },
  farmerStatsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  farmerStatCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: ui.surface,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  farmerStatIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: ui.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  farmerStatValue: {
    color: ui.greenDark,
    fontSize: 24,
    fontWeight: "900",
  },
  farmerStatLabel: {
    color: ui.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  farmerLoadingCard: {
    minHeight: 120,
    backgroundColor: ui.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ui.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  farmerLoadingText: {
    color: ui.muted,
    fontWeight: "800",
  },
  farmerStateCards: {
    gap: 11,
    paddingRight: 12,
    paddingBottom: 4,
  },
  farmerStateCard: {
    width: 150,
    minHeight: 205,
    backgroundColor: "#F0FDF4",
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  stateCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  stateIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: ui.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  liveBadge: {
    backgroundColor: ui.white,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#22C55E",
  },
  liveBadgeText: {
    color: ui.greenDark,
    fontWeight: "900",
    fontSize: 9,
  },
  stateAbbreviation: {
    color: ui.greenDark,
    fontSize: 22,
    fontWeight: "900",
  },
  stateFullName: {
    color: ui.muted,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
    minHeight: 30,
  },
  stateFarmerCount: {
    color: ui.greenDark,
    fontSize: 31,
    fontWeight: "900",
    marginTop: 8,
  },
  stateFarmerLabel: {
    color: ui.muted,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 1,
  },
  stateCardFooter: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#BBF7D0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  viewFarmsText: {
    color: ui.greenDark,
    fontSize: 11,
    fontWeight: "900",
  },
  noFarmerStatesCard: {
    backgroundColor: ui.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ui.border,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  noFarmerIcon: {
    width: 46,
    height: 46,
    borderRadius: 17,
    backgroundColor: ui.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  noFarmerStatesTitle: {
    color: ui.text,
    fontWeight: "900",
    fontSize: 15,
  },
  noFarmerStatesText: {
    color: ui.muted,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 4,
  },
  refreshStatesButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: ui.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  marketplaceButton: {
    alignSelf: "center",
    backgroundColor: ui.green,
    borderRadius: 17,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
  },
  marketplaceButtonText: {
    color: ui.white,
    fontWeight: "900",
    fontSize: 14,
  },
});