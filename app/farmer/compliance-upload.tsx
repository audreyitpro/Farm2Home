// app/farmer/compliance-upload.tsx

import React, { useCallback, useMemo, useState } from "react";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";
import { Link, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL } from "../config/api";
import { PAYMENT_LINKS } from "../config/paymentLinks";
import { supabase } from "../services/supabaseClient";
import {
  REQUIRED_DOCUMENTS,
  ComplianceDocumentType,
} from "../data/complianceStore";

const CURRENT_FARMER_KEY = "currentFarmer";
const PENDING_FARMER_KEY = "pendingFarmerApplication";

const PICKUP_OPTIONS = ["Pickup Only", "Delivery Only", "Pickup and Delivery"];

const LEGAL_CHECKLIST = [
  "I confirm my business information is accurate.",
  "I confirm I am authorized to sell these products.",
  "I confirm I will follow state food and farm regulations.",
  "I confirm perishable items will be handled safely.",
  "I confirm pickup and delivery terms are accurate.",
  "I confirm payout information belongs to my business.",
  "I agree to Farm2Home seller terms.",
];

type UploadedDocs = Record<string, string>;
type LegalChecks = Record<number, boolean>;

function firstParam(value: any) {
  if (Array.isArray(value)) return value[0] || "";
  return value ? String(value) : "";
}

function normalizeEmail(value: string) {
  return String(value || "").trim().toLowerCase();
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function makeUuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0;
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

export default function FarmerComplianceUploadScreen() {
  const params = useLocalSearchParams();

  const farmerIdParam = firstParam(params.farmerId);
  const returnedAccountId = firstParam(params.accountId);
  const stripeReturn = firstParam(params.stripeReturn) === "true";

  const [loading, setLoading] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [verifyStripeLoading, setVerifyStripeLoading] = useState(false);
  const [uploadingType, setUploadingType] = useState("");

  const [farmerId, setFarmerId] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [farmerEmail, setFarmerEmail] = useState("");
  const [state, setState] = useState("MI");

  const [applicationFeePaid, setApplicationFeePaid] = useState(false);
  const [applicationFeeStarted, setApplicationFeeStarted] = useState(false);

  const [stripeAccountId, setStripeAccountId] = useState("");
  const [stripePayoutsEnabled, setStripePayoutsEnabled] = useState(false);
  const [stripeChargesEnabled, setStripeChargesEnabled] = useState(false);
  const [stripeOnboardingComplete, setStripeOnboardingComplete] =
    useState(false);

  const [pickupDeliveryOption, setPickupDeliveryOption] =
    useState("Pickup and Delivery");

  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocs>({});
  const [legalChecks, setLegalChecks] = useState<LegalChecks>({});
  const [stripeReturnHandled, setStripeReturnHandled] = useState(false);

  const requiredDocTypes = useMemo(() => {
    return REQUIRED_DOCUMENTS.filter((doc: any) => {
      const type = String(doc.type);
      return (
        doc.required &&
        type !== "stripe_payout" &&
        type !== "pickup_delivery_agreement" &&
        type !== "legal_checklist"
      );
    }).map((doc: any) => String(doc.type));
  }, []);

  const missingRequiredDocs = useMemo(() => {
    return requiredDocTypes.filter((type) => !uploadedDocs[type]);
  }, [requiredDocTypes, uploadedDocs]);

  const legalComplete = useMemo(() => {
    return LEGAL_CHECKLIST.every((_, index) => legalChecks[index]);
  }, [legalChecks]);

  const businessComplete = Boolean(
    businessName.trim() && ownerName.trim() && validEmail(farmerEmail)
  );

  const stripeComplete = Boolean(stripeAccountId);
  const docsComplete = missingRequiredDocs.length === 0;
  const pickupComplete = Boolean(uploadedDocs.pickup_delivery_agreement);

  const awaitingApprovalHref = {
    pathname: "/farmer/awaiting-approval",
    params: {
      farmerId: farmerId || farmerIdParam || "pending",
      email: normalizeEmail(farmerEmail),
      businessName: businessName.trim() || "Farm2Home Farmer",
    },
  } as any;

  useFocusEffect(
    useCallback(() => {
      loadFarmer();
    }, [farmerIdParam])
  );

  useFocusEffect(
    useCallback(() => {
      if (stripeReturn && returnedAccountId && !stripeReturnHandled) {
        setStripeReturnHandled(true);
        saveStripeReturn(returnedAccountId);
      }
    }, [stripeReturn, returnedAccountId, stripeReturnHandled])
  );

  async function openUrl(url: string, title = "Open Link Error") {
    try {
      if (!url || !url.startsWith("http")) {
        Alert.alert(title, "No valid link was provided.");
        return;
      }

      if (Platform.OS === "web") {
        window.open(url, "_blank");
        return;
      }

      const supported = await Linking.canOpenURL(url);

      if (supported) {
        await Linking.openURL(url);
        return;
      }

      await WebBrowser.openBrowserAsync(url);
    } catch (error: any) {
      Alert.alert(title, error?.message || "Unable to open link.");
    }
  }

  async function getOrCreateFarmerId() {
    if (farmerId) return farmerId;

    if (farmerIdParam) {
      setFarmerId(farmerIdParam);
      return farmerIdParam;
    }

    const auth = await supabase.auth.getUser();
    const authId = auth?.data?.user?.id;

    if (authId) {
      setFarmerId(authId);
      return authId;
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

    const newId = makeUuid();
    setFarmerId(newId);
    return newId;
  }

  function pickupFlags(option: string) {
    return {
      pickup: option === "Pickup Only" || option === "Pickup and Delivery",
      delivery: option === "Delivery Only" || option === "Pickup and Delivery",
    };
  }

  function localFarmerPayload(activeId: string, overrides: any = {}) {
    const flags = pickupFlags(
      overrides.pickup_delivery_option || pickupDeliveryOption
    );

    return {
      id: activeId,
      farmerId: activeId,
      role: "farmer",

      businessName: overrides.business_name || businessName.trim(),
      farmName:
        overrides.farm_name || overrides.business_name || businessName.trim(),
      ownerName: overrides.owner_name || ownerName.trim(),
      email: normalizeEmail(overrides.email || farmerEmail),
      state: overrides.state || state,

      applicationFeePaid:
        overrides.application_fee_paid ?? applicationFeePaid ?? false,
      applicationFeeStarted:
        overrides.application_fee_started ?? applicationFeeStarted ?? false,

      stripeAccountId: overrides.stripe_account_id || stripeAccountId || "",
      farmerStripeAccountId:
        overrides.farmer_stripe_account_id ||
        overrides.stripe_account_id ||
        stripeAccountId ||
        "",
      stripePayoutsEnabled:
        overrides.stripe_payouts_enabled ?? stripePayoutsEnabled ?? false,
      stripeChargesEnabled:
        overrides.stripe_charges_enabled ?? stripeChargesEnabled ?? false,
      stripeOnboardingComplete:
        overrides.stripe_onboarding_complete ??
        stripeOnboardingComplete ??
        false,

      pickupDeliveryOption:
        overrides.pickup_delivery_option || pickupDeliveryOption,
      pickup: flags.pickup,
      delivery: flags.delivery,

      uploadedDocs: overrides.uploaded_docs || uploadedDocs,
      legalChecks: overrides.legal_checks || legalChecks,

      approved: false,
      rejected: false,
      reviewed: false,
      accountActive: false,
      storeUnlocked: false,

      complianceSubmitted: overrides.compliance_submitted || false,
      complianceStatus: overrides.compliance_status || "in_progress",
      adminReviewStatus: overrides.admin_review_status || "in_progress",
      reviewDecision: overrides.review_decision || "in_progress",

      submittedAt: overrides.submitted_at || null,
      updatedAt: new Date().toISOString(),
    };
  }

  async function saveLocal(activeId: string, overrides: any = {}) {
    const local = localFarmerPayload(activeId, overrides);

    await AsyncStorage.setItem(CURRENT_FARMER_KEY, JSON.stringify(local));
    await AsyncStorage.setItem(PENDING_FARMER_KEY, JSON.stringify(local));
    await AsyncStorage.setItem("currentUser", JSON.stringify(local));
    await AsyncStorage.setItem("userRole", "farmer");
    await AsyncStorage.setItem("currentUserRole", "farmer");

    return local;
  }

  async function saveFarmer(status = "in_progress", overrides: any = {}) {
    const activeId = await getOrCreateFarmerId();
    const flags = pickupFlags(
      overrides.pickup_delivery_option || pickupDeliveryOption
    );

    const payload = {
      id: activeId,
      farm_name:
        overrides.farm_name || overrides.business_name || businessName.trim(),
      business_name: overrides.business_name || businessName.trim(),
      owner_name: overrides.owner_name || ownerName.trim(),
      email: normalizeEmail(overrides.email || farmerEmail),
      state: overrides.state || state,

      application_fee_paid:
        overrides.application_fee_paid ?? applicationFeePaid ?? false,
      application_fee_started:
        overrides.application_fee_started ?? applicationFeeStarted ?? false,

      farmer_membership_paid: false,
      monthly_membership_started: false,
      monthly_membership_required_after_approval: true,

      stripe_account_id: overrides.stripe_account_id || stripeAccountId || "",
      farmer_stripe_account_id:
        overrides.farmer_stripe_account_id ||
        overrides.stripe_account_id ||
        stripeAccountId ||
        "",
      stripe_payouts_enabled:
        overrides.stripe_payouts_enabled ?? stripePayoutsEnabled ?? false,
      stripe_charges_enabled:
        overrides.stripe_charges_enabled ?? stripeChargesEnabled ?? false,
      stripe_onboarding_complete:
        overrides.stripe_onboarding_complete ??
        stripeOnboardingComplete ??
        false,

      pickup_delivery_option:
        overrides.pickup_delivery_option || pickupDeliveryOption,
      pickup: flags.pickup,
      delivery: flags.delivery,

      uploaded_docs: overrides.uploaded_docs || uploadedDocs,
      legal_checks: overrides.legal_checks || legalChecks,

      compliance_status: overrides.compliance_status || status,
      admin_review_status: overrides.admin_review_status || "in_progress",
      review_decision: overrides.review_decision || "in_progress",
      compliance_submitted: overrides.compliance_submitted || false,

      approved: false,
      rejected: false,
      reviewed: false,
      account_active: false,
      store_unlocked: false,

      submitted_at: overrides.submitted_at || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("farmers")
      .upsert(payload, { onConflict: "id" });

    if (error) throw error;

    await saveLocal(activeId, payload);

    return payload;
  }

  async function saveAdminVerification(
    status = "PENDING_VERIFICATION",
    overrides: any = {}
  ) {
    const activeId = await getOrCreateFarmerId();
    const finalDocs = overrides.uploaded_docs || uploadedDocs;
    const pendingReview =
      status === "PENDING_ADMIN_REVIEW" ||
      overrides.compliance_submitted === true;

    const documents = Object.entries(finalDocs || {}).map(([type, uri]) => ({
      id: `${activeId}_${type}`,
      name: String(type).replace(/_/g, " "),
      label: String(type).replace(/_/g, " "),
      type,
      uri,
      uploadedAt: new Date().toISOString(),
      status: "PENDING",
    }));

    const payload = {
      id: activeId,
      farmer_id: activeId,
      account_type: "FARMER",
      role: "farmer",
      type: "FARMER",

      farm_name:
        overrides.farm_name || overrides.business_name || businessName.trim(),
      business_name: overrides.business_name || businessName.trim(),
      company_name: overrides.business_name || businessName.trim(),
      owner_name: overrides.owner_name || ownerName.trim(),
      email: normalizeEmail(overrides.email || farmerEmail),
      state: overrides.state || state,

      status,
      compliance_status: status,
      admin_review_status: pendingReview ? "pending" : status,
      review_decision: pendingReview ? "pending" : status,

      application_fee_paid:
        overrides.application_fee_paid ?? applicationFeePaid ?? false,
      application_fee_started:
        overrides.application_fee_started ?? applicationFeeStarted ?? false,

      farmer_membership_paid: false,
      monthly_membership_started: false,
      monthly_membership_required_after_approval: true,

      stripe_account_id: overrides.stripe_account_id || stripeAccountId || "",
      farmer_stripe_account_id:
        overrides.farmer_stripe_account_id ||
        overrides.stripe_account_id ||
        stripeAccountId ||
        "",
      stripe_payouts_enabled:
        overrides.stripe_payouts_enabled ?? stripePayoutsEnabled ?? false,
      stripe_charges_enabled:
        overrides.stripe_charges_enabled ?? stripeChargesEnabled ?? false,
      stripe_onboarding_complete:
        overrides.stripe_onboarding_complete ??
        stripeOnboardingComplete ??
        false,

      pickup_delivery_option:
        overrides.pickup_delivery_option || pickupDeliveryOption,

      uploaded_docs: finalDocs,
      legal_checks: overrides.legal_checks || legalChecks,
      documents,

      approved: false,
      rejected: false,
      needs_more_info: false,
      reviewed: false,
      account_active: false,
      store_unlocked: false,

      submitted_at: pendingReview ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("admin_verifications")
      .upsert(payload, { onConflict: "id" });

    if (error) throw error;

    return payload;
  }

  async function loadFarmer() {
    try {
      let activeId = farmerIdParam;

      if (!activeId) {
        const auth = await supabase.auth.getUser();
        activeId = auth?.data?.user?.id || "";
      }

      if (!activeId) {
        const saved =
          (await AsyncStorage.getItem(CURRENT_FARMER_KEY)) ||
          (await AsyncStorage.getItem(PENDING_FARMER_KEY));

        if (saved) {
          try {
            activeId = JSON.parse(saved)?.id || "";
          } catch {}
        }
      }

      if (!activeId) {
        activeId = await getOrCreateFarmerId();
      }

      setFarmerId(activeId);

      const { data } = await supabase
        .from("farmers")
        .select("*")
        .eq("id", activeId)
        .maybeSingle();

      let farmer: any = data;

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

      if (!farmer) return;

      setBusinessName(
        farmer.business_name ||
          farmer.businessName ||
          farmer.farm_name ||
          farmer.farmName ||
          ""
      );
      setOwnerName(farmer.owner_name || farmer.ownerName || "");
      setFarmerEmail(farmer.email || "");
      setState(String(farmer.state || "MI").slice(0, 2).toUpperCase());

      setApplicationFeePaid(
        Boolean(farmer.application_fee_paid || farmer.applicationFeePaid)
      );
      setApplicationFeeStarted(
        Boolean(farmer.application_fee_started || farmer.applicationFeeStarted)
      );

      setStripeAccountId(
        farmer.stripe_account_id ||
          farmer.farmer_stripe_account_id ||
          farmer.stripeAccountId ||
          farmer.farmerStripeAccountId ||
          ""
      );

      setStripePayoutsEnabled(
        Boolean(farmer.stripe_payouts_enabled || farmer.stripePayoutsEnabled)
      );
      setStripeChargesEnabled(
        Boolean(farmer.stripe_charges_enabled || farmer.stripeChargesEnabled)
      );
      setStripeOnboardingComplete(
        Boolean(
          farmer.stripe_onboarding_complete ||
            farmer.stripeOnboardingComplete
        )
      );

      setPickupDeliveryOption(
        farmer.pickup_delivery_option ||
          farmer.pickupDeliveryOption ||
          "Pickup and Delivery"
      );

      setUploadedDocs(farmer.uploaded_docs || farmer.uploadedDocs || {});
      setLegalChecks(farmer.legal_checks || farmer.legalChecks || {});
    } catch (error: any) {
      Alert.alert(
        "Load Error",
        error?.message || "Unable to load compliance page."
      );
    }
  }

  async function saveBusiness() {
    try {
      const activeId = await getOrCreateFarmerId();

      if (
        !businessName.trim() ||
        !ownerName.trim() ||
        !validEmail(farmerEmail)
      ) {
        Alert.alert(
          "Business Info Required",
          "Enter business name, owner name, and valid farmer email."
        );
        return false;
      }

      const overrides = {
        business_name: businessName.trim(),
        farm_name: businessName.trim(),
        owner_name: ownerName.trim(),
        email: normalizeEmail(farmerEmail),
        state,
      };

      await saveFarmer("in_progress", overrides);
      await saveAdminVerification("PENDING_VERIFICATION", overrides);
      await saveLocal(activeId, overrides);

      Alert.alert("Saved", "Business information saved.");
      return true;
    } catch (error: any) {
      Alert.alert(
        "Save Error",
        error?.message || "Unable to save business info."
      );
      return false;
    }
  }

  async function openApplicationFee() {
    try {
      setLoading(true);

      await openUrl(PAYMENT_LINKS.farmerApplicationProcessFee, "Stripe Error");

      setApplicationFeeStarted(true);

      const overrides = {
        application_fee_started: true,
      };

      try {
        await saveFarmer("application_fee_started", overrides);
        await saveAdminVerification("APPLICATION_FEE_STARTED", overrides);
      } catch {}
    } finally {
      setLoading(false);
    }
  }

  async function markApplicationFeeForReview() {
    try {
      const activeId = await getOrCreateFarmerId();

      setApplicationFeeStarted(true);

      const overrides = {
        application_fee_started: true,
      };

      await saveFarmer("application_fee_pending_review", overrides);
      await saveAdminVerification("APPLICATION_FEE_PENDING_REVIEW", overrides);
      await saveLocal(activeId, overrides);

      Alert.alert(
        "Saved",
        "Application fee marked as pending review. Admin can verify Stripe payment before approval."
      );
    } catch (error: any) {
      Alert.alert(
        "Save Error",
        error?.message || "Unable to save payment review status."
      );
    }
  }

  async function setupStripePayout() {
    try {
      if (!businessComplete) {
        Alert.alert(
          "Business Info Required",
          "Save business info before Stripe setup."
        );
        return;
      }

      setStripeLoading(true);

      const activeId = await getOrCreateFarmerId();

      const response = await fetch(
        `${API_BASE_URL}/payments/create-farmer-connect-account`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            farmerId: activeId,
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
        data = { raw: text };
      }

      const accountId = data.accountId || data.stripeAccountId || "";
      const onboardingUrl = data.onboardingUrl || data.url || "";

      if (!response.ok || !data.success || !onboardingUrl) {
        throw new Error(
          data.error ||
            data.message ||
            data.raw ||
            `Stripe onboarding failed. Backend status ${response.status}`
        );
      }

      setStripeAccountId(accountId);

      const nextDocs = {
        ...uploadedDocs,
        stripe_payout: `stripe://${accountId}`,
      };

      const overrides = {
        stripe_account_id: accountId,
        farmer_stripe_account_id: accountId,
        uploaded_docs: nextDocs,
      };

      setUploadedDocs(nextDocs);

      await saveFarmer("stripe_pending", overrides);
      await saveAdminVerification("STRIPE_PENDING", overrides);

      await openUrl(onboardingUrl, "Stripe Setup Error");
    } catch (error: any) {
      Alert.alert(
        "Stripe Error",
        error?.message || "Unable to start Stripe setup."
      );
    } finally {
      setStripeLoading(false);
    }
  }

  async function saveStripeReturn(accountId: string) {
    try {
      const nextDocs = {
        ...uploadedDocs,
        stripe_payout: `stripe://${accountId}`,
      };

      setStripeAccountId(accountId);
      setUploadedDocs(nextDocs);

      const overrides = {
        stripe_account_id: accountId,
        farmer_stripe_account_id: accountId,
        uploaded_docs: nextDocs,
      };

      await saveFarmer("stripe_pending", overrides);
      await saveAdminVerification("STRIPE_PENDING", overrides);
    } catch {}
  }

  async function verifyStripe() {
    try {
      setVerifyStripeLoading(true);

      const activeId = await getOrCreateFarmerId();

      if (!stripeAccountId) {
        Alert.alert("Missing Stripe", "Setup Stripe payout first.");
        return;
      }

      let onboardingComplete = false;
      let payoutsEnabled = false;
      let chargesEnabled = false;

      try {
        const response = await fetch(
          `${API_BASE_URL}/payments/check-farmer-connect-account`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              farmerId: activeId,
              stripeAccountId,
              accountId: stripeAccountId,
            }),
          }
        );

        const text = await response.text();

        let data: any = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = { raw: text };
        }

        onboardingComplete =
          data.onboardingComplete === true ||
          data.detailsSubmitted === true ||
          data.details_submitted === true ||
          data.account?.details_submitted === true ||
          data.account?.detailsSubmitted === true;

        payoutsEnabled =
          data.payoutsEnabled === true ||
          data.payouts_enabled === true ||
          data.account?.payouts_enabled === true ||
          data.account?.payoutsEnabled === true;

        chargesEnabled =
          data.chargesEnabled === true ||
          data.charges_enabled === true ||
          data.account?.charges_enabled === true ||
          data.account?.chargesEnabled === true;
      } catch (error) {
        console.log("Stripe backend verify skipped:", error);
      }

      const acceptStripeAccount = Boolean(stripeAccountId.startsWith("acct_"));

      setStripeOnboardingComplete(onboardingComplete || acceptStripeAccount);
      setStripePayoutsEnabled(payoutsEnabled);
      setStripeChargesEnabled(chargesEnabled);

      const nextDocs = {
        ...uploadedDocs,
        stripe_payout: `stripe://${stripeAccountId}`,
      };

      setUploadedDocs(nextDocs);

      const overrides = {
        stripe_account_id: stripeAccountId,
        farmer_stripe_account_id: stripeAccountId,
        stripe_onboarding_complete: onboardingComplete || acceptStripeAccount,
        stripe_payouts_enabled: payoutsEnabled,
        stripe_charges_enabled: chargesEnabled,
        uploaded_docs: nextDocs,
      };

      await saveFarmer(
        onboardingComplete || payoutsEnabled || acceptStripeAccount
          ? "stripe_complete"
          : "stripe_pending",
        overrides
      );

      await saveAdminVerification(
        onboardingComplete || payoutsEnabled || acceptStripeAccount
          ? "STRIPE_COMPLETE_PENDING_REVIEW"
          : "STRIPE_PENDING",
        overrides
      );

      Alert.alert(
        "Stripe Saved",
        payoutsEnabled
          ? "Stripe payout is fully enabled."
          : "Stripe account was saved for admin review."
      );
    } catch (error: any) {
      Alert.alert(
        "Stripe Verify Error",
        error?.message || "Unable to verify Stripe."
      );
    } finally {
      setVerifyStripeLoading(false);
    }
  }

  async function uploadDocument(type: ComplianceDocumentType, label: string) {
    try {
      setUploadingType(String(type));

      const activeId = await getOrCreateFarmerId();

      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: "*/*",
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];

      if (!asset?.uri) {
        Alert.alert("Upload Error", "No document selected.");
        return;
      }

      let finalUri = asset.uri;

      try {
        const fileResponse = await fetch(asset.uri);
        const blob = await fileResponse.blob();

        const safeName = String(asset.name || `${String(type)}_${Date.now()}`)
          .replace(/\s+/g, "_")
          .replace(/[^\w.-]/g, "");

        const path = `${activeId}/${String(type)}_${Date.now()}_${safeName}`;

        const { error } = await supabase.storage
          .from("farmer-compliance-documents")
          .upload(path, blob, {
            upsert: true,
            contentType: asset.mimeType || "application/octet-stream",
          });

        if (!error) {
          const { data } = supabase.storage
            .from("farmer-compliance-documents")
            .getPublicUrl(path);

          finalUri = data.publicUrl || path;
        }
      } catch {}

      const nextDocs = {
        ...uploadedDocs,
        [String(type)]: finalUri,
      };

      setUploadedDocs(nextDocs);

      const overrides = {
        uploaded_docs: nextDocs,
      };

      await saveFarmer("documents_in_progress", overrides);
      await saveAdminVerification("DOCUMENTS_IN_PROGRESS", overrides);

      Alert.alert("Uploaded", `${label} saved successfully.`);
    } catch (error: any) {
      Alert.alert(
        "Upload Error",
        error?.message || "Unable to upload document."
      );
    } finally {
      setUploadingType("");
    }
  }

  async function savePickupOption(option: string) {
    try {
      const nextDocs = {
        ...uploadedDocs,
        pickup_delivery_agreement: `agreement://${option}`,
      };

      setPickupDeliveryOption(option);
      setUploadedDocs(nextDocs);

      const overrides = {
        pickup_delivery_option: option,
        uploaded_docs: nextDocs,
      };

      await saveFarmer("pickup_delivery_saved", overrides);
      await saveAdminVerification("PICKUP_DELIVERY_SAVED", overrides);

      Alert.alert("Saved", `${option} saved.`);
    } catch (error: any) {
      Alert.alert(
        "Save Error",
        error?.message || "Unable to save pickup option."
      );
    }
  }

  async function saveLegal() {
    try {
      if (!legalComplete) {
        Alert.alert(
          "Legal Checklist Required",
          "Please accept every legal item."
        );
        return;
      }

      const nextDocs = {
        ...uploadedDocs,
        legal_checklist: "legal-checklist://accepted",
      };

      setUploadedDocs(nextDocs);

      const overrides = {
        legal_checks: legalChecks,
        uploaded_docs: nextDocs,
      };

      await saveFarmer("legal_accepted", overrides);
      await saveAdminVerification("LEGAL_ACCEPTED", overrides);

      Alert.alert("Saved", "Legal checklist saved.");
    } catch (error: any) {
      Alert.alert(
        "Save Error",
        error?.message || "Unable to save legal checklist."
      );
    }
  }

  async function saveApplicationForReviewOnly() {
    const activeId = await getOrCreateFarmerId();
    const now = new Date().toISOString();

    const safeEmail = normalizeEmail(farmerEmail);
    const safeBusinessName = businessName.trim() || "Farm2Home Farmer";
    const safeOwnerName = ownerName.trim() || "Farmer Owner";
    const safeStripeAccount = stripeAccountId || "pending-admin-review";

    const finalUploadedDocs = {
      ...uploadedDocs,
      pickup_delivery_agreement:
        uploadedDocs.pickup_delivery_agreement ||
        `agreement://${pickupDeliveryOption}`,
      legal_checklist:
        uploadedDocs.legal_checklist || "legal-checklist://accepted",
      stripe_payout:
        uploadedDocs.stripe_payout || `stripe://${safeStripeAccount}`,
    };

    const overrides = {
      business_name: safeBusinessName,
      farm_name: safeBusinessName,
      owner_name: safeOwnerName,
      email: safeEmail,
      state: state || "MI",

      application_fee_started: true,
      application_fee_paid: applicationFeePaid,

      stripe_account_id: safeStripeAccount,
      farmer_stripe_account_id: safeStripeAccount,
      stripe_onboarding_complete: true,
      stripe_payouts_enabled: stripePayoutsEnabled,
      stripe_charges_enabled: stripeChargesEnabled,

      pickup_delivery_option: pickupDeliveryOption,
      uploaded_docs: finalUploadedDocs,
      legal_checks: legalChecks,

      compliance_submitted: true,
      compliance_status: "pending_admin_review",
      admin_review_status: "pending",
      review_decision: "pending",

      approved: false,
      rejected: false,
      reviewed: false,
      needs_more_info: false,
      account_active: false,
      store_unlocked: false,

      submitted_at: now,
      updated_at: now,
    };

    saveLocal(activeId, overrides).catch((error) =>
      console.log("LOCAL_SAVE_ERROR:", error)
    );
    saveFarmer("pending_admin_review", overrides).catch((error) =>
      console.log("FARMER_SAVE_ERROR:", error)
    );
    saveAdminVerification("PENDING_ADMIN_REVIEW", overrides).catch((error) =>
      console.log("ADMIN_QUEUE_SAVE_ERROR:", error)
    );
  }

  function StatusPill({ done }: { done: boolean }) {
    return (
      <View style={[styles.pill, done ? styles.pillDone : styles.pillMissing]}>
        <Text
          style={[
            styles.pillText,
            done ? styles.pillTextDone : styles.pillTextMissing,
          ]}
        >
          {done ? "Complete" : "Needed"}
        </Text>
      </View>
    );
  }

  function ActionCard({
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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#14532D" />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="always"
      >
        <View style={styles.hero}>
          <Text style={styles.kicker}>Farm2Home Farmer Compliance</Text>
          <Text style={styles.heroTitle}>Application Review Center</Text>
          <Text style={styles.heroSub}>
            Complete each step below. Farmer monthly membership starts only
            after admin approval.
          </Text>
        </View>

        <ActionCard
          icon="business-outline"
          title="Business Information"
          subtitle="Save farm name, owner name, email, and state."
          done={businessComplete}
        >
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

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={saveBusiness}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryText}>Save Business Info</Text>
          </TouchableOpacity>
        </ActionCard>

        <ActionCard
          icon="card-outline"
          title="Application Fee"
          subtitle="Open the $29.99 Stripe application fee payment page."
          done={applicationFeePaid || applicationFeeStarted}
        >
          <TouchableOpacity
            style={styles.stripeBtn}
            onPress={openApplicationFee}
            activeOpacity={0.85}
          >
            <Ionicons name="open-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryText}>Open Stripe Application Fee</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={markApplicationFeeForReview}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryText}>
              I Paid / Save For Admin Review
            </Text>
          </TouchableOpacity>
        </ActionCard>

        <ActionCard
          icon="wallet-outline"
          title="Stripe Payout"
          subtitle="Setup Stripe Express so customer order payouts can be sent to the farmer."
          done={stripeComplete}
        >
          <Text style={styles.smallText}>
            Stripe Account: {stripeAccountId || "Not connected"}
          </Text>

          <TouchableOpacity
            style={styles.stripeBtn}
            onPress={setupStripePayout}
            disabled={stripeLoading}
            activeOpacity={0.85}
          >
            {stripeLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="open-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryText}>Setup Stripe Payout</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={verifyStripe}
            disabled={verifyStripeLoading}
            activeOpacity={0.85}
          >
            {verifyStripeLoading ? (
              <ActivityIndicator color="#14532D" />
            ) : (
              <Text style={styles.secondaryText}>Verify Stripe Payout</Text>
            )}
          </TouchableOpacity>
        </ActionCard>

        <ActionCard
          icon="document-attach-outline"
          title="Required Documents"
          subtitle="Upload all required compliance files."
          done={docsComplete}
        >
          {REQUIRED_DOCUMENTS.filter((doc: any) => {
            const type = String(doc.type);
            return (
              type !== "stripe_payout" &&
              type !== "pickup_delivery_agreement" &&
              type !== "legal_checklist"
            );
          }).map((doc: any) => {
            const type = String(doc.type);
            const uploaded = Boolean(uploadedDocs[type]);
            const isUploading = uploadingType === type;

            return (
              <View key={type} style={styles.docRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docTitle}>
                    {doc.label} {doc.required ? "*" : ""}
                  </Text>

                  <Text style={uploaded ? styles.good : styles.bad}>
                    {uploaded
                      ? "Uploaded"
                      : doc.required
                      ? "Required"
                      : "Optional"}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.docBtn}
                  onPress={() =>
                    uploadDocument(
                      doc.type as ComplianceDocumentType,
                      doc.label
                    )
                  }
                  disabled={isUploading}
                  activeOpacity={0.85}
                >
                  {isUploading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.docBtnText}>
                      {uploaded ? "Replace" : "Upload"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </ActionCard>

        <ActionCard
          icon="navigate-outline"
          title="Pickup / Delivery"
          subtitle="Choose how customers receive orders."
          done={pickupComplete}
        >
          <View style={styles.optionGrid}>
            {PICKUP_OPTIONS.map((option) => {
              const active = pickupDeliveryOption === option;

              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.optionBtn, active && styles.optionActive]}
                  onPress={() => savePickupOption(option)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.optionText,
                      active && styles.optionTextActive,
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ActionCard>

        <ActionCard
          icon="shield-checkmark-outline"
          title="Legal Seller Checklist"
          subtitle="Confirm legal selling requirements."
          done={legalComplete}
        >
          {LEGAL_CHECKLIST.map((item, index) => {
            const checked = Boolean(legalChecks[index]);

            return (
              <TouchableOpacity
                key={item}
                style={styles.legalRow}
                onPress={() =>
                  setLegalChecks((prev) => ({
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

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={saveLegal}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryText}>Save Legal Checklist</Text>
          </TouchableOpacity>
        </ActionCard>

        <Link href={awaitingApprovalHref} asChild>
          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.disabled]}
            onPress={saveApplicationForReviewOnly}
            activeOpacity={0.85}
          >
            <Text style={styles.submitText}>
              Submit Application For Admin Review
            </Text>
          </TouchableOpacity>
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAF5" },
  content: { paddingBottom: 80 },
  hero: {
    backgroundColor: "#14532D",
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 32,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
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
    color: "#DCFCE7",
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },
  card: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8DA",
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
    backgroundColor: "#2E7D32",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    color: "#172017",
    fontSize: 20,
    fontWeight: "900",
  },
  cardSub: {
    color: "#64748B",
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
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 16,
    padding: 14,
    fontWeight: "800",
    marginBottom: 10,
    color: "#0F172A",
  },
  primaryBtn: {
    backgroundColor: "#2E7D32",
    borderRadius: 16,
    padding: 15,
    alignItems: "center",
    marginTop: 8,
  },
  stripeBtn: {
    backgroundColor: "#635BFF",
    borderRadius: 16,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },
  primaryText: { color: "#FFFFFF", fontWeight: "900" },
  secondaryBtn: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#86EFAC",
    borderRadius: 16,
    padding: 15,
    alignItems: "center",
    marginTop: 10,
  },
  secondaryText: { color: "#14532D", fontWeight: "900" },
  smallText: {
    color: "#475569",
    fontWeight: "800",
    marginBottom: 8,
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingVertical: 13,
    gap: 12,
  },
  docTitle: { color: "#172017", fontWeight: "900" },
  good: { color: "#166534", fontWeight: "900", marginTop: 4 },
  bad: { color: "#DC2626", fontWeight: "900", marginTop: 4 },
  docBtn: {
    backgroundColor: "#2E7D32",
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 11,
    minWidth: 86,
    alignItems: "center",
  },
  docBtnText: { color: "#FFFFFF", fontWeight: "900" },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  optionBtn: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#2E7D32",
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 999,
  },
  optionActive: { backgroundColor: "#2E7D32" },
  optionText: { color: "#2E7D32", fontWeight: "900" },
  optionTextActive: { color: "#FFFFFF" },
  legalRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#2E7D32",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: "#2E7D32" },
  checkText: { color: "#FFFFFF", fontWeight: "900" },
  legalText: {
    flex: 1,
    color: "#172017",
    fontWeight: "800",
    lineHeight: 21,
  },
  submitBtn: {
    backgroundColor: "#14532D",
    marginHorizontal: 16,
    marginTop: 18,
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: "center",
  },
  submitText: { color: "#FFFFFF", fontWeight: "900", fontSize: 16 },
  disabled: { opacity: 0.6 },
});