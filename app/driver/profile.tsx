// app/driver/profile.tsx

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
import { supabase } from "../services/supabaseClient";
import freightTheme from "../styles/freightTheme";

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

export default function DriverProfile() {
  const [driver, setDriver] = useState<any>(null);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [vehicleType, setVehicleType] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [serviceArea, setServiceArea] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadDriver();
    }, [])
  );

  async function getStoredDriver() {
    const raw =
      (await AsyncStorage.getItem("currentDriver")) ||
      (await AsyncStorage.getItem("farm2homeCurrentDriver")) ||
      (await AsyncStorage.getItem("farm2homeDriverSession")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function loadDriver() {
    try {
      const stored = await getStoredDriver();

      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;

      const authUserId =
        authUser?.id ||
        stored?.authUserId ||
        stored?.id ||
        stored?.driverId ||
        "";

      const authEmail = normalize(authUser?.email || stored?.email || "");

      if (!authUserId && !authEmail) {
        router.replace("/driver/login" as any);
        return;
      }

      let dbDriver: any = null;
      let profile: any = null;

      if (authUserId) {
        const driverResult = await supabase
          .from("drivers")
          .select("*")
          .eq("id", authUserId)
          .maybeSingle();

        if (!driverResult.error && driverResult.data) {
          dbDriver = driverResult.data;
        }
      }

      if (!dbDriver && authEmail) {
        const driverResult = await supabase
          .from("drivers")
          .select("*")
          .eq("email", authEmail)
          .maybeSingle();

        if (!driverResult.error && driverResult.data) {
          dbDriver = driverResult.data;
        }
      }

      if (dbDriver?.profile_id) {
        const profileResult = await supabase
          .from("profiles")
          .select("*")
          .eq("id", dbDriver.profile_id)
          .maybeSingle();

        if (!profileResult.error && profileResult.data) {
          profile = profileResult.data;
        }
      }

      if (!profile && authUserId) {
        const profileResult = await supabase
          .from("profiles")
          .select("*")
          .eq("auth_user_id", authUserId)
          .eq("role", "driver")
          .maybeSingle();

        if (!profileResult.error && profileResult.data) {
          profile = profileResult.data;
        }
      }

      const stableId =
        dbDriver?.id ||
        stored?.id ||
        stored?.driverId ||
        authUserId ||
        profile?.auth_user_id ||
        "";

      if (!stableId) {
        router.replace("/driver/login" as any);
        return;
      }

      const normalizedDriver = {
        ...(stored || {}),
        ...(dbDriver || {}),

        id: stableId,
        driverId: stableId,
        authUserId: dbDriver?.auth_user_id || profile?.auth_user_id || authUserId,
        profileId: dbDriver?.profile_id || stored?.profileId || profile?.id || "",
        profile_id: dbDriver?.profile_id || stored?.profile_id || profile?.id || "",
        role: "driver",

        fullName:
          dbDriver?.full_name ||
          dbDriver?.name ||
          profile?.full_name ||
          stored?.fullName ||
          stored?.name ||
          "Farm2Home Driver",

        name:
          dbDriver?.name ||
          dbDriver?.full_name ||
          profile?.full_name ||
          stored?.name ||
          stored?.fullName ||
          "Farm2Home Driver",

        username: dbDriver?.username || profile?.username || stored?.username || "",
        email: normalize(dbDriver?.email || profile?.email || stored?.email || authEmail),
        phone: dbDriver?.phone || profile?.phone || stored?.phone || "",

        vehicleType: dbDriver?.vehicle_type || stored?.vehicleType || "",
        licenseNumber: dbDriver?.license_number || stored?.licenseNumber || "",
        serviceArea: dbDriver?.service_area || stored?.serviceArea || "",

        licenseDocument: dbDriver?.license_document || stored?.licenseDocument || null,
        insuranceDocument: dbDriver?.insurance_document || stored?.insuranceDocument || null,
        uploadedDocs: dbDriver?.uploaded_docs || stored?.uploadedDocs || {},

        accountActive:
          dbDriver?.account_active ??
          profile?.account_active ??
          stored?.accountActive ??
          true,

        membershipStatus:
          dbDriver?.membership_status ||
          stored?.membershipStatus ||
          "Active",

        subscriptionStatus:
          dbDriver?.subscription_status ||
          stored?.subscriptionStatus ||
          "active",

        stripeCustomerId:
          dbDriver?.stripe_customer_id ||
          stored?.stripeCustomerId ||
          "",

        stripeSubscriptionId:
          dbDriver?.stripe_subscription_id ||
          stored?.stripeSubscriptionId ||
          stored?.subscriptionId ||
          "",

        updatedAt: new Date().toISOString(),
      };

      await persistDriver(normalizedDriver, false);

      setDriver(normalizedDriver);
      setFullName(normalizedDriver.fullName || normalizedDriver.name || "");
      setUsername(normalizedDriver.username || "");
      setEmail(normalizedDriver.email || "");
      setPhone(normalizedDriver.phone || "");
      setVehicleType(normalizedDriver.vehicleType || "");
      setLicenseNumber(normalizedDriver.licenseNumber || "");
      setServiceArea(normalizedDriver.serviceArea || "");
    } catch (error) {
      console.log("Load driver profile error:", error);
      Alert.alert("Profile Error", "Unable to load driver profile.");
      router.replace("/driver/login" as any);
    }
  }

  async function persistDriver(updatedDriver: any, saveToSupabase = true) {
    const now = new Date().toISOString();

    const normalizedDriver = {
      ...updatedDriver,
      id: updatedDriver.id || updatedDriver.driverId || updatedDriver.authUserId,
      driverId: updatedDriver.driverId || updatedDriver.id || updatedDriver.authUserId,
      role: "driver",
      username: normalize(updatedDriver.username),
      email: normalize(updatedDriver.email),
      accountActive: updatedDriver.accountActive !== false,
      updatedAt: now,
    };

    if (saveToSupabase && normalizedDriver.id) {
      const { error: driverError } = await supabase
        .from("drivers")
        .update({
          full_name: normalizedDriver.fullName || normalizedDriver.name,
          name: normalizedDriver.fullName || normalizedDriver.name,
          username: normalizedDriver.username,
          email: normalizedDriver.email,
          phone: normalizedDriver.phone,
          vehicle_type: normalizedDriver.vehicleType,
          license_number: normalizedDriver.licenseNumber,
          service_area: normalizedDriver.serviceArea,
          updated_at: now,
        })
        .eq("id", normalizedDriver.id);

      if (driverError) throw driverError;
    }

    const profileId = normalizedDriver.profile_id || normalizedDriver.profileId;

    if (saveToSupabase && profileId) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: normalizedDriver.fullName || normalizedDriver.name,
          name: normalizedDriver.fullName || normalizedDriver.name,
          username: normalizedDriver.username,
          email: normalizedDriver.email,
          phone: normalizedDriver.phone,
          updated_at: now,
        })
        .eq("id", profileId);

      if (profileError) throw profileError;
    }

    await AsyncStorage.setItem("currentDriver", JSON.stringify(normalizedDriver));
    await AsyncStorage.setItem("currentUser", JSON.stringify(normalizedDriver));
    await AsyncStorage.setItem("farm2homeCurrentDriver", JSON.stringify(normalizedDriver));
    await AsyncStorage.setItem("farm2homeDriverSession", JSON.stringify(normalizedDriver));
    await AsyncStorage.setItem("userRole", "driver");
    await AsyncStorage.setItem("currentUserRole", "driver");

    setDriver(normalizedDriver);
  }

  async function saveProfile() {
    if (!driver) {
      Alert.alert("No Driver", "No driver profile was found.");
      return;
    }

    if (!fullName.trim()) {
      Alert.alert("Name Required", "Please enter your full name.");
      return;
    }

    if (!username.trim()) {
      Alert.alert("Username Required", "Please enter your username.");
      return;
    }

    try {
      const updatedDriver = {
        ...driver,
        fullName: fullName.trim(),
        name: fullName.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        vehicleType: vehicleType.trim(),
        licenseNumber: licenseNumber.trim(),
        serviceArea: serviceArea.trim(),
      };

      await persistDriver(updatedDriver, true);
      Alert.alert("Saved", "Driver profile updated.");
    } catch (error: any) {
      Alert.alert("Save Error", error?.message || "Unable to save driver profile.");
    }
  }

  async function changePassword() {
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

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setNewPassword("");
      setConfirmNewPassword("");

      Alert.alert("Password Updated", "Your password was changed successfully.");
    } catch (error: any) {
      Alert.alert("Password Error", error?.message || "Unable to change password.");
    }
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
      driver?.stripeCustomerId ||
      driver?.stripe_customer_id ||
      driver?.customerId ||
      driver?.driverStripeCustomerId;

    if (!stripeCustomerId) {
      Alert.alert(
        "Missing Stripe Customer",
        "No Stripe customer ID was found for this driver account."
      );
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/payments/create-customer-portal-session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId: stripeCustomerId,
            returnUrl: "farm2home://driver/profile",
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
      driver?.stripeSubscriptionId ||
      driver?.stripe_subscription_id ||
      driver?.subscriptionId ||
      driver?.driverSubscriptionId;

    if (!subscriptionId) {
      Alert.alert("No Subscription", "No active driver subscription ID was found.");
      return;
    }

    Alert.alert(
      "Cancel Subscription",
      "Are you sure you want to cancel your driver board membership?",
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
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    subscriptionId,
                    driverId: driver?.id,
                    role: "driver",
                  }),
                }
              );

              const data = await response.json();

              if (!response.ok || data.error) {
                Alert.alert("Stripe Error", data.error || "Unable to cancel.");
                return;
              }

              await supabase
                .from("drivers")
                .update({
                  membership_status: "Canceled",
                  subscription_status: "canceled",
                  account_active: false,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", driver.id);

              const updatedDriver = {
                ...driver,
                membershipStatus: "Canceled",
                subscriptionStatus: "canceled",
                accountActive: false,
              };

              await persistDriver(updatedDriver, false);
              Alert.alert("Canceled", "Driver subscription was canceled.");
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
    await supabase.auth.signOut();

    await AsyncStorage.multiRemove([
      "currentDriver",
      "currentUser",
      "farm2homeCurrentDriver",
      "farm2homeDriverSession",
      "userRole",
      "currentUserRole",
    ]);

    router.replace("/driver/login" as any);
  }

  function membershipColor() {
    const value = normalize(driver?.membershipStatus || driver?.subscriptionStatus);

    if (value.includes("cancel")) return "#DC2626";
    if (value.includes("pending")) return "#F59E0B";
    if (value.includes("past_due") || value.includes("unpaid")) return "#DC2626";
    return "#10B981";
  }

  function getDriverName() {
    return driver?.fullName || driver?.name || driver?.username || "Farm2Home Driver";
  }

  function getDriverInitials() {
    const name = getDriverName();
    const parts = name.split(" ").filter(Boolean);
    const first = parts[0]?.[0] || "D";
    const second = parts[1]?.[0] || "";
    return `${first}${second}`.toUpperCase();
  }

  function documentName(type: "license" | "insurance") {
    if (type === "license") {
      return (
        driver?.licenseDocument?.name ||
        driver?.license_document?.name ||
        driver?.uploadedDocs?.driver_license?.name ||
        driver?.uploaded_docs?.driver_license?.name ||
        "Not uploaded"
      );
    }

    return (
      driver?.insuranceDocument?.name ||
      driver?.insurance_document?.name ||
      driver?.uploadedDocs?.insurance?.name ||
      driver?.uploaded_docs?.insurance?.name ||
      "Not uploaded"
    );
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

  if (!driver) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#020617" />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <Text style={styles.kicker}>Farm2Home Driver</Text>
            <Text style={styles.title}>Driver Profile</Text>
            <Text style={styles.subtitle}>No driver profile found.</Text>
          </View>

          <TouchableOpacity
            style={styles.greenButton}
            onPress={() => router.replace("/driver/login" as any)}
          >
            <Text style={styles.buttonText}>Go to Driver Login</Text>
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
                <Text style={styles.avatarText}>{getDriverInitials()}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.kicker}>Farm2Home Driver</Text>
                <Text style={styles.title}>Driver Profile</Text>
                <Text style={styles.subtitle}>
                  Manage your account, driver details, membership, and portal access.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.statusCard}>
            <View style={styles.statusTop}>
              <View>
                <Text style={styles.statusTitle}>Driver Board Membership</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: membershipColor() },
                  ]}
                >
                  <Text style={styles.statusBadgeText}>
                    {driver.membershipStatus || driver.subscriptionStatus || "Active"}
                  </Text>
                </View>
              </View>

              <Ionicons name="shield-checkmark-outline" size={34} color="#BBF7D0" />
            </View>

            <Text style={styles.statusSmall}>
              Driver board membership gives access to available local delivery orders.
            </Text>
          </View>

          <View style={styles.quickGrid}>
            <QuickNav icon="phone-portrait-outline" label="Driver App" onPress={() => router.push("/driver/mobile-driver-app" as any)} />
            <QuickNav icon="list-outline" label="Board" onPress={() => router.push("/driver/board" as any)} />
            <QuickNav icon="wallet-outline" label="Earnings" onPress={() => router.push("/driver/earnings" as any)} />
            <QuickNav icon="radio-outline" label="Live GPS" onPress={() => router.push("/driver/live-location-provider" as any)} />
          </View>

          <View style={styles.card}>
            <SectionHeader
              icon="person-outline"
              title="Profile Information"
              subtitle="Update your driver contact information."
            />

            <Text style={styles.label}>Full Name</Text>
            <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Full Name" placeholderTextColor="#94A3B8" />

            <Text style={styles.label}>Username</Text>
            <TextInput style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="Username" placeholderTextColor="#94A3B8" />

            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email" placeholderTextColor="#94A3B8" />

            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Phone" placeholderTextColor="#94A3B8" />

            <TouchableOpacity style={styles.greenButtonNoMargin} onPress={saveProfile}>
              <Ionicons name="save-outline" size={18} color="#FFFFFF" />
              <Text style={styles.buttonText}>Save Profile</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <SectionHeader
              icon="car-outline"
              title="Driver Details"
              subtitle="Vehicle, license, service area, and uploaded documents."
            />

            <Text style={styles.label}>Vehicle Type</Text>
            <TextInput style={styles.input} value={vehicleType} onChangeText={setVehicleType} placeholder="Vehicle Type" placeholderTextColor="#94A3B8" />

            <Text style={styles.label}>License Number</Text>
            <TextInput style={styles.input} value={licenseNumber} onChangeText={setLicenseNumber} placeholder="License Number" placeholderTextColor="#94A3B8" />

            <Text style={styles.label}>Service Area</Text>
            <TextInput style={styles.input} value={serviceArea} onChangeText={setServiceArea} placeholder="Service Area" placeholderTextColor="#94A3B8" />

            <DocumentRow icon="card-outline" label="Uploaded License" value={documentName("license")} />
            <DocumentRow icon="document-text-outline" label="Uploaded Insurance" value={documentName("insurance")} />

            <TouchableOpacity style={styles.greenButtonNoMargin} onPress={saveProfile}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.buttonText}>Save Driver Details</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <SectionHeader
              icon="key-outline"
              title="Change Password"
              subtitle="Update your secure Supabase Auth password."
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
              subtitle="Manage your $4.99 driver board membership."
            />

            <Text style={styles.helpText}>
              Manage your driver board membership, update your payment method,
              review billing, or cancel your subscription.
            </Text>

            <TouchableOpacity style={styles.blueButton} onPress={manageSubscription}>
              <Ionicons name="open-outline" size={18} color="#FFFFFF" />
              <Text style={styles.buttonText}>Manage Driver Membership</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={cancelSubscription}>
              <Ionicons name="close-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.buttonText}>Cancel Driver Subscription</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.greenButton}
            onPress={() => router.push("/driver/mobile-driver-app" as any)}
          >
            <Ionicons name="phone-portrait-outline" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>Back to Driver Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.darkButton}
            onPress={() => router.push("/driver/board" as any)}
          >
            <Ionicons name="list-outline" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>View Driver Board</Text>
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

function DocumentRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const uploaded = value !== "Not uploaded";

  return (
    <View style={styles.documentRow}>
      <Ionicons
        name={uploaded ? "checkmark-circle" : icon}
        size={20}
        color={uploaded ? "#10B981" : "#94A3B8"}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.documentLabel}>{label}</Text>
        <Text style={styles.documentText}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: freightTheme.colors.background },
  keyboard: { flex: 1, backgroundColor: freightTheme.colors.background },
  container: { flex: 1, backgroundColor: freightTheme.colors.background },
  content: { paddingBottom: 90 },
  hero: {
    backgroundColor: "#020617",
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  heroTop: { flexDirection: "row", gap: 14, alignItems: "center" },
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
  avatarText: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
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
  statusBadgeText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },
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
  quickText: { color: freightTheme.colors.text, fontWeight: "900" },
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
  documentRow: {
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  documentLabel: {
    color: freightTheme.colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  documentText: {
    color: freightTheme.colors.text,
    fontWeight: "800",
    marginTop: 3,
  },
  helpText: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 21,
    marginBottom: 12,
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
  greenButtonNoMargin: {
    backgroundColor: freightTheme.colors.primary,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
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