import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

export default function FarmerAwaitingApprovalScreen() {
  const params = useLocalSearchParams();

  const email = String(params.email || "");
  const businessName = String(params.businessName || "");

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.icon}>⏳</Text>

        <Text style={styles.title}>Awaiting Admin Approval</Text>

        <Text style={styles.message}>
          Your farmer application has been submitted for compliance review.
        </Text>

        {!!businessName && (
          <Text style={styles.detail}>Business: {businessName}</Text>
        )}

        {!!email && (
          <Text style={styles.detail}>
            We will send an approval email to: {email}
          </Text>
        )}

        <Text style={styles.note}>
          Once approved, you will be able to complete your farmer activation,
          monthly subscription, and farmer market setup.
        </Text>

        <Pressable
          style={styles.button}
          onPress={() => router.replace("/farmer/login" as any)}
        >
          <Text style={styles.buttonText}>Return to Farmer Login</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F7EF" },
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
    fontSize: 56,
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
  note: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
    marginTop: 8,
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
});