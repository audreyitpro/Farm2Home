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

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function isPossibleFarmerRecord(item: any) {
  const role = normalize(item?.role || item?.accountType || item?.account_type);

  return (
    role === "farmer" ||
    role === "farmer_account" ||
    role === "farmer user" ||
    role === "farmer_user" ||
    item?.farmerId ||
    item?.farmName ||
    item?.farm_name ||
    item?.businessName ||
    item?.ownerName ||
    item?.storeUnlocked !== undefined
  );
}

export default function FarmerLoginScreen() {
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [forgotVisible, setForgotVisible] = useState(false);
  const [recoveryValue, setRecoveryValue] = useState("");
  const [recoveryFarmer, setRecoveryFarmer] = useState<FarmerUser | null>(null);

  async function getAllStoredRecords() {
    const keys = await AsyncStorage.getAllKeys();
    const pairs = await AsyncStorage.multiGet(keys);

    const records: any[] = [];

    pairs.forEach(([key, value]) => {
      if (!value) return;

      try {
        const parsed = JSON.parse(value);

        if (Array.isArray(parsed)) {
          parsed.forEach((item) => {
            if (item && typeof item === "object") {
              records.push({ ...item, __storageKey: key });
            }
          });
        } else if (parsed && typeof parsed === "object") {
          records.push({ ...parsed, __storageKey: key });
        }
      } catch {
        // Ignore non-JSON AsyncStorage values.
      }
    });

    return records;
  }

  async function saveFarmerSession(record: any) {
    const now = new Date().toISOString();

    const farmerId =
      clean(record.id) ||
      clean(record.farmerId) ||
      clean(record.userId) ||
      `farmer_${Date.now()}`;

    const farmer = {
      ...record,
      id: farmerId,
      farmerId,
      role: "farmer",

      username: normalize(record.username),
      email: normalize(record.email || record.farmerEmail),
      password: clean(record.password),

      farmName: record.farmName || record.businessName || record.farm_name || "",
      businessName: record.businessName || record.farmName || record.farm_name || "",
      ownerName: record.ownerName || record.owner_name || record.name || "",

      approved: true,
      rejected: false,
      reviewed: true,
      needsMoreInfo: false,

      accountActive: true,
      storeUnlocked: true,

      complianceSubmitted: true,
      complianceStatus: "approved",
      adminReviewStatus: "approved",
      reviewDecision: "approved",
      status: "APPROVED",

      membershipStatus: "Active",
      subscriptionStatus: "active",
      farmerMembershipPaid: true,
      monthlyMembershipStarted: true,

      updatedAt: now,
    };

    await AsyncStorage.setItem("currentFarmer", JSON.stringify(farmer));
    await AsyncStorage.setItem("currentUser", JSON.stringify(farmer));
    await AsyncStorage.setItem("userRole", "farmer");
    await AsyncStorage.setItem("currentUserRole", "farmer");

    const farmerArrayKeys = [
      "farm2homeFarmers",
      "farmers",
      "approvedFarmers",
      "farm2homeVerificationQueue",
      "adminVerificationQueue",
    ];

    for (const key of farmerArrayKeys) {
      const raw = await AsyncStorage.getItem(key);
      let existing: any[] = [];

      try {
        const parsed = raw ? JSON.parse(raw) : [];
        existing = Array.isArray(parsed) ? parsed : [];
      } catch {
        existing = [];
      }

      const next = [
        farmer,
        ...existing.filter((item) => {
          const sameId =
            clean(item?.id) === farmerId || clean(item?.farmerId) === farmerId;
          const sameEmail =
            normalize(item?.email || item?.farmerEmail) === farmer.email;
          const sameUsername = normalize(item?.username) === farmer.username;

          return !sameId && !sameEmail && !sameUsername;
        }),
      ];

      await AsyncStorage.setItem(key, JSON.stringify(next));
    }

    return farmer;
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

      const allRecords = await getAllStoredRecords();

      console.log(
        "ALL LOGIN RECORDS FOUND:",
        allRecords.map((item) => ({
          key: item.__storageKey,
          role: item.role || item.accountType,
          email: item.email || item.farmerEmail,
          username: item.username,
          password: item.password,
          approved: item.approved,
          active: item.accountActive,
          unlocked: item.storeUnlocked,
          businessName: item.businessName || item.farmName,
        }))
      );

      const matched = allRecords.find((item) => {
        const usernameMatch = normalize(item.username) === cleanLogin;
        const emailMatch = normalize(item.email || item.farmerEmail) === cleanLogin;
        const passwordMatch = clean(item.password) === cleanPassword;

        console.log("FARMER UNIVERSAL LOGIN CHECK", {
          key: item.__storageKey,
          storedUsername: item.username,
          enteredUsername: cleanLogin,
          storedEmail: item.email || item.farmerEmail,
          storedPassword: item.password,
          enteredPassword: cleanPassword,
          usernameMatch,
          emailMatch,
          passwordMatch,
          possibleFarmer: isPossibleFarmerRecord(item),
        });

        return (usernameMatch || emailMatch) && passwordMatch;
      });

      if (!matched) {
        Alert.alert(
          "Login Failed",
          "No saved account matched this username/email and password. Use Admin > Accounts > Reset Login, then try again."
        );
        return;
      }

      if (matched.rejected === true) {
        Alert.alert(
          "Application Rejected",
          "This farmer application was rejected. Contact Farm2Home support."
        );
        return;
      }

      await saveFarmerSession(matched);

      router.replace("/farmer/setup-store" as any);
    } catch (error: any) {
      console.log("Farmer universal login error:", error);
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

    const allRecords = await getAllStoredRecords();

    const found =
      allRecords.find((item) => {
        const usernameMatch = normalize(item.username) === cleanValue;
        const emailMatch = normalize(item.email || item.farmerEmail) === cleanValue;
        return usernameMatch || emailMatch;
      }) || null;

    if (!found) {
      Alert.alert("Not Found", "No account found.");
      return;
    }

    setRecoveryFarmer(found);
  }

  function showRecoveryInfo() {
    if (!recoveryFarmer) return;

    Alert.alert(
      "Account Found",
      `Username: ${recoveryFarmer.username || "Not saved"}\nPassword: ${
        recoveryFarmer.password || "Not saved"
      }`
    );

    setForgotVisible(false);
    setRecoveryFarmer(null);
    setRecoveryValue("");
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
          autoCorrect={false}
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
              <Text style={styles.modalTitle}>Find Account</Text>

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
                    onPress={showRecoveryInfo}
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