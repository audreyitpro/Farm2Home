// app/customer/profile.tsx

import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL, APP_URL } from "../config/api";
import { supabase } from "../data/supabaseClient";

/**
 * app/customer/profile.tsx
 *
 * Full corrected customer profile.
 *
 * Saves:
 * - Customer name, username, email, phone
 * - Default delivery address
 * - Customer subscription / Stripe IDs
 * - Membership status
 * - Local AsyncStorage session
 * - Supabase customers table
 * - Supabase profiles table when available
 *
 * Buttons:
 * - Save Profile
 * - Change Password
 * - Sync Stripe Membership
 * - Manage Membership / Billing Portal
 * - Cancel Subscription
 * - Customer Dashboard
 * - Marketplace
 * - My Orders
 * - Notifications
 * - Favorites
 * - Support
 * - Logout
 */

const COLORS = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  redDark: "#9F1117",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  greenDark: "#14532D",
  greenSoft: "#DCFCE7",
  amber: "#F59E0B",
  amberSoft: "#FEF3C7",
  blue: "#2563EB",
  blueSoft: "#DBEAFE",
  danger: "#DC2626",
  dangerSoft: "#FEE2E2",
  white: "#FFFFFF",
};

type CustomerRecord = {
  id?: string;
  customer_id?: string;
  customerId?: string;
  profile_id?: string;
  profileId?: string;
  auth_user_id?: string;
  authUserId?: string;
  account_id?: string;
  accountId?: string;
  email?: string;
  name?: string;
  full_name?: string;
  fullName?: string;
  username?: string;
  phone?: string;
  delivery_address?: string;
  deliveryAddress?: string;
  delivery_city?: string;
  deliveryCity?: string;
  delivery_state?: string;
  deliveryState?: string;
  delivery_zip?: string;
  deliveryZip?: string;
  delivery_instructions?: string;
  deliveryInstructions?: string;
  preferred_delivery_option?: string;
  preferredDeliveryOption?: string;
  stripe_customer_id?: string;
  stripeCustomerId?: string;
  stripe_subscription_id?: string;
  stripeSubscriptionId?: string;
  subscription_id?: string;
  subscriptionId?: string;
  subscription_status?: string;
  subscriptionStatus?: string;
  membership_status?: string;
  membershipStatus?: string;
  current_period_end?: string;
  currentPeriodEnd?: string;
  account_active?: boolean;
  accountActive?: boolean;
  role?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function isCus(value: any) {
  return clean(value).startsWith("cus_");
}

function isSub(value: any) {
  return clean(value).startsWith("sub_");
}

function getCustomerId(customer: CustomerRecord | null) {
  return clean(customer?.id || customer?.customer_id || customer?.customerId);
}

function getProfileId(customer: CustomerRecord | null) {
  return clean(customer?.profile_id || customer?.profileId);
}

function getCustomerName(customer: CustomerRecord | null) {
  return clean(customer?.full_name || customer?.fullName || customer?.name);
}

function getStripeCustomer(customer: CustomerRecord | null) {
  return clean(customer?.stripe_customer_id || customer?.stripeCustomerId);
}

function getStripeSubscription(customer: CustomerRecord | null) {
  return clean(
    customer?.stripe_subscription_id ||
      customer?.stripeSubscriptionId ||
      customer?.subscription_id ||
      customer?.subscriptionId
  );
}

function getMembershipStatus(customer: CustomerRecord | null) {
  return clean(
    customer?.membership_status ||
      customer?.membershipStatus ||
      customer?.subscription_status ||
      customer?.subscriptionStatus ||
      "not_started"
  );
}

function statusIsActive(value: any) {
  return ["active", "trialing", "past_due"].includes(normalize(value));
}

function membershipActive(customer: CustomerRecord | null) {
  return (
    statusIsActive(getMembershipStatus(customer)) ||
    statusIsActive(customer?.subscription_status || customer?.subscriptionStatus) ||
    (isCus(getStripeCustomer(customer)) && isSub(getStripeSubscription(customer)))
  );
}

async function parseApiResponse(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {
      success: false,
      error: text || "Invalid backend response.",
    };
  }
}

async function openUrl(url: string) {
  if (!url || !url.startsWith("http")) {
    Alert.alert("Link Error", "No valid URL was returned.");
    return;
  }

  if (Platform.OS === "web") {
    window.location.href = url;
    return;
  }

  await WebBrowser.openBrowserAsync(url);
}

export default function CustomerProfile() {
  const [customer, setCustomer] = useState<CustomerRecord | null>(null);
  const [allCustomers, setAllCustomers] = useState<CustomerRecord[]>([]);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryState, setDeliveryState] = useState("MI");
  const [deliveryZip, setDeliveryZip] = useState("");
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [preferredDeliveryOption, setPreferredDeliveryOption] = useState("Delivery");

  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadCustomer();
    }, [])
  );

  async function loadCustomer() {
    try {
      setLoading(true);

      const currentRaw =
        (await AsyncStorage.getItem("currentCustomer")) ||
        (await AsyncStorage.getItem("farm2homeCurrentCustomer")) ||
        (await AsyncStorage.getItem("currentUser"));

      const savedCustomers = await AsyncStorage.getItem("farm2homeCustomers");
      const customers = savedCustomers ? JSON.parse(savedCustomers) : [];
      const safeCustomers = Array.isArray(customers) ? customers : [];

      setAllCustomers(safeCustomers);

      let current: CustomerRecord | null = currentRaw
        ? JSON.parse(currentRaw)
        : safeCustomers[safeCustomers.length - 1] || null;

      const { data: authData } = await supabase.auth.getUser();
      const authId = clean(authData?.user?.id || "");
      const authEmail = normalize(authData?.user?.email || current?.email || "");

      if (!current?.id && !current?.email && !authId && !authEmail) {
        router.replace("/customer/login" as any);
        return;
      }

      let dbCustomer: any = null;
      let profile: any = null;

      const lookupId = clean(current?.id || current?.customer_id || current?.customerId || authId);
      const lookupEmail = normalize(current?.email || authEmail);

      if (lookupId) {
        try {
          const { data } = await supabase
            .from("customers")
            .select("*")
            .or(`id.eq.${lookupId},customer_id.eq.${lookupId},auth_user_id.eq.${lookupId},profile_id.eq.${lookupId}`)
            .limit(1);

          if (Array.isArray(data) && data[0]) dbCustomer = data[0];
        } catch {
          // Try email.
        }
      }

      if (!dbCustomer && lookupEmail) {
        try {
          const { data } = await supabase
            .from("customers")
            .select("*")
            .eq("email", lookupEmail)
            .limit(1);

          if (Array.isArray(data) && data[0]) dbCustomer = data[0];
        } catch {
          // Continue.
        }
      }

      const profileId = clean(dbCustomer?.profile_id || current?.profile_id || current?.profileId || authId);

      if (profileId) {
        try {
          const { data } = await supabase
            .from("profiles")
            .select("*")
            .or(`id.eq.${profileId},auth_user_id.eq.${profileId}`)
            .limit(1);

          if (Array.isArray(data) && data[0]) profile = data[0];
        } catch {
          // Try email.
        }
      }

      if (!profile && lookupEmail) {
        try {
          const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("email", lookupEmail)
            .eq("role", "customer")
            .limit(1);

          if (Array.isArray(data) && data[0]) profile = data[0];
        } catch {
          // Continue.
        }
      }

      const subscription = await fetchCustomerSubscription(
        dbCustomer?.id || lookupId,
        dbCustomer?.email || lookupEmail
      );

      const customerId =
        clean(dbCustomer?.id || dbCustomer?.customer_id || current?.id || current?.customer_id || current?.customerId || authId) ||
        `customer_${Date.now()}`;

      const customerData: CustomerRecord = {
        ...(current || {}),
        ...(dbCustomer || {}),
        id: customerId,
        customer_id: customerId,
        customerId,
        auth_user_id: clean(dbCustomer?.auth_user_id || current?.auth_user_id || current?.authUserId || authId),
        authUserId: clean(dbCustomer?.auth_user_id || current?.auth_user_id || current?.authUserId || authId),
        profile_id: clean(dbCustomer?.profile_id || current?.profile_id || current?.profileId || profile?.id),
        profileId: clean(dbCustomer?.profile_id || current?.profile_id || current?.profileId || profile?.id),
        account_id: clean(dbCustomer?.account_id || current?.account_id || current?.accountId),
        accountId: clean(dbCustomer?.account_id || current?.account_id || current?.accountId),
        role: "customer",
        full_name: clean(
          dbCustomer?.full_name ||
            dbCustomer?.name ||
            profile?.full_name ||
            current?.full_name ||
            current?.fullName ||
            current?.name
        ),
        fullName: clean(
          dbCustomer?.full_name ||
            dbCustomer?.name ||
            profile?.full_name ||
            current?.full_name ||
            current?.fullName ||
            current?.name
        ),
        name: clean(
          dbCustomer?.name ||
            dbCustomer?.full_name ||
            profile?.full_name ||
            current?.name ||
            current?.fullName ||
            current?.full_name
        ),
        username: clean(dbCustomer?.username || profile?.username || current?.username),
        email: normalize(dbCustomer?.email || profile?.email || current?.email || lookupEmail),
        phone: clean(dbCustomer?.phone || profile?.phone || current?.phone),
        delivery_address: clean(dbCustomer?.delivery_address || current?.delivery_address || current?.deliveryAddress),
        deliveryAddress: clean(dbCustomer?.delivery_address || current?.delivery_address || current?.deliveryAddress),
        delivery_city: clean(dbCustomer?.delivery_city || current?.delivery_city || current?.deliveryCity),
        deliveryCity: clean(dbCustomer?.delivery_city || current?.delivery_city || current?.deliveryCity),
        delivery_state: clean(dbCustomer?.delivery_state || current?.delivery_state || current?.deliveryState || "MI"),
        deliveryState: clean(dbCustomer?.delivery_state || current?.delivery_state || current?.deliveryState || "MI"),
        delivery_zip: clean(dbCustomer?.delivery_zip || current?.delivery_zip || current?.deliveryZip),
        deliveryZip: clean(dbCustomer?.delivery_zip || current?.delivery_zip || current?.deliveryZip),
        delivery_instructions: clean(
          dbCustomer?.delivery_instructions ||
            current?.delivery_instructions ||
            current?.deliveryInstructions
        ),
        deliveryInstructions: clean(
          dbCustomer?.delivery_instructions ||
            current?.delivery_instructions ||
            current?.deliveryInstructions
        ),
        preferred_delivery_option: clean(
          dbCustomer?.preferred_delivery_option ||
            current?.preferred_delivery_option ||
            current?.preferredDeliveryOption ||
            "Delivery"
        ),
        preferredDeliveryOption: clean(
          dbCustomer?.preferred_delivery_option ||
            current?.preferred_delivery_option ||
            current?.preferredDeliveryOption ||
            "Delivery"
        ),
        stripe_customer_id: clean(
          dbCustomer?.stripe_customer_id ||
            current?.stripe_customer_id ||
            current?.stripeCustomerId ||
            subscription?.stripe_customer_id
        ),
        stripeCustomerId: clean(
          dbCustomer?.stripe_customer_id ||
            current?.stripe_customer_id ||
            current?.stripeCustomerId ||
            subscription?.stripe_customer_id
        ),
        stripe_subscription_id: clean(
          dbCustomer?.stripe_subscription_id ||
            dbCustomer?.subscription_id ||
            current?.stripe_subscription_id ||
            current?.stripeSubscriptionId ||
            current?.subscription_id ||
            current?.subscriptionId ||
            subscription?.stripe_subscription_id
        ),
        stripeSubscriptionId: clean(
          dbCustomer?.stripe_subscription_id ||
            dbCustomer?.subscription_id ||
            current?.stripe_subscription_id ||
            current?.stripeSubscriptionId ||
            current?.subscription_id ||
            current?.subscriptionId ||
            subscription?.stripe_subscription_id
        ),
        subscription_id: clean(
          dbCustomer?.subscription_id ||
            dbCustomer?.stripe_subscription_id ||
            current?.subscription_id ||
            current?.subscriptionId ||
            subscription?.stripe_subscription_id
        ),
        subscriptionId: clean(
          dbCustomer?.subscription_id ||
            dbCustomer?.stripe_subscription_id ||
            current?.subscription_id ||
            current?.subscriptionId ||
            subscription?.stripe_subscription_id
        ),
        membership_status: clean(
          dbCustomer?.membership_status ||
            current?.membership_status ||
            current?.membershipStatus ||
            subscription?.subscription_status ||
            "not_started"
        ),
        membershipStatus: clean(
          dbCustomer?.membership_status ||
            current?.membership_status ||
            current?.membershipStatus ||
            subscription?.subscription_status ||
            "not_started"
        ),
        subscription_status: clean(
          dbCustomer?.subscription_status ||
            current?.subscription_status ||
            current?.subscriptionStatus ||
            subscription?.subscription_status ||
            "not_started"
        ),
        subscriptionStatus: clean(
          dbCustomer?.subscription_status ||
            current?.subscription_status ||
            current?.subscriptionStatus ||
            subscription?.subscription_status ||
            "not_started"
        ),
        current_period_end: clean(subscription?.current_period_end || dbCustomer?.current_period_end || current?.current_period_end),
        currentPeriodEnd: clean(subscription?.current_period_end || dbCustomer?.current_period_end || current?.currentPeriodEnd),
        account_active: Boolean(dbCustomer?.account_active ?? current?.account_active ?? current?.accountActive ?? false),
        accountActive: Boolean(dbCustomer?.account_active ?? current?.account_active ?? current?.accountActive ?? false),
        updated_at: nowIso(),
        updatedAt: nowIso(),
      };

      setCustomer(customerData);
      setFullName(getCustomerName(customerData));
      setUsername(clean(customerData.username));
      setEmail(normalize(customerData.email));
      setPhone(clean(customerData.phone));
      setDeliveryAddress(clean(customerData.delivery_address || customerData.deliveryAddress));
      setDeliveryCity(clean(customerData.delivery_city || customerData.deliveryCity));
      setDeliveryState(clean(customerData.delivery_state || customerData.deliveryState || "MI"));
      setDeliveryZip(clean(customerData.delivery_zip || customerData.deliveryZip));
      setDeliveryInstructions(clean(customerData.delivery_instructions || customerData.deliveryInstructions));
      setPreferredDeliveryOption(clean(customerData.preferred_delivery_option || customerData.preferredDeliveryOption || "Delivery"));

      await persistCustomer(customerData, safeCustomers);
    } catch (error) {
      console.log("Customer profile load error:", error);
      router.replace("/customer/login" as any);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCustomerSubscription(customerId?: string, customerEmail?: string) {
    const filters = [
      customerId ? `customer_id.eq.${customerId}` : "",
      customerEmail ? `customer_email.eq.${normalize(customerEmail)}` : "",
    ]
      .filter(Boolean)
      .join(",");

    if (!filters) return null;

    try {
      const { data } = await supabase
        .from("customer_subscriptions")
        .select("*")
        .or(filters)
        .order("updated_at", { ascending: false })
        .limit(1);

      return Array.isArray(data) ? data[0] : null;
    } catch {
      return null;
    }
  }

  async function persistCustomer(updatedCustomer: CustomerRecord, providedCustomers?: CustomerRecord[]) {
    const existing = providedCustomers || allCustomers || [];
    const exists = existing.some((item) => getCustomerId(item) === getCustomerId(updatedCustomer));

    const updatedCustomers = exists
      ? existing.map((item) =>
          getCustomerId(item) === getCustomerId(updatedCustomer) ? updatedCustomer : item
        )
      : [...existing, updatedCustomer];

    await AsyncStorage.multiSet([
      ["farm2homeCustomers", JSON.stringify(updatedCustomers)],
      ["currentCustomer", JSON.stringify(updatedCustomer)],
      ["farm2homeCurrentCustomer", JSON.stringify(updatedCustomer)],
      ["currentUser", JSON.stringify({ ...updatedCustomer, role: "customer" })],
      ["userRole", "customer"],
      ["currentUserRole", "customer"],
    ]);

    setCustomer(updatedCustomer);
    setAllCustomers(updatedCustomers);
  }

  async function saveProfile() {
    if (!customer) {
      Alert.alert("No Customer", "No customer profile was found.");
      return;
    }

    if (!clean(fullName)) {
      Alert.alert("Name Required", "Please enter your name.");
      return;
    }

    if (!normalize(email) || !normalize(email).includes("@")) {
      Alert.alert("Email Required", "Please enter a valid customer email.");
      return;
    }

    try {
      setSaving(true);

      const now = nowIso();
      const customerId = getCustomerId(customer);
      const profileId = getProfileId(customer);

      const customerPayload: any = {
        id: customerId,
        customer_id: customerId,
        auth_user_id: clean(customer.auth_user_id || customer.authUserId),
        profile_id: profileId || null,
        account_id: clean(customer.account_id || customer.accountId),
        full_name: clean(fullName),
        name: clean(fullName),
        username: clean(username),
        email: normalize(email),
        phone: clean(phone),
        delivery_address: clean(deliveryAddress),
        delivery_city: clean(deliveryCity),
        delivery_state: clean(deliveryState || "MI"),
        delivery_zip: clean(deliveryZip),
        delivery_instructions: clean(deliveryInstructions),
        preferred_delivery_option: clean(preferredDeliveryOption || "Delivery"),
        stripe_customer_id: getStripeCustomer(customer) || null,
        stripe_subscription_id: getStripeSubscription(customer) || null,
        subscription_id: getStripeSubscription(customer) || null,
        subscription_status: clean(customer.subscription_status || customer.subscriptionStatus || "not_started"),
        membership_status: clean(customer.membership_status || customer.membershipStatus || "not_started"),
        account_active: membershipActive(customer),
        role: "customer",
        updated_at: now,
      };

      try {
        const { error } = await supabase
          .from("customers")
          .upsert(customerPayload, { onConflict: "id" });

        if (error) throw error;
      } catch (error: any) {
        console.log("customers profile upsert skipped:", error?.message || error);
      }

      if (profileId) {
        try {
          await supabase
            .from("profiles")
            .update({
              full_name: clean(fullName),
              name: clean(fullName),
              username: clean(username),
              email: normalize(email),
              phone: clean(phone),
              role: "customer",
              updated_at: now,
            })
            .or(`id.eq.${profileId},auth_user_id.eq.${profileId}`);
        } catch (error: any) {
          console.log("profiles update skipped:", error?.message || error);
        }
      }

      const updatedCustomer: CustomerRecord = {
        ...customer,
        ...customerPayload,
        fullName: clean(fullName),
        customerId,
        profileId,
        accountId: clean(customer.account_id || customer.accountId),
        deliveryAddress: clean(deliveryAddress),
        deliveryCity: clean(deliveryCity),
        deliveryState: clean(deliveryState || "MI"),
        deliveryZip: clean(deliveryZip),
        deliveryInstructions: clean(deliveryInstructions),
        preferredDeliveryOption: clean(preferredDeliveryOption || "Delivery"),
        stripeCustomerId: getStripeCustomer(customer),
        stripeSubscriptionId: getStripeSubscription(customer),
        subscriptionId: getStripeSubscription(customer),
        subscriptionStatus: customerPayload.subscription_status,
        membershipStatus: customerPayload.membership_status,
        accountActive: customerPayload.account_active,
        updatedAt: now,
      };

      await persistCustomer(updatedCustomer);

      Alert.alert("Saved", "Customer profile updated successfully.");
    } catch (error: any) {
      Alert.alert("Save Error", error?.message || "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (!customer) return;

    if (!clean(newPassword)) {
      Alert.alert("New Password Required", "Please enter a new password.");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Password Too Short", "Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Alert.alert("Password Mismatch", "New passwords do not match.");
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setNewPassword("");
      setConfirmNewPassword("");

      Alert.alert("Password Updated", "Your password was changed successfully.");
    } catch (error: any) {
      Alert.alert("Password Error", error?.message || "Unable to change password.");
    }
  }

  async function syncStripeMembership() {
    const customerId = getCustomerId(customer);
    const cleanEmail = normalize(email || customer?.email);

    if (!cleanEmail || !cleanEmail.includes("@")) {
      Alert.alert("Missing Email", "Enter the email used for Stripe membership.");
      return;
    }

    try {
      setSyncing(true);

      const response = await fetch(`${API_BASE_URL}/payments/sync-stripe-by-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: "customer",
          customerId,
          customer_id: customerId,
          userId: customerId,
          profileId: getProfileId(customer),
          email: cleanEmail,
          name: clean(fullName),
          fullName: clean(fullName),
          username: clean(username),
        }),
      });

      const data = await parseApiResponse(response);

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to sync Stripe membership.");
      }

      const updatedCustomer: CustomerRecord = {
        ...(customer || {}),
        id: customerId || `customer_${Date.now()}`,
        customer_id: customerId || `customer_${Date.now()}`,
        customerId: customerId || `customer_${Date.now()}`,
        email: cleanEmail,
        full_name: clean(fullName),
        fullName: clean(fullName),
        name: clean(fullName),
        username: clean(username),
        role: "customer",
        stripe_customer_id: data.stripeCustomerId,
        stripeCustomerId: data.stripeCustomerId,
        stripe_subscription_id: data.stripeSubscriptionId,
        stripeSubscriptionId: data.stripeSubscriptionId,
        subscription_id: data.stripeSubscriptionId,
        subscriptionId: data.stripeSubscriptionId,
        subscription_status: data.subscriptionStatus,
        subscriptionStatus: data.subscriptionStatus,
        membership_status: data.subscriptionActive ? "active" : data.subscriptionStatus,
        membershipStatus: data.subscriptionActive ? "active" : data.subscriptionStatus,
        account_active: Boolean(data.subscriptionActive),
        accountActive: Boolean(data.subscriptionActive),
        updated_at: nowIso(),
        updatedAt: nowIso(),
      };

      setCustomer(updatedCustomer);
      await persistCustomer(updatedCustomer);

      await AsyncStorage.setItem(
        "customerSubscriptionStatus",
        data.subscriptionActive ? "active" : clean(data.subscriptionStatus)
      );

      Alert.alert("Membership Synced", "Customer Stripe membership was synced.");
    } catch (error: any) {
      Alert.alert("Sync Error", error?.message || "Unable to sync membership.");
    } finally {
      setSyncing(false);
    }
  }

  async function openBillingPortal() {
    const stripeCustomerId = getStripeCustomer(customer);

    if (!isCus(stripeCustomerId)) {
      Alert.alert("Missing Stripe Customer", "No Stripe customer ID was found. Tap Restore / Sync first.");
      return;
    }

    try {
      setBillingLoading(true);

      const response = await fetch(`${API_BASE_URL}/payments/create-customer-portal-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: stripeCustomerId,
          stripeCustomerId,
          role: "customer",
          returnUrl: `${APP_URL}/customer/profile`,
          return_url: `${APP_URL}/customer/profile`,
        }),
      });

      const data = await parseApiResponse(response);

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Unable to open billing portal.");
      }

      await openUrl(data.url);
    } catch (error: any) {
      Alert.alert("Billing Error", error?.message || "Unable to open billing portal.");
    } finally {
      setBillingLoading(false);
    }
  }

  async function cancelSubscription() {
    const subscriptionId = getStripeSubscription(customer);

    if (!isSub(subscriptionId)) {
      Alert.alert("No Subscription", "No active customer subscription was found.");
      return;
    }

    Alert.alert(
      "Cancel Subscription",
      "Are you sure you want to cancel your Farm2Home customer membership?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              setCancelLoading(true);

              const response = await fetch(`${API_BASE_URL}/payments/cancel-subscription`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  subscriptionId,
                  stripeSubscriptionId: subscriptionId,
                  customerId: getCustomerId(customer),
                  role: "customer",
                }),
              });

              const data = await parseApiResponse(response);

              if (!response.ok || data.error) {
                throw new Error(data.error || "Unable to cancel subscription.");
              }

              const updatedCustomer: CustomerRecord = {
                ...(customer || {}),
                membership_status: "canceled",
                membershipStatus: "canceled",
                subscription_status: "canceled",
                subscriptionStatus: "canceled",
                account_active: false,
                accountActive: false,
                updated_at: nowIso(),
                updatedAt: nowIso(),
              };

              try {
                await supabase
                  .from("customers")
                  .update({
                    membership_status: "canceled",
                    subscription_status: "canceled",
                    account_active: false,
                    updated_at: nowIso(),
                  })
                  .eq("id", getCustomerId(customer));
              } catch {
                // Local state still updates.
              }

              await persistCustomer(updatedCustomer);

              Alert.alert("Canceled", "Customer subscription canceled successfully.");
            } catch (error: any) {
              Alert.alert("Cancel Error", error?.message || "Unable to cancel subscription.");
            } finally {
              setCancelLoading(false);
            }
          },
        },
      ]
    );
  }

  async function logout() {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore logout network error.
    }

    await AsyncStorage.multiRemove([
      "currentCustomer",
      "farm2homeCurrentCustomer",
      "currentUser",
      "userRole",
      "currentUserRole",
      "pendingCustomerSubscription",
    ]);

    router.replace("/customer/login" as any);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.red} size="large" />
          <Text style={styles.centerText}>Loading customer profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!customer) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyPage}>
          <View style={styles.emptyIconBox}>
            <Text style={styles.emptyIconText}>C</Text>
          </View>

          <Text style={styles.emptyTitle}>Customer Profile</Text>
          <Text style={styles.emptyText}>No customer profile found.</Text>

          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            onPress={() => router.replace("/customer/login" as any)}
          >
            <Text style={styles.buttonText}>Go to Customer Login</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const active = membershipActive(customer);
  const status = active ? "active" : getMembershipStatus(customer);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.push("/customer/dashboard" as any)}
              activeOpacity={0.9}
            >
              <Ionicons name="arrow-back-outline" size={18} color={COLORS.white} />
              <Text style={styles.backButtonText}>Dashboard</Text>
            </TouchableOpacity>

            <View style={styles.heroIcon}>
              <Text style={styles.heroInitial}>
                {(fullName || username || "C").slice(0, 1).toUpperCase()}
              </Text>
            </View>

            <Text style={styles.kicker}>Customer Account</Text>
            <Text style={styles.heroTitle}>{fullName || "Farm2Home Customer"}</Text>
            <Text style={styles.heroText}>{email || "No email saved"}</Text>

            <View style={[styles.statusPill, active ? styles.activePill : styles.pendingPill]}>
              <Text style={[styles.statusPillText, active ? styles.activeText : styles.pendingText]}>
                {active ? "Active Membership" : `Status: ${status}`}
              </Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <StatCard label="Membership" value={active ? "Active" : "Pending"} tone="green" />
            <StatCard label="Role" value="Customer" tone="blue" />
            <StatCard label="Account" value={customer.accountActive === false ? "Inactive" : "Active"} tone="red" />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Stripe / Membership</Text>

            <InfoLine label="Stripe Customer" value={getStripeCustomer(customer) || "Not synced"} />
            <InfoLine label="Subscription" value={getStripeSubscription(customer) || "Not synced"} />
            <InfoLine label="Customer ID" value={getCustomerId(customer) || "Not created"} />
            <InfoLine label="Current Period End" value={clean(customer.current_period_end || customer.currentPeriodEnd) || "Not listed"} />

            <TouchableOpacity
              style={[styles.primaryButton, syncing && styles.disabledButton]}
              onPress={syncStripeMembership}
              disabled={syncing}
              activeOpacity={0.9}
            >
              {syncing ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="refresh-outline" size={19} color={COLORS.white} />
                  <Text style={styles.buttonText}>Restore / Sync Stripe Membership</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, billingLoading && styles.disabledButton]}
              onPress={openBillingPortal}
              disabled={billingLoading}
              activeOpacity={0.9}
            >
              {billingLoading ? (
                <ActivityIndicator color={COLORS.red} />
              ) : (
                <>
                  <Ionicons name="card-outline" size={19} color={COLORS.red} />
                  <Text style={styles.secondaryButtonText}>Manage Billing</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelButton, cancelLoading && styles.disabledButton]}
              onPress={cancelSubscription}
              disabled={cancelLoading}
              activeOpacity={0.9}
            >
              {cancelLoading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={19} color={COLORS.white} />
                  <Text style={styles.buttonText}>Cancel Subscription</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Profile Information</Text>

            <Label text="Full Name" />
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Full name"
              placeholderTextColor="#94A3B8"
            />

            <Label text="Username" />
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Username"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
            />

            <Label text="Email" />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Label text="Phone" />
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Default Delivery Settings</Text>

            <View style={styles.optionRow}>
              {["Delivery", "Pickup"].map((option) => {
                const selected = preferredDeliveryOption === option;

                return (
                  <Pressable
                    key={option}
                    style={[styles.optionChip, selected && styles.optionChipActive]}
                    onPress={() => setPreferredDeliveryOption(option)}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextActive]}>
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Label text="Delivery Address" />
            <TextInput
              style={styles.input}
              value={deliveryAddress}
              onChangeText={setDeliveryAddress}
              placeholder="Delivery address"
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.inputRow}>
              <View style={{ flex: 1 }}>
                <Label text="City" />
                <TextInput
                  style={styles.input}
                  value={deliveryCity}
                  onChangeText={setDeliveryCity}
                  placeholder="City"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.stateBox}>
                <Label text="State" />
                <TextInput
                  style={styles.input}
                  value={deliveryState}
                  onChangeText={setDeliveryState}
                  placeholder="MI"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                />
              </View>
            </View>

            <Label text="Zip Code" />
            <TextInput
              style={styles.input}
              value={deliveryZip}
              onChangeText={setDeliveryZip}
              placeholder="Zip code"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
            />

            <Label text="Delivery Instructions" />
            <TextInput
              style={[styles.input, styles.textArea]}
              value={deliveryInstructions}
              onChangeText={setDeliveryInstructions}
              placeholder="Gate code, porch notes, apartment number, preferred drop-off..."
              placeholderTextColor="#94A3B8"
              multiline
            />

            <TouchableOpacity
              style={[styles.primaryButton, saving && styles.disabledButton]}
              onPress={saveProfile}
              disabled={saving}
              activeOpacity={0.9}
            >
              {saving ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="save-outline" size={19} color={COLORS.white} />
                  <Text style={styles.buttonText}>Save Customer Profile</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Change Password</Text>

            <TextInput
              style={styles.input}
              placeholder="New password"
              placeholderTextColor="#94A3B8"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />

            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              placeholderTextColor="#94A3B8"
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              secureTextEntry
            />

            <TouchableOpacity style={styles.blueButton} onPress={changePassword} activeOpacity={0.9}>
              <Ionicons name="lock-closed-outline" size={19} color={COLORS.white} />
              <Text style={styles.buttonText}>Change Password</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>

            <RouteRow title="Marketplace" subtitle="Shop local farm goods" path="/customer/marketplace" icon="storefront-outline" />
            <RouteRow title="Cart" subtitle="Review saved cart items" path="/customer/cart" icon="cart-outline" />
            <RouteRow title="My Orders" subtitle="View confirmed orders and tracking" path="/customer/my-orders" icon="receipt-outline" />
            <RouteRow title="Notifications" subtitle="Order, farmer, and driver alerts" path="/customer/notifications" icon="notifications-outline" />
            <RouteRow title="Favorites" subtitle="Saved farms and products" path="/customer/favorites" icon="heart-outline" />
            <RouteRow title="Support" subtitle="Get help with orders or payment" path="/customer/support" icon="help-buoy-outline" />
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.9}>
            <Ionicons name="log-out-outline" size={19} color={COLORS.white} />
            <Text style={styles.buttonText}>Logout</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "blue" | "red";
}) {
  const config = {
    green: { bg: COLORS.greenSoft, color: COLORS.greenDark },
    blue: { bg: COLORS.blueSoft, color: COLORS.blue },
    red: { bg: COLORS.dangerSoft, color: COLORS.red },
  }[tone];

  return (
    <View style={styles.statCard}>
      <View style={[styles.statDot, { backgroundColor: config.bg }]}>
        <Ionicons name="ellipse" size={12} color={config.color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RouteRow({
  title,
  subtitle,
  path,
  icon,
}: {
  title: string;
  subtitle: string;
  path: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
      onPress={() => router.push(path as any)}
    >
      <View style={styles.actionIconBox}>
        <Ionicons name={icon} size={20} color={COLORS.red} />
      </View>

      <View style={styles.actionTextBlock}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>

      <Ionicons name="chevron-forward-outline" size={20} color={COLORS.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  centerText: { color: COLORS.muted, fontWeight: "800" },
  content: { paddingBottom: 70 },
  emptyPage: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyIconBox: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyIconText: { color: COLORS.white, fontWeight: "900", fontSize: 28 },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 18,
    textAlign: "center",
  },
  hero: {
    backgroundColor: COLORS.black,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  backButton: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.red,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    marginBottom: 18,
  },
  backButtonText: { color: COLORS.white, fontWeight: "900" },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 26,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  heroInitial: { color: COLORS.white, fontWeight: "900", fontSize: 32 },
  kicker: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroTitle: { color: COLORS.white, fontSize: 34, fontWeight: "900", marginTop: 6 },
  heroText: { color: "#CBD5E1", fontWeight: "700", lineHeight: 22, marginTop: 6 },
  statusPill: {
    alignSelf: "flex-start",
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  activePill: { backgroundColor: COLORS.greenSoft },
  pendingPill: { backgroundColor: COLORS.amberSoft },
  statusPillText: { fontWeight: "900", textTransform: "capitalize" },
  activeText: { color: COLORS.greenDark },
  pendingText: { color: "#92400E" },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    marginTop: 18,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 12,
  },
  statDot: {
    width: 28,
    height: 28,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: { color: COLORS.text, fontWeight: "900", fontSize: 15 },
  statLabel: { color: COLORS.muted, fontWeight: "800", marginTop: 4, fontSize: 11 },
  card: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 24,
    marginHorizontal: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 14,
    color: COLORS.text,
  },
  label: {
    color: COLORS.muted,
    marginTop: 6,
    marginBottom: 7,
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    fontWeight: "800",
    color: COLORS.text,
  },
  textArea: {
    minHeight: 95,
    textAlignVertical: "top",
  },
  inputRow: { flexDirection: "row", gap: 10 },
  stateBox: { width: 95 },
  optionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  optionChip: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 13,
    alignItems: "center",
  },
  optionChipActive: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },
  optionText: {
    color: COLORS.red,
    fontWeight: "900",
  },
  optionTextActive: {
    color: COLORS.white,
  },
  infoLine: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 11,
  },
  infoLabel: {
    color: COLORS.muted,
    fontWeight: "900",
    fontSize: 11,
    textTransform: "uppercase",
  },
  infoValue: {
    color: COLORS.text,
    fontWeight: "800",
    marginTop: 3,
  },
  primaryButton: {
    backgroundColor: COLORS.red,
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    minHeight: 52,
    flexDirection: "row",
    gap: 8,
  },
  secondaryButton: {
    backgroundColor: "#FEE2E2",
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    minHeight: 52,
    flexDirection: "row",
    gap: 8,
  },
  secondaryButtonText: {
    color: COLORS.red,
    fontWeight: "900",
    fontSize: 15,
  },
  blueButton: {
    backgroundColor: COLORS.blue,
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  cancelButton: {
    backgroundColor: COLORS.danger,
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  logoutButton: {
    backgroundColor: COLORS.black,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 18,
    marginTop: 4,
    marginBottom: 30,
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: { opacity: 0.65 },
  buttonText: { color: COLORS.white, fontWeight: "900", fontSize: 15 },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
    gap: 12,
  },
  actionIconBox: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
  },
  actionTextBlock: { flex: 1 },
  actionTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  actionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 12,
    marginTop: 3,
  },
  pressed: { opacity: 0.75 },
});
