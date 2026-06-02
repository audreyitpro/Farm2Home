// app/services/farmerSetupService.ts

import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabaseClient";

export type FarmerSetupStep =
  | "business"
  | "application_fee"
  | "membership"
  | "stripe"
  | "documents"
  | "pickup_delivery"
  | "legal"
  | "submit";

const CURRENT_FARMER_KEY = "currentFarmer";
const PENDING_FARMER_KEY = "pendingFarmerApplication";

function cleanEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function cleanValue(value?: string | null) {
  return String(value || "").trim();
}

export async function getAuthProfile() {
  const { data } = await supabase.auth.getUser();

  return {
    authId: data?.user?.id || "",
    email: cleanEmail(data?.user?.email || ""),
  };
}

export async function findFarmerRow(params?: {
  farmerId?: string;
  profileId?: string;
  email?: string;
}) {
  const auth = await getAuthProfile();

  const farmerId = cleanValue(params?.farmerId);
  const profileId = cleanValue(params?.profileId || auth.authId);
  const email = cleanEmail(params?.email || auth.email);

  if (farmerId) {
    const { data, error } = await supabase
      .from("farmers")
      .select("*")
      .eq("id", farmerId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;
  }

  if (profileId) {
    const { data, error } = await supabase
      .from("farmers")
      .select("*")
      .eq("profile_id", profileId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;
  }

  if (email) {
    const { data, error } = await supabase
      .from("farmers")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;
  }

  return null;
}

async function saveLocalFarmer(farmer: any) {
  const localFarmer = {
    id: farmer.id || "",
    farmerId: farmer.id || "",
    profileId: farmer.profile_id || "",
    role: "farmer",

    email: farmer.email || "",
    username: farmer.username || "",

    farmName: farmer.farm_name || farmer.business_name || "",
    businessName: farmer.business_name || farmer.farm_name || "",
    ownerName: farmer.owner_name || "",
    state: farmer.state || "MI",

    stripeAccountId: farmer.stripe_account_id || "",

    applicationFeePaid: Boolean(farmer.application_fee_paid),
    farmerMembershipPaid: Boolean(farmer.farmer_membership_paid),
    farmerActivationPaid: Boolean(farmer.farmer_activation_paid),
    farmerMonthlySubscriptionPaid: Boolean(
      farmer.farmer_monthly_subscription_paid
    ),
    monthlyMembershipStarted: Boolean(farmer.monthly_membership_started),

    complianceSubmitted: Boolean(farmer.compliance_submitted),
    approved: Boolean(farmer.approved),
    reviewed: Boolean(farmer.reviewed),
    rejected: Boolean(farmer.rejected),
    needsMoreInfo: Boolean(farmer.needs_more_info),

    accountActive: Boolean(farmer.account_active),
    storeUnlocked: Boolean(farmer.store_unlocked),

    complianceStatus: farmer.compliance_status || "",
    adminReviewStatus: farmer.admin_review_status || "",
    reviewDecision: farmer.review_decision || "",

    updatedAt: farmer.updated_at || new Date().toISOString(),
  };

  await AsyncStorage.setItem(CURRENT_FARMER_KEY, JSON.stringify(localFarmer));
  await AsyncStorage.setItem(PENDING_FARMER_KEY, JSON.stringify(localFarmer));
  await AsyncStorage.setItem("currentUser", JSON.stringify(localFarmer));
  await AsyncStorage.setItem("userRole", "farmer");
  await AsyncStorage.setItem("currentUserRole", "farmer");

  return localFarmer;
}

export async function updateFarmerSetupStep(params: {
  step: FarmerSetupStep;
  farmerId?: string;
  profileId?: string;
  email?: string;
  values: Record<string, any>;
}) {
  const auth = await getAuthProfile();

  const existing = await findFarmerRow({
    farmerId: params.farmerId,
    profileId: params.profileId || auth.authId,
    email: params.email || auth.email,
  });

  const finalId =
    existing?.id ||
    cleanValue(params.farmerId) ||
    cleanValue(auth.authId);

  const finalProfileId =
    existing?.profile_id ||
    cleanValue(params.profileId) ||
    cleanValue(auth.authId) ||
    finalId;

  const finalEmail =
    cleanEmail(params.email) ||
    cleanEmail(existing?.email) ||
    cleanEmail(auth.email);

  if (!finalId) {
    throw new Error("Unable to save farmer setup: missing farmer ID.");
  }

  const updatePayload = {
    ...params.values,
    profile_id: finalProfileId,
    email: finalEmail,
    updated_at: new Date().toISOString(),
  };

  let result;

  if (existing?.id) {
    result = await supabase
      .from("farmers")
      .update(updatePayload)
      .eq("id", existing.id)
      .select("*")
      .maybeSingle();
  } else {
    result = await supabase
      .from("farmers")
      .upsert(
        {
          id: finalId,
          ...updatePayload,
        },
        { onConflict: "id" }
      )
      .select("*")
      .maybeSingle();
  }

  if (result.error) {
    throw result.error;
  }

  if (result.data) {
    await saveLocalFarmer(result.data);
  }

  return result.data;
}

export async function saveFarmerBusinessInfo(params: {
  farmerId?: string;
  profileId?: string;
  businessName: string;
  ownerName: string;
  email: string;
  state: string;
}) {
  return updateFarmerSetupStep({
    step: "business",
    farmerId: params.farmerId,
    profileId: params.profileId,
    email: params.email,
    values: {
      farm_name: params.businessName,
      business_name: params.businessName,
      owner_name: params.ownerName,
      state: params.state || "MI",
    },
  });
}

export async function markFarmerApplicationFeePaid(params: {
  farmerId?: string;
  profileId?: string;
  email?: string;
}) {
  return updateFarmerSetupStep({
    step: "application_fee",
    farmerId: params.farmerId,
    profileId: params.profileId,
    email: params.email,
    values: {
      application_fee_paid: true,
      farmer_activation_paid: true,
    },
  });
}

export async function markFarmerMembershipPaid(params: {
  farmerId?: string;
  profileId?: string;
  email?: string;
}) {
  return updateFarmerSetupStep({
    step: "membership",
    farmerId: params.farmerId,
    profileId: params.profileId,
    email: params.email,
    values: {
      farmer_membership_paid: true,
      farmer_monthly_subscription_paid: true,
      monthly_membership_started: true,
    },
  });
}

export async function saveFarmerStripeAccount(params: {
  farmerId?: string;
  profileId?: string;
  email?: string;
  stripeAccountId: string;
  payoutsEnabled?: boolean;
  chargesEnabled?: boolean;
  onboardingComplete?: boolean;
}) {
  return updateFarmerSetupStep({
    step: "stripe",
    farmerId: params.farmerId,
    profileId: params.profileId,
    email: params.email,
    values: {
      stripe_account_id: params.stripeAccountId,
      stripe_payouts_enabled: Boolean(params.payoutsEnabled),
      stripe_charges_enabled: Boolean(params.chargesEnabled),
      stripe_onboarding_complete: Boolean(params.onboardingComplete),
      compliance_status: params.onboardingComplete
        ? "STRIPE_COMPLETE"
        : "STRIPE_PENDING",
    },
  });
}

export async function saveFarmerDocuments(params: {
  farmerId?: string;
  profileId?: string;
  email?: string;
  uploadedDocs: Record<string, string>;
}) {
  return updateFarmerSetupStep({
    step: "documents",
    farmerId: params.farmerId,
    profileId: params.profileId,
    email: params.email,
    values: {
      uploaded_docs: params.uploadedDocs,
    },
  });
}

export async function saveFarmerPickupDelivery(params: {
  farmerId?: string;
  profileId?: string;
  email?: string;
  pickupDeliveryOption: string;
  uploadedDocs?: Record<string, string>;
}) {
  const option = params.pickupDeliveryOption;

  return updateFarmerSetupStep({
    step: "pickup_delivery",
    farmerId: params.farmerId,
    profileId: params.profileId,
    email: params.email,
    values: {
      pickup_delivery_option: option,
      pickup: option === "Pickup Only" || option === "Pickup and Delivery",
      delivery: option === "Delivery Only" || option === "Pickup and Delivery",
      uploaded_docs: params.uploadedDocs || {},
    },
  });
}

export async function saveFarmerLegalChecklist(params: {
  farmerId?: string;
  profileId?: string;
  email?: string;
  legalChecks: Record<number, boolean>;
  uploadedDocs?: Record<string, string>;
}) {
  return updateFarmerSetupStep({
    step: "legal",
    farmerId: params.farmerId,
    profileId: params.profileId,
    email: params.email,
    values: {
      legal_checks: params.legalChecks,
      uploaded_docs: params.uploadedDocs || {},
    },
  });
}

export async function submitFarmerSetup(params: {
  farmerId?: string;
  profileId?: string;
  email?: string;
}) {
  return updateFarmerSetupStep({
    step: "submit",
    farmerId: params.farmerId,
    profileId: params.profileId,
    email: params.email,
    values: {
      compliance_submitted: true,
      approved: true,
      reviewed: true,
      rejected: false,
      needs_more_info: false,
      store_unlocked: true,
      account_active: true,
      compliance_status: "ACTIVE",
      admin_review_status: "ACTIVE",
      review_decision: "APPROVED",
    },
  });
}