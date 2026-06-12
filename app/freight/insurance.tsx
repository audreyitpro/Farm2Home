// app/freight/insurance.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
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
  dashboard: "/freight/dashboard",
  managementCenter: "/freight/freight-management-center",
  compliance: "/freight/compliance",
  complianceVault: "/freight/compliance-vault",
  reviewStatus: "/freight/review-status",
  businessDocuments: "/freight/business-documents",
  documents: "/freight/documents",
  safety: "/freight/safety",
  adminReview: "/freight/admin-review",
  support: "/freight/support",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];

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

function goTo(route: FreightRoute) {
  router.push(route as any);
}

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString();
}

function daysUntil(value?: string | null) {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;
  const diff = target.getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function FreightInsuranceScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");

  const [carrier, setCarrier] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);

  const [commercialCarrier, setCommercialCarrier] = useState("");
  const [commercialPolicyNumber, setCommercialPolicyNumber] = useState("");
  const [commercialExpiry, setCommercialExpiry] = useState("");
  const [cargoCarrier, setCargoCarrier] = useState("");
  const [cargoPolicyNumber, setCargoPolicyNumber] = useState("");
  const [cargoExpiry, setCargoExpiry] = useState("");
  const [insuranceConfirmed, setInsuranceConfirmed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadInsurance();
    }, [])
  );

  const insuranceStatus = useMemo(() => {
    const commercialDays = daysUntil(commercialExpiry);
    const cargoDays = daysUntil(cargoExpiry);

    const commercialUploaded = documents.some(
      (doc) => normalize(doc.document_type) === "commercial_auto_insurance"
    );

    const cargoUploaded = documents.some(
      (doc) => normalize(doc.document_type) === "cargo_insurance"
    );

    const expired =
      (commercialDays !== null && commercialDays < 0) ||
      (cargoDays !== null && cargoDays < 0);

    const expiringSoon =
      !expired &&
      ((commercialDays !== null && commercialDays <= 30) ||
        (cargoDays !== null && cargoDays <= 30));

    const complete =
      Boolean(commercialCarrier.trim()) &&
      Boolean(commercialPolicyNumber.trim()) &&
      Boolean(commercialExpiry.trim()) &&
      Boolean(cargoCarrier.trim()) &&
      Boolean(cargoPolicyNumber.trim()) &&
      Boolean(cargoExpiry.trim()) &&
      commercialUploaded &&
      cargoUploaded &&
      insuranceConfirmed &&
      !expired;

    return {
      commercialUploaded,
      cargoUploaded,
      commercialDays,
      cargoDays,
      expired,
      expiringSoon,
      complete,
    };
  }, [
    commercialCarrier,
    commercialPolicyNumber,
    commercialExpiry,
    cargoCarrier,
    cargoPolicyNumber,
    cargoExpiry,
    insuranceConfirmed,
    documents,
  ]);

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
      businessName:
        nextCarrier.businessName ||
        nextCarrier.companyName ||
        nextCarrier.business_name ||
        nextCarrier.company_name ||
        "Freight Connect Carrier",
      stripeAccountId:
        nextCarrier.stripeAccountId || nextCarrier.stripe_account_id || "",
      stripe_account_id:
        nextCarrier.stripe_account_id || nextCarrier.stripeAccountId || "",
    };

    await AsyncStorage.setItem("currentFreight", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentFreightUser", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentUser", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("userRole", "freight");
    await AsyncStorage.setItem("currentUserRole", "freight");

    setCarrier(normalizedCarrier);
    return normalizedCarrier;
  }

  async function loadInsurance() {
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

      if (error) console.log("Freight insurance profile error:", error.message);

      if (!dbCarrier) {
        Alert.alert(
          "Freight Profile Missing",
          "No freight profile was found. Please complete freight registration first."
        );
        router.replace(FREIGHT_ROUTES.register as any);
        return;
      }

      const mergedCarrier = await persistCarrier({
        ...(stored || {}),
        ...(dbCarrier || {}),
        id: dbCarrier.id,
        freightId: dbCarrier.id,
        role: "freight",
        email: normalize(dbCarrier.email || email),
        companyName:
          dbCarrier.company_name ||
          dbCarrier.business_name ||
          stored?.companyName ||
          stored?.businessName ||
          "Freight Connect Carrier",
        businessName:
          dbCarrier.business_name ||
          dbCarrier.company_name ||
          stored?.businessName ||
          stored?.companyName ||
          "Freight Connect Carrier",
      });

      setCommercialCarrier(dbCarrier.commercial_insurance_carrier || "");
      setCommercialPolicyNumber(dbCarrier.commercial_policy_number || "");
      setCommercialExpiry(dbCarrier.commercial_insurance_expiry || "");
      setCargoCarrier(dbCarrier.cargo_insurance_carrier || "");
      setCargoPolicyNumber(dbCarrier.cargo_policy_number || "");
      setCargoExpiry(dbCarrier.cargo_insurance_expiry || "");
      setInsuranceConfirmed(Boolean(dbCarrier.insurance_confirmed));

      const { data: docData, error: docError } = await supabase
        .from("freight_documents")
        .select("*")
        .eq("freight_id", mergedCarrier.id)
        .in("document_type", ["commercial_auto_insurance", "cargo_insurance"])
        .order("created_at", { ascending: false });

      if (docError) {
        console.log("Insurance documents error:", docError.message);
        setDocuments([]);
      } else {
        setDocuments(Array.isArray(docData) ? docData : []);
      }
    } catch (error: any) {
      Alert.alert("Insurance Error", error?.message || "Unable to load insurance.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadInsurance();
  }

  async function uploadInsuranceDocument(
    documentType: "commercial_auto_insurance" | "cargo_insurance"
  ) {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      return;
    }

    try {
      setUploading(documentType);

      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      const now = new Date().toISOString();

      const title =
        documentType === "commercial_auto_insurance"
          ? "Commercial Auto Insurance"
          : "Cargo Insurance";

      const existing = documents.find((doc) => doc.document_type === documentType);

      const payload = {
        freight_id: carrier.id,
        document_type: documentType,
        title,
        file_name: file.name || title,
        file_url: file.uri,
        storage_path: file.uri,
        mime_type: file.mimeType || null,
        size_bytes: file.size || null,
        status: "submitted",
        review_status: "pending_review",
        required: true,
        updated_at: now,
      };

      if (existing?.id) {
        const { error } = await supabase
          .from("freight_documents")
          .update(payload)
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("freight_documents").insert({
          ...payload,
          created_at: now,
        });

        if (error) throw error;
      }

      await supabase.from("freight_notifications").insert({
        freight_user_id: carrier.id,
        title: `${title} Uploaded`,
        message: `${title} was uploaded and is pending review.`,
        type: "insurance",
        is_read: false,
        created_at: now,
      });

      Alert.alert("Uploaded", `${title} was uploaded for review.`);
      await loadInsurance();
    } catch (error: any) {
      Alert.alert("Upload Error", error?.message || "Unable to upload insurance document.");
    } finally {
      setUploading("");
    }
  }

  async function saveInsurance() {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      return;
    }

    if (!commercialCarrier.trim() || !commercialPolicyNumber.trim() || !commercialExpiry.trim()) {
      Alert.alert(
        "Commercial Insurance Required",
        "Enter commercial auto carrier, policy number, and expiry date."
      );
      return;
    }

    if (!cargoCarrier.trim() || !cargoPolicyNumber.trim() || !cargoExpiry.trim()) {
      Alert.alert(
        "Cargo Insurance Required",
        "Enter cargo carrier, policy number, and expiry date."
      );
      return;
    }

    if (insuranceStatus.expired) {
      Alert.alert("Expired Insurance", "One or more insurance policies appears expired.");
      return;
    }

    if (!insuranceConfirmed) {
      Alert.alert("Confirmation Required", "Confirm that your insurance is active and accurate.");
      return;
    }

    try {
      setSaving(true);

      const now = new Date().toISOString();

      const payload = {
        commercial_insurance_carrier: commercialCarrier.trim(),
        commercial_policy_number: commercialPolicyNumber.trim(),
        commercial_insurance_expiry: commercialExpiry.trim(),
        cargo_insurance_carrier: cargoCarrier.trim(),
        cargo_policy_number: cargoPolicyNumber.trim(),
        cargo_insurance_expiry: cargoExpiry.trim(),
        insurance_confirmed: true,
        insurance_status: insuranceStatus.complete ? "complete" : "pending_documents",
        updated_at: now,
      };

      const { error } = await supabase
        .from("freight_users")
        .update(payload)
        .eq("id", carrier.id);

      if (error) throw error;

      await supabase.from("freight_notifications").insert({
        freight_user_id: carrier.id,
        title: "Insurance Saved",
        message:
          payload.insurance_status === "complete"
            ? "Your insurance profile is complete."
            : "Your insurance information was saved. Upload all required documents to complete review.",
        type: "insurance",
        is_read: false,
        created_at: now,
      });

      await persistCarrier({
        ...carrier,
        ...payload,
      });

      Alert.alert("Saved", "Freight insurance information has been saved.", [
        {
          text: "Review Status",
          onPress: () => router.replace(FREIGHT_ROUTES.reviewStatus as any),
        },
        {
          text: "Stay Here",
          style: "cancel",
        },
      ]);
    } catch (error: any) {
      Alert.alert("Save Error", error?.message || "Unable to save insurance information.");
    } finally {
      setSaving(false);
    }
  }

  function statusText() {
    if (insuranceStatus.complete) return "Insurance Complete";
    if (insuranceStatus.expired) return "Expired";
    if (insuranceStatus.expiringSoon) return "Expiring Soon";
    return "Action Required";
  }

  function statusColorValue() {
    if (insuranceStatus.complete) return COLORS.green;
    if (insuranceStatus.expired) return COLORS.red;
    if (insuranceStatus.expiringSoon) return COLORS.amber;
    return COLORS.blue;
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading freight insurance...</Text>
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
            <Text style={styles.title}>Insurance</Text>
            <Text style={styles.subtitle}>
              Track commercial auto insurance, cargo insurance, expiration dates, and uploaded proof.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.heroIcon}
            onPress={() => goTo(FREIGHT_ROUTES.complianceVault)}
            activeOpacity={0.85}
          >
            <Ionicons name="shield-checkmark-outline" size={34} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.carrierCard}>
          <View style={styles.avatar}>
            <Ionicons name="business-outline" size={28} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.carrierName}>
              {carrier?.companyName || carrier?.businessName || "Freight Connect Carrier"}
            </Text>
            <Text style={styles.carrierEmail}>{carrier?.email || "Carrier workspace"}</Text>

            <View style={[styles.statusPill, { backgroundColor: statusColorValue() }]}>
              <Text style={styles.statusPillText}>{statusText()}</Text>
            </View>
          </View>
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="shield-checkmark-outline" label="Compliance" route={FREIGHT_ROUTES.complianceVault} />
          <QuickLink icon="document-attach-outline" label="Documents" route={FREIGHT_ROUTES.businessDocuments} />
          <QuickLink icon="clipboard-outline" label="Admin Review" route={FREIGHT_ROUTES.adminReview} />
          <QuickLink icon="headset-outline" label="Support" route={FREIGHT_ROUTES.support} />
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="car-outline"
            title="Commercial Auto Insurance"
            subtitle="Required for freight movement using commercial vehicles."
          />

          <Label text="Insurance Carrier" />
          <TextInput
            style={styles.input}
            value={commercialCarrier}
            onChangeText={setCommercialCarrier}
            placeholder="Example: Progressive Commercial"
            placeholderTextColor="#94A3B8"
          />

          <Label text="Policy Number" />
          <TextInput
            style={styles.input}
            value={commercialPolicyNumber}
            onChangeText={setCommercialPolicyNumber}
            placeholder="Policy Number"
            placeholderTextColor="#94A3B8"
          />

          <Label text="Expiration Date" />
          <TextInput
            style={styles.input}
            value={commercialExpiry}
            onChangeText={setCommercialExpiry}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#94A3B8"
          />

          <InsuranceStatusRow
            uploaded={insuranceStatus.commercialUploaded}
            expires={commercialExpiry}
            days={insuranceStatus.commercialDays}
          />

          <TouchableOpacity
            style={[
              styles.uploadButton,
              uploading === "commercial_auto_insurance" && styles.disabledButton,
            ]}
            onPress={() => uploadInsuranceDocument("commercial_auto_insurance")}
            disabled={uploading === "commercial_auto_insurance"}
            activeOpacity={0.85}
          >
            {uploading === "commercial_auto_insurance" ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
                <Text style={styles.uploadText}>Upload Commercial Insurance</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="cube-outline"
            title="Cargo Insurance"
            subtitle="Required for freight goods, produce, livestock, and farm products."
          />

          <Label text="Insurance Carrier" />
          <TextInput
            style={styles.input}
            value={cargoCarrier}
            onChangeText={setCargoCarrier}
            placeholder="Cargo Insurance Carrier"
            placeholderTextColor="#94A3B8"
          />

          <Label text="Policy Number" />
          <TextInput
            style={styles.input}
            value={cargoPolicyNumber}
            onChangeText={setCargoPolicyNumber}
            placeholder="Policy Number"
            placeholderTextColor="#94A3B8"
          />

          <Label text="Expiration Date" />
          <TextInput
            style={styles.input}
            value={cargoExpiry}
            onChangeText={setCargoExpiry}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#94A3B8"
          />

          <InsuranceStatusRow
            uploaded={insuranceStatus.cargoUploaded}
            expires={cargoExpiry}
            days={insuranceStatus.cargoDays}
          />

          <TouchableOpacity
            style={[styles.uploadButton, uploading === "cargo_insurance" && styles.disabledButton]}
            onPress={() => uploadInsuranceDocument("cargo_insurance")}
            disabled={uploading === "cargo_insurance"}
            activeOpacity={0.85}
          >
            {uploading === "cargo_insurance" ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
                <Text style={styles.uploadText}>Upload Cargo Insurance</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="checkmark-circle-outline"
            title="Insurance Confirmation"
            subtitle="Confirm your policy information is active and accurate."
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>
              I confirm my insurance policies are active, current, and accurate.
            </Text>
            <Switch
              value={insuranceConfirmed}
              onValueChange={setInsuranceConfirmed}
              trackColor={{ false: "#CBD5E1", true: "#FCA5A5" }}
              thumbColor={insuranceConfirmed ? COLORS.red : "#FFFFFF"}
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.disabledButton]}
            onPress={saveInsurance}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryText}>Save Insurance</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.darkButton}
          onPress={() => goTo(FREIGHT_ROUTES.complianceVault)}
          activeOpacity={0.85}
        >
          <Ionicons name="shield-checkmark-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Back to Compliance Vault</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={20} color="#FFFFFF" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function InsuranceStatusRow({
  uploaded,
  expires,
  days,
}: {
  uploaded: boolean;
  expires: string;
  days: number | null;
}) {
  let expiryText = `Expires: ${formatDate(expires)}`;

  if (days !== null) {
    if (days < 0) expiryText = `Expired ${Math.abs(days)} days ago`;
    else expiryText = `Expires in ${days} days`;
  }

  return (
    <View style={styles.insuranceStatusBox}>
      <View style={styles.statusLine}>
        <Ionicons
          name={uploaded ? "checkmark-circle" : "alert-circle-outline"}
          size={19}
          color={uploaded ? COLORS.green : COLORS.amber}
        />
        <Text style={styles.statusLineText}>
          Document: {uploaded ? "Uploaded" : "Upload Required"}
        </Text>
      </View>

      <View style={styles.statusLine}>
        <Ionicons
          name={days !== null && days < 0 ? "close-circle-outline" : "calendar-outline"}
          size={19}
          color={days !== null && days < 0 ? COLORS.red : COLORS.blue}
        />
        <Text style={styles.statusLineText}>{expiryText}</Text>
      </View>
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
  route: FreightRoute;
}) {
  return (
    <TouchableOpacity style={styles.quickLink} onPress={() => goTo(route)} activeOpacity={0.85}>
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
    alignItems: "center",
    gap: 14,
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
  sectionHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 14,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900" },
  sectionSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 3 },
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
  insuranceStatusBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 13,
    marginBottom: 12,
  },
  statusLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 7,
  },
  statusLineText: { color: COLORS.text, fontWeight: "800", flex: 1 },
  uploadButton: {
    backgroundColor: COLORS.red,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  uploadText: { color: "#FFFFFF", fontWeight: "900" },
  switchRow: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  switchText: { color: COLORS.text, fontWeight: "900", flex: 1, lineHeight: 20 },
  primaryButton: {
    backgroundColor: COLORS.red,
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: { opacity: 0.6 },
  primaryText: { color: "#FFFFFF", fontWeight: "900" },
  darkButton: {
    backgroundColor: COLORS.black,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
});