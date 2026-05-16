// app/services/apiConfig.ts

export const API_CONFIG = {
  backendUrl: "http://localhost:4242",
  supabaseUrl: "https://qrewbzxspsalunanmejh.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyZXdienhzcHNhbHVuYW5tZWpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyODY5OTAsImV4cCI6MjA5Mzg2Mjk5MH0.63-GSNQOAiDvtOAYqhOtUMUeMo4RZBfoAjTN-q-rBK8",
};

export function getBackendUrl() {
  return API_CONFIG.backendUrl.replace(/\/$/, "");
}