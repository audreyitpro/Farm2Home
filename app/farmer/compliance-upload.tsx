// app/farmer/compliance-upload.tsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import { API_BASE_URL } from "../config/api";
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
const FARMER_DRAFT_KEY = "farmerComplianceDraft";

type UploadedDocs = Record<string, string>;
type LegalChecks = Record<number, boolean>;

function normalizeAnswer(value: string) {
  return String(value || "").trim().toLowerCase();
}

function normalizeEmail(value: string) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value: string) {
  return normalizeEmail(value).includes("@");
}

function buildDocRows(activeFarmerId: string, uploadedDocs: UploadedDocs) {
  const now = new Date().toISOString();

  return Object.entries(uploadedDocs || {}).map(([type, uri]) => ({
    id: `${activeFarmerId}_${type}`,
    farmer_id: activeFarmerId,
    verification_id: activeFarmerId,
    document_type: type,
    document_name: String(type).replace(/_/g, " "),
    document_uri: String(uri),
    status: "PENDING",
    uploaded_at: now,
    created_at: now,
    updated_at: now,
  }));
}

export default function FarmerComplianceUploadScreen() {
  const params = useLocalSearchParams();

  const farmerIdFromParams = params.farmerId ? String(params.farmerId) : "";
  const stripeReturn = String(params.stripeReturn || "") === "true";
  const returnedStripeAccountId = params.accountId ? String(params.accountId) : "";

  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
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
      }).map((doc) => String(doc.type)),
    []
  );

  const missingRequiredDocs = useMemo(
    () => requiredDocTypes.filter((type) => !uploadedDocs[type]),
    [requiredDocTypes, uploadedDocs]
  );

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

  useEffect(() => {
    if (!initialLoadComplete) return;

    const timeout = setTimeout(() => {
      saveLocalDraft();
    }, 350);

    return () => clearTimeout(timeout);
  }, [
    initialLoadComplete,
    farmerId,
    businessName,
    ownerName,
    farmerEmail,
    state,
    username,
    password,
    confirmPassword,
    securityQuestion1,
    securityAnswer1,
    securityQuestion2,
    securityAnswer2,
    securityQuestion3,
    securityAnswer3,
    farmerMembershipPaid,
    applicationFeePaid,
    stripeAccountId,
    stripePayoutAccount,
    stripePayoutsEnabled,
    stripeChargesEnabled,
    stripeOnboardingComplete,
    pickupDeliveryOption,
    uploadedDocs,
    legalChecks,
  ]);

  function buildSnapshot(
    activeFarmerId = farmerId,
    status = "in_progress",
    overrides: Record<string, any> = {}
  ) {
    const finalBusinessName = overrides.businessName ?? businessName;
    const finalOwnerName = overrides.ownerName ?? ownerName;
    const finalEmail = overrides.email ?? farmerEmail;
    const finalState = overrides.state ?? state;
    const finalUsername = overrides.username ?? username;
    const finalPassword = overrides.password ?? password;
    const finalUploadedDocs = overrides.uploadedDocs ?? uploadedDocs;
    const finalLegalChecks = overrides.legalChecks ?? legalChecks;
    const finalStripeAccountId = overrides.stripeAccountId ?? stripeAccountId;
    const finalPickupDeliveryOption =
      overrides.pickupDeliveryOption ?? pickupDeliveryOption;

    return {
      id: activeFarmerId,
      farmerId: activeFarmerId,
      businessName: finalBusinessName,
      farmName: finalBusinessName,
      ownerName: finalOwnerName,
      email: finalEmail,
      state: finalState,
      username: finalUsername,
      password: finalPassword,
      confirmPassword: finalPassword,
      securityQuestion1: overrides.securityQuestion1 ?? securityQuestion1,
      securityAnswer1: overrides.securityAnswer1 ?? securityAnswer1,
      securityQuestion2: overrides.securityQuestion2 ?? securityQuestion2,
      securityAnswer2: overrides.securityAnswer2 ?? securityAnswer2,
      securityQuestion3: overrides.securityQuestion3 ?? securityQuestion3,
      securityAnswer3: overrides.securityAnswer3 ?? securityAnswer3,
      farmerMembershipPaid:
        overrides.farmerMembershipPaid ?? farmerMembershipPaid,
      applicationFeePaid: overrides.applicationFeePaid ?? applicationFeePaid,
      stripeAccountId: finalStripeAccountId,
      farmerStripeAccountId: finalStripeAccountId,
      stripePayoutAccount: overrides.stripePayoutAccount ?? stripePayoutAccount,
      stripePayoutsEnabled:
        overrides.stripePayoutsEnabled ?? stripePayoutsEnabled,
      stripeChargesEnabled:
        overrides.stripeChargesEnabled ?? stripeChargesEnabled,
      stripeOnboardingComplete:
        overrides.stripeOnboardingComplete ?? stripeOnboardingComplete,
      pickupDeliveryOption: finalPickupDeliveryOption,
      uploadedDocs: finalUploadedDocs,
      legalChecks: finalLegalChecks,
      approved: overrides.approved ?? false,
      rejected: overrides.rejected ?? false,
      needsMoreInfo: overrides.needsMoreInfo ?? false,
      reviewed: overrides.reviewed ?? false,
      accountActive: overrides.accountActive ?? false,
      complianceSubmitted:
        overrides.complianceSubmitted ?? status === "pending_admin_review",
      status:
        status === "pending_admin_review"
          ? "PENDING_ADMIN_REVIEW"
          : status,
      complianceStatus: status,
      adminReviewStatus:
        status === "pending_admin_review" ? "pending" : undefined,
      reviewDecision:
        status === "pending_admin_review" ? "pending" : undefined,
      submittedAt: overrides.submittedAt,
      updatedAt: new Date().toISOString(),
    };
  }

  async function saveLocalDraft(
    activeFarmerId = farmerId,
    status = "in_progress",
    overrides: Record<string, any> = {}
  ) {
    try {
      const snapshot = buildSnapshot(activeFarmerId, status, overrides);

      await AsyncStorage.multiSet([
        [FARMER_DRAFT_KEY, JSON.stringify(snapshot)],
        [PENDING_FARMER_KEY, JSON.stringify(snapshot)],
        ["currentFarmer", JSON.stringify(snapshot)],
        ["currentUser", JSON.stringify(snapshot)],
        ["userRole", "farmer"],
        ["currentUserRole", "farmer"],
      ]);

      return snapshot;
    } catch (error) {
      console.log("SAVE FARMER LOCAL DRAFT ERROR:", error);
      return null;
    }
  }

  function mapSupabaseFarmerToLocal(row: any) {
    return {
      id: row.id,
      farmerId: row.id,
      businessName: row.business_name || row.farm_name || "",
      farmName: row.farm_name || row.business_name || "",
      ownerName: row.owner_name || "",
      email: row.email || "",
      state: row.state || "MI",
      username: row.username || "",
      password: row.password || "",
      confirmPassword: row.password || "",
      securityQuestion1: row.security_question_1 || "",
      securityAnswer1: row.security_answer_1 || "",
      securityQuestion2: row.security_question_2 || "",
      securityAnswer2: row.security_answer_2 || "",
      securityQuestion3: row.security_question_3 || "",
      securityAnswer3: row.security_answer_3 || "",
      farmerMembershipPaid: Boolean(row.farmer_membership_paid),
      applicationFeePaid: Boolean(row.application_fee_paid),
      stripeAccountId: row.stripe_account_id || row.farmer_stripe_account_id || "",
      farmerStripeAccountId:
        row.farmer_stripe_account_id || row.stripe_account_id || "",
      stripePayoutAccount: row.stripe_payout_account || "",
      stripePayoutsEnabled: Boolean(row.stripe_payouts_enabled),
      stripeChargesEnabled: Boolean(row.stripe_charges_enabled),
      stripeOnboardingComplete: Boolean(row.stripe_onboarding_complete),
      pickupDeliveryOption: row.pickup_delivery_option || "Pickup and Delivery",
      uploadedDocs: row.uploaded_docs || {},
      legalChecks: row.legal_checks || {},
      complianceStatus: row.compliance_status || "in_progress",
      approved: Boolean(row.approved),
      accountActive: Boolean(row.account_active),
      updatedAt: row.updated_at,
    };
  }

  function applyFarmerToState(farmer: any) {
    if (!farmer) return;

    setFarmerId(farmer.id || farmer.farmerId || "");
    setBusinessName(farmer.businessName || farmer.farmName || "");
    setOwnerName(farmer.ownerName || "");
    setFarmerEmail(farmer.email || "");

    setState(
      String(farmer.state || farmer.location || "MI")
        .slice(0, 2)
        .toUpperCase()
    );

    setUsername(farmer.username || "");
    setPassword(farmer.password || "");
    setConfirmPassword(farmer.confirmPassword || farmer.password || "");

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

    if (farmer.uploadedDocs) setUploadedDocs(farmer.uploadedDocs);
    if (farmer.legalChecks) setLegalChecks(farmer.legalChecks);
  }

  async function loadFarmer() {
    try {
      const draftSaved = await AsyncStorage.getItem(FARMER_DRAFT_KEY);
      const pendingSaved = await AsyncStorage.getItem(PENDING_FARMER_KEY);
      const currentSaved = await AsyncStorage.getItem("currentFarmer");

      let farmer: any = null;

      if (farmerIdFromParams) {
        farmer = await getFarmerById(farmerIdFromParams);

        if (!farmer) {
          const { data } = await supabase
            .from("farmers")
            .select("*")
            .eq("id", farmerIdFromParams)
            .maybeSingle();

          if (data) farmer = mapSupabaseFarmerToLocal(data);
        }
      }

      if (!farmer && draftSaved) farmer = JSON.parse(draftSaved);
      if (!farmer && pendingSaved) farmer = JSON.parse(pendingSaved);

      if (!farmer && currentSaved) {
        const currentFarmer = JSON.parse(currentSaved);
        farmer = (await getFarmerById(currentFarmer.id)) || currentFarmer;
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
          businessName: "",
          farmName: "",
          ownerName: "",
          email: "",
          state: "MI",
          complianceStatus: "in_progress",
          farmerMembershipPaid: false,
          applicationFeePaid: false,
          uploadedDocs: {},
          legalChecks: {},
        };

        await saveLocalDraft(newId, "in_progress", farmer);
      }

      applyFarmerToState(farmer);

      const activeFarmerId = farmer.id || farmer.farmerId;

      if (activeFarmerId) {
        const existingRecord = await getComplianceRecord(activeFarmerId);

        if (existingRecord?.documents?.length) {
          const mapped: UploadedDocs = {};

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
            const checked: LegalChecks = {};
            LEGAL_CHECKLIST.forEach((_, index) => {
              checked[index] = true;
            });
            setLegalChecks(checked);
          }
        }
      }
    } catch (error) {
      console.log("Load farmer compliance error:", error);
      Alert.alert("Error", "Unable to load farmer compliance profile.");
    } finally {
      setInitialLoadComplete(true);
    }
  }

  async function getOrCreateFarmerId() {
    if (farmerId) return farmerId;

    const saved =
      (await AsyncStorage.getItem(FARMER_DRAFT_KEY)) ||
      (await AsyncStorage.getItem("currentFarmer")) ||
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

    await saveLocalDraft(newId);

    return newId;
  }

  async function saveFarmerProfileToSupabase(
    activeFarmerId: string,
    overrides: Record<string, any> = {}
  ) {
    const payload = {
      id: activeFarmerId,
      username: String(overrides.username ?? username ?? "").trim().toLowerCase(),
      password: String(overrides.password ?? password ?? "").trim(),
      email: normalizeEmail(overrides.email ?? farmerEmail),
      business_name: overrides.businessName ?? businessName,
      farm_name: overrides.businessName ?? businessName,
      owner_name: overrides.ownerName ?? ownerName,
      state: overrides.state ?? state,
      compliance_status: overrides.complianceStatus ?? "in_progress",
      approved: Boolean(overrides.approved ?? false),
      account_active: Boolean(overrides.accountActive ?? false),
      farmer_membership_paid: Boolean(
        overrides.farmerMembershipPaid ?? farmerMembershipPaid
      ),
      application_fee_paid: Boolean(
        overrides.applicationFeePaid ?? applicationFeePaid
      ),
      security_question_1: overrides.securityQuestion1 ?? securityQuestion1,
      security_answer_1: normalizeAnswer(
        overrides.securityAnswer1 ?? securityAnswer1
      ),
      security_question_2: overrides.securityQuestion2 ?? securityQuestion2,
      security_answer_2: normalizeAnswer(
        overrides.securityAnswer2 ?? securityAnswer2
      ),
      security_question_3: overrides.securityQuestion3 ?? securityQuestion3,
      security_answer_3: normalizeAnswer(
        overrides.securityAnswer3 ?? securityAnswer3
      ),
      stripe_account_id: overrides.stripeAccountId ?? stripeAccountId,
      farmer_stripe_account_id:
        overrides.farmerStripeAccountId ??
        overrides.stripeAccountId ??
        stripeAccountId,
      stripe_payout_account:
        overrides.stripePayoutAccount ?? stripePayoutAccount,
      stripe_payouts_enabled: Boolean(
        overrides.stripePayoutsEnabled ?? stripePayoutsEnabled
      ),
      stripe_charges_enabled: Boolean(
        overrides.stripeChargesEnabled ?? stripeChargesEnabled
      ),
      stripe_onboarding_complete: Boolean(
        overrides.stripeOnboardingComplete ?? stripeOnboardingComplete
      ),
      pickup_delivery_option:
        overrides.pickupDeliveryOption ?? pickupDeliveryOption,
      uploaded_docs: overrides.uploadedDocs ?? uploadedDocs,
      legal_checks: overrides.legalChecks ?? legalChecks,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("farmers").upsert(payload);

    if (error) {
      console.log("FARMER SUPABASE SAVE ERROR:", error.message);
      throw new Error(error.message);
    }
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

    try {
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
        businessName:
          overrides.businessName || businessName || "Farm2Home Farm",
        ownerName: overrides.ownerName || ownerName || "",
        email: overrides.email || farmerEmail || "",
        phone: "",
        state: overrides.state || state,
        status,
        complianceStatus:
          status === "PENDING_ADMIN_REVIEW" ? "pending_admin_review" : status,
        adminReviewStatus:
          status === "PENDING_ADMIN_REVIEW" ? "pending" : status,
        reviewDecision:
          status === "PENDING_ADMIN_REVIEW" ? "pending" : undefined,
        approved: false,
        rejected: false,
        needsMoreInfo: false,
        reviewed: false,
        accountActive: false,
        complianceSubmitted: status === "PENDING_ADMIN_REVIEW",
        farmerMembershipPaid:
          overrides.farmerMembershipPaid ?? farmerMembershipPaid,
        applicationFeePaid: overrides.applicationFeePaid ?? applicationFeePaid,
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
    } catch (error) {
      console.log("LOCAL ADMIN VERIFICATION SAVE SKIPPED:", error);
    }
  }

  async function saveAdminVerificationToSupabase(
    activeFarmerId: string,
    reviewPayload: Record<string, any>
  ) {
    const now = new Date().toISOString();
    const docsToUse = reviewPayload.uploadedDocs || uploadedDocs || {};

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
      stripe_account_id: reviewPayload.stripeAccountId || "",
      farmer_stripe_account_id: reviewPayload.farmerStripeAccountId || "",
      stripe_payouts_enabled: Boolean(reviewPayload.stripePayoutsEnabled),
      stripe_charges_enabled: Boolean(reviewPayload.stripeChargesEnabled),
      stripe_onboarding_complete: Boolean(reviewPayload.stripeOnboardingComplete),
      pickup_delivery_option: reviewPayload.pickupDeliveryOption || "",
      uploaded_docs: docsToUse,
      legal_checks: reviewPayload.legalChecks || {},
      submitted_at: now,
      created_at: now,
      updated_at: now,
    };

    const { error } = await supabase
      .from("admin_verifications")
      .upsert(adminRecord);

    if (error) throw new Error(error.message);

    const documentRows = buildDocRows(activeFarmerId, docsToUse);

    if (documentRows.length > 0) {
      const { error: docsError } = await supabase
        .from("admin_verification_documents")
        .upsert(documentRows);

      if (docsError) {
        console.log("ADMIN DOCUMENT ROW SAVE SKIPPED:", docsError.message);
      }
    }
  }

  async function saveBusinessInfo(showSuccess = true) {
    try {
      const activeFarmerId = await getOrCreateFarmerId();

      if (!businessName.trim() || !ownerName.trim() || !farmerEmail.trim()) {
        Alert.alert(
          "Business Info Required",
          "Please enter Farm / Business Name, Owner Name, and Farmer Email first."
        );
        return false;
      }

      if (!isValidEmail(farmerEmail)) {
        Alert.alert("Valid Email Required", "Please enter a valid email.");
        return false;
      }

      const overrides = {
        businessName: businessName.trim(),
        ownerName: ownerName.trim(),
        email: normalizeEmail(farmerEmail),
        state,
        complianceStatus: "in_progress",
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

      await saveFarmerProfileToSupabase(activeFarmerId, overrides);
      await saveLocalDraft(activeFarmerId, "in_progress", overrides);
      await createOrUpdateAdminVerificationRecord(
        activeFarmerId,
        "PENDING_VERIFICATION",
        overrides
      );

      if (showSuccess) {
        Alert.alert("Saved", "Business information saved.");
      }

      return true;
    } catch (error: any) {
      console.log("SAVE BUSINESS INFO ERROR:", error);
      Alert.alert(
        "Save Failed",
        error?.message || "Unable to save business information."
      );
      return false;
    }
  }

  function validateSecurityQuestions() {
    const selectedQuestions = [
      securityQuestion1,
      securityQuestion2,
      securityQuestion3,
    ].filter(Boolean);

    if (selectedQuestions.length !== 3) {
      Alert.alert(
        "Security Questions Required",
        "Please choose 3 security questions."
      );
      return false;
    }

    if (new Set(selectedQuestions).size !== 3) {
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

      if (!password.trim()) {
        Alert.alert("Password Required", "Please create a password.");
        return false;
      }

      if (password.trim().length < 6) {
        Alert.alert("Weak Password", "Password must be at least 6 characters.");
        return false;
      }

      if (password.trim() !== confirmPassword.trim()) {
        Alert.alert("Password Mismatch", "Passwords do not match.");
        return false;
      }

      if (!validateSecurityQuestions()) return false;

      const overrides = {
        username: username.trim().toLowerCase(),
        password: password.trim(),
        email: normalizeEmail(farmerEmail),
        securityQuestion1,
        securityAnswer1: normalizeAnswer(securityAnswer1),
        securityQuestion2,
        securityAnswer2: normalizeAnswer(securityAnswer2),
        securityQuestion3,
        securityAnswer3: normalizeAnswer(securityAnswer3),
      };

      await updateFarmerStore(activeFarmerId, overrides as any);
      await saveFarmerProfileToSupabase(activeFarmerId, overrides);
      await saveLocalDraft(activeFarmerId, "in_progress", overrides);
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
      console.log("SAVE LOGIN CREDENTIALS ERROR:", error);
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

      const savedBusiness = await saveBusinessInfo(false);
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
        [String(type)]: asset.uri,
      };

      const overrides = { uploadedDocs: nextDocs };

      setUploadedDocs(nextDocs);

      await updateFarmerStore(activeFarmerId, {
        uploadedDocs: nextDocs,
        complianceStatus: "documents_in_progress",
      } as any);

      await saveFarmerProfileToSupabase(activeFarmerId, {
        ...overrides,
        complianceStatus: "documents_in_progress",
      });

      await saveLocalDraft(activeFarmerId, "documents_in_progress", overrides);
      await createOrUpdateAdminVerificationRecord(
        activeFarmerId,
        "DOCUMENTS_IN_PROGRESS",
        overrides
      );

      Alert.alert("Uploaded", `${label} uploaded successfully.`);
    } catch (error: any) {
      console.log("UPLOAD DOCUMENT ERROR:", error);
      Alert.alert(
        "Upload Failed",
        error?.message || "There was a problem uploading your document."
      );
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

  async function setupStripePayoutAccount() {
    try {
      const activeFarmerId = await getOrCreateFarmerId();

      const valid = await saveBusinessInfo(false);
      if (!valid) return;

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
            businessName: businessName.trim(),
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
      const accountId = data.accountId || data.stripeAccountId || stripeAccountId;

      if (!response.ok || !data.success || !stripeUrl) {
        throw new Error(
          data.error || data.message || "Stripe onboarding failed."
        );
      }

      const overrides = {
        stripeAccountId: accountId,
        farmerStripeAccountId: accountId,
        stripePayoutAccount: "Stripe Express setup pending",
      };

      setStripeAccountId(accountId);
      setStripePayoutAccount("Stripe Express setup pending");

      await updateFarmerStore(activeFarmerId, {
        ...overrides,
        email: normalizeEmail(farmerEmail),
        complianceStatus: "stripe_pending",
      } as any);

      await saveFarmerProfileToSupabase(activeFarmerId, {
        ...overrides,
        complianceStatus: "stripe_pending",
      });

      await saveLocalDraft(activeFarmerId, "stripe_pending", overrides);
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

  async function handleStripeReturn(accountId: string) {
    try {
      const activeFarmerId = await getOrCreateFarmerId();

      const overrides = {
        stripeAccountId: accountId,
        farmerStripeAccountId: accountId,
        stripePayoutAccount: "Stripe Express setup pending",
      };

      setStripeAccountId(accountId);
      setStripePayoutAccount("Stripe Express setup pending");

      await updateFarmerStore(activeFarmerId, {
        ...overrides,
        complianceStatus: "stripe_pending",
      } as any);

      await saveFarmerProfileToSupabase(activeFarmerId, {
        ...overrides,
        complianceStatus: "stripe_pending",
      });

      await saveLocalDraft(activeFarmerId, "stripe_pending", overrides);

      router.replace({
        pathname: "/farmer/compliance-upload",
        params: { farmerId: activeFarmerId },
      } as any);
    } catch (error) {
      console.log("HANDLE STRIPE RETURN ERROR:", error);
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
            farmerId: activeFarmerId,
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
        data.account?.payouts_enabled === true;

      const chargesEnabled =
        data.chargesEnabled === true ||
        data.charges_enabled === true ||
        data.account?.charges_enabled === true;

      const onboardingComplete =
        data.onboardingComplete === true ||
        data.detailsSubmitted === true ||
        data.details_submitted === true ||
        data.account?.details_submitted === true;

      const payoutLabel = payoutsEnabled
        ? "Stripe Express payout account connected"
        : "Stripe Express setup pending";

      const nextDocs = {
        ...uploadedDocs,
        stripe_payout: `stripe://${returnedAccountId}`,
      };

      const overrides = {
        stripeAccountId: returnedAccountId,
        farmerStripeAccountId: returnedAccountId,
        stripePayoutAccount: payoutLabel,
        stripePayoutsEnabled: payoutsEnabled,
        stripeChargesEnabled: chargesEnabled,
        stripeOnboardingComplete: onboardingComplete,
        uploadedDocs: nextDocs,
      };

      setStripeAccountId(returnedAccountId);
      setStripePayoutAccount(payoutLabel);
      setStripePayoutsEnabled(payoutsEnabled);
      setStripeChargesEnabled(chargesEnabled);
      setStripeOnboardingComplete(onboardingComplete);
      setUploadedDocs(nextDocs);

      await addComplianceDocument(activeFarmerId, businessName, ownerName, state, {
        type: "stripe_payout" as any,
        label: "Stripe Payout Account",
        uri: `stripe://${returnedAccountId}`,
        notes: payoutLabel,
      } as any);

      await updateFarmerStore(activeFarmerId, {
        ...overrides,
        complianceStatus: payoutsEnabled ? "stripe_complete" : "stripe_pending",
      } as any);

      await saveFarmerProfileToSupabase(activeFarmerId, {
        ...overrides,
        complianceStatus: payoutsEnabled ? "stripe_complete" : "stripe_pending",
      });

      await saveLocalDraft(
        activeFarmerId,
        payoutsEnabled ? "stripe_complete" : "stripe_pending",
        overrides
      );

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
      console.log("STRIPE VERIFY ERROR:", error);
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

      setUploadedDocs(nextDocs);
      setPickupDeliveryOption(option);

      await addComplianceDocument(activeFarmerId, businessName, ownerName, state, {
        type: "pickup_delivery_agreement" as any,
        label: "Pickup / Delivery Agreement",
        uri: `agreement://${option}`,
        notes: `Farmer selected: ${option}`,
      } as any);

      await updateFarmerStore(activeFarmerId, {
        pickup,
        delivery,
        pickupDeliveryOption: option,
        uploadedDocs: nextDocs,
      } as any);

      await saveFarmerProfileToSupabase(activeFarmerId, overrides);
      await saveLocalDraft(activeFarmerId, "in_progress", overrides);
      await createOrUpdateAdminVerificationRecord(
        activeFarmerId,
        "DELIVERY_OPTION_SAVED",
        overrides
      );

      Alert.alert("Option Saved", `${option} was saved.`);
    } catch (error: any) {
      console.log("SAVE PICKUP DELIVERY OPTION ERROR:", error);
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

      await saveFarmerProfileToSupabase(activeFarmerId, overrides);
      await saveLocalDraft(activeFarmerId, "in_progress", overrides);
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
      console.log("SAVE LEGAL CHECKLIST ERROR:", error);
      Alert.alert(
        "Save Failed",
        error?.message || "Unable to save legal checklist."
      );
      return false;
    }
  }

  async function markFarmerFeesComplete() {
    const activeFarmerId = await getOrCreateFarmerId();

    setFarmerMembershipPaid(true);
    setApplicationFeePaid(true);

    const overrides = {
      farmerMembershipPaid: true,
      applicationFeePaid: true,
    };

    await updateFarmerStore(activeFarmerId, {
      ...overrides,
      complianceStatus: "fees_paid",
    } as any);

    await saveFarmerProfileToSupabase(activeFarmerId, {
      ...overrides,
      complianceStatus: "fees_paid",
    });

    await saveLocalDraft(activeFarmerId, "fees_paid", overrides);

    Alert.alert(
      "Fees Saved",
      "Farmer fee status was saved. Fees will not block document upload or Stripe setup."
    );
  }

  async function runVerification() {
    if (loading) return;

    try {
      setLoading(true);

      const activeFarmerId = await getOrCreateFarmerId();

      const businessSaved = await saveBusinessInfo(false);
      if (!businessSaved) return;

      const credentialsSaved = await saveLoginCredentials(false);
      if (!credentialsSaved) return;

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
          `Please upload all required documents.\nMissing: ${missingRequiredDocs.join(
            ", "
          )}`
        );
        return;
      }

      if (!stripeAccountId) {
        Alert.alert("Stripe Required", "Please complete Stripe setup first.");
        return;
      }

      if (!uploadedDocs.pickup_delivery_agreement) {
        Alert.alert(
          "Pickup / Delivery Required",
          "Please select and save a pickup/delivery option."
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
        businessName: businessName.trim(),
        farmName: businessName.trim(),
        ownerName: ownerName.trim(),
        email: normalizeEmail(farmerEmail),
        state,
        username: username.trim().toLowerCase(),
        password: password.trim(),
        confirmPassword: password.trim(),
        securityQuestion1,
        securityAnswer1: normalizeAnswer(securityAnswer1),
        securityQuestion2,
        securityAnswer2: normalizeAnswer(securityAnswer2),
        securityQuestion3,
        securityAnswer3: normalizeAnswer(securityAnswer3),
        farmerMembershipPaid,
        applicationFeePaid,
        stripeAccountId,
        farmerStripeAccountId: stripeAccountId,
        stripePayoutAccount,
        stripePayoutsEnabled,
        stripeChargesEnabled,
        stripeOnboardingComplete,
        pickupDeliveryOption,
        uploadedDocs: finalUploadedDocs,
        legalChecks,
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
      };

      await updateFarmerStore(activeFarmerId, reviewPayload as any);

      await saveLocalDraft(
        activeFarmerId,
        "pending_admin_review",
        reviewPayload
      );

      await saveFarmerProfileToSupabase(activeFarmerId, {
        ...reviewPayload,
        complianceStatus: "pending_admin_review",
        uploadedDocs: finalUploadedDocs,
      });

      await createOrUpdateAdminVerificationRecord(
        activeFarmerId,
        "PENDING_ADMIN_REVIEW",
        reviewPayload
      );

      await saveAdminVerificationToSupabase(activeFarmerId, reviewPayload);

      router.replace({
        pathname: "/farmer/awaiting-approval",
        params: {
          farmerId: activeFarmerId,
          email: normalizeEmail(farmerEmail),
          businessName: businessName.trim(),
        },
      } as any);
    } catch (error: any) {
      console.log("COMPLIANCE SUBMIT ERROR:", error);
      Alert.alert(
        "Submit Failed",
        error?.message || "Unable to submit compliance review."
      );
    } finally {
      setLoading(false);
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
    const uploaded = uploadedDocs[String(doc.type)];

    if (doc.type === "stripe_payout") {
      return (
        <View key={String(doc.type)} style={styles.specialBox}>
          <Text style={styles.docLabel}>Stripe Payout Account</Text>

          <Text
            style={[
              styles.docStatus,
              stripeAccountId ? styles.uploaded : styles.missing,
            ]}
          >
            {stripeAccountId ? "Stripe account saved" : "Required"}
          </Text>

          <TextInput
            style={styles.stripeInput}
            placeholder="Stripe account will appear after setup"
            value={stripeAccountId}
            editable={false}
          />

          <TextInput
            style={styles.stripeInput}
            placeholder="Stripe payout status"
            value={stripePayoutAccount}
            editable={false}
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
        <View key={String(doc.type)} style={styles.specialBox}>
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
      <View key={String(doc.type)} style={styles.docRow}>
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
      label: "Pickup / delivery selected",
      done: Boolean(uploadedDocs.pickup_delivery_agreement),
    },
    { label: "Legal checklist accepted", done: allLegalAccepted },
    { label: "Stripe account connected", done: Boolean(stripeAccountId) },
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
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.header}>Farmer Compliance Verification</Text>

      <Text style={styles.subheader}>
        Upload required documents, create farmer login credentials, connect
        Stripe payouts, select pickup/delivery, and accept seller terms.
      </Text>

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
        <Text style={styles.sectionTitle}>Farmer Fee Status</Text>

        <Text style={styles.helperText}>
          Fees do not block document upload or Stripe payout setup. Use this
          only to record payment status.
        </Text>

        <Text
          style={[
            styles.docStatus,
            farmerMembershipPaid ? styles.uploaded : styles.missing,
          ]}
        >
          Farmer Membership: {farmerMembershipPaid ? "Completed" : "Not Marked"}
        </Text>

        <Text
          style={[
            styles.docStatus,
            applicationFeePaid ? styles.uploaded : styles.missing,
            { marginTop: 10 },
          ]}
        >
          Application Process Fee:{" "}
          {applicationFeePaid ? "Completed" : "Not Marked"}
        </Text>

        <Pressable
          style={[styles.testButton, { marginTop: 14 }]}
          onPress={markFarmerFeesComplete}
        >
          <Text style={styles.testButtonText}>Mark Farmer Fees Complete</Text>
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

      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.verifyButton, loading && styles.disabled]}
        disabled={loading}
        onPress={runVerification}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.verifyButtonText}>Complete Compliance Review</Text>
        )}
      </TouchableOpacity>

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
  readinessItem: {
    fontWeight: "900",
    marginBottom: 8,
    lineHeight: 20,
  },
  helperText: {
    color: "#64748B",
    fontWeight: "700",
    lineHeight: 21,
    marginBottom: 12,
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
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 4,
  },
  saveLoginButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  testButton: {
    backgroundColor: "#111827",
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
  },
  testButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: "#047857",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  optionButtonActive: {
    backgroundColor: "#047857",
  },
  optionButtonText: {
    color: "#047857",
    fontWeight: "900",
  },
  optionButtonTextActive: {
    color: "#FFFFFF",
  },
  legalRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
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
  },
  checkboxActive: {
    backgroundColor: "#047857",
  },
  checkboxText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  legalText: {
    flex: 1,
    color: "#111827",
    fontWeight: "800",
    lineHeight: 20,
  },
  saveLegalButton: {
    backgroundColor: "#047857",
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 14,
  },
  saveLegalButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  verifyButton: {
    backgroundColor: "#14532D",
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 20,
  },
  verifyButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  disabled: {
    opacity: 0.6,
  },
  disabledSoft: {
    opacity: 0.75,
  },
});