// app/farmer/profile.tsx
// Professional farmer profile + delivery settings + internal drivers + routing

import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

import { supabase } from "../data/supabaseClient";

const COLORS = {
  bg: "#F8FAF5",
  card: "#FFFFFF",
  text: "#172017",
  muted: "#6B7280",
  border: "#E3E8DD",
  primary: "#2E7D32",
  primaryDark: "#14532D",
  soft: "#EEF5EA",
  dark: "#111827",
  blue: "#2563EB",
  danger: "#DC2626",
};

export default function FarmerProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [farmer, setFarmer] = useState<any>(null);
  const [farmerId, setFarmerId] = useState("");

  const [farmName, setFarmName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [pickupEnabled, setPickupEnabled] = useState(true);
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [internalDriversEnabled, setInternalDriversEnabled] = useState(false);
  const [postToFarm2Driver, setPostToFarm2Driver] = useState(true);
  const [autoFreightHay, setAutoFreightHay] = useState(true);
  const [autoFreightLivestock, setAutoFreightLivestock] = useState(true);

  const [deliveryRadius, setDeliveryRadius] = useState("25");
  const [costPerMile, setCostPerMile] = useState("2.50");
  const [minimumDeliveryFee, setMinimumDeliveryFee] = useState("15.00");

  const [driverName, setDriverName] = useState("");
  const [driverEmail, setDriverEmail] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [drivers, setDrivers] = useState<any[]>([]);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);

      const saved =
        (await AsyncStorage.getItem("currentFarmer")) ||
        (await AsyncStorage.getItem("currentUser"));

      if (!saved) {
        router.replace("/farmer/login" as any);
        return;
      }

      const parsed = JSON.parse(saved);
      const id = parsed.id || parsed.farmerId;

      if (!id) {
        router.replace("/farmer/login" as any);
        return;
      }

      setFarmerId(id);

      let latestFarmer = parsed;

      const { data: farmerRow } = await supabase
        .from("farmers")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (farmerRow) {
        latestFarmer = {
          ...parsed,
          ...farmerRow,
          id: farmerRow.id,
          farmerId: farmerRow.id,
        };
      }

      setFarmer(latestFarmer);

      setFarmName(
        latestFarmer.farmName ||
          latestFarmer.farm_name ||
          latestFarmer.businessName ||
          latestFarmer.business_name ||
          latestFarmer.name ||
          ""
      );
      setOwnerName(latestFarmer.ownerName || latestFarmer.owner_name || "");
      setEmail(String(latestFarmer.email || "").toLowerCase());
      setPhone(latestFarmer.phone || "");

      const { data: settings } = await supabase
        .from("farmer_delivery_settings")
        .select("*")
        .eq("farmer_id", id)
        .maybeSingle();

      if (settings) {
        setPickupEnabled(settings.pickup_enabled !== false);
        setDeliveryEnabled(settings.delivery_enabled !== false);
        setInternalDriversEnabled(Boolean(settings.internal_drivers_enabled));
        setPostToFarm2Driver(
          settings.post_to_farm2driver_if_no_internal_driver !== false
        );
        setAutoFreightHay(settings.hay_freight_enabled !== false);
        setAutoFreightLivestock(settings.livestock_freight_enabled !== false);
        setDeliveryRadius(String(settings.delivery_radius_miles || 25));
        setCostPerMile(String(settings.cost_per_mile || 2.5));
        setMinimumDeliveryFee(String(settings.minimum_delivery_fee || 15));
      }

      const { data: driverRows } = await supabase
        .from("farmer_internal_drivers")
        .select("*")
        .eq("farmer_id", id)
        .eq("active", true)
        .order("created_at", { ascending: false });

      setDrivers(Array.isArray(driverRows) ? driverRows : []);
    } catch (error: any) {
      Alert.alert("Profile Error", error?.message || "Unable to load profile.");
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile() {
    try {
      setSaving(true);

      if (!farmerId) {
        Alert.alert("Session Error", "Please login again.");
        router.replace("/farmer/login" as any);
        return;
      }

      const now = new Date().toISOString();

      const updatedFarmer = {
        ...farmer,
        id: farmerId,
        farmerId,
        farmName: farmName.trim(),
        farm_name: farmName.trim(),
        businessName: farmName.trim(),
        business_name: farmName.trim(),
        ownerName: ownerName.trim(),
        owner_name: ownerName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        updatedAt: now,
      };

      await AsyncStorage.setItem("currentFarmer", JSON.stringify(updatedFarmer));
      await AsyncStorage.setItem("currentUser", JSON.stringify(updatedFarmer));
      await AsyncStorage.setItem("userRole", "farmer");
      await AsyncStorage.setItem("currentUserRole", "farmer");

      await supabase
        .from("farmers")
        .update({
          farm_name: farmName.trim(),
          business_name: farmName.trim(),
          owner_name: ownerName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          updated_at: now,
        })
        .eq("id", farmerId);

      await supabase.from("farmer_delivery_settings").upsert(
        {
          farmer_id: farmerId,
          pickup_enabled: pickupEnabled,
          delivery_enabled: deliveryEnabled,
          internal_drivers_enabled: internalDriversEnabled,
          post_to_farm2driver_if_no_internal_driver: postToFarm2Driver,
          delivery_radius_miles: Number(deliveryRadius || 25),
          cost_per_mile: Number(costPerMile || 2.5),
          minimum_delivery_fee: Number(minimumDeliveryFee || 15),
          livestock_freight_enabled: autoFreightLivestock,
          hay_freight_enabled: autoFreightHay,
          updated_at: now,
        },
        { onConflict: "farmer_id" }
      );

      setFarmer(updatedFarmer);
      Alert.alert("Saved", "Farmer profile and operations settings were saved.");
    } catch (error: any) {
      Alert.alert("Save Error", error?.message || "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function addInternalDriver() {
    if (!driverName.trim()) {
      Alert.alert("Missing Driver Name", "Enter the driver name.");
      return;
    }

    try {
      const { error } = await supabase.from("farmer_internal_drivers").insert({
        farmer_id: farmerId,
        driver_name: driverName.trim(),
        driver_email: driverEmail.trim().toLowerCase(),
        driver_phone: driverPhone.trim(),
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      setDriverName("");
      setDriverEmail("");
      setDriverPhone("");
      await loadProfile();

      Alert.alert("Driver Added", "Internal driver was added.");
    } catch (error: any) {
      Alert.alert("Driver Error", error?.message || "Unable to add driver.");
    }
  }

  async function removeDriver(driverId: string) {
    try {
      await supabase
        .from("farmer_internal_drivers")
        .update({
          active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", driverId);

      await loadProfile();
    } catch (error: any) {
      Alert.alert("Remove Error", error?.message || "Unable to remove driver.");
    }
  }

  function goTo(pathname: string, params?: Record<string, string>) {
    router.push(params ? ({ pathname, params } as any) : (pathname as any));
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.centerText}>Loading farmer profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Farmer Profile</Text>
            <Text style={styles.subtitle}>
              Store settings, delivery operations, internal drivers, and communication.
            </Text>
          </View>

          <Pressable style={styles.headerButton} onPress={() => goTo("/farmer/dashboard")}>
            <Text style={styles.headerButtonText}>Dashboard</Text>
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.farmInitialBox}>
            <Text style={styles.farmInitial}>
              {(farmName || "F").slice(0, 1).toUpperCase()}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>{farmName || "Farm2Home Farm"}</Text>
            <Text style={styles.heroSub}>{email || "No email saved"}</Text>
            <Text style={styles.heroMeta}>{drivers.length} internal driver(s)</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatCard label="Pickup" value={pickupEnabled ? "On" : "Off"} />
          <StatCard label="Delivery" value={deliveryEnabled ? "On" : "Off"} />
          <StatCard label="Driver Board" value={postToFarm2Driver ? "Auto" : "Manual"} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Business Information</Text>

          <Label text="Farm / Business Name" />
          <TextInput style={styles.input} value={farmName} onChangeText={setFarmName} />

          <Label text="Owner Name" />
          <TextInput style={styles.input} value={ownerName} onChangeText={setOwnerName} />

          <Label text="Email" />
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Label text="Phone" />
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Delivery / Pickup Settings</Text>

          <SettingRow
            title="Customer Pickup"
            subtitle="Allow customers to pick up orders from the farm."
            value={pickupEnabled}
            onValueChange={setPickupEnabled}
          />

          <SettingRow
            title="Farm Delivery"
            subtitle="Allow this farm to offer local delivery."
            value={deliveryEnabled}
            onValueChange={setDeliveryEnabled}
          />

          <SettingRow
            title="Use Internal Drivers First"
            subtitle="Assign orders to your farm drivers before posting to Farm2Driver."
            value={internalDriversEnabled}
            onValueChange={setInternalDriversEnabled}
          />

          <SettingRow
            title="Post to Farm2Driver if No Internal Driver"
            subtitle="Automatically post open delivery orders to the driver board."
            value={postToFarm2Driver}
            onValueChange={setPostToFarm2Driver}
          />

          <SettingRow
            title="Auto Freight for Hay"
            subtitle="Hay and bale orders can automatically create freight loads."
            value={autoFreightHay}
            onValueChange={setAutoFreightHay}
          />

          <SettingRow
            title="Auto Freight for Livestock"
            subtitle="Livestock orders can automatically create freight loads."
            value={autoFreightLivestock}
            onValueChange={setAutoFreightLivestock}
          />

          <View style={styles.rateRow}>
            <View style={styles.rateField}>
              <Label text="Radius Miles" />
              <TextInput
                style={styles.input}
                value={deliveryRadius}
                onChangeText={setDeliveryRadius}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.rateField}>
              <Label text="Cost / Mile" />
              <TextInput
                style={styles.input}
                value={costPerMile}
                onChangeText={setCostPerMile}
                keyboardType="numeric"
              />
            </View>
          </View>

          <Label text="Minimum Delivery Fee" />
          <TextInput
            style={styles.input}
            value={minimumDeliveryFee}
            onChangeText={setMinimumDeliveryFee}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Internal Drivers</Text>
          <Text style={styles.sectionSub}>
            Add drivers who belong to this farm. These drivers can receive farm delivery
            assignments before orders are posted to the public driver board.
          </Text>

          <Label text="Driver Name" />
          <TextInput style={styles.input} value={driverName} onChangeText={setDriverName} />

          <Label text="Driver Email" />
          <TextInput
            style={styles.input}
            value={driverEmail}
            onChangeText={setDriverEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Label text="Driver Phone" />
          <TextInput
            style={styles.input}
            value={driverPhone}
            onChangeText={setDriverPhone}
            keyboardType="phone-pad"
          />

          <Pressable style={styles.secondaryAction} onPress={addInternalDriver}>
            <Text style={styles.secondaryActionText}>Add Internal Driver</Text>
          </Pressable>

          {drivers.length === 0 ? (
            <Text style={styles.emptyText}>No internal drivers added.</Text>
          ) : (
            drivers.map((driver) => (
              <View key={driver.id} style={styles.driverRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.driverName}>
                    {driver.driver_name || "Farm Driver"}
                  </Text>
                  <Text style={styles.driverMeta}>
                    {driver.driver_email || "No email"} · {driver.driver_phone || "No phone"}
                  </Text>
                </View>

                <Pressable style={styles.removeButton} onPress={() => removeDriver(driver.id)}>
                  <Text style={styles.removeButtonText}>Remove</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Operations Center</Text>

          <RouteButton title="Farmer Orders" onPress={() => goTo("/farmer/orders")} />
          <RouteButton title="Delivery Orders" onPress={() => goTo("/farmer/delivery-orders")} />
          <RouteButton title="Assigned Drivers" onPress={() => goTo("/farmer/assigned-drivers")} />
          <RouteButton
            title="Farmer Driver Chat"
            onPress={() => goTo("/farmer/driver-chat", { farmerId })}
          />
          <RouteButton
            title="Customer / Driver Chat"
            onPress={() => goTo("/farmer/customer-driver-chat", { farmerId })}
          />
          <RouteButton title="Chat Center" onPress={() => goTo("/chat/chat-center", { role: "farmer" })} />
          <RouteButton title="Farm2Driver Board" onPress={() => goTo("/driver/board")} />
          <RouteButton title="Freight Board" onPress={() => goTo("/freight/board")} />
        </View>

        <Pressable
          style={[styles.saveButton, saving && styles.disabled]}
          onPress={saveProfile}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Profile Settings</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function SettingRow({
  title,
  subtitle,
  value,
  onValueChange,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSub}>{subtitle}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

function RouteButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.routeButton, pressed && styles.pressed]} onPress={onPress}>
      <Text style={styles.routeButtonText}>{title}</Text>
      <Text style={styles.routeArrow}>›</Text>
    </Pressable>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 40 },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  centerText: { marginTop: 10, color: COLORS.primary, fontWeight: "800" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 10,
  },
  title: { color: COLORS.text, fontSize: 24, fontWeight: "900" },
  subtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  headerButton: {
    backgroundColor: COLORS.dark,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  headerButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  farmInitialBox: {
    width: 62,
    height: 62,
    borderRadius: 18,
    backgroundColor: COLORS.dark,
    alignItems: "center",
    justifyContent: "center",
  },
  farmInitial: { color: "#FFFFFF", fontWeight: "900", fontSize: 25 },
  heroTitle: { color: "#FFFFFF", fontWeight: "900", fontSize: 21 },
  heroSub: { color: "#EAF7E6", fontWeight: "700", marginTop: 4 },
  heroMeta: { color: "#EAF7E6", fontWeight: "900", marginTop: 6, fontSize: 12 },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
  },
  statValue: { color: COLORS.primary, fontWeight: "900", fontSize: 14 },
  statLabel: { color: COLORS.muted, fontWeight: "800", marginTop: 4, fontSize: 11 },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900", marginBottom: 10 },
  sectionSub: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 18,
    fontSize: 12,
    marginBottom: 10,
  },
  label: {
    color: COLORS.muted,
    fontWeight: "900",
    fontSize: 12,
    marginBottom: 5,
    marginTop: 6,
  },
  input: {
    backgroundColor: COLORS.soft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
    fontWeight: "700",
    marginBottom: 6,
  },
  settingRow: {
    backgroundColor: COLORS.soft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  settingTitle: { color: COLORS.text, fontWeight: "900", fontSize: 14 },
  settingSub: {
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  rateRow: { flexDirection: "row", gap: 10 },
  rateField: { flex: 1 },
  secondaryAction: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 10,
  },
  secondaryActionText: { color: "#FFFFFF", fontWeight: "900" },
  emptyText: { color: COLORS.muted, fontWeight: "700", textAlign: "center", marginTop: 8 },
  driverRow: {
    backgroundColor: COLORS.soft,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  driverName: { color: COLORS.text, fontWeight: "900" },
  driverMeta: { color: COLORS.muted, fontWeight: "700", fontSize: 12, marginTop: 3 },
  removeButton: {
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  removeButtonText: { color: "#991B1B", fontWeight: "900", fontSize: 12 },
  routeButton: {
    backgroundColor: COLORS.soft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 13,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  routeButtonText: { flex: 1, color: COLORS.text, fontWeight: "900" },
  routeArrow: { color: COLORS.muted, fontSize: 22, fontWeight: "900" },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  saveButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 15 },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.75 },
});