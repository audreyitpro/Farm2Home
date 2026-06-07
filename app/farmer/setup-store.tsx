// app/farmer/setup-store.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, router } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import {
  Farmer,
  addFarmer,
  getFarmerById,
  updateFarmerStore,
} from "../data/farmerStore";
import { supabase } from "../data/supabaseClient";

const LOGO_BUCKET = "farm-logos";

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
  blue: "#2563EB",
};

export default function FarmerSetupStoreScreen() {
  const params = useLocalSearchParams();

  const farmerIdFromParams = useMemo(() => {
    const value = params.farmerId || params.id;
    return Array.isArray(value) ? value[0] : value ? String(value) : "";
  }, [params]);

  const [loading, setLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [currentFarmer, setCurrentFarmer] = useState<Farmer | null>(null);

  const [ownerName, setOwnerName] = useState("");
  const [farmName, setFarmName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [farmLocation, setFarmLocation] = useState("");
  const [about, setAbout] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const [pickup, setPickup] = useState(true);
  const [delivery, setDelivery] = useState(true);

  useEffect(() => {
    initializeScreen();
  }, [farmerIdFromParams]);

  async function initializeScreen() {
    try {
      const saved =
        (await AsyncStorage.getItem("currentFarmer")) ||
        (await AsyncStorage.getItem("currentUser"));

      if (!saved && !farmerIdFromParams) {
        Alert.alert("Session Needed", "Please login again.");
        router.replace("/farmer/login" as any);
        return;
      }

      await loadFarmer();
    } catch (error) {
      console.log("Initialize setup store error:", error);
      Alert.alert("Access Error", "Unable to verify farmer profile.");
    }
  }

  function mapSupabaseFarmer(row: any): Farmer {
    return {
      id: row.id,
      farmerId: row.id,
      ownerName: row.owner_name || row.ownerName || "",
      farmName: row.farm_name || row.farmName || row.business_name || "",
      businessName: row.business_name || row.businessName || row.farm_name || "",
      email: row.email || "",
      phone: row.phone || "",
      username: row.username || row.email || "",
      password: "",
      accountActive: Boolean(row.account_active || row.accountActive),
      approved: Boolean(row.approved),
      rejected: Boolean(row.rejected),
      reviewed: Boolean(row.reviewed),
      needsMoreInfo: Boolean(row.needs_more_info || row.needsMoreInfo),
      storeUnlocked: Boolean(row.store_unlocked || row.storeUnlocked),
      complianceSubmitted: Boolean(row.compliance_submitted || row.complianceSubmitted),
      complianceStatus: row.compliance_status || row.complianceStatus || "",
      adminReviewStatus: row.admin_review_status || row.adminReviewStatus || "",
      reviewDecision: row.review_decision || row.reviewDecision || "",
      applicationFeePaid: Boolean(row.application_fee_paid || row.applicationFeePaid),
      farmerMembershipPaid: Boolean(row.farmer_membership_paid || row.farmerMembershipPaid),
      monthlyMembershipStarted: Boolean(
        row.monthly_membership_started || row.monthlyMembershipStarted
      ),
      farmLocation: row.farm_location || row.farmLocation || row.location || "",
      location: row.location || row.farm_location || row.farmLocation || "",
      about: row.about || "",
      logoUrl: row.logo_url || row.farm_logo_url || row.logoUrl || row.farmLogoUrl || "",
      farmLogoUrl: row.farm_logo_url || row.logo_url || row.farmLogoUrl || row.logoUrl || "",
      logo_url: row.logo_url || row.farm_logo_url || row.logoUrl || row.farmLogoUrl || "",
      farm_logo_url: row.farm_logo_url || row.logo_url || row.farmLogoUrl || row.logoUrl || "",
      pickup: row.pickup !== false,
      delivery: row.delivery !== false,
      stripeAccountId: row.stripe_account_id || row.farmer_stripe_account_id || "",
      farmerStripeAccountId: row.farmer_stripe_account_id || row.stripe_account_id || "",
      stripePayoutAccount: row.stripe_payout_account || "",
      stripePayoutAccountLast4: row.stripe_payout_account_last4 || "",
      stripePayoutBankName: row.stripe_payout_bank_name || "",
      stripeOnboardingComplete: Boolean(row.stripe_onboarding_complete),
      stripeChargesEnabled: Boolean(row.stripe_charges_enabled),
      stripePayoutsEnabled: Boolean(row.stripe_payouts_enabled),
      products: row.products || [],
      reviews: row.reviews || 0,
      rating: row.rating || 4.8,
      distanceMiles: row.distance_miles || row.distanceMiles || 5,
      itemsSold: row.items_sold || row.itemsSold || 0,
      revenue: row.revenue || 0,
      createdAt: row.created_at || row.createdAt || new Date().toISOString(),
      updatedAt: row.updated_at || row.updatedAt || new Date().toISOString(),
    } as any;
  }

  async function getFarmerFromSupabase(activeFarmerId: string, savedEmail?: string) {
    if (activeFarmerId) {
      const { data, error } = await supabase
        .from("farmers")
        .select("*")
        .eq("id", activeFarmerId)
        .maybeSingle();

      if (!error && data) return mapSupabaseFarmer(data);
    }

    if (savedEmail) {
      const { data, error } = await supabase
        .from("farmers")
        .select("*")
        .eq("email", String(savedEmail).trim().toLowerCase())
        .maybeSingle();

      if (!error && data) return mapSupabaseFarmer(data);
    }

    return null;
  }

  async function loadFarmer() {
    try {
      const saved =
        (await AsyncStorage.getItem("currentFarmer")) ||
        (await AsyncStorage.getItem("currentUser"));

      const parsed = saved ? JSON.parse(saved) : null;
      const activeFarmerId = farmerIdFromParams || parsed?.id || parsed?.farmerId || "";

      let farmer: Farmer | null =
        (await getFarmerFromSupabase(activeFarmerId, parsed?.email)) || null;

      if (!farmer && activeFarmerId) {
        farmer = (await getFarmerById(activeFarmerId)) || null;
      }

      if (!farmer && parsed?.id) {
        farmer = parsed;
      }

      if (!farmer) {
        Alert.alert("Farmer Not Found", "Please login again.");
        router.replace("/farmer/login" as any);
        return;
      }

      const farmerAny = farmer as any;

      const loadedLogo =
        farmerAny.logoUrl ||
        farmerAny.farmLogoUrl ||
        farmerAny.logo_url ||
        farmerAny.farm_logo_url ||
        "";

      const fixedFarmer = {
        ...farmer,
        id: farmer.id || farmerAny.farmerId || activeFarmerId,
        farmerId: farmerAny.farmerId || farmer.id || activeFarmerId,
        role: "farmer",
        logoUrl: loadedLogo,
        farmLogoUrl: loadedLogo,
        logo_url: loadedLogo,
        farm_logo_url: loadedLogo,
        accountActive: true,
        account_active: true,
        storeUnlocked: true,
        store_unlocked: true,
      } as any;

      setCurrentFarmer(fixedFarmer);

      await AsyncStorage.setItem("currentFarmer", JSON.stringify(fixedFarmer));
      await AsyncStorage.setItem("currentUser", JSON.stringify(fixedFarmer));
      await AsyncStorage.setItem("userRole", "farmer");
      await AsyncStorage.setItem("currentUserRole", "farmer");

      setOwnerName(fixedFarmer.ownerName || fixedFarmer.owner_name || "");
      setFarmName(
        fixedFarmer.farmName ||
          fixedFarmer.farm_name ||
          fixedFarmer.businessName ||
          fixedFarmer.business_name ||
          ""
      );
      setEmail(String(fixedFarmer.email || "").trim().toLowerCase());
      setPhone(fixedFarmer.phone || "");
      setFarmLocation(
        fixedFarmer.farmLocation ||
          fixedFarmer.farm_location ||
          fixedFarmer.location ||
          ""
      );
      setAbout(fixedFarmer.about || "");
      setLogoUrl(loadedLogo);
      setPickup(fixedFarmer.pickup !== false);
      setDelivery(fixedFarmer.delivery !== false);
    } catch (error: any) {
      console.log("Load farmer error:", error);
      Alert.alert("Error", error?.message || "Unable to load farmer setup.");
    }
  }

  async function uriToBlob(uri: string): Promise<Blob> {
    const response = await fetch(uri);
    return await response.blob();
  }

  function getFileExt(uri: string) {
    const clean = uri.split("?")[0];
    const ext = clean.split(".").pop()?.toLowerCase();
    if (ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp") {
      return ext === "jpg" ? "jpeg" : ext;
    }
    return "jpeg";
  }

  async function uploadLogoToStorage(localUri: string) {
    if (!localUri || localUri.startsWith("http")) return localUri;

    if (!currentFarmer?.id) {
      throw new Error("Farmer ID missing. Please login again.");
    }

    setLogoUploading(true);

    const ext = getFileExt(localUri);
    const contentType = `image/${ext}`;
    const filePath = `${currentFarmer.id}/farm-logo-${Date.now()}.${ext}`;
    const blob = await uriToBlob(localUri);

    const { error } = await supabase.storage.from(LOGO_BUCKET).upload(filePath, blob, {
      contentType,
      upsert: true,
    });

    if (error) {
      throw new Error(error.message || "Unable to upload logo.");
    }

    const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(filePath);

    if (!data?.publicUrl) {
      throw new Error("Logo uploaded but public URL was not returned.");
    }

    setLogoUploading(false);
    return data.publicUrl;
  }

  async function pickLogo() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("Permission Needed", "Please allow photo access to upload logo.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: true,
        aspect: [1, 1],
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setLogoUrl(result.assets[0].uri);
      }
    } catch (error: any) {
      Alert.alert("Logo Error", error?.message || "Unable to select logo.");
    }
  }

  function validateRequiredFields() {
    if (!ownerName.trim()) {
      Alert.alert("Missing Owner Name", "Please enter the owner name.");
      return false;
    }

    if (!farmName.trim()) {
      Alert.alert("Missing Farm Name", "Please enter the farm name.");
      return false;
    }

    if (!email.trim()) {
      Alert.alert("Missing Email", "Please enter the farmer email.");
      return false;
    }

    if (!farmLocation.trim()) {
      Alert.alert("Missing Location", "Please enter your farm location.");
      return false;
    }

    return true;
  }

  async function saveFarmerProfile(): Promise<Farmer | null> {
    try {
      if (loading) return null;
      if (!validateRequiredFields()) return null;

      if (!currentFarmer?.id) {
        Alert.alert("Session Error", "Please login again.");
        router.replace("/farmer/login" as any);
        return null;
      }

      setLoading(true);

      let finalLogoUrl = logoUrl.trim();

      if (finalLogoUrl && !finalLogoUrl.startsWith("http")) {
        finalLogoUrl = await uploadLogoToStorage(finalLogoUrl);
        setLogoUrl(finalLogoUrl);
      }

      const now = new Date().toISOString();

      const farmerPayload: Farmer = {
        ...currentFarmer,
        id: currentFarmer.id,
        farmerId: (currentFarmer as any).farmerId || currentFarmer.id,
        role: "farmer",
        ownerName: ownerName.trim(),
        farmName: farmName.trim(),
        businessName: farmName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        username: (currentFarmer as any).username || email.trim().toLowerCase(),
        password: (currentFarmer as any).password || "",
        accountActive: true,
        account_active: true,
        approved: true,
        reviewed: true,
        rejected: false,
        complianceStatus: "ACTIVE",
        compliance_status: "ACTIVE",
        adminReviewStatus: "ACTIVE",
        admin_review_status: "ACTIVE",
        reviewDecision: "APPROVED",
        review_decision: "APPROVED",
        storeUnlocked: true,
        store_unlocked: true,
        farmLocation: farmLocation.trim(),
        location: farmLocation.trim(),
        about: about.trim(),
        logoUrl: finalLogoUrl,
        farmLogoUrl: finalLogoUrl,
        logo_url: finalLogoUrl,
        farm_logo_url: finalLogoUrl,
        pickup,
        delivery,
        products: (currentFarmer as any).products || [],
        reviews: (currentFarmer as any).reviews || 0,
        rating: (currentFarmer as any).rating || 4.8,
        distanceMiles: (currentFarmer as any).distanceMiles || 5,
        itemsSold: (currentFarmer as any).itemsSold || 0,
        revenue: (currentFarmer as any).revenue || 0,
        createdAt: (currentFarmer as any).createdAt || (currentFarmer as any).created_at || now,
        updatedAt: now,
      } as any;

      const supabasePayload = {
        owner_name: ownerName.trim(),
        farm_name: farmName.trim(),
        business_name: farmName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        farm_location: farmLocation.trim(),
        location: farmLocation.trim(),
        about: about.trim(),
        logo_url: finalLogoUrl,
        farm_logo_url: finalLogoUrl,
        pickup,
        delivery,
        approved: true,
        reviewed: true,
        rejected: false,
        account_active: true,
        store_unlocked: true,
        compliance_status: "ACTIVE",
        admin_review_status: "ACTIVE",
        review_decision: "APPROVED",
        updated_at: now,
      };

      const { data: updatedRows, error } = await supabase
        .from("farmers")
        .update(supabasePayload)
        .eq("id", currentFarmer.id)
        .select("*");

      if (error) throw error;

      if (!updatedRows || updatedRows.length === 0) {
        const { error: upsertError } = await supabase.from("farmers").upsert(
          {
            id: currentFarmer.id,
            ...supabasePayload,
            created_at:
              (currentFarmer as any).createdAt ||
              (currentFarmer as any).created_at ||
              now,
          },
          { onConflict: "id" }
        );

        if (upsertError) throw upsertError;
      }

      let savedFarmer = farmerPayload;

      try {
        const updated = await updateFarmerStore(currentFarmer.id, farmerPayload);
        savedFarmer =
          updated.find((item) => item.id === currentFarmer.id) || farmerPayload;
      } catch {
        const updated = await addFarmer(farmerPayload);
        savedFarmer =
          updated.find((item) => item.id === farmerPayload.id) || farmerPayload;
      }

      setCurrentFarmer(savedFarmer);

      await AsyncStorage.setItem("currentFarmer", JSON.stringify(savedFarmer));
      await AsyncStorage.setItem("currentUser", JSON.stringify(savedFarmer));
      await AsyncStorage.setItem("userRole", "farmer");
      await AsyncStorage.setItem("currentUserRole", "farmer");

      Alert.alert("Saved", "Farmer store setup saved.");
      return savedFarmer;
    } catch (error: any) {
      console.log("Save farmer profile error:", error);
      Alert.alert("Save Error", error?.message || "Unable to save farmer.");
      return null;
    } finally {
      setLoading(false);
      setLogoUploading(false);
    }
  }

  async function saveAndGoToProduce() {
    const farmer = await saveFarmerProfile();
    if (!farmer?.id) return;

    router.push({
      pathname: "/farmer/select-produce",
      params: { farmerId: farmer.id },
    } as any);
  }

  async function saveAndGoToCustomProduct() {
    const farmer = await saveFarmerProfile();
    if (!farmer?.id) return;

    router.push({
      pathname: "/farmer/add-product",
      params: { farmerId: farmer.id },
    } as any);
  }

  async function saveAndGoToDashboard() {
    const farmer = await saveFarmerProfile();
    if (!farmer?.id) return;

    router.push({
      pathname: "/farmer/dashboard",
      params: { farmerId: farmer.id },
    } as any);
  }

  const stripeConnected = Boolean(
    (currentFarmer as any)?.stripeAccountId ||
      (currentFarmer as any)?.farmerStripeAccountId
  );

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [styles.backCircle, pressed && styles.pressed]}
            onPress={() => router.back()}
          >
            <Text style={styles.backCircleText}>‹</Text>
          </Pressable>

          <View style={styles.topTitleBlock}>
            <Text style={styles.title}>Store Setup</Text>
            <Text style={styles.subtitle}>Compact seller profile</Text>
          </View>
        </View>

        <View style={styles.statusStrip}>
          <Text style={styles.statusDot}>●</Text>
          <Text style={styles.statusStripText}>Store Active</Text>
          <Text style={styles.statusDivider}>•</Text>
          <Text style={styles.statusStripText}>
            Stripe {stripeConnected ? "Connected" : "Pending"}
          </Text>
          <Text style={styles.statusDivider}>•</Text>
          <Text style={styles.statusStripText}>
            Logo {logoUrl ? "Ready" : "Needed"}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Farm Logo</Text>

          <View style={styles.logoRow}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.logoPreview} />
            ) : (
              <View style={styles.logoEmpty}>
                <Text style={styles.logoEmptyText}>🚜</Text>
              </View>
            )}

            <View style={styles.logoTextBlock}>
              <Text style={styles.logoTitle}>Store Logo</Text>
              <Text style={styles.logoSubtitle}>
                Small logo shown in customer marketplace.
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.smallOutlineButton,
                  pressed && styles.pressed,
                  logoUploading && styles.disabledButton,
                ]}
                onPress={pickLogo}
                disabled={logoUploading || loading}
              >
                <Text style={styles.smallOutlineText}>
                  {logoUploading ? "Uploading..." : logoUrl ? "Change Logo" : "Upload Logo"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Farm Profile</Text>

          <Text style={styles.label}>Owner Name</Text>
          <TextInput
            style={styles.input}
            value={ownerName}
            onChangeText={setOwnerName}
            placeholder="Owner name"
            placeholderTextColor="#8A9482"
          />

          <Text style={styles.label}>Farm Name</Text>
          <TextInput
            style={styles.input}
            value={farmName}
            onChangeText={setFarmName}
            placeholder="Farm name"
            placeholderTextColor="#8A9482"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="farmer@email.com"
            placeholderTextColor="#8A9482"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone number"
            placeholderTextColor="#8A9482"
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Farm Location</Text>
          <TextInput
            style={styles.input}
            value={farmLocation}
            onChangeText={setFarmLocation}
            placeholder="City, State"
            placeholderTextColor="#8A9482"
          />

          <Text style={styles.label}>About Farm</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={about}
            onChangeText={setAbout}
            placeholder="Tell customers about your farm"
            placeholderTextColor="#8A9482"
            multiline
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Pickup / Delivery</Text>

          <View style={styles.optionRow}>
            <View style={styles.optionTextBlock}>
              <Text style={styles.optionTitle}>Allow Pickup</Text>
              <Text style={styles.optionSubtitle}>Customers can pick up from your farm.</Text>
            </View>
            <Switch value={pickup} onValueChange={setPickup} />
          </View>

          <View style={styles.optionRow}>
            <View style={styles.optionTextBlock}>
              <Text style={styles.optionTitle}>Allow Delivery</Text>
              <Text style={styles.optionSubtitle}>Orders can be delivered by your team or drivers.</Text>
            </View>
            <Switch value={delivery} onValueChange={setDelivery} />
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [
              styles.compactButton,
              pressed && styles.pressed,
              loading && styles.disabledButton,
            ]}
            onPress={saveFarmerProfile}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.compactButtonText}>Save</Text>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.compactButton,
              pressed && styles.pressed,
              loading && styles.disabledButton,
            ]}
            onPress={saveAndGoToProduce}
            disabled={loading}
          >
            <Text style={styles.compactButtonText}>Produce</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.compactButton,
              pressed && styles.pressed,
              loading && styles.disabledButton,
            ]}
            onPress={saveAndGoToDashboard}
            disabled={loading}
          >
            <Text style={styles.compactButtonText}>Dashboard</Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.customProductButton, pressed && styles.pressed]}
          onPress={saveAndGoToCustomProduct}
          disabled={loading}
        >
          <Text style={styles.customProductText}>Add Custom Product</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.backTextButton, pressed && styles.pressed]}
          onPress={() => router.back()}
        >
          <Text style={styles.backTextButtonText}>Go Back</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  container: { padding: 14, paddingBottom: 34 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
  },
  backCircle: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backCircleText: {
    fontSize: 28,
    color: COLORS.text,
    fontWeight: "900",
    marginTop: -4,
  },
  topTitleBlock: { flex: 1 },
  title: { fontSize: 24, fontWeight: "900", color: COLORS.text },
  subtitle: { color: COLORS.muted, fontWeight: "700", marginTop: 2, fontSize: 12 },

  statusStrip: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  statusDot: { color: COLORS.primary, fontSize: 12 },
  statusStripText: { color: COLORS.text, fontWeight: "900", fontSize: 12 },
  statusDivider: { color: COLORS.muted, fontWeight: "900" },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: 10,
  },

  logoRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  logoPreview: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: COLORS.softGreen,
  },
  logoEmpty: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: COLORS.softGreen,
    justifyContent: "center",
    alignItems: "center",
  },
  logoEmptyText: { fontSize: 25 },
  logoTextBlock: { flex: 1 },
  logoTitle: { color: COLORS.text, fontWeight: "900", fontSize: 15 },
  logoSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 3,
    fontSize: 12,
  },
  smallOutlineButton: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 9,
    alignItems: "center",
    marginTop: 9,
  },
  smallOutlineText: { color: COLORS.primaryDark, fontWeight: "900", fontSize: 13 },

  label: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.muted,
    marginBottom: 5,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.lightGreen,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 8,
    fontWeight: "700",
  },
  textArea: { height: 82, textAlignVertical: "top" },

  optionRow: {
    backgroundColor: COLORS.lightGreen,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  optionTextBlock: { flex: 1 },
  optionTitle: { fontSize: 14, color: COLORS.text, fontWeight: "900" },
  optionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 2,
    fontSize: 11,
  },

  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
    marginBottom: 10,
  },
  compactButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  compactButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 14,
  },
  customProductButton: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  customProductText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 14,
  },
  backTextButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  backTextButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "900",
  },
  disabledButton: { opacity: 0.6 },
  pressed: { opacity: 0.75 },
});