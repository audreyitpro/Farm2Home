// app/customer/favorites.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
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
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { addToCart } from "../data/cartStore";
import { supabase } from "../data/supabaseClient";

/**
 * app/customer/favorites.tsx
 *
 * Customer favorites screen.
 *
 * Supports:
 * - Favorite farmers
 * - Favorite products
 * - Search/filter
 * - Add favorite product to cart
 * - Remove favorite
 * - Open marketplace/farmer page
 * - Reads/writes Supabase favorite tables when available
 * - Falls back to AsyncStorage if tables are missing
 *
 * Tables attempted:
 * - customer_favorites
 * - favorites
 * - customer_saved_items
 *
 * Recommended table:
 *
 * customer_favorites:
 * id text primary key
 * customer_id text
 * customer_email text
 * type text -- product | farmer
 * farmer_id text
 * farm_name text
 * product_id text
 * product_name text
 * product_image text
 * price numeric
 * unit text
 * category text
 * stripe_account_id text
 * created_at timestamptz
 * updated_at timestamptz
 */

const COLORS = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  redDark: "#9F1117",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  greenDark: "#14532D",
  greenSoft: "#DCFCE7",
  amber: "#F59E0B",
  amberSoft: "#FEF3C7",
  blue: "#2563EB",
  blueSoft: "#DBEAFE",
  purple: "#7C3AED",
  purpleSoft: "#EDE9FE",
  danger: "#DC2626",
  dangerSoft: "#FEE2E2",
  white: "#FFFFFF",
};

type CustomerSession = {
  id?: string;
  customerId?: string;
  customer_id?: string;
  email?: string;
  full_name?: string;
  fullName?: string;
  name?: string;
};

type FavoriteItem = {
  id: string;
  customer_id?: string;
  customerId?: string;
  customer_email?: string;
  customerEmail?: string;
  type: "product" | "farmer" | string;
  farmer_id?: string;
  farmerId?: string;
  farm_name?: string;
  farmName?: string;
  farmer_name?: string;
  farmerName?: string;
  product_id?: string;
  productId?: string;
  product_name?: string;
  productName?: string;
  product_image?: string;
  productImage?: string;
  image?: string;
  imageUrl?: string;
  price?: number;
  unit?: string;
  category?: string;
  stripe_account_id?: string;
  stripeAccountId?: string;
  farmer_stripe_account_id?: string;
  created_at?: string;
  updated_at?: string;
};

const FILTERS = ["All", "Products", "Farmers"];

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function money(value: any) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function getCustomerId(customer: CustomerSession | null) {
  return clean(customer?.id || customer?.customer_id || customer?.customerId);
}

function getCustomerName(customer: CustomerSession | null) {
  return clean(customer?.full_name || customer?.fullName || customer?.name || "Customer");
}

function dateLabel(value: any) {
  const raw = clean(value);
  if (!raw) return "Saved";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getFavoriteType(item: any) {
  const type = normalize(item.type || item.favorite_type || item.favoriteType);
  if (type.includes("farmer") || type.includes("farm")) return "farmer";
  return "product";
}

function getFarmerId(item: any) {
  return clean(item.farmer_id || item.farmerId || item.farm_id || item.farmId);
}

function getFarmName(item: any) {
  return clean(
    item.farm_name ||
      item.farmName ||
      item.farmer_name ||
      item.farmerName ||
      item.name ||
      "Farm2Home Farm"
  );
}

function getProductId(item: any) {
  return clean(item.product_id || item.productId || item.id);
}

function getProductName(item: any) {
  return clean(item.product_name || item.productName || item.name || "Farm Product");
}

function getImage(item: any) {
  return clean(
    item.product_image ||
      item.productImage ||
      item.image_url ||
      item.imageUrl ||
      item.image ||
      ""
  );
}

function getStripeAccount(item: any) {
  return clean(
    item.stripe_account_id ||
      item.stripeAccountId ||
      item.farmer_stripe_account_id ||
      item.farmerStripeAccountId ||
      ""
  );
}

function normalizeFavorite(
  row: any,
  customer: CustomerSession | null = null
): FavoriteItem {
  const type = getFavoriteType(row);
  const customerId =
    getCustomerId(customer) || clean(row.customer_id || row.customerId);
  const productId = getProductId(row);
  const farmerId = getFarmerId(row);
  const farmName = getFarmName(row);

  const id = clean(row.id)
    ? clean(row.id)
    : `favorite_${type}_${customerId || "customer"}_${farmerId || farmName}_${productId || "farm"}`;

  return {
    ...row,
    id,
    customer_id: customerId,
    customerId,
    customer_email: clean(row.customer_email || row.customerEmail || customer?.email),
    customerEmail: clean(row.customer_email || row.customerEmail || customer?.email),
    type,
    farmer_id: farmerId,
    farmerId,
    farm_name: farmName,
    farmName,
    farmer_name: farmName,
    farmerName: farmName,
    product_id: productId,
    productId,
    product_name: getProductName(row),
    productName: getProductName(row),
    product_image: getImage(row),
    productImage: getImage(row),
    image: getImage(row),
    imageUrl: getImage(row),
    price: Number(row.price || row.unit_price || 0),
    unit: clean(row.unit || "each"),
    category: clean(row.category || ""),
    stripe_account_id: getStripeAccount(row),
    stripeAccountId: getStripeAccount(row),
    farmer_stripe_account_id: getStripeAccount(row),
    created_at: clean(row.created_at || row.createdAt || nowIso()),
    updated_at: clean(row.updated_at || row.updatedAt || row.created_at || nowIso()),
  };
}

export default function CustomerFavorites() {
  const [customer, setCustomer] = useState<CustomerSession | null>(null);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadScreen();
    }, [])
  );

  const metrics = useMemo(() => {
    const productCount = favorites.filter((item) => getFavoriteType(item) === "product").length;
    const farmerCount = favorites.filter((item) => getFavoriteType(item) === "farmer").length;

    return {
      total: favorites.length,
      productCount,
      farmerCount,
    };
  }, [favorites]);

  const filteredFavorites = useMemo(() => {
    const query = normalize(searchText);

    return favorites.filter((item) => {
      const type = getFavoriteType(item);

      if (selectedFilter === "Products" && type !== "product") return false;
      if (selectedFilter === "Farmers" && type !== "farmer") return false;

      if (!query) return true;

      const haystack = normalize(
        `${getProductName(item)} ${getFarmName(item)} ${item.category || ""} ${item.unit || ""}`
      );

      return haystack.includes(query);
    });
  }, [favorites, selectedFilter, searchText]);

  async function loadScreen() {
    try {
      setLoading(true);
      const activeCustomer = await loadCustomer();
      await loadFavorites(activeCustomer);
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    try {
      setRefreshing(true);
      const activeCustomer = customer || (await loadCustomer());
      await loadFavorites(activeCustomer);
    } finally {
      setRefreshing(false);
    }
  }

  async function loadCustomer() {
    const stored =
      (await AsyncStorage.getItem("currentCustomer")) ||
      (await AsyncStorage.getItem("farm2homeCurrentCustomer")) ||
      (await AsyncStorage.getItem("currentUser"));

    let localCustomer: CustomerSession | null = null;

    if (stored) {
      try {
        localCustomer = JSON.parse(stored);
        setCustomer(localCustomer);
      } catch {
        localCustomer = null;
      }
    }

    const { data: authData } = await supabase.auth.getUser();
    const authId = clean(authData?.user?.id || "");
    const authEmail = normalize(authData?.user?.email || localCustomer?.email || "");

    if (!authId && !authEmail) return localCustomer;

    const dbCustomer = await fetchCustomer(authId, authEmail);

    if (dbCustomer) {
      const session = {
        ...dbCustomer,
        customerId: dbCustomer.id,
        accountId: dbCustomer.account_id,
      };

      setCustomer(session);

      await AsyncStorage.multiSet([
        ["currentCustomer", JSON.stringify(session)],
        ["farm2homeCurrentCustomer", JSON.stringify(session)],
        ["currentUser", JSON.stringify({ ...session, role: "customer" })],
      ]);

      return session;
    }

    return localCustomer;
  }

  async function fetchCustomer(id?: string, email?: string) {
    const lookupId = clean(id);
    const lookupEmail = normalize(email);

    if (lookupId) {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .or(`id.eq.${lookupId},auth_user_id.eq.${lookupId},profile_id.eq.${lookupId}`)
        .limit(1);

      if (!error && Array.isArray(data) && data[0]) return data[0];
    }

    if (lookupEmail) {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("email", lookupEmail)
        .limit(1);

      if (!error && Array.isArray(data) && data[0]) return data[0];
    }

    return null;
  }

  async function loadFavorites(activeCustomer: CustomerSession | null) {
    const customerId = getCustomerId(activeCustomer);
    const customerEmail = normalize(activeCustomer?.email);
    const loaded: FavoriteItem[] = [];

    const localRaw = await AsyncStorage.getItem("customerFavorites");
    if (localRaw) {
      try {
        const parsed = JSON.parse(localRaw);
        if (Array.isArray(parsed)) {
          loaded.push(...parsed.map((row) => normalizeFavorite(row, activeCustomer)));
        }
      } catch {
        // Ignore invalid cache.
      }
    }

    const tables = ["customer_favorites", "favorites", "customer_saved_items"];

    for (const table of tables) {
      try {
        let query = supabase
          .from(table)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);

        if (customerId && customerEmail) {
          query = query.or(
            `customer_id.eq.${customerId},customerId.eq.${customerId},customer_email.eq.${customerEmail},customerEmail.eq.${customerEmail},email.eq.${customerEmail}`
          );
        } else if (customerId) {
          query = query.or(`customer_id.eq.${customerId},customerId.eq.${customerId}`);
        } else if (customerEmail) {
          query = query.or(
            `customer_email.eq.${customerEmail},customerEmail.eq.${customerEmail},email.eq.${customerEmail}`
          );
        } else {
          continue;
        }

        const { data, error } = await query;

        if (!error && Array.isArray(data)) {
          loaded.push(...data.map((row) => normalizeFavorite(row, activeCustomer)));
          break;
        }
      } catch {
        // Try next table.
      }
    }

    const unique = Array.from(
      new Map(loaded.map((item) => [item.id, item])).values()
    ).sort((a, b) => {
      const ad = new Date(a.created_at || 0).getTime();
      const bd = new Date(b.created_at || 0).getTime();
      return bd - ad;
    });

    setFavorites(unique);
    await AsyncStorage.setItem("customerFavorites", JSON.stringify(unique));
  }

  async function saveFavoritesLocal(next: FavoriteItem[]) {
    setFavorites(next);
    await AsyncStorage.setItem("customerFavorites", JSON.stringify(next));
  }

  async function removeFavorite(item: FavoriteItem) {
    Alert.alert("Remove Favorite", "Remove this saved favorite?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const next = favorites.filter((fav) => fav.id !== item.id);
          await saveFavoritesLocal(next);

          const tables = ["customer_favorites", "favorites", "customer_saved_items"];

          for (const table of tables) {
            try {
              await supabase.from(table).delete().eq("id", item.id);
            } catch {
              // Skip missing table.
            }
          }
        },
      },
    ]);
  }

  async function addProductToCart(item: FavoriteItem) {
    if (getFavoriteType(item) !== "product") {
      openFarmer(item);
      return;
    }

    try {
      await addToCart({
        id: `${getFarmerId(item)}_${getProductId(item)}`,
        cartItemId: `${getFarmerId(item)}_${getProductId(item)}`,
        productId: getProductId(item),
        product_id: getProductId(item),
        name: getProductName(item),
        productName: getProductName(item),
        product_name: getProductName(item),
        price: Number(item.price || 0),
        quantity: 1,
        image: getImage(item),
        imageUrl: getImage(item),
        image_url: getImage(item),
        farmName: getFarmName(item),
        farm_name: getFarmName(item),
        farmerName: getFarmName(item),
        farmerId: getFarmerId(item),
        farmer_id: getFarmerId(item),
        unit: clean(item.unit || "each"),
        category: clean(item.category || ""),
        farmerStripeAccountId: getStripeAccount(item),
        stripeAccountId: getStripeAccount(item),
        farmer_stripe_account_id: getStripeAccount(item),
        stripe_account_id: getStripeAccount(item),
      } as any);

      Alert.alert("Added to Cart", `${getProductName(item)} was added to your cart.`, [
        { text: "Keep Browsing", style: "cancel" },
        { text: "View Cart", onPress: () => router.push("/customer/cart" as any) },
      ]);
    } catch (error: any) {
      Alert.alert("Cart Error", error?.message || "Unable to add favorite to cart.");
    }
  }

  function openFarmer(item: FavoriteItem) {
    router.push({
      pathname: "/customer/marketplace" as any,
      params: {
        farmerId: getFarmerId(item),
        farmName: getFarmName(item),
      },
    });
  }

  function openMarketplace() {
    router.push("/customer/marketplace" as any);
  }

  function renderHeader() {
    return (
      <View>
        <View style={styles.hero}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push("/customer/dashboard" as any)}
            activeOpacity={0.9}
          >
            <Ionicons name="arrow-back-outline" size={18} color={COLORS.white} />
            <Text style={styles.backButtonText}>Dashboard</Text>
          </TouchableOpacity>

          <View style={styles.heroIcon}>
            <Ionicons name="heart-outline" size={34} color={COLORS.white} />
          </View>

          <Text style={styles.kicker}>Saved Farms & Products</Text>
          <Text style={styles.heroTitle}>Favorites</Text>
          <Text style={styles.heroText}>
            Save farmers and products, reorder faster, and keep your favorite local food close.
          </Text>
        </View>

        <View style={styles.metricsRow}>
          <MetricCard icon="heart-outline" label="Saved" value={`${metrics.total}`} tone="red" />
          <MetricCard icon="basket-outline" label="Products" value={`${metrics.productCount}`} tone="green" />
          <MetricCard icon="leaf-outline" label="Farmers" value={`${metrics.farmerCount}`} tone="blue" />
        </View>

        <View style={styles.searchCard}>
          <Ionicons name="search-outline" size={20} color={COLORS.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search favorites..."
            placeholderTextColor="#94A3B8"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText ? (
            <Pressable onPress={() => setSearchText("")}>
              <Ionicons name="close-circle-outline" size={20} color={COLORS.muted} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((filter) => {
            const active = selectedFilter === filter;

            return (
              <Pressable
                key={filter}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setSelectedFilter(filter)}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {filter}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>{selectedFilter} Favorites</Text>
            <Text style={styles.sectionSubtitle}>
              {filteredFavorites.length} saved item
              {filteredFavorites.length === 1 ? "" : "s"} for {getCustomerName(customer)}
            </Text>
          </View>

          <TouchableOpacity style={styles.shopButton} onPress={openMarketplace} activeOpacity={0.9}>
            <Ionicons name="storefront-outline" size={16} color={COLORS.red} />
            <Text style={styles.shopButtonText}>Shop</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderFavorite({ item }: { item: FavoriteItem }) {
    const type = getFavoriteType(item);
    const isProduct = type === "product";
    const image = getImage(item);

    return (
      <View style={styles.favoriteCard}>
        {image ? (
          <Image source={{ uri: image }} style={styles.favoriteImage} />
        ) : (
          <View style={[styles.favoritePlaceholder, isProduct ? styles.productPlaceholder : styles.farmPlaceholder]}>
            <Text style={styles.favoriteInitial}>
              {(isProduct ? getProductName(item) : getFarmName(item)).slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.favoriteContent}>
          <View style={styles.favoriteTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.favoriteTitle} numberOfLines={2}>
                {isProduct ? getProductName(item) : getFarmName(item)}
              </Text>

              <Text style={styles.favoriteSubtitle} numberOfLines={1}>
                {isProduct ? getFarmName(item) : "Favorite farmer"}
              </Text>
            </View>

            <View style={[styles.typeBadge, isProduct ? styles.productBadge : styles.farmerBadge]}>
              <Ionicons
                name={isProduct ? "basket-outline" : "leaf-outline"}
                size={13}
                color={isProduct ? COLORS.greenDark : COLORS.blue}
              />
              <Text style={[styles.typeBadgeText, isProduct ? styles.productBadgeText : styles.farmerBadgeText]}>
                {isProduct ? "Product" : "Farmer"}
              </Text>
            </View>
          </View>

          {isProduct ? (
            <View style={styles.productMetaRow}>
              <Text style={styles.priceText}>
                {money(item.price)}
                {item.unit ? ` / ${item.unit}` : ""}
              </Text>

              {item.category ? (
                <Text style={styles.categoryText}>{item.category}</Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.savedText}>Saved {dateLabel(item.created_at)}</Text>
          )}

          <Text style={styles.accountText} numberOfLines={1}>
            Farmer ID: {getFarmerId(item) || "Not listed"}
          </Text>

          <View style={styles.actionRow}>
            <Pressable
              style={styles.primaryAction}
              onPress={() => (isProduct ? addProductToCart(item) : openFarmer(item))}
            >
              <Ionicons
                name={isProduct ? "cart-outline" : "storefront-outline"}
                size={16}
                color={COLORS.white}
              />
              <Text style={styles.primaryActionText}>
                {isProduct ? "Add to Cart" : "View Farm"}
              </Text>
            </Pressable>

            <Pressable style={styles.secondaryAction} onPress={() => removeFavorite(item)}>
              <Ionicons name="trash-outline" size={16} color={COLORS.red} />
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.red} size="large" />
          <Text style={styles.centerText}>Loading favorites...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <FlatList
        data={filteredFavorites}
        keyExtractor={(item) => item.id}
        renderItem={renderFavorite}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.red} />
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="heart-outline" size={34} color={COLORS.red} />
            </View>
            <Text style={styles.emptyTitle}>No favorites yet</Text>
            <Text style={styles.emptyText}>
              Save farms and products from the marketplace so you can reorder faster.
            </Text>

            <TouchableOpacity style={styles.emptyButton} onPress={openMarketplace}>
              <Text style={styles.emptyButtonText}>Shop Marketplace</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tone: "red" | "green" | "blue";
}) {
  const config = {
    red: { bg: "#FEE2E2", color: COLORS.red },
    green: { bg: COLORS.greenSoft, color: COLORS.green },
    blue: { bg: COLORS.blueSoft, color: COLORS.blue },
  }[tone];

  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: config.bg }]}>
        <Ionicons name={icon} size={20} color={config.color} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  centerText: {
    color: COLORS.muted,
    fontWeight: "800",
  },
  listContent: {
    paddingBottom: 70,
  },
  hero: {
    backgroundColor: COLORS.black,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
  },
  backButton: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.red,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 18,
  },
  backButtonText: {
    color: COLORS.white,
    fontWeight: "900",
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  kicker: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: COLORS.white,
    fontSize: 34,
    fontWeight: "900",
    marginTop: 6,
  },
  heroText: {
    color: "#CBD5E1",
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },
  metricsRow: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: 10,
    paddingHorizontal: 18,
    marginTop: 18,
  },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 14,
  },
  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  metricValue: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
  },
  metricLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 2,
  },
  searchCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginHorizontal: 18,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    color: COLORS.text,
    fontWeight: "800",
  },
  filterRow: {
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 6,
  },
  filterChip: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterChipActive: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },
  filterText: {
    color: COLORS.red,
    fontWeight: "900",
  },
  filterTextActive: {
    color: COLORS.white,
  },
  sectionHeader: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 4,
  },
  shopButton: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  shopButtonText: {
    color: COLORS.red,
    fontWeight: "900",
  },
  favoriteCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 13,
    marginHorizontal: 18,
    marginBottom: 14,
    flexDirection: "row",
    gap: 12,
  },
  favoriteImage: {
    width: 88,
    height: 88,
    borderRadius: 20,
    backgroundColor: COLORS.greenSoft,
  },
  favoritePlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  productPlaceholder: {
    backgroundColor: COLORS.greenSoft,
  },
  farmPlaceholder: {
    backgroundColor: COLORS.blueSoft,
  },
  favoriteInitial: {
    color: COLORS.black,
    fontWeight: "900",
    fontSize: 30,
  },
  favoriteContent: {
    flex: 1,
  },
  favoriteTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  favoriteTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 17,
    lineHeight: 21,
  },
  favoriteSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3,
  },
  typeBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  productBadge: {
    backgroundColor: COLORS.greenSoft,
  },
  farmerBadge: {
    backgroundColor: COLORS.blueSoft,
  },
  typeBadgeText: {
    fontWeight: "900",
    fontSize: 10,
  },
  productBadgeText: {
    color: COLORS.greenDark,
  },
  farmerBadgeText: {
    color: COLORS.blue,
  },
  productMetaRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 8,
  },
  priceText: {
    color: COLORS.red,
    fontWeight: "900",
  },
  categoryText: {
    color: COLORS.muted,
    fontWeight: "800",
    fontSize: 12,
  },
  savedText: {
    color: COLORS.muted,
    fontWeight: "800",
    marginTop: 8,
  },
  accountText: {
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 11,
    marginTop: 6,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 11,
  },
  primaryAction: {
    flex: 1,
    backgroundColor: COLORS.red,
    borderRadius: 15,
    paddingVertical: 11,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  primaryActionText: {
    color: COLORS.white,
    fontWeight: "900",
  },
  secondaryAction: {
    width: 44,
    borderRadius: 15,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 18,
    marginTop: 14,
    alignItems: "center",
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 22,
    marginTop: 8,
  },
  emptyButton: {
    backgroundColor: COLORS.red,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 13,
    marginTop: 18,
  },
  emptyButtonText: {
    color: COLORS.white,
    fontWeight: "900",
  },
});
