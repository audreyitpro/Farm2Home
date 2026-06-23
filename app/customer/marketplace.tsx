// app/customer/marketplace.tsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { addToCart, getCartItemCount } from "../data/cartStore";
import { getApprovedFarmers } from "../data/farmerStore";
import { supabase } from "../data/supabaseClient";

/**
 * app/customer/marketplace.tsx
 *
 * Fina-style Customer Marketplace.
 *
 * Updates:
 * - Color scheme matches Freight/Fina UI: navy + purple, soft cards, light surfaces.
 * - Removed red/black marketplace theme.
 * - Keeps existing marketplace logic and routes.
 * - Still groups each farmer into its own grocery row.
 */

const COLORS = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  surface: "#F8FAFC",
  surface2: "#F1F5F9",
  primary: "#635BFF",
  primaryDark: "#4638D8",
  primarySoft: "#EEF2FF",
  accent: "#10B981",
  accentDark: "#047857",
  accentSoft: "#D1FAE5",
  warning: "#F59E0B",
  warningSoft: "#FEF3C7",
  danger: "#EF4444",
  dangerSoft: "#FEE2E2",
  blue: "#2563EB",
  blueSoft: "#DBEAFE",
  text: "#101828",
  muted: "#667085",
  border: "#E5E7EB",
  white: "#FFFFFF",
  navy: "#020617",
  navyCard: "#111827",
};

const DEFAULT_CATEGORIES = [
  "All",
  "Vegetables",
  "Fruits",
  "Eggs",
  "Honey",
  "Meat",
  "Poultry",
  "Fish & Aquaculture",
  "Dairy",
  "Baked Goods",
  "Flowers",
  "Plants & Nursery",
  "Hay & Feed",
  "Farm Supplies",
  "Seasonal Products",
  "Specialty Products",
];

type Product = {
  id: string;
  name: string;
  category?: string;
  price?: number;
  unit?: string;
  description?: string;
  image?: string;
  imageUrl?: string;
  image_url?: string;
  farmerId?: string;
  farmer_id?: string;
  farmName?: string;
  farm_name?: string;
  farmerEmail?: string;
  farmer_email?: string;
  farmerStripeAccountId?: string;
  stripeAccountId?: string;
  stripe_account_id?: string;
  farmer_stripe_account_id?: string;
  stock?: number;
  quantity?: number;
  inventory?: number;
  available?: boolean;
  active?: boolean;
  marketplace_visible?: boolean;
  removed_from_inventory?: boolean;
  organic?: boolean;
  local?: boolean;
  seasonal?: boolean;
  featured?: boolean;
  tags?: string[];
};

type Farmer = {
  id: string;
  farmerId?: string;
  farmName?: string;
  name?: string;
  businessName?: string;
  business_name?: string;
  farm_name?: string;
  farmLocation?: string;
  farm_location?: string;
  location?: string;
  city?: string;
  state?: string;
  about?: string;
  rating?: number;
  distanceMiles?: number;
  distance_miles?: number;
  logoUrl?: string;
  farmLogoUrl?: string;
  logo_url?: string;
  farm_logo_url?: string;
  stripeAccountId?: string;
  farmerStripeAccountId?: string;
  stripe_account_id?: string;
  farmer_stripe_account_id?: string;
  products?: Product[];
};

type CustomerSession = {
  id?: string;
  customerId?: string;
  customer_id?: string;
  account_id?: string;
  accountId?: string;
  email?: string;
  full_name?: string;
  fullName?: string;
  name?: string;
  stripe_customer_id?: string;
  stripeCustomerId?: string;
  subscription_id?: string;
  subscriptionId?: string;
  stripe_subscription_id?: string;
  stripeSubscriptionId?: string;
  membership_status?: string;
  membershipStatus?: string;
  subscription_status?: string;
  subscriptionStatus?: string;
  account_active?: boolean;
  accountActive?: boolean;
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function normalizeId(value: any) {
  return clean(value);
}

function isCus(value: any) {
  return clean(value).startsWith("cus_");
}

function isSub(value: any) {
  return clean(value).startsWith("sub_");
}

function getCustomerId(customer: CustomerSession | null) {
  return clean(customer?.id || customer?.customer_id || customer?.customerId);
}

function getCustomerName(customer: CustomerSession | null) {
  return clean(customer?.full_name || customer?.fullName || customer?.name || "Customer");
}

function getStripeCustomer(customer: CustomerSession | null) {
  return clean(customer?.stripe_customer_id || customer?.stripeCustomerId);
}

function getStripeSubscription(customer: CustomerSession | null) {
  return clean(
    customer?.subscription_id ||
      customer?.subscriptionId ||
      customer?.stripe_subscription_id ||
      customer?.stripeSubscriptionId
  );
}

function statusBlocked(value: any) {
  return ["canceled", "cancelled", "unpaid", "inactive", "disabled", "rejected"].includes(
    normalize(value)
  );
}

function customerReady(customer: CustomerSession | null) {
  return Boolean(
    getCustomerId(customer) &&
      isCus(getStripeCustomer(customer)) &&
      isSub(getStripeSubscription(customer)) &&
      customer?.account_active !== false &&
      customer?.accountActive !== false &&
      !statusBlocked(customer?.membership_status || customer?.membershipStatus) &&
      !statusBlocked(customer?.subscription_status || customer?.subscriptionStatus)
  );
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
  if (farmer.farmLocation) return farmer.farmLocation;
  if (farmer.farm_location) return farmer.farm_location;
  if (farmer.location) return farmer.location;
  if (farmer.city && farmer.state) return `${farmer.city}, ${farmer.state}`;
  if (farmer.state) return farmer.state;
  return "Local Farm";
}

function getFarmerLogo(farmer: Farmer) {
  return clean(
    farmer.logoUrl ||
      farmer.farmLogoUrl ||
      farmer.logo_url ||
      farmer.farm_logo_url ||
      ""
  );
}

function getProductImage(product: Product) {
  return clean(product.image || product.imageUrl || product.image_url || "");
}

function getProductStock(product: Product) {
  const stock = Number(product.stock ?? product.quantity ?? product.inventory ?? 0);
  return Number.isFinite(stock) ? stock : 0;
}

function isProductAvailable(product: Product) {
  if (!clean(product.name)) return false;
  if (product.available === false) return false;
  if (product.active === false) return false;
  if (product.marketplace_visible === false) return false;
  if (product.removed_from_inventory === true) return false;
  return getProductStock(product) > 0;
}

function getFarmerStripeAccountId(farmer: Farmer, product?: Product) {
  return clean(
    product?.farmerStripeAccountId ||
      product?.stripeAccountId ||
      product?.farmer_stripe_account_id ||
      product?.stripe_account_id ||
      farmer.farmerStripeAccountId ||
      farmer.stripeAccountId ||
      farmer.farmer_stripe_account_id ||
      farmer.stripe_account_id ||
      ""
  );
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

function formatPrice(value: any) {
  const amount = Number(value || 0);
  return `$${amount.toFixed(2)}`;
}

function normalizeProduct(product: any, farmer: Farmer): Product {
  const farmerId = normalizeId(product.farmerId || product.farmer_id || farmer.id || farmer.farmerId);
  const farmName = getFarmerName(farmer);
  const image = clean(product.image_url || product.imageUrl || product.image || "");

  return {
    ...product,
    id: clean(product.id || `${farmerId}_${product.name || product.product_name || "product"}`),
    name: clean(product.name || product.product_name || "Farm Product"),
    category: normalizeCategory(product.category || product.product_category),
    price: Number(product.price || product.unit_price || product.amount || 0),
    unit: clean(product.unit || product.sell_by || "each"),
    description: clean(product.description || ""),
    image,
    imageUrl: image,
    image_url: image,
    farmerId,
    farmer_id: farmerId,
    farmName: clean(product.farmName || product.farm_name || farmName),
    farm_name: clean(product.farmName || product.farm_name || farmName),
    farmerEmail: clean(product.farmerEmail || product.farmer_email || ""),
    farmer_email: clean(product.farmerEmail || product.farmer_email || ""),
    farmerStripeAccountId:
      product.farmerStripeAccountId ||
      product.stripeAccountId ||
      product.farmer_stripe_account_id ||
      product.stripe_account_id ||
      getFarmerStripeAccountId(farmer),
    farmer_stripe_account_id:
      product.farmer_stripe_account_id ||
      product.stripe_account_id ||
      getFarmerStripeAccountId(farmer),
    stripeAccountId: product.stripeAccountId || product.stripe_account_id || "",
    stripe_account_id: product.stripe_account_id || "",
    stock: getProductStock(product),
    quantity: getProductStock(product),
    inventory: getProductStock(product),
    available: product.available !== false,
    active: product.active !== false,
    marketplace_visible: product.marketplace_visible !== false,
    removed_from_inventory: product.removed_from_inventory === true,
    organic: Boolean(product.organic),
    local: Boolean(product.local),
    seasonal: Boolean(product.seasonal),
    featured: Boolean(product.featured),
    tags: Array.isArray(product.tags) ? product.tags : [],
  };
}

function normalizeFarmers(inputFarmers: Farmer[]): Farmer[] {
  return inputFarmers.map((farmer) => {
    const stripeAccountId = clean(
      farmer.stripeAccountId ||
        farmer.farmerStripeAccountId ||
        farmer.stripe_account_id ||
        farmer.farmer_stripe_account_id ||
        ""
    );

    const farmName = getFarmerName(farmer);
    const id = normalizeId(farmer.id || farmer.farmerId);

    return {
      ...farmer,
      id,
      farmerId: id,
      farmName,
      name: farmName,
      location: getFarmerLocation(farmer),
      logoUrl: getFarmerLogo(farmer),
      stripeAccountId,
      farmerStripeAccountId: stripeAccountId,
      products: (farmer.products || [])
        .map((product) => normalizeProduct(product, { ...farmer, id, farmerId: id }))
        .filter(isProductAvailable),
    };
  });
}

function mapProductRow(row: any): Product {
  const farmerId = clean(row.farmer_id || row.farmerId || row.owner_id || "");
  const image = clean(row.image_url || row.image || row.imageUrl || row.photo_url || "");

  return {
    id: clean(row.id || `product_${Date.now()}_${Math.random()}`),
    name: clean(row.name || row.product_name || row.title || "Farm Product"),
    description: clean(row.description || ""),
    category: normalizeCategory(row.category || row.product_category),
    price: Number(row.price || row.unit_price || row.amount || 0),
    unit: clean(row.unit || row.sell_by || row.unit_type || "each"),
    image,
    imageUrl: image,
    image_url: image,
    farmerId,
    farmer_id: farmerId,
    farmName: clean(row.farm_name || row.farmName || row.business_name || "Local Farm"),
    farm_name: clean(row.farm_name || row.farmName || row.business_name || "Local Farm"),
    farmerEmail: clean(row.farmer_email || row.email || ""),
    farmer_email: clean(row.farmer_email || row.email || ""),
    farmerStripeAccountId: clean(row.farmer_stripe_account_id || row.stripe_account_id || ""),
    farmer_stripe_account_id: clean(row.farmer_stripe_account_id || row.stripe_account_id || ""),
    stripeAccountId: clean(row.stripe_account_id || ""),
    stripe_account_id: clean(row.stripe_account_id || ""),
    stock: Number(row.stock ?? row.quantity ?? row.inventory ?? row.stock_qty ?? row.inventory_quantity ?? 0),
    quantity: Number(row.quantity ?? row.stock ?? row.inventory ?? row.stock_qty ?? row.inventory_quantity ?? 0),
    inventory: Number(row.inventory ?? row.stock ?? row.quantity ?? row.stock_qty ?? row.inventory_quantity ?? 0),
    available: row.available !== false,
    active: row.active !== false,
    marketplace_visible: row.marketplace_visible !== false,
    removed_from_inventory: row.removed_from_inventory === true,
    organic: Boolean(row.organic),
    local: Boolean(row.local ?? true),
    seasonal: Boolean(row.seasonal),
    featured: Boolean(row.featured),
    tags: Array.isArray(row.tags) ? row.tags : [],
  };
}

function mapFarmerRow(row: any, fallbackId = ""): Farmer {
  const id = clean(row?.id || row?.farmer_id || row?.farmerId || fallbackId);
  const farmName = clean(
    row?.farm_name ||
      row?.business_name ||
      row?.farmName ||
      row?.businessName ||
      row?.name ||
      "Local Farm"
  );

  const logo = clean(
    row?.logo_url ||
      row?.farm_logo_url ||
      row?.logoUrl ||
      row?.farmLogoUrl ||
      ""
  );

  return {
    id,
    farmerId: id,
    farmName,
    name: farmName,
    businessName: clean(row?.business_name || farmName),
    business_name: clean(row?.business_name || farmName),
    location:
      row?.city && row?.state
        ? `${row.city}, ${row.state}`
        : clean(row?.location || row?.farm_location || row?.state || "Local Farm Market"),
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
  };
}

async function queryProductTable(tableName: string): Promise<Product[]> {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !Array.isArray(data)) return [];
    return data.map(mapProductRow).filter((p) => p.farmerId && isProductAvailable(p));
  } catch {
    return [];
  }
}

async function loadProductsFromSupabase(): Promise<Farmer[]> {
  const productTables = [
    "products",
    "farmer_products",
    "farm_products",
    "farm_inventory",
    "inventory",
  ];

  let products: Product[] = [];

  for (const tableName of productTables) {
    const rows = await queryProductTable(tableName);
    products.push(...rows);
  }

  products = Array.from(
    new Map(products.map((product) => [`${product.farmerId}_${product.id}`, product])).values()
  );

  const farmerIds = Array.from(
    new Set(products.map((product) => clean(product.farmerId || product.farmer_id)).filter(Boolean))
  );

  let farmerRows: any[] = [];

  if (farmerIds.length > 0) {
    try {
      const { data } = await supabase.from("farmers").select("*").in("id", farmerIds);
      if (Array.isArray(data)) farmerRows = data;
    } catch {
      farmerRows = [];
    }
  }

  const farmerInfoMap = new Map<string, any>();
  farmerRows.forEach((farmer) => farmerInfoMap.set(clean(farmer.id), farmer));

  const grouped = new Map<string, Farmer>();

  products.forEach((product) => {
    const farmerId = clean(product.farmerId || product.farmer_id);
    const farmerInfo = farmerInfoMap.get(farmerId);

    const farmerBase = farmerInfo
      ? mapFarmerRow(farmerInfo, farmerId)
      : ({
          id: farmerId,
          farmerId,
          farmName: product.farmName || product.farm_name || "Local Farm",
          name: product.farmName || product.farm_name || "Local Farm",
          location: "Local Farm Market",
          rating: 4.8,
          distanceMiles: 5,
          stripeAccountId: product.farmerStripeAccountId || product.stripeAccountId || "",
          farmerStripeAccountId: product.farmerStripeAccountId || product.stripeAccountId || "",
          products: [],
        } as Farmer);

    if (!grouped.has(farmerId)) {
      grouped.set(farmerId, {
        ...farmerBase,
        products: [],
      });
    }

    const current = grouped.get(farmerId);

    current?.products?.push({
      ...product,
      farmName: getFarmerName(current || farmerBase),
      farm_name: getFarmerName(current || farmerBase),
      farmerStripeAccountId:
        product.farmerStripeAccountId ||
        product.farmer_stripe_account_id ||
        getFarmerStripeAccountId(current || farmerBase),
    });
  });

  return Array.from(grouped.values());
}

export default function MarketplaceScreen() {
  const [customer, setCustomer] = useState<CustomerSession | null>(null);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(false);
  const [accessChecking, setAccessChecking] = useState(true);
  const [accessAllowed, setAccessAllowed] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [cartCount, setCartCount] = useState(0);

  const refreshCartCount = useCallback(async () => {
    try {
      setCartCount(await getCartItemCount());
    } catch {
      setCartCount(0);
    }
  }, []);

  async function loadCustomerSession() {
    const saved =
      (await AsyncStorage.getItem("currentCustomer")) ||
      (await AsyncStorage.getItem("farm2homeCurrentCustomer")) ||
      (await AsyncStorage.getItem("pendingCustomer")) ||
      (await AsyncStorage.getItem("currentUser"));

    let localCustomer: CustomerSession | null = null;

    if (saved) {
      try {
        localCustomer = JSON.parse(saved);
      } catch {
        localCustomer = null;
      }
    }

    const { data: authData } = await supabase.auth.getUser();
    const authId = clean(authData?.user?.id || "");
    const authEmail = normalize(authData?.user?.email || localCustomer?.email || "");

    if (authId || authEmail) {
      const dbCustomer = await fetchCustomer(authId, authEmail);
      if (dbCustomer) {
        const sub = await fetchCustomerSubscription(dbCustomer.id, dbCustomer.email);
        const merged = {
          ...dbCustomer,
          stripe_customer_id: dbCustomer.stripe_customer_id || dbCustomer.stripe_id || sub?.stripe_customer_id,
          stripe_subscription_id: dbCustomer.stripe_subscription_id || dbCustomer.subscription_id || sub?.stripe_subscription_id,
          subscription_id: dbCustomer.subscription_id || dbCustomer.stripe_subscription_id || sub?.stripe_subscription_id,
          subscription_status: dbCustomer.subscription_status || sub?.subscription_status,
        };

        const session = {
          ...merged,
          customerId: merged.id,
          accountId: merged.account_id,
          stripeCustomerId: merged.stripe_customer_id,
          subscriptionId: merged.subscription_id || merged.stripe_subscription_id,
        };

        setCustomer(session);
        await AsyncStorage.multiSet([
          ["currentCustomer", JSON.stringify(session)],
          ["farm2homeCurrentCustomer", JSON.stringify(session)],
          ["currentUser", JSON.stringify({ ...session, role: "customer" })],
        ]);
        return session;
      }
    }

    setCustomer(localCustomer);
    return localCustomer;
  }

  async function fetchCustomer(id?: string, email?: string) {
    const lookupId = clean(id);
    const lookupEmail = normalize(email);

    if (lookupId) {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .or(`id.eq.${lookupId},auth_user_id.eq.${lookupId},profile_id.eq.${lookupId},customer_id.eq.${lookupId}`)
        .limit(1);

      if (!error && Array.isArray(data) && data[0]) return data[0];
    }

    if (lookupEmail) {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("email", lookupEmail)
        .limit(1);

      if (!error && Array.isArray(data) && data[0]) return data[0];
    }

    return null;
  }

  async function fetchCustomerSubscription(id?: string, email?: string) {
    const lookupId = clean(id);
    const lookupEmail = normalize(email);

    const filters = [
      lookupId ? `customer_id.eq.${lookupId}` : "",
      lookupEmail ? `customer_email.eq.${lookupEmail}` : "",
    ]
      .filter(Boolean)
      .join(",");

    if (!filters) return null;

    try {
      const { data, error } = await supabase
        .from("customer_subscriptions")
        .select("*")
        .or(filters)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (!error && Array.isArray(data) && data[0]) return data[0];
    } catch {
      return null;
    }

    return null;
  }

  const verifyAccess = useCallback(async () => {
    try {
      setAccessChecking(true);
      const activeCustomer = await loadCustomerSession();

      if (!customerReady(activeCustomer)) {
        setAccessAllowed(false);
        Alert.alert(
          "Membership Required",
          "Complete customer membership before shopping the marketplace.",
          [
            {
              text: "Go to Registration",
              onPress: () =>
                router.replace({
                  pathname: "/customer/register" as any,
                  params: {
                    customerId: getCustomerId(activeCustomer),
                    email: activeCustomer?.email || "",
                  },
                }),
            },
          ]
        );
        return;
      }

      setAccessAllowed(true);
    } catch (error) {
      console.log("Marketplace access check error:", error);
      setAccessAllowed(false);
    } finally {
      setAccessChecking(false);
    }
  }, []);

  const loadMarketplace = useCallback(async () => {
    try {
      setLoading(true);

      const approvedFarmers = (await getApprovedFarmers()) || [];
      const supabaseFarmers = await loadProductsFromSupabase();

      const localFarmerRaw =
        (await AsyncStorage.getItem("currentFarmer")) ||
        (await AsyncStorage.getItem("currentUser"));

      const currentFarmer = localFarmerRaw ? JSON.parse(localFarmerRaw) : null;

      const localCurrentFarmer =
        currentFarmer?.role === "farmer" &&
        Array.isArray(currentFarmer.products) &&
        currentFarmer.products.length > 0
          ? [
              {
                ...currentFarmer,
                id: currentFarmer.id || currentFarmer.farmerId || "",
                farmerId: currentFarmer.id || currentFarmer.farmerId || "",
                farmName:
                  currentFarmer.farmName ||
                  currentFarmer.businessName ||
                  currentFarmer.business_name ||
                  currentFarmer.farm_name ||
                  "Local Farm",
                products: currentFarmer.products,
              },
            ]
          : [];

      const mergedFarmers: Farmer[] = [
        ...supabaseFarmers,
        ...localCurrentFarmer,
        ...(Array.isArray(approvedFarmers) ? approvedFarmers : []),
      ];

      const normalizedFarmers = normalizeFarmers(mergedFarmers).filter(
        (farmer) => farmer.id && farmer.products && farmer.products.length > 0
      );

      const farmerMap = new Map<string, Farmer>();

      normalizedFarmers.forEach((farmer) => {
        const farmerId = normalizeId(farmer.id || farmer.farmerId);
        if (!farmerId) return;

        if (!farmerMap.has(farmerId)) {
          farmerMap.set(farmerId, farmer);
          return;
        }

        const existing = farmerMap.get(farmerId);
        const productMap = new Map<string, Product>();

        [...(existing?.products || []), ...(farmer.products || [])].forEach((product) => {
          productMap.set(clean(product.id), product);
        });

        farmerMap.set(farmerId, {
          ...(existing || farmer),
          ...farmer,
          id: farmerId,
          farmerId,
          farmName: getFarmerName(existing || farmer),
          logoUrl: getFarmerLogo(farmer) || getFarmerLogo(existing || farmer),
          products: Array.from(productMap.values()).filter(isProductAvailable),
        });
      });

      const nextFarmers = Array.from(farmerMap.values()).sort(
        (a, b) => (b.products?.length || 0) - (a.products?.length || 0)
      );

      setFarmers(nextFarmers);
    } catch (error) {
      console.log("Marketplace load error:", error);
      setFarmers([]);
      Alert.alert("Marketplace Error", "Unable to load active farm rows.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    verifyAccess();
  }, [verifyAccess]);

  useEffect(() => {
    if (accessAllowed) {
      loadMarketplace();
      refreshCartCount();
    }
  }, [accessAllowed, loadMarketplace, refreshCartCount]);

  const categories = useMemo(() => {
    const categorySet = new Set<string>();

    farmers.forEach((farmer) => {
      (farmer.products || []).forEach((product) => {
        if (product.category) categorySet.add(normalizeCategory(product.category));
      });
    });

    return Array.from(new Set([...DEFAULT_CATEGORIES, ...Array.from(categorySet)]));
  }, [farmers]);

  const allProductCount = useMemo(() => {
    return farmers.reduce((sum, farmer) => sum + (farmer.products || []).length, 0);
  }, [farmers]);

  const featuredProducts = useMemo(() => {
    const allProducts: Array<{ farmer: Farmer; product: Product }> = [];

    farmers.forEach((farmer) => {
      (farmer.products || []).forEach((product) => {
        allProducts.push({ farmer, product });
      });
    });

    const featured = allProducts.filter(
      ({ product }) =>
        product.featured ||
        product.seasonal ||
        product.organic ||
        String(product.tags || "").includes("featured")
    );

    return (featured.length > 0 ? featured : allProducts).slice(0, 8);
  }, [farmers]);

  const filteredFarmers = useMemo(() => {
    const search = normalize(searchText);

    return farmers
      .map((farmer) => {
        const filteredProducts = (farmer.products || []).filter((product) => {
          const category = normalizeCategory(product.category);

          const matchesCategory = selectedCategory === "All" || category === selectedCategory;

          const matchesSearch =
            !search ||
            normalize(product.name).includes(search) ||
            normalize(category).includes(search) ||
            normalize(product.unit).includes(search) ||
            normalize(product.description).includes(search) ||
            normalize(getFarmerName(farmer)).includes(search) ||
            normalize(getFarmerLocation(farmer)).includes(search);

          return matchesCategory && matchesSearch && isProductAvailable(product);
        });

        return { ...farmer, products: filteredProducts };
      })
      .filter((farmer) => farmer.products && farmer.products.length > 0);
  }, [farmers, selectedCategory, searchText]);

  async function handleAddToCart(farmer: Farmer, product: Product) {
    try {
      if (!accessAllowed || !customerReady(customer)) {
        Alert.alert("Membership Required", "Complete customer membership before adding items.");
        return;
      }

      const farmerStripeAccountId = getFarmerStripeAccountId(farmer, product);

      await addToCart({
        id: `${farmer.id}_${product.id}`,
        cartItemId: `${farmer.id}_${product.id}`,
        productId: product.id,
        product_id: product.id,
        name: product.name,
        productName: product.name,
        product_name: product.name,
        price: Number(product.price || 0),
        quantity: 1,
        image: getProductImage(product),
        imageUrl: getProductImage(product),
        image_url: getProductImage(product),
        farmName: getFarmerName(farmer),
        farm_name: getFarmerName(farmer),
        farmerName: getFarmerName(farmer),
        farmerId: farmer.id,
        farmer_id: farmer.id,
        farmerEmail: product.farmerEmail || product.farmer_email || "",
        farmerStripeAccountId,
        stripeAccountId: farmerStripeAccountId,
        farmer_stripe_account_id: farmerStripeAccountId,
        stripe_account_id: farmerStripeAccountId,
        unit: product.unit || "each",
        category: normalizeCategory(product.category),
        stock: getProductStock(product),
        addedAt: new Date().toISOString(),
      } as any);

      await refreshCartCount();

      Alert.alert(
        "Added to Cart",
        `${product.name} added to cart for ${formatPrice(product.price)}${product.unit ? ` / ${product.unit}` : ""}.`,
        [
          { text: "Keep Shopping", style: "cancel" },
          { text: "View Cart", onPress: () => router.push("/customer/cart" as any) },
        ]
      );
    } catch (error: any) {
      console.log("Add cart error:", error);
      Alert.alert("Cart Error", error?.message || "Unable to add item to cart.");
    }
  }

  function openFarmerShop(farmer: Farmer) {
    const id = normalizeId(farmer.id || farmer.farmerId);

    router.push({
      pathname: "/customer/farmer-shop" as any,
      params: {
        farmerId: id,
        id,
        farmName: getFarmerName(farmer),
      },
    });
  }

  function openCart() {
    router.push("/customer/cart" as any);
  }

  function renderProductCard(farmer: Farmer, product: Product, compact = false) {
    const imageSource = getProductImage(product);
    const stock = getProductStock(product);
    const category = normalizeCategory(product.category);

    return (
      <View
        key={`${farmer.id}_${product.id}_${compact ? "compact" : "regular"}`}
        style={[styles.productCard, compact && styles.featuredProductCard]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.productImageWrap,
            pressed && styles.pressedButton,
          ]}
          onPress={() => handleAddToCart(farmer, product)}
        >
          {imageSource ? (
            <Image source={{ uri: imageSource }} style={styles.productImage} />
          ) : (
            <View style={styles.productPlaceholder}>
              <Text style={styles.productInitial}>{clean(product.name).slice(0, 1)}</Text>
            </View>
          )}

          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText} numberOfLines={1}>
              {category}
            </Text>
          </View>

          {product.featured || product.seasonal ? (
            <View style={styles.featuredBadge}>
              <Text style={styles.featuredBadgeText}>
                {product.featured ? "Featured" : "Seasonal"}
              </Text>
            </View>
          ) : null}
        </Pressable>

        <Text style={styles.productName} numberOfLines={1}>
          {product.name}
        </Text>

        <Text style={styles.productFarmName} numberOfLines={1}>
          {getFarmerName(farmer)}
        </Text>

        <View style={styles.tagLine}>
          {product.organic ? <Text style={styles.miniTag}>Organic</Text> : null}
          {product.local ? <Text style={styles.miniTag}>Local</Text> : null}
          {product.seasonal ? <Text style={styles.miniTag}>Seasonal</Text> : null}
        </View>

        <View style={styles.priceRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.productPrice}>{formatPrice(product.price)}</Text>
            <Text style={styles.productUnit}>
              {product.unit ? `per ${product.unit}` : "each"} · {stock} left
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.pressedButton,
            ]}
            onPress={() => handleAddToCart(farmer, product)}
          >
            <Ionicons name="add-outline" size={16} color={COLORS.white} />
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  function renderFarmerRow({ item }: { item: Farmer }) {
    const logo = getFarmerLogo(item);
    const products = item.products || [];

    return (
      <View style={styles.farmSection}>
        <View style={styles.farmHeader}>
          <Pressable
            style={({ pressed }) => [styles.farmHeaderLeft, pressed && styles.pressedButton]}
            onPress={() => openFarmerShop(item)}
          >
            {logo ? (
              <Image source={{ uri: logo }} style={styles.farmLogo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderText}>
                  {getFarmerName(item).slice(0, 1)}
                </Text>
              </View>
            )}

            <View style={{ flex: 1 }}>
              <Text style={styles.farmName} numberOfLines={1}>
                {getFarmerName(item)}
              </Text>

              <Text style={styles.farmLocation} numberOfLines={1}>
                {getFarmerLocation(item)}
              </Text>

              <View style={styles.farmMetaRow}>
                <Text style={styles.farmMeta}>⭐ {Number(item.rating || 4.8).toFixed(1)}</Text>
                <Text style={styles.farmMeta}>•</Text>
                <Text style={styles.farmMeta}>{products.length} items</Text>
              </View>
            </View>
          </Pressable>

          <TouchableOpacity
            style={styles.viewStoreButton}
            onPress={() => openFarmerShop(item)}
            activeOpacity={0.85}
          >
            <Text style={styles.viewStoreText}>Store</Text>
            <Ionicons name="chevron-forward-outline" size={15} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.productsRow}
        >
          {products.map((product) => renderProductCard(item, product))}
        </ScrollView>
      </View>
    );
  }

  function renderHeader() {
    return (
      <View>
        <View style={styles.topBar}>
          <View style={styles.brandIcon}>
            <Ionicons name="storefront-outline" size={24} color={COLORS.white} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Hello, {getCustomerName(customer)}</Text>
            <Text style={styles.locationLine}>
              {allProductCount} local farm goods from {farmers.length} farms
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.cartTopButton, pressed && styles.pressedButton]}
            onPress={openCart}
          >
            <Ionicons name="cart-outline" size={21} color={COLORS.primary} />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        <View style={styles.heroWrap}>
          <View style={styles.heroContent}>
            <Text style={styles.heroBadge}>Fresh Marketplace</Text>
            <Text style={styles.heroTitle}>Groceries directly from local farmers</Text>
            <Text style={styles.heroSubtitle}>
              Browse each farm row like a grocery aisle. Add produce, eggs, honey, meat, hay, flowers, and seasonal goods.
            </Text>

            <View style={styles.heroButtons}>
              <Pressable
                style={({ pressed }) => [styles.heroButton, pressed && styles.pressedButton]}
                onPress={openCart}
              >
                <Ionicons name="cart-outline" size={16} color={COLORS.white} />
                <Text style={styles.heroButtonText}>Cart ({cartCount})</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.heroButtonLight, pressed && styles.pressedButton]}
                onPress={() => router.push("/customer/my-orders" as any)}
              >
                <Ionicons name="receipt-outline" size={16} color={COLORS.primary} />
                <Text style={styles.heroButtonLightText}>Orders</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.quickStatsRow}>
          <View style={styles.quickStat}>
            <View style={styles.quickStatIcon}>
              <Ionicons name="business-outline" size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.quickStatValue}>{farmers.length}</Text>
            <Text style={styles.quickStatLabel}>Farms</Text>
          </View>

          <View style={styles.quickStat}>
            <View style={styles.quickStatIcon}>
              <Ionicons name="leaf-outline" size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.quickStatValue}>{allProductCount}</Text>
            <Text style={styles.quickStatLabel}>Products</Text>
          </View>

          <View style={styles.quickStat}>
            <View style={styles.quickStatIcon}>
              <Ionicons name="grid-outline" size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.quickStatValue}>{Math.max(categories.length - 1, 0)}</Text>
            <Text style={styles.quickStatLabel}>Categories</Text>
          </View>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={19} color={COLORS.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search farms, products, categories..."
            placeholderTextColor="#94A3B8"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText ? (
            <Pressable onPress={() => setSearchText("")}>
              <Ionicons name="close-circle-outline" size={19} color={COLORS.muted} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {categories.map((category) => {
            const active = category === selectedCategory;

            return (
              <Pressable
                key={category}
                style={[styles.categoryChip, active && styles.categoryChipActive]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    active && styles.categoryChipTextActive,
                  ]}
                >
                  {category}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {featuredProducts.length > 0 && selectedCategory === "All" && !searchText.trim() ? (
          <View style={styles.featuredSection}>
            <View style={styles.sectionTitleRow}>
              <View>
                <Text style={styles.sectionTitle}>Featured Fresh Picks</Text>
                <Text style={styles.sectionSubtitle}>
                  Popular items across nearby farms
                </Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredRow}
            >
              {featuredProducts.map(({ farmer, product }) =>
                renderProductCard(farmer, product, true)
              )}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.sectionTitleRowMain}>
          <View>
            <Text style={styles.sectionTitle}>Shop by Farm</Text>
            <Text style={styles.sectionSubtitle}>
              {filteredFarmers.length} farm row{filteredFarmers.length === 1 ? "" : "s"} available
            </Text>
          </View>

          {loading && <ActivityIndicator size="small" color={COLORS.primary} />}
        </View>
      </View>
    );
  }

  if (accessChecking) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
        <View style={styles.loadingPage}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Checking marketplace access...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!accessAllowed) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
        <View style={styles.loadingPage}>
          <Text style={styles.lockedTitle}>Membership Required</Text>
          <Text style={styles.loadingText}>Complete customer membership to shop local farms.</Text>

          <TouchableOpacity
            style={styles.lockedButton}
            onPress={() =>
              router.replace({
                pathname: "/customer/register" as any,
                params: {
                  customerId: getCustomerId(customer),
                  email: customer?.email || "",
                },
              })
            }
          >
            <Text style={styles.lockedButtonText}>Fix Membership</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <FlatList
        data={filteredFarmers}
        keyExtractor={(item) => clean(item.id || item.farmerId)}
        renderItem={renderFarmerRow}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadMarketplace} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <View style={styles.emptyIcon}>
              <Ionicons name="cube-outline" size={34} color={COLORS.primary} />
            </View>

            <Text style={styles.emptyTitle}>
              {loading ? "Loading marketplace..." : "No farm rows found"}
            </Text>
            <Text style={styles.emptySubtitle}>
              Active farms with available marketplace products will appear here by farmer row.
            </Text>

            <TouchableOpacity style={styles.emptyButton} onPress={loadMarketplace}>
              <Text style={styles.emptyButtonText}>Refresh Marketplace</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <Pressable
        style={({ pressed }) => [styles.cartFloating, pressed && styles.pressedButton]}
        onPress={openCart}
      >
        <Ionicons name="cart-outline" size={18} color={COLORS.white} />
        <Text style={styles.cartFloatingText}>Cart ({cartCount})</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadingPage: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 14,
    color: COLORS.muted,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 21,
  },
  lockedTitle: {
    color: COLORS.primary,
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
  },
  lockedButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 16,
    marginTop: 18,
  },
  lockedButtonText: {
    color: COLORS.white,
    fontWeight: "900",
  },
  listContent: { paddingBottom: 120 },
  topBar: {
    backgroundColor: COLORS.navy,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
  },
  brandIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  greeting: { color: COLORS.white, fontSize: 22, fontWeight: "900" },
  locationLine: {
    color: "#A5B4FC",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },
  cartTopButton: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: COLORS.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  cartBadge: {
    position: "absolute",
    top: -7,
    right: -7,
    backgroundColor: COLORS.warning,
    minWidth: 23,
    height: 23,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: COLORS.navy,
  },
  cartBadgeText: { color: COLORS.navy, fontWeight: "900", fontSize: 12 },
  heroWrap: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 18,
    paddingBottom: 20,
  },
  heroContent: {
    backgroundColor: COLORS.primary,
    borderRadius: 26,
    padding: 20,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    color: COLORS.white,
    fontWeight: "900",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10,
    overflow: "hidden",
    fontSize: 12,
  },
  heroTitle: {
    color: COLORS.white,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
  },
  heroSubtitle: {
    color: "#E0E7FF",
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
  },
  heroButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  heroButton: {
    backgroundColor: COLORS.navy,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroButtonText: { color: COLORS.white, fontWeight: "900", fontSize: 13 },
  heroButtonLight: {
    backgroundColor: COLORS.white,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroButtonLightText: { color: COLORS.primary, fontWeight: "900", fontSize: 13 },
  quickStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 18,
    marginTop: 16,
  },
  quickStat: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickStatIcon: {
    width: 34,
    height: 34,
    borderRadius: 13,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickStatValue: { color: COLORS.primary, fontWeight: "900", fontSize: 22 },
  quickStatLabel: {
    color: COLORS.muted,
    fontWeight: "800",
    marginTop: 2,
    fontSize: 12,
  },
  searchBox: {
    marginHorizontal: 18,
    marginTop: 16,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 54,
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
    height: "100%",
  },
  categoryRow: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 8,
  },
  categoryChip: {
    backgroundColor: COLORS.card,
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
  categoryChipTextActive: { color: COLORS.white },
  featuredSection: { marginTop: 8 },
  sectionTitleRow: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
  },
  sectionTitleRowMain: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  sectionTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900" },
  sectionSubtitle: {
    color: COLORS.muted,
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
  },
  featuredRow: { paddingLeft: 18, paddingRight: 18, gap: 12 },
  farmSection: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  farmHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 13,
  },
  farmHeaderLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  farmLogo: {
    width: 56,
    height: 56,
    borderRadius: 19,
    backgroundColor: COLORS.accentSoft,
  },
  logoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 19,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  logoPlaceholderText: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: "900",
  },
  farmName: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "900",
  },
  farmLocation: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3,
  },
  farmMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 5,
  },
  farmMeta: {
    color: COLORS.primaryDark,
    fontSize: 12,
    fontWeight: "900",
  },
  viewStoreButton: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  viewStoreText: {
    color: COLORS.primary,
    fontWeight: "900",
    fontSize: 12,
  },
  productsRow: { gap: 12, paddingRight: 6 },
  productCard: {
    width: 178,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  featuredProductCard: { width: 174, backgroundColor: COLORS.card },
  productImageWrap: { position: "relative" },
  productImage: {
    width: "100%",
    height: 116,
    borderRadius: 15,
    marginBottom: 10,
    backgroundColor: COLORS.accentSoft,
  },
  productPlaceholder: {
    width: "100%",
    height: 116,
    borderRadius: 15,
    backgroundColor: COLORS.accentSoft,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  productInitial: {
    color: COLORS.accentDark,
    fontSize: 34,
    fontWeight: "900",
  },
  categoryBadge: {
    position: "absolute",
    left: 8,
    bottom: 18,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    maxWidth: 130,
  },
  categoryBadgeText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: "900",
  },
  featuredBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: COLORS.warning,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  featuredBadgeText: { color: COLORS.navy, fontSize: 10, fontWeight: "900" },
  productName: { fontWeight: "900", fontSize: 15, color: COLORS.text },
  productFarmName: {
    color: COLORS.muted,
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
  },
  tagLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 8,
    minHeight: 20,
  },
  miniTag: {
    backgroundColor: COLORS.accentSoft,
    color: COLORS.accentDark,
    fontSize: 10,
    fontWeight: "900",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
  },
  priceRow: {
    marginTop: 10,
    gap: 8,
  },
  productPrice: { fontWeight: "900", fontSize: 18, color: COLORS.primary },
  productUnit: {
    color: COLORS.muted,
    marginTop: 2,
    fontSize: 11,
    fontWeight: "700",
  },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
  },
  addButtonText: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 12,
  },
  pressedButton: { opacity: 0.75 },
  emptyBox: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginTop: 10,
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontWeight: "900",
    fontSize: 20,
    color: COLORS.text,
    textAlign: "center",
  },
  emptySubtitle: {
    marginTop: 10,
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 21,
  },
  emptyButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 16,
  },
  emptyButtonText: {
    color: COLORS.white,
    fontWeight: "900",
  },
  cartFloating: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: COLORS.navy,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: COLORS.navy,
    shadowOpacity: Platform.OS === "ios" ? 0.25 : 0,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 6,
  },
  cartFloatingText: { color: COLORS.white, fontWeight: "900", fontSize: 14 },
});
