// app/services/apiConfig.ts

import { API_BASE_URL } from "../config/api";

export const API_CONFIG = {
  backendUrl: API_BASE_URL,

  supabaseUrl:
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    "https://qrewbzxspsalunanmejh.supabase.co",

  supabaseAnonKey:
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    "YOUR_SUPABASE_ANON_KEY",
};

export function getBackendUrl() {
  return String(API_CONFIG.backendUrl || "").replace(/\/$/, "");
}