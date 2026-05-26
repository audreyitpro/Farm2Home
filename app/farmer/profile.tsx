import React, { useCallback, useState } from "react";
import {
  Alert,
  Image,
  Linking,
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

const API_URL = "http://YOUR_COMPUTER_IP:4242";

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
  Seasonal: [
    "Christmas Trees",
    "Pumpkins",
    "Reefs",
    "Other"
  ]
};

export default function FarmerProfile() {
  const [farmer, setFarmer] = useState<any>(null);
  const [allFarmers, setAllFarmers] = useState<any[]>([]);

  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [logo, setLogo] = useState<UploadedFile | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      async function loadFarmer() {
        try {
          const savedCurrentFarmer = await AsyncStorage.getItem("currentFarmer");
          const savedFarmers = await AsyncStorage.getItem("farm2homeFarmers");

          const farmers = savedFarmers ? JSON.parse(savedFarmers) : [];
          setAllFarmers(Array.isArray(farmers) ? farmers : []);

          let current = savedCurrentFarmer
            ? JSON.parse(savedCurrentFarmer)
            : null;

          if (!current && Array.isArray(farmers) && farmers.length > 0) {
            current = farmers[farmers.length - 1];
          }

          if (current) {
            setFarmer(current);
            setBusinessName(current.businessName || "");
            setPhone(current.phone || "");
            setAddress(current.address || "");
            setLogo(current.logo || null);
            setSelectedProducts(current.products || []);
          }
        } catch (error) {
          console.log("Load farmer profile error:", error);
        }
      }

      loadFarmer();
    }, [])
  );

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

      const asset = result.assets[0];

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

  async function saveProfile() {
    if (!farmer) {
      Alert.alert("No Farmer", "No farmer profile was found.");
      return;
    }

    const updatedFarmer = {
      ...farmer,
      businessName,
      phone,
      address,
      logo,
      products: selectedProducts,
      updatedAt: new Date().toISOString(),
    };

    const updatedFarmers = allFarmers.map((item) =>
      item.id === farmer.id ? updatedFarmer : item
    );

    await AsyncStorage.setItem(
      "farm2homeFarmers",
      JSON.stringify(updatedFarmers)
    );

    await AsyncStorage.setItem("currentFarmer", JSON.stringify(updatedFarmer));

    setFarmer(updatedFarmer);
    setAllFarmers(updatedFarmers);

    Alert.alert("Saved", "Farmer profile updated.");
  }

  async function manageBilling() {
    if (!farmer?.stripeCustomerId) {
      Alert.alert(
        "No Stripe Account",
        "This farmer does not have a Stripe customer ID saved yet."
      );
      return;
    }

    try {
      const response = await fetch(`${API_URL}/create-billing-portal-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: farmer.stripeCustomerId,
          returnUrl: "farm2home://farmer/profile",
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        Alert.alert("Stripe Error", data.error || "Unable to open billing.");
        return;
      }

      if (data.url) {
        Linking.openURL(data.url);
      }
    } catch (error: any) {
      Alert.alert("Billing Error", error.message || "Unable to open billing.");
    }
  }

  async function cancelSubscription() {
    if (!farmer?.stripeSubscriptionId) {
      Alert.alert(
        "No Subscription",
        "This farmer does not have a Stripe subscription ID saved yet."
      );
      return;
    }

    try {
      const response = await fetch(`${API_URL}/cancel-subscription`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscriptionId: farmer.stripeSubscriptionId,
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
        status: "Subscription Canceled",
        verified: false,
        updatedAt: new Date().toISOString(),
      };

      const updatedFarmers = allFarmers.map((item) =>
        item.id === farmer.id ? updatedFarmer : item
      );

      await AsyncStorage.setItem(
        "farm2homeFarmers",
        JSON.stringify(updatedFarmers)
      );

      await AsyncStorage.setItem("currentFarmer", JSON.stringify(updatedFarmer));

      setFarmer(updatedFarmer);
      setAllFarmers(updatedFarmers);

      Alert.alert("Canceled", "Farmer subscription was canceled.");
    } catch (error: any) {
      Alert.alert("Cancel Error", error.message || "Unable to cancel.");
    }
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

      <Text style={styles.label}>Business Name</Text>
      <TextInput
        style={styles.input}
        value={businessName}
        onChangeText={setBusinessName}
        placeholder="Business name"
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

      <Text style={styles.statusText}>
        Status: {farmer.status || "Pending Admin Approval"}
      </Text>

      <Text style={styles.statusText}>
        Membership: {farmer.membershipStatus || "Active"}
      </Text>

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
        <Text style={styles.buttonText}>Save Profile</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.blueButton} onPress={manageBilling}>
        <Text style={styles.buttonText}>Update Card on File</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelButton} onPress={cancelSubscription}>
        <Text style={styles.buttonText}>Cancel Farmer Subscription</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.outlineButton}
        onPress={() => router.push("/marketplace" as never)}
      >
        <Text style={styles.outlineText}>View Marketplace</Text>
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
    paddingBottom: 60,
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
  },
  statusText: {
    marginTop: 8,
    fontWeight: "900",
    color: "#2F7D32",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    marginTop: 18,
    marginBottom: 8,
    color: "#222",
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