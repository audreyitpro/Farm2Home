import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import * as Speech from "expo-speech";

import farmTheme from "../styles/farmTheme";

type SupportCategory =
  | "Late Delivery"
  | "Refund Request"
  | "Damaged Product"
  | "Missing Item"
  | "Farmer Issue"
  | "App Help"
  | "Other";

export default function CustomerSupport() {
  const [category, setCategory] = useState<SupportCategory>("Late Delivery");
  const [orderId, setOrderId] = useState("");
  const [message, setMessage] = useState("");
  const [aiResponse, setAiResponse] = useState(
    "Hi, I’m your Farm2Home support assistant. Select a support reason and describe the issue."
  );

  const categories: SupportCategory[] = [
    "Late Delivery",
    "Refund Request",
    "Damaged Product",
    "Missing Item",
    "Farmer Issue",
    "App Help",
    "Other",
  ];

  function speak(text: string) {
    Speech.stop();
    Speech.speak(text, {
      rate: 0.92,
      pitch: 1,
    });
  }

  function generateSupportResponse() {
    if (!message.trim()) {
      Alert.alert("Message Needed", "Please describe the issue first.");
      return;
    }

    let response = "";

    if (category === "Late Delivery") {
      response =
        "I understand your delivery is late. We will check the driver route, delivery status, and estimated arrival time.";
    } else if (category === "Refund Request") {
      response =
        "Your refund request has been prepared. A support team member will review the order and payment details.";
    } else if (category === "Damaged Product") {
      response =
        "I’m sorry your product arrived damaged. Please keep photos available so support can verify and resolve it quickly.";
    } else if (category === "Missing Item") {
      response =
        "I see this is about a missing item. We will compare the order, farmer inventory, and delivery proof.";
    } else if (category === "Farmer Issue") {
      response =
        "Your farmer-related issue has been routed for review. We will check the farm profile, order history, and customer notes.";
    } else if (category === "App Help") {
      response =
        "This looks like an app support issue. Try closing and reopening the app, then support can review the technical issue.";
    } else {
      response =
        "Your support request has been created and routed to the Farm2Home team.";
    }

    setAiResponse(response);
    speak(response);
  }

  function submitTicket() {
    if (!message.trim()) {
      Alert.alert("Message Needed", "Please describe the issue before submitting.");
      return;
    }

    Alert.alert(
      "Support Ticket Created",
      `Category: ${category}\nOrder ID: ${orderId || "Not provided"}`
    );

    setMessage("");
    setOrderId("");
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Farm2Home Support</Text>
          <Text style={styles.title}>Customer Help Center</Text>
          <Text style={styles.subtitle}>
            Get help with orders, refunds, deliveries, damaged items, and app issues.
          </Text>
        </View>

        <View style={styles.aiCard}>
          <Text style={styles.aiTitle}>AI Support Assistant</Text>
          <Text style={styles.aiText}>{aiResponse}</Text>

          <TouchableOpacity style={styles.speakButton} onPress={() => speak(aiResponse)}>
            <Text style={styles.speakText}>Read Aloud</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Support Reason</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryRow}
        >
          {categories.map((item) => (
            <TouchableOpacity
              key={item}
              style={[
                styles.categoryChip,
                category === item && styles.categoryChipActive,
              ]}
              onPress={() => setCategory(item)}
            >
              <Text
                style={[
                  styles.categoryText,
                  category === item && styles.categoryTextActive,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.formCard}>
          <Text style={styles.label}>Order ID Optional</Text>
          <TextInput
            style={styles.input}
            placeholder="Example: ORD-10025"
            placeholderTextColor="#8A8F98"
            value={orderId}
            onChangeText={setOrderId}
          />

          <Text style={styles.label}>Describe the Issue</Text>
          <TextInput
            style={styles.messageInput}
            placeholder="Tell us what happened..."
            placeholderTextColor="#8A8F98"
            value={message}
            onChangeText={setMessage}
            multiline
          />

          <TouchableOpacity style={styles.primaryButton} onPress={generateSupportResponse}>
            <Text style={styles.primaryText}>Ask AI Support</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.submitButton} onPress={submitTicket}>
            <Text style={styles.submitText}>Submit Support Ticket</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.quickHelpCard}>
          <Text style={styles.quickTitle}>Quick Help</Text>

          <TouchableOpacity
            style={styles.quickRow}
            onPress={() => router.push("/customer/orders")}
          >
            <Text style={styles.quickText}>View My Orders</Text>
            <Text style={styles.quickArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickRow}
            onPress={() => router.push("/customer/order-tracking")}
          >
            <Text style={styles.quickText}>Track Delivery</Text>
            <Text style={styles.quickArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickRow}
            onPress={() => router.push("/customer/marketplace")}
          >
            <Text style={styles.quickText}>Return to Marketplace</Text>
            <Text style={styles.quickArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: farmTheme.colors.background,
  },

  hero: {
    backgroundColor: farmTheme.colors.primary,
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },

  eyebrow: {
    color: "#DFF5E5",
    fontWeight: "900",
    marginBottom: 8,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 10,
  },

  subtitle: {
    color: "#E8F5E9",
    fontWeight: "700",
    lineHeight: 23,
  },

  aiCard: {
    backgroundColor: "#064E3B",
    margin: 18,
    borderRadius: 22,
    padding: 18,
  },

  aiTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 8,
  },

  aiText: {
    color: "#BBF7D0",
    fontWeight: "700",
    lineHeight: 23,
  },

  speakButton: {
    backgroundColor: "#10B981",
    padding: 13,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 14,
  },

  speakText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  sectionTitle: {
    color: farmTheme.colors.text,
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },

  categoryRow: {
    paddingLeft: 18,
    marginBottom: 16,
  },

  categoryChip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    marginRight: 10,
  },

  categoryChipActive: {
    backgroundColor: farmTheme.colors.primary,
    borderColor: farmTheme.colors.primary,
  },

  categoryText: {
    color: farmTheme.colors.text,
    fontWeight: "900",
  },

  categoryTextActive: {
    color: "#FFFFFF",
  },

  formCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 18,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  label: {
    color: farmTheme.colors.text,
    fontWeight: "900",
    fontSize: 16,
    marginBottom: 8,
  },

  input: {
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    padding: 14,
    color: farmTheme.colors.text,
    fontWeight: "700",
    marginBottom: 16,
  },

  messageInput: {
    minHeight: 120,
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    padding: 14,
    color: farmTheme.colors.text,
    fontWeight: "700",
    textAlignVertical: "top",
    marginBottom: 16,
  },

  primaryButton: {
    backgroundColor: farmTheme.colors.primary,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 12,
  },

  primaryText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  submitButton: {
    backgroundColor: "#111827",
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },

  submitText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  quickHelpCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  quickTitle: {
    color: farmTheme.colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 12,
  },

  quickRow: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  quickText: {
    color: farmTheme.colors.text,
    fontWeight: "900",
    fontSize: 16,
  },

  quickArrow: {
    color: farmTheme.colors.primary,
    fontSize: 30,
    fontWeight: "900",
  },
});