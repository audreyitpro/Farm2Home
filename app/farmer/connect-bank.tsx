// app/farmer/connect-bank.tsx

import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import { API_BASE_URL } from "../config/api";
import { supabase } from "../data/supabaseClient";

const COLORS = {
  primary: "#2E7D32",
  primaryDark: "#14532D",
  background: "#F8FAF5",
  card: "#FFFFFF",
  text: "#172017",
  muted: "#75806F",
  border: "#E2E8DA",
  softGreen: "#EAF5E6",
  lightGreen: "#F1FAED",
  danger: "#DC2626",
  stripe: "#635BFF",
};

type FarmerProfile = {
  id?: string;
  farmerId?: string;
  farmer_id?: string;
  profileId?: string;
  profile_id?: string;
  authUserId?: string;
  auth_user_id?: string;
  user_id?: string;

  farmName?: string;
  farm_name?: string;
  businessName?: string;
  business_name?: string;
  ownerName?: string;
  owner_name?: string;
  email?: string;
  farmer_email?: string;
  phone?: string;

  stripeAccountId?: string;
  farmerStripeAccountId?: string;
  stripe_account_id?: string;
  farmer_stripe_account_id?: string;
  farmer_account?: string;

  stripePayoutsEnabled?: boolean;
  stripeChargesEnabled?: boolean;
  stripeOnboardingComplete?: boolean;

  stripe_payouts_enabled?: boolean;
  stripe_charges_enabled?: boolean;
  stripe_onboarding_complete?: boolean;

  payoutsEnabled?: boolean;
  chargesEnabled?: boolean;
  detailsSubmitted?: boolean;

  stripePayoutAccount?: string;
  stripePayoutAccountLast4?: string;
  stripePayoutBankName?: string;

  stripe_payout_account?: string;
  stripe_payout_account_last4?: string;
  stripe_payout_bank_name?: string;

  complianceStatus?: string;
  compliance_status?: string;

  role?: string;
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function firstParam(value: any) {
  if (Array.isArray(value)) return value[0] || "";
  return value ? String(value) : "";
}

function normalizeEmail(value?: string) {
  return clean(value).toLowerCase();
}

function getFarmerId(farmer: FarmerProfile | null | undefined) {
  return clean(
    farmer?.id ||
      farmer?.farmerId ||
      farmer?.farmer_id ||
      farmer?.profileId ||
      farmer?.profile_id ||
      farmer?.authUserId ||
      farmer?.auth_user_id ||
      farmer?.user_id
  );
}

function getFarmName(farmer: FarmerProfile | null | undefined) {
  return (
    clean(farmer?.farmName || farmer?.farm_name) ||
    clean(farmer?.businessName || farmer?.business_name) ||
    clean(farmer?.ownerName || farmer?.owner_name) ||
    "Farmer"
  );
}

function getStripeAccountId(farmer: FarmerProfile | null | undefined) {
  return clean(
    farmer?.stripeAccountId ||
      farmer?.farmerStripeAccountId ||
      farmer?.stripe_account_id ||
      farmer?.farmer_stripe_account_id ||
      farmer?.farmer_account
  );
}

function mapSupabaseFarmer(row: any): FarmerProfile {
  const stripeAccountId = clean(
    row.farmer_account ||
      row.stripe_account_id ||
      row.farmer_stripe_account_id
  );

  return {
    id: row.id,
    farmerId: row.farmer_id || row.id,
    farmer_id: row.farmer_id || row.id,
    profileId: row.profile_id || "",
    profile_id: row.profile_id || "",
    authUserId: row.auth_user_id || row.user_id || "",
    auth_user_id: row.auth_user_id || row.user_id || "",
    user_id: row.user_id || "",
    role: "farmer",

    farmName: row.farm_name || row.business_name || "",
    farm_name: row.farm_name || row.business_name || "",
    businessName: row.business_name || row.farm_name || "",
    business_name: row.business_name || row.farm_name || "",
    ownerName: row.owner_name || "",
    owner_name: row.owner_name || "",
    email: row.email || row.farmer_email || "",
    farmer_email: row.farmer_email || row.email || "",
    phone: row.phone || "",

    stripeAccountId,
    farmerStripeAccountId: stripeAccountId,
    stripe_account_id: stripeAccountId,
    farmer_stripe_account_id: stripeAccountId,
    farmer_account: stripeAccountId,

    stripePayoutsEnabled: Boolean(row.stripe_payouts_enabled),
    stripeChargesEnabled: Boolean(row.stripe_charges_enabled),
    stripeOnboardingComplete: Boolean(row.stripe_onboarding_complete),

    stripe_payouts_enabled: Boolean(row.stripe_payouts_enabled),
    stripe_charges_enabled: Boolean(row.stripe_charges_enabled),
    stripe_onboarding_complete: Boolean(row.stripe_onboarding_complete),

    payoutsEnabled: Boolean(row.stripe_payouts_enabled),
    chargesEnabled: Boolean(row.stripe_charges_enabled),
    detailsSubmitted: Boolean(row.stripe_onboarding_complete),

    stripePayoutAccount: row.stripe_payout_account || "",
    stripePayoutAccountLast4: row.stripe_payout_account_last4 || "",
    stripePayoutBankName: row.stripe_payout_bank_name || "",

    stripe_payout_account: row.stripe_payout_account || "",
    stripe_payout_account_last4: row.stripe_payout_account_last4 || "",
    stripe_payout_bank_name: row.stripe_payout_bank_name || "",

    complianceStatus: row.compliance_status || "",
    compliance_status: row.compliance_status || "",
  };
}

export default function ConnectBankScreen() {
  const params = useLocalSearchParams();

  const farmerIdParam = firstParam(
    params.farmerId || params.farmer_id || params.id || params.profile_id
  );
  const emailParam = normalizeEmail(firstParam(params.email || params.farmer_email));

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<FarmerProfile | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadAndCheckStripeStatus();
    }, [farmerIdParam, emailParam])
  );

  async function readLocalFarmer(): Promise<FarmerProfile | null> {
    const rawFarmer =
      (await AsyncStorage.getItem("currentFarmer")) ||
      (await AsyncStorage.getItem("farm2homeCurrentFarmer")) ||
      (await AsyncStorage.getItem("farm2homeFarmerSession")) ||
      (await AsyncStorage.getItem("currentUser")) ||
      (await AsyncStorage.getItem("pendingFarmerApplication"));

    if (!rawFarmer) return null;

    try {
      return JSON.parse(rawFarmer);
    } catch {
      return null;
    }
  }

  async function getAuthUserId() {
    try {
      const { data } = await supabase.auth.getUser();
      return data?.user?.id || "";
    } catch {
      return "";
    }
  }

  async function findFarmerFromSupabase(localFarmer: FarmerProfile | null) {
    const localId = getFarmerId(localFarmer);
    const activeFarmerId = clean(farmerIdParam || localId);
    const activeEmail = normalizeEmail(emailParam || localFarmer?.email || localFarmer?.farmer_email);
    const authUserId = await getAuthUserId();

    if (activeFarmerId) {
      const { data, error } = await supabase
        .from("farmers")
        .select("*")
        .or(
          `id.eq.${activeFarmerId},farmer_id.eq.${activeFarmerId},profile_id.eq.${activeFarmerId},auth_user_id.eq.${activeFarmerId}`
        )
        .limit(1);

      if (!error && Array.isArray(data) && data.length > 0) {
        return mapSupabaseFarmer(data[0]);
      }

      if (error) console.log("farmer id lookup skipped:", error.message);
    }

    if (activeEmail) {
      const { data, error } = await supabase
        .from("farmers")
        .select("*")
        .or(`email.eq.${activeEmail},farmer_email.eq.${activeEmail}`)
        .limit(1);

      if (!error && Array.isArray(data) && data.length > 0) {
        return mapSupabaseFarmer(data[0]);
      }

      if (error) console.log("farmer email lookup skipped:", error.message);
    }

    if (authUserId) {
      const { data, error } = await supabase
        .from("farmers")
        .select("*")
        .or(`auth_user_id.eq.${authUserId},profile_id.eq.${authUserId},id.eq.${authUserId}`)
        .limit(1);

      if (!error && Array.isArray(data) && data.length > 0) {
        return mapSupabaseFarmer(data[0]);
      }

      if (error) console.log("farmer auth lookup skipped:", error.message);
    }

    return null;
  }

  async function getCurrentFarmer(): Promise<FarmerProfile | null> {
    const localFarmer = await readLocalFarmer();
    const supabaseFarmer = await findFarmerFromSupabase(localFarmer);

    const mergedFarmer: FarmerProfile | null = supabaseFarmer
      ? {
          ...(localFarmer || {}),
          ...supabaseFarmer,
          id: supabaseFarmer.id || getFarmerId(localFarmer),
          farmerId: supabaseFarmer.farmerId || supabaseFarmer.id || getFarmerId(localFarmer),
          farmer_id: supabaseFarmer.farmer_id || supabaseFarmer.id || getFarmerId(localFarmer),
          email: normalizeEmail(supabaseFarmer.email || localFarmer?.email || emailParam),
          farmer_email: normalizeEmail(supabaseFarmer.email || localFarmer?.email || emailParam),
          stripeAccountId: getStripeAccountId(supabaseFarmer) || getStripeAccountId(localFarmer),
          farmerStripeAccountId: getStripeAccountId(supabaseFarmer) || getStripeAccountId(localFarmer),
          stripe_account_id: getStripeAccountId(supabaseFarmer) || getStripeAccountId(localFarmer),
          farmer_stripe_account_id: getStripeAccountId(supabaseFarmer) || getStripeAccountId(localFarmer),
          farmer_account: getStripeAccountId(supabaseFarmer) || getStripeAccountId(localFarmer),
          role: "farmer",
        }
      : localFarmer
      ? {
          ...localFarmer,
          id: farmerIdParam || getFarmerId(localFarmer),
          farmerId: farmerIdParam || getFarmerId(localFarmer),
          farmer_id: farmerIdParam || getFarmerId(localFarmer),
          email: normalizeEmail(emailParam || localFarmer.email || localFarmer.farmer_email),
          farmer_email: normalizeEmail(emailParam || localFarmer.email || localFarmer.farmer_email),
          stripeAccountId: getStripeAccountId(localFarmer),
          farmerStripeAccountId: getStripeAccountId(localFarmer),
          stripe_account_id: getStripeAccountId(localFarmer),
          farmer_stripe_account_id: getStripeAccountId(localFarmer),
          farmer_account: getStripeAccountId(localFarmer),
          role: "farmer",
        }
      : null;

    if (mergedFarmer) {
      const saved = await saveUpdatedFarmer(mergedFarmer);
      return saved;
    }

    return null;
  }

  async function saveUpdatedFarmer(updatedFarmer: FarmerProfile) {
    const existing = await readLocalFarmer();
    const finalAccountId = getStripeAccountId(updatedFarmer) || getStripeAccountId(existing);
    const farmerId = getFarmerId(updatedFarmer) || getFarmerId(existing) || farmerIdParam;

    const merged: FarmerProfile = {
      ...(existing || {}),
      ...updatedFarmer,
      id: farmerId,
      farmerId,
      farmer_id: farmerId,
      role: "farmer",

      farmName: getFarmName(updatedFarmer) || getFarmName(existing),
      farm_name: getFarmName(updatedFarmer) || getFarmName(existing),
      businessName: getFarmName(updatedFarmer) || getFarmName(existing),
      business_name: getFarmName(updatedFarmer) || getFarmName(existing),
      email: normalizeEmail(updatedFarmer.email || existing?.email || emailParam),
      farmer_email: normalizeEmail(updatedFarmer.email || existing?.email || emailParam),

      stripeAccountId: finalAccountId,
      farmerStripeAccountId: finalAccountId,
      stripe_account_id: finalAccountId,
      farmer_stripe_account_id: finalAccountId,
      farmer_account: finalAccountId,
    };

    await AsyncStorage.multiSet([
      ["currentFarmer", JSON.stringify(merged)],
      ["farm2homeCurrentFarmer", JSON.stringify(merged)],
      ["farm2homeFarmerSession", JSON.stringify(merged)],
      ["currentUser", JSON.stringify(merged)],
      ["currentUserRole", "farmer"],
      ["userRole", "farmer"],
    ]);

    return merged;
  }

  async function safeUpdateFarmerInSupabase(updatedFarmer: FarmerProfile) {
    const farmerId = getFarmerId(updatedFarmer);
    const accountId = getStripeAccountId(updatedFarmer);

    if (!farmerId && !updatedFarmer.email) return;

    const payload: Record<string, any> = {
      farmer_account: accountId,
      stripe_account_id: accountId,
      farmer_stripe_account_id: accountId,
      stripe_onboarding_complete: Boolean(
        updatedFarmer.stripeOnboardingComplete ||
          updatedFarmer.detailsSubmitted ||
          updatedFarmer.stripe_onboarding_complete
      ),
      stripe_charges_enabled: Boolean(
        updatedFarmer.stripeChargesEnabled ||
          updatedFarmer.chargesEnabled ||
          updatedFarmer.stripe_charges_enabled
      ),
      stripe_payouts_enabled: Boolean(
        updatedFarmer.stripePayoutsEnabled ||
          updatedFarmer.payoutsEnabled ||
          updatedFarmer.stripe_payouts_enabled
      ),
      stripe_payout_account:
        updatedFarmer.stripePayoutAccount ||
        updatedFarmer.stripe_payout_account ||
        "",
      stripe_payout_account_last4:
        updatedFarmer.stripePayoutAccountLast4 ||
        updatedFarmer.stripe_payout_account_last4 ||
        "",
      stripe_payout_bank_name:
        updatedFarmer.stripePayoutBankName ||
        updatedFarmer.stripe_payout_bank_name ||
        "",
      compliance_status:
        updatedFarmer.complianceStatus ||
        updatedFarmer.compliance_status ||
        "stripe_pending",
      updated_at: new Date().toISOString(),
    };

    if (updatedFarmer.email) {
      payload.email = normalizeEmail(updatedFarmer.email);
      payload.farmer_email = normalizeEmail(updatedFarmer.email);
    }

    const name = getFarmName(updatedFarmer);
    if (name && name !== "Farmer") {
      payload.farm_name = name;
      payload.business_name = name;
    }

    let nextPayload = { ...payload };

    for (let attempt = 0; attempt < 50; attempt += 1) {
      let query = supabase.from("farmers").update(nextPayload);

      if (farmerId) {
        query = query.or(
          `id.eq.${farmerId},farmer_id.eq.${farmerId},profile_id.eq.${farmerId},auth_user_id.eq.${farmerId}`
        );
      } else {
        query = query.or(
          `email.eq.${normalizeEmail(updatedFarmer.email)},farmer_email.eq.${normalizeEmail(
            updatedFarmer.email
          )}`
        );
      }

      const { error } = await query;

      if (!error) return;

      const msg = String(error.message || "");
      const missing =
        msg.match(/Could not find the '([^']+)' column/i)?.[1] ||
        msg.match(/column ['"]?([^'"]+)['"]? does not exist/i)?.[1] ||
        "";

      if (missing && Object.prototype.hasOwnProperty.call(nextPayload, missing)) {
        delete nextPayload[missing];
        continue;
      }

      console.log("farmers stripe update skipped:", error.message);
      return;
    }
  }

  async function openExternalUrl(url: string) {
    if (!url || !url.startsWith("http")) {
      Alert.alert("Stripe Error", "Invalid Stripe onboarding URL.");
      return;
    }

    if (Platform.OS === "web") {
      window.location.href = url;
      return;
    }

    const supported = await Linking.canOpenURL(url);

    if (supported) {
      await WebBrowser.openBrowserAsync(url);
    } else {
      Alert.alert("Open Error", "Unable to open Stripe onboarding link.");
    }
  }

  function normalizeStripeResponse(data: any, currentAccountId: string) {
    const account = data?.account || {};

    const accountId =
      data.accountId ||
      data.stripeAccountId ||
      data.stripe_account_id ||
      account.id ||
      currentAccountId ||
      "";

    const chargesEnabled = Boolean(
      data.chargesEnabled ||
        data.charges_enabled ||
        account.charges_enabled
    );

    const payoutsEnabled = Boolean(
      data.payoutsEnabled ||
        data.payouts_enabled ||
        account.payouts_enabled
    );

    const detailsSubmitted = Boolean(
      data.detailsSubmitted ||
        data.details_submitted ||
        data.onboardingComplete ||
        account.details_submitted
    );

    const externalAccount =
      data.externalAccount ||
      data.external_account ||
      data.payoutAccount ||
      data.payout_account ||
      account?.external_accounts?.data?.[0] ||
      null;

    const bankName = data.bankName || data.bank_name || externalAccount?.bank_name || "";
    const last4 =
      data.last4 ||
      data.accountLast4 ||
      data.payoutLast4 ||
      externalAccount?.last4 ||
      "";

    const payoutLabel =
      bankName && last4
        ? `${bankName} ****${last4}`
        : payoutsEnabled
        ? "Stripe Express payout account connected"
        : "";

    return {
      accountId,
      chargesEnabled,
      payoutsEnabled,
      detailsSubmitted,
      bankName,
      last4,
      payoutLabel,
    };
  }

  async function postJson(path: string, body: Record<string, any>) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await response.text();

    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Backend returned invalid response: ${text}`);
    }

    return { response, data };
  }

  async function checkStripeStatus(showAlert = true, farmerOverride?: FarmerProfile) {
    try {
      setLoading(true);

      const farmer = farmerOverride || (await getCurrentFarmer());

      if (!farmer) {
        Alert.alert("Farmer Session Required", "Please login or complete farmer registration first.");
        router.replace("/farmer/login" as any);
        return;
      }

      const stripeAccountId = getStripeAccountId(farmer);

      if (!stripeAccountId) {
        setStatus(farmer);

        if (showAlert) {
          Alert.alert(
            "Stripe Not Connected",
            "No Stripe account is saved for this farmer yet. Start Stripe onboarding."
          );
        }

        return;
      }

      const body = {
        role: "farmer",
        farmerId: getFarmerId(farmer),
        farmer_id: getFarmerId(farmer),
        email: normalizeEmail(farmer.email),
        farmer_email: normalizeEmail(farmer.email),
        stripeAccountId,
        stripe_account_id: stripeAccountId,
        farmer_account: stripeAccountId,
        accountId: stripeAccountId,
        account_id: stripeAccountId,
      };

      let result = await postJson("/payments/check-farmer-connect-account", body);

      if (result.response.status === 404) {
        result = await postJson("/payments/connect-account-status", body);
      }

      if (!result.response.ok) {
        throw new Error(
          result.data.error ||
            result.data.message ||
            "Unable to check Stripe status."
        );
      }

      const normalized = normalizeStripeResponse(result.data, stripeAccountId);

      const updatedFarmer: FarmerProfile = {
        ...farmer,
        id: getFarmerId(farmer),
        farmerId: getFarmerId(farmer),
        farmer_id: getFarmerId(farmer),

        stripeAccountId: normalized.accountId,
        farmerStripeAccountId: normalized.accountId,
        stripe_account_id: normalized.accountId,
        farmer_stripe_account_id: normalized.accountId,
        farmer_account: normalized.accountId,

        payoutsEnabled: normalized.payoutsEnabled,
        chargesEnabled: normalized.chargesEnabled,
        detailsSubmitted: normalized.detailsSubmitted,

        stripePayoutsEnabled: normalized.payoutsEnabled,
        stripeChargesEnabled: normalized.chargesEnabled,
        stripeOnboardingComplete: normalized.detailsSubmitted,

        stripe_payouts_enabled: normalized.payoutsEnabled,
        stripe_charges_enabled: normalized.chargesEnabled,
        stripe_onboarding_complete: normalized.detailsSubmitted,

        stripePayoutAccount: normalized.payoutLabel,
        stripePayoutAccountLast4: normalized.last4,
        stripePayoutBankName: normalized.bankName,

        stripe_payout_account: normalized.payoutLabel,
        stripe_payout_account_last4: normalized.last4,
        stripe_payout_bank_name: normalized.bankName,

        complianceStatus: normalized.payoutsEnabled ? "stripe_complete" : "stripe_pending",
        compliance_status: normalized.payoutsEnabled ? "stripe_complete" : "stripe_pending",
      };

      await safeUpdateFarmerInSupabase(updatedFarmer);
      const savedFarmer = await saveUpdatedFarmer(updatedFarmer);
      setStatus(savedFarmer);

      if (showAlert) {
        Alert.alert(
          normalized.payoutsEnabled ? "Stripe Ready" : "Stripe Pending",
          `Account: ${normalized.accountId}\nDetails Submitted: ${
            normalized.detailsSubmitted ? "YES" : "NO"
          }\nCharges Enabled: ${
            normalized.chargesEnabled ? "YES" : "NO"
          }\nPayouts Enabled: ${normalized.payoutsEnabled ? "YES" : "NO"}`
        );
      }
    } catch (error: any) {
      console.log("Stripe status check error:", error);
      Alert.alert("Stripe Status Error", error?.message || "Unable to check Stripe account.");
    } finally {
      setLoading(false);
    }
  }

  async function loadAndCheckStripeStatus() {
    try {
      setLoading(true);

      const farmer = await getCurrentFarmer();

      if (!farmer) {
        Alert.alert("Farmer Session Required", "Please login or complete farmer registration first.");
        router.replace("/farmer/login" as any);
        return;
      }

      setStatus(farmer);

      if (getStripeAccountId(farmer)) {
        await checkStripeStatus(false, farmer);
      }
    } catch (error: any) {
      console.log("Stripe status load error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function resumeOnboarding() {
    try {
      setLoading(true);

      const farmer = await getCurrentFarmer();

      if (!farmer) {
        Alert.alert("Farmer Session Required", "Please login again.");
        router.replace("/farmer/login" as any);
        return;
      }

      const farmerId = getFarmerId(farmer);
      const stripeAccountId = getStripeAccountId(farmer);

      const endpoints = stripeAccountId
        ? ["/payments/create-farmer-onboarding-link", "/payments/create-farmer-connect-account"]
        : ["/payments/create-farmer-connect-account"];

      let lastError = "";

      for (const endpoint of endpoints) {
        const { response, data } = await postJson(endpoint, {
          role: "farmer",
          farmerId,
          farmer_id: farmerId,
          email: normalizeEmail(farmer.email),
          farmer_email: normalizeEmail(farmer.email),
          farmName: getFarmName(farmer),
          farm_name: getFarmName(farmer),
          businessName: getFarmName(farmer),
          business_name: getFarmName(farmer),
          stripeAccountId,
          stripe_account_id: stripeAccountId,
          farmer_account: stripeAccountId,
          accountId: stripeAccountId,
          existingStripeAccountId: stripeAccountId,
        });

        if (!response.ok) {
          lastError = data.error || data.message || `Endpoint failed: ${endpoint}`;
          continue;
        }

        const onboardingUrl = data.onboardingUrl || data.url;
        const returnedAccountId =
          data.stripeAccountId ||
          data.stripe_account_id ||
          data.farmer_account ||
          data.accountId ||
          stripeAccountId ||
          "";

        if (!onboardingUrl) {
          lastError = "No Stripe onboarding URL returned.";
          continue;
        }

        if (returnedAccountId) {
          const updatedFarmer: FarmerProfile = {
            ...farmer,
            id: farmerId,
            farmerId,
            farmer_id: farmerId,
            stripeAccountId: returnedAccountId,
            farmerStripeAccountId: returnedAccountId,
            stripe_account_id: returnedAccountId,
            farmer_stripe_account_id: returnedAccountId,
            farmer_account: returnedAccountId,
            stripeOnboardingComplete: false,
            stripeChargesEnabled: false,
            stripePayoutsEnabled: false,
            detailsSubmitted: false,
            chargesEnabled: false,
            payoutsEnabled: false,
            complianceStatus: "stripe_pending",
            compliance_status: "stripe_pending",
          };

          await safeUpdateFarmerInSupabase(updatedFarmer);
          const savedFarmer = await saveUpdatedFarmer(updatedFarmer);
          setStatus(savedFarmer);
        }

        await openExternalUrl(onboardingUrl);
        return;
      }

      throw new Error(lastError || "Unable to create onboarding link.");
    } catch (error: any) {
      console.log("Resume onboarding error:", error);
      Alert.alert("Onboarding Error", error?.message || "Unable to resume Stripe onboarding.");
    } finally {
      setLoading(false);
    }
  }

  const fullyConnected =
    Boolean(status?.chargesEnabled || status?.stripeChargesEnabled) &&
    Boolean(status?.payoutsEnabled || status?.stripePayoutsEnabled) &&
    Boolean(status?.detailsSubmitted || status?.stripeOnboardingComplete);

  const accountId = getStripeAccountId(status);

  const payoutAccount =
    status?.stripePayoutAccount ||
    status?.stripe_payout_account ||
    "Not available";

  return (
    <View style={styles.page}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [styles.backCircle, pressed && styles.pressed]}
            onPress={() => router.push("/farmer/dashboard" as any)}
          >
            <Text style={styles.backCircleText}>‹</Text>
          </Pressable>

          <View style={styles.topTitleBlock}>
            <Text style={styles.title}>Payout Status</Text>
            <Text style={styles.subtitle}>Stripe Connect account readiness</Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Text style={styles.heroIconText}>💳</Text>
          </View>

          <View style={styles.heroTextBlock}>
            <Text style={styles.heroBadge}>Stripe Connect</Text>
            <Text style={styles.heroTitle}>
              {fullyConnected ? "Payouts are enabled" : "Finish payout setup"}
            </Text>
            <Text style={styles.heroText}>
              Verify your Stripe Express account so Farm2Home can send farmer marketplace payouts.
            </Text>
          </View>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusIcon, fullyConnected ? styles.statusGoodBg : styles.statusBadBg]}>
              <Text style={styles.statusIconText}>{fullyConnected ? "✅" : "⚠️"}</Text>
            </View>

            <View style={styles.statusBody}>
              <Text style={styles.statusTitle}>
                {fullyConnected ? "Farmer payouts fully enabled" : "Stripe onboarding incomplete"}
              </Text>

              <Text style={styles.statusText}>
                {accountId ? `Account: ${accountId}` : "Account: Not connected"}
              </Text>

              <Text style={styles.statusText}>
                Farmer: {status ? getFarmName(status) : "Not loaded"}
              </Text>

              <Text style={styles.statusText}>
                Email: {status?.email || status?.farmer_email || "Not loaded"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account Checklist</Text>

          <StatusRow label="Stripe Account" value={accountId || "Not connected"} passed={Boolean(accountId)} />

          <StatusRow
            label="Details Submitted"
            value={status?.detailsSubmitted || status?.stripeOnboardingComplete ? "Complete" : "Incomplete"}
            passed={Boolean(status?.detailsSubmitted || status?.stripeOnboardingComplete)}
          />

          <StatusRow
            label="Charges Enabled"
            value={status?.chargesEnabled || status?.stripeChargesEnabled ? "Enabled" : "Not enabled"}
            passed={Boolean(status?.chargesEnabled || status?.stripeChargesEnabled)}
          />

          <StatusRow
            label="Payouts Enabled"
            value={status?.payoutsEnabled || status?.stripePayoutsEnabled ? "Enabled" : "Not enabled"}
            passed={Boolean(status?.payoutsEnabled || status?.stripePayoutsEnabled)}
          />

          <StatusRow
            label="Payout Account"
            value={payoutAccount}
            passed={payoutAccount !== "Not available"}
          />
        </View>

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.pressed, loading && styles.disabled]}
          onPress={() => checkStripeStatus(true)}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Refresh Stripe Status</Text>}
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed, loading && styles.disabled]}
          onPress={resumeOnboarding}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>
            {accountId ? "Resume Stripe Onboarding" : "Start Stripe Onboarding"}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
          onPress={() => router.push("/farmer/compliance-upload" as any)}
        >
          <Text style={styles.linkText}>Back To Compliance</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
          onPress={() => router.push("/farmer/dashboard" as any)}
        >
          <Text style={styles.linkText}>Continue To Dashboard</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function StatusRow({
  label,
  value,
  passed,
}: {
  label: string;
  value: string;
  passed: boolean;
}) {
  return (
    <View style={styles.rowCard}>
      <View style={styles.rowIcon}>
        <Text style={styles.rowIconText}>{passed ? "✅" : "❌"}</Text>
      </View>

      <View style={styles.rowTextBlock}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 18,
    paddingBottom: 44,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    gap: 12,
  },
  backCircle: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backCircleText: {
    fontSize: 34,
    color: COLORS.text,
    fontWeight: "900",
    marginTop: -4,
  },
  topTitleBlock: {
    flex: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: COLORS.text,
  },
  subtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3,
  },
  heroCard: {
    backgroundColor: COLORS.stripe,
    borderRadius: 32,
    padding: 20,
    marginBottom: 16,
    flexDirection: "row",
    gap: 14,
  },
  heroIcon: {
    width: 70,
    height: 70,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  heroIconText: {
    fontSize: 34,
  },
  heroTextBlock: {
    flex: 1,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    color: "#FFFFFF",
    fontWeight: "900",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 10,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "900",
    lineHeight: 31,
  },
  heroText: {
    color: "#F4F2FF",
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 8,
  },
  statusCard: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  statusIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  statusGoodBg: {
    backgroundColor: COLORS.softGreen,
  },
  statusBadBg: {
    backgroundColor: "#FEF3C7",
  },
  statusIconText: {
    fontSize: 29,
  },
  statusBody: {
    flex: 1,
  },
  statusTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "900",
  },
  statusText: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 5,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 14,
  },
  rowCard: {
    backgroundColor: COLORS.lightGreen,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 13,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
  },
  rowIconText: {
    fontSize: 21,
  },
  rowTextBlock: {
    flex: 1,
  },
  rowLabel: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 15,
  },
  rowValue: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3,
  },
  button: {
    backgroundColor: COLORS.stripe,
    padding: 17,
    borderRadius: 20,
    alignItems: "center",
    marginBottom: 12,
  },
  secondaryButton: {
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.stripe,
    padding: 16,
    borderRadius: 20,
    alignItems: "center",
    marginBottom: 14,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  secondaryButtonText: {
    color: COLORS.stripe,
    fontWeight: "900",
    fontSize: 16,
  },
  linkButton: {
    padding: 12,
    alignItems: "center",
  },
  linkText: {
    color: COLORS.primary,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.6,
  },
});