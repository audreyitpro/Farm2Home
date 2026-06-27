// app/farmer/setup-store.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { supabase } from "../data/supabaseClient";

const LOGO_BUCKET = "farm-logos";

const COLORS = {
  bg: "#F6F8F2",
  card: "#FFFFFF",
  surface: "#F9FBF4",
  green: "#1FA463",
  greenDark: "#0B5D35",
  greenSoft: "#E9F8EF",
  lime: "#DDF8C8",
  orange: "#FFB74A",
  orangeSoft: "#FFF3DE",
  red: "#EF4444",
  text: "#162115",
  muted: "#667085",
  border: "#E3E8DD",
  white: "#FFFFFF",
};

type FarmerRecord = {
  id?: string;
  farmerId?: string;
  farmer_id?: string;
  auth_user_id?: string;
  profile_id?: string;
  role?: string;
  owner_name?: string;
  ownerName?: string;
  full_name?: string;
  name?: string;
  farm_name?: string;
  farmName?: string;
  business_name?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  username?: string;
  farm_location?: string;
  farmLocation?: string;
  location?: string;
  city?: string;
  state?: string;
  about?: string;
  logo_url?: string;
  farm_logo_url?: string;
  logoUrl?: string;
  farmLogoUrl?: string;
  pickup?: boolean;
  delivery?: boolean;
  allow_pickup?: boolean;
  allow_delivery?: boolean;
  pickup_enabled?: boolean;
  delivery_enabled?: boolean;
  store_active?: boolean;
  marketplace_visible?: boolean;
  farmer_email?: string;
  about_farm?: string;
  description?: string;
  account_active?: boolean;
  approved?: boolean;
  reviewed?: boolean;
  rejected?: boolean;
  store_unlocked?: boolean;
  compliance_status?: string;
  admin_review_status?: string;
  review_decision?: string;
  stripe_account_id?: string;
  farmer_stripe_account_id?: string;
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function firstParam(value: any) {
  if (Array.isArray(value)) return value[0] || "";
  return value ? String(value) : "";
}

function getFarmerId(farmer?: FarmerRecord | null) {
  return clean(
    farmer?.id ||
      farmer?.farmerId ||
      farmer?.farmer_id ||
      farmer?.profile_id ||
      farmer?.auth_user_id
  );
}

function getFarmName(farmer?: FarmerRecord | null) {
  return (
    clean(farmer?.farm_name || farmer?.farmName) ||
    clean(farmer?.business_name || farmer?.businessName) ||
    clean(farmer?.owner_name || farmer?.ownerName) ||
    clean(farmer?.full_name || farmer?.name) ||
    ""
  );
}

function getLogo(farmer?: FarmerRecord | null) {
  return clean(farmer?.logo_url || farmer?.farm_logo_url || farmer?.logoUrl || farmer?.farmLogoUrl);
}

function getStripeAccount(farmer?: FarmerRecord | null) {
  return clean(farmer?.stripe_account_id || farmer?.farmer_stripe_account_id);
}

function isValidEmail(value: string) {
  return /\S+@\S+\.\S+/.test(value);
}

export default function FarmerSetupStoreScreen() {
  const params = useLocalSearchParams();

  const farmerIdFromParams = useMemo(() => {
    return firstParam(params.farmerId || params.id);
  }, [params]);

  const [loading, setLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [currentFarmer, setCurrentFarmer] = useState<FarmerRecord | null>(null);

  const [ownerName, setOwnerName] = useState("");
  const [farmName, setFarmName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [farmLocation, setFarmLocation] = useState("");
  const [about, setAbout] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [pickup, setPickup] = useState(true);
  const [delivery, setDelivery] = useState(true);

  const farmerId = getFarmerId(currentFarmer);
  const stripeConnected = Boolean(getStripeAccount(currentFarmer));

  const completionItems = useMemo(
    () => [
      { label: "Owner", done: Boolean(ownerName.trim()) },
      { label: "Farm", done: Boolean(farmName.trim()) },
      { label: "Email", done: isValidEmail(email) },
      { label: "Location", done: Boolean(farmLocation.trim()) },
      { label: "Logo", done: Boolean(logoUrl.trim()) },
      { label: "Fulfillment", done: pickup || delivery },
    ],
    [ownerName, farmName, email, farmLocation, logoUrl, pickup, delivery]
  );

  const completion = completionItems.filter((item) => item.done).length;
  const completionPercent = Math.round((completion / completionItems.length) * 100);

  useEffect(() => {
    initializeScreen();
  }, [farmerIdFromParams]);

  async function initializeScreen() {
    try {
      setLoading(true);

      const local = await readLocalFarmer();
      const dbFarmer = await findSupabaseFarmer(local);

      const merged: FarmerRecord = {
        ...(local || {}),
        ...(dbFarmer || {}),
        id: clean(dbFarmer?.id || dbFarmer?.farmer_id || local?.id || local?.farmerId || local?.farmer_id || farmerIdFromParams),
        farmerId: clean(dbFarmer?.id || dbFarmer?.farmer_id || local?.id || local?.farmerId || local?.farmer_id || farmerIdFromParams),
        farmer_id: clean(dbFarmer?.farmer_id || local?.farmer_id || dbFarmer?.id || local?.id || local?.farmerId || farmerIdFromParams),
        role: "farmer",
      };

      if (!getFarmerId(merged)) {
        Alert.alert("Session Needed", "Please login again.");
        router.replace("/farmer/login" as any);
        return;
      }

      hydrate(merged);
      await saveFarmerSession(merged);
    } catch (error: any) {
      console.log("Initialize setup store error:", error);
      Alert.alert("Access Error", error?.message || "Unable to verify farmer profile.");
    } finally {
      setLoading(false);
    }
  }

  async function readLocalFarmer() {
    const raw =
      (await AsyncStorage.getItem("currentFarmer")) ||
      (await AsyncStorage.getItem("farm2homeCurrentFarmer")) ||
      (await AsyncStorage.getItem("farm2homeFarmerSession")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function findFarmerByColumn(column: string, value: string) {
    if (!value) return null;

    try {
      const { data, error } = await supabase
        .from("farmers")
        .select("*")
        .eq(column, value)
        .maybeSingle();

      if (!error && data) return data;
      if (error) console.log(`farmers lookup ${column} skipped:`, error.message);
    } catch (error: any) {
      console.log(`farmers lookup ${column} exception skipped:`, error?.message || error);
    }

    return null;
  }

  async function findSupabaseFarmer(local: any) {
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;

    const ids = Array.from(
      new Set(
        [
          farmerIdFromParams,
          local?.id,
          local?.farmerId,
          local?.farmer_id,
          local?.profile_id,
          local?.auth_user_id,
          authUser?.id,
        ]
          .map(clean)
          .filter(Boolean)
      )
    );

    const activeEmail = normalize(local?.email || local?.farmer_email || authUser?.email);

    for (const id of ids) {
      const byId = await findFarmerByColumn("id", id);
      if (byId) return byId;

      const byFarmerId = await findFarmerByColumn("farmer_id", id);
      if (byFarmerId) return byFarmerId;

      const byProfileId = await findFarmerByColumn("profile_id", id);
      if (byProfileId) return byProfileId;

      const byAuth = await findFarmerByColumn("auth_user_id", id);
      if (byAuth) return byAuth;
    }

    if (activeEmail) {
      const byEmail = await findFarmerByColumn("email", activeEmail);
      if (byEmail) return byEmail;

      const byFarmerEmail = await findFarmerByColumn("farmer_email", activeEmail);
      if (byFarmerEmail) return byFarmerEmail;
    }

    return null;
  }

  function hydrate(farmer: FarmerRecord) {
    const loadedName = getFarmName(farmer);
    const loadedLogo = getLogo(farmer);

    setCurrentFarmer(farmer);
    setOwnerName(clean(farmer.owner_name || farmer.ownerName || farmer.full_name || farmer.name));
    setFarmName(loadedName);
    setEmail(normalize(farmer.email));
    setPhone(clean(farmer.phone));
    setFarmLocation(clean(farmer.farm_location || farmer.farmLocation || farmer.location || [farmer.city, farmer.state].filter(Boolean).join(", ")));
    setAbout(clean(farmer.about || farmer.about_farm || farmer.description));
    setLogoUrl(loadedLogo);
    setPickup(farmer.pickup !== false && farmer.allow_pickup !== false && farmer.pickup_enabled !== false);
    setDelivery(farmer.delivery !== false && farmer.allow_delivery !== false && farmer.delivery_enabled !== false);
  }

  async function saveFarmerSession(farmer: FarmerRecord) {
    const normalized = {
      ...farmer,
      id: getFarmerId(farmer),
      farmerId: getFarmerId(farmer),
      farmer_id: getFarmerId(farmer),
      role: "farmer",
      email: normalize(farmer.email || farmer.farmer_email),
    };

    await AsyncStorage.multiSet([
      ["currentFarmer", JSON.stringify(normalized)],
      ["farm2homeCurrentFarmer", JSON.stringify(normalized)],
      ["farm2homeFarmerSession", JSON.stringify(normalized)],
      ["currentUser", JSON.stringify(normalized)],
      ["userRole", "farmer"],
      ["currentUserRole", "farmer"],
    ]);

    setCurrentFarmer(normalized);
    return normalized;
  }

  async function uriToBlob(uri: string): Promise<Blob> {
    const response = await fetch(uri);
    return await response.blob();
  }

  function getFileExt(uri: string) {
    const cleanUri = uri.split("?")[0];
    const ext = cleanUri.split(".").pop()?.toLowerCase();
    if (["jpg", "jpeg", "png", "webp"].includes(ext || "")) return ext === "jpg" ? "jpeg" : ext || "jpeg";
    return "jpeg";
  }

  async function uploadLogoToStorage(localUri: string) {
    if (!localUri || localUri.startsWith("http")) return localUri;

    const activeFarmerId = getFarmerId(currentFarmer);

    if (!activeFarmerId) {
      throw new Error("Farmer ID missing. Please login again.");
    }

    setLogoUploading(true);

    const ext = getFileExt(localUri);
    const contentType = `image/${ext}`;
    const filePath = `${activeFarmerId}/farm-logo-${Date.now()}.${ext}`;
    const blob = await uriToBlob(localUri);

    const { error } = await supabase.storage.from(LOGO_BUCKET).upload(filePath, blob, {
      contentType,
      upsert: true,
    });

    if (error) throw new Error(error.message || "Unable to upload logo.");

    const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(filePath);

    if (!data?.publicUrl) {
      throw new Error("Logo uploaded but public URL was not returned.");
    }

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

  function validateForm() {
    if (!ownerName.trim()) {
      Alert.alert("Missing Owner Name", "Please enter the owner name.");
      return false;
    }

    if (!farmName.trim()) {
      Alert.alert("Missing Farm Name", "Please enter the farm name.");
      return false;
    }

    if (!isValidEmail(email)) {
      Alert.alert("Valid Email Required", "Please enter a valid farmer email.");
      return false;
    }

    if (!farmLocation.trim()) {
      Alert.alert("Missing Location", "Please enter your farm location.");
      return false;
    }

    if (!pickup && !delivery) {
      Alert.alert("Pickup or Delivery Required", "Enable pickup, delivery, or both.");
      return false;
    }

    return true;
  }

  async function safeUpdateFarmers(id: string, payload: Record<string, any>) {
    const idColumns = ["id", "farmer_id", "profile_id", "auth_user_id"];
    const values: Record<string, string> = {
      id,
      farmer_id: clean(currentFarmer?.farmer_id || id),
      profile_id: clean(currentFarmer?.profile_id),
      auth_user_id: clean(currentFarmer?.auth_user_id),
    };

    for (const column of idColumns) {
      const value = values[column];
      if (!value) continue;

      let nextPayload = { ...payload };

      for (let attempt = 0; attempt < 30; attempt += 1) {
        try {
          const { data, error } = await supabase
            .from("farmers")
            .update(nextPayload)
            .eq(column, value)
            .select("*")
            .maybeSingle();

          if (!error && data) return data;
          if (!error && !data) break;

          const missing = String(error?.message || "").match(/Could not find the '([^']+)' column/i)?.[1];

          if (missing && Object.prototype.hasOwnProperty.call(nextPayload, missing)) {
            delete nextPayload[missing];
            continue;
          }

          console.log(`safeUpdateFarmers ${column} skipped:`, error?.message);
          break;
        } catch (error: any) {
          console.log(`safeUpdateFarmers ${column} exception skipped:`, error?.message || error);
          break;
        }
      }
    }

    return null;
  }

  async function saveFarmerProfile(showAlert = true): Promise<FarmerRecord | null> {
    try {
      if (loading || logoUploading) return null;
      if (!validateForm()) return null;

      const activeFarmerId = getFarmerId(currentFarmer);

      if (!activeFarmerId) {
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
      const finalEmail = normalize(email);
      const finalOwner = ownerName.trim();
      const finalFarmName = farmName.trim();
      const finalLocation = farmLocation.trim();

      const payload: Record<string, any> = {
        role: "farmer",
        farmer_id: clean(currentFarmer?.farmer_id || activeFarmerId),
        owner_name: finalOwner,
        full_name: finalOwner,
        name: finalOwner,
        farm_name: finalFarmName,
        business_name: finalFarmName,
        email: finalEmail,
        farmer_email: finalEmail,
        phone: phone.trim(),
        username: normalize((currentFarmer as any)?.username || finalEmail),
        farm_location: finalLocation,
        location: finalLocation,
        about: about.trim(),
        about_farm: about.trim(),
        description: about.trim(),
        logo_url: finalLogoUrl,
        farm_logo_url: finalLogoUrl,
        pickup,
        delivery,
        allow_pickup: pickup,
        allow_delivery: delivery,
        pickup_enabled: pickup,
        delivery_enabled: delivery,
        marketplace_visible: true,
        store_active: true,
        account_active: true,
        approved: true,
        reviewed: true,
        rejected: false,
        store_unlocked: true,
        compliance_status: "ACTIVE",
        admin_review_status: "ACTIVE",
        review_decision: "APPROVED",
        updated_at: now,
      };

      let updated = await safeUpdateFarmers(activeFarmerId, payload);

      if (!updated) {
        const { data, error } = await supabase
          .from("farmers")
          .upsert(
            {
              id: activeFarmerId,
              ...payload,
              created_at: (currentFarmer as any)?.created_at || now,
            },
            { onConflict: "id" }
          )
          .select("*")
          .maybeSingle();

        if (error) throw error;
        updated = data;
      }

      const savedFarmer: FarmerRecord = {
        ...(currentFarmer || {}),
        ...(updated || {}),
        id: activeFarmerId,
        farmerId: activeFarmerId,
        farmer_id: clean((updated as any)?.farmer_id || currentFarmer?.farmer_id || activeFarmerId),
        role: "farmer",
        owner_name: finalOwner,
        ownerName: finalOwner,
        farm_name: finalFarmName,
        farmName: finalFarmName,
        business_name: finalFarmName,
        businessName: finalFarmName,
        email: finalEmail,
        farmer_email: finalEmail,
        phone: phone.trim(),
        farm_location: finalLocation,
        farmLocation: finalLocation,
        location: finalLocation,
        about: about.trim(),
        about_farm: about.trim(),
        description: about.trim(),
        logo_url: finalLogoUrl,
        farm_logo_url: finalLogoUrl,
        logoUrl: finalLogoUrl,
        farmLogoUrl: finalLogoUrl,
        pickup,
        delivery,
        allow_pickup: pickup,
        allow_delivery: delivery,
        pickup_enabled: pickup,
        delivery_enabled: delivery,
        marketplace_visible: true,
        store_active: true,
        account_active: true,
        approved: true,
        store_unlocked: true,
      };

      hydrate(savedFarmer);
      await saveFarmerSession(savedFarmer);

      if (showAlert) Alert.alert("Store Saved", "Farmer store setup saved.");
      return savedFarmer;
    } catch (error: any) {
      console.log("Save farmer profile error:", error);
      Alert.alert("Save Error", error?.message || "Unable to save farmer store.");
      return null;
    } finally {
      setLoading(false);
      setLogoUploading(false);
    }
  }

  async function saveAndRoute(pathname: string) {
    const saved = await saveFarmerProfile(false);
    if (!saved?.id) return;

    router.push({
      pathname,
      params: { farmerId: saved.id },
    } as any);
  }

  if (loading && !currentFarmer) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={COLORS.green} />
          <Text style={styles.loadingText}>Loading store setup...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.9}>
              <Ionicons name="arrow-back-outline" size={21} color={COLORS.text} />
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Grocerly Store</Text>
              <Text style={styles.pageTitle}>Setup Farmer Store</Text>
            </View>

            <View style={styles.scorePill}>
              <Text style={styles.scoreText}>{completion}/6</Text>
            </View>
          </View>

          <View style={styles.hero}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroBadge}>Fresh Local Market</Text>
              <Text style={styles.heroTitle}>Build your grocery-style farm storefront.</Text>
              <Text style={styles.heroSub}>Save your profile first, then add produce, custom products, payouts, and preferred drivers.</Text>
            </View>

            <View style={styles.heroImage}>
              <Text style={styles.heroEmoji}>🥦</Text>
            </View>
          </View>


          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Store Completion</Text>
              <Text style={styles.progressPercent}>{completionPercent}%</Text>
            </View>

            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${completionPercent}%` }]} />
            </View>

            <View style={styles.checkGrid}>
              {completionItems.map((item) => (
                <View key={item.label} style={styles.checkItem}>
                  <Ionicons
                    name={item.done ? "checkmark-circle" : "ellipse-outline"}
                    size={16}
                    color={item.done ? COLORS.green : COLORS.muted}
                  />
                  <Text style={[styles.checkText, item.done && styles.checkTextDone]}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.statusRow}>
            <StatusChip label="Store" value="Active" good />
            <StatusChip label="Stripe" value={stripeConnected ? "Connected" : "Pending"} good={stripeConnected} />
            <StatusChip label="Logo" value={logoUrl ? "Ready" : "Needed"} good={Boolean(logoUrl)} />
          </View>

          <View style={styles.card}>
            <SectionHeader title="Store Logo" subtitle="Shown in the customer marketplace." icon="image-outline" />

            <View style={styles.logoRow}>
              <Pressable style={styles.logoPreviewWrap} onPress={pickLogo}>
                {logoUrl ? (
                  <Image source={{ uri: logoUrl }} style={styles.logoPreview} />
                ) : (
                  <View style={styles.logoEmpty}>
                    <Text style={styles.logoEmoji}>🚜</Text>
                  </View>
                )}
              </Pressable>

              <View style={{ flex: 1 }}>
                <Text style={styles.logoTitle}>Farm Logo</Text>
                <Text style={styles.logoText}>Upload a square logo for your Grocerly-style farm store.</Text>

                <TouchableOpacity
                  style={[styles.outlineButton, (logoUploading || loading) && styles.disabled]}
                  onPress={pickLogo}
                  disabled={logoUploading || loading}
                  activeOpacity={0.9}
                >
                  <Ionicons name="cloud-upload-outline" size={17} color={COLORS.greenDark} />
                  <Text style={styles.outlineButtonText}>
                    {logoUploading ? "Uploading..." : logoUrl ? "Change Logo" : "Upload Logo"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <SectionHeader title="Farm Profile" subtitle="This information appears in marketplace search." icon="storefront-outline" />

            <Field label="Owner Name" value={ownerName} onChangeText={setOwnerName} placeholder="Owner name" icon="person-outline" />
            <Field label="Farm Name" value={farmName} onChangeText={setFarmName} placeholder="Farm name" icon="leaf-outline" />
            <Field
              label="Email"
              value={email}
              onChangeText={(value) => setEmail(normalize(value))}
              placeholder="farmer@email.com"
              icon="mail-outline"
              keyboardType="email-address"
            />
            <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="Phone number" icon="call-outline" keyboardType="phone-pad" />
            <Field label="Farm Location" value={farmLocation} onChangeText={setFarmLocation} placeholder="City, State" icon="location-outline" />

            <Text style={styles.inputLabel}>About Farm</Text>
            <View style={[styles.inputShell, styles.textAreaShell]}>
              <Ionicons name="document-text-outline" size={18} color={COLORS.muted} />
              <TextInput
                style={[styles.input, styles.textArea]}
                value={about}
                onChangeText={setAbout}
                placeholder="Tell customers about your farm"
                placeholderTextColor="#94A3B8"
                multiline
              />
            </View>
          </View>

          <View style={styles.card}>
            <SectionHeader title="Pickup / Delivery" subtitle="Choose how customers receive groceries." icon="bicycle-outline" />

            <ToggleRow
              title="Allow Pickup"
              subtitle="Customers can pick up orders from your farm."
              value={pickup}
              onValueChange={setPickup}
              icon="bag-handle-outline"
            />

            <ToggleRow
              title="Allow Delivery"
              subtitle="Orders can be delivered by your team or Farm2Home drivers."
              value={delivery}
              onValueChange={setDelivery}
              icon="car-outline"
            />
          </View>


          <View style={styles.card}>
            <SectionHeader title="Next Steps" subtitle="Save first, then continue your farmer workflow." icon="trail-sign-outline" />

            <View style={styles.nextGrid}>
              <NextStep title="Add Produce" subtitle="Select grocery catalog items." icon="nutrition-outline" onPress={() => saveAndRoute("/farmer/select-produce")} />
              <NextStep title="Custom Product" subtitle="Upload your own farm item." icon="add-circle-outline" onPress={() => saveAndRoute("/farmer/add-product")} />
              <NextStep title="Connect Bank" subtitle="Finish Stripe payouts." icon="card-outline" onPress={() => saveAndRoute("/farmer/connect-bank")} />
              <NextStep title="Preferred Drivers" subtitle="Manage driver network." icon="people-outline" onPress={() => saveAndRoute("/farmer/driver")} />
            </View>
          </View>

          <View style={styles.actionGrid}>
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabled]}
              onPress={() => saveFarmerProfile(true)}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color={COLORS.white} />
                  <Text style={styles.primaryButtonText}>Save Store</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => saveAndRoute("/farmer/select-produce")}
              disabled={loading}
              activeOpacity={0.9}
            >
              <Ionicons name="nutrition-outline" size={18} color={COLORS.greenDark} />
              <Text style={styles.secondaryButtonText}>Save + Add Produce</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => saveAndRoute("/farmer/add-product")}
              disabled={loading}
              activeOpacity={0.9}
            >
              <Ionicons name="add-circle-outline" size={18} color={COLORS.greenDark} />
              <Text style={styles.secondaryButtonText}>Save + Custom Product</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => saveAndRoute("/farmer/dashboard")}
              disabled={loading}
              activeOpacity={0.9}
            >
              <Ionicons name="grid-outline" size={18} color={COLORS.greenDark} />
              <Text style={styles.secondaryButtonText}>Save + Dashboard</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StatusChip({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <View style={[styles.statusChip, good ? styles.statusChipGood : styles.statusChipWarn]}>
      <Text style={styles.statusChipLabel}>{label}</Text>
      <Text style={[styles.statusChipValue, good ? styles.statusChipValueGood : styles.statusChipValueWarn]}>{value}</Text>
    </View>
  );
}

function SectionHeader({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={21} color={COLORS.greenDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSub}>{subtitle}</Text>
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
  keyboardType?: any;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputShell}>
        <Ionicons name={icon} size={18} color={COLORS.muted} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          keyboardType={keyboardType}
          autoCapitalize={keyboardType === "email-address" ? "none" : "words"}
          autoCorrect={false}
        />
      </View>
    </View>
  );
}

function ToggleRow({
  title,
  subtitle,
  value,
  onValueChange,
  icon,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.toggleCard}>
      <View style={styles.toggleIcon}>
        <Ionicons name={icon} size={20} color={COLORS.greenDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleSub}>{subtitle}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}


function NextStep({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.nextStep} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.nextIcon}>
        <Ionicons name={icon} size={20} color={COLORS.greenDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.nextTitle}>{title}</Text>
        <Text style={styles.nextSub}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward-outline" size={18} color={COLORS.muted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  progressCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  progressTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  progressPercent: { color: COLORS.greenDark, fontWeight: "900" },
  progressTrack: { height: 10, borderRadius: 999, backgroundColor: COLORS.greenSoft, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: COLORS.green },
  checkGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  checkItem: {
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  checkText: { color: COLORS.muted, fontWeight: "900", fontSize: 12 },
  checkTextDone: { color: COLORS.greenDark },
  nextGrid: { gap: 10 },
  nextStep: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  nextIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    backgroundColor: COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  nextTitle: { color: COLORS.text, fontWeight: "900" },
  nextSub: { color: COLORS.muted, fontWeight: "700", marginTop: 2 },

  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 10, color: COLORS.muted, fontWeight: "800" },
  content: { padding: 16, paddingBottom: 110 },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 17,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: { color: COLORS.green, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase", fontSize: 12 },
  pageTitle: { color: COLORS.text, fontSize: 24, fontWeight: "900", marginTop: 2 },
  scorePill: {
    backgroundColor: COLORS.greenSoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  scoreText: { color: COLORS.greenDark, fontWeight: "900" },
  hero: {
    backgroundColor: COLORS.green,
    borderRadius: 30,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  heroBadge: { color: COLORS.lime, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1, fontSize: 11 },
  heroTitle: { color: COLORS.white, fontSize: 25, fontWeight: "900", lineHeight: 31, marginTop: 7 },
  heroSub: { color: COLORS.white, opacity: 0.92, fontWeight: "700", lineHeight: 20, marginTop: 7 },
  heroImage: {
    width: 76,
    height: 76,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroEmoji: { fontSize: 42 },
  statusRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  statusChip: {
    flex: 1,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
  },
  statusChipGood: { backgroundColor: COLORS.greenSoft, borderColor: "#BDECCF" },
  statusChipWarn: { backgroundColor: COLORS.orangeSoft, borderColor: "#FED7AA" },
  statusChipLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 11, textTransform: "uppercase" },
  statusChipValue: { fontWeight: "900", marginTop: 4 },
  statusChipValueGood: { color: COLORS.greenDark },
  statusChipValueWarn: { color: "#92400E" },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  sectionIcon: {
    width: 43,
    height: 43,
    borderRadius: 16,
    backgroundColor: COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  sectionSub: { color: COLORS.muted, fontWeight: "700", lineHeight: 18, marginTop: 3 },
  logoRow: { flexDirection: "row", gap: 14, alignItems: "center" },
  logoPreviewWrap: {
    width: 88,
    height: 88,
    borderRadius: 26,
    backgroundColor: COLORS.greenSoft,
    overflow: "hidden",
  },
  logoPreview: { width: "100%", height: "100%" },
  logoEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  logoEmoji: { fontSize: 38 },
  logoTitle: { color: COLORS.text, fontWeight: "900", fontSize: 17 },
  logoText: { color: COLORS.muted, fontWeight: "700", lineHeight: 19, marginTop: 4 },
  outlineButton: {
    marginTop: 12,
    backgroundColor: COLORS.greenSoft,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: "row",
    gap: 7,
    alignSelf: "flex-start",
  },
  outlineButtonText: { color: COLORS.greenDark, fontWeight: "900" },
  fieldWrap: { marginBottom: 12 },
  inputLabel: { color: COLORS.text, fontWeight: "900", marginBottom: 7, fontSize: 13 },
  inputShell: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 54,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  input: { flex: 1, minHeight: 52, color: COLORS.text, fontWeight: "800" },
  textAreaShell: { minHeight: 104, alignItems: "flex-start", paddingTop: 13 },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  toggleCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  toggleIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    backgroundColor: COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleTitle: { color: COLORS.text, fontWeight: "900" },
  toggleSub: { color: COLORS.muted, fontWeight: "700", lineHeight: 18, marginTop: 3 },
  actionGrid: { gap: 10 },
  primaryButton: {
    backgroundColor: COLORS.green,
    borderRadius: 18,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: { color: COLORS.white, fontWeight: "900", fontSize: 15 },
  secondaryButton: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryButtonText: { color: COLORS.greenDark, fontWeight: "900", fontSize: 15 },
  disabled: { opacity: 0.62 },
});
