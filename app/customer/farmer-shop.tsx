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
  secondary: "#F9A825",
  background: "#F8FAF5",
  card: "#FFFFFF",
  text: "#172017",
  muted: "#75806F",
  border: "#E2E8DA",
  softGreen: "#EAF5E6",
  lightGreen: "#F1FAED",
  danger: "#DC2626",
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
  farmerStripeAccountId?: string;
  farmer_stripe_account_id?: string;
  stripeAccountId?: string;
  stripe_account_id?: string;
  stock?: number;
  quantity?: number;
  inventory?: number;
  available?: boolean;
  active?: boolean;
  marketplace_visible?: boolean;
  organic?: boolean;
  local?: boolean;
  seasonal?: boolean;
  featured?: boolean;
  tags?: string[];
};

type Farmer = {
  id: string;
  farmName?: string;
  name?: string;
  businessName?: string;
  business_name?: string;
  location?: string;
  farmLocation?: string;
  city?: string;
  state?: string;
  about?: string;
  logoUrl?: string;
  farmLogoUrl?: string;
  logo_url?: string;
  farm_logo_url?: string;
  rating?: number;
  distanceMiles?: number;
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

function getFarmerName(farmer: Farmer) {
  return (
    farmer.farmName ||
    farmer.name ||
    farmer.businessName ||
    farmer.business_name ||
    "Farm2Home Farm"
  );
}

function getFarmerLocation(farmer: Farmer) {
  if (farmer.location) return farmer.location;
  if (farmer.farmLocation) return farmer.farmLocation;
  if (farmer.city && farmer.state) return `${farmer.city}, ${farmer.state}`;
  if (farmer.state) return farmer.state;
  return "Local Farm";
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
  return Number(product.stock ?? product.quantity ?? product.inventory ?? 0);
}

function isProductAvailable(product: Product) {
  const stock = getProductStock(product);
  if (product.available === false) return false;
  if (product.active === false) return false;
  if (product.marketplace_visible === false) return false;
  return stock > 0;
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

function normalizeCategory(category?: string) {
  const value = String(category || "").trim();
  if (!value) return "Farm Goods";
  if (value === "Fish Farm / Aquaculture") return "Fish & Aquaculture";
  if (value === "Bale of Hay") return "Hay & Feed";
  if (value === "Hay") return "Hay & Feed";
  if (value === "Plants & Herbs") return "Plants & Nursery";
  if (value === "Seasonal") return "Seasonal Products";
  return value;
}

function getProductEmoji(product: Product) {
  const category = String(product.category || "").toLowerCase();
  const name = String(product.name || "").toLowerCase();

  if (category.includes("flower") || name.includes("flower")) return "💐";
  if (category.includes("hay") || name.includes("hay")) return "🌾";
  if (category.includes("egg") || name.includes("egg")) return "🥚";
  if (category.includes("honey") || name.includes("honey")) return "🍯";
  if (category.includes("dairy") || name.includes("milk")) return "🥛";
  if (category.includes("fish") || name.includes("catfish")) return "🐟";
  if (category.includes("meat") || category.includes("poultry")) return "🥩";
  if (category.includes("fruit") || name.includes("apple")) return "🍎";
  if (category.includes("seasonal") || name.includes("pumpkin")) return "🎃";
  if (name.includes("christmas")) return "🎄";
  if (category.includes("vegetable") || category.includes("greens")) return "🥬";

  return "🥬";
}

function normalizeFarmer(farmer: Farmer): Farmer {
  const farmName = getFarmerName(farmer);
  const stripeAccountId =
    farmer.stripeAccountId ||
    farmer.farmerStripeAccountId ||
    farmer.stripe_account_id ||
    farmer.farmer_stripe_account_id ||
    "";

  return {
    ...farmer,
    farmName,
    name: farmName,
    location: getFarmerLocation(farmer),
    logoUrl: getFarmerLogo(farmer),
    stripeAccountId,
    farmerStripeAccountId: stripeAccountId,
    products: (farmer.products || [])
      .map((product) => ({
        ...product,
        category: normalizeCategory(product.category),
        farmerId: product.farmerId || product.farmer_id || farmer.id,
        farmName: product.farmName || product.farm_name || farmName,
        farmerStripeAccountId:
          product.farmerStripeAccountId ||
          product.farmer_stripe_account_id ||
          product.stripeAccountId ||
          product.stripe_account_id ||
          stripeAccountId,
        image: getProductImage(product),
        stock: getProductStock(product),
      }))
      .filter(isProductAvailable),
  };
}

function mapProductRow(row: any): Product {
  return {
    id: String(row.id || `product_${Date.now()}_${Math.random()}`),
    name: String(row.name || "Farm Product"),
    description: row.description || "",
    category: normalizeCategory(row.category),
    price: Number(row.price || 0),
    unit: row.unit || "each",
    image: row.image_url || row.image || row.imageUrl || "",
    imageUrl: row.image_url || row.image || row.imageUrl || "",
    farmerId: String(row.farmer_id || row.farmerId || ""),
    farmer_id: String(row.farmer_id || row.farmerId || ""),
    farmName: row.farm_name || row.farmName || "",
    farm_name: row.farm_name || row.farmName || "",
    farmerStripeAccountId:
      row.farmer_stripe_account_id || row.stripe_account_id || "",
    farmer_stripe_account_id:
      row.farmer_stripe_account_id || row.stripe_account_id || "",
    stock: Number(row.stock ?? row.quantity ?? row.inventory ?? 0),
    quantity: Number(row.quantity ?? row.stock ?? row.inventory ?? 0),
    inventory: Number(row.inventory ?? row.stock ?? row.quantity ?? 0),
    available: row.available !== false,
    active: row.active !== false,
    marketplace_visible: row.marketplace_visible !== false,
    organic: Boolean(row.organic),
    local: Boolean(row.local),
    seasonal: Boolean(row.seasonal),
    featured: Boolean(row.featured),
    tags: Array.isArray(row.tags) ? row.tags : [],
  };
}

function mapFarmerRow(row: any, products: Product[]): Farmer {
  const farmName =
    row?.farm_name || row?.business_name || row?.farmName || row?.businessName || "Local Farm";

  const location =
    row?.city && row?.state
      ? `${row.city}, ${row.state}`
      : row?.farm_location || row?.location || row?.state || "Local Farm";

  const logo =
    row?.logo_url ||
    row?.farm_logo_url ||
    row?.logoUrl ||
    row?.farmLogoUrl ||
    "";

  const stripeAccountId =
    row?.stripe_account_id ||
    row?.farmer_stripe_account_id ||
    row?.stripeAccountId ||
    row?.farmerStripeAccountId ||
    "";

  return normalizeFarmer({
    id: String(row?.id || products[0]?.farmerId || ""),
    farmName,
    name: farmName,
    location,
    about: row?.about || "",
    logoUrl: logo,
    farmLogoUrl: logo,
    rating: Number(row?.rating || 4.8),
    distanceMiles: Number(row?.distance_miles || row?.distanceMiles || 5),
    stripeAccountId,
    farmerStripeAccountId: stripeAccountId,
    products,
  });
}

export default function FarmerShopScreen() {
  const params = useLocalSearchParams();
  const farmerId = firstParam(params.farmerId || params.id);

  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFarmer();
    refreshCartCount();
  }, [farmerId]);

  async function refreshCartCount() {
    try {
      const count = await getCartItemCount();
      setCartCount(count);
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

      const fromSupabase = await loadFarmerFromSupabase(farmerId);
      if (fromSupabase) {
        setFarmer(fromSupabase);
        return;
      }

      const fromLocal = await loadFarmerFromLocal(farmerId);
      if (fromLocal) {
        setFarmer(fromLocal);
        return;
      }

      setFarmer(null);
    } catch (error) {
      console.log("Load farmer shop error:", error);
      setFarmer(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadFarmerFromSupabase(activeFarmerId: string) {
    const { data: productRows, error: productError } = await supabase
      .from("products")
      .select("*")
      .eq("farmer_id", activeFarmerId)
      .or("marketplace_visible.is.true,active.is.true,available.is.true")
      .order("created_at", { ascending: false });

    if (productError) {
      console.log("Farmer shop product load ignored:", productError.message);
    }

    const products = Array.isArray(productRows)
      ? productRows.map(mapProductRow).filter(isProductAvailable)
      : [];

    const { data: farmerRow, error: farmerError } = await supabase
      .from("farmers")
      .select("*")
      .eq("id", activeFarmerId)
      .maybeSingle();

    if (farmerError) {
      console.log("Farmer shop farmer load ignored:", farmerError.message);
    }

    if (!farmerRow && products.length === 0) return null;

    return mapFarmerRow(farmerRow || { id: activeFarmerId }, products);
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
      (item: any) => item?.id === activeFarmerId || item?.farmerId === activeFarmerId
    );

    if (!selected) return null;

    return normalizeFarmer({
      ...selected,
      id: selected.id || selected.farmerId,
      farmName:
        selected.farmName ||
        selected.businessName ||
        selected.business_name ||
        selected.farm_name ||
        "Farm2Home Farm",
      logoUrl:
        selected.logoUrl ||
        selected.farmLogoUrl ||
        selected.logo_url ||
        selected.farm_logo_url ||
        "",
      products: selected.products || [],
    });
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

      const farmerStripeAccountId = getFarmerStripeAccountId(farmer, product);

      if (!farmerStripeAccountId) {
        Alert.alert("Missing Payout Account", "This farm needs a Stripe account.");
        return;
      }

      await addToCart({
        id: `${farmer.id}_${product.id}`,
        productId: product.id,
        name: product.name,
        quantity: 1,
        price: Number(product.price || 0),
        image: getProductImage(product),
        farmName: getFarmerName(farmer),
        farmerId: farmer.id,
        farmerStripeAccountId,
        unit: product.unit || "each",
      } as any);

      await refreshCartCount();

      Alert.alert("Added To Cart", `${product.name} was added to your cart.`);
    } catch (error) {
      console.log("Farmer shop add to cart error:", error);
      Alert.alert("Error", "Unable to add item to cart.");
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading farmer storefront...</Text>
      </View>
    );
  }

  if (!farmer) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingIcon}>🌾</Text>
        <Text style={styles.loadingText}>Farmer shop not found.</Text>
        <Pressable
          style={({ pressed }) => [styles.backToMarketButton, pressed && styles.pressed]}
          onPress={() => router.replace("/customer/marketplace" as any)}
        >
          <Text style={styles.backToMarketText}>Back to Marketplace</Text>
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
            style={({ pressed }) => [styles.backCircle, pressed && styles.pressed]}
            onPress={() => router.push("/customer/marketplace" as any)}
          >
            <Text style={styles.backCircleText}>‹</Text>
          </Pressable>

          <View style={styles.topTitleBlock}>
            <Text style={styles.title}>Farm Store</Text>
            <Text style={styles.subtitle}>Shop directly from this farmer</Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.cartTopButton, pressed && styles.pressed]}
            onPress={() => router.push("/customer/cart" as any)}
          >
            <Text style={styles.cartTopText}>🛒</Text>
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.logoWrap}>
            {logo ? (
              <Image source={{ uri: logo }} style={styles.logo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoEmoji}>🚜</Text>
              </View>
            )}
          </View>

          <View style={styles.heroContent}>
            <Text style={styles.heroBadge}>Verified Farm</Text>
            <Text style={styles.farmName}>{farmName}</Text>
            <Text style={styles.location}>{farmLocation}</Text>

            <View style={styles.metaRow}>
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>
                  ⭐ {Number(farmer.rating || 4.8).toFixed(1)}
                </Text>
              </View>

              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>
                  {Number(farmer.distanceMiles || 5).toFixed(1)} mi
                </Text>
              </View>

              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>{productCount} items</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.storeInfoCard}>
          <Text style={styles.storeInfoTitle}>Fresh from {farmName}</Text>
          <Text style={styles.storeInfoText}>
            {farmer.about ||
              "Browse fresh farm goods, seasonal products, and local items available from this Farm2Home seller."}
          </Text>

          <Pressable
            style={({ pressed }) => [styles.viewCartButton, pressed && styles.pressed]}
            onPress={() => router.push("/customer/cart" as any)}
          >
            <Text style={styles.viewCartButtonText}>View Cart ({cartCount})</Text>
          </Pressable>
        </View>

        {productCount === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🥬</Text>
            <Text style={styles.emptyTitle}>No products posted yet</Text>
            <Text style={styles.emptyText}>
              This farmer does not have active marketplace products right now.
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
                  <View key={product.id} style={styles.productCard}>
                    {imageSource ? (
                      <Image source={{ uri: imageSource }} style={styles.productImage} />
                    ) : (
                      <View style={styles.imagePlaceholder}>
                        <Text style={styles.imageEmoji}>{getProductEmoji(product)}</Text>
                      </View>
                    )}

                    <View style={styles.productInfo}>
                      <Text style={styles.productCategory}>
                        {normalizeCategory(product.category)}
                      </Text>

                      <Text style={styles.productName} numberOfLines={2}>
                        {product.name}
                      </Text>

                      <Text style={styles.productDescription} numberOfLines={2}>
                        {product.description || "Fresh farm product"}
                      </Text>

                      <View style={styles.tagLine}>
                        {product.organic ? <Text style={styles.miniTag}>Organic</Text> : null}
                        {product.local ? <Text style={styles.miniTag}>Local</Text> : null}
                        {product.seasonal ? <Text style={styles.miniTag}>Seasonal</Text> : null}
                      </View>

                      <View style={styles.priceRow}>
                        <View>
                          <Text style={styles.price}>
                            ${Number(product.price || 0).toFixed(2)}
                          </Text>
                          <Text style={styles.unit}>
                            {product.unit ? `per ${product.unit}` : "each"} · {stock} left
                          </Text>
                        </View>

                        <Pressable
                          style={({ pressed }) => [
                            styles.addCircleButton,
                            pressed && styles.pressed,
                          ]}
                          onPress={() => handleAddToCart(product)}
                        >
                          <Text style={styles.addCircleText}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ))
        )}

        <Pressable
          style={({ pressed }) => [styles.goCartButton, pressed && styles.pressed]}
          onPress={() => router.push("/customer/cart" as any)}
        >
          <Text style={styles.goCartButtonText}>Go To Cart ({cartCount})</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: 18, paddingBottom: 110 },
  center: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingIcon: { fontSize: 52, marginBottom: 10 },
  loadingText: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.primary,
    textAlign: "center",
  },
  backToMarketButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 18,
    marginTop: 18,
  },
  backToMarketText: { color: "#FFFFFF", fontWeight: "900" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    gap: 12,
  },
  backCircle: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backCircleText: {
    fontSize: 34,
    color: COLORS.text,
    fontWeight: "900",
    marginTop: -4,
  },
  topTitleBlock: { flex: 1 },
  title: { fontSize: 30, fontWeight: "900", color: COLORS.text },
  subtitle: { color: COLORS.muted, fontWeight: "700", marginTop: 3 },
  cartTopButton: {
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cartTopText: { fontSize: 22 },
  cartBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: COLORS.secondary,
    minWidth: 24,
    height: 24,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: COLORS.card,
  },
  cartBadgeText: { color: COLORS.dark, fontWeight: "900", fontSize: 12 },
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 32,
    padding: 18,
    marginBottom: 16,
  },
  logoWrap: { alignSelf: "center", marginBottom: 14 },
  logo: {
    width: 112,
    height: 112,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: COLORS.softGreen,
  },
  logoPlaceholder: {
    width: 112,
    height: 112,
    borderRadius: 32,
    backgroundColor: COLORS.secondary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.28)",
  },
  logoEmoji: { fontSize: 50 },
  heroContent: { alignItems: "center" },
  heroBadge: {
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    color: "#FFFFFF",
    fontWeight: "900",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 10,
  },
  farmName: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
    textAlign: "center",
  },
  location: {
    color: "#EAF7E6",
    marginTop: 7,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 9,
    marginTop: 14,
  },
  metaPill: {
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  metaPillText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },
  storeInfoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  storeInfoTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900" },
  storeInfoText: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },
  viewCartButton: {
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 14,
  },
  viewCartButtonText: { color: "#FFFFFF", fontWeight: "900" },
  categorySection: { marginTop: 8 },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 12,
  },
  categoryTitle: { fontSize: 23, fontWeight: "900", color: COLORS.text },
  categoryCount: { color: COLORS.muted, fontWeight: "800", fontSize: 13 },
  productCard: {
    backgroundColor: COLORS.card,
    marginBottom: 14,
    borderRadius: 28,
    padding: 13,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  productImage: {
    width: 112,
    height: 126,
    borderRadius: 22,
    backgroundColor: COLORS.softGreen,
  },
  imagePlaceholder: {
    width: 112,
    height: 126,
    borderRadius: 22,
    backgroundColor: COLORS.softGreen,
    justifyContent: "center",
    alignItems: "center",
  },
  imageEmoji: { fontSize: 44 },
  productInfo: { flex: 1 },
  productCategory: {
    color: COLORS.primary,
    fontWeight: "900",
    fontSize: 11,
    marginBottom: 4,
  },
  productName: { fontSize: 18, fontWeight: "900", color: COLORS.text },
  productDescription: {
    marginTop: 6,
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 19,
    fontSize: 12,
  },
  tagLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 8,
    minHeight: 20,
  },
  miniTag: {
    backgroundColor: "#DCFCE7",
    color: COLORS.primaryDark,
    fontSize: 10,
    fontWeight: "900",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
  },
  priceRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  price: { fontSize: 21, fontWeight: "900", color: COLORS.primary },
  unit: {
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 11,
    marginTop: 2,
  },
  addCircleButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  addCircleText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 26,
    marginTop: -2,
  },
  emptyBox: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyIcon: { fontSize: 42, marginBottom: 10 },
  emptyTitle: { color: COLORS.text, fontWeight: "900", fontSize: 20 },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
  },
  goCartButton: {
    backgroundColor: COLORS.dark,
    paddingVertical: 17,
    borderRadius: 20,
    alignItems: "center",
    marginTop: 8,
  },
  goCartButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 16 },
  pressed: { opacity: 0.75 },
});