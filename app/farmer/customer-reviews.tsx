// app/farmer/customer-reviews.tsx

import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import farmTheme from "../styles/farmTheme";

type FarmerReview = {
  id: string;
  customerName: string;
  rating: number;
  product: string;
  comment: string;
  date: string;
  replied?: boolean;
  reply?: string;
};

const STARTER_REVIEWS: FarmerReview[] = [
  {
    id: "1",
    customerName: "Sarah Johnson",
    rating: 5,
    product: "Farm Fresh Eggs",
    comment: "Excellent quality and fast delivery.",
    date: "May 7",
    replied: true,
    reply: "Thank you for supporting our farm!",
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

const COLORS = {
  bg: "#F6F8F2",
  card: "#FFFFFF",
  green: "#1FA463",
  greenDark: "#0B5D35",
  greenSoft: "#E9F8EF",
  text: "#162115",
  muted: "#667085",
  border: "#E3E8DD",
  yellow: "#FACC15",
  red: "#DC2626",
  redSoft: "#FEE2E2",
  white: "#FFFFFF",
};

export default function CustomerReviews() {
  const [reviews, setReviews] = useState<FarmerReview[]>(STARTER_REVIEWS);
  const [selectedReviewId, setSelectedReviewId] = useState<string>("");
  const [replyText, setReplyText] = useState(
    "Thank you for supporting our farm..."
  );

  const averageRating = useMemo(() => {
    if (!reviews.length) return 0;
    const total = reviews.reduce((sum, item) => sum + item.rating, 0);
    return total / reviews.length;
  }, [reviews]);

  const repliedCount = reviews.filter((review) => review.replied).length;
  const pendingCount = reviews.length - repliedCount;

  function stars(rating: number) {
    return "★".repeat(rating) + "☆".repeat(5 - rating);
  }

  function sendReply(review: FarmerReview) {
    const message = replyText.trim();

    if (!message) {
      Alert.alert("Reply Needed", "Enter a reply before sending.");
      return;
    }

    setReviews((prev) =>
      prev.map((item) =>
        item.id === review.id
          ? {
              ...item,
              replied: true,
              reply: message,
            }
          : item
      )
    );

    setSelectedReviewId(review.id);
    setReplyText("Thank you for supporting our farm...");

    Alert.alert("Reply Sent", `Reply sent to ${review.customerName}.`);
  }

  function useSuggestedReply(review: FarmerReview) {
    setSelectedReviewId(review.id);
    setReplyText(
      `Hi ${review.customerName}, thank you for your feedback on ${review.product}. We appreciate your support and hope to serve you again soon.`
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.topRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.push("/farmer/dashboard" as any)}
              activeOpacity={0.9}
            >
              <Ionicons name="arrow-back-outline" size={22} color={COLORS.text} />
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Farm2Home Farmer Trust</Text>
              <Text style={styles.title}>Customer Reviews</Text>
            </View>
          </View>

          <Text style={styles.subtitle}>
            View customer ratings, respond to reviews, and monitor product
            satisfaction.
          </Text>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Average Rating</Text>
            <Text style={styles.summaryRating}>{averageRating.toFixed(1)}</Text>
            <Text style={styles.summaryStars}>
              {stars(Math.round(averageRating))}
            </Text>
            <Text style={styles.summaryText}>
              {reviews.length} customer reviews
            </Text>
          </View>

          <View style={styles.miniStats}>
            <View style={styles.miniCard}>
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={COLORS.greenDark} />
              <Text style={styles.miniValue}>{repliedCount}</Text>
              <Text style={styles.miniLabel}>Replied</Text>
            </View>

            <View style={styles.miniCard}>
              <Ionicons name="time-outline" size={22} color={COLORS.red} />
              <Text style={styles.miniValue}>{pendingCount}</Text>
              <Text style={styles.miniLabel}>Needs Reply</Text>
            </View>
          </View>
        </View>

        <View style={styles.replyCard}>
          <Text style={styles.replyTitle}>Quick Reply</Text>
          <Text style={styles.replyHelp}>
            Choose a review below or type a message and tap Reply.
          </Text>

          <TextInput
            style={styles.replyInput}
            placeholder="Thank you for supporting our farm..."
            value={replyText}
            onChangeText={setReplyText}
            multiline
            placeholderTextColor="#94A3B8"
          />
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Recent Reviews</Text>
          <TouchableOpacity
            style={styles.dashboardButton}
            onPress={() => router.push("/farmer/dashboard" as any)}
          >
            <Text style={styles.dashboardButtonText}>Dashboard</Text>
          </TouchableOpacity>
        </View>

        {reviews.map((review) => {
          const selected = selectedReviewId === review.id;

          return (
            <View
              key={review.id}
              style={[styles.reviewCard, selected && styles.reviewCardSelected]}
            >
              <View style={styles.reviewHeader}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {review.customerName
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.customerName}>{review.customerName}</Text>
                  <Text style={styles.productName}>{review.product}</Text>
                </View>

                <Text style={styles.date}>{review.date}</Text>
              </View>

              <Text style={styles.stars}>{stars(review.rating)}</Text>
              <Text style={styles.comment}>{review.comment}</Text>

              {review.reply ? (
                <View style={styles.replyBubble}>
                  <Text style={styles.replyBubbleLabel}>Your reply</Text>
                  <Text style={styles.replyBubbleText}>{review.reply}</Text>
                </View>
              ) : null}

              <View style={styles.reviewFooter}>
                <View
                  style={[
                    styles.statusPill,
                    review.replied ? styles.repliedPill : styles.notRepliedPill,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      review.replied ? styles.repliedText : styles.notRepliedText,
                    ]}
                  >
                    {review.replied ? "Replied" : "Needs Reply"}
                  </Text>
                </View>

                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.suggestButton}
                    onPress={() => useSuggestedReply(review)}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.suggestButtonText}>Use Template</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.replyButton}
                    onPress={() => sendReply(review)}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.replyButtonText}>Reply</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}

        <View style={{ height: 90 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  hero: {
    backgroundColor: farmTheme.colors.primary,
    paddingTop: 56,
    paddingHorizontal: 18,
    paddingBottom: 30,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    color: "#D1FAE5",
    fontWeight: "900",
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontSize: 12,
  },
  title: {
    color: COLORS.white,
    fontSize: 33,
    fontWeight: "900",
  },
  subtitle: {
    color: "#E8F5E9",
    fontWeight: "700",
    lineHeight: 23,
    marginTop: 16,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    padding: 18,
  },
  summaryCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...farmTheme.shadow,
  },
  summaryLabel: {
    color: COLORS.muted,
    fontWeight: "900",
  },
  summaryRating: {
    color: farmTheme.colors.primary,
    fontSize: 44,
    fontWeight: "900",
    marginTop: 4,
  },
  summaryStars: {
    color: COLORS.yellow,
    fontSize: 25,
    fontWeight: "900",
  },
  summaryText: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 6,
  },
  miniStats: {
    width: Platform.OS === "web" ? 240 : "100%",
    gap: 12,
  },
  miniCard: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  miniValue: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: "900",
    marginTop: 8,
  },
  miniLabel: {
    color: COLORS.muted,
    fontWeight: "800",
  },
  replyCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 18,
    marginBottom: 18,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  replyTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 4,
  },
  replyHelp: {
    color: COLORS.muted,
    fontWeight: "700",
    marginBottom: 12,
  },
  replyInput: {
    minHeight: 104,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 14,
    color: COLORS.text,
    fontWeight: "700",
    textAlignVertical: "top",
  },
  sectionRow: {
    paddingHorizontal: 18,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 23,
    fontWeight: "900",
  },
  dashboardButton: {
    backgroundColor: COLORS.greenSoft,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  dashboardButtonText: {
    color: COLORS.greenDark,
    fontWeight: "900",
  },
  reviewCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reviewCardSelected: {
    borderColor: COLORS.green,
    borderWidth: 2,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 17,
    backgroundColor: COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: COLORS.greenDark,
    fontWeight: "900",
  },
  customerName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
  },
  productName: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 4,
  },
  date: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
  },
  stars: {
    color: COLORS.yellow,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 12,
  },
  comment: {
    color: COLORS.text,
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },
  replyBubble: {
    backgroundColor: COLORS.greenSoft,
    borderRadius: 16,
    padding: 12,
    marginTop: 12,
  },
  replyBubbleLabel: {
    color: COLORS.greenDark,
    fontWeight: "900",
    marginBottom: 4,
  },
  replyBubbleText: {
    color: COLORS.text,
    fontWeight: "700",
    lineHeight: 20,
  },
  reviewFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    gap: 10,
    flexWrap: "wrap",
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  repliedPill: {
    backgroundColor: COLORS.greenSoft,
  },
  notRepliedPill: {
    backgroundColor: COLORS.redSoft,
  },
  statusText: {
    fontWeight: "900",
  },
  repliedText: {
    color: COLORS.greenDark,
  },
  notRepliedText: {
    color: COLORS.red,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  suggestButton: {
    backgroundColor: COLORS.greenSoft,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  suggestButtonText: {
    color: COLORS.greenDark,
    fontWeight: "900",
  },
  replyButton: {
    backgroundColor: farmTheme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  replyButtonText: {
    color: COLORS.white,
    fontWeight: "900",
  },
});