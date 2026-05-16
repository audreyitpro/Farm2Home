import React, { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type VerificationStatus = "Needs Review" | "Verified" | "Rejected";

type FarmerVerification = {
  id: string;
  farmName: string;
  owner: string;
  documents: string[];
  location: string;
  status: VerificationStatus;
};

const starterFarmers: FarmerVerification[] = [
  {
    id: "f1",
    farmName: "Green Valley Farm",
    owner: "Sarah Johnson",
    location: "Sterling Heights, MI",
    documents: ["Business License", "Food Safety Form", "Insurance"],
    status: "Needs Review",
  },
  {
    id: "f2",
    farmName: "Sunrise Produce Farm",
    owner: "Marcus Lee",
    location: "Macomb County, MI",
    documents: ["Farm Registration", "Insurance"],
    status: "Needs Review",
  },
];

export default function FarmerVerification() {
  const [farmers, setFarmers] = useState<FarmerVerification[]>(starterFarmers);

  const needsReview = useMemo(() => {
    return farmers.filter((farmer) => farmer.status === "Needs Review").length;
  }, [farmers]);

  function updateFarmer(id: string, status: VerificationStatus) {
    setFarmers((prev) =>
      prev.map((farmer) => (farmer.id === id ? { ...farmer, status } : farmer))
    );

    Alert.alert("Farmer Updated", `Verification changed to ${status}.`);
  }

  function statusStyle(status: VerificationStatus) {
    if (status === "Verified") return styles.verified;
    if (status === "Rejected") return styles.rejected;
    return styles.review;
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Admin Verification</Text>
        <Text style={styles.title}>Farmer Verification</Text>
        <Text style={styles.subtitle}>
          Review farm documents, compliance items, insurance, and marketplace
          eligibility.
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Needs Review</Text>
        <Text style={styles.summaryNumber}>{needsReview}</Text>
        <Text style={styles.summaryText}>
          Farmers waiting for verification approval.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Farm Verification Queue</Text>

      {farmers.map((farmer) => (
        <View key={farmer.id} style={styles.farmCard}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.farmName}>{farmer.farmName}</Text>
              <Text style={styles.ownerText}>Owner: {farmer.owner}</Text>
              <Text style={styles.ownerText}>{farmer.location}</Text>
            </View>

            <Text style={[styles.statusBadge, statusStyle(farmer.status)]}>
              {farmer.status}
            </Text>
          </View>

          <Text style={styles.docTitle}>Documents</Text>
          {farmer.documents.map((doc) => (
            <Text key={doc} style={styles.docItem}>
              ✓ {doc}
            </Text>
          ))}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.verifyButton}
              onPress={() => updateFarmer(farmer.id, "Verified")}
            >
              <Text style={styles.verifyText}>Verify</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.rejectButton}
              onPress={() => updateFarmer(farmer.id, "Rejected")}
            >
              <Text style={styles.rejectText}>Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  hero: {
    backgroundColor: "#111827",
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  eyebrow: { color: "#93C5FD", fontWeight: "900", marginBottom: 8 },
  title: { color: "#FFFFFF", fontSize: 35, fontWeight: "900", marginBottom: 10 },
  subtitle: { color: "#D1D5DB", fontWeight: "700", lineHeight: 23 },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    margin: 18,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  summaryLabel: { color: "#6B7280", fontWeight: "900" },
  summaryNumber: { color: "#2563EB", fontSize: 44, fontWeight: "900", marginTop: 4 },
  summaryText: { color: "#6B7280", fontWeight: "700", lineHeight: 22, marginTop: 6 },
  sectionTitle: {
    color: "#111827",
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  farmCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  headerRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  farmName: { color: "#111827", fontSize: 19, fontWeight: "900" },
  ownerText: { color: "#6B7280", fontWeight: "700", marginTop: 5 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 12,
    fontWeight: "900",
  },
  review: { backgroundColor: "#FEF3C7", color: "#92400E" },
  verified: { backgroundColor: "#DCFCE7", color: "#166534" },
  rejected: { backgroundColor: "#FEE2E2", color: "#991B1B" },
  docTitle: { color: "#111827", fontWeight: "900", marginTop: 14, marginBottom: 6 },
  docItem: { color: "#374151", fontWeight: "800", lineHeight: 24 },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  verifyButton: {
    flex: 1,
    backgroundColor: "#2563EB",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  verifyText: { color: "#FFFFFF", fontWeight: "900" },
  rejectButton: {
    flex: 1,
    backgroundColor: "#FEE2E2",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  rejectText: { color: "#DC2626", fontWeight: "900" },
});