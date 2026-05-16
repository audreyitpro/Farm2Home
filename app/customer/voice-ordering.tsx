import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Speech from "expo-speech";
import { router, useFocusEffect } from "expo-router";

import { addToCart } from "../data/cartStore";
import {
  getRecommendedProducts,
  RecommendedProduct,
} from "../ai/recommendation-engine";
import farmTheme from "../styles/farmTheme";

type VoiceCartItem = RecommendedProduct & {
  quantity: number;
};

const quickCommands = [
  "Add eggs",
  "Add honey",
  "Add milk",
  "Add tomatoes",
  "Add fish",
  "Add meat",
  "Go to cart",
  "Clear cart",
];

export default function VoiceOrdering() {
  const [command, setCommand] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<RecommendedProduct[]>([]);
  const [voiceCart, setVoiceCart] = useState<VoiceCartItem[]>([]);
  const [assistantMessage, setAssistantMessage] = useState(
    "Tell me what you want to order. Example: add eggs, honey, tomatoes, milk, fish, or meat."
  );

  useFocusEffect(
    useCallback(() => {
      loadSuggestions();

      return () => {
        Speech.stop();
      };
    }, [])
  );

  function speak(text: string) {
    Speech.stop();
    Speech.speak(text, {
      rate: 0.92,
      pitch: 1,
    });
  }

  async function loadSuggestions() {
    try {
      setLoading(true);

      const products = await getRecommendedProducts({ limit: 20 });

      setSuggestions(Array.isArray(products) ? products : []);
    } catch (error) {
      console.log("Voice ordering recommendations error:", error);
      Alert.alert("Voice Ordering Error", "Unable to load product suggestions.");
    } finally {
      setLoading(false);
    }
  }

  function findMatchingProducts(text: string) {
    const lower = text.toLowerCase();

    return suggestions.filter((product) => {
      const productName = product.name?.toLowerCase() || "";
      const category = product.category?.toLowerCase() || "";
      const description = product.description?.toLowerCase() || "";
      const searchText = `${productName} ${category} ${description}`;

      return (
        (productName.length > 0 && lower.includes(productName)) ||
        searchText
          .split(" ")
          .filter((word) => word.length > 3)
          .some((word) => lower.includes(word))
      );
    });
  }

  async function runVoiceCommand(customCommand?: string) {
    const text = customCommand || command;

    if (!text.trim()) {
      Alert.alert("Command Needed", "Type what you want to order first.");
      return;
    }

    const lower = text.toLowerCase();

    if (lower.includes("clear cart") || lower.includes("start over")) {
      setVoiceCart([]);
      respond("Your voice cart has been cleared.");
      setCommand("");
      return;
    }

    if (lower.includes("checkout") || lower.includes("go to cart")) {
      const moved = await moveVoiceCartToRealCart();

      if (moved) {
        router.push("/customer/cart" as never);
      }

      return;
    }

    const matches = findMatchingProducts(text);

    if (matches.length === 0) {
      respond(
        "I could not find that item in the current marketplace. Try eggs, honey, dairy, fish, meat, fruit, or vegetables."
      );
      return;
    }

    const firstMatch = matches[0];

    addToVoiceCart(firstMatch);
    respond(`${firstMatch.name} was added to your voice cart.`);
    setCommand("");
  }

  function addToVoiceCart(product: RecommendedProduct) {
    setVoiceCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);

      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [{ ...product, quantity: 1 }, ...prev];
    });
  }

  function removeFromVoiceCart(productId: string) {
    setVoiceCart((prev) => prev.filter((item) => item.id !== productId));
  }

  async function moveVoiceCartToRealCart() {
    if (voiceCart.length === 0) {
      Alert.alert("Cart Empty", "Add items before checkout.");
      return false;
    }

    try {
      for (const item of voiceCart) {
        await addToCart({
          id: item.id,
          name: item.name,
          price: Number(item.price || 0),
          image: item.imageUrl || "",
          quantity: item.quantity,
          farmName: item.farmName || "Local Farm",
        });
      }

      respond("Your voice cart was added to the shopping cart.");
      return true;
    } catch (error) {
      console.log("Move voice cart error:", error);
      Alert.alert("Cart Error", "Unable to move voice cart to shopping cart.");
      return false;
    }
  }

  function respond(message: string) {
    setAssistantMessage(message);
    speak(message);
  }

  function cartTotal() {
    return voiceCart.reduce(
      (sum, item) => sum + Number(item.price || 0) * item.quantity,
      0
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home AI</Text>
        <Text style={styles.title}>Voice Ordering</Text>
        <Text style={styles.subtitle}>
          Build a cart using voice-style commands, smart product matching, and
          AI shopping suggestions.
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.assistantCard}>
          <Text style={styles.assistantTitle}>AI Shopper</Text>
          <Text style={styles.assistantText}>{assistantMessage}</Text>

          <TouchableOpacity
            style={styles.speakButton}
            onPress={() => speak(assistantMessage)}
            activeOpacity={0.85}
          >
            <Text style={styles.speakText}>Read Aloud</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.commandCard}>
          <Text style={styles.label}>Shopping Command</Text>

          <TextInput
            style={styles.input}
            placeholder="Example: Add eggs and honey"
            placeholderTextColor="#8A8F98"
            value={command}
            onChangeText={setCommand}
            multiline
          />

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.disabledButton]}
            onPress={() => runVoiceCommand()}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryText}>
              {loading ? "Loading Suggestions..." : "Run Voice Order"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Quick Voice Commands</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quickRow}
          contentContainerStyle={styles.quickRowContent}
        >
          {quickCommands.map((item) => (
            <TouchableOpacity
              key={item}
              style={styles.quickChip}
              onPress={() => runVoiceCommand(item)}
              activeOpacity={0.85}
            >
              <Text style={styles.quickText}>{item}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.cartSummary}>
          <View style={styles.cartSummaryText}>
            <Text style={styles.cartTitle}>Voice Cart</Text>
            <Text style={styles.cartSub}>
              {voiceCart.length} items · ${cartTotal().toFixed(2)}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.checkoutButton}
            onPress={moveVoiceCartToRealCart}
            activeOpacity={0.85}
          >
            <Text style={styles.checkoutText}>Add to Cart</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={voiceCart}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No voice cart items yet.</Text>
              <Text style={styles.emptyText}>
                Try saying or typing: “Add eggs” or “Add honey”.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.cartItem}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>
                  {item.farmName || "Local Farm"} · Qty {item.quantity}
                </Text>
                <Text style={styles.itemPrice}>
                  ${(Number(item.price || 0) * item.quantity).toFixed(2)}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeFromVoiceCart(item.id)}
                activeOpacity={0.85}
              >
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
          )}
        />

        <Text style={styles.sectionTitle}>Recommended Products</Text>

        <FlatList
          data={suggestions.slice(0, 10)}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No suggestions yet.</Text>
              <Text style={styles.emptyText}>
                Add marketplace products to power voice ordering.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.suggestionCard}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>
                  {item.farmName || "Local Farm"} ·{" "}
                  {item.category || "Farm Goods"}
                </Text>
                <Text style={styles.reasonText}>AI: {item.reason}</Text>
              </View>

              <View style={styles.priceBlock}>
                <Text style={styles.priceText}>
                  ${Number(item.price || 0).toFixed(2)}
                </Text>

                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => {
                    addToVoiceCart(item);
                    respond(`${item.name} was added to your voice cart.`);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.addText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />

        <View style={styles.navRow}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => router.push("/customer/marketplace" as never)}
            activeOpacity={0.85}
          >
            <Text style={styles.navText}>Marketplace</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButtonOutline}
            onPress={() => router.push("/customer/cart" as never)}
            activeOpacity={0.85}
          >
            <Text style={styles.navTextOutline}>Cart</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: farmTheme.colors.background,
  },

  hero: {
    backgroundColor: farmTheme.colors.primary,
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 26,
  },

  eyebrow: {
    color: "#DFF5E5",
    fontWeight: "900",
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
    lineHeight: 23,
    fontWeight: "700",
  },

  assistantCard: {
    backgroundColor: "#064E3B",
    margin: 18,
    borderRadius: 22,
    padding: 18,
  },

  assistantTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 8,
  },

  assistantText: {
    color: "#BBF7D0",
    fontWeight: "700",
    lineHeight: 23,
  },

  speakButton: {
    backgroundColor: "#10B981",
    padding: 13,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 14,
  },

  speakText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  commandCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 18,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  label: {
    color: farmTheme.colors.text,
    fontWeight: "900",
    fontSize: 17,
    marginBottom: 10,
  },

  input: {
    minHeight: 90,
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
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

  disabledButton: {
    opacity: 0.65,
  },

  primaryText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  sectionTitle: {
    color: farmTheme.colors.text,
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },

  quickRow: {
    marginBottom: 16,
  },

  quickRowContent: {
    paddingLeft: 18,
    paddingRight: 8,
  },

  quickChip: {
    backgroundColor: farmTheme.colors.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    marginRight: 10,
  },

  quickText: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
  },

  cartSummary: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    ...farmTheme.shadow,
  },

  cartSummaryText: {
    flex: 1,
  },

  cartTitle: {
    color: farmTheme.colors.text,
    fontSize: 20,
    fontWeight: "900",
  },

  cartSub: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 4,
  },

  checkoutButton: {
    backgroundColor: farmTheme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 14,
  },

  checkoutText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
  },

  emptyTitle: {
    color: farmTheme.colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 6,
  },

  emptyText: {
    color: farmTheme.colors.mutedText,
    lineHeight: 22,
    fontWeight: "700",
  },

  cartItem: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },

  itemInfo: {
    flex: 1,
  },

  itemName: {
    color: farmTheme.colors.text,
    fontSize: 18,
    fontWeight: "900",
  },

  itemMeta: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 4,
  },

  itemPrice: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
    fontSize: 17,
    marginTop: 5,
  },

  removeButton: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },

  removeText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  suggestionCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },

  reasonText: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 5,
    lineHeight: 20,
  },

  priceBlock: {
    alignItems: "flex-end",
  },

  priceText: {
    color: farmTheme.colors.primary,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 8,
  },

  addButton: {
    backgroundColor: farmTheme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
  },

  addText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  navRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    marginTop: 10,
  },

  navButton: {
    flex: 1,
    backgroundColor: farmTheme.colors.primary,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },

  navButtonOutline: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: farmTheme.colors.primary,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },

  navText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  navTextOutline: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
  },

  bottomSpace: {
    height: 100,
  },
});