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
import { Ionicons } from "@expo/vector-icons";

import { addProductToFarmer, Product } from "../data/farmerStore";
import { supabase } from "../data/supabaseClient";
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

const DELIVERY_OPTIONS = ["Pickup Only", "Delivery Only", "Pickup and Delivery"];

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
  return "each";
}

export default function AddProduct() {
  const [loading, setLoading] = useState(false);

  const [farmerId, setFarmerId] = useState("");
  const [farmerEmail, setFarmerEmail] = useState("");
  const [farmName, setFarmName] = useState("");

  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<FarmProductCategory>("Vegetables");

  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");

  const [unit, setUnit] = useState<FarmProductUnit>("each");
  const [deliveryOption, setDeliveryOption] = useState("Pickup and Delivery");
  const [processingOption, setProcessingOption] = useState("Not Applicable");

  const [harvestDate, setHarvestDate] = useState("");
  const [image, setImage] = useState("");

  const [organic, setOrganic] = useState(false);
  const [local, setLocal] = useState(true);
  const [seasonal, setSeasonal] = useState(false);
  const [featured, setFeatured] = useState(true);

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

  function selectCategory(item: FarmProductCategory) {
    setCategory(item);
    setUnit(normalizeUnitForCategory(item));

    if (PROCESSING_REQUIRED_CATEGORIES.includes(item)) {
      setProcessingOption("Traditional");
    } else {
      setProcessingOption("Not Applicable");
    }

    if (item === "Seasonal Products") {
      setSeasonal(true);
    }
  }

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission Needed", "Please allow photo access.");
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

  async function saveLocalProduct(product: Product) {
    const saved =
      (await AsyncStorage.getItem("currentFarmer")) ||
      (await AsyncStorage.getItem("currentUser"));

    const currentFarmer = saved ? JSON.parse(saved) : {};
    const existingProducts = Array.isArray(currentFarmer.products)
      ? currentFarmer.products
      : [];

    const updatedFarmer = {
      ...currentFarmer,
      products: [...existingProducts, product],
      updatedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem("currentFarmer", JSON.stringify(updatedFarmer));
    await AsyncStorage.setItem("currentUser", JSON.stringify(updatedFarmer));
    await AsyncStorage.setItem("userRole", "farmer");
    await AsyncStorage.setItem("currentUserRole", "farmer");
  }

  async function saveProductToMarketplace(product: Product) {
    const stock = Number(product.stock || product.quantity || 0);
    const productAny = product as any;

    const fullPayload = {
      id: product.id,
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
      featured: Boolean(productAny.featured),

      tags: productAny.tags || [],

      available: stock > 0,
      active: true,
      marketplace_visible: true,
      source: "custom_upload",

      sold: product.sold || 0,
      gross_sales: product.grossSales || 0,

      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("products").upsert(fullPayload, {
      onConflict: "id",
    });

    if (!error) return;

    console.log("Full marketplace save failed, retrying minimal:", error.message);

    const minimalPayload = {
      farmer_id: farmerId,
      farmer_email: farmerEmail,
      farm_name: farmName,
      name: product.name,
      description: product.description,
      category: product.category,
      price: product.price,
      unit: product.unit,
      quantity: stock,
      stock,
      image_url: product.image || product.imageUrl || null,
      delivery_option: product.deliveryOption,
      available: stock > 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: minimalError } = await supabase
      .from("products")
      .insert(minimalPayload);

    if (minimalError) throw minimalError;
  }

  async function submitProduct() {
    if (loading) return;

    if (!farmerId || !farmerEmail) {
      Alert.alert("Session Error", "Please login again.");
      router.replace("/farmer/login");
      return;
    }

    if (!farmName.trim() || !productName.trim() || !price.trim() || !quantity.trim()) {
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
      Alert.alert("Invalid Price", "Enter a valid price greater than 0.");
      return;
    }

    if (Number.isNaN(numericQuantity) || numericQuantity < 0) {
      Alert.alert("Invalid Quantity", "Enter a valid stock quantity.");
      return;
    }

    try {
      setLoading(true);

      const now = new Date().toISOString();

      const tags = [
        organic ? "organic" : "",
        local ? "local" : "",
        seasonal ? "seasonal" : "",
        featured ? "featured" : "",
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
        unit,
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
        featured,
        tags,
        source: "custom_upload",
        active: true,
        available: numericQuantity > 0,
        marketplaceVisible: true,
      } as any;

      await addProductToFarmer(farmerId, newProduct);
      await saveLocalProduct(newProduct);
      await saveProductToMarketplace(newProduct);

      Alert.alert(
        "Product Posted",
        `${productName.trim()} was added to your store and posted to the farmer market.`,
        [
          {
            text: "Go to Dashboard",
            onPress: () => router.replace("/farmer/dashboard"),
          },
        ]
      );
    } catch (error: any) {
      console.log("Add product error:", error);
      Alert.alert(
        "Save Error",
        error?.message || "Unable to save product to farmer market."
      );
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
        style={[styles.chip, active && styles.chipActive]}
        onPress={onPress}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="storefront-outline" size={30} color="#FFFFFF" />
        </View>

        <Text style={styles.header}>Add Product to Store</Text>
        <Text style={styles.subheader}>
          Create a marketplace-ready product listing with photo, price, stock,
          delivery, and tags.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Product Photo</Text>

        {image ? (
          <Image source={{ uri: image }} style={styles.previewImage} />
        ) : (
          <TouchableOpacity style={styles.imagePlaceholder} onPress={pickImage}>
            <Ionicons name="image-outline" size={38} color="#2E7D32" />
            <Text style={styles.imagePlaceholderTitle}>Upload Product Photo</Text>
            <Text style={styles.imagePlaceholderText}>
              Add a clear picture so customers can see what they are buying.
            </Text>
          </TouchableOpacity>
        )}

        {image ? (
          <TouchableOpacity style={styles.secondaryBtn} onPress={pickImage}>
            <Text style={styles.secondaryText}>Change Photo</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Product Details</Text>

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

        <Text style={styles.label}>Category</Text>

        <View style={styles.chipWrap}>
          {FARM_PRODUCT_CATEGORIES.map((item) => (
            <ToggleChip
              key={item}
              label={item}
              active={category === item}
              onPress={() => selectCategory(item)}
            />
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Pricing & Inventory</Text>

        <TextInput
          style={styles.input}
          placeholder="Price"
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
          placeholder="Harvest / Available Date"
          placeholderTextColor="#8A8F98"
          value={harvestDate}
          onChangeText={setHarvestDate}
        />

        <Text style={styles.label}>Unit</Text>

        <View style={styles.chipWrap}>
          {PRODUCT_UNITS.map((item) => (
            <ToggleChip
              key={item}
              label={item}
              active={unit === item}
              onPress={() => setUnit(item)}
            />
          ))}
        </View>
      </View>

      {PROCESSING_REQUIRED_CATEGORIES.includes(category) && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Processing Option</Text>

          <View style={styles.chipWrap}>
            {PROCESSING_OPTIONS.map((item) => (
              <ToggleChip
                key={item}
                label={item}
                active={processingOption === item}
                onPress={() => setProcessingOption(item)}
              />
            ))}
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Delivery & Tags</Text>

        <Text style={styles.label}>Pickup / Delivery</Text>

        <View style={styles.chipWrap}>
          {DELIVERY_OPTIONS.map((item) => (
            <ToggleChip
              key={item}
              label={item}
              active={deliveryOption === item}
              onPress={() => setDeliveryOption(item)}
            />
          ))}
        </View>

        <Text style={styles.label}>Marketplace Tags</Text>

        <View style={styles.chipWrap}>
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
          <ToggleChip
            label="Featured"
            active={featured}
            onPress={() => setFeatured((prev) => !prev)}
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, loading && styles.disabledButton]}
        onPress={submitProduct}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="cloud-upload-outline" size={20} color="#FFFFFF" />
            <Text style={styles.submitText}>Post Product to Farmer Market</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => router.push("/farmer/dashboard")}
      >
        <Text style={styles.backText}>Back to Farmer Dashboard</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F8FAF5",
  },
  content: {
    padding: 18,
    paddingBottom: 60,
  },
  hero: {
    backgroundColor: "#14532D",
    borderRadius: 30,
    padding: 20,
    marginBottom: 16,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: "#2E7D32",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  header: {
    fontSize: 31,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  subheader: {
    color: "#DCFCE7",
    marginTop: 8,
    lineHeight: 22,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8DA",
  },
  sectionTitle: {
    color: "#172017",
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 12,
  },
  label: {
    color: "#172017",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 8,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 16,
    padding: 14,
    fontWeight: "800",
    marginBottom: 10,
    color: "#0F172A",
  },
  textArea: {
    height: 96,
    textAlignVertical: "top",
  },
  previewImage: {
    width: "100%",
    height: 230,
    borderRadius: 22,
    marginBottom: 12,
    backgroundColor: "#ECFDF5",
  },
  imagePlaceholder: {
    height: 210,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#86EFAC",
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    marginBottom: 12,
  },
  imagePlaceholderTitle: {
    color: "#14532D",
    fontWeight: "900",
    fontSize: 17,
    marginTop: 10,
  },
  imagePlaceholderText: {
    color: "#475569",
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#2E7D32",
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 999,
  },
  chipActive: {
    backgroundColor: "#2E7D32",
  },
  chipText: {
    color: "#2E7D32",
    fontWeight: "900",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  secondaryBtn: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#86EFAC",
    padding: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  secondaryText: {
    color: "#14532D",
    fontWeight: "900",
  },
  submitBtn: {
    backgroundColor: "#14532D",
    borderRadius: 20,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    marginTop: 8,
  },
  submitText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.6,
  },
  backBtn: {
    paddingVertical: 18,
    alignItems: "center",
  },
  backText: {
    color: "#14532D",
    fontWeight: "900",
  },
});