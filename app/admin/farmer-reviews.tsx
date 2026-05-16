import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";

import ProtectedRoute from "../components/ProtectedRoute";
import { supabase } from "../data/supabaseClient";

type FarmerReview = {
  id: string;
  farmer_id?: string;
  customer_id?: string;
  customer_name?: string;
  customer_email?: string;
  rating?: number;
  comment?: string;
  created_at?: string;
  order_id?: string;
};

export default function FarmerReviewsScreen() {
  const [loading, setLoading] = useState(false);
  const [reviews, setReviews] = useState<FarmerReview[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadReviews();
    }, [])
  );

  async function loadReviews() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("farmer_reviews")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setReviews(data || []);
    } catch (error) {
      console.log("Farmer reviews error:", error);
      Alert.alert("Error", "Unable to load farmer reviews.");
    } finally {
      setLoading(false);
    }
  }

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;

    const total = reviews.reduce((sum, item) => {
      return sum + Number(item.rating || 0);
    }, 0);

    return total / reviews.length;
  }, [reviews]);

  const fiveStarReviews = reviews.filter(
    (item) => Number(item.rating || 0) === 5
  ).length;

  function renderStars(rating?: number) {
    const safeRating = Math.round(Number(rating || 0));

    return "★".repeat(safeRating) + "☆".repeat(5 - safeRating);
  }

  function formatDate(value?: string) {
    if (!value) return "No date";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "No date";
    }

    return date.toLocaleDateString();
  }

  return (
    <ProtectedRoute allowedRoles={["farmer", "admin"]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Farm2Home</Text>
          <Text style={styles.title}>Farmer Reviews</Text>
          <Text style={styles.subtitle}>
            See customer feedback, ratings, and marketplace trust performance.
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{averageRating.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Avg Rating</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>{reviews.length}</Text>
            <Text style={styles.statLabel}>Reviews</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>{fiveStarReviews}</Text>
            <Text style={styles.statLabel}>5-Star</Text>
          </View>
        </View>

        {loading && reviews.length === 0 ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#2F7D32" />
            <Text style={styles.loadingText}>Loading reviews...</Text>
          </View>
        ) : (
          <FlatList
            data={reviews}
            keyExtractor={(item, index) => item.id || String(index)}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={loadReviews} />
            }
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No reviews yet</Text>
                <Text style={styles.emptyText}>
                  Customer reviews will appear here after completed orders.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.reviewCard}>
                <View style={styles.reviewTop}>
                  <View>
                    <Text style={styles.customerName}>
                      {item.customer_name || item.customer_email || "Customer"}
                    </Text>

                    <Text style={styles.dateText}>
                      {formatDate(item.created_at)}
                    </Text>
                  </View>

                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingBadgeText}>
                      {Number(item.rating || 0).toFixed(1)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.stars}>{renderStars(item.rating)}</Text>

                <Text style={styles.comment}>
                  {item.comment || "No written comment provided."}
                </Text>

                {item.order_id ? (
                  <Text style={styles.orderText}>
                    Order #{item.order_id.slice(-6)}
                  </Text>
                ) : null}
              </View>
            )}
          />
        )}
      </View>
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7F2",
  },

  header: {
    backgroundColor: "#2F7D32",
    paddingTop: 64,
    paddingBottom: 28,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },

  eyebrow: {
    color: "#DFF5E1",
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 10,
  },

  subtitle: {
    color: "#E8F5E9",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },

  statsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginTop: -24,
    marginBottom: 12,
  },

  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  statValue: {
    color: "#2F7D32",
    fontSize: 24,
    fontWeight: "900",
  },

  statLabel: {
    color: "#555",
    marginTop: 4,
    fontWeight: "700",
    fontSize: 12,
  },

  loadingCard: {
    margin: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  loadingText: {
    color: "#555",
    marginTop: 10,
    fontWeight: "700",
  },

  listContent: {
    padding: 16,
    paddingBottom: 90,
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 8,
  },

  emptyText: {
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
  },

  reviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  reviewTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },

  customerName: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "900",
  },

  dateText: {
    color: "#6B7280",
    marginTop: 4,
    fontWeight: "600",
  },

  ratingBadge: {
    backgroundColor: "#E8F5E9",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#2F7D32",
  },

  ratingBadgeText: {
    color: "#2F7D32",
    fontWeight: "900",
  },

  stars: {
    color: "#F59E0B",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 10,
  },

  comment: {
    color: "#374151",
    lineHeight: 22,
    fontWeight: "600",
  },

  orderText: {
    color: "#2F7D32",
    fontWeight: "900",
    marginTop: 12,
  },
});