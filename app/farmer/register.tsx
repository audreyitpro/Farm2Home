// app/farmer/register.tsx

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL } from "../config/api";
import { supabase } from "../data/supabaseClient";

/**
 * Farm2Home Farmer Registration
 *
 * Freight-style flow:
 * Account -> Farm -> Location -> Products -> Documents -> Legal -> Stripe -> Review
 *
 * Important:
 * - Profiles save is intentionally minimal to avoid POST /profiles 400 errors.
 * - Farmers save is schema-safe and removes missing columns automatically.
 * - Admin verification save is optional and non-blocking.
 * - Farmer document upload uses Supabase Storage bucket: farmer-documents
 *
 * Install if needed:
 * npx expo install expo-document-picker
 */

const PENDING_FARMER_KEY = "pendingFarmerApplication";
const FARMER_DOC_BUCKET = "farmer-documents";

const COLORS = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  surface2: "#F1F5F9",
  black: "#050505",
  red: "#D71920",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  amber: "#D97706",
  primary: "#166534",
  primaryDark: "#14532D",
  primarySoft: "#ECFDF5",
  white: "#FFFFFF",
};

const STEPS = [
  { key: "account", title: "Account", icon: "person-outline" },
  { key: "farm", title: "Farm", icon: "business-outline" },
  { key: "location", title: "Location", icon: "location-outline" },
  { key: "products", title: "Products", icon: "leaf-outline" },
  { key: "documents", title: "Documents", icon: "document-text-outline" },
  { key: "legal", title: "Legal", icon: "shield-checkmark-outline" },
  { key: "stripe", title: "Stripe", icon: "card-outline" },
  { key: "review", title: "Review", icon: "checkmark-done-outline" },
] as const;

const productOptions = [
  "Produce",
  "Vegetables",
  "Fruit",
  "Eggs",
  "Honey",
  "Beef",
  "Chicken",
  "Turkey",
  "Goat",
  "Lamb",
  "Halal Meat",
  "Dairy",
  "Fish / Aquaculture",
  "Catfish",
  "Tilapia",
  "Trout",
  "Shrimp",
  "Crawfish",
  "Herbs",
  "Baked Goods",
  "Jams",
  "Sauces",
  "Bale of Hay",
  "Alfalfa Hay",
  "Straw Bale",
  "Animal Feed",
  "Flowers",
  "Plants",
  "Christmas Trees",
  "Pumpkins",
  "Seasonal Items",
  "Farm Supplies",
];

const agreements = [
  "I understand I am an independent seller and not an employee, agent, or partner of Farm2Home.",
  "I accept full responsibility for food quality, safety, storage, packaging, labeling, and product accuracy.",
  "I certify I comply with state and federal laws required to sell my products.",
  "I agree to resolve customer complaints through refund, replacement, or credit when appropriate.",
  "I agree to indemnify and hold harmless Farm2Home and ASO Developments LLC from claims related to my products, operations, or legal violations.",
  "I accept Farm2Home service fees, membership fees, payout terms, and platform policies.",
];

type StepKey = (typeof STEPS)[number]["key"];

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalizeEmail(value: any) {
  return clean(value).toLowerCase();
}

function normalizeUsername(value: any) {
  return clean(value).toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function isUuid(value: any) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(clean(value));
}

function isStripeCustomerId(value: any) {
  return clean(value).startsWith("cus_");
}

function isStripeSubscriptionId(value: any) {
  return clean(value).startsWith("sub_");
}

function pickStripeCustomerId(...values: any[]) {
  const found = values.find((value) => isStripeCustomerId(value));
  return found ? clean(found) : "";
}

function pickStripeSubscriptionId(...values: any[]) {
  const found = values.find((value) => isStripeSubscriptionId(value));
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
  return `Farmer_${stamp}`;
}

function firstParam(value: any) {
  if (Array.isArray(value)) return clean(value[0]);
  return clean(value);
}

function getMissingColumnName(error: any): string {
  const message = String(error?.message || error?.details || "");

  const patterns = [
    /Could not find the '([^']+)' column/i,
    /column '([^']+)' of relation/i,
    /'([^']+)' column of '([^']+)'/i,
    /schema cache.*?'([^']+)'/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) return match[1];
  }

  console.log("UNMATCHED SUPABASE ERROR:", message);
  return "";
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
      data?.checkoutUrl ||
      data?.checkout_url ||
      data?.sessionUrl ||
      data?.session_url ||
      data?.checkoutSessionUrl ||
      data?.checkout_session_url ||
      data?.link ||
      data?.data?.url ||
      data?.data?.checkoutUrl ||
      data?.result?.url ||
      data?.result?.checkoutUrl
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

    if (result?.type === "cancel" || result?.type === "dismiss") {
      await Linking.openURL(finalUrl);
    }
  } catch (browserError) {
    console.log("WebBrowser open failed, trying Linking:", browserError);

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
    clean(row?.id || row?.farmer_id || row?.farmerId) &&
      clean(row?.account_id || row?.accountId) &&
      isStripeCustomerId(row?.stripe_customer_id || row?.stripeCustomerId) &&
      isStripeSubscriptionId(
        row?.subscription_id ||
          row?.stripe_subscription_id ||
          row?.stripeSubscriptionId
      ) &&
      clean(row?.farm_business_license_document || row?.farmBusinessLicenseDocument) &&
      clean(row?.food_safety_document || row?.foodSafetyDocument) &&
      clean(
        row?.product_liability_insurance_document ||
          row?.productLiabilityInsuranceDocument
      ) &&
      clean(row?.w9_document || row?.w9Document) &&
      clean(row?.farm_permit_document || row?.farmPermitDocument)
  );
}

async function saveFarmerSession(farmer: any) {
  const sessionFarmer = {
    ...farmer,
    role: "farmer",
    farmerId: farmer.farmer_id || farmer.farmerId || farmer.id,
    farmer_id: farmer.farmer_id || farmer.farmerId || farmer.id,
    accountId: farmer.account_id || farmer.accountId,
    account_id: farmer.account_id || farmer.accountId,
    ownerName: farmer.owner_name || farmer.ownerName || farmer.full_name || farmer.name,
    owner_name: farmer.owner_name || farmer.ownerName || farmer.full_name || farmer.name,
    farmName: farmer.farm_name || farmer.farmName || farmer.business_name || farmer.businessName,
    farm_name: farmer.farm_name || farmer.farmName || farmer.business_name || farmer.businessName,
    businessName: farmer.business_name || farmer.businessName || farmer.farm_name || farmer.farmName,
    business_name: farmer.business_name || farmer.businessName || farmer.farm_name || farmer.farmName,
    stripeCustomerId: farmer.stripe_customer_id || farmer.stripeCustomerId,
    stripe_customer_id: farmer.stripe_customer_id || farmer.stripeCustomerId,
    stripeSubscriptionId:
      farmer.stripe_subscription_id ||
      farmer.subscription_id ||
      farmer.stripeSubscriptionId,
    stripe_subscription_id:
      farmer.stripe_subscription_id ||
      farmer.subscription_id ||
      farmer.stripeSubscriptionId,
    subscriptionId:
      farmer.subscription_id ||
      farmer.stripe_subscription_id ||
      farmer.subscriptionId,
    subscription_id:
      farmer.subscription_id ||
      farmer.stripe_subscription_id ||
      farmer.subscriptionId,
    accountActive: farmer.account_active,
    account_active: farmer.account_active,
    membershipStatus: farmer.membership_status,
    membership_status: farmer.membership_status,
    dashboardReady: hasCompleteDashboardAccess(farmer),
    updatedAt: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await AsyncStorage.multiSet([
    ["currentFarmer", JSON.stringify(sessionFarmer)],
    [PENDING_FARMER_KEY, JSON.stringify(sessionFarmer)],
    ["currentFarmerUser", JSON.stringify(sessionFarmer)],
    ["farm2homeCurrentFarmer", JSON.stringify(sessionFarmer)],
    ["currentUser", JSON.stringify(sessionFarmer)],
    ["userRole", "farmer"],
    ["currentUserRole", "farmer"],
    ["lastLoginRole", "farmer"],
    ["lastFarmerDashboardReady", hasCompleteDashboardAccess(farmer) ? "true" : "false"],
  ]);
}

export default function FarmerRegister() {
  const params = useLocalSearchParams();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [syncingStripe, setSyncingStripe] = useState(false);
  const [uploadingField, setUploadingField] = useState("");

  const [savedFarmerId, setSavedFarmerId] = useState("");
  const [profileId, setProfileId] = useState("");
  const [farmerId, setFarmerId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [stripeCustomerId, setStripeCustomerId] = useState("");
  const [subscriptionId, setSubscriptionId] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState("");

  const [ownerName, setOwnerName] = useState("");
  const [farmName, setFarmName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [businessAddress, setBusinessAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateValue, setStateValue] = useState("MI");
  const [zipCode, setZipCode] = useState("");

  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [accepted, setAccepted] = useState<Record<number, boolean>>({});

  const [farmBusinessLicenseDocument, setFarmBusinessLicenseDocument] = useState("");
  const [foodSafetyDocument, setFoodSafetyDocument] = useState("");
  const [productLiabilityInsuranceDocument, setProductLiabilityInsuranceDocument] = useState("");
  const [w9Document, setW9Document] = useState("");
  const [farmPermitDocument, setFarmPermitDocument] = useState("");
  const [organicCertificationDocument, setOrganicCertificationDocument] = useState("");
  const [meatDairyLicenseDocument, setMeatDairyLicenseDocument] = useState("");
  const [produceSafetyCertificateDocument, setProduceSafetyCertificateDocument] = useState("");

  const businessComplete = useMemo(
    () =>
      Boolean(
        ownerName.trim() &&
          farmName.trim() &&
          businessName.trim() &&
          isValidEmail(email) &&
          phone.trim()
      ),
    [ownerName, farmName, businessName, email, phone]
  );

  const loginComplete = useMemo(
    () =>
      Boolean(
        username.trim() &&
          password.trim().length >= 6 &&
          confirmPassword.trim() &&
          password.trim() === confirmPassword.trim()
      ),
    [username, password, confirmPassword]
  );

  const locationComplete = useMemo(
    () =>
      Boolean(
        businessAddress.trim() &&
          city.trim() &&
          stateValue.trim() &&
          zipCode.trim()
      ),
    [businessAddress, city, stateValue, zipCode]
  );

  const productsComplete = selectedProducts.length > 0;
  const legalComplete = agreements.every((_, index) => accepted[index]);

  const documentsComplete = useMemo(
    () =>
      Boolean(
        farmBusinessLicenseDocument.trim() &&
          foodSafetyDocument.trim() &&
          productLiabilityInsuranceDocument.trim() &&
          w9Document.trim() &&
          farmPermitDocument.trim()
      ),
    [
      farmBusinessLicenseDocument,
      foodSafetyDocument,
      productLiabilityInsuranceDocument,
      w9Document,
      farmPermitDocument,
    ]
  );

  const setupStatus = useMemo(
    () => [
      {
        label: "Farmer Profile",
        complete: Boolean(savedFarmerId || farmerId),
        value: savedFarmerId || farmerId ? "Found" : "Missing",
      },
      {
        label: "Static Account",
        complete: Boolean(accountId),
        value: accountId || "Missing",
      },
      {
        label: "Stripe Customer",
        complete: isStripeCustomerId(stripeCustomerId),
        value: maskId(stripeCustomerId),
      },
      {
        label: "Subscription",
        complete: isStripeSubscriptionId(subscriptionId),
        value: maskId(subscriptionId),
      },
      {
        label: "Documents",
        complete: documentsComplete,
        value: documentsComplete ? "Complete" : "Missing",
      },
    ],
    [savedFarmerId, farmerId, accountId, stripeCustomerId, subscriptionId, documentsComplete]
  );

  const setupScore = useMemo(
    () => setupStatus.filter((item) => item.complete).length,
    [setupStatus]
  );

  const allFiveRequirementsFound = useMemo(
    () =>
      Boolean(
        (savedFarmerId || farmerId) &&
          accountId &&
          isStripeCustomerId(stripeCustomerId) &&
          isStripeSubscriptionId(subscriptionId) &&
          documentsComplete
      ),
    [savedFarmerId, farmerId, accountId, stripeCustomerId, subscriptionId, documentsComplete]
  );

  useEffect(() => {
    loadSavedFarmer();
  }, []);

  useEffect(() => {
    const stripeStatus = firstParam(params?.stripe || params?.payment || "");
    const returnedFarmerId = firstParam(params?.farmerId || params?.farmer_id || "");
    const returnedEmail = firstParam(params?.email || "");

    if (returnedEmail) setEmail(normalizeEmail(returnedEmail));

    if (returnedFarmerId) {
      setFarmerId(returnedFarmerId);
      setSavedFarmerId(returnedFarmerId);
    }

    if (stripeStatus === "success") {
      handleStripeSuccessReturn(returnedFarmerId);
    }
  }, [params?.stripe, params?.payment, params?.farmerId, params?.farmer_id, params?.email]);

  function goNext() {
    setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  }

  function goBack() {
    setStep((prev) => Math.max(prev - 1, 0));
  }

  function goDashboard() {
    router.replace("/farmer/dashboard" as any);
  }

  function toggleProduct(product: string) {
    setSelectedProducts((prev) =>
      prev.includes(product)
        ? prev.filter((item) => item !== product)
        : [...prev, product]
    );
  }

  function hydrateForm(row: any) {
    const rowFarmerId = clean(row?.id || row?.farmer_id || row?.farmerId || "");
    const rowProfileId = clean(row?.profile_id || row?.profileId || "");
    const rowAccountId = clean(row?.account_id || row?.accountId || "");
    const rowCustomerId = pickStripeCustomerId(row?.stripe_customer_id, row?.stripeCustomerId);
    const rowSubId = pickStripeSubscriptionId(
      row?.subscription_id,
      row?.stripe_subscription_id,
      row?.stripeSubscriptionId
    );

    if (rowFarmerId) {
      setFarmerId(rowFarmerId);
      setSavedFarmerId(rowFarmerId);
    }

    if (rowProfileId) setProfileId(rowProfileId);
    if (rowAccountId) setAccountId(rowAccountId);
    if (rowCustomerId) setStripeCustomerId(rowCustomerId);
    if (rowSubId) setSubscriptionId(rowSubId);

    setSubscriptionStatus(row?.subscription_status || row?.subscriptionStatus || subscriptionStatus || "");

    if (row?.owner_name || row?.ownerName || row?.full_name || row?.name) {
      setOwnerName(clean(row.owner_name || row.ownerName || row.full_name || row.name));
    }

    if (row?.farm_name || row?.farmName) setFarmName(clean(row.farm_name || row.farmName));
    if (row?.business_name || row?.businessName || row?.company_name) {
      setBusinessName(clean(row.business_name || row.businessName || row.company_name));
    }

    if (row?.email || row?.farmer_email) setEmail(normalizeEmail(row.email || row.farmer_email));
    if (row?.phone) setPhone(clean(row.phone));
    if (row?.username) setUsername(clean(row.username));

    if (row?.business_address || row?.address) {
      setBusinessAddress(clean(row.business_address || row.address));
    }

    if (row?.city) setCity(clean(row.city));
    if (row?.state) setStateValue(clean(row.state).toUpperCase().slice(0, 2));
    if (row?.zip_code) setZipCode(clean(row.zip_code));

    if (row?.farm_business_license_document) {
      setFarmBusinessLicenseDocument(clean(row.farm_business_license_document));
    }

    if (row?.food_safety_document) setFoodSafetyDocument(clean(row.food_safety_document));

    if (row?.product_liability_insurance_document) {
      setProductLiabilityInsuranceDocument(clean(row.product_liability_insurance_document));
    }

    if (row?.w9_document) setW9Document(clean(row.w9_document));
    if (row?.farm_permit_document) setFarmPermitDocument(clean(row.farm_permit_document));

    if (row?.organic_certification_document) {
      setOrganicCertificationDocument(clean(row.organic_certification_document));
    }

    if (row?.meat_dairy_license_document) {
      setMeatDairyLicenseDocument(clean(row.meat_dairy_license_document));
    }

    if (row?.produce_safety_certificate_document) {
      setProduceSafetyCertificateDocument(clean(row.produce_safety_certificate_document));
    }

    const products = row?.selected_products || row?.selected_product_categories || row?.product_categories;

    if (Array.isArray(products)) {
      setSelectedProducts(products.map((item) => clean(item)).filter(Boolean));
    }
  }

  function buildCurrentSnapshot(base: any = {}) {
    const id = clean(base.id || base.farmer_id || savedFarmerId || farmerId);
    const finalSub = pickStripeSubscriptionId(
      base.subscription_id,
      base.stripe_subscription_id,
      subscriptionId
    );
    const finalCustomer = pickStripeCustomerId(base.stripe_customer_id, stripeCustomerId);

    return {
      ...base,
      id,
      farmer_id: id,
      farmerId: id,
      auth_user_id: clean(base.auth_user_id || id),
      profile_id: clean(base.profile_id || profileId || id),
      role: "farmer",
      email: normalizeEmail(base.email || email),
      account_id: clean(base.account_id || accountId),
      accountId: clean(base.account_id || accountId),
      owner_name: clean(base.owner_name || ownerName),
      ownerName: clean(base.owner_name || ownerName),
      full_name: clean(base.full_name || ownerName),
      farm_name: clean(base.farm_name || farmName),
      farmName: clean(base.farm_name || farmName),
      business_name: clean(base.business_name || businessName),
      businessName: clean(base.business_name || businessName),
      phone: clean(base.phone || phone),
      username: normalizeUsername(base.username || username),
      stripe_customer_id: finalCustomer,
      stripeCustomerId: finalCustomer,
      subscription_id: finalSub,
      subscriptionId: finalSub,
      stripe_subscription_id: finalSub,
      stripeSubscriptionId: finalSub,
      subscription_status: clean(
        base.subscription_status ||
          subscriptionStatus ||
          (finalSub ? "active" : "pending_payment")
      ),
      membership_status: finalSub ? "active" : "pending_payment",
      farm_business_license_document: clean(
        base.farm_business_license_document || farmBusinessLicenseDocument
      ),
      food_safety_document: clean(base.food_safety_document || foodSafetyDocument),
      product_liability_insurance_document: clean(
        base.product_liability_insurance_document || productLiabilityInsuranceDocument
      ),
      w9_document: clean(base.w9_document || w9Document),
      farm_permit_document: clean(base.farm_permit_document || farmPermitDocument),
      organic_certification_document: clean(
        base.organic_certification_document || organicCertificationDocument
      ),
      meat_dairy_license_document: clean(
        base.meat_dairy_license_document || meatDairyLicenseDocument
      ),
      produce_safety_certificate_document: clean(
        base.produce_safety_certificate_document || produceSafetyCertificateDocument
      ),
      account_active: Boolean(id && accountId && finalCustomer && finalSub && documentsComplete),
      updated_at: new Date().toISOString(),
    };
  }

  function validateForm({ full = true }: { full?: boolean } = {}) {
    if (!businessComplete) {
      Alert.alert(
        "Business Info Required",
        "Complete owner name, farm name, business name, email, and phone."
      );
      setStep(0);
      return false;
    }

    if (!savedFarmerId && !farmerId && !loginComplete) {
      Alert.alert(
        "Login Required",
        "Create a username and matching password with at least 6 characters."
      );
      setStep(0);
      return false;
    }

    if (!locationComplete) {
      Alert.alert(
        "Location Required",
        "Complete business address, city, state, and zip code."
      );
      setStep(2);
      return false;
    }

    if (!full) return true;

    if (!productsComplete) {
      Alert.alert("Products Required", "Select at least one product type.");
      setStep(3);
      return false;
    }

    if (!documentsComplete) {
      Alert.alert(
        "Documents Required",
        "Upload all required farmer documents."
      );
      setStep(4);
      return false;
    }

    if (!legalComplete) {
      Alert.alert(
        "Agreement Required",
        "Accept all Farmer Seller Agreement items before continuing."
      );
      setStep(5);
      return false;
    }

    return true;
  }

  async function generateFarmerAccountId() {
    try {
      const { data, error } = await supabase.rpc("next_account_id", {
        p_role: "farmer",
        p_prefix: "Farmer",
      });

      if (!error && data) return String(data);
    } catch (error) {
      console.log("next_account_id skipped:", error);
    }

    return makeFallbackAccountId();
  }

  async function findFarmerByIdOrEmail(targetId?: string, targetEmail?: string) {
    const id = clean(targetId);
    const emailValue = normalizeEmail(targetEmail);

    if (id) {
      const { data, error } = await supabase
        .from("farmers")
        .select("*")
        .or(`id.eq.${id},farmer_id.eq.${id},profile_id.eq.${id},auth_user_id.eq.${id}`)
        .limit(1);

      if (!error && Array.isArray(data) && data[0]) return data[0];
      if (error) console.log("farmer lookup by id:", error.message);
    }

    if (emailValue) {
      const { data, error } = await supabase
        .from("farmers")
        .select("*")
        .eq("email", emailValue)
        .maybeSingle();

      if (!error && data) return data;
      if (error) console.log("farmer lookup by email:", error.message);
    }

    return null;
  }

  async function findProfileByEmail(targetEmail: string) {
    const emailValue = normalizeEmail(targetEmail);
    if (!emailValue) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", emailValue)
      .maybeSingle();

    if (error) {
      console.log("profile lookup error:", error.message);
      return null;
    }

    return data || null;
  }

  async function findProfileByAuthId(authId: string) {
    if (!isUuid(authId)) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .or(`id.eq.${authId},auth_user_id.eq.${authId}`)
      .maybeSingle();

    if (error) {
      console.log("profile lookup auth error:", error.message);
      return null;
    }

    return data || null;
  }

  async function getBestFarmerSubscription(targetId?: string, targetEmail?: string) {
    const id = clean(targetId);
    const emailValue = normalizeEmail(targetEmail);

    const filters = [
      id ? `farmer_id.eq.${id}` : "",
      emailValue ? `farmer_email.eq.${emailValue}` : "",
    ]
      .filter(Boolean)
      .join(",");

    if (!filters) return null;

    const { data, error } = await supabase
      .from("farmer_subscriptions")
      .select("*")
      .or(filters)
      .order("updated_at", { ascending: false })
      .limit(10);

    if (error) {
      console.log("farmer subscription lookup error:", error.message);
      return null;
    }

    if (!Array.isArray(data) || data.length === 0) return null;

    const completeRow = data.find(
      (row) =>
        pickStripeCustomerId(row?.stripe_customer_id) &&
        pickStripeSubscriptionId(row?.stripe_subscription_id)
    );

    return completeRow || data[0];
  }

  async function safeTableUpsert(tableName: string, payload: Record<string, any>, logLabel: string) {
    let nextPayload: any = { ...payload };

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const { data, error } = await supabase
        .from(tableName)
        .upsert(nextPayload, { onConflict: "id" })
        .select("*")
        .maybeSingle();

      if (!error) return data;

      console.log(`${logLabel} UPSERT ERROR:`, error.message);

      const missing = getMissingColumnName(error);

      if (missing && Object.prototype.hasOwnProperty.call(nextPayload, missing)) {
        console.log(`Removing missing ${logLabel.toLowerCase()} column: ${missing}`);

        const copy: any = { ...nextPayload };
        delete copy[missing];
        nextPayload = copy;

        continue;
      }

      console.log(`${logLabel} FAILED PAYLOAD KEYS:`, Object.keys(nextPayload));
      throw error;
    }

    return null;
  }

  async function safeProfileUpdate(profileIdValue: string, payload: Record<string, any>) {
    let nextPayload: any = { ...payload };

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const { data, error } = await supabase
        .from("profiles")
        .update(nextPayload)
        .eq("id", profileIdValue)
        .select("*")
        .maybeSingle();

      if (!error) return data;

      const missing = getMissingColumnName(error);

      if (missing && Object.prototype.hasOwnProperty.call(nextPayload, missing)) {
        const copy: any = { ...nextPayload };
        delete copy[missing];
        nextPayload = copy;
        continue;
      }

      console.log("PROFILE UPDATE ERROR:", error.message);
      throw error;
    }

    return null;
  }

  async function safeProfileInsert(payload: Record<string, any>) {
    let nextPayload: any = { ...payload };

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const { data, error } = await supabase
        .from("profiles")
        .insert(nextPayload)
        .select("*")
        .maybeSingle();

      if (!error) return data;

      const missing = getMissingColumnName(error);

      if (missing && Object.prototype.hasOwnProperty.call(nextPayload, missing)) {
        const copy: any = { ...nextPayload };
        delete copy[missing];
        nextPayload = copy;
        continue;
      }

      console.log("PROFILE INSERT ERROR:", error.message);
      throw error;
    }

    return null;
  }

  async function upsertProfileForFarmer(
    authId: string,
    emailValue: string,
    accountValue: string
  ) {
    const existingByEmail = await findProfileByEmail(emailValue);
    const existingByAuth = existingByEmail ? null : await findProfileByAuthId(authId);
    const existing = existingByEmail || existingByAuth;
    const now = new Date().toISOString();

    const payload = {
      id: authId,
      auth_user_id: authId,
      role: "farmer",
      full_name: ownerName.trim(),
      email: normalizeEmail(emailValue),
      phone: phone.trim(),
      account_id: accountValue,
      created_at: now,
    };

    if (existing?.id) {
      const updatePayload = {
        auth_user_id: authId,
        role: "farmer",
        full_name: ownerName.trim(),
        email: normalizeEmail(emailValue),
        phone: phone.trim(),
        account_id: accountValue,
      };

      const data = await safeProfileUpdate(existing.id, updatePayload);
      return data || { ...existing, ...updatePayload };
    }

    const data = await safeProfileInsert(payload);

    if (!data?.id) {
      return payload;
    }

    return data;
  }

  async function upsertFarmerSubscriptionRow(values: {
    farmerId: string;
    emailValue: string;
    customerId?: string;
    subscriptionValue?: string;
    subscriptionStatusValue?: string;
  }) {
    const now = new Date().toISOString();
    const sub = pickStripeSubscriptionId(values.subscriptionValue);
    const customer = pickStripeCustomerId(values.customerId);

    const payload = {
      farmer_id: values.farmerId,
      farmer_email: normalizeEmail(values.emailValue),
      name: ownerName.trim() || businessName.trim() || farmName.trim(),
      username: normalizeUsername(username),
      stripe_customer_id: customer || null,
      stripe_subscription_id: sub || null,
      subscription_status:
        values.subscriptionStatusValue || (sub ? "active" : "pending_payment"),
      updated_at: now,
    };

    const { data: existing, error: lookupError } = await supabase
      .from("farmer_subscriptions")
      .select("id")
      .or(
        `farmer_id.eq.${values.farmerId},farmer_email.eq.${normalizeEmail(
          values.emailValue
        )}`
      )
      .limit(1);

    if (lookupError) {
      console.log("farmer subscription lookup before save failed:", lookupError.message);
    }

    if (Array.isArray(existing) && existing[0]?.id) {
      const { error } = await supabase
        .from("farmer_subscriptions")
        .update(payload)
        .eq("id", existing[0].id);

      if (error) {
        console.log("farmer_subscriptions update skipped:", error.message);
      }

      return;
    }

    const { error } = await supabase
      .from("farmer_subscriptions")
      .insert({ ...payload, created_at: now });

    if (error) {
      console.log("farmer_subscriptions insert skipped:", error.message);
    }
  }

  // Admin verification is intentionally disabled for farmer registration.
  // Farmer registration saves only to profiles, farmers, farmer_subscriptions, and Supabase Storage.



  async function saveFarmerUserRow(authId: string, passedAccountId?: string) {
    const now = new Date().toISOString();
    const emailValue = normalizeEmail(email);
    const existing = await findFarmerByIdOrEmail(authId, emailValue);
    const subRow = await getBestFarmerSubscription(authId, emailValue);

    const finalAccountId = clean(
      existing?.account_id ||
        passedAccountId ||
        accountId ||
        (await generateFarmerAccountId())
    );

    const finalCustomerId = pickStripeCustomerId(
      stripeCustomerId,
      existing?.stripe_customer_id,
      subRow?.stripe_customer_id
    );

    const finalSubscriptionId = pickStripeSubscriptionId(
      subscriptionId,
      existing?.subscription_id,
      existing?.stripe_subscription_id,
      subRow?.stripe_subscription_id
    );

    const finalStatus =
      subscriptionStatus ||
      subRow?.subscription_status ||
      (finalSubscriptionId ? "active" : "pending_payment");

    const complete = Boolean(
      authId &&
        finalAccountId &&
        finalCustomerId &&
        finalSubscriptionId &&
        documentsComplete
    );

    const profile = await upsertProfileForFarmer(authId, emailValue, finalAccountId);
    if (!profile?.id) throw new Error("Profile could not be created.");

    // Start with a useful payload. safeTableUpsert removes columns that do not exist
    // in your current farmers table, so it will not keep crashing on schema differences.
    const farmerPayload: any = {
      id: authId,
      farmer_id: authId,
      auth_user_id: authId,
      profile_id: profile.id,

      email: emailValue,
      username: normalizeUsername(username),
      phone: phone.trim(),

      owner_name: ownerName.trim(),
      farm_name: farmName.trim(),
      business_name: businessName.trim(),

      business_address: businessAddress.trim(),
      city: city.trim(),
      state: stateValue.trim().toUpperCase().slice(0, 2) || "MI",
      zip_code: zipCode.trim(),

      selected_products: selectedProducts,
      selected_product_categories: selectedProducts,
      legal_agreements: accepted,

      farm_business_license_document: farmBusinessLicenseDocument.trim(),
      food_safety_document: foodSafetyDocument.trim(),
      product_liability_insurance_document:
        productLiabilityInsuranceDocument.trim(),
      w9_document: w9Document.trim(),
      farm_permit_document: farmPermitDocument.trim(),
      organic_certification_document: organicCertificationDocument.trim() || null,
      meat_dairy_license_document: meatDairyLicenseDocument.trim() || null,
      produce_safety_certificate_document:
        produceSafetyCertificateDocument.trim() || null,

      account_id: finalAccountId,
      stripe_customer_id: finalCustomerId || null,
      stripe_subscription_id: finalSubscriptionId || null,
      subscription_id: finalSubscriptionId || null,
      subscription_status: finalStatus,
      membership_status: finalSubscriptionId ? "active" : "pending_payment",

      approved: complete,
      rejected: false,
      reviewed: false,
      needs_more_info: false,
      account_active: complete,
      store_unlocked: complete,
      compliance_submitted: documentsComplete,
      has_completed_compliance: documentsComplete,
      farmer_membership_paid: Boolean(finalSubscriptionId),
      monthly_membership_started: Boolean(finalSubscriptionId),

      verification_status: complete
        ? "SUBMITTED"
        : finalSubscriptionId
          ? "PENDING_DOCUMENTS"
          : "REGISTERED",
      compliance_status: complete
        ? "SUBMITTED"
        : finalSubscriptionId
          ? "PENDING_DOCUMENTS"
          : "PENDING_PAYMENT",
      admin_review_status: complete
        ? "submitted"
        : finalSubscriptionId
          ? "pending_documents"
          : "pending_payment",
      review_decision: complete
        ? "submitted"
        : finalSubscriptionId
          ? "pending_documents"
          : "pending_payment",

      updated_at: now,
      created_at: existing?.id ? existing?.created_at || now : now,
    };

    const savedFarmer = await safeTableUpsert("farmers", farmerPayload, "FARMER");

    if (!savedFarmer?.id) {
      throw new Error("Farmer registration did not save.");
    }

    await upsertFarmerSubscriptionRow({
      farmerId: authId,
      emailValue,
      customerId: finalCustomerId,
      subscriptionValue: finalSubscriptionId,
      subscriptionStatusValue: finalStatus,
    });

    // Admin verification save removed to prevent schema mismatch 400 errors.

    const finalRow = {
      ...savedFarmer,
      stripe_subscription_id:
        savedFarmer.subscription_id || savedFarmer.stripe_subscription_id,
      subscription_status: finalStatus,
    };

    hydrateForm(finalRow);
    await saveFarmerSession(finalRow);

    setSavedFarmerId(savedFarmer.id);
    setFarmerId(savedFarmer.id);
    setProfileId(clean(savedFarmer.profile_id));
    setAccountId(clean(savedFarmer.account_id));
    setStripeCustomerId(pickStripeCustomerId(savedFarmer.stripe_customer_id));
    setSubscriptionId(
      pickStripeSubscriptionId(
        savedFarmer.subscription_id,
        savedFarmer.stripe_subscription_id
      )
    );
    setSubscriptionStatus(finalStatus);

    return finalRow;
  }

  async function getOrCreateAuthUser() {
    const emailValue = normalizeEmail(email);

    const { data: currentUserData } = await supabase.auth.getUser();

    if (currentUserData?.user?.id) {
      return currentUserData.user.id;
    }

    const existingFarmer = await findFarmerByIdOrEmail("", emailValue);
    if (existingFarmer?.id) return existingFarmer.id;

    const { data, error } = await supabase.auth.signUp({
      email: emailValue,
      password: password.trim(),
      options: {
        data: {
          role: "farmer",
          username: normalizeUsername(username),
          owner_name: ownerName.trim(),
          full_name: ownerName.trim(),
          business_name: businessName.trim(),
          farm_name: farmName.trim(),
        },
      },
    });

    if (error) throw error;
    if (!data?.user?.id) throw new Error("Unable to create farmer Auth user.");

    return data.user.id;
  }

  async function saveFarmerProfile(fullValidation = false) {
    if (saving) return null;
    if (!validateForm({ full: fullValidation })) return null;

    try {
      setSaving(true);

      const authId = savedFarmerId || farmerId || (await getOrCreateAuthUser());
      const saved = await saveFarmerUserRow(authId, accountId || undefined);

      Alert.alert("Saved", "Farmer registration was saved.");
      return saved;
    } catch (error: any) {
      console.log("SAVE FARMER ERROR:", error);
      Alert.alert("Save Error", error?.message || "Unable to save farmer registration.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function syncStripeFromBackend(silent = false) {
    const emailValue = normalizeEmail(email);
    const id = savedFarmerId || farmerId;

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
          role: "farmer",
          email: emailValue,
          farmer_email: emailValue,
          name: ownerName.trim() || businessName.trim() || farmName.trim(),
          username: normalizeUsername(username),
          userId: id,
          farmerId: id,
          farmer_id: id,
        }),
      });

      const json = await parseApiResponse(response);

      if (!response.ok || !json.success) {
        if (!silent) {
          Alert.alert(
            "Stripe Sync Not Found",
            json.error || "No Stripe customer/subscription was found."
          );
        }
        return null;
      }

      const customer = pickStripeCustomerId(json.stripeCustomerId, json.stripe_customer_id);
      const sub = pickStripeSubscriptionId(
        json.stripeSubscriptionId,
        json.stripe_subscription_id
      );
      const status = json.subscriptionStatus || json.subscription_status || "active";

      if (customer) setStripeCustomerId(customer);
      if (sub) setSubscriptionId(sub);
      setSubscriptionStatus(status);

      const authId = id || (await getOrCreateAuthUser());
      const saved = await saveFarmerUserRow(authId, accountId || undefined);

      if (!silent) Alert.alert("Stripe Retrieved", "Stripe payment data was saved.");

      return saved;
    } catch (error: any) {
      if (!silent) {
        Alert.alert("Retrieve Error", error?.message || "Unable to retrieve Stripe information.");
      }
      return null;
    } finally {
      setSyncingStripe(false);
    }
  }

  async function retrieveMissingStripeInfo(routeWhenReady = false) {
    try {
      setSyncingStripe(true);

      const id =
        savedFarmerId ||
        farmerId ||
        firstParam(params?.farmerId || params?.farmer_id || "");
      const emailValue = normalizeEmail(email || firstParam(params?.email || ""));

      const dbFarmer = await findFarmerByIdOrEmail(id, emailValue);
      const subRow = await getBestFarmerSubscription(
        dbFarmer?.id || id,
        dbFarmer?.email || emailValue
      );

      if (!dbFarmer && !subRow) {
        const backendSynced = await syncStripeFromBackend(true);

        if (!backendSynced) {
          Alert.alert("Not Found", "No farmer profile or Stripe subscription was found yet.");
          return null;
        }

        if (routeWhenReady && hasCompleteDashboardAccess(backendSynced)) goDashboard();

        return backendSynced;
      }

      const customer = pickStripeCustomerId(
        dbFarmer?.stripe_customer_id,
        subRow?.stripe_customer_id,
        stripeCustomerId
      );
      const sub = pickStripeSubscriptionId(
        dbFarmer?.subscription_id,
        dbFarmer?.stripe_subscription_id,
        subRow?.stripe_subscription_id,
        subscriptionId
      );
      const status =
        subRow?.subscription_status ||
        dbFarmer?.subscription_status ||
        subscriptionStatus ||
        (sub ? "active" : "pending_payment");

      if (customer) setStripeCustomerId(customer);
      if (sub) setSubscriptionId(sub);
      setSubscriptionStatus(status);

      const merged = buildCurrentSnapshot({
        ...(dbFarmer || {}),
        ...(subRow || {}),
        stripe_customer_id: customer,
        subscription_id: sub,
        stripe_subscription_id: sub,
        subscription_status: status,
      });

      hydrateForm(merged);

      const authId = clean(dbFarmer?.id || subRow?.farmer_id || id);

      if (authId) {
        const saved = await saveFarmerUserRow(
          authId,
          dbFarmer?.account_id || accountId || undefined
        );

        if (routeWhenReady && hasCompleteDashboardAccess(saved)) goDashboard();

        return saved;
      }

      return merged;
    } catch (error: any) {
      Alert.alert("Retrieve Error", error?.message || "Unable to retrieve farmer Stripe information.");
      return null;
    } finally {
      setSyncingStripe(false);
    }
  }

  async function handleStripeSuccessReturn(returnedFarmerId?: string) {
    try {
      setStripeLoading(true);

      const saved = await retrieveMissingStripeInfo(false);

      if (saved && hasCompleteDashboardAccess(saved)) {
        Alert.alert(
          "Payment Complete",
          "Farmer payment was confirmed. Your farmer dashboard is ready."
        );
      }
    } finally {
      setStripeLoading(false);
    }
  }

  async function createFarmerCheckout() {
    if (stripeLoading || loading) return;
    if (!validateForm({ full: true })) return;

    try {
      setStripeLoading(true);

      const authId = savedFarmerId || farmerId || (await getOrCreateAuthUser());
      const saved = await saveFarmerUserRow(authId, accountId || undefined);
      const finalId = clean(saved?.id || authId);
      const finalAccountId = clean(saved?.account_id || accountId);
      const emailValue = normalizeEmail(saved?.email || email);

      const response = await fetch(`${API_BASE_URL}/payments/create-farmer-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmer_id: finalId,
          farmerId: finalId,
          userId: finalId,
          account_id: finalAccountId,
          accountId: finalAccountId,
          email: emailValue,
          farmer_email: emailValue,
          name: ownerName.trim(),
          username: normalizeUsername(username),
          businessName: businessName.trim(),
          business_name: businessName.trim(),
          farmName: farmName.trim(),
          farm_name: farmName.trim(),
          role: "farmer",
        }),
      });

      const json = await parseApiResponse(response);

      if (!response.ok) {
        throw new Error(
          json?.error || json?.message || "Unable to create farmer Stripe checkout session."
        );
      }

      const checkoutUrl = getStripeLaunchUrl(json);
      if (!checkoutUrl) throw new Error("Stripe checkout URL was not returned from backend.");

      await openUrl(checkoutUrl);
    } catch (error: any) {
      Alert.alert("Stripe Error", error?.message || "Unable to continue to farmer payment.");
    } finally {
      setStripeLoading(false);
    }
  }

  async function uploadFarmerDocument(
    fieldName: string,
    setValue: (value: string) => void
  ) {
    try {
      const currentId = savedFarmerId || farmerId || firstParam(params?.farmerId || params?.farmer_id);
      const emailKey = normalizeEmail(email || firstParam(params?.email || ""));
      const farmerKey = clean(currentId || emailKey || "pending");

      setUploadingField(fieldName);

      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const file = result.assets?.[0];

      if (!file?.uri) {
        Alert.alert("Upload Error", "No file was selected.");
        return;
      }

      const fileExt = clean(file.name?.split(".").pop()) || "pdf";
      const safeField = fieldName.replace(/[^a-zA-Z0-9_-]/g, "_");
      const safeName = clean(file.name || `${safeField}.${fileExt}`).replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${farmerKey}/${safeField}-${Date.now()}-${safeName}`;

      let uploadBody: any;
      let contentType = file.mimeType || "application/octet-stream";

      if (Platform.OS === "web") {
        const response = await fetch(file.uri);
        uploadBody = await response.blob();
        contentType = uploadBody.type || contentType;
      } else {
        const response = await fetch(file.uri);
        uploadBody = await response.blob();
      }

      const { error } = await supabase.storage
        .from(FARMER_DOC_BUCKET)
        .upload(path, uploadBody, {
          contentType,
          upsert: true,
        });

      if (error) throw error;

      const { data } = supabase.storage.from(FARMER_DOC_BUCKET).getPublicUrl(path);

      const publicUrl = data?.publicUrl || path;
      setValue(publicUrl);

      Alert.alert("Uploaded", "Document uploaded successfully.");
    } catch (error: any) {
      console.log("DOCUMENT UPLOAD ERROR:", error);
      Alert.alert(
        "Upload Error",
        error?.message ||
          `Unable to upload document. Confirm Supabase Storage bucket "${FARMER_DOC_BUCKET}" exists.`
      );
    } finally {
      setUploadingField("");
    }
  }

  async function loadSavedFarmer() {
    try {
      const saved =
        (await AsyncStorage.getItem("currentFarmer")) ||
        (await AsyncStorage.getItem(PENDING_FARMER_KEY)) ||
        (await AsyncStorage.getItem("currentFarmerUser")) ||
        (await AsyncStorage.getItem("currentUser"));

      if (saved) {
        const parsed = JSON.parse(saved);

        if (parsed?.role === "farmer" || parsed?.farmerId || parsed?.id) {
          hydrateForm(parsed);
        }
      }

      const paramId = firstParam(params?.farmerId || params?.farmer_id || "");
      const paramEmail = normalizeEmail(firstParam(params?.email || ""));

      if (paramEmail) setEmail(paramEmail);

      if (paramId) {
        const dbFarmer = await findFarmerByIdOrEmail(paramId, paramEmail);
        if (dbFarmer) hydrateForm(dbFarmer);
      }
    } catch (error) {
      console.log("load farmer skipped:", error);
    }
  }

  async function handleSaveAndContinue() {
    const saved = await saveFarmerProfile(step >= 4);
    if (saved) goNext();
  }

  function renderStepBody() {
    const key = STEPS[step].key as StepKey;

    if (key === "account") {
      return (
        <SectionCard
          icon="person-outline"
          title="Account"
          subtitle="Create the farmer login."
          done={businessComplete && (savedFarmerId || farmerId ? true : loginComplete)}
        >
          <TextInput
            style={styles.input}
            placeholder="Owner Name"
            value={ownerName}
            onChangeText={setOwnerName}
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Email Address"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          <TextInput
            style={styles.input}
            placeholder="Create Username"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
            autoCorrect={false}
          />
          {!savedFarmerId && !farmerId ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="Create Password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                autoCorrect={false}
              />
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                autoCorrect={false}
              />
            </>
          ) : null}
        </SectionCard>
      );
    }

    if (key === "farm") {
      return (
        <SectionCard
          icon="business-outline"
          title="Farm Business Info"
          subtitle="Basic farm and business details."
          done={Boolean(farmName.trim() && businessName.trim())}
        >
          <TextInput
            style={styles.input}
            placeholder="Farm Name"
            value={farmName}
            onChangeText={setFarmName}
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Business Name"
            value={businessName}
            onChangeText={setBusinessName}
            autoCorrect={false}
          />
        </SectionCard>
      );
    }

    if (key === "location") {
      return (
        <SectionCard
          icon="location-outline"
          title="Farm Location"
          subtitle="Used for local customer discovery."
          done={locationComplete}
        >
          <TextInput
            style={styles.input}
            placeholder="Business Address"
            value={businessAddress}
            onChangeText={setBusinessAddress}
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="City"
            value={city}
            onChangeText={setCity}
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="State"
            value={stateValue}
            onChangeText={(value) => setStateValue(value.toUpperCase().slice(0, 2))}
            maxLength={2}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Zip Code"
            keyboardType="numeric"
            value={zipCode}
            onChangeText={setZipCode}
          />
        </SectionCard>
      );
    }

    if (key === "products") {
      return (
        <SectionCard
          icon="leaf-outline"
          title="Products You Sell"
          subtitle="Select at least one category."
          done={productsComplete}
        >
          <View style={styles.grid}>
            {productOptions.map((product) => {
              const active = selectedProducts.includes(product);

              return (
                <TouchableOpacity
                  key={product}
                  style={[styles.productChip, active && styles.productChipActive]}
                  onPress={() => toggleProduct(product)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.productText, active && styles.productTextActive]}>
                    {product}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </SectionCard>
      );
    }

    if (key === "documents") {
      return (
        <SectionCard
          icon="document-text-outline"
          title="Required Farmer Documents"
          subtitle="Upload PDF or image files. These are verified at login."
          done={documentsComplete}
        >
          <DocumentInput
            label="Farm Business License / Registration"
            required
            value={farmBusinessLicenseDocument}
            fieldName="farm_business_license_document"
            uploadingField={uploadingField}
            onUpload={uploadFarmerDocument}
            onChangeText={setFarmBusinessLicenseDocument}
          />
          <DocumentInput
            label="Food Safety / Cottage Food Document"
            required
            value={foodSafetyDocument}
            fieldName="food_safety_document"
            uploadingField={uploadingField}
            onUpload={uploadFarmerDocument}
            onChangeText={setFoodSafetyDocument}
          />
          <DocumentInput
            label="Product Liability Insurance"
            required
            value={productLiabilityInsuranceDocument}
            fieldName="product_liability_insurance_document"
            uploadingField={uploadingField}
            onUpload={uploadFarmerDocument}
            onChangeText={setProductLiabilityInsuranceDocument}
          />
          <DocumentInput
            label="W-9 Form"
            required
            value={w9Document}
            fieldName="w9_document"
            uploadingField={uploadingField}
            onUpload={uploadFarmerDocument}
            onChangeText={setW9Document}
          />
          <DocumentInput
            label="Farm Permit / Producer Certificate"
            required
            value={farmPermitDocument}
            fieldName="farm_permit_document"
            uploadingField={uploadingField}
            onUpload={uploadFarmerDocument}
            onChangeText={setFarmPermitDocument}
          />
          <DocumentInput
            label="Organic Certification"
            value={organicCertificationDocument}
            fieldName="organic_certification_document"
            uploadingField={uploadingField}
            onUpload={uploadFarmerDocument}
            onChangeText={setOrganicCertificationDocument}
          />
          <DocumentInput
            label="Meat / Dairy License"
            value={meatDairyLicenseDocument}
            fieldName="meat_dairy_license_document"
            uploadingField={uploadingField}
            onUpload={uploadFarmerDocument}
            onChangeText={setMeatDairyLicenseDocument}
          />
          <DocumentInput
            label="Produce Safety Certificate"
            value={produceSafetyCertificateDocument}
            fieldName="produce_safety_certificate_document"
            uploadingField={uploadingField}
            onUpload={uploadFarmerDocument}
            onChangeText={setProduceSafetyCertificateDocument}
          />
        </SectionCard>
      );
    }

    if (key === "legal") {
      return (
        <SectionCard
          icon="shield-checkmark-outline"
          title="Farmer Seller Agreement"
          subtitle="Accept all items before continuing."
          done={legalComplete}
        >
          {agreements.map((item, index) => {
            const checked = Boolean(accepted[index]);

            return (
              <TouchableOpacity
                key={item}
                style={styles.legalRow}
                onPress={() =>
                  setAccepted((prev) => ({
                    ...prev,
                    [index]: !prev[index],
                  }))
                }
                activeOpacity={0.85}
              >
                <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                  <Text style={styles.checkText}>{checked ? "✓" : ""}</Text>
                </View>
                <Text style={styles.legalText}>{item}</Text>
              </TouchableOpacity>
            );
          })}
        </SectionCard>
      );
    }

    if (key === "stripe") {
      return (
        <SectionCard
          icon="card-outline"
          title="Stripe Membership"
          subtitle="Retrieve payment status or open checkout."
          done={isStripeCustomerId(stripeCustomerId) && isStripeSubscriptionId(subscriptionId)}
        >
          <View style={styles.statusBox}>
            {setupStatus.map((item) => (
              <View key={item.label} style={styles.statusRow}>
                <Ionicons
                  name={item.complete ? "checkmark-circle" : "ellipse-outline"}
                  size={18}
                  color={item.complete ? COLORS.green : COLORS.muted}
                />
                <Text style={styles.statusLabel}>{item.label}</Text>
                <Text style={[styles.statusValue, item.complete && styles.statusValueGood]}>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.actionBtn, syncingStripe && styles.disabled]}
            onPress={() => retrieveMissingStripeInfo(false)}
            disabled={syncingStripe}
          >
            {syncingStripe ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.actionText}>Retrieve Stripe Payment</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitBtn, stripeLoading && styles.disabled]}
            onPress={createFarmerCheckout}
            disabled={stripeLoading}
            activeOpacity={0.85}
          >
            {stripeLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="card-outline" size={20} color="#FFFFFF" />
                <Text style={styles.submitText}>Continue to Secure Payment</Text>
              </>
            )}
          </TouchableOpacity>
        </SectionCard>
      );
    }

    return (
      <SectionCard
        icon="checkmark-done-outline"
        title="Review Farmer Setup"
        subtitle={`${setupScore}/5 dashboard requirements complete.`}
        done={allFiveRequirementsFound}
      >
        <View style={styles.statusBox}>
          {setupStatus.map((item) => (
            <View key={item.label} style={styles.statusRow}>
              <Ionicons
                name={item.complete ? "checkmark-circle" : "ellipse-outline"}
                size={18}
                color={item.complete ? COLORS.green : COLORS.muted}
              />
              <Text style={styles.statusLabel}>{item.label}</Text>
              <Text style={[styles.statusValue, item.complete && styles.statusValueGood]}>
                {item.value}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.actionBtn, saving && styles.disabled]}
          onPress={() => saveFarmerProfile(true)}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.actionText}>Save Farmer Setup</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.dashboardBtn, !allFiveRequirementsFound && styles.disabled]}
          onPress={goDashboard}
          disabled={!allFiveRequirementsFound}
        >
          <Text style={styles.dashboardText}>Open Farmer Dashboard</Text>
        </TouchableOpacity>
      </SectionCard>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="leaf-outline" size={34} color="#FFFFFF" />
          </View>
          <Text style={styles.kicker}>Farm2Home Farmer Portal</Text>
          <Text style={styles.heroTitle}>Create Your Farmer Account</Text>
          <Text style={styles.heroSub}>
            Farmer registration now matches the freight setup pattern: profile,
            documents, Stripe subscription, then verified dashboard access.
          </Text>
        </View>

        <View style={styles.priceCard}>
          <Text style={styles.priceTitle}>Farmer Pricing</Text>
          <Text style={styles.priceLine}>Application Process Fee: $29.99</Text>
          <Text style={styles.priceLine}>Monthly Membership: $14.99</Text>
          <Text style={styles.priceLine}>Marketplace Service Fee: 4%</Text>
        </View>

        <View style={styles.stepBar}>
          {STEPS.map((item, index) => {
            const active = index === step;
            const done = index < step;

            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.stepPill,
                  active && styles.stepPillActive,
                  done && styles.stepPillDone,
                ]}
                onPress={() => setStep(index)}
              >
                <Ionicons
                  name={item.icon as any}
                  size={14}
                  color={active || done ? "#FFFFFF" : COLORS.muted}
                />
                <Text style={[styles.stepText, (active || done) && styles.stepTextActive]}>
                  {item.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {renderStepBody()}

        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.navButton, step === 0 && styles.disabled]}
            onPress={goBack}
            disabled={step === 0}
          >
            <Text style={styles.navButtonText}>Back</Text>
          </TouchableOpacity>

          {step < STEPS.length - 1 ? (
            <TouchableOpacity
              style={styles.navButtonPrimary}
              onPress={handleSaveAndContinue}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.navButtonPrimaryText}>Save & Next</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.navButtonPrimary}
              onPress={() => saveFarmerProfile(true)}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.navButtonPrimaryText}>Save Final</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.loginBtn}
          onPress={() => router.push("/farmer/login" as any)}
          activeOpacity={0.85}
        >
          <Text style={styles.loginText}>Already have account? Farmer Login</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusPill({ done }: { done: boolean }) {
  return (
    <View style={[styles.pill, done ? styles.pillDone : styles.pillMissing]}>
      <Text style={[styles.pillText, done ? styles.pillTextDone : styles.pillTextMissing]}>
        {done ? "Complete" : "Needed"}
      </Text>
    </View>
  );
}

function SectionCard({
  icon,
  title,
  subtitle,
  done,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={24} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardSub}>{subtitle}</Text>
        </View>
        <StatusPill done={done} />
      </View>
      {children}
    </View>
  );
}

function DocumentInput({
  label,
  value,
  onChangeText,
  fieldName,
  uploadingField,
  onUpload,
  required = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  fieldName: string;
  uploadingField: string;
  onUpload: (fieldName: string, setValue: (value: string) => void) => Promise<void>;
  required?: boolean;
}) {
  const isUploading = uploadingField === fieldName;

  return (
    <View style={styles.docWrap}>
      <Text style={styles.docLabel}>
        {label}{" "}
        {required ? (
          <Text style={styles.required}>*</Text>
        ) : (
          <Text style={styles.optional}>(optional)</Text>
        )}
      </Text>

      <TouchableOpacity
        style={[styles.uploadButton, isUploading && styles.disabled]}
        onPress={() => onUpload(fieldName, onChangeText)}
        disabled={Boolean(uploadingField)}
        activeOpacity={0.85}
      >
        {isUploading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
            <Text style={styles.uploadButtonText}>
              {value ? "Replace Uploaded File" : "Upload Document"}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {value ? (
        <View style={styles.uploadedPill}>
          <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.green} />
          <Text style={styles.uploadedText}>Uploaded</Text>
        </View>
      ) : null}

      <TextInput
        style={styles.hiddenDocInput}
        placeholder="Uploaded URL will appear here"
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 90 },

  hero: {
    backgroundColor: COLORS.black,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 32,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  kicker: {
    color: "#BBF7D0",
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 33,
    fontWeight: "900",
    marginTop: 8,
  },
  heroSub: {
    color: "#CBD5E1",
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },

  priceCard: {
    backgroundColor: COLORS.primary,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 24,
    padding: 16,
  },
  priceTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 8,
  },
  priceLine: {
    color: "#DCFCE7",
    fontWeight: "800",
    marginBottom: 4,
  },

  stepBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
  },
  stepPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  stepPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  stepPillDone: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
  },
  stepText: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "900",
  },
  stepTextActive: { color: "#FFFFFF" },

  card: {
    backgroundColor: COLORS.card,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 14,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
  },
  cardSub: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 2,
  },

  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillDone: { backgroundColor: "#DCFCE7" },
  pillMissing: { backgroundColor: "#FEE2E2" },
  pillText: { fontSize: 11, fontWeight: "900" },
  pillTextDone: { color: "#166534" },
  pillTextMissing: { color: "#B91C1C" },

  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    fontWeight: "800",
    marginBottom: 10,
    color: COLORS.text,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  productChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 999,
  },
  productChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  productText: {
    color: COLORS.text,
    fontWeight: "900",
  },
  productTextActive: { color: "#FFFFFF" },

  legalRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: COLORS.primary },
  checkText: { color: "#FFFFFF", fontWeight: "900" },
  legalText: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "800",
    lineHeight: 21,
  },

  docWrap: { marginBottom: 14 },
  docLabel: {
    color: COLORS.text,
    fontWeight: "900",
    marginBottom: 8,
  },
  required: { color: COLORS.red },
  optional: { color: COLORS.muted, fontWeight: "700" },
  uploadButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 8,
  },
  uploadButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  uploadedPill: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 8,
  },
  uploadedText: {
    color: COLORS.green,
    fontWeight: "900",
  },
  hiddenDocInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    fontWeight: "700",
    color: COLORS.muted,
    fontSize: 12,
  },

  statusBox: {
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    gap: 8,
  },
  statusLabel: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "800",
  },
  statusValue: {
    color: COLORS.muted,
    fontWeight: "900",
    fontSize: 12,
  },
  statusValueGood: { color: COLORS.green },

  actionBtn: {
    backgroundColor: COLORS.black,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  actionText: { color: "#FFFFFF", fontWeight: "900" },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  submitText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  dashboardBtn: {
    backgroundColor: COLORS.green,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 10,
  },
  dashboardText: { color: "#FFFFFF", fontWeight: "900" },

  navRow: {
    flexDirection: "row",
    gap: 12,
    marginHorizontal: 16,
    marginTop: 16,
  },
  navButton: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
  },
  navButtonText: {
    color: COLORS.text,
    fontWeight: "900",
  },
  navButtonPrimary: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
  },
  navButtonPrimaryText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  disabled: { opacity: 0.6 },

  loginBtn: {
    paddingVertical: 18,
    alignItems: "center",
  },
  loginText: {
    color: COLORS.primary,
    fontWeight: "900",
  },
});
