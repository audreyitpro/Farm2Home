// app/farmer/register.tsx

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { supabase } from "../services/supabaseClient";

const PENDING_FARMER_KEY = "pendingFarmerApplication";

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

function StatusPill({ done }: { done: boolean }) {
  return (
    <View style={[styles.pill, done ? styles.pillDone : styles.pillMissing]}>
      <Text
        style={[
          styles.pillText,
          done ? styles.pillTextDone : styles.pillTextMissing,
        ]}
      >
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

  async function notifyAdminFarmerVerification(farmer: any) {
    try {
      await fetch(`${API_BASE_URL}/notify/farmer-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(farmer),
      });
    } catch (error) {
      console.log("Farmer admin email ignored:", error);
    }
  }

  async function saveLocalFarmerSession(farmer: any) {
    await AsyncStorage.setItem("currentFarmer", JSON.stringify(farmer));
    await AsyncStorage.setItem(PENDING_FARMER_KEY, JSON.stringify(farmer));
    await AsyncStorage.setItem("currentUser", JSON.stringify(farmer));
    await AsyncStorage.setItem("userRole", "farmer");
    await AsyncStorage.setItem("currentUserRole", "farmer");
  }

  async function createOrUpdateProfile({
    authUserId,
    cleanOwnerName,
    cleanEmail,
    cleanPhone,
    cleanUsername,
  }: {
    authUserId: string;
    cleanOwnerName: string;
    cleanEmail: string;
    cleanPhone: string;
    cleanUsername: string;
  }) {
    const { data: existingProfile, error: existingProfileError } =
      await supabase
        .from("profiles")
        .select("*")
        .eq("email", cleanEmail)
        .maybeSingle();

    if (existingProfileError) throw existingProfileError;

    if (existingProfile?.id) {
      const { data, error } = await supabase
        .from("profiles")
        .update({
          auth_user_id: authUserId,
          role: "farmer",
          full_name: cleanOwnerName,
          name: cleanOwnerName,
          phone: cleanPhone,
          username: cleanUsername,
          account_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingProfile.id)
        .select("*")
        .single();

      if (error) throw error;
      return data;
    }

    const { data, error } = await supabase
      .from("profiles")
      .insert({
        auth_user_id: authUserId,
        role: "farmer",
        full_name: cleanOwnerName,
        name: cleanOwnerName,
        email: cleanEmail,
        phone: cleanPhone,
        username: cleanUsername,
        account_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  async function createAdminVerificationRecord(farmer: any) {
    const adminRecord = {
      id: farmer.id,
      farmer_id: farmer.id,
      account_type: "FARMER",
      role: "farmer",
      type: "FARMER",

      farm_name: farmer.farm_name,
      business_name: farmer.business_name,
      company_name: farmer.business_name,
      owner_name: farmer.owner_name,
      email: farmer.email,
      phone: farmer.phone,
      state: farmer.state,

      status: "STARTED",
      compliance_status: "in_progress",
      admin_review_status: "not_submitted",
      review_decision: "not_submitted",

      approved: false,
      rejected: false,
      reviewed: false,
      needs_more_info: false,
      account_active: false,
      store_unlocked: false,

      compliance_submitted: false,
      application_fee_paid: false,
      farmer_membership_paid: false,
      monthly_membership_started: false,

      stripe_account_id: "",
      farmer_stripe_account_id: "",
      stripe_onboarding_complete: false,
      stripe_payouts_enabled: false,
      stripe_charges_enabled: false,

      uploaded_docs: {},
      legal_checks: {},
      documents: [],

      created_at: farmer.created_at,
      updated_at: farmer.updated_at,
    };

    const { error } = await supabase
      .from("admin_verifications")
      .upsert(adminRecord, { onConflict: "id" });

    if (error) {
      console.log("Admin verification save ignored:", error.message);
    }
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
        "Accept all Farmer Onboarding Agreement items before continuing."
      );
      return false;
    }

    return true;
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
      const cleanState = stateValue.trim().toUpperCase().slice(0, 2) || "MI";
      const now = new Date().toISOString();

      const { data: existingFarmer, error: existingError } = await supabase
        .from("farmers")
        .select("id,email,username")
        .or(`email.eq.${cleanEmail},username.eq.${cleanUsername}`)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existingFarmer) {
        Alert.alert(
          "Account Already Exists",
          "A farmer account with this email or username already exists. Please login instead."
        );
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password.trim(),
        options: {
          data: {
            role: "farmer",
            username: cleanUsername,
            owner_name: cleanOwnerName,
            business_name: cleanBusinessName,
            farm_name: cleanFarmName,
          },
        },
      });

      if (authError) {
        Alert.alert("Registration Error", authError.message);
        return;
      }

      const authUserId = authData?.user?.id;

      if (!authUserId) {
        Alert.alert(
          "Registration Error",
          "Unable to create authentication account."
        );
        return;
      }

      const profile = await createOrUpdateProfile({
        authUserId,
        cleanOwnerName,
        cleanEmail,
        cleanPhone,
        cleanUsername,
      });

      if (!profile?.id) {
        Alert.alert("Profile Error", "Unable to create profile record.");
        return;
      }

      const farmerPayload = {
        id: authUserId,
        profile_id: profile.id,

        email: cleanEmail,
        username: cleanUsername,
        phone: cleanPhone,

        owner_name: cleanOwnerName,
        farm_name: cleanFarmName,
        business_name: cleanBusinessName,

        business_address: businessAddress.trim(),
        city: city.trim(),
        state: cleanState,
        zip_code: zipCode.trim(),

        selected_products: selectedProducts,
        selected_product_categories: selectedProducts,
        legal_agreements: accepted,

        compliance_status: "in_progress",
        admin_review_status: "not_submitted",
        review_decision: "not_submitted",

        approved: false,
        rejected: false,
        reviewed: false,
        needs_more_info: false,

        account_active: false,
        store_unlocked: false,
        compliance_submitted: false,

        application_fee_paid: false,
        farmer_membership_paid: false,
        monthly_membership_started: false,

        stripe_account_id: "",
        farmer_stripe_account_id: "",
        stripe_onboarding_complete: false,
        stripe_payouts_enabled: false,
        stripe_charges_enabled: false,

        uploaded_docs: {},
        legal_checks: {},

        products: [],

        created_at: now,
        updated_at: now,
      };

      const { error: farmerError } = await supabase
        .from("farmers")
        .upsert(farmerPayload, { onConflict: "id" });

      if (farmerError) {
        Alert.alert("Farmer Profile Error", farmerError.message);
        return;
      }

      await createAdminVerificationRecord(farmerPayload);

      const localFarmer = {
        id: authUserId,
        farmerId: authUserId,
        profileId: profile.id,
        role: "farmer",

        ownerName: cleanOwnerName,
        farmName: cleanFarmName,
        businessName: cleanBusinessName,
        email: cleanEmail,
        phone: cleanPhone,
        username: cleanUsername,

        businessAddress: businessAddress.trim(),
        city: city.trim(),
        state: cleanState,
        zipCode: zipCode.trim(),

        selectedProducts,
        selectedProductCategories: selectedProducts,

        approved: false,
        rejected: false,
        reviewed: false,
        needsMoreInfo: false,
        accountActive: false,
        storeUnlocked: false,

        complianceSubmitted: false,
        complianceStatus: "in_progress",
        adminReviewStatus: "not_submitted",
        reviewDecision: "not_submitted",

        applicationFeePaid: false,
        farmerMembershipPaid: false,
        monthlyMembershipStarted: false,

        stripeAccountId: "",
        farmerStripeAccountId: "",
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
      notifyAdminFarmerVerification(localFarmer);

      router.replace({
        pathname: "/farmer/compliance-upload",
        params: {
          farmerId: authUserId,
          email: cleanEmail,
          businessName: cleanBusinessName,
        },
      } as any);
    } catch (error: any) {
      console.log("Farmer registration error:", error);
      Alert.alert(
        "Registration Error",
        error?.message || "Unable to create farmer application."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#14532D" />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.kicker}>Farm2Home Farmer Portal</Text>
          <Text style={styles.heroTitle}>Start Your Farmer Application</Text>
          <Text style={styles.heroSub}>
            Create your farm profile first. Then complete payment, Stripe payout,
            pickup/delivery, and seller agreement.
          </Text>
        </View>

        <View style={styles.priceCard}>
          <Text style={styles.priceTitle}>Farmer Pricing</Text>
          <Text style={styles.priceLine}>Application Process Fee: $29.99</Text>
          <Text style={styles.priceLine}>Monthly Membership: $14.99</Text>
          <Text style={styles.priceLine}>Marketplace Service Fee: 4%</Text>
        </View>

        <SectionCard
          icon="business-outline"
          title="Farm Business Info"
          subtitle="Basic farm and owner details."
          done={businessComplete}
        >
          <TextInput
            style={styles.input}
            placeholder="Owner Name"
            value={ownerName}
            onChangeText={setOwnerName}
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Farm Name"
            value={farmName}
            onChangeText={setFarmName}
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Business Name"
            value={businessName}
            onChangeText={setBusinessName}
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Email Address"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
        </SectionCard>

        <SectionCard
          icon="lock-closed-outline"
          title="Create Farmer Login"
          subtitle="Credentials used for future farmer login."
          done={loginComplete}
        >
          <TextInput
            style={styles.input}
            placeholder="Create Username"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Create Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            autoCorrect={false}
          />
        </SectionCard>

        <SectionCard
          icon="location-outline"
          title="Farm Location"
          subtitle="Used for local customer discovery."
          done={locationComplete}
        >
          <TextInput
            style={styles.input}
            placeholder="Business Address"
            value={businessAddress}
            onChangeText={setBusinessAddress}
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="City"
            value={city}
            onChangeText={setCity}
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="State"
            value={stateValue}
            onChangeText={(value) =>
              setStateValue(value.toUpperCase().slice(0, 2))
            }
            maxLength={2}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Zip Code"
            keyboardType="numeric"
            value={zipCode}
            onChangeText={setZipCode}
          />
        </SectionCard>

        <SectionCard
          icon="leaf-outline"
          title="Products You Sell"
          subtitle="Select at least one category."
          done={productsComplete}
        >
          <View style={styles.grid}>
            {productOptions.map((product) => {
              const active = selectedProducts.includes(product);

              return (
                <TouchableOpacity
                  key={product}
                  style={[
                    styles.productChip,
                    active && styles.productChipActive,
                  ]}
                  onPress={() => toggleProduct(product)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.productText,
                      active && styles.productTextActive,
                    ]}
                  >
                    {product}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </SectionCard>

        <SectionCard
          icon="shield-checkmark-outline"
          title="Farmer Onboarding Agreement"
          subtitle="Accept all items before continuing."
          done={legalComplete}
        >
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

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.disabled]}
          onPress={registerFarmer}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitText}>Continue to Farmer Setup</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginBtn}
          onPress={() => router.push("/farmer/login" as any)}
          activeOpacity={0.85}
        >
          <Text style={styles.loginText}>Already have account? Farmer Login</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAF5" },
  content: { paddingBottom: 80 },
  hero: {
    backgroundColor: "#14532D",
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 32,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  kicker: {
    color: "#BBF7D0",
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
    color: "#DCFCE7",
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },
  priceCard: {
    backgroundColor: "#FFFBEB",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  priceTitle: {
    color: "#92400E",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 8,
  },
  priceLine: {
    color: "#78350F",
    fontWeight: "800",
    marginBottom: 4,
  },
  card: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8DA",
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
    backgroundColor: "#2E7D32",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    color: "#172017",
    fontSize: 20,
    fontWeight: "900",
  },
  cardSub: {
    color: "#64748B",
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
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 16,
    padding: 14,
    fontWeight: "800",
    marginBottom: 10,
    color: "#0F172A",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  productChip: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 999,
  },
  productChipActive: {
    backgroundColor: "#2E7D32",
    borderColor: "#2E7D32",
  },
  productText: {
    color: "#172017",
    fontWeight: "900",
  },
  productTextActive: {
    color: "#FFFFFF",
  },
  legalRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#2E7D32",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: "#2E7D32" },
  checkText: { color: "#FFFFFF", fontWeight: "900" },
  legalText: {
    flex: 1,
    color: "#172017",
    fontWeight: "800",
    lineHeight: 21,
  },
  submitBtn: {
    backgroundColor: "#14532D",
    marginHorizontal: 16,
    marginTop: 18,
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: "center",
  },
  submitText: { color: "#FFFFFF", fontWeight: "900", fontSize: 16 },
  disabled: { opacity: 0.6 },
  loginBtn: {
    paddingVertical: 18,
    alignItems: "center",
  },
  loginText: {
    color: "#14532D",
    fontWeight: "900",
  },
});