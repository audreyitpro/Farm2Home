// app/freight/profile.tsx

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
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL } from "../config/api";
import { supabase } from "../data/supabaseClient";

const FREIGHT_ROUTES = {
  dashboard: "/freight/dashboard",
  board: "/freight/board",
  liveLoads: "/freight/live-loads",
  myLoads: "/freight/my-loads",
  connectBank: "/freight/connect-bank",
  subscription: "/freight/subscription",
  profile: "/freight/profile",
  settings: "/freight/settings",
  support: "/freight/support",
  help: "/freight/help",
  liveRoute: "/freight/live-route",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];

const COLORS = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  redDark: "#9F1117",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  amber: "#D97706",
  blue: "#2563EB",
  slate: "#64748B",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

export default function FreightProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

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

  const [licensedLivestock, setLicensedLivestock] = useState(false);
  const [licensedRefrigeratedFood, setLicensedRefrigeratedFood] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadCarrier();
    }, [])
  );

  async function getStoredCarrier() {
    const raw =
      (await AsyncStorage.getItem("currentFreightCarrier")) ||
      (await AsyncStorage.getItem("currentFreight")) ||
      (await AsyncStorage.getItem("currentFreightUser")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function loadCarrier() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const savedCarriers = await AsyncStorage.getItem("farm2homeFreightCarriers");
      const parsedCarriers = savedCarriers ? JSON.parse(savedCarriers) : [];
      const safeCarriers = Array.isArray(parsedCarriers) ? parsedCarriers : [];

      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;

      const carrierEmail = normalize(stored?.email || authUser?.email || "");

      if (!carrierEmail) {
        router.replace("/freight/login" as any);
        return;
      }

      const { data: dbCarrier, error } = await supabase
        .from("freight_users")
        .select("*")
        .eq("email", carrierEmail)
        .maybeSingle();

      if (error) {
        console.log("Load freight profile Supabase error:", error.message);
      }

      if (!dbCarrier) {
        Alert.alert(
          "Freight Profile Missing",
          "No freight profile was found for this email. Please complete freight registration again."
        );
        router.replace("/freight/register" as any);
        return;
      }

      const localCurrent = stored || safeCarriers[safeCarriers.length - 1] || {};

      const mergedCarrier = {
        ...localCurrent,
        ...dbCarrier,
        id: dbCarrier.id,
        freightId: dbCarrier.id,
        role: "freight",

        companyName:
          dbCarrier.company_name ||
          dbCarrier.business_name ||
          localCurrent.companyName ||
          localCurrent.businessName ||
          "Freight Connect Carrier",
        businessName:
          dbCarrier.business_name ||
          dbCarrier.company_name ||
          localCurrent.businessName ||
          localCurrent.companyName ||
          "Freight Connect Carrier",
        contactName:
          dbCarrier.contact_name ||
          dbCarrier.name ||
          localCurrent.contactName ||
          localCurrent.ownerName ||
          localCurrent.fullName ||
          "",
        username: dbCarrier.username || localCurrent.username || "",
        email: normalize(dbCarrier.email || carrierEmail),
        phone: dbCarrier.phone || localCurrent.phone || "",

        mdotNumber: dbCarrier.mdot_number || localCurrent.mdotNumber || "",
        mcNumber: dbCarrier.mc_number || localCurrent.mcNumber || "",
        insuranceProvider: dbCarrier.insurance_provider || localCurrent.insuranceProvider || "",
        insurancePolicyNumber:
          dbCarrier.insurance_policy_number || localCurrent.insurancePolicyNumber || "",

        licensedLivestock: dbCarrier.licensed_livestock ?? localCurrent.licensedLivestock ?? false,
        licensedRefrigeratedFood:
          dbCarrier.licensed_refrigerated_food ??
          localCurrent.licensedRefrigeratedFood ??
          false,

        membershipStatus: dbCarrier.membership_status || localCurrent.membershipStatus || "Active",
        subscriptionStatus:
          dbCarrier.subscription_status || localCurrent.subscriptionStatus || "active",

        stripeCustomerId:
          dbCarrier.stripe_customer_id ||
          localCurrent.stripeCustomerId ||
          localCurrent.customerId ||
          "",
        stripeSubscriptionId:
          dbCarrier.stripe_subscription_id ||
          localCurrent.stripeSubscriptionId ||
          localCurrent.subscriptionId ||
          "",
        stripeAccountId:
          dbCarrier.stripe_account_id ||
          localCurrent.stripeAccountId ||
          localCurrent.stripe_account_id ||
          "",
        stripe_account_id:
          dbCarrier.stripe_account_id ||
          localCurrent.stripe_account_id ||
          localCurrent.stripeAccountId ||
          "",
        stripeConnectStatus:
          dbCarrier.stripe_connect_status ||
          localCurrent.stripeConnectStatus ||
          localCurrent.stripe_connect_status ||
          "not_started",
        stripe_connect_status:
          dbCarrier.stripe_connect_status ||
          localCurrent.stripe_connect_status ||
          localCurrent.stripeConnectStatus ||
          "not_started",
        payoutsEnabled:
          dbCarrier.payouts_enabled ??
          dbCarrier.stripe_payouts_enabled ??
          localCurrent.payoutsEnabled ??
          localCurrent.payouts_enabled ??
          false,
        chargesEnabled:
          dbCarrier.charges_enabled ??
          dbCarrier.stripe_charges_enabled ??
          localCurrent.chargesEnabled ??
          localCurrent.charges_enabled ??
          false,
        onboardingComplete:
          dbCarrier.stripe_onboarding_complete ??
          localCurrent.onboardingComplete ??
          localCurrent.stripe_onboarding_complete ??
          false,

        accountActive: dbCarrier.account_active ?? localCurrent.accountActive ?? true,
        password: localCurrent.password || "",
      };

      setAllCarriers(safeCarriers);
      setCarrier(mergedCarrier);

      setCompanyName(mergedCarrier.companyName || "");
      setContactName(mergedCarrier.contactName || "");
      setUsername(mergedCarrier.username || "");
      setEmail(mergedCarrier.email || "");
      setPhone(mergedCarrier.phone || "");
      setMdotNumber(mergedCarrier.mdotNumber || "");
      setMcNumber(mergedCarrier.mcNumber || "");
      setInsuranceProvider(mergedCarrier.insuranceProvider || "");
      setInsurancePolicyNumber(mergedCarrier.insurancePolicyNumber || "");
      setLicensedLivestock(Boolean(mergedCarrier.licensedLivestock));
      setLicensedRefrigeratedFood(Boolean(mergedCarrier.licensedRefrigeratedFood));

      await persistCarrier(mergedCarrier, false);
    } catch (error) {
      console.log("Load freight profile error:", error);
      Alert.alert("Profile Error", "Unable to load freight profile.");
    } finally {
      setLoading(false);
    }
  }

  async function persistCarrier(updatedCarrier: any, saveToSupabase = true) {
    const now = new Date().toISOString();
    const realId = updatedCarrier.id || updatedCarrier.freightId;

    if (!realId) throw new Error("Missing freight profile ID.");

    const normalizedCarrier = {
      ...updatedCarrier,
      id: realId,
      freightId: realId,
      role: "freight",
      companyName: updatedCarrier.companyName || updatedCarrier.businessName,
      businessName: updatedCarrier.businessName || updatedCarrier.companyName,
      email: normalize(updatedCarrier.email),
      stripeAccountId:
        updatedCarrier.stripeAccountId ||
        updatedCarrier.stripe_account_id ||
        updatedCarrier.accountId ||
        "",
      stripe_account_id:
        updatedCarrier.stripe_account_id ||
        updatedCarrier.stripeAccountId ||
        updatedCarrier.accountId ||
        "",
      updatedAt: now,
    };

    const existing = allCarriers.length > 0 ? allCarriers : [];
    const exists = existing.some((item) => item.id === normalizedCarrier.id);

    const updatedCarriers = exists
      ? existing.map((item) => (item.id === normalizedCarrier.id ? normalizedCarrier : item))
      : [...existing, normalizedCarrier];

    if (saveToSupabase) {
      const { error } = await supabase
        .from("freight_users")
        .update({
          company_name: normalizedCarrier.companyName,
          business_name: normalizedCarrier.businessName,
          contact_name: normalizedCarrier.contactName,
          name: normalizedCarrier.contactName,
          username: normalizedCarrier.username,
          email: normalizedCarrier.email,
          phone: normalizedCarrier.phone,
          mdot_number: normalizedCarrier.mdotNumber,
          mc_number: normalizedCarrier.mcNumber,
          insurance_provider: normalizedCarrier.insuranceProvider,
          insurance_policy_number: normalizedCarrier.insurancePolicyNumber,
          licensed_livestock: Boolean(normalizedCarrier.licensedLivestock),
          licensed_refrigerated_food: Boolean(normalizedCarrier.licensedRefrigeratedFood),
          membership_status: normalizedCarrier.membershipStatus,
          subscription_status: normalizedCarrier.subscriptionStatus,
          stripe_account_id: normalizedCarrier.stripeAccountId || null,
          stripe_connect_status: normalizedCarrier.stripeConnectStatus || "not_started",
          payouts_enabled: Boolean(normalizedCarrier.payoutsEnabled),
          charges_enabled: Boolean(normalizedCarrier.chargesEnabled),
          stripe_onboarding_complete: Boolean(normalizedCarrier.onboardingComplete),
          account_active: normalizedCarrier.accountActive !== false,
          updated_at: now,
        })
        .eq("id", normalizedCarrier.id);

      if (error) throw error;
    }

    await AsyncStorage.setItem("farm2homeFreightCarriers", JSON.stringify(updatedCarriers));
    await AsyncStorage.setItem("currentFreight", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentFreightUser", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentUser", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("userRole", "freight");
    await AsyncStorage.setItem("currentUserRole", "freight");

    setCarrier(normalizedCarrier);
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

    try {
      setSaving(true);

      const updatedCarrier = {
        ...carrier,
        companyName: companyName.trim(),
        businessName: companyName.trim(),
        contactName: contactName.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        mdotNumber: mdotNumber.trim(),
        mcNumber: mcNumber.trim(),
        insuranceProvider: insuranceProvider.trim(),
        insurancePolicyNumber: insurancePolicyNumber.trim(),
        licensedLivestock,
        licensedRefrigeratedFood,
        updatedAt: new Date().toISOString(),
      };

      await persistCarrier(updatedCarrier, true);
      Alert.alert("Saved", "Freight profile updated.");
    } catch (error: any) {
      Alert.alert("Save Error", error?.message || "Unable to save freight profile.");
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
      setPasswordSaving(true);

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setCurrentPassword("");
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
      carrier?.stripeCustomerId ||
      carrier?.stripe_customer_id ||
      carrier?.customerId ||
      carrier?.freightStripeCustomerId;

    if (!stripeCustomerId) {
      goTo(FREIGHT_ROUTES.subscription);
      return;
    }

    try {
      setBillingLoading(true);

      const response = await fetch(`${API_BASE_URL}/payments/create-customer-portal-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: stripeCustomerId,
          role: "freight",
          carrierId: carrier?.id || carrier?.freightId,
          returnUrl: Platform.OS === "web" ? window.location.href : "farm2home://freight/profile",
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
      carrier?.stripeSubscriptionId ||
      carrier?.stripe_subscription_id ||
      carrier?.subscriptionId ||
      carrier?.freightSubscriptionId;

    if (!subscriptionId) {
      Alert.alert("No Subscription", "No active freight subscription ID was found.");
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
              setCancelLoading(true);

              const response = await fetch(`${API_BASE_URL}/payments/cancel-subscription`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  subscriptionId,
                  carrierId: carrier?.id || carrier?.freightId,
                  role: "freight",
                }),
              });

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

              await persistCarrier(updatedCarrier, true);
              Alert.alert("Canceled", "Freight subscription was canceled.");
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
      "currentFreightCarrier",
      "currentFreight",
      "currentFreightUser",
      "currentUser",
      "userRole",
      "currentUserRole",
    ]);

    router.replace("/freight/login" as any);
  }

  function membershipStatus() {
    return carrier?.membershipStatus || carrier?.subscriptionStatus || "Active";
  }

  function membershipColor() {
    const status = String(membershipStatus()).toLowerCase();

    if (status.includes("cancel")) return COLORS.red;
    if (status.includes("pending")) return COLORS.amber;
    if (status.includes("past_due") || status.includes("unpaid")) return COLORS.red;

    return COLORS.green;
  }

  function stripeStatusText() {
    if (carrier?.payoutsEnabled && carrier?.chargesEnabled && carrier?.onboardingComplete) {
      return "Payout Ready";
    }

    if (carrier?.stripeAccountId || carrier?.stripe_account_id) {
      return "Setup Incomplete";
    }

    return "Not Connected";
  }

  function stripeStatusColor() {
    if (carrier?.payoutsEnabled && carrier?.chargesEnabled && carrier?.onboardingComplete) {
      return COLORS.green;
    }

    if (carrier?.stripeAccountId || carrier?.stripe_account_id) {
      return COLORS.amber;
    }

    return COLORS.red;
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

    if (licensedLivestock) services.push("Livestock Transport");
    if (licensedRefrigeratedFood) services.push("Refrigerated Fresh Food");

    return services.length > 0 ? services.join("\n") : "No services selected";
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.red} />
          <Text style={styles.centerText}>Loading freight profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!carrier) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <Text style={styles.kicker}>Farm2Home Freight Connect</Text>
            <Text style={styles.title}>Freight Carrier Profile</Text>
            <Text style={styles.subtitle}>No freight carrier profile found.</Text>
          </View>

          <TouchableOpacity style={styles.redButton} onPress={() => router.replace("/freight/login" as any)}>
            <Text style={styles.buttonText}>Go to Freight Login</Text>
          </TouchableOpacity>
        </ScrollView>
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
            <View style={styles.heroTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{carrierInitials()}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.kicker}>Farm2Home Freight Connect</Text>
                <Text style={styles.title}>Freight Carrier Profile</Text>
                <Text style={styles.subtitle}>
                  Manage company details, carrier credentials, subscription, payout setup, and freight access.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.statusCard}>
            <View style={styles.statusTop}>
              <View>
                <Text style={styles.statusTitle}>Membership Status</Text>
                <View style={[styles.statusBadge, { backgroundColor: membershipColor() }]}>
                  <Text style={styles.statusBadgeText}>{membershipStatus()}</Text>
                </View>
              </View>

              <Ionicons name="shield-checkmark-outline" size={34} color="#FFFFFF" />
            </View>

            <Text style={styles.statusSmall}>
              Freight subscription gives access to the freight board, available loads, carrier tools,
              and billing features.
            </Text>
          </View>

          <View style={styles.stripeCard}>
            <View style={styles.statusTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.statusTitle}>Stripe Connect</Text>
                <View style={[styles.statusBadge, { backgroundColor: stripeStatusColor() }]}>
                  <Text style={styles.statusBadgeText}>{stripeStatusText()}</Text>
                </View>
              </View>

              <Ionicons name="card-outline" size={34} color="#FFFFFF" />
            </View>

            <Text style={styles.statusSmall}>
              Account ID: {carrier?.stripeAccountId || carrier?.stripe_account_id || "Not connected"}
            </Text>

            <TouchableOpacity style={styles.whiteButton} onPress={() => goTo(FREIGHT_ROUTES.connectBank)}>
              <Ionicons name="business-outline" size={18} color={COLORS.red} />
              <Text style={styles.whiteButtonText}>Open Connect Bank</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.quickGrid}>
            <QuickNav icon="grid-outline" label="Dashboard" route={FREIGHT_ROUTES.dashboard} />
            <QuickNav icon="list-outline" label="Board" route={FREIGHT_ROUTES.board} />
            <QuickNav icon="briefcase-outline" label="My Loads" route={FREIGHT_ROUTES.myLoads} />
            <QuickNav icon="pulse-outline" label="Live Loads" route={FREIGHT_ROUTES.liveLoads} />
            <QuickNav icon="card-outline" label="Subscription" route={FREIGHT_ROUTES.subscription} />
            <QuickNav icon="settings-outline" label="Settings" route={FREIGHT_ROUTES.settings} />
            <QuickNav icon="headset-outline" label="Support" route={FREIGHT_ROUTES.support} />
            <QuickNav icon="help-circle-outline" label="Help" route={FREIGHT_ROUTES.help} />
          </View>

          <View style={styles.card}>
            <SectionHeader
              icon="business-outline"
              title="Profile Information"
              subtitle="Company and primary contact information."
            />

            <Label text="Username" />
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Username"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
            />

            <Label text="Company Name" />
            <TextInput
              style={styles.input}
              value={companyName}
              onChangeText={setCompanyName}
              placeholder="Company name"
              placeholderTextColor="#94A3B8"
            />

            <Label text="Contact Name" />
            <TextInput
              style={styles.input}
              value={contactName}
              onChangeText={setContactName}
              placeholder="Contact name"
              placeholderTextColor="#94A3B8"
            />

            <Label text="Email" />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Label text="Phone" />
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
            />

            <TouchableOpacity style={[styles.redButtonInner, saving && styles.disabledButton]} onPress={saveProfile} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.buttonText}>Save Profile</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <SectionHeader
              icon="trail-sign-outline"
              title="Carrier Details"
              subtitle="DOT, MC, insurance, and authorized services."
            />

            <Label text="MDOT Number" />
            <TextInput
              style={styles.input}
              value={mdotNumber}
              onChangeText={setMdotNumber}
              placeholder="MDOT Number"
              placeholderTextColor="#94A3B8"
            />

            <Label text="MC Number" />
            <TextInput
              style={styles.input}
              value={mcNumber}
              onChangeText={setMcNumber}
              placeholder="MC Number"
              placeholderTextColor="#94A3B8"
            />

            <Label text="Insurance Provider" />
            <TextInput
              style={styles.input}
              value={insuranceProvider}
              onChangeText={setInsuranceProvider}
              placeholder="Insurance provider"
              placeholderTextColor="#94A3B8"
            />

            <Label text="Policy Number" />
            <TextInput
              style={styles.input}
              value={insurancePolicyNumber}
              onChangeText={setInsurancePolicyNumber}
              placeholder="Policy number"
              placeholderTextColor="#94A3B8"
            />

            <SwitchRow
              label="Licensed Livestock Transport"
              value={licensedLivestock}
              onValueChange={setLicensedLivestock}
            />

            <SwitchRow
              label="Licensed Refrigerated Fresh Food"
              value={licensedRefrigeratedFood}
              onValueChange={setLicensedRefrigeratedFood}
            />

            <View style={styles.valueBox}>
              <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.red} />
              <View style={{ flex: 1 }}>
                <Text style={styles.valueLabel}>Authorized Services</Text>
                <Text style={styles.value}>{authorizedServices()}</Text>
              </View>
            </View>

            <TouchableOpacity style={[styles.redButtonInner, saving && styles.disabledButton]} onPress={saveProfile} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.buttonText}>Save Carrier Details</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <SectionHeader icon="key-outline" title="Change Password" subtitle="Update your freight account password." />

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

            <TouchableOpacity
              style={[styles.blackButtonInner, passwordSaving && styles.disabledButton]}
              onPress={changePassword}
              disabled={passwordSaving}
            >
              {passwordSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="lock-closed-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.buttonText}>Change Password</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <SectionHeader icon="card-outline" title="Manage Subscription" subtitle="Manage billing, payment method, or cancellation." />

            <Text style={styles.helpText}>
              Manage your freight membership, update your card, review billing, or cancel your subscription.
            </Text>

            <TouchableOpacity
              style={[styles.blackButtonInner, billingLoading && styles.disabledButton]}
              onPress={manageSubscription}
              disabled={billingLoading}
            >
              {billingLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="open-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.buttonText}>Manage Freight Membership</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelButton, cancelLoading && styles.disabledButton]}
              onPress={cancelSubscription}
              disabled={cancelLoading}
            >
              {cancelLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.buttonText}>Cancel Freight Subscription</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.redButton} onPress={() => goTo(FREIGHT_ROUTES.board)}>
            <Ionicons name="list-outline" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>Back to Freight Board</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.darkButton} onPress={() => goTo(FREIGHT_ROUTES.dashboard)}>
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

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
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

function QuickNav({
  icon,
  label,
  route,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: FreightRoute;
}) {
  return (
    <TouchableOpacity style={styles.quickCard} onPress={() => goTo(route)}>
      <Ionicons name={icon} size={22} color={COLORS.red} />
      <Text style={styles.quickText}>{label}</Text>
    </TouchableOpacity>
  );
}

function SwitchRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#CBD5E1", true: "#FCA5A5" }}
        thumbColor={value ? COLORS.red : "#FFFFFF"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  keyboard: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 90 },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  centerText: { color: COLORS.muted, marginTop: 12, fontWeight: "800" },
  hero: {
    backgroundColor: COLORS.black,
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  heroTop: { flexDirection: "row", gap: 14, alignItems: "center" },
  avatar: {
    width: 66,
    height: 66,
    borderRadius: 24,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
  kicker: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: { fontSize: 32, fontWeight: "900", color: "#FFFFFF", marginTop: 6 },
  subtitle: { color: "#CBD5E1", fontWeight: "700", lineHeight: 22, marginTop: 8 },
  statusCard: {
    backgroundColor: COLORS.red,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 14,
  },
  stripeCard: {
    backgroundColor: COLORS.black,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 14,
  },
  statusTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  statusTitle: { fontSize: 20, fontWeight: "900", color: "#FFFFFF", marginBottom: 8 },
  statusBadge: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  statusBadgeText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12, textTransform: "capitalize" },
  statusSmall: { marginTop: 12, color: "#FFE4E6", fontWeight: "700", lineHeight: 20 },
  whiteButton: {
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
  },
  whiteButtonText: { color: COLORS.red, fontWeight: "900" },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  quickCard: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    gap: 8,
  },
  quickText: { color: COLORS.text, fontWeight: "900", textAlign: "center" },
  card: {
    backgroundColor: COLORS.card,
    padding: 18,
    borderRadius: 22,
    marginHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 14 },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { fontSize: 21, fontWeight: "900", color: COLORS.text },
  sectionSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 3 },
  label: { color: COLORS.text, marginTop: 8, marginBottom: 6, fontWeight: "900" },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    fontWeight: "700",
    marginBottom: 8,
    color: COLORS.text,
  },
  switchRow: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switchLabel: { color: COLORS.text, fontWeight: "900", flex: 1 },
  valueBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  valueLabel: { color: COLORS.red, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  value: { fontSize: 15, fontWeight: "800", color: COLORS.text, lineHeight: 22, marginTop: 3 },
  helpText: { color: COLORS.muted, fontWeight: "700", lineHeight: 21, marginBottom: 12 },
  redButtonInner: {
    backgroundColor: COLORS.red,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  blackButtonInner: {
    backgroundColor: COLORS.black,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  redButton: {
    backgroundColor: COLORS.red,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 18,
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  darkButton: {
    backgroundColor: COLORS.black,
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
    backgroundColor: COLORS.redDark,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  logoutButton: {
    backgroundColor: COLORS.slate,
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
  disabledButton: { opacity: 0.65 },
  buttonText: { color: "#FFFFFF", fontWeight: "900", textAlign: "center" },
});