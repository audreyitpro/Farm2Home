// app/admin/users-management.tsx

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

type UserRole = "farmer" | "customer" | "freight" | "driver" | "admin";

type UserRecord = {
  id: string;
  role: UserRole;
  name: string;
  email: string;
  username: string;
  businessName?: string;
  accountActive?: boolean;
  approved?: boolean;
  membershipStatus?: string;
  subscriptionStatus?: string;
  complianceStatus?: string;
  stripeStatus?: string;
  storeUnlocked?: boolean;
  ordersPlaced?: number;
  totalSpend?: number;
  activeLoads?: number;
  completedLoads?: number;
  deliveriesCompleted?: number;
  driverRating?: number;
  gpsStatus?: string;
  raw?: any;
};

const ACCOUNT_KEYS = [
  { key: "farm2homeFarmers", role: "farmer" as UserRole },
  { key: "farmers", role: "farmer" as UserRole },
  { key: "approvedFarmers", role: "farmer" as UserRole },
  { key: "farm2homeCustomers", role: "customer" as UserRole },
  { key: "customers", role: "customer" as UserRole },
  { key: "farm2homeFreightCarriers", role: "freight" as UserRole },
  { key: "farm2homeFreightUsers", role: "freight" as UserRole },
  { key: "freight_carriers", role: "freight" as UserRole },
  { key: "farm2homeDrivers", role: "driver" as UserRole },
  { key: "drivers", role: "driver" as UserRole },
  { key: "adminUsers", role: "admin" as UserRole },
];

const SINGLE_KEYS = [
  { key: "currentFarmer", role: "farmer" as UserRole },
  { key: "currentCustomer", role: "customer" as UserRole },
  { key: "currentFreight", role: "freight" as UserRole },
  { key: "currentFreightCarrier", role: "freight" as UserRole },
  { key: "currentDriver", role: "driver" as UserRole },
  { key: "adminSession", role: "admin" as UserRole },
];

function clean(value: any) {
  return String(value || "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function makeId(role: UserRole) {
  return `${role}_${Date.now()}`;
}

function roleLabel(role: UserRole) {
  if (role === "farmer") return "Farmer";
  if (role === "customer") return "Customer";
  if (role === "freight") return "Freight Carrier";
  if (role === "driver") return "Driver";
  return "Admin";
}

function roleIcon(role: UserRole): keyof typeof Ionicons.glyphMap {
  if (role === "farmer") return "leaf-outline";
  if (role === "customer") return "person-outline";
  if (role === "freight") return "trail-sign-outline";
  if (role === "driver") return "car-outline";
  return "shield-checkmark-outline";
}

function getName(item: any, role: UserRole) {
  if (role === "farmer") {
    return (
      item.ownerName ||
      item.owner_name ||
      item.contactName ||
      item.farmName ||
      item.businessName ||
      "Farmer"
    );
  }

  if (role === "freight") {
    return (
      item.contactName ||
      item.ownerName ||
      item.companyName ||
      item.businessName ||
      "Freight Carrier"
    );
  }

  if (role === "driver") {
    return item.driverName || item.fullName || item.name || "Driver";
  }

  if (role === "admin") {
    return item.name || item.email || "Admin";
  }

  return item.fullName || item.name || item.customerName || "Customer";
}

function normalizeUser(item: any, role: UserRole): UserRecord | null {
  if (!item) return null;

  const id = clean(
    item.id ||
      item.farmerId ||
      item.customerId ||
      item.freightId ||
      item.driverId ||
      item.adminId
  );

  const email = normalize(item.email || item.customerEmail || item.farmerEmail);

  if (!id && !email && !item.username) return null;

  return {
    id: id || makeId(role),
    role,
    name: getName(item, role),
    email,
    username: normalize(item.username),
    businessName:
      item.businessName ||
      item.farmName ||
      item.companyName ||
      item.business_name ||
      "",
    accountActive:
      item.accountActive === true ||
      item.account_active === true ||
      normalize(item.membershipStatus) === "active" ||
      normalize(item.subscriptionStatus) === "active",
    approved:
      item.approved === true ||
      normalize(item.status) === "approved" ||
      normalize(item.complianceStatus) === "approved",
    membershipStatus: item.membershipStatus || item.membership_status || "",
    subscriptionStatus: item.subscriptionStatus || item.subscription_status || "",
    complianceStatus: item.complianceStatus || item.compliance_status || "",
    stripeStatus:
      item.stripeStatus ||
      item.stripe_status ||
      (item.stripeAccountId || item.farmerStripeAccountId
        ? "Connected"
        : "Not Connected"),
    storeUnlocked: item.storeUnlocked === true || item.store_unlocked === true,
    ordersPlaced: Number(item.ordersPlaced || item.orders_placed || 0),
    totalSpend: Number(item.totalSpend || item.total_spend || 0),
    activeLoads: Number(item.activeLoads || item.active_loads || 0),
    completedLoads: Number(item.completedLoads || item.completed_loads || 0),
    deliveriesCompleted: Number(
      item.deliveriesCompleted || item.deliveries_completed || 0
    ),
    driverRating: Number(item.driverRating || item.rating || 0),
    gpsStatus: item.gpsStatus || item.gps_status || "Unknown",
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

export default function AdminUsersManagementScreen() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");

  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [profileVisible, setProfileVisible] = useState(false);
  const [resetVisible, setResetVisible] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadUsers();
    }, [])
  );

  async function loadUsers() {
    const found: UserRecord[] = [];

    for (const item of ACCOUNT_KEYS) {
      const records = await readArray(item.key);

      records.forEach((record) => {
        const normalized = normalizeUser(record, item.role);
        if (normalized) found.push(normalized);
      });
    }

    for (const item of SINGLE_KEYS) {
      const record = await safeRead(item.key);
      const normalized = normalizeUser(record, item.role);
      if (normalized) found.push(normalized);
    }

    const merged: UserRecord[] = [];

    for (const user of found) {
      const existingIndex = merged.findIndex((item) => {
        return (
          item.id === user.id ||
          (!!user.email && item.email === user.email) ||
          (!!user.username && item.username === user.username)
        );
      });

      if (existingIndex === -1) {
        merged.push(user);
      } else {
        const existing = merged[existingIndex];

        merged[existingIndex] = {
          ...existing,
          ...user,
          accountActive: existing.accountActive || user.accountActive,
          approved: existing.approved || user.approved,
          raw: {
            ...existing.raw,
            ...user.raw,
          },
        };
      }
    }

    setUsers(merged);
  }

  const counts = useMemo(() => {
    return {
      total: users.length,
      farmers: users.filter((item) => item.role === "farmer").length,
      customers: users.filter((item) => item.role === "customer").length,
      freight: users.filter((item) => item.role === "freight").length,
      drivers: users.filter((item) => item.role === "driver").length,
      admins: users.filter((item) => item.role === "admin").length,
      active: users.filter((item) => item.accountActive).length,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = normalize(search);

    return users.filter((user) => {
      const matchesRole = roleFilter === "all" || user.role === roleFilter;

      const searchable = [
        user.name,
        user.email,
        user.username,
        user.businessName,
        user.role,
        user.membershipStatus,
        user.subscriptionStatus,
        user.complianceStatus,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesRole && (!q || searchable.includes(q));
    });
  }, [users, search, roleFilter]);

  async function updateUserEverywhere(updated: UserRecord) {
    const roleKeys = ACCOUNT_KEYS.filter((item) => item.role === updated.role).map(
      (item) => item.key
    );

    for (const key of roleKeys) {
      const records = await readArray(key);

      const updatedRaw = {
        ...(updated.raw || {}),
        id: updated.id,
        role: updated.role,
        name: updated.name,
        fullName: updated.name,
        ownerName: updated.role === "farmer" ? updated.name : updated.raw?.ownerName,
        driverName: updated.role === "driver" ? updated.name : updated.raw?.driverName,
        customerName:
          updated.role === "customer" ? updated.name : updated.raw?.customerName,
        businessName: updated.businessName,
        farmName: updated.role === "farmer" ? updated.businessName : updated.raw?.farmName,
        companyName:
          updated.role === "freight" ? updated.businessName : updated.raw?.companyName,
        email: updated.email,
        username: updated.username,
        accountActive: updated.accountActive,
        approved: updated.approved,
        membershipStatus: updated.membershipStatus,
        subscriptionStatus: updated.subscriptionStatus,
        complianceStatus: updated.complianceStatus,
        storeUnlocked: updated.storeUnlocked,
        updatedAt: new Date().toISOString(),
      };

      const exists = records.some((item: any) => {
        return (
          clean(item.id || item.farmerId || item.driverId || item.customerId) ===
            updated.id ||
          normalize(item.email) === updated.email ||
          normalize(item.username) === updated.username
        );
      });

      const next = exists
        ? records.map((item: any) => {
            const same =
              clean(item.id || item.farmerId || item.driverId || item.customerId) ===
                updated.id ||
              normalize(item.email) === updated.email ||
              normalize(item.username) === updated.username;

            return same ? { ...item, ...updatedRaw } : item;
          })
        : [updatedRaw, ...records];

      await writeArray(key, next);
    }
  }

  function openProfile(user: UserRecord) {
    setSelectedUser(user);
    setProfileVisible(true);
  }

  function openReset(user: UserRecord) {
    setSelectedUser(user);
    setNewUsername(user.username || "");
    setNewPassword("");
    setResetVisible(true);
  }

  async function resetLogin() {
    if (!selectedUser) return;

    if (!newUsername.trim() || !newPassword.trim()) {
      Alert.alert("Missing Login", "Username and new password are required.");
      return;
    }

    const updated: UserRecord = {
      ...selectedUser,
      username: normalize(newUsername),
      raw: {
        ...(selectedUser.raw || {}),
        username: normalize(newUsername),
        password: clean(newPassword),
        updatedAt: new Date().toISOString(),
      },
    };

    await updateUserEverywhere(updated);

    Alert.alert("Login Reset", "Username and password were updated.");
    setResetVisible(false);
    setSelectedUser(null);
    await loadUsers();
  }

  async function suspendUser(user: UserRecord) {
    Alert.alert("Suspend Account", `Suspend ${user.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Suspend",
        style: "destructive",
        onPress: async () => {
          const updated: UserRecord = {
            ...user,
            accountActive: false,
            membershipStatus: "Suspended",
            subscriptionStatus: "suspended",
            raw: {
              ...(user.raw || {}),
              accountActive: false,
              membershipStatus: "Suspended",
              subscriptionStatus: "suspended",
              status: "SUSPENDED",
              updatedAt: new Date().toISOString(),
            },
          };

          await updateUserEverywhere(updated);
          Alert.alert("Suspended", "Account has been suspended.");
          await loadUsers();
        },
      },
    ]);
  }

  async function reactivateUser(user: UserRecord) {
    const updated: UserRecord = {
      ...user,
      accountActive: true,
      approved: true,
      membershipStatus: "Active",
      subscriptionStatus: "active",
      raw: {
        ...(user.raw || {}),
        accountActive: true,
        approved: true,
        membershipStatus: "Active",
        subscriptionStatus: "active",
        status: "ACTIVE",
        updatedAt: new Date().toISOString(),
      },
    };

    await updateUserEverywhere(updated);
    Alert.alert("Reactivated", "Account has been reactivated.");
    await loadUsers();
  }

  async function deleteUser(user: UserRecord) {
    Alert.alert("Delete Account", `Delete ${user.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const roleKeys = ACCOUNT_KEYS.filter((item) => item.role === user.role).map(
            (item) => item.key
          );

          for (const key of roleKeys) {
            const records = await readArray(key);

            const next = records.filter((item: any) => {
              const id = clean(
                item.id || item.farmerId || item.driverId || item.customerId
              );

              return (
                id !== user.id &&
                normalize(item.email) !== user.email &&
                normalize(item.username) !== user.username
              );
            });

            await writeArray(key, next);
          }

          Alert.alert("Deleted", "Account was removed from local admin storage.");
          await loadUsers();
        },
      },
    ]);
  }

  function FilterChip({ value, label }: { value: "all" | UserRole; label: string }) {
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
              <Text style={styles.title}>User Management</Text>
              <Text style={styles.subtitle}>
                Manage farmers, customers, freight carriers, drivers, admins,
                subscriptions, approval status, and account access.
              </Text>
            </View>

            <View style={styles.heroIcon}>
              <Ionicons name="people-outline" size={34} color="#FFFFFF" />
            </View>
          </View>
        </View>

        <View style={styles.navGrid}>
          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <NavButton label="Documents" icon="document-text-outline" route="/admin/documents" />
          <NavButton label="Compliance" icon="shield-checkmark-outline" route="/admin/compliance-review" />
          <NavButton label="Live Ops" icon="radio-outline" route="/admin/live-operations-center" />
          <NavButton label="Analytics" icon="analytics-outline" route="/admin/analytics-center" />
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Total Users" value={String(counts.total)} icon="people-outline" accent />
          <StatCard label="Farmers" value={String(counts.farmers)} icon="leaf-outline" />
          <StatCard label="Customers" value={String(counts.customers)} icon="person-outline" />
          <StatCard label="Freight" value={String(counts.freight)} icon="trail-sign-outline" />
          <StatCard label="Drivers" value={String(counts.drivers)} icon="car-outline" />
          <StatCard label="Admins" value={String(counts.admins)} icon="shield-outline" />
          <StatCard label="Active" value={String(counts.active)} icon="checkmark-done-outline" accent />
        </View>

        <View style={styles.searchCard}>
          <Ionicons name="search-outline" size={20} color="#10B981" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name, email, business, user type..."
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
          <FilterChip value="admin" label="Admins" />
        </ScrollView>

        <Text style={styles.sectionTitle}>Users</Text>

        {filteredUsers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="file-tray-outline" size={36} color="#10B981" />
            <Text style={styles.emptyTitle}>No users found.</Text>
            <Text style={styles.emptyText}>
              Try a different search or user type filter.
            </Text>
          </View>
        ) : (
          filteredUsers.map((user) => (
            <View key={`${user.role}_${user.id}_${user.email}`} style={styles.userCard}>
              <View style={styles.userHeader}>
                <View style={styles.userIcon}>
                  <Ionicons name={roleIcon(user.role)} size={22} color="#10B981" />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{user.name}</Text>
                  <Text style={styles.userMeta}>
                    {roleLabel(user.role)} · {user.email || "No email"}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: user.accountActive ? "#10B981" : "#F59E0B",
                    },
                  ]}
                >
                  <Text style={styles.statusText}>
                    {user.accountActive ? "Active" : "Inactive"}
                  </Text>
                </View>
              </View>

              <View style={styles.infoBox}>
                <InfoRow label="Business" value={user.businessName || "N/A"} />
                <InfoRow label="Username" value={user.username || "Not saved"} />
                <InfoRow
                  label="Membership"
                  value={user.membershipStatus || user.subscriptionStatus || "N/A"}
                />

                {user.role === "farmer" && (
                  <>
                    <InfoRow
                      label="Compliance"
                      value={user.complianceStatus || "Not started"}
                    />
                    <InfoRow label="Stripe" value={user.stripeStatus || "Unknown"} />
                    <InfoRow
                      label="Store"
                      value={user.storeUnlocked ? "Unlocked" : "Locked"}
                    />
                    <InfoRow
                      label="Approval"
                      value={user.approved ? "Approved" : "Pending"}
                    />
                  </>
                )}

                {user.role === "freight" && (
                  <>
                    <InfoRow label="Active Loads" value={String(user.activeLoads || 0)} />
                    <InfoRow
                      label="Completed Loads"
                      value={String(user.completedLoads || 0)}
                    />
                  </>
                )}

                {user.role === "driver" && (
                  <>
                    <InfoRow
                      label="Driver Membership"
                      value={user.membershipStatus || "$4.99 Driver Board"}
                    />
                    <InfoRow label="GPS Status" value={user.gpsStatus || "Unknown"} />
                    <InfoRow
                      label="Deliveries Completed"
                      value={String(user.deliveriesCompleted || 0)}
                    />
                    <InfoRow
                      label="Rating"
                      value={user.driverRating ? `${user.driverRating.toFixed(1)} / 5` : "N/A"}
                    />
                  </>
                )}

                {user.role === "customer" && (
                  <>
                    <InfoRow
                      label="Orders Placed"
                      value={String(user.ordersPlaced || 0)}
                    />
                    <InfoRow
                      label="Total Spend"
                      value={`$${Number(user.totalSpend || 0).toFixed(2)}`}
                    />
                  </>
                )}
              </View>

              <View style={styles.actionRow}>
                <ActionButton
                  label="View"
                  icon="eye-outline"
                  color="#2563EB"
                  onPress={() => openProfile(user)}
                />

                <ActionButton
                  label="Reset"
                  icon="key-outline"
                  color="#7C3AED"
                  onPress={() => openReset(user)}
                />

                {user.accountActive ? (
                  <ActionButton
                    label="Suspend"
                    icon="pause-circle-outline"
                    color="#B45309"
                    onPress={() => suspendUser(user)}
                  />
                ) : (
                  <ActionButton
                    label="Reactivate"
                    icon="checkmark-circle-outline"
                    color="#047857"
                    onPress={() => reactivateUser(user)}
                  />
                )}

                <ActionButton
                  label="Delete"
                  icon="trash-outline"
                  color="#DC2626"
                  onPress={() => deleteUser(user)}
                />
              </View>
            </View>
          ))
        )}

        <Modal visible={profileVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <ScrollView>
                <View style={styles.modalIcon}>
                  <Ionicons
                    name={selectedUser ? roleIcon(selectedUser.role) : "person-outline"}
                    size={28}
                    color="#FFFFFF"
                  />
                </View>

                <Text style={styles.modalTitle}>{selectedUser?.name}</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedUser ? roleLabel(selectedUser.role) : "User Profile"}
                </Text>

                {!!selectedUser && (
                  <View style={styles.modalInfoBox}>
                    <InfoRow label="Email" value={selectedUser.email || "N/A"} />
                    <InfoRow label="Username" value={selectedUser.username || "N/A"} />
                    <InfoRow
                      label="Business"
                      value={selectedUser.businessName || "N/A"}
                    />
                    <InfoRow
                      label="Status"
                      value={selectedUser.accountActive ? "Active" : "Inactive"}
                    />
                    <InfoRow
                      label="Membership"
                      value={
                        selectedUser.membershipStatus ||
                        selectedUser.subscriptionStatus ||
                        "N/A"
                      }
                    />
                  </View>
                )}

                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setProfileVisible(false)}
                >
                  <Text style={styles.closeText}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal visible={resetVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalIcon}>
                <Ionicons name="key-outline" size={28} color="#FFFFFF" />
              </View>

              <Text style={styles.modalTitle}>Reset Login</Text>
              <Text style={styles.modalSubtitle}>
                Update username and password for this user.
              </Text>

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
                placeholder="New Password"
                placeholderTextColor="#94A3B8"
                value={newPassword}
                onChangeText={setNewPassword}
              />

              <TouchableOpacity style={styles.saveButton} onPress={resetLogin}>
                <Text style={styles.saveText}>Save Login Reset</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setResetVisible(false)}
              >
                <Text style={styles.closeText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

function NavButton({
  label,
  icon,
  route,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}) {
  return (
    <TouchableOpacity style={styles.navButtonSmall} onPress={() => router.push(route as any)}>
      <Ionicons name={icon} size={18} color="#10B981" />
      <Text style={styles.navButtonSmallText}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: boolean;
}) {
  return (
    <View style={[styles.statCard, accent && styles.statCardAccent]}>
      <Ionicons
        name={icon}
        size={22}
        color={accent ? "#BBF7D0" : freightTheme.colors.primary}
      />
      <Text style={[styles.statValue, accent && styles.statValueAccent]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, accent && styles.statLabelAccent]}>
        {label}
      </Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function ActionButton({
  label,
  icon,
  color,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionButton, { backgroundColor: color }]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={16} color="#FFFFFF" />
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
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
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
  },
  subtitle: {
    color: "#CBD5E1",
    fontWeight: "700",
    marginTop: 8,
    lineHeight: 23,
  },
  navGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    padding: 18,
  },
  navButtonSmall: {
    width: "48%",
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  navButtonSmallText: {
    color: freightTheme.colors.text,
    fontWeight: "900",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  statCard: {
    width: "48%",
    backgroundColor: freightTheme.colors.card,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  statCardAccent: {
    backgroundColor: "#064E3B",
    borderColor: "#064E3B",
  },
  statValue: {
    color: freightTheme.colors.primary,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 8,
  },
  statValueAccent: {
    color: "#FFFFFF",
  },
  statLabel: {
    color: freightTheme.colors.mutedText,
    fontWeight: "800",
    marginTop: 4,
  },
  statLabelAccent: {
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
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
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 18,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    alignItems: "center",
  },
  emptyTitle: {
    color: freightTheme.colors.text,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 10,
  },
  emptyText: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 6,
    textAlign: "center",
    lineHeight: 22,
  },
  userCard: {
    backgroundColor: freightTheme.colors.card,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  userHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 12,
  },
  userIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    color: freightTheme.colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  userMeta: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 4,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  statusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 11,
  },
  infoBox: {
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  infoRow: {
    marginBottom: 8,
  },
  infoLabel: {
    color: freightTheme.colors.primary,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  infoValue: {
    color: freightTheme.colors.text,
    fontWeight: "700",
    marginTop: 3,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  actionButton: {
    flexGrow: 1,
    minWidth: "46%",
    padding: 12,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
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
    color: freightTheme.colors.text,
    fontSize: 25,
    fontWeight: "900",
    textAlign: "center",
  },
  modalSubtitle: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 16,
  },
  modalInfoBox: {
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
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
  closeButton: {
    padding: 15,
    alignItems: "center",
    marginTop: 8,
  },
  closeText: {
    color: "#DC2626",
    fontWeight: "900",
  },
});