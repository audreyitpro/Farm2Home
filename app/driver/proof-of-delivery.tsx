import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";

import { supabase } from "../services/supabaseClient";
import { uploadProofOfDeliveryImage } from "../services/storageService";
import { notifyDeliveryCompleted } from "../services/notificationService";

export default function ProofOfDelivery() {
  const params = useLocalSearchParams();
  const loadId = String(params.loadId || "");

  const [loading, setLoading] = useState(false);
  const [photoUri, setPhotoUri] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [temperature, setTemperature] = useState("");
  const [notes, setNotes] = useState("");
  const [damageReported, setDamageReported] = useState(false);
  const [coldChainConfirmed, setColdChainConfirmed] = useState(false);
  const [signatureText, setSignatureText] = useState("");

  async function pickDeliveryPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission Needed", "Please allow photo access.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets?.[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function takeDeliveryPhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Camera Permission Needed", "Please allow camera access.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets?.[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function submitProofOfDelivery() {
    if (!loadId) {
      Alert.alert("Missing Load", "No load ID was provided.");
      return;
    }

    if (!photoUri) {
      Alert.alert("Missing Photo", "Please take or upload a delivery photo.");
      return;
    }

    if (!receiverName.trim()) {
      Alert.alert("Missing Receiver", "Please enter the receiver name.");
      return;
    }

    if (!signatureText.trim()) {
      Alert.alert(
        "Missing Signature",
        "Please enter receiver initials or signature confirmation."
      );
      return;
    }

    try {
      setLoading(true);

      const now = new Date().toISOString();
      const uploadedUrl = await uploadProofOfDeliveryImage(loadId, photoUri);

      const { error: proofError } = await supabase
        .from("proof_of_delivery")
        .insert({
          load_id: loadId,
          receiver_name: receiverName.trim(),
          signature_text: signatureText.trim(),
          delivery_photo_uri: uploadedUrl,
          temperature: temperature.trim() || null,
          cold_chain_confirmed: coldChainConfirmed,
          damage_reported: damageReported,
          notes: notes.trim() || null,
          created_at: now,
        });

      if (proofError) {
        Alert.alert("Proof Error", proofError.message);
        return;
      }

      const { error: loadError } = await supabase
        .from("freight_loads")
        .update({
          status: "delivered",
          delivered_at: now,
          proof_of_delivery_photo_url: uploadedUrl,
        })
        .eq("id", loadId);

      if (loadError) {
        Alert.alert("Delivery Update Error", loadError.message);
        return;
      }

      const { error: gpsError } = await supabase
        .from("driver_locations")
        .update({
          status: "delivered",
          updated_at: now,
        })
        .eq("load_id", loadId);

      if (gpsError) {
        console.log("Driver location delivery update error:", gpsError.message);
      }

      await notifyDeliveryCompleted(loadId);

      Alert.alert(
        "Proof Submitted",
        "Delivery proof was uploaded and the load was marked delivered.",
        [
          {
            text: "Freight Board",
            onPress: () => router.replace("/freight/board" as any),
          },
          {
            text: "Earnings",
            onPress: () => router.replace("/driver/earnings" as any),
          },
        ]
      );
    } catch (error: any) {
      console.log("PROOF_DELIVERY_ERROR:", error);
      Alert.alert("Proof Error", error?.message || "Unable to submit proof.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home Driver</Text>
        <Text style={styles.title}>Proof of Delivery</Text>
        <Text style={styles.subtitle}>
          Confirm receiver, photo, condition, and delivery notes.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Load</Text>
        <Text style={styles.metaText}>Load ID: {loadId || "Not provided"}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Delivery Photo</Text>

        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoPlaceholderText}>No photo attached</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={takeDeliveryPhoto}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Take Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={pickDeliveryPhoto}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Upload Photo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Receiver Confirmation</Text>

        <TextInput
          style={styles.input}
          placeholder="Receiver Name"
          placeholderTextColor="#94A3B8"
          value={receiverName}
          onChangeText={setReceiverName}
        />

        <TextInput
          style={styles.input}
          placeholder="Signature Confirmation / Receiver Initials"
          placeholderTextColor="#94A3B8"
          value={signatureText}
          onChangeText={setSignatureText}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Cold Chain / Condition</Text>

        <TextInput
          style={styles.input}
          placeholder="Temperature, example: 38°F"
          placeholderTextColor="#94A3B8"
          value={temperature}
          onChangeText={setTemperature}
        />

        <TouchableOpacity
          style={[
            styles.toggleButton,
            coldChainConfirmed && styles.toggleButtonActive,
          ]}
          onPress={() => setColdChainConfirmed((prev) => !prev)}
          disabled={loading}
        >
          <Text
            style={[
              styles.toggleText,
              coldChainConfirmed && styles.toggleTextActive,
            ]}
          >
            {coldChainConfirmed
              ? "✓ Cold Chain Confirmed"
              : "Cold Chain Confirmed"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleButton,
            damageReported && styles.damageButtonActive,
          ]}
          onPress={() => setDamageReported((prev) => !prev)}
          disabled={loading}
        >
          <Text
            style={[styles.toggleText, damageReported && styles.toggleTextActive]}
          >
            {damageReported ? "✓ Damage Reported" : "Damage Reported"}
          </Text>
        </TouchableOpacity>

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Delivery notes, condition notes, exceptions..."
          placeholderTextColor="#94A3B8"
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </View>

      <TouchableOpacity
        style={[styles.submitButton, loading && styles.disabledButton]}
        onPress={submitProofOfDelivery}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.submitText}>Upload Proof + Complete Delivery</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7F2",
  },
  content: {
    paddingBottom: 60,
  },
  hero: {
    backgroundColor: "#111827",
    paddingTop: 62,
    paddingHorizontal: 20,
    paddingBottom: 26,
  },
  eyebrow: {
    color: "#10B981",
    fontWeight: "900",
    marginBottom: 8,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 10,
  },
  subtitle: {
    color: "#D1D5DB",
    lineHeight: 23,
    fontSize: 15,
  },
  card: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginTop: 16,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 12,
  },
  metaText: {
    color: "#4B5563",
    fontWeight: "700",
    lineHeight: 22,
  },
  photo: {
    width: "100%",
    height: 220,
    borderRadius: 18,
    marginBottom: 12,
  },
  photoPlaceholder: {
    height: 180,
    backgroundColor: "#F3F4F6",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  photoPlaceholderText: {
    color: "#6B7280",
    fontWeight: "800",
  },
  input: {
    backgroundColor: "#F3F4F6",
    color: "#111827",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    fontWeight: "700",
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  primaryButton: {
    backgroundColor: "#10B981",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  secondaryButton: {
    backgroundColor: "#334155",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  toggleButton: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  toggleButtonActive: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  damageButtonActive: {
    backgroundColor: "#DC2626",
    borderColor: "#DC2626",
  },
  toggleText: {
    color: "#111827",
    fontWeight: "900",
    textAlign: "center",
  },
  toggleTextActive: {
    color: "#FFFFFF",
  },
  submitButton: {
    backgroundColor: "#10B981",
    marginHorizontal: 18,
    marginTop: 18,
    padding: 17,
    borderRadius: 16,
    alignItems: "center",
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  backButton: {
    backgroundColor: "#111827",
    marginHorizontal: 18,
    marginTop: 12,
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
  },
  backText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});