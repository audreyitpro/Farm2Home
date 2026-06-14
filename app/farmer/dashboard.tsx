// app/farmer/dashboard.tsx

import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";

import { Product, updateFarmerProductStock } from "../data/farmerStore";
import { supabase } from "../data/supabaseClient";

const COLORS = {
  bg: "#F6F8F2",
  card: "#FFFFFF",
  text: "#132016",
  muted: "#6F7A6A",
  border: "#E3E9DA",
  primary: "#2E7D32",
  primaryDark: "#14532D",
  greenSoft: "#EAF6E8",
  yellow: "#F9A825",
  orange: "#EF6C00",
  redSoft: "#FEE2E2",
  redText: "#991B1B",
  blue: "#1565C0",
  purple: "#7C3AED",
  dark: "#111827",
  stripe: "#635BFF",
};

const reviews = [
  { id: 1, customer: "Angela", rating: 5, text: "Fresh eggs and fast pickup!" },
  { id: 2, customer: "Marcus", rating: 5, text: "Great greens. Very fresh." },
  { id: 3, customer: "Tanya", rating: 4, text: "Good quality and friendly farmer." },
];

function cleanProducts(items: Product[]) {
  return (items || []).filter((item: any) => {
    const name = String(item?.name || "").trim().toLowerCase();
    return name && name !== "farm product" && name !== "undefined" && name !== "null";
  });
}

function cleanNumber(value: string) {
  return String(value || "").replace(/[^0-9.]/g, "");
}

function getStock(product: any) {
  return Number(product.stock ?? product.quantity ?? product.inventory ?? 0);
}

function getThreshold(product: any) {
  return Number(product.lowStockThreshold ?? product.low_stock_threshold ?? 5);
}

function getProductImage(product: any) {
  return (
    product.image ||
    product.imageUrl ||
    product.image_url ||
    "https://images.unsplash.com/photo-1542838132-92c53300491e"
  );
}

function getStockStatus(product: Product) {
  const stock = getStock(product);
  const threshold = getThreshold(product);

  if (stock <= 0) return "soldout";
  if (stock <= threshold) return "critical";
  if (stock <= threshold + 3) return "warning";
  return "available";
}

export default function FarmerDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [farmName, setFarmName] = useState("My Farm");
  const [farmerId, setFarmerId] = useState("");
  const [farmerEmail, setFarmerEmail] = useState("");
  const [restockAmounts, setRestockAmounts] = useState<Record<string, string>>({});
  const [removeAmounts, setRemoveAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      loadFarmerProducts();
    }, [])
  );

  async function saveProductsLocally(updatedProducts: Product[]) {
    const cleaned = cleanProducts(updatedProducts);

    const saved =
      (await AsyncStorage.getItem("currentFarmer")) ||
      (await AsyncStorage.getItem("currentUser"));

    const current = saved ? JSON.parse(saved) : {};

    const updatedFarmer = {
      ...current,
      id: current.id || farmerId,
      farmerId: current.farmerId || current.id || farmerId,
      products: cleaned,
      updatedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem("currentFarmer", JSON.stringify(updatedFarmer));
    await AsyncStorage.setItem("currentUser", JSON.stringify(updatedFarmer));
    await AsyncStorage.setItem("userRole", "farmer");
    await AsyncStorage.setItem("currentUserRole", "farmer");
  }

  async function saveProductsToSupabase(updatedProducts: Product[]) {
    if (!farmerId) return;

    const { error } = await supabase
      .from("farmers")
      .update({
        products: cleanProducts(updatedProducts),
        updated_at: new Date().toISOString(),
      })
      .eq("id", farmerId);

    if (error) console.log("Save farmer products error:", error.message);
  }

  async function loadFarmerProducts() {
    try {
      setLoading(true);

      const saved =
        (await AsyncStorage.getItem("currentFarmer")) ||
        (await AsyncStorage.getItem("currentUser"));

      if (!saved) {
        router.replace("/farmer/login" as any);
        return;
      }

      const localFarmer = JSON.parse(saved);
      const id = localFarmer.id || localFarmer.farmerId || "";

      if (!id) {
        Alert.alert("Session Error", "Please login again.");
        router.replace("/farmer/login" as any);
        return;
      }

      setFarmerId(id);
      setFarmerEmail(localFarmer.email || "");
      setFarmName(
        localFarmer.farmName ||
          localFarmer.businessName ||
          localFarmer.business_name ||
          localFarmer.farm_name ||
          "My Farm"
      );

      let newestProducts = cleanProducts(localFarmer.products || []);
      let newestFarmer = localFarmer;

      const { data, error } = await supabase
        .from("farmers")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (!error && data) {
        newestFarmer = {
          ...localFarmer,
          ...data,
          id: data.id,
          farmerId: data.id,
        };

        const supabaseProducts = cleanProducts(data.products || []);

        if (supabaseProducts.length > 0) {
          newestProducts = supabaseProducts;
        }
      }

      const fixedFarmer = {
        ...newestFarmer,
        id,
        farmerId: id,
        role: "farmer",
        products: newestProducts,
        approved: true,
        reviewed: true,
        rejected: false,
        accountActive: true,
        account_active: true,
        storeUnlocked: true,
        store_unlocked: true,
        complianceStatus: "ACTIVE",
        compliance_status: "ACTIVE",
        adminReviewStatus: "DOCUMENT_REVIEW_ONLY",
        admin_review_status: "DOCUMENT_REVIEW_ONLY",
        updatedAt: new Date().toISOString(),
      };

      setFarmName(
        fixedFarmer.farmName ||
          fixedFarmer.businessName ||
          fixedFarmer.business_name ||
          fixedFarmer.farm_name ||
          "My Farm"
      );

      setFarmerEmail(fixedFarmer.email || "");
      setProducts(newestProducts);

      await AsyncStorage.setItem("currentFarmer", JSON.stringify(fixedFarmer));
      await AsyncStorage.setItem("currentUser", JSON.stringify(fixedFarmer));
      await AsyncStorage.setItem("userRole", "farmer");
      await AsyncStorage.setItem("currentUserRole", "farmer");
    } catch (error) {
      console.log("Dashboard load error:", error);
      Alert.alert("Dashboard Error", "Unable to load farmer dashboard.");
    } finally {
      setLoading(false);
    }
  }

  async function updateProductStockInSupabase(product: any, newStock: number) {
    const productId = String(product?.id || "");
    const productName = String(product?.name || "").trim();

    const payload = {
      stock: newStock,
      quantity: newStock,
      inventory: newStock,
      is_sold_out: newStock <= 0,
      available: newStock > 0,
      active: true,
      marketplace_visible: newStock > 0,
      updated_at: new Date().toISOString(),
    };

    if (productId) {
      const { error } = await supabase.from("products").update(payload).eq("id", productId);
      if (!error) return;
      console.log("Update stock by id failed:", error.message);
    }

    if (farmerId && productName) {
      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("farmer_id", farmerId)
        .eq("name", productName);

      if (error) console.log("Update stock by farmer/name failed:", error.message);
    }
  }

  async function hideProductInSupabase(product: any) {
    const productId = String(product?.id || "");
    const productName = String(product?.name || "").trim();

    const payload = {
      active: false,
      available: false,
      marketplace_visible: false,
      removed_from_inventory: true,
      updated_at: new Date().toISOString(),
    };

    if (productId) {
      const { error } = await supabase.from("products").update(payload).eq("id", productId);
      if (!error) return;
      console.log("Hide product by id failed:", error.message);
    }

    if (farmerId && productName) {
      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("farmer_id", farmerId)
        .eq("name", productName);

      if (error) console.log("Hide product by farmer/name failed:", error.message);
    }
  }

  async function logoutFarmer() {
    await AsyncStorage.removeItem("currentFarmer");
    await AsyncStorage.removeItem("currentUser");
    await AsyncStorage.removeItem("userRole");
    await AsyncStorage.removeItem("currentUserRole");
    router.replace("/farmer/login" as any);
  }

  function goTo(pathname: string) {
    router.push(pathname as any);
  }

  async function restockProduct(productId: string) {
    const amount = Number(cleanNumber(restockAmounts[productId] || "0"));

    if (!amount || amount <= 0) {
      Alert.alert("Invalid Restock", "Enter a valid restock amount.");
      return;
    }

    const product = products.find((item: any) => String(item.id) === String(productId));
    if (!product) return;

    try {
      await updateFarmerProductStock(farmerId, productId, amount, farmerEmail || "farmer").catch(
        () => {}
      );

      const updatedProducts = cleanProducts(
        products.map((item: any) => {
          if (String(item.id) !== String(productId)) return item;

          const newStock = getStock(item) + amount;

          return {
            ...item,
            stock: newStock,
            quantity: newStock,
            inventory: newStock,
            isSoldOut: newStock <= 0,
            is_sold_out: newStock <= 0,
            available: newStock > 0,
            active: true,
            marketplace_visible: newStock > 0,
            updatedAt: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        })
      );

      setProducts(updatedProducts);
      await saveProductsLocally(updatedProducts);
      await saveProductsToSupabase(updatedProducts);

      const updatedItem = updatedProducts.find((item: any) => String(item.id) === String(productId));
      if (updatedItem) await updateProductStockInSupabase(updatedItem, getStock(updatedItem));

      setRestockAmounts((prev) => ({ ...prev, [productId]: "" }));
      Alert.alert("Inventory Updated", "Inventory was added.");
    } catch (error: any) {
      Alert.alert("Inventory Error", error?.message || "Unable to add inventory.");
    }
  }

  async function removeInventory(productId: string) {
    const amount = Number(cleanNumber(removeAmounts[productId] || "0"));

    if (!amount || amount <= 0) {
      Alert.alert("Invalid Amount", "Enter quantity to remove.");
      return;
    }

    const product = products.find((item: any) => String(item.id) === String(productId));
    if (!product) return;

    try {
      const currentStock = getStock(product);
      const removeQty = Math.min(amount, currentStock);
      const newStock = Math.max(currentStock - removeQty, 0);

      const updatedProducts = cleanProducts(
        products.map((item: any) => {
          if (String(item.id) !== String(productId)) return item;

          return {
            ...item,
            stock: newStock,
            quantity: newStock,
            inventory: newStock,
            isSoldOut: newStock <= 0,
            is_sold_out: newStock <= 0,
            available: newStock > 0,
            active: true,
            marketplace_visible: newStock > 0,
            updatedAt: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        })
      );

      setProducts(updatedProducts);
      await saveProductsLocally(updatedProducts);
      await saveProductsToSupabase(updatedProducts);
      await updateProductStockInSupabase(product, newStock);

      setRemoveAmounts((prev) => ({ ...prev, [productId]: "" }));
      Alert.alert("Inventory Updated", `${product.name} stock was reduced by ${removeQty}.`);
    } catch (error: any) {
      Alert.alert("Inventory Error", error?.message || "Unable to remove inventory.");
    }
  }

  async function deleteProduct(productId: string) {
    const product = products.find((item: any) => String(item.id) === String(productId));

    if (!product) {
      Alert.alert("Product Not Found", "This product could not be found.");
      return;
    }

    Alert.alert(
      "Remove Product",
      `Remove ${product.name || "this product"} from farm inventory and marketplace?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const updatedProducts = cleanProducts(
              products.filter((item: any) => String(item.id) !== String(productId))
            );

            setProducts(updatedProducts);
            await saveProductsLocally(updatedProducts);
            await saveProductsToSupabase(updatedProducts);
            await hideProductInSupabase(product);

            Alert.alert("Product Removed", "Product was removed from farm inventory.");
          },
        },
      ]
    );
  }

  const visibleProducts = cleanProducts(products);
  const totalStock = visibleProducts.reduce((sum, item) => sum + getStock(item), 0);
  const totalSold = visibleProducts.reduce((sum, item: any) => sum + Number(item.sold || 0), 0);
  const totalSales = visibleProducts.reduce(
    (sum, item: any) => sum + Number(item.grossSales || 0),
    0
  );
  const lowStock = visibleProducts.filter((item) => {
    const status = getStockStatus(item);
    return status === "warning" || status === "critical";
  });
  const soldOut = visibleProducts.filter((item) => getStockStatus(item) === "soldout");

  if (loading) {
    return (
      <View style={styles.centerPage}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading farmer dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>Farm2Home Farmer Center</Text>
              <Text style={styles.heroTitle}>{farmName}</Text>
              <Text style={styles.heroSubtitle}>
                Manage products, inventory, orders, staff drivers, dispatch, and delivery.
              </Text>
            </View>

            <Pressable style={styles.logoutButton} onPress={logoutFarmer}>
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </View>

          <View style={styles.statusPill}>
            <Text style={styles.statusDot}>●</Text>
            <Text style={styles.statusText}>Active / Store Open</Text>
          </View>

          <View style={styles.heroStats}>
            <HeroStat value={String(visibleProducts.length)} label="Products" />
            <HeroStat value={String(totalStock)} label="Units" />
            <HeroStat value={`$${totalSales.toFixed(0)}`} label="Sales" />
          </View>
        </View>

        <View style={styles.quickActions}>
          <ActionButton label="Select Produce" icon="🥬" onPress={() => goTo("/farmer/select-produce")} />
          <ActionButton label="Add Product" icon="➕" onPress={() => goTo("/farmer/add-product")} />
          <ActionButton label="Store Setup" icon="🏪" onPress={() => goTo("/farmer/setup-store")} />
          <ActionButton label="Orders" icon="📦" onPress={() => goTo("/farmer/orders")} />
          <ActionButton label="Delivery" icon="🚚" onPress={() => goTo("/farmer/delivery-orders")} />
          <ActionButton label="Staff Drivers" icon="👥" onPress={() => goTo("/farmer/farmer-drivers")} />
          <ActionButton label="Dispatch" icon="📍" onPress={() => goTo("/farmer/delivery-orders")} />
          <ActionButton label="Payouts" icon="💳" onPress={() => goTo("/farmer/connect-bank")} />
        </View>

        <View style={styles.driverOpsCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.driverOpsKicker}>Driver Operations</Text>
            <Text style={styles.driverOpsTitle}>Manage personal staff drivers</Text>
            <Text style={styles.driverOpsText}>
              Add drivers on staff, view preferred drivers, and dispatch delivery orders before posting to the open Driver Board.
            </Text>
          </View>

          <Pressable style={styles.driverOpsButton} onPress={() => goTo("/farmer/farmer-drivers")}>
            <Text style={styles.driverOpsButtonText}>Open</Text>
          </Pressable>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Products Listed" value={String(visibleProducts.length)} />
          <StatCard label="Total Inventory" value={String(totalStock)} />
          <StatCard label="Units Sold" value={String(totalSold)} />
          <StatCard label="Gross Sales" value={`$${totalSales.toFixed(2)}`} />
          <StatCard label="Low Stock" value={String(lowStock.length)} />
          <StatCard label="Sold Out" value={String(soldOut.length)} />
        </View>

        <Text style={styles.sectionTitle}>Farm Inventory</Text>
        <Text style={styles.sectionSub}>
          Reduce stock with Remove Inventory. Delete unwanted items with Remove Product.
        </Text>

        {visibleProducts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🥬</Text>
            <Text style={styles.emptyTitle}>No products listed yet</Text>
            <Text style={styles.emptyText}>Select produce or add a custom farm product.</Text>

            <Pressable style={styles.primaryButton} onPress={() => goTo("/farmer/select-produce")}>
              <Text style={styles.primaryButtonText}>Select Produce</Text>
            </Pressable>
          </View>
        ) : (
          visibleProducts.map((item: any) => {
            const stock = getStock(item);
            const threshold = getThreshold(item);
            const status = getStockStatus(item);

            return (
              <View key={item.id || item.name} style={styles.productCard}>
                <Image source={{ uri: getProductImage(item) }} style={styles.productImage} />

                <View style={styles.productBody}>
                  <View style={styles.productTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productName}>{item.name}</Text>
                      <Text style={styles.productCategory}>{item.category || "Farm Goods"}</Text>
                    </View>

                    <Text style={[styles.badge, getBadgeStyle(status)]}>{getBadgeText(status)}</Text>
                  </View>

                  <View style={styles.stockBox}>
                    <View>
                      <Text style={styles.stockLabel}>Current Stock</Text>
                      <Text style={styles.stockValue}>
                        {stock} {item.unit || "each"}
                      </Text>
                    </View>
                    <View style={styles.thresholdBox}>
                      <Text style={styles.thresholdLabel}>Low Alert</Text>
                      <Text style={styles.thresholdValue}>{threshold}</Text>
                    </View>
                  </View>

                  <View style={styles.detailGrid}>
                    <Detail label="Price" value={`$${Number(item.price || 0).toFixed(2)}`} />
                    <Detail label="Sold" value={String(Number(item.sold || 0))} />
                    <Detail label="Gross" value={`$${Number(item.grossSales || item.gross_sales || 0).toFixed(2)}`} />
                    <Detail label="Delivery" value={item.deliveryOption || item.delivery_option || "Not set"} />
                  </View>

                  <View style={styles.controlPanel}>
                    <Text style={styles.controlTitle}>Inventory Controls</Text>

                    <View style={styles.controlRow}>
                      <TextInput
                        style={styles.input}
                        placeholder="Add qty"
                        placeholderTextColor="#8A9482"
                        keyboardType="numeric"
                        value={restockAmounts[item.id] || ""}
                        onChangeText={(text) =>
                          setRestockAmounts((prev) => ({ ...prev, [item.id]: text }))
                        }
                      />
                      <Pressable style={styles.addButton} onPress={() => restockProduct(item.id)}>
                        <Text style={styles.actionText}>Add</Text>
                      </Pressable>
                    </View>

                    <View style={styles.controlRow}>
                      <TextInput
                        style={styles.input}
                        placeholder="Remove qty"
                        placeholderTextColor="#8A9482"
                        keyboardType="numeric"
                        value={removeAmounts[item.id] || ""}
                        onChangeText={(text) =>
                          setRemoveAmounts((prev) => ({ ...prev, [item.id]: text }))
                        }
                      />
                      <Pressable style={styles.reduceButton} onPress={() => removeInventory(item.id)}>
                        <Text style={styles.actionText}>Reduce</Text>
                      </Pressable>
                    </View>

                    <Pressable style={styles.deleteButton} onPress={() => deleteProduct(item.id)}>
                      <Text style={styles.deleteText}>Remove Product From Farm Inventory</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })
        )}

        <Text style={styles.sectionTitle}>Customer Reviews</Text>

        {reviews.map((review) => (
          <View key={review.id} style={styles.reviewCard}>
            <View style={styles.reviewAvatar}>
              <Text style={styles.reviewAvatarText}>{review.customer.slice(0, 1)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.reviewName}>
                {review.customer} · ⭐ {review.rating}
              </Text>
              <Text style={styles.reviewText}>{review.text}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function getBadgeText(status: string) {
  if (status === "soldout") return "Sold Out";
  if (status === "critical") return "Critical";
  if (status === "warning") return "Low Stock";
  return "Available";
}

function getBadgeStyle(status: string) {
  if (status === "soldout") return styles.badgeRed;
  if (status === "critical") return styles.badgeOrange;
  if (status === "warning") return styles.badgeYellow;
  return styles.badgeGreen;
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function ActionButton({ label, icon, onPress }: { label: string; icon: string; onPress: () => void }) {
  return (
    <Pressable style={styles.quickAction} onPress={onPress}>
      <Text style={styles.quickIcon}>{icon}</Text>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailCard}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.bg },
  centerPage: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: { marginTop: 12, color: COLORS.muted, fontWeight: "900" },
  content: { padding: 18, paddingBottom: 44 },

  hero: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 30,
    padding: 20,
    marginBottom: 16,
  },
  heroTop: { flexDirection: "row", alignItems: "flex-start" },
  kicker: {
    color: "#BBF7D0",
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  heroTitle: { color: "#FFFFFF", fontWeight: "900", fontSize: 30 },
  heroSubtitle: { color: "#DCFCE7", fontWeight: "700", lineHeight: 21, marginTop: 8 },
  logoutButton: {
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    marginLeft: 10,
  },
  logoutText: { color: "#FFFFFF", fontWeight: "900" },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    alignSelf: "flex-start",
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    marginTop: 16,
  },
  statusDot: { color: COLORS.primary, marginRight: 7 },
  statusText: { color: COLORS.text, fontWeight: "900" },
  heroStats: { flexDirection: "row", marginTop: 18 },
  heroStat: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 18,
    padding: 12,
    marginRight: 8,
  },
  heroStatValue: { color: "#FFFFFF", fontWeight: "900", fontSize: 20 },
  heroStatLabel: { color: "#DCFCE7", fontWeight: "800", fontSize: 12, marginTop: 3 },

  quickActions: { flexDirection: "row", flexWrap: "wrap", marginBottom: 16 },
  quickAction: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 10,
    marginRight: "2%",
  },
  quickIcon: { fontSize: 24, marginBottom: 8 },
  quickLabel: { color: COLORS.text, fontWeight: "900" },

  driverOpsCard: {
    backgroundColor: COLORS.dark,
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  driverOpsKicker: {
    color: "#BBF7D0",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: 5,
  },
  driverOpsTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 6,
  },
  driverOpsText: {
    color: "#D1D5DB",
    fontWeight: "700",
    lineHeight: 20,
  },
  driverOpsButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
  },
  driverOpsButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 18 },
  statCard: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 15,
    marginBottom: 10,
    marginRight: "2%",
  },
  statValue: { color: COLORS.primary, fontWeight: "900", fontSize: 22 },
  statLabel: { color: COLORS.muted, fontWeight: "800", fontSize: 12, marginTop: 4 },

  sectionTitle: { color: COLORS.text, fontWeight: "900", fontSize: 23, marginTop: 8 },
  sectionSub: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 3, marginBottom: 12 },

  emptyCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 26,
    padding: 22,
    alignItems: "center",
    marginBottom: 18,
  },
  emptyIcon: { fontSize: 46, marginBottom: 10 },
  emptyTitle: { color: COLORS.text, fontWeight: "900", fontSize: 20 },
  emptyText: { color: COLORS.muted, fontWeight: "700", textAlign: "center", marginTop: 6 },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 17,
    padding: 15,
    alignSelf: "stretch",
    alignItems: "center",
    marginTop: 14,
  },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "900" },

  productCard: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    overflow: "hidden",
  },
  productImage: { width: "100%", height: 190, backgroundColor: COLORS.greenSoft },
  productBody: { padding: 16 },
  productTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  productName: { color: COLORS.text, fontWeight: "900", fontSize: 22 },
  productCategory: { color: COLORS.muted, fontWeight: "700", marginTop: 3 },

  badge: {
    fontWeight: "900",
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
    marginLeft: 8,
  },
  badgeGreen: { backgroundColor: "#DCFCE7", color: "#166534" },
  badgeYellow: { backgroundColor: "#FEF3C7", color: "#92400E" },
  badgeOrange: { backgroundColor: "#FFEDD5", color: "#C2410C" },
  badgeRed: { backgroundColor: COLORS.redSoft, color: COLORS.redText },

  stockBox: {
    backgroundColor: COLORS.greenSoft,
    borderRadius: 20,
    padding: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  stockLabel: { color: COLORS.primaryDark, fontWeight: "900", fontSize: 12 },
  stockValue: { color: COLORS.primaryDark, fontWeight: "900", fontSize: 27, marginTop: 3 },
  thresholdBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    padding: 10,
    minWidth: 78,
    alignItems: "center",
  },
  thresholdLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 11 },
  thresholdValue: { color: COLORS.text, fontWeight: "900", fontSize: 18 },

  detailGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  detailCard: {
    width: "48%",
    backgroundColor: COLORS.bg,
    borderRadius: 15,
    padding: 10,
    marginRight: "2%",
    marginBottom: 8,
  },
  detailLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 11 },
  detailValue: { color: COLORS.text, fontWeight: "900", fontSize: 12, marginTop: 4 },

  controlPanel: { backgroundColor: COLORS.bg, borderRadius: 20, padding: 12 },
  controlTitle: { color: COLORS.text, fontWeight: "900", marginBottom: 10 },
  controlRow: { flexDirection: "row", marginBottom: 9 },
  input: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: COLORS.text,
    fontWeight: "800",
    marginRight: 8,
  },
  addButton: {
    width: 85,
    backgroundColor: COLORS.dark,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  reduceButton: {
    width: 85,
    backgroundColor: COLORS.orange,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  actionText: { color: "#FFFFFF", fontWeight: "900" },
  deleteButton: {
    backgroundColor: COLORS.redSoft,
    borderColor: "#FCA5A5",
    borderWidth: 1,
    borderRadius: 15,
    padding: 14,
    alignItems: "center",
  },
  deleteText: { color: COLORS.redText, fontWeight: "900", textAlign: "center" },

  reviewCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 14,
    flexDirection: "row",
    marginBottom: 10,
  },
  reviewAvatar: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: COLORS.greenSoft,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  reviewAvatarText: { color: COLORS.primaryDark, fontWeight: "900", fontSize: 18 },
  reviewName: { color: COLORS.text, fontWeight: "900" },
  reviewText: { color: COLORS.muted, fontWeight: "700", marginTop: 5, lineHeight: 20 },
});