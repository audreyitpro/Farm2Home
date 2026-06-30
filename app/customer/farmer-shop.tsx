// app/customer/farmer-shop.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { addToCart, getCartItemCount } from "../data/cartStore";
import { getApprovedFarmers } from "../data/farmerStore";
import { supabase } from "../data/supabaseClient";
import { API_BASE_URL } from "../config/api";

const COLORS = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  surface: "#F8FAFC",
  primary: "#635BFF",
  primaryDark: "#4638D8",
  primarySoft: "#EEF2FF",
  green: "#10B981",
  greenDark: "#047857",
  greenSoft: "#D1FAE5",
  orange: "#F59E0B",
  orangeSoft: "#FEF3C7",
  red: "#EF4444",
  text: "#101828",
  muted: "#667085",
  border: "#E5E7EB",
  navy: "#020617",
  white: "#FFFFFF",
};

type Product = {
  id: string;
  name: string;
  category?: string;
  price?: number;
  unit?: string;
  image?: string;
  imageUrl?: string;
  image_url?: string;
  description?: string;
  farmerId?: string;
  farmer_id?: string;
  farmName?: string;
  farm_name?: string;
  stock?: number;
  quantity?: number;
  inventory?: number;
  available?: boolean;
  active?: boolean;
  marketplace_visible?: boolean;
  removed_from_inventory?: boolean;
  farmerStripeAccountId?: string;
  farmer_stripe_account_id?: string;
  stripeAccountId?: string;
  stripe_account_id?: string;
};

type FarmBundle = {
  id: string;
  farmer_id: string;
  bundle_name?: string;
  name?: string;
  bundle_type?: string;
  category?: string;
  description?: string;
  price?: number;
  monthly_price?: number;
  bimonthly_price?: number;
  monthly_enabled?: boolean;
  bimonthly_enabled?: boolean;
  delivery_enabled?: boolean;
  shipping_enabled?: boolean;
  available?: boolean;
  is_active?: boolean;
  marketplace_visible?: boolean;
  image_url?: string;
  image?: string;
  items?: string[];
  farmer_stripe_account_id?: string;
  stripe_account_id?: string;
};

type Farmer = {
  id: string;
  farmerId?: string;
  farmName?: string;
  name?: string;
  businessName?: string;
  business_name?: string;
  farm_name?: string;
  location?: string;
  farmLocation?: string;
  farm_location?: string;
  city?: string;
  state?: string;
  about?: string;
  logoUrl?: string;
  farmLogoUrl?: string;
  logo_url?: string;
  farm_logo_url?: string;
  rating?: number;
  distanceMiles?: number;
  distance_miles?: number;
  stripeAccountId?: string;
  farmerStripeAccountId?: string;
  stripe_account_id?: string;
  farmer_stripe_account_id?: string;
  products?: Product[];
  bundles?: FarmBundle[];
};

type CustomerSession = {
  id?: string;
  customer_id?: string;
  customerId?: string;
  email?: string;
  stripe_customer_id?: string;
  stripeCustomerId?: string;
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function firstParam(value: any) {
  if (Array.isArray(value)) return value[0] || "";
  return clean(value);
}

function normalizeId(value: any) {
  return clean(value);
}

function money(value: any) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function getFarmerProductsKey(farmerId: string) {
  return `farmer_products_${farmerId}`;
}

function getFarmerInventoryKey(farmerId: string) {
  return `farmer_inventory_${farmerId}`;
}

function getFarmerName(farmer: Farmer) {
  return clean(
    farmer.farmName ||
      farmer.farm_name ||
      farmer.name ||
      farmer.businessName ||
      farmer.business_name ||
      "Farm2Home Farm"
  );
}

function getFarmerLocation(farmer: Farmer) {
  if (farmer.location) return farmer.location;
  if (farmer.farmLocation) return farmer.farmLocation;
  if (farmer.farm_location) return farmer.farm_location;
  if (farmer.city && farmer.state) return `${farmer.city}, ${farmer.state}`;
  if (farmer.state) return farmer.state;
  return "Local farm";
}

function getFarmerLogo(farmer: Farmer) {
  return clean(farmer.logoUrl || farmer.farmLogoUrl || farmer.logo_url || farmer.farm_logo_url || "");
}

function getProductImage(product: Product) {
  return clean(product.image || product.imageUrl || product.image_url || "");
}

function getBundleImage(bundle: FarmBundle) {
  return clean(bundle.image_url || bundle.image || "");
}

function getProductStock(product: Product) {
  const rawStock = product.stock ?? product.quantity ?? product.inventory;
  if (rawStock === undefined || rawStock === null || clean(rawStock) === "") return 999;
  const stock = Number(rawStock);
  return Number.isFinite(stock) ? stock : 0;
}

function normalizeCategory(category?: string) {
  const value = clean(category);
  if (!value) return "Farm Goods";
  if (value === "Fish Farm / Aquaculture") return "Fish & Aquaculture";
  if (value === "Bale of Hay" || value === "Hay") return "Hay & Feed";
  if (value === "Plants & Herbs") return "Plants & Nursery";
  if (value === "Seasonal") return "Seasonal Products";
  return value;
}

function isProductAvailable(product: Product) {
  if (!clean(product?.name)) return false;
  if (product.available === false) return false;
  if (product.active === false) return false;
  if (product.marketplace_visible === false) return false;
  if (product.removed_from_inventory === true) return false;
  return getProductStock(product) > 0;
}

function isBundleAvailable(bundle: FarmBundle) {
  if (!clean(bundle.bundle_name || bundle.name)) return false;
  if (bundle.available === false) return false;
  if (bundle.is_active === false) return false;
  if (bundle.marketplace_visible === false) return false;
  if (!bundle.monthly_enabled && !bundle.bimonthly_enabled) return false;
  return true;
}

function getFarmerStripeAccountId(farmer: Farmer, product?: Product | FarmBundle) {
  return clean(
    (product as any)?.farmerStripeAccountId ||
      (product as any)?.farmer_stripe_account_id ||
      (product as any)?.stripeAccountId ||
      (product as any)?.stripe_account_id ||
      farmer.farmerStripeAccountId ||
      farmer.farmer_stripe_account_id ||
      farmer.stripeAccountId ||
      farmer.stripe_account_id ||
      ""
  );
}

function normalizeProduct(product: any, farmer: Farmer): Product {
  const farmerId = normalizeId(product.farmerId || product.farmer_id || farmer.id || farmer.farmerId);
  const image = clean(product.image_url || product.imageUrl || product.image || "");

  return {
    ...product,
    id: clean(product.id || `${farmerId}_${product.name || product.product_name || "product"}`),
    name: clean(product.name || product.product_name || "Farm Product"),
    description: clean(product.description || ""),
    category: normalizeCategory(product.category || product.product_category),
    price: Number(product.price || product.unit_price || product.amount || 0),
    unit: clean(product.unit || product.sell_by || "each"),
    image,
    imageUrl: image,
    image_url: image,
    farmerId,
    farmer_id: farmerId,
    farmName: clean(product.farmName || product.farm_name || getFarmerName(farmer)),
    farm_name: clean(product.farmName || product.farm_name || getFarmerName(farmer)),
    stock: getProductStock(product),
    quantity: getProductStock(product),
    inventory: getProductStock(product),
    available: product.available !== false,
    active: product.active !== false,
    marketplace_visible: product.marketplace_visible !== false,
    removed_from_inventory: product.removed_from_inventory === true,
    farmerStripeAccountId: clean(product.farmer_stripe_account_id || product.stripe_account_id || getFarmerStripeAccountId(farmer)),
    farmer_stripe_account_id: clean(product.farmer_stripe_account_id || product.stripe_account_id || getFarmerStripeAccountId(farmer)),
  };
}

function normalizeBundle(row: any, farmer: Farmer): FarmBundle {
  const farmerId = clean(row.farmer_id || row.farmerId || farmer.id || farmer.farmerId);
  return {
    ...row,
    id: clean(row.id || `${farmerId}_${row.bundle_name || row.name || "bundle"}`),
    farmer_id: farmerId,
    bundle_name: clean(row.bundle_name || row.name || "Farm Bundle"),
    name: clean(row.name || row.bundle_name || "Farm Bundle"),
    bundle_type: clean(row.bundle_type || row.category || "Farm Bundle"),
    category: clean(row.category || row.bundle_type || "Farm Bundle"),
    description: clean(row.description || ""),
    price: Number(row.price || row.monthly_price || 0),
    monthly_price: Number(row.monthly_price || row.price || 0),
    bimonthly_price: Number(row.bimonthly_price || 0),
    monthly_enabled: row.monthly_enabled !== false,
    bimonthly_enabled: row.bimonthly_enabled === true,
    delivery_enabled: row.delivery_enabled !== false,
    shipping_enabled: row.shipping_enabled === true,
    available: row.available !== false,
    is_active: row.is_active !== false,
    marketplace_visible: row.marketplace_visible !== false,
    image_url: clean(row.image_url || row.image || ""),
    items: Array.isArray(row.items) ? row.items.map(clean).filter(Boolean) : [],
    farmer_stripe_account_id: clean(row.farmer_stripe_account_id || row.stripe_account_id || getFarmerStripeAccountId(farmer)),
    stripe_account_id: clean(row.stripe_account_id || row.farmer_stripe_account_id || getFarmerStripeAccountId(farmer)),
  };
}

function normalizeFarmer(farmer: Farmer, products: Product[] = [], bundles: FarmBundle[] = []) {
  const farmName = getFarmerName(farmer);
  const stripeAccountId = getFarmerStripeAccountId(farmer);

  const base = {
    ...farmer,
    id: clean(farmer.id || farmer.farmerId || ""),
    farmName,
    name: farmName,
    location: getFarmerLocation(farmer),
    logoUrl: getFarmerLogo(farmer),
    stripeAccountId,
    farmerStripeAccountId: stripeAccountId,
  };

  return {
    ...base,
    products: products.map((product) => normalizeProduct(product, base)).filter(isProductAvailable),
    bundles: bundles.map((bundle) => normalizeBundle(bundle, base)).filter(isBundleAvailable),
  };
}

function mapFarmerRow(row: any, fallbackId: string): Farmer {
  const farmName = clean(
    row?.farm_name || row?.business_name || row?.farmName || row?.businessName || row?.name || "Local Farm"
  );
  const logo = clean(row?.logo_url || row?.farm_logo_url || row?.logoUrl || row?.farmLogoUrl || "");

  return {
    id: clean(row?.id || row?.farmer_id || fallbackId),
    farmerId: clean(row?.id || row?.farmer_id || fallbackId),
    farmName,
    name: farmName,
    businessName: clean(row?.business_name || farmName),
    business_name: clean(row?.business_name || farmName),
    location:
      row?.city && row?.state
        ? `${row.city}, ${row.state}`
        : clean(row?.farm_location || row?.location || row?.state || "Local farm"),
    city: clean(row?.city || ""),
    state: clean(row?.state || ""),
    about: clean(row?.about || row?.description || ""),
    logoUrl: logo,
    farmLogoUrl: logo,
    rating: Number(row?.rating || 4.8),
    distanceMiles: Number(row?.distance_miles || row?.distanceMiles || 5),
    stripeAccountId: clean(row?.stripe_account_id || row?.farmer_stripe_account_id || ""),
    farmerStripeAccountId: clean(row?.farmer_stripe_account_id || row?.stripe_account_id || ""),
    products: Array.isArray(row?.products) ? row.products : [],
    bundles: Array.isArray(row?.bundles) ? row.bundles : [],
  };
}

function mapProductRow(row: any): Product {
  const image = clean(row.image_url || row.image || row.imageUrl || "");

  return {
    id: clean(row.id || `product_${Date.now()}_${Math.random()}`),
    name: clean(row.name || row.product_name || "Farm Product"),
    description: clean(row.description || ""),
    category: normalizeCategory(row.category || row.product_category),
    price: Number(row.price || row.unit_price || row.amount || 0),
    unit: clean(row.unit || row.sell_by || "each"),
    image,
    imageUrl: image,
    image_url: image,
    farmerId: clean(row.farmer_id || row.farmerId || ""),
    farmer_id: clean(row.farmer_id || row.farmerId || ""),
    farmName: clean(row.farm_name || row.farmName || ""),
    farm_name: clean(row.farm_name || row.farmName || ""),
    stock: Number(row.stock ?? row.quantity ?? row.inventory ?? 0),
    quantity: Number(row.quantity ?? row.stock ?? row.inventory ?? 0),
    inventory: Number(row.inventory ?? row.stock ?? row.quantity ?? 0),
    available: row.available !== false,
    active: row.active !== false,
    marketplace_visible: row.marketplace_visible !== false,
    removed_from_inventory: row.removed_from_inventory === true,
    farmerStripeAccountId: clean(row.farmer_stripe_account_id || row.stripe_account_id || ""),
    farmer_stripe_account_id: clean(row.farmer_stripe_account_id || row.stripe_account_id || ""),
  };
}

async function readCustomerSession(): Promise<CustomerSession | null> {
  const raw =
    (await AsyncStorage.getItem("currentCustomer")) ||
    (await AsyncStorage.getItem("farm2homeCurrentCustomer")) ||
    (await AsyncStorage.getItem("currentUser"));

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getCustomerId(customer: CustomerSession | null) {
  return clean(customer?.id || customer?.customer_id || customer?.customerId || "");
}

function getStripeCustomerId(customer: CustomerSession | null) {
  return clean(customer?.stripe_customer_id || customer?.stripeCustomerId || "");
}

export default function FarmerShopScreen() {
  const params = useLocalSearchParams();

  const farmerId = firstParam(params.farmerId || params.id || params.farmer_id);
  const farmerNameParam = firstParam(params.farmName || params.name);

  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [customer, setCustomer] = useState<CustomerSession | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<"products" | "bundles">("products");
  const [subscribingId, setSubscribingId] = useState<string | null>(null);

  useEffect(() => {
    loadFarmer();
    refreshCartCount();
    readCustomerSession().then(setCustomer);
  }, [farmerId]);

  async function refreshCartCount() {
    try {
      setCartCount(await getCartItemCount());
    } catch {
      setCartCount(0);
    }
  }

  async function loadFarmer() {
    try {
      setLoading(true);

      if (!farmerId) {
        setFarmer(null);
        return;
      }

      const found = await loadFarmerAllSources(farmerId);
      setFarmer(found);
    } catch (error) {
      console.log("Load farmer shop error:", error);
      setFarmer(null);
    } finally {
      setLoading(false);
    }
  }

  async function readLocalProducts(activeFarmerId: string) {
    const keys = [
      getFarmerProductsKey(activeFarmerId),
      getFarmerInventoryKey(activeFarmerId),
      "farmer_products",
      "farm_products",
      "farm_inventory",
      "selected_produce",
      "selectedProduce",
    ];

    const all: Product[] = [];

    for (const key of keys) {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed) ? parsed : parsed?.products || parsed?.inventory || [];

        if (Array.isArray(list)) {
          all.push(
            ...list.filter((item: any) => {
              const itemFarmerId = normalizeId(item.farmer_id || item.farmerId || activeFarmerId);
              return itemFarmerId === activeFarmerId || !item.farmer_id;
            })
          );
        }
      } catch {
        continue;
      }
    }

    return all;
  }

  async function queryProductTable(tableName: string, activeFarmerId: string) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("farmer_id", activeFarmerId);

      if (!error && Array.isArray(data)) return data.map(mapProductRow);
    } catch {
      return [];
    }

    return [];
  }

  async function loadBundles(activeFarmerId: string, farmerBase: Farmer) {
    try {
      const { data, error } = await supabase
        .from("farm_bundles")
        .select("*")
        .eq("farmer_id", activeFarmerId);

      if (error || !Array.isArray(data)) return [];
      return data.map((row) => normalizeBundle(row, farmerBase)).filter(isBundleAvailable);
    } catch (error) {
      console.log("farmer shop bundles skipped:", error);
      return [];
    }
  }

  async function loadFarmerAllSources(activeFarmerId: string) {
    let farmerBase: Farmer | null = null;
    let products: Product[] = [];

    products.push(...(await readLocalProducts(activeFarmerId)));

    const { data: farmerRow } = await supabase
      .from("farmers")
      .select("*")
      .eq("id", activeFarmerId)
      .maybeSingle();

    if (farmerRow) {
      farmerBase = mapFarmerRow(farmerRow, activeFarmerId);

      if (products.length === 0 && Array.isArray(farmerRow.products)) {
        products = farmerRow.products;
      }
    }

    const productTables = ["products", "farmer_products", "farm_products", "farm_inventory", "inventory"];

    for (const tableName of productTables) {
      const rows = await queryProductTable(tableName, activeFarmerId);
      if (rows.length > 0) products.push(...rows);
    }

    const localFarmer = await loadFarmerFromLocal(activeFarmerId);

    if (!farmerBase && localFarmer) farmerBase = localFarmer;
    if (products.length === 0 && localFarmer?.products?.length) products = localFarmer.products;

    const uniqueProducts = Array.from(
      new Map(
        products.filter(Boolean).map((item: any) => {
          const key = clean(item.id || item.name || Math.random());
          return [key, item];
        })
      ).values()
    ) as Product[];

    if (!farmerBase && uniqueProducts.length === 0) return null;

    const base = farmerBase || {
      id: activeFarmerId,
      farmName: farmerNameParam || "Local Farm",
    };

    const bundles = await loadBundles(activeFarmerId, base);

    return normalizeFarmer(base, uniqueProducts, bundles);
  }

  async function loadFarmerFromLocal(activeFarmerId: string) {
    const approvedFarmers = (await getApprovedFarmers()) || [];

    const currentRaw =
      (await AsyncStorage.getItem("currentFarmer")) ||
      (await AsyncStorage.getItem("currentUser"));

    const currentFarmer = currentRaw ? JSON.parse(currentRaw) : null;

    const localFarmers = [
      ...(Array.isArray(approvedFarmers) ? approvedFarmers : []),
      ...(currentFarmer?.id || currentFarmer?.farmerId ? [currentFarmer] : []),
    ];

    const selected = localFarmers.find(
      (item: any) =>
        clean(item?.id) === clean(activeFarmerId) ||
        clean(item?.farmerId) === clean(activeFarmerId)
    );

    if (!selected) return null;

    return normalizeFarmer(
      {
        ...selected,
        id: selected.id || selected.farmerId,
        farmName:
          selected.farmName ||
          selected.businessName ||
          selected.business_name ||
          selected.farm_name ||
          "Farm2Home Farm",
      },
      selected.products || [],
      selected.bundles || []
    );
  }

  const groupedProducts = useMemo(() => {
    if (!farmer?.products) return {};

    return farmer.products.reduce((acc: Record<string, Product[]>, product) => {
      const category = normalizeCategory(product.category);
      if (!acc[category]) acc[category] = [];
      acc[category].push(product);
      return acc;
    }, {});
  }, [farmer]);

  const categories = Object.keys(groupedProducts);
  const productCount = farmer?.products?.length || 0;
  const bundleCount = farmer?.bundles?.length || 0;

  async function handleAddToCart(product: Product) {
    try {
      if (!farmer) return;

      await addToCart({
        id: `${farmer.id}_${product.id}`,
        cartItemId: `${farmer.id}_${product.id}`,
        productId: product.id,
        product_id: product.id,
        name: product.name,
        productName: product.name,
        product_name: product.name,
        quantity: 1,
        price: Number(product.price || 0),
        image: getProductImage(product),
        imageUrl: getProductImage(product),
        image_url: getProductImage(product),
        farmName: getFarmerName(farmer),
        farm_name: getFarmerName(farmer),
        farmerName: getFarmerName(farmer),
        farmerId: farmer.id,
        farmer_id: farmer.id,
        farmerStripeAccountId: getFarmerStripeAccountId(farmer, product),
        stripeAccountId: getFarmerStripeAccountId(farmer, product),
        farmer_stripe_account_id: getFarmerStripeAccountId(farmer, product),
        stripe_account_id: getFarmerStripeAccountId(farmer, product),
        unit: product.unit || "each",
        category: normalizeCategory(product.category),
        stock: getProductStock(product),
        addedAt: new Date().toISOString(),
      } as any);

      await refreshCartCount();
      Alert.alert("Added to Cart", `${product.name} was added to your cart.`);
    } catch (error) {
      console.log("Farmer shop add to cart error:", error);
      Alert.alert("Error", "Unable to add item to cart.");
    }
  }

  async function startBundleSubscription(bundle: FarmBundle, billingInterval: "monthly" | "bimonthly") {
    try {
      if (!farmer) return;

      const activeCustomer = customer || (await readCustomerSession());
      setCustomer(activeCustomer);

      const customerId = getCustomerId(activeCustomer);
      const stripeCustomerId = getStripeCustomerId(activeCustomer);
      const selectedPrice = billingInterval === "monthly" ? Number(bundle.monthly_price || bundle.price || 0) : Number(bundle.bimonthly_price || 0);

      if (!customerId || !stripeCustomerId) {
        Alert.alert("Membership Required", "Please complete customer registration before subscribing.");
        router.push("/customer/register" as any);
        return;
      }

      if (!selectedPrice || selectedPrice <= 0) {
        Alert.alert("Price Missing", "This subscription option does not have a valid price yet.");
        return;
      }

      setSubscribingId(`${bundle.id}_${billingInterval}`);

      const response = await fetch(`${API_BASE_URL}/payments/create-bundle-subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bundleId: bundle.id,
          bundleName: bundle.bundle_name || bundle.name || "Farm Bundle",
          farmerId: farmer.id,
          customerId,
          customerEmail: activeCustomer?.email || "",
          stripeCustomerId,
          farmerStripeAccountId: getFarmerStripeAccountId(farmer, bundle),
          billingInterval,
          price: selectedPrice,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success || !result?.url) {
        throw new Error(result?.message || "Unable to start subscription.");
      }

      await WebBrowser.openBrowserAsync(result.url);
    } catch (error: any) {
      console.log("Bundle subscription error:", error);
      Alert.alert("Subscription Error", error?.message || "Unable to start subscription.");
    } finally {
      setSubscribingId(null);
    }
  }

  function renderProduct(product: Product) {
    const imageSource = getProductImage(product);
    const stock = getProductStock(product);

    return (
      <View key={product.id} style={styles.productRow}>
        {imageSource ? (
          <Image source={{ uri: imageSource }} style={styles.productImage} />
        ) : (
          <View style={styles.productImageFallback}>
            <Text style={styles.productImageFallbackText}>{product.name.slice(0, 1)}</Text>
          </View>
        )}

        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
          <Text style={styles.productDetails} numberOfLines={1}>
            {money(product.price)} / {product.unit || "each"} · {stock} in stock
          </Text>
          <Text style={styles.productDescription} numberOfLines={2}>
            {product.description || "Fresh local farm product."}
          </Text>
        </View>

        <Pressable style={({ pressed }) => [styles.addButton, pressed && styles.pressed]} onPress={() => handleAddToCart(product)}>
          <Ionicons name="add-outline" size={16} color={COLORS.white} />
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>
    );
  }

  function renderBundle(bundle: FarmBundle) {
    const imageSource = getBundleImage(bundle);
    const title = bundle.bundle_name || bundle.name || "Farm Bundle";

    return (
      <View key={bundle.id} style={styles.bundleCard}>
        <View style={styles.bundleTopRow}>
          {imageSource ? (
            <Image source={{ uri: imageSource }} style={styles.bundleImage} />
          ) : (
            <View style={styles.bundleImageFallback}>
              <Ionicons name="basket-outline" size={28} color={COLORS.greenDark} />
            </View>
          )}

          <View style={{ flex: 1 }}>
            <Text style={styles.bundleType}>{bundle.bundle_type || bundle.category || "Farm Bundle"}</Text>
            <Text style={styles.bundleName}>{title}</Text>
            <Text style={styles.bundleDescription} numberOfLines={2}>
              {bundle.description || "Fresh recurring farm box prepared by this farmer."}
            </Text>
          </View>
        </View>

        {bundle.items?.length ? (
          <View style={styles.bundleItemsWrap}>
            {bundle.items.slice(0, 6).map((item, index) => (
              <Text key={`${bundle.id}_${index}`} style={styles.bundleItemPill}>{item}</Text>
            ))}
          </View>
        ) : null}

        <View style={styles.fulfillmentRow}>
          {bundle.delivery_enabled ? <Text style={styles.fulfillmentPill}>Local Delivery</Text> : null}
          {bundle.shipping_enabled ? <Text style={styles.fulfillmentPill}>Shipping</Text> : null}
        </View>

        <View style={styles.subscriptionOptions}>
          {bundle.monthly_enabled ? (
            <Pressable
              style={({ pressed }) => [styles.subscriptionButton, pressed && styles.pressed]}
              onPress={() => startBundleSubscription(bundle, "monthly")}
              disabled={Boolean(subscribingId)}
            >
              {subscribingId === `${bundle.id}_monthly` ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Text style={styles.subscriptionLabel}>Monthly</Text>
                  <Text style={styles.subscriptionPrice}>{money(bundle.monthly_price || bundle.price)}</Text>
                </>
              )}
            </Pressable>
          ) : null}

          {bundle.bimonthly_enabled ? (
            <Pressable
              style={({ pressed }) => [styles.subscriptionButtonLight, pressed && styles.pressed]}
              onPress={() => startBundleSubscription(bundle, "bimonthly")}
              disabled={Boolean(subscribingId)}
            >
              {subscribingId === `${bundle.id}_bimonthly` ? (
                <ActivityIndicator color={COLORS.primary} />
              ) : (
                <>
                  <Text style={styles.subscriptionLabelLight}>Bi-Monthly</Text>
                  <Text style={styles.subscriptionPriceLight}>{money(bundle.bimonthly_price)}</Text>
                </>
              )}
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.centerText}>Loading storefront...</Text>
      </View>
    );
  }

  if (!farmer) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerTitle}>Farmer shop not found</Text>
        <Text style={styles.centerSub}>This store may no longer be available.</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.replace("/customer/marketplace" as any)}>
          <Text style={styles.primaryButtonText}>Back to Marketplace</Text>
        </Pressable>
      </View>
    );
  }

  const farmName = getFarmerName(farmer);
  const farmLocation = getFarmerLocation(farmer);
  const logo = getFarmerLogo(farmer);

  return (
    <View style={styles.page}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <View style={styles.topBar}>
            <Pressable style={({ pressed }) => [styles.backButton, pressed && styles.pressed]} onPress={() => router.push("/customer/marketplace" as any)}>
              <Ionicons name="chevron-back-outline" size={23} color={COLORS.white} />
            </Pressable>

            <Pressable style={({ pressed }) => [styles.cartButton, pressed && styles.pressed]} onPress={() => router.push("/customer/cart" as any)}>
              <Ionicons name="cart-outline" size={18} color={COLORS.navy} />
              <Text style={styles.cartText}>{cartCount}</Text>
            </Pressable>
          </View>

          <View style={styles.heroStoreRow}>
            {logo ? (
              <Image source={{ uri: logo }} style={styles.logo} />
            ) : (
              <View style={styles.logoFallback}>
                <Text style={styles.logoFallbackText}>{farmName.slice(0, 1)}</Text>
              </View>
            )}

            <View style={{ flex: 1 }}>
              <Text style={styles.heroBadge}>Farm2Home Store</Text>
              <Text style={styles.heroTitle}>{farmName}</Text>
              <Text style={styles.heroSubtitle}>{farmLocation}</Text>
            </View>
          </View>

          <Text style={styles.heroAbout} numberOfLines={3}>
            {farmer.about || "Fresh local products and recurring farm bundles prepared directly by this Farm2Home seller."}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="star-outline" size={17} color={COLORS.primary} />
            <Text style={styles.statValue}>{Number(farmer.rating || 4.8).toFixed(1)}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="leaf-outline" size={17} color={COLORS.primary} />
            <Text style={styles.statValue}>{productCount}</Text>
            <Text style={styles.statLabel}>Products</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="basket-outline" size={17} color={COLORS.primary} />
            <Text style={styles.statValue}>{bundleCount}</Text>
            <Text style={styles.statLabel}>Bundles</Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          <Pressable style={[styles.tabButton, selectedTab === "products" && styles.tabButtonActive]} onPress={() => setSelectedTab("products")}>
            <Text style={[styles.tabText, selectedTab === "products" && styles.tabTextActive]}>Products</Text>
          </Pressable>

          <Pressable style={[styles.tabButton, selectedTab === "bundles" && styles.tabButtonActive]} onPress={() => setSelectedTab("bundles")}>
            <Text style={[styles.tabText, selectedTab === "bundles" && styles.tabTextActive]}>Bundles</Text>
          </Pressable>
        </View>

        {selectedTab === "products" ? (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Available Products</Text>
              <Text style={styles.sectionSub}>Shop fresh items directly from this seller.</Text>
            </View>

            {productCount === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="leaf-outline" size={36} color={COLORS.primary} />
                <Text style={styles.emptyTitle}>No active products</Text>
                <Text style={styles.emptyText}>This seller does not have marketplace products available right now.</Text>
              </View>
            ) : (
              categories.map((category) => (
                <View key={category} style={styles.categorySection}>
                  <View style={styles.categoryHeader}>
                    <Text style={styles.categoryTitle}>{category}</Text>
                    <Text style={styles.categoryCount}>{groupedProducts[category].length} item{groupedProducts[category].length === 1 ? "" : "s"}</Text>
                  </View>
                  {groupedProducts[category].map(renderProduct)}
                </View>
              ))
            )}
          </View>
        ) : (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Subscription Bundles</Text>
              <Text style={styles.sectionSub}>Choose monthly or bi-monthly bundles priced by this farmer.</Text>
            </View>

            {bundleCount === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="basket-outline" size={36} color={COLORS.primary} />
                <Text style={styles.emptyTitle}>No active bundles</Text>
                <Text style={styles.emptyText}>This seller has not published subscription bundles yet.</Text>
              </View>
            ) : (
              farmer.bundles?.map(renderBundle)
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={({ pressed }) => [styles.footerButton, pressed && styles.pressed]} onPress={() => router.push("/customer/cart" as any)}>
          <Ionicons name="cart-outline" size={18} color={COLORS.white} />
          <Text style={styles.footerButtonText}>View Cart ({cartCount})</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.bg },
  scrollContent: { paddingBottom: 104 },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  centerText: { marginTop: 12, fontSize: 15, fontWeight: "800", color: COLORS.primary },
  centerTitle: { fontSize: 22, fontWeight: "900", color: COLORS.text },
  centerSub: { color: COLORS.muted, fontWeight: "700", marginTop: 6, textAlign: "center" },
  primaryButton: { backgroundColor: COLORS.primary, paddingVertical: 13, paddingHorizontal: 18, borderRadius: 14, marginTop: 18 },
  primaryButtonText: { color: COLORS.white, fontWeight: "900" },
  hero: {
    backgroundColor: COLORS.navy,
    paddingTop: Platform.OS === "ios" ? 62 : 42,
    paddingHorizontal: 18,
    paddingBottom: 28,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.14)",
    justifyContent: "center",
    alignItems: "center",
  },
  cartButton: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  cartText: { color: COLORS.navy, fontWeight: "900" },
  heroStoreRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  logo: { width: 74, height: 74, borderRadius: 24, backgroundColor: COLORS.greenSoft, borderWidth: 3, borderColor: "rgba(255,255,255,0.22)" },
  logoFallback: {
    width: 74,
    height: 74,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.22)",
  },
  logoFallbackText: { color: COLORS.white, fontSize: 30, fontWeight: "900" },
  heroBadge: { color: "#A5B4FC", fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.7, fontSize: 12 },
  heroTitle: { color: COLORS.white, fontSize: 30, lineHeight: 35, fontWeight: "900", marginTop: 4 },
  heroSubtitle: { color: "#CBD5E1", fontWeight: "800", marginTop: 4 },
  heroAbout: { color: "#E0E7FF", fontWeight: "700", lineHeight: 21, marginTop: 16 },
  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 18, marginTop: -18, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.navy,
    shadowOpacity: Platform.OS === "ios" ? 0.06 : 0,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 2,
  },
  statValue: { color: COLORS.text, fontSize: 22, fontWeight: "900", marginTop: 5 },
  statLabel: { color: COLORS.muted, fontWeight: "800", fontSize: 12, marginTop: 2 },
  tabRow: { flexDirection: "row", backgroundColor: COLORS.primarySoft, borderRadius: 18, padding: 5, marginHorizontal: 18, marginBottom: 16 },
  tabButton: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  tabButtonActive: { backgroundColor: COLORS.primary },
  tabText: { color: COLORS.primary, fontWeight: "900" },
  tabTextActive: { color: COLORS.white },
  sectionHeader: { paddingHorizontal: 18, marginBottom: 12 },
  sectionTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900" },
  sectionSub: { color: COLORS.muted, fontWeight: "700", fontSize: 13, marginTop: 4 },
  categorySection: { marginBottom: 18, paddingHorizontal: 18 },
  categoryHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 9, alignItems: "center" },
  categoryTitle: { color: COLORS.text, fontSize: 17, fontWeight: "900" },
  categoryCount: { color: COLORS.muted, fontWeight: "800", fontSize: 12 },
  productRow: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 10,
  },
  productImage: { width: 70, height: 70, borderRadius: 16, backgroundColor: COLORS.greenSoft },
  productImageFallback: { width: 70, height: 70, borderRadius: 16, backgroundColor: COLORS.greenSoft, justifyContent: "center", alignItems: "center" },
  productImageFallbackText: { color: COLORS.greenDark, fontSize: 26, fontWeight: "900" },
  productInfo: { flex: 1 },
  productName: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  productDetails: { color: COLORS.primary, fontWeight: "900", fontSize: 12, marginTop: 4 },
  productDescription: { color: COLORS.muted, fontWeight: "700", fontSize: 12, lineHeight: 17, marginTop: 4 },
  addButton: { backgroundColor: COLORS.primary, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 3 },
  addButtonText: { color: COLORS.white, fontWeight: "900", fontSize: 12 },
  bundleCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 15,
    marginHorizontal: 18,
    marginBottom: 14,
  },
  bundleTopRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  bundleImage: { width: 78, height: 78, borderRadius: 20, backgroundColor: COLORS.greenSoft },
  bundleImageFallback: { width: 78, height: 78, borderRadius: 20, backgroundColor: COLORS.greenSoft, alignItems: "center", justifyContent: "center" },
  bundleType: { color: COLORS.primary, fontWeight: "900", fontSize: 12, textTransform: "uppercase" },
  bundleName: { color: COLORS.text, fontSize: 19, fontWeight: "900", marginTop: 3 },
  bundleDescription: { color: COLORS.muted, fontWeight: "700", lineHeight: 19, marginTop: 5 },
  bundleItemsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 13 },
  bundleItemPill: { backgroundColor: COLORS.orangeSoft, color: "#92400E", fontWeight: "900", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, overflow: "hidden", fontSize: 12 },
  fulfillmentRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
  fulfillmentPill: { backgroundColor: COLORS.greenSoft, color: COLORS.greenDark, fontWeight: "900", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, overflow: "hidden", fontSize: 12 },
  subscriptionOptions: { flexDirection: "row", gap: 10, marginTop: 14 },
  subscriptionButton: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 16, padding: 13, alignItems: "center", minHeight: 64, justifyContent: "center" },
  subscriptionButtonLight: { flex: 1, backgroundColor: COLORS.primarySoft, borderRadius: 16, padding: 13, alignItems: "center", minHeight: 64, justifyContent: "center", borderWidth: 1, borderColor: COLORS.primary },
  subscriptionLabel: { color: COLORS.white, fontWeight: "900", fontSize: 12 },
  subscriptionPrice: { color: COLORS.white, fontWeight: "900", fontSize: 18, marginTop: 3 },
  subscriptionLabelLight: { color: COLORS.primary, fontWeight: "900", fontSize: 12 },
  subscriptionPriceLight: { color: COLORS.primary, fontWeight: "900", fontSize: 18, marginTop: 3 },
  emptyBox: { backgroundColor: COLORS.card, borderRadius: 22, padding: 24, alignItems: "center", borderWidth: 1, borderColor: COLORS.border, marginHorizontal: 18 },
  emptyTitle: { color: COLORS.text, fontWeight: "900", fontSize: 18, marginTop: 8 },
  emptyText: { color: COLORS.muted, fontWeight: "700", textAlign: "center", marginTop: 8, lineHeight: 20 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border, padding: 12 },
  footerButton: { backgroundColor: COLORS.navy, borderRadius: 16, paddingVertical: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  footerButtonText: { color: COLORS.white, fontWeight: "900", fontSize: 14 },
  pressed: { opacity: 0.76 },
});
