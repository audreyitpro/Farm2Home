import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Linking,
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
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";

import { API_BASE_URL } from "../config/api";

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
  Eggs: [
    "Chicken Eggs",
    "Duck Eggs",
    "Quail Eggs",
    "Free-Range Eggs",
    "Organic Eggs",
  ],
  Honey: [
    "Raw Honey",
    "Wildflower Honey",
    "Clover Honey",
    "Comb Honey",
    "Infused Honey",
  ],
  Meat: [
    "Beef",
    "Ground Beef",
    "Steak",
    "Pork",
    "Bacon",
    "Sausage",
    "Lamb",
    "Goat Meat",
    "Bison",
  ],
  Poultry: [
    "Whole Chicken",
    "Chicken Breast",
    "Chicken Wings",
    "Turkey",
    "Duck",
    "Quail",
  ],
  Dairy: ["Milk", "Goat Milk", "Cheese", "Butter", "Yogurt", "Cream"],
  "Baked Goods": [
    "Bread",
    "Sourdough Bread",
    "Rolls",
    "Cookies",
    "Cakes",
    "Pies",
    "Muffins",
  ],
  Livestock: [
    "Cows",
    "Calves",
    "Goats",
    "Sheep",
    "Pigs",
    "Chickens",
    "Ducks",
    "Turkeys",
    "Rabbits",
  ],
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

export default function FarmerProfile() {
  const [farmer, setFarmer] = useState<any>(null);
  const [allFarmers, setAllFarmers] = useState<any[]>([]);

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
      farmer.complianceStatus === "approved" ||
      farmer.adminReviewStatus === "approved" ||
      farmer.reviewDecision === "approved"
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

    if (
      farmer.complianceStatus === "pending_admin_review" ||
      farmer.adminReviewStatus === "pending" ||
      farmer.reviewDecision === "pending"
    ) {
      return "Awaiting Admin Approval";
    }

    return farmer.status || farmer.complianceStatus || "In Progress";
  }, [farmer]);

  const storeUnlocked = useMemo(() => {
    return (
      farmer?.approved === true ||
      farmer?.accountActive === true ||
      farmer?.storeUnlocked === true ||
      farmer?.adminReviewStatus === "approved" ||
      farmer?.reviewDecision === "approved"
    );
  }, [farmer]);

  const membershipStatus = useMemo(() => {
    return (
      farmer?.membershipStatus ||
      farmer?.subscriptionStatus ||
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
      const savedPendingFarmer = await AsyncStorage.getItem(
        "pendingFarmerApplication"
      );
      const savedFarmers = await AsyncStorage.getItem("farm2homeFarmers");

      const farmers = savedFarmers ? JSON.parse(savedFarmers) : [];
      const safeFarmers = Array.isArray(farmers) ? farmers : [];
      setAllFarmers(safeFarmers);

      let current = savedCurrentFarmer ? JSON.parse(savedCurrentFarmer) : null;

      if (!current && savedCurrentUser) {
        current = JSON.parse(savedCurrentUser);
      }

      if (!current && savedPendingFarmer) {
        current = JSON.parse(savedPendingFarmer);
      }

      if (!current && safeFarmers.length > 0) {
        current = safeFarmers[safeFarmers.length - 1];
      }

      if (current) {
        setFarmer(current);
        setBusinessName(current.businessName || current.farmName || "");
        setOwnerName(current.ownerName || "");
        setUsername(current.username || "");
        setEmail(current.email || "");
        setPhone(current.phone || "");
        setAddress(current.address || current.businessAddress || "");
        setLogo(current.logo || null);
        setSelectedProducts(current.products || []);
      }
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
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset) return;

      setLogo({
        name: asset.name,
        uri: asset.uri,
        mimeType: asset.mimeType,
      });
    } catch (error) {
      console.log("Pick logo error:", error);
      Alert.alert("Logo Error", "Unable to select logo.");
    }
  }

  async function persistUpdatedFarmer(updatedFarmer: any) {
    const updatedFarmers =
      allFarmers.length > 0
        ? allFarmers.map((item) =>
            item.id === updatedFarmer.id ? updatedFarmer : item
          )
        : [updatedFarmer];

    const exists = updatedFarmers.some((item) => item.id === updatedFarmer.id);
    const finalFarmers = exists ? updatedFarmers : [...updatedFarmers, updatedFarmer];

    await AsyncStorage.setItem("farm2homeFarmers", JSON.stringify(finalFarmers));
    await AsyncStorage.setItem("currentFarmer", JSON.stringify(updatedFarmer));
    await AsyncStorage.setItem("currentUser", JSON.stringify(updatedFarmer));
    await AsyncStorage.setItem("userRole", "farmer");
    await AsyncStorage.setItem("currentUserRole", "farmer");

    setFarmer(updatedFarmer);
    setAllFarmers(finalFarmers);
  }

  async function saveProfile() {
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

    const updatedFarmer = {
      ...farmer,
      farmName: businessName.trim(),
      businessName: businessName.trim(),
      ownerName: ownerName.trim(),
      username: username.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
      businessAddress: address.trim(),
      logo,
      products: selectedProducts,
      updatedAt: new Date().toISOString(),
    };

    await persistUpdatedFarmer(updatedFarmer);
    Alert.alert("Saved", "Farmer profile updated.");
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

    const result = await WebBrowser.openBrowserAsync(url);
    if (result.type === "cancel" || result.type === "dismiss") {
      return;
    }
  }

  async function manageBilling() {
    const stripeCustomerId =
      farmer?.stripeCustomerId ||
      farmer?.customerId ||
      farmer?.farmerStripeCustomerId;

    if (!stripeCustomerId) {
      Alert.alert(
        "No Stripe Customer ID",
        "This farmer does not have a Stripe customer ID saved yet. The monthly membership starts after admin approval."
      );
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/payments/create-customer-portal-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customerId: stripeCustomerId,
            returnUrl: "farm2home://farmer/profile",
          }),
        }
      );

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
      farmer?.subscriptionId ||
      farmer?.farmerSubscriptionId;

    if (!subscriptionId) {
      Alert.alert(
        "No Subscription",
        "No active farmer monthly subscription was found. If your application is not approved yet, the monthly membership has not started."
      );
      return;
    }

    Alert.alert(
      "Cancel Subscription",
      "Are you sure you want to cancel your farmer monthly membership?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await fetch(
                `${API_BASE_URL}/payments/cancel-subscription`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    subscriptionId,
                    farmerId: farmer?.id,
                    role: "farmer",
                  }),
                }
              );

              const data = await response.json();

              if (!response.ok || data.error) {
                Alert.alert("Stripe Error", data.error || "Unable to cancel.");
                return;
              }

              const updatedFarmer = {
                ...farmer,
                membershipStatus: "Canceled",
                subscriptionStatus: "canceled",
                status: "Subscription Canceled",
                accountActive: false,
                updatedAt: new Date().toISOString(),
              };

              await persistUpdatedFarmer(updatedFarmer);

              Alert.alert("Canceled", "Farmer subscription was canceled.");
            } catch (error: any) {
              Alert.alert("Cancel Error", error.message || "Unable to cancel.");
            }
          },
        },
      ]
    );
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
      Alert.alert(
        "Awaiting Approval",
        "Your farmer store will unlock after admin approval."
      );
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
          {farmer.stripePayoutsEnabled
            ? "Payouts Enabled"
            : farmer.stripeAccountId || farmer.farmerStripeAccountId
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
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="Username"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Business Name</Text>
        <TextInput
          style={styles.input}
          value={businessName}
          onChangeText={setBusinessName}
          placeholder="Business name"
        />

        <Text style={styles.label}>Owner Name</Text>
        <TextInput
          style={styles.input}
          value={ownerName}
          onChangeText={setOwnerName}
          placeholder="Owner name"
        />

        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="Phone number"
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Farm / Business Address</Text>
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={setAddress}
          placeholder="Farm address"
        />

        <TouchableOpacity style={styles.greenButton} onPress={saveProfile}>
          <Text style={styles.buttonText}>Save Profile</Text>
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
          The $14.99 monthly farmer membership starts after admin approval. Once
          active, you can manage billing or cancel your subscription here.
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
                    style={[
                      styles.productCard,
                      selected && styles.productCardSelected,
                    ]}
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

        <TouchableOpacity style={styles.greenButton} onPress={saveProfile}>
          <Text style={styles.buttonText}>Save Products</Text>
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
  page: {
    flex: 1,
    backgroundColor: "#F7F7F2",
  },
  content: {
    padding: 22,
    paddingBottom: 70,
  },
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