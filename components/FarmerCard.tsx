import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

type FarmerCardProps = {
  name: string;
  products: string;
  rating: number;
  reviews: number;
  distance: string;
  deliveryTime: string;
  city: string;
  image: string;
  onPress: () => void;
};

export default function FarmerCard({
  name,
  products,
  rating,
  reviews,
  distance,
  deliveryTime,
  city,
  image,
  onPress,
}: FarmerCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.imageBox}>
        <Text style={styles.imageEmoji}>{image}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.products}>{products}</Text>

        <Text style={styles.meta}>
          ⭐ {rating} • {reviews} reviews • {distance}
        </Text>

        <Text style={styles.delivery}>
          🚗 Delivery {deliveryTime} • Pickup available
        </Text>

        <Text style={styles.city}>📍 {city}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#EEEEEE",
  },
  imageBox: {
    height: 120,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
  },
  imageEmoji: {
    fontSize: 54,
  },
  content: {
    padding: 14,
  },
  name: {
    fontSize: 20,
    fontWeight: "900",
    color: "#111111",
  },
  products: {
    color: "#666666",
    marginTop: 4,
    marginBottom: 6,
  },
  meta: {
    color: "#111111",
    fontWeight: "600",
    marginBottom: 6,
  },
  delivery: {
    color: "#5C3B1E",
    fontWeight: "600",
    marginBottom: 4,
  },
  city: {
    color: "#666666",
  },
});