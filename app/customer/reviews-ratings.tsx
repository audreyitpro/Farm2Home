import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import farmTheme from "../styles/farmTheme";

type Review = {
  id: string;
  farmName: string;
  rating: number;
  comment: string;
  date: string;
};

const initialReviews: Review[] = [
  {
    id: "1",
    farmName: "Green Valley Farm",
    rating: 5,
    comment: "Fresh eggs and fast delivery.",
    date: "May 8",
  },
  {
    id: "2",
    farmName: "Sunrise Produce Farm",
    rating: 4,
    comment: "Great produce box and good variety.",
    date: "May 5",
  },
];

export default function ReviewsRatings() {
  const [reviews, setReviews] = useState(initialReviews);
  const [farmName, setFarmName] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  function submitReview() {
    if (!farmName.trim() || !comment.trim()) {
      Alert.alert("Missing Review", "Enter farm name and review comments.");
      return;
    }

    const newReview: Review = {
      id: Date.now().toString(),
      farmName,
      rating,
      comment,
      date: "Today",
    };

    setReviews((prev) => [newReview, ...prev]);
    setFarmName("");
    setRating(5);
    setComment("");

    Alert.alert("Review Submitted", "Thank you for rating your farm order.");
  }

  function stars(count: number) {
    return "★".repeat(count) + "☆".repeat(5 - count);
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home Trust</Text>
        <Text style={styles.title}>Reviews & Ratings</Text>
        <Text style={styles.subtitle}>
          Rate farms, deliveries, produce quality, and customer experience.
        </Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Write a Review</Text>

        <TextInput
          style={styles.input}
          placeholder="Farm name"
          value={farmName}
          onChangeText={setFarmName}
        />

        <Text style={styles.label}>Rating</Text>

        <View style={styles.starRow}>
          {[1, 2, 3, 4, 5].map((value) => (
            <TouchableOpacity key={value} onPress={() => setRating(value)}>
              <Text style={[styles.star, value <= rating && styles.starActive]}>★</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={styles.commentInput}
          placeholder="Tell us about the order..."
          value={comment}
          onChangeText={setComment}
          multiline
        />

        <TouchableOpacity style={styles.primaryButton} onPress={submitReview}>
          <Text style={styles.primaryText}>Submit Review</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Recent Reviews</Text>

      {reviews.map((review) => (
        <View key={review.id} style={styles.reviewCard}>
          <Text style={styles.reviewFarm}>{review.farmName}</Text>
          <Text style={styles.reviewStars}>{stars(review.rating)}</Text>
          <Text style={styles.reviewComment}>{review.comment}</Text>
          <Text style={styles.reviewDate}>{review.date}</Text>
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

  title: { color: "#FFFFFF", fontSize: 36, fontWeight: "900", marginBottom: 10 },

  subtitle: { color: "#E8F5E9", fontWeight: "700", lineHeight: 23 },

  formCard: {
    backgroundColor: "#FFFFFF",
    margin: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  formTitle: { color: farmTheme.colors.text, fontSize: 23, fontWeight: "900", marginBottom: 12 },

  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    color: farmTheme.colors.text,
    fontWeight: "700",
    marginBottom: 12,
  },

  label: { color: farmTheme.colors.text, fontWeight: "900", marginBottom: 8 },

  starRow: { flexDirection: "row", gap: 8, marginBottom: 14 },

  star: { fontSize: 32, color: "#D1D5DB" },

  starActive: { color: "#FACC15" },

  commentInput: {
    minHeight: 120,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    color: farmTheme.colors.text,
    fontWeight: "700",
    textAlignVertical: "top",
    marginBottom: 14,
  },

  primaryButton: {
    backgroundColor: farmTheme.colors.primary,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },

  primaryText: { color: "#FFFFFF", fontWeight: "900" },

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

  reviewFarm: { color: farmTheme.colors.text, fontSize: 18, fontWeight: "900" },

  reviewStars: { color: "#FACC15", fontSize: 20, fontWeight: "900", marginTop: 6 },

  reviewComment: { color: farmTheme.colors.mutedText, fontWeight: "700", lineHeight: 22, marginTop: 8 },

  reviewDate: { color: farmTheme.colors.primary, fontWeight: "900", marginTop: 8 },
});