// app/farmer/login.tsx

import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase: any = createClient(supabaseUrl, supabaseAnonKey);

function normalize(value: string) {
  return String(value || "").trim().toLowerCase();
}

export default function FarmerLoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [resetVisible, setResetVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  async function saveFarmerSession(farmer: any) {
    const localFarmer = {
      id: farmer.id,
      farmerId: farmer.id,
      role: "farmer",

      email: farmer.email || "",
      username: farmer.username || "",

      farmName: farmer.farm_name || farmer.farmName || farmer.business_name || "",
      businessName:
        farmer.business_name || farmer.businessName || farmer.farm_name || "",
      ownerName: farmer.owner_name || farmer.ownerName || "",

      state: farmer.state || "MI",

      approved: Boolean(farmer.approved),
      rejected: Boolean(farmer.rejected),
      reviewed: Boolean(farmer.reviewed),
      needsMoreInfo: Boolean(farmer.needs_more_info || farmer.needsMoreInfo),

      accountActive: Boolean(farmer.account_active || farmer.accountActive),
      storeUnlocked: Boolean(farmer.store_unlocked || farmer.storeUnlocked),

      complianceSubmitted: Boolean(
        farmer.compliance_submitted || farmer.complianceSubmitted
      ),
      complianceStatus: farmer.compliance_status || farmer.complianceStatus || "",
      adminReviewStatus:
        farmer.admin_review_status || farmer.adminReviewStatus || "",
      reviewDecision: farmer.review_decision || farmer.reviewDecision || "",

      applicationFeePaid: Boolean(
        farmer.application_fee_paid || farmer.applicationFeePaid
      ),
      farmerMembershipPaid: Boolean(
        farmer.farmer_membership_paid || farmer.farmerMembershipPaid
      ),
      monthlyMembershipStarted: Boolean(
        farmer.monthly_membership_started || farmer.monthlyMembershipStarted
      ),

      stripeAccountId:
        farmer.stripe_account_id ||
        farmer.farmer_stripe_account_id ||
        farmer.stripeAccountId ||
        "",
      stripePayoutsEnabled: Boolean(
        farmer.stripe_payouts_enabled || farmer.stripePayoutsEnabled
      ),

      updatedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem("currentFarmer", JSON.stringify(localFarmer));
    await AsyncStorage.setItem("currentUser", JSON.stringify(localFarmer));
    await AsyncStorage.setItem("userRole", "farmer");
    await AsyncStorage.setItem("currentUserRole", "farmer");

    return localFarmer;
  }

  function routeFarmer(farmer: any) {
    const rejected = farmer.rejected === true;
    const approved = farmer.approved === true;
    const storeUnlocked =
      farmer.store_unlocked === true || farmer.storeUnlocked === true;
    const complianceStatus =
      farmer.compliance_status || farmer.complianceStatus || "";

    if (rejected) {
      Alert.alert(
        "Application Rejected",
        "This farmer application was rejected. Contact Farm2Home support."
      );
      return;
    }

    if (!approved || complianceStatus === "pending_admin_review") {
      router.replace({
        pathname: "/farmer/awaiting-approval",
        params: {
          farmerId: farmer.id,
          email: farmer.email,
          businessName: farmer.business_name || farmer.farm_name || "",
        },
      } as any);
      return;
    }

    if (approved && !storeUnlocked) {
      router.replace("/farmer/setup-store" as any);
      return;
    }

    router.replace("/farmer/dashboard" as any);
  }

  async function handleLogin() {
    const cleanEmail = normalize(email);
    const cleanPassword = String(password || "").trim();

    if (!cleanEmail || !cleanPassword) {
      Alert.alert("Missing Information", "Enter email and password.");
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (error) {
        Alert.alert("Login Failed", error.message);
        return;
      }

      const userId = data?.user?.id;

      if (!userId) {
        Alert.alert("Login Error", "Unable to confirm user account.");
        return;
      }

      const { data: farmer, error: farmerError } = await supabase
        .from("farmers")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (farmerError) {
        Alert.alert("Profile Error", farmerError.message);
        return;
      }

      if (!farmer) {
        Alert.alert(
          "Farmer Profile Missing",
          "Your login exists, but your farmer profile was not found. Please contact Farm2Home support."
        );
        return;
      }

      await saveFarmerSession(farmer);
      routeFarmer(farmer);
    } catch (error: any) {
      console.log("Farmer login error:", error);
      Alert.alert("Login Error", error?.message || "Unable to login.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset() {
    const cleanEmail = normalize(resetEmail || email);

    if (!cleanEmail) {
      Alert.alert("Email Required", "Enter your farmer email.");
      return;
    }

    try {
      setResetLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: "farm2home://reset-password",
      });

      if (error) {
        Alert.alert("Reset Error", error.message);
        return;
      }

      Alert.alert(
        "Password Reset Sent",
        "Check your email for the secure password reset link."
      );

      setResetVisible(false);
      setResetEmail("");
    } catch (error: any) {
      Alert.alert(
        "Reset Error",
        error?.message || "Unable to send password reset email."
      );
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Farmer Login</Text>

        <Text style={styles.subtitle}>
          Log in to manage your Farm2Home farmer application and market store.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#6B7280"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#6B7280"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={[styles.loginButton, loading && styles.disabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.loginButtonText}>Login</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => {
            setResetEmail(email);
            setResetVisible(true);
          }}
        >
          <Text style={styles.linkText}>Forgot Password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.push("/farmer/register" as any)}
        >
          <Text style={styles.linkText}>Register as Farmer</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={resetVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Reset Password</Text>

              <Text style={styles.modalSubtitle}>
                Enter your farmer email. Farm2Home will send a secure reset link.
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Farmer Email"
                placeholderTextColor="#6B7280"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={resetEmail}
                onChangeText={setResetEmail}
              />

              <TouchableOpacity
                style={[styles.loginButton, resetLoading && styles.disabled]}
                onPress={handlePasswordReset}
                disabled={resetLoading}
              >
                {resetLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.loginButtonText}>Send Reset Link</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setResetVisible(false);
                  setResetEmail("");
                }}
              >
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7EF",
    justifyContent: "center",
    alignItems: "center",
    padding: 22,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    padding: 24,
    borderWidth: 1,
    borderColor: "#DDE7DB",
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#14532D",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    color: "#64745E",
    fontWeight: "700",
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 22,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 16,
    padding: 14,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 14,
    color: "#111827",
  },
  loginButton: {
    backgroundColor: "#047857",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  disabled: {
    opacity: 0.65,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  linkButton: {
    marginTop: 16,
    alignItems: "center",
  },
  linkText: {
    color: "#047857",
    fontWeight: "900",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 22,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 22,
    maxHeight: "90%",
  },
  modalTitle: {
    color: "#14532D",
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
  },
  modalSubtitle: {
    color: "#64745E",
    fontWeight: "700",
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 18,
  },
  closeButton: {
    marginTop: 16,
    alignItems: "center",
  },
  closeText: {
    color: "#B91C1C",
    fontWeight: "900",
  },
});