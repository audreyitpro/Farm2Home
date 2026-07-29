import React from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";

const SUPPORT_EMAIL = "audreyitprofessional@gmail.com";

export default function SupportScreen() {
  const sendEmail = () => {
    const subject = encodeURIComponent("Farm2Home Support Request");
    const body = encodeURIComponent(
      "Hello Farm2Home Support,\n\nI need help with:\n\n"
    );

    Linking.openURL(
      `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`
    );
  };

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.brand}>Farm2Home</Text>
        <Text style={styles.tagline}>FRESH • LOCAL • FAST</Text>

        <Text style={styles.title}>How can we help?</Text>

        <Text style={styles.subtitle}>
          Support for customers, farmers, drivers, and freight carriers using
          the Farm2Home marketplace.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Contact Farm2Home Support</Text>

        <Text style={styles.text}>
          Need assistance with Farm2Home? Contact our support team for help
          with your account, orders, marketplace activity, deliveries,
          subscriptions, or technical issues.
        </Text>

        <TouchableOpacity style={styles.primaryButton} onPress={sendEmail}>
          <Text style={styles.primaryButtonText}>Email Support</Text>
        </TouchableOpacity>

        <Text style={styles.email}>{SUPPORT_EMAIL}</Text>

        <Text style={styles.response}>
          We aim to respond to support requests within 1–2 business days.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Support Topics</Text>

      <View style={styles.grid}>
        <View style={styles.topic}>
          <Text style={styles.icon}>🛒</Text>
          <Text style={styles.topicTitle}>Customers</Text>
          <Text style={styles.topicText}>
            Account access, marketplace shopping, orders, checkout, delivery,
            and order tracking.
          </Text>
        </View>

        <View style={styles.topic}>
          <Text style={styles.icon}>🌱</Text>
          <Text style={styles.topicTitle}>Farmers</Text>
          <Text style={styles.topicText}>
            Farmer accounts, products, inventory, bundles, orders, payouts,
            and marketplace support.
          </Text>
        </View>

        <View style={styles.topic}>
          <Text style={styles.icon}>🚚</Text>
          <Text style={styles.topicTitle}>Freight</Text>
          <Text style={styles.topicText}>
            Carrier accounts, load board activity, loads, Stripe Connect,
            payouts, and freight tools.
          </Text>
        </View>

        <View style={styles.topic}>
          <Text style={styles.icon}>📦</Text>
          <Text style={styles.topicTitle}>Drivers</Text>
          <Text style={styles.topicText}>
            Driver accounts, delivery board, assigned deliveries, proof of
            pickup, proof of delivery, earnings, and support.
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account & Login Help</Text>
        <Text style={styles.text}>
          If you're having trouble signing in, include the account type
          you're using—Customer, Farmer, Freight, or Driver—when contacting
          support.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Orders & Deliveries</Text>
        <Text style={styles.text}>
          For order or delivery assistance, include your order or load
          information and a short description of the issue. Do not email
          payment card numbers, passwords, or other sensitive credentials.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Payments & Payouts</Text>
        <Text style={styles.text}>
          Farm2Home uses secure payment services for eligible transactions.
          If you need help with a payment or payout, contact Farm2Home Support
          with the relevant order or account information.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Technical Support</Text>
        <Text style={styles.text}>
          If the app isn't working as expected, tell us what you were trying
          to do, what happened, and the device you're using. Screenshots of
          the issue can also help us investigate.
        </Text>
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Safety & Privacy</Text>
        <Text style={styles.noticeText}>
          Never send passwords, full payment card numbers, bank credentials,
          or other sensitive authentication information in a support email.
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerBrand}>Farm2Home</Text>
        <Text style={styles.footerText}>
          Connecting local farms, customers, drivers, and freight carriers.
        </Text>
        <Text style={styles.copyright}>
          © 2026 Farm2Home. All rights reserved.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F6F8F3",
  },

  content: {
    paddingBottom: 50,
  },

  header: {
    backgroundColor: "#08783E",
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 38,
  },

  backButton: {
    marginBottom: 28,
  },

  backText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  brand: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
  },

  tagline: {
    color: "#D9F5E3",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginTop: 3,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginTop: 30,
  },

  subtitle: {
    color: "#E9FFF0",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 10,
    maxWidth: 700,
  },

  card: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E1E8DD",
  },

  cardTitle: {
    color: "#102D1D",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 10,
  },

  text: {
    color: "#52615A",
    fontSize: 15,
    lineHeight: 23,
  },

  primaryButton: {
    backgroundColor: "#08783E",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },

  email: {
    color: "#08783E",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 14,
  },

  response: {
    color: "#738078",
    textAlign: "center",
    fontSize: 13,
    marginTop: 8,
  },

  sectionTitle: {
    color: "#102D1D",
    fontSize: 24,
    fontWeight: "900",
    marginHorizontal: 20,
    marginTop: 30,
    marginBottom: 4,
  },

  grid: {
    marginHorizontal: 20,
  },

  topic: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E1E8DD",
  },

  icon: {
    fontSize: 28,
    marginBottom: 10,
  },

  topicTitle: {
    color: "#102D1D",
    fontSize: 18,
    fontWeight: "900",
  },

  topicText: {
    color: "#617067",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },

  notice: {
    backgroundColor: "#E9F7EE",
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 18,
    padding: 20,
  },

  noticeTitle: {
    color: "#08783E",
    fontSize: 17,
    fontWeight: "900",
  },

  noticeText: {
    color: "#315642",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },

  footer: {
    alignItems: "center",
    paddingHorizontal: 25,
    paddingTop: 45,
  },

  footerBrand: {
    color: "#08783E",
    fontSize: 22,
    fontWeight: "900",
  },

  footerText: {
    color: "#68776E",
    textAlign: "center",
    fontSize: 13,
    marginTop: 7,
  },

  copyright: {
    color: "#8A958F",
    fontSize: 12,
    marginTop: 16,
  },
});