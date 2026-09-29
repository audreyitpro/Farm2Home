// app/customer/login.tsx

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
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

import { supabase } from "../data/supabaseClient";

/**
 * Farm2Home Direct — Customer Login
 *
 * CUSTOMER ACCESS MODEL
 * - No customer monthly subscription.
 * - No Stripe Customer ID required for login.
 * - No Stripe Subscription ID required for login.
 * - No membership-status requirement for Marketplace access.
 * - Customer signs in with Supabase Auth.
 * - A customer profile must exist and account_active must not be false.
 * - The $4.99 Farm2Home service fee is applied at checkout, not login.
 */

const CUSTOMER_SERVICE_FEE = 4.99;

const COLORS = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  surface: "#F8FAFC",
  black: "#020617",
  navy: "#020617",
  primary: "#635BFF",
  primaryDark: "#4638D8",
  primarySoft: "#EEF2FF",
  text: "#101828",
  muted: "#667085",
  border: "#E5E7EB",
  green: "#10B981",
  greenDark: "#047857",
  greenSoft: "#D1FAE5",
  amberSoft: "#FEF3C7",
  white: "#FFFFFF",
};

type CustomerRecord = {
  id: string;
  customer_id?: string;
  auth_user_id?: string;
  profile_id?: string;
  account_id?: string;
  role?: string;
  full_name?: string;
  name?: string;
  email?: string;
  customer_email?: string;
  phone?: string;
  username?: string;
  account_active?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function buildCustomerSession(row: any): CustomerRecord & Record<string, any> {
  const id = clean(row?.id || row?.customer_id || row?.customerId || row?.auth_user_id);
  const fullName = clean(row?.full_name || row?.fullName || row?.name || "Customer");
  const customerEmail = normalize(row?.email || row?.customer_email);

  return {
    ...row,
    id,
    customerId: id,
    customer_id: id,
    authUserId: clean(row?.auth_user_id || row?.authUserId || id),
    auth_user_id: clean(row?.auth_user_id || row?.authUserId || id),
    profileId: clean(row?.profile_id || row?.profileId || id),
    profile_id: clean(row?.profile_id || row?.profileId || id),
    role: "customer",
    accountId: clean(row?.account_id || row?.accountId),
    account_id: clean(row?.account_id || row?.accountId),
    fullName,
    full_name: fullName,
    name: clean(row?.name || fullName),
    email: customerEmail,
    customer_email: customerEmail,
    phone: clean(row?.phone),
    username: normalize(row?.username),
    accountActive: row?.account_active !== false,
    account_active: row?.account_active !== false,

    // Legacy compatibility only. These values DO NOT control access.
    subscriptionStatus: "not_required",
    subscription_status: "not_required",
    membershipStatus: "not_required",
    membership_status: "not_required",
    customerMembershipPaid: false,
    customer_membership_paid: false,

    customerServiceFee: CUSTOMER_SERVICE_FEE,
    customer_service_fee: CUSTOMER_SERVICE_FEE,
    updatedAt: row?.updated_at || new Date().toISOString(),
    updated_at: row?.updated_at || new Date().toISOString(),
  };
}

function customerHasMarketplaceAccess(row: any) {
  const customer = buildCustomerSession(row);
  return Boolean(customer.id && customer.account_active !== false);
}

export default function CustomerLoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [openingMarketplace, setOpeningMarketplace] = useState(false);
  const [resetVisible, setResetVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const routingLockedRef = useRef(false);

  async function saveCurrentCustomer(customer: any) {
    const mapped = buildCustomerSession(customer);
    const ready = customerHasMarketplaceAccess(mapped);

    await AsyncStorage.multiSet([
      ["pendingCustomer", JSON.stringify(mapped)],
      ["currentCustomer", JSON.stringify(mapped)],
      ["currentUser", JSON.stringify(mapped)],
      ["farm2homeCurrentCustomer", JSON.stringify(mapped)],
      ["userRole", "customer"],
      ["currentUserRole", "customer"],
      ["lastLoginRole", "customer"],
      ["lastCustomerDashboardReady", ready ? "true" : "false"],
    ]);

    return mapped;
  }

  async function findCustomerByIdOrEmail(userId?: string, cleanEmail?: string) {
    const id = clean(userId);
    const mail = normalize(cleanEmail);

    if (id) {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .or(`id.eq.${id},auth_user_id.eq.${id},profile_id.eq.${id}`)
        .limit(1);

      if (!error && Array.isArray(data) && data[0]) return data[0];
      if (error) console.log("customers id lookup error:", error.message);
    }

    if (mail) {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("email", mail)
        .limit(1);

      if (!error && Array.isArray(data) && data[0]) return data[0];
      if (error) console.log("customers email lookup error:", error.message);
    }

    return null;
  }

  async function findProfileByIdOrEmail(userId?: string, cleanEmail?: string) {
    const id = clean(userId);
    const mail = normalize(cleanEmail);

    if (id) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .or(`id.eq.${id},auth_user_id.eq.${id}`)
        .eq("role", "customer")
        .limit(1);

      if (!error && Array.isArray(data) && data[0]) return data[0];
      if (error) console.log("profiles id lookup error:", error.message);
    }

    if (mail) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", mail)
        .eq("role", "customer")
        .limit(1);

      if (!error && Array.isArray(data) && data[0]) return data[0];
      if (error) console.log("profiles email lookup error:", error.message);
    }

    return null;
  }

  async function ensureCustomerRowFromProfile(
    userId: string,
    cleanEmail: string,
    profile: any
  ) {
    if (!profile?.id && !userId) return null;

    const id = clean(userId || profile?.auth_user_id || profile?.id);
    const now = new Date().toISOString();

    // Keep this payload conservative so login does not depend on Stripe columns.
    const payload = {
      id,
      auth_user_id: id,
      profile_id: clean(profile?.id || id),
      role: "customer",
      account_id: clean(profile?.account_id || `Customer_${Date.now().toString().slice(-6)}`),
      full_name: clean(profile?.full_name || profile?.name || "Customer"),
      name: clean(profile?.name || profile?.full_name || "Customer"),
      email: normalize(profile?.email || cleanEmail),
      phone: clean(profile?.phone),
      account_active: true,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from("customers")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .maybeSingle();

    if (error) {
      console.log("ensure customer from profile failed:", error.message);
      return null;
    }

    return data;
  }

  async function findCustomerProfile(userId: string, cleanEmail: string) {
    let customer = await findCustomerByIdOrEmail(userId, cleanEmail);
    const profile = await findProfileByIdOrEmail(userId, cleanEmail);

    if (!customer && profile) {
      customer = await ensureCustomerRowFromProfile(userId, cleanEmail, profile);
    }

    if (!customer) return null;

    const merged = buildCustomerSession({
      ...(profile || {}),
      ...customer,
      id: clean(customer?.id || userId),
      auth_user_id: clean(customer?.auth_user_id || userId),
      profile_id: clean(customer?.profile_id || profile?.id || userId),
      email: normalize(customer?.email || profile?.email || cleanEmail),
      full_name: clean(
        customer?.full_name ||
          customer?.name ||
          profile?.full_name ||
          profile?.name ||
          "Customer"
      ),
      account_active: customer?.account_active !== false,
    });

    await saveCurrentCustomer(merged);
    return merged;
  }

  async function openMarketplace(customer: any) {
    if (routingLockedRef.current) return;

    routingLockedRef.current = true;
    setOpeningMarketplace(true);
    await saveCurrentCustomer(customer);

    setTimeout(() => {
      router.replace("/customer/marketplace" as any);
    }, 120);
  }

  async function loginCustomer() {
    const cleanEmail = normalize(email);
    const cleanPassword = clean(password);

    if (!cleanEmail || !cleanPassword) {
      Alert.alert("Missing Login", "Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);
      routingLockedRef.current = false;

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
        Alert.alert("Login Error", "Unable to confirm customer account.");
        return;
      }

      const customer = await findCustomerProfile(userId, cleanEmail);

      if (!customer) {
        Alert.alert(
          "Customer Profile Missing",
          "Your login is valid, but no customer profile was found. Please complete customer registration."
        );

        router.replace({
          pathname: "/customer/register" as any,
          params: { customerId: userId, email: cleanEmail },
        });
        return;
      }

      const mappedCustomer = await saveCurrentCustomer(customer);

      if (mappedCustomer.account_active === false) {
        Alert.alert(
          "Account Disabled",
          "This customer account is currently disabled. Please contact Farm2Home Direct support."
        );
        return;
      }

      if (!customerHasMarketplaceAccess(mappedCustomer)) {
        Alert.alert(
          "Customer Profile Required",
          "Your customer profile must be completed before entering the marketplace."
        );
        return;
      }

      await openMarketplace(mappedCustomer);
    } catch (error: any) {
      console.log("Customer login error:", error);
      Alert.alert("Login Error", error?.message || "Unable to login.");
    } finally {
      if (!routingLockedRef.current) setLoading(false);
    }
  }

  async function handlePasswordReset() {
    const cleanEmail = normalize(resetEmail || email);

    if (!cleanEmail) {
      Alert.alert("Email Required", "Enter your customer email.");
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
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.page}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.push("/" as any)}
              activeOpacity={0.85}
            >
              <Ionicons name="arrow-back-outline" size={18} color={COLORS.white} />
              <Text style={styles.backText}>Back Home</Text>
            </TouchableOpacity>

            <View style={styles.heroIcon}>
              <Ionicons name="basket-outline" size={34} color={COLORS.white} />
            </View>

            <Text style={styles.kicker}>Farm2Home Direct Marketplace</Text>
            <Text style={styles.title}>Customer Login</Text>
            <Text style={styles.subtitle}>
              Shop fresh produce, farm groceries, local goods, delivery options,
              and more directly from Farm2Home farmers.
            </Text>
          </View>

          <View style={styles.noticeBox}>
            <View style={styles.noticeHeader}>
              <View style={styles.noticeIcon}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={23}
                  color={COLORS.greenDark}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.noticeTitle}>No Monthly Customer Subscription</Text>
                <Text style={styles.noticeText}>
                  Customers can browse and shop without a monthly membership. A $
                  {CUSTOMER_SERVICE_FEE.toFixed(2)} Farm2Home service fee is applied
                  only when you complete an order.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}>
                <Ionicons name="log-in-outline" size={22} color={COLORS.white} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Welcome Back</Text>
                <Text style={styles.sectionSubtitle}>
                  Use the email and password created during customer registration.
                </Text>
              </View>
            </View>

            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="customer@email.com"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={(value) => setEmail(normalize(value))}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter password"
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
            />

            <TouchableOpacity
              style={[
                styles.loginButton,
                (loading || openingMarketplace) && styles.disabledButton,
              ]}
              onPress={loginCustomer}
              disabled={loading || openingMarketplace}
              activeOpacity={0.85}
            >
              {loading || openingMarketplace ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="storefront-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.loginButtonText}>Login to Marketplace</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.marketButton}
              onPress={() => router.push("/customer/register" as any)}
              activeOpacity={0.85}
            >
              <Ionicons name="person-add-outline" size={20} color={COLORS.black} />
              <Text style={styles.marketButtonText}>Create Customer Account</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => {
                setResetEmail(email);
                setResetVisible(true);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.linkText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.feeCard}>
            <View style={styles.feeTop}>
              <View style={styles.feeIcon}>
                <Ionicons name="receipt-outline" size={22} color={COLORS.greenDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.feeTitle}>Simple Customer Pricing</Text>
                <Text style={styles.feeSubtitle}>Pay only when you place an order.</Text>
              </View>
            </View>

            <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>Monthly Customer Subscription</Text>
              <Text style={styles.freeValue}>$0.00</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>Farm2Home Service Fee</Text>
              <Text style={styles.feeValue}>
                ${CUSTOMER_SERVICE_FEE.toFixed(2)} / order
              </Text>
            </View>

            <Text style={styles.feeFootnote}>
              The service fee is calculated during checkout and is not required to
              sign in or browse the marketplace.
            </Text>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Ionicons name="leaf-outline" size={20} color="#92400E" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Fresh from farmers</Text>
              <Text style={styles.infoText}>
                Browse fresh produce, farm goods, delivery and pickup options,
                manage orders, and support farmers through Farm2Home Direct.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={resetVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={styles.modalIcon}>
                <Ionicons name="key-outline" size={28} color={COLORS.primary} />
              </View>

              <Text style={styles.modalTitle}>Reset Password</Text>
              <Text style={styles.modalSubtitle}>
                Enter your customer email. Farm2Home Direct will send a secure
                password reset link if the authentication account exists.
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Customer Email"
                placeholderTextColor="#94A3B8"
                value={resetEmail}
                onChangeText={(value) => setResetEmail(normalize(value))}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  keyboard: { flex: 1, backgroundColor: COLORS.bg },
  page: { flex: 1, backgroundColor: COLORS.bg },
  content: { flexGrow: 1, paddingBottom: 70 },
  hero: {
    backgroundColor: COLORS.navy,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  backButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 18,
  },
  backText: { color: COLORS.white, fontWeight: "900" },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  kicker: {
    color: "#A5B4FC",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
    color: COLORS.white,
    marginTop: 6,
  },
  subtitle: {
    color: "#CBD5E1",
    lineHeight: 22,
    fontWeight: "700",
    fontSize: 15,
    marginTop: 8,
  },
  noticeBox: {
    backgroundColor: COLORS.greenSoft,
    borderColor: "#A7F3D0",
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 14,
  },
  noticeHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
  },
  noticeIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  noticeTitle: {
    color: COLORS.greenDark,
    fontWeight: "900",
    fontSize: 17,
    marginBottom: 4,
  },
  noticeText: {
    color: "#065F46",
    fontWeight: "700",
    lineHeight: 21,
  },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 26,
    padding: 20,
    marginHorizontal: 18,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  cardHeaderIcon: {
    width: 46,
    height: 46,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 4,
  },
  label: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 13,
    marginBottom: 7,
    marginTop: 6,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 17,
    padding: 15,
    marginBottom: 12,
    color: COLORS.text,
    fontWeight: "800",
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    padding: 17,
    borderRadius: 18,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: { opacity: 0.6 },
  loginButtonText: {
    color: COLORS.white,
    textAlign: "center",
    fontWeight: "900",
    fontSize: 16,
  },
  marketButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 15,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  marketButtonText: {
    color: COLORS.black,
    fontWeight: "900",
    fontSize: 15,
  },
  linkButton: { marginTop: 16 },
  linkText: {
    textAlign: "center",
    color: COLORS.primary,
    fontWeight: "900",
  },
  feeCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 22,
    padding: 17,
    marginHorizontal: 18,
    marginBottom: 16,
  },
  feeTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 14,
  },
  feeIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  feeTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 17,
  },
  feeSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 2,
  },
  feeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingVertical: 7,
  },
  feeLabel: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "800",
  },
  freeValue: {
    color: COLORS.greenDark,
    fontWeight: "900",
    fontSize: 16,
  },
  feeValue: {
    color: COLORS.primaryDark,
    fontWeight: "900",
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 5,
  },
  feeFootnote: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 10,
  },
  infoCard: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 22,
    padding: 16,
    marginHorizontal: 18,
    marginBottom: 16,
    flexDirection: "row",
    gap: 12,
  },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: COLORS.amberSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  infoTitle: {
    color: "#92400E",
    fontWeight: "900",
    marginBottom: 6,
  },
  infoText: {
    color: "#78350F",
    fontWeight: "700",
    lineHeight: 21,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 22,
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 26,
    padding: 22,
    maxHeight: "90%",
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: COLORS.primarySoft,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
  },
  modalSubtitle: {
    color: COLORS.muted,
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
    color: COLORS.primary,
    fontWeight: "900",
  },
});
