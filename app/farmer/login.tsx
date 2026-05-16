import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

import {
  authenticateFarmer,
  getFarmerByUsername,
  verifyFarmerSecurityQuestions,
} from "../data/farmerStore";

export default function FarmerLoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryUsername, setRecoveryUsername] = useState("");
  const [answer1, setAnswer1] = useState("");
  const [answer2, setAnswer2] = useState("");
  const [answer3, setAnswer3] = useState("");

  const [loading, setLoading] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  async function loginFarmer() {
    try {
      if (!username.trim() || !password.trim()) {
        Alert.alert("Missing Login", "Please enter username and password.");
        return;
      }

      setLoading(true);

      const farmer = await authenticateFarmer(username.trim(), password.trim());

      if (!farmer) {
        Alert.alert(
          "Login Failed",
          "Username or password is incorrect, or the account is not active."
        );
        return;
      }

      await AsyncStorage.setItem("currentFarmer", JSON.stringify(farmer));

      if (farmer.complianceStatus !== "approved" || farmer.approved !== true) {
        router.replace("/farmer/compliance-upload" as any);
        return;
      }

      router.replace("/farmer/setup-store" as any);
    } catch (error) {
      console.log("Farmer login error:", error);
      Alert.alert("Login Error", "Unable to login farmer.");
    } finally {
      setLoading(false);
    }
  }

  async function recoverLogin() {
    try {
      if (
        !recoveryUsername.trim() ||
        !answer1.trim() ||
        !answer2.trim() ||
        !answer3.trim()
      ) {
        Alert.alert(
          "Missing Information",
          "Please enter username/email and all 3 security answers."
        );
        return;
      }

      setRecoveryLoading(true);

      const farmer = await verifyFarmerSecurityQuestions(
        recoveryUsername.trim(),
        answer1.trim(),
        answer2.trim(),
        answer3.trim()
      );

      if (!farmer) {
        Alert.alert(
          "Recovery Failed",
          "Security answers do not match this farmer account."
        );
        return;
      }

      Alert.alert(
        "Account Found",
        `Username: ${farmer.username || farmer.email}\nPassword: ${
          farmer.password || "No password saved"
        }`
      );
    } catch (error) {
      console.log("Farmer recovery error:", error);
      Alert.alert("Recovery Error", "Unable to recover account.");
    } finally {
      setRecoveryLoading(false);
    }
  }

  async function lookupQuestions() {
    if (!recoveryUsername.trim()) {
      Alert.alert("Username Required", "Enter your username or email first.");
      return;
    }

    const farmer = await getFarmerByUsername(recoveryUsername.trim());

    if (!farmer) {
      Alert.alert("Not Found", "No farmer account found for that username.");
      return;
    }

    Alert.alert(
      "Security Questions",
      `${farmer.securityQuestion1 || "Question 1 not saved"}\n\n${
        farmer.securityQuestion2 || "Question 2 not saved"
      }\n\n${farmer.securityQuestion3 || "Question 3 not saved"}`
    );
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.header}>Farmer Login</Text>

      <Text style={styles.subheader}>
        Login to continue your Farm2Home compliance, store setup, and produce
        listings.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Login</Text>

        <TextInput
          style={styles.input}
          placeholder="Username or email"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Pressable
          style={[styles.primaryButton, loading && styles.disabled]}
          onPress={loginFarmer}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Login</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.linkButton}
          onPress={() => setShowRecovery(!showRecovery)}
        >
          <Text style={styles.linkText}>
            {showRecovery ? "Hide Recovery" : "Forgot username or password?"}
          </Text>
        </Pressable>
      </View>

      {showRecovery && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account Recovery</Text>

          <TextInput
            style={styles.input}
            placeholder="Username or email"
            value={recoveryUsername}
            onChangeText={setRecoveryUsername}
            autoCapitalize="none"
          />

          <Pressable style={styles.secondaryButton} onPress={lookupQuestions}>
            <Text style={styles.secondaryButtonText}>
              Show Security Questions
            </Text>
          </Pressable>

          <TextInput
            style={styles.input}
            placeholder="Answer 1"
            value={answer1}
            onChangeText={setAnswer1}
            secureTextEntry
          />

          <TextInput
            style={styles.input}
            placeholder="Answer 2"
            value={answer2}
            onChangeText={setAnswer2}
            secureTextEntry
          />

          <TextInput
            style={styles.input}
            placeholder="Answer 3"
            value={answer3}
            onChangeText={setAnswer3}
            secureTextEntry
          />

          <Pressable
            style={[styles.primaryButton, recoveryLoading && styles.disabled]}
            onPress={recoverLogin}
            disabled={recoveryLoading}
          >
            {recoveryLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Recover Login</Text>
            )}
          </Pressable>
        </View>
      )}

      <Pressable
        style={styles.outlineButton}
        onPress={() => router.replace("/farmer/compliance-upload" as any)}
      >
        <Text style={styles.outlineButtonText}>
          Continue to Farmer Compliance
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F5F7EF",
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  header: {
    fontSize: 34,
    fontWeight: "900",
    color: "#14532D",
    marginTop: 24,
  },
  subheader: {
    color: "#64745E",
    marginTop: 8,
    lineHeight: 22,
    marginBottom: 18,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#DDE7DB",
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#14532D",
    marginBottom: 14,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 16,
    padding: 14,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: "#14532D",
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 4,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: "#047857",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  linkButton: {
    alignItems: "center",
    paddingVertical: 14,
  },
  linkText: {
    color: "#047857",
    fontWeight: "900",
  },
  outlineButton: {
    borderWidth: 2,
    borderColor: "#047857",
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  outlineButtonText: {
    color: "#047857",
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.7,
  },
});