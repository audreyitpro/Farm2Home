// app/freight/documents.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
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

const STORAGE_BUCKET = "freight-documents";

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
  section: "required" | "optional";
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
    key: "commercial_driver_license",
    title: "Commercial Driver License / CDL",
    description: "Driver license or CDL used for freight work.",
    required: true,
    section: "required",
  },
  {
    key: "dot_certificate",
    title: "DOT Certificate",
    description: "DOT certificate, operating authority, or carrier registration.",
    required: true,
    section: "required",
  },
  {
    key: "mc_authority_letter",
    title: "MC Authority Letter",
    description: "Motor carrier authority letter or approval record.",
    required: true,
    section: "required",
  },
  {
    key: "certificate_of_insurance",
    title: "Certificate of Insurance / COI",
    description: "Current commercial insurance certificate.",
    required: true,
    section: "required",
  },
  {
    key: "w9_form",
    title: "W-9 Form",
    description: "Tax document required for payment and contractor records.",
    required: true,
    section: "required",
  },
  {
    key: "vehicle_registration",
    title: "Vehicle Registration",
    description: "Registration for vehicles used for freight deliveries.",
    required: true,
    section: "required",
  },
  {
    key: "cargo_insurance_certificate",
    title: "Cargo Insurance Certificate",
    description: "Cargo coverage for transported farm goods and freight.",
    required: true,
    section: "required",
  },
  {
    key: "business_license",
    title: "Business License",
    description: "Business license, LLC documentation, or registration.",
    required: true,
    section: "required",
  },
  {
    key: "hipaa_certificate",
    title: "HIPAA Certificate",
    description: "Optional certificate for medical or specialized logistics.",
    required: false,
    section: "optional",
  },
  {
    key: "bloodborne_pathogens_certificate",
    title: "Bloodborne Pathogens Certificate",
    description: "Optional certificate for medical courier work.",
    required: false,
    section: "optional",
  },
  {
    key: "tsa_twic_certificate",
    title: "TSA / TWIC / Airport Credential",
    description: "Optional credential for airport, secure, or restricted deliveries.",
    required: false,
    section: "optional",
  },
  {
    key: "refrigerated_vehicle_proof",
    title: "Refrigerated Vehicle Proof",
    description: "Optional proof for refrigerated or cold-chain loads.",
    required: false,
    section: "optional",
  },
];

const COLORS = {
  bg: "#F5F6FA",
  card: "#FFFFFF",
  surface: "#F8FAFC",
  navy: "#020617",
  navy2: "#0F172A",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  primary: "#635BFF",
  primaryDark: "#4F46E5",
  primarySoft: "#EEF2FF",
  green: "#10B981",
  greenSoft: "#ECFDF5",
  amber: "#F59E0B",
  amberSoft: "#FFFBEB",
  red: "#EF4444",
  redSoft: "#FEF2F2",
  blue: "#2563EB",
  white: "#FFFFFF",
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function fileExt(name = "") {
  const ext = name.split(".").pop();
  return ext && ext !== name ? ext.toLowerCase() : "pdf";
}

function safeFileName(name = "") {
  return clean(name || "document.pdf")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

function freightIdFromProfile(profile: any) {
  return clean(profile?.id || profile?.freight_id || profile?.freightId || profile?.auth_user_id || profile?.profile_id);
}

function carrierName(profile: any) {
  return (
    clean(profile?.companyName || profile?.businessName || profile?.company_name || profile?.business_name) ||
    clean(profile?.contactName || profile?.contact_name || profile?.name) ||
    "Farm2Home Freight Carrier"
  );
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
  return COLORS.muted;
}

function statusSoftColor(status?: string) {
  const value = normalize(status);
  if (value.includes("approved")) return COLORS.greenSoft;
  if (value.includes("rejected") || value.includes("failed")) return COLORS.redSoft;
  if (value.includes("review") || value.includes("pending")) return COLORS.amberSoft;
  if (value.includes("submitted") || value.includes("uploaded")) return COLORS.primarySoft;
  return COLORS.surface;
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

  const requiredDocs = useMemo(() => REQUIRED_DOCS.filter((doc) => doc.section === "required"), []);
  const optionalDocs = useMemo(() => REQUIRED_DOCS.filter((doc) => doc.section === "optional"), []);

  const uploadedRequiredCount = useMemo(() => {
    return requiredDocs.filter((doc) => getDocumentForType(doc.key)).length;
  }, [documents, requiredDocs]);

  const requiredCount = requiredDocs.length;
  const allRequiredUploaded = uploadedRequiredCount >= requiredCount;
  const progressPercent = requiredCount ? Math.round((uploadedRequiredCount / requiredCount) * 100) : 0;

  async function getStoredCarrier() {
    const raw =
      (await AsyncStorage.getItem("currentFreightCarrier")) ||
      (await AsyncStorage.getItem("currentFreight")) ||
      (await AsyncStorage.getItem("currentFreightUser")) ||
      (await AsyncStorage.getItem("farm2homeCurrentFreight")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function persistCarrier(nextCarrier: any) {
    const id = freightIdFromProfile(nextCarrier);

    const normalizedCarrier = {
      ...nextCarrier,
      id,
      freight_id: clean(nextCarrier.freight_id || id),
      freightId: clean(nextCarrier.freightId || nextCarrier.freight_id || id),
      role: "freight",
      email: normalize(nextCarrier.email),
      companyName: carrierName(nextCarrier),
      businessName:
        clean(nextCarrier.businessName || nextCarrier.business_name || nextCarrier.companyName || nextCarrier.company_name) ||
        carrierName(nextCarrier),
    };

    await AsyncStorage.multiSet([
      ["currentFreight", JSON.stringify(normalizedCarrier)],
      ["currentFreightCarrier", JSON.stringify(normalizedCarrier)],
      ["currentFreightUser", JSON.stringify(normalizedCarrier)],
      ["farm2homeCurrentFreight", JSON.stringify(normalizedCarrier)],
      ["currentUser", JSON.stringify(normalizedCarrier)],
      ["userRole", "freight"],
      ["currentUserRole", "freight"],
    ]);

    setCarrier(normalizedCarrier);
    return normalizedCarrier;
  }

  function getDocumentForType(docKey: string) {
    const key = normalize(docKey);

    return documents.find((doc) => {
      const docType = normalize(doc.document_type);
      const docTitle = normalize(doc.title);
      const file = normalize(doc.file_name);

      return docType === key || docTitle === key || file.includes(key);
    });
  }

  async function findFreightProfile(stored: any) {
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;

    const authId = clean(authUser?.id);
    const storedId = freightIdFromProfile(stored);
    const email = normalize(stored?.email || authUser?.email);

    const filters = [
      authId ? `id.eq.${authId}` : "",
      authId ? `auth_user_id.eq.${authId}` : "",
      authId ? `profile_id.eq.${authId}` : "",
      authId ? `freight_id.eq.${authId}` : "",
      storedId ? `id.eq.${storedId}` : "",
      storedId ? `freight_id.eq.${storedId}` : "",
      storedId ? `auth_user_id.eq.${storedId}` : "",
      storedId ? `profile_id.eq.${storedId}` : "",
      email ? `email.eq.${email}` : "",
    ]
      .filter(Boolean)
      .join(",");

    if (!filters) return null;

    const { data, error } = await supabase
      .from("freight_users")
      .select("*")
      .or(filters)
      .limit(1);

    if (error) {
      console.log("Freight profile lookup error:", error.message);
      return null;
    }

    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  }

  async function loadDocuments() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const dbCarrier = await findFreightProfile(stored);

      if (!dbCarrier && !stored) {
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
        id: dbCarrier?.id || freightIdFromProfile(stored),
        freight_id: dbCarrier?.freight_id || dbCarrier?.id || freightIdFromProfile(stored),
        freightId: dbCarrier?.freight_id || dbCarrier?.id || freightIdFromProfile(stored),
        email: normalize(dbCarrier?.email || stored?.email),
      });

      const activeFreightId = freightIdFromProfile(mergedCarrier);

      if (!activeFreightId) {
        Alert.alert("Freight ID Missing", "Please log out and log back into your freight account.");
        setDocuments([]);
        return;
      }

      const { data: docData, error: docError } = await supabase
        .from("freight_documents")
        .select("*")
        .eq("freight_id", activeFreightId)
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

  async function getUploadBody(file: DocumentPicker.DocumentPickerAsset): Promise<Blob | ArrayBuffer> {
    const webFile = (file as any).file;

    if (webFile) {
      return webFile;
    }

    const response = await fetch(file.uri);
    if (!response.ok) {
      throw new Error("Unable to read selected file.");
    }

    return await response.blob();
  }

  async function uploadToStorage(file: DocumentPicker.DocumentPickerAsset, doc: RequiredDoc, freightId: string) {
    const ext = fileExt(file.name);
    const name = safeFileName(file.name || `${doc.key}.${ext}`);
    const path = `${freightId}/${doc.key}/${Date.now()}_${name}`;
    const body = await getUploadBody(file);
    const contentType = file.mimeType || "application/octet-stream";

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, body, {
        contentType,
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(
        `${uploadError.message}. Make sure the Supabase Storage bucket "${STORAGE_BUCKET}" exists and allows authenticated uploads.`
      );
    }

    const { data: publicData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);

    return {
      storagePath: path,
      fileUrl: publicData?.publicUrl || "",
    };
  }

  async function saveDocumentRecord(doc: RequiredDoc, file: DocumentPicker.DocumentPickerAsset, fileUrl: string, storagePath: string) {
    const freightId = freightIdFromProfile(carrier);
    const now = new Date().toISOString();
    const existing = getDocumentForType(doc.key);

    const payload = {
      freight_id: freightId,
      document_type: doc.key,
      title: doc.title,
      file_name: file.name || doc.title,
      file_url: fileUrl,
      storage_path: storagePath,
      status: "uploaded",
      review_status: "pending_review",
      updated_at: now,
    };

    if (existing?.id) {
      const { error } = await supabase
        .from("freight_documents")
        .update(payload)
        .eq("id", existing.id)
        .select("id")
        .maybeSingle();

      if (error) throw error;
      return;
    }

    const { error } = await supabase
      .from("freight_documents")
      .insert({
        ...payload,
        created_at: now,
      })
      .select("id")
      .maybeSingle();

    if (error) throw error;
  }

  async function safeUpdateFreightUser() {
    const id = freightIdFromProfile(carrier);
    if (!id) return;

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("freight_users")
      .update({
        documents_uploaded: true,
        compliance_documents_uploaded: true,
        compliance_status: "documents_submitted",
        updated_at: now,
      })
      .eq("id", id);

    if (error) {
      console.log("Freight user document status update skipped:", error.message);
    }
  }

  async function uploadDocument(doc: RequiredDoc) {
    const freightId = freightIdFromProfile(carrier);

    if (!freightId) {
      Alert.alert("Profile Missing", "Please save or log into your freight account before uploading documents.");
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

      const { storagePath, fileUrl } = await uploadToStorage(file, doc, freightId);

      await saveDocumentRecord(doc, file, fileUrl, storagePath);
      await safeUpdateFreightUser();

      Alert.alert("Document Uploaded", `${doc.title} was uploaded and saved.`);
      await loadDocuments();
    } catch (error: any) {
      console.log("Upload freight document error:", error);
      Alert.alert("Upload Error", error?.message || "Unable to upload freight document.");
    } finally {
      setUploadingKey("");
    }
  }

  async function submitForReview() {
    const freightId = freightIdFromProfile(carrier);

    if (!freightId) {
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

      const { error: userError } = await supabase
        .from("freight_users")
        .update({
          documents_uploaded: true,
          compliance_documents_uploaded: true,
          documents_submitted_at: now,
          compliance_status: "documents_submitted",
          updated_at: now,
        })
        .eq("id", freightId);

      if (userError) {
        console.log("Freight user review status update skipped:", userError.message);
      }

      const { error: docError } = await supabase
        .from("freight_documents")
        .update({
          status: "submitted",
          review_status: "pending_review",
          updated_at: now,
        })
        .eq("freight_id", freightId);

      if (docError) throw docError;

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

    let url = doc.file_url || "";

    if (!url && doc.storage_path) {
      const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(doc.storage_path);
      url = data?.publicUrl || "";
    }

    if (!url) {
      Alert.alert("Open Document", "The document was saved, but the public file URL was not found.");
      return;
    }

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

  function renderDocCard(doc: RequiredDoc) {
    const uploadedDoc = getDocumentForType(doc.key);
    const status = uploadedDoc?.review_status || uploadedDoc?.status || "not_uploaded";
    const uploading = uploadingKey === doc.key;
    const uploaded = Boolean(uploadedDoc);

    return (
      <View key={doc.key} style={styles.docCard}>
        <View style={styles.docHeader}>
          <View style={[styles.docIcon, uploaded && styles.docIconUploaded]}>
            <Ionicons
              name={uploaded ? "checkmark-circle-outline" : "document-attach-outline"}
              size={24}
              color={uploaded ? COLORS.green : COLORS.primary}
            />
          </View>

          <View style={{ flex: 1 }}>
            <View style={styles.docTitleRow}>
              <Text style={styles.docTitle}>{doc.title}</Text>
              {doc.required ? <Text style={styles.requiredMark}>*</Text> : null}
            </View>
            <Text style={styles.docDescription}>{doc.description}</Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: statusSoftColor(status) }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor(status) }]} />
            <Text style={[styles.statusText, { color: statusColor(status) }]}>
              {uploaded ? status.replace(/_/g, " ") : "not uploaded"}
            </Text>
          </View>
        </View>

        {uploadedDoc ? (
          <TouchableOpacity style={styles.fileBox} onPress={() => openDocument(uploadedDoc)}>
            <Ionicons name="document-text-outline" size={22} color={COLORS.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fileName}>{uploadedDoc.file_name || uploadedDoc.title}</Text>
              <Text style={styles.fileMeta}>Uploaded: {formatDate(uploadedDoc.updated_at || uploadedDoc.created_at)}</Text>
            </View>
            <Ionicons name="open-outline" size={19} color={COLORS.muted} />
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.uploadButton, uploading && styles.disabledButton]}
          onPress={() => uploadDocument(doc)}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={18} color={COLORS.white} />
              <Text style={styles.uploadText}>{uploadedDoc ? "Replace" : "Upload"}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.centerText}>Loading freight documents...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.layout}>
          <View style={styles.sidebar}>
            <View style={styles.progressCard}>
              <Text style={styles.progressLabel}>Setup Progress</Text>
              <Text style={styles.progressValue}>{uploadedRequiredCount}/{requiredCount}</Text>
              <Text style={styles.progressText}>
                Required documents uploaded and saved.
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
              </View>
            </View>

            <StepItem done label="Account" icon="checkmark-outline" />
            <StepItem done label="Company" icon="business-outline" />
            <StepItem done label="Authority" icon="shield-checkmark-outline" />
            <StepItem active label="Documents" icon="document-attach-outline" />
            <StepItem label="Security" icon="key-outline" />
            <StepItem label="Stripe" icon="card-outline" />
            <StepItem label="Review" icon="checkmark-done-outline" />

            <TouchableOpacity style={styles.homeButton} onPress={() => router.replace("/" as any)}>
              <Ionicons name="home-outline" size={17} color={COLORS.primary} />
              <Text style={styles.homeButtonText}>Back to Home</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.main}>
            <View style={styles.hero}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>Farm2Home Freight Registration</Text>
                <Text style={styles.title}>Required Documents</Text>
                <Text style={styles.subtitle}>
                  Upload carrier compliance documents before dashboard approval.
                </Text>
              </View>

              <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.compliance)}>
                <Ionicons name="document-attach-outline" size={32} color={COLORS.white} />
              </TouchableOpacity>
            </View>

            <View style={styles.infoNotice}>
              <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
              <Text style={styles.noticeText}>
                Files are uploaded to Supabase Storage bucket "{STORAGE_BUCKET}" and saved to the freight_documents table.
              </Text>
            </View>

            <View style={styles.carrierCard}>
              <View style={styles.avatar}>
                <Ionicons name="business-outline" size={25} color={COLORS.white} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.carrierName}>{carrierName(carrier)}</Text>
                <Text style={styles.carrierEmail}>{carrier?.email || "Carrier workspace"}</Text>
                <Text style={styles.carrierMeta}>
                  Required uploaded: {uploadedRequiredCount}/{requiredCount}
                </Text>
              </View>

              <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
                <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
                <Text style={styles.refreshText}>Refresh</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Required Carrier Documents</Text>
              <Text style={styles.sectionSub}>These are checked during login and dashboard approval.</Text>
            </View>

            {requiredDocs.map(renderDocCard)}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Optional Medical / Specialized Carrier Documents</Text>
              <Text style={styles.sectionSub}>Upload these if your carrier handles medical, airport, refrigerated, or specialized freight.</Text>
            </View>

            {optionalDocs.map(renderDocCard)}

            <TouchableOpacity
              style={[
                styles.reviewButton,
                (!allRequiredUploaded || submitting) && styles.disabledButton,
              ]}
              onPress={submitForReview}
              disabled={!allRequiredUploaded || submitting}
            >
              {submitting ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="send-outline" size={18} color={COLORS.white} />
                  <Text style={styles.reviewText}>Submit Documents for Review</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.quickGrid}>
              <QuickLink icon="shield-checkmark-outline" label="Compliance" route={FREIGHT_ROUTES.compliance} />
              <QuickLink icon="business-outline" label="Connect Bank" route={FREIGHT_ROUTES.connectBank} />
              <QuickLink icon="headset-outline" label="Support" route={FREIGHT_ROUTES.support} />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StepItem({
  label,
  icon,
  active,
  done,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  done?: boolean;
}) {
  return (
    <View style={[styles.stepItem, active && styles.stepItemActive]}>
      <View style={[styles.stepIcon, done && styles.stepIconDone, active && styles.stepIconActive]}>
        <Ionicons name={done ? "checkmark-outline" : icon} size={17} color={done || active ? COLORS.white : "#94A3B8"} />
      </View>
      <Text style={[styles.stepText, active && styles.stepTextActive]}>{label}</Text>
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
      <Ionicons name={icon} size={22} color={COLORS.primary} />
      <Text style={styles.quickText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { flexGrow: 1 },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  centerText: { color: COLORS.muted, marginTop: 12, fontWeight: "800" },
  layout: {
    flex: 1,
    flexDirection: Platform.OS === "web" ? "row" : "column",
  },
  sidebar: {
    width: Platform.OS === "web" ? 330 : "100%",
    backgroundColor: COLORS.navy,
    padding: 20,
    gap: 11,
  },
  progressCard: {
    backgroundColor: COLORS.navy2,
    borderRadius: 24,
    padding: 18,
    marginBottom: 10,
  },
  progressLabel: { color: "#CBD5E1", fontWeight: "900" },
  progressValue: { color: COLORS.white, fontWeight: "900", fontSize: 34, marginTop: 6 },
  progressText: { color: "#CBD5E1", fontWeight: "700", lineHeight: 20, marginTop: 6 },
  progressTrack: {
    backgroundColor: "#1E293B",
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 13,
  },
  progressFill: { backgroundColor: COLORS.primary, height: "100%" },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    padding: 12,
  },
  stepItemActive: { backgroundColor: "#312E81" },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 13,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  stepIconDone: { backgroundColor: COLORS.green },
  stepIconActive: { backgroundColor: COLORS.primary },
  stepText: { color: "#CBD5E1", fontWeight: "900" },
  stepTextActive: { color: COLORS.white },
  homeButton: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  homeButtonText: { color: COLORS.primary, fontWeight: "900" },

  main: {
    flex: 1,
    padding: 20,
    maxWidth: Platform.OS === "web" ? 920 : undefined,
    alignSelf: "center",
    width: "100%",
  },
  hero: {
    backgroundColor: COLORS.white,
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    color: COLORS.primary,
    fontWeight: "900",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
  },
  title: { color: COLORS.text, fontSize: 29, fontWeight: "900" },
  subtitle: { color: COLORS.muted, lineHeight: 21, fontWeight: "700", marginTop: 6 },
  infoNotice: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  noticeText: { flex: 1, color: COLORS.primaryDark, fontWeight: "800", lineHeight: 19 },
  carrierCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  carrierName: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  carrierEmail: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  carrierMeta: { color: COLORS.primary, fontWeight: "900", marginTop: 5 },
  refreshButton: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
  },
  refreshText: { color: COLORS.primary, fontWeight: "900", fontSize: 12 },
  sectionHeader: { marginTop: 8, marginBottom: 12 },
  sectionTitle: { color: COLORS.text, fontWeight: "900", fontSize: 20 },
  sectionSub: { color: COLORS.muted, fontWeight: "700", marginTop: 3 },
  docCard: {
    backgroundColor: COLORS.card,
    padding: 14,
    borderRadius: 22,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  docHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  docIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  docIconUploaded: { backgroundColor: COLORS.greenSoft },
  docTitleRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  docTitle: { fontSize: 16, fontWeight: "900", color: COLORS.text },
  requiredMark: { color: COLORS.red, fontWeight: "900" },
  docDescription: { color: COLORS.muted, fontWeight: "700", lineHeight: 19, marginTop: 4 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    maxWidth: 155,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusDot: { width: 7, height: 7, borderRadius: 999 },
  statusText: {
    fontWeight: "900",
    fontSize: 11,
    textTransform: "capitalize",
  },
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
    alignSelf: "flex-end",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
    minWidth: 112,
  },
  uploadText: { color: COLORS.white, fontWeight: "900" },
  reviewButton: {
    backgroundColor: COLORS.green,
    padding: 17,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: { opacity: 0.6 },
  reviewText: { color: COLORS.white, fontWeight: "900", fontSize: 15 },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
    marginBottom: 80,
  },
  quickLink: {
    flex: 1,
    minWidth: 170,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    gap: 8,
  },
  quickText: { color: COLORS.text, fontWeight: "900", textAlign: "center" },
});
