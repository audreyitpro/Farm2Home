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

import freightTheme from "../styles/freightTheme";
import { registerDriverPushNotifications } from "../services/notificationService";

type DriverUser = any;

const DRIVER_ARRAY_KEYS = [
  "farm2homeDrivers",
  "drivers",
  "driverAccounts",
  "farm2homeLoginIndex",
];

const DRIVER_OBJECT_KEYS = [
  "currentDriver",
  "currentUser",
  "pendingDriver",
  "farm2homeCurrentDriver",
  "farm2homeDriverSession",
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

function normalizeAnswer(value: string) {
  return String(value || "").trim().toLowerCase();
}

function mapDriver(item: any): DriverUser | null {
  if (!item) return null;

  const role = normalize(item.role);

  if (role && role !== "driver") return null;

  return {
    ...item,
    id: item.id || item.driverId || item.email || `driver_${Date.now()}`,
    driverId: item.driverId || item.id || item.email || `driver_${Date.now()}`,
    role: "driver",
    fullName: item.fullName || item.name || item.driverName || "Farm2Home Driver",
    email: normalize(item.email),
    username: normalize(item.username),
    password: clean(item.password),
    accountActive: item.accountActive !== false,
    membershipStatus: item.membershipStatus || "Active",
    subscriptionStatus: item.subscriptionStatus || "active",
  };
}

function isDriverActive(driver: DriverUser) {
  if (driver.accountActive === false) return false;

  const membershipStatus = normalize(driver.membershipStatus);
  const subscriptionStatus = normalize(driver.subscriptionStatus);

  if (membershipStatus === "canceled") return false;
  if (subscriptionStatus === "canceled") return false;
  if (subscriptionStatus === "past_due") return false;
  if (subscriptionStatus === "unpaid") return false;

  return true;
}

export default function DriverLoginScreen() {
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const [forgotVisible, setForgotVisible] = useState(false);
  const [recoveryValue, setRecoveryValue] = useState("");
  const [recoveryDriver, setRecoveryDriver] = useState<DriverUser | null>(null);

  const [answer1, setAnswer1] = useState("");
  const [answer2, setAnswer2] = useState("");
  const [answer3, setAnswer3] = useState("");

  async function readArray(key: string) {
    const parsed = safeParse(await AsyncStorage.getItem(key));

    if (!parsed) return [];

    if (Array.isArray(parsed)) {
      return parsed.map(mapDriver).filter(Boolean);
    }

    const one = mapDriver(parsed);
    return one ? [one] : [];
  }

  async function getDrivers() {
    const drivers: DriverUser[] = [];

    for (const key of DRIVER_OBJECT_KEYS) {
      const parsed = safeParse(await AsyncStorage.getItem(key));
      const driver = mapDriver(parsed);
      if (driver) drivers.push(driver);
    }

    for (const key of DRIVER_ARRAY_KEYS) {
      const records = await readArray(key);
      drivers.push(...records);
    }

    const merged: DriverUser[] = [];

    for (const driver of drivers) {
      const index = merged.findIndex(
        (item) =>
          item.id === driver.id ||
          (driver.email && item.email === driver.email) ||
          (driver.username && item.username === driver.username)
      );

      if (index === -1) {
        merged.push(driver);
      } else {
        merged[index] = {
          ...merged[index],
          ...driver,
          username: driver.username || merged[index].username,
          password: driver.password || merged[index].password,
          email: driver.email || merged[index].email,
          accountActive: merged[index].accountActive || driver.accountActive,
        };
      }
    }

    console.log(
      "DRIVER LOGIN RECORDS:",
      merged.map((item) => ({
        id: item.id,
        email: item.email,
        username: item.username,
        password: item.password,
        active: item.accountActive,
        membershipStatus: item.membershipStatus,
        subscriptionStatus: item.subscriptionStatus,
      }))
    );

    return merged;
  }

  async function saveLoggedInDriver(driver: DriverUser) {
    const normalizedDriver = {
      ...driver,
      id: driver.id || driver.driverId || driver.email || `driver_${Date.now()}`,
      driverId:
        driver.driverId || driver.id || driver.email || `driver_${Date.now()}`,
      role: "driver",
      accountActive: driver.accountActive !== false,
      membershipStatus: driver.membershipStatus || "Active",
      subscriptionStatus: driver.subscriptionStatus || "active",
      updatedAt: new Date().toISOString(),
    };

    for (const key of ["farm2homeDrivers", "drivers", "driverAccounts"]) {
      const records = await readArray(key);

      const updated = [
        normalizedDriver,
        ...records.filter(
          (item) =>
            item.id !== normalizedDriver.id &&
            item.driverId !== normalizedDriver.driverId &&
            normalize(item.email) !== normalize(normalizedDriver.email) &&
            normalize(item.username) !== normalize(normalizedDriver.username)
        ),
      ];

      await AsyncStorage.setItem(key, JSON.stringify(updated));
    }

    await AsyncStorage.setItem("currentDriver", JSON.stringify(normalizedDriver));
    await AsyncStorage.setItem("currentUser", JSON.stringify(normalizedDriver));
    await AsyncStorage.setItem(
      "farm2homeCurrentDriver",
      JSON.stringify(normalizedDriver)
    );
    await AsyncStorage.setItem(
      "farm2homeDriverSession",
      JSON.stringify(normalizedDriver)
    );
    await AsyncStorage.setItem("userRole", "driver");
    await AsyncStorage.setItem("currentUserRole", "driver");
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

      const drivers = await getDrivers();

      const foundDriver = drivers.find((item) => {
        const emailMatch = normalize(item.email) === cleanLogin;
        const usernameMatch = normalize(item.username) === cleanLogin;
        const passwordMatch = clean(item.password) === cleanPassword;

        console.log("DRIVER LOGIN CHECK", {
          storedEmail: item.email,
          storedUsername: item.username,
          enteredLogin: cleanLogin,
          storedPassword: item.password,
          enteredPassword: cleanPassword,
          emailMatch,
          usernameMatch,
          passwordMatch,
        });

        return (emailMatch || usernameMatch) && passwordMatch;
      });

      if (!foundDriver) {
        Alert.alert("Login Failed", "Invalid driver login credentials.");
        return;
      }

      if (!isDriverActive(foundDriver)) {
        Alert.alert(
          "Account Disabled",
          "This driver account is disabled or subscription is not active."
        );
        return;
      }

      await saveLoggedInDriver(foundDriver);

      try {
        const token = await registerDriverPushNotifications(foundDriver.id);
        console.log("Driver push token:", token);
      } catch (pushError) {
        console.log("Driver push registration error:", pushError);
      }

      router.replace("/driver/mobile-driver-app" as any);
    } catch (error) {
      console.log("Driver login error:", error);
      Alert.alert("Login Error", "Unable to login to driver account.");
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

    const drivers = await getDrivers();

    const foundDriver =
      drivers.find(
        (item) =>
          normalize(item.email) === cleanValue ||
          normalize(item.username) === cleanValue
      ) || null;

    if (!foundDriver) {
      Alert.alert("Not Found", "No driver account found.");
      return;
    }

    setRecoveryDriver(foundDriver);
  }

  function verifyRecovery() {
    if (!recoveryDriver) return;

    const valid1 =
      normalizeAnswer(answer1) === normalizeAnswer(recoveryDriver.securityAnswer1);

    const valid2 =
      normalizeAnswer(answer2) === normalizeAnswer(recoveryDriver.securityAnswer2);

    const valid3 =
      normalizeAnswer(answer3) === normalizeAnswer(recoveryDriver.securityAnswer3);

    if (!valid1 || !valid2 || !valid3) {
      Alert.alert("Verification Failed", "Security answers do not match.");
      return;
    }

    Alert.alert(
      "Driver Account Recovered",
      `Username: ${recoveryDriver.username}\nPassword: ${recoveryDriver.password}`
    );

    setForgotVisible(false);
    setRecoveryDriver(null);
    setRecoveryValue("");
    setAnswer1("");
    setAnswer2("");
    setAnswer3("");
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Driver Login</Text>

        <Text style={styles.subtitle}>
          Access Farm2Home delivery orders, routes, proof of delivery, and
          earnings.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Username or Email"
          placeholderTextColor="#8A8F98"
          autoCapitalize="none"
          autoCorrect={false}
          value={loginValue}
          onChangeText={setLoginValue}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#8A8F98"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={[styles.loginButton, loading && styles.disabledButton]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.loginButtonText}>Driver Login</Text>
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
          onPress={() => router.push("/driver/register" as any)}
        >
          <Text style={styles.linkText}>Register as Driver</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={forgotVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Driver Recovery</Text>

              {!recoveryDriver ? (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Username or Email"
                    placeholderTextColor="#8A8F98"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={recoveryValue}
                    onChangeText={setRecoveryValue}
                  />

                  <TouchableOpacity
                    style={styles.loginButton}
                    onPress={startRecovery}
                  >
                    <Text style={styles.loginButtonText}>Continue</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.question}>
                    {recoveryDriver.securityQuestion1}
                  </Text>

                  <TextInput
                    style={styles.input}
                    placeholder="Answer"
                    secureTextEntry
                    value={answer1}
                    onChangeText={setAnswer1}
                  />

                  <Text style={styles.question}>
                    {recoveryDriver.securityQuestion2}
                  </Text>

                  <TextInput
                    style={styles.input}
                    placeholder="Answer"
                    secureTextEntry
                    value={answer2}
                    onChangeText={setAnswer2}
                  />

                  <Text style={styles.question}>
                    {recoveryDriver.securityQuestion3}
                  </Text>

                  <TextInput
                    style={styles.input}
                    placeholder="Answer"
                    secureTextEntry
                    value={answer3}
                    onChangeText={setAnswer3}
                  />

                  <TouchableOpacity
                    style={styles.loginButton}
                    onPress={verifyRecovery}
                  >
                    <Text style={styles.loginButtonText}>Recover Account</Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setForgotVisible(false);
                  setRecoveryDriver(null);
                  setRecoveryValue("");
                  setAnswer1("");
                  setAnswer2("");
                  setAnswer3("");
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
    backgroundColor: freightTheme.colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  card: {
    width: "100%",
    maxWidth: 500,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
  },

  title: {
    fontSize: 32,
    fontWeight: "900",
    color: freightTheme.colors.primary,
    textAlign: "center",
    marginBottom: 10,
  },

  subtitle: {
    textAlign: "center",
    color: freightTheme.colors.mutedText,
    lineHeight: 22,
    marginBottom: 22,
    fontWeight: "700",
  },

  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    color: "#111827",
    fontWeight: "700",
  },

  loginButton: {
    backgroundColor: "#EA580C",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
  },

  disabledButton: {
    opacity: 0.6,
  },

  loginButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },

  linkButton: {
    marginTop: 16,
  },

  linkText: {
    textAlign: "center",
    color: "#EA580C",
    fontWeight: "900",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 20,
  },

  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 22,
    maxHeight: "90%",
  },

  modalTitle: {
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 18,
    color: "#111827",
  },

  question: {
    fontWeight: "900",
    marginBottom: 8,
    color: "#111827",
  },

  closeButton: {
    marginTop: 18,
    alignItems: "center",
  },

  closeText: {
    color: "#B91C1C",
    fontWeight: "900",
  },
});