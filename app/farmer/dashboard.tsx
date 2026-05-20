import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";

import {
  Product,
  getFarmerById,
  updateFarmerProductStock,
} from "../data/farmerStore";

import { enforceSubscriptionAccess } from "../services/lockoutGuard";
import farmTheme from "../styles/farmTheme";

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

  const [accessChecking, setAccessChecking] = useState(true);
  const [accessAllowed, setAccessAllowed] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadFarmerProducts();
    }, [])
  );

  async function loadFarmerProducts() {
    try {
      setAccessChecking(true);

      const saved = await AsyncStorage.getItem("currentFarmer");

      if (!saved) {
        Alert.alert("Session Needed", "Please login or complete farmer setup.");
        router.replace("/farmer/login" as any);
        return;
      }

      const currentFarmer = JSON.parse(saved);

      const access = await enforceSubscriptionAccess({
        role: "farmer",
        userId: currentFarmer.id || "",
        email: currentFarmer.email || "",
        redirectTo: "/subscription/subscription-locked",
      });

      setAccessAllowed(access.allowed);

      if (!access.allowed) {
        return;
      }

      setFarmerId(currentFarmer.id);
      setFarmerEmail(currentFarmer.email || "");
      setFarmName(currentFarmer.farmName || "My Farm");

      const farmer = await getFarmerById(currentFarmer.id);

      if (farmer) {
        setFarmName(farmer.farmName || "My Farm");
        setFarmerEmail(farmer.email || "");
        setProducts(farmer.products || []);
        await AsyncStorage.setItem("currentFarmer", JSON.stringify(farmer));
      }
    } catch (error) {
      console.log("Dashboard load error:", error);
      Alert.alert("Dashboard Error", "Unable to load farmer dashboard.");
    } finally {
      setAccessChecking(false);
    }
  }

  async function logoutFarmer() {
    await AsyncStorage.removeItem("currentFarmer");
    router.replace("/farmer/login" as any);
  }

  async function checkFarmerAccessBeforeAction() {
    const saved = await AsyncStorage.getItem("currentFarmer");
    const currentFarmer = saved ? JSON.parse(saved) : null;

    const access = await enforceSubscriptionAccess({
      role: "farmer",
      userId: currentFarmer?.id || farmerId || "",
      email: currentFarmer?.email || farmerEmail || "",
      redirectTo: "/subscription/subscription-locked",
    });

    return access.allowed;
  }

  async function restockProduct(productId: string) {
    const allowed = await checkFarmerAccessBeforeAction();
    if (!allowed) return;

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

  async function protectedPush(pathname: string) {
    const allowed = await checkFarmerAccessBeforeAction();
    if (!allowed) return;

    router.push(pathname as any);
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

  if (accessChecking) {
    return (
      <View style={styles.lockContainer}>
        <ActivityIndicator size="large" color={farmTheme.colors.primary} />
        <Text style={styles.lockText}>Checking farmer subscription access...</Text>
      </View>
    );
  }

  if (!accessAllowed) {
    return (
      <View style={styles.lockContainer}>
        <Text style={styles.lockTitle}>Subscription Required</Text>
        <Text style={styles.lockText}>Redirecting to subscription page...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <Text style={styles.header}>Farmer Dashboard</Text>

        <Text style={styles.subheader}>
          {farmName} · Manage your Farm2Home storefront, products, inventory,
          and customer activity.
        </Text>

        <View style={styles.storeMetaRow}>
          <Text style={styles.storeMeta}>Products: {products.length}</Text>
          <Text style={styles.storeMeta}>Stock: {totalStock}</Text>
          <Text style={styles.storeMeta}>
            Sales: ${totalGrossSales.toFixed(2)}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.setupStoreButton}
          onPress={() => protectedPush("/farmer/setup-store")}
        >
          <Text style={styles.setupStoreText}>🏪 Edit Store Setup</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={logoutFarmer}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionGrid}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => protectedPush("/farmer/post-produce")}
        >
          <Text style={styles.actionText}>➕ Add Product</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.storeButton}
          onPress={() => protectedPush("/farmer/setup-store")}
        >
          <Text style={styles.actionText}>🏪 Customize Store</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.complianceButton}
          onPress={() => protectedPush("/farmer/compliance-upload")}
        >
          <Text style={styles.actionText}>🛡️ Compliance Record</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.ordersButton}
          onPress={() => protectedPush("/farmer/orders")}
        >
          <Text style={styles.actionText}>📦 Orders</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deliveryButton}
          onPress={() => protectedPush("/farmer/delivery-orders")}
        >
          <Text style={styles.actionText}>🚚 Delivery</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.stripeButton}
          onPress={() => protectedPush("/farmer/compliance-upload")}
        >
          <Text style={styles.actionText}>💳 Payout Status</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.marketplaceButton}
          onPress={() => protectedPush("/customer/marketplace")}
        >
          <Text style={styles.actionText}>🛒 Preview Marketplace</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Store Ready</Text>

        <Text style={styles.noticeText}>
          Add products, manage inventory, restock items, and monitor your
          Farm2Home storefront.
        </Text>

        <TouchableOpacity
          style={styles.previewButton}
          onPress={() => protectedPush("/farmer/post-produce")}
        >
          <Text style={styles.previewButtonText}>Add / Manage Produce</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{products.length}</Text>
          <Text style={styles.statLabel}>Products</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalStock}</Text>
          <Text style={styles.statLabel}>In Stock</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalSold}</Text>
          <Text style={styles.statLabel}>Sold</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>${totalGrossSales.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Gross Sales</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statValue}>{lowStockProducts.length}</Text>
          <Text style={styles.statLabel}>Low Stock</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statValue}>{soldOutProducts.length}</Text>
          <Text style={styles.statLabel}>Sold Out</Text>
        </View>
      </View>

      {(lowStockProducts.length > 0 || soldOutProducts.length > 0) && (
        <View style={styles.alertBox}>
          <Text style={styles.alertTitle}>Action Needed</Text>

          {lowStockProducts.map((item) => (
            <Text key={`low-${item.id}`} style={styles.alertText}>
              ⚠️ {item.name} is low: {getStock(item)} {item.unit || "each"} left.
            </Text>
          ))}

          {soldOutProducts.map((item) => (
            <Text key={`sold-${item.id}`} style={styles.alertText}>
              🔴 {item.name} is sold out. Restock to show it available again.
            </Text>
          ))}
        </View>
      )}

      <Text style={styles.sectionTitle}>Inventory / Restock</Text>

      {products.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No products yet.</Text>

          <Text style={styles.meta}>
            Add products to your store so customers can shop your produce, meat,
            dairy, eggs, flowers, and farm goods.
          </Text>

          <TouchableOpacity
            style={styles.emptyActionButton}
            onPress={() => protectedPush("/farmer/post-produce")}
          >
            <Text style={styles.emptyActionText}>Add Your First Product</Text>
          </TouchableOpacity>
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
                  <Text style={styles.detail}>
                    Price: ${Number(item.price || 0).toFixed(2)} /{" "}
                    {item.unit || "each"}
                  </Text>

                  <Text style={styles.detail}>
                    Stock: {stock} {item.unit || "each"}
                  </Text>

                  <Text style={styles.detail}>Low Alert: {threshold}</Text>

                  <Text style={styles.detail}>Sold: {Number(item.sold || 0)}</Text>

                  <Text style={styles.detail}>
                    Gross: ${Number(item.grossSales || 0).toFixed(2)}
                  </Text>

                  <Text style={styles.detail}>
                    Delivery: {item.deliveryOption || "Not set"}
                  </Text>
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Restock amount"
                  placeholderTextColor="#8A8F98"
                  keyboardType="numeric"
                  value={restockAmounts[item.id] || ""}
                  onChangeText={(text) =>
                    setRestockAmounts((prev) => ({
                      ...prev,
                      [item.id]: text,
                    }))
                  }
                />

                <TouchableOpacity
                  style={styles.restockButton}
                  onPress={() => restockProduct(item.id)}
                >
                  <Text style={styles.restockText}>
                    Restock / Update Inventory
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      <Text style={styles.sectionTitle}>Customer Reviews</Text>

      {reviews.map((review) => (
        <View key={review.id} style={styles.reviewCard}>
          <Text style={styles.reviewName}>{review.customer}</Text>
          <Text style={styles.reviewRating}>⭐ {review.rating}</Text>
          <Text style={styles.reviewText}>{review.text}</Text>
        </View>
      ))}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: farmTheme.colors.background,
  },
  lockContainer: {
    flex: 1,
    backgroundColor: farmTheme.colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  lockTitle: {
    color: "#991B1B",
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
  },
  lockText: {
    marginTop: 14,
    color: farmTheme.colors.mutedText,
    fontWeight: "800",
    textAlign: "center",
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: farmTheme.colors.primary,
    borderRadius: 28,
    padding: 22,
    marginBottom: 16,
  },
  header: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  subheader: {
    color: "#E8F5E9",
    marginTop: 8,
    lineHeight: 22,
  },
  storeMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  storeMeta: {
    backgroundColor: "rgba(255,255,255,0.15)",
    color: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: "hidden",
    fontWeight: "900",
  },
  setupStoreButton: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 18,
  },
  setupStoreText: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
    fontSize: 16,
  },
  logoutButton: {
    backgroundColor: "#FFFFFF",
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    marginTop: 14,
  },
  logoutText: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  complianceButton: {
    backgroundColor: "#7C3AED",
    padding: 16,
    borderRadius: 18,
    flexGrow: 1,
  },
  addButton: {
    backgroundColor: farmTheme.colors.primary,
    padding: 16,
    borderRadius: 18,
    flexGrow: 1,
  },
  storeButton: {
    backgroundColor: "#047857",
    padding: 16,
    borderRadius: 18,
    flexGrow: 1,
  },
  ordersButton: {
    backgroundColor: "#1565C0",
    padding: 16,
    borderRadius: 18,
    flexGrow: 1,
  },
  deliveryButton: {
    backgroundColor: "#EF6C00",
    padding: 16,
    borderRadius: 18,
    flexGrow: 1,
  },
  stripeButton: {
    backgroundColor: "#635BFF",
    padding: 16,
    borderRadius: 18,
    flexGrow: 1,
  },
  marketplaceButton: {
    backgroundColor: "#0F172A",
    padding: 16,
    borderRadius: 18,
    flexGrow: 1,
  },
  actionText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "900",
    fontSize: 15,
  },
  notice: {
    backgroundColor: farmTheme.colors.primaryLight,
    padding: 16,
    borderRadius: 18,
    marginBottom: 16,
    borderLeftWidth: 5,
    borderLeftColor: farmTheme.colors.primary,
  },
  noticeTitle: {
    fontWeight: "900",
    color: farmTheme.colors.primary,
    marginBottom: 5,
    fontSize: 16,
  },
  noticeText: {
    color: farmTheme.colors.text,
    lineHeight: 22,
  },
  previewButton: {
    backgroundColor: "#14532D",
    padding: 15,
    borderRadius: 18,
    marginTop: 14,
  },
  previewButtonText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "900",
    fontSize: 15,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "900",
    color: farmTheme.colors.primary,
  },
  statLabel: {
    color: farmTheme.colors.mutedText,
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
  },
  alertBox: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FDBA74",
    borderWidth: 1,
    padding: 16,
    borderRadius: 20,
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
  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: farmTheme.colors.text,
    marginTop: 10,
    marginBottom: 12,
  },
  emptyCard: {
    ...farmTheme.cards.default,
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: farmTheme.colors.text,
    marginBottom: 4,
  },
  emptyActionButton: {
    backgroundColor: farmTheme.colors.primary,
    padding: 14,
    borderRadius: 16,
    marginTop: 12,
    alignItems: "center",
  },
  emptyActionText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  productCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },
  productImage: {
    width: "100%",
    height: 210,
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
    color: farmTheme.colors.text,
  },
  meta: {
    color: farmTheme.colors.mutedText,
    marginBottom: 5,
    lineHeight: 20,
  },
  detailGrid: {
    backgroundColor: farmTheme.colors.primaryLight,
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  detail: {
    color: farmTheme.colors.text,
    fontWeight: "700",
    marginBottom: 5,
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
    ...farmTheme.inputs.input,
    marginTop: 10,
  },
  restockButton: {
    backgroundColor: farmTheme.colors.text,
    padding: 14,
    borderRadius: 16,
    marginTop: 10,
  },
  restockText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "900",
  },
  reviewCard: {
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
  },
  reviewName: {
    fontWeight: "900",
    fontSize: 16,
  },
  reviewRating: {
    marginTop: 3,
    fontWeight: "bold",
  },
  reviewText: {
    marginTop: 5,
    color: farmTheme.colors.mutedText,
  },
});