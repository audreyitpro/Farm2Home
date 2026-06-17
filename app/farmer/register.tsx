// app/farmer/register.tsx

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL } from "../config/api";
import { supabase } from "../data/supabaseClient";

const PENDING_FARMER_KEY = "pendingFarmerApplication";

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
  amber: "#D97706",
};

const productOptions = [
  "Produce",
  "Vegetables",
  "Fruit",
  "Eggs",
  "Honey",
  "Beef",
  "Chicken",
  "Turkey",
  "Goat",
  "Lamb",
  "Halal Meat",
  "Dairy",
  "Fish / Aquaculture",
  "Catfish",
  "Tilapia",
  "Trout",
  "Shrimp",
  "Crawfish",
  "Herbs",
  "Baked Goods",
  "Jams",
  "Sauces",
  "Bale of Hay",
  "Alfalfa Hay",
  "Straw Bale",
  "Animal Feed",
  "Flowers",
  "Plants",
  "Christmas Trees",
  "Pumpkins",
  "Seasonal Items",
  "Farm Supplies",
];

const agreements = [
  "I understand I am an independent seller and not an employee, agent, or partner of Farm2Home.",
  "I accept full responsibility for food quality, safety, storage, packaging, labeling, and product accuracy.",
  "I certify I comply with state and federal laws required to sell my products.",
  "I agree to resolve customer complaints through refund, replacement, or credit when appropriate.",
  "I agree to indemnify and hold harmless Farm2Home and ASO Developments LLC from claims related to my products, operations, or legal violations.",
  "I accept Farm2Home service fees, membership fees, payout terms, and platform policies.",
];

function normalizeEmail(value: string) {
  return String(value || "").trim().toLowerCase();
}

function normalizeUsername(value: string) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function openExternalUrl(url: string) {
  if (Platform.OS === "web") {
    window.location.href = url;
    return;
  }

  router.push(url as any);
}

export default function FarmerRegister() {
  const [ownerName, setOwnerName] = useState("");
  const [farmName, setFarmName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [businessAddress, setBusinessAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateValue, setStateValue] = useState("MI");
  const [zipCode, setZipCode] = useState("");

  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [accepted, setAccepted] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);

  const businessComplete = useMemo(
    () =>
      Boolean(
        ownerName.trim() &&
          farmName.trim() &&
          businessName.trim() &&
          isValidEmail(email) &&
          phone.trim()
      ),
    [ownerName, farmName, businessName, email, phone]
  );

  const loginComplete = useMemo(
    () =>
      Boolean(
        username.trim() &&
          password.trim().length >= 6 &&
          confirmPassword.trim() &&
          password.trim() === confirmPassword.trim()
      ),
    [username, password, confirmPassword]
  );

  const locationComplete = useMemo(
    () =>
      Boolean(
        businessAddress.trim() &&
          city.trim() &&
          stateValue.trim() &&
          zipCode.trim()
      ),
    [businessAddress, city, stateValue, zipCode]
  );

  const productsComplete = selectedProducts.length > 0;
  const legalComplete = agreements.every((_, index) => accepted[index]);

  function toggleProduct(product: string) {
    setSelectedProducts((prev) =>
      prev.includes(product)
        ? prev.filter((item) => item !== product)
        : [...prev, product]
    );
  }

  function validateForm() {
    if (!businessComplete) {
      Alert.alert(
        "Business Info Required",
        "Complete owner name, farm name, business name, email, and phone."
      );
      return false;
    }

    if (!loginComplete) {
      Alert.alert(
        "Login Required",
        "Create a username and matching password with at least 6 characters."
      );
      return false;
    }

    if (!locationComplete) {
      Alert.alert(
        "Location Required",
        "Complete business address, city, state, and zip code."
      );
      return false;
    }

    if (!productsComplete) {
      Alert.alert("Products Required", "Select at least one product type.");
      return false;
    }

    if (!legalComplete) {
      Alert.alert(
        "Agreement Required",
        "Accept all Farmer Seller Agreement items before continuing."
      );
      return false;
    }

    return true;
  }

  async function generateFarmerAccountId() {
    const { data, error } = await supabase.rpc("next_account_id", {
      p_role: "farmer",
      p_prefix: "Farmer",
    });

    if (error) throw error;
    if (!data) throw new Error("Unable to generate farmer account ID.");

    return String(data);
  }

  async function checkDuplicateFarmer(cleanEmail: string, cleanUsername: string) {
    const { data, error } = await supabase
      .from("farmers")
      .select("id,account_id,email,username")
      .or(`email.eq.${cleanEmail},username.eq.${cleanUsername}`)
      .maybeSingle();

    if (error) {
      console.log("Farmer duplicate check error:", error.message);
      return false;
    }

    if (data) {
      Alert.alert(
        "Account Exists",
        "A farmer account already exists with this email or username."
      );
      return true;
    }

    return false;
  }

  async function saveLocalFarmerSession(farmer: any) {
    await AsyncStorage.setItem("currentFarmer", JSON.stringify(farmer));
    await AsyncStorage.setItem(PENDING_FARMER_KEY, JSON.stringify(farmer));
    await AsyncStorage.setItem("currentUser", JSON.stringify(farmer));
    await AsyncStorage.setItem("userRole", "farmer");
    await AsyncStorage.setItem("currentUserRole", "farmer");
  }

  async function upsertProfile(payload: any) {
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", payload.id)
      .maybeSingle();

    const profilePayload = {
      id: payload.id,
      auth_user_id: payload.id,
      account_id: payload.account_id,
      role: "farmer",
      full_name: payload.owner_name,
      name: payload.owner_name,
      email: payload.email,
      phone: payload.phone,
      username: payload.username,
      company_name: payload.business_name,
      account_active: true,
      updated_at: payload.updated_at,
    };

    if (existingProfile?.id) {
      const { data, error } = await supabase
        .from("profiles")
        .update(profilePayload)
        .eq("id", payload.id)
        .select("*")
        .single();

      if (error) throw error;
      return data;
    }

    const { data, error } = await supabase
      .from("profiles")
      .insert({
        ...profilePayload,
        created_at: payload.created_at,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  async function createAdminVerificationRecord(farmerPayload: any) {
    const { error } = await supabase.from("admin_verifications").upsert(
      {
        id: farmerPayload.id,
        account_id: farmerPayload.account_id,
        farmer_id: farmerPayload.id,
        profile_id: farmerPayload.profile_id,
        account_type: "FARMER",
        role: "farmer",
        type: "FARMER",

        farm_name: farmerPayload.farm_name,
        business_name: farmerPayload.business_name,
        company_name: farmerPayload.business_name,
        owner_name: farmerPayload.owner_name,
        email: farmerPayload.email,
        phone: farmerPayload.phone,
        username: farmerPayload.username,

        business_address: farmerPayload.business_address,
        address: farmerPayload.address,
        city: farmerPayload.city,
        state: farmerPayload.state,
        zip_code: farmerPayload.zip_code,

        selected_products: farmerPayload.selected_products,
        selected_product_categories: farmerPayload.selected_product_categories,
        legal_agreements: farmerPayload.legal_agreements,

        status: "ACTIVE",
        compliance_status: "ACTIVE",
        admin_review_status: "DOCUMENT_REVIEW_ONLY",
        review_decision: "NOT_REQUIRED",

        approved: true,
        rejected: false,
        reviewed: false,
        needs_more_info: false,
        account_active: true,
        store_unlocked: true,

        compliance_submitted: false,
        application_fee_paid: false,
        farmer_membership_paid: false,
        monthly_membership_started: false,

        stripe_account_id: null,
        farmer_stripe_account_id: null,
        stripe_customer_id: null,
        stripe_subscription_id: null,
        stripe_checkout_session_id: null,
        stripe_connect_status: "not_started",
        payouts_enabled: false,
        charges_enabled: false,
        stripe_payouts_enabled: false,
        stripe_charges_enabled: false,
        stripe_onboarding_complete: false,

        uploaded_docs: {},
        legal_checks: {},
        documents: [],

        created_at: farmerPayload.created_at,
        updated_at: farmerPayload.updated_at,
      },
      { onConflict: "id" }
    );

    if (error) console.log("Farmer admin verification save error:", error.message);
  }

  async function notifyAdminFarmer(farmer: any) {
    try {
      await fetch(`${API_BASE_URL}/notify/farmer-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(farmer),
      });
    } catch (error) {
      console.log("Farmer admin notify skipped:", error);
    }
  }

  async function createFarmerCheckout(params: {
    farmerId: string;
    accountId: string;
    email: string;
    name: string;
    username: string;
    businessName: string;
    farmName: string;
  }) {
    const response = await fetch(`${API_BASE_URL}/payments/create-farmer-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farmer_id: params.farmerId,
        farmerId: params.farmerId,
        account_id: params.accountId,
        accountId: params.accountId,
        email: params.email,
        farmer_email: params.email,
        name: params.name,
        username: params.username,
        businessName: params.businessName,
        business_name: params.businessName,
        farmName: params.farmName,
        farm_name: params.farmName,
        role: "farmer",
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        result?.error ||
          result?.message ||
          "Unable to create farmer Stripe checkout session."
      );
    }

    const checkoutUrl = result?.url || result?.checkoutUrl || result?.sessionUrl;

    if (!checkoutUrl) {
      throw new Error("Stripe checkout URL was not returned from backend.");
    }

    return checkoutUrl;
  }

  async function registerFarmer() {
    if (loading) return;
    if (!validateForm()) return;

    try {
      setLoading(true);

      const cleanOwnerName = ownerName.trim();
      const cleanFarmName = farmName.trim();
      const cleanBusinessName = businessName.trim();
      const cleanEmail = normalizeEmail(email);
      const cleanPhone = phone.trim();
      const cleanUsername = normalizeUsername(username);
      const cleanPassword = password.trim();
      const cleanState = stateValue.trim().toUpperCase().slice(0, 2) || "MI";
      const now = new Date().toISOString();

      const duplicate = await checkDuplicateFarmer(cleanEmail, cleanUsername);
      if (duplicate) return;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
        options: {
          data: {
            role: "farmer",
            username: cleanUsername,
            owner_name: cleanOwnerName,
            full_name: cleanOwnerName,
            name: cleanOwnerName,
            business_name: cleanBusinessName,
            farm_name: cleanFarmName,
          },
        },
      });

      if (authError) {
        Alert.alert("Signup Error", authError.message);
        return;
      }

      const farmerId = authData?.user?.id;

      if (!farmerId) {
        Alert.alert("Signup Error", "Unable to create farmer account. Please try again.");
        return;
      }

      const accountId = await generateFarmerAccountId();

      const farmerPayload = {
        id: farmerId,
        account_id: accountId,
        auth_user_id: farmerId,
        profile_id: farmerId,
        role: "farmer",

        email: cleanEmail,
        username: cleanUsername,
        phone: cleanPhone,

        owner_name: cleanOwnerName,
        full_name: cleanOwnerName,
        name: cleanOwnerName,
        farm_name: cleanFarmName,
        business_name: cleanBusinessName,
        company_name: cleanBusinessName,

        business_address: businessAddress.trim(),
        address: businessAddress.trim(),
        city: city.trim(),
        state: cleanState,
        zip_code: zipCode.trim(),

        selected_products: selectedProducts,
        selected_product_categories: selectedProducts,
        product_categories: selectedProducts,
        legal_agreements: accepted,

        compliance_status: "ACTIVE",
        admin_review_status: "DOCUMENT_REVIEW_ONLY",
        review_decision: "NOT_REQUIRED",

        approved: true,
        rejected: false,
        reviewed: false,
        needs_more_info: false,
        account_active: true,
        store_unlocked: true,

        compliance_submitted: false,
        application_fee_paid: false,
        farmer_membership_paid: false,
        monthly_membership_started: false,

        membership_status: "pending_payment",
        subscription_status: "pending_payment",

        stripe_account_id: null,
        farmer_stripe_account_id: null,
        stripe_customer_id: null,
        stripe_subscription_id: null,
        stripe_checkout_session_id: null,
        stripe_connect_status: "not_started",
        payouts_enabled: false,
        charges_enabled: false,
        stripe_payouts_enabled: false,
        stripe_charges_enabled: false,
        stripe_onboarding_complete: false,

        uploaded_docs: {},
        legal_checks: {},
        products: [],

        notifications_enabled: true,
        expo_push_token: "",

        created_at: now,
        updated_at: now,
      };

      await upsertProfile(farmerPayload);

      const { data: savedFarmer, error: farmerError } = await supabase
        .from("farmers")
        .upsert(farmerPayload, { onConflict: "id" })
        .select("*")
        .single();

      if (farmerError) {
        Alert.alert("Farmer Save Error", farmerError.message);
        return;
      }

      await createAdminVerificationRecord(savedFarmer);

      const localFarmer = {
        id: farmerId,
        accountId,
        account_id: accountId,
        farmerId,
        profileId: farmerId,
        authUserId: farmerId,
        role: "farmer",

        ownerName: cleanOwnerName,
        fullName: cleanOwnerName,
        name: cleanOwnerName,
        farmName: cleanFarmName,
        businessName: cleanBusinessName,
        companyName: cleanBusinessName,
        email: cleanEmail,
        phone: cleanPhone,
        username: cleanUsername,

        businessAddress: businessAddress.trim(),
        address: businessAddress.trim(),
        city: city.trim(),
        state: cleanState,
        zipCode: zipCode.trim(),

        selectedProducts,
        selectedProductCategories: selectedProducts,
        productCategories: selectedProducts,
        legalAgreements: accepted,

        approved: true,
        rejected: false,
        reviewed: false,
        needsMoreInfo: false,
        accountActive: true,
        storeUnlocked: true,

        complianceSubmitted: false,
        complianceStatus: "ACTIVE",
        adminReviewStatus: "DOCUMENT_REVIEW_ONLY",
        reviewDecision: "NOT_REQUIRED",

        applicationFeePaid: false,
        farmerMembershipPaid: false,
        monthlyMembershipStarted: false,

        membershipStatus: "pending_payment",
        subscriptionStatus: "pending_payment",

        stripeAccountId: "",
        farmerStripeAccountId: "",
        stripeCustomerId: "",
        stripeSubscriptionId: "",
        stripeCheckoutSessionId: "",
        stripeConnectStatus: "not_started",
        payoutsEnabled: false,
        chargesEnabled: false,
        stripeOnboardingComplete: false,
        stripePayoutsEnabled: false,
        stripeChargesEnabled: false,

        uploadedDocs: {},
        legalChecks: {},
        products: [],

        createdAt: now,
        updatedAt: now,
      };

      await saveLocalFarmerSession(localFarmer);
      await notifyAdminFarmer(localFarmer);

      const checkoutUrl = await createFarmerCheckout({
        farmerId,
        accountId,
        email: cleanEmail,
        name: cleanOwnerName,
        username: cleanUsername,
        businessName: cleanBusinessName,
        farmName: cleanFarmName,
      });

      openExternalUrl(checkoutUrl);
    } catch (error: any) {
      console.log("Farmer registration error:", error);
      Alert.alert(
        "Registration Error",
        error?.message || "Unable to continue to farmer payment."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="leaf-outline" size={34} color="#FFFFFF" />
          </View>

          <Text style={styles.kicker}>Farm2Home Farmer Portal</Text>
          <Text style={styles.heroTitle}>Create Your Farmer Account</Text>
          <Text style={styles.heroSub}>
            Create your farm profile first. Then Stripe Checkout will open with
            your farmer ID, email, name, and username attached for automatic
            Supabase subscription syncing.
          </Text>
        </View>

        <View style={styles.priceCard}>
          <Text style={styles.priceTitle}>Farmer Pricing</Text>
          <Text style={styles.priceLine}>Application Process Fee: $29.99</Text>
          <Text style={styles.priceLine}>Monthly Membership: $14.99</Text>
          <Text style={styles.priceLine}>Marketplace Service Fee: 4%</Text>
        </View>

        <SectionCard icon="business-outline" title="Farm Business Info" subtitle="Basic farm and owner details." done={businessComplete}>
          <TextInput style={styles.input} placeholder="Owner Name" value={ownerName} onChangeText={setOwnerName} autoCorrect={false} />
          <TextInput style={styles.input} placeholder="Farm Name" value={farmName} onChangeText={setFarmName} autoCorrect={false} />
          <TextInput style={styles.input} placeholder="Business Name" value={businessName} onChangeText={setBusinessName} autoCorrect={false} />
          <TextInput style={styles.input} placeholder="Email Address" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} autoCorrect={false} />
          <TextInput style={styles.input} placeholder="Phone Number" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        </SectionCard>

        <SectionCard icon="lock-closed-outline" title="Create Farmer Login" subtitle="Credentials used for future farmer login." done={loginComplete}>
          <TextInput style={styles.input} placeholder="Create Username" autoCapitalize="none" value={username} onChangeText={setUsername} autoCorrect={false} />
          <TextInput style={styles.input} placeholder="Create Password" secureTextEntry value={password} onChangeText={setPassword} autoCorrect={false} />
          <TextInput style={styles.input} placeholder="Confirm Password" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} autoCorrect={false} />
        </SectionCard>

        <SectionCard icon="location-outline" title="Farm Location" subtitle="Used for local customer discovery." done={locationComplete}>
          <TextInput style={styles.input} placeholder="Business Address" value={businessAddress} onChangeText={setBusinessAddress} autoCorrect={false} />
          <TextInput style={styles.input} placeholder="City" value={city} onChangeText={setCity} autoCorrect={false} />
          <TextInput style={styles.input} placeholder="State" value={stateValue} onChangeText={(value) => setStateValue(value.toUpperCase().slice(0, 2))} maxLength={2} autoCapitalize="characters" autoCorrect={false} />
          <TextInput style={styles.input} placeholder="Zip Code" keyboardType="numeric" value={zipCode} onChangeText={setZipCode} />
        </SectionCard>

        <SectionCard icon="leaf-outline" title="Products You Sell" subtitle="Select at least one category." done={productsComplete}>
          <View style={styles.grid}>
            {productOptions.map((product) => {
              const active = selectedProducts.includes(product);
              return (
                <TouchableOpacity key={product} style={[styles.productChip, active && styles.productChipActive]} onPress={() => toggleProduct(product)} activeOpacity={0.85}>
                  <Text style={[styles.productText, active && styles.productTextActive]}>{product}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </SectionCard>

        <SectionCard icon="shield-checkmark-outline" title="Farmer Seller Agreement" subtitle="Accept all items before continuing." done={legalComplete}>
          {agreements.map((item, index) => {
            const checked = Boolean(accepted[index]);

            return (
              <TouchableOpacity
                key={item}
                style={styles.legalRow}
                onPress={() =>
                  setAccepted((prev) => ({
                    ...prev,
                    [index]: !prev[index],
                  }))
                }
                activeOpacity={0.85}
              >
                <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                  <Text style={styles.checkText}>{checked ? "✓" : ""}</Text>
                </View>

                <Text style={styles.legalText}>{item}</Text>
              </TouchableOpacity>
            );
          })}
        </SectionCard>

        <TouchableOpacity style={[styles.submitBtn, loading && styles.disabled]} onPress={registerFarmer} disabled={loading} activeOpacity={0.85}>
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="card-outline" size={20} color="#FFFFFF" />
              <Text style={styles.submitText}>Continue to Secure Payment</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.loginBtn} onPress={() => router.push("/farmer/login" as any)} activeOpacity={0.85}>
          <Text style={styles.loginText}>Already have account? Farmer Login</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusPill({ done }: { done: boolean }) {
  return (
    <View style={[styles.pill, done ? styles.pillDone : styles.pillMissing]}>
      <Text style={[styles.pillText, done ? styles.pillTextDone : styles.pillTextMissing]}>
        {done ? "Complete" : "Needed"}
      </Text>
    </View>
  );
}

function SectionCard({
  icon,
  title,
  subtitle,
  done,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={24} color="#FFFFFF" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardSub}>{subtitle}</Text>
        </View>

        <StatusPill done={done} />
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 90 },
  hero: {
    backgroundColor: COLORS.black,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 32,
  },
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
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 33,
    fontWeight: "900",
    marginTop: 8,
  },
  heroSub: {
    color: "#CBD5E1",
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },
  priceCard: {
    backgroundColor: COLORS.red,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 24,
    padding: 16,
  },
  priceTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 8,
  },
  priceLine: {
    color: "#FFE4E6",
    fontWeight: "800",
    marginBottom: 4,
  },
  card: {
    backgroundColor: COLORS.card,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 14,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
  },
  cardSub: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 2,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillDone: { backgroundColor: "#DCFCE7" },
  pillMissing: { backgroundColor: "#FEE2E2" },
  pillText: { fontSize: 11, fontWeight: "900" },
  pillTextDone: { color: "#166534" },
  pillTextMissing: { color: "#B91C1C" },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    fontWeight: "800",
    marginBottom: 10,
    color: COLORS.text,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  productChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 999,
  },
  productChipActive: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },
  productText: { color: COLORS.text, fontWeight: "900" },
  productTextActive: { color: "#FFFFFF" },
  legalRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: COLORS.red },
  checkText: { color: "#FFFFFF", fontWeight: "900" },
  legalText: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "800",
    lineHeight: 21,
  },
  submitBtn: {
    backgroundColor: COLORS.red,
    marginHorizontal: 16,
    marginTop: 18,
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  submitText: { color: "#FFFFFF", fontWeight: "900", fontSize: 16 },
  disabled: { opacity: 0.6 },
  loginBtn: { paddingVertical: 18, alignItems: "center" },
  loginText: { color: COLORS.red, fontWeight: "900" },
});