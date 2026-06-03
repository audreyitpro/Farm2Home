// app/farmer/connect-bank.tsx

import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";

import { API_BASE_URL } from "../config/api";
import { getFarmerById, updateFarmerStore } from "../data/farmerStore";
import { supabase } from "../data/supabaseClient";

type FarmerStripeUpdate = {
  id?: string;
  email?: string;
  farmName?: string;
  businessName?: string;
  stripeAccountId?: string;
  farmerStripeAccountId?: string;
  stripePayoutAccount?: string;
  stripePayoutAccountLast4?: string;
  stripePayoutBankName?: string;
  stripeOnboardingComplete?: boolean;
  stripeChargesEnabled?: boolean;
  stripePayoutsEnabled?: boolean;
  payoutsEnabled?: boolean;
  chargesEnabled?: boolean;
  detailsSubmitted?: boolean;
  complianceStatus?: string;
};

function normalizeEmail(value: string) {
  return String(value || "").trim().toLowerCase();
}

function getStripeAccountId(farmer: any) {
  return (
    farmer?.stripeAccountId ||
    farmer?.farmerStripeAccountId ||
    farmer?.stripe_account_id ||
    farmer?.farmer_stripe_account_id ||
    ""
  );
}

function mapSupabaseFarmer(row: any) {
  return {
    id: row.id,
    profileId: row.profile_id || row.profileId || "",
    role: "farmer",

    farmName: row.farm_name || row.farmName || row.business_name || "",
    businessName: row.business_name || row.businessName || row.farm_name || "",
    ownerName: row.owner_name || row.ownerName || "",
    email: row.email || "",
    phone: row.phone || "",

    approved: Boolean(row.approved),
    accountActive: Boolean(row.account_active || row.accountActive),
    storeUnlocked: Boolean(row.store_unlocked || row.storeUnlocked),
    complianceSubmitted: Boolean(row.compliance_submitted),
    complianceStatus: row.compliance_status || "",
    adminReviewStatus: row.admin_review_status || "",
    reviewDecision: row.review_decision || "",

    stripeAccountId: row.stripe_account_id || "",
    farmerStripeAccountId: row.farmer_stripe_account_id || row.stripe_account_id || "",
    stripeOnboardingComplete: Boolean(row.stripe_onboarding_complete),
    stripeChargesEnabled: Boolean(row.stripe_charges_enabled),
    stripePayoutsEnabled: Boolean(row.stripe_payouts_enabled),

    stripePayoutAccount: row.stripe_payout_account || "",
    stripePayoutAccountLast4: row.stripe_payout_account_last4 || "",
    stripePayoutBankName: row.stripe_payout_bank_name || "",

    products: row.products || [],
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export default function FarmerStripeBankingScreen() {
  const [farmerId, setFarmerId] = useState("");
  const [email, setEmail] = useState("");
  const [farmerName, setFarmerName] = useState("");
  const [accountId, setAccountId] = useState("");

  const [chargesEnabled, setChargesEnabled] = useState(false);
  const [payoutsEnabled, setPayoutsEnabled] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [payoutAccount, setPayoutAccount] = useState("");
  const [payoutLast4, setPayoutLast4] = useState("");
  const [payoutBankName, setPayoutBankName] = useState("");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFarmer();
  }, []);

  async function loadFarmer() {
    try {
      const saved =
        (await AsyncStorage.getItem("currentFarmer")) ||
        (await AsyncStorage.getItem("currentUser"));

      if (!saved) {
        Alert.alert(
          "Farmer Login Required",
          "Please login or register as a farmer first."
        );
        router.replace("/farmer/login" as any);
        return;
      }

      const currentFarmer = JSON.parse(saved);
      const activeFarmerId = currentFarmer.id || currentFarmer.farmerId || "";

      let activeFarmer: any = currentFarmer;

      if (activeFarmerId) {
        const { data, error } = await supabase
          .from("farmers")
          .select("*")
          .eq("id", activeFarmerId)
          .maybeSingle();

        if (!error && data) {
          activeFarmer = {
            ...currentFarmer,
            ...mapSupabaseFarmer(data),
          };
        }
      }

      if (!activeFarmer?.id && currentFarmer.email) {
        const { data, error } = await supabase
          .from("farmers")
          .select("*")
          .eq("email", normalizeEmail(currentFarmer.email))
          .maybeSingle();

        if (!error && data) {
          activeFarmer = {
            ...currentFarmer,
            ...mapSupabaseFarmer(data),
          };
        }
      }

      const localFarmer = await getFarmerById(activeFarmer.id);
      if (localFarmer) {
        activeFarmer = {
          ...localFarmer,
          ...activeFarmer,
          stripeAccountId:
            getStripeAccountId(activeFarmer) || getStripeAccountId(localFarmer),
        };
      }

      const loadedAccountId = getStripeAccountId(activeFarmer);

      setFarmerId(activeFarmer.id || activeFarmer.farmerId || "");
      setFarmerName(
        activeFarmer.farmName ||
          activeFarmer.businessName ||
          activeFarmer.ownerName ||
          ""
      );
      setEmail(activeFarmer.email || "");
      setAccountId(loadedAccountId);

      setChargesEnabled(
        Boolean(
          activeFarmer.stripeChargesEnabled ||
            activeFarmer.stripe_charges_enabled ||
            activeFarmer.chargesEnabled
        )
      );

      setPayoutsEnabled(
        Boolean(
          activeFarmer.stripePayoutsEnabled ||
            activeFarmer.stripe_payouts_enabled ||
            activeFarmer.payoutsEnabled
        )
      );

      setOnboardingComplete(
        Boolean(
          activeFarmer.stripeOnboardingComplete ||
            activeFarmer.stripe_onboarding_complete ||
            activeFarmer.detailsSubmitted
        )
      );

      setPayoutAccount(
        activeFarmer.stripePayoutAccount ||
          activeFarmer.stripe_payout_account ||
          ""
      );

      setPayoutLast4(
        activeFarmer.stripePayoutAccountLast4 ||
          activeFarmer.stripe_payout_account_last4 ||
          ""
      );

      setPayoutBankName(
        activeFarmer.stripePayoutBankName ||
          activeFarmer.stripe_payout_bank_name ||
          ""
      );

      await saveLocalFarmer({
        ...activeFarmer,
        id: activeFarmer.id || activeFarmerId,
        farmerId: activeFarmer.id || activeFarmerId,
        stripeAccountId: loadedAccountId,
        farmerStripeAccountId: loadedAccountId,
      });
    } catch (error: any) {
      console.log("Load farmer banking error:", error);

      Alert.alert(
        "Load Error",
        error?.message || "Unable to load farmer banking profile."
      );
    }
  }

  async function saveLocalFarmer(update: any) {
    const saved =
      (await AsyncStorage.getItem("currentFarmer")) ||
      (await AsyncStorage.getItem("currentUser"));

    const current = saved ? JSON.parse(saved) : {};

    const updated = {
      ...current,
      ...update,
      id: update.id || current.id || farmerId,
      farmerId: update.farmerId || update.id || current.farmerId || farmerId,
      role: "farmer",
      updatedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem("currentFarmer", JSON.stringify(updated));
    await AsyncStorage.setItem("currentUser", JSON.stringify(updated));
    await AsyncStorage.setItem("currentUserRole", "farmer");
    await AsyncStorage.setItem("userRole", "farmer");

    return updated;
  }

  async function syncFarmerStripeStatus(update: FarmerStripeUpdate) {
    const activeFarmerId = update.id || farmerId;

    if (!activeFarmerId) {
      Alert.alert("Missing Farmer", "Farmer ID is missing. Please login again.");
      return;
    }

    const cleanAccountId =
      update.stripeAccountId ||
      update.farmerStripeAccountId ||
      accountId ||
      "";

    const localUpdate = {
      id: activeFarmerId,
      farmerId: activeFarmerId,

      email: update.email || email,
      farmName: update.farmName || farmerName,
      businessName: update.businessName || update.farmName || farmerName,

      stripeAccountId: cleanAccountId,
      farmerStripeAccountId: cleanAccountId,

      stripePayoutAccount: update.stripePayoutAccount ?? payoutAccount,
      stripePayoutAccountLast4:
        update.stripePayoutAccountLast4 ?? payoutLast4,
      stripePayoutBankName: update.stripePayoutBankName ?? payoutBankName,

      stripeOnboardingComplete:
        update.stripeOnboardingComplete ?? onboardingComplete,
      stripeChargesEnabled: update.stripeChargesEnabled ?? chargesEnabled,
      stripePayoutsEnabled: update.stripePayoutsEnabled ?? payoutsEnabled,

      payoutsEnabled: update.payoutsEnabled ?? update.stripePayoutsEnabled,
      chargesEnabled: update.chargesEnabled ?? update.stripeChargesEnabled,
      detailsSubmitted:
        update.detailsSubmitted ?? update.stripeOnboardingComplete,

      complianceStatus: update.complianceStatus || "stripe_pending",
      updatedAt: new Date().toISOString(),
    };

    const supabasePayload: any = {
      stripe_account_id: cleanAccountId,
      farmer_stripe_account_id: cleanAccountId,
      stripe_onboarding_complete: Boolean(
        localUpdate.stripeOnboardingComplete
      ),
      stripe_charges_enabled: Boolean(localUpdate.stripeChargesEnabled),
      stripe_payouts_enabled: Boolean(localUpdate.stripePayoutsEnabled),
      stripe_payout_account: localUpdate.stripePayoutAccount || "",
      stripe_payout_account_last4: localUpdate.stripePayoutAccountLast4 || "",
      stripe_payout_bank_name: localUpdate.stripePayoutBankName || "",
      compliance_status: localUpdate.complianceStatus,
      updated_at: new Date().toISOString(),
    };

    if (localUpdate.email) supabasePayload.email = normalizeEmail(localUpdate.email);
    if (localUpdate.farmName) {
      supabasePayload.farm_name = localUpdate.farmName;
      supabasePayload.business_name = localUpdate.farmName;
    }

    const { error } = await supabase
      .from("farmers")
      .update(supabasePayload)
      .eq("id", activeFarmerId);

    if (error) {
      throw error;
    }

    try {
      await updateFarmerStore(activeFarmerId, localUpdate as any);
    } catch (error) {
      console.log("Local farmerStore update skipped:", error);
    }

    const updatedLocal = await saveLocalFarmer(localUpdate);

    setFarmerId(activeFarmerId);
    setAccountId(cleanAccountId);
    setPayoutAccount(localUpdate.stripePayoutAccount || "");
    setPayoutLast4(localUpdate.stripePayoutAccountLast4 || "");
    setPayoutBankName(localUpdate.stripePayoutBankName || "");
    setOnboardingComplete(Boolean(localUpdate.stripeOnboardingComplete));
    setChargesEnabled(Boolean(localUpdate.stripeChargesEnabled));
    setPayoutsEnabled(Boolean(localUpdate.stripePayoutsEnabled));

    return updatedLocal;
  }

  async function openStripeUrl(url: string) {
    if (!url || !url.startsWith("http")) {
      Alert.alert("Stripe Error", "No valid Stripe onboarding URL returned.");
      return;
    }

    if (Platform.OS === "web") {
      window.location.href = url;
      return;
    }

    await WebBrowser.openBrowserAsync(url);
  }

  async function createAccountAndOnboard() {
    if (loading) return;

    try {
      if (!farmerName.trim()) {
        Alert.alert(
          "Missing Farmer Name",
          "Please enter farmer or business name."
        );
        return;
      }

      if (!email.trim() || !email.includes("@")) {
        Alert.alert("Valid Email Required", "Please enter a valid farmer email.");
        return;
      }

      setLoading(true);

      const activeFarmerId = farmerId || `farmer_${Date.now()}`;

      const response = await fetch(
        `${API_BASE_URL}/payments/create-farmer-connect-account`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            farmerId: activeFarmerId,
            email: normalizeEmail(email),
            farmName: farmerName.trim(),
            businessName: farmerName.trim(),
            existingStripeAccountId: accountId || "",
          }),
        }
      );

      const text = await response.text();

      let data: any = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Backend returned invalid response: ${text}`);
      }

      const onboardingUrl = data.onboardingUrl || data.url;
      const returnedAccountId = data.accountId || data.stripeAccountId;

      if (!response.ok || !onboardingUrl || !returnedAccountId) {
        throw new Error(
          data.error || data.message || "Unable to create Stripe onboarding."
        );
      }

      await syncFarmerStripeStatus({
        id: activeFarmerId,
        email: normalizeEmail(email),
        farmName: farmerName.trim(),
        businessName: farmerName.trim(),
        stripeAccountId: returnedAccountId,
        farmerStripeAccountId: returnedAccountId,
        stripePayoutAccount: payoutAccount,
        stripePayoutAccountLast4: payoutLast4,
        stripePayoutBankName: payoutBankName,
        complianceStatus: "stripe_pending",
        stripeOnboardingComplete: false,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
      });

      await openStripeUrl(onboardingUrl);
    } catch (error: any) {
      console.log("Stripe onboarding error:", error);

      Alert.alert(
        "Stripe Error",
        error?.message || "Unable to start Stripe onboarding."
      );
    } finally {
      setLoading(false);
    }
  }

  async function checkAccountStatus() {
    if (!accountId.trim()) {
      Alert.alert(
        "Missing Account ID",
        "Complete Stripe setup first or enter a Stripe account ID."
      );
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/payments/check-farmer-connect-account`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            farmerId,
            email: normalizeEmail(email),
            stripeAccountId: accountId.trim(),
            accountId: accountId.trim(),
          }),
        }
      );

      const text = await response.text();

      let data: any = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Backend returned invalid response: ${text}`);
      }

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "Unable to check account status."
        );
      }

      const returnedAccountId =
        data.accountId || data.stripeAccountId || accountId.trim();

      const statusChargesEnabled = Boolean(
        data.chargesEnabled ||
          data.charges_enabled ||
          data.account?.charges_enabled
      );

      const statusPayoutsEnabled = Boolean(
        data.payoutsEnabled ||
          data.payouts_enabled ||
          data.account?.payouts_enabled
      );

      const statusOnboardingComplete = Boolean(
        data.onboardingComplete ||
          data.detailsSubmitted ||
          data.details_submitted ||
          data.account?.details_submitted
      );

      const externalAccount =
        data.externalAccount ||
        data.external_account ||
        data.payoutAccount ||
        data.payout_account ||
        data.account?.external_accounts?.data?.[0] ||
        null;

      const bankName =
        data.bankName ||
        data.bank_name ||
        externalAccount?.bank_name ||
        payoutBankName ||
        "";

      const last4 =
        data.last4 ||
        data.accountLast4 ||
        data.payoutLast4 ||
        externalAccount?.last4 ||
        payoutLast4 ||
        "";

      const payoutLabel =
        bankName && last4
          ? `${bankName} ****${last4}`
          : statusPayoutsEnabled
          ? "Stripe Express payout account connected"
          : "Stripe Express setup pending";

      await syncFarmerStripeStatus({
        id: farmerId,
        email: normalizeEmail(email),
        farmName: farmerName.trim(),
        businessName: farmerName.trim(),
        stripeAccountId: returnedAccountId,
        farmerStripeAccountId: returnedAccountId,
        stripePayoutAccount: payoutLabel,
        stripePayoutAccountLast4: last4,
        stripePayoutBankName: bankName,
        stripeOnboardingComplete: statusOnboardingComplete,
        stripeChargesEnabled: statusChargesEnabled,
        stripePayoutsEnabled: statusPayoutsEnabled,
        payoutsEnabled: statusPayoutsEnabled,
        chargesEnabled: statusChargesEnabled,
        detailsSubmitted: statusOnboardingComplete,
        complianceStatus: statusPayoutsEnabled
          ? "stripe_complete"
          : "stripe_pending",
      });

      Alert.alert(
        statusPayoutsEnabled ? "Stripe Ready" : "Stripe Pending",
        `Account ID: ${returnedAccountId}\n` +
          `Onboarding Complete: ${
            statusOnboardingComplete ? "YES" : "NO"
          }\n` +
          `Charges Enabled: ${statusChargesEnabled ? "YES" : "NO"}\n` +
          `Payouts Enabled: ${statusPayoutsEnabled ? "YES" : "NO"}\n` +
          `Payout Account: ${payoutLabel}`
      );
    } catch (error: any) {
      console.log("Check account status error:", error);

      Alert.alert(
        "Stripe Error",
        error?.message || "Unable to check Stripe account status."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Farmer Banking Setup</Text>

      <Text style={styles.note}>
        Farmers securely enter banking and identity information through Stripe
        Express. Farm2Home does not store bank account numbers.
      </Text>

      <View style={styles.statusCard}>
        <Text style={styles.sectionTitle}>Production Stripe Status</Text>

        <Text style={styles.statusLine}>
          Account: {accountId ? accountId : "Not connected"}
        </Text>

        <Text style={styles.statusLine}>
          Onboarding: {onboardingComplete ? "Complete" : "Pending"}
        </Text>

        <Text style={styles.statusLine}>
          Charges: {chargesEnabled ? "Enabled" : "Pending"}
        </Text>

        <Text style={styles.statusLine}>
          Payouts: {payoutsEnabled ? "Enabled" : "Pending"}
        </Text>

        <Text style={styles.statusLine}>
          Payout Account: {payoutAccount || "Not available"}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Farmer / Business Name</Text>

        <TextInput
          style={styles.input}
          placeholder="Example: Green Valley Farms"
          placeholderTextColor="#8A8F98"
          value={farmerName}
          onChangeText={setFarmerName}
        />

        <Text style={styles.label}>Farmer Email</Text>

        <TextInput
          style={styles.input}
          placeholder="farmer@email.com"
          placeholderTextColor="#8A8F98"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={createAccountAndOnboard}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>
              {accountId ? "Continue Farmer Banking Setup" : "Set Up Farmer Banking"}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Stripe Account ID</Text>

        <TextInput
          style={styles.input}
          placeholder="acct_..."
          placeholderTextColor="#8A8F98"
          autoCapitalize="none"
          value={accountId}
          onChangeText={setAccountId}
        />

        <TouchableOpacity
          style={[styles.secondaryButton, loading && styles.buttonDisabled]}
          onPress={checkAccountStatus}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#1f7a3f" />
          ) : (
            <Text style={styles.secondaryButtonText}>Check Account Status</Text>
          )}
        </TouchableOpacity>

        {accountId ? (
          <Text style={styles.accountText}>
            Farmer Stripe Account ID: {accountId}
          </Text>
        ) : null}
      </View>

      <TouchableOpacity
        style={styles.complianceButton}
        onPress={() => router.push("/farmer/compliance-upload" as any)}
      >
        <Text style={styles.complianceButtonText}>
          Return to Compliance Verification
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: "#F7F7F2",
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#1f7a3f",
    marginBottom: 12,
  },
  note: {
    fontSize: 15,
    color: "#555",
    marginBottom: 20,
    lineHeight: 22,
  },
  statusCard: {
    backgroundColor: "#EAF6EC",
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#B7DDBE",
  },
  statusLine: {
    color: "#14532D",
    fontWeight: "800",
    marginBottom: 6,
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#E2E2D8",
  },
  label: {
    fontWeight: "900",
    color: "#333",
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1f7a3f",
    marginBottom: 12,
  },
  input: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    color: "#111827",
  },
  button: {
    backgroundColor: "#2F7D32",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "900",
  },
  secondaryButton: {
    backgroundColor: "#EAF6EC",
    borderWidth: 1,
    borderColor: "#B7DDBE",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#1f7a3f",
    fontWeight: "900",
  },
  accountText: {
    marginTop: 14,
    color: "#333",
    fontWeight: "700",
    lineHeight: 22,
  },
  complianceButton: {
    backgroundColor: "#14532D",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 30,
  },
  complianceButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});