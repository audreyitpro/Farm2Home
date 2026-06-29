import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";
import ProtectedRoute from "../components/ProtectedRoute";
import { useAuth } from "../providers/AuthProvider";

const screenWidth = Dimensions.get("window").width;

type FarmerProduct = {
  id: string;
  farmer_id?: string;
  name?: string;
  category?: string;
  price?: number;
  stock?: number;
  quantity?: number;
  sold?: number;
  bundle_eligible?: boolean;
  marketplace_visible?: boolean;
};

type GrowthInsight = {
  id: string;
  title: string;
  message: string;
  action: string;
  type: "REVENUE" | "YIELD" | "DEMAND" | "SEASONAL" | "INVENTORY" | "BUNDLES";
};

export default function FarmAiGrowthCenter() {
  const { user, profile } = useAuth();

  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<FarmerProduct[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [insights, setInsights] = useState<GrowthInsight[]>([]);

  const farmerId = useMemo(() => {
    return (
      user?.id ||
      (profile as any)?.id ||
      (profile as any)?.farmer_id ||
      (profile as any)?.user_id ||
      null
    );
  }, [user?.id, profile]);

  useFocusEffect(
    React.useCallback(() => {
      if (!farmerId) {
        setProducts([]);
        setOrders([]);
        setInsights(buildInsights([], []));
        return;
      }

      loadGrowthData(farmerId);
    }, [farmerId])
  );

  async function loadGrowthData(activeFarmerId?: string | null) {
    const currentFarmerId = activeFarmerId || farmerId;

    if (!currentFarmerId) {
      console.log("Farm AI Growth Center: farmerId missing. Skipping Supabase query.");
      return;
    }

    try {
      setLoading(true);

      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("farmer_id", currentFarmerId);

      if (productError) {
        console.log("Farm AI products error:", productError);
      }

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("farmer_id", currentFarmerId);

      if (orderError) {
        console.log("Farm AI orders error:", orderError);
      }

      const cleanProducts = (productData || []) as FarmerProduct[];
      const cleanOrders = orderData || [];

      setProducts(cleanProducts);
      setOrders(cleanOrders);
      setInsights(buildInsights(cleanProducts, cleanOrders));
    } catch (error) {
      console.log("Farm AI growth error:", error);
    } finally {
      setLoading(false);
    }
  }

  function getStock(item: FarmerProduct) {
    return Number(item.stock ?? item.quantity ?? 0);
  }

  function buildInsights(productRows: FarmerProduct[], orderRows: any[]): GrowthInsight[] {
    const results: GrowthInsight[] = [];

    const lowStock = productRows.filter((item) => getStock(item) <= 5);
    const liveProducts = productRows.filter((item) => item.marketplace_visible !== false);
    const bundleReady = productRows.filter((item) => item.bundle_eligible);

    if (lowStock.length > 0) {
      results.push({
        id: "inventory",
        title: "Restock low inventory",
        message: `${lowStock.length} product(s) are at 5 units or less. Low stock can cause missed sales and hurt repeat customers.`,
        action: "Restock inventory",
        type: "INVENTORY",
      });
    }

    if (bundleReady.length < 3 && productRows.length >= 3) {
      results.push({
        id: "bundles",
        title: "Create more bundle-ready products",
        message:
          "You have enough products to build customer boxes, but not enough products are marked bundle-ready.",
        action: "Build bundles",
        type: "BUNDLES",
      });
    }

    if (liveProducts.length < productRows.length) {
      results.push({
        id: "market",
        title: "Publish hidden products",
        message:
          "Some products are hidden from the marketplace. Publishing more products can improve customer discovery.",
        action: "Manage products",
        type: "DEMAND",
      });
    }

    results.push({
      id: "revenue",
      title: "Grow recurring revenue",
      message:
        "Recurring bundle subscriptions can help stabilize monthly farm revenue and reduce one-time sales dependency.",
      action: "Create subscriptions",
      type: "REVENUE",
    });

    results.push({
      id: "seasonal",
      title: "Promote seasonal boxes",
      message:
        "Seasonal produce, meat, seafood, and mixed farm boxes can increase average order value.",
      action: "Create seasonal bundle",
      type: "SEASONAL",
    });

    results.push({
      id: "yield",
      title: "Improve product mix",
      message:
        "Use inventory and order activity to focus on high-demand products while reducing slow-moving stock.",
      action: "Review products",
      type: "YIELD",
    });

    return results;
  }

  const totalRevenue = useMemo(() => {
    return orders.reduce((sum, item) => {
      return sum + Number(item.total || item.order_total || item.total_amount || 0);
    }, 0);
  }, [orders]);

  const liveProducts = useMemo(() => {
    return products.filter((item) => item.marketplace_visible !== false).length;
  }, [products]);

  const bundleReady = useMemo(() => {
    return products.filter((item) => item.bundle_eligible).length;
  }, [products]);

  const lowStockCount = useMemo(() => {
    return products.filter((item) => getStock(item) <= 5).length;
  }, [products]);

  const avgPrice = useMemo(() => {
    if (products.length === 0) return 0;
    return products.reduce((sum, item) => sum + Number(item.price || 0), 0) / products.length;
  }, [products]);

  const aiGrowthScore = useMemo(() => {
    let score = 55;

    score += Math.min(products.length * 3, 18);
    score += Math.min(liveProducts * 3, 15);
    score += Math.min(bundleReady * 4, 16);

    if (orders.length > 0) score += 8;
    if (totalRevenue > 1000) score += 8;
    if (lowStockCount === 0 && products.length > 0) score += 8;

    return Math.min(score, 98);
  }, [products.length, liveProducts, bundleReady, orders.length, totalRevenue, lowStockCount]);

  function insightColor(type: GrowthInsight["type"]) {
    switch (type) {
      case "REVENUE":
        return "#10B981";
      case "YIELD":
        return "#2563EB";
      case "DEMAND":
        return "#7C3AED";
      case "SEASONAL":
        return "#F59E0B";
      case "INVENTORY":
        return "#DC2626";
      case "BUNDLES":
        return "#0F766E";
      default:
        return "#10B981";
    }
  }

  function routeForInsight(type: GrowthInsight["type"]) {
    if (type === "INVENTORY" || type === "YIELD" || type === "DEMAND") {
      router.push("/farmer/inventory-management" as any);
      return;
    }

    if (type === "BUNDLES" || type === "SEASONAL" || type === "REVENUE") {
      router.push("/farmer/farm-bundles" as any);
      return;
    }

    router.push("/farmer/dashboard" as any);
  }

  return (
    <ProtectedRoute allowedRoles={["farmer"]}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push("/farmer/dashboard" as any)}
          >
            <Ionicons name="arrow-back-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.heroBadge}>Farm2Home Farmer Growth</Text>
          <Text style={styles.heroTitle}>AI Growth Center</Text>
          <Text style={styles.heroSubtitle}>
            Turn product, inventory, bundle, and order activity into clear actions
            that help your farm grow.
          </Text>
        </View>

        <ScrollView
          style={styles.panel}
          contentContainerStyle={styles.panelInner}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={() => loadGrowthData(farmerId)} />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.navRow}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => router.push("/farmer/inventory-management" as any)}
            >
              <Ionicons name="archive-outline" size={17} color="#FFFFFF" />
              <Text style={styles.navText}>Products</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButtonOutline}
              onPress={() => router.push("/farmer/farm-bundles" as any)}
            >
              <Ionicons name="basket-outline" size={17} color="#10B981" />
              <Text style={styles.navTextOutline}>Bundles</Text>
            </TouchableOpacity>
          </View>

          {!farmerId ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>⚠️</Text>
              <Text style={styles.emptyTitle}>Farmer profile still loading</Text>
              <Text style={styles.emptyText}>
                Farm2Home could not find a farmer ID yet. Go back to the dashboard and reopen this page after login finishes.
              </Text>
            </View>
          ) : loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={styles.loadingText}>Analyzing farm growth opportunities...</Text>
            </View>
          ) : (
            <>
              {profile ? (
                <View style={styles.profileCard}>
                  <Text style={styles.profileTitle}>
                    Growth profile for {(profile as any).full_name || "your farm"}
                  </Text>
                  <Text style={styles.profileText}>
                    AI reviews your product listings, stock levels, marketplace visibility,
                    and order activity to suggest the next best farm business actions.
                  </Text>
                </View>
              ) : null}

              <View style={styles.scoreCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.scoreLabel}>AI Growth Score</Text>
                  <Text style={styles.scoreValue}>{aiGrowthScore}%</Text>
                  <Text style={styles.scoreText}>
                    Based on products, live listings, bundle readiness, orders, and inventory health.
                  </Text>
                </View>

                <View style={styles.scoreCircle}>
                  <Text style={styles.scoreCircleText}>{aiGrowthScore}</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Farm Growth KPIs</Text>

              <View style={styles.grid}>
                <MetricCard label="Products" value={products.length} icon="leaf-outline" />
                <MetricCard label="Live Market" value={liveProducts} icon="storefront-outline" />
                <MetricCard label="Bundle Ready" value={bundleReady} icon="basket-outline" />
                <MetricCard label="Low Stock" value={lowStockCount} icon="alert-circle-outline" />
                <MetricCard label="Revenue" value={`$${totalRevenue.toFixed(0)}`} icon="cash-outline" />
                <MetricCard label="Avg Price" value={`$${avgPrice.toFixed(2)}`} icon="pricetag-outline" />
              </View>

              <Text style={styles.sectionTitle}>Recommended Growth Actions</Text>

              {insights.map((item) => (
                <View key={item.id} style={styles.insightCard}>
                  <View style={styles.insightHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.insightTitle}>{item.title}</Text>
                    </View>

                    <View style={[styles.typeBadge, { backgroundColor: insightColor(item.type) }]}>
                      <Text style={styles.typeText}>{item.type}</Text>
                    </View>
                  </View>

                  <Text style={styles.insightText}>{item.message}</Text>

                  <TouchableOpacity
                    style={styles.insightButton}
                    onPress={() => routeForInsight(item.type)}
                  >
                    <Text style={styles.insightButtonText}>{item.action}</Text>
                    <Ionicons name="chevron-forward-outline" size={17} color="#064E3B" />
                  </TouchableOpacity>
                </View>
              ))}

              <Text style={styles.sectionTitle}>30-Day Growth Plan</Text>

              <View style={styles.forecastCard}>
                <Text style={styles.forecastTitle}>Next Best Farmer Moves</Text>
                <Text style={styles.forecastText}>
                  Focus on marketplace visibility, subscription bundles, and restocking
                  products before they sell out.
                </Text>

                <View style={styles.planList}>
                  <PlanStep number="1" text="Restock low inventory products." />
                  <PlanStep number="2" text="Mark best products as bundle-ready." />
                  <PlanStep number="3" text="Create monthly or bi-monthly customer bundles." />
                  <PlanStep number="4" text="Promote seasonal boxes to increase order value." />
                </View>
              </View>

              <Text style={styles.sectionTitle}>Product Performance</Text>

              {products.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyEmoji}>🌱</Text>
                  <Text style={styles.emptyTitle}>No products yet</Text>
                  <Text style={styles.emptyText}>
                    Add products first so AI can analyze inventory, pricing, bundles, and demand.
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyButton}
                    onPress={() => router.push("/farmer/add-product" as any)}
                  >
                    <Text style={styles.emptyButtonText}>Add Product</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                products.slice(0, 8).map((item) => {
                  const stock = getStock(item);

                  return (
                    <View key={item.id} style={styles.productCard}>
                      <View style={styles.productHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.productTitle}>
                            {item.name || "Farm Product"}
                          </Text>
                          <Text style={styles.productSub}>
                            {item.category || "General"} · ${Number(item.price || 0).toFixed(2)}
                          </Text>
                        </View>

                        <View style={[styles.stockBadge, stock <= 5 && styles.stockBadgeLow]}>
                          <Text style={styles.stockText}>{stock} left</Text>
                        </View>
                      </View>

                      <Text style={styles.productText}>
                        {stock <= 5
                          ? "AI recommends restocking before promoting this product in bundles."
                          : "AI recommends testing this product in seasonal or recurring customer bundles."}
                      </Text>
                    </View>
                  );
                })
              )}

              <View style={{ height: 80 }} />
            </>
          )}
        </ScrollView>
      </View>
    </ProtectedRoute>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricIcon}>
        <Ionicons name={icon} size={18} color="#064E3B" />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function PlanStep({ number, text }: { number: string; text: string }) {
  return (
    <View style={styles.planStep}>
      <Text style={styles.planNumber}>{number}</Text>
      <Text style={styles.planText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  hero: {
    backgroundColor: "#14532D",
    paddingTop: 58,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroBadge: {
    color: "#BBF7D0",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 10,
  },
  heroSubtitle: {
    color: "#DCFCE7",
    lineHeight: 22,
    fontWeight: "700",
  },
  panel: {
    flex: 1,
    marginTop: -20,
    backgroundColor: "#F3F4F6",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  panelInner: { padding: 18, paddingBottom: 80 },
  navRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  navButton: {
    flex: 1,
    backgroundColor: "#10B981",
    padding: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  navButtonOutline: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#10B981",
    padding: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  navText: { color: "#FFFFFF", fontWeight: "900" },
  navTextOutline: { color: "#10B981", fontWeight: "900" },
  profileCard: {
    backgroundColor: "#064E3B",
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
  },
  profileTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 8,
  },
  profileText: { color: "#BBF7D0", lineHeight: 22, fontWeight: "700" },
  loadingCard: {
    backgroundColor: "#FFFFFF",
    padding: 24,
    borderRadius: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  loadingText: { color: "#6B7280", fontWeight: "800", marginTop: 10 },
  scoreCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  scoreLabel: { color: "#6B7280", fontWeight: "900" },
  scoreValue: {
    color: "#064E3B",
    fontSize: 42,
    fontWeight: "900",
    marginTop: 2,
  },
  scoreText: { color: "#374151", fontWeight: "700", lineHeight: 21, marginTop: 4 },
  scoreCircle: {
    width: 74,
    height: 74,
    borderRadius: 28,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreCircleText: { color: "#064E3B", fontWeight: "900", fontSize: 22 },
  sectionTitle: {
    color: "#111827",
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  metricCard: {
    width: screenWidth > 600 ? "31%" : "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: 15,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  metricValue: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 5,
  },
  metricLabel: { color: "#6B7280", fontWeight: "800" },
  insightCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  insightTitle: { color: "#111827", fontSize: 19, fontWeight: "900" },
  insightText: { color: "#374151", lineHeight: 22, fontWeight: "700" },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  typeText: { color: "#FFFFFF", fontWeight: "900", fontSize: 10 },
  insightButton: {
    backgroundColor: "#DCFCE7",
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 10,
    marginTop: 14,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  insightButtonText: { color: "#064E3B", fontWeight: "900" },
  forecastCard: {
    backgroundColor: "#064E3B",
    borderRadius: 24,
    padding: 20,
    marginBottom: 18,
  },
  forecastTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 10,
  },
  forecastText: {
    color: "#BBF7D0",
    lineHeight: 22,
    fontWeight: "700",
    marginBottom: 14,
  },
  planList: { gap: 10 },
  planStep: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  planNumber: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    color: "#064E3B",
    textAlign: "center",
    textAlignVertical: "center",
    fontWeight: "900",
    overflow: "hidden",
  },
  planText: { flex: 1, color: "#DCFCE7", fontWeight: "800", lineHeight: 20 },
  productCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  productHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  productTitle: { color: "#111827", fontSize: 19, fontWeight: "900" },
  productSub: { color: "#6B7280", fontWeight: "700", marginTop: 4 },
  stockBadge: {
    backgroundColor: "#10B981",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  stockBadgeLow: { backgroundColor: "#DC2626" },
  stockText: { color: "#FFFFFF", fontWeight: "900", fontSize: 10 },
  productText: { color: "#374151", lineHeight: 22, fontWeight: "700" },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  emptyEmoji: { fontSize: 42 },
  emptyTitle: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 18,
    marginTop: 8,
  },
  emptyText: {
    color: "#6B7280",
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 21,
    marginTop: 6,
  },
  emptyButton: {
    backgroundColor: "#10B981",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: 14,
  },
  emptyButtonText: { color: "#FFFFFF", fontWeight: "900" },
});