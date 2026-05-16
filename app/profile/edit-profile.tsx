import React, { useState } from "react";
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

export default function EditProfileScreen() {
  const { user, profile, refreshProfile } = useAuth();

  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [city, setCity] = useState(profile?.city || "");
  const [state, setState] = useState(profile?.state || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");

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

    if (result.canceled) {
      return;
    }

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
          value={profile?.email || ""}
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
});