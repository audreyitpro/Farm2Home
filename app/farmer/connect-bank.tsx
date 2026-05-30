import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import { router, useFocusEffect } from "expo-router";

import { API_BASE_URL } from "../config/api";

const COLORS = {
  primary: "#2E7D32",
  primaryDark: "#14532D",
  secondary: "#F9A825",
  background: "#F8FAF5",
  card: "#FFFFFF",
  text: "#172017",
  muted: "#75806F",
  border: "#E2E8DA",
  softGreen: "#EAF5E6",
  lightGreen: "#F1FAED",
  danger: "#DC2626",
  dark: "#111827",
  stripe: "#635BFF",
};

type FarmerProfile = {
  id?: string;
  farmName?: string;
  businessName?: string;
  email?: string;
  stripeAccountId?: string;
  farmerStripeAccountId?: string;
  stripePayoutsEnabled?: boolean;
  stripeChargesEnabled?: boolean;
  stripeOnboardingComplete?: boolean;
  payoutsEnabled?: boolean;
  chargesEnabled?: boolean;
  detailsSubmitted?: boolean;
};

export default function ConnectBankScreen() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<FarmerProfile | null>(null);

  useFocusEffect(
    useCallback(() => {
      checkStripeStatus();
    }, [])
  );

  async function getCurrentFarmer(): Promise<FarmerProfile | null> {
    const rawFarmer =
      (await AsyncStorage.getItem("currentFarmer")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!rawFarmer) return null;

    try {
      return JSON.parse(rawFarmer);
    } catch (error) {
      console.log("Parse currentFarmer error:", error);
      return null;
    }
  }

  function getStripeAccountId(farmer: FarmerProfile | null) {
    return farmer?.stripeAccountId || farmer?.farmerStripeAccountId || "";
  }

  async function saveUpdatedFarmer(updatedFarmer: FarmerProfile) {
    await AsyncStorage.setItem("currentFarmer", JSON.stringify(updatedFarmer));
    await AsyncStorage.setItem("currentUser", JSON.stringify(updatedFarmer));
    await AsyncStorage.setItem("currentUserRole", "farmer");
  }

  async function openExternalUrl(url: string) {
    if (!url || !url.startsWith("http")) {
      Alert.alert("Stripe Error", "Invalid Stripe onboarding URL.");
      return;
    }

    if (Platform.OS === "web") {
      window.location.href = url;
      return;
    }

    const supported = await Linking.canOpenURL(url);

    if (supported) {
      await WebBrowser.openBrowserAsync(url);
    } else {
      Alert.alert("Open Error", "Unable to open Stripe onboarding link.");
    }
  }

  async function checkStripeStatus() {
    try {
      setLoading(true);

      const farmer = await getCurrentFarmer();

      if (!farmer?.id) {
        Alert.alert(
          "Farmer Session Required",
          "Please login or complete farmer registration first."
        );
        router.replace("/farmer/login" as any);
        return;
      }

      const stripeAccountId = getStripeAccountId(farmer);

      if (!stripeAccountId) {
        Alert.alert(
          "Stripe Required",
          "Please complete Stripe setup from the Farmer Compliance page first.",
          [
            {
              text: "Go to Compliance",
              onPress: () => router.push("/farmer/compliance-upload" as any),
            },
          ]
        );
        setStatus(farmer);
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/payments/check-farmer-connect-account`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stripeAccountId,
            accountId: stripeAccountId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to check Stripe status.");
      }

      const updatedFarmer: FarmerProfile = {
        ...farmer,
        stripeAccountId: data.accountId || data.stripeAccountId || stripeAccountId,
        farmerStripeAccountId:
          data.accountId || data.stripeAccountId || stripeAccountId,
        payoutsEnabled: Boolean(data.payoutsEnabled),
        chargesEnabled: Boolean(data.chargesEnabled),
        detailsSubmitted: Boolean(data.detailsSubmitted),
        stripePayoutsEnabled: Boolean(data.payoutsEnabled),
        stripeChargesEnabled: Boolean(data.chargesEnabled),
        stripeOnboardingComplete: Boolean(
          data.onboardingComplete || data.detailsSubmitted
        ),
      };

      await saveUpdatedFarmer(updatedFarmer);
      setStatus(updatedFarmer);
    } catch (error: any) {
      console.log("Stripe status check error:", error);

      Alert.alert(
        "Stripe Status Error",
        error.message || "Unable to check Stripe account."
      );
    } finally {
      setLoading(false);
    }
  }

  async function resumeOnboarding() {
    try {
      setLoading(true);

      const farmer = await getCurrentFarmer();

      if (!farmer?.id) {
        Alert.alert("Farmer Session Required", "Please login again.");
        router.replace("/farmer/login" as any);
        return;
      }

      const stripeAccountId = getStripeAccountId(farmer);

      if (!stripeAccountId) {
        Alert.alert(
          "Stripe Required",
          "Please start Stripe setup from the Farmer Compliance page.",
          [
            {
              text: "Go to Compliance",
              onPress: () => router.push("/farmer/compliance-upload" as any),
            },
          ]
        );
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/payments/create-farmer-onboarding-link`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stripeAccountId,
            accountId: stripeAccountId,
            farmerId: farmer.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to create onboarding link.");
      }

      const onboardingUrl = data.onboardingUrl || data.url;

      await openExternalUrl(onboardingUrl);
    } catch (error: any) {
      console.log("Resume onboarding error:", error);

      Alert.alert(
        "Onboarding Error",
        error.message || "Unable to resume Stripe onboarding."
      );
    } finally {
      setLoading(false);
    }
  }

  const fullyConnected =
    Boolean(status?.chargesEnabled || status?.stripeChargesEnabled) &&
    Boolean(status?.payoutsEnabled || status?.stripePayoutsEnabled) &&
    Boolean(status?.detailsSubmitted || status?.stripeOnboardingComplete);

  const accountId = getStripeAccountId(status);

  return (
    <View style={styles.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [styles.backCircle, pressed && styles.pressed]}
            onPress={() => router.push("/farmer/dashboard" as any)}
          >
            <Text style={styles.backCircleText}>‹</Text>
          </Pressable>

          <View style={styles.topTitleBlock}>
            <Text style={styles.title}>Payout Status</Text>
            <Text style={styles.subtitle}>Stripe Connect account readiness</Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Text style={styles.heroIconText}>💳</Text>
          </View>

          <View style={styles.heroTextBlock}>
            <Text style={styles.heroBadge}>Stripe Connect</Text>
            <Text style={styles.heroTitle}>
              {fullyConnected ? "Payouts are enabled" : "Finish payout setup"}
            </Text>
            <Text style={styles.heroText}>
              Verify your Stripe Express account so Farm2Home can send farmer
              marketplace payouts.
            </Text>
          </View>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View
              style={[
                styles.statusIcon,
                fullyConnected ? styles.statusGoodBg : styles.statusBadBg,
              ]}
            >
              <Text style={styles.statusIconText}>
                {fullyConnected ? "✅" : "⚠️"}
              </Text>
            </View>

            <View style={styles.statusBody}>
              <Text style={styles.statusTitle}>
                {fullyConnected
                  ? "Farmer payouts fully enabled"
                  : "Stripe onboarding incomplete"}
              </Text>

              <Text style={styles.statusText}>
                {accountId ? `Account: ${accountId}` : "Account: Not connected"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account Checklist</Text>

          <StatusRow
            label="Stripe Account"
            value={accountId || "Not connected"}
            passed={Boolean(accountId)}
          />

          <StatusRow
            label="Details Submitted"
            value={
              status?.detailsSubmitted || status?.stripeOnboardingComplete
                ? "Complete"
                : "Incomplete"
            }
            passed={Boolean(
              status?.detailsSubmitted || status?.stripeOnboardingComplete
            )}
          />

          <StatusRow
            label="Charges Enabled"
            value={
              status?.chargesEnabled || status?.stripeChargesEnabled
                ? "Enabled"
                : "Not enabled"
            }
            passed={Boolean(status?.chargesEnabled || status?.stripeChargesEnabled)}
          />

          <StatusRow
            label="Payouts Enabled"
            value={
              status?.payoutsEnabled || status?.stripePayoutsEnabled
                ? "Enabled"
                : "Not enabled"
            }
            passed={Boolean(status?.payoutsEnabled || status?.stripePayoutsEnabled)}
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.pressed,
            loading && styles.disabled,
          ]}
          onPress={checkStripeStatus}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Refresh Stripe Status</Text>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.pressed,
            loading && styles.disabled,
          ]}
          onPress={resumeOnboarding}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>Resume Stripe Onboarding</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
          onPress={() => router.push("/farmer/compliance-upload" as any)}
        >
          <Text style={styles.linkText}>Back To Compliance</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
          onPress={() => router.push("/farmer/dashboard" as any)}
        >
          <Text style={styles.linkText}>Continue To Dashboard</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function StatusRow({
  label,
  value,
  passed,
}: {
  label: string;
  value: string;
  passed: boolean;
}) {
  return (
    <View style={styles.rowCard}>
      <View style={styles.rowIcon}>
        <Text style={styles.rowIconText}>{passed ? "✅" : "❌"}</Text>
      </View>

      <View style={styles.rowTextBlock}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 18,
    paddingBottom: 44,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    gap: 12,
  },
  backCircle: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backCircleText: {
    fontSize: 34,
    color: COLORS.text,
    fontWeight: "900",
    marginTop: -4,
  },
  topTitleBlock: {
    flex: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: COLORS.text,
  },
  subtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3,
  },
  heroCard: {
    backgroundColor: COLORS.stripe,
    borderRadius: 32,
    padding: 20,
    marginBottom: 16,
    flexDirection: "row",
    gap: 14,
  },
  heroIcon: {
    width: 70,
    height: 70,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  heroIconText: {
    fontSize: 34,
  },
  heroTextBlock: {
    flex: 1,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    color: "#FFFFFF",
    fontWeight: "900",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 10,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "900",
    lineHeight: 31,
  },
  heroText: {
    color: "#F4F2FF",
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 8,
  },
  statusCard: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  statusIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  statusGoodBg: {
    backgroundColor: COLORS.softGreen,
  },
  statusBadBg: {
    backgroundColor: "#FEF3C7",
  },
  statusIconText: {
    fontSize: 29,
  },
  statusBody: {
    flex: 1,
  },
  statusTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "900",
  },
  statusText: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 5,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 14,
  },
  rowCard: {
    backgroundColor: COLORS.lightGreen,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 13,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
  },
  rowIconText: {
    fontSize: 21,
  },
  rowTextBlock: {
    flex: 1,
  },
  rowLabel: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 15,
  },
  rowValue: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3,
  },
  button: {
    backgroundColor: COLORS.stripe,
    padding: 17,
    borderRadius: 20,
    alignItems: "center",
    marginBottom: 12,
  },
  secondaryButton: {
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.stripe,
    padding: 16,
    borderRadius: 20,
    alignItems: "center",
    marginBottom: 14,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  secondaryButtonText: {
    color: COLORS.stripe,
    fontWeight: "900",
    fontSize: 16,
  },
  linkButton: {
    padding: 12,
    alignItems: "center",
  },
  linkText: {
    color: COLORS.primary,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.6,
  },
});