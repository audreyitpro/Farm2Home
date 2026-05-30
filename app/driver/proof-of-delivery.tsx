// app/driver/proof-of-delivery.tsx

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
import { uploadProofOfDeliveryImage } from "../services/storageService";
import { notifyDeliveryCompleted } from "../services/notificationService";
import freightTheme from "../styles/freightTheme";
import { getNextTriggerDateAsync } from "expo-notifications";

function getParamString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

export default function ProofOfDelivery() {
  const params = useLocalSearchParams();

  const loadId = getParamString(params.loadId);
  const orderId = getParamString(params.orderId);
  const proofId = loadId || orderId;

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

  async function updateOrderStatus(uploadedUrl: string, now: string) {
    try {
      if (!proofId) return;

      await supabase
        .from("orders")
        .update({
          fulfillmentStatus: "DELIVERED",
          status: "DELIVERED",
          delivered_at: now,
          proof_of_delivery_photo_url: uploadedUrl,
          delivery_receiver_name: receiverName.trim(),
          delivery_signature_text: signatureText.trim(),
          delivery_temperature: temperature.trim() || null,
          delivery_cold_chain_confirmed: coldChainConfirmed,
          delivery_damage_reported: damageReported,
          delivery_notes: notes.trim() || null,
        })
        .eq("id", proofId);
    } catch (error) {
      console.log("Order delivery status update skipped:", error);
    }
  }

  async function submitProofOfDelivery() {
    if (!proofId) {
      Alert.alert("Missing Load", "No delivery or load ID was provided.");
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
      const uploadedUrl = await uploadProofOfDeliveryImage(proofId, photoUri);

      const { error: proofError } = await supabase
        .from("proof_of_delivery")
        .insert({
          load_id: proofId,
          order_id: proofId,
          receiver_name: receiverName.trim(),
          signature_text: signatureText.trim(),
          delivery_photo_uri: uploadedUrl,
          proof_of_delivery_photo_url: uploadedUrl,
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
          delivery_receiver_name: receiverName.trim(),
          delivery_signature_text: signatureText.trim(),
          delivery_temperature: temperature.trim() || null,
          delivery_cold_chain_confirmed: coldChainConfirmed,
          delivery_damage_reported: damageReported,
          delivery_notes: notes.trim() || null,
        })
        .eq("id", proofId);

      if (loadError) {
        console.log("Freight load delivery update skipped:", loadError.message);
      }

      await updateOrderStatus(uploadedUrl, now);

      const { error: gpsError } = await supabase
        .from("driver_locations")
        .update({
          status: "delivered",
          updated_at: now,
        })
        .eq("load_id", proofId);

      if (gpsError) {
        console.log("Driver location delivery update error:", gpsError.message);
      }

      await notifyDeliveryCompleted();

      Alert.alert(
        "Proof Submitted",
        "Delivery proof was uploaded and the delivery was marked complete.",
        [
          {
            text: "Driver App",
            onPress: () => router.replace("/driver/mobile-driver-app" as any),
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
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="checkmark-done-outline" size={30} color="#FFFFFF" />
            </View>

            <Text style={styles.eyebrow}>Farm2Home Driver</Text>
            <Text style={styles.title}>Proof of Delivery</Text>
            <Text style={styles.subtitle}>
              Confirm receiver, delivery photo, condition, signature, and final
              delivery notes.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Delivery / Load</Text>
            <View style={styles.loadBox}>
              <Text style={styles.loadLabel}>Delivery ID</Text>
              <Text style={styles.metaText}>{proofId || "Not provided"}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Delivery Photo</Text>

            {photoUri ? (
              <View style={styles.photoWrap}>
                <Image source={{ uri: photoUri }} style={styles.photo} />
                <View style={styles.photoBadge}>
                  <Ionicons name="checkmark-circle" size={17} color="#BBF7D0" />
                  <Text style={styles.photoBadgeText}>Photo attached</Text>
                </View>
              </View>
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="camera-reverse-outline" size={38} color="#10B981" />
                <Text style={styles.photoPlaceholderTitle}>No photo attached</Text>
                <Text style={styles.photoPlaceholderText}>
                  Take or upload a clear photo before completing delivery.
                </Text>
              </View>
            )}

            <View style={styles.photoActions}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={takeDeliveryPhoto}
                disabled={loading}
              >
                <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
                <Text style={styles.buttonText}>
                  {photoUri ? "Retake Photo" : "Take Photo"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={pickDeliveryPhoto}
                disabled={loading}
              >
                <Ionicons
                  name="image-outline"
                  size={18}
                  color={freightTheme.colors.primary}
                />
                <Text style={styles.secondaryButtonText}>Upload</Text>
              </TouchableOpacity>
            </View>
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
              <Ionicons
                name={coldChainConfirmed ? "checkmark-circle" : "snow-outline"}
                size={18}
                color={coldChainConfirmed ? "#FFFFFF" : "#111827"}
              />
              <Text
                style={[
                  styles.toggleText,
                  coldChainConfirmed && styles.toggleTextActive,
                ]}
              >
                {coldChainConfirmed
                  ? "Cold Chain Confirmed"
                  : "Confirm Cold Chain"}
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
              <Ionicons
                name={damageReported ? "warning" : "warning-outline"}
                size={18}
                color={damageReported ? "#FFFFFF" : "#111827"}
              />
              <Text
                style={[styles.toggleText, damageReported && styles.toggleTextActive]}
              >
                {damageReported ? "Damage Reported" : "Report Damage"}
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
              <>
                <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
                <Text style={styles.submitText}>
                  Upload Proof + Complete Delivery
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace("/driver/mobile-driver-app" as any)}
            disabled={loading}
          >
            <Text style={styles.backText}>Back To Driver App</Text>
          </TouchableOpacity>
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
  content: {
    paddingBottom: 100,
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
  eyebrow: {
    color: "#10B981",
    fontWeight: "900",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
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
    fontWeight: "700",
  },
  card: {
    backgroundColor: freightTheme.colors.card,
    marginHorizontal: 18,
    marginTop: 16,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  sectionTitle: {
    color: freightTheme.colors.text,
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 12,
  },
  loadBox: {
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 16,
    padding: 14,
  },
  loadLabel: {
    color: freightTheme.colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  metaText: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    lineHeight: 22,
    marginTop: 4,
  },
  photoWrap: {
    marginBottom: 12,
  },
  photo: {
    width: "100%",
    height: 240,
    borderRadius: 18,
    backgroundColor: "#0F172A",
  },
  photoBadge: {
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
  photoBadgeText: {
    color: "#BBF7D0",
    fontWeight: "900",
  },
  photoPlaceholder: {
    height: 190,
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    padding: 18,
  },
  photoPlaceholderTitle: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    fontSize: 18,
    marginTop: 10,
  },
  photoPlaceholderText: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 21,
  },
  photoActions: {
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: freightTheme.colors.primary,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryButton: {
    flex: 0.7,
    backgroundColor: freightTheme.colors.surface,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
    flexDirection: "row",
    gap: 8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  secondaryButtonText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  input: {
    backgroundColor: "#FFFFFF",
    color: "#111827",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    fontWeight: "700",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  toggleButton: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
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
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
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
});  getNextTriggerDateAsync