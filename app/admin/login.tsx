import React, { useEffect, useState } from "react";
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

const ADMIN_USERNAME = "audreyitpro";
const ADMIN_PASSWORD = "Farm2HomeAdmin26";

export default function AdminLoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function restoreAdminSession() {
      try {
        const adminLoggedIn = await AsyncStorage.getItem("adminLoggedIn");
        const currentAdmin = await AsyncStorage.getItem("currentAdmin");

        if (adminLoggedIn === "true" && currentAdmin) {
          router.replace("/admin/dashboard" as any);
        }
      } catch (error) {
        console.log("Admin restore session error:", error);
      }
    }

    restoreAdminSession();
  }, []);

  async function handleLogin() {
    if (loading) return;

    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      Alert.alert(
        "Missing Information",
        "Please enter admin username and password."
      );
      return;
    }

    if (
      cleanUsername !== ADMIN_USERNAME.toLowerCase() ||
      cleanPassword !== ADMIN_PASSWORD
    ) {
      Alert.alert("Access Denied", "Invalid admin credentials.");
      return;
    }

    try {
      setLoading(true);

      const adminUser = {
        id: "farm2home_admin_001",
        username: ADMIN_USERNAME,
        role: "ADMIN",
        accountType: "ADMIN",
        fullName: "Farm2Home Administration",
        loginAt: new Date().toISOString(),
      };

      await AsyncStorage.multiSet([
        ["currentUser", JSON.stringify(adminUser)],
        ["currentAdmin", JSON.stringify(adminUser)],
        ["farm2homeAdminSession", JSON.stringify(adminUser)],
        ["userRole", "admin"],
        ["currentUserRole", "admin"],
        ["adminLoggedIn", "true"],
        ["adminUsername", ADMIN_USERNAME],
      ]);

      router.replace("/admin/dashboard" as any);
    } catch (error: any) {
      console.log("Admin login error:", error);

      Alert.alert(
        "Admin Login Error",
        error?.message || "Unable to login."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.logo}>🛡️</Text>

        <Text style={styles.title}>Farm2Home Admin Portal</Text>

        <Text style={styles.subtitle}>
          Authorized administration access only
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Admin Username</Text>

          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Enter admin username"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.label}>Admin Password</Text>

          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Enter admin password"
            placeholderTextColor="#9CA3AF"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>
              {loading ? "Signing In..." : "Secure Admin Login"}
            </Text>
          </TouchableOpacity>
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
    fontSize: 64,
    textAlign: "center",
    marginBottom: 12,
  },

  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
  },

  subtitle: {
    color: "#4B5563",
    textAlign: "center",
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 22,
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
    marginTop: 14,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
});