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

import { runAIComplianceVerification } from "../ai/compliance-verification";

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
      if (stripeReturn && returnedStripeAccountId) {
        handleStripeReturn(returnedStripeAccountId);
      }
    }, [stripeReturn, returnedStripeAccountId])
  );

  async function savePendingFarmerSnapshot(activeFarmerId = farmerId) {
    const snapshot = {
      id: activeFarmerId,
      farmName: businessName,
      businessName,
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
      stripeAccountId,
      farmerStripeAccountId: stripeAccountId,
      stripePayoutAccount,
      stripePayoutsEnabled,
      stripeChargesEnabled,
      stripeOnboardingComplete,
      pickupDeliveryOption,
      pickup:
        pickupDeliveryOption === "Pickup Only" ||
        pickupDeliveryOption === "Pickup and Delivery",
      delivery:
        pickupDeliveryOption === "Delivery Only" ||
        pickupDeliveryOption === "Pickup and Delivery",
      uploadedDocs,
      legalChecks,
      approved: false,
      accountActive: false,
      complianceStatus: "in_progress",
      updatedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(PENDING_FARMER_KEY, JSON.stringify(snapshot));
    await AsyncStorage.setItem("currentFarmer", JSON.stringify(snapshot));
    await AsyncStorage.setItem("currentUser", JSON.stringify(snapshot));
    await AsyncStorage.setItem("userRole", "farmer");
    await AsyncStorage.setItem("currentUserRole", "farmer");

    return snapshot;
  }

  async function createOrUpdateAdminVerificationRecord(
    activeFarmerId: string,
    status = "PENDING_VERIFICATION"
  ) {
    if (!activeFarmerId) return;

    const record = createVerificationRecordFromFarmer({
      farmerId: activeFarmerId,
      farmName: businessName || "Farm2Home Farm",
      ownerName: ownerName || "",
      email: farmerEmail || "",
      phone: "",
      documents: [],
    });

    await upsertVerificationRecord({
      ...record,
      farmerId: activeFarmerId,
      id: activeFarmerId,
      farmName: businessName || "Farm2Home Farm",
      businessName: businessName || "Farm2Home Farm",
      ownerName: ownerName || "",
      email: farmerEmail || "",
      state,
      status,
      complianceStatus: status,
      farmerMembershipPaid,
      applicationFeePaid,
      stripeAccountId,
      farmerStripeAccountId: stripeAccountId,
      stripePayoutsEnabled,
      stripeChargesEnabled,
      stripeOnboardingComplete,
      pickupDeliveryOption,
      uploadedDocs,
      updatedAt: new Date().toISOString(),
    } as any);
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

      setFarmerId(farmer.id || "");
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

      if (pendingSaved) {
        const pendingFarmer = JSON.parse(pendingSaved);

        setFarmerId(pendingFarmer.id || "");
        setBusinessName(
          pendingFarmer.businessName || pendingFarmer.farmName || ""
        );
        setOwnerName(pendingFarmer.ownerName || "");
        setFarmerEmail(pendingFarmer.email || "");
        setState(pendingFarmer.state || "MI");
        setUsername(pendingFarmer.username || "");
        setPassword(pendingFarmer.password || "");
        setConfirmPassword(pendingFarmer.password || "");
        setSecurityQuestion1(pendingFarmer.securityQuestion1 || "");
        setSecurityAnswer1(pendingFarmer.securityAnswer1 || "");
        setSecurityQuestion2(pendingFarmer.securityQuestion2 || "");
        setSecurityAnswer2(pendingFarmer.securityAnswer2 || "");
        setSecurityQuestion3(pendingFarmer.securityQuestion3 || "");
        setSecurityAnswer3(pendingFarmer.securityAnswer3 || "");
        setFarmerMembershipPaid(Boolean(pendingFarmer.farmerMembershipPaid));
        setApplicationFeePaid(Boolean(pendingFarmer.applicationFeePaid));
        setPickupDeliveryOption(
          pendingFarmer.pickupDeliveryOption || "Pickup and Delivery"
        );
        setUploadedDocs(pendingFarmer.uploadedDocs || {});
        setLegalChecks(pendingFarmer.legalChecks || {});
      }

      const activeFarmerId =
        farmerId ||
        (pendingSaved ? JSON.parse(pendingSaved)?.id : "") ||
        farmerIdFromParams ||
        (await getOrCreateFarmerId());

      setStripeAccountId(accountId);

      await updateFarmerStore(activeFarmerId, {
        stripeAccountId: accountId,
        farmerStripeAccountId: accountId,
        complianceStatus: "stripe_returned",
      } as any);

      await savePendingFarmerSnapshot(activeFarmerId);
      await syncCurrentFarmer(activeFarmerId);
      await verifyStripePayoutAccount(accountId);

      await createOrUpdateAdminVerificationRecord(
        activeFarmerId,
        "STRIPE_CONNECTED_PENDING_REVIEW"
      );
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

    setFarmerMembershipPaid(true);
    setApplicationFeePaid(true);

    await updateFarmerStore(activeFarmerId, {
      farmerMembershipPaid: true,
      applicationFeePaid: true,
      complianceStatus: "fees_paid",
    } as any);

    await savePendingFarmerSnapshot(activeFarmerId);
    await syncCurrentFarmer(activeFarmerId);
    await createOrUpdateAdminVerificationRecord(
      activeFarmerId,
      "PENDING_VERIFICATION"
    );

    Alert.alert(
      "Fees Marked Complete",
      "Farmer membership and application process fee were marked complete. Now continue to Stripe payout setup."
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

      await updateFarmerStore(activeFarmerId, {
        farmName: businessName.trim(),
        businessName: businessName.trim(),
        ownerName: ownerName.trim(),
        email: farmerEmail.trim(),
        state,
        complianceStatus: "in_progress",
        approved: false,
        accountActive: false,
      } as any);

      await savePendingFarmerSnapshot(activeFarmerId);
      await syncCurrentFarmer(activeFarmerId);
      await createOrUpdateAdminVerificationRecord(activeFarmerId);

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

      await updateFarmerStore(activeFarmerId, {
        username: username.trim(),
        password: password.trim(),
        email: farmerEmail.trim(),
        securityQuestion1,
        securityAnswer1: securityAnswer1.trim(),
        securityQuestion2,
        securityAnswer2: securityAnswer2.trim(),
        securityQuestion3,
        securityAnswer3: securityAnswer3.trim(),
      } as any);

      await savePendingFarmerSnapshot(activeFarmerId);
      await syncCurrentFarmer(activeFarmerId);
      await createOrUpdateAdminVerificationRecord(activeFarmerId);

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

      await savePendingFarmerSnapshot(activeFarmerId);
      await createOrUpdateAdminVerificationRecord(
        activeFarmerId,
        "DOCUMENTS_IN_PROGRESS"
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

      if (!farmerMembershipPaid || !applicationFeePaid) {
        Alert.alert(
          "Fees Required",
          "Please complete the farmer membership and application process fee before setting up Stripe payouts."
        );

        return;
      }

      await savePendingFarmerSnapshot(activeFarmerId);
      await createOrUpdateAdminVerificationRecord(
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
            email: farmerEmail.trim(),
            farmName: businessName.trim(),
            existingStripeAccountId: "",
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

      const accountId = data.accountId || data.stripeAccountId;

      await updateFarmerStore(activeFarmerId, {
        stripeAccountId: accountId,
        farmerStripeAccountId: accountId,
        email: farmerEmail.trim(),
        complianceStatus: "stripe_pending",
      } as any);

      setStripeAccountId(accountId);
      setStripePayoutAccount("Stripe Express setup pending");

      await savePendingFarmerSnapshot(activeFarmerId);
      await syncCurrentFarmer(activeFarmerId);
      await createOrUpdateAdminVerificationRecord(
        activeFarmerId,
        "STRIPE_PENDING"
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

      await updateFarmerStore(activeFarmerId, {
        stripeAccountId: returnedAccountId,
        farmerStripeAccountId: returnedAccountId,
        stripePayoutAccount: payoutLabel,
        stripeOnboardingComplete: onboardingComplete,
        stripeChargesEnabled: chargesEnabled,
        stripePayoutsEnabled: payoutsEnabled,
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

      const nextDocs = {
        ...uploadedDocs,
        stripe_payout: `stripe://${returnedAccountId}`,
      };

      setUploadedDocs(nextDocs);

      await savePendingFarmerSnapshot(activeFarmerId);
      await syncCurrentFarmer(activeFarmerId);
      await createOrUpdateAdminVerificationRecord(
        activeFarmerId,
        payoutsEnabled ? "STRIPE_COMPLETE_PENDING_REVIEW" : "STRIPE_PENDING"
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

      await updateFarmerStore(activeFarmerId, {
        pickup,
        delivery,
        pickupDeliveryOption: option,
      } as any);

      await addComplianceDocument(activeFarmerId, businessName, ownerName, state, {
        type: "pickup_delivery_agreement" as any,
        label: "Pickup / Delivery Agreement",
        uri: `agreement://${option}`,
        notes: `Farmer selected: ${option}`,
      } as any);

      const nextDocs = {
        ...uploadedDocs,
        pickup_delivery_agreement: `agreement://${option}`,
      };

      setUploadedDocs(nextDocs);
      setPickupDeliveryOption(option);

      await savePendingFarmerSnapshot(activeFarmerId);
      await syncCurrentFarmer(activeFarmerId);
      await createOrUpdateAdminVerificationRecord(
        activeFarmerId,
        "DELIVERY_OPTION_SAVED"
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

      setUploadedDocs(nextDocs);

      await savePendingFarmerSnapshot(activeFarmerId);
      await createOrUpdateAdminVerificationRecord(
        activeFarmerId,
        "LEGAL_ACCEPTED"
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

      if (!farmerMembershipPaid || !applicationFeePaid) {
        Alert.alert(
          "Fees Required",
          "Please complete both farmer fee payments before submitting compliance."
        );
        return;
      }

      const legalSaved = await saveLegalChecklist(false);
      if (!legalSaved) return;

      if (!uploadedDocs.pickup_delivery_agreement) {
        Alert.alert(
          "Pickup / Delivery Required",
          "Please select your pickup or delivery option before verification."
        );
        return;
      }

      if (!stripeAccountId) {
        Alert.alert(
          "Stripe Required",
          "Please complete Stripe payout setup before final approval."
        );
        return;
      }

      if (!stripePayoutsEnabled || !uploadedDocs.stripe_payout) {
        const stripeVerified = await verifyStripePayoutAccount(stripeAccountId);

        if (!stripeVerified) {
          Alert.alert(
            "Stripe Required",
            "Stripe must be fully enabled before final approval."
          );
          return;
        }
      }

      if (missingRequiredDocs.length > 0) {
        Alert.alert(
          "Required Documents Missing",
          `Missing:\n\n${missingRequiredDocs.join("\n")}`
        );
        return;
      }

      const record = await getComplianceRecord(activeFarmerId);

      if (!record) {
        Alert.alert(
          "Missing Compliance Record",
          "No compliance record was found. Please upload at least one document again."
        );
        return;
      }

      await createOrUpdateAdminVerificationRecord(
        activeFarmerId,
        "PENDING_ADMIN_REVIEW"
      );

      const latestFarmerBeforeAI = await getFarmerById(activeFarmerId);

      const adminAlreadyApproved =
        latestFarmerBeforeAI?.approved === true ||
        latestFarmerBeforeAI?.complianceStatus === "approved";

      let result: any = {
        autoApproved: false,
        score: adminAlreadyApproved ? 100 : 0,
        reviewedAt: new Date().toISOString(),
        missingItems: [],
      };

      if (!adminAlreadyApproved) {
        result = await runAIComplianceVerification(record);
      }

      const latestFarmer = await getFarmerById(activeFarmerId);

      const complianceApproved =
        result.autoApproved === true ||
        adminAlreadyApproved ||
        latestFarmer?.approved === true ||
        latestFarmer?.complianceStatus === "approved";

      if (complianceApproved) {
        await updateFarmerStore(activeFarmerId, {
          approved: true,
          rejected: false,
          needsMoreInfo: false,
          reviewed: true,
          accountActive: true,
          complianceSubmitted: true,
          complianceStatus: "approved",
          adminReviewStatus: "approved",
          reviewDecision: "approved",
          complianceScore: result.score || 100,
          complianceReviewedAt: result.reviewedAt || new Date().toISOString(),
          submittedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          uploadedDocs,
          legalChecks,
          stripeAccountId,
          farmerStripeAccountId: stripeAccountId,
          stripePayoutsEnabled,
          stripeChargesEnabled,
          stripeOnboardingComplete,
          farmerMembershipPaid,
          applicationFeePaid,
          pickupDeliveryOption,
        } as any);

        await createOrUpdateAdminVerificationRecord(activeFarmerId, "APPROVED");
        await syncCurrentFarmer(activeFarmerId);
        await AsyncStorage.removeItem(PENDING_FARMER_KEY);

        Alert.alert(
          "Approved",
          "Your compliance review is approved. You can now complete your farmer store setup."
        );

        router.replace("/farmer/setup-store" as any);
        return;
      }

      await updateFarmerStore(activeFarmerId, {
        approved: false,
        rejected: false,
        needsMoreInfo: false,
        reviewed: false,
        accountActive: false,
        complianceSubmitted: true,
        complianceStatus: "pending_admin_review",
        adminReviewStatus: "pending",
        reviewDecision: "pending",
        complianceScore: result.score || 0,
        complianceReviewedAt: result.reviewedAt || new Date().toISOString(),
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        uploadedDocs,
        legalChecks,
        stripeAccountId,
        farmerStripeAccountId: stripeAccountId,
        stripePayoutsEnabled,
        stripeChargesEnabled,
        stripeOnboardingComplete,
        farmerMembershipPaid,
        applicationFeePaid,
        pickupDeliveryOption,
      } as any);

      await createOrUpdateAdminVerificationRecord(
        activeFarmerId,
        "PENDING_ADMIN_REVIEW"
      );

      await savePendingFarmerSnapshot(activeFarmerId);
      await syncCurrentFarmer(activeFarmerId);

      Alert.alert(
        "Submitted for Admin Review",
        "Your farmer application is now in the Admin AI Compliance review queue for approval, rejection, or request for more information.",
        [
          {
            text: "OK",
            onPress: () => {
              router.replace("/farmer/dashboard" as any);
            },
          },
        ]
      );
    } catch (error: any) {
      console.log("Verification error:", error);

      Alert.alert(
        "Verification Error",
        error?.message || "Unable to complete compliance verification."
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
                  pickupDeliveryOption === option &&
                    styles.optionButtonActive,
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
      label: "Farmer membership paid",
      done: farmerMembershipPaid,
    },
    {
      label: "Application fee paid",
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
        Upload documents, pay farmer fees, create login credentials, connect
        Stripe payouts, select pickup/delivery, and accept seller terms.
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

        <Text
          style={[
            styles.docStatus,
            farmerMembershipPaid ? styles.uploaded : styles.missing,
          ]}
        >
          Farmer Membership: {farmerMembershipPaid ? "Completed" : "Required"}
        </Text>

        <Pressable
          style={styles.stripeButton}
          onPress={startFarmerMembershipPayment}
        >
          <Text style={styles.stripeButtonText}>Pay Farmer Membership</Text>
        </Pressable>

        <Text
          style={[
            styles.docStatus,
            applicationFeePaid ? styles.uploaded : styles.missing,
            { marginTop: 14 },
          ]}
        >
          Application Process Fee:{" "}
          {applicationFeePaid ? "Completed" : "Required"}
        </Text>

        <Pressable
          style={styles.saveButton}
          onPress={startApplicationFeePayment}
        >
          <Text style={styles.saveButtonText}>Pay Application Process Fee</Text>
        </Pressable>

        <Pressable
          style={[styles.testButton, { marginTop: 14 }]}
          onPress={markFarmerFeesComplete}
        >
          <Text style={styles.testButtonText}>I Completed Both Fee Payments</Text>
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