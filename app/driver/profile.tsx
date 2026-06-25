// app/driver/profile.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  RefreshControl,
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
import { Ionicons } from "@expo/vector-icons";

import { getBackendUrl } from "../services/apiConfig";
import { supabase } from "../services/supabaseClient";

const COLORS = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  surface: "#F8FAFC",
  surface2: "#F1F5F9",
  primary: "#635BFF",
  primaryDark: "#4F46E5",
  primarySoft: "#EEF2FF",
  accent: "#10B981",
  accentDark: "#047857",
  accentSoft: "#D1FAE5",
  warning: "#F59E0B",
  warningSoft: "#FEF3C7",
  danger: "#EF4444",
  dangerSoft: "#FEE2E2",
  navy: "#020617",
  navyCard: "#111827",
  text: "#101828",
  muted: "#667085",
  border: "#E5E7EB",
  white: "#FFFFFF",
};

const TABS = [
  { key: "overview", label: "Overview", icon: "person-outline" },
  { key: "compliance", label: "Compliance", icon: "shield-checkmark-outline" },
  { key: "stripe", label: "Stripe", icon: "card-outline" },
  { key: "account", label: "Account", icon: "settings-outline" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

type DriverProfile = {
  id: string;
  driver_id?: string | null;
  auth_user_id?: string | null;
  profile_id?: string | null;
  account_id?: string | null;
  role?: string | null;

  full_name?: string | null;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  email?: string | null;
  phone?: string | null;

  vehicle_type?: string | null;
  license_number?: string | null;
  service_area?: string | null;
  years_experience?: string | null;

  has_insurance?: boolean | null;
  has_valid_license?: boolean | null;
  has_vehicle_registration?: boolean | null;
  accepts_background_check?: boolean | null;
  documents_uploaded?: boolean | null;

  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_id?: string | null;
  stripe_account_id?: string | null;
  stripe_connect_status?: string | null;
  subscription_status?: string | null;
  membership_status?: string | null;
  driver_membership_paid?: boolean | null;

  payouts_enabled?: boolean | null;
  charges_enabled?: boolean | null;
  stripe_payouts_enabled?: boolean | null;
  stripe_charges_enabled?: boolean | null;
  stripe_onboarding_complete?: boolean | null;

  account_active?: boolean | null;
  verified?: boolean | null;
  approved?: boolean | null;
  application_submitted?: boolean | null;
  admin_review_status?: string | null;
  verification_status?: string | null;
  compliance_status?: string | null;

  notifications_enabled?: boolean | null;
  expo_push_token?: string | null;

  created_at?: string | null;
  updated_at?: string | null;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalize(value: unknown) {
  return clean(value).toLowerCase();
}

function isStripeCustomerId(value: unknown) {
  return clean(value).startsWith("cus_");
}

function isStripeSubscriptionId(value: unknown) {
  return clean(value).startsWith("sub_");
}

function isStripeConnectAccountId(value: unknown) {
  return clean(value).startsWith("acct_");
}

function isDriverAccountId(value: unknown) {
  return /^Driver_\d{3,}$/i.test(clean(value));
}

function pickCustomer(...values: unknown[]) {
  return clean(values.find((value) => isStripeCustomerId(value)) || "");
}

function pickSubscription(...values: unknown[]) {
  return clean(values.find((value) => isStripeSubscriptionId(value)) || "");
}

function pickConnectAccount(...values: unknown[]) {
  return clean(values.find((value) => isStripeConnectAccountId(value)) || "");
}

function maskId(value: unknown, fallback = "Missing") {
  const id = clean(value);
  if (!id) return fallback;
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}...${id.slice(-6)}`;
}

function splitName(fullName: string) {
  const parts = clean(fullName).split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
  };
}

function titleCaseStatus(value: unknown) {
  return clean(value || "pending")
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function parseApiResponse(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { success: false, error: text || "Invalid backend response." };
  }
}

async function openUrl(url: string) {
  const finalUrl = clean(url);

  if (!finalUrl || !finalUrl.startsWith("http")) {
    Alert.alert("Open Link Error", "No valid URL was returned.");
    return;
  }

  if (Platform.OS === "web") {
    window.location.assign(finalUrl);
    return;
  }

  try {
    await WebBrowser.openBrowserAsync(finalUrl);
  } catch {
    await Linking.openURL(finalUrl);
  }
}

function getMissingColumn(error: any) {
  const message = String(error?.message || "");
  const match = message.match(/Could not find the '([^']+)' column/i);
  return match?.[1] || "";
}

async function safeUpdateById(table: string, id: string, payload: Record<string, any>) {
  let nextPayload = { ...payload };

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const { data, error } = await supabase
      .from(table)
      .update(nextPayload)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (!error) return data;

    const missing = getMissingColumn(error);
    if (missing && Object.prototype.hasOwnProperty.call(nextPayload, missing)) {
      delete nextPayload[missing];
      console.log(`${table}: removed missing column ${missing}`);
      continue;
    }

    throw error;
  }

  throw new Error(`Unable to update ${table}. Too many missing columns.`);
}

async function safeUpdateProfileByAuthId(authUserId: string, payload: Record<string, any>) {
  let nextPayload = { ...payload };

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const { data, error } = await supabase
      .from("profiles")
      .update(nextPayload)
      .eq("auth_user_id", authUserId)
      .select("*")
      .maybeSingle();

    if (!error) return data;

    const missing = getMissingColumn(error);
    if (missing && Object.prototype.hasOwnProperty.call(nextPayload, missing)) {
      delete nextPayload[missing];
      console.log(`profiles: removed missing column ${missing}`);
      continue;
    }

    throw error;
  }

  throw new Error("Unable to update profile. Too many missing columns.");
}

async function saveDriverSession(driver: DriverProfile) {
  const session = {
    ...driver,
    role: "driver",
    id: driver.id,
    driverId: driver.id,
    driver_id: driver.driver_id || driver.id,
    authUserId: driver.auth_user_id || driver.id,
    accountId: driver.account_id,
    fullName: driver.full_name || driver.name,
    name: driver.name || driver.full_name,
    membershipStatus: driver.membership_status,
    subscriptionStatus: driver.subscription_status,
    stripeCustomerId: driver.stripe_customer_id,
    stripeSubscriptionId: driver.stripe_subscription_id || driver.subscription_id,
    stripeAccountId: driver.stripe_account_id,
    accountActive: driver.account_active,
  };

  await AsyncStorage.multiSet([
    ["currentDriver", JSON.stringify(session)],
    ["currentUser", JSON.stringify(session)],
    ["farm2homeCurrentDriver", JSON.stringify(session)],
    ["farm2homeDriverSession", JSON.stringify(session)],
    ["userRole", "driver"],
    ["currentUserRole", "driver"],
    ["lastLoginRole", "driver"],
  ]);
}

export default function DriverProfileScreen() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncingStripe, setSyncingStripe] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);

  const [driver, setDriver] = useState<DriverProfile | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");

  const [vehicleType, setVehicleType] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");

  const [hasInsurance, setHasInsurance] = useState(false);
  const [hasValidLicense, setHasValidLicense] = useState(false);
  const [hasVehicleRegistration, setHasVehicleRegistration] = useState(false);
  const [acceptsBackgroundCheck, setAcceptsBackgroundCheck] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadDriverProfile();
    }, [])
  );

  const driverId = clean(driver?.id || driver?.driver_id);
  const accountId = clean(driver?.account_id);
  const stripeCustomerId = clean(driver?.stripe_customer_id);
  const stripeSubscriptionId = pickSubscription(driver?.stripe_subscription_id, driver?.subscription_id);
  const stripeAccountId = clean(driver?.stripe_account_id);

  const profileScore = useMemo(() => {
    const checks = [
      Boolean(driverId),
      isDriverAccountId(accountId),
      Boolean(fullName && email && phone),
      Boolean(vehicleType && licenseNumber && serviceArea),
      Boolean(hasInsurance && hasValidLicense && acceptsBackgroundCheck),
      isStripeCustomerId(stripeCustomerId),
      isStripeSubscriptionId(stripeSubscriptionId),
      isStripeConnectAccountId(stripeAccountId),
    ];

    return checks.filter(Boolean).length;
  }, [
    driverId,
    accountId,
    fullName,
    email,
    phone,
    vehicleType,
    licenseNumber,
    serviceArea,
    hasInsurance,
    hasValidLicense,
    acceptsBackgroundCheck,
    stripeCustomerId,
    stripeSubscriptionId,
    stripeAccountId,
  ]);

  const dashboardReady = useMemo(() => {
    return Boolean(
      driverId &&
        accountId &&
        fullName &&
        email &&
        isStripeCustomerId(stripeCustomerId) &&
        isStripeSubscriptionId(stripeSubscriptionId)
    );
  }, [driverId, accountId, fullName, email, stripeCustomerId, stripeSubscriptionId]);

  function hydrate(row: DriverProfile) {
    setDriver(row);
    setFullName(clean(row.full_name || row.name));
    setEmail(normalize(row.email));
    setPhone(clean(row.phone));
    setUsername(normalize(row.username));
    setVehicleType(clean(row.vehicle_type));
    setLicenseNumber(clean(row.license_number));
    setServiceArea(clean(row.service_area));
    setYearsExperience(clean(row.years_experience));
    setHasInsurance(Boolean(row.has_insurance));
    setHasValidLicense(Boolean(row.has_valid_license));
    setHasVehicleRegistration(Boolean(row.has_vehicle_registration));
    setAcceptsBackgroundCheck(Boolean(row.accepts_background_check));
    setNotificationsEnabled(row.notifications_enabled !== false);
  }

  async function findDriver() {
    const storedRaw =
      (await AsyncStorage.getItem("currentDriver")) ||
      (await AsyncStorage.getItem("farm2homeCurrentDriver")) ||
      (await AsyncStorage.getItem("farm2homeDriverSession")) ||
      (await AsyncStorage.getItem("currentUser"));

    let stored: any = null;
    if (storedRaw) {
      try {
        stored = JSON.parse(storedRaw);
      } catch {
        stored = null;
      }
    }

    if (stored?.role && stored.role !== "driver") return null;

    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;

    const authId = clean(authUser?.id || stored?.id || stored?.driverId || stored?.driver_id || stored?.authUserId);
    const authEmail = normalize(authUser?.email || stored?.email);

    let row: any = null;

    if (authId) {
      const result = await supabase.from("drivers").select("*").eq("id", authId).maybeSingle();
      if (!result.error && result.data) row = result.data;
    }

    if (!row && authEmail) {
      const result = await supabase.from("drivers").select("*").eq("email", authEmail).maybeSingle();
      if (!result.error && result.data) row = result.data;
    }

    if (!row && stored?.id) row = stored;

    if (!row?.id) return null;

    const finalDriver: DriverProfile = {
      ...stored,
      ...row,
      id: clean(row.id || stored?.id || authId),
      driver_id: clean(row.driver_id || row.id || stored?.driver_id || stored?.driverId || authId),
      auth_user_id: clean(row.auth_user_id || stored?.auth_user_id || authId),
      role: "driver",
      email: normalize(row.email || stored?.email || authEmail),
      full_name: clean(row.full_name || row.name || stored?.fullName || stored?.name || "Farm2Home Driver"),
      name: clean(row.name || row.full_name || stored?.name || stored?.fullName || "Farm2Home Driver"),
      account_id: clean(row.account_id || stored?.accountId || stored?.account_id),
      stripe_customer_id: pickCustomer(row.stripe_customer_id, stored?.stripe_customer_id, stored?.stripeCustomerId),
      stripe_subscription_id: pickSubscription(
        row.stripe_subscription_id,
        row.subscription_id,
        stored?.stripe_subscription_id,
        stored?.stripeSubscriptionId,
        stored?.subscription_id
      ),
      subscription_id: pickSubscription(row.subscription_id, row.stripe_subscription_id, stored?.subscription_id),
      stripe_account_id: pickConnectAccount(row.stripe_account_id, stored?.stripe_account_id, stored?.stripeAccountId),
      membership_status: row.membership_status || stored?.membershipStatus || "active",
      subscription_status: row.subscription_status || stored?.subscriptionStatus || "active",
      account_active: row.account_active ?? stored?.accountActive ?? true,
    };

    return finalDriver;
  }

  async function loadDriverProfile() {
    try {
      setLoading(true);
      const found = await findDriver();

      if (!found) {
        Alert.alert("Driver Login Required", "Please log in as a driver.");
        router.replace("/driver/login" as any);
        return;
      }

      hydrate(found);
      await saveDriverSession(found);
    } catch (error: any) {
      console.log("loadDriverProfile error:", error);
      Alert.alert("Profile Error", error?.message || "Unable to load driver profile.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshProfile() {
    setRefreshing(true);
    await loadDriverProfile();
    setRefreshing(false);
  }

  async function saveProfile() {
    if (!driver?.id || saving) return;

    if (!fullName.trim() || !email.trim()) {
      Alert.alert("Missing Profile", "Full name and email are required.");
      return;
    }

    try {
      setSaving(true);

      const now = new Date().toISOString();
      const { firstName, lastName } = splitName(fullName);

      const driverPayload: Record<string, any> = {
        full_name: fullName.trim(),
        name: fullName.trim(),
        first_name: firstName,
        last_name: lastName,
        email: normalize(email),
        phone: phone.trim(),
        username: normalize(username),
        vehicle_type: vehicleType.trim(),
        license_number: licenseNumber.trim(),
        service_area: serviceArea.trim(),
        years_experience: yearsExperience.trim(),
        has_insurance: hasInsurance,
        has_valid_license: hasValidLicense,
        has_vehicle_registration: hasVehicleRegistration,
        accepts_background_check: acceptsBackgroundCheck,
        notifications_enabled: notificationsEnabled,
        role: "driver",
        updated_at: now,
      };

      const updatedDriver = await safeUpdateById("drivers", driver.id, driverPayload);

      const profilePayload: Record<string, any> = {
  role: "driver",
  full_name: fullName.trim(),
  name: fullName.trim(),
  first_name: firstName,
  last_name: lastName,
  email: normalize(email),
  phone: phone.trim(),
  username: normalize(username),

  account_id: driver.account_id || "",
  driver_account: driver.account_id || "",

  stripe_account_id: driver.stripe_account_id || null,
  auth_user_id: driver.auth_user_id || driver.id,
};

      if (driver.auth_user_id || driver.id) {
        await safeUpdateProfileByAuthId(driver.auth_user_id || driver.id, profilePayload);
      }

      const finalDriver = {
        ...driver,
        ...(updatedDriver || {}),
        ...driverPayload,
      };

      hydrate(finalDriver);
      await saveDriverSession(finalDriver);

      Alert.alert("Saved", "Driver profile updated.");
    } catch (error: any) {
      console.log("saveProfile error:", error);
      Alert.alert("Save Error", error?.message || "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function retrieveStripeInfo() {
    if (!driver?.id || syncingStripe) return;

    try {
      setSyncingStripe(true);

      const response = await fetch(`${getBackendUrl()}/payments/sync-stripe-by-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "driver",
          userId: driver.id,
          driverId: driver.id,
          driver_id: driver.id,
          email: normalize(email || driver.email),
          driver_email: normalize(email || driver.email),
          name: fullName || driver.full_name || driver.name,
          username: normalize(username || driver.username),
        }),
      });

      const json = await parseApiResponse(response);

      if (!response.ok || !json.success) {
        Alert.alert("Stripe Sync", json.error || "No Stripe membership was found.");
        return;
      }

      const customerId = pickCustomer(json.stripeCustomerId, json.stripe_customer_id);
      const subscriptionId = pickSubscription(
        json.stripeSubscriptionId,
        json.stripe_subscription_id,
        json.subscriptionId,
        json.subscription_id
      );

      const subscriptionStatus = clean(json.subscriptionStatus || json.subscription_status || "active");

      const payload = {
        stripe_customer_id: customerId || driver.stripe_customer_id || null,
        stripe_subscription_id: subscriptionId || driver.stripe_subscription_id || null,
        subscription_id: subscriptionId || driver.subscription_id || null,
        subscription_status: subscriptionStatus,
        membership_status: subscriptionId ? "active" : driver.membership_status || "pending_payment",
        driver_membership_paid: Boolean(subscriptionId || driver.stripe_subscription_id),
        updated_at: new Date().toISOString(),
      };

      const updated = await safeUpdateById("drivers", driver.id, payload);

      const finalDriver = {
        ...driver,
        ...payload,
        ...(updated || {}),
      };

      hydrate(finalDriver);
      await saveDriverSession(finalDriver);

      Alert.alert("Stripe Synced", "Stripe membership information was refreshed.");
    } catch (error: any) {
      console.log("retrieveStripeInfo error:", error);
      Alert.alert("Stripe Error", error?.message || "Unable to retrieve Stripe info.");
    } finally {
      setSyncingStripe(false);
    }
  }

  async function connectStripePayouts() {
    if (!driver?.id || connectLoading) return;

    try {
      setConnectLoading(true);
      await saveProfile();

      const returnUrl = `${getReturnBaseUrl()}/driver/profile?connect=success&driverId=${encodeURIComponent(driver.id)}&email=${encodeURIComponent(normalize(email || driver.email))}`;
      const refreshUrl = `${getReturnBaseUrl()}/driver/profile?connect=refresh&driverId=${encodeURIComponent(driver.id)}&email=${encodeURIComponent(normalize(email || driver.email))}`;

      const response = await fetch(`${getBackendUrl()}/payments/create-connect-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "driver",
          userId: driver.id,
          driverId: driver.id,
          driver_id: driver.id,
          profileId: driver.profile_id || driver.id,
          authUserId: driver.auth_user_id || driver.id,
          accountId: driver.account_id,
          account_id: driver.account_id,
          email: normalize(email || driver.email),
          driver_email: normalize(email || driver.email),
          name: fullName || driver.full_name || driver.name,
          username: normalize(username || driver.username),
          stripeCustomerId: driver.stripe_customer_id,
          stripe_customer_id: driver.stripe_customer_id,
          stripeAccountId: driver.stripe_account_id,
          stripe_account_id: driver.stripe_account_id,
          returnUrl,
          return_url: returnUrl,
          refreshUrl,
          refresh_url: refreshUrl,
          metadata: {
            role: "driver",
            driver_id: driver.id,
            account_id: driver.account_id,
            driver_email: normalize(email || driver.email),
            email: normalize(email || driver.email),
          },
        }),
      });

      const data = await parseApiResponse(response);
      const connectUrl =
        data.url ||
        data.onboardingUrl ||
        data.onboarding_url ||
        data.accountLinkUrl ||
        data.account_link_url ||
        data.accountLink ||
        data.account_link ||
        "";

      if (!response.ok || !data.success || !connectUrl) {
        Alert.alert("Connect Error", data.error || data.message || "Stripe Connect URL was not returned.");
        return;
      }

      const connectAccount = pickConnectAccount(
        data.stripeAccountId,
        data.stripe_account_id,
        data.account,
        data.account_id,
        data.connectedAccountId,
        data.connected_account_id
      );

      if (connectAccount) {
        const payload = {
          stripe_account_id: connectAccount,
          stripe_connect_status: data.onboardingComplete ? "complete" : "started",
          payouts_enabled: Boolean(data.payoutsEnabled),
          charges_enabled: Boolean(data.chargesEnabled),
          stripe_payouts_enabled: Boolean(data.payoutsEnabled),
          stripe_charges_enabled: Boolean(data.chargesEnabled),
          stripe_onboarding_complete: Boolean(data.onboardingComplete),
          updated_at: new Date().toISOString(),
        };

        const updated = await safeUpdateById("drivers", driver.id, payload);

        if (driver.auth_user_id || driver.id) {
          await safeUpdateProfileByAuthId(driver.auth_user_id || driver.id, {
            stripe_account_id: connectAccount,
            account_id: driver.account_id || "",
            driver_account: driver.account_id || "",
          });
        }

        const finalDriver = {
          ...driver,
          ...payload,
          ...(updated || {}),
        };

        hydrate(finalDriver);
        await saveDriverSession(finalDriver);
      }

      await openUrl(connectUrl);
    } catch (error: any) {
      console.log("connectStripePayouts error:", error);
      Alert.alert("Connect Error", error?.message || "Unable to open Stripe Connect.");
    } finally {
      setConnectLoading(false);
    }
  }

  function getReturnBaseUrl() {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      return window.location.origin;
    }

    return "https://farm2home-production-e4bd.up.railway.app";
  }

  async function logout() {
    Alert.alert("Log Out", "Do you want to log out of the driver account?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.multiRemove([
            "currentDriver",
            "currentUser",
            "farm2homeCurrentDriver",
            "farm2homeDriverSession",
            "userRole",
            "currentUserRole",
          ]);
          await supabase.auth.signOut();
          router.replace("/driver/login" as any);
        },
      },
    ]);
  }

  function openDashboard() {
    if (!dashboardReady) {
      Alert.alert(
        "Profile Not Ready",
        "Save profile and Stripe membership before opening dashboard. Stripe Connect payouts can be completed from the Stripe tab."
      );
      setTab("stripe");
      return;
    }

    router.replace("/driver/mobile-driver-app" as any);
  }

  function renderTab() {
    if (tab === "overview") {
      return (
        <View style={styles.card}>
          <SectionHeader
            title="Driver Profile"
            subtitle="Update contact details and service information."
            icon="person-outline"
          />

          <Field label="Full Name" value={fullName} onChangeText={setFullName} placeholder="Full name" icon="person-outline" />
          <Field label="Email" value={email} onChangeText={(v) => setEmail(normalize(v))} placeholder="driver@email.com" icon="mail-outline" keyboardType="email-address" />
          <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="Phone number" icon="call-outline" keyboardType="phone-pad" />
          <Field label="Username" value={username} onChangeText={(v) => setUsername(normalize(v))} placeholder="Username" icon="at-outline" />

          <View style={styles.row2}>
            <Field label="Vehicle Type" value={vehicleType} onChangeText={setVehicleType} placeholder="Van, car, truck..." icon="car-outline" compact />
            <Field label="Years Experience" value={yearsExperience} onChangeText={setYearsExperience} placeholder="2" icon="speedometer-outline" compact />
          </View>

          <Field label="License Number" value={licenseNumber} onChangeText={setLicenseNumber} placeholder="License number" icon="id-card-outline" />
          <Field label="Service Area" value={serviceArea} onChangeText={setServiceArea} placeholder="Detroit Metro, MI..." icon="map-outline" />

          <PrimaryButton title="Save Profile" icon="save-outline" loading={saving} onPress={saveProfile} />
        </View>
      );
    }

    if (tab === "compliance") {
      return (
        <View style={styles.card}>
          <SectionHeader
            title="Compliance Checklist"
            subtitle="Keep driver requirements current before accepting routes."
            icon="shield-checkmark-outline"
          />

          <ToggleRow label="Active auto insurance" value={hasInsurance} onValueChange={setHasInsurance} />
          <ToggleRow label="Valid driver license" value={hasValidLicense} onValueChange={setHasValidLicense} />
          <ToggleRow label="Vehicle registration available" value={hasVehicleRegistration} onValueChange={setHasVehicleRegistration} />
          <ToggleRow label="Background check authorization" value={acceptsBackgroundCheck} onValueChange={setAcceptsBackgroundCheck} />

          <StatusPanel
            items={[
              {
                label: "Verification",
                value: titleCaseStatus(driver?.verification_status ?? "pending"),
                good:
                  normalize(driver?.verification_status ?? "").includes("submitted") ||
                  Boolean(driver?.verified),
              },
              {
                label: "Compliance",
                value: titleCaseStatus(driver?.compliance_status ?? "pending"),
                good:
                  normalize(driver?.compliance_status ?? "").includes("submitted") ||
                  Boolean(driver?.approved),
              },
              {
                label: "Admin Review",
                value: titleCaseStatus(driver?.admin_review_status ?? "pending"),
                good: ["submitted", "approved"].includes(
                  normalize(driver?.admin_review_status ?? "")
                ),
              },
              {
                label: "Documents",
                value: driver?.documents_uploaded ? "Uploaded" : "Review Needed",
                good: Boolean(driver?.documents_uploaded),
              },
            ]}
          />

          <PrimaryButton title="Save Compliance" icon="save-outline" loading={saving} onPress={saveProfile} />
        </View>
      );
    }

    if (tab === "stripe") {
      return (
        <View style={styles.card}>
          <SectionHeader
            title="Stripe & Payouts"
            subtitle="Membership and payout IDs are collected with driver role metadata."
            icon="card-outline"
          />

          <IdCard label="Driver ID" value={driverId || "Missing"} good={Boolean(driverId)} />
          <IdCard label="Account ID" value={accountId || "Missing"} good={isDriverAccountId(accountId)} />
          <IdCard label="Stripe Customer ID" value={stripeCustomerId || "Missing"} good={isStripeCustomerId(stripeCustomerId)} />
          <IdCard label="Subscription ID" value={stripeSubscriptionId || "Missing"} good={isStripeSubscriptionId(stripeSubscriptionId)} />
          <IdCard label="Stripe Account ID" value={stripeAccountId || "Connect payouts to capture acct_..."} good={isStripeConnectAccountId(stripeAccountId)} />

          <StatusPanel
            items={[
              {
                label: "Membership",
                value: titleCaseStatus(driver?.membership_status ?? "pending"),
                good: isStripeSubscriptionId(stripeSubscriptionId),
              },
              {
                label: "Subscription",
                value: titleCaseStatus(driver?.subscription_status ?? "pending"),
                good: isStripeSubscriptionId(stripeSubscriptionId),
              },
              {
                label: "Connect",
                value: titleCaseStatus(driver?.stripe_connect_status ?? "pending"),
                good: isStripeConnectAccountId(stripeAccountId),
              },
              {
                label: "Payouts",
                value:
                  driver?.payouts_enabled || driver?.stripe_payouts_enabled
                    ? "Enabled"
                    : "Pending",
                good: Boolean(driver?.payouts_enabled || driver?.stripe_payouts_enabled),
              },
            ]}
          />

          <PrimaryButton
            title="Retrieve Stripe Membership"
            icon="sync-outline"
            loading={syncingStripe}
            onPress={retrieveStripeInfo}
            secondary
          />

          <PrimaryButton
            title="Connect Stripe Payouts"
            icon="wallet-outline"
            loading={connectLoading}
            onPress={connectStripePayouts}
          />

          <PrimaryButton
            title="Open Driver Dashboard"
            icon="car-outline"
            loading={false}
            onPress={openDashboard}
            secondary
          />
        </View>
      );
    }

    return (
      <View style={styles.card}>
        <SectionHeader
          title="Account Settings"
          subtitle="Manage profile access and app preferences."
          icon="settings-outline"
        />

        <ToggleRow
          label="Notifications enabled"
          value={notificationsEnabled}
          onValueChange={setNotificationsEnabled}
        />

        <StatusPanel
          items={[
            {
              label: "Role",
              value: driver?.role || "driver",
              good: normalize(driver?.role || "driver") === "driver",
            },
            {
              label: "Account Active",
              value: driver?.account_active === false ? "Inactive" : "Active",
              good: driver?.account_active !== false,
            },
            {
              label: "Profile Score",
              value: `${profileScore}/8`,
              good: profileScore >= 6,
            },
            {
              label: "Dashboard Ready",
              value: dashboardReady ? "Ready" : "Needs Setup",
              good: dashboardReady,
            },
          ]}
        />

        <PrimaryButton title="Save Settings" icon="save-outline" loading={saving} onPress={saveProfile} />
        <PrimaryButton title="Back to Driver Home" icon="home-outline" loading={false} onPress={() => router.replace("/driver/mobile-driver-app" as any)} secondary />

        <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.9}>
          <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading && !driver) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.centeredText}>Loading driver profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshProfile} />}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.shell}>
            <View style={styles.sidebar}>
              <View style={styles.brandRow}>
                <View style={styles.brandIcon}>
                  <Ionicons name="car-outline" size={26} color={COLORS.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.brandTitle}>Driver Profile</Text>
                  <Text style={styles.brandSubtitle}>{accountId || "Farm2Home Driver"}</Text>
                </View>
              </View>

              <View style={styles.scoreCard}>
                <Text style={styles.scoreLabel}>Profile Completion</Text>
                <Text style={styles.scoreValue}>{profileScore}/8</Text>
                <Text style={styles.scoreHint}>
                  Contact, compliance, membership, and payout setup.
                </Text>
              </View>

              {TABS.map((item) => {
                const active = item.key === tab;

                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.tabButton, active && styles.tabButtonActive]}
                    onPress={() => setTab(item.key)}
                    activeOpacity={0.9}
                  >
                    <View style={[styles.tabIcon, active && styles.tabIconActive]}>
                      <Ionicons name={item.icon as any} size={18} color={active ? COLORS.white : COLORS.primary} />
                    </View>
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity style={styles.sideButton} onPress={() => router.replace("/driver/mobile-driver-app" as any)} activeOpacity={0.9}>
                <Ionicons name="home-outline" size={18} color={COLORS.primary} />
                <Text style={styles.sideButtonText}>Driver Home</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.sidePrimary} onPress={() => router.push("/driver/board" as any)} activeOpacity={0.9}>
                <Ionicons name="grid-outline" size={18} color={COLORS.white} />
                <Text style={styles.sidePrimaryText}>Driver Board</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.main}>
              <View style={styles.hero}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eyebrow}>Farm2Home Driver</Text>
                  <Text style={styles.title}>{fullName || "Driver Profile"}</Text>
                  <Text style={styles.subtitle}>
                    Manage driver account, compliance, Stripe membership, and payout setup.
                  </Text>
                </View>

                <View style={[styles.readyPill, dashboardReady ? styles.readyPillGood : styles.readyPillWarn]}>
                  <Ionicons
                    name={dashboardReady ? "checkmark-circle-outline" : "alert-circle-outline"}
                    size={18}
                    color={dashboardReady ? COLORS.accentDark : "#92400E"}
                  />
                  <Text style={[styles.readyText, dashboardReady ? styles.readyTextGood : styles.readyTextWarn]}>
                    {dashboardReady ? "Dashboard Ready" : "Setup Needed"}
                  </Text>
                </View>
              </View>

              <View style={styles.metricsRow}>
                <Metric label="Account" value={accountId || "Missing"} icon="id-card-outline" good={isDriverAccountId(accountId)} />
                <Metric label="Membership" value={maskId(stripeSubscriptionId)} icon="receipt-outline" good={isStripeSubscriptionId(stripeSubscriptionId)} />
                <Metric label="Payouts" value={maskId(stripeAccountId)} icon="wallet-outline" good={isStripeConnectAccountId(stripeAccountId)} />
              </View>

              {renderTab()}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SectionHeader({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={20} color={COLORS.white} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  keyboardType,
  compact,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
  keyboardType?: any;
  compact?: boolean;
}) {
  return (
    <View style={[styles.fieldWrap, compact && { flex: 1 }]}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputShell}>
        <Ionicons name={icon} size={18} color={COLORS.muted} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          keyboardType={keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleText}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

function IdCard({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <View style={styles.idCard}>
      <View style={[styles.idIcon, good ? styles.idGood : styles.idBad]}>
        <Ionicons name={good ? "checkmark-outline" : "ellipse-outline"} size={16} color={good ? COLORS.white : COLORS.muted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.idLabel}>{label}</Text>
        <Text style={styles.idValue}>{value}</Text>
      </View>
    </View>
  );
}

function StatusPanel({
  items,
}: {
  items: { label: string; value: string; good: boolean }[];
}) {
  return (
    <View style={styles.statusPanel}>
      {items.map((item) => (
        <View key={item.label} style={styles.statusItem}>
          <Ionicons
            name={item.good ? "checkmark-circle-outline" : "alert-circle-outline"}
            size={18}
            color={item.good ? COLORS.accent : COLORS.warning}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusLabel}>{item.label}</Text>
            <Text style={styles.statusValue}>{item.value}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function Metric({
  label,
  value,
  icon,
  good,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  good: boolean;
}) {
  return (
    <View style={styles.metric}>
      <View style={[styles.metricIcon, good ? styles.metricGood : styles.metricWarn]}>
        <Ionicons name={icon} size={18} color={good ? COLORS.accentDark : COLORS.warning} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
    </View>
  );
}

function PrimaryButton({
  title,
  icon,
  loading,
  onPress,
  secondary,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  loading: boolean;
  onPress: () => void;
  secondary?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[secondary ? styles.secondaryButton : styles.primaryButton, loading && styles.disabledButton]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.9}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? COLORS.primary : COLORS.white} />
      ) : (
        <>
          <Ionicons name={icon} size={18} color={secondary ? COLORS.primary : COLORS.white} />
          <Text style={secondary ? styles.secondaryButtonText : styles.primaryButtonText}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { flexGrow: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: COLORS.bg,
  },
  centeredText: { color: COLORS.muted, marginTop: 12, fontWeight: "800" },
  shell: {
    minHeight: "100%",
    flexDirection: Platform.OS === "web" ? "row" : "column",
  },

  sidebar: {
    width: Platform.OS === "web" ? 286 : "100%",
    backgroundColor: COLORS.navy,
    padding: 16,
    gap: 10,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  brandIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  brandTitle: { color: COLORS.white, fontSize: 18, fontWeight: "900" },
  brandSubtitle: { color: "#A5B4FC", fontSize: 12, fontWeight: "800" },
  scoreCard: {
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: 16,
    marginVertical: 6,
  },
  scoreLabel: { color: "#CBD5E1", fontSize: 12, fontWeight: "900" },
  scoreValue: { color: COLORS.white, fontSize: 34, fontWeight: "900", marginTop: 6 },
  scoreHint: { color: "#A5B4FC", fontSize: 12, fontWeight: "700", lineHeight: 18, marginTop: 4 },
  tabButton: {
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tabButtonActive: {
    backgroundColor: "rgba(99,91,255,0.25)",
    borderColor: "rgba(99,91,255,0.75)",
  },
  tabIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  tabIconActive: { backgroundColor: COLORS.primary },
  tabText: { color: "#CBD5E1", fontWeight: "900" },
  tabTextActive: { color: COLORS.white },
  sideButton: {
    borderWidth: 1,
    borderColor: "rgba(99,91,255,0.55)",
    borderRadius: 14,
    padding: 13,
    marginTop: 8,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  sideButtonText: { color: COLORS.white, fontWeight: "900" },
  sidePrimary: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    padding: 13,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  sidePrimaryText: { color: COLORS.white, fontWeight: "900" },

  main: { flex: 1, padding: 16, paddingBottom: 80 },
  hero: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
    flexDirection: Platform.OS === "web" ? "row" : "column",
    alignItems: Platform.OS === "web" ? "center" : "stretch",
    gap: 12,
  },
  eyebrow: { color: COLORS.primary, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1, fontSize: 12 },
  title: { color: COLORS.text, fontSize: 30, fontWeight: "900", marginTop: 4 },
  subtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 4 },
  readyPill: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: Platform.OS === "web" ? "center" : "flex-start",
  },
  readyPillGood: { backgroundColor: COLORS.accentSoft },
  readyPillWarn: { backgroundColor: COLORS.warningSoft },
  readyText: { fontWeight: "900" },
  readyTextGood: { color: COLORS.accentDark },
  readyTextWarn: { color: "#92400E" },

  metricsRow: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: 12,
    marginBottom: 14,
  },
  metric: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  metricGood: { backgroundColor: COLORS.accentSoft },
  metricWarn: { backgroundColor: COLORS.warningSoft },
  metricLabel: { color: COLORS.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  metricValue: { color: COLORS.text, fontWeight: "900", marginTop: 3 },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
  },
  sectionHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 16 },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  sectionSubtitle: { color: COLORS.muted, lineHeight: 20, marginTop: 3, fontWeight: "700" },
  row2: { flexDirection: Platform.OS === "web" ? "row" : "column", gap: 12 },

  fieldWrap: { marginBottom: 13 },
  inputLabel: { color: COLORS.text, fontWeight: "900", marginBottom: 7 },
  inputShell: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    paddingHorizontal: 12,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: { flex: 1, minHeight: 48, color: COLORS.text, fontWeight: "700" },

  toggleRow: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  toggleText: { color: COLORS.text, fontWeight: "800", flex: 1, paddingRight: 12 },

  idCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  idIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  idGood: { backgroundColor: COLORS.accent },
  idBad: { backgroundColor: COLORS.surface2 },
  idLabel: { color: COLORS.muted, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  idValue: { color: COLORS.text, fontWeight: "900", marginTop: 3 },

  statusPanel: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  statusItem: { flexDirection: "row", alignItems: "center", gap: 9 },
  statusLabel: { color: COLORS.muted, fontSize: 12, fontWeight: "900" },
  statusValue: { color: COLORS.text, fontWeight: "900", marginTop: 2 },

  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  primaryButtonText: { color: COLORS.white, fontWeight: "900", fontSize: 15 },
  secondaryButton: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 16,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  secondaryButtonText: { color: COLORS.primary, fontWeight: "900", fontSize: 15 },
  logoutButton: {
    backgroundColor: COLORS.dangerSoft,
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 16,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  logoutText: { color: COLORS.danger, fontWeight: "900", fontSize: 15 },
  disabledButton: { opacity: 0.6 },
});
