// app/driver/proof-of-pickup.tsx

import { notifyPickupCompleted } from "../services/notificationService";
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
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../services/supabaseClient";
import { uploadProofOfPickupImage } from "../services/storageService";
import freightTheme from "../styles/freightTheme";

function getParamString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

export default function ProofOfPickupScreen() {
  const params = useLocalSearchParams();

  const loadId = getParamString(params.loadId);
  const orderId = getParamString(params.orderId);
  const proofId = loadId || orderId;

  const [photoUri, setPhotoUri] = useState("");
  const [pickupName, setPickupName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

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

    if (!result.canceled && result.assets?.[0]) {
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

    if (!result.canceled && result.assets?.[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function updateOrderStatus() {
    try {
      if (!proofId) return;

      await supabase
        .from("orders")
        .update({
          fulfillmentStatus: "PICKED_UP",
          status: "PICKED_UP",
          picked_up_at: new Date().toISOString(),
          pickup_notes: notes.trim() || null,
          pickup_contact_name: pickupName.trim() || null,
        })
        .eq("id", proofId);
    } catch (error) {
      console.log("Order pickup status update skipped:", error);
    }
  }

  async function submitPickupProof() {
    if (!proofId) {
      Alert.alert("Missing Load ID", "No delivery order was selected.");
      return;
    }

    if (!photoUri) {
      Alert.alert("Missing Photo", "Please take a pickup photo first.");
      return;
    }

    try {
      setLoading(true);

      const now = new Date().toISOString();
      const uploadedUrl = await uploadProofOfPickupImage(proofId, photoUri);

      const { error } = await supabase
        .from("freight_loads")
        .update({
          status: "picked_up",
          picked_up_at: now,
          proof_of_pickup_photo_url: uploadedUrl,
          pickup_notes: notes.trim() || null,
          pickup_contact_name: pickupName.trim() || null,
        })
        .eq("id", proofId);

      if (error) {
        console.log("Freight pickup update error:", error.message);
      }

      await updateOrderStatus();
      await notifyPickupCompleted();

      Alert.alert("Pickup Complete", "Pickup proof has been uploaded and saved.", [
        {
          text: "Back To Driver App",
          onPress: () => router.replace("/driver/mobile-driver-app" as any),
        },
        {
          text: "Live Location",
          onPress: () =>
            router.replace({
              pathname: "/driver/live-location-provider" as any,
              params: { loadId: proofId, orderId: proofId },
            }),
        },
      ]);
    } catch (error: any) {
      console.log("PICKUP_PROOF_ERROR:", error);
      Alert.alert("Pickup Error", error?.message || "Unable to save pickup proof.");
    } finally {
      setLoading(false);
    }
  }

  function goBackToDriverApp() {
    router.replace("/driver/mobile-driver-app" as any);
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
        >
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="camera-outline" size={30} color="#FFFFFF" />
            </View>

            <Text style={styles.kicker}>Farm2Home Driver</Text>
            <Text style={styles.title}>Proof of Pickup</Text>

            <Text style={styles.subtitle}>
              Capture pickup proof, confirm the pickup contact, and move this
              delivery into picked up status.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.loadBox}>
              <Text style={styles.label}>Delivery / Load ID</Text>
              <Text style={styles.loadId}>{proofId || "Missing load ID"}</Text>
            </View>

            <Text style={styles.inputLabel}>Pickup Contact Name</Text>
            <TextInput
              style={styles.input}
              value={pickupName}
              onChangeText={setPickupName}
              placeholder="Pickup Contact Name"
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
                <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
                <Text style={styles.photoButtonText}>
                  {photoUri ? "Retake Photo" : "Take Photo"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.libraryButton}
                onPress={chooseFromLibrary}
                disabled={loading}
              >
                <Ionicons
                  name="image-outline"
                  size={18}
                  color={freightTheme.colors.primary}
                />
                <Text style={styles.libraryButtonText}>Upload</Text>
              </TouchableOpacity>
            </View>

            {photoUri ? (
              <View style={styles.previewWrap}>
                <Image source={{ uri: photoUri }} style={styles.preview} />
                <View style={styles.previewBadge}>
                  <Ionicons name="checkmark-circle" size={17} color="#BBF7D0" />
                  <Text style={styles.previewBadgeText}>Photo attached</Text>
                </View>
              </View>
            ) : (
              <View style={styles.emptyPhotoBox}>
                <Ionicons name="camera-reverse-outline" size={38} color="#10B981" />
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
                <>
                  <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.submitButtonText}>
                    Upload + Submit Pickup Proof
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={goBackToDriverApp}
              disabled={loading}
            >
              <Text style={styles.backButtonText}>Back To Driver App</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.liveLocationButton}
              onPress={() =>
                router.replace({
                  pathname: "/driver/live-location-provider" as any,
                  params: { loadId: proofId, orderId: proofId },
                })
              }
              disabled={loading}
            >
              <Ionicons
                name="navigate-outline"
                size={18}
                color={freightTheme.colors.primary}
              />
              <Text style={styles.liveLocationText}>Back To Live Location</Text>
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
  hero: {
    backgroundColor: "#020617",
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 26,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#064E3B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#10B981",
    marginBottom: 14,
  },
  kicker: {
    color: "#10B981",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#FFFFFF",
    marginTop: 6,
  },
  subtitle: {
    color: "#CBD5E1",
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },
  card: {
    backgroundColor: freightTheme.colors.card,
    margin: 18,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  loadBox: {
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  label: {
    color: freightTheme.colors.primary,
    fontSize: 12,
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
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    color: "#111827",
    fontWeight: "700",
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  photoActions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  photoButton: {
    flex: 1,
    backgroundColor: freightTheme.colors.primary,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  photoButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  libraryButton: {
    flex: 0.7,
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
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
    height: 280,
    borderRadius: 18,
    backgroundColor: "#0F172A",
  },
  previewBadge: {
    backgroundColor: "#064E3B",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  previewBadgeText: {
    color: "#BBF7D0",
    fontWeight: "900",
  },
  emptyPhotoBox: {
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 18,
    padding: 22,
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  emptyPhotoTitle: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    fontSize: 18,
    marginTop: 10,
  },
  emptyPhotoText: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 21,
    textAlign: "center",
    marginTop: 6,
  },
  submitButton: {
    backgroundColor: "#064E3B",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  backButton: {
    marginTop: 18,
    alignItems: "center",
  },
  backButtonText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  liveLocationButton: {
    marginTop: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  liveLocationText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.65,
  },
});