// app/customer/register.tsx

import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL, APP_URL } from "../config/api";
import { supabase } from "../data/supabaseClient";

const COLORS = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  redDark: "#9F1117",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
};

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your mother’s maiden name?",
  "What was the name of your elementary school?",
  "What was your first car?",
  "What is your favorite food?",
  "What was the name of your childhood best friend?",
  "What street did you grow up on?",
  "What is your favorite teacher’s name?",
  "What is your favorite color?",
];

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function clean(value: any) {
  return String(value || "").trim();
}

function normalizeAnswer(value: any) {
  return normalize(value);
}

function fallbackCustomerAccountId() {
  return `Customer_${Date.now()}`;
}

async function saveCurrentCustomer(customerAccount: any) {
  await AsyncStorage.setItem("pendingCustomer", JSON.stringify(customerAccount));
  await AsyncStorage.setItem("currentCustomer", JSON.stringify(customerAccount));
  await AsyncStorage.setItem("currentUser", JSON.stringify(customerAccount));
  await AsyncStorage.setItem("farm2homeCurrentCustomer", JSON.stringify(customerAccount));
  await AsyncStorage.setItem("userRole", "customer");
  await AsyncStorage.setItem("currentUserRole", "customer");
}

export default function CustomerRegister() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [securityQuestion1, setSecurityQuestion1] = useState("");
  const [securityAnswer1, setSecurityAnswer1] = useState("");
  const [securityQuestion2, setSecurityQuestion2] = useState("");
  const [securityAnswer2, setSecurityAnswer2] = useState("");
  const [securityQuestion3, setSecurityQuestion3] = useState("");
  const [securityAnswer3, setSecurityAnswer3] = useState("");

  const [loading, setLoading] = useState(false);

  const selectedQuestions = useMemo(
    () => [securityQuestion1, securityQuestion2, securityQuestion3].filter(Boolean),
    [securityQuestion1, securityQuestion2, securityQuestion3]
  );

  function validateForm() {
    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      Alert.alert("Missing Info", "Please enter your name, email, and phone.");
      return false;
    }

    if (!normalize(email).includes("@")) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return false;
    }

    if (!username.trim()) {
      Alert.alert("Username Required", "Please create a username.");
      return false;
    }

    if (normalize(username).length < 4) {
      Alert.alert("Invalid Username", "Username must be at least 4 characters.");
      return false;
    }

    if (!password.trim() || !confirmPassword.trim()) {
      Alert.alert("Password Required", "Please create and confirm your password.");
      return false;
    }

    if (password.trim().length < 6) {
      Alert.alert("Weak Password", "Password must be at least 6 characters.");
      return false;
    }

    if (password.trim() !== confirmPassword.trim()) {
      Alert.alert("Password Mismatch", "Passwords do not match.");
      return false;
    }

    if (selectedQuestions.length !== 3 || new Set(selectedQuestions).size !== 3) {
      Alert.alert("Security Required", "Please select 3 different security questions.");
      return false;
    }

    if (!securityAnswer1.trim() || !securityAnswer2.trim() || !securityAnswer3.trim()) {
      Alert.alert("Security Required", "Please answer all 3 security questions.");
      return false;
    }

    return true;
  }

  async function generateCustomerAccountId() {
    const { data, error } = await supabase.rpc("next_account_id", {
      p_role: "customer",
      p_prefix: "Customer",
    });

    if (error || !data) {
      console.log("Customer account_id RPC fallback:", error?.message);
      return fallbackCustomerAccountId();
    }

    return String(data);
  }

  async function findExistingCustomer(cleanEmail: string, cleanUsername: string) {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .or(`email.eq.${cleanEmail},username.eq.${cleanUsername}`)
      .limit(1);

    if (error) {
      console.log("Customer duplicate check error:", error.message);
      return null;
    }

    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  }

  async function upsertProfile(payload: any) {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: payload.id,
          auth_user_id: payload.id,
          profile_id: payload.id,
          account_id: payload.account_id,
          role: "customer",
          full_name: payload.full_name,
          name: payload.name,
          email: payload.email,
          phone: payload.phone,
          username: payload.username,
          stripe_id: payload.stripe_id || null,
          stripe_customer_id: payload.stripe_customer_id || null,
          stripe_subscription_id: payload.stripe_subscription_id || null,
          subscription_id: payload.subscription_id || null,
          stripe_checkout_session_id: payload.stripe_checkout_session_id || null,
          subscription_status: payload.subscription_status || "not_started",
          membership_status: payload.membership_status || "not_started",
          account_active: true,
          updated_at: now,
          created_at: payload.created_at || now,
        },
        { onConflict: "id" }
      )
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  async function saveCustomerRow(customerPayload: any) {
    const { data, error } = await supabase
      .from("customers")
      .upsert(customerPayload, { onConflict: "id" })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  async function openCheckoutUrl(url: string) {
    if (!url || !url.startsWith("http")) {
      Alert.alert("Stripe Error", "No valid Stripe checkout URL returned.");
      return;
    }

    if (Platform.OS === "web") {
      window.location.href = url;
      return;
    }

    await WebBrowser.openBrowserAsync(url);
  }

  async function startCustomerCheckout(customerRow: any, localCustomer: any) {
    const customerId = customerRow.id;
    const accountId = customerRow.account_id;
    const cleanEmail = normalize(customerRow.email);
    const cleanFullName = clean(customerRow.full_name || customerRow.name);
    const cleanUsername = normalize(customerRow.username);

    const response = await fetch(`${API_BASE_URL}/payments/create-customer-subscription-checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: "customer",
        planType: "customer",

        userId: customerId,
        customerId,
        customer_id: customerId,
        profileId: customerId,
        authUserId: customerId,

        accountId,
        account_id: accountId,

        customerEmail: cleanEmail,
        email: cleanEmail,

        name: cleanFullName,
        fullName: cleanFullName,
        companyName: cleanFullName,
        businessName: cleanFullName,
        username: cleanUsername,

        successUrl: `${APP_URL}/customer/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${APP_URL}/customer/register`,
      }),
    });

    const text = await response.text();

    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { success: false, error: text };
    }

    if (!response.ok || !data.success) {
      throw new Error(data.error || data.message || "Stripe checkout failed.");
    }

    if (data.alreadySubscribed) {
      const stripeCustomerId = data.stripeCustomerId || data.customerId || "";
      const stripeSubscriptionId = data.stripeSubscriptionId || "";

      const updatePayload = {
        stripe_id: stripeCustomerId || null,
        stripe_customer_id: stripeCustomerId || null,
        stripe_subscription_id: stripeSubscriptionId || null,
        subscription_id: stripeSubscriptionId || null,
        membership_status: "active",
        subscription_status: data.subscriptionStatus || "active",
        customer_membership_paid: true,
        account_active: true,
        updated_at: new Date().toISOString(),
      };

      await supabase.from("customers").update(updatePayload).eq("id", customerId);
      await supabase.from("profiles").update(updatePayload).eq("id", customerId);

      const activeCustomer = {
        ...localCustomer,
        stripeId: stripeCustomerId,
        stripeCustomerId,
        stripeSubscriptionId,
        subscriptionId: stripeSubscriptionId,
        membershipStatus: "active",
        subscriptionStatus: data.subscriptionStatus || "active",
        customerMembershipPaid: true,
        accountActive: true,
        updatedAt: new Date().toISOString(),
      };

      await saveCurrentCustomer(activeCustomer);

      Alert.alert("Subscription Active", "Your customer subscription is already active.", [
        { text: "Continue", onPress: () => router.replace("/customer/marketplace" as any) },
      ]);

      return;
    }

    if (!data.url) {
      throw new Error("Stripe checkout URL was not returned.");
    }

    const stripeCustomerId =
      data.stripeCustomerId ||
      data.stripe_customer_id ||
      data.customerId ||
      data.customer_id ||
      "";

    const stripeCheckoutSessionId = data.id || data.sessionId || "";

    const pendingPayload = {
      stripe_id: stripeCustomerId || null,
      stripe_customer_id: stripeCustomerId || null,
      stripe_checkout_session_id: stripeCheckoutSessionId || null,
      membership_status: "pending_payment",
      subscription_status: "pending_payment",
      updated_at: new Date().toISOString(),
    };

    await supabase.from("customers").update(pendingPayload).eq("id", customerId);
    await supabase.from("profiles").update(pendingPayload).eq("id", customerId);

    await saveCurrentCustomer({
      ...localCustomer,
      stripeId: stripeCustomerId,
      stripeCustomerId,
      stripeCheckoutSessionId,
      membershipStatus: "pending_payment",
      subscriptionStatus: "pending_payment",
      updatedAt: new Date().toISOString(),
    });

    await openCheckoutUrl(data.url);
  }

  async function createAccountAndSubscribe() {
    if (loading) return;
    if (!validateForm()) return;

    const cleanFullName = clean(fullName);
    const cleanEmail = normalize(email);
    const cleanPhone = clean(phone);
    const cleanUsername = normalize(username);
    const cleanPassword = clean(password);
    const now = new Date().toISOString();

    try {
      setLoading(true);

      const existingCustomer = await findExistingCustomer(cleanEmail, cleanUsername);

      if (existingCustomer?.id) {
        const localExisting = {
          ...existingCustomer,
          id: existingCustomer.id,
          customerId: existingCustomer.id,
          accountId: existingCustomer.account_id,
          account_id: existingCustomer.account_id,
          role: "customer",
          fullName: existingCustomer.full_name || existingCustomer.name || cleanFullName,
          name: existingCustomer.name || existingCustomer.full_name || cleanFullName,
          email: normalize(existingCustomer.email || cleanEmail),
          phone: existingCustomer.phone || cleanPhone,
          username: existingCustomer.username || cleanUsername,
          stripeCustomerId: existingCustomer.stripe_customer_id || existingCustomer.stripe_id || "",
          stripeSubscriptionId:
            existingCustomer.stripe_subscription_id || existingCustomer.subscription_id || "",
          subscriptionId:
            existingCustomer.subscription_id || existingCustomer.stripe_subscription_id || "",
          membershipStatus: existingCustomer.membership_status || "not_started",
          subscriptionStatus: existingCustomer.subscription_status || "not_started",
          accountActive: true,
          updatedAt: now,
        };

        await saveCurrentCustomer(localExisting);

        Alert.alert(
          "Account Exists",
          "This customer account already exists. You can login or continue to subscription.",
          [
            { text: "Login", onPress: () => router.replace("/customer/login" as any) },
            {
              text: "Subscribe",
              onPress: () => startCustomerCheckout(existingCustomer, localExisting),
            },
            { text: "Cancel", style: "cancel" },
          ]
        );

        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
        options: {
          data: {
            role: "customer",
            username: cleanUsername,
            full_name: cleanFullName,
            name: cleanFullName,
          },
        },
      });

      if (authError) {
        Alert.alert("Signup Error", authError.message);
        return;
      }

      const customerId = authData?.user?.id;

      if (!customerId) {
        Alert.alert("Signup Error", "Unable to create customer auth account.");
        return;
      }

      const accountId = await generateCustomerAccountId();

      const customerPayload = {
        id: customerId,
        account_id: accountId,
        auth_user_id: customerId,
        profile_id: customerId,

        role: "customer",
        full_name: cleanFullName,
        name: cleanFullName,
        email: cleanEmail,
        phone: cleanPhone,
        username: cleanUsername,

        account_active: true,
        customer_membership_paid: false,
        subscription_status: "not_started",
        membership_status: "not_started",

        stripe_id: null,
        stripe_customer_id: null,
        stripe_subscription_id: null,
        subscription_id: null,
        stripe_checkout_session_id: null,

        security_question_1: securityQuestion1,
        security_answer_1: normalizeAnswer(securityAnswer1),
        security_question_2: securityQuestion2,
        security_answer_2: normalizeAnswer(securityAnswer2),
        security_question_3: securityQuestion3,
        security_answer_3: normalizeAnswer(securityAnswer3),

        notifications_enabled: true,
        expo_push_token: "",

        created_at: now,
        updated_at: now,
      };

      await upsertProfile(customerPayload);
      const customerRow = await saveCustomerRow(customerPayload);

      const localCustomer = {
        id: customerId,
        customerId,
        authUserId: customerId,
        profileId: customerId,
        profile_id: customerId,
        accountId,
        account_id: accountId,
        role: "customer",

        fullName: cleanFullName,
        name: cleanFullName,
        email: cleanEmail,
        phone: cleanPhone,
        username: cleanUsername,

        accountActive: true,
        customerMembershipPaid: false,
        subscriptionStatus: "not_started",
        membershipStatus: "not_started",

        stripeId: "",
        stripeCustomerId: "",
        stripeSubscriptionId: "",
        subscriptionId: "",
        stripeCheckoutSessionId: "",

        securityQuestion1,
        securityAnswer1: normalizeAnswer(securityAnswer1),
        securityQuestion2,
        securityAnswer2: normalizeAnswer(securityAnswer2),
        securityQuestion3,
        securityAnswer3: normalizeAnswer(securityAnswer3),

        createdAt: now,
        updatedAt: now,
      };

      await saveCurrentCustomer(localCustomer);
      await startCustomerCheckout(customerRow, localCustomer);
    } catch (error: any) {
      console.log("CUSTOMER REGISTER ERROR:", error);
      Alert.alert(
        "Registration Error",
        error?.message || "Unable to complete customer registration."
      );
    } finally {
      setLoading(false);
    }
  }

  function renderQuestionPicker(
    label: string,
    selectedQuestion: string,
    setSelectedQuestion: (value: string) => void,
    answer: string,
    setAnswer: (value: string) => void
  ) {
    return (
      <View style={styles.questionBox}>
        <Text style={styles.questionLabel}>{label}</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {SECURITY_QUESTIONS.map((question) => {
            const active = selectedQuestion === question;

            return (
              <TouchableOpacity
                key={question}
                style={[styles.questionChip, active && styles.questionChipActive]}
                activeOpacity={0.85}
                onPress={() => setSelectedQuestion(question)}
              >
                <Text
                  style={[
                    styles.questionChipText,
                    active && styles.questionChipTextActive,
                  ]}
                >
                  {question}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TextInput
          style={styles.input}
          value={answer}
          onChangeText={setAnswer}
          placeholder="Hidden answer"
          placeholderTextColor="#94A3B8"
          secureTextEntry
        />
      </View>
    );
  }

  function SectionTitle({
    title,
    icon,
    subtitle,
  }: {
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    subtitle?: string;
  }) {
    return (
      <View style={styles.sectionTitleRow}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={20} color="#FFFFFF" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.push("/")}>
              <Ionicons name="arrow-back-outline" size={18} color="#FFFFFF" />
              <Text style={styles.backText}>Back Home</Text>
            </TouchableOpacity>

            <View style={styles.heroIcon}>
              <Ionicons name="basket-outline" size={34} color="#FFFFFF" />
            </View>

            <Text style={styles.kicker}>Farm2Home Marketplace</Text>
            <Text style={styles.title}>Create Customer Account</Text>

            <Text style={styles.subtitle}>
              Shop fresh produce, local farm products, and delivery options from your nearby
              Farm2Home farmers.
            </Text>
          </View>

          <View style={styles.noticeBox}>
            <View style={styles.noticeHeader}>
              <Ionicons name="shield-checkmark-outline" size={22} color={COLORS.red} />
              <Text style={styles.noticeTitle}>Permanent Profile Setup</Text>
            </View>

            <Text style={styles.noticeText}>
              Your customer profile is saved to Supabase first. Stripe Checkout is then created
              from the backend so your customer ID and subscription are linked correctly.
            </Text>
          </View>

          <View style={styles.priceCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.priceTitle}>Customer Membership</Text>
              <Text style={styles.priceText}>
                $4.99 monthly marketplace access for Farm2Home shopping and ordering.
              </Text>
            </View>

            <View style={styles.priceBadge}>
              <Text style={styles.priceAmount}>$4.99</Text>
            </View>
          </View>

          <View style={styles.card}>
            <SectionTitle
              title="Customer Information"
              icon="person-outline"
              subtitle="Your shopping account and contact details."
            />

            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor="#94A3B8"
              value={fullName}
              onChangeText={setFullName}
            />

            <TextInput
              style={styles.input}
              placeholder="Email Address"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              placeholderTextColor="#94A3B8"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.card}>
            <SectionTitle
              title="Create Customer Login"
              icon="lock-closed-outline"
              subtitle="Create credentials for customer marketplace access."
            />

            <TextInput
              style={styles.input}
              placeholder="Create Username"
              placeholderTextColor="#94A3B8"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              style={styles.input}
              placeholder="Create Password"
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor="#94A3B8"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.card}>
            <SectionTitle
              title="Security Questions"
              icon="help-circle-outline"
              subtitle="Choose 3 different questions for account recovery."
            />

            {renderQuestionPicker(
              "Security Question 1",
              securityQuestion1,
              setSecurityQuestion1,
              securityAnswer1,
              setSecurityAnswer1
            )}

            {renderQuestionPicker(
              "Security Question 2",
              securityQuestion2,
              setSecurityQuestion2,
              securityAnswer2,
              setSecurityAnswer2
            )}

            {renderQuestionPicker(
              "Security Question 3",
              securityQuestion3,
              setSecurityQuestion3,
              securityAnswer3,
              setSecurityAnswer3
            )}
          </View>

          <TouchableOpacity
            onPress={createAccountAndSubscribe}
            disabled={loading}
            style={[styles.createButton, loading && styles.disabledButton]}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="card-outline" size={20} color="#FFFFFF" />
                <Text style={styles.createButtonText}>Create Account + Subscribe</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/customer/login" as any)}
            style={styles.loginLink}
          >
            <Text style={styles.loginLinkText}>Already have an account? Login</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  keyboard: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 90 },
  hero: {
    backgroundColor: COLORS.black,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  backButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.red,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 18,
  },
  backText: { color: "#FFFFFF", fontWeight: "900" },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  kicker: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
    color: "#FFFFFF",
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
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 14,
  },
  noticeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 7,
  },
  noticeTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 17,
  },
  noticeText: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 22,
  },
  priceCard: {
    backgroundColor: COLORS.red,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  priceTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 20,
  },
  priceText: {
    color: "#FFE4E6",
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 20,
  },
  priceBadge: {
    backgroundColor: COLORS.black,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
  },
  priceAmount: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 22,
  },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 14,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 3,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    padding: 14,
    marginBottom: 12,
    color: COLORS.text,
    fontWeight: "700",
  },
  questionBox: { marginBottom: 12 },
  questionLabel: {
    color: COLORS.text,
    fontWeight: "900",
    marginBottom: 8,
  },
  questionChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 10,
    maxWidth: 280,
  },
  questionChipActive: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },
  questionChipText: {
    color: COLORS.red,
    fontWeight: "900",
  },
  questionChipTextActive: {
    color: "#FFFFFF",
  },
  createButton: {
    backgroundColor: COLORS.red,
    padding: 18,
    borderRadius: 18,
    marginHorizontal: 18,
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: { opacity: 0.6 },
  createButtonText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "900",
    fontSize: 16,
  },
  loginLink: {
    marginTop: 16,
    padding: 10,
  },
  loginLinkText: {
    textAlign: "center",
    color: COLORS.red,
    fontWeight: "900",
  },
});