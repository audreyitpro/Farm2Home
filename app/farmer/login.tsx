// app/farmer/login.tsx

import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

import { supabase } from "../services/supabaseClient";

const COLORS = {
  bg: "#F4F8F1",
  card: "#FFFFFF",
  text: "#102A1C",
  muted: "#66756B",
  border: "#DDE8D8",
  primary: "#166534",
  soft: "#ECFDF5",
  gold: "#F59E0B",
  danger: "#B91C1C",
};

function normalize(value: string) {
  return String(value || "").trim().toLowerCase();
}

function isEmail(value: string) {
  return normalize(value).includes("@");
}

function normalizeStatus(value: any) {
  return String(value || "").trim().toUpperCase();
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
      profileId: farmer.profile_id || farmer.profileId || "",
      role: "farmer",

      email: farmer.email || "",
      username: farmer.username || "",

      farmName:
        farmer.farm_name || farmer.farmName || farmer.business_name || "",
      businessName:
        farmer.business_name || farmer.businessName || farmer.farm_name || "",
      ownerName: farmer.owner_name || farmer.ownerName || "",
      state: farmer.state || "MI",

      status: farmer.status || "",
      verificationStatus:
        farmer.verification_status || farmer.verificationStatus || "",
      complianceStatus:
        farmer.compliance_status || farmer.complianceStatus || "",

      approved: Boolean(farmer.approved),
      rejected: Boolean(farmer.rejected),
      reviewed: Boolean(farmer.reviewed),
      needsMoreInfo: Boolean(farmer.needs_more_info || farmer.needsMoreInfo),

      accountActive: Boolean(farmer.account_active || farmer.accountActive),
      storeUnlocked: Boolean(farmer.store_unlocked || farmer.storeUnlocked),

      complianceSubmitted: Boolean(
        farmer.compliance_submitted || farmer.complianceSubmitted
      ),
      hasCompletedCompliance: Boolean(
        farmer.has_completed_compliance || farmer.hasCompletedCompliance
      ),

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
    await AsyncStorage.setItem("pendingFarmerApplication", JSON.stringify(localFarmer));
    await AsyncStorage.setItem("currentUser", JSON.stringify(localFarmer));
    await AsyncStorage.setItem("userRole", "farmer");
    await AsyncStorage.setItem("currentUserRole", "farmer");

    return localFarmer;
  }

  async function getFarmerProfile(authUserId: string, authEmail: string) {
    let farmer: any = null;

    if (authUserId) {
      const byId = await supabase
        .from("farmers")
        .select("*")
        .eq("id", authUserId)
        .maybeSingle();

      if (byId.error) throw byId.error;
      farmer = byId.data;
    }

    if (!farmer && authUserId) {
      const byProfileId = await supabase
        .from("farmers")
        .select("*")
        .eq("profile_id", authUserId)
        .maybeSingle();

      if (byProfileId.error) {
        console.log("profile_id lookup skipped:", byProfileId.error.message);
      } else {
        farmer = byProfileId.data;
      }
    }

    if (!farmer && authEmail) {
      const byEmail = await supabase
        .from("farmers")
        .select("*")
        .eq("email", normalize(authEmail))
        .maybeSingle();

      if (byEmail.error) throw byEmail.error;
      farmer = byEmail.data;
    }

    if (!farmer && loginId) {
      const byLoginEmail = await supabase
        .from("farmers")
        .select("*")
        .eq("email", normalize(loginId))
        .maybeSingle();

      if (byLoginEmail.error) throw byLoginEmail.error;
      farmer = byLoginEmail.data;
    }

    if (!farmer) {
      const saved =
        (await AsyncStorage.getItem("currentFarmer")) ||
        (await AsyncStorage.getItem("pendingFarmerApplication")) ||
        (await AsyncStorage.getItem("currentUser"));

      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed?.role === "farmer" || parsed?.farmerId || parsed?.id) {
            farmer = parsed;
          }
        } catch {}
      }
    }

    return farmer;
  }

  function routeFarmer(farmer: any) {
    const status = normalizeStatus(
      farmer.status ||
        farmer.verification_status ||
        farmer.verificationStatus ||
        farmer.compliance_status ||
        farmer.complianceStatus
    );

    const isRejected =
      farmer.rejected === true ||
      status === "REJECTED" ||
      normalizeStatus(farmer.review_decision || farmer.reviewDecision) ===
        "REJECTED" ||
      normalizeStatus(farmer.admin_review_status || farmer.adminReviewStatus) ===
        "REJECTED";

    const needsMoreInfo =
      farmer.needs_more_info === true ||
      farmer.needsMoreInfo === true ||
      status === "NEEDS_MORE_INFO" ||
      normalizeStatus(farmer.review_decision || farmer.reviewDecision) ===
        "NEEDS_MORE_INFO" ||
      normalizeStatus(farmer.admin_review_status || farmer.adminReviewStatus) ===
        "NEEDS_MORE_INFO";

    if (isRejected) {
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
          farmerId: farmer.id || farmer.farmerId || "",
          email: farmer.email || "",
          businessName:
            farmer.business_name ||
            farmer.businessName ||
            farmer.farm_name ||
            farmer.farmName ||
            "",
          needsMoreInfo: "true",
        },
      } as any);
      return;
    }

    const stripeConnected = Boolean(
      farmer.stripe_account_id ||
        farmer.farmer_stripe_account_id ||
        farmer.stripeAccountId ||
        farmer.farmerStripeAccountId
    );

    const activeOrComplete =
      status === "ACTIVE" ||
      status === "APPROVED" ||
      status === "COMPLETE" ||
      farmer.approved === true ||
      farmer.account_active === true ||
      farmer.accountActive === true ||
      farmer.store_unlocked === true ||
      farmer.storeUnlocked === true ||
      farmer.compliance_submitted === true ||
      farmer.complianceSubmitted === true ||
      farmer.has_completed_compliance === true ||
      farmer.hasCompletedCompliance === true ||
      stripeConnected === true;

    if (activeOrComplete) {
      router.replace("/farmer/dashboard" as any);
      return;
    }

    router.replace({
      pathname: "/farmer/compliance-upload",
      params: {
        farmerId: farmer.id || farmer.farmerId || "",
        email: farmer.email || "",
        businessName:
          farmer.business_name ||
          farmer.businessName ||
          farmer.farm_name ||
          farmer.farmName ||
          "",
      },
    } as any);
  }

  async function handleLogin() {
    const cleanLogin = normalize(loginId);
    const cleanPassword = String(password || "").trim();

    if (!cleanLogin || !cleanPassword) {
      Alert.alert("Missing Information", "Enter email and password.");
      return;
    }

    if (!isEmail(cleanLogin)) {
      Alert.alert(
        "Email Required",
        "Please enter the email connected to your farmer account."
      );
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanLogin,
        password: cleanPassword,
      });

      if (error) {
        Alert.alert("Login Failed", error.message);
        return;
      }

      const userId = data?.user?.id || "";
      const authEmail = data?.user?.email || cleanLogin;

      const farmer = await getFarmerProfile(userId, authEmail);

      if (!farmer) {
        const fallbackFarmer = {
          id: userId,
          farmerId: userId,
          profile_id: userId,
          email: authEmail,
          role: "farmer",
          status: "ACTIVE",
          verification_status: "ACTIVE",
          compliance_status: "COMPLETE",
          compliance_submitted: true,
          has_completed_compliance: true,
          account_active: true,
          store_unlocked: true,
        };

        await saveFarmerSession(fallbackFarmer);
        router.replace("/farmer/dashboard" as any);
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
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>FARM2HOME FARMER PORTAL</Text>
          </View>

          <Text style={styles.heroIcon}>🌾</Text>
          <Text style={styles.heroTitle}>Welcome Back, Farmer</Text>
          <Text style={styles.heroSubtitle}>
            Active farmers go directly to the Farmer Dashboard. Compliance is
            completed one time during first setup only.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Farmer Login</Text>
          <Text style={styles.cardSubtitle}>
            Use the email and password connected to your farmer account.
          </Text>

          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="farmer@email.com"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={loginId}
            onChangeText={setLoginId}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter password"
            placeholderTextColor="#94A3B8"
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
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.loginButtonText}>
                Login to Farmer Dashboard
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              setResetEmail(loginId);
              setResetVisible(true);
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryButtonText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.registerButton}
            onPress={() => router.push("/farmer/register" as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.registerButtonText}>
              New farmer? Start registration
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Farmer Setup Flow</Text>
          <Text style={styles.infoText}>
            Register → Complete Compliance Once → Pay Application Fee → Pay
            Membership → Connect Stripe → Submit → Farmer Dashboard.
          </Text>
        </View>
      </ScrollView>

      <Modal visible={resetVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalIcon}>🔐</Text>
              <Text style={styles.modalTitle}>Reset Farmer Password</Text>
              <Text style={styles.modalSubtitle}>
                Enter your farmer email. Farm2Home will send a secure reset
                link.
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Farmer Email"
                placeholderTextColor="#94A3B8"
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  content: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
  },
  hero: {
    backgroundColor: COLORS.primary,
    borderRadius: 32,
    padding: 24,
    marginBottom: 16,
    alignItems: "center",
  },
  badge: {
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 12,
  },
  badgeText: {
    color: "#DCFCE7",
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 0.8,
  },
  heroIcon: { fontSize: 48, marginBottom: 8 },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 31,
    fontWeight: "900",
    textAlign: "center",
  },
  heroSubtitle: {
    color: "#DCFCE7",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 22,
    marginTop: 8,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
  },
  cardSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 18,
  },
  label: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 13,
    marginBottom: 7,
    marginTop: 6,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 15,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 13,
    color: "#0F172A",
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 17,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 6,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: COLORS.soft,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    paddingVertical: 15,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 12,
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontWeight: "900",
  },
  registerButton: {
    paddingVertical: 16,
    alignItems: "center",
  },
  registerButtonText: {
    color: COLORS.gold,
    fontWeight: "900",
  },
  infoCard: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    marginTop: 16,
  },
  infoTitle: {
    color: "#92400E",
    fontWeight: "900",
    marginBottom: 5,
  },
  infoText: {
    color: "#78350F",
    fontWeight: "700",
    lineHeight: 21,
  },
  disabled: { opacity: 0.65 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 22,
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 22,
    maxHeight: "90%",
  },
  modalIcon: {
    fontSize: 42,
    textAlign: "center",
    marginBottom: 8,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 25,
    fontWeight: "900",
    textAlign: "center",
  },
  modalSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 18,
  },
  closeButton: {
    marginTop: 16,
    alignItems: "center",
  },
  closeText: {
    color: COLORS.danger,
    fontWeight: "900",
  },
});