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
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import { API_BASE_URL } from "../config/api";
import { PAYMENT_LINKS } from "../config/paymentLinks";

import {
  REQUIRED_DOCUMENTS,
  ComplianceDocumentType,
  addComplianceDocument,
  getComplianceRecord,
} from "../data/complianceStore";

const expoEnv = (globalThis as any)?.process?.env || {};

const supabaseUrl = expoEnv.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = expoEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase: any = createClient(supabaseUrl, supabaseAnonKey);

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

const CURRENT_FARMER_KEY = "currentFarmer";
const PENDING_FARMER_KEY = "pendingFarmerApplication";

type UploadedDocs = Record<string, string>;
type LegalChecks = Record<number, boolean>;

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

  const [securityQuestion1, setSecurityQuestion1] = useState("");
  const [securityAnswer1, setSecurityAnswer1] = useState("");
  const [securityQuestion2, setSecurityQuestion2] = useState("");
  const [securityAnswer2, setSecurityAnswer2] = useState("");
  const [securityQuestion3, setSecurityQuestion3] = useState("");
  const [securityAnswer3, setSecurityAnswer3] = useState("");

  const [farmerMembershipPaid, setFarmerMembershipPaid] = useState(false);
  const [applicationFeePaid, setApplicationFeePaid] = useState(false);
  const [applicationFeeChecking, setApplicationFeeChecking] = useState(false);

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

  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocs>({});
  const [legalChecks, setLegalChecks] = useState<LegalChecks>({});
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

  function normalizeEmail(value: string) {
    return value.trim().toLowerCase();
  }

  function getPickupDeliveryFlags(option: string) {
    return {
      pickup: option === "Pickup Only" || option === "Pickup and Delivery",
      delivery: option === "Delivery Only" || option === "Pickup and Delivery",
    };
  }

  function buildFarmerPayload(
    activeFarmerId = farmerId,
    statusOverride = "in_progress",
    overrides: Record<string, any> = {}
  ) {
    const nextBusinessName =
      overrides.businessName ?? overrides.business_name ?? businessName.trim();

    const nextOwnerName =
      overrides.ownerName ?? overrides.owner_name ?? ownerName.trim();

    const nextEmail = normalizeEmail(
      overrides.email ?? overrides.farmerEmail ?? farmerEmail
    );

    const nextUsername = overrides.username ?? username.trim();

    const nextUploadedDocs = overrides.uploadedDocs ?? uploadedDocs;
    const nextLegalChecks = overrides.legalChecks ?? legalChecks;

    const nextStripeAccountId =
      overrides.stripeAccountId ?? overrides.stripe_account_id ?? stripeAccountId;

    const nextStripePayoutAccount =
      overrides.stripePayoutAccount ??
      overrides.stripe_payout_account ??
      stripePayoutAccount;

    const nextStatus =
      overrides.complianceStatus ??
      overrides.compliance_status ??
      statusOverride;

    const nextPickupDeliveryOption =
      overrides.pickupDeliveryOption ??
      overrides.pickup_delivery_option ??
      pickupDeliveryOption;

    const flags = getPickupDeliveryFlags(nextPickupDeliveryOption);

    const submittedAt =
      overrides.submittedAt ??
      overrides.submitted_at ??
      (nextStatus === "pending_admin_review" ? new Date().toISOString() : null);

    return {
      id: activeFarmerId,

      farm_name: nextBusinessName,
      business_name: nextBusinessName,
      owner_name: nextOwnerName,
      email: nextEmail,
      state: overrides.state ?? state,

      username: nextUsername,

      security_question_1:
        overrides.securityQuestion1 ??
        overrides.security_question_1 ??
        securityQuestion1,
      security_answer_1:
        overrides.securityAnswer1 ??
        overrides.security_answer_1 ??
        securityAnswer1.trim(),
      security_question_2:
        overrides.securityQuestion2 ??
        overrides.security_question_2 ??
        securityQuestion2,
      security_answer_2:
        overrides.securityAnswer2 ??
        overrides.security_answer_2 ??
        securityAnswer2.trim(),
      security_question_3:
        overrides.securityQuestion3 ??
        overrides.security_question_3 ??
        securityQuestion3,
      security_answer_3:
        overrides.securityAnswer3 ??
        overrides.security_answer_3 ??
        securityAnswer3.trim(),

      farmer_membership_paid:
        overrides.farmerMembershipPaid ??
        overrides.farmer_membership_paid ??
        farmerMembershipPaid,
      application_fee_paid:
        overrides.applicationFeePaid ??
        overrides.application_fee_paid ??
        applicationFeePaid,

      monthly_membership_started:
        overrides.monthlyMembershipStarted ??
        overrides.monthly_membership_started ??
        false,
      monthly_membership_required_after_approval: true,

      stripe_account_id: nextStripeAccountId,
      farmer_stripe_account_id: nextStripeAccountId,
      stripe_payout_account: nextStripePayoutAccount,
      stripe_payouts_enabled:
        overrides.stripePayoutsEnabled ??
        overrides.stripe_payouts_enabled ??
        stripePayoutsEnabled,
      stripe_charges_enabled:
        overrides.stripeChargesEnabled ??
        overrides.stripe_charges_enabled ??
        stripeChargesEnabled,
      stripe_onboarding_complete:
        overrides.stripeOnboardingComplete ??
        overrides.stripe_onboarding_complete ??
        stripeOnboardingComplete,

      pickup_delivery_option: nextPickupDeliveryOption,
      pickup: flags.pickup,
      delivery: flags.delivery,

      uploaded_docs: nextUploadedDocs,
      legal_checks: nextLegalChecks,

      approved: overrides.approved ?? false,
      rejected: overrides.rejected ?? false,
      needs_more_info: overrides.needsMoreInfo ?? overrides.needs_more_info ?? false,
      reviewed: overrides.reviewed ?? false,
      account_active: overrides.accountActive ?? overrides.account_active ?? false,
      store_unlocked: overrides.storeUnlocked ?? overrides.store_unlocked ?? false,

      compliance_submitted:
        overrides.complianceSubmitted ??
        overrides.compliance_submitted ??
        nextStatus === "pending_admin_review",
      compliance_status: nextStatus,
      admin_review_status:
        overrides.adminReviewStatus ??
        overrides.admin_review_status ??
        (nextStatus === "pending_admin_review" ? "pending" : "in_progress"),
      review_decision:
        overrides.reviewDecision ??
        overrides.review_decision ??
        (nextStatus === "pending_admin_review" ? "pending" : "in_progress"),

      submitted_at: submittedAt,
      updated_at: new Date().toISOString(),
    };
  }

  function buildLocalFarmerFromPayload(payload: any) {
    return {
      id: payload.id,
      farmName: payload.farm_name,
      businessName: payload.business_name,
      ownerName: payload.owner_name,
      email: payload.email,
      state: payload.state,

      username: payload.username,

      securityQuestion1: payload.security_question_1,
      securityAnswer1: payload.security_answer_1,
      securityQuestion2: payload.security_question_2,
      securityAnswer2: payload.security_answer_2,
      securityQuestion3: payload.security_question_3,
      securityAnswer3: payload.security_answer_3,

      farmerMembershipPaid: payload.farmer_membership_paid,
      applicationFeePaid: payload.application_fee_paid,
      monthlyMembershipStarted: payload.monthly_membership_started,
      monthlyMembershipRequiredAfterApproval:
        payload.monthly_membership_required_after_approval,

      stripeAccountId: payload.stripe_account_id,
      farmerStripeAccountId: payload.farmer_stripe_account_id,
      stripePayoutAccount: payload.stripe_payout_account,
      stripePayoutsEnabled: payload.stripe_payouts_enabled,
      stripeChargesEnabled: payload.stripe_charges_enabled,
      stripeOnboardingComplete: payload.stripe_onboarding_complete,

      pickupDeliveryOption: payload.pickup_delivery_option,
      pickup: payload.pickup,
      delivery: payload.delivery,

      uploadedDocs: payload.uploaded_docs,
      legalChecks: payload.legal_checks,

      approved: payload.approved,
      rejected: payload.rejected,
      needsMoreInfo: payload.needs_more_info,
      reviewed: payload.reviewed,
      accountActive: payload.account_active,
      storeUnlocked: payload.store_unlocked,

      complianceSubmitted: payload.compliance_submitted,
      complianceStatus: payload.compliance_status,
      adminReviewStatus: payload.admin_review_status,
      reviewDecision: payload.review_decision,

      submittedAt: payload.submitted_at,
      updatedAt: payload.updated_at,
    };
  }

  function buildAdminVerificationPayload(
    activeFarmerId: string,
    status = "PENDING_VERIFICATION",
    overrides: Record<string, any> = {}
  ) {
    const docsToUse = overrides.uploadedDocs ?? uploadedDocs;

    const documents = Object.entries(docsToUse || {}).map(([type, uri]) => ({
      id: `${activeFarmerId}_${type}`,
      name: String(type).replace(/_/g, " "),
      type,
      uri,
      uploadedAt: new Date().toISOString(),
      status: "PENDING",
    }));

    const nextBusinessName =
      overrides.businessName ?? overrides.business_name ?? businessName.trim();

    const nextOwnerName =
      overrides.ownerName ?? overrides.owner_name ?? ownerName.trim();

    const nextEmail = normalizeEmail(
      overrides.email ?? overrides.farmerEmail ?? farmerEmail
    );

    const nextStripeAccountId =
      overrides.stripeAccountId ?? overrides.stripe_account_id ?? stripeAccountId;

    return {
      id: activeFarmerId,
      farmer_id: activeFarmerId,
      account_type: "FARMER",

      farm_name: nextBusinessName,
      business_name: nextBusinessName,
      owner_name: nextOwnerName,
      email: nextEmail,
      phone: "",
      state: overrides.state ?? state,

      status,
      compliance_status: status,
      admin_review_status:
        status === "PENDING_ADMIN_REVIEW" ? "pending" : status,
      review_decision: status === "PENDING_ADMIN_REVIEW" ? "pending" : status,

      approved: false,
      rejected: false,
      needs_more_info: false,
      reviewed: false,
      account_active: false,
      store_unlocked: false,

      farmer_membership_paid:
        overrides.farmerMembershipPaid ??
        overrides.farmer_membership_paid ??
        farmerMembershipPaid,
      application_fee_paid:
        overrides.applicationFeePaid ??
        overrides.application_fee_paid ??
        applicationFeePaid,

      monthly_membership_started: false,
      monthly_membership_required_after_approval: true,

      stripe_account_id: nextStripeAccountId,
      farmer_stripe_account_id: nextStripeAccountId,
      stripe_payouts_enabled:
        overrides.stripePayoutsEnabled ??
        overrides.stripe_payouts_enabled ??
        stripePayoutsEnabled,
      stripe_charges_enabled:
        overrides.stripeChargesEnabled ??
        overrides.stripe_charges_enabled ??
        stripeChargesEnabled,
      stripe_onboarding_complete:
        overrides.stripeOnboardingComplete ??
        overrides.stripe_onboarding_complete ??
        stripeOnboardingComplete,

      pickup_delivery_option:
        overrides.pickupDeliveryOption ??
        overrides.pickup_delivery_option ??
        pickupDeliveryOption,

      uploaded_docs: docsToUse,
      legal_checks: overrides.legalChecks ?? legalChecks,
      documents,

      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  async function saveLocalSession(payload: any) {
    const localFarmer = buildLocalFarmerFromPayload(payload);

    await AsyncStorage.setItem(CURRENT_FARMER_KEY, JSON.stringify(localFarmer));
    await AsyncStorage.setItem(PENDING_FARMER_KEY, JSON.stringify(localFarmer));
    await AsyncStorage.setItem("currentUser", JSON.stringify(localFarmer));
    await AsyncStorage.setItem("userRole", "farmer");
    await AsyncStorage.setItem("currentUserRole", "farmer");

    return localFarmer;
  }

  async function upsertFarmerProduction(
    activeFarmerId: string,
    status = "in_progress",
    overrides: Record<string, any> = {}
  ) {
    const payload = buildFarmerPayload(activeFarmerId, status, overrides);

    const { error } = await supabase.from("farmers").upsert(payload, {
      onConflict: "id",
    });

    if (error) throw error;

    await saveLocalSession(payload);

    return payload;
  }

  async function upsertAdminVerificationProduction(
    activeFarmerId: string,
    status = "PENDING_VERIFICATION",
    overrides: Record<string, any> = {}
  ) {
    const payload = buildAdminVerificationPayload(
      activeFarmerId,
      status,
      overrides
    );

    const { error } = await supabase.from("admin_verifications").upsert(payload, {
      onConflict: "id",
    });

    if (error) throw error;

    return payload;
  }

  async function getOrCreateFarmerId() {
    if (farmerId) return farmerId;

    if (farmerIdFromParams) {
      setFarmerId(farmerIdFromParams);
      return farmerIdFromParams;
    }

    const authResponse = await supabase.auth.getUser();
    const authUser = authResponse.data.user;

    if (authUser?.id) {
      setFarmerId(authUser.id);
      return authUser.id;
    }

    const saved =
      (await AsyncStorage.getItem(CURRENT_FARMER_KEY)) ||
      (await AsyncStorage.getItem(PENDING_FARMER_KEY));

    if (saved) {
      try {
        const parsed = JSON.parse(saved);

        if (parsed?.id) {
          setFarmerId(parsed.id);
          return parsed.id;
        }
      } catch {}
    }

    const newId = `farmer_${Date.now()}`;
    setFarmerId(newId);

    return newId;
  }

  async function loadFarmer() {
    try {
      let activeFarmerId = farmerIdFromParams;

      if (!activeFarmerId) {
        const authResponse = await supabase.auth.getUser();
        if (authResponse.data.user?.id) {
          activeFarmerId = authResponse.data.user.id;
        }
      }

      if (!activeFarmerId) {
        const saved =
          (await AsyncStorage.getItem(CURRENT_FARMER_KEY)) ||
          (await AsyncStorage.getItem(PENDING_FARMER_KEY));

        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            activeFarmerId = parsed?.id || "";
          } catch {}
        }
      }

      let farmer: any = null;

      if (activeFarmerId) {
        const { data, error } = await supabase
          .from("farmers")
          .select("*")
          .eq("id", activeFarmerId)
          .maybeSingle();

        if (error) throw error;
        farmer = data;
      }

      if (!farmer) {
        const authResponse = await supabase.auth.getUser();
        const authEmail = authResponse.data.user?.email;

        if (authEmail) {
          const { data, error } = await supabase
            .from("farmers")
            .select("*")
            .eq("email", normalizeEmail(authEmail))
            .maybeSingle();

          if (error) throw error;
          farmer = data;
        }
      }

      if (!farmer) {
        const saved =
          (await AsyncStorage.getItem(CURRENT_FARMER_KEY)) ||
          (await AsyncStorage.getItem(PENDING_FARMER_KEY));

        if (saved) {
          try {
            farmer = JSON.parse(saved);
          } catch {}
        }
      }

      if (!farmer) {
        const newId = await getOrCreateFarmerId();

        farmer = {
          id: newId,
          farm_name: "",
          business_name: "",
          owner_name: "",
          email: "",
          state: "MI",
          compliance_status: "in_progress",
          application_fee_paid: false,
          farmer_membership_paid: false,
        };
      }

      const mapped = {
        id: farmer.id || "",
        farmName: farmer.farm_name || farmer.farmName || farmer.farm_name || "",
        businessName:
          farmer.business_name || farmer.businessName || farmer.farmName || "",
        ownerName: farmer.owner_name || farmer.ownerName || "",
        email: farmer.email || "",
        state: String(farmer.state || farmer.location || "MI")
          .slice(0, 2)
          .toUpperCase(),

        username: farmer.username || "",

        securityQuestion1:
          farmer.security_question_1 || farmer.securityQuestion1 || "",
        securityAnswer1:
          farmer.security_answer_1 || farmer.securityAnswer1 || "",
        securityQuestion2:
          farmer.security_question_2 || farmer.securityQuestion2 || "",
        securityAnswer2:
          farmer.security_answer_2 || farmer.securityAnswer2 || "",
        securityQuestion3:
          farmer.security_question_3 || farmer.securityQuestion3 || "",
        securityAnswer3:
          farmer.security_answer_3 || farmer.securityAnswer3 || "",

        farmerMembershipPaid: Boolean(
          farmer.farmer_membership_paid || farmer.farmerMembershipPaid
        ),
        applicationFeePaid: Boolean(
          farmer.application_fee_paid || farmer.applicationFeePaid
        ),

        stripeAccountId:
          farmer.stripe_account_id ||
          farmer.farmer_stripe_account_id ||
          farmer.stripeAccountId ||
          farmer.farmerStripeAccountId ||
          "",
        stripePayoutAccount:
          farmer.stripe_payout_account || farmer.stripePayoutAccount || "",
        stripePayoutsEnabled: Boolean(
          farmer.stripe_payouts_enabled || farmer.stripePayoutsEnabled
        ),
        stripeChargesEnabled: Boolean(
          farmer.stripe_charges_enabled || farmer.stripeChargesEnabled
        ),
        stripeOnboardingComplete: Boolean(
          farmer.stripe_onboarding_complete || farmer.stripeOnboardingComplete
        ),

        pickupDeliveryOption:
          farmer.pickup_delivery_option ||
          farmer.pickupDeliveryOption ||
          "Pickup and Delivery",

        uploadedDocs: farmer.uploaded_docs || farmer.uploadedDocs || {},
        legalChecks: farmer.legal_checks || farmer.legalChecks || {},
      };

      setFarmerId(mapped.id);
      setBusinessName(mapped.farmName || mapped.businessName || "");
      setOwnerName(mapped.ownerName);
      setFarmerEmail(mapped.email);
      setState(mapped.state);

      setUsername(mapped.username);

      setSecurityQuestion1(mapped.securityQuestion1);
      setSecurityAnswer1(mapped.securityAnswer1);
      setSecurityQuestion2(mapped.securityQuestion2);
      setSecurityAnswer2(mapped.securityAnswer2);
      setSecurityQuestion3(mapped.securityQuestion3);
      setSecurityAnswer3(mapped.securityAnswer3);

      setFarmerMembershipPaid(mapped.farmerMembershipPaid);
      setApplicationFeePaid(mapped.applicationFeePaid);

      setStripeAccountId(mapped.stripeAccountId);
      setStripePayoutAccount(mapped.stripePayoutAccount);
      setStripePayoutsEnabled(mapped.stripePayoutsEnabled);
      setStripeChargesEnabled(mapped.stripeChargesEnabled);
      setStripeOnboardingComplete(mapped.stripeOnboardingComplete);

      setPickupDeliveryOption(mapped.pickupDeliveryOption);
      setUploadedDocs(mapped.uploadedDocs);
      setLegalChecks(mapped.legalChecks);

      if (mapped.id) {
        const existingRecord = await getComplianceRecord(mapped.id);

        if (existingRecord?.documents?.length) {
          const existingDocs: UploadedDocs = {};

          existingRecord.documents.forEach((doc: any) => {
            existingDocs[String(doc.type)] = doc.uri;
          });

          setUploadedDocs((prev) => ({
            ...prev,
            ...existingDocs,
          }));

          const legalAccepted = existingRecord.documents.some(
            (doc: any) =>
              String(doc.type) === "legal_checklist" ||
              String(doc.uri || "").includes("legal-checklist://accepted")
          );

          if (legalAccepted) {
            const checked: LegalChecks = {};

            LEGAL_CHECKLIST.forEach((_, index) => {
              checked[index] = true;
            });

            setLegalChecks(checked);
          }
        }
      }
    } catch (error: any) {
      console.log("Load farmer compliance error:", error);
      Alert.alert(
        "Error",
        error?.message || "Unable to load farmer compliance profile."
      );
    }
  }

  async function openExternalUrl(url: string, errorTitle: string) {
    if (!url || !url.startsWith("http")) {
      Alert.alert(errorTitle, "No valid URL was returned.");
      return;
    }

    if (Platform.OS === "web") {
      window.location.href = url;
      return;
    }

    await WebBrowser.openBrowserAsync(url);
  }

  async function handleStripeReturn(accountId: string) {
    try {
      const activeFarmerId = await getOrCreateFarmerId();

      const overrides = {
        stripeAccountId: accountId,
        stripePayoutAccount: "Stripe Express setup pending",
      };

      await upsertFarmerProduction(activeFarmerId, "stripe_pending", overrides);

      await upsertAdminVerificationProduction(
        activeFarmerId,
        "STRIPE_PENDING",
        overrides
      );

      setStripeAccountId(accountId);
      setStripePayoutAccount("Stripe Express setup pending");

      router.replace({
        pathname: "/farmer/compliance-upload",
        params: { farmerId: activeFarmerId },
      } as any);
    } catch (error) {
      console.log("Handle Stripe return error:", error);
    }
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
        email: normalizeEmail(farmerEmail),
        state,
      };

      await upsertFarmerProduction(activeFarmerId, "in_progress", overrides);

      await upsertAdminVerificationProduction(
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

  async function saveLoginCredentials(showSuccess = true) {
    try {
      const activeFarmerId = await getOrCreateFarmerId();

      if (!username.trim()) {
        Alert.alert("Username Required", "Please create a username.");
        return false;
      }

      if (!validateSecurityQuestions()) return false;

      const overrides = {
        username: username.trim(),
        securityQuestion1,
        securityAnswer1: securityAnswer1.trim(),
        securityQuestion2,
        securityAnswer2: securityAnswer2.trim(),
        securityQuestion3,
        securityAnswer3: securityAnswer3.trim(),
      };

      await upsertFarmerProduction(activeFarmerId, "in_progress", overrides);

      await upsertAdminVerificationProduction(
        activeFarmerId,
        "PENDING_VERIFICATION",
        overrides
      );

      if (showSuccess) {
        Alert.alert(
          "Login Saved",
          "Username and security questions saved to production."
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

  async function startFarmerMembershipPayment() {
    const activeFarmerId = await getOrCreateFarmerId();

    const saved = await saveBusinessInfo(true);
    if (!saved) return;

    await upsertFarmerProduction(activeFarmerId, "membership_started");

    await upsertAdminVerificationProduction(activeFarmerId, "MEMBERSHIP_STARTED");

    await openExternalUrl(PAYMENT_LINKS.farmerMembership, "Stripe Error");
  }

  async function startApplicationFeePayment() {
    const activeFarmerId = await getOrCreateFarmerId();

    const saved = await saveBusinessInfo(true);
    if (!saved) return;

    await upsertFarmerProduction(activeFarmerId, "application_fee_started");

    await upsertAdminVerificationProduction(
      activeFarmerId,
      "APPLICATION_FEE_STARTED"
    );

    await openExternalUrl(
      PAYMENT_LINKS.farmerApplicationProcessFee,
      "Stripe Error"
    );
  }

  async function verifyApplicationFeePayment() {
    try {
      const activeFarmerId = await getOrCreateFarmerId();

      if (!farmerEmail.trim()) {
        Alert.alert("Email Required", "Please enter the farmer email first.");
        return false;
      }

      setApplicationFeeChecking(true);

      const response = await fetch(
        `${API_BASE_URL}/payments/verify-farmer-application-fee`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            farmerId: activeFarmerId,
            email: normalizeEmail(farmerEmail),
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

      if (!response.ok || !data.success || !data.paid) {
        throw new Error(
          data.error ||
            data.message ||
            "Application fee payment was not found yet."
        );
      }

      const overrides = {
        applicationFeePaid: true,
      };

      setApplicationFeePaid(true);

      await upsertFarmerProduction(
        activeFarmerId,
        "application_fee_paid",
        overrides
      );

      await upsertAdminVerificationProduction(
        activeFarmerId,
        "APPLICATION_FEE_PAID",
        overrides
      );

      Alert.alert("Payment Verified", "Application fee payment is confirmed.");

      return true;
    } catch (error: any) {
      console.log("Verify application fee error:", error);

      Alert.alert(
        "Payment Not Verified",
        error?.message ||
          "Unable to verify payment. Make sure your backend Stripe verification route is added."
      );

      return false;
    } finally {
      setApplicationFeeChecking(false);
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

      let documentUri = asset.uri;

      try {
        const fileResponse = await fetch(asset.uri);
        const fileBlob = await fileResponse.blob();

        const safeName = String(asset.name || `${String(type)}_${Date.now()}`)
          .replace(/\s+/g, "_")
          .replace(/[^\w.-]/g, "");

        const storagePath = `${activeFarmerId}/${String(
          type
        )}_${Date.now()}_${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("farmer-compliance-documents")
          .upload(storagePath, fileBlob, {
            contentType: asset.mimeType || "application/octet-stream",
            upsert: true,
          });

        if (!uploadError) {
          const { data: publicData } = supabase.storage
            .from("farmer-compliance-documents")
            .getPublicUrl(storagePath);

          documentUri = publicData.publicUrl || storagePath;
        }
      } catch (storageError) {
        console.log("Supabase storage upload fallback:", storageError);
      }

      await addComplianceDocument(activeFarmerId, businessName, ownerName, state, {
        type,
        label,
        uri: documentUri,
      });

      const nextDocs = {
        ...uploadedDocs,
        [type]: documentUri,
      };

      setUploadedDocs(nextDocs);

      const overrides = {
        uploadedDocs: nextDocs,
      };

      await upsertFarmerProduction(
        activeFarmerId,
        "documents_in_progress",
        overrides
      );

      await upsertAdminVerificationProduction(
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

      await upsertFarmerProduction(activeFarmerId, "stripe_started");

      await upsertAdminVerificationProduction(
        activeFarmerId,
        "STRIPE_STARTED"
      );

      setStripeLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/payments/create-farmer-connect-account`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            farmerId: activeFarmerId,
            email: normalizeEmail(farmerEmail),
            farmName: businessName.trim(),
            existingStripeAccountId: stripeAccountId || "",
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

      setStripeAccountId(accountId);
      setStripePayoutAccount("Stripe Express setup pending");

      await upsertFarmerProduction(activeFarmerId, "stripe_pending", overrides);

      await upsertAdminVerificationProduction(
        activeFarmerId,
        "STRIPE_PENDING",
        overrides
      );

      await openExternalUrl(stripeUrl, "Stripe Setup Error");
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

      await upsertFarmerProduction(
        activeFarmerId,
        payoutsEnabled ? "stripe_complete" : "stripe_pending",
        overrides
      );

      await upsertAdminVerificationProduction(
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

      const nextDocs = {
        ...uploadedDocs,
        pickup_delivery_agreement: `agreement://${option}`,
      };

      const overrides = {
        pickupDeliveryOption: option,
        uploadedDocs: nextDocs,
      };

      await addComplianceDocument(activeFarmerId, businessName, ownerName, state, {
        type: "pickup_delivery_agreement" as any,
        label: "Pickup / Delivery Agreement",
        uri: `agreement://${option}`,
        notes: `Farmer selected: ${option}`,
      } as any);

      setUploadedDocs(nextDocs);
      setPickupDeliveryOption(option);

      await upsertFarmerProduction(activeFarmerId, "in_progress", overrides);

      await upsertAdminVerificationProduction(
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

      await upsertFarmerProduction(activeFarmerId, "in_progress", overrides);

      await upsertAdminVerificationProduction(
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
          "Please pay and verify the $29.99 application process fee before submitting compliance review."
        );
        return;
      }

      if (!uploadedDocs.pickup_delivery_agreement) {
        Alert.alert(
          "Pickup / Delivery Required",
          "Please select Pickup Only, Delivery Only, or Pickup and Delivery."
        );
        return;
      }

      if (!allLegalAccepted) {
        Alert.alert(
          "Legal Checklist Required",
          "Please check all legal confirmations."
        );
        return;
      }

      if (missingRequiredDocs.length > 0) {
        Alert.alert(
          "Documents Required",
          "Please upload all required verification documents."
        );
        return;
      }

      if (!stripeAccountId) {
        Alert.alert(
          "Stripe Required",
          "Please complete Stripe payout setup before submitting."
        );
        return;
      }

      const reviewPayload = {
        applicationFeePaid: true,
        farmerMembershipPaid: false,
        monthlyMembershipStarted: false,
        monthlyMembershipRequiredAfterApproval: true,

        stripeAccountId,
        stripePayoutsEnabled,
        stripeChargesEnabled,
        stripeOnboardingComplete,

        uploadedDocs,
        legalChecks,

        complianceSubmitted: true,
        complianceStatus: "pending_admin_review",
        adminReviewStatus: "pending",
        reviewDecision: "pending",

        approved: false,
        rejected: false,
        needsMoreInfo: false,
        reviewed: false,
        accountActive: false,
        storeUnlocked: false,

        submittedAt: new Date().toISOString(),
      };

      await upsertFarmerProduction(
        activeFarmerId,
        "pending_admin_review",
        reviewPayload
      );

      await upsertAdminVerificationProduction(
        activeFarmerId,
        "PENDING_ADMIN_REVIEW",
        reviewPayload
      );

      router.replace({
        pathname: "/farmer/awaiting-approval",
        params: {
          farmerId: activeFarmerId,
          email: normalizeEmail(farmerEmail),
          businessName: businessName.trim(),
        },
      } as any);
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
          securityQuestion1 &&
          securityQuestion2 &&
          securityQuestion3
      ),
    },
    {
      label: "Monthly membership starts after approval",
      done: true,
    },
    {
      label: "Application fee paid - $29.99",
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
        Upload documents, pay and verify the $29.99 application process fee,
        create login credentials, connect Stripe payouts, select
        pickup/delivery, and accept seller terms. Monthly farmer membership
        begins after admin approval.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Production Status</Text>
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
        <Text style={styles.sectionTitle}>Application Fee</Text>

        <Text style={styles.debugText}>
          The $29.99 application process fee is required before submitting
          compliance review. The $14.99 monthly farmer membership begins only
          after admin approval.
        </Text>

        <Text
          style={[
            styles.docStatus,
            applicationFeePaid ? styles.uploaded : styles.missing,
          ]}
        >
          Application Process Fee - $29.99:{" "}
          {applicationFeePaid ? "Verified" : "Required"}
        </Text>

        <View style={styles.buttonRow}>
          <Pressable
            style={styles.saveButton}
            onPress={startApplicationFeePayment}
          >
            <Text style={styles.saveButtonText}>Pay Application Fee</Text>
          </Pressable>

          <Pressable
            style={[styles.testButton, applicationFeeChecking && styles.disabled]}
            onPress={verifyApplicationFeePayment}
            disabled={applicationFeeChecking}
          >
            {applicationFeeChecking ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.testButtonText}>Verify Payment</Text>
            )}
          </Pressable>
        </View>

        <Text style={[styles.docStatus, styles.missing, { marginTop: 18 }]}>
          Monthly Farmer Membership - $14.99: Starts After Admin Approval
        </Text>
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
            : "Submit Application for Admin Review"}
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
    flex: 1,
    backgroundColor: "#111827",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },
  testButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});