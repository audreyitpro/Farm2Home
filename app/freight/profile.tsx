// app/freight/profile.tsx

import React, { useCallback, useState } from "react";
import {
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL } from "../config/api";
import freightTheme from "../styles/freightTheme";

export default function FreightProfile() {
  const [carrier, setCarrier] = useState<any>(null);
  const [allCarriers, setAllCarriers] = useState<any[]>([]);

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [mdotNumber, setMdotNumber] = useState("");
  const [mcNumber, setMcNumber] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadCarrier();
    }, [])
  );

  async function loadCarrier() {
    try {
      const raw =
        (await AsyncStorage.getItem("currentFreightCarrier")) ||
        (await AsyncStorage.getItem("currentUser"));

      const savedCarriers = await AsyncStorage.getItem("farm2homeFreightCarriers");
      const carriers = savedCarriers ? JSON.parse(savedCarriers) : [];
      const safeCarriers = Array.isArray(carriers) ? carriers : [];

      setAllCarriers(safeCarriers);

      if (!raw && safeCarriers.length === 0) {
        router.replace("/freight/login" as never);
        return;
      }

      const current = raw ? JSON.parse(raw) : safeCarriers[safeCarriers.length - 1];

      if (!current) {
        router.replace("/freight/login" as never);
        return;
      }

      setCarrier(current);
      setCompanyName(current.companyName || "");
      setContactName(current.contactName || "");
      setUsername(current.username || "");
      setEmail(current.email || "");
      setPhone(current.phone || "");
      setMdotNumber(current.mdotNumber || "");
      setMcNumber(current.mcNumber || "");
      setInsuranceProvider(current.insuranceProvider || "");
      setInsurancePolicyNumber(current.insurancePolicyNumber || "");
    } catch (error) {
      console.log("Load freight profile error:", error);
      Alert.alert("Profile Error", "Unable to load freight profile.");
    }
  }

  async function persistCarrier(updatedCarrier: any) {
    const existing = allCarriers.length > 0 ? allCarriers : [];
    const exists = existing.some((item) => item.id === updatedCarrier.id);

    const updatedCarriers = exists
      ? existing.map((item) => (item.id === updatedCarrier.id ? updatedCarrier : item))
      : [...existing, updatedCarrier];

    await AsyncStorage.setItem(
      "farm2homeFreightCarriers",
      JSON.stringify(updatedCarriers)
    );

    await AsyncStorage.setItem(
      "currentFreightCarrier",
      JSON.stringify(updatedCarrier)
    );

    await AsyncStorage.setItem("currentUser", JSON.stringify(updatedCarrier));
    await AsyncStorage.setItem("userRole", "freight");
    await AsyncStorage.setItem("currentUserRole", "freight");

    setCarrier(updatedCarrier);
    setAllCarriers(updatedCarriers);
  }

  async function saveProfile() {
    if (!carrier) {
      Alert.alert("No Profile", "No freight profile was found.");
      return;
    }

    if (!companyName.trim()) {
      Alert.alert("Company Required", "Please enter your company name.");
      return;
    }

    if (!username.trim()) {
      Alert.alert("Username Required", "Please enter your username.");
      return;
    }

    const updatedCarrier = {
      ...carrier,
      companyName: companyName.trim(),
      contactName: contactName.trim(),
      username: username.trim(),
      email: email.trim(),
      phone: phone.trim(),
      mdotNumber: mdotNumber.trim(),
      mcNumber: mcNumber.trim(),
      insuranceProvider: insuranceProvider.trim(),
      insurancePolicyNumber: insurancePolicyNumber.trim(),
      updatedAt: new Date().toISOString(),
    };

    await persistCarrier(updatedCarrier);
    Alert.alert("Saved", "Freight profile updated.");
  }

  async function changePassword() {
    if (!carrier) return;

    if (!currentPassword.trim()) {
      Alert.alert("Current Password Required", "Enter your current password.");
      return;
    }

    if (carrier.password && currentPassword !== carrier.password) {
      Alert.alert("Incorrect Password", "Your current password is incorrect.");
      return;
    }

    if (!newPassword.trim()) {
      Alert.alert("New Password Required", "Enter your new password.");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Password Too Short", "Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Alert.alert("Password Mismatch", "New passwords do not match.");
      return;
    }

    const updatedCarrier = {
      ...carrier,
      password: newPassword,
      updatedAt: new Date().toISOString(),
    };

    await persistCarrier(updatedCarrier);

    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");

    Alert.alert("Password Updated", "Your password was changed successfully.");
  }

  async function openUrl(url: string) {
    if (!url) return;

    if (Platform.OS === "web") {
      window.location.href = url;
      return;
    }

    await WebBrowser.openBrowserAsync(url);
  }

  async function manageSubscription() {
    const stripeCustomerId =
      carrier?.stripeCustomerId ||
      carrier?.customerId ||
      carrier?.freightStripeCustomerId;

    if (!stripeCustomerId) {
      Alert.alert(
        "Missing Stripe Customer",
        "No Stripe customer ID was found for this freight account."
      );
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/payments/create-customer-portal-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customerId: stripeCustomerId,
            returnUrl: "farm2home://freight/profile",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || data.error || !data.url) {
        Alert.alert(
          "Billing Error",
          data.error || "Unable to open subscription portal."
        );
        return;
      }

      await openUrl(data.url);
    } catch (error: any) {
      Alert.alert(
        "Billing Error",
        error?.message || "Unable to open subscription portal."
      );
    }
  }

  async function cancelSubscription() {
    const subscriptionId =
      carrier?.stripeSubscriptionId ||
      carrier?.subscriptionId ||
      carrier?.freightSubscriptionId;

    if (!subscriptionId) {
      Alert.alert(
        "No Subscription",
        "No active freight subscription ID was found."
      );
      return;
    }

    Alert.alert(
      "Cancel Subscription",
      "Are you sure you want to cancel your freight membership?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await fetch(
                `${API_BASE_URL}/payments/cancel-subscription`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    subscriptionId,
                    carrierId: carrier?.id,
                    role: "freight",
                  }),
                }
              );

              const data = await response.json();

              if (!response.ok || data.error) {
                Alert.alert("Stripe Error", data.error || "Unable to cancel.");
                return;
              }

              const updatedCarrier = {
                ...carrier,
                membershipStatus: "Canceled",
                subscriptionStatus: "canceled",
                accountActive: false,
                updatedAt: new Date().toISOString(),
              };

              await persistCarrier(updatedCarrier);

              Alert.alert("Canceled", "Freight subscription was canceled.");
            } catch (error: any) {
              Alert.alert(
                "Cancel Error",
                error?.message || "Unable to cancel subscription."
              );
            }
          },
        },
      ]
    );
  }

  async function logout() {
    await AsyncStorage.removeItem("currentFreightCarrier");
    await AsyncStorage.removeItem("currentUser");
    await AsyncStorage.removeItem("userRole");
    await AsyncStorage.removeItem("currentUserRole");

    router.replace("/freight/login" as never);
  }

  function membershipStatus() {
    return carrier?.membershipStatus || carrier?.subscriptionStatus || "Active";
  }

  function membershipColor() {
    const status = String(membershipStatus()).toLowerCase();

    if (status.includes("cancel")) return "#DC2626";
    if (status.includes("pending")) return "#F59E0B";
    if (status.includes("past_due") || status.includes("unpaid")) return "#DC2626";

    return "#10B981";
  }

  function carrierInitials() {
    const value = companyName || contactName || "Freight Carrier";
    const parts = value.split(" ").filter(Boolean);
    const first = parts[0]?.[0] || "F";
    const second = parts[1]?.[0] || "";
    return `${first}${second}`.toUpperCase();
  }

  function authorizedServices() {
    const services = [];

    if (carrier?.licensedLivestock) services.push("Livestock Transport");
    if (carrier?.licensedRefrigeratedFood) services.push("Refrigerated Fresh Food");

    return services.length > 0 ? services.join("\n") : "No services selected";
  }

  function SectionHeader({
    icon,
    title,
    subtitle,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle?: string;
  }) {
    return (
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={20} color="#FFFFFF" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
        </View>
      </View>
    );
  }

  if (!carrier) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#020617" />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <Text style={styles.kicker}>Farm2Home Freight Connect</Text>
            <Text style={styles.title}>Freight Carrier Profile</Text>
            <Text style={styles.subtitle}>No freight carrier profile found.</Text>
          </View>

          <TouchableOpacity
            style={styles.greenButton}
            onPress={() => router.replace("/freight/login" as never)}
          >
            <Text style={styles.buttonText}>Go to Freight Login</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{carrierInitials()}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.kicker}>Farm2Home Freight Connect</Text>
                <Text style={styles.title}>Freight Carrier Profile</Text>
                <Text style={styles.subtitle}>
                  Manage company details, carrier credentials, subscription, and
                  freight access.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.statusCard}>
            <View style={styles.statusTop}>
              <View>
                <Text style={styles.statusTitle}>Membership Status</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: membershipColor() },
                  ]}
                >
                  <Text style={styles.statusBadgeText}>{membershipStatus()}</Text>
                </View>
              </View>

              <Ionicons name="shield-checkmark-outline" size={34} color="#BBF7D0" />
            </View>

            <Text style={styles.statusSmall}>
              Freight subscription gives access to the freight board, available
              loads, and carrier tools.
            </Text>
          </View>

          <View style={styles.quickGrid}>
            <QuickNav
              icon="grid-outline"
              label="Dashboard"
              onPress={() => router.push("/freight/dashboard" as never)}
            />
            <QuickNav
              icon="list-outline"
              label="Board"
              onPress={() => router.push("/freight/board" as never)}
            />
            <QuickNav
              icon="map-outline"
              label="Tracking"
              onPress={() => router.push("/freight/live-route" as never)}
            />
            <QuickNav
              icon="cash-outline"
              label="Billing"
              onPress={manageSubscription}
            />
          </View>

          <View style={styles.card}>
            <SectionHeader
              icon="business-outline"
              title="Profile Information"
              subtitle="Company and primary contact information."
            />

            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Username"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Company Name</Text>
            <TextInput
              style={styles.input}
              value={companyName}
              onChangeText={setCompanyName}
              placeholder="Company name"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.label}>Contact Name</Text>
            <TextInput
              style={styles.input}
              value={contactName}
              onChangeText={setContactName}
              placeholder="Contact name"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
            />

            <TouchableOpacity style={styles.greenButtonInner} onPress={saveProfile}>
              <Ionicons name="save-outline" size={18} color="#FFFFFF" />
              <Text style={styles.buttonText}>Save Profile</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <SectionHeader
              icon="trail-sign-outline"
              title="Carrier Details"
              subtitle="DOT, MC, insurance, and authorized services."
            />

            <Text style={styles.label}>MDOT Number</Text>
            <TextInput
              style={styles.input}
              value={mdotNumber}
              onChangeText={setMdotNumber}
              placeholder="MDOT Number"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.label}>MC Number</Text>
            <TextInput
              style={styles.input}
              value={mcNumber}
              onChangeText={setMcNumber}
              placeholder="MC Number"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.label}>Insurance Provider</Text>
            <TextInput
              style={styles.input}
              value={insuranceProvider}
              onChangeText={setInsuranceProvider}
              placeholder="Insurance provider"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.label}>Policy Number</Text>
            <TextInput
              style={styles.input}
              value={insurancePolicyNumber}
              onChangeText={setInsurancePolicyNumber}
              placeholder="Policy number"
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.valueBox}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#10B981" />
              <View style={{ flex: 1 }}>
                <Text style={styles.valueLabel}>Authorized Services</Text>
                <Text style={styles.value}>{authorizedServices()}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.greenButtonInner} onPress={saveProfile}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.buttonText}>Save Carrier Details</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <SectionHeader
              icon="key-outline"
              title="Change Password"
              subtitle="Update your local freight account password."
            />

            <TextInput
              style={styles.input}
              placeholder="Current password"
              placeholderTextColor="#94A3B8"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
            />

            <TextInput
              style={styles.input}
              placeholder="New password"
              placeholderTextColor="#94A3B8"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />

            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              placeholderTextColor="#94A3B8"
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              secureTextEntry
            />

            <TouchableOpacity style={styles.blueButton} onPress={changePassword}>
              <Ionicons name="lock-closed-outline" size={18} color="#FFFFFF" />
              <Text style={styles.buttonText}>Change Password</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <SectionHeader
              icon="card-outline"
              title="Manage Subscription"
              subtitle="Manage billing, payment method, or cancellation."
            />

            <Text style={styles.helpText}>
              Manage your freight membership, update your card, review billing,
              or cancel your subscription.
            </Text>

            <TouchableOpacity style={styles.blueButton} onPress={manageSubscription}>
              <Ionicons name="open-outline" size={18} color="#FFFFFF" />
              <Text style={styles.buttonText}>Manage Freight Membership</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={cancelSubscription}>
              <Ionicons name="close-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.buttonText}>Cancel Freight Subscription</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.greenButton}
            onPress={() => router.push("/freight/board" as never)}
          >
            <Ionicons name="list-outline" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>Back to Freight Board</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.darkButton}
            onPress={() => router.push("/freight/dashboard" as never)}
          >
            <Ionicons name="grid-outline" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>Freight Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>Logout</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function QuickNav({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickCard} onPress={onPress}>
      <Ionicons name={icon} size={22} color="#10B981" />
      <Text style={styles.quickText}>{label}</Text>
    </TouchableOpacity>
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
  container: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  content: {
    paddingBottom: 90,
  },
  hero: {
    backgroundColor: "#020617",
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  heroTop: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  avatar: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "#064E3B",
    borderWidth: 1,
    borderColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },
  kicker: {
    color: "#10B981",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#FFFFFF",
    marginTop: 6,
  },
  subtitle: {
    color: "#CBD5E1",
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },
  statusCard: {
    backgroundColor: "#064E3B",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#10B981",
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 14,
  },
  statusTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusBadgeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
    textTransform: "capitalize",
  },
  statusSmall: {
    marginTop: 12,
    color: "#BBF7D0",
    fontWeight: "700",
    lineHeight: 20,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  quickCard: {
    width: "48%",
    backgroundColor: freightTheme.colors.card,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    alignItems: "center",
    gap: 8,
  },
  quickText: {
    color: freightTheme.colors.text,
    fontWeight: "900",
  },
  card: {
    backgroundColor: freightTheme.colors.card,
    padding: 18,
    borderRadius: 22,
    marginHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  sectionHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 14,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: freightTheme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: freightTheme.colors.text,
  },
  sectionSubtitle: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 3,
  },
  label: {
    color: freightTheme.colors.text,
    marginTop: 8,
    marginBottom: 6,
    fontWeight: "900",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    padding: 14,
    fontWeight: "700",
    marginBottom: 8,
    color: "#111827",
  },
  valueBox: {
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  valueLabel: {
    color: freightTheme.colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  value: {
    fontSize: 15,
    fontWeight: "800",
    color: freightTheme.colors.text,
    lineHeight: 22,
    marginTop: 3,
  },
  helpText: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 21,
    marginBottom: 12,
  },
  greenButtonInner: {
    backgroundColor: freightTheme.colors.primary,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  greenButton: {
    backgroundColor: freightTheme.colors.primary,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 18,
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  blueButton: {
    backgroundColor: "#2563EB",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  darkButton: {
    backgroundColor: "#111827",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 18,
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  cancelButton: {
    backgroundColor: "#DC2626",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  logoutButton: {
    backgroundColor: "#64748B",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 18,
    marginTop: 10,
    marginBottom: 40,
    flexDirection: "row",
    gap: 8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    textAlign: "center",
  },
});