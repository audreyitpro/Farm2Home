import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://placeholder.supabase.co";

const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder.placeholder";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export async function getCurrentUser() {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      console.log("Get current user error:", error.message);
      return null;
    }

    return data.user;
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

    return data.session;
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