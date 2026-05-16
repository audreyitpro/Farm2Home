import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";

import { addProductToFarmer, Product } from "../data/farmerStore";
import { supabase } from "../data/supabaseClient";
import farmTheme from "../styles/farmTheme";

const PRODUCT_CATEGORIES = [
  "Fresh Produce",
  "Vegetables",
  "Fruits",
  "Organic",
  "Eggs",
  "Honey",
  "Meat",
  "Poultry",
  "Fish Farm / Aquaculture",
  "Catfish",
  "Trout",
  "Salmon",
  "Other Fish",
  "Dairy",
  "Baked Goods",
  "Livestock",
  "Flowers",
  "Plants & Herbs",
  "Bushes & Plants",
  "Hay",
  "Bale of Hay",
  "Seasonal",
  "Animal Feed",
  "Herbs",
  "Farm Supplies",
  "Bushes",
  "Garden Starters",
];

const PRODUCT_UNITS = [
  "each",
  "bag",
  "jar",
  "dozen",
  "1/2 dozen",
  "gallon",
  "pound",
  "bundle",
  "box",
  "crate",
  "bale",
  "bouquet",
  "bucket",
  "tray",
  "flat",
  "stem",
  "case",
  "quart",
  "pint",
  "bushel",
];

const DELIVERY_OPTIONS = [
  "Pickup Only",
  "Delivery Only",
  "Pickup and Delivery",
];

const PROCESSING_OPTIONS = [
  "Traditional",
  "Halal",
  "Both Traditional and Halal",
];

const PROCESSING_REQUIRED_CATEGORIES = [
  "Meat",
  "Poultry",
  "Fish Farm / Aquaculture",
  "Catfish",
  "Trout",
  "Salmon",
  "Other Fish",
];

export default function AddProduct() {
  const [loading, setLoading] = useState(false);

  const [farmerId, setFarmerId] = useState("");
  const [farmerEmail, setFarmerEmail] = useState("");
  const [farmName, setFarmName] = useState("");

  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Fresh Produce");

  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");

  const [unit, setUnit] = useState("each");
  const [deliveryOption, setDeliveryOption] = useState("Pickup and Delivery");
  const [processingOption, setProcessingOption] = useState("Not Applicable");

  const [image, setImage] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadCurrentFarmer();
    }, [])
  );

  async function loadCurrentFarmer() {
    try {
      const saved = await AsyncStorage.getItem("currentFarmer");

      if (!saved) {
        router.replace("/farmer/login");
        return;
      }

      const currentFarmer = JSON.parse(saved);

      setFarmerId(currentFarmer.id || "");
      setFarmerEmail(currentFarmer.email || "");
      setFarmName(currentFarmer.farmName || currentFarmer.companyName || "");
    } catch (error) {
      console.log("Load current farmer error:", error);
      router.replace("/farmer/login");
    }
  }

  const showProcessingOptions =
    PROCESSING_REQUIRED_CATEGORIES.includes(category);

  function selectCategory(item: string) {
    setCategory(item);

    if (PROCESSING_REQUIRED_CATEGORIES.includes(item)) {
      setProcessingOption("Traditional");
      setUnit("pound");
      return;
    }

    setProcessingOption("Not Applicable");

    if (item === "Eggs") {
      setUnit("dozen");
    } else if (item === "Flowers") {
      setUnit("bouquet");
    } else if (item === "Hay" || item === "Bale of Hay") {
      setUnit("bale");
    } else if (item === "Plants & Herbs" || item === "Garden Starters") {
      setUnit("flat");
    } else {
      setUnit("each");
    }
  }

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permission Needed",
        "Please allow photo access to upload product pictures."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setImage(result.assets[0].uri);
    }
  }

  async function saveProductToSupabase(product: Product) {
    try {
      const stock = Number(product.stock || product.quantity || 0);

      const { error } = await supabase.from("products").insert({
        farmer_id: farmerId,
        farmer_email: farmerEmail,
        farm_name: farmName,

        name: product.name,
        description: product.description,
        category: product.category,

        price: product.price,
        unit: product.unit,

        inventory: stock,
        quantity: stock,
        stock,

        low_stock_threshold: product.lowStockThreshold,
        is_sold_out: product.isSoldOut,

        image_url: product.image || null,

        delivery_option: product.deliveryOption,
        processing_option: product.processingOption,

        organic: product.category?.toLowerCase().includes("organic") || false,
        available: stock > 0,

        sold: product.sold || 0,
        gross_sales: product.grossSales || 0,

        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;
    } catch (error) {
      console.log("Supabase save product error:", error);
      throw error;
    }
  }

  async function submitProduct() {
    if (loading) return;

    if (!farmerId || !farmerEmail) {
      Alert.alert("Session Error", "Please login again.");
      router.replace("/farmer/login");
      return;
    }

    if (
      !farmName.trim() ||
      !productName.trim() ||
      !price.trim() ||
      !quantity.trim()
    ) {
      Alert.alert(
        "Missing Info",
        "Farm name, product name, price, and quantity are required."
      );
      return;
    }

    const numericPrice = Number(price);
    const numericQuantity = Number(quantity);
    const numericThreshold = Number(lowStockThreshold || 5);

    if (Number.isNaN(numericPrice) || numericPrice <= 0) {
      Alert.alert("Invalid Price", "Please enter a valid price greater than 0.");
      return;
    }

    if (Number.isNaN(numericQuantity) || numericQuantity < 0) {
      Alert.alert("Invalid Quantity", "Please enter a valid quantity.");
      return;
    }

    if (Number.isNaN(numericThreshold) || numericThreshold < 0) {
      Alert.alert(
        "Invalid Threshold",
        "Please enter a valid low-stock threshold."
      );
      return;
    }

    try {
      setLoading(true);

      const now = new Date().toISOString();

      const newProduct: Product = {
        id: `p_${Date.now()}`,
        farmerId,
        name: productName.trim(),
        description: description.trim(),
        category,
        price: numericPrice,
        quantity: numericQuantity,
        stock: numericQuantity,
        lowStockThreshold: numericThreshold,
        isSoldOut: numericQuantity <= 0,
        unit: unit.trim() || "each",
        image: image.trim(),
        imageUrl: image.trim(),
        deliveryOption,
        processingOption,
        sold: 0,
        grossSales: 0,
        lastUpdatedBy: farmerEmail,
        updatedAt: now,
        farmName,
        farmerName: farmerEmail,
      };

      await addProductToFarmer(farmerId, newProduct);
      await saveProductToSupabase(newProduct);

      Alert.alert(
        "Product Saved",
        `${productName.trim()} was added with ${numericQuantity} ${unit} in stock.`
      );

      router.push("/farmer/dashboard");
    } catch (error: any) {
      console.log("Add product error:", error);
      Alert.alert("Save Error", error?.message || "Unable to save product.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Add Farmer Product</Text>

      <Text style={styles.subheader}>
        {farmName
          ? `${farmName} · Upload product pictures, set stock quantity, and choose delivery options.`
          : "Upload product pictures, set stock quantity, and choose delivery options."}
      </Text>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Inventory Control</Text>

        <Text style={styles.noticeText}>
          When customers checkout, stock decreases automatically. When stock
          reaches your alert threshold, it will show as low stock. At 0, it
          becomes sold out.
        </Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Farm Name"
        placeholderTextColor="#8A8F98"
        value={farmName}
        onChangeText={setFarmName}
      />

      <TextInput
        style={styles.input}
        placeholder="Product Name"
        placeholderTextColor="#8A8F98"
        value={productName}
        onChangeText={setProductName}
      />

      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Product Description"
        placeholderTextColor="#8A8F98"
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <Text style={styles.label}>Product Picture</Text>

      {image ? (
        <Image source={{ uri: image }} style={styles.previewImage} />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imagePlaceholderText}>No image selected</Text>
        </View>
      )}

      <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
        <Text style={styles.uploadButtonText}>Upload Product Picture</Text>
      </TouchableOpacity>

      <Text style={styles.label}>Category</Text>

      <View style={styles.optionWrap}>
        {PRODUCT_CATEGORIES.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.option, category === item && styles.optionActive]}
            onPress={() => selectCategory(item)}
          >
            <Text
              style={[
                styles.optionText,
                category === item && styles.optionTextActive,
              ]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {showProcessingOptions && (
        <>
          <Text style={styles.label}>Processing / Preparation Option</Text>

          <View style={styles.optionWrap}>
            {PROCESSING_OPTIONS.map((item) => (
              <TouchableOpacity
                key={item}
                style={[
                  styles.option,
                  processingOption === item && styles.optionActive,
                ]}
                onPress={() => setProcessingOption(item)}
              >
                <Text
                  style={[
                    styles.optionText,
                    processingOption === item && styles.optionTextActive,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <TextInput
        style={styles.input}
        placeholder="Set Your Price"
        placeholderTextColor="#8A8F98"
        value={price}
        onChangeText={setPrice}
        keyboardType="numeric"
      />

      <TextInput
        style={styles.input}
        placeholder="Quantity In Stock"
        placeholderTextColor="#8A8F98"
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="numeric"
      />

      <TextInput
        style={styles.input}
        placeholder="Low Stock Alert Threshold"
        placeholderTextColor="#8A8F98"
        value={lowStockThreshold}
        onChangeText={setLowStockThreshold}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Product Unit</Text>

      <View style={styles.optionWrap}>
        {PRODUCT_UNITS.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.option, unit === item && styles.optionActive]}
            onPress={() => setUnit(item)}
          >
            <Text
              style={[
                styles.optionText,
                unit === item && styles.optionTextActive,
              ]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Pickup / Delivery Options</Text>

      <View style={styles.optionWrap}>
        {DELIVERY_OPTIONS.map((item) => (
          <TouchableOpacity
            key={item}
            style={[
              styles.option,
              deliveryOption === item && styles.optionActive,
            ]}
            onPress={() => setDeliveryOption(item)}
          >
            <Text
              style={[
                styles.optionText,
                deliveryOption === item && styles.optionTextActive,
              ]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.disabledButton]}
        onPress={submitProduct}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Save Product</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: farmTheme.colors.background,
  },
  content: {
    padding: 18,
    paddingBottom: 50,
  },
  header: {
    fontSize: 32,
    fontWeight: "900",
    color: farmTheme.colors.primary,
    marginBottom: 6,
  },
  subheader: {
    color: farmTheme.colors.mutedText,
    lineHeight: 22,
    marginBottom: 16,
  },
  notice: {
    backgroundColor: farmTheme.colors.primaryLight,
    padding: 16,
    borderRadius: 18,
    marginBottom: 18,
    borderLeftWidth: 5,
    borderLeftColor: farmTheme.colors.primary,
  },
  noticeTitle: {
    fontWeight: "900",
    color: farmTheme.colors.primary,
    marginBottom: 5,
    fontSize: 16,
  },
  noticeText: {
    color: farmTheme.colors.text,
    lineHeight: 22,
  },
  label: {
    fontSize: 17,
    fontWeight: "900",
    color: farmTheme.colors.text,
    marginTop: 12,
    marginBottom: 8,
  },
  input: {
    ...farmTheme.inputs.input,
    marginBottom: 12,
  },
  textArea: {
    height: 90,
    textAlignVertical: "top",
  },
  previewImage: {
    width: "100%",
    height: 230,
    borderRadius: 22,
    marginBottom: 12,
  },
  imagePlaceholder: {
    height: 180,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  imagePlaceholderText: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
  },
  uploadButton: {
    ...farmTheme.buttons.secondary,
    marginBottom: 10,
  },
  uploadButtonText: {
    ...farmTheme.typography.button,
  },
  optionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 10,
  },
  option: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: farmTheme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  optionActive: {
    backgroundColor: farmTheme.colors.primary,
  },
  optionText: {
    color: farmTheme.colors.primary,
    fontWeight: "800",
  },
  optionTextActive: {
    color: "#FFFFFF",
  },
  button: {
    backgroundColor: farmTheme.colors.text,
    padding: 18,
    borderRadius: 18,
    marginTop: 18,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "900",
    fontSize: 16,
  },
});