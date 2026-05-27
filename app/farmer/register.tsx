import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";

import { API_BASE_URL } from "../config/api";
import { addFarmer, Farmer } from "../data/farmerStore";
import {
  createVerificationRecordFromFarmer,
  upsertVerificationRecord,
} from "../data/adminStore";

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

  async function readArray(key: string) {
    const raw = await AsyncStorage.getItem(key);

    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function upsertFarmerArray(key: string, farmer: any) {
    const existing = await readArray(key);

    const next = [
      farmer,
      ...existing.filter((item: any) => {
        return (
          item?.id !== farmer.id &&
          item?.farmerId !== farmer.id &&
          String(item?.email || "").toLowerCase() !== farmer.email &&
          String(item?.username || "").toLowerCase() !== farmer.username
        );
      }),
    ];

    await AsyncStorage.setItem(key, JSON.stringify(next));
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

      const data = await response.json();

      if (!response.ok) {
        console.log("Farmer admin email failed:", data);
      }
    } catch (error) {
      console.log("Farmer admin email error:", error);
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

      const farmerId = `farmer_${Date.now()}`;

      const cleanOwnerName = ownerName.trim();
      const cleanFarmName = farmName.trim();
      const cleanBusinessName = businessName.trim();
      const cleanEmail = email.trim().toLowerCase();
      const cleanPhone = phone.trim();
      const cleanUsername = username.trim().toLowerCase();
      const cleanPassword = password.trim();

      const cleanAddress = businessAddress.trim();
      const cleanCity = city.trim();
      const cleanState = stateValue.trim().toUpperCase();
      const cleanZip = zipCode.trim();

      const now = new Date().toISOString();

      const newFarmer: Farmer & any = {
        id: farmerId,
        farmerId,

        ownerName: cleanOwnerName,
        farmName: cleanFarmName,
        businessName: cleanBusinessName,
        email: cleanEmail,
        phone: cleanPhone,

        username: cleanUsername,
        password: cleanPassword,

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

      await addFarmer(newFarmer);

      await AsyncStorage.setItem("currentFarmer", JSON.stringify(newFarmer));
      await AsyncStorage.setItem(PENDING_FARMER_KEY, JSON.stringify(newFarmer));
      await AsyncStorage.setItem("currentUser", JSON.stringify(newFarmer));
      await AsyncStorage.setItem("userRole", "farmer");
      await AsyncStorage.setItem("currentUserRole", "farmer");

      await upsertFarmerArray("farm2homeFarmers", newFarmer);
      await upsertFarmerArray("farmers", newFarmer);

      const verificationRecord = createVerificationRecordFromFarmer({
        farmerId,
        farmName: cleanFarmName,
        ownerName: cleanOwnerName,
        email: cleanEmail,
        phone: cleanPhone,
        documents: [],
      });

      await upsertVerificationRecord({
        ...verificationRecord,
        id: farmerId,
        farmerId,
        accountType: "FARMER",
        businessAddress: cleanAddress,
        city: cleanCity,
        state: cleanState,
        zipCode: cleanZip,
        businessName: cleanBusinessName,
        farmName: cleanFarmName,
        ownerName: cleanOwnerName,
        email: cleanEmail,
        phone: cleanPhone,
        username: cleanUsername,
        password: cleanPassword,
        selectedProducts,
        approved: false,
        accountActive: false,
        storeUnlocked: false,
        status: "STARTED",
        complianceStatus: "in_progress",
        adminReviewStatus: "not_submitted",
        reviewDecision: "not_submitted",
        updatedAt: now,
      } as any);

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
    } catch (error) {
      console.log("Farmer registration error:", error);

      Alert.alert("Registration Error", "Unable to create farmer application.");
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
        Create your farm profile, username/password, accept the Farmer
        Onboarding Agreement, and begin Farm2Home verification review.
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
        <Text style={styles.buttonText}>
          {loading ? "Creating Verification..." : "Start Document Verification"}
        </Text>
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