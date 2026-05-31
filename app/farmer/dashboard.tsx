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

import {
  Product,
  getFarmerById,
  updateFarmerProductStock,
} from "../data/farmerStore";

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
  blue: "#1565C0",
  purple: "#7C3AED",
  orange: "#EF6C00",
  stripe: "#635BFF",
};

const reviews = [
  { id: 1, customer: "Angela", rating: 5, text: "Fresh eggs and fast pickup!" },
  { id: 2, customer: "Marcus", rating: 5, text: "Great greens. Very fresh." },
  {
    id: 3,
    customer: "Tanya",
    rating: 4,
    text: "Good quality and friendly farmer.",
  },
];

function getStock(product: Product) {
  return Number(product.stock ?? product.quantity ?? 0);
}

function getThreshold(product: Product) {
  return Number(product.lowStockThreshold ?? 5);
}

function getProductImage(product: Product) {
  if (product.image && product.image.trim()) return product.image;
  if (product.imageUrl && product.imageUrl.trim()) return product.imageUrl;
  return "https://images.unsplash.com/photo-1542838132-92c53300491e";
}

export default function FarmerDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [farmName, setFarmName] = useState("My Farm");
  const [farmerId, setFarmerId] = useState("");
  const [farmerEmail, setFarmerEmail] = useState("");
  const [restockAmounts, setRestockAmounts] = useState<Record<string, string>>(
    {}
  );
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      loadFarmerProducts();
    }, [])
  );

  function isApprovedFarmer(farmer: any) {
    return (
      farmer.approved === true ||
      farmer.complianceStatus === "approved" ||
      farmer.compliance_status === "approved" ||
      farmer.adminReviewStatus === "approved" ||
      farmer.admin_review_status === "approved" ||
      farmer.reviewDecision === "approved" ||
      farmer.review_decision === "approved"
    );
  }

  function isStoreUnlocked(farmer: any) {
    return (
      farmer.storeUnlocked === true ||
      farmer.store_unlocked === true ||
      farmer.accountActive === true ||
      farmer.account_active === true
    );
  }

  function isRejectedFarmer(farmer: any) {
    return (
      farmer.rejected === true ||
      farmer.complianceStatus === "rejected" ||
      farmer.compliance_status === "rejected" ||
      farmer.adminReviewStatus === "rejected" ||
      farmer.admin_review_status === "rejected" ||
      farmer.reviewDecision === "rejected" ||
      farmer.review_decision === "rejected"
    );
  }

  async function loadFarmerProducts() {
    try {
      setLoading(true);

      const saved = await AsyncStorage.getItem("currentFarmer");

      if (!saved) {
        router.replace("/farmer/login" as any);
        return;
      }

      const currentFarmer = JSON.parse(saved);

      const activeFarmer = {
        ...currentFarmer,
        id: currentFarmer.id || currentFarmer.farmerId,
        farmerId: currentFarmer.farmerId || currentFarmer.id,
        role: "farmer",
      };

      if (!activeFarmer.id) {
        Alert.alert("Session Error", "Please login again.");
        router.replace("/farmer/login" as any);
        return;
      }

      if (isRejectedFarmer(activeFarmer)) {
        Alert.alert(
          "Application Rejected",
          "Your farmer application was rejected. Contact Farm2Home support."
        );
        router.replace("/farmer/login" as any);
        return;
      }

      if (!isApprovedFarmer(activeFarmer) || !isStoreUnlocked(activeFarmer)) {
        router.replace({
          pathname: "/farmer/awaiting-approval",
          params: {
            farmerId: activeFarmer.id,
            email: activeFarmer.email || "",
            businessName:
              activeFarmer.businessName || activeFarmer.farmName || "",
          },
        } as any);
        return;
      }

      await AsyncStorage.setItem("currentFarmer", JSON.stringify(activeFarmer));
      await AsyncStorage.setItem("currentUser", JSON.stringify(activeFarmer));
      await AsyncStorage.setItem("userRole", "farmer");
      await AsyncStorage.setItem("currentUserRole", "farmer");

      const id = activeFarmer.id || activeFarmer.farmerId || "";

      setFarmerId(id);
      setFarmerEmail(activeFarmer.email || "");
      setFarmName(
        activeFarmer.farmName || activeFarmer.businessName || "My Farm"
      );

      const farmer = id ? await getFarmerById(id) : null;

      if (farmer) {
        const farmerApproved = isApprovedFarmer(farmer);
        const farmerUnlocked = isStoreUnlocked(farmer);
        const farmerRejected = isRejectedFarmer(farmer);

        if (farmerRejected) {
          Alert.alert(
            "Application Rejected",
            "Your farmer application was rejected. Contact Farm2Home support."
          );
          router.replace("/farmer/login" as any);
          return;
        }

        if (!farmerApproved || !farmerUnlocked) {
          router.replace({
            pathname: "/farmer/awaiting-approval",
            params: {
              farmerId: farmer.id,
              email: farmer.email || "",
              businessName: farmer.farmName || "",
            },
          } as any);
          return;
        }

        setFarmName(farmer.farmName || activeFarmer.businessName || "My Farm");
        setFarmerEmail(farmer.email || activeFarmer.email || "");
        setProducts(farmer.products || []);
      } else {
        setProducts(activeFarmer.products || []);
      }
    } catch (error) {
      console.log("Dashboard load error:", error);
      Alert.alert("Dashboard Error", "Unable to load farmer dashboard.");
    } finally {
      setLoading(false);
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
    const amount = Number(restockAmounts[productId] || 0);

    if (!farmerId) {
      Alert.alert("Session Error", "Please login again.");
      router.replace("/farmer/login" as any);
      return;
    }

    if (!amount || amount <= 0) {
      Alert.alert("Invalid Restock", "Enter a valid restock amount.");
      return;
    }

    await updateFarmerProductStock(
      farmerId,
      productId,
      amount,
      farmerEmail || "farmer"
    );

    setRestockAmounts((prev) => ({
      ...prev,
      [productId]: "",
    }));

    await loadFarmerProducts();

    Alert.alert("Inventory Updated", "Your product inventory was updated.");
  }

  const totalSold = products.reduce(
    (sum, item) => sum + Number(item.sold || 0),
    0
  );

  const totalGrossSales = products.reduce(
    (sum, item) => sum + Number(item.grossSales || 0),
    0
  );

  const totalStock = products.reduce((sum, item) => sum + getStock(item), 0);

  const lowStockProducts = products.filter((item) => {
    const stock = getStock(item);
    const threshold = getThreshold(item);
    return stock > 0 && stock <= threshold;
  });

  const soldOutProducts = products.filter((item) => getStock(item) <= 0);

  if (loading) {
    return (
      <View style={styles.lockContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.lockText}>Loading farmer dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.farmAvatar}>
              <Text style={styles.farmAvatarText}>🚜</Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.logoutButton,
                pressed && styles.pressed,
              ]}
              onPress={logoutFarmer}
            >
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </View>

          <Text style={styles.header}>Farmer Dashboard</Text>

          <Text style={styles.subheader}>
            {farmName} · Manage your Farm2Home storefront, products, inventory,
            and customer activity.
          </Text>

          <View style={styles.storeMetaRow}>
            <View style={styles.storeMeta}>
              <Text style={styles.storeMetaValue}>{products.length}</Text>
              <Text style={styles.storeMetaLabel}>Products</Text>
            </View>

            <View style={styles.storeMeta}>
              <Text style={styles.storeMetaValue}>{totalStock}</Text>
              <Text style={styles.storeMetaLabel}>Stock</Text>
            </View>

            <View style={styles.storeMeta}>
              <Text style={styles.storeMetaValue}>
                ${totalGrossSales.toFixed(2)}
              </Text>
              <Text style={styles.storeMetaLabel}>Sales</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.setupStoreButton,
              pressed && styles.pressed,
            ]}
            onPress={() => goTo("/farmer/setup-store")}
          >
            <Text style={styles.setupStoreText}>🏪 Edit Store Setup</Text>
          </Pressable>
        </View>

        <View style={styles.actionGrid}>
          <ActionButton
            label="Add Product"
            icon="➕"
            color={COLORS.primary}
            onPress={() => goTo("/farmer/add-product")}
          />

          <ActionButton
            label="Customize Store"
            icon="🏪"
            color={COLORS.primaryDark}
            onPress={() => goTo("/farmer/setup-store")}
          />

          <ActionButton
            label="Compliance"
            icon="🛡️"
            color={COLORS.purple}
            onPress={() => goTo("/farmer/compliance-upload")}
          />

          <ActionButton
            label="Orders"
            icon="📦"
            color={COLORS.blue}
            onPress={() => goTo("/farmer/orders")}
          />

          <ActionButton
            label="Delivery"
            icon="🚚"
            color={COLORS.orange}
            onPress={() => goTo("/farmer/delivery-orders")}
          />

          <ActionButton
            label="Payout Status"
            icon="💳"
            color={COLORS.stripe}
            onPress={() => goTo("/farmer/connect-bank")}
          />

          <ActionButton
            label="Preview Market"
            icon="🛒"
            color={COLORS.dark}
            onPress={() => goTo("/customer/marketplace")}
          />
        </View>

        <View style={styles.notice}>
          <View style={styles.noticeIconBox}>
            <Text style={styles.noticeIcon}>✅</Text>
          </View>

          <View style={styles.noticeTextBlock}>
            <Text style={styles.noticeTitle}>Store Ready</Text>

            <Text style={styles.noticeText}>
              Add products, manage inventory, restock items, and monitor your
              Farm2Home storefront.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.previewButton,
                pressed && styles.pressed,
              ]}
              onPress={() => goTo("/farmer/add-product")}
            >
              <Text style={styles.previewButtonText}>Add / Manage Produce</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Products" value={String(products.length)} />
          <StatCard label="In Stock" value={String(totalStock)} />
          <StatCard label="Sold" value={String(totalSold)} />
          <StatCard
            label="Gross Sales"
            value={`$${totalGrossSales.toFixed(2)}`}
          />
          <StatCard label="Low Stock" value={String(lowStockProducts.length)} />
          <StatCard label="Sold Out" value={String(soldOutProducts.length)} />
        </View>

        {(lowStockProducts.length > 0 || soldOutProducts.length > 0) && (
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>Action Needed</Text>

            {lowStockProducts.map((item) => (
              <Text key={`low-${item.id}`} style={styles.alertText}>
                ⚠️ {item.name} is low: {getStock(item)}{" "}
                {item.unit || "each"} left.
              </Text>
            ))}

            {soldOutProducts.map((item) => (
              <Text key={`sold-${item.id}`} style={styles.alertText}>
                🔴 {item.name} is sold out. Restock to show it available again.
              </Text>
            ))}
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Inventory / Restock</Text>
          <Text style={styles.sectionSubtitle}>
            Update stock counts and product availability
          </Text>
        </View>

        {products.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🥬</Text>
            <Text style={styles.emptyTitle}>No products yet</Text>

            <Text style={styles.meta}>
              Add products to your store so customers can shop your produce,
              meat, dairy, eggs, flowers, and farm goods.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.emptyActionButton,
                pressed && styles.pressed,
              ]}
              onPress={() => goTo("/farmer/add-product")}
            >
              <Text style={styles.emptyActionText}>Add Your First Product</Text>
            </Pressable>
          </View>
        ) : (
          products.map((item) => {
            const stock = getStock(item);
            const threshold = getThreshold(item);
            const isSoldOut = stock <= 0;
            const isLowStock = stock > 0 && stock <= threshold;

            return (
              <View key={item.id} style={styles.productCard}>
                <Image
                  source={{ uri: getProductImage(item) }}
                  style={styles.productImage}
                />

                <View style={styles.productBody}>
                  <View style={styles.productHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productName}>{item.name}</Text>
                      <Text style={styles.meta}>{item.category}</Text>
                    </View>

                    {isSoldOut ? (
                      <Text style={styles.soldOutBadge}>Sold Out</Text>
                    ) : isLowStock ? (
                      <Text style={styles.lowStockBadge}>Low Stock</Text>
                    ) : (
                      <Text style={styles.availableBadge}>Available</Text>
                    )}
                  </View>

                  <View style={styles.detailGrid}>
                    <Detail
                      label="Price"
                      value={`$${Number(item.price || 0).toFixed(2)} / ${
                        item.unit || "each"
                      }`}
                    />
                    <Detail
                      label="Stock"
                      value={`${stock} ${item.unit || "each"}`}
                    />
                    <Detail label="Low Alert" value={String(threshold)} />
                    <Detail
                      label="Sold"
                      value={String(Number(item.sold || 0))}
                    />
                    <Detail
                      label="Gross"
                      value={`$${Number(item.grossSales || 0).toFixed(2)}`}
                    />
                    <Detail
                      label="Delivery"
                      value={item.deliveryOption || "Not set"}
                    />
                  </View>

                  <TextInput
                    style={styles.input}
                    placeholder="Restock amount"
                    placeholderTextColor="#8A9482"
                    keyboardType="numeric"
                    value={restockAmounts[item.id] || ""}
                    onChangeText={(text) =>
                      setRestockAmounts((prev) => ({
                        ...prev,
                        [item.id]: text,
                      }))
                    }
                  />

                  <Pressable
                    style={({ pressed }) => [
                      styles.restockButton,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => restockProduct(item.id)}
                  >
                    <Text style={styles.restockText}>
                      Restock / Update Inventory
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Customer Reviews</Text>
          <Text style={styles.sectionSubtitle}>Recent customer feedback</Text>
        </View>

        {reviews.map((review) => (
          <View key={review.id} style={styles.reviewCard}>
            <View style={styles.reviewAvatar}>
              <Text style={styles.reviewAvatarText}>
                {review.customer.slice(0, 1)}
              </Text>
            </View>

            <View style={styles.reviewBody}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewName}>{review.customer}</Text>
                <Text style={styles.reviewRating}>⭐ {review.rating}</Text>
              </View>

              <Text style={styles.reviewText}>{review.text}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function ActionButton({
  label,
  icon,
  color,
  onPress,
}: {
  label: string;
  icon: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionButton,
        { backgroundColor: color },
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={styles.actionText}>{label}</Text>
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
    <View style={styles.detailTile}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  lockContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  lockText: {
    marginTop: 14,
    color: COLORS.muted,
    fontWeight: "900",
    textAlign: "center",
  },
  content: {
    padding: 18,
    paddingBottom: 44,
  },
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 32,
    padding: 20,
    marginBottom: 16,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  farmAvatar: {
    width: 66,
    height: 66,
    borderRadius: 22,
    backgroundColor: COLORS.secondary,
    justifyContent: "center",
    alignItems: "center",
  },
  farmAvatarText: {
    fontSize: 35,
  },
  header: {
    fontSize: 31,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  subheader: {
    color: "#EAF7E6",
    marginTop: 8,
    lineHeight: 22,
    fontWeight: "700",
  },
  storeMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  storeMeta: {
    flexGrow: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 20,
    minWidth: 94,
  },
  storeMetaValue: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 18,
  },
  storeMetaLabel: {
    color: "#EAF7E6",
    fontWeight: "800",
    fontSize: 11,
    marginTop: 2,
  },
  setupStoreButton: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 15,
    borderRadius: 20,
    alignItems: "center",
    marginTop: 18,
  },
  setupStoreText: {
    color: COLORS.primary,
    fontWeight: "900",
    fontSize: 16,
  },
  logoutButton: {
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  logoutText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  actionButton: {
    width: "48%",
    minHeight: 86,
    padding: 14,
    borderRadius: 22,
    justifyContent: "center",
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 7,
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 14,
  },
  notice: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 28,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 13,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  noticeIconBox: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: COLORS.softGreen,
    justifyContent: "center",
    alignItems: "center",
  },
  noticeIcon: {
    fontSize: 27,
  },
  noticeTextBlock: {
    flex: 1,
  },
  noticeTitle: {
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: 5,
    fontSize: 18,
  },
  noticeText: {
    color: COLORS.muted,
    lineHeight: 22,
    fontWeight: "700",
  },
  previewButton: {
    backgroundColor: COLORS.primaryDark,
    padding: 14,
    borderRadius: 18,
    marginTop: 14,
  },
  previewButtonText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "900",
    fontSize: 15,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    width: "48%",
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  statValue: {
    fontSize: 23,
    fontWeight: "900",
    color: COLORS.primary,
  },
  statLabel: {
    color: COLORS.muted,
    marginTop: 4,
    fontSize: 12,
    fontWeight: "800",
  },
  alertBox: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FDBA74",
    borderWidth: 1,
    padding: 16,
    borderRadius: 24,
    marginBottom: 18,
  },
  alertTitle: {
    color: "#9A3412",
    fontWeight: "900",
    fontSize: 18,
    marginBottom: 8,
  },
  alertText: {
    color: "#7C2D12",
    fontWeight: "700",
    marginBottom: 6,
    lineHeight: 20,
  },
  sectionHeader: {
    marginTop: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 23,
    fontWeight: "900",
    color: COLORS.text,
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  emptyIcon: {
    fontSize: 46,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: 6,
  },
  emptyActionButton: {
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 18,
    marginTop: 12,
    alignItems: "center",
    alignSelf: "stretch",
  },
  emptyActionText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  productCard: {
    backgroundColor: COLORS.card,
    borderRadius: 30,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  productImage: {
    width: "100%",
    height: 210,
    backgroundColor: COLORS.softGreen,
  },
  productBody: {
    padding: 16,
  },
  productHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 12,
  },
  productName: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.text,
  },
  meta: {
    color: COLORS.muted,
    marginBottom: 5,
    lineHeight: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  detailTile: {
    width: "48%",
    backgroundColor: COLORS.lightGreen,
    padding: 11,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailLabel: {
    color: COLORS.muted,
    fontWeight: "900",
    fontSize: 11,
    marginBottom: 4,
  },
  detailValue: {
    color: COLORS.text,
    fontWeight: "800",
    fontSize: 12,
  },
  soldOutBadge: {
    backgroundColor: "#FEE2E2",
    color: "#991B1B",
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
  },
  lowStockBadge: {
    backgroundColor: "#FEF3C7",
    color: "#92400E",
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
  },
  availableBadge: {
    backgroundColor: "#DCFCE7",
    color: "#166534",
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
  },
  input: {
    backgroundColor: COLORS.lightGreen,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 15,
    marginTop: 10,
    color: COLORS.text,
    fontWeight: "800",
  },
  restockButton: {
    backgroundColor: COLORS.dark,
    padding: 15,
    borderRadius: 18,
    marginTop: 10,
  },
  restockText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "900",
  },
  reviewCard: {
    backgroundColor: COLORS.card,
    padding: 14,
    borderRadius: 22,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 12,
  },
  reviewAvatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: COLORS.softGreen,
    justifyContent: "center",
    alignItems: "center",
  },
  reviewAvatarText: {
    color: COLORS.primary,
    fontWeight: "900",
    fontSize: 18,
  },
  reviewBody: {
    flex: 1,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  reviewName: {
    fontWeight: "900",
    fontSize: 16,
    color: COLORS.text,
  },
  reviewRating: {
    fontWeight: "900",
    color: COLORS.primary,
  },
  reviewText: {
    marginTop: 5,
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.75,
  },
});