// app/farmer/post-produce.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import {
  Farmer,
  Product,
  addProductToFarmer,
  deleteFarmerProduct,
  getFarmerById,
} from "../data/farmerStore";

import { supabase } from "../data/supabaseClient";
import { checkSubscriptionAccess } from "../services/subscriptionService";

const COLORS = {
  primary: "#2E7D32",
  primaryDark: "#14532D",
  secondary: "#F9A825",
  background: "#F8FAF5",
  card: "#FFFFFF",
  text: "#172017",
  muted: "#75806F",
  border: "#E2E8DA",
  softGreen: "#EAF5E6",
  lightGreen: "#F1FAED",
  danger: "#DC2626",
  dark: "#111827",
  blue: "#2563EB",
};

const CATEGORIES = [
  "Produce",
  "Vegetables",
  "Fruit",
  "Eggs",
  "Honey",
  "Dairy",
  "Meat",
  "Poultry",
  "Flowers",
  "Hay",
  "Farm Supplies",
];

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalizeProductKey(farmerId: string, productName: string) {
  return `${clean(farmerId)}:${clean(productName).toLowerCase()}`;
}

function getProductImage(product: Product) {
  return product.image || product.imageUrl || "";
}

function getDeliveryOption(farmer: Farmer | null) {
  if (farmer?.pickup && farmer?.delivery) return "Pickup / Delivery Available";
  if (farmer?.pickup) return "Pickup Only";
  if (farmer?.delivery) return "Delivery Only";
  return "Contact Farmer";
}

export default function PostProduceScreen() {
  const params = useLocalSearchParams();
  const farmerIdParam = params.farmerId ? String(params.farmerId) : "";

  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [farmerId, setFarmerId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editingProductId, setEditingProductId] = useState("");

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Produce");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [unit, setUnit] = useState("each");
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    initializeScreen();
  }, [farmerIdParam]);

  async function initializeScreen() {
    try {
      const saved = await AsyncStorage.getItem("currentFarmer");

      if (!saved) {
        Alert.alert("Session Needed", "Please login again.");
        router.replace("/farmer/login" as any);
        return;
      }

      const parsed = JSON.parse(saved);

      const access = await checkSubscriptionAccess({
        role: "farmer",
        userId: parsed.id,
        email: parsed.email,
      });

      if (!access.allowed) {
        Alert.alert(
          "Farmer Membership Required",
          access.reason ||
            "Your farmer membership is inactive. Please reactivate your subscription.",
          [
            {
              text: "Manage Subscription",
              onPress: () => router.push("/farmer/compliance-upload" as any),
            },
          ]
        );

        router.replace("/farmer/dashboard" as any);
        return;
      }

      await loadFarmer();
    } catch (error) {
      console.log("Initialize produce screen error:", error);
      Alert.alert("Access Error", "Unable to verify farmer membership.");
    }
  }

  async function loadFarmer() {
    try {
      setLoading(true);

      let id = farmerIdParam;

      if (!id) {
        const saved = await AsyncStorage.getItem("currentFarmer");

        if (saved) {
          const parsed = JSON.parse(saved);
          id = parsed.id || parsed.farmer_id || parsed.farmerId;
        }
      }

      if (!id) {
        Alert.alert("Missing Farmer", "Please return to farmer setup.");
        router.replace("/farmer/setup-store" as any);
        return;
      }

      const foundFarmer = await getFarmerById(id);

      if (!foundFarmer) {
        Alert.alert("Farmer Not Found", "Please complete farmer setup first.");
        router.replace("/farmer/setup-store" as any);
        return;
      }

      setFarmer(foundFarmer);
      setFarmerId(foundFarmer.id);

      await AsyncStorage.setItem("currentFarmer", JSON.stringify(foundFarmer));
    } catch (error) {
      console.log("Load farmer produce error:", error);
      Alert.alert("Error", "Unable to load farmer produce page.");
    } finally {
      setLoading(false);
    }
  }

  async function pickImage() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("Permission Required", "Please allow photo access.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setImageUrl(result.assets[0].uri);
      }
    } catch (error) {
      console.log("Image picker error:", error);
      Alert.alert("Image Error", "Unable to select image.");
    }
  }

  function resetForm() {
    setEditingProductId("");
    setName("");
    setCategory("Produce");
    setDescription("");
    setPrice("");
    setStock("");
    setUnit("each");
    setImageUrl("");
  }

  function editProduce(product: Product) {
    setEditingProductId(product.id);
    setName(product.name || "");
    setCategory(product.category || "Produce");
    setDescription(product.description || "");
    setPrice(String(product.price || ""));
    setStock(String(product.stock ?? product.quantity ?? ""));
    setUnit(product.unit || "each");
    setImageUrl(getProductImage(product));
  }

  async function saveToMarketplace(product: Partial<Product>) {
    const productName = clean(product.name);
    const productKey = normalizeProductKey(farmerId, productName);
    const deliveryOption = getDeliveryOption(farmer);

    const payload: Record<string, any> = {
      farmer_id: farmerId,
      product_key: productKey,
      name: productName,
      description: clean(product.description),
      category: clean(product.category || "Produce"),
      price: Number(product.price || 0),
      inventory: Number(product.stock ?? product.quantity ?? 0),
      image_url: clean(product.imageUrl || product.image || ""),
      organic: false,
      available: true,
      delivery_option: deliveryOption,
      active: true,
      local: true,
      seasonal: false,
      featured: false,
      updated_at: new Date().toISOString(),
    };

    const { data: existing, error: findError } = await supabase
      .from("products")
      .select("*")
      .eq("farmer_id", farmerId)
      .eq("product_key", productKey)
      .maybeSingle();

    if (findError) {
      console.log("Existing product lookup error:", findError.message);
    }

    if (existing?.id) {
      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", existing.id);

      if (error) throw error;

      return {
        mode: "updated",
        marketplaceId: existing.id,
      };
    }

    const { data, error } = await supabase
      .from("products")
      .insert([{ ...payload, created_at: new Date().toISOString() }])
      .select("id")
      .single();

    if (error) throw error;

    return {
      mode: "inserted",
      marketplaceId: data?.id,
    };
  }

  async function addOrUpdateProduce() {
    if (!farmerId) return;

    try {
      setSaving(true);

      const access = await checkSubscriptionAccess({
        role: "farmer",
        userId: farmerId,
        email: farmer?.email || "",
      });

      if (!access.allowed) {
        Alert.alert(
          "Subscription Required",
          access.reason || "Farmer subscription inactive."
        );
        return;
      }

      if (!name.trim()) {
        Alert.alert("Missing Product Name", "Please enter the product name.");
        return;
      }

      if (!price.trim() || Number(price) <= 0) {
        Alert.alert("Missing Price", "Please enter a valid price.");
        return;
      }

      if (!stock.trim() || Number(stock) < 0) {
        Alert.alert("Missing Stock", "Please enter available stock.");
        return;
      }

      const product: Partial<Product> = {
        id: editingProductId || `product-${Date.now()}`,
        farmerId,
        name: name.trim(),
        category: category.trim() || "Produce",
        description: description.trim(),
        price: Number(price),
        stock: Number(stock),
        quantity: Number(stock),
        unit: unit.trim() || "each",
        imageUrl: imageUrl.trim(),
        image: imageUrl.trim(),
        farmName: farmer?.farmName || "",
        farmerName: farmer?.ownerName || "",
        deliveryOption: getDeliveryOption(farmer),
      };

      const marketplaceResult = await saveToMarketplace(product);

      if (editingProductId) {
        await deleteFarmerProduct(farmerId, editingProductId);
      }

      await addProductToFarmer(farmerId, {
        ...product,
        id: String(product.id),
      });

      Alert.alert(
        marketplaceResult.mode === "updated" ? "Product Updated" : "Product Added",
        marketplaceResult.mode === "updated"
          ? `${name} already existed, so the marketplace listing was updated.`
          : `${name} was added to your store and marketplace.`
      );

      resetForm();
      await loadFarmer();
    } catch (error: any) {
      console.log("Add/update produce error:", error);
      Alert.alert("Save Error", error?.message || "Unable to save product.");
    } finally {
      setSaving(false);
    }
  }

  async function removeProduce(productId: string, productName?: string) {
    if (!farmerId) return;

    Alert.alert("Remove Product", "Remove this product from your store and marketplace?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            const nameKey = productName
              ? normalizeProductKey(farmerId, productName)
              : "";

            if (nameKey) {
              await supabase
                .from("products")
                .delete()
                .eq("farmer_id", farmerId)
                .eq("product_key", nameKey);
            }

            await deleteFarmerProduct(farmerId, productId);

            if (editingProductId === productId) resetForm();

            Alert.alert("Removed", "Product removed from store and marketplace.");
            await loadFarmer();
          } catch (error: any) {
            Alert.alert("Remove Error", error?.message || "Unable to remove product.");
          }
        },
      },
    ]);
  }

  const productCount = farmer?.products?.length || 0;

  const totalStock = useMemo(() => {
    return (farmer?.products || []).reduce(
      (sum, item) => sum + Number(item.stock ?? item.quantity ?? 0),
      0
    );
  }, [farmer]);

  const totalValue = useMemo(() => {
    return (farmer?.products || []).reduce(
      (sum, item) =>
        sum +
        Number(item.price || 0) * Number(item.stock ?? item.quantity ?? 0),
      0
    );
  }, [farmer]);

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [styles.backCircle, pressed && styles.pressed]}
            onPress={() => router.replace("/farmer/setup-store" as any)}
          >
            <Text style={styles.backCircleText}>‹</Text>
          </Pressable>

          <View style={styles.topTitleBlock}>
            <Text style={styles.title}>Post Produce</Text>
            <Text style={styles.subtitle}>Manage your Farm2Home products</Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Text style={styles.heroIconText}>🥬</Text>
          </View>

          <View style={styles.heroTextBlock}>
            <Text style={styles.heroBadge}>Farmer Store</Text>
            <Text style={styles.heroTitle}>
              {editingProductId ? "Update your marketplace product" : "Add fresh products to your store"}
            </Text>
            <Text style={styles.heroText}>
              Duplicate names are prevented per farmer. Existing products update
              instead of creating another listing.
            </Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Products" value={String(productCount)} />
          <StatCard label="Stock" value={String(totalStock)} />
          <StatCard label="Store Value" value={`$${totalValue.toFixed(2)}`} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {editingProductId ? "Update Product" : "Add Product"}
          </Text>

          {editingProductId ? (
            <Pressable style={styles.cancelEditButton} onPress={resetForm}>
              <Text style={styles.cancelEditText}>Cancel Edit</Text>
            </Pressable>
          ) : null}

          <Text style={styles.label}>Product Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Product name"
            placeholderTextColor="#8A9482"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
          >
            {CATEGORIES.map((item) => {
              const active = item === category;

              return (
                <Pressable
                  key={item}
                  style={[
                    styles.categoryChip,
                    active && styles.categoryChipActive,
                  ]}
                  onPress={() => setCategory(item)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      active && styles.categoryChipTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <TextInput
            style={styles.input}
            placeholder="Custom category"
            placeholderTextColor="#8A9482"
            value={category}
            onChangeText={setCategory}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Description"
            placeholderTextColor="#8A9482"
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <View style={styles.twoColumnRow}>
            <View style={styles.inputHalf}>
              <Text style={styles.label}>Price</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor="#8A9482"
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.inputHalf}>
              <Text style={styles.label}>Stock</Text>
              <TextInput
                style={styles.input}
                placeholder="Qty"
                placeholderTextColor="#8A9482"
                value={stock}
                onChangeText={setStock}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <Text style={styles.label}>Unit</Text>
          <TextInput
            style={styles.input}
            placeholder="each, pound, dozen, bag"
            placeholderTextColor="#8A9482"
            value={unit}
            onChangeText={setUnit}
          />

          <Text style={styles.label}>Product Image</Text>

          <View style={styles.imageUploadBox}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.previewImage} />
            ) : (
              <>
                <Text style={styles.uploadIcon}>📷</Text>
                <Text style={styles.uploadTitle}>Add product image</Text>
                <Text style={styles.uploadText}>
                  Use a photo from your device or paste an image URL.
                </Text>
              </>
            )}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Image URL optional"
            placeholderTextColor="#8A9482"
            value={imageUrl}
            onChangeText={setImageUrl}
            autoCapitalize="none"
          />

          <Pressable
            style={({ pressed }) => [
              styles.uploadImageButton,
              pressed && styles.pressed,
            ]}
            onPress={pickImage}
          >
            <Text style={styles.uploadImageButtonText}>Upload Product Image</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.pressed,
              saving && styles.disabledButton,
            ]}
            onPress={addOrUpdateProduce}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.addButtonText}>
                {editingProductId ? "Update Product" : "Add Product"}
              </Text>
            )}
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Current Products</Text>
              <Text style={styles.sectionSubtitle}>
                {productCount} product{productCount === 1 ? "" : "s"} listed
              </Text>
            </View>

            {loading && <ActivityIndicator color={COLORS.primary} />}
          </View>

          {!farmer?.products?.length ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🌾</Text>
              <Text style={styles.emptyTitle}>No products added yet</Text>
              <Text style={styles.emptyText}>
                Add your first product to make your farm visible in the customer marketplace.
              </Text>
            </View>
          ) : (
            farmer.products.map((product) => {
              const image = getProductImage(product);
              const productStock = Number(product.stock ?? product.quantity ?? 0);

              return (
                <View key={product.id} style={styles.productRow}>
                  {image ? (
                    <Image source={{ uri: image }} style={styles.productImage} />
                  ) : (
                    <View style={styles.productImagePlaceholder}>
                      <Text style={styles.productImageEmoji}>🥬</Text>
                    </View>
                  )}

                  <View style={styles.productInfo}>
                    <Text style={styles.productCategory}>
                      {product.category || "Farm Goods"}
                    </Text>

                    <Text style={styles.productName} numberOfLines={1}>
                      {product.name}
                    </Text>

                    <Text style={styles.productDetails}>
                      ${Number(product.price || 0).toFixed(2)} · {productStock}{" "}
                      {product.unit || "each"}
                    </Text>

                    <Text style={styles.productDelivery} numberOfLines={1}>
                      {product.deliveryOption || "Pickup / Delivery Available"}
                    </Text>
                  </View>

                  <View style={styles.productActions}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.editButton,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => editProduce(product)}
                    >
                      <Text style={styles.editButtonText}>Edit</Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [
                        styles.removeButton,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => removeProduce(product.id, product.name)}
                    >
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.dashboardButton,
            pressed && styles.pressed,
          ]}
          onPress={() =>
            router.push({
              pathname: "/farmer/dashboard",
              params: { farmerId },
            } as any)
          }
        >
          <Text style={styles.dashboardButtonText}>Go to Farmer Dashboard</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          onPress={() => router.replace("/farmer/setup-store" as any)}
        >
          <Text style={styles.backButtonText}>Back to Store Setup</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 18,
    paddingBottom: 44,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    gap: 12,
  },
  backCircle: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backCircleText: {
    fontSize: 34,
    color: COLORS.text,
    fontWeight: "900",
    marginTop: -4,
  },
  topTitleBlock: {
    flex: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: COLORS.text,
  },
  subtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3,
  },
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 32,
    padding: 20,
    marginBottom: 16,
    flexDirection: "row",
    gap: 14,
  },
  heroIcon: {
    width: 70,
    height: 70,
    borderRadius: 24,
    backgroundColor: COLORS.secondary,
    justifyContent: "center",
    alignItems: "center",
  },
  heroIconText: {
    fontSize: 34,
  },
  heroTextBlock: {
    flex: 1,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    color: "#FFFFFF",
    fontWeight: "900",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 10,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "900",
    lineHeight: 31,
  },
  heroText: {
    color: "#EAF7E6",
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: "900",
  },
  statLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: 6,
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "900",
    color: COLORS.muted,
    marginBottom: 7,
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.lightGreen,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 10,
    fontWeight: "800",
  },
  textArea: {
    minHeight: 92,
    textAlignVertical: "top",
  },
  categoryRow: {
    gap: 9,
    paddingBottom: 10,
  },
  categoryChip: {
    backgroundColor: COLORS.lightGreen,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryChipText: {
    color: COLORS.primary,
    fontWeight: "900",
    fontSize: 13,
  },
  categoryChipTextActive: {
    color: "#FFFFFF",
  },
  twoColumnRow: {
    flexDirection: "row",
    gap: 10,
  },
  inputHalf: {
    flex: 1,
  },
  imageUploadBox: {
    minHeight: 210,
    backgroundColor: COLORS.lightGreen,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    overflow: "hidden",
    padding: 18,
  },
  uploadIcon: {
    fontSize: 46,
    marginBottom: 8,
  },
  uploadTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  uploadText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
  previewImage: {
    width: "100%",
    height: 220,
    borderRadius: 24,
    backgroundColor: "#E5E7EB",
  },
  uploadImageButton: {
    backgroundColor: COLORS.blue,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 10,
  },
  uploadImageButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  addButton: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 6,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.65,
  },
  cancelEditButton: {
    backgroundColor: "#FEF3C7",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  cancelEditText: {
    color: "#92400E",
    fontWeight: "900",
  },
  emptyBox: {
    backgroundColor: COLORS.lightGreen,
    borderRadius: 24,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 8,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
  },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 21,
    marginTop: 6,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.lightGreen,
    borderRadius: 22,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  productImage: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: "#E5E7EB",
  },
  productImagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
  },
  productImageEmoji: {
    fontSize: 34,
  },
  productInfo: {
    flex: 1,
  },
  productCategory: {
    color: COLORS.primary,
    fontWeight: "900",
    fontSize: 11,
    marginBottom: 3,
  },
  productName: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.text,
  },
  productDetails: {
    color: COLORS.muted,
    fontWeight: "800",
    marginTop: 4,
    fontSize: 12,
  },
  productDelivery: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 4,
    fontSize: 11,
  },
  productActions: {
    gap: 7,
  },
  editButton: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
  },
  editButtonText: {
    color: COLORS.blue,
    fontWeight: "900",
    fontSize: 12,
  },
  removeButton: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
  },
  removeButtonText: {
    color: COLORS.danger,
    fontWeight: "900",
    fontSize: 12,
  },
  dashboardButton: {
    backgroundColor: COLORS.blue,
    borderRadius: 20,
    paddingVertical: 17,
    alignItems: "center",
    marginTop: 8,
  },
  dashboardButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  backButton: {
    paddingVertical: 16,
    alignItems: "center",
  },
  backButtonText: {
    color: COLORS.primary,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.75,
  },
});