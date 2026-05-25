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

type DriverUser = {
  id: string;
  fullName: string;
  email: string;
  username: string;
  password: string;
  securityQuestion1: string;
  securityAnswer1: string;
  securityQuestion2: string;
  securityAnswer2: string;
  securityQuestion3: string;
  securityAnswer3: string;
  approved?: boolean;
  accountActive?: boolean;
};

function safelyParseArray(rawValue: string | null): DriverUser[] {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeAnswer(value: string) {
  return String(value || "").trim().toLowerCase();
}

export default function DriverLoginScreen() {
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const [forgotVisible, setForgotVisible] = useState(false);
  const [recoveryValue, setRecoveryValue] = useState("");

  const [recoveryDriver, setRecoveryDriver] =
    useState<DriverUser | null>(null);

  const [answer1, setAnswer1] = useState("");
  const [answer2, setAnswer2] = useState("");
  const [answer3, setAnswer3] = useState("");

  async function getDrivers() {
    const raw = await AsyncStorage.getItem("farm2homeDrivers");
    return safelyParseArray(raw);
  }

  async function handleLogin() {
    const cleanLogin = loginValue.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanLogin || !cleanPassword) {
      Alert.alert(
        "Missing Information",
        "Enter username/email and password."
      );
      return;
    }

    try {
      setLoading(true);

      const drivers = await getDrivers();

      const foundDriver = drivers.find((item) => {
        const emailMatch =
          item.email?.toLowerCase() === cleanLogin;

        const usernameMatch =
          item.username?.toLowerCase() === cleanLogin;

        const passwordMatch =
          item.password === cleanPassword;

        return (emailMatch || usernameMatch) && passwordMatch;
      });

      if (!foundDriver) {
        Alert.alert(
          "Login Failed",
          "Invalid driver login credentials."
        );
        return;
      }

      if (foundDriver.accountActive === false) {
        Alert.alert(
          "Account Disabled",
          "This driver account is disabled."
        );
        return;
      }

      await AsyncStorage.setItem(
        "currentDriver",
        JSON.stringify(foundDriver)
      );

      await AsyncStorage.setItem(
        "currentUser",
        JSON.stringify(foundDriver)
      );

      await AsyncStorage.setItem(
        "userRole",
        "driver"
      );

      await AsyncStorage.setItem(
        "currentUserRole",
        "driver"
      );

      router.replace("/driver/mobile-driver-app" as any);
    } catch (error) {
      console.log("Driver login error:", error);

      Alert.alert(
        "Login Error",
        "Unable to login to driver account."
      );
    } finally {
      setLoading(false);
    }
  }

  async function startRecovery() {
    const cleanValue = recoveryValue.trim().toLowerCase();

    if (!cleanValue) {
      Alert.alert(
        "Missing Information",
        "Enter username or email."
      );
      return;
    }

    const drivers = await getDrivers();

    const foundDriver =
      drivers.find(
        (item) =>
          item.email?.toLowerCase() === cleanValue ||
          item.username?.toLowerCase() === cleanValue
      ) || null;

    if (!foundDriver) {
      Alert.alert(
        "Not Found",
        "No driver account found."
      );
      return;
    }

    setRecoveryDriver(foundDriver);
  }

  function verifyRecovery() {
    if (!recoveryDriver) return;

    const valid1 =
      normalizeAnswer(answer1) ===
      normalizeAnswer(recoveryDriver.securityAnswer1);

    const valid2 =
      normalizeAnswer(answer2) ===
      normalizeAnswer(recoveryDriver.securityAnswer2);

    const valid3 =
      normalizeAnswer(answer3) ===
      normalizeAnswer(recoveryDriver.securityAnswer3);

    if (!valid1 || !valid2 || !valid3) {
      Alert.alert(
        "Verification Failed",
        "Security answers do not match."
      );
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
        <Text style={styles.title}>
          Driver Login
        </Text>

        <Text style={styles.subtitle}>
          Access Farm2Home delivery orders,
          routes, proof of delivery, and
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
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={styles.loginButton}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.loginButtonText}>
              Driver Login
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => setForgotVisible(true)}
        >
          <Text style={styles.linkText}>
            Forgot Username or Password?
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() =>
            router.push("/driver/register" as any)
          }
        >
          <Text style={styles.linkText}>
            Register as Driver
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={forgotVisible}
        transparent
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView>
              <Text style={styles.modalTitle}>
                Driver Recovery
              </Text>

              {!recoveryDriver ? (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Username or Email"
                    placeholderTextColor="#8A8F98"
                    autoCapitalize="none"
                    value={recoveryValue}
                    onChangeText={setRecoveryValue}
                  />

                  <TouchableOpacity
                    style={styles.loginButton}
                    onPress={startRecovery}
                  >
                    <Text style={styles.loginButtonText}>
                      Continue
                    </Text>
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
                    <Text style={styles.loginButtonText}>
                      Recover Account
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setForgotVisible(false);
                  setRecoveryDriver(null);
                }}
              >
                <Text style={styles.closeText}>
                  Close
                </Text>
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