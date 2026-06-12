// app/freight/carrier-certifications.tsx

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
  documents: "/freight/documents",
  insurance: "/freight/insurance",
  equipment: "/freight/equipment",
  safety: "/freight/safety",
  adminReview: "/freight/admin-review",
  support: "/freight/support",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];

type CertificationKey =
  | "twic_certified"
  | "tsa_certified"
  | "medical_logistics_certified"
  | "refrigerated_certified"
  | "livestock_certified"
  | "food_safety_certified";

type CertificationItem = {
  key: CertificationKey;
  title: string;
  description: string;
  documentType: string;
};

const CERTIFICATIONS: CertificationItem[] = [
  {
    key: "twic_certified",
    title: "TWIC Credential",
    description: "Transportation Worker Identification Credential for port or secured freight access.",
    documentType: "twic_credential",
  },
  {
    key: "tsa_certified",
    title: "TSA / Airport Freight",
    description: "Credential or authorization for airport, air cargo, or secured logistics work.",
    documentType: "tsa_airport_credential",
  },
  {
    key: "medical_logistics_certified",
    title: "Medical Logistics",
    description: "HIPAA, specimen, pharmacy, medical courier, or healthcare logistics credential.",
    documentType: "medical_logistics_credential",
  },
  {
    key: "refrigerated_certified",
    title: "Refrigerated / Cold-Chain",
    description: "Proof of refrigeration equipment, temperature monitoring, or cold-chain capability.",
    documentType: "refrigerated_vehicle_proof",
  },
  {
    key: "livestock_certified",
    title: "Livestock Transport",
    description: "Permit, equipment proof, or documentation for livestock or farm animal transport.",
    documentType: "livestock_transport_permit",
  },
  {
    key: "food_safety_certified",
    title: "Food Safety Handling",
    description: "Food handling, produce logistics, or safe farm product transport training.",
    documentType: "food_safety_credential",
  },
];

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

export default function FreightCarrierCertificationsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState("");

  const [carrier, setCarrier] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);

  const [certifications, setCertifications] = useState<Record<CertificationKey, boolean>>({
    twic_certified: false,
    tsa_certified: false,
    medical_logistics_certified: false,
    refrigerated_certified: false,
    livestock_certified: false,
    food_safety_certified: false,
  });

  const [certificationNumbers, setCertificationNumbers] = useState<Record<CertificationKey, string>>({
    twic_certified: "",
    tsa_certified: "",
    medical_logistics_certified: "",
    refrigerated_certified: "",
    livestock_certified: "",
    food_safety_certified: "",
  });

  const [expirationDates, setExpirationDates] = useState<Record<CertificationKey, string>>({
    twic_certified: "",
    tsa_certified: "",
    medical_logistics_certified: "",
    refrigerated_certified: "",
    livestock_certified: "",
    food_safety_certified: "",
  });

  useFocusEffect(
    useCallback(() => {
      loadCertifications();
    }, [])
  );

  const stats = useMemo(() => {
    const activeCount = CERTIFICATIONS.filter((item) => certifications[item.key]).length;
    const uploadedCount = CERTIFICATIONS.filter((item) => getDocument(item.documentType)).length;

    const expiringSoon = CERTIFICATIONS.filter((item) => {
      const days = daysUntil(expirationDates[item.key]);
      return days !== null && days >= 0 && days <= 30;
    }).length;

    const expired = CERTIFICATIONS.filter((item) => {
      const days = daysUntil(expirationDates[item.key]);
      return days !== null && days < 0;
    }).length;

    return {
      activeCount,
      uploadedCount,
      expiringSoon,
      expired,
    };
  }, [certifications, documents, expirationDates]);

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

  async function loadCertifications() {
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

      if (error) console.log("Carrier certifications profile error:", error.message);

      if (!dbCarrier) {
        Alert.alert("Freight Profile Missing", "Please complete freight registration first.");
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
      });

      setCertifications({
        twic_certified: Boolean(dbCarrier.twic_certified),
        tsa_certified: Boolean(dbCarrier.tsa_certified),
        medical_logistics_certified: Boolean(dbCarrier.medical_logistics_certified),
        refrigerated_certified: Boolean(dbCarrier.refrigerated_certified || dbCarrier.refrigerated_capable),
        livestock_certified: Boolean(dbCarrier.livestock_certified || dbCarrier.livestock_capable),
        food_safety_certified: Boolean(dbCarrier.food_safety_certified),
      });

      setCertificationNumbers({
        twic_certified: dbCarrier.twic_number || "",
        tsa_certified: dbCarrier.tsa_number || "",
        medical_logistics_certified: dbCarrier.medical_logistics_number || "",
        refrigerated_certified: dbCarrier.refrigerated_certification_number || "",
        livestock_certified: dbCarrier.livestock_permit_number || "",
        food_safety_certified: dbCarrier.food_safety_number || "",
      });

      setExpirationDates({
        twic_certified: dbCarrier.twic_expiry || "",
        tsa_certified: dbCarrier.tsa_expiry || "",
        medical_logistics_certified: dbCarrier.medical_logistics_expiry || "",
        refrigerated_certified: dbCarrier.refrigerated_certification_expiry || "",
        livestock_certified: dbCarrier.livestock_permit_expiry || "",
        food_safety_certified: dbCarrier.food_safety_expiry || "",
      });

      const docTypes = CERTIFICATIONS.map((item) => item.documentType);

      const { data: docData, error: docError } = await supabase
        .from("freight_documents")
        .select("*")
        .eq("freight_id", mergedCarrier.id)
        .in("document_type", docTypes)
        .order("updated_at", { ascending: false });

      if (docError) {
        console.log("Carrier certification docs error:", docError.message);
        setDocuments([]);
      } else {
        setDocuments(Array.isArray(docData) ? docData : []);
      }
    } catch (error: any) {
      Alert.alert("Certifications Error", error?.message || "Unable to load carrier certifications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadCertifications();
  }

  function getDocument(documentType: string) {
    return documents.find((doc) => doc.document_type === documentType);
  }

  function setCertificationValue(key: CertificationKey, value: boolean) {
    setCertifications((prev) => ({ ...prev, [key]: value }));
  }

  function setCertificationNumber(key: CertificationKey, value: string) {
    setCertificationNumbers((prev) => ({ ...prev, [key]: value }));
  }

  function setExpirationValue(key: CertificationKey, value: string) {
    setExpirationDates((prev) => ({ ...prev, [key]: value }));
  }

  async function uploadCredential(item: CertificationItem) {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      return;
    }

    try {
      setUploadingKey(item.key);

      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      const now = new Date().toISOString();
      const existing = getDocument(item.documentType);

      const payload = {
        freight_id: carrier.id,
        document_type: item.documentType,
        title: item.title,
        file_name: file.name || item.title,
        file_url: file.uri,
        storage_path: file.uri,
        mime_type: file.mimeType || null,
        size_bytes: file.size || null,
        status: "submitted",
        review_status: "pending_review",
        required: false,
        updated_at: now,
      };

      if (existing?.id) {
        const { error } = await supabase
          .from("freight_documents")
          .update(payload)
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("freight_documents")
          .insert({
            ...payload,
            created_at: now,
          });

        if (error) throw error;
      }

      Alert.alert("Uploaded", `${item.title} document was uploaded for review.`);
      await loadCertifications();
    } catch (error: any) {
      Alert.alert("Upload Error", error?.message || "Unable to upload certification document.");
    } finally {
      setUploadingKey("");
    }
  }

  async function saveCertifications() {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      return;
    }

    try {
      setSaving(true);

      const now = new Date().toISOString();

      const payload = {
        twic_certified: certifications.twic_certified,
        tsa_certified: certifications.tsa_certified,
        medical_logistics_certified: certifications.medical_logistics_certified,
        refrigerated_certified: certifications.refrigerated_certified,
        refrigerated_capable: certifications.refrigerated_certified,
        livestock_certified: certifications.livestock_certified,
        livestock_capable: certifications.livestock_certified,
        food_safety_certified: certifications.food_safety_certified,

        twic_number: certificationNumbers.twic_certified.trim() || null,
        tsa_number: certificationNumbers.tsa_certified.trim() || null,
        medical_logistics_number:
          certificationNumbers.medical_logistics_certified.trim() || null,
        refrigerated_certification_number:
          certificationNumbers.refrigerated_certified.trim() || null,
        livestock_permit_number: certificationNumbers.livestock_certified.trim() || null,
        food_safety_number: certificationNumbers.food_safety_certified.trim() || null,

        twic_expiry: expirationDates.twic_certified.trim() || null,
        tsa_expiry: expirationDates.tsa_certified.trim() || null,
        medical_logistics_expiry: expirationDates.medical_logistics_certified.trim() || null,
        refrigerated_certification_expiry: expirationDates.refrigerated_certified.trim() || null,
        livestock_permit_expiry: expirationDates.livestock_certified.trim() || null,
        food_safety_expiry: expirationDates.food_safety_certified.trim() || null,

        certifications_updated_at: now,
        updated_at: now,
      };

      const { error } = await supabase.from("freight_users").update(payload).eq("id", carrier.id);

      if (error) throw error;

      await persistCarrier({
        ...carrier,
        ...payload,
      });

      Alert.alert("Saved", "Carrier certifications were saved.");
    } catch (error: any) {
      Alert.alert("Save Error", error?.message || "Unable to save carrier certifications.");
    } finally {
      setSaving(false);
    }
  }

  function statusForCertification(item: CertificationItem) {
    const enabled = certifications[item.key];
    const doc = getDocument(item.documentType);
    const days = daysUntil(expirationDates[item.key]);

    if (!enabled) return { label: "Not Active", color: COLORS.blue };
    if (days !== null && days < 0) return { label: "Expired", color: COLORS.red };
    if (days !== null && days <= 30) return { label: "Expiring Soon", color: COLORS.amber };
    if (doc) return { label: "Submitted", color: COLORS.green };

    return { label: "Needs Proof", color: COLORS.amber };
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading carrier certifications...</Text>
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
            <Text style={styles.title}>Carrier Certifications</Text>
            <Text style={styles.subtitle}>
              Track TWIC, TSA, medical logistics, refrigerated, livestock, and specialty freight credentials.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.compliance)}>
            <Ionicons name="ribbon-outline" size={34} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.carrierCard}>
          <View style={styles.avatar}>
            <Ionicons name="business-outline" size={28} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.carrierName}>{carrier?.companyName || "Freight Connect Carrier"}</Text>
            <Text style={styles.carrierEmail}>{carrier?.email || "Carrier workspace"}</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Active" value={String(stats.activeCount)} icon="checkmark-circle-outline" />
          <StatCard label="Uploaded Proof" value={String(stats.uploadedCount)} icon="document-attach-outline" />
          <StatCard label="Expiring Soon" value={String(stats.expiringSoon)} icon="time-outline" />
          <StatCard label="Expired" value={String(stats.expired)} icon="alert-circle-outline" />
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="shield-checkmark-outline" label="Compliance" route={FREIGHT_ROUTES.compliance} />
          <QuickLink icon="document-attach-outline" label="Documents" route={FREIGHT_ROUTES.documents} />
          <QuickLink icon="car-outline" label="Equipment" route={FREIGHT_ROUTES.equipment} />
          <QuickLink icon="headset-outline" label="Support" route={FREIGHT_ROUTES.support} />
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Credential Review</Text>
          <Text style={styles.noticeText}>
            Specialty credentials are optional unless required for a load type. Upload proof for
            specialty services before accepting restricted freight.
          </Text>
        </View>

        {CERTIFICATIONS.map((item) => {
          const doc = getDocument(item.documentType);
          const status = statusForCertification(item);
          const uploading = uploadingKey === item.key;

          return (
            <View key={item.key} style={styles.card}>
              <View style={styles.certTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.certTitle}>{item.title}</Text>
                  <Text style={styles.certDescription}>{item.description}</Text>
                </View>

                <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
                  <Text style={styles.statusText}>{status.label}</Text>
                </View>
              </View>

              <SwitchRow
                label={`I have ${item.title}`}
                value={certifications[item.key]}
                onChange={(value) => setCertificationValue(item.key, value)}
              />

              {certifications[item.key] && (
                <>
                  <Label text="Credential / Permit Number Optional" />
                  <TextInput
                    style={styles.input}
                    value={certificationNumbers[item.key]}
                    onChangeText={(value) => setCertificationNumber(item.key, value)}
                    placeholder="Enter credential number"
                    placeholderTextColor="#94A3B8"
                  />

                  <Label text="Expiration Date Optional" />
                  <TextInput
                    style={styles.input}
                    value={expirationDates[item.key]}
                    onChangeText={(value) => setExpirationValue(item.key, value)}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                  />

                  <View style={styles.docBox}>
                    <Ionicons
                      name={doc ? "document-text-outline" : "document-outline"}
                      size={22}
                      color={doc ? COLORS.green : COLORS.amber}
                    />

                    <View style={{ flex: 1 }}>
                      <Text style={styles.docTitle}>
                        {doc ? doc.file_name || doc.title || item.title : "No proof uploaded"}
                      </Text>
                      <Text style={styles.docSub}>
                        {doc
                          ? `Status: ${doc.review_status || doc.status || "submitted"}`
                          : "Upload proof if required for specialty freight."}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.uploadButton, uploading && styles.disabledButton]}
                    onPress={() => uploadCredential(item)}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.uploadText}>
                          {doc ? "Replace Proof" : "Upload Proof"}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          );
        })}

        <TouchableOpacity
          style={[styles.primaryButton, saving && styles.disabledButton]}
          onPress={saveCertifications}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="save-outline" size={18} color="#FFFFFF" />
              <Text style={styles.primaryText}>Save Certifications</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.darkButton} onPress={() => goTo(FREIGHT_ROUTES.compliance)}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Back to Compliance</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function SwitchRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchText}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#CBD5E1", true: "#FCA5A5" }}
        thumbColor={value ? COLORS.red : "#FFFFFF"}
      />
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
  route: FreightRoute;
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
  notice: {
    backgroundColor: COLORS.black,
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 22,
    padding: 18,
  },
  noticeTitle: { color: "#FFFFFF", fontSize: 21, fontWeight: "900", marginBottom: 7 },
  noticeText: { color: "#D1D5DB", fontWeight: "700", lineHeight: 22 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  certTop: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 12,
  },
  certTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  certDescription: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 5 },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: 125,
  },
  statusText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
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
  docBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  docTitle: { color: COLORS.text, fontWeight: "900" },
  docSub: { color: COLORS.muted, fontWeight: "700", marginTop: 3 },
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
  primaryButton: {
    backgroundColor: COLORS.red,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 4,
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