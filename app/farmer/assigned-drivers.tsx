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
import { router } from "expo-router";
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
  dark: "#111827",
  blue: "#2563EB",
  danger: "#DC2626",
  orange: "#EF6C00",
};

export default function AssignedDriversScreen() {
  const [loading, setLoading] = useState(true);
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

  async function loadScreen() {
    try {
      setLoading(true);

      const saved =
        (await AsyncStorage.getItem("currentFarmer")) ||
        (await AsyncStorage.getItem("currentUser"));

      if (!saved) {
        router.replace("/farmer/login" as any);
        return;
      }

      const farmer = JSON.parse(saved);
      const id = farmer.id || farmer.farmerId;

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
      Alert.alert("Drivers Error", error?.message || "Unable to load assigned drivers.");
    } finally {
      setLoading(false);
    }
  }

  async function loadDrivers(id = farmerId) {
    const { data, error } = await supabase
      .from("farmer_internal_drivers")
      .select("*")
      .eq("farmer_id", id)
      .eq("active", true)
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
      const { error } = await supabase.from("farmer_internal_drivers").insert({
        farmer_id: farmerId,
        driver_name: name.trim(),
        driver_email: email.trim().toLowerCase(),
        driver_phone: phone.trim(),
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      setName("");
      setEmail("");
      setPhone("");
      await loadScreen();

      Alert.alert("Driver Added", "Internal driver was added.");
    } catch (error: any) {
      Alert.alert("Driver Error", error?.message || "Unable to add driver.");
    }
  }

  async function removeDriver(id: string) {
    try {
      await supabase
        .from("farmer_internal_drivers")
        .update({
          active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      await loadScreen();
    } catch (error: any) {
      Alert.alert("Remove Error", error?.message || "Unable to remove driver.");
    }
  }

  async function assignJobToDriver(job: any, driver: any) {
    try {
      const { error } = await supabase
        .from("delivery_orders")
        .update({
          driver_id: driver.driver_id || driver.id,
          assigned_driver_id: driver.driver_id || driver.id,
          driver_name: driver.driver_name,
          driver_email: driver.driver_email,
          status: "assigned",
          assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      if (error) throw error;

      await loadScreen();
      Alert.alert("Driver Assigned", `${driver.driver_name} was assigned to this delivery.`);
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
      Alert.alert("Posted", "Delivery is now available on the Farm2Driver board.");
    } catch (error: any) {
      Alert.alert("Post Error", error?.message || "Unable to post to driver board.");
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

  const summary = useMemo(() => {
    const assigned = jobs.filter((job) => job.driver_id || job.assigned_driver_id).length;
    const open = jobs.filter((job) => !job.driver_id && !job.assigned_driver_id).length;

    return {
      drivers: drivers.length,
      assigned,
      open,
    };
  }, [drivers, jobs]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.centerText}>Loading assigned drivers...</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Assigned Drivers</Text>
            <Text style={styles.subtitle}>{farmName} internal delivery operations</Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroBadge}>Driver Operations</Text>
          <Text style={styles.heroTitle}>Manage farm drivers and delivery assignments</Text>
          <Text style={styles.heroText}>
            Assign internal drivers first. If none are available, post the delivery to Farm2Driver.
          </Text>
        </View>

        <View style={styles.statsRow}>
          <StatCard label="Drivers" value={String(summary.drivers)} />
          <StatCard label="Assigned" value={String(summary.assigned)} />
          <StatCard label="Open Jobs" value={String(summary.open)} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Add Internal Driver</Text>

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

          <Pressable style={styles.primaryButton} onPress={addDriver}>
            <Text style={styles.primaryButtonText}>Add Driver</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Active Internal Drivers</Text>

          {drivers.length === 0 ? (
            <Text style={styles.emptyText}>No internal drivers added yet.</Text>
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
                    {driver.driver_email || "No email"} · {driver.driver_phone || "No phone"}
                  </Text>
                </View>

                <Pressable style={styles.removeButton} onPress={() => removeDriver(driver.id)}>
                  <Text style={styles.removeButtonText}>Remove</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Delivery Assignments</Text>

          {jobs.length === 0 ? (
            <Text style={styles.emptyText}>No delivery jobs found for this farm.</Text>
          ) : (
            jobs.map((job) => {
              const assignedDriverId = job.driver_id || job.assigned_driver_id;
              const assignedDriverName = job.driver_name || job.assigned_driver_name || "";

              return (
                <View key={job.id} style={styles.jobCard}>
                  <View style={styles.jobHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.jobTitle}>Delivery #{String(job.id).slice(-8)}</Text>
                      <Text style={styles.jobMeta}>Order: {job.order_id || "Not linked"}</Text>
                    </View>

                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillText}>
                        {String(job.status || "open").replace(/_/g, " ")}
                      </Text>
                    </View>
                  </View>

                  <InfoLine label="Customer" value={job.customer_name || "Customer"} />
                  <InfoLine label="Pickup" value={job.pickup_address || "Farm pickup location"} />
                  <InfoLine label="Dropoff" value={job.dropoff_address || "Dropoff pending"} />
                  <InfoLine
                    label="Assigned Driver"
                    value={assignedDriverName || assignedDriverId || "Not assigned"}
                  />

                  <View style={styles.assignmentGrid}>
                    {drivers.map((driver) => (
                      <Pressable
                        key={`${job.id}-${driver.id}`}
                        style={styles.assignButton}
                        onPress={() => assignJobToDriver(job, driver)}
                      >
                        <Text style={styles.assignButtonText}>
                          Assign {driver.driver_name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={styles.jobActions}>
                    <Pressable
                      style={styles.outlineButton}
                      onPress={() => postJobToDriverBoard(job)}
                    >
                      <Text style={styles.outlineButtonText}>Post to Farm2Driver</Text>
                    </Pressable>

                    <Pressable style={styles.outlineButton} onPress={() => openTracking(job)}>
                      <Text style={styles.outlineButtonText}>Tracking</Text>
                    </Pressable>

                    <Pressable style={styles.outlineButton} onPress={() => openDriverChat(job)}>
                      <Text style={styles.outlineButtonText}>Driver Chat</Text>
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
          <Text style={styles.darkButtonText}>View Delivery Orders</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 40 },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  centerText: { marginTop: 10, color: COLORS.primary, fontWeight: "800" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  backText: { fontSize: 28, fontWeight: "900", color: COLORS.text, marginTop: -4 },
  title: { color: COLORS.text, fontWeight: "900", fontSize: 24 },
  subtitle: { color: COLORS.muted, fontWeight: "700", fontSize: 12 },
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    color: "#FFFFFF",
    fontWeight: "900",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 10,
    fontSize: 12,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "900",
    lineHeight: 29,
  },
  heroText: {
    color: "#EAF7E6",
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 8,
  },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  statValue: { color: COLORS.primary, fontWeight: "900", fontSize: 20 },
  statLabel: { color: COLORS.muted, fontWeight: "800", fontSize: 11, marginTop: 3 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: { color: COLORS.text, fontWeight: "900", fontSize: 18, marginBottom: 10 },
  input: {
    backgroundColor: COLORS.soft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
    fontWeight: "700",
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "900" },
  emptyText: { color: COLORS.muted, fontWeight: "700", textAlign: "center" },
  driverRow: {
    backgroundColor: COLORS.soft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 10,
  },
  driverInitialBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: COLORS.primaryDark,
    justifyContent: "center",
    alignItems: "center",
  },
  driverInitial: { color: "#FFFFFF", fontWeight: "900", fontSize: 18 },
  driverName: { color: COLORS.text, fontWeight: "900" },
  driverMeta: { color: COLORS.muted, fontWeight: "700", fontSize: 12, marginTop: 3 },
  removeButton: {
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  removeButtonText: { color: "#991B1B", fontWeight: "900", fontSize: 12 },
  jobCard: {
    backgroundColor: COLORS.soft,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  jobHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  jobTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  jobMeta: { color: COLORS.muted, fontWeight: "700", fontSize: 12, marginTop: 3 },
  statusPill: {
    backgroundColor: COLORS.dark,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillText: { color: "#FFFFFF", fontWeight: "900", fontSize: 10 },
  infoLine: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 11 },
  infoValue: { color: COLORS.text, fontWeight: "800", marginTop: 3 },
  assignmentGrid: { gap: 8, marginTop: 10 },
  assignButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  assignButtonText: { color: "#FFFFFF", fontWeight: "900" },
  jobActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  outlineButton: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  outlineButtonText: { color: COLORS.primary, fontWeight: "900", fontSize: 12 },
  darkButton: {
    backgroundColor: COLORS.dark,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  darkButtonText: { color: "#FFFFFF", fontWeight: "900" },
});