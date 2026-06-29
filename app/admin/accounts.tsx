// app/admin/accounts.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
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

type AccountRole = "farmer" | "customer" | "freight" | "driver";
type RoleFilter = "all" | AccountRole;

type AccountRecord = {
  id: string;
  role: AccountRole;
  name: string;
  businessName: string;
  email: string;
  username: string;
  password: string;
  approved: boolean;
  accountActive: boolean;
  storeUnlocked: boolean;
  membershipStatus: string;
  subscriptionStatus: string;
  createdAt: string;
  updatedAt: string;
  raw?: any;
};

const ui = {
  bg: "#F4F7FB",
  dark: "#07111F",
  card: "#FFFFFF",
  border: "#E2E8F0",
  text: "#0F172A",
  muted: "#64748B",
  primary: "#2563EB",
  primarySoft: "#EFF6FF",
  green: "#16A34A",
  greenSoft: "#ECFDF5",
  orange: "#EA580C",
  orangeSoft: "#FFF7ED",
  red: "#DC2626",
  redSoft: "#FEF2F2",
  purple: "#7C3AED",
  purpleSoft: "#F5F3FF",
  white: "#FFFFFF",
};

const ACCOUNT_KEYS = [
  { key: "farm2homeFarmers", role: "farmer" as AccountRole },
  { key: "farmers", role: "farmer" as AccountRole },
  { key: "approvedFarmers", role: "farmer" as AccountRole },
  { key: "farm2homeCustomers", role: "customer" as AccountRole },
  { key: "customers", role: "customer" as AccountRole },
  { key: "farm2homeFreightCarriers", role: "freight" as AccountRole },
  { key: "farm2homeFreightUsers", role: "freight" as AccountRole },
  { key: "freight_carriers", role: "freight" as AccountRole },
  { key: "farm2homeDrivers", role: "driver" as AccountRole },
  { key: "drivers", role: "driver" as AccountRole },
  { key: "adminVerificationQueue", role: "farmer" as AccountRole },
  { key: "farm2homeVerificationQueue", role: "farmer" as AccountRole },
];

const SINGLE_ACCOUNT_KEYS = [
  { key: "currentFarmer", role: "farmer" as AccountRole },
  { key: "pendingFarmerApplication", role: "farmer" as AccountRole },
  { key: "currentCustomer", role: "customer" as AccountRole },
  { key: "currentFreight", role: "freight" as AccountRole },
  { key: "currentFreightCarrier", role: "freight" as AccountRole },
  { key: "currentDriver", role: "driver" as AccountRole },
];

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function makeId(role: AccountRole) {
  return `${role}_${Date.now()}`;
}

function roleLabel(role: AccountRole) {
  if (role === "farmer") return "Farmer";
  if (role === "customer") return "Customer";
  if (role === "freight") return "Freight";
  return "Driver";
}

function roleIcon(role: AccountRole): keyof typeof Ionicons.glyphMap {
  if (role === "farmer") return "leaf-outline";
  if (role === "customer") return "person-outline";
  if (role === "freight") return "trail-sign-outline";
  return "car-outline";
}

function roleColor(role: AccountRole) {
  if (role === "farmer") return ui.green;
  if (role === "customer") return ui.purple;
  if (role === "freight") return ui.primary;
  return ui.orange;
}

function readName(item: any, role: AccountRole) {
  if (role === "farmer") {
    return (
      clean(item.ownerName || item.owner_name) ||
      clean(item.contactName || item.contact_name) ||
      clean(item.businessName || item.business_name) ||
      clean(item.farmName || item.farm_name) ||
      "Farmer"
    );
  }

  if (role === "freight") {
    return (
      clean(item.contactName || item.contact_name) ||
      clean(item.companyName || item.company_name) ||
      clean(item.businessName || item.business_name) ||
      "Freight Carrier"
    );
  }

  if (role === "driver") {
    return clean(item.fullName || item.full_name || item.name || item.driverName) || "Driver";
  }

  return clean(item.fullName || item.full_name || item.name || item.customerName) || "Customer";
}

function normalizeAccount(item: any, role: AccountRole): AccountRecord | null {
  if (!item) return null;

  const id = clean(
    item.id ||
      item.farmerId ||
      item.farmer_id ||
      item.driverId ||
      item.driver_id ||
      item.customerId ||
      item.customer_id ||
      item.freightId ||
      item.freight_id
  );

  const email = normalize(
    item.email ||
      item.customerEmail ||
      item.customer_email ||
      item.farmerEmail ||
      item.farmer_email ||
      item.driverEmail ||
      item.driver_email
  );

  const username = normalize(item.username);

  if (!id && !email && !username) return null;

  const approved =
    item.approved === true ||
    normalize(item.status) === "approved" ||
    normalize(item.complianceStatus || item.compliance_status) === "approved" ||
    normalize(item.adminReviewStatus || item.admin_review_status) === "approved";

  const accountActive =
    item.accountActive === true ||
    item.account_active === true ||
    item.is_active === true ||
    normalize(item.membershipStatus || item.membership_status) === "active" ||
    normalize(item.subscriptionStatus || item.subscription_status) === "active";

  return {
    id: id || makeId(role),
    role,
    name: readName(item, role),
    businessName: clean(
      item.businessName ||
        item.business_name ||
        item.farmName ||
        item.farm_name ||
        item.companyName ||
        item.company_name
    ),
    email,
    username,
    password: clean(item.password),
    approved,
    accountActive,
    storeUnlocked: item.storeUnlocked === true || item.store_unlocked === true,
    membershipStatus: clean(item.membershipStatus || item.membership_status),
    subscriptionStatus: clean(item.subscriptionStatus || item.subscription_status),
    createdAt: clean(item.createdAt || item.created_at),
    updatedAt: clean(item.updatedAt || item.updated_at),
    raw: item,
  };
}

async function safeRead(key: string) {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function readArray(key: string) {
  const parsed = await safeRead(key);
  if (!parsed) return [];
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function writeArray(key: string, records: any[]) {
  await AsyncStorage.setItem(key, JSON.stringify(records));
}

export default function AdminAccountsScreen() {
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const [editVisible, setEditVisible] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);

  const [selectedAccount, setSelectedAccount] = useState<AccountRecord | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");

  const [newRole, setNewRole] = useState<AccountRole>("farmer");
  const [newName, setNewName] = useState("");
  const [newBusinessName, setNewBusinessName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useFocusEffect(
    useCallback(() => {
      initialize();
    }, [])
  );

  async function initialize() {
    const rawAdmin = await AsyncStorage.getItem("currentAdmin");

    if (!rawAdmin) {
      router.replace("/admin/login" as any);
      return;
    }

    try {
      const admin = JSON.parse(rawAdmin);

      if (admin.role !== "admin" || admin.isActive === false) {
        router.replace("/admin/login" as any);
        return;
      }

      await loadAccounts();
    } catch {
      router.replace("/admin/login" as any);
    }
  }

  async function loadAccounts() {
    const found: AccountRecord[] = [];

    for (const item of ACCOUNT_KEYS) {
      const records = await readArray(item.key);

      records.forEach((record) => {
        const normalized = normalizeAccount(record, item.role);
        if (normalized) found.push(normalized);
      });
    }

    for (const item of SINGLE_ACCOUNT_KEYS) {
      const record = await safeRead(item.key);
      const normalized = normalizeAccount(record, item.role);
      if (normalized) found.push(normalized);
    }

    const merged: AccountRecord[] = [];

    for (const account of found) {
      const index = merged.findIndex((item) => {
        return (
          item.id === account.id ||
          (!!account.email && item.email === account.email) ||
          (!!account.username && item.username === account.username)
        );
      });

      if (index === -1) {
        merged.push(account);
      } else {
        const existing = merged[index];

        merged[index] = {
          ...existing,
          ...account,
          username: account.username || existing.username,
          password: account.password || existing.password,
          approved: existing.approved || account.approved,
          accountActive: existing.accountActive || account.accountActive,
          storeUnlocked: existing.storeUnlocked || account.storeUnlocked,
          raw: {
            ...existing.raw,
            ...account.raw,
          },
        };
      }
    }

    merged.sort((a, b) => {
      if (a.accountActive !== b.accountActive) return a.accountActive ? -1 : 1;
      return a.role.localeCompare(b.role);
    });

    setAccounts(merged);
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadAccounts();
    setRefreshing(false);
  }

  const counts = useMemo(() => {
    const missingLogin = accounts.filter((item) => !item.username || !item.password).length;
    const pending = accounts.filter((item) => !item.accountActive || !item.approved).length;

    return {
      total: accounts.length,
      farmers: accounts.filter((item) => item.role === "farmer").length,
      customers: accounts.filter((item) => item.role === "customer").length,
      freight: accounts.filter((item) => item.role === "freight").length,
      drivers: accounts.filter((item) => item.role === "driver").length,
      active: accounts.filter((item) => item.accountActive).length,
      pending,
      missingLogin,
    };
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    const q = normalize(search);

    return accounts.filter((account) => {
      const roleMatch = roleFilter === "all" || account.role === roleFilter;

      const searchMatch =
        !q ||
        normalize(account.name).includes(q) ||
        normalize(account.businessName).includes(q) ||
        normalize(account.email).includes(q) ||
        normalize(account.username).includes(q) ||
        normalize(account.role).includes(q);

      return roleMatch && searchMatch;
    });
  }, [accounts, search, roleFilter]);

  function openEdit(account: AccountRecord) {
    setSelectedAccount(account);
    setEditUsername(account.username || "");
    setEditPassword(account.password || "");
    setEditVisible(true);
  }

  async function updateAccountEverywhere(updated: AccountRecord) {
    const roleKeys = ACCOUNT_KEYS.filter((item) => item.role === updated.role).map(
      (item) => item.key
    );

    if (updated.role === "farmer") {
      roleKeys.push("adminVerificationQueue", "farm2homeVerificationQueue");
    }

    for (const key of Array.from(new Set(roleKeys))) {
      const records = await readArray(key);

      const exists = records.some((item: any) => {
        return (
          clean(item.id || item.farmerId || item.farmer_id) === updated.id ||
          normalize(item.email) === updated.email ||
          normalize(item.username) === updated.username
        );
      });

      const updatedRaw = {
        ...(updated.raw || {}),
        id: updated.id,
        farmerId: updated.role === "farmer" ? updated.id : updated.raw?.farmerId,
        farmer_id: updated.role === "farmer" ? updated.id : updated.raw?.farmer_id,
        role: updated.role,
        name: updated.name,
        fullName: updated.name,
        full_name: updated.name,
        ownerName: updated.role === "farmer" ? updated.name : updated.raw?.ownerName,
        owner_name: updated.role === "farmer" ? updated.name : updated.raw?.owner_name,
        businessName: updated.businessName,
        business_name: updated.businessName,
        farmName: updated.role === "farmer" ? updated.businessName : updated.raw?.farmName,
        farm_name: updated.role === "farmer" ? updated.businessName : updated.raw?.farm_name,
        companyName: updated.role === "freight" ? updated.businessName : updated.raw?.companyName,
        company_name:
          updated.role === "freight" ? updated.businessName : updated.raw?.company_name,
        email: updated.email,
        username: updated.username,
        password: updated.password,
        approved: updated.approved,
        accountActive: updated.accountActive,
        account_active: updated.accountActive,
        storeUnlocked: updated.storeUnlocked,
        store_unlocked: updated.storeUnlocked,
        membershipStatus: updated.membershipStatus,
        membership_status: updated.membershipStatus,
        subscriptionStatus: updated.subscriptionStatus,
        subscription_status: updated.subscriptionStatus,
        updatedAt: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const next = exists
        ? records.map((item: any) => {
            const same =
              clean(item.id || item.farmerId || item.farmer_id) === updated.id ||
              normalize(item.email) === updated.email ||
              normalize(item.username) === updated.username;

            return same ? { ...item, ...updatedRaw } : item;
          })
        : [updatedRaw, ...records];

      await writeArray(key, next);
    }

    const singleKey =
      updated.role === "farmer"
        ? "currentFarmer"
        : updated.role === "customer"
        ? "currentCustomer"
        : updated.role === "freight"
        ? "currentFreight"
        : "currentDriver";

    await AsyncStorage.setItem(
      singleKey,
      JSON.stringify({
        ...(updated.raw || {}),
        id: updated.id,
        role: updated.role,
        name: updated.name,
        fullName: updated.name,
        businessName: updated.businessName,
        email: updated.email,
        username: updated.username,
        password: updated.password,
        approved: updated.approved,
        accountActive: updated.accountActive,
        storeUnlocked: updated.storeUnlocked,
        membershipStatus: updated.membershipStatus,
        subscriptionStatus: updated.subscriptionStatus,
        updatedAt: new Date().toISOString(),
      })
    );
  }

  async function saveReset() {
    if (!selectedAccount) return;

    if (!editUsername.trim() || !editPassword.trim()) {
      Alert.alert("Missing Login", "Username and password are required.");
      return;
    }

    const updated: AccountRecord = {
      ...selectedAccount,
      username: normalize(editUsername),
      password: clean(editPassword),
      updatedAt: new Date().toISOString(),
    };

    await updateAccountEverywhere(updated);

    Alert.alert("Account Updated", "Username and password were reset.");
    setEditVisible(false);
    setSelectedAccount(null);
    await loadAccounts();
  }

  async function approveAndUnlock(account: AccountRecord) {
    const updated: AccountRecord = {
      ...account,
      approved: true,
      accountActive: true,
      storeUnlocked: account.role === "farmer" ? true : account.storeUnlocked,
      membershipStatus: "Active",
      subscriptionStatus: "active",
      updatedAt: new Date().toISOString(),
      raw: {
        ...(account.raw || {}),
        approved: true,
        accountActive: true,
        account_active: true,
        storeUnlocked: account.role === "farmer" ? true : account.storeUnlocked,
        store_unlocked: account.role === "farmer" ? true : account.storeUnlocked,
        complianceStatus: "approved",
        compliance_status: "approved",
        adminReviewStatus: "approved",
        admin_review_status: "approved",
        reviewDecision: "approved",
        status: account.role === "farmer" ? "APPROVED" : "ACTIVE",
        membershipStatus: "Active",
        subscriptionStatus: "active",
        updatedAt: new Date().toISOString(),
      },
    };

    await updateAccountEverywhere(updated);

    Alert.alert("Approved", "Account approved, active, and unlocked.");
    await loadAccounts();
  }

  async function suspendAccount(account: AccountRecord) {
    Alert.alert("Suspend Account", `Suspend ${account.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Suspend",
        style: "destructive",
        onPress: async () => {
          const updated: AccountRecord = {
            ...account,
            accountActive: false,
            membershipStatus: "Suspended",
            subscriptionStatus: "suspended",
            updatedAt: new Date().toISOString(),
            raw: {
              ...(account.raw || {}),
              accountActive: false,
              account_active: false,
              membershipStatus: "Suspended",
              membership_status: "Suspended",
              subscriptionStatus: "suspended",
              subscription_status: "suspended",
              status: "SUSPENDED",
              updatedAt: new Date().toISOString(),
            },
          };

          await updateAccountEverywhere(updated);
          Alert.alert("Suspended", "Account was suspended.");
          await loadAccounts();
        },
      },
    ]);
  }

  async function createManualAccount() {
    if (!newName.trim() || !newEmail.trim() || !newUsername.trim() || !newPassword.trim()) {
      Alert.alert("Missing Info", "Name, email, username, and password are required.");
      return;
    }

    const duplicate = accounts.some(
      (item) =>
        normalize(item.email) === normalize(newEmail) ||
        normalize(item.username) === normalize(newUsername)
    );

    if (duplicate) {
      Alert.alert("Duplicate Account", "That email or username already exists.");
      return;
    }

    const id = makeId(newRole);
    const now = new Date().toISOString();

    const record: AccountRecord = {
      id,
      role: newRole,
      name: clean(newName),
      businessName: clean(newBusinessName),
      email: normalize(newEmail),
      username: normalize(newUsername),
      password: clean(newPassword),
      approved: true,
      accountActive: true,
      storeUnlocked: newRole === "farmer",
      membershipStatus: "Active",
      subscriptionStatus: "active",
      createdAt: now,
      updatedAt: now,
      raw: {
        id,
        farmerId: newRole === "farmer" ? id : undefined,
        farmer_id: newRole === "farmer" ? id : undefined,
        role: newRole,
        name: clean(newName),
        fullName: clean(newName),
        full_name: clean(newName),
        ownerName: newRole === "farmer" ? clean(newName) : undefined,
        owner_name: newRole === "farmer" ? clean(newName) : undefined,
        businessName: clean(newBusinessName),
        business_name: clean(newBusinessName),
        farmName: newRole === "farmer" ? clean(newBusinessName) : undefined,
        farm_name: newRole === "farmer" ? clean(newBusinessName) : undefined,
        companyName: newRole === "freight" ? clean(newBusinessName) : undefined,
        company_name: newRole === "freight" ? clean(newBusinessName) : undefined,
        email: normalize(newEmail),
        username: normalize(newUsername),
        password: clean(newPassword),
        approved: true,
        accountActive: true,
        account_active: true,
        storeUnlocked: newRole === "farmer",
        store_unlocked: newRole === "farmer",
        complianceStatus: newRole === "farmer" ? "approved" : undefined,
        compliance_status: newRole === "farmer" ? "approved" : undefined,
        adminReviewStatus: newRole === "farmer" ? "approved" : undefined,
        admin_review_status: newRole === "farmer" ? "approved" : undefined,
        reviewDecision: newRole === "farmer" ? "approved" : undefined,
        status: newRole === "farmer" ? "APPROVED" : "ACTIVE",
        membershipStatus: "Active",
        membership_status: "Active",
        subscriptionStatus: "active",
        subscription_status: "active",
        createdAt: now,
        updatedAt: now,
      },
    };

    await updateAccountEverywhere(record);

    Alert.alert("Account Created", "Manual account was created and activated.");
    setCreateVisible(false);
    setNewName("");
    setNewBusinessName("");
    setNewEmail("");
    setNewUsername("");
    setNewPassword("");
    await loadAccounts();
  }

  function statusLabel(account: AccountRecord) {
    if (!account.accountActive) return "Suspended";
    if (account.approved) return "Active";
    return "Open";
  }

  function statusColor(account: AccountRecord) {
    if (!account.accountActive) return ui.orange;
    if (account.approved) return ui.green;
    return ui.primary;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={ui.dark} />

      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Farm2Home Admin</Text>
            <Text style={styles.title}>Accounts Center</Text>
            <Text style={styles.subtitle}>
              Manage farmers, customers, drivers, and freight accounts. Reset logins,
              approve users, unlock stores, suspend accounts, and create manual access.
            </Text>
          </View>

          <TouchableOpacity style={styles.createHeroButton} onPress={() => setCreateVisible(true)}>
            <Ionicons name="person-add-outline" size={18} color={ui.white} />
            <Text style={styles.createHeroText}>Create</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.flowCard}>
          <Text style={styles.flowTitle}>Admin Account Flow</Text>
          <FlowStep number="1" text="Search and review all profile types." />
          <FlowStep number="2" text="Reset missing username or password." />
          <FlowStep number="3" text="Approve and unlock farmer stores." />
          <FlowStep number="4" text="Suspend accounts that need admin review." />
        </View>

        <View style={styles.grid}>
          <Metric title="Total" value={counts.total} icon="people-outline" color={ui.primary} />
          <Metric title="Farmers" value={counts.farmers} icon="leaf-outline" color={ui.green} />
          <Metric title="Customers" value={counts.customers} icon="person-outline" color={ui.purple} />
          <Metric title="Freight" value={counts.freight} icon="trail-sign-outline" color={ui.primary} />
          <Metric title="Drivers" value={counts.drivers} icon="car-outline" color={ui.orange} />
          <Metric title="Active" value={counts.active} icon="checkmark-done-outline" color={ui.green} />
          <Metric title="Needs Review" value={counts.pending} icon="warning-outline" color={ui.red} />
          <Metric title="Missing Login" value={counts.missingLogin} icon="key-outline" color={ui.orange} />
        </View>

        <View style={styles.actionRowTop}>
          <AdminNav label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <AdminNav label="Analytics" icon="analytics-outline" route="/admin/analytics-center" />
        </View>

        <View style={styles.searchCard}>
          <Ionicons name="search-outline" size={20} color={ui.primary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name, business, email, username..."
            placeholderTextColor={ui.muted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <FilterChip value="all" label="All" active={roleFilter === "all"} onPress={() => setRoleFilter("all")} />
          <FilterChip value="farmer" label="Farmers" active={roleFilter === "farmer"} onPress={() => setRoleFilter("farmer")} />
          <FilterChip value="customer" label="Customers" active={roleFilter === "customer"} onPress={() => setRoleFilter("customer")} />
          <FilterChip value="freight" label="Freight" active={roleFilter === "freight"} onPress={() => setRoleFilter("freight")} />
          <FilterChip value="driver" label="Drivers" active={roleFilter === "driver"} onPress={() => setRoleFilter("driver")} />
        </ScrollView>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Accounts</Text>
          <Text style={styles.sectionSub}>{filteredAccounts.length} account(s) shown</Text>
        </View>

        {filteredAccounts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🗂️</Text>
            <Text style={styles.emptyTitle}>No accounts found</Text>
            <Text style={styles.emptyText}>
              Try changing the search/filter or create a manual account.
            </Text>
          </View>
        ) : (
          filteredAccounts.map((account) => {
            const color = roleColor(account.role);

            return (
              <View key={`${account.role}_${account.id}_${account.email}`} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={[styles.roleIcon, { backgroundColor: `${color}18` }]}>
                    <Ionicons name={roleIcon(account.role)} size={22} color={color} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.accountName}>{account.name}</Text>
                    <Text style={styles.accountRole}>
                      {roleLabel(account.role)} · {account.email || "No email"}
                    </Text>
                  </View>

                  <View style={[styles.statusBadge, { backgroundColor: statusColor(account) }]}>
                    <Text style={styles.statusText}>{statusLabel(account)}</Text>
                  </View>
                </View>

                <View style={styles.infoBox}>
                  <InfoLine label="Business" value={account.businessName || "N/A"} />
                  <InfoLine label="Username" value={account.username || "NOT SAVED"} strong />
                  <InfoLine label="Password" value={account.password || "NOT SAVED"} strong />
                  <InfoLine
                    label="Membership"
                    value={account.membershipStatus || account.subscriptionStatus || "N/A"}
                  />
                  {account.role === "farmer" ? (
                    <InfoLine label="Store" value={account.storeUnlocked ? "Unlocked" : "Locked"} />
                  ) : null}
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.primaryAction} onPress={() => openEdit(account)}>
                    <Ionicons name="key-outline" size={17} color={ui.white} />
                    <Text style={styles.actionText}>Reset Login</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.successAction} onPress={() => approveAndUnlock(account)}>
                    <Ionicons name="checkmark-circle-outline" size={17} color={ui.white} />
                    <Text style={styles.actionText}>Approve</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.warningAction} onPress={() => suspendAccount(account)}>
                    <Ionicons name="pause-circle-outline" size={17} color={ui.white} />
                    <Text style={styles.actionText}>Suspend</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        <AccountModal
          visible={editVisible}
          title="Reset Login"
          subtitle="Update username and password for this account."
          icon="key-outline"
          onClose={() => setEditVisible(false)}
        >
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor={ui.muted}
            value={editUsername}
            onChangeText={setEditUsername}
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={ui.muted}
            value={editPassword}
            onChangeText={setEditPassword}
          />

          <TouchableOpacity style={styles.saveButton} onPress={saveReset}>
            <Text style={styles.saveText}>Save Reset</Text>
          </TouchableOpacity>
        </AccountModal>

        <AccountModal
          visible={createVisible}
          title="Create Manual Account"
          subtitle="Create and activate a Farm2Home account manually."
          icon="person-add-outline"
          onClose={() => setCreateVisible(false)}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(["farmer", "customer", "freight", "driver"] as AccountRole[]).map((role) => (
              <TouchableOpacity
                key={role}
                style={[styles.filterChip, newRole === role && styles.filterChipActive]}
                onPress={() => setNewRole(role)}
              >
                <Text style={[styles.filterText, newRole === role && styles.filterTextActive]}>
                  {roleLabel(role)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TextInput style={styles.input} placeholder="Name / Owner / Contact" placeholderTextColor={ui.muted} value={newName} onChangeText={setNewName} />
          <TextInput style={styles.input} placeholder="Business / Farm / Company Name" placeholderTextColor={ui.muted} value={newBusinessName} onChangeText={setNewBusinessName} />
          <TextInput style={styles.input} placeholder="Email" placeholderTextColor={ui.muted} value={newEmail} onChangeText={setNewEmail} autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Username" placeholderTextColor={ui.muted} value={newUsername} onChangeText={setNewUsername} autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Password" placeholderTextColor={ui.muted} value={newPassword} onChangeText={setNewPassword} />

          <TouchableOpacity style={styles.saveButton} onPress={createManualAccount}>
            <Text style={styles.saveText}>Create Account</Text>
          </TouchableOpacity>
        </AccountModal>

        <View style={{ height: 90 }} />
      </ScrollView>
    </SafeAreaView>
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

function Metric({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}) {
  return (
    <View style={styles.metric}>
      <View style={[styles.metricIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricTitle}>{title}</Text>
    </View>
  );
}

function AdminNav({
  label,
  icon,
  route,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}) {
  return (
    <TouchableOpacity style={styles.navButton} onPress={() => router.push(route as any)}>
      <Ionicons name={icon} size={18} color={ui.primary} />
      <Text style={styles.navText}>{label}</Text>
      <Ionicons name="chevron-forward-outline" size={17} color={ui.muted} />
    </TouchableOpacity>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  value?: RoleFilter;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress}>
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function InfoLine({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, strong && styles.infoValueStrong]}>{value}</Text>
    </View>
  );
}

function AccountModal({
  visible,
  title,
  subtitle,
  icon,
  children,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.modalIcon}>
              <Ionicons name={icon} size={28} color={ui.white} />
            </View>

            <Text style={styles.modalTitle}>{title}</Text>
            <Text style={styles.modalSubtitle}>{subtitle}</Text>

            {children}

            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ui.dark },
  page: { flex: 1, backgroundColor: ui.bg },
  content: { padding: 16, paddingBottom: 90 },

  hero: {
    backgroundColor: ui.dark,
    borderRadius: 28,
    padding: 22,
    marginBottom: 14,
    flexDirection: "row",
    gap: 12,
  },
  kicker: {
    color: "#93C5FD",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: { color: ui.white, fontSize: 33, fontWeight: "900", marginTop: 6 },
  subtitle: { color: "#CBD5E1", fontWeight: "700", lineHeight: 22, marginTop: 8 },
  createHeroButton: {
    backgroundColor: ui.primary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
  },
  createHeroText: { color: ui.white, fontWeight: "900" },

  flowCard: {
    backgroundColor: ui.card,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 14,
  },
  flowTitle: { color: ui.text, fontWeight: "900", fontSize: 20, marginBottom: 10 },
  flowStep: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  flowNumber: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: ui.primarySoft,
    color: ui.primary,
    textAlign: "center",
    textAlignVertical: "center",
    fontWeight: "900",
    overflow: "hidden",
  },
  flowText: { flex: 1, color: ui.text, fontWeight: "800", lineHeight: 20 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: {
    flexGrow: 1,
    width: "47%",
    backgroundColor: ui.card,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: ui.border,
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  metricValue: { color: ui.text, fontSize: 22, fontWeight: "900" },
  metricTitle: { color: ui.muted, fontWeight: "800", marginTop: 4 },

  actionRowTop: { gap: 10, marginTop: 14 },
  navButton: {
    backgroundColor: ui.card,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  navText: { flex: 1, color: ui.text, fontWeight: "900" },

  searchCard: {
    backgroundColor: ui.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: ui.border,
    paddingHorizontal: 14,
    minHeight: 54,
    marginTop: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: { flex: 1, color: ui.text, fontWeight: "800" },

  filterRow: { gap: 8, paddingBottom: 14 },
  filterChip: {
    backgroundColor: ui.card,
    borderWidth: 1,
    borderColor: ui.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    marginRight: 8,
  },
  filterChipActive: { backgroundColor: ui.primary, borderColor: ui.primary },
  filterText: { color: ui.text, fontWeight: "900" },
  filterTextActive: { color: ui.white },

  section: { marginTop: 6, marginBottom: 12 },
  sectionTitle: { color: ui.text, fontSize: 23, fontWeight: "900" },
  sectionSub: { color: ui.muted, fontWeight: "700", marginTop: 4 },

  emptyCard: {
    backgroundColor: ui.card,
    padding: 24,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: ui.border,
    alignItems: "center",
  },
  emptyEmoji: { fontSize: 38 },
  emptyTitle: { color: ui.text, fontWeight: "900", fontSize: 18, marginTop: 8 },
  emptyText: { color: ui.muted, fontWeight: "700", textAlign: "center", marginTop: 6 },

  card: {
    backgroundColor: ui.card,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 12,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  roleIcon: {
    width: 46,
    height: 46,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  accountName: { fontSize: 18, fontWeight: "900", color: ui.text },
  accountRole: { color: ui.muted, fontWeight: "800", marginTop: 4, lineHeight: 19 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  statusText: { color: ui.white, fontWeight: "900", fontSize: 12 },

  infoBox: {
    backgroundColor: ui.bg,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: ui.border,
  },
  infoLine: { marginBottom: 8 },
  infoLabel: {
    color: ui.primary,
    fontWeight: "900",
    fontSize: 11,
    textTransform: "uppercase",
  },
  infoValue: { color: ui.text, fontWeight: "700", marginTop: 3 },
  infoValueStrong: { color: ui.dark, fontWeight: "900" },

  cardActions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  primaryAction: {
    flexGrow: 1,
    backgroundColor: ui.primary,
    padding: 13,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  successAction: {
    flexGrow: 1,
    backgroundColor: ui.green,
    padding: 13,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  warningAction: {
    flexGrow: 1,
    backgroundColor: ui.orange,
    padding: 13,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  actionText: { color: ui.white, fontWeight: "900" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.68)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: ui.card,
    borderRadius: 24,
    padding: 20,
    maxHeight: "90%",
    borderWidth: 1,
    borderColor: ui.border,
  },
  modalIcon: {
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: ui.primary,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 25,
    fontWeight: "900",
    color: ui.text,
    marginBottom: 8,
    textAlign: "center",
  },
  modalSubtitle: {
    color: ui.muted,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 16,
  },
  input: {
    backgroundColor: ui.bg,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    fontWeight: "800",
    color: ui.text,
  },
  saveButton: {
    backgroundColor: ui.primary,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 6,
  },
  saveText: { color: ui.white, fontWeight: "900" },
  cancelButton: { padding: 15, alignItems: "center" },
  cancelText: { color: ui.red, fontWeight: "900" },
});