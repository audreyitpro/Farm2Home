import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";

import { useAuth } from "../providers/AuthProvider";

import {
  completeUserOnboarding,
  updateUserProfile,
} from "../services/profileService";

import { redirectUserByRole } from "../services/roleRedirectService";

export default function OnboardingScreen() {
  const {
    user,
    profile,
    role,
    refreshProfile,
  } = useAuth();

  const [loading, setLoading] = useState(false);

  const [phone, setPhone] = useState(profile?.phone || "");
  const [city, setCity] = useState(profile?.city || "");
  const [state, setState] = useState(profile?.state || "");

  async function finishOnboarding() {
    if (!user?.id) {
      Alert.alert("Session Error", "Please login again.");
      return;
    }

    try {
      setLoading(true);

      await updateUserProfile(user.id, {
        phone,
        city,
        state,
      });

      await completeUserOnboarding(user.id);

      await refreshProfile();

      Alert.alert(
        "Setup Complete",
        "Your Farm2Home account is ready."
      );

      redirectUserByRole(role);
    } catch (error: any) {
      Alert.alert(
        "Onboarding Error",
        error.message || "Unable to complete setup."
      );
    } finally {
      setLoading(false);
    }
  }

  function roleDescription() {
    switch (role) {
      case "customer":
        return "Setup your customer shopping preferences and delivery profile.";

      case "farmer":
        return "Setup your farm business profile and marketplace settings.";

      case "freight":
        return "Setup your freight carrier and logistics operation profile.";

      case "driver":
        return "Setup your driver account and transportation profile.";

      case "admin":
        return "Setup your administrative management profile.";

      default:
        return "Complete your Farm2Home account setup.";
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.logo}>🌾</Text>

        <Text style={styles.title}>
          Complete Your Setup
        </Text>

        <Text style={styles.subtitle}>
          {roleDescription()}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          Account Information
        </Text>

        <Text style={styles.label}>Full Name</Text>

        <TextInput
          value={profile?.full_name || ""}
          editable={false}
          style={[styles.input, styles.disabledInput]}
        />

        <Text style={styles.label}>Email</Text>

        <TextInput
          value={profile?.email || ""}
          editable={false}
          style={[styles.input, styles.disabledInput]}
        />

        <Text style={styles.label}>Phone Number</Text>

        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="Enter phone number"
          keyboardType="phone-pad"
          style={styles.input}
          placeholderTextColor="#94A3B8"
        />

        <Text style={styles.label}>City</Text>

        <TextInput
          value={city}
          onChangeText={setCity}
          placeholder="Enter city"
          style={styles.input}
          placeholderTextColor="#94A3B8"
        />

        <Text style={styles.label}>State</Text>

        <TextInput
          value={state}
          onChangeText={setState}
          placeholder="Enter state"
          style={styles.input}
          placeholderTextColor="#94A3B8"
        />

        <TouchableOpacity
          style={styles.finishButton}
          onPress={finishOnboarding}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.finishText}>
              Complete Setup
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => redirectUserByRole(role)}
        >
          <Text style={styles.skipText}>
            Skip For Now
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>
          Why Setup Matters
        </Text>

        <Text style={styles.infoText}>
          Completing onboarding improves marketplace
          quality, delivery accuracy, account trust,
          logistics coordination, and personalized
          recommendations.
        </Text>
      </View>

      <View style={{ height: 70 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },

  content: {
    padding: 22,
    paddingBottom: 80,
  },

  hero: {
    alignItems: "center",
    marginTop: 60,
    marginBottom: 28,
  },

  logo: {
    fontSize: 68,
    marginBottom: 12,
  },

  title: {
    color: "#064E3B",
    fontSize: 36,
    fontWeight: "900",
    textAlign: "center",
  },

  subtitle: {
    color: "#475569",
    textAlign: "center",
    lineHeight: 23,
    marginTop: 10,
    fontWeight: "700",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  sectionTitle: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 20,
  },

  label: {
    color: "#374151",
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 10,
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

  disabledInput: {
    backgroundColor: "#E5E7EB",
    color: "#6B7280",
  },

  finishButton: {
    backgroundColor: "#10B981",
    padding: 17,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 24,
  },

  finishText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },

  skipButton: {
    alignItems: "center",
    marginTop: 18,
  },

  skipText: {
    color: "#10B981",
    fontWeight: "900",
  },

  infoCard: {
    backgroundColor: "#064E3B",
    borderRadius: 24,
    padding: 20,
    marginTop: 20,
  },

  infoTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 10,
  },

  infoText: {
    color: "#D1FAE5",
    lineHeight: 23,
    fontWeight: "700",
  },
});