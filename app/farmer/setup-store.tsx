import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

import {
  Farmer,
  addFarmer,
  getFarmerById,
  getFarmers,
  updateFarmerStore,
} from "../data/farmerStore";

import { checkSubscriptionAccess } from "../services/subscriptionService";

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
  const [currentFarmer, setCurrentFarmer] = useState<Farmer | null>(null);

  const [ownerName, setOwnerName] = useState("");
  const [farmName, setFarmName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [farmLocation, setFarmLocation] = useState("");
  const [about, setAbout] = useState("");

  const [pickup, setPickup] = useState(true);
  const [delivery, setDelivery] = useState(true);

  useEffect(() => {
    initializeScreen();
  }, [farmerIdFromParams]);

  async function initializeScreen() {
    try {
      const saved = await AsyncStorage.getItem("currentFarmer");

      if (!saved) {
        Alert.alert("Session Needed", "Please login again.");
        router.replace("/farmer/login" as any);
        return;
      }

      const parsed = JSON.parse(saved);

      const access = await checkSubscriptionAccess({
        role: "farmer",
        userId: parsed.id,
        email: parsed.email,
      });

      if (!access.allowed) {
        Alert.alert(
          "Farmer Membership Required",
          access.reason || "Your farmer subscription is inactive.",
          [
            {
              text: "Manage Subscription",
              onPress: () => router.push("/farmer/compliance-upload" as any),
            },
          ]
        );

        router.replace("/farmer/dashboard" as any);
        return;
      }

      await loadFarmer();
    } catch (error) {
      console.log("Initialize setup store error:", error);
      Alert.alert("Access Error", "Unable to verify farmer membership.");
    }
  }

  async function loadFarmer() {
    try {
      let farmer: Farmer | undefined;

      if (farmerIdFromParams) {
        farmer = await getFarmerById(farmerIdFromParams);
      }

      if (!farmer) {
        const saved = await AsyncStorage.getItem("currentFarmer");

        if (saved) {
          const parsed = JSON.parse(saved);
          farmer = await getFarmerById(parsed.id);
        }
      }

      if (!farmer) {
        const farmers = await getFarmers();

        farmer =
          farmers.find(
            (item) => item.approved === true || item.complianceStatus === "approved"
          ) || farmers[0];
      }

      if (!farmer) {
        Alert.alert(
          "Farmer Not Found",
          "Please complete farmer compliance first."
        );

        router.replace("/farmer/compliance-upload" as any);
        return;
      }

      const approved =
        farmer.approved === true || farmer.complianceStatus === "approved";

      if (!approved) {
        Alert.alert(
          "Compliance Required",
          "Your compliance review must be approved before setting up your store."
        );

        router.replace("/farmer/compliance-upload" as any);
        return;
      }

      setCurrentFarmer(farmer);

      await AsyncStorage.setItem("currentFarmer", JSON.stringify(farmer));

      setOwnerName(farmer.ownerName || "");
      setFarmName(farmer.farmName || "");
      setEmail(farmer.email || "");
      setPhone(farmer.phone || "");
      setFarmLocation(farmer.farmLocation || farmer.location || "");
      setAbout(farmer.about || "");

      setPickup(farmer.pickup !== false);
      setDelivery(farmer.delivery !== false);
    } catch (error) {
      console.log("Load farmer error:", error);
      Alert.alert("Error", "Unable to load farmer setup.");
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
      if (!validateRequiredFields()) return null;

      if (!currentFarmer?.id) {
        Alert.alert("Session Error", "Please login again.");
        return null;
      }

      const access = await checkSubscriptionAccess({
        role: "farmer",
        userId: currentFarmer.id,
        email: currentFarmer.email || email,
      });

      if (!access.allowed) {
        Alert.alert(
          "Subscription Required",
          access.reason || "Farmer subscription inactive."
        );

        return null;
      }

      setLoading(true);

      const farmerPayload: Farmer = {
        id: currentFarmer?.id || farmerIdFromParams || `farmer-${Date.now()}`,

        ownerName: ownerName.trim(),
        farmName: farmName.trim(),
        email: email.trim(),
        phone: phone.trim(),

        username: currentFarmer?.username || email.trim(),
        password: currentFarmer?.password || "",

        accountActive: true,
        approved: true,
        complianceStatus: "approved",

        securityQuestion1: currentFarmer?.securityQuestion1 || "",
        securityAnswer1: currentFarmer?.securityAnswer1 || "",
        securityQuestion2: currentFarmer?.securityQuestion2 || "",
        securityAnswer2: currentFarmer?.securityAnswer2 || "",
        securityQuestion3: currentFarmer?.securityQuestion3 || "",
        securityAnswer3: currentFarmer?.securityAnswer3 || "",

        farmLocation: farmLocation.trim(),
        location: farmLocation.trim(),
        about: about.trim(),

        pickup,
        delivery,

        stripeAccountId: currentFarmer?.stripeAccountId || "",
        farmerStripeAccountId: currentFarmer?.farmerStripeAccountId || "",
        stripePayoutAccount: currentFarmer?.stripePayoutAccount || "",
        stripePayoutAccountLast4: currentFarmer?.stripePayoutAccountLast4 || "",
        stripePayoutBankName: currentFarmer?.stripePayoutBankName || "",
        stripeOnboardingComplete: currentFarmer?.stripeOnboardingComplete || false,
        stripeChargesEnabled: currentFarmer?.stripeChargesEnabled || false,
        stripePayoutsEnabled: currentFarmer?.stripePayoutsEnabled || false,

        products: currentFarmer?.products || [],
        reviews: currentFarmer?.reviews || 0,
        rating: currentFarmer?.rating || 4.8,
        distanceMiles: currentFarmer?.distanceMiles || 5,
        itemsSold: currentFarmer?.itemsSold || 0,
        revenue: currentFarmer?.revenue || 0,

        createdAt: currentFarmer?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      let savedFarmer = farmerPayload;

      if (currentFarmer?.id) {
        const updated = await updateFarmerStore(currentFarmer.id, farmerPayload);
        savedFarmer =
          updated.find((item) => item.id === currentFarmer.id) || farmerPayload;
      } else {
        const updated = await addFarmer(farmerPayload);
        savedFarmer =
          updated.find((item) => item.id === farmerPayload.id) || farmerPayload;
      }

      setCurrentFarmer(savedFarmer);

      await AsyncStorage.setItem("currentFarmer", JSON.stringify(savedFarmer));

      Alert.alert("Saved", "Farmer store setup saved.");

      return savedFarmer;
    } catch (error: any) {
      console.log("Save farmer profile error:", error);
      Alert.alert("Save Error", error?.message || "Unable to save farmer.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function saveAndGoToProduce() {
    const farmer = await saveFarmerProfile();
    if (!farmer?.id) return;

    router.push({
      pathname: "/farmer/post-produce",
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
    currentFarmer?.stripeAccountId || currentFarmer?.farmerStripeAccountId
  );

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
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
            <Text style={styles.subtitle}>Build your Farm2Home storefront</Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Text style={styles.heroIconText}>🏪</Text>
          </View>

          <View style={styles.heroTextBlock}>
            <Text style={styles.heroBadge}>Approved Farmer</Text>
            <Text style={styles.heroTitle}>
              Complete your farm profile
            </Text>
            <Text style={styles.heroText}>
              Your compliance review is approved. Set your public store details
              and start uploading produce.
            </Text>
          </View>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={styles.statusIcon}>
              <Text style={styles.statusIconText}>✅</Text>
            </View>

            <View style={styles.statusBody}>
              <Text style={styles.statusTitle}>Compliance Approved</Text>
              <Text style={styles.statusText}>
                Stripe: {stripeConnected ? "Connected" : "Pending"}
              </Text>
              <Text style={styles.statusText}>
                Status: {currentFarmer?.complianceStatus || "approved"}
              </Text>
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
          <Text style={styles.sectionTitle}>Pickup / Delivery Options</Text>

          <View style={styles.optionCard}>
            <View style={styles.optionIcon}>
              <Text style={styles.optionIconText}>🧺</Text>
            </View>

            <View style={styles.optionTextBlock}>
              <Text style={styles.optionTitle}>Allow Pickup</Text>
              <Text style={styles.optionSubtitle}>
                Customers can pick up directly from your farm.
              </Text>
            </View>

            <Switch value={pickup} onValueChange={setPickup} />
          </View>

          <View style={styles.optionCard}>
            <View style={styles.optionIcon}>
              <Text style={styles.optionIconText}>🚚</Text>
            </View>

            <View style={styles.optionTextBlock}>
              <Text style={styles.optionTitle}>Allow Delivery</Text>
              <Text style={styles.optionSubtitle}>
                Orders can be routed to drivers or delivery partners.
              </Text>
            </View>

            <Switch value={delivery} onValueChange={setDelivery} />
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.pressed,
            loading && styles.disabledButton,
          ]}
          onPress={saveFarmerProfile}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Farmer Store Setup</Text>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
            loading && styles.disabledButton,
          ]}
          onPress={saveAndGoToProduce}
          disabled={loading}
        >
          <Text style={styles.primaryButtonText}>Add / Upload Produce</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.dashboardButton,
            pressed && styles.pressed,
            loading && styles.disabledButton,
          ]}
          onPress={saveAndGoToDashboard}
          disabled={loading}
        >
          <Text style={styles.dashboardButtonText}>Go to Farmer Dashboard</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          onPress={() => router.back()}
        >
          <Text style={styles.secondaryButtonText}>Go Back</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
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
    backgroundColor: COLORS.primary,
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
    backgroundColor: COLORS.secondary,
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
    color: "#EAF7E6",
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
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  statusHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  statusIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: COLORS.softGreen,
    justifyContent: "center",
    alignItems: "center",
  },
  statusIconText: {
    fontSize: 27,
  },
  statusBody: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 14,
    color: COLORS.muted,
    fontWeight: "800",
    marginTop: 3,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: "900",
    color: COLORS.muted,
    marginBottom: 7,
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.lightGreen,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 10,
    fontWeight: "800",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  optionCard: {
    backgroundColor: COLORS.lightGreen,
    borderRadius: 22,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
  },
  optionIconText: {
    fontSize: 25,
  },
  optionTextBlock: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: "900",
  },
  optionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 3,
    fontSize: 12,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingVertical: 17,
    alignItems: "center",
    marginTop: 4,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },
  primaryButton: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 20,
    paddingVertical: 17,
    alignItems: "center",
    marginTop: 12,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },
  dashboardButton: {
    backgroundColor: COLORS.blue,
    borderRadius: 20,
    paddingVertical: 17,
    alignItems: "center",
    marginTop: 12,
  },
  dashboardButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },
  secondaryButton: {
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.75,
  },
});