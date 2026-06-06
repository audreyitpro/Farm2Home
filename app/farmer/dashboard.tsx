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
  bg: "#F5F7F2",
  card: "#FFFFFF",
  text: "#102015",
  muted: "#6F7D68",
  border: "#E4E9DC",
  primary: "#2E7D32",
  primaryDark: "#14532D",
  primarySoft: "#EAF6E8",
  yellow: "#F9A825",
  orange: "#EF6C00",
  red: "#DC2626",
  redSoft: "#FEE2E2",
  redText: "#991B1B",
  blue: "#1565C0",
  purple: "#7C3AED",
  dark: "#111827",
  stripe: "#635BFF",
  warningBg: "#FFFBEB",
  warningText: "#92400E",
  criticalBg: "#FFF7ED",
  criticalText: "#C2410C",
  successBg: "#DCFCE7",
  successText: "#166534",
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

function removeNonNumber(value: string) {
  return String(value || "").replace(/[^0-9.]/g, "");
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

    if (error) console.log("Save farmer products error:", error.message);
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

      if (updatedItem) await updateProductStockInSupabase(updatedItem, getStock(updatedItem));

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

      await updateProductStockInSupabase(updatedItem || product, newStock);

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
              Alert.alert("Remove Error", error?.message || "Unable to remove product.");
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

  const topProducts = visibleProducts.slice(0, 4);

  if (loading) {
    return (
      <View style={styles.loadingPage}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingTitle}>Loading farmer dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.kicker}>Farm2Home Seller Center</Text>
              <Text style={styles.heroTitle}>{farmName}</Text>
              <Text style={styles.heroSubtitle}>
                Manage your storefront, inventory, orders, delivery, and payout status.
              </Text>
            </View>

            <Pressable style={styles.logoutPill} onPress={logoutFarmer}>
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </View>

          <View style={styles.statusPill}>
            <Text style={styles.statusDot}>●</Text>
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>

          <View style={styles.heroStatsRow}>
            <HeroStat value={String(visibleProducts.length)} label="Listed" />
            <HeroStat value={String(totalStock)} label="Units" />
            <HeroStat value={`$${totalGrossSales.toFixed(0)}`} label="Sales" />
          </View>

          <View style={styles.heroButtons}>
            <Pressable style={styles.primaryButton} onPress={() => goTo("/farmer/select-produce")}>
              <Text style={styles.primaryButtonText}>🥬 Select Produce</Text>
            </Pressable>

            <Pressable style={styles.secondaryButton} onPress={() => goTo("/farmer/add-product")}>
              <Text style={styles.secondaryButtonText}>＋ Add Product</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <Text style={styles.sectionSub}>Run your farm store from one place.</Text>
          </View>
        </View>

        <View style={styles.actionGrid}>
          <ActionButton label="Store Setup" icon="🏪" color={COLORS.primaryDark} onPress={() => goTo("/farmer/setup-store")} />
          <ActionButton label="Orders" icon="📦" color={COLORS.blue} onPress={() => goTo("/farmer/orders")} />
          <ActionButton label="Delivery" icon="🚚" color={COLORS.orange} onPress={() => goTo("/farmer/delivery-orders")} />
          <ActionButton label="Payouts" icon="💳" color={COLORS.stripe} onPress={() => goTo("/farmer/connect-bank")} />
          <ActionButton label="Profile" icon="👤" color={COLORS.purple} onPress={() => goTo("/farmer/profile")} />
          <ActionButton label="Market Preview" icon="🛒" color={COLORS.yellow} onPress={() => goTo("/customer/marketplace")} />
        </View>

        <View style={styles.insightGrid}>
          <InsightCard label="Products Listed" value={String(visibleProducts.length)} icon="🥬" />
          <InsightCard label="Total Inventory" value={String(totalStock)} icon="📦" />
          <InsightCard label="Units Sold" value={String(totalSold)} icon="📈" />
          <InsightCard label="Gross Sales" value={`$${totalGrossSales.toFixed(2)}`} icon="💵" />
          <InsightCard label="Low Stock" value={String(lowStockProducts.length)} icon="⚠️" />
          <InsightCard label="Sold Out" value={String(soldOutProducts.length)} icon="🔴" />
        </View>

        <InventoryAlertSection
          title="Inventory Alerts"
          products={lowStockProducts}
          soldOutProducts={soldOutProducts}
        />

        {topProducts.length > 0 && (
          <>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Top Inventory Snapshot</Text>
                <Text style={styles.sectionSub}>Your first listed products.</Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.topProductsScroller}>
              {topProducts.map((item: any) => (
                <View key={`top-${item.id}`} style={styles.topProductCard}>
                  <Image source={{ uri: getProductImage(item) }} style={styles.topProductImage} />
                  <Text style={styles.topProductName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.topProductMeta}>{getStock(item)} {item.unit || "each"} available</Text>
                </View>
              ))}
            </ScrollView>
          </>
        )}

        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Farm Inventory</Text>
            <Text style={styles.sectionSub}>
              Add stock, reduce stock, or remove unwanted products from your farm list.
            </Text>
          </View>
        </View>

        {visibleProducts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🥬</Text>
            <Text style={styles.emptyTitle}>No farmer products yet</Text>
            <Text style={styles.emptyText}>
              Select common produce from the Farm2Home catalog or add your own custom farm product.
            </Text>

            <Pressable style={styles.emptyPrimary} onPress={() => goTo("/farmer/select-produce")}>
              <Text style={styles.emptyPrimaryText}>Select Produce</Text>
            </Pressable>

            <Pressable style={styles.emptySecondary} onPress={() => goTo("/farmer/add-product")}>
              <Text style={styles.emptySecondaryText}>Add Custom Product</Text>
            </Pressable>
          </View>
        ) : (
          visibleProducts.map((item: any) => {
            const stock = getStock(item);
            const threshold = getThreshold(item);
            const status = getStockStatus(item);
            const badge = getBadge(status);

            return (
              <View key={item.id} style={styles.inventoryCard}>
                <Image source={{ uri: getProductImage(item) }} style={styles.inventoryImage} />

                <View style={styles.inventoryBody}>
                  <View style={styles.inventoryTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productName}>{item.name}</Text>
                      <Text style={styles.productCategory}>{item.category || "Farm Goods"}</Text>
                    </View>

                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
                    </View>
                  </View>

                  <View style={styles.stockBox}>
                    <View>
                      <Text style={styles.stockLabel}>Current Stock</Text>
                      <Text style={styles.stockValue}>{stock} {item.unit || "each"}</Text>
                    </View>
                    <View style={styles.thresholdBox}>
                      <Text style={styles.thresholdLabel}>Low Alert</Text>
                      <Text style={styles.thresholdValue}>{threshold}</Text>
                    </View>
                  </View>

                  <View style={styles.productMetrics}>
                    <Metric label="Price" value={`$${Number(item.price || 0).toFixed(2)}`} />
                    <Metric label="Sold" value={String(Number(item.sold || 0))} />
                    <Metric label="Gross" value={`$${Number(item.grossSales || 0).toFixed(2)}`} />
                    <Metric label="Delivery" value={item.deliveryOption || item.delivery_option || "Not set"} />
                  </View>

                  <View style={styles.stockControlBox}>
                    <Text style={styles.controlTitle}>Inventory Controls</Text>

                    <View style={styles.controlRow}>
                      <TextInput
                        style={styles.controlInput}
                        placeholder="Add qty"
                        placeholderTextColor="#8A9482"
                        keyboardType="numeric"
                        value={restockAmounts[item.id] || ""}
                        onChangeText={(text) =>
                          setRestockAmounts((prev) => ({ ...prev, [item.id]: text }))
                        }
                      />

                      <Pressable style={styles.addStockButton} onPress={() => restockProduct(item.id)}>
                        <Text style={styles.addStockText}>Add</Text>
                      </Pressable>
                    </View>

                    <View style={styles.controlRow}>
                      <TextInput
                        style={styles.controlInput}
                        placeholder="Remove qty"
                        placeholderTextColor="#8A9482"
                        keyboardType="numeric"
                        value={removeAmounts[item.id] || ""}
                        onChangeText={(text) =>
                          setRemoveAmounts((prev) => ({ ...prev, [item.id]: text }))
                        }
                      />

                      <Pressable style={styles.reduceStockButton} onPress={() => removeInventory(item.id)}>
                        <Text style={styles.reduceStockText}>Reduce</Text>
                      </Pressable>
                    </View>

                    <Pressable style={styles.deleteProductButton} onPress={() => deleteProduct(item.id)}>
                      <Text style={styles.deleteProductText}>Remove Product From Farm Inventory</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })
        )}

        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Customer Reviews</Text>
            <Text style={styles.sectionSub}>Recent customer feedback.</Text>
          </View>
        </View>

        {reviews.map((review) => (
          <View key={review.id} style={styles.reviewCard}>
            <View style={styles.reviewAvatar}>
              <Text style={styles.reviewAvatarText}>{review.customer.slice(0, 1)}</Text>
            </View>

            <View style={styles.reviewBody}>
              <View style={styles.reviewTop}>
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

function getBadge(status: string) {
  if (status === "soldout") {
    return { label: "Sold Out", bg: COLORS.redSoft, text: COLORS.redText };
  }

  if (status === "critical") {
    return { label: "Critical", bg: COLORS.criticalBg, text: COLORS.criticalText };
  }

  if (status === "warning") {
    return { label: "Low Stock", bg: COLORS.warningBg, text: COLORS.warningText };
  }

  return { label: "Available", bg: COLORS.successBg, text: COLORS.successText };
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
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
    <Pressable style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]} onPress={onPress}>
      <View style={[styles.actionIconCircle, { backgroundColor: color }]}>
        <Text style={styles.actionIcon}>{icon}</Text>
      </View>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function InsightCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={styles.insightCard}>
      <Text style={styles.insightIcon}>{icon}</Text>
      <Text style={styles.insightValue}>{value}</Text>
      <Text style={styles.insightLabel}>{label}</Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function InventoryAlertSection({
  title,
  products,
  soldOutProducts,
}: {
  title: string;
  products: Product[];
  soldOutProducts: Product[];
}) {
  const allAlerts = [...products, ...soldOutProducts];

  return (
    <View style={styles.alertPanel}>
      <View style={styles.alertPanelTop}>
        <View>
          <Text style={styles.alertTitle}>{title}</Text>
          <Text style={styles.alertSub}>Low stock and sold-out products.</Text>
        </View>
        <Text style={styles.alertCount}>{allAlerts.length}</Text>
      </View>

      {allAlerts.length === 0 ? (
        <Text style={styles.alertEmpty}>No urgent inventory alerts right now.</Text>
      ) : (
        allAlerts.map((item: any) => {
          const status = getStockStatus(item);
          const badge = getBadge(status);

          return (
            <View key={`alert-${item.id}`} style={styles.alertRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertProductName}>{item.name}</Text>
                <Text style={styles.alertProductSub}>
                  Stock: {getStock(item)} · Threshold: {getThreshold(item)}
                </Text>
              </View>

              <View style={[styles.smallBadge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.smallBadgeText, { color: badge.text }]}>{badge.label}</Text>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loadingPage: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingTitle: {
    marginTop: 14,
    color: COLORS.muted,
    fontWeight: "900",
    textAlign: "center",
  },
  content: {
    padding: 18,
    paddingBottom: 44,
  },
  hero: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 34,
    padding: 20,
    marginBottom: 18,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  kicker: {
    color: "#BBF7D0",
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 31,
    fontWeight: "900",
  },
  heroSubtitle: {
    color: "#DCFCE7",
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 285,
  },
  logoutPill: {
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    height: 42,
  },
  logoutText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  statusPill: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 16,
  },
  statusDot: {
    color: COLORS.primary,
    fontSize: 12,
  },
  statusText: {
    color: COLORS.text,
    fontWeight: "900",
  },
  heroStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  heroStat: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 20,
    padding: 13,
  },
  heroStatValue: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
  },
  heroStatLabel: {
    color: "#DCFCE7",
    fontWeight: "800",
    fontSize: 12,
    marginTop: 3,
  },
  heroButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: COLORS.primaryDark,
    fontWeight: "900",
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: COLORS.yellow,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontWeight: "900",
  },
  sectionHeaderRow: {
    marginTop: 4,
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
  },
  sectionSub: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3,
    lineHeight: 20,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },
  actionButton: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    minHeight: 98,
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  actionIcon: {
    fontSize: 22,
  },
  actionText: {
    color: COLORS.text,
    fontWeight: "900",
  },
  insightGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },
  insightCard: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 15,
  },
  insightIcon: {
    fontSize: 22,
    marginBottom: 8,
  },
  insightValue: {
    color: COLORS.primary,
    fontWeight: "900",
    fontSize: 22,
  },
  insightLabel: {
    color: COLORS.muted,
    fontWeight: "800",
    fontSize: 12,
    marginTop: 3,
  },
  alertPanel: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 18,
  },
  alertPanelTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  alertTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 19,
  },
  alertSub: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3,
  },
  alertCount: {
    backgroundColor: COLORS.primarySoft,
    color: COLORS.primaryDark,
    fontWeight: "900",
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  alertEmpty: {
    color: COLORS.muted,
    fontWeight: "800",
  },
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    backgroundColor: COLORS.bg,
    borderRadius: 18,
    marginTop: 8,
  },
  alertProductName: {
    color: COLORS.text,
    fontWeight: "900",
  },
  alertProductSub: {
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 12,
    marginTop: 3,
  },
  smallBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  smallBadgeText: {
    fontWeight: "900",
    fontSize: 11,
  },
  topProductsScroller: {
    marginBottom: 18,
  },
  topProductCard: {
    width: 156,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 10,
    marginRight: 10,
  },
  topProductImage: {
    width: "100%",
    height: 92,
    borderRadius: 18,
    backgroundColor: COLORS.primarySoft,
  },
  topProductName: {
    color: COLORS.text,
    fontWeight: "900",
    marginTop: 9,
  },
  topProductMeta: {
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 12,
    marginTop: 3,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 24,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 6,
  },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
    textAlign: "center",
  },
  emptyPrimary: {
    alignSelf: "stretch",
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    padding: 15,
    marginTop: 14,
    alignItems: "center",
  },
  emptyPrimaryText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  emptySecondary: {
    alignSelf: "stretch",
    backgroundColor: COLORS.primarySoft,
    borderRadius: 18,
    padding: 15,
    marginTop: 10,
    alignItems: "center",
  },
  emptySecondaryText: {
    color: COLORS.primaryDark,
    fontWeight: "900",
  },
  inventoryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    overflow: "hidden",
  },
  inventoryImage: {
    width: "100%",
    height: 190,
    backgroundColor: COLORS.primarySoft,
  },
  inventoryBody: {
    padding: 16,
  },
  inventoryTopRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 12,
  },
  productName: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 22,
  },
  productCategory: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  badgeText: {
    fontWeight: "900",
    fontSize: 12,
  },
  stockBox: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 22,
    padding: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  stockLabel: {
    color: COLORS.primaryDark,
    fontWeight: "900",
    fontSize: 12,
  },
  stockValue: {
    color: COLORS.primaryDark,
    fontWeight: "900",
    fontSize: 28,
    marginTop: 3,
  },
  thresholdBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 11,
    minWidth: 78,
    alignItems: "center",
  },
  thresholdLabel: {
    color: COLORS.muted,
    fontWeight: "900",
    fontSize: 11,
  },
  thresholdValue: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 18,
    marginTop: 2,
  },
  productMetrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  metricCard: {
    width: "48%",
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    padding: 11,
  },
  metricLabel: {
    color: COLORS.muted,
    fontWeight: "900",
    fontSize: 11,
    marginBottom: 4,
  },
  metricValue: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 12,
  },
  stockControlBox: {
    backgroundColor: COLORS.bg,
    borderRadius: 22,
    padding: 13,
  },
  controlTitle: {
    color: COLORS.text,
    fontWeight: "900",
    marginBottom: 10,
  },
  controlRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 9,
  },
  controlInput: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: COLORS.text,
    fontWeight: "800",
  },
  addStockButton: {
    width: 88,
    backgroundColor: COLORS.dark,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  addStockText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  reduceStockButton: {
    width: 88,
    backgroundColor: COLORS.orange,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  reduceStockText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  deleteProductButton: {
    backgroundColor: COLORS.redSoft,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    marginTop: 2,
  },
  deleteProductText: {
    color: COLORS.redText,
    fontWeight: "900",
    textAlign: "center",
  },
  reviewCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
  },
  reviewAvatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: COLORS.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  reviewAvatarText: {
    color: COLORS.primaryDark,
    fontWeight: "900",
    fontSize: 18,
  },
  reviewBody: {
    flex: 1,
  },
  reviewTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  reviewName: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
  },
  reviewRating: {
    color: COLORS.primary,
    fontWeight: "900",
  },
  reviewText: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 5,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.75,
  },
});