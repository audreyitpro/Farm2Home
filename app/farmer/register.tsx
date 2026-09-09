

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

const LEGAL_AGREEMENT_TYPE = "platform_agreement";
const LEGAL_AGREEMENT_VERSION = "1.0";

const PLATFORM_AGREEMENT_TEXT = `
FARM2HOME DIRECT PLATFORM AGREEMENT
VERSION 1.0

Effective Date: September 9, 2026

1. PURPOSE OF FARM2HOME DIRECT

Farm2Home Direct is a technology marketplace and platform designed to connect customers with independent farmers, producers, freight carriers, drivers, and other marketplace participants.

Farm2Home Direct provides technology that may allow users to discover products, communicate, place orders, coordinate pickup or delivery, arrange transportation, process payments, manage subscriptions, receive payouts, and use related marketplace services.

Farm2Home Direct does not itself grow, manufacture, produce, harvest, inspect, package, prepare, transport, deliver, store, or independently verify products or services offered by independent users of the platform unless Farm2Home Direct expressly states otherwise for a particular service.

2. INDEPENDENT FARMERS AND SELLERS

Farmers, producers, growers, ranchers, food producers, and sellers using Farm2Home Direct operate independently.

They are not employees, agents, representatives, partners, or joint venturers of Farm2Home Direct merely because they use the Farm2Home Direct platform.

Each farmer or seller is responsible for their own business operations, products, employees or contractors, licenses, registrations, permits, insurance, taxes, facilities, equipment, product claims, and regulatory compliance.

3. FARMER AND SELLER RESPONSIBILITIES

Farmers and sellers are responsible for every product they list, advertise, offer, or sell through Farm2Home Direct.

This includes responsibility for, where applicable:

• Product quality, condition, and safety.
• Accurate product names and descriptions.
• Accurate pricing, quantity, weight, and availability.
• Ingredients and allergen disclosures.
• Packaging and labeling.
• Food handling and sanitation.
• Refrigeration and temperature control.
• Storage requirements.
• Harvest, production, preparation, and expiration information.
• Organic, natural, halal, grass-fed, local, or other product claims.
• Required licenses, registrations, inspections, certifications, and permits.
• Product liability insurance when required.
• Compliance with applicable federal, state, and local laws and regulations.

Farm2Home Direct does not guarantee the quality, condition, safety, legality, freshness, suitability, or accuracy of products offered by independent farmers or sellers.

4. FOOD SAFETY AND REGULATORY COMPLIANCE

Farmers and sellers are solely responsible for determining and complying with laws and regulations that apply to their products and operations.

Depending on the farmer's products and location, requirements may include food safety rules, cottage food laws, produce safety requirements, meat or dairy requirements, labeling requirements, health department requirements, agricultural requirements, licensing requirements, permits, inspections, certifications, and other regulatory obligations.

The ability to create an account, upload a document, list a product, or receive a platform status does not constitute legal, regulatory, licensing, food-safety, or compliance approval by Farm2Home Direct.

5. FARMER DOCUMENTS

Farmers may be required to provide documents such as:

• Farm or business licenses.
• Food safety documentation.
• Product liability insurance.
• W-9 documentation.
• Farm permits.
• Organic certification when applicable.
• Meat or dairy licenses when applicable.
• Produce safety certification when applicable.
• Other documentation required by Farm2Home Direct or applicable law.

Farmers are responsible for ensuring submitted documents are authentic, accurate, current, and applicable to their operations.

6. PRODUCT INFORMATION AND ALLERGENS

Farmers and sellers are responsible for providing accurate information about products offered through Farm2Home Direct.

Where applicable, sellers must provide accurate ingredient, allergen, handling, preparation, storage, and warning information.

Farm2Home Direct does not independently test products or verify every ingredient, allergen, product claim, or label submitted by independent sellers.

7. CUSTOMER ORDERS

Farmers and sellers are responsible for fulfilling accepted customer orders accurately and within the commitments represented through the platform.

Farmers are responsible for product availability, substitutions, packaging, pickup readiness, delivery handoff, and communication concerning orders.

If an order cannot be fulfilled as represented, the farmer or seller is responsible for promptly communicating the issue and following applicable refund, replacement, cancellation, or credit procedures.

8. REFUNDS, REPLACEMENTS, AND CUSTOMER COMPLAINTS

Farmers and sellers agree to reasonably address legitimate customer complaints involving their products.

Depending on the circumstances and Farm2Home Direct policies, resolution may include a refund, replacement, credit, correction, or other appropriate remedy.

Farm2Home Direct may provide dispute-management or support tools but does not assume the farmer's responsibility for products supplied by that farmer.

9. FREIGHT, DELIVERY, AND PICKUP

Farm2Home Direct may provide technology that allows farmers to coordinate customer pickup, delivery, freight, or transportation.

Independent freight carriers and drivers remain responsible for their own transportation services.

Farmers are responsible for properly preparing, packaging, labeling, storing, and tendering products for pickup or transportation.

Farmers must communicate any special handling, temperature, safety, or delivery requirements applicable to their products.

10. PLATFORM ROLE

Farm2Home Direct facilitates connections between marketplace participants.

Depending on the features being used, Farm2Home Direct may provide technology for:

• Marketplace listings.
• Search and discovery.
• Farmer storefronts.
• Product and inventory management.
• Order coordination.
• Customer communication.
• Pickup and delivery coordination.
• Freight coordination.
• Location and tracking.
• Payment processing.
• Subscription management.
• Stripe Connect payment or payout functionality.
• Notifications.
• Customer support.
• Sales and business-management tools.
• Related marketplace services.

The availability of these features does not make Farm2Home Direct the grower, producer, manufacturer, farmer, seller, carrier, driver, employer, or direct provider of products or independent transportation services offered by platform users.

11. PAYMENTS, PAYOUTS, SUBSCRIPTIONS, AND FEES

Farm2Home Direct may charge membership, processing, transaction, platform, service, or other disclosed fees.

Farmers agree to applicable fees and payment terms presented before purchase, subscription, or transaction.

Farm2Home Direct may use third-party payment providers, including Stripe, to process payments, subscriptions, connected accounts, and payouts.

Use of third-party payment services may also be subject to the third party's terms, verification requirements, and policies.

12. TAXES

Farmers and sellers are responsible for their own business and income tax obligations and for maintaining records necessary for their business.

The collection, calculation, reporting, or remittance of particular transaction taxes may depend on applicable law and the services provided by Farm2Home Direct or third-party providers.

Nothing provided through Farm2Home Direct should be treated as individualized tax or legal advice.

13. NO GUARANTEE OF SALES OR REVENUE

Farm2Home Direct does not guarantee any particular number of customers, orders, sales, subscriptions, transactions, revenue, profits, delivery opportunities, or business results.

Results depend on factors outside Farm2Home Direct's control, including customer demand, product availability, pricing, seller performance, location, competition, expenses, and market conditions.

14. USER CONTENT AND REPRESENTATIONS

Farmers are responsible for product images, descriptions, prices, business information, messages, documents, licenses, certifications, insurance information, and other content they submit.

Farmers agree not to knowingly provide false, misleading, fraudulent, unlawful, expired, or unauthorized information.

15. INTELLECTUAL PROPERTY AND PRODUCT CONTENT

Farmers must have the right to use product photographs, business names, trademarks, descriptions, logos, and other content they submit to Farm2Home Direct.

Farmers must not knowingly upload content that infringes another person's intellectual property or other legal rights.

16. PROHIBITED PRODUCTS AND CONDUCT

Farmers may not use Farm2Home Direct to sell unlawful, prohibited, recalled, unsafe, fraudulent, counterfeit, or materially misrepresented products.

Farm2Home Direct may restrict or remove products, listings, content, or accounts that violate platform policies, applicable law, safety requirements, or third-party service requirements.

17. INSURANCE

Farmers are responsible for determining and maintaining insurance appropriate for their business and products, including product liability or other coverage when required by law, contract, or Farm2Home Direct eligibility requirements.

Farm2Home Direct does not provide insurance coverage for an independent farmer's products or operations unless expressly stated in a separate written agreement.

18. INDEMNIFICATION

To the extent permitted by applicable law and the Farm2Home Direct Terms of Service, farmers and sellers agree to be responsible for claims, losses, damages, liabilities, penalties, costs, or expenses arising from their products, business operations, legal violations, false representations, or breach of applicable platform obligations.

Any indemnification obligations are subject to applicable law and the controlling Terms of Service.

19. LIMITATION OF PLATFORM RESPONSIBILITY

To the fullest extent permitted by applicable law, Farm2Home Direct is not responsible for the independent acts, omissions, representations, products, services, business practices, transportation activities, or conduct of users of the platform.

Nothing in this agreement is intended to exclude, waive, or limit any responsibility or liability that cannot lawfully be excluded or limited.

20. ACCOUNT RESPONSIBILITY

Farmers are responsible for maintaining the security of their Farm2Home Direct account and login credentials.

Farmers must keep their business, contact, product, licensing, insurance, tax, payout, and other required account information reasonably accurate and current.

Farmers must not knowingly allow unauthorized individuals to use their account.

21. PRIVACY

Use of Farm2Home Direct is also governed by the Farm2Home Direct Privacy Policy.

The Privacy Policy describes how Farm2Home Direct collects, uses, stores, processes, shares, and protects information.

22. TERMS OF SERVICE

Use of Farm2Home Direct is also governed by the Farm2Home Direct Terms of Service.

If additional terms apply to a particular product, subscription, payment, payout, delivery, freight, or marketplace feature, those additional terms may also apply.

23. ELECTRONIC ACCEPTANCE

By selecting the required acknowledgment boxes and pressing "I Agree & Continue," the farmer confirms that:

• The farmer has been given an opportunity to read this Platform Agreement.
• The farmer understands that Farm2Home Direct operates primarily as a technology marketplace connecting independent participants.
• The farmer understands that the farmer remains responsible for products and business operations.
• The farmer agrees to comply with this Platform Agreement.
• The farmer agrees to the Farm2Home Direct Terms of Service.
• The farmer acknowledges the Farm2Home Direct Privacy Policy.
• The farmer's acceptance may be recorded electronically with the agreement version and acceptance date.

24. AGREEMENT VERSION

This is Farm2Home Direct Platform Agreement Version 1.0.

Acceptance of Version 1.0 applies to this version only.

If Farm2Home Direct materially updates this agreement, the platform may require the farmer to review and accept a new agreement version before continuing to use applicable services.

25. ACKNOWLEDGMENT

BY SELECTING "I AGREE & CONTINUE," YOU ACKNOWLEDGE THAT YOU HAVE READ AND UNDERSTAND THIS FARM2HOME DIRECT PLATFORM AGREEMENT, VERSION 1.0, AND AGREE TO BE BOUND BY ITS TERMS.
`.trim();

const agreements = [
  "I acknowledge that I have read and understand the Farm2Home Direct Platform Agreement.",
  "I understand that I am an independent farmer or seller and remain responsible for my products, food safety, labeling, licensing, insurance, and business operations.",
  "I understand that Farm2Home Direct operates as a technology marketplace connecting independent customers, farmers, freight carriers, and drivers.",
  "I agree to the Farm2Home Direct Terms of Service and acknowledge the Privacy Policy.",
];

function formatLegalDate(value: any) {
  const raw = clean(value);
  if (!raw) return "";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleString();
}

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
  const [legalLoading, setLegalLoading] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [legalAcceptedAt, setLegalAcceptedAt] = useState("");
  const [legalAgreementVersion, setLegalAgreementVersion] =
    useState(LEGAL_AGREEMENT_VERSION);

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
  const legalAcknowledgmentsComplete = agreements.every((_, index) => accepted[index]);
  const legalComplete = legalAccepted;

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
      {
        label: "Legal Agreement",
        complete: legalAccepted,
        value: legalAccepted
          ? `Accepted v${legalAgreementVersion}`
          : "Required",
      },
    ],
    [savedFarmerId, farmerId, accountId, stripeCustomerId, subscriptionId, documentsComplete, legalAccepted, legalAgreementVersion]
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

  async function loadLegalAcceptance(userId?: string) {
    const id = clean(userId);
    if (!id) return null;

    const { data, error } = await supabase
      .from("legal_agreement_acceptances")
      .select(
        "id,user_id,role,agreement_type,agreement_version,accepted,accepted_at,created_at"
      )
      .eq("user_id", id)
      .eq("role", "farmer")
      .eq("agreement_type", LEGAL_AGREEMENT_TYPE)
      .eq("agreement_version", LEGAL_AGREEMENT_VERSION)
      .eq("accepted", true)
      .maybeSingle();

    if (error) {
      console.log("Farmer legal agreement lookup:", error.message);
      return null;
    }

    if (data) {
      setLegalAccepted(true);
      setLegalAcceptedAt(clean(data.accepted_at));
      setLegalAgreementVersion(
        clean(data.agreement_version) || LEGAL_AGREEMENT_VERSION
      );

      const restored: Record<number, boolean> = {};
      agreements.forEach((_, index) => {
        restored[index] = true;
      });
      setAccepted(restored);

      await AsyncStorage.multiSet([
        ["farm2homeLegalAgreementAccepted", "true"],
        ["farm2homeLegalAgreementVersion", clean(data.agreement_version)],
        ["farm2homeLegalAgreementAcceptedAt", clean(data.accepted_at)],
        ["farm2homeLegalAgreementRole", "farmer"],
      ]);
    }

    return data;
  }

  async function acceptLegalAgreement() {
    if (legalLoading) return;

    if (!legalAcknowledgmentsComplete) {
      Alert.alert(
        "Acknowledgment Required",
        "You must select every Legal & Agreements acknowledgment before continuing."
      );
      return;
    }

    try {
      setLegalLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user?.id) {
        throw new Error(
          "You must save your farmer account and be signed in before accepting the agreement."
        );
      }

      const existing = await loadLegalAcceptance(user.id);

      if (existing) {
        setStep(6);
        return;
      }

      const { data, error } = await supabase
        .from("legal_agreement_acceptances")
        .insert({
          user_id: user.id,
          role: "farmer",
          agreement_type: LEGAL_AGREEMENT_TYPE,
          agreement_version: LEGAL_AGREEMENT_VERSION,
          agreement_text: PLATFORM_AGREEMENT_TEXT,
          agreement_hash: `farm2home-platform-v${LEGAL_AGREEMENT_VERSION}`,
          accepted: true,
        })
        .select(
          "id,user_id,role,agreement_type,agreement_version,accepted,accepted_at,created_at"
        )
        .single();

      if (error) {
        if (String(error.code) === "23505") {
          const duplicate = await loadLegalAcceptance(user.id);
          if (duplicate) {
            setStep(6);
            return;
          }
        }
        throw error;
      }

      setLegalAccepted(true);
      setLegalAcceptedAt(clean(data.accepted_at));
      setLegalAgreementVersion(
        clean(data.agreement_version) || LEGAL_AGREEMENT_VERSION
      );

      await AsyncStorage.multiSet([
        ["farm2homeLegalAgreementAccepted", "true"],
        ["farm2homeLegalAgreementVersion", clean(data.agreement_version)],
        ["farm2homeLegalAgreementAcceptedAt", clean(data.accepted_at)],
        ["farm2homeLegalAgreementRole", "farmer"],
      ]);

      Alert.alert(
        "Agreement Accepted",
        `Farm2Home Direct Platform Agreement Version ${LEGAL_AGREEMENT_VERSION} was accepted on ${formatLegalDate(
          data.accepted_at
        )}.`
      );

      setStep(6);
    } catch (error: any) {
      console.log("Farmer legal agreement acceptance error:", error);
      Alert.alert(
        "Agreement Error",
        error?.message ||
          "Unable to save your Farm2Home Direct Legal & Agreements acknowledgment."
      );
    } finally {
      setLegalLoading(false);
    }
  }

  async function requireLegalAgreement(userId?: string, showAlert = true) {
    const id = clean(userId);

    if (!id) {
      if (showAlert) {
        Alert.alert(
          "Legal Agreement Required",
          "Save your farmer account and accept Legal & Agreements before continuing."
        );
      }
      setStep(5);
      return false;
    }

    if (legalAccepted) return true;

    const acceptance = await loadLegalAcceptance(id);
    if (acceptance) return true;

    setStep(5);

    if (showAlert) {
      Alert.alert(
        "Legal Agreement Required",
        "You must review and accept the Farm2Home Direct Platform Agreement before continuing."
      );
    }

    return false;
  }

  function goNext() {
    if (step === 5 && !legalAccepted) {
      Alert.alert(
        "Legal Agreement Required",
        "Read the agreement, select every acknowledgment, and press I Agree & Continue."
      );
      return;
    }

    setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  }

  function goBack() {
    setStep((prev) => Math.max(prev - 1, 0));
  }

  async function goDashboard() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const id = clean(user?.id || savedFarmerId || farmerId);
    const legalOk = await requireLegalAgreement(id, true);
    if (!legalOk) return;

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
      legal_agreement_accepted: legalAccepted,
      legal_agreement_version: legalAgreementVersion,
      legal_agreement_accepted_at: legalAcceptedAt || null,
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
        "Accept the Farm2Home Direct Platform Agreement before continuing."
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
      legal_agreement_accepted: legalAccepted,
      legal_agreement_version: legalAgreementVersion,
      legal_agreement_accepted_at: legalAcceptedAt || null,

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

        if (routeWhenReady && hasCompleteDashboardAccess(backendSynced)) await goDashboard();

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

        if (routeWhenReady && hasCompleteDashboardAccess(saved)) await goDashboard();

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
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.id) {
        await loadLegalAcceptance(user.id);
      }

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
    // Full validation should begin only after the Legal step.
    // Documents must be allowed to save before the user can accept Legal.
    const saved = await saveFarmerProfile(step >= 5);
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
          title="Legal & Agreements"
          subtitle="Required before Stripe payment and Farmer Dashboard access."
          done={legalAccepted}
        >
          {legalAccepted ? (
            <View style={styles.legalAcceptedBox}>
              <Ionicons
                name="checkmark-circle"
                size={30}
                color={COLORS.green}
              />

              <View style={{ flex: 1 }}>
                <Text style={styles.legalAcceptedTitle}>
                  Agreement Accepted
                </Text>

                <Text style={styles.legalAcceptedText}>
                  Farm2Home Direct Platform Agreement Version{" "}
                  {legalAgreementVersion}
                </Text>

                <Text style={styles.legalAcceptedText}>
                  Accepted: {formatLegalDate(legalAcceptedAt)}
                </Text>

                <Text style={styles.legalPermanentText}>
                  Your original acceptance date and agreement version are
                  permanently recorded and cannot be changed from the app.
                </Text>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.legalRequiredBox}>
                <Ionicons
                  name="alert-circle-outline"
                  size={22}
                  color={COLORS.amber}
                />
                <Text style={styles.legalRequiredText}>
                  Read the agreement and select every acknowledgment before
                  continuing.
                </Text>
              </View>

              <View style={styles.legalDocument}>
                <Text style={styles.legalDocumentTitle}>
                  Farm2Home Direct Platform Agreement
                </Text>
                <Text style={styles.legalVersion}>
                  Version {LEGAL_AGREEMENT_VERSION}
                </Text>

                <View style={styles.legalDivider} />

                <Text style={styles.legalText}>
                  {PLATFORM_AGREEMENT_TEXT}
                </Text>
              </View>

              {agreements.map((item, index) => {
                const checked = Boolean(accepted[index]);

                return (
                  <TouchableOpacity
                    key={`${index}-${item}`}
                    style={[
                      styles.legalCheckRow,
                      checked && styles.legalCheckRowSelected,
                    ]}
                    onPress={() =>
                      setAccepted((prev) => ({
                        ...prev,
                        [index]: !prev[index],
                      }))
                    }
                    activeOpacity={0.85}
                  >
                    <View
                      style={[
                        styles.legalCheckbox,
                        checked && styles.legalCheckboxSelected,
                      ]}
                    >
                      {checked ? (
                        <Ionicons
                          name="checkmark"
                          size={18}
                          color={COLORS.white}
                        />
                      ) : null}
                    </View>

                    <Text style={styles.legalCheckText}>{item}</Text>
                  </TouchableOpacity>
                );
              })}

              <View style={styles.legalLinksRow}>
                <TouchableOpacity onPress={() => router.push("/terms" as any)}>
                  <Text style={styles.legalLink}>Terms of Service</Text>
                </TouchableOpacity>

                <Text style={styles.legalLinkDivider}>•</Text>

                <TouchableOpacity onPress={() => router.push("/privacy" as any)}>
                  <Text style={styles.legalLink}>Privacy Policy</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.legalAgreeButton,
                  (!legalAcknowledgmentsComplete || legalLoading) &&
                    styles.legalAgreeButtonDisabled,
                ]}
                disabled={!legalAcknowledgmentsComplete || legalLoading}
                onPress={acceptLegalAgreement}
                activeOpacity={0.9}
              >
                {legalLoading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={21}
                      color={COLORS.white}
                    />
                    <Text style={styles.legalAgreeButtonText}>
                      I Agree & Continue
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.legalNotice}>
                Your official acceptance date is generated by the database.
                The original acceptance record is not editable from the farmer
                profile.
              </Text>
            </>
          )}

          {legalAccepted ? (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setStep(6)}
              activeOpacity={0.9}
            >
              <Text style={styles.primaryButtonText}>Continue to Stripe</Text>
              <Ionicons
                name="arrow-forward-outline"
                size={19}
                color={COLORS.white}
              />
            </TouchableOpacity>
          ) : null}
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

  legalAcceptedBox: {
    backgroundColor: "#ECFDF3",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },

  legalAcceptedTitle: {
    color: COLORS.primaryDark,
    fontSize: 16,
    fontWeight: "900",
  },

  legalAcceptedText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 3,
  },

  legalPermanentText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 6,
  },

  legalRequiredBox: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 16,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 14,
  },

  legalRequiredText: {
    flex: 1,
    color: "#92400E",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
  },

  legalDocument: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },

  legalDocumentTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "900",
  },

  legalVersion: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 4,
  },

  legalDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 14,
  },

  legalText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 21,
  },

  legalCheckRow: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 13,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    marginBottom: 10,
  },

  legalCheckRowSelected: {
    backgroundColor: COLORS.primarySoft,
    borderColor: "#86EFAC",
  },

  legalCheckbox: {
    width: 25,
    height: 25,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#98A2B3",
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },

  legalCheckboxSelected: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
  },

  legalCheckText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 20,
  },

  legalLinksRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 2,
    marginBottom: 12,
    flexWrap: "wrap",
  },

  legalLink: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "900",
    textDecorationLine: "underline",
  },

  legalLinkDivider: {
    color: COLORS.muted,
    fontWeight: "900",
  },

  legalAgreeButton: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: COLORS.green,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 5,
  },

  legalAgreeButtonDisabled: {
    opacity: 0.45,
  },

  legalAgreeButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "900",
  },

  legalNotice: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 17,
    textAlign: "center",
    marginTop: 9,
    marginBottom: 14,
  },


  primaryButton: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18,
    marginTop: 14,
  },

  primaryButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },

});
