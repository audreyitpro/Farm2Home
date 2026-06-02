// app/services/profileSetupService.ts

import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabaseClient";

export type ProfileRole = "farmer" | "freight" | "driver" | "customer";

function clean(value?: string | null) {
  return String(value || "").trim();
}

function cleanEmail(value?: string | null) {
  return clean(value).toLowerCase();
}

function getRoleConfig(role: ProfileRole) {
  if (role === "freight") {
    return {
      table: "freight_carriers",
      currentKey: "currentFreight",
      roleValue: "freight",
      stripeColumn: "stripe_account_id",
    };
  }

  if (role === "driver") {
    return {
      table: "drivers",
      currentKey: "currentDriver",
      roleValue: "driver",
      stripeColumn: "stripe_account_id",
    };
  }

  if (role === "customer") {
    return {
      table: "customers",
      currentKey: "currentCustomer",
      roleValue: "customer",
      stripeColumn: "stripe_customer_id",
    };
  }

  return {
    table: "farmers",
    currentKey: "currentFarmer",
    roleValue: "farmer",
    stripeColumn: "stripe_account_id",
  };
}

export async function getAuthProfile() {
  const { data } = await supabase.auth.getUser();

  return {
    authId: data?.user?.id || "",
    email: cleanEmail(data?.user?.email || ""),
  };
}

export async function findProfileRow(params: {
  role: ProfileRole;
  id?: string;
  profileId?: string;
  email?: string;
}) {
  const config = getRoleConfig(params.role);
  const auth = await getAuthProfile();

  const id = clean(params.id);
  const profileId = clean(params.profileId || auth.authId);
  const email = cleanEmail(params.email || auth.email);

  if (id) {
    const { data, error } = await supabase
      .from(config.table)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;
  }

  if (profileId) {
    const { data, error } = await supabase
      .from(config.table)
      .select("*")
      .eq("profile_id", profileId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;
  }

  if (email) {
    const { data, error } = await supabase
      .from(config.table)
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;
  }

  return null;
}

async function saveLocalProfile(role: ProfileRole, profile: any) {
  const config = getRoleConfig(role);

  const localProfile = {
    ...profile,
    role: config.roleValue,
    id: profile.id || "",
    profileId: profile.profile_id || "",
    email: profile.email || "",
    accountActive: Boolean(profile.account_active),
    storeUnlocked: Boolean(profile.store_unlocked),
    stripeId: profile[config.stripeColumn] || "",
    updatedAt: profile.updated_at || new Date().toISOString(),
  };

  await AsyncStorage.setItem(config.currentKey, JSON.stringify(localProfile));
  await AsyncStorage.setItem("currentUser", JSON.stringify(localProfile));
  await AsyncStorage.setItem("userRole", config.roleValue);
  await AsyncStorage.setItem("currentUserRole", config.roleValue);

  return localProfile;
}

export async function updateProfileStep(params: {
  role: ProfileRole;
  id?: string;
  profileId?: string;
  email?: string;
  values: Record<string, any>;
}) {
  const config = getRoleConfig(params.role);
  const auth = await getAuthProfile();

  const existing = await findProfileRow({
    role: params.role,
    id: params.id,
    profileId: params.profileId || auth.authId,
    email: params.email || auth.email,
  });

  const finalId = existing?.id || clean(params.id) || clean(auth.authId);

  const finalProfileId =
    existing?.profile_id || clean(params.profileId) || clean(auth.authId) || finalId;

  const finalEmail =
    cleanEmail(params.email) || cleanEmail(existing?.email) || cleanEmail(auth.email);

  if (!finalId) {
    throw new Error(`Unable to save ${params.role}: missing profile ID.`);
  }

  const payload = {
    ...params.values,
    profile_id: finalProfileId,
    email: finalEmail,
    updated_at: new Date().toISOString(),
  };

  let result;

  if (existing?.id) {
    result = await supabase
      .from(config.table)
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .maybeSingle();
  } else {
    result = await supabase
      .from(config.table)
      .upsert(
        {
          id: finalId,
          ...payload,
        },
        { onConflict: "id" }
      )
      .select("*")
      .maybeSingle();
  }

  if (result.error) throw result.error;

  if (result.data) {
    await saveLocalProfile(params.role, result.data);
  }

  return result.data;
}

export async function saveProfileBusinessInfo(params: {
  role: ProfileRole;
  id?: string;
  profileId?: string;
  email: string;
  businessName?: string;
  ownerName?: string;
  phone?: string;
  state?: string;
}) {
  const values: Record<string, any> = {
    email: cleanEmail(params.email),
    phone: clean(params.phone) || null,
    state: clean(params.state || "MI"),
  };

  if (params.role === "farmer") {
    values.business_name = clean(params.businessName);
    values.farm_name = clean(params.businessName);
    values.owner_name = clean(params.ownerName);
  } else if (params.role === "freight") {
    values.business_name = clean(params.businessName);
    values.company_name = clean(params.businessName);
    values.owner_name = clean(params.ownerName);
  } else if (params.role === "driver") {
    values.full_name = clean(params.ownerName || params.businessName);
    values.name = clean(params.ownerName || params.businessName);
  } else {
    values.full_name = clean(params.ownerName || params.businessName);
    values.name = clean(params.ownerName || params.businessName);
  }

  return updateProfileStep({
    role: params.role,
    id: params.id,
    profileId: params.profileId,
    email: params.email,
    values,
  });
}

export async function saveProfileStripeId(params: {
  role: ProfileRole;
  id?: string;
  profileId?: string;
  email?: string;
  stripeId: string;
  payoutsEnabled?: boolean;
  chargesEnabled?: boolean;
  onboardingComplete?: boolean;
}) {
  const config = getRoleConfig(params.role);

  return updateProfileStep({
    role: params.role,
    id: params.id,
    profileId: params.profileId,
    email: params.email,
    values: {
      [config.stripeColumn]: params.stripeId,
      stripe_payouts_enabled: Boolean(params.payoutsEnabled),
      stripe_charges_enabled: Boolean(params.chargesEnabled),
      stripe_onboarding_complete: Boolean(params.onboardingComplete),
    },
  });
}

export async function markProfileMembershipPaid(params: {
  role: ProfileRole;
  id?: string;
  profileId?: string;
  email?: string;
}) {
  const values: Record<string, any> = {
    membership_paid: true,
    subscription_status: "ACTIVE",
    account_active: true,
  };

  if (params.role === "farmer") {
    values.farmer_membership_paid = true;
    values.farmer_monthly_subscription_paid = true;
    values.monthly_membership_started = true;
  }

  if (params.role === "driver") {
    values.driver_membership_paid = true;
  }

  if (params.role === "freight") {
    values.freight_membership_paid = true;
  }

  if (params.role === "customer") {
    values.customer_membership_paid = true;
  }

  return updateProfileStep({
    role: params.role,
    id: params.id,
    profileId: params.profileId,
    email: params.email,
    values,
  });
}

export async function submitProfileSetup(params: {
  role: ProfileRole;
  id?: string;
  profileId?: string;
  email?: string;
}) {
  return updateProfileStep({
    role: params.role,
    id: params.id,
    profileId: params.profileId,
    email: params.email,
    values: {
      account_active: true,
      store_unlocked: true,
      compliance_submitted: true,
      approved: true,
      reviewed: true,
      rejected: false,
      needs_more_info: false,
      compliance_status: "ACTIVE",
      admin_review_status: "ACTIVE",
      review_decision: "APPROVED",
    },
  });
}