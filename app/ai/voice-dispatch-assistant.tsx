import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import * as Speech from "expo-speech";
import { router } from "expo-router";

import { supabase } from "../data/supabaseClient";

import freightTheme from "../styles/freightTheme";

import {
  runAutonomousDispatch,
  loadAvailableDrivers,
  loadOpenFreightLoads,
} from "./autonomous-dispatch-engine";

type AssistantResult = {
  title: string;
  message: string;
  severity?: "LOW" | "MEDIUM" | "HIGH";
};

export default function VoiceDispatchAssistant() {
  const [command, setCommand] = useState("");

  const [result, setResult] =
    useState<AssistantResult | null>(null);

  const [loading, setLoading] =
    useState(false);

  const quickCommands = useMemo(
    () => [
      "Show open loads",
      "How many active drivers?",
      "Give me order status",
      "Show revenue summary",
      "Run autonomous dispatch",
      "Show cold-chain loads",
      "Show delivery risks",
      "Open AI dispatch",
    ],
    []
  );

  function speak(text: string) {
    Speech.stop();

    Speech.speak(text, {
      rate: 0.92,
      pitch: 1,
    });
  }

  async function runCommand() {
    if (!command.trim()) {
      Alert.alert(
        "Command Needed",
        "Type a dispatch command first."
      );

      return;
    }

    try {
      setLoading(true);

      const lower =
        command.toLowerCase();

      if (
        lower.includes("open loads") ||
        lower.includes("available loads")
      ) {
        const response =
          await getOpenLoadsSummary();

        setResult(response);

        speak(response.message);

        return;
      }

      if (
        lower.includes("active drivers") ||
        lower.includes("drivers")
      ) {
        const response =
          await getActiveDriversSummary();

        setResult(response);

        speak(response.message);

        return;
      }

      if (
        lower.includes("orders")
      ) {
        const response =
          await getOrdersSummary();

        setResult(response);

        speak(response.message);

        return;
      }

      if (
        lower.includes("revenue")
      ) {
        const response =
          await getRevenueSummary();

        setResult(response);

        speak(response.message);

        return;
      }

      if (
        lower.includes("cold-chain") ||
        lower.includes("temperature")
      ) {
        const response =
          await getColdChainSummary();

        setResult(response);

        speak(response.message);

        return;
      }

      if (
        lower.includes("delivery risks") ||
        lower.includes("risk")
      ) {
        const response =
          await getDeliveryRiskSummary();

        setResult(response);

        speak(response.message);

        return;
      }

      if (
        lower.includes("run autonomous dispatch") ||
        lower.includes("auto dispatch") ||
        lower.includes("autonomous dispatch")
      ) {
        const response =
          await runAiDispatch();

        setResult(response);

        speak(response.message);

        return;
      }

      if (
        lower.includes("dispatch") ||
        lower.includes("ai dispatch")
      ) {
        const response = {
          title: "AI Dispatch",
          message:
            "Opening AI Dispatch Intelligence Center.",
        };

        setResult(response);

        speak(response.message);

        router.push(
          "/ai/dispatch-intelligence-center"
        );

        return;
      }

      const fallback = {
        title:
          "Command Not Recognized",

        message:
          "Try asking for open loads, active drivers, orders, revenue, cold-chain loads, delivery risks, or autonomous dispatch.",
      };

      setResult(fallback);

      speak(fallback.message);
    } catch (error: any) {
      Alert.alert(
        "Assistant Error",
        error.message ||
          "Unable to run command."
      );
    } finally {
      setLoading(false);
    }
  }

  async function getOpenLoadsSummary(): Promise<AssistantResult> {
    const loads =
      await loadOpenFreightLoads();

    const totalRate =
      loads.reduce(
        (sum, item) =>
          sum +
          Number(item.rate || 0),
        0
      );

    return {
      title:
        "Open Freight Loads",

      message: `There are ${
        loads.length
      } open freight loads with approximately $${totalRate.toFixed(
        0
      )} in carrier opportunity value.`,
    };
  }

  async function getActiveDriversSummary(): Promise<AssistantResult> {
    const drivers =
      await loadAvailableDrivers();

    return {
      title:
        "Active Drivers",

      message: `There are ${
        drivers.length
      } available or active drivers currently connected to the logistics network.`,
    };
  }

  async function getOrdersSummary(): Promise<AssistantResult> {
    const { data } =
      await supabase
        .from("orders")
        .select("*");

    const active =
      data?.filter((item: any) =>
        [
          "PAID",
          "ACCEPTED",
          "PREPARING",
          "READY_FOR_PICKUP",
          "PICKED_UP",
          "IN_TRANSIT",
        ].includes(item.status)
      ) || [];

    return {
      title:
        "Order Operations",

      message: `There are ${
        data?.length || 0
      } total marketplace orders and ${
        active.length
      } active orders moving through fulfillment.`,
    };
  }

  async function getRevenueSummary(): Promise<AssistantResult> {
    const {
      data: orders,
    } = await supabase
      .from("orders")
      .select("*");

    const {
      data: loads,
    } = await supabase
      .from("freight_loads")
      .select("*");

    const orderRevenue =
      orders?.reduce(
        (
          sum: number,
          item: any
        ) =>
          sum +
          Number(item.total || 0),
        0
      ) || 0;

    const freightRevenue =
      loads?.reduce(
        (
          sum: number,
          item: any
        ) =>
          sum +
          Number(item.rate || 0),
        0
      ) || 0;

    return {
      title:
        "Revenue Summary",

      message: `Marketplace revenue is approximately $${orderRevenue.toFixed(
        0
      )}. Freight opportunity value is approximately $${freightRevenue.toFixed(
        0
      )}.`,
    };
  }

  async function getColdChainSummary(): Promise<AssistantResult> {
    const {
      data,
    } = await supabase
      .from("freight_loads")
      .select("*")
      .eq(
        "temperature_controlled",
        true
      );

    return {
      title:
        "Cold-Chain Freight",

      severity: "HIGH",

      message: `There are ${
        data?.length || 0
      } active temperature-controlled freight loads requiring priority logistics coordination.`,
    };
  }

  async function getDeliveryRiskSummary(): Promise<AssistantResult> {
    const drivers =
      await loadAvailableDrivers();

    const stale =
      drivers.filter((driver) => {
        const minutes =
          (Date.now() -
            new Date(
              driver.updated_at
            ).getTime()) /
          1000 /
          60;

        return minutes > 30;
      });

    return {
      title:
        "Delivery Risk Analysis",

      severity:
        stale.length > 0
          ? "HIGH"
          : "LOW",

      message:
        stale.length > 0
          ? `${stale.length} drivers may have elevated delivery delay risk due to stale GPS telemetry.`
          : "No significant delivery delay risks detected.",
    };
  }

  async function runAiDispatch(): Promise<AssistantResult> {
    const result =
      await runAutonomousDispatch();

    return {
      title:
        "Autonomous Dispatch Complete",

      severity: "MEDIUM",

      message: `AI dispatch completed with ${result.assigned} automatic load assignments and ${result.recommendations.length} intelligent dispatch recommendations.`,
    };
  }

  function severityColor(
    severity?: string
  ) {
    switch (severity) {
      case "HIGH":
        return "#DC2626";

      case "MEDIUM":
        return "#F59E0B";

      default:
        return "#10B981";
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>
          Farm2Home AI
        </Text>

        <Text style={styles.title}>
          Voice Dispatch Copilot
        </Text>

        <Text style={styles.subtitle}>
          AI-powered logistics assistant
          for realtime freight
          operations, dispatch
          intelligence, delivery risk
          analysis, and autonomous
          coordination.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={
          styles.content
        }
      >
        <View style={styles.card}>
          <Text style={styles.label}>
            Dispatch Command
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Example: Run autonomous dispatch"
            placeholderTextColor="#94A3B8"
            value={command}
            onChangeText={setCommand}
            multiline
          />

          <TouchableOpacity
            style={[
              styles.primaryButton,
              loading &&
                styles.disabledButton,
            ]}
            onPress={runCommand}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text
                style={
                  styles.primaryText
                }
              >
                Run AI Assistant
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={
              styles.secondaryButton
            }
            onPress={() => {
              setCommand("");
              setResult(null);

              Speech.stop();
            }}
          >
            <Text
              style={
                styles.secondaryText
              }
            >
              Clear
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>
          AI Quick Commands
        </Text>

        {quickCommands.map((item) => (
          <TouchableOpacity
            key={item}
            style={styles.commandChip}
            onPress={() =>
              setCommand(item)
            }
          >
            <Text
              style={
                styles.commandText
              }
            >
              {item}
            </Text>
          </TouchableOpacity>
        ))}

        {result && (
          <View
            style={[
              styles.resultCard,
              {
                borderColor:
                  severityColor(
                    result.severity
                  ),
              },
            ]}
          >
            <Text
              style={
                styles.resultTitle
              }
            >
              {result.title}
            </Text>

            <Text
              style={
                styles.resultMessage
              }
            >
              {result.message}
            </Text>

            <TouchableOpacity
              style={
                styles.speakButton
              }
              onPress={() =>
                speak(
                  result.message
                )
              }
            >
              <Text
                style={
                  styles.speakText
                }
              >
                Read Aloud Again
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.navRow}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() =>
              router.push(
                "/admin/live-operations-center"
              )
            }
          >
            <Text style={styles.navText}>
              Operations
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={
              styles.navButtonOutline
            }
            onPress={() =>
              router.push(
                "/ai/dispatch-intelligence-center"
              )
            }
          >
            <Text
              style={
                styles.navTextOutline
              }
            >
              AI Dispatch
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor:
      freightTheme.colors
        .background,
  },

  hero: {
    backgroundColor:
      "#111827",

    paddingTop: 62,
    paddingHorizontal: 20,
    paddingBottom: 26,
  },

  eyebrow: {
    color: "#10B981",
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
    color: "#D1D5DB",
    lineHeight: 23,
    fontSize: 15,
  },

  content: {
    padding: 18,
    paddingBottom: 80,
  },

  card: {
    backgroundColor:
      freightTheme.colors.card,

    borderColor:
      freightTheme.colors
        .border,

    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
  },

  label: {
    color:
      freightTheme.colors.text,

    fontWeight: "900",
    fontSize: 17,
    marginBottom: 10,
  },

  input: {
    backgroundColor:
      freightTheme.colors
        .surface,

    color:
      freightTheme.colors.text,

    minHeight: 110,
    borderRadius: 16,
    padding: 14,
    textAlignVertical: "top",
    marginBottom: 14,
    fontWeight: "700",
  },

  primaryButton: {
    backgroundColor:
      "#10B981",

    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 10,
  },

  disabledButton: {
    opacity: 0.6,
  },

  primaryText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  secondaryButton: {
    backgroundColor:
      "#334155",

    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },

  secondaryText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  sectionTitle: {
    color:
      freightTheme.colors.text,

    fontSize: 22,
    fontWeight: "900",
    marginBottom: 12,
  },

  commandChip: {
    backgroundColor:
      freightTheme.colors.card,

    borderColor:
      freightTheme.colors
        .border,

    borderWidth: 1,
    borderRadius: 16,
    padding: 15,
    marginBottom: 10,
  },

  commandText: {
    color:
      freightTheme.colors.text,

    fontWeight: "900",
  },

  resultCard: {
    backgroundColor:
      "#064E3B",

    borderRadius: 20,
    padding: 18,
    marginTop: 12,
    marginBottom: 18,
    borderWidth: 2,
  },

  resultTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 8,
  },

  resultMessage: {
    color: "#BBF7D0",
    lineHeight: 24,
    fontWeight: "700",
  },

  speakButton: {
    backgroundColor:
      "#10B981",

    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 14,
  },

  speakText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  navRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },

  navButton: {
    flex: 1,
    backgroundColor:
      "#10B981",

    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },

  navButtonOutline: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#10B981",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },

  navText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  navTextOutline: {
    color: "#10B981",
    fontWeight: "900",
  },
});