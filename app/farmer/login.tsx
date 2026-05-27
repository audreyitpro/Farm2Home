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

type FarmerUser = {
  id: string;
  farmerId?: string;
  farmName?: string;
  businessName?: string;
  ownerName?: string;
  email?: string;
  username?: string;
  password?: string;

  approved?: boolean;
  rejected?: boolean;
  accountActive?: boolean;
  storeUnlocked?: boolean;

  complianceStatus?: string;
  adminReviewStatus?: string;
  reviewDecision?: string;

  membershipStatus?: string;
  subscriptionStatus?: string;

  securityQuestion1?: string;
  securityAnswer1?: string;
  securityQuestion2?: string;
  securityAnswer2?: string;
  securityQuestion3?: string;
  securityAnswer3?: string;
};

const FARMER_ARRAY_KEYS = [
  "farm2homeFarmers",
  "farmers",
  "approvedFarmers",
  "farm2homeVerificationQueue",
  "adminVerificationQueue",
];

const FARMER_OBJECT_KEYS = [
  "currentFarmer",
  "pendingFarmerApplication",
];

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function safeParse(raw: string | null) {
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeFarmer(item: any): FarmerUser | null {
  if (!item) return null;

  const id = String(item.id || item.farmerId || item.farmer_id || "");

  return {
    ...item,
    id,
    farmerId: item.farmerId || id,
    farmName: item.farmName || item.businessName || item.farm_name || "",
    businessName: item.businessName || item.farmName || item.farm_name || "",
    ownerName: item.ownerName || item.owner_name || "",
    email: String(item.email || item.farmerEmail || "").trim().toLowerCase(),
    username: String(item.username || "").trim().toLowerCase(),
    password: String(item.password || ""),
    approved:
      item.approved === true ||
      normalize(item.status) === "approved" ||
      normalize(item.complianceStatus) === "approved" ||
      normalize(item.adminReviewStatus) === "approved",
    rejected:
      item.rejected === true ||
      normalize(item.status) === "rejected" ||
      normalize(item.complianceStatus) === "rejected" ||
      normalize(item.adminReviewStatus) === "rejected",
    accountActive:
      item.accountActive === true ||
      item.account_active === true ||
      normalize(item.membershipStatus) === "active",
    storeUnlocked:
      item.storeUnlocked === true ||
      item.store_unlocked === true ||
      item.approved === true,
    complianceStatus: item.complianceStatus || item.status || "",
    adminReviewStatus: item.adminReviewStatus || "",
    reviewDecision: item.reviewDecision || "",
    membershipStatus: item.membershipStatus || "",
    subscriptionStatus: item.subscriptionStatus || "",
  };
}

export default function FarmerLoginScreen() {
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [forgotVisible, setForgotVisible] = useState(false);
  const [recoveryValue, setRecoveryValue] = useState("");
  const [recoveryFarmer, setRecoveryFarmer] = useState<FarmerUser | null>(null);
  const [answer1, setAnswer1] = useState("");
  const [answer2, setAnswer2] = useState("");
  const [answer3, setAnswer3] = useState("");

  async function readFarmerArray(key: string) {
    const parsed = safeParse(await AsyncStorage.getItem(key));

    if (!parsed) return [];

    if (Array.isArray(parsed)) {
      return parsed.map(normalizeFarmer).filter(Boolean) as FarmerUser[];
    }

    const single = normalizeFarmer(parsed);
    return single ? [single] : [];
  }

  async function loadAllFarmers() {
    const farmers: FarmerUser[] = [];

    for (const key of FARMER_OBJECT_KEYS) {
      const parsed = safeParse(await AsyncStorage.getItem(key));
      const farmer = normalizeFarmer(parsed);

      if (farmer) farmers.push(farmer);
    }

    for (const key of FARMER_ARRAY_KEYS) {
      const records = await readFarmerArray(key);
      farmers.push(...records);
    }

    const deduped: FarmerUser[] = [];

    for (const farmer of farmers) {
      const exists = deduped.some(
        (item) =>
          item.id === farmer.id ||
          (item.email && item.email === farmer.email) ||
          (item.username && item.username === farmer.username)
      );

      if (!exists) deduped.push(farmer);
    }

    return deduped;
  }

  async function saveFarmerSession(farmer: FarmerUser) {
    await AsyncStorage.setItem("currentFarmer", JSON.stringify(farmer));
    await AsyncStorage.setItem("currentUser", JSON.stringify(farmer));
    await AsyncStorage.setItem("userRole", "farmer");
    await AsyncStorage.setItem("currentUserRole", "farmer");
  }

  function isApprovedAndUnlocked(farmer: FarmerUser) {
    const approved =
      farmer.approved === true ||
      normalize(farmer.complianceStatus) === "approved" ||
      normalize(farmer.adminReviewStatus) === "approved" ||
      normalize(farmer.reviewDecision) === "approved";

    const active =
      farmer.accountActive === true ||
      normalize(farmer.membershipStatus) === "active" ||
      normalize(farmer.subscriptionStatus) === "active";

    const unlocked = farmer.storeUnlocked === true || approved;

    return approved && active && unlocked;
  }

  async function handleLogin() {
    const cleanLogin = normalize(loginValue);
    const cleanPassword = String(password || "").trim();

    if (!cleanLogin || !cleanPassword) {
      Alert.alert("Missing Information", "Enter username/email and password.");
      return;
    }

    try {
      setLoading(true);

      const farmers = await loadAllFarmers();

      const matched = farmers.find((farmer) => {
        const usernameMatch = normalize(farmer.username) === cleanLogin;
        const emailMatch = normalize(farmer.email) === cleanLogin;
        const passwordMatch = String(farmer.password || "") === cleanPassword;

        return (usernameMatch || emailMatch) && passwordMatch;
      });

      if (!matched) {
        Alert.alert(
          "Login Failed",
          "No farmer account matched that username/email and password."
        );
        return;
      }

      await saveFarmerSession(matched);

      if (matched.rejected) {
        Alert.alert(
          "Application Rejected",
          "This farmer application was rejected. Contact Farm2Home support for next steps."
        );
        return;
      }

      if (isApprovedAndUnlocked(matched)) {
        router.replace("/farmer/setup-store" as any);
        return;
      }

      router.replace({
        pathname: "/farmer/awaiting-approval",
        params: {
          farmerId: matched.id,
          email: matched.email || "",
          businessName: matched.businessName || matched.farmName || "",
        },
      } as any);
    } catch (error: any) {
      console.log("Farmer login error:", error);
      Alert.alert("Login Error", error?.message || "Unable to login.");
    } finally {
      setLoading(false);
    }
  }

  async function startRecovery() {
    const cleanValue = normalize(recoveryValue);

    if (!cleanValue) {
      Alert.alert("Missing Information", "Enter username or email.");
      return;
    }

    const farmers = await loadAllFarmers();

    const found =
      farmers.find(
        (farmer) =>
          normalize(farmer.email) === cleanValue ||
          normalize(farmer.username) === cleanValue
      ) || null;

    if (!found) {
      Alert.alert("Not Found", "No farmer account found.");
      return;
    }

    setRecoveryFarmer(found);
  }

  function verifyRecovery() {
    if (!recoveryFarmer) return;

    const valid1 = normalize(answer1) === normalize(recoveryFarmer.securityAnswer1);
    const valid2 = normalize(answer2) === normalize(recoveryFarmer.securityAnswer2);
    const valid3 = normalize(answer3) === normalize(recoveryFarmer.securityAnswer3);

    if (!valid1 || !valid2 || !valid3) {
      Alert.alert("Verification Failed", "Security answers do not match.");
      return;
    }

    Alert.alert(
      "Farmer Account Recovered",
      `Username: ${recoveryFarmer.username || recoveryFarmer.email}\nPassword: ${
        recoveryFarmer.password || "Not available"
      }`
    );

    setForgotVisible(false);
    setRecoveryFarmer(null);
    setRecoveryValue("");
    setAnswer1("");
    setAnswer2("");
    setAnswer3("");
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Farmer Login</Text>

        <Text style={styles.subtitle}>
          Log in to manage your Farm2Home farmer application and market store.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Username or Email"
          placeholderTextColor="#6B7280"
          autoCapitalize="none"
          autoCorrect={false}
          value={loginValue}
          onChangeText={setLoginValue}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#6B7280"
          secureTextEntry
          autoCapitalize="none"
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
          onPress={() => setForgotVisible(true)}
        >
          <Text style={styles.linkText}>Forgot Username or Password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.push("/farmer/register" as any)}
        >
          <Text style={styles.linkText}>Register as Farmer</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={forgotVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Farmer Account Recovery</Text>

              {!recoveryFarmer ? (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Username or Email"
                    placeholderTextColor="#6B7280"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={recoveryValue}
                    onChangeText={setRecoveryValue}
                  />

                  <TouchableOpacity style={styles.loginButton} onPress={startRecovery}>
                    <Text style={styles.loginButtonText}>Continue</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.question}>
                    {recoveryFarmer.securityQuestion1 || "Security Question 1"}
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Answer"
                    secureTextEntry
                    value={answer1}
                    onChangeText={setAnswer1}
                  />

                  <Text style={styles.question}>
                    {recoveryFarmer.securityQuestion2 || "Security Question 2"}
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Answer"
                    secureTextEntry
                    value={answer2}
                    onChangeText={setAnswer2}
                  />

                  <Text style={styles.question}>
                    {recoveryFarmer.securityQuestion3 || "Security Question 3"}
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Answer"
                    secureTextEntry
                    value={answer3}
                    onChangeText={setAnswer3}
                  />

                  <TouchableOpacity style={styles.loginButton} onPress={verifyRecovery}>
                    <Text style={styles.loginButtonText}>Recover Account</Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setForgotVisible(false);
                  setRecoveryFarmer(null);
                  setRecoveryValue("");
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
    marginBottom: 18,
  },

  question: {
    color: "#111827",
    fontWeight: "900",
    marginBottom: 8,
    marginTop: 8,
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