// app/farmer/awaiting-approval.tsx

import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

export default function FarmerAwaitingApprovalScreen() {
  const params = useLocalSearchParams();

  const farmerId = String(params.farmerId || "");
  const email = String(params.email || "");
  const businessName = String(params.businessName || "");

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.icon}>⏳</Text>

        <Text style={styles.title}>Application Under Review</Text>

        <Text style={styles.message}>
          Your Farm2Home farmer application has been submitted successfully and
          is now awaiting admin approval.
        </Text>

        {!!businessName && (
          <Text style={styles.detail}>Business: {businessName}</Text>
        )}

        {!!email && (
          <Text style={styles.detail}>Approval email will be sent to: {email}</Text>
        )}

        {!!farmerId && <Text style={styles.smallDetail}>Farmer ID: {farmerId}</Text>}

        <View style={styles.statusBox}>
          <Text style={styles.statusTitle}>Current Status</Text>
          <Text style={styles.statusText}>Pending Admin Review</Text>
        </View>

        <Text style={styles.note}>
          Your farmer store is locked while your application is under review.
          After approval, you will be able to set up your farmer market store.
          The monthly farmer membership starts only after admin approval.
        </Text>

        <Pressable
          style={styles.button}
          onPress={() => router.replace("/farmer/login" as any)}
        >
          <Text style={styles.buttonText}>Return to Farmer Login</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.replace("/" as any)}
        >
          <Text style={styles.secondaryButtonText}>Go to Home</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F5F7EF",
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 22,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 26,
    borderWidth: 1,
    borderColor: "#DDE7DB",
    alignItems: "center",
  },
  icon: {
    fontSize: 58,
    marginBottom: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#14532D",
    textAlign: "center",
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    fontWeight: "800",
    color: "#334155",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 14,
  },
  detail: {
    fontSize: 15,
    fontWeight: "900",
    color: "#047857",
    textAlign: "center",
    marginBottom: 8,
  },
  smallDetail: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748B",
    textAlign: "center",
    marginBottom: 12,
  },
  statusBox: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    width: "100%",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 18,
  },
  statusTitle: {
    color: "#047857",
    fontWeight: "900",
    fontSize: 13,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  statusText: {
    color: "#14532D",
    fontWeight: "900",
    fontSize: 18,
  },
  note: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#14532D",
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderRadius: 18,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#14532D",
    paddingVertical: 15,
    paddingHorizontal: 22,
    borderRadius: 18,
    width: "100%",
    alignItems: "center",
    marginTop: 12,
  },
  secondaryButtonText: {
    color: "#14532D",
    fontWeight: "900",
    fontSize: 15,
  },
});