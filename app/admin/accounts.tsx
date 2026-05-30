// app/admin/accounts.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Modal,
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

import freightTheme from "../styles/freightTheme";

type AccountRole = "farmer" | "customer" | "freight" | "driver";

type AccountRecord = {
  id: string;
  role: AccountRole;
  name: string;
  businessName?: string;
  email: string;
  username: string;
  password: string;
  approved?: boolean;
  accountActive?: boolean;
  storeUnlocked?: boolean;
  membershipStatus?: string;
  subscriptionStatus?: string;
  createdAt?: string;
  updatedAt?: string;
  raw?: any;
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
  return String(value || "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function makeId(role: AccountRole) {
  return `${role}_${Date.now()}`;
}

function readName(item: any, role: AccountRole) {
  if (role === "farmer") {
    return (
      item.ownerName ||
      item.owner_name ||
      item.contactName ||
      item.businessName ||
      item.farmName ||
      "Farmer"
    );
  }

  if (role === "freight") {
    return item.contactName || item.companyName || item.businessName || "Freight Carrier";
  }

  return item.fullName || item.name || item.customerName || item.driverName || "User";
}

function normalizeAccount(item: any, role: AccountRole): AccountRecord | null {
  if (!item) return null;

  const id = clean(
    item.id || item.farmerId || item.driverId || item.customerId || item.freightId
  );

  if (!id && !item.email && !item.username) return null;

  return {
    id: id || makeId(role),
    role,
    name: readName(item, role),
    businessName: item.businessName || item.farmName || item.companyName || "",
    email: normalize(item.email || item.customerEmail || item.farmerEmail),
    username: normalize(item.username),
    password: clean(item.password),
    approved:
      item.approved === true ||
      normalize(item.status) === "approved" ||
      normalize(item.complianceStatus) === "approved" ||
      normalize(item.adminReviewStatus) === "approved",
    accountActive:
      item.accountActive === true ||
      item.account_active === true ||
      normalize(item.membershipStatus) === "active" ||
      normalize(item.subscriptionStatus) === "active",
    storeUnlocked: item.storeUnlocked === true || item.store_unlocked === true,
    membershipStatus: item.membershipStatus || "",
    subscriptionStatus: item.subscriptionStatus || "",
    createdAt: item.createdAt || item.created_at || "",
    updatedAt: item.updatedAt || item.updated_at || "",
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
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | AccountRole>("all");

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
      loadAccounts();
    }, [])
  );

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
          (account.email && item.email === account.email) ||
          (account.username && item.username === account.username)
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

    setAccounts(merged);
  }

  const counts = useMemo(() => {
    return {
      total: accounts.length,
      farmers: accounts.filter((item) => item.role === "farmer").length,
      customers: accounts.filter((item) => item.role === "customer").length,
      freight: accounts.filter((item) => item.role === "freight").length,
      drivers: accounts.filter((item) => item.role === "driver").length,
      active: accounts.filter((item) => item.accountActive).length,
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
        normalize(account.username).includes(q);

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
          clean(item.id || item.farmerId) === updated.id ||
          normalize(item.email) === updated.email ||
          normalize(item.username) === updated.username
        );
      });

      const updatedRaw = {
        ...(updated.raw || {}),
        id: updated.id,
        farmerId: updated.role === "farmer" ? updated.id : updated.raw?.farmerId,
        role: updated.role,
        name: updated.name,
        fullName: updated.name,
        ownerName: updated.role === "farmer" ? updated.name : updated.raw?.ownerName,
        businessName: updated.businessName,
        farmName: updated.role === "farmer" ? updated.businessName : updated.raw?.farmName,
        companyName: updated.role === "freight" ? updated.businessName : updated.raw?.companyName,
        email: updated.email,
        username: updated.username,
        password: updated.password,
        approved: updated.approved,
        accountActive: updated.accountActive,
        storeUnlocked: updated.storeUnlocked,
        membershipStatus: updated.membershipStatus,
        subscriptionStatus: updated.subscriptionStatus,
        updatedAt: new Date().toISOString(),
      };

      const next = exists
        ? records.map((item: any) => {
            const same =
              clean(item.id || item.farmerId) === updated.id ||
              normalize(item.email) === updated.email ||
              normalize(item.username) === updated.username;

            return same ? { ...item, ...updatedRaw } : item;
          })
        : [updatedRaw, ...records];

      await writeArray(key, next);
    }

    if (updated.role === "farmer") {
      await AsyncStorage.setItem(
        "currentFarmer",
        JSON.stringify({
          ...(updated.raw || {}),
          id: updated.id,
          farmerId: updated.id,
          ownerName: updated.name,
          businessName: updated.businessName,
          farmName: updated.businessName,
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
      storeUnlocked: true,
      membershipStatus: "Active",
      subscriptionStatus: "active",
      updatedAt: new Date().toISOString(),
      raw: {
        ...(account.raw || {}),
        approved: true,
        accountActive: true,
        storeUnlocked: true,
        complianceStatus: "approved",
        adminReviewStatus: "approved",
        reviewDecision: "approved",
        status: "APPROVED",
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
    Alert.alert(
      "Suspend Account",
      `Suspend ${account.name}?`,
      [
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
                membershipStatus: "Suspended",
                subscriptionStatus: "suspended",
                status: "SUSPENDED",
                updatedAt: new Date().toISOString(),
              },
            };

            await updateAccountEverywhere(updated);
            Alert.alert("Suspended", "Account was suspended.");
            await loadAccounts();
          },
        },
      ]
    );
  }

  async function createManualAccount() {
    if (!newName.trim() || !newEmail.trim() || !newUsername.trim() || !newPassword.trim()) {
      Alert.alert("Missing Info", "Name, email, username, and password are required.");
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
        role: newRole,
        name: clean(newName),
        fullName: clean(newName),
        ownerName: newRole === "farmer" ? clean(newName) : undefined,
        businessName: clean(newBusinessName),
        farmName: newRole === "farmer" ? clean(newBusinessName) : undefined,
        companyName: newRole === "freight" ? clean(newBusinessName) : undefined,
        email: normalize(newEmail),
        username: normalize(newUsername),
        password: clean(newPassword),
        approved: true,
        accountActive: true,
        storeUnlocked: newRole === "farmer",
        complianceStatus: newRole === "farmer" ? "approved" : undefined,
        adminReviewStatus: newRole === "farmer" ? "approved" : undefined,
        reviewDecision: newRole === "farmer" ? "approved" : undefined,
        status: newRole === "farmer" ? "APPROVED" : "ACTIVE",
        membershipStatus: "Active",
        subscriptionStatus: "active",
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

  function statusColor(account: AccountRecord) {
    if (!account.accountActive) return "#F59E0B";
    if (account.approved) return "#10B981";
    return "#2563EB";
  }

  function statusText(account: AccountRecord) {
    if (!account.accountActive) return "Pending";
    if (account.approved) return "Active";
    return "Open";
  }

  function FilterChip({
    value,
    label,
  }: {
    value: "all" | AccountRole;
    label: string;
  }) {
    const active = roleFilter === value;

    return (
      <TouchableOpacity
        style={[styles.filterChip, active && styles.filterChipActive]}
        onPress={() => setRoleFilter(value)}
      >
        <Text style={[styles.filterText, active && styles.filterTextActive]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      <ScrollView style={styles.page} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>Farm2Home Admin Portal</Text>
              <Text style={styles.header}>Admin Accounts</Text>
              <Text style={styles.subheader}>
                View usernames and passwords, reset login credentials, approve
                farmers, unlock stores, suspend accounts, and manually create
                accounts.
              </Text>
            </View>

            <View style={styles.heroIcon}>
              <Ionicons name="people-outline" size={34} color="#FFFFFF" />
            </View>
          </View>
        </View>

        <View style={styles.topRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push("/admin/dashboard" as any)}
          >
            <Ionicons name="grid-outline" size={18} color="#FFFFFF" />
            <Text style={styles.backText}>Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setCreateVisible(true)}
          >
            <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.createText}>Create Account</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.metricsGrid}>
          <MetricCard icon="people-outline" value={String(counts.total)} label="Total" accent />
          <MetricCard icon="leaf-outline" value={String(counts.farmers)} label="Farmers" />
          <MetricCard icon="person-outline" value={String(counts.customers)} label="Customers" />
          <MetricCard icon="trail-sign-outline" value={String(counts.freight)} label="Freight" />
          <MetricCard icon="car-outline" value={String(counts.drivers)} label="Drivers" />
          <MetricCard icon="checkmark-done-outline" value={String(counts.active)} label="Active" accent />
        </View>

        <View style={styles.searchCard}>
          <Ionicons name="search-outline" size={20} color="#10B981" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name, business, email, username..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <FilterChip value="all" label="All" />
          <FilterChip value="farmer" label="Farmers" />
          <FilterChip value="customer" label="Customers" />
          <FilterChip value="freight" label="Freight" />
          <FilterChip value="driver" label="Drivers" />
        </ScrollView>

        <Text style={styles.sectionTitle}>Accounts</Text>

        {filteredAccounts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="file-tray-outline" size={38} color="#10B981" />
            <Text style={styles.emptyTitle}>No accounts found.</Text>
            <Text style={styles.emptyText}>
              Try changing the filter or creating a manual account.
            </Text>
          </View>
        ) : (
          filteredAccounts.map((account) => (
            <View
              key={`${account.role}_${account.id}_${account.email}`}
              style={styles.card}
            >
              <View style={styles.cardTop}>
                <View style={styles.roleIcon}>
                  <Ionicons name={roleIcon(account.role)} size={22} color="#10B981" />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.accountName}>{account.name}</Text>
                  <Text style={styles.accountRole}>{roleLabel(account.role)}</Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusColor(account) },
                  ]}
                >
                  <Text style={styles.statusText}>{statusText(account)}</Text>
                </View>
              </View>

              <View style={styles.infoBox}>
                <InfoLine label="Business" value={account.businessName || "N/A"} />
                <InfoLine label="Email" value={account.email || "N/A"} />
                <InfoLine label="Username" value={account.username || "NOT SAVED"} strong />
                <InfoLine label="Password" value={account.password || "NOT SAVED"} strong />
                <InfoLine
                  label="Membership"
                  value={account.membershipStatus || account.subscriptionStatus || "N/A"}
                />
                {account.role === "farmer" && (
                  <InfoLine
                    label="Store"
                    value={account.storeUnlocked ? "Unlocked" : "Locked"}
                  />
                )}
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={() => openEdit(account)}
                >
                  <Ionicons name="key-outline" size={17} color="#FFFFFF" />
                  <Text style={styles.actionText}>Reset Login</Text>
                </TouchableOpacity>

                {account.role === "farmer" && (
                  <TouchableOpacity
                    style={styles.unlockButton}
                    onPress={() => approveAndUnlock(account)}
                  >
                    <Ionicons name="lock-open-outline" size={17} color="#FFFFFF" />
                    <Text style={styles.actionText}>Approve</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.suspendButton}
                  onPress={() => suspendAccount(account)}
                >
                  <Ionicons name="pause-circle-outline" size={17} color="#FFFFFF" />
                  <Text style={styles.actionText}>Suspend</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        <Modal visible={editVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <View style={styles.modalIcon}>
                  <Ionicons name="key-outline" size={28} color="#FFFFFF" />
                </View>

                <Text style={styles.modalTitle}>Reset Login</Text>
                <Text style={styles.modalSubtitle}>
                  Update username and password for this account.
                </Text>

                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  placeholderTextColor="#94A3B8"
                  value={editUsername}
                  onChangeText={setEditUsername}
                  autoCapitalize="none"
                />

                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#94A3B8"
                  value={editPassword}
                  onChangeText={setEditPassword}
                />

                <TouchableOpacity style={styles.saveButton} onPress={saveReset}>
                  <Text style={styles.saveText}>Save Reset</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setEditVisible(false)}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal visible={createVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <View style={styles.modalIcon}>
                  <Ionicons name="person-add-outline" size={28} color="#FFFFFF" />
                </View>

                <Text style={styles.modalTitle}>Create Manual Account</Text>
                <Text style={styles.modalSubtitle}>
                  Create and activate a Farm2Home account manually.
                </Text>

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {(["farmer", "customer", "freight", "driver"] as AccountRole[]).map(
                    (role) => (
                      <TouchableOpacity
                        key={role}
                        style={[
                          styles.filterChip,
                          newRole === role && styles.filterChipActive,
                        ]}
                        onPress={() => setNewRole(role)}
                      >
                        <Text
                          style={[
                            styles.filterText,
                            newRole === role && styles.filterTextActive,
                          ]}
                        >
                          {roleLabel(role)}
                        </Text>
                      </TouchableOpacity>
                    )
                  )}
                </ScrollView>

                <TextInput
                  style={styles.input}
                  placeholder="Name / Owner / Contact"
                  placeholderTextColor="#94A3B8"
                  value={newName}
                  onChangeText={setNewName}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Business / Farm / Company Name"
                  placeholderTextColor="#94A3B8"
                  value={newBusinessName}
                  onChangeText={setNewBusinessName}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#94A3B8"
                  value={newEmail}
                  onChangeText={setNewEmail}
                  autoCapitalize="none"
                />

                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  placeholderTextColor="#94A3B8"
                  value={newUsername}
                  onChangeText={setNewUsername}
                  autoCapitalize="none"
                />

                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#94A3B8"
                  value={newPassword}
                  onChangeText={setNewPassword}
                />

                <TouchableOpacity style={styles.saveButton} onPress={createManualAccount}>
                  <Text style={styles.saveText}>Create Account</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setCreateVisible(false)}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({
  icon,
  value,
  label,
  accent = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <View style={[styles.metricCard, accent && styles.metricCardAccent]}>
      <Ionicons
        name={icon}
        size={22}
        color={accent ? "#BBF7D0" : freightTheme.colors.primary}
      />
      <Text style={[styles.metricValue, accent && styles.metricValueAccent]}>
        {value}
      </Text>
      <Text style={[styles.metricLabel, accent && styles.metricLabelAccent]}>
        {label}
      </Text>
    </View>
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
      <Text style={[styles.infoValue, strong && styles.infoValueStrong]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  page: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  content: {
    paddingBottom: 90,
  },
  hero: {
    backgroundColor: "#020617",
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#064E3B",
    borderWidth: 1,
    borderColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    color: "#10B981",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  header: {
    fontSize: 36,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  subheader: {
    color: "#CBD5E1",
    fontWeight: "700",
    marginTop: 8,
    lineHeight: 23,
  },
  topRow: {
    flexDirection: "row",
    gap: 10,
    padding: 18,
  },
  backButton: {
    flex: 1,
    backgroundColor: "#111827",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  backText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  createButton: {
    flex: 1,
    backgroundColor: freightTheme.colors.primary,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  createText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  metricCard: {
    width: "31%",
    minWidth: 100,
    backgroundColor: freightTheme.colors.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    alignItems: "center",
  },
  metricCardAccent: {
    backgroundColor: "#064E3B",
    borderColor: "#064E3B",
  },
  metricValue: {
    color: freightTheme.colors.primary,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 8,
  },
  metricValueAccent: {
    color: "#FFFFFF",
  },
  metricLabel: {
    color: freightTheme.colors.mutedText,
    fontWeight: "800",
    marginTop: 6,
    textAlign: "center",
    fontSize: 12,
  },
  metricLabelAccent: {
    color: "#BBF7D0",
  },
  searchCard: {
    backgroundColor: freightTheme.colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginHorizontal: 18,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: freightTheme.colors.text,
    fontWeight: "700",
    paddingVertical: 12,
  },
  filterRow: {
    paddingHorizontal: 18,
    gap: 8,
    paddingBottom: 16,
  },
  filterChip: {
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 14,
  },
  filterChipActive: {
    backgroundColor: freightTheme.colors.primary,
  },
  filterText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  sectionTitle: {
    color: freightTheme.colors.text,
    fontSize: 24,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: freightTheme.colors.card,
    marginHorizontal: 18,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    alignItems: "center",
  },
  emptyTitle: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    fontSize: 20,
    marginTop: 10,
  },
  emptyText: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 22,
  },
  card: {
    backgroundColor: freightTheme.colors.card,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    marginHorizontal: 18,
    marginBottom: 14,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
  },
  roleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  accountName: {
    fontSize: 20,
    fontWeight: "900",
    color: freightTheme.colors.text,
  },
  accountRole: {
    color: freightTheme.colors.mutedText,
    fontWeight: "900",
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },
  infoBox: {
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  infoLine: {
    marginBottom: 8,
  },
  infoLabel: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
    fontSize: 11,
    textTransform: "uppercase",
  },
  infoValue: {
    color: freightTheme.colors.text,
    fontWeight: "700",
    marginTop: 3,
  },
  infoValueStrong: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  resetButton: {
    flexGrow: 1,
    backgroundColor: "#2563EB",
    padding: 13,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  unlockButton: {
    flexGrow: 1,
    backgroundColor: "#047857",
    padding: 13,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  suspendButton: {
    flexGrow: 1,
    backgroundColor: "#B45309",
    padding: 13,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.68)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: freightTheme.colors.card,
    borderRadius: 24,
    padding: 20,
    maxHeight: "90%",
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  modalIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: freightTheme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 25,
    fontWeight: "900",
    color: freightTheme.colors.text,
    marginBottom: 8,
    textAlign: "center",
  },
  modalSubtitle: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 16,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    fontWeight: "700",
    color: "#111827",
  },
  saveButton: {
    backgroundColor: freightTheme.colors.primary,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 6,
  },
  saveText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  cancelButton: {
    padding: 15,
    alignItems: "center",
  },
  cancelText: {
    color: "#DC2626",
    fontWeight: "900",
  },
});