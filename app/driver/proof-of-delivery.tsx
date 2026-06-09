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

const COLORS = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  text: "#151922",
  muted: "#7B8494",
  border: "#E6E8EF",
  red: "#E1122D",
  redSoft: "#FFE6EA",
  black: "#111827",
  soft: "#F3F4F8",
  green: "#10B981",
  orange: "#F59E0B",
};

function getParamString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

export default function ProofOfDelivery() {
  const params = useLocalSearchParams();

  const loadId = getParamString(params.loadId);
  const orderId = getParamString(params.orderId);
  const deliveryJobId = getParamString(params.deliveryJobId);
  const deliveryOrderId = getParamString(params.deliveryOrderId);

  const proofId = deliveryJobId || deliveryOrderId || loadId || orderId;

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

    if (!result.canceled && result.assets?.[0]?.uri) {
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

    if (!result.canceled && result.assets?.[0]?.uri) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function updateDeliveryOrder(uploadedUrl: string, now: string) {
    const targetId = deliveryJobId || deliveryOrderId || loadId;

    if (!targetId) return;

    const { error } = await supabase
      .from("delivery_orders")
      .update({
        status: "delivered",
        delivered_at: now,
        proof_of_delivery_url: uploadedUrl,
        proof_of_delivery_photo_url: uploadedUrl,
        delivery_receiver_name: receiverName.trim(),
        delivery_signature_text: signatureText.trim(),
        delivery_temperature: temperature.trim() || null,
        delivery_cold_chain_confirmed: coldChainConfirmed,
        delivery_damage_reported: damageReported,
        delivery_notes: notes.trim() || null,
        updated_at: now,
      })
      .eq("id", targetId);

    if (error) {
      console.log("Delivery order update skipped:", error.message);
    }
  }

  async function updateFreightLoad(uploadedUrl: string, now: string) {
    if (!loadId) return;

    const { error } = await supabase
      .from("freight_loads")
      .update({
        status: "delivered",
        delivered_at: now,
        proof_of_delivery_photo_url: uploadedUrl,
        proof_of_delivery_url: uploadedUrl,
        delivery_receiver_name: receiverName.trim(),
        delivery_signature_text: signatureText.trim(),
        delivery_temperature: temperature.trim() || null,
        delivery_cold_chain_confirmed: coldChainConfirmed,
        delivery_damage_reported: damageReported,
        delivery_notes: notes.trim() || null,
        updated_at: now,
      })
      .eq("id", loadId);

    if (error) {
      console.log("Freight load delivery update skipped:", error.message);
    }
  }

  async function updateOrderStatus(uploadedUrl: string, now: string) {
    if (!orderId && !proofId) return;

    const targetOrderId = orderId || proofId;

    const { error } = await supabase
      .from("orders")
      .update({
        fulfillmentStatus: "DELIVERED",
        status: "DELIVERED",
        delivered_at: now,
        proof_of_delivery_photo_url: uploadedUrl,
        proof_of_delivery_url: uploadedUrl,
        delivery_receiver_name: receiverName.trim(),
        delivery_signature_text: signatureText.trim(),
        delivery_temperature: temperature.trim() || null,
        delivery_cold_chain_confirmed: coldChainConfirmed,
        delivery_damage_reported: damageReported,
        delivery_notes: notes.trim() || null,
        updated_at: now,
      })
      .eq("id", targetOrderId);

    if (error) {
      console.log("Order delivery status update skipped:", error.message);
    }
  }

  async function updateDriverLocation(now: string) {
    if (loadId) {
      await supabase
        .from("driver_locations")
        .update({
          status: "delivered",
          updated_at: now,
        })
        .eq("load_id", loadId);
    }

    if (deliveryJobId || deliveryOrderId) {
      await supabase
        .from("driver_locations")
        .update({
          status: "delivered",
          updated_at: now,
        })
        .eq("delivery_order_id", deliveryJobId || deliveryOrderId);
    }
  }

  async function saveDeliveryProof(uploadedUrl: string, now: string) {
    const deliveryOrderTarget = deliveryJobId || deliveryOrderId || loadId || null;

    const { error } = await supabase.from("delivery_proofs").insert({
      delivery_order_id: deliveryOrderTarget,
      proof_type: "delivery",
      image_url: uploadedUrl,
      signature_url: null,
      notes: notes.trim() || null,
      created_at: now,
    });

    if (error) {
      console.log("delivery_proofs insert skipped:", error.message);
    }

    const { error: legacyError } = await supabase.from("proof_of_delivery").insert({
      load_id: loadId || proofId,
      order_id: orderId || proofId,
      delivery_order_id: deliveryOrderTarget,
      receiver_name: receiverName.trim(),
      signature_text: signatureText.trim(),
      delivery_photo_uri: uploadedUrl,
      proof_of_delivery_photo_url: uploadedUrl,
      proof_of_delivery_url: uploadedUrl,
      temperature: temperature.trim() || null,
      cold_chain_confirmed: coldChainConfirmed,
      damage_reported: damageReported,
      notes: notes.trim() || null,
      created_at: now,
    });

    if (legacyError) {
      console.log("proof_of_delivery insert skipped:", legacyError.message);
    }
  }

  async function submitProofOfDelivery() {
    if (!proofId) {
      Alert.alert("Missing Delivery", "No delivery or load ID was provided.");
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

      await saveDeliveryProof(uploadedUrl, now);
      await updateDeliveryOrder(uploadedUrl, now);
      await updateFreightLoad(uploadedUrl, now);
      await updateOrderStatus(uploadedUrl, now);
      await updateDriverLocation(now);

      await notifyDeliveryCompleted().catch((error) => {
        console.log("Delivery completed notification skipped:", error);
      });

      Alert.alert(
        "Proof Submitted",
        "Delivery proof was uploaded and the delivery was marked complete.",
        [
          {
            text: "My Deliveries",
            onPress: () => router.replace("/driver/my-deliveries" as any),
          },
          {
            text: "Driver Board",
            onPress: () => router.replace("/driver/board" as any),
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
      <StatusBar barStyle="light-content" backgroundColor={COLORS.red} />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>Farm2Driver Verification</Text>
                <Text style={styles.title}>Proof Delivery</Text>
                <Text style={styles.subtitle}>
                  Confirm receiver, photo, condition, temperature, signature, and final notes.
                </Text>
              </View>

              <View style={styles.heroIcon}>
                <Ionicons name="checkmark-done" size={26} color="#FFFFFF" />
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.referenceBox}>
              <View style={styles.referenceIcon}>
                <Ionicons name="cube" size={19} color={COLORS.red} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.referenceLabel}>Delivery / Load ID</Text>
                <Text style={styles.referenceText}>{proofId || "Not provided"}</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Delivery Photo</Text>

            {photoUri ? (
              <View style={styles.photoWrap}>
                <Image source={{ uri: photoUri }} style={styles.photo} />
                <View style={styles.photoStatus}>
                  <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                  <Text style={styles.photoStatusText}>Photo attached</Text>
                </View>
              </View>
            ) : (
              <View style={styles.photoPlaceholder}>
                <View style={styles.photoPlaceholderIcon}>
                  <Ionicons name="camera-outline" size={34} color={COLORS.red} />
                </View>
                <Text style={styles.photoPlaceholderTitle}>No photo attached</Text>
                <Text style={styles.photoPlaceholderText}>
                  Take or upload a clear delivery photo before completing this shipment.
                </Text>
              </View>
            )}

            <View style={styles.photoActions}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={takeDeliveryPhoto}
                disabled={loading}
              >
                <Ionicons name="camera" size={18} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>
                  {photoUri ? "Retake Photo" : "Take Photo"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={pickDeliveryPhoto}
                disabled={loading}
              >
                <Ionicons name="image" size={18} color={COLORS.red} />
                <Text style={styles.secondaryButtonText}>Upload</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Receiver Confirmation</Text>

            <Text style={styles.inputLabel}>Receiver Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Receiver name"
              placeholderTextColor="#94A3B8"
              value={receiverName}
              onChangeText={setReceiverName}
            />

            <Text style={styles.inputLabel}>Signature / Initials</Text>
            <TextInput
              style={styles.input}
              placeholder="Receiver initials or signature confirmation"
              placeholderTextColor="#94A3B8"
              value={signatureText}
              onChangeText={setSignatureText}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Condition Details</Text>

            <Text style={styles.inputLabel}>Temperature</Text>
            <TextInput
              style={styles.input}
              placeholder="Example: 38°F"
              placeholderTextColor="#94A3B8"
              value={temperature}
              onChangeText={setTemperature}
            />

            <TouchableOpacity
              style={[
                styles.toggleButton,
                coldChainConfirmed && styles.coldChainActive,
              ]}
              onPress={() => setColdChainConfirmed((prev) => !prev)}
              disabled={loading}
            >
              <Ionicons
                name={coldChainConfirmed ? "snow" : "snow-outline"}
                size={18}
                color={coldChainConfirmed ? "#FFFFFF" : COLORS.red}
              />
              <Text
                style={[
                  styles.toggleText,
                  coldChainConfirmed && styles.toggleTextActive,
                ]}
              >
                {coldChainConfirmed ? "Cold Chain Confirmed" : "Confirm Cold Chain"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toggleButton, damageReported && styles.damageButtonActive]}
              onPress={() => setDamageReported((prev) => !prev)}
              disabled={loading}
            >
              <Ionicons
                name={damageReported ? "warning" : "warning-outline"}
                size={18}
                color={damageReported ? "#FFFFFF" : COLORS.red}
              />
              <Text style={[styles.toggleText, damageReported && styles.toggleTextActive]}>
                {damageReported ? "Damage Reported" : "Report Damage"}
              </Text>
            </TouchableOpacity>

            <Text style={styles.inputLabel}>Delivery Notes</Text>
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
                <Ionicons name="checkmark-circle" size={19} color="#FFFFFF" />
                <Text style={styles.submitText}>Submit Proof and Complete Delivery</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace("/driver/my-deliveries" as any)}
            disabled={loading}
          >
            <Text style={styles.backText}>Back to My Deliveries</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  keyboard: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    paddingBottom: 100,
  },
  hero: {
    backgroundColor: COLORS.red,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 26,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    color: "#FFE6EA",
    fontWeight: "900",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
  },
  subtitle: {
    color: "#FFFFFF",
    opacity: 0.9,
    lineHeight: 21,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 8,
  },
  card: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginTop: 14,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "900",
    marginBottom: 11,
  },
  referenceBox: {
    backgroundColor: COLORS.soft,
    borderRadius: 15,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  referenceIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: COLORS.redSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  referenceLabel: {
    color: COLORS.red,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  referenceText: {
    color: COLORS.text,
    fontWeight: "900",
    lineHeight: 21,
    marginTop: 4,
  },
  photoWrap: {
    marginBottom: 12,
  },
  photo: {
    width: "100%",
    height: 220,
    borderRadius: 18,
    backgroundColor: COLORS.black,
  },
  photoStatus: {
    backgroundColor: COLORS.green,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 11,
    alignSelf: "flex-start",
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  photoStatusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },
  photoPlaceholder: {
    minHeight: 180,
    backgroundColor: COLORS.soft,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
  },
  photoPlaceholderIcon: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: COLORS.redSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  photoPlaceholderTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 17,
    marginTop: 10,
  },
  photoPlaceholderText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
    fontSize: 13,
  },
  photoActions: {
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: COLORS.red,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryButton: {
    flex: 0.75,
    backgroundColor: COLORS.redSoft,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FFD6DE",
    flexDirection: "row",
    gap: 7,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  secondaryButtonText: {
    color: COLORS.red,
    fontWeight: "900",
  },
  inputLabel: {
    color: COLORS.text,
    fontWeight: "900",
    marginBottom: 7,
  },
  input: {
    backgroundColor: COLORS.soft,
    color: COLORS.text,
    borderRadius: 14,
    padding: 13,
    marginBottom: 12,
    fontWeight: "700",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textArea: {
    minHeight: 105,
    textAlignVertical: "top",
  },
  toggleButton: {
    backgroundColor: COLORS.soft,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  coldChainActive: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
  },
  damageButtonActive: {
    backgroundColor: COLORS.orange,
    borderColor: COLORS.orange,
  },
  toggleText: {
    color: COLORS.text,
    fontWeight: "900",
    textAlign: "center",
  },
  toggleTextActive: {
    color: "#FFFFFF",
  },
  submitButton: {
    backgroundColor: COLORS.red,
    marginHorizontal: 18,
    marginTop: 18,
    padding: 16,
    borderRadius: 15,
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
    fontSize: 15,
  },
  backButton: {
    backgroundColor: COLORS.black,
    marginHorizontal: 18,
    marginTop: 12,
    padding: 14,
    borderRadius: 15,
    alignItems: "center",
  },
  backText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});