import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import farmTheme from "../styles/farmTheme";

type SavedAddress = {
  id: string;
  label: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  defaultAddress: boolean;
};

const initialAddresses: SavedAddress[] = [
  {
    id: "home",
    label: "Home",
    address: "123 Farm2Home Way",
    city: "Sterling Heights",
    state: "MI",
    zip: "48310",
    defaultAddress: true,
  },
  {
    id: "work",
    label: "Work",
    address: "500 Marketplace Dr",
    city: "Detroit",
    state: "MI",
    zip: "48226",
    defaultAddress: false,
  },
];

export default function SavedAddresses() {
  const [addresses, setAddresses] = useState(initialAddresses);
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [makeDefault, setMakeDefault] = useState(false);

  function addAddress() {
    if (!label.trim() || !address.trim() || !city.trim() || !zip.trim()) {
      Alert.alert("Missing Details", "Please enter label, address, city, and ZIP.");
      return;
    }

    const newAddress: SavedAddress = {
      id: Date.now().toString(),
      label,
      address,
      city,
      state: "MI",
      zip,
      defaultAddress: makeDefault,
    };

    setAddresses((prev) => {
      const updated = makeDefault
        ? prev.map((item) => ({ ...item, defaultAddress: false }))
        : prev;

      return [newAddress, ...updated];
    });

    setLabel("");
    setAddress("");
    setCity("");
    setZip("");
    setMakeDefault(false);

    Alert.alert("Address Saved", "New delivery address saved.");
  }

  function setDefault(id: string) {
    setAddresses((prev) =>
      prev.map((item) => ({ ...item, defaultAddress: item.id === id }))
    );
  }

  function removeAddress(id: string) {
    setAddresses((prev) => prev.filter((item) => item.id !== id));
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home Account</Text>
        <Text style={styles.title}>Saved Addresses</Text>
        <Text style={styles.subtitle}>
          Save delivery addresses for faster checkout, delivery routing, and
          recurring subscriptions.
        </Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Add New Address</Text>

        <TextInput style={styles.input} placeholder="Label: Home, Work, Mom's House" value={label} onChangeText={setLabel} />
        <TextInput style={styles.input} placeholder="Street Address" value={address} onChangeText={setAddress} />
        <TextInput style={styles.input} placeholder="City" value={city} onChangeText={setCity} />
        <TextInput style={styles.input} placeholder="ZIP Code" value={zip} onChangeText={setZip} keyboardType="number-pad" />

        <View style={styles.toggleRow}>
          <Text style={styles.toggleText}>Make default address</Text>
          <Switch value={makeDefault} onValueChange={setMakeDefault} />
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={addAddress}>
          <Text style={styles.primaryText}>Save Address</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>My Addresses</Text>

      {addresses.map((item) => (
        <View key={item.id} style={styles.addressCard}>
          <View style={{ flex: 1 }}>
            <View style={styles.row}>
              <Text style={styles.addressLabel}>{item.label}</Text>
              {item.defaultAddress ? (
                <Text style={styles.defaultBadge}>Default</Text>
              ) : null}
            </View>

            <Text style={styles.addressText}>{item.address}</Text>
            <Text style={styles.addressText}>
              {item.city}, {item.state} {item.zip}
            </Text>
          </View>

          <View style={styles.actions}>
            {!item.defaultAddress ? (
              <TouchableOpacity
                style={styles.smallButton}
                onPress={() => setDefault(item.id)}
              >
                <Text style={styles.smallButtonText}>Default</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removeAddress(item.id)}
            >
              <Text style={styles.removeButtonText}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: farmTheme.colors.background },

  hero: {
    backgroundColor: farmTheme.colors.primary,
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  eyebrow: { color: "#D1FAE5", fontWeight: "900", marginBottom: 8 },

  title: { color: "#FFFFFF", fontSize: 36, fontWeight: "900", marginBottom: 10 },

  subtitle: { color: "#E8F5E9", fontWeight: "700", lineHeight: 23 },

  formCard: {
    backgroundColor: "#FFFFFF",
    margin: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  formTitle: {
    color: farmTheme.colors.text,
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 12,
  },

  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    color: farmTheme.colors.text,
    fontWeight: "700",
    marginBottom: 12,
  },

  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  toggleText: { color: farmTheme.colors.text, fontWeight: "900" },

  primaryButton: {
    backgroundColor: farmTheme.colors.primary,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },

  primaryText: { color: "#FFFFFF", fontWeight: "900" },

  sectionTitle: {
    color: farmTheme.colors.text,
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },

  addressCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    flexDirection: "row",
    gap: 12,
  },

  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },

  addressLabel: { color: farmTheme.colors.text, fontSize: 19, fontWeight: "900" },

  defaultBadge: {
    backgroundColor: "#DCFCE7",
    color: farmTheme.colors.primary,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
  },

  addressText: { color: farmTheme.colors.mutedText, fontWeight: "700", lineHeight: 22 },

  actions: { justifyContent: "center", gap: 8 },

  smallButton: {
    backgroundColor: farmTheme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    alignItems: "center",
  },

  smallButtonText: { color: "#FFFFFF", fontWeight: "900" },

  removeButton: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    alignItems: "center",
  },

  removeButtonText: { color: "#DC2626", fontWeight: "900" },
});