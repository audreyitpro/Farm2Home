// app/driver/profile.tsx

import React, { useCallback, useMemo, useState } from "react";
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

import { getBackendUrl } from "../services/apiConfig";
import { supabase } from "../services/supabaseClient";

const COLORS = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  redDark: "#9F1117",
  white: "#FFFFFF",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  amber: "#D97706",
  blue: "#2563EB",
  slate: "#475569",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function money(value: number) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function DriverProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

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
  const [activeFreight, setActiveFreight] = useState(0);
  const [completedFreight, setCompletedFreight] = useState(0);
  const [weeklyEarnings, setWeeklyEarnings] = useState(0);
  const [lifetimeEarnings, setLifetimeEarnings] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadDriver();
    }, [])
  );

  const driverName = useMemo(() => {
    return driver?.fullName || driver?.name || fullName || "Farm2Home Driver";
  }, [driver, fullName]);

  const initials = useMemo(() => {
    const parts = String(driverName).split(" ").filter(Boolean);
    return `${parts[0]?.[0] || "D"}${parts[1]?.[0] || ""}`.toUpperCase();
  }, [driverName]);

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
        const result = await supabase
          .from("drivers")
          .select("*")
          .eq("id", authUserId)
          .maybeSingle();

        if (!result.error && result.data) dbDriver = result.data;
      }

      if (!dbDriver && authEmail) {
        const result = await supabase
          .from("drivers")
          .select("*")
          .eq("email", authEmail)
          .maybeSingle();

        if (!result.error && result.data) dbDriver = result.data;
      }

      if (dbDriver?.profile_id) {
        const result = await supabase
          .from("profiles")
          .select("*")
          .eq("id", dbDriver.profile_id)
          .maybeSingle();

        if (!result.error && result.data) profile = result.data;
      }

      if (!profile && authUserId) {
        const result = await supabase
          .from("profiles")
          .select("*")
          .eq("auth_user_id", authUserId)
          .eq("role", "driver")
          .maybeSingle();

        if (!result.error && result.data) profile = result.data;
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
          dbDriver?.service_radius_miles || stored?.serviceRadiusMiles || 50,
        availableNow: dbDriver?.available_now ?? stored?.availableNow ?? true,
        farm2DriverEligible:
          dbDriver?.farm2driver_eligible ?? stored?.farm2DriverEligible ?? true,
        freightEligible: dbDriver?.freight_eligible ?? stored?.freightEligible ?? true,
        notificationsEnabled:
          dbDriver?.notifications_enabled ?? stored?.notificationsEnabled ?? true,
        licenseDocument: dbDriver?.license_document || stored?.licenseDocument || null,
        insuranceDocument: dbDriver?.insurance_document || stored?.insuranceDocument || null,
        uploadedDocs: dbDriver?.uploaded_docs || stored?.uploadedDocs || {},
        backgroundCheckStatus:
          dbDriver?.background_check_status || stored?.backgroundCheckStatus || "Pending",
        insuranceStatus: dbDriver?.insurance_status || stored?.insuranceStatus || "Pending",
        documentsStatus:
          dbDriver?.documents_status || stored?.documentsStatus || stored?.documentStatus || "Pending",
        accountActive:
          dbDriver?.account_active ?? profile?.account_active ?? stored?.accountActive ?? true,
        membershipStatus:
          dbDriver?.membership_status || stored?.membershipStatus || "Active",
        subscriptionStatus:
          dbDriver?.subscription_status || stored?.subscriptionStatus || "active",
        stripeCustomerId: dbDriver?.stripe_customer_id || stored?.stripeCustomerId || "",
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

      const deliveries = Array.isArray(deliveryRows) ? deliveryRows : [];
      const freight = Array.isArray(freightRows) ? freightRows : [];

      const activeStatuses = [
        "accepted",
        "assigned",
        "arrived_pickup",
        "picked_up",
        "pickup_confirmed",
        "in_transit",
        "out_for_delivery",
        "arrived_dropoff",
      ];

      const completedStatuses = ["delivered", "completed"];

      setActiveDeliveries(
        deliveries.filter((item) => activeStatuses.includes(normalize(item.status))).length
      );

      setCompletedDeliveries(
        deliveries.filter((item) => completedStatuses.includes(normalize(item.status))).length
      );

      setActiveFreight(
        freight.filter((item) => activeStatuses.includes(normalize(item.status))).length
      );

      setCompletedFreight(
        freight.filter((item) => completedStatuses.includes(normalize(item.status))).length
      );

      const allCompleted = [...deliveries, ...freight].filter((item) =>
        completedStatuses.includes(normalize(item.status))
      );

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);

      const total = allCompleted.reduce((sum, item) => {
        return (
          sum +
          Number(
            item.driver_payout ||
              item.payout_amount ||
              item.payout ||
              item.delivery_fee ||
              item.freight_total ||
              item.total_due ||
              0
          ) +
          Number(item.tip || 0)
        );
      }, 0);

      const weekly = allCompleted
        .filter((item) => {
          const date = item.completed_at || item.delivered_at || item.updated_at || item.created_at;
          return date ? new Date(date) >= weekStart : false;
        })
        .reduce((sum, item) => {
          return (
            sum +
            Number(
              item.driver_payout ||
                item.payout_amount ||
                item.payout ||
                item.delivery_fee ||
                item.freight_total ||
                item.total_due ||
                0
            ) +
            Number(item.tip || 0)
          );
        }, 0);

      setLifetimeEarnings(total);
      setWeeklyEarnings(weekly);
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
    if (!driver) return Alert.alert("No Driver", "No driver profile was found.");
    if (!fullName.trim()) return Alert.alert("Name Required", "Please enter your full name.");
    if (!username.trim()) return Alert.alert("Username Required", "Please enter your username.");

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
    if (!newPassword.trim()) return Alert.alert("New Password Required", "Enter your new password.");
    if (newPassword.length < 6) return Alert.alert("Password Too Short", "Password must be at least 6 characters.");
    if (newPassword !== confirmNewPassword) return Alert.alert("Password Mismatch", "New passwords do not match.");

    try {
      setPasswordSaving(true);

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setNewPassword("");
      setConfirmNewPassword("");
      Alert.alert("Password Updated", "Your password was changed successfully.");
    } catch (error: any) {
      Alert.alert("Password Error", error?.message || "Unable to change password.");
    } finally {
      setPasswordSaving(false);
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
      Alert.alert("Missing Stripe Customer", "No Stripe customer ID was found for this driver account.");
      return;
    }

    try {
      setBillingLoading(true);

      const response = await fetch(`${getBackendUrl()}/payments/create-customer-portal-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: stripeCustomerId,
          role: "driver",
          driverId: driver?.id,
          returnUrl: Platform.OS === "web" ? window.location.href : "farm2home://driver/profile",
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error || !data.url) {
        Alert.alert("Billing Error", data.error || "Unable to open subscription portal.");
        return;
      }

      await openUrl(data.url);
    } catch (error: any) {
      Alert.alert("Billing Error", error?.message || "Unable to open subscription portal.");
    } finally {
      setBillingLoading(false);
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
              setCancelLoading(true);

              const response = await fetch(`${getBackendUrl()}/payments/cancel-subscription`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  subscriptionId,
                  driverId: driver?.id,
                  role: "driver",
                }),
              });

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

              await persistDriver(
                {
                  ...driver,
                  membershipStatus: "Canceled",
                  subscriptionStatus: "canceled",
                  accountActive: false,
                },
                false
              );

              Alert.alert("Canceled", "Driver subscription was canceled.");
            } catch (error: any) {
              Alert.alert("Cancel Error", error?.message || "Unable to cancel subscription.");
            } finally {
              setCancelLoading(false);
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

    if (value.includes("cancel")) return COLORS.red;
    if (value.includes("pending")) return COLORS.amber;
    if (value.includes("past_due") || value.includes("unpaid")) return COLORS.red;
    return COLORS.green;
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
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.red} />
          <Text style={styles.centerText}>Loading driver profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!driver) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No driver profile found</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace("/driver/login" as any)}>
            <Text style={styles.primaryButtonText}>Go to Driver Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Farm2Driver Operations</Text>
              <Text style={styles.title}>{driverName}</Text>
              <Text style={styles.subtitle}>{email || driver?.email}</Text>

              <View style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: membershipColor() }]}>
                  <Text style={styles.badgeText}>
                    {driver.membershipStatus || driver.subscriptionStatus || "Active"}
                  </Text>
                </View>

                <View style={[styles.badge, { backgroundColor: farm2DriverEligible ? COLORS.green : COLORS.amber }]}>
                  <Text style={styles.badgeText}>
                    {farm2DriverEligible ? "Local Eligible" : "Local Review"}
                  </Text>
                </View>

                <View style={[styles.badge, { backgroundColor: freightEligible ? COLORS.black : COLORS.slate }]}>
                  <Text style={styles.badgeText}>
                    {freightEligible ? "Freight Ready" : "Freight Pending"}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <StatCard label="Weekly" value={money(weeklyEarnings)} />
            <StatCard label="Lifetime" value={money(lifetimeEarnings)} />
            <StatCard label="Active" value={activeDeliveries + activeFreight} />
            <StatCard label="Completed" value={completedDeliveries + completedFreight} />
          </View>

          <View style={styles.quickGrid}>
            <QuickNav label="Driver Hub" onPress={() => router.push("/driver/mobile-driver-app" as any)} />
            <QuickNav label="Driver Board" onPress={() => router.push("/driver/board" as any)} />
            <QuickNav label="My Deliveries" onPress={() => router.push("/driver/my-deliveries" as any)} />
            <QuickNav label="Earnings" onPress={() => router.push("/driver/earnings" as any)} />
          </View>

          <Card title="Profile Information" subtitle="Driver contact and account details.">
            <Label text="Full Name" />
            <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Full Name" placeholderTextColor="#9CA3AF" />

            <Label text="Username" />
            <TextInput style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="Username" placeholderTextColor="#9CA3AF" />

            <Label text="Email" />
            <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email" placeholderTextColor="#9CA3AF" />

            <Label text="Phone" />
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Phone" placeholderTextColor="#9CA3AF" />
          </Card>

          <Card title="Vehicle Card" subtitle="Manage delivery vehicle, license, area, and driver availability.">
            <View style={styles.vehicleCard}>
              <Text style={styles.vehicleTitle}>{vehicleType || "Vehicle not added"}</Text>
              <Text style={styles.vehicleSub}>License: {licenseNumber || "Not added"}</Text>
              <Text style={styles.vehicleSub}>Service Area: {serviceArea || "Not added"}</Text>
              <Text style={styles.vehicleSub}>Radius: {serviceRadiusMiles || "50"} miles</Text>
            </View>

            <Label text="Vehicle Type" />
            <TextInput style={styles.input} value={vehicleType} onChangeText={setVehicleType} placeholder="Cargo van, pickup truck, car..." placeholderTextColor="#9CA3AF" />

            <Label text="License Number" />
            <TextInput style={styles.input} value={licenseNumber} onChangeText={setLicenseNumber} placeholder="License Number" placeholderTextColor="#9CA3AF" />

            <Label text="Service Area" />
            <TextInput style={styles.input} value={serviceArea} onChangeText={setServiceArea} placeholder="Detroit Metro, Macomb County..." placeholderTextColor="#9CA3AF" />

            <Label text="Service Radius Miles" />
            <TextInput style={styles.input} value={serviceRadiusMiles} onChangeText={setServiceRadiusMiles} keyboardType="numeric" placeholder="50" placeholderTextColor="#9CA3AF" />

            <SwitchRow title="Available Now" value={availableNow} onValueChange={setAvailableNow} />
            <SwitchRow title="Farm2Driver Local Eligible" value={farm2DriverEligible} onValueChange={setFarm2DriverEligible} />
            <SwitchRow title="Freight Load Eligible" value={freightEligible} onValueChange={setFreightEligible} />
            <SwitchRow title="Notifications Enabled" value={notificationsEnabled} onValueChange={setNotificationsEnabled} />

            <TouchableOpacity style={[styles.primaryButton, saving && styles.disabledButton]} onPress={saveProfile} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Save Driver Profile</Text>}
            </TouchableOpacity>
          </Card>

          <Card title="Compliance" subtitle="Driver documents, insurance, and background check status.">
            <DocumentRow label="Driver License" value={documentName("license")} />
            <DocumentRow label="Insurance" value={documentName("insurance")} />
            <DocumentRow label="Document Status" value={driver.documentsStatus || "Pending"} />
            <DocumentRow label="Background Check" value={driver.backgroundCheckStatus || "Pending"} />
            <DocumentRow label="Insurance Status" value={driver.insuranceStatus || "Pending"} />
          </Card>

          <Card title="Billing" subtitle="Manage your Farm2Driver membership and Stripe billing.">
            <StatusLine label="Membership" value={driver.membershipStatus || driver.subscriptionStatus || "Active"} />
            <StatusLine label="Stripe Customer" value={driver.stripeCustomerId ? "Connected" : "Missing"} />

            <TouchableOpacity style={styles.secondaryButton} onPress={manageSubscription} disabled={billingLoading}>
              {billingLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.secondaryButtonText}>Manage Driver Membership</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={cancelSubscription} disabled={cancelLoading}>
              {cancelLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.cancelButtonText}>Cancel Driver Subscription</Text>}
            </TouchableOpacity>
          </Card>

          <Card title="Password" subtitle="Update your secure driver login password.">
            <TextInput style={styles.input} placeholder="New password" placeholderTextColor="#9CA3AF" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
            <TextInput style={styles.input} placeholder="Confirm new password" placeholderTextColor="#9CA3AF" value={confirmNewPassword} onChangeText={setConfirmNewPassword} secureTextEntry />

            <TouchableOpacity style={styles.secondaryButton} onPress={changePassword} disabled={passwordSaving}>
              {passwordSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.secondaryButtonText}>Change Password</Text>}
            </TouchableOpacity>
          </Card>

          <Card title="Communication Shortcuts" subtitle="Open delivery communication and live operations screens.">
            <RouteButton title="Chat Center" onPress={() => router.push("/chat-center" as any)} />
            <RouteButton title="Customer Chat" onPress={() => router.push("/driver/customer-chat" as any)} />
            <RouteButton title="Farmer Chat" onPress={() => router.push("/driver/farmer-chat" as any)} />
            <RouteButton title="Notifications" onPress={() => router.push("/driver/notifications" as any)} />
            <RouteButton title="Live Location" onPress={() => router.push("/driver/live-location-provider" as any)} />
          </Card>

          <TouchableOpacity style={styles.darkButton} onPress={() => router.push("/driver/mobile-driver-app" as any)}>
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

function Card({ title, subtitle, children }: any) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      {children}
    </View>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
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

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statusLine}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusValue}>{value}</Text>
    </View>
  );
}

function SwitchRow({ title, value, onValueChange }: any) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchTitle}>{title}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#CBD5E1", true: COLORS.red }}
        thumbColor="#FFFFFF"
      />
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
  safe: { flex: 1, backgroundColor: COLORS.bg },
  keyboard: { flex: 1 },
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 90 },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  centerText: {
    color: COLORS.muted,
    marginTop: 10,
    fontWeight: "800",
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 12,
  },
  hero: {
    backgroundColor: COLORS.black,
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 28,
    flexDirection: "row",
    gap: 15,
    alignItems: "center",
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 24,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#FFFFFF", fontSize: 23, fontWeight: "900" },
  eyebrow: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 27,
    fontWeight: "900",
    color: "#FFFFFF",
    marginTop: 5,
  },
  subtitle: {
    color: "#D1D5DB",
    fontWeight: "700",
    marginTop: 5,
    fontSize: 13,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 11,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginTop: 16,
    marginBottom: 12,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: "47%",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 15,
  },
  statValue: {
    color: COLORS.black,
    fontWeight: "900",
    fontSize: 20,
  },
  statLabel: {
    color: COLORS.muted,
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
    backgroundColor: COLORS.black,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
  },
  quickText: { color: "#FFFFFF", fontWeight: "900" },
  card: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 20,
    marginHorizontal: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: COLORS.text,
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 12,
    fontSize: 13,
  },
  label: {
    color: COLORS.text,
    marginTop: 8,
    marginBottom: 6,
    fontWeight: "900",
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    fontWeight: "700",
    marginBottom: 8,
    color: COLORS.text,
  },
  vehicleCard: {
    backgroundColor: "#FFF1F2",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FDA4AF",
    marginBottom: 12,
  },
  vehicleTitle: {
    color: COLORS.redDark,
    fontWeight: "900",
    fontSize: 17,
  },
  vehicleSub: {
    color: COLORS.text,
    fontWeight: "700",
    marginTop: 4,
  },
  switchRow: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  switchTitle: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "900",
  },
  documentRow: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
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
  documentDotGood: { backgroundColor: COLORS.green },
  documentLabel: {
    color: COLORS.red,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  documentText: {
    color: COLORS.text,
    fontWeight: "800",
    marginTop: 3,
  },
  statusLine: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  statusLabel: {
    color: COLORS.text,
    fontWeight: "900",
  },
  statusValue: {
    color: COLORS.red,
    fontWeight: "900",
  },
  primaryButton: {
    backgroundColor: COLORS.red,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  secondaryButton: {
    backgroundColor: COLORS.black,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  secondaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  cancelButton: {
    backgroundColor: COLORS.red,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  cancelButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  routeButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  routeButtonText: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "900",
  },
  routeArrow: {
    color: COLORS.red,
    fontSize: 24,
    fontWeight: "900",
  },
  darkButton: {
    backgroundColor: COLORS.black,
    padding: 15,
    borderRadius: 14,
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
    borderRadius: 14,
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