// app/freight/proof-of-pickup.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const COLORS = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  surface: "#F8FAFC",
  primary: "#635BFF",
  primaryDark: "#4638D8",
  primarySoft: "#EEF2FF",
  accent: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  text: "#101828",
  muted: "#667085",
  border: "#E5E7EB",
  navy: "#020617",
  white: "#FFFFFF",
};

type FreightUser = {
  id?: string;
  freight_id?: string;
  freightId?: string;
  account_id?: string;
  accountId?: string;
  email?: string;
  company_name?: string;
  companyName?: string;
  business_name?: string;
  businessName?: string;
  full_name?: string;
  fullName?: string;
  name?: string;
  freight_account?: string;
  stripe_account_id?: string;
};

type LoadDetails = {
  id: string;
  load_id?: string;
  title?: string;
  status?: string;
  pickup_name?: string;
  pickup_address?: string;
  pickup_city?: string;
  pickup_state?: string;
  pickup_zip?: string;
  pickup_time?: string;
  delivery_name?: string;
  delivery_address?: string;
  delivery_city?: string;
  delivery_state?: string;
  delivery_zip?: string;
  delivery_time?: string;
  broker_id?: string;
  broker_name?: string;
  broker_phone?: string;
  broker_email?: string;
  farmer_id?: string;
  farmer_name?: string;
  customer_id?: string;
  customer_name?: string;
  rate?: string | number;
  payout?: string | number;
  miles?: string | number;
  weight?: string | number;
  commodity?: string;
  equipment_type?: string;
  notes?: string;
  carrier_id?: string;
  freight_id?: string;
  booked_by?: string;
  booked_at?: string;
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function firstValue(...values: any[]) {
  const found = values.find((value) => clean(value));
  return clean(found);
}

function money(value: any) {
  const raw = clean(value);
  if (!raw) return "Not listed";
  const numeric = Number(raw);
  if (!Number.isNaN(numeric)) return `$${numeric.toFixed(2)}`;
  return raw;
}

function getFreightId(user: FreightUser | null) {
  return clean(user?.id || user?.freight_id || user?.freightId);
}

function getFreightAccountId(user: FreightUser | null) {
  return clean(user?.account_id || user?.accountId);
}

function loadFromParams(params: any): LoadDetails {
  const id = firstValue(params?.id, params?.loadId, params?.load_id, params?.freightLoadId);
  return {
    id,
    load_id: firstValue(params?.load_id, params?.loadId, id),
    title: firstValue(params?.title, params?.commodity, "Freight Load"),
    status: firstValue(params?.status, "available"),
    pickup_name: firstValue(params?.pickup_name, params?.pickupName, params?.pickup),
    pickup_address: firstValue(params?.pickup_address, params?.pickupAddress),
    pickup_city: firstValue(params?.pickup_city, params?.pickupCity),
    pickup_state: firstValue(params?.pickup_state, params?.pickupState),
    pickup_zip: firstValue(params?.pickup_zip, params?.pickupZip),
    pickup_time: firstValue(params?.pickup_time, params?.pickupTime),
    delivery_name: firstValue(params?.delivery_name, params?.deliveryName, params?.dropoff_name),
    delivery_address: firstValue(params?.delivery_address, params?.deliveryAddress, params?.dropoff_address),
    delivery_city: firstValue(params?.delivery_city, params?.deliveryCity, params?.dropoff_city),
    delivery_state: firstValue(params?.delivery_state, params?.deliveryState, params?.dropoff_state),
    delivery_zip: firstValue(params?.delivery_zip, params?.deliveryZip, params?.dropoff_zip),
    delivery_time: firstValue(params?.delivery_time, params?.deliveryTime),
    broker_id: firstValue(params?.broker_id, params?.brokerId, params?.farmer_id, params?.farmerId),
    broker_name: firstValue(params?.broker_name, params?.brokerName, params?.farmer_name, params?.farmerName),
    broker_phone: firstValue(params?.broker_phone, params?.brokerPhone, params?.phone),
    broker_email: normalize(params?.broker_email || params?.brokerEmail || params?.email),
    farmer_id: firstValue(params?.farmer_id, params?.farmerId),
    farmer_name: firstValue(params?.farmer_name, params?.farmerName),
    customer_id: firstValue(params?.customer_id, params?.customerId),
    customer_name: firstValue(params?.customer_name, params?.customerName),
    rate: firstValue(params?.rate, params?.payout, params?.freight_rate),
    payout: firstValue(params?.payout, params?.rate, params?.freight_rate),
    miles: firstValue(params?.miles, params?.distance),
    weight: firstValue(params?.weight),
    commodity: firstValue(params?.commodity, params?.title),
    equipment_type: firstValue(params?.equipment_type, params?.equipmentType),
    notes: firstValue(params?.notes, params?.description),
  };
}

export default function FreightProofOfPickupScreen() {
  const params = useLocalSearchParams();

  const [freightUser, setFreightUser] = useState<FreightUser | null>(null);
  const [load, setLoad] = useState<LoadDetails>(loadFromParams(params));
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [contacting, setContacting] = useState(false);

  const freightId = useMemo(() => getFreightId(freightUser), [freightUser]);
  const freightAccountId = useMemo(() => getFreightAccountId(freightUser), [freightUser]);

  const loadId = useMemo(
    () => firstValue(load?.id, load?.load_id, params?.id, params?.loadId, params?.load_id),
    [load, params]
  );

  const isBooked = useMemo(() => {
    const status = normalize(load?.status);
    return (
      status.includes("book") ||
      status.includes("assign") ||
      status.includes("accepted") ||
      clean(load?.freight_id) === freightId ||
      clean(load?.carrier_id) === freightId
    );
  }, [load, freightId]);

  useEffect(() => {
    initialize();
  }, []);

  async function initialize() {
    try {
      setLoading(true);
      await loadFreightUser();
      await loadLoadDetails();
    } catch (error) {
      console.log("proof-of-pickup init error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadFreightUser() {
    const savedRaw =
      (await AsyncStorage.getItem("currentFreightCarrier")) ||
      (await AsyncStorage.getItem("currentFreight")) ||
      (await AsyncStorage.getItem("currentFreightUser")) ||
      (await AsyncStorage.getItem("farm2homeCurrentFreight")) ||
      (await AsyncStorage.getItem("currentUser"));

    let savedUser: FreightUser | null = null;

    if (savedRaw) {
      try {
        savedUser = JSON.parse(savedRaw);
        setFreightUser(savedUser);
      } catch {
        savedUser = null;
      }
    }

    const { data: authData } = await supabase.auth.getUser();
    const authId = clean(authData?.user?.id || "");
    const authEmail = normalize(authData?.user?.email || savedUser?.email || "");

    if (!authId && !authEmail) return;

    if (authId) {
      const { data, error } = await supabase
        .from("freight_users")
        .select("*")
        .or(`id.eq.${authId},freight_id.eq.${authId}`)
        .limit(1);

      if (!error && Array.isArray(data) && data[0]) {
        setFreightUser(data[0]);
        await saveFreightUserSession(data[0]);
        return;
      }
    }

    if (authEmail) {
      const { data, error } = await supabase
        .from("freight_users")
        .select("*")
        .eq("email", authEmail)
        .limit(1);

      if (!error && Array.isArray(data) && data[0]) {
        setFreightUser(data[0]);
        await saveFreightUserSession(data[0]);
        return;
      }
    }

  }

  async function saveFreightUserSession(user: FreightUser) {
    await AsyncStorage.multiSet([
      ["currentFreightCarrier", JSON.stringify(user)],
      ["currentFreight", JSON.stringify(user)],
      ["currentFreightUser", JSON.stringify(user)],
      ["currentUser", JSON.stringify({ ...user, role: "freight" })],
      ["userRole", "freight"],
      ["currentUserRole", "freight"],
    ]);
  }

  async function loadLoadDetails() {
    const initialLoad = loadFromParams(params);
    const id = firstValue(initialLoad.id, initialLoad.load_id);

    let localLoad = initialLoad;

    if (!id) {
      const savedLoadRaw =
        (await AsyncStorage.getItem("selectedFreightLoad")) ||
        (await AsyncStorage.getItem("currentFreightLoad")) ||
        (await AsyncStorage.getItem("pendingFreightLoad"));

      if (savedLoadRaw) {
        try {
          localLoad = { ...initialLoad, ...JSON.parse(savedLoadRaw) };
          setLoad(localLoad);
        } catch {
          // keep initial load
        }
      }
      return;
    }

    const tables = ["freight_loads", "loads", "load_board", "available_loads"];

    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .or(`id.eq.${id},load_id.eq.${id}`)
          .limit(1);

        if (!error && Array.isArray(data) && data[0]) {
          const loaded = normalizeLoadRow({ ...initialLoad, ...data[0] });
          setLoad(loaded);
          await AsyncStorage.setItem("selectedFreightLoad", JSON.stringify(loaded));
          return;
        }
      } catch (error) {
        console.log(`${table} load lookup skipped:`, error);
      }
    }

    setLoad(normalizeLoadRow(localLoad));
  }

  function normalizeLoadRow(row: any): LoadDetails {
    return {
      ...row,
      id: firstValue(row?.id, row?.load_id, row?.loadId),
      load_id: firstValue(row?.load_id, row?.loadId, row?.id),
      title: firstValue(row?.title, row?.commodity, row?.load_title, "Freight Load"),
      status: firstValue(row?.status, row?.load_status, "available"),
      pickup_name: firstValue(row?.pickup_name, row?.pickupName, row?.pickup_location_name, row?.farm_name),
      pickup_address: firstValue(row?.pickup_address, row?.pickupAddress, row?.origin_address),
      pickup_city: firstValue(row?.pickup_city, row?.pickupCity, row?.origin_city),
      pickup_state: firstValue(row?.pickup_state, row?.pickupState, row?.origin_state),
      pickup_zip: firstValue(row?.pickup_zip, row?.pickupZip, row?.origin_zip),
      pickup_time: firstValue(row?.pickup_time, row?.pickupTime, row?.pickup_date),
      delivery_name: firstValue(row?.delivery_name, row?.deliveryName, row?.dropoff_name, row?.destination_name),
      delivery_address: firstValue(row?.delivery_address, row?.deliveryAddress, row?.dropoff_address, row?.destination_address),
      delivery_city: firstValue(row?.delivery_city, row?.deliveryCity, row?.dropoff_city, row?.destination_city),
      delivery_state: firstValue(row?.delivery_state, row?.deliveryState, row?.dropoff_state, row?.destination_state),
      delivery_zip: firstValue(row?.delivery_zip, row?.deliveryZip, row?.dropoff_zip, row?.destination_zip),
      delivery_time: firstValue(row?.delivery_time, row?.deliveryTime, row?.delivery_date),
      broker_id: firstValue(row?.broker_id, row?.brokerId, row?.farmer_id, row?.farmerId),
      broker_name: firstValue(row?.broker_name, row?.brokerName, row?.farmer_name, row?.farmerName),
      broker_phone: firstValue(row?.broker_phone, row?.brokerPhone, row?.phone),
      broker_email: normalize(row?.broker_email || row?.brokerEmail || row?.email),
      rate: firstValue(row?.rate, row?.payout, row?.freight_rate, row?.delivery_fee),
      payout: firstValue(row?.payout, row?.rate, row?.freight_rate, row?.delivery_fee),
      miles: firstValue(row?.miles, row?.distance),
      weight: firstValue(row?.weight, row?.load_weight),
      commodity: firstValue(row?.commodity, row?.title, row?.load_type),
      equipment_type: firstValue(row?.equipment_type, row?.equipmentType),
      notes: firstValue(row?.notes, row?.description),
      carrier_id: firstValue(row?.carrier_id, row?.driver_id),
      freight_id: firstValue(row?.freight_id),
      booked_by: firstValue(row?.booked_by),
      booked_at: firstValue(row?.booked_at),
    };
  }

  async function safeUpdateLoadTable(table: string, id: string, payloads: any[]) {
    for (const payload of payloads) {
      const cleanPayload = Object.fromEntries(
        Object.entries(payload).filter(([, value]) => value !== undefined)
      );

      try {
        const { data, error } = await supabase
          .from(table)
          .update(cleanPayload)
          .or(`id.eq.${id},load_id.eq.${id}`)
          .select("*")
          .limit(1);

        if (!error) {
          return Array.isArray(data) && data[0] ? data[0] : cleanPayload;
        }

        console.log(`${table} update failed with payload:`, error.message);
      } catch (error) {
        console.log(`${table} update exception:`, error);
      }
    }

    return null;
  }

  async function tryInsertBooking(id: string, user: FreightUser, currentLoad: LoadDetails) {
    const now = new Date().toISOString();

    const payloads: Record<string, unknown>[] = [
      {
        load_id: id,
        freight_id: getFreightId(user),
        carrier_id: getFreightId(user),
        account_id: getFreightAccountId(user),
        freight_email: normalize(user.email),
        carrier_name: firstValue(user.company_name, user.companyName, user.business_name, user.name),
        status: "booked",
        booked_at: now,
        created_at: now,
        updated_at: now,
      },
      {
        load_id: id,
        freight_id: getFreightId(user),
        status: "booked",
        created_at: now,
        updated_at: now,
      },
    ];

    const tables = ["freight_bookings", "booked_loads", "freight_load_bookings"];

    for (const table of tables) {
      for (const payload of payloads) {
        try {
          const { error } = await supabase.from(table).insert(payload);
          if (!error) return true;
          console.log(`${table} booking insert skipped:`, error.message);
        } catch (error) {
          console.log(`${table} booking insert exception:`, error);
        }
      }
    }

    const savedBookingsRaw = await AsyncStorage.getItem("bookedFreightLoads");
    let savedBookings: any[] = [];

    if (savedBookingsRaw) {
      try {
        savedBookings = JSON.parse(savedBookingsRaw);
      } catch {
        savedBookings = [];
      }
    }

    const nextBookings = [
      {
        ...currentLoad,
        ...payloads[0],
        id,
      },
      ...savedBookings.filter((item) => firstValue(item?.id, item?.load_id) !== id),
    ];

    await AsyncStorage.setItem("bookedFreightLoads", JSON.stringify(nextBookings));
    return false;
  }

  async function handleBookLoad() {
    if (booking) return;

    const id = loadId;

    if (!id) {
      Alert.alert("Missing Load", "This load does not have a load ID.");
      return;
    }

    if (!freightUser || !freightId) {
      Alert.alert("Freight Login Required", "Login as a freight carrier before booking a load.");
      router.replace("/freight/login" as any);
      return;
    }

    try {
      setBooking(true);

      const now = new Date().toISOString();

      const payloads = [
        {
          status: "booked",
          load_status: "booked",
          freight_id: freightId,
          carrier_id: freightId,
          booked_by: freightId,
          booked_at: now,
          account_id: freightAccountId || null,
          updated_at: now,
        },
        {
          status: "booked",
          freight_id: freightId,
          carrier_id: freightId,
          booked_at: now,
          updated_at: now,
        },
        {
          status: "booked",
          freight_id: freightId,
          booked_at: now,
          updated_at: now,
        },
        {
          status: "booked",
          updated_at: now,
        },
      ];

      let updatedRow: any = null;
      const loadTables = ["freight_loads", "loads", "load_board", "available_loads"];

      for (const table of loadTables) {
        updatedRow = await safeUpdateLoadTable(table, id, payloads);
        if (updatedRow) break;
      }

      await tryInsertBooking(id, freightUser, load);

      const bookedLoad = normalizeLoadRow({
        ...load,
        ...(updatedRow || {}),
        id,
        load_id: firstValue(load.load_id, id),
        status: "booked",
        freight_id: freightId,
        carrier_id: freightId,
        booked_by: freightId,
        booked_at: now,
      });

      setLoad(bookedLoad);

      await AsyncStorage.multiSet([
        ["selectedFreightLoad", JSON.stringify(bookedLoad)],
        ["currentFreightLoad", JSON.stringify(bookedLoad)],
        ["lastBookedFreightLoad", JSON.stringify(bookedLoad)],
      ]);

      Alert.alert(
        "Load Booked",
        "This load is now booked and saved to your freight workspace.",
        [
          {
            text: "Stay Here",
            style: "cancel",
          },
          {
            text: "My Loads",
            onPress: () => router.push("/freight/my-loads" as any),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert("Book Load Error", error?.message || "Unable to book this load.");
    } finally {
      setBooking(false);
    }
  }

  async function handleContactBroker() {
    if (contacting) return;

    try {
      setContacting(true);

      const id = loadId;
      const brokerId = firstValue(load.broker_id, load.farmer_id, load.customer_id);
      const brokerName = firstValue(load.broker_name, load.farmer_name, load.customer_name, "Broker");
      const brokerEmail = normalize(load.broker_email);
      const brokerPhone = clean(load.broker_phone);

      const chatParams: any = {
        loadId: id,
        load_id: id,
        brokerId,
        broker_id: brokerId,
        brokerName,
        broker_name: brokerName,
        freightId,
        freight_id: freightId,
      };

      if (brokerId || id) {
        try {
          router.push({
            pathname: "/freight/load-chat" as any,
            params: chatParams,
          });
          return;
        } catch (error) {
          console.log("load-chat route failed:", error);
        }

        try {
          router.push({
            pathname: "/freight/communication-center" as any,
            params: chatParams,
          });
          return;
        } catch (error) {
          console.log("communication-center route failed:", error);
        }
      }

      if (brokerPhone) {
        Alert.alert("Contact Broker", `Call ${brokerName}?`, [
          { text: "Cancel", style: "cancel" },
          {
            text: "Call",
            onPress: () => Linking.openURL(`tel:${brokerPhone}`),
          },
        ]);
        return;
      }

      if (brokerEmail) {
        const subject = encodeURIComponent(`Farm2Home Load ${id || ""}`);
        const body = encodeURIComponent(`Hello, I am contacting you about load ${id || ""}.`);
        await Linking.openURL(`mailto:${brokerEmail}?subject=${subject}&body=${body}`);
        return;
      }

      Alert.alert(
        "Broker Contact Missing",
        "No broker chat, phone, or email is saved on this load. Add broker_id, broker_phone, or broker_email to the load record."
      );
    } catch (error: any) {
      Alert.alert("Contact Error", error?.message || "Unable to contact broker.");
    } finally {
      setContacting(false);
    }
  }

  function handleStartProof() {
    if (!isBooked) {
      Alert.alert("Book Load First", "Book this load before starting proof of pickup.");
      return;
    }

    router.push({
      pathname: "/freight/proof-of-pickup" as any,
      params: {
        loadId,
        load_id: loadId,
        freightId,
        freight_id: freightId,
        mode: "pickup",
      },
    });
  }

  function handleBackToBoard() {
    router.push("/freight/board" as any);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
          <Text style={styles.centerText}>Loading load details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackToBoard} activeOpacity={0.9}>
            <Ionicons name="arrow-back-outline" size={18} color={COLORS.primary} />
            <Text style={styles.backText}>Load Board</Text>
          </TouchableOpacity>

          <View style={styles.badge}>
            <View style={[styles.badgeDot, isBooked && styles.badgeDotBooked]} />
            <Text style={styles.badgeText}>{isBooked ? "Booked" : "Available"}</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Freight Load</Text>
          <Text style={styles.title}>{firstValue(load.title, load.commodity, "Proof of Pickup")}</Text>
          <Text style={styles.subtitle}>Load ID: {loadId || "Missing"}</Text>
        </View>

        <View style={styles.metricsRow}>
          <Metric icon="cash-outline" label="Payout" value={money(load.payout || load.rate)} />
          <Metric icon="navigate-outline" label="Miles" value={clean(load.miles) || "Not listed"} />
          <Metric icon="cube-outline" label="Equipment" value={clean(load.equipment_type) || "Any"} />
        </View>

        <View style={styles.grid}>
          <View style={styles.card}>
            <SectionTitle icon="location-outline" title="Pickup" />
            <Detail label="Name" value={load.pickup_name} />
            <Detail label="Address" value={load.pickup_address} />
            <Detail label="City/State" value={[load.pickup_city, load.pickup_state, load.pickup_zip].filter(Boolean).join(", ")} />
            <Detail label="Pickup Time" value={load.pickup_time} />
          </View>

          <View style={styles.card}>
            <SectionTitle icon="flag-outline" title="Delivery" />
            <Detail label="Name" value={load.delivery_name} />
            <Detail label="Address" value={load.delivery_address} />
            <Detail label="City/State" value={[load.delivery_city, load.delivery_state, load.delivery_zip].filter(Boolean).join(", ")} />
            <Detail label="Delivery Time" value={load.delivery_time} />
          </View>
        </View>

        <View style={styles.card}>
          <SectionTitle icon="business-outline" title="Broker / Farmer Contact" />
          <Detail label="Name" value={firstValue(load.broker_name, load.farmer_name, load.customer_name)} />
          <Detail label="Phone" value={load.broker_phone} />
          <Detail label="Email" value={load.broker_email} />
          <Detail label="Commodity" value={load.commodity} />
          <Detail label="Weight" value={load.weight ? `${load.weight}` : ""} />
          <Detail label="Notes" value={load.notes} />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryButton, booking && styles.disabledButton]}
            onPress={handleBookLoad}
            disabled={booking}
            activeOpacity={0.9}
          >
            {booking ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Ionicons name={isBooked ? "checkmark-circle-outline" : "bookmark-outline"} size={20} color={COLORS.white} />
                <Text style={styles.primaryText}>{isBooked ? "Load Already Booked" : "Book This Load"}</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, contacting && styles.disabledButton]}
            onPress={handleContactBroker}
            disabled={contacting}
            activeOpacity={0.9}
          >
            {contacting ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <>
                <Ionicons name="chatbubbles-outline" size={20} color={COLORS.primary} />
                <Text style={styles.secondaryText}>Contact Broker</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={handleStartProof} activeOpacity={0.9}>
            <Ionicons name="camera-outline" size={20} color={COLORS.primary} />
            <Text style={styles.secondaryText}>Start Proof of Pickup</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function Detail({ label, value }: { label: string; value?: any }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{clean(value) || "Not listed"}</Text>
    </View>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricIcon}>
        <Ionicons name={icon} size={20} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 18, paddingBottom: 42 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  centerText: { color: COLORS.muted, fontWeight: "800" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  backButton: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backText: { color: COLORS.primary, fontWeight: "900" },
  badge: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badgeDot: { width: 9, height: 9, borderRadius: 999, backgroundColor: COLORS.warning },
  badgeDotBooked: { backgroundColor: COLORS.accent },
  badgeText: { color: COLORS.text, fontWeight: "900" },
  hero: {
    backgroundColor: COLORS.card,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 22,
    marginBottom: 14,
  },
  eyebrow: {
    color: COLORS.primary,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
  },
  title: { color: COLORS.text, fontSize: 32, fontWeight: "900", marginTop: 6 },
  subtitle: { color: COLORS.muted, fontWeight: "800", marginTop: 6 },
  metricsRow: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: 12,
    marginBottom: 14,
  },
  metric: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  metricIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  metricLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 11, textTransform: "uppercase" },
  metricValue: { color: COLORS.text, fontWeight: "900", marginTop: 3 },
  grid: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: 14,
  },
  card: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { color: COLORS.text, fontWeight: "900", fontSize: 18 },
  detailRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 11,
  },
  detailLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 12, textTransform: "uppercase" },
  detailValue: { color: COLORS.text, fontWeight: "800", marginTop: 4, lineHeight: 20 },
  actions: { gap: 10 },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
  },
  primaryText: { color: COLORS.white, fontWeight: "900", fontSize: 15 },
  secondaryButton: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
  },
  secondaryText: { color: COLORS.primary, fontWeight: "900", fontSize: 15 },
  disabledButton: { opacity: 0.6 },
});