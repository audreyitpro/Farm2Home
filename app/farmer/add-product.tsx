// app/farmer/add-product.tsx

import React, { useCallback, useMemo, useState } from "react";
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

const FULFILLMENT_OPTIONS = [
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

const CATEGORY_EMOJIS: Record<string, string> = {
  Vegetables: "🥬",
  Fruits: "🍎",
  Meat: "🥩",
  "Fish & Aquaculture": "🐟",
  Eggs: "🥚",
  Dairy: "🥛",
  "Honey & Bee Products": "🍯",
  "Bakery & Cottage Foods": "🥖",
  Flowers: "💐",
  "Plants & Nursery": "🌱",
  "Hay & Feed": "🌾",
  "Farm Supplies": "🧺",
  "Seasonal Products": "🎃",
};

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

function getCleanFarmName(value: string, fallback?: string) {
  const clean = String(value || "").trim();
  if (clean) return clean;

  const fallbackClean = String(fallback || "").trim();
  if (fallbackClean) return fallbackClean;

  return "Farm2Home Farm";
}

export default function AddProduct() {
  const [loading, setLoading] = useState(false);

  const [farmerId, setFarmerId] = useState("");
  const [farmerEmail, setFarmerEmail] = useState("");
  const [farmName, setFarmName] = useState("Farm2Home Farm");

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

  const categoryEmoji = useMemo(() => {
    return CATEGORY_EMOJIS[category] || "🧺";
  }, [category]);

  const marketPreview = useMemo(() => {
    return {
      name: productName.trim() || "Product Name",
      price: Number(price || 0),
      quantity: Number(quantity || 0),
      unit,
      category,
    };
  }, [productName, price, quantity, unit, category]);

  async function loadCurrentFarmer() {
    try {
      const saved =
        (await AsyncStorage.getItem("currentFarmer")) ||
        (await AsyncStorage.getItem("farm2homeCurrentFarmer")) ||
        (await AsyncStorage.getItem("farm2homeFarmerSession")) ||
        (await AsyncStorage.getItem("currentUser"));

      if (!saved) {
        router.replace("/farmer/login" as any);
        return;
      }

      const currentFarmer = JSON.parse(saved);

      const loadedFarmName = getCleanFarmName(
        currentFarmer.farmName ||
          currentFarmer.businessName ||
          currentFarmer.business_name ||
          currentFarmer.farm_name ||
          currentFarmer.name
      );

      setFarmerId(
        currentFarmer.id ||
          currentFarmer.farmerId ||
          currentFarmer.farmer_id ||
          currentFarmer.profile_id ||
          ""
      );
      setFarmerEmail(currentFarmer.email || "");
      setFarmName(loadedFarmName);
    } catch (error) {
      console.log("Load current farmer error:", error);
      router.replace("/farmer/login" as any);
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

    const cleanFarmName = getCleanFarmName(farmName, (product as any).farmName);

    const updatedFarmer = {
      ...currentFarmer,
      farmName: cleanFarmName,
      businessName: currentFarmer.businessName || cleanFarmName,
      products: [...existingProducts, product],
      updatedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem("currentFarmer", JSON.stringify(updatedFarmer));
    await AsyncStorage.setItem("farm2homeCurrentFarmer", JSON.stringify(updatedFarmer));
    await AsyncStorage.setItem("farm2homeFarmerSession", JSON.stringify(updatedFarmer));
    await AsyncStorage.setItem("currentUser", JSON.stringify(updatedFarmer));
    await AsyncStorage.setItem("userRole", "farmer");
    await AsyncStorage.setItem("currentUserRole", "farmer");
  }

  async function checkDuplicateProduct(name: string) {
    const { data, error } = await supabase
      .from("products")
      .select("id,name,farmer_id")
      .eq("farmer_id", farmerId)
      .ilike("name", name.trim());

    if (error) {
      console.log("Duplicate check skipped:", error.message);
      return false;
    }

    return Array.isArray(data) && data.length > 0;
  }

  async function saveProductToMarketplace(product: Product) {
    const stock = Number(product.stock || product.quantity || 0);
    const productAny = product as any;
    const cleanFarmName = getCleanFarmName(farmName, productAny.farmName);

    const fullPayload = {
      id: product.id,
      farmer_id: farmerId,
      farmer_email: farmerEmail,
      farm_name: cleanFarmName,

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
      source: "farmer_market_upload",

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
      farm_name: cleanFarmName,
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
      marketplace_visible: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: minimalError } = await supabase
      .from("products")
      .insert(minimalPayload);

    if (minimalError) throw minimalError;
  }

  function validateProduct() {
    if (!farmerId || !farmerEmail) {
      Alert.alert("Session Error", "Please login again.");
      router.replace("/farmer/login" as any);
      return false;
    }

    if (!farmName.trim()) {
      Alert.alert("Farm Name Needed", "Enter your farm name.");
      return false;
    }

    if (!productName.trim()) {
      Alert.alert("Product Name Needed", "Enter the product name.");
      return false;
    }

    if (!price.trim()) {
      Alert.alert("Price Needed", "Enter the market price.");
      return false;
    }

    if (!quantity.trim()) {
      Alert.alert("Inventory Needed", "Enter the quantity available.");
      return false;
    }

    const numericPrice = Number(price);
    const numericQuantity = Number(quantity);

    if (Number.isNaN(numericPrice) || numericPrice <= 0) {
      Alert.alert("Invalid Price", "Enter a valid price greater than 0.");
      return false;
    }

    if (Number.isNaN(numericQuantity) || numericQuantity < 0) {
      Alert.alert("Invalid Quantity", "Enter a valid stock quantity.");
      return false;
    }

    if (PROCESSING_REQUIRED_CATEGORIES.includes(category) && processingOption === "Not Applicable") {
      Alert.alert(
        "Processing Required",
        "Meat and seafood products need a processing option."
      );
      return false;
    }

    return true;
  }

  async function submitProduct() {
    if (loading) return;
    if (!validateProduct()) return;

    try {
      setLoading(true);

      const duplicateExists = await checkDuplicateProduct(productName);

      if (duplicateExists) {
        Alert.alert(
          "Duplicate Product",
          "This product already exists in your market. Update the existing listing instead of creating a duplicate."
        );
        return;
      }

      const numericPrice = Number(price);
      const numericQuantity = Number(quantity);
      const numericThreshold = Number(lowStockThreshold || 5);
      const now = new Date().toISOString();

      const cleanFarmName = getCleanFarmName(farmName);

      const tags = [
        organic ? "organic" : "",
        local ? "local" : "",
        seasonal ? "seasonal" : "",
        featured ? "featured" : "",
        category.toLowerCase(),
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
        farmName: cleanFarmName,
        farmerName: farmerEmail,

        harvestDate: harvestDate.trim(),
        organic,
        local,
        seasonal,
        featured,
        tags,
        source: "farmer_market_upload",
        active: true,
        available: numericQuantity > 0,
        marketplaceVisible: true,
      } as any;

      await addProductToFarmer(farmerId, newProduct);
      await saveLocalProduct(newProduct);
      await saveProductToMarketplace(newProduct);

      Alert.alert(
        "Added to Farmer Market",
        `${productName.trim()} is now live in your farmer market.`,
        [
          {
            text: "Add Another",
            onPress: resetForm,
          },
          {
            text: "Dashboard",
            onPress: () => router.replace("/farmer/dashboard" as any),
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

  function resetForm() {
    setProductName("");
    setDescription("");
    setCategory("Vegetables");
    setPrice("");
    setQuantity("");
    setLowStockThreshold("5");
    setUnit("each");
    setDeliveryOption("Pickup and Delivery");
    setProcessingOption("Not Applicable");
    setHarvestDate("");
    setImage("");
    setOrganic(false);
    setLocal(true);
    setSeasonal(false);
    setFeatured(true);
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
        activeOpacity={0.88}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <TouchableOpacity
          style={styles.backIconButton}
          onPress={() => router.push("/farmer/dashboard" as any)}
        >
          <Ionicons name="arrow-back-outline" size={22} color="#172017" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Farm2Home Farmer Market</Text>
          <Text style={styles.title}>Add Product to Market</Text>
          <Text style={styles.subtitle}>
            Create a customer-ready listing with category, photo, pricing,
            inventory, fulfillment, and market tags.
          </Text>
        </View>
      </View>

      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroBadge}>{farmName}</Text>
          <Text style={styles.heroTitle}>Publish fresh farm goods.</Text>
          <Text style={styles.heroText}>
            Products added here become visible in the customer marketplace and
            can be used later in farm bundles.
          </Text>
        </View>
        <Text style={styles.heroEmoji}>{categoryEmoji}</Text>
      </View>

      <View style={styles.flowCard}>
        <Text style={styles.flowTitle}>Product Market Flow</Text>
        <FlowStep number="1" text="Choose the product category" />
        <FlowStep number="2" text="Add photo, name, description, and farm details" />
        <FlowStep number="3" text="Set price, unit, quantity, and stock alert" />
        <FlowStep number="4" text="Choose pickup or delivery and publish to market" />
      </View>

      <View style={styles.previewCard}>
        <View style={styles.previewImageBox}>
          {image ? (
            <Image source={{ uri: image }} style={styles.previewThumb} />
          ) : (
            <Text style={styles.previewEmoji}>{categoryEmoji}</Text>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.previewFarm}>{farmName}</Text>
          <Text style={styles.previewName}>{marketPreview.name}</Text>
          <Text style={styles.previewMeta}>
            {marketPreview.category} • {marketPreview.quantity} {marketPreview.unit}
          </Text>
        </View>

        <Text style={styles.previewPrice}>
          ${marketPreview.price.toFixed(2)}
        </Text>
      </View>

      <View style={styles.card}>
        <SectionHeader
          step="Step 1"
          title="Choose Market Category"
          subtitle="Select where customers will find this product."
        />

        <View style={styles.chipWrap}>
          {FARM_PRODUCT_CATEGORIES.map((item) => (
            <ToggleChip
              key={item}
              label={`${CATEGORY_EMOJIS[item] || "🧺"} ${item}`}
              active={category === item}
              onPress={() => selectCategory(item)}
            />
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <SectionHeader
          step="Step 2"
          title="Product Listing Details"
          subtitle="Add the information customers will see in the marketplace."
        />

        <Text style={styles.label}>Product Photo</Text>

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

        <TouchableOpacity style={styles.secondaryBtn} onPress={pickImage}>
          <Text style={styles.secondaryText}>
            {image ? "Change Photo" : "Choose Photo"}
          </Text>
        </TouchableOpacity>

        <Text style={styles.label}>Farm Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Farm Name"
          placeholderTextColor="#8A8F98"
          value={farmName}
          onChangeText={setFarmName}
        />

        <Text style={styles.label}>Product Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Example: Roma Tomatoes"
          placeholderTextColor="#8A8F98"
          value={productName}
          onChangeText={setProductName}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe freshness, harvest details, taste, use, or farm story."
          placeholderTextColor="#8A8F98"
          value={description}
          onChangeText={setDescription}
          multiline
        />
      </View>

      <View style={styles.card}>
        <SectionHeader
          step="Step 3"
          title="Pricing & Inventory"
          subtitle="Set how customers buy and how much stock is available."
        />

        <Text style={styles.label}>Market Price</Text>
        <TextInput
          style={styles.input}
          placeholder="4.99"
          placeholderTextColor="#8A8F98"
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Quantity Available</Text>
        <TextInput
          style={styles.input}
          placeholder="25"
          placeholderTextColor="#8A8F98"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Low Stock Alert</Text>
        <TextInput
          style={styles.input}
          placeholder="5"
          placeholderTextColor="#8A8F98"
          value={lowStockThreshold}
          onChangeText={setLowStockThreshold}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Harvest / Available Date</Text>
        <TextInput
          style={styles.input}
          placeholder="Example: Available this Friday"
          placeholderTextColor="#8A8F98"
          value={harvestDate}
          onChangeText={setHarvestDate}
        />

        <Text style={styles.label}>Selling Unit</Text>
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

      {PROCESSING_REQUIRED_CATEGORIES.includes(category) ? (
        <View style={styles.card}>
          <SectionHeader
            step="Step 4"
            title="Processing Option"
            subtitle="Meat and seafood products need clear processing details."
          />

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
      ) : null}

      <View style={styles.card}>
        <SectionHeader
          step={PROCESSING_REQUIRED_CATEGORIES.includes(category) ? "Step 5" : "Step 4"}
          title="Fulfillment & Market Tags"
          subtitle="Choose how customers receive the product and how it is promoted."
        />

        <Text style={styles.label}>Pickup / Delivery</Text>
        <View style={styles.chipWrap}>
          {FULFILLMENT_OPTIONS.map((item) => (
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
            <Ionicons name="storefront-outline" size={20} color="#FFFFFF" />
            <Text style={styles.submitText}>Publish Product to Farmer Market</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => router.push("/farmer/dashboard" as any)}
      >
        <Text style={styles.backText}>Back to Farmer Dashboard</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function SectionHeader({
  step,
  title,
  subtitle,
}: {
  step: string;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.stepText}>{step}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSub}>{subtitle}</Text>
    </View>
  );
}

function FlowStep({ number, text }: { number: string; text: string }) {
  return (
    <View style={styles.flowStep}>
      <Text style={styles.flowNumber}>{number}</Text>
      <Text style={styles.flowText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F8FAF5",
  },
  content: {
    padding: 18,
    paddingBottom: 70,
  },

  topRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 16,
  },
  backIconButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8DA",
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    color: "#2E7D32",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontSize: 12,
  },
  title: {
    color: "#172017",
    fontSize: 30,
    fontWeight: "900",
    marginTop: 2,
  },
  subtitle: {
    color: "#64748B",
    marginTop: 6,
    lineHeight: 21,
    fontWeight: "700",
  },

  hero: {
    backgroundColor: "#14532D",
    borderRadius: 30,
    padding: 20,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heroBadge: {
    color: "#BBF7D0",
    fontWeight: "900",
    textTransform: "uppercase",
    fontSize: 11,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "900",
    marginTop: 7,
  },
  heroText: {
    color: "#DCFCE7",
    marginTop: 8,
    lineHeight: 21,
    fontWeight: "700",
  },
  heroEmoji: {
    fontSize: 48,
  },

  flowCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8DA",
  },
  flowTitle: {
    color: "#172017",
    fontWeight: "900",
    fontSize: 20,
    marginBottom: 10,
  },
  flowStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  flowNumber: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: "#E9F8EF",
    color: "#14532D",
    textAlign: "center",
    textAlignVertical: "center",
    fontWeight: "900",
    overflow: "hidden",
  },
  flowText: {
    flex: 1,
    color: "#172017",
    fontWeight: "800",
    lineHeight: 19,
  },

  previewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8DA",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  previewImageBox: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: "#FFF3DE",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  previewThumb: {
    width: "100%",
    height: "100%",
  },
  previewEmoji: {
    fontSize: 34,
  },
  previewFarm: {
    color: "#2E7D32",
    fontWeight: "900",
    fontSize: 12,
  },
  previewName: {
    color: "#172017",
    fontWeight: "900",
    fontSize: 17,
    marginTop: 2,
  },
  previewMeta: {
    color: "#64748B",
    fontWeight: "700",
    marginTop: 3,
  },
  previewPrice: {
    color: "#14532D",
    fontWeight: "900",
    fontSize: 18,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8DA",
  },
  sectionHeader: {
    marginBottom: 12,
  },
  stepText: {
    color: "#2E7D32",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  sectionTitle: {
    color: "#172017",
    fontSize: 21,
    fontWeight: "900",
  },
  sectionSub: {
    color: "#64748B",
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 4,
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
    marginBottom: 8,
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