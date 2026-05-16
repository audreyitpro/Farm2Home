import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";

export default function AdminLoginScreen() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (loading) return;

    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      Alert.alert("Missing Info", "Enter username and password.");
      return;
    }

    if (
      cleanUsername !== ADMIN_USERNAME ||
      cleanPassword !== ADMIN_PASSWORD
    ) {
      Alert.alert(
        "Login Failed",
        "Invalid admin username or password."
      );
      return;
    }

    try {
      setLoading(true);

      const adminUser = {
        id: "admin_test_001",
        username: ADMIN_USERNAME,
        email: "admin@test.com",
        fullName: "Farm2Home Admin",
        role: "admin",
        loginAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem(
        "currentUser",
        JSON.stringify(adminUser)
      );

      await AsyncStorage.setItem(
        "currentUserRole",
        "admin"
      );

      router.replace("/admin/dashboard" as any);
    } catch (error: any) {
      console.log("Admin login error:", error);

      Alert.alert(
        "Error",
        error?.message || "Unable to login."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : undefined
      }
    >
      <View style={styles.container}>
        <Text style={styles.logo}>🛡️</Text>

        <Text style={styles.title}>
          Admin Login
        </Text>

        <Text style={styles.subtitle}>
          Farm2Home Administration Portal
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>
            Username
          </Text>

          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="admin"
          />

          <Text style={styles.label}>
            Password
          </Text>

          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="admin123"
          />

          <TouchableOpacity
            style={[
              styles.button,
              loading &&
                styles.buttonDisabled,
            ]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text
              style={styles.buttonText}
            >
              {loading
                ? "Signing In..."
                : "Login"}
            </Text>
          </TouchableOpacity>

          <View style={styles.testBox}>
            <Text
              style={styles.testTitle}
            >
              Test Credentials
            </Text>

            <Text
              style={styles.testText}
            >
              Username: admin
            </Text>

            <Text
              style={styles.testText}
            >
              Password: admin123
            </Text>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    padding: 24,
  },

  container: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
  },

  logo: {
    fontSize: 62,
    textAlign: "center",
    marginBottom: 10,
  },

  title: {
    fontSize: 36,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
  },

  subtitle: {
    color: "#4B5563",
    textAlign: "center",
    fontWeight: "700",
    marginTop: 6,
    marginBottom: 24,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  label: {
    color: "#374151",
    fontWeight: "900",
    marginBottom: 8,
    marginTop: 8,
  },

  input: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: "#111827",
    fontWeight: "700",
    marginBottom: 10,
  },

  button: {
    backgroundColor: "#111827",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 12,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },

  testBox: {
    marginTop: 20,
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  testTitle: {
    color: "#111827",
    fontWeight: "900",
    marginBottom: 8,
  },

  testText: {
    color: "#4B5563",
    fontWeight: "700",
    lineHeight: 22,
  },
});