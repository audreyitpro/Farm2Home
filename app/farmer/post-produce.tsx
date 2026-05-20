import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import {
  Farmer,
  Product,
  addProductToFarmer,
  deleteFarmerProduct,
  getFarmerById,
} from "../data/farmerStore";

import { checkSubscriptionAccess } from "../services/subscriptionService";

export default function PostProduceScreen() {
  const params = useLocalSearchParams();
  const farmerIdParam = params.farmerId ? String(params.farmerId) : "";

  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [farmerId, setFarmerId] = useState("");

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Produce");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [unit, setUnit] = useState("each");
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    initializeScreen();
  }, [farmerIdParam]);

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
          access.reason ||
            "Your farmer membership is inactive. Please reactivate your subscription.",
          [
            {
              text: "Manage Subscription",
              onPress: () =>
                router.push("/farmer/compliance-upload" as any),
            },
          ]
        );

        router.replace("/farmer/dashboard" as any);
        return;
      }

      await loadFarmer();
    } catch (error) {
      console.log("Initialize produce screen error:", error);

      Alert.alert(
        "Access Error",
        "Unable to verify farmer membership."
      );
    }
  }

  async function loadFarmer() {
    try {
      let id = farmerIdParam;

      if (!id) {
        const saved = await AsyncStorage.getItem("currentFarmer");

        if (saved) {
          const parsed = JSON.parse(saved);
          id = parsed.id;
        }
      }

      if (!id) {
        Alert.alert("Missing Farmer", "Please return to farmer setup.");
        router.replace("/farmer/setup-store" as any);
        return;
      }

      const foundFarmer = await getFarmerById(id);

      if (!foundFarmer) {
        Alert.alert(
          "Farmer Not Found",
          "Please complete farmer setup first."
        );

        router.replace("/farmer/setup-store" as any);
        return;
      }

      setFarmer(foundFarmer);
      setFarmerId(foundFarmer.id);

      await AsyncStorage.setItem(
        "currentFarmer",
        JSON.stringify(foundFarmer)
      );
    } catch (error) {
      console.log("Load farmer produce error:", error);

      Alert.alert(
        "Error",
        "Unable to load farmer produce page."
      );
    }
  }

  async function pickImage() {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow photo access."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setImageUrl(result.assets[0].uri);
      }
    } catch (error) {
      console.log("Image picker error:", error);

      Alert.alert(
        "Image Error",
        "Unable to select image."
      );
    }
  }

  async function addProduce() {
    if (!farmerId) return;

    const access = await checkSubscriptionAccess({
      role: "farmer",
      userId: farmerId,
      email: farmer?.email || "",
    });

    if (!access.allowed) {
      Alert.alert(
        "Subscription Required",
        access.reason || "Farmer subscription inactive."
      );

      return;
    }

    if (!name.trim()) {
      Alert.alert(
        "Missing Produce Name",
        "Please enter the produce name."
      );
      return;
    }

    if (!price.trim() || Number(price) <= 0) {
      Alert.alert(
        "Missing Price",
        "Please enter a valid price."
      );
      return;
    }

    if (!stock.trim() || Number(stock) < 0) {
      Alert.alert(
        "Missing Stock",
        "Please enter available stock."
      );
      return;
    }

    const product: Partial<Product> = {
      id: `product-${Date.now()}`,
      farmerId,
      name: name.trim(),
      category: category.trim() || "Produce",
      description: description.trim(),
      price: Number(price),
      stock: Number(stock),
      quantity: Number(stock),
      unit: unit.trim() || "each",
      imageUrl: imageUrl.trim(),
      image: imageUrl.trim(),
      farmName: farmer?.farmName || "",
      farmerName: farmer?.ownerName || "",
      deliveryOption:
        farmer?.pickup && farmer?.delivery
          ? "Pickup / Delivery Available"
          : farmer?.pickup
          ? "Pickup Only"
          : farmer?.delivery
          ? "Delivery Only"
          : "Contact Farmer",
    };

    await addProductToFarmer(farmerId, product);

    Alert.alert(
      "Produce Added",
      `${name} was added to your store.`
    );

    setName("");
    setCategory("Produce");
    setDescription("");
    setPrice("");
    setStock("");
    setUnit("each");
    setImageUrl("");

    await loadFarmer();
  }

  async function removeProduce(productId: string) {
    if (!farmerId) return;

    await deleteFarmerProduct(farmerId, productId);

    Alert.alert("Removed", "Produce item removed.");

    await loadFarmer();
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>Add / Remove Produce</Text>

      <Text style={styles.subtitle}>
        Add produce, farm goods, meat, dairy, flowers,
        or market items to your Farm2Home store.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Add Produce</Text>

        <TextInput
          style={styles.input}
          placeholder="Produce name"
          value={name}
          onChangeText={setName}
        />

        <TextInput
          style={styles.input}
          placeholder="Category"
          value={category}
          onChangeText={setCategory}
        />

        <TextInput
          style={styles.input}
          placeholder="Description"
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <TextInput
          style={styles.input}
          placeholder="Price"
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
        />

        <TextInput
          style={styles.input}
          placeholder="Stock / Quantity"
          value={stock}
          onChangeText={setStock}
          keyboardType="number-pad"
        />

        <TextInput
          style={styles.input}
          placeholder="Unit, example: each, pound, dozen, bag"
          value={unit}
          onChangeText={setUnit}
        />

        <TextInput
          style={styles.input}
          placeholder="Image URL optional"
          value={imageUrl}
          onChangeText={setImageUrl}
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={styles.uploadImageButton}
          onPress={pickImage}
        >
          <Text style={styles.uploadImageButtonText}>
            Upload Produce Image
          </Text>
        </TouchableOpacity>

        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.previewImage}
          />
        ) : null}

        <TouchableOpacity
          style={styles.addButton}
          onPress={addProduce}
        >
          <Text style={styles.addButtonText}>
            Add Produce
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          Current Produce
        </Text>

        {!farmer?.products?.length ? (
          <Text style={styles.emptyText}>
            No produce added yet.
          </Text>
        ) : (
          farmer.products.map((product) => (
            <View
              key={product.id}
              style={styles.productRow}
            >
              {product.image || product.imageUrl ? (
                <Image
                  source={{
                    uri:
                      product.image || product.imageUrl,
                  }}
                  style={styles.productImage}
                />
              ) : null}

              <View style={{ flex: 1 }}>
                <Text style={styles.productName}>
                  {product.name}
                </Text>

                <Text style={styles.productInfo}>
                  ${product.price} •{" "}
                  {product.stock ?? product.quantity}{" "}
                  {product.unit}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.removeButton}
                onPress={() =>
                  removeProduce(product.id)
                }
              >
                <Text style={styles.removeButtonText}>
                  Remove
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <TouchableOpacity
        style={styles.dashboardButton}
        onPress={() =>
          router.push({
            pathname: "/farmer/dashboard",
            params: { farmerId },
          } as any)
        }
      >
        <Text style={styles.dashboardButtonText}>
          Go to Farmer Dashboard
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() =>
          router.replace("/farmer/setup-store" as any)
        }
      >
        <Text style={styles.backButtonText}>
          Back to Store Setup
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F5F7F2",
  },

  content: {
    padding: 18,
    paddingBottom: 40,
  },

  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#14532D",
  },

  subtitle: {
    marginTop: 8,
    marginBottom: 18,
    color: "#5E6D61",
    fontWeight: "700",
    lineHeight: 21,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#DDE7DB",
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#224B32",
    marginBottom: 14,
  },

  input: {
    borderWidth: 1,
    borderColor: "#D8E2D3",
    backgroundColor: "#FAFCF8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 10,
  },

  uploadImageButton: {
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },

  uploadImageButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  previewImage: {
    width: "100%",
    height: 220,
    borderRadius: 14,
    marginBottom: 12,
    backgroundColor: "#E5E7EB",
  },

  addButton: {
    backgroundColor: "#14532D",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },

  addButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },

  emptyText: {
    color: "#64748B",
    fontWeight: "700",
  },

  productRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEF2E8",
    gap: 12,
  },

  productImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
  },

  productName: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1F3D2B",
  },

  productInfo: {
    color: "#64748B",
    fontWeight: "700",
    marginTop: 3,
  },

  removeButton: {
    backgroundColor: "#B91C1C",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },

  removeButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  dashboardButton: {
    backgroundColor: "#2563EB",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },

  dashboardButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },

  backButton: {
    paddingVertical: 16,
    alignItems: "center",
  },

  backButtonText: {
    color: "#2E7D32",
    fontWeight: "900",
  },
});