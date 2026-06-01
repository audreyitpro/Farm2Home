import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";

const COLORS = {
  primary: "#22C55E",
  dark: "#0F172A",
  muted: "#64748B",
  bg: "#F8FAFC",
  card: "#FFFFFF",
  border: "#E2E8F0",
  danger: "#DC2626",
};

type UnitType = "lb" | "bunch" | "dozen" | "each" | "box";
type PickupDeliveryType = "pickup" | "delivery" | "both";

type FarmerProduct = {
  id: string;
  name: string;
  category: string;
  defaultImage?: any;
  customImageUri?: string | null;
  unit: UnitType;
  price: string;
  stockQuantity: string;
  harvestDate: string;
  tags: string[];
};

const FARM_PRODUCT_CATEGORIES = [
  "Vegetables",
  "Fruits",
  "Herbs",
  "Eggs & Dairy",
  "Honey & Specialty",
  "Farm Boxes",
  "Other",
];

const INITIAL_PRODUCTS: FarmerProduct[] = [
  {
    id: "tomatoes",
    name: "Fresh Tomatoes",
    category: "Vegetables",
    defaultImage: require("../../assets/produce/tomatoes.jpg"),
    unit: "lb",
    price: "",
    stockQuantity: "",
    harvestDate: "",
    tags: ["Organic", "Local", "Seasonal"],
  },
  {
    id: "lettuce",
    name: "Green Lettuce",
    category: "Vegetables",
    defaultImage: require("../../assets/produce/lettuce.jpg"),
    unit: "each",
    price: "",
    stockQuantity: "",
    harvestDate: "",
    tags: ["Local", "Seasonal"],
  },
  {
    id: "carrots",
    name: "Carrots",
    category: "Vegetables",
    defaultImage: require("../../assets/produce/carrots.jpg"),
    unit: "bunch",
    price: "",
    stockQuantity: "",
    harvestDate: "",
    tags: ["Local"],
  },
  {
    id: "corn",
    name: "Sweet Corn",
    category: "Vegetables",
    defaultImage: require("../../assets/produce/corn.jpg"),
    unit: "dozen",
    price: "",
    stockQuantity: "",
    harvestDate: "",
    tags: ["Seasonal", "Local"],
  },
  {
    id: "apples",
    name: "Apples",
    category: "Fruits",
    defaultImage: require("../../assets/produce/apples.jpg"),
    unit: "lb",
    price: "",
    stockQuantity: "",
    harvestDate: "",
    tags: ["Local", "Seasonal"],
  },
  {
    id: "strawberries",
    name: "Strawberries",
    category: "Fruits",
    defaultImage: require("../../assets/produce/strawberries.jpg"),
    unit: "box",
    price: "",
    stockQuantity: "",
    harvestDate: "",
    tags: ["Local", "Seasonal"],
  },
  {
    id: "eggs",
    name: "Farm Eggs",
    category: "Eggs & Dairy",
    defaultImage: require("../../assets/produce/eggs.jpg"),
    unit: "dozen",
    price: "",
    stockQuantity: "",
    harvestDate: "",
    tags: ["Local"],
  },
  {
    id: "honey",
    name: "Raw Honey",
    category: "Honey & Specialty",
    defaultImage: require("../../assets/produce/honey.jpg"),
    unit: "each",
    price: "",
    stockQuantity: "",
    harvestDate: "",
    tags: ["Local"],
  },
  {
    id: "produce-box",
    name: "Seasonal Produce Box",
    category: "Farm Boxes",
    defaultImage: require("../../assets/produce/produce-box.jpg"),
    unit: "box",
    price: "",
    stockQuantity: "",
    harvestDate: "",
    tags: ["Local", "Seasonal"],
  },
  {
    id: "custom-product",
    name: "Custom Farm Product",
    category: "Other",
    defaultImage: undefined,
    customImageUri: null,
    unit: "each",
    price: "",
    stockQuantity: "",
    harvestDate: "",
    tags: ["Local"],
  },
];

export default function SelectProduceScreen() {
  const [farmName, setFarmName] = useState("");
  const [pickupDelivery, setPickupDelivery] =
    useState<PickupDeliveryType>("both");

  const [selectedCategory, setSelectedCategory] = useState("Vegetables");
  const [products, setProducts] = useState<FarmerProduct[]>(INITIAL_PRODUCTS);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const visibleProducts = useMemo(() => {
    return products.filter((item) => item.category === selectedCategory);
  }, [products, selectedCategory]);

  const toggleProduct = (id: string) => {
    setSelectedProducts((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    );
  };

  const updateProduct = (
    id: string,
    field: keyof FarmerProduct,
    value: string
  ) => {
    setProducts((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  };

  const pickProductImage = async (productId: string) => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission Needed",
          "Please allow photo access to upload product pictures."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
      });

      if (result.canceled) return;

      const uri = result.assets?.[0]?.uri;

      if (!uri) {
        Alert.alert("Upload Error", "Could not read the selected image.");
        return;
      }

      setProducts((prev) =>
        prev.map((item) =>
          item.id === productId
            ? {
                ...item,
                customImageUri: uri,
              }
            : item
        )
      );
    } catch (error) {
      Alert.alert("Upload Error", "Unable to upload product photo.");
    }
  };

  const removeCustomImage = (productId: string) => {
    setProducts((prev) =>
      prev.map((item) =>
        item.id === productId
          ? {
              ...item,
              customImageUri: null,
            }
          : item
      )
    );
  };

  const getImageSource = (item: FarmerProduct) => {
    if (item.customImageUri) {
      return { uri: item.customImageUri };
    }

    if (item.defaultImage) {
      return item.defaultImage;
    }

    return require("../../assets/produce/placeholder-produce.jpg");
  };

  const handleSave = () => {
    if (!farmName.trim()) {
      Alert.alert("Farm Name Required", "Please enter your farm name.");
      return;
    }

    if (selectedProducts.length === 0) {
      Alert.alert(
        "No Products Selected",
        "Please select at least one farm product."
      );
      return;
    }

    const selected = products.filter((item) =>
      selectedProducts.includes(item.id)
    );

    console.log("Farm Product Catalog Saved:", {
      farmName,
      pickupDelivery,
      selectedProducts: selected,
    });

    Alert.alert(
      "Farm Products Saved",
      "Your selected products were saved to your Farm Inventory.",
      [
        {
          text: "Go to Dashboard",
          onPress: () => router.push("/farmer/dashboard"),
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Farm Product Catalog</Text>
      <Text style={styles.subtitle}>
        Select grocery-style produce photos or upload your own farmer product
        pictures.
      </Text>

      <View style={styles.sectionCard}>
        <Text style={styles.label}>Farm Name</Text>
        <TextInput
          value={farmName}
          onChangeText={setFarmName}
          placeholder="Example: Gibson Family Farm"
          placeholderTextColor="#94A3B8"
          style={styles.input}
        />

        <Text style={styles.label}>Pickup / Delivery</Text>
        <View style={styles.optionRow}>
          {(["pickup", "delivery", "both"] as PickupDeliveryType[]).map(
            (option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.optionButton,
                  pickupDelivery === option && styles.optionButtonActive,
                ]}
                onPress={() => setPickupDelivery(option)}
              >
                <Text
                  style={[
                    styles.optionText,
                    pickupDelivery === option && styles.optionTextActive,
                  ]}
                >
                  {option.toUpperCase()}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>
      </View>

      <Text style={styles.sectionTitle}>Farm Product Categories</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
      >
        {FARM_PRODUCT_CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryChip,
              selectedCategory === category && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory(category)}
          >
            <Text
              style={[
                styles.categoryText,
                selectedCategory === category && styles.categoryTextActive,
              ]}
            >
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>Farmer Products</Text>

      {visibleProducts.map((item) => {
        const selected = selectedProducts.includes(item.id);

        return (
          <View
            key={item.id}
            style={[
              styles.productCard,
              selected && styles.productCardSelected,
            ]}
          >
            <Image
              source={getImageSource(item)}
              style={styles.productImage}
              resizeMode="cover"
            />

            <View style={styles.productBody}>
              <TextInput
                value={item.name}
                onChangeText={(value) => updateProduct(item.id, "name", value)}
                style={styles.productNameInput}
                placeholder="Product name"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.farmNameText}>
                {farmName.trim() || "Your Farmer Store"}
              </Text>

              <View style={styles.row}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.smallLabel}>Price</Text>
                  <TextInput
                    value={item.price}
                    onChangeText={(value) =>
                      updateProduct(item.id, "price", value)
                    }
                    placeholder="$3.99"
                    placeholderTextColor="#94A3B8"
                    keyboardType="decimal-pad"
                    style={styles.smallInput}
                  />
                </View>

                <View style={styles.fieldHalf}>
                  <Text style={styles.smallLabel}>Unit</Text>
                  <TextInput
                    value={item.unit}
                    onChangeText={(value) =>
                      updateProduct(item.id, "unit", value as UnitType)
                    }
                    placeholder="lb"
                    placeholderTextColor="#94A3B8"
                    style={styles.smallInput}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.smallLabel}>Stock Quantity</Text>
                  <TextInput
                    value={item.stockQuantity}
                    onChangeText={(value) =>
                      updateProduct(item.id, "stockQuantity", value)
                    }
                    placeholder="250"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    style={styles.smallInput}
                  />
                </View>

                <View style={styles.fieldHalf}>
                  <Text style={styles.smallLabel}>Harvest Date</Text>
                  <TextInput
                    value={item.harvestDate}
                    onChangeText={(value) =>
                      updateProduct(item.id, "harvestDate", value)
                    }
                    placeholder="2026-06-01"
                    placeholderTextColor="#94A3B8"
                    style={styles.smallInput}
                  />
                </View>
              </View>

              <View style={styles.tagRow}>
                {item.tags.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.deliveryText}>
                {pickupDelivery === "both"
                  ? "Pickup • Delivery"
                  : pickupDelivery === "pickup"
                  ? "Pickup Available"
                  : "Delivery Available"}
              </Text>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={() => pickProductImage(item.id)}
                >
                  <Text style={styles.uploadButtonText}>
                    {item.customImageUri ? "Change Photo" : "Upload Photo"}
                  </Text>
                </TouchableOpacity>

                {item.customImageUri ? (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeCustomImage(item.id)}
                  >
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <TouchableOpacity
                style={[
                  styles.selectButton,
                  selected && styles.selectButtonActive,
                ]}
                onPress={() => toggleProduct(item.id)}
              >
                <Text
                  style={[
                    styles.selectButtonText,
                    selected && styles.selectButtonTextActive,
                  ]}
                >
                  {selected ? "Selected for Store" : "Add To Farm Inventory"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>
          Save Farm Inventory ({selectedProducts.length})
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.push("/farmer/dashboard")}
      >
        <Text style={styles.backButtonText}>Back to Farmer Dashboard</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    padding: 18,
    paddingBottom: 42,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: COLORS.dark,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    color: COLORS.muted,
    lineHeight: 22,
  },
  sectionCard: {
    marginTop: 18,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.dark,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    backgroundColor: "#FFFFFF",
    marginBottom: 16,
    color: COLORS.dark,
  },
  optionRow: {
    flexDirection: "row",
    gap: 8,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  optionButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  optionText: {
    fontWeight: "900",
    color: COLORS.muted,
    fontSize: 12,
  },
  optionTextActive: {
    color: "#FFFFFF",
  },
  sectionTitle: {
    marginTop: 22,
    marginBottom: 10,
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.dark,
  },
  categoryScroll: {
    marginBottom: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    marginRight: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryText: {
    fontWeight: "900",
    color: COLORS.muted,
  },
  categoryTextActive: {
    color: "#FFFFFF",
  },
  productCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  productCardSelected: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  productImage: {
    width: "100%",
    height: 190,
    backgroundColor: "#E2E8F0",
  },
  productBody: {
    padding: 16,
  },
  productNameInput: {
    fontSize: 21,
    fontWeight: "900",
    color: COLORS.dark,
    padding: 0,
    marginBottom: 4,
  },
  farmNameText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.muted,
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  fieldHalf: {
    flex: 1,
  },
  smallLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.muted,
    marginBottom: 6,
  },
  smallInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 9,
    fontSize: 14,
    color: COLORS.dark,
    backgroundColor: "#FFFFFF",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
    marginBottom: 10,
  },
  tag: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#166534",
  },
  deliveryText: {
    fontSize: 13,
    color: COLORS.muted,
    fontWeight: "800",
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  uploadButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  uploadButtonText: {
    color: "#166534",
    fontWeight: "900",
  },
  removeButton: {
    paddingHorizontal: 16,
    borderRadius: 14,
    paddingVertical: 12,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  removeButtonText: {
    color: COLORS.danger,
    fontWeight: "900",
  },
  selectButton: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: "#FFFFFF",
  },
  selectButtonActive: {
    backgroundColor: COLORS.primary,
  },
  selectButtonText: {
    color: COLORS.primary,
    fontWeight: "900",
    fontSize: 15,
  },
  selectButtonTextActive: {
    color: "#FFFFFF",
  },
  saveButton: {
    marginTop: 10,
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 18,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  backButton: {
    marginTop: 12,
    padding: 14,
    alignItems: "center",
  },
  backButtonText: {
    color: COLORS.dark,
    fontWeight: "900",
  },
});