import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "./supabaseClient";

export type UserRole = "CUSTOMER" | "FARMER" | "FREIGHT" | "ADMIN";

export type AuthProfile = {
  id: string;
  auth_user_id?: string | null;
  role: UserRole;
  full_name?: string | null;
  email: string;
  phone?: string | null;
  created_at?: string | null;
};

export type AuthResult = {
  user: any;
  session: any;
  profile: AuthProfile | null;
};

const CURRENT_PROFILE_KEY = "farm2homeCurrentProfile";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.log("Auth profile parse error:", error);
    return null;
  }
}

async function saveCurrentProfile(profile: AuthProfile | null) {
  if (!profile) return;

  await AsyncStorage.setItem(CURRENT_PROFILE_KEY, JSON.stringify(profile));
}

export async function signUpWithEmail(params: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role: UserRole;
}): Promise<AuthResult> {
  const cleanEmail = normalizeEmail(params.email);
  const cleanFullName = params.fullName.trim();
  const cleanPhone = params.phone?.trim() || null;

  if (!cleanEmail || !params.password || !cleanFullName) {
    throw new Error("Email, password, and full name are required.");
  }

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password: params.password,
  });

  if (error) {
    throw new Error(error.message);
  }

  const authUserId = data.user?.id || null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .insert({
      auth_user_id: authUserId,
      role: params.role,
      full_name: cleanFullName,
      email: cleanEmail,
      phone: cleanPhone,
    })
    .select()
    .single();

  if (profileError) {
    throw new Error(profileError.message);
  }

  const typedProfile = profile as AuthProfile;

  await saveCurrentProfile(typedProfile);

  return {
    user: data.user,
    session: data.session,
    profile: typedProfile,
  };
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail || !password) {
    throw new Error("Email and password are required.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  let profile: AuthProfile | null = null;

  if (data.user?.id) {
    profile = await getProfileByAuthUserId(data.user.id);
  }

  if (!profile) {
    profile = await getProfileByEmail(cleanEmail);
  }

  await saveCurrentProfile(profile);

  return {
    user: data.user,
    session: data.session,
    profile,
  };
}

export async function getProfileByAuthUserId(
  authUserId: string
): Promise<AuthProfile | null> {
  if (!authUserId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    console.log("Get profile error:", error.message);
    return null;
  }

  return data as AuthProfile | null;
}

export async function getProfileByEmail(
  email: string
): Promise<AuthProfile | null> {
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", cleanEmail)
    .maybeSingle();

  if (error) {
    console.log("Get profile by email error:", error.message);
    return null;
  }

  return data as AuthProfile | null;
}

export async function getCurrentAuthProfile(): Promise<AuthProfile | null> {
  const { data, error } = await supabase.auth.getUser();

  if (!error && data.user?.id) {
    const profile = await getProfileByAuthUserId(data.user.id);

    if (profile) {
      await saveCurrentProfile(profile);
      return profile;
    }
  }

  const localProfile = await AsyncStorage.getItem(CURRENT_PROFILE_KEY);
  return safeJsonParse<AuthProfile>(localProfile);
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.log("Supabase sign out error:", error.message);
  }

  await AsyncStorage.removeItem(CURRENT_PROFILE_KEY);
}

export async function requireRole(role: UserRole) {
  const profile = await getCurrentAuthProfile();

  if (!profile) return false;

  return profile.role === role;
}

export async function requireAnyRole(roles: UserRole[]) {
  const profile = await getCurrentAuthProfile();

  if (!profile) return false;

  return roles.includes(profile.role);
}