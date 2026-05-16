import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { useLocalSearchParams, router } from "expo-router";

import {
  Farmer,
  addFarmer,
  getFarmerById,
  getFarmers,
  updateFarmerStore,
} from "../data/farmerStore";

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
    loadFarmer();
  }, [farmerIdFromParams]);

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
            (item) =>
              item.approved === true ||
              item.complianceStatus === "approved"
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
        stripePayoutAccountLast4:
          currentFarmer?.stripePayoutAccountLast4 || "",
        stripePayoutBankName: currentFarmer?.stripePayoutBankName || "",
        stripeOnboardingComplete:
          currentFarmer?.stripeOnboardingComplete || false,
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
          updated.find((item) => item.id === currentFarmer.id) ||
          farmerPayload;
      } else {
        const updated = await addFarmer(farmerPayload);
        savedFarmer =
          updated.find((item) => item.id === farmerPayload.id) ||
          farmerPayload;
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
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Farmer Store Setup</Text>

        <Text style={styles.subtitle}>
          Your compliance review is approved. Complete your farm profile and
          start uploading produce.
        </Text>

        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Compliance Approved</Text>
          <Text style={styles.statusText}>
            Stripe: {stripeConnected ? "Connected" : "Pending"}
          </Text>
          <Text style={styles.statusText}>
            Status: {currentFarmer?.complianceStatus || "approved"}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Farm Profile</Text>

          <Text style={styles.label}>Owner Name</Text>
          <TextInput
            style={styles.input}
            value={ownerName}
            onChangeText={setOwnerName}
            placeholder="Owner name"
          />

          <Text style={styles.label}>Farm Name</Text>
          <TextInput
            style={styles.input}
            value={farmName}
            onChangeText={setFarmName}
            placeholder="Farm name"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="farmer@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone number"
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Farm Location</Text>
          <TextInput
            style={styles.input}
            value={farmLocation}
            onChangeText={setFarmLocation}
            placeholder="City, State"
          />

          <Text style={styles.label}>About Farm</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={about}
            onChangeText={setAbout}
            placeholder="Tell customers about your farm"
            multiline
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Pickup / Delivery Options</Text>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Allow Pickup</Text>
            <Switch value={pickup} onValueChange={setPickup} />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Allow Delivery</Text>
            <Switch value={delivery} onValueChange={setDelivery} />
          </View>
        </View>

        <TouchableOpacity
          style={styles.saveButton}
          onPress={saveFarmerProfile}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>
            {loading ? "Saving..." : "Save Farmer Store Setup"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={saveAndGoToProduce}
          disabled={loading}
        >
          <Text style={styles.primaryButtonText}>Add / Upload Produce</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dashboardButton}
          onPress={saveAndGoToDashboard}
          disabled={loading}
        >
          <Text style={styles.dashboardButtonText}>Go to Farmer Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.back()}
        >
          <Text style={styles.secondaryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F7F2",
  },
  container: {
    padding: 18,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1F3D2B",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: "#5E6D61",
    marginBottom: 18,
    lineHeight: 21,
  },
  statusCard: {
    backgroundColor: "#EAF7EA",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#B7DDB8",
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1B5E20",
    marginBottom: 6,
  },
  statusText: {
    fontSize: 14,
    color: "#24552B",
    fontWeight: "700",
    marginTop: 3,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#224B32",
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2E4735",
    marginBottom: 6,
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D8E2D3",
    backgroundColor: "#FAFCF8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: "#1F2F23",
    marginBottom: 10,
  },
  textArea: {
    height: 90,
    textAlignVertical: "top",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2E4735",
  },
  saveButton: {
    backgroundColor: "#2E7D32",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },
  primaryButton: {
    backgroundColor: "#14532D",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },
  dashboardButton: {
    backgroundColor: "#2563EB",
    borderRadius: 16,
    paddingVertical: 16,
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
    color: "#2E7D32",
    fontSize: 15,
    fontWeight: "800",
  },
});