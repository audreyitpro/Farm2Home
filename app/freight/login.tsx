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

import { supabase } from "../data/supabaseClient";
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
  registrationComplete: boolean;
  registration_complete: boolean;
  applicationSubmitted: boolean;
  application_submitted: boolean;
};

const COLORS = {
  bg: "#F3F4F6",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  text: "#111827",
  muted: "#64748B",
  border: "#E5E7EB",
  dark: "#020617",
  green: "#10B981",
  greenDark: "#047857",
  red: "#B91C1C",
};

function clean(value: any) {
  return String(value ?? "").trim();
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
  const found = values.find((value) => isCus(value));
  return found ? clean(found) : "";
}

function pickSub(...values: any[]) {
  const found = values.find((value) => isSub(value));
  return found ? clean(found) : "";
}

function pickAcct(...values: any[]) {
  const found = values.find((value) => isAcct(value));
  return found ? clean(found) : "";
}

function statusIsGood(value: any) {
  const status = normalize(value);
  return !["canceled", "cancelled", "unpaid", "inactive", "disabled", "rejected"].includes(status);
}

function mapCarrierToFreightUser(item: any, profile?: any): FreightUser {
  const id = clean(
    item?.id ||
      item?.freight_id ||
      item?.auth_user_id ||
      item?.profile_id ||
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
    profile?.subscription_id,
    profile?.stripeSubscriptionId,
    profile?.subscriptionId
  );

  const freightAccount = pickAcct(
    item?.freight_account,
    item?.freightAccount,
    item?.stripe_account_id,
    item?.stripeAccountId,
    profile?.freight_account,
    profile?.freightAccount,
    profile?.stripe_account_id,
    profile?.stripeAccountId
  );

  const companyName = clean(
    item?.company_name ||
      item?.business_name ||
      item?.companyName ||
      item?.businessName ||
      profile?.company_name ||
      profile?.business_name ||
      "Freight Carrier"
  );

  const contactName = clean(
    item?.contact_name ||
      item?.full_name ||
      item?.name ||
      item?.contactName ||
      item?.fullName ||
      profile?.full_name ||
      profile?.name ||
      ""
  );

  const membershipStatus = clean(
    item?.membership_status ||
      item?.membershipStatus ||
      profile?.membership_status ||
      profile?.membershipStatus ||
      (stripeSubscriptionId ? "active" : "pending")
  );

  const subscriptionStatus = clean(
    item?.subscription_status ||
      item?.subscriptionStatus ||
      profile?.subscription_status ||
      profile?.subscriptionStatus ||
      (stripeSubscriptionId ? "active" : "pending")
  );

  const registrationComplete = Boolean(
    item?.registration_complete ||
      item?.registrationComplete ||
      item?.application_submitted ||
      item?.applicationSubmitted ||
      profile?.registration_complete ||
      profile?.application_submitted ||
      (stripeCustomerId && stripeSubscriptionId && freightAccount)
  );

  const applicationSubmitted = Boolean(
    item?.application_submitted ||
      item?.applicationSubmitted ||
      profile?.application_submitted ||
      registrationComplete
  );

  const accountActive =
    item?.account_active === undefined
      ? profile?.account_active !== false
      : item?.account_active !== false;

  return {
    id,
    freightId: id,
    freight_id: id,
    profileId: clean(item?.profile_id || profile?.id || id),
    profile_id: clean(item?.profile_id || profile?.id || id),
    authUserId: clean(item?.auth_user_id || profile?.auth_user_id || id),
    auth_user_id: clean(item?.auth_user_id || profile?.auth_user_id || id),
    role: "freight",

    accountId,
    account_id: accountId,

    companyName,
    company_name: companyName,
    businessName: clean(item?.business_name || item?.businessName || companyName),
    business_name: clean(item?.business_name || item?.businessName || companyName),
    contactName,
    contact_name: contactName,
    fullName: clean(item?.full_name || item?.fullName || contactName),
    full_name: clean(item?.full_name || item?.fullName || contactName),
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
    membershipStatus,
    membership_status: membershipStatus,
    subscriptionStatus,
    subscription_status: subscriptionStatus,
    approved: item?.approved !== false,
    verificationStatus: clean(
      item?.verification_status ||
        item?.admin_review_status ||
        item?.compliance_status ||
        profile?.verification_status ||
        "SUBMITTED"
    ),
    verification_status: clean(
      item?.verification_status ||
        item?.admin_review_status ||
        item?.compliance_status ||
        profile?.verification_status ||
        "SUBMITTED"
    ),
    registrationComplete,
    registration_complete: registrationComplete,
    applicationSubmitted,
    application_submitted: applicationSubmitted,
  };
}

function isFreightActive(user: FreightUser) {
  if (user.accountActive === false || user.account_active === false) return false;
  if (!statusIsGood(user.membershipStatus || user.membership_status)) return false;
  if (!statusIsGood(user.subscriptionStatus || user.subscription_status)) return false;
  return true;
}

function hasDashboardAccess(user: FreightUser) {
  const hasStripeCustomer = isCus(user.stripeCustomerId || user.stripe_customer_id);
  const hasSubscription = isSub(
    user.stripeSubscriptionId || user.stripe_subscription_id || user.subscriptionId || user.subscription_id
  );
  const hasConnect = isAcct(
    user.freightAccount || user.freight_account || user.stripeAccountId || user.stripe_account_id
  );

  return Boolean(
    user.id &&
      user.account_id &&
      hasStripeCustomer &&
      hasSubscription &&
      hasConnect &&
      isFreightActive(user)
  );
}

export default function FreightLoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [resetVisible, setResetVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  async function saveFreightSession(user: FreightUser) {
    const now = new Date().toISOString();
    const sessionUser = {
      ...user,
      role: "freight" as const,
      accountActive: user.accountActive !== false,
      account_active: user.account_active !== false,
      updatedAt: now,
      updated_at: now,
    };

    await AsyncStorage.multiSet([
      ["currentFreight", JSON.stringify(sessionUser)],
      ["currentFreightCarrier", JSON.stringify(sessionUser)],
      ["currentFreightUser", JSON.stringify(sessionUser)],
      ["farm2homeCurrentFreight", JSON.stringify(sessionUser)],
      ["currentUser", JSON.stringify(sessionUser)],
      ["userRole", "freight"],
      ["currentUserRole", "freight"],
    ]);

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
    const profile = await findProfile(userId, cleanEmail);
    let freightUser: any = null;

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
        company_name: profile.company_name || profile.business_name || "Freight Carrier",
        business_name: profile.business_name || profile.company_name || "Freight Carrier",
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
        registration_complete: profile.registration_complete,
        application_submitted: profile.application_submitted,
      };
    }

    if (!freightUser) return null;

    return mapCarrierToFreightUser(freightUser, profile);
  }

  async function touchLastLogin(user: FreightUser) {
    const now = new Date().toISOString();
    const payload = {
      last_login_at: now,
      account_active: true,
      updated_at: now,
    };

    await supabase.from("freight_users").update(payload).eq("id", user.id);
    await supabase.from("profiles").update(payload).eq("id", user.id);
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

      const userId = clean(data?.user?.id);

      if (!userId) {
        Alert.alert("Login Error", "Unable to confirm freight account.");
        return;
      }

      const mappedUser = await findFreightProfile(userId, cleanEmail);

      if (!mappedUser) {
        Alert.alert(
          "Freight Profile Missing",
          "Your login exists, but no freight profile was found. Please complete freight registration."
        );
        router.replace("/freight/register" as any);
        return;
      }

      await saveFreightSession(mappedUser);

      if (!isFreightActive(mappedUser)) {
        Alert.alert("Account Not Active", "Your freight account is not active.");
        return;
      }

      if (hasDashboardAccess(mappedUser)) {
        await touchLastLogin(mappedUser);
        router.replace("/freight/dashboard" as any);
        return;
      }

      const missingItems = [
        !mappedUser.account_id ? "Static Account ID" : "",
        !isCus(mappedUser.stripe_customer_id) ? "Stripe Customer ID" : "",
        !isSub(mappedUser.stripe_subscription_id || mappedUser.subscription_id) ? "Stripe Subscription ID" : "",
        !isAcct(mappedUser.freight_account || mappedUser.stripe_account_id) ? "Stripe Connect Account ID" : "",
      ].filter(Boolean);

      Alert.alert(
        "Finish Freight Setup",
        `Your freight profile was found, but this setup is missing: ${missingItems.join(", ")}. You will be taken to registration to finish setup.`
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

      Alert.alert("Password Reset Sent", "Check your email for the secure password reset link.");
      setResetVisible(false);
      setResetEmail("");
    } catch (error: any) {
      Alert.alert("Reset Error", error?.message || "Unable to send password reset email.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.dark} />

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

              <TouchableOpacity style={styles.homeChip} onPress={() => router.replace("/" as any)}>
                <Ionicons name="home-outline" size={15} color="#CBD5E1" />
                <Text style={styles.homeChipText}>Home</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.kicker}>Farm2Home Freight Connect</Text>
            <Text style={styles.title}>Carrier Login</Text>
            <Text style={styles.subtitle}>
              Access freight loads, live tracking, dispatch tools, Stripe payouts, and earnings.
            </Text>
          </View>

          <View style={styles.loginCard}>
            <Text style={styles.cardTitle}>Freight Portal Access</Text>
            <Text style={styles.cardSubtitle}>
              Fully registered carriers are routed directly to the freight dashboard.
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
              <Ionicons name="business-outline" size={18} color={COLORS.greenDark} />
              <Text style={styles.registerText}>Register for Freight Connect</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Dashboard access requires</Text>
            <Text style={styles.infoText}>
              Supabase freight profile, static account ID, Stripe customer ID, Stripe subscription ID, and Stripe Connect account ID.
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
                Enter your freight account email. Farm2Home will send a secure reset link if the Auth account exists.
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
  safe: { flex: 1, backgroundColor: freightTheme?.colors?.background || COLORS.bg },
  keyboard: { flex: 1, backgroundColor: freightTheme?.colors?.background || COLORS.bg },
  content: { flexGrow: 1, paddingBottom: 90 },
  hero: {
    backgroundColor: COLORS.dark,
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
    borderColor: COLORS.green,
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
    color: COLORS.green,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: { color: "#FFFFFF", fontSize: 38, fontWeight: "900", marginTop: 6 },
  subtitle: { color: "#CBD5E1", marginTop: 8, lineHeight: 23, fontWeight: "700", maxWidth: 640 },
  loginCard: {
    backgroundColor: freightTheme?.colors?.card || COLORS.card,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: freightTheme?.colors?.border || COLORS.border,
    margin: 18,
  },
  cardTitle: { color: COLORS.text, fontSize: 27, fontWeight: "900", textAlign: "center" },
  cardSubtitle: {
    color: COLORS.muted,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 22,
    lineHeight: 22,
    fontWeight: "700",
  },
  inputLabel: { color: COLORS.text, fontWeight: "900", marginBottom: 7 },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: COLORS.text,
    fontWeight: "800",
    marginBottom: 14,
  },
  loginButton: {
    backgroundColor: freightTheme?.colors?.primary || COLORS.greenDark,
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
  forgotText: { color: freightTheme?.colors?.primary || COLORS.greenDark, fontWeight: "900" },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 18 },
  registerButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.greenDark,
    borderRadius: 16,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  registerText: { color: COLORS.greenDark, fontWeight: "900" },
  infoCard: {
    marginHorizontal: 18,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 22,
    padding: 16,
  },
  infoTitle: { color: COLORS.green, fontWeight: "900", marginBottom: 6 },
  infoText: { color: "#CBD5E1", fontWeight: "700", lineHeight: 21 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    padding: 22,
  },
  modalCard: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 22, maxHeight: "90%" },
  modalIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: freightTheme?.colors?.primary || COLORS.greenDark,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 14,
  },
  modalTitle: { color: COLORS.text, fontSize: 26, fontWeight: "900", marginBottom: 8, textAlign: "center" },
  modalSubtitle: {
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 18,
    fontWeight: "700",
  },
  modalInputLabel: { color: COLORS.text, fontWeight: "900", marginBottom: 7 },
  modalInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: COLORS.text,
    fontWeight: "700",
    marginBottom: 14,
  },
  closeButton: { marginTop: 16, alignItems: "center" },
  closeText: { color: COLORS.red, fontWeight: "900" },
});
