import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

import { supabase } from "../data/supabaseClient";
import farmTheme from "../styles/farmTheme";

type CustomerAccount = {
  id: string;
  fullName?: string;
  name?: string;
  full_name?: string;
  email: string;
  username?: string;
  password?: string;
  securityQuestion1?: string;
  security_question_1?: string;
  securityAnswer1?: string;
  security_answer_1?: string;
  securityQuestion2?: string;
  security_question_2?: string;
  securityAnswer2?: string;
  security_answer_2?: string;
  securityQuestion3?: string;
  security_question_3?: string;
  securityAnswer3?: string;
  security_answer_3?: string;
};

function normalizeAnswer(value: string) {
  return String(value || "").trim().toLowerCase();
}

function safelyParseArray(rawValue: string | null): CustomerAccount[] {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeCustomer(customer: CustomerAccount): CustomerAccount {
  return {
    id: customer.id,
    fullName: customer.fullName || customer.full_name || customer.name || "",
    name: customer.name || customer.fullName || customer.full_name || "",
    email: String(customer.email || "").toLowerCase(),
    username: String(customer.username || "").toLowerCase(),
    password: customer.password || "",
    securityQuestion1:
      customer.securityQuestion1 || customer.security_question_1 || "",
    securityAnswer1:
      customer.securityAnswer1 || customer.security_answer_1 || "",
    securityQuestion2:
      customer.securityQuestion2 || customer.security_question_2 || "",
    securityAnswer2:
      customer.securityAnswer2 || customer.security_answer_2 || "",
    securityQuestion3:
      customer.securityQuestion3 || customer.security_question_3 || "",
    securityAnswer3:
      customer.securityAnswer3 || customer.security_answer_3 || "",
  };
}

export default function CustomerPasswordRecoveryScreen() {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [customer, setCustomer] = useState<CustomerAccount | null>(null);

  const [answer1, setAnswer1] = useState("");
  const [answer2, setAnswer2] = useState("");
  const [answer3, setAnswer3] = useState("");

  const [lookupLoading, setLookupLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);

  async function findLocalCustomer(cleanLogin: string) {
    const savedCustomers = await AsyncStorage.getItem("farm2homeCustomers");
    const customers = safelyParseArray(savedCustomers).map(normalizeCustomer);

    return (
      customers.find(
        (item) =>
          item.email?.toLowerCase() === cleanLogin ||
          item.username?.toLowerCase() === cleanLogin
      ) || null
    );
  }

  async function findSupabaseCustomer(cleanLogin: string) {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .or(`email.eq.${cleanLogin},username.eq.${cleanLogin}`)
        .maybeSingle();

      if (error) {
        console.log("Customer recovery Supabase skipped:", error.message);
        return null;
      }

      return data ? normalizeCustomer(data) : null;
    } catch (error) {
      console.log("Customer recovery Supabase failed:", error);
      return null;
    }
  }

  async function lookupCustomer() {
    const cleanLogin = emailOrUsername.trim().toLowerCase();

    if (!cleanLogin) {
      Alert.alert("Missing Info", "Enter your email or username.");
      return;
    }

    try {
      setLookupLoading(true);

      let foundCustomer = await findLocalCustomer(cleanLogin);

      if (!foundCustomer) {
        foundCustomer = await findSupabaseCustomer(cleanLogin);
      }

      if (!foundCustomer) {
        Alert.alert("Not Found", "No customer account was found.");
        return;
      }

      if (
        !foundCustomer.securityQuestion1 ||
        !foundCustomer.securityQuestion2 ||
        !foundCustomer.securityQuestion3
      ) {
        Alert.alert(
          "Recovery Not Setup",
          "This customer account does not have security questions saved."
        );
        return;
      }

      setCustomer(foundCustomer);
      setAnswer1("");
      setAnswer2("");
      setAnswer3("");
    } catch (error: any) {
      Alert.alert("Lookup Error", error?.message || "Unable to find account.");
    } finally {
      setLookupLoading(false);
    }
  }

  function verifyAnswers() {
    if (!customer) return;

    if (!answer1.trim() || !answer2.trim() || !answer3.trim()) {
      Alert.alert("Missing Answers", "Please answer all 3 questions.");
      return;
    }

    try {
      setVerifyLoading(true);

      const matches =
        normalizeAnswer(answer1) === normalizeAnswer(customer.securityAnswer1 || "") &&
        normalizeAnswer(answer2) === normalizeAnswer(customer.securityAnswer2 || "") &&
        normalizeAnswer(answer3) === normalizeAnswer(customer.securityAnswer3 || "");

      if (!matches) {
        Alert.alert("Incorrect Answers", "The answers do not match this profile.");
        return;
      }

      Alert.alert(
        "Account Recovered",
        `Username: ${customer.username || "Not saved"}\nPassword: ${
          customer.password || "Not saved"
        }`,
        [
          {
            text: "Go to Login",
            onPress: () => router.replace("/customer/login" as any),
          },
        ]
      );
    } finally {
      setVerifyLoading(false);
    }
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.header}>Recover Customer Login</Text>

      <Text style={styles.subheader}>
        Enter your email or username. Your saved security questions will appear.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email or Username"
        placeholderTextColor="#8A8F98"
        value={emailOrUsername}
        onChangeText={setEmailOrUsername}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TouchableOpacity
        style={[styles.lookupButton, lookupLoading && styles.disabledButton]}
        onPress={lookupCustomer}
        disabled={lookupLoading}
      >
        {lookupLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.lookupButtonText}>Find My Account</Text>
        )}
      </TouchableOpacity>

      {customer ? (
        <View style={styles.securityCard}>
          <Text style={styles.sectionTitle}>Answer Security Questions</Text>

          <Text style={styles.question}>{customer.securityQuestion1}</Text>
          <TextInput
            style={styles.input}
            placeholder="Answer 1"
            placeholderTextColor="#8A8F98"
            value={answer1}
            onChangeText={setAnswer1}
            secureTextEntry
          />

          <Text style={styles.question}>{customer.securityQuestion2}</Text>
          <TextInput
            style={styles.input}
            placeholder="Answer 2"
            placeholderTextColor="#8A8F98"
            value={answer2}
            onChangeText={setAnswer2}
            secureTextEntry
          />

          <Text style={styles.question}>{customer.securityQuestion3}</Text>
          <TextInput
            style={styles.input}
            placeholder="Answer 3"
            placeholderTextColor="#8A8F98"
            value={answer3}
            onChangeText={setAnswer3}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.verifyButton, verifyLoading && styles.disabledButton]}
            onPress={verifyAnswers}
            disabled={verifyLoading}
          >
            {verifyLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.verifyButtonText}>Recover Login</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => router.replace("/customer/login" as any)}
      >
        <Text style={styles.linkText}>Back to Login</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: farmTheme.colors.background,
  },
  content: {
    flexGrow: 1,
    padding: 22,
    paddingBottom: 50,
    justifyContent: "center",
  },
  header: {
    fontSize: 30,
    fontWeight: "900",
    color: farmTheme.colors.primary,
    marginBottom: 8,
  },
  subheader: {
    color: farmTheme.colors.mutedText,
    lineHeight: 21,
    marginBottom: 20,
    fontWeight: "700",
  },
  sectionTitle: {
    color: farmTheme.colors.primary,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 14,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    color: farmTheme.colors.text,
    fontWeight: "700",
  },
  lookupButton: {
    backgroundColor: farmTheme.colors.primary,
    padding: 18,
    borderRadius: 16,
    marginTop: 10,
    alignItems: "center",
  },
  lookupButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  securityCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    borderRadius: 18,
    padding: 16,
    marginTop: 20,
  },
  question: {
    color: farmTheme.colors.text,
    fontWeight: "900",
    marginBottom: 8,
  },
  verifyButton: {
    backgroundColor: farmTheme.colors.primary,
    padding: 18,
    borderRadius: 16,
    marginTop: 8,
    alignItems: "center",
  },
  verifyButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.6,
  },
  linkButton: {
    marginTop: 16,
  },
  linkText: {
    textAlign: "center",
    color: farmTheme.colors.primary,
    fontWeight: "800",
  },
});