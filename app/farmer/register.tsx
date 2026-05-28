// app/farmer/register.tsx

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { createClient } from "@supabase/supabase-js";

import { API_BASE_URL } from "../config/api";
import { registerForPushNotificationsAsync } from "../services/notificationService";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase: any = createClient(supabaseUrl, supabaseAnonKey);

const productOptions = [
  "Produce",
  "Eggs",
  "Honey",
  "Beef",
  "Chicken",
  "Goat",
  "Lamb",
  "Halal Meat",
  "Dairy",
  "Herbs",
  "Baked Goods",
  "Jams",
  "Bale of Hay",
  "Live Stock",
  "Flowers",
  "Plants",
  "Seasonal Items",
];

const PENDING_FARMER_KEY = "pendingFarmerApplication";

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
  const [stateValue, setStateValue] = useState("");
  const [zipCode, setZipCode] = useState("");

  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const [a1, setA1] = useState(false);
  const [a2, setA2] = useState(false);
  const [a3, setA3] = useState(false);
  const [a4, setA4] = useState(false);
  const [a5, setA5] = useState(false);
  const [a6, setA6] = useState(false);

  const [loading, setLoading] = useState(false);

  function toggleProduct(product: string) {
    setSelectedProducts((prev) =>
      prev.includes(product)
        ? prev.filter((item) => item !== product)
        : [...prev, product]
    );
  }

  function normalizeEmail(value: string) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeUsername(value: string) {
    return String(value || "").trim().toLowerCase();
  }

  async function notifyAdminFarmerVerification(farmer: {
    farmerId: string;
    ownerName: string;
    farmName: string;
    businessName: string;
    email: string;
    phone: string;
    businessAddress: string;
    city: string;
    state: string;
    zipCode: string;
    selectedProducts: string[];
  }) {
    try {
      const response = await fetch(`${API_BASE_URL}/notify/farmer-verification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(farmer),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.log("Farmer admin email failed:", data);
      }
    } catch (error) {
      console.log("Farmer admin email error:", error);
    }
  }

  async function saveLocalFarmerSession(farmer: any) {
    await AsyncStorage.setItem("currentFarmer", JSON.stringify(farmer));
    await AsyncStorage.setItem(PENDING_FARMER_KEY, JSON.stringify(farmer));
    await AsyncStorage.setItem("currentUser", JSON.stringify(farmer));
    await AsyncStorage.setItem("userRole", "farmer");
    await AsyncStorage.setItem("currentUserRole", "farmer");
  }

  async function createAdminVerificationRecord(farmer: any) {
    const adminRecord = {
      id: farmer.id,
      farmer_id: farmer.id,
      account_type: "FARMER",

      farm_name: farmer.farm_name,
      business_name: farmer.business_name,
      owner_name: farmer.owner_name,
      email: farmer.email,
      phone: farmer.phone,

      business_address: farmer.business_address,
      city: farmer.city,
      state: farmer.state,
      zip_code: farmer.zip_code,

      selected_products: farmer.selected_products,
      documents: [],

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

      application_fee_paid: false,
      farmer_membership_paid: false,
      monthly_membership_started: false,
      monthly_membership_required_after_approval: true,

      stripe_account_id: "",
      farmer_stripe_account_id: "",
      stripe_onboarding_complete: false,
      stripe_payouts_enabled: false,
      stripe_charges_enabled: false,

      created_at: farmer.created_at,
      updated_at: farmer.updated_at,
    };

    const { error } = await supabase
      .from("admin_verifications")
      .upsert(adminRecord, { onConflict: "id" });

    if (error) {
      console.log("Admin verification insert error:", error.message);
    }
  }

  async function registerFarmer() {
    if (
      !ownerName.trim() ||
      !farmName.trim() ||
      !businessName.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !username.trim() ||
      !password.trim()
    ) {
      Alert.alert(
        "Missing Info",
        "Please complete all farmer account fields, including username and password."
      );
      return;
    }

    if (!email.includes("@")) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    if (password.trim().length < 6) {
      Alert.alert("Password Too Short", "Password must be at least 6 characters.");
      return;
    }

    if (password.trim() !== confirmPassword.trim()) {
      Alert.alert("Password Mismatch", "Passwords do not match.");
      return;
    }

    if (selectedProducts.length === 0) {
      Alert.alert("Missing Products", "Select at least one product type.");
      return;
    }

    if (!a1 || !a2 || !a3 || !a4 || !a5 || !a6) {
      Alert.alert(
        "Agreement Required",
        "You must accept all legal agreements before continuing."
      );
      return;
    }

    try {
      setLoading(true);

      const cleanOwnerName = ownerName.trim();
      const cleanFarmName = farmName.trim();
      const cleanBusinessName = businessName.trim();
      const cleanEmail = normalizeEmail(email);
      const cleanPhone = phone.trim();
      const cleanUsername = normalizeUsername(username);

      const cleanAddress = businessAddress.trim();
      const cleanCity = city.trim();
      const cleanState = stateValue.trim().toUpperCase();
      const cleanZip = zipCode.trim();

      const now = new Date().toISOString();

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

      const farmerId = authData?.user?.id;

      if (!farmerId) {
        Alert.alert(
          "Registration Error",
          "Unable to create authentication account. Please try again."
        );
        return;
      }

      const farmerPayload = {
        id: farmerId,
        farmer_id: farmerId,

        role: "farmer",
        owner_name: cleanOwnerName,
        farm_name: cleanFarmName,
        business_name: cleanBusinessName,
        email: cleanEmail,
        phone: cleanPhone,

        username: cleanUsername,

        business_address: cleanAddress,
        city: cleanCity,
        state: cleanState,
        zip_code: cleanZip,

        selected_products: selectedProducts,

        approved: false,
        rejected: false,
        reviewed: false,
        needs_more_info: false,

        account_active: false,
        store_unlocked: false,

        compliance_submitted: false,
        compliance_status: "in_progress",
        admin_review_status: "not_submitted",
        review_decision: "not_submitted",

        application_fee_paid: false,
        farmer_membership_paid: false,
        monthly_membership_started: false,
        monthly_membership_required_after_approval: true,

        stripe_account_id: "",
        farmer_stripe_account_id: "",
        stripe_onboarding_complete: false,
        stripe_payouts_enabled: false,
        stripe_charges_enabled: false,
        payouts_enabled: false,
        charges_enabled: false,

        products: [],

        notifications_enabled: false,
        expo_push_token: "",

        created_at: now,
        updated_at: now,
      };

      const { error: farmerError } = await supabase
        .from("farmers")
        .upsert(farmerPayload, { onConflict: "id" });

      if (farmerError) {
        Alert.alert("Profile Error", farmerError.message);
        return;
      }

      await createAdminVerificationRecord(farmerPayload);

      const localFarmer = {
        id: farmerId,
        farmerId,

        role: "farmer",
        ownerName: cleanOwnerName,
        farmName: cleanFarmName,
        businessName: cleanBusinessName,
        email: cleanEmail,
        phone: cleanPhone,
        username: cleanUsername,

        businessAddress: cleanAddress,
        city: cleanCity,
        state: cleanState,
        zipCode: cleanZip,

        selectedProducts,

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
        monthlyMembershipRequiredAfterApproval: true,

        stripeAccountId: "",
        farmerStripeAccountId: "",
        stripeOnboardingComplete: false,
        stripePayoutsEnabled: false,
        stripeChargesEnabled: false,
        payoutsEnabled: false,
        chargesEnabled: false,

        products: [],

        createdAt: now,
        updatedAt: now,
      };

      await saveLocalFarmerSession(localFarmer);

      await registerForPushNotificationsAsync(farmerId, "farmer");

      await notifyAdminFarmerVerification({
        farmerId,
        ownerName: cleanOwnerName,
        farmName: cleanFarmName,
        businessName: cleanBusinessName,
        email: cleanEmail,
        phone: cleanPhone,
        businessAddress: cleanAddress,
        city: cleanCity,
        state: cleanState,
        zipCode: cleanZip,
        selectedProducts,
      });

      Alert.alert(
        "Farmer Account Created",
        "Continue to compliance verification and Stripe payout setup."
      );

      router.push({
        pathname: "/farmer/compliance-upload",
        params: {
          farmerId,
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
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.header}>🚜 Farmer Account Setup</Text>

      <Text style={styles.subheader}>
        Create your farm profile, secure password, accept the Farmer Onboarding
        Agreement, and begin Farm2Home verification review.
      </Text>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Required For Approval</Text>

        <Text style={styles.noticeText}>
          Business Registration • Sales Tax/Exemption • Food Safety Registration
          • W-9 • Liability Insurance
        </Text>
      </View>

      <View style={styles.priceBox}>
        <Text style={styles.priceTitle}>Farmer Pricing</Text>
        <Text style={styles.priceText}>Application Process Fee: $29.99</Text>
        <Text style={styles.priceText}>
          Monthly Membership: $14.99 after approval
        </Text>
        <Text style={styles.priceText}>Marketplace Service Fee: 4%</Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Owner Name"
        placeholderTextColor="#8A8F98"
        value={ownerName}
        onChangeText={setOwnerName}
      />

      <TextInput
        style={styles.input}
        placeholder="Farm Name"
        placeholderTextColor="#8A8F98"
        value={farmName}
        onChangeText={setFarmName}
      />

      <TextInput
        style={styles.input}
        placeholder="Business Name"
        placeholderTextColor="#8A8F98"
        value={businessName}
        onChangeText={setBusinessName}
      />

      <TextInput
        style={styles.input}
        placeholder="Email Address"
        placeholderTextColor="#8A8F98"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Phone Number"
        placeholderTextColor="#8A8F98"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />

      <Text style={styles.sectionTitle}>Create Farmer Login</Text>

      <TextInput
        style={styles.input}
        placeholder="Create Username"
        placeholderTextColor="#8A8F98"
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
      />

      <TextInput
        style={styles.input}
        placeholder="Create Password"
        placeholderTextColor="#8A8F98"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        placeholderTextColor="#8A8F98"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      <TextInput
        style={styles.input}
        placeholder="Business Address"
        placeholderTextColor="#8A8F98"
        value={businessAddress}
        onChangeText={setBusinessAddress}
      />

      <TextInput
        style={styles.input}
        placeholder="City"
        placeholderTextColor="#8A8F98"
        value={city}
        onChangeText={setCity}
      />

      <TextInput
        style={styles.input}
        placeholder="State"
        placeholderTextColor="#8A8F98"
        value={stateValue}
        onChangeText={setStateValue}
      />

      <TextInput
        style={styles.input}
        placeholder="Zip Code"
        placeholderTextColor="#8A8F98"
        keyboardType="numeric"
        value={zipCode}
        onChangeText={setZipCode}
      />

      <Text style={styles.sectionTitle}>Select Certified Products On Your Farm</Text>

      <View style={styles.grid}>
        {productOptions.map((product) => {
          const active = selectedProducts.includes(product);

          return (
            <TouchableOpacity
              key={product}
              style={[styles.productChip, active && styles.productChipActive]}
              onPress={() => toggleProduct(product)}
              activeOpacity={0.85}
            >
              <Text style={[styles.productText, active && styles.productTextActive]}>
                {product}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.legalBox}>
        <Text style={styles.legalTitle}>Farmer Onboarding Agreement</Text>

        <Agreement
          label="I understand I am an independent seller and not an employee, agent, or partner of Farm2Home."
          value={a1}
          onPress={() => setA1(!a1)}
        />

        <Agreement
          label="I accept full responsibility for food quality, safety, storage, packaging, labeling, and product accuracy."
          value={a2}
          onPress={() => setA2(!a2)}
        />

        <Agreement
          label="I certify I comply with Michigan and federal laws required to sell my products."
          value={a3}
          onPress={() => setA3(!a3)}
        />

        <Agreement
          label="I agree to resolve customer complaints through refund, replacement, or credit when appropriate."
          value={a4}
          onPress={() => setA4(!a4)}
        />

        <Agreement
          label="I agree to indemnify and hold harmless Farm2Home and ASO Developments LLC from claims related to my products, operations, or legal violations."
          value={a5}
          onPress={() => setA5(!a5)}
        />

        <Agreement
          label="I accept Farm2Home service fees, membership fees, payout terms, and platform policies."
          value={a6}
          onPress={() => setA6(!a6)}
        />
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.disabledButton]}
        onPress={registerFarmer}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Start Document Verification</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.push("/farmer/login" as any)}
        activeOpacity={0.85}
      >
        <Text style={styles.secondaryText}>Already have account? Farmer Login</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Agreement({
  label,
  value,
  onPress,
}: {
  label: string;
  value: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.fakeCheckbox, value && styles.fakeCheckboxActive]}>
        <Text style={styles.fakeCheckboxText}>{value ? "✓" : ""}</Text>
      </View>

      <Text style={styles.agreementText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F7F7F2" },
  content: { padding: 20, paddingBottom: 40 },
  header: { fontSize: 30, fontWeight: "900", color: "#2F7D32" },
  subheader: {
    color: "#666666",
    marginTop: 6,
    marginBottom: 18,
    lineHeight: 21,
  },
  notice: {
    backgroundColor: "#E8F5E9",
    padding: 14,
    borderRadius: 16,
    marginBottom: 14,
    borderLeftWidth: 5,
    borderLeftColor: "#2F7D32",
  },
  noticeTitle: { fontWeight: "900", color: "#2F7D32", marginBottom: 5 },
  noticeText: { color: "#444444", lineHeight: 20 },
  priceBox: {
    backgroundColor: "#FFF8E1",
    padding: 14,
    borderRadius: 16,
    marginBottom: 16,
    borderLeftWidth: 5,
    borderLeftColor: "#D4A017",
  },
  priceTitle: { fontWeight: "900", color: "#8A5A00", marginBottom: 5 },
  priceText: { color: "#444444", marginBottom: 4 },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 14,
    padding: 15,
    marginBottom: 12,
    color: "#111827",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginTop: 8,
    marginBottom: 12,
    color: "#111111",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  productChip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDDDDD",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 22,
  },
  productChipActive: { backgroundColor: "#2F7D32", borderColor: "#2F7D32" },
  productText: { color: "#111111", fontWeight: "700" },
  productTextActive: { color: "#FFFFFF" },
  legalBox: {
    backgroundColor: "#FFFFFF",
    padding: 15,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    marginBottom: 20,
  },
  legalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111111",
    marginBottom: 12,
  },
  row: { flexDirection: "row", alignItems: "flex-start", marginBottom: 13 },
  fakeCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#2F7D32",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1,
    backgroundColor: "#FFFFFF",
  },
  fakeCheckboxActive: { backgroundColor: "#2F7D32" },
  fakeCheckboxText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 18,
  },
  agreementText: {
    flex: 1,
    marginLeft: 10,
    color: "#333333",
    lineHeight: 19,
    fontSize: 13,
  },
  button: {
    backgroundColor: "#2F7D32",
    padding: 18,
    borderRadius: 16,
    marginTop: 6,
    alignItems: "center",
  },
  disabledButton: { backgroundColor: "#9CA3AF" },
  buttonText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "900",
    fontSize: 16,
  },
  secondaryButton: { padding: 16 },
  secondaryText: {
    textAlign: "center",
    color: "#2F7D32",
    fontWeight: "900",
  },
});