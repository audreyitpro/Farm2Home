import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";

import { AppUserRole, signUpWithEmail } from "../services/authService";

const roles: { label: string; value: AppUserRole }[] = [
  { label: "Customer", value: "customer" },
  { label: "Farmer", value: "farmer" },
  { label: "Freight", value: "freight" },
  { label: "Driver", value: "driver" },
];

export default function RegisterScreen() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [role, setRole] = useState<AppUserRole>("customer");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (loading) return;

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password.trim()) {
      Alert.alert("Missing Fields", "Enter full name, email, and password.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Weak Password", "Password must be at least 6 characters.");
      return;
    }

    try {
      setLoading(true);

      const result = await signUpWithEmail({
        email: cleanEmail,
        password,
        fullName: cleanName,
        role,
      });

      console.log("Register result:", result);

      if (!result?.success) {
        Alert.alert(
          "Registration Failed",
          result?.error || "Unable to register."
        );
        return;
      }

      Alert.alert("Account Created", "Registration successful.", [
        {
          text: "OK",
          onPress: () => router.replace("/auth/login"),
        },
      ]);
    } catch (error: any) {
      console.log("Register error:", error);
      Alert.alert(
        "Registration Failed",
        error?.message || "Unable to register right now."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={styles.logo}>🌾</Text>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Join Farm2Home as a customer, farmer, driver, or freight partner.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Register</Text>

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Enter full name"
            style={styles.input}
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Enter email"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={styles.input}
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Create password"
            secureTextEntry
            style={styles.input}
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.label}>Account Type</Text>

          <View style={styles.roleGrid}>
            {roles.map((item) => {
              const active = role === item.value;

              return (
                <TouchableOpacity
                  key={item.value}
                  style={[styles.roleButton, active && styles.roleButtonActive]}
                  onPress={() => setRole(item.value)}
                  disabled={loading}
                >
                  <Text
                    style={[styles.roleText, active && styles.roleTextActive]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.registerButton, loading && styles.disabledButton]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.registerText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push("/auth/login")}
            disabled={loading}
          >
            <Text style={styles.loginText}>Already have an account? Login</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  scrollContent: {
    padding: 22,
    paddingBottom: 80,
  },
  hero: {
    alignItems: "center",
    marginTop: 50,
    marginBottom: 24,
  },
  logo: {
    fontSize: 60,
    marginBottom: 10,
  },
  title: {
    color: "#064E3B",
    fontSize: 36,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    color: "#475569",
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardTitle: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 20,
  },
  label: {
    color: "#374151",
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    color: "#111827",
    fontWeight: "700",
  },
  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  roleButton: {
    width: "47%",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
  },
  roleButtonActive: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  roleText: {
    color: "#374151",
    fontWeight: "900",
  },
  roleTextActive: {
    color: "#FFFFFF",
  },
  registerButton: {
    backgroundColor: "#10B981",
    padding: 16,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 22,
  },
  disabledButton: {
    opacity: 0.6,
  },
  registerText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  loginButton: {
    alignItems: "center",
    marginTop: 18,
  },
  loginText: {
    color: "#10B981",
    fontWeight: "900",
  },
  bottomSpacer: {
    height: 80,
  },
});