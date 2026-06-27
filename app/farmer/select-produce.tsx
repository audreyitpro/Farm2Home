// app/farmer/select-produce.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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

import {
  FARM_PRODUCT_CATALOG,
  FARM_PRODUCT_CATEGORIES,
  FarmCatalogProduct,
} from "../data/farmProductCatalog";
import { supabase } from "../data/supabaseClient";

const COLORS = {
  bg: "#F6F8F2",
  card: "#FFFFFF",
  surface: "#F9FBF4",
  green: "#1FA463",
  greenDark: "#0B5D35",
  greenSoft: "#E9F8EF",
  lime: "#DDF8C8",
  orange: "#FFB74A",
  orangeSoft: "#FFF3DE",
  red: "#EF4444",
  text: "#162115",
  muted: "#667085",
  border: "#E3E8DD",
  white: "#FFFFFF",
};

type FarmerRecord = {
  id?: string;
  farmerId?: string;
  farmer_id?: string;
  auth_user_id?: string;
  profile_id?: string;
  role?: string;
  email?: string;
  farmName?: string;
  farm_name?: string;
  businessName?: string;
  business_name?: string;
  ownerName?: string;
  owner_name?: string;
  products?: any[];
  selectedProduce?: string[];
  selectedProducts?: string[];
  selectedProductCategories?: string[];
};

type FarmerProductRow = {
  id: string;
  catalogId: string;
  catalog_id: string;
  name: string;
  product_name: string;
  category: string;
  price: number;
  unit_price: number;
  unit: string;
  stock: number;
  quantity: number;
  inventory: number;
  inventory_count: number;
  lowStockThreshold: number;
  low_stock_threshold: number;
  image: string;
  imageUrl: string;
  image_url: string;
  tags: string[];
  farmName: string;
  farm_name: string;
  farmerId: string;
  farmer_id: string;
  farmerEmail: string;
  farmer_email: string;
  deliveryOption: string;
  delivery_option: string;
  sold: number;
  grossSales: number;
  gross_sales: number;
  active: boolean;
  available: boolean;
  marketplace_visible: boolean;
  removed_from_inventory: boolean;
  source: string;
  organic: boolean;
  local: boolean;
  seasonal: boolean;
  isSoldOut: boolean;
  is_sold_out: boolean;
  status: string;
  createdAt: string;
  created_at: string;
  updatedAt: string;
  updated_at: string;
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function firstParam(value: any) {
  if (Array.isArray(value)) return value[0] || "";
  return value ? String(value) : "";
}

function getFarmerProductsKey(farmerId: string) {
  return `farmer_products_${farmerId}`;
}

function getFarmerId(farmer?: FarmerRecord | null) {
  return clean(
    farmer?.id ||
      farmer?.farmerId ||
      farmer?.farmer_id ||
      farmer?.profile_id ||
      farmer?.auth_user_id
  );
}

function getFarmName(farmer?: FarmerRecord | null) {
  return (
    clean(farmer?.farmName || farmer?.farm_name) ||
    clean(farmer?.businessName || farmer?.business_name) ||
    clean(farmer?.ownerName || farmer?.owner_name) ||
    "Local Farm"
  );
}

function cleanProducts(items: any[]) {
  return (items || [])
    .filter((item: any) => {
      const name = normalize(item?.name || item?.product_name);
      return name && name !== "farm product" && name !== "undefined" && name !== "null";
    })
    .map((item: any) => ({
      ...item,
      id: clean(item.id || item.catalog_id || item.catalogId || `${normalize(item.name)}_${Date.now()}`),
      name: clean(item.name || item.product_name || "Farm Product"),
      product_name: clean(item.product_name || item.name || "Farm Product"),
      farmer_id: clean(item.farmer_id || item.farmerId),
      farmerId: clean(item.farmerId || item.farmer_id),
    }));
}

function makeFarmerProduct(item: FarmCatalogProduct, farmer: FarmerRecord): FarmerProductRow {
  const now = new Date().toISOString();
  const farmerId = getFarmerId(farmer);
  const farmName = getFarmName(farmer);
  const farmerEmail = normalize(farmer.email);
  const deliveryOption = "Pickup and Delivery";

  return {
    id: `${farmerId}_${item.id}`,
    catalogId: item.id,
    catalog_id: item.id,
    name: item.name,
    product_name: item.name,
    category: item.category,
    price: Number(item.defaultPrice || 0),
    unit_price: Number(item.defaultPrice || 0),
    unit: item.unit,
    stock: Number(item.defaultStock || 0),
    quantity: Number(item.defaultStock || 0),
    inventory: Number(item.defaultStock || 0),
    inventory_count: Number(item.defaultStock || 0),
    lowStockThreshold: 5,
    low_stock_threshold: 5,
    image: item.imageUrl,
    imageUrl: item.imageUrl,
    image_url: item.imageUrl,
    tags: item.tags || [],
    farmName,
    farm_name: farmName,
    farmerId,
    farmer_id: farmerId,
    farmerEmail,
    farmer_email: farmerEmail,
    deliveryOption,
    delivery_option: deliveryOption,
    sold: 0,
    grossSales: 0,
    gross_sales: 0,
    active: true,
    available: true,
    marketplace_visible: true,
    removed_from_inventory: false,
    source: "farm_catalog",
    organic: item.tags?.includes("organic") || false,
    local: true,
    seasonal: item.tags?.includes("seasonal") || false,
    isSoldOut: false,
    is_sold_out: false,
    status: "active",
    createdAt: now,
    created_at: now,
    updatedAt: now,
    updated_at: now,
  };
}

function missingColumn(error: any) {
  return (
    String(error?.message || "").match(/Could not find the '([^']+)' column/i)?.[1] ||
    String(error?.message || "").match(/column ['\"]?([^'\"]+)['\"]? does not exist/i)?.[1] ||
    ""
  );
}

async function safeUpdate(table: string, idColumn: string, idValue: string, payload: Record<string, any>) {
  let nextPayload = { ...payload };

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const { data, error } = await supabase
      .from(table)
      .update(nextPayload)
      .eq(idColumn, idValue)
      .select("*")
      .maybeSingle();

    if (!error) return data;

    const missing = missingColumn(error);
    if (missing && Object.prototype.hasOwnProperty.call(nextPayload, missing)) {
      delete nextPayload[missing];
      continue;
    }

    console.log(`${table} update skipped:`, error.message);
    return null;
  }

  return null;
}

async function safeInsertMany(table: string, rows: Record<string, any>[]) {
  if (!rows.length) return false;

  let nextRows = rows.map((row) => ({ ...row }));

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const { error } = await supabase.from(table).upsert(nextRows, { onConflict: "id" });

    if (!error) return true;

    const missing = missingColumn(error);
    if (missing) {
      nextRows = nextRows.map((row) => {
        const copy = { ...row };
        delete copy[missing];
        return copy;
      });
      continue;
    }

    console.log(`${table} insert skipped:`, error.message);
    return false;
  }

  return false;
}

export default function SelectProduceScreen() {
  const params = useLocalSearchParams();
  const farmerIdParam = firstParam(params.farmerId || params.id);

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedProducts, setSelectedProducts] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [currentFarmer, setCurrentFarmer] = useState<FarmerRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadCurrentFarmer();
    }, [farmerIdParam])
  );

  async function readLocalFarmer() {
    const saved =
      (await AsyncStorage.getItem("currentFarmer")) ||
      (await AsyncStorage.getItem("farm2homeCurrentFarmer")) ||
      (await AsyncStorage.getItem("farm2homeFarmerSession")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!saved) return null;

    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }

  async function findFarmerByColumn(column: string, value: string) {
    if (!value) return null;

    try {
      const { data, error } = await supabase
        .from("farmers")
        .select("*")
        .eq(column, value)
        .maybeSingle();

      if (!error && data) return data;

      if (error) console.log(`farmers lookup ${column} skipped:`, error.message);
    } catch (error: any) {
      console.log(`farmers lookup ${column} exception skipped:`, error?.message || error);
    }

    return null;
  }

  async function findLatestFarmer(localFarmer: FarmerRecord | null) {
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;

    const ids = Array.from(
      new Set(
        [
          farmerIdParam,
          localFarmer?.id,
          localFarmer?.farmerId,
          localFarmer?.farmer_id,
          localFarmer?.profile_id,
          localFarmer?.auth_user_id,
          authUser?.id,
        ]
          .map(clean)
          .filter(Boolean)
      )
    );

    const email = normalize(localFarmer?.email || authUser?.email);

    for (const id of ids) {
      const byId = await findFarmerByColumn("id", id);
      if (byId) return byId;

      const byFarmerId = await findFarmerByColumn("farmer_id", id);
      if (byFarmerId) return byFarmerId;

      const byProfileId = await findFarmerByColumn("profile_id", id);
      if (byProfileId) return byProfileId;

      const byAuthUserId = await findFarmerByColumn("auth_user_id", id);
      if (byAuthUserId) return byAuthUserId;
    }

    if (email) {
      const byEmail = await findFarmerByColumn("email", email);
      if (byEmail) return byEmail;
    }

    return null;
  }

  async function loadCurrentFarmer() {
    try {
      setLoading(true);

      const localFarmer = await readLocalFarmer();

      if (!localFarmer && !farmerIdParam) {
        router.replace("/farmer/login" as any);
        return;
      }

      const latestFromDb = await findLatestFarmer(localFarmer);

      let latestFarmer: FarmerRecord = {
        ...(localFarmer || {}),
        ...(latestFromDb || {}),
        id: clean(latestFromDb?.id || localFarmer?.id || localFarmer?.farmerId || farmerIdParam),
        farmerId: clean(latestFromDb?.id || localFarmer?.id || localFarmer?.farmerId || farmerIdParam),
        role: "farmer",
        email: normalize(latestFromDb?.email || localFarmer?.email),
      };

      const farmerId = getFarmerId(latestFarmer);

      if (!farmerId) {
        Alert.alert("Session Error", "Farmer ID missing. Please login again.");
        router.replace("/farmer/login" as any);
        return;
      }

      const localInventory = await AsyncStorage.getItem(getFarmerProductsKey(farmerId));

      if (localInventory) {
        latestFarmer.products = cleanProducts(JSON.parse(localInventory));
      } else {
        latestFarmer.products = cleanProducts(latestFromDb?.products || localFarmer?.products || []);
      }

      await AsyncStorage.multiSet([
        ["currentFarmer", JSON.stringify(latestFarmer)],
        ["farm2homeCurrentFarmer", JSON.stringify(latestFarmer)],
        ["farm2homeFarmerSession", JSON.stringify(latestFarmer)],
        ["currentUser", JSON.stringify(latestFarmer)],
        ["userRole", "farmer"],
        ["currentUserRole", "farmer"],
      ]);

      setCurrentFarmer(latestFarmer);
    } catch (error: any) {
      console.log("LOAD_CURRENT_FARMER_ERROR:", error);
      Alert.alert("Load Error", error?.message || "Unable to load farmer profile.");
    } finally {
      setLoading(false);
    }
  }

  const categories = ["All", ...FARM_PRODUCT_CATEGORIES];

  const filteredProducts = useMemo(() => {
    const q = normalize(search);

    return FARM_PRODUCT_CATALOG.filter((item) => {
      const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;

      const matchesSearch =
        !q ||
        normalize(item.name).includes(q) ||
        normalize(item.category).includes(q) ||
        item.tags.some((tag) => normalize(tag).includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, search]);

  function toggleProduct(productId: string) {
    setSelectedProducts((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  }

  async function saveProductsToFarmerRow(farmerId: string, updatedFarmer: FarmerRecord, updatedProducts: any[]) {
    /**
     * IMPORTANT:
     * Do NOT save products / selected_products / selected_product_categories
     * to the farmers table unless those columns are guaranteed to exist.
     *
     * The dashboard reads inventory from farm_products / farmer_products / products.
     * This function only marks the farmer store as active using safe common columns.
     * This prevents Supabase 400 errors like:
     * PATCH /rest/v1/farmers?id=eq... 400 Bad Request
     */
    const payload = {
      store_unlocked: true,
      account_active: true,
      updated_at: new Date().toISOString(),
    };

    const byId = await safeUpdate("farmers", "id", farmerId, payload);
    if (byId) return true;

    const byFarmerId = await safeUpdate("farmers", "farmer_id", farmerId, payload);
    if (byFarmerId) return true;

    const profileId = clean(updatedFarmer.profile_id);
    if (profileId) {
      const byProfileId = await safeUpdate("farmers", "profile_id", profileId, payload);
      if (byProfileId) return true;
    }

    // Local inventory and inventory table inserts are still saved even if this update is skipped.
    return false;
  }

  async function saveProductsToInventoryTables(newProducts: FarmerProductRow[]) {
    const tables = ["farm_products", "farmer_products", "products"];
    let savedAny = false;

    for (const table of tables) {
      const ok = await safeInsertMany(table, newProducts);
      if (ok) savedAny = true;
    }

    return savedAny;
  }

  async function saveSelectedProducts() {
    try {
      setSaving(true);

      const selected = FARM_PRODUCT_CATALOG.filter((item) => selectedProducts[item.id]);

      if (selected.length === 0) {
        Alert.alert("No Products Selected", "Select at least one farm product.");
        return;
      }

      const localFarmer = await readLocalFarmer();

      if (!localFarmer && !currentFarmer) {
        Alert.alert("Session Error", "Please login again.");
        router.replace("/farmer/login" as any);
        return;
      }

      const farmer = currentFarmer || localFarmer;
      const farmerId = getFarmerId(farmer);

      if (!farmerId) {
        Alert.alert("Session Error", "Farmer ID missing. Please login again.");
        router.replace("/farmer/login" as any);
        return;
      }

      let latestProducts = cleanProducts(farmer?.products || []);

      const localInventory = await AsyncStorage.getItem(getFarmerProductsKey(farmerId));
      if (localInventory) {
        latestProducts = cleanProducts(JSON.parse(localInventory));
      }

      const existingKeys = new Set(
        latestProducts.flatMap((item: any) => [
          normalize(item.id),
          normalize(item.catalogId || item.catalog_id),
          normalize(item.name || item.product_name),
        ])
      );

      const newProducts = selected
        .filter((item) => {
          const productRowId = `${farmerId}_${item.id}`;
          return (
            !existingKeys.has(normalize(productRowId)) &&
            !existingKeys.has(normalize(item.id)) &&
            !existingKeys.has(normalize(item.name))
          );
        })
        .map((item) => makeFarmerProduct(item, farmer as FarmerRecord));

      if (newProducts.length === 0) {
        Alert.alert("Already Added", "Those products are already on your dashboard.", [
          { text: "Go to Dashboard", onPress: () => router.replace("/farmer/dashboard" as any) },
        ]);
        return;
      }

      const updatedProducts = cleanProducts([...latestProducts, ...newProducts]);

      await AsyncStorage.setItem(getFarmerProductsKey(farmerId), JSON.stringify(updatedProducts));

      const updatedFarmer: FarmerRecord = {
        ...(farmer || {}),
        id: farmerId,
        farmerId,
        role: "farmer",
        products: updatedProducts,
        selectedProduce: updatedProducts.map((item: any) => item.name),
        selectedProducts: updatedProducts.map((item: any) => item.name),
        selectedProductCategories: Array.from(
          new Set(updatedProducts.map((item: any) => item.category).filter(Boolean))
        ),
      };

      await AsyncStorage.multiSet([
        ["currentFarmer", JSON.stringify(updatedFarmer)],
        ["farm2homeCurrentFarmer", JSON.stringify(updatedFarmer)],
        ["farm2homeFarmerSession", JSON.stringify(updatedFarmer)],
        ["currentUser", JSON.stringify(updatedFarmer)],
        ["userRole", "farmer"],
        ["currentUserRole", "farmer"],
      ]);

      await saveProductsToFarmerRow(farmerId, updatedFarmer, updatedProducts);
      await saveProductsToInventoryTables(newProducts);

      Alert.alert(
        "Products Added",
        `${newProducts.length} product(s) added to your farm inventory.`,
        [{ text: "Go to Dashboard", onPress: () => router.replace("/farmer/dashboard" as any) }]
      );
    } catch (error: any) {
      console.log("SAVE_SELECTED_PRODUCTS_ERROR:", error);
      Alert.alert("Save Error", error?.message || "Unable to save selected farm products.");
    } finally {
      setSaving(false);
    }
  }

  function renderProduct({ item }: { item: FarmCatalogProduct }) {
    const selected = Boolean(selectedProducts[item.id]);

    return (
      <Pressable
        style={[styles.productCard, selected && styles.productCardSelected]}
        onPress={() => toggleProduct(item.id)}
      >
        <Image source={{ uri: item.imageUrl }} style={styles.productImage} />

        <View style={styles.productBody}>
          <View style={styles.productTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.productName}>{item.name}</Text>
              <Text style={styles.productCategory}>{item.category}</Text>
            </View>

            <View style={[styles.checkCircle, selected && styles.checkCircleOn]}>
              {selected ? <Ionicons name="checkmark-outline" size={20} color={COLORS.white} /> : null}
            </View>
          </View>

          <View style={styles.tagRow}>
            <Text style={styles.unitTag}>{item.unit}</Text>
            {item.tags.slice(0, 3).map((tag) => (
              <Text key={`${item.id}-${tag}`} style={styles.tag}>
                {tag}
              </Text>
            ))}
          </View>

          <Text style={styles.price}>
            Starts at ${item.defaultPrice.toFixed(2)} / {item.unit}
          </Text>

          <Text style={styles.stock}>
            Default stock: {item.defaultStock} {item.unit}
          </Text>
        </View>
      </Pressable>
    );
  }

  const selectedCount = Object.values(selectedProducts).filter(Boolean).length;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.page}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.9}>
              <Ionicons name="arrow-back-outline" size={21} color={COLORS.text} />
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Grocerly Products</Text>
              <Text style={styles.title}>Select Farm Products</Text>
              <Text style={styles.subtitle}>
                Add grocery-style produce to your farmer dashboard inventory.
              </Text>
            </View>
          </View>

          <View style={styles.searchCard}>
            <Ionicons name="search-outline" size={19} color={COLORS.muted} />
            <TextInput
              style={styles.search}
              placeholder="Search produce, category, tags..."
              value={search}
              onChangeText={setSearch}
              placeholderTextColor="#94A3B8"
            />
            {loading ? <ActivityIndicator color={COLORS.green} /> : null}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            {categories.map((category) => {
              const active = selectedCategory === category;
              return (
                <Pressable
                  key={category}
                  style={[styles.categoryButton, active && styles.categoryActive]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text style={[styles.categoryText, active && styles.categoryTextActive]}>
                    {category}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item.id}
            renderItem={renderProduct}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>🥬</Text>
                <Text style={styles.emptyTitle}>No matching produce</Text>
                <Text style={styles.emptyText}>Try another search or category.</Text>
              </View>
            }
          />

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.disabledButton]}
              onPress={saveSelectedProducts}
              disabled={saving}
              activeOpacity={0.9}
            >
              {saving ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="basket-outline" size={18} color={COLORS.white} />
                  <Text style={styles.saveText}>Add Selected Products ({selectedCount})</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.customButton}
              onPress={() =>
                router.push({
                  pathname: "/farmer/add-product",
                  params: farmerIdParam ? { farmerId: farmerIdParam } : {},
                } as any)
              }
              activeOpacity={0.9}
            >
              <Ionicons name="add-circle-outline" size={18} color={COLORS.greenDark} />
              <Text style={styles.customText}>Product Not Listed? Upload Your Own</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  page: { flex: 1, backgroundColor: COLORS.bg },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 17,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: { color: COLORS.green, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase", fontSize: 12 },
  title: { color: COLORS.text, fontSize: 27, fontWeight: "900", marginTop: 2 },
  subtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 4 },
  searchCard: {
    marginHorizontal: 16,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 13,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  search: {
    flex: 1,
    minHeight: 54,
    fontWeight: "800",
    color: COLORS.text,
  },
  categoryRow: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  categoryButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  categoryActive: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  categoryText: { color: COLORS.text, fontWeight: "900", fontSize: 12 },
  categoryTextActive: { color: COLORS.white },
  list: { padding: 16, paddingBottom: 178 },
  productCard: {
    backgroundColor: COLORS.card,
    borderRadius: 26,
    marginBottom: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  productCardSelected: { borderColor: COLORS.green, borderWidth: 3 },
  productImage: { width: "100%", height: 172, backgroundColor: COLORS.greenSoft },
  productBody: { padding: 15 },
  productTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  productName: { color: COLORS.text, fontSize: 21, fontWeight: "900" },
  productCategory: { color: COLORS.muted, fontWeight: "800", marginTop: 3 },
  checkCircle: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: COLORS.green,
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircleOn: { backgroundColor: COLORS.green },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
  unitTag: {
    backgroundColor: COLORS.greenDark,
    color: COLORS.white,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 12,
  },
  tag: {
    backgroundColor: COLORS.greenSoft,
    color: COLORS.greenDark,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 12,
  },
  price: { color: COLORS.text, fontWeight: "900", marginTop: 12 },
  stock: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  emptyBox: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 28,
    alignItems: "center",
  },
  emptyEmoji: { fontSize: 42 },
  emptyTitle: { color: COLORS.text, fontWeight: "900", fontSize: 18, marginTop: 6 },
  emptyText: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.white,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  saveButton: {
    backgroundColor: COLORS.green,
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: { opacity: 0.65 },
  saveText: { color: COLORS.white, fontWeight: "900", fontSize: 15 },
  customButton: {
    backgroundColor: COLORS.greenSoft,
    borderWidth: 1,
    borderColor: "#BDECCF",
    borderRadius: 18,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    flexDirection: "row",
    gap: 7,
  },
  customText: { color: COLORS.greenDark, fontWeight: "900", textAlign: "center" },
});
