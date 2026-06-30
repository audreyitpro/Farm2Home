// app/farmer/assigned-drivers.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const COLORS = {
  bg: "#F8FAF5",
  card: "#FFFFFF",
  text: "#172017",
  muted: "#6B7280",
  border: "#E3E8DD",
  primary: "#2E7D32",
  primaryDark: "#14532D",
  soft: "#EEF5EA",
  white: "#FFFFFF",
  dark: "#111827",
  blue: "#2563EB",
  blueSoft: "#EAF2FF",
  danger: "#DC2626",
  dangerSoft: "#FEE2E2",
  orange: "#EF6C00",
  orangeSoft: "#FFF3DE",
};

export default function AssignedDriversScreen() {
  const params = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [savingDriver, setSavingDriver] = useState(false);

  const [farmerId, setFarmerId] = useState("");
  const [farmName, setFarmName] = useState("");

  const [drivers, setDrivers] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    loadScreen();
  }, []);

  const summary = useMemo(() => {
    const assigned = jobs.filter(
      (job) => job.driver_id || job.assigned_driver_id
    ).length;

    const open = jobs.filter(
      (job) => !job.driver_id && !job.assigned_driver_id
    ).length;

    const availableBoard = jobs.filter(
      (job) => String(job.status || "").toLowerCase() === "available"
    ).length;

    return {
      drivers: drivers.length,
      assigned,
      open,
      availableBoard,
      jobs: jobs.length,
    };
  }, [drivers, jobs]);

  async function loadScreen() {
    try {
      setLoading(true);

      const saved =
        (await AsyncStorage.getItem("currentFarmer")) ||
        (await AsyncStorage.getItem("farm2homeCurrentFarmer")) ||
        (await AsyncStorage.getItem("farm2homeFarmerSession")) ||
        (await AsyncStorage.getItem("currentUser"));

      if (!saved) {
        router.replace("/farmer/login" as any);
        return;
      }

      const farmer = JSON.parse(saved);
      const id =
        farmer.id ||
        farmer.farmerId ||
        farmer.farmer_id ||
        farmer.profile_id ||
        String(params.farmerId || params.farmer_id || "") ||
        "";

      if (!id) {
        router.replace("/farmer/login" as any);
        return;
      }

      setFarmerId(id);
      setFarmName(
        farmer.farmName ||
          farmer.farm_name ||
          farmer.businessName ||
          farmer.business_name ||
          "Farm2Home Farm"
      );

      await Promise.all([loadDrivers(id), loadDeliveryJobs(id)]);
    } catch (error: any) {
      Alert.alert(
        "Drivers Error",
        error?.message || "Unable to load assigned drivers."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadDrivers(id = farmerId) {
    const { data, error } = await supabase
      .from("farmer_internal_drivers")
      .select("*")
      .eq("farmer_id", id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.log("Load internal drivers error:", error.message);
      setDrivers([]);
      return;
    }

    setDrivers(Array.isArray(data) ? data : []);
  }

  async function loadDeliveryJobs(id = farmerId) {
    const { data, error } = await supabase
      .from("delivery_orders")
      .select("*")
      .eq("farmer_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      console.log("Load delivery jobs error:", error.message);
      setJobs([]);
      return;
    }

    setJobs(Array.isArray(data) ? data : []);
  }

  async function addDriver() {
    if (!name.trim()) {
      Alert.alert("Missing Name", "Enter driver name.");
      return;
    }

    try {
      setSavingDriver(true);

      if (!farmerId) {
        Alert.alert("Missing Farmer", "Farmer ID was not found. Please login again.");
        return;
      }

      const payload = {
        farmer_id: String(farmerId),
        driver_name: name.trim(),
        driver_email: email.trim().toLowerCase(),
        driver_phone: phone.trim(),
        is_active: true,
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("farmer_internal_drivers")
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.log("Add internal driver error:", error);
        throw error;
      }

      if (data) {
        setDrivers((prev) => [data, ...prev]);
      }

      setName("");
      setEmail("");
      setPhone("");

      await loadScreen();

      Alert.alert("Driver Added", "Internal farm driver was added.");
    } catch (error: any) {
      Alert.alert("Driver Error", error?.message || "Unable to add driver.");
    } finally {
      setSavingDriver(false);
    }
  }

  async function removeDriver(id: string) {
    Alert.alert("Remove Driver", "Remove this driver from your farm team?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase
              .from("farmer_internal_drivers")
              .update({
                is_active: false,
                status: "inactive",
                updated_at: new Date().toISOString(),
              })
              .eq("id", id);

            if (error) throw error;

            await loadScreen();
          } catch (error: any) {
            Alert.alert(
              "Remove Error",
              error?.message || "Unable to remove driver."
            );
          }
        },
      },
    ]);
  }

  async function assignJobToDriver(job: any, driver: any) {
    try {
      const driverId = driver.driver_id || driver.id;

      const { error } = await supabase
        .from("delivery_orders")
        .update({
          driver_id: driverId,
          assigned_driver_id: driverId,
          driver_name: driver.driver_name,
          driver_email: driver.driver_email,
          status: "assigned",
          assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      if (error) throw error;

      await loadScreen();
      Alert.alert(
        "Driver Assigned",
        `${driver.driver_name} was assigned to this farmer market delivery.`
      );
    } catch (error: any) {
      Alert.alert("Assign Error", error?.message || "Unable to assign driver.");
    }
  }

  async function postJobToDriverBoard(job: any) {
    try {
      const { error } = await supabase
        .from("delivery_orders")
        .update({
          status: "available",
          source: "farm2driver",
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      if (error) throw error;

      await loadScreen();
      Alert.alert(
        "Posted to Farm2Driver",
        "This delivery is now available for outside drivers."
      );
    } catch (error: any) {
      Alert.alert(
        "Post Error",
        error?.message || "Unable to post to driver board."
      );
    }
  }

  function openDriverChat(job: any) {
    router.push({
      pathname: "/farmer/driver-chat",
      params: {
        orderId: job.order_id || "",
        deliveryOrderId: job.id,
        driverId: job.driver_id || job.assigned_driver_id || "",
        farmerId,
      },
    } as any);
  }

  function openTracking(job: any) {
    router.push({
      pathname: "/customer/order-tracking",
      params: {
        orderId: job.order_id || "",
        deliveryOrderId: job.id,
      },
    } as any);
  }

  function statusLabel(status: any) {
    return String(status || "open").replace(/_/g, " ");
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.centerText}>Loading driver operations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.push("/farmer/dashboard" as any)}
          >
            <Ionicons name="arrow-back-outline" size={22} color={COLORS.text} />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Farmer Market Operations</Text>
            <Text style={styles.title}>Driver Assignments</Text>
            <Text style={styles.subtitle}>
              {farmName} delivery workflow
            </Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="car-outline" size={28} color={COLORS.white} />
          </View>

          <Text style={styles.heroBadge}>Delivery Flow</Text>
          <Text style={styles.heroTitle}>
            Assign farm orders to internal drivers or post to Farm2Driver.
          </Text>
          <Text style={styles.heroText}>
            Use internal drivers first for local customers. If no driver is
            available, make the job available on the driver board.
          </Text>
        </View>

        <View style={styles.flowCard}>
          <Text style={styles.flowTitle}>How delivery assignment works</Text>
          <FlowStep number="1" text="Customer places a farmer market order" />
          <FlowStep number="2" text="Delivery order appears here for your farm" />
          <FlowStep number="3" text="Assign an internal driver or post to Farm2Driver" />
          <FlowStep number="4" text="Track delivery and message the assigned driver" />
        </View>

        <View style={styles.statsRow}>
          <StatCard label="Drivers" value={String(summary.drivers)} icon="people-outline" />
          <StatCard label="Open Jobs" value={String(summary.open)} icon="cube-outline" />
          <StatCard label="Assigned" value={String(summary.assigned)} icon="checkmark-circle-outline" />
          <StatCard label="On Board" value={String(summary.availableBoard)} icon="trail-sign-outline" />
        </View>

        <View style={styles.card}>
          <SectionHeader
            title="Add Internal Driver"
            subtitle="Add trusted drivers who deliver directly for your farm."
          />

          <TextInput
            style={styles.input}
            placeholder="Driver name"
            placeholderTextColor="#8A9482"
            value={name}
            onChangeText={setName}
          />

          <TextInput
            style={styles.input}
            placeholder="Driver email"
            placeholderTextColor="#8A9482"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            style={styles.input}
            placeholder="Driver phone"
            placeholderTextColor="#8A9482"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <Pressable
            style={[styles.primaryButton, savingDriver && styles.disabledButton]}
            onPress={addDriver}
            disabled={savingDriver}
          >
            {savingDriver ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="person-add-outline" size={18} color={COLORS.white} />
                <Text style={styles.primaryButtonText}>Add Farm Driver</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.card}>
          <SectionHeader
            title="Active Farm Drivers"
            subtitle="Drivers available for local customer deliveries."
          />

          {drivers.length === 0 ? (
            <EmptyState
              emoji="🚚"
              title="No internal drivers yet"
              text="Add a driver above or post open deliveries to Farm2Driver."
            />
          ) : (
            drivers.map((driver) => (
              <View key={driver.id} style={styles.driverRow}>
                <View style={styles.driverInitialBox}>
                  <Text style={styles.driverInitial}>
                    {String(driver.driver_name || "D").slice(0, 1).toUpperCase()}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.driverName}>{driver.driver_name}</Text>
                  <Text style={styles.driverMeta}>
                    {driver.driver_email || "No email"} ·{" "}
                    {driver.driver_phone || "No phone"}
                  </Text>
                </View>

                <Pressable
                  style={styles.removeButton}
                  onPress={() => removeDriver(driver.id)}
                >
                  <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                </Pressable>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <SectionHeader
            title="Farmer Market Delivery Jobs"
            subtitle="Assign each delivery to a farm driver or make it available on Farm2Driver."
          />

          {jobs.length === 0 ? (
            <EmptyState
              emoji="📦"
              title="No delivery jobs yet"
              text="Customer delivery orders will appear here after checkout."
            />
          ) : (
            jobs.map((job) => {
              const assignedDriverId = job.driver_id || job.assigned_driver_id;
              const assignedDriverName =
                job.driver_name || job.assigned_driver_name || "";

              const isAssigned = Boolean(assignedDriverId || assignedDriverName);

              return (
                <View key={job.id} style={styles.jobCard}>
                  <View style={styles.jobHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.jobTitle}>
                        Delivery #{String(job.id).slice(-8)}
                      </Text>
                      <Text style={styles.jobMeta}>
                        Order: {job.order_id || "Not linked"}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusPill,
                        isAssigned && styles.statusPillAssigned,
                      ]}
                    >
                      <Text style={styles.statusPillText}>
                        {statusLabel(job.status)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.routeBox}>
                    <InfoLine
                      icon="person-outline"
                      label="Customer"
                      value={job.customer_name || "Customer"}
                    />
                    <InfoLine
                      icon="location-outline"
                      label="Pickup"
                      value={job.pickup_address || "Farm pickup location"}
                    />
                    <InfoLine
                      icon="flag-outline"
                      label="Dropoff"
                      value={job.dropoff_address || "Dropoff pending"}
                    />
                    <InfoLine
                      icon="car-outline"
                      label="Assigned Driver"
                      value={assignedDriverName || assignedDriverId || "Not assigned"}
                    />
                  </View>

                  <Text style={styles.assignTitle}>Assign Internal Driver</Text>

                  {drivers.length === 0 ? (
                    <Text style={styles.helperText}>
                      Add an internal driver or post this delivery to Farm2Driver.
                    </Text>
                  ) : (
                    <View style={styles.assignmentGrid}>
                      {drivers.map((driver) => (
                        <Pressable
                          key={`${job.id}-${driver.id}`}
                          style={styles.assignButton}
                          onPress={() => assignJobToDriver(job, driver)}
                        >
                          <Ionicons
                            name="checkmark-circle-outline"
                            size={16}
                            color={COLORS.white}
                          />
                          <Text style={styles.assignButtonText}>
                            {driver.driver_name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  <View style={styles.jobActions}>
                    <Pressable
                      style={styles.boardButton}
                      onPress={() => postJobToDriverBoard(job)}
                    >
                      <Ionicons name="trail-sign-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.boardButtonText}>Post to Farm2Driver</Text>
                    </Pressable>

                    <Pressable
                      style={styles.outlineButton}
                      onPress={() => openTracking(job)}
                    >
                      <Ionicons name="navigate-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.outlineButtonText}>Tracking</Text>
                    </Pressable>

                    <Pressable
                      style={styles.outlineButton}
                      onPress={() => openDriverChat(job)}
                    >
                      <Ionicons name="chatbox-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.outlineButtonText}>Chat</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <Pressable
          style={styles.darkButton}
          onPress={() => router.push("/farmer/delivery-orders" as any)}
        >
          <Ionicons name="cube-outline" size={18} color={COLORS.white} />
          <Text style={styles.darkButtonText}>View All Delivery Orders</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.sectionHeader}>
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
        <Ionicons name={icon} size={17} color={COLORS.primaryDark} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoLine({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoLine}>
      <Ionicons name={icon} size={17} color={COLORS.primary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function EmptyState({
  emoji,
  title,
  text,
}: {
  emoji: string;
  title: string;
  text: string;
}) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 90 },

  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  centerText: { marginTop: 10, color: COLORS.primary, fontWeight: "800" },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  eyebrow: {
    color: COLORS.primary,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontSize: 12,
  },
  title: { color: COLORS.text, fontWeight: "900", fontSize: 28, marginTop: 2 },
  subtitle: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },

  heroCard: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 28,
    padding: 20,
    marginBottom: 14,
  },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.16)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    color: COLORS.white,
    fontWeight: "900",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 10,
    fontSize: 12,
  },
  heroTitle: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 30,
  },
  heroText: {
    color: "#DCFCE7",
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 8,
  },

  flowCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  flowTitle: {
    color: COLORS.text,
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
    backgroundColor: COLORS.soft,
    color: COLORS.primaryDark,
    textAlign: "center",
    textAlignVertical: "center",
    fontWeight: "900",
    overflow: "hidden",
  },
  flowText: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "800",
    lineHeight: 19,
  },

  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flexGrow: 1,
    width: "47%",
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
    backgroundColor: COLORS.soft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 9,
  },
  statValue: { color: COLORS.primaryDark, fontWeight: "900", fontSize: 24 },
  statLabel: { color: COLORS.muted, fontWeight: "800", marginTop: 2 },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 14,
  },
  sectionHeader: { marginBottom: 12 },
  sectionTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 20,
  },
  sectionSub: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 4,
  },

  input: {
    backgroundColor: COLORS.soft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: COLORS.text,
    fontWeight: "800",
    marginBottom: 9,
  },

  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: { color: COLORS.white, fontWeight: "900" },
  disabledButton: { opacity: 0.7 },

  driverRow: {
    backgroundColor: COLORS.soft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 9,
    gap: 10,
  },
  driverInitialBox: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: COLORS.primaryDark,
    justifyContent: "center",
    alignItems: "center",
  },
  driverInitial: { color: COLORS.white, fontWeight: "900", fontSize: 18 },
  driverName: { color: COLORS.text, fontWeight: "900" },
  driverMeta: {
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 12,
    marginTop: 3,
  },
  removeButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.dangerSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  jobCard: {
    backgroundColor: COLORS.soft,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  jobHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  jobTitle: { color: COLORS.text, fontWeight: "900", fontSize: 18 },
  jobMeta: {
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 12,
    marginTop: 3,
  },
  statusPill: {
    backgroundColor: COLORS.dark,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillAssigned: {
    backgroundColor: COLORS.primary,
  },
  statusPillText: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 10,
    textTransform: "uppercase",
  },

  routeBox: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
  },
  infoLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 7,
  },
  infoLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 11 },
  infoValue: {
    color: COLORS.text,
    fontWeight: "800",
    marginTop: 2,
    lineHeight: 18,
  },

  assignTitle: {
    color: COLORS.text,
    fontWeight: "900",
    marginTop: 12,
    marginBottom: 8,
  },
  helperText: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
  },
  assignmentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  assignButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  assignButtonText: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 12,
  },

  jobActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  boardButton: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  boardButtonText: {
    color: COLORS.primary,
    fontWeight: "900",
    fontSize: 12,
  },
  outlineButton: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  outlineButtonText: {
    color: COLORS.primary,
    fontWeight: "900",
    fontSize: 12,
  },

  darkButton: {
    backgroundColor: COLORS.dark,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  darkButtonText: { color: COLORS.white, fontWeight: "900" },

  emptyState: {
    backgroundColor: COLORS.soft,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyEmoji: { fontSize: 38 },
  emptyTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 17,
    marginTop: 8,
  },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 5,
  },
});