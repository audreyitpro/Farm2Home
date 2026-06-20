// app/freight/login.tsx

import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../services/supabaseClient";
import freightTheme from "../styles/freightTheme";

type FreightUser = {
  id: string;
  freightId: string;
  freight_id: string;
  profileId: string;
  profile_id: string;
  authUserId: string;
  auth_user_id: string;
  role: "freight";

  accountId: string;
  account_id: string;

  companyName: string;
  company_name: string;
  businessName: string;
  business_name: string;
  contactName: string;
  contact_name: string;
  fullName: string;
  full_name: string;
  email: string;
  phone: string;
  username: string;

  stripeCustomerId: string;
  stripe_customer_id: string;
  stripeSubscriptionId: string;
  stripe_subscription_id: string;
  subscriptionId: string;
  subscription_id: string;
  freightAccount: string;
  freight_account: string;
  stripeAccountId: string;
  stripe_account_id: string;

  accountActive: boolean;
  account_active: boolean;
  membershipStatus: string;
  membership_status: string;
  subscriptionStatus: string;
  subscription_status: string;
  approved: boolean;
  verificationStatus: string;
  verification_status: string;
};

function clean(value: any) {
  return String(value || "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function isCus(value: any) {
  return clean(value).startsWith("cus_");
}

function isSub(value: any) {
  return clean(value).startsWith("sub_");
}

function isAcct(value: any) {
  return clean(value).startsWith("acct_");
}

function pickCus(...values: any[]) {
  const found = values.find(isCus);
  return found ? clean(found) : "";
}

function pickSub(...values: any[]) {
  const found = values.find(isSub);
  return found ? clean(found) : "";
}

function pickAcct(...values: any[]) {
  const found = values.find(isAcct);
  return found ? clean(found) : "";
}

function mapCarrierToFreightUser(item: any, profile?: any): FreightUser {
  const id = clean(
    item?.id ||
      item?.freight_id ||
      item?.auth_user_id ||
      profile?.auth_user_id ||
      profile?.id ||
      ""
  );

  const accountId = clean(item?.account_id || profile?.account_id || "");

  const stripeCustomerId = pickCus(
    item?.stripe_customer_id,
    item?.stripeCustomerId,
    profile?.stripe_customer_id,
    profile?.stripeCustomerId
  );

  const stripeSubscriptionId = pickSub(
    item?.stripe_subscription_id,
    item?.subscription_id,
    item?.stripeSubscriptionId,
    item?.subscriptionId,
    profile?.stripe_subscription_id,
    profile?.subscription_id
  );

  const freightAccount = pickAcct(
    item?.freight_account,
    item?.freightAccount,
    item?.stripe_account_id,
    item?.stripeAccountId,
    profile?.freight_account,
    profile?.stripe_account_id
  );

  const companyName =
    item?.company_name ||
    item?.business_name ||
    profile?.company_name ||
    "Freight Carrier";

  const contactName =
    item?.contact_name ||
    item?.full_name ||
    item?.name ||
    profile?.full_name ||
    profile?.name ||
    "";

  const accountActive =
    item?.account_active === undefined
      ? profile?.account_active !== false
      : item?.account_active !== false;

  const membershipStatus = clean(item?.membership_status || profile?.membership_status || "");
  const subscriptionStatus = clean(item?.subscription_status || profile?.subscription_status || "");

  return {
    id,
    freightId: id,
    freight_id: id,
    profileId: clean(item?.profile_id || profile?.id || ""),
    profile_id: clean(item?.profile_id || profile?.id || ""),
    authUserId: clean(item?.auth_user_id || profile?.auth_user_id || id),
    auth_user_id: clean(item?.auth_user_id || profile?.auth_user_id || id),
    role: "freight",

    accountId,
    account_id: accountId,

    companyName,
    company_name: companyName,
    businessName: item?.business_name || companyName,
    business_name: item?.business_name || companyName,
    contactName,
    contact_name: contactName,
    fullName: item?.full_name || contactName,
    full_name: item?.full_name || contactName,
    email: normalize(item?.email || profile?.email),
    phone: clean(item?.phone || profile?.phone || ""),
    username: normalize(item?.username || profile?.username || ""),

    stripeCustomerId,
    stripe_customer_id: stripeCustomerId,
    stripeSubscriptionId,
    stripe_subscription_id: stripeSubscriptionId,
    subscriptionId: stripeSubscriptionId,
    subscription_id: stripeSubscriptionId,
    freightAccount,
    freight_account: freightAccount,
    stripeAccountId: freightAccount,
    stripe_account_id: freightAccount,

    accountActive,
    account_active: accountActive,
    membershipStatus: membershipStatus || (stripeSubscriptionId ? "active" : "pending"),
    membership_status: membershipStatus || (stripeSubscriptionId ? "active" : "pending"),
    subscriptionStatus: subscriptionStatus || (stripeSubscriptionId ? "active" : "pending"),
    subscription_status: subscriptionStatus || (stripeSubscriptionId ? "active" : "pending"),

    approved: true,
    verificationStatus: item?.verification_status || item?.admin_review_status || "SUBMITTED",
    verification_status: item?.verification_status || item?.admin_review_status || "SUBMITTED",
  };
}

function hasDashboardAccess(user: FreightUser) {
  return Boolean(
    isCus(user.stripe_customer_id || user.stripeCustomerId) &&
      isSub(user.stripe_subscription_id || user.subscription_id || user.stripeSubscriptionId) &&
      isAcct(user.freight_account || user.freightAccount || user.stripe_account_id || user.stripeAccountId)
  );
}

function isFreightActive(user: FreightUser) {
  if (user.accountActive === false || user.account_active === false) return false;

  const membershipStatus = normalize(user.membershipStatus || user.membership_status);
  const subscriptionStatus = normalize(user.subscriptionStatus || user.subscription_status);

  if (membershipStatus === "canceled") return false;
  if (subscriptionStatus === "canceled") return false;
  if (subscriptionStatus === "unpaid") return false;

  return true;
}

export default function FreightLoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loginLoading, setLoginLoading] = useState(false);

  const [resetVisible, setResetVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  async function saveFreightSession(user: FreightUser) {
    const sessionUser = {
      ...user,
      role: "freight" as const,
      accountActive: user.accountActive !== false,
      account_active: user.account_active !== false,
      updatedAt: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await AsyncStorage.setItem("currentFreight", JSON.stringify(sessionUser));
    await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(sessionUser));
    await AsyncStorage.setItem("currentFreightUser", JSON.stringify(sessionUser));
    await AsyncStorage.setItem("farm2homeCurrentFreight", JSON.stringify(sessionUser));
    await AsyncStorage.setItem("currentUser", JSON.stringify(sessionUser));
    await AsyncStorage.setItem("userRole", "freight");
    await AsyncStorage.setItem("currentUserRole", "freight");

    return sessionUser;
  }

  async function findProfile(userId: string, cleanEmail: string) {
    if (userId) {
      const byAuth = await supabase
        .from("profiles")
        .select("*")
        .or(`id.eq.${userId},auth_user_id.eq.${userId},profile_id.eq.${userId}`)
        .eq("role", "freight")
        .maybeSingle();

      if (!byAuth.error && byAuth.data) return byAuth.data;
    }

    if (cleanEmail) {
      const byEmail = await supabase
        .from("profiles")
        .select("*")
        .eq("email", cleanEmail)
        .eq("role", "freight")
        .maybeSingle();

      if (!byEmail.error && byEmail.data) return byEmail.data;
    }

    return null;
  }

  async function findFreightProfile(userId: string, cleanEmail: string) {
    let freightUser: any = null;
    const profile = await findProfile(userId, cleanEmail);

    if (userId) {
      const userById = await supabase
        .from("freight_users")
        .select("*")
        .or(`id.eq.${userId},freight_id.eq.${userId},auth_user_id.eq.${userId},profile_id.eq.${userId}`)
        .maybeSingle();

      if (!userById.error && userById.data) freightUser = userById.data;
    }

    if (!freightUser && cleanEmail) {
      const userByEmail = await supabase
        .from("freight_users")
        .select("*")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (!userByEmail.error && userByEmail.data) freightUser = userByEmail.data;
    }

    if (!freightUser && userId) {
      const carrierById = await supabase
        .from("freight_carriers")
        .select("*")
        .or(`id.eq.${userId},freight_id.eq.${userId},auth_user_id.eq.${userId},profile_id.eq.${userId}`)
        .maybeSingle();

      if (!carrierById.error && carrierById.data) freightUser = carrierById.data;
    }

    if (!freightUser && cleanEmail) {
      const carrierByEmail = await supabase
        .from("freight_carriers")
        .select("*")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (!carrierByEmail.error && carrierByEmail.data) freightUser = carrierByEmail.data;
    }

    if (!freightUser && profile) {
      freightUser = {
        id: userId || profile.auth_user_id || profile.id,
        freight_id: userId || profile.auth_user_id || profile.id,
        auth_user_id: userId || profile.auth_user_id || profile.id,
        profile_id: profile.id,
        role: "freight",
        account_id: profile.account_id,
        company_name: profile.company_name || "Freight Carrier",
        business_name: profile.company_name || "Freight Carrier",
        contact_name: profile.full_name || profile.name || "",
        full_name: profile.full_name || profile.name || "",
        email: profile.email,
        phone: profile.phone,
        username: profile.username || "",
        account_active: profile.account_active ?? true,
        stripe_customer_id: profile.stripe_customer_id,
        stripe_subscription_id: profile.stripe_subscription_id || profile.subscription_id,
        subscription_id: profile.subscription_id || profile.stripe_subscription_id,
        freight_account: profile.freight_account,
        stripe_account_id: profile.stripe_account_id,
        membership_status: profile.membership_status,
        subscription_status: profile.subscription_status,
      };
    }

    if (!freightUser) return null;

    return mapCarrierToFreightUser(freightUser, profile);
  }

  async function handleLogin() {
    const cleanEmail = normalize(email);
    const cleanPassword = clean(password);

    if (!cleanEmail || !cleanPassword) {
      Alert.alert("Missing Information", "Enter email and password.");
      return;
    }

    try {
      setLoginLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (error) {
        Alert.alert("Login Failed", error.message);
        return;
      }

      const userId = data?.user?.id || "";

      if (!userId) {
        Alert.alert("Login Error", "Unable to confirm freight account.");
        return;
      }

      const mappedUser = await findFreightProfile(userId, cleanEmail);

      if (!mappedUser) {
        Alert.alert(
          "Freight Profile Missing",
          "Your login exists, but no freight profile row was found. Please complete freight registration."
        );
        router.replace("/freight/register" as any);
        return;
      }

      if (!isFreightActive(mappedUser)) {
        Alert.alert("Account Not Active", "Your freight account is not active.");
        return;
      }

      await saveFreightSession(mappedUser);

      if (hasDashboardAccess(mappedUser)) {
        router.replace("/freight/dashboard" as any);
        return;
      }

      Alert.alert(
        "Finish Setup",
        "Your freight profile was found, but Stripe Customer ID, Subscription ID, or Connect Account ID is missing."
      );

      router.replace("/freight/register" as any);
    } catch (error: any) {
      console.log("Freight login error:", error);
      Alert.alert("Login Error", error?.message || "Unable to login to freight account.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handlePasswordReset() {
    const cleanEmail = normalize(resetEmail || email);

    if (!cleanEmail) {
      Alert.alert("Email Required", "Enter your freight account email.");
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
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroIcon}>
                <Ionicons name="trail-sign-outline" size={34} color="#FFFFFF" />
              </View>

              <TouchableOpacity
                style={styles.homeChip}
                onPress={() => router.replace("/" as any)}
              >
                <Ionicons name="home-outline" size={15} color="#CBD5E1" />
                <Text style={styles.homeChipText}>Home</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.kicker}>Farm2Home Freight Connect</Text>
            <Text style={styles.title}>Carrier Login</Text>
            <Text style={styles.subtitle}>
              Access refrigerated fresh food freight, livestock loads, carrier
              routes, live tracking, dispatch tools, and earnings.
            </Text>
          </View>

          <View style={styles.loginCard}>
            <Text style={styles.cardTitle}>Freight Portal Access</Text>
            <Text style={styles.cardSubtitle}>
              Sign in with the email and password used during Freight Connect registration.
            </Text>

            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="carrier@email.com"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />

            <Text style={styles.inputLabel}>Password</Text>
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
              style={[styles.loginButton, loginLoading && styles.disabledButton]}
              onPress={handleLogin}
              disabled={loginLoading}
              activeOpacity={0.85}
            >
              {loginLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.loginButtonText}>Login to Freight Portal</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.forgotButton}
              onPress={() => {
                setResetEmail(email);
                setResetVisible(true);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.registerButton}
              onPress={() => router.push("/freight/register" as any)}
              activeOpacity={0.85}
            >
              <Ionicons
                name="business-outline"
                size={18}
                color={freightTheme.colors.primary}
              />
              <Text style={styles.registerText}>Register for Freight Connect</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Carrier Requirements</Text>
            <Text style={styles.infoText}>
              Keep insurance, vehicle readiness, payment setup, and compliance
              information current to remain active on Freight Connect.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={resetVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={styles.modalIcon}>
                <Ionicons name="key-outline" size={28} color="#FFFFFF" />
              </View>

              <Text style={styles.modalTitle}>Reset Freight Password</Text>

              <Text style={styles.modalSubtitle}>
                Enter your freight account email. Farm2Home will send a secure
                reset link if the Auth account exists.
              </Text>

              <Text style={styles.modalInputLabel}>Freight Email</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Freight Email"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={resetEmail}
                onChangeText={setResetEmail}
              />

              <TouchableOpacity
                style={[styles.loginButton, resetLoading && styles.disabledButton]}
                onPress={handlePasswordReset}
                disabled={resetLoading}
                activeOpacity={0.85}
              >
                {resetLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="mail-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.loginButtonText}>Send Reset Link</Text>
                  </>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: freightTheme.colors.background },
  keyboard: { flex: 1, backgroundColor: freightTheme.colors.background },
  content: { flexGrow: 1, paddingBottom: 90 },
  hero: {
    backgroundColor: "#020617",
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#064E3B",
    borderWidth: 1,
    borderColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  homeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
  },
  homeChipText: { color: "#CBD5E1", fontWeight: "900", fontSize: 12 },
  kicker: {
    color: "#10B981",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 38,
    fontWeight: "900",
    marginTop: 6,
  },
  subtitle: {
    color: "#CBD5E1",
    marginTop: 8,
    lineHeight: 23,
    fontWeight: "700",
    maxWidth: 640,
  },
  loginCard: {
    width: "auto",
    backgroundColor: freightTheme.colors.card,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    margin: 18,
  },
  cardTitle: {
    color: freightTheme.colors.text,
    fontSize: 27,
    fontWeight: "900",
    textAlign: "center",
  },
  cardSubtitle: {
    color: freightTheme.colors.mutedText,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 22,
    lineHeight: 22,
    fontWeight: "700",
  },
  inputLabel: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    marginBottom: 7,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: "#111827",
    fontWeight: "800",
    marginBottom: 14,
  },
  loginButton: {
    backgroundColor: freightTheme.colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: { opacity: 0.6 },
  loginButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 16 },
  forgotButton: { alignItems: "center", marginTop: 16 },
  forgotText: { color: freightTheme.colors.primary, fontWeight: "900" },
  divider: {
    height: 1,
    backgroundColor: freightTheme.colors.border,
    marginVertical: 18,
  },
  registerButton: {
    backgroundColor: freightTheme.colors.surface,
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
    borderRadius: 16,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  registerText: { color: freightTheme.colors.primary, fontWeight: "900" },
  infoCard: {
    marginHorizontal: 18,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 22,
    padding: 16,
  },
  infoTitle: { color: "#10B981", fontWeight: "900", marginBottom: 6 },
  infoText: { color: "#CBD5E1", fontWeight: "700", lineHeight: 21 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    padding: 22,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 22,
    maxHeight: "90%",
  },
  modalIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: freightTheme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 14,
  },
  modalTitle: {
    color: "#111827",
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 8,
    textAlign: "center",
  },
  modalSubtitle: {
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 18,
    fontWeight: "700",
  },
  modalInputLabel: {
    color: "#111827",
    fontWeight: "900",
    marginBottom: 7,
  },
  modalInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: "#111827",
    fontWeight: "700",
    marginBottom: 14,
  },
  closeButton: { marginTop: 16, alignItems: "center" },
  closeText: { color: "#B91C1C", fontWeight: "900" },
});