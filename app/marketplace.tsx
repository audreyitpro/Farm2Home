import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";

import { Farmer, Product, getApprovedFarmers } from "./data/farmerStore";
import { addToCart } from "./data/cartStore";

type MarketplaceProduct = Product & {
  imageUrl?: string;
  image?: string;
  image_url?: string;
  category?: string;
  description?: string;
  unit?: string;
};

type MarketplaceFarmer = Farmer & {
  farmName?: string;
  farm_name?: string;
  name?: string;
  logoUrl?: string;
  logo_url?: string;
  imageUrl?: string;
  image_url?: string;
  rating?: number | string;
  distanceMiles?: number | string;
  distance_miles?: number | string;
  location?: string;
  farmLocation?: string;
  products?: MarketplaceProduct[];
};

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getFarmerName(farmer: MarketplaceFarmer): string {
  return farmer.farmName || farmer.farm_name || farmer.name || "Local Farm";
}

function getFarmerLogo(farmer: MarketplaceFarmer): string {
  return (
    farmer.logoUrl ||
    farmer.logo_url ||
    farmer.imageUrl ||
    farmer.image_url ||
    ""
  );
}

function getFarmerLocation(farmer: MarketplaceFarmer): string {
  return farmer.farmLocation || farmer.location || "Local Farm Area";
}

function getFarmerRating(farmer: MarketplaceFarmer): number {
  return toNumber(farmer.rating, 4.8);
}

function getFarmerDistance(farmer: MarketplaceFarmer): number {
  return toNumber(farmer.distanceMiles || farmer.distance_miles, 0);
}

function getProductImage(product: MarketplaceProduct): string {
  return product.imageUrl || product.image_url || product.image || "";
}

export default function MarketplaceScreen() {
  const [farmers, setFarmers] = useState<MarketplaceFarmer[]>([]);
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(false);

  const loadMarketplace = useCallback(async () => {
    try {
      setLoading(true);

      const farmersData = await getApprovedFarmers();

      console.log(
        "MARKETPLACE FARMERS:",
        JSON.stringify(farmersData, null, 2)
      );

      setFarmers(Array.isArray(farmersData) ? (farmersData as any) : []);
    } catch (error) {
      console.log("Marketplace load error:", error);
      Alert.alert("Error", "Unable to load marketplace right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMarketplace();
  }, [loadMarketplace]);

  const categories = useMemo(() => {
    const allProducts = farmers.flatMap((farmer) =>
      Array.isArray(farmer.products) ? farmer.products : []
    );

    const unique = Array.from(
      new Set(
        allProducts
          .map((item) => item.category || "Fresh Produce")
          .filter(Boolean)
      )
    );

    return ["All", ...unique];
  }, [farmers]);

  const filteredFarmers = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return farmers
      .map((farmer) => {
        const farmerName = getFarmerName(farmer);

        const products = Array.isArray(farmer.products)
          ? farmer.products
          : [];

        const filteredProducts = products.filter((product) => {
          const category = product.category || "Fresh Produce";

          const matchesCategory =
            selectedCategory === "All" || category === selectedCategory;

          const matchesSearch =
            !search ||
            farmerName.toLowerCase().includes(search) ||
            String(product.name || "").toLowerCase().includes(search) ||
            String(product.description || "").toLowerCase().includes(search) ||
            String(category).toLowerCase().includes(search);

          return matchesCategory && matchesSearch;
        });

        return {
          ...farmer,
          products: filteredProducts,
        };
      })
      .filter((farmer) => {
        const farmerName = getFarmerName(farmer).toLowerCase();

        return (
          !search ||
          farmerName.includes(search) ||
          (farmer.products || []).length > 0
        );
      });
  }, [farmers, searchText, selectedCategory]);

  async function handleAddToCart(
    farmer: MarketplaceFarmer,
    product: MarketplaceProduct
  ) {
    try {
      await addToCart({
        id: `${farmer.id}_${product.id}`,
        name: String(product.name || "Farm Product"),
        price: Number(product.price || 0),
        image: getProductImage(product),
        quantity: 1,
        farmName: getFarmerName(farmer),
      });

      Alert.alert("Added to Cart", `${product.name} was added to your cart.`);
    } catch (error) {
      console.log("Add cart error:", error);
      Alert.alert("Error", "Unable to add item to cart.");
    }
  }

  function renderProductCard(
    farmer: MarketplaceFarmer,
    product: MarketplaceProduct
  ) {
    const imageSource = getProductImage(product);

    return (
      <View key={String(product.id)} style={styles.productCard}>
        {imageSource ? (
          <Image source={{ uri: imageSource }} style={styles.productImage} />
        ) : (
          <View style={styles.productPlaceholder}>
            <Text style={styles.productEmoji}>🥬</Text>
          </View>
        )}

        <Text style={styles.productName} numberOfLines={1}>
          {product.name}
        </Text>

        <Text style={styles.productCategory} numberOfLines={1}>
          {product.category || "Fresh Produce"}
        </Text>

        <View style={styles.priceRow}>
          <Text style={styles.price}>
            ${Number(product.price || 0).toFixed(2)}
          </Text>

          <Text style={styles.unit}>/{product.unit || "each"}</Text>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => handleAddToCart(farmer, product)}
        >
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderFarmerRow({ item }: { item: MarketplaceFarmer }) {
    const logo = getFarmerLogo(item);
    const farmName = getFarmerName(item);
    const rating = getFarmerRating(item);
    const distance = getFarmerDistance(item);
    const products = item.products || [];

    return (
      <View style={styles.farmerRowCard}>
        <View style={styles.farmerInfoColumn}>
          {logo ? (
            <Image source={{ uri: logo }} style={styles.farmerLogo} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoEmoji}>🚜</Text>
            </View>
          )}

          <Text style={styles.farmName} numberOfLines={2}>
            {farmName}
          </Text>

          <Text style={styles.location} numberOfLines={2}>
            {getFarmerLocation(item)}
          </Text>

          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>⭐ {rating.toFixed(1)}</Text>
          </View>

          <Text style={styles.distance}>
            {distance > 0 ? `${distance.toFixed(1)} mi away` : "Nearby"}
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.productsRow}
        >
          {products.length > 0 ? (
            products.map((product) => renderProductCard(item, product))
          ) : (
            <View style={styles.noProductsCard}>
              <Text style={styles.noProductsTitle}>No matching products</Text>

              <Text style={styles.noProductsText}>
                Try another category or search.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <FlatList
        data={filteredFarmers}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderFarmerRow}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.hero}>
              <Image
                source={require("../assets/images/farm-marketplace-hero.png")}
                style={styles.heroImage}
              />

              <View style={styles.heroOverlay}>
                <Text style={styles.logo}>🌾 Farm2Home</Text>

                <Text style={styles.title}>Shop Fresh Farm Goods</Text>

                <Text style={styles.subtitle}>
                  Fresh fruit, vegetables, eggs, dairy, meats, and farm goods
                  directly from nearby farmers.
                </Text>

                <TouchableOpacity
                  style={styles.cartButton}
                  onPress={() => router.push("/customer/cart" as any)}
                >
                  <Text style={styles.cartButtonText}>View Cart</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Search produce, farm, or category"
              placeholderTextColor="#6B7280"
              value={searchText}
              onChangeText={setSearchText}
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryRow}
            >
              {categories.map((category) => {
                const active = selectedCategory === category;

                return (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.categoryChip,
                      active && styles.categoryChipActive,
                    ]}
                    onPress={() => setSelectedCategory(category)}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        active && styles.categoryTextActive,
                      ]}
                    >
                      {category}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {loading ? "Loading marketplace..." : "No farmers found"}
            </Text>

            <Text style={styles.emptyText}>
              {loading
                ? "Checking approved farmers and products."
                : "Try another search or check back later."}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F7F7F2",
  },

  header: {
    padding: 18,
    paddingBottom: 10,
  },

  hero: {
    height: 240,
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: 14,
    backgroundColor: "#064E3B",
  },

  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },

  heroOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.48)",
    padding: 20,
    justifyContent: "center",
  },

  logo: {
    fontSize: 18,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 8,
  },

  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 8,
    textShadowColor: "rgba(0,0,0,0.65)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },

  subtitle: {
    color: "#F9FAFB",
    fontWeight: "800",
    lineHeight: 22,
    fontSize: 15,
    textShadowColor: "rgba(0,0,0,0.65)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },

  cartButton: {
    backgroundColor: "#2F7D32",
    padding: 14,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },

  cartButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  searchInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 18,
    padding: 15,
    color: "#111827",
    fontWeight: "700",
    marginBottom: 12,
  },

  categoryRow: {
    gap: 10,
    paddingBottom: 8,
  },

  categoryChip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#C7D2C9",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  categoryChipActive: {
    backgroundColor: "#2F7D32",
    borderColor: "#2F7D32",
  },

  categoryText: {
    color: "#2F7D32",
    fontWeight: "900",
  },

  categoryTextActive: {
    color: "#FFFFFF",
  },

  listContent: {
    paddingBottom: 40,
  },

  farmerRowCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginHorizontal: 18,
    marginBottom: 16,
    padding: 14,
  },

  farmerInfoColumn: {
    width: 130,
    marginRight: 12,
  },

  farmerLogo: {
    width: 78,
    height: 78,
    borderRadius: 18,
    backgroundColor: "#E5E7EB",
    marginBottom: 10,
  },

  logoPlaceholder: {
    width: 78,
    height: 78,
    borderRadius: 18,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  logoEmoji: {
    fontSize: 34,
  },

  farmName: {
    color: "#064E3B",
    fontSize: 16,
    fontWeight: "900",
  },

  location: {
    color: "#4B5563",
    fontWeight: "700",
    fontSize: 12,
    marginTop: 4,
  },

  ratingBadge: {
    backgroundColor: "#FEF3C7",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
    marginTop: 8,
  },

  ratingText: {
    color: "#92400E",
    fontWeight: "900",
    fontSize: 12,
  },

  distance: {
    color: "#1F7A3F",
    fontWeight: "900",
    fontSize: 12,
    marginTop: 7,
  },

  productsRow: {
    gap: 12,
    paddingRight: 4,
  },

  productCard: {
    width: 150,
    backgroundColor: "#F9FAFB",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 10,
  },

  productImage: {
    width: "100%",
    height: 86,
    borderRadius: 14,
    backgroundColor: "#E5E7EB",
    marginBottom: 8,
  },

  productPlaceholder: {
    width: "100%",
    height: 86,
    borderRadius: 14,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  productEmoji: {
    fontSize: 36,
  },

  productName: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 15,
  },

  productCategory: {
    color: "#6B7280",
    fontWeight: "700",
    fontSize: 12,
    marginTop: 2,
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 8,
  },

  price: {
    color: "#064E3B",
    fontSize: 17,
    fontWeight: "900",
  },

  unit: {
    color: "#6B7280",
    fontWeight: "700",
    fontSize: 11,
    marginBottom: 2,
    marginLeft: 2,
  },

  addButton: {
    backgroundColor: "#2F7D32",
    borderRadius: 13,
    padding: 10,
    alignItems: "center",
    marginTop: 10,
  },

  addButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  noProductsCard: {
    width: 190,
    backgroundColor: "#F9FAFB",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    justifyContent: "center",
  },

  noProductsTitle: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 16,
  },

  noProductsText: {
    color: "#6B7280",
    fontWeight: "700",
    marginTop: 6,
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    margin: 18,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 6,
  },

  emptyText: {
    color: "#4B5563",
    fontWeight: "700",
    lineHeight: 21,
  },
});