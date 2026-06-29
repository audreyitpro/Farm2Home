// app/farmer/profile.tsx

import React, { useEffect, useMemo, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";

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
  white: "#FFFFFF",
  dark: "#111827",
  danger: "#DC2626",
  dangerSoft: "#FEE2E2",
  orangeSoft: "#FFF3DE",
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

  const readiness = useMemo(() => {
    const checks = [
      Boolean(farmName.trim()),
      Boolean(ownerName.trim()),
      Boolean(email.trim()),
      Boolean(phone.trim()),
      pickupEnabled || deliveryEnabled,
    ];

    const complete = checks.filter(Boolean).length;

    return {
      complete,
      total: checks.length,
      percent: Math.round((complete / checks.length) * 100),
    };
  }, [farmName, ownerName, email, phone, pickupEnabled, deliveryEnabled]);

  async function loadProfile() {
    try {
      setLoading(true);

      const saved =
        (await AsyncStorage.getItem("currentFarmer")) ||
        (await AsyncStorage.getItem("farm2homeCurrentFarmer")) ||
        (await AsyncStorage.getItem("farm2homeFarmerSession")) ||
        (await AsyncStorage.getItem("currentUser"));

      if (!saved) {
        router.replace("/farmer/login" as any);
        return;
      }

      const parsed = JSON.parse(saved);
      const id = parsed.id || parsed.farmerId || parsed.farmer_id || parsed.profile_id;

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
          farmer_id: farmerRow.farmer_id || farmerRow.id,
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
      setEmail(String(latestFarmer.email || latestFarmer.farmer_email || "").toLowerCase());
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

      if (!farmName.trim() || !ownerName.trim() || !email.trim()) {
        Alert.alert("Missing Details", "Farm name, owner name, and email are required.");
        return;
      }

      if (!pickupEnabled && !deliveryEnabled) {
        Alert.alert("Fulfillment Needed", "Enable pickup, delivery, or both.");
        return;
      }

      const now = new Date().toISOString();

      const updatedFarmer = {
        ...farmer,
        id: farmerId,
        farmerId,
        farmer_id: farmerId,
        farmName: farmName.trim(),
        farm_name: farmName.trim(),
        businessName: farmName.trim(),
        business_name: farmName.trim(),
        ownerName: ownerName.trim(),
        owner_name: ownerName.trim(),
        email: email.trim().toLowerCase(),
        farmer_email: email.trim().toLowerCase(),
        phone: phone.trim(),
        updatedAt: now,
        updated_at: now,
      };

      await AsyncStorage.multiSet([
        ["currentFarmer", JSON.stringify(updatedFarmer)],
        ["farm2homeCurrentFarmer", JSON.stringify(updatedFarmer)],
        ["farm2homeFarmerSession", JSON.stringify(updatedFarmer)],
        ["currentUser", JSON.stringify(updatedFarmer)],
        ["userRole", "farmer"],
        ["currentUserRole", "farmer"],
      ]);

      await supabase
        .from("farmers")
        .update({
          farm_name: farmName.trim(),
          business_name: farmName.trim(),
          owner_name: ownerName.trim(),
          email: email.trim().toLowerCase(),
          farmer_email: email.trim().toLowerCase(),
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
      Alert.alert("Saved", "Farmer profile and market operations settings were saved.");
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

      Alert.alert("Driver Added", "Internal driver was added to your farm team.");
    } catch (error: any) {
      Alert.alert("Driver Error", error?.message || "Unable to add driver.");
    }
  }

  async function removeDriver(driverId: string) {
    Alert.alert("Remove Driver", "Remove this driver from your farm team?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
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
        },
      },
    ]);
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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => goTo("/farmer/dashboard")}>
            <Ionicons name="arrow-back-outline" size={22} color={COLORS.text} />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Farm2Home Market</Text>
            <Text style={styles.title}>Farmer Profile</Text>
            <Text style={styles.subtitle}>
              Manage store profile, fulfillment, drivers, and operations.
            </Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.farmInitialBox}>
            <Text style={styles.farmInitial}>
              {(farmName || "F").slice(0, 1).toUpperCase()}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.heroBadge}>Farmer Operations Center</Text>
            <Text style={styles.heroTitle}>{farmName || "Farm2Home Farm"}</Text>
            <Text style={styles.heroSub}>{email || "No email saved"}</Text>
            <Text style={styles.heroMeta}>{drivers.length} internal driver(s)</Text>
          </View>
        </View>

        <View style={styles.flowCard}>
          <Text style={styles.flowTitle}>Profile Setup Flow</Text>
          <FlowStep number="1" text="Save business information customers can trust" />
          <FlowStep number="2" text="Set pickup, delivery radius, and delivery fees" />
          <FlowStep number="3" text="Add internal drivers for local fulfillment" />
          <FlowStep number="4" text="Use operations links to manage orders and deliveries" />
        </View>

        <View style={styles.readinessCard}>
          <View style={styles.readinessHeader}>
            <Text style={styles.readinessTitle}>Market Readiness</Text>
            <Text style={styles.readinessPercent}>{readiness.percent}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${readiness.percent}%` }]} />
          </View>
          <Text style={styles.readinessText}>
            {readiness.complete}/{readiness.total} required profile items complete.
          </Text>
        </View>

        <View style={styles.statsRow}>
          <StatCard label="Pickup" value={pickupEnabled ? "On" : "Off"} icon="bag-handle-outline" />
          <StatCard label="Delivery" value={deliveryEnabled ? "On" : "Off"} icon="car-outline" />
          <StatCard label="Driver Board" value={postToFarm2Driver ? "Auto" : "Manual"} icon="trail-sign-outline" />
        </View>

        <View style={styles.card}>
          <SectionHeader
            step="Step 1"
            title="Business Information"
            subtitle="This information appears across the farmer market."
            icon="storefront-outline"
          />

          <Field label="Farm / Business Name" value={farmName} onChangeText={setFarmName} icon="leaf-outline" />
          <Field label="Owner Name" value={ownerName} onChangeText={setOwnerName} icon="person-outline" />
          <Field
            label="Email"
            value={email}
            onChangeText={(value) => setEmail(value.toLowerCase())}
            icon="mail-outline"
            keyboardType="email-address"
          />
          <Field label="Phone" value={phone} onChangeText={setPhone} icon="call-outline" keyboardType="phone-pad" />
        </View>

        <View style={styles.card}>
          <SectionHeader
            step="Step 2"
            title="Fulfillment Settings"
            subtitle="Control how customers receive products and bundles."
            icon="car-outline"
          />

          <SettingRow
            title="Customer Pickup"
            subtitle="Allow customers to pick up orders from the farm."
            value={pickupEnabled}
            onValueChange={setPickupEnabled}
            icon="bag-handle-outline"
          />

          <SettingRow
            title="Farm Delivery"
            subtitle="Allow this farm to offer local delivery."
            value={deliveryEnabled}
            onValueChange={setDeliveryEnabled}
            icon="bicycle-outline"
          />

          <View style={styles.rateRow}>
            <View style={styles.rateField}>
              <Field
                label="Radius Miles"
                value={deliveryRadius}
                onChangeText={setDeliveryRadius}
                icon="navigate-outline"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.rateField}>
              <Field
                label="Cost / Mile"
                value={costPerMile}
                onChangeText={setCostPerMile}
                icon="cash-outline"
                keyboardType="numeric"
              />
            </View>
          </View>

          <Field
            label="Minimum Delivery Fee"
            value={minimumDeliveryFee}
            onChangeText={setMinimumDeliveryFee}
            icon="wallet-outline"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.card}>
          <SectionHeader
            step="Step 3"
            title="Delivery Automation"
            subtitle="Choose how farm orders become delivery or freight jobs."
            icon="git-branch-outline"
          />

          <SettingRow
            title="Use Internal Drivers First"
            subtitle="Assign orders to farm drivers before posting to Farm2Driver."
            value={internalDriversEnabled}
            onValueChange={setInternalDriversEnabled}
            icon="people-outline"
          />

          <SettingRow
            title="Post to Farm2Driver if No Driver"
            subtitle="Automatically post open delivery orders to the driver board."
            value={postToFarm2Driver}
            onValueChange={setPostToFarm2Driver}
            icon="trail-sign-outline"
          />

          <SettingRow
            title="Auto Freight for Hay"
            subtitle="Hay and bale orders can automatically create freight loads."
            value={autoFreightHay}
            onValueChange={setAutoFreightHay}
            icon="cube-outline"
          />

          <SettingRow
            title="Auto Freight for Livestock"
            subtitle="Livestock orders can automatically create freight loads."
            value={autoFreightLivestock}
            onValueChange={setAutoFreightLivestock}
            icon="paw-outline"
          />
        </View>

        <View style={styles.card}>
          <SectionHeader
            step="Step 4"
            title="Internal Drivers"
            subtitle="Add trusted drivers who can deliver local farm orders."
            icon="people-outline"
          />

          <Field label="Driver Name" value={driverName} onChangeText={setDriverName} icon="person-add-outline" />
          <Field
            label="Driver Email"
            value={driverEmail}
            onChangeText={(value) => setDriverEmail(value.toLowerCase())}
            icon="mail-outline"
            keyboardType="email-address"
          />
          <Field label="Driver Phone" value={driverPhone} onChangeText={setDriverPhone} icon="call-outline" keyboardType="phone-pad" />

          <Pressable style={styles.secondaryAction} onPress={addInternalDriver}>
            <Ionicons name="person-add-outline" size={18} color={COLORS.white} />
            <Text style={styles.secondaryActionText}>Add Internal Driver</Text>
          </Pressable>

          {drivers.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🚚</Text>
              <Text style={styles.emptyTitle}>No internal drivers yet</Text>
              <Text style={styles.emptyText}>
                Add drivers here or use Farm2Driver for open delivery jobs.
              </Text>
            </View>
          ) : (
            drivers.map((driver) => (
              <View key={driver.id} style={styles.driverRow}>
                <View style={styles.driverInitialBox}>
                  <Text style={styles.driverInitial}>
                    {String(driver.driver_name || "D").slice(0, 1).toUpperCase()}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.driverName}>{driver.driver_name || "Farm Driver"}</Text>
                  <Text style={styles.driverMeta}>
                    {driver.driver_email || "No email"} · {driver.driver_phone || "No phone"}
                  </Text>
                </View>

                <Pressable style={styles.removeButton} onPress={() => removeDriver(driver.id)}>
                  <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                </Pressable>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <SectionHeader
            step="Step 5"
            title="Operations Center"
            subtitle="Jump into the farmer tools that run your market."
            icon="grid-outline"
          />

          <RouteButton title="Farmer Orders" icon="receipt-outline" onPress={() => goTo("/farmer/orders")} />
          <RouteButton title="Delivery Orders" icon="cube-outline" onPress={() => goTo("/farmer/delivery-orders")} />
          <RouteButton title="Assigned Drivers" icon="car-outline" onPress={() => goTo("/farmer/assigned-drivers")} />
          <RouteButton title="Inventory Management" icon="archive-outline" onPress={() => goTo("/farmer/inventory-management")} />
          <RouteButton title="Farm Bundles" icon="basket-outline" onPress={() => goTo("/farmer/farm-bundles")} />
          <RouteButton title="Post Load" icon="trail-sign-outline" onPress={() => goTo("/farmer/post-load")} />
          <RouteButton title="Farmer Driver Chat" icon="chatbox-outline" onPress={() => goTo("/farmer/driver-chat", { farmerId })} />
          <RouteButton title="Customer / Driver Chat" icon="chatbubbles-outline" onPress={() => goTo("/farmer/customer-driver-chat", { farmerId })} />
        </View>

        <Pressable
          style={[styles.saveButton, saving && styles.disabled]}
          onPress={saveProfile}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Ionicons name="save-outline" size={18} color={COLORS.white} />
              <Text style={styles.saveButtonText}>Save Profile & Operations</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

function SectionHeader({
  step,
  title,
  subtitle,
  icon,
}: {
  step: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={21} color={COLORS.primaryDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.stepText}>{step}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSub}>{subtitle}</Text>
      </View>
    </View>
  );
}

function FlowStep({ number, text }: { number: string; text: string }) {
  return (
    <View style={styles.flowStep}>
      <Text style={styles.flowNumber}>{number}</Text>
      <Text style={styles.flowText}>{text}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  icon,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  icon: keyof typeof Ionicons.glyphMap;
  keyboardType?: any;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputShell}>
        <Ionicons name={icon} size={18} color={COLORS.muted} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={keyboardType === "email-address" ? "none" : "words"}
          autoCorrect={false}
          placeholder={label}
          placeholderTextColor="#94A3B8"
        />
      </View>
    </View>
  );
}

function SettingRow({
  title,
  subtitle,
  value,
  onValueChange,
  icon,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={20} color={COLORS.primaryDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSub}>{subtitle}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

function RouteButton({
  title,
  icon,
  onPress,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.routeButton, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={styles.routeIcon}>
        <Ionicons name={icon} size={18} color={COLORS.primaryDark} />
      </View>
      <Text style={styles.routeButtonText}>{title}</Text>
      <Ionicons name="chevron-forward-outline" size={18} color={COLORS.muted} />
    </Pressable>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={18} color={COLORS.primaryDark} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 90 },

  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  centerText: { marginTop: 10, color: COLORS.primary, fontWeight: "800" },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    color: COLORS.primary,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontSize: 12,
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "900",
    marginTop: 2,
  },
  subtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 4,
  },

  heroCard: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 28,
    padding: 18,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  farmInitialBox: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  farmInitial: { color: COLORS.white, fontWeight: "900", fontSize: 26 },
  heroBadge: {
    color: "#BBF7D0",
    fontWeight: "900",
    textTransform: "uppercase",
    fontSize: 11,
  },
  heroTitle: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 22,
    marginTop: 4,
  },
  heroSub: { color: "#EAF7E6", fontWeight: "700", marginTop: 4 },
  heroMeta: {
    color: "#BBF7D0",
    fontWeight: "900",
    marginTop: 6,
    fontSize: 12,
  },

  flowCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  flowTitle: { color: COLORS.text, fontWeight: "900", fontSize: 19 },
  flowStep: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginTop: 10,
  },
  flowNumber: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: COLORS.soft,
    color: COLORS.primaryDark,
    textAlign: "center",
    textAlignVertical: "center",
    fontWeight: "900",
    overflow: "hidden",
  },
  flowText: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "800",
    lineHeight: 19,
  },

  readinessCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  readinessHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  readinessTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  readinessPercent: { color: COLORS.primaryDark, fontWeight: "900" },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: COLORS.soft,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: 999,
  },
  readinessText: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 9,
  },

  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 13,
  },
  statValue: {
    color: COLORS.primaryDark,
    fontWeight: "900",
    fontSize: 15,
    marginTop: 7,
  },
  statLabel: {
    color: COLORS.muted,
    fontWeight: "800",
    marginTop: 3,
    fontSize: 11,
  },

  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  sectionIcon: {
    width: 43,
    height: 43,
    borderRadius: 16,
    backgroundColor: COLORS.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: {
    color: COLORS.primary,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontSize: 12,
    marginBottom: 3,
  },
  sectionTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  sectionSub: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 3,
  },

  fieldWrap: { marginBottom: 12 },
  label: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 13,
    marginBottom: 7,
  },
  inputShell: {
    backgroundColor: COLORS.soft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 17,
    minHeight: 54,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  input: {
    flex: 1,
    minHeight: 52,
    color: COLORS.text,
    fontWeight: "800",
  },

  settingRow: {
    backgroundColor: COLORS.soft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 13,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    backgroundColor: COLORS.card,
    alignItems: "center",
    justifyContent: "center",
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
    backgroundColor: COLORS.primary,
    borderRadius: 17,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
    marginBottom: 12,
  },
  secondaryActionText: { color: COLORS.white, fontWeight: "900" },

  emptyBox: {
    backgroundColor: COLORS.soft,
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyEmoji: { fontSize: 36 },
  emptyTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
    marginTop: 7,
  },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 5,
  },

  driverRow: {
    backgroundColor: COLORS.soft,
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  driverInitialBox: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: COLORS.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  driverInitial: { color: COLORS.white, fontWeight: "900", fontSize: 18 },
  driverName: { color: COLORS.text, fontWeight: "900" },
  driverMeta: {
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 12,
    marginTop: 3,
  },
  removeButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.dangerSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  routeButton: {
    backgroundColor: COLORS.soft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 17,
    padding: 13,
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  routeIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    alignItems: "center",
    justifyContent: "center",
  },
  routeButtonText: { flex: 1, color: COLORS.text, fontWeight: "900" },

  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    flexDirection: "row",
    gap: 8,
  },
  saveButtonText: { color: COLORS.white, fontWeight: "900", fontSize: 15 },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.75 },
});