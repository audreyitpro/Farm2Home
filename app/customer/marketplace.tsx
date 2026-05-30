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
import { useAuth } from "../providers/AuthProvider";
import { enforceSubscriptionAccess } from "../services/lockoutGuard";

const GREEN_VALLEY_STRIPE_ACCOUNT_ID = "acct_1TWeOKCqJp7Z8L15";
const SUNNYBROOK_STRIPE_ACCOUNT_ID = "acct_1TWjGSE1SmOAMwkt";

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
  "Fresh Produce",
  "Vegetables",
  "Fruits",
  "Organic",
  "Eggs",
  "Honey",
  "Meat",
  "Poultry",
  "Fish Farm / Aquaculture",
  "Dairy",
  "Baked Goods",
  "Flowers",
  "Plants & Herbs",
  "Hay",
  "Bale of Hay",
  "Seasonal",
  "Animal Feed",
  "Herbs",
  "Farm Supplies",
  "Garden Starters",
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
  farmerId?: string;
  farmName?: string;
  farmerStripeAccountId?: string;
  stripeAccountId?: string;
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
  stripeAccountId?: string;
  farmerStripeAccountId?: string;
  products?: Product[];
};

function getFarmerName(farmer: Farmer) {
  return farmer.farmName || farmer.name || "Farm2Home Farm";
}

function getFarmerLocation(farmer: Farmer) {
  return farmer.farmLocation || farmer.location || "Michigan";
}

function getFarmerStripeAccountId(farmer: Farmer, product?: Product) {
  return (
    product?.farmerStripeAccountId ||
    product?.stripeAccountId ||
    farmer.farmerStripeAccountId ||
    farmer.stripeAccountId ||
    GREEN_VALLEY_STRIPE_ACCOUNT_ID
  );
}

function getProductEmoji(product: Product) {
  const category = String(product.category || "").toLowerCase();
  const name = String(product.name || "").toLowerCase();

  if (category.includes("flower") || name.includes("flower")) return "💐";
  if (category.includes("hay") || name.includes("hay")) return "🌾";
  if (category.includes("egg") || name.includes("egg")) return "🥚";
  if (category.includes("honey") || name.includes("honey")) return "🍯";
  if (category.includes("dairy") || name.includes("milk")) return "🥛";
  if (category.includes("meat") || category.includes("poultry")) return "🥩";
  if (category.includes("fruit") || name.includes("apple")) return "🍎";
  if (category.includes("vegetable") || category.includes("greens")) return "🥬";

  return "🥬";
}

function getFallbackFarmers(): Farmer[] {
  return [
    {
      id: "farm_1",
      farmName: "Green Valley Farm",
      location: "Sterling Heights, MI",
      rating: 4.8,
      distanceMiles: 5,
      stripeAccountId: GREEN_VALLEY_STRIPE_ACCOUNT_ID,
      products: [
        { id: "apple_1", name: "Fresh Apples", category: "Fruits", price: 4.99, unit: "bag" },
        { id: "honey_1", name: "Raw Honey", category: "Honey", price: 9.99, unit: "jar" },
        { id: "corn_1", name: "Sweet Corn", category: "Vegetables", price: 3.5, unit: "dozen" },
        { id: "hay_1", name: "Bale of Hay", category: "Bale of Hay", price: 12, unit: "bale" },
        { id: "flowers_1", name: "Fresh Cut Flowers", category: "Flowers", price: 14.99, unit: "bouquet" },
      ],
    },
    {
      id: "farm_2",
      farmName: "Sunnybrook Farm",
      location: "Royal Oak, MI",
      rating: 4.9,
      distanceMiles: 9,
      stripeAccountId: SUNNYBROOK_STRIPE_ACCOUNT_ID,
      products: [
        { id: "egg_1", name: "Farm Eggs", category: "Eggs", price: 5.99, unit: "dozen" },
        { id: "milk_1", name: "Fresh Milk", category: "Dairy", price: 6.5, unit: "gallon" },
        { id: "feed_1", name: "Animal Feed Mix", category: "Animal Feed", price: 18, unit: "bag" },
      ],
    },
  ];
}

function normalizeFarmers(inputFarmers: Farmer[]): Farmer[] {
  return inputFarmers.map((farmer) => {
    let stripeAccountId =
      farmer.stripeAccountId ||
      farmer.farmerStripeAccountId ||
      GREEN_VALLEY_STRIPE_ACCOUNT_ID;

    if (farmer.id === "farm_2" || getFarmerName(farmer).includes("Sunnybrook")) {
      stripeAccountId = SUNNYBROOK_STRIPE_ACCOUNT_ID;
    }

    const farmName = getFarmerName(farmer);

    return {
      ...farmer,
      farmName,
      location: getFarmerLocation(farmer),
      stripeAccountId,
      products: (farmer.products || []).map((product) => ({
        ...product,
        farmerId: product.farmerId || farmer.id,
        farmName: product.farmName || farmName,
        farmerStripeAccountId:
          product.farmerStripeAccountId ||
          product.stripeAccountId ||
          stripeAccountId,
      })),
    };
  });
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
    } catch (error) {
      console.log("Cart count error:", error);
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
    } catch (error) {
      console.log("Marketplace access check error:", error);
      setAccessAllowed(false);
    } finally {
      setAccessChecking(false);
    }
  }, [user?.id, user?.email, profile?.email]);

  const loadMarketplace = useCallback(async () => {
    try {
      setLoading(true);

      const approvedFarmers = (await getApprovedFarmers()) || [];
      const testFarmRaw = await AsyncStorage.getItem("farm2homeFarmers");
      const testFarmers = testFarmRaw ? JSON.parse(testFarmRaw) : [];

      const mergedFarmers: Farmer[] = [
        ...(Array.isArray(approvedFarmers) ? approvedFarmers : []),
        ...(Array.isArray(testFarmers) ? testFarmers : []),
      ];

      const farmersToUse =
        mergedFarmers.length > 0 ? mergedFarmers : getFallbackFarmers();

      const normalizedFarmers = normalizeFarmers(farmersToUse).filter(
        (farmer) => farmer.products && farmer.products.length > 0
      );

      const uniqueFarmers = Array.from(
        new Map(normalizedFarmers.map((farmer) => [farmer.id, farmer])).values()
      );

      setFarmers(uniqueFarmers);
    } catch (error) {
      console.log("Marketplace load error:", error);
      setFarmers(normalizeFarmers(getFallbackFarmers()));
      Alert.alert("Using Test Marketplace", "Test farmers were loaded.");
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
        if (product.category) categorySet.add(product.category);
      });
    });

    return Array.from(new Set([...DEFAULT_CATEGORIES, ...Array.from(categorySet)]));
  }, [farmers]);

  const featuredProducts = useMemo(() => {
    const allProducts: Array<{ farmer: Farmer; product: Product }> = [];

    farmers.forEach((farmer) => {
      (farmer.products || []).forEach((product) => {
        allProducts.push({ farmer, product });
      });
    });

    return allProducts.slice(0, 8);
  }, [farmers]);

  const filteredFarmers = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return farmers
      .map((farmer) => {
        const filteredProducts = (farmer.products || []).filter((product) => {
          const matchesCategory =
            selectedCategory === "All" || product.category === selectedCategory;

          const matchesSearch =
            !search ||
            product.name?.toLowerCase().includes(search) ||
            product.category?.toLowerCase().includes(search) ||
            product.unit?.toLowerCase().includes(search) ||
            farmer.farmName?.toLowerCase().includes(search) ||
            farmer.name?.toLowerCase().includes(search);

          return matchesCategory && matchesSearch;
        });

        return { ...farmer, products: filteredProducts };
      })
      .filter((farmer) => farmer.products && farmer.products.length > 0);
  }, [farmers, selectedCategory, searchText]);

  async function handleAddToCart(farmer: Farmer, product: Product) {
    try {
      const access = await enforceSubscriptionAccess({
        role: "customer",
        userId: user?.id || "",
        email: profile?.email || user?.email || "",
        redirectTo: "/subscription/subscription-locked",
      });

      if (!access.allowed) return;

      const farmerStripeAccountId = getFarmerStripeAccountId(farmer, product);

      if (!farmerStripeAccountId) {
        Alert.alert("Missing Stripe Account", "This farm needs a payout account.");
        return;
      }

      await addToCart({
        id: `${farmer.id}_${product.id}`,
        productId: product.id,
        name: product.name,
        price: Number(product.price || 0),
        quantity: 1,
        image: product.image || product.imageUrl,
        farmName: getFarmerName(farmer),
        farmerId: farmer.id,
        farmerStripeAccountId,
        unit: product.unit || "each",
      } as any);

      await refreshCartCount();

      Alert.alert(
        "Added to Cart",
        `${product.name} added to cart at $${Number(product.price || 0).toFixed(2)}${
          product.unit ? ` / ${product.unit}` : ""
        }.`
      );
    } catch (error) {
      console.log("Add cart error:", error);
      Alert.alert("Error", "Unable to add item to cart.");
    }
  }

  function openFarmerShop(farmer: Farmer) {
    router.push({
      pathname: "/customer/farmer-shop",
      params: { farmerId: farmer.id },
    } as any);
  }

  function renderProductCard(farmer: Farmer, product: Product, compact = false) {
    const imageSource = product.image || product.imageUrl || "";

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

          <View style={styles.organicBadge}>
            <Text style={styles.organicBadgeText}>
              {product.category || "Farm Goods"}
            </Text>
          </View>
        </Pressable>

        <Text style={styles.productName} numberOfLines={1}>
          {product.name}
        </Text>

        <Text style={styles.productFarmName} numberOfLines={1}>
          {getFarmerName(farmer)}
        </Text>

        <View style={styles.priceRow}>
          <View>
            <Text style={styles.productPrice}>
              ${Number(product.price || 0).toFixed(2)}
            </Text>
            <Text style={styles.productUnit}>
              {product.unit ? `per ${product.unit}` : "each"}
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
    return (
      <View style={styles.farmSection}>
        <View style={styles.farmHeader}>
          <Pressable
            style={({ pressed }) => [
              styles.farmIdentity,
              pressed && styles.pressedButton,
            ]}
            onPress={() => openFarmerShop(item)}
          >
            {item.logoUrl ? (
              <Image source={{ uri: item.logoUrl }} style={styles.farmLogo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderText}>🚜</Text>
              </View>
            )}

            <View style={styles.farmTitleBlock}>
              <Text style={styles.farmName}>{getFarmerName(item)}</Text>
              <Text style={styles.farmLocation}>{getFarmerLocation(item)}</Text>

              <View style={styles.farmMetaRow}>
                <Text style={styles.ratingText}>
                  ⭐ {Number(item.rating || 4.8).toFixed(1)}
                </Text>
                <Text style={styles.dot}>•</Text>
                <Text style={styles.distanceText}>
                  {Number(item.distanceMiles || 5).toFixed(1)} mi
                </Text>
              </View>
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.visitFarmButton,
              pressed && styles.pressedButton,
            ]}
            onPress={() => openFarmerShop(item)}
          >
            <Text style={styles.visitFarmButtonText}>View</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.productsRow}
        >
          {(item.products || []).map((product) => renderProductCard(item, product))}
        </ScrollView>
      </View>
    );
  }

  function renderHeader() {
    return (
      <View>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.greeting}>Welcome to Farm2Home</Text>
            <Text style={styles.locationLine}>Fresh local farm goods near you</Text>
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
            <Text style={styles.heroTitle}>Farm goods delivered to your door</Text>
            <Text style={styles.heroSubtitle}>
              Shop produce, eggs, dairy, honey, flowers, hay, and supplies from trusted local farmers.
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
            <Text style={styles.heroArtEmojiSmall}>🍯 🥚 🌽</Text>
          </View>
        </View>

        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔎</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search produce, farm, flowers, hay..."
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

        {featuredProducts.length > 0 && selectedCategory === "All" && !searchText.trim() && (
          <View style={styles.featuredSection}>
            <View style={styles.sectionTitleRow}>
              <View>
                <Text style={styles.sectionTitle}>Featured Fresh Picks</Text>
                <Text style={styles.sectionSubtitle}>Popular products from nearby farms</Text>
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
        )}

        <View style={styles.sectionTitleRowMain}>
          <View>
            <Text style={styles.sectionTitle}>Nearby Farms</Text>
            <Text style={styles.sectionSubtitle}>
              {filteredFarmers.length} farm{filteredFarmers.length === 1 ? "" : "s"} available
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
        <Text style={styles.loadingText}>Checking subscription access...</Text>
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
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🌾</Text>
            <Text style={styles.emptyTitle}>
              {loading ? "Loading marketplace..." : "No farmers found"}
            </Text>
            <Text style={styles.emptySubtitle}>
              Try another search, select a different category, or check back later.
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
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
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
  listContent: {
    paddingBottom: 120,
  },
  topBar: {
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greeting: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "900",
  },
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
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cartTopIcon: {
    fontSize: 24,
  },
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
  cartBadgeText: {
    color: COLORS.dark,
    fontWeight: "900",
    fontSize: 12,
  },
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
  heroTextBlock: {
    flex: 1,
    paddingRight: 8,
  },
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
  heroButtonText: {
    color: COLORS.dark,
    fontWeight: "900",
    fontSize: 14,
  },
  heroArt: {
    width: 110,
    justifyContent: "center",
    alignItems: "center",
  },
  heroArtEmoji: {
    fontSize: 66,
  },
  heroArtEmojiSmall: {
    fontSize: 18,
    marginTop: 10,
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
  searchIcon: {
    fontSize: 18,
    marginRight: 10,
  },
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
  categoryChipTextActive: {
    color: "#FFFFFF",
  },
  featuredSection: {
    marginTop: 8,
  },
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
  sectionTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: COLORS.muted,
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
  },
  featuredRow: {
    paddingLeft: 18,
    paddingRight: 18,
    gap: 14,
  },
  farmSection: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginBottom: 18,
    borderRadius: 28,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  farmHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  farmIdentity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 10,
  },
  farmLogo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    marginRight: 12,
  },
  logoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.softGreen,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  logoPlaceholderText: {
    fontSize: 31,
  },
  farmTitleBlock: {
    flex: 1,
  },
  farmName: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
  },
  farmLocation: {
    color: COLORS.muted,
    marginTop: 3,
    fontSize: 13,
    fontWeight: "700",
  },
  farmMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 7,
  },
  ratingText: {
    color: "#9A6A00",
    fontWeight: "900",
    fontSize: 13,
  },
  dot: {
    color: COLORS.muted,
    fontWeight: "900",
    marginHorizontal: 7,
  },
  distanceText: {
    color: COLORS.primary,
    fontWeight: "900",
    fontSize: 13,
  },
  visitFarmButton: {
    backgroundColor: COLORS.lightGreen,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  visitFarmButtonText: {
    color: COLORS.primary,
    fontWeight: "900",
    fontSize: 13,
  },
  productsRow: {
    gap: 14,
    paddingRight: 6,
  },
  productCard: {
    width: 178,
    backgroundColor: COLORS.lightGreen,
    borderRadius: 24,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  featuredProductCard: {
    width: 170,
    backgroundColor: COLORS.card,
  },
  productImageWrap: {
    position: "relative",
  },
  productImage: {
    width: "100%",
    height: 116,
    borderRadius: 20,
    marginBottom: 10,
    backgroundColor: COLORS.softGreen,
  },
  productPlaceholder: {
    width: "100%",
    height: 116,
    borderRadius: 20,
    backgroundColor: COLORS.softGreen,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  productEmoji: {
    fontSize: 48,
  },
  organicBadge: {
    position: "absolute",
    left: 8,
    bottom: 18,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    maxWidth: 130,
  },
  organicBadgeText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: "900",
  },
  productName: {
    fontWeight: "900",
    fontSize: 15,
    color: COLORS.text,
  },
  productFarmName: {
    color: COLORS.muted,
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
  },
  priceRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  productPrice: {
    fontWeight: "900",
    fontSize: 17,
    color: COLORS.primary,
  },
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
  pressedButton: {
    opacity: 0.75,
  },
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
  emptyIcon: {
    fontSize: 42,
    marginBottom: 12,
  },
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
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  cartFloatingText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },
});