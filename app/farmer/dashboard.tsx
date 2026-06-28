// app/farmer/dashboard.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const COLORS = {
  bg: "#F6F8F2",
  card: "#FFFFFF",
  surface: "#F9FBF4",
  green: "#1FA463",
  greenDark: "#0B5D35",
  greenSoft: "#E9F8EF",
  lime: "#DDF8C8",
  orange: "#FFB74A",
  orangeSoft: "#FFF3DE",
  red: "#EF4444",
  redSoft: "#FEE2E2",
  text: "#162115",
  muted: "#667085",
  border: "#E3E8DD",
  white: "#FFFFFF",
  black: "#111827",
};

type FarmerSession = {
  id?: string;
  farmer_id?: string;
  farmerId?: string;
  auth_user_id?: string;
  profile_id?: string;
  role?: string;
  email?: string;
  phone?: string;
  owner_name?: string;
  ownerName?: string;
  full_name?: string;
  name?: string;
  farm_name?: string;
  farmName?: string;
  business_name?: string;
  businessName?: string;
  logo_url?: string;
  farm_logo_url?: string;
  logoUrl?: string;
  farmLogoUrl?: string;
  account_active?: boolean;
  stripe_account_id?: string;
  farmer_stripe_account_id?: string;
  farmer_account?: string;
  stripeAccountId?: string;
  farmerStripeAccountId?: string;
  stripe_payouts_enabled?: boolean;
  stripePayoutsEnabled?: boolean;
  stripe_charges_enabled?: boolean;
  stripeChargesEnabled?: boolean;
  stripe_onboarding_complete?: boolean;
  stripeOnboardingComplete?: boolean;
  membership_status?: string;
  subscription_status?: string;
};

type FarmProduct = {
  id: string;
  name: string;
  price?: number;
  quantity?: number;
  status?: string;
  image_url?: string;
};

type OrderRow = {
  id: string;
  status?: string;
  total?: number;
  created_at?: string;
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function money(value: any) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function getFarmerId(farmer?: FarmerSession | null) {
  return clean(
    farmer?.farmer_id ||
      farmer?.farmerId ||
      farmer?.id ||
      farmer?.profile_id ||
      farmer?.auth_user_id
  );
}

function getFarmName(farmer?: FarmerSession | null) {
  return (
    clean(farmer?.farm_name || farmer?.farmName) ||
    clean(farmer?.business_name || farmer?.businessName) ||
    clean(farmer?.owner_name || farmer?.ownerName) ||
    clean(farmer?.full_name || farmer?.name) ||
    "Farm2Home Farm"
  );
}

function getLogo(farmer?: FarmerSession | null) {
  return clean(
    farmer?.logo_url ||
      farmer?.farm_logo_url ||
      farmer?.logoUrl ||
      farmer?.farmLogoUrl
  );
}

function getStripeAccount(farmer?: FarmerSession | null) {
  return clean(
    farmer?.farmer_account ||
      farmer?.stripe_account_id ||
      farmer?.farmer_stripe_account_id ||
      farmer?.stripeAccountId ||
      farmer?.farmerStripeAccountId
  );
}

function isReadyStatus(value: any) {
  const status = normalize(value || "active");
  return ![
    "canceled",
    "cancelled",
    "inactive",
    "disabled",
    "rejected",
    "unpaid",
  ].includes(status);
}

function rowMatchesFarmer(row: any, farmerId: string, farmerEmail: string) {
  const idFields = [
    row?.farmer_id,
    row?.seller_id,
    row?.vendor_id,
    row?.store_id,
    row?.farm_id,
    row?.owner_id,
    row?.user_id,
    row?.profile_id,
    row?.auth_user_id,
  ].map(clean);

  const emailFields = [
    row?.farmer_email,
    row?.seller_email,
    row?.vendor_email,
    row?.email,
  ].map(normalize);

  const itemMatch =
    Array.isArray(row?.items) &&
    row.items.some((item: any) =>
      [
        item?.farmer_id,
        item?.farmerId,
        item?.seller_id,
        item?.vendor_id,
        item?.farm_id,
      ]
        .map(clean)
        .includes(farmerId)
    );

  const splitMatch =
    Array.isArray(row?.payout_splits) &&
    row.payout_splits.some((split: any) =>
      [
        split?.farmer_id,
        split?.farmerId,
        split?.seller_id,
        split?.vendor_id,
        split?.farm_id,
      ]
        .map(clean)
        .includes(farmerId)
    );

  return Boolean(
    (farmerId && idFields.includes(farmerId)) ||
      (farmerEmail && emailFields.includes(farmerEmail)) ||
      itemMatch ||
      splitMatch
  );
}

async function safeSelectRecent(table: string, limit = 100) {
  try {
    let result = await supabase
      .from(table)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!result.error) {
      return Array.isArray(result.data) ? result.data : [];
    }

    console.log(`${table} created_at order skipped:`, result.error.message);

    result = await supabase.from(table).select("*").limit(limit);

    if (!result.error) {
      return Array.isArray(result.data) ? result.data : [];
    }

    console.log(`${table} select skipped:`, result.error.message);
    return [];
  } catch (error: any) {
    console.log(`${table} select failed:`, error?.message || error);
    return [];
  }
}

export default function FarmerDashboardScreen() {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [farmer, setFarmer] = useState<FarmerSession | null>(null);
  const [products, setProducts] = useState<FarmProduct[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [preferredDrivers, setPreferredDrivers] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [])
  );

  const farmerId = getFarmerId(farmer);
  const farmName = getFarmName(farmer);
  const logoUrl = getLogo(farmer);
  const stripeAccount = getStripeAccount(farmer);

  const dashboardReady = useMemo(() => {
    return Boolean(
      farmerId &&
        clean(farmer?.email) &&
        isReadyStatus(
          farmer?.membership_status || farmer?.subscription_status || "active"
        ) &&
        farmer?.account_active !== false
    );
  }, [farmer, farmerId]);

  const payoutsReady = Boolean(
    stripeAccount &&
      (farmer?.stripe_payouts_enabled ||
        farmer?.stripePayoutsEnabled ||
        farmer?.stripe_onboarding_complete ||
        farmer?.stripeOnboardingComplete)
  );

  const stats = useMemo(() => {
    const activeProducts = products.filter(
      (p) => normalize(p.status || "active") !== "inactive"
    ).length;

    const pendingOrders = orders.filter((o) =>
      ["new", "pending", "paid", "processing", "open"].includes(
        normalize(o.status || "new")
      )
    ).length;

    const revenue = orders.reduce(
      (sum, order) => sum + Number(order.total || 0),
      0
    );

    return {
      products: activeProducts,
      orders: pendingOrders,
      drivers: preferredDrivers,
      revenue,
    };
  }, [products, orders, preferredDrivers]);

  async function readLocalFarmer() {
    const raw =
      (await AsyncStorage.getItem("currentFarmer")) ||
      (await AsyncStorage.getItem("farm2homeCurrentFarmer")) ||
      (await AsyncStorage.getItem("farm2homeFarmerSession")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function findSupabaseFarmer(local: any) {
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;

    const localId = clean(
      local?.farmer_id ||
        local?.farmerId ||
        local?.id ||
        local?.profile_id ||
        local?.auth_user_id ||
        authUser?.id
    );

    const localEmail = normalize(local?.email || authUser?.email);

    if (localId) {
      const rows = await safeSelectRecent("farmers", 500);
      const found = rows.find((row: any) =>
        [
          row?.id,
          row?.farmer_id,
          row?.profile_id,
          row?.auth_user_id,
        ]
          .map(clean)
          .includes(localId)
      );

      if (found) return found;
    }

    if (localEmail) {
      const rows = await safeSelectRecent("farmers", 500);
      const found = rows.find((row: any) => normalize(row?.email) === localEmail);
      if (found) return found;
    }

    return null;
  }

  async function saveFarmerSession(nextFarmer: FarmerSession) {
    const id = getFarmerId(nextFarmer);

    const normalized = {
      ...nextFarmer,
      id,
      farmer_id: id,
      farmerId: id,
      role: "farmer",
      email: normalize(nextFarmer.email),
    };

    await AsyncStorage.multiSet([
      ["currentFarmer", JSON.stringify(normalized)],
      ["farm2homeCurrentFarmer", JSON.stringify(normalized)],
      ["farm2homeFarmerSession", JSON.stringify(normalized)],
      ["currentUser", JSON.stringify(normalized)],
      ["userRole", "farmer"],
      ["currentUserRole", "farmer"],
    ]);

    setFarmer(normalized);
    return normalized;
  }

  async function loadDashboard() {
    try {
      setLoading(true);

      const local = await readLocalFarmer();
      const dbFarmer = await findSupabaseFarmer(local);

      const merged = {
        ...(local || {}),
        ...(dbFarmer || {}),
        id: clean(
          dbFarmer?.id ||
            local?.id ||
            local?.farmer_id ||
            local?.farmerId ||
            local?.profile_id
        ),
        farmer_id: clean(
          dbFarmer?.farmer_id ||
            dbFarmer?.id ||
            local?.farmer_id ||
            local?.id ||
            local?.farmerId ||
            local?.profile_id
        ),
        farmerId: clean(
          dbFarmer?.farmer_id ||
            dbFarmer?.id ||
            local?.farmer_id ||
            local?.id ||
            local?.farmerId ||
            local?.profile_id
        ),
        role: "farmer",
      };

      if (!getFarmerId(merged)) {
        Alert.alert("Farmer Login Required", "Please login as a farmer.");
        router.replace("/farmer/login" as any);
        return;
      }

      const saved = await saveFarmerSession(merged);
      const activeFarmerId = getFarmerId(saved);
      const activeEmail = normalize(saved.email);

      await Promise.all([
        loadProducts(activeFarmerId, activeEmail),
        loadOrders(activeFarmerId, activeEmail),
        loadDrivers(activeFarmerId),
      ]);
    } catch (error: any) {
      console.log("Farmer dashboard load error:", error);
      Alert.alert(
        "Load Error",
        error?.message || "Unable to load farmer dashboard."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadProducts(activeFarmerId: string, activeEmail: string) {
    const tables = ["farm_products", "farmer_products", "products"];
    const loaded: FarmProduct[] = [];

    for (const table of tables) {
      const rows = await safeSelectRecent(table, 300);

      const filtered = rows.filter((row: any) =>
        rowMatchesFarmer(row, activeFarmerId, activeEmail)
      );

      if (filtered.length) {
        loaded.push(
          ...filtered.map((row: any) => ({
            id: clean(row.id || row.product_id || `${table}_${loaded.length}`),
            name: clean(row.name || row.product_name || row.title || "Farm Product"),
            price: Number(row.price || row.unit_price || row.amount || 0),
            quantity: Number(
              row.quantity || row.inventory_count || row.stock || row.qty || 0
            ),
            status: clean(row.status || "active"),
            image_url: clean(
              row.image_url || row.product_image_url || row.photo_url
            ),
          }))
        );
      }
    }

    setProducts(
      Array.from(
        new Map(loaded.filter((item) => item.id).map((item) => [item.id, item]))
          .values()
      )
    );
  }

  async function loadOrders(activeFarmerId: string, activeEmail: string) {
    const tables = ["farm_orders", "customer_orders", "orders", "delivery_orders"];
    const loaded: OrderRow[] = [];

    for (const table of tables) {
      const rows = await safeSelectRecent(table, 300);

      const filtered = rows.filter((row: any) =>
        rowMatchesFarmer(row, activeFarmerId, activeEmail)
      );

      loaded.push(
        ...filtered.map((row: any) => ({
          id: clean(row.id || row.order_id || `${table}_${loaded.length}`),
          status: clean(
            row.status || row.fulfillment_status || row.order_status || "new"
          ),
          total: Number(row.total || row.order_total || row.subtotal || row.amount || 0),
          created_at: clean(row.created_at),
        }))
      );
    }

    setOrders(
      Array.from(
        new Map(loaded.filter((item) => item.id).map((item) => [item.id, item]))
          .values()
      )
    );
  }

  async function loadDrivers(activeFarmerId: string) {
    if (!activeFarmerId) {
      setPreferredDrivers(0);
      return;
    }

    const rows = await safeSelectRecent("farmer_drivers", 500);

    const filtered = rows.filter((row: any) =>
      [
        row?.farmer_id,
        row?.owner_id,
        row?.user_id,
        row?.profile_id,
        row?.auth_user_id,
      ]
        .map(clean)
        .includes(activeFarmerId)
    );

    setPreferredDrivers(filtered.length);
  }

  async function refreshDashboard() {
    setRefreshing(true);
    await loadDashboard();
  }

  function go(pathname: string) {
    router.push({
      pathname,
      params: farmerId ? { farmerId } : {},
    } as any);
  }

  function logout() {
    Alert.alert("Log Out", "Log out of your farmer account?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.multiRemove([
            "currentFarmer",
            "farm2homeCurrentFarmer",
            "farm2homeFarmerSession",
            "currentUser",
            "userRole",
            "currentUserRole",
          ]);

          await supabase.auth.signOut();
          router.replace("/farmer/login" as any);
        },
      },
    ]);
  }

  if (loading && !farmer) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={COLORS.green} size="large" />
          <Text style={styles.loadingText}>Loading farmer dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshDashboard} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <View>
            <Text style={styles.greeting}>Good day 👋</Text>
            <Text style={styles.pageTitle}>{farmName}</Text>
          </View>

          <TouchableOpacity
            style={styles.profileCircle}
            onPress={() => go("/farmer/setup-store")}
            activeOpacity={0.9}
          >
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.profileLogo} />
            ) : (
              <Ionicons name="leaf-outline" size={24} color={COLORS.greenDark} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroBadge}>Grocerly Farmer Store</Text>
            <Text style={styles.heroTitle}>
              Fresh farm products, ready for local customers.
            </Text>
            <Text style={styles.heroSub}>
              Manage your store, produce, deliveries, payout setup, and preferred
              drivers.
            </Text>

            <View style={styles.heroActions}>
              <TouchableOpacity
                style={styles.heroButton}
                onPress={() => go("/farmer/setup-store")}
                activeOpacity={0.9}
              >
                <Text style={styles.heroButtonText}>Setup Store</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.heroButtonLight}
                onPress={() => go("/farmer/add-product")}
                activeOpacity={0.9}
              >
                <Text style={styles.heroButtonLightText}>Add Product</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.heroBasket}>
            <Text style={styles.heroBasketEmoji}>🥬</Text>
          </View>
        </View>

        <View style={styles.readyCard}>
          <View
            style={[
              styles.readyIcon,
              dashboardReady ? styles.readyIconGood : styles.readyIconWarn,
            ]}
          >
            <Ionicons
              name={
                dashboardReady
                  ? "checkmark-circle-outline"
                  : "alert-circle-outline"
              }
              size={26}
              color={dashboardReady ? COLORS.greenDark : COLORS.orange}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.readyTitle}>
              {dashboardReady ? "Store is active" : "Store setup needed"}
            </Text>
            <Text style={styles.readyText}>
              {dashboardReady
                ? "Your farmer dashboard is ready. Continue managing orders and inventory."
                : "Complete your store profile so customers can find your farm."}
            </Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Products" value={String(stats.products)} icon="basket-outline" />
          <StatCard label="Orders" value={String(stats.orders)} icon="receipt-outline" />
          <StatCard label="Drivers" value={String(stats.drivers)} icon="car-outline" />
          <StatCard label="Revenue" value={money(stats.revenue)} icon="cash-outline" />
        </View>

        <Text style={styles.sectionTitle}>Store Management</Text>

        <View style={styles.actionGrid}>
          <View style={styles.actionGrid}>
  <ActionCard title="Setup Farmer Store" subtitle="Farm profile, logo, pickup, delivery." icon="storefront-outline" onPress={() => go("/farmer/setup-store")} primary />
  <ActionCard title="Select Produce" subtitle="Add common grocery produce quickly." icon="nutrition-outline" onPress={() => go("/farmer/select-produce")} />
  <ActionCard title="Add Custom Product" subtitle="Create your own product listing." icon="add-circle-outline" onPress={() => go("/farmer/add-product")} />
  <ActionCard title="Connect Bank" subtitle={payoutsReady ? "Stripe payouts ready." : "Finish Stripe Connect payouts."} icon="card-outline" onPress={() => go("/farmer/connect-bank")} />
  <ActionCard title="Preferred Drivers" subtitle="Manage farmer driver network." icon="people-outline" onPress={() => go("/farmer/driver")} />
  <ActionCard title="AI Compliance" subtitle="Review compliance alerts." icon="shield-checkmark-outline" onPress={() => go("/farmer/ai-compliance")} />
  <ActionCard title="Assigned Drivers" subtitle="View assigned delivery drivers." icon="people-circle-outline" onPress={() => go("/farmer/assigned-drivers")} />
  <ActionCard title="Compliance Upload" subtitle="Upload required farmer documents." icon="cloud-upload-outline" onPress={() => go("/farmer/compliance-upload")} />
  <ActionCard title="Customer Driver Chat" subtitle="Message customers and drivers." icon="chatbubbles-outline" onPress={() => go("/farmer/customer-driver-chat")} />
  <ActionCard title="Customer Reviews" subtitle="View customer feedback." icon="star-outline" onPress={() => go("/farmer/customer-reviews")} />
  <ActionCard title="Delivery Operations" subtitle="Manage delivery workflow." icon="navigate-outline" onPress={() => go("/farmer/delivery-operations")} />
  <ActionCard title="Delivery Orders" subtitle="Track delivery orders." icon="cube-outline" onPress={() => go("/farmer/delivery-orders")} />
  <ActionCard title="Pickup Settings" subtitle="Set pickup and delivery rules." icon="settings-outline" onPress={() => go("/farmer/delivery-pickup-settings")} />
  <ActionCard title="Documents" subtitle="Manage farmer documents." icon="document-text-outline" onPress={() => go("/farmer/documents")} />
  <ActionCard title="Driver Chat" subtitle="Chat with preferred drivers." icon="chatbox-outline" onPress={() => go("/farmer/driver-chat")} />
  <ActionCard title="Earnings" subtitle="View payout earnings." icon="cash-outline" onPress={() => go("/farmer/earnings")} />
  <ActionCard title="AI Growth Center" subtitle="Farm growth insights." icon="trending-up-outline" onPress={() => go("/farmer/farm-ai-growth-center")} />
  <ActionCard title="Subscription Plans" subtitle="Manage farmer membership." icon="card-outline" onPress={() => go("/farmer/farmer-subscription-plans")} />
  <ActionCard title="Help Center" subtitle="Get farmer support." icon="help-circle-outline" onPress={() => go("/farmer/help-center")} />
  <ActionCard title="Inventory Management" subtitle="Manage product inventory." icon="archive-outline" onPress={() => go("/farmer/inventory-management")} />
  <ActionCard title="Orders" subtitle="Review customer orders." icon="receipt-outline" onPress={() => go("/farmer/orders")} />
  <ActionCard title="Post Load" subtitle="Post delivery load needs." icon="car-outline" onPress={() => go("/farmer/post-load")} />
  <ActionCard title="Post Produce" subtitle="Post farm produce." icon="leaf-outline" onPress={() => go("/farmer/post-produce")} />
  <ActionCard title="Profile" subtitle="Update farmer profile." icon="person-outline" onPress={() => go("/farmer/profile")} />
  <ActionCard title="Revenue Analytics" subtitle="View sales analytics." icon="bar-chart-outline" onPress={() => go("/farmer/revenue-analytics")} />
</View>
          <ActionCard
          title="Meat & Seafood Bundles"
          subtitle="Create monthly or bi-monthly farm bundles."
          icon="fish-outline"
          onPress={() => go("/farmer/farm-bundles")}
          />
          <ActionCard
            title="Setup Farmer Store"
            subtitle="Farm profile, logo, pickup, delivery."
            icon="storefront-outline"
            onPress={() => go("/farmer/setup-store")}
            primary
          />
          <ActionCard
            title="Select Produce"
            subtitle="Add common grocery produce quickly."
            icon="nutrition-outline"
            onPress={() => go("/farmer/select-produce")}
          />
          <ActionCard
            title="Add Custom Product"
            subtitle="Create your own product listing."
            icon="add-circle-outline"
            onPress={() => go("/farmer/add-product")}
          />
          <ActionCard
            title="Connect Bank"
            subtitle={
              payoutsReady ? "Stripe payouts ready." : "Finish Stripe Connect payouts."
            }
            icon="card-outline"
            onPress={() => go("/farmer/connect-bank")}
          />
          <ActionCard
            title="Preferred Drivers"
            subtitle="Manage farmer driver network."
            icon="people-outline"
            onPress={() => go("/farmer/driver")}
          />
          <ActionCard
            title="Orders"
            subtitle="Review farm orders and delivery status."
            icon="bag-check-outline"
            onPress={() => go("/farmer/orders")}
          />
        </View>

        <Text style={styles.sectionTitle}>Quick Inventory</Text>

        <View style={styles.productList}>
          {products.slice(0, 5).map((product) => (
            <View key={product.id} style={styles.productRow}>
              <View style={styles.productIcon}>
                {product.image_url ? (
                  <Image source={{ uri: product.image_url }} style={styles.productImage} />
                ) : (
                  <Text style={styles.productEmoji}>🥕</Text>
                )}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productMeta}>
                  {money(product.price)} • Qty {Number(product.quantity || 0)}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.productEdit}
                onPress={() => go("/farmer/add-product")}
              >
                <Ionicons name="create-outline" size={18} color={COLORS.greenDark} />
              </TouchableOpacity>
            </View>
          ))}

          {!products.length && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🧺</Text>
              <Text style={styles.emptyTitle}>No products listed yet</Text>
              <Text style={styles.emptyText}>
                Add produce or custom grocery items to open your store.
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => go("/farmer/select-produce")}
              >
                <Text style={styles.emptyButtonText}>Add Produce</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Ionicons name="log-out-outline" size={18} color={COLORS.red} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={19} color={COLORS.greenDark} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionCard({
  title,
  subtitle,
  icon,
  onPress,
  primary,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionCard, primary && styles.actionCardPrimary]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={[styles.actionIcon, primary && styles.actionIconPrimary]}>
        <Ionicons
          name={icon}
          size={22}
          color={primary ? COLORS.white : COLORS.greenDark}
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[styles.actionTitle, primary && styles.actionTitlePrimary]}>
          {title}
        </Text>
        <Text style={[styles.actionSub, primary && styles.actionSubPrimary]}>
          {subtitle}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward-outline"
        size={18}
        color={primary ? COLORS.white : COLORS.muted}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 10, color: COLORS.muted, fontWeight: "800" },
  content: { padding: 16, paddingBottom: 110 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  greeting: { color: COLORS.muted, fontWeight: "800", fontSize: 14 },
  pageTitle: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: "900",
    marginTop: 2,
  },
  profileCircle: {
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  profileLogo: { width: "100%", height: "100%" },
  hero: {
    backgroundColor: COLORS.green,
    borderRadius: 30,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
    shadowColor: COLORS.green,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 3,
  },
  heroBadge: {
    color: COLORS.lime,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 11,
  },
  heroTitle: {
    color: COLORS.white,
    fontSize: 25,
    fontWeight: "900",
    lineHeight: 31,
    marginTop: 7,
  },
  heroSub: {
    color: COLORS.white,
    opacity: 0.92,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 7,
  },
  heroActions: { flexDirection: "row", gap: 10, marginTop: 16, flexWrap: "wrap" },
  heroButton: {
    backgroundColor: COLORS.white,
    borderRadius: 999,
    paddingHorizontal: 17,
    paddingVertical: 11,
  },
  heroButtonText: { color: COLORS.greenDark, fontWeight: "900" },
  heroButtonLight: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    paddingHorizontal: 17,
    paddingVertical: 11,
  },
  heroButtonLightText: { color: COLORS.white, fontWeight: "900" },
  heroBasket: {
    width: 78,
    height: 78,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroBasketEmoji: { fontSize: 42 },
  readyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 14,
  },
  readyIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  readyIconGood: { backgroundColor: COLORS.greenSoft },
  readyIconWarn: { backgroundColor: COLORS.orangeSoft },
  readyTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  readyText: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 3,
  },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 18 },
  statCard: {
    width: Platform.OS === "web" ? "24%" : "48%",
    minWidth: 150,
    flexGrow: 1,
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 15,
    backgroundColor: COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  statValue: { color: COLORS.text, fontSize: 24, fontWeight: "900" },
  statLabel: { color: COLORS.muted, fontWeight: "900", marginTop: 2 },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 12,
    marginTop: 4,
  },
  actionGrid: { gap: 10, marginBottom: 18 },
  actionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionCardPrimary: {
    backgroundColor: COLORS.greenDark,
    borderColor: COLORS.greenDark,
  },
  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: 17,
    backgroundColor: COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconPrimary: { backgroundColor: "rgba(255,255,255,0.16)" },
  actionTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  actionTitlePrimary: { color: COLORS.white },
  actionSub: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3,
    lineHeight: 18,
  },
  actionSubPrimary: { color: "rgba(255,255,255,0.86)" },
  productList: { gap: 10 },
  productRow: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  productIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: COLORS.orangeSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  productImage: { width: "100%", height: "100%" },
  productEmoji: { fontSize: 27 },
  productName: { color: COLORS.text, fontWeight: "900", fontSize: 15 },
  productMeta: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  productEdit: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBox: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    alignItems: "center",
  },
  emptyEmoji: { fontSize: 42 },
  emptyTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 18,
    marginTop: 8,
  },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
  emptyButton: {
    backgroundColor: COLORS.green,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: 16,
  },
  emptyButtonText: { color: COLORS.white, fontWeight: "900" },
  logoutButton: {
    marginTop: 18,
    backgroundColor: COLORS.redSoft,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  logoutText: { color: COLORS.red, fontWeight: "900" },
});