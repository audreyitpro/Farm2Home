import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";

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

  const id = clean(item.id || item.farmerId || item.driverId || item.customerId || item.freightId);

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

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Admin Accounts</Text>

      <Text style={styles.subheader}>
        View usernames/passwords, reset login credentials, approve farmers, and
        manually create accounts.
      </Text>

      <View style={styles.topRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push("/admin/dashboard" as any)}
        >
          <Text style={styles.backText}>Back Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setCreateVisible(true)}
        >
          <Text style={styles.createText}>Create Account</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Search name, email, username..."
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {(["all", "farmer", "customer", "freight", "driver"] as const).map(
          (role) => (
            <TouchableOpacity
              key={role}
              style={[
                styles.filterChip,
                roleFilter === role && styles.filterChipActive,
              ]}
              onPress={() => setRoleFilter(role)}
            >
              <Text
                style={[
                  styles.filterText,
                  roleFilter === role && styles.filterTextActive,
                ]}
              >
                {role === "all" ? "All" : roleLabel(role)}
              </Text>
            </TouchableOpacity>
          )
        )}
      </ScrollView>

      {filteredAccounts.map((account) => (
        <View key={`${account.role}_${account.id}_${account.email}`} style={styles.card}>
          <View style={styles.cardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.accountName}>{account.name}</Text>
              <Text style={styles.accountRole}>{roleLabel(account.role)}</Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                account.accountActive ? styles.activeBadge : styles.pendingBadge,
              ]}
            >
              <Text style={styles.statusText}>
                {account.accountActive ? "Active" : "Pending"}
              </Text>
            </View>
          </View>

          <Text style={styles.infoText}>Business: {account.businessName || "N/A"}</Text>
          <Text style={styles.infoText}>Email: {account.email || "N/A"}</Text>
          <Text style={styles.loginText}>Username: {account.username || "NOT SAVED"}</Text>
          <Text style={styles.loginText}>Password: {account.password || "NOT SAVED"}</Text>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.resetButton} onPress={() => openEdit(account)}>
              <Text style={styles.actionText}>Reset Login</Text>
            </TouchableOpacity>

            {account.role === "farmer" && (
              <TouchableOpacity
                style={styles.unlockButton}
                onPress={() => approveAndUnlock(account)}
              >
                <Text style={styles.actionText}>Approve/Unlock</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}

      <Modal visible={editVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reset Login</Text>

            <TextInput
              style={styles.input}
              placeholder="Username"
              value={editUsername}
              onChangeText={setEditUsername}
              autoCapitalize="none"
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
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
          </View>
        </View>
      </Modal>

      <Modal visible={createVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView>
              <Text style={styles.modalTitle}>Create Manual Account</Text>

              <ScrollView horizontal>
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
                value={newName}
                onChangeText={setNewName}
              />

              <TextInput
                style={styles.input}
                placeholder="Business / Farm / Company Name"
                value={newBusinessName}
                onChangeText={setNewBusinessName}
              />

              <TextInput
                style={styles.input}
                placeholder="Email"
                value={newEmail}
                onChangeText={setNewEmail}
                autoCapitalize="none"
              />

              <TextInput
                style={styles.input}
                placeholder="Username"
                value={newUsername}
                onChangeText={setNewUsername}
                autoCapitalize="none"
              />

              <TextInput
                style={styles.input}
                placeholder="Password"
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

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F5F7EF",
  },
  content: {
    padding: 18,
    paddingBottom: 60,
  },
  header: {
    fontSize: 34,
    fontWeight: "900",
    color: "#14532D",
  },
  subheader: {
    color: "#64745E",
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 18,
    lineHeight: 22,
  },
  topRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  backButton: {
    flex: 1,
    backgroundColor: "#111827",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  backText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  createButton: {
    flex: 1,
    backgroundColor: "#047857",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  createText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  searchInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    fontWeight: "700",
  },
  filterChip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#047857",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 14,
  },
  filterChipActive: {
    backgroundColor: "#047857",
  },
  filterText: {
    color: "#047857",
    fontWeight: "900",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#DDE7DB",
    marginBottom: 14,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  accountName: {
    fontSize: 20,
    fontWeight: "900",
    color: "#14532D",
  },
  accountRole: {
    color: "#64745E",
    fontWeight: "900",
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  activeBadge: {
    backgroundColor: "#047857",
  },
  pendingBadge: {
    backgroundColor: "#B45309",
  },
  statusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },
  infoText: {
    color: "#374151",
    fontWeight: "700",
    marginBottom: 5,
  },
  loginText: {
    color: "#111827",
    fontWeight: "900",
    marginBottom: 5,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  resetButton: {
    flex: 1,
    backgroundColor: "#2563EB",
    padding: 13,
    borderRadius: 13,
    alignItems: "center",
  },
  unlockButton: {
    flex: 1,
    backgroundColor: "#047857",
    padding: 13,
    borderRadius: 13,
    alignItems: "center",
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    maxHeight: "90%",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#14532D",
    marginBottom: 16,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    fontWeight: "700",
  },
  saveButton: {
    backgroundColor: "#047857",
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
    color: "#B91C1C",
    fontWeight: "900",
  },
});