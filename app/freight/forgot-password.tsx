// app/freight/forgot-password.tsx

import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { createClient } from "@supabase/supabase-js";
import { Ionicons } from "@expo/vector-icons";

import freightTheme from "../styles/freightTheme";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase: any = createClient(supabaseUrl, supabaseAnonKey);

function normalize(value: string) {
  return String(value || "").trim().toLowerCase();
}

export default function FreightForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendResetLink() {
    const cleanEmail = normalize(email);

    if (!cleanEmail || !cleanEmail.includes("@")) {
      Alert.alert("Email Required", "Enter your freight account email.");
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: "farm2home://reset-password",
      });

      if (error) {
        Alert.alert("Reset Error", error.message);
        return;
      }

      Alert.alert(
        "Reset Link Sent",
        "Check your email for the secure password reset link.",
        [{ text: "OK", onPress: () => router.replace("/freight/login" as any) }]
      );
    } catch (error: any) {
      Alert.alert(
        "Reset Error",
        error?.message || "Unable to send password reset email."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="key-outline" size={34} color="#FFFFFF" />
            </View>

            <Text style={styles.kicker}>Farm2Home Freight Connect</Text>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Enter your freight account email and we will send a secure reset
              link.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Freight Account Recovery</Text>
            <Text style={styles.cardSubtitle}>
              Use the same email connected to your Freight Connect carrier
              account.
            </Text>

            <Text style={styles.inputLabel}>Freight Email</Text>
            <TextInput
              style={styles.input}
              placeholder="carrier@email.com"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={sendResetLink}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="mail-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>Send Reset Link</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.replace("/freight/login" as any)}
            >
              <Ionicons
                name="arrow-back-outline"
                size={18}
                color={freightTheme.colors.primary}
              />
              <Text style={styles.secondaryButtonText}>Back to Freight Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  keyboard: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 90,
  },
  hero: {
    backgroundColor: "#020617",
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#064E3B",
    borderWidth: 1,
    borderColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  kicker: {
    color: "#10B981",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 36,
    fontWeight: "900",
    marginTop: 6,
  },
  subtitle: {
    color: "#CBD5E1",
    marginTop: 8,
    lineHeight: 23,
    fontWeight: "700",
  },
  card: {
    backgroundColor: freightTheme.colors.card,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    margin: 18,
  },
  cardTitle: {
    color: freightTheme.colors.text,
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
  },
  cardSubtitle: {
    color: freightTheme.colors.mutedText,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 22,
    lineHeight: 22,
    fontWeight: "700",
  },
  inputLabel: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    marginBottom: 7,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: "#111827",
    fontWeight: "700",
    marginBottom: 14,
  },
  primaryButton: {
    backgroundColor: freightTheme.colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: freightTheme.colors.surface,
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  secondaryButtonText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
    fontSize: 16,
  },
});