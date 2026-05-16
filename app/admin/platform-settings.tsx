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

export default function PlatformSettings() {
  const [marketplaceLive, setMarketplaceLive] = useState(true);
  const [farmerApprovalsRequired, setFarmerApprovalsRequired] = useState(true);
  const [carrierApprovalsRequired, setCarrierApprovalsRequired] = useState(true);
  const [customerSubscriptionsEnabled, setCustomerSubscriptionsEnabled] = useState(true);
  const [freightEnabled, setFreightEnabled] = useState(true);
  const [commissionRate, setCommissionRate] = useState("12");
  const [supportEmail, setSupportEmail] = useState("support@farm2home.app");

  function saveSettings() {
    Alert.alert(
      "Platform Settings Saved",
      `Marketplace: ${marketplaceLive ? "Live" : "Paused"}\nCommission: ${commissionRate}%`
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Admin Controls</Text>
        <Text style={styles.title}>Platform Settings</Text>
        <Text style={styles.subtitle}>
          Manage marketplace status, approvals, subscriptions, freight features,
          commission rates, and support settings.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Platform Controls</Text>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Marketplace Live</Text>
            <Text style={styles.toggleText}>Allow customers to place marketplace orders.</Text>
          </View>
          <Switch value={marketplaceLive} onValueChange={setMarketplaceLive} />
        </View>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Farmer Approval Required</Text>
            <Text style={styles.toggleText}>Farmers must be verified before selling.</Text>
          </View>
          <Switch value={farmerApprovalsRequired} onValueChange={setFarmerApprovalsRequired} />
        </View>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Carrier Approval Required</Text>
            <Text style={styles.toggleText}>Carriers must be approved before booking loads.</Text>
          </View>
          <Switch value={carrierApprovalsRequired} onValueChange={setCarrierApprovalsRequired} />
        </View>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Customer Subscriptions Enabled</Text>
            <Text style={styles.toggleText}>Allow paid membership and recurring produce plans.</Text>
          </View>
          <Switch
            value={customerSubscriptionsEnabled}
            onValueChange={setCustomerSubscriptionsEnabled}
          />
        </View>

        <View style={styles.toggleRowLast}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Freight Enabled</Text>
            <Text style={styles.toggleText}>Enable load board and carrier workflows.</Text>
          </View>
          <Switch value={freightEnabled} onValueChange={setFreightEnabled} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Business Settings</Text>

        <Text style={styles.label}>Marketplace Commission Rate %</Text>
        <TextInput
          style={styles.input}
          value={commissionRate}
          onChangeText={setCommissionRate}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Support Email</Text>
        <TextInput
          style={styles.input}
          value={supportEmail}
          onChangeText={setSupportEmail}
          keyboardType="email-address"
        />

        <TouchableOpacity style={styles.primaryButton} onPress={saveSettings}>
          <Text style={styles.primaryText}>Save Platform Settings</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Production Add-ons</Text>
        <Text style={styles.infoItem}>• Role-based admin permissions</Text>
        <Text style={styles.infoItem}>• Feature flag database table</Text>
        <Text style={styles.infoItem}>• Audit logs</Text>
        <Text style={styles.infoItem}>• Stripe commission configuration</Text>
        <Text style={styles.infoItem}>• Platform status notifications</Text>
      </View>

      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  hero: {
    backgroundColor: "#111827",
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  eyebrow: { color: "#93C5FD", fontWeight: "900", marginBottom: 8 },
  title: { color: "#FFFFFF", fontSize: 35, fontWeight: "900", marginBottom: 10 },
  subtitle: { color: "#D1D5DB", fontWeight: "700", lineHeight: 23 },
  card: {
    backgroundColor: "#FFFFFF",
    margin: 18,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardTitle: { color: "#111827", fontSize: 23, fontWeight: "900", marginBottom: 12 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  toggleRowLast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 14,
  },
  toggleTitle: { color: "#111827", fontSize: 17, fontWeight: "900" },
  toggleText: { color: "#6B7280", fontWeight: "700", lineHeight: 20, marginTop: 4 },
  label: { color: "#111827", fontWeight: "900", marginBottom: 8 },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    color: "#111827",
    fontWeight: "700",
    marginBottom: 14,
  },
  primaryButton: {
    backgroundColor: "#2563EB",
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryText: { color: "#FFFFFF", fontWeight: "900" },
  infoCard: {
    backgroundColor: "#111827",
    marginHorizontal: 18,
    borderRadius: 22,
    padding: 18,
  },
  infoTitle: { color: "#FFFFFF", fontSize: 23, fontWeight: "900", marginBottom: 10 },
  infoItem: { color: "#BFDBFE", fontWeight: "800", lineHeight: 25 },
});