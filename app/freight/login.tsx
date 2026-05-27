import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

import { API_BASE_URL } from "../config/api";
import { supabase } from "../data/supabaseClient";
import freightTheme from "../styles/freightTheme";
import { registerFreightPushNotifications } from "../services/notificationService";

type FreightUser = {
  id: string;
  role: "freight";
  companyName: string;
  email: string;
  username: string;
  password: string;
  securityQuestion1: string;
  securityAnswer1: string;
  securityQuestion2: string;
  securityAnswer2: string;
  securityQuestion3: string;
  securityAnswer3: string;
  accountActive: boolean;
  membershipStatus: string;
  subscriptionStatus?: string;
  approved?: boolean;
  verificationStatus?: string;
  token?: string;
};

const FREIGHT_ARRAY_KEYS = [
  "farm2homeFreightCarriers",
  "farm2homeFreightUsers",
  "freight_carriers",
  "freightUsers",
];

const FREIGHT_OBJECT_KEYS = [
  "currentFreight",
  "currentFreightCarrier",
  "currentFreightUser",
  "currentUser",
  "pendingFreightCarrier",
];

function clean(value: any) {
  return String(value || "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function safelyParse(raw: string | null) {
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function safelyParseArray(rawValue: string | null): any[] {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeAnswer(value: string) {
  return String(value || "").trim().toLowerCase();
}

function mapCarrierToFreightUser(item: any): FreightUser {
  return {
    id: item.id || item.freightId || `freight_${Date.now()}`,
    role: "freight",

    companyName:
      item.companyName ||
      item.company_name ||
      item.businessName ||
      item.name ||
      "Freight Carrier",

    email: normalize(item.email),
    username: normalize(item.username),
    password: clean(item.password),

    securityQuestion1:
      item.securityQuestion1 || item.security_question_1 || "",

    securityAnswer1:
      item.securityAnswer1 || item.security_answer_1 || "",

    securityQuestion2:
      item.securityQuestion2 || item.security_question_2 || "",

    securityAnswer2:
      item.securityAnswer2 || item.security_answer_2 || "",

    securityQuestion3:
      item.securityQuestion3 || item.security_question_3 || "",

    securityAnswer3:
      item.securityAnswer3 || item.security_answer_3 || "",

    accountActive:
      item.accountActive === undefined
        ? item.account_active !== false
        : item.accountActive !== false,

    membershipStatus:
      item.membershipStatus ||
      item.membership_status ||
      "Pending",

    subscriptionStatus:
      item.subscriptionStatus ||
      item.subscription_status ||
      "pending",

    approved:
      item.approved === true ||
      normalize(item.status) === "approved" ||
      normalize(item.verificationStatus) === "approved",

    verificationStatus:
      item.verificationStatus ||
      item.verification_status ||
      "PENDING_VERIFICATION",

    token: item.token,
  };
}

function isFreightActive(user: FreightUser) {
  if (user.accountActive === false) return false;

  const membershipStatus = normalize(user.membershipStatus);
  const subscriptionStatus = normalize(user.subscriptionStatus);

  if (membershipStatus === "canceled") return false;
  if (subscriptionStatus === "canceled") return false;
  if (subscriptionStatus === "past_due") return false;
  if (subscriptionStatus === "unpaid") return false;

  return true;
}

function mergeFreightUsers(records: FreightUser[]) {
  const merged: FreightUser[] = [];

  for (const record of records) {
    const index = merged.findIndex((item) => {
      return (
        item.id === record.id ||
        (record.email && item.email === record.email) ||
        (record.username && item.username === record.username)
      );
    });

    if (index === -1) {
      merged.push(record);
      continue;
    }

    const existing = merged[index];

    merged[index] = {
      ...existing,
      ...record,

      username: record.username || existing.username,
      password: record.password || existing.password,
      email: record.email || existing.email,

      approved: existing.approved || record.approved,
      accountActive:
        existing.accountActive || record.accountActive,
    };
  }

  return merged;
}

export default function FreightLoginScreen() {
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");

  const [loginLoading, setLoginLoading] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  const [forgotVisible, setForgotVisible] = useState(false);
  const [recoveryValue, setRecoveryValue] = useState("");

  const [securityAnswer1, setSecurityAnswer1] = useState("");
  const [securityAnswer2, setSecurityAnswer2] = useState("");
  const [securityAnswer3, setSecurityAnswer3] = useState("");

  const [recoveryUser, setRecoveryUser] =
    useState<FreightUser | null>(null);

  async function saveFreightSession(
    user: FreightUser,
    token?: string
  ) {
    const sessionUser = {
      ...user,
      role: "freight" as const,
      accountActive: user.accountActive !== false,
      membershipStatus: user.membershipStatus || "Pending",
      token: token || user.token,
      updatedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(
      "currentFreight",
      JSON.stringify(sessionUser)
    );

    await AsyncStorage.setItem(
      "currentFreightCarrier",
      JSON.stringify(sessionUser)
    );

    await AsyncStorage.setItem(
      "currentFreightUser",
      JSON.stringify(sessionUser)
    );

    await AsyncStorage.setItem(
      "currentUser",
      JSON.stringify(sessionUser)
    );

    await AsyncStorage.setItem("userRole", "freight");
    await AsyncStorage.setItem("currentUserRole", "freight");

    if (token || user.token) {
      await AsyncStorage.setItem(
        "authToken",
        token || user.token || ""
      );
    }

    for (const key of FREIGHT_ARRAY_KEYS) {
      const existingRaw = await AsyncStorage.getItem(key);

      const existing =
        safelyParseArray(existingRaw).map(mapCarrierToFreightUser);

      const updated = [
        sessionUser,
        ...existing.filter(
          (item) =>
            item.id !== sessionUser.id &&
            item.email !== sessionUser.email &&
            item.username !== sessionUser.username
        ),
      ];

      await AsyncStorage.setItem(
        key,
        JSON.stringify(updated)
      );
    }
  }

  async function registerFreightNotificationsSafely(
    userId: string
  ) {
    try {
      if (!userId) return;

      const pushToken =
        await registerFreightPushNotifications(userId);

      console.log("Freight push token:", pushToken);
    } catch (error) {
      console.log(
        "Freight push registration error:",
        error
      );
    }
  }

  async function tryBackendLogin(
    cleanLogin: string,
    cleanPassword: string
  ) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            login: cleanLogin,
            password: cleanPassword,
            role: "freight",
          }),
        }
      );

      const text = await response.text();

      let data: any = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (!response.ok || !data?.success) {
        return null;
      }

      const backendUser = mapCarrierToFreightUser({
        ...data.user,
        accountActive: true,
        token: data.token,
      });

      return {
        user: backendUser,
        token: data.token,
      };
    } catch (error) {
      console.log("Backend freight login skipped:", error);
      return null;
    }
  }

  async function loadLocalFreightUsers(): Promise<FreightUser[]> {
    const users: FreightUser[] = [];

    for (const key of FREIGHT_OBJECT_KEYS) {
      const parsed = safelyParse(
        await AsyncStorage.getItem(key)
      );

      if (parsed) {
        users.push(mapCarrierToFreightUser(parsed));
      }
    }

    for (const key of FREIGHT_ARRAY_KEYS) {
      const raw = await AsyncStorage.getItem(key);

      const parsed =
        safelyParseArray(raw).map(mapCarrierToFreightUser);

      users.push(...parsed);
    }

    const merged = mergeFreightUsers(users);

    console.log(
      "FREIGHT LOGIN RECORDS:",
      merged.map((item) => ({
        id: item.id,
        email: item.email,
        username: item.username,
        password: item.password,
        active: item.accountActive,
        membershipStatus: item.membershipStatus,
        subscriptionStatus: item.subscriptionStatus,
      }))
    );

    return merged;
  }

  async function findLocalFreightUser(cleanLogin: string) {
    const freightUsers = await loadLocalFreightUsers();

    return (
      freightUsers.find(
        (item) =>
          normalize(item.email) === cleanLogin ||
          normalize(item.username) === cleanLogin
      ) || null
    );
  }

  async function findSupabaseFreightUser(
    cleanLogin: string
  ) {
    try {
      const { data, error } = await supabase
        .from("freight_users")
        .select("*")
        .or(
          `email.eq.${cleanLogin},username.eq.${cleanLogin}`
        )
        .maybeSingle();

      if (error) {
        console.log(
          "Supabase freight lookup skipped:",
          error.message
        );

        return null;
      }

      return data
        ? mapCarrierToFreightUser(data)
        : null;
    } catch (error) {
      console.log(
        "Supabase freight lookup failed:",
        error
      );

      return null;
    }
  }

  async function findFreightUser(cleanLogin: string) {
    let foundUser =
      await findLocalFreightUser(cleanLogin);

    if (!foundUser) {
      foundUser =
        await findSupabaseFreightUser(cleanLogin);
    }

    return foundUser;
  }

  async function handleLogin() {
    const cleanLogin = normalize(loginValue);
    const cleanPassword = clean(password);

    if (!cleanLogin || !cleanPassword) {
      Alert.alert(
        "Missing Information",
        "Enter username/email and password."
      );
      return;
    }

    try {
      setLoginLoading(true);

      const backendLogin = await tryBackendLogin(
        cleanLogin,
        cleanPassword
      );

      if (backendLogin?.user) {
        if (!isFreightActive(backendLogin.user)) {
          Alert.alert(
            "Account Not Active",
            "Your freight account is not active."
          );
          return;
        }

        await saveFreightSession(
          backendLogin.user,
          backendLogin.token
        );

        await registerFreightNotificationsSafely(
          backendLogin.user.id
        );

        router.replace("/freight/dashboard" as any);
        return;
      }

      const foundUser =
        await findFreightUser(cleanLogin);

      if (!foundUser) {
        Alert.alert(
          "Account Not Found",
          "No freight account found."
        );

        return;
      }

      if (!isFreightActive(foundUser)) {
        Alert.alert(
          "Account Not Active",
          "Your freight account is not active."
        );

        return;
      }

      const storedPassword = clean(foundUser.password);
      const enteredPassword = clean(cleanPassword);

      const passwordMatch =
        storedPassword === enteredPassword;

      console.log("FREIGHT LOGIN CHECK", {
        storedUsername: foundUser.username,
        enteredUsername: cleanLogin,
        storedPassword,
        enteredPassword,
        passwordMatch,
      });

      if (!passwordMatch) {
        Alert.alert(
          "Login Failed",
          "Invalid freight login credentials."
        );

        return;
      }

      await saveFreightSession(foundUser);

      await registerFreightNotificationsSafely(
        foundUser.id
      );

      router.replace("/freight/dashboard" as any);
    } catch (error) {
      console.log("Freight login error:", error);

      Alert.alert(
        "Login Error",
        "Unable to login to freight account."
      );
    } finally {
      setLoginLoading(false);
    }
  }

  async function startRecovery() {
    const cleanValue = normalize(recoveryValue);

    if (!cleanValue) {
      Alert.alert(
        "Missing Information",
        "Enter username or email."
      );

      return;
    }

    try {
      setRecoveryLoading(true);

      const foundUser =
        await findFreightUser(cleanValue);

      if (!foundUser) {
        Alert.alert(
          "Account Not Found",
          "No freight account found."
        );

        return;
      }

      if (!foundUser.accountActive) {
        Alert.alert(
          "Account Not Active",
          "Your freight account is not active."
        );

        return;
      }

      setRecoveryUser(foundUser);

      setSecurityAnswer1("");
      setSecurityAnswer2("");
      setSecurityAnswer3("");
    } catch (error) {
      console.log("Recovery lookup error:", error);

      Alert.alert(
        "Recovery Error",
        "Unable to load recovery information."
      );
    } finally {
      setRecoveryLoading(false);
    }
  }

  async function verifyRecovery() {
    if (!recoveryUser) return;

    const valid1 =
      normalizeAnswer(securityAnswer1) ===
      normalizeAnswer(recoveryUser.securityAnswer1);

    const valid2 =
      normalizeAnswer(securityAnswer2) ===
      normalizeAnswer(recoveryUser.securityAnswer2);

    const valid3 =
      normalizeAnswer(securityAnswer3) ===
      normalizeAnswer(recoveryUser.securityAnswer3);

    if (!valid1 || !valid2 || !valid3) {
      Alert.alert(
        "Verification Failed",
        "Security answers do not match."
      );

      return;
    }

    Alert.alert(
      "Account Verified",
      `Username: ${recoveryUser.username}\nPassword: ${recoveryUser.password}`
    );

    setForgotVisible(false);
    setRecoveryUser(null);
    setRecoveryValue("");
  }

  return (
    <View style={styles.container}>
      <View style={styles.loginCard}>
        <Text style={styles.title}>
          Freight Connect Login
        </Text>

        <Text style={styles.subtitle}>
          Access livestock and refrigerated fresh food
          freight loads.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Username or Email"
          placeholderTextColor={
            freightTheme.colors.mutedText
          }
          autoCapitalize="none"
          autoCorrect={false}
          value={loginValue}
          onChangeText={setLoginValue}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={
            freightTheme.colors.mutedText
          }
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={[
            styles.loginButton,
            loginLoading && styles.disabledButton,
          ]}
          onPress={handleLogin}
          disabled={loginLoading}
        >
          {loginLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.loginButtonText}>
              Login
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.forgotButton}
          onPress={() => setForgotVisible(true)}
        >
          <Text style={styles.forgotText}>
            Forgot Username or Password?
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.registerButton}
          onPress={() =>
            router.push("/freight/register" as any)
          }
        >
          <Text style={styles.registerText}>
            Register for Freight Connect
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={forgotVisible}
        transparent
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.modalTitle}>
                Freight Account Recovery
              </Text>

              {!recoveryUser ? (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Username or Email"
                    placeholderTextColor={
                      freightTheme.colors.mutedText
                    }
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={recoveryValue}
                    onChangeText={setRecoveryValue}
                  />

                  <TouchableOpacity
                    style={[
                      styles.loginButton,
                      recoveryLoading &&
                        styles.disabledButton,
                    ]}
                    onPress={startRecovery}
                    disabled={recoveryLoading}
                  >
                    {recoveryLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text
                        style={styles.loginButtonText}
                      >
                        Continue
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.securityQuestion}>
                    {recoveryUser.securityQuestion1}
                  </Text>

                  <TextInput
                    style={styles.input}
                    placeholder="Answer"
                    secureTextEntry
                    value={securityAnswer1}
                    onChangeText={setSecurityAnswer1}
                  />

                  <Text style={styles.securityQuestion}>
                    {recoveryUser.securityQuestion2}
                  </Text>

                  <TextInput
                    style={styles.input}
                    placeholder="Answer"
                    secureTextEntry
                    value={securityAnswer2}
                    onChangeText={setSecurityAnswer2}
                  />

                  <Text style={styles.securityQuestion}>
                    {recoveryUser.securityQuestion3}
                  </Text>

                  <TextInput
                    style={styles.input}
                    placeholder="Answer"
                    secureTextEntry
                    value={securityAnswer3}
                    onChangeText={setSecurityAnswer3}
                  />

                  <TouchableOpacity
                    style={styles.loginButton}
                    onPress={verifyRecovery}
                  >
                    <Text
                      style={styles.loginButtonText}
                    >
                      Verify Account
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setForgotVisible(false);
                  setRecoveryUser(null);
                  setRecoveryValue("");
                  setSecurityAnswer1("");
                  setSecurityAnswer2("");
                  setSecurityAnswer3("");
                }}
              >
                <Text style={styles.closeText}>
                  Close
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor:
      freightTheme.colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  loginCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: freightTheme.colors.card,
    borderRadius: 28,
    padding: 28,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    ...freightTheme.shadow,
  },

  title: {
    color: freightTheme.colors.text,
    fontSize: 34,
    fontWeight: "900",
    textAlign: "center",
  },

  subtitle: {
    color: freightTheme.colors.mutedText,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 28,
    lineHeight: 22,
    fontWeight: "700",
  },

  input: {
    backgroundColor: freightTheme.colors.surface,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: freightTheme.colors.text,
    fontWeight: "700",
    marginBottom: 16,
  },

  loginButton: {
    backgroundColor: freightTheme.colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 6,
  },

  disabledButton: {
    opacity: 0.6,
  },

  loginButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },

  forgotButton: {
    alignItems: "center",
    marginTop: 16,
  },

  forgotText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },

  registerButton: {
    alignItems: "center",
    marginTop: 18,
  },

  registerText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 22,
  },

  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 22,
    maxHeight: "90%",
  },

  modalTitle: {
    color: freightTheme.colors.text,
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 18,
    textAlign: "center",
  },

  securityQuestion: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    marginBottom: 8,
    marginTop: 10,
  },

  closeButton: {
    marginTop: 16,
    alignItems: "center",
  },

  closeText: {
    color: "#B91C1C",
    fontWeight: "900",
  },
});