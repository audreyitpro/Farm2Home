import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "https://qrewbzxspsalunanmejh.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "PASTE_YOUR_REAL_ANON_KEY_HERE";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

export async function getCurrentUser() {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      console.log("Get current user error:", error.message);
      return null;
    }

    return data.user ?? null;
  } catch (error) {
    console.log("Get current user crash:", error);
    return null;
  }
}

export async function getCurrentSession() {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.log("Get current session error:", error.message);
      return null;
    }

    return data.session ?? null;
  } catch (error) {
    console.log("Get current session crash:", error);
    return null;
  }
}

export async function signOutSupabase() {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.log("Supabase sign out error:", error.message);
    }
  } catch (error) {
    console.log("Supabase sign out crash:", error);
  }
}