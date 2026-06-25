// app/farmer/driver.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
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
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL } from "../config/api";
import { supabase } from "../services/supabaseClient";

type FarmerDriver = {
  id: string;
  farmer_id: string;
  driver_id?: string;
  driver_name: string;
  driver_email: string;
  driver_phone?: string;
  status?: string;
  invite_status?: string;
  created_at?: string;
  updated_at?: string;
};

type FarmerSession = {
  id: string;
  farmer_id?: string;
  full_name?: string;
  name?: string;
  farm_name?: string;
  business_name?: string;
  email?: string;
  role?: string;
};

const COLORS = {
  bg: "#F6F8F2",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  text: "#111827",
  muted: "#667085",
  border: "#E5E7EB",
  green: "#15803D",
  greenDark: "#14532D",
  greenSoft: "#DCFCE7",
  amber: "#F59E0B",
  amberSoft: "#FEF3C7",
  red: "#DC2626",
  redSoft: "#FEE2E2",
  blue: "#2563EB",
  blueSoft: "#DBEAFE",
  black: "#111827",
  white: "#FFFFFF",
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function isEmail(value: string) {
  return /\S+@\S+\.\S+/.test(value);
}

function titleCase(value: any) {
  return clean(value)
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getFarmerName(farmer: FarmerSession | null) {
  return (
    clean(farmer?.farm_name) ||
    clean(farmer?.business_name) ||
    clean(farmer?.full_name) ||
    clean(farmer?.name) ||
    "Farm2Home Farmer"
  );
}

export default function FarmerDriversScreen() {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [farmerId, setFarmerId] = useState("");
  const [farmerName, setFarmerName] = useState("Farm2Home Farmer");

  const [driverName, setDriverName] = useState("");
  const [driverEmail, setDriverEmail] = useState("");
  const [driverPhone, setDriverPhone] = useState("");

  const [drivers, setDrivers] = useState<FarmerDriver[]>([]);
  const [search, setSearch] = useState("");

  useFocusEffect(
    useCallback(() => {
      initialize();
    }, [])
  );

  const filteredDrivers = useMemo(() => {
    const term = normalize(search);

    if (!term) return drivers;

    return drivers.filter((driver) => {
      return (
        normalize(driver.driver_name).includes(term) ||
        normalize(driver.driver_email).includes(term) ||
        normalize(driver.driver_phone).includes(term) ||
        normalize(driver.status).includes(term) ||
        normalize(driver.invite_status).includes(term)
      );
    });
  }, [drivers, search]);

  const stats = useMemo(() => {
    const active = drivers.filter((item) => isActiveDriver(item)).length;
    const pending = drivers.filter((item) => normalize(item.invite_status || item.status).includes("pending")).length;

    return {
      total: drivers.length,
      active,
      pending,
    };
  }, [drivers]);

  async function initialize() {
    try {
      setLoading(true);

      const currentFarmer = await getCurrentFarmer();

      if (!currentFarmer?.id) {
        Alert.alert("Missing Farmer", "Farmer account not found. Please login again.");
        router.replace("/farmer/login" as any);
        return;
      }

      setFarmerId(currentFarmer.id);
      setFarmerName(getFarmerName(currentFarmer));

      await loadDrivers(currentFarmer.id);
    } catch (error) {
      console.log("Initialize farmer drivers error:", error);
      Alert.alert("Load Error", "Unable to load farmer driver screen.");
    } finally {
      setLoading(false);
    }
  }

  async function getCurrentFarmer(): Promise<FarmerSession | null> {
    const raw =
      (await AsyncStorage.getItem("currentFarmer")) ||
      (await AsyncStorage.getItem("farm2homeCurrentFarmer")) ||
      (await AsyncStorage.getItem("farm2homeFarmerSession")) ||
      (await AsyncStorage.getItem("currentUser"));

    let parsed: any = null;

    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
    }

    if (parsed?.role && parsed.role !== "farmer") return null;

    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;

    const authId = clean(authUser?.id || parsed?.id || parsed?.farmer_id || parsed?.farmerId);
    const authEmail = normalize(authUser?.email || parsed?.email);

    let dbFarmer: any = null;

    if (authId) {
      const byId = await supabase.from("farmers").select("*").eq("id", authId).maybeSingle();
      if (!byId.error && byId.data) dbFarmer = byId.data;
    }

    if (!dbFarmer && authEmail) {
      const byEmail = await supabase.from("farmers").select("*").eq("email", authEmail).maybeSingle();
      if (!byEmail.error && byEmail.data) dbFarmer = byEmail.data;
    }

    const stableId = clean(dbFarmer?.id || parsed?.id || parsed?.farmer_id || parsed?.farmerId || authId);

    if (!stableId) return null;

    const currentFarmer = {
      ...(parsed || {}),
      ...(dbFarmer || {}),
      id: stableId,
      farmer_id: stableId,
      role: "farmer",
      email: normalize(dbFarmer?.email || parsed?.email || authEmail),
    };

    await AsyncStorage.multiSet([
      ["currentFarmer", JSON.stringify(currentFarmer)],
      ["currentUser", JSON.stringify(currentFarmer)],
      ["farm2homeCurrentFarmer", JSON.stringify(currentFarmer)],
      ["farm2homeFarmerSession", JSON.stringify(currentFarmer)],
      ["userRole", "farmer"],
      ["currentUserRole", "farmer"],
    ]);

    return currentFarmer;
  }

  async function loadDrivers(activeFarmerId = farmerId) {
    try {
      if (!activeFarmerId) return;

      setRefreshing(true);

      const loaded: FarmerDriver[] = [];

      try {
        const response = await fetch(`${API_BASE_URL}/driver/farmer-drivers/${encodeURIComponent(activeFarmerId)}`);
        const data = await response.json();

        if (response.ok && data.success && Array.isArray(data.drivers)) {
          loaded.push(...data.drivers.map(normalizeFarmerDriver));
        }
      } catch (error) {
        console.log("Backend farmer-drivers skipped:", error);
      }

      try {
        const { data, error } = await supabase
          .from("farmer_drivers")
          .select("*")
          .eq("farmer_id", activeFarmerId)
          .order("created_at", { ascending: false });

        if (error) {
          console.log("farmer_drivers query skipped:", error.message);
        }

        if (Array.isArray(data)) {
          loaded.push(...data.map(normalizeFarmerDriver));
        }
      } catch (error) {
        console.log("farmer_drivers fallback skipped:", error);
      }

      setDrivers(Array.from(new Map(loaded.map((item) => [item.id, item])).values()));
    } catch (error: any) {
      console.log("Load farmer drivers error:", error);
      Alert.alert("Load Error", error?.message || "Unable to load drivers.");
    } finally {
      setRefreshing(false);
    }
  }

  function normalizeFarmerDriver(row: any): FarmerDriver {
    return {
      id: clean(row.id || `${row.farmer_id || farmerId}_${row.driver_email || row.driver_id || Date.now()}`),
      farmer_id: clean(row.farmer_id || farmerId),
      driver_id: clean(row.driver_id),
      driver_name: clean(row.driver_name || row.name || row.full_name || "Farm2Home Driver"),
      driver_email: normalize(row.driver_email || row.email),
      driver_phone: clean(row.driver_phone || row.phone),
      status: clean(row.status || "active"),
      invite_status: clean(row.invite_status || row.invitation_status || ""),
      created_at: clean(row.created_at),
      updated_at: clean(row.updated_at),
    };
  }

  async function addDriver() {
    try {
      const name = driverName.trim();
      const email = normalize(driverEmail);
      const phone = driverPhone.trim();

      if (!farmerId) {
        Alert.alert("Missing Farmer", "Please login again.");
        return;
      }

      if (!name) {
        Alert.alert("Driver Name Required", "Please enter the driver name.");
        return;
      }

      if (!email || !isEmail(email)) {
        Alert.alert("Driver Email Required", "Please enter a valid driver email.");
        return;
      }

      setLoading(true);

      let backendSuccess = false;

      try {
        const response = await fetch(`${API_BASE_URL}/driver/add-farmer-driver`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            farmerId,
            farmer_id: farmerId,
            driverName: name,
            driver_name: name,
            driverEmail: email,
            driver_email: email,
            driverPhone: phone,
            driver_phone: phone,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          backendSuccess = true;
        } else {
          console.log("add-farmer-driver backend skipped:", data?.error || response.status);
        }
      } catch (error) {
        console.log("add-farmer-driver backend error skipped:", error);
      }

      if (!backendSuccess) {
        const existingDriver = await findDriverByEmail(email);

        const payload = {
          farmer_id: farmerId,
          driver_id: existingDriver?.id || null,
          driver_name: name,
          driver_email: email,
          driver_phone: phone,
          status: "active",
          invite_status: existingDriver?.id ? "matched" : "invited",
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };

        const { error } = await supabase.from("farmer_drivers").insert(payload);

        if (error) throw error;
      }

      Alert.alert("Driver Added", `${name} was added to your preferred drivers.`);

      setDriverName("");
      setDriverEmail("");
      setDriverPhone("");

      await loadDrivers(farmerId);
    } catch (error: any) {
      console.log("Add farmer driver error:", error);
      Alert.alert("Add Driver Error", error?.message || "Unable to add driver.");
    } finally {
      setLoading(false);
    }
  }

  async function findDriverByEmail(email: string) {
    try {
      const { data, error } = await supabase
        .from("drivers")
        .select("id, full_name, name, email, phone")
        .eq("email", email)
        .maybeSingle();

      if (error) {
        console.log("findDriverByEmail skipped:", error.message);
        return null;
      }

      return data;
    } catch (error) {
      console.log("findDriverByEmail error skipped:", error);
      return null;
    }
  }

  async function toggleDriverStatus(item: FarmerDriver) {
    try {
      const nextStatus = isActiveDriver(item) ? "inactive" : "active";

      const { error } = await supabase
        .from("farmer_drivers")
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (error) throw error;

      setDrivers((current) =>
        current.map((driver) =>
          driver.id === item.id ? { ...driver, status: nextStatus } : driver
        )
      );
    } catch (error: any) {
      Alert.alert("Update Error", error?.message || "Unable to update driver status.");
    }
  }

  async function removeDriver(item: FarmerDriver) {
    Alert.alert("Remove Driver", `Remove ${item.driver_name} from your preferred drivers?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase.from("farmer_drivers").delete().eq("id", item.id);
            if (error) throw error;

            setDrivers((current) => current.filter((driver) => driver.id !== item.id));
          } catch (error: any) {
            Alert.alert("Remove Error", error?.message || "Unable to remove driver.");
          }
        },
      },
    ]);
  }

  function isActiveDriver(item: FarmerDriver) {
    const status = normalize(item.status || "active");
    return status === "active" || status === "approved" || status === "matched";
  }

  function callDriver(phone?: string) {
    if (!phone) {
      Alert.alert("Phone Missing", "No phone number is available for this driver.");
      return;
    }

    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert("Call Error", "Unable to start phone call.");
    });
  }

  function emailDriver(email?: string) {
    if (!email) {
      Alert.alert("Email Missing", "No email is available for this driver.");
      return;
    }

    Linking.openURL(`mailto:${email}`).catch(() => {
      Alert.alert("Email Error", "Unable to open email app.");
    });
  }

  function renderDriver({ item }: { item: FarmerDriver }) {
    const isActive = isActiveDriver(item);

    return (
      <View style={styles.driverCard}>
        <View style={styles.driverHeader}>
          <View style={styles.avatar}>
            <Ionicons name="car-outline" size={22} color={COLORS.green} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.driverName}>{item.driver_name}</Text>
            <Text style={styles.driverInfo}>{item.driver_email}</Text>
          </View>

          <View style={[styles.statusBadge, isActive ? styles.activeBadge : styles.inactiveBadge]}>
            <Text style={[styles.statusText, !isActive && styles.inactiveStatusText]}>
              {titleCase(item.status || "active")}
            </Text>
          </View>
        </View>

        {!!item.driver_phone && <Text style={styles.driverInfo}>{item.driver_phone}</Text>}

        {!!item.invite_status && (
          <View style={styles.invitePill}>
            <Ionicons name="mail-outline" size={14} color={COLORS.blue} />
            <Text style={styles.inviteText}>Invite Status: {titleCase(item.invite_status)}</Text>
          </View>
        )}

        <Text style={styles.driverDescription}>
          Preferred drivers receive delivery notifications first before orders are released to the open driver board.
        </Text>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.secondaryAction} onPress={() => callDriver(item.driver_phone)}>
            <Ionicons name="call-outline" size={16} color={COLORS.green} />
            <Text style={styles.secondaryActionText}>Call</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryAction} onPress={() => emailDriver(item.driver_email)}>
            <Ionicons name="mail-outline" size={16} color={COLORS.green} />
            <Text style={styles.secondaryActionText}>Email</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryAction} onPress={() => toggleDriverStatus(item)}>
            <Ionicons name={isActive ? "pause-circle-outline" : "checkmark-circle-outline"} size={16} color={COLORS.green} />
            <Text style={styles.secondaryActionText}>{isActive ? "Pause" : "Activate"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.removeAction} onPress={() => removeDriver(item)}>
            <Ionicons name="trash-outline" size={16} color={COLORS.red} />
            <Text style={styles.removeActionText}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading && !drivers.length) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.greenDark} />
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={COLORS.green} />
          <Text style={styles.loadingText}>Loading preferred drivers...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.greenDark} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.9}>
          <Ionicons name="arrow-back-outline" size={21} color={COLORS.text} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerEyebrow}>Farm2Home Farmer</Text>
          <Text style={styles.headerTitle}>Preferred Drivers</Text>
          <Text style={styles.headerSub}>Manage driver priority for {farmerName}</Text>
        </View>

        <TouchableOpacity style={styles.homeButton} onPress={() => router.push("/farmer/dashboard" as any)} activeOpacity={0.9}>
          <Ionicons name="home-outline" size={21} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredDrivers}
        keyExtractor={(item) => item.id}
        renderItem={renderDriver}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadDrivers(farmerId)} />}
        ListHeaderComponent={
          <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={false}>
            <View style={styles.heroCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroLabel}>Priority Dispatch</Text>
                <Text style={styles.heroTitle}>Farmer Driver Network</Text>
                <Text style={styles.heroText}>
                  Preferred drivers can receive farm delivery opportunities before they go to the public Driver Board.
                </Text>
              </View>

              <View style={styles.heroIcon}>
                <Ionicons name="people-outline" size={30} color={COLORS.white} />
              </View>
            </View>

            <View style={styles.statsRow}>
              <StatCard label="Total" value={stats.total} icon="people-outline" />
              <StatCard label="Active" value={stats.active} icon="checkmark-circle-outline" />
              <StatCard label="Pending" value={stats.pending} icon="time-outline" />
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIcon}>
                  <Ionicons name="person-add-outline" size={22} color={COLORS.green} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Add Preferred Driver</Text>
                  <Text style={styles.sectionSub}>Invite a driver by name, email, and phone.</Text>
                </View>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Driver Name"
                placeholderTextColor="#94A3B8"
                value={driverName}
                onChangeText={setDriverName}
              />

              <TextInput
                style={styles.input}
                placeholder="Driver Email"
                placeholderTextColor="#94A3B8"
                value={driverEmail}
                onChangeText={(value) => setDriverEmail(normalize(value))}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <TextInput
                style={styles.input}
                placeholder="Driver Phone"
                placeholderTextColor="#94A3B8"
                value={driverPhone}
                onChangeText={setDriverPhone}
                keyboardType="phone-pad"
              />

              <TouchableOpacity
                style={[styles.addButton, loading && styles.disabled]}
                onPress={addDriver}
                disabled={loading}
                activeOpacity={0.9}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="add-circle-outline" size={18} color={COLORS.white} />
                    <Text style={styles.addButtonText}>Add Preferred Driver</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={18} color={COLORS.muted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search drivers..."
                placeholderTextColor="#94A3B8"
                style={styles.searchInput}
              />
            </View>

            <Text style={styles.listTitle}>Preferred Drivers</Text>
          </ScrollView>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons name="car-outline" size={34} color={COLORS.green} />
            </View>
            <Text style={styles.emptyTitle}>No preferred drivers added yet</Text>
            <Text style={styles.emptyText}>
              Add trusted drivers to give them priority access to your delivery opportunities.
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={17} color={COLORS.green} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  loadingText: { marginTop: 12, color: COLORS.muted, fontWeight: "800" },
  header: {
    backgroundColor: COLORS.greenDark,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
  },
  homeButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: COLORS.green,
    alignItems: "center",
    justifyContent: "center",
  },
  headerEyebrow: {
    color: "#BBF7D0",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  headerTitle: { color: COLORS.white, fontSize: 24, fontWeight: "900", marginTop: 2 },
  headerSub: { color: "#DCFCE7", fontWeight: "700", marginTop: 2 },
  listContent: {
    padding: 16,
    paddingBottom: 120,
  },
  heroCard: {
    backgroundColor: COLORS.green,
    borderRadius: 26,
    padding: 20,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  heroLabel: { color: "#DCFCE7", fontWeight: "900", fontSize: 12, textTransform: "uppercase" },
  heroTitle: { color: COLORS.white, fontSize: 28, fontWeight: "900", marginTop: 6 },
  heroText: { color: COLORS.white, opacity: 0.92, fontWeight: "700", lineHeight: 21, marginTop: 6 },
  heroIcon: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 13,
    backgroundColor: COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  statValue: { color: COLORS.text, fontSize: 24, fontWeight: "900" },
  statLabel: { color: COLORS.muted, fontWeight: "900", marginTop: 2 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 14,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.text,
  },
  sectionSub: { color: COLORS.muted, fontWeight: "700", marginTop: 3 },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },
  addButton: {
    backgroundColor: COLORS.green,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    flexDirection: "row",
    gap: 8,
  },
  addButtonText: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 16,
  },
  disabled: { opacity: 0.6 },
  searchBox: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  searchInput: { flex: 1, color: COLORS.text, fontWeight: "800", minHeight: 50 },
  listTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: 12,
  },
  driverCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  driverHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 17,
    backgroundColor: COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  driverName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
  },
  driverInfo: {
    color: COLORS.muted,
    marginTop: 5,
    fontWeight: "700",
  },
  driverDescription: {
    color: COLORS.muted,
    marginTop: 12,
    lineHeight: 22,
    fontWeight: "700",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  activeBadge: { backgroundColor: COLORS.greenSoft },
  inactiveBadge: { backgroundColor: COLORS.redSoft },
  statusText: {
    fontWeight: "900",
    color: COLORS.greenDark,
    fontSize: 12,
  },
  inactiveStatusText: { color: "#991B1B" },
  invitePill: {
    backgroundColor: COLORS.blueSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 10,
  },
  inviteText: { color: COLORS.blue, fontWeight: "900", fontSize: 12 },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  secondaryAction: {
    backgroundColor: COLORS.greenSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  secondaryActionText: { color: COLORS.greenDark, fontWeight: "900", fontSize: 12 },
  removeAction: {
    backgroundColor: COLORS.redSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  removeActionText: { color: COLORS.red, fontWeight: "900", fontSize: 12 },
  emptyContainer: {
    marginTop: 26,
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 26,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 21,
    textAlign: "center",
    marginTop: 7,
  },
});
