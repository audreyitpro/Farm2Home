// app/farmer/farm-bundles.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../data/supabaseClient";

const COLORS = {
  bg: "#F6F8F2",
  card: "#FFFFFF",
  text: "#162115",
  muted: "#667085",
  border: "#E3E8DD",
  green: "#1FA463",
  greenDark: "#0B5D35",
  greenSoft: "#E9F8EF",
  orangeSoft: "#FFF3DE",
  red: "#DC2626",
  white: "#FFFFFF",
};

type Farmer = {
  id?: string;
  farmer_id?: string;
  farmerId?: string;
  email?: string;
  farm_name?: string;
  farmName?: string;
  business_name?: string;
  businessName?: string;
};

type Bundle = {
  id: string;
  farmer_id: string;
  bundle_name: string;
  bundle_type: string;
  description: string;
  price: number;
  items: string[];
  available: boolean;
  delivery_enabled: boolean;
  shipping_enabled: boolean;
  monthly_enabled: boolean;
  bimonthly_enabled: boolean;
  created_at?: string;
};

const BUNDLE_TYPES = [
  "Meat",
  "Seafood",
  "Mixed Meat + Seafood",
  "Beef",
  "Chicken",
  "Turkey",
  "Goat",
  "Lamb",
  "Halal Meat",
  "Catfish",
  "Tilapia",
  "Shrimp",
];

const STARTER_BUNDLES = [
  "Beef Family Bundle",
  "Chicken Monthly Box",
  "Halal Meat Bundle",
  "Seafood Catch Box",
  "Shrimp + Fish Bundle",
  "Mixed Meat + Seafood Bundle",
];

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function money(value: any) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function getFarmerId(farmer?: Farmer | null) {
  return clean(farmer?.farmer_id || farmer?.farmerId || farmer?.id);
}

function getFarmName(farmer?: Farmer | null) {
  return (
    clean(farmer?.farm_name || farmer?.farmName) ||
    clean(farmer?.business_name || farmer?.businessName) ||
    "Farm2Home Farm"
  );
}

function splitItems(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function FarmerFarmBundlesScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [bundles, setBundles] = useState<Bundle[]>([]);

  const [bundleName, setBundleName] = useState("");
  const [bundleType, setBundleType] = useState("Meat");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [itemsText, setItemsText] = useState("");

  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [shippingEnabled, setShippingEnabled] = useState(true);
  const [monthlyEnabled, setMonthlyEnabled] = useState(true);
  const [bimonthlyEnabled, setBimonthlyEnabled] = useState(true);

  useFocusEffect(
    useCallback(() => {
      initialize();
    }, [])
  );

  const farmerId = getFarmerId(farmer);

  const stats = useMemo(() => {
    return {
      total: bundles.length,
      meat: bundles.filter((b) => normalize(b.bundle_type).includes("meat")).length,
      seafood: bundles.filter((b) => normalize(b.bundle_type).includes("seafood")).length,
    };
  }, [bundles]);

  async function readFarmer() {
    const raw =
      (await AsyncStorage.getItem("currentFarmer")) ||
      (await AsyncStorage.getItem("farm2homeCurrentFarmer")) ||
      (await AsyncStorage.getItem("farm2homeFarmerSession")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function initialize() {
    try {
      setLoading(true);

      const savedFarmer = await readFarmer();

      if (!getFarmerId(savedFarmer)) {
        Alert.alert("Login Required", "Please login as a farmer.");
        router.replace("/farmer/login" as any);
        return;
      }

      setFarmer(savedFarmer);
      await loadBundles(getFarmerId(savedFarmer));
    } finally {
      setLoading(false);
    }
  }

  async function loadBundles(id: string) {
    const { data, error } = await supabase
      .from("farm_bundles")
      .select("*")
      .eq("farmer_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      console.log("farm_bundles load error:", error.message);
      setBundles([]);
      return;
    }

    setBundles(
      (data || []).map((row: any) => ({
        ...row,
        items: Array.isArray(row.items) ? row.items : [],
      }))
    );
  }

  function useStarter(name: string) {
    setBundleName(name);

    if (normalize(name).includes("seafood") || normalize(name).includes("fish")) {
      setBundleType("Seafood");
      setItemsText("Fresh fish\nShrimp\nSeasonal seafood selection");
      setDescription("A curated seafood bundle for monthly or bi-monthly customers.");
      setPrice("129");
    } else if (normalize(name).includes("halal")) {
      setBundleType("Halal Meat");
      setItemsText("Halal beef\nHalal chicken\nHalal lamb or goat selection");
      setDescription("A curated halal meat bundle for recurring customers.");
      setPrice("149");
    } else {
      setBundleType("Meat");
      setItemsText("Beef selection\nChicken selection\nSausage or ground meat\nSeasonal farm add-on");
      setDescription("A curated farm meat bundle for recurring customers.");
      setPrice("139");
    }
  }

  async function createBundle() {
    try {
      if (!farmerId) {
        Alert.alert("Login Required", "Please login again.");
        return;
      }

      if (!bundleName.trim()) {
        Alert.alert("Bundle Name Needed", "Enter a bundle name.");
        return;
      }

      if (!Number(price)) {
        Alert.alert("Price Needed", "Enter a valid bundle price.");
        return;
      }

      if (!deliveryEnabled && !shippingEnabled) {
        Alert.alert("Fulfillment Needed", "Enable delivery, shipping, or both.");
        return;
      }

      if (!monthlyEnabled && !bimonthlyEnabled) {
        Alert.alert("Frequency Needed", "Enable monthly, bi-monthly, or both.");
        return;
      }

      setSaving(true);

      const payload = {
        farmer_id: farmerId,
        bundle_name: bundleName.trim(),
        bundle_type: bundleType,
        description: description.trim(),
        price: Number(price),
        items: splitItems(itemsText),
        available: true,
        delivery_enabled: deliveryEnabled,
        shipping_enabled: shippingEnabled,
        monthly_enabled: monthlyEnabled,
        bimonthly_enabled: bimonthlyEnabled,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("farm_bundles").insert([payload]);

      if (error) throw error;

      setBundleName("");
      setPrice("");
      setDescription("");
      setItemsText("");
      setDeliveryEnabled(true);
      setShippingEnabled(true);
      setMonthlyEnabled(true);
      setBimonthlyEnabled(true);

      await loadBundles(farmerId);

      Alert.alert("Bundle Created", "Your farm bundle is now available.");
    } catch (error: any) {
      Alert.alert("Save Error", error?.message || "Unable to create bundle.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAvailable(bundle: Bundle) {
    const next = !bundle.available;

    setBundles((prev) =>
      prev.map((item) =>
        item.id === bundle.id ? { ...item, available: next } : item
      )
    );

    await supabase
      .from("farm_bundles")
      .update({
        available: next,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bundle.id);
  }

  function renderBundle({ item }: { item: Bundle }) {
    return (
      <View style={styles.bundleCard}>
        <View style={styles.bundleHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bundleName}>{item.bundle_name}</Text>
            <Text style={styles.bundleType}>{item.bundle_type}</Text>
          </View>

          <Text style={styles.bundlePrice}>{money(item.price)}</Text>
        </View>

        <Text style={styles.bundleDescription}>
          {item.description || "No description added."}
        </Text>

        <View style={styles.itemWrap}>
          {(item.items || []).slice(0, 6).map((bundleItem, index) => (
            <Text key={`${item.id}-${index}`} style={styles.itemPill}>
              {bundleItem}
            </Text>
          ))}
        </View>

        <View style={styles.optionRow}>
          {item.delivery_enabled ? <Text style={styles.optionPill}>Delivery</Text> : null}
          {item.shipping_enabled ? <Text style={styles.optionPill}>Shipping</Text> : null}
          {item.monthly_enabled ? <Text style={styles.optionPill}>Monthly</Text> : null}
          {item.bimonthly_enabled ? <Text style={styles.optionPill}>Bi-Monthly</Text> : null}
        </View>

        <TouchableOpacity
          style={[styles.availabilityButton, !item.available && styles.unavailableButton]}
          onPress={() => toggleAvailable(item)}
        >
          <Text style={styles.availabilityText}>
            {item.available ? "Available to Customers" : "Unavailable"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.green} size="large" />
        <Text style={styles.loadingText}>Loading farm bundles...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FlatList
        data={bundles}
        keyExtractor={(item) => item.id}
        renderItem={renderBundle}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <View style={styles.topRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.push("/farmer/dashboard" as any)}
              >
                <Ionicons name="arrow-back-outline" size={22} color={COLORS.text} />
              </TouchableOpacity>

              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>Farm2Home Bundles</Text>
                <Text style={styles.title}>Meat & Seafood Bundles</Text>
                <Text style={styles.subtitle}>
                  Create recurring monthly or bi-monthly bundles for delivery or shipping.
                </Text>
              </View>
            </View>

            <View style={styles.hero}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroBadge}>{getFarmName(farmer)}</Text>
                <Text style={styles.heroTitle}>Build subscription-ready farm boxes.</Text>
                <Text style={styles.heroText}>
                  Customers can choose delivery or shipping, then select monthly or bi-monthly service.
                </Text>
              </View>
              <Text style={styles.heroEmoji}>🥩</Text>
            </View>

            <View style={styles.statsRow}>
              <Stat label="Bundles" value={String(stats.total)} />
              <Stat label="Meat" value={String(stats.meat)} />
              <Stat label="Seafood" value={String(stats.seafood)} />
            </View>

            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Create Bundle</Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.starterRow}>
                {STARTER_BUNDLES.map((name) => (
                  <TouchableOpacity key={name} style={styles.starterPill} onPress={() => useStarter(name)}>
                    <Text style={styles.starterText}>{name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Bundle Name</Text>
              <TextInput
                style={styles.input}
                value={bundleName}
                onChangeText={setBundleName}
                placeholder="Example: Beef Family Bundle"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.label}>Bundle Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
                {BUNDLE_TYPES.map((type) => {
                  const active = bundleType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[styles.typePill, active && styles.typePillActive]}
                      onPress={() => setBundleType(type)}
                    >
                      <Text style={[styles.typeText, active && styles.typeTextActive]}>{type}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.label}>Price</Text>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                placeholder="129.00"
                keyboardType="numeric"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe what customers receive."
                multiline
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.label}>Bundle Items</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={itemsText}
                onChangeText={setItemsText}
                placeholder={"Beef steaks\nGround beef\nChicken breast\nShrimp"}
                multiline
                placeholderTextColor="#94A3B8"
              />

              <Toggle label="Delivery Enabled" value={deliveryEnabled} onValueChange={setDeliveryEnabled} />
              <Toggle label="Shipping Enabled" value={shippingEnabled} onValueChange={setShippingEnabled} />
              <Toggle label="Monthly Enabled" value={monthlyEnabled} onValueChange={setMonthlyEnabled} />
              <Toggle label="Bi-Monthly Enabled" value={bimonthlyEnabled} onValueChange={setBimonthlyEnabled} />

              <TouchableOpacity style={styles.createButton} onPress={createBundle} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.createText}>Create Farm Bundle</Text>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Your Bundles</Text>

            {!bundles.length ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyEmoji}>🧺</Text>
                <Text style={styles.emptyTitle}>No bundles created yet</Text>
                <Text style={styles.emptyText}>
                  Create your first meat or seafood bundle above.
                </Text>
              </View>
            ) : null}
          </>
        }
      />
    </KeyboardAvoidingView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Toggle({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg },
  loadingText: { marginTop: 10, color: COLORS.muted, fontWeight: "800" },
  content: { padding: 16, paddingBottom: 110 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: { color: COLORS.green, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8, fontSize: 12 },
  title: { color: COLORS.text, fontSize: 27, fontWeight: "900", marginTop: 2 },
  subtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 4 },
  hero: {
    backgroundColor: COLORS.green,
    borderRadius: 28,
    padding: 20,
    marginBottom: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  heroBadge: { color: "#D9F99D", fontWeight: "900", textTransform: "uppercase", fontSize: 11 },
  heroTitle: { color: COLORS.white, fontSize: 25, fontWeight: "900", marginTop: 6 },
  heroText: { color: COLORS.white, opacity: 0.9, fontWeight: "700", lineHeight: 20, marginTop: 8 },
  heroEmoji: { fontSize: 46 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: { color: COLORS.greenDark, fontWeight: "900", fontSize: 24 },
  statLabel: { color: COLORS.muted, fontWeight: "800", marginTop: 3 },
  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 18,
  },
  formTitle: { color: COLORS.text, fontWeight: "900", fontSize: 22, marginBottom: 12 },
  starterRow: { gap: 8, paddingBottom: 12 },
  starterPill: {
    backgroundColor: COLORS.greenSoft,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  starterText: { color: COLORS.greenDark, fontWeight: "900" },
  label: { color: COLORS.text, fontWeight: "900", marginBottom: 7, marginTop: 10 },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: COLORS.text,
    fontWeight: "800",
  },
  textArea: { minHeight: 92, textAlignVertical: "top" },
  typeRow: { gap: 8 },
  typePill: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  typePillActive: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  typeText: { color: COLORS.text, fontWeight: "900" },
  typeTextActive: { color: COLORS.white },
  toggleRow: {
    marginTop: 10,
    backgroundColor: COLORS.greenSoft,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  toggleLabel: { color: COLORS.greenDark, fontWeight: "900" },
  createButton: {
    backgroundColor: COLORS.green,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 16,
  },
  createText: { color: COLORS.white, fontWeight: "900", fontSize: 15 },
  sectionTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900", marginBottom: 12 },
  bundleCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
  },
  bundleHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  bundleName: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  bundleType: { color: COLORS.muted, fontWeight: "800", marginTop: 3 },
  bundlePrice: { color: COLORS.greenDark, fontSize: 19, fontWeight: "900" },
  bundleDescription: { color: COLORS.text, fontWeight: "700", lineHeight: 20, marginTop: 10 },
  itemWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
  itemPill: {
    backgroundColor: COLORS.orangeSoft,
    color: "#92400E",
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
  optionPill: {
    backgroundColor: COLORS.greenSoft,
    color: COLORS.greenDark,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  availabilityButton: {
    backgroundColor: COLORS.green,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 14,
  },
  unavailableButton: { backgroundColor: COLORS.red },
  availabilityText: { color: COLORS.white, fontWeight: "900" },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  emptyEmoji: { fontSize: 42 },
  emptyTitle: { color: COLORS.text, fontWeight: "900", fontSize: 18, marginTop: 8 },
  emptyText: { color: COLORS.muted, fontWeight: "700", textAlign: "center", marginTop: 6 },
});