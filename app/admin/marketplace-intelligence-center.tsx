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

import { supabase } from "../data/supabaseClient";
import ProtectedRoute from "../components/ProtectedRoute";

const screenWidth = Dimensions.get("window").width;

type ProductRow = {
  id: string;
  name?: string;
  category?: string;
  price?: number;
  stock?: number;
  quantity?: number;
  sold?: number;
  grossSales?: number;
  farm_name?: string;
};

type MarketInsight = {
  id: string;
  title: string;
  message: string;
  type: "PRICING" | "DEMAND" | "SUPPLY" | "PROFIT" | "SEASONAL";
};

export default function MarketplaceIntelligenceCenter() {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loads, setLoads] = useState<any[]>([]);
  const [insights, setInsights] = useState<MarketInsight[]>([]);

  useFocusEffect(
    React.useCallback(() => {
      loadMarketplaceIntelligence();
    }, [])
  );

  async function loadMarketplaceIntelligence() {
    try {
      setLoading(true);

      const { data: productData } = await supabase.from("products").select("*");
      const { data: orderData } = await supabase.from("orders").select("*");
      const { data: loadData } = await supabase.from("freight_loads").select("*");

      const cleanProducts = (productData || []) as ProductRow[];
      const cleanOrders = orderData || [];
      const cleanLoads = loadData || [];

      setProducts(cleanProducts);
      setOrders(cleanOrders);
      setLoads(cleanLoads);
      setInsights(buildInsights(cleanProducts, cleanOrders, cleanLoads));
    } catch (error) {
      console.log("Marketplace intelligence error:", error);
    } finally {
      setLoading(false);
    }
  }

  function getStock(item: ProductRow) {
    return Number(item.stock ?? item.quantity ?? 0);
  }

  function buildInsights(
    productRows: ProductRow[],
    orderRows: any[],
    loadRows: any[]
  ): MarketInsight[] {
    const results: MarketInsight[] = [];

    const lowStock = productRows.filter((item) => {
      const stock = getStock(item);
      return stock > 0 && stock <= 5;
    });

    if (lowStock.length > 0) {
      results.push({
        id: "low-stock",
        title: "Supply Pressure Detected",
        message: `${lowStock.length} products are approaching low inventory. AI recommends restock alerts and controlled promotion to avoid overselling.`,
        type: "SUPPLY",
      });
    }

    const soldOut = productRows.filter((item) => getStock(item) <= 0);

    if (soldOut.length > 0) {
      results.push({
        id: "sold-out",
        title: "Lost Revenue Risk",
        message: `${soldOut.length} products appear sold out. AI recommends farmer restock outreach and substitute product recommendations.`,
        type: "PROFIT",
      });
    }

    const avgOrderValue =
      orderRows.length > 0
        ? orderRows.reduce((sum, item) => sum + Number(item.total || 0), 0) /
          orderRows.length
        : 0;

    if (avgOrderValue > 0) {
      results.push({
        id: "aov",
        title: "Average Order Value Opportunity",
        message: `Current average order value is about $${avgOrderValue.toFixed(
          0
        )}. AI recommends bundle pricing to raise basket size.`,
        type: "PRICING",
      });
    }

    const coldChainLoads = loadRows.filter(
      (item) =>
        item.temperature_controlled ||
        String(item.commodity || "").toLowerCase().includes("dairy") ||
        String(item.commodity || "").toLowerCase().includes("meat") ||
        String(item.commodity || "").toLowerCase().includes("fish") ||
        String(item.commodity || "").toLowerCase().includes("eggs")
    );

    if (coldChainLoads.length > 0) {
      results.push({
        id: "cold-chain",
        title: "Premium Freight Pricing Signal",
        message: `${coldChainLoads.length} cold-chain or perishable loads detected. AI recommends premium logistics pricing and priority carrier matching.`,
        type: "PRICING",
      });
    }

    results.push({
      id: "seasonal",
      title: "Seasonal Produce Strategy",
      message:
        "AI recommends seasonal promotions for locally available produce, subscription boxes, and family-size bundles to improve retention.",
      type: "SEASONAL",
    });

    return results;
  }

  const totalRevenue = useMemo(
    () => orders.reduce((sum, item) => sum + Number(item.total || 0), 0),
    [orders]
  );

  const freightOpportunity = useMemo(
    () => loads.reduce((sum, item) => sum + Number(item.rate || 0), 0),
    [loads]
  );

  const avgProductPrice = useMemo(() => {
    if (products.length === 0) return 0;
    return (
      products.reduce((sum, item) => sum + Number(item.price || 0), 0) /
      products.length
    );
  }, [products]);

  const lowStockCount = products.filter((item) => {
    const stock = getStock(item);
    return stock > 0 && stock <= 5;
  }).length;

  const soldOutCount = products.filter((item) => getStock(item) <= 0).length;

  const pricingHealth = useMemo(() => {
    let score = 90;

    score -= lowStockCount * 2;
    score -= soldOutCount * 4;

    if (avgProductPrice < 3 && products.length > 0) {
      score -= 8;
    }

    return Math.max(score, 55);
  }, [lowStockCount, soldOutCount, avgProductPrice, products.length]);

  function insightColor(type: MarketInsight["type"]) {
    switch (type) {
      case "PRICING":
        return "#10B981";
      case "DEMAND":
        return "#2563EB";
      case "SUPPLY":
        return "#F59E0B";
      case "PROFIT":
        return "#DC2626";
      case "SEASONAL":
        return "#7C3AED";
      default:
        return "#10B981";
    }
  }

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>📈</Text>

          <Text style={styles.heroTitle}>Marketplace Intelligence Center</Text>

          <Text style={styles.heroSubtitle}>
            AI pricing, farmer revenue optimization, produce demand forecasting,
            supply risk alerts, and marketplace growth intelligence.
          </Text>
        </View>

        <ScrollView
          style={styles.panel}
          contentContainerStyle={styles.panelInner}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={loadMarketplaceIntelligence}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.navRow}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => router.push("/admin/executive-command-center")}
            >
              <Text style={styles.navText}>Executive</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButtonOutline}
              onPress={() => router.push("/admin/predictive-analytics-center")}
            >
              <Text style={styles.navTextOutline}>Analytics</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={styles.loadingText}>
                AI analyzing marketplace intelligence...
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Marketplace KPIs</Text>

              <View style={styles.grid}>
                <MetricCard label="Products" value={products.length} />
                <MetricCard label="Orders" value={orders.length} />
                <MetricCard
                  label="Revenue"
                  value={`$${totalRevenue.toFixed(0)}`}
                />
                <MetricCard
                  label="Freight Value"
                  value={`$${freightOpportunity.toFixed(0)}`}
                />
                <MetricCard label="Low Stock" value={lowStockCount} />
                <MetricCard label="Sold Out" value={soldOutCount} />
                <MetricCard
                  label="Avg Price"
                  value={`$${avgProductPrice.toFixed(2)}`}
                />
                <MetricCard label="Pricing Health" value={`${pricingHealth}%`} />
              </View>

              <Text style={styles.sectionTitle}>AI Dynamic Pricing</Text>

              <View style={styles.pricingCard}>
                <Text style={styles.pricingTitle}>Recommended Pricing Strategy</Text>

                <Text style={styles.pricingText}>
                  AI recommends bundle pricing for household staples, premium
                  pricing for cold-chain and specialty goods, and restock-based
                  promotion controls for low inventory items.
                </Text>

                <View style={styles.pricingRow}>
                  <View style={styles.priceBox}>
                    <Text style={styles.priceValue}>+8%</Text>
                    <Text style={styles.priceLabel}>Premium Goods</Text>
                  </View>

                  <View style={styles.priceBox}>
                    <Text style={styles.priceValue}>-5%</Text>
                    <Text style={styles.priceLabel}>Bundles</Text>
                  </View>

                  <View style={styles.priceBox}>
                    <Text style={styles.priceValue}>+12%</Text>
                    <Text style={styles.priceLabel}>Cold Chain</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.sectionTitle}>AI Marketplace Insights</Text>

              {insights.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No insights yet.</Text>
                  <Text style={styles.emptyText}>
                    Marketplace insights will appear as product, order, and
                    freight activity grows.
                  </Text>
                </View>
              ) : (
                insights.map((item) => (
                  <View key={item.id} style={styles.insightCard}>
                    <View style={styles.insightHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.insightTitle}>{item.title}</Text>
                      </View>

                      <View
                        style={[
                          styles.typeBadge,
                          { backgroundColor: insightColor(item.type) },
                        ]}
                      >
                        <Text style={styles.typeText}>{item.type}</Text>
                      </View>
                    </View>

                    <Text style={styles.insightText}>{item.message}</Text>
                  </View>
                ))
              )}

              <Text style={styles.sectionTitle}>Top Product Signals</Text>

              {products.slice(0, 8).map((item) => {
                const stock = getStock(item);

                return (
                  <View key={item.id} style={styles.productCard}>
                    <View style={styles.insightHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.productTitle}>
                          {item.name || "Farm Product"}
                        </Text>

                        <Text style={styles.productSub}>
                          {item.category || "General"} · $
                          {Number(item.price || 0).toFixed(2)}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.stockBadge,
                          {
                            backgroundColor:
                              stock <= 0
                                ? "#DC2626"
                                : stock <= 5
                                ? "#F59E0B"
                                : "#10B981",
                          },
                        ]}
                      >
                        <Text style={styles.stockText}>
                          {stock <= 0 ? "OUT" : `${stock} left`}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.productText}>
                      AI pricing signal:{" "}
                      {stock <= 0
                        ? "restock required before promotion"
                        : stock <= 5
                        ? "avoid discounting; preserve margin"
                        : "eligible for bundle promotion"}
                    </Text>
                  </View>
                );
              })}

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
}: {
  label: string;
  value: string | number;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },

  hero: {
    backgroundColor: "#111827",
    paddingTop: 64,
    paddingBottom: 28,
    paddingHorizontal: 20,
    alignItems: "center",
  },

  heroIcon: {
    fontSize: 56,
    marginBottom: 12,
  },

  heroTitle: {
    color: "#FFFFFF",
    fontSize: 31,
    fontWeight: "900",
    marginBottom: 10,
    textAlign: "center",
  },

  heroSubtitle: {
    color: "#D1D5DB",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 640,
  },

  panel: {
    flex: 1,
    marginTop: -24,
    backgroundColor: "#F3F4F6",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },

  panelInner: {
    padding: 18,
    paddingBottom: 80,
  },

  navRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },

  navButton: {
    flex: 1,
    backgroundColor: "#10B981",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },

  navButtonOutline: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#10B981",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },

  navText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  navTextOutline: {
    color: "#10B981",
    fontWeight: "900",
  },

  loadingCard: {
    backgroundColor: "#FFFFFF",
    padding: 24,
    borderRadius: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  loadingText: {
    color: "#6B7280",
    fontWeight: "800",
    marginTop: 10,
  },

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
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  metricValue: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 6,
  },

  metricLabel: {
    color: "#6B7280",
    fontWeight: "700",
  },

  pricingCard: {
    backgroundColor: "#064E3B",
    borderRadius: 24,
    padding: 20,
    marginBottom: 18,
  },

  pricingTitle: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 10,
  },

  pricingText: {
    color: "#BBF7D0",
    lineHeight: 22,
    fontWeight: "700",
  },

  pricingRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },

  priceBox: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
  },

  priceValue: {
    color: "#064E3B",
    fontSize: 22,
    fontWeight: "900",
  },

  priceLabel: {
    color: "#374151",
    fontWeight: "800",
    fontSize: 11,
    marginTop: 4,
    textAlign: "center",
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  emptyTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 6,
  },

  emptyText: {
    color: "#6B7280",
    lineHeight: 22,
    fontWeight: "700",
  },

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

  insightTitle: {
    color: "#111827",
    fontSize: 19,
    fontWeight: "900",
  },

  insightText: {
    color: "#374151",
    lineHeight: 22,
    fontWeight: "700",
  },

  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  typeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 10,
  },

  productCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  productTitle: {
    color: "#111827",
    fontSize: 19,
    fontWeight: "900",
  },

  productSub: {
    color: "#6B7280",
    fontWeight: "700",
    marginTop: 4,
  },

  stockBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  stockText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 10,
  },

  productText: {
    color: "#374151",
    lineHeight: 22,
    fontWeight: "700",
  },
});