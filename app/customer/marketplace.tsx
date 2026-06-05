// app/customer/marketplace.tsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

import { addToCart, getCartItemCount } from "../data/cartStore";
import { getApprovedFarmers } from "../data/farmerStore";
import { supabase } from "../data/supabaseClient";
import { useAuth } from "../providers/AuthProvider";
import { enforceSubscriptionAccess } from "../services/lockoutGuard";

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
  danger: "#B91C1C",
  dark: "#111827",
};

const DEFAULT_CATEGORIES = [
  "All",
  "Vegetables",
  "Fruits",
  "Eggs",
  "Honey",
  "Meat",
  "Poultry",
  "Fish & Aquaculture",
  "Dairy",
  "Baked Goods",
  "Flowers",
  "Plants & Nursery",
  "Hay & Feed",
  "Farm Supplies",
  "Seasonal Products",
  "Specialty Products",
];

type Product = {
  id: string;
  name: string;
  category?: string;
  price?: number;
  unit?: string;
  description?: string;
  image?: string;
  imageUrl?: string;
  image_url?: string;
  farmerId?: string;
  farmer_id?: string;
  farmName?: string;
  farm_name?: string;
  farmerEmail?: string;
  farmer_email?: string;
  farmerStripeAccountId?: string;
  stripeAccountId?: string;
  stripe_account_id?: string;
  farmer_stripe_account_id?: string;
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
  farmLocation?: string;
  location?: string;
  rating?: number;
  distanceMiles?: number;
  logoUrl?: string;
  farmLogoUrl?: string;
  logo_url?: string;
  farm_logo_url?: string;
  stripeAccountId?: string;
  farmerStripeAccountId?: string;
  stripe_account_id?: string;
  farmer_stripe_account_id?: string;
  products?: Product[];
};

function getFarmerName(farmer: Farmer) {
  return farmer.farmName || farmer.name || "Farm2Home Farm";
}

function getFarmerLocation(farmer: Farmer) {
  return farmer.farmLocation || farmer.location || "Local Farm";
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
    product?.stripeAccountId ||
    product?.farmer_stripe_account_id ||
    product?.stripe_account_id ||
    farmer.farmerStripeAccountId ||
    farmer.stripeAccountId ||
    farmer.farmer_stripe_account_id ||
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

function normalizeFarmers(inputFarmers: Farmer[]): Farmer[] {
  return inputFarmers.map((farmer) => {
    const stripeAccountId =
      farmer.stripeAccountId ||
      farmer.farmerStripeAccountId ||
      farmer.stripe_account_id ||
      farmer.farmer_stripe_account_id ||
      "";

    const farmName = getFarmerName(farmer);

    return {
      ...farmer,
      farmName,
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
            product.stripeAccountId ||
            product.farmer_stripe_account_id ||
            product.stripe_account_id ||
            stripeAccountId,
          image: getProductImage(product),
          stock: getProductStock(product),
        }))
        .filter(isProductAvailable),
    };
  });
}

async function loadProductsFromSupabase(): Promise<Farmer[]> {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .or("marketplace_visible.is.true,active.is.true,available.is.true")
      .order("created_at", { ascending: false });

    if (error) {
      console.log("Supabase marketplace products ignored:", error.message);
      return [];
    }

    const rows = Array.isArray(data) ? data : [];

    const products = rows
      .map((row: any): Product => {
        const farmerId = String(row.farmer_id || row.farmerId || "");

        return {
          id: String(row.id || `product_${Date.now()}_${Math.random()}`),
          name: String(row.name || "Farm Product"),
          description: row.description || "",
          category: normalizeCategory(row.category),
          price: Number(row.price || 0),
          unit: row.unit || "each",
          image: row.image_url || row.image || row.imageUrl || "",
          imageUrl: row.image_url || row.image || row.imageUrl || "",
          farmerId,
          farmer_id: farmerId,
          farmName: row.farm_name || row.farmName || "Local Farm",
          farm_name: row.farm_name || row.farmName || "Local Farm",
          farmerEmail: row.farmer_email || "",
          farmer_email: row.farmer_email || "",
          farmerStripeAccountId:
            row.farmer_stripe_account_id || row.stripe_account_id || "",
          farmer_stripe_account_id:
            row.farmer_stripe_account_id || row.stripe_account_id || "",
          stripeAccountId: row.stripe_account_id || "",
          stripe_account_id: row.stripe_account_id || "",
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
      })
      .filter((product) => product.farmerId && isProductAvailable(product));

    const farmerIds = Array.from(
      new Set(products.map((product) => product.farmerId || "").filter(Boolean))
    );

    let farmerRows: any[] = [];

    if (farmerIds.length > 0) {
      const { data: farmersData } = await supabase
        .from("farmers")
        .select("*")
        .in("id", farmerIds);

      if (Array.isArray(farmersData)) farmerRows = farmersData;
    }

    const farmerInfoMap = new Map<string, any>();
    farmerRows.forEach((farmer) => farmerInfoMap.set(String(farmer.id), farmer));

    const grouped = new Map<string, Farmer>();

    products.forEach((product) => {
      const farmerId = product.farmerId || product.farmer_id || "";
      const farmerInfo = farmerInfoMap.get(farmerId);

      const farmName =
        farmerInfo?.farm_name ||
        farmerInfo?.business_name ||
        product.farmName ||
        product.farm_name ||
        "Local Farm";

      const logoUrl =
        farmerInfo?.logo_url ||
        farmerInfo?.farm_logo_url ||
        farmerInfo?.logoUrl ||
        farmerInfo?.farmLogoUrl ||
        "";

      const location =
        farmerInfo?.city && farmerInfo?.state
          ? `${farmerInfo.city}, ${farmerInfo.state}`
          : farmerInfo?.location ||
            farmerInfo?.farm_location ||
            farmerInfo?.state ||
            "Local Farm Market";

      const stripeAccountId =
        farmerInfo?.stripe_account_id ||
        farmerInfo?.farmer_stripe_account_id ||
        product.farmerStripeAccountId ||
        product.stripeAccountId ||
        "";

      if (!grouped.has(farmerId)) {
        grouped.set(farmerId, {
          id: farmerId,
          farmName,
          name: farmName,
          location,
          logoUrl,
          farmLogoUrl: logoUrl,
          rating: 4.8,
          distanceMiles: 5,
          stripeAccountId,
          farmerStripeAccountId: stripeAccountId,
          products: [],
        });
      }

      grouped.get(farmerId)?.products?.push({
        ...product,
        farmName,
        farm_name: farmName,
        farmerStripeAccountId: product.farmerStripeAccountId || stripeAccountId,
        farmer_stripe_account_id:
          product.farmer_stripe_account_id || stripeAccountId,
      });
    });

    return Array.from(grouped.values());
  } catch (error) {
    console.log("Load products from Supabase error:", error);
    return [];
  }
}

export default function MarketplaceScreen() {
  const { user, profile } = useAuth();

  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(false);
  const [accessChecking, setAccessChecking] = useState(true);
  const [accessAllowed, setAccessAllowed] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [cartCount, setCartCount] = useState(0);

  const refreshCartCount = useCallback(async () => {
    try {
      const count = await getCartItemCount();
      setCartCount(count);
    } catch {
      setCartCount(0);
    }
  }, []);

  const verifyAccess = useCallback(async () => {
    try {
      setAccessChecking(true);

      const result = await enforceSubscriptionAccess({
        role: "customer",
        userId: user?.id || "",
        email: profile?.email || user?.email || "",
        redirectTo: "/subscription/subscription-locked",
      });

      setAccessAllowed(result.allowed);
    } catch {
      setAccessAllowed(true);
    } finally {
      setAccessChecking(false);
    }
  }, [user?.id, user?.email, profile?.email]);

  const loadMarketplace = useCallback(async () => {
    try {
      setLoading(true);

      const approvedFarmers = (await getApprovedFarmers()) || [];

      const localFarmerRaw =
        (await AsyncStorage.getItem("currentFarmer")) ||
        (await AsyncStorage.getItem("currentUser"));

      const currentFarmer = localFarmerRaw ? JSON.parse(localFarmerRaw) : null;

      const localCurrentFarmer =
        currentFarmer?.role === "farmer" &&
        (currentFarmer?.accountActive === true ||
          currentFarmer?.account_active === true ||
          currentFarmer?.storeUnlocked === true ||
          currentFarmer?.store_unlocked === true) &&
        Array.isArray(currentFarmer.products)
          ? [
              {
                id: currentFarmer.id || currentFarmer.farmerId || "",
                farmName:
                  currentFarmer.farmName ||
                  currentFarmer.businessName ||
                  currentFarmer.business_name ||
                  "Local Farm",
                location:
                  currentFarmer.location ||
                  currentFarmer.farmLocation ||
                  currentFarmer.farm_location ||
                  currentFarmer.state ||
                  "Local Farm",
                rating: 4.9,
                distanceMiles: 3,
                logoUrl:
                  currentFarmer.logoUrl ||
                  currentFarmer.farmLogoUrl ||
                  currentFarmer.logo_url ||
                  currentFarmer.farm_logo_url ||
                  "",
                farmLogoUrl:
                  currentFarmer.logoUrl ||
                  currentFarmer.farmLogoUrl ||
                  currentFarmer.logo_url ||
                  currentFarmer.farm_logo_url ||
                  "",
                stripeAccountId:
                  currentFarmer.stripeAccountId ||
                  currentFarmer.farmerStripeAccountId ||
                  currentFarmer.stripe_account_id ||
                  currentFarmer.farmer_stripe_account_id ||
                  "",
                farmerStripeAccountId:
                  currentFarmer.stripeAccountId ||
                  currentFarmer.farmerStripeAccountId ||
                  currentFarmer.stripe_account_id ||
                  currentFarmer.farmer_stripe_account_id ||
                  "",
                products: currentFarmer.products,
              },
            ]
          : [];

      const supabaseFarmers = await loadProductsFromSupabase();

      const mergedFarmers: Farmer[] = [
        ...supabaseFarmers,
        ...localCurrentFarmer,
        ...(Array.isArray(approvedFarmers) ? approvedFarmers : []),
      ];

      const normalizedFarmers = normalizeFarmers(mergedFarmers).filter(
        (farmer) => farmer.id && farmer.products && farmer.products.length > 0
      );

      const farmerMap = new Map<string, Farmer>();

      normalizedFarmers.forEach((farmer) => {
        if (!farmerMap.has(farmer.id)) {
          farmerMap.set(farmer.id, farmer);
          return;
        }

        const existing = farmerMap.get(farmer.id);
        const productMap = new Map<string, Product>();

        [...(existing?.products || []), ...(farmer.products || [])].forEach(
          (product) => productMap.set(product.id, product)
        );

        farmerMap.set(farmer.id, {
          ...(existing || farmer),
          ...farmer,
          logoUrl: getFarmerLogo(farmer) || getFarmerLogo(existing || farmer),
          products: Array.from(productMap.values()),
        });
      });

      setFarmers(Array.from(farmerMap.values()));
    } catch (error) {
      console.log("Marketplace load error:", error);
      setFarmers([]);
      Alert.alert("Marketplace Error", "Unable to load active farms.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    verifyAccess();
  }, [verifyAccess]);

  useEffect(() => {
    if (accessAllowed) {
      loadMarketplace();
      refreshCartCount();
    }
  }, [accessAllowed, loadMarketplace, refreshCartCount]);

  const categories = useMemo(() => {
    const categorySet = new Set<string>();

    farmers.forEach((farmer) => {
      (farmer.products || []).forEach((product) => {
        if (product.category) categorySet.add(normalizeCategory(product.category));
      });
    });

    return Array.from(new Set([...DEFAULT_CATEGORIES, ...Array.from(categorySet)]));
  }, [farmers]);

  const allProductCount = useMemo(() => {
    return farmers.reduce((sum, farmer) => sum + (farmer.products || []).length, 0);
  }, [farmers]);

  const featuredProducts = useMemo(() => {
    const allProducts: Array<{ farmer: Farmer; product: Product }> = [];

    farmers.forEach((farmer) => {
      (farmer.products || []).forEach((product) => {
        allProducts.push({ farmer, product });
      });
    });

    const featured = allProducts.filter(
      ({ product }) =>
        product.featured ||
        product.seasonal ||
        product.organic ||
        String(product.tags || "").includes("featured")
    );

    return (featured.length > 0 ? featured : allProducts).slice(0, 10);
  }, [farmers]);

  const filteredFarmers = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return farmers
      .map((farmer) => {
        const filteredProducts = (farmer.products || []).filter((product) => {
          const category = normalizeCategory(product.category);

          const matchesCategory =
            selectedCategory === "All" || category === selectedCategory;

          const matchesSearch =
            !search ||
            product.name?.toLowerCase().includes(search) ||
            category.toLowerCase().includes(search) ||
            product.unit?.toLowerCase().includes(search) ||
            product.description?.toLowerCase().includes(search) ||
            farmer.farmName?.toLowerCase().includes(search) ||
            farmer.name?.toLowerCase().includes(search);

          return matchesCategory && matchesSearch && isProductAvailable(product);
        });

        return { ...farmer, products: filteredProducts };
      })
      .filter((farmer) => farmer.products && farmer.products.length > 0);
  }, [farmers, selectedCategory, searchText]);

  async function handleAddToCart(farmer: Farmer, product: Product) {
    try {
      const farmerStripeAccountId = getFarmerStripeAccountId(farmer, product);

      const cartItem = {
        id: `${farmer.id}_${product.id}`,
        cartItemId: `${farmer.id}_${product.id}`,
        productId: product.id,
        name: product.name,
        productName: product.name,
        price: Number(product.price || 0),
        quantity: 1,
        image: getProductImage(product),
        imageUrl: getProductImage(product),
        farmName: getFarmerName(farmer),
        farmerName: getFarmerName(farmer),
        farmerId: farmer.id,
        farmer_id: farmer.id,
        farmerEmail: product.farmerEmail || product.farmer_email || "",
        farmerStripeAccountId,
        stripeAccountId: farmerStripeAccountId,
        farmer_stripe_account_id: farmerStripeAccountId,
        stripe_account_id: farmerStripeAccountId,
        unit: product.unit || "each",
        category: normalizeCategory(product.category),
        stock: getProductStock(product),
        addedAt: new Date().toISOString(),
      };

      await addToCart(cartItem as any);

      await refreshCartCount();

      Alert.alert(
        "Added to Cart",
        `${product.name} added to cart at $${Number(product.price || 0).toFixed(2)}${
          product.unit ? ` / ${product.unit}` : ""
        }.`
      );
    } catch (error: any) {
      console.log("Add cart error:", error);

      Alert.alert(
        "Cart Error",
        error?.message || "Unable to add item to cart."
      );
    }
  }

  function openFarmerShop(farmer: Farmer) {
    router.push({
      pathname: "/customer/farmer-shop",
      params: { farmerId: farmer.id },
    } as any);
  }

  function renderProductCard(farmer: Farmer, product: Product, compact = false) {
    const imageSource = getProductImage(product);
    const stock = getProductStock(product);
    const category = normalizeCategory(product.category);

    return (
      <View
        key={`${farmer.id}_${product.id}_${compact ? "compact" : "regular"}`}
        style={[styles.productCard, compact && styles.featuredProductCard]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.productImageWrap,
            pressed && styles.pressedButton,
          ]}
          onPress={() => handleAddToCart(farmer, product)}
        >
          {imageSource ? (
            <Image source={{ uri: imageSource }} style={styles.productImage} />
          ) : (
            <View style={styles.productPlaceholder}>
              <Text style={styles.productEmoji}>{getProductEmoji(product)}</Text>
            </View>
          )}

          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText} numberOfLines={1}>
              {category}
            </Text>
          </View>

          {product.featured ? (
            <View style={styles.featuredBadge}>
              <Text style={styles.featuredBadgeText}>Featured</Text>
            </View>
          ) : null}
        </Pressable>

        <Text style={styles.productName} numberOfLines={1}>
          {product.name}
        </Text>

        <Text style={styles.productFarmName} numberOfLines={1}>
          {getFarmerName(farmer)}
        </Text>

        <View style={styles.tagLine}>
          {product.organic ? <Text style={styles.miniTag}>Organic</Text> : null}
          {product.local ? <Text style={styles.miniTag}>Local</Text> : null}
          {product.seasonal ? <Text style={styles.miniTag}>Seasonal</Text> : null}
        </View>

        <View style={styles.priceRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.productPrice}>
              ${Number(product.price || 0).toFixed(2)}
            </Text>
            <Text style={styles.productUnit}>
              {product.unit ? `per ${product.unit}` : "each"} · {stock} left
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.addCircleButton,
              pressed && styles.pressedButton,
            ]}
            onPress={() => handleAddToCart(farmer, product)}
          >
            <Text style={styles.addCircleButtonText}>+</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  function renderFarmerRow({ item }: { item: Farmer }) {
    const logo = getFarmerLogo(item);

    return (
      <View style={styles.farmSection}>
        <View style={styles.farmMarketRow}>
          <Pressable
            style={({ pressed }) => [
              styles.farmSideCard,
              pressed && styles.pressedButton,
            ]}
            onPress={() => openFarmerShop(item)}
          >
            {logo ? (
              <Image source={{ uri: logo }} style={styles.farmLogoLarge} />
            ) : (
              <View style={styles.logoPlaceholderLarge}>
                <Text style={styles.logoPlaceholderText}>🚜</Text>
              </View>
            )}

            <Text style={styles.farmNameSide} numberOfLines={2}>
              {getFarmerName(item)}
            </Text>

            <Text style={styles.farmLocationSide} numberOfLines={1}>
              {getFarmerLocation(item)}
            </Text>

            <Text style={styles.farmMetaSide}>
              ⭐ {Number(item.rating || 4.8).toFixed(1)}
            </Text>

            <Text style={styles.viewFarmText}>View Farm →</Text>
          </Pressable>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.productsRowSide}
          >
            {(item.products || []).map((product) =>
              renderProductCard(item, product)
            )}
          </ScrollView>
        </View>
      </View>
    );
  }

  function renderHeader() {
    return (
      <View>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.greeting}>Farm2Home Market</Text>
            <Text style={styles.locationLine}>
              {allProductCount} local farm goods available
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.cartTopButton,
              pressed && styles.pressedButton,
            ]}
            onPress={() => router.push("/customer/cart" as any)}
          >
            <Text style={styles.cartTopIcon}>🛒</Text>
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTextBlock}>
            <Text style={styles.heroBadge}>Fresh Harvest</Text>
            <Text style={styles.heroTitle}>Shop directly from local farmers</Text>
            <Text style={styles.heroSubtitle}>
              Produce, eggs, honey, meat, fish, hay, flowers, seasonal goods,
              and farm supplies.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.heroButton,
                pressed && styles.pressedButton,
              ]}
              onPress={() => router.push("/customer/cart" as any)}
            >
              <Text style={styles.heroButtonText}>View Cart ({cartCount})</Text>
            </Pressable>
          </View>

          <View style={styles.heroArt}>
            <Text style={styles.heroArtEmoji}>🥬</Text>
            <Text style={styles.heroArtEmojiSmall}>🍯 🥚 🌽 🎄</Text>
          </View>
        </View>

        <View style={styles.quickStatsRow}>
          <View style={styles.quickStat}>
            <Text style={styles.quickStatValue}>{farmers.length}</Text>
            <Text style={styles.quickStatLabel}>Farms</Text>
          </View>

          <View style={styles.quickStat}>
            <Text style={styles.quickStatValue}>{allProductCount}</Text>
            <Text style={styles.quickStatLabel}>Products</Text>
          </View>

          <View style={styles.quickStat}>
            <Text style={styles.quickStatValue}>{categories.length - 1}</Text>
            <Text style={styles.quickStatLabel}>Categories</Text>
          </View>
        </View>

        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔎</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search pumpkins, fish, hay, honey, farms..."
            placeholderTextColor="#8A9482"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {categories.map((category) => {
            const active = category === selectedCategory;

            return (
              <Pressable
                key={category}
                style={[
                  styles.categoryChip,
                  active && styles.categoryChipActive,
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    active && styles.categoryChipTextActive,
                  ]}
                >
                  {category}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {featuredProducts.length > 0 &&
        selectedCategory === "All" &&
        !searchText.trim() ? (
          <View style={styles.featuredSection}>
            <View style={styles.sectionTitleRow}>
              <View>
                <Text style={styles.sectionTitle}>Featured Fresh Picks</Text>
                <Text style={styles.sectionSubtitle}>
                  New and popular products from nearby farms
                </Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredRow}
            >
              {featuredProducts.map(({ farmer, product }) =>
                renderProductCard(farmer, product, true)
              )}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.sectionTitleRowMain}>
          <View>
            <Text style={styles.sectionTitle}>Nearby Farms</Text>
            <Text style={styles.sectionSubtitle}>
              {filteredFarmers.length} farm
              {filteredFarmers.length === 1 ? "" : "s"} available
            </Text>
          </View>

          {loading && <ActivityIndicator size="small" color={COLORS.primary} />}
        </View>
      </View>
    );
  }

  if (accessChecking) {
    return (
      <View style={styles.loadingPage}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Checking marketplace access...</Text>
      </View>
    );
  }

  if (!accessAllowed) {
    return (
      <View style={styles.loadingPage}>
        <Text style={styles.lockedTitle}>Subscription Required</Text>
        <Text style={styles.loadingText}>Redirecting to subscription page...</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <FlatList
        data={filteredFarmers}
        keyExtractor={(item) => item.id}
        renderItem={renderFarmerRow}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader}
        refreshing={loading}
        onRefresh={loadMarketplace}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🌾</Text>
            <Text style={styles.emptyTitle}>
              {loading ? "Loading marketplace..." : "No active farms found"}
            </Text>
            <Text style={styles.emptySubtitle}>
              Active farms with posted marketplace products will appear here.
            </Text>
          </View>
        }
      />

      <Pressable
        style={({ pressed }) => [
          styles.cartFloating,
          pressed && styles.pressedButton,
        ]}
        onPress={() => router.push("/customer/cart" as any)}
      >
        <Text style={styles.cartFloatingText}>🛒 Cart ({cartCount})</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  loadingPage: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 14,
    color: COLORS.muted,
    fontWeight: "800",
    textAlign: "center",
  },
  lockedTitle: {
    color: COLORS.danger,
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
  },
  listContent: { paddingBottom: 120 },
  topBar: {
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greeting: { color: COLORS.text, fontSize: 24, fontWeight: "900" },
  locationLine: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
  },
  cartTopButton: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cartTopIcon: { fontSize: 24 },
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
    marginHorizontal: 18,
    marginTop: 8,
    borderRadius: 32,
    padding: 22,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    overflow: "hidden",
    minHeight: 190,
  },
  heroTextBlock: { flex: 1, paddingRight: 8 },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    color: "#FFFFFF",
    fontWeight: "900",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    marginBottom: 12,
    overflow: "hidden",
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
  },
  heroSubtitle: {
    color: "#EAF7E6",
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
  },
  heroButton: {
    backgroundColor: COLORS.secondary,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignSelf: "flex-start",
    marginTop: 16,
  },
  heroButtonText: { color: COLORS.dark, fontWeight: "900", fontSize: 14 },
  heroArt: { width: 110, justifyContent: "center", alignItems: "center" },
  heroArtEmoji: { fontSize: 66 },
  heroArtEmojiSmall: { fontSize: 18, marginTop: 10 },
  quickStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 18,
    marginTop: 14,
  },
  quickStat: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickStatValue: { color: COLORS.primary, fontWeight: "900", fontSize: 21 },
  quickStatLabel: {
    color: COLORS.muted,
    fontWeight: "800",
    marginTop: 2,
    fontSize: 12,
  },
  searchBox: {
    marginHorizontal: 18,
    marginTop: 18,
    backgroundColor: COLORS.card,
    borderRadius: 22,
    paddingHorizontal: 16,
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: { fontSize: 18, marginRight: 10 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
  },
  categoryRow: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
    gap: 10,
  },
  categoryChip: {
    backgroundColor: COLORS.card,
    paddingHorizontal: 17,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryChipText: {
    color: COLORS.primary,
    fontWeight: "900",
    fontSize: 14,
  },
  categoryChipTextActive: { color: "#FFFFFF" },
  featuredSection: { marginTop: 8 },
  sectionTitleRow: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  sectionTitleRowMain: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  sectionTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900" },
  sectionSubtitle: {
    color: COLORS.muted,
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
  },
  featuredRow: { paddingLeft: 18, paddingRight: 18, gap: 14 },
  farmSection: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginBottom: 18,
    borderRadius: 28,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  farmMarketRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
  },
  farmSideCard: {
    width: 118,
    backgroundColor: COLORS.lightGreen,
    borderRadius: 24,
    padding: 12,
    alignItems: "center",
    justifyContent: "flex-start",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  farmLogoLarge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: COLORS.softGreen,
    marginBottom: 10,
  },
  logoPlaceholderLarge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: COLORS.softGreen,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  logoPlaceholderText: { fontSize: 31 },
  farmNameSide: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 18,
  },
  farmLocationSide: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 4,
    textAlign: "center",
  },
  farmMetaSide: {
    color: "#9A6A00",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 7,
  },
  viewFarmText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 8,
    textAlign: "center",
  },
  productsRowSide: {
    gap: 14,
    paddingRight: 6,
  },
  productCard: {
    width: 186,
    backgroundColor: COLORS.lightGreen,
    borderRadius: 24,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  featuredProductCard: { width: 178, backgroundColor: COLORS.card },
  productImageWrap: { position: "relative" },
  productImage: {
    width: "100%",
    height: 122,
    borderRadius: 20,
    marginBottom: 10,
    backgroundColor: COLORS.softGreen,
  },
  productPlaceholder: {
    width: "100%",
    height: 122,
    borderRadius: 20,
    backgroundColor: COLORS.softGreen,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  productEmoji: { fontSize: 48 },
  categoryBadge: {
    position: "absolute",
    left: 8,
    bottom: 18,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    maxWidth: 130,
  },
  categoryBadgeText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: "900",
  },
  featuredBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  featuredBadgeText: { color: COLORS.dark, fontSize: 10, fontWeight: "900" },
  productName: { fontWeight: "900", fontSize: 15, color: COLORS.text },
  productFarmName: {
    color: COLORS.muted,
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
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
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  productPrice: { fontWeight: "900", fontSize: 17, color: COLORS.primary },
  productUnit: {
    color: COLORS.muted,
    marginTop: 2,
    fontSize: 11,
    fontWeight: "700",
  },
  addCircleButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  addCircleButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 24,
    marginTop: -2,
  },
  pressedButton: { opacity: 0.75 },
  emptyBox: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginTop: 10,
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  emptyIcon: { fontSize: 42, marginBottom: 12 },
  emptyTitle: {
    fontWeight: "900",
    fontSize: 20,
    color: COLORS.text,
    textAlign: "center",
  },
  emptySubtitle: {
    marginTop: 10,
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 21,
  },
  cartFloating: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: COLORS.dark,
    paddingHorizontal: 23,
    paddingVertical: 16,
    borderRadius: 999,
  },
  cartFloatingText: { color: "#FFFFFF", fontWeight: "900", fontSize: 15 },
});