// app/farmer/profile.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";

import { API_BASE_URL } from "../config/api";
import { supabase } from "../data/supabaseClient";

const LOGO_BUCKET = "farm-logos";

type UploadedFile = {
  name: string;
  uri: string;
  mimeType?: string;
};

const editableProductCatalog: Record<string, string[]> = {
  Produce: [
    "Avocados",
    "Bananas",
    "Tomatoes",
    "Peaches",
    "Pears",
    "Watermelon",
    "Oranges",
    "Sweet Potatoes",
    "Garlic",
    "Mushrooms",
    "Carrots",
    "Cantaloupe",
    "Grapes",
    "Cherries",
    "Potatoes",
    "Mangoes",
    "Kiwis",
    "Blueberries",
    "Apples",
    "Lemons",
    "Limes",
    "Beans",
    "Beets",
    "Cabbage",
    "Broccoli",
    "Collard Greens",
    "Mustard Greens",
    "Corn",
    "Onions",
    "Strawberries",
    "Cucumbers",
    "Squash",
    "Brussel Sprouts",
    "Okra",
    "Bell Pepper",
    "Peas",
    "Pumpkins",
    "Spinach",
    "Celery",
    "Eggplant",
    "Zucchini",
    "Parsnip",
    "Bok Choy",
  ],
  Eggs: ["Chicken Eggs", "Duck Eggs", "Quail Eggs", "Free-Range Eggs", "Organic Eggs"],
  Honey: ["Raw Honey", "Wildflower Honey", "Clover Honey", "Comb Honey", "Infused Honey"],
  Meat: ["Beef", "Ground Beef", "Steak", "Pork", "Bacon", "Sausage", "Lamb", "Goat Meat", "Bison"],
  Poultry: ["Whole Chicken", "Chicken Breast", "Chicken Wings", "Turkey", "Duck", "Quail"],
  Dairy: ["Milk", "Goat Milk", "Cheese", "Butter", "Yogurt", "Cream"],
  "Baked Goods": ["Bread", "Sourdough Bread", "Rolls", "Cookies", "Cakes", "Pies", "Muffins"],
  Livestock: ["Cows", "Calves", "Goats", "Sheep", "Lamb", "Pigs", "Chickens", "Ducks", "Turkeys", "Rabbits"],
  Flowers: [
    "Roses",
    "Tulips",
    "Sunflowers",
    "Lilies",
    "Daisies",
    "Carnations",
    "Peonies",
    "Hydrangeas",
    "Zinnias",
    "Snapdragons",
    "Dahlias",
    "Lavender",
    "Baby’s Breath",
    "Chrysanthemums",
    "Gladiolus",
    "Ranunculus",
    "Poppies",
    "Orchids",
    "Irises",
    "Gerbera Daisies",
    "Other",
  ],
  Seasonal: ["Christmas Trees", "Pumpkins", "Reefs", "Other"],
};

function normalizeEmail(value: string) {
  return String(value || "").trim().toLowerCase();
}

function getFarmerId(farmer: any) {
  return farmer?.id || farmer?.farmerId || "";
}

function getLogoUrl(farmer: any) {
  return (
    farmer?.logoUrl ||
    farmer?.farmLogoUrl ||
    farmer?.logo_url ||
    farmer?.farm_logo_url ||
    farmer?.logo?.uri ||
    ""
  );
}

function getStripeSafeFields(farmer: any) {
  return {
    stripeAccountId: farmer?.stripeAccountId || farmer?.stripe_account_id || "",
    farmerStripeAccountId:
      farmer?.farmerStripeAccountId ||
      farmer?.farmer_stripe_account_id ||
      farmer?.stripeAccountId ||
      farmer?.stripe_account_id ||
      "",
    stripe_account_id: farmer?.stripe_account_id || farmer?.stripeAccountId || "",
    farmer_stripe_account_id:
      farmer?.farmer_stripe_account_id ||
      farmer?.farmerStripeAccountId ||
      farmer?.stripe_account_id ||
      farmer?.stripeAccountId ||
      "",

    stripeCustomerId: farmer?.stripeCustomerId || farmer?.stripe_customer_id || "",
    stripe_customer_id: farmer?.stripe_customer_id || farmer?.stripeCustomerId || "",
    stripeSubscriptionId:
      farmer?.stripeSubscriptionId || farmer?.stripe_subscription_id || "",
    stripe_subscription_id:
      farmer?.stripe_subscription_id || farmer?.stripeSubscriptionId || "",

    stripePayoutsEnabled:
      farmer?.stripePayoutsEnabled || farmer?.stripe_payouts_enabled || false,
    stripeChargesEnabled:
      farmer?.stripeChargesEnabled || farmer?.stripe_charges_enabled || false,
    stripeOnboardingComplete:
      farmer?.stripeOnboardingComplete ||
      farmer?.stripe_onboarding_complete ||
      false,

    stripe_payouts_enabled:
      farmer?.stripe_payouts_enabled || farmer?.stripePayoutsEnabled || false,
    stripe_charges_enabled:
      farmer?.stripe_charges_enabled || farmer?.stripeChargesEnabled || false,
    stripe_onboarding_complete:
      farmer?.stripe_onboarding_complete ||
      farmer?.stripeOnboardingComplete ||
      false,

    stripePayoutAccount:
      farmer?.stripePayoutAccount || farmer?.stripe_payout_account || "",
    stripePayoutAccountLast4:
      farmer?.stripePayoutAccountLast4 ||
      farmer?.stripe_payout_account_last4 ||
      "",
    stripePayoutBankName:
      farmer?.stripePayoutBankName || farmer?.stripe_payout_bank_name || "",

    stripe_payout_account:
      farmer?.stripe_payout_account || farmer?.stripePayoutAccount || "",
    stripe_payout_account_last4:
      farmer?.stripe_payout_account_last4 ||
      farmer?.stripePayoutAccountLast4 ||
      "",
    stripe_payout_bank_name:
      farmer?.stripe_payout_bank_name || farmer?.stripePayoutBankName || "",

    subscriptionStatus:
      farmer?.subscriptionStatus || farmer?.subscription_status || "",
    subscription_status:
      farmer?.subscription_status || farmer?.subscriptionStatus || "",
    farmerMembershipPaid:
      farmer?.farmerMembershipPaid || farmer?.farmer_membership_paid || false,
    farmer_membership_paid:
      farmer?.farmer_membership_paid || farmer?.farmerMembershipPaid || false,
    monthlyMembershipStarted:
      farmer?.monthlyMembershipStarted ||
      farmer?.monthly_membership_started ||
      false,
    monthly_membership_started:
      farmer?.monthly_membership_started ||
      farmer?.monthlyMembershipStarted ||
      false,
    applicationFeePaid:
      farmer?.applicationFeePaid || farmer?.application_fee_paid || false,
    application_fee_paid:
      farmer?.application_fee_paid || farmer?.applicationFeePaid || false,
  };
}

export default function FarmerProfile() {
  const [farmer, setFarmer] = useState<any>(null);
  const [allFarmers, setAllFarmers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [logo, setLogo] = useState<UploadedFile | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const approvalStatus = useMemo(() => {
    if (!farmer) return "Unknown";

    if (
      farmer.approved === true ||
      farmer.accountActive === true ||
      farmer.account_active === true ||
      farmer.storeUnlocked === true ||
      farmer.store_unlocked === true ||
      farmer.complianceStatus === "approved" ||
      farmer.complianceStatus === "ACTIVE" ||
      farmer.compliance_status === "ACTIVE" ||
      farmer.adminReviewStatus === "approved" ||
      farmer.adminReviewStatus === "ACTIVE" ||
      farmer.reviewDecision === "approved" ||
      farmer.reviewDecision === "APPROVED"
    ) {
      return "Approved";
    }

    if (
      farmer.rejected === true ||
      farmer.complianceStatus === "rejected" ||
      farmer.adminReviewStatus === "rejected" ||
      farmer.reviewDecision === "rejected"
    ) {
      return "Rejected";
    }

    return farmer.status || farmer.complianceStatus || "In Progress";
  }, [farmer]);

  const storeUnlocked = useMemo(() => {
    return (
      farmer?.approved === true ||
      farmer?.accountActive === true ||
      farmer?.account_active === true ||
      farmer?.storeUnlocked === true ||
      farmer?.store_unlocked === true ||
      farmer?.adminReviewStatus === "approved" ||
      farmer?.adminReviewStatus === "ACTIVE" ||
      farmer?.reviewDecision === "approved" ||
      farmer?.reviewDecision === "APPROVED"
    );
  }, [farmer]);

  const membershipStatus = useMemo(() => {
    return (
      farmer?.membershipStatus ||
      farmer?.subscriptionStatus ||
      farmer?.subscription_status ||
      farmer?.farmerMembershipStatus ||
      (storeUnlocked ? "Membership available after approval" : "Starts after approval")
    );
  }, [farmer, storeUnlocked]);

  useFocusEffect(
    useCallback(() => {
      loadFarmer();
    }, [])
  );

  async function loadFarmer() {
    try {
      const savedCurrentFarmer = await AsyncStorage.getItem("currentFarmer");
      const savedCurrentUser = await AsyncStorage.getItem("currentUser");
      const savedPendingFarmer = await AsyncStorage.getItem("pendingFarmerApplication");
      const savedFarmers = await AsyncStorage.getItem("farm2homeFarmers");

      const farmers = savedFarmers ? JSON.parse(savedFarmers) : [];
      const safeFarmers = Array.isArray(farmers) ? farmers : [];
      setAllFarmers(safeFarmers);

      let current = savedCurrentFarmer ? JSON.parse(savedCurrentFarmer) : null;

      if (!current && savedCurrentUser) current = JSON.parse(savedCurrentUser);
      if (!current && savedPendingFarmer) current = JSON.parse(savedPendingFarmer);
      if (!current && safeFarmers.length > 0) current = safeFarmers[safeFarmers.length - 1];

      if (!current) return;

      const farmerId = getFarmerId(current);
      const farmerEmail = normalizeEmail(current.email);

      let supabaseFarmer: any = null;

      if (farmerId) {
        const { data } = await supabase
          .from("farmers")
          .select("*")
          .eq("id", farmerId)
          .maybeSingle();

        if (data) supabaseFarmer = data;
      }

      if (!supabaseFarmer && farmerEmail) {
        const { data } = await supabase
          .from("farmers")
          .select("*")
          .eq("email", farmerEmail)
          .maybeSingle();

        if (data) supabaseFarmer = data;
      }

      const merged = {
        ...current,
        ...(supabaseFarmer || {}),
        id: supabaseFarmer?.id || current.id || current.farmerId,
        farmerId: supabaseFarmer?.id || current.farmerId || current.id,
        farmName:
          supabaseFarmer?.farm_name ||
          current.farmName ||
          current.businessName ||
          "",
        businessName:
          supabaseFarmer?.business_name ||
          supabaseFarmer?.farm_name ||
          current.businessName ||
          current.farmName ||
          "",
        ownerName: supabaseFarmer?.owner_name || current.ownerName || "",
        username: supabaseFarmer?.username || current.username || "",
        email: normalizeEmail(supabaseFarmer?.email || current.email || ""),
        phone: supabaseFarmer?.phone || current.phone || "",
        address:
          supabaseFarmer?.address ||
          supabaseFarmer?.business_address ||
          current.address ||
          current.businessAddress ||
          "",
        logoUrl: getLogoUrl(supabaseFarmer) || getLogoUrl(current),
        farmLogoUrl: getLogoUrl(supabaseFarmer) || getLogoUrl(current),
        logo_url: getLogoUrl(supabaseFarmer) || getLogoUrl(current),
        farm_logo_url: getLogoUrl(supabaseFarmer) || getLogoUrl(current),
        selectedProducts:
          supabaseFarmer?.selected_products ||
          current.selectedProducts ||
          current.selected_products ||
          [],
        products: current.products || supabaseFarmer?.products || [],
        role: "farmer",
      };

      setFarmer(merged);
      setBusinessName(merged.businessName || merged.farmName || "");
      setOwnerName(merged.ownerName || "");
      setUsername(merged.username || "");
      setEmail(merged.email || "");
      setPhone(merged.phone || "");
      setAddress(merged.address || merged.businessAddress || "");
      setLogo(getLogoUrl(merged) ? { name: "farm-logo", uri: getLogoUrl(merged) } : null);
      setSelectedProducts(merged.selectedProducts || []);

      await persistUpdatedFarmer(merged, false);
    } catch (error) {
      console.log("Load farmer profile error:", error);
      Alert.alert("Profile Error", "Unable to load farmer profile.");
    }
  }

  function toggleProduct(product: string) {
    setSelectedProducts((current) =>
      current.includes(product)
        ? current.filter((item) => item !== product)
        : [...current, product]
    );
  }

  async function pickLogo() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("Permission Needed", "Please allow photo access.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setLogo({
          name: `farm-logo-${Date.now()}.jpg`,
          uri: result.assets[0].uri,
          mimeType: "image/jpeg",
        });
      }
    } catch (error) {
      console.log("Pick logo error:", error);
      Alert.alert("Logo Error", "Unable to select logo.");
    }
  }

  async function uriToBlob(uri: string): Promise<Blob> {
    const response = await fetch(uri);
    return await response.blob();
  }

  async function uploadLogoIfNeeded(localLogo: UploadedFile | null, farmerId: string) {
    if (!localLogo?.uri) return "";

    if (localLogo.uri.startsWith("http")) return localLogo.uri;

    const blob = await uriToBlob(localLogo.uri);
    const filePath = `${farmerId}/farm-logo-${Date.now()}.jpg`;

    const { error } = await supabase.storage
      .from(LOGO_BUCKET)
      .upload(filePath, blob, {
        contentType: localLogo.mimeType || "image/jpeg",
        upsert: true,
      });

    if (error) throw error;

    const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(filePath);
    return data.publicUrl;
  }

  async function persistUpdatedFarmer(updatedFarmer: any, updateState = true) {
    const existingIndex = allFarmers.findIndex(
      (item) => getFarmerId(item) === getFarmerId(updatedFarmer)
    );

    const finalFarmers =
      existingIndex >= 0
        ? allFarmers.map((item, index) =>
            index === existingIndex ? updatedFarmer : item
          )
        : [...allFarmers, updatedFarmer];

    await AsyncStorage.setItem("farm2homeFarmers", JSON.stringify(finalFarmers));
    await AsyncStorage.setItem("currentFarmer", JSON.stringify(updatedFarmer));
    await AsyncStorage.setItem("currentUser", JSON.stringify(updatedFarmer));
    await AsyncStorage.setItem("userRole", "farmer");
    await AsyncStorage.setItem("currentUserRole", "farmer");

    if (updateState) {
      setFarmer(updatedFarmer);
      setAllFarmers(finalFarmers);
    }
  }

  async function saveFarmerToSupabase(updatedFarmer: any) {
    const farmerId = getFarmerId(updatedFarmer);

    if (!farmerId) throw new Error("Farmer ID missing. Please login again.");

    const finalLogoUrl = getLogoUrl(updatedFarmer);

    const payload = {
      farm_name: updatedFarmer.farmName || updatedFarmer.businessName || "",
      business_name: updatedFarmer.businessName || updatedFarmer.farmName || "",
      owner_name: updatedFarmer.ownerName || "",
      username: updatedFarmer.username || "",
      email: normalizeEmail(updatedFarmer.email),
      phone: updatedFarmer.phone || "",
      address: updatedFarmer.address || "",
      business_address: updatedFarmer.businessAddress || updatedFarmer.address || "",
      logo_url: finalLogoUrl,
      farm_logo_url: finalLogoUrl,
      selected_products: updatedFarmer.selectedProducts || [],
      account_active: updatedFarmer.accountActive ?? updatedFarmer.account_active ?? true,
      store_unlocked: updatedFarmer.storeUnlocked ?? updatedFarmer.store_unlocked ?? true,
      approved: updatedFarmer.approved ?? true,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("farmers").update(payload).eq("id", farmerId);

    if (error) throw error;
  }

  async function saveProfile() {
    try {
      if (saving) return;
      if (!farmer) {
        Alert.alert("No Farmer", "No farmer profile was found.");
        return;
      }

      if (!businessName.trim()) {
        Alert.alert("Business Name Required", "Please enter your business name.");
        return;
      }

      if (!username.trim()) {
        Alert.alert("Username Required", "Please enter a username.");
        return;
      }

      setSaving(true);

      const farmerId = getFarmerId(farmer);
      const uploadedLogoUrl = await uploadLogoIfNeeded(logo, farmerId);
      const finalLogoUrl = uploadedLogoUrl || getLogoUrl(farmer);

      const updatedFarmer = {
        ...farmer,
        ...getStripeSafeFields(farmer),

        id: farmerId,
        farmerId,
        role: "farmer",

        farmName: businessName.trim(),
        businessName: businessName.trim(),
        ownerName: ownerName.trim(),
        username: username.trim(),
        email: normalizeEmail(email),
        phone: phone.trim(),
        address: address.trim(),
        businessAddress: address.trim(),

        logo: finalLogoUrl ? { name: "farm-logo", uri: finalLogoUrl } : null,
        logoUrl: finalLogoUrl,
        farmLogoUrl: finalLogoUrl,
        logo_url: finalLogoUrl,
        farm_logo_url: finalLogoUrl,

        selectedProducts,
        selected_products: selectedProducts,

        updatedAt: new Date().toISOString(),
      };

      await saveFarmerToSupabase(updatedFarmer);
      await persistUpdatedFarmer(updatedFarmer);

      setLogo(finalLogoUrl ? { name: "farm-logo", uri: finalLogoUrl } : null);

      Alert.alert("Saved", "Farmer profile updated.");
    } catch (error: any) {
      console.log("Save profile error:", error);
      Alert.alert("Save Error", error?.message || "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (!farmer) return;

    if (!currentPassword.trim()) {
      Alert.alert("Current Password Required", "Enter your current password.");
      return;
    }

    if (farmer.password && currentPassword !== farmer.password) {
      Alert.alert("Incorrect Password", "Your current password is incorrect.");
      return;
    }

    if (!newPassword.trim()) {
      Alert.alert("New Password Required", "Enter a new password.");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Password Too Short", "Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Alert.alert("Password Mismatch", "New passwords do not match.");
      return;
    }

    const updatedFarmer = {
      ...farmer,
      password: newPassword,
      updatedAt: new Date().toISOString(),
    };

    await persistUpdatedFarmer(updatedFarmer);

    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");

    Alert.alert("Password Updated", "Your password was changed successfully.");
  }

  async function openUrl(url: string) {
    if (!url) return;

    if (Platform.OS === "web") {
      window.location.href = url;
      return;
    }

    await WebBrowser.openBrowserAsync(url);
  }

  async function manageBilling() {
    const stripeCustomerId =
      farmer?.stripeCustomerId ||
      farmer?.stripe_customer_id ||
      farmer?.customerId ||
      farmer?.farmerStripeCustomerId;

    if (!stripeCustomerId) {
      Alert.alert(
        "No Stripe Customer ID",
        "This farmer does not have a Stripe customer ID saved yet."
      );
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/payments/create-customer-portal-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: stripeCustomerId,
          returnUrl: "farm2home://farmer/profile",
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error || !data.url) {
        Alert.alert("Stripe Error", data.error || "Unable to open billing.");
        return;
      }

      await openUrl(data.url);
    } catch (error: any) {
      Alert.alert("Billing Error", error.message || "Unable to open billing.");
    }
  }

  async function cancelSubscription() {
    const subscriptionId =
      farmer?.stripeSubscriptionId ||
      farmer?.stripe_subscription_id ||
      farmer?.subscriptionId ||
      farmer?.farmerSubscriptionId;

    if (!subscriptionId) {
      Alert.alert("No Subscription", "No active farmer monthly subscription was found.");
      return;
    }

    Alert.alert("Cancel Subscription", "Cancel your farmer monthly membership?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          try {
            const response = await fetch(`${API_BASE_URL}/payments/cancel-subscription`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                subscriptionId,
                farmerId: getFarmerId(farmer),
                role: "farmer",
              }),
            });

            const data = await response.json();

            if (!response.ok || data.error) {
              Alert.alert("Stripe Error", data.error || "Unable to cancel.");
              return;
            }

            const updatedFarmer = {
              ...farmer,
              membershipStatus: "Canceled",
              subscriptionStatus: "canceled",
              subscription_status: "canceled",
              updatedAt: new Date().toISOString(),
            };

            await persistUpdatedFarmer(updatedFarmer);
            Alert.alert("Canceled", "Farmer subscription was canceled.");
          } catch (error: any) {
            Alert.alert("Cancel Error", error.message || "Unable to cancel.");
          }
        },
      },
    ]);
  }

  async function logout() {
    await AsyncStorage.removeItem("currentFarmer");
    await AsyncStorage.removeItem("currentUser");
    await AsyncStorage.removeItem("userRole");
    await AsyncStorage.removeItem("currentUserRole");

    router.replace("/farmer/login" as never);
  }

  function goToStoreSetup() {
    if (!storeUnlocked) {
      Alert.alert("Awaiting Approval", "Your farmer store will unlock after admin approval.");
      router.push("/farmer/awaiting-approval" as never);
      return;
    }

    router.push("/farmer/setup-store" as never);
  }

  if (!farmer) {
    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.content}>
        <Text style={styles.header}>Farmer Profile</Text>
        <Text style={styles.subheader}>No farmer profile found.</Text>

        <TouchableOpacity
          style={styles.greenButton}
          onPress={() => router.push("/farmer/login" as never)}
        >
          <Text style={styles.buttonText}>Go to Farmer Login</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Farmer Profile</Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>Account Status</Text>
        <Text style={styles.statusLine}>Approval: {approvalStatus}</Text>
        <Text style={styles.statusLine}>
          Store: {storeUnlocked ? "Unlocked" : "Locked Until Approval"}
        </Text>
        <Text style={styles.statusLine}>Membership: {membershipStatus}</Text>
        <Text style={styles.statusLine}>
          Stripe Payout:{" "}
          {farmer.stripePayoutsEnabled || farmer.stripe_payouts_enabled
            ? "Payouts Enabled"
            : farmer.stripeAccountId ||
              farmer.farmerStripeAccountId ||
              farmer.stripe_account_id
            ? "Connected / Pending Verification"
            : "Not Connected"}
        </Text>
      </View>

      <View style={styles.logoBox}>
        {logo?.uri ? (
          <Image source={{ uri: logo.uri }} style={styles.logoImage} />
        ) : (
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoPlaceholderText}>No Logo</Text>
          </View>
        )}

        <TouchableOpacity style={styles.darkButton} onPress={pickLogo}>
          <Text style={styles.buttonText}>Update Business Logo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Profile Information</Text>

        <Text style={styles.label}>Username</Text>
        <TextInput style={styles.input} value={username} onChangeText={setUsername} />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Business Name</Text>
        <TextInput style={styles.input} value={businessName} onChangeText={setBusinessName} />

        <Text style={styles.label}>Owner Name</Text>
        <TextInput style={styles.input} value={ownerName} onChangeText={setOwnerName} />

        <Text style={styles.label}>Phone Number</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

        <Text style={styles.label}>Farm / Business Address</Text>
        <TextInput style={styles.input} value={address} onChangeText={setAddress} />

        <TouchableOpacity style={styles.greenButton} onPress={saveProfile} disabled={saving}>
          <Text style={styles.buttonText}>{saving ? "Saving..." : "Save Profile"}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Change Password</Text>

        <TextInput
          style={styles.input}
          placeholder="Current password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
        />

        <TextInput
          style={styles.input}
          placeholder="New password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm new password"
          value={confirmNewPassword}
          onChangeText={setConfirmNewPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.blueButton} onPress={changePassword}>
          <Text style={styles.buttonText}>Change Password</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Manage Subscription</Text>
        <Text style={styles.helpText}>
          The $14.99 monthly farmer membership starts after admin approval.
        </Text>

        <TouchableOpacity style={styles.blueButton} onPress={manageBilling}>
          <Text style={styles.buttonText}>Manage Subscription / Update Card</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={cancelSubscription}>
          <Text style={styles.buttonText}>Cancel Farmer Subscription</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Products You Sell</Text>

        {Object.keys(editableProductCatalog).map((category) => (
          <View key={category}>
            <Text style={styles.categoryTitle}>{category}</Text>

            <View style={styles.productGrid}>
              {editableProductCatalog[category].map((product) => {
                const selected = selectedProducts.includes(product);

                return (
                  <TouchableOpacity
                    key={product}
                    style={[styles.productCard, selected && styles.productCardSelected]}
                    onPress={() => toggleProduct(product)}
                  >
                    <Text style={styles.productName}>{product}</Text>
                    {selected && <Text style={styles.selectedTag}>Selected</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.greenButton} onPress={saveProfile} disabled={saving}>
          <Text style={styles.buttonText}>{saving ? "Saving..." : "Save Products"}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.greenButton} onPress={goToStoreSetup}>
        <Text style={styles.buttonText}>
          {storeUnlocked ? "Go to Store Setup" : "Store Locked - Awaiting Approval"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.outlineButton}
        onPress={() => router.push("/customer/marketplace" as never)}
      >
        <Text style={styles.outlineText}>View Marketplace</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F7F7F2" },
  content: { padding: 22, paddingBottom: 70 },
  header: {
    fontSize: 30,
    fontWeight: "900",
    color: "#2F7D32",
    marginBottom: 8,
  },
  subheader: {
    color: "#666",
    marginBottom: 20,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
  },
  statusCard: {
    backgroundColor: "#E8F5E9",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#B7DFB9",
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#14532D",
    marginBottom: 8,
  },
  statusLine: {
    fontWeight: "900",
    color: "#14532D",
    marginBottom: 5,
  },
  logoBox: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#eee",
    alignItems: "center",
    marginBottom: 16,
  },
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: 22,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  logoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 22,
    marginBottom: 12,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  logoPlaceholderText: {
    color: "#2F7D32",
    fontWeight: "900",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 12,
    color: "#222",
  },
  label: {
    fontWeight: "900",
    color: "#222",
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    fontWeight: "700",
  },
  helpText: {
    color: "#4B5563",
    fontWeight: "700",
    lineHeight: 21,
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 17,
    fontWeight: "900",
    marginTop: 14,
    marginBottom: 8,
  },
  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  productCard: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    minWidth: "30%",
  },
  productCardSelected: {
    backgroundColor: "#E8F5E9",
    borderColor: "#2F7D32",
  },
  productName: {
    color: "#222",
    fontWeight: "700",
  },
  selectedTag: {
    color: "#2F7D32",
    fontWeight: "900",
    fontSize: 12,
    marginTop: 4,
  },
  greenButton: {
    backgroundColor: "#2F7D32",
    padding: 16,
    borderRadius: 14,
    marginTop: 14,
  },
  darkButton: {
    backgroundColor: "#111",
    padding: 14,
    borderRadius: 14,
    width: "100%",
  },
  blueButton: {
    backgroundColor: "#1565C0",
    padding: 16,
    borderRadius: 14,
    marginTop: 10,
  },
  cancelButton: {
    backgroundColor: "#D32F2F",
    padding: 16,
    borderRadius: 14,
    marginTop: 10,
  },
  logoutButton: {
    backgroundColor: "#111827",
    padding: 16,
    borderRadius: 14,
    marginTop: 10,
  },
  outlineButton: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2F7D32",
    marginTop: 10,
  },
  outlineText: {
    color: "#2F7D32",
    textAlign: "center",
    fontWeight: "900",
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "900",
  },
});