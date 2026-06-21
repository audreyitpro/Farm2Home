// app/freight/board.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const TABLE_NAME = "freight_loads";

const ROUTES = {
  dashboard: "/freight/dashboard",
  board: "/freight/board",
  liveLoads: "/freight/live-loads",
  loadDetail: "/freight/load-detail",
  myLoads: "/freight/my-loads",
  rateOptimizer: "/freight/rate-optimizer",
  connectBank: "/freight/connect-bank",
  notifications: "/freight/notifications",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof ROUTES)[keyof typeof ROUTES];

type LoadStatus =
  | "available"
  | "open"
  | "accepted"
  | "booked"
  | "arrived_pickup"
  | "picked_up"
  | "in_transit"
  | "arrived_dropoff"
  | "delivered"
  | "completed"
  | "cancelled";

type FreightCarrier = {
  id: string;
  freightId: string;
  freight_id: string;
  authUserId: string;
  auth_user_id: string;
  profileId: string;
  profile_id: string;
  accountId: string;
  account_id: string;
  role: "freight";
  email: string;
  companyName: string;
  company_name: string;
  businessName: string;
  business_name: string;
  contactName: string;
  contact_name: string;
  username: string;
  stripeCustomerId: string;
  stripe_customer_id: string;
  stripeSubscriptionId: string;
  stripe_subscription_id: string;
  subscriptionId: string;
  subscription_id: string;
  freightAccount: string;
  freight_account: string;
  stripeAccountId: string;
  stripe_account_id: string;
  accountActive: boolean;
  account_active: boolean;
  membershipStatus: string;
  membership_status: string;
  subscriptionStatus: string;
  subscription_status: string;
};

type FreightLoad = {
  id: string;
  title: string;
  farmer_name: string;
  broker_name: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_date: string;
  pickup_time: string;
  dropoff_date?: string | null;
  dropoff_time?: string | null;
  equipment_type: string;
  weight_lbs?: number | null;
  temperature_required?: string | null;
  rate: number;
  distance_miles?: number | null;
  commodity: string;
  notes?: string | null;
  status: LoadStatus;
  carrier_id?: string | null;
  freight_user_id?: string | null;
  accepted_by?: string | null;
  batch_id?: string | null;
  created_at?: string | null;
};

const COLORS = {
  bg: "#F3F4F6",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  redDark: "#991B1B",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  amber: "#D97706",
  purple: "#7C3AED",
  blue: "#2563EB",
  teal: "#0F766E",
  slate: "#64748B",
};

function clean(value: any) {
  return String(value || "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function isCus(value: any) {
  return clean(value).startsWith("cus_");
}

function isSub(value: any) {
  return clean(value).startsWith("sub_");
}

function isAcct(value: any) {
  return clean(value).startsWith("acct_");
}

function pickCus(...values: any[]) {
  const found = values.find((value) => isCus(value));
  return found ? clean(found) : "";
}

function pickSub(...values: any[]) {
  const found = values.find((value) => isSub(value));
  return found ? clean(found) : "";
}

function pickAcct(...values: any[]) {
  const found = values.find((value) => isAcct(value));
  return found ? clean(found) : "";
}

function money(value: number) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function cityKey(location: string) {
  return normalize(location).split(",")[0] || normalize(location);
}

function routeKey(load: FreightLoad) {
  return `${cityKey(load.pickup_location)}-${cityKey(load.dropoff_location)}`;
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

function openLoad(route: FreightRoute, loadId: string) {
  router.push({ pathname: route as any, params: { loadId } });
}

function normalizeStatus(value: any): LoadStatus {
  const status = normalize(value || "available");

  if (["available", "open"].includes(status)) return "available";
  if (["accepted", "assigned", "booked"].includes(status)) return "accepted";
  if (["arrived_pickup", "arrived_at_pickup"].includes(status)) return "arrived_pickup";
  if (["picked_up", "pickup_confirmed"].includes(status)) return "picked_up";
  if (["in_transit", "on_route"].includes(status)) return "in_transit";
  if (["arrived_dropoff", "arrived_at_dropoff"].includes(status)) return "arrived_dropoff";
  if (["delivered", "completed"].includes(status)) return "delivered";
  if (["cancelled", "canceled"].includes(status)) return "cancelled";

  return "available";
}

function mapLoad(row: any): FreightLoad {
  return {
    id: clean(row.id),
    title: row.title || row.load_title || row.commodity || "Farm Freight Load",
    farmer_name: row.farmer_name || row.farm_name || row.farmerName || "Farm2Home Farmer",
    broker_name:
      row.broker_name ||
      row.farmer_name ||
      row.farm_name ||
      row.farmerName ||
      "Farm2Home Broker",
    pickup_location: row.pickup_location || row.pickup_address || "Pickup TBD",
    dropoff_location: row.dropoff_location || row.dropoff_address || "Dropoff TBD",
    pickup_date: row.pickup_date || row.pickupDate || "Scheduled",
    pickup_time: row.pickup_time || row.pickupTime || "TBD",
    dropoff_date: row.dropoff_date || row.dropoffDate || null,
    dropoff_time: row.dropoff_time || row.dropoffTime || null,
    equipment_type: row.equipment_type || row.equipment || "Box Truck / Reefer / Flatbed",
    weight_lbs: row.weight_lbs ? Number(row.weight_lbs) : null,
    temperature_required: row.temperature_required || row.temperature || null,
    rate: Number(row.rate || row.freight_total || row.total_due || row.payout_amount || 0),
    distance_miles: Number(row.distance_miles || row.miles || 0),
    commodity: row.commodity || row.product_name || "Farm Freight",
    notes: row.notes || row.special_instructions || null,
    status: normalizeStatus(row.status),
    carrier_id: row.carrier_id || null,
    freight_user_id: row.freight_user_id || null,
    accepted_by: row.accepted_by || null,
    batch_id: row.batch_id || null,
    created_at: row.created_at || null,
  };
}

function mapCarrier(row: any, stored?: any): FreightCarrier {
  const id = clean(row?.id || row?.freight_id || row?.auth_user_id || stored?.id || stored?.freightId);
  const accountId = clean(row?.account_id || stored?.accountId || stored?.account_id);
  const companyName = clean(
    row?.company_name ||
      row?.business_name ||
      stored?.companyName ||
      stored?.businessName ||
      "Farm2Home Freight Carrier"
  );
  const contactName = clean(
    row?.contact_name || row?.full_name || row?.name || stored?.contactName || stored?.fullName || ""
  );
  const email = normalize(row?.email || stored?.email);
  const username = normalize(row?.username || stored?.username);
  const customerId = pickCus(row?.stripe_customer_id, stored?.stripeCustomerId, stored?.stripe_customer_id);
  const subId = pickSub(
    row?.stripe_subscription_id,
    row?.subscription_id,
    stored?.stripeSubscriptionId,
    stored?.stripe_subscription_id,
    stored?.subscriptionId,
    stored?.subscription_id
  );
  const acctId = pickAcct(
    row?.freight_account,
    row?.stripe_account_id,
    stored?.freightAccount,
    stored?.freight_account,
    stored?.stripeAccountId,
    stored?.stripe_account_id
  );
  const membershipStatus = clean(row?.membership_status || stored?.membershipStatus || stored?.membership_status || (subId ? "active" : "pending"));
  const subscriptionStatus = clean(row?.subscription_status || stored?.subscriptionStatus || stored?.subscription_status || (subId ? "active" : "pending"));
  const accountActive = row?.account_active === undefined ? stored?.account_active !== false : row?.account_active !== false;

  return {
    id,
    freightId: id,
    freight_id: id,
    authUserId: clean(row?.auth_user_id || stored?.authUserId || stored?.auth_user_id || id),
    auth_user_id: clean(row?.auth_user_id || stored?.authUserId || stored?.auth_user_id || id),
    profileId: clean(row?.profile_id || stored?.profileId || stored?.profile_id || id),
    profile_id: clean(row?.profile_id || stored?.profileId || stored?.profile_id || id),
    accountId,
    account_id: accountId,
    role: "freight",
    email,
    companyName,
    company_name: companyName,
    businessName: clean(row?.business_name || stored?.businessName || companyName),
    business_name: clean(row?.business_name || stored?.businessName || companyName),
    contactName,
    contact_name: contactName,
    username,
    stripeCustomerId: customerId,
    stripe_customer_id: customerId,
    stripeSubscriptionId: subId,
    stripe_subscription_id: subId,
    subscriptionId: subId,
    subscription_id: subId,
    freightAccount: acctId,
    freight_account: acctId,
    stripeAccountId: acctId,
    stripe_account_id: acctId,
    accountActive,
    account_active: accountActive,
    membershipStatus,
    membership_status: membershipStatus,
    subscriptionStatus,
    subscription_status: subscriptionStatus,
  };
}

function hasBoardAccess(carrier: FreightCarrier) {
  const membership = normalize(carrier.membership_status || carrier.membershipStatus);
  const subscription = normalize(carrier.subscription_status || carrier.subscriptionStatus);

  if (carrier.account_active === false || carrier.accountActive === false) return false;
  if (["canceled", "cancelled", "unpaid", "inactive"].includes(membership)) return false;
  if (["canceled", "cancelled", "unpaid", "inactive"].includes(subscription)) return false;

  return Boolean(
    carrier.id &&
      isCus(carrier.stripe_customer_id || carrier.stripeCustomerId) &&
      isSub(carrier.stripe_subscription_id || carrier.subscription_id || carrier.stripeSubscriptionId)
  );
}

function hasConnectAccount(carrier: FreightCarrier) {
  return isAcct(carrier.freight_account || carrier.freightAccount || carrier.stripe_account_id || carrier.stripeAccountId);
}

export default function FreightBoardScreen() {
  const [carrier, setCarrier] = useState<FreightCarrier | null>(null);
  const [loads, setLoads] = useState<FreightLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessChecking, setAccessChecking] = useState(true);
  const [accessAllowed, setAccessAllowed] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [maxMiles, setMaxMiles] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState("All");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [updatingId, setUpdatingId] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function run() {
        setAccessChecking(true);
        await loadBoard(active);
      }

      run();

      return () => {
        active = false;
      };
    }, [])
  );

  async function getStoredFreightUser() {
    const raw =
      (await AsyncStorage.getItem("currentFreightCarrier")) ||
      (await AsyncStorage.getItem("currentFreight")) ||
      (await AsyncStorage.getItem("currentFreightUser")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function saveCarrierSession(nextCarrier: FreightCarrier) {
    await AsyncStorage.setItem("currentFreight", JSON.stringify(nextCarrier));
    await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(nextCarrier));
    await AsyncStorage.setItem("currentFreightUser", JSON.stringify(nextCarrier));
    await AsyncStorage.setItem("farm2homeCurrentFreight", JSON.stringify(nextCarrier));
    await AsyncStorage.setItem("currentUser", JSON.stringify(nextCarrier));
    await AsyncStorage.setItem("userRole", "freight");
    await AsyncStorage.setItem("currentUserRole", "freight");
  }

  async function findFreightCarrier() {
    const stored = await getStoredFreightUser();
    const { data: authData } = await supabase.auth.getUser();

    const authId = clean(authData?.user?.id);
    const storedId = clean(stored?.id || stored?.freightId || stored?.freight_id || stored?.auth_user_id);
    const email = normalize(stored?.email || authData?.user?.email);
    const accountId = clean(stored?.accountId || stored?.account_id);

    if (!authId && !storedId && !email && !accountId) return null;

    const filters = [
      authId ? `id.eq.${authId}` : "",
      authId ? `freight_id.eq.${authId}` : "",
      authId ? `auth_user_id.eq.${authId}` : "",
      authId ? `profile_id.eq.${authId}` : "",
      storedId ? `id.eq.${storedId}` : "",
      storedId ? `freight_id.eq.${storedId}` : "",
      storedId ? `auth_user_id.eq.${storedId}` : "",
      email ? `email.eq.${email}` : "",
      accountId ? `account_id.eq.${accountId}` : "",
    ]
      .filter(Boolean)
      .join(",");

    if (!filters) return null;

    const { data, error } = await supabase.from("freight_users").select("*").or(filters).limit(1);

    if (error) {
      console.log("Freight board profile error:", error.message);
      return null;
    }

    const dbCarrier = Array.isArray(data) && data.length > 0 ? data[0] : null;
    if (!dbCarrier) return null;

    const mapped = mapCarrier(dbCarrier, stored);
    await saveCarrierSession(mapped);
    setCarrier(mapped);
    return mapped;
  }

  async function checkFreightAccess() {
    const mappedCarrier = await findFreightCarrier();

    if (!mappedCarrier) {
      setAccessAllowed(false);
      Alert.alert("Freight Profile Missing", "Please complete freight registration first.");
      router.replace(ROUTES.register as any);
      return null;
    }

    if (!hasBoardAccess(mappedCarrier)) {
      setAccessAllowed(false);
      Alert.alert(
        "Finish Freight Setup",
        "Your freight account is missing an active Stripe customer/subscription. Please complete registration."
      );
      router.replace(ROUTES.register as any);
      return null;
    }

    setAccessAllowed(true);
    return mappedCarrier;
  }

  async function loadBoard(isActive = true) {
    try {
      const currentFreight = await checkFreightAccess();

      if (!currentFreight?.id) {
        if (isActive) setLoads([]);
        return;
      }

      const carrierId = currentFreight.id;

      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select("*")
        .or(
          `status.eq.available,status.eq.open,carrier_id.eq.${carrierId},freight_user_id.eq.${carrierId},accepted_by.eq.${carrierId}`
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.log("Freight board error:", error.message);
        if (isActive) setLoads([]);
        return;
      }

      if (isActive) setLoads(Array.isArray(data) ? data.map(mapLoad).filter((x) => x.id) : []);
    } catch (error) {
      console.log("Freight board exception:", error);
      if (isActive) setLoads([]);
    } finally {
      if (isActive) {
        setLoading(false);
        setRefreshing(false);
        setAccessChecking(false);
      }
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadBoard(true);
  }

  const equipmentOptions = useMemo(() => {
    const values = loads.map((x) => x.equipment_type).filter(Boolean).map(String);
    return ["All", ...Array.from(new Set(values))];
  }, [loads]);

  const filteredLoads = useMemo(() => {
    const q = normalize(query);
    const miles = Number(maxMiles || 999999);
    const safeMiles = Number.isFinite(miles) && miles > 0 ? miles : 999999;

    return loads.filter((load) => {
      const loadMiles = Number(load.distance_miles || 0);
      const matchesMiles = loadMiles <= safeMiles || loadMiles === 0;
      const matchesEquipment =
        equipmentFilter === "All" || normalize(load.equipment_type).includes(normalize(equipmentFilter));
      const text = [
        load.title,
        load.pickup_location,
        load.dropoff_location,
        load.farmer_name,
        load.broker_name,
        load.commodity,
        load.equipment_type,
        load.notes,
      ]
        .join(" ")
        .toLowerCase();

      return matchesMiles && matchesEquipment && (!q || text.includes(q));
    });
  }, [loads, query, maxMiles, equipmentFilter]);

  const selectedLoads = useMemo(
    () => filteredLoads.filter((item) => selectedIds.includes(item.id)),
    [filteredLoads, selectedIds]
  );

  const availableLoads = useMemo(
    () => filteredLoads.filter((x) => ["available", "open"].includes(normalize(x.status))),
    [filteredLoads]
  );

  const bookedLoads = useMemo(
    () =>
      filteredLoads.filter((x) =>
        ["accepted", "booked", "arrived_pickup", "picked_up", "in_transit", "arrived_dropoff"].includes(
          normalize(x.status)
        )
      ),
    [filteredLoads]
  );

  const visibleRevenue = useMemo(
    () => filteredLoads.reduce((sum, item) => sum + Number(item.rate || 0), 0),
    [filteredLoads]
  );

  const avgRatePerMile = useMemo(() => {
    const totalMiles = filteredLoads.reduce((sum, item) => sum + Number(item.distance_miles || 0), 0);
    if (!totalMiles) return 0;
    return visibleRevenue / totalMiles;
  }, [filteredLoads, visibleRevenue]);

  const selectedTotalRate = selectedLoads.reduce((sum, item) => sum + Number(item.rate || 0), 0);
  const selectedTotalMiles = selectedLoads.reduce((sum, item) => sum + Number(item.distance_miles || 0), 0);

  function ratePerMile(load: FreightLoad) {
    const miles = Number(load.distance_miles || 0);
    if (!miles) return 0;
    return Number(load.rate || 0) / miles;
  }

  function toggleSelect(load: FreightLoad) {
    if (!["available", "open"].includes(normalize(load.status))) {
      Alert.alert("Unavailable", "Only available loads can be selected for batch booking.");
      return;
    }

    if (selectedIds.includes(load.id)) {
      setSelectedIds((prev) => prev.filter((id) => id !== load.id));
      return;
    }

    if (selectedLoads.length > 0) {
      const first = selectedLoads[0];
      const samePickup = cityKey(first.pickup_location) === cityKey(load.pickup_location);
      const sameDropoff = cityKey(first.dropoff_location) === cityKey(load.dropoff_location);
      const sameRoute = routeKey(first) === routeKey(load);

      if (!samePickup && !sameDropoff && !sameRoute) {
        Alert.alert(
          "Different Route Area",
          "For batch booking, select loads with the same pickup area, same dropoff area, or same route direction."
        );
        return;
      }
    }

    setSelectedIds((prev) => [...prev, load.id]);
  }

  async function createNotification(load: FreightLoad, title: string, message: string, currentFreight?: FreightCarrier) {
    const owner = currentFreight || carrier;
    if (!owner?.id) return;

    const { error } = await supabase.from("freight_notifications").insert({
      freight_user_id: owner.id,
      freight_id: owner.id,
      user_id: owner.id,
      load_id: load.id,
      title,
      message,
      type: "load",
      is_read: false,
      read: false,
      created_at: new Date().toISOString(),
    });

    if (error) console.log("Freight notification insert skipped:", error.message);
  }

  async function acceptLoad(load: FreightLoad) {
    try {
      const currentFreight = await checkFreightAccess();
      if (!currentFreight?.id) return;

      if (!["available", "open"].includes(normalize(load.status))) {
        Alert.alert("Load Unavailable", "This load has already been booked or is no longer available.");
        await loadBoard(true);
        return;
      }

      if (!hasConnectAccount(currentFreight)) {
        Alert.alert(
          "Connect Bank Recommended",
          "Your subscription is active, but Stripe Connect payout setup is missing. You can book loads, but complete Connect Bank before payout."
        );
      }

      setUpdatingId(load.id);

      const now = new Date().toISOString();
      const updates: any = {
        status: "accepted",
        carrier_id: currentFreight.id,
        freight_user_id: currentFreight.id,
        accepted_by: currentFreight.id,
        accepted_at: now,
        updated_at: now,
        carrier_name:
          currentFreight.companyName || currentFreight.businessName || currentFreight.contactName || "Farm2Home Freight Carrier",
        carrier_email: currentFreight.email || null,
        carrier_account_id: currentFreight.account_id || currentFreight.accountId || null,
      };

      const { error } = await supabase
        .from(TABLE_NAME)
        .update(updates)
        .eq("id", load.id)
        .in("status", ["available", "open"]);

      if (error) {
        Alert.alert("Book Load Error", error.message);
        return;
      }

      await createNotification(load, "Load Booked", `${load.title} has been booked by your freight account.`, currentFreight);
      setSelectedIds((prev) => prev.filter((id) => id !== load.id));

      Alert.alert("Load Booked", "This load is now in My Booked Loads.", [
        { text: "View My Loads", onPress: () => goTo(ROUTES.myLoads) },
        { text: "Details", onPress: () => openLoad(ROUTES.loadDetail, load.id) },
        { text: "Stay Here", style: "cancel" },
      ]);

      await loadBoard(true);
    } catch (error: any) {
      console.log("Accept load error:", error);
      Alert.alert("Error", error?.message || "Unable to book this freight load.");
    } finally {
      setUpdatingId("");
    }
  }

  async function acceptSelectedLoads() {
    if (selectedLoads.length === 0) {
      Alert.alert("No Loads Selected", "Select one or more available loads first.");
      return;
    }

    const currentFreight = await checkFreightAccess();

    if (!currentFreight?.id) {
      Alert.alert("Account Missing", "Please log in again.");
      return;
    }

    const availableSelected = selectedLoads.filter((load) => ["available", "open"].includes(normalize(load.status)));

    if (availableSelected.length !== selectedLoads.length) {
      Alert.alert("Unavailable Loads", "One or more selected loads are no longer available. Refresh and select again.");
      await loadBoard(true);
      return;
    }

    const batchId = `farm2home_freight_batch_${Date.now()}`;
    const now = new Date().toISOString();

    try {
      setUpdatingId("batch");

      for (const load of availableSelected) {
        const { error } = await supabase
          .from(TABLE_NAME)
          .update({
            status: "accepted",
            carrier_id: currentFreight.id,
            freight_user_id: currentFreight.id,
            accepted_by: currentFreight.id,
            accepted_at: now,
            updated_at: now,
            batch_id: batchId,
            carrier_name:
              currentFreight.companyName ||
              currentFreight.businessName ||
              currentFreight.contactName ||
              "Farm2Home Freight Carrier",
            carrier_email: currentFreight.email || null,
            carrier_account_id: currentFreight.account_id || currentFreight.accountId || null,
          })
          .eq("id", load.id)
          .in("status", ["available", "open"]);

        if (error) {
          Alert.alert("Batch Error", error.message);
          return;
        }

        await createNotification(load, "Batch Load Booked", `${load.title} was booked as part of ${batchId}.`, currentFreight);
      }

      setSelectedIds([]);

      Alert.alert("Batch Booked", `${availableSelected.length} loads were added to My Booked Loads.`, [
        { text: "View My Loads", onPress: () => goTo(ROUTES.myLoads) },
        { text: "Stay Here", style: "cancel" },
      ]);

      await loadBoard(true);
    } catch (error: any) {
      Alert.alert("Batch Error", error?.message || "Unable to book selected loads.");
    } finally {
      setUpdatingId("");
    }
  }

  function statusColor(status: LoadStatus) {
    const value = normalize(status);
    if (value === "available" || value === "open") return COLORS.blue;
    if (value === "accepted" || value === "booked") return COLORS.red;
    if (value === "arrived_pickup") return COLORS.teal;
    if (value === "picked_up") return COLORS.amber;
    if (value === "in_transit") return COLORS.purple;
    if (value === "arrived_dropoff") return COLORS.teal;
    if (value === "delivered" || value === "completed") return COLORS.green;
    if (value === "cancelled") return COLORS.redDark;
    return COLORS.slate;
  }

  function statusIcon(status: LoadStatus): keyof typeof Ionicons.glyphMap {
    const value = normalize(status);
    if (value === "available" || value === "open") return "cube-outline";
    if (value === "accepted" || value === "booked") return "checkmark-circle-outline";
    if (value === "arrived_pickup") return "location-outline";
    if (value === "picked_up") return "archive-outline";
    if (value === "in_transit") return "navigate-outline";
    if (value === "arrived_dropoff") return "flag-outline";
    if (value === "delivered" || value === "completed") return "checkmark-done-outline";
    if (value === "cancelled") return "close-circle-outline";
    return "ellipse-outline";
  }

  function formatStatus(status: LoadStatus) {
    return String(status || "available")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  if (loading || accessChecking) {
    return (
      <SafeAreaView style={styles.centered}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.loadingText}>Loading load board...</Text>
      </SafeAreaView>
    );
  }

  if (!accessAllowed) {
    return (
      <SafeAreaView style={styles.centered}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <Text style={styles.lockTitle}>Freight Setup Required</Text>
        <Text style={styles.loadingText}>Redirecting to freight registration...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>Farm2Home Freight</Text>
          <Text style={styles.title}>Load Board</Text>
          <Text style={styles.subtitle}>
            Search farm freight, compare rate per mile, review broker/farmer details, and book
            single or batch loads.
          </Text>
        </View>

        <TouchableOpacity style={styles.alertButton} onPress={() => goTo(ROUTES.notifications)}>
          <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.navRow}>
        <TouchableOpacity style={styles.navButton} onPress={() => goTo(ROUTES.dashboard)}>
          <Ionicons name="grid-outline" size={18} color="#FFFFFF" />
          <Text style={styles.navText}>Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButtonOutline} onPress={() => goTo(ROUTES.myLoads)}>
          <Ionicons name="briefcase-outline" size={18} color={COLORS.red} />
          <Text style={styles.navTextOutline}>My Loads</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryRow}>
        <SummaryCard label="Available" value={availableLoads.length} icon="cube-outline" />
        <SummaryCard label="Booked" value={bookedLoads.length} icon="briefcase-outline" />
        <SummaryCard label="Visible Value" value={money(visibleRevenue)} icon="cash-outline" />
      </View>

      <View style={styles.rateBanner}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rateBannerLabel}>Average Visible Rate</Text>
          <Text style={styles.rateBannerValue}>{money(avgRatePerMile)} / mile</Text>
        </View>

        <TouchableOpacity style={styles.optimizeButton} onPress={() => goTo(ROUTES.rateOptimizer)}>
          <Ionicons name="trending-up-outline" size={18} color="#FFFFFF" />
          <Text style={styles.optimizeText}>Rate Optimizer</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.quickGrid}>
        <QuickLink icon="pulse-outline" label="Live Loads" route={ROUTES.liveLoads} />
        <QuickLink icon="business-outline" label="Payouts" route={ROUTES.connectBank} />
        <QuickLink icon="notifications-outline" label="Alerts" route={ROUTES.notifications} />
        <QuickLink icon="trending-up-outline" label="Rates" route={ROUTES.rateOptimizer} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color={COLORS.red} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search commodity, city, farmer, broker, equipment..."
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.filterRow}>
          <View style={[styles.searchBox, { flex: 1 }]}>
            <Ionicons name="speedometer-outline" size={20} color={COLORS.red} />
            <TextInput
              value={maxMiles}
              onChangeText={setMaxMiles}
              placeholder="Max miles"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              style={styles.searchInput}
            />
          </View>

          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => {
              setQuery("");
              setMaxMiles("");
              setEquipmentFilter("All");
            }}
          >
            <Ionicons name="close-circle-outline" size={18} color={COLORS.red} />
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        horizontal
        data={equipmentOptions}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        renderItem={({ item }) => {
          const active = item === equipmentFilter;
          return (
            <TouchableOpacity style={active ? styles.chipActive : styles.chip} onPress={() => setEquipmentFilter(item)}>
              <Text style={active ? styles.chipActiveText : styles.chipText}>{item}</Text>
            </TouchableOpacity>
          );
        }}
      />

      {selectedLoads.length > 0 ? (
        <View style={styles.batchBar}>
          <View style={styles.batchHeader}>
            <Ionicons name="layers-outline" size={21} color="#FFFFFF" />
            <Text style={styles.batchTitle}>{selectedLoads.length} Selected Loads</Text>
          </View>

          <Text style={styles.batchText}>
            Total Rate: {money(selectedTotalRate)} · Total Miles: {selectedTotalMiles.toFixed(0)}
          </Text>

          <View style={styles.batchButtons}>
            <TouchableOpacity style={styles.batchAcceptButton} onPress={acceptSelectedLoads} disabled={Boolean(updatingId)}>
              {updatingId === "batch" ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.batchButtonText}>Book Selected</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.batchClearButton} onPress={() => setSelectedIds([])} disabled={Boolean(updatingId)}>
              <Text style={styles.batchButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <FlatList
        data={filteredLoads}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const selected = selectedIds.includes(item.id);
          const available = ["available", "open"].includes(normalize(item.status));
          const busy = updatingId === item.id;

          return (
            <View style={[styles.card, selected && styles.selectedCard]}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.loadTitle}>{item.title}</Text>
                  <Text style={styles.farmName}>{item.farmer_name}</Text>
                </View>

                <View style={styles.rateBox}>
                  <Text style={styles.rate}>{money(item.rate)}</Text>
                  <Text style={styles.rateLabel}>Carrier Rate</Text>
                </View>
              </View>

              <View style={[styles.statusPill, { backgroundColor: statusColor(item.status) }]}>
                <Ionicons name={statusIcon(item.status)} size={14} color="#FFFFFF" />
                <Text style={styles.statusPillText}>{formatStatus(item.status)}</Text>
              </View>

              <View style={styles.routeContainer}>
                <RouteStop
                  icon="radio-button-on"
                  label="Pickup"
                  location={item.pickup_location}
                  date={`${item.pickup_date} · ${item.pickup_time}`}
                />

                <View style={styles.routeLine} />

                <RouteStop
                  icon="location"
                  label="Dropoff"
                  location={item.dropoff_location}
                  date={`${item.dropoff_date || "Scheduled"} · ${item.dropoff_time || "TBD"}`}
                />
              </View>

              <View style={styles.infoGrid}>
                <InfoBox icon="leaf-outline" label="Commodity" value={item.commodity} />
                <InfoBox icon="people-outline" label="Broker / Farmer" value={item.broker_name} />
                <InfoBox icon="car-outline" label="Equipment" value={item.equipment_type} />
                <InfoBox
                  icon="scale-outline"
                  label="Weight"
                  value={item.weight_lbs ? `${Number(item.weight_lbs).toLocaleString()} lbs` : "TBD"}
                />
                <InfoBox icon="speedometer-outline" label="Miles" value={`${Number(item.distance_miles || 0).toFixed(0)} mi`} />
                <InfoBox icon="trending-up-outline" label="Rate / Mile" value={`${money(ratePerMile(item))} / mi`} />
              </View>

              {!!item.temperature_required ? (
                <View style={styles.tempBox}>
                  <Ionicons name="thermometer-outline" size={18} color={COLORS.blue} />
                  <Text style={styles.tempText}>Temperature: {item.temperature_required}</Text>
                </View>
              ) : null}

              {!!item.notes ? (
                <View style={styles.notesBox}>
                  <Text style={styles.notesLabel}>Load Notes</Text>
                  <Text style={styles.notesText}>{item.notes}</Text>
                </View>
              ) : null}

              {available ? (
                <TouchableOpacity
                  style={selected ? styles.unselectButton : styles.selectButton}
                  onPress={() => toggleSelect(item)}
                  disabled={Boolean(updatingId)}
                >
                  <Ionicons name={selected ? "remove-circle-outline" : "add-circle-outline"} size={18} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>{selected ? "Remove From Batch" : "Select For Batch"}</Text>
                </TouchableOpacity>
              ) : null}

              {available ? (
                <TouchableOpacity style={styles.actionButton} onPress={() => acceptLoad(item)} disabled={Boolean(updatingId)}>
                  {busy ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                  )}
                  <Text style={styles.actionButtonText}>Book Load</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.actionButton} onPress={() => openLoad(ROUTES.loadDetail, item.id)}>
                  <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>View Load Details</Text>
                </TouchableOpacity>
              )}

              <View style={styles.secondaryGrid}>
                <TouchableOpacity style={styles.secondaryRouteButton} onPress={() => openLoad(ROUTES.loadDetail, item.id)}>
                  <Ionicons name="document-text-outline" size={18} color={COLORS.red} />
                  <Text style={styles.secondaryRouteText}>Details</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryRouteButton} onPress={() => goTo(ROUTES.rateOptimizer)}>
                  <Ionicons name="trending-up-outline" size={18} color={COLORS.red} />
                  <Text style={styles.secondaryRouteText}>Optimize</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Ionicons name="cube-outline" size={40} color={COLORS.red} />
            <Text style={styles.emptyTitle}>No matching freight loads</Text>
            <Text style={styles.emptyText}>
              Adjust your search, mileage, or equipment filter to find more farm freight.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function SummaryCard({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string | number }) {
  return (
    <View style={styles.summaryCard}>
      <Ionicons name={icon} size={22} color={COLORS.red} />
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function QuickLink({ icon, label, route }: { icon: keyof typeof Ionicons.glyphMap; label: string; route: FreightRoute }) {
  return (
    <TouchableOpacity style={styles.quickLink} onPress={() => goTo(route)}>
      <Ionicons name={icon} size={21} color={COLORS.red} />
      <Text style={styles.quickText}>{label}</Text>
    </TouchableOpacity>
  );
}

function RouteStop({ icon, label, location, date }: { icon: keyof typeof Ionicons.glyphMap; label: string; location: string; date: string }) {
  return (
    <View style={styles.routeStop}>
      <Ionicons name={icon} size={18} color={COLORS.red} />
      <View style={{ flex: 1 }}>
        <Text style={styles.routeLabel}>{label}</Text>
        <Text style={styles.routeText}>{location}</Text>
        <Text style={styles.routeSub}>{date}</Text>
      </View>
    </View>
  );
}

function InfoBox({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.infoBox}>
      <Ionicons name={icon} size={17} color={COLORS.red} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoText}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.muted,
    textAlign: "center",
  },
  lockTitle: {
    color: COLORS.red,
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
  },
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    backgroundColor: COLORS.black,
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 26,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  kicker: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: { color: "#FFFFFF", fontSize: 34, fontWeight: "900", marginTop: 6 },
  subtitle: { color: "#CBD5E1", fontSize: 15, marginTop: 8, lineHeight: 22, fontWeight: "700" },
  alertButton: {
    backgroundColor: COLORS.red,
    width: 54,
    height: 54,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  navRow: { flexDirection: "row", gap: 10, padding: 18, paddingBottom: 10 },
  navButton: {
    flex: 1,
    backgroundColor: COLORS.red,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navButtonOutline: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.red,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navText: { color: "#FFFFFF", fontWeight: "900" },
  navTextOutline: { color: COLORS.red, fontWeight: "900" },
  summaryRow: { flexDirection: "row", gap: 10, paddingHorizontal: 18, marginBottom: 14 },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 14,
    alignItems: "center",
  },
  summaryValue: { color: COLORS.black, fontSize: 21, fontWeight: "900", marginTop: 6, textAlign: "center" },
  summaryLabel: { color: COLORS.muted, fontWeight: "800", marginTop: 4, textAlign: "center", fontSize: 12 },
  rateBanner: {
    backgroundColor: COLORS.red,
    marginHorizontal: 18,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  rateBannerLabel: { color: "#FFE4E6", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  rateBannerValue: { color: "#FFFFFF", fontSize: 26, fontWeight: "900", marginTop: 4 },
  optimizeButton: {
    backgroundColor: COLORS.black,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 12,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
  },
  optimizeText: { color: "#FFFFFF", fontWeight: "900" },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 18, marginBottom: 14 },
  quickLink: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    gap: 7,
  },
  quickText: { color: COLORS.text, fontWeight: "900", textAlign: "center" },
  searchContainer: { paddingHorizontal: 18, gap: 10, marginBottom: 10 },
  searchBox: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: { flex: 1, color: COLORS.text, fontWeight: "700", paddingVertical: 13 },
  filterRow: { flexDirection: "row", gap: 10 },
  clearButton: {
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 16,
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  clearText: { color: COLORS.red, fontWeight: "900" },
  chipRow: { paddingHorizontal: 18, gap: 8, paddingBottom: 12 },
  chip: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  chipActive: {
    backgroundColor: COLORS.red,
    borderWidth: 1,
    borderColor: COLORS.red,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  chipText: { color: COLORS.text, fontWeight: "800" },
  chipActiveText: { color: "#FFFFFF", fontWeight: "900" },
  batchBar: { backgroundColor: COLORS.red, marginHorizontal: 18, marginBottom: 14, borderRadius: 18, padding: 16 },
  batchHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  batchTitle: { color: "#FFFFFF", fontWeight: "900", fontSize: 18 },
  batchText: { color: "#FFE4E6", fontWeight: "800", marginTop: 8 },
  batchButtons: { flexDirection: "row", gap: 10, marginTop: 12 },
  batchAcceptButton: { flex: 1, backgroundColor: COLORS.black, padding: 13, borderRadius: 14, alignItems: "center" },
  batchClearButton: { backgroundColor: COLORS.redDark, padding: 13, borderRadius: 14, alignItems: "center" },
  batchButtonText: { color: "#FFFFFF", fontWeight: "900" },
  listContent: { paddingHorizontal: 18, paddingBottom: 90 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectedCard: { borderColor: COLORS.red, borderWidth: 2, backgroundColor: "#FFF1F2" },
  cardTop: { flexDirection: "row", marginBottom: 12, gap: 12 },
  loadTitle: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  farmName: { marginTop: 4, color: COLORS.muted, fontWeight: "700" },
  rateBox: { backgroundColor: COLORS.black, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, alignItems: "center" },
  rate: { color: "#FFFFFF", fontWeight: "900", fontSize: 18 },
  rateLabel: { color: "#D1D5DB", fontSize: 11, fontWeight: "800" },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusPillText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900", textTransform: "capitalize" },
  routeContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  routeStop: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeLine: { width: 2, height: 24, backgroundColor: COLORS.border, marginLeft: 8, marginVertical: 8 },
  routeLabel: { fontSize: 11, color: COLORS.red, fontWeight: "900", textTransform: "uppercase" },
  routeText: { fontSize: 15, color: COLORS.text, marginTop: 3, fontWeight: "900", lineHeight: 20 },
  routeSub: { fontSize: 12, color: COLORS.muted, marginTop: 3, fontWeight: "700" },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  infoBox: {
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
  },
  infoLabel: { fontSize: 11, color: COLORS.muted, fontWeight: "900", textTransform: "uppercase", marginTop: 6 },
  infoText: { fontSize: 13, color: COLORS.text, fontWeight: "800", marginTop: 4, lineHeight: 19 },
  tempBox: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tempText: { color: COLORS.blue, fontWeight: "900" },
  notesBox: { backgroundColor: COLORS.black, borderRadius: 14, padding: 13, marginTop: 12 },
  notesLabel: { color: "#FCA5A5", fontWeight: "900", marginBottom: 4 },
  notesText: { color: "#CBD5E1", fontWeight: "700", lineHeight: 20 },
  selectButton: {
    backgroundColor: COLORS.blue,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
  },
  unselectButton: {
    backgroundColor: COLORS.redDark,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    backgroundColor: COLORS.red,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  actionButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 14 },
  secondaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  secondaryRouteButton: {
    width: "48%",
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: COLORS.red,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  secondaryRouteText: { color: COLORS.red, fontWeight: "900", fontSize: 12 },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 20,
  },
  emptyTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900", marginTop: 10 },
  emptyText: { color: COLORS.muted, fontWeight: "700", textAlign: "center", marginTop: 8, lineHeight: 22 },
});
