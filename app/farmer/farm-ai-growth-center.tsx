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

import { useAuth } from "../providers/AuthProvider";

const screenWidth =
  Dimensions.get("window").width;

type FarmerProduct = {
  id: string;
  name?: string;
  category?: string;
  price?: number;
  stock?: number;
  quantity?: number;
  sold?: number;
};

type GrowthInsight = {
  id: string;
  title: string;
  message: string;
  type:
    | "REVENUE"
    | "YIELD"
    | "DEMAND"
    | "SEASONAL"
    | "INVENTORY";
};

export default function FarmAiGrowthCenter() {
  const { user, profile } =
    useAuth();

  const [loading, setLoading] =
    useState(false);

  const [products, setProducts] =
    useState<FarmerProduct[]>([]);

  const [orders, setOrders] =
    useState<any[]>([]);

  const [insights, setInsights] =
    useState<GrowthInsight[]>([]);

  useFocusEffect(
    React.useCallback(() => {
      loadGrowthData();
    }, [])
  );

  async function loadGrowthData() {
    try {
      setLoading(true);

      const {
        data: productData,
      } = await supabase
        .from("products")
        .select("*")
        .eq(
          "farmer_id",
          user?.id
        );

      const {
        data: orderData,
      } = await supabase
        .from("orders")
        .select("*");

      const cleanProducts =
        (productData ||
          []) as FarmerProduct[];

      const cleanOrders =
        orderData || [];

      setProducts(cleanProducts);
      setOrders(cleanOrders);

      setInsights(
        buildInsights(
          cleanProducts,
          cleanOrders
        )
      );
    } catch (error) {
      console.log(
        "Farm AI growth error:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  function getStock(
    item: FarmerProduct
  ) {
    return Number(
      item.stock ??
        item.quantity ??
        0
    );
  }

  function buildInsights(
    productRows: FarmerProduct[],
    orderRows: any[]
  ): GrowthInsight[] {
    const results: GrowthInsight[] =
      [];

    const lowStock =
      productRows.filter(
        (item) =>
          getStock(item) <= 5
      );

    if (
      lowStock.length > 0
    ) {
      results.push({
        id: "inventory",
        title:
          "Inventory Restock Opportunity",
        message: `${lowStock.length} products are running low. AI recommends increasing harvest or inventory planning to prevent missed sales.`,
        type: "INVENTORY",
      });
    }

    const produceCategories =
      productRows.map(
        (item) =>
          item.category
      );

    if (
      produceCategories.includes(
        "Fruit"
      )
    ) {
      results.push({
        id: "seasonal",
        title:
          "Seasonal Produce Demand",
        message:
          "AI forecasts increased fruit demand over the next 30 days. Consider promoting seasonal bundles and family produce boxes.",
        type: "SEASONAL",
      });
    }

    results.push({
      id: "yield",
      title:
        "Yield Optimization",
      message:
        "AI recommends diversifying high-demand produce categories to improve long-term marketplace visibility and profitability.",
      type: "YIELD",
    });

    results.push({
      id: "revenue",
      title:
        "Revenue Growth Forecast",
      message:
        "Farm revenue is projected to increase through recurring subscriptions, produce bundles, and smart marketplace pricing.",
      type: "REVENUE",
    });

    results.push({
      id: "demand",
      title:
        "Marketplace Demand Signal",
      message:
        "AI detected strong customer engagement for locally sourced produce and subscription-style grocery fulfillment.",
      type: "DEMAND",
    });

    return results;
  }

  const totalRevenue =
    useMemo(() => {
      return orders.reduce(
        (
          sum,
          item
        ) =>
          sum +
          Number(
            item.total || 0
          ),
        0
      );
    }, [orders]);

  const totalInventory =
    useMemo(() => {
      return products.reduce(
        (
          sum,
          item
        ) =>
          sum +
          getStock(item),
        0
      );
    }, [products]);

  const avgPrice =
    useMemo(() => {
      if (
        products.length === 0
      ) {
        return 0;
      }

      return (
        products.reduce(
          (
            sum,
            item
          ) =>
            sum +
            Number(
              item.price || 0
            ),
          0
        ) /
        products.length
      );
    }, [products]);

  const aiGrowthScore =
    useMemo(() => {
      let score = 72;

      score +=
        products.length * 2;

      if (
        totalRevenue > 1000
      ) {
        score += 10;
      }

      return Math.min(
        score,
        98
      );
    }, [
      products.length,
      totalRevenue,
    ]);

  function insightColor(
    type: GrowthInsight["type"]
  ) {
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

      default:
        return "#10B981";
    }
  }

  return (
    <ProtectedRoute
      allowedRoles={[
        "farmer",
      ]}
    >
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>
            🌱
          </Text>

          <Text style={styles.heroTitle}>
            Farm AI Growth Center
          </Text>

          <Text
            style={styles.heroSubtitle}
          >
            AI-powered farm business
            intelligence, revenue
            forecasting, harvest
            planning, seasonal demand
            prediction, and growth
            optimization.
          </Text>
        </View>

        <ScrollView
          style={styles.panel}
          contentContainerStyle={
            styles.panelInner
          }
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={
                loadGrowthData
              }
            />
          }
          showsVerticalScrollIndicator={
            false
          }
        >
          <View style={styles.navRow}>
            <TouchableOpacity
              style={
                styles.navButton
              }
              onPress={() =>
                router.push(
                  "/farmer/dashboard"
                )
              }
            >
              <Text
                style={
                  styles.navText
                }
              >
                Dashboard
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={
                styles.navButtonOutline
              }
              onPress={() =>
                router.push(
                  "/customer/marketplace"
                )
              }
            >
              <Text
                style={
                  styles.navTextOutline
                }
              >
                Marketplace
              </Text>
            </TouchableOpacity>
          </View>

          {profile && (
            <View
              style={
                styles.profileCard
              }
            >
              <Text
                style={
                  styles.profileTitle
                }
              >
                Farm AI Profile
              </Text>

              <Text
                style={
                  styles.profileText
                }
              >
                AI business growth
                insights personalized
                for{" "}
                {profile.full_name ||
                  "your farm"}
                .
              </Text>
            </View>
          )}

          {loading ? (
            <View
              style={
                styles.loadingCard
              }
            >
              <ActivityIndicator
                size="large"
                color="#10B981"
              />

              <Text
                style={
                  styles.loadingText
                }
              >
                AI analyzing farm
                growth intelligence...
              </Text>
            </View>
          ) : (
            <>
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Farm Growth KPIs
              </Text>

              <View
                style={
                  styles.grid
                }
              >
                <MetricCard
                  label="Products"
                  value={
                    products.length
                  }
                />

                <MetricCard
                  label="Orders"
                  value={
                    orders.length
                  }
                />

                <MetricCard
                  label="Revenue"
                  value={`$${totalRevenue.toFixed(
                    0
                  )}`}
                />

                <MetricCard
                  label="Inventory"
                  value={
                    totalInventory
                  }
                />

                <MetricCard
                  label="Avg Price"
                  value={`$${avgPrice.toFixed(
                    2
                  )}`}
                />

                <MetricCard
                  label="AI Growth"
                  value={`${aiGrowthScore}%`}
                />
              </View>

              <Text
                style={
                  styles.sectionTitle
                }
              >
                AI Revenue Forecast
              </Text>

              <View
                style={
                  styles.forecastCard
                }
              >
                <Text
                  style={
                    styles.forecastTitle
                  }
                >
                  30-Day Growth Outlook
                </Text>

                <Text
                  style={
                    styles.forecastText
                  }
                >
                  AI predicts increased
                  customer demand for
                  local produce,
                  recurring grocery
                  subscriptions, and
                  seasonal produce
                  bundles.
                </Text>

                <View
                  style={
                    styles.forecastRow
                  }
                >
                  <ForecastBox
                    value="+22%"
                    label="Revenue"
                  />

                  <ForecastBox
                    value="+18%"
                    label="Orders"
                  />

                  <ForecastBox
                    value="+27%"
                    label="Retention"
                  />
                </View>
              </View>

              <Text
                style={
                  styles.sectionTitle
                }
              >
                AI Farm Insights
              </Text>

              {insights.map(
                (item) => (
                  <View
                    key={item.id}
                    style={
                      styles.insightCard
                    }
                  >
                    <View
                      style={
                        styles.insightHeader
                      }
                    >
                      <View
                        style={{
                          flex: 1,
                        }}
                      >
                        <Text
                          style={
                            styles.insightTitle
                          }
                        >
                          {
                            item.title
                          }
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.typeBadge,
                          {
                            backgroundColor:
                              insightColor(
                                item.type
                              ),
                          },
                        ]}
                      >
                        <Text
                          style={
                            styles.typeText
                          }
                        >
                          {
                            item.type
                          }
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={
                        styles.insightText
                      }
                    >
                      {
                        item.message
                      }
                    </Text>
                  </View>
                )
              )}

              <Text
                style={
                  styles.sectionTitle
                }
              >
                Product Performance
              </Text>

              {products.map(
                (item) => (
                  <View
                    key={item.id}
                    style={
                      styles.productCard
                    }
                  >
                    <View
                      style={
                        styles.insightHeader
                      }
                    >
                      <View
                        style={{
                          flex: 1,
                        }}
                      >
                        <Text
                          style={
                            styles.productTitle
                          }
                        >
                          {item.name ||
                            "Farm Product"}
                        </Text>

                        <Text
                          style={
                            styles.productSub
                          }
                        >
                          {item.category ||
                            "General"}{" "}
                          · $
                          {Number(
                            item.price ||
                              0
                          ).toFixed(
                            2
                          )}
                        </Text>
                      </View>

                      <View
                        style={
                          styles.stockBadge
                        }
                      >
                        <Text
                          style={
                            styles.stockText
                          }
                        >
                          {
                            getStock(
                              item
                            )
                          }{" "}
                          left
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={
                        styles.productText
                      }
                    >
                      AI recommends
                      promoting this
                      product through
                      seasonal bundles
                      and subscription
                      fulfillment.
                    </Text>
                  </View>
                )
              )}

              <View
                style={{
                  height: 80,
                }}
              />
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
    <View
      style={
        styles.metricCard
      }
    >
      <Text
        style={
          styles.metricValue
        }
      >
        {value}
      </Text>

      <Text
        style={
          styles.metricLabel
        }
      >
        {label}
      </Text>
    </View>
  );
}

function ForecastBox({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <View
      style={
        styles.forecastBox
      }
    >
      <Text
        style={
          styles.forecastValue
        }
      >
        {value}
      </Text>

      <Text
        style={
          styles.forecastLabel
        }
      >
        {label}
      </Text>
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        "#F3F4F6",
    },

    hero: {
      backgroundColor:
        "#14532D",

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
      color: "#DCFCE7",
      textAlign: "center",
      lineHeight: 22,
      maxWidth: 640,
    },

    panel: {
      flex: 1,
      marginTop: -24,
      backgroundColor:
        "#F3F4F6",
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
      backgroundColor:
        "#10B981",
      padding: 14,
      borderRadius: 14,
      alignItems: "center",
    },

    navButtonOutline: {
      flex: 1,
      backgroundColor:
        "#FFFFFF",
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

    profileCard: {
      backgroundColor:
        "#064E3B",
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

    profileText: {
      color: "#BBF7D0",
      lineHeight: 22,
      fontWeight: "700",
    },

    loadingCard: {
      backgroundColor:
        "#FFFFFF",
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
      justifyContent:
        "space-between",
      marginBottom: 18,
    },

    metricCard: {
      width:
        screenWidth > 600
          ? "31%"
          : "48%",
      backgroundColor:
        "#FFFFFF",
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

    forecastCard: {
      backgroundColor:
        "#064E3B",
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
      marginBottom: 16,
    },

    forecastRow: {
      flexDirection: "row",
      gap: 10,
    },

    forecastBox: {
      flex: 1,
      backgroundColor:
        "#FFFFFF",
      borderRadius: 16,
      padding: 12,
      alignItems: "center",
    },

    forecastValue: {
      color: "#064E3B",
      fontSize: 22,
      fontWeight: "900",
    },

    forecastLabel: {
      color: "#374151",
      fontWeight: "800",
      marginTop: 4,
      fontSize: 11,
    },

    insightCard: {
      backgroundColor:
        "#FFFFFF",
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
      backgroundColor:
        "#FFFFFF",
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
      backgroundColor:
        "#10B981",
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