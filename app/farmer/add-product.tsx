// app/farmer/add-product.tsx

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
import {
  FARM_PRODUCT_CATEGORIES,
  FarmProductCategory,
  FarmProductUnit,
} from "../data/farmProductCatalog";

const PRODUCT_UNITS: FarmProductUnit[] = [
  "lb",
  "bunch",
  "dozen",
  "each",
  "box",
  "bag",
  "case",
  "bundle",
  "gallon",
  "pint",
  "quart",
  "jar",
  "basket",
  "bale",
  "cord",
  "tray",
  "flat",
];

const DELIVERY_OPTIONS = [
  "Pickup Only",
  "Delivery Only",
  "Pickup and Delivery",
];

const PROCESSING_OPTIONS = [
  "Not Applicable",
  "Traditional",
  "Halal",
  "Both Traditional and Halal",
];

const PROCESSING_REQUIRED_CATEGORIES: FarmProductCategory[] = [
  "Meat",
  "Fish & Aquaculture",
];

function normalizeUnitForCategory(category: string): FarmProductUnit {
  if (category === "Eggs") return "dozen";
  if (category === "Flowers") return "bunch";
  if (category === "Hay & Feed") return "bale";
  if (category === "Plants & Nursery") return "each";
  if (category === "Dairy") return "gallon";
  if (category === "Honey & Bee Products") return "jar";
  if (category === "Bakery & Cottage Foods") return "each";
  if (category === "Fish & Aquaculture") return "lb";
  if (category === "Meat") return "lb";
  if (category === "Farm Supplies") return "bag";
  if (category === "Seasonal Products") return "each";
  return "each";
}

export default function AddProduct() {
  const [loading, setLoading] = useState(false);

  const [farmerId, setFarmerId] = useState("");
  const [farmerEmail, setFarmerEmail] = useState("");
  const [farmName, setFarmName] = useState("");

  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] =
    useState<FarmProductCategory>("Vegetables");

  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");

  const [unit, setUnit] = useState<FarmProductUnit>("each");
  const [deliveryOption, setDeliveryOption] = useState("Pickup and Delivery");
  const [processingOption, setProcessingOption] = useState("Not Applicable");

  const [harvestDate, setHarvestDate] = useState("");
  const [organic, setOrganic] = useState(false);
  const [local, setLocal] = useState(true);
  const [seasonal, setSeasonal] = useState(false);

  const [image, setImage] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadCurrentFarmer();
    }, [])
  );

  async function loadCurrentFarmer() {
    try {
      const saved =
        (await AsyncStorage.getItem("currentFarmer")) ||
        (await AsyncStorage.getItem("currentUser"));

      if (!saved) {
        router.replace("/farmer/login");
        return;
      }

      const currentFarmer = JSON.parse(saved);

      setFarmerId(currentFarmer.id || currentFarmer.farmerId || "");
      setFarmerEmail(currentFarmer.email || "");
      setFarmName(
        currentFarmer.farmName ||
          currentFarmer.businessName ||
          currentFarmer.business_name ||
          currentFarmer.farm_name ||
          ""
      );
    } catch (error) {
      console.log("Load current farmer error:", error);
      router.replace("/farmer/login");
    }
  }

  const showProcessingOptions =
    PROCESSING_REQUIRED_CATEGORIES.includes(category);

  function selectCategory(item: FarmProductCategory) {
    setCategory(item);

    if (PROCESSING_REQUIRED_CATEGORIES.includes(item)) {
      setProcessingOption("Traditional");
    } else {
      setProcessingOption("Not Applicable");
    }

    setUnit(normalizeUnitForCategory(item));

    if (item === "Seasonal Products") {
      setSeasonal(true);
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
      const productAny = product as any;

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

        image_url: product.image || product.imageUrl || null,

        delivery_option: product.deliveryOption,
        processing_option: product.processingOption,

        harvest_date: productAny.harvestDate || null,

        organic: Boolean(productAny.organic),
        local: Boolean(productAny.local),
        seasonal: Boolean(productAny.seasonal),

        tags: productAny.tags || [],

        available: stock > 0,

        sold: product.sold || 0,
        gross_sales: product.grossSales || 0,

        source: "custom_upload",

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

      const tags = [
        organic ? "organic" : "",
        local ? "local" : "",
        seasonal ? "seasonal" : "",
      ].filter(Boolean);

      const newProduct: Product = {
        id: `custom_${Date.now()}`,
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

        harvestDate: harvestDate.trim(),
        organic,
        local,
        seasonal,
        tags,
        source: "custom_upload",
        active: true,
      } as any;

      await addProductToFarmer(farmerId, newProduct);
      await saveProductToSupabase(newProduct);

      const saved =
        (await AsyncStorage.getItem("currentFarmer")) ||
        (await AsyncStorage.getItem("currentUser"));

      if (saved) {
        const currentFarmer = JSON.parse(saved);
        const existingProducts = Array.isArray(currentFarmer.products)
          ? currentFarmer.products
          : [];

        const updatedFarmer = {
          ...currentFarmer,
          products: [...existingProducts, newProduct],
          updatedAt: now,
        };

        await AsyncStorage.setItem(
          "currentFarmer",
          JSON.stringify(updatedFarmer)
        );
        await AsyncStorage.setItem("currentUser", JSON.stringify(updatedFarmer));
        await AsyncStorage.setItem("userRole", "farmer");
        await AsyncStorage.setItem("currentUserRole", "farmer");
      }

      Alert.alert(
        "Product Saved",
        `${productName.trim()} was added with ${numericQuantity} ${unit} in stock.`
      );

      router.replace("/farmer/dashboard");
    } catch (error: any) {
      console.log("Add product error:", error);
      Alert.alert("Save Error", error?.message || "Unable to save product.");
    } finally {
      setLoading(false);
    }
  }

  function ToggleChip({
    label,
    active,
    onPress,
  }: {
    label: string;
    active: boolean;
    onPress: () => void;
  }) {
    return (
      <TouchableOpacity
        style={[styles.option, active && styles.optionActive]}
        onPress={onPress}
      >
        <Text style={[styles.optionText, active && styles.optionTextActive]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Add Custom Farm Product</Text>

      <Text style={styles.subheader}>
        {farmName
          ? `${farmName} · Upload your own product picture, set price, unit, stock, and tags.`
          : "Upload your own product picture, set price, unit, stock, and tags."}
      </Text>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Custom Product Upload</Text>

        <Text style={styles.noticeText}>
          Use this when your product is not listed in Select Farm Products.
          Customers will see your uploaded photo, price, unit, stock, pickup /
          delivery option, and farm tags.
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
        {FARM_PRODUCT_CATEGORIES.map((item) => (
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

      <TextInput
        style={styles.input}
        placeholder="Harvest Date / Available Date"
        placeholderTextColor="#8A8F98"
        value={harvestDate}
        onChangeText={setHarvestDate}
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

      <Text style={styles.label}>Product Tags</Text>

      <View style={styles.optionWrap}>
        <ToggleChip
          label="Organic"
          active={organic}
          onPress={() => setOrganic((prev) => !prev)}
        />
        <ToggleChip
          label="Local"
          active={local}
          onPress={() => setLocal((prev) => !prev)}
        />
        <ToggleChip
          label="Seasonal"
          active={seasonal}
          onPress={() => setSeasonal((prev) => !prev)}
        />
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
          <Text style={styles.buttonText}>Save Custom Product</Text>
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
    fontWeight: "700",
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
    fontWeight: "700",
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