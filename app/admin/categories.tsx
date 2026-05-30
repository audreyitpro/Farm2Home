// app/admin/categories.tsx

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
  name?: string | null;
  category?: string | null;
  product_category?: string | null;
  price?: number | null;
  active?: boolean | null;
};

type CategoryCard = {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  productCount: number;
  activeProducts: number;
  revenueEstimate: number;
  active: boolean;
};

const DEFAULT_CATEGORIES: CategoryCard[] = [
  {
    id: "vegetables",
    name: "Vegetables",
    description: "Fresh local vegetables from Farm2Home farmers.",
    icon: "leaf-outline",
    productCount: 0,
    activeProducts: 0,
    revenueEstimate: 0,
    active: true,
  },
  {
    id: "fruits",
    name: "Fruits",
    description: "Seasonal fruits, orchard goods, berries, and fresh picks.",
    icon: "nutrition-outline",
    productCount: 0,
    activeProducts: 0,
    revenueEstimate: 0,
    active: true,
  },
  {
    id: "meat",
    name: "Meat",
    description: "Local beef, pork, lamb, and farm-raised meat products.",
    icon: "restaurant-outline",
    productCount: 0,
    activeProducts: 0,
    revenueEstimate: 0,
    active: true,
  },
  {
    id: "dairy",
    name: "Dairy",
    description: "Milk, cheese, butter, eggs, and refrigerated farm goods.",
    icon: "water-outline",
    productCount: 0,
    activeProducts: 0,
    revenueEstimate: 0,
    active: true,
  },
  {
    id: "produce",
    name: "Produce",
    description: "General farm produce and fresh market goods.",
    icon: "basket-outline",
    productCount: 0,
    activeProducts: 0,
    revenueEstimate: 0,
    active: true,
  },
  {
    id: "farm supplies",
    name: "Farm Supplies",
    description: "Seeds, soil, equipment, feed, and farm supply listings.",
    icon: "construct-outline",
    productCount: 0,
    activeProducts: 0,
    revenueEstimate: 0,
    active: true,
  },
  {
    id: "poultry",
    name: "Poultry",
    description: "Chicken, turkey, eggs, and poultry-related products.",
    icon: "egg-outline",
    productCount: 0,
    activeProducts: 0,
    revenueEstimate: 0,
    active: true,
  },
  {
    id: "specialty foods",
    name: "Specialty Foods",
    description: "Honey, jams, baked goods, sauces, and specialty farm products.",
    icon: "star-outline",
    productCount: 0,
    activeProducts: 0,
    revenueEstimate: 0,
    active: true,
  },
];

export default function AdminCategories() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryCard[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [search, setSearch] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadCategories();
    }, [])
  );

  async function loadCategories() {
    try {
      setLoading(true);

      const { data: productData } = await supabase.from("products").select("*");

      const cleanProducts = Array.isArray(productData)
        ? (productData as ProductRow[])
        : [];

      setProducts(cleanProducts);

      const mapped = DEFAULT_CATEGORIES.map((category) => {
        const relatedProducts = cleanProducts.filter((product) => {
          const rawCategory = String(
            product.category || product.product_category || ""
          ).toLowerCase();

          return rawCategory.includes(category.id);
        });

        return {
          ...category,
          productCount: relatedProducts.length,
          activeProducts: relatedProducts.filter((product) => product.active !== false)
            .length,
          revenueEstimate: relatedProducts.reduce(
            (sum, product) => sum + Number(product.price || 0),
            0
          ),
        };
      });

      const uncategorizedProducts = cleanProducts.filter(
        (product) => !product.category && !product.product_category
      );

      if (uncategorizedProducts.length > 0) {
        mapped.push({
          id: "uncategorized",
          name: "Uncategorized",
          description: "Products that need a marketplace category assigned.",
          icon: "help-circle-outline",
          productCount: uncategorizedProducts.length,
          activeProducts: uncategorizedProducts.filter(
            (product) => product.active !== false
          ).length,
          revenueEstimate: uncategorizedProducts.reduce(
            (sum, product) => sum + Number(product.price || 0),
            0
          ),
          active: true,
        });
      }

      setCategories(mapped);
    } catch (error: any) {
      Alert.alert(
        "Categories Error",
        error?.message || "Unable to load categories."
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;

    return categories.filter((category) =>
      [category.name, category.description]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [categories, search]);

  const stats = useMemo(() => {
    return {
      totalCategories: categories.length,
      activeCategories: categories.filter((item) => item.active).length,
      productsAssigned: categories.reduce(
        (sum, category) => sum + category.productCount,
        0
      ),
      activeProducts: categories.reduce(
        (sum, category) => sum + category.activeProducts,
        0
      ),
      totalProducts: products.length,
    };
  }, [categories, products]);

  function formatMoney(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function openCategory(category: CategoryCard) {
    Alert.alert(
      category.name,
      `${category.description}\n\nProducts: ${
        category.productCount
      }\nActive Products: ${
        category.activeProducts
      }\nListed Product Value: ${formatMoney(category.revenueEstimate)}`
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar barStyle="dark-content" backgroundColor={ui.bg} />
        <ActivityIndicator size="large" color={ui.primary} />
        <Text style={styles.loadingText}>Loading categories...</Text>
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
              <Text style={styles.logoSub}>Categories</Text>
            </View>
          </View>

          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <NavButton label="Control Tower" icon="radio-outline" route="/admin/control-tower" />
          <NavButton label="Products" icon="basket-outline" route="/admin/products" />
          <NavButton label="Categories" icon="albums-outline" route="/admin/categories" active />
          <NavButton label="Orders" icon="receipt-outline" route="/admin/orders" />
          <NavButton label="Analytics" icon="analytics-outline" route="/admin/analytics-center" />
        </View>

        <View style={styles.main}>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.welcome}>Farm2Home Marketplace Admin</Text>
              <Text style={styles.pageTitle}>Categories</Text>
              <Text style={styles.pageSub}>
                Manage produce, meat, dairy, farm supplies, and specialty food categories.
              </Text>
            </View>

            <TouchableOpacity style={styles.refreshPill} onPress={loadCategories}>
              <Ionicons name="refresh-outline" size={18} color={ui.primary} />
              <Text style={styles.refreshPillText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.statsGrid}>
              <StatCard label="Total Categories" value={String(stats.totalCategories)} icon="albums-outline" accent />
              <StatCard label="Active Categories" value={String(stats.activeCategories)} icon="checkmark-circle-outline" success />
              <StatCard label="Products Assigned" value={String(stats.productsAssigned)} icon="basket-outline" />
              <StatCard label="Active Products" value={String(stats.activeProducts)} icon="leaf-outline" success />
              <StatCard label="Total Products" value={String(stats.totalProducts)} icon="cube-outline" />
            </View>

            <View style={styles.searchCard}>
              <Ionicons name="search-outline" size={20} color={ui.primary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search categories..."
                placeholderTextColor={ui.muted}
                style={styles.searchInput}
              />
            </View>

            <View style={styles.dataSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Marketplace Categories</Text>
                <Text style={styles.sectionLink}>
                  {filteredCategories.length} categories
                </Text>
              </View>

              <FlatList
                data={filteredCategories}
                keyExtractor={(item) => item.id}
                numColumns={2}
                scrollEnabled={false}
                columnWrapperStyle={styles.categoryRow}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={
                  <EmptyCard
                    title="No categories found."
                    text="Try a different search term."
                  />
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.categoryCard}
                    onPress={() => openCategory(item)}
                  >
                    <View style={styles.categoryTop}>
                      <View style={styles.categoryIcon}>
                        <Ionicons name={item.icon} size={24} color={ui.primary} />
                      </View>

                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: item.active ? ui.green : ui.red },
                        ]}
                      />
                    </View>

                    <Text style={styles.categoryTitle}>{item.name}</Text>
                    <Text style={styles.categoryDescription}>
                      {item.description}
                    </Text>

                    <View style={styles.metricLine}>
                      <Text style={styles.metricLabel}>Products</Text>
                      <Text style={styles.metricValue}>{item.productCount}</Text>
                    </View>

                    <View style={styles.metricLine}>
                      <Text style={styles.metricLabel}>Active</Text>
                      <Text style={styles.metricValue}>{item.activeProducts}</Text>
                    </View>

                    <View style={styles.metricLine}>
                      <Text style={styles.metricLabel}>Value</Text>
                      <Text style={styles.metricValue}>
                        {formatMoney(item.revenueEstimate)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
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
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: boolean;
  success?: boolean;
}) {
  const color = success ? ui.green : accent ? ui.primary : ui.blue;

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
      <Ionicons name="albums-outline" size={30} color={ui.primary} />
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
  categoryRow: { gap: 12 },
  categoryCard: {
    flex: 1,
    backgroundColor: ui.soft,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 12,
  },
  categoryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: ui.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  statusDot: {
    width: 11,
    height: 11,
    borderRadius: 999,
  },
  categoryTitle: {
    color: ui.text,
    fontWeight: "900",
    fontSize: 17,
  },
  categoryDescription: {
    color: ui.muted,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 12,
  },
  metricLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: ui.border,
    paddingTop: 8,
    marginTop: 8,
  },
  metricLabel: { color: ui.muted, fontWeight: "800", fontSize: 12 },
  metricValue: { color: ui.text, fontWeight: "900", fontSize: 12 },
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