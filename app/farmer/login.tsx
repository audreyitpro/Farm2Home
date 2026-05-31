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

function isEmail(value: string) {
  return normalize(value).includes("@");
}

export default function FarmerLoginScreen() {
  const [loginId, setLoginId] = useState("");
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

      farmName:
        farmer.farm_name || farmer.farmName || farmer.business_name || "",
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
      farmerStripeAccountId:
        farmer.farmer_stripe_account_id ||
        farmer.stripe_account_id ||
        farmer.farmerStripeAccountId ||
        "",
      stripePayoutsEnabled: Boolean(
        farmer.stripe_payouts_enabled || farmer.stripePayoutsEnabled
      ),
      stripeChargesEnabled: Boolean(
        farmer.stripe_charges_enabled || farmer.stripeChargesEnabled
      ),
      stripeOnboardingComplete: Boolean(
        farmer.stripe_onboarding_complete || farmer.stripeOnboardingComplete
      ),

      pickupDeliveryOption:
        farmer.pickup_delivery_option || farmer.pickupDeliveryOption || "",

      updatedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem("currentFarmer", JSON.stringify(localFarmer));
    await AsyncStorage.setItem("currentUser", JSON.stringify(localFarmer));
    await AsyncStorage.setItem("userRole", "farmer");
    await AsyncStorage.setItem("currentUserRole", "farmer");

    return localFarmer;
  }

  async function findFarmerByEmailOrUsername(value: string) {
    const cleanValue = normalize(value);

    if (!cleanValue) return null;

    if (isEmail(cleanValue)) {
      const { data, error } = await supabase
        .from("farmers")
        .select("*")
        .eq("email", cleanValue)
        .maybeSingle();

      if (error) throw error;
      return data;
    }

    const { data, error } = await supabase
      .from("farmers")
      .select("*")
      .eq("username", cleanValue)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async function getFarmerProfile(authUserId: string, authEmail: string) {
    let farmer: any = null;

    if (authUserId) {
      const { data, error } = await supabase
        .from("farmers")
        .select("*")
        .eq("id", authUserId)
        .maybeSingle();

      if (error) throw error;
      farmer = data;
    }

    if (!farmer && authEmail) {
      farmer = await findFarmerByEmailOrUsername(authEmail);
    }

    if (!farmer && loginId) {
      farmer = await findFarmerByEmailOrUsername(loginId);
    }

    return farmer;
  }

  function farmerPasswordMatches(farmer: any, enteredPassword: string) {
    const savedPassword = String(
      farmer.password ||
        farmer.farmer_password ||
        farmer.account_password ||
        ""
    ).trim();

    if (!savedPassword) return false;

    return savedPassword === enteredPassword.trim();
  }

  function routeFarmer(farmer: any) {
    const rejected =
      farmer.rejected === true ||
      farmer.review_decision === "rejected" ||
      farmer.admin_review_status === "rejected" ||
      farmer.compliance_status === "rejected";

    const needsMoreInfo =
      farmer.needs_more_info === true ||
      farmer.review_decision === "needs_more_info" ||
      farmer.admin_review_status === "needs_more_info" ||
      farmer.compliance_status === "needs_more_info";

    const approved =
      farmer.approved === true ||
      farmer.review_decision === "approved" ||
      farmer.admin_review_status === "approved" ||
      farmer.compliance_status === "approved";

    const submitted =
      farmer.compliance_submitted === true ||
      farmer.compliance_status === "pending_admin_review" ||
      farmer.admin_review_status === "pending" ||
      farmer.review_decision === "pending";

    const storeUnlocked =
      farmer.store_unlocked === true ||
      farmer.storeUnlocked === true ||
      farmer.account_active === true ||
      farmer.accountActive === true ||
      approved;

    if (rejected) {
      Alert.alert(
        "Application Rejected",
        "This farmer application was rejected. Contact Farm2Home support."
      );
      return;
    }

    if (needsMoreInfo) {
      router.replace({
        pathname: "/farmer/compliance-upload",
        params: {
          farmerId: farmer.id,
          email: farmer.email,
          businessName: farmer.business_name || farmer.farm_name || "",
          needsMoreInfo: "true",
        },
      } as any);
      return;
    }

    if (!approved && submitted) {
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

    if (!approved) {
      router.replace({
        pathname: "/farmer/compliance-upload",
        params: {
          farmerId: farmer.id,
          email: farmer.email,
          businessName: farmer.business_name || farmer.farm_name || "",
        },
      } as any);
      return;
    }

    if (approved && storeUnlocked) {
      router.replace("/farmer/setup-store" as any);
      return;
    }

    router.replace("/farmer/dashboard" as any);
  }

  async function handleLogin() {
    const cleanLogin = normalize(loginId);
    const cleanPassword = String(password || "").trim();

    if (!cleanLogin || !cleanPassword) {
      Alert.alert("Missing Information", "Enter email/username and password.");
      return;
    }

    try {
      setLoading(true);

      let farmer: any = null;
      let authErrorMessage = "";

      if (isEmail(cleanLogin)) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanLogin,
          password: cleanPassword,
        });

        if (!error) {
          const userId = data?.user?.id || "";
          const authEmail = data?.user?.email || cleanLogin;
          farmer = await getFarmerProfile(userId, authEmail);
        } else {
          authErrorMessage = error.message || "";
        }
      }

      if (!farmer) {
        const fallbackFarmer = await findFarmerByEmailOrUsername(cleanLogin);

        if (!fallbackFarmer) {
          Alert.alert(
            "Login Failed",
            authErrorMessage ||
              "No farmer account was found with that email or username."
          );
          return;
        }

        const passwordMatches = farmerPasswordMatches(
          fallbackFarmer,
          cleanPassword
        );

        if (!passwordMatches) {
          Alert.alert(
            "Login Failed",
            "Password did not match this farmer profile. Use the email/password created during registration or reset your password."
          );
          return;
        }

        farmer = fallbackFarmer;
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
    const cleanEmail = normalize(resetEmail || loginId);

    if (!cleanEmail || !isEmail(cleanEmail)) {
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
          Log in with your farmer email or username to manage your application
          and market store.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Farmer Email or Username"
          placeholderTextColor="#6B7280"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={loginId}
          onChangeText={setLoginId}
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
            setResetEmail(loginId);
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
                Enter your farmer email. Farm2Home will send a secure reset
                link if the account exists in Supabase Auth.
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