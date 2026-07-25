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
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  "https://farm2home-production-e4bd.up.railway.app";

const APP_URL = process.env.EXPO_PUBLIC_APP_URL || "https://farm2home-rho.vercel.app";
const DOCUMENT_BUCKET = "freight-documents";

const COLORS = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  surface: "#F8FAFC",
  surface2: "#F1F5F9",
  primary: "#635BFF",
  primaryDark: "#4638D8",
  primarySoft: "#EEF2FF",
  accent: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  text: "#101828",
  muted: "#667085",
  border: "#E5E7EB",
  dark: "#111827",
  white: "#FFFFFF",
  navy: "#020617",
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

const STEPS = [
  { key: "account", title: "Account", icon: "person-outline" },
  { key: "company", title: "Company", icon: "business-outline" },
  { key: "authority", title: "Authority", icon: "shield-checkmark-outline" },
  { key: "documents", title: "Documents", icon: "document-text-outline" },
  { key: "security", title: "Security", icon: "key-outline" },
  { key: "stripe", title: "Stripe", icon: "card-outline" },
  { key: "review", title: "Review", icon: "checkmark-done-outline" },
] as const;

const EQUIPMENT_OPTIONS = [
  { key: "dry_van", label: "Dry Van", icon: "cube-outline" },
  { key: "reefer", label: "Reefer", icon: "snow-outline" },
  { key: "box_truck", label: "Box Truck", icon: "file-tray-stacked-outline" },
  { key: "flatbed", label: "Flatbed", icon: "layers-outline" },
  { key: "livestock", label: "Livestock", icon: "paw-outline" },
  { key: "produce", label: "Produce", icon: "leaf-outline" },
];

const REQUIRED_DOCUMENTS = [
  { key: "cdl_document", label: "Commercial Driver License / CDL", required: true },
  { key: "dot_document", label: "DOT Certificate", required: true },
  { key: "mc_authority_document", label: "MC Authority Letter", required: true },
  { key: "insurance_document", label: "Certificate of Insurance / COI", required: true },
  { key: "w9_document", label: "W-9 Form", required: true },
  { key: "vehicle_registration_document", label: "Vehicle Registration", required: true },
  { key: "cargo_insurance_document", label: "Cargo Insurance Certificate", required: true },
  { key: "business_license_document", label: "Business License", required: true },
] as const;

const OPTIONAL_DOCUMENTS = [
  { key: "hipaa_certificate", label: "HIPAA Certificate" },
  { key: "bloodborne_certificate", label: "Bloodborne Pathogens Certificate" },
  { key: "tsa_certificate", label: "TSA Certificate" },
  { key: "food_handling_certificate", label: "Food Handling / Reefer Permit" },
] as const;

type DocumentKey =
  | "cdl_document"
  | "dot_document"
  | "mc_authority_document"
  | "insurance_document"
  | "w9_document"
  | "vehicle_registration_document"
  | "cargo_insurance_document"
  | "business_license_document"
  | "hipaa_certificate"
  | "bloodborne_certificate"
  | "tsa_certificate"
  | "food_handling_certificate";

type DocumentState = Record<DocumentKey, string>;

const EMPTY_DOCUMENTS: DocumentState = {
  cdl_document: "",
  dot_document: "",
  mc_authority_document: "",
  insurance_document: "",
  w9_document: "",
  vehicle_registration_document: "",
  cargo_insurance_document: "",
  business_license_document: "",
  hipaa_certificate: "",
  bloodborne_certificate: "",
  tsa_certificate: "",
  food_handling_certificate: "",
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function normalizeAnswer(value: any) {
  return normalize(value);
}

function isUuid(value: any) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean(value));
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

function maskId(value: string, fallback = "Missing") {
  const id = clean(value);
  if (!id) return fallback;
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}...${id.slice(-5)}`;
}

function makeFallbackAccountId() {
  const stamp = Date.now().toString().slice(-6);
  return `Freight_${stamp}`;
}

function getDocumentName(value: string) {
  const v = clean(value);
  if (!v) return "Missing";
  const parts = v.split("/");
  return parts[parts.length - 1] || "Uploaded";
}

function hasRequiredDocuments(row: any) {
  return REQUIRED_DOCUMENTS.every((doc) => clean(row?.[doc.key]));
}

async function parseApiResponse(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { success: false, error: text || "Invalid backend response." };
  }
}

function getStripeLaunchUrl(data: any) {
  return clean(
    data?.url ||
      data?.onboardingUrl ||
      data?.onboarding_url ||
      data?.accountLink ||
      data?.account_link ||
      data?.checkoutUrl ||
      data?.checkout_url ||
      data?.sessionUrl ||
      data?.session_url ||
      data?.data?.url ||
      data?.result?.url
  );
}

async function openUrl(url: string) {
  const finalUrl = clean(url);

  if (!finalUrl || !finalUrl.startsWith("http")) {
    Alert.alert("Stripe Error", "No valid Stripe URL was returned.");
    return;
  }

  if (Platform.OS === "web") {
    window.location.assign(finalUrl);
    return;
  }

  try {
    const result = await WebBrowser.openBrowserAsync(finalUrl);
    if (result?.type === "cancel" || result?.type === "dismiss") await Linking.openURL(finalUrl);
  } catch {
    const canOpen = await Linking.canOpenURL(finalUrl);
    if (!canOpen) {
      Alert.alert("Stripe Error", "This device cannot open the Stripe URL.");
      return;
    }
    await Linking.openURL(finalUrl);
  }
}

function hasCompleteDashboardAccess(row: any) {
  return Boolean(
    clean(row?.id || row?.freight_id || row?.freightId) &&
      clean(row?.account_id || row?.accountId) &&
      isStripeCustomerId(row?.stripe_customer_id || row?.stripeCustomerId) &&
      isStripeSubscriptionId(row?.subscription_id || row?.subscriptionId || row?.stripe_subscription_id) &&
      isStripeConnectAccountId(row?.freight_account || row?.freightAccount || row?.stripe_account_id) &&
      hasRequiredDocuments(row)
  );
}

async function saveFreightSession(carrier: any) {
  const sessionCarrier = {
    ...carrier,
    role: "freight",
    freightId: carrier.freight_id || carrier.freightId || carrier.id,
    freight_id: carrier.freight_id || carrier.freightId || carrier.id,
    accountId: carrier.account_id || carrier.accountId,
    account_id: carrier.account_id || carrier.accountId,
    companyName: carrier.company_name || carrier.companyName || carrier.business_name || carrier.businessName,
    company_name: carrier.company_name || carrier.companyName || carrier.business_name || carrier.businessName,
    businessName: carrier.business_name || carrier.businessName || carrier.company_name || carrier.companyName,
    business_name: carrier.business_name || carrier.businessName || carrier.company_name || carrier.companyName,
    fullName: carrier.full_name || carrier.fullName || carrier.name || carrier.contact_name,
    full_name: carrier.full_name || carrier.fullName || carrier.name || carrier.contact_name,
    stripeCustomerId: carrier.stripe_customer_id || carrier.stripeCustomerId,
    stripe_customer_id: carrier.stripe_customer_id || carrier.stripeCustomerId,
    subscriptionId: carrier.subscription_id || carrier.subscriptionId || carrier.stripe_subscription_id,
    subscription_id: carrier.subscription_id || carrier.subscriptionId || carrier.stripe_subscription_id,
    stripeSubscriptionId: carrier.subscription_id || carrier.subscriptionId || carrier.stripe_subscription_id,
    stripe_subscription_id: carrier.subscription_id || carrier.subscriptionId || carrier.stripe_subscription_id,
    freightAccount: carrier.freight_account || carrier.freightAccount || carrier.stripe_account_id,
    freight_account: carrier.freight_account || carrier.freightAccount || carrier.stripe_account_id,
    stripeAccountId: carrier.freight_account || carrier.freightAccount || carrier.stripe_account_id,
    stripe_account_id: carrier.freight_account || carrier.freightAccount || carrier.stripe_account_id,
    documentsComplete: hasRequiredDocuments(carrier),
    accountActive: carrier.account_active,
    account_active: carrier.account_active,
    membershipStatus: carrier.membership_status,
    membership_status: carrier.membership_status,
    updatedAt: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await AsyncStorage.multiSet([
    ["pendingFreightCarrier", JSON.stringify(sessionCarrier)],
    ["pendingFreightProfile", JSON.stringify(sessionCarrier)],
    ["currentFreightCarrier", JSON.stringify(sessionCarrier)],
    ["currentFreight", JSON.stringify(sessionCarrier)],
    ["currentFreightUser", JSON.stringify(sessionCarrier)],
    ["farm2homeCurrentFreight", JSON.stringify(sessionCarrier)],
    ["currentUser", JSON.stringify(sessionCarrier)],
    ["userRole", "freight"],
    ["currentUserRole", "freight"],
    ["lastLoginRole", "freight"],
    ["lastFreightDashboardReady", hasCompleteDashboardAccess(sessionCarrier) ? "true" : "false"],
  ]);
}

export default function FreightRegister() {
  const params = useLocalSearchParams();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [syncingStripe, setSyncingStripe] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);

  const [savedCarrierId, setSavedCarrierId] = useState("");
  const [profileId, setProfileId] = useState("");
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
  const [licensedRefrigeratedFood, setLicensedRefrigeratedFood] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);

  const [documents, setDocuments] = useState<DocumentState>(EMPTY_DOCUMENTS);

  const selectedQuestions = useMemo(
    () => [securityQuestion1, securityQuestion2, securityQuestion3].filter(Boolean),
    [securityQuestion1, securityQuestion2, securityQuestion3]
  );

  const documentsComplete = useMemo(() => hasRequiredDocuments(documents), [documents]);

  const setupStatus = useMemo(() => {
    return [
      { label: "Freight Profile", complete: Boolean(savedCarrierId || freightId), value: savedCarrierId || freightId ? "Found" : "Missing" },
      { label: "Static Account", complete: Boolean(accountId), value: accountId || "Missing" },
      { label: "Required Documents", complete: documentsComplete, value: documentsComplete ? "Uploaded" : "Missing" },
      { label: "Stripe Customer", complete: isStripeCustomerId(stripeCustomerId), value: maskId(stripeCustomerId) },
      { label: "Subscription", complete: isStripeSubscriptionId(subscriptionId), value: maskId(subscriptionId) },
      { label: "Stripe Connect", complete: isStripeConnectAccountId(freightAccount), value: maskId(freightAccount) },
    ];
  }, [savedCarrierId, freightId, accountId, documentsComplete, stripeCustomerId, subscriptionId, freightAccount]);

  const setupScore = useMemo(() => setupStatus.filter((item) => item.complete).length, [setupStatus]);

  const allRequirementsFound = useMemo(
    () =>
      Boolean(
        (savedCarrierId || freightId) &&
          accountId &&
          documentsComplete &&
          isStripeCustomerId(stripeCustomerId) &&
          isStripeSubscriptionId(subscriptionId) &&
          isStripeConnectAccountId(freightAccount)
      ),
    [savedCarrierId, freightId, accountId, documentsComplete, stripeCustomerId, subscriptionId, freightAccount]
  );

  useEffect(() => {
    loadSavedFreight();
  }, []);

  useEffect(() => {
    const returnedFreightId = String(params?.freightId || params?.freight_id || "");
    const returnedEmail = String(params?.email || "");

    if (returnedEmail) setEmail(normalize(returnedEmail));
    if (returnedFreightId) {
      setFreightId(returnedFreightId);
      setSavedCarrierId(returnedFreightId);
    }

    if (String(params?.stripe || params?.payment || "") === "success") handleStripeSuccessReturn(returnedFreightId);
    if (["success", "true"].includes(String(params?.connect || params?.connected || ""))) handleConnectSuccessReturn(returnedFreightId);
  }, [params?.stripe, params?.payment, params?.connect, params?.connected, params?.freightId, params?.freight_id, params?.email]);

  function setDocumentValue(key: DocumentKey, value: string) {
    setDocuments((prev) => ({ ...prev, [key]: value }));
  }

  function toggleEquipment(key: string) {
    setSelectedEquipment((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  }

  async function goNext() {
    /*
      Save the Authority step before moving forward so selected equipment
      is persisted immediately in freight_users.equipment_type.
    */
    if (step === 2) {
      if (selectedEquipment.length === 0) {
        Alert.alert("Equipment Required", "Select at least one equipment type before continuing.");
        return;
      }

      const saved = await saveFreightProfile(false, false);
      if (!saved?.id) return;
    }

    setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  }

  function goBack() {
    setStep((prev) => Math.max(prev - 1, 0));
  }

  function goDashboard() {
    router.replace("/freight/dashboard" as any);
  }

  async function pickDocument(key: DocumentKey) {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const carrierId = clean(savedCarrierId || freightId);

      if (!carrierId) {
        Alert.alert(
          "Save Profile First",
          "Save the freight profile before uploading documents so the file can be attached to the correct freight account."
        );
        return;
      }

      const safeName = clean(asset.name || `${key}.pdf`).replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${carrierId}/${key}/${Date.now()}_${safeName}`;

      const response = await fetch(asset.uri);
      if (!response.ok) {
        throw new Error("Unable to read the selected document.");
      }

      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from(DOCUMENT_BUCKET)
        .upload(path, blob, {
          cacheControl: "3600",
          upsert: true,
          contentType: asset.mimeType || "application/octet-stream",
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from(DOCUMENT_BUCKET)
        .getPublicUrl(path);

      const savedUrl = clean(publicUrlData?.publicUrl || path);

      /*
        IMPORTANT FIX:
        Uploading to Storage is only half of the process. The previous version
        updated React state but did not immediately persist the uploaded URL to
        freight_users. This caused the document to appear in the UI until reload,
        then disappear.

        Save the document URL directly into the matching freight_users column.
      */
      const nextDocuments: DocumentState = {
        ...documents,
        [key]: savedUrl,
      };

      const documentsAreComplete = hasRequiredDocuments(nextDocuments);
      const now = new Date().toISOString();

      const updatedCarrier = await saveFreightUserAdaptively(
        carrierId,
        {
          [key]: savedUrl,
          documents_complete: documentsAreComplete,
          compliance_status: documentsAreComplete
            ? "PENDING_PAYMENT"
            : "PENDING_DOCUMENTS",
          admin_review_status: documentsAreComplete
            ? "pending_payment"
            : "pending_documents",
          updated_at: now,
        },
        false
      );

      /*
        Keep a normalized document record too. Failure here should not undo the
        freight_users save because freight_users is the source used by this form.
      */
      const existingRecord = await supabase
        .from("freight_documents")
        .select("id")
        .eq("freight_id", carrierId)
        .eq("document_type", key)
        .limit(1)
        .maybeSingle();

      const documentPayload = {
        freight_id: carrierId,
        document_type: key,
        title:
          [...REQUIRED_DOCUMENTS, ...OPTIONAL_DOCUMENTS].find((doc) => doc.key === key)?.label ||
          key,
        file_name: safeName,
        file_url: savedUrl,
        storage_path: path,
        status: "uploaded",
        review_status: "pending_review",
        updated_at: now,
      };

      if (!existingRecord.error && existingRecord.data?.id) {
        const { error: recordUpdateError } = await supabase
          .from("freight_documents")
          .update(documentPayload)
          .eq("id", existingRecord.data.id);

        if (recordUpdateError) {
          console.log("freight_documents update skipped:", recordUpdateError.message);
        }
      } else {
        const { error: recordInsertError } = await supabase
          .from("freight_documents")
          .insert({
            ...documentPayload,
            created_at: now,
          });

        if (recordInsertError) {
          console.log("freight_documents insert skipped:", recordInsertError.message);
        }
      }

      setDocuments(nextDocuments);

      if (updatedCarrier) {
        hydrateForm(updatedCarrier);
        await saveFreightSession(updatedCarrier);
      }

      Alert.alert(
        "Document Saved",
        `${safeName} was uploaded and permanently saved to the freight account.`
      );
    } catch (error: any) {
      console.log("document upload error:", error);
      Alert.alert(
        "Upload Error",
        error?.message ||
          "Unable to upload and save the document. Check the freight-documents bucket, RLS policies, and freight_users update policy."
      );
    }
  }

  function hydrateForm(row: any) {
    const rowFreightId = clean(row?.id || row?.freight_id || row?.freightId || "");
    const rowProfileId = clean(row?.profile_id || row?.profileId || "");
    const rowAccountId = clean(row?.account_id || row?.accountId || "");
    const rowCustomerId = pickStripeCustomerId(row?.stripe_customer_id, row?.stripeCustomerId);
    const rowSubId = pickStripeSubscriptionId(row?.subscription_id, row?.subscriptionId, row?.stripe_subscription_id);
    const rowConnectId = pickStripeConnectAccountId(row?.freight_account, row?.freightAccount, row?.stripe_account_id);

    if (rowFreightId) {
      setFreightId(rowFreightId);
      setSavedCarrierId(rowFreightId);
    }
    if (rowProfileId) setProfileId(rowProfileId);

    if (/^Freight_\d+$/i.test(rowAccountId)) {
      setAccountId(rowAccountId);
    } else if (rowAccountId) {
      console.log(
        "Ignoring non-freight account id in freight registration:",
        rowAccountId
      );
    }
    if (rowCustomerId) setStripeCustomerId(rowCustomerId);
    if (rowSubId) setSubscriptionId(rowSubId);
    if (rowConnectId) setFreightAccount(rowConnectId);

    setSubscriptionStatus(row?.subscription_status || row?.subscriptionStatus || subscriptionStatus || "");

    if (row?.company_name || row?.business_name || row?.companyName) setCompanyName(clean(row.company_name || row.business_name || row.companyName));
    if (row?.full_name || row?.contact_name || row?.name) setContactName(clean(row.full_name || row.contact_name || row.name));
    if (row?.email || row?.freight_email) setEmail(normalize(row.email || row.freight_email));
    if (row?.phone) setPhone(clean(row.phone));
    if (row?.username) setUsername(clean(row.username));
    if (row?.service_area) setServiceArea(clean(row.service_area));

    if (row?.business_address) setBusinessAddress(clean(row.business_address));
    if (row?.city) setCity(clean(row.city));
    if (row?.state) setStateValue(clean(row.state));
    if (row?.zip_code) setZipCode(clean(row.zip_code));

    if (row?.mdot_number || row?.dot_number) setMdotNumber(clean(row.mdot_number || row.dot_number));
    if (row?.mc_number) setMcNumber(clean(row.mc_number));
    if (row?.insurance_provider) setInsuranceProvider(clean(row.insurance_provider));
    if (row?.insurance_policy_number) setInsurancePolicyNumber(clean(row.insurance_policy_number));

    setAuthorityActive(Boolean(row?.authority_active));
    setInsuranceActive(Boolean(row?.insurance_active));
    setLicensedLivestock(Boolean(row?.licensed_livestock));
    setLicensedRefrigeratedFood(Boolean(row?.licensed_refrigerated_food));

    if (row?.security_question_1) setSecurityQuestion1(clean(row.security_question_1));
    if (row?.security_question_2) setSecurityQuestion2(clean(row.security_question_2));
    if (row?.security_question_3) setSecurityQuestion3(clean(row.security_question_3));
    setHasSavedSecurityAnswer1(Boolean(row?.security_answer_1));
    setHasSavedSecurityAnswer2(Boolean(row?.security_answer_2));
    setHasSavedSecurityAnswer3(Boolean(row?.security_answer_3));

    const nextDocs: DocumentState = { ...EMPTY_DOCUMENTS };
    [...REQUIRED_DOCUMENTS, ...OPTIONAL_DOCUMENTS].forEach((doc) => {
      nextDocs[doc.key as DocumentKey] = clean(row?.[doc.key]);
    });
    setDocuments((prev) => ({ ...prev, ...nextDocs }));

    const equipmentText = clean(
      row?.equipment_type || row?.equipment_types || ""
    );

    if (equipmentText) {
      setSelectedEquipment(
        equipmentText
          .split(",")
          .map((item) => normalize(item))
          .filter(Boolean)
      );
    }
  }

  function validateForm({ full = true }: { full?: boolean } = {}) {
    if (!companyName.trim() || !contactName.trim() || !normalize(email) || !phone.trim()) {
      Alert.alert("Missing Info", "Company, contact, email, and phone are required.");
      setStep(0);
      return false;
    }

    if (!normalize(email).includes("@")) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      setStep(0);
      return false;
    }

    if (!savedCarrierId && !freightId) {
      if (!username.trim() || !password.trim() || !confirmPassword.trim()) {
        Alert.alert("Login Required", "Please create a username and password.");
        setStep(0);
        return false;
      }

      if (password.trim().length < 6) {
        Alert.alert("Weak Password", "Password must be at least 6 characters.");
        setStep(0);
        return false;
      }

      if (password.trim() !== confirmPassword.trim()) {
        Alert.alert("Password Mismatch", "Passwords do not match.");
        setStep(0);
        return false;
      }
    }

    if (username.trim() && normalize(username).length < 4) {
      Alert.alert("Invalid Username", "Username must be at least 4 characters.");
      setStep(0);
      return false;
    }

    if (!businessAddress.trim() || !city.trim() || !stateValue.trim() || !zipCode.trim()) {
      Alert.alert("Missing Address", "Business address, city, state, and zip code are required.");
      setStep(1);
      return false;
    }

    if (!full) return true;

    if (!mdotNumber.trim() || !mcNumber.trim()) {
      Alert.alert("Missing Authority", "MDOT number and MC number are required.");
      setStep(2);
      return false;
    }

    if (!insuranceProvider.trim() || !insurancePolicyNumber.trim()) {
      Alert.alert("Missing Insurance", "Insurance provider and policy number are required.");
      setStep(2);
      return false;
    }

    if (!authorityActive || !insuranceActive) {
      Alert.alert("Verification Required", "Confirm active authority and insurance.");
      setStep(2);
      return false;
    }

    if (!licensedLivestock && !licensedRefrigeratedFood) {
      Alert.alert("License Required", "Select livestock, refrigerated food, or refrigerated produce.");
      setStep(2);
      return false;
    }

    if (!hasRequiredDocuments(documents)) {
      const missingDocs = REQUIRED_DOCUMENTS.filter((doc) => !clean(documents[doc.key])).map((doc) => doc.label);
      Alert.alert("Documents Required", `Upload these required documents: ${missingDocs.join(", ")}.`);
      setStep(3);
      return false;
    }

    if (selectedQuestions.length !== 3 || new Set(selectedQuestions).size !== 3) {
      Alert.alert("Security Questions Required", "Please choose 3 different security questions.");
      setStep(4);
      return false;
    }

    const missingSecurityAnswers =
      (!securityAnswer1.trim() && !hasSavedSecurityAnswer1) ||
      (!securityAnswer2.trim() && !hasSavedSecurityAnswer2) ||
      (!securityAnswer3.trim() && !hasSavedSecurityAnswer3);

    if (missingSecurityAnswers) {
      Alert.alert("Security Answers Required", "Please answer all 3 security questions.");
      setStep(4);
      return false;
    }

    return true;
  }

  async function generateFreightAccountId() {
    try {
      const { data, error } = await supabase.rpc("next_account_id", { p_role: "freight", p_prefix: "Freight" });
      if (!error && data) return String(data);
    } catch (error) {
      console.log("next_account_id skipped:", error);
    }

    return makeFallbackAccountId();
  }

  async function findFreightUserByIdOrEmail(
    targetId?: string,
    targetEmail?: string
  ) {
    const id = clean(targetId);
    const emailValue = normalize(targetEmail);

    /*
      Do not use .or("id.eq...,freight_id.eq...").
      A missing freight_id column or malformed PostgREST OR expression causes
      repeated 400 responses. Search each confirmed field independently.
    */
    if (id) {
      const { data, error } = await supabase
        .from("freight_users")
        .select("*")
        .eq("id", id)
        .limit(1)
        .maybeSingle();

      if (!error && data) return data;
      if (error) console.log("freight lookup by id:", error.message);
    }

    if (emailValue) {
      const { data, error } = await supabase
        .from("freight_users")
        .select("*")
        .eq("email", emailValue)
        .limit(1)
        .maybeSingle();

      if (!error && data) return data;
      if (error) console.log("freight lookup by email:", error.message);
    }

    return null;
  }

  function getMissingColumnName(error: any) {
    const message = clean(error?.message || error?.details || "");

    const patterns = [
      /Could not find the '([^']+)' column/i,
      /column ["']?([a-zA-Z0-9_]+)["']? does not exist/i,
      /column freight_users\.([a-zA-Z0-9_]+) does not exist/i,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match?.[1]) return match[1];
    }

    return "";
  }

  async function saveFreightUserAdaptively(
    freightUserId: string,
    payload: Record<string, any>,
    createIfMissing = false
  ) {
    let workingPayload = { ...payload };
    const skippedColumns: string[] = [];

    /*
      Retry after removing only the unsupported field named by Supabase.
      This avoids dozens of separate PATCH requests while preventing one optional
      column from blocking the complete freight registration.
    */
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const request = createIfMissing
        ? supabase
            .from("freight_users")
            .insert(workingPayload)
            .select("*")
            .maybeSingle()
        : supabase
            .from("freight_users")
            .update(workingPayload)
            .eq("id", freightUserId)
            .select("*")
            .maybeSingle();

      const { data, error } = await request;

      if (!error) {
        if (skippedColumns.length) {
          console.log(
            "Unsupported freight_users fields skipped:",
            skippedColumns
          );
        }

        return data;
      }

      const missingColumn = getMissingColumnName(error);

      if (missingColumn && Object.prototype.hasOwnProperty.call(workingPayload, missingColumn)) {
        skippedColumns.push(missingColumn);
        const nextPayload = { ...workingPayload };
        delete nextPayload[missingColumn];
        workingPayload = nextPayload;
        continue;
      }

      throw error;
    }

    throw new Error(
      "Unable to save freight registration after removing unsupported fields."
    );
  }

  async function findProfileByEmail(targetEmail: string) {
    const emailValue = normalize(targetEmail);
    if (!emailValue) return null;

    const { data, error } = await supabase.from("profiles").select("*").eq("email", emailValue).maybeSingle();
    if (error) {
      console.log("profile lookup error:", error.message);
      return null;
    }

    return data || null;
  }

  async function findProfileByAuthId(authId: string) {
    if (!isUuid(authId)) return null;

    const byId = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authId)
      .limit(1)
      .maybeSingle();

    if (!byId.error && byId.data) return byId.data;

    const byAuthUserId = await supabase
      .from("profiles")
      .select("*")
      .eq("auth_user_id", authId)
      .limit(1)
      .maybeSingle();

    if (!byAuthUserId.error && byAuthUserId.data) return byAuthUserId.data;

    if (byId.error) console.log("profile lookup id error:", byId.error.message);
    if (byAuthUserId.error) {
      console.log(
        "profile lookup auth_user_id error:",
        byAuthUserId.error.message
      );
    }

    return null;
  }

  async function getBestFreightSubscription(
    targetId?: string,
    targetEmail?: string
  ) {
    const id = clean(targetId);
    const emailValue = normalize(targetEmail);
    const candidates: any[] = [];

    if (id) {
      const { data, error } = await supabase
        .from("freight_subscriptions")
        .select("*")
        .eq("freight_id", id)
        .order("updated_at", { ascending: false })
        .limit(10);

      if (!error && Array.isArray(data)) candidates.push(...data);
      if (error) {
        console.log("subscription lookup by freight_id:", error.message);
      }
    }

    if (emailValue) {
      const { data, error } = await supabase
        .from("freight_subscriptions")
        .select("*")
        .eq("freight_email", emailValue)
        .order("updated_at", { ascending: false })
        .limit(10);

      if (!error && Array.isArray(data)) {
        const existingIds = new Set(candidates.map((row) => row.id));
        candidates.push(...data.filter((row) => !existingIds.has(row.id)));
      }

      if (error) {
        console.log("subscription lookup by email:", error.message);
      }
    }

    if (!candidates.length) return null;

    const completeRow = candidates.find(
      (row) =>
        pickStripeCustomerId(row?.stripe_customer_id) &&
        pickStripeSubscriptionId(row?.stripe_subscription_id) &&
        pickStripeConnectAccountId(
          row?.freight_account,
          row?.stripe_account_id
        )
    );

    return completeRow || candidates[0];
  }

  async function upsertProfileForFreight(authId: string, emailValue: string, accountValue: string, connectValue: string) {
    /*
      IMPORTANT FIX:
      Do NOT PATCH or INSERT into public.profiles from this registration page.

      The 409 Conflict shown in the browser console was caused by this page trying to
      update profiles with values that can conflict with an existing unique email,
      username, account_id, or auth_user_id. Freight registration should save freight
      onboarding data in freight_users, freight_subscriptions, and admin_verifications.

      We only read profiles to reuse the existing id when it exists. If no profile row
      is found, we safely use the Auth id as the profile_id reference without touching
      the profiles table.
    */
    const existingByEmail = await findProfileByEmail(emailValue);
    const existingByAuth = existingByEmail ? null : await findProfileByAuthId(authId);
    const existing = existingByEmail || existingByAuth;

    return {
      id: clean(existing?.id || authId),
      auth_user_id: clean(existing?.auth_user_id || authId),
      role: "freight",
      full_name: contactName.trim(),
      email: normalize(emailValue),
      phone: phone.trim(),
      account_id: accountValue,
      freight_account: connectValue || null,
      stripe_account_id: connectValue || null,
    };
  }

  async function upsertFreightSubscriptionRow(values: {
    freightId: string;
    emailValue: string;
    customerId?: string;
    subscriptionValue?: string;
    connectValue?: string;
    subscriptionStatusValue?: string;
  }) {
    const now = new Date().toISOString();
    const connect = pickStripeConnectAccountId(values.connectValue);
    const sub = pickStripeSubscriptionId(values.subscriptionValue);
    const customer = pickStripeCustomerId(values.customerId);

    const payload = {
      freight_id: values.freightId,
      freight_email: normalize(values.emailValue),
      name: companyName.trim(),
      username: normalize(username),
      stripe_customer_id: customer || null,
      stripe_subscription_id: sub || null,
      subscription_status:
        values.subscriptionStatusValue ||
        (sub ? "active" : "pending_payment"),
      stripe_account_id: connect || null,
      freight_account: connect || null,
      updated_at: now,
    };

    let existingId = "";

    if (values.freightId) {
      const byFreightId = await supabase
        .from("freight_subscriptions")
        .select("id")
        .eq("freight_id", values.freightId)
        .limit(1)
        .maybeSingle();

      if (!byFreightId.error && byFreightId.data?.id) {
        existingId = byFreightId.data.id;
      }
    }

    if (!existingId && normalize(values.emailValue)) {
      const byEmail = await supabase
        .from("freight_subscriptions")
        .select("id")
        .eq("freight_email", normalize(values.emailValue))
        .limit(1)
        .maybeSingle();

      if (!byEmail.error && byEmail.data?.id) {
        existingId = byEmail.data.id;
      }
    }

    if (existingId) {
      const { error } = await supabase
        .from("freight_subscriptions")
        .update(payload)
        .eq("id", existingId);

      if (error) throw error;
      return;
    }

    const { error } = await supabase
      .from("freight_subscriptions")
      .insert({
        ...payload,
        created_at: now,
      });

    if (error) throw error;
  }

  async function saveAdminVerificationIfTableExists(carrierId: string, savedFreightUser: any) {
    const now = new Date().toISOString();
    const paid = Boolean(savedFreightUser.subscription_id);
    const docsOk = hasRequiredDocuments(savedFreightUser);
    const complete = paid && docsOk && isStripeConnectAccountId(savedFreightUser.freight_account);

    const payload = {
      id: carrierId,
      account_id: savedFreightUser.account_id,
      carrier_id: carrierId,
      freight_id: carrierId,
      profile_id: savedFreightUser.profile_id,
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
      cdl_document: documents.cdl_document || null,
      dot_document: documents.dot_document || null,
      mc_authority_document: documents.mc_authority_document || null,
      insurance_document: documents.insurance_document || null,
      w9_document: documents.w9_document || null,
      vehicle_registration_document: documents.vehicle_registration_document || null,
      cargo_insurance_document: documents.cargo_insurance_document || null,
      business_license_document: documents.business_license_document || null,
      hipaa_certificate: documents.hipaa_certificate || null,
      bloodborne_certificate: documents.bloodborne_certificate || null,
      tsa_certificate: documents.tsa_certificate || null,
      food_handling_certificate: documents.food_handling_certificate || null,
      documents_complete: docsOk,
      status: complete ? "SUBMITTED" : docsOk ? "PENDING_PAYMENT" : "PENDING_DOCUMENTS",
      compliance_status: complete ? "SUBMITTED" : docsOk ? "PENDING_PAYMENT" : "PENDING_DOCUMENTS",
      admin_review_status: complete ? "submitted" : docsOk ? "pending_payment" : "pending_documents",
      approved: complete,
      rejected: false,
      reviewed: false,
      needs_more_info: false,
      account_active: complete,
      membership_status: paid ? "active" : "pending_payment",
      subscription_status: subscriptionStatus || (paid ? "active" : "pending_payment"),
      freight_membership_paid: paid,
      application_submitted: complete,
      submitted_at: complete ? now : null,
      stripe_customer_id: savedFreightUser.stripe_customer_id || null,
      freight_account: savedFreightUser.freight_account || null,
      stripe_account_id: savedFreightUser.freight_account || null,
      stripe_subscription_id: savedFreightUser.subscription_id || null,
      subscription_id: savedFreightUser.subscription_id || null,
      updated_at: now,
      created_at: now,
    };

    const existingVerification = await supabase
      .from("admin_verifications")
      .select("id")
      .eq("id", carrierId)
      .limit(1)
      .maybeSingle();

    if (!existingVerification.error && existingVerification.data?.id) {
      const { error } = await supabase
        .from("admin_verifications")
        .update(payload)
        .eq("id", carrierId);

      if (error) {
        console.log("admin_verifications update skipped:", error.message);
      }
      return;
    }

    const { error } = await supabase
      .from("admin_verifications")
      .insert(payload);

    if (error) {
      console.log("admin_verifications insert skipped:", error.message);
    }
  }

  async function saveFreightUserRow(authId: string, passedAccountId?: string) {
    const now = new Date().toISOString();
    const emailValue = normalize(email);
    const existing = await findFreightUserByIdOrEmail(authId, emailValue);
    const subRow = await getBestFreightSubscription(authId, emailValue);

    const existingAccountId = clean(existing?.account_id);
    const requestedAccountId = clean(passedAccountId || accountId);

    const validExistingFreightAccountId = /^Freight_\d+$/i.test(existingAccountId)
      ? existingAccountId
      : "";

    const validRequestedFreightAccountId = /^Freight_\d+$/i.test(requestedAccountId)
      ? requestedAccountId
      : "";

    const finalAccountId =
      validExistingFreightAccountId ||
      validRequestedFreightAccountId ||
      (await generateFreightAccountId());
    const finalCustomerId = pickStripeCustomerId(stripeCustomerId, existing?.stripe_customer_id, subRow?.stripe_customer_id);
    const finalSubscriptionId = pickStripeSubscriptionId(subscriptionId, existing?.subscription_id, subRow?.stripe_subscription_id);
    const finalConnectAccount = pickStripeConnectAccountId(freightAccount, existing?.freight_account, subRow?.freight_account, subRow?.stripe_account_id);
    const finalStatus = subscriptionStatus || subRow?.subscription_status || (finalSubscriptionId ? "active" : "pending_payment");
    const docsOk = hasRequiredDocuments(documents);
    const complete = Boolean(authId && finalAccountId && finalCustomerId && finalSubscriptionId && finalConnectAccount && docsOk);

    const profile = await upsertProfileForFreight(authId, emailValue, finalAccountId, finalConnectAccount);
    if (!profile?.id) throw new Error("Profile could not be created.");

    const freightPayload: any = {
      id: authId,
      freight_id: authId,
      auth_user_id: authId,
      profile_id: profile.id,
      role: "freight",
      company_name: companyName.trim(),
      business_name: companyName.trim(),
      contact_name: contactName.trim(),
      full_name: contactName.trim(),
      name: contactName.trim(),
      owner_name: contactName.trim(),
      email: emailValue,
      phone: phone.trim(),
      username: normalize(username),
      account_id: finalAccountId,
      stripe_customer_id: finalCustomerId || null,
      subscription_id: finalSubscriptionId || null,
      freight_account: finalConnectAccount || null,
      account_active: complete,
      approved: complete,
      freight_membership_paid: Boolean(finalSubscriptionId),
      membership_status: finalSubscriptionId ? "active" : "pending_payment",
      verification_status: complete ? "SUBMITTED" : docsOk ? "REGISTERED" : "PENDING_DOCUMENTS",
      compliance_status: complete ? "SUBMITTED" : docsOk ? "PENDING_PAYMENT" : "PENDING_DOCUMENTS",
      admin_review_status: complete ? "submitted" : docsOk ? "pending_payment" : "pending_documents",
      security_question_1: securityQuestion1,
      security_question_2: securityQuestion2,
      security_question_3: securityQuestion3,
      security_answer_1: securityAnswer1.trim() ? normalizeAnswer(securityAnswer1) : existing?.security_answer_1 || null,
      security_answer_2: securityAnswer2.trim() ? normalizeAnswer(securityAnswer2) : existing?.security_answer_2 || null,
      security_answer_3: securityAnswer3.trim() ? normalizeAnswer(securityAnswer3) : existing?.security_answer_3 || null,
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
      equipment_type: selectedEquipment.join(","),
      equipment_types: selectedEquipment.join(","),
      cdl_document: documents.cdl_document || null,
      dot_document: documents.dot_document || null,
      mc_authority_document: documents.mc_authority_document || null,
      insurance_document: documents.insurance_document || null,
      w9_document: documents.w9_document || null,
      vehicle_registration_document: documents.vehicle_registration_document || null,
      cargo_insurance_document: documents.cargo_insurance_document || null,
      business_license_document: documents.business_license_document || null,
      hipaa_certificate: documents.hipaa_certificate || null,
      bloodborne_certificate: documents.bloodborne_certificate || null,
      tsa_certificate: documents.tsa_certificate || null,
      food_handling_certificate: documents.food_handling_certificate || null,
      documents_complete: docsOk,
      updated_at: now,
    };

    let savedFreightUser: any = null;

    if (existing?.id) {
      savedFreightUser = await saveFreightUserAdaptively(
        existing.id,
        freightPayload,
        false
      );
    } else {
      /*
        Create the row with the required identity fields first. The adaptive
        insert removes only optional fields that do not exist in the deployed
        freight_users schema.
      */
      savedFreightUser = await saveFreightUserAdaptively(
        authId,
        {
          ...freightPayload,
          created_at: now,
        },
        true
      );
    }

    if (!savedFreightUser?.id) {
      const reread = await findFreightUserByIdOrEmail(authId, emailValue);
      if (!reread?.id) {
        throw new Error("Freight registration did not save.");
      }
      savedFreightUser = reread;
    }

    await upsertFreightSubscriptionRow({
      freightId: authId,
      emailValue,
      customerId: finalCustomerId,
      subscriptionValue: finalSubscriptionId,
      connectValue: finalConnectAccount,
      subscriptionStatusValue: finalStatus,
    });

    await saveAdminVerificationIfTableExists(authId, savedFreightUser);

    const finalRow = {
      ...savedFreightUser,
      stripe_subscription_id: savedFreightUser.subscription_id,
      stripe_account_id: savedFreightUser.freight_account,
      subscription_status: finalStatus,
    };

    hydrateForm(finalRow);
    await saveFreightSession(finalRow);

    setSavedCarrierId(savedFreightUser.id);
    setFreightId(savedFreightUser.id);
    setProfileId(clean(savedFreightUser.profile_id));
    setAccountId(clean(savedFreightUser.account_id));
    setStripeCustomerId(pickStripeCustomerId(savedFreightUser.stripe_customer_id));
    setSubscriptionId(pickStripeSubscriptionId(savedFreightUser.subscription_id));
    setFreightAccount(pickStripeConnectAccountId(savedFreightUser.freight_account));
    setSubscriptionStatus(finalStatus);
    setHasSavedSecurityAnswer1(Boolean(savedFreightUser.security_answer_1));
    setHasSavedSecurityAnswer2(Boolean(savedFreightUser.security_answer_2));
    setHasSavedSecurityAnswer3(Boolean(savedFreightUser.security_answer_3));
    setSecurityAnswer1("");
    setSecurityAnswer2("");
    setSecurityAnswer3("");

    return finalRow;
  }

  async function getOrCreateAuthUser() {
    const emailValue = normalize(email);
    const { data: currentUserData } = await supabase.auth.getUser();
    if (currentUserData?.user?.id) return currentUserData.user.id;

    const existingFreightUser = await findFreightUserByIdOrEmail("", emailValue);
    if (existingFreightUser?.id) return existingFreightUser.id;

    const { data, error } = await supabase.auth.signUp({
      email: emailValue,
      password: password.trim(),
      options: {
        data: {
          role: "freight",
          username: normalize(username),
          company_name: companyName.trim(),
          contact_name: contactName.trim(),
          full_name: contactName.trim(),
        },
      },
    });

    if (error) throw error;
    if (!data?.user?.id) throw new Error("Unable to create freight Auth user.");
    return data.user.id;
  }

  async function saveFreightProfile(fullValidation = false, showSuccessAlert = true) {
    if (saving) return null;
    if (!validateForm({ full: fullValidation })) return null;

    try {
      setSaving(true);
      const authId = savedCarrierId || freightId || (await getOrCreateAuthUser());
      const saved = await saveFreightUserRow(authId, accountId || undefined);
      if (showSuccessAlert) Alert.alert("Saved", "Freight registration was saved.");
      return saved;
    } catch (error: any) {
      Alert.alert("Save Error", error?.message || "Unable to save freight registration.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function syncStripeFromBackend(silent = false) {
    const emailValue = normalize(email);
    const id = savedCarrierId || freightId;

    if (!emailValue && !id) {
      if (!silent) Alert.alert("Search Required", "Enter email or save registration first.");
      return null;
    }

    try {
      setSyncingStripe(true);

      const response = await fetch(`${API_BASE_URL}/payments/sync-stripe-by-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "freight",
          email: emailValue,
          freight_email: emailValue,
          businessName: companyName.trim(),
          companyName: companyName.trim(),
          name: companyName.trim() || contactName.trim(),
          username: normalize(username),
          userId: id,
          freightId: id,
          freight_id: id,
        }),
      });

      const json = await parseApiResponse(response);
      if (!response.ok || !json.success) {
        if (!silent) Alert.alert("Stripe Sync Not Found", json.error || "No Stripe customer/subscription was found.");
        return null;
      }

      const customer = pickStripeCustomerId(json.stripeCustomerId, json.stripe_customer_id);
      const sub = pickStripeSubscriptionId(json.stripeSubscriptionId, json.stripe_subscription_id);
      const connect = pickStripeConnectAccountId(json.freight_account, json.stripeAccountId, json.stripe_account_id);
      const status = json.subscriptionStatus || json.subscription_status || "active";

      if (customer) setStripeCustomerId(customer);
      if (sub) setSubscriptionId(sub);
      if (connect) setFreightAccount(connect);
      setSubscriptionStatus(status);

      const authId = id || (await getOrCreateAuthUser());
      const saved = await saveFreightUserRow(authId, accountId || undefined);

      if (!silent) Alert.alert("Stripe Retrieved", "Stripe customer, subscription, and Connect data were saved.");
      return saved;
    } catch (error: any) {
      if (!silent) Alert.alert("Retrieve Error", error?.message || "Unable to retrieve Stripe information.");
      return null;
    } finally {
      setSyncingStripe(false);
    }
  }

  async function retrieveMissingStripeInfo(routeWhenReady = false) {
    try {
      setSyncingStripe(true);
      const id = savedCarrierId || freightId || clean(String(params?.freightId || params?.freight_id || ""));
      const emailValue = normalize(email || String(params?.email || ""));

      const dbCarrier = await findFreightUserByIdOrEmail(id, emailValue);
      const subRow = await getBestFreightSubscription(dbCarrier?.id || id, dbCarrier?.email || emailValue);

      if (!dbCarrier && !subRow) {
        const backendSynced = await syncStripeFromBackend(true);
        if (!backendSynced) Alert.alert("Not Found", "No freight registration or Stripe subscription was found.");
        return backendSynced;
      }

      if (dbCarrier) hydrateForm(dbCarrier);

      const targetId = clean(dbCarrier?.id || dbCarrier?.freight_id || subRow?.freight_id || id);
      const customer = pickStripeCustomerId(dbCarrier?.stripe_customer_id, subRow?.stripe_customer_id);
      const sub = pickStripeSubscriptionId(dbCarrier?.subscription_id, subRow?.stripe_subscription_id);
      const connect = pickStripeConnectAccountId(dbCarrier?.freight_account, subRow?.freight_account, subRow?.stripe_account_id);
      const status = clean(dbCarrier?.subscription_status || subRow?.subscription_status || (sub ? "active" : "pending_payment"));

      if (customer) setStripeCustomerId(customer);
      if (sub) setSubscriptionId(sub);
      if (connect) setFreightAccount(connect);
      setSubscriptionStatus(status);

      if (!targetId) {
        Alert.alert("Save Needed", "Save the freight profile before syncing Stripe information.");
        return null;
      }

      const saved = await saveFreightUserRow(targetId, dbCarrier?.account_id || accountId || undefined);

      if (routeWhenReady && hasCompleteDashboardAccess(saved)) goDashboard();
      else Alert.alert("Stripe Info Retrieved", "Missing Stripe fields were synced and saved.");

      return saved;
    } catch (error: any) {
      Alert.alert("Retrieve Error", error?.message || "Unable to retrieve freight Stripe information.");
      return null;
    } finally {
      setSyncingStripe(false);
    }
  }

  async function loadSavedFreight() {
    try {
      const returnedId = clean(String(params?.freightId || params?.freight_id || ""));
      const returnedEmail = normalize(String(params?.email || ""));

      const savedRaw =
        (await AsyncStorage.getItem("pendingFreightCarrier")) ||
        (await AsyncStorage.getItem("currentFreightCarrier")) ||
        (await AsyncStorage.getItem("currentFreight")) ||
        (await AsyncStorage.getItem("currentFreightUser")) ||
        (await AsyncStorage.getItem("farm2homeCurrentFreight")) ||
        (await AsyncStorage.getItem("currentUser"));

      let localCarrier: any = null;
      if (savedRaw) {
        try {
          localCarrier = JSON.parse(savedRaw);
          hydrateForm(localCarrier);
        } catch {
          localCarrier = null;
        }
      }

      const { data: authData } = await supabase.auth.getUser();
      const authId = clean(authData?.user?.id || "");
      const authEmail = normalize(authData?.user?.email || "");

      const lookupId = returnedId || authId || localCarrier?.id || localCarrier?.freight_id || localCarrier?.freightId || savedCarrierId || freightId;
      const lookupEmail = normalize(returnedEmail || authEmail || localCarrier?.email || email);

      if (!lookupId && !lookupEmail) return;

      const dbCarrier = await findFreightUserByIdOrEmail(lookupId, lookupEmail);
      const subRow = await getBestFreightSubscription(dbCarrier?.id || lookupId, dbCarrier?.email || lookupEmail);

      if (dbCarrier) hydrateForm(dbCarrier);

      if (subRow) {
        const merged = {
          ...(dbCarrier || {}),
          id: dbCarrier?.id || subRow.freight_id || lookupId,
          freight_id: dbCarrier?.freight_id || subRow.freight_id || lookupId,
          email: dbCarrier?.email || subRow.freight_email || lookupEmail,
          company_name: dbCarrier?.company_name || subRow.name || companyName,
          business_name: dbCarrier?.business_name || subRow.name || companyName,
          name: dbCarrier?.name || subRow.name || contactName,
          stripe_customer_id: pickStripeCustomerId(dbCarrier?.stripe_customer_id, subRow.stripe_customer_id),
          subscription_id: pickStripeSubscriptionId(dbCarrier?.subscription_id, subRow.stripe_subscription_id),
          subscription_status: subRow.subscription_status || subscriptionStatus,
          freight_account: pickStripeConnectAccountId(dbCarrier?.freight_account, subRow.freight_account, subRow.stripe_account_id),
        };

        hydrateForm(merged);
        await saveFreightSession(merged);
      }
    } catch (error) {
      console.log("loadSavedFreight error:", error);
    }
  }

  async function handleStripeSuccessReturn(returnedFreightId?: string) {
    const id = clean(returnedFreightId || savedCarrierId || freightId);
    if (!id && !email) return;
    await retrieveMissingStripeInfo(false);
  }

  async function handleConnectSuccessReturn(returnedFreightId?: string) {
    const id = clean(returnedFreightId || savedCarrierId || freightId);
    if (!id && !email) return;
    await retrieveMissingStripeInfo(false);
  }

  async function handleStripeCheckout() {
    const saved = await saveFreightProfile(false);
    if (!saved?.id) return;

    try {
      setStripeLoading(true);
      const response = await fetch(`${API_BASE_URL}/payments/create-freight-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "freight",
          freightId: saved.id,
          freight_id: saved.id,
          userId: saved.id,
          email: normalize(email),
          freight_email: normalize(email),
          accountId: saved.account_id,
          account_id: saved.account_id,
          name: companyName.trim(),
          username: normalize(username),
          successUrl: `${APP_URL}/freight/register?stripe=success&freightId=${saved.id}&email=${normalize(email)}`,
          cancelUrl: `${APP_URL}/freight/register?stripe=cancel&freightId=${saved.id}&email=${normalize(email)}`,
        }),
      });

      const json = await parseApiResponse(response);
      const url = getStripeLaunchUrl(json);
      if (!response.ok || !url) throw new Error(json.error || "Unable to create Stripe Checkout session.");
      await openUrl(url);
    } catch (error: any) {
      Alert.alert("Stripe Error", error?.message || "Unable to start freight membership.");
    } finally {
      setStripeLoading(false);
    }
  }

  async function handleConnectBank() {
    const saved = await saveFreightProfile(false);
    if (!saved?.id) return;

    try {
      setConnectLoading(true);
      const response = await fetch(`${API_BASE_URL}/payments/create-connect-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "freight",
          freightId: saved.id,
          freight_id: saved.id,
          userId: saved.id,
          accountId: saved.account_id,
          account_id: saved.account_id,
          email: normalize(email),
          freight_email: normalize(email),
          name: companyName.trim(),
          businessName: companyName.trim(),
          companyName: companyName.trim(),
          returnUrl: `${APP_URL}/freight/register?connect=success&freightId=${saved.id}&email=${normalize(email)}`,
          refreshUrl: `${APP_URL}/freight/register?connect=refresh&freightId=${saved.id}&email=${normalize(email)}`,
        }),
      });

      const json = await parseApiResponse(response);
      const connectAccount = pickStripeConnectAccountId(json.stripeAccountId, json.stripe_account_id, json.freight_account, json.accountId);
      const url = getStripeLaunchUrl(json);

      if (connectAccount) {
        setFreightAccount(connectAccount);
        await saveFreightUserRow(saved.id, saved.account_id);
      }

      if (!response.ok || !url) throw new Error(json.error || "Unable to create Stripe Connect link.");
      await openUrl(url);
    } catch (error: any) {
      Alert.alert("Connect Error", error?.message || "Unable to connect Stripe payouts.");
    } finally {
      setConnectLoading(false);
    }
  }

  async function handleSubmitAndDashboard() {
    if (saving) return;

    try {

      /*
        saveFreightProfile(true) already persists the complete freight_users row,
        freight_subscriptions row, equipment types, documents, Stripe IDs, and
        the normalized freight session.

        The previous submit handler performed a second PATCH against freight_users
        with optional columns such as application_submitted and submitted_at.
        In the deployed database, at least one of those columns is unavailable,
        which caused the final 400 Bad Request and prevented dashboard navigation.
      */
      const saved = await saveFreightProfile(true);
      if (!saved?.id) return;

      if (!hasCompleteDashboardAccess(saved)) {
        const missing = [
          !saved.id ? "Freight Profile" : "",
          !/^Freight_\d+$/i.test(clean(saved.account_id)) ? "Valid Freight Account ID" : "",
          !hasRequiredDocuments(saved) ? "Required Documents" : "",
          !isStripeCustomerId(saved.stripe_customer_id) ? "Stripe Customer ID" : "",
          !isStripeSubscriptionId(saved.subscription_id) ? "Subscription ID" : "",
          !isStripeConnectAccountId(saved.freight_account) ? "Stripe Connect Account" : "",
        ].filter(Boolean);

        Alert.alert("Setup Incomplete", `Missing: ${missing.join(", ")}.`);
        setStep(5);
        return;
      }

      const finalFreightAccountId = /^Freight_\d+$/i.test(
        clean(saved.account_id)
      )
        ? clean(saved.account_id)
        : clean(accountId) || (await generateFreightAccountId());

      const dashboardRow = {
        ...saved,
        account_id: finalFreightAccountId,
        accountId: finalFreightAccountId,
        role: "freight",
        freightId: saved.freight_id || saved.id,
        freight_id: saved.freight_id || saved.id,
        stripeCustomerId: saved.stripe_customer_id,
        stripe_customer_id: saved.stripe_customer_id,
        stripeSubscriptionId: saved.subscription_id,
        stripe_subscription_id: saved.subscription_id,
        subscriptionId: saved.subscription_id,
        subscription_id: saved.subscription_id,
        freightAccount: saved.freight_account,
        freight_account: saved.freight_account,
        stripeAccountId: saved.freight_account,
        stripe_account_id: saved.freight_account,
        documents_complete: true,
        account_active: true,
        freight_membership_paid: true,
        membership_status: "active",
        subscription_status: saved.subscription_status || "active",
        equipment_type: clean(saved.equipment_type || selectedEquipment.join(",")),
      };

      await saveFreightSession(dashboardRow);

      /*
        Use replace after the local session is fully written. No additional
        freight_users PATCH is needed here.
      */
      router.replace({
        pathname: "/freight/dashboard",
        params: {
          freightId: dashboardRow.freight_id,
          accountId: dashboardRow.account_id,
        },
      } as any);
    } catch (error: any) {
      console.log("Submit freight dashboard error:", error);
      Alert.alert(
        "Dashboard Login Error",
        error?.message || "Your freight information is saved, but the dashboard could not be opened."
      );
    } finally {
      setSaving(false);
    }
  }

  async function forceRefreshFreightRegister() {
    try {
      setSyncingStripe(true);
      await supabase.auth.refreshSession();
      await loadSavedFreight();
      await retrieveMissingStripeInfo(false);
      Alert.alert("Updated", "Freight registration refreshed without clearing your form.");
    } catch (error: any) {
      Alert.alert("Refresh Error", error?.message || "Unable to refresh registration.");
    } finally {
      setSyncingStripe(false);
    }
  }

  function renderQuestionPicker(value: string, setValue: (v: string) => void, label: string, usedValues: string[]) {
    return (
      <View style={styles.questionBlock}>
        <Text style={styles.inputLabel}>{label}</Text>
        <View style={styles.questionGrid}>
          {SECURITY_QUESTIONS.map((question) => {
            const selected = value === question;
            const disabled = !selected && usedValues.includes(question);
            return (
              <TouchableOpacity
                key={question}
                disabled={disabled}
                onPress={() => setValue(question)}
                style={[styles.questionChip, selected && styles.questionChipSelected, disabled && styles.questionChipDisabled]}
                activeOpacity={0.9}
              >
                <Text style={[styles.questionChipText, selected && styles.questionChipTextSelected, disabled && styles.questionChipTextDisabled]}>
                  {question}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  function renderDocumentUpload(doc: { key: DocumentKey; label: string; required?: boolean }) {
    const value = documents[doc.key];
    const complete = Boolean(clean(value));

    return (
      <View key={doc.key} style={styles.documentRow}>
        <View style={[styles.documentIcon, complete ? styles.statusGood : styles.statusMissing]}>
          <Ionicons name={complete ? "checkmark-outline" : "document-attach-outline"} size={18} color={complete ? COLORS.white : COLORS.muted} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.documentTitle}>
            {doc.label} {doc.required ? <Text style={styles.requiredText}>*</Text> : null}
          </Text>
          <Text style={styles.documentValue}>{complete ? getDocumentName(value) : "No file uploaded"}</Text>
        </View>

        <TouchableOpacity style={styles.smallButton} onPress={() => pickDocument(doc.key)} activeOpacity={0.9}>
          <Text style={styles.smallButtonText}>{complete ? "Replace" : "Upload"}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderStep() {
    if (step === 0) {
      return (
        <View>
          <SectionTitle title="Account Information" subtitle="Create or retrieve your freight account." />
          <Field label="Company Name" value={companyName} onChangeText={setCompanyName} placeholder="ASO Freight LLC" icon="business-outline" />
          <Field label="Contact Name" value={contactName} onChangeText={setContactName} placeholder="Owner / Dispatcher" icon="person-outline" />
          <Field label="Email" value={email} onChangeText={(v) => setEmail(normalize(v))} placeholder="freight@email.com" icon="mail-outline" keyboardType="email-address" />
          <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="(555) 555-5555" icon="call-outline" keyboardType="phone-pad" />
          <Field label="Username" value={username} onChangeText={setUsername} placeholder="freightcarrier" icon="at-outline" />
          {!savedCarrierId && !freightId ? (
            <>
              <Field label="Password" value={password} onChangeText={setPassword} placeholder="Create password" icon="lock-closed-outline" secureTextEntry />
              <Field label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm password" icon="lock-closed-outline" secureTextEntry />
            </>
          ) : null}
        </View>
      );
    }

    if (step === 1) {
      return (
        <View>
          <SectionTitle title="Company Location" subtitle="Business address and service area." />
          <Field label="Business Address" value={businessAddress} onChangeText={setBusinessAddress} placeholder="Street address" icon="location-outline" />
          <Field label="City" value={city} onChangeText={setCity} placeholder="Detroit" icon="business-outline" />
          <Field label="State" value={stateValue} onChangeText={setStateValue} placeholder="MI" icon="map-outline" />
          <Field label="Zip Code" value={zipCode} onChangeText={setZipCode} placeholder="48201" icon="navigate-outline" keyboardType="number-pad" />
          <Field label="Service Area" value={serviceArea} onChangeText={setServiceArea} placeholder="Michigan, Midwest, nationwide..." icon="earth-outline" multiline />
        </View>
      );
    }

    if (step === 2) {
      return (
        <View>
          <SectionTitle title="Authority & Insurance" subtitle="Carrier operating details required for review." />
          <Field label="MDOT / DOT Number" value={mdotNumber} onChangeText={setMdotNumber} placeholder="DOT number" icon="shield-checkmark-outline" />
          <Field label="MC Number" value={mcNumber} onChangeText={setMcNumber} placeholder="MC number" icon="document-text-outline" />
          <Field label="Insurance Provider" value={insuranceProvider} onChangeText={setInsuranceProvider} placeholder="Insurance carrier" icon="medkit-outline" />
          <Field label="Insurance Policy Number" value={insurancePolicyNumber} onChangeText={setInsurancePolicyNumber} placeholder="Policy number" icon="reader-outline" />

          <ToggleRow title="Active operating authority" value={authorityActive} onValueChange={setAuthorityActive} />
          <ToggleRow title="Active insurance coverage" value={insuranceActive} onValueChange={setInsuranceActive} />
          <ToggleRow title="Licensed for livestock delivery" value={licensedLivestock} onValueChange={setLicensedLivestock} />
          <ToggleRow title="Licensed for refrigerated food / produce" value={licensedRefrigeratedFood} onValueChange={setLicensedRefrigeratedFood} />

          <Text style={styles.inputLabel}>Equipment Types</Text>
          <View style={styles.optionGrid}>
            {EQUIPMENT_OPTIONS.map((item) => {
              const selected = selectedEquipment.includes(item.key);
              return (
                <TouchableOpacity key={item.key} style={[styles.optionChip, selected && styles.optionChipSelected]} onPress={() => toggleEquipment(item.key)}>
                  <Ionicons name={item.icon as any} size={17} color={selected ? COLORS.white : COLORS.primary} />
                  <Text style={[styles.optionChipText, selected && styles.optionChipTextSelected]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
    }

    if (step === 3) {
      return (
        <View>
          <SectionTitle title="Required Documents" subtitle="Upload carrier compliance documents before dashboard approval." />
          <View style={styles.noticeBox}>
            <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
            <Text style={styles.noticeText}>
              Save the profile first if you need documents uploaded into the carrier folder. Required documents are checked during login.
            </Text>
          </View>
          {REQUIRED_DOCUMENTS.map((doc) => renderDocumentUpload(doc))}
          <Text style={styles.groupTitle}>Optional Medical / Specialized Carrier Documents</Text>
          {OPTIONAL_DOCUMENTS.map((doc) => renderDocumentUpload({ ...doc, required: false } as any))}
        </View>
      );
    }

    if (step === 4) {
      const used1 = [securityQuestion2, securityQuestion3].filter(Boolean);
      const used2 = [securityQuestion1, securityQuestion3].filter(Boolean);
      const used3 = [securityQuestion1, securityQuestion2].filter(Boolean);

      return (
        <View>
          <SectionTitle title="Security Recovery" subtitle="Save three recovery questions. Answers are stored normalized for matching." />
          {renderQuestionPicker(securityQuestion1, setSecurityQuestion1, "Security Question 1", used1)}
          <Field label={hasSavedSecurityAnswer1 ? "Answer 1 - saved, enter only to replace" : "Answer 1"} value={securityAnswer1} onChangeText={setSecurityAnswer1} placeholder={hasSavedSecurityAnswer1 ? "Saved answer on file" : "Your answer"} icon="key-outline" secureTextEntry />
          {renderQuestionPicker(securityQuestion2, setSecurityQuestion2, "Security Question 2", used2)}
          <Field label={hasSavedSecurityAnswer2 ? "Answer 2 - saved, enter only to replace" : "Answer 2"} value={securityAnswer2} onChangeText={setSecurityAnswer2} placeholder={hasSavedSecurityAnswer2 ? "Saved answer on file" : "Your answer"} icon="key-outline" secureTextEntry />
          {renderQuestionPicker(securityQuestion3, setSecurityQuestion3, "Security Question 3", used3)}
          <Field label={hasSavedSecurityAnswer3 ? "Answer 3 - saved, enter only to replace" : "Answer 3"} value={securityAnswer3} onChangeText={setSecurityAnswer3} placeholder={hasSavedSecurityAnswer3 ? "Saved answer on file" : "Your answer"} icon="key-outline" secureTextEntry />
        </View>
      );
    }

    if (step === 5) {
      return (
        <View>
          <SectionTitle title="Stripe Membership & Payouts" subtitle="Save subscription and Stripe Connect payout account." />
          <View style={styles.statusList}>
            {setupStatus.map((item) => (
              <View key={item.label} style={styles.statusRow}>
                <View style={[styles.statusIcon, item.complete ? styles.statusGood : styles.statusMissing]}>
                  <Ionicons name={item.complete ? "checkmark-outline" : "ellipse-outline"} size={16} color={item.complete ? COLORS.white : COLORS.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statusLabel}>{item.label}</Text>
                  <Text style={styles.statusValue}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>

          <ActionButton title="Save Profile" subtitle="Save registration fields to freight_users, freight_subscriptions, and admin_verifications." icon="save-outline" loading={saving} onPress={() => saveFreightProfile(false)} />
          <ActionButton title="Find / Retrieve Missing Stripe Info" subtitle="Search existing freight_subscriptions and backend Stripe sync." icon="sync-outline" loading={syncingStripe} onPress={() => retrieveMissingStripeInfo(false)} secondary />
          <ActionButton title="Start Freight Membership" subtitle="Open Stripe Checkout for freight subscription." icon="card-outline" loading={stripeLoading} onPress={handleStripeCheckout} />
          <ActionButton title="Connect Stripe Payouts" subtitle="Open Stripe Connect onboarding for freight_account / stripe_account_id." icon="wallet-outline" loading={connectLoading} onPress={handleConnectBank} secondary />
          <ActionButton title="Refresh Without Clearing Form" subtitle="Reload Supabase and Stripe info without wiping the form." icon="refresh-outline" loading={syncingStripe} onPress={forceRefreshFreightRegister} secondary />
        </View>
      );
    }

    return (
      <View>
        <SectionTitle title="Review & Submit" subtitle="Confirm saved fields and open Freight Dashboard." />
        <ReviewRow label="Company" value={companyName} />
        <ReviewRow label="Contact" value={contactName} />
        <ReviewRow label="Email" value={email} />
        <ReviewRow label="Account ID" value={accountId} />
        <ReviewRow label="Documents" value={documentsComplete ? "Required documents uploaded" : "Missing required documents"} />
        <ReviewRow label="Stripe Customer" value={maskId(stripeCustomerId)} />
        <ReviewRow label="Subscription" value={maskId(subscriptionId)} />
        <ReviewRow label="Stripe Connect" value={maskId(freightAccount)} />

        <View style={styles.noticeBox}>
          <Ionicons name={allRequirementsFound ? "checkmark-circle-outline" : "warning-outline"} size={20} color={allRequirementsFound ? COLORS.accent : COLORS.warning} />
          <Text style={styles.noticeText}>
            {allRequirementsFound
              ? "All dashboard requirements are saved."
              : "Documents, membership, and Stripe Connect must be saved before dashboard routing."}
          </Text>
        </View>

        <TouchableOpacity style={[styles.primaryButton, saving && styles.disabledButton]} onPress={handleSubmitAndDashboard} disabled={saving} activeOpacity={0.9}>
          {saving ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Ionicons name="checkmark-done-outline" size={18} color={COLORS.white} />
              <Text style={styles.primaryButtonText}>Submit & Open Freight Dashboard</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.shell}>
            <View style={styles.sidebar}>
              <View style={styles.brandRow}>
                <View style={styles.brandIcon}>
                  <Ionicons name="trail-sign-outline" size={28} color={COLORS.white} />
                </View>
                <View>
                  <Text style={styles.brandTitle}>Farm2Home</Text>
                  <Text style={styles.brandSubtitle}>Freight Connect</Text>
                </View>
              </View>

              <View style={styles.sideDivider} />

              <View style={styles.scoreCard}>
                <Text style={styles.scoreLabel}>Setup Progress</Text>
                <Text style={styles.scoreValue}>{setupScore}/6</Text>
                <Text style={styles.scoreHint}>Profile, static account, documents, Stripe customer, subscription, and Connect account.</Text>
              </View>

              {STEPS.map((item, index) => {
                const active = index === step;
                const complete = index < step;
                return (
                  <TouchableOpacity key={item.key} style={[styles.stepRow, active && styles.stepRowActive]} onPress={() => setStep(index)} activeOpacity={0.9}>
                    <View style={[styles.stepIcon, active && styles.stepIconActive, complete && styles.stepIconComplete]}>
                      <Ionicons name={(complete ? "checkmark-outline" : item.icon) as any} size={18} color={active || complete ? COLORS.white : "#94A3B8"} />
                    </View>
                    <Text style={[styles.stepText, active && styles.stepTextActive]}>{item.title}</Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity style={styles.homeButton} onPress={() => router.replace("/" as any)} activeOpacity={0.9}>
                <Ionicons name="home-outline" size={18} color={COLORS.primary} />
                <Text style={styles.homeButtonText}>Back to Home</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.main}>
              <View style={styles.card}>
                <View style={styles.headerRow}>
                  <View>
                    <Text style={styles.title}>Freight Carrier Registration</Text>
                    <Text style={styles.subtitle}>Complete onboarding, documents, Stripe membership, and payout setup.</Text>
                  </View>
                  <View style={styles.headerIcon}>
                    <Ionicons name={STEPS[step].icon as any} size={25} color={COLORS.white} />
                  </View>
                </View>

                {renderStep()}

                <View style={styles.footerNav}>
                  <TouchableOpacity style={[styles.navButton, step === 0 && styles.disabledButton]} onPress={goBack} disabled={step === 0}>
                    <Ionicons name="arrow-back-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.navButtonText}>Back</Text>
                  </TouchableOpacity>

                  {step < STEPS.length - 1 ? (
                    <TouchableOpacity style={styles.primaryButton} onPress={goNext}>
                      <Text style={styles.primaryButtonText}>Continue</Text>
                      <Ionicons name="arrow-forward-outline" size={18} color={COLORS.white} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionTitleText}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  secureTextEntry,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  icon: any;
  secureTextEntry?: boolean;
  keyboardType?: any;
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={[styles.inputShell, multiline && styles.inputShellMultiline]}>
        <Ionicons name={icon} size={18} color={COLORS.muted} />
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline]}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          multiline={multiline}
          autoCapitalize="none"
        />
      </View>
    </View>
  );
}

function ToggleRow({ title, value, onValueChange }: { title: string; value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleText}>{title}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: "#CBD5E1", true: "#C7D2FE" }} thumbColor={value ? COLORS.primary : "#F8FAFC"} />
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value || "Missing"}</Text>
    </View>
  );
}

function ActionButton({
  title,
  subtitle,
  icon,
  loading,
  onPress,
  secondary,
}: {
  title: string;
  subtitle: string;
  icon: any;
  loading: boolean;
  onPress: () => void;
  secondary?: boolean;
}) {
  return (
    <TouchableOpacity style={[styles.actionButton, secondary && styles.actionButtonSecondary]} onPress={onPress} disabled={loading} activeOpacity={0.9}>
      <View style={[styles.actionIcon, secondary && styles.actionIconSecondary]}>
        {loading ? <ActivityIndicator color={secondary ? COLORS.primary : COLORS.white} /> : <Ionicons name={icon} size={20} color={secondary ? COLORS.primary : COLORS.white} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward-outline" size={18} color={COLORS.muted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.navy },
  keyboard: { flex: 1 },
  content: { flexGrow: 1, backgroundColor: COLORS.bg },
  shell: { flex: 1, flexDirection: Platform.OS === "web" ? "row" : "column" },
  sidebar: {
    width: Platform.OS === "web" ? 360 : "100%",
    backgroundColor: COLORS.navy,
    paddingHorizontal: 24,
    paddingTop: 38,
    paddingBottom: 24,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  brandIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  brandTitle: { color: COLORS.white, fontSize: 24, fontWeight: "900" },
  brandSubtitle: { color: "#CBD5E1", fontSize: 13, fontWeight: "700" },
  sideDivider: { height: 1, backgroundColor: "#1E293B", marginVertical: 22 },
  scoreCard: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 22, padding: 16, marginBottom: 18 },
  scoreLabel: { color: "#CBD5E1", fontSize: 12, fontWeight: "800" },
  scoreValue: { color: COLORS.white, fontSize: 34, fontWeight: "900", marginTop: 4 },
  scoreHint: { color: "#CBD5E1", fontSize: 12, lineHeight: 18, marginTop: 4 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 10, borderRadius: 16, marginBottom: 7 },
  stepRowActive: { backgroundColor: "rgba(99,91,255,0.32)" },
  stepIcon: { width: 32, height: 32, borderRadius: 12, backgroundColor: "#1E293B", alignItems: "center", justifyContent: "center" },
  stepIconActive: { backgroundColor: COLORS.primary },
  stepIconComplete: { backgroundColor: COLORS.accent },
  stepText: { color: "#CBD5E1", fontSize: 14, fontWeight: "800" },
  stepTextActive: { color: COLORS.white },
  homeButton: { marginTop: 14, backgroundColor: COLORS.white, borderRadius: 16, padding: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  homeButtonText: { color: COLORS.primary, fontWeight: "900" },
  main: { flex: 1, padding: 20 },
  card: { width: "100%", maxWidth: 860, alignSelf: "center", backgroundColor: COLORS.card, borderRadius: 30, padding: 22, borderWidth: 1, borderColor: COLORS.border },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 18 },
  headerIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  title: { color: COLORS.text, fontSize: 27, fontWeight: "900" },
  subtitle: { color: COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: 6 },
  sectionTitle: { marginTop: 6, marginBottom: 10 },
  sectionTitleText: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  sectionSubtitle: { color: COLORS.muted, fontSize: 13, lineHeight: 20, marginTop: 4 },
  fieldBlock: { marginBottom: 8 },
  inputLabel: { color: COLORS.text, fontSize: 13, fontWeight: "900", marginBottom: 7, marginTop: 8 },
  inputShell: { minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  inputShellMultiline: { minHeight: 90, alignItems: "flex-start", paddingTop: 14 },
  input: { flex: 1, color: COLORS.text, fontSize: 15, minHeight: 48 },
  inputMultiline: { minHeight: 76, textAlignVertical: "top" },
  toggleRow: { marginTop: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, borderRadius: 16, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  toggleText: { flex: 1, color: COLORS.text, fontSize: 14, fontWeight: "800" },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  optionChip: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 10 },
  optionChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  optionChipText: { color: COLORS.primary, fontWeight: "900", fontSize: 12 },
  optionChipTextSelected: { color: COLORS.white },
  noticeBox: { marginTop: 10, marginBottom: 12, borderWidth: 1, borderColor: "#C7D2FE", backgroundColor: COLORS.primarySoft, borderRadius: 16, padding: 12, flexDirection: "row", gap: 8 },
  noticeText: { flex: 1, color: COLORS.text, fontSize: 12, lineHeight: 18, fontWeight: "700" },
  documentRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, borderRadius: 18, padding: 13, marginBottom: 10 },
  documentIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  documentTitle: { color: COLORS.text, fontSize: 14, fontWeight: "900" },
  documentValue: { color: COLORS.muted, fontSize: 12, marginTop: 3 },
  requiredText: { color: COLORS.danger },
  smallButton: { backgroundColor: COLORS.primary, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9 },
  smallButtonText: { color: COLORS.white, fontWeight: "900", fontSize: 12 },
  groupTitle: { color: COLORS.text, fontSize: 15, fontWeight: "900", marginTop: 16, marginBottom: 8 },
  questionBlock: { marginTop: 8 },
  questionGrid: { gap: 8 },
  questionChip: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, borderRadius: 14, padding: 11 },
  questionChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  questionChipDisabled: { opacity: 0.45 },
  questionChipText: { color: COLORS.text, fontWeight: "800", fontSize: 12 },
  questionChipTextSelected: { color: COLORS.white },
  questionChipTextDisabled: { color: COLORS.muted },
  statusList: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, borderRadius: 18, padding: 10, marginVertical: 10 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  statusIcon: { width: 28, height: 28, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  statusGood: { backgroundColor: COLORS.accent },
  statusMissing: { backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border },
  statusLabel: { color: COLORS.text, fontSize: 13, fontWeight: "900" },
  statusValue: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  actionButton: { marginTop: 10, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  actionButtonSecondary: { backgroundColor: COLORS.surface },
  actionIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  actionIconSecondary: { backgroundColor: COLORS.primarySoft },
  actionTitle: { color: COLORS.text, fontSize: 14, fontWeight: "900" },
  actionSubtitle: { color: COLORS.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  reviewRow: { flexDirection: "row", justifyContent: "space-between", gap: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 12 },
  reviewLabel: { color: COLORS.muted, fontWeight: "800", flex: 1 },
  reviewValue: { color: COLORS.text, fontWeight: "900", flex: 1.4, textAlign: "right" },
  footerNav: { marginTop: 20, flexDirection: "row", justifyContent: "space-between", gap: 12 },
  navButton: { minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  navButtonText: { color: COLORS.primary, fontWeight: "900" },
  primaryButton: { minHeight: 52, borderRadius: 16, backgroundColor: COLORS.primary, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryButtonText: { color: COLORS.white, fontSize: 14, fontWeight: "900" },
  disabledButton: { opacity: 0.55 },
});