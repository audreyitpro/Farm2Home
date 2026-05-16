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
      email,
      full_name: fullName,
      role,
      onboarding_complete: false,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
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
    throw error;
  }

  return data as UserProfile | null;
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>
) {
  const { data, error } = await supabase
    .from("profiles")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as UserProfile;
}

export async function completeUserOnboarding(userId: string) {
  return updateUserProfile(userId, {
    onboarding_complete: true,
  });
}

export async function getUserRoleFromProfile(userId: string) {
  const profile = await getUserProfile(userId);
  return profile?.role || null;
}