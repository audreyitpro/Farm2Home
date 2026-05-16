// app/farmer/compliance-upload.tsx

import React, { useCallback, useMemo, useState } from "react";
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
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import {
  REQUIRED_DOCUMENTS,
  ComplianceDocumentType,
  addComplianceDocument,
  getComplianceRecord,
} from "../data/complianceStore";

import {
  getFarmerById,
  getFarmers,
  updateFarmerStore,
} from "../data/farmerStore";

import { runAIComplianceVerification } from "../ai/compliance-verification";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:4242";

const PICKUP_DELIVERY_OPTIONS = [
  "Pickup Only",
  "Delivery Only",
  "Pickup and Delivery",
];

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your mother’s maiden name?",
  "What was the name of your elementary school?",
  "What was your first car?",
  "What is your favorite food?",
  "What is your favorite farm animal?",
  "What was the name of your childhood best friend?",
  "What street did you grow up on?",
  "What is your favorite teacher’s name?",
];

const LEGAL_CHECKLIST = [
  "I confirm my business information is accurate.",
  "I confirm I am authorized to sell these products.",
  "I confirm I will follow state food and farm regulations.",
  "I confirm perishable items will be handled safely.",
  "I confirm pickup and delivery terms are accurate.",
  "I confirm payout information belongs to my business.",
  "I agree to Farm2Home seller terms.",
];

export default function FarmerComplianceUploadScreen() {
  const params = useLocalSearchParams();

  const stripeReturn = String(params.stripeReturn || "") === "true";
  const returnedStripeAccountId = params.accountId
    ? String(params.accountId)
    : "";

  const [farmerId, setFarmerId] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [farmerEmail, setFarmerEmail] = useState("");
  const [state, setState] = useState("MI");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [securityQuestion1, setSecurityQuestion1] = useState("");
  const [securityAnswer1, setSecurityAnswer1] = useState("");
  const [securityQuestion2, setSecurityQuestion2] = useState("");
  const [securityAnswer2, setSecurityAnswer2] = useState("");
  const [securityQuestion3, setSecurityQuestion3] = useState("");
  const [securityAnswer3, setSecurityAnswer3] = useState("");

  const [stripeAccountId, setStripeAccountId] = useState("");
  const [stripePayoutAccount, setStripePayoutAccount] = useState("");
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeChecking, setStripeChecking] = useState(false);

  const [pickupDeliveryOption, setPickupDeliveryOption] =
    useState("Pickup and Delivery");

  const [uploadedDocs, setUploadedDocs] = useState<Record<string, string>>({});
  const [legalChecks, setLegalChecks] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);

  const allLegalAccepted = useMemo(
    () => LEGAL_CHECKLIST.every((_, index) => legalChecks[index]),
    [legalChecks]
  );

  useFocusEffect(
    useCallback(() => {
      loadFarmer();
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      if (stripeReturn && returnedStripeAccountId && farmerId) {
        verifyStripePayoutAccount(returnedStripeAccountId);
      }
    }, [stripeReturn, returnedStripeAccountId, farmerId])
  );

  async function loadFarmer() {
    try {
      const saved = await AsyncStorage.getItem("currentFarmer");

      let farmer: any = null;

      if (saved) {
        const currentFarmer = JSON.parse(saved);
        farmer = await getFarmerById(currentFarmer.id);
      }

      if (!farmer) {
        const farmers = await getFarmers();
        farmer = farmers[0];
      }

      if (!farmer) {
        Alert.alert(
          "Farmer Required",
          "Please create or login to a farmer account first."
        );
        return;
      }

      setFarmerId(farmer.id);
      setBusinessName(farmer.farmName || "");
      setOwnerName(farmer.ownerName || "");
      setFarmerEmail(farmer.email || "");

      setState(
        String(farmer.state || farmer.location || "MI")
          .slice(0, 2)
          .toUpperCase()
      );

      setUsername(farmer.username || "");
      setPassword(farmer.password || "");
      setConfirmPassword(farmer.password || "");

      setSecurityQuestion1(farmer.securityQuestion1 || "");
      setSecurityAnswer1(farmer.securityAnswer1 || "");
      setSecurityQuestion2(farmer.securityQuestion2 || "");
      setSecurityAnswer2(farmer.securityAnswer2 || "");
      setSecurityQuestion3(farmer.securityQuestion3 || "");
      setSecurityAnswer3(farmer.securityAnswer3 || "");

      setStripeAccountId(
        farmer.stripeAccountId || farmer.farmerStripeAccountId || ""
      );
      setStripePayoutAccount(farmer.stripePayoutAccount || "");

      if (farmer.pickup === true && farmer.delivery === true) {
        setPickupDeliveryOption("Pickup and Delivery");
      } else if (farmer.pickup === true) {
        setPickupDeliveryOption("Pickup Only");
      } else if (farmer.delivery === true) {
        setPickupDeliveryOption("Delivery Only");
      }

      const existingRecord = await getComplianceRecord(farmer.id);

      if (existingRecord?.documents?.length) {
        const mapped: Record<string, string> = {};

        existingRecord.documents.forEach((doc) => {
          mapped[String(doc.type)] = doc.uri;
        });

        setUploadedDocs(mapped);

        const legalAccepted = existingRecord.documents.some(
          (doc) =>
            String(doc.type) === "legal_checklist" ||
            String(doc.uri || "").includes("legal-checklist://accepted")
        );

        if (legalAccepted) {
          const checked: Record<number, boolean> = {};
          LEGAL_CHECKLIST.forEach((_, index) => {
            checked[index] = true;
          });
          setLegalChecks(checked);
        }
      }
    } catch (error) {
      console.log("Load farmer compliance error:", error);
      Alert.alert("Error", "Unable to load farmer compliance profile.");
    }
  }

  function validateSecurityQuestions() {
    const selectedQuestions = [
      securityQuestion1,
      securityQuestion2,
      securityQuestion3,
    ].filter(Boolean);

    const uniqueQuestions = new Set(selectedQuestions);

    if (selectedQuestions.length !== 3) {
      Alert.alert(
        "Security Questions Required",
        "Please choose 3 security questions."
      );
      return false;
    }

    if (uniqueQuestions.size !== 3) {
      Alert.alert(
        "Duplicate Questions",
        "Please choose 3 different security questions."
      );
      return false;
    }

    if (
      !securityAnswer1.trim() ||
      !securityAnswer2.trim() ||
      !securityAnswer3.trim()
    ) {
      Alert.alert(
        "Security Answers Required",
        "Please answer all 3 security questions."
      );
      return false;
    }

    return true;
  }

  async function saveLoginCredentials(showSuccess = true) {
    if (!farmerId) return false;

    if (!username.trim()) {
      Alert.alert("Username Required", "Please create a username.");
      return false;
    }

    if (!password.trim()) {
      Alert.alert("Password Required", "Please create a password.");
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert("Password Mismatch", "Passwords do not match.");
      return false;
    }

    if (!validateSecurityQuestions()) return false;

    await updateFarmerStore(farmerId, {
      username: username.trim(),
      password: password.trim(),
      email: farmerEmail.trim(),
      securityQuestion1,
      securityAnswer1: securityAnswer1.trim(),
      securityQuestion2,
      securityAnswer2: securityAnswer2.trim(),
      securityQuestion3,
      securityAnswer3: securityAnswer3.trim(),
    } as any);

    if (showSuccess) {
      Alert.alert(
        "Login Saved",
        "Username, password, email, and security questions saved."
      );
    }

    return true;
  }

  async function uploadDocument(type: ComplianceDocumentType, label: string) {
    try {
      if (!farmerId) {
        Alert.alert(
          "Missing Farmer",
          "Please return to the farmer setup page and try again."
        );
        router.replace("/farmer/setup-store" as any);
        return;
      }

      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];

      if (!asset?.uri) {
        Alert.alert("Upload Error", "Unable to upload document.");
        return;
      }

      await addComplianceDocument(farmerId, businessName, ownerName, state, {
        type,
        label,
        uri: asset.uri,
      });

      setUploadedDocs((prev) => ({
        ...prev,
        [type]: asset.uri,
      }));

      Alert.alert("Uploaded", `${label} uploaded successfully.`);
    } catch (error) {
      console.log("Upload document error:", error);
      Alert.alert(
        "Upload Failed",
        "There was a problem uploading your document."
      );
    }
  }

  async function saveBusinessInfoBeforeStripe() {
    if (!farmerId) {
      Alert.alert(
        "Missing Farmer",
        "Please return to the farmer setup page and try again."
      );
      return false;
    }

    if (!businessName.trim() || !ownerName.trim() || !farmerEmail.trim()) {
      Alert.alert(
        "Business Info Required",
        "Please enter the farm/business name, owner name, and farmer email first."
      );
      return false;
    }

    if (!farmerEmail.includes("@")) {
      Alert.alert(
        "Valid Email Required",
        "Stripe requires a real email address."
      );
      return false;
    }

    await updateFarmerStore(farmerId, {
      farmName: businessName.trim(),
      ownerName: ownerName.trim(),
      email: farmerEmail.trim(),
      state,
      complianceStatus: "in_progress",
    } as any);

    return true;
  }

  async function setupStripePayoutAccount() {
    try {
      const valid = await saveBusinessInfoBeforeStripe();
      if (!valid) return;

      const saved = await AsyncStorage.getItem("currentFarmer");
      const currentFarmer = saved ? JSON.parse(saved) : null;

      const farmer = currentFarmer?.id
        ? await getFarmerById(currentFarmer.id)
        : await getFarmerById(farmerId);

      const stripeEmail = farmerEmail.trim();

      if (!stripeEmail || !stripeEmail.includes("@")) {
        Alert.alert(
          "Valid Email Required",
          "Stripe requires a real email address."
        );
        return;
      }

      setStripeLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/create-farmer-stripe-account`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            farmerId,
            email: stripeEmail,
            farmName: businessName,
            existingStripeAccountId:
              stripeAccountId ||
              farmer?.farmerStripeAccountId ||
              farmer?.stripeAccountId ||
              "",
          }),
        }
      );

      const text = await response.text();
      console.log("Stripe onboarding raw response:", text);

      let data: any;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Backend returned invalid response: ${text}`);
      }

      if (!response.ok || !data.success || !data.url) {
        throw new Error(
          data.error || "Stripe onboarding link was not created."
        );
      }

      await updateFarmerStore(farmerId, {
        stripeAccountId: data.accountId,
        farmerStripeAccountId: data.accountId,
        email: stripeEmail,
        complianceStatus: "stripe_pending",
      } as any);

      setStripeAccountId(data.accountId);

      await WebBrowser.openAuthSessionAsync(data.url);
    } catch (error: any) {
      console.log("Stripe setup error:", error);

      Alert.alert(
        "Stripe Setup Error",
        error?.message ||
          "Unable to open Stripe setup. Confirm backend is running and EXPO_PUBLIC_API_BASE_URL uses your PC IPv4 address."
      );
    } finally {
      setStripeLoading(false);
    }
  }

  async function verifyStripePayoutAccount(
    accountIdOverride?: string
  ): Promise<boolean> {
    try {
      const accountId = accountIdOverride || stripeAccountId;

      if (!farmerId || !accountId) {
        Alert.alert("Missing Stripe", "Stripe account ID is missing.");
        return false;
      }

      setStripeChecking(true);

      const response = await fetch(
        `${API_BASE_URL}/farmer-stripe-account-status/${accountId}`
      );

      const data = await response.json();

      console.log("Stripe payout status:", data);

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Unable to verify Stripe payout account."
        );
      }

      await updateFarmerStore(farmerId, {
        stripeAccountId: data.accountId,
        farmerStripeAccountId: data.accountId,
        stripePayoutAccount: data.stripePayoutAccount,
        stripePayoutBankName: data.stripePayoutBankName,
        stripePayoutAccountLast4: data.stripePayoutAccountLast4,
        stripeOnboardingComplete: data.onboardingComplete,
        stripeChargesEnabled: data.chargesEnabled,
        stripePayoutsEnabled: data.payoutsEnabled,
        complianceStatus: data.payoutsEnabled
          ? "stripe_complete"
          : "stripe_pending",
      } as any);

      await addComplianceDocument(farmerId, businessName, ownerName, state, {
        type: "stripe_payout",
        label: "Stripe Payout Account",
        uri: `stripe://${data.accountId}`,
        notes:
          data.stripePayoutAccount || "Stripe payout account connected.",
      } as any);

      setStripeAccountId(data.accountId);
      setStripePayoutAccount(data.stripePayoutAccount || "");

      setUploadedDocs((prev) => ({
        ...prev,
        stripe_payout: `stripe://${data.accountId}`,
      }));

      Alert.alert(
        "Stripe Verified",
        "Stripe payout was saved. Now tap Complete Compliance Review."
      );

      return true;
    } catch (error: any) {
      console.log("Stripe verify error:", error);

      Alert.alert(
        "Stripe Verification Error",
        error?.message || "Unable to verify Stripe payout account."
      );

      return false;
    } finally {
      setStripeChecking(false);
    }
  }

  async function saveStripeSetup() {
    if (!farmerId) return;

    if (!stripeAccountId.trim()) {
      Alert.alert(
        "Stripe Account Required",
        "Please complete Stripe setup first."
      );
      return;
    }

    await verifyStripePayoutAccount(stripeAccountId.trim());
  }

  async function savePickupDeliveryOption(option = pickupDeliveryOption) {
    if (!farmerId) return;

    const pickup = option === "Pickup Only" || option === "Pickup and Delivery";
    const delivery =
      option === "Delivery Only" || option === "Pickup and Delivery";

    await updateFarmerStore(farmerId, {
      pickup,
      delivery,
      pickupDeliveryOption: option,
    } as any);

    await addComplianceDocument(farmerId, businessName, ownerName, state, {
      type: "pickup_delivery_agreement",
      label: "Pickup / Delivery Agreement",
      uri: `agreement://${option}`,
      notes: `Farmer selected: ${option}`,
    } as any);

    setUploadedDocs((prev) => ({
      ...prev,
      pickup_delivery_agreement: `agreement://${option}`,
    }));

    Alert.alert("Option Saved", `${option} was saved.`);
  }

  async function saveLegalChecklist(showSuccess = true) {
    try {
      if (!farmerId) {
        Alert.alert("Missing Farmer", "Farmer account was not loaded.");
        return false;
      }

      const missingChecks = LEGAL_CHECKLIST.filter(
        (_, index) => !legalChecks[index]
      );

      if (missingChecks.length > 0) {
        Alert.alert(
          "Legal Checklist Required",
          `Please check all legal confirmations before continuing.\n\nMissing:\n${missingChecks.join(
            "\n"
          )}`
        );
        return false;
      }

      await addComplianceDocument(farmerId, businessName, ownerName, state, {
        type: "legal_checklist" as any,
        label: "Legal Checklist / Seller Terms",
        uri: "legal-checklist://accepted",
        notes: LEGAL_CHECKLIST.join(" | "),
      } as any);

      setUploadedDocs((prev) => ({
        ...prev,
        legal_checklist: "legal-checklist://accepted",
      }));

      if (showSuccess) {
        Alert.alert("Saved", "Legal checklist saved successfully.");
      }

      return true;
    } catch (error: any) {
      console.log("Save legal checklist error:", error);

      Alert.alert(
        "Save Failed",
        error?.message || "Unable to save legal checklist."
      );

      return false;
    }
  }

  async function runVerification() {
    try {
      setLoading(true);

      const credentialsSaved = await saveLoginCredentials(false);
      if (!credentialsSaved) return;

      const legalSaved = await saveLegalChecklist(false);
      if (!legalSaved) return;

      if (!uploadedDocs.pickup_delivery_agreement) {
        Alert.alert(
          "Pickup / Delivery Required",
          "Please select your pickup or delivery option before verification."
        );
        return;
      }

      if (stripeAccountId && !uploadedDocs.stripe_payout) {
        const stripeVerified = await verifyStripePayoutAccount(stripeAccountId);

        if (!stripeVerified) {
          Alert.alert(
            "Stripe Required",
            "Stripe must be verified before final approval."
          );
          return;
        }
      }

      const record = await getComplianceRecord(farmerId);

      if (!record) {
        Alert.alert(
          "Missing Compliance Record",
          "No compliance record was found. Please upload at least one compliance document again."
        );
        return;
      }

      const latestFarmerBeforeAI = await getFarmerById(farmerId);

      const adminAlreadyApproved =
        latestFarmerBeforeAI?.approved === true ||
        latestFarmerBeforeAI?.complianceStatus === "approved";

      let result: any = {
        autoApproved: false,
        score: adminAlreadyApproved ? 100 : 0,
        reviewedAt: new Date().toISOString(),
        missingItems: [],
      };

      if (!adminAlreadyApproved) {
        result = await runAIComplianceVerification(record);
      }

      const latestFarmer = await getFarmerById(farmerId);

      const complianceApproved =
        result.autoApproved === true ||
        adminAlreadyApproved ||
        latestFarmer?.approved === true ||
        latestFarmer?.complianceStatus === "approved";

      if (complianceApproved) {
        await updateFarmerStore(farmerId, {
          approved: true,
          accountActive: true,
          complianceStatus: "approved",
          complianceScore: result.score || 100,
          complianceReviewedAt: result.reviewedAt || new Date().toISOString(),
        } as any);

        Alert.alert(
          "Approved",
          "Your compliance review is approved. You can now complete your farmer store setup."
        );

        router.replace("/farmer/setup-store" as any);
        return;
      }

      await updateFarmerStore(farmerId, {
        approved: false,
        accountActive: false,
        complianceStatus: "needs_more_info",
        complianceScore: result.score,
        complianceReviewedAt: result.reviewedAt,
      } as any);

      Alert.alert(
        "Review Needed",
        result.missingItems?.length
          ? `Missing:\n\n${result.missingItems.join("\n")}`
          : `AI verification completed, but manual review is required. Score: ${
              result.score || 0
            }`
      );
    } catch (error: any) {
      console.log("Verification error:", error);

      Alert.alert(
        "Verification Error",
        error?.message || "Unable to complete compliance verification."
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
      <View style={styles.securityBox}>
        <Text style={styles.securityLabel}>{label}</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {SECURITY_QUESTIONS.map((question) => {
            const active = selectedQuestion === question;

            return (
              <Pressable
                key={question}
                style={[
                  styles.questionChip,
                  active && styles.questionChipActive,
                ]}
                onPress={() => setSelectedQuestion(question)}
              >
                <Text
                  style={[
                    styles.questionChipText,
                    active && styles.questionChipTextActive,
                  ]}
                >
                  {question}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <TextInput
          style={styles.input}
          placeholder="Answer"
          value={answer}
          onChangeText={setAnswer}
          secureTextEntry
        />
      </View>
    );
  }

  function renderDocumentRow(doc: {
    type: ComplianceDocumentType;
    label: string;
    required: boolean;
  }) {
    const uploaded = uploadedDocs[doc.type];

    if (doc.type === "stripe_payout") {
      return (
        <View key={doc.type} style={styles.specialBox}>
          <Text style={styles.docLabel}>Stripe Payout Account</Text>
          <Text
            style={[
              styles.docStatus,
              uploaded ? styles.uploaded : styles.missing,
            ]}
          >
            {uploaded ? "Connected" : "Required"}
          </Text>

          <Text style={styles.helpText}>
            Connect Stripe so Farm2Home can route farmer payouts correctly.
          </Text>

          <TextInput
            style={styles.stripeInput}
            placeholder="Stripe account will appear after setup"
            value={stripeAccountId}
            editable={false}
            autoCapitalize="none"
          />

          <TextInput
            style={styles.stripeInput}
            placeholder="Stripe payout account"
            value={stripePayoutAccount}
            editable={false}
            autoCapitalize="none"
          />

          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.stripeButton, stripeLoading && { opacity: 0.7 }]}
              onPress={setupStripePayoutAccount}
              disabled={stripeLoading || stripeChecking}
            >
              {stripeLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.stripeButtonText}>
                  Setup Stripe Payout
                </Text>
              )}
            </Pressable>

            <Pressable
              style={[styles.saveButton, stripeChecking && { opacity: 0.7 }]}
              onPress={saveStripeSetup}
              disabled={stripeLoading || stripeChecking}
            >
              {stripeChecking ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Verify</Text>
              )}
            </Pressable>
          </View>
        </View>
      );
    }

    if (doc.type === "pickup_delivery_agreement") {
      return (
        <View key={doc.type} style={styles.specialBox}>
          <Text style={styles.docLabel}>Pickup / Delivery Option</Text>

          <Text
            style={[
              styles.docStatus,
              uploaded ? styles.uploaded : styles.missing,
            ]}
          >
            {uploaded ? "Selected" : "Required"}
          </Text>

          <View style={styles.optionRow}>
            {PICKUP_DELIVERY_OPTIONS.map((option) => (
              <Pressable
                key={option}
                style={[
                  styles.optionButton,
                  pickupDeliveryOption === option &&
                    styles.optionButtonActive,
                ]}
                onPress={() => {
                  setPickupDeliveryOption(option);
                  savePickupDeliveryOption(option);
                }}
              >
                <Text
                  style={[
                    styles.optionButtonText,
                    pickupDeliveryOption === option &&
                      styles.optionButtonTextActive,
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      );
    }

    return (
      <View key={doc.type} style={styles.docRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.docLabel}>{doc.label}</Text>

          <Text
            style={[
              styles.docStatus,
              uploaded ? styles.uploaded : styles.missing,
            ]}
          >
            {uploaded ? "Uploaded" : "Required"}
          </Text>
        </View>

        <Pressable
          style={styles.uploadButton}
          onPress={() => uploadDocument(doc.type, doc.label)}
        >
          <Text style={styles.uploadButtonText}>
            {uploaded ? "Replace" : "Upload"}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.header}>Farmer Compliance Verification</Text>

      <Text style={styles.subheader}>
        Upload documents, create login credentials, choose security questions,
        connect Stripe, select pickup/delivery, and accept legal seller terms.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Business Information</Text>

        <TextInput
          style={styles.input}
          placeholder="Farm / Business Name"
          value={businessName}
          onChangeText={setBusinessName}
        />

        <TextInput
          style={styles.input}
          placeholder="Owner Name"
          value={ownerName}
          onChangeText={setOwnerName}
        />

        <TextInput
          style={styles.input}
          placeholder="Farmer Email"
          value={farmerEmail}
          onChangeText={setFarmerEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="State"
          value={state}
          onChangeText={(value) => setState(value.toUpperCase().slice(0, 2))}
          maxLength={2}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Create Farmer Login</Text>

        <TextInput
          style={styles.input}
          placeholder="Create username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Create password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        <Text style={styles.helpText}>
          Choose 3 security questions. These will be used for username/password
          recovery only.
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

        <Pressable
          style={styles.saveLoginButton}
          onPress={() => saveLoginCredentials(true)}
        >
          <Text style={styles.saveLoginButtonText}>
            Save Login & Security Questions
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Required Verification Items</Text>
        {REQUIRED_DOCUMENTS.map((doc) => renderDocumentRow(doc))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Legal Checklist</Text>

        {LEGAL_CHECKLIST.map((item, index) => {
          const checked = Boolean(legalChecks[index]);

          return (
            <Pressable
              key={item}
              style={styles.legalRow}
              onPress={() =>
                setLegalChecks((prev) => ({
                  ...prev,
                  [index]: !prev[index],
                }))
              }
            >
              <View style={[styles.checkbox, checked && styles.checkboxActive]}>
                <Text style={styles.checkboxText}>{checked ? "✓" : ""}</Text>
              </View>

              <Text style={styles.legalText}>{item}</Text>
            </Pressable>
          );
        })}

        <Pressable
          style={[
            styles.saveLegalButton,
            !allLegalAccepted && styles.disabledSoft,
          ]}
          onPress={() => saveLegalChecklist(true)}
        >
          <Text style={styles.saveLegalButtonText}>Save Legal Checklist</Text>
        </Pressable>
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>AI Verification Includes</Text>

        <Text style={styles.noticeText}>
          • Secretary of State business checks{"\n"}
          • Agriculture registration review{"\n"}
          • EIN/tax verification{"\n"}
          • Insurance review{"\n"}
          • Food permit validation{"\n"}
          • Fraud/risk checks{"\n"}
          • Stripe payout verification{"\n"}
          • Pickup / delivery agreement validation{"\n"}
          • Legal seller checklist validation{"\n"}
          • Farmer login and security question validation
        </Text>
      </View>

      <Pressable
        style={[styles.verifyButton, loading && { opacity: 0.7 }]}
        disabled={loading}
        onPress={runVerification}
      >
        <Text style={styles.verifyButtonText}>
          {loading
            ? "Completing Compliance Review..."
            : "Complete Compliance Review"}
        </Text>
      </Pressable>

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F7EF" },
  content: { padding: 18, paddingBottom: 40 },
  header: {
    fontSize: 32,
    fontWeight: "900",
    color: "#14532D",
    marginTop: 20,
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
  securityBox: { marginTop: 12 },
  securityLabel: {
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
  questionChipActive: { backgroundColor: "#047857" },
  questionChipText: { color: "#047857", fontWeight: "900" },
  questionChipTextActive: { color: "#FFFFFF" },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#EEF2E8",
  },
  specialBox: {
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#EEF2E8",
  },
  docLabel: { color: "#111827", fontWeight: "900", fontSize: 15 },
  docStatus: { marginTop: 5, fontWeight: "900" },
  uploaded: { color: "#047857" },
  missing: { color: "#B91C1C" },
  helpText: {
    color: "#64748B",
    fontWeight: "700",
    marginTop: 6,
    marginBottom: 8,
    lineHeight: 20,
  },
  uploadButton: {
    backgroundColor: "#047857",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  uploadButtonText: { color: "#FFFFFF", fontWeight: "900" },
  stripeInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 14,
    padding: 12,
    fontWeight: "800",
    marginTop: 12,
  },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  stripeButton: {
    flex: 1,
    backgroundColor: "#635BFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  stripeButtonText: { color: "#FFFFFF", fontWeight: "900" },
  saveButton: {
    flex: 1,
    backgroundColor: "#047857",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  saveButtonText: { color: "#FFFFFF", fontWeight: "900" },
  saveLoginButton: {
    backgroundColor: "#047857",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 14,
  },
  saveLoginButtonText: { color: "#FFFFFF", fontWeight: "900" },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  optionButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#047857",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
  },
  optionButtonActive: { backgroundColor: "#047857" },
  optionButtonText: { color: "#047857", fontWeight: "900" },
  optionButtonTextActive: { color: "#FFFFFF" },
  legalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#EEF2E8",
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#047857",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxActive: { backgroundColor: "#047857" },
  checkboxText: { color: "#FFFFFF", fontWeight: "900" },
  legalText: {
    flex: 1,
    color: "#111827",
    fontWeight: "800",
    lineHeight: 21,
  },
  saveLegalButton: {
    backgroundColor: "#047857",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 14,
  },
  saveLegalButtonText: { color: "#FFFFFF", fontWeight: "900" },
  disabledSoft: { opacity: 0.55 },
  notice: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#DDE7DB",
  },
  noticeTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#14532D",
    marginBottom: 10,
  },
  noticeText: { color: "#374151", lineHeight: 24, fontWeight: "700" },
  verifyButton: {
    backgroundColor: "#14532D",
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: "center",
  },
  verifyButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
});