import React, { useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type ApprovalStatus = "Pending" | "Approved" | "Rejected";
type UserRole = "Customer" | "Farmer" | "Carrier" | "Driver";

type PendingUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  location: string;
  status: ApprovalStatus;
};

const starterUsers: PendingUser[] = [
  {
    id: "u1",
    name: "Green Valley Farm",
    email: "greenvalley@example.com",
    role: "Farmer",
    location: "Sterling Heights, MI",
    status: "Pending",
  },
  {
    id: "u2",
    name: "ASO Freight Carrier",
    email: "dispatch@example.com",
    role: "Carrier",
    location: "Detroit, MI",
    status: "Pending",
  },
  {
    id: "u3",
    name: "Marcus Driver",
    email: "driver@example.com",
    role: "Driver",
    location: "Warren, MI",
    status: "Pending",
  },
];

export default function UserApprovals() {
  const [users, setUsers] = useState<PendingUser[]>(starterUsers);

  const pendingCount = useMemo(() => {
    return users.filter((user) => user.status === "Pending").length;
  }, [users]);

  function updateStatus(id: string, status: ApprovalStatus) {
    setUsers((prev) =>
      prev.map((user) => (user.id === id ? { ...user, status } : user))
    );

    Alert.alert("User Updated", `User status changed to ${status}.`);
  }

  function statusStyle(status: ApprovalStatus) {
    if (status === "Approved") return styles.approved;
    if (status === "Rejected") return styles.rejected;
    return styles.pending;
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home Admin</Text>
        <Text style={styles.title}>User Approvals</Text>
        <Text style={styles.subtitle}>
          Review and approve customers, farmers, carriers, and drivers joining
          the platform.
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Pending Approvals</Text>
        <Text style={styles.summaryNumber}>{pendingCount}</Text>
        <Text style={styles.summaryText}>
          Users waiting for admin review and platform access.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Approval Queue</Text>

      {users.map((user) => (
        <View key={user.id} style={styles.userCard}>
          <View style={{ flex: 1 }}>
            <View style={styles.headerRow}>
              <Text style={styles.userName}>{user.name}</Text>
              <Text style={[styles.statusBadge, statusStyle(user.status)]}>
                {user.status}
              </Text>
            </View>

            <Text style={styles.userMeta}>{user.email}</Text>
            <Text style={styles.userMeta}>
              {user.role} · {user.location}
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.approveButton}
              onPress={() => updateStatus(user.id, "Approved")}
            >
              <Text style={styles.approveText}>Approve</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.rejectButton}
              onPress={() => updateStatus(user.id, "Rejected")}
            >
              <Text style={styles.rejectText}>Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

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
  title: { color: "#FFFFFF", fontSize: 36, fontWeight: "900", marginBottom: 10 },
  subtitle: { color: "#D1D5DB", fontWeight: "700", lineHeight: 23 },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    margin: 18,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  summaryLabel: { color: "#6B7280", fontWeight: "900" },
  summaryNumber: { color: "#2563EB", fontSize: 44, fontWeight: "900", marginTop: 4 },
  summaryText: { color: "#6B7280", fontWeight: "700", lineHeight: 22, marginTop: 6 },
  sectionTitle: {
    color: "#111827",
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  userCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    gap: 12,
  },
  headerRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  userName: { color: "#111827", fontSize: 18, fontWeight: "900" },
  userMeta: { color: "#6B7280", fontWeight: "700", marginTop: 5 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 12,
    fontWeight: "900",
  },
  pending: { backgroundColor: "#FEF3C7", color: "#92400E" },
  approved: { backgroundColor: "#DCFCE7", color: "#166534" },
  rejected: { backgroundColor: "#FEE2E2", color: "#991B1B" },
  actions: { justifyContent: "center", gap: 8 },
  approveButton: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  approveText: { color: "#FFFFFF", fontWeight: "900" },
  rejectButton: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  rejectText: { color: "#DC2626", fontWeight: "900" },
});