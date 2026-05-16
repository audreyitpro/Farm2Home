import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

import farmTheme from "../styles/farmTheme";

const pickupTimes = [
  "8:00 AM - 10:00 AM",
  "10:00 AM - 12:00 PM",
  "12:00 PM - 2:00 PM",
  "2:00 PM - 4:00 PM",
  "4:00 PM - 6:00 PM",
];

const deliveryTimes = [
  "9:00 AM - 12:00 PM",
  "12:00 PM - 3:00 PM",
  "3:00 PM - 6:00 PM",
  "6:00 PM - 9:00 PM",
];

type DeliveryType = "Pickup" | "Delivery";

type DeliverySchedule = {
  type: DeliveryType;
  time: string;
  createdAt: string;
};

export default function ScheduleDelivery() {
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("Delivery");
  const [selectedTime, setSelectedTime] = useState("");

  async function saveSchedule() {
    if (!selectedTime) {
      Alert.alert("Missing Time", "Please select a delivery or pickup time.");
      return;
    }

    try {
      const schedule: DeliverySchedule = {
        type: deliveryType,
        time: selectedTime,
        createdAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem("deliverySchedule", JSON.stringify(schedule));

      Alert.alert(
        "Schedule Saved",
        `${deliveryType} scheduled for ${selectedTime}`
      );

      router.replace("/customer/orders" as never);
    } catch (error) {
      console.log("Save delivery schedule error:", error);
      Alert.alert("Schedule Error", "Unable to save your schedule.");
    }
  }

  const availableTimes =
    deliveryType === "Delivery" ? deliveryTimes : pickupTimes;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Schedule Delivery / Pickup</Text>

      <Text style={styles.subtitle}>
        Choose your preferred delivery or pickup time window.
      </Text>

      <View style={styles.typeRow}>
        <TouchableOpacity
          style={[
            styles.typeButton,
            deliveryType === "Delivery" && styles.activeType,
          ]}
          onPress={() => {
            setDeliveryType("Delivery");
            setSelectedTime("");
          }}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.typeText,
              deliveryType === "Delivery" && styles.activeTypeText,
            ]}
          >
            Delivery
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.typeButton,
            deliveryType === "Pickup" && styles.activeType,
          ]}
          onPress={() => {
            setDeliveryType("Pickup");
            setSelectedTime("");
          }}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.typeText,
              deliveryType === "Pickup" && styles.activeTypeText,
            ]}
          >
            Pickup
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Available {deliveryType} Windows</Text>

      {availableTimes.map((time) => (
        <TouchableOpacity
          key={time}
          style={[styles.timeCard, selectedTime === time && styles.selectedCard]}
          onPress={() => setSelectedTime(time)}
          activeOpacity={0.85}
        >
          <Text
            style={[styles.timeText, selectedTime === time && styles.selectedText]}
          >
            {time}
          </Text>
        </TouchableOpacity>
      ))}

      <View style={styles.noticeBox}>
        <Text style={styles.noticeTitle}>Farm2Home Logistics</Text>

        <Text style={styles.noticeText}>
          Delivery timing may depend on farmer preparation time, distance,
          weather conditions, and driver availability.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.saveButton}
        onPress={saveSchedule}
        activeOpacity={0.85}
      >
        <Text style={styles.saveText}>Save Schedule</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: farmTheme.colors.background,
  },

  content: {
    padding: 20,
    paddingBottom: 60,
  },

  title: {
    fontSize: 32,
    fontWeight: "900",
    color: farmTheme.colors.primary,
    marginBottom: 8,
  },

  subtitle: {
    color: farmTheme.colors.mutedText,
    lineHeight: 22,
    marginBottom: 20,
    fontWeight: "700",
  },

  typeRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },

  typeButton: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    alignItems: "center",
  },

  activeType: {
    backgroundColor: farmTheme.colors.primary,
    borderColor: farmTheme.colors.primary,
  },

  typeText: {
    fontWeight: "900",
    color: farmTheme.colors.text,
  },

  activeTypeText: {
    color: "#FFFFFF",
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 14,
    color: farmTheme.colors.text,
  },

  timeCard: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
  },

  selectedCard: {
    backgroundColor: "#E8F5E9",
    borderColor: farmTheme.colors.primary,
    borderWidth: 2,
  },

  timeText: {
    fontWeight: "700",
    color: farmTheme.colors.text,
  },

  selectedText: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
  },

  noticeBox: {
    backgroundColor: "#E8F5E9",
    padding: 16,
    borderRadius: 14,
    marginTop: 18,
    borderLeftWidth: 5,
    borderLeftColor: farmTheme.colors.primary,
  },

  noticeTitle: {
    fontWeight: "900",
    color: farmTheme.colors.primary,
    marginBottom: 6,
  },

  noticeText: {
    color: farmTheme.colors.text,
    lineHeight: 21,
    fontWeight: "700",
  },

  saveButton: {
    backgroundColor: farmTheme.colors.primary,
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 22,
  },

  saveText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
});