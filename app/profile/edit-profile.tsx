import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import * as ImagePicker from "expo-image-picker";

import { useAuth } from "../providers/AuthProvider";
import { updateUserProfile } from "../services/profileService";
import { uploadAvatarImage } from "../services/storageService";
import {
  cancelSubscription,
  checkSubscriptionStatus,
  getStripeCustomerId,
  getSubscriptionId,
  type UserRole,
} from "../services/subscriptionService";

export default function EditProfileScreen() {
  const { user, profile, refreshProfile } = useAuth();

  const [loading, setLoading] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const [subscriptionStatus, setSubscriptionStatus] = useState<any>(null);

  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [city, setCity] = useState(profile?.city || "");
  const [state, setState] = useState(profile?.state || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");

  const role: UserRole = useMemo(() => {
  const rawRole =
    (profile as any)?.role ||
    (profile as any)?.account_type ||
    (profile as any)?.user_type ||
    (profile as any)?.profile_type ||
    "customer";

    const normalized = String(rawRole).toLowerCase();

    if (
      normalized === "farmer" ||
      normalized === "freight" ||
      normalized === "driver" ||
      normalized === "customer"
    ) {
      return normalized;
    }

    return "customer";
  }, [profile]);

  const activeSubscription = subscriptionStatus?.subscription || null;
  const lockedOut = subscriptionStatus?.lockedOut === true;
  const hasActiveSubscription =
    subscriptionStatus?.hasActiveSubscription === true;

  useEffect(() => {
    loadSubscriptionStatus();
  }, [user?.id, profile?.email, role]);

  async function loadSubscriptionStatus() {
    try {
      if (!user?.id && !profile?.email) return;

      setSubscriptionLoading(true);

      const data = await checkSubscriptionStatus({
        role,
        userId: user?.id || "",
        email: profile?.email || user?.email || "",
      });

      setSubscriptionStatus(data);
    } catch (error: any) {
      console.log("Subscription status error:", error?.message);
    } finally {
      setSubscriptionLoading(false);
    }
  }

  async function chooseImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission Needed", "Photo library permission is required.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled) return;

    const image = result.assets[0];

    setAvatarUrl(image.uri);
  }

  async function saveProfile() {
    if (!user?.id) {
      Alert.alert("Session Error", "Please login again.");
      return;
    }

    try {
      setLoading(true);

      let finalAvatarUrl = avatarUrl;

      if (
        avatarUrl &&
        (avatarUrl.startsWith("file:") ||
          avatarUrl.startsWith("content:") ||
          avatarUrl.startsWith("blob:"))
      ) {
        finalAvatarUrl = await uploadAvatarImage(user.id, avatarUrl);
      }

      await updateUserProfile(user.id, {
        full_name: fullName.trim(),
        phone: phone.trim(),
        city: city.trim(),
        state: state.trim(),
        avatar_url: finalAvatarUrl,
      });

      setAvatarUrl(finalAvatarUrl);

      await refreshProfile();

      Alert.alert("Profile Updated", "Your profile was updated successfully.");
    } catch (error: any) {
      Alert.alert("Update Error", error.message || "Unable to update profile.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelSubscription() {
    const subscriptionId = getSubscriptionId(activeSubscription);
    const stripeCustomerId = getStripeCustomerId(activeSubscription);

    if (!subscriptionId && !stripeCustomerId && !user?.id) {
      Alert.alert(
        "No Subscription Found",
        "We could not find an active subscription to cancel."
      );
      return;
    }

    Alert.alert(
      "Cancel Subscription",
      "Are you sure you want to cancel? Your account access will be locked after cancellation.",
      [
        {
          text: "Keep Subscription",
          style: "cancel",
        },
        {
          text: "Cancel Subscription",
          style: "destructive",
          onPress: async () => {
            try {
              setCanceling(true);

              await cancelSubscription({
                role,
                userId: user?.id || "",
                subscriptionId,
                stripeCustomerId,
                cancelAtPeriodEnd: false,
              });

              await loadSubscriptionStatus();

              Alert.alert(
                "Subscription Canceled",
                "Your subscription was canceled. Access to paid features is now locked."
              );
            } catch (error: any) {
              Alert.alert(
                "Cancellation Error",
                error.message || "Unable to cancel subscription."
              );
            } finally {
              setCanceling(false);
            }
          },
        },
      ]
    );
  }

  function renderSubscriptionCard() {
    const statusText =
      activeSubscription?.subscription_status ||
      (hasActiveSubscription ? "active" : "not active");

    return (
      <View style={styles.subscriptionCard}>
        <View style={styles.subscriptionHeader}>
          <Text style={styles.subscriptionTitle}>Subscription</Text>

          <View
            style={[
              styles.statusBadge,
              hasActiveSubscription ? styles.activeBadge : styles.lockedBadge,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                hasActiveSubscription
                  ? styles.activeBadgeText
                  : styles.lockedBadgeText,
              ]}
            >
              {hasActiveSubscription ? "ACTIVE" : "LOCKED"}
            </Text>
          </View>
        </View>

        <Text style={styles.subscriptionLine}>Account Type: {role}</Text>
        <Text style={styles.subscriptionLine}>Status: {statusText}</Text>

        {lockedOut ? (
          <View style={styles.lockoutBox}>
            <Text style={styles.lockoutTitle}>Account Access Locked</Text>
            <Text style={styles.lockoutText}>
              {subscriptionStatus?.lockoutReason ||
                "Your subscription is not active. Please renew to continue using paid Farm2Home features."}
            </Text>
          </View>
        ) : (
          <Text style={styles.subscriptionGood}>
            Your subscription is active. Paid features are unlocked.
          </Text>
        )}

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadSubscriptionStatus}
          disabled={subscriptionLoading}
        >
          {subscriptionLoading ? (
            <ActivityIndicator color="#064E3B" />
          ) : (
            <Text style={styles.refreshText}>Refresh Subscription Status</Text>
          )}
        </TouchableOpacity>

        {hasActiveSubscription ? (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelSubscription}
            disabled={canceling}
          >
            {canceling ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.cancelText}>Cancel Subscription</Text>
            )}
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.title}>Edit Profile</Text>

        <Text style={styles.subtitle}>
          Update your Farm2Home account information.
        </Text>
      </View>

      <View style={styles.card}>
        <TouchableOpacity style={styles.avatarContainer} onPress={chooseImage}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>👤</Text>
            </View>
          )}

          <Text style={styles.changePhoto}>Change Photo</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Full Name</Text>

        <TextInput
          value={fullName}
          onChangeText={setFullName}
          style={styles.input}
          placeholder="Full Name"
          placeholderTextColor="#94A3B8"
        />

        <Text style={styles.label}>Email</Text>

        <TextInput
          value={profile?.email || user?.email || ""}
          editable={false}
          style={[styles.input, styles.disabledInput]}
        />

        <Text style={styles.label}>Phone Number</Text>

        <TextInput
          value={phone}
          onChangeText={setPhone}
          style={styles.input}
          placeholder="Phone Number"
          placeholderTextColor="#94A3B8"
        />

        <Text style={styles.label}>City</Text>

        <TextInput
          value={city}
          onChangeText={setCity}
          style={styles.input}
          placeholder="City"
          placeholderTextColor="#94A3B8"
        />

        <Text style={styles.label}>State</Text>

        <TextInput
          value={state}
          onChangeText={setState}
          style={styles.input}
          placeholder="State"
          placeholderTextColor="#94A3B8"
        />

        <TouchableOpacity
          style={styles.saveButton}
          onPress={saveProfile}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveText}>Save Profile</Text>
          )}
        </TouchableOpacity>
      </View>

      {renderSubscriptionCard()}

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },

  content: {
    padding: 22,
    paddingBottom: 100,
  },

  hero: {
    marginTop: 60,
    marginBottom: 24,
  },

  title: {
    color: "#064E3B",
    fontSize: 34,
    fontWeight: "900",
  },

  subtitle: {
    color: "#475569",
    marginTop: 8,
    lineHeight: 22,
    fontWeight: "700",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  avatarContainer: {
    alignItems: "center",
    marginBottom: 22,
  },

  avatar: {
    width: 120,
    height: 120,
    borderRadius: 999,
  },

  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarPlaceholderText: {
    fontSize: 48,
  },

  changePhoto: {
    color: "#10B981",
    fontWeight: "900",
    marginTop: 12,
  },

  label: {
    color: "#374151",
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 10,
  },

  input: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    color: "#111827",
    fontWeight: "700",
  },

  disabledInput: {
    backgroundColor: "#E5E7EB",
    color: "#6B7280",
  },

  saveButton: {
    backgroundColor: "#10B981",
    padding: 17,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 26,
  },

  saveText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },

  subscriptionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 20,
  },

  subscriptionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  subscriptionTitle: {
    color: "#064E3B",
    fontSize: 22,
    fontWeight: "900",
  },

  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },

  activeBadge: {
    backgroundColor: "#D1FAE5",
  },

  lockedBadge: {
    backgroundColor: "#FEE2E2",
  },

  statusBadgeText: {
    fontWeight: "900",
    fontSize: 12,
  },

  activeBadgeText: {
    color: "#065F46",
  },

  lockedBadgeText: {
    color: "#991B1B",
  },

  subscriptionLine: {
    color: "#334155",
    fontWeight: "800",
    marginTop: 6,
  },

  subscriptionGood: {
    backgroundColor: "#ECFDF5",
    color: "#047857",
    fontWeight: "800",
    padding: 14,
    borderRadius: 16,
    marginTop: 14,
    lineHeight: 20,
  },

  lockoutBox: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 18,
    padding: 14,
    marginTop: 14,
  },

  lockoutTitle: {
    color: "#991B1B",
    fontWeight: "900",
    marginBottom: 6,
  },

  lockoutText: {
    color: "#7F1D1D",
    fontWeight: "700",
    lineHeight: 20,
  },

  refreshButton: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    padding: 15,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 16,
  },

  refreshText: {
    color: "#064E3B",
    fontWeight: "900",
  },

  cancelButton: {
    backgroundColor: "#DC2626",
    padding: 16,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 14,
  },

  cancelText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },
});