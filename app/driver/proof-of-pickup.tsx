// app/driver/proof-of-pickup.tsx

import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL } from "../config/api";
import { supabase } from "../services/supabaseClient";
import { uploadProofOfPickupImage } from "../services/storageService";
import { notifyPickupCompleted } from "../services/notificationService";
import freightTheme from "../styles/freightTheme";

function getParamString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

export default function ProofOfPickupScreen() {
  const params = useLocalSearchParams();

  const loadId = getParamString(params.loadId);
  const orderId = getParamString(params.orderId);
  const deliveryJobId = getParamString(params.deliveryJobId);
  const deliveryOrderId = getParamString(params.deliveryOrderId);

  const proofId = deliveryJobId || deliveryOrderId || loadId || orderId;

  const [photoUri, setPhotoUri] = useState("");
  const [pickupName, setPickupName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  async function getCurrentDriver() {
    const raw =
      (await AsyncStorage.getItem("currentDriver")) ||
      (await AsyncStorage.getItem("farm2homeCurrentDriver")) ||
      (await AsyncStorage.getItem("farm2homeDriverSession")) ||
      (await AsyncStorage.getItem("currentUser"));

    let stored: any = null;

    if (raw) {
      try {
        stored = JSON.parse(raw);
      } catch {
        stored = null;
      }
    }

    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;

    const authUserId =
      authUser?.id ||
      stored?.authUserId ||
      stored?.id ||
      stored?.driverId ||
      "";

    const authEmail = normalize(authUser?.email || stored?.email || "");

    let dbDriver: any = null;
    let profile: any = null;

    if (authUserId) {
      const result = await supabase
        .from("drivers")
        .select("*")
        .eq("id", authUserId)
        .maybeSingle();

      if (!result.error && result.data) dbDriver = result.data;
    }

    if (!dbDriver && authEmail) {
      const result = await supabase
        .from("drivers")
        .select("*")
        .eq("email", authEmail)
        .maybeSingle();

      if (!result.error && result.data) dbDriver = result.data;
    }

    if (authUserId) {
      const result = await supabase
        .from("profiles")
        .select("*")
        .eq("auth_user_id", authUserId)
        .eq("role", "driver")
        .maybeSingle();

      if (!result.error && result.data) profile = result.data;
    }

    const stableId =
      dbDriver?.id ||
      stored?.id ||
      stored?.driverId ||
      authUserId ||
      profile?.auth_user_id ||
      "";

    if (!stableId) return null;

    const driver = {
      ...(stored || {}),
      ...(dbDriver || {}),
      id: stableId,
      driverId: stableId,
      authUserId: dbDriver?.auth_user_id || profile?.auth_user_id || authUserId,
      profileId: dbDriver?.profile_id || stored?.profileId || profile?.id || "",
      role: "driver",
      fullName:
        dbDriver?.full_name ||
        dbDriver?.name ||
        profile?.full_name ||
        stored?.fullName ||
        stored?.name ||
        stored?.username ||
        "Farm2Home Driver",
      name:
        dbDriver?.name ||
        dbDriver?.full_name ||
        profile?.full_name ||
        stored?.name ||
        stored?.fullName ||
        "Farm2Home Driver",
      email: normalize(dbDriver?.email || profile?.email || stored?.email || authEmail),
      username: dbDriver?.username || profile?.username || stored?.username || "",
    };

    await AsyncStorage.setItem("currentDriver", JSON.stringify(driver));
    await AsyncStorage.setItem("currentUser", JSON.stringify(driver));
    await AsyncStorage.setItem("farm2homeCurrentDriver", JSON.stringify(driver));
    await AsyncStorage.setItem("farm2homeDriverSession", JSON.stringify(driver));
    await AsyncStorage.setItem("userRole", "driver");
    await AsyncStorage.setItem("currentUserRole", "driver");

    return driver;
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Camera Permission Needed", "Please allow camera access.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.75,
      allowsEditing: false,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function chooseFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Photo Permission Needed", "Please allow photo library access.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.75,
      allowsEditing: false,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function savePickupProof(uploadedUrl: string, now: string) {
    const targetDeliveryId = deliveryJobId || deliveryOrderId || loadId || null;

    const { error: modernError } = await supabase.from("pickup_proofs").insert({
      delivery_order_id: targetDeliveryId,
      image_url: uploadedUrl,
      pickup_contact_name: pickupName.trim() || null,
      notes: notes.trim() || null,
      created_at: now,
    });

    if (modernError) {
      console.log("pickup_proofs insert skipped:", modernError.message);
    }

    const { error: proofError } = await supabase.from("delivery_proofs").insert({
      delivery_order_id: targetDeliveryId,
      proof_type: "pickup",
      image_url: uploadedUrl,
      signature_url: null,
      notes: notes.trim() || null,
      created_at: now,
    });

    if (proofError) {
      console.log("delivery_proofs pickup insert skipped:", proofError.message);
    }
  }

  async function updateBackendOrderStatus(driverId: string) {
    if (!proofId) return;

    try {
      await fetch(`${API_BASE_URL}/orders/${proofId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "PICKED_UP",
          driverId,
        }),
      });
    } catch (error) {
      console.log("Backend pickup status update skipped:", error);
    }
  }

  async function updateDeliveryOrder(driverId: string, uploadedUrl: string, now: string) {
    const targetId = deliveryJobId || deliveryOrderId || loadId;

    if (!targetId) return;

    const { error } = await supabase
      .from("delivery_orders")
      .update({
        status: "picked_up",
        picked_up_at: now,
        pickup_contact_name: pickupName.trim() || null,
        pickup_notes: notes.trim() || null,
        proof_of_pickup_photo_url: uploadedUrl,
        proof_of_pickup_url: uploadedUrl,
        driver_id: driverId,
        assigned_driver_id: driverId,
        updated_at: now,
      })
      .eq("id", targetId);

    if (error) {
      console.log("Delivery order pickup update skipped:", error.message);
    }
  }

  async function updateFreightLoad(driverId: string, uploadedUrl: string, now: string) {
    if (!loadId) return;

    const { error } = await supabase
      .from("freight_loads")
      .update({
        status: "picked_up",
        picked_up_at: now,
        proof_of_pickup_photo_url: uploadedUrl,
        proof_of_pickup_url: uploadedUrl,
        pickup_notes: notes.trim() || null,
        pickup_contact_name: pickupName.trim() || null,
        driver_id: driverId,
        assigned_driver_id: driverId,
        updated_at: now,
      })
      .eq("id", loadId);

    if (error) {
      console.log("Freight pickup update skipped:", error.message);
    }
  }

  async function updateOrderStatus(driverId: string, uploadedUrl: string, now: string) {
    if (!orderId && !proofId) return;

    const targetOrderId = orderId || proofId;

    const { error } = await supabase
      .from("orders")
      .update({
        fulfillmentStatus: "PICKED_UP",
        status: "PICKED_UP",
        picked_up_at: now,
        pickup_notes: notes.trim() || null,
        pickup_contact_name: pickupName.trim() || null,
        proof_of_pickup_photo_url: uploadedUrl,
        proof_of_pickup_url: uploadedUrl,
        assignedDriverId: driverId,
        driverId,
        updated_at: now,
      })
      .eq("id", targetOrderId);

    if (error) {
      console.log("Order pickup status update skipped:", error.message);
    }
  }

  async function updateDriverLocation(now: string) {
    if (loadId) {
      const { error } = await supabase
        .from("driver_locations")
        .update({
          status: "picked_up",
          updated_at: now,
        })
        .eq("load_id", loadId);

      if (error) {
        console.log("Driver location load pickup update skipped:", error.message);
      }
    }

    const deliveryLocationId = deliveryJobId || deliveryOrderId;

    if (deliveryLocationId) {
      const { error } = await supabase
        .from("driver_locations")
        .update({
          status: "picked_up",
          updated_at: now,
        })
        .eq("delivery_order_id", deliveryLocationId);

      if (error) {
        console.log("Driver location delivery pickup update skipped:", error.message);
      }
    }
  }

  async function submitPickupProof() {
    if (!proofId) {
      Alert.alert("Missing Delivery", "No delivery order was selected.");
      return;
    }

    if (!photoUri) {
      Alert.alert("Missing Photo", "Please take or upload a pickup photo first.");
      return;
    }

    try {
      setLoading(true);

      const driver = await getCurrentDriver();

      if (!driver?.id) {
        Alert.alert("Driver Login Required", "Please login again.");
        router.replace("/driver/login" as any);
        return;
      }

      const now = new Date().toISOString();
      const uploadedUrl = await uploadProofOfPickupImage(proofId, photoUri);

      await savePickupProof(uploadedUrl, now);
      await updateDeliveryOrder(driver.id, uploadedUrl, now);
      await updateFreightLoad(driver.id, uploadedUrl, now);
      await updateOrderStatus(driver.id, uploadedUrl, now);
      await updateBackendOrderStatus(driver.id);
      await updateDriverLocation(now);

      await notifyPickupCompleted().catch((notifyError) => {
        console.log("Pickup notification skipped:", notifyError);
      });

      Alert.alert("Pickup Complete", "Pickup proof has been uploaded and saved.", [
        {
          text: "Live Location",
          onPress: () =>
            router.replace({
              pathname: "/driver/live-location-provider" as any,
              params: {
                loadId: loadId || proofId,
                orderId: orderId || proofId,
                deliveryOrderId: deliveryJobId || deliveryOrderId || proofId,
                autoTracking: "true",
              },
            }),
        },
        {
          text: "My Deliveries",
          onPress: () => router.replace("/driver/my-deliveries" as any),
        },
      ]);
    } catch (error: any) {
      console.log("PICKUP_PROOF_ERROR:", error);
      Alert.alert("Pickup Error", error?.message || "Unable to save pickup proof.");
    } finally {
      setLoading(false);
    }
  }

  function goBackToDeliveries() {
    router.replace("/driver/my-deliveries" as any);
  }

  function goToLiveLocation() {
    router.replace({
      pathname: "/driver/live-location-provider" as any,
      params: {
        loadId: loadId || proofId,
        orderId: orderId || proofId,
        deliveryOrderId: deliveryJobId || deliveryOrderId || proofId,
        autoTracking: "true",
      },
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.kicker}>Driver Operations</Text>
            <Text style={styles.title}>Proof of Pickup</Text>

            <Text style={styles.subtitle}>
              Capture pickup proof, confirm pickup contact, and move this delivery into picked up status.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.loadBox}>
              <Text style={styles.label}>Delivery / Load ID</Text>
              <Text style={styles.loadId}>{proofId || "Missing delivery ID"}</Text>
            </View>

            <Text style={styles.inputLabel}>Pickup Contact Name</Text>
            <TextInput
              style={styles.input}
              value={pickupName}
              onChangeText={setPickupName}
              placeholder="Pickup contact name"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>Pickup Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Example: items loaded safely, boxes counted, farmer confirmed pickup"
              placeholderTextColor="#94A3B8"
              multiline
            />

            <View style={styles.photoActions}>
              <TouchableOpacity
                style={styles.photoButton}
                onPress={takePhoto}
                disabled={loading}
              >
                <Text style={styles.photoButtonText}>
                  {photoUri ? "Retake Photo" : "Take Photo"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.libraryButton}
                onPress={chooseFromLibrary}
                disabled={loading}
              >
                <Text style={styles.libraryButtonText}>Upload</Text>
              </TouchableOpacity>
            </View>

            {photoUri ? (
              <View style={styles.previewWrap}>
                <Image source={{ uri: photoUri }} style={styles.preview} />
                <View style={styles.previewBadge}>
                  <Text style={styles.previewBadgeText}>Photo attached</Text>
                </View>
              </View>
            ) : (
              <View style={styles.emptyPhotoBox}>
                <Ionicons name="camera-outline" size={34} color="#10B981" />
                <Text style={styles.emptyPhotoTitle}>No pickup photo yet</Text>
                <Text style={styles.emptyPhotoText}>
                  Take a clear photo of the picked-up order before submitting.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.disabledButton]}
              onPress={submitPickupProof}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>
                  Submit Pickup Proof
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={goToLiveLocation}
              disabled={loading}
            >
              <Text style={styles.secondaryActionText}>Open Live Tracking</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={goBackToDeliveries}
              disabled={loading}
            >
              <Text style={styles.backButtonText}>Back to My Deliveries</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  keyboard: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  header: {
    backgroundColor: "#020617",
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 26,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  kicker: {
    color: "#10B981",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FFFFFF",
    marginTop: 6,
  },
  subtitle: {
    color: "#CBD5E1",
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
    fontSize: 14,
  },
  card: {
    backgroundColor: freightTheme.colors.card,
    margin: 18,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  loadBox: {
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 13,
    padding: 13,
    marginBottom: 14,
  },
  label: {
    color: freightTheme.colors.primary,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  loadId: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    marginTop: 5,
    lineHeight: 20,
  },
  inputLabel: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    marginBottom: 7,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    padding: 13,
    marginBottom: 12,
    color: "#111827",
    fontWeight: "700",
  },
  textArea: {
    minHeight: 105,
    textAlignVertical: "top",
  },
  photoActions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  photoButton: {
    flex: 1,
    backgroundColor: freightTheme.colors.primary,
    borderRadius: 13,
    padding: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  photoButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  libraryButton: {
    flex: 0.7,
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 13,
    padding: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
  },
  libraryButtonText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  previewWrap: {
    marginBottom: 14,
  },
  preview: {
    width: "100%",
    height: 220,
    borderRadius: 14,
    backgroundColor: "#0F172A",
  },
  previewBadge: {
    backgroundColor: "#064E3B",
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 11,
    alignSelf: "flex-start",
    marginTop: 9,
  },
  previewBadgeText: {
    color: "#BBF7D0",
    fontWeight: "900",
    fontSize: 12,
  },
  emptyPhotoBox: {
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  emptyPhotoTitle: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    fontSize: 17,
    marginTop: 9,
  },
  emptyPhotoText: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 20,
    textAlign: "center",
    marginTop: 6,
    fontSize: 13,
  },
  submitButton: {
    backgroundColor: "#064E3B",
    borderRadius: 13,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  secondaryAction: {
    backgroundColor: "#111827",
    borderRadius: 13,
    padding: 14,
    alignItems: "center",
    marginTop: 10,
  },
  secondaryActionText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  backButton: {
    marginTop: 14,
    alignItems: "center",
  },
  backButtonText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.65,
  },
});