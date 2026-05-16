import React, { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import farmTheme from "../styles/farmTheme";

type FarmerReview = {
  id: string;
  customerName: string;
  rating: number;
  product: string;
  comment: string;
  date: string;
  replied?: boolean;
};

const reviews: FarmerReview[] = [
  {
    id: "1",
    customerName: "Sarah Johnson",
    rating: 5,
    product: "Farm Fresh Eggs",
    comment: "Excellent quality and fast delivery.",
    date: "May 7",
    replied: true,
  },
  {
    id: "2",
    customerName: "Marcus Lee",
    rating: 4,
    product: "Vegetable Box",
    comment: "Great produce box. Tomatoes were very fresh.",
    date: "May 6",
  },
  {
    id: "3",
    customerName: "Emily Carter",
    rating: 5,
    product: "Local Honey",
    comment: "Amazing honey. Will order again.",
    date: "May 4",
  },
];

export default function CustomerReviews() {
  const [replyText, setReplyText] = useState("");

  const averageRating = useMemo(() => {
    const total = reviews.reduce((sum, item) => sum + item.rating, 0);
    return total / reviews.length;
  }, []);

  function stars(rating: number) {
    return "★".repeat(rating) + "☆".repeat(5 - rating);
  }

  function sendReply(customerName: string) {
    if (!replyText.trim()) {
      Alert.alert("Reply Needed", "Enter a reply before sending.");
      return;
    }

    Alert.alert("Reply Sent", `Reply sent to ${customerName}.`);
    setReplyText("");
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home Farmer Trust</Text>
        <Text style={styles.title}>Customer Reviews</Text>
        <Text style={styles.subtitle}>
          View customer ratings, respond to reviews, and monitor product
          satisfaction.
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Average Rating</Text>
        <Text style={styles.summaryRating}>{averageRating.toFixed(1)}</Text>
        <Text style={styles.summaryStars}>{stars(Math.round(averageRating))}</Text>
        <Text style={styles.summaryText}>{reviews.length} customer reviews</Text>
      </View>

      <View style={styles.replyCard}>
        <Text style={styles.replyTitle}>Quick Reply</Text>

        <TextInput
          style={styles.replyInput}
          placeholder="Thank you for supporting our farm..."
          value={replyText}
          onChangeText={setReplyText}
          multiline
        />
      </View>

      <Text style={styles.sectionTitle}>Recent Reviews</Text>

      {reviews.map((review) => (
        <View key={review.id} style={styles.reviewCard}>
          <View style={styles.reviewHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.customerName}>{review.customerName}</Text>
              <Text style={styles.productName}>{review.product}</Text>
            </View>

            <Text style={styles.date}>{review.date}</Text>
          </View>

          <Text style={styles.stars}>{stars(review.rating)}</Text>
          <Text style={styles.comment}>{review.comment}</Text>

          <View style={styles.reviewFooter}>
            <Text style={review.replied ? styles.replied : styles.notReplied}>
              {review.replied ? "Replied" : "Needs Reply"}
            </Text>

            <TouchableOpacity
              style={styles.replyButton}
              onPress={() => sendReply(review.customerName)}
            >
              <Text style={styles.replyButtonText}>Reply</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: farmTheme.colors.background },

  hero: {
    backgroundColor: farmTheme.colors.primary,
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  eyebrow: { color: "#D1FAE5", fontWeight: "900", marginBottom: 8 },

  title: { color: "#FFFFFF", fontSize: 35, fontWeight: "900", marginBottom: 10 },

  subtitle: { color: "#E8F5E9", fontWeight: "700", lineHeight: 23 },

  summaryCard: {
    backgroundColor: "#FFFFFF",
    margin: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  summaryLabel: { color: farmTheme.colors.mutedText, fontWeight: "900" },

  summaryRating: {
    color: farmTheme.colors.primary,
    fontSize: 44,
    fontWeight: "900",
    marginTop: 4,
  },

  summaryStars: { color: "#FACC15", fontSize: 25, fontWeight: "900" },

  summaryText: { color: farmTheme.colors.mutedText, fontWeight: "700", marginTop: 6 },

  replyCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 18,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
  },

  replyTitle: { color: farmTheme.colors.text, fontSize: 22, fontWeight: "900", marginBottom: 12 },

  replyInput: {
    minHeight: 100,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    color: farmTheme.colors.text,
    fontWeight: "700",
    textAlignVertical: "top",
  },

  sectionTitle: {
    color: farmTheme.colors.text,
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },

  reviewCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
  },

  reviewHeader: { flexDirection: "row", alignItems: "center", gap: 12 },

  customerName: { color: farmTheme.colors.text, fontSize: 18, fontWeight: "900" },

  productName: { color: farmTheme.colors.mutedText, fontWeight: "700", marginTop: 4 },

  date: { color: farmTheme.colors.primary, fontWeight: "900" },

  stars: { color: "#FACC15", fontSize: 20, fontWeight: "900", marginTop: 10 },

  comment: { color: farmTheme.colors.text, fontWeight: "700", lineHeight: 22, marginTop: 8 },

  reviewFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
  },

  replied: { color: farmTheme.colors.primary, fontWeight: "900" },

  notReplied: { color: "#DC2626", fontWeight: "900" },

  replyButton: {
    backgroundColor: farmTheme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },

  replyButtonText: { color: "#FFFFFF", fontWeight: "900" },
});