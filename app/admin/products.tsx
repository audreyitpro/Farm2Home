// app/admin/products.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../services/supabaseClient";

const ui = {
  bg: "#F5F7FB",
  card: "#FFFFFF",
  border: "#E5E7EB",
  text: "#111827",
  muted: "#6B7280",
  soft: "#F9FAFB",
  primary: "#7C3AED",
  primarySoft: "#EDE9FE",
  green: "#10B981",
  blue: "#2563EB",
  orange: "#F59E0B",
  red: "#EF4444",
};

type ProductRow = {
  id: string;
  farmer_id?: string | null;
  name?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  product_category?: string | null;
  price?: number | null;
  quantity?: number | null;
  inventory?: number | null;
  unit?: string | null;
  active?: boolean | null;
  status?: string | null;
  created_at?: string | null;
  farmers?: {
    farm_name?: string | null;
    owner_name?: string | null;
  } | null;
};

type OrderItemRow = {
  id: string;
  product_id?: string | null;
  order_id?: string | null;
  quantity?: number | null;
  price?: number | null;
  total?: number | null;
};

type ProductCard = ProductRow & {
  displayName: string;
  displayCategory: string;
  displayPrice: number;
  inventoryCount: number;
  soldCount: number;
  revenue: number;
};

export default function AdminProducts() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [search, setSearch] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [])
  );

  async function loadProducts() {
    try {
      setLoading(true);

      const { data: productData, error: productError } = await supabase
        .from("products")
        .select(
          `
          *,
          farmers (
            farm_name,
            owner_name
          )
        `
        )
        .order("created_at", { ascending: false });

      if (productError) {
        console.log("Admin products error:", productError.message);
      }

      const { data: itemData, error: itemError } = await supabase
        .from("order_items")
        .select("*");

      if (itemError) {
        console.log("Admin product order items error:", itemError.message);
      }

      const cleanProducts = Array.isArray(productData)
        ? (productData as ProductRow[])
        : [];

      const cleanItems = Array.isArray(itemData)
        ? (itemData as OrderItemRow[])
        : [];

      const mapped: ProductCard[] = cleanProducts.map((product) => {
        const relatedItems = cleanItems.filter(
          (item) => String(item.product_id || "") === String(product.id)
        );

        const displayPrice = Number(product.price || 0);
        const inventoryCount = Number(product.quantity || product.inventory || 0);

        const soldCount = relatedItems.reduce(
          (sum, item) => sum + Number(item.quantity || 0),
          0
        );

        const revenue = relatedItems.reduce(
          (sum, item) =>
            sum +
            Number(
              item.total ||
                Number(item.quantity || 0) * Number(item.price || displayPrice)
            ),
          0
        );

        return {
          ...product,
          displayName: product.name || product.title || "Farm Product",
          displayCategory:
            product.category || product.product_category || "Uncategorized",
          displayPrice,
          inventoryCount,
          soldCount,
          revenue,
        };
      });

      setProducts(mapped);
    } catch (error: any) {
      Alert.alert("Products Error", error?.message || "Unable to load products.");
    } finally {
      setLoading(false);
    }
  }

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;

    return products.filter((product) =>
      [
        product.displayName,
        product.displayCategory,
        product.description,
        product.status,
        product.unit,
        product.farmers?.farm_name,
        product.farmers?.owner_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [products, search]);

  const stats = useMemo(() => {
    const activeProducts = products.filter(
      (product) =>
        product.active !== false &&
        !["inactive", "disabled", "draft"].includes(
          String(product.status || "").toLowerCase()
        )
    ).length;

    const outOfStock = products.filter(
      (product) => product.inventoryCount <= 0
    ).length;

    const revenue = products.reduce((sum, product) => sum + product.revenue, 0);
    const inventoryValue = products.reduce(
      (sum, product) => sum + product.displayPrice * product.inventoryCount,
      0
    );

    return {
      totalProducts: products.length,
      activeProducts,
      outOfStock,
      categories: new Set(products.map((product) => product.displayCategory))
        .size,
      soldCount: products.reduce((sum, product) => sum + product.soldCount, 0),
      revenue,
      inventoryValue,
    };
  }, [products]);

  function formatMoney(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function getStatus(product: ProductCard) {
    if (product.active === false) return "INACTIVE";
    if (product.inventoryCount <= 0) return "OUT OF STOCK";
    if (product.status) return product.status;
    return "ACTIVE";
  }

  function getStatusColor(status?: string | null) {
    const value = String(status || "").toLowerCase();

    if (["active", "available", "published"].includes(value)) return ui.green;
    if (["out of stock", "low stock", "pending", "draft"].includes(value)) {
      return ui.orange;
    }
    if (["inactive", "disabled", "rejected"].includes(value)) return ui.red;

    return ui.blue;
  }

  function renderBadge(status?: string | null) {
    return (
      <View style={[styles.badge, { backgroundColor: getStatusColor(status) }]}>
        <Text style={styles.badgeText}>{status || "UNKNOWN"}</Text>
      </View>
    );
  }

  function openProduct(product: ProductCard) {
    Alert.alert(
      product.displayName,
      `Farm: ${product.farmers?.farm_name || "Not assigned"}\nCategory: ${
        product.displayCategory
      }\nPrice: ${formatMoney(product.displayPrice)}\nInventory: ${
        product.inventoryCount
      } ${product.unit || ""}\nSold: ${product.soldCount}\nRevenue: ${formatMoney(
        product.revenue
      )}`
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar barStyle="dark-content" backgroundColor={ui.bg} />
        <ActivityIndicator size="large" color={ui.primary} />
        <Text style={styles.loadingText}>Loading products...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={ui.bg} />

      <View style={styles.shell}>
        <View style={styles.sidebar}>
          <View style={styles.logoRow}>
            <View style={styles.logoMark}>
              <Text style={styles.logoText}>F2H</Text>
            </View>

            <View>
              <Text style={styles.logoTitle}>Farm2Home</Text>
              <Text style={styles.logoSub}>Products</Text>
            </View>
          </View>

          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <NavButton label="Control Tower" icon="radio-outline" route="/admin/control-tower" />
          <NavButton label="Products" icon="basket-outline" route="/admin/products" active />
          <NavButton label="Categories" icon="albums-outline" route="/admin/categories" />
          <NavButton label="Farmers" icon="leaf-outline" route="/admin/farmers" />
          <NavButton label="Orders" icon="receipt-outline" route="/admin/orders" />
        </View>

        <View style={styles.main}>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.welcome}>Farm2Home Marketplace Admin</Text>
              <Text style={styles.pageTitle}>Products</Text>
              <Text style={styles.pageSub}>
                Manage produce listings, farm goods, inventory, categories, and product revenue.
              </Text>
            </View>

            <TouchableOpacity style={styles.refreshPill} onPress={loadProducts}>
              <Ionicons name="refresh-outline" size={18} color={ui.primary} />
              <Text style={styles.refreshPillText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.statsGrid}>
              <StatCard label="Total Products" value={String(stats.totalProducts)} icon="basket-outline" accent />
              <StatCard label="Active Products" value={String(stats.activeProducts)} icon="checkmark-circle-outline" success />
              <StatCard label="Out of Stock" value={String(stats.outOfStock)} icon="alert-circle-outline" warning />
              <StatCard label="Categories" value={String(stats.categories)} icon="albums-outline" />
              <StatCard label="Items Sold" value={String(stats.soldCount)} icon="cart-outline" />
              <StatCard label="Product Revenue" value={formatMoney(stats.revenue)} icon="cash-outline" accent />
              <StatCard label="Inventory Value" value={formatMoney(stats.inventoryValue)} icon="wallet-outline" />
            </View>

            <View style={styles.searchCard}>
              <Ionicons name="search-outline" size={20} color={ui.primary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search product, category, farmer, status..."
                placeholderTextColor={ui.muted}
                style={styles.searchInput}
              />
            </View>

            <View style={styles.dataSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Marketplace Product Directory</Text>
                <Text style={styles.sectionLink}>{filteredProducts.length} products</Text>
              </View>

              <FlatList
                data={filteredProducts}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={
                  <EmptyCard
                    title="No products found."
                    text="Products will appear here after farmers add marketplace listings."
                  />
                }
                renderItem={({ item }) => {
                  const status = getStatus(item);

                  return (
                    <TouchableOpacity style={styles.row} onPress={() => openProduct(item)}>
                      <View style={styles.avatar}>
                        <Ionicons name="basket-outline" size={22} color={ui.primary} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{item.displayName}</Text>
                        <Text style={styles.meta}>
                          Farm: {item.farmers?.farm_name || "Not assigned"}
                        </Text>
                        <Text style={styles.meta}>
                          Category: {item.displayCategory}
                        </Text>
                        <Text style={styles.meta}>
                          Price: {formatMoney(item.displayPrice)} • Inventory:{" "}
                          {item.inventoryCount} {item.unit || ""}
                        </Text>
                        <Text style={styles.meta}>
                          Sold: {item.soldCount} • Revenue: {formatMoney(item.revenue)}
                        </Text>
                      </View>

                      <View style={styles.rightCol}>
                        {renderBadge(status)}
                        <TouchableOpacity
                          style={styles.viewButton}
                          onPress={() => openProduct(item)}
                        >
                          <Text style={styles.viewButtonText}>View</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

function NavButton({
  label,
  icon,
  route,
  active = false,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  active?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.navButton, active && styles.navButtonActive]}
      onPress={() => router.push(route as any)}
    >
      <Ionicons name={icon} size={18} color={active ? "#FFFFFF" : ui.muted} />
      <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent = false,
  success = false,
  warning = false,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: boolean;
  success?: boolean;
  warning?: boolean;
}) {
  const color = success ? ui.green : warning ? ui.orange : accent ? ui.primary : ui.blue;

  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyCard({ title, text }: { title: string; text?: string }) {
  return (
    <View style={styles.emptyCard}>
      <Ionicons name="basket-outline" size={30} color={ui.primary} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!text && <Text style={styles.emptyText}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ui.bg },
  loadingScreen: {
    flex: 1,
    backgroundColor: ui.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { color: ui.muted, marginTop: 10, fontWeight: "800" },
  shell: { flex: 1, backgroundColor: ui.bg },
  sidebar: {
    backgroundColor: ui.card,
    borderBottomWidth: 1,
    borderBottomColor: ui.border,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  logoMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: ui.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: "#FFFFFF", fontWeight: "900", fontSize: 13 },
  logoTitle: { color: ui.text, fontWeight: "900", fontSize: 18 },
  logoSub: { color: ui.muted, fontWeight: "700", fontSize: 12 },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: ui.soft,
  },
  navButtonActive: { backgroundColor: ui.primary },
  navText: { color: ui.muted, fontWeight: "900", fontSize: 13 },
  navTextActive: { color: "#FFFFFF" },
  main: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  topbar: {
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  welcome: { color: ui.muted, fontWeight: "800", marginBottom: 4 },
  pageTitle: { color: ui.text, fontSize: 26, fontWeight: "900" },
  pageSub: { color: ui.muted, marginTop: 4, fontWeight: "700", maxWidth: 720 },
  refreshPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: ui.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  refreshPillText: { color: ui.primary, fontWeight: "900" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 14 },
  statCard: {
    width: "48%",
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: ui.border,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  statValue: { color: ui.text, fontSize: 22, fontWeight: "900" },
  statLabel: { color: ui.muted, fontWeight: "800", marginTop: 4 },
  searchCard: {
    backgroundColor: ui.card,
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 52,
    borderWidth: 1,
    borderColor: ui.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  searchInput: { flex: 1, color: ui.text, fontWeight: "800" },
  dataSection: {
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { color: ui.text, fontSize: 19, fontWeight: "900" },
  sectionLink: { color: ui.primary, fontWeight: "900", fontSize: 12 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: ui.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: ui.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { color: ui.text, fontWeight: "900", fontSize: 16 },
  meta: {
    color: ui.muted,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 18,
    fontSize: 12,
  },
  rightCol: { alignItems: "flex-end", gap: 8 },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 140,
  },
  badgeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 10,
    textTransform: "uppercase",
    textAlign: "center",
  },
  viewButton: {
    backgroundColor: ui.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  viewButtonText: { color: ui.primary, fontWeight: "900", fontSize: 12 },
  emptyCard: {
    borderTopWidth: 1,
    borderTopColor: ui.border,
    padding: 18,
    alignItems: "center",
  },
  emptyTitle: {
    color: ui.text,
    fontWeight: "900",
    fontSize: 17,
    marginTop: 8,
    textAlign: "center",
  },
  emptyText: {
    color: ui.muted,
    fontWeight: "700",
    lineHeight: 21,
    textAlign: "center",
    marginTop: 5,
  },
});