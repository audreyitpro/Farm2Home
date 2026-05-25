import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

import { supabase } from "../data/supabaseClient";

import {
  authenticateFarmer,
  getFarmerByUsername,
  verifyFarmerSecurityQuestions,
} from "../data/farmerStore";

type FarmerAccount = {
  id: string;
  farmerId?: string;
  username?: string;
  password?: string;
  email?: string;
  businessName?: string;
  farmName?: string;
  ownerName?: string;
  state?: string;
  complianceStatus?: string;
  approved?: boolean;
  accountActive?: boolean;
  farmerMembershipPaid?: boolean;
  applicationFeePaid?: boolean;
  farmerActivationPaid?: boolean;
  activationFeePaid?: boolean;
  farmerMonthlySubscriptionPaid?: boolean;
  securityQuestion1?: string;
  securityAnswer1?: string;
  securityQuestion2?: string;
  securityAnswer2?: string;
  securityQuestion3?: string;
  securityAnswer3?: string;
};

function normalizeText(value: string) {
  return String(value || "").trim().toLowerCase();
}

function normalizeAnswer(value: string) {
  return String(value || "").trim().toLowerCase();
}

function mapSupabaseFarmer(row: any): FarmerAccount {
  return {
    id: String(row.id || row.farmer_id || ""),
    farmerId: String(row.id || row.farmer_id || ""),
    username: row.username || "",
    password: row.password || "",
    email: row.email || "",
    businessName: row.business_name || row.farm_name || "",
    farmName: row.farm_name || row.business_name || "",
    ownerName: row.owner_name || "",
    state: row.state || "MI",
    complianceStatus: row.compliance_status || "in_progress",
    approved: Boolean(row.approved),
    accountActive: Boolean(row.account_active),
    farmerMembershipPaid: Boolean(row.farmer_membership_paid),
    applicationFeePaid: Boolean(row.application_fee_paid),
    farmerActivationPaid: Boolean(row.farmer_activation_paid),
    activationFeePaid: Boolean(row.farmer_activation_paid),
    farmerMonthlySubscriptionPaid: Boolean(row.farmer_monthly_subscription_paid),
    securityQuestion1: row.security_question_1 || "",
    securityAnswer1: row.security_answer_1 || "",
    securityQuestion2: row.security_question_2 || "",
    securityAnswer2: row.security_answer_2 || "",
    securityQuestion3: row.security_question_3 || "",
    securityAnswer3: row.security_answer_3 || "",
  };
}

async function findFarmerInSupabase(
  loginValue: string,
  passwordValue?: string
): Promise<FarmerAccount | null> {
  try {
    const cleanLogin = normalizeText(loginValue);
    const cleanPassword = String(passwordValue || "").trim();

    let result;

    if (passwordValue !== undefined) {
      result = await supabase
        .from("farmers")
        .select("*")
        .or(`username.eq.${cleanLogin},email.eq.${cleanLogin}`)
        .eq("password", cleanPassword)
        .limit(1)
        .maybeSingle();
    } else {
      result = await supabase
        .from("farmers")
        .select("*")
        .or(`username.eq.${cleanLogin},email.eq.${cleanLogin}`)
        .limit(1)
        .maybeSingle();
    }

    const { data, error } = result;

    if (error) {
      console.log("SUPABASE FARMER LOGIN ERROR:", error.message);
      return null;
    }

    return data ? mapSupabaseFarmer(data) : null;
  } catch (error) {
    console.log("SUPABASE FARMER LOOKUP FAILED:", error);
    return null;
  }
}

async function saveFarmerSession(farmer: FarmerAccount) {
  await AsyncStorage.setItem("currentFarmer", JSON.stringify(farmer));
  await AsyncStorage.setItem("currentUser", JSON.stringify(farmer));
  await AsyncStorage.setItem("userRole", "farmer");
  await AsyncStorage.setItem("currentUserRole", "farmer");
}

function farmerIsApproved(farmer: FarmerAccount) {
  return farmer.complianceStatus === "approved" || farmer.approved === true;
}

function farmerHasActivationAndSubscription(farmer: FarmerAccount) {
  const activationPaid =
    farmer.farmerActivationPaid === true || farmer.activationFeePaid === true;

  const monthlyPaid = farmer.farmerMonthlySubscriptionPaid === true;

  return activationPaid && monthlyPaid;
}

export default function FarmerLoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryUsername, setRecoveryUsername] = useState("");
  const [recoveryFarmer, setRecoveryFarmer] = useState<FarmerAccount | null>(
    null
  );

  const [answer1, setAnswer1] = useState("");
  const [answer2, setAnswer2] = useState("");
  const [answer3, setAnswer3] = useState("");

  const [loading, setLoading] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  async function loginFarmer() {
    try {
      if (!username.trim() || !password.trim()) {
        Alert.alert("Missing Login", "Please enter username and password.");
        return;
      }

      setLoading(true);

      const cleanUsername = normalizeText(username);
      const cleanPassword = password.trim();

      const supabaseFarmer = await findFarmerInSupabase(
        cleanUsername,
        cleanPassword
      );

      const localFarmer = supabaseFarmer
        ? null
        : await authenticateFarmer(cleanUsername, cleanPassword);

      const farmer = (supabaseFarmer || localFarmer) as FarmerAccount | null;

      if (!farmer) {
        Alert.alert(
          "Login Failed",
          "Username or password is incorrect, or this farmer account was not saved."
        );
        return;
      }

      await saveFarmerSession(farmer);

      const activeFarmerId = farmer.id || farmer.farmerId || "";

      if (!farmerIsApproved(farmer)) {
        router.replace({
          pathname: "/farmer/compliance-upload",
          params: { farmerId: activeFarmerId },
        } as any);
        return;
      }

      if (!farmerHasActivationAndSubscription(farmer)) {
        router.replace({
          pathname: "/subscription/subscription-locked",
          params: {
            role: "farmer",
            step: "activation",
            farmerId: activeFarmerId,
            email: farmer.email || "",
            businessName: farmer.businessName || farmer.farmName || "",
          },
        } as any);
        return;
      }

      router.replace({
        pathname: "/farmer/setup-store",
        params: { farmerId: activeFarmerId },
      } as any);
    } catch (error) {
      console.log("Farmer login error:", error);
      Alert.alert("Login Error", "Unable to login farmer.");
    } finally {
      setLoading(false);
    }
  }

  async function lookupQuestions() {
    try {
      if (!recoveryUsername.trim()) {
        Alert.alert("Username Required", "Enter your username or email first.");
        return;
      }

      setLookupLoading(true);

      const supabaseFarmer = await findFarmerInSupabase(
        recoveryUsername.trim()
      );

      const localFarmer = supabaseFarmer
        ? null
        : await getFarmerByUsername(recoveryUsername.trim());

      const farmer = (supabaseFarmer || localFarmer) as FarmerAccount | null;

      if (!farmer) {
        setRecoveryFarmer(null);
        Alert.alert("Not Found", "No farmer account found for that username.");
        return;
      }

      setRecoveryFarmer(farmer);

      Alert.alert(
        "Security Questions Loaded",
        "Your saved security questions are now shown below."
      );
    } catch (error) {
      console.log("Lookup questions error:", error);
      Alert.alert("Lookup Error", "Unable to load security questions.");
    } finally {
      setLookupLoading(false);
    }
  }

  async function recoverLogin() {
    try {
      if (!recoveryUsername.trim()) {
        Alert.alert("Missing Username", "Please enter username or email.");
        return;
      }

      if (!answer1.trim() || !answer2.trim() || !answer3.trim()) {
        Alert.alert(
          "Missing Answers",
          "Please answer all 3 saved security questions."
        );
        return;
      }

      setRecoveryLoading(true);

      let farmer = recoveryFarmer;

      if (!farmer) {
        const supabaseFarmer = await findFarmerInSupabase(
          recoveryUsername.trim()
        );

        const localFarmer = supabaseFarmer
          ? null
          : await getFarmerByUsername(recoveryUsername.trim());

        farmer = (supabaseFarmer || localFarmer) as FarmerAccount | null;
      }

      if (!farmer) {
        Alert.alert("Not Found", "No farmer account found.");
        return;
      }

      const answersMatch =
        normalizeAnswer(farmer.securityAnswer1 || "") ===
          normalizeAnswer(answer1) &&
        normalizeAnswer(farmer.securityAnswer2 || "") ===
          normalizeAnswer(answer2) &&
        normalizeAnswer(farmer.securityAnswer3 || "") ===
          normalizeAnswer(answer3);

      if (!answersMatch) {
        const fallbackFarmer = await verifyFarmerSecurityQuestions(
          recoveryUsername.trim(),
          answer1.trim(),
          answer2.trim(),
          answer3.trim()
        );

        farmer = (fallbackFarmer || null) as FarmerAccount | null;
      }

      if (!farmer) {
        Alert.alert(
          "Recovery Failed",
          "Security answers do not match this farmer account."
        );
        return;
      }

      Alert.alert(
        "Account Found",
        `Username: ${farmer.username || farmer.email}\nPassword: ${
          farmer.password || "No password saved"
        }`
      );
    } catch (error) {
      console.log("Farmer recovery error:", error);
      Alert.alert("Recovery Error", "Unable to recover account.");
    } finally {
      setRecoveryLoading(false);
    }
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
    >
      <Text style={styles.header}>Farmer Login</Text>

      <Text style={styles.subheader}>
        Login to continue your Farm2Home compliance, store setup, and produce
        listings.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Login</Text>

        <TextInput
          style={styles.input}
          placeholder="Username or email"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Pressable
          style={[styles.primaryButton, loading && styles.disabled]}
          onPress={loginFarmer}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Login</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.linkButton}
          onPress={() => setShowRecovery((prev) => !prev)}
        >
          <Text style={styles.linkText}>
            {showRecovery ? "Hide Recovery" : "Forgot username or password?"}
          </Text>
        </Pressable>
      </View>

      {showRecovery && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account Recovery</Text>

          <TextInput
            style={styles.input}
            placeholder="Username or email"
            value={recoveryUsername}
            onChangeText={(text) => {
              setRecoveryUsername(text);
              setRecoveryFarmer(null);
              setAnswer1("");
              setAnswer2("");
              setAnswer3("");
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Pressable
            style={[styles.secondaryButton, lookupLoading && styles.disabled]}
            onPress={lookupQuestions}
            disabled={lookupLoading}
          >
            {lookupLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.secondaryButtonText}>
                Show My Saved Security Questions
              </Text>
            )}
          </Pressable>

          {recoveryFarmer ? (
            <View style={styles.questionsBox}>
              <Text style={styles.questionText}>
                1.{" "}
                {recoveryFarmer.securityQuestion1 ||
                  "Question 1 was not saved"}
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Answer 1"
                value={answer1}
                onChangeText={setAnswer1}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.questionText}>
                2.{" "}
                {recoveryFarmer.securityQuestion2 ||
                  "Question 2 was not saved"}
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Answer 2"
                value={answer2}
                onChangeText={setAnswer2}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.questionText}>
                3.{" "}
                {recoveryFarmer.securityQuestion3 ||
                  "Question 3 was not saved"}
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Answer 3"
                value={answer3}
                onChangeText={setAnswer3}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Pressable
                style={[
                  styles.primaryButton,
                  recoveryLoading && styles.disabled,
                ]}
                onPress={recoverLogin}
                disabled={recoveryLoading}
              >
                {recoveryLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Recover Login</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <Text style={styles.helperText}>
              Enter your username or email, then tap “Show My Saved Security
              Questions.”
            </Text>
          )}
        </View>
      )}

      <Pressable
        style={styles.outlineButton}
        onPress={() => router.replace("/farmer/compliance-upload" as any)}
      >
        <Text style={styles.outlineButtonText}>
          Continue to Farmer Compliance
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F5F7EF",
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  header: {
    fontSize: 34,
    fontWeight: "900",
    color: "#14532D",
    marginTop: 24,
  },
  subheader: {
    color: "#64745E",
    marginTop: 8,
    lineHeight: 22,
    marginBottom: 18,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#DDE7DB",
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#14532D",
    marginBottom: 14,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 16,
    padding: 14,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 12,
  },
  questionsBox: {
    marginTop: 10,
  },
  questionText: {
    color: "#14532D",
    fontWeight: "900",
    marginBottom: 8,
    lineHeight: 20,
  },
  helperText: {
    color: "#64748B",
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: "#14532D",
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 4,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: "#047857",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  linkButton: {
    alignItems: "center",
    paddingVertical: 14,
  },
  linkText: {
    color: "#047857",
    fontWeight: "900",
  },
  outlineButton: {
    borderWidth: 2,
    borderColor: "#047857",
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  outlineButtonText: {
    color: "#047857",
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.7,
  },
});