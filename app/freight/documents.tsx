// app/freight/documents.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import * as DocumentPicker from "expo-document-picker";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const FREIGHT_ROUTES = {
  dashboard: "/freight/dashboard",
  managementCenter: "/freight/freight-management-center",
  compliance: "/freight/compliance",
  legal: "/freight/legal",
  documents: "/freight/documents",
  connectBank: "/freight/connect-bank",
  subscription: "/freight/subscription",
  profile: "/freight/profile",
  settings: "/freight/settings",
  support: "/freight/support",
  help: "/freight/help",
  board: "/freight/board",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];

type RequiredDoc = {
  key: string;
  title: string;
  description: string;
  required: boolean;
};

type FreightDocument = {
  id: string;
  freight_id?: string;
  document_type?: string;
  title?: string;
  file_name?: string;
  file_url?: string;
  storage_path?: string;
  status?: string;
  review_status?: string;
  created_at?: string;
  updated_at?: string;
};

const REQUIRED_DOCS: RequiredDoc[] = [
  {
    key: "business_registration",
    title: "Business Registration / LLC Documents",
    description: "Articles, LLC documents, DBA, or business formation record.",
    required: true,
  },
  {
    key: "w9_tax_form",
    title: "W-9 Tax Form",
    description: "Tax document for payout and contractor records.",
    required: true,
  },
  {
    key: "commercial_auto_insurance",
    title: "Commercial Auto Insurance",
    description: "Current active commercial auto insurance.",
    required: true,
  },
  {
    key: "cargo_insurance",
    title: "Cargo Insurance",
    description: "Coverage for transported produce, freight, or farm goods.",
    required: true,
  },
  {
    key: "dot_authority",
    title: "MDOT / DOT Authority Document",
    description: "Carrier authority or registration if required for your operation.",
    required: false,
  },
  {
    key: "mc_authority",
    title: "MC Authority Document",
    description: "Motor carrier authority if applicable.",
    required: false,
  },
  {
    key: "vehicle_registration",
    title: "Vehicle Registration",
    description: "Registration for the vehicle used for freight work.",
    required: true,
  },
  {
    key: "driver_license",
    title: "Driver License / Carrier Credential",
    description: "Driver license or carrier credential for the operator.",
    required: true,
  },
  {
    key: "refrigerated_vehicle_proof",
    title: "Refrigerated Vehicle Proof",
    description: "Proof of refrigeration capability for cold-chain loads.",
    required: false,
  },
  {
    key: "livestock_transport_permit",
    title: "Livestock Transport Permit",
    description: "Permit or documentation for livestock transport if applicable.",
    required: false,
  },
  {
    key: "twic_tsa_medical",
    title: "TWIC / TSA / Medical Logistics Credential",
    description: "Specialty credential if handling restricted, TSA, or medical logistics loads.",
    required: false,
  },
];

const COLORS = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  redDark: "#9F1117",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  amber: "#D97706",
  blue: "#2563EB",
  slate: "#64748B",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

function formatDate(value?: string) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString();
}

function statusColor(status?: string) {
  const value = normalize(status);
  if (value.includes("approved")) return COLORS.green;
  if (value.includes("rejected") || value.includes("failed")) return COLORS.red;
  if (value.includes("review") || value.includes("pending")) return COLORS.amber;
  if (value.includes("submitted") || value.includes("uploaded")) return COLORS.blue;
  return COLORS.slate;
}

export default function FreightDocumentsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [uploadingKey, setUploadingKey] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);
  const [documents, setDocuments] = useState<FreightDocument[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadDocuments();
    }, [])
  );

  const uploadedRequiredCount = useMemo(() => {
    return REQUIRED_DOCS.filter((doc) => doc.required && getDocumentForType(doc.key)).length;
  }, [documents]);

  const requiredCount = useMemo(() => REQUIRED_DOCS.filter((doc) => doc.required).length, []);

  const allRequiredUploaded = uploadedRequiredCount >= requiredCount;

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

  function getDocumentForType(docKey: string) {
    return documents.find(
      (doc) =>
        doc.document_type === docKey ||
        normalize(doc.title) === normalize(docKey) ||
        normalize(doc.file_name).includes(normalize(docKey))
    );
  }

  async function loadDocuments() {
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

      if (error) {
        console.log("Freight documents profile error:", error.message);
      }

      if (!dbCarrier) {
        Alert.alert(
          "Freight Profile Missing",
          "No freight profile was found. Please complete freight registration first."
        );
        router.replace(FREIGHT_ROUTES.register as any);
        return;
      }

      const mergedCarrier = {
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
      };

      await persistCarrier(mergedCarrier);

      const { data: docData, error: docError } = await supabase
        .from("freight_documents")
        .select("*")
        .eq("freight_id", dbCarrier.id)
        .order("created_at", { ascending: false });

      if (docError) {
        console.log("Freight documents load error:", docError.message);
        setDocuments([]);
      } else {
        setDocuments(Array.isArray(docData) ? docData : []);
      }
    } catch (error: any) {
      console.log("Freight documents error:", error);
      Alert.alert("Documents Error", error?.message || "Unable to load freight documents.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadDocuments();
  }

  async function uploadDocument(doc: RequiredDoc) {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      return;
    }

    try {
      setUploadingKey(doc.key);

      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      const now = new Date().toISOString();

      const payload = {
        freight_id: carrier.id,
        document_type: doc.key,
        title: doc.title,
        file_name: file.name || doc.title,
        file_url: file.uri,
        storage_path: file.uri,
        mime_type: file.mimeType || null,
        size_bytes: file.size || null,
        status: "submitted",
        review_status: "pending_review",
        required: doc.required,
        created_at: now,
        updated_at: now,
      };

      const existing = getDocumentForType(doc.key);

      if (existing?.id) {
        const { error } = await supabase
          .from("freight_documents")
          .update({
            ...payload,
            created_at: existing.created_at || now,
            updated_at: now,
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("freight_documents").insert(payload);
        if (error) throw error;
      }

      await supabase
        .from("freight_users")
        .update({
          documents_uploaded: true,
          compliance_documents_uploaded: true,
          compliance_status: "documents_submitted",
          updated_at: now,
        })
        .eq("id", carrier.id);

      Alert.alert("Document Uploaded", `${doc.title} was submitted for review.`);
      await loadDocuments();
    } catch (error: any) {
      console.log("Upload freight document error:", error);
      Alert.alert("Upload Error", error?.message || "Unable to upload freight document.");
    } finally {
      setUploadingKey("");
    }
  }

  async function submitForReview() {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      return;
    }

    if (!allRequiredUploaded) {
      Alert.alert(
        "Missing Required Documents",
        `Please upload all required documents first. ${uploadedRequiredCount}/${requiredCount} required uploaded.`
      );
      return;
    }

    try {
      setSubmitting(true);

      const now = new Date().toISOString();

      const { error } = await supabase
        .from("freight_users")
        .update({
          documents_uploaded: true,
          compliance_documents_uploaded: true,
          documents_submitted_at: now,
          compliance_status: "documents_submitted",
          updated_at: now,
        })
        .eq("id", carrier.id);

      if (error) throw error;

      await supabase
        .from("freight_documents")
        .update({
          status: "submitted",
          review_status: "pending_review",
          updated_at: now,
        })
        .eq("freight_id", carrier.id);

      Alert.alert(
        "Submitted for Review",
        "Your freight documents were submitted for Farm2Home review.",
        [
          {
            text: "Compliance",
            onPress: () => router.replace(FREIGHT_ROUTES.compliance as any),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert("Submit Error", error?.message || "Unable to submit documents for review.");
    } finally {
      setSubmitting(false);
    }
  }

  async function openDocument(doc?: FreightDocument) {
    if (!doc?.file_url && !doc?.storage_path) {
      Alert.alert("Document Missing", "No document file is available.");
      return;
    }

    const url = doc.file_url || doc.storage_path || "";

    try {
      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        Alert.alert("Open Document", "This file is saved, but cannot be opened directly from this device.");
        return;
      }

      await Linking.openURL(url);
    } catch {
      Alert.alert("Open Error", "Unable to open this document.");
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading freight documents...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Farm2Home Freight Connect</Text>
            <Text style={styles.title}>Freight Documents</Text>
            <Text style={styles.subtitle}>
              Upload required carrier, insurance, authority, vehicle, and compliance documents.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.compliance)}>
            <Ionicons name="document-attach-outline" size={34} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.carrierCard}>
          <View style={styles.avatar}>
            <Ionicons name="business-outline" size={28} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.carrierName}>{carrier?.companyName || "Freight Connect Carrier"}</Text>
            <Text style={styles.carrierEmail}>{carrier?.email || "Carrier workspace"}</Text>
            <Text style={styles.carrierMeta}>
              Required uploaded: {uploadedRequiredCount}/{requiredCount}
            </Text>
          </View>
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="shield-checkmark-outline" label="Compliance" route={FREIGHT_ROUTES.compliance} />
          <QuickLink icon="document-text-outline" label="Legal" route={FREIGHT_ROUTES.legal} />
          <QuickLink icon="business-outline" label="Connect Bank" route={FREIGHT_ROUTES.connectBank} />
          <QuickLink icon="headset-outline" label="Support" route={FREIGHT_ROUTES.support} />
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Document Review</Text>
          <Text style={styles.noticeText}>
            Upload documents for Farm2Home review. Required documents must be submitted before
            compliance is complete.
          </Text>
        </View>

        {REQUIRED_DOCS.map((doc) => {
          const uploadedDoc = getDocumentForType(doc.key);
          const status = uploadedDoc?.review_status || uploadedDoc?.status || "not_uploaded";
          const uploading = uploadingKey === doc.key;

          return (
            <View key={doc.key} style={styles.card}>
              <View style={styles.docTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docTitle}>{doc.title}</Text>
                  <Text style={styles.docDescription}>{doc.description}</Text>
                </View>

                <View style={[styles.statusBadge, { backgroundColor: statusColor(status) }]}>
                  <Text style={styles.statusText}>
                    {uploadedDoc ? status.replace(/_/g, " ") : "not uploaded"}
                  </Text>
                </View>
              </View>

              <View style={styles.requiredRow}>
                <Ionicons
                  name={doc.required ? "alert-circle-outline" : "information-circle-outline"}
                  size={17}
                  color={doc.required ? COLORS.red : COLORS.blue}
                />
                <Text style={styles.requiredText}>
                  {doc.required ? "Required" : "Optional / If Applicable"}
                </Text>
              </View>

              {uploadedDoc && (
                <TouchableOpacity style={styles.fileBox} onPress={() => openDocument(uploadedDoc)}>
                  <Ionicons name="document-text-outline" size={22} color={COLORS.red} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fileName}>{uploadedDoc.file_name || uploadedDoc.title}</Text>
                    <Text style={styles.fileMeta}>Uploaded: {formatDate(uploadedDoc.created_at)}</Text>
                  </View>
                  <Ionicons name="open-outline" size={19} color={COLORS.muted} />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.uploadButton, uploading && styles.disabledButton]}
                onPress={() => uploadDocument(doc)}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.uploadText}>
                      {uploadedDoc ? "Replace Document" : "Upload Document"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          );
        })}

        <TouchableOpacity
          style={[
            styles.reviewButton,
            (!allRequiredUploaded || submitting) && styles.disabledButton,
          ]}
          onPress={submitForReview}
          disabled={!allRequiredUploaded || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="send-outline" size={18} color="#FFFFFF" />
              <Text style={styles.reviewText}>Submit Documents for Review</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.backButton} onPress={() => goTo(FREIGHT_ROUTES.compliance)}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#FFFFFF" />
          <Text style={styles.backText}>Back to Compliance</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
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
  carrierMeta: { color: COLORS.red, fontWeight: "900", marginTop: 5 },
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
    padding: 18,
    borderRadius: 22,
    marginHorizontal: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  docTop: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  docTitle: { fontSize: 17, fontWeight: "900", color: COLORS.text },
  docDescription: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 5 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    maxWidth: 135,
  },
  statusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 11,
    textTransform: "capitalize",
  },
  requiredRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 12,
  },
  requiredText: { color: COLORS.text, fontWeight: "900", fontSize: 12 },
  fileBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    borderRadius: 14,
    marginTop: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  fileName: { color: COLORS.text, fontWeight: "900" },
  fileMeta: { color: COLORS.muted, fontWeight: "700", marginTop: 3 },
  uploadButton: {
    backgroundColor: COLORS.red,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  uploadText: { color: "#FFFFFF", fontWeight: "900" },
  reviewButton: {
    backgroundColor: COLORS.green,
    padding: 17,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 18,
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: { opacity: 0.6 },
  reviewText: { color: "#FFFFFF", fontWeight: "900", fontSize: 15 },
  backButton: {
    backgroundColor: COLORS.black,
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 18,
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
  },
  backText: { color: "#FFFFFF", fontWeight: "900" },
});