
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../data/supabaseClient";

export default function CreateMarketScreen() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!name.trim() || !city.trim() || !state.trim()) {
      Alert.alert(
        "Missing information",
        "Market name, city, and state are required."
      );
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        Alert.alert(
          "Login required",
          "Please sign in before registering a market."
        );
        return;
      }

      const { error } = await supabase
        .from("farmers_markets")
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          manager_user_id: user.id,
          address: address.trim() || null,
          city: city.trim(),
          state: state.trim(),
          zip_code: zipCode.trim() || null,
          vendor_capacity: 250,
          status: "pending",
        });

      if (error) throw error;

      Alert.alert(
        "Registration submitted",
        "Your farmers market has been submitted for approval.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/"),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        "Registration failed",
        error?.message || "Unable to register market."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>
        Register Farmers Market
      </Text>

      <Text style={styles.subtitle}>
        Create your market organization and manage up to
        250 participating vendors.
      </Text>

      <Text style={styles.label}>Market Name *</Text>
      <TextInput
        style={styles.input}
        placeholder="Example: Downtown Farmers Market"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Tell customers about your market"
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <Text style={styles.label}>Street Address</Text>
      <TextInput
        style={styles.input}
        placeholder="Market street address"
        value={address}
        onChangeText={setAddress}
      />

      <Text style={styles.label}>City *</Text>
      <TextInput
        style={styles.input}
        placeholder="City"
        value={city}
        onChangeText={setCity}
      />

      <Text style={styles.label}>State *</Text>
      <TextInput
        style={styles.input}
        placeholder="State"
        value={state}
        onChangeText={setState}
      />

      <Text style={styles.label}>ZIP Code</Text>
      <TextInput
        style={styles.input}
        placeholder="ZIP Code"
        value={zipCode}
        onChangeText={setZipCode}
        keyboardType="number-pad"
      />

      <View style={styles.capacityCard}>
        <Text style={styles.capacityTitle}>
          Market Vendor Capacity
        </Text>
        <Text style={styles.capacityNumber}>250</Text>
        <Text style={styles.capacityDescription}>
          Your organization can register up to
          250 participating farmers and vendors.
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.button,
          loading && styles.buttonDisabled,
        ]}
        onPress={handleRegister}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>
            Submit Market Registration
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7FAF5",
  },
  content: {
    padding: 22,
    paddingBottom: 50,
  },
  title: {
    fontSize: 27,
    fontWeight: "800",
    color: "#235C35",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#647067",
    lineHeight: 22,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#26382C",
    marginBottom: 7,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D5DED3",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 18,
    color: "#172A1C",
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  capacityCard: {
    backgroundColor: "#EAF4E7",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginVertical: 16,
  },
  capacityTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#235C35",
  },
  capacityNumber: {
    fontSize: 42,
    fontWeight: "900",
    color: "#235C35",
    marginVertical: 8,
  },
  capacityDescription: {
    textAlign: "center",
    color: "#4D6953",
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    backgroundColor: "#287B42",
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: "center",
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
});
