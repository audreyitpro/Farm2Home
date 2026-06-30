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
  orange: "#FFB74A",
  orangeSoft: "#FFF3DE",
  red: "#DC2626",
  redSoft: "#FEE2E2",
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
  name?: string;
  bundle_name: string;
  category?: string;
  bundle_type: string;
  description: string;
  price: number;
  monthly_price: number;
  bimonthly_price: number;
  items: string[];
  available: boolean;
  is_active?: boolean;
  marketplace_visible?: boolean;
  delivery_enabled: boolean;
  shipping_enabled: boolean;
  monthly_enabled: boolean;
  bimonthly_enabled: boolean;
  delivery_frequency?: "monthly" | "bimonthly" | "both";
  created_at?: string;
};

const BUNDLE_TYPES = [
  { label: "Produce", emoji: "🥬" },
  { label: "Meat", emoji: "🥩" },
  { label: "Seafood", emoji: "🐟" },
  { label: "Mixed Farm Box", emoji: "🧺" },
  { label: "Beef", emoji: "🐄" },
  { label: "Chicken", emoji: "🐓" },
  { label: "Turkey", emoji: "🦃" },
  { label: "Goat", emoji: "🐐" },
  { label: "Lamb", emoji: "🐑" },
  { label: "Halal Meat", emoji: "🥩" },
  { label: "Shrimp", emoji: "🦐" },
  { label: "Fish", emoji: "🐟" },
];

const STARTER_BUNDLES = [
  {
    name: "Fresh Produce Box",
    type: "Produce",
    monthlyPrice: "59",
    bimonthlyPrice: "109",
    items: "Leafy greens\nTomatoes\nSeasonal vegetables\nFarm fruit add-on",
    description: "A fresh local produce box for customers who want seasonal farm goods.",
  },
  {
    name: "Beef Family Bundle",
    type: "Beef",
    monthlyPrice: "139",
    bimonthlyPrice: "259",
    items: "Steaks\nGround beef\nRoast\nSeasonal farm add-on",
    description: "A family-size beef bundle for recurring monthly or bi-monthly customers.",
  },
  {
    name: "Chicken Monthly Box",
    type: "Chicken",
    monthlyPrice: "99",
    bimonthlyPrice: "189",
    items: "Chicken breast\nChicken thighs\nWhole chicken\nFarm seasoning add-on",
    description: "A recurring chicken box with fresh farm selections.",
  },
  {
    name: "Halal Meat Bundle",
    type: "Halal Meat",
    monthlyPrice: "149",
    bimonthlyPrice: "279",
    items: "Halal beef\nHalal chicken\nHalal lamb or goat selection",
    description: "A halal meat bundle prepared for recurring customers.",
  },
  {
    name: "Seafood Catch Box",
    type: "Seafood",
    monthlyPrice: "129",
    bimonthlyPrice: "239",
    items: "Fresh fish\nShrimp\nSeasonal seafood selection",
    description: "A curated seafood box for delivery or shipping.",
  },
  {
    name: "Mixed Farm Box",
    type: "Mixed Farm Box",
    monthlyPrice: "119",
    bimonthlyPrice: "219",
    items: "Fresh produce\nMeat selection\nSeafood or protein add-on\nSeasonal item",
    description: "A mixed farmers market box with produce and protein options.",
  },
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
  const [bundleType, setBundleType] = useState("Produce");
  const [monthlyPrice, setMonthlyPrice] = useState("");
  const [bimonthlyPrice, setBimonthlyPrice] = useState("");
  const [description, setDescription] = useState("");
  const [itemsText, setItemsText] = useState("");

  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [shippingEnabled, setShippingEnabled] = useState(false);
  const [monthlyEnabled, setMonthlyEnabled] = useState(true);
  const [bimonthlyEnabled, setBimonthlyEnabled] = useState(true);

  useFocusEffect(
    useCallback(() => {
      initialize();
    }, [])
  );

  const farmerId = getFarmerId(farmer);

  const selectedTypeEmoji = useMemo(() => {
    return BUNDLE_TYPES.find((item) => item.label === bundleType)?.emoji || "🧺";
  }, [bundleType]);

  const stats = useMemo(() => {
    return {
      total: bundles.length,
      active: bundles.filter((b) => b.available).length,
      recurring: bundles.filter((b) => b.monthly_enabled || b.bimonthly_enabled).length,
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
        name: row.name || row.bundle_name || "Farm Bundle",
        bundle_name: row.bundle_name || row.name || "Farm Bundle",
        category: row.category || row.bundle_type || "Farm Bundle",
        bundle_type: row.bundle_type || row.category || "Farm Bundle",
        price: Number(row.price || row.monthly_price || row.bimonthly_price || 0),
        monthly_price: Number(row.monthly_price || row.price || 0),
        bimonthly_price: Number(row.bimonthly_price || 0),
        available: row.available !== false && row.is_active !== false && row.marketplace_visible !== false,
        is_active: row.is_active !== false,
        marketplace_visible: row.marketplace_visible !== false,
        items: Array.isArray(row.items) ? row.items : [],
      }))
    );
  }

  function useStarter(bundle: (typeof STARTER_BUNDLES)[number]) {
    setBundleName(bundle.name);
    setBundleType(bundle.type);
    setMonthlyPrice(bundle.monthlyPrice);
    setBimonthlyPrice(bundle.bimonthlyPrice);
    setItemsText(bundle.items);
    setDescription(bundle.description);
  }

  function resetForm() {
    setBundleName("");
    setBundleType("Produce");
    setMonthlyPrice("");
    setBimonthlyPrice("");
    setDescription("");
    setItemsText("");
    setDeliveryEnabled(true);
    setShippingEnabled(false);
    setMonthlyEnabled(true);
    setBimonthlyEnabled(true);
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

      if (monthlyEnabled && Number(monthlyPrice) <= 0) {
        Alert.alert("Monthly Price Needed", "Enter a valid monthly bundle price.");
        return;
      }

      if (bimonthlyEnabled && Number(bimonthlyPrice) <= 0) {
        Alert.alert("Bi-Monthly Price Needed", "Enter a valid bi-monthly bundle price.");
        return;
      }

      if (!splitItems(itemsText).length) {
        Alert.alert("Bundle Items Needed", "Add at least one item included in the bundle.");
        return;
      }

      if (!deliveryEnabled && !shippingEnabled) {
        Alert.alert("Fulfillment Needed", "Enable local delivery, shipping, or both.");
        return;
      }

      if (!monthlyEnabled && !bimonthlyEnabled) {
        Alert.alert("Subscription Needed", "Enable monthly, bi-monthly, or both.");
        return;
      }

      setSaving(true);

      const monthlyAmount = monthlyEnabled ? Number(monthlyPrice) : 0;
      const bimonthlyAmount = bimonthlyEnabled ? Number(bimonthlyPrice) : 0;
      const primaryPrice = monthlyEnabled ? monthlyAmount : bimonthlyAmount;

      const payload = {
        farmer_id: farmerId,

        // Keep both names so the marketplace can read either field.
        name: bundleName.trim(),
        bundle_name: bundleName.trim(),

        // Keep both category fields so customer marketplace filters can use category.
        category: bundleType,
        bundle_type: bundleType,

        description: description.trim(),
        price: primaryPrice,
        monthly_price: monthlyAmount,
        bimonthly_price: bimonthlyAmount,

        items: splitItems(itemsText),

        available: true,
        is_active: true,
        marketplace_visible: true,

        delivery_enabled: deliveryEnabled,
        shipping_enabled: shippingEnabled,
        monthly_enabled: monthlyEnabled,
        bimonthly_enabled: bimonthlyEnabled,
        delivery_frequency:
          monthlyEnabled && bimonthlyEnabled
            ? "both"
            : monthlyEnabled
              ? "monthly"
              : "bimonthly",

        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("farm_bundles").insert([payload]);

      if (error) throw error;

      resetForm();
      await loadBundles(farmerId);

      Alert.alert(
        "Added to Market",
        "Your bundle is now available for customers to select and subscribe."
      );
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

    const { error } = await supabase
      .from("farm_bundles")
      .update({
        available: next,
        is_active: next,
        marketplace_visible: next,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bundle.id);

    if (error) {
      Alert.alert("Update Error", error.message);
      await loadBundles(farmerId);
    }
  }

  async function deleteBundle(bundle: Bundle) {
    Alert.alert(
      "Remove Bundle",
      `Remove ${bundle.bundle_name} from your market?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const previous = bundles;
            setBundles((prev) => prev.filter((item) => item.id !== bundle.id));

            const { error } = await supabase
              .from("farm_bundles")
              .delete()
              .eq("id", bundle.id);

            if (error) {
              setBundles(previous);
              Alert.alert("Remove Error", error.message);
            }
          },
        },
      ]
    );
  }

  function renderBundle({ item }: { item: Bundle }) {
    return (
      <View style={styles.bundleCard}>
        <View style={styles.bundleHeader}>
          <View style={styles.bundleEmoji}>
            <Text style={styles.bundleEmojiText}>
              {BUNDLE_TYPES.find((type) => type.label === item.bundle_type)?.emoji || "🧺"}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.bundleName}>{item.bundle_name}</Text>
            <Text style={styles.bundleType}>{item.bundle_type}</Text>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            {item.monthly_enabled ? (
              <Text style={styles.bundlePrice}>M: {money(item.monthly_price)}</Text>
            ) : null}
            {item.bimonthly_enabled ? (
              <Text style={styles.bundlePriceSmall}>Bi: {money(item.bimonthly_price)}</Text>
            ) : null}
          </View>
        </View>

        <Text style={styles.bundleDescription}>
          {item.description || "No description added."}
        </Text>

        <View style={styles.itemWrap}>
          {(item.items || []).slice(0, 8).map((bundleItem, index) => (
            <Text key={`${item.id}-${index}`} style={styles.itemPill}>
              {bundleItem}
            </Text>
          ))}
        </View>

        <View style={styles.optionRow}>
          {item.delivery_enabled ? <Text style={styles.optionPill}>Local Delivery</Text> : null}
          {item.shipping_enabled ? <Text style={styles.optionPill}>Shipping</Text> : null}
          {item.monthly_enabled ? <Text style={styles.optionPill}>Monthly</Text> : null}
          {item.bimonthly_enabled ? <Text style={styles.optionPill}>Bi-Monthly</Text> : null}
        </View>

        <View style={styles.bundleActions}>
          <TouchableOpacity
            style={[styles.availabilityButton, !item.available && styles.unavailableButton]}
            onPress={() => toggleAvailable(item)}
          >
            <Ionicons
              name={item.available ? "storefront-outline" : "eye-off-outline"}
              size={17}
              color={COLORS.white}
            />
            <Text style={styles.availabilityText}>
              {item.available ? "Live in Market" : "Hidden"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => deleteBundle(item)}
          >
            <Ionicons name="trash-outline" size={17} color={COLORS.red} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.green} size="large" />
        <Text style={styles.loadingText}>Loading market bundles...</Text>
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
        showsVerticalScrollIndicator={false}
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
                <Text style={styles.eyebrow}>Farm2Home Market</Text>
                <Text style={styles.title}>Add Bundles to Market</Text>
                <Text style={styles.subtitle}>
                  Build produce, meat, seafood, or mixed farm boxes customers can subscribe to.
                </Text>
              </View>
            </View>

            <View style={styles.hero}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroBadge}>{getFarmName(farmer)}</Text>
                <Text style={styles.heroTitle}>Create a market-ready bundle.</Text>
                <Text style={styles.heroText}>
                  Farmers create the bundle. Customers choose delivery or shipping,
                  then subscribe monthly or bi-monthly.
                </Text>
              </View>
              <Text style={styles.heroEmoji}>🧺</Text>
            </View>

            <View style={styles.statsRow}>
              <Stat label="Total Bundles" value={String(stats.total)} />
              <Stat label="Live in Market" value={String(stats.active)} />
              <Stat label="Recurring" value={String(stats.recurring)} />
            </View>

            <View style={styles.flowCard}>
              <Text style={styles.flowTitle}>Market Flow</Text>

              <View style={styles.flowStep}>
                <Text style={styles.flowNumber}>1</Text>
                <Text style={styles.flowText}>Choose bundle type</Text>
              </View>

              <View style={styles.flowStep}>
                <Text style={styles.flowNumber}>2</Text>
                <Text style={styles.flowText}>Add monthly / bi-monthly prices, description, and included items</Text>
              </View>

              <View style={styles.flowStep}>
                <Text style={styles.flowNumber}>3</Text>
                <Text style={styles.flowText}>Enable delivery, shipping, and subscription frequency</Text>
              </View>

              <View style={styles.flowStep}>
                <Text style={styles.flowNumber}>4</Text>
                <Text style={styles.flowText}>Publish bundle to the customer marketplace</Text>
              </View>
            </View>

            <View style={styles.formCard}>
              <View style={styles.formHeader}>
                <View>
                  <Text style={styles.formEyebrow}>Step 1</Text>
                  <Text style={styles.formTitle}>Choose Bundle Type</Text>
                </View>
                <Text style={styles.formEmoji}>{selectedTypeEmoji}</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.typeRow}
              >
                {BUNDLE_TYPES.map((type) => {
                  const active = bundleType === type.label;
                  return (
                    <TouchableOpacity
                      key={type.label}
                      style={[styles.typePill, active && styles.typePillActive]}
                      onPress={() => setBundleType(type.label)}
                    >
                      <Text style={styles.typeEmoji}>{type.emoji}</Text>
                      <Text style={[styles.typeText, active && styles.typeTextActive]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.formEyebrow}>Starter Templates</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.starterRow}
              >
                {STARTER_BUNDLES.map((bundle) => (
                  <TouchableOpacity
                    key={bundle.name}
                    style={styles.starterPill}
                    onPress={() => useStarter(bundle)}
                  >
                    <Text style={styles.starterText}>{bundle.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.formEyebrow}>Step 2</Text>
              <Text style={styles.formTitleSmall}>Bundle Details</Text>

              <Text style={styles.label}>Bundle Name</Text>
              <TextInput
                style={styles.input}
                value={bundleName}
                onChangeText={setBundleName}
                placeholder="Example: Fresh Produce Family Box"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.label}>Monthly Price</Text>
              <TextInput
                style={styles.input}
                value={monthlyPrice}
                onChangeText={setMonthlyPrice}
                placeholder="59.00"
                keyboardType="numeric"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.label}>Bi-Monthly Price</Text>
              <TextInput
                style={styles.input}
                value={bimonthlyPrice}
                onChangeText={setBimonthlyPrice}
                placeholder="109.00"
                keyboardType="numeric"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.label}>Customer Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Tell customers what makes this bundle fresh, local, or seasonal."
                multiline
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.label}>Included Items</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={itemsText}
                onChangeText={setItemsText}
                placeholder={"Leafy greens\nTomatoes\nGround beef\nShrimp"}
                multiline
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.formEyebrow}>Step 3</Text>
              <Text style={styles.formTitleSmall}>Customer Options</Text>

              <Toggle label="Local Delivery" value={deliveryEnabled} onValueChange={setDeliveryEnabled} />
              <Toggle label="Shipping" value={shippingEnabled} onValueChange={setShippingEnabled} />
              <Toggle label="Monthly Subscription" value={monthlyEnabled} onValueChange={setMonthlyEnabled} />
              <Toggle label="Bi-Monthly Subscription" value={bimonthlyEnabled} onValueChange={setBimonthlyEnabled} />

              <TouchableOpacity
                style={[styles.createButton, saving && styles.disabledButton]}
                onPress={createBundle}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="storefront-outline" size={19} color={COLORS.white} />
                    <Text style={styles.createText}>Add Bundle to Market</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Market Bundles</Text>

            {!bundles.length ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyEmoji}>🧺</Text>
                <Text style={styles.emptyTitle}>No bundles in your market yet</Text>
                <Text style={styles.emptyText}>
                  Create your first bundle above so customers can subscribe.
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bg,
  },
  loadingText: { marginTop: 10, color: COLORS.muted, fontWeight: "800" },
  content: { padding: 16, paddingBottom: 110 },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
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
  eyebrow: {
    color: COLORS.green,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontSize: 12,
  },
  title: {
    color: COLORS.text,
    fontSize: 27,
    fontWeight: "900",
    marginTop: 2,
  },
  subtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 4,
  },

  hero: {
    backgroundColor: COLORS.green,
    borderRadius: 28,
    padding: 20,
    marginBottom: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  heroBadge: {
    color: "#D9F99D",
    fontWeight: "900",
    textTransform: "uppercase",
    fontSize: 11,
  },
  heroTitle: {
    color: COLORS.white,
    fontSize: 25,
    fontWeight: "900",
    marginTop: 6,
  },
  heroText: {
    color: COLORS.white,
    opacity: 0.9,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 8,
  },
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

  flowCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 14,
  },
  flowTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 20,
    marginBottom: 10,
  },
  flowStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  flowNumber: {
    width: 28,
    height: 28,
    borderRadius: 12,
    backgroundColor: COLORS.greenSoft,
    color: COLORS.greenDark,
    textAlign: "center",
    textAlignVertical: "center",
    fontWeight: "900",
    overflow: "hidden",
  },
  flowText: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "800",
    lineHeight: 19,
  },

  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 18,
  },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  formEmoji: { fontSize: 38 },
  formEyebrow: {
    color: COLORS.green,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontSize: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  formTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 22,
    marginBottom: 12,
  },
  formTitleSmall: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 18,
    marginBottom: 4,
  },

  starterRow: { gap: 8, paddingBottom: 12 },
  starterPill: {
    backgroundColor: COLORS.orangeSoft,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  starterText: { color: "#92400E", fontWeight: "900" },

  typeRow: { gap: 8, paddingBottom: 6 },
  typePill: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  typePillActive: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  typeEmoji: { fontSize: 15 },
  typeText: { color: COLORS.text, fontWeight: "900" },
  typeTextActive: { color: COLORS.white },

  label: {
    color: COLORS.text,
    fontWeight: "900",
    marginBottom: 7,
    marginTop: 10,
  },
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
    justifyContent: "center",
    marginTop: 16,
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: { opacity: 0.7 },
  createText: { color: COLORS.white, fontWeight: "900", fontSize: 15 },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 12,
  },

  bundleCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
  },
  bundleHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  bundleEmoji: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: COLORS.orangeSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  bundleEmojiText: { fontSize: 25 },
  bundleName: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  bundleType: { color: COLORS.muted, fontWeight: "800", marginTop: 3 },
  bundlePrice: { color: COLORS.greenDark, fontSize: 16, fontWeight: "900" },
  bundlePriceSmall: { color: COLORS.muted, fontSize: 13, fontWeight: "900", marginTop: 3 },
  bundleDescription: {
    color: COLORS.text,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 10,
  },
  itemWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 12,
  },
  itemPill: {
    backgroundColor: COLORS.orangeSoft,
    color: "#92400E",
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 12,
  },
  optionPill: {
    backgroundColor: COLORS.greenSoft,
    color: COLORS.greenDark,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  bundleActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
  },
  availabilityButton: {
    flex: 1,
    backgroundColor: COLORS.green,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  unavailableButton: { backgroundColor: COLORS.red },
  availabilityText: { color: COLORS.white, fontWeight: "900" },
  removeButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: COLORS.redSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    marginBottom: 12,
  },
  emptyEmoji: { fontSize: 42 },
  emptyTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 18,
    marginTop: 8,
  },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
  },
});