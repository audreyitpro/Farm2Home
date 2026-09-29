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
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL } from "../config/api";
import { supabase } from "../data/supabaseClient";

const COLORS = {
  bg: "#F8F8FB",
  card: "#FFFFFF",
  surface: "#FFFFFF",
  black: "#2A3042",
  red: "#556EE6",
  redDark: "#485EC4",
  primaryLight: "#EEF2FF",
  green: "#34C38F",
  greenDark: "#2CA67A",
  greenSoft: "#E8FBF3",
  amber: "#F1B44C",
  amberSoft: "#FFF6E5",
  blue: "#50A5F1",
  blueSoft: "#EAF5FE",
  danger: "#F46A6A",
  dangerSoft: "#FFECEC",
  text: "#495057",
  muted: "#74788D",
  border: "#EFF2F7",
  white: "#FFFFFF",
};

const CUSTOMER_SERVICE_FEE = 4.99;

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
  customer_email?: string;
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

function getCustomerId(customer: CustomerRecord | null) {
  return clean(
    customer?.id ||
      customer?.customer_id ||
      customer?.customerId
  );
}

function getProfileId(customer: CustomerRecord | null) {
  return clean(customer?.profile_id || customer?.profileId);
}

function getCustomerName(customer: CustomerRecord | null) {
  return clean(
    customer?.full_name ||
      customer?.fullName ||
      customer?.name
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

export default function CustomerProfile() {
  const [customer, setCustomer] =
    useState<CustomerRecord | null>(null);
  const [allCustomers, setAllCustomers] =
    useState<CustomerRecord[]>([]);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryState, setDeliveryState] = useState("MI");
  const [deliveryZip, setDeliveryZip] = useState("");
  const [deliveryInstructions, setDeliveryInstructions] =
    useState("");
  const [
    preferredDeliveryOption,
    setPreferredDeliveryOption,
  ] = useState("Delivery");

  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] =
    useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void loadCustomer();
    }, [])
  );

  async function loadCustomer() {
    try {
      setLoading(true);

      const currentRaw =
        (await AsyncStorage.getItem("currentCustomer")) ||
        (await AsyncStorage.getItem(
          "farm2homeCurrentCustomer"
        )) ||
        (await AsyncStorage.getItem("currentUser"));

      const savedCustomers =
        await AsyncStorage.getItem("farm2homeCustomers");

      let safeCustomers: CustomerRecord[] = [];

      if (savedCustomers) {
        try {
          const parsed = JSON.parse(savedCustomers);
          safeCustomers = Array.isArray(parsed) ? parsed : [];
        } catch {
          safeCustomers = [];
        }
      }

      setAllCustomers(safeCustomers);

      let current: CustomerRecord | null = null;

      if (currentRaw) {
        try {
          current = JSON.parse(currentRaw);
        } catch {
          current = null;
        }
      }

      if (!current && safeCustomers.length > 0) {
        current =
          safeCustomers[safeCustomers.length - 1] || null;
      }

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) {
        console.log(
          "Customer auth lookup:",
          authError.message
        );
      }

      const authId = clean(authData?.user?.id);
      const authEmail = normalize(
        authData?.user?.email || current?.email
      );

      if (
        !current?.id &&
        !current?.customer_id &&
        !current?.email &&
        !authId &&
        !authEmail
      ) {
        router.replace("/customer/login" as any);
        return;
      }

      let dbCustomer: any = null;
      let profile: any = null;

      const lookupId = clean(
        current?.id ||
          current?.customer_id ||
          current?.customerId ||
          authId
      );

      const lookupEmail = normalize(
        current?.email ||
          current?.customer_email ||
          authEmail
      );

      if (lookupId) {
        try {
          const { data, error } = await supabase
            .from("customers")
            .select("*")
            .or(
              `id.eq.${lookupId},customer_id.eq.${lookupId},auth_user_id.eq.${lookupId},profile_id.eq.${lookupId}`
            )
            .limit(1);

          if (!error && Array.isArray(data) && data[0]) {
            dbCustomer = data[0];
          }
        } catch (error) {
          console.log(
            "Customer ID lookup skipped:",
            error
          );
        }
      }

      if (!dbCustomer && lookupEmail) {
        try {
          const { data, error } = await supabase
            .from("customers")
            .select("*")
            .or(
              `email.eq.${lookupEmail},customer_email.eq.${lookupEmail}`
            )
            .limit(1);

          if (!error && Array.isArray(data) && data[0]) {
            dbCustomer = data[0];
          }
        } catch (error) {
          console.log(
            "Customer email lookup skipped:",
            error
          );
        }
      }

      const profileId = clean(
        dbCustomer?.profile_id ||
          current?.profile_id ||
          current?.profileId ||
          authId
      );

      if (profileId) {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .or(
              `id.eq.${profileId},auth_user_id.eq.${profileId}`
            )
            .limit(1);

          if (!error && Array.isArray(data) && data[0]) {
            profile = data[0];
          }
        } catch (error) {
          console.log(
            "Profile ID lookup skipped:",
            error
          );
        }
      }

      if (!profile && lookupEmail) {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("email", lookupEmail)
            .eq("role", "customer")
            .limit(1);

          if (!error && Array.isArray(data) && data[0]) {
            profile = data[0];
          }
        } catch (error) {
          console.log(
            "Profile email lookup skipped:",
            error
          );
        }
      }

      const customerId =
        clean(
          dbCustomer?.id ||
            dbCustomer?.customer_id ||
            current?.id ||
            current?.customer_id ||
            current?.customerId ||
            authId
        ) || `customer_${Date.now()}`;

      const resolvedAuthId = clean(
        dbCustomer?.auth_user_id ||
          current?.auth_user_id ||
          current?.authUserId ||
          authId
      );

      const resolvedProfileId = clean(
        dbCustomer?.profile_id ||
          current?.profile_id ||
          current?.profileId ||
          profile?.id
      );

      const resolvedAccountId = clean(
        dbCustomer?.account_id ||
          current?.account_id ||
          current?.accountId
      );

      const resolvedName = clean(
        dbCustomer?.full_name ||
          dbCustomer?.name ||
          profile?.full_name ||
          current?.full_name ||
          current?.fullName ||
          current?.name
      );

      const resolvedEmail = normalize(
        dbCustomer?.email ||
          dbCustomer?.customer_email ||
          profile?.email ||
          current?.email ||
          current?.customer_email ||
          lookupEmail
      );

      const accountActive =
        dbCustomer?.account_active ??
        current?.account_active ??
        current?.accountActive ??
        true;

      const customerData: CustomerRecord = {
        ...(current || {}),
        ...(dbCustomer || {}),

        id: customerId,
        customer_id: customerId,
        customerId,

        auth_user_id: resolvedAuthId,
        authUserId: resolvedAuthId,

        profile_id: resolvedProfileId,
        profileId: resolvedProfileId,

        account_id: resolvedAccountId,
        accountId: resolvedAccountId,

        role: "customer",

        full_name: resolvedName,
        fullName: resolvedName,
        name: resolvedName,

        username: clean(
          dbCustomer?.username ||
            profile?.username ||
            current?.username
        ),

        email: resolvedEmail,
        customer_email: resolvedEmail,

        phone: clean(
          dbCustomer?.phone ||
            profile?.phone ||
            current?.phone
        ),

        delivery_address: clean(
          dbCustomer?.delivery_address ||
            current?.delivery_address ||
            current?.deliveryAddress
        ),
        deliveryAddress: clean(
          dbCustomer?.delivery_address ||
            current?.delivery_address ||
            current?.deliveryAddress
        ),

        delivery_city: clean(
          dbCustomer?.delivery_city ||
            current?.delivery_city ||
            current?.deliveryCity
        ),
        deliveryCity: clean(
          dbCustomer?.delivery_city ||
            current?.delivery_city ||
            current?.deliveryCity
        ),

        delivery_state: clean(
          dbCustomer?.delivery_state ||
            current?.delivery_state ||
            current?.deliveryState ||
            "MI"
        ),
        deliveryState: clean(
          dbCustomer?.delivery_state ||
            current?.delivery_state ||
            current?.deliveryState ||
            "MI"
        ),

        delivery_zip: clean(
          dbCustomer?.delivery_zip ||
            current?.delivery_zip ||
            current?.deliveryZip
        ),
        deliveryZip: clean(
          dbCustomer?.delivery_zip ||
            current?.delivery_zip ||
            current?.deliveryZip
        ),

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

        account_active: Boolean(accountActive),
        accountActive: Boolean(accountActive),

        updated_at: nowIso(),
        updatedAt: nowIso(),
      };

      setCustomer(customerData);
      setFullName(getCustomerName(customerData));
      setUsername(clean(customerData.username));
      setEmail(normalize(customerData.email));
      setPhone(clean(customerData.phone));

      setDeliveryAddress(
        clean(
          customerData.delivery_address ||
            customerData.deliveryAddress
        )
      );

      setDeliveryCity(
        clean(
          customerData.delivery_city ||
            customerData.deliveryCity
        )
      );

      setDeliveryState(
        clean(
          customerData.delivery_state ||
            customerData.deliveryState ||
            "MI"
        )
      );

      setDeliveryZip(
        clean(
          customerData.delivery_zip ||
            customerData.deliveryZip
        )
      );

      setDeliveryInstructions(
        clean(
          customerData.delivery_instructions ||
            customerData.deliveryInstructions
        )
      );

      setPreferredDeliveryOption(
        clean(
          customerData.preferred_delivery_option ||
            customerData.preferredDeliveryOption ||
            "Delivery"
        )
      );

      await persistCustomer(
        customerData,
        safeCustomers
      );
    } catch (error) {
      console.log(
        "Customer profile load error:",
        error
      );

      router.replace("/customer/login" as any);
    } finally {
      setLoading(false);
    }
  }

  async function persistCustomer(
    updatedCustomer: CustomerRecord,
    providedCustomers?: CustomerRecord[]
  ) {
    const existing =
      providedCustomers || allCustomers || [];

    const updatedId =
      getCustomerId(updatedCustomer);

    const updatedEmail =
      normalize(updatedCustomer.email);

    const existingIndex = existing.findIndex(
      (item) => {
        const sameId =
          Boolean(updatedId) &&
          getCustomerId(item) === updatedId;

        const sameEmail =
          Boolean(updatedEmail) &&
          normalize(item.email) === updatedEmail;

        return sameId || sameEmail;
      }
    );

    const updatedCustomers = [...existing];

    if (existingIndex >= 0) {
      updatedCustomers[existingIndex] =
        updatedCustomer;
    } else {
      updatedCustomers.push(updatedCustomer);
    }

    await AsyncStorage.multiSet([
      [
        "farm2homeCustomers",
        JSON.stringify(updatedCustomers),
      ],
      [
        "currentCustomer",
        JSON.stringify(updatedCustomer),
      ],
      [
        "farm2homeCurrentCustomer",
        JSON.stringify(updatedCustomer),
      ],
      [
        "currentUser",
        JSON.stringify({
          ...updatedCustomer,
          role: "customer",
        }),
      ],
      ["userRole", "customer"],
      ["currentUserRole", "customer"],
    ]);

    setCustomer(updatedCustomer);
    setAllCustomers(updatedCustomers);
  }

  async function saveProfile() {
    if (!customer) {
      Alert.alert(
        "No Customer",
        "No customer profile was found."
      );
      return;
    }

    if (!clean(fullName)) {
      Alert.alert(
        "Name Required",
        "Please enter your name."
      );
      return;
    }

    const cleanEmail = normalize(email);

    if (
      !cleanEmail ||
      !cleanEmail.includes("@")
    ) {
      Alert.alert(
        "Email Required",
        "Please enter a valid customer email."
      );
      return;
    }

    try {
      setSaving(true);

      const now = nowIso();
      const customerId =
        getCustomerId(customer);
      const profileId =
        getProfileId(customer);

      if (!customerId) {
        throw new Error(
          "Customer ID is missing. Please sign out and sign back in."
        );
      }

      const customerPayload: any = {
        id: customerId,
        customer_id: customerId,

        auth_user_id:
          clean(
            customer.auth_user_id ||
              customer.authUserId
          ) || null,

        profile_id: profileId || null,

        account_id:
          clean(
            customer.account_id ||
              customer.accountId
          ) || null,

        full_name: clean(fullName),
        name: clean(fullName),
        username: clean(username),

        email: cleanEmail,
        customer_email: cleanEmail,

        phone: clean(phone),

        delivery_address:
          clean(deliveryAddress),

        delivery_city:
          clean(deliveryCity),

        delivery_state:
          clean(deliveryState || "MI"),

        delivery_zip:
          clean(deliveryZip),

        delivery_instructions:
          clean(deliveryInstructions),

        preferred_delivery_option:
          clean(
            preferredDeliveryOption ||
              "Delivery"
          ),

        // Customer access is no longer tied to a paid
        // monthly subscription.
        account_active: true,

        role: "customer",
        updated_at: now,
      };

      const { error: customerError } =
        await supabase
          .from("customers")
          .upsert(
            customerPayload,
            { onConflict: "id" }
          );

      if (customerError) {
        throw customerError;
      }

      if (profileId) {
        const { error: profileError } =
          await supabase
            .from("profiles")
            .update({
              full_name: clean(fullName),
              name: clean(fullName),
              username: clean(username),
              email: cleanEmail,
              phone: clean(phone),
              role: "customer",
              updated_at: now,
            })
            .or(
              `id.eq.${profileId},auth_user_id.eq.${profileId}`
            );

        if (profileError) {
          console.log(
            "profiles update skipped:",
            profileError.message
          );
        }
      }

      const updatedCustomer: CustomerRecord = {
        ...customer,
        ...customerPayload,

        customerId,
        profileId,

        accountId: clean(
          customer.account_id ||
            customer.accountId
        ),

        fullName: clean(fullName),

        deliveryAddress:
          clean(deliveryAddress),

        deliveryCity:
          clean(deliveryCity),

        deliveryState:
          clean(deliveryState || "MI"),

        deliveryZip:
          clean(deliveryZip),

        deliveryInstructions:
          clean(deliveryInstructions),

        preferredDeliveryOption:
          clean(
            preferredDeliveryOption ||
              "Delivery"
          ),

        accountActive: true,
        updatedAt: now,
      };

      await persistCustomer(
        updatedCustomer
      );

      Alert.alert(
        "Saved",
        "Customer profile updated successfully."
      );
    } catch (error: any) {
      console.log(
        "Customer profile save error:",
        error
      );

      Alert.alert(
        "Save Error",
        error?.message ||
          "Unable to save profile."
      );
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (!customer) return;

    if (!clean(newPassword)) {
      Alert.alert(
        "New Password Required",
        "Please enter a new password."
      );
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert(
        "Password Too Short",
        "Password must be at least 6 characters."
      );
      return;
    }

    if (
      newPassword !== confirmNewPassword
    ) {
      Alert.alert(
        "Password Mismatch",
        "New passwords do not match."
      );
      return;
    }

    try {
      const { error } =
        await supabase.auth.updateUser({
          password: newPassword,
        });

      if (error) throw error;

      setNewPassword("");
      setConfirmNewPassword("");

      Alert.alert(
        "Password Updated",
        "Your password was changed successfully."
      );
    } catch (error: any) {
      Alert.alert(
        "Password Error",
        error?.message ||
          "Unable to change password."
      );
    }
  }

  function confirmDeleteAccount() {
    if (deleteLoading) return;

    Alert.alert(
      "Permanently Delete Account",
      "This permanently deletes your Farm2Home Direct customer account and personal profile data. This action cannot be undone.",
      [
        {
          text: "Keep Account",
          style: "cancel",
        },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Final Confirmation",
              "Are you absolutely sure? Your Farm2Home Direct account will be permanently deleted and you will be signed out.",
              [
                {
                  text: "Cancel",
                  style: "cancel",
                },
                {
                  text: "Delete Permanently",
                  style: "destructive",
                  onPress: () => {
                    void deleteAccount();
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }

  async function deleteAccount() {
    if (deleteLoading) return;

    try {
      setDeleteLoading(true);

      const {
        data: { session },
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (
        !session?.access_token ||
        !session.user?.id
      ) {
        throw new Error(
          "Your login session has expired. Please sign in again before deleting your account."
        );
      }

      const response = await fetch(
        `${API_BASE_URL}/account/delete`,
        {
          method: "DELETE",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            role: "customer",

            customerId:
              getCustomerId(customer),

            customer_id:
              getCustomerId(customer),

            profileId:
              getProfileId(customer),

            profile_id:
              getProfileId(customer),

            authUserId:
              session.user.id,

            auth_user_id:
              session.user.id,

            email: normalize(
              email ||
                customer?.email ||
                session.user.email
            ),
          }),
        }
      );

      const data =
        await parseApiResponse(response);

      if (
        !response.ok ||
        data?.success === false
      ) {
        throw new Error(
          data?.error ||
            data?.message ||
            "Unable to permanently delete your account."
        );
      }

      try {
        await supabase.auth.signOut();
      } catch {
        // Server may already have deleted the auth user.
      }

      await AsyncStorage.multiRemove([
        "currentCustomer",
        "farm2homeCurrentCustomer",
        "currentUser",
        "userRole",
        "currentUserRole",
        "pendingCustomerSubscription",
        "customerSubscriptionStatus",
        "farm2homeCart",
        "cart",
      ]);

      try {
        const savedCustomers =
          await AsyncStorage.getItem(
            "farm2homeCustomers"
          );

        const parsedCustomers =
          savedCustomers
            ? JSON.parse(savedCustomers)
            : [];

        const customerId =
          getCustomerId(customer);

        const customerEmail =
          normalize(
            email || customer?.email
          );

        const remainingCustomers =
          Array.isArray(parsedCustomers)
            ? parsedCustomers.filter(
                (item: CustomerRecord) => {
                  const sameId =
                    Boolean(customerId) &&
                    getCustomerId(item) ===
                      customerId;

                  const sameEmail =
                    Boolean(customerEmail) &&
                    normalize(item?.email) ===
                      customerEmail;

                  return !sameId && !sameEmail;
                }
              )
            : [];

        if (
          remainingCustomers.length > 0
        ) {
          await AsyncStorage.setItem(
            "farm2homeCustomers",
            JSON.stringify(
              remainingCustomers
            )
          );
        } else {
          await AsyncStorage.removeItem(
            "farm2homeCustomers"
          );
        }
      } catch (localError) {
        console.log(
          "Local customer cleanup skipped:",
          localError
        );
      }

      Alert.alert(
        "Account Deleted",
        "Your Farm2Home Direct customer account has been permanently deleted.",
        [
          {
            text: "OK",
            onPress: () =>
              router.replace("/" as any),
          },
        ]
      );
    } catch (error: any) {
      console.log(
        "Customer account deletion error:",
        error
      );

      Alert.alert(
        "Delete Account Error",
        error?.message ||
          "Farm2Home Direct could not permanently delete your account. Please try again."
      );
    } finally {
      setDeleteLoading(false);
    }
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
      "customerSubscriptionStatus",
    ]);

    router.replace(
      "/customer/login" as any
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={COLORS.black}
        />

        <View style={styles.center}>
          <ActivityIndicator
            color={COLORS.red}
            size="large"
          />

          <Text style={styles.centerText}>
            Loading customer profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!customer) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyPage}>
          <View style={styles.emptyIconBox}>
            <Text style={styles.emptyIconText}>
              C
            </Text>
          </View>

          <Text style={styles.emptyTitle}>
            Customer Profile
          </Text>

          <Text style={styles.emptyText}>
            No customer profile found.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
            onPress={() =>
              router.replace(
                "/customer/login" as any
              )
            }
          >
            <Text style={styles.buttonText}>
              Go to Customer Login
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const active =
    customer.account_active !== false &&
    customer.accountActive !== false;

  const accountId =
    clean(
      customer.account_id ||
        customer.accountId
    ) || "Not assigned";

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.black}
      />

      <KeyboardAvoidingView
        style={styles.safe}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            styles.content
          }
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() =>
                router.push(
                  "/customer/dashboard" as any
                )
              }
              activeOpacity={0.9}
            >
              <Ionicons
                name="arrow-back-outline"
                size={18}
                color={COLORS.white}
              />
              <Text
                style={styles.backButtonText}
              >
                Dashboard
              </Text>
            </TouchableOpacity>

            <View style={styles.heroIcon}>
              <Text style={styles.heroInitial}>
                {(fullName ||
                  username ||
                  "C")
                  .slice(0, 1)
                  .toUpperCase()}
              </Text>
            </View>

            <Text style={styles.kicker}>
              Customer Account
            </Text>

            <Text style={styles.heroTitle}>
              {fullName ||
                "Farm2Home Customer"}
            </Text>

            <Text style={styles.heroText}>
              {email ||
                "No email saved"}
            </Text>

            <View
              style={[
                styles.statusPill,
                active
                  ? styles.activePill
                  : styles.pendingPill,
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  active
                    ? styles.activeText
                    : styles.pendingText,
                ]}
              >
                {active
                  ? "Active Customer"
                  : "Inactive Customer"}
              </Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <StatCard
              label="Service Fee"
              value={`$${CUSTOMER_SERVICE_FEE.toFixed(
                2
              )}`}
              tone="green"
            />

            <StatCard
              label="Role"
              value="Customer"
              tone="blue"
            />

            <StatCard
              label="Account"
              value={
                active
                  ? "Active"
                  : "Inactive"
              }
              tone="red"
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Customer Pricing
            </Text>

            <InfoLine
              label="Monthly Membership"
              value="$0.00"
            />

            <InfoLine
              label="Transaction Service Fee"
              value="$4.99"
            />

            <InfoLine
              label="Percentage Service Fee"
              value="0%"
            />

            <InfoLine
              label="Account ID"
              value={accountId}
            />

            <InfoLine
              label="Customer ID"
              value={
                getCustomerId(customer) ||
                "Not created"
              }
            />

            <View style={styles.pricingNotice}>
              <Ionicons
                name="information-circle-outline"
                size={22}
                color={COLORS.greenDark}
              />

              <Text
                style={
                  styles.pricingNoticeText
                }
              >
                No monthly membership is
                required. Farm2Home Direct
                adds one $4.99 service fee to
                each completed customer
                checkout transaction.
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Profile Information
            </Text>

            <Label text="Full Name" />

            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Full name"
              placeholderTextColor="#ADB5BD"
            />

            <Label text="Username" />

            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Username"
              placeholderTextColor="#ADB5BD"
              autoCapitalize="none"
            />

            <Label text="Email" />

            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="#ADB5BD"
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Label text="Phone" />

            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone"
              placeholderTextColor="#ADB5BD"
              keyboardType="phone-pad"
            />

            <TouchableOpacity
              style={[
                styles.primaryButton,
                saving &&
                  styles.disabledButton,
              ]}
              onPress={() => {
                void saveProfile();
              }}
              disabled={saving}
              activeOpacity={0.9}
            >
              {saving ? (
                <ActivityIndicator
                  color={COLORS.white}
                />
              ) : (
                <>
                  <Ionicons
                    name="save-outline"
                    size={19}
                    color={COLORS.white}
                  />

                  <Text
                    style={styles.buttonText}
                  >
                    Save Customer Profile
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Default Delivery Settings
            </Text>

            <View style={styles.optionRow}>
              {[
                "Delivery",
                "Pickup",
              ].map((option) => {
                const selected =
                  preferredDeliveryOption ===
                  option;

                return (
                  <Pressable
                    key={option}
                    style={[
                      styles.optionChip,
                      selected &&
                        styles.optionChipActive,
                    ]}
                    onPress={() =>
                      setPreferredDeliveryOption(
                        option
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.optionText,
                        selected &&
                          styles.optionTextActive,
                      ]}
                    >
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
              onChangeText={
                setDeliveryAddress
              }
              placeholder="Delivery address"
              placeholderTextColor="#ADB5BD"
            />

            <View style={styles.inputRow}>
              <View style={{ flex: 1 }}>
                <Label text="City" />

                <TextInput
                  style={styles.input}
                  value={deliveryCity}
                  onChangeText={
                    setDeliveryCity
                  }
                  placeholder="City"
                  placeholderTextColor="#ADB5BD"
                />
              </View>

              <View style={styles.stateBox}>
                <Label text="State" />

                <TextInput
                  style={styles.input}
                  value={deliveryState}
                  onChangeText={
                    setDeliveryState
                  }
                  placeholder="MI"
                  placeholderTextColor="#ADB5BD"
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
              placeholderTextColor="#ADB5BD"
              keyboardType="numeric"
            />

            <Label text="Delivery Instructions" />

            <TextInput
              style={[
                styles.input,
                styles.textArea,
              ]}
              value={deliveryInstructions}
              onChangeText={
                setDeliveryInstructions
              }
              placeholder="Gate code, porch notes, apartment number, preferred drop-off..."
              placeholderTextColor="#ADB5BD"
              multiline
            />

            <TouchableOpacity
              style={[
                styles.primaryButton,
                saving &&
                  styles.disabledButton,
              ]}
              onPress={() => {
                void saveProfile();
              }}
              disabled={saving}
              activeOpacity={0.9}
            >
              {saving ? (
                <ActivityIndicator
                  color={COLORS.white}
                />
              ) : (
                <>
                  <Ionicons
                    name="save-outline"
                    size={19}
                    color={COLORS.white}
                  />

                  <Text
                    style={styles.buttonText}
                  >
                    Save Delivery Settings
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Change Password
            </Text>

            <TextInput
              style={styles.input}
              placeholder="New password"
              placeholderTextColor="#ADB5BD"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />

            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              placeholderTextColor="#ADB5BD"
              value={confirmNewPassword}
              onChangeText={
                setConfirmNewPassword
              }
              secureTextEntry
            />

            <TouchableOpacity
              style={styles.blueButton}
              onPress={() => {
                void changePassword();
              }}
              activeOpacity={0.9}
            >
              <Ionicons
                name="lock-closed-outline"
                size={19}
                color={COLORS.white}
              />

              <Text style={styles.buttonText}>
                Change Password
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Quick Actions
            </Text>

            <RouteRow
              title="Marketplace"
              subtitle="Shop local farm goods"
              path="/customer/marketplace"
              icon="storefront-outline"
            />

            <RouteRow
              title="Cart"
              subtitle="Review saved cart items"
              path="/customer/cart"
              icon="cart-outline"
            />

            <RouteRow
              title="My Orders"
              subtitle="View confirmed orders and tracking"
              path="/customer/my-orders"
              icon="receipt-outline"
            />

            <RouteRow
              title="Notifications"
              subtitle="Order, farmer, and driver alerts"
              path="/customer/notifications"
              icon="notifications-outline"
            />

            <RouteRow
              title="Favorites"
              subtitle="Saved farms and products"
              path="/customer/favorites"
              icon="heart-outline"
            />

            <RouteRow
              title="Support"
              subtitle="Get help with orders or payment"
              path="/customer/support"
              icon="help-buoy-outline"
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Privacy & Account
            </Text>

            <RouteRow
              title="Privacy Policy"
              subtitle="Review how Farm2Home Direct collects, uses, and protects your information"
              path="/legal/privacy"
              icon="shield-checkmark-outline"
            />

            <Pressable
              style={({ pressed }) => [
                styles.deleteAccountRow,
                pressed && styles.pressed,
              ]}
              onPress={
                confirmDeleteAccount
              }
              disabled={deleteLoading}
            >
              <View
                style={
                  styles.deleteAccountIconBox
                }
              >
                {deleteLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={COLORS.danger}
                  />
                ) : (
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={COLORS.danger}
                  />
                )}
              </View>

              <View
                style={
                  styles.actionTextBlock
                }
              >
                <Text
                  style={
                    styles.deleteAccountTitle
                  }
                >
                  Delete Account
                </Text>

                <Text
                  style={
                    styles.actionSubtitle
                  }
                >
                  Permanently delete your
                  Farm2Home Direct account
                  and personal profile data
                </Text>
              </View>

              <Ionicons
                name="chevron-forward-outline"
                size={20}
                color={COLORS.danger}
              />
            </Pressable>
          </View>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() => {
              void logout();
            }}
            activeOpacity={0.9}
          >
            <Ionicons
              name="log-out-outline"
              size={19}
              color={COLORS.white}
            />

            <Text style={styles.buttonText}>
              Logout
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Label({
  text,
}: {
  text: string;
}) {
  return (
    <Text style={styles.label}>
      {text}
    </Text>
  );
}

function InfoLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>
        {label}
      </Text>

      <Text
        style={styles.infoValue}
        numberOfLines={1}
      >
        {value}
      </Text>
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
    green: {
      bg: COLORS.greenSoft,
      color: COLORS.greenDark,
    },
    blue: {
      bg: COLORS.blueSoft,
      color: COLORS.blue,
    },
    red: {
      bg: COLORS.dangerSoft,
      color: COLORS.red,
    },
  }[tone];

  return (
    <View style={styles.statCard}>
      <View
        style={[
          styles.statDot,
          {
            backgroundColor:
              config.bg,
          },
        ]}
      >
        <Ionicons
          name="ellipse"
          size={12}
          color={config.color}
        />
      </View>

      <Text style={styles.statValue}>
        {value}
      </Text>

      <Text style={styles.statLabel}>
        {label}
      </Text>
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
      style={({ pressed }) => [
        styles.actionRow,
        pressed && styles.pressed,
      ]}
      onPress={() =>
        router.push(path as any)
      }
    >
      <View style={styles.actionIconBox}>
        <Ionicons
          name={icon}
          size={20}
          color={COLORS.red}
        />
      </View>

      <View style={styles.actionTextBlock}>
        <Text style={styles.actionTitle}>
          {title}
        </Text>

        <Text
          style={styles.actionSubtitle}
        >
          {subtitle}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward-outline"
        size={20}
        color={COLORS.muted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },

  centerText: {
    color: COLORS.muted,
    fontWeight: "800",
  },

  content: {
    paddingBottom: 70,
  },

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

  emptyIconText: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 28,
  },

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

  backButtonText: {
    color: COLORS.white,
    fontWeight: "900",
  },

  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 26,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  heroInitial: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 32,
  },

  kicker: {
    color: "#DDE4FF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  heroTitle: {
    color: COLORS.white,
    fontSize: 34,
    fontWeight: "900",
    marginTop: 6,
  },

  heroText: {
    color: "#EFF2F7",
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 6,
  },

  statusPill: {
    alignSelf: "flex-start",
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },

  activePill: {
    backgroundColor: COLORS.greenSoft,
  },

  pendingPill: {
    backgroundColor: COLORS.amberSoft,
  },

  statusPillText: {
    fontWeight: "900",
  },

  activeText: {
    color: COLORS.greenDark,
  },

  pendingText: {
    color: "#B7791F",
  },

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

  statValue: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 15,
  },

  statLabel: {
    color: COLORS.muted,
    fontWeight: "800",
    marginTop: 4,
    fontSize: 11,
  },

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

  inputRow: {
    flexDirection: "row",
    gap: 10,
  },

  stateBox: {
    width: 95,
  },

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

  pricingNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 14,
    padding: 13,
    borderRadius: 14,
    backgroundColor: COLORS.greenSoft,
  },

  pricingNoticeText: {
    flex: 1,
    color: COLORS.greenDark,
    fontWeight: "800",
    lineHeight: 20,
    fontSize: 12,
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

  disabledButton: {
    opacity: 0.65,
  },

  buttonText: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 15,
  },

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
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },

  actionTextBlock: {
    flex: 1,
  },

  actionTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
  },

  actionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 12,
    marginTop: 3,
  },

  deleteAccountRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.dangerSoft,
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FFD2D2",
    marginBottom: 10,
    gap: 12,
  },

  deleteAccountIconBox: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFD2D2",
  },

  deleteAccountTitle: {
    color: COLORS.danger,
    fontWeight: "900",
    fontSize: 16,
  },

  pressed: {
    opacity: 0.75,
  },
});
