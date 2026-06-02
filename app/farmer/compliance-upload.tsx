// app/farmer/compliance-upload.tsx

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL } from "../config/api";
import { PAYMENT_LINKS } from "../config/paymentLinks";
import { supabase } from "../services/supabaseClient";
import {
  markFarmerApplicationFeePaid,
  markFarmerMembershipPaid,
  saveFarmerBusinessInfo,
  saveFarmerLegalChecklist,
  saveFarmerPickupDelivery,
  saveFarmerStripeAccount,
  submitFarmerSetup,
} from "../services/farmerSetupService";

const PICKUP_OPTIONS = ["Pickup Only", "Delivery Only", "Pickup and Delivery"];

const LEGAL_CHECKLIST = [
  "I confirm my business information is accurate.",
  "I confirm I am authorized to sell these products.",
  "I confirm I will follow state food and farm selling rules.",
  "I confirm perishable items will be handled safely.",
  "I confirm pickup and delivery terms are accurate.",
  "I confirm payout information belongs to my business.",
  "I agree to Farm2Home seller terms.",
];

type LegalChecks = Record<number, boolean>;

function firstParam(value: any) {
  if (Array.isArray(value)) return value[0] || "";
  return value ? String(value) : "";
}

function normalizeEmail(value: string) {
  return String(value || "").trim().toLowerCase();
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function makeFarmerId() {
  return `farmer_${Date.now()}`;
}

function StatusPill({ done }: { done: boolean }) {
  return (
    <View style={[styles.pill, done ? styles.pillDone : styles.pillMissing]}>
      <Text
        style={[
          styles.pillText,
          done ? styles.pillTextDone : styles.pillTextMissing,
        ]}
      >
        {done ? "Complete" : "Needed"}
      </Text>
    </View>
  );
}

function ActionCard({
  icon,
  title,
  subtitle,
  done,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={24} color="#FFFFFF" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardSub}>{subtitle}</Text>
        </View>

        <StatusPill done={done} />
      </View>

      {children}
    </View>
  );
}

export default function FarmerComplianceUploadScreen() {
  const params = useLocalSearchParams();

  const farmerIdParam = firstParam(params.farmerId);
  const emailParam = firstParam(params.email);
  const businessNameParam = firstParam(params.businessName);
  const returnedAccountId = firstParam(params.accountId);
  const stripeReturn = firstParam(params.stripeReturn) === "true";

  const [loading, setLoading] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [verifyStripeLoading, setVerifyStripeLoading] = useState(false);

  const [farmerId, setFarmerId] = useState(farmerIdParam || "");
  const [profileId, setProfileId] = useState("");

  const [businessName, setBusinessName] = useState(businessNameParam || "");
  const [ownerName, setOwnerName] = useState("");
  const [farmerEmail, setFarmerEmail] = useState(normalizeEmail(emailParam));
  const [state, setState] = useState("MI");

  const [applicationFeePaid, setApplicationFeePaid] = useState(false);
  const [membershipPaid, setMembershipPaid] = useState(false);

  const [stripeAccountId, setStripeAccountId] = useState("");
  const [stripePayoutsEnabled, setStripePayoutsEnabled] = useState(false);
  const [stripeChargesEnabled, setStripeChargesEnabled] = useState(false);
  const [stripeOnboardingComplete, setStripeOnboardingComplete] =
    useState(false);

  const [pickupDeliveryOption, setPickupDeliveryOption] =
    useState("Pickup and Delivery");

  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [legalChecks, setLegalChecks] = useState<LegalChecks>({});
  const [stripeReturnHandled, setStripeReturnHandled] = useState(false);

  const businessComplete = Boolean(
    businessName.trim() && ownerName.trim() && validEmail(farmerEmail)
  );

  const paymentComplete = applicationFeePaid && membershipPaid;
  const stripeComplete = Boolean(stripeAccountId);
  const pickupComplete = Boolean(pickupDeliveryOption);
  const productsComplete = selectedProducts.length > 0;

  const legalComplete = useMemo(() => {
    return LEGAL_CHECKLIST.every((_, index) => legalChecks[index]);
  }, [legalChecks]);

  const readyToSubmit =
    businessComplete &&
    paymentComplete &&
    stripeComplete &&
    pickupComplete &&
    productsComplete &&
    legalComplete;

  useEffect(() => {
    loadFarmer();
  }, []);

  useEffect(() => {
    if (stripeReturn && returnedAccountId && !stripeReturnHandled) {
      setStripeReturnHandled(true);
      saveStripeReturn(returnedAccountId);
    }
  }, [stripeReturn, returnedAccountId, stripeReturnHandled]);

  async function getAuthUser() {
    const { data } = await supabase.auth.getUser();
    return data?.user || null;
  }

  async function saveLocalFarmer(updates: Record<string, any>) {
    const saved =
      (await AsyncStorage.getItem("currentFarmer")) ||
      (await AsyncStorage.getItem("currentUser"));

    const current = saved ? JSON.parse(saved) : {};

    const updated = {
      ...current,
      ...updates,
      id: updates.id || current.id || farmerId || farmerIdParam || makeFarmerId(),
      farmerId:
        updates.farmerId ||
        current.farmerId ||
        updates.id ||
        current.id ||
        farmerId ||
        farmerIdParam ||
        makeFarmerId(),
      role: "farmer",
      updatedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem("currentFarmer", JSON.stringify(updated));
    await AsyncStorage.setItem("currentUser", JSON.stringify(updated));
    await AsyncStorage.setItem("userRole", "farmer");
    await AsyncStorage.setItem("currentUserRole", "farmer");

    return updated;
  }

  async function loadFarmer() {
    try {
      const authUser = await getAuthUser();

      const saved =
        (await AsyncStorage.getItem("currentFarmer")) ||
        (await AsyncStorage.getItem("currentUser"));

      const local = saved ? JSON.parse(saved) : {};

      const activeId =
        farmerIdParam ||
        local.id ||
        local.farmerId ||
        authUser?.id ||
        makeFarmerId();

      setFarmerId(activeId);
      setProfileId(local.profileId || local.profile_id || authUser?.id || activeId);

      setBusinessName(
        businessNameParam ||
          local.businessName ||
          local.business_name ||
          local.farmName ||
          local.farm_name ||
          ""
      );

      setOwnerName(local.ownerName || local.owner_name || "");
      setFarmerEmail(
        normalizeEmail(emailParam || local.email || authUser?.email || "")
      );
      setState(String(local.state || "MI").slice(0, 2).toUpperCase());

      setSelectedProducts(
        Array.isArray(local.selectedProducts)
          ? local.selectedProducts
          : Array.isArray(local.selected_products)
          ? local.selected_products
          : []
      );

      setApplicationFeePaid(Boolean(local.applicationFeePaid));
      setMembershipPaid(Boolean(local.farmerMembershipPaid));
      setStripeAccountId(local.stripeAccountId || local.stripe_account_id || "");
      setStripePayoutsEnabled(Boolean(local.stripePayoutsEnabled));
      setStripeChargesEnabled(Boolean(local.stripeChargesEnabled));
      setStripeOnboardingComplete(Boolean(local.stripeOnboardingComplete));
      setPickupDeliveryOption(
        local.pickupDeliveryOption ||
          local.pickup_delivery_option ||
          "Pickup and Delivery"
      );
      setLegalChecks(local.legalChecks || local.legal_checks || {});

      if (local.accountActive === true || local.storeUnlocked === true) {
        router.replace("/farmer/dashboard");
      }
    } catch (error: any) {
      Alert.alert(
        "Load Error",
        error?.message || "Unable to load farmer setup."
      );
    }
  }

  async function getOrCreateFarmerId() {
    if (farmerId) return farmerId;

    const authUser = await getAuthUser();

    const newId = farmerIdParam || authUser?.id || makeFarmerId();

    setFarmerId(newId);
    setProfileId(authUser?.id || newId);

    await saveLocalFarmer({
      id: newId,
      farmerId: newId,
      profileId: authUser?.id || newId,
    });

    return newId;
  }

  async function openUrl(url: string, title = "Open Link Error") {
    try {
      if (!url || !url.startsWith("http")) {
        Alert.alert(title, "No valid link was provided.");
        return;
      }

      if (Platform.OS === "web") {
        window.open(url, "_blank");
        return;
      }

      const supported = await Linking.canOpenURL(url);

      if (supported) {
        await Linking.openURL(url);
        return;
      }

      await WebBrowser.openBrowserAsync(url);
    } catch (error: any) {
      Alert.alert(title, error?.message || "Unable to open link.");
    }
  }

  async function saveBusinessInfo() {
    try {
      if (!businessComplete) {
        Alert.alert(
          "Business Info Required",
          "Enter business name, owner name, and valid farmer email."
        );
        return;
      }

      const activeId = await getOrCreateFarmerId();

      setBusinessName(businessName.trim());
      setOwnerName(ownerName.trim());
      setFarmerEmail(normalizeEmail(farmerEmail));
      setState((state || "MI").toUpperCase().slice(0, 2));

      await saveLocalFarmer({
        id: activeId,
        farmerId: activeId,
        profileId,
        businessName: businessName.trim(),
        farmName: businessName.trim(),
        ownerName: ownerName.trim(),
        email: normalizeEmail(farmerEmail),
        state: (state || "MI").toUpperCase().slice(0, 2),
      });

      saveFarmerBusinessInfo({
        farmerId: activeId,
        profileId,
        businessName: businessName.trim(),
        ownerName: ownerName.trim(),
        email: normalizeEmail(farmerEmail),
        state: (state || "MI").toUpperCase().slice(0, 2),
      }).catch((error) => console.log("Business save ignored:", error));

      Alert.alert("Saved", "Business information saved.");
    } catch (error: any) {
      Alert.alert("Save Error", error?.message || "Unable to save business.");
    }
  }

  async function openApplicationFee() {
    try {
      setLoading(true);

      const activeId = await getOrCreateFarmerId();

      setApplicationFeePaid(true);

      await saveLocalFarmer({
        id: activeId,
        farmerId: activeId,
        applicationFeePaid: true,
        applicationFeeStarted: true,
      });

      markFarmerApplicationFeePaid({
        farmerId: activeId,
        profileId,
        email: farmerEmail,
      }).catch((error) => console.log("Application fee save ignored:", error));

      await openUrl(PAYMENT_LINKS.farmerApplicationProcessFee, "Stripe Error");
    } catch (error: any) {
      Alert.alert(
        "Application Fee Error",
        error?.message || "Unable to open application fee."
      );
    } finally {
      setLoading(false);
    }
  }

  async function openMembershipPayment() {
    try {
      setLoading(true);

      const activeId = await getOrCreateFarmerId();

      setMembershipPaid(true);

      await saveLocalFarmer({
        id: activeId,
        farmerId: activeId,
        farmerMembershipPaid: true,
        monthlyMembershipStarted: true,
      });

      markFarmerMembershipPaid({
        farmerId: activeId,
        profileId,
        email: farmerEmail,
      }).catch((error) => console.log("Membership save ignored:", error));

      await openUrl(PAYMENT_LINKS.farmerMembership, "Stripe Membership Error");
    } catch (error: any) {
      Alert.alert(
        "Membership Error",
        error?.message || "Unable to open membership payment."
      );
    } finally {
      setLoading(false);
    }
  }

  async function setupStripePayout() {
    try {
      if (!businessComplete) {
        Alert.alert(
          "Business Info Required",
          "Save business info before Stripe setup."
        );
        return;
      }

      setStripeLoading(true);

      const activeId = await getOrCreateFarmerId();

      const response = await fetch(
        `${API_BASE_URL}/payments/create-farmer-connect-account`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            farmerId: activeId,
            profileId,
            email: normalizeEmail(farmerEmail),
            farmName: businessName.trim(),
            businessName: businessName.trim(),
            existingStripeAccountId: stripeAccountId || "",
          }),
        }
      );

      const text = await response.text();

      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      const accountId = data.accountId || data.stripeAccountId || "";
      const onboardingUrl = data.onboardingUrl || data.url || "";

      if (!response.ok || !onboardingUrl || !accountId) {
        throw new Error(
          data.error ||
            data.message ||
            data.raw ||
            `Stripe onboarding failed. Backend status ${response.status}`
        );
      }

      setStripeAccountId(accountId);
      setStripeOnboardingComplete(accountId.startsWith("acct_"));

      await saveLocalFarmer({
        id: activeId,
        farmerId: activeId,
        stripeAccountId: accountId,
        farmerStripeAccountId: accountId,
        stripeOnboardingComplete: accountId.startsWith("acct_"),
      });

      saveFarmerStripeAccount({
        farmerId: activeId,
        profileId,
        email: farmerEmail,
        stripeAccountId: accountId,
        onboardingComplete: accountId.startsWith("acct_"),
      }).catch((error) => console.log("Stripe save ignored:", error));

      await openUrl(onboardingUrl, "Stripe Setup Error");
    } catch (error: any) {
      Alert.alert(
        "Stripe Error",
        error?.message || "Unable to start Stripe setup."
      );
    } finally {
      setStripeLoading(false);
    }
  }

  async function saveStripeReturn(accountId: string) {
    try {
      const activeId = await getOrCreateFarmerId();

      setStripeAccountId(accountId);
      setStripeOnboardingComplete(accountId.startsWith("acct_"));

      await saveLocalFarmer({
        id: activeId,
        farmerId: activeId,
        stripeAccountId: accountId,
        farmerStripeAccountId: accountId,
        stripeOnboardingComplete: accountId.startsWith("acct_"),
      });

      saveFarmerStripeAccount({
        farmerId: activeId,
        profileId,
        email: farmerEmail,
        stripeAccountId: accountId,
        onboardingComplete: accountId.startsWith("acct_"),
      }).catch((error) => console.log("Stripe return save ignored:", error));
    } catch (error) {
      console.log("SAVE_STRIPE_RETURN_ERROR:", error);
    }
  }

  async function verifyStripe() {
    try {
      setVerifyStripeLoading(true);

      const activeId = await getOrCreateFarmerId();

      if (!stripeAccountId) {
        Alert.alert("Missing Stripe", "Setup Stripe payout first.");
        return;
      }

      let onboardingComplete = stripeAccountId.startsWith("acct_");
      let payoutsEnabled = false;
      let chargesEnabled = false;

      try {
        const response = await fetch(
          `${API_BASE_URL}/payments/check-farmer-connect-account`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              farmerId: activeId,
              profileId,
              email: farmerEmail,
              stripeAccountId,
              accountId: stripeAccountId,
            }),
          }
        );

        const data = await response.json();

        onboardingComplete =
          data.onboardingComplete === true ||
          data.detailsSubmitted === true ||
          data.details_submitted === true ||
          data.account?.details_submitted === true ||
          stripeAccountId.startsWith("acct_");

        payoutsEnabled =
          data.payoutsEnabled === true ||
          data.payouts_enabled === true ||
          data.account?.payouts_enabled === true;

        chargesEnabled =
          data.chargesEnabled === true ||
          data.charges_enabled === true ||
          data.account?.charges_enabled === true;
      } catch (error) {
        console.log("Stripe backend verify skipped:", error);
      }

      setStripeOnboardingComplete(onboardingComplete);
      setStripePayoutsEnabled(payoutsEnabled);
      setStripeChargesEnabled(chargesEnabled);

      await saveLocalFarmer({
        id: activeId,
        farmerId: activeId,
        stripeAccountId,
        farmerStripeAccountId: stripeAccountId,
        stripeOnboardingComplete: onboardingComplete,
        stripePayoutsEnabled: payoutsEnabled,
        stripeChargesEnabled: chargesEnabled,
      });

      saveFarmerStripeAccount({
        farmerId: activeId,
        profileId,
        email: farmerEmail,
        stripeAccountId,
        payoutsEnabled,
        chargesEnabled,
        onboardingComplete,
      }).catch((error) => console.log("Stripe verify save ignored:", error));

      Alert.alert("Stripe Saved", "Stripe account was saved.");
    } catch (error: any) {
      Alert.alert(
        "Stripe Verify Error",
        error?.message || "Unable to verify Stripe."
      );
    } finally {
      setVerifyStripeLoading(false);
    }
  }

  async function savePickupOption(option: string) {
    try {
      const activeId = await getOrCreateFarmerId();

      setPickupDeliveryOption(option);

      await saveLocalFarmer({
        id: activeId,
        farmerId: activeId,
        pickupDeliveryOption: option,
      });

      saveFarmerPickupDelivery({
        farmerId: activeId,
        profileId,
        email: farmerEmail,
        pickupDeliveryOption: option,
      }).catch((error) => console.log("Pickup save ignored:", error));
    } catch (error: any) {
      Alert.alert(
        "Save Error",
        error?.message || "Unable to save pickup option."
      );
    }
  }

  async function saveLegal() {
    try {
      if (!legalComplete) {
        Alert.alert(
          "Legal Checklist Required",
          "Please accept every legal item."
        );
        return;
      }

      const activeId = await getOrCreateFarmerId();

      await saveLocalFarmer({
        id: activeId,
        farmerId: activeId,
        legalChecks,
      });

      saveFarmerLegalChecklist({
        farmerId: activeId,
        profileId,
        email: farmerEmail,
        legalChecks,
      }).catch((error) => console.log("Legal save ignored:", error));

      Alert.alert("Saved", "Legal checklist saved.");
    } catch (error: any) {
      Alert.alert("Save Error", error?.message || "Unable to save legal.");
    }
  }

  async function saveApplicationAndOpenDashboard() {
    if (loading) return;

    if (!readyToSubmit) {
      Alert.alert(
        "Setup Not Complete",
        "Complete business info, payment, Stripe payout, pickup/delivery, product categories, and seller agreement."
      );
      return;
    }

    setLoading(true);

    try {
      const activeId = await getOrCreateFarmerId();

      const activeFarmer = await saveLocalFarmer({
        id: activeId,
        farmerId: activeId,
        profileId,
        businessName: businessName.trim(),
        farmName: businessName.trim(),
        ownerName: ownerName.trim(),
        email: normalizeEmail(farmerEmail),
        state,
        selectedProducts,
        selectedProductCategories: selectedProducts,
        applicationFeePaid: true,
        farmerMembershipPaid: true,
        monthlyMembershipStarted: true,
        stripeAccountId,
        farmerStripeAccountId: stripeAccountId,
        stripeOnboardingComplete,
        stripePayoutsEnabled,
        stripeChargesEnabled,
        pickupDeliveryOption,
        legalChecks,
        accountActive: true,
        storeUnlocked: true,
        complianceSubmitted: true,
        complianceStatus: "ACTIVE",
        adminReviewStatus: "ACTIVE",
        reviewDecision: "APPROVED",
        approved: true,
        reviewed: true,
        rejected: false,
        needsMoreInfo: false,
      });

      submitFarmerSetup({
        farmerId: activeId,
        profileId,
        email: farmerEmail,
      }).catch((error) => console.log("Submit remote save ignored:", error));

      router.replace({
        pathname: "/farmer/dashboard",
        params: {
          farmerId: activeId,
          email: normalizeEmail(farmerEmail),
          businessName: businessName.trim(),
        },
      } as any);
    } catch (error: any) {
      Alert.alert(
        "Submit Error",
        error?.message || "Unable to open farmer dashboard."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#14532D" />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
      >
        <View style={styles.hero}>
          <Text style={styles.kicker}>Farm2Home Farmer Setup</Text>
          <Text style={styles.heroTitle}>Store Setup Center</Text>
          <Text style={styles.heroSub}>
            Complete business info, payments, Stripe payout, product categories,
            pickup/delivery, and seller agreement to open your Farmer Dashboard.
          </Text>
        </View>

        <ActionCard
          icon="business-outline"
          title="Business Information"
          subtitle="Save farm name, owner name, email, and state."
          done={businessComplete}
        >
          <TextInput
            style={styles.input}
            placeholder="Farm / Business Name"
            value={businessName}
            onChangeText={setBusinessName}
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Owner Name"
            value={ownerName}
            onChangeText={setOwnerName}
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Farmer Email"
            value={farmerEmail}
            onChangeText={setFarmerEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="State"
            value={state}
            onChangeText={(value) => setState(value.toUpperCase().slice(0, 2))}
            maxLength={2}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={saveBusinessInfo}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryText}>Save Business Info</Text>
          </TouchableOpacity>
        </ActionCard>

        <ActionCard
          icon="card-outline"
          title="Application Fee"
          subtitle="Open the $29.99 Stripe application fee payment page."
          done={applicationFeePaid}
        >
          <TouchableOpacity
            style={styles.stripeBtn}
            onPress={openApplicationFee}
            activeOpacity={0.85}
          >
            <Ionicons name="open-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryText}>
              {applicationFeePaid ? "Application Fee Marked Paid" : "Pay Application Fee"}
            </Text>
          </TouchableOpacity>
        </ActionCard>

        <ActionCard
          icon="cash-outline"
          title="Farmer Membership"
          subtitle="Open farmer membership payment page."
          done={membershipPaid}
        >
          <TouchableOpacity
            style={styles.stripeBtn}
            onPress={openMembershipPayment}
            activeOpacity={0.85}
          >
            <Ionicons name="open-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryText}>
              {membershipPaid ? "Membership Marked Paid" : "Pay Farmer Membership"}
            </Text>
          </TouchableOpacity>
        </ActionCard>

        <ActionCard
          icon="wallet-outline"
          title="Stripe Payout"
          subtitle="Setup Stripe Express so customer order payouts can be sent to the farmer."
          done={stripeComplete}
        >
          <Text style={styles.smallText}>
            Stripe Account: {stripeAccountId || "Not connected"}
          </Text>

          <TouchableOpacity
            style={styles.stripeBtn}
            onPress={setupStripePayout}
            disabled={stripeLoading}
            activeOpacity={0.85}
          >
            {stripeLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="open-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryText}>Setup Stripe Payout</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={verifyStripe}
            disabled={verifyStripeLoading}
            activeOpacity={0.85}
          >
            {verifyStripeLoading ? (
              <ActivityIndicator color="#14532D" />
            ) : (
              <Text style={styles.secondaryText}>Verify Stripe Payout</Text>
            )}
          </TouchableOpacity>
        </ActionCard>

        <ActionCard
          icon="leaf-outline"
          title="Product Categories"
          subtitle="Categories selected during registration."
          done={productsComplete}
        >
          <View style={styles.optionGrid}>
            {selectedProducts.length === 0 ? (
              <Text style={styles.smallText}>
                No product categories selected. Go back and select at least one
                category.
              </Text>
            ) : (
              selectedProducts.map((product) => (
                <View key={product} style={styles.categoryChip}>
                  <Text style={styles.categoryChipText}>{product}</Text>
                </View>
              ))
            )}
          </View>
        </ActionCard>

        <ActionCard
          icon="navigate-outline"
          title="Pickup / Delivery"
          subtitle="Choose how customers receive orders."
          done={pickupComplete}
        >
          <View style={styles.optionGrid}>
            {PICKUP_OPTIONS.map((option) => {
              const active = pickupDeliveryOption === option;

              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.optionBtn, active && styles.optionActive]}
                  onPress={() => savePickupOption(option)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.optionText,
                      active && styles.optionTextActive,
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ActionCard>

        <ActionCard
          icon="shield-checkmark-outline"
          title="Seller Agreement"
          subtitle="Confirm seller requirements."
          done={legalComplete}
        >
          {LEGAL_CHECKLIST.map((item, index) => {
            const checked = Boolean(legalChecks[index]);

            return (
              <TouchableOpacity
                key={item}
                style={styles.legalRow}
                onPress={() =>
                  setLegalChecks((prev) => ({
                    ...prev,
                    [index]: !prev[index],
                  }))
                }
                activeOpacity={0.85}
              >
                <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                  <Text style={styles.checkText}>{checked ? "✓" : ""}</Text>
                </View>

                <Text style={styles.legalText}>{item}</Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={saveLegal}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryText}>Save Seller Agreement</Text>
          </TouchableOpacity>
        </ActionCard>

        <TouchableOpacity
          style={[
            styles.submitBtn,
            (loading || !readyToSubmit) && styles.disabled,
          ]}
          onPress={saveApplicationAndOpenDashboard}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitText}>
              Submit Setup & Open Farmer Dashboard
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAF5" },
  content: { paddingBottom: 80 },
  hero: {
    backgroundColor: "#14532D",
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 32,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  kicker: {
    color: "#BBF7D0",
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 33,
    fontWeight: "900",
    marginTop: 8,
  },
  heroSub: {
    color: "#DCFCE7",
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },
  card: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8DA",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 14,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#2E7D32",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    color: "#172017",
    fontSize: 20,
    fontWeight: "900",
  },
  cardSub: {
    color: "#64748B",
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 2,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillDone: { backgroundColor: "#DCFCE7" },
  pillMissing: { backgroundColor: "#FEE2E2" },
  pillText: { fontSize: 11, fontWeight: "900" },
  pillTextDone: { color: "#166534" },
  pillTextMissing: { color: "#B91C1C" },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 16,
    padding: 14,
    fontWeight: "800",
    marginBottom: 10,
    color: "#0F172A",
  },
  primaryBtn: {
    backgroundColor: "#2E7D32",
    borderRadius: 16,
    padding: 15,
    alignItems: "center",
    marginTop: 8,
  },
  stripeBtn: {
    backgroundColor: "#635BFF",
    borderRadius: 16,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },
  primaryText: { color: "#FFFFFF", fontWeight: "900" },
  secondaryBtn: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#86EFAC",
    borderRadius: 16,
    padding: 15,
    alignItems: "center",
    marginTop: 10,
  },
  secondaryText: { color: "#14532D", fontWeight: "900" },
  smallText: {
    color: "#475569",
    fontWeight: "800",
    marginBottom: 8,
  },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  optionBtn: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#2E7D32",
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 999,
  },
  optionActive: { backgroundColor: "#2E7D32" },
  optionText: { color: "#2E7D32", fontWeight: "900" },
  optionTextActive: { color: "#FFFFFF" },
  categoryChip: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#86EFAC",
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 999,
  },
  categoryChipText: {
    color: "#14532D",
    fontWeight: "900",
  },
  legalRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#2E7D32",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: "#2E7D32" },
  checkText: { color: "#FFFFFF", fontWeight: "900" },
  legalText: {
    flex: 1,
    color: "#172017",
    fontWeight: "800",
    lineHeight: 21,
  },
  submitBtn: {
    backgroundColor: "#14532D",
    marginHorizontal: 16,
    marginTop: 18,
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: "center",
  },
  submitText: { color: "#FFFFFF", fontWeight: "900", fontSize: 16 },
  disabled: { opacity: 0.6 },
});