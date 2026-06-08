// app/customer/farmer-shop.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";

import { addToCart, getCartItemCount } from "../data/cartStore";
import { getApprovedFarmers } from "../data/farmerStore";
import { supabase } from "../data/supabaseClient";

const COLORS = {
  primary: "#2E7D32",
  primaryDark: "#14532D",
  bg: "#F6F8F2",
  card: "#FFFFFF",
  text: "#172017",
  muted: "#6B7280",
  border: "#E3E8DD",
  soft: "#EEF5EA",
  dark: "#111827",
};

type Product = {
  id: string;
  name: string;
  category?: string;
  price?: number;
  unit?: string;
  image?: string;
  imageUrl?: string;
  image_url?: string;
  description?: string;
  farmerId?: string;
  farmer_id?: string;
  farmName?: string;
  farm_name?: string;
  stock?: number;
  quantity?: number;
  inventory?: number;
  available?: boolean;
  active?: boolean;
  marketplace_visible?: boolean;
  removed_from_inventory?: boolean;
  farmerStripeAccountId?: string;
  farmer_stripe_account_id?: string;
  stripeAccountId?: string;
  stripe_account_id?: string;
};

type Farmer = {
  id: string;
  farmerId?: string;
  farmName?: string;
  name?: string;
  businessName?: string;
  business_name?: string;
  farm_name?: string;
  location?: string;
  farmLocation?: string;
  farm_location?: string;
  city?: string;
  state?: string;
  about?: string;
  logoUrl?: string;
  farmLogoUrl?: string;
  logo_url?: string;
  farm_logo_url?: string;
  rating?: number;
  distanceMiles?: number;
  distance_miles?: number;
  stripeAccountId?: string;
  farmerStripeAccountId?: string;
  stripe_account_id?: string;
  farmer_stripe_account_id?: string;
  products?: Product[];
};

function firstParam(value: any) {
  if (Array.isArray(value)) return value[0] || "";
  return value ? String(value) : "";
}

function normalizeId(value: any) {
  return String(value || "").trim();
}

function getFarmerProductsKey(farmerId: string) {
  return `farmer_products_${farmerId}`;
}

function getFarmerInventoryKey(farmerId: string) {
  return `farmer_inventory_${farmerId}`;
}

function getFarmerName(farmer: Farmer) {
  return (
    farmer.farmName ||
    farmer.farm_name ||
    farmer.name ||
    farmer.businessName ||
    farmer.business_name ||
    "Farm2Home Farm"
  );
}

function getFarmerLocation(farmer: Farmer) {
  if (farmer.location) return farmer.location;
  if (farmer.farmLocation) return farmer.farmLocation;
  if (farmer.farm_location) return farmer.farm_location;
  if (farmer.city && farmer.state) return `${farmer.city}, ${farmer.state}`;
  if (farmer.state) return farmer.state;
  return "Local farm";
}

function getFarmerLogo(farmer: Farmer) {
  return (
    farmer.logoUrl ||
    farmer.farmLogoUrl ||
    farmer.logo_url ||
    farmer.farm_logo_url ||
    ""
  );
}

function getProductImage(product: Product) {
  return product.image || product.imageUrl || product.image_url || "";
}

function getProductStock(product: Product) {
  const stock = Number(product.stock ?? product.quantity ?? product.inventory ?? 0);
  return Number.isFinite(stock) ? stock : 0;
}

function normalizeCategory(category?: string) {
  const value = String(category || "").trim();
  if (!value) return "Farm Goods";
  if (value === "Fish Farm / Aquaculture") return "Fish & Aquaculture";
  if (value === "Bale of Hay" || value === "Hay") return "Hay & Feed";
  if (value === "Plants & Herbs") return "Plants & Nursery";
  if (value === "Seasonal") return "Seasonal Products";
  return value;
}

function isProductAvailable(product: Product) {
  if (!product?.name) return false;
  if (product.available === false) return false;
  if (product.active === false) return false;
  if (product.marketplace_visible === false) return false;
  if (product.removed_from_inventory === true) return false;
  return getProductStock(product) > 0;
}

function getFarmerStripeAccountId(farmer: Farmer, product?: Product) {
  return (
    product?.farmerStripeAccountId ||
    product?.farmer_stripe_account_id ||
    product?.stripeAccountId ||
    product?.stripe_account_id ||
    farmer.farmerStripeAccountId ||
    farmer.farmer_stripe_account_id ||
    farmer.stripeAccountId ||
    farmer.stripe_account_id ||
    ""
  );
}

function normalizeProduct(product: any, farmer: Farmer): Product {
  const farmerId = normalizeId(
    product.farmerId || product.farmer_id || farmer.id || farmer.farmerId
  );

  const image = product.image_url || product.imageUrl || product.image || "";

  return {
    ...product,
    id: String(product.id || `${farmerId}_${product.name || "product"}`),
    name: String(product.name || product.product_name || "Farm Product"),
    description: product.description || "",
    category: normalizeCategory(product.category || product.product_category),
    price: Number(product.price || product.unit_price || product.amount || 0),
    unit: product.unit || product.sell_by || "each",
    image,
    imageUrl: image,
    image_url: image,
    farmerId,
    farmer_id: farmerId,
    farmName: product.farmName || product.farm_name || getFarmerName(farmer),
    farm_name: product.farmName || product.farm_name || getFarmerName(farmer),
    stock: getProductStock(product),
    quantity: getProductStock(product),
    inventory: getProductStock(product),
    available: product.available !== false,
    active: product.active !== false,
    marketplace_visible: product.marketplace_visible !== false,
    removed_from_inventory: product.removed_from_inventory === true,
    farmerStripeAccountId:
      product.farmer_stripe_account_id || product.stripe_account_id || "",
    farmer_stripe_account_id:
      product.farmer_stripe_account_id || product.stripe_account_id || "",
  };
}

function normalizeFarmer(farmer: Farmer, products: Product[] = []) {
  const farmName = getFarmerName(farmer);
  const stripeAccountId = getFarmerStripeAccountId(farmer);

  return {
    ...farmer,
    id: String(farmer.id || farmer.farmerId || ""),
    farmName,
    name: farmName,
    location: getFarmerLocation(farmer),
    logoUrl: getFarmerLogo(farmer),
    stripeAccountId,
    farmerStripeAccountId: stripeAccountId,
    products: products
      .map((product) => normalizeProduct(product, farmer))
      .filter(isProductAvailable),
  };
}

function mapFarmerRow(row: any, fallbackId: string): Farmer {
  const farmName =
    row?.farm_name ||
    row?.business_name ||
    row?.farmName ||
    row?.businessName ||
    row?.name ||
    "Local Farm";

  const logo =
    row?.logo_url ||
    row?.farm_logo_url ||
    row?.logoUrl ||
    row?.farmLogoUrl ||
    "";

  return {
    id: String(row?.id || row?.farmer_id || fallbackId),
    farmerId: String(row?.id || row?.farmer_id || fallbackId),
    farmName,
    name: farmName,
    businessName: row?.business_name || farmName,
    business_name: row?.business_name || farmName,
    location:
      row?.city && row?.state
        ? `${row.city}, ${row.state}`
        : row?.farm_location || row?.location || row?.state || "Local farm",
    about: row?.about || row?.description || "",
    logoUrl: logo,
    farmLogoUrl: logo,
    rating: Number(row?.rating || 4.8),
    distanceMiles: Number(row?.distance_miles || row?.distanceMiles || 5),
    stripeAccountId: row?.stripe_account_id || row?.farmer_stripe_account_id || "",
    farmerStripeAccountId: row?.farmer_stripe_account_id || row?.stripe_account_id || "",
    products: Array.isArray(row?.products) ? row.products : [],
  };
}

function mapProductRow(row: any): Product {
  const image = row.image_url || row.image || row.imageUrl || "";

  return {
    id: String(row.id || `product_${Date.now()}_${Math.random()}`),
    name: String(row.name || row.product_name || "Farm Product"),
    description: row.description || "",
    category: normalizeCategory(row.category || row.product_category),
    price: Number(row.price || row.unit_price || row.amount || 0),
    unit: row.unit || row.sell_by || "each",
    image,
    imageUrl: image,
    image_url: image,
    farmerId: String(row.farmer_id || row.farmerId || ""),
    farmer_id: String(row.farmer_id || row.farmerId || ""),
    farmName: row.farm_name || row.farmName || "",
    farm_name: row.farm_name || row.farmName || "",
    stock: Number(row.stock ?? row.quantity ?? row.inventory ?? 0),
    quantity: Number(row.quantity ?? row.stock ?? row.inventory ?? 0),
    inventory: Number(row.inventory ?? row.stock ?? row.quantity ?? 0),
    available: row.available !== false,
    active: row.active !== false,
    marketplace_visible: row.marketplace_visible !== false,
    removed_from_inventory: row.removed_from_inventory === true,
    farmerStripeAccountId: row.farmer_stripe_account_id || row.stripe_account_id || "",
    farmer_stripe_account_id: row.farmer_stripe_account_id || row.stripe_account_id || "",
  };
}

export default function FarmerShopScreen() {
  const params = useLocalSearchParams();

  const farmerId = firstParam(params.farmerId || params.id || params.farmer_id);
  const farmerNameParam = firstParam(params.farmName || params.name);

  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFarmer();
    refreshCartCount();
  }, [farmerId]);

  async function refreshCartCount() {
    try {
      setCartCount(await getCartItemCount());
    } catch {
      setCartCount(0);
    }
  }

  async function loadFarmer() {
    try {
      setLoading(true);

      if (!farmerId) {
        setFarmer(null);
        return;
      }

      const found = await loadFarmerAllSources(farmerId);
      setFarmer(found);
    } catch (error) {
      console.log("Load farmer shop error:", error);
      setFarmer(null);
    } finally {
      setLoading(false);
    }
  }

  async function readLocalProducts(activeFarmerId: string) {
    const keys = [
      getFarmerProductsKey(activeFarmerId),
      getFarmerInventoryKey(activeFarmerId),
      "farmer_products",
      "farm_products",
      "farm_inventory",
      "selected_produce",
      "selectedProduce",
    ];

    const all: Product[] = [];

    for (const key of keys) {
      const raw = await AsyncStorage.getItem(key);

      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed) ? parsed : parsed?.products || parsed?.inventory || [];

        if (Array.isArray(list)) {
          all.push(
            ...list.filter((item: any) => {
              const itemFarmerId = normalizeId(item.farmer_id || item.farmerId || activeFarmerId);
              return itemFarmerId === activeFarmerId || !item.farmer_id;
            })
          );
        }
      } catch {
        continue;
      }
    }

    return all;
  }

  async function queryProductTable(tableName: string, activeFarmerId: string) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("farmer_id", activeFarmerId)
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) return data.map(mapProductRow);
    } catch {
      return [];
    }

    return [];
  }

  async function loadFarmerAllSources(activeFarmerId: string) {
    let farmerBase: Farmer | null = null;
    let products: Product[] = [];

    products.push(...(await readLocalProducts(activeFarmerId)));

    const { data: farmerRow } = await supabase
      .from("farmers")
      .select("*")
      .eq("id", activeFarmerId)
      .maybeSingle();

    if (farmerRow) {
      farmerBase = mapFarmerRow(farmerRow, activeFarmerId);

      if (products.length === 0 && Array.isArray(farmerRow.products)) {
        products = farmerRow.products;
      }
    }

    const productTables = [
      "products",
      "farmer_products",
      "farm_products",
      "farm_inventory",
      "inventory",
    ];

    for (const tableName of productTables) {
      const rows = await queryProductTable(tableName, activeFarmerId);
      if (rows.length > 0) products.push(...rows);
    }

    const localFarmer = await loadFarmerFromLocal(activeFarmerId);

    if (!farmerBase && localFarmer) {
      farmerBase = localFarmer;
    }

    if (products.length === 0 && localFarmer?.products?.length) {
      products = localFarmer.products;
    }

    const uniqueProducts = Array.from(
      new Map(
        products
          .filter(Boolean)
          .map((item: any) => {
            const key = String(item.id || item.name || Math.random());
            return [key, item];
          })
      ).values()
    ) as Product[];

    if (!farmerBase && uniqueProducts.length === 0) return null;

    return normalizeFarmer(
      farmerBase || {
        id: activeFarmerId,
        farmName: farmerNameParam || "Local Farm",
      },
      uniqueProducts
    );
  }

  async function loadFarmerFromLocal(activeFarmerId: string) {
    const approvedFarmers = (await getApprovedFarmers()) || [];

    const currentRaw =
      (await AsyncStorage.getItem("currentFarmer")) ||
      (await AsyncStorage.getItem("currentUser"));

    const currentFarmer = currentRaw ? JSON.parse(currentRaw) : null;

    const localFarmers = [
      ...(Array.isArray(approvedFarmers) ? approvedFarmers : []),
      ...(currentFarmer?.id || currentFarmer?.farmerId ? [currentFarmer] : []),
    ];

    const selected = localFarmers.find(
      (item: any) =>
        String(item?.id || "") === String(activeFarmerId) ||
        String(item?.farmerId || "") === String(activeFarmerId)
    );

    if (!selected) return null;

    return normalizeFarmer(
      {
        ...selected,
        id: selected.id || selected.farmerId,
        farmName:
          selected.farmName ||
          selected.businessName ||
          selected.business_name ||
          selected.farm_name ||
          "Farm2Home Farm",
      },
      selected.products || []
    );
  }

  const groupedProducts = useMemo(() => {
    if (!farmer?.products) return {};

    return farmer.products.reduce((acc: Record<string, Product[]>, product) => {
      const category = normalizeCategory(product.category);
      if (!acc[category]) acc[category] = [];
      acc[category].push(product);
      return acc;
    }, {});
  }, [farmer]);

  const categories = Object.keys(groupedProducts);
  const productCount = farmer?.products?.length || 0;

  async function handleAddToCart(product: Product) {
    try {
      if (!farmer) return;

      await addToCart({
        id: `${farmer.id}_${product.id}`,
        productId: product.id,
        name: product.name,
        quantity: 1,
        price: Number(product.price || 0),
        image: getProductImage(product),
        farmName: getFarmerName(farmer),
        farmerId: farmer.id,
        farmerStripeAccountId: getFarmerStripeAccountId(farmer, product),
        unit: product.unit || "each",
      } as any);

      await refreshCartCount();
      Alert.alert("Added to Cart", `${product.name} was added to your cart.`);
    } catch (error) {
      console.log("Farmer shop add to cart error:", error);
      Alert.alert("Error", "Unable to add item to cart.");
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.centerText}>Loading storefront...</Text>
      </View>
    );
  }

  if (!farmer) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerTitle}>Farmer shop not found</Text>
        <Text style={styles.centerSub}>This store may no longer be available.</Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.replace("/customer/marketplace" as any)}
        >
          <Text style={styles.primaryButtonText}>Back to Marketplace</Text>
        </Pressable>
      </View>
    );
  }

  const farmName = getFarmerName(farmer);
  const farmLocation = getFarmerLocation(farmer);
  const logo = getFarmerLogo(farmer);

  return (
    <View style={styles.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.topBar}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.push("/customer/marketplace" as any)}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <View style={styles.topTitleBlock}>
            <Text style={styles.title}>{farmName}</Text>
            <Text style={styles.subtitle}>{farmLocation}</Text>
          </View>

          <Pressable
            style={styles.cartButton}
            onPress={() => router.push("/customer/cart" as any)}
          >
            <Text style={styles.cartText}>Cart {cartCount}</Text>
          </Pressable>
        </View>

        <View style={styles.storeHeader}>
          {logo ? (
            <Image source={{ uri: logo }} style={styles.logo} />
          ) : (
            <View style={styles.logoFallback}>
              <Text style={styles.logoFallbackText}>{farmName.slice(0, 1)}</Text>
            </View>
          )}

          <View style={styles.storeInfo}>
            <Text style={styles.storeName}>{farmName}</Text>
            <Text style={styles.storeMeta}>
              {Number(farmer.rating || 4.8).toFixed(1)} rating ·{" "}
              {Number(farmer.distanceMiles || farmer.distance_miles || 5).toFixed(1)} mi ·{" "}
              {productCount} items
            </Text>
            <Text style={styles.storeAbout} numberOfLines={2}>
              {farmer.about || "Fresh local goods from this Farm2Home seller."}
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Available Products</Text>
          <Text style={styles.sectionSub}>Shop fresh items directly from this seller.</Text>
        </View>

        {productCount === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No active products</Text>
            <Text style={styles.emptyText}>
              This seller does not have marketplace products available right now.
            </Text>
          </View>
        ) : (
          categories.map((category) => (
            <View key={category} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryTitle}>{category}</Text>
                <Text style={styles.categoryCount}>
                  {groupedProducts[category].length} item
                  {groupedProducts[category].length === 1 ? "" : "s"}
                </Text>
              </View>

              {groupedProducts[category].map((product) => {
                const imageSource = getProductImage(product);
                const stock = getProductStock(product);

                return (
                  <View key={product.id} style={styles.productRow}>
                    {imageSource ? (
                      <Image source={{ uri: imageSource }} style={styles.productImage} />
                    ) : (
                      <View style={styles.productImageFallback}>
                        <Text style={styles.productImageFallbackText}>
                          {product.name.slice(0, 1)}
                        </Text>
                      </View>
                    )}

                    <View style={styles.productInfo}>
                      <Text style={styles.productName} numberOfLines={1}>
                        {product.name}
                      </Text>

                      <Text style={styles.productDetails} numberOfLines={1}>
                        ${Number(product.price || 0).toFixed(2)} / {product.unit || "each"} ·{" "}
                        {stock} in stock
                      </Text>

                      <Text style={styles.productDescription} numberOfLines={2}>
                        {product.description || "Fresh local farm product."}
                      </Text>
                    </View>

                    <Pressable
                      style={styles.addButton}
                      onPress={() => handleAddToCart(product)}
                    >
                      <Text style={styles.addButtonText}>Add</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={styles.footerButton}
          onPress={() => router.push("/customer/cart" as any)}
        >
          <Text style={styles.footerButtonText}>View Cart ({cartCount})</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.bg },
  scrollContent: { padding: 16, paddingBottom: 96 },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  centerText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.primary,
  },
  centerTitle: { fontSize: 22, fontWeight: "900", color: COLORS.text },
  centerSub: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 6,
    textAlign: "center",
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 12,
    marginTop: 18,
  },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "900" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  backText: {
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.text,
    marginTop: -4,
  },
  topTitleBlock: { flex: 1 },
  title: { color: COLORS.text, fontSize: 21, fontWeight: "900" },
  subtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 12,
    marginTop: 2,
  },
  cartButton: {
    backgroundColor: COLORS.dark,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  cartText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },
  storeHeader: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: COLORS.soft,
  },
  logoFallback: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: COLORS.primaryDark,
    justifyContent: "center",
    alignItems: "center",
  },
  logoFallbackText: { color: "#FFFFFF", fontSize: 26, fontWeight: "900" },
  storeInfo: { flex: 1 },
  storeName: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  storeMeta: {
    color: COLORS.primaryDark,
    fontWeight: "800",
    fontSize: 12,
    marginTop: 4,
  },
  storeAbout: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 18,
    fontSize: 12,
    marginTop: 6,
  },
  sectionHeader: { marginBottom: 12 },
  sectionTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  sectionSub: {
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 13,
    marginTop: 3,
  },
  categorySection: { marginBottom: 18 },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    alignItems: "center",
  },
  categoryTitle: { color: COLORS.text, fontSize: 17, fontWeight: "900" },
  categoryCount: { color: COLORS.muted, fontWeight: "800", fontSize: 12 },
  productRow: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  productImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: COLORS.soft,
  },
  productImageFallback: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: COLORS.soft,
    justifyContent: "center",
    alignItems: "center",
  },
  productImageFallbackText: {
    color: COLORS.primaryDark,
    fontSize: 24,
    fontWeight: "900",
  },
  productInfo: { flex: 1 },
  productName: { color: COLORS.text, fontWeight: "900", fontSize: 15 },
  productDetails: {
    color: COLORS.primaryDark,
    fontWeight: "800",
    fontSize: 12,
    marginTop: 3,
  },
  productDescription: {
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },
  emptyBox: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: { color: COLORS.text, fontWeight: "900", fontSize: 18 },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 12,
  },
  footerButton: {
    backgroundColor: COLORS.dark,
    borderRadius: 13,
    paddingVertical: 14,
    alignItems: "center",
  },
  footerButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 14 },
});