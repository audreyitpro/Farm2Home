// app/farmer/compliance-upload.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import { API_BASE_URL } from "../config/api";
import { PAYMENT_LINKS } from "../config/paymentLinks";
import { supabase } from "../data/supabaseClient";

import {
  REQUIRED_DOCUMENTS,
  ComplianceDocumentType,
  addComplianceDocument,
  getComplianceRecord,
} from "../data/complianceStore";

import {
  getFarmerById,
  getFarmers,
  updateFarmerStore,
} from "../data/farmerStore";

import {
  createVerificationRecordFromFarmer,
  upsertVerificationRecord,
} from "../data/adminStore";

const PICKUP_DELIVERY_OPTIONS = [
  "Pickup Only",
  "Delivery Only",
  "Pickup and Delivery",
];

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your mother’s maiden name?",
  "What was the name of your elementary school?",
  "What was your first car?",
  "What is your favorite food?",
  "What is your favorite farm animal?",
  "What was the name of your childhood best friend?",
  "What street did you grow up on?",
  "What is your favorite teacher’s name?",
];

const LEGAL_CHECKLIST = [
  "I confirm my business information is accurate.",
  "I confirm I am authorized to sell these products.",
  "I confirm I will follow state food and farm regulations.",
  "I confirm perishable items will be handled safely.",
  "I confirm pickup and delivery terms are accurate.",
  "I confirm payout information belongs to my business.",
  "I agree to Farm2Home seller terms.",
];

const PENDING_FARMER_KEY = "pendingFarmerApplication";

export default function FarmerComplianceUploadScreen() {
  const params = useLocalSearchParams();

  const farmerIdFromParams = params.farmerId ? String(params.farmerId) : "";
  const stripeReturn = String(params.stripeReturn || "") === "true";
  const returnedStripeAccountId = params.accountId
    ? String(params.accountId)
    : "";

  const [stripeReturnHandled, setStripeReturnHandled] = useState(false);

  const [farmerId, setFarmerId] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [farmerEmail, setFarmerEmail] = useState("");
  const [state, setState] = useState("MI");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [securityQuestion1, setSecurityQuestion1] = useState("");
  const [securityAnswer1, setSecurityAnswer1] = useState("");
  const [securityQuestion2, setSecurityQuestion2] = useState("");
  const [securityAnswer2, setSecurityAnswer2] = useState("");
  const [securityQuestion3, setSecurityQuestion3] = useState("");
  const [securityAnswer3, setSecurityAnswer3] = useState("");

  const [farmerMembershipPaid, setFarmerMembershipPaid] = useState(false);
  const [applicationFeePaid, setApplicationFeePaid] = useState(false);

  const [stripeAccountId, setStripeAccountId] = useState("");
  const [stripePayoutAccount, setStripePayoutAccount] = useState("");
  const [stripePayoutsEnabled, setStripePayoutsEnabled] = useState(false);
  const [stripeChargesEnabled, setStripeChargesEnabled] = useState(false);
  const [stripeOnboardingComplete, setStripeOnboardingComplete] =
    useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeChecking, setStripeChecking] = useState(false);

  const [pickupDeliveryOption, setPickupDeliveryOption] =
    useState("Pickup and Delivery");

  const [uploadedDocs, setUploadedDocs] = useState<Record<string, string>>({});
  const [legalChecks, setLegalChecks] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);

  const allLegalAccepted = useMemo(
    () => LEGAL_CHECKLIST.every((_, index) => legalChecks[index]),
    [legalChecks]
  );

  const requiredDocTypes = useMemo(
    () =>
      REQUIRED_DOCUMENTS.filter((doc) => {
        const type = String(doc.type);

        return (
          doc.required &&
          type !== "stripe_payout" &&
          type !== "pickup_delivery_agreement" &&
          type !== "legal_checklist"
        );
      }).map((doc) => doc.type),
    []
  );

  const missingRequiredDocs = useMemo(() => {
    return requiredDocTypes.filter((type) => !uploadedDocs[type]);
  }, [requiredDocTypes, uploadedDocs]);

  useFocusEffect(
    useCallback(() => {
      loadFarmer();
    }, [farmerIdFromParams])
  );

  useFocusEffect(
    useCallback(() => {
      if (stripeReturn && returnedStripeAccountId && !stripeReturnHandled) {
        setStripeReturnHandled(true);
        handleStripeReturn(returnedStripeAccountId);
      }
    }, [stripeReturn, returnedStripeAccountId, stripeReturnHandled])
  );

  async function saveFarmerSubmissionToSupabase(
    activeFarmerId: string,
    reviewPayload: Record<string, any>
  ) {
    const now = new Date().toISOString();
    const docsToUse = reviewPayload.uploadedDocs || uploadedDocs || {};

    const documents = Object.entries(docsToUse).map(([type, uri]) => ({
      id: `${activeFarmerId}_${type}`,
      farmerId: activeFarmerId,
      type,
      name: String(type).replace(/_/g, " "),
      uri: String(uri),
      status: "PENDING",
      uploadedAt: now,
    }));

    const adminRecord = {
      id: activeFarmerId,
      farmer_id: activeFarmerId,
      account_type: "FARMER",
      role: "farmer",

      business_name: reviewPayload.businessName || businessName,
      farm_name: reviewPayload.farmName || businessName,
      owner_name: reviewPayload.ownerName || ownerName,
      email: reviewPayload.email || farmerEmail,
      state: reviewPayload.state || state,

      status: "PENDING_ADMIN_REVIEW",
      compliance_status: "pending_admin_review",
      admin_review_status: "pending",
      review_decision: "pending",

      approved: false,
      rejected: false,
      needs_more_info: false,
      reviewed: false,
      account_active: false,
      compliance_submitted: true,

      farmer_membership_paid: Boolean(reviewPayload.farmerMembershipPaid),
      application_fee_paid: Boolean(reviewPayload.applicationFeePaid),
      farmer_activation_paid: Boolean(reviewPayload.farmerActivationPaid),
      farmer_monthly_subscription_paid: Boolean(
        reviewPayload.farmerMonthlySubscriptionPaid
      ),

      stripe_account_id: reviewPayload.stripeAccountId || "",
      farmer_stripe_account_id: reviewPayload.farmerStripeAccountId || "",
      stripe_payouts_enabled: Boolean(reviewPayload.stripePayoutsEnabled),
      stripe_charges_enabled: Boolean(reviewPayload.stripeChargesEnabled),
      stripe_onboarding_complete: Boolean(
        reviewPayload.stripeOnboardingComplete
      ),

      pickup_delivery_option: reviewPayload.pickupDeliveryOption || "",
      uploaded_docs: docsToUse,
      legal_checks: reviewPayload.legalChecks || {},
      documents,

      submitted_at: now,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from("admin_verifications")
      .upsert(adminRecord)
      .select();

    console.log("ADMIN SUPABASE SAVE DATA:", data);
    console.log("ADMIN SUPABASE SAVE ERROR:", error);

    if (error) {
      throw new Error(error.message);
    }

    if (documents.length > 0) {
      const documentRows = documents.map((doc) => ({
        id: doc.id,
        farmer_id: activeFarmerId,
        verification_id: activeFarmerId,
        document_type: doc.type,
        document_name: doc.name,
        document_uri: doc.uri,
        status: "PENDING",
        uploaded_at: now,
        created_at: now,
        updated_at: now,
      }));

      const { error: docsError } = await supabase
        .from("admin_verification_documents")
        .upsert(documentRows);

      console.log("ADMIN SUPABASE DOCS ERROR:", docsError);

      if (docsError) {
        throw new Error(docsError.message);
      }
    }
  }

  function buildFarmerSnapshot(
    activeFarmerId = farmerId,
    statusOverride = "in_progress",
    overrides: Record<string, any> = {}
  ) {
    const nextBusinessName = overrides.businessName ?? businessName;
    const nextOwnerName = overrides.ownerName ?? ownerName;
    const nextEmail = overrides.email ?? farmerEmail;
    const nextUsername = overrides.username ?? username;
    const nextPassword = overrides.password ?? password;
    const nextUploadedDocs = overrides.uploadedDocs ?? uploadedDocs;
    const nextLegalChecks = overrides.legalChecks ?? legalChecks;
    const nextStripeAccountId = overrides.stripeAccountId ?? stripeAccountId;
    const nextStripePayoutAccount =
      overrides.stripePayoutAccount ?? stripePayoutAccount;
    const nextStatus = overrides.complianceStatus ?? statusOverride;

    return {
      id: activeFarmerId,
      farmerId: activeFarmerId,
      farmName: nextBusinessName,
      businessName: nextBusinessName,
      ownerName: nextOwnerName,
      email: nextEmail,
      state: overrides.state ?? state,

      username: nextUsername,
      password: nextPassword,
      securityQuestion1: overrides.securityQuestion1 ?? securityQuestion1,
      securityAnswer1: overrides.securityAnswer1 ?? securityAnswer1,
      securityQuestion2: overrides.securityQuestion2 ?? securityQuestion2,
      securityAnswer2: overrides.securityAnswer2 ?? securityAnswer2,
      securityQuestion3: overrides.securityQuestion3 ?? securityQuestion3,
      securityAnswer3: overrides.securityAnswer3 ?? securityAnswer3,

      farmerMembershipPaid:
        overrides.farmerMembershipPaid ?? farmerMembershipPaid,
      applicationFeePaid: overrides.applicationFeePaid ?? applicationFeePaid,
      farmerActivationPaid: overrides.farmerActivationPaid ?? false,
      activationFeePaid: overrides.activationFeePaid ?? false,
      farmerMonthlySubscriptionPaid:
        overrides.farmerMonthlySubscriptionPaid ?? false,

      stripeAccountId: nextStripeAccountId,
      farmerStripeAccountId: nextStripeAccountId,
      stripePayoutAccount: nextStripePayoutAccount,
      stripePayoutsEnabled:
        overrides.stripePayoutsEnabled ?? stripePayoutsEnabled,
      stripeChargesEnabled:
        overrides.stripeChargesEnabled ?? stripeChargesEnabled,
      stripeOnboardingComplete:
        overrides.stripeOnboardingComplete ?? stripeOnboardingComplete,

      pickupDeliveryOption:
        overrides.pickupDeliveryOption ?? pickupDeliveryOption,
      pickup:
        (overrides.pickupDeliveryOption ?? pickupDeliveryOption) ===
          "Pickup Only" ||
        (overrides.pickupDeliveryOption ?? pickupDeliveryOption) ===
          "Pickup and Delivery",
      delivery:
        (overrides.pickupDeliveryOption ?? pickupDeliveryOption) ===
          "Delivery Only" ||
        (overrides.pickupDeliveryOption ?? pickupDeliveryOption) ===
          "Pickup and Delivery",

      uploadedDocs: nextUploadedDocs,
      legalChecks: nextLegalChecks,

      approved: overrides.approved ?? false,
      rejected: overrides.rejected ?? false,
      needsMoreInfo: overrides.needsMoreInfo ?? false,
      reviewed: overrides.reviewed ?? false,
      accountActive: overrides.accountActive ?? false,

      complianceSubmitted:
        overrides.complianceSubmitted ?? nextStatus === "pending_admin_review",
      status:
        nextStatus === "pending_admin_review"
          ? "PENDING_ADMIN_REVIEW"
          : nextStatus,
      complianceStatus: nextStatus,
      adminReviewStatus:
        nextStatus === "pending_admin_review" ? "pending" : undefined,
      reviewDecision:
        nextStatus === "pending_admin_review" ? "pending" : undefined,

      submittedAt: overrides.submittedAt,
      updatedAt: new Date().toISOString(),
    };
  }

  async function savePendingFarmerSnapshot(
    activeFarmerId = farmerId,
    statusOverride = "in_progress",
    overrides: Record<string, any> = {}
  ) {
    const snapshot = buildFarmerSnapshot(
      activeFarmerId,
      statusOverride,
      overrides
    );

    await AsyncStorage.setItem(PENDING_FARMER_KEY, JSON.stringify(snapshot));
    await AsyncStorage.setItem("currentFarmer", JSON.stringify(snapshot));
    await AsyncStorage.setItem("currentUser", JSON.stringify(snapshot));
    await AsyncStorage.setItem("userRole", "farmer");
    await AsyncStorage.setItem("currentUserRole", "farmer");

    return snapshot;
  }

  async function createOrUpdateAdminVerificationRecord(
    activeFarmerId: string,
    status = "PENDING_VERIFICATION",
    overrides: Record<string, any> = {}
  ) {
    if (!activeFarmerId) return;

    const docsToUse = overrides.uploadedDocs ?? uploadedDocs;

    const documents = Object.entries(docsToUse || {}).map(([type, uri]) => ({
      id: `${activeFarmerId}_${type}`,
      name: String(type).replace(/_/g, " "),
      type,
      uri: String(uri),
      uploadedAt: new Date().toISOString(),
      status: "PENDING",
    }));

    const record = createVerificationRecordFromFarmer({
      farmerId: activeFarmerId,
      farmName: overrides.businessName || businessName || "Farm2Home Farm",
      ownerName: overrides.ownerName || ownerName || "",
      email: overrides.email || farmerEmail || "",
      phone: "",
      documents,
    } as any);

    await upsertVerificationRecord({
      ...record,
      farmerId: activeFarmerId,
      id: activeFarmerId,
      accountType: "FARMER",
      farmName: overrides.businessName || businessName || "Farm2Home Farm",
      businessName: overrides.businessName || businessName || "Farm2Home Farm",
      ownerName: overrides.ownerName || ownerName || "",
      email: overrides.email || farmerEmail || "",
      phone: "",
      state: overrides.state || state,
      status,
      complianceStatus:
        status === "PENDING_ADMIN_REVIEW" ? "pending_admin_review" : status,
      adminReviewStatus: status === "PENDING_ADMIN_REVIEW" ? "pending" : status,
      reviewDecision: status === "PENDING_ADMIN_REVIEW" ? "pending" : undefined,
      approved: false,
      rejected: false,
      needsMoreInfo: false,
      reviewed: false,
      accountActive: false,
      complianceSubmitted: status === "PENDING_ADMIN_REVIEW",
      farmerMembershipPaid:
        overrides.farmerMembershipPaid ?? farmerMembershipPaid,
      applicationFeePaid: overrides.applicationFeePaid ?? applicationFeePaid,
      farmerActivationPaid: overrides.farmerActivationPaid ?? false,
      activationFeePaid: overrides.activationFeePaid ?? false,
      farmerMonthlySubscriptionPaid:
        overrides.farmerMonthlySubscriptionPaid ?? false,
      stripeAccountId: overrides.stripeAccountId ?? stripeAccountId,
      farmerStripeAccountId: overrides.stripeAccountId ?? stripeAccountId,
      stripePayoutsEnabled:
        overrides.stripePayoutsEnabled ?? stripePayoutsEnabled,
      stripeChargesEnabled:
        overrides.stripeChargesEnabled ?? stripeChargesEnabled,
      stripeOnboardingComplete:
        overrides.stripeOnboardingComplete ?? stripeOnboardingComplete,
      pickupDeliveryOption:
        overrides.pickupDeliveryOption ?? pickupDeliveryOption,
      uploadedDocs: docsToUse,
      legalChecks: overrides.legalChecks ?? legalChecks,
      documents,
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);
  }

  async function saveAdminVerificationQueueFallback(
    activeFarmerId: string,
    status = "PENDING_ADMIN_REVIEW",
    overrides: Record<string, any> = {}
  ) {
    const now = new Date().toISOString();
    const docsToUse = overrides.uploadedDocs ?? uploadedDocs;

    const queueRecord: any = {
      id: activeFarmerId,
      farmerId: activeFarmerId,
      accountType: "FARMER",
      type: "FARMER",
      role: "farmer",

      businessName: overrides.businessName || businessName || "Farm2Home Farm",
      farmName: overrides.businessName || businessName || "Farm2Home Farm",
      ownerName: overrides.ownerName || ownerName || "",
      email: overrides.email || farmerEmail || "",
      phone: "",
      state: overrides.state || state,

      status,
      complianceStatus: "pending_admin_review",
      adminReviewStatus: "pending",
      reviewDecision: "pending",

      approved: false,
      rejected: false,
      needsMoreInfo: false,
      reviewed: false,
      accountActive: false,
      complianceSubmitted: true,

      farmerMembershipPaid:
        overrides.farmerMembershipPaid ?? farmerMembershipPaid,
      applicationFeePaid: overrides.applicationFeePaid ?? applicationFeePaid,
      farmerActivationPaid: overrides.farmerActivationPaid ?? false,
      activationFeePaid: overrides.activationFeePaid ?? false,
      farmerMonthlySubscriptionPaid:
        overrides.farmerMonthlySubscriptionPaid ?? false,

      stripeAccountId: overrides.stripeAccountId ?? stripeAccountId,
      farmerStripeAccountId: overrides.stripeAccountId ?? stripeAccountId,
      stripePayoutsEnabled:
        overrides.stripePayoutsEnabled ?? stripePayoutsEnabled,
      stripeChargesEnabled:
        overrides.stripeChargesEnabled ?? stripeChargesEnabled,
      stripeOnboardingComplete:
        overrides.stripeOnboardingComplete ?? stripeOnboardingComplete,

      pickupDeliveryOption:
        overrides.pickupDeliveryOption ?? pickupDeliveryOption,

      username: overrides.username ?? username,
      password: overrides.password ?? password,
      securityQuestion1: overrides.securityQuestion1 ?? securityQuestion1,
      securityAnswer1: overrides.securityAnswer1 ?? securityAnswer1,
      securityQuestion2: overrides.securityQuestion2 ?? securityQuestion2,
      securityAnswer2: overrides.securityAnswer2 ?? securityAnswer2,
      securityQuestion3: overrides.securityQuestion3 ?? securityQuestion3,
      securityAnswer3: overrides.securityAnswer3 ?? securityAnswer3,

      uploadedDocs: docsToUse,
      legalChecks: overrides.legalChecks ?? legalChecks,

      documents: Object.entries(docsToUse || {}).map(([type, uri]) => ({
        id: `${activeFarmerId}_${type}`,
        name: String(type).replace(/_/g, " "),
        type,
        uri: String(uri),
        uploadedAt: now,
        status: "PENDING",
      })),

      adminNotes: [],
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const queueKeys = [
      "farm2homeVerificationQueue",
      "adminVerificationQueue",
      "verificationQueue",
      "complianceReviewQueue",
      "farmerComplianceQueue",
    ];

    for (const key of queueKeys) {
      const rawQueue = await AsyncStorage.getItem(key);
      let queue: any[] = [];

      try {
        queue = rawQueue ? JSON.parse(rawQueue) : [];
        if (!Array.isArray(queue)) queue = [];
      } catch {
        queue = [];
      }

      const nextQueue = [
        queueRecord,
        ...queue.filter(
          (item: any) =>
            item?.id !== activeFarmerId && item?.farmerId !== activeFarmerId
        ),
      ];

      await AsyncStorage.setItem(key, JSON.stringify(nextQueue));
    }

    await AsyncStorage.setItem(
      `verification_${activeFarmerId}`,
      JSON.stringify(queueRecord)
    );

    await AsyncStorage.setItem(
      `farmer_verification_${activeFarmerId}`,
      JSON.stringify(queueRecord)
    );

    return queueRecord;
  }

  async function getOrCreateFarmerId() {
    if (farmerId) return farmerId;

    const saved =
      (await AsyncStorage.getItem("currentFarmer")) ||
      (await AsyncStorage.getItem(PENDING_FARMER_KEY));

    if (saved) {
      try {
        const savedFarmer = JSON.parse(saved);

        if (savedFarmer?.id) {
          setFarmerId(savedFarmer.id);
          return savedFarmer.id;
        }
      } catch {}
    }

    const newId = `farmer_${Date.now()}`;

    const fallbackFarmer = {
      id: newId,
      farmerId: newId,
      farmName: businessName || "Farm2Home Farmer",
      businessName: businessName || "Farm2Home Farmer",
      ownerName: ownerName || "",
      email: farmerEmail || "",
      state: state || "MI",
      complianceStatus: "in_progress",
      approved: false,
      accountActive: false,
    };

    await AsyncStorage.setItem("currentFarmer", JSON.stringify(fallbackFarmer));
    await AsyncStorage.setItem(
      PENDING_FARMER_KEY,
      JSON.stringify(fallbackFarmer)
    );
    await AsyncStorage.setItem("currentUser", JSON.stringify(fallbackFarmer));
    await AsyncStorage.setItem("userRole", "farmer");
    await AsyncStorage.setItem("currentUserRole", "farmer");

    setFarmerId(newId);

    return newId;
  }

  async function syncCurrentFarmer(activeFarmerId = farmerId) {
    if (!activeFarmerId) return;

    const latestFarmer = await getFarmerById(activeFarmerId);

    if (latestFarmer) {
      await AsyncStorage.setItem("currentFarmer", JSON.stringify(latestFarmer));
      await AsyncStorage.setItem(
        PENDING_FARMER_KEY,
        JSON.stringify(latestFarmer)
      );
      await AsyncStorage.setItem("currentUser", JSON.stringify(latestFarmer));
      await AsyncStorage.setItem("userRole", "farmer");
      await AsyncStorage.setItem("currentUserRole", "farmer");
    }
  }

  async function openStripeUrl(url: string) {
    if (!url || !url.startsWith("http")) {
      Alert.alert("Stripe Error", "No valid Stripe onboarding URL returned.");
      return;
    }

    if (Platform.OS === "web") {
      window.location.href = url;
      return;
    }

    await WebBrowser.openBrowserAsync(url);
  }

  async function openPaymentLink(url: string) {
    if (!url || !url.startsWith("http")) {
      Alert.alert("Stripe Error", "Payment link is missing.");
      return;
    }

    if (Platform.OS === "web") {
      window.location.href = url;
      return;
    }

    await WebBrowser.openBrowserAsync(url);
  }

  async function loadFarmer() {
    try {
      const pendingSaved = await AsyncStorage.getItem(PENDING_FARMER_KEY);
      const currentSaved = await AsyncStorage.getItem("currentFarmer");

      let farmer: any = null;

      if (farmerIdFromParams) {
        farmer = await getFarmerById(farmerIdFromParams);
      }

      if (!farmer && currentSaved) {
        const currentFarmer = JSON.parse(currentSaved);
        farmer = (await getFarmerById(currentFarmer.id)) || currentFarmer;
      }

      if (!farmer && pendingSaved) {
        farmer = JSON.parse(pendingSaved);
      }

      if (!farmer) {
        const farmers = await getFarmers();
        farmer = farmers?.[0];
      }

      if (!farmer) {
        const newId = `farmer_${Date.now()}`;

        farmer = {
          id: newId,
          farmerId: newId,
          farmName: "",
          businessName: "",
          ownerName: "",
          email: "",
          state: "MI",
          complianceStatus: "in_progress",
          farmerMembershipPaid: false,
          applicationFeePaid: false,
        };

        await AsyncStorage.setItem("currentFarmer", JSON.stringify(farmer));
        await AsyncStorage.setItem(PENDING_FARMER_KEY, JSON.stringify(farmer));
        await AsyncStorage.setItem("currentUser", JSON.stringify(farmer));
        await AsyncStorage.setItem("userRole", "farmer");
        await AsyncStorage.setItem("currentUserRole", "farmer");
      }

      setFarmerId(farmer.id || farmer.farmerId || "");
      setBusinessName(farmer.farmName || farmer.businessName || "");
      setOwnerName(farmer.ownerName || "");
      setFarmerEmail(farmer.email || "");

      setState(
        String(farmer.state || farmer.location || "MI")
          .slice(0, 2)
          .toUpperCase()
      );

      setUsername(farmer.username || "");
      setPassword(farmer.password || "");
      setConfirmPassword(farmer.password || "");

      setSecurityQuestion1(farmer.securityQuestion1 || "");
      setSecurityAnswer1(farmer.securityAnswer1 || "");
      setSecurityQuestion2(farmer.securityQuestion2 || "");
      setSecurityAnswer2(farmer.securityAnswer2 || "");
      setSecurityQuestion3(farmer.securityQuestion3 || "");
      setSecurityAnswer3(farmer.securityAnswer3 || "");

      setFarmerMembershipPaid(Boolean(farmer.farmerMembershipPaid));
      setApplicationFeePaid(Boolean(farmer.applicationFeePaid));

      setStripeAccountId(
        farmer.stripeAccountId || farmer.farmerStripeAccountId || ""
      );

      setStripePayoutAccount(farmer.stripePayoutAccount || "");
      setStripePayoutsEnabled(Boolean(farmer.stripePayoutsEnabled));
      setStripeChargesEnabled(Boolean(farmer.stripeChargesEnabled));
      setStripeOnboardingComplete(Boolean(farmer.stripeOnboardingComplete));

      if (farmer.pickupDeliveryOption) {
        setPickupDeliveryOption(farmer.pickupDeliveryOption);
      } else if (farmer.pickup === true && farmer.delivery === true) {
        setPickupDeliveryOption("Pickup and Delivery");
      } else if (farmer.pickup === true) {
        setPickupDeliveryOption("Pickup Only");
      } else if (farmer.delivery === true) {
        setPickupDeliveryOption("Delivery Only");
      }

      if (farmer.uploadedDocs) {
        setUploadedDocs(farmer.uploadedDocs);
      }

      if (farmer.legalChecks) {
        setLegalChecks(farmer.legalChecks);
      }

      const existingRecord = await getComplianceRecord(farmer.id);

      if (existingRecord?.documents?.length) {
        const mapped: Record<string, string> = {};

        existingRecord.documents.forEach((doc: any) => {
          mapped[String(doc.type)] = doc.uri;
        });

        setUploadedDocs((prev) => ({
          ...prev,
          ...mapped,
        }));

        const legalAccepted = existingRecord.documents.some(
          (doc: any) =>
            String(doc.type) === "legal_checklist" ||
            String(doc.uri || "").includes("legal-checklist://accepted")
        );

        if (legalAccepted) {
          const checked: Record<number, boolean> = {};

          LEGAL_CHECKLIST.forEach((_, index) => {
            checked[index] = true;
          });

          setLegalChecks(checked);
        }
      }
    } catch (error) {
      console.log("Load farmer compliance error:", error);
      Alert.alert("Error", "Unable to load farmer compliance profile.");
    }
  }

  async function handleStripeReturn(accountId: string) {
    try {
      const pendingSaved = await AsyncStorage.getItem(PENDING_FARMER_KEY);
      const currentSaved = await AsyncStorage.getItem("currentFarmer");

      const pendingFarmer = pendingSaved
        ? JSON.parse(pendingSaved)
        : currentSaved
        ? JSON.parse(currentSaved)
        : null;

      const activeFarmerId =
        pendingFarmer?.id ||
        pendingFarmer?.farmerId ||
        farmerId ||
        farmerIdFromParams ||
        (await getOrCreateFarmerId());

      const nextFarmer = {
        ...(pendingFarmer || {}),
        id: activeFarmerId,
        farmerId: activeFarmerId,
        stripeAccountId: accountId,
        farmerStripeAccountId: accountId,
        stripePayoutAccount: "Stripe Express setup pending",
        complianceStatus: "stripe_pending",
        updatedAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem(PENDING_FARMER_KEY, JSON.stringify(nextFarmer));
      await AsyncStorage.setItem("currentFarmer", JSON.stringify(nextFarmer));
      await AsyncStorage.setItem("currentUser", JSON.stringify(nextFarmer));
      await AsyncStorage.setItem("userRole", "farmer");
      await AsyncStorage.setItem("currentUserRole", "farmer");

      await updateFarmerStore(activeFarmerId, nextFarmer as any);

      setFarmerId(activeFarmerId);
      setBusinessName(nextFarmer.businessName || nextFarmer.farmName || "");
      setOwnerName(nextFarmer.ownerName || "");
      setFarmerEmail(nextFarmer.email || "");
      setState(nextFarmer.state || "MI");
      setUsername(nextFarmer.username || "");
      setPassword(nextFarmer.password || "");
      setConfirmPassword(nextFarmer.password || "");
      setSecurityQuestion1(nextFarmer.securityQuestion1 || "");
      setSecurityAnswer1(nextFarmer.securityAnswer1 || "");
      setSecurityQuestion2(nextFarmer.securityQuestion2 || "");
      setSecurityAnswer2(nextFarmer.securityAnswer2 || "");
      setSecurityQuestion3(nextFarmer.securityQuestion3 || "");
      setSecurityAnswer3(nextFarmer.securityAnswer3 || "");
      setFarmerMembershipPaid(Boolean(nextFarmer.farmerMembershipPaid));
      setApplicationFeePaid(Boolean(nextFarmer.applicationFeePaid));
      setPickupDeliveryOption(
        nextFarmer.pickupDeliveryOption || "Pickup and Delivery"
      );
      setUploadedDocs(nextFarmer.uploadedDocs || {});
      setLegalChecks(nextFarmer.legalChecks || {});
      setStripeAccountId(accountId);
      setStripePayoutAccount("Stripe Express setup pending");

      await createOrUpdateAdminVerificationRecord(
        activeFarmerId,
        "STRIPE_PENDING",
        {
          ...nextFarmer,
          stripeAccountId: accountId,
        }
      );

      router.replace({
        pathname: "/farmer/compliance-upload",
        params: { farmerId: activeFarmerId },
      } as any);
    } catch (error) {
      console.log("Handle Stripe return error:", error);
    }
  }

  async function startFarmerMembershipPayment() {
    const activeFarmerId = await getOrCreateFarmerId();

    const saved = await saveBusinessInfo(true);
    if (!saved) return;

    await savePendingFarmerSnapshot(activeFarmerId);
    await createOrUpdateAdminVerificationRecord(activeFarmerId, "STARTED");

    await openPaymentLink(PAYMENT_LINKS.farmerMembership);
  }

  async function startApplicationFeePayment() {
    const activeFarmerId = await getOrCreateFarmerId();

    const saved = await saveBusinessInfo(true);
    if (!saved) return;

    await savePendingFarmerSnapshot(activeFarmerId);
    await createOrUpdateAdminVerificationRecord(activeFarmerId, "STARTED");

    await openPaymentLink(PAYMENT_LINKS.farmerApplicationProcessFee);
  }

  async function markFarmerFeesComplete() {
    const activeFarmerId = await getOrCreateFarmerId();

    setApplicationFeePaid(true);

    const overrides = {
      applicationFeePaid: true,
      farmerMembershipPaid,
      farmerMonthlySubscriptionPaid: false,
    };

    await updateFarmerStore(activeFarmerId, {
      ...overrides,
      complianceStatus: "application_fee_paid",
    } as any);

    await savePendingFarmerSnapshot(
      activeFarmerId,
      "application_fee_paid",
      overrides
    );
    await syncCurrentFarmer(activeFarmerId);
    await createOrUpdateAdminVerificationRecord(
      activeFarmerId,
      "APPLICATION_FEE_PAID",
      overrides
    );

    Alert.alert(
      "Application Fee Marked Complete",
      "The $29.99 application process fee was marked complete. Continue with Stripe payout setup and the remaining verification checks."
    );
  }

  function validateSecurityQuestions() {
    const selectedQuestions = [
      securityQuestion1,
      securityQuestion2,
      securityQuestion3,
    ].filter(Boolean);

    const uniqueQuestions = new Set(selectedQuestions);

    if (selectedQuestions.length !== 3) {
      Alert.alert(
        "Security Questions Required",
        "Please choose 3 security questions."
      );
      return false;
    }

    if (uniqueQuestions.size !== 3) {
      Alert.alert(
        "Duplicate Questions",
        "Please choose 3 different security questions."
      );
      return false;
    }

    if (
      !securityAnswer1.trim() ||
      !securityAnswer2.trim() ||
      !securityAnswer3.trim()
    ) {
      Alert.alert(
        "Security Answers Required",
        "Please answer all 3 security questions."
      );
      return false;
    }

    return true;
  }

  async function saveBusinessInfo(showErrors = true) {
    try {
      const activeFarmerId = await getOrCreateFarmerId();

      if (!businessName.trim() || !ownerName.trim() || !farmerEmail.trim()) {
        if (showErrors) {
          Alert.alert(
            "Business Info Required",
            "Please enter Farm / Business Name, Owner Name, and Farmer Email first."
          );
        }

        return false;
      }

      if (!farmerEmail.includes("@")) {
        if (showErrors) {
          Alert.alert("Valid Email Required", "Please enter a valid email.");
        }

        return false;
      }

      const overrides = {
        businessName: businessName.trim(),
        ownerName: ownerName.trim(),
        email: farmerEmail.trim(),
        state,
      };

      await updateFarmerStore(activeFarmerId, {
        farmName: overrides.businessName,
        businessName: overrides.businessName,
        ownerName: overrides.ownerName,
        email: overrides.email,
        state,
        complianceStatus: "in_progress",
        approved: false,
        accountActive: false,
      } as any);

      await savePendingFarmerSnapshot(activeFarmerId, "in_progress", overrides);
      await syncCurrentFarmer(activeFarmerId);
      await createOrUpdateAdminVerificationRecord(
        activeFarmerId,
        "PENDING_VERIFICATION",
        overrides
      );

      return true;
    } catch (error: any) {
      console.log("Save business info error:", error);

      if (showErrors) {
        Alert.alert(
          "Save Failed",
          error?.message || "Unable to save business information."
        );
      }

      return false;
    }
  }

  async function saveLoginCredentials(showSuccess = true) {
    try {
      const activeFarmerId = await getOrCreateFarmerId();

      if (!username.trim()) {
        Alert.alert("Username Required", "Please create a username.");
        return false;
      }

      if (!password.trim()) {
        Alert.alert("Password Required", "Please create a password.");
        return false;
      }

      if (password !== confirmPassword) {
        Alert.alert("Password Mismatch", "Passwords do not match.");
        return false;
      }

      if (!validateSecurityQuestions()) return false;

      const overrides = {
        username: username.trim(),
        password: password.trim(),
        email: farmerEmail.trim(),
        securityQuestion1,
        securityAnswer1: securityAnswer1.trim(),
        securityQuestion2,
        securityAnswer2: securityAnswer2.trim(),
        securityQuestion3,
        securityAnswer3: securityAnswer3.trim(),
      };

      await updateFarmerStore(activeFarmerId, overrides as any);

      await savePendingFarmerSnapshot(activeFarmerId, "in_progress", overrides);
      await syncCurrentFarmer(activeFarmerId);
      await createOrUpdateAdminVerificationRecord(
        activeFarmerId,
        "PENDING_VERIFICATION",
        overrides
      );

      if (showSuccess) {
        Alert.alert(
          "Login Saved",
          "Username, password, email, and security questions saved."
        );
      }

      return true;
    } catch (error: any) {
      console.log("Save login credentials error:", error);
      Alert.alert(
        "Save Failed",
        error?.message || "Unable to save login credentials."
      );

      return false;
    }
  }

  async function uploadDocument(type: ComplianceDocumentType, label: string) {
    try {
      const activeFarmerId = await getOrCreateFarmerId();

      const savedBusiness = await saveBusinessInfo(true);
      if (!savedBusiness) return;

      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: "*/*",
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];

      if (!asset?.uri) {
        Alert.alert("Upload Error", "No document was selected.");
        return;
      }

      await addComplianceDocument(activeFarmerId, businessName, ownerName, state, {
        type,
        label,
        uri: asset.uri,
      });

      const nextDocs = {
        ...uploadedDocs,
        [type]: asset.uri,
      };

      setUploadedDocs(nextDocs);

      const overrides = { uploadedDocs: nextDocs };

      await updateFarmerStore(activeFarmerId, {
        uploadedDocs: nextDocs,
        complianceStatus: "documents_in_progress",
      } as any);

      await savePendingFarmerSnapshot(
        activeFarmerId,
        "documents_in_progress",
        overrides
      );

      await createOrUpdateAdminVerificationRecord(
        activeFarmerId,
        "DOCUMENTS_IN_PROGRESS",
        overrides
      );

      Alert.alert("Uploaded", `${label} uploaded successfully.`);
    } catch (error: any) {
      console.log("Upload document error:", error);
      Alert.alert(
        "Upload Failed",
        error?.message || "There was a problem uploading your document."
      );
    }
  }

  async function setupStripePayoutAccount() {
    try {
      const activeFarmerId = await getOrCreateFarmerId();

      const valid = await saveBusinessInfo(true);
      if (!valid) return;

      await savePendingFarmerSnapshot(activeFarmerId);
      await createOrUpdateAdminVerificationRecord(
        activeFarmerId,
        "STRIPE_STARTED"
      );

      setStripeLoading(true);

      if (!API_BASE_URL || !API_BASE_URL.startsWith("http")) {
        Alert.alert("API Error", "Backend API is not configured correctly.");
        return;
      }

      const existingStripeAccountId =
        stripeAccountId && stripeAccountId.startsWith("acct_")
          ? stripeAccountId
          : "";

      const response = await fetch(
        `${API_BASE_URL}/payments/create-farmer-connect-account`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            farmerId: activeFarmerId,
            email: farmerEmail.trim(),
            farmName: businessName.trim(),
            existingStripeAccountId,
          }),
        }
      );

      const text = await response.text();

      let data: any = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Backend returned invalid response: ${text}`);
      }

      const stripeUrl = data.url || data.onboardingUrl;

      if (!response.ok || !data.success || !stripeUrl) {
        throw new Error(
          data.error || data.message || "Stripe onboarding failed."
        );
      }

      const accountId = data.accountId || data.stripeAccountId || "";

      const overrides = {
        stripeAccountId: accountId,
        stripePayoutAccount: "Stripe Express setup pending",
      };

      await updateFarmerStore(activeFarmerId, {
        stripeAccountId: accountId,
        farmerStripeAccountId: accountId,
        stripePayoutAccount: "Stripe Express setup pending",
        email: farmerEmail.trim(),
        complianceStatus: "stripe_pending",
      } as any);

      setStripeAccountId(accountId);
      setStripePayoutAccount("Stripe Express setup pending");

      await savePendingFarmerSnapshot(
        activeFarmerId,
        "stripe_pending",
        overrides
      );

      await syncCurrentFarmer(activeFarmerId);
      await createOrUpdateAdminVerificationRecord(
        activeFarmerId,
        "STRIPE_PENDING",
        overrides
      );

      await openStripeUrl(stripeUrl);
    } catch (error: any) {
      console.log("STRIPE SETUP ERROR:", error);
      Alert.alert(
        "Stripe Setup Error",
        error?.message || "Unable to start Stripe payout setup."
      );
    } finally {
      setStripeLoading(false);
    }
  }

  async function verifyStripePayoutAccount(
    accountIdOverride?: string
  ): Promise<boolean> {
    try {
      const activeFarmerId = await getOrCreateFarmerId();
      const accountId = accountIdOverride || stripeAccountId;

      if (!accountId) {
        Alert.alert("Missing Stripe", "Stripe account ID is missing.");
        return false;
      }

      setStripeChecking(true);

      if (!API_BASE_URL || !API_BASE_URL.startsWith("http")) {
        Alert.alert("API Error", "Backend API is not configured correctly.");
        return false;
      }

      const response = await fetch(
        `${API_BASE_URL}/payments/check-farmer-connect-account`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stripeAccountId: accountId,
            accountId,
          }),
        }
      );

      const text = await response.text();

      let data: any = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Backend returned invalid response: ${text}`);
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Unable to verify Stripe payout account."
        );
      }

      const returnedAccountId =
        data.accountId || data.stripeAccountId || data.account?.id || accountId;

      const payoutsEnabled =
        data.payoutsEnabled === true ||
        data.payouts_enabled === true ||
        data.account?.payouts_enabled === true ||
        data.account?.payoutsEnabled === true;

      const chargesEnabled =
        data.chargesEnabled === true ||
        data.charges_enabled === true ||
        data.account?.charges_enabled === true ||
        data.account?.chargesEnabled === true;

      const onboardingComplete =
        data.onboardingComplete === true ||
        data.detailsSubmitted === true ||
        data.details_submitted === true ||
        data.account?.details_submitted === true ||
        data.account?.detailsSubmitted === true;

      const payoutLabel = payoutsEnabled
        ? "Stripe Express payout account connected"
        : "Stripe Express setup pending";

      const nextDocs = {
        ...uploadedDocs,
        stripe_payout: `stripe://${returnedAccountId}`,
      };

      const overrides = {
        stripeAccountId: returnedAccountId,
        stripePayoutAccount: payoutLabel,
        stripePayoutsEnabled: payoutsEnabled,
        stripeChargesEnabled: chargesEnabled,
        stripeOnboardingComplete: onboardingComplete,
        uploadedDocs: nextDocs,
      };

      await updateFarmerStore(activeFarmerId, {
        stripeAccountId: returnedAccountId,
        farmerStripeAccountId: returnedAccountId,
        stripePayoutAccount: payoutLabel,
        stripeOnboardingComplete: onboardingComplete,
        stripeChargesEnabled: chargesEnabled,
        stripePayoutsEnabled: payoutsEnabled,
        uploadedDocs: nextDocs,
        complianceStatus: payoutsEnabled ? "stripe_complete" : "stripe_pending",
      } as any);

      await addComplianceDocument(activeFarmerId, businessName, ownerName, state, {
        type: "stripe_payout" as any,
        label: "Stripe Payout Account",
        uri: `stripe://${returnedAccountId}`,
        notes: payoutLabel,
      } as any);

      setStripeAccountId(returnedAccountId);
      setStripePayoutAccount(payoutLabel);
      setStripePayoutsEnabled(payoutsEnabled);
      setStripeChargesEnabled(chargesEnabled);
      setStripeOnboardingComplete(onboardingComplete);
      setUploadedDocs(nextDocs);

      await savePendingFarmerSnapshot(
        activeFarmerId,
        payoutsEnabled ? "stripe_complete" : "stripe_pending",
        overrides
      );

      await syncCurrentFarmer(activeFarmerId);
      await createOrUpdateAdminVerificationRecord(
        activeFarmerId,
        payoutsEnabled ? "STRIPE_COMPLETE_PENDING_REVIEW" : "STRIPE_PENDING",
        overrides
      );

      Alert.alert(
        payoutsEnabled ? "Stripe Verified" : "Stripe Pending",
        payoutsEnabled
          ? "Stripe payout is active."
          : "Stripe setup was saved, but payouts are not enabled yet."
      );

      return payoutsEnabled;
    } catch (error: any) {
      console.log("Stripe verify error:", error);
      Alert.alert(
        "Stripe Verification Error",
        error?.message || "Unable to verify Stripe payout account."
      );

      return false;
    } finally {
      setStripeChecking(false);
    }
  }

  async function saveStripeSetup() {
    if (!stripeAccountId.trim()) {
      Alert.alert("Stripe Account Required", "Please complete Stripe setup first.");
      return;
    }

    await verifyStripePayoutAccount(stripeAccountId.trim());
  }

  async function savePickupDeliveryOption(option = pickupDeliveryOption) {
    try {
      const activeFarmerId = await getOrCreateFarmerId();

      const pickup =
        option === "Pickup Only" || option === "Pickup and Delivery";
      const delivery =
        option === "Delivery Only" || option === "Pickup and Delivery";

      const nextDocs = {
        ...uploadedDocs,
        pickup_delivery_agreement: `agreement://${option}`,
      };

      const overrides = {
        pickupDeliveryOption: option,
        uploadedDocs: nextDocs,
      };

      await updateFarmerStore(activeFarmerId, {
        pickup,
        delivery,
        pickupDeliveryOption: option,
        uploadedDocs: nextDocs,
      } as any);

      await addComplianceDocument(activeFarmerId, businessName, ownerName, state, {
        type: "pickup_delivery_agreement" as any,
        label: "Pickup / Delivery Agreement",
        uri: `agreement://${option}`,
        notes: `Farmer selected: ${option}`,
      } as any);

      setUploadedDocs(nextDocs);
      setPickupDeliveryOption(option);

      await savePendingFarmerSnapshot(activeFarmerId, "in_progress", overrides);
      await syncCurrentFarmer(activeFarmerId);
      await createOrUpdateAdminVerificationRecord(
        activeFarmerId,
        "DELIVERY_OPTION_SAVED",
        overrides
      );

      Alert.alert("Option Saved", `${option} was saved.`);
    } catch (error: any) {
      console.log("Save pickup delivery option error:", error);
      Alert.alert(
        "Save Failed",
        error?.message || "Unable to save pickup/delivery option."
      );
    }
  }

  async function saveLegalChecklist(showSuccess = true) {
    try {
      const activeFarmerId = await getOrCreateFarmerId();

      const missingChecks = LEGAL_CHECKLIST.filter(
        (_, index) => !legalChecks[index]
      );

      if (missingChecks.length > 0) {
        Alert.alert(
          "Legal Checklist Required",
          "Please check all legal confirmations before continuing."
        );
        return false;
      }

      await addComplianceDocument(activeFarmerId, businessName, ownerName, state, {
        type: "legal_checklist" as any,
        label: "Legal Checklist / Seller Terms",
        uri: "legal-checklist://accepted",
        notes: LEGAL_CHECKLIST.join(" | "),
      } as any);

      const nextDocs = {
        ...uploadedDocs,
        legal_checklist: "legal-checklist://accepted",
      };

      const overrides = {
        uploadedDocs: nextDocs,
        legalChecks,
      };

      setUploadedDocs(nextDocs);

      await updateFarmerStore(activeFarmerId, {
        uploadedDocs: nextDocs,
        legalChecks,
      } as any);

      await savePendingFarmerSnapshot(activeFarmerId, "in_progress", overrides);
      await createOrUpdateAdminVerificationRecord(
        activeFarmerId,
        "LEGAL_ACCEPTED",
        overrides
      );

      if (showSuccess) {
        Alert.alert("Saved", "Legal checklist saved successfully.");
      }

      return true;
    } catch (error: any) {
      console.log("Save legal checklist error:", error);
      Alert.alert(
        "Save Failed",
        error?.message || "Unable to save legal checklist."
      );

      return false;
    }
  }

  async function runVerification() {
    try {
      const activeFarmerId = await getOrCreateFarmerId();

      setLoading(true);

      const businessSaved = await saveBusinessInfo(true);
      if (!businessSaved) return;

      const credentialsSaved = await saveLoginCredentials(false);
      if (!credentialsSaved) return;

      if (!applicationFeePaid) {
        Alert.alert(
          "Application Fee Required",
          "Please pay or mark the $29.99 application process fee before submitting your compliance review."
        );
        return;
      }

      if (!stripeAccountId) {
        Alert.alert(
          "Stripe Payout Setup Required",
          "Please complete Stripe payout setup before submitting your compliance review."
        );
        return;
      }

      if (!stripePayoutsEnabled) {
        Alert.alert(
          "Stripe Verification Required",
          "Please click Verify after Stripe setup. If Stripe still says pending, finish the Stripe onboarding steps first."
        );
        return;
      }

      if (!uploadedDocs.pickup_delivery_agreement) {
        Alert.alert(
          "Pickup / Delivery Required",
          "Please select and save a pickup/delivery option before submitting."
        );
        return;
      }

      if (missingRequiredDocs.length > 0) {
        Alert.alert(
          "Documents Required",
          `Please upload all required documents before submitting. Missing: ${missingRequiredDocs.join(", ")}`
        );
        return;
      }

      if (!allLegalAccepted) {
        Alert.alert(
          "Legal Checklist Required",
          "Please check and save all legal confirmations before submitting."
        );
        return;
      }

      const legalSaved = await saveLegalChecklist(false);
      if (!legalSaved) return;

      const now = new Date().toISOString();

      const finalUploadedDocs = {
        ...uploadedDocs,
        legal_checklist: "legal-checklist://accepted",
      };

      const reviewPayload = {
        id: activeFarmerId,
        farmerId: activeFarmerId,

        approved: false,
        rejected: false,
        needsMoreInfo: false,
        reviewed: false,
        accountActive: false,
        complianceSubmitted: true,

        status: "PENDING_ADMIN_REVIEW",
        complianceStatus: "pending_admin_review",
        adminReviewStatus: "pending",
        reviewDecision: "pending",

        submittedAt: now,
        createdAt: now,
        updatedAt: now,

        businessName,
        farmName: businessName,
        ownerName,
        email: farmerEmail,
        state,

        username,
        password,
        securityQuestion1,
        securityAnswer1,
        securityQuestion2,
        securityAnswer2,
        securityQuestion3,
        securityAnswer3,

        farmerMembershipPaid,
        applicationFeePaid,

        farmerActivationPaid: false,
        activationFeePaid: false,
        farmerMonthlySubscriptionPaid: false,

        stripeAccountId,
        farmerStripeAccountId: stripeAccountId,
        stripePayoutsEnabled,
        stripeChargesEnabled,
        stripeOnboardingComplete,

        pickupDeliveryOption,
        uploadedDocs: finalUploadedDocs,
        legalChecks,
      };

      await updateFarmerStore(activeFarmerId, reviewPayload as any);

      await AsyncStorage.setItem(
        PENDING_FARMER_KEY,
        JSON.stringify(reviewPayload)
      );

      await AsyncStorage.setItem("currentFarmer", JSON.stringify(reviewPayload));
      await AsyncStorage.setItem("currentUser", JSON.stringify(reviewPayload));
      await AsyncStorage.setItem("userRole", "farmer");
      await AsyncStorage.setItem("currentUserRole", "farmer");

      await createOrUpdateAdminVerificationRecord(
        activeFarmerId,
        "PENDING_ADMIN_REVIEW",
        reviewPayload
      );

      await saveAdminVerificationQueueFallback(
        activeFarmerId,
        "PENDING_ADMIN_REVIEW",
        reviewPayload
      );

      await saveFarmerSubmissionToSupabase(activeFarmerId, reviewPayload);

      Alert.alert(
        "Submitted for Admin Review",
        "Your farmer application has been sent to the Admin Compliance Review queue. Please login to see your awaiting approval status.",
        [
          {
            text: "OK",
            onPress: () =>
              router.replace({
                pathname: "/farmer/login",
                params: {
                  farmerId: activeFarmerId,
                  email: farmerEmail.trim().toLowerCase(),
                  status: "awaiting_approval",
                },
              } as any),
          },
        ]
      );
    } catch (error: any) {
      console.log("Verification error:", error);
      Alert.alert(
        "Verification Error",
        error?.message || "Unable to submit for compliance review."
      );
    } finally {
      setLoading(false);
    }
  }

  function showButtonTest() {
    Alert.alert(
      "Button Test",
      `Buttons are clickable.\n\nFarmer ID: ${
        farmerId || "MISSING"
      }\nBusiness: ${businessName || "MISSING"}\nOwner: ${
        ownerName || "MISSING"
      }\nEmail: ${farmerEmail || "MISSING"}\nAPI: ${API_BASE_URL}`
    );
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
              <Pressable
                key={question}
                style={[
                  styles.questionChip,
                  active && styles.questionChipActive,
                ]}
                onPress={() => setSelectedQuestion(question)}
              >
                <Text
                  style={[
                    styles.questionChipText,
                    active && styles.questionChipTextActive,
                  ]}
                >
                  {question}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <TextInput
          style={styles.input}
          placeholder="Answer"
          value={answer}
          onChangeText={setAnswer}
          secureTextEntry
        />
      </View>
    );
  }

  function renderDocumentRow(doc: {
    type: ComplianceDocumentType;
    label: string;
    required: boolean;
  }) {
    const uploaded = uploadedDocs[doc.type];

    if (doc.type === "stripe_payout") {
      return (
        <View key={doc.type} style={styles.specialBox}>
          <Text style={styles.docLabel}>Stripe Payout Account</Text>

          <Text
            style={[
              styles.docStatus,
              stripePayoutsEnabled ? styles.uploaded : styles.missing,
            ]}
          >
            {stripePayoutsEnabled ? "Connected / Payouts Enabled" : "Required"}
          </Text>

          <TextInput
            style={styles.stripeInput}
            placeholder="Stripe account will appear after setup"
            value={stripeAccountId}
            editable={false}
            autoCapitalize="none"
          />

          <TextInput
            style={styles.stripeInput}
            placeholder="Stripe payout status"
            value={stripePayoutAccount}
            editable={false}
            autoCapitalize="none"
          />

          <Text style={styles.stripeMeta}>
            Onboarding: {stripeOnboardingComplete ? "Complete" : "Pending"} ·
            Charges: {stripeChargesEnabled ? "Enabled" : "Pending"} · Payouts:{" "}
            {stripePayoutsEnabled ? "Enabled" : "Pending"}
          </Text>

          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.stripeButton, stripeLoading && styles.disabled]}
              onPress={setupStripePayoutAccount}
              disabled={stripeLoading || stripeChecking}
            >
              {stripeLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.stripeButtonText}>Setup Stripe Payout</Text>
              )}
            </Pressable>

            <Pressable
              style={[styles.saveButton, stripeChecking && styles.disabled]}
              onPress={saveStripeSetup}
              disabled={stripeLoading || stripeChecking}
            >
              {stripeChecking ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Verify</Text>
              )}
            </Pressable>
          </View>
        </View>
      );
    }

    if (doc.type === "pickup_delivery_agreement") {
      return (
        <View key={doc.type} style={styles.specialBox}>
          <Text style={styles.docLabel}>Pickup / Delivery Option</Text>

          <Text
            style={[
              styles.docStatus,
              uploaded ? styles.uploaded : styles.missing,
            ]}
          >
            {uploaded ? "Selected" : "Required"}
          </Text>

          <View style={styles.optionRow}>
            {PICKUP_DELIVERY_OPTIONS.map((option) => (
              <Pressable
                key={option}
                style={[
                  styles.optionButton,
                  pickupDeliveryOption === option && styles.optionButtonActive,
                ]}
                onPress={() => savePickupDeliveryOption(option)}
              >
                <Text
                  style={[
                    styles.optionButtonText,
                    pickupDeliveryOption === option &&
                      styles.optionButtonTextActive,
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      );
    }

    return (
      <View key={doc.type} style={styles.docRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.docLabel}>
            {doc.label} {doc.required ? "*" : ""}
          </Text>

          <Text
            style={[
              styles.docStatus,
              uploaded ? styles.uploaded : styles.missing,
            ]}
          >
            {uploaded ? "Uploaded" : doc.required ? "Required" : "Optional"}
          </Text>
        </View>

        <Pressable
          style={styles.uploadButton}
          onPress={() => uploadDocument(doc.type, doc.label)}
        >
          <Text style={styles.uploadButtonText}>
            {uploaded ? "Replace" : "Upload"}
          </Text>
        </Pressable>
      </View>
    );
  }

  const readinessItems = [
    { label: "Farmer ID loaded", done: Boolean(farmerId) },
    {
      label: "Business information",
      done: Boolean(businessName && ownerName && farmerEmail),
    },
    {
      label: "Login & security questions",
      done: Boolean(
        username &&
          password &&
          securityQuestion1 &&
          securityQuestion2 &&
          securityQuestion3
      ),
    },
    {
      label: "Monthly membership starts after admin approval",
      done: farmerMembershipPaid,
    },
    {
      label: "Application process fee paid - $29.99",
      done: applicationFeePaid,
    },
    {
      label: "Pickup / delivery selected",
      done: Boolean(uploadedDocs.pickup_delivery_agreement),
    },
    { label: "Legal checklist accepted", done: allLegalAccepted },
    { label: "Stripe payouts enabled", done: stripePayoutsEnabled },
    {
      label: "Required documents uploaded",
      done: missingRequiredDocs.length === 0,
    },
  ];

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
    >
      <Text style={styles.header}>Farmer Compliance Verification</Text>

      <Text style={styles.subheader}>
        Complete verification, pay the $29.99 application process fee, connect
        Stripe payouts, upload required documents, and submit for admin review.
        The $14.99 monthly farmer membership begins after admin approval.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Debug Status</Text>
        <Text style={styles.debugText}>API: {API_BASE_URL}</Text>
        <Text style={styles.debugText}>Farmer ID: {farmerId || "MISSING"}</Text>
        <Text style={styles.debugText}>Business: {businessName || "MISSING"}</Text>
        <Text style={styles.debugText}>Owner: {ownerName || "MISSING"}</Text>
        <Text style={styles.debugText}>Email: {farmerEmail || "MISSING"}</Text>

        <Pressable style={styles.testButton} onPress={showButtonTest}>
          <Text style={styles.testButtonText}>Test Compliance Buttons</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Production Readiness</Text>

        {readinessItems.map((item) => (
          <Text
            key={item.label}
            style={[
              styles.readinessItem,
              item.done ? styles.uploaded : styles.missing,
            ]}
          >
            {item.done ? "✓" : "•"} {item.label}
          </Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Business Information</Text>

        <TextInput
          style={styles.input}
          placeholder="Farm / Business Name"
          value={businessName}
          onChangeText={setBusinessName}
        />

        <TextInput
          style={styles.input}
          placeholder="Owner Name"
          value={ownerName}
          onChangeText={setOwnerName}
        />

        <TextInput
          style={styles.input}
          placeholder="Farmer Email"
          value={farmerEmail}
          onChangeText={setFarmerEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="State"
          value={state}
          onChangeText={(value) => setState(value.toUpperCase().slice(0, 2))}
          maxLength={2}
        />

        <Pressable
          style={styles.saveLoginButton}
          onPress={() => saveBusinessInfo(true)}
        >
          <Text style={styles.saveLoginButtonText}>Save Business Info</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Farmer Fees</Text>

        <Text style={styles.debugText}>
          The $29.99 application process fee is required before submitting your
          compliance review. The $14.99 monthly farmer membership begins after
          admin approval when you are allowed to set up your farmer store.
        </Text>

        <Text
          style={[
            styles.docStatus,
            applicationFeePaid ? styles.uploaded : styles.missing,
            { marginTop: 14 },
          ]}
        >
          Application Process Fee - $29.99:{" "}
          {applicationFeePaid ? "Completed" : "Required"}
        </Text>

        <Pressable
          style={styles.saveButton}
          onPress={startApplicationFeePayment}
        >
          <Text style={styles.saveButtonText}>
            Pay Application Process Fee - $29.99
          </Text>
        </Pressable>

        <Pressable
          style={[styles.testButton, { marginTop: 14 }]}
          onPress={markFarmerFeesComplete}
        >
          <Text style={styles.testButtonText}>
            I Completed Application Fee Payment
          </Text>
        </Pressable>

        <Text
          style={[
            styles.docStatus,
            farmerMembershipPaid ? styles.uploaded : styles.missing,
            { marginTop: 18 },
          ]}
        >
          Monthly Farmer Membership - $14.99:{" "}
          {farmerMembershipPaid ? "Completed" : "Begins After Admin Approval"}
        </Text>

        <Pressable
          style={[styles.stripeButton, styles.disabledSoft]}
          disabled
        >
          <Text style={styles.stripeButtonText}>
            Monthly Membership Opens After Approval
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Create Farmer Login</Text>

        <TextInput
          style={styles.input}
          placeholder="Create username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Create password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

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

        <Pressable
          style={styles.saveLoginButton}
          onPress={() => saveLoginCredentials(true)}
        >
          <Text style={styles.saveLoginButtonText}>
            Save Login & Security Questions
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Required Verification Items</Text>
        {REQUIRED_DOCUMENTS.map((doc) => renderDocumentRow(doc))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Legal Checklist</Text>

        {LEGAL_CHECKLIST.map((item, index) => {
          const checked = Boolean(legalChecks[index]);

          return (
            <Pressable
              key={item}
              style={styles.legalRow}
              onPress={() =>
                setLegalChecks((prev) => ({
                  ...prev,
                  [index]: !prev[index],
                }))
              }
            >
              <View style={[styles.checkbox, checked && styles.checkboxActive]}>
                <Text style={styles.checkboxText}>{checked ? "✓" : ""}</Text>
              </View>

              <Text style={styles.legalText}>{item}</Text>
            </Pressable>
          );
        })}

        <Pressable
          style={[
            styles.saveLegalButton,
            !allLegalAccepted && styles.disabledSoft,
          ]}
          onPress={() => saveLegalChecklist(true)}
        >
          <Text style={styles.saveLegalButtonText}>Save Legal Checklist</Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.verifyButton, loading && styles.disabled]}
        disabled={loading}
        onPress={runVerification}
      >
        <Text style={styles.verifyButtonText}>
          {loading
            ? "Submitting for Admin Review..."
            : "Submit Compliance for Admin Review"}
        </Text>
      </Pressable>

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F7EF" },
  content: { padding: 18, paddingBottom: 40 },
  header: {
    fontSize: 32,
    fontWeight: "900",
    color: "#14532D",
    marginTop: 20,
  },
  subheader: {
    color: "#64745E",
    marginTop: 8,
    lineHeight: 22,
    marginBottom: 18,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#DDE7DB",
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#14532D",
    marginBottom: 14,
  },
  debugText: {
    color: "#111827",
    fontWeight: "800",
    marginBottom: 6,
  },
  readinessItem: {
    fontWeight: "900",
    marginBottom: 8,
    lineHeight: 20,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 16,
    padding: 14,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 12,
  },
  securityBox: { marginTop: 12 },
  securityLabel: {
    color: "#111827",
    fontWeight: "900",
    marginBottom: 8,
  },
  questionChip: {
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 10,
    maxWidth: 260,
  },
  questionChipActive: { backgroundColor: "#047857" },
  questionChipText: { color: "#047857", fontWeight: "900" },
  questionChipTextActive: { color: "#FFFFFF" },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#EEF2E8",
  },
  specialBox: {
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#EEF2E8",
  },
  docLabel: { color: "#111827", fontWeight: "900", fontSize: 15 },
  docStatus: { marginTop: 5, fontWeight: "900" },
  uploaded: { color: "#047857" },
  missing: { color: "#B91C1C" },
  uploadButton: {
    backgroundColor: "#047857",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  uploadButtonText: { color: "#FFFFFF", fontWeight: "900" },
  stripeInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 14,
    padding: 12,
    fontWeight: "800",
    marginTop: 12,
  },
  stripeMeta: {
    color: "#64748B",
    fontWeight: "800",
    marginTop: 10,
    lineHeight: 20,
  },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  stripeButton: {
    flex: 1,
    backgroundColor: "#635BFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },
  stripeButtonText: { color: "#FFFFFF", fontWeight: "900" },
  saveButton: {
    flex: 1,
    backgroundColor: "#047857",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },
  saveButtonText: { color: "#FFFFFF", fontWeight: "900" },
  saveLoginButton: {
    backgroundColor: "#047857",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 14,
  },
  saveLoginButtonText: { color: "#FFFFFF", fontWeight: "900" },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  optionButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#047857",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
  },
  optionButtonActive: { backgroundColor: "#047857" },
  optionButtonText: { color: "#047857", fontWeight: "900" },
  optionButtonTextActive: { color: "#FFFFFF" },
  legalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#EEF2E8",
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#047857",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxActive: { backgroundColor: "#047857" },
  checkboxText: { color: "#FFFFFF", fontWeight: "900" },
  legalText: {
    flex: 1,
    color: "#111827",
    fontWeight: "800",
    lineHeight: 21,
  },
  saveLegalButton: {
    backgroundColor: "#047857",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 14,
  },
  saveLegalButtonText: { color: "#FFFFFF", fontWeight: "900" },
  disabledSoft: { opacity: 0.55 },
  disabled: { opacity: 0.6 },
  verifyButton: {
    backgroundColor: "#14532D",
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: "center",
  },
  verifyButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  testButton: {
    backgroundColor: "#111827",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 12,
  },
  testButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});