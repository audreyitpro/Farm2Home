// app/driver/profile.tsx

import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import { router, useFocusEffect } from "expo-router";

import { API_BASE_URL } from "../config/api";
import { supabase } from "../services/supabaseClient";
import freightTheme from "../styles/freightTheme";

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

export default function DriverProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [driver, setDriver] = useState<any>(null);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [vehicleType, setVehicleType] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [serviceRadiusMiles, setServiceRadiusMiles] = useState("50");

  const [availableNow, setAvailableNow] = useState(true);
  const [farm2DriverEligible, setFarm2DriverEligible] = useState(true);
  const [freightEligible, setFreightEligible] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [activeDeliveries, setActiveDeliveries] = useState(0);
  const [completedDeliveries, setCompletedDeliveries] = useState(0);
  const [estimatedEarnings, setEstimatedEarnings] = useState(0);

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
      setLoading(true);

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
        serviceRadiusMiles:
          dbDriver?.service_radius_miles ||
          stored?.serviceRadiusMiles ||
          50,

        availableNow:
          dbDriver?.available_now ??
          stored?.availableNow ??
          true,

        farm2DriverEligible:
          dbDriver?.farm2driver_eligible ??
          stored?.farm2DriverEligible ??
          true,

        freightEligible:
          dbDriver?.freight_eligible ??
          stored?.freightEligible ??
          true,

        notificationsEnabled:
          dbDriver?.notifications_enabled ??
          stored?.notificationsEnabled ??
          true,

        licenseDocument: dbDriver?.license_document || stored?.licenseDocument || null,
        insuranceDocument: dbDriver?.insurance_document || stored?.insuranceDocument || null,
        uploadedDocs: dbDriver?.uploaded_docs || stored?.uploadedDocs || {},

        backgroundCheckStatus:
          dbDriver?.background_check_status ||
          stored?.backgroundCheckStatus ||
          "Pending",

        insuranceStatus:
          dbDriver?.insurance_status ||
          stored?.insuranceStatus ||
          "Pending",

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
      setServiceRadiusMiles(String(normalizedDriver.serviceRadiusMiles || 50));
      setAvailableNow(Boolean(normalizedDriver.availableNow));
      setFarm2DriverEligible(Boolean(normalizedDriver.farm2DriverEligible));
      setFreightEligible(Boolean(normalizedDriver.freightEligible));
      setNotificationsEnabled(Boolean(normalizedDriver.notificationsEnabled));

      await loadDriverStats(stableId);
    } catch (error) {
      console.log("Load driver profile error:", error);
      Alert.alert("Profile Error", "Unable to load driver profile.");
      router.replace("/driver/login" as any);
    } finally {
      setLoading(false);
    }
  }

  async function loadDriverStats(id: string) {
    try {
      const { data: deliveryRows } = await supabase
        .from("delivery_orders")
        .select("*")
        .or(`driver_id.eq.${id},assigned_driver_id.eq.${id}`);

      const { data: freightRows } = await supabase
        .from("freight_loads")
        .select("*")
        .or(`driver_id.eq.${id},assigned_driver_id.eq.${id},carrier_id.eq.${id}`);

      const all = [
        ...(Array.isArray(deliveryRows) ? deliveryRows : []),
        ...(Array.isArray(freightRows) ? freightRows : []),
      ];

      const active = all.filter((item) =>
        ["accepted", "arrived_pickup", "picked_up", "in_transit", "arrived_dropoff"].includes(
          normalize(item.status)
        )
      );

      const completed = all.filter((item) =>
        ["delivered", "completed"].includes(normalize(item.status))
      );

      const earnings = completed.reduce((sum, item) => {
        return (
          sum +
          Number(
            item.payout_amount ||
              item.delivery_fee ||
              item.freight_total ||
              item.total_due ||
              0
          )
        );
      }, 0);

      setActiveDeliveries(active.length);
      setCompletedDeliveries(completed.length);
      setEstimatedEarnings(earnings);
    } catch (error) {
      console.log("Driver stats skipped:", error);
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
          service_radius_miles: Number(normalizedDriver.serviceRadiusMiles || 50),
          available_now: normalizedDriver.availableNow,
          farm2driver_eligible: normalizedDriver.farm2DriverEligible,
          freight_eligible: normalizedDriver.freightEligible,
          notifications_enabled: normalizedDriver.notificationsEnabled,
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
      setSaving(true);

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
        serviceRadiusMiles: Number(serviceRadiusMiles || 50),
        availableNow,
        farm2DriverEligible,
        freightEligible,
        notificationsEnabled,
      };

      await persistDriver(updatedDriver, true);
      Alert.alert("Saved", "Driver profile updated.");
    } catch (error: any) {
      Alert.alert("Save Error", error?.message || "Unable to save driver profile.");
    } finally {
      setSaving(false);
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

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#020617" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.centerText}>Loading driver profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!driver) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#020617" />
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No driver profile found</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace("/driver/login" as any)}
          >
            <Text style={styles.primaryButtonText}>Go to Driver Login</Text>
          </TouchableOpacity>
        </View>
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
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getDriverInitials()}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>Driver Operations</Text>
                <Text style={styles.title}>Driver Profile</Text>
                <Text style={styles.subtitle}>
                  Manage account, delivery eligibility, vehicle details, documents, and billing.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.statusCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>Driver Board Membership</Text>
              <View style={[styles.statusBadge, { backgroundColor: membershipColor() }]}>
                <Text style={styles.statusBadgeText}>
                  {driver.membershipStatus || driver.subscriptionStatus || "Active"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.statsRow}>
            <StatCard label="Active" value={activeDeliveries} />
            <StatCard label="Completed" value={completedDeliveries} />
            <StatCard label="Earnings" value={`$${estimatedEarnings.toFixed(0)}`} />
          </View>

          <View style={styles.quickGrid}>
            <QuickNav label="Driver Hub" onPress={() => router.push("/driver/mobile-driver-app" as any)} />
            <QuickNav label="Board" onPress={() => router.push("/driver/board" as any)} />
            <QuickNav label="Earnings" onPress={() => router.push("/driver/earnings" as any)} />
            <QuickNav label="My Deliveries" onPress={() => router.push("/driver/my-deliveries" as any)} />
          </View>

          <View style={styles.card}>
            <SectionHeader
              title="Profile Information"
              subtitle="Driver contact and account details."
            />

            <Label text="Full Name" />
            <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Full Name" placeholderTextColor="#94A3B8" />

            <Label text="Username" />
            <TextInput style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="Username" placeholderTextColor="#94A3B8" />

            <Label text="Email" />
            <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email" placeholderTextColor="#94A3B8" />

            <Label text="Phone" />
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Phone" placeholderTextColor="#94A3B8" />
          </View>

          <View style={styles.card}>
            <SectionHeader
              title="Vehicle and Service Area"
              subtitle="Manage delivery vehicle, radius, and eligibility."
            />

            <Label text="Vehicle Type" />
            <TextInput style={styles.input} value={vehicleType} onChangeText={setVehicleType} placeholder="Vehicle Type" placeholderTextColor="#94A3B8" />

            <Label text="License Number" />
            <TextInput style={styles.input} value={licenseNumber} onChangeText={setLicenseNumber} placeholder="License Number" placeholderTextColor="#94A3B8" />

            <Label text="Service Area" />
            <TextInput style={styles.input} value={serviceArea} onChangeText={setServiceArea} placeholder="Service Area" placeholderTextColor="#94A3B8" />

            <Label text="Service Radius Miles" />
            <TextInput style={styles.input} value={serviceRadiusMiles} onChangeText={setServiceRadiusMiles} keyboardType="numeric" placeholder="50" placeholderTextColor="#94A3B8" />

            <SwitchRow title="Available Now" value={availableNow} onValueChange={setAvailableNow} />
            <SwitchRow title="Farm2Driver Eligible" value={farm2DriverEligible} onValueChange={setFarm2DriverEligible} />
            <SwitchRow title="Freight Load Eligible" value={freightEligible} onValueChange={setFreightEligible} />
            <SwitchRow title="Notifications Enabled" value={notificationsEnabled} onValueChange={setNotificationsEnabled} />

            <TouchableOpacity
              style={[styles.primaryButton, saving && styles.disabledButton]}
              onPress={saveProfile}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Save Driver Profile</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <SectionHeader
              title="Compliance Documents"
              subtitle="License, insurance, and background check status."
            />

            <DocumentRow label="Driver License" value={documentName("license")} />
            <DocumentRow label="Insurance" value={documentName("insurance")} />
            <DocumentRow label="Background Check" value={driver.backgroundCheckStatus || "Pending"} />
            <DocumentRow label="Insurance Status" value={driver.insuranceStatus || "Pending"} />
          </View>

          <View style={styles.card}>
            <SectionHeader
              title="Password"
              subtitle="Update your secure login password."
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

            <TouchableOpacity style={styles.secondaryButton} onPress={changePassword}>
              <Text style={styles.secondaryButtonText}>Change Password</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <SectionHeader
              title="Billing"
              subtitle="Manage your driver board membership."
            />

            <Text style={styles.helpText}>
              Manage payment method, billing, and subscription status for driver board access.
            </Text>

            <TouchableOpacity style={styles.secondaryButton} onPress={manageSubscription}>
              <Text style={styles.secondaryButtonText}>Manage Driver Membership</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={cancelSubscription}>
              <Text style={styles.cancelButtonText}>Cancel Driver Subscription</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <SectionHeader
              title="Communication"
              subtitle="Open delivery communication screens."
            />

            <RouteButton title="Customer Chat" onPress={() => router.push("/driver/customer-chat" as any)} />
            <RouteButton title="Farmer Chat" onPress={() => router.push("/driver/farmer-chat" as any)} />
            <RouteButton title="Live Location" onPress={() => router.push("/driver/live-location-provider" as any)} />
          </View>

          <TouchableOpacity
            style={styles.darkButton}
            onPress={() => router.push("/driver/mobile-driver-app" as any)}
          >
            <Text style={styles.darkButtonText}>Back to Driver Hub</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickNav({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.quickCard} onPress={onPress}>
      <Text style={styles.quickText}>{label}</Text>
    </TouchableOpacity>
  );
}

function DocumentRow({ label, value }: { label: string; value: string }) {
  const good =
    value !== "Not uploaded" &&
    !normalize(value).includes("pending") &&
    !normalize(value).includes("expired");

  return (
    <View style={styles.documentRow}>
      <View style={[styles.documentDot, good && styles.documentDotGood]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.documentLabel}>{label}</Text>
        <Text style={styles.documentText}>{value}</Text>
      </View>
    </View>
  );
}

function SwitchRow({
  title,
  value,
  onValueChange,
}: {
  title: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchTitle}>{title}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

function RouteButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.routeButton} onPress={onPress}>
      <Text style={styles.routeButtonText}>{title}</Text>
      <Text style={styles.routeArrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: freightTheme.colors.background },
  keyboard: { flex: 1, backgroundColor: freightTheme.colors.background },
  container: { flex: 1, backgroundColor: freightTheme.colors.background },
  content: { paddingBottom: 90 },
  center: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  centerText: {
    color: freightTheme.colors.mutedText,
    marginTop: 10,
    fontWeight: "800",
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 12,
  },
  header: {
    backgroundColor: "#020617",
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 26,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  headerTop: { flexDirection: "row", gap: 14, alignItems: "center" },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "#064E3B",
    borderWidth: 1,
    borderColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#FFFFFF", fontSize: 20, fontWeight: "900" },
  eyebrow: {
    color: "#10B981",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FFFFFF",
    marginTop: 6,
  },
  subtitle: {
    color: "#CBD5E1",
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 7,
    fontSize: 13,
  },
  statusCard: {
    backgroundColor: "#064E3B",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#10B981",
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 12,
    flexDirection: "row",
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBadgeText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    borderRadius: 14,
    padding: 13,
    alignItems: "center",
  },
  statValue: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
    fontSize: 20,
  },
  statLabel: {
    color: freightTheme.colors.mutedText,
    fontWeight: "800",
    marginTop: 4,
    fontSize: 12,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  quickCard: {
    width: "48%",
    backgroundColor: freightTheme.colors.card,
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    alignItems: "center",
  },
  quickText: { color: freightTheme.colors.text, fontWeight: "900" },
  card: {
    backgroundColor: freightTheme.colors.card,
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  sectionHeader: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: freightTheme.colors.text,
  },
  sectionSubtitle: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 3,
    fontSize: 13,
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
    borderRadius: 12,
    padding: 13,
    fontWeight: "700",
    marginBottom: 8,
    color: "#111827",
  },
  switchRow: {
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    padding: 12,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  switchTitle: {
    flex: 1,
    color: freightTheme.colors.text,
    fontWeight: "900",
  },
  documentRow: {
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  documentDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: "#94A3B8",
  },
  documentDotGood: { backgroundColor: "#10B981" },
  documentLabel: {
    color: freightTheme.colors.primary,
    fontSize: 11,
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
  primaryButton: {
    backgroundColor: freightTheme.colors.primary,
    padding: 14,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  secondaryButton: {
    backgroundColor: "#2563EB",
    padding: 14,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  secondaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  cancelButton: {
    backgroundColor: "#DC2626",
    padding: 14,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  cancelButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  routeButton: {
    backgroundColor: freightTheme.colors.surface,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    borderRadius: 12,
    padding: 13,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  routeButtonText: {
    flex: 1,
    color: freightTheme.colors.text,
    fontWeight: "900",
  },
  routeArrow: {
    color: freightTheme.colors.primary,
    fontSize: 22,
    fontWeight: "900",
  },
  darkButton: {
    backgroundColor: "#111827",
    padding: 15,
    borderRadius: 13,
    alignItems: "center",
    marginHorizontal: 18,
    marginTop: 4,
  },
  darkButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  logoutButton: {
    backgroundColor: "#64748B",
    padding: 15,
    borderRadius: 13,
    alignItems: "center",
    marginHorizontal: 18,
    marginTop: 10,
    marginBottom: 40,
  },
  logoutButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.65,
  },
});