// app/freight/maintenance-tracker.tsx
// Tracks vehicle maintenance, mileage, service dates, repair costs,
// and saves maintenance cost per mile for Cost Calculator / Rate Optimizer.

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import * as DocumentPicker from "expo-document-picker";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const FREIGHT_ROUTES = {
  managementCenter: "/freight/freight-management-center",
  costCalculator: "/freight/cost-calculator",
  rateOptimizer: "/freight/rate-optimizer",
  equipment: "/freight/equipment",
  support: "/freight/support",
  login: "/freight/login",
  register: "/freight/register",
} as const;

const COLORS = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  amber: "#D97706",
  blue: "#2563EB",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function money(value: any) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function goTo(route: string) {
  router.push(route as any);
}

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
}

export default function FreightMaintenanceTrackerScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);

  const [currentMileage, setCurrentMileage] = useState("");
  const [nextServiceMileage, setNextServiceMileage] = useState("");
  const [nextServiceDate, setNextServiceDate] = useState("");
  const [maintenancePerMile, setMaintenancePerMile] = useState("0.18");

  const [serviceType, setServiceType] = useState("");
  const [serviceCost, setServiceCost] = useState("");
  const [serviceMileage, setServiceMileage] = useState("");
  const [serviceNotes, setServiceNotes] = useState("");
  const [receiptUri, setReceiptUri] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadMaintenance();
    }, [])
  );

  const stats = useMemo(() => {
    const totalCost = records.reduce((sum, item) => sum + Number(item.service_cost || 0), 0);
    const avgCost = records.length ? totalCost / records.length : 0;

    const current = Number(currentMileage) || 0;
    const next = Number(nextServiceMileage) || 0;
    const milesUntilService = next && current ? next - current : null;

    return {
      totalRecords: records.length,
      totalCost,
      avgCost,
      milesUntilService,
      maintenancePerMile: Number(maintenancePerMile) || 0,
    };
  }, [records, currentMileage, nextServiceMileage, maintenancePerMile]);

  async function getStoredCarrier() {
    const raw =
      (await AsyncStorage.getItem("currentFreightCarrier")) ||
      (await AsyncStorage.getItem("currentFreight")) ||
      (await AsyncStorage.getItem("currentFreightUser")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function persistCarrier(nextCarrier: any) {
    const normalizedCarrier = {
      ...nextCarrier,
      id: nextCarrier.id || nextCarrier.freightId,
      freightId: nextCarrier.freightId || nextCarrier.id,
      role: "freight",
      email: normalize(nextCarrier.email),
      companyName:
        nextCarrier.companyName ||
        nextCarrier.businessName ||
        nextCarrier.company_name ||
        nextCarrier.business_name ||
        "Freight Connect Carrier",
    };

    await AsyncStorage.setItem("currentFreight", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentFreightUser", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentUser", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("userRole", "freight");
    await AsyncStorage.setItem("currentUserRole", "freight");

    setCarrier(normalizedCarrier);
  }

  async function loadMaintenance() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();
      const email = normalize(stored?.email || authData?.user?.email || "");

      if (!email) {
        router.replace(FREIGHT_ROUTES.login as any);
        return;
      }

      const { data: dbCarrier, error } = await supabase
        .from("freight_users")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (error) console.log("Maintenance tracker carrier error:", error.message);

      if (!dbCarrier) {
        Alert.alert("Freight Profile Missing", "Please complete freight registration first.");
        router.replace(FREIGHT_ROUTES.register as any);
        return;
      }

      await persistCarrier({
        ...(stored || {}),
        ...(dbCarrier || {}),
        id: dbCarrier.id,
        freightId: dbCarrier.id,
        email: normalize(dbCarrier.email || email),
        companyName:
          dbCarrier.company_name ||
          dbCarrier.business_name ||
          stored?.companyName ||
          stored?.businessName ||
          "Freight Connect Carrier",
      });

      setCurrentMileage(dbCarrier.current_mileage ? String(dbCarrier.current_mileage) : "");
      setNextServiceMileage(
        dbCarrier.next_service_mileage ? String(dbCarrier.next_service_mileage) : ""
      );
      setNextServiceDate(dbCarrier.next_service_date || "");
      setMaintenancePerMile(
        dbCarrier.maintenance_per_mile ? String(dbCarrier.maintenance_per_mile) : "0.18"
      );

      const { data: maintenanceRecords, error: recordsError } = await supabase
        .from("freight_maintenance_records")
        .select("*")
        .eq("freight_id", dbCarrier.id)
        .order("created_at", { ascending: false });

      if (recordsError) {
        console.log("Maintenance records error:", recordsError.message);
        setRecords([]);
      } else {
        setRecords(Array.isArray(maintenanceRecords) ? maintenanceRecords : []);
      }
    } catch (error: any) {
      Alert.alert("Maintenance Error", error?.message || "Unable to load maintenance tracker.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadMaintenance();
  }

  async function uploadReceipt() {
    try {
      setUploading(true);

      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      setReceiptUri(result.assets[0].uri);
      Alert.alert("Receipt Added", result.assets[0].name || "Maintenance receipt selected.");
    } catch (error: any) {
      Alert.alert("Upload Error", error?.message || "Unable to select maintenance receipt.");
    } finally {
      setUploading(false);
    }
  }

  async function saveDefaults() {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      return;
    }

    try {
      setSaving(true);

      const now = new Date().toISOString();

      const payload = {
        current_mileage: Number(currentMileage) || null,
        next_service_mileage: Number(nextServiceMileage) || null,
        next_service_date: nextServiceDate.trim() || null,
        maintenance_per_mile: Number(maintenancePerMile) || null,
        maintenance_settings_updated_at: now,
        updated_at: now,
      };

      const { error } = await supabase.from("freight_users").update(payload).eq("id", carrier.id);

      if (error) throw error;

      await persistCarrier({ ...carrier, ...payload });

      Alert.alert("Saved", "Maintenance defaults were saved.");
    } catch (error: any) {
      Alert.alert("Save Error", error?.message || "Unable to save maintenance defaults.");
    } finally {
      setSaving(false);
    }
  }

  async function addMaintenanceRecord() {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      return;
    }

    if (!serviceType.trim() || !serviceCost.trim()) {
      Alert.alert("Missing Service", "Enter service type and service cost.");
      return;
    }

    try {
      setSaving(true);

      const now = new Date().toISOString();

      const { error } = await supabase.from("freight_maintenance_records").insert({
        freight_id: carrier.id,
        carrier_id: carrier.id,
        service_type: serviceType.trim(),
        service_cost: Number(serviceCost) || 0,
        service_mileage: Number(serviceMileage) || null,
        service_notes: serviceNotes.trim() || null,
        receipt_url: receiptUri || null,
        created_at: now,
        updated_at: now,
      });

      if (error) throw error;

      setServiceType("");
      setServiceCost("");
      setServiceMileage("");
      setServiceNotes("");
      setReceiptUri("");

      Alert.alert("Saved", "Maintenance record was added.");
      await loadMaintenance();
    } catch (error: any) {
      Alert.alert(
        "Record Save Error",
        error?.message ||
          "Unable to save maintenance record. Make sure freight_maintenance_records table exists."
      );
    } finally {
      setSaving(false);
    }
  }

  function serviceStatusColor() {
    if (stats.milesUntilService === null) return COLORS.blue;
    if (stats.milesUntilService <= 0) return COLORS.red;
    if (stats.milesUntilService <= 500) return COLORS.amber;
    return COLORS.green;
  }

  function serviceStatusText() {
    if (stats.milesUntilService === null) return "Service Tracking";
    if (stats.milesUntilService <= 0) return "Service Due";
    if (stats.milesUntilService <= 500) return "Service Soon";
    return "Service Current";
  }

  function renderRecord({ item }: { item: any }) {
    return (
      <View style={styles.recordCard}>
        <View style={styles.recordTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.recordTitle}>{item.service_type || "Maintenance Service"}</Text>
            <Text style={styles.recordSub}>
              Mileage: {item.service_mileage || "Not recorded"} · {formatDate(item.created_at)}
            </Text>
          </View>

          <Text style={styles.recordCost}>{money(item.service_cost)}</Text>
        </View>

        {!!item.service_notes && <Text style={styles.recordNotes}>{item.service_notes}</Text>}

        {!!item.receipt_url && (
          <View style={styles.receiptLine}>
            <Ionicons name="document-text-outline" size={18} color={COLORS.green} />
            <Text style={styles.receiptLineText}>Receipt attached</Text>
          </View>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading maintenance tracker...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Farm2Home Freight Connect</Text>
            <Text style={styles.title}>Maintenance Tracker</Text>
            <Text style={styles.subtitle}>
              Track vehicle maintenance, service mileage, repair costs, receipts, and maintenance cost per mile.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.costCalculator)}>
            <Ionicons name="construct-outline" size={34} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.carrierCard}>
          <View style={styles.avatar}>
            <Ionicons name="business-outline" size={28} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.carrierName}>{carrier?.companyName || "Freight Connect Carrier"}</Text>
            <Text style={styles.carrierEmail}>{carrier?.email || "Carrier workspace"}</Text>

            <View style={[styles.statusPill, { backgroundColor: serviceStatusColor() }]}>
              <Text style={styles.statusPillText}>{serviceStatusText()}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Records" value={String(stats.totalRecords)} icon="receipt-outline" />
          <StatCard label="Total Cost" value={money(stats.totalCost)} icon="cash-outline" />
          <StatCard label="Avg Service" value={money(stats.avgCost)} icon="analytics-outline" />
          <StatCard label="Maint/Mile" value={money(stats.maintenancePerMile)} icon="speedometer-outline" />
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="calculator-outline" label="Cost Calculator" route={FREIGHT_ROUTES.costCalculator} />
          <QuickLink icon="analytics-outline" label="Rate Optimizer" route={FREIGHT_ROUTES.rateOptimizer} />
          <QuickLink icon="car-outline" label="Equipment" route={FREIGHT_ROUTES.equipment} />
          <QuickLink icon="headset-outline" label="Support" route={FREIGHT_ROUTES.support} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Maintenance Defaults</Text>

          <Input label="Current Mileage" value={currentMileage} onChangeText={setCurrentMileage} />
          <Input label="Next Service Mileage" value={nextServiceMileage} onChangeText={setNextServiceMileage} />
          <Input
            label="Next Service Date"
            value={nextServiceDate}
            onChangeText={setNextServiceDate}
            numeric={false}
            placeholder="YYYY-MM-DD"
          />
          <Input
            label="Maintenance Cost Per Mile"
            value={maintenancePerMile}
            onChangeText={setMaintenancePerMile}
          />

          {stats.milesUntilService !== null && (
            <View style={styles.serviceBox}>
              <Ionicons name="speedometer-outline" size={20} color={serviceStatusColor()} />
              <Text style={styles.serviceText}>
                {stats.milesUntilService <= 0
                  ? `Service is due by ${Math.abs(stats.milesUntilService)} miles.`
                  : `${stats.milesUntilService} miles until next service.`}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButtonInner, saving && styles.disabledButton]}
            onPress={saveDefaults}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryText}>Save Maintenance Defaults</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add Maintenance Record</Text>

          <Input
            label="Service Type"
            value={serviceType}
            onChangeText={setServiceType}
            numeric={false}
            placeholder="Oil change, tires, brakes, repair"
          />
          <Input label="Service Cost" value={serviceCost} onChangeText={setServiceCost} />
          <Input label="Service Mileage" value={serviceMileage} onChangeText={setServiceMileage} />
          <Input
            label="Service Notes"
            value={serviceNotes}
            onChangeText={setServiceNotes}
            numeric={false}
            placeholder="Notes"
            multiline
          />

          <View style={styles.receiptBox}>
            <Ionicons
              name={receiptUri ? "document-text-outline" : "document-outline"}
              size={22}
              color={receiptUri ? COLORS.green : COLORS.amber}
            />
            <Text style={styles.receiptText}>
              {receiptUri ? "Receipt selected" : "No receipt selected"}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.outlineButton, uploading && styles.disabledButton]}
            onPress={uploadReceipt}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color={COLORS.red} />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color={COLORS.red} />
                <Text style={styles.outlineText}>Upload Maintenance Receipt</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButtonInner, saving && styles.disabledButton]}
            onPress={addMaintenanceRecord}
            disabled={saving}
          >
            <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryText}>Add Maintenance Record</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Maintenance History</Text>

        <FlatList
          data={records}
          keyExtractor={(item, index) => String(item.id || index)}
          scrollEnabled={false}
          renderItem={renderRecord}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="construct-outline" size={38} color={COLORS.red} />
              <Text style={styles.emptyTitle}>No maintenance records yet.</Text>
              <Text style={styles.emptyText}>
                Add oil changes, tire service, repairs, inspections, and other vehicle costs here.
              </Text>
            </View>
          }
        />

        <TouchableOpacity style={styles.primaryButton} onPress={() => goTo(FREIGHT_ROUTES.costCalculator)}>
          <Ionicons name="calculator-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Open Cost Calculator</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.darkButton} onPress={() => goTo(FREIGHT_ROUTES.managementCenter)}>
          <Ionicons name="apps-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Management Center</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Input({
  label,
  value,
  onChangeText,
  numeric = true,
  placeholder = "0.00",
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  numeric?: boolean;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.textArea]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={numeric ? "numeric" : "default"}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
      />
    </>
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
      <Ionicons name={icon} size={22} color={COLORS.red} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickLink({
  icon,
  label,
  route,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: string;
}) {
  return (
    <TouchableOpacity style={styles.quickLink} onPress={() => goTo(route)}>
      <Ionicons name={icon} size={22} color={COLORS.red} />
      <Text style={styles.quickText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 90 },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  centerText: { color: COLORS.muted, marginTop: 12, fontWeight: "800" },
  hero: {
    backgroundColor: COLORS.black,
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 30,
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 24,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    color: "#FCA5A5",
    fontWeight: "900",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
  },
  title: { color: "#FFFFFF", fontSize: 32, fontWeight: "900", marginBottom: 10 },
  subtitle: { color: "#D1D5DB", lineHeight: 22, fontWeight: "700" },
  carrierCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  carrierName: { color: COLORS.text, fontSize: 19, fontWeight: "900" },
  carrierEmail: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 9,
  },
  statusPillText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  statCard: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: { color: COLORS.text, fontSize: 22, fontWeight: "900", marginTop: 7 },
  statLabel: { color: COLORS.muted, fontWeight: "800", marginTop: 4 },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  quickLink: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    gap: 8,
  },
  quickText: { color: COLORS.text, fontWeight: "900", textAlign: "center" },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900", marginBottom: 12 },
  label: { color: COLORS.text, fontWeight: "900", marginBottom: 7, marginTop: 8 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    color: COLORS.text,
    fontWeight: "700",
    marginBottom: 12,
  },
  textArea: { minHeight: 90 },
  serviceBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  serviceText: { color: COLORS.text, fontWeight: "900", flex: 1 },
  receiptBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  receiptText: { color: COLORS.text, fontWeight: "900" },
  primaryButtonInner: {
    backgroundColor: COLORS.red,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  outlineButton: {
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  outlineText: { color: COLORS.red, fontWeight: "900" },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  recordCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  recordTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  recordTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  recordSub: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  recordCost: { color: COLORS.red, fontSize: 18, fontWeight: "900" },
  recordNotes: { color: COLORS.text, fontWeight: "700", lineHeight: 20, marginTop: 10 },
  receiptLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  receiptLineText: { color: COLORS.green, fontWeight: "900" },
  emptyCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900", marginTop: 10 },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: COLORS.red,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  darkButton: {
    backgroundColor: COLORS.black,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: { opacity: 0.6 },
  primaryText: { color: "#FFFFFF", fontWeight: "900" },
});