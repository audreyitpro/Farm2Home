import React, { useState } from "react";
import {
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

import freightTheme from "../styles/freightTheme";
import { supabase } from "../data/supabaseClient";

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your mother’s maiden name?",
  "What was the name of your elementary school?",
  "What was your first car?",
  "What is your favorite food?",
  "What is your favorite truck brand?",
  "What was the name of your childhood best friend?",
  "What street did you grow up on?",
  "What is your favorite teacher’s name?",
];

type FreightUser = {
  id: string;
  companyName: string;
  email: string;
  username?: string;
  password?: string;

  securityQuestion1?: string;
  securityAnswer1?: string;

  securityQuestion2?: string;
  securityAnswer2?: string;

  securityQuestion3?: string;
  securityAnswer3?: string;

  accountActive?: boolean;

  role: "freight";
  membershipStatus: string;
};

function safelyParseArray(rawValue: string | null): FreightUser[] {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.log("Freight parse error:", error);
    return [];
  }
}

function normalizeAnswer(value: string) {
  return value.trim().toLowerCase();
}

export default function FreightLoginScreen() {
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");

  const [forgotVisible, setForgotVisible] = useState(false);

  const [recoveryValue, setRecoveryValue] = useState("");

  const [securityAnswer1, setSecurityAnswer1] = useState("");
  const [securityAnswer2, setSecurityAnswer2] = useState("");
  const [securityAnswer3, setSecurityAnswer3] = useState("");

  const [recoveryUser, setRecoveryUser] = useState<FreightUser | null>(null);

  async function loadFreightUsers(): Promise<FreightUser[]> {
    const raw = await AsyncStorage.getItem("farm2homeFreightUsers");
    return safelyParseArray(raw);
  }

  async function handleLogin() {
    const cleanLogin = loginValue.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanLogin || !cleanPassword) {
      Alert.alert(
        "Missing Information",
        "Enter username/email and password."
      );
      return;
    }

    if (
      (cleanLogin === "freight@test.com" ||
        cleanLogin === "freighttest") &&
      cleanPassword === "freight123"
    ) {
      const freightUser: FreightUser = {
        id: "freight_test_001",
        companyName: "ASO Freight LLC",
        email: "freight@test.com",
        username: "freighttest",
        password: "freight123",
        accountActive: true,
        role: "freight",
        membershipStatus: "Active",
      };

      await AsyncStorage.setItem(
        "currentFreight",
        JSON.stringify(freightUser)
      );

      router.replace("/freight/dashboard");

      return;
    }

    try {
      const freightUsers = await loadFreightUsers();

      let foundUser =
        freightUsers.find(
          (item) =>
            item.email.toLowerCase() === cleanLogin ||
            String(item.username || "").toLowerCase() === cleanLogin
        ) || null;

      if (!foundUser) {
        try {
          const { data, error } = await supabase
            .from("freight_users")
            .select("*")
            .or(
              `email.eq.${cleanLogin},username.eq.${cleanLogin}`
            )
            .limit(1)
            .single();

          if (!error && data) {
            foundUser = {
              id: data.id,
              companyName: data.company_name,
              email: data.email,
              username: data.username,
              password: data.password,
              securityQuestion1: data.security_question_1,
              securityAnswer1: data.security_answer_1,
              securityQuestion2: data.security_question_2,
              securityAnswer2: data.security_answer_2,
              securityQuestion3: data.security_question_3,
              securityAnswer3: data.security_answer_3,
              accountActive: data.account_active,
              role: "freight",
              membershipStatus:
                data.membership_status || "Active",
            };
          }
        } catch (error) {
          console.log("Supabase freight login skipped:", error);
        }
      }

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

      if (String(foundUser.password || "") !== cleanPassword) {
        Alert.alert(
          "Login Failed",
          "Invalid freight login credentials."
        );
        return;
      }

      await AsyncStorage.setItem(
        "currentFreight",
        JSON.stringify(foundUser)
      );

      Alert.alert(
        "Login Successful",
        `Welcome ${foundUser.companyName}`
      );

      router.replace("/freight/dashboard");
    } catch (error) {
      console.log("Freight login error:", error);

      Alert.alert(
        "Login Error",
        "Unable to login to freight account."
      );
    }
  }

  async function startRecovery() {
    const cleanValue = recoveryValue.trim().toLowerCase();

    if (!cleanValue) {
      Alert.alert(
        "Missing Information",
        "Enter username or email."
      );
      return;
    }

    try {
      const freightUsers = await loadFreightUsers();

      let foundUser =
        freightUsers.find(
          (item) =>
            item.email.toLowerCase() === cleanValue ||
            String(item.username || "").toLowerCase() === cleanValue
        ) || null;

      if (!foundUser) {
        try {
          const { data, error } = await supabase
            .from("freight_users")
            .select("*")
            .or(
              `email.eq.${cleanValue},username.eq.${cleanValue}`
            )
            .limit(1)
            .single();

          if (!error && data) {
            foundUser = {
              id: data.id,
              companyName: data.company_name,
              email: data.email,
              username: data.username,
              password: data.password,
              securityQuestion1: data.security_question_1,
              securityAnswer1: data.security_answer_1,
              securityQuestion2: data.security_question_2,
              securityAnswer2: data.security_answer_2,
              securityQuestion3: data.security_question_3,
              securityAnswer3: data.security_answer_3,
              accountActive: data.account_active,
              role: "freight",
              membershipStatus:
                data.membership_status || "Active",
            };
          }
        } catch (error) {
          console.log("Supabase freight recovery skipped:", error);
        }
      }

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
    } catch (error) {
      console.log("Recovery lookup error:", error);

      Alert.alert(
        "Recovery Error",
        "Unable to load recovery information."
      );
    }
  }

  async function verifyRecovery() {
    if (!recoveryUser) return;

    const valid1 =
      normalizeAnswer(securityAnswer1) ===
      normalizeAnswer(recoveryUser.securityAnswer1 || "");

    const valid2 =
      normalizeAnswer(securityAnswer2) ===
      normalizeAnswer(recoveryUser.securityAnswer2 || "");

    const valid3 =
      normalizeAnswer(securityAnswer3) ===
      normalizeAnswer(recoveryUser.securityAnswer3 || "");

    if (!valid1 || !valid2 || !valid3) {
      Alert.alert(
        "Verification Failed",
        "Security answers do not match."
      );
      return;
    }

    Alert.alert(
      "Freight Account Recovery",
      `Username: ${recoveryUser.username}\nPassword: ${recoveryUser.password}\n\nProduction version should send reset email instead of displaying password.`
    );

    setForgotVisible(false);

    setRecoveryUser(null);

    setRecoveryValue("");
    setSecurityAnswer1("");
    setSecurityAnswer2("");
    setSecurityAnswer3("");
  }

  function openRegister() {
    router.push("/freight/register");
  }

  return (
    <View style={styles.container}>
      <View style={styles.loginCard}>
        <Text style={styles.title}>Freight Connect Login</Text>

        <Text style={styles.subtitle}>
          Access livestock and refrigerated fresh food loads.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Username or Email"
          placeholderTextColor={freightTheme.colors.mutedText}
          autoCapitalize="none"
          value={loginValue}
          onChangeText={setLoginValue}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={freightTheme.colors.mutedText}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={styles.loginButton}
          onPress={handleLogin}
        >
          <Text style={styles.loginButtonText}>Login</Text>
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
          onPress={openRegister}
        >
          <Text style={styles.registerText}>
            Register for Freight Connect
          </Text>
        </TouchableOpacity>

        <View style={styles.testCard}>
          <Text style={styles.testTitle}>
            Development Test Login
          </Text>

          <Text style={styles.testText}>
            Username: freighttest
          </Text>

          <Text style={styles.testText}>
            Email: freight@test.com
          </Text>

          <Text style={styles.testText}>
            Password: freight123
          </Text>
        </View>
      </View>

      <Modal
        visible={forgotVisible}
        transparent
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView>
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
                    value={recoveryValue}
                    onChangeText={setRecoveryValue}
                  />

                  <TouchableOpacity
                    style={styles.loginButton}
                    onPress={startRecovery}
                  >
                    <Text style={styles.loginButtonText}>
                      Continue
                    </Text>
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
                    <Text style={styles.loginButtonText}>
                      Recover Account
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setForgotVisible(false);
                  setRecoveryUser(null);
                }}
              >
                <Text style={styles.closeText}>Close</Text>
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
    backgroundColor: freightTheme.colors.background,
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

  testCard: {
    marginTop: 28,
    backgroundColor: freightTheme.colors.rowDark,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },

  testTitle: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
    marginBottom: 10,
    textTransform: "uppercase",
    fontSize: 12,
  },

  testText: {
    color: freightTheme.colors.text,
    fontWeight: "700",
    marginBottom: 4,
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