import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";

import { API_BASE_URL, APP_URL } from "../config/api";
import freightTheme from "../styles/freightTheme";

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your mother’s maiden name?",
  "What was the name of your elementary school?",
  "What was your first car?",
  "What is your favorite food?",
  "What was the name of your childhood best friend?",
  "What street did you grow up on?",
  "What is your favorite teacher’s name?",
  "What was your first delivery vehicle?",
];

type DriverUser = {
  id: string;
  role: "driver";
  fullName: string;
  email: string;
  phone: string;
  username: string;
  password: string;
  vehicleType: string;
  licenseNumber: string;
  serviceArea: string;
  hasInsurance: boolean;
  hasValidLicense: boolean;
  acceptsBackgroundCheck: boolean;
  securityQuestion1: string;
  securityAnswer1: string;
  securityQuestion2: string;
  securityAnswer2: string;
  securityQuestion3: string;
  securityAnswer3: string;
  approved: boolean;
  accountActive: boolean;
  subscriptionStatus: "pending" | "active";
  membershipStatus: "Pending" | "Active";
  createdAt: string;
  updatedAt: string;
};

function normalizeAnswer(value: string) {
  return String(value || "").trim().toLowerCase();
}

function safelyParseArray(rawValue: string | null): DriverUser[] {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function getDrivers() {
  const raw = await AsyncStorage.getItem("farm2homeDrivers");
  return safelyParseArray(raw);
}

async function saveDriver(driver: DriverUser) {
  const drivers = await getDrivers();

  const updatedDrivers = [
    driver,
    ...drivers.filter(
      (item) =>
        item.email.toLowerCase() !== driver.email.toLowerCase() &&
        item.username.toLowerCase() !== driver.username.toLowerCase() &&
        item.id !== driver.id
    ),
  ];

  await AsyncStorage.setItem("farm2homeDrivers", JSON.stringify(updatedDrivers));
  await AsyncStorage.setItem("pendingDriver", JSON.stringify(driver));
  await AsyncStorage.setItem("currentDriver", JSON.stringify(driver));
  await AsyncStorage.setItem("currentUser", JSON.stringify(driver));
  await AsyncStorage.setItem("userRole", "driver");
  await AsyncStorage.setItem("currentUserRole", "driver");
}

export default function DriverRegisterScreen() {
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [vehicleType, setVehicleType] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [serviceArea, setServiceArea] = useState("");

  const [hasInsurance, setHasInsurance] = useState(false);
  const [hasValidLicense, setHasValidLicense] = useState(false);
  const [acceptsBackgroundCheck, setAcceptsBackgroundCheck] = useState(false);

  const [securityQuestion1, setSecurityQuestion1] = useState("");
  const [securityAnswer1, setSecurityAnswer1] = useState("");
  const [securityQuestion2, setSecurityQuestion2] = useState("");
  const [securityAnswer2, setSecurityAnswer2] = useState("");
  const [securityQuestion3, setSecurityQuestion3] = useState("");
  const [securityAnswer3, setSecurityAnswer3] = useState("");

  const selectedQuestions = useMemo(
    () => [securityQuestion1, securityQuestion2, securityQuestion3].filter(Boolean),
    [securityQuestion1, securityQuestion2, securityQuestion3]
  );

  function validateForm() {
    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      Alert.alert("Missing Info", "Full name, email, and phone are required.");
      return false;
    }

    if (!email.trim().includes("@")) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return false;
    }

    if (!username.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert("Login Required", "Please create a username and password.");
      return false;
    }

    if (username.trim().length < 4) {
      Alert.alert("Invalid Username", "Username must be at least 4 characters.");
      return false;
    }

    if (password.trim().length < 6) {
      Alert.alert("Weak Password", "Password must be at least 6 characters.");
      return false;
    }

    if (password.trim() !== confirmPassword.trim()) {
      Alert.alert("Password Mismatch", "Passwords do not match.");
      return false;
    }

    if (!vehicleType.trim() || !licenseNumber.trim() || !serviceArea.trim()) {
      Alert.alert(
        "Driver Info Required",
        "Vehicle type, license number, and service area are required."
      );
      return false;
    }

    if (!hasInsurance || !hasValidLicense || !acceptsBackgroundCheck) {
      Alert.alert(
        "Verification Required",
        "Confirm insurance, valid license, and background check authorization."
      );
      return false;
    }

    if (selectedQuestions.length !== 3) {
      Alert.alert("Security Required", "Please select 3 security questions.");
      return false;
    }

    if (new Set(selectedQuestions).size !== 3) {
      Alert.alert("Duplicate Questions", "Please select 3 different questions.");
      return false;
    }

    if (!securityAnswer1.trim() || !securityAnswer2.trim() || !securityAnswer3.trim()) {
      Alert.alert("Security Required", "Please answer all 3 security questions.");
      return false;
    }

    return true;
  }

  async function checkDuplicateDriver(cleanEmail: string, cleanUsername: string) {
    const drivers = await getDrivers();

    const duplicate = drivers.find(
      (item) =>
        item.email.toLowerCase() === cleanEmail ||
        item.username.toLowerCase() === cleanUsername
    );

    if (duplicate) {
      Alert.alert(
        "Account Exists",
        "A driver account already exists with this email or username."
      );
      return true;
    }

    return false;
  }

  async function openCheckoutUrl(url: string) {
    if (!url || !url.startsWith("http")) {
      Alert.alert("Stripe Error", "No valid Stripe checkout URL returned.");
      return;
    }

    if (Platform.OS === "web") {
      window.location.href = url;
      return;
    }

    await WebBrowser.openBrowserAsync(url);
  }

  async function registerDriver() {
    if (loading) return;
    if (!validateForm()) return;

    const cleanFullName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    try {
      setLoading(true);

      const duplicate = await checkDuplicateDriver(cleanEmail, cleanUsername);
      if (duplicate) return;

      const now = new Date().toISOString();

      const driver: DriverUser = {
        id: `driver_${Date.now()}`,
        role: "driver",
        fullName: cleanFullName,
        email: cleanEmail,
        phone: cleanPhone,
        username: cleanUsername,
        password: cleanPassword,
        vehicleType: vehicleType.trim(),
        licenseNumber: licenseNumber.trim(),
        serviceArea: serviceArea.trim(),
        hasInsurance,
        hasValidLicense,
        acceptsBackgroundCheck,
        securityQuestion1,
        securityAnswer1: normalizeAnswer(securityAnswer1),
        securityQuestion2,
        securityAnswer2: normalizeAnswer(securityAnswer2),
        securityQuestion3,
        securityAnswer3: normalizeAnswer(securityAnswer3),
        approved: false,
        accountActive: true,
        subscriptionStatus: "pending",
        membershipStatus: "Pending",
        createdAt: now,
        updatedAt: now,
      };

      await saveDriver(driver);

      const response = await fetch(
        `${API_BASE_URL}/payments/create-subscription-checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customerEmail: cleanEmail,
            email: cleanEmail,
            name: cleanFullName,
            username: cleanUsername,
            userId: driver.id,
            driverId: driver.id,
            planType: "driver",
            successUrl: `${APP_URL}/driver/mobile-driver-app?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${APP_URL}/driver/register`,
          }),
        }
      );

      const text = await response.text();

      let data: {
        success?: boolean;
        url?: string;
        id?: string;
        sessionId?: string;
        error?: string;
        message?: string;
      } = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (!response.ok || !data.url) {
        Alert.alert(
          "Account Saved",
          data.error ||
            data.message ||
            "Your driver account was saved, but Stripe checkout did not open. Check STRIPE_DRIVER_BOARD_PRICE_ID."
        );
        return;
      }

      await AsyncStorage.setItem(
        "pendingDriver",
        JSON.stringify({
          ...driver,
          stripeCheckoutSessionId: data.id || data.sessionId || null,
          membershipStatus: "Checkout Started",
          updatedAt: new Date().toISOString(),
        })
      );

      await openCheckoutUrl(data.url);
    } catch (error: any) {
      console.log("Driver register error:", error);
      Alert.alert(
        "Registration Error",
        error?.message || "Unable to complete driver registration."
      );
    } finally {
      setLoading(false);
    }
  }

  function renderQuestionPicker(
    label: string,
    selectedQuestion: string,
    setSelectedQuestion: (value: string) => void,
    answer: string,
    setAnswer: (value: string) => void
  ) {
    return (
      <View style={styles.questionBox}>
        <Text style={styles.questionLabel}>{label}</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {SECURITY_QUESTIONS.map((question) => {
            const active = selectedQuestion === question;

            return (
              <TouchableOpacity
                key={question}
                style={[styles.questionChip, active && styles.questionChipActive]}
                onPress={() => setSelectedQuestion(question)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.questionChipText,
                    active && styles.questionChipTextActive,
                  ]}
                >
                  {question}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TextInput
          style={styles.input}
          placeholder="Hidden answer"
          placeholderTextColor="#8A8F98"
          value={answer}
          onChangeText={setAnswer}
          secureTextEntry
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="always"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <Text style={styles.title}>Driver Registration</Text>
        <Text style={styles.subtitle}>
          Join the Farm2Home driver board to accept local farm delivery orders.
        </Text>
      </View>

      <View style={styles.priceBox}>
        <Text style={styles.price}>$4.99 / month</Text>
        <Text style={styles.priceSub}>Access the Driver Delivery Board</Text>
      </View>

      <Text style={styles.section}>Driver Information</Text>

      <TextInput
        style={styles.input}
        placeholder="Full Name"
        placeholderTextColor="#8A8F98"
        value={fullName}
        onChangeText={setFullName}
      />

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#8A8F98"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Phone"
        placeholderTextColor="#8A8F98"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />

      <Text style={styles.section}>Create Driver Login</Text>

      <TextInput
        style={styles.input}
        placeholder="Create Username"
        placeholderTextColor="#8A8F98"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TextInput
        style={styles.input}
        placeholder="Create Password"
        placeholderTextColor="#8A8F98"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        placeholderTextColor="#8A8F98"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        autoCapitalize="none"
      />

      <Text style={styles.section}>Driver Verification</Text>

      <TextInput
        style={styles.input}
        placeholder="Vehicle Type"
        placeholderTextColor="#8A8F98"
        value={vehicleType}
        onChangeText={setVehicleType}
      />

      <TextInput
        style={styles.input}
        placeholder="Driver License Number"
        placeholderTextColor="#8A8F98"
        value={licenseNumber}
        onChangeText={setLicenseNumber}
      />

      <TextInput
        style={styles.input}
        placeholder="Service Area"
        placeholderTextColor="#8A8F98"
        value={serviceArea}
        onChangeText={setServiceArea}
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>I have active auto insurance</Text>
        <Switch value={hasInsurance} onValueChange={setHasInsurance} />
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>I have a valid driver license</Text>
        <Switch value={hasValidLicense} onValueChange={setHasValidLicense} />
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>
          I authorize Farm2Home to review driver eligibility
        </Text>
        <Switch
          value={acceptsBackgroundCheck}
          onValueChange={setAcceptsBackgroundCheck}
        />
      </View>

      <View style={styles.securityCard}>
        <Text style={styles.securityTitle}>Security Questions</Text>
        <Text style={styles.securityHelp}>
          Choose 3 questions for account recovery.
        </Text>

        {renderQuestionPicker(
          "Security Question 1",
          securityQuestion1,
          setSecurityQuestion1,
          securityAnswer1,
          setSecurityAnswer1
        )}

        {renderQuestionPicker(
          "Security Question 2",
          securityQuestion2,
          setSecurityQuestion2,
          securityAnswer2,
          setSecurityAnswer2
        )}

        {renderQuestionPicker(
          "Security Question 3",
          securityQuestion3,
          setSecurityQuestion3,
          securityAnswer3,
          setSecurityAnswer3
        )}
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.disabledButton]}
        onPress={registerDriver}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Register + Subscribe</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/driver/login" as any)}
        activeOpacity={0.85}
      >
        <Text style={styles.link}>Already registered? Driver Login</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 60,
  },
  heroCard: {
    backgroundColor: "#EA580C",
    borderRadius: 28,
    padding: 22,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    marginBottom: 8,
    color: "#FFFFFF",
  },
  subtitle: {
    color: "#FFF7ED",
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "700",
  },
  priceBox: {
    backgroundColor: "#FFF7ED",
    padding: 16,
    borderRadius: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#FDBA74",
  },
  price: {
    fontSize: 25,
    fontWeight: "900",
    color: "#EA580C",
  },
  priceSub: {
    color: "#555555",
    marginTop: 4,
    fontWeight: "700",
  },
  section: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
    marginTop: 8,
    color: "#FFFFFF",
  },
  input: {
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    fontSize: 16,
    color: "#111827",
    fontWeight: "700",
  },
  switchRow: {
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switchText: {
    flex: 1,
    fontWeight: "800",
    paddingRight: 12,
    color: "#111827",
  },
  securityCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  securityTitle: {
    color: "#EA580C",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 6,
  },
  securityHelp: {
    color: "#555555",
    lineHeight: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
  questionBox: {
    marginBottom: 12,
  },
  questionLabel: {
    color: "#111827",
    fontWeight: "900",
    marginBottom: 8,
  },
  questionChip: {
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 10,
    maxWidth: 260,
  },
  questionChipActive: {
    backgroundColor: "#EA580C",
  },
  questionChipText: {
    color: "#EA580C",
    fontWeight: "900",
  },
  questionChipTextActive: {
    color: "#FFFFFF",
  },
  button: {
    backgroundColor: "#EA580C",
    padding: 16,
    borderRadius: 16,
    marginTop: 10,
    alignItems: "center",
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "900",
    fontSize: 16,
  },
  link: {
    color: "#FDBA74",
    textAlign: "center",
    fontWeight: "900",
    marginTop: 18,
  },
});