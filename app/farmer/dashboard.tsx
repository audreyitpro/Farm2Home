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
  blue: "#1565C0",
  purple: "#7C3AED",
  orange: "#EF6C00",
  stripe: "#635BFF",
  yellow: "#FEF3C7",
  yellowText: "#92400E",
  redSoft: "#FEE2E2",
  redText: "#991B1B",
};

const reviews = [
  { id: 1, customer: "Angela", rating: 5, text: "Fresh eggs and fast pickup!" },
  { id: 2, customer: "Marcus", rating: 5, text: "Great greens. Very fresh." },
  { id: 3, customer: "Tanya", rating: 4, text: "Good quality and friendly farmer." },
];

function cleanProducts(items: Product[]) {
  return (items || []).filter((item: any) => {
    const name = String(item?.name || "").trim().toLowerCase();
    if (!name) return false;
    if (name === "farm product") return false;
    if (name === "undefined") return false;
    if (name === "null") return false;
    return true;
  });
}

function getStock(product: any) {
  return Number(product.stock ?? product.quantity ?? product.inventory ?? 0);
}

function getThreshold(product: any) {
  return Number(product.lowStockThreshold ?? product.low_stock_threshold ?? 5);
}

function getProductImage(product: any) {
  if (product.image && String(product.image).trim()) return product.image;
  if (product.imageUrl && String(product.imageUrl).trim()) return product.imageUrl;
  if (product.image_url && String(product.image_url).trim()) return product.image_url;
  return "https://images.unsplash.com/photo-1542838132-92c53300491e";
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
  const [statusLabel, setStatusLabel] = useState("Active / Store Open");
  const [restockAmounts, setRestockAmounts] = useState<Record<string, string>>({});
  const [removeAmounts, setRemoveAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      loadFarmerProducts();
    }, [])
  );

  function buildStatusLabel() {
    return "Active / Store Open";
  }

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

    const cleaned = cleanProducts(updatedProducts);

    const { error } = await supabase
      .from("farmers")
      .update({
        products: cleaned,
        updated_at: new Date().toISOString(),
      })
      .eq("id", farmerId);

    if (error) {
      console.log("Save farmer products error:", error.message);
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
      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", productId);

      if (!error) return;
      console.log("Hide product by id failed:", error.message);
    }

    if (farmerId && productName) {
      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("farmer_id", farmerId)
        .eq("name", productName);

      if (error) {
        console.log("Hide product by farmer/name failed:", error.message);
      }
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
      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", productId);

      if (!error) return;
      console.log("Update stock by id failed:", error.message);
    }

    if (farmerId && productName) {
      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("farmer_id", farmerId)
        .eq("name", productName);

      if (error) {
        console.log("Update stock by farmer/name failed:", error.message);
      }
    }
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

      const currentFarmer = JSON.parse(saved);

      const activeFarmer = {
        ...currentFarmer,
        id: currentFarmer.id || currentFarmer.farmerId,
        farmerId: currentFarmer.farmerId || currentFarmer.id,
        role: "farmer",
        approved: true,
        reviewed: true,
        rejected: false,
        needsMoreInfo: false,
        needs_more_info: false,
        accountActive: true,
        account_active: true,
        storeUnlocked: true,
        store_unlocked: true,
        complianceSubmitted: true,
        compliance_submitted: true,
        complianceStatus: "ACTIVE",
        compliance_status: "ACTIVE",
        adminReviewStatus: "DOCUMENT_REVIEW_ONLY",
        admin_review_status: "DOCUMENT_REVIEW_ONLY",
        reviewDecision: "NOT_REQUIRED",
        review_decision: "NOT_REQUIRED",
      };

      if (!activeFarmer.id) {
        Alert.alert("Session Error", "Please login again.");
        router.replace("/farmer/login" as any);
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
        activeFarmer.farmName ||
          activeFarmer.businessName ||
          activeFarmer.business_name ||
          activeFarmer.farm_name ||
          "My Farm"
      );
      setStatusLabel(buildStatusLabel());

      let farmer = id ? await getFarmerById(id) : null;

      if (!farmer && id) {
        const { data } = await supabase
          .from("farmers")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (data) {
          farmer = {
            ...activeFarmer,
            ...data,
            id: data.id,
            farmerId: data.id,
            farmName: data.farm_name || data.business_name || activeFarmer.farmName,
            businessName: data.business_name || data.farm_name || activeFarmer.businessName,
            email: data.email || activeFarmer.email,
            products: data.products || activeFarmer.products || [],
          } as any;
        }
      }

      if (farmer) {
        const farmerAny = farmer as any;

        const unlockedFarmer = {
          ...farmerAny,
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
          reviewDecision: "NOT_REQUIRED",
          review_decision: "NOT_REQUIRED",
        };

        const cleaned = cleanProducts(unlockedFarmer.products || []);

        setFarmName(
          unlockedFarmer.farmName ||
            unlockedFarmer.businessName ||
            unlockedFarmer.business_name ||
            unlockedFarmer.farm_name ||
            activeFarmer.businessName ||
            "My Farm"
        );
        setFarmerEmail(unlockedFarmer.email || activeFarmer.email || "");
        setProducts(cleaned);
        setStatusLabel(buildStatusLabel());
        await saveProductsLocally(cleaned);
        await saveProductsToSupabase(cleaned);
      } else {
        const cleaned = cleanProducts(activeFarmer.products || []);
        setProducts(cleaned);
        await saveProductsLocally(cleaned);
      }
    } catch (error) {
      console.log("Dashboard load error:", error);

      const saved =
        (await AsyncStorage.getItem("currentFarmer")) ||
        (await AsyncStorage.getItem("currentUser"));

      if (saved) {
        try {
          const fallbackFarmer = JSON.parse(saved);
          const cleaned = cleanProducts(fallbackFarmer.products || []);

          setFarmerId(fallbackFarmer.id || fallbackFarmer.farmerId || "");
          setFarmerEmail(fallbackFarmer.email || "");
          setFarmName(
            fallbackFarmer.farmName ||
              fallbackFarmer.businessName ||
              fallbackFarmer.business_name ||
              fallbackFarmer.farm_name ||
              "My Farm"
          );
          setProducts(cleaned);
          setStatusLabel("Active / Store Open");
        } catch {
          Alert.alert("Dashboard Error", "Unable to load farmer dashboard.");
        }
      } else {
        Alert.alert("Dashboard Error", "Unable to load farmer dashboard.");
      }
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
    const amount = Number(removeNonNumber(restockAmounts[productId] || "0"));

    if (!farmerId) {
      Alert.alert("Session Error", "Please login again.");
      router.replace("/farmer/login" as any);
      return;
    }

    if (!amount || amount <= 0) {
      Alert.alert("Invalid Restock", "Enter a valid restock amount.");
      return;
    }

    const product = products.find((item: any) => String(item.id) === String(productId));
    if (!product) return;

    try {
      await updateFarmerProductStock(
        farmerId,
        productId,
        amount,
        farmerEmail || "farmer"
      ).catch(() => {});

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
          } as any;
        })
      );

      setProducts(updatedProducts);
      await saveProductsLocally(updatedProducts);
      await saveProductsToSupabase(updatedProducts);

      const updatedItem = updatedProducts.find(
        (item: any) => String(item.id) === String(productId)
      );

      if (updatedItem) {
        await updateProductStockInSupabase(updatedItem, getStock(updatedItem));
      }

      setRestockAmounts((prev) => ({ ...prev, [productId]: "" }));

      Alert.alert("Inventory Updated", "Your product inventory was updated.");
    } catch (error: any) {
      Alert.alert("Inventory Error", error?.message || "Unable to update inventory.");
    }
  }

  async function removeInventory(productId: string) {
    const amount = Number(removeNonNumber(removeAmounts[productId] || "0"));

    if (!farmerId) {
      Alert.alert("Session Error", "Please login again.");
      router.replace("/farmer/login" as any);
      return;
    }

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
          } as any;
        })
      );

      setProducts(updatedProducts);
      await saveProductsLocally(updatedProducts);
      await saveProductsToSupabase(updatedProducts);

      const updatedItem = updatedProducts.find(
        (item: any) => String(item.id) === String(productId)
      );

      if (updatedItem) {
        await updateProductStockInSupabase(updatedItem, newStock);
      } else {
        await updateProductStockInSupabase(product, newStock);
      }

      setRemoveAmounts((prev) => ({ ...prev, [productId]: "" }));

      Alert.alert(
        "Inventory Updated",
        `${product.name} stock was reduced by ${removeQty}.`
      );
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
      `Remove ${product?.name || "this product"} from farm inventory and marketplace?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const updatedProducts = cleanProducts(
                products.filter((item: any) => String(item.id) !== String(productId))
              );

              setProducts(updatedProducts);
              await saveProductsLocally(updatedProducts);
              await saveProductsToSupabase(updatedProducts);
              await hideProductInSupabase(product);

              Alert.alert(
                "Product Removed",
                "Item removed from farmer inventory and hidden from marketplace."
              );
            } catch (error: any) {
              console.log("Remove product error:", error);
              Alert.alert(
                "Remove Error",
                error?.message || "Unable to remove product."
              );
            }
          },
        },
      ]
    );
  }

  const visibleProducts = cleanProducts(products);

  const totalSold = visibleProducts.reduce(
    (sum, item: any) => sum + Number(item.sold || 0),
    0
  );

  const totalGrossSales = visibleProducts.reduce(
    (sum, item: any) => sum + Number(item.grossSales || 0),
    0
  );

  const totalStock = visibleProducts.reduce((sum, item) => sum + getStock(item), 0);

  const warningProducts = visibleProducts.filter(
    (item) => getStockStatus(item) === "warning"
  );

  const criticalLowProducts = visibleProducts.filter(
    (item) => getStockStatus(item) === "critical"
  );

  const lowStockProducts = cleanProducts([...criticalLowProducts, ...warningProducts]);

  const soldOutProducts = visibleProducts.filter(
    (item) => getStockStatus(item) === "soldout"
  );

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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.farmAvatar}>
              <Text style={styles.farmAvatarText}>🚜</Text>
            </View>

            <Pressable
              style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}
              onPress={logoutFarmer}
            >
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </View>

          <Text style={styles.header}>Farmer Dashboard</Text>

          <Text style={styles.subheader}>
            {farmName} · Manage your Farm2Home storefront, produce catalog,
            inventory, orders, delivery, and customer activity.
          </Text>

          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>Account Status</Text>
            <Text style={styles.statusValue}>{statusLabel}</Text>
            <Text style={styles.statusNote}>
              Your farmer store is open. Admin review is now document-review only.
            </Text>
          </View>

          <View style={styles.storeMetaRow}>
            <View style={styles.storeMeta}>
              <Text style={styles.storeMetaValue}>{visibleProducts.length}</Text>
              <Text style={styles.storeMetaLabel}>Products Listed</Text>
            </View>

            <View style={styles.storeMeta}>
              <Text style={styles.storeMetaValue}>{totalStock}</Text>
              <Text style={styles.storeMetaLabel}>Total Inventory Units</Text>
            </View>

            <View style={styles.storeMeta}>
              <Text style={styles.storeMetaValue}>${totalGrossSales.toFixed(2)}</Text>
              <Text style={styles.storeMetaLabel}>Sales</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.setupStoreButton, pressed && styles.pressed]}
            onPress={() => goTo("/farmer/select-produce")}
          >
            <Text style={styles.setupStoreText}>🥬 Select Produce</Text>
          </Pressable>
        </View>

        <View style={styles.actionGrid}>
          <ActionButton label="Select Produce" icon="🥬" color={COLORS.primary} onPress={() => goTo("/farmer/select-produce")} />
          <ActionButton label="Add Product" icon="➕" color={COLORS.primaryDark} onPress={() => goTo("/farmer/add-product")} />
          <ActionButton label="Customize Store" icon="🏪" color={COLORS.dark} onPress={() => goTo("/farmer/setup-store")} />
          <ActionButton label="Orders" icon="📦" color={COLORS.blue} onPress={() => goTo("/farmer/orders")} />
          <ActionButton label="Delivery" icon="🚚" color={COLORS.orange} onPress={() => goTo("/farmer/delivery-orders")} />
          <ActionButton label="Payout Status" icon="💳" color={COLORS.stripe} onPress={() => goTo("/farmer/connect-bank")} />
          <ActionButton label="Profile" icon="👤" color={COLORS.purple} onPress={() => goTo("/farmer/profile")} />
          <ActionButton label="Preview Market" icon="🛒" color={COLORS.secondary} onPress={() => goTo("/customer/marketplace")} />
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Products Listed" value={String(visibleProducts.length)} />
          <StatCard label="Total Inventory Units" value={String(totalStock)} />
          <StatCard label="Units Sold" value={String(totalSold)} />
          <StatCard label="Gross Sales" value={`$${totalGrossSales.toFixed(2)}`} />
          <StatCard label="Low Stock Items" value={String(lowStockProducts.length)} />
          <StatCard label="Sold Out Items" value={String(soldOutProducts.length)} />
        </View>

        <InventoryAlertSection title="⚠️ Low Stock Items" products={lowStockProducts} emptyText="No low-stock items." type="low" />
        <InventoryAlertSection title="🔴 Sold Out Items" products={soldOutProducts} emptyText="No sold-out items." type="sold" />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Farm Inventory</Text>
          <Text style={styles.sectionSubtitle}>
            Remove Inventory reduces stock. Remove Product hides it from marketplace and removes it from your dashboard.
          </Text>
        </View>

        {visibleProducts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🥬</Text>
            <Text style={styles.emptyTitle}>No farmer products yet</Text>
            <Text style={styles.meta}>
              Select common produce from the Farm2Home catalog or add your own custom farm product.
            </Text>

            <Pressable
              style={({ pressed }) => [styles.emptyActionButton, pressed && styles.pressed]}
              onPress={() => goTo("/farmer/select-produce")}
            >
              <Text style={styles.emptyActionText}>Select Produce</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.emptySecondaryButton, pressed && styles.pressed]}
              onPress={() => goTo("/farmer/add-product")}
            >
              <Text style={styles.emptySecondaryText}>Add Custom Product / Upload Photo</Text>
            </Pressable>
          </View>
        ) : (
          visibleProducts.map((item: any) => {
            const stock = getStock(item);
            const threshold = getThreshold(item);
            const status = getStockStatus(item);
            const isSoldOut = status === "soldout";
            const isCritical = status === "critical";
            const isWarning = status === "warning";

            return (
              <View
                key={item.id}
                style={[
                  styles.productCard,
                  isWarning && styles.productWarningCard,
                  isCritical && styles.productCriticalCard,
                  isSoldOut && styles.productSoldOutCard,
                ]}
              >
                <Image source={{ uri: getProductImage(item) }} style={styles.productImage} />

                <View style={styles.productBody}>
                  <View style={styles.productHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productName}>{item.name}</Text>
                      <Text style={styles.meta}>{item.category || "Farm Goods"}</Text>
                    </View>

                    {isSoldOut ? (
                      <Text style={styles.soldOutBadge}>Sold Out</Text>
                    ) : isCritical ? (
                      <Text style={styles.criticalBadge}>Critical Low</Text>
                    ) : isWarning ? (
                      <Text style={styles.lowStockBadge}>Near Threshold</Text>
                    ) : (
                      <Text style={styles.availableBadge}>Available</Text>
                    )}
                  </View>

                  <View style={styles.inventoryTotalBox}>
                    <Text style={styles.inventoryTotalLabel}>Total In Stock For This Item</Text>
                    <Text
                      style={[
                        styles.inventoryTotalValue,
                        isWarning && styles.inventoryWarningText,
                        isCritical && styles.inventoryCriticalText,
                        isSoldOut && styles.inventorySoldText,
                      ]}
                    >
                      {stock} {item.unit || "each"}
                    </Text>
                    <Text style={styles.inventoryThresholdText}>Low-stock threshold: {threshold}</Text>
                  </View>

                  <View style={styles.detailGrid}>
                    <Detail label="Price" value={`$${Number(item.price || 0).toFixed(2)} / ${item.unit || "each"}`} />
                    <Detail label="Sold" value={String(Number(item.sold || 0))} />
                    <Detail label="Gross" value={`$${Number(item.grossSales || 0).toFixed(2)}`} />
                    <Detail label="Delivery" value={item.deliveryOption || item.delivery_option || "Not set"} />
                  </View>

                  <TextInput
                    style={styles.input}
                    placeholder="Add stock amount"
                    placeholderTextColor="#8A9482"
                    keyboardType="numeric"
                    value={restockAmounts[item.id] || ""}
                    onChangeText={(text) =>
                      setRestockAmounts((prev) => ({ ...prev, [item.id]: text }))
                    }
                  />

                  <Pressable
                    style={({ pressed }) => [styles.restockButton, pressed && styles.pressed]}
                    onPress={() => restockProduct(item.id)}
                  >
                    <Text style={styles.restockText}>Add Inventory</Text>
                  </Pressable>

                  <TextInput
                    style={styles.input}
                    placeholder="Remove stock amount"
                    placeholderTextColor="#8A9482"
                    keyboardType="numeric"
                    value={removeAmounts[item.id] || ""}
                    onChangeText={(text) =>
                      setRemoveAmounts((prev) => ({ ...prev, [item.id]: text }))
                    }
                  />

                  <Pressable
                    style={({ pressed }) => [styles.removeStockButton, pressed && styles.pressed]}
                    onPress={() => removeInventory(item.id)}
                  >
                    <Text style={styles.removeStockText}>Remove Inventory</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
                    onPress={() => deleteProduct(item.id)}
                  >
                    <Text style={styles.deleteText}>Remove Product From Farm Inventory</Text>
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
              <Text style={styles.reviewAvatarText}>{review.customer.slice(0, 1)}</Text>
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

function removeNonNumber(value: string) {
  return String(value || "").replace(/[^0-9.]/g, "");
}

function InventoryAlertSection({
  title,
  products,
  emptyText,
  type,
}: {
  title: string;
  products: Product[];
  emptyText: string;
  type: "low" | "sold";
}) {
  return (
    <View style={type === "sold" ? styles.soldOutSection : styles.lowStockSection}>
      <Text style={type === "sold" ? styles.soldOutSectionTitle : styles.lowStockSectionTitle}>
        {title}
      </Text>

      {products.length === 0 ? (
        <Text style={styles.alertEmptyText}>{emptyText}</Text>
      ) : (
        products.map((item: any) => {
          const stock = getStock(item);
          const threshold = getThreshold(item);
          const status = getStockStatus(item);

          return (
            <View
              key={`${type}-${item.id}`}
              style={[
                styles.alertItemRow,
                status === "warning" && styles.alertWarningRow,
                status === "critical" && styles.alertCriticalRow,
                status === "soldout" && styles.alertSoldRow,
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.alertItemName}>{item.name}</Text>
                <Text style={styles.alertItemSub}>
                  Threshold: {threshold} · Unit: {item.unit || "each"}
                </Text>
              </View>

              <Text style={[styles.alertItemQty, status === "soldout" && styles.alertSoldQty]}>
                {stock}
              </Text>
            </View>
          );
        })
      )}
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
  page: { flex: 1, backgroundColor: COLORS.background },
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
  content: { padding: 18, paddingBottom: 44 },
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
  farmAvatarText: { fontSize: 35 },
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
  statusCard: {
    backgroundColor: "#FFFFFF",
    marginTop: 16,
    borderRadius: 20,
    padding: 15,
  },
  statusTitle: {
    color: COLORS.primaryDark,
    fontWeight: "900",
    fontSize: 16,
  },
  statusValue: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 18,
    marginTop: 5,
  },
  statusNote: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 6,
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
  logoutText: { color: "#FFFFFF", fontWeight: "900" },
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
  actionIcon: { fontSize: 24, marginBottom: 7 },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 14,
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
  lowStockSection: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FBBF24",
    borderWidth: 1,
    padding: 16,
    borderRadius: 24,
    marginBottom: 14,
  },
  lowStockSectionTitle: {
    color: "#92400E",
    fontWeight: "900",
    fontSize: 18,
    marginBottom: 10,
  },
  soldOutSection: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
    borderWidth: 1,
    padding: 16,
    borderRadius: 24,
    marginBottom: 18,
  },
  soldOutSectionTitle: {
    color: "#991B1B",
    fontWeight: "900",
    fontSize: 18,
    marginBottom: 10,
  },
  alertEmptyText: {
    color: COLORS.muted,
    fontWeight: "800",
  },
  alertItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  alertWarningRow: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FBBF24",
  },
  alertCriticalRow: {
    backgroundColor: "#FFEDD5",
    borderColor: "#FDBA74",
  },
  alertSoldRow: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
  },
  alertItemName: {
    color: COLORS.text,
    fontWeight: "900",
  },
  alertItemSub: {
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 12,
    marginTop: 3,
  },
  alertItemQty: {
    color: "#92400E",
    fontWeight: "900",
    fontSize: 20,
  },
  alertSoldQty: {
    color: "#991B1B",
  },
  sectionHeader: { marginTop: 6, marginBottom: 12 },
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
  emptyIcon: { fontSize: 46, marginBottom: 10 },
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
  emptyActionText: { color: "#FFFFFF", fontWeight: "900" },
  emptySecondaryButton: {
    backgroundColor: COLORS.lightGreen,
    borderWidth: 1,
    borderColor: COLORS.primary,
    padding: 15,
    borderRadius: 18,
    marginTop: 10,
    alignItems: "center",
    alignSelf: "stretch",
  },
  emptySecondaryText: {
    color: COLORS.primaryDark,
    fontWeight: "900",
    textAlign: "center",
  },
  productCard: {
    backgroundColor: COLORS.card,
    borderRadius: 30,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  productWarningCard: {
    borderColor: "#FBBF24",
    backgroundColor: "#FFFBEB",
  },
  productCriticalCard: {
    borderColor: "#FDBA74",
    backgroundColor: "#FFF7ED",
  },
  productSoldOutCard: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
  },
  productImage: {
    width: "100%",
    height: 210,
    backgroundColor: COLORS.softGreen,
  },
  productBody: { padding: 16 },
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
  inventoryTotalBox: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
  },
  inventoryTotalLabel: {
    color: COLORS.muted,
    fontWeight: "900",
    fontSize: 12,
  },
  inventoryTotalValue: {
    color: COLORS.primary,
    fontWeight: "900",
    fontSize: 28,
    marginTop: 4,
  },
  inventoryWarningText: {
    color: "#92400E",
  },
  inventoryCriticalText: {
    color: "#C2410C",
  },
  inventorySoldText: {
    color: "#991B1B",
  },
  inventoryThresholdText: {
    color: COLORS.muted,
    fontWeight: "800",
    marginTop: 4,
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
    backgroundColor: COLORS.redSoft,
    color: COLORS.redText,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
  },
  criticalBadge: {
    backgroundColor: "#FFEDD5",
    color: "#C2410C",
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
  },
  lowStockBadge: {
    backgroundColor: COLORS.yellow,
    color: COLORS.yellowText,
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
  removeStockButton: {
    backgroundColor: COLORS.orange,
    padding: 15,
    borderRadius: 18,
    marginTop: 10,
  },
  removeStockText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "900",
  },
  deleteButton: {
    backgroundColor: COLORS.redSoft,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    padding: 15,
    borderRadius: 18,
    marginTop: 10,
  },
  deleteText: {
    color: COLORS.redText,
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
  reviewBody: { flex: 1 },
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
  reviewRating: { fontWeight: "900", color: COLORS.primary },
  reviewText: {
    marginTop: 5,
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
  },
  pressed: { opacity: 0.75 },
});