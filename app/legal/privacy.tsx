import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function PrivacyPage() {
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Privacy Policy</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Information We Collect</Text>

        <Text style={styles.text}>
          Farm2Home collects account, order, delivery, and payment-related
          information to operate the marketplace and delivery platform.
        </Text>

        <Text style={styles.text}>
          This may include customer names, addresses, email addresses, phone
          numbers, farm profiles, freight carrier information, and transaction
          details.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>How Information Is Used</Text>

        <Text style={styles.text}>
          Information is used to process orders, coordinate deliveries, manage
          accounts, provide customer support, improve services, and meet legal or
          compliance obligations.
        </Text>

        <Text style={styles.text}>
          Delivery and freight data may be shared with drivers, farmers,
          logistics providers, or payment processors when required to complete
          transactions.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Data Protection</Text>

        <Text style={styles.text}>
          Farm2Home uses commercially reasonable safeguards to help protect
          customer and business information.
        </Text>

        <Text style={styles.text}>
          We do not sell personal data. Information may be shared with payment,
          logistics, fraud prevention, cloud hosting, or legal service providers
          when necessary to operate the platform.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Customer Rights</Text>

        <Text style={styles.text}>
          Customers may request updates, corrections, or deletion of certain
          account information where legally permitted.
        </Text>

        <Text style={styles.text}>
          Continued use of the platform indicates agreement with this privacy
          policy.
        </Text>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F7F7F2",
  },
  content: {
    padding: 20,
    paddingBottom: 50,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    marginBottom: 20,
    color: "#1f7a3f",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 10,
  },
  text: {
    marginBottom: 14,
    lineHeight: 23,
    color: "#444",
    fontWeight: "600",
  },
  bottomSpacer: {
    height: 40,
  },
});