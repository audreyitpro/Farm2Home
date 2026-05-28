import React, { useCallback, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import { router, useFocusEffect } from "expo-router";

import { API_BASE_URL } from "../config/api";

export default function DriverProfile() {
  const [driver, setDriver] = useState<any>(null);
  const [allDrivers, setAllDrivers] = useState<any[]>([]);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [vehicleType, setVehicleType] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [serviceArea, setServiceArea] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadDriver();
    }, [])
  );

  function normalize(value: any) {
    return String(value || "").trim().toLowerCase();
  }

  async function readArray(key: string) {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function loadDriver() {
    try {
      const raw =
        (await AsyncStorage.getItem("currentDriver")) ||
        (await AsyncStorage.getItem("currentUser"));

      const storageDrivers = [
        ...(await readArray("farm2homeDrivers")),
        ...(await readArray("drivers")),
        ...(await readArray("driverAccounts")),
      ];

      setAllDrivers(storageDrivers);

      if (!raw && storageDrivers.length === 0) {
        router.replace("/driver/login" as any);
        return;
      }

      const current = raw ? JSON.parse(raw) : storageDrivers[0];

      if (!current) {
        router.replace("/driver/login" as any);
        return;
      }

      const normalizedDriver = {
        ...current,
        id: current.id || current.driverId || current.email || `driver_${Date.now()}`,
        driverId:
          current.driverId || current.id || current.email || `driver_${Date.now()}`,
        role: "driver",
        accountActive: current.accountActive !== false,
        membershipStatus: current.membershipStatus || "Active",
        subscriptionStatus: current.subscriptionStatus || "active",
      };

      await persistDriver(normalizedDriver, storageDrivers);

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

  async function persistDriver(updatedDriver: any, baseDrivers?: any[]) {
    const normalizedDriver = {
      ...updatedDriver,
      id:
        updatedDriver.id ||
        updatedDriver.driverId ||
        updatedDriver.email ||
        `driver_${Date.now()}`,
      driverId:
        updatedDriver.driverId ||
        updatedDriver.id ||
        updatedDriver.email ||
        `driver_${Date.now()}`,
      role: "driver",
      username: normalize(updatedDriver.username),
      email: normalize(updatedDriver.email),
      accountActive: updatedDriver.accountActive !== false,
      updatedAt: new Date().toISOString(),
    };

    const existing = baseDrivers || allDrivers || [];

    const updatedDrivers = [
      normalizedDriver,
      ...existing.filter(
        (item) =>
          item.id !== normalizedDriver.id &&
          item.driverId !== normalizedDriver.driverId &&
          normalize(item.email) !== normalizedDriver.email &&
          normalize(item.username) !== normalizedDriver.username
      ),
    ];

    for (const key of ["farm2homeDrivers", "drivers", "driverAccounts"]) {
      await AsyncStorage.setItem(key, JSON.stringify(updatedDrivers));
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

    setDriver(normalizedDriver);
    setAllDrivers(updatedDrivers);
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
      updatedAt: new Date().toISOString(),
    };

    await persistDriver(updatedDriver);
    Alert.alert("Saved", "Driver profile updated.");
  }

  async function changePassword() {
    if (!driver) return;

    if (!currentPassword.trim()) {
      Alert.alert("Current Password Required", "Enter your current password.");
      return;
    }

    if (driver.password && currentPassword.trim() !== driver.password) {
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

    const updatedDriver = {
      ...driver,
      password: newPassword,
      updatedAt: new Date().toISOString(),
    };

    await persistDriver(updatedDriver);

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
      driver?.stripeCustomerId ||
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
      driver?.subscriptionId ||
      driver?.driverSubscriptionId;

    if (!subscriptionId) {
      Alert.alert(
        "No Subscription",
        "No active driver subscription ID was found."
      );
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

              const updatedDriver = {
                ...driver,
                membershipStatus: "Canceled",
                subscriptionStatus: "canceled",
                accountActive: false,
                updatedAt: new Date().toISOString(),
              };

              await persistDriver(updatedDriver);

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
    await AsyncStorage.removeItem("currentDriver");
    await AsyncStorage.removeItem("currentUser");
    await AsyncStorage.removeItem("userRole");
    await AsyncStorage.removeItem("currentUserRole");

    router.replace("/driver/login" as any);
  }

  if (!driver) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Driver Profile</Text>
        <Text style={styles.subheader}>No driver profile found.</Text>

        <TouchableOpacity
          style={styles.greenButton}
          onPress={() => router.replace("/driver/login" as any)}
        >
          <Text style={styles.buttonText}>Go to Driver Login</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Driver Profile</Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>Driver Board Membership</Text>
        <Text style={styles.statusValue}>
          {driver.membershipStatus || driver.subscriptionStatus || "Active"}
        </Text>
        <Text style={styles.statusSmall}>
          Driver board membership gives access to available local delivery orders.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Profile Information</Text>

        <Text style={styles.label}>Full Name</Text>
        <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />

        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Phone</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <TouchableOpacity style={styles.greenButton} onPress={saveProfile}>
          <Text style={styles.buttonText}>Save Profile</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Driver Details</Text>

        <Text style={styles.label}>Vehicle Type</Text>
        <TextInput style={styles.input} value={vehicleType} onChangeText={setVehicleType} />

        <Text style={styles.label}>License Number</Text>
        <TextInput style={styles.input} value={licenseNumber} onChangeText={setLicenseNumber} />

        <Text style={styles.label}>Service Area</Text>
        <TextInput style={styles.input} value={serviceArea} onChangeText={setServiceArea} />

        <Text style={styles.label}>Uploaded License</Text>
        <Text style={styles.documentText}>
          {driver.licenseDocument?.name ||
            driver.uploadedDocs?.driver_license?.name ||
            "Not uploaded"}
        </Text>

        <Text style={styles.label}>Uploaded Insurance</Text>
        <Text style={styles.documentText}>
          {driver.insuranceDocument?.name ||
            driver.uploadedDocs?.insurance?.name ||
            "Not uploaded"}
        </Text>

        <TouchableOpacity style={styles.greenButton} onPress={saveProfile}>
          <Text style={styles.buttonText}>Save Driver Details</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Change Password</Text>

        <TextInput
          style={styles.input}
          placeholder="Current password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
        />

        <TextInput
          style={styles.input}
          placeholder="New password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm new password"
          value={confirmNewPassword}
          onChangeText={setConfirmNewPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.blueButton} onPress={changePassword}>
          <Text style={styles.buttonText}>Change Password</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Manage Subscription</Text>

        <Text style={styles.helpText}>
          Manage your $4.99 driver board membership, update your payment method,
          review billing, or cancel your subscription.
        </Text>

        <TouchableOpacity style={styles.blueButton} onPress={manageSubscription}>
          <Text style={styles.buttonText}>Manage Driver Membership</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={cancelSubscription}>
          <Text style={styles.buttonText}>Cancel Driver Subscription</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.greenButton}
        onPress={() => router.push("/driver/mobile-driver-app" as any)}
      >
        <Text style={styles.buttonText}>Back to Driver Dashboard</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.darkButton}
        onPress={() => router.push("/driver/board" as any)}
      >
        <Text style={styles.buttonText}>View Driver Board</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F7F2" },
  content: { padding: 22, paddingBottom: 70 },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#1f7a3f",
    marginBottom: 8,
  },
  subheader: { color: "#666666", marginBottom: 20, fontWeight: "700" },
  statusCard: {
    backgroundColor: "#E8F5E9",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#B7DFB9",
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#14532D",
    marginBottom: 6,
  },
  statusValue: { fontSize: 18, fontWeight: "900", color: "#1f7a3f" },
  statusSmall: {
    marginTop: 8,
    color: "#14532D",
    fontWeight: "700",
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 12,
  },
  label: {
    color: "#374151",
    marginTop: 10,
    marginBottom: 6,
    fontWeight: "900",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 14,
    padding: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  documentText: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 12,
    color: "#111827",
    fontWeight: "800",
  },
  helpText: {
    color: "#4B5563",
    fontWeight: "700",
    lineHeight: 21,
    marginBottom: 12,
  },
  greenButton: {
    backgroundColor: "#1f7a3f",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 12,
  },
  blueButton: {
    backgroundColor: "#1565C0",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },
  darkButton: {
    backgroundColor: "#111827",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },
  cancelButton: {
    backgroundColor: "#D32F2F",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },
  logoutButton: {
    backgroundColor: "#6B7280",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 40,
  },
  buttonText: { color: "#FFFFFF", fontWeight: "900", textAlign: "center" },
});