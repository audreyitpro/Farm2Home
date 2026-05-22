import { supabase } from "./supabaseClient";
import { AppUserRole } from "./authService";

export type UserProfile = {
  id: string;

  email: string | null;

  full_name: string | null;

  role: AppUserRole | null;

  avatar_url: string | null;

  phone: string | null;

  city: string | null;

  state: string | null;

  zip_code?: string | null;

  address?: string | null;

  bio?: string | null;

  farm_name?: string | null;

  business_name?: string | null;

  stripe_account_id?: string | null;

  stripe_onboarding_complete?: boolean;

  subscription_status?: string | null;

  onboarding_complete: boolean;

  created_at?: string;

  updated_at?: string;
};

export async function createUserProfile({
  id,
  email,
  fullName,
  role,
}: {
  id: string;
  email: string;
  fullName: string;
  role: AppUserRole;
}) {
  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      id,
      email: email?.trim().toLowerCase(),
      full_name: fullName?.trim(),
      role,
      onboarding_complete: false,
      subscription_status: "inactive",
      stripe_onboarding_complete: false,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.log("createUserProfile error:", error);
    throw error;
  }

  return data as UserProfile;
}

export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.log("getUserProfile error:", error);
    throw error;
  }

  return data as UserProfile | null;
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>
) {
  const cleanUpdates = {
    ...updates,

    full_name: updates.full_name?.trim(),

    email: updates.email?.trim().toLowerCase(),

    phone: updates.phone?.trim(),

    city: updates.city?.trim(),

    state: updates.state?.trim(),

    zip_code: updates.zip_code?.trim(),

    address: updates.address?.trim(),

    bio: updates.bio?.trim(),

    farm_name: updates.farm_name?.trim(),

    business_name: updates.business_name?.trim(),

    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("profiles")
    .update(cleanUpdates)
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    console.log("updateUserProfile error:", error);
    throw error;
  }

  return data as UserProfile;
}

export async function completeUserOnboarding(userId: string) {
  return updateUserProfile(userId, {
    onboarding_complete: true,
  });
}

export async function updateSubscriptionStatus(params: {
  userId: string;
  subscriptionStatus: string;
}) {
  return updateUserProfile(params.userId, {
    subscription_status: params.subscriptionStatus,
  });
}

export async function updateStripeAccount(params: {
  userId: string;
  stripeAccountId: string;
  onboardingComplete?: boolean;
}) {
  return updateUserProfile(params.userId, {
    stripe_account_id: params.stripeAccountId,
    stripe_onboarding_complete:
      params.onboardingComplete || false,
  });
}

export async function getUserRoleFromProfile(userId: string) {
  const profile = await getUserProfile(userId);

  return profile?.role || null;
}

export async function searchProfilesByRole(role: AppUserRole) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", role)
    .order("created_at", { ascending: false });

  if (error) {
    console.log("searchProfilesByRole error:", error);
    throw error;
  }

  return (data || []) as UserProfile[];
}