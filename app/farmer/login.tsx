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

type FarmerUser = any;

const FARMER_ARRAY_KEYS = [
  "farm2homeFarmers",
  "farmers",
  "approvedFarmers",
  "farm2homeVerificationQueue",
  "adminVerificationQueue",
];

const FARMER_OBJECT_KEYS = [
  "currentFarmer",
  "currentUser",
  "pendingFarmerApplication",
];

function clean(value: any) {
  return String(value || "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function safeParse(raw: string | null) {
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getFarmerId(item: any) {
  return clean(item?.id || item?.farmerId || item?.farmer_id);
}

function normalizeFarmer(item: any): FarmerUser | null {
  if (!item) return null;

  const id = getFarmerId(item);

  const status = normalize(item.status);
  const complianceStatus = normalize(item.complianceStatus);
  const adminReviewStatus = normalize(item.adminReviewStatus);
  const reviewDecision = normalize(item.reviewDecision);
  const membershipStatus = normalize(item.membershipStatus);
  const subscriptionStatus = normalize(item.subscriptionStatus);

  return {
    ...item,
    id,
    farmerId: item.farmerId || id,

    farmName: item.farmName || item.businessName || item.farm_name || "",
    businessName: item.businessName || item.farmName || item.farm_name || "",
    ownerName: item.ownerName || item.owner_name || "",
    email: normalize(item.email || item.farmerEmail),
    username: normalize(item.username),
    password: clean(item.password),

    approved:
      item.approved === true ||
      status === "approved" ||
      complianceStatus === "approved" ||
      adminReviewStatus === "approved" ||
      reviewDecision === "approved",

    rejected:
      item.rejected === true ||
      status === "rejected" ||
      complianceStatus === "rejected" ||
      adminReviewStatus === "rejected" ||
      reviewDecision === "rejected",

    accountActive:
      item.accountActive === true ||
      item.account_active === true ||
      membershipStatus === "active" ||
      subscriptionStatus === "active",

    storeUnlocked:
      item.storeUnlocked === true ||
      item.store_unlocked === true ||
      item.approved === true ||
      adminReviewStatus === "approved",

    complianceStatus: item.complianceStatus || item.status || "",
    adminReviewStatus: item.adminReviewStatus || "",
    reviewDecision: item.reviewDecision || "",
    membershipStatus: item.membershipStatus || "",
    subscriptionStatus: item.subscriptionStatus || "",
  };
}

function mergeFarmerRecords(records: FarmerUser[]) {
  const merged: FarmerUser[] = [];

  for (const record of records) {
    const id = getFarmerId(record);
    const email = normalize(record.email);
    const username = normalize(record.username);

    const index = merged.findIndex((item) => {
      return (
        (id && getFarmerId(item) === id) ||
        (email && normalize(item.email) === email) ||
        (username && normalize(item.username) === username)
      );
    });

    if (index === -1) {
      merged.push(record);
      continue;
    }

    const existing = merged[index];

    merged[index] = {
      ...existing,
      ...record,

      id: getFarmerId(record) || getFarmerId(existing),
      farmerId: record.farmerId || existing.farmerId || getFarmerId(record),

      username: normalize(record.username) || normalize(existing.username),
      password: clean(record.password) || clean(existing.password),
      email: normalize(record.email) || normalize(existing.email),

      approved: existing.approved === true || record.approved === true,
      rejected: existing.rejected === true || record.rejected === true,
      accountActive:
        existing.accountActive === true || record.accountActive === true,
      storeUnlocked:
        existing.storeUnlocked === true || record.storeUnlocked === true,

      membershipStatus:
        record.membershipStatus || existing.membershipStatus || "",
      subscriptionStatus:
        record.subscriptionStatus || existing.subscriptionStatus || "",
      complianceStatus:
        record.complianceStatus || existing.complianceStatus || "",
      adminReviewStatus:
        record.adminReviewStatus || existing.adminReviewStatus || "",
      reviewDecision: record.reviewDecision || existing.reviewDecision || "",
    };
  }

  return merged;
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

  async function readArray(key: string) {
    const parsed = safeParse(await AsyncStorage.getItem(key));

    if (!parsed) return [];

    if (Array.isArray(parsed)) {
      return parsed.map(normalizeFarmer).filter(Boolean);
    }

    const one = normalizeFarmer(parsed);
    return one ? [one] : [];
  }

  async function loadAllFarmers() {
    const farmers: FarmerUser[] = [];

    for (const key of FARMER_OBJECT_KEYS) {
      const farmer = normalizeFarmer(
        safeParse(await AsyncStorage.getItem(key))
      );

      if (farmer) farmers.push(farmer);
    }

    for (const key of FARMER_ARRAY_KEYS) {
      const records = await readArray(key);
      farmers.push(...records);
    }

    const merged = mergeFarmerRecords(farmers);

    console.log(
      "FARMER LOGIN RECORDS:",
      merged.map((item) => ({
        id: item.id,
        email: item.email,
        username: item.username,
        hasPassword: Boolean(item.password),
        approved: item.approved,
        active: item.accountActive,
        unlocked: item.storeUnlocked,
        status: item.complianceStatus,
      }))
    );

    return merged;
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
    const cleanPassword = clean(password);

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
        const passwordMatch = clean(farmer.password) === cleanPassword;

        return (usernameMatch || emailMatch) && passwordMatch;
      });

      if (!matched) {
        Alert.alert(
          "Login Failed",
          "No farmer account matched that username/email and password. Open the browser console and check FARMER LOGIN RECORDS to see whether username/password were saved."
        );
        return;
      }

      await saveFarmerSession(matched);

      if (matched.rejected) {
        Alert.alert(
          "Application Rejected",
          "This farmer application was rejected. Contact Farm2Home support."
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

    Alert.alert(
      "Farmer Account Found",
      `Username: ${recoveryFarmer.username || "Not saved"}\nPassword: ${
        recoveryFarmer.password || "Not saved"
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
          <Text style={styles.linkText}>Find Saved Username / Password</Text>
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
              <Text style={styles.modalTitle}>Find Farmer Account</Text>

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

                  <TouchableOpacity
                    style={styles.loginButton}
                    onPress={startRecovery}
                  >
                    <Text style={styles.loginButtonText}>Find Account</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.recoveryText}>
                    Username: {recoveryFarmer.username || "Not saved"}
                  </Text>

                  <Text style={styles.recoveryText}>
                    Password: {recoveryFarmer.password || "Not saved"}
                  </Text>

                  <TouchableOpacity
                    style={styles.loginButton}
                    onPress={verifyRecovery}
                  >
                    <Text style={styles.loginButtonText}>Show Login Info</Text>
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
  recoveryText: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 16,
    marginBottom: 12,
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