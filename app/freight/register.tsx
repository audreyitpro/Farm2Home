// app/freight/register.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
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
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  "https://farm2home-production-e4bd.up.railway.app";

const APP_URL =
  process.env.EXPO_PUBLIC_APP_URL || "https://farm2home-rho.vercel.app";

const COLORS = {
  bg: "#F3F4F6",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  green: "#16A34A",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  amber: "#D97706",
};

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your mother’s maiden name?",
  "What was the name of your elementary school?",
  "What was your first car?",
  "What is your favorite food?",
  "What was the name of your childhood best friend?",
  "What street did you grow up on?",
  "What is your favorite teacher’s name?",
  "What was your first delivery vehicle?",
];

function clean(value: any) {
  return String(value || "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function normalizeAnswer(value: any) {
  return normalize(value);
}

function isStripeCustomerId(value: any) {
  return clean(value).startsWith("cus_");
}

function isStripeSubscriptionId(value: any) {
  return clean(value).startsWith("sub_");
}

function isStripeConnectAccountId(value: any) {
  return clean(value).startsWith("acct_");
}

function pickStripeCustomerId(...values: any[]) {
  const found = values.find((value) => isStripeCustomerId(value));
  return found ? clean(found) : "";
}

function pickStripeSubscriptionId(...values: any[]) {
  const found = values.find((value) => isStripeSubscriptionId(value));
  return found ? clean(found) : "";
}

function pickStripeConnectAccountId(...values: any[]) {
  const found = values.find((value) => isStripeConnectAccountId(value));
  return found ? clean(found) : "";
}

function keepValue(newValue: any, oldValue: any) {
  const cleaned = String(newValue ?? "").trim();
  return cleaned.length > 0 ? newValue : oldValue;
}

function makeFallbackAccountId() {
  return `Freight_${Date.now()}`;
}

async function saveFreightSession(carrier: any) {
  await AsyncStorage.setItem("pendingFreightCarrier", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentFreight", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentFreightUser", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentUser", JSON.stringify(carrier));
  await AsyncStorage.setItem("userRole", "freight");
  await AsyncStorage.setItem("currentUserRole", "freight");
}

export default function FreightRegister() {
  const params = useLocalSearchParams();

  const [saving, setSaving] = useState(false);
  const [syncingStripe, setSyncingStripe] = useState(false);
  const [processingReturn, setProcessingReturn] = useState(false);

  const [savedCarrierId, setSavedCarrierId] = useState("");
  const [freightId, setFreightId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [stripeCustomerId, setStripeCustomerId] = useState("");
  const [freightAccount, setFreightAccount] = useState("");
  const [subscriptionId, setSubscriptionId] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceArea, setServiceArea] = useState("");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [securityQuestion1, setSecurityQuestion1] = useState("");
  const [securityAnswer1, setSecurityAnswer1] = useState("");
  const [securityQuestion2, setSecurityQuestion2] = useState("");
  const [securityAnswer2, setSecurityAnswer2] = useState("");
  const [securityQuestion3, setSecurityQuestion3] = useState("");
  const [securityAnswer3, setSecurityAnswer3] = useState("");
  const [hasSavedSecurityAnswer1, setHasSavedSecurityAnswer1] = useState(false);
  const [hasSavedSecurityAnswer2, setHasSavedSecurityAnswer2] = useState(false);
  const [hasSavedSecurityAnswer3, setHasSavedSecurityAnswer3] = useState(false);

  const [businessAddress, setBusinessAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateValue, setStateValue] = useState("");
  const [zipCode, setZipCode] = useState("");

  const [mdotNumber, setMdotNumber] = useState("");
  const [mcNumber, setMcNumber] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState("");

  const [authorityActive, setAuthorityActive] = useState(false);
  const [insuranceActive, setInsuranceActive] = useState(false);
  const [licensedLivestock, setLicensedLivestock] = useState(false);
  const [licensedRefrigeratedFood, setLicensedRefrigeratedFood] =
    useState(false);

  const selectedQuestions = useMemo(
    () =>
      [securityQuestion1, securityQuestion2, securityQuestion3].filter(Boolean),
    [securityQuestion1, securityQuestion2, securityQuestion3]
  );

  const hasActiveSubscription = useMemo(() => {
    return Boolean(
      isStripeSubscriptionId(subscriptionId) &&
        ["active", "trialing", "past_due"].includes(
          normalize(subscriptionStatus || "active")
        )
    );
  }, [subscriptionId, subscriptionStatus]);

  const hasStripeConnectAccount = useMemo(() => {
    return isStripeConnectAccountId(freightAccount);
  }, [freightAccount]);

  const registrationReadyForDashboard = useMemo(() => {
    return Boolean(hasActiveSubscription && hasStripeConnectAccount);
  }, [hasActiveSubscription, hasStripeConnectAccount]);

  useEffect(() => {
    loadSavedFreight();
  }, []);

  useEffect(() => {
    const stripeStatus = String(params?.stripe || params?.payment || "");
    const returnedFreightId = String(
      params?.freightId || params?.freight_id || ""
    );

    if (stripeStatus === "success") {
      handleStripeSuccessReturn(returnedFreightId);
    }
  }, [params?.stripe, params?.payment, params?.freightId, params?.freight_id]);

  async function forceRefreshFreightRegister() {
    try {
      setSyncingStripe(true);

      await AsyncStorage.removeItem("pendingFreightCarrier");
      await AsyncStorage.removeItem("currentFreightCarrier");
      await AsyncStorage.removeItem("currentFreight");
      await AsyncStorage.removeItem("currentFreightUser");
      await AsyncStorage.removeItem("currentUser");

      await supabase.auth.refreshSession();
      await loadSavedFreight();

      Alert.alert("Updated", "Freight registration refreshed from Supabase.");
    } catch (error: any) {
      Alert.alert("Refresh Error", error?.message || "Unable to refresh registration.");
    } finally {
      setSyncingStripe(false);
    }
  }

  async function handleStripeSuccessReturn(returnedFreightId?: string) {
    if (processingReturn) return;

    try {
      setProcessingReturn(true);

      if (returnedFreightId) {
        setSavedCarrierId(returnedFreightId);
        setFreightId(returnedFreightId);
      }

      await loadSavedFreight();

      const synced = await forceSyncFreightSubscription(true, returnedFreightId);

      const syncedSubscriptionId = pickStripeSubscriptionId(
        synced?.stripeSubscriptionId,
        synced?.stripe_subscription_id,
        synced?.subscriptionId,
        synced?.subscription_id
      );

      if (!syncedSubscriptionId) {
        Alert.alert(
          "Payment Processing",
          "Stripe payment completed, but the subscription is still syncing. Tap Find / Retrieve Missing Stripe Info."
        );
        return;
      }

      await markApplicationSubmittedAndOpenDashboard(
        returnedFreightId || savedCarrierId || freightId,
        {
          stripeCustomerId: pickStripeCustomerId(
            synced?.stripeCustomerId,
            synced?.stripe_customer_id
          ),
          stripeSubscriptionId: syncedSubscriptionId,
          subscriptionStatus:
            synced?.subscriptionStatus ||
            synced?.subscription_status ||
            "active",
        }
      );
    } catch (error: any) {
      Alert.alert(
        "Stripe Return Error",
        error?.message || "Unable to complete freight registration."
      );
    } finally {
      setProcessingReturn(false);
    }
  }

  async function loadSavedFreight() {
    try {
      const saved =
        (await AsyncStorage.getItem("currentFreightCarrier")) ||
        (await AsyncStorage.getItem("currentFreight")) ||
        (await AsyncStorage.getItem("currentFreightUser"));

      let localCarrier: any = null;

      if (saved) {
        localCarrier = JSON.parse(saved);
        hydrateForm(localCarrier);
      }

      const { data: authData } = await supabase.auth.getUser();
      const authEmail = normalize(
        authData?.user?.email || localCarrier?.email || email
      );

      if (!authEmail) return;

      const { data: dbCarrier, error } = await supabase
        .from("freight_users")
        .select("*")
        .eq("email", authEmail)
        .maybeSingle();

      if (error) {
        console.log("LOAD FREIGHT DB ERROR:", error.message);
        return;
      }

      if (dbCarrier?.id) {
        let subscriptionRow: any = null;

        const { data: subData } = await supabase
          .from("freight_subscriptions")
          .select("*")
          .or(`freight_id.eq.${dbCarrier.id},freight_email.eq.${normalize(dbCarrier.email)}`)
          .maybeSingle();

        if (subData) subscriptionRow = subData;

        const merged = {
          ...dbCarrier,
          stripe_customer_id: pickStripeCustomerId(
            dbCarrier.stripe_customer_id,
            subscriptionRow?.stripe_customer_id
          ),
          stripe_subscription_id: pickStripeSubscriptionId(
            dbCarrier.stripe_subscription_id,
            dbCarrier.subscription_id,
            subscriptionRow?.stripe_subscription_id
          ),
          subscription_id: pickStripeSubscriptionId(
            dbCarrier.subscription_id,
            dbCarrier.stripe_subscription_id,
            subscriptionRow?.stripe_subscription_id
          ),
          subscription_status:
            dbCarrier.subscription_status ||
            subscriptionRow?.subscription_status ||
            "",
          freight_account: pickStripeConnectAccountId(
            dbCarrier.freight_account,
            subscriptionRow?.freight_account,
            dbCarrier.stripe_account_id,
            subscriptionRow?.stripe_account_id
          ),
        };

        hydrateForm(merged);
        await saveHydratedSession(merged);
      }
    } catch (error) {
      console.log("LOAD FREIGHT SESSION ERROR:", error);
    }
  }

  async function saveHydratedSession(carrier: any) {
    const connectAccount = pickStripeConnectAccountId(
      carrier.freight_account,
      carrier.freightAccount,
      carrier.stripe_account_id,
      carrier.stripeAccountId
    );

    await saveFreightSession({
      ...carrier,
      id: carrier.id,
      freightId: carrier.freight_id || carrier.id,
      freight_id: carrier.freight_id || carrier.id,
      accountId: carrier.account_id || "",
      account_id: carrier.account_id || "",
      companyName: carrier.company_name || carrier.business_name || "",
      company_name: carrier.company_name || carrier.business_name || "",
      businessName: carrier.business_name || carrier.company_name || "",
      business_name: carrier.business_name || carrier.company_name || "",
      contactName: carrier.contact_name || carrier.name || "",
      contact_name: carrier.contact_name || carrier.name || "",
      stripeCustomerId: pickStripeCustomerId(
        carrier.stripe_customer_id,
        carrier.stripeCustomerId
      ),
      stripe_customer_id: pickStripeCustomerId(
        carrier.stripe_customer_id,
        carrier.stripeCustomerId
      ),
      freightAccount: connectAccount,
      freight_account: connectAccount,
      stripeAccountId: connectAccount,
      stripe_account_id: connectAccount,
      stripeSubscriptionId: pickStripeSubscriptionId(
        carrier.stripe_subscription_id,
        carrier.subscription_id
      ),
      stripe_subscription_id: pickStripeSubscriptionId(
        carrier.stripe_subscription_id,
        carrier.subscription_id
      ),
      subscriptionId: pickStripeSubscriptionId(
        carrier.subscription_id,
        carrier.stripe_subscription_id
      ),
      subscription_id: pickStripeSubscriptionId(
        carrier.subscription_id,
        carrier.stripe_subscription_id
      ),
      subscriptionStatus: carrier.subscription_status || "",
      role: "freight",
    });
  }

  function hydrateStripeOnly(row: any) {
    const rowCustomerId = pickStripeCustomerId(
      row.stripe_customer_id,
      row.stripeCustomerId,
      stripeCustomerId
    );

    const rowSubscriptionId = pickStripeSubscriptionId(
      row.stripe_subscription_id,
      row.subscription_id,
      subscriptionId
    );

    const rowFreightAccount = pickStripeConnectAccountId(
      row.freight_account,
      row.freightAccount,
      row.stripe_account_id,
      row.stripeAccountId,
      freightAccount
    );

    setStripeCustomerId(rowCustomerId);
    setSubscriptionId(rowSubscriptionId);
    setSubscriptionStatus(row.subscription_status || subscriptionStatus || "");
    setFreightAccount(rowFreightAccount);

    if (row.account_id) setAccountId(row.account_id);

    if (row.id) {
      setFreightId(row.id);
      setSavedCarrierId(row.id);
    }
  }

  function hydrateForm(carrier: any) {
    const dbFreightId =
      carrier.id || carrier.freightId || carrier.freight_id || "";

    const dbStripeCustomerId = pickStripeCustomerId(
      carrier.stripe_customer_id,
      carrier.stripeCustomerId
    );

    const dbSubscriptionId = pickStripeSubscriptionId(
      carrier.subscriptionId,
      carrier.subscription_id,
      carrier.stripeSubscriptionId,
      carrier.stripe_subscription_id
    );

    const dbFreightAccount = pickStripeConnectAccountId(
      carrier.freight_account,
      carrier.freightAccount,
      carrier.stripe_account_id,
      carrier.stripeAccountId
    );

    setFreightId(dbFreightId);
    setSavedCarrierId(dbFreightId);
    setAccountId(carrier.accountId || carrier.account_id || "");
    setStripeCustomerId(dbStripeCustomerId);
    setSubscriptionId(dbSubscriptionId);
    setSubscriptionStatus(
      carrier.subscriptionStatus || carrier.subscription_status || ""
    );
    setFreightAccount(dbFreightAccount);

    setCompanyName(
      carrier.companyName || carrier.company_name || carrier.business_name || ""
    );
    setContactName(
      carrier.contactName ||
        carrier.contact_name ||
        carrier.full_name ||
        carrier.name ||
        ""
    );
    setEmail(carrier.email || "");
    setPhone(carrier.phone || "");
    setUsername(carrier.username || "");
    setServiceArea(carrier.serviceArea || carrier.service_area || "");

    setBusinessAddress(carrier.businessAddress || carrier.business_address || "");
    setCity(carrier.city || "");
    setStateValue(carrier.state || "");
    setZipCode(carrier.zipCode || carrier.zip_code || "");

    setMdotNumber(
      carrier.mdotNumber || carrier.mdot_number || carrier.dot_number || ""
    );
    setMcNumber(carrier.mcNumber || carrier.mc_number || "");
    setInsuranceProvider(
      carrier.insuranceProvider || carrier.insurance_provider || ""
    );
    setInsurancePolicyNumber(
      carrier.insurancePolicyNumber || carrier.insurance_policy_number || ""
    );

    setAuthorityActive(Boolean(carrier.authorityActive || carrier.authority_active));
    setInsuranceActive(Boolean(carrier.insuranceActive || carrier.insurance_active));
    setLicensedLivestock(
      Boolean(carrier.licensedLivestock || carrier.licensed_livestock)
    );
    setLicensedRefrigeratedFood(
      Boolean(
        carrier.licensedRefrigeratedFood || carrier.licensed_refrigerated_food
      )
    );

    setSecurityQuestion1(
      carrier.security_question_1 || carrier.securityQuestion1 || ""
    );
    setSecurityQuestion2(
      carrier.security_question_2 || carrier.securityQuestion2 || ""
    );
    setSecurityQuestion3(
      carrier.security_question_3 || carrier.securityQuestion3 || ""
    );

    setHasSavedSecurityAnswer1(
      Boolean(carrier.security_answer_1 || carrier.securityAnswer1)
    );
    setHasSavedSecurityAnswer2(
      Boolean(carrier.security_answer_2 || carrier.securityAnswer2)
    );
    setHasSavedSecurityAnswer3(
      Boolean(carrier.security_answer_3 || carrier.securityAnswer3)
    );
  }

  function buildPreservedCarrier(row: any) {
    const pickedCustomerId = pickStripeCustomerId(
      row.stripe_customer_id,
      row.stripeCustomerId,
      stripeCustomerId
    );

    const pickedSubscriptionId = pickStripeSubscriptionId(
      row.stripe_subscription_id,
      row.subscription_id,
      subscriptionId
    );

    const pickedFreightAccount = pickStripeConnectAccountId(
      row.freight_account,
      row.freightAccount,
      row.stripe_account_id,
      row.stripeAccountId,
      freightAccount
    );

    return {
      ...row,
      id: row.id || savedCarrierId || freightId,
      freight_id: row.freight_id || row.id || savedCarrierId || freightId,
      account_id: keepValue(row.account_id, accountId),
      company_name: keepValue(companyName, row.company_name),
      business_name: keepValue(companyName, row.business_name),
      contact_name: keepValue(contactName, row.contact_name),
      full_name: keepValue(contactName, row.full_name),
      name: keepValue(contactName, row.name),
      email: keepValue(email, row.email),
      phone: keepValue(phone, row.phone),
      username: keepValue(username, row.username),
      service_area: keepValue(serviceArea, row.service_area),
      business_address: keepValue(businessAddress, row.business_address),
      city: keepValue(city, row.city),
      state: keepValue(stateValue, row.state),
      zip_code: keepValue(zipCode, row.zip_code),
      mdot_number: keepValue(mdotNumber, row.mdot_number),
      dot_number: keepValue(mdotNumber, row.dot_number),
      mc_number: keepValue(mcNumber, row.mc_number),
      insurance_provider: keepValue(insuranceProvider, row.insurance_provider),
      insurance_policy_number: keepValue(
        insurancePolicyNumber,
        row.insurance_policy_number
      ),
      authority_active: authorityActive || Boolean(row.authority_active),
      insurance_active: insuranceActive || Boolean(row.insurance_active),
      licensed_livestock: licensedLivestock || Boolean(row.licensed_livestock),
      licensed_refrigerated_food:
        licensedRefrigeratedFood ||
        Boolean(row.licensed_refrigerated_food),
      security_question_1: keepValue(
        securityQuestion1,
        row.security_question_1
      ),
      security_question_2: keepValue(
        securityQuestion2,
        row.security_question_2
      ),
      security_question_3: keepValue(
        securityQuestion3,
        row.security_question_3
      ),
      security_answer_1: securityAnswer1
        ? normalizeAnswer(securityAnswer1)
        : row.security_answer_1,
      security_answer_2: securityAnswer2
        ? normalizeAnswer(securityAnswer2)
        : row.security_answer_2,
      security_answer_3: securityAnswer3
        ? normalizeAnswer(securityAnswer3)
        : row.security_answer_3,
      stripe_customer_id: pickedCustomerId,
      stripe_subscription_id: pickedSubscriptionId,
      subscription_id: pickedSubscriptionId,
      freight_account: pickedFreightAccount,
      stripe_account_id: pickedFreightAccount,
      subscription_status: row.subscription_status || subscriptionStatus || "",
    };
  }

  function validateForm() {
    if (
      !companyName.trim() ||
      !contactName.trim() ||
      !normalize(email) ||
      !phone.trim()
    ) {
      Alert.alert(
        "Missing Info",
        "Company, contact, email, and phone are required."
      );
      return false;
    }

    if (!normalize(email).includes("@")) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return false;
    }

    if (
      !savedCarrierId &&
      (!username.trim() || !password.trim() || !confirmPassword.trim())
    ) {
      Alert.alert("Login Required", "Please create a username and password.");
      return false;
    }

    if (normalize(username).length < 4) {
      Alert.alert("Invalid Username", "Username must be at least 4 characters.");
      return false;
    }

    if (!savedCarrierId && password.trim().length < 6) {
      Alert.alert("Weak Password", "Password must be at least 6 characters.");
      return false;
    }

    if (!savedCarrierId && password.trim() !== confirmPassword.trim()) {
      Alert.alert("Password Mismatch", "Passwords do not match.");
      return false;
    }

    if (selectedQuestions.length !== 3 || new Set(selectedQuestions).size !== 3) {
      Alert.alert(
        "Security Questions Required",
        "Please choose 3 different security questions."
      );
      return false;
    }

    const missingSecurityAnswers =
      (!securityAnswer1.trim() && !hasSavedSecurityAnswer1) ||
      (!securityAnswer2.trim() && !hasSavedSecurityAnswer2) ||
      (!securityAnswer3.trim() && !hasSavedSecurityAnswer3);

    if (missingSecurityAnswers) {
      Alert.alert(
        "Security Answers Required",
        "Please answer all 3 security questions. Saved accounts may leave an answer blank only when an answer is already on file."
      );
      return false;
    }

    if (
      !businessAddress.trim() ||
      !city.trim() ||
      !stateValue.trim() ||
      !zipCode.trim()
    ) {
      Alert.alert(
        "Missing Address",
        "Business address, city, state, and zip code are required."
      );
      return false;
    }

    if (!mdotNumber.trim() || !mcNumber.trim()) {
      Alert.alert("Missing Authority", "MDOT number and MC number are required.");
      return false;
    }

    if (!insuranceProvider.trim() || !insurancePolicyNumber.trim()) {
      Alert.alert(
        "Missing Insurance",
        "Insurance provider and policy number are required."
      );
      return false;
    }

    if (!authorityActive || !insuranceActive) {
      Alert.alert(
        "Verification Required",
        "Confirm active authority and insurance."
      );
      return false;
    }

    if (!licensedLivestock && !licensedRefrigeratedFood) {
      Alert.alert(
        "License Required",
        "Select livestock, refrigerated food, or both."
      );
      return false;
    }

    return true;
  }

  async function generateFreightAccountId() {
    const { data, error } = await supabase.rpc("next_account_id", {
      p_role: "freight",
      p_prefix: "Freight",
    });

    if (error) return makeFallbackAccountId();
    return data ? String(data) : makeFallbackAccountId();
  }

  async function checkDuplicateFreight(
    cleanEmailValue: string,
    cleanUsername: string
  ) {
    const filters = [
      `email.eq.${cleanEmailValue}`,
      `username.eq.${cleanUsername}`,
      stripeCustomerId ? `stripe_customer_id.eq.${stripeCustomerId}` : "",
    ]
      .filter(Boolean)
      .join(",");

    const { data, error } = await supabase
      .from("freight_users")
      .select("*")
      .or(filters)
      .limit(1);

    if (error) return null;
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  }

  async function syncStripeByEmail(targetEmail?: string, silent = false) {
    const finalEmail = normalize(targetEmail || email);
    const finalBusinessName = companyName.trim();
    const finalUsername = normalize(username);
    const finalId = savedCarrierId || freightId;

    if (!finalEmail && !finalBusinessName && !finalUsername && !finalId) {
      if (!silent)
        Alert.alert(
          "Search Required",
          "Enter email, business name, or username first."
        );
      return null;
    }

    try {
      setSyncingStripe(true);

      const response = await fetch(`${API_BASE_URL}/payments/sync-stripe-by-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "freight",
          email: finalEmail,
          businessName: finalBusinessName,
          companyName: finalBusinessName,
          name: finalBusinessName,
          username: finalUsername,
          userId: finalId,
          freightId: finalId,
          freight_id: finalId,
        }),
      });

      const text = await response.text();
      let json: any = {};

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { success: false, error: text };
      }

      if (!response.ok || !json.success) {
        if (!silent) {
          Alert.alert(
            "Stripe Sync Not Found",
            json.error || "No Stripe customer/subscription was found."
          );
        }
        return null;
      }

      const syncedCustomerId = pickStripeCustomerId(
        json.stripeCustomerId,
        json.stripe_customer_id
      );
      const syncedSubscriptionId = pickStripeSubscriptionId(
        json.stripeSubscriptionId,
        json.stripe_subscription_id
      );
      const syncedFreightAccount = pickStripeConnectAccountId(
        json.freight_account,
        json.stripeAccountId,
        json.stripe_account_id
      );

      if (syncedCustomerId) setStripeCustomerId(syncedCustomerId);
      if (syncedSubscriptionId) setSubscriptionId(syncedSubscriptionId);
      if (json.subscriptionStatus || json.subscription_status) {
        setSubscriptionStatus(json.subscriptionStatus || json.subscription_status || "");
      }
      if (syncedFreightAccount) setFreightAccount(syncedFreightAccount);

      if (json.updatedRows?.[0]) {
        const preserved = buildPreservedCarrier(json.updatedRows[0]);
        hydrateStripeOnly(preserved);
        await saveHydratedSession(preserved);
      }

      if (!silent) {
        Alert.alert(
          "Stripe Synced",
          "Stripe customer/subscription information was saved."
        );
      }

      return json;
    } catch (error: any) {
      if (!silent)
        Alert.alert("Stripe Sync Error", error?.message || "Unable to sync Stripe.");
      return null;
    } finally {
      setSyncingStripe(false);
    }
  }

  async function forceSyncFreightSubscription(
    silent = false,
    overrideId?: string
  ) {
    const finalEmail = normalize(email);
    const finalBusinessName = companyName.trim();
    const finalUsername = normalize(username);
    const finalId = overrideId || savedCarrierId || freightId;

    if (!finalEmail && !finalBusinessName && !finalUsername && !finalId) {
      if (!silent)
        Alert.alert(
          "Missing Info",
          "Enter your email, business name, or username first."
        );
      return null;
    }

    try {
      setSyncingStripe(true);

      const response = await fetch(
        `${API_BASE_URL}/payments/force-sync-freight-subscription`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "freight",
            email: finalEmail,
            businessName: finalBusinessName,
            companyName: finalBusinessName,
            name: finalBusinessName,
            username: finalUsername,
            freightId: finalId,
            freight_id: finalId,
            userId: finalId,
          }),
        }
      );

      const text = await response.text();
      let json: any = {};

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { success: false, error: text };
      }

      if (!response.ok || !json.success) {
        if (!silent) {
          Alert.alert(
            "Stripe Sync Failed",
            json.error || "No paid freight subscription was found."
          );
        }
        return null;
      }

      const syncedCustomerId = pickStripeCustomerId(
        json.stripeCustomerId,
        json.stripe_customer_id
      );
      const syncedSubscriptionId = pickStripeSubscriptionId(
        json.stripeSubscriptionId,
        json.stripe_subscription_id
      );
      const syncedFreightAccount = pickStripeConnectAccountId(
        json.freight_account,
        json.stripeAccountId,
        json.stripe_account_id
      );
      const syncedStatus =
        json.subscriptionStatus || json.subscription_status || "active";

      if (syncedCustomerId) setStripeCustomerId(syncedCustomerId);
      if (syncedSubscriptionId) setSubscriptionId(syncedSubscriptionId);
      if (syncedFreightAccount) setFreightAccount(syncedFreightAccount);
      setSubscriptionStatus(syncedStatus);

      if (json.updatedRows?.[0]) {
        const preserved = buildPreservedCarrier(json.updatedRows[0]);
        hydrateStripeOnly(preserved);
        await saveHydratedSession(preserved);
      }

      if (!silent) {
        Alert.alert(
          "Subscription Restored",
          "Your paid freight subscription was saved to Supabase."
        );
      }

      return json;
    } catch (error: any) {
      if (!silent)
        Alert.alert(
          "Force Sync Error",
          error?.message || "Unable to restore subscription."
        );
      return null;
    } finally {
      setSyncingStripe(false);
    }
  }

  async function saveFreightUserRow(carrierId: string, savedAccountId?: string) {
    const now = new Date().toISOString();

    const { data: existingFreightUser, error: existingError } = await supabase
      .from("freight_users")
      .select("*")
      .eq("id", carrierId)
      .maybeSingle();

    if (existingError) throw existingError;

    const cleanCompanyName = companyName.trim();
    const cleanContactName = contactName.trim();
    const cleanEmailValue = normalize(email);
    const cleanPhone = phone.trim();
    const cleanUsername = normalize(username);

    const finalAccountId =
      existingFreightUser?.account_id ||
      savedAccountId ||
      accountId ||
      (await generateFreightAccountId());

    const finalStripeCustomerId = pickStripeCustomerId(
      stripeCustomerId,
      existingFreightUser?.stripe_customer_id
    );

    const finalSubscriptionId = pickStripeSubscriptionId(
      subscriptionId,
      existingFreightUser?.stripe_subscription_id,
      existingFreightUser?.subscription_id
    );

    const finalFreightAccount = pickStripeConnectAccountId(
      freightAccount,
      existingFreightUser?.freight_account,
      existingFreightUser?.stripe_account_id
    );

    const finalSubscriptionStatus =
      subscriptionStatus ||
      existingFreightUser?.subscription_status ||
      (finalSubscriptionId ? "active" : "pending_payment");

    const freightPayload: any = {
      id: carrierId,
      account_id: finalAccountId,
      freight_id: carrierId,
      profile_id: carrierId,
      auth_user_id: carrierId,
      role: "freight",

      company_name: cleanCompanyName,
      business_name: cleanCompanyName,
      contact_name: cleanContactName,
      full_name: cleanContactName,
      name: cleanContactName,
      owner_name: cleanContactName,
      email: cleanEmailValue,
      phone: cleanPhone,
      username: cleanUsername,

      account_active: true,

      stripe_customer_id: finalStripeCustomerId || null,
      stripe_subscription_id: finalSubscriptionId || null,
      subscription_id: finalSubscriptionId || null,
      freight_account: finalFreightAccount || null,
      stripe_account_id: finalFreightAccount || null,

      stripe_connect_status: finalFreightAccount ? "started" : "not_started",
      payouts_enabled: existingFreightUser?.payouts_enabled || false,
      charges_enabled: existingFreightUser?.charges_enabled || false,
      stripe_payouts_enabled: existingFreightUser?.stripe_payouts_enabled || false,
      stripe_charges_enabled: existingFreightUser?.stripe_charges_enabled || false,
      stripe_onboarding_complete:
        existingFreightUser?.stripe_onboarding_complete || false,

      security_question_1: securityQuestion1,
      security_question_2: securityQuestion2,
      security_question_3: securityQuestion3,
      security_answer_1: securityAnswer1.trim()
        ? normalizeAnswer(securityAnswer1)
        : existingFreightUser?.security_answer_1 || null,
      security_answer_2: securityAnswer2.trim()
        ? normalizeAnswer(securityAnswer2)
        : existingFreightUser?.security_answer_2 || null,
      security_answer_3: securityAnswer3.trim()
        ? normalizeAnswer(securityAnswer3)
        : existingFreightUser?.security_answer_3 || null,

      service_area: serviceArea.trim(),
      business_address: businessAddress.trim(),
      city: city.trim(),
      state: stateValue.trim().toUpperCase(),
      zip_code: zipCode.trim(),

      mdot_number: mdotNumber.trim(),
      dot_number: mdotNumber.trim(),
      mc_number: mcNumber.trim(),
      insurance_provider: insuranceProvider.trim(),
      insurance_policy_number: insurancePolicyNumber.trim(),
      authority_active: authorityActive,
      insurance_active: insuranceActive,
      licensed_livestock: licensedLivestock,
      licensed_refrigerated_food: licensedRefrigeratedFood,

      approved: true,
      verification_status: finalSubscriptionId ? "SUBMITTED" : "REGISTERED",
      compliance_status: finalSubscriptionId ? "SUBMITTED" : "PENDING_PAYMENT",
      admin_review_status: finalSubscriptionId ? "submitted" : "pending_payment",

      membership_status: finalSubscriptionId ? "active" : "pending_payment",
      subscription_status: finalSubscriptionStatus,
      freight_membership_paid: Boolean(finalSubscriptionId),

      application_submitted: Boolean(finalSubscriptionId),
      submitted_at: finalSubscriptionId ? now : existingFreightUser?.submitted_at || null,

      push_notifications: true,
      new_load_alerts: true,
      route_status_alerts: true,
      payout_alerts: true,
      billing_alerts: true,
      gps_tracking: true,
      background_route_updates: false,
      show_only_nearby_loads: false,
      show_refrigerated_loads: true,
      show_livestock_loads: true,
      privacy_mode: false,
      notifications_enabled: true,
      expo_push_token: existingFreightUser?.expo_push_token || "",

      updated_at: now,
    };

    await supabase.from("profiles").upsert(
      {
        id: carrierId,
        auth_user_id: carrierId,
        profile_id: carrierId,
        account_id: finalAccountId,
        role: "freight",
        full_name: cleanContactName,
        name: cleanContactName,
        email: cleanEmailValue,
        phone: cleanPhone,
        username: cleanUsername,
        company_name: cleanCompanyName,
        stripe_customer_id: finalStripeCustomerId || null,
        stripe_subscription_id: finalSubscriptionId || null,
        subscription_id: finalSubscriptionId || null,
        freight_account: finalFreightAccount || null,
        stripe_account_id: finalFreightAccount || null,
        membership_status: finalSubscriptionId ? "active" : "pending_payment",
        subscription_status: finalSubscriptionStatus,
        account_active: true,
        updated_at: now,
        created_at: existingFreightUser?.created_at || now,
      },
      { onConflict: "id" }
    );

    const { data: savedFreightUser, error: saveError } = await supabase
      .from("freight_users")
      .upsert(
        existingFreightUser?.id
          ? freightPayload
          : { ...freightPayload, created_at: now },
        { onConflict: "id" }
      )
      .select()
      .single();

    if (saveError) throw saveError;
    if (!savedFreightUser?.id) {
      throw new Error("Freight registration did not save.");
    }

    await upsertAdminVerification(
      carrierId,
      savedFreightUser,
      finalSubscriptionId,
      finalSubscriptionStatus
    );

    await saveHydratedSession(savedFreightUser);
    hydrateForm(savedFreightUser);
    setHasSavedSecurityAnswer1(Boolean(savedFreightUser.security_answer_1));
    setHasSavedSecurityAnswer2(Boolean(savedFreightUser.security_answer_2));
    setHasSavedSecurityAnswer3(Boolean(savedFreightUser.security_answer_3));
    setSecurityAnswer1("");
    setSecurityAnswer2("");
    setSecurityAnswer3("");

    return savedFreightUser;
  }

  async function upsertAdminVerification(
    carrierId: string,
    savedFreightUser: any,
    finalSubscriptionId?: string,
    finalSubscriptionStatus?: string
  ) {
    const now = new Date().toISOString();
    const cleanCompanyName = companyName.trim();
    const cleanContactName = contactName.trim();
    const cleanEmailValue = normalize(email);
    const finalAccountId = savedFreightUser.account_id || accountId;
    const paid = Boolean(finalSubscriptionId || subscriptionId);
    const finalFreightAccount = pickStripeConnectAccountId(
      freightAccount,
      savedFreightUser.freight_account,
      savedFreightUser.stripe_account_id
    );

    await supabase.from("admin_verifications").upsert(
      {
        id: carrierId,
        account_id: finalAccountId,
        carrier_id: carrierId,
        freight_id: carrierId,
        profile_id: carrierId,
        account_type: "FREIGHT_CARRIER",
        role: "freight",
        type: "FREIGHT_CARRIER",
        company_name: cleanCompanyName,
        business_name: cleanCompanyName,
        contact_name: cleanContactName,
        owner_name: cleanContactName,
        email: cleanEmailValue,
        phone: phone.trim(),
        username: normalize(username),
        business_address: businessAddress.trim(),
        city: city.trim(),
        state: stateValue.trim().toUpperCase(),
        zip_code: zipCode.trim(),
        mdot_number: mdotNumber.trim(),
        dot_number: mdotNumber.trim(),
        mc_number: mcNumber.trim(),
        insurance_provider: insuranceProvider.trim(),
        insurance_policy_number: insurancePolicyNumber.trim(),
        authority_active: authorityActive,
        insurance_active: insuranceActive,
        licensed_livestock: licensedLivestock,
        licensed_refrigerated_food: licensedRefrigeratedFood,
        status: paid ? "SUBMITTED" : "PENDING_PAYMENT",
        compliance_status: paid ? "SUBMITTED" : "PENDING_PAYMENT",
        admin_review_status: paid ? "submitted" : "pending_payment",
        review_decision: paid ? "submitted" : "pending_payment",
        approved: true,
        rejected: false,
        reviewed: false,
        needs_more_info: false,
        account_active: true,
        membership_status: paid ? "active" : "pending_payment",
        subscription_status:
          finalSubscriptionStatus ||
          subscriptionStatus ||
          (paid ? "active" : "pending_payment"),
        freight_membership_paid: paid,
        application_submitted: paid,
        submitted_at: paid ? now : null,
        stripe_customer_id: stripeCustomerId || null,
        freight_account: finalFreightAccount || null,
        stripe_account_id: finalFreightAccount || null,
        stripe_subscription_id: finalSubscriptionId || subscriptionId || null,
        subscription_id: finalSubscriptionId || subscriptionId || null,
        updated_at: now,
        created_at: savedFreightUser?.created_at || now,
      },
      { onConflict: "id" }
    );
  }

  async function saveRegistration() {
    if (saving) return null;
    if (!validateForm()) return null;

    try {
      setSaving(true);

      const cleanEmailValue = normalize(email);
      const cleanUsername = normalize(username);

      const duplicate = await checkDuplicateFreight(
        cleanEmailValue,
        cleanUsername
      );

      if (duplicate?.id) {
        setFreightId(duplicate.id);
        setSavedCarrierId(duplicate.id);
        setAccountId(duplicate.account_id || accountId);

        const saved = await saveFreightUserRow(
          duplicate.id,
          duplicate.account_id || undefined
        );

        return saved;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmailValue,
        password: password.trim(),
        options: {
          data: {
            role: "freight",
            username: cleanUsername,
            company_name: companyName.trim(),
            contact_name: contactName.trim(),
            full_name: contactName.trim(),
          },
        },
      });

      if (authError) {
        Alert.alert("Signup Error", authError.message);
        return null;
      }

      const carrierId = authData?.user?.id;

      if (!carrierId) {
        Alert.alert("Signup Error", "Unable to create freight auth account.");
        return null;
      }

      const generatedAccountId = await generateFreightAccountId();

      setFreightId(carrierId);
      setSavedCarrierId(carrierId);
      setAccountId(generatedAccountId);

      const saved = await saveFreightUserRow(carrierId, generatedAccountId);

      return saved;
    } catch (error: any) {
      Alert.alert(
        "Save Error",
        error?.message || "Unable to save freight registration."
      );
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function startSubscriptionCheckout() {
    if (saving) return;

    if (hasActiveSubscription) {
      Alert.alert(
        "Membership Already Active",
        "This freight account already has an active Stripe subscription. No new membership charge will be created. Use Open / Update Stripe Banking to update bank payout details."
      );
      return;
    }

    let finalId = savedCarrierId || freightId;
    let finalAccountId = accountId;
    const finalEmail = normalize(email);

    if (!finalId || !finalEmail) {
      const saved = await saveRegistration();
      finalId = saved?.id || savedCarrierId || freightId;
      finalAccountId = saved?.account_id || accountId;
    }

    if (!finalId || !finalEmail) {
      Alert.alert(
        "Save Required",
        "Save registration before starting subscription."
      );
      return;
    }

    try {
      setSaving(true);

      const successUrl = `${APP_URL}/freight/register?stripe=success&freightId=${encodeURIComponent(
        finalId
      )}`;
      const cancelUrl = `${APP_URL}/freight/register?stripe=cancelled&freightId=${encodeURIComponent(
        finalId
      )}`;

      const response = await fetch(
        `${API_BASE_URL}/payments/create-freight-subscription-checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "freight",
            planType: "freight",
            userId: finalId,
            freightId: finalId,
            freight_id: finalId,
            accountId: finalAccountId,
            account_id: finalAccountId,
            email: finalEmail,
            customerEmail: finalEmail,
            freight_email: finalEmail,
            companyName: companyName.trim(),
            businessName: companyName.trim(),
            business_name: companyName.trim(),
            name: companyName.trim(),
            contactName: contactName.trim(),
            contact_name: contactName.trim(),
            username: normalize(username),
            successUrl,
            success_url: successUrl,
            cancelUrl,
            cancel_url: cancelUrl,
            metadata: {
              role: "freight",
              freight_id: finalId,
              account_id: finalAccountId,
              freight_email: finalEmail,
              email: finalEmail,
              company_name: companyName.trim(),
              business_name: companyName.trim(),
              contact_name: contactName.trim(),
              username: normalize(username),
            },
          }),
        }
      );

      const text = await response.text();
      let json: any = {};

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { success: false, error: text };
      }

      if (!response.ok || !json.success) {
        Alert.alert("Checkout Error", json.error || "Backend checkout failed.");
        return;
      }

      if (json.alreadySubscribed) {
        const customerId = pickStripeCustomerId(json.stripeCustomerId);
        const subId = pickStripeSubscriptionId(json.stripeSubscriptionId);
        const status = json.subscriptionStatus || "active";

        setStripeCustomerId(customerId);
        setSubscriptionId(subId);
        setSubscriptionStatus(status);

        await markApplicationSubmittedAndOpenDashboard(finalId, {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subId,
          subscriptionStatus: status,
        });
        return;
      }

      if (!json.url) {
        Alert.alert(
          "Checkout Error",
          "Backend did not return a Stripe Checkout URL."
        );
        return;
      }

      if (json.stripeCustomerId) {
        setStripeCustomerId(pickStripeCustomerId(json.stripeCustomerId));
      }

      if (Platform.OS === "web") {
        window.location.href = json.url;
        return;
      }

      await Linking.openURL(json.url);
    } catch (error: any) {
      Alert.alert("Checkout Error", error?.message || "Backend checkout failed.");
    } finally {
      setSaving(false);
    }
  }

  async function markApplicationSubmittedAndOpenDashboard(
    targetId?: string,
    stripeOverride?: {
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
      subscriptionStatus?: string;
    }
  ) {
    const finalId = targetId || savedCarrierId || freightId;

    if (!finalId) {
      Alert.alert("Save Required", "Save your freight registration first.");
      return;
    }

    const now = new Date().toISOString();

    let finalStripeCustomerId = pickStripeCustomerId(
      stripeOverride?.stripeCustomerId,
      stripeCustomerId
    );

    let finalSubscriptionId = pickStripeSubscriptionId(
      stripeOverride?.stripeSubscriptionId,
      subscriptionId
    );

    let finalStatus =
      stripeOverride?.subscriptionStatus ||
      subscriptionStatus ||
      (finalSubscriptionId ? "active" : "pending");

    if (!finalSubscriptionId) {
      const sync = await forceSyncFreightSubscription(true, finalId);

      finalStripeCustomerId = pickStripeCustomerId(
        sync?.stripeCustomerId,
        sync?.stripe_customer_id,
        finalStripeCustomerId
      );

      finalSubscriptionId = pickStripeSubscriptionId(
        sync?.stripeSubscriptionId,
        sync?.stripe_subscription_id,
        sync?.subscriptionId,
        sync?.subscription_id,
        finalSubscriptionId
      );

      finalStatus =
        sync?.subscriptionStatus ||
        sync?.subscription_status ||
        finalStatus ||
        (finalSubscriptionId ? "active" : "pending");
    }

    const updatePayload = {
      application_submitted: true,
      submitted_at: now,
      verification_status: "SUBMITTED",
      compliance_status: "SUBMITTED",
      admin_review_status: "submitted",
      membership_status: finalSubscriptionId ? "active" : "pending",
      subscription_status: finalStatus,
      freight_membership_paid: Boolean(finalSubscriptionId),
      stripe_customer_id: finalStripeCustomerId || null,
      stripe_subscription_id: finalSubscriptionId || null,
      subscription_id: finalSubscriptionId || null,
      freight_account: freightAccount || null,
      stripe_account_id: freightAccount || null,
      account_active: true,
      updated_at: now,
    };

    await supabase.from("freight_users").update(updatePayload).eq("id", finalId);
    await supabase.from("profiles").update(updatePayload).eq("id", finalId);

    await supabase.from("admin_verifications").upsert(
      {
        ...updatePayload,
        id: finalId,
        freight_id: finalId,
        carrier_id: finalId,
        profile_id: finalId,
        account_id: accountId,
        account_type: "FREIGHT_CARRIER",
        role: "freight",
        type: "FREIGHT_CARRIER",
        company_name: companyName.trim(),
        business_name: companyName.trim(),
        contact_name: contactName.trim(),
        owner_name: contactName.trim(),
        email: normalize(email),
        phone: phone.trim(),
        username: normalize(username),
        status: "SUBMITTED",
        review_decision: "submitted",
        approved: true,
        rejected: false,
        reviewed: false,
        needs_more_info: false,
      },
      { onConflict: "id" }
    );

    const { data: updatedCarrier } = await supabase
      .from("freight_users")
      .select("*")
      .eq("id", finalId)
      .maybeSingle();

    if (updatedCarrier) {
      await saveHydratedSession(updatedCarrier);
    }

    router.replace("/freight/dashboard" as any);
  }

  async function submitToDashboard() {
    const finalId = savedCarrierId || freightId;

    if (!finalId) {
      Alert.alert("Save Required", "Save the freight registration first.");
      return;
    }

    if (!hasActiveSubscription) {
      Alert.alert(
        "Subscription Required",
        "Start Stripe Membership first so the Stripe Customer ID and Subscription ID are saved."
      );
      return;
    }

    if (!hasStripeConnectAccount) {
      Alert.alert(
        "Stripe Connect Required",
        "Tap Connect Stripe Payouts first so the Stripe Connect Account ID is created and saved."
      );
      return;
    }

    await markApplicationSubmittedAndOpenDashboard(finalId);
  }

  async function startStripeConnectOnboarding() {
    if (saving) return;

    let finalFreightId = savedCarrierId || freightId;
    let finalAccountId = accountId;
    const finalEmail = normalize(email);

    if (!finalFreightId || !finalEmail) {
      const saved = await saveRegistration();
      finalFreightId = saved?.id || savedCarrierId || freightId;
      finalAccountId = saved?.account_id || accountId;
    }

    if (!finalFreightId || !finalEmail) {
      Alert.alert(
        "Save Required",
        "Save the freight registration before connecting Stripe payouts."
      );
      return;
    }

    try {
      setSaving(true);

      await saveFreightUserRow(finalFreightId, finalAccountId);

      const response = await fetch(
        `${API_BASE_URL}/payments/create-connect-account`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "freight",
            freightId: finalFreightId,
            freight_id: finalFreightId,
            userId: finalFreightId,
            accountId: finalAccountId,
            account_id: finalAccountId,
            email: finalEmail,
            freight_email: finalEmail,
            companyName: companyName.trim(),
            businessName: companyName.trim(),
            contactName: contactName.trim(),
            freight_account: freightAccount,
          }),
        }
      );

      const text = await response.text();
      let json: any = {};

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { success: false, error: text };
      }

      if (!response.ok || !json.success) {
        Alert.alert(
          "Connect Stripe Error",
          json.error || "Unable to create Stripe Connect onboarding link."
        );
        return;
      }

      const returnedFreightAccount = pickStripeConnectAccountId(
        json.freight_account,
        json.stripeAccountId,
        json.stripe_account_id,
        json.connectedAccountId,
        json.account,
        freightAccount
      );

      if (!returnedFreightAccount) {
        Alert.alert(
          "Connect Stripe Error",
          "Stripe did not return a real Account ID that starts with acct_."
        );
        return;
      }

      setFreightAccount(returnedFreightAccount);

      const connectUpdate = {
        freight_account: returnedFreightAccount,
        stripe_account_id: returnedFreightAccount,
        stripe_connect_status: "started",
        payouts_enabled: false,
        charges_enabled: false,
        stripe_payouts_enabled: false,
        stripe_charges_enabled: false,
        stripe_onboarding_complete: false,
        updated_at: new Date().toISOString(),
      };

      await supabase.from("freight_users").update(connectUpdate).eq("id", finalFreightId);
      await supabase.from("profiles").update(connectUpdate).eq("id", finalFreightId);
      await supabase
        .from("admin_verifications")
        .update(connectUpdate)
        .or(`id.eq.${finalFreightId},freight_id.eq.${finalFreightId},profile_id.eq.${finalFreightId}`);

      await supabase
        .from("freight_subscriptions")
        .update({
          freight_account: returnedFreightAccount,
          stripe_account_id: returnedFreightAccount,
          updated_at: new Date().toISOString(),
        })
        .or(`freight_id.eq.${finalFreightId},freight_email.eq.${finalEmail}`);

      await saveFreightSession({
        id: finalFreightId,
        freightId: finalFreightId,
        freight_id: finalFreightId,
        accountId: finalAccountId,
        account_id: finalAccountId,
        role: "freight",
        companyName: companyName.trim(),
        company_name: companyName.trim(),
        businessName: companyName.trim(),
        business_name: companyName.trim(),
        contactName: contactName.trim(),
        contact_name: contactName.trim(),
        email: finalEmail,
        phone: phone.trim(),
        username: normalize(username),
        stripeCustomerId,
        stripe_customer_id: stripeCustomerId,
        stripeSubscriptionId: subscriptionId,
        stripe_subscription_id: subscriptionId,
        subscriptionId,
        subscription_id: subscriptionId,
        subscriptionStatus,
        subscription_status: subscriptionStatus,
        freightAccount: returnedFreightAccount,
        freight_account: returnedFreightAccount,
      });

      const url = json.url || json.onboardingUrl;

      if (!url) {
        Alert.alert(
          "Stripe Connect Account Saved",
          "The Stripe Connect Account ID was saved, but no onboarding link was returned."
        );
        return;
      }

      if (Platform.OS === "web") {
        window.location.href = url;
        return;
      }

      await Linking.openURL(url);
    } catch (error: any) {
      Alert.alert(
        "Connect Stripe Error",
        error?.message || "Unable to start Stripe Connect onboarding."
      );
    } finally {
      setSaving(false);
    }
  }

  function renderQuestionPicker(
    label: string,
    selectedQuestion: string,
    setSelectedQuestion: (value: string) => void,
    answer: string,
    setAnswer: (value: string) => void
  ) {
    return (
      <View style={styles.securityBox}>
        <Text style={styles.securityLabel}>{label}</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {SECURITY_QUESTIONS.map((question) => {
            const active = selectedQuestion === question;

            return (
              <TouchableOpacity
                key={question}
                style={[styles.questionChip, active && styles.questionChipActive]}
                onPress={() => setSelectedQuestion(question)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.questionChipText,
                    active && styles.questionChipTextActive,
                  ]}
                >
                  {question}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TextInput
          style={styles.input}
          placeholder={
            savedCarrierId ? "Leave blank to keep saved answer" : "Hidden answer"
          }
          placeholderTextColor="#94A3B8"
          value={answer}
          onChangeText={setAnswer}
          secureTextEntry
        />
      </View>
    );
  }

  function SectionHeader({
    icon,
    title,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
  }) {
    return (
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={20} color="#FFFFFF" />
        </View>
        <Text style={styles.section}>{title}</Text>
      </View>
    );
  }

  function ReadOnlyIdBox({
    label,
    value,
    fallback,
  }: {
    label: string;
    value: string;
    fallback: string;
  }) {
    return (
      <View style={styles.readOnlyBox}>
        <Text style={styles.readOnlyLabel}>{label}</Text>
        <Text style={[styles.readOnlyValue, !value && styles.readOnlyFallback]}>
          {value || fallback}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.page}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <Ionicons name="trail-sign-outline" size={34} color="#FFFFFF" />
            </View>
            <Text style={styles.kicker}>Farm2Home Freight</Text>
            <Text style={styles.title}>Carrier Registration</Text>
            <Text style={styles.subtitle}>
              Save registration, start Stripe checkout, and after Stripe confirms
              payment your application is submitted and the freight dashboard
              opens.
            </Text>
          </View>

          {processingReturn ? (
            <View style={styles.noticeBox}>
              <View style={styles.noticeHeader}>
                <ActivityIndicator color={COLORS.amber} />
                <Text style={styles.noticeTitle}>
                  Completing Stripe Registration
                </Text>
              </View>
              <Text style={styles.noticeText}>
                Please wait while we sync your Stripe subscription and submit
                your freight application.
              </Text>
            </View>
          ) : (
            <View style={styles.noticeBox}>
              <View style={styles.noticeHeader}>
                <Ionicons
                  name="alert-circle-outline"
                  size={22}
                  color={COLORS.amber}
                />
                <Text style={styles.noticeTitle}>Use Secure Checkout</Text>
              </View>
              <Text style={styles.noticeText}>
                Do not use a static Stripe payment link. This page creates a
                unique Stripe Checkout session with your freight ID, email,
                company name, and username attached.
              </Text>
            </View>
          )}

          <View style={styles.card}>
            <SectionHeader icon="key-outline" title="System IDs" />
            <ReadOnlyIdBox
              label="Supabase UUID / Freight ID"
              value={freightId}
              fallback="Assigned after save"
            />
            <ReadOnlyIdBox
              label="Static Account ID"
              value={accountId}
              fallback="Assigned after save"
            />
            <ReadOnlyIdBox
              label="Stripe Customer ID"
              value={stripeCustomerId}
              fallback="Assigned by Stripe checkout"
            />
            <ReadOnlyIdBox
              label="Stripe Subscription ID"
              value={subscriptionId}
              fallback="Assigned by Stripe webhook"
            />
            <ReadOnlyIdBox
              label="Stripe Connect Account ID"
              value={freightAccount}
              fallback="Assigned by Connect Bank"
            />

            <TouchableOpacity
              style={[styles.syncButton, syncingStripe && styles.disabledButton]}
              onPress={async () => {
                const synced = await syncStripeByEmail(email, true);

                if (!synced?.stripeCustomerId && !synced?.stripeSubscriptionId) {
                  await forceSyncFreightSubscription();
                  return;
                }

                Alert.alert(
                  "Stripe Synced",
                  "Your existing Stripe information was saved without erasing the form."
                );
              }}
              disabled={syncingStripe}
            >
              {syncingStripe ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.syncButtonText}>
                    Find / Retrieve Missing Stripe Info
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.syncButton, syncingStripe && styles.disabledButton]}
              onPress={forceRefreshFreightRegister}
              disabled={syncingStripe}
            >
              {syncingStripe ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="reload-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.syncButtonText}>Force Refresh Registration</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <SectionHeader icon="business-outline" title="Company Information" />
            <TextInput
              style={styles.input}
              placeholder="Company Name"
              placeholderTextColor="#94A3B8"
              value={companyName}
              onChangeText={setCompanyName}
            />
            <TextInput
              style={styles.input}
              placeholder="Contact Name"
              placeholderTextColor="#94A3B8"
              value={contactName}
              onChangeText={setContactName}
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            <TextInput
              style={styles.input}
              placeholder="Service Area"
              placeholderTextColor="#94A3B8"
              value={serviceArea}
              onChangeText={setServiceArea}
            />
          </View>

          <View style={styles.card}>
            <SectionHeader icon="lock-closed-outline" title="Create Freight Login" />
            <TextInput
              style={styles.input}
              placeholder="Create Username"
              placeholderTextColor="#94A3B8"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {!savedCarrierId ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Create Password"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor="#94A3B8"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </>
            ) : (
              <Text style={styles.helperText}>
                Password already exists. Use reset password if needed.
              </Text>
            )}
          </View>

          <View style={styles.securityCard}>
            <SectionHeader icon="key-outline" title="Security Questions" />
            {renderQuestionPicker(
              "Security Question 1",
              securityQuestion1,
              setSecurityQuestion1,
              securityAnswer1,
              setSecurityAnswer1
            )}
            {renderQuestionPicker(
              "Security Question 2",
              securityQuestion2,
              setSecurityQuestion2,
              securityAnswer2,
              setSecurityAnswer2
            )}
            {renderQuestionPicker(
              "Security Question 3",
              securityQuestion3,
              setSecurityQuestion3,
              securityAnswer3,
              setSecurityAnswer3
            )}
          </View>

          <View style={styles.card}>
            <SectionHeader icon="location-outline" title="Business Address" />
            <TextInput
              style={styles.input}
              placeholder="Business Address"
              placeholderTextColor="#94A3B8"
              value={businessAddress}
              onChangeText={setBusinessAddress}
            />
            <TextInput
              style={styles.input}
              placeholder="City"
              placeholderTextColor="#94A3B8"
              value={city}
              onChangeText={setCity}
            />
            <TextInput
              style={styles.input}
              placeholder="State"
              placeholderTextColor="#94A3B8"
              value={stateValue}
              onChangeText={setStateValue}
            />
            <TextInput
              style={styles.input}
              placeholder="Zip Code"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={zipCode}
              onChangeText={setZipCode}
            />
          </View>

          <View style={styles.card}>
            <SectionHeader icon="shield-checkmark-outline" title="Authority & Insurance" />
            <TextInput
              style={styles.input}
              placeholder="MDOT Number"
              placeholderTextColor="#94A3B8"
              value={mdotNumber}
              onChangeText={setMdotNumber}
            />
            <TextInput
              style={styles.input}
              placeholder="MC Number"
              placeholderTextColor="#94A3B8"
              value={mcNumber}
              onChangeText={setMcNumber}
            />
            <TextInput
              style={styles.input}
              placeholder="Insurance Provider"
              placeholderTextColor="#94A3B8"
              value={insuranceProvider}
              onChangeText={setInsuranceProvider}
            />
            <TextInput
              style={styles.input}
              placeholder="Insurance Policy Number"
              placeholderTextColor="#94A3B8"
              value={insurancePolicyNumber}
              onChangeText={setInsurancePolicyNumber}
            />

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>Active MC / Operating Authority</Text>
              <Switch value={authorityActive} onValueChange={setAuthorityActive} />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>Active Insurance</Text>
              <Switch value={insuranceActive} onValueChange={setInsuranceActive} />
            </View>
          </View>

          <View style={styles.card}>
            <SectionHeader icon="cube-outline" title="Transport Authorization" />
            <View style={styles.switchRow}>
              <Text style={styles.switchText}>Licensed to Move Livestock</Text>
              <Switch
                value={licensedLivestock}
                onValueChange={setLicensedLivestock}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchText}>
                Licensed for Refrigerated Fresh Food
              </Text>
              <Switch
                value={licensedRefrigeratedFood}
                onValueChange={setLicensedRefrigeratedFood}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, saving && styles.disabledButton]}
            onPress={saveRegistration}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                <Text style={styles.buttonText}>Save Freight Registration</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.darkButton, saving && styles.disabledButton]}
            onPress={hasActiveSubscription ? submitToDashboard : startSubscriptionCheckout}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name={hasActiveSubscription ? "grid-outline" : "card-outline"}
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.buttonText}>
                  {hasActiveSubscription
                    ? registrationReadyForDashboard
                      ? "Submit & Open Dashboard"
                      : "Finish Stripe Connect Before Submit"
                    : "Start Stripe Membership"}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.outlineButton, saving && styles.disabledButton]}
            disabled={saving}
            onPress={startStripeConnectOnboarding}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.red} />
            ) : (
              <>
                <Ionicons name="business-outline" size={18} color={COLORS.red} />
                <Text style={styles.outlineButtonText}>
                  {hasStripeConnectAccount
                    ? "Open / Update Stripe Banking"
                    : "Connect Stripe Payouts"}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/freight/login" as any)}>
            <Text style={styles.link}>Already registered? Login</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  keyboard: { flex: 1, backgroundColor: COLORS.bg },
  page: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 90 },
  heroCard: {
    backgroundColor: COLORS.black,
    paddingTop: 26,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  kicker: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 36,
    fontWeight: "900",
    marginTop: 6,
    color: "#FFFFFF",
  },
  subtitle: {
    color: "#CBD5E1",
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "700",
    marginTop: 8,
  },
  noticeBox: {
    backgroundColor: "#FFFBEB",
    borderColor: COLORS.amber,
    borderWidth: 1,
    borderRadius: 18,
    padding: 15,
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 14,
  },
  noticeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  noticeTitle: { color: COLORS.text, fontWeight: "900", fontSize: 17 },
  noticeText: { color: COLORS.text, fontWeight: "700", lineHeight: 22 },
  card: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  securityCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginBottom: 16,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
  },
  section: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  input: {
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 16,
    color: COLORS.text,
    fontWeight: "700",
  },
  helperText: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 21,
    marginBottom: 10,
  },
  readOnlyBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  readOnlyLabel: {
    color: COLORS.muted,
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  readOnlyValue: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 15,
  },
  readOnlyFallback: { color: "#94A3B8" },
  syncButton: {
    backgroundColor: COLORS.black,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  syncButtonText: { color: "#FFFFFF", fontWeight: "900" },
  securityBox: { marginBottom: 12 },
  securityLabel: { color: COLORS.text, fontWeight: "900", marginBottom: 8 },
  questionChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 10,
    maxWidth: 280,
  },
  questionChipActive: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },
  questionChipText: { color: COLORS.red, fontWeight: "900" },
  questionChipTextActive: { color: "#FFFFFF" },
  switchRow: {
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switchText: {
    flex: 1,
    fontWeight: "800",
    paddingRight: 12,
    color: COLORS.text,
  },
  button: {
    backgroundColor: COLORS.red,
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 18,
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  darkButton: {
    backgroundColor: COLORS.black,
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 18,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  outlineButton: {
    backgroundColor: "#FFF1F2",
    borderColor: COLORS.red,
    borderWidth: 1,
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 18,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  outlineButtonText: {
    color: COLORS.red,
    textAlign: "center",
    fontWeight: "900",
    fontSize: 16,
  },
  disabledButton: { opacity: 0.6 },
  buttonText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "900",
    fontSize: 16,
  },
  link: {
    color: COLORS.red,
    textAlign: "center",
    fontWeight: "900",
    marginTop: 18,
  },
});