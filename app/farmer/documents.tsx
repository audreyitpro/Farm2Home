import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";

import {
  BusinessDocument,
  getVerificationRecordById,
  upsertVerificationRecord,
} from "../data/adminStore";

type DocStatus = "Not Uploaded" | "Uploaded" | "Under Review";

const API_BASE_URL = "http://localhost:4242";

const REQUIRED_DOCS = [
  "Business Registration / LLC Documents",
  "W-9 Tax Form",
  "Food Safety Registration or License",
  "Sales Tax / Exemption Certificate",
  "Liability Insurance",
  "Farm Ownership / Lease / Operating Proof",
];

export default function Documents() {
  const params = useLocalSearchParams();
  const farmerId = String(params.farmerId || "");

  const [submittedDocs, setSubmittedDocs] = useState<Record<string, DocStatus>>(
    REQUIRED_DOCS.reduce((acc, doc) => {
      acc[doc] = "Not Uploaded";
      return acc;
    }, {} as Record<string, DocStatus>)
  );

  const [documents, setDocuments] = useState<BusinessDocument[]>([]);
  const [loading, setLoading] = useState(false);

  async function notifyAdminDocumentsSubmitted(record: any) {
    try {
      const response = await fetch(`${API_BASE_URL}/notify/documents-submitted`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(record),
      });

      const data = await response.json();

      if (!response.ok) {
        console.log("Documents email failed:", data);
      }
    } catch (error) {
      console.log("Documents email error:", error);
    }
  }

  async function uploadDocument(docType: string) {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const file = result.assets[0];

    const newDoc: BusinessDocument = {
      id: `doc_${Date.now()}`,
      name: file.name || docType,
      type: docType,
      uri: file.uri,
      uploadedAt: new Date().toISOString(),
      status: "PENDING",
    } as BusinessDocument;

    setDocuments((prev) => [
      ...prev.filter((item) => item.type !== docType),
      newDoc,
    ]);

    setSubmittedDocs((prev) => ({
      ...prev,
      [docType]: "Uploaded",
    }));

    Alert.alert("Document Attached", `${docType} was uploaded.`);
  }

  async function submitForReview() {
    const missing = REQUIRED_DOCS.filter(
      (doc) => submittedDocs[doc] === "Not Uploaded"
    );

    if (missing.length > 0) {
      Alert.alert(
        "Missing Documents",
        "Please upload all required documents before submitting for review."
      );
      return;
    }

    if (!farmerId) {
      Alert.alert(
        "Missing Farmer ID",
        "Please return to registration and start the verification process again."
      );
      return;
    }

    try {
      setLoading(true);

      const record = await getVerificationRecordById(farmerId);

      if (!record) {
        Alert.alert(
          "Verification Record Missing",
          "Unable to find this farmer verification record."
        );
        return;
      }

      const updatedRecord = {
        ...record,
        documents,
        status: "DOCUMENTS_SUBMITTED" as const,
        updatedAt: new Date().toISOString(),
      };

      await upsertVerificationRecord(updatedRecord);
      await notifyAdminDocumentsSubmitted(updatedRecord);

      setSubmittedDocs((prev) => {
        const updated = { ...prev };

        REQUIRED_DOCS.forEach((doc) => {
          updated[doc] = "Under Review";
        });

        return updated;
      });

      Alert.alert(
        "Submitted for Review",
        "Your farm documents were submitted. Farm2Home admin has been notified and will review your application before approval."
      );

      router.replace("/farmer/login");
    } catch (error) {
      console.log("Submit documents error", error);
      Alert.alert("Submission Error", "Unable to submit documents for review.");
    } finally {
      setLoading(false);
    }
  }

  function getDocumentForType(docType: string) {
    return documents.find((doc) => doc.type === docType);
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Farmer Documents</Text>

      <Text style={styles.subtitle}>
        Upload required business and farm verification documents for admin
        review.
      </Text>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Farm2Home Verification</Text>

        <Text style={styles.noticeText}>
          Your farmer account remains pending until Farm2Home admin reviews your
          documents, insurance, tax forms, and compliance records.
        </Text>
      </View>

      {REQUIRED_DOCS.map((doc) => {
        const uploadedDoc = getDocumentForType(doc);

        return (
          <View key={doc} style={styles.card}>
            <Text style={styles.docTitle}>{doc}</Text>

            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Status:</Text>

              <View
                style={[
                  styles.statusBadge,
                  submittedDocs[doc] === "Not Uploaded" &&
                    styles.notUploadedBadge,
                  submittedDocs[doc] === "Uploaded" && styles.uploadedBadge,
                  submittedDocs[doc] === "Under Review" && styles.reviewBadge,
                ]}
              >
                <Text style={styles.statusText}>{submittedDocs[doc]}</Text>
              </View>
            </View>

            {uploadedDoc && (
              <View style={styles.fileBox}>
                <Text style={styles.fileName}>{uploadedDoc.name}</Text>
                <Text style={styles.fileMeta}>Type: {uploadedDoc.type}</Text>
                <Text style={styles.fileMeta}>
                  Uploaded:{" "}
                  {uploadedDoc.uploadedAt
                    ? new Date(uploadedDoc.uploadedAt).toLocaleString()
                    : "Just now"}
                </Text>
              </View>
            )}

            {submittedDocs[doc] !== "Under Review" && (
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => uploadDocument(doc)}
              >
                <Text style={styles.uploadText}>Upload / Replace Document</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      <TouchableOpacity
        style={[styles.reviewButton, loading && styles.disabledButton]}
        onPress={submitForReview}
        disabled={loading}
      >
        <Text style={styles.reviewText}>
          {loading ? "Submitting..." : "Submit Documents for Admin Review"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.replace("/farmer/login")}
      >
        <Text style={styles.backText}>Back to Farmer Login</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F7F7F2",
  },

  content: {
    padding: 20,
    paddingBottom: 50,
  },

  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#2F7D32",
    marginBottom: 8,
  },

  subtitle: {
    color: "#555555",
    lineHeight: 22,
    marginBottom: 18,
  },

  notice: {
    backgroundColor: "#E8F5E9",
    padding: 15,
    borderRadius: 14,
    borderLeftWidth: 5,
    borderLeftColor: "#2F7D32",
    marginBottom: 18,
  },

  noticeTitle: {
    fontWeight: "900",
    color: "#2F7D32",
    marginBottom: 6,
  },

  noticeText: {
    color: "#444444",
    lineHeight: 21,
  },

  card: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  docTitle: {
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 12,
    color: "#111827",
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },

  statusLabel: {
    fontWeight: "900",
    marginRight: 10,
    color: "#111827",
  },

  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },

  notUploadedBadge: {
    backgroundColor: "#B71C1C",
  },

  uploadedBadge: {
    backgroundColor: "#1565C0",
  },

  reviewBadge: {
    backgroundColor: "#EF6C00",
  },

  statusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },

  fileBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
  },

  fileName: {
    color: "#111827",
    fontWeight: "900",
    marginBottom: 4,
  },

  fileMeta: {
    color: "#64748B",
    fontWeight: "700",
    marginBottom: 3,
  },

  uploadButton: {
    backgroundColor: "#1565C0",
    padding: 13,
    borderRadius: 12,
    alignItems: "center",
  },

  uploadText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  reviewButton: {
    backgroundColor: "#2F7D32",
    padding: 17,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },

  disabledButton: {
    backgroundColor: "#9CA3AF",
  },

  reviewText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },

  backButton: {
    backgroundColor: "#111827",
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 14,
  },

  backText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});