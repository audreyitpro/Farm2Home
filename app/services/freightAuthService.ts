// services/freightAuthService.ts

import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../data/supabaseClient";

const CURRENT_FREIGHT_KEY = "currentFreight";

export type FreightUser = {
  id?: string;
  freight_id?: string;
  auth_user_id?: string;
  profile_id?: string;
  account_id?: string | null;

  business_name?: string;
  name?: string;
  username?: string;
  freight_email?: string;
  email?: string;
  phone?: string;

  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
  membership_status?: string | null;

  account_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type FreightSubscription = {
  id?: string;
  freight_id?: string;
  freight_email?: string;
  name?: string;
  username?: string;

  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
  current_period_end?: string | null;

  created_at?: string;
  updated_at?: string;
};

function validStripeIds(record?: Partial<FreightUser | FreightSubscription> | null) {
  return (
    typeof record?.stripe_customer_id === "string" &&
    record.stripe_customer_id.startsWith("cus_") &&
    typeof record?.stripe_subscription_id === "string" &&
    record.stripe_subscription_id.startsWith("sub_")
  );
}

function validSubscriptionStatus(status?: string | null) {
  return ["active", "trialing", "past_due"].includes(
    String(status || "").toLowerCase()
  );
}

export function isFreightSubscriptionActive(
  subscription?: Partial<FreightSubscription | FreightUser> | null
) {
  return validStripeIds(subscription) && validSubscriptionStatus(subscription?.subscription_status);
}

export async function saveCurrentFreight(freight: FreightUser) {
  await AsyncStorage.setItem(CURRENT_FREIGHT_KEY, JSON.stringify(freight));
  return freight;
}

export async function getCurrentFreight(): Promise<FreightUser | null> {
  const cached = await AsyncStorage.getItem(CURRENT_FREIGHT_KEY);

  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed?.freight_id || parsed?.freight_email || parsed?.email) {
        return parsed;
      }
    } catch {}
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const email = user.email ?? "";

  const { data, error } = await supabase
    .from("freight_users")
    .select("*")
    .or(`auth_user_id.eq.${user.id},freight_email.eq.${email},email.eq.${email}`)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  await saveCurrentFreight(data);
  return data;
}

export async function getFreightSubscription(
  freightId?: string | null,
  email?: string | null
): Promise<FreightSubscription | null> {
  if (!freightId && !email) return null;

  let query = supabase.from("freight_subscriptions").select("*");

  if (freightId && email) {
    query = query.or(`freight_id.eq.${freightId},freight_email.eq.${email}`);
  } else if (freightId) {
    query = query.eq("freight_id", freightId);
  } else if (email) {
    query = query.eq("freight_email", email);
  }

  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function syncFreightSubscription(
  freight?: FreightUser | null
): Promise<FreightUser | null> {
  const currentFreight = freight ?? (await getCurrentFreight());

  if (!currentFreight) return null;

  const freightId = currentFreight.freight_id;
  const email = currentFreight.freight_email ?? currentFreight.email ?? null;

  const subscription = await getFreightSubscription(freightId, email);

  if (!subscription) return currentFreight;

  const active = isFreightSubscriptionActive(subscription);

  const updates: Partial<FreightUser> = {
    stripe_customer_id: subscription.stripe_customer_id ?? null,
    stripe_subscription_id: subscription.stripe_subscription_id ?? null,
    subscription_status: subscription.subscription_status ?? null,
    membership_status: active ? "active" : "inactive",
    account_active: active,
    updated_at: new Date().toISOString(),
  };

  let updateQuery = supabase.from("freight_users").update(updates);

  if (freightId) {
    updateQuery = updateQuery.eq("freight_id", freightId);
  } else if (email) {
    updateQuery = updateQuery.or(`freight_email.eq.${email},email.eq.${email}`);
  } else {
    return currentFreight;
  }

  const { data, error } = await updateQuery.select("*").maybeSingle();

  if (error) throw error;
  if (!data) return currentFreight;

  await saveCurrentFreight(data);
  return data;
}

export async function verifyFreightLogin() {
  const freight = await getCurrentFreight();

  if (!freight) {
    return {
      valid: false,
      freight: null,
      subscription: null,
      route: "/freight/register",
      reason: "No freight profile found.",
    };
  }

  const syncedFreight = await syncFreightSubscription(freight);

  const email =
    syncedFreight?.freight_email ??
    syncedFreight?.email ??
    freight.freight_email ??
    freight.email ??
    null;

  const subscription = await getFreightSubscription(
    syncedFreight?.freight_id ?? freight.freight_id,
    email
  );

  const activeFromSubscription = isFreightSubscriptionActive(subscription);
  const activeFromProfile = isFreightSubscriptionActive(syncedFreight ?? freight);

  const active = activeFromSubscription || activeFromProfile;

  return {
    valid: active,
    freight: syncedFreight ?? freight,
    subscription,
    route: active ? "/freight/dashboard" : "/freight/register",
    reason: active
      ? "Freight subscription verified."
      : "Freight subscription missing or inactive.",
  };
}

export async function refreshFreightFromDatabase() {
  const currentFreight = await getCurrentFreight();

  if (!currentFreight?.freight_id && !currentFreight?.freight_email && !currentFreight?.email) {
    return null;
  }

  const freightId = currentFreight.freight_id;
  const email = currentFreight.freight_email ?? currentFreight.email;

  let query = supabase.from("freight_users").select("*");

  if (freightId && email) {
    query = query.or(`freight_id.eq.${freightId},freight_email.eq.${email},email.eq.${email}`);
  } else if (freightId) {
    query = query.eq("freight_id", freightId);
  } else {
    query = query.or(`freight_email.eq.${email},email.eq.${email}`);
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  if (!data) return null;

  await saveCurrentFreight(data);
  return data;
}

export async function logoutFreight() {
  await AsyncStorage.removeItem(CURRENT_FREIGHT_KEY);

  const { error } = await supabase.auth.signOut();
  if (error) throw error;

  return true;
}

export const freightAuthService = {
  getCurrentFreight,
  saveCurrentFreight,
  getFreightSubscription,
  isFreightSubscriptionActive,
  syncFreightSubscription,
  verifyFreightLogin,
  refreshFreightFromDatabase,
  logoutFreight,
};