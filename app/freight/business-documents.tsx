// app/freight/business-documents.tsx

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
  compliance: "/freight/compliance",
  documents: "/freight/documents",
  insurance: "/freight/insurance",
  taxCenter: "/freight/tax-center",
  reportExport: "/freight/report-export",
  adminReview: "/freight/admin-review",
  support: "/freight/support",
  login: "/freight/login",
  register: "/freight/register",
} as const;

const DOCUMENT_TYPES = [
  "Business License",
  "W-9",
  "EIN Letter",
  "Articles of Organization",
  "Operating Agreement",
  "Commercial Insurance",
  "Cargo Insurance",
  "Vehicle Registration",
  "Tax Summary",
  "Report Export",
  "Compliance Record",
  "Other",
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

function goTo(route: string) {
  router.push(route as any);
}

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
}

function documentTypeKey(value: string) {
  return normalize(value).replace(/\s+/g, "_").replace(/-/g, "_");
}

export default function FreightBusinessDocumentsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);

  const [documentType, setDocumentType] = useState("Business License");
  const [documentTitle, setDocumentTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      loadBusinessDocuments();
    }, [])
  );

  const stats = useMemo(() => {
    const requiredKeys = [
      "business_license",
      "w_9",
      "ein_letter",
      "commercial_insurance",
      "cargo_insurance",
    ];

    const submitted = documents.length;
    const approved = documents.filter((item) =>
      ["approved", "verified"].includes(normalize(item.review_status || item.status))
    ).length;
    const pending = documents.filter((item) =>
      ["submitted", "pending_review", "pending"].includes(normalize(item.review_status || item.status))
    ).length;
    const missingRequired = requiredKeys.filter(
      (key) => !documents.some((doc) => normalize(doc.document_type) === key)
    ).length;

    return {
      submitted,
      approved,
      pending,
      missingRequired,
    };
  }, [documents]);

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

  async function loadBusinessDocuments() {
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

      if (error) console.log("Business documents carrier error:", error.message);

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
        email: normalize(dbCarrier.email || email),
        companyName:
          dbCarrier.company_name ||
          dbCarrier.business_name ||
          stored?.companyName ||
          stored?.businessName ||
          "Freight Connect Carrier",
      });

      const { data, error: docError } = await supabase
        .from("freight_documents")
        .select("*")
        .eq("freight_id", mergedCarrier.id)
        .order("updated_at", { ascending: false });

      if (docError) {
        console.log("Business documents load error:", docError.message);
        setDocuments([]);
      } else {
        setDocuments(Array.isArray(data) ? data : []);
      }
    } catch (error: any) {
      Alert.alert("Documents Error", error?.message || "Unable to load business documents.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadBusinessDocuments();
  }

  async function pickDocument() {
    try {
      setUploading(true);

      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      setSelectedFile(file);

      if (!documentTitle.trim()) {
        setDocumentTitle(file.name || documentType);
      }

      Alert.alert("File Selected", file.name || "Document selected.");
    } catch (error: any) {
      Alert.alert("Upload Error", error?.message || "Unable to select business document.");
    } finally {
      setUploading(false);
    }
  }

  async function saveDocument() {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      return;
    }

    if (!selectedFile?.uri) {
      Alert.alert("File Required", "Please upload or select a document first.");
      return;
    }

    try {
      setSaving(true);

      const now = new Date().toISOString();
      const typeKey = documentTypeKey(documentType);

      const payload = {
        freight_id: carrier.id,
        carrier_id: carrier.id,
        document_type: typeKey,
        title: documentTitle.trim() || documentType,
        file_name: selectedFile.name || documentTitle.trim() || documentType,
        file_url: selectedFile.uri,
        storage_path: selectedFile.uri,
        mime_type: selectedFile.mimeType || null,
        size_bytes: selectedFile.size || null,
        notes: notes.trim() || null,
        status: "submitted",
        review_status: "pending_review",
        source: "business_documents",
        required: ["business_license", "w_9", "ein_letter", "commercial_insurance", "cargo_insurance"].includes(
          typeKey
        ),
        submitted_at: now,
        created_at: now,
        updated_at: now,
      };

      const { error } = await supabase.from("freight_documents").insert(payload);

      if (error) throw error;

      await supabase
        .from("freight_users")
        .update({
          documents_uploaded: true,
          compliance_documents_uploaded: true,
          business_documents_uploaded: true,
          documents_updated_at: now,
          updated_at: now,
        })
        .eq("id", carrier.id);

      setSelectedFile(null);
      setDocumentTitle("");
      setNotes("");

      Alert.alert("Saved", "Business document was submitted for review.");
      await loadBusinessDocuments();
    } catch (error: any) {
      Alert.alert("Save Error", error?.message || "Unable to save business document.");
    } finally {
      setSaving(false);
    }
  }

  function statusColor(status: any) {
    const value = normalize(status);

    if (["approved", "verified"].includes(value)) return COLORS.green;
    if (["rejected", "denied"].includes(value)) return COLORS.red;
    if (["pending_review", "pending", "submitted"].includes(value)) return COLORS.amber;

    return COLORS.blue;
  }

  function renderDocument({ item }: { item: any }) {
    const status = item.review_status || item.status || "submitted";

    return (
      <View style={styles.documentCard}>
        <View style={styles.documentTop}>
          <View style={styles.documentIcon}>
            <Ionicons name="document-text-outline" size={22} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.documentTitle}>{item.title || item.file_name || "Business Document"}</Text>
            <Text style={styles.documentSub}>
              {String(item.document_type || "document").replace(/_/g, " ")} · {formatDate(item.updated_at || item.created_at)}
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: statusColor(status) }]}>
            <Text style={styles.statusText}>{String(status).replace(/_/g, " ")}</Text>
          </View>
        </View>

        {!!item.notes && <Text style={styles.documentNotes}>{item.notes}</Text>}

        {!!item.review_notes && (
          <View style={styles.reviewBox}>
            <Text style={styles.reviewTitle}>Review Notes</Text>
            <Text style={styles.reviewText}>{item.review_notes}</Text>
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
        <Text style={styles.centerText}>Loading business documents...</Text>
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
            <Text style={styles.title}>Business Documents</Text>
            <Text style={styles.subtitle}>
              Store business licenses, W-9, EIN documents, insurance documents, tax summaries,
              report exports, and compliance records.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.documents)}>
            <Ionicons name="folder-open-outline" size={34} color="#FFFFFF" />
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
          <StatCard label="Submitted" value={String(stats.submitted)} icon="document-attach-outline" />
          <StatCard label="Approved" value={String(stats.approved)} icon="checkmark-circle-outline" />
          <StatCard label="Pending" value={String(stats.pending)} icon="time-outline" />
          <StatCard label="Missing Required" value={String(stats.missingRequired)} icon="alert-circle-outline" />
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="shield-checkmark-outline" label="Compliance" route={FREIGHT_ROUTES.compliance} />
          <QuickLink icon="document-attach-outline" label="Documents" route={FREIGHT_ROUTES.documents} />
          <QuickLink icon="shield-outline" label="Insurance" route={FREIGHT_ROUTES.insurance} />
          <QuickLink icon="document-text-outline" label="Tax Center" route={FREIGHT_ROUTES.taxCenter} />
          <QuickLink icon="download-outline" label="Reports" route={FREIGHT_ROUTES.reportExport} />
          <QuickLink icon="headset-outline" label="Support" route={FREIGHT_ROUTES.support} />
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Business Record Storage</Text>
          <Text style={styles.noticeText}>
            Keep business documents organized for compliance review, tax records, insurance verification,
            and internal Farm2Home freight onboarding.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add Business Document</Text>

          <Text style={styles.label}>Document Type</Text>
          <View style={styles.optionGrid}>
            {DOCUMENT_TYPES.map((type) => {
              const active = documentType === type;

              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.optionButton, active && styles.optionButtonActive]}
                  onPress={() => setDocumentType(type)}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Document Title</Text>
          <TextInput
            style={styles.input}
            value={documentTitle}
            onChangeText={setDocumentTitle}
            placeholder="Example: ASO Freight W-9"
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional notes"
            placeholderTextColor="#94A3B8"
            multiline
            textAlignVertical="top"
          />

          <View style={styles.fileBox}>
            <Ionicons
              name={selectedFile ? "document-text-outline" : "document-outline"}
              size={22}
              color={selectedFile ? COLORS.green : COLORS.amber}
            />
            <Text style={styles.fileText}>
              {selectedFile?.name || "No document selected"}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.outlineButton, uploading && styles.disabledButton]}
            onPress={pickDocument}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color={COLORS.red} />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color={COLORS.red} />
                <Text style={styles.outlineText}>Select Document</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButtonInner, saving && styles.disabledButton]}
            onPress={saveDocument}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryText}>Save Business Document</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Saved Business Documents</Text>

        <FlatList
          data={documents}
          keyExtractor={(item, index) => String(item.id || index)}
          scrollEnabled={false}
          renderItem={renderDocument}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="folder-open-outline" size={38} color={COLORS.red} />
              <Text style={styles.emptyTitle}>No business documents yet.</Text>
              <Text style={styles.emptyText}>
                Upload your W-9, EIN letter, business license, insurance, and compliance records here.
              </Text>
            </View>
          }
        />

        <TouchableOpacity style={styles.primaryButton} onPress={() => goTo(FREIGHT_ROUTES.adminReview)}>
          <Ionicons name="eye-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>View Review Status</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.darkButton} onPress={() => goTo(FREIGHT_ROUTES.managementCenter)}>
          <Ionicons name="apps-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Management Center</Text>
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
  cardTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900", marginBottom: 12 },
  label: { color: COLORS.text, fontWeight: "900", marginBottom: 7, marginTop: 8 },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  optionButton: {
    width: "48%",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  optionButtonActive: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },
  optionText: { color: COLORS.text, fontWeight: "900", textAlign: "center" },
  optionTextActive: { color: "#FFFFFF" },
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
  fileBox: {
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
  fileText: { color: COLORS.text, fontWeight: "900", flex: 1 },
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
  sectionTitle: {
    color: COLORS.text,
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  documentCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  documentTop: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  documentIcon: {
    width: 46,
    height: 46,
    borderRadius: 18,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  documentTitle: { color: COLORS.text, fontSize: 17, fontWeight: "900" },
  documentSub: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 4,
    textTransform: "capitalize",
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: 120,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  documentNotes: {
    color: COLORS.text,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 12,
  },
  reviewBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    marginTop: 12,
  },
  reviewTitle: { color: COLORS.text, fontWeight: "900", marginBottom: 4 },
  reviewText: { color: COLORS.muted, fontWeight: "700", lineHeight: 20 },
  emptyCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 10,
  },
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