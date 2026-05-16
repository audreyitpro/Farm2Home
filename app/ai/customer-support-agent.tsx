import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Speech from "expo-speech";
import { router } from "expo-router";

import { supabase } from "../data/supabaseClient";

type SupportMessage = {
  id: string;
  role: "USER" | "AGENT";
  message: string;
  createdAt: string;
};

type SupportContext = {
  name: string;
  email: string;
  role: "CUSTOMER" | "FARMER" | "FREIGHT" | "ADMIN" | "GUEST";
};

export default function CustomerSupportAgent() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [context, setContext] = useState<SupportContext>({
    name: "Guest",
    email: "",
    role: "GUEST",
  });

  const [messages, setMessages] = useState<SupportMessage[]>([
    {
      id: "welcome",
      role: "AGENT",
      message:
        "Hi, I’m your Farm2Home AI Support Agent. I can help with orders, deliveries, farmer onboarding, freight loads, subscriptions, payments, and dispatch questions.",
      createdAt: new Date().toISOString(),
    },
  ]);

  useEffect(() => {
    loadUserContext();
  }, []);

  async function loadUserContext() {
    try {
      const customer = await AsyncStorage.getItem("currentCustomer");
      const farmer = await AsyncStorage.getItem("currentFarmer");
      const freight =
        (await AsyncStorage.getItem("currentFreightCarrier")) ||
        (await AsyncStorage.getItem("currentFreight"));
      const admin = await AsyncStorage.getItem("currentAdmin");

      if (customer) {
        const user = JSON.parse(customer);

        setContext({
          name: user.fullName || user.name || "Customer",
          email: user.email || "",
          role: "CUSTOMER",
        });

        return;
      }

      if (farmer) {
        const user = JSON.parse(farmer);

        setContext({
          name: user.farmName || user.ownerName || "Farmer",
          email: user.email || "",
          role: "FARMER",
        });

        return;
      }

      if (freight) {
        const user = JSON.parse(freight);

        setContext({
          name: user.companyName || user.ownerName || "Freight Carrier",
          email: user.email || "",
          role: "FREIGHT",
        });

        return;
      }

      if (admin) {
        const user = JSON.parse(admin);

        setContext({
          name: user.name || "Admin",
          email: user.email || "",
          role: "ADMIN",
        });
      }
    } catch (error) {
      console.log("Load support user context error:", error);
    }
  }

  function speak(text: string) {
    Speech.stop();

    Speech.speak(text, {
      rate: 0.94,
      pitch: 1,
    });
  }

  async function sendMessage(customMessage?: string) {
    const messageText = customMessage || input;

    if (!messageText.trim()) {
      Alert.alert("Message Needed", "Please type a support question.");
      return;
    }

    const userMessage: SupportMessage = {
      id: `user_${Date.now()}`,
      role: "USER",
      message: messageText.trim(),
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    try {
      setLoading(true);

      const agentResponse = await generateSupportResponse(messageText.trim());

      const responseMessage: SupportMessage = {
        id: `agent_${Date.now()}`,
        role: "AGENT",
        message: agentResponse,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, responseMessage]);

      await saveSupportLog(messageText.trim(), agentResponse);

      speak(agentResponse);
    } catch (error: any) {
      Alert.alert(
        "Support Error",
        error.message || "Unable to process support question."
      );
    } finally {
      setLoading(false);
    }
  }

  async function generateSupportResponse(question: string) {
    const lower = question.toLowerCase();

    if (
      lower.includes("order") ||
      lower.includes("where is") ||
      lower.includes("delivery")
    ) {
      return getOrderSupportResponse();
    }

    if (
      lower.includes("driver") ||
      lower.includes("tracking") ||
      lower.includes("gps") ||
      lower.includes("map")
    ) {
      return getTrackingSupportResponse();
    }

    if (
      lower.includes("payment") ||
      lower.includes("stripe") ||
      lower.includes("subscription") ||
      lower.includes("billing")
    ) {
      return getBillingSupportResponse();
    }

    if (
      lower.includes("farmer") ||
      lower.includes("product") ||
      lower.includes("inventory") ||
      lower.includes("farm")
    ) {
      return getFarmerSupportResponse();
    }

    if (
      lower.includes("freight") ||
      lower.includes("load") ||
      lower.includes("carrier") ||
      lower.includes("dispatch")
    ) {
      return getFreightSupportResponse();
    }

    if (
      lower.includes("refund") ||
      lower.includes("cancel") ||
      lower.includes("problem") ||
      lower.includes("damaged")
    ) {
      return getIssueSupportResponse();
    }

    if (
      lower.includes("admin") ||
      lower.includes("approval") ||
      lower.includes("documents") ||
      lower.includes("verification")
    ) {
      return getVerificationSupportResponse();
    }

    return "I can help with Farm2Home orders, deliveries, payments, farmer onboarding, freight dispatch, driver tracking, refunds, and account verification. Please tell me what part of the platform you need help with.";
  }

  async function getOrderSupportResponse() {
    if (context.role !== "CUSTOMER" || !context.email) {
      return "For order support, please log in as a customer first. Once logged in, open My Orders to view order status, delivery details, and live tracking.";
    }

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("*")
      .eq("email", context.email.toLowerCase())
      .maybeSingle();

    if (customerError) {
      console.log("Customer lookup error:", customerError);
    }

    if (!customer) {
      return "I could not find your customer profile in the cloud database yet. Please check that your customer registration completed successfully.";
    }

    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(3);

    if (ordersError) {
      console.log("Order lookup error:", ordersError);
    }

    if (!orders || orders.length === 0) {
      return "I do not see any recent orders yet. After checkout, your orders will appear under My Orders.";
    }

    const latest = orders[0];

    return `Your latest order is #${String(latest.id).slice(
      -6
    )}. Current status is ${latest.status}. Total is $${Number(
      latest.total || 0
    ).toFixed(
      2
    )}. Open My Orders for the full order timeline and tracking details.`;
  }

  async function getTrackingSupportResponse() {
    const { data, error } = await supabase
      .from("driver_locations")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) {
      console.log("Tracking lookup error:", error);
    }

    if (!data || data.length === 0) {
      return "No live driver GPS updates are available yet. Tracking will appear after a driver starts the route.";
    }

    const latest = data[0];

    const updatedAt = latest.updated_at
      ? new Date(latest.updated_at).toLocaleString()
      : "not available";

    return `The latest driver tracking update shows status ${latest.status}. GPS was updated at ${updatedAt}. Customers can open Live Order Tracking to see delivery progress.`;
  }

  function getBillingSupportResponse() {
    return "For billing or subscription help, check that your Stripe checkout completed successfully. If payment completed but your membership is not active, log out and back in, then open your subscription success screen. Admin can also verify payment status from the revenue dashboard.";
  }

  function getFarmerSupportResponse() {
    return "For farmer support, make sure registration, documents, and admin approval are complete. After approval, farmers can add products, manage inventory, review orders, and coordinate freight pickup or delivery.";
  }

  async function getFreightSupportResponse() {
    const { data, error } = await supabase
      .from("freight_loads")
      .select("*")
      .in("status", ["OPEN", "POSTED"])
      .order("created_at", { ascending: false });

    if (error) {
      console.log("Freight load lookup error:", error);
    }

    const count = data?.length || 0;

    const value =
      data?.reduce((sum: number, item: any) => {
        return sum + Number(item.rate || 0);
      }, 0) || 0;

    return `There are currently ${count} open freight loads with about $${value.toFixed(
      0
    )} in visible freight value. Carriers can open the Freight Board or Driver App to accept loads.`;
  }

  function getIssueSupportResponse() {
    return "For cancellations, refunds, damaged items, or delivery problems, please document the issue with notes and photos if available. Admin should review the order, proof of delivery, and payment record before issuing a refund or credit.";
  }

  function getVerificationSupportResponse() {
    return "For verification support, make sure all required documents were uploaded. Admin can review farmer and freight documents in the Admin Dashboard or Control Tower. Once approved, the account can access marketplace or freight features.";
  }

  async function saveSupportLog(question: string, answer: string) {
    try {
      await supabase.from("support_messages").insert({
        user_role: context.role,
        user_name: context.name,
        user_email: context.email || null,
        question,
        answer,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.log("Support log save error:", error);
    }
  }

  function quickQuestion(text: string) {
    sendMessage(text);
  }

  function formatTime(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleTimeString();
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home AI</Text>

        <Text style={styles.title}>Customer Support Agent</Text>

        <Text style={styles.subtitle}>
          AI-powered help for orders, deliveries, payments, farmers, freight,
          dispatch, verification, and platform support.
        </Text>
      </View>

      <View style={styles.contextCard}>
        <Text style={styles.contextTitle}>Current User</Text>

        <Text style={styles.contextText}>
          {context.name} · {context.role}
        </Text>

        {!!context.email && (
          <Text style={styles.contextText}>{context.email}</Text>
        )}
      </View>

      <View style={styles.quickRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            "Where is my order?",
            "Help with delivery tracking",
            "Subscription payment help",
            "Farmer onboarding help",
            "Open freight loads",
            "Refund or damaged item",
          ].map((item) => (
            <TouchableOpacity
              key={item}
              style={styles.quickChip}
              onPress={() => quickQuestion(item)}
            >
              <Text style={styles.quickText}>{item}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messages}
        renderItem={({ item }) => {
          const isUser = item.role === "USER";

          return (
            <View
              style={[
                styles.messageBubble,
                isUser ? styles.userBubble : styles.agentBubble,
              ]}
            >
              <Text style={[styles.messageRole, isUser && styles.userRole]}>
                {isUser ? "You" : "Farm2Home AI"}
              </Text>

              <Text style={[styles.messageText, isUser && styles.userText]}>
                {item.message}
              </Text>

              <Text style={[styles.timeText, isUser && styles.userTime]}>
                {formatTime(item.createdAt)}
              </Text>
            </View>
          );
        }}
      />

      <View style={styles.footerNav}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push("/customer/orders")}
        >
          <Text style={styles.navText}>Orders</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButtonOutline}
          onPress={() => router.push("/chat/chat-center")}
        >
          <Text style={styles.navTextOutline}>Live Chat</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Ask Farm2Home support..."
          placeholderTextColor="#8A8F98"
          value={input}
          onChangeText={setInput}
          multiline
        />

        <TouchableOpacity
          style={[styles.sendButton, loading && styles.disabledButton]}
          onPress={() => sendMessage()}
          disabled={loading}
        >
          <Text style={styles.sendText}>{loading ? "..." : "Send"}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7F2",
  },

  hero: {
    backgroundColor: "#2F7D32",
    paddingTop: 62,
    paddingHorizontal: 20,
    paddingBottom: 22,
  },

  eyebrow: {
    color: "#DFF5E5",
    fontWeight: "900",
    marginBottom: 8,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    marginBottom: 8,
  },

  subtitle: {
    color: "#E8F5E9",
    lineHeight: 22,
    fontWeight: "700",
  },

  contextCard: {
    backgroundColor: "#FFFFFF",
    margin: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  contextTitle: {
    color: "#111827",
    fontWeight: "900",
  },

  contextText: {
    color: "#6B7280",
    fontWeight: "700",
    marginTop: 3,
  },

  quickRow: {
    paddingHorizontal: 14,
    marginBottom: 8,
  },

  quickChip: {
    backgroundColor: "#E8F5E9",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },

  quickText: {
    color: "#2F7D32",
    fontWeight: "900",
  },

  messages: {
    padding: 14,
    paddingBottom: 20,
  },

  messageBubble: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    maxWidth: "86%",
  },

  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#2F7D32",
  },

  agentBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  messageRole: {
    color: "#2F7D32",
    fontWeight: "900",
    marginBottom: 5,
  },

  userRole: {
    color: "#FFFFFF",
  },

  messageText: {
    color: "#374151",
    lineHeight: 21,
    fontWeight: "700",
  },

  userText: {
    color: "#FFFFFF",
  },

  timeText: {
    color: "#6B7280",
    fontSize: 11,
    marginTop: 8,
    fontWeight: "700",
  },

  userTime: {
    color: "#E8F5E9",
  },

  footerNav: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },

  navButton: {
    flex: 1,
    backgroundColor: "#2F7D32",
    padding: 12,
    borderRadius: 14,
    alignItems: "center",
  },

  navText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  navButtonOutline: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2F7D32",
  },

  navTextOutline: {
    color: "#2F7D32",
    fontWeight: "900",
  },

  composer: {
    flexDirection: "row",
    gap: 8,
    padding: 14,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },

  input: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    padding: 12,
    minHeight: 46,
    maxHeight: 120,
    color: "#111827",
  },

  sendButton: {
    backgroundColor: "#2F7D32",
    borderRadius: 16,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
  },

  disabledButton: {
    backgroundColor: "#9CA3AF",
  },

  sendText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});