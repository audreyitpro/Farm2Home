import { notifyPickupCompleted } from "../services/notificationService";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";

import { supabase } from "../services/supabaseClient";
import { uploadProofOfPickupImage } from "../services/storageService";

export default function ProofOfPickupScreen() {
  const params = useLocalSearchParams();
  const loadId = String(params.loadId || "");

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
    });

    if (!result.canceled && result.assets?.[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function submitPickupProof() {
    if (!loadId) {
      Alert.alert("Missing Load ID", "No freight load was selected.");
      return;
    }

    if (!photoUri) {
      Alert.alert("Missing Photo", "Please take a pickup photo first.");
      return;
    }

    try {
      setLoading(true);

      const now = new Date().toISOString();

      const uploadedUrl = await uploadProofOfPickupImage(loadId, photoUri);

      const { error } = await supabase
        .from("freight_loads")
        .update({
          status: "picked_up",
          picked_up_at: now,
          proof_of_pickup_photo_url: uploadedUrl,
          pickup_notes: notes.trim() || null,
          pickup_contact_name: pickupName.trim() || null,
        })
        .eq("id", loadId);

      if (error) {
        Alert.alert("Pickup Error", error.message);
        return;
      }

      await notifyPickupCompleted(loadId);

      Alert.alert("Pickup Complete", "Pickup proof has been uploaded and saved.", [
        {
          text: "Back To Live Location",
          onPress: () =>
            router.replace({
              pathname: "/driver/live-location-provider" as any,
              params: { loadId },
            }),
        },
        {
          text: "Freight Board",
          onPress: () => router.replace("/freight/board" as any),
        },
      ]);
    } catch (error: any) {
      console.log("PICKUP_PROOF_ERROR:", error);
      Alert.alert("Pickup Error", error?.message || "Unable to save pickup proof.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.kicker}>Farm2Home Driver</Text>
        <Text style={styles.title}>Proof of Pickup</Text>

        <Text style={styles.subtitle}>
          Take a pickup photo and confirm the freight was picked up.
        </Text>

        <Text style={styles.label}>Load ID</Text>
        <Text style={styles.loadId}>{loadId || "Missing load ID"}</Text>

        <TextInput
          style={styles.input}
          value={pickupName}
          onChangeText={setPickupName}
          placeholder="Pickup Contact Name"
          placeholderTextColor="#6B7280"
        />

        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Pickup Notes"
          placeholderTextColor="#6B7280"
          multiline
        />

        <TouchableOpacity style={styles.photoButton} onPress={takePhoto} disabled={loading}>
          <Text style={styles.photoButtonText}>
            {photoUri ? "Retake Pickup Photo" : "Take Pickup Photo"}
          </Text>
        </TouchableOpacity>

        {photoUri ? <Image source={{ uri: photoUri }} style={styles.preview} /> : null}

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.disabledButton]}
          onPress={submitPickupProof}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Upload + Submit Pickup Proof</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() =>
            router.replace({
              pathname: "/driver/live-location-provider" as any,
              params: { loadId },
            })
          }
        >
          <Text style={styles.backButtonText}>Back To Live Location</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F7F2" },
  content: { padding: 20 },
  kicker: {
    color: "#1F7A3F",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#064E3B",
    marginTop: 6,
  },
  subtitle: {
    color: "#4B5563",
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 18,
  },
  label: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  loadId: {
    color: "#111827",
    fontWeight: "800",
    marginTop: 4,
    marginBottom: 14,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    color: "#111827",
    fontWeight: "700",
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  photoButton: {
    backgroundColor: "#1F7A3F",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 14,
  },
  photoButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  preview: {
    width: "100%",
    height: 260,
    borderRadius: 16,
    marginBottom: 14,
  },
  submitButton: {
    backgroundColor: "#064E3B",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
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
    color: "#1F7A3F",
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.65,
  },
});